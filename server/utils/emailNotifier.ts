import { Logger } from './logger';
import { EmailService } from '../services/emailService';

const logger = Logger.getLogger();

export async function sendSAGADegradedAlert(sagaId: string, step: string, err: any) {
  const subject = `[SAGA-DB-DEGRADED] saga=${sagaId} step=${step}`;
  const text = `SAGA persistence degraded for saga ${sagaId} at step ${step}.\nError: ${String(err)}\nTime: ${new Date().toISOString()}`;

  try {
    await EmailService.send({
      to: process.env.SAGA_ALERT_TO || process.env.EMAIL_USER || '',
      subject,
      text,
    });
    logger.info('[SAGA-ALERT] Email sent for degraded saga', { sagaId, step });
  } catch (e) {
    logger.error('[SAGA-ALERT] Failed to send alert email', e);
  }
}

export default {
  sendSAGADegradedAlert,
};
