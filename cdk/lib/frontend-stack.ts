import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  backendService: ecs.IBaseService;
  backendUrl: string;
  backendLoadBalancer: elbv2.IApplicationLoadBalancer;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const cluster = ecs.Cluster.fromClusterAttributes(this, 'Cluster', {
      clusterName: `${props.projectName}-${props.environment}`,
      vpc: props.backendService.cluster.vpc,
      securityGroups: [],
    });

    const frontendImage = new ecr_assets.DockerImageAsset(this, 'FrontendImage', {
      directory: path.resolve(__dirname, '../../frontend'),
    });

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'FrontendService', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromDockerImageAsset(frontendImage),
        containerPort: 3000,
        environment: {
          BACKEND_INTERNAL_URL: `http://${props.backendUrl}`,
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'frontend',
          logRetention: logs.RetentionDays.ONE_WEEK,
        }),
      },
      desiredCount: 2,
      cpu: 256,
      memoryLimitMiB: 512,
      publicLoadBalancer: true,
    });

    fargateService.targetGroup.configureHealthCheck({
      path: '/',
      healthyHttpCodes: '200,301,302,307',
    });

    // CloudFront distribution for caching and global delivery
    const backendOrigin = new origins.LoadBalancerV2Origin(props.backendLoadBalancer, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      // WebSocket (tunnel) connections must be able to stay open; keep the
      // read timeout at the CloudFront maximum so long-lived requests survive.
      readTimeout: cdk.Duration.seconds(60),
      keepaliveTimeout: cdk.Duration.seconds(60),
    });

    // Backend paths must bypass caching and forward all headers/query/cookies
    // (required for auth headers, MCP session ids, and WebSocket upgrades).
    const backendBehavior: cloudfront.BehaviorOptions = {
      origin: backendOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
    };

    const distribution = new cloudfront.Distribution(this, 'CDN', {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(fargateService.loadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
      additionalBehaviors: {
        '/_next/static/*': {
          origin: new origins.LoadBalancerV2Origin(fargateService.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        // Backend API + gateway + tunnel (WebSocket) + es-proxy → backend ALB.
        '/api/*': backendBehavior,
        '/gateway/*': backendBehavior,
        '/tunnel/*': backendBehavior,
        '/es-proxy/*': backendBehavior,
        '/health': backendBehavior,
        '/docs': backendBehavior,
        '/openapi.json': backendBehavior,
      },
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
    });
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
    });
  }
}
