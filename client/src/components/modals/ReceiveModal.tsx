import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTabs,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Copy,
  Check,
  Share2,
  QrCode,
  Link as LinkIcon,
  ArrowDownLeft,
  Clock,
  AlertCircle,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useSubprofilePreferences } from '@/contexts/persona-context';
import { useAuth } from '@/pages/hooks/useAuth';

/**
 * Receive Modal Component
 * 
 * Features:
 * - Display wallet address with copy button
 * - Generate QR code for easy scanning
 * - Create shareable receive links
 * - Request specific amounts
 * - Track receive requests
 * - View receive history
 */

interface ReceiveLink {
  id: string;
  link: string;
  amount?: number;
  description?: string;
  expiresAt?: Date;
  createdAt: Date;
}

interface ReceiveRequest {
  id: string;
  requester: string;
  amount?: number;
  description?: string;
  status: 'pending' | 'received' | 'expired';
  createdAt: Date;
  receivedAt?: Date;
}

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string;
}

/**
 * QR Code Component using canvas-based generation
 */
function QRCodeComponent({ value }: { value: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(value, {
          width: 200,
          errorCorrectionLevel: 'H',
          margin: 1,
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      }
    };

    generateQRCode();
  }, [value]);

  if (!qrDataUrl) {
    return <div className="h-[200px] w-[200px] bg-slate-700 rounded-lg animate-pulse" />;
  }

  return (
    <div className="flex justify-center bg-white rounded-lg p-4">
      <img src={qrDataUrl} alt="QR Code" className="h-[200px] w-[200px]" />
    </div>
  );
}

/**
 * Main Receive Modal Component
 */
