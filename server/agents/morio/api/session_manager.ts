/**
 * Session Manager
 * 
 * Manages user sessions, context, and conversation state
 */

import type { Session } from '../types';
import type { UserContext } from '../../../core/nuru/types';

export class SessionManager {
  private sessions: Map<string, Session>;
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.sessions = new Map();
    this.startCleanupTimer();
  }

  /**
   * Get or create session for user
   */
  async getSession(userId: string, daoId?: string): Promise<Session> {
    const existingSession = this.sessions.get(userId);
    
    if (existingSession && this.isSessionValid(existingSession)) {
      return existingSession;
    }

    // Create new session
    const newSession: Session = {
      id: `session_${userId}_${Date.now()}`,
      userId,
      daoId,
      context: this.createDefaultContext(userId, daoId),
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata: {}
    };

    this.sessions.set(userId, newSession);
    return newSession;
  }

  /**
   * Update session with new data
   */
  async updateSession(userId: string, updates: Partial<Session['metadata']>): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;

    session.metadata = {
      ...session.metadata,
      ...updates
    };
    session.lastActivity = new Date();

    this.sessions.set(userId, session);
  }

  /**
   * Clear user session
   */
  async clearSession(userId: string): Promise<void> {
    this.sessions.delete(userId);
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
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [userId, session] of this.sessions.entries()) {
        if (!this.isSessionValid(session)) {
          this.sessions.delete(userId);
        }
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): number {
    return this.sessions.size;
  }
}
