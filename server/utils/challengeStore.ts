/**
 * Simple in-memory challenge store for server-issued wallet import challenges.
 * Stores a short-lived nonce per user (or address) with expiry and allows
 * single-use validation and consumption.
 */

type ChallengeEntry = {
  userId?: string;
  address?: string;
  nonce: string;
  expiresAt: number;
};

const challenges = new Map<string, ChallengeEntry>();

// Cleanup interval (ms)
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
const CHALLENGE_TTL = 5 * 60 * 1000; // 5 minutes

function makeKey(userId?: string, address?: string) {
  if (userId) return `u:${userId}`;
  if (address) return `a:${address.toLowerCase()}`;
  return `g:global`;
}

function generateNonce() {
  return Math.floor(Math.random() * 1e12).toString(36);
}

export function createChallenge(opts: { userId?: string; address?: string }) {
  const key = makeKey(opts.userId, opts.address);
  const nonce = generateNonce();
  const expiresAt = Date.now() + CHALLENGE_TTL;
  const entry: ChallengeEntry = { userId: opts.userId, address: opts.address, nonce, expiresAt };
  challenges.set(key, entry);
  return { nonce, expiresAt, message: `MtaaDAO wallet import verification\naddress: ${opts.address || 'unknown'}\nnonce: ${nonce}\nexpiresAt: ${expiresAt}` };
}

export function getChallenge(opts: { userId?: string; address?: string }) {
  const key = makeKey(opts.userId, opts.address);
  const entry = challenges.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    challenges.delete(key);
    return null;
  }
  return entry;
}

export function validateAndConsume(opts: { userId?: string; address?: string; nonce: string }) {
  const key = makeKey(opts.userId, opts.address);
  const entry = challenges.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    challenges.delete(key);
    return false;
  }
  if (entry.nonce !== opts.nonce) return false;
  // consume
  challenges.delete(key);
  return true;
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of challenges.entries()) {
    if (v.expiresAt <= now) challenges.delete(k);
  }
}, CLEANUP_INTERVAL).unref?.();

export default { createChallenge, getChallenge, validateAndConsume };
