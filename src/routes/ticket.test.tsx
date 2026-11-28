import {
  focusManager,
  QueryClientProvider,
  type QueryClient,
} from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { cleanup, render, renderHook } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import type {
  CVEDetail,
  CurrentUserResponse,
  TicketDetail,
} from "../api/generated/model";
import { focusScreenHeading } from "../components/screen-heading";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import { useShownTicket } from "./ticket";
import {
  actorsResponse,
  cvssResponse,
  errorResponse,
  grantsResponse,
  fictionalCve,
  fictionalSource,
  fictionalTicketDetail,
  jsonResponse,
  OTHER_USER,
  sourcesResponse,
  stubApi,
  ticketPage,
  ticketResponse,
  urlOf,
} from "../test-api";

// The Ticket screen (docs/screens/ticket.md), at the browser's default text
// size, in the light theme.

const ME = "/api/v1/users/me";
const TICKETS = "/api/v1/tickets";
const CVSS = "/api/v1/cves/CVE-2099-0012/cvss";
const SOURCES = "/api/v1/cves/CVE-2099-0012/sources";
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// The read of the duplicates of SNTL-12.
const DUPLICATES_OF_SNTL_12 =
  "duplicate_of_ticket_id=SNTL-12&sort_by=ticket_id&sort_order=asc&per_page=100";

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
  document.documentElement.style.removeProperty("font-size");
  window.scrollTo(0, 0);
  await page.viewport(414, 896);
});

interface Stub {
  // The signed-in user, or the user at each read of it.
  user: CurrentUserResponse | (() => CurrentUserResponse);
  // The response to Get Ticket of the path.
  ticket: (path: string) => Response | Promise<Response>;
  // The response to the read of the CVSS assessments of the CVE.
  cvss: () => Response | Promise<Response>;
  // The response to the read of the sources of the CVE.
  sources: () => Response | Promise<Response>;
  // The response to the read of the users who acted on the Ticket.
  actors: () => Response | Promise<Response>;
}

// Answers the read of the signed-in user, by default an analyst, Get Ticket,
// the read of the CVSS assessments, and the read of the sources of the CVE,
// as the test sets them, the duplicates, the users who acted on a Ticket, and
// its access grants with none, and returns the spy, whose calls name the
// requests.
function stubTicket(fields: Partial<Stub> = {}) {
  const stub: Stub = {
    user: OTHER_USER,
    ticket: () => ticketResponse(fictionalTicketDetail()),
    cvss: () => cvssResponse(),
    sources: () => sourcesResponse(),
    actors: () => actorsResponse([]),
    ...fields,
  };
  return stubApi((request) => {
    if (request.path === ME) {
      return jsonResponse(
        200,
        typeof stub.user === "function" ? stub.user() : stub.user,
      );
    }
    if (request.path === TICKETS) {
      return ticketPage([]);
    }
    if (request.path.endsWith("/actors")) {
      return stub.actors();
    }
    if (request.path.endsWith("/access")) {
      return grantsResponse([]);
    }
    if (request.path.startsWith(`${TICKETS}/`)) {
      return stub.ticket(request.path);
    }
    if (request.path === CVSS) {
      return stub.cvss();
    }
    if (request.path === SOURCES) {
      return stub.sources();
    }
    return errorResponse(404, "RESOURCE_NOT_FOUND");
  });
}

// Answers Get Ticket with the Ticket.
function showing(ticket: TicketDetail) {
  return stubTicket({ ticket: () => ticketResponse(ticket) });
}

async function renderApp(path: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  return { router, screen };
}

type Screen = Awaited<ReturnType<typeof renderApp>>["screen"];

// Renders the screen of the Ticket and waits until it shows the Ticket.
async function renderTicket(path = "/tickets/SNTL-12", name = "SNTL-12") {
  const rendered = await renderApp(path);
  await expect.element(heading(rendered.screen, name)).toBeVisible();
  return rendered;
}

function heading(screen: Screen, name: string) {
  return screen.getByRole("heading", { level: 1, name, exact: true });
}

function region(screen: Screen, name: string) {
  return screen.getByRole("region", { name, exact: true });
}

// Actions, the menu of the actions of SNTL-12 at the end of the heading row.
function actionsOf(screen: Screen) {
  return screen.getByRole("button", {
    name: "Actions of SNTL-12",
    exact: true,
  });
}

