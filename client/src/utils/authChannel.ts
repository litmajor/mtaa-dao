// Lightweight BroadcastChannel wrapper with localStorage fallback
type AuthEvent = { type: string; payload?: any; ts?: number };

const CHANNEL_NAME = 'mtaa_auth_channel';

let bc: BroadcastChannel | null = null;

export function initAuthChannel() {
  if (typeof window === 'undefined') return;
  if ('BroadcastChannel' in window) {
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
      bc = null;
    }
  }
}

export function postAuthMessage(event: AuthEvent) {
  const msg = { ...event, ts: Date.now() };
  if (bc) {
    bc.postMessage(msg);
    return;
  }

  // fallback via localStorage ping
  try {
    localStorage.setItem(`${CHANNEL_NAME}:last`, JSON.stringify(msg));
    // cleanup key to avoid buildup
    setTimeout(() => localStorage.removeItem(`${CHANNEL_NAME}:last`), 500);
  } catch (e) {
    // ignore
  }
}

export function onAuthMessage(cb: (ev: AuthEvent) => void) {
  if (typeof window === 'undefined') return () => {};

  if (bc) {
    const handler = (e: MessageEvent) => cb(e.data);
    bc.addEventListener('message', handler);
    return () => bc?.removeEventListener('message', handler);
  }

  const storageHandler = (e: StorageEvent) => {
    if (e.key === `${CHANNEL_NAME}:last` && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        cb(data);
      } catch (err) {
        // ignore
      }
    }
  };

  window.addEventListener('storage', storageHandler);
  return () => window.removeEventListener('storage', storageHandler);
}

export function closeAuthChannel() {
  if (bc) {
    bc.close();
    bc = null;
  }
}

initAuthChannel();

export default { postAuthMessage, onAuthMessage, initAuthChannel, closeAuthChannel };
