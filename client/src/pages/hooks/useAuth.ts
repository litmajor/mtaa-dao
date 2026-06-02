import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/utils/authClient";

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
  // Optional extended properties used across the app
  isSuperUser?: boolean;
  currentDaoId?: string;
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
  // React Query's QueryClient typings in this repo are slightly different; narrow to any where we call imperative methods
  const queryClient = useQueryClient() as any;
  const navigate = useNavigate();



  const queryFn = async (): Promise<AuthResponse> => {
    try {
      const user = await authClient.get<User>("/api/auth/user");
      return {
        success: true,
        data: {
          user,
          accessToken: '', // No longer stored in memory; use cookies
        },
      };
    } catch (err) {
      throw err;
    }
  };

  // Build options as `any` to allow use of older/newer react-query option names
  const queryOptions: any = {
    queryKey: ["/api/auth/user"],
    queryFn,
    // Enable retry (can be number, boolean, or function in react-query)
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Use 0 to disable polling
    refetchInterval: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  };

  const { data: authData, isLoading, error } = useQuery<AuthResponse, unknown>(queryOptions as any);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      // Login endpoint returns CSRF token in response + sets cookies
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
      if (data.success && data.data?.user) {
        // Update React Query cache with user data
        const cacheData: AuthResponse = {
          success: true,
          data: {
            user: data.data.user,
            accessToken: '', // Tokens are in cookies now
          },
        };
        // QueryClient in some environments has different typings; call via any
        queryClient.setQueryData(["/api/auth/user"], cacheData);
      }
      navigate("/dashboard");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Use authClient which ensures cookies are sent
      return authClient.post("/api/auth/logout", {});
    },
    onSuccess: () => {
      // Clear auth cache (logout also clears cookies via authClient)
      if (typeof queryClient.clear === 'function') queryClient.clear();
      else if (typeof queryClient.invalidateQueries === 'function') queryClient.invalidateQueries();
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
      if (data.success && data.data?.user) {
        // Update React Query cache with user data
        const cacheData: AuthResponse = {
          success: true,
          data: {
            user: data.data.user,
            accessToken: '', // Tokens are in cookies now
          },
        };
        queryClient.setQueryData(["/api/auth/user"], cacheData);
      }
      navigate("/dashboard");
    },
  });

  return {
    user: authData?.data?.user ?? null,
    isLoading: isLoading,
    isAuthenticated: !!authData?.data?.user,
    // error from useQuery may be unknown; normalize safely
    error: ((error as any)?.message as string) || null,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    register: registerMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
  };
}