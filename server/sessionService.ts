
// import { Request, Response } from 'express';

interface SessionData {
  userId: string;
  email?: string;
  role?: string;
  loginTime: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

// In-memory session store (replace with Redis in production)
const activeSessions = new Map<string, SessionData>();
const userSessions = new Map<string, Set<string>>(); // userId -> sessionIds

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

  // Clean up old sessions for this user
  if (!userSessions.has(userId)) {
    userSessions.set(userId, new Set());
  }
  
  const userSessionSet = userSessions.get(userId)!;
  
  // If user has too many sessions, remove the oldest
  if (userSessionSet.size >= MAX_SESSIONS_PER_USER) {
    const sessionsArray = Array.from(userSessionSet);
    const oldestSessionId = sessionsArray[0];
    destroySession(oldestSessionId);
  }

  activeSessions.set(sessionId, sessionData);
  userSessionSet.add(sessionId);
};

export const getSession = (sessionId: string): SessionData | null => {
  const session = activeSessions.get(sessionId);
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
  activeSessions.set(sessionId, session);
  
  return session;
};

export const updateSessionActivity = (sessionId: string) => {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
    activeSessions.set(sessionId, session);
  }
};

export const destroySession = (sessionId: string) => {
  const session = activeSessions.get(sessionId);
  if (session) {
    const userSessionSet = userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      if (userSessionSet.size === 0) {
        userSessions.delete(session.userId);
      }
    }
  }
  activeSessions.delete(sessionId);
};

export const destroyAllUserSessions = (userId: string) => {
  const userSessionSet = userSessions.get(userId);
  if (userSessionSet) {
    userSessionSet.forEach(sessionId => {
      activeSessions.delete(sessionId);
    });
    userSessions.delete(userId);
  }
};

export const getUserActiveSessions = (userId: string): SessionData[] => {
  const userSessionSet = userSessions.get(userId);
  if (!userSessionSet) return [];
  
  return Array.from(userSessionSet)
    .map(sessionId => activeSessions.get(sessionId))
    .filter((session): session is SessionData => session !== undefined);
};

export const cleanupExpiredSessions = () => {
  const now = new Date();
  const expiredSessions: string[] = [];
  
  activeSessions.forEach((session, sessionId) => {
    const timeDiff = now.getTime() - session.lastActivity.getTime();
    if (timeDiff > SESSION_TIMEOUT) {
      expiredSessions.push(sessionId);
    }
  });
  
  expiredSessions.forEach(sessionId => destroySession(sessionId));
  console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
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
