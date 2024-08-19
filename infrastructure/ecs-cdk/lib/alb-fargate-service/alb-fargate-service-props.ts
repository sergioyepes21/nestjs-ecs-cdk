import { ApplicationListener } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import { StackProps } from 'aws-cdk-lib';

export interface ALBFargateServiceProps extends StackProps {
  cluster: Cluster;
  listener: ApplicationListener;
  resourceIdPrefix: string;
}
