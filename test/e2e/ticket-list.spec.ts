import type { Page } from "@playwright/test";
import {
  avatars,
  dateTimes,
  expect,
  expectAccessible,
  signIn,
  test,
} from "./fixtures";

// The Ticket list (docs/screens/ticket-list.md), against a backend loaded
// with Sentinel's example dataset, whose Tickets, users, and roles the tests
// rely on as loaded (Sentinel docs/features/platform/example-dataset.md,
// Users; CVEs; Tickets; Aged Tickets).

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

// Moves the pointer away from the rows, which it would mark, to the empty
// part of the sidebar, before a reference screenshot.
async function pointerAway(page: Page) {
  await page.mouse.move(100, 500);
}

test.describe("for an analyst", () => {
  test("lands on the New view, sorted by priority, then deadline, with the counts of the views", async ({
    page,
  }) => {
    // asmith holds the vulnerability_analyst role, sees every Ticket, and can
    // be the assignee of every Ticket.
    await signIn(page, "asmith");

    await expect(
      page.getByRole("heading", { level: 1, name: "Tickets" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Tickets – Sentinel");
    await expect(views(page)).toHaveText([
      "New 11",
      "Unassigned 1",
      "Analysis 6",
      "Analyzed 3",
      "All 26",
      "Assigned to me 4",
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

    await views(page).filter({ hasText: "Assigned to me" }).click();

    await expect(page).toHaveURL("/tickets?view=assigned-to-me");
    // Among the P3 Tickets, SNTL-13, past its UM due date (Aged Tickets),
    // before SNTL-21, whose triage due date is still ahead.
    await expect(identifiers(page)).toHaveText([
      "SNTL-12",
      "SNTL-18",
      "SNTL-13",
      "SNTL-21",
    ]);
  });

  test("shows the Tickets awaiting an assignee", async ({ page }) => {
    await signIn(page, "asmith");

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

  test("pages the All view, sorted by last modification", async ({ page }) => {
    await signIn(page, "asmith");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Tickets", exact: true })
      .click();
    await views(page).filter({ hasText: "All" }).click();

    await expect(page).toHaveURL("/tickets");
    await expect(identifiers(page)).toHaveCount(20);
    await expect(
      table(page).getByRole("columnheader", { name: "Last modified" }),
    ).toHaveAttribute("aria-sort", "descending");
    const pagination = page.getByRole("navigation", { name: "Pagination" });
    await expect(pagination).toContainText("1–20 of 26");
    await expectAccessible(page);
    await pointerAway(page);

    await expect(page).toHaveScreenshot("ticket-list-all.png", masked(page));

    await pagination.getByRole("link", { name: "Next" }).click();

    await expect(page).toHaveURL("/tickets?page=2");
    await expect(identifiers(page)).toHaveCount(6);
    await expect(pagination).toContainText("21–26 of 26");
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
    await expect(identifiers(page)).toHaveCount(3);
    await expect(
      page.getByRole("heading", { level: 1, name: "Tickets" }),
    ).toBeFocused();
  });
});

test.describe("refined by an analyst", () => {
  test("shows the attention summary, whose counts open the All view refined to their Tickets", async ({
    page,
  }) => {
    await signIn(page, "asmith");
    const active = await ticketsOf(
      page,
      "priority=p1&status=new&status=analysis&status=analyzed&per_page=100",
    );

    // Right after a load, each aged Ticket is the only one past due in its
    // current phase (Aged Tickets).
    await expect(attention(page)).toHaveText([
      `${active.length} Active P1`,
      "1 Triage overdue",
      "1 Submission overdue",
      "1 UM overdue",
      "1 QA overdue",
    ]);

    for (const [count, url, ticket] of [
      ["1 Triage overdue", "/tickets?phase=triage&overdue=triage", "SNTL-7"],
      [
        "1 Submission overdue",
        "/tickets?phase=submission&overdue=submission",
        "SNTL-12",
      ],
      ["1 UM overdue", "/tickets?phase=um&overdue=um", "SNTL-13"],
      ["1 QA overdue", "/tickets?phase=qa&overdue=qa", "SNTL-26"],
    ] as const) {
      await attention(page).filter({ hasText: count }).click();
      await expect(page).toHaveURL(url);
      await expect(identifiers(page)).toHaveText([ticket]);
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
    await expect(views(page)).toHaveText([
      "New 11",
      "Unassigned 1",
      "Analysis 6",
      "Analyzed 3",
      "All 26",
      "Assigned to me 4",
    ]);
    await expect(attention(page).last()).toHaveText("1 QA overdue");

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
    await expect(identifiers(page)).toHaveCount(3);
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

test("shows a user without a role the views of every user, the attention summary, and the All view from the Tickets entry", async ({
  page,
}) => {
  // dbrown holds no role, and sees the non-confidential Tickets and the
  // confidential SNTL-18 of a package that dbrown maintains (Packages,
  // Tracks, and Maintainers).
  await signIn(page, "dbrown");

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Tickets", exact: true })
    .click();

  await expect(page).toHaveURL("/tickets");
  await expect(views(page)).toHaveText([
    "New 11",
    "Unassigned 1",
    "Analysis 5",
    "Analyzed 3",
    "All 25",
  ]);
  await expect(views(page).last()).toHaveAttribute("aria-selected", "true");
  // The attention summary is for every user: each aged Ticket is
  // non-confidential (Aged Tickets).
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
});
