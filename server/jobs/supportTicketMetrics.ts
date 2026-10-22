import { pool } from '../db';
import { logger } from '../utils/logger';

let intervalHandle: NodeJS.Timeout | null = null;

export async function aggregateSupportTicketMetrics(): Promise<void> {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total_tickets,
      COUNT(*) FILTER (WHERE status = 'open')::int AS open_tickets,
      COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_tickets,
      COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_tickets,
      COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_tickets
    FROM support_tickets
  `);
  const metrics = result.rows[0];

  await pool.query(
    `INSERT INTO support_ticket_metrics
      (date, total_tickets, open_tickets, in_progress_tickets, resolved_tickets, closed_tickets,
       avg_first_response_time, avg_resolution_time, resolution_rate, satisfaction_score)
     VALUES (NOW(), $1::int, $2::int, $3::int, $4::int, $5::int, 0, 0,
       CASE WHEN $1::int > 0 THEN (($4::int + $5::int)::numeric / $1::int) * 100 ELSE 0 END, 0)`,
    [metrics.total_tickets, metrics.open_tickets, metrics.in_progress_tickets, metrics.resolved_tickets, metrics.closed_tickets]
  );
}

export function startSupportTicketMetricsJob(intervalMs = Number(process.env.SUPPORT_TICKET_METRICS_INTERVAL_MS || 300000)): void {
  if (intervalHandle) return;
  aggregateSupportTicketMetrics().catch(error => logger.error('[SupportMetrics] Initial aggregation failed', error));
  intervalHandle = setInterval(() => {
    aggregateSupportTicketMetrics().catch(error => logger.error('[SupportMetrics] Scheduled aggregation failed', error));
  }, intervalMs);
  logger.info(`[SupportMetrics] Started metrics aggregation job (interval=${intervalMs}ms)`);
}

export function stopSupportTicketMetricsJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
