import { useEffect, useState } from 'react';

export interface SignerProfile {
  identifier: string;
  classification: 'address' | 'ens' | 'unknown';
  resolvedAddress?: string | null;
  isContract?: boolean;
  resolver?: string | null;
}

export default function useSignerProfile(identifier?: string) {
  const [profile, setProfile] = useState<SignerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identifier) {
      setProfile(null);
      setError(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const r = await fetch(`/api/ens/resolve?identifier=${encodeURIComponent(identifier)}`);
        const data = await r.json();
        if (!mounted) return;
        let enriched = data as SignerProfile;

        // Try to fetch a full profile by address or ENS (best-effort)
        const lookupAddress = enriched.resolvedAddress || (enriched.classification === 'address' ? enriched.identifier : null);
        if (lookupAddress) {
          try {
            // Try search-users endpoint first
            const p = await fetch(`/api/profile/search-users?q=${encodeURIComponent(lookupAddress)}`);
            if (p.ok) {
              const profileData = await p.json();
              if (profileData && profileData.length) {
                enriched = { ...enriched, ...(profileData[0] as any) };
              }
            }
          } catch (_) {
            // ignore
          }
        }

        setProfile(enriched);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || 'Failed to resolve');
        setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [identifier]);

  return { profile, loading, error } as const;
}
