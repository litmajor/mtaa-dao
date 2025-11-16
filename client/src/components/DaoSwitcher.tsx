
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ChevronDown, Check, Users, TrendingUp } from 'lucide-react';

export default function DaoSwitcher() {
  const navigate = useNavigate();
  const { id: currentDaoId } = useParams();
  const [open, setOpen] = useState(false);

  // Fetch user's DAOs
  const { data: daos = [] } = useQuery({
    queryKey: ['/api/daos'],
    queryFn: async () => {
      const res = await fetch('/api/daos', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch DAOs');
      const data = await res.json();
      return Array.isArray(data) ? data.filter((d: any) => d.isJoined) : [];
    },
  });

  const currentDao = daos.find((d: any) => d.id === parseInt(currentDaoId || '0'));

  const switchDao = (daoId: number) => {
    navigate(`/dao/${daoId}`);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
              {currentDao?.name?.[0] || 'M'}
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">{currentDao?.name || 'My Groups'}</p>
              <p className="text-xs text-gray-500">{daos.length} groups</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle>My Groups</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {daos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No groups yet</p>
              <Button 
                onClick={() => navigate('/daos')}
                size="sm" 
                className="mt-4"
              >
                Discover Groups
              </Button>
            </div>
          ) : (
            daos.map((dao: any) => (
              <button
                key={dao.id}
                onClick={() => switchDao(dao.id)}
                className={`w-full p-3 rounded-lg flex items-start gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  dao.id === parseInt(currentDaoId || '0') ? 'bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500' : 'border border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
                  dao.gradient ? `bg-gradient-to-r ${dao.gradient}` : 'bg-gradient-to-r from-purple-500 to-pink-500'
                }`}>
                  {dao.avatar || dao.name[0]}
                </div>
                
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm">{dao.name}</p>
                    {dao.id === parseInt(currentDaoId || '0') && (
                      <Check className="w-4 h-4 text-purple-600" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {dao.memberCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      ${dao.treasuryBalance?.toLocaleString() || 0}
                    </span>
                  </div>

                  {dao.recentActivity && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {dao.recentActivity}
                    </p>
                  )}
                </div>

                {dao.role === 'elder' && (
                  <Badge variant="outline" className="text-xs">Elder</Badge>
                )}
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
