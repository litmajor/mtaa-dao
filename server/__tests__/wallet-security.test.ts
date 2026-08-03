import { describe, it, expect } from 'vitest';
import { encryptSensitiveData, decryptSensitiveData } from '../utils/sensitiveDataEncryption';
import challengeStore from '../utils/challengeStore';

describe('wallet security hardening', () => {
  it('uses the supplied master secret for encryption and rejects mismatched secrets', () => {
    const encrypted = encryptSensitiveData('super-secret-seed-phrase', 'user-password' as any);

    expect(decryptSensitiveData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag, 'user-password' as any)).toBe('super-secret-seed-phrase');
    expect(() => decryptSensitiveData(encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag, 'wrong-password' as any)).toThrow(/Failed to decrypt data/i);
  });

  it('keeps nonce challenges scoped per address rather than overwriting them for the same user', () => {
    const first = challengeStore.createChallenge({ userId: 'user-1', address: '0xaaa' });
    const second = challengeStore.createChallenge({ userId: 'user-1', address: '0xbbb' });

    expect(challengeStore.validateAndConsume({ userId: 'user-1', address: '0xaaa', nonce: first.nonce })).toBe(true);
    expect(challengeStore.validateAndConsume({ userId: 'user-1', address: '0xbbb', nonce: second.nonce })).toBe(true);
  });
});
