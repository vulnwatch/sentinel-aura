import { focusManager, type QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { CircleQuestionMark } from "lucide-react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import {
  TicketAuditEventType,
  type CurrentUserResponse,
  type TicketAuditEventData,
} from "../api/generated/model";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import {
  actorsResponse,
  cvssResponse,
  errorResponse,
  eventPage,
  FICTIONAL_ACTORS,
  fictionalCve,
  fictionalEvent,
  fictionalTicketDetail,
  jsonResponse,
  OTHER_USER,
  referenceOf,
  requestsTo,
  sourcesResponse,
  stubApi,
  ticketPage,
  ticketResponse,
  urlOf,
} from "../test-api";

// The tab Audit log of the Ticket screen (docs/screens/ticket.md, Audit
// log), at the browser's default text size, in the light theme. Its dates
// and times are local times of the browser, sent in UTC as the API sends
// them, so that the tests hold in every time zone.

const ME = "/api/v1/users/me";
const TICKETS = "/api/v1/tickets";
const TICKET = "/api/v1/tickets/SNTL-12";
const EVENTS = "/api/v1/tickets/SNTL-12/audit-log";
const ACTORS = "/api/v1/tickets/SNTL-12/actors";
const CVSS = "/api/v1/cves/CVE-2099-0012/cvss";
const SOURCES = "/api/v1/cves/CVE-2099-0012/sources";
// The path of the tab.
const PATH = "/tickets/SNTL-12/audit-log";
// The read of the first page of the events, 50 a page.
const FIRST_PAGE = "page=1&per_page=50";
// fg-muted of the light theme.
const FG_MUTED = "rgb(89, 99, 110)";

const MESSAGE_UNAVAILABLE =
  "Sentinel isn't available right now. Try again later.";

// An actor of the Ticket, by username.
function actorNamed(username: string) {
  const actor = FICTIONAL_ACTORS.find((user) => user.username === username);
  if (actor === undefined) {
    throw new Error(`No actor ${username}`);
  }
  return actor;
}

// The signed-in user, who acted on the Ticket, and another actor.
const ALICE = referenceOf(OTHER_USER);
const ANA = actorNamed("agarcia");

// The package, the track, and the Product that the events name.
const PACKAGE = "fictional-openssl";
const TRACK = "SUSE:FLES-15-SP7:Update";
const PRODUCT = "Fictional Linux Enterprise Server 15 SP7";
const TRACK_DETAIL = { package: PACKAGE, track: TRACK };
const PRODUCT_DETAIL = {
  ...TRACK_DETAIL,
  product_name: PRODUCT,
  product_cpe: "cpe:/o:example:fles:15:sp7",
};
// The package and the track, and the Product of them, in a sentence.
const ON_TRACK = `${PACKAGE} · ${TRACK}`;
const OF_TRACK = `${PRODUCT} of ${ON_TRACK}`;

// The addresses of references, on another site, and as a sentence reads
// them.
const REFERENCE = "https://bugzilla.example.com/show_bug.cgi?id=1201";
const OTHER_REFERENCE = "https://lists.example.org/fictional/2099/11/1";
const READ_REFERENCE = `${REFERENCE} (another site)`;
const READ_OTHER_REFERENCE = `${OTHER_REFERENCE} (another site)`;

// Canonical CVSS assessment values (Sentinel
// docs/features/tickets/ticket-audit-log.md, Event Type Contract, Rules).
const NVD_VECTOR = "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H";
const SUSE_VECTOR = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N";

