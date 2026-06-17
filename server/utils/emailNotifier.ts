import nodemailer from 'nodemailer';
import { Logger } from './logger';

const logger = Logger.getLogger();

const smtpHost = process.env.EMAIL_HOST;
const smtpPort = Number(process.env.EMAIL_PORT || '587');
const smtpUser = process.env.EMAIL_USER;
const smtpPass = process.env.EMAIL_PASS;
const defaultFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@mtaadao.org';

let transporter: nodemailer.Transporter | null = null;
if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
} else {
  logger.warn('[EmailNotifier] SMTP not fully configured; alerts will be logged only');
}

export async function sendSAGADegradedAlert(sagaId: string, step: string, err: any) {
  const subject = `[SAGA-DB-DEGRADED] saga=${sagaId} step=${step}`;
  const text = `SAGA persistence degraded for saga ${sagaId} at step ${step}.\nError: ${String(err)}\nTime: ${new Date().toISOString()}`;

  // If transporter is unavailable, log and return
  if (!transporter) {
    logger.error('[SAGA-ALERT] SMTP unavailable —', { sagaId, step, error: String(err) });
    return;
  }

  try {
    await transporter.sendMail({
      from: defaultFrom,
      to: process.env.SAGA_ALERT_TO || process.env.EMAIL_USER,
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
