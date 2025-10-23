import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface User {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: string;
  walletAddress?: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  profilePicture?: string | null;
}

interface AuthResponse {
  success: boolean;
  data?: {
    user: User;
    accessToken: string;
  };
  error?: {
    message: string;
  };
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: authData, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async (): Promise<AuthResponse> => {
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch("/api/auth/user", {
        credentials: 'include',
        headers,
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Clear invalid token
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          throw new Error("Not authenticated");
        }
        throw new Error("Failed to fetch user");
      }

      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false, // Disable automatic refetching
    refetchOnWindowFocus: false, // Disable refetch on window focus
    refetchOnReconnect: false, // Disable refetch on reconnect
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || "Login failed");
      }

      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.data?.accessToken) {
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
      }
      queryClient.setQueryData(["/api/auth/user"], data);
      // Force refetch to update auth state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/dashboard");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error("Logout failed");
      }

      return res.json();
    },
    onSuccess: () => {
      // Clear all auth data
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      queryClient.clear();
      setLocation("/login");
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ email, password, name, walletAddress }: {
      email: string;
      password: string;
      name: string;
      walletAddress?: string;
    }) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ email, password, name, walletAddress }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Registration failed");
      }

      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.data?.accessToken) {
        localStorage.setItem('accessToken', data.data.accessToken);
      }
      queryClient.setQueryData(["/api/auth/user"], data);
      setLocation("/dashboard");
    },
  });

  return {
    user: authData?.success ? authData.data?.user : null,
    isLoading,
    isAuthenticated: !!authData?.success && !!authData.data?.user,
    error,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    register: registerMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
  };
}