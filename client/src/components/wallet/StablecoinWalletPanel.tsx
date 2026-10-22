import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Copy, Loader2, RefreshCw, Send, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { AuthApiError, authClient } from '@/utils/authClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  connectWallet,
  currentNetwork,
  getNativeBalance,
  getStablecoinAsset,
  getStablecoinBalance,
  getWalletNetwork,
  isValidCeloAddress,
  parseUnits,
  sendStablecoin,
  switchToWalletNetwork,
  SUPPORTED_STABLECOIN_ASSETS,
} from '@/lib/blockchain';

interface StablecoinWalletPanelProps {
  mode: 'receive' | 'send';
}

interface RampTransaction {
  referenceId: string;
  direction: 'onramp' | 'offramp';
  status: string;
  fiatAmount: string;
  fiatCurrency: string;
  cryptoAmount: string;
  token: string;
  chain: string;
  quoteExpiresAt?: string;
  walletAddress?: string;
  depositAddress?: string;
  transactionHash?: string;
  refundTransactionHash?: string;
  cryptoAmountSettled?: string;
  fiatAmountSettled?: string;
  onchainStatus?: string;
  fiatStatus?: string;
  createdAt?: string;
}

interface RampAvailability {
  enabled: boolean;
  chain: string;
  token: string;
}

interface InjectedEthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(eventName: string, listener: (...args: unknown[]) => void): void;
  removeListener?(eventName: string, listener: (...args: unknown[]) => void): void;
}

function getInjectedProvider(): InjectedEthereumProvider | undefined {
  return (window as Window & { ethereum?: InjectedEthereumProvider }).ethereum;
}

