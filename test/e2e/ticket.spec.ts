import type { Page } from "@playwright/test";
import {
  avatars,
  dateTimes,
  expect,
  expectAccessible,
  signIn,
  test,
} from "./fixtures";

// The Ticket screen (docs/screens/ticket.md), against a backend loaded with
// Sentinel's example dataset, whose Tickets, CVEs, users, and roles the tests
// rely on as loaded (Sentinel docs/features/platform/example-dataset.md,
// Users; CVEs; Tickets; Aged Tickets; Embargoes; Priorities).

// The reference screenshots mask the avatars and the dates, which change
// from one load of the dataset to the next.
function masked(page: Page) {
  return { mask: [avatars(page), dateTimes(page)] };
}

// The level-one heading of the screen.
function heading(page: Page, name: string) {
  return page.getByRole("heading", { level: 1, name, exact: true });
}

// A part of the main column or a section of the side column, by the name of
// its heading.
function part(page: Page, name: string) {
  return page.getByRole("region", { name, exact: true });
}

// The terms of the details, in their order.
function detailTerms(page: Page) {
  return part(page, "Details").locator("dt");
}

// The value of a field of the details, by its term.
function detail(page: Page, term: string) {
  return part(page, "Details")
    .locator("dt")
    .filter({ hasText: new RegExp(`^${term}$`) })
    .locator("xpath=following-sibling::dd[1]");
}

