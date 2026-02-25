import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Send, ArrowRight, Check } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

/**
 * Send to DAO Member Modal
 * 
 * Allows users to send funds directly to a DAO member
 * with optional escrow protection
 */

interface DAOMember {
  id: string;
  username: string;
  avatar?: string;
  trustScore?: number;
}

interface SendToDAOMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  daoId?: string;
  onSuccess?: (txId: string) => void;
}

export function SendToDAOMemberModal({
  open,
  onOpenChange,
  daoId,
  onSuccess,
}: SendToDAOMemberModalProps) {
  // Form state
  const [selectedDAO, setSelectedDAO] = useState<string>(daoId || '');
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [useEscrow, setUseEscrow] = useState<boolean>(true);
  const [escrowDays, setEscrowDays] = useState<number>(3);

  // UI state
  const [step, setStep] = useState<'dao-select' | 'member-select' | 'amount' | 'review'>('dao-select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [daoMembers, setDAOMembers] = useState<DAOMember[]>([]);
  const [userDAOs, setUserDAOs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Load user's DAOs on mount
  React.useEffect(() => {
    if (open && !userDAOs.length) {
      loadUserDAOs();
    }
  }, [open]);

  // Load DAO members when DAO is selected
  React.useEffect(() => {
    if (selectedDAO) {
      loadDAOMembers(selectedDAO);
    }
  }, [selectedDAO]);

  async function loadUserDAOs() {
    try {
      const data = await apiRequest('GET', '/api/users/my-daos');
      setUserDAOs(data || []);
      if (data?.length > 0 && !selectedDAO) {
        setSelectedDAO(data[0].id);
      }
    } catch (err) {
      setError('Failed to load your DAOs');
      console.error(err);
    }
  }

  async function loadDAOMembers(daoId: string) {
    try {
      setLoading(true);
      const data = await apiRequest('GET', `/api/dao/${daoId}/members`);
      setDAOMembers(data || []);
    } catch (err) {
      setError('Failed to load DAO members');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredMembers = useMemo(() => {
    return daoMembers.filter(
      member =>
        member.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.id.includes(searchQuery)
    );
  }, [daoMembers, searchQuery]);

  async function handleSubmit() {
    try {
      setError(null);
      setLoading(true);

      if (!selectedMember || !amount || !selectedDAO) {
        setError('Please fill in all required fields');
        return;
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        setError('Please enter a valid amount');
        return;
      }

      const payload = {
        recipientId: selectedMember,
        daoId: selectedDAO,
        amount: numAmount,
        note: note || undefined,
        useEscrow,
        escrowDays: useEscrow ? escrowDays : undefined,
      };

      const result = await apiRequest('POST', '/api/wallet/send-to-member', payload);

      if (result?.success) {
        onSuccess?.(result.transactionId);
        resetForm();
        onOpenChange(false);
      } else {
        setError(result?.message || 'Failed to send payment');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSelectedMember('');
    setAmount('');
    setNote('');
    setUseEscrow(true);
    setEscrowDays(3);
    setStep('dao-select');
    setSearchQuery('');
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  }

  const currentDAO = userDAOs.find(d => d.id === selectedDAO);
  const currentMember = daoMembers.find(m => m.id === selectedMember);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-400" />
            Send to DAO Member
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Send funds securely to another community member
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-600/20 border border-red-600/50 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Step 1: DAO Selection */}
          {step === 'dao-select' && (
            <div className="space-y-4">
              <div>
                <Label className="text-white">Select a DAO</Label>
                <Select value={selectedDAO} onValueChange={setSelectedDAO}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Choose a DAO" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {userDAOs.map(dao => (
                      <SelectItem key={dao.id} value={dao.id} className="text-white">
                        {dao.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep('member-select')}
                  disabled={!selectedDAO}
                  className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Member Selection */}
          {step === 'member-select' && (
            <div className="space-y-4">
              <div className="text-sm text-slate-400">
                DAO: <span className="text-white font-medium">{currentDAO?.name}</span>
              </div>

              <div>
                <Label className="text-white">Search for member</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Username or ID"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredMembers.length > 0 ? (
                  filteredMembers.map(member => (
                    <button
                      key={member.id}
                      onClick={() => setSelectedMember(member.id)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedMember === member.id
                          ? 'bg-blue-600/30 border border-blue-500'
                          : 'bg-slate-800 border border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {member.avatar && (
                            <img src={member.avatar} alt="" className="h-8 w-8 rounded-full" />
                          )}
                          <div>
                            <p className="text-white font-medium">{member.username}</p>
                            <p className="text-xs text-slate-500">{member.id}</p>
                          </div>
                        </div>
                        {member.trustScore && (
                          <div className="text-right">
                            <p className="text-xs text-slate-400">Trust Score</p>
                            <p className="text-sm text-yellow-400">{member.trustScore}</p>
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center text-slate-400 py-4">
                    {loading ? 'Loading members...' : 'No members found'}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('dao-select')}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-700"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep('amount')}
                  disabled={!selectedMember}
                  className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Amount & Note */}
          {step === 'amount' && (
            <div className="space-y-4">
              <div className="text-sm text-slate-400">
                To: <span className="text-white font-medium">{currentMember?.username}</span>
              </div>

              <div>
                <Label className="text-white">Amount ($)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <Label className="text-white">Note (optional)</Label>
                <Input
                  placeholder="Payment for..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                />
              </div>

              <div className="border border-slate-700 rounded-lg p-4 space-y-3 bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <Label htmlFor="escrow-toggle" className="text-white">Use Escrow Protection</Label>
                  <input
                    id="escrow-toggle"
                    type="checkbox"
                    checked={useEscrow}
                    onChange={e => setUseEscrow(e.target.checked)}
                    className="h-4 w-4"
                    title="Enable escrow protection for this payment"
                  />
                </div>

                {useEscrow && (
                  <div>
                    <Label className="text-slate-300 text-sm">Release after (days)</Label>
                    <Select value={String(escrowDays)} onValueChange={v => setEscrowDays(parseInt(v))}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {[1, 2, 3, 5, 7, 14, 30].map(days => (
                          <SelectItem key={days} value={String(days)} className="text-white">
                            {days} day{days > 1 ? 's' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <p className="text-xs text-slate-400">
                  {useEscrow
                    ? 'Funds held securely until agreed time or mediator resolves disputes'
                    : 'Direct transfer without protection'}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('member-select')}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-700"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep('review')}
                  disabled={!amount || parseFloat(amount) <= 0}
                  className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  Review <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Confirm */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">From:</span>
                  <span className="text-white font-medium">Your Wallet</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">To:</span>
                  <span className="text-white font-medium">{currentMember?.username}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Amount:</span>
                  <span className="text-white font-medium">${parseFloat(amount).toFixed(2)}</span>
                </div>
                {note && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Note:</span>
                    <span className="text-white text-right max-w-xs">{note}</span>
                  </div>
                )}
                <div className="border-t border-slate-700 pt-3 flex justify-between text-sm">
                  <span className="text-slate-400">Protection:</span>
                  <span className="text-green-400">
                    {useEscrow ? `Escrow (${escrowDays} days)` : 'Direct Transfer'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('amount')}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-700"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  loading={loading}
                  disabled={loading}
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'Sending...' : <>Send Now <Check className="h-4 w-4" /></>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
