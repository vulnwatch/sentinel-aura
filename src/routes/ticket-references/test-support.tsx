import { focusManager, type QueryClient } from "@tanstack/react-query";
import {
  createHashHistory,
  createMemoryHistory,
  type RouterHistory,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { App } from "../../app";
import type {
  CurrentUserResponse,
  TicketReferenceDataResponse,
  TicketReferenceListResponse,
  TicketReferenceResponse,
} from "../../api/generated/model";
import { MESSAGE_TIMEOUT_MS } from "../../components/message-area";
import { createQueryClient } from "../../query-client";
import { createAppRouter } from "../../router";
import { announcements } from "../../test-announcements";
import {
  actorsResponse,
  errorResponse,
  eventPage,
  fictionalEvent,
  fictionalTicketDetail,
  jsonResponse,
  OTHER_USER,
  stubApi,
  ticketPage,
  ticketResponse,
  urlOf,
} from "../../test-api";
import { pointerAwayFrom } from "../../test-pointer";

// What the test files of the tab References (src/routes/ticket-references.tsx)
// and of its dialogs (src/routes/ticket-references/) share: the paths and the
// messages, the signed-in user, the references of the tests and the responses
// of the API, the rendering of the tab, the elements of the table and of the
// dialogs, the waits for its reads and its frames, and the clock of the
// countdown of its messages.

export const ME = "/api/v1/users/me";
const TICKETS = "/api/v1/tickets";
export const TICKET = "/api/v1/tickets/SNTL-12";
export const REFERENCES = "/api/v1/tickets/SNTL-12/references";
export const EVENTS = "/api/v1/tickets/SNTL-12/audit-log";
export const ACTORS = "/api/v1/tickets/SNTL-12/actors";
// The path of the tab.
export const PATH = "/tickets/SNTL-12/references";

export const MESSAGE_UNCONFIRMED =
  "Sentinel didn't confirm this change. It may have taken effect: check before trying again.";
export const MESSAGE_CONFLICT =
  "This can't be done in the current state, which may have changed. Check it and try again.";
export const MESSAGE_GONE =
  "This no longer exists, or you no longer have access to it.";
export const MESSAGE_NOT_ACCEPTED = "Sentinel didn't accept this request.";

// The backgrounds of the messages of each tone in the light theme
// (docs/design-system.md, Tones).
export const MESSAGE_TONES = {
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
export function fictionalReference(
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
export const NVD = fictionalReference({
  id: "00000000-0000-7000-8000-0000000000f1",
  url: "https://nvd.example.com/vuln/detail/CVE-2099-0012",
  title: "NVD",
  description: null,
  source: "sync_nvd_cves",
  created_at: "2099-10-09T14:05:09Z",
});
export const ADVISORY = fictionalReference();
export const PATCH = fictionalReference({
  id: "00000000-0000-7000-8000-0000000000f3",
  url: "https://git.example.org/fictional-openssl/commit/0a1b2c3d",
  title: null,
  description: null,
  type: "patch",
  created_at: "2099-10-10T10:00:00Z",
});
export const ISSUE = fictionalReference({
  id: "00000000-0000-7000-8000-0000000000f4",
  url: "https://bugzilla.example.com/show_bug.cgi?id=1201",
  title: "Fictional bug report",
  description: null,
  type: "issue",
  source: "sync_redhat_cves",
  created_at: "2099-10-09T14:06:00Z",
});
export const POST = fictionalReference({
  id: "00000000-0000-7000-8000-0000000000f5",
  url: "https://lists.example.org/fictional/2099/11/1",
  title: "Fictional mailing list post",
  description: null,
  type: null,
  created_at: "2099-10-11T08:00:00Z",
});
export const EVERY_REFERENCE = [NVD, ADVISORY, PATCH, ISSUE, POST] as const;

// List References's response.
export function referencesResponse(
  references: readonly TicketReferenceResponse[] = EVERY_REFERENCE,
): Response {
  const body: TicketReferenceListResponse = { data: references };
  return jsonResponse(200, body);
}

// List References's response with references whose fields hold values that
// the pinned contract does not list, which a later Sentinel release can
// return.
export function unlistedResponse(...references: object[]): Response {
  return jsonResponse(200, { data: references });
}

// The response of Add Reference, 201, or of Update Reference, 200.
export function referenceResponse(
  reference: TicketReferenceResponse,
  status: 200 | 201 = 200,
): Response {
  const body: TicketReferenceDataResponse = { data: reference };
  return jsonResponse(status, body);
}

// Delete Reference's response.
export function deleted(): Response {
  return new Response(null, { status: 204 });
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
    hashHistory?.destroy();
    hashHistory = undefined;
    window.location.hash = "";
    client.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
    focusManager.setFocused(undefined);
    document.title = "Sentinel";
    window.scrollTo(0, 0);
    await page.viewport(414, 896);
  });
}

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
export function stubReferences(fields: Partial<Stub> = {}) {
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
export function showing(...references: TicketReferenceResponse[]) {
  return stubReferences({ references: () => referencesResponse(references) });
}

// The history of a test that follows Back as the browser's history does,
// without changing the address of the document of the tests.
let hashHistory: RouterHistory | undefined;

export async function renderApp(
  path: string,
  history: "memory" | "hash" = "memory",
) {
  if (history === "hash") {
    window.location.hash = `#${path}`;
    hashHistory = createHashHistory();
  }
  const router = createAppRouter({
    history: hashHistory ?? createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  return { router, screen };
}

export type Screen = Awaited<ReturnType<typeof renderApp>>["screen"];

// Renders the tab and waits until it shows the Ticket and its references,
// or that it has none.
export async function renderTab(
  path = PATH,
  history: "memory" | "hash" = "memory",
) {
  const rendered = await renderApp(path, history);
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

export function heading(screen: Screen, name: string) {
  return screen.getByRole("heading", { level: 1, name, exact: true });
}

export function panelOf(screen: Screen) {
  return screen.getByRole("tabpanel", { name: "References" });
}

// The main content, where the message area and the tab show what they say:
// the announcer of the page, outside it, holds the words of each message and
// of each failure too (src/components/announcer.tsx).
export function mainContent(screen: Screen) {
  return screen.getByRole("main");
}

export function tableOf(screen: Screen) {
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
export function readText(element: Element): string {
  return textOf(element).replace(/\s+/g, " ").trim();
}

// The rows of the table, other than its header row, in their order.
export function rowsOf(screen: Screen): Element[] {
  return tableOf(screen).getByRole("row").elements().slice(1);
}

// The name of each row of the table, by the text of the link of its
// reference: its title, or its address without one.
export function namesOf(screen: Screen): string[] {
  return rowsOf(screen).map((row) =>
    readText(
      page.elementLocator(row).getByRole("link").first().element(),
    ).replace(/ \(another site\)$/, ""),
  );
}

// The name of a reference in the actions on it and in their outcome: its
// title in quotation marks, or its address.
export function nameOf(reference: TicketReferenceResponse): string {
  return reference.title === null ? reference.url : `“${reference.title}”`;
}

// The row of a reference.
export function rowOf(
  screen: Screen,
  reference: TicketReferenceResponse,
): Locator {
  return tableOf(screen)
    .getByRole("row")
    .filter({
      has: page.getByRole("link", {
        name: `${reference.title ?? reference.url} (another site)`,
        exact: true,
      }),
    });
}

export function editOf(screen: Screen, reference: TicketReferenceResponse) {
  return panelOf(screen).getByRole("button", {
    name: `Edit reference ${nameOf(reference)}`,
    exact: true,
  });
}

export function deleteOf(screen: Screen, reference: TicketReferenceResponse) {
  return panelOf(screen).getByRole("button", {
    name: `Delete reference ${nameOf(reference)}`,
    exact: true,
  });
}

export function addButton(screen: Screen) {
  return panelOf(screen).getByRole("button", {
    name: "Add reference",
    exact: true,
  });
}

// What the announcer of the page holds (src/test-announcements.ts).
export function announcementsOf(): string[] {
  return announcements();
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

// Waits until the error at the top of a dialog holds the focus, which it
// takes once it has shown, in a render after the response.
export async function expectFocusOnError(error: Locator) {
  await expect
    .poll(() =>
      error.element().closest("[tabindex]")?.contains(document.activeElement),
    )
    .toBe(true);
}

// Presses a button from the keyboard, which keeps the focus on it.
export async function press(button: Locator) {
  button.element().focus();
  await userEvent.keyboard("{Enter}");
}

// The color behind an element: the background of the nearest element, itself
// or one that contains it, that has one.
export function backgroundBehind(element: Element): string {
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
export function requestsWith(spy: ReturnType<typeof stubApi>, method: string) {
  return spy.mock.calls.filter(([, init]) => init?.method === method);
}

// The queries of the reads of the references, in their order, each as its
// text.
export function referenceReads(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .filter(
      ([input, init]) =>
        urlOf(input).pathname === REFERENCES &&
        (init?.method ?? "GET") === "GET",
    )
    .map(([input]) => urlOf(input).search);
}

// The names of the options of a listbox, in their order.
export function optionNames(listbox: Locator): string[] {
  return listbox
    .getByRole("option")
    .elements()
    .map((option) => readText(option));
}

function addDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Add reference" });
}

export function editDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Edit reference" });
}

// A text field of a dialog, by its label.
export function fieldOf(dialog: Locator, label: string) {
  return dialog.getByRole("textbox", { name: label, exact: true });
}

// The select of the type of a dialog, named by the option that it shows and
// its label.
export function typeSelectOf(dialog: Locator) {
  return dialog.getByRole("button", { name: /Type$/ });
}

// Opens the options of the type of a dialog, and returns them.
export async function openTypes(dialog: Locator) {
  await typeSelectOf(dialog).click();
  const options = page.getByRole("listbox", { name: "Type" });
  await expect.element(options).toBeVisible();
  return options;
}

export async function chooseType(dialog: Locator, type: string) {
  const options = await openTypes(dialog);
  await options.getByRole("option", { name: type, exact: true }).click();
  await expect.element(options).not.toBeInTheDocument();
}

// Opens Add reference and waits until its first field has the focus.
export async function openAdd(screen: Screen) {
  await addButton(screen).click();
  const dialog = addDialog(screen);
  await expect.element(fieldOf(dialog, "Address")).toHaveFocus();
  return dialog;
}

// Opens Edit reference of a reference and waits until its first field has
// the focus.
export async function openEdit(
  screen: Screen,
  reference: TicketReferenceResponse,
) {
  await editOf(screen, reference).click();
  const dialog = editDialog(screen);
  await expect.element(fieldOf(dialog, "Address")).toHaveFocus();
  return dialog;
}

// Submits the form of a dialog with its button, with the pointer, for values
// that are valid.
export async function submit(dialog: Locator, label: "Add reference" | "Save") {
  await dialog.getByRole("button", { name: label, exact: true }).click();
}

// A reference that Add Reference added: a manual issue.
export const ADDED = fictionalReference({
  id: "00000000-0000-7000-8000-0000000000fa",
  url: "https://issues.example.com/fictional-openssl/12",
  title: "Fictional packaging issue",
  description: "Tracks the fictional packaging review.",
  type: "issue",
  created_at: "2099-10-12T08:00:00Z",
});

export function confirmationOf(
  screen: Screen,
  reference: TicketReferenceResponse,
) {
  return screen.getByRole("dialog", {
    name: `Delete reference ${nameOf(reference)}?`,
  });
}

// Opens the confirmation of Delete of a reference and confirms it.
export async function deleteReference(
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
export function focused(): Element | null {
  return document.activeElement;
}

// Waits until the browser has rendered more frames than the tab waits at
// most for a row to leave the table before it moves the focus, after which
// the focus has settled.
export async function frames() {
  for (let frame = 0; frame < 15; frame += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
}

// Waits until the element has the focus, and checks that it keeps it once the
// table has settled, as React Aria's table moves the focus itself.
export async function expectFocusSettledOn(locator: Locator) {
  await expect.element(locator).toHaveFocus();
  await frames();
  expect(focused()).toBe(locator.element());
}

// A message of the message area, by its words, such as "SNTL-12: Reference
// “Fictional packaging issue” added." (src/components/message-area.tsx).
export function areaMessage(screen: Screen, words: string): Locator {
  return screen
    .getByRole("region", { name: "Messages", exact: true })
    .getByRole("group", { name: words, exact: true });
}

// The countdown of a message that goes on its own runs on a fake clock of
// the timers of the page, which the test sets before what shows the message
// and moves itself (expectGoesOnItsOwn; expectStays), once the pointer rests
// away from the main content, which holds the message area, over which the
// countdown would wait. The date stays real, so that the outcome of a change
// still waits for the first read after it, which TanStack Query dates.
// TanStack Query tells the tab of a read in a later task, on that clock too:
// a check that retries moves a fake clock by its interval before each retry,
// so the checks on it retry without one (ON_FAKE_CLOCK), which runs the tasks
// that are due without moving the clock.
export async function fakeMessageClock(screen: Screen) {
  await pointerAwayFrom(mainContent(screen));
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
}

export const ON_FAKE_CLOCK = { interval: 0 };

// Waits until the browser has rendered two more frames, after which the
// effects of the commits before have run, and what they set has rendered.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

// The state of the line of the time left of a message, which runs while its
// countdown runs and is paused while it waits, or undefined without one
// (src/components/message.tsx).
function countdownOf(message: Element): AnimationPlayState | undefined {
  return message
    .getAnimations({ subtree: true })
    .find(
      (animation) =>
        animation instanceof CSSAnimation &&
        animation.animationName === "countdown",
    )?.playState;
}

// Checks, on the fake clock (fakeMessageClock), that a message that shows
// goes on its own once the time of its countdown has passed, its line of the
// time left running until then.
export async function expectGoesOnItsOwn(message: Locator) {
  await expect
    .poll(() => countdownOf(message.element()), ON_FAKE_CLOCK)
    .toBe("running");
  // The frames in which React runs the effects of that render, which start
  // the countdown itself.
  await nextFrames();

  vi.advanceTimersByTime(MESSAGE_TIMEOUT_MS);

  await expect.element(message, ON_FAKE_CLOCK).not.toBeInTheDocument();
}

// Checks, on the fake clock (fakeMessageClock), that a message that shows
// stays once the time after which a message that goes on its own goes has
// passed, without a line of the time left.
export async function expectStays(message: Locator) {
  await nextFrames();
  expect(countdownOf(message.element())).toBeUndefined();

  vi.advanceTimersByTime(MESSAGE_TIMEOUT_MS);

  await nextFrames();
  expect(message.query()).not.toBeNull();
}

export type Router = Awaited<ReturnType<typeof renderTab>>["router"];

// Leaves for Ticket list, while the change is in progress.
export async function leave(router: Router, screen: Screen) {
  await router.navigate({ to: "/tickets" });
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
    .toBeVisible();
}
