/**
 * Hook for persisting Morio chat sessions to localStorage
 * 
 * Allows conversation history to survive browser restarts
 */

import { useEffect, useCallback } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SessionData {
  userId: string;
  daoId?: string;
  messages: Message[];
  lastUpdated: string;
}

const STORAGE_KEY_PREFIX = 'morio_session_';
const SESSION_EXPIRY_HOURS = 24;

/**
 * Custom hook to manage Morio session persistence
 */
export function useMorioSessionStorage(userId: string, daoId?: string) {
  const storageKey = `${STORAGE_KEY_PREFIX}${userId}_${daoId || 'default'}`;

  /**
   * Save messages to localStorage
   */
  const saveSession = useCallback((messages: Message[]) => {
    try {
      const sessionData: SessionData = {
        userId,
        daoId,
        messages: messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp) // Ensure timestamp is a Date
        })),
        lastUpdated: new Date().toISOString()
      };

      localStorage.setItem(storageKey, JSON.stringify(sessionData));
    } catch (error) {
      console.error('[Morio] Failed to save session:', error);
    }
  }, [storageKey, userId, daoId]);

  /**
   * Load messages from localStorage
   */
  const loadSession = useCallback((): Message[] | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;

      const sessionData: SessionData = JSON.parse(stored);
      
      // Check if session has expired (24 hours)
      const lastUpdated = new Date(sessionData.lastUpdated);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > SESSION_EXPIRY_HOURS) {
        clearSession();
        return null;
      }

      // Reconstruct Date objects from ISO strings
      return sessionData.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    } catch (error) {
      console.error('[Morio] Failed to load session:', error);
      return null;
    }
  }, [storageKey]);

  /**
   * Clear session from localStorage
   */
  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('[Morio] Failed to clear session:', error);
    }
  }, [storageKey]);

  /**
   * Clean up old sessions for other DAOs/users
   */
  const cleanupOldSessions = useCallback(() => {
    try {
      const now = new Date();
      const keysToDelete: string[] = [];

      // Iterate through all localStorage items
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(STORAGE_KEY_PREFIX)) continue;

        const stored = localStorage.getItem(key);
        if (!stored) continue;

        try {
          const sessionData: SessionData = JSON.parse(stored);
          const lastUpdated = new Date(sessionData.lastUpdated);
          const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

          if (hoursDiff > SESSION_EXPIRY_HOURS) {
            keysToDelete.push(key);
          }
        } catch {
          // Invalid JSON, mark for deletion
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => localStorage.removeItem(key));
      
      if (keysToDelete.length > 0) {
        console.info(`[Morio] Cleaned up ${keysToDelete.length} old sessions`);
      }
    } catch (error) {
      console.error('[Morio] Failed to cleanup old sessions:', error);
    }
  }, []);

  return {
    saveSession,
    loadSession,
    clearSession,
    cleanupOldSessions
  };
}
