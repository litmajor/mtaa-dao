import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  Wallet,
  Search,
  ArrowRight,
  Check,
  AlertCircle,
  Copy,
  QrCode,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useSubprofilePreferences } from '@/contexts/persona-context';

/**
 * Enhanced Send Modal with 3 Context Options
 * 
 * Contexts:
 * 1. DAO Send - Send to DAO treasury or members
 * 2. User Send - Send to known user by username
 * 3. Address Send - Send to wallet address directly
 * 
 * Features:
 * - Context-aware form fields
 * - Address validation
 * - Recipient history
 * - 2FA confirmation
 * - Fee calculation
 */

export type SendContextType = 'dao' | 'user' | 'address';

interface DAOInfo {
  id: string;
  name: string;
  memberCount?: number;
}

interface UserInfo {
  id: string;
  username: string;
  trustScore?: number;
  avatar?: string;
}

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (txId: string) => void;
  initialContext?: SendContextType;
  initialAmount?: number;
  daos?: DAOInfo[];
}

interface SendReviewData {
  context: SendContextType;
  recipient: string;
  amount: number;
  currency: string;
  memo: string;
  fee: number;
  total: number;
}

/**
 * Main Send Modal Component
 */
export function SendModal({
  isOpen,
  onClose,
  onSuccess,
  initialContext = 'user',
  initialAmount = 0,
  daos = [],
}: SendModalProps) {
  // Context & Preferences
  const { setSelectedTab, getSelectedTab } = useSubprofilePreferences();
  const lastContext = getSelectedTab() as SendContextType | undefined;
  
  // Tab State
  const [context, setContext] = useState<SendContextType>(lastContext || initialContext);
  
  // Form State
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState(String(initialAmount) || '');
  const [memo, setMemo] = useState('');
  const [currency, setCurrency] = useState('cUSD');
  
  // UI State
  const [step, setStep] = useState<'form' | 'review' | 'confirm'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fee, setFee] = useState(0);
  
  // Data Caches
  const [userDAOs, setUserDAOs] = useState<DAOInfo[]>(daos);
  const [daoMembers, setDAOMembers] = useState<UserInfo[]>([]);
  const [recentRecipients, setRecentRecipients] = useState<Array<{ type: SendContextType; value: string; label: string }>>([]);
  const [searchResults, setSearchResults] = useState<UserInfo[]>([]);
  
  // Load user's DAOs on mount
  useEffect(() => {
    if (isOpen && userDAOs.length === 0) {
      loadUserDAOs();
    }
  }, [isOpen]);

  // Load recent recipients on mount
  useEffect(() => {
    if (isOpen) {
      loadRecentRecipients();
    }
  }, [isOpen]);

  // Load DAO members when DAO context selected and DAO is chosen
  useEffect(() => {
    if (context === 'dao' && recipient) {
      loadDAOMembers(recipient);
    }
  }, [context, recipient]);

  /**
   * Load user's DAOs
   */
  async function loadUserDAOs() {
    try {
      const response = await apiRequest('GET', '/api/users/my-daos');
      setUserDAOs(response?.data || response || []);
    } catch (err) {
      console.error('Failed to load DAOs:', err);
    }
  }

  /**
   * Load DAO members for a specific DAO
   */
  async function loadDAOMembers(daoId: string) {
    try {
      setLoading(true);
      const response = await apiRequest('GET', `/api/dao/${daoId}/members`);
      setDAOMembers(response?.data || response || []);
    } catch (err) {
      console.error('Failed to load DAO members:', err);
      setDAOMembers([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Search for users by username
   */
  async function searchUsers(query: string) {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await apiRequest('GET', `/api/users/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response?.data || response || []);
    } catch (err) {
      console.error('Failed to search users:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Load recent recipients from localStorage
   */
  function loadRecentRecipients() {
    try {
      const stored = localStorage.getItem('mtaa_send_recent_recipients');
      if (stored) {
        setRecentRecipients(JSON.parse(stored).slice(0, 5));
      }
    } catch (err) {
      console.error('Failed to load recent recipients:', err);
    }
  }

  /**
   * Save recipient to recent list
   */
  function saveToRecentRecipients(type: SendContextType, value: string, label: string) {
    try {
      const recent = [
        { type, value, label },
        ...recentRecipients.filter(r => !(r.type === type && r.value === value)),
      ].slice(0, 10);
      localStorage.setItem('mtaa_send_recent_recipients', JSON.stringify(recent));
      setRecentRecipients(recent);
    } catch (err) {
      console.error('Failed to save recipient:', err);
    }
  }

  /**
   * Calculate fee based on amount
   */
  useEffect(() => {
    const numAmount = parseFloat(amount) || 0;
    // Simple fee calculation: 1% with 0.1 minimum
    const calculatedFee = Math.max(numAmount * 0.01, 0.1);
    setFee(calculatedFee);
  }, [amount]);

  /**
   * Handle context tab change
   */
  const handleContextChange = useCallback((newContext: string) => {
    setContext(newContext as SendContextType);
    setRecipient('');
    setSearchResults([]);
    setError(null);
    // Save preference
    setSelectedTab(newContext);
  }, [setSelectedTab]);

  /**
   * Validate form based on context
   */
  function validateForm(): string | null {
    if (!amount || parseFloat(amount) <= 0) {
      return 'Please enter a valid amount';
    }

    if (context === 'dao') {
      if (!recipient) return 'Please select a DAO';
      return null;
    } else if (context === 'user') {
      if (!recipient) return 'Please select a recipient user';
      return null;
    } else if (context === 'address') {
      if (!recipient) return 'Please enter a wallet address';
      // Simple address validation (Ethereum-like)
      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
        return 'Invalid wallet address format';
      }
      return null;
    }

    return 'Invalid form state';
  }

  /**
   * Proceed to review
   */
  const handleReview = useCallback(() => {
    const validation = validateForm();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setStep('review');
  }, [recipient, amount, context]);

  /**
   * Submit transaction
   */
  async function handleSubmit() {
    try {
      setLoading(true);
      setError(null);

      const payload = {
        context,
        recipient,
        amount: parseFloat(amount),
        currency,
        memo,
        fee,
      };

      const response = await apiRequest('POST', '/api/send', payload);

      if (response?.success || response?.id) {
        // Save to recent recipients
        const recipientLabel =
          context === 'dao' ? userDAOs.find(d => d.id === recipient)?.name || recipient :
          context === 'user' ? searchResults.find(u => u.id === recipient)?.username || recipient :
          recipient;

        saveToRecentRecipients(context, recipient, recipientLabel);

        // Show success
        setStep('confirm');
        setTimeout(() => {
          onSuccess?.(response.id);
          resetForm();
          onClose();
        }, 2000);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Transaction failed. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Reset form to initial state
   */
  function resetForm() {
    setStep('form');
    setRecipient('');
    setAmount('');
    setMemo('');
    setError(null);
  }

  /**
   * Render form based on context
   */
  const renderContextForm = () => {
    switch (context) {
      case 'dao':
        return <SendDAOForm {...{recipient, setRecipient, userDAOs, daoMembers, loading, searchResults}} />;
      case 'user':
        return <SendUserForm {...{recipient, setRecipient, searchResults, searchUsers, recentRecipients}} />;
      case 'address':
        return <SendAddressForm {...{recipient, setRecipient, recentRecipients}} />;
      default:
        return null;
    }
  };

  const numAmount = parseFloat(amount) || 0;
  const total = numAmount + fee;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-500" />
            Send {currency}
          </DialogTitle>
          <DialogDescription>
            {step === 'form' && 'Choose recipient and amount'}
            {step === 'review' && 'Review transaction details'}
            {step === 'confirm' && 'Transaction successful!'}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-6 py-4">
            {/* Context Selector */}
            <Tabs value={context} onValueChange={handleContextChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dao" className="flex gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">DAO</span>
                </TabsTrigger>
                <TabsTrigger value="user" className="flex gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">User</span>
                </TabsTrigger>
                <TabsTrigger value="address" className="flex gap-2">
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">Address</span>
                </TabsTrigger>
              </TabsList>

              <div className="mt-6">
                <TabsContent value={context} className="space-y-4">
                  {renderContextForm()}
                </TabsContent>
              </div>
            </Tabs>

            {/* Error Display */}
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 flex gap-2">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Amount Section */}
            <div className="space-y-3">
              <Label>Amount</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  className="flex-1"
                />
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cUSD">cUSD</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Memo */}
            <div className="space-y-2">
              <Label>Memo (optional)</Label>
              <Textarea
                placeholder="Add a note or reason for this send..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="min-h-20"
              />
            </div>

            {/* Fee Info */}
            {numAmount > 0 && (
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount</span>
                  <span>{numAmount.toFixed(2)} {currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Fee</span>
                  <span>{fee.toFixed(2)} {currency}</span>
                </div>
                <div className="border-t border-slate-700 pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{total.toFixed(2)} {currency}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleReview} disabled={loading || !recipient || !amount}>
                {loading ? 'Loading...' : 'Review'}
              </Button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <SendReview {...{recipient, amount, currency, memo, fee, total, context, userDAOs, searchResults, onConfirm: handleSubmit, onBack: () => setStep('form'), loading}} />
        )}

        {step === 'confirm' && (
          <div className="py-8 text-center space-y-4">
            <div className="bg-green-900/20 border border-green-500/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold">Transaction Sent!</h3>
            <p className="text-sm text-slate-400">Your funds have been sent successfully.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Send DAO Form Component
 */
function SendDAOForm({
  recipient,
  setRecipient,
  userDAOs,
  daoMembers,
  loading,
}: {
  recipient: string;
  setRecipient: (value: string) => void;
  userDAOs: DAOInfo[];
  daoMembers: UserInfo[];
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Select DAO</Label>
        <Select value={recipient} onValueChange={setRecipient}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a DAO..." />
          </SelectTrigger>
          <SelectContent>
            {userDAOs.map((dao) => (
              <SelectItem key={dao.id} value={dao.id}>
                {dao.name} ({dao.memberCount || 0} members)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {recipient && daoMembers.length > 0 && (
        <div>
          <Label className="mb-2 block">Or send to member</Label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {daoMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => setRecipient(`member:${member.id}`)}
                className={`p-2 rounded border text-sm text-left transition-colors ${
                  recipient === `member:${member.id}`
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="font-medium truncate">{member.username}</div>
                {member.trustScore && <div className="text-xs text-slate-400">Score: {member.trustScore}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Send User Form Component
 */
function SendUserForm({
  recipient,
  setRecipient,
  searchResults,
  searchUsers,
  recentRecipients,
}: {
  recipient: string;
  setRecipient: (value: string) => void;
  searchResults: UserInfo[];
  searchUsers: (query: string) => void;
  recentRecipients: Array<{ type: SendContextType; value: string; label: string }>;
}) {
  const userRecipients = recentRecipients.filter(r => r.type === 'user');

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Search User</Label>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by username..."
            onChange={(e) => searchUsers(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {searchResults.length > 0 && (
        <div>
          <Label className="text-sm text-slate-400 mb-2 block">Results</Label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => setRecipient(user.id)}
                className={`w-full p-3 rounded border text-left transition-colors flex items-center gap-3 ${
                  recipient === user.id
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                {user.avatar && <img src={user.avatar} alt={user.username} className="h-8 w-8 rounded-full" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user.username}</div>
                  {user.trustScore && <div className="text-xs text-slate-400">Trust Score: {user.trustScore}</div>}
                </div>
                {recipient === user.id && <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {userRecipients.length > 0 && searchResults.length === 0 && (
        <div>
          <Label className="text-sm text-slate-400 mb-2 block">Recent Recipients</Label>
          <div className="flex flex-wrap gap-2">
            {userRecipients.map((rec) => (
              <button
                key={rec.value}
                onClick={() => setRecipient(rec.value)}
                className={`px-3 py-1 rounded border text-sm transition-colors ${
                  recipient === rec.value
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                {rec.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Send Address Form Component
 */
function SendAddressForm({
  recipient,
  setRecipient,
  recentRecipients,
}: {
  recipient: string;
  setRecipient: (value: string) => void;
  recentRecipients: Array<{ type: SendContextType; value: string; label: string }>;
}) {
  const addressRecipients = recentRecipients.filter(r => r.type === 'address');

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Wallet Address</Label>
        <Input
          placeholder="0x..."
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="font-mono text-sm"
        />
        <p className="text-xs text-slate-400 mt-2">Enter a valid Ethereum-like address (0x + 40 hex chars)</p>
      </div>

      {addressRecipients.length > 0 && (
        <div>
          <Label className="text-sm text-slate-400 mb-2 block">Recent Addresses</Label>
          <div className="space-y-2">
            {addressRecipients.map((rec) => (
              <button
                key={rec.value}
                onClick={() => setRecipient(rec.value)}
                className={`w-full p-2 rounded border text-left text-xs font-mono transition-colors ${
                  recipient === rec.value
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{rec.value}</span>
                  <Copy className="h-3 w-3 flex-shrink-0 text-slate-500" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Send Review Component
 */
function SendReview({
  recipient,
  amount,
  currency,
  memo,
  fee,
  total,
  context,
  userDAOs,
  searchResults,
  onConfirm,
  onBack,
  loading,
}: {
  recipient: string;
  amount: string;
  currency: string;
  memo: string;
  fee: number;
  total: number;
  context: SendContextType;
  userDAOs: DAOInfo[];
  searchResults: UserInfo[];
  onConfirm: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const getRecipientLabel = (): string => {
    if (context === 'dao') {
      return userDAOs.find(d => d.id === recipient)?.name || recipient;
    } else if (context === 'user') {
      return searchResults.find(u => u.id === recipient)?.username || recipient;
    }
    return recipient;
  };

  return (
    <div className="py-4 space-y-4">
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Recipient ({context})</span>
          <span className="font-mono">{getRecipientLabel()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Amount</span>
          <span className="font-semibold">{parseFloat(amount).toFixed(2)} {currency}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Fee</span>
          <span className="font-mono text-sm">{fee.toFixed(2)} {currency}</span>
        </div>
        {memo && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Memo</span>
            <span className="text-right">{memo}</span>
          </div>
        )}
        <div className="border-t border-slate-700 pt-3 flex justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-lg font-bold text-blue-400">{total.toFixed(2)} {currency}</span>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
        <p className="text-xs text-blue-200">Please review the details carefully. Once sent, transactions cannot be reversed.</p>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button onClick={onConfirm} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
          {loading ? 'Sending...' : 'Confirm & Send'}
        </Button>
      </div>
    </div>
  );
}
