import { expect, test } from "./fixtures";

// A user of Sentinel's example dataset and its published password (Sentinel
// docs/features/platform/example-dataset.md, Credentials; Users).
const DATASET_USER = "jdoe";
const DATASET_PASSWORD = "example-dataset-password";
const SESSION_COOKIE = "__Host-sentinel_session";

test.describe("the end-to-end environment", () => {
  test("serves the UI's production image with its policy", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toContain(
      "require-trusted-types-for 'script'",
    );
  });

  // As the Sentinel host does (docs/architecture.md, Same Origin): the API
  // answers a path of no endpoint with its routing response, and the UI's
  // image answers its paths with the entry document.
  test("routes /api to Sentinel and every other path to the UI", async ({
    request,
  }) => {
    for (const path of ["/api", "/api?probe=1", "/api/v1/no-such-endpoint"]) {
      const response = await request.get(path);
      const body: unknown = await response.json();
      expect(response.status(), path).toBe(404);
      expect(body, path).toMatchObject({ code: "ROUTE_NOT_FOUND" });
    }
    for (const path of ["/apidocs", "/api-keys", "/auth/callback"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(await response.text(), path).toContain('<div id="root">');
    }
  });

  // The browser accepts the session cookie on http://localhost
  // (docs/architecture.md, Local Development), and the proxy forwards the
  // request headers that Sentinel's cross-origin request protection reads.
  test("lets a page of the UI sign in with the session cookie", async ({
    context,
    page,
  }) => {
    await page.goto("/");
    const loginStatus = await page.evaluate(
      async ({ username, password }) => {
        const response = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        return response.status;
      },
      { username: DATASET_USER, password: DATASET_PASSWORD },
    );
    expect(loginStatus).toBe(200);
    expect((await context.cookies()).map((cookie) => cookie.name)).toContain(
      SESSION_COOKIE,
    );

    // A single resource is the data member of the response (Sentinel
    // docs/api-spec.md, Response Format).
    const username = await page.evaluate(async () => {
      const response = await fetch("/api/v1/users/me");
      const body: unknown = await response.json();
      if (typeof body !== "object" || body === null || !("data" in body)) {
        return undefined;
      }
      const user = body.data;
      return typeof user === "object" && user !== null && "username" in user
        ? user.username
        : undefined;
    });
    expect(username).toBe(DATASET_USER);
  });
});

// Each of these tests breaks one check of the shared fixture, which must then
// fail it.
test.describe("the checks of every test", () => {
  test("fail on a policy violation", async ({ page }) => {
    test.fail();
    await page.goto("/");
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.textContent = "body { color: black; }";
      document.head.append(style);
    });
  });

  test("fail on an uncaught exception", async ({ page }) => {
    test.fail();
    await page.goto("/");
    const error = page.waitForEvent("pageerror");
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error("A fictional uncaught exception");
      });
    });
    await error;
  });

  test("fail on an accessibility violation", async ({ page }) => {
    test.fail();
    await page.goto("/");
    await page.evaluate(() => {
      document.body.append(document.createElement("button"));
    });
  });
});
