#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { AgentCoreStack } from '../lib/agentcore-stack';
import { BackendStack } from '../lib/backend-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
};

const projectName = app.node.tryGetContext('projectName') || 'agent-arms';
const environment = app.node.tryGetContext('environment') || 'dev';

const network = new NetworkStack(app, `${projectName}-network-${environment}`, {
  env,
  projectName,
  environment,
});

const database = new DatabaseStack(app, `${projectName}-database-${environment}`, {
  env,
  projectName,
  environment,
  vpc: network.vpc,
});

const agentcore = new AgentCoreStack(app, `${projectName}-agentcore-${environment}`, {
  env,
  projectName,
  environment,
  vpc: network.vpc,
});

const backend = new BackendStack(app, `${projectName}-backend-${environment}`, {
  env,
  projectName,
  environment,
  vpc: network.vpc,
  database: database.cluster,
  dbSecret: database.cluster.secret!,
  redis: database.redis,
  agentCoreGatewayEndpoint: agentcore.gatewayEndpoint,
  agentCoreRuntimeEndpoint: agentcore.runtimeEndpoint,
});

new FrontendStack(app, `${projectName}-frontend-${environment}`, {
  env,
  projectName,
  environment,
  backendService: backend.service,
  backendUrl: backend.loadBalancerDnsName,
  backendLoadBalancer: backend.loadBalancer,
});

app.synth();
