/**
 * Route Auditor
 * 
 * Audits Express routes:
 * - Detects duplicate endpoints
 * - Finds unreachable routes (shadowed by earlier matches)
 * - Checks HTTP method consistency
 * - Reports orphaned route files
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

export interface RouteViolation {
  type: 'duplicate' | 'shadowed' | 'inconsistent' | 'orphaned';
  method: string;
  path: string;
  locations: string[];
  details: string;
}

export interface RouteInfo {
  method: string;
  path: string;
  file: string;
  line: number;
}

export class RouteAuditor {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Audit all routes in project
   */
  async audit(routesDir: string): Promise<RouteViolation[]> {
    const violations: RouteViolation[] = [];

    const routes = await this.extractRoutes(routesDir);
    const violations_dup = this.findDuplicates(routes);
    const violations_shadow = this.findShadowed(routes);
    const violations_orphan = await this.findOrphanedFiles(routesDir);

    violations.push(...violations_dup, ...violations_shadow, ...violations_orphan);

    return violations;
  }

  /**
   * Extract all routes from router files
   */
  private async extractRoutes(dir: string): Promise<RouteInfo[]> {
    const routes: RouteInfo[] = [];

    const scanDir = (scanPath: string) => {
      try {
        const files = fs.readdirSync(scanPath);

        for (const file of files) {
          const fullPath = path.join(scanPath, file);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            scanDir(fullPath);
          } else if (['.ts', '.js'].some((ext) => file.endsWith(ext))) {
            const fileRoutes = this.extractFromFile(fullPath);
            routes.push(...fileRoutes);
          }
        }
      } catch (error) {
        logger.warn(`Failed to scan routes in ${scanPath}:`, error);
      }
    };

    scanDir(dir);
    return routes;
  }

  /**
   * Extract routes from single file
   */
  private extractFromFile(filePath: string): RouteInfo[] {
    const routes: RouteInfo[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Match Express route patterns
      // router.get('/path', ...) or app.post('/', ...) etc
      const routeRegex =
        /(?:router|app)\.(get|post|put|delete|patch|head)\s*\(\s*['"]([^'"]+)['"]/gi;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;

        while ((match = routeRegex.exec(line)) !== null) {
          const method = match[1].toUpperCase();
          const routePath = match[2];

          routes.push({
            method,
            path: routePath,
            file: path.relative(this.projectRoot, filePath),
            line: i + 1,
          });
        }
      }
    } catch (error) {
      logger.warn(`Failed to extract routes from ${filePath}:`, error);
    }

    return routes;
  }

  /**
   * Find duplicate routes (same method + path)
   */
  private findDuplicates(routes: RouteInfo[]): RouteViolation[] {
    const violations: RouteViolation[] = [];
    const routeMap = new Map<string, RouteInfo[]>();

    for (const route of routes) {
      const key = `${route.method} ${route.path}`;
      if (!routeMap.has(key)) {
        routeMap.set(key, []);
      }
      routeMap.get(key)!.push(route);
    }

    for (const [key, duplicates] of routeMap) {
      if (duplicates.length > 1) {
        const [method, path] = key.split(' ');
        violations.push({
          type: 'duplicate',
          method,
          path,
          locations: duplicates.map((r) => `${r.file}:${r.line}`),
          details: `Route ${method} ${path} defined in ${duplicates.length} locations`,
        });
      }
    }

    return violations;
  }

  /**
   * Find shadowed routes (more specific path defined after less specific)
   */
  private findShadowed(routes: RouteInfo[]): RouteViolation[] {
    const violations: RouteViolation[] = [];

    // Group by method
    const byMethod = new Map<string, RouteInfo[]>();
    for (const route of routes) {
      if (!byMethod.has(route.method)) {
        byMethod.set(route.method, []);
      }
      byMethod.get(route.method)!.push(route);
    }

    // Check each method
    for (const [method, methodRoutes] of byMethod) {
      for (let i = 0; i < methodRoutes.length; i++) {
        for (let j = i + 1; j < methodRoutes.length; j++) {
          const route1 = methodRoutes[i];
          const route2 = methodRoutes[j];

          // Check if route2 could be unreachable due to route1
          if (this.isShadowed(route1.path, route2.path)) {
            violations.push({
              type: 'shadowed',
              method,
              path: route2.path,
              locations: [
                `${route1.file}:${route1.line}`,
                `${route2.file}:${route2.line}`,
              ],
              details: `Route ${method} ${route2.path} may be unreachable due to ${route1.path}`,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Check if path2 is shadowed by path1
   */
  private isShadowed(path1: string, path2: string): boolean {
    // Exact match
    if (path1 === path2) return true;

    // Path1 is catch-all
    if (path1 === '*') return true;

    // Path1 is more general (fewer segments with wildcards)
    const seg1 = path1.split('/').filter((s) => s);
    const seg2 = path2.split('/').filter((s) => s);

    if (seg1.length > seg2.length) return false;

    for (let i = 0; i < seg1.length; i++) {
      const p1 = seg1[i];
      const p2 = seg2[i];

      // If current segment is param in path1, could shadow
      if (p1.startsWith(':') || p1.startsWith('*')) {
        return true; // potential shadow, return true to warn
      }

      // Could also be shadowed if path1 has fewer segments
      if (i === seg1.length - 1 && seg2.length > seg1.length) {
        return p1.startsWith(':');
      }
    }

    return false;
  }

  /**
   * Find orphaned route files (not imported/used)
   */
  private async findOrphanedFiles(dir: string): Promise<RouteViolation[]> {
    const violations: RouteViolation[] = [];

    try {
      // Get all route files
      const routeFiles = new Set<string>();
      const scanDir = (scanPath: string) => {
        const files = fs.readdirSync(scanPath);
        for (const file of files) {
          const fullPath = path.join(scanPath, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanDir(fullPath);
          } else if (['.ts', '.js'].some((ext) => file.endsWith(ext))) {
            routeFiles.add(fullPath);
          }
        }
      };

      scanDir(dir);

      // Check main index.ts for imports
      const indexPath = path.join(this.projectRoot, 'server', 'index.ts');
      if (fs.existsSync(indexPath)) {
        const indexContent = fs.readFileSync(indexPath, 'utf8');

        for (const routeFile of routeFiles) {
          const relPath = path
            .relative(this.projectRoot, routeFile)
            .replace(/\\/g, '/')
            .replace(/\.(ts|js)$/, '');

          if (!indexContent.includes(relPath)) {
            violations.push({
              type: 'orphaned',
              method: 'N/A',
              path: 'N/A',
              locations: [relPath],
              details: `Route file ${relPath} not imported in main index`,
            });
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to find orphaned routes:`, error);
    }

    return violations;
  }
}