// Whether the window scrolls its page in the horizontal direction.
function scrollsHorizontally(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

test.describe("for an analyst", () => {
  test("shows a Ticket with its heading row, its CVE, and its details", async ({
    page,
  }) => {
    await signIn(page, "asmith");

    await page.goto("/tickets/SNTL-12");

    await expect(heading(page, "SNTL-12")).toBeVisible();
    await expect(page).toHaveTitle("SNTL-12 – Sentinel");
    // The aged SNTL-12 is Analyzed, with an override of its priority to P1,
    // and its submission is past due (Aged Tickets; Priorities).
    const values = page.locator("main dl").first();
    await expect(values.locator("dt")).toHaveText([
      "CVE",
      "Status",
      "Severity",
      "Priority",
      "Deadline",
    ]);
    await expect(values.locator("dd")).toHaveText([
      "CVE-2099-0012",
      "Analyzed",
      "High",
      "P1",
      /^Submission -\d+dSubmission overdue by \d+ days$/,
    ]);
    await expect(
      page.getByRole("tablist", { name: "Ticket" }).getByRole("tab"),
    ).toHaveText(["Overview"]);
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // The CVE, known only from NVD (CVEs).
    const cve = part(page, "CVE-2099-0012");
    await expect(
      cve.getByText(
        "Fictional vulnerability CVE-2099-0012 of the Sentinel example dataset.",
      ),
    ).toBeVisible();
    await expect(
      cve.getByRole("link", { name: "SUSE CVE page (another site)" }),
    ).toHaveAttribute(
      "href",
      "https://www.suse.com/security/cve/CVE-2099-0012.html",
    );
    await expect(cve.getByText("Not listed")).toBeVisible();

    // The details, without a Coordinated Release Date.
    await expect(detailTerms(page)).toHaveText([
      "Assignee",
      "Deadlines",
      "Triage",
      "Submission",
      "UM",
      "QA, release",
      "Duplicates",
      "Created",
      "Last modified",
    ]);
    await expect(detail(page, "Assignee")).toHaveText("Alice Smith");
    await expect(detail(page, "Submission")).toContainText(
      /Overdue by \d+ days$/,
    );
    await expect(detail(page, "Duplicates")).toHaveText("None");

    // In a window of 1280 px, the details stand beside the CVE.
    const cveBox = await cve.boundingBox();
    const detailsBox = await part(page, "Details").boundingBox();
    expect(detailsBox?.x).toBeGreaterThan(
      (cveBox?.x ?? 0) + (cveBox?.width ?? 0),
    );
    await expect(page).toHaveScreenshot("ticket.png", masked(page));
  });

  test("explains the priority of the Ticket from its heading row", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-12");

    await page.getByRole("button", { name: "P1, override" }).click();

    const explanation = page.getByRole("dialog", { name: "P1, override" });
    await expect(explanation).toBeFocused();
    await expect(explanation).toContainText("Override set by");
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "P1, override" }),
    ).toBeFocused();
  });

  test("shows a confidential Ticket with its Coordinated Release Date", async ({
    page,
  }) => {
    await signIn(page, "asmith");

    await page.goto("/tickets/SNTL-18");

    await expect(heading(page, "SNTL-18")).toBeVisible();
    await expect(page.locator("main").getByText("Confidential")).toBeVisible();
    // A running embargo (Embargoes), whose CVE has an EPSS score (CVEs).
    await expect(detail(page, "Coordinated Release Date")).toHaveText(
      /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/,
    );
    const cve = part(page, "CVE-2099-0018");
    await expect(cve.getByText("CWE-287")).toBeVisible();
    await expect(cve.locator("dd").filter({ hasText: /^0\.31$/ })).toHaveCount(
      1,
    );
    await expect(page).toHaveScreenshot(
      "ticket-confidential.png",
      masked(page),
    );
  });

  test("shows a Ticket without a CVE and its duplicate, each linked to the other", async ({
    page,
  }) => {
    await signIn(page, "asmith");

    await page.goto("/tickets/SNTL-21");

    await expect(heading(page, "SNTL-21")).toBeVisible();
    await expect(part(page, "CVE").getByText("No CVE.")).toBeVisible();
    const duplicate = detail(page, "Duplicates").getByRole("link", {
      name: "SNTL-22",
    });
    await expect(duplicate).toBeVisible();
    await expect(page).toHaveScreenshot("ticket-without-cve.png", masked(page));

    await duplicate.click();

    await expect(heading(page, "SNTL-22")).toBeFocused();
    await expect(page).toHaveURL("/tickets/SNTL-22");
    // A duplicate has no due dates (Sentinel
    // docs/features/tickets/ticket-deadlines.md, Null Due Dates).
    await expect(detail(page, "Deadlines")).toHaveText("–Not set");
    await detail(page, "Original")
      .getByRole("link", { name: "SNTL-21" })
      .click();
    await expect(heading(page, "SNTL-21")).toBeFocused();
  });

  test("shows the exploitation and the external identifiers of a CVE", async ({
    page,
  }) => {
    await signIn(page, "asmith");

    await page.goto("/tickets/SNTL-10");

    const cve = part(page, "CVE-2099-0010");
    await expect(cve.getByText("Fictional flaw CVE-2099-0010")).toBeVisible();
    // The GHSA ingestion of the dataset supplies the identifier without the
    // address of its advisory (CVEs), so it shows as text, without a link.
    await expect(cve.getByText("GHSA-2c4f-7h9j-mqrv")).toBeVisible();
    await expect(cve.getByRole("link", { name: /GHSA/ })).toHaveCount(0);
    await expect(cve.getByText("PoC", { exact: true })).toBeVisible();
    await expect(cve.getByText("0.96", { exact: true })).toBeVisible();

    await page.goto("/tickets/SNTL-8");

    const rejected = part(page, "CVE-2099-0008 Rejected");
    await expect(rejected).toBeVisible();
    await expect(
      rejected.locator("div").filter({ hasText: /^Rejected\d/ }),
    ).toHaveCount(1);
  });

  test("shows the details before the CVE in one column, and reflows at 320 CSS pixels", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 500 });
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-12");
    await expect(heading(page, "SNTL-12")).toBeVisible();

    const details = part(page, "Details");
    const cve = part(page, "CVE-2099-0012");
    const detailsBox = await details.boundingBox();
    const cveBox = await cve.boundingBox();
    expect((detailsBox?.y ?? 0) + (detailsBox?.height ?? 0)).toBeLessThan(
      cveBox?.y ?? 0,
    );
    // The order of the page is the order on the screen.
    expect(
      await details.evaluate(
        (element, other) =>
          Boolean(
            element.compareDocumentPosition(other) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        await cve.elementHandle(),
      ),
    ).toBe(true);

    // The heading row scrolls away with the page.
    await page.mouse.move(450, 300);
    await page.mouse.wheel(0, 400);
    await expect
      .poll(async () => (await heading(page, "SNTL-12").boundingBox())?.y ?? 0)
      .toBeLessThan(0);

    await page.setViewportSize({ width: 320, height: 640 });
    await expect(details).toBeVisible();
    expect(await scrollsHorizontally(page)).toBe(false);
    await expectAccessible(page);
  });

  test("keeps the compact heading at the top of the window while the page scrolls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-10");
    const title = heading(page, "SNTL-10");
    await expect(title).toBeVisible();
    const cve = part(page, "CVE-2099-0010");
    const before = await cve.evaluate(
      (element) => element.getBoundingClientRect().top + window.scrollY,
    );

    await page.mouse.move(640, 300);
    await page.mouse.wheel(0, 300);

    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await title.boundingBox())?.y ?? -1)
      .toBeGreaterThanOrEqual(0);
    await expect(title).toHaveCSS("font-size", "16px");
    // The content does not move when the heading becomes compact.
    expect(
      await cve.evaluate(
        (element) => element.getBoundingClientRect().top + window.scrollY,
      ),
    ).toBe(before);
    await expectAccessible(page);
  });
});

test("shows Not found for a malformed identifier and for a Ticket that the user cannot see", async ({
  page,
}) => {
  // dbrown, without a role, sees no confidential Ticket but those of the
  // packages that they maintain; SNTL-27 has no maintainer and no access
  // grant (Embargoes).
  await signIn(page, "dbrown");

  await page.goto("/tickets/SNTL-27");

  await expect(heading(page, "Not found")).toBeVisible();
  await expect(
    page.getByText("This page doesn't exist, or you don't have access to it."),
  ).toBeVisible();

  await page.goto("/tickets/SNTL-0012");

  await expect(heading(page, "Not found")).toBeVisible();
});
