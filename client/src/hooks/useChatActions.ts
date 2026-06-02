import { useQueryClient } from '@tanstack/react-query';

export function useChatActions(daoId: string) {
  const qc = useQueryClient();

  const react = async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
    const res = await fetch(`/api/messages/${messageId}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) });
    if (!res.ok) throw new Error('Failed to react');
    const data = await res.json();
    // invalidate messages cache
    try { await qc.invalidateQueries({ queryKey: [`/api/dao/${daoId}/messages`] }); } catch {};
    return data;
  };

  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('daoId', daoId);
    const res = await fetch(`/api/dao/${daoId}/upload`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data;
  };

  return { react, upload };
}
