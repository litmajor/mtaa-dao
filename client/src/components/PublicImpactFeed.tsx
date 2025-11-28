
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { TrendingUp, Users, DollarSign, CheckCircle } from 'lucide-react';

export default function PublicImpactFeed() {
  const { data: stats } = useQuery({
    queryKey: ['/api/public/impact-stats'],
    queryFn: async () => {
      const response = await fetch('/api/public/impact-stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 60000 // Refresh every minute
  });

  const metrics = [
    {
      icon: DollarSign,
      label: 'Total Raised This Month',
      value: `KES ${(stats?.totalRaisedThisMonth || 0).toLocaleString()}`,
      color: 'text-emerald-400 bg-emerald-500/20'
    },
    {
      icon: Users,
      label: 'Active DAOs',
      value: stats?.activeDaos || 0,
      color: 'text-blue-400 bg-blue-500/20'
    },
    {
      icon: CheckCircle,
      label: 'Goals Achieved',
      value: stats?.goalsAchieved || 0,
      color: 'text-purple-400 bg-purple-500/20'
    },
    {
      icon: TrendingUp,
      label: 'Members Joined Today',
      value: stats?.newMembersToday || 0,
      color: 'text-orange-400 bg-orange-500/20'
    }
  ];

  return (
    <Card className="bg-gradient-to-br from-slate-900/50 via-purple-900/30 to-slate-900/50 border border-white/10 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span>Platform Impact (Live)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <div key={idx} className="text-center">
                <div className={`${metric.color} w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {metric.value}
                </div>
                <div className="text-xs text-gray-300">{metric.label}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
