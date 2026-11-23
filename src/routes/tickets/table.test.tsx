import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../../styles.css";
import type { TicketSummary } from "../../api/generated/model";
import { formatDateTime } from "../../components/date-time";
import { fictionalTicket, jsonResponse, ticketPage } from "../../test-api";
import {
  ancestorOf,
  EMBARGO_ANALYST,
  frameOf,
  prepareEachTest,
  renderApp,
  returnToForeground,
  stubTickets,
  tableOf,
} from "./test-support";

// The table of the Ticket list (src/routes/tickets/table.tsx;
// docs/screens/ticket-list.md), at the browser's default text size, in the
// light theme.

prepareEachTest();

const DAY = 24 * 60 * 60 * 1000;

// The provenance of a priority override, which Sentinel states exactly when an
// override is set (Sentinel docs/features/tickets/ticket-priority.md,
// Persistence and Effective Priority): the user who set it and when.
const OVERRIDE_BY: NonNullable<TicketSummary["priority_override_by"]> = {
  id: "00000000-0000-0000-0000-000000000003",
  username: "asmith",
  full_name: "Alice Smith",
  active: true,
  bot: false,
  avatar_url: null,
};
const OVERRIDE_AT = "2099-10-09T15:05:09Z";

// fg-muted of the light theme.
const FG_MUTED = "rgb(89, 99, 110)";

