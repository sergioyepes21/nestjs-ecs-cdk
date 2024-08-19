import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  ApplicationLoadBalancer,
  ApplicationListener,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster } from 'aws-cdk-lib/aws-ecs';

export class ECSStack extends cdk.Stack {
  public readonly resourceIdPrefix: string = 'NestJSECS';

  private readonly vpc: Vpc;

  public readonly cluster: Cluster;

  public readonly applicationLoadBalancer: ApplicationLoadBalancer;

  public readonly albListener: ApplicationListener;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = this.createVpc();

    this.cluster = this.createCluster();

    this.applicationLoadBalancer = this.createApplicationLoadBalancer();

    this.albListener = this.createALBListener();
  }

  private createResourceId(name: string): string {
    return `${this.resourceIdPrefix}${name}`;
  }

  private createVpc(): Vpc {
    return new Vpc(this, this.createResourceId('Vpc'), {
      maxAzs: 2,
    });
  }

  private createCluster(): Cluster {
    return new Cluster(this, this.createResourceId('Cluster'), {
      clusterName: 'nestjs-ecs-cluster',
      vpc: this.vpc,
    });
  }

  private createApplicationLoadBalancer(): ApplicationLoadBalancer {
    return new ApplicationLoadBalancer(this, this.createResourceId('ALB'), {
      vpc: this.vpc,
      internetFacing: true,
    });
  }

  private createALBListener(): ApplicationListener {
    return this.applicationLoadBalancer.addListener(
      this.createResourceId('ALBListener'),
      {
        port: 80,
        open: true,
      },
    );
  }
}
