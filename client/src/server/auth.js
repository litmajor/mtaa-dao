/*
// Startup env check
const REQUIRED_ENV_VARS = [
  'DATABASE_URL', 'REDIS_URL', 'SECRET_KEY', 'jWT_SECRET_KEY', 'REPLIT_DOMAINS', 'REPLIT_ENV', 'PORT',
  'REPL_ID', 'SESSION_SECRET', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'RPC_URL', 'PRIVATE_KEY', 'VAULT_CONTRACT_ADDRESS', 'Maono_CONTRACT_ADDRESS', 'CELO_CHAIN_ID',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'PAYPAL_CLIENT_ID', 'PAYSTACK_SECRET_KEY', 'PAYSTACK_PUBLIC_KEY',
  'MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSWORD', 'MPESA_CALLBACK_URL',
  'MPESA_ENVIRONMENT', 'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'
];

const missingVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
  throw new Error('Missing required environment variables: ' + missingVars.join(', '));
}
*/
// routes/api/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { db } = require('../../drizzle.config'); // Drizzle instance
const { superusers, audit_logs } = require('../../shared/schema'); // Drizzle table schemas

// Helper: Audit log function (persist to DB)
async function logSuperuserAction(action, details, req) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const logEntry = {
    timestamp: new Date(),
    action,
    ip,
    details: JSON.stringify(details)
  };
  try {
    await db.insert(audit_logs).values(logEntry);
  } catch (err) {
    console.error('Failed to persist audit log:', err);
  }
  console.log(`[AUDIT] ${logEntry.timestamp.toISOString()} | ${action} | IP: ${ip} | Details:`, details);
}

// Helper: Notification (send email)
async function notifySuperuserEvent(type, details) {
  // Configure nodemailer (use your SMTP credentials)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: process.env.SUPERUSER_NOTIFY_EMAIL,
    subject: `[Superuser Event] ${type}`,
    text: `Event: ${type}\nDetails: ${JSON.stringify(details, null, 2)}`
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Failed to send notification email:', err);
  }
  console.log(`[NOTIFY] ${type}:`, details);
}

// Allowed IPs for superuser actions (add your trusted IPs or CIDR)
const ALLOWED_IPS = ['127.0.0.1', '::1']; // Add more as needed
function isAllowedIP(ip) {
  // Add CIDR/range logic if needed
  return ALLOWED_IPS.includes(ip);
}
// Rate limiting middleware for superuser endpoints
const superuserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many attempts, please try again later.'
});

router.post('/create-superuser', superuserLimiter, async (req, res) => {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  // Restrict by IP
  if (!isAllowedIP(ip)) {
    await logSuperuserAction('CREATE_ATTEMPT_BLOCKED', { email, ip }, req);
    return res.status(403).json({ message: 'Access denied' });
  }

  // Prevent creation if more than two superusers exist
  const countResult = await db.select().from(superusers);
  if (countResult.length >= 2) {
    await logSuperuserAction('CREATE_ATTEMPT_LIMIT', { email, ip }, req);
    return res.status(403).json({ message: 'Superuser limit reached' });
  }

  // Check if superuser already exists
  const exists = await db.select().from(superusers).where({ email });
  if (exists.length > 0) {
    await logSuperuserAction('CREATE_ATTEMPT_DUPLICATE', { email, ip }, req);
    return res.status(409).json({ message: 'Superuser already exists' });
  }

  const hash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(superusers).values({ email, password: hash }).returning();
  await logSuperuserAction('CREATE_SUCCESS', { email, ip }, req);
  await notifySuperuserEvent('SuperuserCreated', { email, ip });
  res.status(201).json({ message: 'Superuser created', user: { email: user.email } });
});

// Superuser login
router.post('/admin-login', superuserLimiter, async (req, res) => {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  // Restrict by IP
  if (!isAllowedIP(ip)) {
    await logSuperuserAction('LOGIN_ATTEMPT_BLOCKED', { email, ip }, req);
    return res.status(403).json({ message: 'Access denied' });
  }
  const userArr = await db.select().from(superusers).where({ email });
  const user = userArr[0];
  if (!user) {
    await logSuperuserAction('LOGIN_ATTEMPT_INVALID_USER', { email, ip }, req);
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    await logSuperuserAction('LOGIN_ATTEMPT_INVALID_PASSWORD', { email, ip }, req);
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  await logSuperuserAction('LOGIN_SUCCESS', { email, ip }, req);
  await notifySuperuserEvent('SuperuserLogin', { email, ip });
  // Set session/cookie/JWT here as needed
  res.json({ message: 'Login successful', user: { email: user.email } });
});

module.exports = router;