/**
 * Dynamic Route Mapper & Tracker
 * Provides defender agent visibility into all registered routes and their security status
 */

import { Express, Router, Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

const logger = new Logger('route-mapper');

/**
 * Route definition with security metadata
 */
export interface MappedRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: string;
  middleware: string[];
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  accessLog: {
    lastAccessed?: Date;
    totalRequests: number;
    lastStatusCode?: number;
    lastError?: string;
  };
  protected: boolean;
  description: string;
  owner?: string; // Which service/module owns this route
}

/**
 * Dynamic route registry for defender agent
 */
export class DynamicRouteMapper {
  private routes = new Map<string, MappedRoute>();
  private routeMetrics = new Map<string, { requests: number; errors: number; avgResponseTime: number }>();

  /**
   * Register a route with security metadata
   */
  registerRoute(route: MappedRoute) {
    const key = `${route.method}:${route.path}`;
    this.routes.set(key, route);
    this.routeMetrics.set(key, { requests: 0, errors: 0, avgResponseTime: 0 });

    logger.debug(`[ROUTE_MAPPER] Route registered`, {
      key,
      riskLevel: route.riskLevel,
      protected: route.protected,
    });
  }

  /**
   * Defender agent: Get all routes
   */
  getAllRoutes(): MappedRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Defender agent: Get high-risk routes
   */
  getHighRiskRoutes(): MappedRoute[] {
    return Array.from(this.routes.values()).filter(r => r.riskLevel === 'critical');
  }

  /**
   * Defender agent: Get unprotected routes
   */
  getUnprotectedRoutes(): MappedRoute[] {
    return Array.from(this.routes.values()).filter(r => !r.protected);
  }

  /**
   * Defender agent: Get routes by owner/service
   */
  getRoutesByOwner(owner: string): MappedRoute[] {
    return Array.from(this.routes.values()).filter(r => r.owner === owner);
  }

  /**
   * Defender agent: Get routes by tag
   */
  getRoutesByTag(tag: string): MappedRoute[] {
    return Array.from(this.routes.values()).filter(r => r.tags.includes(tag));
  }

  /**
   * Get route security audit
   */
  getSecurityAudit(): {
    totalRoutes: number;
    protectedRoutes: number;
    unprotectedRoutes: number;
    criticalRoutes: number;
    highRiskRoutes: number;
    coverage: string; // percentage
    unprotectedHighRiskRoutes: MappedRoute[];
  } {
    const allRoutes = this.getAllRoutes();
    const protected_ = allRoutes.filter(r => r.protected).length;
    const unprotected = allRoutes.filter(r => !r.protected).length;
    const critical = allRoutes.filter(r => r.riskLevel === 'critical').length;
    const highRisk = allRoutes.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length;
    const unprotectedHighRisk = allRoutes.filter(r => !r.protected && (r.riskLevel === 'high' || r.riskLevel === 'critical'));

    return {
      totalRoutes: allRoutes.length,
      protectedRoutes: protected_,
      unprotectedRoutes: unprotected,
      criticalRoutes: critical,
      highRiskRoutes: highRisk,
      coverage: `${((protected_ / allRoutes.length) * 100).toFixed(1)}%`,
      unprotectedHighRiskRoutes: unprotectedHighRisk,
    };
  }

  /**
   * Record route access
   */
  recordAccess(method: string, path: string, statusCode: number, responseTimeMs: number) {
    const key = `${method}:${path}`;
    const route = this.routes.get(key);

    if (route) {
      route.accessLog.lastAccessed = new Date();
      route.accessLog.totalRequests++;
      route.accessLog.lastStatusCode = statusCode;

      if (statusCode >= 400) {
        route.accessLog.lastError = `HTTP ${statusCode}`;
      }

      const metrics = this.routeMetrics.get(key);
      if (metrics) {
        metrics.requests++;
        if (statusCode >= 400) {
          metrics.errors++;
        }

        // Update average response time
        const totalTime = metrics.avgResponseTime * (metrics.requests - 1) + responseTimeMs;
        metrics.avgResponseTime = Math.round(totalTime / metrics.requests);
      }
    }
  }

