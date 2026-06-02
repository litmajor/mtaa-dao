import React from 'react';
import useSignerProfile from '../../hooks/useSignerProfile';

interface SignerCardProps {
  signer: string;
  onRemove?: () => void;
}

export default function SignerCard({ signer, onRemove }: SignerCardProps) {
  const { profile, loading } = useSignerProfile(signer);

  const name = (profile as any)?.username || (profile as any)?.name || (profile?.classification === 'ens' ? signer : undefined);
  const address = profile?.resolvedAddress || (profile?.classification === 'address' ? profile.identifier : signer);
  const role = (profile as any)?.roles || 'Signer';
  const lastActive = (profile as any)?.lastLoginAt || (profile as any)?.lastActive || null;
  const trust = (profile as any)?.trustScore || 72;
  const walletType = profile?.isContract ? 'Contract' : 'EOA';

  return (
    <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
          {name ? String(name).charAt(0).toUpperCase() : (address ? address.slice(2,4).toUpperCase() : 'S')}
        </div>
        <div>
          <div className="text-sm font-medium">{loading ? 'Resolving…' : (name || address)}</div>
          <div className="text-xs text-gray-400">{address ? `${address.slice(0,6)}…${address.slice(-6)}` : ''} • {role}</div>
          <div className="text-xs text-gray-400 mt-1">{walletType} • Trust {trust}% {lastActive ? `• active ${formatLastActive(lastActive)}` : ''}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onRemove} className="text-xs text-red-400">Remove</button>
      </div>
    </div>
  );
}

function formatLastActive(val: any) {
  try {
    const d = new Date(val);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}
