#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ChaaskitStack } from '../lib/chaaskit-stack';
import { config } from '../config/deployment';

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'prod';

new ChaaskitStack(app, `${config.serviceName}-${stage}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: config.region,
  },
  stage,
  config,
});
