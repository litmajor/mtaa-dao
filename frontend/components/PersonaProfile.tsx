/**
 * PersonaProfile – Settings tab integration stub
 *
 * The full implementation lives in:
 *   client/src/components/PersonaProfile.tsx
 *
 * This component provides a lightweight version for the frontend/components
 * app root used by the Settings page.
 */

import React from 'react';

interface PersonaProgressItem {
  feature: string;
  name: string;
  isAvailable: boolean;
  reason?: string;
  daysUntilAvailable?: number;
  amountNeeded?: number;
  currency?: string;
  priority: number;
}

interface PersonaProgressResponse {
  persona: string;
  personaName: string;
  totalFeatures: number;
  unlockedFeatures: number;
  progressPercentage: number;
  nextMilestone?: PersonaProgressItem;
  progress: PersonaProgressItem[];
}

const PERSONA_INFO: Record<string, { name: string; role: string; icon: string }> = {
  okedi: { name: 'Okedi', role: 'Community Manager', icon: '🎤' },
  yuki: { name: 'Yuki', role: 'DeFi Trading', icon: '📈' },
  amara: { name: 'Amara', role: 'Long-term / Investing', icon: '💰' },
};

export default function PersonaProfile() {
  const [progress, setProgress] = React.useState<PersonaProgressResponse | null>(null);
  const [persona, setPersona] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      fetch('/api/personas/current').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/personas/progress').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([currentRes, progressRes]) => {
        if (currentRes?.persona) setPersona(currentRes.persona);
        if (progressRes) setProgress(progressRes);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        Loading your persona...
      </div>
    );
  }

  if (!persona) {
    return (
      <div
        style={{
          padding: '1.5rem',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '0.75rem',
        }}
      >
        <h3 style={{ color: '#92400e', marginBottom: '0.5rem' }}>No Persona Selected</h3>
        <p style={{ color: '#b45309', fontSize: '0.875rem' }}>
          You haven't selected a persona yet. Choose one to get personalized feature guidance!
        </p>
        <a
          href="/settings?tab=persona"
          style={{
            display: 'inline-block',
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#8B5CF6',
            color: '#fff',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontSize: '0.875rem',
          }}
        >
          Select Persona
        </a>
      </div>
    );
  }

  const info = PERSONA_INFO[persona] ?? { name: persona, role: '', icon: '🌐' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Persona Card */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <span style={{ fontSize: '3rem' }}>{info.icon}</span>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{info.name}</h2>
          <p style={{ margin: 0, color: '#6b7280' }}>{info.role}</p>
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            📈 Your Progress — {progress.unlockedFeatures}/{progress.totalFeatures} features unlocked
          </h3>
          <div
            style={{
              background: '#e5e7eb',
              borderRadius: '9999px',
              height: '12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress.progressPercentage}%`,
                background: '#8B5CF6',
                height: '100%',
                borderRadius: '9999px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
            {progress.progressPercentage}% complete
          </p>
        </div>
      )}

      {/* Morio Tip */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f5f3ff, #fdf2f8)',
          border: '1px solid #ddd6fe',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          display: 'flex',
          gap: '1rem',
        }}
      >
        <span style={{ fontSize: '2rem', flexShrink: 0 }}>🤖</span>
        <div>
          <p style={{ fontWeight: 600, color: '#4c1d95', margin: '0 0 0.25rem' }}>
            Ask Morio about your progress!
          </p>
          <p style={{ color: '#6d28d9', fontSize: '0.875rem', margin: 0 }}>
            Want to know how to unlock your next feature? Ask Morio in the chat for
            {progress?.personaName ? ` ${progress.personaName}-specific ` : ' '}
            advice on the fastest path forward. 🚀
          </p>
        </div>
      </div>
    </div>
  );
}
