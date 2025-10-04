
import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to support custom activityType
declare global {
  namespace Express {
    interface Request {
      activityType?: string;
    }
  }
}
import { analyticsService } from '../analyticsService';

export function activityTracker() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Allow custom activity type via req.activityType
    function resolveActivityType() {
      if (req.activityType && typeof req.activityType === 'string') {
        return req.activityType;
      }
      // Use originalUrl for better matching
      return getActivityType(req.method, req.route?.path || req.originalUrl || req.path);
    }

    res.on('finish', () => {
      // Only track authenticated user activities and successful responses
      if (req.user?.claims?.sub && res.statusCode < 400) {
        const duration = Date.now() - startTime;
        const activityType = resolveActivityType();

        if (activityType) {
          // Collect richer metadata
          const metadata: Record<string, any> = {
            path: req.originalUrl || req.path,
            method: req.method,
            duration,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            statusCode: res.statusCode,
            query: req.query,
            params: req.params,
          };
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            metadata.body = req.body;
          }
          // Non-blocking tracking
          Promise.resolve(
            analyticsService.trackUserActivity(req.user.claims.sub, activityType, metadata)
          ).catch(error => {
            console.warn('Failed to track user activity:', {
              error,
              user: req.user?.claims?.sub,
              activityType,
              metadata
            });
          });
        }
      }
    });

    next();
  };
}

function getActivityType(method: string, path: string): string | null {
  const route = `${method} ${path}`;
  // Map routes to activity types (extensible)
  const activityMap: Record<string, string> = {
    'GET /api/proposals': 'view_proposals',
    'POST /api/proposals': 'create_proposal',
    'POST /api/votes': 'cast_vote',
    'GET /api/vault': 'view_vault',
    'POST /api/vault/deposit': 'vault_deposit',
    'POST /api/vault/withdraw': 'vault_withdraw',
    'GET /api/tasks': 'view_tasks',
    'POST /api/tasks': 'create_task',
    'POST /api/tasks/:id/claim': 'claim_task',
    'GET /api/analytics': 'view_analytics',
    'POST /api/wallet/transactions': 'wallet_transaction',
    // Add more mappings as needed
  };

  // Exact match
  if (activityMap[route]) {
    return activityMap[route];
  }

  // Pattern match (support :param extraction)
  for (const [pattern, activity] of Object.entries(activityMap)) {
    if (matchesPattern(route, pattern)) {
      return activity;
    }
  }

  // Fallback: allow custom annotation via req.activityType
  return null;
}

function matchesPattern(route: string, pattern: string): boolean {
  // Enhanced pattern matching for :param parameters
  const patternRegex = pattern.replace(/:[^/]+/g, '[^/]+');
  return new RegExp(`^${patternRegex}$`).test(route);
}
