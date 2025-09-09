// MtaaDAO Community Vault System — Phase 3 Final Export
// Includes voting, resolution, disbursement verification modal, and alerts

import { useEffect, useState } from "react"
import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import BigNumber from "bignumber.js"
// If bignumber.js is not installed, run: npm install bignumber.js
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import VaultDepositCard from "@/components/vault/DepositModal";
import VaultWithdrawInfoCard from "@/components/vault/WithdrawalModal";
// import CreateDisbursementProposalCard from "@/components/vault/CreateDisbursementProposalCard";
// import VaultHistoryCard from "@/components/vault/VaultHistoryCard";
import { toast } from "sonner"
import { useWallet } from "@/pages/hooks/useWallet"
import ProposalCard from "@/components/proposal-card"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"

function isValidAmount(value: string) {
  try {
    const bn = new BigNumber(value)
    return bn.isGreaterThan(0) && bn.isFinite()
  } catch {
    return false
  }
}

const useVaults = () => {
  return useQuery<Array<any>>({
    queryKey: ["vaults"],
    queryFn: async () => {
      const res = await fetch("/api/vault/list")
      return await res.json()
    },
    initialData: []
  });
}

const useVoterEligibility = (voter: string, vault: any) => {
  return useQuery<boolean>({
    queryKey: ["voter-eligibility", voter, vault?.address],
    queryFn: async () => {
      const res = await fetch(`/api/dao/eligibility?voter=${voter}&vault=${vault?.address}`)
      const json = await res.json()
      return json.isEligible as boolean;
    },
    enabled: !!voter && !!vault
  });
}

const useDisbursementStatus = (proposalId: string) => {
  return useQuery<{ status: string; txHash: string; confirmed: boolean } | undefined>({
    queryKey: ["disbursement-status", proposalId],
    queryFn: async () => {
      const res = await fetch(`/api/proposals/disbursement-status?proposalId=${proposalId}`)
      return await res.json();
    },
    enabled: !!proposalId
  });
}

export function CommunityVaultSection() {
  const [selectedVault, setSelectedVault] = useState<any>(null)
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Community Vaults</h2>
      <VaultDepositCard open={false} onOpenChange={() => {}} />
      <VaultWithdrawInfoCard open={false} onOpenChange={() => {}} vaultAddress={selectedVault?.address ?? ""} />
      {/* <CreateDisbursementProposalCard /> */}
      <ProposalViewerCard vault={selectedVault} />
      <VaultSelector onSelect={setSelectedVault} />
      {/* {selectedVault && <VaultHistoryCard vaultAddress={selectedVault.address} />} */}
    </div>
  );
}

export function VaultSelector({ onSelect }: { onSelect: (vault: any) => void }) {
  const { data: vaults = [] } = useVaults();

  return (
    <div className="space-y-1">
      <label htmlFor="vault-select" className="text-sm font-medium">Select Vault</label>
      <select
        id="vault-select"
        className="w-full border rounded px-3 py-2 text-sm"
        onChange={e => {
          const selected = (vaults as Array<any>).find((v: any) => v.address === e.target.value);
          if (selected) onSelect(selected);
        }}
      >
        <option value="">-- Select --</option>
        {(vaults as Array<any>).map((v: any, i: number) => (
          <option key={i} value={v.address}>{v.name}</option>
        ))}
      </select>
    </div>
  )
}

function DisbursementModal({ proposalId }: { proposalId: string }) {
  const { data, isLoading } = useDisbursementStatus(proposalId);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Verify Disbursement</Button>
      </DialogTrigger>
      <DialogContent>
        <h3 className="font-semibold text-lg mb-2">Disbursement Status</h3>
        {isLoading ? <p>Checking...</p> : (
          <div>
            <p>Status: <strong>{data?.status}</strong></p>
            <p>Tx Hash: <code className="text-xs break-all">{data?.txHash}</code></p>
            <p>Confirmed: {data?.confirmed ? "✅ Yes" : "❌ No"}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ProposalViewerCard({ vault }: { vault: any }) {
  const { address } = useWallet()
  const queryClient = useQueryClient()
  const { data: proposals = [], isLoading } = useQuery<Array<any>>({
    queryKey: ["proposals", vault?.address],
    queryFn: async () => {
      const res = await fetch(`/api/proposals/list?vault=${vault?.address}`);
      return await res.json();
    },
    enabled: !!vault
  });

  const { data: isEligible } = useVoterEligibility(address ?? "", vault);

  const voteMutation = useMutation({
    mutationFn: async ({ proposalId, vote }: { proposalId: string, vote: string }) => {
      const res = await fetch(`/api/proposals/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, voter: address, vote })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Vote failed")
      return json
    },
    onSuccess: () => {
      toast.success("✅ Vote submitted");
      queryClient.invalidateQueries({ queryKey: ["proposals", vault?.address] });
    },
    onError: (err: any) => {
      toast.error("Vote failed: " + err.message)
    }
  })

  const resolveMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const res = await fetch(`/api/proposals/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Resolution failed")
      return json
    },
    onSuccess: () => {
      toast.success("🎯 Proposal resolved");
      queryClient.invalidateQueries({ queryKey: ["proposals", vault?.address] });
    },
    onError: (err: any) => {
      console.warn("Auto-resolution failed:", err.message)
    }
  })

  useEffect(() => {
    (proposals as Array<any>).forEach((proposal: any) => {
      const isExpired = new Date() > new Date(proposal.voteEndTime);
      if (isExpired && proposal.status === "active") {
        resolveMutation.mutate(proposal.id);
      }
    });
  }, [proposals])

  const handleVote = (proposalId: string, vote: string) => {
    if (!isEligible) return toast.error("Not eligible to vote.")
    voteMutation.mutate({ proposalId, vote })
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Proposals</h3>
      {!vault && <p className="text-sm text-muted-foreground">Select a vault to view proposals.</p>}
      {vault && isLoading && <p className="text-sm">Loading proposals...</p>}
      {vault && (proposals as Array<any>).length === 0 && !isLoading && (
        <p className="text-sm">No proposals found for this vault.</p>
      )}
      {vault && (proposals as Array<any>).map((proposal: any, i: number) => (
        <div key={i} className="border p-2 rounded-md">
          <ProposalCard
            proposal={proposal}
            showFullDescription={false}
            onVote={() => {
              if (proposal.status !== "active") return toast.info("Voting is closed for this proposal.");
              const vote = prompt("Vote [yes / no / abstain]?")?.toLowerCase();
              if (["yes", "no", "abstain"].includes(vote || "")) {
                handleVote(proposal.id, vote!);
              } else {
                toast.warning("Invalid vote. Please vote yes, no, or abstain.");
              }
            }}
          />
          {proposal.status === "resolved" && <DisbursementModal proposalId={proposal.id} />}
        </div>
      ))}
    </div>
  )
}

// ✅ Export complete. This full system can now be used as a React module or integrated with DAO analytics.
