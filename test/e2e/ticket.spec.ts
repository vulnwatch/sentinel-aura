import type { Locator, Page } from "@playwright/test";
import {
  expect,
  expectAccessible,
  expectScreenshot,
  signIn,
  test,
  withFixedDates,
} from "./fixtures";

// The Ticket screen (docs/screens/ticket.md), against a backend loaded with
// Sentinel's example dataset, whose Tickets, CVEs, references, users, and
// roles the tests rely on as loaded (Sentinel
// docs/features/platform/example-dataset.md, Users; CVEs; Tickets; Aged
// Tickets; Embargoes; Priorities; References), except a test tagged
// @changes-data, which changes data of its own (docs/conventions.md,
// End-to-End Tests).

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
  return part(page, "Details").getByRole("term");
}

// The value of a field of a part, by its term: the definition of the same
// rank as the term, as each term has one.
async function valueOf(page: Page, name: string, term: string) {
  const terms = await part(page, name).getByRole("term").allTextContents();
  const index = terms.indexOf(term);
  expect(index, `the term ${term} of ${name}`).toBeGreaterThanOrEqual(0);
  return part(page, name).getByRole("definition").nth(index);
}

// The value of a field of the details, by its term.
function detail(page: Page, term: string) {
  return valueOf(page, "Details", term);
}

// The table of the CVSS assessments.
function cvssTable(page: Page) {
  return part(page, "CVSS assessments").getByRole("grid", {
    name: "CVSS assessments",
  });
}

// The sources of the CVE, the last section of the side column.
function sources(page: Page) {
  return part(page, "Sources of the CVE");
}

// Waits until the sources of the CVE, which the screen reads on their own,
// have arrived.
async function expectSources(page: Page) {
  await expect(sources(page).getByRole("listitem").first()).toBeVisible();
}

// Waits until every read of Overview has arrived and shows in its part: the
// duplicates of a Ticket that is not a duplicate, the CVSS assessments and
// the sources of a Ticket with a CVE, and the participants. Each moves what
// follows it as it arrives, and only then, at a URL with an anchor, does the
// page show the target of the anchor, once (docs/design-system.md, Main
// Content), which moves the parts again: so a test waits for it before it
// points at an element of the tab or takes a reference screenshot of it
// (docs/conventions.md, End-to-End Tests). The work of a maintainer, which
// marks tracks, is waited for by the test that relies on it.
async function expectOverviewShown(page: Page) {
  await expect(part(page, "Details")).toBeVisible();
  if ((await detailTerms(page).allTextContents()).includes("Duplicates")) {
    await expect(await detail(page, "Duplicates")).toHaveText(
      /^(?:None|SNTL-\d+)/,
    );
  }
  const cvss = part(page, "CVSS assessments");
  if ((await cvss.count()) > 0) {
    await expect(
      cvssTable(page).or(
        cvss.getByText("No CVSS assessments.", { exact: true }),
      ),
    ).toBeVisible();
    await expect(
      sources(page)
        .getByRole("listitem")
        .first()
        .or(sources(page).getByText("No sources.", { exact: true })),
    ).toBeVisible();
  }
  const participants = part(page, "Participants");
  await expect(
    participants
      .getByRole("toolbar", { name: "Participants" })
      .or(participants.getByText("No participants.", { exact: true })),
  ).toBeVisible();
  // The anchors of these tests lead below the top of the page.
  if (new URL(page.url()).hash !== "") {
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
  }
}

// A date and time as the screen shows it, such as 9 Oct 2026, 14:05.
const DATE_TIME = String.raw`\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}`;

// The line of a disabled source that Sentinel has not attempted, whose
// absent date reads "Not set".
function notAttempted(name: string): RegExp {
  return new RegExp(
    String.raw`^${name}\s*Not attempted\s*Disabled\s*Last attempt\s*–\s*Not set$`,
  );
}

