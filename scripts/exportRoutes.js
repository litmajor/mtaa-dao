/**
 * 📌 Route Map Export Script
 * 
 * Generates structural view of all defined routes
 * - routes-map.json: Full JSON structure
 * - routes-map.csv: Flat CSV for Excel analysis
 * 
 * Usage:
 * In backend setup: exportRoutes(app) after all routes registered
 */

import fs from 'fs';
import path from 'path';

function getRouterStack(router) {
  return router.stack || router._router?.stack;
}

function getMountedPath(layer) {
  if (typeof layer.path === 'string') return layer.path;
  if (!layer.regexp) return '';

  let source = layer.regexp.source.replace(/^\^/, '');
  const endMarker = '\\/?(?=\\/|$)';
  if (source.endsWith(endMarker)) {
    source = source.slice(0, -endMarker.length);
  }

  let paramIndex = 0;
  source = source.replace(/\(\?:\\\/\(([^()]*)\)\)/g, () => {
    const key = layer.keys?.[paramIndex++];
    return `/:${key?.name || `param${paramIndex}`}`;
  });

  source = source.replace(/\\(.)/g, '$1');
  return source === '/?' ? '' : source;
}

function collectEndpoints(app) {
  const endpoints = [];

  function visit(router, basePath = '') {
    const stack = getRouterStack(router);
    if (!stack) return;

    for (const layer of stack) {
      if (layer.route) {
        const routePaths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        const methods = Object.keys(layer.route.methods || {})
          .filter(method => method !== '_all')
          .map(method => method.toUpperCase());
        const middlewares = (layer.route.stack || []).map(item => item.handle.name || 'anonymous');

        for (const routePath of routePaths) {
          const fullPath = `${basePath}${routePath === '/' ? '' : routePath}` || '/';
          const existing = endpoints.find(endpoint => endpoint.path === fullPath);
          if (existing) {
            existing.methods = [...new Set([...existing.methods, ...methods])];
            existing.middlewares = [...new Set([...existing.middlewares, ...middlewares])];
          } else {
            endpoints.push({ path: fullPath, methods, middlewares });
          }
        }
        continue;
      }

      if (layer.name === 'router' || layer.name === 'mounted_app') {
        visit(layer.handle, `${basePath}${getMountedPath(layer)}`);
      }
    }
  }

  visit(app);
  return endpoints;
}

/**
 * Export routes to JSON and CSV files
 */
function exportRoutes(app, outputDir = '.') {
  try {
    const endpoints = collectEndpoints(app);

    if (!endpoints || endpoints.length === 0) {
      console.warn('⚠️  No endpoints found');
      return;
    }

    // Normalize for table view
    const formatted = endpoints.map(e => {
      const pathParts = e.path.split('/').filter(Boolean);
      const isApiPath = pathParts[0] === 'api';
      const hasVersionPrefix = isApiPath && /^v\d+$/i.test(pathParts[1] || '');
      const domainIndex = isApiPath ? (hasVersionPrefix ? 2 : 1) : 0;
      const domain = pathParts[domainIndex] || 'root';
      const fullDomain = `/${pathParts.slice(0, domainIndex + 1).join('/')}`;

      return {
        path: e.path,
        methods: e.methods.join(', '),
        methodCount: e.methods.length,
        middlewareCount: e.middlewares ? e.middlewares.length : 0,
        middlewares: e.middlewares || [],
        middlewareScope: 'Direct route handlers only; router/application middleware is not included',
        domain: domain,
        fullDomain,
      };
    });

    // Sort by domain + path for visibility
    formatted.sort((a, b) => {
      if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
      return a.path.localeCompare(b.path);
    });

    // Export JSON
    const jsonPath = path.join(outputDir, 'routes-map.json');
    fs.writeFileSync(jsonPath, JSON.stringify(formatted, null, 2));
    console.log(`✅ Route map exported to: ${jsonPath}`);

    // Export CSV
    const csvPath = path.join(outputDir, 'routes-map.csv');
    const csvHeader = 'METHODS,PATH,DOMAIN,FULL_DOMAIN,METHOD_COUNT,MIDDLEWARE_COUNT,MIDDLEWARE_SCOPE\n';
    const csvRows = formatted
      .map(r => `"${r.methods}","${r.path}","${r.domain}","${r.fullDomain}",${r.methodCount},${r.middlewareCount},"${r.middlewareScope}"`)
      .join('\n');

    fs.writeFileSync(csvPath, csvHeader + csvRows);
    console.log(`✅ Route CSV exported to: ${csvPath}`);

    // Summary statistics
    const stats = {
      totalEndpoints: formatted.length,
      totalMethods: formatted.reduce((sum, r) => sum + r.methodCount, 0),
      uniqueDomains: new Set(formatted.map(r => r.domain)).size,
      totalMiddleware: formatted.reduce((sum, r) => sum + r.middlewareCount, 0),
      byDomain: {},
    };

    // Group by domain
    formatted.forEach(r => {
      if (!stats.byDomain[r.domain]) {
        stats.byDomain[r.domain] = { count: 0, methods: new Set(), paths: [] };
      }
      stats.byDomain[r.domain].count++;
      r.methods.split(', ').forEach(m => stats.byDomain[r.domain].methods.add(m));
      stats.byDomain[r.domain].paths.push(r.path);
    });

    // Cleanup Set for serialization
    Object.keys(stats.byDomain).forEach(domain => {
      stats.byDomain[domain].methods = Array.from(stats.byDomain[domain].methods);
    });

    // Export stats
    const statsPath = path.join(outputDir, 'routes-stats.json');
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    console.log(`✅ Route stats exported to: ${statsPath}`);

    // Console summary
    console.log('\n📊 Route Export Summary:');
    console.log(`   Total Endpoints: ${stats.totalEndpoints}`);
    console.log(`   Total Methods: ${stats.totalMethods}`);
    console.log(`   Unique Domains: ${stats.uniqueDomains}`);
    console.log(`   Total Middleware: ${stats.totalMiddleware}`);
    console.log('   Middleware counts include direct route handlers only; inherited middleware is not represented.');
    console.log(`\n   By Domain:`);
    Object.entries(stats.byDomain).forEach(([domain, data]) => {
      console.log(`   - ${domain}: ${data.count} endpoints, methods: ${data.methods.join(', ')}`);
    });

    return {
      endpoints: formatted,
      stats,
    };
  } catch (error) {
    console.error('❌ Error exporting routes:', error.message);
    return null;
  }
}

export default exportRoutes;
