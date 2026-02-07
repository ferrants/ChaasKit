# Plan: AWS CDK Deployment for Elastic Beanstalk

## Goal
Add `chaaskit add-infra aws` CLI command and documentation for deploying ChaasKit projects to AWS Elastic Beanstalk with RDS PostgreSQL.

## User Preferences
- **CDK Location:** CLI command (`chaaskit add-infra aws`) to inject CDK code on demand
- **Complexity:** Basic template + docs showing how to add advanced features
- **CI/CD:** GitHub Actions workflow for deployment

## Reference Implementation
Based on patterns from `/home/matt/code/remix_test/blog-tutorial/cdk/`:
- Single stack approach with configurable balancer types (load_balancer, shared, single_instance)
- S3 asset-based deployment (zip file)
- Environment variables via EB option settings
- IAM role with S3, SES permissions
- Shared ALB support with host-based routing

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         AWS Cloud                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                        VPC                             │  │
│  │  ┌─────────────┐     ┌─────────────────────────────┐  │  │
│  │  │ Public      │     │ Private Subnet              │  │  │
│  │  │ Subnet      │     │  ┌─────────────────────┐   │  │  │
│  │  │  ┌───────┐  │     │  │ Elastic Beanstalk   │   │  │  │
│  │  │  │  ALB  │──┼─────┼──│ Node.js 22          │   │  │  │
│  │  │  └───────┘  │     │  └─────────┬───────────┘   │  │  │
│  │  └─────────────┘     │            │               │  │  │
│  │                      │  ┌─────────▼───────────┐   │  │  │
│  │                      │  │ RDS PostgreSQL 16   │   │  │  │
│  │                      │  └─────────────────────┘   │  │  │
│  │                      └─────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ ACM (SSL)   │  │ Secrets Mgr │  │ S3 (Assets)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### 1. Add CLI Command

**File:** `packages/create-chaaskit/src/commands/add-infra.ts`

```typescript
export async function addInfra(provider: string, options: AddInfraOptions): Promise<void> {
  if (provider !== 'aws') {
    throw new Error(`Unknown provider: ${provider}. Supported: aws`);
  }

  // Copy CDK template files to project
  const templatesPath = path.join(__dirname, '../templates/infra-aws');
  const targetPath = path.join(process.cwd(), 'cdk');

  await fs.copy(templatesPath, targetPath);

  // Update .gitignore
  await appendToGitignore(['cdk/cdk.out', 'cdk/node_modules', '*.zip']);

  console.log('AWS CDK infrastructure added to ./cdk/');
  console.log('Next steps:');
  console.log('  1. cd cdk && npm install');
  console.log('  2. Configure cdk/config/deployment.ts');
  console.log('  3. npx cdk bootstrap (one-time)');
  console.log('  4. npx cdk deploy');
}
```

**Register in CLI:** `packages/create-chaaskit/src/index.ts`

```typescript
program
  .command('add-infra <provider>')
  .description('Add infrastructure-as-code (aws)')
  .action(addInfra);
```

### 2. CDK Template Structure

**Location:** `packages/create-chaaskit/src/templates/infra-aws/`

```
infra-aws/
├── bin/
│   └── cdk.ts                    # Entry point
├── lib/
│   └── chaaskit-stack.ts         # Main stack (EB + RDS + IAM)
├── config/
│   └── deployment.ts             # User configuration
├── scripts/
│   └── build-app.sh              # Package app for EB
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Actions workflow
├── cdk.json
├── tsconfig.json
├── package.json
└── README.md
```

### 3. CDK Stack Implementation

**File:** `lib/chaaskit-stack.ts`

Key components (following blog-tutorial patterns):

```typescript
export class ChaaskitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ChaaskitStackProps) {
    super(scope, id, props);

    const { stage, config } = props;

    // 1. S3 Bucket for internal storage
    const bucket = new s3.Bucket(this, 'InternalBucket', {
      bucketName: `${config.serviceName}-${stage}-internal`,
      removalPolicy: stage === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // 2. RDS PostgreSQL (basic setup)
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      credentials: rds.Credentials.fromGeneratedSecret('chaaskit'),
      databaseName: 'chaaskit',
      removalPolicy: stage === 'prod'
        ? cdk.RemovalPolicy.SNAPSHOT
        : cdk.RemovalPolicy.DESTROY,
    });

    // 3. IAM Role for EB instances
    const ebRole = new iam.Role(this, 'EBRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier'),
      ],
    });
    bucket.grantReadWrite(ebRole);
    database.secret?.grantRead(ebRole);

    // 4. Elastic Beanstalk Application
    const app = new elasticbeanstalk.CfnApplication(this, 'App', {
      applicationName: `${config.serviceName}-${stage}`,
    });

    // 5. Application Version (from S3 asset)
    const appAsset = new s3assets.Asset(this, 'AppAsset', {
      path: path.join(__dirname, `../../app-${config.buildVersion}.zip`),
    });

    const appVersion = new elasticbeanstalk.CfnApplicationVersion(this, 'AppVersion', {
      applicationName: app.applicationName!,
      sourceBundle: {
        s3Bucket: appAsset.s3BucketName,
        s3Key: appAsset.s3ObjectKey,
      },
    });

    // 6. EB Environment with option settings
    const environment = new elasticbeanstalk.CfnEnvironment(this, 'Environment', {
      applicationName: app.applicationName!,
      environmentName: `${config.serviceName}-${stage}`,
      solutionStackName: '64bit Amazon Linux 2023 v6.6.4 running Node.js 22',
      versionLabel: appVersion.ref,
      optionSettings: this.buildOptionSettings(config, stage, bucket, database),
    });
  }

  private buildOptionSettings(config, stage, bucket, database) {
    return [
      // Environment type
      { namespace: 'aws:elasticbeanstalk:environment', optionName: 'EnvironmentType', value: config.balancerType === 'single_instance' ? 'SingleInstance' : 'LoadBalanced' },

      // Instance settings
      { namespace: 'aws:autoscaling:launchconfiguration', optionName: 'InstanceType', value: config.instanceType || 't4g.small' },
      { namespace: 'aws:autoscaling:asg', optionName: 'MinSize', value: '1' },
      { namespace: 'aws:autoscaling:asg', optionName: 'MaxSize', value: config.maxInstances || '2' },

      // Health check
      { namespace: 'aws:elasticbeanstalk:environment:process:default', optionName: 'HealthCheckPath', value: '/api/health' },

      // Environment variables
      { namespace: 'aws:elasticbeanstalk:application:environment', optionName: 'NODE_ENV', value: 'production' },
      { namespace: 'aws:elasticbeanstalk:application:environment', optionName: 'PORT', value: '8080' },
      { namespace: 'aws:elasticbeanstalk:application:environment', optionName: 'INTERNAL_S3_BUCKET', value: bucket.bucketName },
      // DATABASE_URL injected from Secrets Manager at runtime
    ];
  }
}
```

