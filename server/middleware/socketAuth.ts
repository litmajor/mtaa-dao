import { type Socket } from 'socket.io';
import { verifyAccessToken } from '../auth';

/**
 * Shared Socket.IO auth middleware.
 * - Reads `handshake.auth.token` (preferred) or `handshake.headers.cookie`.
 * - If `handshake.auth.system === true` and `ALLOW_SYSTEM_SOCKET` env var is set,
 *   the socket is marked as a trusted system socket (`socket.data.system = true`).
 */
export function socketAuthMiddleware(socket: Socket, next: (err?: any) => void) {
  try {
    // System socket shortcut (for backend publishers)
    if ((socket.handshake.auth as any)?.system === true && process.env.ALLOW_SYSTEM_SOCKET === 'true') {
      (socket as any).data = { ...(socket as any).data, system: true };
      return next();
    }

    const auth = socket.handshake.auth || {};
    let token = auth.token as string | undefined;

    // Fallback: cookies (httpOnly cookie set by backend)
    if (!token && socket.handshake.headers?.cookie) {
      const cookieString = socket.handshake.headers.cookie as string;
      const cookies = cookieString.split(';').map(c => c.trim());
      for (const cookie of cookies) {
        const eqIdx = cookie.indexOf('=');
        if (eqIdx === -1) continue;
        const key = cookie.slice(0, eqIdx);
        const value = cookie.slice(eqIdx + 1);
        if (key === 'token' || key === 'jwt' || key === 'authToken') {
          token = decodeURIComponent(value);
          break;
        }
      }
    }

    if (!token) return next(new Error('Authentication required: Missing token'));

    const payload = verifyAccessToken(token as string);
    if (!payload) return next(new Error('Authentication failed: Invalid or expired token'));

    (socket as any).data = { ...(socket as any).data, user: payload };
    return next();
  } catch (err) {
    return next(err as any);
  }
}

export default socketAuthMiddleware;