  /**
   * Get route metrics for defender agent analysis
   */
  getRouteMetrics(method: string, path: string) {
    const key = `${method}:${path}`;
    const route = this.routes.get(key);
    const metrics = this.routeMetrics.get(key);

    if (!route || !metrics) {
      return null;
    }

    return {
      route,
      metrics: {
        requests: metrics.requests,
        errors: metrics.errors,
        errorRate: metrics.requests > 0 ? ((metrics.errors / metrics.requests) * 100).toFixed(2) : '0',
        avgResponseTime: metrics.avgResponseTime,
      },
    };
  }

  /**
   * Get routes that need attention (high error rate, high latency, etc.)
   */
  getProblematicRoutes(): {
    highErrorRate: MappedRoute[];
    slowRoutes: MappedRoute[];
    unmonitoredRoutes: MappedRoute[];
  } {
    const problematic = {
      highErrorRate: [] as MappedRoute[],
      slowRoutes: [] as MappedRoute[],
      unmonitoredRoutes: [] as MappedRoute[],
    };

    for (const [key, route] of this.routes.entries()) {
      const metrics = this.routeMetrics.get(key);
      if (!metrics) continue;

      // High error rate (>10%)
      if (metrics.requests > 10 && (metrics.errors / metrics.requests) * 100 > 10) {
        problematic.highErrorRate.push(route);
      }

      // Slow routes (>1000ms average)
      if (metrics.avgResponseTime > 1000) {
        problematic.slowRoutes.push(route);
      }

      // Unmonitored (no requests recorded)
      if (metrics.requests === 0 && route.protected) {
        problematic.unmonitoredRoutes.push(route);
      }
    }

    return problematic;
  }

  /**
   * Export route map for defender agent
   */
  exportRouteMap() {
    return {
      exportedAt: new Date().toISOString(),
      routes: this.getAllRoutes().map(r => ({
        method: r.method,
        path: r.path,
        protected: r.protected,
        riskLevel: r.riskLevel,
        tags: r.tags,
        owner: r.owner,
        description: r.description,
      })),
      summary: this.getSecurityAudit(),
    };
  }
}

/**
 * Global route mapper instance
 */
export const dynamicRouteMapper = new DynamicRouteMapper();

/**
 * Middleware: Automatic route access tracking for defender agent
 */
