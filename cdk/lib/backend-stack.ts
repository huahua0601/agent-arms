import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

export interface BackendStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.IVpc;
  database: rds.IDatabaseCluster;
  dbSecret: secretsmanager.ISecret;
  redis: elasticache.CfnReplicationGroup;
  agentCoreGatewayEndpoint: string;
  agentCoreRuntimeEndpoint: string;
}

export class BackendStack extends cdk.Stack {
  public readonly service: ecs.IBaseService;
  public readonly cluster: ecs.ICluster;
  public readonly loadBalancerDnsName: string;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const cluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc: props.vpc,
      clusterName: `${props.projectName}-${props.environment}`,
      containerInsights: true,
    });
    this.cluster = cluster;

    const backendImage = new ecr_assets.DockerImageAsset(this, 'BackendImage', {
      directory: path.resolve(__dirname, '../../backend'),
    });

    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess'),
      ],
    });
    props.dbSecret.grantRead(taskRole);

    const dbHost = props.database.clusterEndpoint.hostname;
    const redisEndpoint = props.redis.attrPrimaryEndPointAddress;
    const redisPort = props.redis.attrPrimaryEndPointPort;

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'BackendService', {
      cluster,
      circuitBreaker: { enable: true, rollback: true },
      taskImageOptions: {
        image: ecs.ContainerImage.fromDockerImageAsset(backendImage),
        containerPort: 8000,
        taskRole,
        environment: {
          AWS_REGION: cdk.Stack.of(this).region,
          AGENTCORE_ENABLED: 'true',
          AGENTCORE_GATEWAY_ENDPOINT: props.agentCoreGatewayEndpoint,
          AGENTCORE_RUNTIME_ENDPOINT: props.agentCoreRuntimeEndpoint,
          AGENTCORE_RUNTIME_ROLE_ARN: `arn:aws:iam::${cdk.Stack.of(this).account}:role/agent-arms-dev-agentcore`,
          AGENTCORE_MEMORY_NAMESPACE: props.projectName,
          AGENTCORE_OBSERVABILITY_ENABLED: 'true',
          REDIS_URL: `redis://${redisEndpoint}:${redisPort}/0`,
          DEFAULT_ADMIN_USERNAME: 'admin',
          DEFAULT_ADMIN_EMAIL: 'admin@agentarms.local',
          RATE_LIMIT_PER_MINUTE: '120',
          DB_HOST: dbHost,
          DB_PORT: '5432',
          DB_NAME: 'mcp_registry',
        },
        secrets: {
          DB_USERNAME: ecs.Secret.fromSecretsManager(props.dbSecret, 'username'),
          DB_PASSWORD: ecs.Secret.fromSecretsManager(props.dbSecret, 'password'),
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'backend',
          logRetention: logs.RetentionDays.TWO_WEEKS,
        }),
      },
      desiredCount: 2,
      cpu: 512,
      memoryLimitMiB: 1024,
      publicLoadBalancer: true,
      assignPublicIp: false,
    });

    this.service = fargateService.service;
    this.loadBalancerDnsName = fargateService.loadBalancer.loadBalancerDnsName;

    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
    });

    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });
    scaling.scaleOnCpuUtilization('CpuScaling', { targetUtilizationPercent: 70 });
    scaling.scaleOnMemoryUtilization('MemScaling', { targetUtilizationPercent: 80 });

    new cdk.CfnOutput(this, 'BackendUrl', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
    });
  }
}
