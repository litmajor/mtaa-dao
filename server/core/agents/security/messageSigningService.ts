import crypto from 'crypto';
import { Logger } from '../utils/logger';

const logger = new Logger('agent-message-signing');

export interface SignedMessage {
  id: string;
  sender: string;
  recipient: string;
  message: any;
  timestamp: number;
  nonce: string;
  signature: string;
  version: '1.0';
}

export interface SignatureVerificationResult {
  isValid: boolean;
  sender: string;
  timestamp: number;
  message: any;
  error?: string;
}

/**
 * Agent Message Signing Service
 * 
 * Implements HMAC-SHA256 based message signing for inter-agent communication:
 * - Prevents message tampering and forgery
 * - Verifies agent identity
 * - Prevents replay attacks with nonce and timestamp validation
 * - Provides audit trail for all inter-agent communications
 * 
 * Threat Mitigation:
 * - CVE-3: Agent identity spoofing (prevents by signing with agent's private key)
 * - Message tampering (HMAC validation)
 * - Replay attacks (timestamp + nonce validation)
 * - Man-in-the-middle (signature verification)
 */
export class AgentMessageSigner {
  private static readonly MESSAGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly NONCE_LENGTH = 32;
  private static nonceCache = new Set<string>();

  /**
   * Sign a message from one agent to another
   */
  static signMessage(
    sender: string,
    recipient: string,
    message: any,
    senderSecret: string
  ): SignedMessage {
    try {
      const id = crypto.randomUUID();
      const timestamp = Date.now();
      const nonce = crypto.randomBytes(this.NONCE_LENGTH).toString('hex');

      // Create message to sign: {sender}:{recipient}:{timestamp}:{nonce}:{messageHash}
      const messageHash = this.hashMessage(message);
      const signableData = `${sender}:${recipient}:${timestamp}:${nonce}:${messageHash}`;

      // Sign with HMAC-SHA256
      const signature = crypto
        .createHmac('sha256', senderSecret)
        .update(signableData)
        .digest('hex');

      const signedMessage: SignedMessage = {
        id,
        sender,
        recipient,
        message,
        timestamp,
        nonce,
        signature,
        version: '1.0'
      };

      logger.debug('Message signed', {
        id,
        sender,
        recipient,
        nonce,
        timestamp
      });

      return signedMessage;
    } catch (error: any) {
      logger.error('Failed to sign message', { error: error.message });
      throw new Error(`Message signing failed: ${error.message}`);
    }
  }

