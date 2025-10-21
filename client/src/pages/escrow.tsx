
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Clock, CheckCircle, XCircle } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function EscrowPage() {
  const [escrows, setEscrows] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadEscrows();
  }, []);

  const loadEscrows = async () => {
    try {
      const data = await apiGet('/api/escrow/my-escrows');
      setEscrows(data.escrows);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRelease = async (escrowId: string) => {
    try {
      await apiPost(`/api/escrow/${escrowId}/release`, {});
      toast({ title: 'Success', description: 'Funds released' });
      loadEscrows();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDispute = async (escrowId: string) => {
    try {
      await apiPost(`/api/escrow/${escrowId}/dispute`, { reason: 'Milestone not met' });
      toast({ title: 'Dispute Filed', description: 'Arbitration process started' });
      loadEscrows();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Lock className="w-8 h-8" />
          Escrow Management
        </h1>
        <p className="text-muted-foreground">Secure milestone-based payments</p>
      </div>

      <div className="grid gap-4">
        {escrows.map((escrow) => (
          <Card key={escrow.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{escrow.title}</CardTitle>
                  <CardDescription>
                    {escrow.amount} {escrow.token} · {escrow.milestones.length} milestones
                  </CardDescription>
                </div>
                <Badge variant={
                  escrow.status === 'active' ? 'default' :
                  escrow.status === 'completed' ? 'success' :
                  escrow.status === 'disputed' ? 'destructive' : 'secondary'
                }>
                  {escrow.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {escrow.milestones.map((milestone: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{milestone.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {milestone.amount} {escrow.token}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {milestone.released ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                  </div>
                ))}

                {escrow.status === 'active' && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleRelease(escrow.id)} className="flex-1">
                      Release Next Milestone
                    </Button>
                    <Button onClick={() => handleDispute(escrow.id)} variant="destructive">
                      Dispute
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
