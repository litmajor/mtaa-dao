import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { isAddress } from "viem";
import { AlertCircle, Bot, Calendar, CheckCircle, Clock, Crown, ExternalLink, Shield, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { authClient } from "@/utils/authClient";

const SUBSCRIPTION_MANAGER_ADDRESS = import.meta.env.VITE_DAO_SUBSCRIPTION_MANAGER_ADDRESS as `0x${string}` | undefined;
const MAX_ACCEPTABLE_CUSD = (1n << 256n) - 1n;

const DAO_SUBSCRIPTION_MANAGER_ABI = [
  {
    type: "function",
    name: "subscribe",
    stateMutability: "nonpayable",
    inputs: [
      { name: "daoTreasury", type: "address" },
      { name: "tierId", type: "uint256" },
      { name: "durationMonths", type: "uint256" },
      { name: "maxAcceptableCUSD", type: "uint256" }
    ],
    outputs: []
  }
] as const;

const TIERS = [
  {
    id: "free",
    tierId: 0,
    name: "Free",
    price: "KES 0",
    description: "Manual proposals, manual treasury transactions, and basic voting.",
    limits: "20 members, 1 active vault",
    icon: <Shield className="w-5 h-5 text-slate-600" />,
    features: ["Manual proposal creation", "Manual treasury transactions", "Basic voting"]
  },
  {
    id: "pro",
    tierId: 1,
    name: "Pro",
    price: "KES 1,000/mo",
    description: "AI-assisted governance, DeFi automation, and advanced treasury analytics.",
    limits: "100 members, 5 active vaults",
    icon: <Bot className="w-5 h-5 text-orange-600" />,
    features: ["AI risk scoring", "Proposal summaries", "Auto-rebalancing", "Historical treasury reports"]
  },
  {
    id: "collective",
    tierId: 2,
    name: "Collective",
    price: "KES 5,000/mo",
    description: "Custom AI controls, unrestricted governance, priority execution, and branding.",
    limits: "Unlimited members and vaults",
    icon: <Crown className="w-5 h-5 text-emerald-600" />,
    features: ["Custom AI parameters", "Sub-DAOs", "Complex voting strategies", "Priority support"]
  }
] as const;

type Tier = (typeof TIERS)[number];

interface SubscriptionDetails {
  currentPlan: string;
  status: string;
  nextBillingDate?: string | null;
  daoTreasuryAddress?: string | null;
  userRole?: string | null;
  isAdmin?: boolean;
  billingHistory?: Array<{
    id: string;
    description?: string | null;
    createdAt?: string | null;
    currency?: string | null;
    amount?: string | null;
    status?: string | null;
  }>;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await authClient.fetch(url, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || payload?.error || payload?.message || `HTTP ${response.status}`);
  }

  const payload = await response.json();
  return (payload?.data ?? payload) as T;
}

