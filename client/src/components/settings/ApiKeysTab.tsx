import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KeyRound, Plus, Trash2, Unplug } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ApiKeysTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await fetch('/api/settings/api-keys');
      if (!res.ok) throw new Error('Failed to fetch API keys');
      const data = await res.json();
      return data.keys || [];
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete API key');
    },
    onSuccess: () => {
      toast({ title: 'API Key deleted successfully' });
      qc.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-400" /> API Keys & Integrations
            </CardTitle>
            <CardDescription className="text-gray-400 mt-1">Connect external exchanges and services to your Yuki or Amara personas.</CardDescription>
          </div>
          <Button className="bg-indigo-500 hover:bg-indigo-600 text-white">
            <Plus className="w-4 h-4 mr-2" /> Add Key
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-gray-400 text-center py-4">Loading keys...</div>
          ) : keys?.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-xl bg-white/5">
              <Unplug className="w-12 h-12 mx-auto text-gray-500 mb-3" />
              <h3 className="text-lg font-medium text-white">No API Keys Connected</h3>
              <p className="text-gray-400 text-sm mt-1">Add your Binance, KuCoin, or Bybit keys to enable automated trading.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {keys?.map((key: any) => (
                <div key={key.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white capitalize">{key.exchange}</h4>
                      {key.isTradingEnabled && <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/20 border-0">Trading Active</Badge>}
                    </div>
                    <p className="text-sm text-gray-400 mt-1 font-mono">{key.apiKey.slice(0, 4)}••••••••{key.apiKey.slice(-4)}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this API key?')) {
                        deleteKey.mutate(key.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">Telegram Bot Integration</CardTitle>
          <CardDescription className="text-gray-400">Receive alerts and execute trades directly from Telegram.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
            <div>
              <h4 className="font-bold text-white">@MtaaDAOBot</h4>
              <p className="text-sm text-gray-400 mt-1">Not connected</p>
            </div>
            <Button variant="outline" className="border-[#0088cc] text-[#0088cc] hover:bg-[#0088cc] hover:text-white">
              Connect Telegram
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
