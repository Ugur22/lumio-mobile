// The server's own reason when there is one (ApiError carries it), else a fixed sentence the person can act on.
export const errorMessage = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback);
