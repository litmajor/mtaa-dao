#!/usr/bin/env node
/**
 * CLI Tool: Inspect Services
 * Lists all discovered services with health status and metadata
 * Usage: npx ts-node cli/inspect-services.ts [--format json|table|csv]
 */

import { program } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getDiscovery } from '../server/services/operational/discovery/discovery';
import { OperationalFrameworkConfig, ServiceHealthStatus } from '../server/services/operational/types';

// Mock config for CLI
const mockConfig: OperationalFrameworkConfig = {
  discovery: {
    enabled: true,
    intervalMs: 30000,
    healthCheckTimeout: 5000,
    retryAttempts: 2,
    expectedServices: [
      { name: 'API Server', type: 'api_server', host: 'localhost', port: 5000, protocol: 'http' },
      { name: 'PostgreSQL', type: 'database', host: 'localhost', port: 5432, protocol: 'tcp' },
      { name: 'Redis', type: 'cache', host: 'localhost', port: 6379, protocol: 'tcp' },
      {
        name: 'Prometheus',
        type: 'monitoring',
        host: 'localhost',
        port: 9090,
        protocol: 'http',
      },
      { name: 'Grafana', type: 'monitoring', host: 'localhost', port: 3000, protocol: 'http' },
    ],
  },
  audit: { enabled: true, storageBackend: 'postgresql', immutabilityEnabled: true, hashChainVerification: true },
  vault: { enabled: true, rotationEnabled: true, rotationIntervalDays: 7, driftDetectionEnabled: true },
  validation: { enabled: true, intervalMs: 300000, criticalityThreshold: 'high' },
  remediation: { enabled: true, requiresApprovalForDestructive: true, maxAttemptsPerService24h: 3, autoRemediateNonDestructive: false },
};

interface CLIOptions {
  format?: 'json' | 'table' | 'csv';
}

async function main() {
  program
    .version('1.0.0')
    .description('Inspect all discovered services')
    .option('-f, --format <type>', 'Output format: json, table, csv', 'table')
    .parse(process.argv);

  const options = program.opts() as CLIOptions;

  try {
    console.log(chalk.blue.bold('🔍 Service Discovery Inspector\n'));

    // Initialize discovery if needed
    const discovery = getDiscovery();

    const services = discovery.getServices();

    if (services.length === 0) {
      console.log(chalk.yellow('⚠️  No services discovered. Ensure discovery is running.'));
      process.exit(0);
    }

    // Output based on format
    switch (options.format) {
      case 'json':
        outputJSON(services);
        break;
      case 'csv':
        outputCSV(services);
        break;
      case 'table':
      default:
        outputTable(services);
    }

    console.log(`\n${chalk.green('✓')} Total services: ${services.length}`);

    const healthySummary = services.filter((s) => s.healthStatus === ServiceHealthStatus.HEALTHY).length;
    const degradedSummary = services.filter((s) => s.healthStatus === ServiceHealthStatus.DEGRADED).length;
    const offlineSummary = services.filter((s) => s.healthStatus === ServiceHealthStatus.OFFLINE).length;

    console.log(
      `  ${chalk.green(`Healthy: ${healthySummary}`)} | ${chalk.yellow(`Degraded: ${degradedSummary}`)} | ${chalk.red(`Offline: ${offlineSummary}`)}`
    );

    process.exit(0);
  } catch (error) {
    console.error(chalk.red.bold('❌ Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function outputTable(services: any[]) {
  const table = new Table({
    head: [
      chalk.bold('Service Name'),
      chalk.bold('Type'),
      chalk.bold('Host:Port'),
      chalk.bold('Status'),
      chalk.bold('Last Check'),
    ],
    colWidths: [25, 18, 20, 15, 20],
    wordWrap: true,
  });

  for (const service of services) {
    const statusColor = {
      [ServiceHealthStatus.HEALTHY]: chalk.green,
      [ServiceHealthStatus.DEGRADED]: chalk.yellow,
      [ServiceHealthStatus.OFFLINE]: chalk.red,
      [ServiceHealthStatus.UNKNOWN]: chalk.gray,
    }[service.healthStatus] || chalk.gray;

    const lastCheck = service.lastHealthCheck ? new Date(service.lastHealthCheck).toLocaleTimeString() : 'Never';

    table.push([
      service.name,
      service.type,
      `${service.host}:${service.port}`,
      statusColor(service.healthStatus.toUpperCase()),
      lastCheck,
    ]);
  }

  console.log(table.toString());
}

function outputJSON(services: any[]) {
  console.log(
    JSON.stringify(
      services.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        host: s.host,
        port: s.port,
        protocol: s.protocol,
        healthStatus: s.healthStatus,
        lastHealthCheck: s.lastHealthCheck,
        responseTimes: s.responseTimes,
        dependencyCount: s.dependencies.length,
      })),
      null,
      2
    )
  );
}

function outputCSV(services: any[]) {
  console.log('ID,Name,Type,Host,Port,Protocol,HealthStatus,LastCheck');

  for (const service of services) {
    const lastCheck = service.lastHealthCheck ? new Date(service.lastHealthCheck).toISOString() : 'Never';
    console.log(
      `"${service.id}","${service.name}","${service.type}","${service.host}",${service.port},"${service.protocol}","${service.healthStatus}","${lastCheck}"`
    );
  }
}

main();
