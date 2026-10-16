import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCw, TrendingUp, Users, Clock } from 'lucide-react';
import { authClient } from '../utils/authClient';

interface RotationStatus {
  daoId: string;
  daoType: string;
  durationModel: string;
  rotationFrequency: string;
  selectionMethod: string;
  currentCycle: number;
  totalCycles?: number;
  nextRotationDate: string;
  treasuryBalance: string;
  treasuryCurrency?: string;
  onChainRotationStatus?: 'not_configured' | 'not_initialized' | 'initialized' | 'unknown';
  onChainRotationDetails?: {
    monthlyContribution: string;
    currency: string;
    totalMembers: number;
  } | null;
  pendingManualPayout?: {
    cycleId: string;
    cycleNumber: number;
    recipientUserId: string;
    amount: string;
    cycleStatus: 'pending_manual_payout' | 'pending_b2c_payout';
    confirmationsReceived?: number;
    payoutStatus?: 'queued' | 'initiating' | 'accepted' | 'succeeded' | 'failed' | 'unknown' | null;
    payoutAttempt?: number | null;
    payoutMessage?: string | null;
  } | null;
  pendingOnChainPayout?: {
    cycleId: string;
    cycleNumber: number;
    recipientUserId: string;
    transactionHash?: string | null;
  } | null;
  totalMembers: number;
  cycleHistory: {
    cycleNumber: number;
    recipient: string;
    amountDistributed: string;
    currency?: string;
    status: string;
    distributedAt?: string;
  }[];
}

interface RotationWidgetProps {
  daoId: string;
}

