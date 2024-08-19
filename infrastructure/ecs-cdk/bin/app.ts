#!/usr/bin/env node
import 'dotenv/config';
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ALBFargateServiceStack, ECSStack } from '../lib';

const app = new cdk.App();

const stack = new ECSStack(app, 'NestJSECSStack');

const backendContainerPort = Number(process.env.BACKEND_CONTAINER_PORT) ?? 3001;

new ALBFargateServiceStack(stack, 'NestJSECSALBStack', {
  cluster: stack.cluster,
  listener: stack.albListener,
  containerPort: backendContainerPort,
  resourceIdPrefix: stack.resourceIdPrefix,
});
