import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as path from 'path';
import { Construct } from 'constructs';

export interface AgentCoreStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.IVpc;
}

export class AgentCoreStack extends cdk.Stack {
  public readonly gatewayEndpoint: string;
  public readonly runtimeEndpoint: string;
  public readonly agentCoreRole: iam.IRole;

  constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);

    this.agentCoreRole = new iam.Role(this, 'AgentCoreRole', {
      roleName: `${props.projectName}-${props.environment}-agentcore`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('bedrock.amazonaws.com'),
        new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
        new iam.ServicePrincipal('lambda.amazonaws.com'),
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
      ],
    });

    // Memory (created first, so Runtime failure won't cancel it)
    const memory = new cdk.CfnResource(this, 'AgentCoreMemory', {
      type: 'AWS::BedrockAgentCore::Memory',
      properties: {
        Name: `agentarmsMemory${props.environment}`,
        Description: 'AgentArms session and long-term memory',
        EventExpiryDuration: 30,
        MemoryStrategies: [
          {
            SemanticMemoryStrategy: {
              Name: `agentarmsSemantic${props.environment}`,
              Description: 'Semantic memory strategy',
            },
          },
          {
            SummaryMemoryStrategy: {
              Name: `agentarmsSummary${props.environment}`,
              Description: 'Summarization memory strategy',
            },
          },
        ],
      },
    });

    // Gateway
    const gateway = new cdk.CfnResource(this, 'AgentCoreGateway', {
      type: 'AWS::BedrockAgentCore::Gateway',
      properties: {
        Name: `${props.projectName}-gateway-${props.environment}`,
        Description: 'AgentArms MCP Gateway - routes tool calls to registered MCP servers',
        AuthorizerType: 'AWS_IAM',
        ProtocolType: 'MCP',
        RoleArn: this.agentCoreRole.roleArn,
      },
    });

    // Workload Identity
    const identity = new cdk.CfnResource(this, 'AgentCoreIdentity', {
      type: 'AWS::BedrockAgentCore::WorkloadIdentity',
      properties: {
        Name: `${props.projectName}-identity-${props.environment}`,
      },
    });

    // Runtime - depends on Memory + Gateway so they complete first
    const runtimeImage = new ecr_assets.DockerImageAsset(this, 'RuntimeImage', {
      directory: path.resolve(__dirname, '../../backend'),
      platform: ecr_assets.Platform.LINUX_ARM64,
    });

    const runtime = new cdk.CfnResource(this, 'AgentCoreRuntime', {
      type: 'AWS::BedrockAgentCore::Runtime',
      properties: {
        AgentRuntimeName: `agentarms_runtime_${props.environment}`,
        Description: 'AgentArms Runtime - hosts MCP server containers',
        RoleArn: this.agentCoreRole.roleArn,
        AgentRuntimeArtifact: {
          ContainerConfiguration: {
            ContainerUri: runtimeImage.imageUri,
          },
        },
        NetworkConfiguration: {
          NetworkMode: 'PUBLIC',
        },
        ProtocolConfiguration: 'MCP',
      },
    });
    runtime.addDependency(memory);
    runtime.addDependency(gateway);

    this.gatewayEndpoint = gateway.getAtt('GatewayUrl').toString();
    this.runtimeEndpoint = runtime.getAtt('AgentRuntimeId').toString();

    new cdk.CfnOutput(this, 'GatewayEndpoint', {
      value: this.gatewayEndpoint,
      exportName: `${props.projectName}-${props.environment}-gateway-endpoint`,
    });

    new cdk.CfnOutput(this, 'GatewayId', {
      value: gateway.getAtt('GatewayIdentifier').toString(),
    });

    new cdk.CfnOutput(this, 'RuntimeId', {
      value: this.runtimeEndpoint,
      exportName: `${props.projectName}-${props.environment}-runtime-id`,
    });

    new cdk.CfnOutput(this, 'MemoryId', {
      value: memory.getAtt('MemoryId').toString(),
    });

    new cdk.CfnOutput(this, 'WorkloadIdentityArn', {
      value: identity.getAtt('WorkloadIdentityArn').toString(),
    });
  }
}
