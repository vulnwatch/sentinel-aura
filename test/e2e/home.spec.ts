import { expect, test } from "./fixtures";

test("the home page shows the name of the application", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sentinel Aura" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("home.png");
});

// The title of the entry document, which names the product, until the Home
// sets its own (docs/behaviors.md, Accessibility; Style).
test("the home page has the product name as its title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Sentinel");
});
