import { expect, test } from "@playwright/test";

/**
 * The new-visitor core flow (ai_rules.md Phase 7 exit criterion): a stranger
 * with no session can load the landing page, and the authenticated app shell
 * keeps them out until they sign in. Needs no credentials — it exercises exactly
 * the surface an evaluator sees on a cold open.
 */
test.describe("unauthenticated visitor", () => {
  test("landing page shows the product and a Google sign-in CTA", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Timbre/i);
    await expect(
      page.getByRole("button", { name: /continue with google/i }).first(),
    ).toBeVisible();
  });

  test("visiting /app without a session redirects to the landing page", async ({
    page,
  }) => {
    await page.goto("/app");

    // proxy.ts sends signed-out users to `/?next=/app&reason=auth`.
    await expect(page).toHaveURL(/reason=auth/);
    await expect(page).toHaveURL(/next=%2Fapp/);
    await expect(
      page.getByRole("button", { name: /continue with google/i }).first(),
    ).toBeVisible();
  });
});