### 4. Configuration File

**File:** `config/deployment.ts`

```typescript
export interface DeploymentConfig {
  serviceName: string;
  region: string;

  // Balancer type: 'load_balancer' | 'shared' | 'single_instance'
  balancerType: 'load_balancer' | 'shared' | 'single_instance';

  // Instance settings
  instanceType: string;
  maxInstances: number;

  // Domain (optional)
  domainName?: string;
  certificateArn?: string;

  // For shared ALB
  sharedAlbArn?: string;
  listenerArn?: string;
  priority?: number;

  // Build version (git short hash)
  buildVersion: string;
}

export const config: DeploymentConfig = {
  serviceName: 'my-chaaskit-app',
  region: 'us-west-2',
  balancerType: 'load_balancer',
  instanceType: 't4g.small',
  maxInstances: 2,
  buildVersion: process.env.BUILD_VERSION || 'latest',
};
```

### 5. Build Script

**File:** `scripts/build-app.sh`

```bash
#!/bin/bash
set -e

BUILD_VERSION=${BUILD_VERSION:-$(git rev-parse --short HEAD)}

echo "Building ChaasKit application..."

# Build from project root
cd ..
pnpm install
pnpm build
pnpm db:generate

# Create deployment package
echo "Creating deployment package: app-${BUILD_VERSION}.zip"
zip -r "cdk/app-${BUILD_VERSION}.zip" \
  build/ \
  node_modules/ \
  package.json \
  server.js \
  prisma/ \
  config/ \
  extensions/ \
  -x "*.git*" \
  -x "*node_modules/.cache*"

echo "Done! Package: cdk/app-${BUILD_VERSION}.zip"
```

### 6. GitHub Actions Workflow

**File:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      stage:
        description: 'Deployment stage'
        required: true
        default: 'prod'
        type: choice
        options:
          - staging
          - prod

env:
  AWS_REGION: us-west-2
  SERVICE_NAME: my-chaaskit-app

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Build application
        run: |
          pnpm build
          pnpm db:generate

      - name: Package for Elastic Beanstalk
        run: |
          export BUILD_VERSION=${{ github.sha }}
          cd cdk && ./scripts/build-app.sh

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Install CDK
        run: npm install -g aws-cdk

      - name: Deploy CDK Stack
        run: |
          cd cdk
          npm install
          npx cdk deploy --require-approval never
        env:
          STAGE: ${{ inputs.stage || 'prod' }}
          BUILD_VERSION: ${{ github.sha }}
```

### 7. Documentation

**New file:** `docs/deployment-aws.md`

Contents:
1. Prerequisites (AWS account, CLI, CDK)
2. Quick start guide
3. Architecture diagram
4. Configuration reference
5. Secrets management (how to set API keys)
6. Custom domain setup
7. Shared ALB configuration (multi-tenant)
8. Advanced: Adding CloudFront, SQS, WAF
9. Monitoring & logs
10. Cost estimation
11. Troubleshooting

**Update:** `docs/deployment.md` - Add AWS section linking to deployment-aws.md

**Update:** `docs/index.md` - Add AWS to deployment options

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/create-chaaskit/src/commands/add-infra.ts` | Create | CLI command implementation |
| `packages/create-chaaskit/src/index.ts` | Edit | Register add-infra command |
| `packages/create-chaaskit/src/templates/infra-aws/*` | Create | CDK template files |
| `docs/deployment-aws.md` | Create | AWS deployment guide |
| `docs/deployment.md` | Edit | Add link to AWS guide |
| `docs/index.md` | Edit | Add AWS to docs index |

---

## Verification

1. Run `chaaskit add-infra aws` in a test project
2. Verify CDK files are copied correctly
3. Run `cdk synth` to validate CloudFormation output
4. Deploy to test AWS account
5. Verify:
   - EB environment starts
   - App responds at /api/health
   - Database connection works
   - GitHub Actions workflow succeeds
6. Test with shared ALB configuration
7. Document any issues in troubleshooting section

---

## Advanced Features (docs only, not in basic template)

Document how to add:
- **CloudFront CDN** - For static assets and caching
- **SQS Queue** - For ChaasKit job queue (`queue.providerConfig.type: 'sqs'`)
- **WAF** - Web application firewall rules
- **Multi-region** - Disaster recovery setup
- **Blue/Green deployments** - Zero-downtime updates