// The value of a field of the details, by its term: the definition of the
// same rank as the term, as each term has one.
function valueOf(screen: Screen, term: string): HTMLElement {
  const details = region(screen, "Details");
  const index = details
    .getByRole("term")
    .elements()
    .findIndex((candidate) => candidate.textContent === term);
  const element = details.getByRole("definition").elements()[index];
  if (index === -1 || !(element instanceof HTMLElement)) {
    throw new Error(`The details have no field ${term}`);
  }
  return element;
}

// A CVE with many weaknesses, so that the main column is longer than the
// side column, which then sticks while the page scrolls.
function longCve(): CVEDetail {
  return fictionalCve({
    cwes: Array.from({ length: 200 }, (_, index) => ({
      cwe_id: `CWE-${index + 1000}`,
      sources: ["nvd"],
    })),
  });
}

// Every source of a CVE, each that can be refetched but CISA KEV, so that
// the side column is taller than a short window.
const EVERY_SOURCE = [
  "bugzilla",
  "epss",
  "ghsa",
  "kernel",
  "kev",
  "mitre",
  "nvd",
  "osv",
  "redhat",
].map((source) => fictionalSource({ source, refetchable: source !== "kev" }));

// The terms of a list, in their order.
function textsOf(locator: Locator): (string | null)[] {
  return locator.elements().map((element) => element.textContent);
}

// The paths and queries of the requests to the API, other than the read of
// the signed-in user.
function requestsOf(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname !== ME)
    .map((url) => `${url.pathname}${url.search}`);
}

// A response that the test gives when it chooses.
function later() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Waits until the browser has rendered two more frames.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

// A date and time of the API that lies the duration from now.
function fromNow(duration: number): string {
  return new Date(Date.now() + duration).toISOString();
}

// The rectangle of an element on the screen.
function boxOf(locator: Locator): DOMRect {
  return locator.element().getBoundingClientRect();
}

// The vertical middle of a rectangle.
function middle(box: DOMRect): number {
  return (box.top + box.bottom) / 2;
}

// The width of the page: that of the window, less the room that a page with
// the message area keeps for its scrollbar also while it does not scroll
// (src/styles.css), which the body leaves out. Chromium gives the root's
// clientWidth as the width of the window while that room is empty.
function layoutWidth(): number {
  return document.body.clientWidth;
}

// The room of the scrollbar that a page with the message area keeps
// (layoutWidth), as an element keeps it with the same rule (src/styles.css):
// that of a classic scrollbar in Chromium, also where the tests hide its
// scrollbars, or none where the scrollbars overlay the page, as Firefox's do.
function scrollbarRoom(): number {
  const probe = document.createElement("div");
  probe.style.setProperty("overflow", "hidden");
  probe.style.setProperty("scrollbar-gutter", "stable");
  document.body.append(probe);
  const room = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return room;
}

// The analyst of OTHER_USER after a read of the signed-in user took their
// capabilities away: a user who can take none of the actions of Actions.
const WITHOUT_CAPABILITIES: CurrentUserResponse = {
  data: { ...OTHER_USER.data, roles: [], capabilities: [] },
};

// Returns the tab to the foreground once no read is in progress, after which
// the screen reads the signed-in user and the Ticket again.
async function returnToForeground() {
  await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
  focusManager.setFocused(false);
  focusManager.setFocused(true);
}

// The scroll padding of the page, in CSS pixels. It follows the height of the
// heading row through a ResizeObserver (src/components/fixed-top.ts), which
// reports a change in the next frame, after the commit that makes it, so a
// test reads it, and what sticks below it, with an assertion that retries.
function scrollPaddingTop(): number {
  return Number.parseFloat(
    getComputedStyle(document.documentElement).scrollPaddingTop,
  );
}

// Scrolls the page of SNTL-12, with two columns, until the heading row shows
// as the compact heading, and returns the scroll position once the scroll
// padding, and the scroll margins of the elements of the compact heading,
// have followed its height (scrollPaddingTop).
async function scrollToCompactHeading(screen: Screen): Promise<number> {
  window.scrollTo(0, 120);
  await expect
    .poll(() => getComputedStyle(heading(screen, "SNTL-12").element()).fontSize)
    .toBe("16px");
  const overview = screen.getByRole("tab", { name: "Overview" });
  await expect.poll(scrollPaddingTop).toBe(boxOf(overview).bottom);
  await nextFrames();
  return window.scrollY;
}

