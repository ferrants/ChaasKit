import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface DeploymentConfig {
  /**
   * Service name used for naming AWS resources.
   * Must be lowercase, alphanumeric, and hyphens only.
   */
  serviceName: string;

  /**
   * AWS region to deploy to
   */
  region: string;

  /**
   * Balancer type:
   * - 'load_balancer': Create new Application Load Balancer (default)
   * - 'shared': Use existing shared ALB (requires sharedAlb config)
   * - 'single_instance': No load balancer, single EC2 instance (dev/testing)
   */
  balancerType: 'load_balancer' | 'shared' | 'single_instance';

  /**
   * EC2 instance type for the application servers
   * Recommended: t4g.small for small workloads, t4g.medium for medium
   */
  instanceType: string;

  /**
   * Maximum number of instances for auto-scaling
   */
  maxInstances: number;

  /**
   * Database configuration:
   * - 'create': Create a new RDS instance (default)
   * - 'existing': Use an existing RDS via Secrets Manager
   */
  database: 'create' | 'existing';

  /**
   * RDS instance size (only used when database: 'create')
   * Recommended: MICRO for dev, SMALL for staging, MEDIUM+ for production
   */
  dbInstanceSize?: ec2.InstanceSize;

  /**
   * Existing database secret ARN in Secrets Manager (required when database: 'existing')
   * The secret should contain: host, port, dbname, username, password
   */
  existingDbSecretArn?: string;

  /**
   * Custom domain name (optional)
   * Example: 'app.example.com'
   */
  domainName?: string;

  /**
   * ACM certificate ARN for HTTPS
   * Required for shared ALB or custom domain with new ALB
   */
  certificateArn?: string;

  /**
   * Shared ALB configuration (required when balancerType: 'shared')
   */
  sharedAlb?: {
    /** ARN of the shared ALB */
    albArn: string;
    /** ARN of the HTTPS listener (port 443) */
    listenerArn: string;
    /** Host headers for routing (e.g., ['app.example.com', '*.example.com']) */
    hostHeaders: string[];
    /** Priority for the listener rule (must be unique per listener) */
    priority: number;
  };

  /**
   * Existing VPC configuration (required when using shared ALB or existing RDS)
   */
  existingVpc?: {
    /** VPC ID */
    vpcId: string;
    /** Private subnet IDs for EC2/RDS */
    privateSubnetIds: string[];
    /** Public subnet IDs for ALB */
    publicSubnetIds: string[];
    /** Security group ID that allows RDS access (optional) */
    dbSecurityGroupId?: string;
  };

  /**
   * Build version identifier (typically git commit SHA)
   * This determines which app-{version}.zip file to deploy
   */
  buildVersion: string;
}

/**
 * Configure your deployment settings here
 */
export const config: DeploymentConfig = {
  // Service name - will be used for AWS resource naming
  serviceName: '{{SERVICE_NAME}}',

  // AWS region
  region: 'us-west-2',

  // Balancer type: 'load_balancer' (new), 'shared' (existing), or 'single_instance'
  balancerType: 'load_balancer',

  // Instance type - t4g instances are ARM-based and cost-effective
  instanceType: 't4g.small',

  // Maximum instances for auto-scaling
  maxInstances: 2,

  // Database: 'create' for new RDS, 'existing' for shared RDS
  database: 'create',

  // Database instance size (when database: 'create')
  dbInstanceSize: ec2.InstanceSize.MICRO,

  // Custom domain (uncomment and configure)
  // domainName: 'app.example.com',
  // certificateArn: 'arn:aws:acm:us-west-2:123456789:certificate/xxx',

  // ============================================================
  // SHARED RESOURCES (uncomment to use existing infrastructure)
  // ============================================================

  // To use an existing database:
  // database: 'existing',
  // existingDbSecretArn: 'arn:aws:secretsmanager:us-west-2:ACCOUNT:secret:SECRET_ID',

  // To use a shared ALB:
  // balancerType: 'shared',
  // sharedAlb: {
  //   albArn: 'arn:aws:elasticloadbalancing:us-west-2:ACCOUNT:loadbalancer/app/NAME/ID',
  //   listenerArn: 'arn:aws:elasticloadbalancing:us-west-2:ACCOUNT:listener/app/NAME/ID/LISTENER_ID',
  //   hostHeaders: ['app.example.com'],
  //   priority: 10,
  // },

  // To use an existing VPC (required for shared ALB or existing RDS):
  // existingVpc: {
  //   vpcId: 'vpc-xxx',
  //   privateSubnetIds: ['subnet-xxx', 'subnet-yyy'],
  //   publicSubnetIds: ['subnet-xxx', 'subnet-yyy'],
  //   dbSecurityGroupId: 'sg-xxx',
  // },

  // Build version - set by CI/CD or use 'latest' for manual deploys
  buildVersion: process.env.BUILD_VERSION || 'latest',
};
