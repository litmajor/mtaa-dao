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

import listEndpoints from 'express-list-endpoints';
import fs from 'fs';
import path from 'path';

/**
 * Export routes to JSON and CSV files
 */
function exportRoutes(app, outputDir = '.') {
  try {
    const endpoints = listEndpoints(app);

    if (!endpoints || endpoints.length === 0) {
      console.warn('⚠️  No endpoints found');
      return;
    }

    // Normalize for table view
    const formatted = endpoints.map(e => {
      const pathParts = e.path.split('/').filter(Boolean);
      const domain = pathParts[1] || pathParts[0] || 'root'; // /api/domain/path → domain

      return {
        path: e.path,
        methods: e.methods.join(', '),
        methodCount: e.methods.length,
        middlewareCount: e.middlewares ? e.middlewares.length : 0,
        domain: domain,
        fullDomain: '/' + pathParts.slice(0, 2).join('/'),
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
    const csvHeader = 'METHODS,PATH,DOMAIN,FULL_DOMAIN,METHOD_COUNT,MIDDLEWARE_COUNT\n';
    const csvRows = formatted
      .map(r => `"${r.methods}","${r.path}","${r.domain}","${r.fullDomain}",${r.methodCount},${r.middlewareCount}`)
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
