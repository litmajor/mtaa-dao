import winston from 'winston';
import { CorrelationContext } from './CorrelationContext';

// Custom format to inject CorrelationContext into all logs
const correlationFormat = winston.format((info) => {
  const ctx = CorrelationContext.get();
  if (ctx) {
    info.correlationId = ctx.correlationId;
    info.actor = ctx.actor;
    if (ctx.causationId) {
      info.causationId = ctx.causationId;
    }
  }
  return info;
});

// Configure Winston to output JSON structured logs
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    correlationFormat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ],
});
