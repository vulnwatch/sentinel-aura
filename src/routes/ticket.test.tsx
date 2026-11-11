import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { cleanup, render, renderHook } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import type {
  CVEDetail,
  TicketDetail,
  TicketSummary,
} from "../api/generated/model";
import { formatDate, formatDateTime } from "../components/date-time";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import { useShownTicket } from "./ticket";
import {
  cvssResponse,
  errorResponse,
  fictionalCve,
  fictionalSource,
  fictionalTicket,
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
  document.title = "Sentinel";
  document.documentElement.style.removeProperty("font-size");
  window.scrollTo(0, 0);
  await page.viewport(414, 896);
});

interface Stub {
  // The response to Get Ticket of the path.
  ticket: (path: string) => Response | Promise<Response>;
  // The response to the read of the duplicates.
  duplicates: (query: URLSearchParams) => Response | Promise<Response>;
  // The response to the read of the CVSS assessments of the CVE.
  cvss: () => Response | Promise<Response>;
  // The response to the read of the sources of the CVE.
  sources: () => Response | Promise<Response>;
}

// Answers the read of the signed-in user, an analyst, Get Ticket, the read
// of the duplicates, the read of the CVSS assessments, and the read of the
// sources of the CVE, as the test sets them, and returns the spy, whose calls
// name the requests.
function stubTicket(fields: Partial<Stub> = {}) {
  const stub: Stub = {
    ticket: () => ticketResponse(fictionalTicketDetail()),
    duplicates: () => ticketPage([]),
    cvss: () => cvssResponse(),
    sources: () => sourcesResponse(),
    ...fields,
  };
  return stubApi((request) => {
    if (request.path === ME) {
      return jsonResponse(200, OTHER_USER);
    }
    if (request.path === TICKETS) {
      return stub.duplicates(request.query);
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

// Answers Get Ticket with a Ticket whose fields hold values that the pinned
// contract does not list, which a later Sentinel release can return.
function showingUnlisted(ticket: Record<string, unknown>) {
  return stubTicket({ ticket: () => jsonResponse(200, { data: ticket }) });
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

// A date and time of the API that lies the duration from now.
function fromNow(duration: number): string {
  return new Date(Date.now() + duration).toISOString();
}

// The text color of an element.
function colorOf(element: Element): string {
  return getComputedStyle(element).color;
}

// The rectangle of an element on the screen.
function boxOf(locator: Locator): DOMRect {
  return locator.element().getBoundingClientRect();
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
      ]);
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
    // A window of 1224 px with the expanded sidebar of 216 px leaves 960 px
    // of main content inside its space of 24 px; one of 1064 px with the
    // collapsed sidebar of 56 px leaves the same.
    [1224, true],
    [1223, false],
  ])(
    "decides the columns by the width of the main content: a window of %i px with the expanded sidebar shows two: %s",
    async (width, twoColumns) => {
      await page.viewport(width, 800);
      showing(fictionalTicketDetail());

      const { screen } = await renderTicket();

      const cve = boxOf(region(screen, "CVE-2099-0012"));
      const details = boxOf(region(screen, "Details"));
      expect(details.left > cve.right).toBe(twoColumns);
    },
  );

  test.each([
    // At a text size of 20 px, the sidebar of 270 px and the space of 30 px
    // leave 1200 px of main content in a window of 1530 px.
    [1530, true],
    [1529, false],
  ])(
    "decides the columns by the width of the main content in the text size: a window of %i px at a text size of 20 px shows two: %s",
    async (width, twoColumns) => {
      document.documentElement.style.fontSize = "20px";
      await page.viewport(width, 800);
      showing(fictionalTicketDetail());

      const { screen } = await renderTicket();

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
    // The window scrolls an element into view below the heading row, which
    // can stay at the top of the window.
    expect(
      Number.parseFloat(
        getComputedStyle(document.documentElement).scrollPaddingTop,
      ),
    ).toBe(
      boxOf(screen.getByRole("tab", { name: "Overview" })).bottom -
        boxOf(title).top,
    );

    window.scrollTo(0, 120);

    await expect
      .poll(() => getComputedStyle(title.element()).fontSize)
      .toBe("16px");
    // 10 px of space above the heading row, at the top of the window.
    expect(boxOf(title).top).toBe(10);
    // The content does not move when the heading becomes compact.
    expect(boxOf(cve).top + window.scrollY).toBe(cveTop);
    // The window scrolls an element into view below the compact heading,
    // whose line the tabs stand on, and the details stay 24 px below it.
    const bottom = boxOf(screen.getByRole("tab", { name: "Overview" })).bottom;
    expect(
      Number.parseFloat(
        getComputedStyle(document.documentElement).scrollPaddingTop,
      ),
    ).toBe(bottom);
    expect(boxOf(region(screen, "Details")).top).toBe(bottom + 24);
    // The tabs, in the compact heading, are 36 px high.
    expect(boxOf(screen.getByRole("tab", { name: "Overview" })).height).toBe(
      36,
    );

    window.scrollTo(0, 0);

    await expect
      .poll(() => getComputedStyle(title.element()).fontSize)
      .toBe("20px");
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
    await new Promise((done) => requestAnimationFrame(done));
    await new Promise((done) => requestAnimationFrame(done));

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

    expect(document.documentElement.scrollWidth).toBe(
      document.documentElement.clientWidth,
    );
    const term = region(screen, "Details").getByText("Assignee", {
      exact: true,
    });
    expect(boxOf(term).bottom).toBeLessThanOrEqual(
      valueOf(screen, "Assignee").getBoundingClientRect().top,
    );
  });
});

