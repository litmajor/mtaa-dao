
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { TrendingUp, Users, DollarSign, Target } from 'lucide-react';

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
      color: 'text-green-600 bg-green-100'
    },
    {
      icon: Users,
      label: 'Active DAOs',
      value: stats?.activeDaos || 0,
      color: 'text-blue-600 bg-blue-100'
    },
    {
      icon: Target,
      label: 'Goals Achieved',
      value: stats?.goalsAchieved || 0,
      color: 'text-purple-600 bg-purple-100'
    },
    {
      icon: TrendingUp,
      label: 'Members Joined Today',
      value: stats?.newMembersToday || 0,
      color: 'text-orange-600 bg-orange-100'
    }
  ];

  return (
    <Card className="bg-gradient-to-br from-teal-50 to-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-600" />
          Platform Impact
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
                <div className="text-2xl font-bold text-gray-900">
                  {metric.value}
                </div>
                <div className="text-xs text-gray-600">{metric.label}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
