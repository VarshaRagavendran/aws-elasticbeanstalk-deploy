import * as core from '@actions/core';
import {
  DescribeEnvironmentsCommand,
  DescribeEventsCommand,
  waitUntilEnvironmentUpdated,
} from '@aws-sdk/client-elastic-beanstalk';
import { AWSClients } from './aws-clients';

/**
 * Fetch recent environment events for debugging
 */
async function describeRecentEvents(
  clients: AWSClients,
  applicationName: string,
  environmentName: string
): Promise<void> {
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
      response.Events.forEach((event) => {
        const timestamp = event.EventDate?.toISOString() || 'Unknown time';
        const severity = event.Severity || 'INFO';
        const message = event.Message || 'No message';

        if (severity === 'ERROR' || severity === 'FATAL') {
          core.error(`  [${timestamp}] ${severity}: ${message}`);
        } else if (severity === 'WARN') {
          core.warning(`  [${timestamp}] ${severity}: ${message}`);
        } else {
          core.info(`  [${timestamp}] ${severity}: ${message}`);
        }
      });
    } else {
      core.info('No recent events found');
    }
  } catch (error) {
    core.debug(`Failed to fetch events: ${error}`);
  }
}

/**
 * Check for fatal or error events in recent environment events
 * Returns true if fatal/error events are found, false otherwise
 */
async function checkForFatalOrErrorEvents(
  clients: AWSClients,
  applicationName: string,
  environmentName: string
): Promise<{ hasError: boolean; errorMessage?: string }> {
  try {
    const command = new DescribeEventsCommand({
      ApplicationName: applicationName,
      EnvironmentName: environmentName,
      MaxRecords: 10,
    });

    const response = await clients.getElasticBeanstalkClient().send(command);

    if (response.Events && response.Events.length > 0) {
      // Check for FATAL or ERROR severity events
      const fatalOrErrorEvents = response.Events.filter(
        (event) => event.Severity === 'ERROR' || event.Severity === 'FATAL'
      );

      if (fatalOrErrorEvents.length > 0) {
        // Get the most recent fatal/error event message
        const mostRecentError = fatalOrErrorEvents[0];
        const errorMessage = mostRecentError.Message || 'Unknown error occurred';
        return { hasError: true, errorMessage };
      }
    }
    return { hasError: false };
  } catch (error) {
    // If we can't fetch events, don't fail the deployment check
    // Just log and continue
    core.debug(`Failed to check for error events: ${error}`);
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
  timeout: number
): Promise<void> {
  core.info('⏳ Waiting for deployment to complete...');

  const startTime = Date.now();
  const maxWait = timeout * 1000;

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

      core.info(`Current status: ${status}`);
    }

    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
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
        const eventCheck = await checkForFatalOrErrorEvents(
          clients,
          applicationName,
          environmentName
        );

        if (eventCheck.hasError) {
          // Fetch and display recent events to help diagnose the issue
          await describeRecentEvents(clients, applicationName, environmentName);
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

      core.info(`Current status: ${status}, health: ${health}`);
    }

    // Wait 15 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 15000));
  }

  // Timeout occurred - fetch events to help diagnose
  await describeRecentEvents(clients, applicationName, environmentName);
  throw new Error(`Environment health check timed out after ${timeout}s`);
}
