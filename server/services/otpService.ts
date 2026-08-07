import crypto from 'crypto';
import { redis } from './redis';
import { EmailService } from './emailService';

/**
 * FIXES APPLIED:
 * 1. CRITICAL: OTPService.generateOTP() previously generated a code
 *    (`code`), then called storeOTP() which generates its OWN separate
 *    random OTP internally and returns it — but that return value was
 *    discarded. The SMS sent to the user carried `code`, while Redis
 *    stored a completely different value, so verifyOTP() would ALWAYS
 *    fail for every real phone-based OTP flow (the dev '000000' bypass
 *    was the only path that ever worked). storeOTP() was already
 *    correctly atomic — generate, store, return the same value — so the
 *    fix is simply to use its return value as the one true code, instead
 *    of generating and sending a second, never-stored one.
 * 2. Added a short cooldown (30s) per identifier before another OTP can be
 *    requested. Regenerating doesn't help an attacker brute-force (each
 *    resend is a fresh random target), but unlimited free resends are a
 *    real cost/abuse vector against SMS/email providers with no cooldown
 *    at all.
 */

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const OTP_EXPIRY_SECONDS = OTP_EXPIRY_MINUTES * 60;
const RESEND_COOLDOWN_SECONDS = 30;

export interface OTPData {
  otp: string;
  expiresAt: number;
  password: string;
  attempts: number;
}

export type OTPDeliveryChannel = 'email' | 'sms' | 'whatsapp';

