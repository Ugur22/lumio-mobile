import { QueryClient } from "@tanstack/react-query";

// Requests happen only on user actions (same as the web app): no focus refetch, no retries, answers stay fresh.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false, staleTime: Infinity } },
});
