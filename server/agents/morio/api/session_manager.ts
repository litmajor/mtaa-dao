/**
 * Session Manager
 * 
 * Manages user sessions, context, and conversation state
 */

import type { Session } from '../types';
import type { UserContext } from '../../../core/nuru/types';
import { storage } from '../../../storage';
import { randomUUID } from 'crypto';

export class SessionManager {
  private sessions: Map<string, Session>;
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.sessions = new Map();
    this.cleanupTimer = this.startCleanupTimer();
  }

  private getSessionKey(userId: string, daoId?: string): string {
    return `${userId}:${daoId ?? 'default'}`;
  }

  /**
   * Get or create session for user
   */
  async getSession(userId: string, daoId?: string): Promise<Session> {
    return (await this.getOrCreateSession(userId, daoId)).session;
  }

  async findSession(userId: string, daoId?: string): Promise<Session | null> {
    const key = daoId === undefined
      ? Array.from(this.sessions.keys()).find(candidate => candidate.startsWith(`${userId}:`))
      : this.getSessionKey(userId, daoId);
    if (!key) return null;
    const session = this.sessions.get(key);
    if (!session || !this.isSessionValid(session)) {
      this.sessions.delete(key);
      return null;
    }
    return session;
  }

  async getOrCreateSession(userId: string, daoId?: string): Promise<{ session: Session; created: boolean }> {
    const sessionKey = this.getSessionKey(userId, daoId);
    const existingSession = this.sessions.get(sessionKey);
    
    if (existingSession && this.isSessionValid(existingSession)) {
      return { session: existingSession, created: false };
    }

    // Create new session
    const newSession: Session = {
      id: `session_${userId}_${daoId ?? 'default'}_${randomUUID()}`,
      userId,
      daoId,
      context: this.createDefaultContext(userId, daoId),
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata: {}
    };

    this.sessions.set(sessionKey, newSession);
    // Persist initial session snapshot for durability (use generic audit log)
    try {
      await storage.createAuditLog({
        action: 'session_created',
        resource: 'morio_session',
        resourceId: newSession.id,
        userId,
        method: 'internal',
        endpoint: 'morio.session.create',
        ipAddress: '127.0.0.1',
        userAgent: 'morio-agent',
        status: 200,
        category: 'session',
        severity: 'info',
        details: { userId, sessionId: newSession.id, snapshot: newSession }
      });
    } catch (e) {
      console.warn('Failed to persist session snapshot:', e);
    }
    return { session: newSession, created: true };
  }

  /**
   * Update session with new data
   */
  async updateSession(userId: string, updates: Partial<Session['metadata']>, daoId?: string, context?: UserContext): Promise<void> {
    const sessionKey = this.getSessionKey(userId, daoId);
    const session = this.sessions.get(sessionKey);
    if (!session) return;

    session.metadata = {
      ...session.metadata,
      ...updates
    };
    if (context) session.context = context;
    session.lastActivity = new Date();

    this.sessions.set(sessionKey, session);
    // Persist updated session metadata for longer-term memory (use generic audit log)
    try {
      await storage.createAuditLog({
        action: 'session_updated',
        resource: 'morio_session',
        resourceId: session.id,
        userId,
        method: 'internal',
        endpoint: 'morio.session.update',
        ipAddress: '127.0.0.1',
        userAgent: 'morio-agent',
        status: 200,
        category: 'session',
        severity: 'info',
        details: { userId, sessionId: session.id, snapshot: session, updates }
      });
    } catch (e) {
      console.warn('Failed to persist session update:', e);
    }
  }

  /**
   * Clear user session
   */
  async clearSession(userId: string, daoId?: string): Promise<void> {
    if (daoId !== undefined) {
      this.sessions.delete(this.getSessionKey(userId, daoId));
      return;
    }
    for (const [key, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(key);
    }
  }

  /**
   * Check if session is still valid
   */
  private isSessionValid(session: Session): boolean {
    const now = Date.now();
    const lastActivity = session.lastActivity.getTime();
    return (now - lastActivity) < this.sessionTimeout;
  }

  /**
   * Create default user context
   */
  private createDefaultContext(userId: string, daoId?: string): UserContext {
    return {
      userId,
      daoId: daoId || '',
      role: 'member',
      contributionScore: 0,
      recentActions: [],
      preferences: {
        language: 'en',
        notifications: true,
        theme: 'light'
      },
      sessionData: {
        conversationHistory: [],
        lastInteraction: new Date()
      }
    };
  }

  /**
   * Clean up expired sessions
   */
  private startCleanupTimer(): NodeJS.Timeout {
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [sessionKey, session] of this.sessions.entries()) {
        if (!this.isSessionValid(session)) {
          this.sessions.delete(sessionKey);
        }
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
    timer.unref?.();
    return timer;
  }

  shutdown(): void {
    clearInterval(this.cleanupTimer);
    this.sessions.clear();
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): number {
    return this.sessions.size;
  }
}
