import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { APIResponse } from "@playwright/test";
import { expect, test } from "./fixtures";

// The same origin of the UI and the API (docs/architecture.md, Same Origin;
// Session Cookie; Cross-Origin Requests; Local Development): the projects of
// the browsers check the reverse proxy of the end-to-end environment, which
// stands for the one of the Sentinel host, and the dev-server project checks
// the proxy of the development server (docs/conventions.md, End-to-End
// Tests). Both route /api as the Sentinel host does and forward the request
// headers that Sentinel's cross-origin request protection reads unchanged.
// No request follows a redirect, which neither the proxy nor the API sends
// for these requests.

// A user of Sentinel's example dataset and its published password (Sentinel
// docs/features/platform/example-dataset.md, Credentials; Users).
const DATASET_USER = "jdoe";
const DATASET_PASSWORD = "example-dataset-password";
const SESSION_COOKIE = "__Host-sentinel_session";
// The pinned Sentinel version (docs/architecture.md, Backend Contract).
const VERSION_FILE = join(
  import.meta.dirname,
  "..",
  "..",
  "contract",
  "sentinel-version",
);

// The origin of the UI in the project that runs the test.
function originOf(baseURL: string | undefined): string {
  if (baseURL === undefined) {
    throw new Error("the project sets no baseURL");
  }
  return new URL(baseURL).origin;
}

// The Set-Cookie headers of a response that set the session cookie.
function sessionCookies(response: APIResponse): string[] {
  return response
    .headersArray()
    .filter(
      ({ name, value }) =>
        name.toLowerCase() === "set-cookie" &&
        value.startsWith(`${SESSION_COOKIE}=`),
    )
    .map(({ value }) => value);
}

