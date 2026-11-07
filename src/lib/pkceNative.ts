import * as Crypto from "expo-crypto";

import { createPkce, type Pkce } from "./pkce";

export const newPkce = (): Promise<Pkce> =>
  createPkce({
    randomBytes: (length) => Crypto.getRandomBytes(length),
    sha256: async (text) =>
      new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(text))),
  });
