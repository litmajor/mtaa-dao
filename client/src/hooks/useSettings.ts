import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface UserSettingsData {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'normal' | 'large' | 'xlarge';
  language: string;
  timezone: string;
  preferredCurrency: string;
  profileVisibility: 'public' | 'friends' | 'private';
  activityVisibility: 'public' | 'members' | 'private';
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  twoFactorEnabled: boolean;
  twoFactorMethod: 'authenticator' | 'sms' | 'email';
  sessionTimeout: number;
  highContrast: boolean;
  reducedMotion: boolean;
  notifyGovernance?: boolean;
  notifyTreasury?: boolean;
  notifyMorio?: boolean;
  notifyWeeklySummary?: boolean;
}

async function fetchSettings(): Promise<UserSettingsData> {
  const res = await fetch('/api/settings/all');
  if (!res.ok) throw new Error('Failed to fetch settings');
  const json = await res.json();
  return json.settings || json;
}

async function updateSettingsFn(patch: Partial<UserSettingsData>): Promise<void> {
  const res = await fetch('/api/settings/update', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update settings');
}

export function useSettings() {
  const qc = useQueryClient();

  const query = useQuery<UserSettingsData>({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: updateSettingsFn,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['settings'] });
      const prev = qc.getQueryData<UserSettingsData>(['settings']);
      qc.setQueryData(['settings'], (old: any) => ({ ...old, ...patch }));
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['settings'], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  function update(patch: Partial<UserSettingsData>) {
    // Optimistic localStorage update for theme
    if (patch.theme) {
      localStorage.setItem('mtaa_theme', patch.theme);
      document.documentElement.classList.remove('light', 'dark');
      if (patch.theme !== 'system') document.documentElement.classList.add(patch.theme);
    }
    if (patch.language) localStorage.setItem('mtaa_lang', patch.language);
    mutation.mutate(patch);
  }

  return {
    settings: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    isSaving: mutation.isPending,
    update,
  };
}
