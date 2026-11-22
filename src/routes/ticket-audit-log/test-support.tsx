import { focusManager, type QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { page, type Locator } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { App } from "../../app";
import type {
  CurrentUserResponse,
  TicketAuditEventData,
} from "../../api/generated/model";
import { createQueryClient } from "../../query-client";
import { createAppRouter } from "../../router";
import {
  actorsResponse,
  cvssResponse,
  errorResponse,
  eventPage,
  fictionalEvent,
  fictionalTicketDetail,
  jsonResponse,
  OTHER_USER,
  referenceOf,
  sourcesResponse,
  stubApi,
  ticketPage,
  ticketResponse,
  urlOf,
} from "../../test-api";

// What the test files of the tab Audit log (src/routes/ticket-audit-log.tsx)
// and of its kinds and sentences (src/routes/ticket-audit-log/) share: the
// paths, the actors, the events of the tests and the responses of the API,
// the rendering of the tab, its elements, the waits for its reads, the
// actions on its filters, and the kinds with the event types that each sends.

export const ME = "/api/v1/users/me";
const TICKETS = "/api/v1/tickets";

export const EVENTS = "/api/v1/tickets/SNTL-12/audit-log";
export const ACTORS = "/api/v1/tickets/SNTL-12/actors";
const CVSS = "/api/v1/cves/CVE-2099-0012/cvss";
const SOURCES = "/api/v1/cves/CVE-2099-0012/sources";
// The path of the tab.
export const PATH = "/tickets/SNTL-12/audit-log";
// The read of the first page of the events, 50 a page.
export const FIRST_PAGE = "page=1&per_page=50";

// The signed-in user, who acted on the Ticket, and another actor.
export const ALICE = referenceOf(OTHER_USER);

// A date and time of the API of a local time of the browser.
export function at(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

// The events of a page, each with an identifier of its own and the fields
// that the test sets.
export function eventsOf(
  ...fields: Partial<TicketAuditEventData>[]
): TicketAuditEventData[] {
  return fields.map((field, index) =>
    fictionalEvent({
      id: `00000000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`,
      ...field,
    }),
  );
}

const CREATED = at(2025, 1, 15, 9, 30);

// The query of the read of the first event of the Ticket (docs/screens/
// ticket.md, Audit log, Period).
const FIRST_EVENT_READ = "event_type=ticket_created&per_page=1";

export function isFirstEventRead(query: URLSearchParams): boolean {
  return query.toString() === FIRST_EVENT_READ;
}

// The response to the read of the first event of the Ticket.
export function firstEventResponse(created = CREATED): Response {
  return eventPage(
    eventsOf({
      event_type: "ticket_created",
      old_value: null,
      new_value: null,
      comment: "Ticket created manually",
      created_at: created,
    }),
  );
}

export let client: QueryClient;

// Gives each test of the file that calls it at its top level a query client of
// its own and the viewport of the tests, and restores after it what the test
// changed.
export function prepareEachTest() {
  beforeEach(async () => {
    client = createQueryClient();
    // The delay between attempts is TanStack Query's; the tests remove it.
    client.setDefaultOptions({
      queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
    });
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
    window.scrollTo(0, 0);
    await page.viewport(414, 896);
  });
}

type Responder = (query: URLSearchParams) => Response | Promise<Response>;

interface Stub {
  // The signed-in user.
  user: CurrentUserResponse;
  // The response to Get Ticket of the path.
  ticket: (path: string) => Response | Promise<Response>;
  // The response to List Ticket Events, given its query.
  events: Responder;
  // The response to the read of the first event, its ticket_created.
  first: () => Response | Promise<Response>;
  // The response to List Ticket Actors.
  actors: () => Response | Promise<Response>;
}

// Answers the read of the signed-in user, Alice Smith, an analyst, Get
// Ticket, List Ticket Events, List Ticket Actors, and the reads of Overview,
// as the test sets them, and returns the stub, which a test can change, and
// the spy, whose calls name the requests.
export function stubLog(fields: Partial<Stub> = {}) {
  const stub: Stub = {
    user: OTHER_USER,
    ticket: (path) =>
      ticketResponse(
        fictionalTicketDetail({ ticket_id: path.slice(TICKETS.length + 1) }),
      ),
    events: () => eventPage(eventsOf({})),
    first: () => firstEventResponse(),
    actors: () => actorsResponse(),
    ...fields,
  };
  const spy = stubApi((request) => {
    if (request.path === ME) {
      return jsonResponse(200, stub.user);
    }
    if (request.path === EVENTS && isFirstEventRead(request.query)) {
      return stub.first();
    }
    if (request.path === EVENTS) {
      return stub.events(request.query);
    }
    if (request.path === ACTORS) {
      return stub.actors();
    }
    if (/^\/api\/v1\/tickets\/SNTL-\d+$/.test(request.path)) {
      return stub.ticket(request.path);
    }
    if (request.path === TICKETS) {
      return ticketPage([]);
    }
    if (request.path === CVSS) {
      return cvssResponse();
    }
    if (request.path === SOURCES) {
      return sourcesResponse();
    }
    return errorResponse(404, "RESOURCE_NOT_FOUND");
  });
  return { stub, spy };
}

// Answers List Ticket Events with the events.
export function showing(...fields: Partial<TicketAuditEventData>[]) {
  return stubLog({ events: () => eventPage(eventsOf(...fields)) });
}

// The queries of the reads of the events, in their order, each parameter as
// its text, without the reads of the first event.
export function eventReads(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter(
      (url) => url.pathname === EVENTS && !isFirstEventRead(url.searchParams),
    )
    .map((url) =>
      [...url.searchParams].map(([key, value]) => `${key}=${value}`).join("&"),
    );
}

export async function renderApp(path: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  return { router, screen };
}

export type Screen = Awaited<ReturnType<typeof renderApp>>["screen"];

// Renders the tab and waits until it shows the Ticket.
export async function renderLog(path = PATH) {
  const rendered = await renderApp(path);
  await expect.element(heading(rendered.screen, "SNTL-12")).toBeVisible();
  return rendered;
}

// Renders the tab and waits until it shows its events.
export async function renderEvents(path = PATH) {
  const rendered = await renderLog(path);
  await expect
    .element(panelOf(rendered.screen).getByRole("listitem").first())
    .toBeVisible();
  return rendered;
}

export function heading(screen: Screen, name: string) {
  return screen.getByRole("heading", { level: 1, name, exact: true });
}

export function panelOf(screen: Screen) {
  return screen.getByRole("tabpanel", { name: "Audit log" });
}

// The text of a node as assistive technologies read it: without what it
// hides from them, such as the marker of an event or the icon of a link to
// another site, with a space around each element that is not inline, such
// as a label after a name, as the computation of an accessible name adds
// one.
function textOf(node: Node): string {
  if (node instanceof Text) {
    return node.data;
  }
  if (
    !(node instanceof Element) ||
    node.getAttribute("aria-hidden") === "true"
  ) {
    return "";
  }
  const text = [...node.childNodes].map(textOf).join("");
  return getComputedStyle(node).display === "inline" ? text : ` ${text} `;
}

// The text of an element as assistive technologies read it, with its spaces
// collapsed, as a line shows them.
export function readText(element: Element): string {
  return textOf(element).replace(/\s+/g, " ").trim();
}

// The sentences of the events that the tab shows, in their order, each
// starting with its actor.
export function sentencesOf(screen: Screen): string[] {
  return panelOf(screen)
    .getByRole("listitem")
    .elements()
    .map((item) =>
      readText(page.elementLocator(item).getByRole("paragraph").element()),
    );
}

// Opens the popover of the filters, and returns it.
export async function openFilters(screen: Screen) {
  await screen.getByRole("button", { name: /^Filters/ }).click();
  const dialog = screen.getByRole("dialog", { name: "Filters" });
  await expect.element(dialog).toBeVisible();
  return dialog;
}

// Checks or unchecks a kind, with a click on its name, as its box covers
// its input.
export async function toggleKind(dialog: Locator, kind: string) {
  await dialog
    .getByRole("group", { name: "Kind" })
    .getByText(kind, { exact: true })
    .click();
}

// The kinds and the event types that each sends (docs/screens/ticket.md,
// Audit log).
export const KINDS = [
  [
    "Status",
    "status",
    [
      "ticket_created",
      "status_change",
      "duplicate_set",
      "duplicate_removed",
      "duplicate_target_changed",
    ],
  ],
  ["Assignment", "assignment", ["assignment"]],
  [
    "Packages",
    "packages",
    [
      "package_added",
      "package_maintainer_added",
      "package_excluded",
      "package_restored",
      "track_status_changed",
      "track_excluded",
      "track_restored",
      "product_released",
      "product_eligibility_changed",
      "product_excluded",
      "product_restored",
    ],
  ],
  [
    "CVE and CVSS",
    "cve",
    ["cve_associated", "cvss_assessment_changed", "severity_changed"],
  ],
  ["Priority", "priority", ["priority_changed"]],
  [
    "Confidentiality",
    "confidentiality",
    [
      "confidentiality_changed",
      "coordinated_release_changed",
      "access_grant_added",
      "access_grant_removed",
    ],
  ],
  [
    "References",
    "references",
    [
      "reference_added",
      "reference_deleted",
      "reference_url_changed",
      "reference_type_changed",
      "reference_title_changed",
      "reference_description_changed",
    ],
  ],
] as const;

// The event types of kinds as List Ticket Events receives them.
export function typesOf(...types: readonly string[]): string {
  return types.map((type) => `event_type=${type}`).join("&");
}
