
import { useState } from 'react';
import { MessageCircle, Sparkles, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface MorioMiniWidgetProps {
  userId: string;
  daoId?: string;
}

interface ChatResponse {
  text: string;
  suggestions: string[];
}

export function MorioMiniWidget({ userId, daoId }: MorioMiniWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [lastResponse, setLastResponse] = useState<string>('');

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest<ChatResponse>('/api/morio/chat', {
        method: 'POST',
        body: JSON.stringify({ userId, daoId, message })
      });
      return response;
    },
    onSuccess: (response) => {
      setLastResponse(response.text);
    }
  });

  const handleQuickQuestion = (question: string) => {
    setInput(question);
    sendMessage.mutate(question);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage.mutate(input);
    setInput('');
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800 shadow-lg">
      <CardHeader 
        className="pb-3 cursor-pointer bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Morio AI</h3>
              <p className="text-xs text-gray-500">Quick Assist</p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-3 space-y-3">
          {/* Quick Actions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Quick Questions:</p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => handleQuickQuestion('What is my balance?')}
                className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50"
              >
                💰 Balance
              </button>
              <button
                onClick={() => handleQuickQuestion('Show proposals')}
                className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50"
              >
                📝 Proposals
              </button>
              <button
                onClick={() => handleQuickQuestion('DAO stats')}
                className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50"
              >
                📊 Stats
              </button>
            </div>
          </div>

          {/* Last Response */}
          {lastResponse && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 text-xs">
              <p className="text-gray-700 dark:text-gray-300">{lastResponse.slice(0, 150)}...</p>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex gap-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Morio..."
              className="text-xs h-8"
              disabled={sendMessage.isPending}
            />
            <Button 
              type="submit" 
              size="sm"
              disabled={!input.trim() || sendMessage.isPending}
              className="h-8 w-8 p-0"
            >
              {sendMessage.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
