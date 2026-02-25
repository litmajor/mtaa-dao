import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Users, DollarSign, BarChart3, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Dao {
  id: string;
  name: string;
  memberCount: number;
  activeMembers: number;
  treasury: number;
  governance: {
    participationRate: number;
    proposalCount: number;
    approvalRate: number;
  };
  health: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface DaoTreeSectionProps {
  daos: Dao[];
  userBalances: Record<string, number>;
  loading?: boolean;
  searchQuery?: string;
}

interface ExpandedDaos {
  [key: string]: boolean;
}

export function DaoTreeSection({ daos, userBalances, loading, searchQuery = '' }: DaoTreeSectionProps) {
  const [expandedDaos, setExpandedDaos] = useState<ExpandedDaos>(
    daos.reduce((acc, dao) => ({ ...acc, [dao.id]: true }), {})
  );

  const toggleDao = (daoId: string) => {
    setExpandedDaos(prev => ({ ...prev, [daoId]: !prev[daoId] }));
  };

  const filteredDaos = daos.filter(dao =>
    dao.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle>Your DAOs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 bg-slate-700" />
          <Skeleton className="h-32 bg-slate-700" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🏛️ Your DAOs</h2>
        <Button className="gap-2">
          + Create New DAO
        </Button>
      </div>

      {filteredDaos.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400">No DAOs found matching your search</p>
          </CardContent>
        </Card>
      ) : (
        filteredDaos.map(dao => (
          <Card key={dao.id} className="bg-slate-800 border-slate-700">
            {/* DAO Header */}
            <CardHeader
              onClick={() => toggleDao(dao.id)}
              className="cursor-pointer hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 flex items-start gap-3">
                  <button className="mt-1 text-slate-400 hover:text-white">
                    {expandedDaos[dao.id] ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                  <div>
                    <CardTitle className="text-lg">{dao.name}</CardTitle>
                    <p className="text-xs text-slate-400 mt-1">DAO ID: {dao.id}</p>
                  </div>
                </div>

                {/* Health Badge */}
                <div className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${
                  dao.health >= 80 ? 'bg-emerald-900/30 text-emerald-400' :
                  dao.health >= 60 ? 'bg-amber-900/30 text-amber-400' :
                  'bg-red-900/30 text-red-400'
                }`}>
                  {dao.health}/100 {dao.trend === 'improving' ? '↑' : dao.trend === 'declining' ? '↓' : '→'}
                </div>
              </div>
            </CardHeader>

            {/* DAO Metrics Grid */}
            <CardContent className="space-y-4 border-t border-slate-700 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Members */}
                <div className="bg-slate-700/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-400">Members</span>
                  </div>
                  <p className="text-lg font-bold text-white">{dao.memberCount}</p>
                  <p className="text-xs text-emerald-400">{dao.activeMembers} active</p>
                </div>

                {/* Treasury */}
                <div className="bg-slate-700/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-slate-400">Treasury</span>
                  </div>
                  <p className="text-lg font-bold text-white">${(dao.treasury / 1000).toFixed(0)}k</p>
                  <p className="text-xs text-emerald-400">+5% this month</p>
                </div>

                {/* Governance */}
                <div className="bg-slate-700/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-slate-400">Governance</span>
                  </div>
                  <p className="text-lg font-bold text-white">{(dao.governance.participationRate * 100).toFixed(0)}%</p>
                  <p className="text-xs text-slate-400">{dao.governance.proposalCount} proposals</p>
                </div>

                {/* Your Balance */}
                <div className="bg-slate-700/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-slate-400">Your Balance</span>
                  </div>
                  <p className="text-lg font-bold text-white">${(userBalances[dao.id] || 0).toFixed(0)}</p>
                  <p className="text-xs text-slate-400">
                    {((userBalances[dao.id] || 0) / dao.treasury * 100).toFixed(1)}% of treasury
                  </p>
                </div>
              </div>

              {/* Your Role */}
              <div className="bg-blue-900/20 border border-blue-700/50 p-3 rounded-lg">
                <p className="text-sm">
                  <span className="text-slate-300">Your Role: </span>
                  <span className="font-semibold text-blue-400">Founder</span>
                </p>
                <p className="text-sm text-slate-300 mt-1">
                  <span>Voting Power: </span>
                  <span className="font-semibold text-emerald-400">20%</span>
                </p>
              </div>

              {/* Expanded Details */}
              {expandedDaos[dao.id] && (
                <div className="border-t border-slate-700 pt-4 space-y-3">
                  {/* Treasury Trends */}
                  <div className="bg-slate-700/30 p-3 rounded-lg">
                    <p className="text-sm font-semibold text-white mb-2">Treasury Trend</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-8 bg-slate-600 rounded-lg relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="h-1 bg-emerald-500 rounded-full" style={{ width: '65%' }}></div>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-emerald-400">+5%</span>
                    </div>
                  </div>

                  {/* Approval Rate */}
                  <div className="bg-slate-700/30 p-3 rounded-lg">
                    <p className="text-sm font-semibold text-white mb-2">Proposal Approval Rate</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-8 bg-slate-600 rounded-lg relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="h-1 bg-blue-500 rounded-full" style={{ width: `${dao.governance.approvalRate * 100}%` }}></div>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-blue-400">{(dao.governance.approvalRate * 100).toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button variant="outline" size="sm" className="text-xs">
                      View Proposals
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs">
                      Treasury Details
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs">
                      Members
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs">
                      Settings
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

export default DaoTreeSection;
