import fs from 'fs'
import path from 'path'
import { logger } from '../utils/logger'
import nodemailer from 'nodemailer'
import sendgrid from '@sendgrid/mail'

type TemplateName =
  | 'welcome'
  | 'password-reset'
  | 'otp'
  | 'proposal-created'
  | 'vote-reminder'
  | 'contribution-reminder'
  | 'withdrawal-confirmation'

export interface EmailPayload {
  to: string
  subject?: string
  template?: TemplateName
  variables?: Record<string, any>
  text?: string
  html?: string
  from?: string
  cc?: string | string[]
  bcc?: string | string[]
}

class EmailServiceClass {
  private sendGridApiKey = process.env.SENDGRID_API_KEY || ''
  private smtpHost = process.env.EMAIL_HOST || process.env.SMTP_HOST || ''
  private smtpPort = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587')
  private smtpUser = process.env.EMAIL_USER || process.env.SMTP_USER || ''
  private smtpPass = process.env.EMAIL_PASS || process.env.SMTP_PASS || ''
  private defaultFrom = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || 'no-reply@mtaadao.org'
  private templatesDir = path.join(process.cwd(), 'server', 'services', 'email', 'templates')

  constructor() {
    if (this.sendGridApiKey) {
      try {
        sendgrid.setApiKey(this.sendGridApiKey)
        logger.info('EmailService: configured SendGrid provider')
      } catch (err) {
        logger.warn('EmailService: failed to initialize SendGrid', { err })
      }
    } else {
      logger.info('EmailService: no SendGrid API key, SMTP fallback will be used if configured')
    }
  }

  private renderTemplate(name: TemplateName, variables: Record<string, any> = {}) {
    try {
      const htmlPath = path.join(this.templatesDir, `${name}.html`)
      const textPath = path.join(this.templatesDir, `${name}.txt`)
      let html = ''
      let text = ''
      if (fs.existsSync(htmlPath)) html = fs.readFileSync(htmlPath, 'utf8')
      if (fs.existsSync(textPath)) text = fs.readFileSync(textPath, 'utf8')

      // simple interpolation
      const interp = (s: string) =>
        s.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_, key) => {
          const val = key.split('.').reduce((acc: any, k: string) => (acc ? acc[k] : ''), variables)
          return String(val ?? '')
        })

      return { html: interp(html), text: interp(text) }
    } catch (err) {
      logger.error('EmailService: template render error', { err })
      return { html: '', text: '' }
    }
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; provider?: string; error?: string; messageId?: string }> {
    const from = payload.from || this.defaultFrom
    const subject = payload.subject || this.inferSubject(payload.template)

    let html = payload.html || payload.text || ''
    let text = payload.text || ''

    if (payload.template) {
      const rendered = this.renderTemplate(payload.template, payload.variables || {})
      html = html || rendered.html
      text = text || rendered.text
    }

    // Prefer SendGrid when API key present
    if (this.sendGridApiKey) {
      try {
        const msg: any = {
          to: payload.to,
          from,
          subject,
          text,
        }
        if (payload.cc) msg.cc = payload.cc
        if (payload.bcc) msg.bcc = payload.bcc
        if (html) msg.html = html
        const res = await sendgrid.send(msg)
        // SendGrid may return an array of responses; try to extract a message id if present
        let messageId: string | undefined
        try {
          const first = Array.isArray(res) ? res[0] : res
          // some SG responses expose a headers object
          if (first && first.headers && first.headers['x-message-id']) messageId = String(first.headers['x-message-id'])
        } catch {}

        logger.info('EmailService: sent via SendGrid', { to: payload.to, subject })
        return { success: true, provider: 'sendgrid', messageId }
      } catch (err) {
        logger.error('EmailService: SendGrid send failed', { err })
        // fallthrough to SMTP fallback
      }
    }

    // SMTP fallback via nodemailer
    if (this.smtpHost && this.smtpUser) {
      try {
        const transporter = nodemailer.createTransport({
          host: this.smtpHost,
          port: this.smtpPort,
          secure: this.smtpPort === 465,
          auth: {
            user: this.smtpUser,
            pass: this.smtpPass,
          },
        })

        const info = await transporter.sendMail({
          from,
          to: payload.to,
          subject,
          text,
          html,
          cc: payload.cc,
          bcc: payload.bcc,
        })

        logger.info('EmailService: sent via SMTP', { to: payload.to, subject, messageId: info.messageId })
        return { success: true, provider: 'smtp', messageId: info.messageId }
      } catch (err) {
        logger.error('EmailService: SMTP send failed', { err })
        return { success: false, error: String(err) }
      }
    }

    logger.warn('EmailService: no provider configured')
    return { success: false, error: 'no-provider-configured' }
  }

  private inferSubject(template?: TemplateName) {
    switch (template) {
      case 'welcome':
        return 'Welcome to MtaaDAO'
      case 'password-reset':
        return 'Reset your password'
      case 'otp':
        return 'Your verification code'
      case 'proposal-created':
        return 'New proposal created'
      case 'vote-reminder':
        return 'Reminder: vote on proposal'
      case 'contribution-reminder':
        return 'Reminder: contribution due'
      case 'withdrawal-confirmation':
        return 'Withdrawal confirmation'
      default:
        return 'Notification from MtaaDAO'
    }
  }
}

export const EmailService = new EmailServiceClass()
export default EmailService
