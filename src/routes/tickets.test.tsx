import { focusManager, type QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import type {
  AssignmentEligibility,
  Capability,
  CurrentUserData,
  CurrentUserResponse,
  TicketSummary,
} from "../api/generated/model";
import { getListTicketsQueryKey } from "../api/generated/tickets";
import { formatDateTime } from "../components/date-time";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import { screenshot, type Screenshot } from "../test-screenshot";
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

// A user who holds the vulnerability_analyst role and can be the assignee of
// every Ticket, and one who holds no role and can be the assignee of none.
const ANALYST: CurrentUserResponse = OTHER_USER;
const READER: CurrentUserResponse = FICTIONAL_USER;

// The provenance of a priority override, which Sentinel states exactly when an
// override is set (Sentinel docs/features/tickets/ticket-priority.md,
// Persistence and Effective Priority): the user who set it and when.
const OVERRIDE_BY: NonNullable<TicketSummary["priority_override_by"]> = {
  id: "00000000-0000-0000-0000-000000000003",
  username: "asmith",
  full_name: "Alice Smith",
  active: true,
  bot: false,
};
const OVERRIDE_AT = "2099-10-09T15:05:09Z";

// An assignment eligibility and a capability that the pinned contract does
// not list, which a later Sentinel release can return.
const UNLISTED_ELIGIBILITY = "fictional_eligibility";
const UNLISTED_CAPABILITY = "fictional_capability";

// Get Current User's response, with a listed assignment eligibility or the
// unlisted one, and with listed capabilities or the unlisted one.
interface UserResponse {
  data: Omit<CurrentUserData, "assignment_eligibility" | "capabilities"> & {
    assignment_eligibility: AssignmentEligibility | typeof UNLISTED_ELIGIBILITY;
    capabilities: (Capability | typeof UNLISTED_CAPABILITY)[];
  };
}

// The user with another assignment eligibility.
function withEligibility(
  user: UserResponse,
  eligibility: AssignmentEligibility | typeof UNLISTED_ELIGIBILITY,
): UserResponse {
  return { data: { ...user.data, assignment_eligibility: eligibility } };
}

// The user with other capabilities.
function withCapabilities(
  user: UserResponse,
  capabilities: (Capability | typeof UNLISTED_CAPABILITY)[],
): UserResponse {
  return { data: { ...user.data, capabilities } };
}

// An analyst who also holds manage_confidentiality, as the
// vulnerability_analyst role grants it (Sentinel
// docs/features/identity/rbac.md, Predefined Roles), and so is shown the
// Embargo view and the Embargo expired count.
const EMBARGO_ANALYST = withCapabilities(ANALYST, [
  "manage_confidentiality",
  "triage_ticket",
]);

// The filters of the views, as the requests send them, for the analyst.
const FILTERS = {
  New: "status=new",
  Unassigned: "status=analysis&status=analyzed&assignee=none",
  Analysis: "status=analysis",
  Analyzed: "status=analyzed",
  All: "",
  "Assigned to me": `assignee=${ANALYST.data.id}&status=analysis&status=analyzed`,
};

// The filters of the counts of the attention summary, as the requests send
// them.
const ATTENTION = {
  "Active P1": "priority=p1&status=new&status=analysis&status=analyzed",
  "Triage overdue": "current_phase=triage&overdue=triage",
  "Submission overdue": "current_phase=submission&overdue=submission",
  "UM overdue": "current_phase=um&overdue=um",
  "QA overdue": "current_phase=qa&overdue=qa",
};

// The filters of the Embargo view, and of the Embargo expired count, as the
// requests send them.
const EMBARGO = "is_confidential=true";
const EXPIRED = `${EMBARGO}&coordinated_release_passed=true`;

// The sorting of the queues: by priority, then by the due date of the
// current phase.
const QUEUE_SORT = "sort_by=priority_then_current_due";
// The sorting of the All view, and the read of its first page.
const ALL_SORT = "sort_by=updated_at&sort_order=desc";
const ALL_PAGE = `${ALL_SORT}&page=1&per_page=20`;
// The sorting of the Embargo view, by Coordinated Release Date, earliest
// first, and the read of its first page.
const EMBARGO_SORT = "sort_by=coordinated_release_at&sort_order=asc";
const EMBARGO_PAGE = `${EMBARGO_SORT}&page=1&per_page=20`;

// The number of Tickets of each view and of each count of the attention
// summary in the tests, by its filters.
const TOTALS = new Map([
  [FILTERS.New, 12],
  [FILTERS.Unassigned, 1],
  [FILTERS.Analysis, 5],
  [FILTERS.Analyzed, 3],
  [FILTERS.All, 1250],
  [FILTERS["Assigned to me"], 4],
  [EMBARGO, 3],
  [ATTENTION["Active P1"], 2],
  [EXPIRED, 1],
  [ATTENTION["Triage overdue"], 1],
  [ATTENTION["Submission overdue"], 0],
  [ATTENTION["UM overdue"], 1],
  [ATTENTION["QA overdue"], 3],
]);

// The request of a count, by its filters.
function countQuery(filters: string): string {
  return filters === "" ? "per_page=1" : `${filters}&per_page=1`;
}

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
  // Before the responses go, so that the screen of the test reads nothing
  // more.
  await cleanup();
  client.clear();
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
  document.title = "Sentinel";
  await page.viewport(414, 896);
});

