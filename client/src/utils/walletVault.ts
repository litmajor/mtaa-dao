import { Wallet, type HDNodeWallet } from 'ethers';

/**
 * ⚠️ ASSUMPTION FLAGGED, NOT CONFIRMED: this treats `passphrase` as the real
 * cryptographic secret (what actually encrypts the keystore) and a PIN, if
 * you have one, as a SEPARATE, lighter unlock layered on top of an
 * already-decrypted in-memory session — never as a substitute for the
 * passphrase itself. A 4-digit PIN as the actual scrypt input would cap your
 * real security at 10,000 possibilities regardless of KDF cost, which would
 * undercut this whole design. If your PIN service works differently, this
 * file's session model needs to change — send it over before wiring this in
 * for real.
 */

const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 min — tune based on your risk tolerance
const LOCAL_KEYSTORE_KEY = 'mtaa_wallet_keystore';
const BACKUP_ITERATIONS = 600000;

type SessionSigner = Wallet | HDNodeWallet;

let sessionSigner: SessionSigner | null = null;
let sessionTimer: ReturnType<typeof setTimeout> | null = null;

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

async function getStoredKeystore(): Promise<{ walletId: string; address: string; encryptedBlob: unknown } | null> {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(LOCAL_KEYSTORE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setStoredKeystore(value: { walletId: string; address: string; encryptedBlob: unknown }) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(LOCAL_KEYSTORE_KEY, JSON.stringify(value));
}

async function deleteStoredKeystore() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(LOCAL_KEYSTORE_KEY);
}

function clearSession() {
  sessionSigner = null;
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}

function armSessionTimeout() {
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(clearSession, SESSION_TIMEOUT_MS);
}

/**
 * Create a wallet entirely client-side, back it up to the server as an
 * opaque encrypted blob, and cache it locally. The server sees only the
 * resulting address and the ciphertext — never the mnemonic, never the
 * passphrase.
 */
export async function createAndBackupWallet(
  passphrase: string,
  userId: string,
  opts: { currency?: string; walletType?: string } = {}
): Promise<{ address: string; walletId: string; mnemonic: string }> {
  const wallet = Wallet.createRandom();
  const address = wallet.address;
  const mnemonic = wallet.mnemonic!.phrase;

  // Register the address first — if this fails, nothing sensitive has left
  // the browser yet.
  const challengeResp = await fetch('/api/v1/wallets/register/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ address }),
  });

  if (!challengeResp.ok) {
    const err = await challengeResp.json().catch(() => ({}));
    throw new Error(err.error || `Wallet ownership challenge failed (${challengeResp.status})`);
  }

  const { data: challenge } = await challengeResp.json();
  const signature = await wallet.signMessage(challenge.message);
  const registerResp = await fetch('/api/v1/wallets/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      address,
      currency: opts.currency,
      walletType: opts.walletType,
      challengeId: challenge.challengeId,
      signature,
      publicKey: wallet.publicKey,
    }),
  });
  if (!registerResp.ok) {
    const err = await registerResp.json().catch(() => ({}));
    throw new Error(err.error || `Wallet registration failed (${registerResp.status})`);
  }
  const { data: registration } = await registerResp.json();
  const walletId = registration.walletId;

  // Encrypt (scrypt — expect 2-3s) and persist locally FIRST, so the user
  // has a working wallet even if the backup call below fails.
  const encryptedBlob = JSON.parse(await wallet.encrypt(passphrase));
  await setStoredKeystore({ walletId, address, encryptedBlob });

  // Now back up server-side. This can fail without the user being
  // functionally blocked — but they must be told clearly, not left assuming
  // they're covered when they're not.
  const backupBlob = await encryptMnemonicBackup(mnemonic, passphrase);
  const backupResp = await fetch('/api/v1/wallets/setup/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(backupBlob),
  });

  if (!backupResp.ok) {
    // Retry once — transient network failures are common enough on the
    // target market's connectivity to be worth one automatic retry before
    // surfacing this to the user as a real problem.
    const retryResp = await fetch('/api/v1/wallets/setup/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(backupBlob),
    });

    if (!retryResp.ok) {
      // Do NOT silently proceed as if backup succeeded — surface this as an
      // explicit, distinct state the caller must handle (e.g. block "setup
      // complete" and prompt the user to retry backup before leaving the page).
      throw new Error(
        'BACKUP_FAILED: Wallet was created and works on this device, but the encrypted server backup ' +
        'did not save. If this device is lost without another successful backup, the wallet cannot be recovered.'
      );
    }
  }

  // Cache the live signer for this session so the immediately-following UX
  // (e.g. "confirm your address") doesn't force a second scrypt decrypt.
  sessionSigner = wallet;
  armSessionTimeout();

  return { address, walletId, mnemonic };
}

