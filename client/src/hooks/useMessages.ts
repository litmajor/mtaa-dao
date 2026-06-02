import { useQuery, useQueryClient } from '@tanstack/react-query';

export function useMessages(daoId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [`/api/dao/${daoId}/messages`],
    queryFn: async () => {
      const res = await fetch(`/api/dao/${daoId}/messages?limit=200`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return (await res.json()).messages || [];
    },
    refetchInterval: 5000
  });

  const create = async (payload: any) => {
    const res = await fetch(`/api/dao/${daoId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('Failed to create message');
    const data = await res.json();
    try { await queryClient.invalidateQueries({ queryKey: [`/api/dao/${daoId}/messages`] }); } catch {}
    return data;
  };

  const update = async ({ messageId, content }: { messageId: string; content: string }) => {
    const res = await fetch(`/api/messages/${messageId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
    if (!res.ok) throw new Error('Failed to update message');
    const data = await res.json();
    try { await queryClient.invalidateQueries({ queryKey: [`/api/dao/${daoId}/messages`] }); } catch {}
    return data;
  };

  const remove = async (messageId: string) => {
    const res = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete message');
    try { await queryClient.invalidateQueries({ queryKey: [`/api/dao/${daoId}/messages`] }); } catch {}
  };

  return {
    messages: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    create,
    update,
    remove
  };
}