export function ReceiveModal({
  isOpen,
  onClose,
  walletAddress: initialAddress = '',
}: ReceiveModalProps) {
  const { user } = useAuth();
  const { setSelectedTab, getSelectedTab } = useSubprofilePreferences();
  
  // Tabs
  const lastTab = getSelectedTab() || 'address';
  const [activeTab, setActiveTab] = useState<'address' | 'link' | 'request' | 'history'>(lastTab as any);

  // State
  const [walletAddress, setWalletAddress] = useState(initialAddress);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [receiveLinks, setReceiveLinks] = useState<ReceiveLink[]>([]);
  const [receiveRequests, setReceiveRequests] = useState<ReceiveRequest[]>([]);
  const [receiveHistory, setReceiveHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link creation state
  const [linkAmount, setLinkAmount] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkExpiry, setLinkExpiry] = useState('7'); // days

  // Request state
  const [requestAmount, setRequestAmount] = useState('');
  const [requestDescription, setRequestDescription] = useState('');

  // Load wallet address and history on mount
  useEffect(() => {
    if (isOpen) {
      loadWalletAddress();
      loadReceiveHistory();
      loadReceiveRequests();
    }
  }, [isOpen]);

  /**
   * Load user's wallet address
   */
  async function loadWalletAddress() {
    try {
      // In a real app, fetch from API or user context
      const address = walletAddress || user?.walletAddress || '';
      setWalletAddress(address);
    } catch (err) {
      console.error('Failed to load wallet address:', err);
    }
  }

  /**
   * Load receive history
   */
  async function loadReceiveHistory() {
    try {
      setLoading(true);
      // const response = await apiRequest('GET', '/api/receive/history');
      // Placeholder data
      setReceiveHistory([]);
    } catch (err) {
      console.error('Failed to load receive history:', err);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Load receive requests
   */
  async function loadReceiveRequests() {
    try {
      const response = await fetch('/api/payment-requests?type=received');
      
      if (!response.ok) {
        console.error('Failed to load requests');
        return;
      }

      const data = await response.json();
      
      if (data.success && data.requests) {
        const formattedRequests: ReceiveRequest[] = data.requests.map((req: any) => ({
          id: req.id,
          requester: user?.username || 'You',
          amount: parseFloat(req.amount),
          description: req.description,
          status: req.status,
          createdAt: new Date(req.createdAt),
        }));
        
        setReceiveRequests(formattedRequests);
      }
    } catch (err) {
      console.error('Failed to load receive requests:', err);
    }
  }

  /**
   * Load receive links
   */
  async function loadReceiveLinks() {
    try {
      // const response = await apiRequest('GET', '/api/receive/links');
      // Placeholder
      setReceiveLinks([]);
    } catch (err) {
      console.error('Failed to load receive links:', err);
    }
  }

  /**
   * Copy wallet address to clipboard
   */
  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
      setError('Failed to copy address');
    }
  }, [walletAddress]);

  /**
   * Create receive link
   */
  async function handleCreateLink() {
    try {
      setLoading(true);
      setError(null);

      const payload = {
        amount: linkAmount ? parseFloat(linkAmount) : undefined,
        description: linkDescription,
        expiryDays: parseInt(linkExpiry),
      };

      // const response = await apiRequest('POST', '/api/receive/links', payload);
      // Placeholder
      const mockLink: ReceiveLink = {
        id: Math.random().toString(36).substr(2, 9),
        link: `https://mtaa.io/receive/${Math.random().toString(36).substr(2, 9)}`,
        amount: linkAmount ? parseFloat(linkAmount) : undefined,
        description: linkDescription,
        expiresAt: new Date(Date.now() + parseInt(linkExpiry) * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };

      setReceiveLinks([mockLink, ...receiveLinks]);
      setLinkAmount('');
      setLinkDescription('');
      setLinkExpiry('7');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create link';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Create receive request
   */
  async function handleCreateRequest() {
    try {
      setLoading(true);
      setError(null);

      if (!requestAmount || parseFloat(requestAmount) <= 0) {
        setError('Please enter a valid amount');
        setLoading(false);
        return;
      }

      const payload = {
        amount: parseFloat(requestAmount),
        currency: 'cUSD',
        description: requestDescription || undefined,
        expiresInDays: 7,
      };

      // Call API to create payment request
      const response = await fetch('/api/payment-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create request');
      }

      const data = await response.json();

      // Add to requests list
      const newRequest: ReceiveRequest = {
        id: data.paymentRequest.id,
        requester: user?.username || 'You',
        amount: parseFloat(requestAmount),
        description: requestDescription,
        status: 'pending',
        createdAt: new Date(),
      };

      setReceiveRequests([newRequest, ...receiveRequests]);
      setRequestAmount('');
      setRequestDescription('');
      
      // Show success message with share link
      if (window?.analytics) {
        window.analytics.track('Payment Request Created', {
          amount: requestAmount,
          currency: 'cUSD',
          description: requestDescription,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Copy link to clipboard
   */
  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
    setSelectedTab(tab);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-green-500" />
            Receive Funds
          </DialogTitle>
          <DialogDescription>
            Receive payments in multiple ways
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="address">Address</TabsTrigger>
            <TabsTrigger value="link">Links</TabsTrigger>
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Address Tab */}
          <TabsContent value="address" className="space-y-4 py-4">
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-4">
              <div>
                <Label className="text-sm text-slate-400 mb-2 block">Your Wallet Address</Label>
                <div className="flex gap-2">
                  <Input
                    value={walletAddress}
                    readOnly
                    className="font-mono text-sm bg-slate-800 text-slate-300"
                  />
                  <Button
                    size="icon"
                    onClick={handleCopyAddress}
                    variant="outline"
                    className={copied ? 'bg-green-600/20 border-green-500' : ''}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowQR(!showQR)}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <QrCode className="h-4 w-4" />
                  {showQR ? 'Hide QR' : 'Show QR'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleCopyLink(walletAddress)}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </div>

              {showQR && walletAddress && (
                <QRCodeComponent value={`ethereum:${walletAddress}`} />
              )}

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-200">
                  Share your wallet address with anyone to receive funds. Funds will appear in your account after blockchain confirmation.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Links Tab */}
          <TabsContent value="link" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Create Receive Link</h3>
                
                <div>
                  <Label className="text-sm mb-2 block">Amount (optional)</Label>
                  <Input
                    type="number"
                    placeholder="Leave empty for open-ended"
                    value={linkAmount}
                    onChange={(e) => setLinkAmount(e.target.value)}
                    step="0.01"
                    min="0"
                  />
                </div>

                <div>
                  <Label className="text-sm mb-2 block">Description (optional)</Label>
                  <Textarea
                    placeholder="e.g., Payment for services..."
                    value={linkDescription}
                    onChange={(e) => setLinkDescription(e.target.value)}
                    className="min-h-16"
                  />
                </div>

                <div>
                  <Label className="text-sm mb-2 block">Expiry (days)</Label>
                  <Input
                    type="number"
                    value={linkExpiry}
                    onChange={(e) => setLinkExpiry(e.target.value)}
                    min="1"
                    max="365"
                  />
                </div>

                {error && (
                  <div className="bg-red-900/20 border border-red-500/50 rounded p-2 flex gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-200">{error}</p>
                  </div>
                )}

                <Button
                  onClick={handleCreateLink}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'Creating...' : 'Create Link'}
                </Button>
              </div>

              {/* Existing Links */}
              {receiveLinks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Your Links</h3>
                  {receiveLinks.map((link) => (
                    <div key={link.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {link.amount && (
                            <p className="text-sm font-semibold">{link.amount} cUSD</p>
                          )}
                          {link.description && (
                            <p className="text-xs text-slate-400">{link.description}</p>
                          )}
                          <p className="text-xs text-slate-500 font-mono truncate">{link.link}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopyLink(link.link)}
                          className="flex-shrink-0"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      {link.expiresAt && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="h-3 w-3" />
                          Expires {new Date(link.expiresAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Request Tab */}
          <TabsContent value="request" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Request Funds</h3>
                
                <div>
                  <Label className="text-sm mb-2 block">Amount (optional)</Label>
                  <Input
                    type="number"
                    placeholder="Leave empty for flexible amount"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    step="0.01"
                    min="0"
                  />
                </div>

                <div>
                  <Label className="text-sm mb-2 block">Description</Label>
                  <Textarea
                    placeholder="What is this request for?"
                    value={requestDescription}
                    onChange={(e) => setRequestDescription(e.target.value)}
                    className="min-h-16"
                  />
                </div>

                <Button
                  onClick={handleCreateRequest}
                  disabled={loading || !requestDescription}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Creating...' : 'Request Funds'}
                </Button>
              </div>

              {/* Existing Requests */}
              {receiveRequests.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Active Requests</h3>
                  {receiveRequests.map((req) => (
                    <div key={req.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          {req.amount && (
                            <p className="text-sm font-semibold">{req.amount} cUSD</p>
                          )}
                          {req.description && (
                            <p className="text-xs text-slate-400">{req.description}</p>
                          )}
                        </div>
                        <Badge
                          className={
                            req.status === 'received'
                              ? 'bg-green-600/40 text-green-200'
                              : req.status === 'expired'
                              ? 'bg-red-600/40 text-red-200'
                              : 'bg-yellow-600/40 text-yellow-200'
                          }
                        >
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        Created {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4 py-4">
            {receiveHistory.length === 0 ? (
              <div className="text-center py-8">
                <ArrowDownLeft className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                <p className="text-slate-400">No receive history yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {receiveHistory.map((tx, idx) => (
                  <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{tx.from}</p>
                      <p className="text-xs text-slate-400">{new Date(tx.date).toLocaleString()}</p>
                    </div>
                    <p className="text-green-400 font-semibold text-right">+{tx.amount} {tx.currency}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
