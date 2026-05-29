import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface AgentCoreStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.IVpc;
}

/**
 * Provisions AWS Bedrock AgentCore resources:
 * - Gateway endpoint for MCP tool routing
 * - Runtime for serverless agent deployment
 * - Memory namespace for session/long-term memory
 * - Identity workload for tool credential management
 * - Observability configuration for OTEL tracing
 */
export class AgentCoreStack extends cdk.Stack {
  public readonly gatewayEndpoint: string;
  public readonly runtimeEndpoint: string;
  public readonly agentCoreRole: iam.IRole;

  constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);

    // IAM Role for AgentCore services
    this.agentCoreRole = new iam.Role(this, 'AgentCoreRole', {
      roleName: `${props.projectName}-${props.environment}-agentcore`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('bedrock.amazonaws.com'),
        new iam.ServicePrincipal('lambda.amazonaws.com'),
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
      ],
    });

    // AgentCore Gateway - provisions via Custom Resource or CloudFormation
    // Using CfnResource for AgentCore Gateway (as CDK L2 constructs may not yet exist)
    const gateway = new cdk.CfnResource(this, 'AgentCoreGateway', {
      type: 'AWS::Bedrock::AgentCoreGateway',
      properties: {
        Name: `${props.projectName}-gateway-${props.environment}`,
        Description: 'AgentArms MCP Gateway - routes tool calls to registered MCP servers',
        AuthorizationConfig: {
          Type: 'IAM',
        },
      },
    });

    // AgentCore Runtime configuration
    const runtime = new cdk.CfnResource(this, 'AgentCoreRuntime', {
      type: 'AWS::Bedrock::AgentCoreRuntime',
      properties: {
        AgentRuntimeName: `${props.projectName}-runtime-${props.environment}`,
        Description: 'AgentArms Runtime - hosts MCP server containers',
        NetworkMode: 'PUBLIC',
        RoleArn: this.agentCoreRole.roleArn,
      },
    });

    // AgentCore Memory namespace
    const memory = new cdk.CfnResource(this, 'AgentCoreMemory', {
      type: 'AWS::Bedrock::AgentCoreMemory',
      properties: {
        Name: `${props.projectName}-memory-${props.environment}`,
        Namespace: props.projectName,
        MemoryStrategies: [
          { StrategyType: 'semantic' },
          { StrategyType: 'summarization' },
        ],
      },
    });

    // AgentCore Identity - Workload Identity
    const identity = new cdk.CfnResource(this, 'AgentCoreIdentity', {
      type: 'AWS::Bedrock::AgentCoreWorkloadIdentity',
      properties: {
        Name: `${props.projectName}-identity-${props.environment}`,
        Description: 'AgentArms workload identity for tool authentication',
      },
    });

    // Outputs
    this.gatewayEndpoint = gateway.getAtt('Endpoint').toString();
    this.runtimeEndpoint = runtime.getAtt('Endpoint').toString();

    new cdk.CfnOutput(this, 'GatewayEndpoint', {
      value: this.gatewayEndpoint,
      exportName: `${props.projectName}-${props.environment}-gateway-endpoint`,
    });

    new cdk.CfnOutput(this, 'RuntimeEndpoint', {
      value: this.runtimeEndpoint,
      exportName: `${props.projectName}-${props.environment}-runtime-endpoint`,
    });

    new cdk.CfnOutput(this, 'MemoryId', {
      value: memory.getAtt('MemoryId').toString(),
    });

    new cdk.CfnOutput(this, 'WorkloadIdentityId', {
      value: identity.getAtt('WorkloadIdentityId').toString(),
    });
  }
}
