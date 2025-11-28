import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Lock, Send, Copy, Share2, Zap } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EscrowInitiatorProps {
  walletBalance?: string;
  defaultCurrency?: string;
}

export default function EscrowInitiator({ 
  walletBalance = '0',
  defaultCurrency = 'cUSD'
}: EscrowInitiatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const { toast } = useToast();

  // Form state
  const [recipient, setRecipient] = useState(''); // email or username
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [description, setDescription] = useState('');
  const [milestoneCount, setMilestoneCount] = useState('1');
  const [milestones, setMilestones] = useState<Array<{ description: string; amount: string }>>([
    { description: '', amount: '' }
  ]);

  const handleMilestoneChange = (index: number, field: 'description' | 'amount', value: string) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  const addMilestone = () => {
    setMilestones([...milestones, { description: '', amount: '' }]);
    setMilestoneCount((prev) => (parseInt(prev) + 1).toString());
  };

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index));
      setMilestoneCount((prev) => (Math.max(1, parseInt(prev) - 1)).toString());
    }
  };

  const handleInitiateEscrow = async () => {
    // Validation
    if (!recipient.trim()) {
      toast({ title: 'Error', description: 'Recipient email or username required', variant: 'destructive' });
      return;
    }

    if (!amount || parseFloat(amount) < 1) {
      toast({ title: 'Error', description: 'Amount must be at least $1', variant: 'destructive' });
      return;
    }

    if (milestones.some(m => !m.description || !m.amount)) {
      toast({ title: 'Error', description: 'All milestones must have description and amount', variant: 'destructive' });
      return;
    }

    // Calculate total from milestones
    const totalFromMilestones = milestones.reduce((sum, m) => sum + parseFloat(m.amount || '0'), 0);
    if (Math.abs(totalFromMilestones - parseFloat(amount)) > 0.01) {
      toast({ title: 'Error', description: 'Milestone amounts must equal total amount', variant: 'destructive' });
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiPost('/api/escrow/initiate', {
        recipient,
        amount,
        currency,
        description,
        milestones,
      });

      if (response.success && response.inviteLink) {
        setInviteLink(response.inviteLink);
        toast({ title: 'Success', description: 'Escrow initiated! Share the link with recipient.' });
      } else {
        throw new Error(response.error || 'Failed to initiate escrow');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to initiate escrow',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast({ title: 'Copied', description: 'Link copied to clipboard' });
    }
  };

  const resetForm = () => {
    setRecipient('');
    setAmount('');
    setCurrency(defaultCurrency);
    setDescription('');
    setMilestones([{ description: '', amount: '' }]);
    setMilestoneCount('1');
    setInviteLink(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
          <Zap className="w-4 h-4" />
          Initiate Escrow
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Initiate Secure Payment
          </DialogTitle>
          <DialogDescription>
            Create a secure escrow agreement for peer-to-peer transactions. Works with any amount (min $1).
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <div className="space-y-6">
            {/* Recipient */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Recipient Email or Username</label>
              <Input
                placeholder="user@example.com or @username"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                If they don't have an account, they'll sign up via your invite link
              </p>
            </div>

            {/* Amount & Currency */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">$</span>
                  <Input
                    type="number"
                    placeholder="1.00"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Currency</label>
                <Select value={currency} onValueChange={setCurrency} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cUSD">cUSD (Celo Dollar)</SelectItem>
                    <SelectItem value="CELO">CELO (Celo Native)</SelectItem>
                    <SelectItem value="cEUR">cEUR (Celo Euro)</SelectItem>
                    <SelectItem value="USDC">USDC (Circle USD Coin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction Description</label>
              <Textarea
                placeholder="e.g., Website design project, Freelance writing, Service delivery..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={2}
              />
            </div>

            {/* Milestones */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Milestones / Phases</label>
                <Badge variant="outline">{milestones.length}</Badge>
              </div>

              {milestones.map((milestone, index) => (
                <div key={index} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground">Milestone {index + 1}</span>
                    {milestones.length > 1 && (
                      <button
                        onClick={() => removeMilestone(index)}
                        className="text-xs text-red-500 hover:text-red-700"
                        disabled={isLoading}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <Input
                    placeholder="e.g., Design mockups, Final deliverables"
                    value={milestone.description}
                    onChange={(e) => handleMilestoneChange(index, 'description', e.target.value)}
                    disabled={isLoading}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm">$</span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={milestone.amount}
                      onChange={(e) => handleMilestoneChange(index, 'amount', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMilestone}
                disabled={isLoading}
              >
                + Add Milestone
              </Button>

              {amount && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
                  <strong>Total:</strong> ${amount} {currency}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setIsOpen(false);
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleInitiateEscrow}
                disabled={isLoading}
                className="flex-1 gap-2"
              >
                {isLoading ? 'Creating...' : 'Initiate Escrow'}
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          // Invite Link Share Screen
          <div className="space-y-4 py-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-semibold text-green-900 mb-2">✓ Escrow Created Successfully!</p>
              <p className="text-xs text-green-800">
                Share this link with your recipient. They can accept and fund the escrow.
              </p>
            </div>

            {/* Invite Link Display */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Invite Link</label>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {inviteLink?.includes('?') ? (
                  <>This link includes referral tracking if recipient signs up</>
                ) : null}
              </p>
            </div>

            {/* Share Options */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Share Via</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (inviteLink) {
                      window.open(`https://wa.me/?text=${encodeURIComponent(inviteLink)}`, '_blank');
                    }
                  }}
                >
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (inviteLink) {
                      window.open(`mailto:?body=${encodeURIComponent(inviteLink)}`, '_blank');
                    }
                  }}
                >
                  Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (inviteLink && navigator.share) {
                      navigator.share({ url: inviteLink });
                    }
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  More
                </Button>
              </div>
            </div>

            {/* Transaction Summary */}
            <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Amount:</span>
                <span className="font-semibold">${amount} {currency}</span>
              </div>
              <div className="flex justify-between">
                <span>Recipient:</span>
                <span className="font-semibold">{recipient}</span>
              </div>
              <div className="flex justify-between">
                <span>Milestones:</span>
                <span className="font-semibold">{milestones.length}</span>
              </div>
            </div>

            <Button
              onClick={() => {
                resetForm();
                setIsOpen(false);
              }}
              className="w-full"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
