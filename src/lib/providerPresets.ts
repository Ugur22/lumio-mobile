import type { NewProfileBody, Profile, ProfileList } from "@/api/types";

export interface Preset {
  id: string;
  name: string;
  baseUrl: string;
  // Where the person gets a key for this provider.
  keyUrl: string;
}

export const PRESETS: readonly Preset[] = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/keys" },
  { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1", keyUrl: "https://console.groq.com/keys" },
  { id: "together", name: "Together", baseUrl: "https://api.together.xyz/v1", keyUrl: "https://api.together.xyz/settings/api-keys" },
];

export const hostOf = (url: string): string => url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");

// Pasted keys often carry a trailing newline or space; a key never contains whitespace.
export const cleanKey = (raw: string): string => raw.replace(/\s+/g, "");

export const validBaseUrl = (raw: string): boolean => /^https?:\/\/[^\s/.]+\.?[^\s/]*/i.test(raw.trim());

const NAME_MAX = 60;

interface Draft {
  name: string;
  baseUrl: string;
  model: string;
  key: string;
}

// An empty key means the server needs none (a local Ollama or LM Studio), so the backend skips the key check.
export function newProfileBody({ name, baseUrl, model, key }: Draft): NewProfileBody {
  const clean = cleanKey(key);
  return {
    name: name.trim().slice(0, NAME_MAX),
    base_url: baseUrl.trim(),
    model,
    needs_key: clean !== "",
    key: clean === "" ? null : clean,
  };
}

// POST /profiles answers with the whole list; the new profile is the one that was not there before.
export function addedProfile(before: ProfileList | undefined, after: ProfileList): Profile | undefined {
  const known = new Set(before?.profiles.map((p) => p.id));
  return after.profiles.find((p) => !known.has(p.id));
}
