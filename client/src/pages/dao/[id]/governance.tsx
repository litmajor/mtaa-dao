import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { apiGet } from '@/lib/api';

export default function DaoGovernancePage() {
  const { id: daoId } = useParams<{ id: string }>();

  if (!daoId) {
    return <div className="p-4">Invalid DAO ID</div>;
  }

  const { data: proposals = [], isLoading, error } = useQuery({
    queryKey: [`/api/governance/proposals?daoId=${daoId}`],
    queryFn: () => apiGet(`/api/governance/proposals?daoId=${daoId}`).catch(() => []),
    enabled: !!daoId,
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'passed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Governance</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Create and vote on DAO proposals</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Create Proposal
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-6 text-center text-gray-600">
              Loading proposals...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center text-red-600">
              Error loading proposals
            </CardContent>
          </Card>
        ) : proposals && proposals.length > 0 ? (
          proposals.map((proposal: any) => (
            <Card key={proposal.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{proposal.title}</CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      by {proposal.author || 'Unknown'}
                    </p>
                  </div>
                  <Badge className={getStatusColor(proposal.status)}>
                    {proposal.status || 'Pending'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600 dark:text-gray-400">{proposal.description}</p>
                
                {proposal.votesFor !== undefined && proposal.votesAgainst !== undefined && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Vote Count</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                        <p className="text-xs text-gray-600 dark:text-gray-400">For</p>
                        <p className="text-xl font-bold text-green-600 dark:text-green-400">
                          {proposal.votesFor}
                        </p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Against</p>
                        <p className="text-xl font-bold text-red-600 dark:text-red-400">
                          {proposal.votesAgainst}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-gray-500">
                    {proposal.createdAt && new Date(proposal.createdAt).toLocaleDateString()}
                  </span>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-5xl mb-4">📄</div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No proposals yet. Be the first to create one!
              </p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create First Proposal
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
