import * as yukiApi from '../api/yukiApi';

export interface DeployResult {
  success: boolean;
  executionId?: string | null;
  data?: any;
  error?: string;
}

export async function deployCompiledStrategy(compiled: any, deploymentConfig?: any): Promise<any> {
  try {
    const res = await yukiApi.deployCompiledStrategy(compiled, deploymentConfig);
    return res?.data ?? res;
  } catch (err) {
    throw err;
  }
}

export async function deployStrategyById(id: string): Promise<any> {
  try {
    const res = await yukiApi.deployStrategy(id);
    return res?.data ?? res;
  } catch (err) {
    throw err;
  }
}
