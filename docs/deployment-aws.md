# AWS Deployment

Deploy your ChaasKit application to AWS using Elastic Beanstalk with RDS PostgreSQL via AWS CDK.

## Overview

The AWS deployment creates:

- **VPC** with public and private subnets
- **Elastic Beanstalk** environment running Node.js 22
- **Application Load Balancer** (optional) for HTTPS and scaling
- **RDS PostgreSQL 16** database
- **S3 bucket** for internal file storage
- **Secrets Manager** for database credentials
- **IAM roles** with appropriate permissions

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

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **Node.js 20+** installed
4. **AWS CDK CLI**: `npm install -g aws-cdk`

## Quick Start

### 1. Add Infrastructure Code

From your ChaasKit project directory:

```bash
npx chaaskit add-infra aws
```

This creates a `cdk/` directory with all infrastructure code.

### 2. Configure Deployment

Edit `cdk/config/deployment.ts`:

```typescript
export const config: DeploymentConfig = {
  serviceName: 'my-app',           // Used for AWS resource names
  region: 'us-west-2',             // AWS region
  balancerType: 'load_balancer',   // or 'single_instance' for dev
  instanceType: 't4g.small',       // EC2 instance type
  maxInstances: 2,                 // Auto-scaling max
};
```

### 3. Install CDK Dependencies

```bash
cd cdk
npm install
```

### 4. Bootstrap CDK (First Time Only)

```bash
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/us-west-2
```

### 5. Deploy

```bash
npm run deploy
```

This will:
1. Build your ChaasKit application
2. Package it for Elastic Beanstalk
3. Deploy all AWS infrastructure
4. Start your application

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `serviceName` | Name prefix for all AWS resources | Required |
| `region` | AWS region to deploy to | `us-west-2` |
| `balancerType` | `load_balancer` or `single_instance` | `load_balancer` |
| `instanceType` | EC2 instance type | `t4g.small` |
| `maxInstances` | Max instances for auto-scaling | `2` |
| `dbInstanceSize` | RDS instance size | `MICRO` |
| `domainName` | Custom domain (optional) | - |
| `certificateArn` | ACM certificate for HTTPS | - |

## Environment Variables

The following are automatically configured:

- `NODE_ENV=production`
- `PORT=8080`
- `INTERNAL_S3_BUCKET` - S3 bucket name
- `DB_SECRET_ARN` - Database credentials secret
- `AWS_REGION` - Deployment region

### Adding Application Secrets

After deployment, add your secrets via AWS Console or CLI:

```bash
aws elasticbeanstalk update-environment \
  --environment-name my-app-prod \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=ANTHROPIC_API_KEY,Value=sk-ant-xxx \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=SESSION_SECRET,Value=your-secret \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=JWT_SECRET,Value=your-jwt-secret
```

Or via the AWS Console:
1. Go to Elastic Beanstalk → Your Environment → Configuration
2. Edit the "Software" section
3. Add environment variables

## Database Connection

Database credentials are stored in AWS Secrets Manager. The CDK stack creates code to fetch these at runtime.

To access the database URL, you'll need to update your app to read from Secrets Manager:

```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

async function getDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error('No DATABASE_URL or DB_SECRET_ARN configured');
  }

  const client = new SecretsManager({ region: process.env.AWS_REGION });
  const secret = await client.getSecretValue({ SecretId: secretArn });
  const credentials = JSON.parse(secret.SecretString!);

  return `postgresql://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.dbname}`;
}
```

## Custom Domain with HTTPS

### 1. Create ACM Certificate

In AWS Certificate Manager (same region as deployment):
1. Request a public certificate
2. Add your domain name(s)
3. Validate via DNS or email

### 2. Update Configuration

```typescript
export const config: DeploymentConfig = {
  // ... other settings
  domainName: 'app.example.com',
  certificateArn: 'arn:aws:acm:us-west-2:123456789:certificate/xxx-xxx',
};
```

### 3. Create DNS Record

In Route 53 (or your DNS provider), create an A record pointing to the ALB.

## Staging vs Production

Deploy to different stages for isolation:

```bash
# Staging environment
STAGE=staging npm run deploy

# Production environment (default)
STAGE=prod npm run deploy
```

Each stage creates completely isolated resources.

## CI/CD with GitHub Actions

A workflow is included at `.github/workflows/deploy.yml`.

### Required GitHub Secrets

Add these to your repository settings:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Trigger Deployment

- Push to `main` branch triggers automatic deployment
- Use workflow dispatch for manual deploys to specific stages

## Cost Estimation

Approximate monthly costs (us-west-2):

| Component | Single Instance | Load Balanced |
|-----------|-----------------|---------------|
| EC2 (t4g.small) | ~$12 | ~$24 |
| RDS (db.t4g.micro) | ~$13 | ~$13 |
| ALB | $0 | ~$18 |
| NAT Gateway | $0 | ~$32 |
| S3 (10GB) | ~$0.25 | ~$0.25 |
| **Total** | **~$25/mo** | **~$87/mo** |

Use `single_instance` mode for development to minimize costs.

## Useful Commands

```bash
# Preview changes without deploying
npm run diff

# Synthesize CloudFormation template
npm run synth

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod

# Delete all resources
npm run destroy
```

## Troubleshooting

### Deployment Fails

1. Check CloudFormation events in AWS Console
2. Look at Elastic Beanstalk event logs
3. Review the application logs in CloudWatch

### Health Check Failures

1. Ensure `/api/health` returns 200
2. Check application logs for startup errors
3. Verify all required environment variables are set

### Database Connection Issues

1. Verify security group allows traffic from EB instances
2. Check the secret exists and has correct values
3. Ensure the app correctly reads `DB_SECRET_ARN`

### "Command timed out" Errors

1. Increase instance type
2. Check for memory issues in logs
3. Consider splitting the deployment

## Advanced Topics

### Adding CloudFront CDN

For static assets and global distribution, add a CloudFront distribution:

1. Create a CloudFront distribution pointing to your ALB
2. Configure caching for `/assets/*` paths
3. Update `APP_URL` to use CloudFront domain

### SQS for Background Jobs

To use SQS instead of in-memory queue:

1. Add SQS queue to the CDK stack
2. Configure `queue.providerConfig.type: 'sqs'` in app config
3. Grant EB role permissions to the queue

### Multi-Region Deployment

For disaster recovery or global presence:

1. Deploy separate stacks per region
2. Use Route 53 latency-based routing
3. Configure database replication

See the [CDK README](../cdk/README.md) for more details.
