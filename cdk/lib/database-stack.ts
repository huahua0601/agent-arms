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
  public readonly cluster: rds.DatabaseCluster;
  public readonly redis: elasticache.CfnReplicationGroup;
  public readonly dbSecurityGroup: ec2.ISecurityGroup;
  public readonly redisSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // PostgreSQL Aurora with provisioned T4G instances (LTS version 16.4)
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: props.vpc,
      description: 'Security group for Aurora PostgreSQL',
      allowAllOutbound: true,
    });

    this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      writer: rds.ClusterInstance.provisioned('writer', {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MEDIUM),
      }),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.dbSecurityGroup],
      defaultDatabaseName: 'mcp_registry',
      credentials: rds.Credentials.fromGeneratedSecret('mcp_registry', {
        secretName: `${props.projectName}/${props.environment}/db-credentials`,
      }),
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ElastiCache Valkey 8.0 with T4G instance (ReplicationGroup required for Valkey)
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSg', {
      vpc: props.vpc,
      description: 'Security group for Valkey',
      allowAllOutbound: true,
    });

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Valkey subnet group',
      subnetIds: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
      cacheSubnetGroupName: `${props.projectName}-${props.environment}-valkey`,
    });

    this.redis = new elasticache.CfnReplicationGroup(this, 'Redis', {
      replicationGroupDescription: `${props.projectName}-${props.environment} Valkey cluster`,
      engine: 'valkey',
      engineVersion: '8.0',
      cacheNodeType: 'cache.t4g.micro',
      numCacheClusters: 1,
      automaticFailoverEnabled: false,
      transitEncryptionEnabled: false,
      securityGroupIds: [this.redisSecurityGroup.securityGroupId],
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
    });
    this.redis.addDependency(redisSubnetGroup);

    // Allow access from private subnets (where ECS tasks run)
    this.dbSecurityGroup.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(5432), 'VPC to Aurora');
    this.redisSecurityGroup.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(6379), 'VPC to Valkey');

    new cdk.CfnOutput(this, 'DbEndpoint', { value: this.cluster.clusterEndpoint.hostname });
    new cdk.CfnOutput(this, 'RedisEndpoint', { value: this.redis.attrPrimaryEndPointAddress });
  }
}