// Whether the window scrolls its page in the horizontal direction.
function scrollsHorizontally(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

// Whether a value of a response body is a JSON object, whose members a test
// reads.
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The identifiers of a package of a Ticket and of a track of the package, by
// the package name and the reference of the track, from the package tree of
// Get Ticket, as the signed-in user of the page.
async function trackIdsOf(
  page: Page,
  ticketId: string,
  packageName: string,
  reference: string,
): Promise<{ packageId: string; trackId: string }> {
  const response = await page.request.get(`/api/v1/tickets/${ticketId}`);
  expect(response.ok()).toBe(true);
  const body: unknown = await response.json();
  const packages =
    isObject(body) && isObject(body.data) && Array.isArray(body.data.packages)
      ? body.data.packages.filter(isObject)
      : [];
  const found = packages.find((item) => item.package_name === packageName);
  const tracks = Array.isArray(found?.tracks)
    ? found.tracks.filter(isObject)
    : [];
  const track = tracks.find((item) => item.reference === reference);
  const packageId = found?.id;
  const trackId = track?.id;
  if (typeof packageId !== "string" || typeof trackId !== "string") {
    throw new Error(
      `Get Ticket returned no track ${reference} of ${packageName} on ${ticketId}`,
    );
  }
  return { packageId, trackId };
}

// The value of a field of the heading row, by its term: the definition of
// the same rank as the term, as the heading row comes first in the main
// content and each of its terms has one.
async function headingValue(page: Page, term: string) {
  const main = page.getByRole("main");
  const terms = await main.getByRole("term").allTextContents();
  const index = terms.indexOf(term);
  expect(index, `the term ${term} of the heading row`).toBeGreaterThanOrEqual(
    0,
  );
  return main.getByRole("definition").nth(index);
}

// A button of the part CVSS assessments, by its whole name, such as Add SUSE
// assessment, or Edit SUSE assessment v3.1 on the row of that assessment.
function cvssButton(page: Page, name: string) {
  return part(page, "CVSS assessments").getByRole("button", {
    name,
    exact: true,
  });
}

// The buttons of the part CVSS assessments that change the SUSE assessment:
// Add SUSE assessment, and Edit and Delete on the row of an assessment.
function suseButtons(locator: Locator) {
  return locator.getByRole("button", { name: /SUSE assessment/ });
}

// The row of an assessment, which its provider and its version name.
function assessmentRow(page: Page, provider: string, version: string) {
  return cvssTable(page).getByRole("row", {
    name: `${provider} v${version}`,
    exact: true,
  });
}

// The status regions of the part CVSS assessments that hold a text, such as
// the announcement of the outcome of a change.
function cvssStatus(page: Page, text: string) {
  return part(page, "CVSS assessments")
    .getByRole("status")
    .filter({ hasText: text });
}

// Add SUSE assessment, or Edit of a SUSE assessment, by its title.
function suseDialog(page: Page, name = "Add SUSE assessment") {
  return page.getByRole("dialog", { name, exact: true });
}

// The field of the vector of a dialog of the SUSE assessment.
function vectorField(dialog: Locator) {
  return dialog.getByRole("textbox", { name: "Vector", exact: true });
}

// The select of Start from, named by the option that it shows and its label,
// "Start from (optional)" in Add.
function startFrom(dialog: Locator) {
  return dialog.getByRole("button", { name: /Start from(?: \(optional\))?$/ });
}

// Chooses an option of Start from, once its open options are checked
// (docs/conventions.md, End-to-End Tests).
async function chooseStart(page: Page, dialog: Locator, option: string) {
  await startFrom(dialog).click();
  const options = page.getByRole("listbox", { name: "Start from" });
  await expect(options).toBeVisible();
  await expectAccessible(page);
  await options.getByRole("option", { name: option, exact: true }).click();
  await expect(startFrom(dialog)).toHaveText(option);
}

// A metric of a dialog of the SUSE assessment, a group of radio buttons
// named after the metric, and in v4.0 after its group too where its name
// repeats, such as "Confidentiality Vulnerable system".
function metric(dialog: Locator, name: string) {
  return dialog.getByRole("radiogroup", { name, exact: true });
}

// A value of a metric, a radio button of its group.
function metricValue(dialog: Locator, name: string, value: string) {
  return metric(dialog, name).getByRole("radio", { name: value, exact: true });
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
    const main = page.getByRole("main");
    await expect(main.getByRole("term").first()).toHaveText("CVE");
    expect(
      (await main.getByRole("term").allTextContents()).slice(0, 5),
    ).toEqual(["CVE", "Status", "Severity", "Priority", "Deadline"]);
    const values = (await main.getByRole("definition").allTextContents()).slice(
      0,
      5,
    );
    expect(values.slice(0, 4)).toEqual([
      "CVE-2099-0012",
      "Analyzed",
      "High",
      "P1",
    ]);
    expect(values[4]).toMatch(
      /^Submission -\d+dSubmission overdue by \d+ days$/,
    );
    await expect(
      page.getByRole("tablist", { name: "Ticket" }).getByRole("tab"),
    ).toHaveText(["Overview", "References", "Affected versions", "Audit log"]);
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
    await expect(await detail(page, "Assignee")).toHaveText("Alice Smith");
    await expect(await detail(page, "Submission")).toContainText(
      /Overdue by \d+ days$/,
    );
    await expect(await detail(page, "Duplicates")).toHaveText("None");

    // In a window of 1280 px, the details stand beside the CVE.
    const cveBox = await cve.boundingBox();
    const detailsBox = await part(page, "Details").boundingBox();
    expect(detailsBox?.x).toBeGreaterThan(
      (cveBox?.x ?? 0) + (cveBox?.width ?? 0),
    );
    // The CVSS assessments and the sources, which the screen reads on their
    // own, have arrived.
    await expect(cvssTable(page)).toBeVisible();
    await expectSources(page);
    await expectScreenshot(page, "ticket.png");
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
    await expect(
      page.getByRole("main").getByText("Confidential", { exact: true }),
    ).toBeVisible();
    // A running embargo (Embargoes), whose CVE has an EPSS score (CVEs).
    await expect(await detail(page, "Coordinated Release Date")).toHaveText(
      /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/,
    );
    await expect(await valueOf(page, "CVE-2099-0018", "CWE")).toHaveText(
      "CWE-287",
    );
    await expect(await valueOf(page, "CVE-2099-0018", "Score")).toHaveText(
      "0.31",
    );
    await expectOverviewShown(page);
    await expectScreenshot(page, "ticket-confidential.png");
  });

  test("shows the participants of a confidential Ticket, and its access grants with Grant access and Revoke access", async ({
    page,
  }) => {
    await signIn(page, "asmith");

    // SNTL-18, assigned to asmith, who created it, added its package, and
    // granted access to cwhite, then to the bot account security-scanner,
    // and revoked it; dbrown maintains fictional-openssh (Tickets; Packages,
    // Tracks, and Maintainers).
    await page.goto("/tickets/SNTL-18");

    const participants = part(page, "Participants");
    const group = participants.getByRole("toolbar", { name: "Participants" });
    await expect(group.getByRole("img")).toHaveCount(3);
    expect(
      await group
        .getByRole("img")
        .evaluateAll((images) =>
          images.map((image) => image.getAttribute("aria-label")),
        ),
    ).toEqual(["Alice Smith", "Carol White", "Dave Brown"]);
    await expectOverviewShown(page);
    await participants.scrollIntoViewIfNeeded();
    await expectScreenshot(page, "ticket-participants.png");

    await participants.getByRole("button", { name: "Access grants" }).click();

    const dialog = page.getByRole("dialog", { name: "Access grants" });
    const grants = dialog.getByRole("list", { name: "Access grants" });
    await expect(grants.getByRole("listitem")).toHaveCount(1);
    await expect(grants.getByRole("listitem")).toHaveText(
      new RegExp(
        String.raw`^Carol White @cwhite\s*Granted by Alice Smith on ${DATE_TIME}\s*Revoke access$`,
      ),
    );
    await expect(
      grants.getByRole("button", {
        name: "Revoke access of Carol White @cwhite",
      }),
    ).toBeVisible();
    const field = dialog.getByRole("combobox", { name: "User" });
    await expect(field).toBeFocused();
    await expectScreenshot(page, "ticket-access-grants.png");
    await expectAccessible(page);

    // Grant access without a user, which sends nothing.
    await dialog.getByRole("button", { name: "Grant access" }).click();
    await expect(dialog.getByText("Choose a user.")).toBeVisible();
    await expect(field).toBeFocused();
    await expectScreenshot(page, "ticket-access-grants-no-user.png");
    await expectAccessible(page);

    // The active users of the directory that match, a grantee as granted.
    await field.fill("white");
    const granted = page.getByRole("option", {
      name: "Carol White @cwhite Granted",
    });
    await expect(granted).toHaveAttribute("aria-disabled", "true");
    await expectScreenshot(page, "ticket-access-grants-users.png");
    await expectAccessible(page);

    // Close with a user chosen and not granted asks before discarding it,
    // and Keep editing keeps it. ghill, without a role, has no grant.
    await field.fill("hill");
    await page.getByRole("option", { name: "Grace Hill @ghill" }).click();
    await expect(field).toHaveValue("Grace Hill @ghill");
    await dialog.getByRole("button", { name: "Close" }).click();
    const discard = page.getByRole("dialog", { name: "Discard changes?" });
    await expect(
      discard.getByRole("button", { name: "Keep editing" }),
    ).toBeFocused();
    await expectScreenshot(page, "ticket-access-grants-discard.png");
    await expectAccessible(page);
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect(discard).toHaveCount(0);
    await expect(field).toHaveValue("Grace Hill @ghill");

    // The confirmation of Revoke access, which Cancel leaves without a
    // change. The field closes its menu as the focus leaves it.
    await field.press("Tab");
    await expect(granted).toHaveCount(0);
    await grants
      .getByRole("button", { name: "Revoke access of Carol White @cwhite" })
      .click();
    const confirmation = page.getByRole("dialog", {
      name: "Revoke access of Carol White?",
    });
    await expect(
      confirmation.getByRole("button", { name: "Cancel" }),
    ).toBeFocused();
    await expectScreenshot(page, "ticket-access-grants-revoke.png");
    await expectAccessible(page);
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(grants.getByRole("listitem")).toHaveCount(1);
  });

  test("shows a Ticket without a CVE and its duplicate, each linked to the other", async ({
    page,
  }) => {
    await signIn(page, "asmith");

    await page.goto("/tickets/SNTL-21");

    await expect(heading(page, "SNTL-21")).toBeVisible();
    await expect(part(page, "CVE").getByText("No CVE.")).toBeVisible();
    // Without a CVE, the Ticket has no CVSS assessments.
    await expect(part(page, "CVSS assessments")).toHaveCount(0);
    // SNTL-32, a duplicate of SNTL-22, was repointed to SNTL-21 when SNTL-22
    // became its duplicate (Tickets).
    const duplicates = (await detail(page, "Duplicates")).getByRole("link");
    await expect(duplicates).toHaveText(["SNTL-22", "SNTL-32"]);
    const duplicate = duplicates.filter({ hasText: "SNTL-22" });
    await expectOverviewShown(page);
    await expectScreenshot(page, "ticket-without-cve.png");

    await duplicate.click();

    await expect(heading(page, "SNTL-22")).toBeFocused();
    await expect(page).toHaveURL("/tickets/SNTL-22");
    // A duplicate has no due dates (Sentinel
    // docs/features/tickets/ticket-deadlines.md, Null Due Dates).
    await expect(await detail(page, "Deadlines")).toHaveText("–Not set");
    // Without a severity or a priority (Tickets; Priorities).
    await expect(page.getByText("Severity not set")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Not yet prioritizable" }),
    ).toBeVisible();
    await expectAccessible(page);
    await (
      await detail(page, "Original")
    )
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
    await expect(
      await valueOf(page, "CVE-2099-0010", "Exploitation"),
    ).toHaveText("PoC");
    await expect(await valueOf(page, "CVE-2099-0010", "Percentile")).toHaveText(
      "0.96",
    );
    await expectAccessible(page);

    await page.goto("/tickets/SNTL-8");

    // A CVE rejected at the load of the dataset, less two days (CVEs).
    await expect(part(page, "CVE-2099-0008 Rejected")).toBeVisible();
    await expect(
      await valueOf(page, "CVE-2099-0008 Rejected", "Rejected"),
    ).toHaveText(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/);
  });

  test("shows the CNA of a CVE, whose name opens its details", async ({
    page,
  }) => {
    await signIn(page, "asmith");

    // The CVE of SNTL-6 belongs to fictional-plugins, under the auto-ignore
    // policy, with two types and a scope of two lines (CNAs).
    await page.goto("/tickets/SNTL-6");

    const cve = part(page, "CVE-2099-0006");
    const name = cve.getByRole("button", {
      name: "Fictional Plugin Foundation",
      exact: true,
    });
    const popover = page.getByRole("dialog", {
      name: "Fictional Plugin Foundation",
    });
    // The popover takes its place below the name as it opens, so the
    // reference opens it while the dates before the name have their fixed
    // widths, once the other reads of the screen have arrived.
    await expectSources(page);
    await expect(
      part(page, "CVSS assessments").getByText("No CVSS assessments."),
    ).toBeVisible();
    await expect(await detail(page, "Duplicates")).toHaveText("None");
    await withFixedDates(page, async () => {
      await name.click();
      await expect(
        popover.getByText("fictional-plugins", { exact: true }),
      ).toBeVisible();
      await expectScreenshot(page, "ticket-cna.png");
    });
    await page.keyboard.press("Escape");
    await expect(name).toBeFocused();

    await name.click();
    await expect(popover).toBeFocused();
    await expect(
      popover.getByText("fictional-plugins", { exact: true }),
    ).toBeVisible();
    await expect(popover.getByRole("term")).toHaveText([
      "Types",
      "Auto-ignore",
      "Scope",
    ]);
    await expect(popover.getByRole("listitem")).toHaveText([
      "Open Source",
      "Researcher",
    ]);
    const values = popover.getByRole("definition");
    await expect(values.nth(1)).toHaveText(
      "Yes, new Tickets are ignored automatically",
    );
    // The scope keeps its two lines, and its address stays text.
    expect(await values.nth(2).innerText()).toBe(
      "Plugins of the fictional plugin directory.\nPlugin list: https://plugins.example.com",
    );
    await expect(popover.getByRole("link")).toHaveCount(0);
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(name).toBeFocused();

    // The CVE of SNTL-10 belongs to Example Corporation, which is not under
    // the policy.
    await page.goto("/tickets/SNTL-10");
    await part(page, "CVE-2099-0010")
      .getByRole("button", { name: "Example Corporation", exact: true })
      .click();
    const example = page.getByRole("dialog", { name: "Example Corporation" });
    await expect(example.getByRole("definition").nth(1)).toHaveText("No");
    await expectAccessible(page);

    // The CVE of SNTL-13 belongs to a CNA without a name.
    await page.goto("/tickets/SNTL-13");
    await expect(part(page, "CVE-2099-0013")).toBeVisible();
    await expect(await valueOf(page, "CVE-2099-0013", "CNA")).toHaveText(
      "Unnamed CNA",
    );
    await expect(
      part(page, "CVE-2099-0013").getByRole("button", { name: /CNA/ }),
    ).toHaveCount(0);
    await expectAccessible(page);

    // The CVE of SNTL-12 has no CNA.
    await page.goto("/tickets/SNTL-12");
    await expect(part(page, "CVE-2099-0012")).toBeVisible();
    await expect(await valueOf(page, "CVE-2099-0012", "CNA")).toHaveText(
      "–Not set",
    );
  });

  test("reflows at 320 CSS pixels, in one column, the details first", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-12");
    await expect(heading(page, "SNTL-12")).toBeVisible();
    await expect(cvssTable(page)).toBeVisible();

    const detailsBox = await part(page, "Details").boundingBox();
    const cveBox = await part(page, "CVE-2099-0012").boundingBox();
    expect((detailsBox?.y ?? 0) + (detailsBox?.height ?? 0)).toBeLessThan(
      cveBox?.y ?? 0,
    );
    expect(await scrollsHorizontally(page)).toBe(false);
  });

  test("shows the package tree of a Ticket, its maintainers, phases, and Products", async ({
    page,
  }) => {
    await signIn(page, "asmith");

    await page.goto("/tickets/SNTL-12#packages");

    // SNTL-12 has two packages with different maintainers, and a package with
    // two maintainers (Packages, Tracks, and Maintainers).
    const packages = part(page, "Packages");
    await expect(packages.getByRole("heading", { level: 3 })).toHaveText([
      "fictional-openssl",
      "fictional-zlib",
    ]);
    await expect(
      packages.getByRole("button", {
        name: "2 maintainers of fictional-openssl",
      }),
    ).toBeVisible();
    await expect(
      packages.getByRole("button", { name: "1 maintainer of fictional-zlib" }),
    ).toBeVisible();
    // Its IBS track, Affected, its submission past due (Aged Tickets).
    const openssl = packages
      .getByRole("listitem")
      .filter({
        has: page.getByText("SUSE:FLES-15-SP7:Update", { exact: true }),
      })
      .last();
    await expect(openssl.getByText("Affected", { exact: true })).toBeVisible();
    // Its pipeline, whose Phases ends with its delivery, Pending.
    const pipeline = openssl.getByRole("button", {
      name: /^Phases of fictional-openssl, SUSE:FLES-15-SP7:Update: Triage done; Submission overdue by \d+ days?, current; UM (?:due|overdue) .+; QA due in \d+ days?; delivery pending$/,
    });
    await expect(pipeline).toBeVisible();
    await expect(openssl.getByText("Delivery")).toHaveCount(0);
    await expect(
      openssl.getByText("Fictional Linux Enterprise Server 15 SP7"),
    ).toBeVisible();
    // An Affected track: its Products show their release in their details
    // only.
    await expect(openssl.getByText(/release/i)).toHaveCount(0);
    // Its Git track, whose later phases Sentinel does not observe, shows its
    // pipeline without Delivery Pending.
    const zlib = packages
      .getByRole("listitem")
      .filter({ has: page.getByText("fles-16.0", { exact: true }) })
      .last();
    await expect(
      zlib.getByRole("button", {
        name: /^Phases of fictional-zlib, fles-16\.0: Triage done; Submission not observed; UM not observed; QA not observed$/,
      }),
    ).toBeVisible();
    await expect(zlib.getByText("Delivery")).toHaveCount(0);
    await expect(zlib.getByText(/release/i)).toHaveCount(0);
    // No track shows a deadline badge, which the pipeline replaces.
    await expect(
      packages.getByText(/^(?:Triage|Submission|UM|QA|Release) -?\d+d$/),
    ).toHaveCount(0);
    // No hidden record.
    await expect(
      page.getByRole("switch", { name: "Show hidden 0" }),
    ).toBeDisabled();
    // Once every read of the tab has arrived, the page shows the target of
    // its anchor, which moves the pipeline: the click waits for it, so that
    // Phases does not open where the pipeline was (docs/conventions.md,
    // End-to-End Tests).
    await expectOverviewShown(page);
    // Phases reads the requests of the track as it opens.
    const requests = Promise.all(
      ["submission-requests", "release-requests"].map((list) =>
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname ===
            `/api/v1/tickets/SNTL-12/${list}`,
        ),
      ),
    );

    await pipeline.click();

    const phases = page.getByRole("dialog", { name: "Phases" });
    await expect(phases).toBeFocused();
    await expect(phases).toContainText("Submission · Maintainer");
    await expect(phases).toContainText(/DeliveryPending$/);
    // The track has no IBS request (IBS Requests), so no phase shows one.
    for (const response of await requests) {
      expect(response.ok()).toBe(true);
    }
    await expect(phases.getByRole("link")).toHaveCount(0);
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(pipeline).toBeFocused();

    await packages
      .getByRole("button", { name: "2 maintainers of fictional-openssl" })
      .click();

    const maintainers = page.getByRole("dialog", {
      name: "Maintainers of fictional-openssl",
    });
    await expect(maintainers.getByRole("listitem")).toHaveText([
      "Dave Brown @dbrown",
      "Grace Hill @ghill",
    ]);
    await expectAccessible(page);
    await page.keyboard.press("Escape");

    await packages
      .getByRole("button", { name: "Fictional Linux Enterprise Micro 6.2" })
      .click();

    const product = page.getByRole("dialog", {
      name: "Fictional Linux Enterprise Micro 6.2",
    });
    await expect(product).toBeFocused();
    await expect(
      product.getByText("cpe:/o:example:fles-micro:6.2"),
    ).toBeVisible();
    // Micro 6.2 has no lifecycle data (Product Catalog).
    // Its eligibility is automatic: neither user-pen nor who set it.
    await expect(product.getByRole("definition")).toHaveText([
      "Eligible",
      "Not available",
      "Not observed",
    ]);
    await expectAccessible(page);
  });

  test("shows the Product that keeps a Ticket from Resolved, and a delivery in Phases", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-26#packages");

    // SNTL-26 is Analyzed and not Resolved: the Server 16.0 of its Fixed Git
    // track fictional-libidn is not released, which Sentinel does not observe
    // (Tickets). Its IBS track fictional-glibc is Affected, its delivery In
    // progress (IBS Requests).
    const packages = part(page, "Packages");
    const libidn = packages
      .getByRole("listitem")
      .filter({ has: page.getByText("fles-16.0", { exact: true }) })
      .last();
    await expect(libidn.getByText("Fixed", { exact: true })).toBeVisible();
    await expect(
      libidn.getByText("Release not observed", { exact: true }),
    ).toBeVisible();
    const glibc = packages
      .getByRole("listitem")
      .filter({
        has: page.getByText("SUSE:FLES-15-SP7:Update", { exact: true }),
      })
      .last();
    await expect(glibc.getByText(/release/i)).toHaveCount(0);
    const pipeline = glibc.getByRole("button", {
      name: /^Phases of fictional-glibc, SUSE:FLES-15-SP7:Update: .*; delivery in progress$/,
    });
    await expect(pipeline).toBeVisible();
    // Once every read of the tab has arrived, the page shows the target of
    // its anchor, which moves the pipeline: the screenshot and the click
    // wait for it.
    await expectOverviewShown(page);
    await expectScreenshot(page, "ticket-unreleased-product.png");
    await expectAccessible(page);

    await pipeline.click();

    // Its accepted submission request 900006 and the release request 900007
    // in review (IBS Requests), at the ends of the lines of Submission and
    // QA.
    const phases = page.getByRole("dialog", { name: "Phases" });
    await expect(phases).toBeFocused();
    const submission = phases
      .getByRole("listitem")
      .filter({ hasText: "Submission · Maintainer" })
      .getByRole("link");
    const qa = phases
      .getByRole("listitem")
      .filter({ hasText: "QA · QA" })
      .getByRole("link");
    await expect(submission).toHaveAttribute(
      "href",
      "https://build.suse.de/request/show/900006",
    );
    await expect(qa).toHaveAttribute(
      "href",
      "https://build.suse.de/request/show/900007",
    );
    await expect(phases.getByRole("button", { name: /more/ })).toHaveCount(0);
    await expect(submission).toHaveAccessibleName(
      "SR 900006, Accepted (another site)",
    );
    await expect(qa).toHaveAccessibleName("RR 900007, Review (another site)");
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(pipeline).toBeFocused();

    await packages
      .getByRole("button", { name: "Fictional Linux Enterprise Server 16.0" })
      .click();

    const product = page.getByRole("dialog", {
      name: "Fictional Linux Enterprise Server 16.0",
    });
    await expect(product).toBeFocused();
    await expect(product.getByRole("definition").last()).toHaveText(
      "Not observed",
    );
  });

  test("shows the IBS requests of a track in Phases, the state of each in the tooltip of its link", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-13#packages");

    // The IBS track of fictional-httpd of SNTL-13 is Affected, its delivery
    // In progress, with the submission request 900001 in review, created
    // after 900000, which IBS declined, and no release request (Aged
    // Tickets; IBS Requests).
    const packages = part(page, "Packages");
    const httpd = packages
      .getByRole("listitem")
      .filter({
        has: page.getByText("SUSE:FLES-15-SP7:Update", { exact: true }),
      })
      .last();
    const pipeline = httpd.getByRole("button", {
      name: /^Phases of fictional-httpd, SUSE:FLES-15-SP7:Update: .*; delivery in progress$/,
    });
    await expect(pipeline).toBeVisible();
    // Once every read of the tab has arrived, the page shows the target of
    // its anchor, which moves the pipeline: the click waits for it.
    await expectOverviewShown(page);
    // Phases reads the requests of the track as it opens.
    const requests = Promise.all(
      ["submission-requests", "release-requests"].map((list) =>
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname ===
            `/api/v1/tickets/SNTL-13/${list}`,
        ),
      ),
    );

    await pipeline.click();

    const phases = page.getByRole("dialog", { name: "Phases" });
    await expect(phases).toBeFocused();
    const submission = phases
      .getByRole("listitem")
      .filter({ hasText: "Submission · Maintainer" });
    const request = submission.getByRole("link", { name: /^SR 900001\b/ });
    await expect(request).toHaveAttribute(
      "href",
      "https://build.suse.de/request/show/900001",
    );
    await expect(
      submission.getByRole("button", {
        name: "1 more submission request: SR 900000, Declined",
        exact: true,
      }),
    ).toHaveText("+1");
    // Neither a release request at QA nor another request, once both reads
    // have answered.
    for (const response of await requests) {
      expect(response.ok()).toBe(true);
    }
    await expect(
      phases
        .getByRole("listitem")
        .filter({ hasText: "QA · QA" })
        .getByRole("link"),
    ).toHaveCount(0);
    await expect(phases.getByRole("link")).toHaveCount(1);
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-phases.png");

    await page.keyboard.press("Tab");

    await expect(request).toBeFocused();
    await expect(page.getByRole("tooltip")).toHaveText("Review");
    await expectAccessible(page);
    await expect(request).toHaveAccessibleName(
      "SR 900001, Review (another site)",
    );

    // Escape first hides the tooltip, then closes Phases
    // (docs/design-system.md, Track Milestones).
    await page.keyboard.press("Escape");

    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(phases).toBeVisible();
    await expect(request).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(phases).toHaveCount(0);
    await expect(pipeline).toBeFocused();
  });

  test(
    "opens the IBS requests of a track without a pipeline from the delivery on its line",
    { tag: "@changes-data" },
    async ({ page }) => {
      // The IBS track of fictional-httpd of SNTL-13, Affected, its delivery
      // In progress (Packages, Tracks, and Maintainers; IBS Requests),
      // becomes Not affected: without work, it shows no pipeline, while its
      // delivery, which the affectedness does not reset, stays relevant and
      // shows on its line (Sentinel docs/features/packages/package-model.md,
      // Affectedness-Delivery Independence; Delivery Relevance Indicator).
      // No other test of this project relies on SNTL-13: every other test
      // that does, in this module or in ticket-list.spec.ts, is read-only, in
      // the project that runs first.
      await signIn(page, "asmith");
      const { packageId, trackId } = await trackIdsOf(
        page,
        "SNTL-13",
        "fictional-httpd",
        "SUSE:FLES-15-SP7:Update",
      );
      // Change Track Status, sent as the UI sends a change: by the page, from
      // the UI's origin, with the session cookie, which the cross-origin
      // request protection accepts (Sentinel
      // docs/features/identity/authentication.md, Cross-Origin Request
      // Protection).
      const status = await page.evaluate(async (path) => {
        const response = await fetch(path, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "not_affected" }),
        });
        return response.status;
      }, `/api/v1/tickets/SNTL-13/packages/${packageId}/tracks/${trackId}`);
      expect(status).toBe(200);

      await page.goto("/tickets/SNTL-13#packages");

      const httpd = part(page, "Packages")
        .getByRole("listitem")
        .filter({
          has: page.getByText("SUSE:FLES-15-SP7:Update", { exact: true }),
        })
        .last();
      const delivery = httpd.getByRole("button", {
        name: "Delivery of fictional-httpd, SUSE:FLES-15-SP7:Update: In progress",
        exact: true,
      });
      await expect(delivery).toHaveText("In progress");
      await expect(httpd.getByText("Delivery", { exact: true })).toBeVisible();
      await expect(
        httpd.getByText("Not affected", { exact: true }),
      ).toBeVisible();
      await expect(
        httpd.getByRole("button", { name: /^Phases of/ }),
      ).toHaveCount(0);
      // Once every read of the tab has arrived, the page shows the target of
      // its anchor, which moves the delivery: the click waits for it.
      await expectOverviewShown(page);
      // The popover reads the requests of the track as it opens.
      const requests = Promise.all(
        ["submission-requests", "release-requests"].map((list) =>
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
              `/api/v1/tickets/SNTL-13/${list}`,
          ),
        ),
      );

      await delivery.click();

      // The submission request 900001 in review, created after 900000, which
      // IBS declined, and no release request (IBS Requests).
      const popover = page.getByRole("dialog", { name: "Delivery" });
      await expect(popover).toBeFocused();
      await expect(popover.getByRole("term")).toHaveText(["Submission", "QA"]);
      const submission = popover.getByRole("definition").first();
      const request = submission.getByRole("link");
      await expect(request).toHaveAccessibleName(
        "SR 900001, Review (another site)",
      );
      await expect(request).toHaveAttribute(
        "href",
        "https://build.suse.de/request/show/900001",
      );
      await expect(
        submission.getByRole("button", {
          name: "1 more submission request: SR 900000, Declined",
          exact: true,
        }),
      ).toHaveText("+1");
      for (const response of await requests) {
        expect(response.ok()).toBe(true);
      }
      await expect(popover.getByRole("definition").last()).toHaveText("None");
      await expectAccessible(page);
      await expectScreenshot(page, "ticket-delivery.png");

      // Tab reaches the request, whose tooltip states its state; Escape
      // first hides the tooltip, then closes the popover
      // (docs/design-system.md, Menus, Popovers, and Tooltips).
      await page.keyboard.press("Tab");

      await expect(request).toBeFocused();
      await expect(page.getByRole("tooltip")).toHaveText("Review");

      await page.keyboard.press("Escape");

      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await expect(popover).toBeVisible();
      await expect(request).toBeFocused();

      await page.keyboard.press("Escape");

      await expect(popover).toHaveCount(0);
      await expect(delivery).toBeFocused();
    },
  );

  test("shows the hidden records of a Ticket in gray, with their label", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-16#packages");

    // The package tree of SNTL-16 holds a direct exclusion at each level and
    // every reason for a record not to be actionable: of its three packages,
    // only fictional-kernel and its SUSE:FLES-15-SP5:Update track show, whose
    // Server 15 SP7 is excluded (Packages, Tracks, and Maintainers).
    const packages = part(page, "Packages");
    await expect(packages.getByRole("heading", { level: 3 })).toHaveText([
      "fictional-kernel",
    ]);
    await expect(packages.getByText("SUSE:FLES-15-SP5:Update")).toBeVisible();
    await expect(packages.getByText("SUSE:FLES-15-SP3:Update")).toHaveCount(0);
    await expect(packages.getByText("SUSE:FLES-15-SP4:Update")).toHaveCount(0);
    // The SP5 track is Affected without a Product that is both actionable and
    // eligible, so it has no work: no pipeline and no Delivery Pending.
    await expect(
      packages.getByText("Not eligible", { exact: true }),
    ).toBeVisible();
    await expect(packages.getByText("Delivery")).toHaveCount(0);
    await expect(
      packages.getByRole("button", { name: /^Phases of/ }),
    ).toHaveCount(0);

    // Once every read of the tab has arrived, the page shows the target of
    // its anchor, which moves Show hidden: the click waits for it, and Show
    // hidden keeps the scroll position for the screenshot.
    await expectOverviewShown(page);

    // Five hidden records whose parent shows: Server 15 SP7, the SP3 and the
    // excluded SP4 tracks of fictional-kernel, the excluded
    // fictional-kernel-firmware, and fictional-kernel-compat, whose only
    // track holds only the EOL Server 15 SP3.
    await packages.getByText("Show hidden 5").click();

    await expect(
      page.getByRole("switch", { name: "Show hidden 5" }),
    ).toBeChecked();
    await expect(page).toHaveURL("/tickets/SNTL-16?hidden=shown#packages");
    await expect(packages.getByRole("heading", { level: 3 })).toHaveText([
      "fictional-kernel",
      "fictional-kernel-compat",
      "fictional-kernel-firmware",
    ]);
    // The label Excluded on each record that its own marker excludes, and
    // EOL on each Server 15 SP3, also under a hidden parent.
    await expect(packages.getByText("Excluded", { exact: true })).toHaveCount(
      3,
    );
    await expect(packages.getByText("EOL", { exact: true })).toHaveCount(2);
    const sp5 = packages
      .getByRole("listitem")
      .filter({
        has: page.getByText("SUSE:FLES-15-SP5:Update", { exact: true }),
      })
      .last();
    await expect(
      sp5
        .getByRole("listitem")
        .filter({
          has: page.getByRole("button", {
            name: "Fictional Linux Enterprise Server 15 SP7",
          }),
        })
        .getByText("Excluded", { exact: true }),
    ).toBeVisible();
    await expectScreenshot(page, "ticket-hidden-records.png");

    await page.reload();

    await expect(
      page.getByRole("switch", { name: "Show hidden 5" }),
    ).toBeChecked();
    await expect(packages.getByText("SUSE:FLES-15-SP3:Update")).toHaveCount(2);
    await expect(packages.getByText("SUSE:FLES-15-SP4:Update")).toBeVisible();
  });

  test("shows who set the eligibility of a Product by hand, and when", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-16#packages");

    // asmith set the eligibility of Server LTSS 15 SP5 of SNTL-16 by hand,
    // to not eligible (Packages, Tracks, and Maintainers).
    const ltss = part(page, "Packages").getByRole("button", {
      name: "Fictional Linux Enterprise Server LTSS 15 SP5",
    });
    // Once every read of the tab has arrived, the page shows the target of
    // its anchor, which moves the Product: the click waits for it, so that
    // its details do not open where the Product was (docs/conventions.md,
    // End-to-End Tests).
    await expectOverviewShown(page);

    await ltss.click();

    const product = page.getByRole("dialog", {
      name: "Fictional Linux Enterprise Server LTSS 15 SP5",
    });
    await expect(product).toBeFocused();
    await expect(product.getByRole("definition")).toHaveText([
      new RegExp(
        String.raw`^Not eligible, set by handSet by Alice Smith on ${DATE_TIME}$`,
      ),
      "Extended support",
    ]);
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-product-set-by-hand.png");
    await page.keyboard.press("Escape");
    await expect(ltss).toBeFocused();
  });

  test("shows the CVSS assessments of a CVE, whose SUSE assessment sets its severity and the eligibility score, with Add SUSE assessment and Edit and Delete on the row of the SUSE assessment", async ({
    page,
  }) => {
    await signIn(page, "asmith");

    await page.goto("/tickets/SNTL-16#cvss");
    await expect(cvssTable(page)).toBeVisible();

    // The SUSE assessment of CVE-2099-0016, v3.1 as the default version,
    // scores it lower than NVD's (CVEs; System Settings).
    await expect(
      await valueOf(page, "CVSS assessments", "Severity"),
    ).toHaveText(
      "Medium (5.5) from SUSE CVSS v3.1, which also sets the eligibility score of the Products",
    );
    await expect(part(page, "CVSS assessments").getByRole("term")).toHaveCount(
      1,
    );
    await expect(cvssTable(page).getByRole("columnheader")).toHaveText([
      "Provider",
      "Version",
      "Base score",
      "Vector",
      "Actions",
    ]);
    await expect(cvssTable(page).getByRole("rowheader")).toHaveText([
      "NVD",
      "v3.1",
      "SUSE",
      "v3.1",
    ]);
    await expect(cvssTable(page).getByRole("gridcell")).toHaveText([
      "7.8 High",
      "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
      "",
      "5.5 Medium",
      "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
      "",
    ]);
    // asmith holds manage_cvss through the vulnerability_analyst role, and
    // SNTL-16 is Resolved, a status in which Sentinel changes the SUSE
    // assessment of its CVE (Users; Tickets): Add SUSE assessment, for
    // v4.0, which SUSE lacks, and Edit and Delete on the row of the SUSE
    // assessment alone.
    await expect(cvssButton(page, "Add SUSE assessment")).toBeVisible();
    const suse = assessmentRow(page, "SUSE", "3.1");
    await expect(
      suse.getByRole("button", {
        name: "Edit SUSE assessment v3.1",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      suse.getByRole("button", {
        name: "Delete SUSE assessment v3.1",
        exact: true,
      }),
    ).toBeVisible();
    await expect(suseButtons(assessmentRow(page, "NVD", "3.1"))).toHaveCount(0);
    await expectOverviewShown(page);
    await expect(
      part(page, "CVSS assessments").getByRole("heading", { level: 2 }),
    ).toBeInViewport();
    await expectScreenshot(page, "ticket-cvss.png");
  });

  test("opens the metrics of the vector of a CVSS assessment, with a link to the calculator of FIRST", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    // The package tree of SNTL-16 with its hidden records is long enough for
    // the page to scroll the assessments to the top of the window, so that
    // the popover opens below the vector, and the dates of the CVE, whose
    // masks would show over the compact heading, above the window.
    await page.goto("/tickets/SNTL-16?hidden=shown#cvss");
    // Every read for which the anchor waits, so that the page no longer
    // scrolls by itself.
    await expectOverviewShown(page);
    const anchored = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollBy(0, 100));
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBe(anchored + 100);
    // NVD's v3.1 assessment of CVE-2099-0016 (CVEs).
    const vector = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H";
    const opener = cvssTable(page).getByRole("button", {
      name: vector,
      exact: true,
    });

    await opener.click();

    const metrics = page.getByRole("dialog", { name: "NVD CVSS v3.1" });
    await expect(metrics).toBeFocused();
    await expect(metrics.getByRole("term")).toHaveText([
      "Exploitability",
      "Attack vector",
      "Attack complexity",
      "Privileges required",
      "User interaction",
      "Scope",
      "Impact",
      "Confidentiality",
      "Integrity",
      "Availability",
    ]);
    await expect(metrics.getByRole("definition").last()).toHaveText("High");
    await expect(metrics.getByText("Local", { exact: true })).toBeVisible();
    await expect(
      metrics.getByRole("link", {
        name: "Open in the FIRST calculator (another site)",
      }),
    ).toHaveAttribute(
      "href",
      `https://www.first.org/cvss/calculator/3.1#${vector}`,
    );
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-cvss-vector.png");

    await page.keyboard.press("Escape");

    await expect(metrics).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test("shows the CVSS assessments of a CVE without a SUSE assessment, and of a CVE without any", async ({
    page,
  }) => {
    await signIn(page, "asmith");

    await page.goto("/tickets/SNTL-7#cvss");
    await expect(cvssTable(page)).toBeVisible();

    // NVD's v4.0 assessment of CVE-2099-0007 sets its severity, and without a
    // SUSE assessment of the default version v3.1, the eligibility score is
    // the fallback (CVEs; System Settings).
    await expect(
      await valueOf(page, "CVSS assessments", "Severity"),
    ).toHaveText("Critical (9.3) from NVD CVSS v4.0");
    await expect(
      await valueOf(page, "CVSS assessments", "Eligibility score"),
    ).toHaveText("10.0, the fallback without a SUSE CVSS v3.1 assessment");
    await expect(cvssTable(page).getByRole("rowheader")).toHaveText([
      "NVD",
      "v4.0",
    ]);
    await expectOverviewShown(page);
    await expect(
      part(page, "CVSS assessments").getByRole("heading", { level: 2 }),
    ).toBeInViewport();
    await expectScreenshot(page, "ticket-cvss-without-suse.png");
    await expectAccessible(page);

    await page.goto("/tickets/SNTL-6#cvss");

    // No source supplies CVSS data for CVE-2099-0006 (CVEs).
    await expect(
      part(page, "CVSS assessments").getByText("No CVSS assessments."),
    ).toBeVisible();
    await expect(part(page, "CVSS assessments").getByRole("grid")).toHaveCount(
      0,
    );
    await expectOverviewShown(page);
    await expectScreenshot(page, "ticket-cvss-empty.png");
  });

  test("opens Edit of the SUSE assessment on its vector as saved, with the values of NVD where they differ, and asks before discarding a change", async ({
    page,
  }) => {
    // SUSE's v3.1 assessment of CVE-2099-0016, the CVE of SNTL-16, scores
    // its integrity and its availability None, and NVD's High (CVEs).
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-16#cvss");
    // Once every read of the tab has arrived, the page shows the target of
    // its anchor, which moves Edit: the click waits for it.
    await expectOverviewShown(page);
    const edit = cvssButton(page, "Edit SUSE assessment v3.1");

    await edit.click();

    // Without the tabs of the versions, its first field, Start from, has
    // the focus, on the assessment as saved.
    const dialog = suseDialog(page, "Edit SUSE assessment v3.1");
    await expect(startFrom(dialog)).toBeFocused();
    await expect(startFrom(dialog)).toHaveText("SUSE, as saved, 5.5 Medium");
    await expect(dialog.getByRole("tab")).toHaveCount(0);
    const vector = vectorField(dialog);
    await expect(vector).toHaveValue(
      "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
    );
    await expect(metricValue(dialog, "Integrity", "None")).toBeChecked();
    await expect(dialog.getByText(/^NVD: /)).toHaveText([
      "NVD: High",
      "NVD: High",
    ]);

    await metricValue(dialog, "Integrity", "Low").click();

    // The choice writes the vector, and the value of NVD stays below the
    // metric, which assistive technologies read with it.
    await expect(metricValue(dialog, "Integrity", "Low")).toBeChecked();
    await expect(vector).toHaveValue(
      "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N",
    );
    await expect(metric(dialog, "Integrity")).toHaveAccessibleDescription(
      "NVD: High",
    );
    // Start from no longer shows the assessment as saved, whose vector the
    // form no longer holds.
    await expect(startFrom(dialog)).toHaveText("");
    // Beside Start from, the score of the new vector, as Sentinel calculates
    // it once the vector has paused.
    await expect(
      dialog.getByText("Base score 6.1, Medium", { exact: true }),
    ).toBeAttached();
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-cvss-edit.png");

    await dialog.getByRole("button", { name: "Cancel" }).click();

    const discard = page.getByRole("dialog", { name: "Discard changes?" });
    await expect(discard).toContainText(
      "Your changes to this SUSE assessment aren't saved.",
    );
    await expect(
      discard.getByRole("button", { name: "Keep editing" }),
    ).toBeFocused();
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-cvss-discard.png");
    await discard.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(edit).toBeFocused();
  });

  test("asks before Back discards a change of the SUSE assessment, also to a state of the same screen, keeping the dialog, the vector, the URL, and the page where they are on Keep editing", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-16#cvss");
    await expectOverviewShown(page);
    // Show hidden adds an entry to the browser history and keeps the page
    // where it is, so that Back returns to the screen without the hidden
    // records.
    await part(page, "Packages").getByText("Show hidden 5").click();
    await expect(page).toHaveURL("/tickets/SNTL-16?hidden=shown#cvss");
    const edit = cvssButton(page, "Edit SUSE assessment v3.1");
    await edit.click();
    const dialog = suseDialog(page, "Edit SUSE assessment v3.1");
    await metricValue(dialog, "Integrity", "Low").click();
    const vector = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N";
    await expect(vectorField(dialog)).toHaveValue(vector);
    await expectAccessible(page);
    const scrolled = await page.evaluate(() => window.scrollY);
    expect(scrolled).toBeGreaterThan(0);

    await page.evaluate(() => {
      history.back();
    });

    const discard = page.getByRole("dialog", { name: "Discard changes?" });
    await expect(discard).toContainText(
      "Your changes to this SUSE assessment aren't saved.",
    );
    await expect(
      discard.getByRole("button", { name: "Keep editing" }),
    ).toBeFocused();
    await expectAccessible(page);
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect(discard).toHaveCount(0);
    await expect(page).toHaveURL("/tickets/SNTL-16?hidden=shown#cvss");
    await expect(vectorField(dialog)).toHaveValue(vector);
    await expect(
      page.getByRole("switch", { name: "Show hidden 5" }),
    ).toBeChecked();
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);

    await page.evaluate(() => {
      history.back();
    });
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL("/tickets/SNTL-16#cvss");
    await expect(
      page.getByRole("switch", { name: "Show hidden 5" }),
    ).not.toBeChecked();
    await expect(cvssTable(page)).toContainText(
      "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
    );
  });

  test("opens Add SUSE assessment on the default version, and starts another version from the assessment of another provider", async ({
    page,
  }) => {
    // CVE-2099-0007, the CVE of SNTL-7, which is New, has NVD's v4.0
    // assessment alone, and the default CVSS version is v3.1 (Tickets;
    // CVEs; System Settings).
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-7#cvss");
    await expectOverviewShown(page);
    const add = cvssButton(page, "Add SUSE assessment");

    await add.click();

    // On the tab of the default version, which SUSE lacks; no other
    // provider has a v3.1 assessment to start from, so the first field of
    // the form, which has the focus, is the first metric.
    const dialog = suseDialog(page);
    const v31 = dialog.getByRole("tab", {
      name: "CVSS v3.1, the default version",
      exact: true,
    });
    await expect(v31).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("radiogroup")).toHaveCount(8);
    await expect(startFrom(dialog)).toHaveCount(0);
    await expect(
      metricValue(dialog, "Attack vector", "Physical"),
    ).toBeFocused();
    await expect(vectorField(dialog)).toHaveValue("");
    await expectAccessible(page);

    await dialog.getByRole("tab", { name: "CVSS v4.0", exact: true }).click();

    await expect(dialog.getByRole("radiogroup")).toHaveCount(11);
    await chooseStart(page, dialog, "NVD, 9.3 Critical");
    const vector = vectorField(dialog);
    await expect(vector).toHaveValue(
      "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
    );
    await expect(
      metricValue(dialog, "Confidentiality Vulnerable system", "High"),
    ).toBeChecked();
    await expect(dialog.getByText(/^NVD: /)).toHaveCount(0);

    await metricValue(dialog, "Attack requirements", "Present").click();

    await expect(vector).toHaveValue(
      "CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
    );
    await expect(
      metric(dialog, "Attack requirements"),
    ).toHaveAccessibleDescription("NVD: None");
    await expect(startFrom(dialog)).toHaveText("");
    await expect(
      dialog.getByText("Base score 9.2, Critical", { exact: true }),
    ).toBeAttached();
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-cvss-add.png");

    await dialog.getByRole("button", { name: "Cancel" }).click();

    const discard = page.getByRole("dialog", { name: "Discard changes?" });
    await expect(discard).toContainText(
      "The SUSE assessment that you entered isn't added.",
    );
    await discard.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(add).toBeFocused();
  });

  test("says in Add SUSE assessment that SUSE already has an assessment of a version, also for a vector of that version entered on another tab, without sending it", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-16#cvss");
    await expectOverviewShown(page);
    // The changes of the SUSE assessment of CVE-2099-0016 that the page
    // sends.
    const sent: string[] = [];
    page.on("request", (request) => {
      const { pathname } = new URL(request.url());
      if (pathname.startsWith("/api/v1/cves/CVE-2099-0016/cvss/suse")) {
        sent.push(`${request.method()} ${pathname}`);
      }
    });

    await cvssButton(page, "Add SUSE assessment").click();

    // On v4.0, since SUSE has the v3.1 assessment of CVE-2099-0016 (CVEs),
    // with the focus on the first metric: no other provider has a v4.0
    // assessment to start from.
    const dialog = suseDialog(page);
    const v40 = dialog.getByRole("tab", { name: "CVSS v4.0", exact: true });
    await expect(v40).toHaveAttribute("aria-selected", "true");
    await expect(startFrom(dialog)).toHaveCount(0);
    await expect(
      metricValue(dialog, "Attack vector", "Physical"),
    ).toBeFocused();
    const submit = dialog.getByRole("button", {
      name: "Add SUSE assessment",
      exact: true,
    });

    const v31 = dialog.getByRole("tab", {
      name: "CVSS v3.1, the default version",
      exact: true,
    });
    // The tooltip of its mark, under the pointer, says what the default
    // version is.
    await v31.hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "The default CVSS version: its SUSE assessment also sets the eligibility score of the Products.",
    );

    await v31.click();

    const taken = dialog.getByText(
      "SUSE already has a CVSS v3.1 assessment: Edit in its row of the table changes it.",
      { exact: true },
    );
    await expect(taken).toBeVisible();
    await expect(vectorField(dialog)).toHaveCount(0);
    await expect(submit).toBeDisabled();
    await expectAccessible(page);
    // The pointer leaves the tab, whose tooltip hides, so that the reference
    // shows the tab without it.
    await taken.hover();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expectScreenshot(page, "ticket-cvss-add-taken.png");

    await v40.click();
    const vector = vectorField(dialog);
    // NVD's v3.1 vector of CVE-2099-0016.
    await vector.fill("CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H");
    await submit.click();

    await expect(
      dialog.getByText(
        "SUSE already has a CVSS v3.1 assessment: edit it in its row.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(vector).toBeFocused();
    expect(sent).toEqual([]);
    // Neither is the vector scored.
    await expect(
      dialog.getByText(
        "No score. SUSE already has a CVSS v3.1 assessment: edit it in its row.",
        { exact: true },
      ),
    ).toBeAttached();
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-cvss-add-error.png");
  });

  test("asks for confirmation of Delete of the SUSE assessment, which says that the eligibility score becomes the fallback and that the Ticket returns to Analysis, and keeps the assessment on Cancel", async ({
    page,
  }) => {
    // SNTL-16 is Resolved, and its SUSE assessment, of the default version
    // v3.1, is the only one of its CVE (Tickets; CVEs; System Settings), so
    // that without it the eligibility score is the fallback, and Delete
    // returns the Ticket to Analysis.
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-16#cvss");
    await expectOverviewShown(page);
    const remove = cvssButton(page, "Delete SUSE assessment v3.1");

    await remove.click();

    const confirmation = page.getByRole("dialog", {
      name: "Delete SUSE assessment v3.1?",
      exact: true,
    });
    await expect(confirmation).toContainText(
      "Sentinel calculates the severity of the CVE again from the other assessments, and the eligibility of the Products, which can change the priority and the deadlines of the Ticket. Without a SUSE CVSS v3.1 assessment, the eligibility score of the Products is the fallback 10.0. As the last SUSE assessment of the CVE, it also returns the Ticket to Analysis. This can't be undone.",
    );
    await expect(
      confirmation.getByRole("button", {
        name: "Delete SUSE assessment",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      confirmation.getByRole("button", { name: "Cancel" }),
    ).toBeFocused();
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-cvss-delete.png");

    await confirmation.getByRole("button", { name: "Cancel" }).click();

    await expect(confirmation).toHaveCount(0);
    await expect(remove).toBeFocused();
    await expect(cvssTable(page).getByRole("rowheader")).toHaveText([
      "NVD",
      "v3.1",
      "SUSE",
      "v3.1",
    ]);
  });

  test(
    "adds the SUSE assessment of a CVE once Sentinel accepts its vector, which assigns the Ticket and moves it to Analysis, staying open on the other version that holds input, then edits it and deletes it, after which the focus moves to Add SUSE assessment",
    { tag: "@changes-data" },
    async ({ page }) => {
      // SNTL-24, New and unassigned, without packages, whose CVE-2099-0022
      // has NVD's v3.1 assessment alone, and no other test of this project
      // opens it, so its CVSS assessments, its status, its assignee, and its
      // audit log are this test's own (Tickets; CVEs). An effective change
      // of the SUSE assessment by an analyst assigns an unassigned New
      // Ticket to them and moves it to Analysis (Sentinel
      // docs/features/tickets/cvss-scoring.md, Assessment Persistence and
      // Ticket Status).
      await signIn(page, "asmith");
      await page.goto("/tickets/SNTL-24");
      await expectOverviewShown(page);
      const status = await headingValue(page, "Status");
      const assignee = await detail(page, "Assignee");
      await expect(status).toHaveText("New");
      await expect(assignee).toHaveText("Unassigned");
      const add = cvssButton(page, "Add SUSE assessment");

      await add.click();

      // On the default version, with the focus on the first field of the
      // form, Start from, which offers NVD's assessment.
      const dialog = suseDialog(page);
      await expect(
        dialog.getByRole("tab", {
          name: "CVSS v3.1, the default version",
          exact: true,
        }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(startFrom(dialog)).toBeFocused();
      await chooseStart(page, dialog, "NVD, 7.5 High");
      const vector = vectorField(dialog);
      await expect(vector).toHaveValue(
        "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H",
      );
      // With a Temporal metric, which Sentinel refuses with 422
      // CVSS_INVALID_VECTOR (Sentinel docs/features/tickets/cvss-scoring.md,
      // Input Rules).
      await expect(
        dialog.getByText("Base score 7.5, High", { exact: true }),
      ).toBeAttached();
      const temporal = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H/E:P";
      await vector.fill(temporal);

      // Sentinel's read of its score rejects it, which the field says
      // before the form is submitted.
      const rejected = dialog.getByText(
        "Sentinel doesn't accept this vector. Enter a complete CVSS v3.1 Base vector.",
        { exact: true },
      );
      await expect(rejected).toBeVisible();
      await expect(
        dialog.getByText("No score. Sentinel doesn't accept this vector.", {
          exact: true,
        }),
      ).toBeAttached();
      await expectAccessible(page);
      const submit = dialog.getByRole("button", {
        name: "Add SUSE assessment",
        exact: true,
      });
      await submit.click();

      await expect(rejected).toBeVisible();
      await expect(vector).toBeFocused();
      await expect(vector).toHaveValue(temporal);

      // A choice of a metric writes the vector of the metrics chosen,
      // without the Temporal metric.
      await metricValue(dialog, "Attack vector", "Local").click();
      const added = "CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H";
      await expect(vector).toHaveValue(added);
      await expect(rejected).toHaveCount(0);
      await expect(
        dialog.getByText("Base score 6.2, Medium", { exact: true }),
      ).toBeAttached();
      // The tab of v4.0, which SUSE lacks too, holds input as well.
      const v40 = dialog.getByRole("tab", { name: "CVSS v4.0", exact: true });
      await v40.click();
      await metricValue(dialog, "Attack vector", "Network").click();
      await expect(vector).toHaveValue("CVSS:4.0/AV:N");
      await dialog
        .getByRole("tab", { name: "CVSS v3.1, the default version" })
        .click();
      await expect(vector).toHaveValue(added);
      await submit.click();

      // The dialog stays open on v4.0, whose input it keeps, and says what it
      // added, with the focus on its action. The reads after the change, of
      // the assessments and of the Ticket, have arrived before anything is
      // pointed at again.
      await expect(
        dialog.getByText("SUSE assessment v3.1 added.", { exact: true }),
      ).toBeVisible();
      await expect(v40).toHaveAttribute("aria-selected", "true");
      await expect(vector).toHaveValue("CVSS:4.0/AV:N");
      await expect(submit).toBeFocused();
      const suse = assessmentRow(page, "SUSE", "3.1");
      await expect(
        suse.getByRole("button", { name: added, exact: true }),
      ).toBeVisible();
      await expect(
        await valueOf(page, "CVSS assessments", "Severity"),
      ).toHaveText(
        / from SUSE CVSS v3\.1, which also sets the eligibility score of the Products$/,
      );
      await expect(status).toHaveText("Analysis");
      await expect(assignee).toHaveText("Alice Smith");
      await expectAccessible(page);
      await expectScreenshot(page, "ticket-cvss-add-stays-open.png");

      await dialog.getByRole("button", { name: "Cancel" }).click();
      await page
        .getByRole("dialog", { name: "Discard changes?" })
        .getByRole("button", { name: "Discard", exact: true })
        .click();

      await expect(dialog).toHaveCount(0);
      // Add SUSE assessment stays, for v4.0, which SUSE lacks.
      await expect(add).toBeFocused();

      await cvssButton(page, "Edit SUSE assessment v3.1").click();

      const edit = suseDialog(page, "Edit SUSE assessment v3.1");
      await expect(startFrom(edit)).toBeFocused();
      await expect(vectorField(edit)).toHaveValue(added);
      await metricValue(edit, "Availability", "Low").click();
      const edited = "CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L";
      await expect(vectorField(edit)).toHaveValue(edited);
      await edit.getByRole("button", { name: "Save", exact: true }).click();

      await expect(edit).toHaveCount(0);
      await expect(
        suse.getByRole("button", { name: edited, exact: true }),
      ).toBeVisible();
      await expect(
        suse.getByRole("button", { name: added, exact: true }),
      ).toHaveCount(0);
      await expect(
        cvssStatus(page, "SUSE assessment v3.1 changed."),
      ).toHaveCount(1);
      await expect(cvssButton(page, "Edit SUSE assessment v3.1")).toBeFocused();

      await cvssButton(page, "Delete SUSE assessment v3.1").click();

      // The assessment is of the default version, so without it the
      // eligibility score is the fallback; SNTL-24 is in Analysis, so Delete
      // does not return it there.
      const confirmation = page.getByRole("dialog", {
        name: "Delete SUSE assessment v3.1?",
        exact: true,
      });
      await expect(confirmation).toContainText(
        "Sentinel calculates the severity of the CVE again from the other assessments, and the eligibility of the Products, which can change the priority and the deadlines of the Ticket. Without a SUSE CVSS v3.1 assessment, the eligibility score of the Products is the fallback 10.0. This can't be undone.",
      );
      await confirmation
        .getByRole("button", { name: "Delete SUSE assessment", exact: true })
        .click();

      await expect(confirmation).toHaveCount(0);
      await expect(suse).toHaveCount(0);
      await expect(cvssTable(page).getByRole("rowheader")).toHaveText([
        "NVD",
        "v3.1",
      ]);
      await expect(
        cvssStatus(page, "SUSE assessment v3.1 deleted."),
      ).toHaveCount(1);
      // No row follows the deleted one.
      await expect(add).toBeFocused();
    },
  );

  test("shows the sources of a CVE, with a failing source, every source disabled and so without Refetch", async ({
    page,
  }) => {
    await signIn(page, "asmith");

    await page.goto("/tickets/SNTL-6#sources");

    // CVE-2099-0006 was first ingested from MITRE, and the last run of the
    // NVD fetcher failed on it; no other source has fetched it, and every
    // fetcher is disabled after the load, so even an analyst has no source
    // to refetch (CVEs; Fetcher Runs and CVE Source Records; Fetchers;
    // Operating a Dataset Backend). The name of each status follows the name
    // of its source for assistive technologies.
    await expect(sources(page).getByRole("listitem")).toHaveText([
      notAttempted("SUSE Bugzilla"),
      notAttempted("EPSS"),
      notAttempted("GHSA"),
      notAttempted("Linux Kernel CNA"),
      notAttempted("CISA KEV"),
      new RegExp(
        String.raw`^MITRE\s*Success\s*Disabled\s*Last attempt ${DATE_TIME}$`,
      ),
      new RegExp(
        String.raw`^NVD\s*Failure\s*Disabled\s*Last attempt ${DATE_TIME}\s*Failing since ${DATE_TIME}$`,
      ),
      notAttempted("OSV"),
      notAttempted("Red Hat"),
    ]);
    await expect(sources(page).getByRole("button")).toHaveCount(0);
    // ticket-cvss-empty.png shows the same screen with its failing source.
    await expect(
      sources(page).getByRole("heading", {
        level: 2,
        name: "Sources of the CVE",
      }),
    ).toBeInViewport();
  });

  test("keeps the compact heading at the top of the window while the page scrolls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-10");
    const title = heading(page, "SNTL-10");
    await expect(title).toBeVisible();

    await page.mouse.move(640, 300);
    await page.mouse.wheel(0, 300);

    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await expect(title).toHaveCSS("font-size", "16px");
    await expect
      .poll(async () => (await title.boundingBox())?.y ?? -1)
      .toBeGreaterThanOrEqual(0);
  });

  test("opens the assignee picker of a Ticket from its details, with the users who can be its assignee, and closes it without a change", async ({
    page,
  }) => {
    // SNTL-12 is assigned to asmith. The users who can be the assignee of a
    // non-confidential Ticket are the active analysts who are not bot
    // accounts: asmith, bwilson, and cwhite, a restricted analyst (Users;
    // Tickets).
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-12");
    await expectOverviewShown(page);
    const pencil = part(page, "Details").getByRole("button", {
      name: "Edit assignee",
    });
    const popover = page.getByRole("dialog", { name: "Assignee" });
    const options = popover.getByRole("option");

    await withFixedDates(page, async () => {
      await pencil.click();
      await expect(options).toHaveText([
        "Unassign yourself",
        "Alice Smith @asmithYou",
        "Bob Wilson @bwilson",
        "Carol White @cwhite",
      ]);
      await expectScreenshot(page, "ticket-assignee.png");
    });
    await expect(
      popover.getByRole("searchbox", { name: "Search users" }),
    ).toBeFocused();
    await expect(
      popover.getByRole("option", { name: "Alice Smith @asmith You" }),
    ).toHaveAttribute("aria-selected", "true");
    await expectAccessible(page);

    // From 2 characters, the users that match.
    await page.keyboard.type("bo");
    await expect(options).toHaveText(["Bob Wilson @bwilson"]);
    await expectAccessible(page);

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(pencil).toBeFocused();
    await expect(await detail(page, "Assignee")).toHaveText("Alice Smith");
  });

  test("lists only the users who can be the assignee of a confidential Ticket, and offers no pencil on an Ignored one", async ({
    page,
  }) => {
    // SNTL-18 is confidential: cwhite, a restricted analyst, sees it through
    // an access grant but cannot be its assignee (Tickets; Embargoes).
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-18");
    await expectOverviewShown(page);

    await part(page, "Details")
      .getByRole("button", { name: "Edit assignee" })
      .click();

    await expect(
      page.getByRole("dialog", { name: "Assignee" }).getByRole("option"),
    ).toHaveText([
      "Unassign yourself",
      "Alice Smith @asmithYou",
      "Bob Wilson @bwilson",
    ]);

    // SNTL-17 is Ignored, so its assignee does not change.
    await page.goto("/tickets/SNTL-17");
    await expectOverviewShown(page);
    await expect(
      part(page, "Details").getByRole("button", { name: "Edit assignee" }),
    ).toHaveCount(0);
  });

  test(
    "assigns a New Ticket to the signed-in user, which moves it to Analysis, then returns it to the queue, then assigns it to a colleague",
    { tag: "@changes-data" },
    async ({ page }) => {
      // SNTL-23, New and unassigned, which no other test of this project
      // opens, so its assignee, its status, and its audit log are this
      // test's own (Tickets). An assignment moves a New Ticket to Analysis;
      // a self-unassignment keeps its status (Sentinel
      // docs/features/tickets/tickets.md, Assign Ticket; Self-Unassignment).
      await signIn(page, "asmith");
      await page.goto("/tickets/SNTL-23");
      await expectOverviewShown(page);
      const assignee = await detail(page, "Assignee");
      const status = await headingValue(page, "Status");
      await expect(assignee).toHaveText("Unassigned");
      await expect(status).toHaveText("New");
      const pencil = part(page, "Details").getByRole("button", {
        name: "Edit assignee",
      });
      const popover = page.getByRole("dialog", { name: "Assignee" });
      const announced = (text: string) =>
        page.getByRole("status").filter({ hasText: text });

      await pencil.click();
      await popover
        .getByRole("option", { name: "Alice Smith @asmith You" })
        .click();

      await expect(popover).toHaveCount(0);
      await expect(pencil).toBeFocused();
      await expect(assignee).toHaveText("Alice Smith");
      await expect(status).toHaveText("Analysis");
      await expect(announced("Assigned to you.")).toHaveCount(1);

      await pencil.click();
      await popover.getByRole("option", { name: "Unassign yourself" }).click();

      await expect(popover).toHaveCount(0);
      await expect(assignee).toHaveText("Unassigned");
      await expect(status).toHaveText("Analysis");
      await expect(announced("You're no longer the assignee.")).toHaveCount(1);

      await pencil.click();
      await popover
        .getByRole("option", { name: "Bob Wilson @bwilson" })
        .click();

      await expect(popover).toHaveCount(0);
      await expect(assignee).toHaveText("Bob Wilson");
      await expect(announced("Assigned to Bob Wilson.")).toHaveCount(1);
      await expectAccessible(page);
    },
  );
});

