import { getLocalTimeZone, today } from "@internationalized/date";
import { focusManager } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import "../styles.css";
import { formatDate } from "../components/date-time";
import {
  actorsResponse,
  errorResponse,
  eventPage,
  FICTIONAL_ACTORS,
  fictionalCve,
  fictionalTicketDetail,
  requestsTo,
  stubApi,
  ticketResponse,
  urlOf,
} from "../test-api";
import {
  ACTORS,
  ALICE,
  at,
  client,
  eventReads,
  EVENTS,
  eventsOf,
  FIRST_PAGE,
  firstEventResponse,
  heading,
  isFirstEventRead,
  KINDS,
  ME,
  openFilters,
  panelOf,
  PATH,
  prepareEachTest,
  readText,
  renderApp,
  renderEvents,
  renderLog,
  sentencesOf,
  showing,
  stubLog,
  toggleKind,
  typesOf,
  type Screen,
} from "./ticket-audit-log/test-support";

// The tab Audit log of the Ticket screen (docs/screens/ticket.md, Audit
// log), at the browser's default text size, in the light theme. Its dates
// and times are local times of the browser, sent in UTC as the API sends
// them, so that the tests hold in every time zone.

prepareEachTest();

const TICKET = "/api/v1/tickets/SNTL-12";

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

const ANA = actorNamed("agarcia");

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

// A page of a number of events, of a log of total events.
function pageOfEvents(count: number, total: number, number = 1): Response {
  return eventPage(eventsOf(...Array.from({ length: count }, () => ({}))), {
    total,
    page: number,
  });
}

// The first event of the Ticket, on the first day of the period, which a
// test of the period ends before today, whatever the day of its run.
const FIRST_DAY = "2025-01-15";

// Today, the last day of the period.
const TODAY = today(getLocalTimeZone()).toString();

// The paths of the requests to the API, other than the read of the
// signed-in user, in their order.
function pathsOf(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input).pathname)
    .filter((path) => path !== ME);
}

// The number of reads of the first event.
function firstEventReads(spy: ReturnType<typeof stubApi>): number {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter(
      (url) => url.pathname === EVENTS && isFirstEventRead(url.searchParams),
    ).length;
}

