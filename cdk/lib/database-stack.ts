import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.IVpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly cluster: rds.IDatabaseCluster;
  public readonly redis: elasticache.CfnCacheCluster;
  public readonly dbSecurityGroup: ec2.ISecurityGroup;
  public readonly redisSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // PostgreSQL Aurora Serverless v2
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: props.vpc,
      description: 'Security group for Aurora PostgreSQL',
      allowAllOutbound: true,
    });

    this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.dbSecurityGroup],
      defaultDatabaseName: 'mcp_registry',
      credentials: rds.Credentials.fromGeneratedSecret('mcp_registry', {
        secretName: `${props.projectName}/${props.environment}/db-credentials`,
      }),
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ElastiCache Redis
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSg', {
      vpc: props.vpc,
      description: 'Security group for Redis',
      allowAllOutbound: true,
    });

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Redis subnet group',
      subnetIds: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
      cacheSubnetGroupName: `${props.projectName}-${props.environment}-redis`,
    });

    this.redis = new elasticache.CfnCacheCluster(this, 'Redis', {
      engine: 'redis',
      cacheNodeType: 'cache.t3.micro',
      numCacheNodes: 1,
      vpcSecurityGroupIds: [this.redisSecurityGroup.securityGroupId],
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
    });
    this.redis.addDependency(redisSubnetGroup);

    new cdk.CfnOutput(this, 'DbEndpoint', { value: this.cluster.clusterEndpoint.hostname });
    new cdk.CfnOutput(this, 'RedisEndpoint', { value: this.redis.attrRedisEndpointAddress });
  }
}