// The timeline of the tab Audit log: the events of each day as a list.
function events(page: Page) {
  return page
    .getByRole("tabpanel", { name: "Audit log" })
    .getByRole("listitem");
}

// The event of the timeline whose sentence holds the text.
function event(page: Page, text: string) {
  return events(page).filter({ hasText: text });
}

test.describe("the audit log", () => {
  test("shows the events of a Ticket as a timeline, from the tab Audit log", async ({
    page,
  }) => {
    // SNTL-12: bwilson assigns it to asmith and overrides its priority;
    // asmith adds, edits, and deletes its references, adds its packages, of
    // which the system adds the maintainers, and sets their tracks to
    // AFFECTED (Sentinel docs/features/platform/example-dataset.md, Tickets;
    // References; Packages, Tracks, and Maintainers).
    await signIn(page);
    await page.goto("/tickets/SNTL-12");
    await expect(heading(page, "SNTL-12")).toBeVisible();

    await page.getByRole("tab", { name: "Audit log" }).click();

    await expect(page).toHaveURL("/tickets/SNTL-12/audit-log");
    await expect(
      page.getByRole("tab", { name: "Audit log", selected: true }),
    ).toBeVisible();
    await expect(
      event(page, "Bob Wilson assigned the Ticket to @asmith"),
    ).toBeVisible();
    await expect(
      event(page, "Bob Wilson overrode the priority from P3 to P1"),
    ).toBeVisible();
    await expect(
      event(page, "System added the maintainer @dbrown to fictional-openssl"),
    ).toBeVisible();
    await expect(
      event(
        page,
        "Alice Smith set fictional-zlib · fles-16.0 from Analysis to Affected",
      ),
    ).toBeVisible();
    await expect(
      event(page, "Alice Smith deleted the reference").getByRole("link", {
        name: "https://lists.example.com/fictional-openssl/2099-0012 (another site)",
      }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await expectScreenshot(page, "ticket-audit-log.png");
  });

  test("filters the events by actor and kind, with the signed-in user first as You", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-12/audit-log");
    await expect(event(page, "Bob Wilson assigned")).toBeVisible();

    await page.getByRole("button", { name: "Filters" }).click();
    const filters = page.getByRole("dialog", { name: "Filters" });
    // From shows the day of the first event once its read has arrived.
    await expect(filters.getByRole("group", { name: "From" })).toHaveText(
      /^\d{2}\/\d{2}\/\d{4}$/,
    );
    await filters.getByRole("button", { name: /Actor/ }).click();
    const options = page.getByRole("listbox").getByRole("option");
    await expect(options).toHaveText([
      "Any actor",
      "System",
      /^Alice Smith @asmith\s*You$/,
      "Bob Wilson @bwilson",
    ]);
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-audit-log-actors.png");

    await options.filter({ hasText: "Alice Smith" }).click();
    await filters
      .getByRole("group", { name: "Kind" })
      .getByText("References", { exact: true })
      .click();
    await expect(
      filters.getByRole("button", { name: /^Alice Smith.*Actor$/ }),
    ).toBeVisible();
    await expect(
      filters.getByRole("checkbox", { name: "References" }),
    ).toBeChecked();
    await expect(page).toHaveURL(/actor=[0-9a-f-]{36}&kind=references$/);
    // The status region of the popover, after that of the errors of the
    // period, says what the timeline shows once the filtered events arrive.
    await expect(filters.getByRole("status").last()).toHaveText(/ events?$/);
    await expectAccessible(page);
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(
      new RegExp(
        String.raw`/tickets/SNTL-12/audit-log\?actor=[0-9a-f-]{36}&kind=references$`,
      ),
    );
    await expect(event(page, "Alice Smith added the reference")).toHaveCount(3);
    await expect(event(page, "Bob Wilson")).toHaveCount(0);
    await expect(event(page, "System")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Filters 2 applied" }),
    ).toBeVisible();
    await expectScreenshot(page, "ticket-audit-log-filtered.png");
  });

  test("searches the values of the events, and shows a bot account as such", async ({
    page,
  }) => {
    // security-scanner, a bot account, adds the reference of SNTL-10
    // (References).
    await signIn(page);
    await page.goto("/tickets/SNTL-10/audit-log");
    await expect(
      event(
        page,
        "Bot added the reference https://scanner.example.com/findings/CVE-2099-0010",
      ),
    ).toBeVisible();
    await expectAccessible(page);

    await page.goto("/tickets/SNTL-12/audit-log");
    await expect(event(page, "Bob Wilson assigned")).toBeVisible();
    const search = page.getByRole("searchbox", { name: "Search events" });
    await search.fill("fictional-zlib");
    await search.press("Enter");

    await expect(page).toHaveURL(
      "/tickets/SNTL-12/audit-log?search=fictional-zlib",
    );
    await expect(
      event(
        page,
        "Alice Smith set fictional-zlib · fles-16.0 from Analysis to Affected",
      ),
    ).toBeVisible();
    await expect(event(page, "fictional-openssl")).toHaveCount(0);
  });

  test("says in the period when a date lacks some of its parts", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/tickets/SNTL-12/audit-log");
    await expect(event(page, "Bob Wilson assigned")).toBeVisible();
    await page.getByRole("button", { name: "Filters" }).click();
    const filters = page.getByRole("dialog", { name: "Filters" });
    const from = filters.getByRole("group", { name: "From" });
    // From shows the day of the first event of the Ticket.
    await expect(from).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/);

    // A click on its year opens its calendar, which Escape closes, with the
    // focus back on the year; the day alone then.
    await from.getByRole("spinbutton").last().click();
    await expect(
      page.getByRole("dialog", { name: /Calendar From/ }),
    ).toBeVisible();
    // Its chosen day, the first day, in the accent fill.
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(from.getByRole("spinbutton").last()).toBeFocused();
    for (let removed = 0; removed < 10; removed += 1) {
      await page.keyboard.press("Backspace");
    }
    await expect(from).toHaveText("dd/mm/yyyy");
    await page.keyboard.type("01");
    await page.keyboard.press("Enter");

    await expect(
      filters.getByText("Enter the day, the month, and the year.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page).toHaveURL("/tickets/SNTL-12/audit-log");
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-audit-log-period-error.png");
  });

  test("applies a period typed in full and one chosen in a calendar, under the policy of the image", async ({
    page,
  }) => {
    // The events of the dataset keep the times of its load, so the first day
    // of SNTL-12 is the day of the load, today (Sentinel
    // docs/features/platform/example-dataset.md, Aged Tickets).
    await signIn(page);
    await page.goto("/tickets/SNTL-12/audit-log");
    await expect(event(page, "Bob Wilson assigned")).toBeVisible();
    const today = await page.evaluate(() => {
      const now = new Date();
      return [
        String(now.getDate()).padStart(2, "0"),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getFullYear()),
      ];
    });
    const [day = "", month = "", year = ""] = today;
    const date = `${year}-${month}-${day}`;
    await page.getByRole("button", { name: "Filters" }).click();
    const filters = page.getByRole("dialog", { name: "Filters" });
    const to = filters.getByRole("group", { name: "To" });
    // From shows the day of the first event once its read has arrived.
    await expect(filters.getByRole("group", { name: "From" })).toHaveText(
      /^\d{2}\/\d{2}\/\d{4}$/,
    );

    // A click on its day opens the calendar of To on the current month,
    // with the focus on today.
    await to.getByRole("spinbutton").first().click();
    const calendar = page.getByRole("dialog", { name: /Calendar To/ });
    await expect(calendar).toBeVisible();
    await expect(
      calendar.getByRole("button", { name: /^Today, / }),
    ).toBeFocused();
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-audit-log-calendar.png");
    await page.keyboard.press("Escape");
    await expect(calendar).toBeHidden();
    await expect(filters).toBeVisible();

    // Each typed part is announced, which empties the region of the
    // announcements under Trusted Types.
    await expect(to.getByRole("spinbutton").first()).toBeFocused();
    await page.keyboard.type(`${day}${month}${year}`);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`/tickets/SNTL-12/audit-log?to=${date}`);

    for (let removed = 0; removed < 10; removed += 1) {
      await page.keyboard.press("Backspace");
    }
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/tickets/SNTL-12/audit-log");

    // Chosen in the calendar of To: today.
    await to.getByRole("button", { name: "Calendar To" }).click();
    await expect(
      calendar.getByRole("button", { name: /^Today, / }),
    ).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(`/tickets/SNTL-12/audit-log?to=${date}`);
    await expect(calendar).toBeHidden();
    await expect(to).toHaveText(`${day}/${month}/${year}`);
    await expect(
      page.getByRole("button", { name: "Filters 1 applied" }),
    ).toBeVisible();
  });

  test("says when no event matches the search, and when a page lies beyond the last", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/tickets/SNTL-12/audit-log");
    await expect(event(page, "Bob Wilson assigned")).toBeVisible();
    const panel = page.getByRole("tabpanel", { name: "Audit log" });
    const search = page.getByRole("searchbox", { name: "Search events" });

    // A term that no value of the events of SNTL-12 holds.
    await search.fill("fictional-nothing");
    await search.press("Enter");

    await expect(page).toHaveURL(
      "/tickets/SNTL-12/audit-log?search=fictional-nothing",
    );
    await expect(
      // The message of the empty state, not its announcement.
      panel
        .getByRole("paragraph")
        .filter({ hasText: "No events match the search." }),
    ).toBeVisible();
    await expect(events(page)).toHaveCount(0);
    // The one of the toolbar, and the one of the empty state.
    await expect(
      panel.getByRole("button", { name: "Clear filters" }),
    ).toHaveCount(2);
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-audit-log-no-match.png");

    await page.goto("/tickets/SNTL-12/audit-log?page=99");

    await expect(heading(page, "SNTL-12")).toBeVisible();
    await expect(
      // The message of the empty state, not its announcement.
      panel
        .getByRole("paragraph")
        .filter({ hasText: "There are no events on this page." }),
    ).toBeVisible();
    await expect(
      panel.getByRole("link", { name: "Go to the first page" }),
    ).toHaveAttribute("href", "/tickets/SNTL-12/audit-log");
    await expect(
      page.getByRole("navigation", { name: "Pagination" }),
    ).toHaveCount(0);
    await expectScreenshot(page, "ticket-audit-log-beyond-last-page.png");
  });
});

