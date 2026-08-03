export const NOTIFICATION_API_BASE = '/api/notifications';

export function buildNotificationEndpoint(path: string) {
  return `${NOTIFICATION_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export const NOTIFICATION_PREFERENCES_ENDPOINT = `${NOTIFICATION_API_BASE}/preferences`;
export const NOTIFICATION_SEARCH_ENDPOINT = `${NOTIFICATION_API_BASE}/search`;
