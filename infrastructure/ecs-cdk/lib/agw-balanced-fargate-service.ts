import * as path from 'path';
import * as apigw from '@aws-cdk/aws-apigatewayv2-alpha';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  CustomResource,
  aws_ecs as ecs,
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_servicediscovery as sd,
  custom_resources as cr,
  CfnOutput,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * The vpc link integration type for the API Gateway private integration through the VPC Link.
 */
export enum VpcLinkIntegration {
  CLOUDMAP = 'CLOUDMAP',
  NLB = 'NLB',
  ALB = 'ALB',
}

export interface ApiGatewayLoadBalancedFargateServiceProps {
  readonly taskDefinition: ecs.TaskDefinition;
  readonly vpc: ec2.IVpc;
  readonly vpcSubnets?: ec2.SubnetSelection;
  readonly cluster: ecs.ICluster;
  readonly desiredCount?: number;

  /**
   * The discovery name of the cloud map service
   * @default 'default'
   */
  readonly discoveryName?: string;

  /**
   * The vpc link integration type for the API Gateway private integration
   *
   * @default VpcLinkIntegration.CLOUDMAP;
   */
  readonly vpcLinkIntegration?: VpcLinkIntegration;

  readonly capacityProviderStrategies?: ecs.CapacityProviderStrategy[];
}

export class CloudMapIntegration extends apigw.HttpRouteIntegration {
  private readonly cloudMapServiceArn: string;
  private readonly vpcLinkId: string;
  constructor(cloudMapServiceArn: string, vpcLinkId: string, name?: string) {
    super(name ?? 'CloudMapIntegration');
    this.cloudMapServiceArn = cloudMapServiceArn;
    this.vpcLinkId = vpcLinkId;
  }
  public bind(
    _: apigw.HttpRouteIntegrationBindOptions,
  ): apigw.HttpRouteIntegrationConfig {
    return {
      type: apigw.HttpIntegrationType.HTTP_PROXY,
      connectionId: this.vpcLinkId,
      connectionType: apigw.HttpConnectionType.VPC_LINK,
      payloadFormatVersion: apigw.PayloadFormatVersion.VERSION_1_0,
      uri: this.cloudMapServiceArn,
      method: apigw.HttpMethod.ANY,
    };
  }
}

export class ApiGatewayLoadBalancedFargateService extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: ApiGatewayLoadBalancedFargateServiceProps,
  ) {
    super(scope, id);

    const defaultCapacityProviderStrategy: ecs.CapacityProviderStrategy[] = [
      { capacityProvider: 'FARGATE', base: 1, weight: 50 },
    ];

    const service = new ecs.FargateService(this, 'NestJSECSFargateService', {
      serviceConnectConfiguration: {
        namespace: props.cluster.defaultCloudMapNamespace
          ? undefined
          : this.createCloudMapNamespace(id).namespaceArn,
        services: [
          {
            portMappingName: props.discoveryName ?? 'default',
          },
        ],
      },
      taskDefinition: props.taskDefinition,
      cluster: props.cluster,
      vpcSubnets: props.vpcSubnets,
      desiredCount: props.desiredCount,
      capacityProviderStrategies:
        props.capacityProviderStrategies ?? defaultCapacityProviderStrategy,
    });

    // we need look up cloudmapServiceArn with custom resource
    const onEventHandler = new lambdaNodejs.NodejsFunction(
      this,
      'NestJSCloudMapOnEventHandler',
      {
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(__dirname, '../../service-connect/dist/index.js'),
      },
    );

    const provider = new cr.Provider(
      this,
      'NestJSServiceConnectHandlerProvider',
      {
        onEventHandler,
      },
    );

    onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecs:DescribeServices'],
        resources: [service.serviceArn],
      }),
    );

    const serviceConnectHandler = new CustomResource(
      this,
      'NestJSServiceConnectHandler',
      {
        serviceToken: provider.serviceToken,
        resourceType: 'Custom::ServiceConnectHandler',
        properties: {
          clusterName: props.cluster.clusterName,
          serviceName: service.serviceName,
          discoveryName: props.discoveryName ?? 'default',
        },
      },
    );

    const cloudmapServiceArn = serviceConnectHandler.getAttString('serviceArn');

    const vpcLink = new apigw.VpcLink(this, 'VpcLink', {
      vpc: props.vpc,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    service.connections.allowFrom(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(80),
    );

    service.connections.allowFrom(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(3001),
    );

    const api = new apigw.HttpApi(this, 'NestJSECSHttpApi', {
      defaultIntegration: new CloudMapIntegration(
        cloudmapServiceArn,
        vpcLink.vpcLinkId,
      ),
    });

    new CfnOutput(this, 'NestJSECSApiEndpoint', { value: api.apiEndpoint });
  }
  private createCloudMapNamespace(id: string): sd.INamespace {
    return new sd.HttpNamespace(this, `httpNameSpace${id}`, {
      name: `httpNameSpace${id}`,
    });
  }
}