describe("the table", () => {
  // The names of the columns that every view shows first.
  const FIRST = ["Ticket", "CVE", "Title", "Packages"];
  const SORTED = "Priority";

  test.each([
    ["New", "?view=new", [...FIRST, "Severity", SORTED, "Deadline"]],
    [
      "Unassigned",
      "?view=unassigned",
      [...FIRST, "Status", "Severity", SORTED, "Deadline"],
    ],
    [
      "Analysis",
      "?view=analysis",
      [...FIRST, "Severity", SORTED, "Deadline", "Assignee"],
    ],
    [
      "Analyzed",
      "?view=analyzed",
      [...FIRST, "Severity", SORTED, "Deadline", "Assignee"],
    ],
    [
      "All",
      "",
      [
        ...FIRST,
        "Status",
        "Severity",
        "Priority",
        "Deadline",
        "Assignee",
        "Last modified",
      ],
    ],
    [
      "Assigned to me",
      "?view=assigned-to-me",
      [...FIRST, "Status", "Severity", SORTED, "Deadline"],
    ],
  ])(
    "shows in %s the columns whose value the view does not fix",
    async (_, search, names) => {
      stubTickets();
      const { screen } = await renderApp(`/tickets${search}`);
      const headers = tableOf(screen).getByRole("columnheader");

      await expect.element(headers.first()).toBeVisible();
      expect(headers.elements()).toHaveLength(names.length);
      for (const [index, name] of names.entries()) {
        await expect.element(headers.nth(index)).toHaveAccessibleName(name);
      }
    },
  );

  test("shows in Embargo the columns of its embargoes, its Coordinated Release Date marked as sorted in ascending order", async () => {
    stubTickets({ user: EMBARGO_ANALYST });
    const { screen } = await renderApp("/tickets?view=embargo");
    const headers = tableOf(screen).getByRole("columnheader");
    const names = [
      ...FIRST,
      "Status",
      "Coordinated Release Date",
      "Deadline",
      "Assignee",
    ];

    await expect.element(headers.first()).toBeVisible();
    expect(headers.elements()).toHaveLength(names.length);
    for (const [index, name] of names.entries()) {
      await expect.element(headers.nth(index)).toHaveAccessibleName(name);
    }
    const sorted = tableOf(screen).getByRole("columnheader", {
      name: "Coordinated Release Date",
    });
    await expect.element(sorted).toHaveAttribute("aria-sort", "ascending");
    const marked = headers
      .elements()
      .filter((cell) => cell.querySelector("svg") !== null);
    expect(marked).toHaveLength(1);
    expect(marked[0]).toBe(sorted.element());
  });

  test("shows in Embargo the Coordinated Release Date of a Ticket as a date and time, and an absent one as Not set", async () => {
    const created = new Date(2026, 10, 11, 14, 0);
    const release = new Date(2026, 10, 21, 14, 0);
    // The due dates divide the 10 days from the creation to the Coordinated
    // Release Date, and the QA and release due dates are that date (Sentinel
    // docs/features/tickets/ticket-deadlines.md, Coordinated Release Window).
    const due = (days: number) =>
      new Date(created.getTime() + days * DAY).toISOString();
    stubTickets({
      user: EMBARGO_ANALYST,
      list: () =>
        ticketPage([
          fictionalTicket({
            ticket_id: "SNTL-27",
            status: "analyzed",
            is_confidential: true,
            coordinated_release_at: release.toISOString(),
            created_at: created.toISOString(),
            updated_at: created.toISOString(),
            triage_due_at: due(1),
            submission_due_at: due(6),
            um_due_at: due(7),
            qa_due_at: release.toISOString(),
            release_due_at: release.toISOString(),
            // In QA on the track of its package.
            current_phase: "qa",
            package_names: ["fictional-bind"],
          }),
          fictionalTicket({ ticket_id: "SNTL-19", is_confidential: true }),
        ]),
    });
    const { screen } = await renderApp("/tickets?view=embargo");
    const rows = tableOf(screen).getByRole("row");
    const cells = (index: number) =>
      rows
        .nth(index)
        .getByRole("gridcell")
        .elements()
        .map((cell) => cell.textContent);

    await expect.element(rows.nth(2)).toBeVisible();
    // CVE, Title, Packages, Status, then the date.
    expect(cells(1).slice(3, 5)).toEqual(["Analyzed", "21 Nov 2026, 14:00"]);
    await expect
      .element(rows.nth(1).getByText("21 Nov 2026, 14:00"))
      .toHaveAttribute("datetime", release.toISOString());
    expect(cells(2)[4]).toBe("–Not set");
  });

  test.each([
    ["a queue by priority", "?view=new", "Priority"],
    ["the All view by last modification", "", "Last modified"],
  ])("marks %s as sorted in descending order", async (_, search, column) => {
    stubTickets();
    const { screen } = await renderApp(`/tickets${search}`);
    const header = tableOf(screen).getByRole("columnheader", {
      name: column,
    });

    await expect.element(header).toHaveAttribute("aria-sort", "descending");
    expect(header.element().querySelector("svg")).not.toBeNull();
    expect(
      tableOf(screen)
        .getByRole("columnheader")
        .elements()
        .filter((cell) => cell.querySelector("svg") !== null),
    ).toHaveLength(1);
  });

  test("shows the values of a Ticket in its row, with the CVE ID as text and one link, to the Ticket", async () => {
    const updated = new Date(2026, 9, 9, 14, 5, 9);
    const ticket: TicketSummary = fictionalTicket({
      ticket_id: "SNTL-18",
      status: "analysis",
      severity: "critical",
      // An override of the automatic P2 of a Critical severity with a
      // likely exploitation (Sentinel docs/features/tickets/ticket-priority.md,
      // Decision Table; Automatic Priority Basis).
      priority: "p1",
      priority_override: "p1",
      priority_override_by: OVERRIDE_BY,
      priority_override_at: OVERRIDE_AT,
      priority_automatic_basis: {
        severity: "critical",
        exploitation: "likely",
        evidence: [{ kind: "ssvc_exploitation", value: "poc" }],
      },
      is_confidential: true,
      assignee: {
        id: "00000000-0000-0000-0000-000000000003",
        username: "asmith",
        full_name: "Alice Smith",
        active: true,
        bot: false,
        avatar_url: null,
      },
      cve: {
        cve_id: "CVE-2099-0018",
        title: "Fictional authentication bypass",
        description: null,
        cna: null,
      },
      triage_due_at: new Date(Date.now() + 3.5 * DAY).toISOString(),
      package_names: ["fictional-curl", "fictional-libcurl4"],
      updated_at: updated.toISOString(),
    });
    stubTickets({ list: () => ticketPage([ticket]) });
    const { screen } = await renderApp("/tickets");
    const row = tableOf(screen).getByRole("row").nth(1);

    await expect
      .element(row.getByRole("rowheader"))
      .toHaveTextContent("SNTL-18");
    await expect
      .element(row.getByRole("link", { name: "SNTL-18" }))
      .toHaveAttribute("href", "/tickets/SNTL-18");
    expect(
      getComputedStyle(row.getByRole("link", { name: "SNTL-18" }).element())
        .fontWeight,
    ).toBe("500");
    await expect
      .element(row.getByRole("img", { name: "Confidential" }))
      .toBeVisible();
    // A CVE has no screen of its own, and its address leads to the Ticket
    // to which the row already links (docs/screen-map.md, Links Between
    // Areas).
    expect(row.getByRole("link").all()).toHaveLength(1);
    const cve = row.getByText("CVE-2099-0018", { exact: true });
    await expect.element(cve).toBeVisible();
    // At the weight of the text of a row, as an identifier that is not a
    // link (docs/design-system.md, Type Scale).
    expect(getComputedStyle(cve.element()).fontWeight).toBe("400");
    expect(
      row
        .getByRole("gridcell")
        .elements()
        .map((cell) => cell.textContent),
    ).toEqual([
      "CVE-2099-0018",
      "Fictional authentication bypass",
      "fictional-curl+1",
      "Analysis",
      "Critical",
      "P1",
      "Triage 3dTriage due in 3 days",
      "Alice Smith",
      "9 Oct 2026, 14:05",
    ]);
  });

  test("shows the reason of an ignored Ticket after its status, by its name in fg-muted, and a reason that the pinned contract does not list as received", async () => {
    const tickets = [
      fictionalTicket({
        ticket_id: "SNTL-28",
        status: "ignored",
        ignore_reason: "cna_policy",
      }),
      fictionalTicket({
        ticket_id: "SNTL-17",
        status: "ignored",
        ignore_reason: "not_shipped",
      }),
      // A reason that a later Sentinel release can return.
      {
        ...fictionalTicket({ ticket_id: "SNTL-9", status: "ignored" }),
        ignore_reason: "fictional_reason",
      },
      fictionalTicket({ ticket_id: "SNTL-4", status: "analysis" }),
    ];
    stubTickets({
      list: () =>
        jsonResponse(200, {
          data: tickets,
          meta: { total: tickets.length, page: 1, per_page: 20 },
        }),
    });
    const { screen } = await renderApp("/tickets");
    const rows = tableOf(screen).getByRole("row");
    // The cell of the status, after CVE, Title, and Packages.
    const status = (index: number) =>
      rows.nth(index).getByRole("gridcell").nth(3);

    await expect.element(rows.nth(4)).toBeVisible();
    await expect
      .element(status(1))
      .toHaveAccessibleName("Ignored · CNA policy");
    await expect
      .element(status(2))
      .toHaveAccessibleName("Ignored · Not shipped");
    await expect
      .element(status(3))
      .toHaveAccessibleName("Ignored · fictional_reason");
    await expect.element(status(4)).toHaveAccessibleName("Analysis");
    // The reason, centered on the line of the status, in fg-muted, and the
    // status in fg.
    const reason = status(1).getByText("· CNA policy", { exact: true });
    expect(getComputedStyle(reason.element()).color).toBe(FG_MUTED);
    const name = status(1).getByText("Ignored", { exact: true });
    expect(getComputedStyle(name.element()).color).not.toBe(FG_MUTED);
    const [statusBox, reasonBox] = [name, reason].map((element) =>
      element.element().getBoundingClientRect(),
    );
    expect(Math.abs(statusBox!.bottom - reasonBox!.bottom)).toBeLessThanOrEqual(
      1,
    );
    // 6 px after the name of the status.
    expect(reasonBox!.left - statusBox!.right).toBeCloseTo(6, 0);
  });

  test("explains the priority of a row from its fields, opened from the keyboard in the table", async () => {
    stubTickets({
      list: () =>
        ticketPage([
          // An override of P3 over the automatic P1 of a High severity with
          // an active exploitation (Sentinel
          // docs/features/tickets/ticket-priority.md, Decision Table;
          // Automatic Priority Basis).
          fictionalTicket({
            ticket_id: "SNTL-13",
            priority: "p3",
            priority_automatic: "p1",
            priority_override: "p3",
            priority_override_by: OVERRIDE_BY,
            priority_override_at: OVERRIDE_AT,
            priority_automatic_basis: {
              severity: "high",
              exploitation: "active",
              evidence: [{ kind: "ssvc_exploitation", value: "active" }],
            },
          }),
          fictionalTicket({ ticket_id: "SNTL-12" }),
          fictionalTicket({ ticket_id: "SNTL-11" }),
        ]),
    });
    const { screen } = await renderApp("/tickets");
    const row = tableOf(screen).getByRole("row").nth(1);
    const priority = row.getByRole("button", {
      name: "P3, override",
      exact: true,
    });
    await expect.element(priority).toBeVisible();
    // In every row, the first, the last, and one between, the whole cell is
    // the button (docs/design-system.md, Priority, Explanation), so that the
    // cell, which takes the focus in turn as the arrow keys move in the
    // table, holds no smaller target beside it.
    for (const index of [1, 2, 3]) {
      const button = tableOf(screen)
        .getByRole("row")
        .nth(index)
        .getByRole("button", { name: /^P/ })
        .element();
      const area = button.getBoundingClientRect();
      const cell = ancestorOf(
        button,
        (element) => element.getAttribute("role") === "gridcell",
      ).getBoundingClientRect();
      expect([
        area.left <= cell.left,
        area.top <= cell.top,
        area.right >= cell.right,
        area.bottom >= cell.bottom,
      ]).toEqual([true, true, true, true]);
    }
    // The button of the last row does not reach past the table, which would
    // make it scroll vertically within its frame (docs/design-system.md,
    // Tables).
    const scroller = ancestorOf(
      tableOf(screen).element(),
      (element) => getComputedStyle(element).overflowX === "auto",
    );
    expect(scroller.scrollHeight).toBe(scroller.clientHeight);
    // From the cell of the severity, before it, as the arrow keys move in the
    // table.
    await row.getByRole("gridcell", { name: "High", exact: true }).click();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(priority).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    const dialog = page.getByRole("dialog", { name: "P3, override" });
    await expect.element(dialog).toHaveFocus();
    await expect
      .element(dialog.getByRole("heading", { level: 3 }).first())
      .toHaveTextContent("Automatic priority");
    await expect
      .element(dialog.getByRole("listitem"))
      .toHaveTextContent("SSVC exploitation Active");
    // Who set the override and when, from the fields of the row.
    expect(dialog.element().textContent).toContain(
      "Override set byAlice SmithOverride set on",
    );
    await expect
      .element(dialog.getByText(formatDateTime(OVERRIDE_AT), { exact: true }))
      .toHaveAttribute("datetime", OVERRIDE_AT);
    await userEvent.keyboard("{Escape}");
    await expect.element(priority).toHaveFocus();
  });

  test("moves the focus to the heading when a read removes the row whose explanation holds it", async () => {
    const { stub } = stubTickets();
    const { screen } = await renderApp("/tickets");
    await tableOf(screen)
      .getByRole("row")
      .nth(1)
      .getByRole("button", { name: "P2", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "P2, automatic" });
    await expect.element(dialog).toHaveFocus();
    stub.list = () => ticketPage([]);

    await returnToForeground();

    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toHaveFocus();
  });

  test("shows a Ticket without a CVE, a title, packages, or an assignee with absent values", async () => {
    stubTickets({
      list: () =>
        ticketPage([
          // Without a CVE, the automatic priority of a High severity has
          // no exploitation evidence (Sentinel
          // docs/features/tickets/ticket-priority.md, Automatic Priority
          // Basis).
          fictionalTicket({
            ticket_id: "SNTL-21",
            cve: null,
            priority: "p3",
            priority_automatic: "p3",
            priority_automatic_basis: {
              severity: "high",
              exploitation: "unknown",
              evidence: [],
            },
          }),
          fictionalTicket({
            ticket_id: "SNTL-6",
            cve: {
              cve_id: "CVE-2099-0006",
              title: null,
              description: null,
              cna: null,
            },
          }),
        ]),
    });
    const { screen } = await renderApp("/tickets");
    const rows = tableOf(screen).getByRole("row");
    const cells = (index: number) =>
      rows
        .nth(index)
        .getByRole("gridcell")
        .elements()
        .map((cell) => cell.textContent);

    await expect.element(rows.nth(2)).toBeVisible();
    expect(cells(1).slice(0, 3)).toEqual(["–Not set", "–Not set", "–Not set"]);
    expect(cells(1)[7]).toBe("Unassigned");
    expect(cells(2).slice(0, 2)).toEqual(["CVE-2099-0006", "–Not set"]);
  });

  test("cuts a long title with an ellipsis, gives it at least 100 px, and scrolls within its frame in a narrow window", async () => {
    await page.viewport(800, 700);
    const title = `Fictional ${"very long ".repeat(30)}title`;
    stubTickets({
      list: () =>
        ticketPage([
          fictionalTicket({
            cve: {
              cve_id: "CVE-2099-0001",
              title,
              description: null,
              cna: null,
            },
          }),
        ]),
    });
    const { screen } = await renderApp("/tickets");
    const cell = tableOf(screen).getByRole("gridcell", { name: title });

    await expect.element(cell).toBeVisible();
    const text = cell.element().firstElementChild!;
    expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
    expect(getComputedStyle(text).textOverflow).toBe("ellipsis");
    expect(cell.element().getBoundingClientRect().width).toBeGreaterThanOrEqual(
      100,
    );
    const scroller = ancestorOf(
      tableOf(screen).element(),
      (element) => getComputedStyle(element).overflowX === "auto",
    );
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    expect(frameOf(screen).contains(scroller)).toBe(true);
  });
});
