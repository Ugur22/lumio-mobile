import { normalizeServerUrl } from "./serverUrl";

const DEPLOYED_SERVER = "https://16-192-71-141.sslip.io";

// EXPO_PUBLIC_LUMIO_SERVER points a dev run at another server (the stub backend of the visual check). It goes through
// the same rules as the address typed behind "Change", so a typo or a public http address falls back to the deployed one.
export function pickDefaultServer(override: string | undefined): string {
  if (!override) return DEPLOYED_SERVER;
  const result = normalizeServerUrl(override);
  return result.ok ? result.url : DEPLOYED_SERVER;
}

// The deployed Lumio server (the hostname is already public in the main repo's Caddyfile). A different server can
// be entered behind "Change" on the login screen, e.g. a local backend while developing.
// Expo only inlines a literal `process.env.EXPO_PUBLIC_…` reference, so do not read the variable any other way.
export const DEFAULT_SERVER = pickDefaultServer(process.env.EXPO_PUBLIC_LUMIO_SERVER);