describe("the details", () => {
  test("are a part of the side column with a level-two heading", async () => {
    showing(fictionalTicketDetail());
    const { screen } = await renderTicket();

    await expect
      .element(
        region(screen, "Details").getByRole("heading", {
          level: 2,
          name: "Details",
        }),
      )
      .toBeVisible();
  });

  test("show the assignee in the full form", async () => {
    showing(fictionalTicketDetail());
    const { screen } = await renderTicket();

    expect(valueOf(screen, "Assignee").textContent).toBe("Alice Smith");
    expect(valueOf(screen, "Assignee").querySelector("svg")).not.toBeNull();
  });

  test("cut a name of the assignee longer than its place with an ellipsis, on one line, its labels showing and its text whole", async () => {
    showing(
      fictionalTicketDetail({
        assignee: {
          id: "00000000-0000-0000-0000-000000000004",
          username: "apapadopoulou",
          full_name: "Alexandra Konstantina Papadopoulou-Fictional",
          active: false,
          bot: false,
        },
      }),
    );
    const { screen } = await renderTicket();

    const name = screen.getByText(
      "Alexandra Konstantina Papadopoulou-Fictional",
    );
    await expect.element(name).toBeVisible();
    expect(name.element().scrollWidth).toBeGreaterThan(
      name.element().clientWidth,
    );
    expect(boxOf(name).height).toBe(20);
    const label = region(screen, "Details").getByText("Inactive", {
      exact: true,
    });
    await expect.element(label).toBeVisible();
    expect(boxOf(label).right).toBeLessThanOrEqual(
      boxOf(region(screen, "Details")).right,
    );
    expect(valueOf(screen, "Assignee").textContent).toBe(
      "Alexandra Konstantina Papadopoulou-FictionalInactive",
    );
  });

  test("show Unassigned for a Ticket without an assignee", async () => {
    showing(fictionalTicketDetail({ assignee: null }));
    const { screen } = await renderTicket();

    expect(valueOf(screen, "Assignee").textContent).toBe("Unassigned");
  });

  test("show the fields in their order, the term on the line of its value", async () => {
    showing(fictionalTicketDetail());
    const { screen } = await renderTicket();

    expect(textsOf(region(screen, "Details").getByRole("term"))).toEqual([
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
    const term = region(screen, "Details").getByText("Created", {
      exact: true,
    });
    const value = valueOf(screen, "Created");
    expect(value.textContent).toBe(formatDateTime("2099-10-09T14:05:09Z"));
    expect(valueOf(screen, "Last modified").textContent).toBe(
      formatDateTime("2099-10-10T09:30:00Z"),
    );
    // 104 px of term, then 12 px.
    expect(value.getBoundingClientRect().left - boxOf(term).left).toBe(116);
  });

  test.each([
    [
      "while a Ticket is confidential, as an absent value without a date",
      { is_confidential: true },
      "–Not set",
    ],
    [
      "while a Ticket has one, also after it became non-confidential",
      { coordinated_release_at: "2099-11-01T12:00:00Z" },
      formatDateTime("2099-11-01T12:00:00Z"),
    ],
  ])("show the Coordinated Release Date %s", async (_, fields, text) => {
    showing(fictionalTicketDetail(fields));
    const { screen } = await renderTicket();

    expect(valueOf(screen, "Coordinated Release Date").textContent).toBe(text);
  });

  test("show no Coordinated Release Date for a non-confidential Ticket without one", async () => {
    showing(fictionalTicketDetail());
    const { screen } = await renderTicket();

    expect(
      region(screen, "Details")
        .getByText("Coordinated Release Date")
        .elements(),
    ).toHaveLength(0);
  });

  describe("the deadlines", () => {
    test("show the date of each phase, the earlier ones in fg-muted, the current one at weight 600 with its state, and the later ones plain", async () => {
      const ticket = fictionalTicketDetail({
        submission_due_at: fromNow(3 * DAY + HOUR),
      });
      showing(ticket);
      const { screen } = await renderTicket();

      const muted = colorOf(
        region(screen, "Details").getByText("Deadlines").element(),
      );
      const triage = valueOf(screen, "Triage");
      const submission = valueOf(screen, "Submission");
      const um = valueOf(screen, "UM");
      expect(triage.textContent).toBe(
        formatDateTime(ticket.triage_due_at ?? ""),
      );
      expect(colorOf(triage)).toBe(muted);
      expect(submission.textContent).toBe(
        `${formatDateTime(ticket.submission_due_at ?? "")}Due in 3 days`,
      );
      expect(getComputedStyle(submission).fontWeight).toBe("600");
      expect(colorOf(um)).not.toBe(muted);
      expect(getComputedStyle(um).fontWeight).toBe("400");
    });

    test("mark an overdue current phase with the icon, in words", async () => {
      showing(
        fictionalTicketDetail({
          submission_due_at: fromNow(-2 * DAY + HOUR),
          current_phase_milestone: "overdue",
        }),
      );
      const { screen } = await renderTicket();

      const submission = valueOf(screen, "Submission");
      expect(submission.textContent).toMatch(/Overdue by 2 days$/);
      expect(submission.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    });

    test("show every phase in fg-muted once the current phase is done", async () => {
      showing(
        fictionalTicketDetail({
          current_phase: "done",
          current_phase_milestone: null,
        }),
      );
      const { screen } = await renderTicket();

      const muted = colorOf(
        region(screen, "Details").getByText("Deadlines").element(),
      );
      for (const phase of ["Triage", "Submission", "UM", "QA, release"]) {
        expect(colorOf(valueOf(screen, phase))).toBe(muted);
      }
    });

    test("show Triage in fg-muted and the other phases plain, without a state, when the current phase is null with due dates", async () => {
      showing(
        fictionalTicketDetail({
          cve: null,
          current_phase: null,
          current_phase_milestone: null,
        }),
      );
      const { screen } = await renderTicket();

      const muted = colorOf(
        region(screen, "Details").getByText("Deadlines").element(),
      );
      expect(colorOf(valueOf(screen, "Triage"))).toBe(muted);
      expect(colorOf(valueOf(screen, "Submission"))).not.toBe(muted);
      expect(valueOf(screen, "Submission").textContent).toBe(
        formatDateTime("2099-10-27T14:05:09Z"),
      );
    });

    test("give the final release deadline a line of its own when it differs from the QA due date", async () => {
      showing(
        fictionalTicketDetail({ release_due_at: "2099-11-09T14:05:09Z" }),
      );
      const { screen } = await renderTicket();

      expect(valueOf(screen, "QA").textContent).toBe(
        formatDateTime("2099-11-08T14:05:09Z"),
      );
      expect(valueOf(screen, "Release").textContent).toBe(
        formatDateTime("2099-11-09T14:05:09Z"),
      );
    });

    test("show an absent value without due dates", async () => {
      showing(
        fictionalTicketDetail({
          triage_due_at: null,
          submission_due_at: null,
          um_due_at: null,
          qa_due_at: null,
          release_due_at: null,
          current_phase: null,
          current_phase_milestone: null,
        }),
      );
      const { screen } = await renderTicket();

      expect(valueOf(screen, "Deadlines").textContent).toBe("–Not set");
    });

    test("mark no phase for a current phase that the pinned contract does not list", async () => {
      showingUnlisted({
        ...fictionalTicketDetail(),
        current_phase: "fictional_phase",
      });
      const { screen } = await renderTicket();

      for (const phase of ["Triage", "Submission", "UM", "QA, release"]) {
        expect(getComputedStyle(valueOf(screen, phase)).fontWeight).toBe("400");
      }
    });

    test("show a state of the current phase that the pinned contract does not list as received", async () => {
      showingUnlisted({
        ...fictionalTicketDetail(),
        current_phase_milestone: "fictional_milestone",
      });
      const { screen } = await renderTicket();

      expect(valueOf(screen, "Submission").textContent).toBe(
        `${formatDateTime("2099-10-27T14:05:09Z")}fictional_milestone`,
      );
    });
  });

  describe("the duplicates", () => {
    test("link to the original of a duplicate, without reading duplicates", async () => {
      const spy = showing(
        fictionalTicketDetail({
          status: "duplicated",
          duplicate_of_ticket_id: "SNTL-21",
        }),
      );
      const { screen } = await renderTicket();

      const link = screen.getByRole("link", { name: "SNTL-21" });
      await expect.element(link).toHaveAttribute("href", "/tickets/SNTL-21");
      expect(valueOf(screen, "Original").contains(link.element())).toBe(true);
      expect(requestsOf(spy)).toEqual([`${TICKETS}/SNTL-12`, CVSS, SOURCES]);
    });

    test("link to each duplicate, with the lock of a confidential one", async () => {
      const duplicates: TicketSummary[] = [
        fictionalTicket({ ticket_id: "SNTL-22", status: "duplicated" }),
        fictionalTicket({
          ticket_id: "SNTL-30",
          status: "duplicated",
          is_confidential: true,
        }),
      ];
      stubTicket({ duplicates: () => ticketPage(duplicates) });
      const { screen } = await renderTicket();

      await expect
        .element(screen.getByRole("link", { name: "SNTL-30" }))
        .toHaveAttribute("href", "/tickets/SNTL-30");
      const value = page.elementLocator(valueOf(screen, "Duplicates"));
      expect(textsOf(value.getByRole("link"))).toEqual(["SNTL-22", "SNTL-30"]);
      expect(
        screen.getByRole("img", { name: "Confidential" }).elements(),
      ).toHaveLength(1);
    });

    test("say how many more there are beyond a page", async () => {
      const duplicates = Array.from({ length: 100 }, (_, index) =>
        fictionalTicket({ ticket_id: `SNTL-${index + 100}` }),
      );
      stubTicket({
        duplicates: () => ticketPage(duplicates, { total: 1250, perPage: 100 }),
      });
      const { screen } = await renderTicket();

      // Their thousands grouped (docs/behaviors.md, Style).
      await expect.element(screen.getByText("and 1,150 more")).toBeVisible();
    });

    test("show None without any", async () => {
      stubTicket();
      const { screen } = await renderTicket();

      await expect
        .poll(() => valueOf(screen, "Duplicates").textContent)
        .toBe("None");
    });

    test("show the loading indicator of their read in place of their value, without the space of a part", async () => {
      const duplicates = later();
      stubTicket({ duplicates: () => duplicates.promise });
      const { screen } = await renderTicket();

      const indicator = region(screen, "Details").getByRole("progressbar", {
        name: "Loading",
      });
      await expect.element(indicator).toBeVisible();
      expect(valueOf(screen, "Duplicates").contains(indicator.element())).toBe(
        true,
      );
      expect(getComputedStyle(indicator.element()).paddingTop).toBe("0px");
    });

    test("show the failure of their read in place of their value, with Try again", async () => {
      let fail = true;
      stubTicket({
        duplicates: () =>
          fail ? errorResponse(503, "SERVICE_UNAVAILABLE") : ticketPage([]),
      });
      const { screen } = await renderTicket();

      const message = screen.getByText(
        "Sentinel isn't available right now. Try again later.",
      );
      await expect.element(message).toBeVisible();
      expect(valueOf(screen, "Duplicates").contains(message.element())).toBe(
        true,
      );
      expect(
        screen.getByText("CVE-2099-0012").elements().length,
      ).toBeGreaterThan(0);
      fail = false;

      await screen.getByRole("button", { name: "Try again" }).click();

      await expect
        .poll(() => valueOf(screen, "Duplicates").textContent)
        .toBe("None");
    });
  });
});

// Renders the screen of a Ticket with the CVE, and the part of the CVE.
async function renderCve(fields: Partial<CVEDetail> = {}) {
  const cve = fictionalCve(fields);
  showing(fictionalTicketDetail({ cve }));
  const { screen } = await renderTicket();
  return { screen, part: region(screen, cve.cve_id) };
}

describe("the CVE", () => {
  test("shows its CVE ID as the heading of the part, with a link to the CVE page of SUSE", async () => {
    const { part } = await renderCve();

    await expect
      .element(part.getByRole("heading", { level: 2, name: "CVE-2099-0012" }))
      .toBeVisible();
    await expect
      .element(part.getByRole("link", { name: "SUSE CVE page (another site)" }))
      .toHaveAttribute(
        "href",
        "https://www.suse.com/security/cve/CVE-2099-0012.html",
      );
  });

  test("encodes its CVE ID in the path of the CVE page of SUSE", async () => {
    const { part } = await renderCve({ cve_id: "CVE-2099-0012/x?y#z" });

    await expect
      .element(part.getByRole("link", { name: "SUSE CVE page (another site)" }))
      .toHaveAttribute(
        "href",
        "https://www.suse.com/security/cve/CVE-2099-0012%2Fx%3Fy%23z.html",
      );
  });

  test("shows its title, its description, its dates with their times, and its weaknesses", async () => {
    const { part } = await renderCve({
      cwes: [
        { cwe_id: "CWE-79", sources: ["nvd"] },
        { cwe_id: "CWE-787", sources: ["nvd"] },
      ],
    });

    await expect
      .element(part.getByText("Fictional flaw CVE-2099-0012"))
      .toBeVisible();
    await expect
      .element(part.getByText("A fictional description of CVE-2099-0012."))
      .toBeVisible();
    const facts = textsOf(part.getByRole("definition"));
    expect(facts.slice(0, 3)).toEqual([
      formatDateTime("2099-10-01T08:00:00Z"),
      formatDateTime("2099-10-08T08:00:00Z"),
      "CWE-79, CWE-787",
    ]);
    expect(textsOf(part.getByRole("term")).slice(0, 3)).toEqual([
      "Published",
      "Modified",
      "CWE",
    ]);
    // Without external identifiers, the CVE has no such field.
    expect(textsOf(part.getByRole("term"))).not.toContain(
      "External identifiers",
    );
  });

  test("cuts a longer description to four lines with Show more", async () => {
    const description = Array.from(
      { length: 40 },
      (_, index) => `Fictional sentence ${index + 1} of a long description.`,
    ).join(" ");
    const { part } = await renderCve({ description });

    const more = part.getByRole("button", { name: "Show more" });
    await expect.element(more).toHaveAttribute("aria-expanded", "false");
    expect(boxOf(part.getByText(description)).height).toBe(4 * 24);
  });

  test("shows absent values, and no description, where Sentinel returns none", async () => {
    const { part } = await renderCve({
      title: null,
      description: null,
      published_date: null,
      modified_date: null,
    });

    await expect.element(part.getByText("No description.")).toBeVisible();
    expect(textsOf(part.getByRole("definition")).slice(0, 3)).toEqual([
      "–Not set",
      "–Not set",
      "–Not set",
    ]);
  });

  test("links its external identifiers to their advisories, and shows one without a web address as text", async () => {
    const { part } = await renderCve({
      external_identifiers: [
        {
          source: "ghsa",
          identifier: "GHSA-2c4f-7h9j-mqrv",
          url: "https://github.com/advisories/GHSA-2c4f-7h9j-mqrv",
        },
        { source: "pysec", identifier: "PYSEC-2099-12", url: "pkg:pypi/x" },
      ],
    });

    await expect
      .element(
        part.getByRole("link", { name: "GHSA-2c4f-7h9j-mqrv (another site)" }),
      )
      .toHaveAttribute(
        "href",
        "https://github.com/advisories/GHSA-2c4f-7h9j-mqrv",
      );
    await expect.element(part.getByText("PYSEC-2099-12")).toBeVisible();
    expect(part.getByRole("link", { name: /PYSEC/ }).elements()).toHaveLength(
      0,
    );
  });

  test("marks a rejected CVE with the date and time of its rejection", async () => {
    const { screen } = await renderCve({
      cve_state: "rejected",
      date_rejected: "2099-10-07T09:00:00Z",
    });
    const part = region(screen, "CVE-2099-0012 Rejected");

    await expect
      .element(
        screen.getByRole("heading", {
          level: 2,
          name: "CVE-2099-0012 Rejected",
        }),
      )
      .toBeVisible();
    const terms = textsOf(part.getByRole("term"));
    const definitions = textsOf(part.getByRole("definition"));
    expect(definitions[terms.indexOf("Rejected")]).toBe(
      formatDateTime("2099-10-07T09:00:00Z"),
    );
  });

  test("shows a state of the CVE that the pinned contract does not list as received", async () => {
    showingUnlisted({
      ...fictionalTicketDetail(),
      cve: { ...fictionalCve(), cve_state: "fictional_state" },
    });
    const { screen } = await renderTicket();

    await expect
      .element(
        screen.getByRole("heading", {
          level: 2,
          name: "CVE-2099-0012 fictional_state",
        }),
      )
      .toBeVisible();
  });

  test("shows its exploitation: not listed in CISA KEV, the SSVC decision points, and no EPSS score", async () => {
    const { part } = await renderCve();

    const terms = textsOf(part.getByRole("term"));
    const definitions = textsOf(part.getByRole("definition"));
    const valueOfTerm = (term: string) => definitions[terms.indexOf(term)];
    expect(valueOfTerm("CISA KEV")).toBe("Not listed");
    expect(valueOfTerm("Exploitation")).toBe("PoC");
    expect(valueOfTerm("Automatable")).toBe("No");
    expect(valueOfTerm("Technical impact")).toBe("Partial");
    expect(valueOfTerm("Version")).toBe("2.0.3");
    expect(valueOfTerm("Assessed")).toBe(
      formatDateTime("2099-10-06T10:15:00Z"),
    );
    expect(valueOfTerm("EPSS")).toBe("–Not set");
  });

  test("shows the date of its CISA KEV entry, and its EPSS score and percentile cut to five decimals, with at least two", async () => {
    const { part } = await renderCve({
      kev: { date_added: "2099-10-05", reference_url: null },
      ssvc: null,
      epss: { score: 0.000436, percentile: 0.3, assessed_at: "2099-10-08" },
    });

    const terms = textsOf(part.getByRole("term"));
    const definitions = textsOf(part.getByRole("definition"));
    const valueOfTerm = (term: string) => definitions[terms.indexOf(term)];
    expect(valueOfTerm("Added")).toBe(formatDate("2099-10-05"));
    expect(valueOfTerm("SSVC")).toBe("–Not set");
    expect(valueOfTerm("Score")).toBe("0.00043");
    expect(valueOfTerm("Percentile")).toBe("0.30");
    expect(definitions.at(-1)).toBe(formatDate("2099-10-08"));
  });

  test("shows SSVC values that the pinned contract does not list as received", async () => {
    showingUnlisted({
      ...fictionalTicketDetail(),
      cve: {
        ...fictionalCve(),
        ssvc: {
          exploitation: "fictional_exploitation",
          automatable: "fictional_automatable",
          technical_impact: "fictional_impact",
          version: "3.0.0",
          assessed_at: null,
        },
      },
    });
    const { screen } = await renderTicket();
    const part = region(screen, "CVE-2099-0012");

    await expect
      .element(part.getByText("fictional_exploitation"))
      .toBeVisible();
    await expect.element(part.getByText("fictional_automatable")).toBeVisible();
    await expect.element(part.getByText("fictional_impact")).toBeVisible();
  });

  test("shows its exploitation in three columns, one below the other in a narrow window", async () => {
    const { part } = await renderCve();
    const kev = () => boxOf(part.getByText("CISA KEV", { exact: true }));
    const ssvc = () => boxOf(part.getByText("SSVC", { exact: true }));
    expect(ssvc().top).toBe(kev().top);

    await page.viewport(320, 640);

    await expect.poll(() => ssvc().top).toBeGreaterThan(kev().bottom);
  });

  test("shows No CVE. for a Ticket without a CVE", async () => {
    showing(fictionalTicketDetail({ cve: null }));
    const { screen } = await renderTicket();

    const part = region(screen, "CVE");
    await expect.element(part.getByText("No CVE.")).toBeVisible();
  });
});

describe("the anchor of the URL", () => {
  test("shows its part once the reads of the tab have settled", async () => {
    await page.viewport(900, 300);
    const duplicates = later();
    stubTicket({ duplicates: () => duplicates.promise });
    const { screen } = await renderTicket("/tickets/SNTL-12#cve");
    expect(window.scrollY).toBe(0);

    duplicates.resolve(ticketPage([]));

    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    expect(Math.round(boxOf(region(screen, "CVE-2099-0012")).top)).toBe(0);
  });

  test("shows its part below the compact heading with two columns", async () => {
    await page.viewport(1280, 300);
    showing(fictionalTicketDetail({ cve: longCve() }));
    const { screen } = await renderTicket("/tickets/SNTL-12#cve");

    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    const title = heading(screen, "SNTL-12");
    await expect
      .poll(() => getComputedStyle(title.element()).fontSize)
      .toBe("16px");
    const tabs = boxOf(screen.getByRole("tab", { name: "Overview" }));
    expect(boxOf(region(screen, "CVE-2099-0012")).top).toBeGreaterThanOrEqual(
      tabs.bottom,
    );
    await expect
      .element(
        region(screen, "CVE-2099-0012").getByRole("heading", { level: 2 }),
      )
      .toBeInViewport();
  });

  test.each([
    ["two columns", 1280],
    ["one column", 900],
  ])("shows the details in %s", async (_, width) => {
    await page.viewport(width, 300);
    showing(fictionalTicketDetail({ cve: longCve() }));
    const { screen } = await renderTicket("/tickets/SNTL-12#details");

    // The page scrolls to the details, which start below the tabs.
    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    const details = region(screen, "Details");
    const tabs = boxOf(screen.getByRole("tab", { name: "Overview" }));
    expect(boxOf(details).top).toBeGreaterThanOrEqual(Math.max(tabs.bottom, 0));
    await expect
      .element(details.getByRole("heading", { level: 2, name: "Details" }))
      .toBeInViewport();
  });

  test("shows its part on a duplicate, whose duplicates the tab does not read", async () => {
    await page.viewport(900, 300);
    showing(
      fictionalTicketDetail({
        status: "duplicated",
        duplicate_of_ticket_id: "SNTL-21",
      }),
    );
    const { screen } = await renderTicket("/tickets/SNTL-12#cve");

    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    expect(Math.round(boxOf(region(screen, "CVE-2099-0012")).top)).toBe(0);
  });

  test("shows the CVSS assessments once their read has settled", async () => {
    await page.viewport(900, 300);
    const cvss = later();
    stubTicket({ cvss: () => cvss.promise });
    const { screen } = await renderTicket("/tickets/SNTL-12#cvss");
    await expect
      .poll(() => valueOf(screen, "Duplicates").textContent)
      .toBe("None");
    expect(window.scrollY).toBe(0);

    cvss.resolve(cvssResponse());

    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    await expect
      .element(
        region(screen, "CVSS assessments").getByRole("heading", {
          level: 2,
          name: "CVSS assessments",
        }),
      )
      .toBeInViewport();
  });

  test.each([
    ["two columns", 1280],
    ["one column", 900],
  ])(
    "shows the sources of the CVE in %s once their read has settled",
    async (_, width) => {
      await page.viewport(width, 300);
      const sources = later();
      stubTicket({
        ticket: () => ticketResponse(fictionalTicketDetail({ cve: longCve() })),
        sources: () => sources.promise,
      });
      const { screen } = await renderTicket("/tickets/SNTL-12#sources");
      await expect
        .poll(() => valueOf(screen, "Duplicates").textContent)
        .toBe("None");
      expect(window.scrollY).toBe(0);

      // Every source, so that the window shows the start of the sources
      // before the end of the page.
      sources.resolve(sourcesResponse(EVERY_SOURCE));

      await expect.poll(() => window.scrollY).toBeGreaterThan(0);
      const title = region(screen, "Sources of the CVE").getByRole("heading", {
        level: 2,
        name: "Sources of the CVE",
      });
      await expect.element(title).toBeInViewport();
      // Below the tabs, and so below the compact heading with two columns.
      const tabs = boxOf(screen.getByRole("tab", { name: "Overview" }));
      expect(boxOf(title).top).toBeGreaterThanOrEqual(tabs.bottom);
    },
  );

  test.each(["cvss", "sources"])(
    "shows the top of the screen when the Ticket lacks the target %s",
    async (anchor) => {
      await page.viewport(900, 300);
      const duplicates = later();
      // The CVSS assessments and the sources of a Ticket without a CVE.
      stubTicket({
        ticket: () => ticketResponse(fictionalTicketDetail({ cve: null })),
        duplicates: () => duplicates.promise,
      });
      const { screen } = await renderTicket(`/tickets/SNTL-12#${anchor}`);
      // The page lies elsewhere, without the user having scrolled it.
      window.scrollTo(0, 10);
      await expect.poll(() => window.scrollY).toBe(10);

      duplicates.resolve(ticketPage([]));

      await expect
        .poll(() => valueOf(screen, "Duplicates").textContent)
        .toBe("None");
      await expect.poll(() => window.scrollY).toBe(0);
    },
  );

  test("leaves the page where the user scrolled it with the keyboard meanwhile", async () => {
    await page.viewport(900, 300);
    const duplicates = later();
    stubTicket({ duplicates: () => duplicates.promise });
    const { screen } = await renderTicket("/tickets/SNTL-12#cve");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
    window.scrollTo(0, 10);

    duplicates.resolve(ticketPage([]));

    await expect
      .poll(() => valueOf(screen, "Duplicates").textContent)
      .toBe("None");
    expect(window.scrollY).toBe(10);
  });

  test("still shows its part after a key that does not scroll the page", async () => {
    await page.viewport(900, 300);
    const duplicates = later();
    stubTicket({ duplicates: () => duplicates.promise });
    const { screen } = await renderTicket("/tickets/SNTL-12#cve");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));

    duplicates.resolve(ticketPage([]));

    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    expect(Math.round(boxOf(region(screen, "CVE-2099-0012")).top)).toBe(0);
  });

  test("leaves the page where the user scrolled it meanwhile", async () => {
    await page.viewport(900, 300);
    const duplicates = later();
    stubTicket({ duplicates: () => duplicates.promise });
    const { screen } = await renderTicket("/tickets/SNTL-12#cve");
    window.dispatchEvent(new WheelEvent("wheel"));
    window.scrollTo(0, 10);

    duplicates.resolve(ticketPage([]));

    await expect
      .poll(() => valueOf(screen, "Duplicates").textContent)
      .toBe("None");
    expect(window.scrollY).toBe(10);
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
