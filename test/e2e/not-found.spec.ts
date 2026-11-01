import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Not found (docs/behaviors.md, Missing and Inaccessible Records), which the
// UI's image serves for every path that matches no file of the build, and
// the application shows for every path that matches no screen.

async function expectNotFound(page: Page) {
  await expect(
    page.getByRole("heading", { level: 1, name: "Not found" }),
  ).toBeVisible();
  await expect(
    page.getByText("This page doesn't exist, or you don't have access to it."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to the start page" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Not found – Sentinel");
}

test("a path that matches no screen shows Not found", async ({ page }) => {
  await page.goto("/fictional/path");
  await expectNotFound(page);
  await expect(page).toHaveScreenshot("not-found.png");
});

// docs/screen-map.md, Contract URLs.
test("/auth/callback shows Not found while it is reserved", async ({
  page,
}) => {
  await page.goto("/auth/callback?code=fictional-code&state=fictional-state");
  await expectNotFound(page);
});

test("Not found leads to the landing", async ({ page }) => {
  await page.goto("/fictional/path");
  await page.getByRole("link", { name: "Go to the start page" }).click();

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sentinel Aura" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Sentinel");
});
