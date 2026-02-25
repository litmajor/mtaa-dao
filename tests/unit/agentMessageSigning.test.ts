import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  AgentMessageSigner,
  AgentAuthContext,
  SignedMessage,
} from '../../../server/core/agents/security/messageSigningService';

/**
 * Test Suite for Agent Message Signing Service
 * Tests HMAC-SHA256 signing, nonce tracking, timestamp validation, and replay prevention
 */
describe('AgentMessageSigner', () => {
  const senderAgent = 'ANALYZER';
  const recipientAgent = 'DEFENDER';
  const senderSecret = 'analyzer-secret-key-12345';
  const recipientSecret = 'defender-secret-key-54321';
  const testMessage = {
    action: 'verify_proposal',
    proposalId: 'prop-123',
    data: { amount: 1000, recipient: 'addr-456' },
  };

  beforeEach(() => {
    // Clear nonce cache before each test
    AgentMessageSigner.clearNonceCache();
  });

  describe('Message Signing', () => {
    it('should sign a message with HMAC-SHA256', () => {
      const signedMessage = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      expect(signedMessage).toHaveProperty('id');
      expect(signedMessage).toHaveProperty('signature');
      expect(signedMessage.sender).toBe(senderAgent);
      expect(signedMessage.recipient).toBe(recipientAgent);
      expect(signedMessage.message).toEqual(testMessage);
      expect(signedMessage.signature.length).toBeGreaterThan(0);
    });

    it('should generate unique ID for each signed message', () => {
      const msg1 = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );
      const msg2 = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      expect(msg1.id).not.toBe(msg2.id);
    });

    it('should generate unique nonce for each signed message', () => {
      const msg1 = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );
      const msg2 = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      expect(msg1.nonce).not.toBe(msg2.nonce);
    });

    it('should include timestamp in signed message', () => {
      const beforeSign = Date.now();
      const signedMessage = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );
      const afterSign = Date.now();

      expect(signedMessage.timestamp).toBeGreaterThanOrEqual(beforeSign);
      expect(signedMessage.timestamp).toBeLessThanOrEqual(afterSign);
    });

    it('should set version to 1.0', () => {
      const signedMessage = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      expect(signedMessage.version).toBe('1.0');
    });
  });

  describe('Message Verification', () => {
    it('should verify a valid signed message', () => {
      const signedMessage = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      const result = AgentMessageSigner.verifyMessage(
        signedMessage,
        senderSecret
      );

      expect(result.isValid).toBe(true);
      expect(result.sender).toBe(senderAgent);
      expect(result.message).toEqual(testMessage);
      expect(result.error).toBeUndefined();
    });

    it('should reject message with tampered payload', () => {
      const signedMessage = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      // Tamper with message
      signedMessage.message.data.amount = 999999;

      const result = AgentMessageSigner.verifyMessage(
        signedMessage,
        senderSecret
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Signature verification failed');
    });

    it('should reject message with wrong secret', () => {
      const signedMessage = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      const result = AgentMessageSigner.verifyMessage(
        signedMessage,
        'wrong-secret'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Signature verification failed');
    });
  });

  describe('Timestamp Validation', () => {
    it('should reject messages with future timestamp', () => {
      const signedMessage = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      // Set timestamp to future
      signedMessage.timestamp = Date.now() + 10000;

      const result = AgentMessageSigner.verifyMessage(
        signedMessage,
        senderSecret
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('future timestamp');
    });

    it('should reject expired messages (>5 minutes old)', () => {
      const signedMessage = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      // Set timestamp to 6 minutes ago
      signedMessage.timestamp = Date.now() - 6 * 60 * 1000;

      const result = AgentMessageSigner.verifyMessage(
        signedMessage,
        senderSecret
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should accept messages within TTL window', () => {
      const signedMessage = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      // Set timestamp to 1 minute ago (within 5 min TTL)
      signedMessage.timestamp = Date.now() - 60 * 1000;

      const result = AgentMessageSigner.verifyMessage(
        signedMessage,
        senderSecret
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('Replay Attack Prevention', () => {
    it('should prevent replay attacks by nonce tracking', () => {
      const signedMessage = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      // First verification should succeed
      const result1 = AgentMessageSigner.verifyMessage(
        signedMessage,
        senderSecret
      );
      expect(result1.isValid).toBe(true);

      // Second verification of same message should fail (replay)
      const result2 = AgentMessageSigner.verifyMessage(
        signedMessage,
        senderSecret
      );
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('already been used');
      expect(result2.error).toContain('replay attack');
    });

    it('should allow same message content with different nonce', () => {
      const msg1 = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      const msg2 = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      const result1 = AgentMessageSigner.verifyMessage(msg1, senderSecret);
      expect(result1.isValid).toBe(true);

      const result2 = AgentMessageSigner.verifyMessage(msg2, senderSecret);
      expect(result2.isValid).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = AgentMessageSigner.getCacheStats();

      expect(stats).toHaveProperty('noncesCached');
      expect(stats).toHaveProperty('maxNonces');
      expect(stats).toHaveProperty('ttlMs');
      expect(stats).toHaveProperty('nonceLength');
      expect(stats.ttlMs).toBe(5 * 60 * 1000);
    });

    it('should clear nonce cache', () => {
      const msg = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );
      AgentMessageSigner.verifyMessage(msg, senderSecret);

      const statsBefore = AgentMessageSigner.getCacheStats();
      expect(statsBefore.noncesCached).toBeGreaterThan(0);

      AgentMessageSigner.clearNonceCache();

      const statsAfter = AgentMessageSigner.getCacheStats();
      expect(statsAfter.noncesCached).toBe(0);

      // Can reuse nonce after cache clear
      const result = AgentMessageSigner.verifyMessage(msg, senderSecret);
      expect(result.isValid).toBe(true);
    });
  });
});

describe('AgentAuthContext', () => {
  beforeEach(() => {
    AgentAuthContext.clearAll();
  });

  it('should register agent with secret', () => {
    AgentAuthContext.registerAgent('ANALYZER', 'analyzer-secret');

    expect(AgentAuthContext.isAgentRegistered('ANALYZER')).toBe(true);
    expect(AgentAuthContext.getAgentSecret('ANALYZER')).toBe('analyzer-secret');
  });

  it('should get registered agents list', () => {
    AgentAuthContext.registerAgent('ANALYZER', 'analyzer-secret');
    AgentAuthContext.registerAgent('DEFENDER', 'defender-secret');

    const agents = AgentAuthContext.getRegisteredAgents();
    expect(agents).toContain('ANALYZER');
    expect(agents).toContain('DEFENDER');
  });

  it('should unregister agent', () => {
    AgentAuthContext.registerAgent('ANALYZER', 'analyzer-secret');
    AgentAuthContext.unregisterAgent('ANALYZER');

    expect(AgentAuthContext.isAgentRegistered('ANALYZER')).toBe(false);
  });

  it('should handle unregistered agent gracefully', () => {
    const secret = AgentAuthContext.getAgentSecret('NONEXISTENT');
    expect(secret).toBeUndefined();
  });
});
