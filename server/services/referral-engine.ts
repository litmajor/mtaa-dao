import crypto from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db';
import { telegramReferralAttributions, users } from '../../shared/schema';

const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const signingSecretEnv = process.env.TELEGRAM_REFERRAL_SECRET || process.env.JWT_SECRET;

function getSigningSecret(): string {
  if (!signingSecretEnv) {
    throw new Error('TELEGRAM_REFERRAL_SECRET or JWT_SECRET is required for referral attribution');
  }
  return signingSecretEnv;
}

const SIGNING_SECRET = getSigningSecret();

if (!SIGNING_SECRET) {
  throw new Error('TELEGRAM_REFERRAL_SECRET or JWT_SECRET is required for referral attribution');
}

function sign(referrerId: string, issuedAt: number): string {
  const payload = `${referrerId}.${issuedAt}`;
  const signature = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

function verify(token: string): { referrerId: string; issuedAt: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [referrerId, issuedAtText, signature] = decoded.split('.');
    const issuedAt = Number(issuedAtText);
    if (!referrerId || !Number.isFinite(issuedAt) || !signature || Date.now() - issuedAt > ATTRIBUTION_TTL_MS) return null;
    const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(`${referrerId}.${issuedAt}`).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    return { referrerId, issuedAt };
  } catch {
    return null;
  }
}

export async function createTelegramReferralLink(referrerId: string): Promise<string> {
  const referrer = await db.query.users.findFirst({ where: eq(users.id, referrerId) });
  if (!referrer) throw new Error('Referrer not found');
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'MtaaDAO_Bot';
  return `https://t.me/${botUsername}?start=ref_${sign(referrerId, Date.now())}`;
}

export async function recordTelegramStartAttribution(telegramUserId: number | string, token: string): Promise<boolean> {
  const attribution = verify(token);
  if (!attribution) return false;
  const referrer = await db.query.users.findFirst({ where: eq(users.id, attribution.referrerId) });
  if (!referrer || String(telegramUserId) === referrer.telegramId) return false;

  await db.insert(telegramReferralAttributions).values({
    telegramUserId: String(telegramUserId),
    referrerId: attribution.referrerId,
    token,
    expiresAt: new Date(attribution.issuedAt + ATTRIBUTION_TTL_MS),
  }).onConflictDoUpdate({
    target: telegramReferralAttributions.telegramUserId,
    set: { referrerId: attribution.referrerId, token, expiresAt: new Date(attribution.issuedAt + ATTRIBUTION_TTL_MS), used: false },
  });
  return true;
}

export async function consumeTelegramStartAttribution(telegramUserId: number | string, referredUserId: string): Promise<string | null> {
  const telegramId = String(telegramUserId);
  const attribution = await db.query.telegramReferralAttributions.findFirst({
    where: and(
      eq(telegramReferralAttributions.telegramUserId, telegramId),
      eq(telegramReferralAttributions.used, false),
      gt(telegramReferralAttributions.expiresAt, new Date()),
    ),
  });
  if (!attribution || attribution.referrerId === referredUserId) return null;

  await db.update(users).set({ referredBy: attribution.referrerId, updatedAt: new Date() }).where(eq(users.id, referredUserId));
  await db.update(telegramReferralAttributions).set({ used: true, usedAt: new Date() }).where(eq(telegramReferralAttributions.id, attribution.id));
  return attribution.referrerId;
}
