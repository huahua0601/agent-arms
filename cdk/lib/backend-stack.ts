import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

export interface BackendStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.IVpc;
  database: rds.IDatabaseCluster;
  redis: elasticache.CfnCacheCluster;
  agentCoreGatewayEndpoint: string;
  agentCoreRuntimeEndpoint: string;
}

export class BackendStack extends cdk.Stack {
  public readonly service: ecs.IBaseService;
  public readonly cluster: ecs.ICluster;

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
      ],
    });

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'BackendService', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromDockerImageAsset(backendImage),
        containerPort: 8000,
        taskRole,
        environment: {
          AWS_REGION: cdk.Stack.of(this).region,
          AGENTCORE_ENABLED: 'true',
          AGENTCORE_GATEWAY_ENDPOINT: props.agentCoreGatewayEndpoint,
          AGENTCORE_RUNTIME_ENDPOINT: props.agentCoreRuntimeEndpoint,
          AGENTCORE_MEMORY_NAMESPACE: props.projectName,
          AGENTCORE_OBSERVABILITY_ENABLED: 'true',
          REDIS_URL: `redis://${props.redis.attrRedisEndpointAddress}:${props.redis.attrRedisEndpointPort}/0`,
          DEFAULT_ADMIN_USERNAME: 'admin',
          DEFAULT_ADMIN_EMAIL: 'admin@agentarms.local',
          RATE_LIMIT_PER_MINUTE: '120',
          DATABASE_URL: `postgresql+asyncpg://mcp_registry:password@${props.database.clusterEndpoint.hostname}:5432/mcp_registry`,
          SYNC_DATABASE_URL: `postgresql://mcp_registry:password@${props.database.clusterEndpoint.hostname}:5432/mcp_registry`,
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

    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
    });

    // Auto-scaling
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
