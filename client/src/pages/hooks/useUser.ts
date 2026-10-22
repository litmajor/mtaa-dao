import { useState, useEffect } from 'react';
import { authClient } from '@/utils/authClient';
import { type User } from '../../types/user';


// Fetch user from API (replace with your actual endpoint and logic)
const fetchCurrentUser = async (): Promise<User | null> => {
  try {
    const payload = await authClient.get<User | { user: User }>('/api/auth/user');
    return (payload as { user?: User })?.user ?? (payload as User) ?? null;
  } catch (error) {
    console.error('Failed to fetch current user:', error);
    return null;
  }
};

export function useUser(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser().then((u) => {
      if (mounted) setUser(u);
    });
    return () => { mounted = false; };
  }, []);

  return user;
}
