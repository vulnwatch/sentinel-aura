import type { Page } from "@playwright/test";
import {
  avatars,
  dateTimes,
  expect,
  expectAccessible,
  expectViewCounts,
  signIn,
  test,
} from "./fixtures";

// The Ticket list (docs/screens/ticket-list.md), against a backend loaded
// with Sentinel's example dataset, whose Tickets, users, and roles the tests
// rely on as loaded (Sentinel docs/features/platform/example-dataset.md,
// Users; CVEs; Tickets; Aged Tickets; Embargoes).

// The counts of the attention summary.
function attention(page: Page) {
  return page
    .getByRole("list", { name: "Tickets that need attention" })
    .getByRole("link");
}

// Whether a response body is a page of Tickets.
function isTicketPage(
  body: unknown,
): body is { data: { ticket_id: string }[] } {
  return (
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    Array.isArray(body.data) &&
    body.data.every(
      (ticket: unknown) =>
        typeof ticket === "object" &&
        ticket !== null &&
        "ticket_id" in ticket &&
        typeof ticket.ticket_id === "string",
    )
  );
}

// The identifiers of the Tickets that List Tickets returns for a query, in
// their order, as the signed-in user of the page.
async function ticketsOf(page: Page, query: string): Promise<string[]> {
  const response = await page.request.get(`/api/v1/tickets?${query}`);
  expect(response.ok()).toBe(true);
  const body: unknown = await response.json();
  if (!isTicketPage(body)) {
    throw new Error("List Tickets returned no page of Tickets");
  }
  return body.data.map((ticket) => ticket.ticket_id);
}

function views(page: Page) {
  return page.getByRole("tablist", { name: "Views" }).getByRole("tab");
}

function table(page: Page) {
  return page.getByRole("grid", { name: "Tickets" });
}

// The identifiers of the rows, in their order.
function identifiers(page: Page) {
  return table(page).getByRole("rowheader");
}

// The reference screenshots mask the avatars and the dates, which change
// from one load of the dataset to the next.
function masked(page: Page) {
  return { mask: [avatars(page), dateTimes(page)] };
}

// Whether a response body is a page of Tickets with the basis of their
// automatic priority.
function isBasisPage(body: unknown): body is {
  data: { priority_automatic_basis: { evidence: { value: unknown }[] } }[];
} {
  return (
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    Array.isArray(body.data) &&
    body.data.every(
      (ticket: unknown) =>
        typeof ticket === "object" &&
        ticket !== null &&
        "priority_automatic_basis" in ticket &&
        typeof ticket.priority_automatic_basis === "object" &&
        ticket.priority_automatic_basis !== null &&
        "evidence" in ticket.priority_automatic_basis &&
        Array.isArray(ticket.priority_automatic_basis.evidence),
    )
  );
}

const DATE = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// The date on which the CISA KEV entry of the CVE of the only Ticket that a
// search finds was added, which the dataset computes from the date of its
// load (Sentinel docs/features/platform/example-dataset.md, Time Base; CVEs),
// as the explanation of a priority shows it, such as 9 Oct 2026
// (docs/behaviors.md, Dates and Times, Display).
async function kevDateOf(page: Page, search: string): Promise<string> {
  const response = await page.request.get(`/api/v1/tickets?search=${search}`);
  expect(response.ok()).toBe(true);
  const body: unknown = await response.json();
  if (!isBasisPage(body) || body.data.length !== 1) {
    throw new Error(`List Tickets found no single Ticket for ${search}`);
  }
  const value = String(
    body.data[0]?.priority_automatic_basis.evidence[0]?.value,
  );
  const parts = new Map(
    DATE.formatToParts(new Date(`${value}T00:00:00Z`)).map((part) => [
      part.type,
      part.value,
    ]),
  );
  return `${parts.get("day")} ${parts.get("month")} ${parts.get("year")}`;
}

// The explanation of a priority that the page shows, by its name.
function explanation(page: Page, name: string) {
  return page.getByRole("dialog", { name, exact: true });
}

