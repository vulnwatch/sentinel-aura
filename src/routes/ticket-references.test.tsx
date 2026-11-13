import { focusManager, type QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import type {
  CurrentUserResponse,
  TicketReferenceDataResponse,
  TicketReferenceListResponse,
  TicketReferenceResponse,
} from "../api/generated/model";
import { formatDateTime } from "../components/date-time";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import {
  actorsResponse,
  errorResponse,
  eventPage,
  fictionalEvent,
  fictionalTicketDetail,
  jsonResponse,
  OTHER_USER,
  requestsTo,
  stubApi,
  ticketPage,
  ticketResponse,
  urlOf,
  validationError,
} from "../test-api";

// The tab References of the Ticket screen (docs/screens/ticket.md,
// References), at the browser's default text size, in the light theme. Its
// dates and times are local times of the browser, sent in UTC as the API
// sends them, so that the tests hold in every time zone.

const ME = "/api/v1/users/me";
const TICKETS = "/api/v1/tickets";
const TICKET = "/api/v1/tickets/SNTL-12";
const REFERENCES = "/api/v1/tickets/SNTL-12/references";
const EVENTS = "/api/v1/tickets/SNTL-12/audit-log";
const ACTORS = "/api/v1/tickets/SNTL-12/actors";
// The path of the tab.
const PATH = "/tickets/SNTL-12/references";

const MESSAGE_UNAVAILABLE =
  "Sentinel isn't available right now. Try again later.";
const MESSAGE_UNCONFIRMED =
  "Sentinel didn't confirm this change. It may have taken effect: check before trying again.";
const MESSAGE_CONFLICT =
  "This can't be done in the current state, which may have changed. Check it and try again.";
const MESSAGE_GONE =
  "This no longer exists, or you no longer have access to it.";
const MESSAGE_NOT_ACCEPTED = "Sentinel didn't accept this request.";
const MESSAGE_INVALID = "This value isn't valid.";
const MESSAGE_ADDRESS_TAKEN =
  "This Ticket already has a reference with this address.";
const NO_MATCH = "No references match the filters.";

// fg-muted of the light theme.
const FG_MUTED = "rgb(89, 99, 110)";

// The backgrounds of the messages of each tone in the light theme
// (docs/design-system.md, Tones).
const MESSAGE_TONES = {
  success: "rgb(218, 251, 225)",
  warning: "rgb(255, 248, 197)",
  danger: "rgb(255, 235, 233)",
} as const;

// An analyst who manages the references of the Tickets, as Alice Smith of
// OTHER_USER, who holds triage_ticket alone.
const MANAGER: CurrentUserResponse = {
  data: {
    ...OTHER_USER.data,
    capabilities: ["triage_ticket", "manage_references"],
  },
};

// A fictional reference of SNTL-12, as List References returns it: a manual
// advisory, with the fields that a test sets.
function fictionalReference(
  fields: Partial<TicketReferenceResponse> = {},
): TicketReferenceResponse {
  return {
    id: "00000000-0000-7000-8000-0000000000f2",
    ticket_id: "SNTL-12",
    url: "https://advisories.example.com/fictional-openssl/2099-0012",
    title: "Fictional advisory",
    description: "A fictional advisory of fictional-openssl.",
    type: "advisory",
    source: "manual",
    created_at: "2099-10-10T09:30:00Z",
    updated_at: "2099-10-10T09:30:00Z",
    ...fields,
  };
}

// The references of SNTL-12, in the order of List References, by type, then
// by the time they were added: the advisory of NVD, which its fetcher added;
// a manual advisory; a manual patch without a title; a bug report that the
// fetcher of Red Hat added; and a manual post without a type.
const NVD = fictionalReference({
  id: "00000000-0000-7000-8000-0000000000f1",
  url: "https://nvd.example.com/vuln/detail/CVE-2099-0012",
  title: "NVD",
  description: null,
  source: "sync_nvd_cves",
  created_at: "2099-10-09T14:05:09Z",
});
const ADVISORY = fictionalReference();
const PATCH = fictionalReference({
  id: "00000000-0000-7000-8000-0000000000f3",
  url: "https://git.example.org/fictional-openssl/commit/0a1b2c3d",
  title: null,
  description: null,
  type: "patch",
  created_at: "2099-10-10T10:00:00Z",
});
const ISSUE = fictionalReference({
  id: "00000000-0000-7000-8000-0000000000f4",
  url: "https://bugzilla.example.com/show_bug.cgi?id=1201",
  title: "Fictional bug report",
  description: null,
  type: "issue",
  source: "sync_redhat_cves",
  created_at: "2099-10-09T14:06:00Z",
});
const POST = fictionalReference({
  id: "00000000-0000-7000-8000-0000000000f5",
  url: "https://lists.example.org/fictional/2099/11/1",
  title: "Fictional mailing list post",
  description: null,
  type: null,
  created_at: "2099-10-11T08:00:00Z",
});
const EVERY_REFERENCE = [NVD, ADVISORY, PATCH, ISSUE, POST] as const;

// List References's response.
function referencesResponse(
  references: readonly TicketReferenceResponse[] = EVERY_REFERENCE,
): Response {
  const body: TicketReferenceListResponse = { data: [...references] };
  return jsonResponse(200, body);
}

// List References's response with references whose fields hold values that
// the pinned contract does not list, which a later Sentinel release can
// return.
function unlistedResponse(...references: object[]): Response {
  return jsonResponse(200, { data: references });
}

// The response of Add Reference, 201, or of Update Reference, 200.
function referenceResponse(
  reference: TicketReferenceResponse,
  status: 200 | 201 = 200,
): Response {
  const body: TicketReferenceDataResponse = { data: reference };
  return jsonResponse(status, body);
}

// Delete Reference's response.
function deleted(): Response {
  return new Response(null, { status: 204 });
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

interface Stub {
  // The signed-in user.
  user: CurrentUserResponse;
  // The response to Get Ticket.
  ticket: () => Response | Promise<Response>;
  // The response to List References.
  references: () => Response | Promise<Response>;
  // The response to Add Reference, given its body.
  add: (body: unknown) => Response | Promise<Response>;
  // The response to Update Reference, given its path and its body.
  update: (path: string, body: unknown) => Response | Promise<Response>;
  // The response to Delete Reference, given its path.
  remove: (path: string) => Response | Promise<Response>;
}

// Answers the read of the signed-in user, by default an analyst who manages
// references, Get Ticket, List References with every reference, its
// changes, and the reads of Audit log and of Ticket list, as the test sets
// them, and returns the stub, which a test can change, and the spy, whose
// calls name the requests.
function stubReferences(fields: Partial<Stub> = {}) {
  const stub: Stub = {
    user: MANAGER,
    ticket: () => ticketResponse(fictionalTicketDetail()),
    references: () => referencesResponse(),
    add: () => referenceResponse(ADVISORY, 201),
    update: () => referenceResponse(ADVISORY),
    remove: () => deleted(),
    ...fields,
  };
  const spy = stubApi((request) => {
    if (request.path === ME) {
      return jsonResponse(200, stub.user);
    }
    if (request.path === REFERENCES && request.method === "POST") {
      return stub.add(request.body);
    }
    if (request.path === REFERENCES) {
      return stub.references();
    }
    if (request.path.startsWith(`${REFERENCES}/`)) {
      return request.method === "PATCH"
        ? stub.update(request.path, request.body)
        : stub.remove(request.path);
    }
    if (request.path === EVENTS) {
      return eventPage([fictionalEvent()]);
    }
    if (request.path === ACTORS) {
      return actorsResponse();
    }
    if (request.path === TICKET) {
      return stub.ticket();
    }
    if (request.path === TICKETS) {
      return ticketPage([]);
    }
    return errorResponse(404, "RESOURCE_NOT_FOUND");
  });
  return { stub, spy };
}

// Answers List References with the references.
function showing(...references: TicketReferenceResponse[]) {
  return stubReferences({ references: () => referencesResponse(references) });
}

async function renderApp(path: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  return { router, screen };
}

type Screen = Awaited<ReturnType<typeof renderApp>>["screen"];

// Renders the tab and waits until it shows the Ticket and its references,
// or that it has none.
async function renderTab(path = PATH) {
  const rendered = await renderApp(path);
  await expect.element(heading(rendered.screen, "SNTL-12")).toBeVisible();
  await expect
    .element(
      tableOf(rendered.screen).or(
        panelOf(rendered.screen).getByText("No references.", { exact: true }),
      ),
    )
    .toBeVisible();
  return rendered;
}

function heading(screen: Screen, name: string) {
  return screen.getByRole("heading", { level: 1, name, exact: true });
}

function panelOf(screen: Screen) {
  return screen.getByRole("tabpanel", { name: "References" });
}

function tableOf(screen: Screen) {
  return panelOf(screen).getByRole("grid", { name: "References" });
}

// The text of a node as assistive technologies read it: without what it
// hides from them, such as the icon of a link to another site, with a space
// around each element that is not inline.
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

// The rows of the table, other than its header row, in their order.
function rowsOf(screen: Screen): Element[] {
  return tableOf(screen).getByRole("row").elements().slice(1);
}

// The cells of each row of the table, in their order, as assistive
// technologies read them.
function cellsOf(screen: Screen): string[][] {
  return rowsOf(screen).map((row) =>
    [...row.querySelectorAll('[role="rowheader"], [role="gridcell"]')].map(
      readText,
    ),
  );
}

// The name of each row of the table, by the text of the link of its
// reference: its title, or its address without one.
function namesOf(screen: Screen): string[] {
  return rowsOf(screen).map((row) =>
    readText(
      page.elementLocator(row).getByRole("link").first().element(),
    ).replace(/ \(another site\)$/, ""),
  );
}

// The name of a reference in the actions on it and in their outcome: its
// title in quotation marks, or its address.
function nameOf(reference: TicketReferenceResponse): string {
  return reference.title === null ? reference.url : `“${reference.title}”`;
}

// The row of a reference.
function rowOf(screen: Screen, reference: TicketReferenceResponse): Locator {
  return tableOf(screen)
    .getByRole("row")
    .filter({
      has: page.getByRole("link", {
        name: `${reference.title ?? reference.url} (another site)`,
        exact: true,
      }),
    });
}

function editOf(screen: Screen, reference: TicketReferenceResponse) {
  return panelOf(screen).getByRole("button", {
    name: `Edit reference ${nameOf(reference)}`,
    exact: true,
  });
}

function deleteOf(screen: Screen, reference: TicketReferenceResponse) {
  return panelOf(screen).getByRole("button", {
    name: `Delete reference ${nameOf(reference)}`,
    exact: true,
  });
}

function addButton(screen: Screen) {
  return panelOf(screen).getByRole("button", {
    name: "Add reference",
    exact: true,
  });
}

// The elements in the order of the page.
function inPageOrder(...elements: Element[]): Element[] {
  return elements.toSorted((first, second) =>
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1,
  );
}

// The number of lines on which an element shows, by the tops of the boxes
// of its text.
function linesOf(element: Element): number {
  return new Set(
    [...element.getClientRects()].map((box) => Math.round(box.top)),
  ).size;
}

// The element of the frame of the table that scrolls it sideways: the first
// within the frame, the nearest element around the table with a border line.
function scrollerOf(screen: Screen): Element {
  let frame = tableOf(screen).element().parentElement;
  while (frame !== null && getComputedStyle(frame).borderTopWidth !== "1px") {
    frame = frame.parentElement;
  }
  const scroller = frame?.firstElementChild;
  if (scroller == null) {
    throw new Error("The table has no frame");
  }
  return scroller;
}

// The texts of the status regions of the tab that say something.
function announcementsOf(screen: Screen): string[] {
  return panelOf(screen)
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

// Presses a button from the keyboard, which keeps the focus on it.
async function press(button: Locator) {
  button.element().focus();
  await userEvent.keyboard("{Enter}");
}

// The color behind an element: the background of the nearest element, itself
// or one that contains it, that has one.
function backgroundBehind(element: Element): string {
  for (
    let current: Element | null = element;
    current;
    current = current.parentElement
  ) {
    const background = getComputedStyle(current).backgroundColor;
    if (background !== "rgba(0, 0, 0, 0)") {
      return background;
    }
  }
  return "transparent";
}

// The requests of the spy with the method.
function requestsWith(spy: ReturnType<typeof stubApi>, method: string) {
  return spy.mock.calls.filter(([, init]) => init?.method === method);
}

// The queries of the reads of the references, in their order, each as its
// text.
function referenceReads(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .filter(
      ([input, init]) =>
        urlOf(input).pathname === REFERENCES &&
        (init?.method ?? "GET") === "GET",
    )
    .map(([input]) => urlOf(input).search);
}

// The paths of the requests to the API, other than the read of the
// signed-in user.
function pathsOf(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input).pathname)
    .filter((path) => path !== ME);
}

// Opens the popover of the filters, and returns it.
async function openFilters(screen: Screen) {
  await screen.getByRole("button", { name: /^Filters/ }).click();
  const dialog = screen.getByRole("dialog", { name: "Filters" });
  await expect.element(dialog).toBeVisible();
  return dialog;
}

// Checks or unchecks a type, with a click on its name, as its box covers its
// input.
async function toggleType(dialog: Locator, type: string) {
  await dialog
    .getByRole("group", { name: "Type" })
    .getByText(type, { exact: true })
    .click();
}

// The select of the source in the popover of the filters, named by the
// option that it shows and its name.
function sourceSelectOf(dialog: Locator) {
  return dialog.getByRole("button", { name: /Source$/ });
}

// Opens the options of the source, and returns them.
async function openSources(dialog: Locator) {
  await sourceSelectOf(dialog).click();
  const options = page.getByRole("listbox", { name: "Source" });
  await expect.element(options).toBeVisible();
  return options;
}

// The names of the options of a listbox, in their order.
function optionNames(listbox: Locator): string[] {
  return listbox
    .getByRole("option")
    .elements()
    .map((option) => readText(option));
}

describe("the tab", () => {
  test("opens at its path, selected, between Overview and Audit log", async () => {
    stubReferences();

    const { screen } = await renderTab();

    const tabs = screen.getByRole("tablist", { name: "Ticket" });
    expect(
      tabs
        .getByRole("tab")
        .elements()
        .map((tab) => tab.textContent),
    ).toEqual(["Overview", "References", "Audit log"]);
    await expect
      .element(tabs.getByRole("tab", { name: "References" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(tabs.getByRole("tab", { name: "References" }))
      .toHaveAttribute("href", PATH);
    expect(document.title).toBe("SNTL-12 – Sentinel");
  });

  test("shows the toolbar, the tabs, and the references at once, while Get Ticket is still pending", async () => {
    const ticket = later();
    stubReferences({ ticket: () => ticket.promise });

    const { screen } = await renderApp(PATH);

    await expect.element(heading(screen, "Ticket")).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Filters" }))
      .toBeVisible();
    await expect.element(addButton(screen)).toBeVisible();
    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    await expect.element(heading(screen, "Ticket")).toBeVisible();

    ticket.resolve(ticketResponse(fictionalTicketDetail()));

    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
  });

  test("reads the Ticket and the whole list of its references, without parameters, as it opens, and none of the reads of the other tabs", async () => {
    const { spy } = stubReferences();

    await renderTab(`${PATH}?type=patch&source=manual`);

    await expect
      .poll(() => new Set(pathsOf(spy)))
      .toEqual(new Set([TICKET, REFERENCES]));
    expect(pathsOf(spy)).toHaveLength(2);
    expect(referenceReads(spy)).toEqual([""]);
  });

  test("opens at its path without parameters from the tab, which Overview leaves", async () => {
    stubReferences();
    const { router, screen } = await renderTab(`${PATH}?type=patch`);
    const tabs = screen.getByRole("tablist", { name: "Ticket" });
    await expect
      .element(tabs.getByRole("tab", { name: "References" }))
      .toHaveAttribute("href", PATH);

    await tabs.getByRole("tab", { name: "Overview" }).click();

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets/SNTL-12");
    await tabs.getByRole("tab", { name: "References" }).click();
    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect.poll(() => namesOf(screen)).toHaveLength(5);
  });
});

describe("the table", () => {
  test("shows each reference in the order of the API: the reference, its type, its source, and when it was added, with the column of the actions", async () => {
    stubReferences();

    const { screen } = await renderTab();

    expect(
      tableOf(screen)
        .getByRole("columnheader")
        .elements()
        .map((header) => header.textContent),
    ).toEqual(["Reference", "Type", "Source", "Added", "Actions"]);
    expect(cellsOf(screen)).toEqual([
      [
        "NVD (another site) https://nvd.example.com/vuln/detail/CVE-2099-0012",
        "Advisory",
        "NVD",
        formatDateTime(NVD.created_at),
        "",
      ],
      [
        "Fictional advisory (another site) https://advisories.example.com/fictional-openssl/2099-0012 A fictional advisory of fictional-openssl.",
        "Advisory",
        "Manual",
        formatDateTime(ADVISORY.created_at),
        "",
      ],
      [
        "https://git.example.org/fictional-openssl/commit/0a1b2c3d (another site)",
        "Patch",
        "Manual",
        formatDateTime(PATCH.created_at),
        "",
      ],
      [
        "Fictional bug report (another site) https://bugzilla.example.com/show_bug.cgi?id=1201",
        "Issue",
        "Red Hat",
        formatDateTime(ISSUE.created_at),
        "",
      ],
      [
        "Fictional mailing list post (another site) https://lists.example.org/fictional/2099/11/1",
        "Uncategorized",
        "Manual",
        formatDateTime(POST.created_at),
        "",
      ],
    ]);
  });

  test("names each row by its reference, which links its title to its address, with the address below it in text-13 and fg-muted", async () => {
    stubReferences();
    const { screen } = await renderTab();
    const row = rowOf(screen, ADVISORY);

    const link = row.getByRole("link", {
      name: "Fictional advisory (another site)",
    });
    await expect.element(link).toHaveAttribute("href", ADVISORY.url);
    expect(readText(row.getByRole("rowheader").element())).toMatch(
      /^Fictional advisory \(another site\) /,
    );
    const address = row.getByText(ADVISORY.url, { exact: true }).element();
    expect(getComputedStyle(address).fontSize).toBe("13px");
    expect(getComputedStyle(address).color).toBe(FG_MUTED);
    expect(address.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      link.element().getBoundingClientRect().bottom,
    );
    expect(getComputedStyle(link.element()).fontWeight).toBe("500");
  });

  test("links a reference without a title by its address, without the address below it", async () => {
    showing(PATCH);
    const { screen } = await renderTab();

    const row = rowOf(screen, PATCH);
    await expect
      .element(row.getByRole("link"))
      .toHaveAttribute("href", PATCH.url);
    expect(readText(row.getByRole("rowheader").element())).toBe(
      `${PATCH.url} (another site)`,
    );
    // No text of the address but that of the link.
    expect(row.getByText(PATCH.url, { exact: true }).elements()).toEqual([]);
  });

  test("shows and links the address as the browser parses it", async () => {
    showing(
      fictionalReference({
        url: "https://advisories.example.com/fictional advisory",
        title: null,
      }),
      fictionalReference({
        id: "00000000-0000-7000-8000-0000000000f6",
        url: "https://advisories.example.com/fictional advisory 2",
      }),
    );
    const { screen } = await renderTab();

    const parsed = "https://advisories.example.com/fictional%20advisory";
    await expect
      .element(
        tableOf(screen).getByRole("link", {
          name: `${parsed} (another site)`,
          exact: true,
        }),
      )
      .toHaveAttribute("href", parsed);
    await expect
      .element(tableOf(screen).getByText(`${parsed}%202`, { exact: true }))
      .toBeVisible();
  });

  test("cuts a description longer than four lines with Show more, which shows it whole", async () => {
    showing(
      fictionalReference({
        description: Array.from(
          { length: 8 },
          (_, index) => `Fictional line ${String(index + 1)} of the analysis.`,
        ).join("\n"),
      }),
    );
    const { screen } = await renderTab();
    const more = tableOf(screen).getByRole("button", { name: "Show more" });

    await expect.element(more).toBeVisible();
    await expect.element(more).toHaveAttribute("aria-expanded", "false");
    await more.click();

    await expect
      .element(tableOf(screen).getByRole("button", { name: "Show less" }))
      .toHaveAttribute("aria-expanded", "true");
  });

  test("shows a reference without a type as Uncategorized, in fg-muted, and a type that the pinned contract does not list as received", async () => {
    stubReferences({
      references: () =>
        unlistedResponse(
          { ...ADVISORY, type: "fictional_type" },
          { ...POST, fictional_field: "A fictional value" },
        ),
    });
    const { screen } = await renderTab();

    expect(cellsOf(screen).map((cells) => cells[1])).toEqual([
      "fictional_type",
      "Uncategorized",
    ]);
    const uncategorized = rowOf(screen, POST).getByText("Uncategorized", {
      exact: true,
    });
    expect(getComputedStyle(uncategorized.element()).color).toBe(FG_MUTED);
    const unlisted = rowOf(screen, ADVISORY).getByText("fictional_type", {
      exact: true,
    });
    expect(getComputedStyle(unlisted.element()).color).not.toBe(FG_MUTED);
  });

  test("names the source of each reference: Manual, the CVE source of each fetcher, and a fetcher that the pinned contract does not list as received", async () => {
    const sources = [
      ["manual", "Manual"],
      ["sync_nvd_cves", "NVD"],
      ["sync_mitre_cves", "MITRE"],
      ["sync_kernel_cves", "Linux Kernel CNA"],
      ["sync_ghsa_advisories", "GHSA"],
      ["sync_redhat_cves", "Red Hat"],
      ["sync_osv_advisories", "OSV"],
      ["sync_cisa_kev", "CISA KEV"],
      ["sync_epss_scores", "EPSS"],
      ["sync_fictional_cves", "sync_fictional_cves"],
    ] as const;
    showing(
      ...sources.map(([source], index) =>
        fictionalReference({
          id: `00000000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`,
          url: `https://advisories.example.com/${source}`,
          title: null,
          source,
        }),
      ),
    );

    const { screen } = await renderTab();

    expect(cellsOf(screen).map((cells) => cells[2])).toEqual(
      sources.map(([, name]) => name),
    );
  });

  test("says No references. without any, with Filters and Add reference, also while a filter applies", async () => {
    showing();

    const { screen } = await renderTab(`${PATH}?type=patch`);

    await expect
      .element(panelOf(screen).getByText("No references.", { exact: true }))
      .toBeVisible();
    expect(tableOf(screen).query()).toBeNull();
    expect(panelOf(screen).getByText(NO_MATCH).query()).toBeNull();
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toBeVisible();
    await expect.element(addButton(screen)).toBeVisible();
  });

  test.each([
    ["without a filter", "", ["Add reference", "Filters"]],
    [
      "with a filter",
      "?type=patch",
      ["Add reference", "Filters 1 applied", "Clear filters"],
    ],
  ])(
    "puts Add reference, Filters, and Clear filters while a filter applies, last, in this order at the end of the line above the table, %s",
    async (_, search, names) => {
      stubReferences();
      const { screen } = await renderTab(`${PATH}${search}`);

      const buttons = names.map((name) =>
        panelOf(screen).getByRole("button", { name, exact: true }).element(),
      );
      expect(inPageOrder(...buttons)).toEqual(buttons);
      const boxes = buttons.map((button) => button.getBoundingClientRect());
      for (const [index, box] of boxes.entries()) {
        const before = boxes[index - 1];
        if (before !== undefined) {
          expect(box.left).toBeGreaterThan(before.right);
          expect(box.top).toBe(before.top);
        }
      }
      const table = tableOf(screen).element().getBoundingClientRect();
      expect(boxes.at(-1)?.bottom).toBeLessThan(table.top);
      // The table ends within the border line of its frame.
      expect(Math.abs((boxes.at(-1)?.right ?? 0) - table.right)).toBeLessThan(
        1.5,
      );
    },
  );

  test("reflows at 320 CSS pixels, the table scrolling within its frame rather than the page", async () => {
    await page.viewport(320, 640);
    stubReferences();
    const { screen } = await renderTab();

    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    expect(document.documentElement.scrollWidth).toBe(320);
    expect(
      tableOf(screen)
        .getByRole("columnheader", { name: "Reference" })
        .element()
        .getBoundingClientRect().width,
    ).toBeGreaterThanOrEqual(192);
    const scroller = scrollerOf(screen);
    expect(getComputedStyle(scroller).overflowX).toBe("auto");
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  });

  test("wraps a title and an address without a point where they could break over several lines, the table keeping to its frame", async () => {
    const address = `https://advisories.example.com/${"fictional".repeat(40)}`;
    const titled = fictionalReference({
      title: "Fictional".repeat(30),
      url: address,
      description: null,
    });
    const untitled = fictionalReference({
      id: "00000000-0000-7000-8000-0000000000f6",
      title: null,
      url: `${address}-2`,
      description: null,
    });
    showing(titled, untitled);
    const { screen } = await renderTab();

    await expect.poll(() => namesOf(screen)).toHaveLength(2);
    const scroller = scrollerOf(screen);
    expect(scroller.scrollWidth).toBe(scroller.clientWidth);
    for (const reference of [titled, untitled]) {
      expect(
        linesOf(rowOf(screen, reference).getByRole("link").element()),
      ).toBeGreaterThan(1);
    }
    // The address below the title is a box of its own, as high as its lines.
    const below = rowOf(screen, titled)
      .getByText(address, { exact: true })
      .element();
    expect(below.getBoundingClientRect().height).toBeGreaterThan(
      1.5 * Number.parseFloat(getComputedStyle(below).lineHeight),
    );
  });
});

describe("the actions", () => {
  test("offer Edit and Delete at the end of the row of each manual reference alone, named after the reference, to a user who manages references", async () => {
    stubReferences();
    const { screen } = await renderTab();

    expect(
      tableOf(screen)
        .getByRole("button")
        .elements()
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Edit reference “Fictional advisory”",
      "Delete reference “Fictional advisory”",
      `Edit reference ${PATCH.url}`,
      `Delete reference ${PATCH.url}`,
      "Edit reference “Fictional mailing list post”",
      "Delete reference “Fictional mailing list post”",
    ]);
    for (const reference of [NVD, ISSUE]) {
      expect(rowOf(screen, reference).getByRole("button").elements()).toEqual(
        [],
      );
    }
    const row = rowOf(screen, ADVISORY).element().getBoundingClientRect();
    expect(
      Math.round(
        deleteOf(screen, ADVISORY).element().getBoundingClientRect().right,
      ),
    ).toBe(Math.round(row.right) - 16);
  });

  test("name the column of the actions for assistive technologies alone", async () => {
    stubReferences();
    const { screen } = await renderTab();

    const header = tableOf(screen).getByRole("columnheader", {
      name: "Actions",
    });
    await expect.element(header).toBeInTheDocument();
    expect(
      screen
        .getByText("Actions", { exact: true })
        .element()
        .getBoundingClientRect().width,
    ).toBeLessThanOrEqual(1);
  });

  test.each([
    ["Edit", editOf],
    ["Delete", deleteOf],
  ] as const)(
    "show %s alone in the tooltip of the action",
    async (action, buttonOf) => {
      stubReferences();
      const { screen } = await renderTab();
      // React Aria shows a tooltip on hover only once the user works with a
      // pointer, as a click shows.
      await heading(screen, "SNTL-12").click();

      await userEvent.hover(buttonOf(screen, ADVISORY));

      const tooltip = page.getByRole("tooltip");
      await expect.element(tooltip).toBeVisible();
      expect(tooltip.element().textContent).toBe(action);
    },
  );

  test("offer neither Add reference nor Edit and Delete, nor the column of the actions, to a user who does not manage references", async () => {
    stubReferences({ user: OTHER_USER });
    const { screen } = await renderTab();

    expect(
      tableOf(screen)
        .getByRole("columnheader")
        .elements()
        .map((header) => header.textContent),
    ).toEqual(["Reference", "Type", "Source", "Added"]);
    expect(addButton(screen).query()).toBeNull();
    expect(
      tableOf(screen)
        .getByRole("button", { name: /^(Edit|Delete) reference/ })
        .elements(),
    ).toEqual([]);
    await expect
      .element(screen.getByRole("button", { name: "Filters" }))
      .toBeVisible();
  });
});

describe("the filters", () => {
  test("filter by the types chosen, Uncategorized included, each change as a new entry of the browser history, and announce what the table shows", async () => {
    stubReferences();
    const { router, screen } = await renderTab();
    const dialog = await openFilters(screen);
    const status = dialog.getByRole("status").last();
    await expect.element(status).toHaveTextContent("");
    expect(
      dialog
        .getByRole("group", { name: "Type" })
        .getByRole("checkbox")
        .elements()
        .map((checkbox) => readText(checkbox.closest("label") ?? checkbox)),
    ).toEqual(["Advisory", "Patch", "Issue", "Article", "Uncategorized"]);

    await toggleType(dialog, "Uncategorized");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?type=uncategorized`);
    await expect.poll(() => namesOf(screen)).toEqual([POST.title]);
    await expect.element(status).toHaveTextContent("1 reference");

    await toggleType(dialog, "Advisory");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?type=advisory&type=uncategorized`);
    await expect
      .poll(() => namesOf(screen))
      .toEqual([NVD.title, ADVISORY.title, POST.title]);
    await expect.element(status).toHaveTextContent("3 references");
    expect(router.history.length).toBe(3);
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toBeInTheDocument();

    await toggleType(dialog, "Advisory");
    await toggleType(dialog, "Uncategorized");

    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    await expect.element(status).toHaveTextContent("5 references");
  });

  test("leave a reference of a type that the pinned contract does not list out of every type", async () => {
    stubReferences({
      references: () =>
        unlistedResponse(ADVISORY, { ...ISSUE, type: "fictional_type" }),
    });
    const { screen } = await renderTab(
      `${PATH}?type=advisory&type=patch&type=issue&type=article&type=uncategorized`,
    );

    await expect.poll(() => namesOf(screen)).toEqual([ADVISORY.title]);
  });

  test("filter by the source chosen among the sources of the Ticket, Manual first and then by name, after Any source", async () => {
    stubReferences({
      references: () =>
        referencesResponse([
          ...EVERY_REFERENCE,
          fictionalReference({
            id: "00000000-0000-7000-8000-0000000000f6",
            url: "https://advisories.example.com/fictional-fetcher",
            title: "Fictional fetcher",
            source: "fictional_fetcher",
          }),
          fictionalReference({
            id: "00000000-0000-7000-8000-0000000000f7",
            url: "https://github.example.com/advisories/GHSA-0000-0000-0001",
            title: "GHSA advisory",
            source: "sync_ghsa_advisories",
          }),
        ]),
    });
    const { router, screen } = await renderTab();
    const dialog = await openFilters(screen);
    expect(readText(sourceSelectOf(dialog).element())).toBe("Any source");

    const options = await openSources(dialog);

    expect(optionNames(options)).toEqual([
      "Any source",
      "Manual",
      "GHSA",
      "NVD",
      "Red Hat",
    ]);
    await options.getByRole("option", { name: "Red Hat" }).click();

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?source=sync_redhat_cves`);
    await expect.poll(() => namesOf(screen)).toEqual([ISSUE.title]);
    expect(readText(sourceSelectOf(dialog).element())).toBe("Red Hat");
    await expect
      .element(dialog.getByRole("status").last())
      .toHaveTextContent("1 reference");
    expect(router.history.length).toBe(2);

    const again = await openSources(dialog);
    await again.getByRole("option", { name: "Any source" }).click();

    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect.poll(() => namesOf(screen)).toHaveLength(7);
  });

  test("offer no source that the pinned contract does not list, whose references still show, and which a URL still applies, shown as received", async () => {
    const unlisted = fictionalReference({
      id: "00000000-0000-7000-8000-0000000000f6",
      url: "https://advisories.example.com/fictional-fetcher",
      title: "Fictional fetcher",
      source: "fictional_fetcher",
    });
    stubReferences({
      references: () => referencesResponse([...EVERY_REFERENCE, unlisted]),
    });
    const { router, screen } = await renderTab();
    expect(namesOf(screen)).toContain(unlisted.title);
    expect(cellsOf(screen).at(-1)?.[2]).toBe("fictional_fetcher");
    const dialog = await openFilters(screen);

    const options = await openSources(dialog);

    expect(optionNames(options)).toEqual([
      "Any source",
      "Manual",
      "NVD",
      "Red Hat",
    ]);
    await userEvent.keyboard("{Escape}");
    await expect.element(options).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).not.toBeInTheDocument();

    router.history.push(`${PATH}?source=fictional_fetcher`);

    await expect.poll(() => namesOf(screen)).toEqual([unlisted.title]);
    const again = await openFilters(screen);
    expect(readText(sourceSelectOf(again).element())).toBe("fictional_fetcher");
  });

  test("apply the type and the source together", async () => {
    stubReferences();

    const { screen } = await renderTab(
      `${PATH}?type=advisory&type=issue&source=manual`,
    );

    await expect.poll(() => namesOf(screen)).toEqual([ADVISORY.title]);
    await expect
      .element(screen.getByRole("button", { name: "Filters 2 applied" }))
      .toBeVisible();
  });

  test("show the filters that apply", async () => {
    stubReferences();
    const { screen } = await renderTab(
      `${PATH}?type=issue&source=sync_redhat_cves`,
    );

    const dialog = await openFilters(screen);

    const types = dialog.getByRole("group", { name: "Type" });
    await expect
      .element(types.getByRole("checkbox", { name: "Issue" }))
      .toBeChecked();
    await expect
      .element(types.getByRole("checkbox", { name: "Advisory" }))
      .not.toBeChecked();
    expect(readText(sourceSelectOf(dialog).element())).toBe("Red Hat");
  });

  test.each([
    ["a source that it names", "sync_epss_scores", "EPSS"],
    [
      "a source that the pinned contract does not list",
      "fictional_fetcher",
      "fictional_fetcher",
    ],
  ])(
    "show %s that no reference has, from the URL, by its name, with no reference",
    async (_, source, name) => {
      stubReferences();
      const { screen } = await renderTab(`${PATH}?source=${source}`);

      await expect
        .element(panelOf(screen).getByText(NO_MATCH, { exact: true }))
        .toBeVisible();
      const dialog = await openFilters(screen);
      expect(readText(sourceSelectOf(dialog).element())).toBe(name);
    },
  );

  test("show the loading indicator in place of the sources while the references load", async () => {
    const references = later();
    stubReferences({ references: () => references.promise });
    const { screen } = await renderApp(PATH);
    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
    const dialog = await openFilters(screen);

    const options = await openSources(dialog);

    expect(optionNames(options)).toEqual(["Any source"]);
    // The loading indicator describes the options, so that it is read as
    // they open.
    await expect.element(options).toHaveAccessibleDescription("Loading");
    references.resolve(referencesResponse());
    await expect.poll(() => optionNames(options)).toHaveLength(4);
  });

  test("show the failure of the read of the references in place of the sources, and say it in the popover", async () => {
    stubReferences({
      references: () => errorResponse(503, "DATABASE_UNAVAILABLE"),
    });
    const { screen } = await renderApp(PATH);
    await expect
      .element(panelOf(screen).getByText(MESSAGE_UNAVAILABLE))
      .toBeVisible();
    const dialog = await openFilters(screen);
    await expect
      .element(dialog.getByRole("status").last())
      .toHaveTextContent(MESSAGE_UNAVAILABLE);

    const options = await openSources(dialog);

    expect(optionNames(options)).toEqual(["Any source"]);
    // The message describes the options, so that it is read as they open.
    await expect
      .element(options)
      .toHaveAccessibleDescription(MESSAGE_UNAVAILABLE);
  });
});

describe("Clear filters", () => {
  test.each([
    ["without a filter", "", false],
    ["with a type", "?type=patch", true],
    ["with a source", "?source=manual", true],
  ])("shows in the toolbar %s: %s", async (_, search, shown) => {
    stubReferences();
    const { screen } = await renderTab(`${PATH}${search}`);

    const clear = panelOf(screen).getByRole("button", {
      name: "Clear filters",
    });
    if (shown) {
      await expect.element(clear).toBeVisible();
    } else {
      expect(clear.query()).toBeNull();
    }
  });

  test("removes the filters, as a new entry of the browser history, and moves the focus to the heading", async () => {
    stubReferences();
    const { router, screen } = await renderTab(
      `${PATH}?type=patch&source=manual`,
    );
    await expect.poll(() => namesOf(screen)).toEqual([PATCH.url]);

    await press(panelOf(screen).getByRole("button", { name: "Clear filters" }));

    await expect.poll(() => router.state.location.href).toBe(PATH);
    expect(router.history.length).toBe(2);
    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    await expect.element(heading(screen, "SNTL-12")).toHaveFocus();
  });

  test("shows that no reference matches the filters inside the frame of the table, below its header row, with Clear filters, which shows them all and moves the focus to the heading", async () => {
    stubReferences();
    const { router, screen } = await renderTab(
      `${PATH}?type=article&source=manual`,
    );
    const message = panelOf(screen).getByText(NO_MATCH, { exact: true });

    await expect.element(message).toBeVisible();
    expect(rowsOf(screen)).toEqual([]);
    await expect
      .element(tableOf(screen).getByRole("columnheader", { name: "Reference" }))
      .toBeVisible();
    expect(message.element().getBoundingClientRect().top).toBeGreaterThan(
      tableOf(screen).element().getBoundingClientRect().bottom,
    );
    const clear = panelOf(screen).getByRole("button", {
      name: "Clear filters",
    });
    // The one of the toolbar, and the one of the empty state.
    expect(clear.elements()).toHaveLength(2);
    expect(clear.elements()[1]!.getBoundingClientRect().top).toBeGreaterThan(
      message.element().getBoundingClientRect().bottom,
    );

    await press(clear.nth(1));

    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    expect(router.state.location.href).toBe(PATH);
    expect(router.history.length).toBe(2);
    await expect.element(heading(screen, "SNTL-12")).toHaveFocus();
  });
});

describe("the announcements of the filters", () => {
  test("say nothing as the tab opens, also with filters", async () => {
    stubReferences();
    const { screen } = await renderTab(`${PATH}?type=patch`);
    await expect.poll(() => namesOf(screen)).toEqual([PATCH.url]);
    expect(announcementsOf(screen)).toEqual([]);

    const dialog = await openFilters(screen);

    await expect
      .element(dialog.getByRole("status").last())
      .toHaveTextContent("");
  });

  test("say that no reference matches the filters after a change that leaves none", async () => {
    stubReferences();
    const { screen } = await renderTab(`${PATH}?source=sync_redhat_cves`);
    const dialog = await openFilters(screen);

    await toggleType(dialog, "Patch");

    await expect
      .element(dialog.getByRole("status").last())
      .toHaveTextContent(NO_MATCH);
  });

  test("say in the tab what the table shows after Clear filters on the line above it", async () => {
    stubReferences();
    const { screen } = await renderTab(`${PATH}?type=patch`);
    await expect.poll(() => namesOf(screen)).toEqual([PATCH.url]);

    await press(panelOf(screen).getByRole("button", { name: "Clear filters" }));

    await expect.poll(() => announcementsOf(screen)).toEqual(["5 references"]);
  });

  test("say in the tab what the table shows after Clear filters of the empty state", async () => {
    stubReferences();
    const { screen } = await renderTab(`${PATH}?type=article&source=manual`);
    const clear = panelOf(screen).getByRole("button", {
      name: "Clear filters",
    });
    await expect.poll(() => clear.elements()).toHaveLength(2);

    await press(clear.nth(1));

    await expect.poll(() => announcementsOf(screen)).toEqual(["5 references"]);
  });

  test("say in the tab what the table shows after the browser history changes the filters, and leave the focus where it was", async () => {
    stubReferences();
    const { router, screen } = await renderTab();
    const add = addButton(screen);
    add.element().focus();

    router.history.push(`${PATH}?type=patch`);
    await expect.poll(() => announcementsOf(screen)).toEqual(["1 reference"]);
    router.history.push(`${PATH}?type=article`);
    await expect.poll(() => announcementsOf(screen)).toEqual([NO_MATCH]);
    router.history.back();
    await expect.poll(() => announcementsOf(screen)).toEqual(["1 reference"]);
    router.history.back();

    await expect.poll(() => announcementsOf(screen)).toEqual(["5 references"]);
    expect(router.state.location.href).toBe(PATH);
    await expect.element(add).toHaveFocus();
  });

  test.each([
    [
      "a Delete that leaves no reference that matches them",
      "?type=uncategorized",
      async (screen: Screen) => {
        await deleteReference(screen, POST);
      },
      "Reference “Fictional mailing list post” deleted.",
    ],
    [
      "an Add of a reference that matches them",
      "?type=issue",
      async (screen: Screen) => {
        const dialog = await openAdd(screen);
        await fieldOf(dialog, "Address").fill(ADDED.url);
        await submit(dialog, "Add reference");
      },
      "Reference “Fictional packaging issue” added.",
    ],
  ])(
    "keep saying in the tab what the table showed after a change of the filters, after %s, which announces its own outcome",
    async (_, search, change, outcome) => {
      let references: TicketReferenceResponse[] = [...EVERY_REFERENCE];
      stubReferences({
        references: () => referencesResponse(references),
        add: () => {
          references = [...references, ADDED];
          return referenceResponse(ADDED, 201);
        },
        remove: () => {
          references = references.filter((item) => item.id !== POST.id);
          return deleted();
        },
      });
      const { router, screen } = await renderTab();
      router.history.push(`${PATH}${search}`);
      await expect.poll(() => announcementsOf(screen)).toEqual(["1 reference"]);

      await change(screen);

      await expect
        .poll(() => announcementsOf(screen))
        .toEqual(["1 reference", outcome]);
      await frames();
      expect(announcementsOf(screen)).toEqual(["1 reference", outcome]);
    },
  );

  test("say each change of the filters in a node of its own, also with the same words", async () => {
    stubReferences();
    const { router, screen } = await renderTab();
    router.history.push(`${PATH}?type=patch`);
    await expect.poll(() => announcementsOf(screen)).toEqual(["1 reference"]);
    const first = panelOf(screen).getByText("1 reference", { exact: true });
    const node = first.element();

    router.history.push(`${PATH}?type=patch&source=manual`);

    await expect.poll(() => first.query()).not.toBe(node);
    expect(announcementsOf(screen)).toEqual(["1 reference"]);
  });

  test("say No references. after a change of the filters of a Ticket without references, in the tab and in the popover", async () => {
    showing();
    const { screen } = await renderTab(`${PATH}?type=patch`);

    await press(panelOf(screen).getByRole("button", { name: "Clear filters" }));

    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["No references."]);
    const dialog = await openFilters(screen);
    await toggleType(dialog, "Issue");
    await expect
      .element(dialog.getByRole("status").last())
      .toHaveTextContent("No references.");
  });
});

describe("the URL", () => {
  test.each([
    ["a parameter that the tab does not accept", "?view=new", PATH],
    ["a type that it does not know", "?type=fictional", PATH],
    ["a type in another letter case", "?type=Patch", PATH],
    ["an empty source", "?source=", PATH],
    ["a repeated source", "?source=manual&source=sync_nvd_cves", PATH],
    [
      "a source of more than 100 characters",
      `?source=${"a".repeat(101)}`,
      PATH,
    ],
    ["a source with U+0000", "?source=man%00ual", PATH],
    [
      "the types once each, in their order, without one that it does not know",
      "?type=uncategorized&type=issue&type=fictional&type=issue",
      `${PATH}?type=issue&type=uncategorized`,
    ],
  ])(
    "leads from %s to the URL that the tab gives, in place of the URL",
    async (_, search, accepted) => {
      stubReferences();
      const { router } = await renderTab(`${PATH}${search}`);

      await expect.poll(() => router.state.location.href).toBe(accepted);
      expect(router.history.length).toBe(1);
    },
  );

  test("leads from a URL that the tab opens with a parameter that it does not accept to the URL that it gives, in place of that URL", async () => {
    stubReferences();
    const { router, screen } = await renderTab();

    router.history.push(`${PATH}?type=patch&view=new`);

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?type=patch`);
    expect(router.history.length).toBe(2);
    await expect.poll(() => namesOf(screen)).toEqual([PATCH.url]);
  });

  test("keeps every parameter that it accepts, in any order, the longest source included", async () => {
    stubReferences();
    const search = `?source=${"a".repeat(100)}&type=advisory&type=patch&type=issue&type=article&type=uncategorized`;
    const { router, screen } = await renderTab(`${PATH}${search}`);

    expect(router.state.location.href).toBe(`${PATH}${search}`);
    expect(router.history.length).toBe(1);
    await expect
      .element(screen.getByRole("button", { name: "Filters 2 applied" }))
      .toBeVisible();
  });

  test("keeps the anchor of a URL that it leads from", async () => {
    stubReferences();
    const { router } = await renderTab(`${PATH}?view=new#fictional`);

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}#fictional`);
  });
});

