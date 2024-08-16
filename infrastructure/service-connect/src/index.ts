import { DescribeServicesCommand, ECSClient } from '@aws-sdk/client-ecs';
import { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda';

export async function handler(
  event: CdkCustomResourceEvent,
): Promise<CdkCustomResourceResponse> {
  console.debug(`event: ${JSON.stringify(event, null, 2)}`);
  switch (event.RequestType) {
    case 'Create':
      return onCreate(event);
    case 'Update':
      return onUpdate(event);
    case 'Delete':
      return onDelete(event);
    default:
      throw new Error(`Unsupported event.`);
  }
}

async function onCreate({
  ResourceProperties: resourceProperties,
}: CdkCustomResourceEvent): Promise<CdkCustomResourceResponse> {
  console.log(
    `creation resource with props: ${JSON.stringify(resourceProperties, null, 2)}`,
  );
  const clusterName = resourceProperties.clusterName;
  const serviceName = resourceProperties.serviceName;

  const discoveryName = resourceProperties.discoveryName;

  const discoveryArn = await queryServiceArn(
    clusterName,
    serviceName,
    discoveryName,
  );

  const data: Record<string, string> = {
    serviceArn: discoveryArn,
  };

  return {
    PhysicalResourceId: serviceName,
    Data: data,
  };
}

async function onUpdate(
  event: CdkCustomResourceEvent,
): Promise<CdkCustomResourceResponse> {
  const { ResourceProperties: resourceProperties } = event;
  console.log(
    `update resource with props: ${JSON.stringify(resourceProperties, null, 2)}`,
  );
  const physicalResourceId = (event as unknown as Record<string, string>)[
    'PhysicalResourceId'
  ];

  const { clusterName, serviceName, discoveryName } = resourceProperties;

  const discoveryArn = await queryServiceArn(
    clusterName,
    serviceName,
    discoveryName,
  );

  const data: Record<string, string> = {
    serviceArn: discoveryArn,
  };

  return {
    PhysicalResourceId: physicalResourceId,
    Data: data,
  };
}

async function onDelete(
  event: CdkCustomResourceEvent,
): Promise<CdkCustomResourceResponse> {
  const physicalResourceId = (event as unknown as Record<string, string>)
    .PhysicalResourceId;

  console.log(`delete resource ${physicalResourceId}`);

  return {};
}

async function queryServiceArn(
  clusterName: string,
  serviceName: string,
  discoveryName: string,
): Promise<string> {
  const client = new ECSClient({});
  const { services } = await client.send(
    new DescribeServicesCommand({
      services: [serviceName],
      cluster: clusterName,
    }),
  );

  if (!services || services.length === 0) {
    throw new Error(
      `Service ${serviceName} not found in cluster ${clusterName}`,
    );
  }

  const service = services[0];

  if (!service.deployments || service.deployments.length === 0) {
    throw new Error(`Service ${serviceName} has no deployments`);
  }

  const deployment = service.deployments[0];

  const serviceConnectResources = deployment.serviceConnectResources;

  if (!serviceConnectResources) {
    throw new Error(`Service ${serviceName} has no service connect resources`);
  }

  const resource = serviceConnectResources.find(
    (resource) => resource.discoveryName === discoveryName,
  );

  return resource?.discoveryArn ?? '';
}