// The panel of the tab References.
function referencesPanel(page: Page) {
  return page.getByRole("tabpanel", { name: "References" });
}

// The table of the references.
function referencesTable(page: Page) {
  return referencesPanel(page).getByRole("grid", { name: "References" });
}

// The links of the references, which name their rows, in their order.
function referenceLinks(page: Page) {
  return referencesTable(page).getByRole("rowheader").getByRole("link");
}

// The row of a reference, by the name of its link: its title, or its address
// without one, followed by the mark of another site.
function referenceRow(page: Page, name: string) {
  return referencesTable(page)
    .getByRole("row")
    .filter({
      has: page.getByRole("link", {
        name: `${name} (another site)`,
        exact: true,
      }),
    });
}

// A button of the tab References, by its whole name.
function referencesButton(page: Page, name: string) {
  return referencesPanel(page).getByRole("button", { name, exact: true });
}

// The status regions of the tab References that hold a text, such as the
// announcement of the outcome of a change.
function referencesStatus(page: Page, text: string) {
  return referencesPanel(page).getByRole("status").filter({ hasText: text });
}

// The line of a Ticket without references, not its announcement after a
// change of the filters.
function noReferences(page: Page) {
  return referencesPanel(page)
    .getByRole("paragraph")
    .filter({ hasText: /^No references\.$/ });
}