describe("the read", () => {
  test("shows the loading indicator in place of the references until they arrive", async () => {
    const references = later();
    stubReferences({ references: () => references.promise });
    const { screen } = await renderApp(PATH);

    await expect
      .element(panelOf(screen).getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();
    references.resolve(referencesResponse());

    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    expect(
      panelOf(screen).getByRole("progressbar", { name: "Loading" }).query(),
    ).toBeNull();
  });

  test("shows its failure in place of the references, below the toolbar, in a status region, with Try again", async () => {
    let fail = true;
    stubReferences({
      references: () =>
        fail
          ? errorResponse(503, "DATABASE_UNAVAILABLE")
          : referencesResponse(),
    });
    const { screen } = await renderApp(PATH);

    const message = panelOf(screen).getByText(MESSAGE_UNAVAILABLE);
    await expect.element(message).toBeVisible();
    expect(message.element().closest("output")).not.toBeNull();
    expect(message.element().getBoundingClientRect().top).toBeGreaterThan(
      addButton(screen).element().getBoundingClientRect().bottom,
    );
    await expect.element(addButton(screen)).toBeVisible();
    fail = false;

    await panelOf(screen).getByRole("button", { name: "Try again" }).click();

    await expect.poll(() => namesOf(screen)).toHaveLength(5);
  });

  test.each([
    [
      "a status and a code that the contract does not list for it",
      418,
      "FICTIONAL_CODE",
      MESSAGE_NOT_ACCEPTED,
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
    "shows the presentation of the status of %s",
    async (_, status, code, message, retry) => {
      stubReferences({ references: () => errorResponse(status, code) });
      const { screen } = await renderApp(PATH);

      await expect
        .element(panelOf(screen).getByText(message, { exact: true }))
        .toBeVisible();
      expect(
        panelOf(screen).getByRole("button", { name: "Try again" }).elements(),
      ).toHaveLength(retry ? 1 : 0);
    },
  );

  test("waits for the Ticket before its failure shows, with the loading indicator meanwhile", async () => {
    const ticket = later();
    const { spy } = stubReferences({
      ticket: () => ticket.promise,
      references: () => errorResponse(503, "DATABASE_UNAVAILABLE"),
    });
    const { screen } = await renderApp(PATH);

    // Sent again twice after a 5xx, as every read (docs/behaviors.md,
    // Retries and Unconfirmed Changes).
    await expect.poll(() => referenceReads(spy)).toHaveLength(3);
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
    expect(
      panelOf(screen).getByRole("progressbar", { name: "Loading" }).query(),
    ).toBeNull();
  });

  test("keeps the references after a new read of them fails, with its warning above them and Try again", async () => {
    const { stub } = stubReferences();
    const { screen } = await renderTab();

    stub.references = () => errorResponse(503, "DATABASE_UNAVAILABLE");
    returnToForeground();

    const warning = panelOf(screen).getByText(
      `This couldn't be updated. ${MESSAGE_UNAVAILABLE}`,
    );
    await expect.element(warning).toBeVisible();
    expect(warning.element().getBoundingClientRect().bottom).toBeLessThan(
      tableOf(screen).element().getBoundingClientRect().top,
    );
    expect(namesOf(screen)).toHaveLength(5);

    stub.references = () => referencesResponse([ADVISORY]);
    await panelOf(screen).getByRole("button", { name: "Try again" }).click();

    await expect.poll(() => namesOf(screen)).toEqual([ADVISORY.title]);
    expect(
      panelOf(screen)
        .getByText(/couldn't be updated/)
        .elements(),
    ).toHaveLength(0);
  });

  test("marks the references as being updated while Try again reads them after a new read failed", async () => {
    const { stub } = stubReferences();
    const { screen } = await renderTab();
    stub.references = () => errorResponse(503, "DATABASE_UNAVAILABLE");
    returnToForeground();
    await expect
      .element(panelOf(screen).getByText(/couldn't be updated/))
      .toBeVisible();
    const reread = later();
    stub.references = () => reread.promise;

    await panelOf(screen).getByRole("button", { name: "Try again" }).click();

    await expect
      .element(panelOf(screen).getByRole("progressbar", { name: "Updating" }))
      .toBeVisible();
    reread.resolve(referencesResponse());
    await expect
      .element(panelOf(screen).getByRole("progressbar", { name: "Updating" }))
      .not.toBeInTheDocument();
  });
});

function addDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Add reference" });
}

function editDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Edit reference" });
}

// A text field of a dialog, by its label.
function fieldOf(dialog: Locator, label: string) {
  return dialog.getByRole("textbox", { name: label, exact: true });
}

// The select of the type of a dialog, named by the option that it shows and
// its label.
function typeSelectOf(dialog: Locator) {
  return dialog.getByRole("button", { name: /Type$/ });
}

// Opens the options of the type of a dialog, and returns them.
async function openTypes(dialog: Locator) {
  await typeSelectOf(dialog).click();
  const options = page.getByRole("listbox", { name: "Type" });
  await expect.element(options).toBeVisible();
  return options;
}

async function chooseType(dialog: Locator, type: string) {
  const options = await openTypes(dialog);
  await options.getByRole("option", { name: type, exact: true }).click();
  await expect.element(options).not.toBeInTheDocument();
}

// Opens Add reference and waits until its first field has the focus.
async function openAdd(screen: Screen) {
  await addButton(screen).click();
  const dialog = addDialog(screen);
  await expect.element(fieldOf(dialog, "Address")).toHaveFocus();
  return dialog;
}

// Opens Edit reference of a reference and waits until its first field has
// the focus.
async function openEdit(screen: Screen, reference: TicketReferenceResponse) {
  await editOf(screen, reference).click();
  const dialog = editDialog(screen);
  await expect.element(fieldOf(dialog, "Address")).toHaveFocus();
  return dialog;
}

// Submits the form of a dialog with its button, with the pointer, for values
// that are valid.
async function submit(dialog: Locator, label: "Add reference" | "Save") {
  await dialog.getByRole("button", { name: label, exact: true }).click();
}

// Submits the form of a dialog with its button from the keyboard, for values
// that are not valid: leaving a field shows its error, which moves the button
// away from a pointer before its press ends.
async function submitFromKeyboard(
  dialog: Locator,
  label: "Add reference" | "Save",
) {
  await press(dialog.getByRole("button", { name: label, exact: true }));
}

// Whether every read of the path that the query client holds is to be read
// again, which a screen that shows it does as it opens.
function invalidated(path: string): boolean {
  const queries = client.getQueryCache().findAll({ queryKey: [path] });
  return (
    queries.length > 0 && queries.every((query) => query.state.isInvalidated)
  );
}

// A reference that Add Reference added: a manual issue.
const ADDED = fictionalReference({
  id: "00000000-0000-7000-8000-0000000000fa",
  url: "https://issues.example.com/fictional-openssl/12",
  title: "Fictional packaging issue",
  description: "Tracks the fictional packaging review.",
  type: "issue",
  created_at: "2099-10-12T08:00:00Z",
});

describe("Add reference", () => {
  test("opens a form alone, 488 px wide, with Address, which takes the focus, Title, Type, and Description", async () => {
    stubReferences();
    const { screen } = await renderTab();

    const dialog = await openAdd(screen);

    expect(dialog.element().getBoundingClientRect().width).toBe(488);
    await expect.element(fieldOf(dialog, "Address")).toHaveValue("");
    await expect
      .element(fieldOf(dialog, "Address"))
      .toHaveAttribute("type", "url");
    await expect.element(fieldOf(dialog, "Title (optional)")).toHaveValue("");
    expect(readText(typeSelectOf(dialog).element())).toBe(
      "Detect from the address",
    );
    await expect
      .element(fieldOf(dialog, "Description (optional)"))
      .toHaveValue("");
    expect(
      dialog
        .getByRole("button")
        .elements()
        .map((button) => readText(button))
        .slice(-2),
    ).toEqual(["Cancel", "Add reference"]);
  });

  test("offers Detect from the address first among the types, then the types and Uncategorized", async () => {
    stubReferences();
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);

    const options = await openTypes(dialog);

    expect(optionNames(options)).toEqual([
      "Detect from the address",
      "Advisory",
      "Patch",
      "Issue",
      "Article",
      "Uncategorized",
    ]);
  });

  test("adds a reference with Add Reference, the address without its surrounding whitespace and no type to detect it, then announces it once the references are read again, and returns the focus to Add reference", async () => {
    let references: TicketReferenceResponse[] = [NVD];
    const bodies: unknown[] = [];
    const { spy } = stubReferences({
      references: () => referencesResponse(references),
      add: (body) => {
        bodies.push(body);
        references = [NVD, ADDED];
        return referenceResponse(ADDED, 201);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);

    await fieldOf(dialog, "Address").fill(`  ${ADDED.url}  `);
    await fieldOf(dialog, "Title (optional)").fill(
      " Fictional packaging issue",
    );
    await fieldOf(dialog, "Description (optional)").fill(
      "Tracks the fictional\npackaging review.",
    );
    await submit(dialog, "Add reference");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(bodies).toEqual([
      {
        url: ADDED.url,
        title: " Fictional packaging issue",
        description: "Tracks the fictional\npackaging review.",
      },
    ]);
    expect(requestsWith(spy, "POST")).toHaveLength(1);
    await expect.poll(() => namesOf(screen)).toEqual([NVD.title, ADDED.title]);
    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["Reference “Fictional packaging issue” added."]);
    await expect.element(addButton(screen)).toHaveFocus();
  });

  test.each([
    ["a type", "Patch", "patch"],
    ["Uncategorized", "Uncategorized", null],
  ])("sends %s chosen", async (_, type, sent) => {
    const bodies: unknown[] = [];
    stubReferences({
      add: (body) => {
        bodies.push(body);
        return referenceResponse(ADDED, 201);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await chooseType(dialog, type);
    expect(readText(typeSelectOf(dialog).element())).toBe(type);
    await submit(dialog, "Add reference");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(bodies).toEqual([
      { url: ADDED.url, title: null, description: null, type: sent },
    ]);
  });

  test("sends no title and no description where they are empty or hold whitespace alone", async () => {
    const bodies: unknown[] = [];
    stubReferences({
      add: (body) => {
        bodies.push(body);
        return referenceResponse(ADDED, 201);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await fieldOf(dialog, "Title (optional)").fill("   ");
    await fieldOf(dialog, "Description (optional)").fill(" \n ");

    await submit(dialog, "Add reference");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(bodies).toEqual([
      { url: ADDED.url, title: null, description: null },
    ]);
  });

  test("announces a reference without a title by its address as Sentinel returns it, without quotation marks", async () => {
    const untitled = { ...ADDED, title: null };
    stubReferences({ add: () => referenceResponse(untitled, 201) });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(
      "HTTP://Issues.Example.com/fictional-openssl/12",
    );

    await submit(dialog, "Add reference");

    await expect
      .poll(() => announcementsOf(screen))
      .toEqual([`Reference ${ADDED.url} added.`]);
  });

  test.each([
    ["arrives", () => referencesResponse()],
    ["fails", () => errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION")],
  ])(
    "shows the outcome of a reference that the filters hide in the message area once the next read of the references %s, as a success without the Ticket, and announces nothing in the tab",
    async (_, response) => {
      const reread = later();
      let added = false;
      stubReferences({
        references: () => (added ? reread.promise : referencesResponse()),
        add: () => {
          added = true;
          return referenceResponse(ADDED, 201);
        },
      });
      const { screen } = await renderTab(`${PATH}?type=patch`);
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      const text = "Reference “Fictional packaging issue” added.";
      const message = screen.getByText(text, { exact: true });

      await submit(dialog, "Add reference");

      await expect.element(dialog).not.toBeInTheDocument();
      await frames();
      expect(message.query()).toBeNull();
      reread.resolve(response());

      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
      expect(panelOf(screen).element().contains(message.element())).toBe(false);
      expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
      await frames();
      expect(announcementsOf(screen)).not.toContain(text);
      expect(screen.getByText(/added\.$/).elements()).toHaveLength(1);
    },
  );

  test("announces the outcome of a reference that the filters show in the tab, and shows nothing in the message area", async () => {
    stubReferences({ add: () => referenceResponse(ADDED, 201) });
    const { screen } = await renderTab(`${PATH}?type=issue`);
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await submit(dialog, "Add reference");

    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["Reference “Fictional packaging issue” added."]);
    expect(screen.getByText(/added\.$/).elements()).toHaveLength(1);
  });

  test("reads again the references, the Ticket, its audit log, and the users who acted on it after the change", async () => {
    const { spy } = stubReferences();
    const { screen } = await renderApp("/tickets/SNTL-12/audit-log");
    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(1);
    await screen.getByRole("tab", { name: "References" }).click();
    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      references: referenceReads(spy).length,
    };
    expect(invalidated(EVENTS)).toBe(false);
    expect(invalidated(ACTORS)).toBe(false);
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await submit(dialog, "Add reference");

    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect
      .poll(() => referenceReads(spy).length)
      .toBe(reads.references + 1);
    expect(invalidated(EVENTS)).toBe(true);
    expect(invalidated(ACTORS)).toBe(true);
  });

  test("announces the change once the next read of the references arrives, also one that fails", async () => {
    const reread = later();
    let added = false;
    stubReferences({
      references: () => (added ? reread.promise : referencesResponse()),
      add: () => {
        added = true;
        return referenceResponse(ADDED, 201);
      },
    });
    const { router, screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await submit(dialog, "Add reference");

    await expect.element(dialog).not.toBeInTheDocument();
    // A change of the filters meanwhile changes the rows, not the read.
    router.history.push(`${PATH}?type=advisory`);
    await expect
      .poll(() => namesOf(screen))
      .toEqual([NVD.title, ADVISORY.title]);
    await expect.poll(() => announcementsOf(screen)).toEqual(["2 references"]);
    reread.resolve(errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION"));

    await expect
      .poll(() => announcementsOf(screen))
      .toContain("Reference “Fictional packaging issue” added.");
  });

  test("announces each change again in a node of its own, also with the same words", async () => {
    stubReferences({ add: () => referenceResponse(ADDED, 201) });
    const { screen } = await renderTab();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      const before = panelOf(screen)
        .getByText("Reference “Fictional packaging issue” added.")
        .query();

      await submit(dialog, "Add reference");

      await expect
        .poll(() =>
          panelOf(screen)
            .getByText("Reference “Fictional packaging issue” added.")
            .query(),
        )
        .not.toBe(before);
      await expect.element(addButton(screen)).toHaveFocus();
    }
  });

  test.each([
    ["an empty address", "", "Enter the address."],
    ["an address of whitespace alone", "   ", "Enter the address."],
    [
      "an address without a scheme",
      "advisories.example.com/fictional",
      "Enter a web address that starts with https:// or http://.",
    ],
    [
      "an address of another scheme",
      "ftp://files.example.com/fictional",
      "Enter a web address that starts with https:// or http://.",
    ],
    [
      "an address with a user name",
      "https://jdoe@advisories.example.com/fictional",
      "Enter a web address that starts with https:// or http://.",
    ],
    [
      "an address longer than 2,048 characters",
      `https://advisories.example.com/${"a".repeat(2018)}`,
      "Enter at most 2,048 characters.",
    ],
  ])(
    "states the error of %s at Address, which takes the focus, without a request",
    async (_, address, message) => {
      const { spy } = stubReferences();
      const { screen } = await renderTab();
      const dialog = await openAdd(screen);
      if (address !== "") {
        await fieldOf(dialog, "Address").fill(address);
      }

      await submitFromKeyboard(dialog, "Add reference");

      const field = fieldOf(dialog, "Address");
      await expect.element(field).toHaveAccessibleDescription(message);
      await expect.element(field).toBeInvalid();
      await expect.element(field).toHaveFocus();
      expect(requestsWith(spy, "POST")).toHaveLength(0);
    },
  );

  test.each([
    ["Title (optional)", 500, "Enter at most 500 characters."],
    ["Description (optional)", 2000, "Enter at most 2,000 characters."],
  ])(
    "states the error of a value of %s longer than %i characters at its field, which takes the focus, without a request",
    async (label, max, message) => {
      const { spy } = stubReferences();
      const { screen } = await renderTab();
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      await fieldOf(dialog, label).fill("a".repeat(max + 1));

      await submitFromKeyboard(dialog, "Add reference");

      const field = fieldOf(dialog, label);
      await expect.element(field).toHaveAccessibleDescription(message);
      await expect.element(field).toHaveFocus();
      expect(requestsWith(spy, "POST")).toHaveLength(0);
    },
  );

  test("accepts the longest values, counted by code point as Sentinel counts them", async () => {
    const bodies: unknown[] = [];
    stubReferences({
      add: (body) => {
        bodies.push(body);
        return referenceResponse(ADDED, 201);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    // 2,048 code points, of which the emoji take two code units each.
    const address = `https://advisories.example.com/${"😀".repeat(2017)}`;
    const title = "😀".repeat(500);
    const description = "😀".repeat(2000);
    await fieldOf(dialog, "Address").fill(address);
    await fieldOf(dialog, "Title (optional)").fill(title);
    await fieldOf(dialog, "Description (optional)").fill(description);

    await submit(dialog, "Add reference");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(bodies).toEqual([{ url: address, title, description }]);
  });

  test.each([
    [
      "an address that another reference of the Ticket has",
      () => errorResponse(409, "RESOURCE_CONFLICT"),
      "Address",
      MESSAGE_ADDRESS_TAKEN,
    ],
    [
      "a field error of the address",
      () => validationError([["body", "url"]]),
      "Address",
      MESSAGE_INVALID,
    ],
    [
      "a field error of the title",
      () => validationError([["body", "title"]]),
      "Title (optional)",
      MESSAGE_INVALID,
    ],
    [
      "a field error of the description",
      () => validationError([["body", "description"]]),
      "Description (optional)",
      MESSAGE_INVALID,
    ],
  ])(
    "shows %s at its field, which takes the focus, and keeps the input",
    async (_, response, label, message) => {
      stubReferences({ add: response });
      const { screen } = await renderTab();
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      await fieldOf(dialog, "Title (optional)").fill("Fictional title");
      await fieldOf(dialog, "Description (optional)").fill("Fictional text");

      await submit(dialog, "Add reference");

      const field = fieldOf(dialog, label);
      await expect.element(field).toHaveAccessibleDescription(message);
      await expect.element(field).toBeInvalid();
      await expect.element(field).toHaveFocus();
      await expect.element(fieldOf(dialog, "Address")).toHaveValue(ADDED.url);
      // The error goes once the user changes the value and leaves the field.
      await field.fill("https://advisories.example.com/fictional-other");
      await userEvent.keyboard("{Tab}");
      await expect.element(field).not.toBeInvalid();
    },
  );

  test("shows a field error of the type at the type, which takes the focus", async () => {
    stubReferences({ add: () => validationError([["body", "type"]]) });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await chooseType(dialog, "Patch");

    await submit(dialog, "Add reference");

    await expect
      .element(dialog.getByText(MESSAGE_INVALID, { exact: true }))
      .toBeVisible();
    await expect.element(typeSelectOf(dialog)).toHaveFocus();
    expect(
      dialog.getByText(MESSAGE_INVALID).element().getBoundingClientRect().top,
    ).toBeGreaterThan(
      typeSelectOf(dialog).element().getBoundingClientRect().top,
    );
  });

  test.each([
    [
      "a change that Sentinel did not confirm, as a warning",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      MESSAGE_UNCONFIRMED,
      MESSAGE_TONES.warning,
    ],
    [
      "a network failure, as a warning",
      () => Promise.reject(new TypeError("Failed to fetch")),
      MESSAGE_UNCONFIRMED,
      MESSAGE_TONES.warning,
    ],
    [
      "a conflict with a code that the pinned contract does not list, as an error",
      () => errorResponse(409, "FICTIONAL_CODE"),
      MESSAGE_CONFLICT,
      MESSAGE_TONES.danger,
    ],
    [
      "a VALIDATION_ERROR of no field, as an error",
      () => validationError([["body"]]),
      MESSAGE_NOT_ACCEPTED,
      MESSAGE_TONES.danger,
    ],
    [
      "a status and a code that the pinned contract does not list, as an error",
      () => errorResponse(418, "FICTIONAL_CODE"),
      MESSAGE_NOT_ACCEPTED,
      MESSAGE_TONES.danger,
    ],
  ])(
    "shows %s at the top of the form, which takes the focus and keeps the input",
    async (_, response, message, tone) => {
      const { spy } = stubReferences({ add: response });
      const { screen } = await renderTab();
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      const reads = requestsTo(spy, TICKET);

      await submit(dialog, "Add reference");

      const error = dialog.getByText(message);
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(tone);
      expect(
        error.element().closest("[tabindex]")?.contains(document.activeElement),
      ).toBe(true);
      expect(error.element().getBoundingClientRect().bottom).toBeLessThan(
        fieldOf(dialog, "Address").element().getBoundingClientRect().top,
      );
      await expect.element(fieldOf(dialog, "Address")).toHaveValue(ADDED.url);
      // Whatever its outcome, the screen reads again what it affects.
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    },
  );

  test("shows the error of a field and of the form for a VALIDATION_ERROR with an error of another member, the form taking the focus", async () => {
    stubReferences({
      add: () =>
        validationError([
          ["body", "url"],
          ["body", "fictional_member"],
        ]),
    });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await submit(dialog, "Add reference");

    const error = dialog.getByText(MESSAGE_NOT_ACCEPTED);
    await expect.element(error).toBeVisible();
    await expect
      .element(fieldOf(dialog, "Address"))
      .toHaveAccessibleDescription(MESSAGE_INVALID);
    expect(
      error.element().closest("[tabindex]")?.contains(document.activeElement),
    ).toBe(true);
  });

  test("shows the error of another failure again, which takes the focus again", async () => {
    stubReferences({ add: () => errorResponse(503, "SERVICE_UNAVAILABLE") });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await submit(dialog, "Add reference");
    const error = dialog.getByText(MESSAGE_UNCONFIRMED);
    await expect.element(error).toBeVisible();

    await submit(dialog, "Add reference");

    await expect
      .poll(() =>
        dialog
          .getByText(MESSAGE_UNCONFIRMED)
          .element()
          .closest("[tabindex]")
          ?.contains(document.activeElement),
      )
      .toBe(true);
  });

  test("leaves an answer that the UI cannot show to the page of a failure of the UI", async () => {
    // The answer of a later release that lacks the reference, which the
    // announcement cannot name.
    stubReferences({ add: () => jsonResponse(201, {}) });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await submit(dialog, "Add reference");

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "Something went wrong" }),
      )
      .toBeVisible();
  });

  test("is busy while the change is in progress, sends one request, and cannot be closed", async () => {
    const response = later();
    const { spy } = stubReferences({ add: () => response.promise });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await userEvent.keyboard("{Enter}");
    const button = dialog.getByRole("button", {
      name: "Add reference",
      exact: true,
    });
    await expect.element(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");
    await expect
      .element(dialog.getByRole("button", { name: "Cancel" }))
      .toBeDisabled();
    expect(requestsWith(spy, "POST")).toHaveLength(1);
    await expect.element(dialog).toBeVisible();
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }).query(),
    ).toBeNull();

    response.resolve(referenceResponse(ADDED, 201));

    await expect.element(dialog).not.toBeInTheDocument();
  });

  test.each(["Cancel", "Escape"])(
    "closes on %s without a question while nothing was entered, and returns the focus to Add reference",
    async (way) => {
      stubReferences();
      const { screen } = await renderTab();
      const dialog = await openAdd(screen);

      if (way === "Escape") {
        await userEvent.keyboard("{Escape}");
      } else {
        await dialog.getByRole("button", { name: "Cancel" }).click();
      }

      await expect.element(dialog).not.toBeInTheDocument();
      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();
      await expect.element(addButton(screen)).toHaveFocus();
    },
  );

  test.each([
    [
      "an address",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Address").fill(ADDED.url);
      },
    ],
    [
      "a type",
      async (dialog: Locator) => {
        await chooseType(dialog, "Article");
      },
    ],
    [
      "a description",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Description (optional)").fill(" ");
      },
    ],
  ])(
    "asks before Cancel or Escape discard %s, keeps it on Keep editing, and closes on Discard",
    async (_, enter) => {
      const { spy } = stubReferences();
      const { screen } = await renderTab();
      const dialog = await openAdd(screen);
      await enter(dialog);

      await dialog.getByRole("button", { name: "Cancel" }).click();

      const discard = screen.getByRole("dialog", { name: "Discard changes?" });
      await expect
        .element(discard.getByRole("button", { name: "Keep editing" }))
        .toHaveFocus();
      await expect
        .element(
          discard.getByText("The reference that you entered isn't added."),
        )
        .toBeVisible();
      await discard.getByRole("button", { name: "Keep editing" }).click();
      await expect.element(discard).not.toBeInTheDocument();
      await expect.element(dialog).toBeVisible();

      fieldOf(dialog, "Title (optional)").element().focus();
      await userEvent.keyboard("{Escape}");
      await expect.element(discard).toBeVisible();
      await discard
        .getByRole("button", { name: "Discard", exact: true })
        .click();

      await expect.element(dialog).not.toBeInTheDocument();
      await expect.element(addButton(screen)).toHaveFocus();
      expect(requestsWith(spy, "POST")).toHaveLength(0);
      // The dialog opens again empty.
      const again = await openAdd(screen);
      await expect.element(fieldOf(again, "Address")).toHaveValue("");
      expect(readText(typeSelectOf(again).element())).toBe(
        "Detect from the address",
      );
    },
  );
});

describe("Edit reference", () => {
  test("opens a form alone with the values of the reference, Address taking the focus, and the types without Detect from the address", async () => {
    stubReferences();
    const { screen } = await renderTab();

    const dialog = await openEdit(screen, ADVISORY);

    expect(dialog.element().getBoundingClientRect().width).toBe(488);
    await expect.element(fieldOf(dialog, "Address")).toHaveValue(ADVISORY.url);
    await expect
      .element(fieldOf(dialog, "Title (optional)"))
      .toHaveValue("Fictional advisory");
    expect(readText(typeSelectOf(dialog).element())).toBe("Advisory");
    await expect
      .element(fieldOf(dialog, "Description (optional)"))
      .toHaveValue(ADVISORY.description);
    expect(
      dialog
        .getByRole("button")
        .elements()
        .map((button) => readText(button))
        .slice(-2),
    ).toEqual(["Cancel", "Save"]);
    const options = await openTypes(dialog);
    expect(optionNames(options)).toEqual([
      "Advisory",
      "Patch",
      "Issue",
      "Article",
      "Uncategorized",
    ]);
  });

  test("shows a reference without a title, a type, and a description with empty fields and Uncategorized, its address as the browser parses it", async () => {
    showing(
      fictionalReference({
        url: "https://advisories.example.com/fictional advisory",
        title: null,
        type: null,
        description: null,
      }),
    );
    const { screen } = await renderTab();
    await press(
      panelOf(screen).getByRole("button", { name: /^Edit reference/ }),
    );
    const dialog = editDialog(screen);

    await expect
      .element(fieldOf(dialog, "Address"))
      .toHaveValue("https://advisories.example.com/fictional%20advisory");
    await expect.element(fieldOf(dialog, "Title (optional)")).toHaveValue("");
    expect(readText(typeSelectOf(dialog).element())).toBe("Uncategorized");
    await expect
      .element(fieldOf(dialog, "Description (optional)"))
      .toHaveValue("");
  });

  test.each([
    [
      "the address, without its surrounding whitespace",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Address").fill(
          " https://advisories.example.com/fictional-openssl/2099-0013 ",
        );
      },
      { url: "https://advisories.example.com/fictional-openssl/2099-0013" },
    ],
    [
      "the title",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Title (optional)").fill(
          "Fictional advisory, revised",
        );
      },
      { title: "Fictional advisory, revised" },
    ],
    [
      "the title, removed",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Title (optional)").fill(" ");
      },
      { title: null },
    ],
    [
      "the type",
      async (dialog: Locator) => {
        await chooseType(dialog, "Article");
      },
      { type: "article" },
    ],
    [
      "the type, removed",
      async (dialog: Locator) => {
        await chooseType(dialog, "Uncategorized");
      },
      { type: null },
    ],
    [
      "the description, removed",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Description (optional)").fill("");
      },
      { description: null },
    ],
    [
      "every field",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Address").fill(
          "https://advisories.example.com/fictional-openssl/2099-0013",
        );
        await fieldOf(dialog, "Title (optional)").fill("Fictional title");
        await chooseType(dialog, "Patch");
        await fieldOf(dialog, "Description (optional)").fill("Fictional text");
      },
      {
        url: "https://advisories.example.com/fictional-openssl/2099-0013",
        title: "Fictional title",
        type: "patch",
        description: "Fictional text",
      },
    ],
  ])("changes %s alone with Update Reference", async (_, change, body) => {
    const requests: [string, unknown][] = [];
    stubReferences({
      update: (path, sent) => {
        requests.push([path, sent]);
        return referenceResponse(ADVISORY);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);

    await change(dialog);
    await submit(dialog, "Save");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(requests).toEqual([[`${REFERENCES}/${ADVISORY.id}`, body]]);
  });

  test("announces the change by the reference as Sentinel returns it once the references are read again, returns the focus to Edit, and reads again what it affects", async () => {
    const revised = { ...ADVISORY, title: "Fictional advisory, revised" };
    let references: TicketReferenceResponse[] = [ADVISORY];
    const { spy } = stubReferences({
      references: () => referencesResponse(references),
      update: () => {
        references = [revised];
        return referenceResponse(revised);
      },
    });
    const { screen } = await renderTab();
    const reads = requestsTo(spy, TICKET);
    const dialog = await openEdit(screen, ADVISORY);

    await fieldOf(dialog, "Title (optional)").fill(revised.title);
    await submit(dialog, "Save");

    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["Reference “Fictional advisory, revised” changed."]);
    expect(namesOf(screen)).toEqual([revised.title]);
    await expect.element(editOf(screen, revised)).toHaveFocus();
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
  });

  test.each([
    [
      "that the filters still show, in the tab",
      "?type=advisory",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Title (optional)").fill("Fictional title");
      },
      { ...ADVISORY, title: "Fictional title" },
      true,
    ],
    [
      "that takes the reference out of the filters, in the message area",
      "?type=advisory",
      async (dialog: Locator) => {
        await chooseType(dialog, "Issue");
      },
      { ...ADVISORY, title: "Fictional title", type: "issue" as const },
      false,
    ],
  ])(
    "tells the outcome of a change %s",
    async (_, search, change, returned, announced) => {
      stubReferences({ update: () => referenceResponse(returned) });
      const { screen } = await renderTab(`${PATH}${search}`);
      const dialog = await openEdit(screen, ADVISORY);
      await change(dialog);

      await submit(dialog, "Save");

      const text = "Reference “Fictional title” changed.";
      if (announced) {
        await expect.poll(() => announcementsOf(screen)).toEqual([text]);
      } else {
        const message = screen.getByText(text, { exact: true });
        await expect.element(message).toBeVisible();
        expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
        await frames();
        expect(announcementsOf(screen)).toEqual([]);
      }
      expect(screen.getByText(/changed\.$/).elements()).toHaveLength(1);
    },
  );

  test("offers a type that the pinned contract does not list as received, and keeps it, sending no type", async () => {
    const bodies: unknown[] = [];
    stubReferences({
      references: () =>
        unlistedResponse({ ...ADVISORY, type: "fictional_type" }),
      update: (_, body) => {
        bodies.push(body);
        return referenceResponse(ADVISORY);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    expect(readText(typeSelectOf(dialog).element())).toBe("fictional_type");
    const options = await openTypes(dialog);
    expect(optionNames(options)).toEqual([
      "Advisory",
      "Patch",
      "Issue",
      "Article",
      "Uncategorized",
      "fictional_type",
    ]);
    await userEvent.keyboard("{Escape}");

    await fieldOf(dialog, "Title (optional)").fill("Fictional title");
    await submit(dialog, "Save");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(bodies).toEqual([{ title: "Fictional title" }]);
  });

  test("sends no type when the user chooses again a type that the pinned contract does not list", async () => {
    const bodies: unknown[] = [];
    stubReferences({
      references: () =>
        unlistedResponse({ ...ADVISORY, type: "fictional_type" }),
      update: (_, body) => {
        bodies.push(body);
        return referenceResponse(ADVISORY);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await chooseType(dialog, "Patch");
    await chooseType(dialog, "fictional_type");
    await fieldOf(dialog, "Title (optional)").fill("Fictional title");

    await submit(dialog, "Save");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(bodies).toEqual([{ title: "Fictional title" }]);
  });

  test.each([
    ["nothing", async () => undefined],
    [
      "a change that the user undid",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Title (optional)").fill("Fictional title");
        await fieldOf(dialog, "Title (optional)").fill("Fictional advisory");
      },
    ],
    [
      "whitespace alone around the address",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Address").fill(` ${ADVISORY.url} `);
      },
    ],
  ])(
    "closes without a request after Save with %s changed, and returns the focus to Edit",
    async (_, change) => {
      const { spy } = stubReferences();
      const { screen } = await renderTab();
      const dialog = await openEdit(screen, ADVISORY);

      await change(dialog);
      await submit(dialog, "Save");

      await expect.element(dialog).not.toBeInTheDocument();
      expect(requestsWith(spy, "PATCH")).toHaveLength(0);
      await expect.element(editOf(screen, ADVISORY)).toHaveFocus();
    },
  );

  test("closes without a request after Save with whitespace alone in place of an absent title", async () => {
    const { spy } = showing(PATCH);
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, PATCH);

    await fieldOf(dialog, "Title (optional)").fill("  ");
    await submit(dialog, "Save");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(requestsWith(spy, "PATCH")).toHaveLength(0);
  });

  test.each([
    [
      "an address that another reference of the Ticket has, at Address",
      () => errorResponse(409, "RESOURCE_CONFLICT"),
      MESSAGE_ADDRESS_TAKEN,
      true,
    ],
    [
      "an automatic reference, at the top of the form",
      () => errorResponse(409, "RESOURCE_NOT_EDITABLE"),
      MESSAGE_CONFLICT,
      false,
    ],
    [
      "a reference that no longer exists, at the top of the form",
      () => errorResponse(404, "RESOURCE_NOT_FOUND"),
      MESSAGE_GONE,
      false,
    ],
  ])("shows the failure of %s", async (_, response, message, atField) => {
    stubReferences({ update: response });
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await fieldOf(dialog, "Address").fill(
      "https://advisories.example.com/fictional-openssl/2099-0013",
    );

    await submit(dialog, "Save");

    const error = dialog.getByText(message);
    await expect.element(error).toBeVisible();
    if (atField) {
      await expect
        .element(fieldOf(dialog, "Address"))
        .toHaveAccessibleDescription(message);
      await expect.element(fieldOf(dialog, "Address")).toHaveFocus();
    } else {
      expect(
        error.element().closest("[tabindex]")?.contains(document.activeElement),
      ).toBe(true);
    }
    await expect.element(dialog).toBeVisible();
  });

  test("states the errors of the values before a request", async () => {
    const { spy } = stubReferences();
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await fieldOf(dialog, "Address").fill("");

    await submitFromKeyboard(dialog, "Save");

    await expect
      .element(fieldOf(dialog, "Address"))
      .toHaveAccessibleDescription("Enter the address.");
    expect(requestsWith(spy, "PATCH")).toHaveLength(0);
  });

  test("asks before Cancel discards the changes, and closes on Discard, returning the focus to Edit", async () => {
    const { spy } = stubReferences();
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await fieldOf(dialog, "Title (optional)").fill("Fictional title");

    await dialog.getByRole("button", { name: "Cancel" }).click();

    const discard = screen.getByRole("dialog", { name: "Discard changes?" });
    await expect
      .element(
        discard.getByText("Your changes to this reference aren't saved."),
      )
      .toBeVisible();
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(editOf(screen, ADVISORY)).toHaveFocus();
    expect(requestsWith(spy, "PATCH")).toHaveLength(0);
  });

  test("closes on Cancel without a question while nothing changed", async () => {
    stubReferences();
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);

    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }).query(),
    ).toBeNull();
  });

  test("is busy while the change is in progress, and cannot be closed", async () => {
    const response = later();
    stubReferences({ update: () => response.promise });
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await fieldOf(dialog, "Title (optional)").fill("Fictional title");

    await submit(dialog, "Save");

    await expect
      .element(dialog.getByRole("button", { name: "Save" }))
      .toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).toBeVisible();
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }).query(),
    ).toBeNull();
    response.resolve(referenceResponse(ADVISORY));
    await expect.element(dialog).not.toBeInTheDocument();
  });

  test("keeps the focus on Edit of a reference whose row moves once a change of its type orders the rows", async () => {
    const changed = { ...ADVISORY, type: "issue" as const };
    const reread = later();
    let updated = false;
    stubReferences({
      references: () =>
        updated
          ? reread.promise
          : referencesResponse([NVD, ADVISORY, PATCH, ISSUE, POST]),
      update: () => {
        updated = true;
        return referenceResponse(changed);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await chooseType(dialog, "Issue");
    await submit(dialog, "Save");
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(editOf(screen, ADVISORY)).toHaveFocus();

    reread.resolve(referencesResponse([NVD, PATCH, ISSUE, changed, POST]));

    await expect
      .poll(() => namesOf(screen))
      .toEqual([NVD.title, PATCH.url, ISSUE.title, ADVISORY.title, POST.title]);
    await expectFocusSettledOn(editOf(screen, changed));
    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["Reference “Fictional advisory” changed."]);
  });
});