describe("the read of the Ticket", () => {
  test("names the screen Ticket until the Ticket arrives, with its tabs, then by its identifier", async () => {
    const response = later();
    const spy = stubTicket({ ticket: () => response.promise });

    const { screen } = await renderApp("/tickets/SNTL-12");

    await expect.element(heading(screen, "Ticket")).toBeVisible();
    expect(document.title).toBe("Ticket – Sentinel");
    await expect
      .element(screen.getByRole("tab", { name: "Overview" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(screen.getByRole("tab", { name: "Overview" }))
      .toHaveAttribute("href", "/tickets/SNTL-12");
    await expect
      .element(
        screen
          .getByRole("tabpanel", { name: "Overview" })
          .getByRole("progressbar", { name: "Loading" }),
      )
      .toBeVisible();

    response.resolve(ticketResponse(fictionalTicketDetail()));

    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
    expect(document.title).toBe("SNTL-12 – Sentinel");
    await expect
      .poll(() => requestsOf(spy))
      .toEqual([
        `${TICKETS}/SNTL-12`,
        `${TICKETS}?${DUPLICATES_OF_SNTL_12}`,
        CVSS,
        SOURCES,
        `${TICKETS}/SNTL-12/actors`,
      ]);
  });

  test("shows the tabs Overview, References, Affected versions, and Audit log, named Ticket, with Overview selected at the path of the Ticket", async () => {
    stubTicket();

    const { screen } = await renderTicket();

    const tabs = screen.getByRole("tablist", { name: "Ticket" });
    expect(textsOf(tabs.getByRole("tab"))).toEqual([
      "Overview",
      "References",
      "Affected versions",
      "Audit log",
    ]);
    await expect
      .element(tabs.getByRole("tab", { name: "Overview" }))
      .toHaveAttribute("aria-selected", "true");
    for (const [name, href] of [
      ["References", "/tickets/SNTL-12/references"],
      ["Affected versions", "/tickets/SNTL-12/affected-versions"],
      ["Audit log", "/tickets/SNTL-12/audit-log"],
    ]) {
      await expect
        .element(tabs.getByRole("tab", { name }))
        .toHaveAttribute("aria-selected", "false");
      await expect
        .element(tabs.getByRole("tab", { name }))
        .toHaveAttribute("href", href);
    }
  });

  test.each([
    ["with a leading zero", "SNTL-0012"],
    ["in lower case", "sntl-12"],
    ["beyond the largest identifier", "SNTL-2147483648"],
    ["with more digits than the largest", "SNTL-00000000002147483647"],
    ["with another suffix", "SNTL-12a"],
    ["with a suffix that reads as a number", "SNTL-12e3"],
    ["that is a UUID", "00000000-0000-0000-0000-000000000012"],
  ])(
    "shows Not found for an identifier %s, without a request",
    async (_, id) => {
      const spy = stubTicket();

      const { screen } = await renderApp(`/tickets/${id}`);

      await expect.element(heading(screen, "Not found")).toBeVisible();
      await expect
        .element(
          screen.getByText(
            "This page doesn't exist, or you don't have access to it.",
          ),
        )
        .toBeVisible();
      expect(requestsOf(spy)).toEqual([]);
    },
  );

  test("reads the Ticket with the largest identifier", async () => {
    const spy = showing(
      fictionalTicketDetail({ ticket_id: "SNTL-2147483647" }),
    );

    await renderTicket("/tickets/SNTL-2147483647", "SNTL-2147483647");

    expect(requestsOf(spy)[0]).toBe(`${TICKETS}/SNTL-2147483647`);
  });

  test("shows Not found for a Ticket that does not exist or that the user cannot see", async () => {
    stubTicket({ ticket: () => errorResponse(404, "TICKET_NOT_FOUND") });

    const { screen } = await renderApp("/tickets/SNTL-12");

    await expect.element(heading(screen, "Not found")).toBeVisible();
    expect(document.title).toBe("Not found – Sentinel");
    await expect
      .element(screen.getByRole("tab", { name: "Overview" }))
      .not.toBeInTheDocument();
  });

  test("removes every search parameter from the URL, in place of the URL, and keeps its anchor", async () => {
    stubTicket();

    const { router } = await renderTicket("/tickets/SNTL-12?view=new#details");

    expect(router.state.location.href).toBe("/tickets/SNTL-12#details");
    expect(router.history.length).toBe(1);
  });
});

describe("the heading row", () => {
  test("shows the identifier, then the CVE ID, the status, the severity, the priority, and the deadline badge, each named", async () => {
    showing(
      fictionalTicketDetail({
        submission_due_at: fromNow(3 * DAY + HOUR),
      }),
    );

    const { screen } = await renderTicket();

    const terms = screen.getByRole("term");
    expect(textsOf(terms).slice(0, 5)).toEqual([
      "CVE",
      "Status",
      "Severity",
      "Priority",
      "Deadline",
    ]);
    expect(textsOf(screen.getByRole("definition")).slice(0, 5)).toEqual([
      "CVE-2099-0012",
      "Analyzed",
      "High",
      "P2",
      "Submission 3dSubmission due in 3 days",
    ]);
    // The CVE ID is not a link: the address of the CVE leads to this screen.
    expect(
      screen.getByRole("link", { name: "CVE-2099-0012" }).elements(),
    ).toHaveLength(0);
    expect(screen.getByText("Confidential").elements()).toHaveLength(0);
  });

  test("opens the explanation of the priority from its button, which the box is", async () => {
    showing(fictionalTicketDetail());
    const { screen } = await renderTicket();
    const priority = screen.getByRole("button", { name: "P2", exact: true });
    expect(boxOf(priority).height).toBe(24);

    await priority.click();

    const explanation = screen.getByRole("dialog", { name: "P2, automatic" });
    await expect.element(explanation).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect.element(priority).toHaveFocus();
  });

  test("shows the lock and the label Confidential after the identifier of a confidential Ticket, with the lock hidden from assistive technologies", async () => {
    showing(fictionalTicketDetail({ is_confidential: true }));

    const { screen } = await renderTicket();

    const label = screen.getByText("Confidential", { exact: true });
    await expect.element(label).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Confidential" }).elements(),
    ).toHaveLength(0);
    // The lock 4 px after the identifier, its 14 px, and the label 6 px later.
    expect(boxOf(label).left - boxOf(heading(screen, "SNTL-12")).right).toBe(
      24,
    );
  });

  test("names a severity and a priority that are not set, which no column header names here", async () => {
    showing(
      fictionalTicketDetail({
        severity: null,
        priority: null,
        priority_automatic: null,
        priority_automatic_basis: {
          severity: null,
          exploitation: "unknown",
          evidence: [],
        },
      }),
    );

    const { screen } = await renderTicket();

    expect(textsOf(screen.getByRole("definition")).slice(1, 4)).toEqual([
      "Analyzed",
      "Severity not set",
      "Not yet prioritizable",
    ]);
    const priority = screen.getByRole("button", {
      name: "Not yet prioritizable",
    });
    await priority.click();
    await expect
      .element(screen.getByRole("dialog", { name: "Not yet prioritizable" }))
      .toBeVisible();
  });

  test("shows no CVE ID for a Ticket without a CVE, and no badge without a deadline", async () => {
    showing(
      fictionalTicketDetail({
        cve: null,
        current_phase: "done",
        current_phase_milestone: null,
      }),
    );

    const { screen } = await renderTicket();

    expect(textsOf(screen.getByRole("term")).slice(0, 3)).toEqual([
      "Status",
      "Severity",
      "Priority",
    ]);
    expect(textsOf(screen.getByRole("term"))).not.toContain("Deadline");
  });

  test("ends with Actions, named by the Ticket, on the line of the heading, for an analyst once the Ticket has arrived, not before", async () => {
    const response = later();
    stubTicket({ ticket: () => response.promise });
    const { screen } = await renderApp("/tickets/SNTL-12");
    await expect.element(heading(screen, "Ticket")).toBeVisible();
    await expect
      .element(screen.getByRole("tab", { name: "Overview" }))
      .toBeVisible();
    expect(screen.getByRole("button", { name: /^Actions/ }).query()).toBeNull();

    response.resolve(ticketResponse(fictionalTicketDetail()));

    const actions = actionsOf(screen);
    await expect.element(actions).toBeVisible();
    expect(actions.element().textContent).toBe("Actions");
    // After the main values, at the end of the row, which the line of the
    // tabs spans.
    const priority = screen.getByRole("button", { name: "P2", exact: true });
    expect(
      priority.element().compareDocumentPosition(actions.element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(boxOf(actions).left).toBeGreaterThan(boxOf(priority).right);
    expect(boxOf(actions).right).toBe(
      boxOf(screen.getByRole("tablist", { name: "Ticket" })).right,
    );
    expect(
      Math.abs(
        middle(boxOf(actions)) - middle(boxOf(heading(screen, "SNTL-12"))),
      ),
    ).toBeLessThanOrEqual(1);
  });

  test.each([
    ["References", "/tickets/SNTL-12/references"],
    ["Affected versions", "/tickets/SNTL-12/affected-versions"],
    ["Audit log", "/tickets/SNTL-12/audit-log"],
  ])("ends with Actions on %s", async (tab, path) => {
    // The lists that the tab reads under the path of the Ticket are empty.
    stubTicket({
      ticket: (requested) =>
        requested === `${TICKETS}/SNTL-12`
          ? ticketResponse(fictionalTicketDetail())
          : jsonResponse(200, {
              data: [],
              meta: { total: 0, page: 1, per_page: 50 },
            }),
    });

    const { screen } = await renderTicket(path);

    await expect
      .element(screen.getByRole("tab", { name: tab }))
      .toHaveAttribute("aria-selected", "true");
    await expect.element(actionsOf(screen)).toBeVisible();
    expect(boxOf(actionsOf(screen)).right).toBe(
      boxOf(screen.getByRole("tablist", { name: "Ticket" })).right,
    );
  });

  test("keeps Actions at the end of its line where the row wraps", async () => {
    await page.viewport(414, 896);
    showing(fictionalTicketDetail({ is_confidential: true }));

    const { screen } = await renderTicket();

    const actions = actionsOf(screen);
    await expect.element(actions).toBeVisible();
    // The row wraps: Actions is on a line below the heading.
    expect(boxOf(actions).top).toBeGreaterThan(
      boxOf(heading(screen, "SNTL-12")).bottom,
    );
    expect(boxOf(actions).right).toBe(
      boxOf(screen.getByRole("tablist", { name: "Ticket" })).right,
    );
  });

  test("keeps the tabs in their place as the Ticket arrives, with Actions at the end of the row", async () => {
    const response = later();
    stubTicket({ ticket: () => response.promise });
    const { screen } = await renderApp("/tickets/SNTL-12");
    await expect.element(heading(screen, "Ticket")).toBeVisible();
    const tabs = screen.getByRole("tablist", { name: "Ticket" });
    await expect.element(tabs).toBeVisible();
    const top = boxOf(tabs).top;

    response.resolve(ticketResponse(fictionalTicketDetail()));

    await expect.element(actionsOf(screen)).toBeVisible();
    expect(boxOf(tabs).top).toBe(top);
  });

  test("keeps the tabs in their place whether Actions shows or not, as a read of the signed-in user leaves an analyst none of its actions and Actions goes", async () => {
    let user = OTHER_USER;
    stubTicket({ user: () => user });
    const { screen } = await renderTicket();
    await expect.element(actionsOf(screen)).toBeVisible();
    const tabs = screen.getByRole("tablist", { name: "Ticket" });
    const top = boxOf(tabs).top;
    user = WITHOUT_CAPABILITIES;

    await returnToForeground();

    await expect.element(actionsOf(screen)).not.toBeInTheDocument();
    expect(boxOf(tabs).top).toBe(top);
  });
});

describe("the layout", () => {
  test("shows the details beside the CVE, 288 px wide, after it in the order of the page, with two columns from 960 px of main content", async () => {
    showing(fictionalTicketDetail());

    const { screen } = await renderTicket();

    const cve = boxOf(region(screen, "CVE-2099-0012"));
    const details = boxOf(region(screen, "Details"));
    expect(details.width).toBe(288);
    expect(details.left - cve.right).toBe(32);
    expect(details.top).toBe(cve.top);
    expect(
      region(screen, "CVE-2099-0012")
        .element()
        .compareDocumentPosition(region(screen, "Details").element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test.each([
    // A page of 1224 px with the expanded sidebar of 216 px leaves 960 px of
    // main content inside its space of 24 px; one of 1064 px with the
    // collapsed sidebar of 56 px leaves the same. The window is wider by the
    // room of its scrollbar (scrollbarRoom).
    [1224, true],
    [1223, false],
  ])(
    "decides the columns by the width of the main content: a page of %i px with the expanded sidebar, beside the room of the scrollbar, shows two: %s",
    async (width, twoColumns) => {
      await page.viewport(width + scrollbarRoom(), 800);
      showing(fictionalTicketDetail());

      const { screen } = await renderTicket();

      expect(layoutWidth()).toBe(width);
      const cve = boxOf(region(screen, "CVE-2099-0012"));
      const details = boxOf(region(screen, "Details"));
      expect(details.left > cve.right).toBe(twoColumns);
    },
  );

  test.each([
    // At a text size of 20 px, the sidebar of 270 px and the space of 30 px
    // leave 1200 px of main content in a page of 1530 px, in a window wider
    // by the room of its scrollbar (scrollbarRoom).
    [1530, true],
    [1529, false],
  ])(
    "decides the columns by the width of the main content in the text size: a page of %i px at a text size of 20 px, beside the room of the scrollbar, shows two: %s",
    async (width, twoColumns) => {
      document.documentElement.style.fontSize = "20px";
      await page.viewport(width + scrollbarRoom(), 800);
      showing(fictionalTicketDetail());

      const { screen } = await renderTicket();

      expect(layoutWidth()).toBe(width);
      const cve = boxOf(region(screen, "CVE-2099-0012"));
      const details = boxOf(region(screen, "Details"));
      expect(details.left > cve.right).toBe(twoColumns);
    },
  );

  test("shows the details above the CVE in one column, first in the order of the page", async () => {
    await page.viewport(900, 800);
    showing(fictionalTicketDetail());

    const { screen } = await renderTicket();

    const cveRegion = region(screen, "CVE-2099-0012");
    const detailsRegion = region(screen, "Details");
    expect(boxOf(detailsRegion).bottom).toBeLessThan(boxOf(cveRegion).top);
    expect(boxOf(detailsRegion).width).toBe(boxOf(cveRegion).width);
    expect(
      detailsRegion.element().compareDocumentPosition(cveRegion.element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("moves the focus from the details to the heading of the screen, which comes into view, when the layout changes, and leaves it elsewhere", async () => {
    await page.viewport(1280, 300);
    showing(
      fictionalTicketDetail({
        duplicate_of_ticket_id: "SNTL-21",
        cve: longCve(),
      }),
    );
    const { screen } = await renderTicket();
    window.scrollTo(0, document.documentElement.scrollHeight);
    await expect.poll(() => window.scrollY).toBeGreaterThan(200);
    const original = screen.getByRole("link", { name: "SNTL-21" });
    original.element().focus();
    await expect.element(original).toHaveFocus();

    await page.viewport(900, 300);

    const title = heading(screen, "SNTL-12");
    await expect.element(title).toHaveFocus();
    expect(boxOf(title).top).toBeGreaterThanOrEqual(0);
    expect(boxOf(title).bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(boxOf(region(screen, "Details")).bottom).toBeLessThan(
      boxOf(region(screen, "CVE-2099-0012")).top,
    );

    const suse = screen.getByRole("link", {
      name: "SUSE CVE page (another site)",
    });
    suse.element().focus();
    await page.viewport(1280, 300);

    await expect
      .poll(
        () =>
          boxOf(region(screen, "Details")).left >
          boxOf(region(screen, "CVE-2099-0012")).right,
      )
      .toBe(true);
    await expect.element(suse).toHaveFocus();
  });

  test("keeps the compact heading at the top of the window with two columns, in its place in the page, and the details below it", async () => {
    await page.viewport(1280, 300);
    showing(fictionalTicketDetail({ cve: longCve() }));
    const { screen } = await renderTicket();
    const title = heading(screen, "SNTL-12");
    const cve = region(screen, "CVE-2099-0012");
    const cveTop = boxOf(cve).top + window.scrollY;
    expect(getComputedStyle(title.element()).fontSize).toBe("20px");
    // Actions, 36 px high, the tallest element of the heading row, whose top
    // it sets.
    const actions = actionsOf(screen);
    expect(boxOf(actions).height).toBe(36);
    expect(boxOf(actions).top).toBeLessThanOrEqual(boxOf(title).top);
    // The window scrolls an element into view below the heading row, which
    // can stay at the top of the window.
    await expect
      .poll(scrollPaddingTop)
      .toBe(
        boxOf(screen.getByRole("tab", { name: "Overview" })).bottom -
          boxOf(actions).top,
      );

    window.scrollTo(0, 120);

    await expect
      .poll(() => getComputedStyle(title.element()).fontSize)
      .toBe("16px");
    // 10 px of space above the heading row, at the top of the window, which
    // Actions, 32 px high in the compact heading, starts.
    expect(boxOf(actions).height).toBe(32);
    expect(boxOf(actions).top).toBe(10);
    expect(boxOf(actions).top).toBeLessThanOrEqual(boxOf(title).top);
    // The content does not move when the heading becomes compact.
    expect(boxOf(cve).top + window.scrollY).toBe(cveTop);
    // The window scrolls an element into view below the compact heading,
    // whose line the tabs stand on, and the details stay 24 px below it.
    const bottom = boxOf(screen.getByRole("tab", { name: "Overview" })).bottom;
    await expect.poll(scrollPaddingTop).toBe(bottom);
    await expect
      .poll(() => boxOf(region(screen, "Details")).top)
      .toBe(bottom + 24);
    // The tabs, in the compact heading, are 36 px high.
    expect(boxOf(screen.getByRole("tab", { name: "Overview" })).height).toBe(
      36,
    );

    window.scrollTo(0, 0);

    await expect
      .poll(() => getComputedStyle(title.element()).fontSize)
      .toBe("20px");
  });

  test("keeps the tabs of the compact heading in their place whether Actions shows or not", async () => {
    await page.viewport(1280, 300);
    let user = OTHER_USER;
    stubTicket({
      user: () => user,
      ticket: () => ticketResponse(fictionalTicketDetail({ cve: longCve() })),
    });
    const { screen } = await renderTicket();
    const title = heading(screen, "SNTL-12");
    window.scrollTo(0, 120);
    await expect
      .poll(() => getComputedStyle(title.element()).fontSize)
      .toBe("16px");
    await expect.element(actionsOf(screen)).toBeVisible();
    const tabs = screen.getByRole("tablist", { name: "Ticket" });
    const top = boxOf(tabs).top;
    user = WITHOUT_CAPABILITIES;

    await returnToForeground();

    await expect.element(actionsOf(screen)).not.toBeInTheDocument();
    expect(getComputedStyle(title.element()).fontSize).toBe("16px");
    expect(boxOf(tabs).top).toBe(top);
  });

  test("leaves the page where it is when the keyboard moves the focus onto the controls of the compact heading", async () => {
    await page.viewport(1280, 300);
    showing(fictionalTicketDetail({ cve: longCve() }));
    const { screen } = await renderTicket();
    const scrolled = await scrollToCompactHeading(screen);
    const overview = screen.getByRole("tab", { name: "Overview" });
    const references = screen.getByRole("tab", { name: "References" });
    // The button of the explanation of the priority, P2, before Actions.
    const priority = screen.getByRole("button", { name: "P2", exact: true });
    // The focus starts on the tab Overview, where the page is.
    overview.element().focus({ preventScroll: true });
    await expect.element(overview).toHaveFocus();

    // Shift+Tab to Actions, and to the priority before it.
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.element(actionsOf(screen)).toHaveFocus();
    await nextFrames();
    expect(window.scrollY).toBe(scrolled);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.element(priority).toHaveFocus();
    await nextFrames();
    expect(window.scrollY).toBe(scrolled);

    // Tab back to Actions and to the tab, then an arrow key to the next tab,
    // which it does not open.
    await userEvent.keyboard("{Tab}");
    await expect.element(actionsOf(screen)).toHaveFocus();
    await userEvent.keyboard("{Tab}");
    await expect.element(overview).toHaveFocus();
    await nextFrames();
    expect(window.scrollY).toBe(scrolled);
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(references).toHaveFocus();
    await nextFrames();
    expect(window.scrollY).toBe(scrolled);
    await expect.element(overview).toHaveAttribute("aria-selected", "true");
  });

  test("leaves the page where it is when the focus moves to the heading of the screen in the compact heading", async () => {
    await page.viewport(1280, 300);
    showing(fictionalTicketDetail({ cve: longCve() }));
    const { screen } = await renderTicket();
    const title = heading(screen, "SNTL-12");
    const scrolled = await scrollToCompactHeading(screen);

    focusScreenHeading();

    await expect.element(title).toHaveFocus();
    await nextFrames();
    expect(window.scrollY).toBe(scrolled);
  });

  test("leaves the page where it is when the keyboard moves the focus onto the controls of the heading row before it reaches the top of the window", async () => {
    await page.viewport(1280, 300);
    showing(fictionalTicketDetail({ cve: longCve() }));
    const { screen } = await renderTicket();
    const title = heading(screen, "SNTL-12");
    // A few pixels, which leave the heading row below the top of the window,
    // not yet the compact heading, though it can stay there.
    window.scrollTo(0, 10);
    await expect.poll(() => window.scrollY).toBe(10);
    await nextFrames();
    expect(getComputedStyle(title.element()).fontSize).toBe("20px");
    const overview = screen.getByRole("tab", { name: "Overview" });
    // The focus starts on the tab Overview, where the page is.
    overview.element().focus({ preventScroll: true });
    await expect.element(overview).toHaveFocus();

    // Shift+Tab to Actions, and Tab back to the tab.
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.element(actionsOf(screen)).toHaveFocus();
    await nextFrames();
    expect(window.scrollY).toBe(10);
    await userEvent.keyboard("{Tab}");
    await expect.element(overview).toHaveFocus();
    await nextFrames();
    expect(window.scrollY).toBe(10);
  });

  test("leaves the page where it is when the keyboard moves the focus onto a tab of the heading row in a window barely taller than it", async () => {
    await page.viewport(1280, 180);
    showing(fictionalTicketDetail({ cve: longCve() }));
    const { screen } = await renderTicket();
    const overview = screen.getByRole("tab", { name: "Overview" });
    // The heading row, with its tabs, ends close to the end of the window.
    expect(boxOf(overview).bottom).toBeGreaterThan(window.innerHeight / 2);
    actionsOf(screen).element().focus({ preventScroll: true });
    await expect.element(actionsOf(screen)).toHaveFocus();

    await userEvent.keyboard("{Tab}");

    await expect.element(overview).toHaveFocus();
    await nextFrames();
    expect(window.scrollY).toBe(0);
  });

  test("scrolls the page until an element of a side column taller than the window shows when it takes the focus from the keyboard, at the end of the page and back above it, below the compact heading", async () => {
    await page.viewport(1280, 300);
    stubTicket({
      ticket: () => ticketResponse(fictionalTicketDetail({ cve: longCve() })),
      sources: () => sourcesResponse(EVERY_SOURCE),
    });
    const { screen } = await renderTicket();
    const sources = region(screen, "Sources of the CVE");
    const last = sources.getByRole("button", { name: "Refetch Red Hat" });
    await expect.element(last).toBeVisible();
    expect(boxOf(last).top).toBeGreaterThan(window.innerHeight);

    last.element().focus({ focusVisible: true });

    await expect.element(last).toBeInViewport({ ratio: 1 });
    await expect.element(last).toHaveFocus();

    // Back to Refetch all, which the end of the page leaves above the
    // compact heading.
    const all = sources.getByRole("button", { name: "Refetch all" });
    const tabs = () => boxOf(screen.getByRole("tab", { name: "Overview" }));
    expect(boxOf(all).top).toBeLessThan(tabs().bottom);

    all.element().focus({ focusVisible: true });

    await expect
      .poll(() => boxOf(all).top)
      .toBeGreaterThanOrEqual(tabs().bottom);
    await expect.element(all).toBeInViewport({ ratio: 1 });
  });

  test("leaves the page where it is when a pointer, not the keyboard, gives the focus to an element of the side column out of view", async () => {
    await page.viewport(1280, 300);
    showing(fictionalTicketDetail({ cve: longCve() }));
    const { screen } = await renderTicket();
    const refetch = region(screen, "Sources of the CVE").getByRole("button", {
      name: "Refetch NVD",
    });
    await expect.element(refetch).toBeVisible();
    // The last interaction is a pointer's, after which the browser does not
    // show the focus that a script moves.
    await region(screen, "CVE-2099-0012")
      .getByText("A fictional description of CVE-2099-0012.")
      .click();

    refetch.element().focus();
    const scrolled = window.scrollY;
    await nextFrames();

    await expect.element(refetch).toHaveFocus();
    expect(refetch.element().matches(":focus-visible")).toBe(false);
    expect(window.scrollY).toBe(scrolled);
  });

  test("lets the heading row scroll away in one column", async () => {
    await page.viewport(900, 300);
    showing(fictionalTicketDetail());
    const { screen } = await renderTicket();
    const title = heading(screen, "SNTL-12");

    window.scrollTo(0, 120);

    await expect.poll(() => boxOf(title).bottom).toBeLessThan(0);
    expect(getComputedStyle(title.element()).fontSize).toBe("20px");
    expect(getComputedStyle(document.documentElement).scrollPaddingTop).toBe(
      "0px",
    );
  });

  test("reflows at 320 CSS pixels without scrolling in two directions, the terms of the details above their values", async () => {
    await page.viewport(320, 640);
    showing(
      fictionalTicketDetail({
        is_confidential: true,
        coordinated_release_at: "2099-11-01T12:00:00Z",
        cve: fictionalCve({
          title: `Fictional flaw in ${"fictional_function_".repeat(4)}name`,
        }),
      }),
    );

    const { screen } = await renderTicket();
    // The sources, which the screen reads on their own, with Refetch all.
    await expect
      .element(
        region(screen, "Sources of the CVE").getByRole("button", {
          name: "Refetch all",
        }),
      )
      .toBeVisible();

    expect(document.documentElement.scrollWidth).toBe(layoutWidth());
    const term = region(screen, "Details").getByText("Assignee", {
      exact: true,
    });
    expect(boxOf(term).bottom).toBeLessThanOrEqual(
      valueOf(screen, "Assignee").getBoundingClientRect().top,
    );
  });
});

test("gives a tab the Ticket only on the Ticket screen", async () => {
  await expect(
    renderHook(() => useShownTicket(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    }),
  ).rejects.toThrow("A tab of the Ticket screen shows outside its screen");
});