// A date and time of the API of a local time of the browser.
function at(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

// The first and the last instant of a local day, in UTC, which a period
// sends (docs/behaviors.md, Dates and Times, Input).
function startOf(date: string): string {
  const [year = 0, month = 0, day = 0] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

// The microsecond before the next local day starts.
function endOf(date: string): string {
  const [year = 0, month = 0, day = 0] = date.split("-").map(Number);
  return new Date(new Date(year, month - 1, day + 1).getTime() - 1)
    .toISOString()
    .replace(/\.(\d{3})Z$/, ".$1999Z");
}

// The events of a page, each with an identifier of its own and the fields
// that the test sets.
function eventsOf(
  ...fields: Partial<TicketAuditEventData>[]
): TicketAuditEventData[] {
  return fields.map((field, index) =>
    fictionalEvent({
      id: `00000000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`,
      ...field,
    }),
  );
}

// A page of a number of events, of a log of total events.
function pageOfEvents(count: number, total: number, number = 1): Response {
  return eventPage(eventsOf(...Array.from({ length: count }, () => ({}))), {
    total,
    page: number,
  });
}

let client: QueryClient;

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

type Responder = (query: URLSearchParams) => Response | Promise<Response>;

interface Stub {
  // The signed-in user.
  user: CurrentUserResponse;
  // The response to Get Ticket of the path.
  ticket: (path: string) => Response | Promise<Response>;
  // The response to List Ticket Events, given its query.
  events: Responder;
  // The response to List Ticket Actors.
  actors: () => Response | Promise<Response>;
}

// Answers the read of the signed-in user, Alice Smith, an analyst, Get
// Ticket, List Ticket Events, List Ticket Actors, and the reads of Overview,
// as the test sets them, and returns the stub, which a test can change, and
// the spy, whose calls name the requests.
function stubLog(fields: Partial<Stub> = {}) {
  const stub: Stub = {
    user: OTHER_USER,
    ticket: (path) =>
      ticketResponse(
        fictionalTicketDetail({ ticket_id: path.slice(TICKETS.length + 1) }),
      ),
    events: () => eventPage(eventsOf({})),
    actors: () => actorsResponse(),
    ...fields,
  };
  const spy = stubApi((request) => {
    if (request.path === ME) {
      return jsonResponse(200, stub.user);
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
function showing(...fields: Partial<TicketAuditEventData>[]) {
  return stubLog({ events: () => eventPage(eventsOf(...fields)) });
}

// Answers List Ticket Events with events whose fields hold values that the
// pinned contract does not list, which a later Sentinel release can return.
function showingUnlisted(...events: Record<string, unknown>[]) {
  return stubLog({
    events: () =>
      jsonResponse(200, {
        data: events,
        meta: { total: events.length, page: 1, per_page: 50 },
      }),
  });
}

// The paths of the requests to the API, other than the read of the
// signed-in user, in their order.
function pathsOf(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input).pathname)
    .filter((path) => path !== ME);
}

// The queries of the reads of the events, in their order, each parameter as
// its text.
function eventReads(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname === EVENTS)
    .map((url) =>
      [...url.searchParams].map(([key, value]) => `${key}=${value}`).join("&"),
    );
}

async function renderApp(path: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  return { router, screen };
}

type Screen = Awaited<ReturnType<typeof renderApp>>["screen"];

// Renders the tab and waits until it shows the Ticket.
async function renderLog(path = PATH) {
  const rendered = await renderApp(path);
  await expect.element(heading(rendered.screen, "SNTL-12")).toBeVisible();
  return rendered;
}

// Renders the tab and waits until it shows its events.
async function renderEvents(path = PATH) {
  const rendered = await renderLog(path);
  await expect
    .element(panelOf(rendered.screen).getByRole("listitem").first())
    .toBeVisible();
  return rendered;
}

function heading(screen: Screen, name: string) {
  return screen.getByRole("heading", { level: 1, name, exact: true });
}

function panelOf(screen: Screen) {
  return screen.getByRole("tabpanel", { name: "Audit log" });
}

function searchFieldOf(screen: Screen) {
  return screen.getByRole("searchbox", { name: "Search events" });
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
function readText(element: Element): string {
  return textOf(element).replace(/\s+/g, " ").trim();
}

// The sentences of the events that the tab shows, in their order, each
// starting with its actor.
function sentencesOf(screen: Screen): string[] {
  return panelOf(screen)
    .getByRole("listitem")
    .elements()
    .map((item) =>
      readText(page.elementLocator(item).getByRole("paragraph").element()),
    );
}

// The texts of the status regions of the screen that say something.
function announcementsOf(screen: Screen): string[] {
  return screen
    .getByRole("status")
    .elements()
    .map((region) => region.textContent)
    .filter((text) => text !== "");
}

// A response that the test gives when it chooses.
function later() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// The tab returns to the foreground after being hidden.
function returnToForeground() {
  focusManager.setFocused(false);
  focusManager.setFocused(true);
}

// Opens the popover of the filters, and returns it.
async function openFilters(screen: Screen) {
  await screen.getByRole("button", { name: /^Filters/ }).click();
  const dialog = screen.getByRole("dialog", { name: "Filters" });
  await expect.element(dialog).toBeVisible();
  return dialog;
}

// The select of the actor in the popover of the filters, named by the
// option that it shows and its name.
function actorSelectOf(dialog: Locator) {
  return dialog.getByRole("button", { name: /Actor$/ });
}

// Opens the options of the actor, and returns them.
async function openActors(dialog: Locator) {
  await actorSelectOf(dialog).click();
  const options = page.getByRole("listbox", { name: "Actor" });
  await expect.element(options).toBeVisible();
  return options;
}

// The menu of the options of the actor, which a popover of its own holds,
// named after the filter.
function actorMenuOf() {
  return page.getByRole("dialog", { name: "Actor" });
}

// The names of the options of a listbox, in their order.
function optionNames(listbox: Locator): string[] {
  return listbox
    .getByRole("option")
    .elements()
    .map((option) => readText(option));
}

// Checks or unchecks a kind, with a click on its name, as its box covers
// its input.
async function toggleKind(dialog: Locator, kind: string) {
  await dialog
    .getByRole("group", { name: "Kind" })
    .getByText(kind, { exact: true })
    .click();
}

// Types a date, such as 01112099, into a date field of the period, from its
// day.
async function typeDate(dialog: Locator, field: string, digits: string) {
  await dialog
    .getByRole("group", { name: field })
    .getByRole("spinbutton")
    .first()
    .click();
  await userEvent.keyboard(digits);
}

// The number of lines on which an element shows, by the tops of the boxes
// of its text.
function linesOf(element: Element): number {
  return new Set(
    [...element.getClientRects()].map((box) => Math.round(box.top)),
  ).size;
}

// The text of a sentence in runs of one font weight, in their order, as
// [weight, text], without what it hides from assistive technologies.
function weightRunsOf(sentence: Element): [string, string][] {
  const runs: [string, string][] = [];
  const walker = document.createTreeWalker(sentence, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent === null || parent.closest('[aria-hidden="true"]') !== null) {
      continue;
    }
    const weight = getComputedStyle(parent).fontWeight;
    const text = node.textContent ?? "";
    const last = runs.at(-1);
    if (last?.[0] === weight) {
      last[1] += text;
    } else {
      runs.push([weight, text]);
    }
  }
  return runs
    .map(([weight, text]): [string, string] => [
      weight,
      text.replace(/\s+/g, " ").trim(),
    ])
    .filter(([, text]) => text !== "");
}

// The elements in the order of the page.
function inPageOrder(...locators: Locator[]): Element[] {
  return locators
    .flatMap((locator) => locator.elements())
    .toSorted((first, second) =>
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1,
    );
}

describe("the tab", () => {
  test("shows the start of the tab that opens where the page had scrolled past it, 24 px below the compact heading, and keeps the page at its top otherwise", async () => {
    await page.viewport(1280, 400);
    stubLog({
      events: () => pageOfEvents(50, 50),
      ticket: () =>
        ticketResponse(
          fictionalTicketDetail({
            cve: fictionalCve({
              cwes: Array.from({ length: 200 }, (_, index) => ({
                cwe_id: `CWE-${String(index + 1000)}`,
                sources: ["nvd"],
              })),
            }),
          }),
        ),
    });
    const { screen } = await renderEvents();
    const tabs = screen.getByRole("tablist", { name: "Ticket" });
    const tabBottom = () =>
      tabs
        .getByRole("tab", { name: "Overview" })
        .element()
        .getBoundingClientRect().bottom;

    for (const [from, to] of [
      ["Audit log", "Overview"],
      ["Overview", "Audit log"],
    ] as const) {
      await expect
        .element(screen.getByRole("tabpanel", { name: from }))
        .toBeInTheDocument();
      window.scrollTo(0, 800);
      await expect
        .poll(
          () => getComputedStyle(heading(screen, "SNTL-12").element()).fontSize,
        )
        .toBe("16px");

      await tabs.getByRole("tab", { name: to }).click();

      const panel = screen.getByRole("tabpanel", { name: to });
      await expect.element(panel).toBeInTheDocument();
      await expect.poll(() => window.scrollY).toBeGreaterThan(0);
      await expect
        .poll(() => panel.element().getBoundingClientRect().top)
        .toBe(tabBottom() + 24);
    }

    window.scrollTo(0, 0);
    await tabs.getByRole("tab", { name: "Overview" }).click();
    await expect
      .element(screen.getByRole("tabpanel", { name: "Overview" }))
      .toBeInTheDocument();
    expect(window.scrollY).toBe(0);
  });

  test("opens at its path, selected, with Overview leading back to the path of the Ticket", async () => {
    stubLog();

    const { screen } = await renderEvents();

    const tabs = screen.getByRole("tablist", { name: "Ticket" });
    await expect
      .element(tabs.getByRole("tab", { name: "Audit log" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(tabs.getByRole("tab", { name: "Audit log" }))
      .toHaveAttribute("href", PATH);
    await expect
      .element(tabs.getByRole("tab", { name: "Overview" }))
      .toHaveAttribute("aria-selected", "false");
    await expect
      .element(tabs.getByRole("tab", { name: "Overview" }))
      .toHaveAttribute("href", "/tickets/SNTL-12");
    expect(document.title).toBe("SNTL-12 – Sentinel");
  });

  test("shows the toolbar, the tabs, and the events at once, while Get Ticket is still pending, and reads 50 events a page", async () => {
    const ticket = later();
    const { spy } = stubLog({ ticket: () => ticket.promise });

    const { screen } = await renderApp(PATH);

    await expect.element(heading(screen, "Ticket")).toBeVisible();
    await expect
      .element(screen.getByRole("tab", { name: "Audit log" }))
      .toHaveAttribute("aria-selected", "true");
    await expect.element(searchFieldOf(screen)).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Filters" }))
      .toBeVisible();
    await expect
      .poll(() => sentencesOf(screen))
      .toEqual(["Alice Smith changed the status from Analysis to Analyzed"]);
    expect(eventReads(spy)).toEqual([FIRST_PAGE]);
    await expect.element(heading(screen, "Ticket")).toBeVisible();

    ticket.resolve(ticketResponse(fictionalTicketDetail()));

    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
  });

  test("reads the Ticket, its events, and its actors as it opens, and none of the reads of Overview", async () => {
    const { spy } = stubLog();

    await renderEvents();

    await expect
      .poll(() => new Set(pathsOf(spy)))
      .toEqual(new Set([TICKET, EVENTS, ACTORS]));
    expect(pathsOf(spy)).toHaveLength(3);
  });

  test("opens at its path without parameters from the tab, and Overview without them either", async () => {
    stubLog();
    const { router, screen } = await renderEvents(`${PATH}?search=curl`);
    const tabs = screen.getByRole("tablist", { name: "Ticket" });
    await expect
      .element(tabs.getByRole("tab", { name: "Audit log" }))
      .toHaveAttribute("href", PATH);

    await tabs.getByRole("tab", { name: "Overview" }).click();

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets/SNTL-12");
    await expect
      .element(tabs.getByRole("tab", { name: "Overview" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(screen.getByRole("region", { name: "Details" }))
      .toBeVisible();

    await tabs.getByRole("tab", { name: "Audit log" }).click();

    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect.element(searchFieldOf(screen)).toHaveValue("");
  });

  test.each([
    [
      "a click",
      async (tab: Locator) => {
        await tab.click();
      },
    ],
    [
      "Enter",
      async (tab: Locator) => {
        tab.element().focus();
        await userEvent.keyboard("{Enter}");
      },
    ],
  ])(
    "keeps the focus on Audit log and on Overview, each opened with %s",
    async (_, open) => {
      stubLog();
      const { router, screen } = await renderLog("/tickets/SNTL-12");
      const tabs = screen.getByRole("tablist", { name: "Ticket" });
      const auditLog = tabs.getByRole("tab", { name: "Audit log" });
      const overview = tabs.getByRole("tab", { name: "Overview" });
      await expect
        .element(screen.getByRole("region", { name: "Details" }))
        .toBeVisible();

      await open(auditLog);

      await expect.poll(() => router.state.location.href).toBe(PATH);
      await expect
        .poll(() => sentencesOf(screen))
        .toEqual(["Alice Smith changed the status from Analysis to Analyzed"]);
      await expect.element(auditLog).toHaveAttribute("aria-selected", "true");
      await expect.element(auditLog).toHaveFocus();

      await open(overview);

      await expect
        .poll(() => router.state.location.href)
        .toBe("/tickets/SNTL-12");
      await expect
        .element(screen.getByRole("region", { name: "Details" }))
        .toBeVisible();
      await expect.element(overview).toHaveFocus();
    },
  );

  test("opens the Overview of the Ticket that a link of an event names, once that Ticket has arrived, and moves the focus to its heading", async () => {
    showing({
      event_type: "duplicate_set",
      old_value: null,
      new_value: "SNTL-21",
    });
    const { router, screen } = await renderEvents();
    // Every heading that the page shows on the way, such as that of the
    // failure of the UI itself.
    const shown = new Set<string>();
    const observer = new MutationObserver(() => {
      for (const title of document.querySelectorAll("h1")) {
        shown.add(title.textContent);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    await panelOf(screen).getByRole("link", { name: "SNTL-21" }).click();

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets/SNTL-21");
    await expect.element(heading(screen, "SNTL-21")).toHaveFocus();
    await expect
      .element(screen.getByRole("region", { name: "Details" }))
      .toBeVisible();
    observer.disconnect();
    expect(
      [...shown].filter((title) => !/^(SNTL-\d+|Ticket)$/.test(title)),
    ).toEqual([]);
  });

  test("shows the warning of a later read of the Ticket that fails at the top of the panel, with Try again, and keeps the Ticket and the events", async () => {
    const { stub } = stubLog();
    const { screen } = await renderEvents();
    const panel = panelOf(screen);

    stub.ticket = () => errorResponse(503, "DATABASE_UNAVAILABLE");
    returnToForeground();

    const warning = panel.getByText(
      `This couldn't be updated. ${MESSAGE_UNAVAILABLE}`,
    );
    await expect.element(warning).toBeVisible();
    expect(warning.element().closest("output")).not.toBeNull();
    // Above the toolbar, the first content of the panel.
    expect(
      warning
        .element()
        .compareDocumentPosition(searchFieldOf(screen).element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
    expect(sentencesOf(screen)).toEqual([
      "Alice Smith changed the status from Analysis to Analyzed",
    ]);

    // While the Ticket is read again, it is marked as being updated.
    const ticket = later();
    stub.ticket = () => ticket.promise;
    await panel.getByRole("button", { name: "Try again" }).click();

    await expect
      .element(panel.getByRole("progressbar", { name: "Updating" }))
      .toBeVisible();
    await expect.element(warning).not.toBeInTheDocument();

    ticket.resolve(ticketResponse(fictionalTicketDetail()));

    await expect
      .element(panel.getByRole("progressbar", { name: "Updating" }))
      .not.toBeInTheDocument();
    expect(panel.getByText(/couldn't be updated/).elements()).toHaveLength(0);
  });

  test("shows Not found in place of the screen when a later read of the Ticket answers that it does not exist or that the user cannot see it", async () => {
    const { stub } = stubLog();
    const { screen } = await renderEvents();

    stub.ticket = () => errorResponse(404, "TICKET_NOT_FOUND");
    returnToForeground();

    await expect.element(heading(screen, "Not found")).toBeVisible();
    await expect
      .element(screen.getByRole("tablist", { name: "Ticket" }))
      .not.toBeInTheDocument();
    await expect.element(searchFieldOf(screen)).not.toBeInTheDocument();
    expect(
      screen
        .getByText("Alice Smith changed the status from Analysis to Analyzed")
        .elements(),
    ).toHaveLength(0);
  });
});

// The sentence of each event type and its variants (docs/screens/ticket.md,
// Audit log), as events of a page, with the sentences that the tab shows,
// each after its actor.
const SENTENCES: [
  TicketAuditEventType,
  Partial<TicketAuditEventData>[],
  string[],
][] = [
  [
    "ticket_created",
    [
      {
        event_type: "ticket_created",
        old_value: null,
        new_value: null,
        actor: null,
        comment: "CVE ingested from NVD",
      },
      {
        event_type: "ticket_created",
        old_value: null,
        new_value: null,
        comment: "Ticket created manually",
      },
    ],
    [
      "System created the Ticket from its CVE, ingested from NVD",
      "Alice Smith created the Ticket",
    ],
  ],
  [
    "status_change",
    [
      {},
      {
        old_value: "New",
        new_value: "Ignored",
        detail: { ignore_reason: "not_shipped" },
      },
      {
        old_value: "Analysis",
        new_value: "Ignored",
        detail: { ignore_reason: "other" },
      },
      {
        actor: null,
        old_value: "New",
        new_value: "Ignored",
        comment: "CVE rejected",
        detail: { ignore_reason: "cve_rejected" },
      },
      {
        actor: null,
        old_value: "New",
        new_value: "Ignored",
        comment: "CNA auto-ignore policy",
        detail: { ignore_reason: "cna_policy" },
      },
      // Recorded before the reason existed, so its comment follows it.
      {
        actor: null,
        old_value: "New",
        new_value: "Ignored",
        comment: "CVE rejected",
      },
      // A reason that the pinned contract does not list.
      {
        old_value: "New",
        new_value: "Ignored",
        detail: { ignore_reason: "fictional_reason" },
      },
    ],
    [
      "Alice Smith changed the status from Analysis to Analyzed",
      "Alice Smith ignored the Ticket as Not shipped, from New",
      "Alice Smith ignored the Ticket as Other, from Analysis",
      "System ignored the Ticket as CVE rejected, from New",
      "System ignored the Ticket as CNA policy, from New",
      "System changed the status from New to Ignored · CVE rejected",
      "Alice Smith ignored the Ticket as fictional_reason, from New",
    ],
  ],
  [
    "assignment",
    [
      { event_type: "assignment", old_value: null, new_value: "bwilson" },
      { event_type: "assignment", old_value: "asmith", new_value: "bwilson" },
      { event_type: "assignment", old_value: "asmith", new_value: null },
      {
        event_type: "assignment",
        actor: null,
        old_value: "eblack",
        new_value: null,
        comment: "Unassigned from eblack: user deactivated",
      },
      {
        event_type: "assignment",
        actor: null,
        old_value: "eblack",
        new_value: null,
        comment: "Unassigned from eblack: role removed by external sync",
      },
    ],
    [
      "Alice Smith assigned the Ticket to @bwilson",
      "Alice Smith reassigned the Ticket from @asmith to @bwilson",
      "Alice Smith unassigned @asmith",
      "System unassigned @eblack: user deactivated",
      "System unassigned @eblack: role removed by external sync",
    ],
  ],
  [
    "duplicate_set",
    [{ event_type: "duplicate_set", old_value: null, new_value: "SNTL-21" }],
    ["Alice Smith marked the Ticket as a duplicate of SNTL-21"],
  ],
  [
    "duplicate_removed",
    [
      {
        event_type: "duplicate_removed",
        old_value: "SNTL-21",
        new_value: null,
      },
    ],
    ["Alice Smith reverted the duplicate of SNTL-21"],
  ],
  [
    "duplicate_target_changed",
    [
      {
        event_type: "duplicate_target_changed",
        actor: null,
        old_value: "SNTL-22",
        new_value: "SNTL-21",
        detail: { triggered_by_ticket: "SNTL-22" },
      },
    ],
    [
      "System changed the original from SNTL-22 to SNTL-21, as SNTL-22 was marked as a duplicate",
    ],
  ],
  [
    "package_added",
    [
      { event_type: "package_added", old_value: null, new_value: PACKAGE },
      {
        event_type: "package_added",
        actor: null,
        old_value: null,
        new_value: PACKAGE,
        comment: "CVE package resolution",
      },
    ],
    [
      `Alice Smith added or completed the package ${PACKAGE}`,
      `System added or completed the package ${PACKAGE} · CVE package resolution`,
    ],
  ],
  [
    "package_maintainer_added",
    [
      {
        event_type: "package_maintainer_added",
        actor: null,
        old_value: null,
        new_value: "ghill",
        detail: { package: PACKAGE },
      },
    ],
    [`System added the maintainer @ghill to ${PACKAGE}`],
  ],
  [
    "package_excluded",
    [{ event_type: "package_excluded", old_value: PACKAGE, new_value: null }],
    [`Alice Smith excluded the package ${PACKAGE}`],
  ],
  [
    "package_restored",
    [{ event_type: "package_restored", old_value: null, new_value: PACKAGE }],
    [`Alice Smith restored the package ${PACKAGE}`],
  ],
  [
    "track_status_changed",
    [
      {
        event_type: "track_status_changed",
        old_value: "ANALYSIS",
        new_value: "AFFECTED",
        detail: TRACK_DETAIL,
      },
      {
        event_type: "track_status_changed",
        old_value: "AFFECTED",
        new_value: "NOT_AFFECTED",
        detail: TRACK_DETAIL,
      },
      {
        event_type: "track_status_changed",
        actor: null,
        old_value: "AFFECTED",
        new_value: "FIXED",
        detail: TRACK_DETAIL,
      },
      {
        event_type: "track_status_changed",
        old_value: "ANALYSIS",
        new_value: "WONT_FIX",
        detail: TRACK_DETAIL,
      },
      // A track status that the pinned contract does not list.
      {
        event_type: "track_status_changed",
        old_value: "ANALYSIS",
        new_value: "FICTIONAL_STATUS",
        detail: TRACK_DETAIL,
      },
    ],
    [
      `Alice Smith set ${ON_TRACK} from Analysis to Affected`,
      `Alice Smith set ${ON_TRACK} from Affected to Not affected`,
      `System set ${ON_TRACK} from Affected to Fixed`,
      `Alice Smith set ${ON_TRACK} from Analysis to Won't fix`,
      `Alice Smith set ${ON_TRACK} from Analysis to FICTIONAL_STATUS`,
    ],
  ],
  [
    "track_excluded",
    [
      {
        event_type: "track_excluded",
        old_value: TRACK,
        new_value: null,
        detail: TRACK_DETAIL,
      },
    ],
    [`Alice Smith excluded the track ${ON_TRACK}`],
  ],
  [
    "track_restored",
    [
      {
        event_type: "track_restored",
        old_value: null,
        new_value: TRACK,
        detail: TRACK_DETAIL,
      },
    ],
    [`Alice Smith restored the track ${ON_TRACK}`],
  ],
  [
    "product_released",
    [
      {
        event_type: "product_released",
        actor: null,
        old_value: null,
        new_value: at(2099, 11, 8, 13, 5),
        detail: { ...PRODUCT_DETAIL, advisory_id: "SUSE-SU-2099:0001-1" },
      },
    ],
    [
      `System recorded the release of ${OF_TRACK} on 8 Nov 2099, 13:05, in SUSE-SU-2099:0001-1`,
    ],
  ],
  [
    "product_eligibility_changed",
    [
      {
        event_type: "product_eligibility_changed",
        actor: null,
        old_value: "false",
        new_value: "true",
        detail: { ...PRODUCT_DETAIL, reason: "cvss" },
      },
      {
        event_type: "product_eligibility_changed",
        actor: null,
        old_value: "true",
        new_value: "false",
        detail: { ...PRODUCT_DETAIL, reason: "threshold" },
      },
      {
        event_type: "product_eligibility_changed",
        actor: null,
        old_value: "true",
        new_value: "false",
        detail: { ...PRODUCT_DETAIL, reason: "reactive_ltss" },
      },
      {
        event_type: "product_eligibility_changed",
        actor: null,
        old_value: "false",
        new_value: "true",
        detail: { ...PRODUCT_DETAIL, reason: "reactivation" },
      },
      {
        event_type: "product_eligibility_changed",
        old_value: "true",
        new_value: "false",
        detail: {
          ...PRODUCT_DETAIL,
          reason: "va_override",
          override_action: "set",
        },
      },
      {
        event_type: "product_eligibility_changed",
        old_value: "false",
        new_value: "true",
        detail: {
          ...PRODUCT_DETAIL,
          reason: "va_override",
          override_action: "changed",
        },
      },
      {
        event_type: "product_eligibility_changed",
        old_value: "false",
        new_value: "true",
        detail: {
          ...PRODUCT_DETAIL,
          reason: "va_override",
          override_action: "cleared",
        },
      },
      // A reason that the pinned contract does not list.
      {
        event_type: "product_eligibility_changed",
        actor: null,
        old_value: "false",
        new_value: "true",
        detail: { ...PRODUCT_DETAIL, reason: "fictional_reason" },
      },
    ],
    [
      `System made ${OF_TRACK} eligible after a change of the CVSS assessments or of the default CVSS version`,
      `System made ${OF_TRACK} not eligible after a change of its CVSS threshold`,
      `System made ${OF_TRACK} not eligible after a change of its lifecycle phase`,
      `System made ${OF_TRACK} eligible as the Ticket left Ignored or Duplicated`,
      `Alice Smith set ${OF_TRACK} as not eligible by hand`,
      `Alice Smith set ${OF_TRACK} as eligible by hand`,
      `Alice Smith returned ${OF_TRACK} to automatic eligibility, eligible`,
      `System made ${OF_TRACK} eligible, fictional_reason`,
    ],
  ],
  [
    "product_excluded",
    [
      {
        event_type: "product_excluded",
        old_value: PRODUCT,
        new_value: null,
        detail: PRODUCT_DETAIL,
      },
    ],
    [`Alice Smith excluded ${PRODUCT} from ${ON_TRACK}`],
  ],
  [
    "product_restored",
    [
      {
        event_type: "product_restored",
        old_value: null,
        new_value: PRODUCT,
        detail: PRODUCT_DETAIL,
      },
    ],
    [`Alice Smith restored ${PRODUCT} on ${ON_TRACK}`],
  ],
  [
    "cve_associated",
    [
      {
        event_type: "cve_associated",
        old_value: null,
        new_value: "CVE-2099-0021",
      },
    ],
    ["Alice Smith associated CVE-2099-0021"],
  ],
  [
    "severity_changed",
    [
      {
        event_type: "severity_changed",
        actor: null,
        old_value: null,
        new_value: "High",
      },
      {
        event_type: "severity_changed",
        actor: null,
        old_value: "High",
        new_value: "Critical",
      },
      { event_type: "severity_changed", old_value: "High", new_value: null },
    ],
    [
      "System set the severity to High",
      "System changed the severity from High to Critical",
      "Alice Smith removed the severity High",
    ],
  ],
  [
    "priority_changed",
    [
      {
        event_type: "priority_changed",
        actor: null,
        old_value: null,
        new_value: "P3",
      },
      {
        event_type: "priority_changed",
        actor: null,
        old_value: "P3",
        new_value: "P2",
      },
      {
        event_type: "priority_changed",
        actor: null,
        old_value: "P3",
        new_value: null,
      },
      {
        event_type: "priority_changed",
        old_value: "P3",
        new_value: "P1",
        detail: { override_action: "set" },
      },
      {
        event_type: "priority_changed",
        old_value: "P1",
        new_value: "P2",
        detail: { override_action: "changed" },
      },
      {
        event_type: "priority_changed",
        old_value: "P1",
        new_value: "P3",
        detail: { override_action: "cleared" },
      },
    ],
    [
      "System set the priority to P3",
      "System changed the priority from P3 to P2",
      "System changed the priority from P3 to Not set",
      "Alice Smith overrode the priority from P3 to P1",
      "Alice Smith changed the priority override from P1 to P2",
      "Alice Smith cleared the priority override, from P1 to P3",
    ],
  ],
  [
    "cvss_assessment_changed",
    [
      {
        event_type: "cvss_assessment_changed",
        actor: null,
        old_value: null,
        new_value: `NVD v3.1 ${NVD_VECTOR} (8.1)`,
      },
      {
        event_type: "cvss_assessment_changed",
        old_value: `SUSE v3.1 ${SUSE_VECTOR} (7.5)`,
        new_value: `SUSE v3.1 ${NVD_VECTOR} (8.1)`,
      },
      {
        event_type: "cvss_assessment_changed",
        old_value: `SUSE v3.1 ${NVD_VECTOR} (8.1)`,
        new_value: null,
      },
      // A value of another form than the canonical one.
      {
        event_type: "cvss_assessment_changed",
        actor: null,
        old_value: null,
        new_value: "NVD fictional assessment",
      },
    ],
    [
      `System added the NVD CVSS v3.1 assessment 8.1, ${NVD_VECTOR}`,
      `Alice Smith changed the SUSE CVSS v3.1 assessment from 7.5, ${SUSE_VECTOR} to 8.1, ${NVD_VECTOR}`,
      `Alice Smith deleted the SUSE CVSS v3.1 assessment 8.1, ${NVD_VECTOR}`,
      "System added a CVSS assessment NVD fictional assessment",
    ],
  ],
  [
    "confidentiality_changed",
    [
      {
        event_type: "confidentiality_changed",
        old_value: "false",
        new_value: "true",
      },
      {
        event_type: "confidentiality_changed",
        old_value: "true",
        new_value: "false",
      },
    ],
    [
      "Alice Smith made the Ticket confidential",
      "Alice Smith made the Ticket non-confidential",
    ],
  ],
  [
    "coordinated_release_changed",
    [
      {
        event_type: "coordinated_release_changed",
        old_value: null,
        new_value: at(2099, 11, 25, 14, 0),
      },
      {
        event_type: "coordinated_release_changed",
        old_value: at(2099, 11, 25, 14, 0),
        new_value: at(2099, 12, 2, 9, 30),
      },
      {
        event_type: "coordinated_release_changed",
        old_value: at(2099, 11, 25, 14, 0),
        new_value: null,
      },
    ],
    [
      "Alice Smith set the Coordinated Release Date to 25 Nov 2099, 14:00",
      "Alice Smith changed the Coordinated Release Date from 25 Nov 2099, 14:00 to 2 Dec 2099, 09:30",
      "Alice Smith removed the Coordinated Release Date 25 Nov 2099, 14:00",
    ],
  ],
  [
    "access_grant_added",
    [
      {
        event_type: "access_grant_added",
        old_value: null,
        new_value: "cwhite",
      },
    ],
    ["Alice Smith granted access to @cwhite"],
  ],
  [
    "access_grant_removed",
    [
      {
        event_type: "access_grant_removed",
        old_value: "cwhite",
        new_value: null,
      },
    ],
    ["Alice Smith revoked the access of @cwhite"],
  ],
  [
    "reference_added",
    [{ event_type: "reference_added", old_value: null, new_value: REFERENCE }],
    [`Alice Smith added the reference ${READ_REFERENCE}`],
  ],
  [
    "reference_deleted",
    [
      {
        event_type: "reference_deleted",
        old_value: REFERENCE,
        new_value: null,
      },
    ],
    [`Alice Smith deleted the reference ${READ_REFERENCE}`],
  ],
  [
    "reference_url_changed",
    [
      {
        event_type: "reference_url_changed",
        old_value: REFERENCE,
        new_value: OTHER_REFERENCE,
      },
    ],
    [
      `Alice Smith changed the address of a reference from ${READ_REFERENCE} to ${READ_OTHER_REFERENCE}`,
    ],
  ],
  [
    "reference_type_changed",
    [
      {
        event_type: "reference_type_changed",
        old_value: "article",
        new_value: "advisory",
        detail: { url: REFERENCE },
      },
      {
        event_type: "reference_type_changed",
        old_value: null,
        new_value: "patch",
        detail: { url: REFERENCE },
      },
      {
        event_type: "reference_type_changed",
        old_value: "issue",
        new_value: null,
        detail: { url: REFERENCE },
      },
      // A reference type that the pinned contract does not list.
      {
        event_type: "reference_type_changed",
        old_value: "article",
        new_value: "fictional_type",
        detail: { url: REFERENCE },
      },
    ],
    [
      `Alice Smith changed the type of ${READ_REFERENCE} from Article to Advisory`,
      `Alice Smith changed the type of ${READ_REFERENCE} from Uncategorized to Patch`,
      `Alice Smith changed the type of ${READ_REFERENCE} from Issue to Uncategorized`,
      `Alice Smith changed the type of ${READ_REFERENCE} from Article to fictional_type`,
    ],
  ],
  [
    "reference_title_changed",
    [
      {
        event_type: "reference_title_changed",
        old_value: "Fictional advisory draft",
        new_value: "Fictional advisory",
        detail: { url: REFERENCE },
      },
      {
        event_type: "reference_title_changed",
        old_value: null,
        new_value: "Fictional advisory",
        detail: { url: REFERENCE },
      },
      {
        event_type: "reference_title_changed",
        old_value: "Fictional advisory",
        new_value: null,
        detail: { url: REFERENCE },
      },
    ],
    [
      `Alice Smith changed the title of ${READ_REFERENCE} from “Fictional advisory draft” to “Fictional advisory”`,
      `Alice Smith set the title of ${READ_REFERENCE} to “Fictional advisory”`,
      `Alice Smith removed the title “Fictional advisory” of ${READ_REFERENCE}`,
    ],
  ],
  [
    "reference_description_changed",
    [
      {
        event_type: "reference_description_changed",
        old_value: "A fictional draft description.",
        new_value: "A fictional description.",
        detail: { url: REFERENCE },
      },
      {
        event_type: "reference_description_changed",
        old_value: null,
        new_value: "A fictional description.",
        detail: { url: REFERENCE },
      },
      {
        event_type: "reference_description_changed",
        old_value: "A fictional description.",
        new_value: null,
        detail: { url: REFERENCE },
      },
    ],
    [
      `Alice Smith changed the description of ${READ_REFERENCE} from “A fictional draft description.” to “A fictional description.”`,
      `Alice Smith set the description of ${READ_REFERENCE} to “A fictional description.”`,
      `Alice Smith removed the description “A fictional description.” of ${READ_REFERENCE}`,
    ],
  ],
];

describe("the sentences", () => {
  test("cover every event type of the pinned contract", () => {
    expect(SENTENCES.map(([type]) => type).toSorted()).toEqual(
      Object.values(TicketAuditEventType).toSorted(),
    );
  });

  test.each(SENTENCES)(
    "say what the actor of %s did",
    async (_, events, sentences) => {
      showing(...events);

      const { screen } = await renderEvents();

      expect(sentencesOf(screen)).toEqual(sentences);
    },
  );

  test.each([
    [
      "a track status change without its track",
      {
        event_type: "track_status_changed",
        old_value: "ANALYSIS",
        new_value: "AFFECTED",
      },
      "Alice Smith set a track from Analysis to Affected",
    ],
    [
      "an exclusion of a Product without its subject, by its name",
      { event_type: "product_excluded", old_value: PRODUCT, new_value: null },
      `Alice Smith excluded ${PRODUCT} from a track`,
    ],
    [
      "a change of eligibility without its subject and reason",
      {
        event_type: "product_eligibility_changed",
        actor: null,
        old_value: "false",
        new_value: "true",
      },
      "System made a Product of a track eligible",
    ],
    [
      "a release without its advisory",
      {
        event_type: "product_released",
        actor: null,
        old_value: null,
        new_value: at(2099, 11, 8, 13, 5),
        detail: PRODUCT_DETAIL,
      },
      `System recorded the release of ${OF_TRACK} on 8 Nov 2099, 13:05`,
    ],
    [
      "a change of the original without the Ticket that triggered it",
      {
        event_type: "duplicate_target_changed",
        actor: null,
        old_value: "SNTL-22",
        new_value: "SNTL-21",
      },
      "System changed the original from SNTL-22 to SNTL-21",
    ],
    [
      "a maintainer added without the package",
      {
        event_type: "package_maintainer_added",
        actor: null,
        old_value: null,
        new_value: "ghill",
      },
      "System added the maintainer @ghill",
    ],
    [
      "a change of the confidentiality with a value of another form",
      {
        event_type: "confidentiality_changed",
        old_value: "false",
        new_value: "fictional",
      },
      "Alice Smith changed the confidentiality from false to fictional",
    ],
    [
      "a change of the type without its reference",
      {
        event_type: "reference_type_changed",
        old_value: "article",
        new_value: "advisory",
      },
      "Alice Smith changed the type of a reference from Article to Advisory",
    ],
    [
      "a change of the title without its reference",
      {
        event_type: "reference_title_changed",
        old_value: null,
        new_value: "Fictional advisory",
      },
      "Alice Smith set the title of a reference to “Fictional advisory”",
    ],
    [
      "a comment that the sentence does not say",
      {
        event_type: "ticket_created",
        old_value: null,
        new_value: null,
        comment: "Fictional import",
      },
      "Alice Smith created the Ticket · Fictional import",
    ],
  ] as const)("say what the fields of %s hold", async (_, fields, sentence) => {
    showing(fields);

    const { screen } = await renderEvents();

    expect(sentencesOf(screen)).toEqual([sentence]);
  });

  // The override actions of the pinned contract are set, changed, and
  // cleared (Sentinel docs/features/tickets/ticket-audit-log.md, detail
  // JSONB Schema Contract).
  test.each([
    [
      "a change of the priority, as the change of an automatic priority",
      {
        event_type: "priority_changed",
        old_value: "P3",
        new_value: "P1",
        detail: { override_action: "fictional_action" },
      },
      "Alice Smith changed the priority from P3 to P1",
    ],
    [
      "a change of eligibility by hand, as an override that is set",
      {
        event_type: "product_eligibility_changed",
        old_value: "true",
        new_value: "false",
        detail: {
          ...PRODUCT_DETAIL,
          reason: "va_override",
          override_action: "fictional_action",
        },
      },
      `Alice Smith set ${OF_TRACK} as not eligible by hand`,
    ],
  ] as const)(
    "say what the actor of %s did with an override action that the pinned contract does not list",
    async (_, fields, sentence) => {
      showing(fields);

      const { screen } = await renderEvents();

      expect(sentencesOf(screen)).toEqual([sentence]);
      expect(panelOf(screen).element().textContent).not.toContain(
        "fictional_action",
      );
    },
  );

  test("show an event type that the pinned contract does not list by its actor and its type as received, with its time and none of its values", async () => {
    const created = at(2099, 11, 8, 14, 10);
    showingUnlisted({
      ...fictionalEvent({ created_at: created }),
      event_type: "fictional_event",
      old_value: "fictional-old-value",
      new_value: "fictional-new-value",
      detail: { fictional_key: "fictional-detail" },
    });

    const { screen } = await renderEvents();

    expect(sentencesOf(screen)).toEqual(["Alice Smith fictional_event"]);
    const item = panelOf(screen).getByRole("listitem");
    expect(readText(item.element())).toBe("14:10 Alice Smith fictional_event");
    expect(panelOf(screen).element().textContent).not.toMatch(/fictional-/);
  });

  test("mark each event with the icon of its kind, as the kinds of the filters show it, and an event type that the pinned contract does not list with circle-question-mark", async () => {
    showingUnlisted(
      ...[
        "ticket_created",
        "assignment",
        "package_added",
        "severity_changed",
        "priority_changed",
        "access_grant_added",
        "reference_added",
        "fictional_event",
      ].map((type, index) => ({
        ...fictionalEvent({
          id: `00000000-0000-7000-8000-00000000000${String(index + 1)}`,
          old_value: null,
          new_value: null,
        }),
        event_type: type,
      })),
    );
    const { screen } = await renderEvents();
    // The marker, hidden from assistive technologies, comes first in its
    // row, before the avatar of the actor.
    const markers = panelOf(screen)
      .getByRole("listitem")
      .elements()
      .map((item) => item.querySelector("svg"));
    const unknown = await render(<CircleQuestionMark />);
    const questionMark = unknown.container.querySelector("svg")?.innerHTML;

    const dialog = await openFilters(screen);

    const kinds = dialog.getByRole("group", { name: "Kind" });
    const icons = [
      "Status",
      "Assignment",
      "Packages",
      "CVE and CVSS",
      "Priority",
      "Confidentiality",
      "References",
    ].map(
      (kind) =>
        kinds.getByText(kind, { exact: true }).element().querySelector("svg")
          ?.innerHTML,
    );
    expect(new Set(icons).size).toBe(7);
    expect(markers.map((marker) => marker?.innerHTML)).toEqual([
      ...icons,
      questionMark,
    ]);
    expect(
      markers.every(
        (marker) => marker?.closest('[aria-hidden="true"]') !== null,
      ),
    ).toBe(true);
  });

  test("link each Ticket identifier to its screen, and show a value of another form as text", async () => {
    showing(
      {
        event_type: "duplicate_target_changed",
        actor: null,
        old_value: "SNTL-22",
        new_value: "SNTL-21",
        detail: { triggered_by_ticket: "SNTL-22" },
      },
      { event_type: "duplicate_set", old_value: null, new_value: "SNTL-0021" },
    );

    const { screen } = await renderEvents();

    const links = panelOf(screen).getByRole("link");
    expect(
      links
        .elements()
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["SNTL-22", "/tickets/SNTL-22"],
      ["SNTL-21", "/tickets/SNTL-21"],
      ["SNTL-22", "/tickets/SNTL-22"],
    ]);
    expect(sentencesOf(screen)[1]).toBe(
      "Alice Smith marked the Ticket as a duplicate of SNTL-0021",
    );
  });

  test("link the address of a reference to the address as the browser parses it, and show a value that is not a web address as text", async () => {
    showing(
      {
        event_type: "reference_added",
        old_value: null,
        new_value: "HTTPS://Bugzilla.Example.COM/show_bug.cgi?id=1201",
      },
      {
        event_type: "reference_added",
        old_value: null,
        new_value: "pkg:rpm/suse/fictional-openssl",
      },
    );

    const { screen } = await renderEvents();

    const link = panelOf(screen).getByRole("link", {
      name: READ_REFERENCE,
      exact: true,
    });
    await expect.element(link).toHaveAttribute("href", REFERENCE);
    expect(panelOf(screen).getByRole("link").elements()).toHaveLength(1);
    expect(sentencesOf(screen)).toEqual([
      `Alice Smith added the reference ${READ_REFERENCE}`,
      "Alice Smith added the reference pkg:rpm/suse/fictional-openssl",
    ]);
  });

  test("show at weight 500 only the actor, the objects of a sentence, and the usernames that an event records, and its values at weight 400", async () => {
    showing(
      { event_type: "assignment", old_value: null, new_value: "bwilson" },
      {
        event_type: "track_status_changed",
        old_value: "ANALYSIS",
        new_value: "AFFECTED",
        detail: TRACK_DETAIL,
      },
    );

    const { screen } = await renderEvents();

    const [assignment, track] = panelOf(screen)
      .getByRole("paragraph")
      .elements();
    if (assignment === undefined || track === undefined) {
      throw new Error("The tab shows no two events");
    }
    expect(weightRunsOf(assignment)).toEqual([
      ["500", "Alice Smith"],
      ["400", "assigned the Ticket to"],
      ["500", "@bwilson"],
    ]);
    expect(weightRunsOf(track)).toEqual([
      ["500", "Alice Smith"],
      ["400", "set"],
      ["500", ON_TRACK],
      ["400", "from Analysis to Affected"],
    ]);
    // A username alone, without an avatar or labels.
    expect(
      page
        .elementLocator(assignment)
        .getByText("@bwilson", { exact: true })
        .element()
        .querySelector("svg"),
    ).toBeNull();
  });

  test.each([
    ["a person", ALICE, "14px"],
    ["the system", null, "13px"],
  ])(
    "show the vector of an assessment that %s changed in monospace, at the size of its sentence",
    async (_, actor, size) => {
      showing({
        event_type: "cvss_assessment_changed",
        actor,
        old_value: null,
        new_value: `NVD v3.1 ${NVD_VECTOR} (8.1)`,
      });

      const { screen } = await renderEvents();

      const sentence = panelOf(screen).getByRole("paragraph").element();
      const vector = getComputedStyle(
        panelOf(screen).getByText(NVD_VECTOR, { exact: true }).element(),
      );
      expect(vector.fontFamily).toContain("monospace");
      expect([getComputedStyle(sentence).fontSize, vector.fontSize]).toEqual([
        size,
        size,
      ]);
    },
  );

  test("break a vector only after a slash at 320 CSS pixels, never within a metric", async () => {
    await page.viewport(320, 640);
    const vector =
      "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N";
    showing({
      event_type: "cvss_assessment_changed",
      old_value: null,
      new_value: `SUSE v4.0 ${vector} (9.3)`,
    });

    const { screen } = await renderEvents();

    const shown = panelOf(screen).getByText(vector, { exact: true }).element();
    // The vector takes several lines of its sentence.
    expect(linesOf(shown)).toBeGreaterThan(1);
    // Each metric, with the slash after it, on one line.
    const metrics = [...shown.children];
    expect(metrics.map((metric) => metric.textContent)).toEqual(
      vector
        .split("/")
        .map((metric, index, all) =>
          index < all.length - 1 ? `${metric}/` : metric,
        ),
    );
    for (const metric of metrics) {
      expect(linesOf(metric)).toBe(1);
    }
    expect(document.documentElement.scrollWidth).toBe(
      document.documentElement.clientWidth,
    );
  });

  test("keep none of the line breaks of a text", async () => {
    showing({
      event_type: "reference_title_changed",
      old_value: null,
      new_value: "Fictional\nadvisory",
      detail: { url: REFERENCE },
    });

    const { screen } = await renderEvents();

    const sentence = panelOf(screen).getByRole("paragraph").element();
    if (!(sentence instanceof HTMLElement)) {
      throw new Error("The sentence is not an HTML element");
    }
    // The text as the page renders it.
    expect(sentence.innerText).toContain("“Fictional advisory”");
  });

  test("wrap an address at any character at 320 CSS pixels, without scrolling in two directions", async () => {
    await page.viewport(320, 640);
    showing({
      event_type: "reference_added",
      old_value: null,
      new_value: `https://bugzilla.example.com/${"fictional_path_".repeat(8)}`,
    });

    await renderEvents();

    expect(document.documentElement.scrollWidth).toBe(
      document.documentElement.clientWidth,
    );
  });
});

describe("the events", () => {
  test("are grouped by the local day of their date, newest first, each day a level-two heading, and each event with its time", async () => {
    showing(
      { created_at: at(2099, 11, 8, 14, 10) },
      { created_at: at(2099, 11, 8, 9, 5), actor: null },
      { created_at: at(2099, 11, 7, 23, 59), actor: ANA },
    );

    const { screen } = await renderEvents();

    const panel = panelOf(screen);
    expect(
      inPageOrder(
        panel.getByRole("heading", { level: 2 }),
        panel.getByRole("listitem"),
      ).map(readText),
    ).toEqual([
      "8 Nov 2099",
      "14:10 Alice Smith changed the status from Analysis to Analyzed",
      "09:05 System changed the status from Analysis to Analyzed",
      "7 Nov 2099",
      "23:59 Ana Garcia changed the status from Analysis to Analyzed",
    ]);
    const days = panel.getByRole("list");
    expect(
      days
        .elements()
        .map(
          (day) =>
            page.elementLocator(day).getByRole("listitem").elements().length,
        ),
    ).toEqual([2, 1]);
  });

  test("start with the actor in the full form, System without one, and the labels of a user", async () => {
    const [, , bot, inactive] = FICTIONAL_ACTORS;
    showing({}, { actor: null }, { actor: bot }, { actor: inactive });

    const { screen } = await renderEvents();

    expect(sentencesOf(screen)).toEqual([
      "Alice Smith changed the status from Analysis to Analyzed",
      "System changed the status from Analysis to Analyzed",
      "Fictional Bot Bot changed the status from Analysis to Analyzed",
      "Robert Lee Inactive changed the status from Analysis to Analyzed",
    ]);
  });

  test("show the loading indicator in place of the events until they arrive", async () => {
    const events = later();
    stubLog({ events: () => events.promise });

    const { screen } = await renderLog();

    await expect
      .element(panelOf(screen).getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();

    events.resolve(eventPage(eventsOf({})));

    await expect
      .poll(() => sentencesOf(screen))
      .toEqual(["Alice Smith changed the status from Analysis to Analyzed"]);
    await expect
      .element(panelOf(screen).getByRole("progressbar"))
      .not.toBeInTheDocument();
  });

  test("stay, marked as being updated, while another search loads, and then announce what the timeline shows, with the focus where it was", async () => {
    const pending = later();
    stubLog({
      events: (query) =>
        query.has("search") ? pending.promise : eventPage(eventsOf({})),
    });
    const { screen } = await renderEvents();
    const field = searchFieldOf(screen);

    await field.fill("curl");
    await userEvent.keyboard("{Enter}");

    await expect
      .element(panelOf(screen).getByRole("progressbar", { name: "Updating" }))
      .toBeVisible();
    expect(sentencesOf(screen)).toEqual([
      "Alice Smith changed the status from Analysis to Analyzed",
    ]);

    pending.resolve(eventPage(eventsOf({ actor: null })));

    await expect
      .poll(() => sentencesOf(screen))
      .toEqual(["System changed the status from Analysis to Analyzed"]);
    await expect.poll(() => announcementsOf(screen)).toEqual(["1 event"]);
    await expect
      .element(panelOf(screen).getByRole("progressbar"))
      .not.toBeInTheDocument();
    await expect.element(field).toHaveFocus();
  });
});

describe("the search", () => {
  test("applies a term with Enter, without its surrounding whitespace, at the first page, as a new entry of the browser history", async () => {
    const { spy } = stubLog();
    const { router, screen } = await renderEvents(`${PATH}?page=2`);
    const field = searchFieldOf(screen);
    await expect.element(field).toHaveAttribute("maxlength", "500");

    await field.fill("  NOT_AFFECTED ");
    await userEvent.keyboard("{Enter}");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?search=NOT_AFFECTED`);
    expect(router.history.length).toBe(2);
    await expect.element(field).toHaveValue("NOT_AFFECTED");
    await expect
      .poll(() => eventReads(spy).at(-1))
      .toBe(`search=NOT_AFFECTED&${FIRST_PAGE}`);
  });

  test("removes the term with its clear button", async () => {
    const { spy } = stubLog();
    const { router, screen } = await renderEvents(`${PATH}?search=curl`);
    await expect.element(searchFieldOf(screen)).toHaveValue("curl");

    await screen.getByRole("button", { name: "Clear search" }).click();

    await expect.poll(() => router.state.location.href).toBe(PATH);
    expect(router.history.length).toBe(2);
    await expect.poll(() => eventReads(spy).at(-1)).toBe(FIRST_PAGE);
  });
});

describe("the actor", () => {
  test("offers Any actor, System, and the signed-in user with You, then, after a line, the other users who acted on the Ticket, in the order of List Ticket Actors, and takes the focus as the filters open", async () => {
    stubLog();
    const { screen } = await renderEvents();

    const dialog = await openFilters(screen);

    const select = actorSelectOf(dialog);
    await expect.element(select).toHaveFocus();
    expect(readText(select.element())).toBe("Any actor");
    const options = await openActors(dialog);
    await expect
      .poll(() => optionNames(options))
      .toEqual([
        "Any actor",
        "System",
        "Alice Smith @asmith You",
        "Ana Garcia @agarcia",
        "Fictional Bot @fictional-bot Bot",
        "Robert Lee @rlee Inactive",
      ]);
    await expect
      .element(options.getByRole("option", { name: "Any actor" }))
      .toHaveAttribute("aria-selected", "true");
    // You closes the first group, and the other users form the second,
    // which the line sets apart.
    const groups = options.getByRole("group");
    expect(groups.elements()).toHaveLength(2);
    expect(optionNames(groups.first())).toEqual([
      "Any actor",
      "System",
      "Alice Smith @asmith You",
    ]);
    expect(optionNames(groups.nth(1))).toEqual([
      "Ana Garcia @agarcia",
      "Fictional Bot @fictional-bot Bot",
      "Robert Lee @rlee Inactive",
    ]);
  });

  test.each([
    ["no user acted on the Ticket", [], ["Any actor", "System"], 0],
    [
      "only the signed-in user acted on it",
      [ALICE],
      ["Any actor", "System", "Alice Smith @asmith You"],
      0,
    ],
    [
      "the signed-in user did not act on it",
      [ANA],
      ["Any actor", "System", "Ana Garcia @agarcia"],
      1,
    ],
  ])(
    "offers, when %s, the users who did, with the line only before other users",
    async (_, actors, names, lines) => {
      stubLog({ actors: () => actorsResponse(actors) });
      const { screen } = await renderEvents();
      const dialog = await openFilters(screen);

      const options = await openActors(dialog);

      await expect.poll(() => optionNames(options)).toEqual(names);
      expect(options.getByRole("group").elements()).toHaveLength(lines + 1);
    },
  );

  test("applies a choice at once, at the first page, each as a new entry of the browser history, and shows it as the option shows", async () => {
    const { spy } = stubLog();
    const { router, screen } = await renderEvents(`${PATH}?page=2`);
    const dialog = await openFilters(screen);

    let options = await openActors(dialog);
    await options.getByRole("option", { name: "System" }).click();

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?actor=system`);
    expect(router.history.length).toBe(2);
    await expect
      .poll(() => eventReads(spy).at(-1))
      .toBe(`actor=system&${FIRST_PAGE}`);
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toBeVisible();

    options = await openActors(dialog);
    await options.getByRole("option", { name: /^Ana Garcia/ }).click();

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?actor=${ANA.id}`);
    expect(router.history.length).toBe(3);
    await expect
      .poll(() => eventReads(spy).at(-1))
      .toBe(`actor=${ANA.id}&${FIRST_PAGE}`);
    await expect
      .poll(() => readText(actorSelectOf(dialog).element()))
      .toBe("Ana Garcia @agarcia");

    options = await openActors(dialog);
    await options.getByRole("option", { name: "Any actor" }).click();

    await expect.poll(() => router.state.location.href).toBe(PATH);
    expect(router.history.length).toBe(4);
  });

  test("shows the loading indicator in place of the users while List Ticket Actors loads, with Any actor and System", async () => {
    const actors = later();
    stubLog({ actors: () => actors.promise });
    const { screen } = await renderEvents();
    const dialog = await openFilters(screen);

    const options = await openActors(dialog);

    expect(optionNames(options)).toEqual(["Any actor", "System"]);
    // In the status region of the menu, after its options.
    const status = actorMenuOf().getByRole("status");
    await expect
      .element(status.getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();

    actors.resolve(actorsResponse());

    await expect.poll(() => optionNames(options)).toHaveLength(6);
    await expect
      .element(page.getByRole("progressbar", { name: "Loading" }))
      .not.toBeInTheDocument();
    await expect.element(status).toHaveTextContent("");
  });

  test("shows the message of the failure of List Ticket Actors in place of the users, with Any actor and System, and leaves the rest usable", async () => {
    const { spy } = stubLog({
      actors: () => errorResponse(503, "DATABASE_UNAVAILABLE"),
    });
    const { router, screen } = await renderEvents();
    const dialog = await openFilters(screen);

    const options = await openActors(dialog);

    // In the status region of the menu, which announces it.
    await expect
      .element(actorMenuOf().getByRole("status"))
      .toHaveTextContent(MESSAGE_UNAVAILABLE);
    expect(optionNames(options)).toEqual(["Any actor", "System"]);

    await options.getByRole("option", { name: "System" }).click();

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?actor=system`);
    await expect
      .poll(() => eventReads(spy).at(-1))
      .toBe(`actor=system&${FIRST_PAGE}`);
  });

  test("reads the events of a chosen user at once, shows the loading indicator in the select while List Ticket Actors loads, then Unknown user in fg-muted for a user that it does not return", async () => {
    const unknown = "00000000-0000-0000-0000-0000000000ff";
    const actors = later();
    const { spy } = stubLog({ actors: () => actors.promise });
    const { screen } = await renderEvents(`${PATH}?actor=${unknown}`);

    expect(eventReads(spy)).toEqual([`actor=${unknown}&${FIRST_PAGE}`]);
    const dialog = await openFilters(screen);
    const select = actorSelectOf(dialog);
    await expect
      .element(select.getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();

    actors.resolve(actorsResponse());

    const shown = select.getByText("Unknown user", { exact: true });
    await expect.element(shown).toBeVisible();
    expect(getComputedStyle(shown.element()).color).toBe(FG_MUTED);
  });

  test("shows Unknown user for a chosen user when List Ticket Actors fails", async () => {
    stubLog({ actors: () => errorResponse(503, "DATABASE_UNAVAILABLE") });
    const { screen } = await renderEvents(`${PATH}?actor=${ANA.id}`);

    const dialog = await openFilters(screen);

    await expect
      .element(actorSelectOf(dialog).getByText("Unknown user", { exact: true }))
      .toBeVisible();
  });

  test("reads List Ticket Actors once, as the tab opens, however often Filters opens", async () => {
    // The tab stays in the foreground, whatever focus events the browser
    // sends as the popovers open and close, which would read the actors
    // again (docs/behaviors.md, Loading).
    focusManager.setFocused(true);
    const { spy } = stubLog();
    const { screen } = await renderEvents();
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(1);

    for (let opening = 0; opening < 2; opening += 1) {
      const dialog = await openFilters(screen);
      const options = await openActors(dialog);
      await expect.poll(() => optionNames(options)).toHaveLength(6);
      // Closes the options, then the filters.
      await userEvent.keyboard("{Escape}");
      await expect.element(options).not.toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await expect.element(dialog).not.toBeInTheDocument();
    }

    expect(requestsTo(spy, ACTORS)).toBe(1);
  });

  test("ends the name of a user too long for the options with an ellipsis, on one line, in a narrow window", async () => {
    await page.viewport(320, 640);
    const name = "Alexandra Konstantina Papadopoulou-Fictional";
    stubLog({
      actors: () =>
        actorsResponse([
          ANA,
          {
            id: "00000000-0000-0000-0000-000000000008",
            username: "apapadopoulou",
            full_name: name,
            active: true,
            bot: false,
          },
          ALICE,
        ]),
    });
    const { screen } = await renderEvents();
    const dialog = await openFilters(screen);

    const options = await openActors(dialog);

    const option = options.getByRole("option", { name: /^Alexandra/ });
    await expect.element(option).toBeVisible();
    // The name with the username after it, which ends with the ellipsis.
    const shown = [...option.element().querySelectorAll("span")].find(
      (element) => element.firstChild?.textContent === name,
    );
    if (shown === undefined) {
      throw new Error("The option shows no name");
    }
    const style = getComputedStyle(shown);
    expect([style.whiteSpace, style.textOverflow]).toEqual([
      "nowrap",
      "ellipsis",
    ]);
    expect(shown.scrollWidth).toBeGreaterThan(shown.clientWidth);
    // An option of one line, 36 px high, within the menu and the window.
    const box = option.element().getBoundingClientRect();
    expect(box.height).toBe(36);
    expect(box.right).toBeLessThanOrEqual(
      actorMenuOf().element().getBoundingClientRect().right,
    );
    expect(box.right).toBeLessThanOrEqual(320);
  });
});

// The kinds and the event types that each sends (docs/screens/ticket.md,
// Audit log).
const KINDS = [
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
function typesOf(...types: readonly string[]): string {
  return types.map((type) => `event_type=${type}`).join("&");
}

describe("the kinds", () => {
  test("are a group of checkboxes in their order, each with an icon, which cover every event type of the pinned contract once", async () => {
    stubLog();
    const { screen } = await renderEvents();

    const dialog = await openFilters(screen);

    const kinds = dialog.getByRole("group", { name: "Kind" });
    const boxes = kinds.getByRole("checkbox");
    expect(boxes.elements()).toHaveLength(KINDS.length);
    for (const [index, [name]] of KINDS.entries()) {
      await expect.element(boxes.nth(index)).toHaveAccessibleName(name);
      await expect.element(boxes.nth(index)).not.toBeChecked();
      expect(
        kinds.getByText(name, { exact: true }).element().querySelector("svg"),
      ).not.toBeNull();
    }
    expect(KINDS.flatMap(([, , types]) => types).toSorted()).toEqual(
      Object.values(TicketAuditEventType).toSorted(),
    );
  });

  test.each(KINDS)(
    "send the event types of %s at once, at the first page, as a new entry of the browser history",
    async (name, id, types) => {
      const { spy } = stubLog();
      const { router, screen } = await renderEvents(`${PATH}?page=2`);
      const dialog = await openFilters(screen);

      await toggleKind(dialog, name);

      await expect
        .poll(() => router.state.location.href)
        .toBe(`${PATH}?kind=${id}`);
      expect(router.history.length).toBe(2);
      await expect
        .poll(() => eventReads(spy).at(-1))
        .toBe(`${typesOf(...types)}&${FIRST_PAGE}`);
      await expect
        .element(
          dialog
            .getByRole("group", { name: "Kind" })
            .getByRole("checkbox", { name }),
        )
        .toBeChecked();
    },
  );

  test("keep the kinds in their order, and remove the filter without any", async () => {
    const { spy } = stubLog();
    const { router, screen } = await renderEvents();
    const dialog = await openFilters(screen);

    await toggleKind(dialog, "References");
    await toggleKind(dialog, "Status");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?kind=status&kind=references`);
    await expect
      .poll(() => eventReads(spy).at(-1))
      .toBe(`${typesOf(...KINDS[0][2], ...KINDS[6][2])}&${FIRST_PAGE}`);
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toBeVisible();

    await toggleKind(dialog, "References");
    await toggleKind(dialog, "Status");

    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect.poll(() => eventReads(spy).at(-1)).toBe(FIRST_PAGE);
  });
});

describe("the period", () => {
  test("applies both dates with Enter, as the first and the last instant of their local days in UTC, as a new entry of the browser history", async () => {
    const { spy } = stubLog();
    const { router, screen } = await renderEvents(`${PATH}?page=2`);
    const dialog = await openFilters(screen);

    await typeDate(dialog, "From", "01112099");
    await typeDate(dialog, "To", "08112099");
    await userEvent.keyboard("{Enter}");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?from=2099-11-01&to=2099-11-08`);
    expect(router.history.length).toBe(2);
    await expect
      .poll(() => eventReads(spy).at(-1))
      .toBe(
        `from_date=${startOf("2099-11-01")}&to_date=${endOf("2099-11-08")}&${FIRST_PAGE}`,
      );
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toBeVisible();
  });

  test("sends the first instant of the local day that starts the period, and the microsecond before the local day after its end starts, also at the end of a year", async () => {
    const { spy } = stubLog();

    await renderEvents(`${PATH}?from=2099-12-31&to=2099-12-31`);

    const read = new URLSearchParams(eventReads(spy).at(-1));
    const from = read.get("from_date") ?? "";
    const to = read.get("to_date") ?? "";
    expect(Date.parse(from)).toBe(new Date(2099, 11, 31).getTime());
    // Six decimals of the second, the resolution of the times of Sentinel,
    // the last microsecond of the millisecond before the next day.
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}999Z$/);
    expect(Date.parse(to.replace(/999Z$/, "Z")) + 1).toBe(
      new Date(2100, 0, 1).getTime(),
    );
  });

  test("removes a bound with Enter in a field that the user emptied", async () => {
    const { spy } = stubLog();
    const { router, screen } = await renderEvents(
      `${PATH}?from=2099-11-01&to=2099-11-08`,
    );
    const dialog = await openFilters(screen);
    await dialog
      .getByRole("group", { name: "From" })
      .getByRole("spinbutton")
      .last()
      .click();

    // Backspace removes a digit, and in an empty part moves to the part
    // before it.
    await userEvent.keyboard(`${"{Backspace}".repeat(10)}{Enter}`);

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?to=2099-11-08`);
    await expect
      .poll(() => eventReads(spy).at(-1))
      .toBe(`to_date=${endOf("2099-11-08")}&${FIRST_PAGE}`);
  });

  test.each([
    [
      "a field with only some of its parts",
      "From",
      "01",
      "",
      "Enter the day, the month, and the year.",
    ],
    [
      "a date before the first",
      "From",
      "31121969",
      "",
      "Enter a date from 1 Jan 1970 to 30 Dec 9999.",
    ],
    [
      "a date after the last",
      "To",
      "",
      "31129999",
      "Enter a date from 1 Jan 1970 to 30 Dec 9999.",
    ],
    [
      "a start after the end",
      "To",
      "08112099",
      "01112099",
      "This date is before the start.",
    ],
  ])(
    "applies nothing for %s, and says so at its field until the focus leaves both fields",
    async (_, field, start, end, message) => {
      const { spy } = stubLog();
      const { router, screen } = await renderEvents();
      const dialog = await openFilters(screen);
      if (start !== "") {
        await typeDate(dialog, "From", start);
      }
      if (end !== "") {
        await typeDate(dialog, "To", end);
      }

      await userEvent.keyboard("{Enter}");

      const error = dialog.getByText(message, { exact: true });
      await expect.element(error).toBeVisible();
      // Announced by the status region of the period, after the name of its
      // field, the first status region of the popover.
      const announced = dialog.getByRole("status").first();
      expect(announced.element().textContent).toBe(`${field}: ${message}`);
      const other = field === "From" ? "To" : "From";
      const errorOf = (name: string) =>
        dialog
          .getByRole("group", { name })
          .getByRole("spinbutton")
          .first()
          .element()
          .getAttribute("aria-invalid");
      expect(errorOf(field)).toBe("true");
      expect(errorOf(other)).not.toBe("true");
      expect(router.state.location.href).toBe(PATH);
      expect(router.history.length).toBe(1);
      expect(eventReads(spy)).toEqual([FIRST_PAGE]);

      // To the select of the actor, the first field of the filters.
      actorSelectOf(dialog).element().focus();

      await expect.element(error).not.toBeInTheDocument();
      expect(announced.element().textContent).toBe("");
      for (const name of ["From", "To"]) {
        expect(dialog.getByRole("group", { name }).element().textContent).toBe(
          "dd/mm/yyyy",
        );
      }
    },
  );
});

describe("the filters", () => {
  test("show the period that applies when the URL changes while they are open, as with back", async () => {
    stubLog();
    const { router, screen } = await renderEvents();
    router.history.push(`${PATH}?from=2099-11-01`);
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toBeVisible();
    const dialog = await openFilters(screen);
    const from = dialog.getByRole("group", { name: "From" });
    expect(from.element().textContent).toBe("01/11/2099");

    router.history.back();

    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect.poll(() => from.element().textContent).toBe("dd/mm/yyyy");
  });

  test.each([
    ["the actor", "?actor=system", 1],
    ["the kinds", "?kind=status&kind=cve", 1],
    ["the start of the period", "?from=2099-11-01", 1],
    ["the end of the period", "?to=2099-11-08", 1],
    ["the whole period", "?from=2099-11-01&to=2099-11-08", 1],
    [
      "every filter, and not the search",
      "?search=curl&actor=system&kind=status&from=2099-11-01",
      3,
    ],
  ])("count %s among the filters that apply", async (_, search, count) => {
    stubLog();
    const { screen } = await renderEvents(`${PATH}${search}`);

    await expect
      .element(
        screen.getByRole("button", {
          name: `Filters ${String(count)} applied`,
        }),
      )
      .toBeVisible();
  });

  test("show the filters that apply", async () => {
    stubLog();
    const { screen } = await renderEvents(
      `${PATH}?actor=system&kind=assignment&from=2099-11-01&to=2099-11-08`,
    );

    const dialog = await openFilters(screen);

    expect(readText(actorSelectOf(dialog).element())).toBe("System");
    const kinds = dialog.getByRole("group", { name: "Kind" });
    await expect
      .element(kinds.getByRole("checkbox", { name: "Assignment" }))
      .toBeChecked();
    await expect
      .element(kinds.getByRole("checkbox", { name: "Status" }))
      .not.toBeChecked();
    expect(
      dialog.getByRole("group", { name: "From" }).element().textContent,
    ).toBe("01/11/2099");
    expect(
      dialog.getByRole("group", { name: "To" }).element().textContent,
    ).toBe("08/11/2099");
  });
});

describe("Clear filters", () => {
  test.each([
    ["without a search or a filter", "", false],
    ["with a search", "?search=curl", true],
    ["with a filter", "?kind=status", true],
    ["on another page alone", "?page=2", false],
  ])("shows %s: %s", async (_, search, shown) => {
    stubLog();
    const { screen } = await renderEvents(`${PATH}${search}`);

    const clear = screen.getByRole("button", { name: "Clear filters" });
    if (shown) {
      await expect.element(clear).toBeVisible();
    } else {
      await expect.element(clear).not.toBeInTheDocument();
    }
  });

  test("removes the search and the filters, at the first page, as a new entry of the browser history, and moves the focus to the heading", async () => {
    const { spy } = stubLog();
    const { router, screen } = await renderEvents(
      `${PATH}?search=curl&actor=system&kind=status&from=2099-11-01&page=2`,
    );
    const clear = screen.getByRole("button", { name: "Clear filters" });
    clear.element().focus();

    await userEvent.keyboard("{Enter}");

    await expect.poll(() => router.state.location.href).toBe(PATH);
    expect(router.history.length).toBe(2);
    await expect.element(searchFieldOf(screen)).toHaveValue("");
    await expect.element(heading(screen, "SNTL-12")).toHaveFocus();
    await expect.poll(() => eventReads(spy).at(-1)).toBe(FIRST_PAGE);
  });
});

describe("the URL", () => {
  test.each([
    ["a parameter that the tab does not accept", "?view=new", PATH, FIRST_PAGE],
    ["a username as the actor", "?actor=asmith", PATH, FIRST_PAGE],
    ["an actor in another letter case", "?actor=System", PATH, FIRST_PAGE],
    [
      "a repeated actor",
      "?actor=system&actor=00000000-0000-0000-0000-000000000005",
      PATH,
      FIRST_PAGE,
    ],
    ["a kind that it does not know", "?kind=fictional", PATH, FIRST_PAGE],
    ["a date that does not exist", "?from=2099-02-30", PATH, FIRST_PAGE],
    ["a date in another form", "?to=2099-11-8", PATH, FIRST_PAGE],
    ["a date and time", "?from=2099-11-01T00:00:00Z", PATH, FIRST_PAGE],
    ["a date before the first", "?from=1969-12-31", PATH, FIRST_PAGE],
    ["a date after the last", "?to=9999-12-31", PATH, FIRST_PAGE],
    [
      "a range whose start follows its end",
      "?from=2099-11-08&to=2099-11-01",
      PATH,
      FIRST_PAGE,
    ],
    ["a repeated date", "?from=2099-11-01&from=2099-11-02", PATH, FIRST_PAGE],
    ["the first page", "?page=1", PATH, FIRST_PAGE],
    ["a page below 1", "?page=0", PATH, FIRST_PAGE],
    [
      "a page beyond the last that Sentinel accepts",
      "?page=2147483648",
      PATH,
      FIRST_PAGE,
    ],
    [
      "a search of more than 500 characters",
      `?search=${"a".repeat(501)}`,
      PATH,
      FIRST_PAGE,
    ],
    ["a search with U+0000", "?search=cu%00rl", PATH, FIRST_PAGE],
    ["a repeated search", "?search=curl&search=ssl", PATH, FIRST_PAGE],
    [
      "a search with surrounding whitespace, without it",
      "?search=%20curl%20",
      `${PATH}?search=curl`,
      `search=curl&${FIRST_PAGE}`,
    ],
    [
      "an actor in upper case, in lower case",
      "?actor=0000000A-0000-0000-0000-0000000000FF",
      `${PATH}?actor=0000000a-0000-0000-0000-0000000000ff`,
      `actor=0000000a-0000-0000-0000-0000000000ff&${FIRST_PAGE}`,
    ],
    [
      "the kinds once each, in their order, without one that it does not know",
      "?kind=references&kind=status&kind=fictional&kind=references",
      `${PATH}?kind=status&kind=references`,
      `${typesOf(...KINDS[0][2], ...KINDS[6][2])}&${FIRST_PAGE}`,
    ],
  ])(
    "leads from %s to the URL that the tab gives, in place of the URL, and sends no request with it",
    async (_, search, accepted, read) => {
      const { spy } = stubLog();
      const { router } = await renderLog(`${PATH}${search}`);

      await expect.poll(() => router.state.location.href).toBe(accepted);
      expect(router.history.length).toBe(1);
      await expect.poll(() => eventReads(spy)).toEqual([read]);
    },
  );

  test("keeps every parameter that it accepts, in any order, the first and the last date included, and sends them to List Ticket Events", async () => {
    const { spy } = stubLog();
    const search = `?page=2&to=9999-12-30&from=1970-01-01&kind=priority&actor=system&search=${"a".repeat(500)}`;
    const { router } = await renderLog(`${PATH}${search}`);

    await expect
      .poll(() => eventReads(spy))
      .toEqual([
        `${typesOf("priority_changed")}&actor=system&search=${"a".repeat(500)}&from_date=${startOf("1970-01-01")}&to_date=${endOf("9999-12-30")}&page=2&per_page=50`,
      ]);
    expect(router.state.location.href).toBe(`${PATH}${search}`);
    expect(router.history.length).toBe(1);
  });

  test("keeps a range of one day", async () => {
    const { spy } = stubLog();
    const { router } = await renderLog(`${PATH}?from=2099-11-08&to=2099-11-08`);

    await expect
      .poll(() => eventReads(spy))
      .toEqual([
        `from_date=${startOf("2099-11-08")}&to_date=${endOf("2099-11-08")}&${FIRST_PAGE}`,
      ]);
    expect(router.state.location.href).toBe(
      `${PATH}?from=2099-11-08&to=2099-11-08`,
    );
  });
});

// The pages of a log of 63 events, 50 a page.
function pagesOf(query: URLSearchParams): Response {
  const number = Number(query.get("page"));
  const count = number === 1 ? 50 : number === 2 ? 13 : 0;
  return pageOfEvents(count, 63, number);
}

describe("the pagination", () => {
  test("shows the range and leads to the next and the previous page, keeping the search and the filters", async () => {
    const { spy } = stubLog({ events: pagesOf });
    const { router, screen } = await renderEvents(
      `${PATH}?search=curl&kind=status`,
    );
    const pagination = screen.getByRole("navigation", { name: "Pagination" });
    const previous = pagination.getByRole("link", { name: "Previous" });
    const next = pagination.getByRole("link", { name: "Next" });

    await expect.element(pagination.getByText("1–50 of 63")).toBeVisible();
    await expect.element(previous).toHaveAttribute("aria-disabled", "true");
    await expect
      .element(next)
      .toHaveAttribute("href", `${PATH}?search=curl&kind=status&page=2`);

    await next.click();

    await expect.element(pagination.getByText("51–63 of 63")).toBeVisible();
    expect(router.state.location.href).toBe(
      `${PATH}?search=curl&kind=status&page=2`,
    );
    expect(router.history.length).toBe(2);
    expect(eventReads(spy).at(-1)).toBe(
      `${typesOf(...KINDS[0][2])}&search=curl&page=2&per_page=50`,
    );
    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["51–63 of 63 events"]);
    // Next is disabled on the last page, so the focus moves to Previous.
    await expect.element(previous).toHaveFocus();
    await expect
      .element(previous)
      .toHaveAttribute("href", `${PATH}?search=curl&kind=status`);
  });

  test("shows none for a log of one page", async () => {
    stubLog({ events: () => pageOfEvents(50, 50) });
    const { screen } = await renderEvents();

    await expect.poll(() => sentencesOf(screen)).toHaveLength(50);
    await expect
      .element(screen.getByRole("navigation", { name: "Pagination" }))
      .not.toBeInTheDocument();
  });

  test("goes with the events when the failure of the read of the next page takes their place, and the focus moves to the heading", async () => {
    stubLog({
      events: (query) =>
        query.get("page") === "2"
          ? errorResponse(503, "DATABASE_UNAVAILABLE")
          : pagesOf(query),
    });
    const { screen } = await renderEvents();
    const next = screen
      .getByRole("navigation", { name: "Pagination" })
      .getByRole("link", { name: "Next" });
    next.element().focus();

    await userEvent.keyboard("{Enter}");

    await expect
      .element(panelOf(screen).getByText(MESSAGE_UNAVAILABLE))
      .toBeVisible();
    await expect
      .element(screen.getByRole("navigation", { name: "Pagination" }))
      .not.toBeInTheDocument();
    expect(panelOf(screen).getByRole("listitem").elements()).toHaveLength(0);
    await expect.element(heading(screen, "SNTL-12")).toHaveFocus();
  });
});

describe("the empty states", () => {
  test("say that the Ticket has no events, without an action", async () => {
    stubLog({ events: () => eventPage([]) });
    const { screen } = await renderLog();

    await expect
      .element(panelOf(screen).getByText("No events.", { exact: true }))
      .toBeVisible();
    expect(
      screen.getByRole("button", { name: "Clear filters" }).elements(),
    ).toHaveLength(0);
    await expect.element(searchFieldOf(screen)).toBeVisible();
  });

  test.each([
    ["a search alone", "?search=curl", "No events match the search."],
    ["a filter", "?actor=system", "No events match the filters."],
    [
      "a search and a filter",
      "?search=curl&kind=status",
      "No events match the filters.",
    ],
    [
      "a filter, on another page",
      "?kind=status&page=3",
      "No events match the filters.",
    ],
  ])(
    "say without events that none match %s, and offer Clear filters, which moves the focus to the heading",
    async (_, search, message) => {
      stubLog({
        events: (query) =>
          query.has("search") || query.has("actor") || query.has("event_type")
            ? eventPage([], { page: Number(query.get("page")) })
            : eventPage(eventsOf({})),
      });
      const { router, screen } = await renderLog(`${PATH}${search}`);

      await expect
        .element(panelOf(screen).getByText(message, { exact: true }))
        .toBeVisible();
      const clear = screen.getByRole("button", { name: "Clear filters" });
      // The one of the toolbar, and the one of the empty state.
      expect(clear.elements()).toHaveLength(2);
      const inPlace = clear.elements()[1];
      if (!(inPlace instanceof HTMLElement)) {
        throw new Error("No Clear filters in the empty state");
      }
      inPlace.focus();

      await userEvent.keyboard("{Enter}");

      await expect
        .poll(() => sentencesOf(screen))
        .toEqual(["Alice Smith changed the status from Analysis to Analyzed"]);
      expect(router.state.location.href).toBe(PATH);
      expect(router.history.length).toBe(2);
      await expect.element(heading(screen, "SNTL-12")).toHaveFocus();
    },
  );

  test("keep saying that no events match the search, with Clear filters, while the events without it load after Clear filters", async () => {
    const pending = later();
    stubLog({
      events: (query) =>
        query.has("search") ? eventPage([]) : pending.promise,
    });
    const { router, screen } = await renderLog(`${PATH}?search=curl`);
    const panel = panelOf(screen);
    const message = panel.getByText("No events match the search.", {
      exact: true,
    });
    await expect.element(message).toBeVisible();
    const inPlace = screen
      .getByRole("button", { name: "Clear filters" })
      .elements()[1];
    if (!(inPlace instanceof HTMLElement)) {
      throw new Error("No Clear filters in the empty state");
    }
    inPlace.focus();

    await userEvent.keyboard("{Enter}");

    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect
      .element(panel.getByRole("progressbar", { name: "Updating" }))
      .toBeVisible();
    await expect.element(message).toBeVisible();
    expect(
      panel.getByText("No events.", { exact: true }).elements(),
    ).toHaveLength(0);
    // The action of the empty state stays with its message, and the one of
    // the toolbar goes with the search.
    expect(
      panel.getByRole("button", { name: "Clear filters" }).elements(),
    ).toHaveLength(1);

    pending.resolve(eventPage(eventsOf({})));

    await expect
      .poll(() => sentencesOf(screen))
      .toEqual(["Alice Smith changed the status from Analysis to Analyzed"]);
    await expect.element(message).not.toBeInTheDocument();
  });

  test("say that a page beyond the last has no events, and lead to the first page, which moves the focus to the heading", async () => {
    stubLog({ events: pagesOf });
    const { router, screen } = await renderLog(`${PATH}?kind=status&page=5`);
    const first = screen.getByRole("link", { name: "Go to the first page" });

    await expect
      .element(
        panelOf(screen).getByText("There are no events on this page.", {
          exact: true,
        }),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("navigation", { name: "Pagination" }))
      .not.toBeInTheDocument();
    await expect.element(first).toHaveAttribute("href", `${PATH}?kind=status`);
    first.element().focus();

    await userEvent.keyboard("{Enter}");

    await expect.poll(() => sentencesOf(screen)).toHaveLength(50);
    expect(router.state.location.href).toBe(`${PATH}?kind=status`);
    await expect.element(heading(screen, "SNTL-12")).toHaveFocus();
  });
});

describe("the announcements", () => {
  test("say nothing as the tab opens", async () => {
    stubLog({ events: () => pageOfEvents(12, 12) });
    const { screen } = await renderEvents();

    await expect.poll(() => sentencesOf(screen)).toHaveLength(12);
    expect(announcementsOf(screen)).toEqual([]);
  });

  test.each([
    ["the events of a page", "?search=curl", pageOfEvents(12, 12), "12 events"],
    ["one event", "?search=curl", pageOfEvents(1, 1), "1 event"],
    [
      "a page of a longer log",
      "?search=curl",
      pageOfEvents(50, 63),
      "1–50 of 63 events",
    ],
    [
      "the empty state",
      "?search=curl",
      eventPage([]),
      "No events match the search.",
    ],
  ])(
    "say %s that the timeline shows after a change, and leave the focus where it was",
    async (_, search, response, announcement) => {
      stubLog({
        events: (query) =>
          query.has("search") ? response.clone() : eventPage(eventsOf({})),
      });
      const { router, screen } = await renderEvents();
      const tab = screen.getByRole("tab", { name: "Audit log" });
      tab.element().focus();

      router.history.push(`${PATH}${search}`);

      await expect.poll(() => announcementsOf(screen)).toEqual([announcement]);
      await expect.element(tab).toHaveFocus();
    },
  );

  test("say in the popover of the filters what the timeline shows after a change of a filter, or the failure of its read", async () => {
    stubLog({
      events: (query) =>
        query.has("actor")
          ? errorResponse(503, "DATABASE_UNAVAILABLE")
          : query.has("event_type")
            ? pageOfEvents(12, 12)
            : eventPage(eventsOf({})),
    });
    const { screen } = await renderEvents();
    const dialog = await openFilters(screen);
    // The status region of the popover, after that of the errors of the
    // period.
    const status = dialog.getByRole("status").last();
    await expect.element(status).toHaveTextContent("");

    await toggleKind(dialog, "Status");

    await expect.element(status).toHaveTextContent("12 events");

    const options = await openActors(dialog);
    await options.getByRole("option", { name: "System" }).click();

    await expect.element(status).toHaveTextContent(MESSAGE_UNAVAILABLE);
  });
});

describe("the errors", () => {
  test("show the failure of the read of the events in place of the events, with Try again, below the toolbar", async () => {
    let fail = true;
    stubLog({
      events: () =>
        fail
          ? errorResponse(503, "DATABASE_UNAVAILABLE")
          : eventPage(eventsOf({})),
    });
    const { screen } = await renderLog();

    const message = panelOf(screen).getByText(MESSAGE_UNAVAILABLE);
    await expect.element(message).toBeVisible();
    expect(message.element().closest("output")).not.toBeNull();
    await expect.element(searchFieldOf(screen)).toBeVisible();
    fail = false;

    await panelOf(screen).getByRole("button", { name: "Try again" }).click();

    await expect
      .poll(() => sentencesOf(screen))
      .toEqual(["Alice Smith changed the status from Analysis to Analyzed"]);
  });

  test.each([
    [
      "a status and a code that the contract does not list for it",
      418,
      "FICTIONAL_CODE",
      "Sentinel didn't accept this request.",
      false,
    ],
    [
      "a 5xx with a code that the contract does not list for it",
      507,
      "FICTIONAL_STORAGE_FULL",
      MESSAGE_UNAVAILABLE,
      true,
    ],
  ])(
    "show the presentation of the status of %s",
    async (_, status, code, message, retry) => {
      stubLog({ events: () => errorResponse(status, code) });
      const { screen } = await renderLog();

      await expect
        .element(panelOf(screen).getByText(message, { exact: true }))
        .toBeVisible();
      expect(
        panelOf(screen).getByRole("button", { name: "Try again" }).elements(),
      ).toHaveLength(retry ? 1 : 0);
    },
  );

  test("wait for the Ticket before the failure of the events shows, with the loading indicator meanwhile", async () => {
    const ticket = later();
    const { spy } = stubLog({
      ticket: () => ticket.promise,
      events: () => errorResponse(503, "DATABASE_UNAVAILABLE"),
    });
    const { screen } = await renderApp(PATH);

    // Sent again twice after a 5xx, as every read (docs/behaviors.md,
    // Retries and Unconfirmed Changes).
    await expect.poll(() => eventReads(spy)).toHaveLength(3);
    await expect
      .element(panelOf(screen).getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();
    expect(
      panelOf(screen).getByText(MESSAGE_UNAVAILABLE).elements(),
    ).toHaveLength(0);

    ticket.resolve(ticketResponse(fictionalTicketDetail()));

    await expect
      .element(panelOf(screen).getByText(MESSAGE_UNAVAILABLE))
      .toBeVisible();
    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
  });

  test("show Not found for a Ticket that does not exist or that the user cannot see", async () => {
    stubLog({
      ticket: () => errorResponse(404, "TICKET_NOT_FOUND"),
      events: () => errorResponse(404, "TICKET_NOT_FOUND"),
      actors: () => errorResponse(404, "TICKET_NOT_FOUND"),
    });

    const { screen } = await renderApp(PATH);

    await expect.element(heading(screen, "Not found")).toBeVisible();
    await expect
      .element(screen.getByRole("tab", { name: "Audit log" }))
      .not.toBeInTheDocument();
    expect(
      screen
        .getByText("This page doesn't exist, or you don't have access to it.")
        .elements(),
    ).toHaveLength(1);
  });

  test("keep the events after a new read of them fails, with its warning above them and Try again", async () => {
    const { stub } = stubLog();
    const { screen } = await renderEvents();

    stub.events = () => errorResponse(503, "DATABASE_UNAVAILABLE");
    returnToForeground();

    await expect
      .element(
        panelOf(screen).getByText(
          `This couldn't be updated. ${MESSAGE_UNAVAILABLE}`,
        ),
      )
      .toBeVisible();
    expect(sentencesOf(screen)).toEqual([
      "Alice Smith changed the status from Analysis to Analyzed",
    ]);

    stub.events = () => eventPage(eventsOf({ actor: null }));
    await panelOf(screen).getByRole("button", { name: "Try again" }).click();

    await expect
      .poll(() => sentencesOf(screen))
      .toEqual(["System changed the status from Analysis to Analyzed"]);
    expect(
      panelOf(screen)
        .getByText(/couldn't be updated/)
        .elements(),
    ).toHaveLength(0);
  });
});
