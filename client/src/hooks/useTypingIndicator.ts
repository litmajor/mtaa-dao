import { useEffect, useRef } from 'react';

export function useTypingIndicator(daoId: string, newMessage: string) {
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const sendTyping = async (isTyping: boolean) => {
      try {
        await fetch(`/api/dao/${daoId}/typing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isTyping }) });
      } catch (e) {
        // ignore
      }
    };

    if (newMessage && newMessage.length > 0) {
      sendTyping(true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => sendTyping(false), 2000);
    } else {
      sendTyping(false);
    }

    return () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current); };
  }, [daoId, newMessage]);
}
