import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Only the pure TypeScript (parsers, API client, stores' logic) runs here; screens are checked on a device.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