class OTPServiceInternal {
  generateOTP(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Store a freshly-generated OTP in Redis and return it. This is already
   * atomic — callers should always use the RETURNED value as the code to
   * send, never generate a separate one themselves (see FIX #1 above).
   */
  async storeOTP(identifier: string, password: string): Promise<string> {
    const otp = this.generateOTP();
    const otpData: OTPData = {
      otp,
      expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1000,
      password,
      attempts: 0,
    };

    await redis.set(
      `otp:${identifier}`,
      JSON.stringify(otpData),
      OTP_EXPIRY_SECONDS
    );

    return otp;
  }

  async verifyOTP(identifier: string, otp: string): Promise<{ valid: boolean; password?: string; error?: string }> {
    try {
      console.log(`🔍 Verifying OTP for identifier: ${identifier}`);

      const isDevBypassEnabled = otp === '000000' && process.env.NODE_ENV !== 'production' && process.env.ALLOW_TEST_OTP === 'true';
      if (isDevBypassEnabled) {
        console.log('⚠️  Using test OTP bypass (000000) - non-production mode');
        const data = await redis.get(`otp:${identifier}`);

        if (!data) {
          console.log('❌ No OTP data found in Redis for test OTP');
          return { valid: false, error: 'OTP not found or expired' };
        }

        const otpData: OTPData = JSON.parse(data);
        console.log('✅ Test OTP accepted - returning stored password');
        return { valid: true, password: otpData.password };
      }

      const data = await redis.get(`otp:${identifier}`);

      if (!data) {
        console.log(`❌ OTP not found in Redis for identifier: ${identifier}`);
        return { valid: false, error: 'OTP not found or expired' };
      }

      const otpData: OTPData = JSON.parse(data);
      console.log(`✅ OTP data found. Expiry: ${new Date(otpData.expiresAt).toISOString()}, Attempts: ${otpData.attempts}/5`);

      if (Date.now() > otpData.expiresAt) {
        console.log('❌ OTP has expired');
        await redis.delete(`otp:${identifier}`);
        return { valid: false, error: 'OTP has expired' };
      }

      if (otpData.attempts >= 5) {
        console.log('❌ Too many failed attempts');
        await redis.delete(`otp:${identifier}`);
        return { valid: false, error: 'Too many failed attempts. Please request a new OTP.' };
      }

      const otpMatch = otpData.otp.length === otp.length && crypto.timingSafeEqual(Buffer.from(otpData.otp), Buffer.from(otp));
      if (!otpMatch) {
        console.log('❌ Invalid OTP provided');
        otpData.attempts++;
        // Clamp to at least 1s — expiresAt - now could theoretically be
        // very small/negative in a race right at expiry.
        const remainingTtl = Math.max(1, Math.floor((otpData.expiresAt - Date.now()) / 1000));
        await redis.set(`otp:${identifier}`, JSON.stringify(otpData), remainingTtl);
        return { valid: false, error: 'Invalid OTP' };
      }

      console.log('✅ OTP verified successfully');
      return { valid: true, password: otpData.password };
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      return { valid: false, error: 'Verification failed' };
    }
  }

  async deleteOTP(identifier: string): Promise<void> {
    await redis.delete(`otp:${identifier}`);
  }

  async sendEmailOTP(email: string, otp: string): Promise<void> {
    const result = await EmailService.send({
      to: email,
      subject: 'Your MtaaDAO Verification Code',
      html: this.generateEmailTemplate(otp),
    });

    if (!result.success) {
      console.error('Failed to send OTP email via centralized EmailService:', result.error);
      throw new Error(result.error || 'Failed to send verification code via email');
    }

    console.log(`✅ OTP email sent to ${email} via EmailService`);
  }

  async sendSMSOTP(phone: string, otp: string): Promise<void> {
    try {
      const isKenyanNumber = phone.startsWith('+254');
      const hasAfricasTalking = Boolean(
        process.env.AFRICAS_TALKING_API_KEY &&
        process.env.AFRICAS_TALKING_USERNAME
      );
      const hasTwilio = Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER
      );

      if (isKenyanNumber && hasAfricasTalking) {
        await this.sendViaAfricasTalking(phone, otp);
        return;
      }

      if (hasTwilio) {
        await this.sendViaTwilio(phone, otp);
        return;
      }

      if (hasAfricasTalking && !isKenyanNumber) {
        throw new Error(
          'Africa\'s Talking is configured, but the phone number is not Kenyan. Configure Twilio for international numbers.'
        );
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('\n════════════════════════════════════════');
        console.log('📱 SMS OTP (Development Mode - No Provider)');
        console.log('════════════════════════════════════════');
        console.log(`Phone: ${phone}`);
        console.log(`OTP Code: ${otp}`);
        console.log(`Expires: ${OTP_EXPIRY_MINUTES} minutes`);
        console.log('════════════════════════════════════════\n');
      }

      if (process.env.NODE_ENV !== 'development') {
        console.warn('⚠️  No SMS provider configured in production. Add AFRICAS_TALKING or TWILIO credentials.');
      }
    } catch (error) {
      console.error('Failed to send OTP SMS:', error);
      throw new Error('Failed to send verification code via SMS');
    }
  }

  async sendWhatsAppOTP(phone: string, otp: string): Promise<void> {
    try {
      const phoneId = process.env.WHATSAPP_PHONE_ID;
      const token = process.env.WHATSAPP_ACCESS_TOKEN;

      if (!phoneId || !token) {
        if (process.env.NODE_ENV === 'development') {
          console.log('\n════════════════════════════════════════');
          console.log('💬 WhatsApp OTP (Development Mode - No Provider)');
          console.log('════════════════════════════════════════');
          console.log(`Phone: ${phone}`);
          console.log(`OTP Code: ${otp}`);
          console.log(`Expires: ${OTP_EXPIRY_MINUTES} minutes`);
          console.log('════════════════════════════════════════\n');
        }
        return;
      }

      const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: {
            body: `Your MtaaDAO verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${response.status}`);
      }

      console.log(`✅ OTP WhatsApp sent to ${phone}`);
    } catch (error) {
      console.error('Failed to send OTP WhatsApp:', error);
      throw new Error('Failed to send verification code via WhatsApp');
    }
  }

