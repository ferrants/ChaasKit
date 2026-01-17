import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elasticbeanstalk from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';
import { DeploymentConfig } from '../config/deployment';

export interface ChaaskitStackProps extends cdk.StackProps {
  stage: string;
  config: DeploymentConfig;
}

export class ChaaskitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ChaaskitStackProps) {
    super(scope, id, props);

    const { stage, config } = props;

    // Get or create VPC
    const vpc = this.getOrCreateVpc(config, stage);

    // S3 Bucket for internal storage (file uploads, etc.)
    const bucket = new s3.Bucket(this, 'InternalBucket', {
      bucketName: `${config.serviceName}-${stage}-internal`,
      removalPolicy: stage === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Get or create database
    const { dbSecretArn, dbSecurityGroup } = this.getOrCreateDatabase(config, stage, vpc);

    // IAM Role for Elastic Beanstalk EC2 instances
    const ebRole = new iam.Role(this, 'EBInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWorkerTier'),
      ],
    });

    // Grant permissions
    bucket.grantReadWrite(ebRole);

    // Grant access to the database secret
    if (dbSecretArn) {
      // Use fromSecretPartialArn to handle secrets without the 6-character suffix
      const dbSecret = secretsmanager.Secret.fromSecretPartialArn(this, 'DbSecret', dbSecretArn);
      dbSecret.grantRead(ebRole);
    }

    // Instance profile for EB
    const instanceProfile = new iam.CfnInstanceProfile(this, 'EBInstanceProfile', {
      roles: [ebRole.roleName],
    });

    // Elastic Beanstalk Application
    const app = new elasticbeanstalk.CfnApplication(this, 'App', {
      applicationName: `${config.serviceName}-${stage}`,
    });

    // Application Version from S3 asset
    const appAsset = new s3assets.Asset(this, 'AppAsset', {
      path: path.join(__dirname, `../../app-${config.buildVersion}.zip`),
    });
    appAsset.grantRead(ebRole);

    const appVersion = new elasticbeanstalk.CfnApplicationVersion(this, 'AppVersion', {
      applicationName: app.applicationName!,
      sourceBundle: {
        s3Bucket: appAsset.s3BucketName,
        s3Key: appAsset.s3ObjectKey,
      },
    });
    appVersion.addDependency(app);

    // Build option settings based on configuration
    const optionSettings = this.buildOptionSettings(config, stage, bucket, dbSecretArn, vpc, instanceProfile, dbSecurityGroup);

    // Elastic Beanstalk Environment
    const environment = new elasticbeanstalk.CfnEnvironment(this, 'Environment', {
      applicationName: app.applicationName!,
      environmentName: `${config.serviceName}-${stage}`,
      solutionStackName: '64bit Amazon Linux 2023 v6.4.1 running Node.js 22',
      versionLabel: appVersion.ref,
      optionSettings,
    });
    environment.addDependency(appVersion);

    // Outputs
    new cdk.CfnOutput(this, 'EnvironmentUrl', {
      value: config.balancerType === 'shared' && config.sharedAlb
        ? `https://${config.sharedAlb.hostHeaders[0]}`
        : `http://${environment.attrEndpointUrl}`,
      description: 'Application URL',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket for internal storage',
    });

    if (dbSecretArn) {
      new cdk.CfnOutput(this, 'DatabaseSecretArn', {
        value: dbSecretArn,
        description: 'ARN of the database credentials secret',
      });
    }
  }

  private getOrCreateVpc(config: DeploymentConfig, stage: string): ec2.IVpc {
    if (config.existingVpc) {
      // Use existing VPC
      return ec2.Vpc.fromVpcAttributes(this, 'ExistingVpc', {
        vpcId: config.existingVpc.vpcId,
        availabilityZones: ['us-west-2a', 'us-west-2b'],
        privateSubnetIds: config.existingVpc.privateSubnetIds,
        publicSubnetIds: config.existingVpc.publicSubnetIds,
      });
    }

    // Create new VPC
    return new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: config.balancerType === 'single_instance' ? 0 : 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: config.balancerType === 'single_instance'
            ? ec2.SubnetType.PUBLIC
            : ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });
  }

  private getOrCreateDatabase(
    config: DeploymentConfig,
    stage: string,
    vpc: ec2.IVpc
  ): { dbSecretArn: string | undefined; dbSecurityGroup: ec2.ISecurityGroup | undefined } {
    if (config.database === 'existing' && config.existingDbSecretArn) {
      // Use existing database - just return the secret ARN
      const dbSecurityGroup = config.existingVpc?.dbSecurityGroupId
        ? ec2.SecurityGroup.fromSecurityGroupId(this, 'ExistingDbSg', config.existingVpc.dbSecurityGroupId)
        : undefined;

      return {
        dbSecretArn: config.existingDbSecretArn,
        dbSecurityGroup,
      };
    }

    // Create new database
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: false,
    });

    // Allow connections from within VPC
    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from VPC'
    );

    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        config.dbInstanceSize || ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcSubnets: {
        subnetType: config.balancerType === 'single_instance'
          ? ec2.SubnetType.PUBLIC
          : ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromGeneratedSecret('chaaskit', {
        secretName: `${config.serviceName}-${stage}-db-credentials`,
      }),
      databaseName: 'chaaskit',
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      multiAz: stage === 'prod' && config.balancerType !== 'single_instance',
      deletionProtection: stage === 'prod',
      removalPolicy: stage === 'prod'
        ? cdk.RemovalPolicy.SNAPSHOT
        : cdk.RemovalPolicy.DESTROY,
      backupRetention: stage === 'prod' ? cdk.Duration.days(7) : cdk.Duration.days(1),
    });

    return {
      dbSecretArn: database.secret?.secretArn,
      dbSecurityGroup,
    };
  }

  private buildOptionSettings(
    config: DeploymentConfig,
    stage: string,
    bucket: s3.Bucket,
    dbSecretArn: string | undefined,
    vpc: ec2.IVpc,
    instanceProfile: iam.CfnInstanceProfile,
    dbSecurityGroup: ec2.ISecurityGroup | undefined
  ): elasticbeanstalk.CfnEnvironment.OptionSettingProperty[] {
    const settings: elasticbeanstalk.CfnEnvironment.OptionSettingProperty[] = [];

    // VPC settings
    if (config.existingVpc) {
      settings.push(
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'VPCId',
          value: config.existingVpc.vpcId,
        },
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'Subnets',
          value: config.existingVpc.privateSubnetIds.join(','),
        },
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'ELBSubnets',
          value: config.existingVpc.publicSubnetIds.join(','),
        }
      );
    } else {
      settings.push(
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'VPCId',
          value: vpc.vpcId,
        },
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'Subnets',
          value: vpc.privateSubnets.map(s => s.subnetId).join(','),
        },
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'ELBSubnets',
          value: vpc.publicSubnets.map(s => s.subnetId).join(','),
        }
      );
    }

    // Environment type settings based on balancer type
    if (config.balancerType === 'single_instance') {
      settings.push({
        namespace: 'aws:elasticbeanstalk:environment',
        optionName: 'EnvironmentType',
        value: 'SingleInstance',
      });
    } else {
      // Both 'load_balancer' and 'shared' are load balanced
      settings.push(
        {
          namespace: 'aws:elasticbeanstalk:environment',
          optionName: 'EnvironmentType',
          value: 'LoadBalanced',
        },
        {
          namespace: 'aws:elasticbeanstalk:environment',
          optionName: 'LoadBalancerType',
          value: 'application',
        }
      );

      // Shared ALB settings
      if (config.balancerType === 'shared' && config.sharedAlb) {
        settings.push(
          {
            namespace: 'aws:elasticbeanstalk:environment',
            optionName: 'LoadBalancerIsShared',
            value: 'true',
          },
          {
            namespace: 'aws:elbv2:loadbalancer',
            optionName: 'SharedLoadBalancer',
            value: config.sharedAlb.albArn,
          },
          // Listener rule for host-based routing
          {
            namespace: 'aws:elbv2:listener:443',
            optionName: 'Rules',
            value: 'HostRule',
          },
          {
            namespace: 'aws:elbv2:listenerrule:HostRule',
            optionName: 'HostHeaders',
            value: config.sharedAlb.hostHeaders.join(','),
          },
          {
            namespace: 'aws:elbv2:listenerrule:HostRule',
            optionName: 'Priority',
            value: String(config.sharedAlb.priority),
          }
        );
      } else if (config.balancerType === 'load_balancer' && config.certificateArn) {
        // New ALB with HTTPS
        settings.push(
          {
            namespace: 'aws:elbv2:listener:443',
            optionName: 'Protocol',
            value: 'HTTPS',
          },
          {
            namespace: 'aws:elbv2:listener:443',
            optionName: 'SSLCertificateArns',
            value: config.certificateArn,
          }
        );
      }
    }

    // Instance settings
    settings.push(
      {
        namespace: 'aws:autoscaling:launchconfiguration',
        optionName: 'InstanceType',
        value: config.instanceType || 't4g.small',
      },
      {
        namespace: 'aws:autoscaling:launchconfiguration',
        optionName: 'IamInstanceProfile',
        value: instanceProfile.ref,
      },
      {
        namespace: 'aws:autoscaling:asg',
        optionName: 'MinSize',
        value: '1',
      },
      {
        namespace: 'aws:autoscaling:asg',
        optionName: 'MaxSize',
        value: String(config.maxInstances || 2),
      }
    );

    // Security group for RDS access
    if (dbSecurityGroup) {
      settings.push({
        namespace: 'aws:autoscaling:launchconfiguration',
        optionName: 'SecurityGroups',
        value: dbSecurityGroup.securityGroupId,
      });
    }

    // Health check
    settings.push(
      {
        namespace: 'aws:elasticbeanstalk:environment:process:default',
        optionName: 'HealthCheckPath',
        value: '/api/health',
      },
      {
        namespace: 'aws:elasticbeanstalk:healthreporting:system',
        optionName: 'SystemType',
        value: 'enhanced',
      }
    );

    // Environment variables
    settings.push(
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'NODE_ENV',
        value: 'production',
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'PORT',
        value: '8080',
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'INTERNAL_S3_BUCKET',
        value: bucket.bucketName,
      },
      {
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'AWS_REGION',
        value: config.region,
      }
    );

    // Database secret ARN
    if (dbSecretArn) {
      settings.push({
        namespace: 'aws:elasticbeanstalk:application:environment',
        optionName: 'DB_SECRET_ARN',
        value: dbSecretArn,
      });
    }

    return settings;
  }
}
