
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Heart, MessageCircle, Activity, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AIMetrics {
  nuru: {
    status: string;
    intentClassificationAccuracy: number;
    averageConfidence: number;
    totalIntents: number;
    topIntents: { intent: string; count: number }[];
    languageDistribution: { language: string; percentage: number }[];
    analyticsRequests: number;
    riskAssessments: number;
  };
  kwetu: {
    status: string;
    treasuryOperations: number;
    governanceActions: number;
    communityEvents: number;
    responseTime: number;
    errorRate: number;
  };
  morio: {
    status: string;
    totalSessions: number;
    activeSessions: number;
    averageResponseTime: number;
    messagesProcessed: number;
    userSatisfaction: number;
    topQueries: { query: string; count: number }[];
  };
}

export default function AILayerMonitoring() {
  const { data: metrics, isLoading } = useQuery<AIMetrics>({
    queryKey: ['/api/admin/ai-metrics'],
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  if (isLoading || !metrics) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <Activity className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-2 text-lg">Loading AI Metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">AI Layer Monitoring</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Real-time monitoring of NURU, KWETU, and MORIO AI systems
        </p>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" />
                NURU (Mind)
              </CardTitle>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                {metrics.nuru.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Accuracy</span>
                <span className="font-semibold">{metrics.nuru.intentClassificationAccuracy}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Avg Confidence</span>
                <span className="font-semibold">{metrics.nuru.averageConfidence}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Intents Processed</span>
                <span className="font-semibold">{metrics.nuru.totalIntents.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" />
                KWETU (Body)
              </CardTitle>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                {metrics.kwetu.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Treasury Ops</span>
                <span className="font-semibold">{metrics.kwetu.treasuryOperations.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Governance Actions</span>
                <span className="font-semibold">{metrics.kwetu.governanceActions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Response Time</span>
                <span className="font-semibold">{metrics.kwetu.responseTime}ms</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-indigo-200 dark:border-indigo-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-indigo-500" />
                MORIO (Spirit)
              </CardTitle>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                {metrics.morio.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Active Sessions</span>
                <span className="font-semibold">{metrics.morio.activeSessions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Messages Processed</span>
                <span className="font-semibold">{metrics.morio.messagesProcessed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Satisfaction</span>
                <span className="font-semibold">{metrics.morio.userSatisfaction}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="nuru" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="nuru">NURU Analytics</TabsTrigger>
          <TabsTrigger value="kwetu">KWETU Operations</TabsTrigger>
          <TabsTrigger value="morio">MORIO Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="nuru" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Intents</CardTitle>
                <CardDescription>Most frequently classified user intents</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.nuru.topIntents}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="intent" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Language Distribution</CardTitle>
                <CardDescription>User query languages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.nuru.languageDistribution.map((lang) => (
                    <div key={lang.language}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{lang.language.toUpperCase()}</span>
                        <span className="text-sm text-gray-600">{lang.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${lang.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="kwetu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Performance</CardTitle>
              <CardDescription>KWETU service metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Treasury Service</div>
                  <div className="text-2xl font-bold">{metrics.kwetu.treasuryOperations}</div>
                  <div className="text-xs text-gray-500">operations</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Governance Service</div>
                  <div className="text-2xl font-bold">{metrics.kwetu.governanceActions}</div>
                  <div className="text-xs text-gray-500">actions</div>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Community Service</div>
                  <div className="text-2xl font-bold">{metrics.kwetu.communityEvents}</div>
                  <div className="text-xs text-gray-500">events</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="morio" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Top User Queries</CardTitle>
                <CardDescription>Most common questions asked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.morio.topQueries.map((query, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="text-sm flex-1">{query.query}</span>
                      <Badge variant="secondary">{query.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Session Metrics</CardTitle>
                <CardDescription>User engagement statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Sessions</div>
                    <div className="text-3xl font-bold">{metrics.morio.totalSessions.toLocaleString()}</div>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time</div>
                    <div className="text-3xl font-bold">{metrics.morio.averageResponseTime}ms</div>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">User Satisfaction</div>
                    <div className="text-3xl font-bold">{metrics.morio.userSatisfaction}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
