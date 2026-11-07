const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Base64url without padding (RFC 7636). Written out here because React Native has no Buffer.
export function base64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!;
    if (i + 1 < bytes.length) out += ALPHABET[(n >> 6) & 63]!;
    if (i + 2 < bytes.length) out += ALPHABET[n & 63]!;
  }
  return out;
}

export interface Pkce {
  verifier: string;
  challenge: string;
}

// The platform's random bytes and SHA-256 are passed in, so this stays testable without a native module.
export interface PkceSource {
  randomBytes: (length: number) => Uint8Array;
  sha256: (text: string) => Promise<Uint8Array>;
}

// 32 random bytes give a 43-character verifier; the challenge is S256 of its ASCII text.
export async function createPkce({ randomBytes, sha256 }: PkceSource): Promise<Pkce> {
  const verifier = base64Url(randomBytes(32));
  return { verifier, challenge: base64Url(await sha256(verifier)) };
}
