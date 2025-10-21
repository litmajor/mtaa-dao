/**
 * Morio AI Assistant Demo Page
 * 
 * Demonstrates the Nuru-Kwetu-Morio three-layer architecture
 */

import { useQuery } from '@tanstack/react-query';
import { MorioChat } from '@/components/morio/MorioChat';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Heart, MessageCircle, Activity, TrendingUp, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface HealthResponse {
  status: string;
  components?: Record<string, string>;
  timestamp?: string;
}

export default function MorioDemo() {
  // Mock user ID for demo (in production, use actual auth)
  const userId = 'demo-user-001';
  const daoId = 'demo-dao-001';

  // Fetch system health
  const { data: health } = useQuery<HealthResponse>({
    queryKey: ['/api/morio/health'],
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="morio-demo-page">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Morio AI Assistant</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Three-layer AI system for DAO management (Nuru • Kwetu • Morio)
        </p>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-nuru-status">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                NURU (Mind)
              </CardTitle>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {health?.status || 'Loading...'}
              </Badge>
            </div>
            <CardDescription>Cognitive Core & Analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3" />
                Intent Classification
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3 h-3" />
                Analytics Engine
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3" />
                Risk Assessment
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-kwetu-status">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                KWETU (Body)
              </CardTitle>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Active
              </Badge>
            </div>
            <CardDescription>Community & Economy Layer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>Treasury Management</div>
              <div>Proposal System</div>
              <div>Voting Mechanisms</div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-morio-status">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-indigo-500" />
                MORIO (Spirit)
              </CardTitle>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                Ready
              </Badge>
            </div>
            <CardDescription>Conversational Interface</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>Natural Language Processing</div>
              <div>Session Management</div>
              <div>Multi-language Support</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Interface */}
      <Tabs defaultValue="chat" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chat" data-testid="tab-chat">
            Chat Interface
          </TabsTrigger>
          <TabsTrigger value="capabilities" data-testid="tab-capabilities">
            Capabilities
          </TabsTrigger>
          <TabsTrigger value="architecture" data-testid="tab-architecture">
            Architecture
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MorioChat userId={userId} daoId={daoId} />
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Start Guide</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <strong>Try these commands:</strong>
                  </div>
                  <ul className="space-y-1 text-gray-600 dark:text-gray-400 ml-4">
                    <li>• "Check DAO balance"</li>
                    <li>• "Show active proposals"</li>
                    <li>• "Treasury analytics"</li>
                    <li>• "Help me vote"</li>
                    <li>• "Community stats"</li>
                  </ul>
                  <div className="pt-2 text-xs text-gray-500">
                    Supports English and Swahili phrases
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">System Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Version</span>
                    <span className="font-mono">1.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Intents Supported</span>
                    <span className="font-mono">13+</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Languages</span>
                    <span className="font-mono">EN, SW</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Session Timeout</span>
                    <span className="font-mono">30min</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="capabilities" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Treasury Operations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div>✓ Balance checking</div>
                <div>✓ Deposit guidance</div>
                <div>✓ Withdrawal proposals</div>
                <div>✓ Transaction history</div>
                <div>✓ Financial analytics</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Governance Support</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div>✓ Proposal creation</div>
                <div>✓ Voting assistance</div>
                <div>✓ Proposal tracking</div>
                <div>✓ Governance metrics</div>
                <div>✓ Risk assessment</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Analytics & Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div>✓ Treasury reports</div>
                <div>✓ Community metrics</div>
                <div>✓ Voting patterns</div>
                <div>✓ Growth tracking</div>
                <div>✓ Engagement scores</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Member Support</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div>✓ Onboarding guidance</div>
                <div>✓ DAO rules explanation</div>
                <div>✓ Help & FAQs</div>
                <div>✓ Contextual suggestions</div>
                <div>✓ Multi-language support</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Risk Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div>✓ Budget compliance</div>
                <div>✓ Conflict detection</div>
                <div>✓ Impact assessment</div>
                <div>✓ Fairness scoring</div>
                <div>✓ Automated recommendations</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Context Awareness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div>✓ Session memory</div>
                <div>✓ Conversation history</div>
                <div>✓ User preferences</div>
                <div>✓ Multi-turn dialogs</div>
                <div>✓ Intent tracking</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="architecture" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Three-Layer Architecture</CardTitle>
              <CardDescription>
                Modular design inspired by human consciousness
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <Brain className="w-5 h-5 text-purple-500" />
                    Layer 1: NURU (The Mind)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Cognitive core providing reasoning and analytical intelligence
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                      <strong>Intent Classification</strong>
                      <p className="text-gray-600 dark:text-gray-400">Pattern-based NLU</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                      <strong>Context Manager</strong>
                      <p className="text-gray-600 dark:text-gray-400">Session awareness</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                      <strong>Analytics Engine</strong>
                      <p className="text-gray-600 dark:text-gray-400">3 specialized analyzers</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                      <strong>Ethics Module</strong>
                      <p className="text-gray-600 dark:text-gray-400">Risk assessment</p>
                    </div>
                  </div>
                </div>

                <div className="border-l-4 border-red-500 pl-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <Heart className="w-5 h-5 text-red-500" />
                    Layer 2: KWETU (The Body)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Community and economic infrastructure layer
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      <strong>Treasury Services</strong>
                      <p className="text-gray-600 dark:text-gray-400">Wallets & vaults</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      <strong>Governance</strong>
                      <p className="text-gray-600 dark:text-gray-400">Proposals & voting</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      <strong>Payment Rails</strong>
                      <p className="text-gray-600 dark:text-gray-400">M-Pesa, Stripe, Crypto</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      <strong>Community Services</strong>
                      <p className="text-gray-600 dark:text-gray-400">Members & tasks</p>
                    </div>
                  </div>
                </div>

                <div className="border-l-4 border-indigo-500 pl-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <MessageCircle className="w-5 h-5 text-indigo-500" />
                    Layer 3: MORIO (The Spirit)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Conversational personality and user interface layer
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded">
                      <strong>Chat Interface</strong>
                      <p className="text-gray-600 dark:text-gray-400">Web, mobile, messaging</p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded">
                      <strong>Session Manager</strong>
                      <p className="text-gray-600 dark:text-gray-400">Context preservation</p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded">
                      <strong>Response Generator</strong>
                      <p className="text-gray-600 dark:text-gray-400">Personality-driven</p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded">
                      <strong>Multi-platform</strong>
                      <p className="text-gray-600 dark:text-gray-400">Telegram, WhatsApp (future)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-sm">Design Principles</h4>
                <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <li>✓ <strong>Modular</strong>: Each layer is independent and extensible</li>
                  <li>✓ <strong>Type-safe</strong>: Full TypeScript coverage with shared types</li>
                  <li>✓ <strong>Debuggable</strong>: Clear separation of concerns</li>
                  <li>✓ <strong>Maintainable</strong>: Well-documented and organized</li>
                  <li>✓ <strong>Extensible</strong>: Easy to add new intents, analyzers, or platforms</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
