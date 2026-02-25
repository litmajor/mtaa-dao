import React, { useState, useCallback, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  Trash2 as TrashIcon,
  Users,
  DollarSign,
  AlertCircle as AlertIcon,
  Loader as LoaderIcon,
  Info as InfoIcon,
  CheckCircle,
  Clipboard as ClipboardIcon,
  CheckCircle as SuccessIcon,
} from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  email?: string;
  amount: number;
  paid: boolean;
}

interface BillSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBill?: (bill: any) => Promise<void>;
}

/**
 * Bill Split Modal Component
 * 
 * Features:
 * - Create new bill split
 * - Add multiple participants
 * - Equal split or custom amounts
 * - Automatic calculation
 * - Email notifications
 * - Payment tracking
 * - Real-time validation feedback
 * - Progress indication
 */
export function BillSplitModal({ isOpen, onClose, onCreateBill }: BillSplitModalProps) {
  // Form state
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDescription, setBillDescription] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');

  // Participants state
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: '', email: '', amount: 0, paid: false },
  ]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * Add participant
   */
  const handleAddParticipant = useCallback(() => {
    const newParticipant: Participant = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      email: '',
      amount: 0,
      paid: false,
    };
    setParticipants([...participants, newParticipant]);
  }, [participants]);

  /**
   * Remove participant
   */
  const handleRemoveParticipant = useCallback((id: string) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((p) => p.id !== id));
      calculateSplit();
    }
  }, [participants]);

  /**
   * Update participant
   */
  const handleUpdateParticipant = useCallback(
    (id: string, field: keyof Participant, value: any) => {
      setParticipants(
        participants.map((p) =>
          p.id === id ? { ...p, [field]: value } : p
        )
      );
      // Clear error for this field if it exists
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`${id}_${field}`];
        return newErrors;
      });
    },
    [participants]
  );

  /**
   * Calculate split amounts
   */
  const calculateSplit = useCallback(() => {
    if (!billAmount || parseFloat(billAmount) <= 0) return;

    const total = parseFloat(billAmount);
    const activeParticipants = participants.filter((p) => p.name.trim());

    if (activeParticipants.length === 0) return;

    if (splitType === 'equal') {
      const amountPerPerson = total / activeParticipants.length;
      setParticipants(
        participants.map((p) =>
          p.name.trim() ? { ...p, amount: parseFloat(amountPerPerson.toFixed(2)) } : p
        )
      );
    }
  }, [billAmount, participants, splitType]);

  /**
   * Auto-calculate on amount change
   */
  React.useEffect(() => {
    calculateSplit();
  }, [billAmount, participants.length, splitType, calculateSplit]);

  /**
   * Validate form
   */
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!billTitle.trim()) {
      errors['title'] = 'Bill title is required';
    }
    if (!billAmount || parseFloat(billAmount) <= 0) {
      errors['amount'] = 'Please enter a valid amount';
    }

    const activeParticipants = participants.filter((p) => p.name.trim());
    if (activeParticipants.length === 0) {
      errors['participants'] = 'Add at least one participant';
    }

    // Validate custom amounts sum matches total
    if (splitType === 'custom') {
      const customTotal = activeParticipants.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(customTotal - parseFloat(billAmount)) > 0.01) {
        errors['customTotal'] = `Custom amounts must equal ${billAmount}`;
      }
    }

    return errors;
  };

  const isFormValid = useMemo(() => {
    const errors = validateForm();
    return Object.keys(errors).length === 0;
  }, [billTitle, billAmount, participants, splitType]);

  /**
   * Calculate totals
   */
  const totals = useMemo(() => {
    const total = parseFloat(billAmount) || 0;
    const activeParticipants = participants.filter((p) => p.name.trim());
    const totalAmount = activeParticipants.reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = activeParticipants.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0);
    const owedAmount = totalAmount - paidAmount;

    return { total, activeParticipants: activeParticipants.length, totalAmount, paidAmount, owedAmount };
  }, [billAmount, participants]);

  /**
   * Handle create bill
   */
  const handleCreateBill = async () => {
    try {
      setLoading(true);
      setError(null);
      const validationErrors = validateForm();

      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors);
        setError('Please fix the errors above');
        return;
      }

      const billData = {
        title: billTitle,
        description: billDescription,
        totalAmount: parseFloat(billAmount),
        currency: 'cUSD',
        splitType,
        participants: participants
          .filter((p) => p.name.trim())
          .map((p) => ({
            name: p.name,
            email: p.email || undefined,
            amount: p.amount,
          })),
      };

      if (onCreateBill) {
        await onCreateBill(billData);
      } else {
        // Fallback: send to API
        const res = await fetch('/api/wallet/bill-split', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(billData),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create bill');
        }
      }

      // Reset form
      setBillTitle('');
      setBillAmount('');
      setBillDescription('');
      setParticipants([{ id: '1', name: '', email: '', amount: 0, paid: false }]);
      setFieldErrors({});
      onClose();

      // Track event
      if ((window as any)?.analytics) {
        (window as any).analytics.track('Bill Split Created', {
          participantCount: totals.activeParticipants,
          totalAmount: billAmount,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create bill';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Copy split summary
   */
  const handleCopySummary = useCallback(() => {
    const summary = participants
      .filter((p) => p.name.trim())
      .map((p) => `${p.name}: $${p.amount.toFixed(2)}`)
      .join('\n');

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [participants]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Users className="h-5 w-5 text-blue-500" />
            Create a Bill Split
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Easily split expenses with friends and track payments
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Helpful Info */}
          <div className="flex gap-3 p-3 bg-blue-600/10 border border-blue-600/30 rounded-lg">
            <InfoIcon className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-300">
              {splitType === 'equal' 
                ? 'Amounts will be split equally among all participants'
                : 'You can set custom amounts for each participant'}
            </p>
          </div>

          {/* Bill Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-white flex items-center gap-2">
                Bill Title <span className="text-red-400">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Dinner at The Restaurant"
                value={billTitle}
                onChange={(e) => {
                  setBillTitle(e.target.value);
                  setFieldErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors['title'];
                    return newErrors;
                  });
                }}
                className={`mt-1 bg-slate-800 border-slate-700 text-white placeholder-slate-500 ${
                  fieldErrors['title'] ? 'border-red-500 focus:border-red-500' : ''
                }`}
              />
              {fieldErrors['title'] && (
                <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertIcon className="h-3 w-3" />
                  {fieldErrors['title']}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount" className="text-white flex items-center gap-2">
                  Total Amount (cUSD) <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={billAmount}
                  onChange={(e) => {
                    setBillAmount(e.target.value);
                    setFieldErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors['amount'];
                      return newErrors;
                    });
                  }}
                  className={`mt-1 bg-slate-800 border-slate-700 text-white placeholder-slate-500 ${
                    fieldErrors['amount'] ? 'border-red-500 focus:border-red-500' : ''
                  }`}
                  step="0.01"
                  min="0"
                />
                {fieldErrors['amount'] && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertIcon className="h-3 w-3" />
                    {fieldErrors['amount']}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-white flex items-center gap-2">
                  Split Type
                </Label>
                <div className="flex gap-3 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer flex-1 p-2 rounded border border-slate-700 hover:border-blue-600 transition" onClick={() => setSplitType('equal')}>
                    <input
                      type="radio"
                      value="equal"
                      checked={splitType === 'equal'}
                      onChange={(e) => setSplitType(e.target.value as any)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-300">Equal Split</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer flex-1 p-2 rounded border border-slate-700 hover:border-blue-600 transition" onClick={() => setSplitType('custom')}>
                    <input
                      type="radio"
                      value="custom"
                      checked={splitType === 'custom'}
                      onChange={(e) => setSplitType(e.target.value as any)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-300">Custom Amounts</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="text-white">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add any details about this bill... (e.g., Restaurant name, date, etc.)"
                value={billDescription}
                onChange={(e) => setBillDescription(e.target.value)}
                className="mt-1 bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                rows={2}
              />
              <p className="text-xs text-slate-500 mt-1">{billDescription.length}/200 characters</p>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-white flex items-center gap-2">
                Participants <span className="text-red-400">*</span>
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddParticipant}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Person
              </Button>
            </div>

            {fieldErrors['participants'] && (
              <p className="text-red-400 text-sm flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {fieldErrors['participants']}
              </p>
            )}

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {participants.map((participant, idx) => (
                <div key={participant.id} className="flex gap-2 items-end p-3 bg-slate-800 rounded border border-slate-700">
                  <div className="flex-1">
                    <Label className="text-xs text-slate-400 mb-1 block">Name</Label>
                    <Input
                      placeholder="Full name"
                      value={participant.name}
                      onChange={(e) =>
                        handleUpdateParticipant(participant.id, 'name', e.target.value)
                      }
                      className="text-sm bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  <div className="flex-1">
                    <Label className="text-xs text-slate-400 mb-1 block">Email (optional)</Label>
                    <Input
                      placeholder="email@example.com"
                      type="email"
                      value={participant.email || ''}
                      onChange={(e) =>
                        handleUpdateParticipant(participant.id, 'email', e.target.value)
                      }
                      className="text-sm bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  {splitType === 'custom' && (
                    <div className="w-28">
                      <Label className="text-xs text-slate-400 mb-1 block">Amount</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={participant.amount || ''}
                        onChange={(e) =>
                          handleUpdateParticipant(participant.id, 'amount', parseFloat(e.target.value) || 0)
                        }
                        className="text-sm bg-slate-700 border-slate-600 text-white"
                        step="0.01"
                      />
                    </div>
                  )}

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveParticipant(participant.id)}
                    disabled={participants.length === 1}
                    className="text-red-400 hover:bg-red-600/20"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-white">
                <DollarSign className="h-4 w-4 text-blue-400" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-700 rounded">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Total</p>
                  <p className="text-lg font-bold text-white mt-1">{totals.total.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">cUSD</p>
                </div>
                <div className="p-3 bg-slate-700 rounded">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">People</p>
                  <p className="text-lg font-bold text-white mt-1">{totals.activeParticipants}</p>
                  <p className="text-xs text-slate-500">participants</p>
                </div>
                <div className="p-3 bg-slate-700 rounded">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Per Person</p>
                  <p className="text-lg font-bold text-white mt-1">
                    {(totals.total / (totals.activeParticipants || 1)).toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">cUSD</p>
                </div>
              </div>

              {splitType === 'custom' && fieldErrors['customTotal'] && (
                <div className="flex gap-2 p-3 bg-red-600/20 border border-red-600 rounded text-red-400 text-sm">
                  <AlertIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{fieldErrors['customTotal']}</span>
                </div>
              )}

              {totals.activeParticipants > 0 && (
                <div className="pt-3 border-t border-slate-600">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Total per person:</span>
                    <span className="text-white font-bold">
                      {(totals.totalAmount / totals.activeParticipants).toFixed(2)} cUSD
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Message */}
          {error && (
            <div className="flex gap-2 p-3 bg-red-600/20 border border-red-600 rounded text-red-400 text-sm">
              <AlertIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopySummary}
              disabled={totals.activeParticipants === 0}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              {copied ? (
                <>
                  <SuccessIcon className="h-4 w-4 text-green-400" />
                  Copied
                </>
              ) : (
                <>
                  <ClipboardIcon className="h-4 w-4 mr-1" />
                  Copy Summary
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleCreateBill}
              disabled={!isFormValid || loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create Bill
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BillSplitModal;
