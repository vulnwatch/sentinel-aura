import { focusManager, type QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import type {
  CurrentUserResponse,
  TicketSummary,
} from "../api/generated/model";
import { getListTicketsQueryKey } from "../api/generated/tickets";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import {
  errorResponse,
  FICTIONAL_USER,
  fictionalTicket,
  jsonResponse,
  OTHER_USER,
  stubApi,
  ticketPage,
  urlOf,
} from "../test-api";

// The Ticket list (docs/screens/ticket-list.md), at the browser's default
// text size, in the light theme.

const ME = "/api/v1/users/me";
const TICKETS = "/api/v1/tickets";
const DAY = 24 * 60 * 60 * 1000;

// A user who holds the vulnerability_analyst role, and one who holds none.
const ANALYST: CurrentUserResponse = OTHER_USER;
const READER: CurrentUserResponse = FICTIONAL_USER;

// The filters of the views, as the requests send them, for the analyst.
const FILTERS = {
  New: "status=new",
  "Assigned to me": `assignee=${ANALYST.data.id}&status=analysis&status=analyzed`,
  Analysis: "status=analysis",
  Analyzed: "status=analyzed",
  Unassigned: "status=analysis&status=analyzed&assignee=none",
  All: "",
};

// The number of Tickets of each view in the tests, by its filters.
const TOTALS = new Map([
  [FILTERS.New, 12],
  [FILTERS["Assigned to me"], 4],
  [FILTERS.Analysis, 5],
  [FILTERS.Analyzed, 3],
  [FILTERS.Unassigned, 1],
  [FILTERS.All, 1250],
]);

// The read of a list, without its page.
function filtersOf(query: URLSearchParams): string {
  const filters = new URLSearchParams(query);
  filters.delete("per_page");
  filters.delete("page");
  filters.delete("sort_by");
  filters.delete("sort_order");
  return filters.toString();
}

type Responder = (query: URLSearchParams) => Response | Promise<Response>;

// The count of a view, a read of one Ticket.
function countOf(query: URLSearchParams): Response {
  return ticketPage([], {
    total: TOTALS.get(filtersOf(query)) ?? 0,
    perPage: 1,
  });
}

const ROW = fictionalTicket();

let client: QueryClient;

beforeEach(async () => {
  client = createQueryClient();
  // The delay between attempts is TanStack Query's; the tests remove it.
  client.setQueryDefaults(getListTicketsQueryKey(), { retryDelay: 0 });
  await page.viewport(1280, 800);
});

afterEach(async () => {
  client.clear();
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
  document.title = "Sentinel";
  await page.viewport(414, 896);
});

interface Stub {
  // The signed-in user, which a test can change.
  user: CurrentUserResponse;
  // The response to the read of a list, other than a count.
  list: Responder;
  // The response to the read of the count of a view.
  count: Responder;
}

// Answers the read of the signed-in user, the reads of the list, and the
// reads of the counts, as the test sets them, and returns the stub and the
// spy, whose calls name the requests.
function stubTickets(fields: Partial<Stub> = {}) {
  const stub: Stub = {
    user: ANALYST,
    list: () => ticketPage([ROW]),
    count: countOf,
    ...fields,
  };
  const spy = stubApi((request) => {
    if (request.path === ME) {
      return jsonResponse(200, stub.user);
    }
    if (request.path !== TICKETS) {
      return errorResponse(404, "RESOURCE_NOT_FOUND");
    }
    return request.query.get("per_page") === "1"
      ? stub.count(request.query)
      : stub.list(request.query);
  });
  return { stub, spy };
}

// The queries of the reads of the lists, or of the counts, in their order.
function queriesOf(
  spy: ReturnType<typeof stubApi>,
  kind: "list" | "count",
): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter(
      (url) =>
        url.pathname === TICKETS &&
        (url.searchParams.get("per_page") === "1") === (kind === "count"),
    )
    .map((url) => url.search.slice(1));
}

async function renderApp(path: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
    .toBeVisible();
  return { router, screen };
}

type Screen = Awaited<ReturnType<typeof renderApp>>["screen"];