function confirmationOf(screen: Screen, reference: TicketReferenceResponse) {
  return screen.getByRole("dialog", {
    name: `Delete reference ${nameOf(reference)}?`,
  });
}

// Opens the confirmation of Delete of a reference and confirms it.
async function deleteReference(
  screen: Screen,
  reference: TicketReferenceResponse,
) {
  await deleteOf(screen, reference).click();
  const confirmation = confirmationOf(screen, reference);
  await expect
    .element(confirmation.getByRole("button", { name: "Cancel" }))
    .toHaveFocus();
  await confirmation
    .getByRole("button", { name: "Delete reference", exact: true })
    .click();
  return confirmation;
}

// The element that holds the focus.
function focused(): Element | null {
  return document.activeElement;
}

// Waits until the browser has rendered more frames than the tab waits at
// most for a row to leave the table before it moves the focus, after which
// the focus has settled.
async function frames() {
  for (let frame = 0; frame < 15; frame += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
}

// Deletes a reference among others, and waits until the read after it has
// taken the reference away from the table and its outcome is announced.
async function deleteAmong(
  before: TicketReferenceResponse[],
  reference: TicketReferenceResponse,
  path = PATH,
) {
  let references = before;
  stubReferences({
    references: () => referencesResponse(references),
    remove: () => {
      references = before.filter((item) => item.id !== reference.id);
      return deleted();
    },
  });
  const { screen } = await renderTab(path);

  await deleteReference(screen, reference);

  await expect.poll(() => rowOf(screen, reference).query()).toBeNull();
  await expect
    .poll(() => announcementsOf(screen))
    .toEqual([`Reference ${nameOf(reference)} deleted.`]);
  return { screen };
}

// Gives a control of a row the focus as a press of the pointer does, so that
// React Aria's table records the cell that holds it: a focus while the user
// works with the keyboard, which treats the table as one stop of the tab
// order, moves on to the row that the table last focused, or to its first
// row.
async function focusInRow(screen: Screen, control: Locator) {
  await heading(screen, "SNTL-12").click();
  control.element().focus();
  await expect.element(control).toHaveFocus();
}

// Waits until the element has the focus, and checks that it keeps it once the
// table has settled, as React Aria's table moves the focus itself.
async function expectFocusSettledOn(locator: Locator) {
  await expect.element(locator).toHaveFocus();
  await frames();
  expect(focused()).toBe(locator.element());
}

describe("Delete", () => {
  test("asks for confirmation, naming the reference, with the consequence, Cancel, which takes the focus, and Delete reference as a danger button", async () => {
    stubReferences();
    const { screen } = await renderTab();

    await deleteOf(screen, ADVISORY).click();

    const confirmation = confirmationOf(screen, ADVISORY);
    await expect
      .element(confirmation.getByRole("button", { name: "Cancel" }))
      .toHaveFocus();
    await expect
      .element(
        confirmation.getByText(
          "The reference is removed from this Ticket. This can't be undone.",
        ),
      )
      .toBeVisible();
    const action = confirmation.getByRole("button", {
      name: "Delete reference",
      exact: true,
    });
    expect(getComputedStyle(action.element()).backgroundColor).toBe(
      "rgb(207, 34, 46)",
    );
    expect(confirmation.element().getBoundingClientRect().width).toBe(400);
  });

  test("names a reference without a title by its address in the question", async () => {
    stubReferences();
    const { screen } = await renderTab();

    await deleteOf(screen, PATCH).click();

    await expect
      .element(
        screen.getByRole("dialog", {
          name: `Delete reference ${PATCH.url}?`,
        }),
      )
      .toBeVisible();
  });

  test("deletes the reference with Delete Reference, then announces it once the references are read again, and reads again what it affects", async () => {
    let references: TicketReferenceResponse[] = [...EVERY_REFERENCE];
    const removed: string[] = [];
    const { spy } = stubReferences({
      references: () => referencesResponse(references),
      remove: (path) => {
        removed.push(path);
        references = [NVD, PATCH, ISSUE, POST];
        return deleted();
      },
    });
    const { screen } = await renderTab();
    const reads = requestsTo(spy, TICKET);

    const confirmation = await deleteReference(screen, ADVISORY);

    await expect.element(confirmation).not.toBeInTheDocument();
    await expect
      .poll(() => namesOf(screen))
      .toEqual([NVD.title, PATCH.url, ISSUE.title, POST.title]);
    expect(removed).toEqual([`${REFERENCES}/${ADVISORY.id}`]);
    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["Reference “Fictional advisory” deleted."]);
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
  });

  test("moves the focus to Add reference after Delete of the last reference, which leaves No references.", async () => {
    let references: TicketReferenceResponse[] = [ADVISORY];
    stubReferences({
      references: () => referencesResponse(references),
      remove: () => {
        references = [];
        return deleted();
      },
    });
    const { screen } = await renderTab();

    await deleteReference(screen, ADVISORY);

    await expect
      .element(panelOf(screen).getByText("No references.", { exact: true }))
      .toBeVisible();
    await expect.element(addButton(screen)).toHaveFocus();
    await frames();
    expect(focused()).toBe(addButton(screen).element());
  });

  test("keeps the reference after Cancel, without a request", async () => {
    const { spy } = stubReferences();
    const { screen } = await renderTab();

    await deleteOf(screen, ADVISORY).click();
    await confirmationOf(screen, ADVISORY)
      .getByRole("button", { name: "Cancel" })
      .click();

    await expect
      .element(confirmationOf(screen, ADVISORY))
      .not.toBeInTheDocument();
    expect(requestsWith(spy, "DELETE")).toHaveLength(0);
    expect(namesOf(screen)).toHaveLength(5);
  });

  describe("the focus after Delete", () => {
    test("moves to the Delete of the row that takes its place", async () => {
      const { screen } = await deleteAmong([...EVERY_REFERENCE], ADVISORY);

      await expectFocusSettledOn(deleteOf(screen, PATCH));
    });

    test("moves to the row that takes the place of the reference when it has no Delete", async () => {
      const { screen } = await deleteAmong([ADVISORY, ISSUE], ADVISORY);

      await expectFocusSettledOn(rowOf(screen, ISSUE));
    });

    test("moves to Add reference after Delete of the last row", async () => {
      const { screen } = await deleteAmong([NVD, POST], POST);

      await expectFocusSettledOn(addButton(screen));
    });

    test("moves to the Delete of the row that takes its place among the rows that match the filters", async () => {
      const { screen } = await deleteAmong(
        [...EVERY_REFERENCE],
        ADVISORY,
        `${PATH}?source=manual`,
      );

      await expectFocusSettledOn(deleteOf(screen, PATCH));
    });

    test("moves no more once the read after Delete fails, and moves to the screen's heading when a later read removes the row of the focus", async () => {
      let phase: "before" | "failing" | "gone" = "before";
      stubReferences({
        references: () => {
          if (phase === "failing") {
            return errorResponse(503, "DATABASE_UNAVAILABLE");
          }
          return referencesResponse(
            phase === "gone" ? [NVD, PATCH, ISSUE, POST] : EVERY_REFERENCE,
          );
        },
        remove: () => {
          phase = "failing";
          return deleted();
        },
      });
      const { screen } = await renderTab();

      await deleteReference(screen, ADVISORY);

      await expect
        .element(panelOf(screen).getByText(/^This couldn't be updated\./))
        .toBeVisible();
      await expect
        .poll(() =>
          rowOf(screen, ADVISORY).element().contains(document.activeElement),
        )
        .toBe(true);
      await frames();
      expect(
        rowOf(screen, ADVISORY).element().contains(document.activeElement),
      ).toBe(true);
      // Meanwhile another analyst deleted it, or Sentinel had.
      phase = "gone";

      returnToForeground();

      await expect.poll(() => rowOf(screen, ADVISORY).query()).toBeNull();
      await expectFocusSettledOn(heading(screen, "SNTL-12"));
    });

    test("stays where the user moved it out of the table before the reference left it", async () => {
      const reread = later();
      let removed = false;
      stubReferences({
        references: () => (removed ? reread.promise : referencesResponse()),
        remove: () => {
          removed = true;
          return deleted();
        },
      });
      const { screen } = await renderTab();
      const confirmation = await deleteReference(screen, ADVISORY);
      await expect.element(confirmation).not.toBeInTheDocument();
      const filters = screen.getByRole("button", { name: "Filters" });
      filters.element().focus();

      reread.resolve(referencesResponse([NVD, PATCH, ISSUE, POST]));

      await expect.poll(() => rowOf(screen, ADVISORY).query()).toBeNull();
      await frames();
      expect(focused()).toBe(filters.element());
    });
  });

  test("keeps the confirmation open while Delete is in progress", async () => {
    const response = later();
    stubReferences({ remove: () => response.promise });
    const { screen } = await renderTab();

    const confirmation = await deleteReference(screen, ADVISORY);

    await expect
      .element(
        confirmation.getByRole("button", {
          name: "Delete reference",
          exact: true,
        }),
      )
      .toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");
    await expect.element(confirmation).toBeVisible();
    response.resolve(deleted());
    await expect.element(confirmation).not.toBeInTheDocument();
  });

  test.each([
    [
      "an automatic reference, as an error",
      () => errorResponse(409, "RESOURCE_NOT_EDITABLE"),
      MESSAGE_CONFLICT,
      MESSAGE_TONES.danger,
    ],
    [
      "a reference that no longer exists, as an error",
      () => errorResponse(404, "RESOURCE_NOT_FOUND"),
      MESSAGE_GONE,
      MESSAGE_TONES.danger,
    ],
    [
      "a change that Sentinel did not confirm, as a warning",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      MESSAGE_UNCONFIRMED,
      MESSAGE_TONES.warning,
    ],
    [
      "a status and a code that the pinned contract does not list, as an error",
      () => errorResponse(418, "FICTIONAL_CODE"),
      MESSAGE_NOT_ACCEPTED,
      MESSAGE_TONES.danger,
    ],
  ])(
    "shows the failure of %s at the top of the confirmation, which stays open and takes the focus, and reads again what it affects",
    async (_, response, message, tone) => {
      const { spy } = stubReferences({ remove: response });
      const { screen } = await renderTab();
      const reads = requestsTo(spy, TICKET);

      const confirmation = await deleteReference(screen, ADVISORY);

      const error = confirmation.getByText(message);
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(tone);
      expect(error.element().closest("[tabindex]")?.contains(focused())).toBe(
        true,
      );
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
      await expect.element(confirmation).toBeVisible();
    },
  );

  test("announces Delete once a read of the references after it arrives, also one that fails", async () => {
    const reread = later();
    let removed = false;
    stubReferences({
      references: () => (removed ? reread.promise : referencesResponse()),
      remove: () => {
        removed = true;
        return deleted();
      },
    });
    const { screen } = await renderTab();

    const confirmation = await deleteReference(screen, ADVISORY);

    await expect.element(confirmation).not.toBeInTheDocument();
    expect(announcementsOf(screen)).toEqual([]);
    reread.resolve(errorResponse(503, "DATABASE_UNAVAILABLE"));

    await expect
      .poll(() => announcementsOf(screen))
      .toContain("Reference “Fictional advisory” deleted.");
  });
});

describe("the focus after a read", () => {
  test.each([
    [
      "Edit of a row, which a press of the pointer gave the focus",
      async (screen: Screen) => {
        await focusInRow(screen, editOf(screen, ADVISORY));
        return ADVISORY;
      },
    ],
    [
      "a row, which the keyboard reached",
      async (screen: Screen) => {
        // The last control of the line above the table without a filter.
        screen.getByRole("button", { name: "Filters" }).element().focus();
        await userEvent.keyboard("{Tab}");
        await expect.element(rowOf(screen, NVD)).toHaveFocus();
        return NVD;
      },
    ],
  ])(
    "moves to the screen's heading when a read removes the row of the focus, on %s",
    async (_, focus) => {
      const { stub } = stubReferences();
      const { screen } = await renderTab();
      const reference = await focus(screen);
      // Meanwhile another analyst deleted it.
      stub.references = () =>
        referencesResponse(
          EVERY_REFERENCE.filter((item) => item.id !== reference.id),
        );

      returnToForeground();

      await expect.poll(() => namesOf(screen)).toHaveLength(4);
      await expectFocusSettledOn(heading(screen, "SNTL-12"));
    },
  );

  test("moves to the screen's heading after an Edit that the filters no longer match", async () => {
    const changed = { ...ADVISORY, type: "issue" as const };
    let references: TicketReferenceResponse[] = [...EVERY_REFERENCE];
    stubReferences({
      references: () => referencesResponse(references),
      update: () => {
        references = [NVD, PATCH, ISSUE, changed, POST];
        return referenceResponse(changed);
      },
    });
    const { screen } = await renderTab(`${PATH}?type=advisory`);
    const dialog = await openEdit(screen, ADVISORY);
    await chooseType(dialog, "Issue");

    await submit(dialog, "Save");

    await expect.poll(() => namesOf(screen)).toEqual([NVD.title]);
    await expectFocusSettledOn(heading(screen, "SNTL-12"));
  });

  test("moves to the screen's heading after an Edit that the filters no longer match, also when the read after it arrives as the focus returns to the row", async () => {
    const changed = { ...ADVISORY, type: "issue" as const };
    const reread = later();
    let updated = false;
    stubReferences({
      references: () =>
        updated ? reread.promise : referencesResponse(EVERY_REFERENCE),
      update: () => {
        updated = true;
        return referenceResponse(changed);
      },
    });
    const { screen } = await renderTab(`${PATH}?type=advisory`);
    const dialog = await openEdit(screen, ADVISORY);
    await chooseType(dialog, "Issue");
    const edit = editOf(screen, ADVISORY).element();
    // The read arrives as soon as the focus is back on Edit, before the
    // dialog that closed checks where the focus went.
    const onFocusIn = (event: FocusEvent) => {
      if (event.target === edit) {
        reread.resolve(referencesResponse([NVD, PATCH, ISSUE, changed, POST]));
      }
    };
    document.addEventListener("focusin", onFocusIn);

    try {
      await submit(dialog, "Save");

      await expect.poll(() => namesOf(screen)).toEqual([NVD.title]);
      await expectFocusSettledOn(heading(screen, "SNTL-12"));
    } finally {
      document.removeEventListener("focusin", onFocusIn);
    }
  });

  test("moves to the screen's heading when a read leaves no reference where a row held it", async () => {
    const { stub } = stubReferences();
    const { screen } = await renderTab();
    await focusInRow(screen, editOf(screen, ADVISORY));
    stub.references = () => referencesResponse([]);

    returnToForeground();

    await expect
      .element(panelOf(screen).getByText("No references.", { exact: true }))
      .toBeVisible();
    await expect.element(heading(screen, "SNTL-12")).toHaveFocus();
  });

  test("moves no more once the focus left the rows", async () => {
    const { stub } = stubReferences();
    const { screen } = await renderTab();
    await focusInRow(screen, editOf(screen, ADVISORY));
    addButton(screen).element().focus();
    addButton(screen).element().blur();
    stub.references = () => referencesResponse([NVD, PATCH, ISSUE, POST]);

    returnToForeground();

    await expect.poll(() => namesOf(screen)).toHaveLength(4);
    await frames();
    expect(focused()).toBe(document.body);
  });

  test("moves no more once the pointer pressed outside the rows, where no element takes the focus", async () => {
    const { stub } = stubReferences();
    const { screen } = await renderTab();
    await focusInRow(screen, editOf(screen, ADVISORY));

    // On the empty space of the sidebar, below its links.
    await screen
      .getByRole("navigation", { name: "Main" })
      .click({ position: { x: 100, y: 400 } });
    expect(focused()).toBe(document.body);
    stub.references = () => referencesResponse([NVD, PATCH, ISSUE, POST]);
    returnToForeground();

    await expect.poll(() => namesOf(screen)).toHaveLength(4);
    await frames();
    expect(focused()).toBe(document.body);
  });
});

// Leaves for Ticket list, while the change is in progress.
async function leave(
  router: Awaited<ReturnType<typeof renderTab>>["router"],
  screen: Screen,
) {
  await router.navigate({ to: "/tickets" });
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
    .toBeVisible();
}

describe("a change that ends after the user left the tab", () => {
  test("shows its success in the message area, naming the Ticket with a link to it", async () => {
    const response = later();
    stubReferences({ add: () => response.promise });
    const { router, screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await submit(dialog, "Add reference");
    await leave(router, screen);

    response.resolve(referenceResponse(ADDED, 201));

    const message = screen.getByText(
      "SNTL-12: Reference “Fictional packaging issue” added.",
    );
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
    const link = screen.getByRole("link", { name: "SNTL-12", exact: true });
    await expect.element(link).toHaveAttribute("href", "/tickets/SNTL-12");

    await link.click();

    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
  });

  test("shows one message, naming the Ticket, for a reference that the filters of the tab hid", async () => {
    const response = later();
    stubReferences({ add: () => response.promise });
    const { router, screen } = await renderTab(`${PATH}?type=patch`);
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await submit(dialog, "Add reference");
    await leave(router, screen);

    response.resolve(referenceResponse(ADDED, 201));

    await expect
      .element(
        screen.getByText(
          "SNTL-12: Reference “Fictional packaging issue” added.",
        ),
      )
      .toBeVisible();
    await frames();
    expect(screen.getByText(/added\.$/).elements()).toHaveLength(1);
  });

  test("shows a change of a reference in the message area", async () => {
    const response = later();
    stubReferences({ update: () => response.promise });
    const { router, screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await fieldOf(dialog, "Title (optional)").fill("Fictional title");
    await submit(dialog, "Save");
    await leave(router, screen);

    response.resolve(
      referenceResponse({ ...ADVISORY, title: "Fictional title" }),
    );

    await expect
      .element(
        screen.getByText("SNTL-12: Reference “Fictional title” changed."),
      )
      .toBeVisible();
  });

  test("shows Delete in the message area", async () => {
    const response = later();
    stubReferences({ remove: () => response.promise });
    const { router, screen } = await renderTab();
    await deleteReference(screen, PATCH);
    await leave(router, screen);

    response.resolve(deleted());

    await expect
      .element(screen.getByText(`SNTL-12: Reference ${PATCH.url} deleted.`))
      .toBeVisible();
  });

  test.each([
    [
      "that Sentinel did not confirm, as a warning",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      MESSAGE_UNCONFIRMED,
      MESSAGE_TONES.warning,
    ],
    [
      "that Sentinel refused, as an error",
      () => errorResponse(409, "RESOURCE_CONFLICT"),
      MESSAGE_CONFLICT,
      MESSAGE_TONES.danger,
    ],
  ])(
    "shows its failure %s in the message area, naming the Ticket",
    async (_, failure, message, tone) => {
      const response = later();
      stubReferences({ add: () => response.promise });
      const { router, screen } = await renderTab();
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      await submit(dialog, "Add reference");
      await leave(router, screen);

      response.resolve(failure());

      const shown = screen.getByText(`SNTL-12: ${message}`);
      await expect.element(shown).toBeVisible();
      expect(backgroundBehind(shown.element())).toBe(tone);
      await expect
        .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
        .toHaveAttribute("href", "/tickets/SNTL-12");
    },
  );

  test("shows nothing in the message area for a change that ends on the tab", async () => {
    stubReferences({ add: () => referenceResponse(ADDED, 201) });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await submit(dialog, "Add reference");

    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["Reference “Fictional packaging issue” added."]);
    expect(screen.getByText(/added\.$/).elements()).toHaveLength(1);
  });
});
