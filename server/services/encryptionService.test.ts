import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));
vi.mock('libsodium-wrappers', () => {
  const encoder = new TextEncoder();
  const sodium = {
    ready: Promise.resolve(),
    randombytes_buf: (length: number) => new Uint8Array(length).fill(7),
    crypto_secretbox_easy: (plaintext: string) => {
      const bytes = encoder.encode(plaintext);
      const result = new Uint8Array(bytes.length + 16);
      result.set(bytes);
      return result;
    },
    crypto_secretbox_open_easy: (ciphertext: Uint8Array) => ciphertext.slice(0, -16),
    to_string: (bytes: Uint8Array) => new TextDecoder().decode(bytes),
    to_hex: (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  };
  return { default: sodium };
});

import { decrypt, encrypt, isEncryptionKeyConfigured } from './encryptionService';

const keyHex = '7f'.repeat(32);

beforeEach(() => {
  delete process.env.ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY_V1;
  delete process.env.ENCRYPTION_KEY_V2;
  process.env.ENCRYPTION_KEY_VERSION = '1';
});

describe('encryptionService', () => {
  it('rejects malformed hex keys instead of silently decoding partial bytes', () => {
    process.env.ENCRYPTION_KEY_VERSION = '41';
    process.env.ENCRYPTION_KEY_V41 = 'z'.repeat(64);

    expect(isEncryptionKeyConfigured()).toBe(false);
    return expect(encrypt('secret')).rejects.toThrow(/64 hexadecimal characters/);
  });

  it('encrypts with a key-version header and decrypts the plaintext', async () => {
    process.env.ENCRYPTION_KEY_VERSION = '42';
    process.env.ENCRYPTION_KEY_V42 = keyHex;

    const ciphertext = await encrypt('private credential');
    expect(ciphertext.subarray(0, 8).toString('ascii')).toBe('MTAAKEY1');
    expect(ciphertext[8]).toBe(42);
    await expect(decrypt(ciphertext)).resolves.toBe('private credential');
  });

  it('decrypts old and new ciphertexts while rotating the active key version', async () => {
    process.env.ENCRYPTION_KEY = keyHex;
    process.env.ENCRYPTION_KEY_V2 = '8a'.repeat(32);
    process.env.ENCRYPTION_KEY_VERSION = '1';
    const oldCiphertext = await encrypt('old key');

    process.env.ENCRYPTION_KEY_VERSION = '2';
    const newCiphertext = await encrypt('new key');

    await expect(decrypt(oldCiphertext)).resolves.toBe('old key');
    await expect(decrypt(newCiphertext)).resolves.toBe('new key');
  });

  it('continues to decrypt existing legacy nonce-prefixed ciphertexts', async () => {
    process.env.ENCRYPTION_KEY = keyHex;
    const nonce = Buffer.alloc(24, 7);
    const payload = Buffer.concat([Buffer.from('legacy credential'), Buffer.alloc(16)]);
    const legacyCiphertext = Buffer.concat([nonce, payload]);

    await expect(decrypt(legacyCiphertext)).resolves.toBe('legacy credential');
  });
});