function tabsOf(screen: Screen) {
  return screen.getByRole("tablist", { name: "Views" }).getByRole("tab");
}

function tableOf(screen: Screen) {
  return screen.getByRole("grid", { name: "Tickets" });
}

// The nearest element around the element that matches.
function ancestorOf(
  element: Element,
  matches: (ancestor: Element) => boolean,
): Element {
  let ancestor = element.parentElement;
  while (ancestor !== null && !matches(ancestor)) {
    ancestor = ancestor.parentElement;
  }
  if (ancestor === null) {
    throw new Error("No element around it matches");
  }
  return ancestor;
}

// The frame of the table, the nearest element around it with a border line
// (docs/design-system.md, Tables).
function frameOf(screen: Screen): Element {
  return ancestorOf(
    tableOf(screen).element(),
    (element) => getComputedStyle(element).borderTopWidth === "1px",
  );
}

// The text of each tab, once every count has arrived.
async function expectTabs(screen: Screen, names: string[]) {
  await expect
    .poll(() =>
      tabsOf(screen)
        .elements()
        .map((tab) => tab.textContent),
    )
    .toEqual(names);
}

// A response that the test gives when it chooses.
function later() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// The texts of the status regions of the screen that say something.
function announcementsOf(screen: Screen): string[] {
  return screen
    .getByRole("status")
    .elements()
    .map((region) => region.textContent)
    .filter((text) => text !== "");
}

// The tab returns to the foreground after being hidden.
function returnToForeground() {
  focusManager.setFocused(false);
  focusManager.setFocused(true);
}