// Moves the pointer away from the rows, which it would mark, to the empty
// part of the sidebar, before a reference screenshot.
async function pointerAway(page: Page) {
  await page.mouse.move(100, 500);
}

test.describe("for an analyst", () => {
  test("lands on the New view, sorted by priority, then deadline, with the counts of the views", async ({
    page,
  }) => {
    // asmith holds the vulnerability_analyst role, with
    // manage_confidentiality, sees every Ticket, and can be the assignee of
    // every Ticket; SNTL-18, SNTL-19, and SNTL-27 are confidential (Tickets).
    await signIn(page, "asmith");

    await expect(
      page.getByRole("heading", { level: 1, name: "Tickets" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Tickets – Sentinel");
    await expect(views(page)).toHaveText([
      "New 11",
      "Unassigned 1",
      "Analysis 6",
      "Analyzed 4",
      "All 27",
      "Assigned to me 5",
      "Embargo 3",
    ]);
    await expect(views(page).first()).toHaveAttribute("aria-selected", "true");
    // P1, P2, P3, P4, and the Ticket without a priority last (Sentinel
    // docs/features/tickets/ticket-priority.md, Decision Table); within one
    // priority by the triage due date, earliest first, and SNTL-5, which has
    // no deadline, last. Each due date follows from the SLA tier and the
    // creation time, so within a tier the Ticket created first, the lower
    // number, comes first (Sentinel docs/features/tickets/ticket-deadlines.md,
    // Due Dates; Current Due Date; Sentinel
    // docs/features/platform/example-dataset.md, Steps and Transactions;
    // Tickets).
    await expect(identifiers(page)).toHaveText([
      "SNTL-1",
      "SNTL-7",
      "SNTL-2",
      "SNTL-24",
      "SNTL-10",
      "SNTL-3",
      "SNTL-25",
      "SNTL-4",
      "SNTL-23",
      "SNTL-5",
      "SNTL-6",
    ]);
    await expect(
      table(page).getByRole("columnheader", { name: "Priority" }),
    ).toHaveAttribute("aria-sort", "descending");
    // SNTL-7 is past its triage due date (Aged Tickets).
    await expect(
      table(page).getByRole("row", { name: /SNTL-7/ }),
    ).toContainText("Triage -3d");
    await pointerAway(page);

    await expect(page).toHaveScreenshot("ticket-list.png", masked(page));
  });

  test("opens a view with its tab, and the landing leads to the New view", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await expectViewCounts(page);

    await views(page).filter({ hasText: "Analysis" }).first().click();

    await expect(page).toHaveURL("/tickets?view=analysis");
    await expect(identifiers(page)).toHaveCount(6);
    // The confidential Tickets that asmith sees (Tickets).
    for (const ticket of ["SNTL-18", "SNTL-19"]) {
      await expect(
        table(page)
          .getByRole("rowheader", { name: new RegExp(ticket) })
          .getByRole("img", { name: "Confidential" }),
      ).toBeVisible();
    }
    await expect(
      table(page).getByRole("row", { name: /SNTL-9/ }),
    ).toContainText("Unassigned");
    await expectAccessible(page);
    await pointerAway(page);

    await expect(page).toHaveScreenshot(
      "ticket-list-analysis.png",
      masked(page),
    );

    await page.goto("/");
    await expect(page).toHaveURL("/tickets?view=new");
  });

  test("shows the Tickets assigned to the analyst", async ({ page }) => {
    await signIn(page, "asmith");
    await expectViewCounts(page);

    await views(page).filter({ hasText: "Assigned to me" }).click();

    await expect(page).toHaveURL("/tickets?view=assigned-to-me");
    // Among the P3 Tickets, SNTL-13, past its UM due date, and SNTL-27, past
    // its QA due date (Aged Tickets), before SNTL-21, whose triage due date
    // is still ahead.
    await expect(identifiers(page)).toHaveText([
      "SNTL-12",
      "SNTL-18",
      "SNTL-13",
      "SNTL-27",
      "SNTL-21",
    ]);
    // The deadlines of SNTL-18 and SNTL-27 divide the window up to their
    // Coordinated Release Dates instead of their SLA: the triage of SNTL-18
    // is due about 1 day 9 h 36 min after the load, and the QA of SNTL-27
    // was due 2 days before it, so its badge counts the third day begun
    // since (Embargoes; Sentinel docs/features/tickets/ticket-deadlines.md,
    // Coordinated Release Window; docs/behaviors.md, Deadlines).
    await expect(
      table(page).getByRole("row", { name: /SNTL-18/ }),
    ).toContainText("Triage 1d");
    await expect(
      table(page).getByRole("row", { name: /SNTL-27/ }),
    ).toContainText("QA -3d");
  });

  test("shows the embargoes by their Coordinated Release Dates, the earliest first", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await expectViewCounts(page);

    await views(page).filter({ hasText: "Embargo" }).click();

    await expect(page).toHaveURL("/tickets?view=embargo");
    // SNTL-27, whose embargo expired at T − 2d, then SNTL-18, which runs
    // until T + 14d, and SNTL-19, without a Coordinated Release Date, last
    // (Embargoes; Sentinel docs/features/tickets/tickets.md, List Tickets,
    // Embargo filters).
    await expect(identifiers(page)).toHaveText([
      "SNTL-27",
      "SNTL-18",
      "SNTL-19",
    ]);
    const release = table(page).getByRole("columnheader", {
      name: "Coordinated Release Date",
    });
    await expect(release).toHaveAttribute("aria-sort", "ascending");
    // The cell of the date, after the CVE, the title, the packages, and the
    // status: a date and time, which the dataset computes from its load, or
    // an absent value.
    const releaseOf = (ticket: string) =>
      table(page)
        .getByRole("row", { name: new RegExp(`${ticket}\\b`) })
        .getByRole("gridcell")
        .nth(4);
    for (const ticket of ["SNTL-27", "SNTL-18"]) {
      await expect(releaseOf(ticket)).toHaveText(
        /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/,
      );
    }
    await expect(releaseOf("SNTL-19")).toHaveText("–Not set");
    await expectAccessible(page);
    await pointerAway(page);

    await expect(page).toHaveScreenshot(
      "ticket-list-embargo.png",
      masked(page),
    );

    // The latest first, and still SNTL-19, without a date, last.
    await release.click();
    await expect(page).toHaveURL("/tickets?view=embargo&order=desc");
    await expect(identifiers(page)).toHaveText([
      "SNTL-18",
      "SNTL-27",
      "SNTL-19",
    ]);
  });

  test("shows the Tickets awaiting an assignee", async ({ page }) => {
    await signIn(page, "asmith");
    await expectViewCounts(page);

    await views(page).filter({ hasText: "Unassigned" }).click();

    await expect(page).toHaveURL("/tickets?view=unassigned");
    // SNTL-9, in Analysis, which the deactivation of eblack unassigned
    // (Tickets).
    await expect(identifiers(page)).toHaveText(["SNTL-9"]);
  });

  test("names at most 10 packages of a Ticket, then how many more", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await expectViewCounts(page);
    // With a click, after which React Aria shows a tooltip on hover.
    await views(page).filter({ hasText: "Analysis" }).first().click();
    await expect(page).toHaveURL("/tickets?view=analysis");

    // SNTL-11, in Analysis, has 12 packages: fictional-curl first, then the
    // others in the order of their names (Packages, Tracks, and Maintainers;
    // Sentinel docs/features/tickets/tickets.md, TicketSummary).
    const others = [
      "fictional-expat",
      "fictional-gzip",
      "fictional-jq",
      "fictional-libpng",
      "fictional-libssh",
      "fictional-libtiff",
      "fictional-ncurses",
      "fictional-pcre",
      "fictional-rsync",
      "fictional-sqlite",
      "fictional-xz",
    ];
    const row = table(page).getByRole("row", { name: /SNTL-11/ });
    const more = row.getByRole("button", {
      name: `11 more packages: ${others.slice(0, 10).join(", ")}, and 1 more`,
      exact: true,
    });
    await expect(more).toHaveText("+11");
    await expect(row).toContainText("fictional-curl+11");

    await more.hover();

    const tooltip = page.getByRole("tooltip");
    await expect(
      tooltip.getByText("12 packages", { exact: true }),
    ).toBeVisible();
    await expect(tooltip.getByRole("listitem")).toHaveText([
      "fictional-curl",
      ...others.slice(0, 9),
    ]);
    await expect(
      tooltip.getByText("…and 2 more", { exact: true }),
    ).toBeVisible();
    await expectAccessible(page);
  });

  test("explains an override of the priority with the automatic priority that it replaces", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await expectViewCounts(page);
    // In Assigned to me, whose columns hold no avatar and no date, so that no
    // mask of the reference lies over the popover.
    await views(page).filter({ hasText: "Assigned to me" }).click();
    await expect(page).toHaveURL("/tickets?view=assigned-to-me");
    // SNTL-12, assigned to asmith, whose override P1 bwilson set over the
    // automatic P3 of its High severity without exploitation evidence
    // (Tickets; CVEs; Sentinel docs/features/tickets/ticket-priority.md,
    // Decision Table).
    const priority = table(page)
      .getByRole("row", { name: /SNTL-12/ })
      .getByRole("button", { name: "P1, override", exact: true });

    await priority.click();

    const dialog = explanation(page, "P1, override");
    await expect(dialog).toBeFocused();
    await expect(dialog.getByRole("heading", { level: 3 })).toHaveText([
      "Automatic priority",
      "Evidence",
    ]);
    for (const text of ["P3", "High", "Unknown", "No evidence."]) {
      await expect(dialog.getByText(text, { exact: true })).toBeVisible();
    }
    await expectAccessible(page);
    await pointerAway(page);

    await expect(page).toHaveScreenshot(
      "ticket-list-priority.png",
      masked(page),
    );

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(priority).toBeFocused();
  });

  test("explains an automatic priority from the CISA KEV entry, opened and closed with the keyboard", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    await expectViewCounts(page);
    // SNTL-1, in the New view, whose automatic P1 follows from the CISA KEV
    // entry of CVE-2099-0001 (CVEs; Sentinel
    // docs/features/tickets/ticket-priority.md, Decision Table).
    const added = await kevDateOf(page, "CVE-2099-0001");
    const row = table(page).getByRole("row", { name: /SNTL-1\b/ });
    const priority = row.getByRole("button", { name: "P1", exact: true });
    // From the cell of the severity, before it, as the arrow keys move in
    // the table.
    await row.getByRole("gridcell", { name: "Critical", exact: true }).click();
    await page.keyboard.press("ArrowRight");
    await expect(priority).toBeFocused();

    await page.keyboard.press("Enter");

    const dialog = explanation(page, "P1, automatic");
    await expect(dialog).toBeFocused();
    await expect(dialog.getByRole("heading", { level: 3 })).toHaveText([
      "Based on",
      "Evidence",
    ]);
    for (const text of ["Critical", "KEV"]) {
      await expect(dialog.getByText(text, { exact: true })).toBeVisible();
    }
    await expect(dialog.getByRole("listitem")).toHaveText([
      `Listed in CISA KEV on ${added}`,
    ]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(priority).toBeFocused();
  });

  for (const { ticket, name, title, basis, evidence } of [
    // SNTL-10, whose automatic P3 follows from its Medium severity and the
    // SSVC exploitation poc of CVE-2099-0010 (CVEs).
    {
      ticket: "SNTL-10",
      name: "P3",
      title: "P3, automatic",
      basis: ["Medium", "Likely"],
      evidence: ["SSVC exploitation PoC"],
    },
    // SNTL-6, whose CVE-2099-0006 has no CVSS data and no exploitation
    // evidence, so that it is not yet prioritizable (CVEs).
    {
      ticket: "SNTL-6",
      name: "Not set",
      title: "Not yet prioritizable",
      basis: ["Unknown", "No evidence."],
      evidence: [],
    },
  ]) {
    test(`explains the priority of ${ticket} from its basis`, async ({
      page,
    }) => {
      await signIn(page, "asmith");
      await expectViewCounts(page);

      await table(page)
        .getByRole("row", { name: new RegExp(`${ticket}\\b`) })
        .getByRole("button", { name, exact: true })
        .click();

      const dialog = explanation(page, title);
      await expect(dialog).toBeFocused();
      for (const text of basis) {
        await expect(dialog.getByText(text, { exact: true })).toBeVisible();
      }
      await expect(dialog.getByRole("listitem")).toHaveText(evidence);
    });
  }

  test("pages the All view, sorted by last modification", async ({ page }) => {
    await signIn(page, "asmith");
    await expectViewCounts(page);
    await views(page).filter({ hasText: "All" }).click();

    await expect(page).toHaveURL("/tickets");
    await expect(identifiers(page)).toHaveCount(20);
    await expect(
      table(page).getByRole("columnheader", { name: "Last modified" }),
    ).toHaveAttribute("aria-sort", "descending");
    const pagination = page.getByRole("navigation", { name: "Pagination" });
    await expect(pagination).toContainText("1–20 of 27");
    await expectAccessible(page);
    await pointerAway(page);

    await expect(page).toHaveScreenshot("ticket-list-all.png", masked(page));

    await pagination.getByRole("link", { name: "Next" }).click();

    await expect(page).toHaveURL("/tickets?page=2");
    await expect(identifiers(page)).toHaveCount(7);
    await expect(pagination).toContainText("21–27 of 27");
    // Next is disabled on the last page, and the focus moves to Previous.
    await expect(
      pagination.getByRole("link", { name: "Previous" }),
    ).toBeFocused();
    await pointerAway(page);

    await expect(page).toHaveScreenshot(
      "ticket-list-all-last-page.png",
      masked(page),
    );
  });

  test("tells that a page beyond the last has no Tickets", async ({ page }) => {
    await signIn(page, "asmith");

    await page.goto("/tickets?view=analyzed&page=3");

    await expect(
      page.getByText("There are no Tickets on this page."),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Pagination" }),
    ).toHaveCount(0);
    await expectAccessible(page);
    await pointerAway(page);

    await expect(page).toHaveScreenshot(
      "ticket-list-beyond-last-page.png",
      masked(page),
    );

    await page.getByRole("link", { name: "Go to the first page" }).click();

    await expect(page).toHaveURL("/tickets?view=analyzed");
    await expect(identifiers(page)).toHaveCount(4);
    await expect(
      page.getByRole("heading", { level: 1, name: "Tickets" }),
    ).toBeFocused();
  });
});

