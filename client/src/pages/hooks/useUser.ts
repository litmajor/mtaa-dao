import { useState, useEffect } from 'react';
import { authClient } from '@/utils/authClient';
import { User } from '../../types/user';


// Fetch user from API (replace with your actual endpoint and logic)
const fetchCurrentUser = async (): Promise<User | null> => {
  const token = authClient.getToken();
  if (!token) return null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(await authClient.getAuthHeaders()),
  };

  const res = await fetch('/api/auth/user', {
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      return null;
    }
    throw new Error('Failed to fetch user');
  }

  const data = await res.json();
  // Adjust this mapping if your API response shape is different
  return data?.data?.user ?? null;
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
