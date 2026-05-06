/**
 * Type declarations for @tanstack/react-query
 * Provides proper TypeScript support for React Query hooks
 */

declare module '@tanstack/react-query' {
  export interface UseQueryOptions<TData = unknown, TError = unknown> {
    queryKey: Array<string | number | object>;
    queryFn: () => Promise<TData>;
    refetchInterval?: number;
    staleTime?: number;
    pollInterval?: number;
    enabled?: boolean;
  }

  export interface UseQueryResult<TData = unknown, TError = unknown> {
    data?: TData;
    error: TError | null;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    refetch: () => Promise<any>;
  }

  export function useQuery<TData = unknown, TError = unknown>(
    options: UseQueryOptions<TData, TError>
  ): UseQueryResult<TData, TError>;

  export function useMutation<TData = unknown, TError = unknown, TVariables = unknown>(
    options: { mutationFn: (variables: TVariables) => Promise<TData>; onSuccess?: (data: TData) => void; onError?: (error: TError) => void }
  ): { mutate: (variables: TVariables) => void; isPending: boolean; isSuccess: boolean; error: TError | null };

  export function useQueries<TData = unknown, TError = unknown>(options: { queries: Array<{ queryKey: any[]; queryFn: () => Promise<TData>; staleTime?: number; gcTime?: number }> }): Array<UseQueryResult<TData, TError>>;

  export function useQueryClient(): QueryClient;

  export class QueryClient {
    constructor(options?: any);
    prefetchQuery(options: any): Promise<any>;
    invalidateQueries(options: { queryKey: any[] }): Promise<any>;
  }
  export const QueryClientProvider: any;
}