test.describe("refined by an analyst", () => {
  test("shows the attention summary, whose counts open the All view, or the Embargo view, refined to their Tickets", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    const active = await ticketsOf(
      page,
      "priority=p1&status=new&status=analysis&status=analyzed&per_page=100",
    );

    // Right after a load, the aged Tickets are the only ones past due, each
    // in its current phase: SNTL-26 and SNTL-27 in QA, and one in each other
    // phase (Aged Tickets). The embargo of SNTL-27 has expired too, and
    // asmith holds manage_confidentiality (Embargoes).
    await expect(attention(page)).toHaveText([
      `${active.length} Active P1`,
      "1 Embargo expired",
      "1 Triage overdue",
      "1 Submission overdue",
      "1 UM overdue",
      "2 QA overdue",
    ]);

    // The All view lists them by last modification, the most recent first:
    // the load sets the Coordinated Release Date of SNTL-27 last.
    for (const [count, url, tickets] of [
      ["1 Triage overdue", "/tickets?phase=triage&overdue=triage", ["SNTL-7"]],
      [
        "1 Submission overdue",
        "/tickets?phase=submission&overdue=submission",
        ["SNTL-12"],
      ],
      ["1 UM overdue", "/tickets?phase=um&overdue=um", ["SNTL-13"]],
      ["2 QA overdue", "/tickets?phase=qa&overdue=qa", ["SNTL-27", "SNTL-26"]],
    ] as const) {
      await attention(page).filter({ hasText: count }).click();
      await expect(page).toHaveURL(url);
      await expect(identifiers(page)).toHaveText(tickets);
      await expect(views(page).filter({ hasText: "All" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    }

    await attention(page).filter({ hasText: "Active P1" }).click();
    await expect(page).toHaveURL(
      "/tickets?status=new&status=analysis&status=analyzed&priority=p1",
    );
    await expect(identifiers(page)).toHaveCount(active.length);

    // The Embargo view, refined to the embargoes that have expired.
    await attention(page).filter({ hasText: "Embargo expired" }).click();
    await expect(page).toHaveURL("/tickets?view=embargo&embargo=expired");
    await expect(identifiers(page)).toHaveText(["SNTL-27"]);
    await expect(views(page).filter({ hasText: "Embargo" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("searches the Tickets, and tells when none match", async ({ page }) => {
    await signIn(page, "asmith");
    const search = page.getByRole("searchbox", { name: "Search Tickets" });

    // fictional-curl is a package of SNTL-11, in Analysis (Packages, Tracks,
    // and Maintainers), so the New view has none.
    await search.fill("fictional-curl");
    await search.press("Enter");

    await expect(page).toHaveURL("/tickets?view=new&search=fictional-curl");
    await expect(
      page
        .getByRole("tabpanel")
        .getByText("No Tickets in this view match the search."),
    ).toBeVisible();
    await expectAccessible(page);
    await pointerAway(page);

    await expect(page).toHaveScreenshot(
      "ticket-list-no-match.png",
      masked(page),
    );

    await page.goto("/tickets?search=fictional-curl");
    await expect(identifiers(page)).toHaveText(["SNTL-11"]);
    await expect(
      table(page).getByRole("row", { name: /SNTL-11/ }),
    ).toContainText("fictional-curl");

    // Once the counts have arrived, which can move Clear filters to the next
    // row of the toolbar.
    await expectViewCounts(page);
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page).toHaveURL("/tickets");
    await expect(identifiers(page)).toHaveCount(20);
  });

  test("filters and sorts the Tickets, and shows their packages", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    // Once the counts have arrived, which widen the tabs and the summary, so
    // that the popover opens below Filters where it stays.
    await expectViewCounts(page);
    await expect(attention(page).last()).toHaveText("2 QA overdue");

    // In the New view, whose columns hold no avatar and no date, so that no
    // mask of the reference lies over the popover.
    await page.getByRole("button", { name: "Filters" }).click();
    const filters = page.getByRole("dialog", { name: "Filters" });
    await filters
      .getByRole("group", { name: "Severity" })
      .getByText("Critical", { exact: true })
      .click();

    await expect(page).toHaveURL("/tickets?view=new&severity=critical");
    await expect(identifiers(page)).toHaveText(["SNTL-1", "SNTL-7"]);
    await expectAccessible(page);

    await expect(page).toHaveScreenshot(
      "ticket-list-filters.png",
      masked(page),
    );

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Filters 1 applied" }),
    ).toBeFocused();

    // A tab opens its view without the filters.
    await views(page).filter({ hasText: "All" }).click();
    await expect(page).toHaveURL("/tickets");
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await filters
      .getByRole("group", { name: "Status" })
      .getByText("Analyzed", { exact: true })
      .click();

    await expect(page).toHaveURL("/tickets?status=analyzed");
    await expect(identifiers(page)).toHaveCount(4);
    // SNTL-12 has two packages (Packages, Tracks, and Maintainers).
    const packages = table(page)
      .getByRole("row", { name: /SNTL-12/ })
      .getByRole("button", { name: "1 more package: fictional-zlib" });
    await expect(packages).toBeVisible();
    await expect(
      table(page).getByRole("row", { name: /SNTL-12/ }),
    ).toContainText("fictional-openssl+1");
    // The popover with the Status filter of the All view.
    await expectAccessible(page);
    await page.keyboard.press("Escape");

    // By the due date of the current phase, earliest first, then latest
    // first, as List Tickets sorts them. The latest first differs from the
    // order of the last modification, which shows before.
    const deadline = table(page).getByRole("columnheader", {
      name: "Deadline",
    });
    for (const [order, url, direction] of [
      ["asc", "/tickets?status=analyzed&sort=deadline", "ascending"],
      [
        "desc",
        "/tickets?status=analyzed&sort=deadline&order=desc",
        "descending",
      ],
    ] as const) {
      const sorted = page.waitForResponse(
        (response) =>
          response.url().includes("sort_by=current_due_at") &&
          response.url().includes(`sort_order=${order}`),
      );
      await deadline.click();
      await sorted;

      await expect(page).toHaveURL(url);
      await expect(deadline).toHaveAttribute("aria-sort", direction);
      await expect(identifiers(page)).toHaveText(
        await ticketsOf(
          page,
          `status=analyzed&sort_by=current_due_at&sort_order=${order}`,
        ),
      );
    }
    await expect(identifiers(page)).not.toHaveText(
      await ticketsOf(
        page,
        "status=analyzed&sort_by=updated_at&sort_order=desc",
      ),
    );
  });
});

test.describe("for a restricted analyst", () => {
  test("lands on the New view, and shows the Tickets assigned to the analyst", async ({
    page,
  }) => {
    // cwhite holds the restricted_analyst role and is not a bot account, so
    // can be the assignee of the non-confidential Tickets, such as SNTL-20,
    // which cwhite created; cwhite sees the confidential SNTL-18 through an
    // access grant, without owning it (Users; Tickets).
    await signIn(page, "cwhite");

    await expect(views(page)).toHaveText([
      "New 11",
      "Unassigned 1",
      "Analysis 5",
      "Analyzed 3",
      "All 25",
      "Assigned to me 1",
    ]);
    await expect(views(page).first()).toHaveAttribute("aria-selected", "true");

    await views(page).filter({ hasText: "Assigned to me" }).click();

    await expect(page).toHaveURL("/tickets?view=assigned-to-me");
    await expect(identifiers(page)).toHaveText(["SNTL-20"]);
  });
});

test("lands a bot account on the New view, without Assigned to me", async ({
  page,
}) => {
  // security-scanner holds the restricted_analyst role, with triage_ticket,
  // and is a bot account, which can be the assignee of no Ticket (Users).
  await signIn(page, "security-scanner");

  await expect(views(page)).toHaveText([
    "New 11",
    "Unassigned 1",
    "Analysis 4",
    "Analyzed 3",
    "All 24",
  ]);
  await expect(views(page).first()).toHaveAttribute("aria-selected", "true");
});

test("lands a user without a role on the All view, which the Tickets entry opens, with the views of every user and the attention summary", async ({
  page,
}) => {
  // dbrown holds no role, and sees the non-confidential Tickets and the
  // confidential SNTL-18 of a package that dbrown maintains (Packages,
  // Tracks, and Maintainers).
  await signIn(page, "dbrown");

  await expect(page).toHaveURL("/tickets");
  await expect(
    page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Tickets", exact: true }),
  ).toHaveAttribute("href", "/tickets");
  await expect(views(page)).toHaveText([
    "New 11",
    "Unassigned 1",
    "Analysis 5",
    "Analyzed 3",
    "All 25",
  ]);
  await expect(views(page).last()).toHaveAttribute("aria-selected", "true");
  // The attention summary is for every user, with the counts of the Tickets
  // that the user sees: dbrown sees every aged Ticket but the confidential
  // SNTL-27, so one past due in each phase (Aged Tickets; Embargoes).
  const active = await ticketsOf(
    page,
    "priority=p1&status=new&status=analysis&status=analyzed&per_page=100",
  );
  await expect(attention(page)).toHaveText([
    `${active.length} Active P1`,
    "1 Triage overdue",
    "1 Submission overdue",
    "1 UM overdue",
    "1 QA overdue",
  ]);

  // A view that the user is not shown opens the All view, and leaves the URL.
  await page.goto("/tickets?view=assigned-to-me");
  await expect(page).toHaveURL("/tickets");
  await expect(views(page).last()).toHaveAttribute("aria-selected", "true");

  // The landing, to which / leads.
  await page.goto("/");
  await expect(page).toHaveURL("/tickets");
  await expect(views(page).last()).toHaveAttribute("aria-selected", "true");
});
