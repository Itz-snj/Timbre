import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a full deployment rather than a locally-booted server, so it
 * needs no Firebase/Mongo secrets in CI. Defaults to the live URL (matching the
 * Phase 7 exit criterion: "the live URL, opened cold with no prior session,
 * works end to end for a new visitor"); override with PLAYWRIGHT_BASE_URL to
 * point at a local `next dev` / `next start` instance.
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? "https://timbre-snj.vercel.app";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
