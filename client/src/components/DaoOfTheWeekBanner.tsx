
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Award, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/pages/hooks/useAuth';
import { apiGet } from '@/lib/api';

export default function DaoOfTheWeekBanner() {
  const { isAuthenticated } = useAuth();

  const { data } = useQuery({
    queryKey: ['/api/dao-of-the-week/current'],
    enabled: isAuthenticated, // Only fetch when authenticated
    queryFn: async () => {
      try {
        return await apiGet('/api/dao-of-the-week/current');
      } catch (error) {
        return null;
      }
    }
  });

  if (!data?.data) return null;

  const dao = data.data;

  return (
    <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-yellow-400 rounded-full p-3">
              <Award className="w-8 h-8 text-yellow-900" />
            </div>
            <div>
              <Badge className="bg-yellow-500 text-yellow-900 mb-2">
                DAO OF THE WEEK 🏆
              </Badge>
              <h3 className="text-2xl font-bold text-gray-900">{dao.name}</h3>
              <p className="text-gray-600 text-sm">{dao.description}</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="flex items-center gap-1 text-gray-900">
                <Users className="w-4 h-4" />
                <span className="font-bold">{dao.member_count}</span>
              </div>
              <p className="text-xs text-gray-600">Members</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 text-gray-900">
                <TrendingUp className="w-4 h-4" />
                <span className="font-bold">{dao.proposal_count}</span>
              </div>
              <p className="text-xs text-gray-600">Proposals</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
