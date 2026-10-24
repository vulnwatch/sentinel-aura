import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import { expect, test } from "./fixtures";

// The responses of the UI's image (docs/architecture.md, Packaging and
// Serving; Security Headers). The image project runs these tests in the
// network namespace of a container of the image alone, without a proxy or a
// backend; scripts/image.sh test starts it, and checks through Docker what
// the responses cannot show: the user and the content of the image, its
// processes, and its access log.

// The production build that the image serves (scripts/image.sh build).
const BUILD_DIR = join(import.meta.dirname, "..", "..", "dist");
// The directory of the content-hashed files of the build: keep in sync with
// nginx/default.conf.
const ASSET_DIR = "/assets";

// The headers of docs/architecture.md (Security Headers), which every
// response carries exactly once with these values. The style-src hash is the
// one of nginx/default.conf, which explains it.
const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'none'; script-src 'self'; style-src 'self' 'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
};
const ENTRY_CACHE_CONTROL = "no-cache";
const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

// The paths that the application resolves: every path outside the asset
// directory, the asset directory itself without a trailing slash included,
// which nginx would otherwise redirect to an absolute URL built from the Host
// header.
const ENTRY_PATHS = [
  "/",
  "/index.html",
  "/tickets/SNTL-1/audit",
  "/auth/callback?code=example-code&state=example-state",
  "/health",
  "/ready",
  ASSET_DIR,
];
// The paths of the asset directory that are no file of the build.
const MISSING_PATHS = [`${ASSET_DIR}/missing.js`, `${ASSET_DIR}/`];

// Requests the path, without following a redirect.
function get(
  request: APIRequestContext,
  path: string,
  headers: Record<string, string> = {},
): Promise<APIResponse> {
  return request.get(path, { headers, maxRedirects: 0 });
}

// The values of the header named `name`, in lower case, of a response.
function headerValues(response: APIResponse, name: string): string[] {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === name)
    .map((header) => header.value);
}

function buildFile(path: string): Promise<Buffer> {
  return readFile(join(BUILD_DIR, path));
}

// The path of the first file with the extension `extension` that the entry
// document references in the asset directory.
async function referencedAsset(extension: string): Promise<string> {
  const entry = (await buildFile("index.html")).toString("utf8");
  const path = new RegExp(`"(${ASSET_DIR}/[^"]+\\.${extension})"`).exec(
    entry,
  )?.[1];
  if (path === undefined) {
    throw new Error(
      `the entry document references no .${extension} file in ${ASSET_DIR}/`,
    );
  }
  return path;
}

// The headers of every response: each security header exactly once, a
// Permissions-Policy that only disables features, no
// Strict-Transport-Security, and no redirect.
function expectCommonHeaders(response: APIResponse, label: string) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    expect(headerValues(response, name), `${label}: ${name}`).toEqual([value]);
  }
  const policies = headerValues(response, "permissions-policy");
  expect(policies, `${label}: one Permissions-Policy`).toHaveLength(1);
  for (const entry of (policies[0] ?? "").split(",")) {
    expect(
      entry.trim(),
      `${label}: Permissions-Policy disables features only`,
    ).toMatch(/^[a-z][a-z0-9-]*=\(\)$/);
  }
  expect(
    headerValues(response, "strict-transport-security"),
    `${label}: no Strict-Transport-Security`,
  ).toEqual([]);
  expect(headerValues(response, "location"), `${label}: no Location`).toEqual(
    [],
  );
}

// The entry document, which the browser revalidates on every load.
async function expectEntryDocument(response: APIResponse, label: string) {
  expect(response.status(), label).toBe(200);
  const entry = await buildFile("index.html");
  expect(
    (await response.body()).equals(entry),
    `${label}: the entry document`,
  ).toBe(true);
  expect(headerValues(response, "cache-control"), label).toEqual([
    ENTRY_CACHE_CONTROL,
  ]);
  expectCommonHeaders(response, label);
}

test.describe("the UI's image", () => {
  for (const path of ENTRY_PATHS) {
    test(`answers GET ${path} with the entry document`, async ({ request }) => {
      await expectEntryDocument(await get(request, path), path);
    });
  }

  // Its responses depend on neither the scheme nor the Host header with which
  // a request reaches it (docs/architecture.md, Packaging and Serving).
  test(`answers GET ${ASSET_DIR} through another host with the entry document`, async ({
    request,
  }) => {
    const response = await get(request, ASSET_DIR, {
      Host: "sentinel.example.com",
      "X-Forwarded-Proto": "https",
    });
    await expectEntryDocument(response, ASSET_DIR);
  });

  test("serves the files of the asset directory with a year of caching", async ({
    request,
  }) => {
    const files = [
      { path: await referencedAsset("js"), type: "application/javascript" },
      { path: await referencedAsset("css"), type: "text/css" },
    ];
    for (const { path, type } of files) {
      const response = await get(request, path);
      expect(response.status(), path).toBe(200);
      expect(
        (await response.body()).equals(await buildFile(path)),
        `${path}: the file of the build`,
      ).toBe(true);
      expect(headerValues(response, "cache-control"), path).toEqual([
        ASSET_CACHE_CONTROL,
      ]);
      expect(headerValues(response, "content-type"), path).toEqual([type]);
      expectCommonHeaders(response, path);
    }
  });

  for (const path of MISSING_PATHS) {
    test(`answers GET ${path} with 404`, async ({ request }) => {
      const response = await get(request, path);
      expect(response.status(), path).toBe(404);
      expect(
        headerValues(response, "cache-control"),
        `${path}: not cached`,
      ).toEqual([]);
      expectCommonHeaders(response, path);
    });
  }
});
