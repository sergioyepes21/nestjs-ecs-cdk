import { Duration, Size, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ALBFargateServiceProps } from './alb-fargate-service-props';
import {
  AwsLogDriverMode,
  Cluster,
  ContainerDefinition,
  ContainerImage,
  CpuArchitecture,
  FargateService,
  FargateTaskDefinition,
  LogDrivers,
  OperatingSystemFamily,
  Protocol,
  TaskDefinition,
} from 'aws-cdk-lib/aws-ecs';
import { ApplicationListener } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

export class ALBFargateServiceStack extends Stack {
  private readonly cluster: Cluster;

  private readonly listener: ApplicationListener;

  private readonly resourceIdPrefix: string;

  private readonly taskDefinition: TaskDefinition;

  private readonly container: ContainerDefinition;

  private readonly service: FargateService;

  constructor(
    scope: Construct,
    id: string,
    props: ALBFargateServiceProps,
  ) {
    super(scope, id, props);

    this.cluster = props.cluster;
    this.listener = props.listener;
    this.resourceIdPrefix = props.resourceIdPrefix;

    this.taskDefinition = this.createTaskDefinition();
    this.container = this.createContainerDefinition();

    this.service = this.createFargateService();

    this.addTargetsToListener();
  }

  private createResourceId(name: string): string {
    return `${this.resourceIdPrefix}${name}`;
  }

  private createTaskDefinition(): FargateTaskDefinition {
    return new FargateTaskDefinition(
      this,
      this.createResourceId('FargateTask'),
      {
        family: 'nestjs-ecs-task-definition',
        memoryLimitMiB: 512,
        cpu: 256,
        runtimePlatform: {
          operatingSystemFamily: OperatingSystemFamily.LINUX,
          cpuArchitecture: CpuArchitecture.ARM64,
        },
      },
    );
  }

  private createContainerDefinition(): ContainerDefinition {
    const repositoryArn = process.env.ECR_REPOSITORY_ARN!;
    const backendRepository = Repository.fromRepositoryArn(
      this,
      'BackendImageRepository',
      repositoryArn,
    );
    const backendImageRepository = ContainerImage.fromEcrRepository(
      backendRepository,
      'latest',
    );

    return this.taskDefinition.addContainer(
      this.createResourceId('FargateContainer'),
      {
        containerName: 'nestjs-ecs-container',
        image: backendImageRepository,
        portMappings: [
          {
            containerPort: 3001,
            protocol: Protocol.TCP,
          },
        ],
        cpu: 256,
        memoryLimitMiB: 512,
        logging: LogDrivers.awsLogs({
          streamPrefix: 'nestjs-ecs-container',
          mode: AwsLogDriverMode.NON_BLOCKING,
          maxBufferSize: Size.mebibytes(25),
          logRetention: RetentionDays.ONE_DAY,
        }),
      },
    );
  }

  private createFargateService(): FargateService {
    return new FargateService(this, this.createResourceId('FargateService'), {
      serviceName: 'nestjs-ecs-service',
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
    });
  }

  private addTargetsToListener(): void {
    this.listener.addTargets(this.createResourceId('ALBTarget'), {
      port: 80,
      targets: [
        this.service.loadBalancerTarget({
          containerName: 'nestjs-ecs-container',
          containerPort: 3001,
        }),
      ],
      healthCheck: {
        interval: Duration.seconds(10),
        path: '/',
        timeout: Duration.seconds(5),
      },
      deregistrationDelay: Duration.seconds(10),
    });
  }
}
