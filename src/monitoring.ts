import * as core from '@actions/core';
import {
  DescribeEnvironmentsCommand,
  DescribeEventsCommand,
  waitUntilEnvironmentUpdated,
} from '@aws-sdk/client-elastic-beanstalk';
import { AWSClients } from './aws-clients';

/**
 * Fetch recent environment events for debugging and check for fatal/error events
 * Returns error information if fatal/error events are found
 */
async function describeRecentEvents(
  clients: AWSClients,
  applicationName: string,
  environmentName: string
): Promise<{ hasError: boolean; errorMessage?: string }> {
  try {
    core.info('🔍 Fetching most recent events...');

    const command = new DescribeEventsCommand({
      ApplicationName: applicationName,
      EnvironmentName: environmentName,
      MaxRecords: 10,
    });

    const response = await clients.getElasticBeanstalkClient().send(command);

    if (response.Events && response.Events.length > 0) {
      core.info('📋 Recent events:');
      
      // Track fatal/error events while displaying all events
      const fatalOrErrorEvents: Array<{ message: string }> = [];
      
      response.Events.forEach((event) => {
        const timestamp = event.EventDate?.toISOString() || 'Unknown time';
        const severity = event.Severity || 'INFO';
        const message = event.Message || 'No message';

        if (severity === 'ERROR' || severity === 'FATAL') {
          core.error(`  [${timestamp}] ${severity}: ${message}`);
          fatalOrErrorEvents.push({ message });
        } else if (severity === 'WARN') {
          core.warning(`  [${timestamp}] ${severity}: ${message}`);
        } else {
          core.info(`  [${timestamp}] ${severity}: ${message}`);
        }
      });

      // Return error information if fatal/error events were found
      if (fatalOrErrorEvents.length > 0) {
        const errorMessage = fatalOrErrorEvents[0].message || 'Unknown error occurred';
        return { hasError: true, errorMessage };
      }
    } else {
      core.info('No recent events found');
    }
    
    return { hasError: false };
  } catch (error) {
    // If we can't fetch events, don't fail the deployment check
    // Just log and continue
    core.debug(`Failed to fetch events: ${error}`);
    return { hasError: false };
  }
}

/**
 * Wait for deployment to complete
 */
export async function waitForDeploymentCompletion(
  clients: AWSClients,
  applicationName: string,
  environmentName: string,
  timeout: number,
  deploymentActionType?: 'create' | 'update'
): Promise<void> {
  core.info('⏳ Waiting for deployment to complete...');

  const startTime = Date.now();
  const maxWait = timeout * 1000;
  let previousStatus: string | undefined;
  
  // Poll every 20 seconds for create, 10 seconds for update
  const pollInterval = deploymentActionType === 'create' ? 20000 : 10000;

  while (Date.now() - startTime < maxWait) {
    const command = new DescribeEnvironmentsCommand({
      ApplicationName: applicationName,
      EnvironmentNames: [environmentName],
    });

    const response = await clients.getElasticBeanstalkClient().send(command);

    if (response.Environments && response.Environments.length > 0) {
      const env = response.Environments[0];
      const status = env.Status;

      if (status === 'Ready') {
        core.info('✅ Deployment complete');
        return;
      }

      // Check for fatal/error events during deployment
      // This prevents getting stuck when errors occur during deployment
      const eventCheck = await describeRecentEvents(
        clients,
        applicationName,
        environmentName
      );

      if (eventCheck.hasError) {
        throw new Error(
          `Environment deployment failed - fatal or error event detected: ${eventCheck.errorMessage}`
        );
      }

      // Only log when status changes
      if (status !== previousStatus) {
        core.info(`Current status: ${status}`);
        previousStatus = status;
      }
    }

    // Wait based on deployment action type
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // Timeout occurred - fetch events to help diagnose
  await describeRecentEvents(clients, applicationName, environmentName);
  throw new Error(`Deployment timed out after ${timeout}s`);
}

/**
 * Wait for environment health to recover
 */
export async function waitForHealthRecovery(
  clients: AWSClients,
  applicationName: string,
  environmentName: string,
  timeout: number
): Promise<void> {
  core.info('🏥 Waiting for environment health to recover...');

  const startTime = Date.now();
  const maxWait = timeout * 1000;
  let previousStatus: string | undefined;
  let previousHealth: string | undefined;

  while (Date.now() - startTime < maxWait) {
    const command = new DescribeEnvironmentsCommand({
      ApplicationName: applicationName,
      EnvironmentNames: [environmentName],
    });

    const response = await clients.getElasticBeanstalkClient().send(command);

    if (response.Environments && response.Environments.length > 0) {
      const env = response.Environments[0];
      const health = env.Health;
      const status = env.Status;

      // Only check for fatal/error events when health is Grey
      // This prevents getting stuck when errors occur during deployment
      // before health status changes to Red
      if (health === 'Grey' || health === undefined) {
        const eventCheck = await describeRecentEvents(
          clients,
          applicationName,
          environmentName
        );

        if (eventCheck.hasError) {
          throw new Error(
            `Environment deployment failed - fatal or error event detected: ${eventCheck.errorMessage}`
          );
        }
      }

      if (health === 'Green' || health === 'Yellow') {
        core.info('✅ Environment is healthy!');
        return;
      }

      if (health === 'Red' && status === 'Ready') {
        // Fetch recent events to help diagnose the issue
        await describeRecentEvents(clients, applicationName, environmentName);
        throw new Error('Environment deployment failed - health is Red');
      }

      // Only log when status or health changes
      if (status !== previousStatus || health !== previousHealth) {
        core.info(`Current status: ${status}, health: ${health}`);
        previousStatus = status;
        previousHealth = health;
      }
    }

    // Wait 15 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 15000));
  }

  // Timeout occurred - fetch events to help diagnose
  await describeRecentEvents(clients, applicationName, environmentName);
  throw new Error(`Environment health check timed out after ${timeout}s`);
}