interface Stub {
  // The signed-in user, which a test can change.
  user: UserResponse;
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

// The gap between two tabs: the right edge of one, the left edge of the next,
// and the middle of their height.
interface Gap {
  from: number;
  to: number;
  middle: number;
}

// The number of columns in border, the color of the line of a group of views
// in the light theme, along the middle of a gap of a screenshot of the tabs
// whose box is origin, away from the borders of the tabs.
function borderColumnsIn(
  picture: Screenshot,
  origin: DOMRect,
  { from, to, middle }: Gap,
): number {
  return Array.from({ length: Math.round(to - from) - 4 }, (_, offset) =>
    picture.at(from + 2 - origin.left + offset + 0.5, middle - origin.top),
  ).filter((color) => color === "#d8dee4").length;
}

describe("the views", () => {
  test("show to an analyst the heading and the six views, in their order, with their counts", async () => {
    stubTickets();
    const { screen } = await renderApp("/tickets?view=new");

    await expectTabs(screen, [
      "New 12",
      "Unassigned 1",
      "Analysis 5",
      "Analyzed 3",
      "All 1,250",
      "Assigned to me 4",
    ]);
    expect(document.title).toBe("Tickets – Sentinel");
    await expect
      .element(screen.getByRole("tab", { name: "New 12" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(screen.getByRole("tabpanel", { name: "New 12" }))
      .toBeVisible();
  });

  test("show Assigned to me to a user who can be the assignee of the non-confidential Tickets alone", async () => {
    stubTickets({ user: withEligibility(READER, "non_confidential") });
    const { screen } = await renderApp("/tickets");

    await expectTabs(screen, [
      "New 12",
      "Unassigned 1",
      "Analysis 5",
      "Analyzed 3",
      "All 1,250",
      "Assigned to me 0",
    ]);
  });

  test.each([
    ["holds no role and can be the assignee of no Ticket", READER],
    [
      "holds the vulnerability_analyst role as a bot account, which can be the assignee of no Ticket",
      withEligibility({ data: { ...ANALYST.data, bot: true } }, "none"),
    ],
    [
      "has an assignment eligibility that the pinned contract does not list",
      withEligibility(ANALYST, UNLISTED_ELIGIBILITY),
    ],
  ])("show no Assigned to me to a user who %s", async (_, user) => {
    stubTickets({ user });
    const { screen } = await renderApp("/tickets");

    await expectTabs(screen, [
      "New 12",
      "Unassigned 1",
      "Analysis 5",
      "Analyzed 3",
      "All 1,250",
    ]);
    await expect
      .element(screen.getByRole("tab", { name: "All 1,250" }))
      .toHaveAttribute("aria-selected", "true");
  });

  test.each([
    [
      "an analyst who holds manage_confidentiality, after Assigned to me",
      EMBARGO_ANALYST,
      ["Assigned to me 4", "Embargo 3"],
    ],
    [
      "a user who holds manage_confidentiality with a capability that the pinned contract does not list",
      withCapabilities(ANALYST, [
        UNLISTED_CAPABILITY,
        "manage_confidentiality",
        "triage_ticket",
      ]),
      ["Assigned to me 4", "Embargo 3"],
    ],
    [
      "a bot account that holds manage_confidentiality and can be the assignee of no Ticket, after All",
      withEligibility(
        withCapabilities(
          { data: { ...ANALYST.data, bot: true } },
          EMBARGO_ANALYST.data.capabilities,
        ),
        "none",
      ),
      ["Embargo 3"],
    ],
  ])("show Embargo last to %s, with its count", async (_, user, last) => {
    const { spy } = stubTickets({ user });
    const { screen } = await renderApp("/tickets?view=new");

    await expectTabs(screen, [
      "New 12",
      "Unassigned 1",
      "Analysis 5",
      "Analyzed 3",
      "All 1,250",
      ...last,
    ]);
    await expect
      .element(screen.getByRole("tab", { name: "Embargo 3" }))
      .toHaveAttribute("href", "/tickets?view=embargo");
    expect(queriesOf(spy, "count")).toContain(countQuery(EMBARGO));
  });

  test.each([
    ["holds triage_ticket alone", ANALYST],
    [
      "holds a capability that the pinned contract does not list, without manage_confidentiality",
      withCapabilities(ANALYST, [UNLISTED_CAPABILITY, "triage_ticket"]),
    ],
  ])(
    "show no Embargo, and read no embargo, to a user who %s",
    async (_, user) => {
      const { spy } = stubTickets({ user });
      const { screen } = await renderApp("/tickets?view=new");

      await expectTabs(screen, [
        "New 12",
        "Unassigned 1",
        "Analysis 5",
        "Analyzed 3",
        "All 1,250",
        "Assigned to me 4",
      ]);
      await expectSummary(screen);
      expect(
        [...queriesOf(spy, "count"), ...queriesOf(spy, "list")].filter(
          (query) => query.includes("is_confidential"),
        ),
      ).toEqual([]);
    },
  );

  test("read Embargo with its filter, sorted by Coordinated Release Date in ascending order, and its page of 20", async () => {
    const { spy } = stubTickets({ user: EMBARGO_ANALYST });
    const { screen } = await renderApp("/tickets?view=embargo");

    await expect
      .poll(() => queriesOf(spy, "list"))
      .toEqual([`${EMBARGO}&${EMBARGO_PAGE}`]);
    await expect
      .element(screen.getByRole("tab", { name: "Embargo 3" }))
      .toHaveAttribute("aria-selected", "true");
  });

  test.each([
    ["New", "?view=new", `${FILTERS.New}&${QUEUE_SORT}`],
    ["Unassigned", "?view=unassigned", `${FILTERS.Unassigned}&${QUEUE_SORT}`],
    ["Analysis", "?view=analysis", `${FILTERS.Analysis}&${QUEUE_SORT}`],
    ["Analyzed", "?view=analyzed", `${FILTERS.Analyzed}&${QUEUE_SORT}`],
    ["All", "", "sort_by=updated_at"],
    [
      "Assigned to me",
      "?view=assigned-to-me",
      `${FILTERS["Assigned to me"]}&${QUEUE_SORT}`,
    ],
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

  test("count each view with its filters alone, from a read of one Ticket, whatever the user refined", async () => {
    const { spy } = stubTickets();
    const { screen } = await renderApp(
      "/tickets?view=analysis&search=curl&severity=high&sort=deadline&page=2",
    );
    await expectTabs(screen, [
      "New 12",
      "Unassigned 1",
      "Analysis 5",
      "Analyzed 3",
      "All 1,250",
      "Assigned to me 4",
    ]);

    // With the counts of the attention summary, once each.
    expect(queriesOf(spy, "count").toSorted()).toEqual(
      [...Object.values(FILTERS), ...Object.values(ATTENTION)]
        .map(countQuery)
        .toSorted(),
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
      "Unassigned 1",
      "Analysis 5",
      "Analyzed 3",
      "All 1,250",
      "Assigned to me 4",
    ]);

    await screen.getByRole("tab", { name: "Unassigned 1" }).click();
    await expect
      .element(screen.getByRole("tab", { name: "Unassigned 1" }))
      .toHaveAttribute("aria-selected", "true");
    expect(router.state.location.href).toBe("/tickets?view=unassigned");

    // The arrow keys cross the line that sets the views apart.
    await userEvent.keyboard("{ArrowRight}");
    const analysis = screen.getByRole("tab", { name: "Analysis 5" });
    await expect.element(analysis).toHaveFocus();
    expect(router.state.location.href).toBe("/tickets?view=unassigned");

    await userEvent.keyboard("{Enter}");
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=analysis");
    await expect.element(analysis).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard(" ");
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=analyzed");
    await expect
      .element(screen.getByRole("tab", { name: "Analyzed 3" }))
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
      "/tickets?view=unassigned",
      "/tickets?view=analysis",
      "/tickets?view=analyzed",
      "/tickets",
      "/tickets?view=assigned-to-me",
    ]);
  });

  test.each([
    [
      "an analyst",
      ANALYST,
      [
        "New 12",
        "Unassigned 1",
        "Analysis 5",
        "Analyzed 3",
        "All 1,250",
        "Assigned to me 4",
      ],
    ],
    [
      "a user who is not shown Assigned to me",
      READER,
      ["New 12", "Unassigned 1", "Analysis 5", "Analyzed 3", "All 1,250"],
    ],
    [
      "a user who is shown Embargo",
      EMBARGO_ANALYST,
      [
        "New 12",
        "Unassigned 1",
        "Analysis 5",
        "Analyzed 3",
        "All 1,250",
        "Assigned to me 4",
        "Embargo 3",
      ],
    ],
  ])(
    "set New and Unassigned apart from the other views for %s, with a line before Analysis alone",
    async (_, user, names) => {
      stubTickets({ user });
      const { screen } = await renderApp("/tickets?view=new");
      // Once every count has arrived and the font has loaded, which widen
      // the tabs.
      await expectTabs(screen, names);
      await document.fonts.ready;
      const boxes = tabsOf(screen)
        .elements()
        .map((tab) => tab.getBoundingClientRect());
      // The gaps between the tabs, each after the tab of its index.
      const gaps = boxes.slice(1).map((box, index) => ({
        from: boxes[index]!.right,
        to: box.left,
        middle: box.top + box.height / 2,
      }));
      // Only the gap before Analysis, the third tab, holds the line.
      const lined = [...gaps.keys()].map((index) => index === 1);

      // 25 px between Unassigned and Analysis, around the line, and 8 px
      // between the other tabs.
      expect(gaps.map(({ from, to }) => Math.round(to - from))).toEqual(
        lined.map((line) => (line ? 25 : 8)),
      );
      // The columns of border within each gap, away from the borders of the
      // tabs: one for the line, none elsewhere.
      const tabs = screen.getByRole("tablist", { name: "Views" });
      const picture = await screenshot(tabs);
      const origin = tabs.element().getBoundingClientRect();
      expect(gaps.map((gap) => borderColumnsIn(picture, origin, gap))).toEqual(
        lined.map((line) => (line ? 1 : 0)),
      );
    },
  );

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

  test("reads the count of a view that opens while the list of another view loads", async () => {
    const pending = later();
    const { spy } = stubTickets({
      list: (query) =>
        filtersOf(query) === FILTERS.Analysis
          ? pending.promise
          : ticketPage([ROW]),
    });
    const { screen } = await renderApp("/tickets?view=new");
    await expect
      .element(screen.getByRole("tab", { name: "Analyzed 3" }))
      .toBeVisible();
    const countsOf = (filters: string) =>
      queriesOf(spy, "count").filter(
        (query) => query === `${filters}&per_page=1`,
      ).length;

    await screen.getByRole("tab", { name: /^Analysis/ }).click();
    await expect
      .element(screen.getByRole("progressbar", { name: "Updating" }))
      .toBeVisible();
    await screen.getByRole("tab", { name: /^Analyzed/ }).click();

    await expect.poll(() => countsOf(FILTERS.Analyzed)).toBe(2);
    expect(countsOf(FILTERS.Unassigned)).toBe(1);
    pending.resolve(ticketPage([ROW]));
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
        tableOf(screen).getByRole("columnheader", { name: "Last modified" }),
      )
      .toHaveAttribute("aria-sort", "descending");
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
      .element(tableOf(screen).getByRole("columnheader", { name: "Priority" }))
      .toHaveAttribute("aria-sort", "descending");
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
  const NEW = `${FILTERS.New}&${QUEUE_SORT}&sort_order=desc&page=1&per_page=20`;
  const ALL = ALL_PAGE;

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
    ["a page with a leading zero", "?page=02", "/tickets", ALL],
    [
      "a status filter outside the All view",
      "?view=new&status=resolved",
      "/tickets?view=new",
      NEW,
    ],
    [
      "a sorting by a column that the view does not show, with its order",
      "?view=new&sort=last-modified&order=asc",
      "/tickets?view=new",
      NEW,
    ],
    [
      "an embargo filter outside the Embargo view",
      "?view=new&embargo=expired",
      "/tickets?view=new",
      NEW,
    ],
    [
      "a sorting by Coordinated Release Date outside the Embargo view, with its order",
      "?sort=coordinated-release-date&order=desc",
      "/tickets",
      ALL,
    ],
    [
      "an unknown sorting, with its order",
      "?sort=created_at&order=asc",
      "/tickets",
      ALL,
    ],
    ["an unknown order", "?order=up", "/tickets", ALL],
    ["a repeated sorting", "?sort=ticket&sort=status", "/tickets", ALL],
    ["a repeated order", "?order=asc&order=desc", "/tickets", ALL],
    ["a repeated search", "?search=curl&search=ssl", "/tickets", ALL],
    [
      "a search of more than 500 characters",
      `?search=${"a".repeat(501)}`,
      "/tickets",
      ALL,
    ],
    ["a search with U+0000", "?search=cu%00rl", "/tickets", ALL],
    ["a search of whitespace", "?search=%20%20", "/tickets", ALL],
    [
      "the values of a filter that it does not know",
      "?severity=fictional&priority=P1",
      "/tickets",
      ALL,
    ],
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

  test.each([
    [
      "a search without its surrounding whitespace",
      "?search=%20fictional-curl%20",
      "/tickets?search=fictional-curl",
      `search=fictional-curl&${ALL}`,
    ],
    [
      "the values of a filter once each, in the order of the contract, without those that it does not know",
      "?severity=high&severity=fictional&severity=critical&severity=high",
      "/tickets?severity=critical&severity=high",
      `severity=critical&severity=high&${ALL}`,
    ],
    [
      "the list without the first page",
      "?view=new&page=1",
      "/tickets?view=new",
      NEW,
    ],
    [
      "the list without the sorting of the view",
      "?view=new&sort=priority",
      "/tickets?view=new",
      NEW,
    ],
    [
      "the list without the first direction of the sorting of the view",
      "?order=desc",
      "/tickets",
      ALL,
    ],
    [
      "the list without the first direction of a sorting",
      "?sort=deadline&order=asc",
      "/tickets?sort=deadline",
      "sort_by=current_due_at&sort_order=asc&page=1&per_page=20",
    ],
    [
      "the list with the other direction of the sorting of the view alone",
      "?view=new&sort=priority&order=asc",
      "/tickets?view=new&order=asc",
      `${FILTERS.New}&${QUEUE_SORT}&sort_order=asc&page=1&per_page=20`,
    ],
  ])("leads to %s, in place of the URL", async (_, search, accepted, read) => {
    const { spy } = stubTickets();
    const { router } = await renderApp(`/tickets${search}`);

    await expect.poll(() => router.state.location.href).toBe(accepted);
    expect(router.history.length).toBe(1);
    expect(queriesOf(spy, "list")).toEqual([read]);
  });

  test("keeps every parameter that it accepts, in their order, and sends them to List Tickets", async () => {
    const { spy } = stubTickets();
    const search =
      "?page=2&order=desc&sort=deadline&overdue=um&phase=um&phase=qa&priority=p1&severity=high&search=fictional-curl&view=analysis";
    const { router } = await renderApp(`/tickets${search}`);

    await expect
      .poll(() => queriesOf(spy, "list"))
      .toEqual([
        `${FILTERS.Analysis}&search=fictional-curl&severity=high&priority=p1&current_phase=um&current_phase=qa&overdue=um&sort_by=current_due_at&sort_order=desc&page=2&per_page=20`,
      ]);
    expect(router.state.location.href).toBe(`/tickets${search}`);
    expect(router.history.length).toBe(1);
  });

  test("keeps a search of 500 characters", async () => {
    const { spy } = stubTickets();
    const term = "a".repeat(500);
    const { router } = await renderApp(`/tickets?search=${term}`);

    await expect
      .poll(() => queriesOf(spy, "list"))
      .toEqual([`search=${term}&${ALL}`]);
    expect(router.state.location.href).toBe(`/tickets?search=${term}`);
  });

  test("keeps the status filter in the All view", async () => {
    const { spy } = stubTickets();
    const { router } = await renderApp(
      "/tickets?status=resolved&status=ignored",
    );

    await expect
      .poll(() => queriesOf(spy, "list"))
      .toEqual([`status=resolved&status=ignored&${ALL}`]);
    expect(router.state.location.href).toBe(
      "/tickets?status=resolved&status=ignored",
    );
  });

  test("keeps the status and the embargo filters in the Embargo view, without a state of an embargo that it does not know, and sends them to List Tickets", async () => {
    const { spy } = stubTickets({ user: EMBARGO_ANALYST });
    const { router } = await renderApp(
      "/tickets?view=embargo&status=resolved&embargo=running&embargo=expired",
    );

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=embargo&status=resolved&embargo=expired");
    expect(router.history.length).toBe(1);
    await expect
      .poll(() => queriesOf(spy, "list"))
      .toEqual([`${EXPIRED}&status=resolved&${EMBARGO_PAGE}`]);
  });

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

  test("opens the All view for a user who is not shown Embargo, and drops the view with the parameters that the All view does not accept", async () => {
    const { spy } = stubTickets();
    const { router, screen } = await renderApp(
      "/tickets?view=embargo&embargo=expired&status=analysis&order=desc&page=2",
    );

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?status=analysis&page=2");
    expect(router.history.length).toBe(1);
    await expect
      .element(screen.getByRole("tab", { name: /^All/ }))
      .toHaveAttribute("aria-selected", "true");
    expect(queriesOf(spy, "list")).toEqual([
      "status=analysis&sort_by=updated_at&sort_order=desc&page=2&per_page=20",
    ]);
  });

  test("drops Embargo, with its filter, when a read of the signed-in user tells that the user no longer holds manage_confidentiality, and moves the focus from its tab to the heading", async () => {
    const { stub } = stubTickets({ user: EMBARGO_ANALYST });
    const { router, screen } = await renderApp(
      "/tickets?view=embargo&embargo=expired",
    );
    const tab = screen.getByRole("tab", { name: "Embargo 3" });
    await expect.element(tab).toHaveAttribute("aria-selected", "true");
    tab.element().focus();

    stub.user = ANALYST;
    returnToForeground();

    await expect.poll(() => router.state.location.href).toBe("/tickets");
    await expect
      .element(screen.getByRole("tab", { name: /^Embargo/ }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("tab", { name: /^All/ }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toHaveFocus();
  });

  test("drops Assigned to me when a read of the signed-in user tells that the user can no longer be the assignee of a Ticket, and moves the focus from its tab to the heading", async () => {
    const { stub } = stubTickets();
    const { router, screen } = await renderApp("/tickets?view=assigned-to-me");
    const tab = screen.getByRole("tab", { name: "Assigned to me 4" });
    await expect.element(tab).toHaveAttribute("aria-selected", "true");
    tab.element().focus();

    stub.user = withEligibility(ANALYST, "none");
    returnToForeground();

    await expect.poll(() => router.state.location.href).toBe("/tickets");
    await expect
      .element(screen.getByRole("tab", { name: /^Assigned to me/ }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("tab", { name: /^All/ }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toHaveFocus();
  });
});

describe("a change of the assignment eligibility", () => {
  test("keeps the focus on a tab that stays when a read of the signed-in user tells that the user can be the assignee of a Ticket", async () => {
    const { stub } = stubTickets({ user: READER });
    const { router, screen } = await renderApp("/tickets?view=new");
    const fresh = screen.getByRole("tab", { name: "New 12" });
    await expect.element(fresh).toBeVisible();
    fresh.element().focus();

    // The same user, who can now be the assignee of the non-confidential
    // Tickets.
    stub.user = withEligibility(READER, "non_confidential");
    returnToForeground();

    await expect
      .element(screen.getByRole("tab", { name: /^Assigned to me/ }))
      .toBeVisible();
    await expect.element(fresh).toHaveFocus();
    expect(router.state.location.href).toBe("/tickets?view=new");
  });

  test("keeps the focus on a row that stays when a read of the signed-in user tells that the user can no longer be the assignee of a Ticket", async () => {
    const { stub } = stubTickets();
    const { screen } = await renderApp("/tickets");
    const link = tableOf(screen).getByRole("link", { name: "SNTL-1" });
    await expect.element(link).toBeVisible();
    link.element().focus();

    stub.user = withEligibility(ANALYST, "none");
    returnToForeground();

    await expect
      .element(screen.getByRole("tab", { name: /^Assigned to me/ }))
      .not.toBeInTheDocument();
    await expect.element(link).toHaveFocus();
  });
});

describe("a change of manage_confidentiality", () => {
  test("shows Embargo and Embargo expired, and keeps the focus on a tab that stays, when a read of the signed-in user tells that the user holds manage_confidentiality", async () => {
    const { stub } = stubTickets();
    const { router, screen } = await renderApp("/tickets?view=new");
    const fresh = screen.getByRole("tab", { name: "New 12" });
    await expect.element(fresh).toBeVisible();
    fresh.element().focus();

    stub.user = EMBARGO_ANALYST;
    returnToForeground();

    await expect
      .element(screen.getByRole("tab", { name: "Embargo 3" }))
      .toBeVisible();
    await expect
      .element(
        summaryOf(screen).getByRole("link", { name: "1 Embargo expired" }),
      )
      .toBeVisible();
    await expect.element(fresh).toHaveFocus();
    expect(router.state.location.href).toBe("/tickets?view=new");
  });
});

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
      },
      cve: {
        cve_id: "CVE-2099-0018",
        title: "Fictional authentication bypass",
        description: null,
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
    expect(dialog.element().textContent).toContain("Set byAlice SmithSet on");
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

    returnToForeground();

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
      `${FILTERS.New}&${QUEUE_SORT}&sort_order=desc&page=2&per_page=20`,
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

function searchFieldOf(screen: Screen) {
  return screen.getByRole("searchbox", { name: "Search Tickets" });
}

describe("the search", () => {
  test("applies a term with Enter, without its surrounding whitespace, at the first page of the view, as a new entry of the browser history", async () => {
    const { spy } = stubTickets();
    const { router, screen } = await renderApp("/tickets?view=new&page=2");
    const field = searchFieldOf(screen);

    await field.fill("  fictional-curl ");
    await userEvent.keyboard("{Enter}");

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=new&search=fictional-curl");
    expect(router.history.length).toBe(2);
    await expect.element(field).toHaveValue("fictional-curl");
    await expect
      .poll(() => queriesOf(spy, "list").at(-1))
      .toBe(
        `${FILTERS.New}&search=fictional-curl&${QUEUE_SORT}&sort_order=desc&page=1&per_page=20`,
      );
  });

  test.each([
    [
      "its clear button",
      async (screen: Screen) => {
        await screen.getByRole("button", { name: "Clear search" }).click();
      },
    ],
    [
      "Escape",
      async (screen: Screen) => {
        // Away from the clear button, where an earlier test can leave the
        // pointer: Escape would first hide its tooltip.
        await screen
          .getByRole("heading", { level: 1, name: "Tickets" })
          .hover();
        await expect
          .element(screen.getByRole("tooltip"))
          .not.toBeInTheDocument();
        searchFieldOf(screen).element().focus();
        await userEvent.keyboard("{Escape}");
      },
    ],
  ])("removes the term with %s", async (_, remove) => {
    const { spy } = stubTickets();
    const { router, screen } = await renderApp(
      "/tickets?view=new&search=curl&page=2",
    );
    await expect.element(searchFieldOf(screen)).toHaveValue("curl");

    await remove(screen);

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=new");
    await expect.element(searchFieldOf(screen)).toHaveValue("");
    expect(queriesOf(spy, "list").at(-1)).toBe(
      `${FILTERS.New}&${QUEUE_SORT}&sort_order=desc&page=1&per_page=20`,
    );
  });

  test("shows the term that applies when the URL changes, as with back", async () => {
    stubTickets();
    const { router, screen } = await renderApp("/tickets");
    const field = searchFieldOf(screen);
    await expect.element(field).toHaveValue("");

    router.history.push("/tickets?search=curl");
    await expect.element(field).toHaveValue("curl");

    router.history.back();
    await expect.element(field).toHaveValue("");
  });

  test("accepts at most 500 characters", async () => {
    stubTickets();
    const { screen } = await renderApp("/tickets");

    await expect
      .element(searchFieldOf(screen))
      .toHaveAttribute("maxlength", "500");
  });
});

// Opens the popover of the filters, and returns it.
async function openFilters(screen: Screen) {
  await screen.getByRole("button", { name: /^Filters/ }).click();
  const dialog = screen.getByRole("dialog", { name: "Filters" });
  await expect.element(dialog).toBeVisible();
  return dialog;
}

// The checkbox of a value of a filter in the popover of the filters.
function optionOf(dialog: Locator, filter: string, value: string) {
  return dialog
    .getByRole("group", { name: filter })
    .getByRole("checkbox", { name: value });
}

// Checks or unchecks a value of a filter, with a click on its name, as its
// box covers its input.
async function toggle(dialog: Locator, filter: string, value: string) {
  await dialog
    .getByRole("group", { name: filter })
    .getByText(value, { exact: true })
    .click();
}

describe("the filters", () => {
  // The filters of every view, with the names of their values.
  const FILTER_VALUES = [
    ["Severity", ["Critical", "High", "Medium", "Low", "None", "Not set"]],
    ["Priority", ["P1", "P2", "P3", "P4", "Not set"]],
    ["Current phase", ["Triage", "Submission", "UM", "QA", "Done"]],
    ["Overdue", ["Triage", "Submission", "UM", "QA"]],
  ] as const;
  const STATUS_VALUES = [
    "Status",
    ["New", "Analysis", "Analyzed", "Resolved", "Ignored", "Duplicated"],
  ] as const;
  const EMBARGO_VALUES = ["Embargo", ["Expired"]] as const;

  test.each([
    ["the All view", "", [STATUS_VALUES, ...FILTER_VALUES], "New"],
    [
      "a queue, without the status filter",
      "?view=new",
      FILTER_VALUES,
      "Critical",
    ],
    [
      "the Embargo view, with the status and the embargo filters",
      "?view=embargo",
      [STATUS_VALUES, EMBARGO_VALUES, ...FILTER_VALUES],
      "New",
    ],
  ])(
    "offer in %s their values, and move the focus to the first",
    async (_, search, filters, first) => {
      stubTickets({ user: EMBARGO_ANALYST });
      const { screen } = await renderApp(`/tickets${search}`);

      const dialog = await openFilters(screen);

      const groups = dialog.getByRole("group");
      expect(groups.elements()).toHaveLength(filters.length);
      for (const [index, [name, values]] of filters.entries()) {
        await expect.element(groups.nth(index)).toHaveAccessibleName(name);
        const boxes = groups.nth(index).getByRole("checkbox");
        expect(boxes.elements()).toHaveLength(values.length);
        for (const [position, value] of values.entries()) {
          await expect.element(boxes.nth(position)).toHaveAccessibleName(value);
          await expect.element(boxes.nth(position)).not.toBeChecked();
        }
      }
      await expect
        .element(groups.first().getByRole("checkbox", { name: first }))
        .toHaveFocus();
    },
  );

  test.each([
    ["Status", "Resolved", "status=resolved", "status=resolved"],
    ["Severity", "Not set", "severity=unresolved", "severity=unresolved"],
    ["Priority", "P1", "priority=p1", "priority=p1"],
    ["Current phase", "UM", "phase=um", "current_phase=um"],
    ["Overdue", "QA", "overdue=qa", "overdue=qa"],
  ])(
    "apply %s %s at once, at the first page, as a new entry of the browser history",
    async (filter, value, parameter, read) => {
      const { spy } = stubTickets();
      const { router, screen } = await renderApp("/tickets?page=2");
      const dialog = await openFilters(screen);

      await toggle(dialog, filter, value);

      await expect
        .poll(() => router.state.location.href)
        .toBe(`/tickets?${parameter}`);
      expect(router.history.length).toBe(2);
      await expect
        .poll(() => queriesOf(spy, "list").at(-1))
        .toBe(`${read}&${ALL_PAGE}`);
      // The popover stays, with the value checked.
      await expect.element(optionOf(dialog, filter, value)).toBeChecked();
    },
  );

  test("apply Embargo Expired at once in the Embargo view, at the first page, and count it among the filters that apply", async () => {
    const { spy } = stubTickets({ user: EMBARGO_ANALYST });
    const { router, screen } = await renderApp("/tickets?view=embargo&page=2");
    const dialog = await openFilters(screen);

    await toggle(dialog, "Embargo", "Expired");

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=embargo&embargo=expired");
    expect(router.history.length).toBe(2);
    await expect
      .poll(() => queriesOf(spy, "list").at(-1))
      .toBe(`${EXPIRED}&${EMBARGO_PAGE}`);
    await expect.element(optionOf(dialog, "Embargo", "Expired")).toBeChecked();

    await userEvent.keyboard("{Escape}");
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toHaveFocus();
  });

  test("keep the values of a filter in the order of the contract, count the filters that apply, and remove a filter without values", async () => {
    const { spy } = stubTickets();
    const { router, screen } = await renderApp("/tickets?view=new");
    const dialog = await openFilters(screen);

    await toggle(dialog, "Severity", "High");
    await toggle(dialog, "Severity", "Critical");
    await toggle(dialog, "Priority", "P2");

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=new&severity=critical&severity=high&priority=p2");
    await expect
      .poll(() => queriesOf(spy, "list").at(-1))
      .toBe(
        `${FILTERS.New}&severity=critical&severity=high&priority=p2&${QUEUE_SORT}&sort_order=desc&page=1&per_page=20`,
      );

    await toggle(dialog, "Severity", "High");
    await toggle(dialog, "Severity", "Critical");
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=new&priority=p2");

    // Escape closes the popover, and the focus returns to Filters.
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toHaveFocus();
  });

  test("show the values that apply as checked", async () => {
    stubTickets();
    const { screen } = await renderApp(
      "/tickets?status=new&severity=none&phase=done&overdue=triage",
    );
    await expect
      .element(screen.getByRole("button", { name: "Filters 4 applied" }))
      .toBeVisible();

    const dialog = await openFilters(screen);

    expect(
      dialog
        .getByRole("checkbox")
        .elements()
        .filter((box) => box instanceof HTMLInputElement && box.checked),
    ).toHaveLength(4);
    for (const [filter, value] of [
      ["Status", "New"],
      ["Severity", "None"],
      ["Current phase", "Done"],
      ["Overdue", "Triage"],
    ] as const) {
      await expect.element(optionOf(dialog, filter, value)).toBeChecked();
    }
  });
});

describe("Clear filters", () => {
  test.each([
    ["without a search or a filter", "?view=new", false],
    ["with a search", "?view=new&search=curl", true],
    ["with a filter", "?view=new&overdue=triage", true],
    ["with a sorting alone", "?view=new&sort=deadline", false],
  ])("shows %s: %s", async (_, search, shown) => {
    stubTickets();
    const { screen } = await renderApp(`/tickets${search}`);
    await expect.element(searchFieldOf(screen)).toBeVisible();

    const clear = screen.getByRole("button", { name: "Clear filters" });
    if (shown) {
      await expect.element(clear).toBeVisible();
    } else {
      await expect.element(clear).not.toBeInTheDocument();
    }
  });

  test("removes the search and the filters, keeps the view and the sorting, and moves the focus to the heading", async () => {
    const { spy } = stubTickets();
    const { router, screen } = await renderApp(
      "/tickets?view=new&search=curl&severity=high&phase=triage&sort=deadline&order=desc&page=2",
    );
    const clear = screen.getByRole("button", { name: "Clear filters" });
    await expect.element(clear).toBeVisible();
    clear.element().focus();

    await userEvent.keyboard("{Enter}");

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=new&sort=deadline&order=desc");
    expect(router.history.length).toBe(2);
    await expect.element(searchFieldOf(screen)).toHaveValue("");
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toHaveFocus();
    expect(queriesOf(spy, "list").at(-1)).toBe(
      `${FILTERS.New}&sort_by=current_due_at&sort_order=desc&page=1&per_page=20`,
    );
  });
});

// The direction of a sort order, as aria-sort names it.
function directionOf(order: string): string {
  return order === "asc" ? "ascending" : "descending";
}

describe("the sorting", () => {
  test.each([
    ["Ticket", "ticket", "ticket_id", "desc", "asc"],
    ["Status", "status", "status", "asc", "desc"],
    ["Severity", "severity", "severity", "desc", "asc"],
    ["Priority", "priority", "priority_then_current_due", "desc", "asc"],
    ["Deadline", "deadline", "current_due_at", "asc", "desc"],
  ])(
    "sorts by %s in its first direction, at the first page, then reverses it",
    async (name, column, field, first, second) => {
      const { spy } = stubTickets();
      const { router, screen } = await renderApp("/tickets?page=2");
      const header = tableOf(screen).getByRole("columnheader", { name });

      await header.click();

      await expect
        .poll(() => router.state.location.href)
        .toBe(`/tickets?sort=${column}`);
      await expect
        .element(header)
        .toHaveAttribute("aria-sort", directionOf(first));
      await expect
        .poll(() => queriesOf(spy, "list").at(-1))
        .toBe(`sort_by=${field}&sort_order=${first}&page=1&per_page=20`);
      await expect
        .element(
          tableOf(screen).getByRole("columnheader", { name: "Last modified" }),
        )
        .toHaveAttribute("aria-sort", "none");

      await header.click();

      await expect
        .poll(() => router.state.location.href)
        .toBe(`/tickets?sort=${column}&order=${second}`);
      await expect
        .element(header)
        .toHaveAttribute("aria-sort", directionOf(second));
      await expect
        .poll(() => queriesOf(spy, "list").at(-1))
        .toBe(`sort_by=${field}&sort_order=${second}&page=1&per_page=20`);
      expect(router.history.length).toBe(3);
    },
  );

  test("reverses the sorting of the view, and returns to it, which leaves the URL", async () => {
    const { spy } = stubTickets();
    const { router, screen } = await renderApp("/tickets?view=new");
    const priority = tableOf(screen).getByRole("columnheader", {
      name: "Priority",
    });
    await expect.element(priority).toHaveAttribute("aria-sort", "descending");

    await priority.click();
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=new&order=asc");
    await expect
      .poll(() => queriesOf(spy, "list").at(-1))
      .toBe(`${FILTERS.New}&${QUEUE_SORT}&sort_order=asc&page=1&per_page=20`);

    await tableOf(screen)
      .getByRole("columnheader", { name: "Deadline" })
      .click();
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=new&sort=deadline");

    await priority.click();
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=new");
    await expect.element(priority).toHaveAttribute("aria-sort", "descending");
  });

  test("reverses the sorting of the Embargo view by Coordinated Release Date, and returns to it in its first direction, which leaves the URL", async () => {
    const { spy } = stubTickets({ user: EMBARGO_ANALYST });
    const { router, screen } = await renderApp("/tickets?view=embargo");
    const release = tableOf(screen).getByRole("columnheader", {
      name: "Coordinated Release Date",
    });
    await expect.element(release).toHaveAttribute("aria-sort", "ascending");

    await release.click();
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=embargo&order=desc");
    await expect.element(release).toHaveAttribute("aria-sort", "descending");
    await expect
      .poll(() => queriesOf(spy, "list").at(-1))
      .toBe(
        `${EMBARGO}&sort_by=coordinated_release_at&sort_order=desc&page=1&per_page=20`,
      );

    await tableOf(screen)
      .getByRole("columnheader", { name: "Deadline" })
      .click();
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=embargo&sort=deadline");

    await release.click();
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=embargo");
    await expect.element(release).toHaveAttribute("aria-sort", "ascending");
  });

  test("reverses the sorting of the All view by last modification", async () => {
    stubTickets();
    const { router, screen } = await renderApp("/tickets");
    const modified = tableOf(screen).getByRole("columnheader", {
      name: "Last modified",
    });
    await expect.element(modified).toHaveAttribute("aria-sort", "descending");

    await modified.click();

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?order=asc");
    await expect.element(modified).toHaveAttribute("aria-sort", "ascending");
  });

  test("offers no sorting by the CVE, the title, the packages, or the assignee", async () => {
    stubTickets();
    const { router, screen } = await renderApp("/tickets");
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-1" }))
      .toBeVisible();

    for (const name of ["CVE", "Title", "Packages", "Assignee"]) {
      const header = tableOf(screen).getByRole("columnheader", { name });
      await expect.element(header).not.toHaveAttribute("aria-sort");
      await header.click();
    }

    expect(router.state.location.href).toBe("/tickets");
  });

  test("shows the new sorting in the header at once, while the rows of the previous one stay", async () => {
    const pending = later();
    stubTickets({
      list: (query) =>
        query.get("sort_by") === "current_due_at"
          ? pending.promise
          : ticketPage([ROW]),
    });
    const { screen } = await renderApp("/tickets?view=new");
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-1" }))
      .toBeVisible();
    const deadline = tableOf(screen).getByRole("columnheader", {
      name: "Deadline",
    });

    await deadline.click();

    await expect
      .element(screen.getByRole("progressbar", { name: "Updating" }))
      .toBeVisible();
    await expect.element(deadline).toHaveAttribute("aria-sort", "ascending");
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-1" }))
      .toBeVisible();

    pending.resolve(ticketPage([fictionalTicket({ ticket_id: "SNTL-7" })]));
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-7" }))
      .toBeVisible();
    // The header that the user pressed keeps the focus once the rows arrive.
    await expect.element(deadline).toHaveFocus();
  });
});

describe("the links of the list", () => {
  test("of the tabs open each view without the search, the filters, and the sorting", async () => {
    stubTickets();
    const { screen } = await renderApp(
      "/tickets?view=analysis&search=curl&severity=high&sort=deadline",
    );

    expect(
      tabsOf(screen)
        .elements()
        .map((tab) => tab.getAttribute("href")),
    ).toEqual([
      "/tickets?view=new",
      "/tickets?view=unassigned",
      "/tickets?view=analysis",
      "/tickets?view=analyzed",
      "/tickets",
      "/tickets?view=assigned-to-me",
    ]);
  });

  test("of the pagination keep the search, the filters, and the sorting", async () => {
    stubTickets({ list: pageOf });
    const { screen } = await renderApp(
      "/tickets?search=curl&priority=p1&order=asc",
    );
    const pagination = screen.getByRole("navigation", { name: "Pagination" });

    await expect
      .element(pagination.getByRole("link", { name: "Next" }))
      .toHaveAttribute(
        "href",
        "/tickets?search=curl&priority=p1&order=asc&page=2",
      );
  });

  test("to the first page from a page beyond the last keeps the search, the filters, and the sorting", async () => {
    stubTickets({ list: pageOf });
    const { screen } = await renderApp(
      "/tickets?view=new&overdue=um&sort=ticket&page=5",
    );

    // A page beyond the last of a refined list that has Tickets.
    await expect
      .element(
        screen
          .getByRole("tabpanel")
          .getByText("There are no Tickets on this page."),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Go to the first page" }))
      .toHaveAttribute("href", "/tickets?view=new&overdue=um&sort=ticket");
  });
});

describe("a list that the user refined", () => {
  test("announces in the popover of the filters what the list shows after a change of a filter, or the failure of its read", async () => {
    stubTickets({
      list: (query) =>
        query.has("priority")
          ? errorResponse(503, "DATABASE_UNAVAILABLE")
          : query.has("severity")
            ? ticketPage([ROW])
            : ticketPage([ROW, fictionalTicket({ ticket_id: "SNTL-2" })]),
    });
    const { screen } = await renderApp("/tickets?view=new");
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-2" }))
      .toBeVisible();
    const dialog = await openFilters(screen);
    const status = dialog.getByRole("status");
    await expect.element(status).toHaveTextContent("");

    await toggle(dialog, "Severity", "High");
    await expect.element(status).toHaveTextContent("1 Ticket");
    const first = status.element().firstElementChild;

    // A new node, which assistive technologies announce although its words
    // are the same.
    await toggle(dialog, "Severity", "Critical");
    await expect
      .poll(() => {
        const node = status.element().firstElementChild;
        return node !== first && node?.textContent === "1 Ticket";
      })
      .toBe(true);

    await toggle(dialog, "Priority", "P1");
    await expect
      .element(status)
      .toHaveTextContent(
        "Sentinel isn't available right now. Try again later.",
      );
  });

  test("announces in the popover of the filters the failure of a new read of the rows that show, also before any change", async () => {
    const { stub } = stubTickets();
    const { screen } = await renderApp("/tickets?view=new");
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-1" }))
      .toBeVisible();
    const dialog = await openFilters(screen);
    const status = dialog.getByRole("status");
    await expect.element(status).toHaveTextContent("");

    stub.list = () => errorResponse(503, "DATABASE_UNAVAILABLE");
    returnToForeground();

    await expect
      .element(status)
      .toHaveTextContent(
        "This couldn't be updated. Sentinel isn't available right now. Try again later.",
      );
    await expect.element(dialog).toBeVisible();
  });

  test.each([
    [
      "a search alone",
      "?search=curl",
      "No Tickets in this view match the search.",
    ],
    [
      "a filter",
      "?severity=high",
      "No Tickets in this view match the filters.",
    ],
    [
      "a search and a filter",
      "?search=curl&severity=high",
      "No Tickets in this view match the filters.",
    ],
    [
      "a filter, on another page",
      "?view=new&priority=p4&page=3",
      "No Tickets in this view match the filters.",
    ],
  ])(
    "says without Tickets that none match %s, and offers Clear filters, which moves the focus to the heading",
    async (_, search, message) => {
      stubTickets({
        list: (query) =>
          query.has("search") || query.has("severity") || query.has("priority")
            ? ticketPage([])
            : ticketPage([ROW]),
      });
      const { router, screen } = await renderApp(`/tickets${search}`);

      await expect.element(screen.getByText(message)).toBeVisible();
      await expect
        .element(screen.getByText("No Tickets in this view.", { exact: true }))
        .not.toBeInTheDocument();
      const clear = screen.getByRole("button", { name: "Clear filters" });
      // The one of the toolbar, and the one of the empty state, inside the
      // frame of the table.
      expect(clear.elements()).toHaveLength(2);
      const inFrame = clear
        .elements()
        .filter((button) => frameOf(screen).contains(button));
      expect(inFrame).toHaveLength(1);
      inFrame[0]!.focus();

      await userEvent.keyboard("{Enter}");

      await expect
        .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-1" }))
        .toBeVisible();
      expect(router.state.location.search).not.toHaveProperty("search");
      expect(router.state.location.href).not.toMatch(
        /search=|severity=|priority=/,
      );
      await expect
        .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
        .toHaveFocus();
    },
  );

  test.each([
    ["a search", "?view=new&search=curl"],
    ["a filter", "?view=new&severity=high"],
    ["a sorting", "?view=new&sort=deadline"],
  ])(
    "announces the Tickets that the list shows after %s, and leaves the focus where it was",
    async (_, search) => {
      stubTickets({
        list: (query) =>
          query.get("sort_by") === "priority_then_current_due" &&
          !query.has("search") &&
          !query.has("severity")
            ? ticketPage([ROW, fictionalTicket({ ticket_id: "SNTL-2" })])
            : ticketPage([ROW]),
      });
      const { router, screen } = await renderApp("/tickets?view=new");
      await expect
        .element(tableOf(screen).getByRole("rowheader", { name: "SNTL-2" }))
        .toBeVisible();
      const tab = screen.getByRole("tab", { name: /^New/ });
      tab.element().focus();

      router.history.push(`/tickets${search}`);

      await expect.poll(() => announcementsOf(screen)).toEqual(["1 Ticket"]);
      await expect.element(tab).toHaveFocus();
    },
  );
});

function summaryOf(screen: Screen) {
  return screen.getByRole("list", { name: "Tickets that need attention" });
}

// Waits until every count of the attention summary has arrived.
async function expectSummary(screen: Screen) {
  await expect
    .poll(() =>
      summaryOf(screen)
        .getByRole("link")
        .elements()
        .map((link) => link.textContent),
    )
    .toEqual([
      "2 Active P1",
      "1 Triage overdue",
      "0 Submission overdue",
      "1 UM overdue",
      "3 QA overdue",
    ]);
}

describe("the attention summary", () => {
  test("shows five counts in the heading row, each a link to the All view refined to its Tickets", async () => {
    stubTickets();
    const { screen } = await renderApp("/tickets?view=new");
    const links = summaryOf(screen).getByRole("link");

    await expect
      .poll(() => links.elements().map((link) => link.textContent))
      .toEqual([
        "2 Active P1",
        "1 Triage overdue",
        "0 Submission overdue",
        "1 UM overdue",
        "3 QA overdue",
      ]);
    expect(links.elements().map((link) => link.getAttribute("href"))).toEqual([
      "/tickets?status=new&status=analysis&status=analyzed&priority=p1",
      "/tickets?phase=triage&overdue=triage",
      "/tickets?phase=submission&overdue=submission",
      "/tickets?phase=um&overdue=um",
      "/tickets?phase=qa&overdue=qa",
    ]);
    // After the heading, on its row.
    const heading = screen
      .getByRole("heading", { level: 1, name: "Tickets" })
      .element()
      .getBoundingClientRect();
    const first = links.first().element().getBoundingClientRect();
    expect(first.left).toBeGreaterThan(heading.right);
    expect(first.top).toBeLessThan(heading.bottom);
  });

  test("sets the overdue counts apart from Active P1: a line, then the name Overdue, hidden from assistive technologies, then each count with its phase alone", async () => {
    stubTickets();
    const { screen } = await renderApp("/tickets?view=new");
    const active = summaryOf(screen).getByRole("link", { name: "2 Active P1" });
    const triage = summaryOf(screen).getByRole("link", {
      name: "1 Triage overdue",
    });
    const label = summaryOf(screen).getByText("Overdue", { exact: true });
    await expectSummary(screen);

    // The counts show their phase, and the name of the group once.
    await expect
      .element(triage.getByText("Triage", { exact: true }))
      .toBeVisible();
    await expect.element(label).toBeVisible();
    expect(label.element().closest('[aria-hidden="true"]')).not.toBeNull();
    const style = getComputedStyle(label.element());
    expect([style.fontSize, style.color]).toEqual(["14px", "rgb(89, 99, 110)"]);
    // A line of 1 px in border, 20 px high, 12 px from Active P1 and from the
    // name, which is 8 px before the first count.
    const first = active.element().getBoundingClientRect();
    const line = document.elementFromPoint(
      first.right + 12.5,
      first.top + first.height / 2,
    )!;
    const box = line.getBoundingClientRect();
    expect([
      Math.round(box.left - first.right),
      Math.round(box.width),
      Math.round(box.height),
      getComputedStyle(line).backgroundColor,
    ]).toEqual([12, 1, 20, "rgb(216, 222, 228)"]);
    const name = label.element().getBoundingClientRect();
    expect(Math.round(name.left - box.right)).toBe(12);
    expect(
      Math.round(triage.element().getBoundingClientRect().left - name.right),
    ).toBe(8);
    // On one line in a wide window.
    expect(
      summaryOf(screen)
        .getByRole("link")
        .elements()
        .map((link) => link.getBoundingClientRect().top),
    ).toEqual(Array.from({ length: 5 }, () => first.top));
  });

  test("wraps the group of the overdue counts to the next line as a whole, and its counts after its name, in a narrow window", async () => {
    await page.viewport(320, 800);
    stubTickets();
    const { screen } = await renderApp("/tickets?view=new");
    const rect = (name: string) =>
      summaryOf(screen)
        .getByRole("link", { name })
        .element()
        .getBoundingClientRect();
    await expectSummary(screen);

    const active = rect("2 Active P1");
    const triage = rect("1 Triage overdue");
    const qa = rect("3 QA overdue");
    const name = summaryOf(screen)
      .getByText("Overdue", { exact: true })
      .element()
      .getBoundingClientRect();
    expect(triage.top).toBeGreaterThan(active.bottom);
    expect(name.top).toBe(triage.top);
    // The line stands 4 px after the start of the line, as the line of the
    // views does, and 12 px before the name.
    const line = document.elementFromPoint(
      active.left + 4.5,
      name.top + name.height / 2,
    )!;
    const box = line.getBoundingClientRect();
    expect([
      Math.round(box.left - active.left),
      Math.round(name.left - box.right),
      getComputedStyle(line).backgroundColor,
    ]).toEqual([4, 12, "rgb(216, 222, 228)"]);
    expect(qa.top).toBeGreaterThan(triage.top);
    expect(qa.left).toBeGreaterThanOrEqual(name.right);
    expect(qa.right).toBeLessThanOrEqual(window.innerWidth);
  });

  test("reads each count with its filters alone, from a read of one Ticket, whatever the user refined", async () => {
    const { spy } = stubTickets();
    const { screen } = await renderApp(
      "/tickets?view=new&search=curl&severity=high&sort=deadline",
    );
    await expect
      .element(summaryOf(screen).getByRole("link", { name: "3 QA overdue" }))
      .toBeVisible();

    const counts = queriesOf(spy, "count");
    for (const filters of Object.values(ATTENTION)) {
      expect(
        counts.filter((query) => query === countQuery(filters)),
      ).toHaveLength(1);
    }
  });

  test("shows the label of a count alone while it loads", async () => {
    const pending = later();
    stubTickets({
      count: (query) =>
        filtersOf(query) === ATTENTION["UM overdue"]
          ? pending.promise
          : countOf(query),
    });
    const { screen } = await renderApp("/tickets?view=new");

    await expect
      .element(summaryOf(screen).getByRole("link", { name: "3 QA overdue" }))
      .toBeVisible();
    await expect
      .element(
        summaryOf(screen).getByRole("link", {
          name: "UM overdue",
          exact: true,
        }),
      )
      .toBeVisible();

    pending.resolve(ticketPage([], { total: 1, perPage: 1 }));
    await expect
      .element(summaryOf(screen).getByRole("link", { name: "1 UM overdue" }))
      .toBeVisible();
  });

  test("shows a count as not available when its read fails, and reads it again with the next read of the list", async () => {
    const { stub, spy } = stubTickets({
      count: (query) =>
        filtersOf(query) === ATTENTION["Active P1"]
          ? errorResponse(503, "DATABASE_UNAVAILABLE")
          : countOf(query),
    });
    const { router, screen } = await renderApp("/tickets?view=new");
    const failed = summaryOf(screen).getByRole("link", {
      name: "Active P1 not available",
    });

    await expect.element(failed).toBeVisible();
    expect(failed.element().textContent).toBe("– Active P1 not available");
    const reads = () =>
      queriesOf(spy, "count").filter(
        (query) => query === countQuery(ATTENTION["Active P1"]),
      ).length;
    // The read and its two retries.
    expect(reads()).toBe(3);

    stub.count = countOf;
    router.history.push("/tickets?view=new&page=2");

    await expect
      .element(summaryOf(screen).getByRole("link", { name: "2 Active P1" }))
      .toBeVisible();
    expect(reads()).toBe(4);
    // A count that loaded is not read again with the list.
    expect(
      queriesOf(spy, "count").filter(
        (query) => query === countQuery(ATTENTION["QA overdue"]),
      ),
    ).toHaveLength(1);
  });

  test("opens the All view refined to the Tickets of a count", async () => {
    const { spy } = stubTickets();
    const { router, screen } = await renderApp("/tickets?view=new");

    await summaryOf(screen).getByRole("link", { name: "1 UM overdue" }).click();

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?phase=um&overdue=um");
    await expect
      .element(screen.getByRole("tab", { name: /^All/ }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .poll(() => queriesOf(spy, "list").at(-1))
      .toBe(`current_phase=um&overdue=um&${ALL_PAGE}`);
  });

  test("shows Embargo expired after Active P1 to a user who holds manage_confidentiality, standing alone, as a link to the Embargo view refined to its Tickets", async () => {
    const { spy } = stubTickets({ user: EMBARGO_ANALYST });
    const { screen } = await renderApp("/tickets?view=new");
    const links = summaryOf(screen).getByRole("link");

    await expect
      .poll(() => links.elements().map((link) => link.textContent))
      .toEqual([
        "2 Active P1",
        "1 Embargo expired",
        "1 Triage overdue",
        "0 Submission overdue",
        "1 UM overdue",
        "3 QA overdue",
      ]);
    await expect
      .element(links.nth(1))
      .toHaveAttribute("href", "/tickets?view=embargo&embargo=expired");
    expect(
      queriesOf(spy, "count").filter((query) => query === countQuery(EXPIRED)),
    ).toHaveLength(1);
    // 8 px after Active P1, and the line of the overdue counts 12 px after
    // it, all on one line in a wide window.
    const active = links.first().element().getBoundingClientRect();
    const expired = links.nth(1).element().getBoundingClientRect();
    expect(Math.round(expired.left - active.right)).toBe(8);
    const line = document.elementFromPoint(
      expired.right + 12.5,
      expired.top + expired.height / 2,
    )!;
    const box = line.getBoundingClientRect();
    expect([
      Math.round(box.left - expired.right),
      Math.round(box.width),
      getComputedStyle(line).backgroundColor,
    ]).toEqual([12, 1, "rgb(216, 222, 228)"]);
    expect(
      links.elements().map((link) => link.getBoundingClientRect().top),
    ).toEqual(Array.from({ length: 6 }, () => active.top));
  });

  test("opens the Embargo view refined to the Tickets of Embargo expired", async () => {
    const { spy } = stubTickets({ user: EMBARGO_ANALYST });
    const { router, screen } = await renderApp("/tickets?view=new");

    await summaryOf(screen)
      .getByRole("link", { name: "1 Embargo expired" })
      .click();

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=embargo&embargo=expired");
    await expect
      .element(screen.getByRole("tab", { name: "Embargo 3" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .poll(() => queriesOf(spy, "list").at(-1))
      .toBe(`${EXPIRED}&${EMBARGO_PAGE}`);
  });

  test("moves the focus from Embargo expired to the heading when a read of the signed-in user tells that the user no longer holds manage_confidentiality", async () => {
    const { stub } = stubTickets({ user: EMBARGO_ANALYST });
    const { screen } = await renderApp("/tickets?view=new");
    const count = summaryOf(screen).getByRole("link", {
      name: "1 Embargo expired",
    });
    await expect.element(count).toBeVisible();
    count.element().focus();

    stub.user = ANALYST;
    returnToForeground();

    await expect.element(count).not.toBeInTheDocument();
    await expectSummary(screen);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toHaveFocus();
  });

  test("shows the same counts to a user who holds no capability and can be the assignee of no Ticket", async () => {
    const { spy } = stubTickets({ user: READER });
    const { screen } = await renderApp("/tickets");
    await expectTabs(screen, [
      "New 12",
      "Unassigned 1",
      "Analysis 5",
      "Analyzed 3",
      "All 1,250",
    ]);

    await expectSummary(screen);
    // The counts of the five views, and those of the summary.
    expect(queriesOf(spy, "count")).toHaveLength(10);
  });

  test("stays, with the focus on its count, when a read of the signed-in user tells that the user lost every capability and can be the assignee of no Ticket", async () => {
    const { stub } = stubTickets();
    const { screen } = await renderApp("/tickets");
    const count = summaryOf(screen).getByRole("link", { name: "2 Active P1" });
    await expect.element(count).toBeVisible();
    count.element().focus();

    stub.user = withEligibility(
      { data: { ...ANALYST.data, roles: [], capabilities: [] } },
      "none",
    );
    returnToForeground();

    await expect
      .element(screen.getByRole("tab", { name: /^Assigned to me/ }))
      .not.toBeInTheDocument();
    await expectSummary(screen);
    await expect.element(count).toHaveFocus();
  });
});
