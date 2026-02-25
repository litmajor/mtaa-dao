#!/usr/bin/env node
/**
 * CLI Tool: Audit Trail Inspector
 * View and analyze operational audit logs
 * Usage: npx ts-node cli/audit-trail.ts [--action ACTION] [--actor ACTOR] [--hours 24]
 */

import { program } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getAuditLogger } from '../server/services/operational/audit/logger';
import { AuditActionType } from '../server/services/operational/types';

interface CLIOptions {
  action?: string;
  actor?: string;
  hours?: string;
  format?: 'table' | 'json';
}

async function main() {
  program
    .version('1.0.0')
    .description('Inspect audit trail')
    .option('-a, --action <action>', 'Filter by action type')
    .option('--actor <actor>', 'Filter by actor')
    .option('--hours <hours>', 'Look back N hours (default: 24)', '24')
    .option('-f, --format <format>', 'Output format: table or json', 'table')
    .parse(process.argv);

  const options = program.opts() as CLIOptions;

  try {
    console.log(chalk.blue.bold('📋 Audit Trail Inspector\n'));

    const auditLogger = getAuditLogger();
    const trail = auditLogger.getTrail();

    // Calculate time range
    const hoursBack = parseInt(options.hours || '24');
    const timeRange = {
      startTime: new Date(Date.now() - hoursBack * 60 * 60 * 1000),
      endTime: new Date(),
    };

    // Query with filters
    const filteredEvents = auditLogger.queryEvents({
      action: options.action as AuditActionType,
      actor: options.actor,
      timeRange,
    });

    if (filteredEvents.length === 0) {
      console.log(chalk.yellow('⚠️  No audit events found matching criteria'));
      process.exit(0);
    }

    // Output
    if (options.format === 'json') {
      outputJSON(filteredEvents);
    } else {
      outputTable(filteredEvents);
    }

    // Print statistics
    console.log(`\n${chalk.green('✓')} Found ${filteredEvents.length} events in last ${hoursBack} hours\n`);

    const stats = auditLogger.getStatistics();
    console.log(chalk.bold('Audit Trail Statistics:'));
    console.log(`  Total events: ${stats.totalEvents}`);
    console.log(`  Chain integrity: ${stats.chainIntegrity ? chalk.green('VALID') : chalk.red('BROKEN')}`);
    console.log(`  Events by type:`);

    for (const [action, count] of Object.entries(stats.eventsByAction)) {
      console.log(`    - ${action}: ${count}`);
    }

    process.exit(0);
  } catch (error) {
    console.error(chalk.red.bold('❌ Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function outputTable(events: any[]) {
  const table = new Table({
    head: [chalk.bold('Timestamp'), chalk.bold('Action'), chalk.bold('Actor'), chalk.bold('Resource'), chalk.bold('Status')],
    colWidths: [20, 25, 15, 20, 12],
    wordWrap: true,
  });

  for (const event of events.slice(0, 50)) {
    const statusColor = event.approvedBy ? chalk.green : chalk.yellow;
    const status = event.approvedBy ? 'APPROVED' : 'PENDING';

    table.push([
      new Date(event.timestamp).toLocaleTimeString(),
      event.action,
      event.actor,
      event.targetResource || 'N/A',
      statusColor(status),
    ]);
  }

  console.log(table.toString());

  if (events.length > 50) {
    console.log(chalk.gray(`... and ${events.length - 50} more events`));
  }
}

function outputJSON(events: any[]) {
  console.log(
    JSON.stringify(
      events.map((e) => ({
        timestamp: e.timestamp,
        action: e.action,
        actor: e.actor,
        targetService: e.targetService,
        targetResource: e.targetResource,
        description: e.description,
        approvedBy: e.approvedBy,
        eventHash: e.eventHash.substring(0, 8) + '...',
      })),
      null,
      2
    )
  );
}

main();
