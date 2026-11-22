import { focusManager, type QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { page, type Locator } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { App } from "../../app";
import type {
  AssignmentEligibility,
  Capability,
  CurrentUserData,
  CurrentUserResponse,
} from "../../api/generated/model";
import { getListTicketsQueryKey } from "../../api/generated/tickets";
import { createQueryClient } from "../../query-client";
import { createAppRouter } from "../../router";
import {
  errorResponse,
  FICTIONAL_USER,
  fictionalTicket,
  jsonResponse,
  OTHER_USER,
  stubApi,
  ticketPage,
  urlOf,
} from "../../test-api";

// What the test files of the Ticket list (src/routes/tickets.tsx) and of its
// parts (src/routes/tickets/) share: the signed-in users, the requests of the
// views and of the counts, the responses of the API to the list, its
// rendering, the elements of its parts, and the waits for its reads.

const ME = "/api/v1/users/me";
const TICKETS = "/api/v1/tickets";

// A user who holds the vulnerability_analyst role and can be the assignee of
// every Ticket, and one who holds no role and can be the assignee of none.
export const ANALYST: CurrentUserResponse = OTHER_USER;
export const READER: CurrentUserResponse = FICTIONAL_USER;

// An assignment eligibility and a capability that the pinned contract does
// not list, which a later Sentinel release can return.
export const UNLISTED_ELIGIBILITY = "fictional_eligibility";
export const UNLISTED_CAPABILITY = "fictional_capability";

// Get Current User's response, with a listed assignment eligibility or the
// unlisted one, and with listed capabilities or the unlisted one.
interface UserResponse {
  data: Omit<CurrentUserData, "assignment_eligibility" | "capabilities"> & {
    assignment_eligibility: AssignmentEligibility | typeof UNLISTED_ELIGIBILITY;
    capabilities: (Capability | typeof UNLISTED_CAPABILITY)[];
  };
}

// The user with another assignment eligibility.
export function withEligibility(
  user: UserResponse,
  eligibility: AssignmentEligibility | typeof UNLISTED_ELIGIBILITY,
): UserResponse {
  return { data: { ...user.data, assignment_eligibility: eligibility } };
}

// The user with other capabilities.
export function withCapabilities(
  user: UserResponse,
  capabilities: (Capability | typeof UNLISTED_CAPABILITY)[],
): UserResponse {
  return { data: { ...user.data, capabilities } };
}

// An analyst who also holds manage_confidentiality, as the
// vulnerability_analyst role grants it (Sentinel
// docs/features/identity/rbac.md, Predefined Roles), and so is shown the
// Embargo view and the Embargo expired count.
export const EMBARGO_ANALYST = withCapabilities(ANALYST, [
  "manage_confidentiality",
  "triage_ticket",
]);

// The filters of the views, as the requests send them, for the analyst.
export const FILTERS = {
  New: "status=new",
  Unassigned: "status=analysis&status=analyzed&assignee=none",
  Analysis: "status=analysis",
  Analyzed: "status=analyzed",
  All: "",
  "Assigned to me": `assignee=${ANALYST.data.id}&status=analysis&status=analyzed`,
};

// The filters of the counts of the attention summary, as the requests send
// them.
export const ATTENTION = {
  "Active P1": "priority=p1&status=new&status=analysis&status=analyzed",
  "Triage overdue": "current_phase=triage&overdue=triage",
  "Submission overdue": "current_phase=submission&overdue=submission",
  "UM overdue": "current_phase=um&overdue=um",
  "QA overdue": "current_phase=qa&overdue=qa",
};

// The filters of the Embargo view, and of the Embargo expired count, as the
// requests send them.
export const EMBARGO = "is_confidential=true";
export const EXPIRED = `${EMBARGO}&coordinated_release_passed=true`;

// The sorting of the queues: by priority, then by the due date of the
// current phase.
export const QUEUE_SORT = "sort_by=priority_then_current_due";
// The sorting of the All view, and the read of its first page.
const ALL_SORT = "sort_by=updated_at&sort_order=desc";
export const ALL_PAGE = `${ALL_SORT}&page=1&per_page=20`;
// The sorting of the Embargo view, by Coordinated Release Date, earliest
// first, and the read of its first page.
const EMBARGO_SORT = "sort_by=coordinated_release_at&sort_order=asc";
export const EMBARGO_PAGE = `${EMBARGO_SORT}&page=1&per_page=20`;

// The number of Tickets of each view and of each count of the attention
// summary in the tests, by its filters.
export const TOTALS = new Map([
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
export function countQuery(filters: string): string {
  return filters === "" ? "per_page=1" : `${filters}&per_page=1`;
}

// The read of a list, without its page.
export function filtersOf(query: URLSearchParams): string {
  const filters = new URLSearchParams(query);
  filters.delete("per_page");
  filters.delete("page");
  filters.delete("sort_by");
  filters.delete("sort_order");
  return filters.toString();
}

type Responder = (query: URLSearchParams) => Response | Promise<Response>;

// The count of a view, a read of one Ticket.
export function countOf(query: URLSearchParams): Response {
  return ticketPage([], {
    total: TOTALS.get(filtersOf(query)) ?? 0,
    perPage: 1,
  });
}

export const ROW = fictionalTicket();

export let client: QueryClient;

// Gives each test of the file that calls it at its top level a query client of
// its own and the viewport of the tests, and restores after it what the test
// changed.
export function prepareEachTest() {
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
}

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
export function stubTickets(fields: Partial<Stub> = {}) {
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
export function queriesOf(
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

export async function renderApp(path: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
    .toBeVisible();
  return { router, screen };
}

export type Screen = Awaited<ReturnType<typeof renderApp>>["screen"];

export function tabsOf(screen: Screen) {
  return screen.getByRole("tablist", { name: "Views" }).getByRole("tab");
}

export function tableOf(screen: Screen) {
  return screen.getByRole("grid", { name: "Tickets" });
}

// The nearest element around the element that matches.
export function ancestorOf(
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
export function frameOf(screen: Screen): Element {
  return ancestorOf(
    tableOf(screen).element(),
    (element) => getComputedStyle(element).borderTopWidth === "1px",
  );
}

// The text of each tab, once every count has arrived.
export async function expectTabs(screen: Screen, names: string[]) {
  await expect
    .poll(() =>
      tabsOf(screen)
        .elements()
        .map((tab) => tab.textContent),
    )
    .toEqual(names);
}

// A response that the test gives when it chooses.
export function later() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// The tab returns to the foreground after being hidden, once no read is in
// progress: a return during a read joins it rather than reading again
// (TanStack Query's Query.onFocus), so the reads that a test expects after
// the return do not depend on when the reads before it end.
export async function returnToForeground() {
  await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
  focusManager.setFocused(false);
  focusManager.setFocused(true);
}

// Opens the popover of the filters, and returns it.
export async function openFilters(screen: Screen) {
  await screen.getByRole("button", { name: /^Filters/ }).click();
  const dialog = screen.getByRole("dialog", { name: "Filters" });
  await expect.element(dialog).toBeVisible();
  return dialog;
}

// Checks or unchecks a value of a filter, with a click on its name, as its
// box covers its input.
export async function toggle(dialog: Locator, filter: string, value: string) {
  await dialog
    .getByRole("group", { name: filter })
    .getByText(value, { exact: true })
    .click();
}

export function summaryOf(screen: Screen) {
  return screen.getByRole("list", { name: "Tickets that need attention" });
}

// Waits until every count of the attention summary has arrived.
export async function expectSummary(screen: Screen) {
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