export function trackRouteAccess(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const method = req.method;
  const path = req.path;

  // Override res.send to track response
  const originalSend = res.send;
  res.send = function(data: any) {
    const responseTime = Date.now() - startTime;
    dynamicRouteMapper.recordAccess(method, path, res.statusCode, responseTime);
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Express plugin: Auto-register routes from app
 * Scans Express app and registers all routes with defender agent
 */
export function registerExpressRoutes(app: Express) {
  const routes: MappedRoute[] = [];

  /**
   * Recursively scan router layers
   */
  function scanRouter(router: any, basePath: string = '') {
    if (!router.stack) return;

    for (const layer of router.stack) {
      if (layer.route) {
        // It's a route
        // Ensure both basePath and route.path are strings (safety check)
        const routePath = typeof layer.route.path === 'string' ? layer.route.path : '';
        const path = (basePath + routePath).replace(/RegExp/g, ''); // Remove any stray RegExp strings
        
        // Skip routes with invalid paths
        if (!path || typeof path !== 'string') {
          continue;
        }
        
        const methods = Object.keys(layer.route.methods) as any[];

        for (const method of methods) {
          routes.push({
            method: method.toUpperCase() as any,
            path,
            handler: layer.route.stack?.[0]?.name || 'anonymous',
            middleware: layer.route.stack?.map((s: any) => s.name || 'middleware') || [],
            tags: extractTags(path),
            riskLevel: assessRiskLevel(path),
            accessLog: {
              totalRequests: 0,
            },
            protected: hasProtectionMiddleware(layer.route.stack),
            description: `${method.toUpperCase()} ${path}`,
            owner: extractOwner(path),
          });
        }
      } else if (layer.name === 'router' && layer.handle.stack) {
        // It's a sub-router
        // Properly extract the path prefix from the router layer
        // layer.regexp is Express's internal regex for matching, e.g., /^\/v1\/?$/i for /v1
        let prefix = '';
        
        // First, try to use the mount path if available
        if (layer.route && typeof layer.route.path === 'string') {
          prefix = layer.route.path;
        } else if (layer.regexp && typeof layer.regexp.source === 'string') {
          // Extract path from regexp source more carefully
          // Express regexes typically look like: /^\/path\/?$/i or /^\/path(?:\/|$)/i
          const regexSource = layer.regexp.source;
          
          // Skip if this looks like a parameter pattern (e.g., for :id matching)
          if (regexSource.includes('(?:') || regexSource.includes('\\d')) {
            // This is likely a parameter pattern, skip it
            prefix = '';
          } else {
            // Remove start anchor, end anchor, and common suffixes
            let path = regexSource
              .replace(/^\^/, '')           // Remove start anchor ^
              .replace(/\$.*$/, '')         // Remove end anchor and beyond
              .replace(/\(\?:\\\\\/\|\$\)$/g, '') // Remove optional trailing slash pattern
              .replace(/\\\/\|\$/, '')      // Remove | pattern
              .replace(/\\\//g, '/');       // Unescape forward slashes
            
            // Clean up any remaining regex metacharacters
            if (path && path !== '/' && !path.includes('RegExp')) {
              prefix = path;
            }
          }
        }
        
        // Ensure prefix is a string (safety check to prevent RegExp objects)
        if (typeof prefix !== 'string') {
          prefix = '';
        }
        
        scanRouter(layer.handle, basePath + prefix);
      }
    }
  }

  function extractTags(path: string): string[] {
    const tags = [];
    if (path.includes('/governance')) tags.push('governance');
    if (path.includes('/treasury')) tags.push('treasury');
    if (path.includes('/disbursements')) tags.push('disbursements');
    if (path.includes('/admin')) tags.push('admin');
    if (path.includes('/user')) tags.push('user');
    if (path.includes('/auth')) tags.push('auth');
    return tags;
  }

  function assessRiskLevel(path: string): 'low' | 'medium' | 'high' | 'critical' {
    if (path.includes('multisig') || path.includes('transfer')) return 'critical';
    if (path.includes('governance') || path.includes('treasury')) return 'high';
    if (path.includes('admin')) return 'high';
    if (path.includes('auth')) return 'medium';
    return 'low';
  }

  function hasProtectionMiddleware(stack: any[]): boolean {
    if (!stack) return false;
    const middlewareNames = stack.map((s: any) => s.name || '');
    return (
      middlewareNames.some(name => name.includes('authentic') || name.includes('token')) ||
      middlewareNames.some(name => name.includes('privilege') || name.includes('auth'))
    );
  }

  function extractOwner(path: string): string {
    if (path.includes('/governance')) return 'governance-service';
    if (path.includes('/treasury')) return 'treasury-service';
    if (path.includes('/disbursements')) return 'disbursements-service';
    if (path.includes('/admin')) return 'admin-service';
    if (path.includes('/user')) return 'user-service';
    return 'core';
  }

  // Scan the app
  scanRouter(app._router);

  // Register all found routes
  for (const route of routes) {
    dynamicRouteMapper.registerRoute(route);
  }

  logger.info(`[ROUTE_MAPPER] Registered ${routes.length} routes from Express app`);

  // Log security audit
  const audit = dynamicRouteMapper.getSecurityAudit();
  logger.info('[ROUTE_MAPPER] Security audit', {
    totalRoutes: audit.totalRoutes,
    protected: audit.protectedRoutes,
    unprotected: audit.unprotectedRoutes,
    criticalRoutes: audit.criticalRoutes,
    coverage: audit.coverage,
  });

  if (audit.unprotectedHighRiskRoutes.length > 0) {
    logger.warn('[ROUTE_MAPPER] Unprotected high-risk routes found!', {
      routes: audit.unprotectedHighRiskRoutes.map(r => `${r.method} ${r.path}`),
    });
  }
}

/**
 * Defender agent: Get route statistics
 */
export function getRouteStatistics() {
  const routes = dynamicRouteMapper.getAllRoutes();
  const audit = dynamicRouteMapper.getSecurityAudit();
  const problematic = dynamicRouteMapper.getProblematicRoutes();

  return {
    audit,
    problematic,
    routesByRisk: {
      critical: routes.filter(r => r.riskLevel === 'critical').length,
      high: routes.filter(r => r.riskLevel === 'high').length,
      medium: routes.filter(r => r.riskLevel === 'medium').length,
      low: routes.filter(r => r.riskLevel === 'low').length,
    },
    routesByTag: Object.fromEntries(
      Array.from(new Set(routes.flatMap(r => r.tags))).map(tag => [
        tag,
        routes.filter(r => r.tags.includes(tag)).length,
      ])
    ),
  };
}

export default {
  dynamicRouteMapper,
  trackRouteAccess,
  registerExpressRoutes,
  getRouteStatistics,
};
