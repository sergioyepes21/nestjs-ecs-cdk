import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsp from 'aws-cdk-lib/aws-ecs-patterns';
import {
  ApiGatewayLoadBalancedFargateService,
  VpcLinkIntegration,
} from './agw-balanced-fargate-service';

export class ECSStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'NestJSECSVpc', {
      natGateways: 1,
    });

    const cluster = new ecs.Cluster(this, 'NestJSECSCluster', {
      clusterName: 'nestjs-ecs-cluster',
      vpc,
      enableFargateCapacityProviders: true,
    });

    cluster.addDefaultCapacityProviderStrategy([
      { capacityProvider: 'FARGATE', base: 1, weight: 1 },
    ]);

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      'NestJSECSFargateTask',
      {
        family: 'nestjs-ecs-task-definition',
        memoryLimitMiB: 512,
        cpu: 256,
      },
    );

    const containerRepository = new ecr.Repository(
      this,
      'NestJSBackendECRRepository',
      {
        repositoryName: 'nestjs-backend-repository',
      },
    );

    taskDefinition.addContainer('NestJSECSFargateContainer', {
      image: ecs.ContainerImage.fromEcrRepository(
        containerRepository,
        'latest',
      ),
      portMappings: [{ containerPort: 3001, name: 'default' }],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3001'],
        interval: cdk.Duration.seconds(60),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
        timeout: cdk.Duration.seconds(5),
      },
    });

    new ApiGatewayLoadBalancedFargateService(this, 'NestJSECSFargateService', {
      vpc,
      cluster,
      taskDefinition,
      desiredCount: 1,
      vpcLinkIntegration: VpcLinkIntegration.CLOUDMAP,
    });
  }
}
