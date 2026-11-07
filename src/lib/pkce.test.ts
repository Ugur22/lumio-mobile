import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { base64Url, createPkce } from "./pkce";

const source = {
  randomBytes: (n: number) => new Uint8Array(randomBytes(n)),
  sha256: async (text: string) => new Uint8Array(createHash("sha256").update(text).digest()),
};

describe("base64Url", () => {
  it("matches Node's base64url for every padding length", () => {
    for (const len of [0, 1, 2, 3, 4, 31, 32, 33]) {
      const bytes = new Uint8Array(randomBytes(len));
      expect(base64Url(bytes)).toBe(Buffer.from(bytes).toString("base64url"));
    }
  });

  it("uses - and _ instead of + and /, with no padding", () => {
    expect(base64Url(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe("-__-");
    expect(base64Url(new Uint8Array([0xff]))).toBe("_w");
  });
});

describe("createPkce", () => {
  it("makes a 43-character base64url verifier and its S256 challenge", async () => {
    const { verifier, challenge } = await createPkce(source);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("matches the RFC 7636 example", async () => {
    const fixed = new Uint8Array([
      116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77, 105, 214, 191, 240, 91, 88, 5, 88, 83,
      132, 141, 121,
    ]);
    const { verifier, challenge } = await createPkce({ ...source, randomBytes: () => fixed });
    expect(verifier).toBe("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("gives a fresh verifier each time", async () => {
    expect((await createPkce(source)).verifier).not.toBe((await createPkce(source)).verifier);
  });
});
