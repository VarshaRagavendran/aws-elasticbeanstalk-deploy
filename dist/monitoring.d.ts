import { AWSClients } from './aws-clients';
/**
 * Wait for deployment to complete
 */
export declare function waitForDeploymentCompletion(clients: AWSClients, applicationName: string, environmentName: string, timeout: number, deploymentActionType?: 'create' | 'update'): Promise<void>;
/**
 * Wait for environment health to recover
 */
export declare function waitForHealthRecovery(clients: AWSClients, applicationName: string, environmentName: string, timeout: number): Promise<void>;