// The date and time of a cell, such as when a reference was added.
const DATE_TIME_CELL = new RegExp(`^${DATE_TIME}$`);

// Opens the tab References of a Ticket at its path, and waits until the
// Ticket and its references have arrived, which can move the controls of the
// tab (docs/conventions.md, End-to-End Tests).
async function openReferences(page: Page, ticketId: string, search = "") {
  await page.goto(`/tickets/${ticketId}/references${search}`);
  await expect(heading(page, ticketId)).toBeVisible();
  await expect(referencesTable(page).or(noReferences(page))).toBeVisible();
}

// The select of the type in a dialog of a reference, named by the option
// that it shows and its label.
function typeSelect(dialog: Locator) {
  return dialog.getByRole("button", { name: /Type$/ });
}

// Opens the options of the type in a dialog of a reference, and returns
// them.
async function openTypes(page: Page, dialog: Locator) {
  await typeSelect(dialog).click();
  const options = page.getByRole("listbox", { name: "Type" });
  await expect(options).toBeVisible();
  return options;
}

// Chooses the type of a reference in its dialog, once its open options are
// checked (docs/conventions.md, End-to-End Tests).
async function chooseType(page: Page, dialog: Locator, type: string) {
  const options = await openTypes(page, dialog);
  await expectAccessible(page);
  await options.getByRole("option", { name: type, exact: true }).click();
  await expect(typeSelect(dialog)).toHaveText(type);
}

