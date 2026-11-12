import type { Page } from "@playwright/test";
import {
  expect,
  expectAccessible,
  expectScreenshot,
  signIn,
  test,
  withFixedDates,
} from "./fixtures";

// The Ticket screen (docs/screens/ticket.md), against a backend loaded with
// Sentinel's example dataset, whose Tickets, CVEs, users, and roles the tests
// rely on as loaded (Sentinel docs/features/platform/example-dataset.md,
// Users; CVEs; Tickets; Aged Tickets; Embargoes; Priorities).

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
    ).toHaveText(["Overview", "Audit log"]);
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
    await expect(cvssTable(page)).toBeVisible();
    await expectSources(page);
    await expectScreenshot(page, "ticket-confidential.png");
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
    await expect(openssl.getByText("Delivery", { exact: true })).toBeVisible();
    await expect(openssl.getByText("Pending", { exact: true })).toBeVisible();
    const pipeline = openssl.getByRole("button", {
      name: /^Phases of fictional-openssl, SUSE:FLES-15-SP7:Update: Triage done; Submission overdue by \d+ days?, current; UM (?:due|overdue) .+; QA due in \d+ days?$/,
    });
    await expect(pipeline).toBeVisible();
    await expect(
      openssl.getByText("Fictional Linux Enterprise Server 15 SP7"),
    ).toBeVisible();
    await expect(openssl.getByText("Not released")).toBeVisible();
    // Its Git track, whose later phases Sentinel does not observe, shows its
    // pipeline without Delivery Pending, and its Products a release that is
    // not observed.
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
    await expect(zlib.getByText("Release not observed")).toHaveCount(2);
    // No track shows a deadline badge, which the pipeline replaces.
    await expect(
      packages.getByText(/^(?:Triage|Submission|UM|QA|Release) -?\d+d$/),
    ).toHaveCount(0);
    // No hidden record.
    await expect(
      page.getByRole("switch", { name: "Show hidden 0" }),
    ).toBeDisabled();

    await pipeline.click();

    const phases = page.getByRole("dialog", { name: "Phases" });
    await expect(phases).toBeFocused();
    await expect(phases).toContainText("Submission · Maintainer");
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
    await expect(product.getByRole("definition")).toHaveText([
      "Eligible · automatic",
      "Not available",
      "Not observed",
    ]);
    await expectAccessible(page);
  });

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

    // asmith set the eligibility of Server LTSS 15 SP5 by hand.
    const ltss = packages.getByRole("button", {
      name: "Fictional Linux Enterprise Server LTSS 15 SP5",
    });
    await ltss.click();
    await expect(
      page
        .getByRole("dialog", {
          name: "Fictional Linux Enterprise Server LTSS 15 SP5",
        })
        .getByRole("definition"),
    ).toHaveText(["Not eligible · set by hand", "Extended support"]);
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(ltss).toBeFocused();

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
    await expectSources(page);
    await expectScreenshot(page, "ticket-hidden-records.png");

    await page.reload();

    await expect(
      page.getByRole("switch", { name: "Show hidden 5" }),
    ).toBeChecked();
    await expect(packages.getByText("SUSE:FLES-15-SP3:Update")).toHaveCount(2);
    await expect(packages.getByText("SUSE:FLES-15-SP4:Update")).toBeVisible();
  });

  test("shows the CVSS assessments of a CVE, whose SUSE assessment sets its severity and the eligibility score", async ({
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
      "5.5 Medium",
      "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
    ]);
    await expect(
      part(page, "CVSS assessments").getByRole("heading", { level: 2 }),
    ).toBeInViewport();
    await expectSources(page);
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
    await expect(cvssTable(page)).toBeVisible();
    await expectSources(page);
    // The duplicates, the other read for which the anchor waits, so that
    // the page no longer scrolls by itself.
    await expect(await detail(page, "Duplicates")).toHaveText("None");
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
    await expectSources(page);
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
    await expect(
      part(page, "CVSS assessments").getByRole("heading", { level: 2 }),
    ).toBeInViewport();
    await expectSources(page);
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
    await expectSources(page);
    await expectScreenshot(page, "ticket-cvss-empty.png");
  });

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

    // The day alone.
    await filters
      .getByRole("group", { name: "From" })
      .getByRole("spinbutton")
      .first()
      .click();
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
  await expect(cvssTable(page)).toBeVisible();
  await expectSources(page);
  await expectScreenshot(page, "ticket-maintainer.png");
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
