import { AxeBuilder } from "@axe-core/playwright";
import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

// The checks of every end-to-end test (docs/conventions.md, End-to-End
// Tests): a test fails on any Content Security Policy violation, on any
// uncaught exception of a page, and on any violation of the WCAG 2.2 A and AA
// rules of axe-core in its final state, under the light and the dark color
// scheme (docs/architecture.md, Static Checks and Tests; Security Headers).
// Every test imports `test` and `expect` from this module.

// The rules of WCAG 2.0, 2.1, and 2.2, levels A and AA, as axe-core tags them.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// A color scheme that the browser reports, which shows the theme of the same
// name unless the user chooses one (docs/behaviors.md, Preferences).
type ColorScheme = "light" | "dark";

// The violations of the WCAG rules under each color scheme, one line each.
type Violations = Record<ColorScheme, string[]>;

declare global {
  interface Window {
    // Reports a policy violation of the page to its test (pageChecks).
    reportPolicyViolation?: (violation: string) => Promise<void>;
  }
}

// The violations of the WCAG rules in the current state of the page, one line
// each.
async function violationsOf(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes
        .map((node) => String(node.target))
        .join(", ")})`,
  );
}

// The violations of the WCAG rules in the current state of the page under each
// color scheme. The page then returns to its own color scheme, so that the
// test continues, and takes its screenshots, in the theme that it shows.
//
// The emulation of a color scheme, and with it every style that depends on
// the scheme, has taken effect when emulateMedia returns. A page that applies
// its theme later, for example from a script that reacts to the change, needs
// this check to wait for it, or the check sees the other theme.
async function accessibilityViolations(page: Page): Promise<Violations> {
  const own = await page.evaluate((): ColorScheme =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );
  try {
    await page.emulateMedia({ colorScheme: "light" });
    const light = await violationsOf(page);
    await page.emulateMedia({ colorScheme: "dark" });
    const dark = await violationsOf(page);
    return { light, dark };
  } finally {
    await page.emulateMedia({ colorScheme: own });
  }
}

// Fails on any violation of the WCAG rules, under the light color scheme
// first, and names the scheme.
function expectNoViolations(violations: Violations) {
  expect(
    violations.light,
    "axe-core violations in the light color scheme",
  ).toEqual([]);
  expect(
    violations.dark,
    "axe-core violations in the dark color scheme",
  ).toEqual([]);
}

// Fails unless the current state of the page meets the WCAG rules under each
// color scheme. Every test checks its final state; a test calls this for every
// further state that it shows, such as an open dialog.
export async function expectAccessible(page: Page) {
  expectNoViolations(await accessibilityViolations(page));
}

// The published password of every user of Sentinel's example dataset
// (Sentinel docs/features/platform/example-dataset.md, Credentials).
export const DATASET_PASSWORD = "example-dataset-password";

// Fills in Sign in and submits it.
export async function submitSignIn(
  page: Page,
  username: string,
  password: string,
) {
  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

// The users of the dataset who hold triage_ticket, through the
// vulnerability_analyst or the restricted_analyst role, and can sign in (same
// document, Users), whose landing is the Ticket list in its New view; the
// landing of every other user is the Home (docs/screen-map.md, Landing).
const TRIAGERS = new Set(["asmith", "bwilson", "cwhite", "security-scanner"]);

// Signs in on Sign in, opened directly, as a user of the dataset, jdoe by
// default (same document, Users), and waits for the landing of the user, to
// which Sign in then leads (docs/behaviors.md, Return After Sign-in). Each
// path but Sign in and /auth/callback requires a session
// (docs/screen-map.md, Contract URLs).
export async function signIn(page: Page, username = "jdoe") {
  await page.goto("/login");
  await submitSignIn(page, username, DATASET_PASSWORD);
  await page.waitForURL(TRIAGERS.has(username) ? "/tickets?view=new" : "/");
}

// The avatars that the page shows, which the reference screenshots mask: the
// dataset does not fix the users' ids, from which the avatars are generated
// (docs/conventions.md, End-to-End Tests). An avatar is hidden from assistive
// technologies, so it has no role or name to find it by; it is the only
// picture of the page with the view box of 6 by 6 units that
// src/components/avatar.tsx draws it in.
export function avatars(page: Page): Locator {
  return page.locator('svg[viewBox="0 0 6 6"]');
}

// The dates and times that the page shows, which the reference screenshots
// mask: the dataset computes them from the instant of its load (same
// document, Time Base). A date and time shows in a time element.
export function dateTimes(page: Page): Locator {
  return page.locator("time");
}

export const test = base.extend<{ pageChecks: undefined }>({
  pageChecks: [
    async ({ context, page }, use, testInfo) => {
      const policyViolations: string[] = [];
      const uncaughtErrors: string[] = [];
      await context.exposeBinding(
        "reportPolicyViolation",
        (_source, violation: string) => {
          policyViolations.push(violation);
        },
      );
      // Runs in every page before its own scripts, so that it sees every
      // violation, those of Trusted Types included.
      await context.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (event) => {
          const blocked = event.blockedURI || "inline";
          const sample = event.sample ? `: ${event.sample}` : "";
          const source = event.sourceFile
            ? ` at ${event.sourceFile}:${event.lineNumber}`
            : "";
          void window.reportPolicyViolation?.(
            `${event.effectiveDirective} blocked ${blocked}${sample}${source}`,
          );
        });
      });
      context.on("weberror", (error) => {
        uncaughtErrors.push(String(error.error()));
      });

      await use(undefined);

      // The final state, unless the test failed before reaching it or its
      // page has no address: it opened none, or set its content itself.
      const accessibility: Violations =
        testInfo.status === "passed" && page.url() !== "about:blank"
          ? await accessibilityViolations(page)
          : { light: [], dark: [] };
      expect(policyViolations, "Content Security Policy violations").toEqual(
        [],
      );
      expect(uncaughtErrors, "uncaught exceptions").toEqual([]);
      expectNoViolations(accessibility);
    },
    { auto: true },
  ],
});

export { expect };
