import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  // Get user from localStorage as fallback
  const getStoredUser = (): User | null => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const { data: authData, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async (): Promise<AuthResponse> => {
      const token = localStorage.getItem('accessToken');
      const storedUser = getStoredUser();
      
      // If no token, return stored user if available
      if (!token) {
        if (storedUser) {
          return {
            success: true,
            data: {
              user: storedUser,
              accessToken: token || '',
            },
          };
        }
        throw new Error("No authentication token");
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      try {
        const res = await fetch("/api/auth/user", {
          credentials: 'include',
          headers,
        });

        if (!res.ok) {
          if (res.status === 401) {
            // Clear invalid token but keep stored user if available
            localStorage.removeItem('accessToken');
            if (storedUser) {
              return {
                success: true,
                data: {
                  user: storedUser,
                  accessToken: '',
                },
              };
            }
            throw new Error("Not authenticated");
          }
          throw new Error("Failed to fetch user");
        }

        const data = await res.json();
        // Store user in localStorage for offline fallback
        if (data.success && data.data?.user) {
          localStorage.setItem('user', JSON.stringify(data.data.user));
        }
        return data;
      } catch (err) {
        // If API call fails but we have stored user, return that
        if (storedUser) {
          return {
            success: true,
            data: {
              user: storedUser,
              accessToken: token || '',
            },
          };
        }
        throw err;
      }
    },
    retry: false,
    enabled: !!localStorage.getItem('accessToken') || !!getStoredUser(), // Run if token or stored user exists
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
      if (data.success && data.data?.accessToken && data.data?.user) {
        // Store tokens and user
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        
        // Update React Query cache with the actual API response format
        const cacheData: AuthResponse = {
          success: true,
          data: {
            user: data.data.user,
            accessToken: data.data.accessToken,
          },
        };
        queryClient.setQueryData(["/api/auth/user"], cacheData);
        
        // Force a refetch to populate the query
        queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      }
      navigate("/dashboard");
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
      navigate("/login");
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
      navigate("/dashboard");
    },
  });

  return {
    user: authData?.data?.user ?? null,
    isLoading: isLoading && !getStoredUser(), // Don't show loading if we have fallback user
    isAuthenticated: !!(authData?.data?.user || getStoredUser()),
    error: error?.message || null,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    register: registerMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
  };
}