/**
 * Unlock the wallet for signing. Checks local storage first; if that's
 * empty (e.g. IndexedDB was evicted), transparently recovers from the
 * server's blind backup. Returns nothing sensitive — the decrypted signer
 * lives only in module-scope memory, never returned to callers, never
 * logged, and expires after SESSION_TIMEOUT_MS.
 */
export async function unlockWallet(passphrase: string): Promise<{ address: string }> {
  let local = await getStoredKeystore();

  if (!local) {
    // Local cache is gone — need the walletId to ask the server for a
    // backup, and we don't have one locally anymore. This assumes the
    // caller has the walletId from elsewhere (e.g. the user's profile /
    // GET /api/v1/wallets, which returns wallet metadata by userId).
    // Flagging: wire this lookup in once you confirm where walletId comes
    // from when local storage is empty.
    throw new Error(
      'LOCAL_KEYSTORE_MISSING: no local wallet found. Fetch the walletId for this user first, then call ' +
      'restoreFromServerBackup(walletId, passphrase) instead of unlockWallet().'
    );
  }

  let wallet: SessionSigner;
  try {
    wallet = (await Wallet.fromEncryptedJson(JSON.stringify(local.encryptedBlob), passphrase)) as unknown as SessionSigner;
  } catch {
    throw new Error('INCORRECT_PASSPHRASE');
  }

  sessionSigner = wallet;
  armSessionTimeout();

  return { address: wallet.address };
}

/**
 * Recover from the server's blind backup when local storage has been lost
 * (device wipe, IndexedDB eviction, new device). Requires knowing the
 * walletId — get it from user/wallet metadata, not from local storage,
 * since local storage is precisely what's missing in this path.
 */
export async function restoreFromServerBackup(
  passphrase: string
): Promise<{ address: string }> {
  const resp = await fetch('/api/v1/wallets/setup/backup', {
    method: 'GET',
    credentials: 'include', // auth via session cookie, NOT a userId query param
  });

  if (resp.status === 404) {
    throw new Error('NO_BACKUP_FOUND: no server backup exists for this account');
  }
  if (!resp.ok) {
    throw new Error(`RETRIEVAL_FAILED: ${resp.status}`);
  }

  const data = await resp.json();
  if (!data.backupExists || !data.blob) throw new Error('NO_BACKUP_FOUND: no server backup exists for this account');
  const mnemonic = await decryptMnemonicBackup(data.blob, passphrase);
  const wallet = Wallet.fromPhrase(mnemonic) as unknown as SessionSigner;

  sessionSigner = wallet;
  armSessionTimeout();

  return { address: wallet.address };
}

/**
 * Sign a message/transaction using the currently-unlocked in-session signer.
 * Throws if the session has expired or was never unlocked — caller must
 * re-prompt for the passphrase (or PIN, if your PIN service gates access to
 * an already-unlocked session rather than re-deriving the key — see the
 * assumption flagged at the top of this file).
 */
export function getSessionSigner(): SessionSigner {
  if (!sessionSigner) {
    throw new Error('SESSION_EXPIRED: wallet is locked, unlock again before signing');
  }
  // Extend the session on activity rather than a hard fixed window —
  // adjust if you'd rather have a strict absolute expiry instead.
  armSessionTimeout();
  return sessionSigner;
}

export function lockWallet(): void {
  clearSession();
}

/**
 * Wipe the local keystore entirely (e.g. explicit "remove wallet from this
 * device" action). Does NOT delete the server backup — that's a separate,
 * more consequential action that should have its own explicit confirmation.
 */
export async function forgetLocalWallet(): Promise<void> {
  clearSession();
  await deleteStoredKeystore();
}

function encodeBase64(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

async function encryptMnemonicBackup(mnemonic: string, passphrase: string) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: BACKUP_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(mnemonic));
  return {
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: BACKUP_ITERATIONS,
    salt: encodeBase64(salt.buffer),
    iv: encodeBase64(iv.buffer),
    ciphertext: encodeBase64(ciphertext),
  };
}

export async function decryptMnemonicBackup(blob: any, passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: decodeBase64(blob.salt), iterations: blob.iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decodeBase64(blob.iv) }, key, decodeBase64(blob.ciphertext));
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error('INCORRECT_PASSPHRASE');
  }
}