
import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../analyticsService';

export function activityTracker() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', async () => {
      // Only track authenticated user activities
      if (req.user?.claims?.sub && res.statusCode < 400) {
        const duration = Date.now() - startTime;
        
        // Determine activity type based on route and method
        const activityType = getActivityType(req.method, req.route?.path || req.path);
        
        if (activityType) {
          try {
            await analyticsService.trackUserActivity(req.user.claims.sub, activityType, {
              path: req.path,
              method: req.method,
              duration,
              userAgent: req.get('User-Agent'),
              ip: req.ip
            });
          } catch (error) {
            console.warn('Failed to track user activity:', error);
          }
        }
      }
    });

    next();
  };
}

function getActivityType(method: string, path: string): string | null {
  const route = `${method} ${path}`;
  
  // Map routes to activity types
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
    'POST /api/wallet/transactions': 'wallet_transaction'
  };

  // Check for exact matches first
  if (activityMap[route]) {
    return activityMap[route];
  }

  // Check for pattern matches
  for (const [pattern, activity] of Object.entries(activityMap)) {
    if (matchesPattern(route, pattern)) {
      return activity;
    }
  }

  return null;
}

function matchesPattern(route: string, pattern: string): boolean {
  // Simple pattern matching for :id parameters
  const patternRegex = pattern.replace(/:id/g, '[^/]+');
  return new RegExp(`^${patternRegex}$`).test(route);
}
