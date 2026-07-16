import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Unit tests import pure lib modules; a few of those are marked
      // `server-only` (which throws outside a Server Component). Stub it so the
      // pure logic inside can still be exercised.
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
});
