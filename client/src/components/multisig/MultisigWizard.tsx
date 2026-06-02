import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../ui/use-toast';
import SignerCard from './SignerCard';
import { useWalletProviders } from '../../../hooks/useWalletProviders';

interface MultisigWallet {
  id?: string;
  address?: string;
  requiredSignatures: number;
  signers: string[];
  simulation?: boolean;
}

interface MultisigWizardProps {
  daoId?: string;
  initialSigners?: string[];
  onClose: () => void;
  onCreated?: (m: MultisigWallet) => void;
}

export default function MultisigWizard({ daoId, initialSigners = [], onClose, onCreated }: MultisigWizardProps) {
  const [step, setStep] = useState(0);
  const [signers, setSigners] = useState<string[]>(initialSigners || []);
  const [candidate, setCandidate] = useState('');
  const [required, setRequired] = useState(Math.max(2, (initialSigners?.length || 0) >= 2 ? initialSigners.length : 2));
  const [deploying, setDeploying] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const [offlineSigners, setOfflineSigners] = useState(0);

  // Simulation mode flag (toggleable in UI)
  const [simulationMode, setSimulationMode] = useState(true);

  useEffect(() => {
    setRequired(prev => {
      if (signers.length === 0) return 2;
      return Math.max(2, Math.min(prev, Math.max(2, signers.length)));
    });
  }, [signers]);

  const addSigner = () => {
    const trimmed = candidate.trim();
    if (!trimmed) return toast({ title: 'Empty', description: 'Enter a signer address or user id', variant: 'destructive' });
    if (signers.includes(trimmed)) return toast({ title: 'Duplicate', description: 'Signer already added', variant: 'destructive' });
    // Basic validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed) && !/\./.test(trimmed) && !/^[a-f0-9-]{8,36}$/.test(trimmed)) {
      return toast({ title: 'Invalid', description: 'Signer must be a wallet address, ENS name, or user id', variant: 'destructive' });
    }
    setSigners(prev => [...prev, trimmed]);
    setCandidate('');
  };

  const removeSigner = (idx: number) => setSigners(prev => prev.filter((_, i) => i !== idx));

  const goNext = () => {
    if (step === 0) {
      // From overview to signer selection
      setStep(1);
      return;
    }
    if (step === 1 && signers.length < 2) return toast({ title: 'Not enough signers', description: 'Add at least 2 signers to continue', variant: 'destructive' });
    if (step === 2 && (required < 1 || required > signers.length)) return toast({ title: 'Invalid threshold', description: 'Required signatures must be between 1 and number of signers', variant: 'destructive' });
    setStep(s => Math.min(s + 1, 4));
  };

  const goBack = () => setStep(s => Math.max(0, s - 1));

  // Risk and score calculations
  const analysis = useMemo(() => {
    const total = Math.max(1, signers.length);
    const compromiseTolerance = Math.max(0, total - required);
    const diversityScore = Math.min(1, total >= 3 ? 0.9 : 0.6);
    const thresholdFactor = required / total;
    const score = Math.round((diversityScore * 0.5 + (1 - thresholdFactor) * 0.5) * 100);
    const recommendation = required >= Math.ceil(total * 0.6) ? 'Conservative' : (required === total ? 'Lock risk' : 'Balanced');
    return { total, compromiseTolerance, score, recommendation };
  }, [signers, required]);

  const wallet = useWalletProviders(8453);

  const startDeploy = async () => {
    if (simulationMode) {
      setDeploying(true);
      setProgress(5);
      const tick = setInterval(() => {
        setProgress(p => {
          const next = Math.min(100, p + Math.floor(Math.random() * 18) + 6);
          if (next >= 100) {
            clearInterval(tick);
            setDeploying(false);
            const wallet: MultisigWallet = {
              address: `SIMULATION-${Date.now()}`,
              requiredSignatures: required,
              signers,
              simulation: true,
            };
            toast({ title: 'Simulation Complete', description: 'Multisig simulation finished — this is not onchain.', duration: 6000 });
            onCreated?.(wallet);
            setStep(4);
            return 100;
          }
          return next;
        });
      }, 400);
      return;
    }
    try {
      setDeploying(true);
      const res = await fetch('/api/multisig-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daoId, signers, requiredSignatures: required, chainId: 8453 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to queue multisig');
      toast({ title: 'Queued', description: `Multisig creation queued (job ${data.jobId})`, duration: 8000 });
      const wallet: MultisigWallet = { id: data.jobId, requiredSignatures: required, signers, simulation: false };
      onCreated?.(wallet);
      setStep(4);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Deployment failed', variant: 'destructive' });
    } finally {
      setDeploying(false);
    }
  };

  const thresholdLabel = (r: number, total: number) => {
    if (r <= 1) return 'Dangerous';
    if (r === total) return 'High lock risk';
    if (r >= Math.ceil(total * 0.6)) return 'Conservative';
    return 'Recommended';
  };

  return (
    <Card className="max-w-3xl w-full bg-white/5">
      <CardHeader>
        <CardTitle>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Treasury Operations Console</div>
              <div className="text-sm text-gray-400">Institutional-grade multisig setup and governance integration</div>
            </div>
            <div className="text-xs text-gray-400">Step {Math.min(step + 1, 5)} / 5</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Step 0: Overview */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white text-3xl">🏦</div>
              <div>
                <h3 className="text-lg font-semibold">Why set up a multisig?</h3>
                <p className="text-sm text-gray-300 mt-1">A multisig distributes custody across trusted DAO actors, reducing single-point-of-failure risk and aligning treasury actions with governance.</p>
                <ul className="mt-3 text-sm text-gray-400 list-disc list-inside space-y-1">
                  <li>Integrates with DAO proposals for treasury execution</li>
                  <li>Supports hardware & smart wallets</li>
                  <li>Includes recovery & rotation guidance</li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-gray-800 rounded">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-300">Current DAO Treasury</div>
                  <div className="text-2xl font-semibold text-white">—</div>
                </div>
                <div className="text-sm text-yellow-400">Deployment Backend Not Connected</div>
              </div>
              <div className="mt-3 text-xs text-gray-400">This wizard runs in simulation until onchain deployment is integrated. No funds or contracts are created.</div>
            </div>
          </div>
        )}

        {/* Step 1: Signer Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Select Signers</label>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {signers.length === 0 && <div className="text-sm text-gray-400">No signers selected — choose elders or add external wallets.</div>}
                {signers.map((s, i) => (
                  <SignerCard key={s + i} signer={s} onRemove={() => removeSigner(i)} />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Input placeholder="Search DAO elders or paste wallet/ENS" value={candidate} onChange={(e) => setCandidate(e.target.value)} />
              <Button onClick={addSigner}>Add</Button>
            </div>
            <div className="text-xs text-gray-400">Tip: use ENS or known elder identities for stronger trust signals.</div>
          </div>
        )}

        {/* Step 2: Threshold Intelligence */}
        {step === 2 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium">Threshold & Resilience</label>
            <div className="p-3 bg-gray-900 rounded">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-400">Quorum visualization</div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex gap-1">
                      {Array.from({ length: analysis.total }).map((_, i) => (
                        <div key={i} className={`w-5 h-5 rounded-full ${i < required ? 'bg-green-400' : 'bg-gray-700'}`} />
                      ))}
                    </div>
                    <div className="text-sm text-gray-300">{required} of {analysis.total} required</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Compromise Tolerance</div>
                  <div className="text-lg font-semibold text-white">{analysis.compromiseTolerance}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-4">
                <input type="range" min={1} max={Math.max(1, signers.length || 1)} value={required} onChange={(e) => setRequired(Number(e.target.value))} />
                <div className="text-sm text-gray-300">{thresholdLabel(required, analysis.total)} • Security Score: {analysis.score}/100</div>
              </div>

              <div className="mt-3">{analysis.score < 40 ? <div className="text-sm text-red-500">Low security — consider increasing threshold or ensuring diverse hardware wallets.</div> : <div className="text-sm text-green-400">{analysis.recommendation} configuration</div>}</div>

              {/* Quorum simulation */}
              <div className="mt-4 p-3 bg-gray-800 rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-300">Quorum Simulation</div>
                    <div className="text-xs text-gray-400 mt-1">Simulate signers offline to understand operational impact</div>
                  </div>
                  <div className="text-sm text-gray-300">Compromise tolerance: {analysis.compromiseTolerance}</div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-sm text-gray-300">Offline signers</label>
                  <input type="range" min={0} max={analysis.total} value={offlineSigners} onChange={(e) => setOfflineSigners(Number(e.target.value))} />
                  <div className="text-sm text-white">{offlineSigners} / {analysis.total}</div>
                </div>
                <div className="mt-3">
                  {offlineSigners < analysis.compromiseTolerance ? (
                    <div className="text-sm text-green-400">Operational — treasury can still approve actions.</div>
                  ) : offlineSigners === analysis.compromiseTolerance ? (
                    <div className="text-sm text-yellow-400">Degraded — operations may be slow or require manual recoveries.</div>
                  ) : (
                    <div className="text-sm text-red-500">Locked — too many offline signers for required threshold.</div>
                  )}
                </div>
                <div className="mt-3 text-xs text-gray-400">Attack simulation: an attacker needs control of <span className="font-semibold">{required}</span> wallets to act ({required}/{analysis.total}). Example sets an attacker could compromise:</div>
                <div className="mt-2">
                  {renderAttackerExamples(signers, required)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Deployment Preview */}
        {step === 3 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium">Deployment Preview</label>
            <div className="p-3 bg-gray-900 rounded space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-400">Network</div>
                  <div className="text-sm text-white">Base (simulation)</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Contract</div>
                  <div className="text-sm text-white">Gnosis Safe Compatible (simulation)</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Estimated Fee</div>
                  <div className="text-sm text-white">~0.003 ETH (sim)</div>
                </div>
              </div>
              <div className="p-2 bg-gray-800 rounded text-sm text-gray-300">Recovery: disabled • Upgradeability: immutable • Governance integration: enabled</div>
            </div>
            <div className="text-xs text-gray-400">Deployment backend not connected. To deploy onchain, connect an RPC and signing provider.</div>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm text-gray-300">Deployment mode</label>
              <div className="flex items-center gap-2">
                <button className={`px-2 py-1 rounded ${simulationMode ? 'bg-gray-700 text-white' : 'bg-transparent border'}`} onClick={() => setSimulationMode(true)}>Simulation</button>
                <button className={`px-2 py-1 rounded ${!simulationMode ? 'bg-green-600 text-white' : 'bg-transparent border'}`} onClick={() => setSimulationMode(false)}>Real (requires connector)</button>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-sm text-gray-300">Wallet Connection</div>
              <div className="flex gap-2 mt-2 items-center">
                {(wallet.supportedProviders || []).map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => wallet.connectProvider?.(p.id)}
                    className="px-3 py-2 bg-gray-800 rounded"
                  >
                    {p.name}
                    {wallet.isConnecting && wallet.provider?.id === p.id ? '…' : ''}
                  </button>
                ))}

                {/* Fallback quick actions */}
                <button className="px-3 py-2 bg-gray-800 rounded" onClick={() => wallet.connectMetaMask?.()}>MetaMask</button>
                <button className="px-3 py-2 bg-gray-800 rounded" onClick={() => wallet.connectWalletConnect?.()}>WalletConnect</button>

                {wallet.isConnected && <div className="text-sm text-green-400 ml-3">Connected: {String(wallet.account).slice(0,6)}…{String(wallet.account).slice(-4)}</div>}
                {wallet.error && <div className="text-sm text-red-400 ml-3">{wallet.error}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Post-deployment (simulation result) */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="p-4 bg-green-900 rounded">
              <div className="text-sm text-green-200">Simulation complete</div>
              <div className="text-white font-semibold mt-1">Generated Vault (simulation)</div>
              <div className="text-xs text-gray-300 mt-2">Address: SIMULATION - check records and integrate with DAO proposals.</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { /* CTA: open treasury dashboard */ }}>Open Treasury Dashboard</Button>
              <Button variant="ghost" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-between">
          <div>
            {step > 0 && <Button variant="ghost" onClick={goBack}>Back</Button>}
          </div>
          <div className="flex gap-2">
            {step < 3 && <Button onClick={goNext}>Next</Button>}
            {step === 3 && !deploying && <Button onClick={startDeploy} className="bg-mtaa-purple text-white">Simulate Deploy</Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function renderAttackerExamples(signers: string[], required: number) {
  if (!signers || signers.length === 0) return <div className="text-xs text-gray-500">No signer data to show examples.</div>;
  const examples: string[][] = [];
  // generate up to 3 example sets by rotating
  for (let i = 0; i < Math.min(3, signers.length); i++) {
    const set: string[] = [];
    for (let j = 0; j < required; j++) {
      set.push(shorten(signers[(i + j) % signers.length]));
    }
    examples.push(set);
  }

  return (
    <div className="flex flex-col gap-2">
      {examples.map((set, idx) => (
        <div key={idx} className="text-xs text-gray-300">Set {idx + 1}: {set.join(', ')}</div>
      ))}
    </div>
  );
}

function shorten(s: string) {
  try {
    if (!s) return '';
    if (s.length > 12) return `${s.slice(0,6)}…${s.slice(-4)}`;
    return s;
  } catch {
    return s;
  }
}
