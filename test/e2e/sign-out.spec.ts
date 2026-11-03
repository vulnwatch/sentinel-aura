import { expect, signIn, test } from "./fixtures";

// Sign out (docs/behaviors.md, Sign-out), against a backend loaded with
// Sentinel's example dataset. It ends only the session of its own browser
// context (Sentinel docs/features/identity/authentication.md, Logout;
// Concurrent sessions).

const EXPIRED = "Your session has expired. Sign in again.";

test("ends the session and opens Sign in without telling that it expired", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/cves?page=2");
  await expect(
    page.getByRole("heading", { level: 1, name: "Not found" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name: "John Doe" })
    .click();

  await page
    .getByRole("menu", { name: "John Doe" })
    .getByRole("menuitem", { name: "Sign out" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in" }),
  ).toBeFocused();
  await expect(page).toHaveURL("/login");
  await expect(page.getByText(EXPIRED)).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);

  // The session has ended in Sentinel, and the browser keeps no record of
  // it: a screen leads to Sign in, still without the message of an expired
  // session.
  await page.goto("/cves");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in" }),
  ).toBeVisible();
  await expect(page.getByText(EXPIRED)).toHaveCount(0);
  const me = await page.request.get("/api/v1/users/me");
  expect(me.status()).toBe(401);
});