test.describe("the references", () => {
  test("shows the references of a Ticket in the tab References, with Edit and Delete on each manual reference", async ({
    page,
  }) => {
    // SNTL-12 has two manual references by asmith, who holds
    // manage_references through the vulnerability_analyst role (Users;
    // References).
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-12");
    await expect(heading(page, "SNTL-12")).toBeVisible();

    await page.getByRole("tab", { name: "References" }).click();

    await expect(page).toHaveURL("/tickets/SNTL-12/references");
    await expect(
      page.getByRole("tab", { name: "References", selected: true }),
    ).toBeVisible();
    // In the order of the API, by type: the advisory, then the issue.
    const links = referenceLinks(page);
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAccessibleName(
      "Fictional advisory (another site)",
    );
    await expect(links.nth(0)).toHaveAttribute(
      "href",
      "https://advisories.example.com/fictional-openssl/2099-0012",
    );
    await expect(links.nth(1)).toHaveAccessibleName(
      "Fictional bug report (another site)",
    );
    await expect(links.nth(1)).toHaveAttribute(
      "href",
      "https://bugzilla.example.com/show_bug.cgi?id=1000012",
    );
    const advisory = referenceRow(page, "Fictional advisory");
    await expect(
      advisory.getByText(
        "https://advisories.example.com/fictional-openssl/2099-0012",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      advisory.getByText("Fixed in fictional-openssl 3.0.99.", { exact: true }),
    ).toBeVisible();
    await expect(referencesTable(page).getByRole("columnheader")).toHaveText([
      "Reference",
      "Type",
      "Source",
      "Added",
      "Actions",
    ]);
    await expect(referencesTable(page).getByRole("gridcell")).toHaveText([
      "Advisory",
      "Manual",
      DATE_TIME_CELL,
      "",
      "Issue",
      "Manual",
      DATE_TIME_CELL,
      "",
    ]);
    for (const name of ["“Fictional advisory”", "“Fictional bug report”"]) {
      await expect(
        referencesButton(page, `Edit reference ${name}`),
      ).toBeVisible();
      await expect(
        referencesButton(page, `Delete reference ${name}`),
      ).toBeVisible();
    }
    await expect(referencesButton(page, "Add reference")).toBeVisible();
    // Away from the tab, which the pointer would mark.
    await page.mouse.move(100, 500);
    await expectScreenshot(page, "ticket-references.png");

    // The tooltip of Edit names the action alone. React Aria shows it on
    // hover after the click on the tab.
    await referencesButton(page, "Edit reference “Fictional advisory”").hover();

    await expect(page.getByRole("tooltip")).toHaveText("Edit");
    await expectAccessible(page);
  });

  test("shows the automatic references of a CVE without Edit and Delete", async ({
    page,
  }) => {
    // The two references of CVE-2099-0001 from its ingestion from NVD,
    // without titles (References).
    await signIn(page, "asmith");

    await openReferences(page, "SNTL-1");

    const links = referenceLinks(page);
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAccessibleName(
      "https://www.example.com/advisories/CVE-2099-0001 (another site)",
    );
    await expect(links.nth(1)).toHaveAccessibleName(
      "https://git.example.com/fictional-lib/commit/0123abc (another site)",
    );
    await expect(referencesTable(page).getByRole("gridcell")).toHaveText([
      "Advisory",
      "NVD",
      DATE_TIME_CELL,
      "",
      "Patch",
      "NVD",
      DATE_TIME_CELL,
      "",
    ]);
    await expect(
      referencesPanel(page).getByRole("button", {
        name: /^(?:Edit|Delete) reference/,
      }),
    ).toHaveCount(0);
    await expect(referencesButton(page, "Add reference")).toBeVisible();
  });

  test("shows a user who does not manage references neither Add reference nor the actions", async ({
    page,
  }) => {
    // dbrown holds no role (Users).
    await signIn(page, "dbrown");

    await openReferences(page, "SNTL-12");

    await expect(referenceLinks(page)).toHaveCount(2);
    await expect(referencesTable(page).getByRole("columnheader")).toHaveText([
      "Reference",
      "Type",
      "Source",
      "Added",
    ]);
    await expect(referencesPanel(page).getByRole("button")).toHaveText([
      "Filters",
    ]);
  });

  test("says when a Ticket has no references", async ({ page }) => {
    // Only CVE-2099-0001, SNTL-10, and SNTL-12 have references (References).
    await signIn(page, "asmith");

    await openReferences(page, "SNTL-2");

    await expect(noReferences(page)).toBeVisible();
    await expect(referencesTable(page)).toHaveCount(0);
    await expectScreenshot(page, "ticket-references-empty.png");
  });

  test("filters the references by type and by source, from Filters and from the URL", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await openReferences(page, "SNTL-12");

    await referencesButton(page, "Filters").click();

    const filters = page.getByRole("dialog", { name: "Filters" });
    const types = filters.getByRole("group", { name: "Type" });
    const checkboxes = types.getByRole("checkbox");
    await expect(checkboxes).toHaveCount(5);
    for (const [index, type] of [
      "Advisory",
      "Patch",
      "Issue",
      "Article",
      "Uncategorized",
    ].entries()) {
      await expect(checkboxes.nth(index)).toHaveAccessibleName(type);
    }
    await expect(filters.getByRole("button", { name: /Source$/ })).toHaveText(
      "Any source",
    );
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-references-filters.png");

    await types.getByText("Issue", { exact: true }).click();

    await expect(page).toHaveURL("/tickets/SNTL-12/references?type=issue");
    await expect(filters.getByRole("status").last()).toHaveText("1 reference");
    // The sources of the references of SNTL-12, all manual.
    await filters.getByRole("button", { name: /Source$/ }).click();
    const sourceOptions = page.getByRole("listbox", { name: "Source" });
    await expect(sourceOptions.getByRole("option")).toHaveText([
      "Any source",
      "Manual",
    ]);
    await expectAccessible(page);
    await sourceOptions.getByRole("option", { name: "Manual" }).click();
    await expect(page).toHaveURL(
      "/tickets/SNTL-12/references?type=issue&source=manual",
    );
    await page.keyboard.press("Escape");
    await expect(filters).toHaveCount(0);
    await expect(referencesButton(page, "Filters 2 applied")).toBeVisible();
    await expect(referenceLinks(page)).toHaveCount(1);
    await expect(referenceLinks(page)).toHaveAccessibleName(
      "Fictional bug report (another site)",
    );

    // From the URL, a type that no reference of SNTL-12 has.
    await openReferences(page, "SNTL-12", "?type=patch&source=manual");

    await expect(
      referencesPanel(page).getByText("No references match the filters.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(referenceLinks(page)).toHaveCount(0);
    // The one of the line above the table, and the one of the empty state.
    const clear = referencesButton(page, "Clear filters");
    await expect(clear).toHaveCount(2);
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-references-no-match.png");

    await clear.last().click();

    await expect(page).toHaveURL("/tickets/SNTL-12/references");
    await expect(referenceLinks(page)).toHaveCount(2);
    await expect(heading(page, "SNTL-12")).toBeFocused();
  });

  test("checks the address of Add reference, says that the Ticket already has it, and asks before discarding it", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await openReferences(page, "SNTL-12");
    const add = referencesButton(page, "Add reference");

    await add.click();

    const dialog = page.getByRole("dialog", { name: "Add reference" });
    const address = dialog.getByRole("textbox", {
      name: "Address",
      exact: true,
    });
    await expect(address).toBeFocused();
    await expect(
      dialog.getByRole("textbox", { name: "Title (optional)" }),
    ).toHaveValue("");
    await expect(typeSelect(dialog)).toHaveText("Detect from the address");
    await expect(
      dialog.getByRole("textbox", { name: "Description (optional)" }),
    ).toHaveValue("");
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-references-add.png");

    // The types, after Detect from the address, chosen at first; Escape
    // closes them alone.
    const types = await openTypes(page, dialog);
    await expect(types.getByRole("option")).toHaveText([
      "Detect from the address",
      "Advisory",
      "Patch",
      "Issue",
      "Article",
      "Uncategorized",
    ]);
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-references-add-types.png");
    await page.keyboard.press("Escape");
    await expect(types).toHaveCount(0);
    await expect(typeSelect(dialog)).toBeFocused();

    // Without an address, from the keyboard, which sends nothing.
    await address.press("Enter");

    await expect(
      dialog.getByText("Enter the address.", { exact: true }),
    ).toBeVisible();
    await expect(address).toBeFocused();
    await expectAccessible(page);

    // The address of “Fictional advisory” of SNTL-12 with http, which
    // Sentinel normalizes to https, and refuses with 409 RESOURCE_CONFLICT,
    // so that nothing changes (Sentinel
    // docs/features/tickets/ticket-references.md, URL Normalization; Add
    // Reference).
    await address.fill(
      "http://advisories.example.com/fictional-openssl/2099-0012",
    );
    await address.press("Enter");

    await expect(
      dialog.getByText(
        "This Ticket already has a reference with this address.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(address).toBeFocused();
    await expect(address).toHaveValue(
      "http://advisories.example.com/fictional-openssl/2099-0012",
    );
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-references-add-conflict.png");

    await dialog.getByRole("button", { name: "Cancel" }).click();

    const discard = page.getByRole("dialog", { name: "Discard changes?" });
    await expect(discard).toContainText(
      "The reference that you entered isn't added.",
    );
    await expect(
      discard.getByRole("button", { name: "Keep editing" }),
    ).toBeFocused();
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-references-discard.png");
    await discard.getByRole("button", { name: "Discard" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(add).toBeFocused();
    await expect(referenceLinks(page)).toHaveCount(2);
  });

  test("asks before Back and Forward discard the input of Add reference, keeping the dialog, the input, and the URL on Keep editing, and leaves the question to the browser's own prompt before a reload", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-12");
    await expectOverviewShown(page);
    // Overview, References, and Audit log in the browser history, then back
    // to References, with an entry on each side.
    await page.getByRole("tab", { name: "References" }).click();
    await expect(referencesTable(page)).toBeVisible();
    await page.getByRole("tab", { name: "Audit log" }).click();
    await expect(page).toHaveURL("/tickets/SNTL-12/audit-log");
    await page.evaluate(() => {
      history.back();
    });
    await expect(page).toHaveURL("/tickets/SNTL-12/references");
    await referencesButton(page, "Add reference").click();
    const dialog = page.getByRole("dialog", { name: "Add reference" });
    const address = dialog.getByRole("textbox", {
      name: "Address",
      exact: true,
    });
    await address.fill("https://advisories.example.com/fictional-zlib/2099-1");
    const discard = page.getByRole("dialog", { name: "Discard changes?" });

    for (const step of ["back", "forward"] as const) {
      await page.evaluate((direction) => {
        history[direction]();
      }, step);

      await expect(discard).toContainText(
        "The reference that you entered isn't added.",
      );
      await expect(
        discard.getByRole("button", { name: "Keep editing" }),
      ).toBeFocused();
      await expectAccessible(page);
      await discard.getByRole("button", { name: "Keep editing" }).click();
      await expect(discard).toHaveCount(0);
      await expect(page).toHaveURL("/tickets/SNTL-12/references");
      await expect(address).toHaveValue(
        "https://advisories.example.com/fictional-zlib/2099-1",
      );
    }

    // The browser's own prompt, which keeps the page when the user stays.
    const prompts: string[] = [];
    page.once("dialog", (prompt) => {
      prompts.push(prompt.type());
      void prompt.dismiss();
    });
    await page.evaluate(() => {
      location.reload();
    });
    await expect.poll(() => prompts).toEqual(["beforeunload"]);
    await expect(address).toHaveValue(
      "https://advisories.example.com/fictional-zlib/2099-1",
    );

    await page.evaluate(() => {
      history.back();
    });
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect(page).toHaveURL("/tickets/SNTL-12");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("tabpanel", { name: "Overview" }),
    ).toBeVisible();
  });

  test("reloads without a prompt while Add reference holds no input", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await openReferences(page, "SNTL-12");
    const prompts: string[] = [];
    page.on("dialog", (prompt) => {
      prompts.push(prompt.type());
      void prompt.dismiss();
    });
    await referencesButton(page, "Add reference").click();
    await expect(
      page.getByRole("dialog", { name: "Add reference" }),
    ).toBeVisible();
    await expectAccessible(page);

    await page.reload();

    await expect(referencesTable(page)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(prompts).toEqual([]);
  });

  test("opens Edit reference with the values of a reference, and the confirmation of Delete, each closed without a change", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await openReferences(page, "SNTL-12");
    const edit = referencesButton(page, "Edit reference “Fictional advisory”");

    await edit.click();

    const dialog = page.getByRole("dialog", { name: "Edit reference" });
    const address = dialog.getByRole("textbox", {
      name: "Address",
      exact: true,
    });
    await expect(address).toBeFocused();
    await expect(address).toHaveValue(
      "https://advisories.example.com/fictional-openssl/2099-0012",
    );
    await expect(
      dialog.getByRole("textbox", { name: "Title (optional)" }),
    ).toHaveValue("Fictional advisory");
    await expect(typeSelect(dialog)).toHaveText("Advisory");
    await expect(
      dialog.getByRole("textbox", { name: "Description (optional)" }),
    ).toHaveValue("Fixed in fictional-openssl 3.0.99.");
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-references-edit.png");

    // Without a change, Cancel closes it without asking.
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(edit).toBeFocused();

    const remove = referencesButton(
      page,
      "Delete reference “Fictional bug report”",
    );
    await remove.click();

    const confirmation = page.getByRole("dialog", {
      name: "Delete reference “Fictional bug report”?",
    });
    await expect(confirmation).toContainText(
      "The reference is removed from this Ticket. This can't be undone.",
    );
    await expect(
      confirmation.getByRole("button", { name: "Delete reference" }),
    ).toBeVisible();
    await expect(
      confirmation.getByRole("button", { name: "Cancel" }),
    ).toBeFocused();
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-references-delete.png");

    await confirmation.getByRole("button", { name: "Cancel" }).click();

    await expect(confirmation).toHaveCount(0);
    await expect(remove).toBeFocused();
    await expect(referenceLinks(page)).toHaveCount(2);
  });

  test(
    "adds a reference that the filters hide, with its outcome in the message area, then edits it and deletes it, after which the focus moves to Add reference",
    { tag: "@changes-data" },
    async ({ page }) => {
      // SNTL-17, Ignored, has no reference, and no other test opens it, so
      // its references, its audit log, and its participants are this test's
      // own (Tickets; References). A change of a reference is valid in every
      // status (Sentinel docs/features/tickets/ticket-references.md,
      // Manual-Zone Exception). The tab opens with the filter of the
      // advisories.
      await signIn(page, "asmith");
      await openReferences(page, "SNTL-17", "?type=advisory");
      await expect(noReferences(page)).toBeVisible();
      const add = referencesButton(page, "Add reference");

      // With the type detected from the address, which only Sentinel
      // decides.
      await add.click();
      const dialog = page.getByRole("dialog", { name: "Add reference" });
      await dialog
        .getByRole("textbox", { name: "Address", exact: true })
        .fill("http://advisories.example.com/CVE-2099-0017");
      await dialog
        .getByRole("textbox", { name: "Title (optional)" })
        .fill("Fictional advisory draft");
      await expect(typeSelect(dialog)).toHaveText("Detect from the address");
      await dialog.getByRole("button", { name: "Add reference" }).click();

      // Sentinel detects no type from an address of example.com, so the
      // reference is uncategorized, the filter hides it, and its outcome
      // shows in the message area instead of the tab (Sentinel
      // docs/features/tickets/ticket-references.md, URL Pattern Mapping;
      // docs/screens/ticket.md, Actions).
      await expect(dialog).toHaveCount(0);
      const added = "Reference “Fictional advisory draft” added.";
      await expect(page.getByText(added, { exact: true })).toHaveCount(1);
      await expect(page.getByText(added, { exact: true })).toBeVisible();
      await expect(referencesPanel(page).getByText(added)).toHaveCount(0);
      await expect(
        referencesPanel(page).getByText("No references match the filters.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(add).toBeFocused();

      await referencesButton(page, "Clear filters").first().click();

      await expect(page).toHaveURL("/tickets/SNTL-17/references");
      // Sentinel normalizes the address, http to https (Sentinel
      // docs/features/tickets/ticket-references.md, URL Normalization).
      const draft = referenceRow(page, "Fictional advisory draft");
      await expect(draft.getByRole("link")).toHaveAttribute(
        "href",
        "https://advisories.example.com/CVE-2099-0017",
      );
      await expect(
        draft.getByText("https://advisories.example.com/CVE-2099-0017", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(draft.getByRole("gridcell")).toHaveText([
        "Uncategorized",
        "Manual",
        DATE_TIME_CELL,
        "",
      ]);

      await referencesButton(
        page,
        "Edit reference “Fictional advisory draft”",
      ).click();
      const edit = page.getByRole("dialog", { name: "Edit reference" });
      const title = edit.getByRole("textbox", { name: "Title (optional)" });
      await expect(title).toHaveValue("Fictional advisory draft");
      await title.fill("Fictional advisory");
      await chooseType(page, edit, "Advisory");
      await edit.getByRole("button", { name: "Save" }).click();

      await expect(edit).toHaveCount(0);
      const advisory = referenceRow(page, "Fictional advisory");
      await expect(advisory.getByRole("gridcell")).toHaveText([
        "Advisory",
        "Manual",
        DATE_TIME_CELL,
        "",
      ]);
      await expect(draft).toHaveCount(0);
      await expect(
        referencesStatus(page, "Reference “Fictional advisory” changed."),
      ).toHaveCount(1);
      // Back on Edit, which names the reference by its new title.
      const editAdvisory = referencesButton(
        page,
        "Edit reference “Fictional advisory”",
      );
      await expect(editAdvisory).toBeFocused();

      await referencesButton(
        page,
        "Delete reference “Fictional advisory”",
      ).click();
      const confirmation = page.getByRole("dialog", {
        name: "Delete reference “Fictional advisory”?",
      });
      await confirmation
        .getByRole("button", { name: "Delete reference" })
        .click();

      await expect(confirmation).toHaveCount(0);
      await expect(advisory).toHaveCount(0);
      await expect(noReferences(page)).toBeVisible();
      await expect(
        referencesStatus(page, "Reference “Fictional advisory” deleted."),
      ).toHaveCount(1);
      // No row follows the deleted one (docs/screens/ticket.md, Actions).
      await expect(add).toBeFocused();
    },
  );
});

// The panel of the tab Affected versions.
function affectedPanel(page: Page) {
  return page.getByRole("tabpanel", { name: "Affected versions" });
}

// The names of the packages of the tab Affected versions, its level-two
// headings.
function affectedPackages(page: Page) {
  return affectedPanel(page).getByRole("heading", { level: 2 });
}

// The lines of the versions of the block of a source, by the rank of its
// term in the tab.
function sourceLines(page: Page, rank: number) {
  return affectedPanel(page)
    .getByRole("definition")
    .nth(rank)
    .getByRole("listitem");
}

// Opens the tab Affected versions of a Ticket at its path, and waits until
// the Ticket and what the tab shows in place of its entries have arrived.
async function openAffectedVersions(
  page: Page,
  ticketId: string,
  text: string,
) {
  await page.goto(`/tickets/${ticketId}/affected-versions`);
  await expect(heading(page, ticketId)).toBeVisible();
  await expect(affectedPanel(page).getByText(text).first()).toBeVisible();
}

test.describe("the affected versions", () => {
  test("shows the affected versions of the CVE of a Ticket by package, each source with its versions and their status, in the tab Affected versions", async ({
    page,
  }) => {
    // The four scopes of CVE-2099-0009, the CVE of SNTL-9, which together
    // give every field of an entry a value (CVEs, Affected Versions).
    await signIn(page, "asmith");
    await page.goto("/tickets/SNTL-9");
    await expect(heading(page, "SNTL-9")).toBeVisible();

    await page.getByRole("tab", { name: "Affected versions" }).click();

    await expect(page).toHaveURL("/tickets/SNTL-9/affected-versions");
    await expect(
      page.getByRole("tab", { name: "Affected versions", selected: true }),
    ).toBeVisible();
    await expect(affectedPackages(page)).toHaveText([
      "fictional_tar",
      "fictional-tar",
      /^https:\/\/git\.example\.com\/fictional-tar/,
    ]);
    await expect(
      affectedPanel(page).getByRole("link", {
        name: "https://git.example.com/fictional-tar (another site)",
      }),
    ).toHaveAttribute("href", "https://git.example.com/fictional-tar");
    // Within fictional-tar, the CNA first, then GHSA and OSV.
    await expect(affectedPanel(page).getByRole("term")).toHaveText([
      "CISA-ADP",
      "CNA",
      "GHSA",
      "OSV",
      "OSV",
    ]);
    await expect(sourceLines(page, 0)).toHaveText([
      /^From 1\.0 through 1\.4\.2\s*Affected$/,
      /^2\.0\.0-rc1\s*Unknown$/,
      /^Other versions\s*Unknown$/,
    ]);
    await expect(sourceLines(page, 1)).toHaveText([
      /^From 1\.0 before 1\.5\s*Affected$/,
      /^1\.5\s*Unaffected$/,
      /^Other versions\s*Unaffected$/,
    ]);
    await expect(sourceLines(page, 2)).toHaveText(["From 1.0.0 before 1.5.0"]);
    await expect(sourceLines(page, 3)).toHaveText(["From 1.0.0 before 1.5.0"]);
    await expect(sourceLines(page, 4)).toHaveText([
      "From 1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d before 9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c",
    ]);
    // Away from the tab, which the pointer would mark.
    await page.mouse.move(100, 500);
    await expectScreenshot(page, "ticket-affected-versions.png");
  });

  test("opens the details of a source, which the entries of a package share", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await openAffectedVersions(page, "SNTL-9", "From 1.0 before 1.5");
    const name = affectedPanel(page).getByRole("button", {
      name: "CNA for fictional-tar",
      exact: true,
    });

    await name.click();

    const dialog = page.getByRole("dialog", { name: "CNA", exact: true });
    await expect(dialog).toBeFocused();
    await expect(dialog.getByRole("term")).toHaveText([
      "Vendor",
      "Repository",
      "Collection URL",
      "CPE",
      "Version type",
      "Program files",
    ]);
    await expect(dialog.getByRole("definition")).toHaveText([
      "Example",
      /^https:\/\/git\.example\.com\/fictional-tar/,
      /^https:\/\/packages\.example\.com\//,
      "cpe:2.3:a:example:fictional-tar:*:*:*:*:*:*:*:*",
      "semver",
      "src/extract.c, src/names.c",
    ]);
    await expect(
      dialog.getByRole("link", {
        name: "https://packages.example.com/ (another site)",
      }),
    ).toHaveAttribute("href", "https://packages.example.com/");
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-affected-versions-details.png");

    await page.keyboard.press("Escape");

    await expect(dialog).toHaveCount(0);
    await expect(name).toBeFocused();
  });

  test("searches the entries, also in the details of their sources, and says when none matches", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await openAffectedVersions(page, "SNTL-9", "From 1.0 before 1.5");
    const search = affectedPanel(page).getByRole("searchbox", {
      name: "Search entries",
    });

    await search.fill("npm");
    await search.press("Enter");

    await expect(page).toHaveURL(
      "/tickets/SNTL-9/affected-versions?search=npm",
    );
    await expect(affectedPackages(page)).toHaveText(["fictional-tar"]);
    await expect(affectedPanel(page).getByRole("term")).toHaveText([
      "GHSA",
      "OSV",
    ]);

    await search.fill("fictional-zlib");
    await search.press("Enter");

    await expect(
      affectedPanel(page).getByText("No entries match the search.", {
        exact: true,
      }),
    ).toHaveCount(2);
    await expect(affectedPackages(page)).toHaveCount(0);
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-affected-versions-no-match.png");

    await affectedPanel(page)
      .getByRole("button", { name: "Clear filters" })
      .last()
      .click();

    await expect(page).toHaveURL("/tickets/SNTL-9/affected-versions");
    await expect(affectedPackages(page)).toHaveCount(3);
  });

  test("stays usable with the keyboard and at 320 CSS pixels with the largest CVE", async ({
    page,
  }) => {
    // The generated cna scope of 500 entries of CVE-2099-0013, the CVE of
    // SNTL-13 (CVEs, Affected Versions).
    await page.setViewportSize({ width: 320, height: 640 });
    await signIn(page, "asmith");
    await openAffectedVersions(page, "SNTL-13", "2.0.0");

    await expect(sourceLines(page, 0)).toHaveCount(500);
    expect(await scrollsHorizontally(page)).toBe(false);
    await page.getByRole("tab", { name: "Affected versions" }).focus();

    await page.keyboard.press("Tab");
    await expect(
      affectedPanel(page).getByRole("searchbox", { name: "Search entries" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    const name = affectedPanel(page).getByRole("button", {
      name: "CNA for fictional-httpd",
      exact: true,
    });
    await expect(name).toBeFocused();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "CNA", exact: true });
    await expect(dialog).toBeFocused();
    await expect(dialog.getByRole("definition")).toHaveText([
      "Example",
      "semver",
    ]);
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(name).toBeFocused();
    await page.keyboard.press("End");

    await expect(
      affectedPanel(page).getByText("2.4.99", { exact: true }),
    ).toBeInViewport();
    expect(await scrollsHorizontally(page)).toBe(false);
  });

  test("says when a Ticket has no CVE, and when Sentinel has no version data for its CVE", async ({
    page,
  }) => {
    // SNTL-21 has no CVE, and CVE-2099-0012 of SNTL-12 has no affected
    // versions (Tickets; CVEs).
    await signIn(page, "asmith");

    await openAffectedVersions(page, "SNTL-21", "This Ticket has no CVE.");

    await expect(
      affectedPanel(page).getByRole("searchbox", { name: "Search entries" }),
    ).toHaveCount(0);
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-affected-versions-without-cve.png");

    await openAffectedVersions(
      page,
      "SNTL-12",
      "Sentinel has no version data for this CVE.",
    );

    await expect(affectedPackages(page)).toHaveCount(0);
    await expectScreenshot(page, "ticket-affected-versions-empty.png");
  });
});

test("shows a maintainer the tracks of a Ticket that wait for them", async ({
  page,
}) => {
  // dbrown, without a role, maintains fictional-openssl of SNTL-12, whose
  // track waits for their submission, and not fictional-zlib (Packages,
  // Tracks, and Maintainers).
  await signIn(page, "dbrown");

  // At the top of the screen, which shows the track that waits for them.
  await page.goto("/tickets/SNTL-12");

  const packages = part(page, "Packages");
  const waiting = packages.getByText("Needs your action", { exact: true });
  await expect(waiting).toHaveCount(1);
  await expect(
    packages
      .getByRole("listitem")
      .filter({
        has: page.getByText("SUSE:FLES-15-SP7:Update", { exact: true }),
      })
      .last()
      .getByText("Needs your action"),
  ).toBeVisible();
  await expectOverviewShown(page);
  await expectScreenshot(page, "ticket-maintainer.png");
});

test("shows a maintainer the access grants of a confidential Ticket, without Grant access and Revoke access", async ({
  page,
}) => {
  // dbrown, without a role, sees SNTL-18 as the maintainer of
  // fictional-openssh (Packages, Tracks, and Maintainers).
  await signIn(page, "dbrown");

  await page.goto("/tickets/SNTL-18");
  // Once the parts above it have arrived, so that they do not move it.
  await expectOverviewShown(page);
  await part(page, "Participants")
    .getByRole("button", { name: "Access grants" })
    .click();

  const dialog = page.getByRole("dialog", { name: "Access grants" });
  await expect(dialog.getByRole("listitem")).toHaveCount(1);
  await expect(dialog).toBeFocused();
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: /^Revoke access/ }),
  ).toHaveCount(0);
});

test("offers a reader no pencil of the assignee", async ({ page }) => {
  // dbrown holds no role, so no triage_ticket (Users).
  await signIn(page, "dbrown");

  await page.goto("/tickets/SNTL-12");
  await expectOverviewShown(page);

  await expect(await detail(page, "Assignee")).toHaveText("Alice Smith");
  await expect(
    part(page, "Details").getByRole("button", { name: "Edit assignee" }),
  ).toHaveCount(0);
});

test("shows Not found for a Ticket that the user cannot see", async ({
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
});
