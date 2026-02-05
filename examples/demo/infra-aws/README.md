# AWS CDK Infrastructure

This directory contains AWS CDK infrastructure code for deploying your ChaasKit application to AWS Elastic Beanstalk with RDS PostgreSQL.

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

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js 20+** and npm
3. **AWS CDK CLI**: `npm install -g aws-cdk`

## Quick Start

### 1. Configure Deployment

Edit `config/deployment.ts` with your settings:

```typescript
export const config: DeploymentConfig = {
  serviceName: 'my-app',
  region: 'us-west-2',
  balancerType: 'load_balancer', // or 'single_instance' for dev
  instanceType: 't4g.small',
  maxInstances: 2,
};
```

### 2. Install Dependencies

```bash
cd cdk
npm install
```

### 3. Bootstrap CDK (First Time Only)

```bash
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/us-west-2
```

### 4. Deploy

```bash
npm run deploy
```

This will:
1. Build your ChaasKit app
2. Package it for Elastic Beanstalk
3. Deploy all infrastructure

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `serviceName` | Name for AWS resources | Required |
| `region` | AWS region | `us-west-2` |
| `balancerType` | `load_balancer` or `single_instance` | `load_balancer` |
| `instanceType` | EC2 instance type | `t4g.small` |
| `maxInstances` | Max auto-scaling instances | `2` |
| `dbInstanceSize` | RDS instance size | `MICRO` |
| `domainName` | Custom domain (optional) | - |
| `certificateArn` | ACM cert ARN for HTTPS | - |

## Environment Variables

The following environment variables are automatically configured:

- `NODE_ENV=production`
- `PORT=8080`
- `INTERNAL_S3_BUCKET` - S3 bucket for file storage
- `DB_SECRET_ARN` - ARN of the database credentials secret
- `AWS_REGION` - Deployment region

### Setting Application Secrets

After deployment, add your application secrets (API keys, etc.) via the AWS Console or CLI:

```bash
# Via AWS Console:
# 1. Go to Elastic Beanstalk > Your Environment > Configuration
# 2. Edit "Software" section
# 3. Add environment variables

# Or via AWS CLI:
aws elasticbeanstalk update-environment \
  --environment-name my-app-prod \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=OPENAI_API_KEY,Value=sk-xxx \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=AUTH_SECRET,Value=your-secret
```

## Database Connection

The app reads database credentials from AWS Secrets Manager. The `DB_SECRET_ARN` environment variable contains the secret ARN.

Your app should fetch the secret at startup:

```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

async function getDatabaseUrl(): Promise<string> {
  const client = new SecretsManager({ region: process.env.AWS_REGION });
  const secret = await client.getSecretValue({ SecretId: process.env.DB_SECRET_ARN });
  const credentials = JSON.parse(secret.SecretString!);

  return `postgresql://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.dbname}`;
}
```

## Custom Domain Setup

1. **Create ACM Certificate** in AWS Certificate Manager (must be in the same region)
2. **Update config/deployment.ts**:
   ```typescript
   domainName: 'app.example.com',
   certificateArn: 'arn:aws:acm:us-west-2:123456789:certificate/xxx',
   ```
3. **Create Route 53 record** pointing to the ALB

## Staging vs Production

Deploy to different stages:

```bash
# Staging
STAGE=staging npm run deploy

# Production (default)
STAGE=prod npm run deploy
```

Each stage creates isolated resources (VPC, RDS, etc.).

## CI/CD with GitHub Actions

A GitHub Actions workflow is included at `.github/workflows/deploy.yml`.

Required GitHub Secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## Cost Estimation

Approximate monthly costs (us-west-2):

| Component | Single Instance | Load Balanced |
|-----------|-----------------|---------------|
| EC2 (t4g.small) | ~$12 | ~$24 |
| RDS (db.t4g.micro) | ~$13 | ~$13 |
| ALB | $0 | ~$18 |
| NAT Gateway | $0 | ~$32 |
| **Total** | **~$25/mo** | **~$87/mo** |

Use `single_instance` for development to minimize costs.

## Useful Commands

```bash
npm run synth    # Synthesize CloudFormation template
npm run diff     # Show changes vs deployed stack
npm run deploy   # Build app and deploy
npm run destroy  # Delete all resources
```

## Troubleshooting

### Deployment Fails

1. Check CloudFormation events in AWS Console
2. Review Elastic Beanstalk logs: `eb logs`

### Database Connection Issues

1. Verify security group allows traffic from EB instances
2. Check the secret exists and has correct values
3. Ensure the app is correctly reading `DB_SECRET_ARN`

### Health Check Failures

1. Ensure `/api/health` endpoint returns 200
2. Check application logs for startup errors
3. Verify all required environment variables are set