function searchFieldOf(screen: Screen) {
  return screen.getByRole("searchbox", { name: "Search events" });
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

// Waits until no read is in progress, for a read whose end the tab shows
// nowhere, such as that of the first event, which From shows only once
// Filters opens, and keeps when a later read of it fails.
async function readsEnded() {
  await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
}

// Waits until no read of the path is in progress and the tab has its
// outcome, for a read whose outcome the tab does not show yet, such as a
// failure that waits for the Ticket: TanStack Query tells the tab of the end
// of a read in a later task, which runs before this one ends.
async function readEnded(path: string) {
  await expect
    .poll(() => client.isFetching({ queryKey: [path] }), { interval: 0 })
    .toBe(0);
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// The tab returns to the foreground after being hidden, once no read is in
// progress: a return during a read joins it rather than reading again
// (TanStack Query's Query.onFocus), so the reads that a test expects after
// the return do not depend on when the reads before it end.
async function returnToForeground() {
  await readsEnded();
  focusManager.setFocused(false);
  focusManager.setFocused(true);
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

// A part of a date field of the period: 0 the day, 1 the month, 2 the year.
function partOf(dialog: Locator, field: string, index: number): Locator {
  return dialog
    .getByRole("group", { name: field })
    .getByRole("spinbutton")
    .nth(index);
}

// Gives the focus to a part of a date field of the period, as from the
// keyboard, which opens no calendar.
function focusPart(dialog: Locator, field: string, index: number) {
  const part = partOf(dialog, field, index).element();
  if (part instanceof HTMLElement) {
    part.focus();
  }
}

// Types a date, such as 01112025, into a date field of the period, from its
// day.
async function typeDate(dialog: Locator, field: string, digits: string) {
  focusPart(dialog, field, 0);
  await userEvent.keyboard(digits);
}

// Empties a date field of the period, from its year.
async function emptyField(dialog: Locator, field: string) {
  focusPart(dialog, field, 2);
  // Backspace removes a digit, and in an empty part moves to the part before
  // it.
  await userEvent.keyboard("{Backspace}".repeat(10));
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

  test("reads the Ticket, its events, its first event, and its actors as it opens, and none of the reads of Overview", async () => {
    const { spy } = stubLog();

    await renderEvents();

    await expect
      .poll(() => new Set(pathsOf(spy)))
      .toEqual(new Set([TICKET, EVENTS, ACTORS]));
    await expect.poll(() => firstEventReads(spy)).toBe(1);
    // The events, and the first event, of List Ticket Events.
    expect(pathsOf(spy)).toHaveLength(4);
    expect(eventReads(spy)).toEqual([FIRST_PAGE]);
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
    await returnToForeground();

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
    await returnToForeground();

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
      // Closes the options, which give the focus back to the select, then
      // the filters.
      await userEvent.keyboard("{Escape}");
      await expect.element(options).not.toBeInTheDocument();
      await expect.element(actorSelectOf(dialog)).toHaveFocus();
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
            avatar_url: null,
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

describe("the period", () => {
  test("applies both dates with Enter, as the first and the last instant of their local days in UTC, as a new entry of the browser history", async () => {
    const { spy } = stubLog();
    const { router, screen } = await renderEvents(`${PATH}?page=2`);
    const dialog = await openFilters(screen);

    await typeDate(dialog, "From", "01112025");
    await typeDate(dialog, "To", "08112025");
    await userEvent.keyboard("{Enter}");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?from=2025-11-01&to=2025-11-08`);
    expect(router.history.length).toBe(2);
    await expect
      .poll(() => eventReads(spy).at(-1))
      .toBe(
        `from_date=${startOf("2025-11-01")}&to_date=${endOf("2025-11-08")}&${FIRST_PAGE}`,
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
      `${PATH}?from=2025-11-01&to=2025-11-08`,
    );
    const dialog = await openFilters(screen);
    await emptyField(dialog, "To");

    await userEvent.keyboard("{Enter}");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?from=2025-11-01`);
    await expect
      .poll(() => eventReads(spy).at(-1))
      .toBe(`from_date=${startOf("2025-11-01")}&${FIRST_PAGE}`);
  });

  test("reads the first event of the Ticket once with its events, and shows its local day in From without a bound, which From sends as no bound", async () => {
    const { spy } = stubLog();
    const { router, screen } = await renderEvents();
    expect(firstEventReads(spy)).toBe(1);
    const dialog = await openFilters(screen);
    const from = dialog.getByRole("group", { name: "From" });
    await expect.poll(() => from.element().textContent).toBe("15/01/2025");
    expect(
      dialog.getByRole("group", { name: "To" }).element().textContent,
    ).toBe("dd/mm/yyyy");

    await typeDate(dialog, "To", "08112025");
    await userEvent.keyboard("{Enter}");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?to=2025-11-08`);
    await expect
      .poll(() => eventReads(spy).at(-1))
      .toBe(`to_date=${endOf("2025-11-08")}&${FIRST_PAGE}`);
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toBeVisible();
    // Typed, a From on the first day is no bound either.
    await typeDate(dialog, "From", "15012025");
    await userEvent.keyboard("{Enter}");
    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?to=2025-11-08`);
    expect(firstEventReads(spy)).toBe(1);
  });

  test("removes a From of the URL on the first day when the fields apply the period", async () => {
    stubLog();
    const { router, screen } = await renderEvents(`${PATH}?from=${FIRST_DAY}`);
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toBeVisible();
    // The first day comes from the read of the first event, which shows
    // nothing of its own.
    await readsEnded();
    const dialog = await openFilters(screen);

    await typeDate(dialog, "To", "08112025");
    await userEvent.keyboard("{Enter}");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?to=2025-11-08`);
  });

  test.each([
    // The last minute of 14 Jan 2025 of the browser, whatever its offset.
    ["the last minute of a local day", at(2025, 1, 14, 23, 59)],
    // An instant of another day in UTC than in the browser's time zone
    // two hours east of it, which the browser reads in its own.
    ["an instant with an offset", "2025-01-15T01:30:00+02:00"],
  ])(
    "shows the first day in the time zone of the browser, as the timeline groups its event: %s",
    async (_, created) => {
      stubLog({ first: () => firstEventResponse(created) });
      const { screen } = await renderEvents();
      const dialog = await openFilters(screen);
      const local = new Date(created);
      const expected = [
        String(local.getDate()).padStart(2, "0"),
        String(local.getMonth() + 1).padStart(2, "0"),
        String(local.getFullYear()),
      ].join("/");

      await expect
        .poll(
          () =>
            dialog.getByRole("group", { name: "From" }).element().textContent,
        )
        .toBe(expected);
    },
  );

  test("takes the days up to the first day when the clock of the browser shows a day before it", async () => {
    stubLog({ first: () => firstEventResponse(at(2099, 1, 15, 9, 30)) });
    const { router, screen } = await renderEvents();
    const dialog = await openFilters(screen);
    await expect
      .poll(
        () => dialog.getByRole("group", { name: "From" }).element().textContent,
      )
      .toBe("15/01/2099");

    await typeDate(dialog, "To", "15012099");
    await userEvent.keyboard("{Enter}");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?to=2099-01-15`);
  });

  test.each([
    ["fails", () => errorResponse(503, "SERVICE_UNAVAILABLE"), 3],
    ["returns no event", () => eventPage([]), 1],
  ])(
    "leaves From empty and takes the days from 1 Jan 1970 to today, and shows nothing, when the read of the first event %s",
    async (_, first, reads) => {
      const { spy } = stubLog({ first });
      const { screen } = await renderEvents();
      // A failed read is sent again twice (docs/behaviors.md, Retries and
      // Unconfirmed Changes).
      await expect.poll(() => firstEventReads(spy)).toBe(reads);
      await readsEnded();
      const dialog = await openFilters(screen);

      expect(
        dialog.getByRole("group", { name: "From" }).element().textContent,
      ).toBe("dd/mm/yyyy");
      await typeDate(dialog, "From", "31121969");
      await userEvent.keyboard("{Enter}");
      await expect
        .element(
          dialog.getByText(
            `Enter a date from 1 Jan 1970 to ${formatDate(TODAY)}.`,
            { exact: true },
          ),
        )
        .toBeVisible();
      expect(panelOf(screen).getByRole("alert").elements()).toHaveLength(0);
      expect(panelOf(screen).element().textContent).not.toMatch(
        /couldn't|isn't available/,
      );
    },
  );

  test("reads the first event again when the tab returns to the foreground after its read failed, and then shows its day in From", async () => {
    const { stub, spy } = stubLog({
      first: () => errorResponse(503, "SERVICE_UNAVAILABLE"),
    });
    const { screen } = await renderEvents();
    await expect.poll(() => firstEventReads(spy)).toBe(3);
    stub.first = () => firstEventResponse();

    await returnToForeground();

    await expect.poll(() => firstEventReads(spy)).toBe(4);
    const dialog = await openFilters(screen);
    await expect
      .poll(
        () => dialog.getByRole("group", { name: "From" }).element().textContent,
      )
      .toBe("15/01/2025");
  });

  test("keeps the first day when a later read of the first event fails", async () => {
    const { stub, spy } = stubLog();
    const { screen } = await renderEvents();
    const reads = firstEventReads(spy);
    stub.first = () => errorResponse(503, "SERVICE_UNAVAILABLE");

    // The tab returns to the foreground, which reads the data again; the
    // read fails, also when sent again twice.
    await returnToForeground();

    await expect.poll(() => firstEventReads(spy)).toBe(reads + 3);
    await readsEnded();
    const dialog = await openFilters(screen);
    expect(
      dialog.getByRole("group", { name: "From" }).element().textContent,
    ).toBe("15/01/2025");
  });

  test("applies the period with a day chosen in a calendar, which Escape closes alone, Filters staying open", async () => {
    const { spy } = stubLog();
    const { router, screen } = await renderEvents();
    const dialog = await openFilters(screen);

    await partOf(dialog, "To", 0).click();
    const calendar = page.getByRole("dialog", { name: /Calendar To/ });
    await expect.element(calendar).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(calendar).not.toBeInTheDocument();
    await expect.element(dialog).toBeVisible();
    await expect.element(partOf(dialog, "To", 0)).toHaveFocus();

    await partOf(dialog, "To", 0).click();
    await expect.element(calendar).toBeVisible();
    // The days from the first day to today: today has the focus.
    await expect
      .element(calendar.getByRole("button", { name: /^Today, / }))
      .toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?to=${TODAY}`);
    await expect.element(calendar).not.toBeInTheDocument();
    await expect.element(dialog).toBeVisible();
    await expect
      .poll(() => eventReads(spy).at(-1))
      .toBe(`to_date=${endOf(TODAY)}&${FIRST_PAGE}`);
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
      "14012025",
      "",
      `Enter a date from 15 Jan 2025 to ${formatDate(TODAY)}.`,
    ],
    [
      "a date after the last",
      "To",
      "",
      "31122099",
      `Enter a date from 15 Jan 2025 to ${formatDate(TODAY)}.`,
    ],
    [
      "a start after the end",
      "To",
      "08112025",
      "01112025",
      "This date is before the start.",
    ],
  ])(
    "applies nothing for %s, and says so at its field until the focus leaves both fields",
    async (_, field, start, end, message) => {
      const { spy } = stubLog();
      const { router, screen } = await renderEvents();
      const dialog = await openFilters(screen);
      await expect
        .poll(
          () =>
            dialog.getByRole("group", { name: "From" }).element().textContent,
        )
        .toBe("15/01/2025");
      if (start !== "") {
        await emptyField(dialog, "From");
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
        partOf(dialog, name, 0).element().getAttribute("aria-invalid");
      expect(errorOf(field)).toBe("true");
      expect(errorOf(other)).not.toBe("true");
      expect(router.state.location.href).toBe(PATH);
      expect(router.history.length).toBe(1);
      expect(eventReads(spy)).toEqual([FIRST_PAGE]);

      // To the select of the actor, the first field of the filters.
      actorSelectOf(dialog).element().focus();

      await expect.element(error).not.toBeInTheDocument();
      expect(announced.element().textContent).toBe("");
      expect(
        dialog.getByRole("group", { name: "From" }).element().textContent,
      ).toBe("15/01/2025");
      expect(
        dialog.getByRole("group", { name: "To" }).element().textContent,
      ).toBe("dd/mm/yyyy");
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
    await expect.poll(() => from.element().textContent).toBe("15/01/2025");
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
    await readEnded(EVENTS);
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
    await returnToForeground();

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
