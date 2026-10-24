import { AxeBuilder } from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

// The checks of every end-to-end test (docs/conventions.md, End-to-End
// Tests): a test fails on any Content Security Policy violation, on any
// uncaught exception of a page, and on any violation of the WCAG 2.2 A and AA
// rules of axe-core in its final state (docs/architecture.md, Static Checks
// and Tests; Security Headers). Every test imports `test` and `expect` from
// this module.

// The rules of WCAG 2.0, 2.1, and 2.2, levels A and AA, as axe-core tags them.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

declare global {
  interface Window {
    // Reports a policy violation of the page to its test (pageChecks).
    reportPolicyViolation?: (violation: string) => Promise<void>;
  }
}

// The violations of the WCAG rules in the current state of the page, one line
// each.
async function accessibilityViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes
        .map((node) => String(node.target))
        .join(", ")})`,
  );
}

// Fails unless the current state of the page meets the WCAG rules. Every test
// checks its final state; a test calls this for every further state that it
// shows, such as an open dialog.
export async function expectAccessible(page: Page) {
  expect(await accessibilityViolations(page), "axe-core violations").toEqual(
    [],
  );
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

      // The final state, unless the test failed before reaching it or opened
      // no page.
      const accessibility =
        testInfo.status === "passed" && page.url() !== "about:blank"
          ? await accessibilityViolations(page)
          : [];
      expect(policyViolations, "Content Security Policy violations").toEqual(
        [],
      );
      expect(uncaughtErrors, "uncaught exceptions").toEqual([]);
      expect(accessibility, "axe-core violations").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
