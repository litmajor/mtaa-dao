/**
 * Agent Message Signing Service Tests
 * 
 * Tests for HMAC-SHA256 signing, signature verification, replay prevention, and agent auth
 * Risk class: P0 - Agent identity spoofing prevention (CVE-3)
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock Logger FIRST before importing anything that uses it
vi.mock('../../shared/config.ts', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret',
  },
}));

vi.mock('../utils/logger', () => {
  class MockLogger {
    debug = vi.fn();
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    constructor(_name: string) {}
  }
  return { Logger: MockLogger };
});

import {
  AgentMessageSigner,
  AgentAuthContext,
  SignedMessage,
} from '../core/agents/security/messageSigningService';

describe('AgentMessageSigner - Message Signing', () => {
  const senderAgent = 'ANALYZER';
  const recipientAgent = 'DEFENDER';
  const senderSecret = 'analyzer-secret-key-12345';
  const testMessage = {
    action: 'verify_proposal',
    proposalId: 'prop-123',
    data: { amount: 1000, recipient: 'addr-456' },
  };

  beforeEach(() => {
    // Clear nonce cache before each test
    AgentMessageSigner.clearNonceCache();
  });

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
    expect(signedMessage.version).toBe('1.0');
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

  it('should handle complex message objects', () => {
    const complexMessage = {
      action: 'execute_proposal',
      proposal: {
        id: 'prop-456',
        type: 'treasury_transfer',
        details: {
          amount: 50000,
          recipient: 'addr-789',
          currency: 'USDC',
        },
      },
      metadata: {
        priority: 'high',
        requiredSignatures: 3,
      },
    };

    const signedMessage = AgentMessageSigner.signMessage(
      senderAgent,
      recipientAgent,
      complexMessage,
      senderSecret
    );

    expect(signedMessage.message).toEqual(complexMessage);
    expect(signedMessage.signature.length).toBeGreaterThan(0);
  });

  it('should handle string messages', () => {
    const stringMessage = 'Simple message content';

    const signedMessage = AgentMessageSigner.signMessage(
      senderAgent,
      recipientAgent,
      stringMessage,
      senderSecret
    );

    expect(signedMessage.message).toBe(stringMessage);
    expect(signedMessage.signature.length).toBeGreaterThan(0);
  });

  it('should throw error if signing fails', () => {
    expect(() => {
      AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        null as any
      );
    }).toThrow();
  });
});

describe('AgentMessageSigner - Message Verification', () => {
  const senderAgent = 'ANALYZER';
  const recipientAgent = 'DEFENDER';
  const senderSecret = 'analyzer-secret-key-12345';
  const testMessage = {
    action: 'verify_proposal',
    proposalId: 'prop-123',
    data: { amount: 1000, recipient: 'addr-456' },
  };

  beforeEach(() => {
    AgentMessageSigner.clearNonceCache();
  });

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
    const tamperedMessage = {
      ...signedMessage,
      message: { ...testMessage, proposalId: 'prop-999' },
    };

    const result = AgentMessageSigner.verifyMessage(
      tamperedMessage,
      senderSecret
    );

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Signature verification failed');
  });

  it('should reject message with tampered signature', () => {
    const signedMessage = AgentMessageSigner.signMessage(
      senderAgent,
      recipientAgent,
      testMessage,
      senderSecret
    );

    // Tamper with signature
    const tamperedMessage = {
      ...signedMessage,
      signature: signedMessage.signature
        .split('')
        .reverse()
        .join(''),
    };

    const result = AgentMessageSigner.verifyMessage(
      tamperedMessage,
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

describe('AgentMessageSigner - Timestamp Validation', () => {
  const senderAgent = 'ANALYZER';
  const recipientAgent = 'DEFENDER';
  const senderSecret = 'analyzer-secret-key-12345';
  const testMessage = { action: 'test' };

  beforeEach(() => {
    AgentMessageSigner.clearNonceCache();
  });

  it('should reject messages with future timestamp', () => {
    const signedMessage = AgentMessageSigner.signMessage(
      senderAgent,
      recipientAgent,
      testMessage,
      senderSecret
    );

    // Set timestamp to future
    const futureMessage = {
      ...signedMessage,
      timestamp: Date.now() + 10000,
    };

    const result = AgentMessageSigner.verifyMessage(
      futureMessage,
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
    const expiredMessage = {
      ...signedMessage,
      timestamp: Date.now() - 6 * 60 * 1000,
    };

    const result = AgentMessageSigner.verifyMessage(
      expiredMessage,
      senderSecret
    );

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('should accept messages within TTL window (near-boundary test)', () => {
    // Use fake timers to properly test TTL boundary
    const baseTime = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    const senderAgent = 'ANALYZER';
    const recipientAgent = 'DEFENDER';
    const senderSecret = 'analyzer-secret-key-12345';
    const testMessage = { action: 'test' };

    try {
      // Sign message at baseTime
      const signedMessage = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      // Advance time by 4 minutes 59 seconds (just under TTL)
      vi.advanceTimersByTime((4 * 60 + 59) * 1000);

      const result = AgentMessageSigner.verifyMessage(
        signedMessage,
        senderSecret
      );

      // Should still be valid (not yet at 5 minute boundary)
      expect(result.isValid).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should reject messages just beyond TTL boundary (5 min 1 sec)', () => {
    // Use fake timers to properly test TTL boundary
    const baseTime = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    const senderAgent = 'ANALYZER';
    const recipientAgent = 'DEFENDER';
    const senderSecret = 'analyzer-secret-key-12345';
    const testMessage = { action: 'test' };

    try {
      // Sign message at baseTime
      const signedMessage = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );

      // Advance time by 5 minutes 1 second (just past TTL)
      vi.advanceTimersByTime((5 * 60 + 1) * 1000);

      const result = AgentMessageSigner.verifyMessage(
        signedMessage,
        senderSecret
      );

      // Should be expired
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('expired');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('AgentMessageSigner - Replay Attack Prevention', () => {
  const senderAgent = 'ANALYZER';
  const recipientAgent = 'DEFENDER';
  const senderSecret = 'analyzer-secret-key-12345';
  const testMessage = { action: 'test' };

  beforeEach(() => {
    AgentMessageSigner.clearNonceCache();
  });

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

  it('should track multiple nonces', () => {
    const messages = Array.from({ length: 5 }, () =>
      AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      )
    );

    // All should verify successfully
    const results = messages.map(msg =>
      AgentMessageSigner.verifyMessage(msg, senderSecret)
    );

    results.forEach(result => {
      expect(result.isValid).toBe(true);
    });

    // All replays should fail
    const replayResults = messages.map(msg =>
      AgentMessageSigner.verifyMessage(msg, senderSecret)
    );

    replayResults.forEach(result => {
      expect(result.isValid).toBe(false);
    });
  });

  it('should cache and clean up nonces', () => {
    const statsBefore = AgentMessageSigner.getCacheStats();

    // Create and verify messages
    for (let i = 0; i < 10; i++) {
      const msg = AgentMessageSigner.signMessage(
        senderAgent,
        recipientAgent,
        testMessage,
        senderSecret
      );
      AgentMessageSigner.verifyMessage(msg, senderSecret);
    }

    const statsAfter = AgentMessageSigner.getCacheStats();
    expect(statsAfter.noncesCached).toBe(10);

    AgentMessageSigner.clearNonceCache();

    const statsCleared = AgentMessageSigner.getCacheStats();
    expect(statsCleared.noncesCached).toBe(0);
  });
});

describe('AgentMessageSigner - Inter-Agent Communication Envelopes', () => {
  const senderAgent = 'ANALYZER';
  const recipientAgent = 'DEFENDER';
  const senderSecret = 'analyzer-secret-key-12345';

  beforeEach(() => {
    AgentMessageSigner.clearNonceCache();
  });

  it('should create communication envelope', () => {
    const envelope = AgentMessageSigner.createEnvelope(
      senderAgent,
      recipientAgent,
      'verify_proposal',
      { proposalId: 'prop-123' },
      senderSecret
    );

    expect(envelope).toHaveProperty('signature');
    expect(envelope.message.action).toBe('verify_proposal');
    expect(envelope.message.action_type).toBe('inter_agent_communication');
  });

  it('should verify communication envelope', () => {
    const envelope = AgentMessageSigner.createEnvelope(
      senderAgent,
      recipientAgent,
      'execute_proposal',
      { proposalId: 'prop-456' },
      senderSecret
    );

    const result = AgentMessageSigner.verifyEnvelope(envelope, senderSecret);

    expect(result.isValid).toBe(true);
    expect(result.sender).toBe(senderAgent);
  });
});

describe('AgentMessageSigner - Audit Metadata', () => {
  const senderAgent = 'ANALYZER';
  const recipientAgent = 'DEFENDER';
  const senderSecret = 'analyzer-secret-key-12345';
  const testMessage = { action: 'test', data: 'sensitive' };

  beforeEach(() => {
    AgentMessageSigner.clearNonceCache();
  });

  it('should provide signing metadata', () => {
    const signedMessage = AgentMessageSigner.signMessage(
      senderAgent,
      recipientAgent,
      testMessage,
      senderSecret
    );

    const metadata = AgentMessageSigner.getSigningMetadata(signedMessage);

    expect(metadata).toHaveProperty('messageId');
    expect(metadata).toHaveProperty('sender');
    expect(metadata).toHaveProperty('recipient');
    expect(metadata).toHaveProperty('timestamp');
    expect(metadata).toHaveProperty('nonce');
    expect(metadata).toHaveProperty('signatureLength');
    expect(metadata).toHaveProperty('messageSize');
    expect(metadata.messageId).toBe(signedMessage.id);
    expect(metadata.sender).toBe(senderAgent);
  });

  it('should mask nonce in metadata', () => {
    const signedMessage = AgentMessageSigner.signMessage(
      senderAgent,
      recipientAgent,
      testMessage,
      senderSecret
    );

    const metadata = AgentMessageSigner.getSigningMetadata(signedMessage);

    // Nonce should be masked
    expect(metadata.nonce).toContain('...');
    expect(metadata.nonce).not.toBe(signedMessage.nonce);
    expect(metadata.nonce.length).toBeLessThan(signedMessage.nonce.length);
  });
});

describe('AgentMessageSigner - Cache Management', () => {
  beforeEach(() => {
    AgentMessageSigner.clearNonceCache();
  });

  it('should provide cache statistics', () => {
    const stats = AgentMessageSigner.getCacheStats();

    expect(stats).toHaveProperty('noncesCached');
    expect(stats).toHaveProperty('maxNonces');
    expect(stats).toHaveProperty('ttlMs');
    expect(stats).toHaveProperty('nonceLength');
    expect(stats.ttlMs).toBe(5 * 60 * 1000);
    expect(stats.nonceLength).toBe(32);
  });

  it('should clear nonce cache', () => {
    const msg = AgentMessageSigner.signMessage(
      'ANALYZER',
      'DEFENDER',
      { test: 'data' },
      'secret'
    );
    AgentMessageSigner.verifyMessage(msg, 'secret');

    const statsBefore = AgentMessageSigner.getCacheStats();
    expect(statsBefore.noncesCached).toBeGreaterThan(0);

    AgentMessageSigner.clearNonceCache();

    const statsAfter = AgentMessageSigner.getCacheStats();
    expect(statsAfter.noncesCached).toBe(0);
  });
});

describe('AgentAuthContext - Agent Registration', () => {
  beforeEach(() => {
    AgentAuthContext.clearAll();
  });

  afterEach(() => {
    AgentAuthContext.clearAll();
  });

  it('should register an agent', () => {
    AgentAuthContext.registerAgent('ANALYZER', 'analyzer-secret-12345');

    expect(AgentAuthContext.isAgentRegistered('ANALYZER')).toBe(true);
    expect(AgentAuthContext.getAgentSecret('ANALYZER')).toBe(
      'analyzer-secret-12345'
    );
  });

  it('should get agent secret', () => {
    AgentAuthContext.registerAgent('DEFENDER', 'defender-secret-67890');

    const secret = AgentAuthContext.getAgentSecret('DEFENDER');
    expect(secret).toBe('defender-secret-67890');
  });

  it('should verify agent registration', () => {
    AgentAuthContext.registerAgent('RELAY', 'relay-secret-xyz');

    expect(AgentAuthContext.isAgentRegistered('RELAY')).toBe(true);
    expect(AgentAuthContext.isAgentRegistered('NONEXISTENT')).toBe(false);
  });

  it('should unregister agent', () => {
    AgentAuthContext.registerAgent('SCOUT', 'scout-secret-123');
    expect(AgentAuthContext.isAgentRegistered('SCOUT')).toBe(true);

    const result = AgentAuthContext.unregisterAgent('SCOUT');
    expect(result).toBe(true);
    expect(AgentAuthContext.isAgentRegistered('SCOUT')).toBe(false);
  });

  it('should return undefined for unregistered agent', () => {
    const secret = AgentAuthContext.getAgentSecret('UNKNOWN');
    expect(secret).toBeUndefined();
  });

  it('should get all registered agents', () => {
    AgentAuthContext.registerAgent('AGENT1', 'secret1');
    AgentAuthContext.registerAgent('AGENT2', 'secret2');
    AgentAuthContext.registerAgent('AGENT3', 'secret3');

    const agents = AgentAuthContext.getRegisteredAgents();
    expect(agents).toContain('AGENT1');
    expect(agents).toContain('AGENT2');
    expect(agents).toContain('AGENT3');
    expect(agents.length).toBe(3);
  });

  it('should clear all registrations', () => {
    AgentAuthContext.registerAgent('AGENT1', 'secret1');
    AgentAuthContext.registerAgent('AGENT2', 'secret2');

    let agents = AgentAuthContext.getRegisteredAgents();
    expect(agents.length).toBe(2);

    AgentAuthContext.clearAll();

    agents = AgentAuthContext.getRegisteredAgents();
    expect(agents.length).toBe(0);
  });

  it('should handle re-registration of same agent', () => {
    AgentAuthContext.registerAgent('ANALYZER', 'secret-old');
    AgentAuthContext.registerAgent('ANALYZER', 'secret-new');

    expect(AgentAuthContext.getAgentSecret('ANALYZER')).toBe('secret-new');
    expect(AgentAuthContext.getRegisteredAgents().length).toBe(1);
  });
});
