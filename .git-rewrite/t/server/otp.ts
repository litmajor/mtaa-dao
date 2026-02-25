import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import nodemailer from "nodemailer";
// For SMS, you can use Twilio or similar. Here we mock it.

const OTP_EXPIRY_MINUTES = 10;

export async function generateAndSendOTP({ email, phone }: { email?: string; phone?: string }) {
  const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  // Store OTP in DB (for demo, attach to user row; in prod, use a separate table)
  if (email) {
    await db.update(users).set({ otp, otpExpiresAt: expiresAt }).where(eq(users.email, email));
    await sendEmailOTP(email, otp);
  } else if (phone) {
    await db.update(users).set({ otp, otpExpiresAt: expiresAt }).where(eq(users.phone, phone));
    await sendSMSOTP(phone, otp);
  }
}

export async function verifyOTP({ email, phone, otp }: { email?: string; phone?: string; otp: string }) {
  let user;
  if (email) {
    [user] = await db.select().from(users).where(eq(users.email, email));
  } else if (phone) {
    [user] = await db.select().from(users).where(eq(users.phone, phone));
  }
  if (!user || !user.otp || !user.otpExpiresAt) return false;
  if (user.otp !== otp) return false;
  if (new Date(user.otpExpiresAt) < new Date()) return false;
  // Optionally clear OTP after use
  await db.update(users).set({ otp: null, otpExpiresAt: null }).where(eq(users.id, user.id));
  return true;
}

async function sendEmailOTP(email: string, otp: string) {
  // Use nodemailer for demo; replace with SendGrid/Mailgun in prod
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP code is: ${otp}`,
  });
}

async function sendSMSOTP(phone: string, otp: string) {
    
  // Integrate with Twilio or similar in production
  console.log(`Send SMS to ${phone}: Your OTP code is ${otp}`);
}
