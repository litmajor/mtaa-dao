/**
 * Type declarations for @tanstack/react-query
 * Provides proper TypeScript support for React Query hooks
 */

declare module '@tanstack/react-query' {
  export interface UseQueryOptions<TData = unknown, TError = unknown> {
    queryKey: Array<string | number | object>;
    queryFn: () => Promise<TData>;
    refetchInterval?: number;
    enabled?: boolean;
  }

  export interface UseQueryResult<TData = unknown, TError = unknown> {
    data?: TData;
    error: TError | null;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
  }

  export function useQuery<TData = unknown, TError = unknown>(
    options: UseQueryOptions<TData, TError>
  ): UseQueryResult<TData, TError>;

  export const QueryClient: any;
  export const QueryClientProvider: any;
}