  /**
   * Verify a signed message
   */
  static verifyMessage(
    signedMessage: SignedMessage,
    senderSecret: string
  ): SignatureVerificationResult {
    try {
      const { id, sender, recipient, message, timestamp, nonce, signature } = signedMessage;

      // 1. Check timestamp - reject if too old
      const now = Date.now();
      const age = now - timestamp;

      if (age < 0) {
        logger.warn('Message has future timestamp', { id, sender, age });
        return {
          isValid: false,
          sender,
          timestamp,
          message,
          error: 'Message has future timestamp'
        };
      }

      if (age > this.MESSAGE_TTL_MS) {
        logger.warn('Message expired', { id, sender, age });
        return {
          isValid: false,
          sender,
          timestamp,
          message,
          error: `Message expired (${age}ms old, max: ${this.MESSAGE_TTL_MS}ms)`
        };
      }

      // 2. Check for replay - verify nonce hasn't been seen before
      if (this.nonceCache.has(nonce)) {
        logger.error('Replay attack detected - nonce already used', { id, sender, nonce });
        return {
          isValid: false,
          sender,
          timestamp,
          message,
          error: 'Message nonce has already been used (replay attack)'
        };
      }

      // 3. Verify signature
      const messageHash = this.hashMessage(message);
      const signableData = `${sender}:${recipient}:${timestamp}:${nonce}:${messageHash}`;

      const expectedSignature = crypto
        .createHmac('sha256', senderSecret)
        .update(signableData)
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        logger.error('Signature verification failed', { id, sender });
        return {
          isValid: false,
          sender,
          timestamp,
          message,
          error: 'Signature verification failed'
        };
      }

      // 4. Add nonce to cache (prevent replay)
      this.nonceCache.add(nonce);

      // Clean up old nonces periodically (in production, use Redis/cache)
      if (this.nonceCache.size > 10000) {
        this.nonceCache.clear();
        logger.info('Nonce cache cleared');
      }

      logger.info('Message verified successfully', {
        id,
        sender,
        recipient,
        age: `${age}ms`
      });

      return {
        isValid: true,
        sender,
        timestamp,
        message
      };
    } catch (error: any) {
      logger.error('Message verification failed', { error: error.message });
      return {
        isValid: false,
        sender: signedMessage.sender,
        timestamp: signedMessage.timestamp,
        message: signedMessage.message,
        error: `Verification error: ${error.message}`
      };
    }
  }

  /**
   * Hash a message to detect tampering
   */
  private static hashMessage(message: any): string {
    try {
      const messageString = typeof message === 'string'
        ? message
        : JSON.stringify(message);

      return crypto
        .createHash('sha256')
        .update(messageString)
        .digest('hex');
    } catch (error: any) {
      throw new Error(`Failed to hash message: ${error.message}`);
    }
  }

  /**
   * Create an inter-agent communication envelope with signature
   */
  static createEnvelope(
    sender: string,
    recipient: string,
    action: string,
    payload: any,
    senderSecret: string
  ): SignedMessage {
    const message = {
      action,
      payload,
      action_type: 'inter_agent_communication'
    };

    return this.signMessage(sender, recipient, message, senderSecret);
  }

  /**
   * Verify agent communication envelope
   */
  static verifyEnvelope(
    envelope: SignedMessage,
    senderSecret: string
  ): SignatureVerificationResult {
    return this.verifyMessage(envelope, senderSecret);
  }

  /**
   * Get signing metadata for audit purposes
   */
  static getSigningMetadata(signedMessage: SignedMessage): Record<string, any> {
    return {
      messageId: signedMessage.id,
      sender: signedMessage.sender,
      recipient: signedMessage.recipient,
      timestamp: new Date(signedMessage.timestamp).toISOString(),
      nonce: signedMessage.nonce.substring(0, 8) + '...',
      signatureLength: signedMessage.signature.length,
      messageSize: JSON.stringify(signedMessage.message).length
    };
  }

  /**
   * Clear nonce cache (useful for testing and maintenance)
   */
  static clearNonceCache(): void {
    const previousSize = this.nonceCache.size;
    this.nonceCache.clear();
    logger.info('Nonce cache cleared', { previousSize });
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): Record<string, any> {
    return {
      noncesCached: this.nonceCache.size,
      maxNonces: 10000,
      ttlMs: this.MESSAGE_TTL_MS,
      nonceLength: this.NONCE_LENGTH
    };
  }
}

/**
 * Agent Authentication Context
 * Stores shared secrets for agent communication
 */
export class AgentAuthContext {
  private static agentSecrets: Map<string, string> = new Map();

  /**
   * Register an agent's secret key
   */
  static registerAgent(agentId: string, secret: string): void {
    if (this.agentSecrets.has(agentId)) {
      logger.warn('Agent secret already registered, overwriting', { agentId });
    }
    this.agentSecrets.set(agentId, secret);
    logger.info('Agent registered', { agentId });
  }

  /**
   * Get agent's secret key
   */
  static getAgentSecret(agentId: string): string | undefined {
    return this.agentSecrets.get(agentId);
  }

  /**
   * Verify agent is registered
   */
  static isAgentRegistered(agentId: string): boolean {
    return this.agentSecrets.has(agentId);
  }

  /**
   * Remove agent registration
   */
  static unregisterAgent(agentId: string): boolean {
    logger.info('Agent unregistered', { agentId });
    return this.agentSecrets.delete(agentId);
  }

  /**
   * Get all registered agents
   */
  static getRegisteredAgents(): string[] {
    return Array.from(this.agentSecrets.keys());
  }

  /**
   * Clear all registrations (for testing)
   */
  static clearAll(): void {
    logger.warn('Clearing all agent registrations');
    this.agentSecrets.clear();
  }
}