test.describe("the origin of the UI and the API", () => {
  test("reaches Sentinel at the pinned version", async ({ request }) => {
    const version = (await readFile(VERSION_FILE, "utf8")).trim();
    const response = await request.get("/api/openapi.json", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
    const document: unknown = await response.json();
    expect(document).toMatchObject({ info: { version } });
  });

  // The API answers a path of no endpoint with its routing response
  // (Sentinel docs/api-spec.md, Routing Responses), and the UI answers its
  // paths with the entry document.
  test("routes /api to Sentinel and every other path to the UI", async ({
    request,
  }) => {
    for (const path of ["/api", "/api?probe=1", "/api/v1/no-such-endpoint"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
      const body: unknown = await response.json();
      expect(body, path).toMatchObject({ code: "ROUTE_NOT_FOUND" });
    }
    for (const path of [
      "/",
      "/apidocs",
      "/api-keys",
      "/health",
      "/ready",
      "/auth/callback",
    ]) {
      const response = await request.get(path, {
        headers: { Accept: "text/html" },
        maxRedirects: 0,
      });
      expect(response.status(), path).toBe(200);
      expect(await response.text(), path).toContain('<div id="root">');
    }
  });

  // No CORS: the proxy adds no CORS headers and answers no preflight request
  // itself. The API answers it, as the X-Request-ID that it sets on every
  // response shows (Sentinel docs/api-spec.md, Request Tracing), and without
  // CORS_ORIGINS it allows no other origin (Sentinel docs/configuration.md,
  // Application).
  test("adds no CORS headers", async ({ request }) => {
    const otherOrigin = "http://localhost:3000";
    const preflight = await request.fetch("/api/v1/auth/login", {
      method: "OPTIONS",
      headers: { Origin: otherOrigin, "Access-Control-Request-Method": "POST" },
      maxRedirects: 0,
    });
    expect(preflight.headers()["x-request-id"], "X-Request-ID").toMatch(
      /^\S+$/,
    );
    expect(preflight.headers()["access-control-allow-origin"]).toBeUndefined();
    const entry = await request.get("/", {
      headers: { Origin: otherOrigin },
      maxRedirects: 0,
    });
    expect(entry.headers()["access-control-allow-origin"]).toBeUndefined();
  });

  // A logout without a credential changes nothing: the API answers 401 when
  // its cross-origin request protection accepts the request, and 403 when it
  // rejects it, which shows how the headers reached it (Sentinel
  // docs/features/identity/authentication.md, Cross-Origin Request
  // Protection).
  test("forwards Host, Origin, and Sec-Fetch-Site unchanged", async ({
    baseURL,
    request,
  }) => {
    const origin = originOf(baseURL);
    const cases: {
      check: string;
      headers: Record<string, string>;
      status: number;
      code: string;
    }[] = [
      {
        check: "a request of the UI's origin passes the protection",
        headers: { Origin: origin, "Sec-Fetch-Site": "same-origin" },
        status: 401,
        code: "AUTH_NOT_AUTHENTICATED",
      },
      {
        check: "Host reaches the API unchanged: it matches Origin",
        headers: { Origin: origin },
        status: 401,
        code: "AUTH_NOT_AUTHENTICATED",
      },
      {
        check: "Sec-Fetch-Site reaches the API unchanged",
        headers: { Origin: origin, "Sec-Fetch-Site": "cross-site" },
        status: 403,
        code: "AUTH_CROSS_ORIGIN_REJECTED",
      },
      {
        check: "Origin reaches the API unchanged",
        headers: { Origin: "http://ui.example.com" },
        status: 403,
        code: "AUTH_CROSS_ORIGIN_REJECTED",
      },
    ];
    for (const { check, headers, status, code } of cases) {
      const response = await request.post("/api/v1/auth/logout", {
        headers,
        maxRedirects: 0,
      });
      expect(response.status(), check).toBe(status);
      const body: unknown = await response.json();
      expect(body, check).toMatchObject({ code });
    }
  });

  // A sign-in of a dataset user, with the headers that a browser sends for a
  // page of the UI's origin: the session cookie arrives with its attributes
  // (Sentinel docs/features/identity/authentication.md, Session cookie),
  // carries the session, and the logout clears it.
  test("signs in with the session cookie, which the logout clears", async ({
    baseURL,
    request,
  }) => {
    const browser = {
      Origin: originOf(baseURL),
      "Sec-Fetch-Site": "same-origin",
    };
    const login = await request.post("/api/v1/auth/login", {
      headers: browser,
      data: { username: DATASET_USER, password: DATASET_PASSWORD },
      maxRedirects: 0,
    });
    expect(login.status()).toBe(200);
    const setCookies = sessionCookies(login);
    expect(setCookies, `the login sets ${SESSION_COOKIE}`).toHaveLength(1);
    const [pair = "", ...attributes] = (setCookies[0] ?? "")
      .split(";")
      .map((part) => part.trim());
    const lowerCase = attributes.map((attribute) => attribute.toLowerCase());
    expect(lowerCase).toEqual(
      expect.arrayContaining([
        "httponly",
        "secure",
        "samesite=strict",
        "path=/",
      ]),
    );
    expect(
      lowerCase.filter((attribute) => attribute.startsWith("domain=")),
    ).toEqual([]);
    const withCookie = { ...browser, Cookie: pair };

    const user = await request.get("/api/v1/users/me", {
      headers: withCookie,
      maxRedirects: 0,
    });
    expect(user.status()).toBe(200);
    const body: unknown = await user.json();
    expect(body).toMatchObject({ data: { username: DATASET_USER } });

    const logout = await request.post("/api/v1/auth/logout", {
      headers: withCookie,
      maxRedirects: 0,
    });
    expect(logout.status()).toBe(204);
    expect(
      sessionCookies(logout).map((cookie) => cookie.split(";")[0]),
      "the logout clears the session cookie",
    ).toEqual([`${SESSION_COOKIE}=`]);
    const afterLogout = await request.get("/api/v1/users/me", {
      headers: withCookie,
      maxRedirects: 0,
    });
    expect(afterLogout.status()).toBe(401);
  });

  // The browser accepts the session cookie on http://localhost
  // (docs/architecture.md, Local Development) and sends it with the requests
  // of a page of the UI.
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
    const cookie = (await context.cookies()).find(
      ({ name }) => name === SESSION_COOKIE,
    );
    expect(cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/",
    });

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
