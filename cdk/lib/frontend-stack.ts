import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  backendService: ecs.IBaseService;
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
          BACKEND_INTERNAL_URL: 'http://backend.local:8000',
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
    const distribution = new cloudfront.Distribution(this, 'CDN', {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(fargateService.loadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
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