export default function SubscriptionManagement() {
  const params = useParams<{ daoId?: string; id?: string }>();
  const daoId = params.daoId ?? params.id;
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [syncedHash, setSyncedHash] = useState<`0x${string}` | null>(null);

  const subscriptionQuery = useQuery<SubscriptionDetails>({
    queryKey: ["subscription-management", daoId],
    enabled: !!daoId,
    queryFn: () => requestJson<SubscriptionDetails>(`/api/subscription-management/${daoId}`)
  });

  const { writeContract, data: txHash, error: writeError, isPending: isWritePending } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash }
  });

  const syncMutation = useMutation({
    mutationFn: async ({ tier, hash }: { tier: Tier; hash: `0x${string}` }) => {
      return requestJson(`/api/subscription-management/${daoId}/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: tier.id,
          tierId: tier.tierId,
          durationMonths: 1,
          paymentMethod: "onchain",
          transactionHash: hash,
          daoTreasury: subscriptionQuery.data?.daoTreasuryAddress
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-management", daoId] });
      toast({
        title: "Subscription synced",
        description: "The confirmed on-chain upgrade is now reflected in the app."
      });
      setPendingTier(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Backend sync failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    if (!receipt.isSuccess || !txHash || !pendingTier || syncedHash === txHash) return;
    setSyncedHash(txHash);
    syncMutation.mutate({ tier: pendingTier, hash: txHash });
  }, [pendingTier, receipt.isSuccess, syncMutation, syncedHash, txHash]);

  useEffect(() => {
    if (!writeError) return;
    toast({
      title: "Transaction rejected",
      description: writeError.message,
      variant: "destructive"
    });
  }, [toast, writeError]);

  const currentTier = useMemo(() => {
    return TIERS.find((tier) => tier.id === subscriptionQuery.data?.currentPlan) ?? TIERS[0];
  }, [subscriptionQuery.data?.currentPlan]);

  const daoTreasuryAddress = subscriptionQuery.data?.daoTreasuryAddress;
  const hasSubscriptionManager = !!SUBSCRIPTION_MANAGER_ADDRESS && isAddress(SUBSCRIPTION_MANAGER_ADDRESS);
  const hasDaoTreasury = !!daoTreasuryAddress && isAddress(daoTreasuryAddress);
  const isBusy = isWritePending || receipt.isLoading || syncMutation.isPending;

  const handleUpgrade = (tier: Tier) => {
    if (!subscriptionQuery.data?.isAdmin) {
      toast({
        title: "Admin access required",
        description: "Only DAO admins can manage subscriptions.",
        variant: "destructive"
      });
      return;
    }

    if (!isConnected || !address) {
      toast({
        title: "Wallet required",
        description: "Connect the DAO admin wallet before upgrading.",
        variant: "destructive"
      });
      return;
    }

    if (!hasSubscriptionManager || !SUBSCRIPTION_MANAGER_ADDRESS) {
      toast({
        title: "Subscription contract missing",
        description: "Set VITE_DAO_SUBSCRIPTION_MANAGER_ADDRESS before upgrading.",
        variant: "destructive"
      });
      return;
    }

    if (!hasDaoTreasury || !daoTreasuryAddress) {
      toast({
        title: "DAO treasury missing",
        description: "This DAO does not have a valid on-chain treasury address.",
        variant: "destructive"
      });
      return;
    }

    setPendingTier(tier);
    setSyncedHash(null);
    writeContract({
      address: SUBSCRIPTION_MANAGER_ADDRESS,
      abi: DAO_SUBSCRIPTION_MANAGER_ABI,
      functionName: "subscribe",
      args: [daoTreasuryAddress as `0x${string}`, BigInt(tier.tierId), 1n, MAX_ACCEPTABLE_CUSD]
    });
  };

  if (subscriptionQuery.isLoading) {
    return <div className="p-8">Loading subscription...</div>;
  }

  if (subscriptionQuery.isError) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="border-red-200">
          <CardContent className="p-6 flex gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{subscriptionQuery.error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!subscriptionQuery.data?.isAdmin) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Admin Access Required
            </CardTitle>
            <CardDescription>Only DAO admins can manage subscription tiers.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Your current DAO role is {subscriptionQuery.data?.userRole || "not a member"}.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscription Management</h1>
          <p className="text-gray-600">Upgrade your DAO tier through the on-chain subscription manager.</p>
        </div>
        <Badge variant={subscriptionQuery.data.status === "active" ? "default" : "secondary"} className="w-fit">
          {currentTier.name} - {subscriptionQuery.data.status || "active"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Current Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Plan</p>
            <p className="text-lg font-semibold">{currentTier.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Next Billing</p>
            <p className="text-lg font-semibold">
              {subscriptionQuery.data.nextBillingDate
                ? new Date(subscriptionQuery.data.nextBillingDate).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">DAO Treasury</p>
            <p className="text-sm font-mono truncate">{daoTreasuryAddress || "Not configured"}</p>
          </div>
        </CardContent>
      </Card>

      {(!hasSubscriptionManager || !hasDaoTreasury) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex gap-3 text-amber-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              {!hasSubscriptionManager
                ? "Missing VITE_DAO_SUBSCRIPTION_MANAGER_ADDRESS. Upgrades are disabled until the frontend knows the deployed contract address."
                : "This DAO needs a valid chama treasury address before on-chain subscription upgrades can run."}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {TIERS.map((tier) => {
          const isCurrent = tier.id === currentTier.id;
          const canUpgrade = tier.id !== "free" && !isCurrent;

          return (
            <Card key={tier.id} className={isCurrent ? "border-emerald-500 border-2" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {tier.icon}
                  {tier.name}
                </CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-3xl font-bold">{tier.price}</p>
                  <p className="text-sm text-gray-500">{tier.limits}</p>
                </div>
                <div className="space-y-2">
                  {tier.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                {isCurrent ? (
                  <Button disabled className="w-full">Current Plan</Button>
                ) : canUpgrade ? (
                  <Button
                    onClick={() => handleUpgrade(tier)}
                    disabled={isBusy || !hasSubscriptionManager || !hasDaoTreasury}
                    className="w-full"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {pendingTier?.id === tier.id && isBusy ? "Processing..." : `Upgrade to ${tier.name}`}
                  </Button>
                ) : (
                  <Button disabled variant="outline" className="w-full">Included by default</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(txHash || syncMutation.isPending) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Upgrade Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>Wallet transaction: {receipt.isSuccess ? "confirmed" : receipt.isLoading ? "confirming" : "submitted"}</p>
            <p>Backend sync: {syncMutation.isSuccess ? "complete" : syncMutation.isPending ? "syncing" : "waiting"}</p>
            {txHash && (
              <p className="font-mono break-all flex items-center gap-2">
                {txHash}
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Billing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptionQuery.data.billingHistory?.length ? (
            <div className="space-y-2">
              {subscriptionQuery.data.billingHistory.map((bill) => (
                <div key={bill.id} className="flex items-center justify-between p-3 border rounded-lg gap-4">
                  <div>
                    <p className="font-medium">{bill.description || "Subscription payment"}</p>
                    <p className="text-sm text-gray-600">
                      {bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{bill.currency || "KES"} {bill.amount || "0"}</p>
                    <Badge variant={bill.status === "completed" || bill.status === "paid" ? "default" : "secondary"}>
                      {bill.status || "completed"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">No billing history yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