export default function StablecoinWalletPanel({ mode }: StablecoinWalletPanelProps) {
  const [walletAddress, setWalletAddress] = useState<string>();
  const [chainId, setChainId] = useState<number>();
  const [selectedAssetId, setSelectedAssetId] = useState(
    currentNetwork.id === 44787 ? 'alfajores-testnet-cusd' : 'celo-mainnet-cusd',
  );
  const selectedAsset = getStablecoinAsset(selectedAssetId);
  const selectedNetwork = getWalletNetwork(selectedAsset.chainId);
  if (!selectedNetwork) throw new Error(`No wallet network is configured for ${selectedAsset.chainName}.`);
  const balanceRequestId = useRef(0);
  const [balance, setBalance] = useState<string>();
  const [nativeBalance, setNativeBalance] = useState<string>();
  const [balanceError, setBalanceError] = useState<string>();
  const [nativeBalanceError, setNativeBalanceError] = useState<string>();
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [transactionHash, setTransactionHash] = useState<string>();
  const [offrampTransactionHash, setOfframpTransactionHash] = useState<string>();
  const [walletError, setWalletError] = useState<string>();
  const [rampPhone, setRampPhone] = useState('');
  const [rampAmount, setRampAmount] = useState('');
  const [rampQuote, setRampQuote] = useState<RampTransaction>();
  const [rampReferenceId, setRampReferenceId] = useState<string>();

  const rampAvailabilityQuery = useQuery<RampAvailability>({
    queryKey: ['selfCustodyRampAvailability'],
    queryFn: () => authClient.get<RampAvailability>('/api/v1/wallets/self-custody-ramps/availability'),
    staleTime: 60_000,
  });

  const rampStatusQuery = useQuery<RampTransaction>({
    queryKey: ['selfCustodyRampStatus', rampReferenceId],
    queryFn: () => authClient.get<RampTransaction>(`/api/v1/wallets/self-custody-ramps/${rampReferenceId}`),
    enabled: Boolean(rampReferenceId),
    refetchInterval: (query) => ['pending', 'processing', 'initiating', 'initiation_unknown', 'reconciliation_required', 'refund_pending'].includes(query.state.data?.status ?? '') ? 5_000 : false,
  });
  const rampHistoryQuery = useQuery<RampTransaction[]>({
    queryKey: ['selfCustodyRampHistory'],
    queryFn: () => authClient.get<RampTransaction[]>('/api/v1/wallets/self-custody-ramps/history'),
    enabled: Boolean(walletAddress),
    staleTime: 5_000,
    refetchInterval: 30_000,
  });

  const refreshWallet = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) return;
    const [accounts, activeChain] = await Promise.all([
      provider.request({ method: 'eth_accounts' }),
      provider.request({ method: 'eth_chainId' }),
    ]);
    setWalletAddress(Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : undefined);
    setChainId(typeof activeChain === 'string' ? Number.parseInt(activeChain, 16) : undefined);
  }, []);

  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0];
      setWalletAddress(Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : undefined);
      setTransactionHash(undefined);
      setWalletError(undefined);
    };
    const handleChainChanged = (...args: unknown[]) => {
      const changedChainId = args[0];
      setChainId(typeof changedChainId === 'string' ? Number.parseInt(changedChainId, 16) : undefined);
      setBalance(undefined);
      setTransactionHash(undefined);
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);
    void refreshWallet().catch((error: unknown) => {
      setWalletError(error instanceof Error ? error.message : 'Could not read the connected wallet.');
    });

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [refreshWallet]);

  const refreshBalance = useCallback(async () => {
    const requestId = ++balanceRequestId.current;
    if (!walletAddress || chainId !== selectedAsset.chainId) {
      setBalance(undefined);
      setNativeBalance(undefined);
      setBalanceError(undefined);
      setNativeBalanceError(undefined);
      setIsLoadingBalances(false);
      return;
    }
    setBalance(undefined);
    setNativeBalance(undefined);
    setBalanceError(undefined);
    setNativeBalanceError(undefined);
    setIsLoadingBalances(true);

    try {
      const [stablecoinResult, nativeResult] = await Promise.allSettled([
        getStablecoinBalance(walletAddress, selectedAsset.id),
        getNativeBalance(walletAddress, selectedAsset.chainId),
      ]);
      if (requestId !== balanceRequestId.current) return;
      if (stablecoinResult.status === 'fulfilled') {
        setBalance(stablecoinResult.value);
      } else {
        setBalance(undefined);
        setBalanceError(stablecoinResult.reason instanceof Error ? stablecoinResult.reason.message : `Could not load the on-chain ${selectedAsset.symbol} balance.`);
      }
      if (nativeResult.status === 'fulfilled') {
        setNativeBalance(nativeResult.value);
      } else {
        setNativeBalance(undefined);
        setNativeBalanceError(nativeResult.reason instanceof Error ? nativeResult.reason.message : `Could not load the on-chain ${selectedNetwork.nativeCurrency.symbol} balance.`);
      }
    } finally {
      if (requestId === balanceRequestId.current) setIsLoadingBalances(false);
    }
  }, [chainId, selectedAsset.chainId, selectedAsset.id, selectedAsset.symbol, selectedNetwork.nativeCurrency.symbol, walletAddress]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    if (rampStatusQuery.data?.status === 'completed') void refreshBalance();
  }, [rampStatusQuery.data?.status, refreshBalance]);

  useEffect(() => {
    if (rampReferenceId || !rampHistoryQuery.data) return;
    const activeRamp = rampHistoryQuery.data.find((transaction) =>
      ['pending', 'processing', 'initiating', 'initiation_unknown', 'reconciliation_required', 'refund_pending', 'refund_failed'].includes(transaction.status),
    );
    if (activeRamp) setRampReferenceId(activeRamp.referenceId);
  }, [rampHistoryQuery.data, rampReferenceId]);

  useEffect(() => {
    if (rampStatusQuery.data && !rampQuote) setRampQuote(rampStatusQuery.data);
  }, [rampQuote, rampStatusQuery.data]);

  const connect = async () => {
    try {
      setWalletError(undefined);
      await connectWallet();
      await refreshWallet();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not connect wallet.';
      setWalletError(message);
      toast.error(message);
    }
  };

  const switchNetwork = async () => {
    try {
      setWalletError(undefined);
      await switchToWalletNetwork(selectedAsset.chainId);
      await refreshWallet();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not switch network.';
      setWalletError(message);
      toast.error(message);
    }
  };

  const copyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      toast.success('Wallet address copied');
    } catch {
      toast.error('Could not copy the wallet address. Select and copy it manually.');
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!walletAddress) throw new Error('Connect your wallet first.');
      if (chainId !== selectedAsset.chainId) throw new Error(`Switch to ${selectedAsset.chainName} before sending.`);
      if (!isValidCeloAddress(destination)) throw new Error('Enter a valid EVM destination address.');
      if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)
        || (amount.split('.')[1]?.length ?? 0) > selectedAsset.decimals
        || Number(amount) <= 0) {
        throw new Error(`Enter a positive amount with up to ${selectedAsset.decimals} decimal places.`);
      }
      if (balance === undefined) throw new Error(`Wait for your on-chain ${selectedAsset.symbol} balance to load.`);
      if (parseUnits(amount, selectedAsset.decimals) > parseUnits(balance, selectedAsset.decimals)) {
        throw new Error(`Insufficient ${selectedAsset.symbol} balance.`);
      }
      return sendStablecoin(destination, amount, selectedAsset.id, walletAddress);
    },
    onSuccess: (hash) => {
      setTransactionHash(hash);
      setAmount('');
      setDestination('');
      toast.success(`${selectedAsset.symbol} transfer submitted. Wait for on-chain confirmation.`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Stablecoin transfer failed.'),
  });

  const quoteRampMutation = useMutation({
    mutationFn: async () => {
      if (!walletAddress) throw new Error('Connect your wallet first.');
      if (chainId !== 42220 || selectedAsset.id !== 'celo-mainnet-cusd') {
        throw new Error('KotaniPay M-Pesa ramps currently support cUSD on Celo Mainnet only.');
      }
      if (currentNetwork.id !== 42220) throw new Error('This app build is not configured for Celo Mainnet ramps.');
      if (!/^\+?[1-9]\d{7,14}$/.test(rampPhone)) throw new Error('Enter your M-Pesa phone number in international format.');
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(rampAmount) || Number(rampAmount) <= 0) {
        throw new Error('Enter a positive amount with up to 18 decimal places.');
      }
      const endpoint = mode === 'receive' ? 'onramp' : 'offramp';
      const payload = mode === 'receive'
        ? { phoneNumber: rampPhone, walletAddress, fiatAmount: rampAmount }
        : { phoneNumber: rampPhone, walletAddress, cryptoAmount: rampAmount };
      return authClient.post<RampTransaction>(
        `/api/v1/wallets/self-custody-ramps/${endpoint}/quote`,
        payload,
      );
    },
    onSuccess: (quote) => {
      setRampQuote(quote);
      setRampReferenceId(undefined);
      setOfframpTransactionHash(undefined);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not request a KotaniPay quote.'),
  });

  const initiateRampMutation = useMutation({
    mutationFn: async () => {
      if (!rampQuote) throw new Error('Request a fresh quote first.');
      return authClient.post<RampTransaction>(
        `/api/v1/wallets/self-custody-ramps/${rampQuote.referenceId}/initiate`,
      );
    },
    onSuccess: (transaction) => {
      setRampReferenceId(transaction.referenceId);
      setRampQuote(transaction);
      if (transaction.status === 'completed') {
        toast.success('Ramp settled successfully.');
      } else if (transaction.status === 'pending' || transaction.status === 'processing') {
        toast.success(mode === 'receive' ? 'M-Pesa payment initiated. Complete the STK prompt on your phone.' : 'Cash-out request created. Send the exact cUSD amount to the provided address.');
      } else {
        toast.error(`Ramp requires attention. Current status: ${transaction.status}. Reference: ${transaction.referenceId}`);
      }
    },
    onError: (error) => {
      if (error instanceof AuthApiError && error.code !== 'INITIATION_UNKNOWN') {
        toast.error(error.message);
        return;
      }
      if (rampQuote?.referenceId) setRampReferenceId(rampQuote.referenceId);
      toast.error(`The provider's initiation result may be uncertain. Do not retry or create another ramp until you check this reference: ${rampQuote?.referenceId ?? 'unknown'}. ${error instanceof Error ? error.message : 'Contact support if status remains unresolved.'}`);
    },
  });

  const sendToOfframpMutation = useMutation({
    mutationFn: async () => {
      if (!rampQuote?.depositAddress || !rampQuote.referenceId || !walletAddress) {
        throw new Error('Create a valid offramp request first.');
      }
      if (chainId !== 42220 || selectedAsset.id !== 'celo-mainnet-cusd') {
        throw new Error('KotaniPay offramp only accepts cUSD on Celo Mainnet.');
      }
      if (chainId !== selectedAsset.chainId) throw new Error(`Switch to ${selectedAsset.chainName} before sending.`);
      if (balance === undefined || parseUnits(rampQuote.cryptoAmount, 18) > parseUnits(balance, 18)) {
        throw new Error('Insufficient or unavailable on-chain cUSD balance.');
      }
      const hash = await sendStablecoin(rampQuote.depositAddress, rampQuote.cryptoAmount, 'celo-mainnet-cusd', walletAddress);
      try {
        await authClient.post(
          `/api/v1/wallets/self-custody-ramps/${rampQuote.referenceId}/transaction`,
          { transactionHash: hash },
        );
        return { hash, recorded: true };
      } catch (error) {
        return { hash, recorded: false, recordError: error instanceof Error ? error.message : String(error) };
      }
    },
    onSuccess: ({ hash, recorded, recordError }) => {
      setTransactionHash(hash);
      setOfframpTransactionHash(hash);
      if (recorded) {
        toast.success('cUSD transfer submitted. KotaniPay must confirm the on-chain and M-Pesa legs.');
      } else {
        toast.error(`Your wallet submitted the transfer (${hash}), but we could not record it: ${recordError}. Do not send again; check the status or contact support.`);
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not submit the offramp transfer.'),
  });

  const explorerBase = selectedAsset.explorerUrl;
  const rampStatus = rampStatusQuery.data;
  const rampAvailable = rampAvailabilityQuery.data?.enabled === true
    && currentNetwork.id === 42220
    && chainId === 42220
    && selectedAsset.id === 'celo-mainnet-cusd';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {mode === 'receive' ? <Wallet className="h-5 w-5" /> : <Send className="h-5 w-5" />}
          On-chain wallet · {mode === 'receive' ? `Receive ${selectedAsset.symbol}` : `Send ${selectedAsset.symbol}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            These are balances in your connected self-custody wallet on the selected network. They are separate from any MtaaDAO platform balance; no cross-chain swap or M-Pesa conversion is implied.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{selectedAsset.chainName}</p>
            <p className="text-sm text-muted-foreground">
              {selectedAsset.chainId === 44787
                ? 'Testnet cUSD — not redeemable for cash'
                : `${selectedAsset.symbol} · ${selectedAsset.decimals} decimals`}
            </p>
          </div>
          {walletAddress ? (
            <Button variant="outline" size="sm" onClick={() => void refreshBalance()} disabled={chainId !== selectedAsset.chainId}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh balance
            </Button>
          ) : (
            <Button onClick={() => void connect()}>
              <Wallet className="mr-2 h-4 w-4" />
              Connect wallet
            </Button>
          )}
        </div>

        {walletError && <p role="alert" className="text-sm text-destructive">{walletError}</p>}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`stablecoin-asset-${mode}`}>Stablecoin and network</label>
          <select
            id={`stablecoin-asset-${mode}`}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedAsset.id}
            disabled={Boolean(rampReferenceId)}
            onChange={(event) => setSelectedAssetId(event.target.value)}
          >
            {SUPPORTED_STABLECOIN_ASSETS.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.symbol} · {asset.chainName}
              </option>
            ))}
          </select>
          <p className="break-all text-xs text-muted-foreground">
            Canonical token contract: <span className="font-mono">{selectedAsset.address}</span>
          </p>
        </div>

        {walletAddress && (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`stablecoin-address-${mode}`}>Your wallet address</label>
            <div className="flex gap-2">
              <Input id={`stablecoin-address-${mode}`} readOnly value={walletAddress} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={() => void copyAddress()} aria-label="Copy wallet address">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {chainId === selectedAsset.chainId ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">On-chain {selectedAsset.symbol}</p>
                  <p className="font-medium">{isLoadingBalances ? 'Loading…' : balance === undefined ? 'Unavailable' : `${Number(balance).toFixed(4)} ${selectedAsset.symbol}`}</p>
                  {balanceError && <p role="alert" className="text-xs text-destructive">{balanceError}</p>}
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">On-chain {selectedNetwork.nativeCurrency.symbol} · network fees</p>
                  <p className="font-medium">{isLoadingBalances ? 'Loading…' : nativeBalance === undefined ? 'Unavailable' : `${Number(nativeBalance).toFixed(4)} ${selectedNetwork.nativeCurrency.symbol}`}</p>
                  {nativeBalanceError && <p role="alert" className="text-xs text-destructive">{nativeBalanceError}</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-amber-700">Your wallet is on a different network. Switch before sending or checking this asset’s balance.</p>
                <Button type="button" variant="outline" onClick={() => void switchNetwork()}>Switch to {selectedAsset.chainName}</Button>
              </div>
            )}
            {mode === 'receive' && (
              <p className="text-xs text-amber-700">
                Only send {selectedAsset.symbol} on {selectedAsset.chainName} using the contract shown above. EVM addresses look alike across networks; a wrong network or token may be unrecoverable.
              </p>
            )}
          </div>
        )}

        {walletAddress && (
          <div className="space-y-3 border-t pt-4">
            <h3 className="font-medium">
              {mode === 'receive' ? 'M-Pesa → your on-chain wallet' : 'Your on-chain wallet → M-Pesa'}
            </h3>
            {rampAvailabilityQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Checking provider ramp availability…</p>
            ) : rampAvailabilityQuery.isError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Could not check provider availability: {(rampAvailabilityQuery.error as Error).message}
                  <Button className="ml-2" variant="outline" size="sm" onClick={() => void rampAvailabilityQuery.refetch()}>Retry</Button>
                </AlertDescription>
              </Alert>
            ) : !rampAvailable ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {selectedAsset.id !== 'celo-mainnet-cusd'
                    ? 'M-Pesa ramps currently support only cUSD on Celo Mainnet. Choose that exact stablecoin/network pair; USDC and USDT are not accepted by this cash-out route.'
                    : currentNetwork.id !== 42220
                      ? 'This app build selects Alfajores for the ramp configuration. Do not start a cash-in or cash-out against a testnet wallet.'
                      : chainId !== 42220
                        ? 'Switch the connected wallet to Celo Mainnet before starting the cUSD M-Pesa ramp.'
                        : 'KotaniPay self-custody ramps are not enabled on this deployment. Direct wallet transfers remain available; no platform-ledger balance is used here.'}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor={`ramp-phone-${mode}`}>M-Pesa phone number</label>
                  <Input
                    id={`ramp-phone-${mode}`}
                    inputMode="tel"
                    placeholder="+2547XXXXXXXX"
                    value={rampPhone}
                    onChange={(event) => setRampPhone(event.target.value.trim())}
                    disabled={Boolean(rampReferenceId)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor={`ramp-amount-${mode}`}>
                    {mode === 'receive' ? 'Amount to pay (KES)' : 'cUSD to cash out'}
                  </label>
                  <Input
                    id={`ramp-amount-${mode}`}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={rampAmount}
                    onChange={(event) => setRampAmount(event.target.value)}
                    disabled={Boolean(rampReferenceId)}
                  />
                </div>
                {!rampQuote && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={quoteRampMutation.isPending || chainId !== 42220 || currentNetwork.id !== 42220}
                    onClick={() => quoteRampMutation.mutate()}
                  >
                    {quoteRampMutation.isPending ? 'Getting provider quote…' : 'Get live KotaniPay quote'}
                  </Button>
                )}
                {rampQuote && !rampReferenceId && (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium">
                      Review provider quote
                      {rampQuote.quoteExpiresAt
                        ? ` · expires at ${new Date(rampQuote.quoteExpiresAt).toLocaleTimeString()}`
                        : ' · valid for about 10 minutes'}
                    </p>
                    {mode === 'receive' ? (
                      <p className="text-sm">Pay {rampQuote.fiatAmount} KES; estimated delivery {rampQuote.cryptoAmount} {rampQuote.token} to your wallet.</p>
                    ) : (
                      <p className="text-sm">Send exactly {rampQuote.cryptoAmount} {rampQuote.token}; estimated payout {rampQuote.fiatAmount} {rampQuote.fiatCurrency} to {rampPhone}.</p>
                    )}
                    <p className="text-xs text-muted-foreground">Final settlement depends on provider and network confirmation. The platform balance is not involved.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => initiateRampMutation.mutate()} disabled={initiateRampMutation.isPending}>
                        {initiateRampMutation.isPending ? 'Starting…' : mode === 'receive' ? 'Start M-Pesa payment' : 'Create M-Pesa cash-out'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setRampQuote(undefined)}>Discard quote</Button>
                    </div>
                  </div>
                )}
                {rampQuote?.depositAddress && rampReferenceId && (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium">Send the exact quoted amount from your connected wallet</p>
                    <p className="text-sm">{rampQuote.cryptoAmount} {rampQuote.token} on {rampQuote.chain}</p>
                    <Input readOnly value={rampQuote.depositAddress} className="font-mono text-xs" aria-label="KotaniPay offramp deposit address" />
                    <Button
                      type="button"
                      onClick={() => sendToOfframpMutation.mutate()}
                      disabled={sendToOfframpMutation.isPending || Boolean(offrampTransactionHash) || chainId !== 42220 || currentNetwork.id !== 42220}
                    >
                      {sendToOfframpMutation.isPending ? 'Waiting for wallet…' : offrampTransactionHash ? 'Transfer submitted' : 'Send exact cUSD from my wallet'}
                    </Button>
                    {offrampTransactionHash && (
                      <p className="break-all text-xs text-muted-foreground">
                        Transfer submitted: {explorerBase
                          ? <a className="underline" href={`${explorerBase}/tx/${offrampTransactionHash}`} target="_blank" rel="noreferrer">view transaction</a>
                          : offrampTransactionHash}
                      </p>
                    )}
                  </div>
                )}
                {rampReferenceId && (
                  <div className="space-y-1 text-sm" aria-live="polite">
                    <p>Ramp status: <strong>{rampStatus?.status ?? 'pending'}</strong></p>
                    {rampStatusQuery.isError && <p role="alert" className="text-destructive">Could not refresh status: {(rampStatusQuery.error as Error).message}</p>}
                    {rampStatus?.status === 'completed' && (
                      <p className="text-green-700">
                        {mode === 'receive'
                          ? `On-chain delivery confirmed: ${rampStatus.cryptoAmountSettled ?? rampQuote?.cryptoAmount ?? ''} cUSD.`
                          : `Provider reports the M-Pesa cash-out settled: ${rampStatus.fiatAmountSettled ?? rampQuote?.fiatAmount ?? ''} KES.`}
                      </p>
                    )}
                    {rampStatus?.status === 'reconciliation_required' && (
                      <p role="alert" className="text-amber-700">
                        Provider reported settlement, but the amount, asset, address, or transaction details did not match the quote. Do not retry; support reconciliation is required.
                      </p>
                    )}
                    {rampStatus?.status === 'refund_pending' && (
                      <p role="status" className="text-amber-700">M-Pesa payout did not complete; KotaniPay reports the cUSD refund is pending. Do not retry until the refund status is resolved.</p>
                    )}
                    {rampStatus?.status === 'initiation_unknown' && (
                      <p role="alert" className="text-amber-700">Provider acceptance could not be confirmed. Do not retry or create a duplicate; contact support with reference {rampReferenceId}.</p>
                    )}
                    {rampStatus?.status === 'refund_failed' && (
                      <p role="alert" className="text-destructive">KotaniPay reports the cUSD refund failed. Contact support with reference {rampReferenceId} before retrying.</p>
                    )}
                    {rampStatus?.status === 'failed' && (
                      <p role="alert" className="text-destructive">Provider reported the ramp did not complete. Check the provider status before starting another transaction.</p>
                    )}
                    {rampStatus?.status === 'refunded' && (
                      <p role="status">KotaniPay confirmed the cUSD refund to your wallet. Verify it with the on-chain transaction link below before continuing.</p>
                    )}
                    {['completed', 'failed', 'refunded'].includes(rampStatus?.status ?? '') && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRampReferenceId(undefined);
                          setRampQuote(undefined);
                          setRampAmount('');
                          setOfframpTransactionHash(undefined);
                        }}
                      >
                        Start another ramp
                      </Button>
                    )}
                    {rampStatus?.transactionHash && explorerBase && (
                      <a className="underline" href={`${explorerBase}/tx/${rampStatus.transactionHash}`} target="_blank" rel="noreferrer">
                        View on-chain transaction
                      </a>
                    )}
                    {rampStatus?.refundTransactionHash && explorerBase && (
                      <a className="underline" href={`${explorerBase}/tx/${rampStatus.refundTransactionHash}`} target="_blank" rel="noreferrer">
                        View confirmed cUSD refund
                      </a>
                    )}
                  </div>
                )}
              </>
            )}
            {rampHistoryQuery.isError && (
              <p role="alert" className="text-xs text-destructive">
                Could not load prior ramp activity: {(rampHistoryQuery.error as Error).message}
              </p>
            )}
          </div>
        )}

        {mode === 'send' && walletAddress && (
          <form
            className="space-y-3 border-t pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              sendMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="stablecoin-destination">Recipient EVM address</label>
              <Input
                id="stablecoin-destination"
                autoComplete="off"
                placeholder="0x…"
                value={destination}
                onChange={(event) => setDestination(event.target.value.trim())}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="stablecoin-amount">Amount ({selectedAsset.symbol})</label>
              <Input
                id="stablecoin-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">Your wallet will request approval. Keep enough CELO in the same wallet to pay network fees.</p>
            <Button type="submit" disabled={sendMutation.isPending || chainId !== selectedAsset.chainId || !balance}>
              {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {sendMutation.isPending ? 'Waiting for wallet…' : `Send ${selectedAsset.symbol}`}
            </Button>
            {transactionHash && (
              <p className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Submitted —{' '}
                {explorerBase
                  ? <a className="underline" href={`${explorerBase}/tx/${transactionHash}`} target="_blank" rel="noreferrer">view transaction</a>
                  : <code>{transactionHash}</code>}
              </p>
            )}
          </form>
        )}

        {!walletAddress && (
          <p className="text-sm text-muted-foreground">Connect an EVM-compatible wallet to receive the selected stablecoin on its exact network.</p>
        )}
      </CardContent>
    </Card>
  );
}
