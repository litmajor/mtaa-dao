
//import { Request, Response } from 'express';

interface SessionData {
  userId: string;
  email?: string;
  role?: string;
  loginTime: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

// Enhanced session storage with Redis-like functionality
class SessionStore {
  private sessions = new Map<string, SessionData>();
  private userSessions = new Map<string, Set<string>>();
  private sessionsByIp = new Map<string, Set<string>>();

  set(sessionId: string, data: SessionData) {
    this.sessions.set(sessionId, data);
    
    // Track by user
    if (!this.userSessions.has(data.userId)) {
      this.userSessions.set(data.userId, new Set());
    }
    this.userSessions.get(data.userId)!.add(sessionId);

    // Track by IP
    if (data.ipAddress) {
      if (!this.sessionsByIp.has(data.ipAddress)) {
        this.sessionsByIp.set(data.ipAddress, new Set());
      }
      this.sessionsByIp.get(data.ipAddress)!.add(sessionId);
    }
  }

  get(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  delete(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Remove from user sessions
      const userSessionSet = this.userSessions.get(session.userId);
      if (userSessionSet) {
        userSessionSet.delete(sessionId);
        if (userSessionSet.size === 0) {
          this.userSessions.delete(session.userId);
        }
      }

      // Remove from IP sessions
      if (session.ipAddress) {
        const ipSessionSet = this.sessionsByIp.get(session.ipAddress);
        if (ipSessionSet) {
          ipSessionSet.delete(sessionId);
          if (ipSessionSet.size === 0) {
            this.sessionsByIp.delete(session.ipAddress);
          }
        }
      }
    }
    this.sessions.delete(sessionId);
  }

  getUserSessions(userId: string): Set<string> {
    return this.userSessions.get(userId) || new Set();
  }

  getIpSessions(ipAddress: string): Set<string> {
    return this.sessionsByIp.get(ipAddress) || new Set();
  }

  getAllSessions(): SessionData[] {
    return Array.from(this.sessions.values());
  }
}

const sessionStore = new SessionStore();

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS_PER_USER = 5;

export interface SessionContext {
  ip: string;
  userAgent: string;
}

export const createSession = (
  sessionId: string,
  userId: string,
  userData: Partial<SessionData>,
  context: SessionContext
) => {
  const sessionData: SessionData = {
    userId,
    email: userData.email,
    role: userData.role,
    loginTime: new Date(),
    lastActivity: new Date(),
    ipAddress: context.ip,
    userAgent: context.userAgent
  };

  // Check for suspicious activity (multiple IPs)
  const userSessionSet = sessionStore.getUserSessions(userId);
  const existingIps = new Set();
  userSessionSet.forEach(sid => {
    const session = sessionStore.get(sid);
    if (session?.ipAddress) existingIps.add(session.ipAddress);
  });

  if (existingIps.size > 0 && !existingIps.has(context.ip)) {
    console.warn(`Suspicious login: User ${userId} logging in from new IP ${context.ip}`);
  }

  // If user has too many sessions, remove the oldest
  if (userSessionSet.size >= MAX_SESSIONS_PER_USER) {
    const sessionsArray = Array.from(userSessionSet);
    const oldestSessionId = sessionsArray[0];
    destroySession(oldestSessionId);
  }

  sessionStore.set(sessionId, sessionData);
};

export const getSession = (sessionId: string): SessionData | null => {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  // Check if session has expired
  const now = new Date();
  const timeDiff = now.getTime() - session.lastActivity.getTime();
  
  if (timeDiff > SESSION_TIMEOUT) {
    destroySession(sessionId);
    return null;
  }

  // Update last activity
  session.lastActivity = now;
  sessionStore.set(sessionId, session);
  
  return session;
};

export const updateSessionActivity = (sessionId: string) => {
  const session = sessionStore.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
    sessionStore.set(sessionId, session);
  }
};

export const destroySession = (sessionId: string) => {
  sessionStore.delete(sessionId);
};

export const destroyAllUserSessions = (userId: string) => {
  const userSessionSet = sessionStore.getUserSessions(userId);
  userSessionSet.forEach(sessionId => {
    sessionStore.delete(sessionId);
  });
};

export const getUserActiveSessions = (userId: string): SessionData[] => {
  const userSessionSet = sessionStore.getUserSessions(userId);
  return Array.from(userSessionSet)
    .map(sessionId => sessionStore.get(sessionId))
    .filter((session): session is SessionData => session !== undefined);
};

export const cleanupExpiredSessions = () => {
  const now = new Date();
  const expiredSessions: string[] = [];
  
  sessionStore.getAllSessions().forEach((session) => {
    const timeDiff = now.getTime() - session.lastActivity.getTime();
    if (timeDiff > SESSION_TIMEOUT) {
      expiredSessions.push(session.userId + '_' + session.loginTime.getTime());
    }
  });
  
  expiredSessions.forEach(sessionId => destroySession(sessionId));
  console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
};

// Additional security functions
export const detectAnomalousActivity = (userId: string): boolean => {
  const sessions = getUserActiveSessions(userId);
  const uniqueIps = new Set(sessions.map(s => s.ipAddress));
  const uniqueUserAgents = new Set(sessions.map(s => s.userAgent));
  
  // Flag if user has sessions from more than 3 different IPs or user agents
  return uniqueIps.size > 3 || uniqueUserAgents.size > 3;
};

export const getSessionStats = () => {
  const allSessions = sessionStore.getAllSessions();
  return {
    totalSessions: allSessions.length,
    uniqueUsers: new Set(allSessions.map(s => s.userId)).size,
    uniqueIps: new Set(allSessions.map(s => s.ipAddress)).size,
    avgSessionAge: allSessions.reduce((acc, s) => 
      acc + (Date.now() - s.loginTime.getTime()), 0) / allSessions.length / 1000 / 60, // minutes
  };
};

// Clean up expired sessions every 10 minutes
setInterval(cleanupExpiredSessions, 10 * 60 * 1000);

export const sessionMiddleware = (req: any, res: any, next: any) => {
  let sessionId: string | undefined;
  if (req.headers && typeof req.headers['x-session-id'] === 'string') {
    sessionId = req.headers['x-session-id'] as string;
  }
  if (!sessionId && req.cookies && typeof req.cookies.sessionId === 'string') {
    sessionId = req.cookies.sessionId;
  }
  
  if (sessionId) {
    updateSessionActivity(sessionId);
  }
  
  next();
};