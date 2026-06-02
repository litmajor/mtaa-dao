import { useEffect, useState } from 'react';

export function usePresence(daoId: string) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/dao/${daoId}/presence`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setOnlineUsers(data.onlineUsers || []);
        setTypingUsers(data.typingUsers || []);
      } catch (e) {
        // ignore
      }
    };

    poll();
    const id = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [daoId]);

  return { onlineUsers, typingUsers };
}
