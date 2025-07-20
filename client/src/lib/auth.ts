
export async function signIn(provider: string, data?: Record<string, any>) {
  if (provider === 'credentials') {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Login failed');
    }
    return res.json();
  }
  if (provider === 'google') {
    window.location.href = '/api/auth/oauth/google';
  }
  if (provider === 'telegram') {
    window.location.href = '/api/auth/telegram/init';
  }
  throw new Error('Unknown provider');
}