export function RotationWidget({ daoId }: RotationWidgetProps) {
  const [status, setStatus] = useState<RotationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [minimumParticipationBps, setMinimumParticipationBps] = useState('10000');
  const [contributionTransactionHash, setContributionTransactionHash] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  useEffect(() => {
    fetchRotationStatus();
    // Poll every minute for updates
    const interval = setInterval(fetchRotationStatus, 60000);
    return () => clearInterval(interval);
  }, [daoId]);

  const fetchRotationStatus = async () => {
    try {
      setLoading(true);
      const response = await authClient.fetch(`/api/dao/${daoId}/rotation/status`);
      if (!response.ok) throw new Error('Failed to fetch rotation status');
      
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rotation status');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !status) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full"></div>
        </CardContent>
      </Card>
    );
  }
  if (!status || status.durationModel !== 'rotation') return null;

  const nextRotationDate = new Date(status.nextRotationDate);
  const daysUntilRotation = Math.ceil((nextRotationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const currency = status.treasuryCurrency || 'cUSD';
  const startRotation = async () => {
    setProcessing(true);
    setError(null);
    try {
      await authClient.post(`/api/dao/${daoId}/rotation/process`, {});
      await fetchRotationStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start rotation');
    } finally {
      setProcessing(false);
    }
  };
  const completeManualPayout = async () => {
    if (!status.pendingManualPayout) return;
    setProcessing(true);
    setError(null);
    try {
      await authClient.post(
        `/api/dao/${daoId}/rotation/cycles/${status.pendingManualPayout.cycleId}/mark-paid`,
        { reference: paymentReference.trim() }
      );
      setPaymentReference('');
      await fetchRotationStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm manual payout');
    } finally {
      setProcessing(false);
    }
  };
  const confirmB2cPayout = async () => {
    if (!status.pendingManualPayout) return;
    setProcessing(true);
    setError(null);
    try {
      await authClient.post(
        `/api/dao/${daoId}/rotation/cycles/${status.pendingManualPayout.cycleId}/complete`,
        {}
      );
      await fetchRotationStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm M-Pesa payout');
    } finally {
      setProcessing(false);
    }
  };
  const initializeOnChainRotation = async () => {
    setProcessing(true);
    setError(null);
    try {
      await authClient.post(`/api/dao/${daoId}/rotation/initialize`, {
        monthlyContribution,
        minimumParticipationBps: Number(minimumParticipationBps),
      });
      await fetchRotationStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize on-chain rotation');
    } finally {
      setProcessing(false);
    }
  };
  const recordOnChainContribution = async () => {
    setProcessing(true);
    setError(null);
    try {
      await authClient.post(`/api/dao/${daoId}/rotation/contributions`, {
        transactionHash: contributionTransactionHash.trim(),
      });
      setContributionTransactionHash('');
      await fetchRotationStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record stablecoin contribution');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-green-50 dark:from-teal-950/30 dark:to-green-950/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
          <RotateCw className="w-5 h-5" />
          Rotation Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Cycle */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Current Cycle</p>
            <p className="text-2xl font-bold text-teal-600">
              {status.currentCycle}/{status.totalCycles || '∞'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Treasury Balance</p>
            <p className="text-2xl font-bold text-green-600">
              {parseFloat(status.treasuryBalance || '0').toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">{currency}</p>
          </div>
        </div>

        {/* Next Rotation */}
        <div className="bg-white dark:bg-gray-900 p-3 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Next Rotation</span>
            <Badge variant="outline">{daysUntilRotation} days</Badge>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {nextRotationDate.toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-500">
            Method: <strong>{status.selectionMethod}</strong>
          </p>
        </div>

        {/* Recent Cycles */}
        {status.cycleHistory.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent Cycles</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {status.cycleHistory.slice(-3).reverse().map(cycle => (
                <div
                  key={cycle.cycleNumber}
                  className="flex items-center justify-between text-xs p-2 bg-white dark:bg-gray-900 rounded"
                >
                  <span>
                    Cycle {cycle.cycleNumber}:{' '}
                    <Badge variant="secondary" className="text-xs">
                      {cycle.status}
                    </Badge>
                  </span>
                  <span className="font-mono">
                    {parseFloat(cycle.amountDistributed).toLocaleString()} {cycle.currency || currency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <Button size="sm" variant="outline" className="w-full" onClick={fetchRotationStatus}>
          <Clock className="w-4 h-4 mr-2" />
          Refresh Status
        </Button>

        {!status.pendingManualPayout && !status.pendingOnChainPayout &&
          daysUntilRotation <= 0 && parseFloat(status.treasuryBalance || '0') > 0 && (
          <Button size="sm" className="w-full" onClick={startRotation} disabled={processing}>
            {processing ? 'Preparing payout...' : 'Prepare manual payout'}
          </Button>
        )}

        {status.pendingOnChainPayout && (
          <div className="space-y-1 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950/30">
            <p>
              Cycle {status.pendingOnChainPayout.cycleNumber}: payout proposal sent to the DAO treasury.
              The cycle will complete after the treasury executes it.
            </p>
            {status.pendingOnChainPayout.transactionHash && (
              <p className="break-all font-mono text-xs">
                Transaction: {status.pendingOnChainPayout.transactionHash}
              </p>
            )}
          </div>
        )}

        {status.onChainRotationStatus === 'not_initialized' && (
          <div className="space-y-2 rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
            <p className="text-sm font-medium">Initialize on-chain rotation</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              This fixes the current approved members and their wallets into the on-chain rotation roster.
              New members cannot be added to this contract rotation.
            </p>
            <label className="block text-xs" htmlFor={`rotation-contribution-${daoId}`}>
              Fixed per-member contribution (stablecoin)
            </label>
            <input
              id={`rotation-contribution-${daoId}`}
              type="number"
              min="0"
              step="any"
              value={monthlyContribution}
              onChange={(event) => setMonthlyContribution(event.target.value)}
              className="w-full rounded border px-2 py-1 text-sm dark:bg-gray-900"
            />
            <label className="block text-xs" htmlFor={`rotation-participation-${daoId}`}>
              Minimum participation (basis points)
            </label>
            <input
              id={`rotation-participation-${daoId}`}
              type="number"
              min="1"
              max="10000"
              step="1"
              value={minimumParticipationBps}
              onChange={(event) => setMinimumParticipationBps(event.target.value)}
              className="w-full rounded border px-2 py-1 text-sm dark:bg-gray-900"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={initializeOnChainRotation}
              disabled={processing || !monthlyContribution || Number(monthlyContribution) <= 0}
            >
              {processing ? 'Initializing...' : 'Initialize rotation'}
            </Button>
          </div>
        )}

        {status.onChainRotationStatus === 'initialized' && (
          <div className="space-y-2 rounded-lg border border-green-300 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
            <p className="text-xs text-green-700 dark:text-green-300">
              On-chain rotation is initialized for {status.onChainRotationDetails?.totalMembers ?? 'the'} members.
              Transfer exactly {status.onChainRotationDetails?.monthlyContribution ?? ''}{' '}
              {status.onChainRotationDetails?.currency ?? 'stablecoin'} from your registered wallet to the
              ChamaTreasury for the active cycle.
            </p>
            <label className="block text-xs" htmlFor={`rotation-contribution-tx-${daoId}`}>
              Confirmed stablecoin transfer transaction hash
            </label>
            <input
              id={`rotation-contribution-tx-${daoId}`}
              value={contributionTransactionHash}
              onChange={(event) => setContributionTransactionHash(event.target.value)}
              className="w-full rounded border px-2 py-1 font-mono text-xs dark:bg-gray-900"
              placeholder="0x..."
            />
            <Button
              size="sm"
              className="w-full"
              onClick={recordOnChainContribution}
              disabled={processing || !/^0x[0-9a-fA-F]{64}$/.test(contributionTransactionHash.trim())}
            >
              {processing ? 'Verifying deposit...' : 'Verify and record contribution'}
            </Button>
          </div>
        )}

        {status.pendingManualPayout && (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm font-medium">
              Cycle {status.pendingManualPayout.cycleNumber}: {Number(status.pendingManualPayout.amount).toLocaleString()} KES to the recipient.
            </p>
            {status.pendingManualPayout.cycleStatus === 'pending_manual_payout' ? (
              <>
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Send the payout manually (for example, through M-Pesa), then record its payment reference.
                </p>
                <label className="block text-xs" htmlFor={`rotation-payment-reference-${daoId}`}>
                  M-Pesa or payment reference
                </label>
                <input
                  id={`rotation-payment-reference-${daoId}`}
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  maxLength={200}
                  className="w-full rounded border px-2 py-1 font-mono text-xs dark:bg-gray-900"
                  placeholder="e.g. QWE123ABC"
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={completeManualPayout}
                  disabled={processing || paymentReference.trim().length < 3}
                >
                  {processing ? 'Recording payout...' : 'Mark payout as paid'}
                </Button>
              </>
            ) : (
              <>
                {status.pendingManualPayout.payoutStatus ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    {status.pendingManualPayout.payoutStatus === 'accepted' || status.pendingManualPayout.payoutStatus === 'initiating' || status.pendingManualPayout.payoutStatus === 'queued'
                      ? `Safaricom payout ${status.pendingManualPayout.payoutStatus}. The cycle will complete only after a successful result callback.`
                      : status.pendingManualPayout.payoutStatus === 'unknown'
                        ? 'Safaricom request outcome is unknown. Do not retry; reconcile this payout before taking further action.'
                        : status.pendingManualPayout.payoutMessage || `Payout status: ${status.pendingManualPayout.payoutStatus}.`}
                  </p>
                ) : status.pendingManualPayout.confirmationsReceived ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    First confirmation recorded. An active member with the other required role must confirm this payout.
                  </p>
                ) : null}
                {(!status.pendingManualPayout.payoutStatus || status.pendingManualPayout.payoutStatus === 'failed') && (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={confirmB2cPayout}
                    disabled={processing}
                  >
                    {processing ? 'Confirming payout...' : status.pendingManualPayout.confirmationsReceived
                      ? 'Confirm as second role'
                      : status.pendingManualPayout.payoutStatus === 'failed'
                        ? 'Retry with fresh confirmations'
                        : 'Record first confirmation'}
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RotationWidget;