  async sendOTPByChannel(destination: string, otp: string, channel: OTPDeliveryChannel): Promise<void> {
    if (channel === 'email') {
      await this.sendEmailOTP(destination, otp);
      return;
    }

    if (channel === 'whatsapp') {
      await this.sendWhatsAppOTP(destination, otp);
      return;
    }

    await this.sendSMSOTP(destination, otp);
  }

  private async sendViaAfricasTalking(phone: string, otp: string): Promise<void> {
    try {
      const response = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apiKey': process.env.AFRICAS_TALKING_API_KEY!,
        },
        body: new URLSearchParams({
          username: process.env.AFRICAS_TALKING_USERNAME!,
          to: phone,
          message: `Your MtaaDAO verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Africa's Talking API error: ${response.status}`);
      }

      console.log(`✅ OTP SMS sent to ${phone} via Africa's Talking`);
    } catch (error) {
      console.error('Africa\'s Talking SMS error:', error);
      throw error;
    }
  }

  private async sendViaTwilio(phone: string, otp: string): Promise<void> {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_PHONE_NUMBER;

      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: phone,
            From: from!,
            Body: `Your MtaaDAO verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.status}`);
      }

      console.log(`✅ OTP SMS sent to ${phone} via Twilio`);
    } catch (error) {
      console.error('Twilio SMS error:', error);
      throw error;
    }
  }

  private generateEmailTemplate(otp: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MtaaDAO Verification Code</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
          }
          .otp-box {
            background: #f9fafb;
            border: 2px dashed #667eea;
            border-radius: 8px;
            padding: 24px;
            text-align: center;
            margin: 24px 0;
          }
          .otp-code {
            font-size: 36px;
            font-weight: 700;
            color: #667eea;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
          }
          .footer {
            padding: 20px 30px;
            text-align: center;
            font-size: 13px;
            color: #666;
            border-top: 1px solid #e5e7eb;
          }
          .warning {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px 16px;
            margin: 20px 0;
            border-radius: 4px;
            font-size: 14px;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 32px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 MtaaDAO</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Verification Code</p>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Thank you for registering with MtaaDAO. Please use the following verification code to complete your registration:</p>

            <div class="otp-box">
              <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Your Verification Code</div>
              <div class="otp-code">${otp}</div>
              <div style="font-size: 14px; color: #666; margin-top: 8px;">Valid for ${OTP_EXPIRY_MINUTES} minutes</div>
            </div>

            <p>Enter this code on the registration page to verify your account.</p>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong> Never share this code with anyone. MtaaDAO staff will never ask for your verification code.
            </div>

            <p style="margin-top: 24px;">If you didn't request this code, please ignore this email or contact support if you have concerns.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from MtaaDAO. Please do not reply to this email.</p>
            <p style="margin-top: 8px;">© ${new Date().getFullYear()} MtaaDAO. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

const _otpInternal = new OTPServiceInternal();

export const OTPService = {
  generateOTP: async (userId: string, phone: string): Promise<string> => {
    // FIX #1: use storeOTP()'s returned value as the single source of
    // truth for the code that gets sent — do not generate a separate one.
    const identifier = `phone:${userId}:${phone}`;

    // FIX #2: basic per-identifier resend cooldown
    const cooldownKey = `otp:cooldown:${identifier}`;
    const onCooldown = await redis.exists(cooldownKey);
    if (onCooldown) {
      throw new Error('An OTP was recently sent. Please wait before requesting another.');
    }

    const code = await _otpInternal.storeOTP(identifier, '');
    await _otpInternal.sendSMSOTP(phone, code);
    await redis.set(cooldownKey, '1', RESEND_COOLDOWN_SECONDS);
    return code;
  },

  verifyOTP: async (userId: string, phone: string, otp: string): Promise<boolean> => {
    const result = await _otpInternal.verifyOTP(`phone:${userId}:${phone}`, otp);
    if (result.valid) {
      await _otpInternal.deleteOTP(`phone:${userId}:${phone}`);
      return true;
    }
    return false;
  },

  _internal: _otpInternal,
};

export const otpService = _otpInternal;