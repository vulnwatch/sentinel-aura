import { expect, test } from "./fixtures";

test("the home page shows the name of the application", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sentinel Aura (break test)" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("home.png");
});
