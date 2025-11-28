/**
 * Escrow Notifications Service
 * Handles email and SMS notifications for all escrow events
 */

import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { db } from '../db';

// Email configuration
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// SMS configuration (Twilio)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

/**
 * Email Templates
 */
const emailTemplates = {
  escrowCreated: (payer: any, recipient: any, escrow: any) => ({
    subject: `💰 New Secure Payment from ${payer.username}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0;">🔒 Secure Payment Invitation</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
          <p>Hello <strong>${recipient.username}</strong>,</p>
          
          <p><strong>${payer.username}</strong> has sent you a secure payment through MTAA escrow.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
            <p style="margin-top: 0;"><strong>Payment Details:</strong></p>
            <ul style="list-style: none; padding: 0;">
              <li style="padding: 8px 0;"><strong>Amount:</strong> ${escrow.amount} ${escrow.currency}</li>
              <li style="padding: 8px 0;"><strong>Purpose:</strong> ${escrow.description}</li>
              <li style="padding: 8px 0;"><strong>Milestones:</strong> ${escrow.milestones?.length || 1}</li>
            </ul>
          </div>
          
          <p><strong>How It Works:</strong></p>
          <ol>
            <li>Review the payment details and milestones</li>
            <li>Accept the escrow to get started</li>
            <li>Complete each milestone as agreed</li>
            <li>Get paid on milestone approval</li>
          </ol>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL}/escrow/accept/${escrow.metadata.inviteCode}?ref=${payer.id}" 
               style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              ✓ Accept Secure Payment
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            Don't have an account? You'll be able to sign up when you click the accept button.
          </p>
        </div>
        
        <div style="padding: 20px; background: #f3f4f6; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666;">
          <p>This is a secure payment invitation. Only you can accept this escrow.</p>
          <p>Questions? Visit <a href="${process.env.APP_URL}/help/escrow">our escrow guide</a></p>
        </div>
      </div>
    `,
  }),

  escrowAccepted: (payer: any, payee: any, escrow: any) => ({
    subject: `✅ Escrow Accepted - ${escrow.amount} ${escrow.currency} from ${payee.username}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0;">✅ Escrow Accepted!</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
          <p>Hello <strong>${payer.username}</strong>,</p>
          
          <p><strong>${payee.username}</strong> has accepted your secure payment request!</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <p style="margin-top: 0;"><strong>Escrow Status:</strong></p>
            <ul style="list-style: none; padding: 0;">
              <li style="padding: 8px 0;"><strong>Payee:</strong> ${payee.username} (${payee.email})</li>
              <li style="padding: 8px 0;"><strong>Amount:</strong> ${escrow.amount} ${escrow.currency}</li>
              <li style="padding: 8px 0;"><strong>Status:</strong> <span style="background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px;">Accepted</span></li>
            </ul>
          </div>
          
          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Fund the escrow from your wallet</li>
            <li>${payee.username} will start working on the milestones</li>
            <li>Review and approve each milestone</li>
            <li>Funds are released upon your approval</li>
          </ol>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL}/wallet/escrow/${escrow.id}" 
               style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Escrow Details
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  milestonePending: (payer: any, payee: any, escrow: any, milestone: any) => ({
    subject: `📋 Milestone Ready for Review - ${milestone.description}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0;">📋 Milestone Ready for Review</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
          <p>Hello <strong>${payer.username}</strong>,</p>
          
          <p><strong>${payee.username}</strong> has submitted work for a milestone in your escrow:</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin-top: 0;"><strong>Milestone Details:</strong></p>
            <ul style="list-style: none; padding: 0;">
              <li style="padding: 8px 0;"><strong>Name:</strong> ${milestone.description}</li>
              <li style="padding: 8px 0;"><strong>Amount:</strong> ${milestone.amount} ${escrow.currency}</li>
              <li style="padding: 8px 0;"><strong>Status:</strong> <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px;">Pending Review</span></li>
            </ul>
          </div>
          
          <p style="color: #666;">
            Review the submitted work and either approve the payment or request revisions.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL}/wallet/escrow/${escrow.id}/review" 
               style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Review Milestone
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  milestoneApproved: (payee: any, escrow: any, milestone: any) => ({
    subject: `🎉 Milestone Approved! - ${milestone.amount} ${escrow.currency} Coming Your Way`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0;">🎉 Milestone Approved!</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
          <p>Hello <strong>${payee.username}</strong>,</p>
          
          <p>Great news! Your milestone has been approved and payment is being processed.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <p style="margin-top: 0;"><strong>Payment Approved:</strong></p>
            <ul style="list-style: none; padding: 0;">
              <li style="padding: 8px 0;"><strong>Milestone:</strong> ${milestone.description}</li>
              <li style="padding: 8px 0;"><strong>Amount:</strong> <span style="font-size: 18px; font-weight: bold; color: #10b981;">${milestone.amount} ${escrow.currency}</span></li>
              <li style="padding: 8px 0;"><strong>Estimated Arrival:</strong> 1-3 minutes</li>
            </ul>
          </div>
          
          <p style="text-align: center; color: #666; font-size: 14px;">
            Payment is being transferred to your wallet now. You'll receive a confirmation shortly.
          </p>
        </div>
      </div>
    `,
  }),

  escrowDisputed: (payer: any, payee: any, escrow: any, reason: string) => ({
    subject: `⚠️ Escrow Disputed - ${escrow.amount} ${escrow.currency}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0;">⚠️ Escrow Dispute Initiated</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
          <p>An escrow has been disputed and requires attention.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
            <p style="margin-top: 0;"><strong>Dispute Information:</strong></p>
            <ul style="list-style: none; padding: 0;">
              <li style="padding: 8px 0;"><strong>Amount:</strong> ${escrow.amount} ${escrow.currency}</li>
              <li style="padding: 8px 0;"><strong>Reason:</strong> ${reason}</li>
              <li style="padding: 8px 0;"><strong>Status:</strong> <span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px;">Dispute Initiated</span></li>
            </ul>
          </div>
          
          <p style="color: #666;">
            A MTAA admin will review this dispute and contact both parties with resolution options.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL}/wallet/escrow/${escrow.id}" 
               style="background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Dispute Details
            </a>
          </div>
        </div>
      </div>
    `,
  }),
};

/**
 * Send email notification
 */
export async function sendEmailNotification(
  email: string,
  template: string,
  data: any
) {
  try {
    if (!emailTransporter.verify) {
      console.warn('Email transporter not configured properly');
      return;
    }

    const templateData = emailTemplates[template as keyof typeof emailTemplates];
    if (!templateData) {
      console.error(`Email template not found: ${template}`);
      return;
    }

    const mailContent = templateData(data.payer, data.recipient || data.payee, data.escrow, data.milestone);

    await emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@mtaa.io',
      to: email,
      subject: mailContent.subject,
      html: mailContent.html,
    });

    console.log(`✅ Email sent to ${email} for ${template}`);
  } catch (error) {
    console.error(`Error sending email to ${email}:`, error);
  }
}

/**
 * Send SMS notification
 */
export async function sendSmsNotification(
  phoneNumber: string,
  message: string
) {
  try {
    if (!TWILIO_PHONE || !twilioClient) {
      console.warn('SMS not configured - skipping');
      return;
    }

    await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE,
      to: phoneNumber,
    });

    console.log(`✅ SMS sent to ${phoneNumber}`);
  } catch (error) {
    console.error(`Error sending SMS to ${phoneNumber}:`, error);
  }
}

/**
 * SMS Message Templates
 */
const smsTemplates = {
  escrowCreated: (amount: string, currency: string, username: string) =>
    `💰 ${username} sent you ${amount} ${currency} via secure escrow. Accept the invitation: ${process.env.APP_URL}/escrow - MTAA`,

  escrowAccepted: (username: string, amount: string, currency: string) =>
    `✅ ${username} accepted your ${amount} ${currency} escrow. Next: Fund the escrow. View: ${process.env.APP_URL}/wallet - MTAA`,

  milestonePending: (username: string, milestone: string) =>
    `📋 ${username} submitted "${milestone}". Review and approve payment: ${process.env.APP_URL}/wallet - MTAA`,

  milestoneApproved: (amount: string, currency: string) =>
    `🎉 Milestone approved! ${amount} ${currency} is being sent to your wallet. - MTAA`,

  escrowDisputed: () =>
    `⚠️ An escrow has been disputed. Review details: ${process.env.APP_URL}/wallet - MTAA`,
};

/**
 * Send SMS for escrow creation (recipient)
 */
export async function sendEscrowCreatedSms(
  recipientPhone: string,
  payer: any,
  escrow: any
) {
  if (!recipientPhone) return;

  const message = smsTemplates.escrowCreated(
    escrow.amount,
    escrow.currency,
    payer.username
  );

  await sendSmsNotification(recipientPhone, message);
}

/**
 * Send SMS for escrow acceptance (both parties)
 */
export async function sendEscrowAcceptedSms(
  payerPhone: string,
  payeeUsername: string,
  escrow: any
) {
  if (!payerPhone) return;

  const message = smsTemplates.escrowAccepted(
    payeeUsername,
    escrow.amount,
    escrow.currency
  );

  await sendSmsNotification(payerPhone, message);
}

/**
 * Send SMS for milestone pending review (payer)
 */
export async function sendMilestonePendingSms(
  payerPhone: string,
  payeeUsername: string,
  milestone: any
) {
  if (!payerPhone) return;

  const message = smsTemplates.milestonePending(
    payeeUsername,
    milestone.description
  );

  await sendSmsNotification(payerPhone, message);
}

/**
 * Send SMS for milestone approved (payee)
 */
export async function sendMilestoneApprovedSms(
  payeePhone: string,
  amount: string,
  currency: string
) {
  if (!payeePhone) return;

  const message = smsTemplates.milestoneApproved(amount, currency);

  await sendSmsNotification(payeePhone, message);
}

/**
 * Send SMS for dispute (both parties)
 */
export async function sendDisputeSms(
  phone: string
) {
  if (!phone) return;

  const message = smsTemplates.escrowDisputed();

  await sendSmsNotification(phone, message);
}

/**
 * Notify when escrow is created
 */
export async function notifyEscrowCreated(
  payer: any,
  recipientEmail: string,
  escrow: any
) {
  // Email to recipient
  await sendEmailNotification(recipientEmail, 'escrowCreated', {
    payer,
    recipient: { username: recipientEmail.split('@')[0], email: recipientEmail },
    escrow,
  });

  // SMS to payer (if they enabled it)
  if (payer.phone && payer.notifications.sms) {
    await sendSmsNotification(
      payer.phone,
      `💰 Escrow created: ${escrow.amount} ${escrow.currency} to ${recipientEmail}`
    );
  }
}

/**
 * Notify when escrow is accepted
 */
export async function notifyEscrowAccepted(
  payer: any,
  payee: any,
  escrow: any
) {
  // Email to payer
  await sendEmailNotification(payer.email, 'escrowAccepted', {
    payer,
    payee,
    escrow,
  });

  // SMS to payer (if enabled)
  if (payer.phone && payer.notifications.sms) {
    await sendSmsNotification(
      payer.phone,
      `✅ Escrow accepted by ${payee.username}! ${escrow.amount} ${escrow.currency}`
    );
  }

  // Email to payee
  await sendEmailNotification(payee.email, 'escrowAccepted', {
    payer,
    payee,
    escrow,
  });
}

/**
 * Notify when milestone is pending review
 */
export async function notifyMilestonePending(
  payer: any,
  payee: any,
  escrow: any,
  milestone: any
) {
  // Email to payer
  await sendEmailNotification(payer.email, 'milestonePending', {
    payer,
    payee,
    escrow,
    milestone,
  });

  // SMS to payer (if enabled)
  if (payer.phone && payer.notifications.sms) {
    await sendSmsNotification(
      payer.phone,
      `📋 ${payee.username} submitted "${milestone.description}" - Ready for review`
    );
  }
}

/**
 * Notify when milestone is approved
 */
export async function notifyMilestoneApproved(
  payer: any,
  payee: any,
  escrow: any,
  milestone: any
) {
  // Email to payee
  await sendEmailNotification(payee.email, 'milestoneApproved', {
    payee,
    escrow,
    milestone,
  });

  // SMS to payee (if enabled)
  if (payee.phone && payee.notifications.sms) {
    await sendSmsNotification(
      payee.phone,
      `🎉 Milestone approved! ${milestone.amount} ${escrow.currency} being sent to your wallet`
    );
  }
}

/**
 * Notify when escrow is disputed
 */
export async function notifyEscrowDisputed(
  payer: any,
  payee: any,
  escrow: any,
  reason: string
) {
  // Email to both parties
  await sendEmailNotification(payer.email, 'escrowDisputed', {
    payer,
    payee,
    escrow,
    reason,
  });

  await sendEmailNotification(payee.email, 'escrowDisputed', {
    payer,
    payee,
    escrow,
    reason,
  });

  // SMS to both (if enabled)
  if (payer.phone && payer.notifications.sms) {
    await sendSmsNotification(
      payer.phone,
      `⚠️ Escrow dispute initiated. ${process.env.APP_URL}/wallet/escrow/${escrow.id}`
    );
  }

  if (payee.phone && payee.notifications.sms) {
    await sendSmsNotification(
      payee.phone,
      `⚠️ Escrow dispute initiated. ${process.env.APP_URL}/wallet/escrow/${escrow.id}`
    );
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration(): Promise<boolean> {
  try {
    await emailTransporter.verify();
    console.log('✅ Email configuration verified');
    return true;
  } catch (error) {
    console.error('❌ Email configuration failed:', error);
    return false;
  }
}

/**
 * Store notification in database for audit trail
 */
export async function logNotification(
  userId: string,
  type: string,
  channel: 'email' | 'sms',
  target: string,
  escrowId?: string
) {
  try {
    await db.query(
      `INSERT INTO notifications_log (user_id, type, channel, target, escrow_id, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, type, channel, target, escrowId]
    );
  } catch (error) {
    console.error('Error logging notification:', error);
  }
}
