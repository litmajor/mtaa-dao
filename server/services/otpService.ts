import { redis } from './redis';
import { notificationService } from '../notificationService';
import nodemailer from 'nodemailer';

// OTP Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const OTP_EXPIRY_SECONDS = OTP_EXPIRY_MINUTES * 60;

export interface OTPData {
  otp: string;
  expiresAt: number;
  password: string; // Store hashed password temporarily
  attempts: number;
}

class OTPService {
  private emailTransporter: nodemailer.Transporter;

  constructor() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Generate a 6-digit OTP
   */
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Store OTP in Redis with expiration
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

  /**
   * Verify OTP
   */
  async verifyOTP(identifier: string, otp: string): Promise<{ valid: boolean; password?: string; error?: string }> {
    try {
      console.log(`🔍 Verifying OTP for identifier: ${identifier}, OTP: ${otp}`);

      // Development/Testing bypass: Accept 000000 as a test OTP
      if (otp === '000000' && (process.env.NODE_ENV === 'development' || process.env.ALLOW_TEST_OTP === 'true')) {
        console.log('⚠️  Using test OTP bypass (000000) - development mode');
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
        console.log(`   Redis key checked: otp:${identifier}`);
        return { valid: false, error: 'OTP not found or expired' };
      }

      const otpData: OTPData = JSON.parse(data);
      console.log(`✅ OTP data found. Expiry: ${new Date(otpData.expiresAt).toISOString()}, Attempts: ${otpData.attempts}/5`);

      // Check expiration
      if (Date.now() > otpData.expiresAt) {
        console.log('❌ OTP has expired');
        await redis.delete(`otp:${identifier}`);
        return { valid: false, error: 'OTP has expired' };
      }

      // Check attempts
      if (otpData.attempts >= 5) {
        console.log('❌ Too many failed attempts');
        await redis.delete(`otp:${identifier}`);
        return { valid: false, error: 'Too many failed attempts. Please request a new OTP.' };
      }

      // Verify OTP
      if (otpData.otp !== otp) {
        console.log(`❌ Invalid OTP. Expected: ${otpData.otp}, Got: ${otp}`);
        // Increment attempts
        otpData.attempts++;
        await redis.set(
          `otp:${identifier}`,
          JSON.stringify(otpData),
          Math.floor((otpData.expiresAt - Date.now()) / 1000)
        );
        return { valid: false, error: 'Invalid OTP' };
      }

      // OTP is valid
      console.log('✅ OTP verified successfully');
      return { valid: true, password: otpData.password };
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      return { valid: false, error: 'Verification failed' };
    }
  }

  /**
   * Delete OTP after successful verification
   */
  async deleteOTP(identifier: string): Promise<void> {
    await redis.delete(`otp:${identifier}`);
  }

  /**
   * Send OTP via email
   */
  async sendEmailOTP(email: string, otp: string): Promise<void> {
    // In development mode without SMTP configured, just log the OTP
    const hasValidSMTP = process.env.SMTP_USER &&
                         process.env.SMTP_PASS &&
                         !process.env.SMTP_USER.includes('your_smtp') &&
                         !process.env.SMTP_PASS.includes('your_smtp');

    if (process.env.NODE_ENV === 'development' && !hasValidSMTP) {
      console.log('\n════════════════════════════════════════');
      console.log('📧 EMAIL OTP (Development Mode - No SMTP)');
      console.log('════════════════════════════════════════');
      console.log(`Email: ${email}`);
      console.log(`OTP Code: ${otp}`);
      console.log(`Expires: ${OTP_EXPIRY_MINUTES} minutes`);
      console.log('════════════════════════════════════════\n');
      return; // Skip actual email sending
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@mtaadao.com',
        to: email,
        subject: 'Your MtaaDAO Verification Code',
        html: this.generateEmailTemplate(otp),
      };

      await this.emailTransporter.sendMail(mailOptions);
      console.log(`✅ OTP email sent to ${email}`);
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      throw new Error('Failed to send verification code via email');
    }
  }

  /**
   * Send OTP via SMS
   */
  async sendSMSOTP(phone: string, otp: string): Promise<void> {
    try {
      // For Africa's Talking (Kenya):
      if (process.env.AFRICAS_TALKING_API_KEY && process.env.AFRICAS_TALKING_USERNAME) {
        await this.sendViaAfricasTalking(phone, otp);
      }
      // For Twilio (International):
      else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        await this.sendViaTwilio(phone, otp);
      }
      // Fallback: Log to console (development only)
      else {
        console.log('\n════════════════════════════════════════');
        console.log('📱 SMS OTP (Development Mode - No Provider)');
        console.log('════════════════════════════════════════');
        console.log(`Phone: ${phone}`);
        console.log(`OTP Code: ${otp}`);
        console.log(`Expires: ${OTP_EXPIRY_MINUTES} minutes`);
        console.log('════════════════════════════════════════\n');

        if (process.env.NODE_ENV !== 'development') {
          console.warn('⚠️  No SMS provider configured in production. Add AFRICAS_TALKING or TWILIO credentials.');
        }
      }
    } catch (error) {
      console.error('Failed to send OTP SMS:', error);
      throw new Error('Failed to send verification code via SMS');
    }
  }

  /**
   * Send SMS via Africa's Talking
   */
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

  /**
   * Send SMS via Twilio
   */
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

  /**
   * Generate email template for OTP
   */
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

export const otpService = new OTPService();