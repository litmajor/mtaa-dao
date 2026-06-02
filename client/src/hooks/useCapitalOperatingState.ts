import { useMemo } from 'react';

type Vault = {
  id: string;
  currency?: string;
  balance?: string | number;
  type?: string;
};

type Transaction = {
  id?: string;
  status?: string;
  amount?: string | number;
  type?: string;
};

export default function useCapitalOperatingState(vaults: Vault[], transactions: Transaction[] = []) {
  return useMemo(() => {
    const parse = (v: any) => {
      if (typeof v === 'number') return v;
      if (!v) return 0;
      const n = parseFloat(String(v).replace(/,/g, ''));
      return Number.isFinite(n) ? n : 0;
    };

    const liquidity = vaults
      .filter((v) => !v.type || v.type === 'personal' || v.type === 'token')
      .reduce((sum, v) => sum + parse(v.balance), 0);

    const deployed = vaults
      .filter((v) => v.type === 'deployed' || v.type === 'yield')
      .reduce((sum, v) => sum + parse(v.balance), 0);

    const pending = transactions.filter((t) => t.status === 'pending' || t.status === 'processing').length;

    const escrowExposure = vaults
      .filter((v) => v.type === 'escrow')
      .reduce((sum, v) => sum + parse(v.balance), 0);

    const total = vaults.reduce((sum, v) => sum + parse(v.balance), 0);

    const diversification = Math.min(1, (vaults.length || 1) / 10);
    const exposureRatio = total ? Math.min(1, escrowExposure / total) : 0;

    const walletHealth = {
      liquidity: liquidity > 0 ? 'STRONG' : 'WEAK',
      diversification: diversification > 0.5 ? 'GOOD' : 'MEDIUM',
      exposure: exposureRatio < 0.2 ? 'LOW_RISK' : exposureRatio < 0.5 ? 'MEDIUM_RISK' : 'HIGH_RISK'
    };

    return {
      liquidity,
      deployed,
      pending,
      escrowExposure,
      total,
      walletHealth
    };
  }, [vaults, transactions]);
}
