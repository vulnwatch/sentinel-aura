import type { Page } from "@playwright/test";
import {
  DATASET_PASSWORD,
  expect,
  expectAccessible,
  signIn,
  submitSignIn,
  test,
} from "./fixtures";

// Sign in and the session (docs/screens/sign-in.md; docs/behaviors.md,
// Session), against a backend loaded with Sentinel's example dataset. A
// rejected sign-in counts toward the lockout of its username (Sentinel
// docs/features/identity/local-authentication.md, Account lockout), so each
// test that is rejected uses a username of its own, of no user of the
// dataset.

const EXPIRED = "Your session has expired. Sign in again.";
// A path that requires a session and matches no screen, with a search and a
// fragment, to which Sign in returns.
const SCREEN = "/fictional/path?view=all#part";

function heading(page: Page, name: string) {
  return page.getByRole("heading", { level: 1, name });
}

test.describe("Sign in", () => {
  test("shows in place of a path on a first visit, without telling that a session expired", async ({
    page,
  }) => {
    await page.goto(SCREEN);

    await expect(heading(page, "Sign in")).toBeVisible();
    await expect(page).toHaveURL("/login");
    await expect(page).toHaveTitle("Sign in – Sentinel");
    await expect(page.getByText(EXPIRED)).toHaveCount(0);
    await expect(page).toHaveScreenshot("sign-in.png");
  });

  test("returns to the path after the sign-in", async ({ page }) => {
    await page.goto(SCREEN);
    await expect(heading(page, "Sign in")).toBeVisible();

    await submitSignIn(page, "jdoe", DATASET_PASSWORD);

    await expect(heading(page, "Not found")).toBeVisible();
    await expect(page).toHaveURL(SCREEN);
  });

  test("tells that the session expired when the browser had one, also after a reload", async ({
    context,
    page,
  }) => {
    await signIn(page);
    await expect(heading(page, "Sentinel Aura")).toBeVisible();
    // The session ends without a sign-out, as when it expires.
    await context.clearCookies();

    await page.goto(SCREEN);

    await expect(heading(page, "Sign in")).toBeVisible();
    await expect(page.getByText(EXPIRED)).toBeVisible();
    await expect(page).toHaveScreenshot("sign-in-session-expired.png");
    await page.reload();
    await expect(page.getByText(EXPIRED)).toBeVisible();

    await submitSignIn(page, "jdoe", DATASET_PASSWORD);
    await expect(page).toHaveURL(SCREEN);
  });

  test("opens the landing when it is opened with a session", async ({
    page,
  }) => {
    await signIn(page);

    await page.goto("/login");

    await expect(heading(page, "Sentinel Aura")).toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("says that a rejected username or password isn't correct, and keeps the input", async ({
    page,
  }) => {
    await page.goto("/login");

    await submitSignIn(page, "fictional-rejected-user", "fictional-password");

    const message = page.getByText("The username or password isn't correct.");
    await expect(message).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Username" })).toHaveValue(
      "fictional-rejected-user",
    );
    await expect(page).toHaveURL("/login");
    await expect(page).toHaveScreenshot("sign-in-failed.png");
  });

  test("says that there were too many attempts once the username is locked", async ({
    page,
  }) => {
    await page.goto("/login");
    const rejected = page.getByText("The username or password isn't correct.");
    // The default lockout: five failed attempts.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await submitSignIn(page, "fictional-locked-user", "fictional-password");
      await expect(rejected).toBeVisible();
    }

    await submitSignIn(page, "fictional-locked-user", "fictional-password");

    await expect(
      page.getByText("Too many attempts. Try again later."),
    ).toBeVisible();
  });

  test("checks the fields before it sends anything", async ({ page }) => {
    await page.goto("/login");
    const signIns: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/v1/auth/login") {
        signIns.push(request.method());
      }
    });

    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Enter your username.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Username" })).toBeFocused();
    await expectAccessible(page);
    expect(signIns).toEqual([]);
  });
});
