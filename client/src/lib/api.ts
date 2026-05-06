/**
 * @deprecated Use authClient from '@/utils/authClient' instead
 * 
 * This module is deprecated and maintained only for backward compatibility.
 * All new code should use authClient instead, which provides:
 * - Secure httpOnly cookie-based authentication
 * - Automatic token refresh on 401
 * - CSRF protection
 * - Single-flight refresh lock
 * 
 * Migration guide: Replace apiGet/apiPost/etc with authClient.get/post/etc
 */

import { authClient } from '@/utils/authClient';

// Generic API request function
export async function apiRequest(path: string, options?: RequestInit) {
  const method = (options?.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  const body = options?.body ? JSON.parse(options.body as string) : undefined;
  
  switch (method) {
    case 'GET':
      return authClient.get(path);
    case 'POST':
      return authClient.post(path, body);
    case 'PUT':
      return authClient.put(path, body);
    case 'PATCH':
      return authClient.patch(path, body);
    case 'DELETE':
      return authClient.delete(path);
    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

export async function apiGet<T = any>(path: string): Promise<T> {
  return authClient.get<T>(path);
}

export async function apiPost<T = any>(path: string, body: any): Promise<T> {
  return authClient.post<T>(path, body);
}

export async function apiPut<T = any>(path: string, body: any): Promise<T> {
  return authClient.put<T>(path, body);
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  return authClient.delete<T>(path);
}