describe("the views", () => {
  test("show to an analyst the heading and the six views, in their order, with their counts", async () => {
    stubTickets();
    const { screen } = await renderApp("/tickets?view=new");

    await expectTabs(screen, [
      "New 12",
      "Assigned to me 4",
      "Analysis 5",
      "Analyzed 3",
      "Unassigned 1",
      "All 1,250",
    ]);
    expect(document.title).toBe("Tickets – Sentinel");
    await expect
      .element(screen.getByRole("tab", { name: "New 12" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(screen.getByRole("tabpanel", { name: "New 12" }))
      .toBeVisible();
  });

  test("show no Assigned to me to a user without the vulnerability_analyst role", async () => {
    stubTickets({ user: READER });
    const { screen } = await renderApp("/tickets");

    await expectTabs(screen, [
      "New 12",
      "Analysis 5",
      "Analyzed 3",
      "Unassigned 1",
      "All 1,250",
    ]);
    await expect
      .element(screen.getByRole("tab", { name: "All 1,250" }))
      .toHaveAttribute("aria-selected", "true");
  });

  test.each([
    ["New", "?view=new", `${FILTERS.New}&sort_by=priority`],
    [
      "Assigned to me",
      "?view=assigned-to-me",
      `${FILTERS["Assigned to me"]}&sort_by=priority`,
    ],
    ["Analysis", "?view=analysis", `${FILTERS.Analysis}&sort_by=priority`],
    ["Analyzed", "?view=analyzed", `${FILTERS.Analyzed}&sort_by=priority`],
    [
      "Unassigned",
      "?view=unassigned",
      `${FILTERS.Unassigned}&sort_by=priority`,
    ],
    ["All", "", "sort_by=updated_at"],
  ])(
    "read %s with its filters, its sorting, in descending order, and its page of 20",
    async (_, search, query) => {
      const { spy } = stubTickets();
      await renderApp(`/tickets${search}`);

      await expect
        .poll(() => queriesOf(spy, "list"))
        .toEqual([`${query}&sort_order=desc&page=1&per_page=20`]);
    },
  );

  test("count each view with its filters alone, from a read of one Ticket", async () => {
    const { spy } = stubTickets();
    const { screen } = await renderApp("/tickets?view=analysis&page=2");
    await expectTabs(screen, [
      "New 12",
      "Assigned to me 4",
      "Analysis 5",
      "Analyzed 3",
      "Unassigned 1",
      "All 1,250",
    ]);

    expect(queriesOf(spy, "count")).toEqual(
      Object.values(FILTERS).map((filters) =>
        filters === "" ? "per_page=1" : `${filters}&per_page=1`,
      ),
    );
  });

  test("show the label of a view alone while its count loads", async () => {
    const pending = later();
    stubTickets({
      count: (query) =>
        filtersOf(query) === FILTERS.Analysis
          ? pending.promise
          : countOf(query),
    });
    const { screen } = await renderApp("/tickets?view=new");

    await expect
      .element(screen.getByRole("tab", { name: "All 1,250" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("tab", { name: "Analysis", exact: true }))
      .toBeVisible();

    pending.resolve(ticketPage([], { total: 5, perPage: 1 }));
    await expect
      .element(screen.getByRole("tab", { name: "Analysis 5" }))
      .toBeVisible();
  });

  test("show a count as not available when its read fails, and read it again with the next read of the list", async () => {
    const { stub, spy } = stubTickets({
      count: (query) =>
        filtersOf(query) === FILTERS.Analysis
          ? errorResponse(503, "DATABASE_UNAVAILABLE")
          : countOf(query),
    });
    const { screen } = await renderApp("/tickets?view=new");
    const analysis = screen.getByRole("tab", { name: /^Analysis/ });

    await expect
      .element(screen.getByRole("tab", { name: "Analysis Not available" }))
      .toBeVisible();
    expect(analysis.element().textContent).toBe("Analysis –Not available");
    // The read and its two retries (docs/behaviors.md, Retries and
    // Unconfirmed Changes).
    const analysisCounts = () =>
      queriesOf(spy, "count").filter(
        (query) => query === `${FILTERS.Analysis}&per_page=1`,
      ).length;
    expect(analysisCounts()).toBe(3);

    stub.count = countOf;
    await screen.getByRole("tab", { name: "Analyzed 3" }).click();

    await expect
      .element(screen.getByRole("tab", { name: "Analysis 5" }))
      .toBeVisible();
    expect(analysisCounts()).toBe(4);
  });

  test("open on a click, Enter, or Space, and not when the arrow keys move the focus", async () => {
    stubTickets();
    const { router, screen } = await renderApp("/tickets?view=new");
    await expectTabs(screen, [
      "New 12",
      "Assigned to me 4",
      "Analysis 5",
      "Analyzed 3",
      "Unassigned 1",
      "All 1,250",
    ]);

    await screen.getByRole("tab", { name: "Analysis 5" }).click();
    await expect
      .element(screen.getByRole("tab", { name: "Analysis 5" }))
      .toHaveAttribute("aria-selected", "true");
    expect(router.state.location.href).toBe("/tickets?view=analysis");

    await userEvent.keyboard("{ArrowRight}");
    const analyzed = screen.getByRole("tab", { name: "Analyzed 3" });
    await expect.element(analyzed).toHaveFocus();
    expect(router.state.location.href).toBe("/tickets?view=analysis");

    await userEvent.keyboard("{Enter}");
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=analyzed");
    await expect.element(analyzed).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard(" ");
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=unassigned");
    await expect
      .element(screen.getByRole("tab", { name: "Unassigned 1" }))
      .toHaveFocus();
    // Each view is an entry of the browser history.
    expect(router.history.length).toBe(4);
  });

  test("lead each to the first page of its view", async () => {
    stubTickets();
    const { screen } = await renderApp("/tickets?view=new&page=3");

    expect(
      tabsOf(screen)
        .elements()
        .map((tab) => tab.getAttribute("href")),
    ).toEqual([
      "/tickets?view=new",
      "/tickets?view=assigned-to-me",
      "/tickets?view=analysis",
      "/tickets?view=analyzed",
      "/tickets?view=unassigned",
      "/tickets",
    ]);
  });

  test("leave the focus on the tab, and announce the number of Tickets of the view once it shows", async () => {
    const pending = later();
    stubTickets({
      list: (query) =>
        filtersOf(query) === FILTERS.Analysis
          ? pending.promise
          : ticketPage([ROW]),
    });
    const { screen } = await renderApp("/tickets?view=new");
    const status = screen.getByText("5 Tickets");
    // The list as the screen opens is not announced.
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-1" }))
      .toBeVisible();
    expect(announcementsOf(screen)).toEqual([]);

    const analysis = screen.getByRole("tab", { name: /^Analysis/ });
    await analysis.click();
    // Nor are the rows of the previous view, while the view loads.
    await expect
      .element(screen.getByRole("progressbar", { name: "Updating" }))
      .toBeVisible();
    expect(announcementsOf(screen)).toEqual([]);
    pending.resolve(
      ticketPage(
        Array.from({ length: 5 }, (_, index) =>
          fictionalTicket({ ticket_id: `SNTL-${index + 1}` }),
        ),
      ),
    );

    await expect.element(status).toBeInTheDocument();
    expect(status.element().closest("output")).not.toBeNull();
    await expect.element(analysis).toHaveFocus();
  });

  test.each([
    [
      "the range of a page of a view of more than one page",
      ticketPage([ROW], { total: 21, page: 2 }),
      "?view=analysis&page=2",
      "21–21 of 21 Tickets",
    ],
    ["one Ticket", ticketPage([ROW]), "?view=analysis", "1 Ticket"],
    [
      "a view without Tickets",
      ticketPage([]),
      "?view=analysis",
      "No Tickets in this view.",
    ],
    [
      "a page beyond the last",
      ticketPage([], { total: 3, page: 5 }),
      "?view=analysis&page=5",
      "There are no Tickets on this page.",
    ],
  ])(
    "announce %s after another view or page",
    async (_, response, search, announcement) => {
      stubTickets({
        list: (query) =>
          filtersOf(query) === FILTERS.Analysis
            ? response.clone()
            : ticketPage([ROW]),
      });
      const { router, screen } = await renderApp("/tickets?view=new");
      await expect
        .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-1" }))
        .toBeVisible();

      router.history.push(`/tickets${search}`);

      await expect.poll(() => announcementsOf(screen)).toEqual([announcement]);
    },
  );
});

describe("while the list changes", () => {
  test("reads the count of the view that shows again with each read of its list, so that the tab and the list agree", async () => {
    const totals = new Map(TOTALS);
    const { spy } = stubTickets({
      count: (query) =>
        ticketPage([], {
          total: totals.get(filtersOf(query)) ?? 0,
          perPage: 1,
        }),
    });
    const { router, screen } = await renderApp("/tickets?view=new");
    await expect
      .element(screen.getByRole("tab", { name: "New 12" }))
      .toBeVisible();
    // Another Ticket arrives in the meantime.
    totals.set(FILTERS.New, 13);
    const countsOf = (filters: string) =>
      queriesOf(spy, "count").filter(
        (query) => query === `${filters}&per_page=1`,
      ).length;

    router.history.push("/tickets?view=new&page=2");

    await expect
      .element(screen.getByRole("tab", { name: "New 13" }))
      .toBeVisible();
    expect(countsOf(FILTERS.New)).toBe(2);
    // The counts of the other views are not read again.
    expect(countsOf(FILTERS.Analysis)).toBe(1);
  });

  test("keeps the columns, the sorting, and the pages of the rows that show while another view loads", async () => {
    const pending = later();
    stubTickets({
      list: (query) =>
        filtersOf(query) === FILTERS.New
          ? pending.promise
          : ticketPage([ROW], { total: 26 }),
    });
    const { screen } = await renderApp("/tickets");
    const pagination = screen.getByRole("navigation", { name: "Pagination" });
    await expect.element(pagination.getByText("1–20 of 26")).toBeVisible();

    await screen.getByRole("tab", { name: /^New/ }).click();

    await expect
      .element(screen.getByRole("progressbar", { name: "Updating" }))
      .toBeVisible();
    // The tab of the new view is selected at once.
    await expect
      .element(screen.getByRole("tab", { name: /^New/ }))
      .toHaveAttribute("aria-selected", "true");
    // The rows of the All view, under its columns and its sorting.
    await expect
      .element(
        tableOf(screen).getByRole("columnheader", {
          name: "Last modified (sorted descending)",
        }),
      )
      .toBeVisible();
    await expect
      .element(tableOf(screen).getByRole("columnheader", { name: "Status" }))
      .toBeVisible();
    await expect
      .element(pagination.getByRole("link", { name: "Next" }))
      .toHaveAttribute("href", "/tickets?page=2");

    pending.resolve(ticketPage([fictionalTicket({ ticket_id: "SNTL-2" })]));

    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-2" }))
      .toBeVisible();
    await expect
      .element(
        tableOf(screen).getByRole("columnheader", {
          name: "Priority (sorted descending)",
        }),
      )
      .toBeVisible();
    await expect
      .element(tableOf(screen).getByRole("columnheader", { name: "Status" }))
      .not.toBeInTheDocument();
  });

  test("announces each other view, also in the same words as the previous one", async () => {
    stubTickets({
      list: (query) =>
        filtersOf(query) === FILTERS.New ? ticketPage([ROW]) : ticketPage([]),
    });
    const { router, screen } = await renderApp("/tickets?view=new");
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-1" }))
      .toBeVisible();
    // The announcement in its status region.
    const announced = () =>
      screen
        .getByRole("status")
        .elements()
        .find((region) => region.textContent !== "")?.firstElementChild;

    router.history.push("/tickets?view=analysis");
    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["No Tickets in this view."]);
    const first = announced();

    router.history.push("/tickets?view=unassigned");

    // A new node, which assistive technologies announce although its words
    // are the same.
    await expect
      .poll(() => {
        const node = announced();
        return node !== undefined && node !== first;
      })
      .toBe(true);
    expect(announcementsOf(screen)).toEqual(["No Tickets in this view."]);
  });
});

describe("the URL", () => {
  // The read of the first page of the New view, and of the All view.
  const NEW = `${FILTERS.New}&sort_by=priority&sort_order=desc&page=1&per_page=20`;
  const ALL = "sort_by=updated_at&sort_order=desc&page=1&per_page=20";

  test.each([
    ["an unknown view", "?view=fictional", "/tickets", ALL],
    ["the All view by name", "?view=all", "/tickets", ALL],
    ["a page below 1", "?view=new&page=0", "/tickets?view=new", NEW],
    [
      "a page that is not a number",
      "?view=new&page=two",
      "/tickets?view=new",
      NEW,
    ],
    ["a page that is not a whole number", "?page=1.5", "/tickets", ALL],
    [
      "a page beyond the last that Sentinel accepts",
      "?page=2147483648",
      "/tickets",
      ALL,
    ],
    [
      "a parameter that the list does not accept",
      "?view=new&sort=id",
      "/tickets?view=new",
      NEW,
    ],
    ["a repeated view", "?view=new&view=analysis", "/tickets", ALL],
  ])(
    "drops %s, in place of the URL, and sends no request with it",
    async (_, search, accepted, read) => {
      const { spy } = stubTickets();
      const { router } = await renderApp(`/tickets${search}`);

      await expect.poll(() => router.state.location.href).toBe(accepted);
      expect(router.history.length).toBe(1);

      // Also when the URL opens after the page has loaded.
      router.history.push(`/tickets${search}`);

      await expect.poll(() => router.history.location.href).toBe(accepted);
      expect(router.state.location.href).toBe(accepted);
      expect(router.history.length).toBe(2);
      expect(queriesOf(spy, "list")).toEqual([read]);
    },
  );

  test("keeps a page and the fragment that it accepts", async () => {
    stubTickets();
    const { router } = await renderApp("/tickets?view=new&page=2&sort=id#top");

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=new&page=2#top");
  });

  test("opens the All view for a user who is not shown Assigned to me, and drops the view", async () => {
    const { spy } = stubTickets({ user: READER });
    const { router, screen } = await renderApp(
      "/tickets?view=assigned-to-me&page=2",
    );

    await expect.poll(() => router.state.location.href).toBe("/tickets?page=2");
    expect(router.history.length).toBe(1);
    await expect
      .element(screen.getByRole("tab", { name: /^All/ }))
      .toHaveAttribute("aria-selected", "true");
    expect(queriesOf(spy, "list")).toEqual([
      "sort_by=updated_at&sort_order=desc&page=2&per_page=20",
    ]);
  });

  test("drops Assigned to me when a read of the signed-in user tells that the role was removed", async () => {
    const { stub } = stubTickets();
    const { router, screen } = await renderApp("/tickets?view=assigned-to-me");
    await expect
      .element(screen.getByRole("tab", { name: "Assigned to me 4" }))
      .toHaveAttribute("aria-selected", "true");

    stub.user = { data: { ...ANALYST.data, roles: [] } };
    returnToForeground();

    await expect.poll(() => router.state.location.href).toBe("/tickets");
    await expect
      .element(screen.getByRole("tab", { name: /^Assigned to me/ }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("tab", { name: /^All/ }))
      .toHaveAttribute("aria-selected", "true");
  });
});

describe("the table", () => {
  // The names of the columns that every view shows first.
  const FIRST = ["Ticket", "CVE", "Title"];
  const SORTED = "Priority (sorted descending)";

  test.each([
    ["New", "?view=new", [...FIRST, "Severity", SORTED, "Deadline"]],
    [
      "Assigned to me",
      "?view=assigned-to-me",
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
      "Unassigned",
      "?view=unassigned",
      [...FIRST, "Status", "Severity", SORTED, "Deadline"],
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
        "Last modified (sorted descending)",
      ],
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

  test.each([
    ["a queue by priority", "?view=new", "Priority"],
    ["the All view by last modification", "", "Last modified"],
  ])("marks %s as sorted in descending order", async (_, search, column) => {
    stubTickets();
    const { screen } = await renderApp(`/tickets${search}`);
    const header = tableOf(screen).getByRole("columnheader", {
      name: `${column} (sorted descending)`,
    });

    await expect.element(header).toBeVisible();
    expect(header.element().querySelector("svg")).not.toBeNull();
    expect(
      tableOf(screen)
        .getByRole("columnheader")
        .elements()
        .filter((cell) => cell.querySelector("svg") !== null),
    ).toHaveLength(1);
  });

  test("shows the values of a Ticket in its row, with the links to the Ticket and its CVE", async () => {
    const updated = new Date(2026, 9, 9, 14, 5, 9);
    const ticket: TicketSummary = fictionalTicket({
      ticket_id: "SNTL-18",
      status: "analysis",
      severity: "critical",
      priority: "p1",
      is_confidential: true,
      assignee: {
        id: "00000000-0000-0000-0000-000000000003",
        username: "asmith",
        full_name: "Alice Smith",
        active: true,
        bot: false,
      },
      cve: {
        cve_id: "CVE-2099-0018",
        title: "Fictional authentication bypass",
        description: null,
      },
      triage_due_at: new Date(Date.now() + 3.5 * DAY).toISOString(),
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
    await expect
      .element(row.getByRole("link", { name: "CVE-2099-0018" }))
      .toHaveAttribute("href", "/cves/CVE-2099-0018");
    expect(
      getComputedStyle(
        row.getByRole("link", { name: "CVE-2099-0018" }).element(),
      ).fontWeight,
    ).toBe("500");
    expect(
      row
        .getByRole("gridcell")
        .elements()
        .map((cell) => cell.textContent),
    ).toEqual([
      "CVE-2099-0018",
      "Fictional authentication bypass",
      "Analysis",
      "Critical",
      "P1",
      "Triage 3dTriage due in 3 days",
      "Alice Smith",
      "9 Oct 2026, 14:05",
    ]);
  });

  test("shows a Ticket without a CVE, a title, or an assignee with absent values", async () => {
    stubTickets({
      list: () =>
        ticketPage([
          fictionalTicket({ ticket_id: "SNTL-21", cve: null }),
          fictionalTicket({
            ticket_id: "SNTL-6",
            cve: { cve_id: "CVE-2099-0006", title: null, description: null },
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
    expect(cells(1).slice(0, 2)).toEqual(["–Not set", "–Not set"]);
    expect(cells(1)[6]).toBe("Unassigned");
    expect(cells(2).slice(0, 2)).toEqual(["CVE-2099-0006", "–Not set"]);
  });

  test("cuts a long title with an ellipsis, gives it at least 100 px, and scrolls within its frame in a narrow window", async () => {
    await page.viewport(800, 700);
    const title = `Fictional ${"very long ".repeat(30)}title`;
    stubTickets({
      list: () =>
        ticketPage([
          fictionalTicket({
            cve: { cve_id: "CVE-2099-0001", title, description: null },
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

// The Tickets of a page of the All view of 26 Tickets.
function pageOf(query: URLSearchParams): Response {
  const number = Number(query.get("page"));
  const count = number === 1 ? 20 : number === 2 ? 6 : 0;
  return ticketPage(
    Array.from({ length: count }, (_, index) =>
      fictionalTicket({ ticket_id: `SNTL-${(number - 1) * 20 + index + 1}` }),
    ),
    { total: 26, page: number },
  );
}

describe("the pagination", () => {
  test("shows the range and leads to the next and the previous page", async () => {
    const { spy } = stubTickets({ list: pageOf });
    const { router, screen } = await renderApp("/tickets?view=new");
    const pagination = screen.getByRole("navigation", { name: "Pagination" });
    const previous = pagination.getByRole("link", { name: "Previous" });
    const next = pagination.getByRole("link", { name: "Next" });

    await expect.element(pagination.getByText("1–20 of 26")).toBeVisible();
    await expect.element(previous).toHaveAttribute("aria-disabled", "true");
    await expect.element(previous).not.toHaveAttribute("href");
    await expect
      .element(next)
      .toHaveAttribute("href", "/tickets?view=new&page=2");

    await next.click();

    await expect.element(pagination.getByText("21–26 of 26")).toBeVisible();
    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["21–26 of 26 Tickets"]);
    expect(router.state.location.href).toBe("/tickets?view=new&page=2");
    expect(queriesOf(spy, "list").at(-1)).toBe(
      `${FILTERS.New}&sort_by=priority&sort_order=desc&page=2&per_page=20`,
    );
    await expect.element(next).toHaveAttribute("aria-disabled", "true");
    await expect.element(previous).toHaveAttribute("href", "/tickets?view=new");
    // Next is disabled on the last page, so the focus moves to Previous,
    // which leads back.
    await expect.element(previous).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    await expect.element(pagination.getByText("1–20 of 26")).toBeVisible();
    expect(router.state.location.href).toBe("/tickets?view=new");
    await expect.element(next).toHaveFocus();
  });

  test("shows none for a list of one page", async () => {
    stubTickets({
      list: () => ticketPage([ROW], { total: 20 }),
    });
    const { screen } = await renderApp("/tickets");

    await expect.element(tableOf(screen).getByRole("row").nth(1)).toBeVisible();
    await expect
      .element(screen.getByRole("navigation", { name: "Pagination" }))
      .not.toBeInTheDocument();
  });

  test("shows that a page beyond the last has no Tickets, and leads to the first page", async () => {
    stubTickets({ list: pageOf });
    const { router, screen } = await renderApp("/tickets?view=new&page=5");
    const first = screen.getByRole("link", { name: "Go to the first page" });

    await expect
      .element(screen.getByText("There are no Tickets on this page."))
      .toBeVisible();
    await expect
      .element(screen.getByRole("navigation", { name: "Pagination" }))
      .not.toBeInTheDocument();
    await expect.element(first).toHaveAttribute("href", "/tickets?view=new");
    first.element().focus();

    await userEvent.keyboard("{Enter}");

    await expect
      .poll(() => tableOf(screen).getByRole("rowheader").elements().length)
      .toBe(20);
    expect(router.state.location.href).toBe("/tickets?view=new");
    // The link left the page with the empty state.
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toHaveFocus();
  });

  test("moves the focus to the heading when the read of the next page fails, which removes the pagination", async () => {
    stubTickets({
      list: (query) =>
        query.get("page") === "2"
          ? errorResponse(503, "DATABASE_UNAVAILABLE")
          : pageOf(query),
    });
    const { screen } = await renderApp("/tickets?view=new");
    const next = screen
      .getByRole("navigation", { name: "Pagination" })
      .getByRole("link", { name: "Next" });
    await expect.element(next).toBeVisible();
    next.element().focus();

    await userEvent.keyboard("{Enter}");

    await expect
      .element(
        screen.getByText(
          "Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("navigation", { name: "Pagination" }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toHaveFocus();
  });

  test.each([
    ["on its first page", "?view=unassigned", 1],
    ["on any other page", "?view=unassigned&page=3", 3],
  ])("shows that a view has no Tickets %s", async (_, search, pageNumber) => {
    stubTickets({ list: () => ticketPage([], { page: pageNumber }) });
    const { screen } = await renderApp(`/tickets${search}`);

    await expect
      .element(screen.getByText("No Tickets in this view."))
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Go to the first page" }))
      .not.toBeInTheDocument();
    await expect
      .element(tableOf(screen).getByRole("columnheader", { name: "Ticket" }))
      .toBeVisible();
  });
});

describe("loading and errors", () => {
  test("show the heading, the views, and the header row at once, and the loading indicator inside the frame", async () => {
    const pending = later();
    stubTickets({ list: () => pending.promise });
    const { screen } = await renderApp("/tickets?view=new");

    await expect
      .element(screen.getByRole("tab", { name: "New 12" }))
      .toBeVisible();
    await expect
      .element(tableOf(screen).getByRole("columnheader", { name: "Ticket" }))
      .toBeVisible();
    const indicator = screen.getByRole("progressbar", { name: "Loading" });
    await expect.element(indicator).toBeVisible();
    expect(frameOf(screen).contains(indicator.element())).toBe(true);

    pending.resolve(ticketPage([ROW]));
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-1" }))
      .toBeVisible();
  });

  test("keep the rows of the previous view, marked as being updated, while another view loads", async () => {
    const pending = later();
    stubTickets({
      list: (query) =>
        filtersOf(query) === FILTERS.Analysis
          ? pending.promise
          : ticketPage([ROW]),
    });
    const { screen } = await renderApp("/tickets?view=new");
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-1" }))
      .toBeVisible();

    await screen.getByRole("tab", { name: /^Analysis/ }).click();

    await expect
      .element(screen.getByRole("progressbar", { name: "Updating" }))
      .toBeVisible();
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-1" }))
      .toBeVisible();

    pending.resolve(ticketPage([fictionalTicket({ ticket_id: "SNTL-9" })]));
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-9" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("progressbar", { name: "Updating" }))
      .not.toBeInTheDocument();
  });

  test("show the error of the first read in place of the screen", async () => {
    stubTickets({ list: () => errorResponse(503, "DATABASE_UNAVAILABLE") });
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/tickets"] }),
    });
    const screen = await render(<App router={router} queryClient={client} />);

    await expect
      .element(
        screen.getByRole("heading", {
          level: 1,
          name: "This page couldn't be loaded",
        }),
      )
      .toBeVisible();
    await expect.element(screen.getByRole("tablist")).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toBeVisible();
  });

  test("show the error of the read of another view in place of its rows, inside the frame, and keep the views", async () => {
    stubTickets({
      list: (query) =>
        filtersOf(query) === FILTERS.Analysis
          ? errorResponse(503, "DATABASE_UNAVAILABLE")
          : ticketPage([ROW]),
    });
    const { screen } = await renderApp("/tickets?view=new");
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-1" }))
      .toBeVisible();

    await screen.getByRole("tab", { name: /^Analysis/ }).click();

    const message = screen.getByText(
      "Sentinel isn't available right now. Try again later.",
    );
    await expect.element(message).toBeVisible();
    expect(frameOf(screen).contains(message.element())).toBe(true);
    expect(message.element().closest("output")).not.toBeNull();
    await expect
      .element(tableOf(screen).getByRole("rowheader"))
      .not.toBeInTheDocument();
    await expect
      .element(tableOf(screen).getByRole("columnheader", { name: "Ticket" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("tab", { name: "Analysis 5" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toBeVisible();
  });
});
