import {
  CirclePause,
  CirclePlay,
  Gauge,
  ListRestart,
  Merge,
  Plus,
  Split,
  UserPen,
  type LucideIcon,
} from "lucide-react";
import { describe, expect, test, vi } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../../styles.css";
import type {
  CurrentUserResponse,
  TicketDetail,
  UserReference,
} from "../../api/generated/model";
import {
  errorResponse,
  FICTIONAL_USER,
  fictionalPackage,
  fictionalTicketDetail,
  jsonResponse,
  OTHER_USER,
  referenceOf,
  requestsTo,
  stubApi,
  ticketResponse,
  urlOf,
} from "../../test-api";
import { pointerAwayFrom } from "../../test-pointer";
import {
  ACTORS,
  animationsIn,
  announcements,
  backgroundBehind,
  BORDER,
  client,
  convergenceResponse,
  EVENTS,
  expectFocusSettledOn,
  expectSuccessMessage,
  frames,
  interactOutside,
  later,
  leaveForTickets,
  leftInvalidated,
  MAINTAINER,
  MESSAGE_CONFLICT,
  MESSAGE_GONE,
  MESSAGE_NOT_ACCEPTED,
  MESSAGE_TONES,
  MESSAGE_UNCONFIRMED,
  nextFrames,
  prepareEachTest,
  readEnded,
  readsOf,
  REFERENCE,
  renderTicket,
  returnToForeground,
  type Screen,
  screenHeading,
  type Stub,
  stubTicket,
  TICKET,
  TICKETS,
  YOUR_WORK,
} from "../ticket-overview/test-support";

// Actions, the menu of the actions of a Ticket at the end of the heading row
// of the Ticket screen (src/routes/ticket/actions.tsx; docs/screens/ticket.md,
// Actions), shown over Overview, at the browser's default text size, in the
// light theme. The dialogs of Ignore… and of Mark as duplicate… have their own
// tests (src/routes/ticket/ignore.test.tsx;
// src/routes/ticket/mark-duplicate.test.tsx).

prepareEachTest();

// Alice Smith, an analyst who holds triage_ticket (OTHER_USER), and the
// same user as the assignee of a Ticket.
const ANALYST = OTHER_USER;
const YOU = referenceOf(OTHER_USER);

// The same user after a read of the signed-in user took their capabilities
// away.
const WITHOUT_CAPABILITIES: CurrentUserResponse = {
  data: { ...OTHER_USER.data, roles: [], capabilities: [] },
};

// A user who holds manage_fetchers alone of the capabilities of Actions.
const FETCHER_MANAGER: CurrentUserResponse = {
  data: { ...FICTIONAL_USER.data, capabilities: ["manage_fetchers"] },
};

// A user who holds both capabilities of Actions.
const BOTH: CurrentUserResponse = {
  data: {
    ...OTHER_USER.data,
    capabilities: ["triage_ticket", "manage_fetchers"],
  },
};

// Bob Wilson, another analyst, as the assignee of a Ticket.
const BOB: UserReference = {
  id: "00000000-0000-0000-0000-000000000009",
  username: "bwilson",
  full_name: "Bob Wilson",
  active: true,
  bot: false,
  avatar_url: null,
};

const MESSAGE_FORBIDDEN = "You don't have permission to do this.";

// The colors of a secondary button in the light theme (docs/design-system.md,
// Buttons and Links): its surface fill and its border-strong boundary.
const SURFACE = "rgb(255, 255, 255)";
const BORDER_STRONG = "rgb(129, 139, 152)";

// SNTL-12 in the status, which can be one that the pinned contract does not
// list, as Get Ticket returns it: an Ignored Ticket with its reason, and a
// Duplicated one with its original, SNTL-21, with the fields that a test
// sets.
function ticketIn(
  status: string,
  fields: Partial<TicketDetail> = {},
): Response {
  const extra: Partial<TicketDetail> = {};
  if (status === "ignored") {
    extra.ignore_reason = "not_shipped";
  }
  if (status === "duplicated") {
    extra.duplicate_of_ticket_id = "SNTL-21";
  }
  return jsonResponse(200, {
    data: { ...fictionalTicketDetail({ ...extra, ...fields }), status },
  });
}

// SNTL-12 Ignored, unassigned, with a reason that the pinned contract does
// not list, as a later Sentinel release can return it.
function ignoredForUnlistedReason(): Response {
  return jsonResponse(200, {
    data: {
      ...fictionalTicketDetail({ status: "ignored", assignee: null }),
      ignore_reason: "fictional_reason",
    },
  });
}

// Answers for the analyst unless the test says otherwise, with SNTL-12 in
// the status.
function showingStatus(status: string, stub: Partial<Stub> = {}) {
  return stubTicket({
    user: ANALYST,
    ticket: () => ticketIn(status),
    ...stub,
  });
}

function actionsButton(screen: Screen) {
  return screen.getByRole("button", {
    name: "Actions of SNTL-12",
    exact: true,
  });
}

function actionsMenu(screen: Screen) {
  return screen.getByRole("menu", { name: "Actions of SNTL-12", exact: true });
}

function itemOf(menu: Locator, name: string) {
  return menu.getByRole("menuitem", { name, exact: true });
}

// Opens Actions and waits until its menu shows.
async function openActions(screen: Screen) {
  await actionsButton(screen).click();
  const menu = actionsMenu(screen);
  await expect.element(menu).toBeVisible();
  return menu;
}

// Opens Actions and chooses the item.
async function choose(screen: Screen, name: string) {
  const menu = await openActions(screen);
  await itemOf(menu, name).click();
  return menu;
}

// The names of the items of the menu, in their order.
function itemsOf(menu: Locator): (string | null)[] {
  return menu
    .getByRole("menuitem")
    .elements()
    .map((item) => item.textContent);
}

// The changes of Actions that the spy received: the last segment of the path
// of each, such as reopen, with its body.
function changesOf(spy: ReturnType<typeof stubApi>): [string, unknown][] {
  return spy.mock.calls
    .filter(
      ([input, init]) =>
        init?.method === "POST" &&
        urlOf(input).pathname.startsWith(`${TICKET}/`),
    )
    .map(([input, init]) => [
      urlOf(input).pathname.slice(`${TICKET}/`.length),
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    ]);
}

// The elements outside the status regions that hold the text, such as the
// message area.
function shownOutsideStatus(screen: Screen, text: string): Element[] {
  return screen
    .getByText(text, { exact: true })
    .elements()
    .filter((element) => element.closest("output") === null);
}

// Whether the other element follows the one in the order of the page.
function follows(one: Element, other: Element): boolean {
  return (
    (one.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) !==
    0
  );
}

// The pencil of the assignee, which only a user who holds triage_ticket has,
// also while a menu or a dialog keeps it from assistive technologies.
function editAssignee(screen: Screen) {
  return screen.getByRole("button", {
    name: "Edit assignee",
    exact: true,
    includeHidden: true,
  });
}

const ICONS: Record<string, LucideIcon> = {
  "Ignore…": CirclePause,
  "Ignore as not shipped by SUSE": CirclePause,
  "Mark as duplicate…": Merge,
  Reopen: CirclePlay,
  "Revert duplicate": Split,
  "Override priority…": UserPen,
  "Set severity…": Gauge,
  "Associate CVE…": Plus,
  "Rerun convergence": ListRestart,
};

// The actions of a user who holds triage_ticket on a Ticket with a CVE in New
// and in Analysis, the ignores first, then the override of the priority.
const IN_NEW = [
  "Ignore…",
  "Ignore as not shipped by SUSE",
  "Mark as duplicate…",
  "Override priority…",
];
const IN_ANALYSIS = [...IN_NEW, "Rerun convergence"];
// The actions on an Analyzed or Resolved Ticket with a CVE.
const IN_ANALYZED = [
  "Mark as duplicate…",
  "Override priority…",
  "Rerun convergence",
];

// The outcome of the quick action as Sentinel returns the Ticket after it,
// assigned to the signed-in user.
const IGNORED = "Ignored as Not shipped, assigned to you.";

// The actions of a user who holds triage_ticket on a Ticket in each status
// that the pinned contract lists.
const OFFERED: [string, string[]][] = [
  ["new", IN_NEW],
  ["analysis", IN_ANALYSIS],
  ["analyzed", IN_ANALYZED],
  ["resolved", IN_ANALYZED],
  ["ignored", ["Reopen"]],
  ["duplicated", ["Revert duplicate"]],
];

describe("Actions", () => {
  test("is a secondary button that shows Actions, named by the Ticket, which opens the actions as a menu of the same name", async () => {
    showingStatus("analyzed");
    const { screen } = await renderTicket();

    const button = actionsButton(screen);
    await expect.element(button).toBeVisible();
    expect(button.element().textContent).toBe("Actions");
    await expect.element(button).toHaveAttribute("aria-haspopup", "true");
    // A secondary button: a surface fill within a border-strong line, at
    // rest.
    await pointerAwayFrom(button);
    const style = getComputedStyle(button.element());
    expect([
      style.backgroundColor,
      style.borderTopWidth,
      style.borderTopColor,
    ]).toEqual([SURFACE, "1px", BORDER_STRONG]);

    await button.click();

    await expect.element(actionsMenu(screen)).toBeVisible();
  });

  test.each(OFFERED)(
    "offers a user who holds triage_ticket, on a Ticket in %s, %j, each with its icon",
    async (status, items) => {
      showingStatus(status);
      const { screen } = await renderTicket();

      const menu = await openActions(screen);

      await expect.poll(() => itemsOf(menu)).toEqual(items);
      for (const name of items) {
        const Icon = ICONS[name]!;
        const icon = await render(<Icon />);
        expect(
          itemOf(menu, name).element().querySelector("svg")?.innerHTML,
        ).toBe(icon.container.querySelector("svg")?.innerHTML);
      }
    },
  );

  test.each(["analysis", "analyzed", "resolved"])(
    "sets Override priority… apart from Mark as duplicate…, and Rerun convergence apart from Override priority…, by border lines on a Ticket in %s",
    async (status) => {
      showingStatus(status);
      const { screen } = await renderTicket();

      const menu = await openActions(screen);

      const separators = menu.getByRole("separator").elements();
      expect(separators).toHaveLength(2);
      const first = separators[0]!;
      const second = separators[1]!;
      expect(
        follows(itemOf(menu, "Mark as duplicate…").element(), first),
      ).toBeTruthy();
      expect(
        follows(first, itemOf(menu, "Override priority…").element()),
      ).toBeTruthy();
      expect(
        follows(itemOf(menu, "Override priority…").element(), second),
      ).toBeTruthy();
      expect(
        follows(second, itemOf(menu, "Rerun convergence").element()),
      ).toBeTruthy();
      for (const separator of separators) {
        const line = getComputedStyle(separator);
        expect([line.borderTopWidth, line.borderTopColor]).toEqual([
          "1px",
          BORDER,
        ]);
      }
    },
  );

  test("sets Override priority… apart from Mark as duplicate… by one border line on a Ticket in New, without Rerun convergence", async () => {
    showingStatus("new");
    const { screen } = await renderTicket();

    const menu = await openActions(screen);

    await expect.poll(() => itemsOf(menu)).toEqual(IN_NEW);
    const separators = menu.getByRole("separator").elements();
    expect(separators).toHaveLength(1);
    expect(
      follows(itemOf(menu, "Mark as duplicate…").element(), separators[0]!),
    ).toBeTruthy();
    expect(
      follows(separators[0]!, itemOf(menu, "Override priority…").element()),
    ).toBeTruthy();
  });

  test.each(
    OFFERED.filter(([status]) => ["ignored", "duplicated"].includes(status)),
  )(
    "has no line on a Ticket in %s, without Rerun convergence and the corrections: %j",
    async (status, items) => {
      showingStatus(status);
      const { screen } = await renderTicket();

      const menu = await openActions(screen);

      await expect.poll(() => itemsOf(menu)).toEqual(items);
      expect(menu.getByRole("separator").elements()).toHaveLength(0);
    },
  );

  test.each<[string, string[]]>([
    [
      "new",
      [
        "Ignore…",
        "Ignore as not shipped by SUSE",
        "Mark as duplicate…",
        "Override priority…",
        "Set severity…",
        "Associate CVE…",
      ],
    ],
    [
      "analysis",
      [
        "Ignore…",
        "Ignore as not shipped by SUSE",
        "Mark as duplicate…",
        "Override priority…",
        "Set severity…",
        "Associate CVE…",
        "Rerun convergence",
      ],
    ],
    [
      "analyzed",
      [
        "Mark as duplicate…",
        "Override priority…",
        "Set severity…",
        "Associate CVE…",
        "Rerun convergence",
      ],
    ],
    [
      "resolved",
      [
        "Mark as duplicate…",
        "Override priority…",
        "Set severity…",
        "Associate CVE…",
        "Rerun convergence",
      ],
    ],
    ["ignored", ["Reopen"]],
    ["duplicated", ["Revert duplicate"]],
  ])(
    "offers a user who holds triage_ticket, on a Ticket without a CVE in %s, Set severity… and Associate CVE… after Override priority…: %j, each with its icon",
    async (status, items) => {
      showingStatus(status, { ticket: () => ticketIn(status, { cve: null }) });
      const { screen } = await renderTicket();

      const menu = await openActions(screen);

      await expect.poll(() => itemsOf(menu)).toEqual(items);
      for (const name of items) {
        const Icon = ICONS[name]!;
        const icon = await render(<Icon />);
        expect(
          itemOf(menu, name).element().querySelector("svg")?.innerHTML,
        ).toBe(icon.container.querySelector("svg")?.innerHTML);
      }
    },
  );

  test.each(["analysis", "analyzed", "resolved"])(
    "offers a user who holds manage_fetchers alone Rerun convergence alone, without a line, on a Ticket in %s",
    async (status) => {
      showingStatus(status, { user: FETCHER_MANAGER });
      const { screen } = await renderTicket();

      const menu = await openActions(screen);

      await expect.poll(() => itemsOf(menu)).toEqual(["Rerun convergence"]);
      expect(menu.getByRole("separator").elements()).toHaveLength(0);
    },
  );

  test.each(OFFERED)(
    "offers a user who holds both capabilities, on a Ticket in %s, the actions of triage_ticket: %j",
    async (status, items) => {
      showingStatus(status, { user: BOTH });
      const { screen } = await renderTicket();

      const menu = await openActions(screen);

      await expect.poll(() => itemsOf(menu)).toEqual(items);
    },
  );

  test.each(["new", "ignored", "duplicated"])(
    "does not show to a user who holds manage_fetchers alone on a Ticket in %s",
    async (status) => {
      showingStatus(status, { user: FETCHER_MANAGER });
      const { screen } = await renderTicket();

      // The heading row shows the Ticket, as it would show Actions.
      await expect
        .element(screen.getByRole("term").filter({ hasText: "Status" }))
        .toBeInTheDocument();
      expect(actionsButton(screen).query()).toBeNull();
      expect(screen.getByText("Actions", { exact: true }).query()).toBeNull();
    },
  );

  test.each(OFFERED.map(([status]) => status))(
    "does not show to a user who holds neither triage_ticket nor manage_fetchers on a Ticket in %s",
    async (status) => {
      showingStatus(status, { user: FICTIONAL_USER });
      const { screen } = await renderTicket();

      await expect
        .element(screen.getByRole("term").filter({ hasText: "Status" }))
        .toBeInTheDocument();
      expect(actionsButton(screen).query()).toBeNull();
    },
  );

  test.each([
    ["triage_ticket", ANALYST],
    ["both capabilities", BOTH],
  ])(
    "does not show to a user who holds %s on a Ticket in a status that the pinned contract does not list",
    async (_, user) => {
      showingStatus("fictional_status", { user });
      const { screen } = await renderTicket();

      // The heading row shows the status as received, as it would show
      // Actions.
      await expect
        .element(screen.getByText("fictional_status", { exact: true }))
        .toBeVisible();
      expect(actionsButton(screen).query()).toBeNull();
    },
  );

  test("keeps the items that it offered as its menu opened while a read changes the status of the Ticket, and offers those of the new status once it opens again", async () => {
    let status = "analyzed";
    showingStatus("analyzed", { ticket: () => ticketIn(status) });
    const { screen } = await renderTicket();
    const menu = await openActions(screen);
    // Meanwhile another analyst ignores the Ticket.
    status = "ignored";

    await returnToForeground();

    await readEnded(TICKET);
    await nextFrames();
    expect(itemsOf(menu)).toEqual(IN_ANALYZED);
    await userEvent.keyboard("{Escape}");
    await expect.element(menu).not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Ignored", { exact: true }))
      .toBeVisible();
    const again = await openActions(screen);
    await expect.poll(() => itemsOf(again)).toEqual(["Reopen"]);
  });

  test("keeps the menu and its items while it is open after a read of the signed-in user takes triage_ticket away, then goes as the menu closes, and the focus moves to the screen's heading", async () => {
    let user = ANALYST;
    showingStatus("analyzed", { user: () => user });
    const { screen } = await renderTicket();
    const menu = await openActions(screen);
    user = WITHOUT_CAPABILITIES;

    await returnToForeground();

    await expect.element(editAssignee(screen)).not.toBeInTheDocument();
    await expect.element(menu).toBeVisible();
    expect(itemsOf(menu)).toEqual(IN_ANALYZED);

    await userEvent.keyboard("{Escape}");

    await expect.element(actionsButton(screen)).not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("goes as its menu closes after a read of the signed-in user took triage_ticket away, and leaves the focus on another control of the page to which the user moves it before it would move to the screen's heading", async () => {
    let user = ANALYST;
    showingStatus("analyzed", { user: () => user });
    const { screen } = await renderTicket();
    const menu = await openActions(screen);
    user = WITHOUT_CAPABILITIES;
    await returnToForeground();
    await expect.element(editAssignee(screen)).not.toBeInTheDocument();
    await expect.element(menu).toBeVisible();
    // The clock of the frames after which the focus moves from the page to
    // the screen's heading, which the test moves itself once the user has
    // moved the focus. The menu keeps the rest of the page out of reach
    // while it is open.
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
    });
    await userEvent.keyboard("{Escape}");
    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(actionsButton(screen)).not.toBeInTheDocument();
    // Meanwhile the user moves the focus to the tab of Overview.
    const overview = screen.getByRole("tab", {
      name: "Overview",
      exact: true,
    });
    overview.element().focus();
    await expect.element(overview).toHaveFocus();

    vi.advanceTimersByTime(1000);
    vi.useRealTimers();

    await expectFocusSettledOn(overview);
  });

  test("stays as its menu closes, and leaves the focus to React Aria rather than moving it to the screen's heading, also while the focus is on the page after the frame in which React Aria returns it, as in browsers that return it a frame late", async () => {
    showingStatus("analyzed");
    const { screen } = await renderTicket();
    const menu = await openActions(screen);
    // The clock of the frames after the menu closes: in the first, React
    // Aria returns the focus to Actions; in the next, the focus would move
    // to the screen's heading if Actions were gone. The test moves it
    // itself.
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
    });
    await userEvent.keyboard("{Escape}");
    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(actionsButton(screen)).toBeInTheDocument();
    vi.advanceTimersToNextFrame();
    // The focus is on the page, as it still is then in a browser that
    // returns it a frame late.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    expect(document.activeElement).toBe(document.body);

    vi.advanceTimersByTime(1000);
    vi.useRealTimers();

    await nextFrames();
    expect(document.activeElement).not.toBe(screenHeading(screen).element());
  });

  test("goes when a read of the signed-in user takes triage_ticket away while it holds the focus, and the focus moves to the screen's heading", async () => {
    let user = ANALYST;
    showingStatus("analyzed", { user: () => user });
    const { screen } = await renderTicket();
    actionsButton(screen).element().focus();
    await expect.element(actionsButton(screen)).toHaveFocus();
    user = WITHOUT_CAPABILITIES;

    await returnToForeground();

    await expect.element(actionsButton(screen)).not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("goes when a read of the Ticket leaves a user who holds manage_fetchers alone no action while it holds the focus, and the focus moves to the screen's heading", async () => {
    let status = "analysis";
    showingStatus("analysis", {
      user: FETCHER_MANAGER,
      ticket: () => ticketIn(status),
    });
    const { screen } = await renderTicket();
    actionsButton(screen).element().focus();
    await expect.element(actionsButton(screen)).toHaveFocus();
    // Meanwhile an analyst ignores the Ticket.
    status = "ignored";

    await returnToForeground();

    await expect.element(actionsButton(screen)).not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("keeps the menu busy while a change is in progress after a read of the signed-in user takes triage_ticket away, then goes once Sentinel answers, and the focus moves to the screen's heading", async () => {
    let user = ANALYST;
    const response = later();
    showingStatus("ignored", {
      user: () => user,
      ticketChange: () => response.promise,
    });
    const { screen } = await renderTicket();
    const menu = await choose(screen, "Reopen");
    await expect
      .element(itemOf(menu, "Reopen"))
      .toHaveAccessibleDescription("Reopening.");
    user = WITHOUT_CAPABILITIES;

    await returnToForeground();

    await expect.element(editAssignee(screen)).not.toBeInTheDocument();
    await expect
      .element(itemOf(menu, "Reopen"))
      .toHaveAccessibleDescription("Reopening.");

    response.resolve(ticketResponse(fictionalTicketDetail({ assignee: YOU })));

    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(actionsButton(screen)).not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });
});

describe("Reopen and Revert duplicate", () => {
  test.each([
    ["Reopen", "ignored", "reopen", "Reopening.", "Reopened"],
    [
      "Revert duplicate",
      "duplicated",
      "revert-duplicate",
      "Reverting the duplicate.",
      "Duplicate reverted",
    ],
  ])(
    "%s applies at once, with its item busy and the menu open until Sentinel answers, then closes the menu, returns the focus to Actions, and announces the outcome as Sentinel returns the Ticket once the read of the Ticket after it arrives",
    async (name, status, action, busy, done) => {
      const response = later();
      const reread = later();
      let changed = false;
      const spy = showingStatus(status, {
        ticket: () => (changed ? reread.promise : ticketIn(status)),
        ticketChange: () => {
          changed = true;
          return response.promise;
        },
      });
      const { screen } = await renderTicket();
      const reads = requestsTo(spy, TICKET);

      const menu = await choose(screen, name);

      const item = itemOf(menu, name);
      await expect.element(item).toHaveAccessibleDescription(busy);
      expect(animationsIn(item.element())).toEqual(["spin"]);
      expect(changesOf(spy)).toEqual([[action, undefined]]);
      await userEvent.keyboard("{Escape}");
      interactOutside();
      await nextFrames();
      await expect.element(menu).toBeVisible();
      await item.click();
      await nextFrames();
      expect(changesOf(spy)).toHaveLength(1);

      response.resolve(
        ticketResponse(
          fictionalTicketDetail({ status: "analysis", assignee: YOU }),
        ),
      );

      await expect.element(menu).not.toBeInTheDocument();
      await expect.element(actionsButton(screen)).toHaveFocus();
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
      await frames();
      expect(announcements(screen)).not.toContain(done);
      // The read shows the Ticket as a later change left it: the outcome
      // states the Ticket as Sentinel returned it after this one.
      reread.resolve(
        ticketResponse(
          fictionalTicketDetail({ status: "analyzed", assignee: BOB }),
        ),
      );

      const text = `${done}: Analysis, assigned to you.`;
      await expect.poll(() => announcements(screen)).toContain(text);
      expect(shownOutsideStatus(screen, text)).toHaveLength(0);
      // Actions stays, with the focus, and offers the actions of the status
      // that the read shows.
      expect(document.activeElement).toBe(actionsButton(screen).element());
      const again = await openActions(screen);
      await expect.poll(() => itemsOf(again)).toEqual(IN_ANALYZED);
    },
  );

  test.each([
    ["Reopen", "ignored", "Ignored", "Reopened"],
    ["Revert duplicate", "duplicated", "Duplicated", "Duplicate reverted"],
  ])(
    "%s leaves Actions offering the items of the status that the screen shows until the read of the Ticket after it arrives, then those of the status that the read shows",
    async (name, status, shownStatus, done) => {
      const reread = later();
      let changed = false;
      const spy = showingStatus(status, {
        ticket: () => (changed ? reread.promise : ticketIn(status)),
        ticketChange: () => {
          changed = true;
          return ticketIn("analysis", { assignee: YOU });
        },
      });
      const { screen } = await renderTicket();
      const reads = requestsTo(spy, TICKET);
      const menu = await choose(screen, name);
      await expect.element(menu).not.toBeInTheDocument();
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
      await expect
        .element(screen.getByText(shownStatus, { exact: true }))
        .toBeVisible();

      const during = await openActions(screen);

      await expect.poll(() => itemsOf(during)).toEqual([name]);
      await userEvent.keyboard("{Escape}");
      await expect.element(during).not.toBeInTheDocument();
      reread.resolve(ticketIn("analysis", { assignee: YOU }));
      await expect
        .poll(() => announcements(screen))
        .toContain(`${done}: Analysis, assigned to you.`);
      const after = await openActions(screen);
      await expect.poll(() => itemsOf(after)).toEqual(IN_ANALYSIS);
    },
  );

  test.each<[string, string, string, TicketDetail["assignee"], string]>([
    [
      "Reopen",
      "ignored",
      "analysis",
      YOU,
      "Reopened: Analysis, assigned to you.",
    ],
    [
      "Reopen",
      "ignored",
      "analyzed",
      BOB,
      "Reopened: Analyzed, assigned to Bob Wilson.",
    ],
    ["Reopen", "ignored", "resolved", null, "Reopened: Resolved, unassigned."],
    [
      "Reopen",
      "ignored",
      "fictional_status",
      YOU,
      "Reopened: fictional_status, assigned to you.",
    ],
    [
      "Revert duplicate",
      "duplicated",
      "analysis",
      YOU,
      "Duplicate reverted: Analysis, assigned to you.",
    ],
    [
      "Revert duplicate",
      "duplicated",
      "analyzed",
      BOB,
      "Duplicate reverted: Analyzed, assigned to Bob Wilson.",
    ],
    [
      "Revert duplicate",
      "duplicated",
      "resolved",
      null,
      "Duplicate reverted: Resolved, unassigned.",
    ],
  ])(
    "%s of a Ticket in %s that Sentinel returns in %s announces its status and assignee",
    async (name, status, after, assignee, text) => {
      let changed = false;
      showingStatus(status, {
        ticket: () =>
          changed ? ticketIn(after, { assignee }) : ticketIn(status),
        ticketChange: () => {
          changed = true;
          return ticketIn(after, { assignee });
        },
      });
      const { screen } = await renderTicket();

      await choose(screen, name);

      await expect.poll(() => announcements(screen)).toContain(text);
    },
  );

  test.each([
    ["a 503", () => errorResponse(503, "SERVICE_UNAVAILABLE"), "SNTL-12"],
    [
      "a 404, which replaces the screen with Not found",
      () => errorResponse(404, "TICKET_NOT_FOUND"),
      "Not found",
    ],
  ])(
    "shows the outcome of Reopen in the message area when the read of the Ticket after it fails with %s",
    async (_, failure, heading) => {
      let changed = false;
      showingStatus("ignored", {
        ticket: () => (changed ? failure() : ticketIn("ignored")),
        ticketChange: () => {
          changed = true;
          return ticketResponse(
            fictionalTicketDetail({ status: "analysis", assignee: YOU }),
          );
        },
      });
      const { screen } = await renderTicket();

      await choose(screen, "Reopen");

      await expectSuccessMessage(
        screen,
        "Reopened: Analysis, assigned to you.",
      );
      await expect
        .element(
          screen.getByRole("heading", { level: 1, name: heading, exact: true }),
        )
        .toBeVisible();
      expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
    },
  );

  test.each([
    ["Reopen", "ignored"],
    ["Revert duplicate", "duplicated"],
  ])(
    "%s leaves an answer that the UI cannot show to the page of a failure of the UI",
    async (name, status) => {
      // The answer of a later release that lacks the Ticket, whose status
      // and assignee the outcome cannot state.
      showingStatus(status, { ticketChange: () => jsonResponse(200, {}) });
      const { screen } = await renderTicket();

      await choose(screen, name);

      await expect
        .element(
          screen.getByRole("heading", {
            level: 1,
            name: "Something went wrong",
          }),
        )
        .toBeVisible();
    },
  );

  test.each([
    ["Reopen", "ignored", "SNTL-12 is no longer Ignored."],
    ["Revert duplicate", "duplicated", "SNTL-12 is no longer Duplicated."],
  ])(
    "%s says in the message area, in the info tone, that the Ticket left its status after 409 TICKET_INVALID_TRANSITION, then reads it again",
    async (name, status, text) => {
      const spy = showingStatus(status, {
        ticketChange: () => errorResponse(409, "TICKET_INVALID_TRANSITION"),
      });
      const { screen } = await renderTicket();
      const reads = requestsTo(spy, TICKET);

      await choose(screen, name);

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.info);
      expect(screen.getByText(/^Reference:/).query()).toBeNull();
      await expect.element(actionsMenu(screen)).not.toBeInTheDocument();
      await expect.element(actionsButton(screen)).toHaveFocus();
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    },
  );
});

describe("Ignore as not shipped by SUSE", () => {
  test("applies at once with the reason not_shipped, with its item busy, the other items unavailable, and the menu open until Sentinel answers, then closes the menu, returns the focus to Actions, and announces the outcome as Sentinel returns the Ticket once the read of the Ticket after it arrives", async () => {
    const response = later();
    const reread = later();
    let changed = false;
    const spy = showingStatus("analysis", {
      ticket: () => (changed ? reread.promise : ticketIn("analysis")),
      ticketChange: () => {
        changed = true;
        return response.promise;
      },
    });
    const { screen } = await renderTicket();
    const reads = requestsTo(spy, TICKET);

    const menu = await choose(screen, "Ignore as not shipped by SUSE");

    const item = itemOf(menu, "Ignore as not shipped by SUSE");
    await expect.element(item).toHaveAccessibleDescription("Ignoring.");
    expect(animationsIn(item.element())).toEqual(["spin"]);
    expect(changesOf(spy)).toEqual([["ignore", { reason: "not_shipped" }]]);
    const others = [
      "Ignore…",
      "Mark as duplicate…",
      "Override priority…",
      "Rerun convergence",
    ];
    for (const name of others) {
      await expect
        .element(itemOf(menu, name))
        .toHaveAttribute("aria-disabled", "true");
    }
    await userEvent.keyboard("{Escape}");
    interactOutside();
    await nextFrames();
    await expect.element(menu).toBeVisible();
    await item.click();
    for (const name of others) {
      await itemOf(menu, name).click({ force: true });
    }
    await frames();
    await expect.element(menu).toBeVisible();
    for (const name of ["Ignore SNTL-12", "Mark SNTL-12 as a duplicate"]) {
      expect(screen.getByRole("dialog", { name }).query()).toBeNull();
    }
    expect(changesOf(spy)).toHaveLength(1);

    response.resolve(ticketIn("ignored", { assignee: YOU }));

    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(actionsButton(screen)).toHaveFocus();
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    await frames();
    expect(announcements(screen)).not.toContain("Ignored");
    // The read shows the Ticket as a later change left it: the outcome
    // states the Ticket as Sentinel returned it after this one.
    reread.resolve(
      ticketIn("ignored", { ignore_reason: "other", assignee: BOB }),
    );

    await expect.poll(() => announcements(screen)).toContain(IGNORED);
    expect(shownOutsideStatus(screen, IGNORED)).toHaveLength(0);
    // Actions stays, with the focus, and offers the actions of the status
    // that the read shows.
    expect(document.activeElement).toBe(actionsButton(screen).element());
    const again = await openActions(screen);
    await expect.poll(() => itemsOf(again)).toEqual(["Reopen"]);
  });

  test.each<[string, string, TicketDetail["assignee"], string]>([
    ["new", "you, an unassigned Ticket's new assignee", YOU, IGNORED],
    [
      "analysis",
      "another user",
      BOB,
      "Ignored as Not shipped, assigned to Bob Wilson.",
    ],
    ["analysis", "no one", null, "Ignored as Not shipped, unassigned."],
  ])(
    "on a Ticket in %s announces the reason and the assignee that Sentinel returns, %s",
    async (status, _, assignee, text) => {
      let changed = false;
      showingStatus(status, {
        ticket: () =>
          changed ? ticketIn("ignored", { assignee }) : ticketIn(status),
        ticketChange: () => {
          changed = true;
          return ticketIn("ignored", { assignee });
        },
      });
      const { screen } = await renderTicket();

      await choose(screen, "Ignore as not shipped by SUSE");

      await expect.poll(() => announcements(screen)).toContain(text);
    },
  );

  test("announces a reason that the pinned contract does not list as received", async () => {
    let changed = false;
    showingStatus("analysis", {
      ticket: () =>
        changed ? ignoredForUnlistedReason() : ticketIn("analysis"),
      ticketChange: () => {
        changed = true;
        return ignoredForUnlistedReason();
      },
    });
    const { screen } = await renderTicket();

    await choose(screen, "Ignore as not shipped by SUSE");

    await expect
      .poll(() => announcements(screen))
      .toContain("Ignored as fictional_reason, unassigned.");
  });

  test("shows the outcome in the message area when the read of the Ticket after it fails", async () => {
    let changed = false;
    showingStatus("analysis", {
      ticket: () =>
        changed
          ? errorResponse(503, "SERVICE_UNAVAILABLE")
          : ticketIn("analysis"),
      ticketChange: () => {
        changed = true;
        return ticketIn("ignored", { assignee: YOU });
      },
    });
    const { screen } = await renderTicket();

    await choose(screen, "Ignore as not shipped by SUSE");

    await expectSuccessMessage(screen, IGNORED);
    expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
  });

  test("leaves an answer that the UI cannot show to the page of a failure of the UI", async () => {
    // The answer of a later release that lacks the Ticket, whose reason and
    // assignee the outcome cannot state.
    showingStatus("analysis", { ticketChange: () => jsonResponse(200, {}) });
    const { screen } = await renderTicket();

    await choose(screen, "Ignore as not shipped by SUSE");

    await expect
      .element(
        screen.getByRole("heading", {
          level: 1,
          name: "Something went wrong",
        }),
      )
      .toBeVisible();
  });

  test("handles no code specifically: 409 TICKET_INVALID_TRANSITION, of a Ticket that became Analyzed meanwhile, shows in the message area in the presentation of its status", async () => {
    const spy = showingStatus("analysis", {
      ticketChange: () => errorResponse(409, "TICKET_INVALID_TRANSITION"),
    });
    const { screen } = await renderTicket();
    const reads = requestsTo(spy, TICKET);

    await choose(screen, "Ignore as not shipped by SUSE");

    const error = screen.getByText(MESSAGE_CONFLICT, { exact: true });
    await expect.element(error).toBeVisible();
    expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES.danger);
    expect(screen.getByText(/is no longer/).query()).toBeNull();
    await expect.element(actionsButton(screen)).toHaveFocus();
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
  });
});

// The failures of a change of Actions that show in the message area in the
// presentation of their status (docs/behaviors.md, Default Presentation by
// Status; Retries and Unconfirmed Changes): the failure, its message, its
// tone, and whether it shows its reference.
const FAILURES: [
  string,
  () => Response | Promise<Response>,
  string,
  keyof typeof MESSAGE_TONES,
  boolean,
][] = [
  [
    "409 TICKET_NOT_MUTABLE",
    () => errorResponse(409, "TICKET_NOT_MUTABLE"),
    MESSAGE_CONFLICT,
    "danger",
    false,
  ],
  [
    "a 409 with a code that the pinned contract does not list",
    () => errorResponse(409, "FICTIONAL_CONFLICT"),
    MESSAGE_CONFLICT,
    "danger",
    false,
  ],
  [
    "TICKET_INVALID_TRANSITION with another status",
    () => errorResponse(400, "TICKET_INVALID_TRANSITION"),
    MESSAGE_NOT_ACCEPTED,
    "danger",
    false,
  ],
  [
    "404 TICKET_NOT_FOUND",
    () => errorResponse(404, "TICKET_NOT_FOUND"),
    MESSAGE_GONE,
    "danger",
    false,
  ],
  [
    "403",
    () => errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION"),
    MESSAGE_FORBIDDEN,
    "danger",
    false,
  ],
  [
    "a 503, as a warning with its reference",
    () => errorResponse(503, "CELERY_UNAVAILABLE"),
    MESSAGE_UNCONFIRMED,
    "warning",
    true,
  ],
  [
    "a 502 of a proxy, without a code, as a warning",
    () => new Response("Bad Gateway", { status: 502 }),
    MESSAGE_UNCONFIRMED,
    "warning",
    false,
  ],
  [
    "a network failure, as a warning",
    () => Promise.reject(new TypeError("Failed to fetch")),
    MESSAGE_UNCONFIRMED,
    "warning",
    false,
  ],
  [
    "a status and a code that the pinned contract does not list",
    () => errorResponse(418, "FICTIONAL_CODE"),
    MESSAGE_NOT_ACCEPTED,
    "danger",
    false,
  ],
];

// The actions that apply at once, with the status of the Ticket that offers
// each.
const AT_ONCE: [string, string][] = [
  ["Ignore as not shipped by SUSE", "new"],
  ["Reopen", "ignored"],
  ["Revert duplicate", "duplicated"],
  ["Rerun convergence", "analysis"],
];

describe("a failure of an action that applies at once", () => {
  test.each(
    AT_ONCE.flatMap(([name, status]) =>
      FAILURES.map(
        ([failure, response, message, tone, referenced]) =>
          [name, failure, status, response, message, tone, referenced] as const,
      ),
    ),
  )(
    "of %s shows in the message area: %s",
    async (name, _, status, response, message, tone, referenced) => {
      const spy = showingStatus(status, { ticketChange: response });
      const { screen } = await renderTicket();
      const reads = requestsTo(spy, TICKET);

      await choose(screen, name);

      const error = screen.getByText(message, { exact: true });
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES[tone]);
      if (referenced) {
        await expect
          .element(screen.getByText(REFERENCE, { exact: true }))
          .toBeVisible();
      } else {
        expect(screen.getByText(/^Reference:/).query()).toBeNull();
      }
      expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
      await expect.element(actionsMenu(screen)).not.toBeInTheDocument();
      await expect.element(actionsButton(screen)).toHaveFocus();
      // Whatever its outcome, the screen reads again what it affects.
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    },
  );
});

describe("Rerun convergence", () => {
  test("starts the convergence at once, with its item busy and the other items unavailable until Sentinel answers, then closes the menu, returns the focus to Actions, and says in the message area, in the info tone, that it started", async () => {
    const response = later();
    const spy = showingStatus("analysis", {
      ticketChange: () => response.promise,
    });
    const { screen } = await renderTicket();

    const menu = await choose(screen, "Rerun convergence");

    const rerun = itemOf(menu, "Rerun convergence");
    await expect
      .element(rerun)
      .toHaveAccessibleDescription("Starting the convergence.");
    expect(animationsIn(rerun.element())).toEqual(["spin"]);
    for (const name of IN_NEW) {
      await expect
        .element(itemOf(menu, name))
        .toHaveAttribute("aria-disabled", "true");
    }
    expect(changesOf(spy)).toEqual([["rerun-reactivation", undefined]]);
    await userEvent.keyboard("{Escape}");
    interactOutside();
    await rerun.click();
    for (const name of IN_NEW) {
      await itemOf(menu, name).click({ force: true });
    }
    await frames();
    await expect.element(menu).toBeVisible();
    for (const name of ["Ignore SNTL-12", "Mark SNTL-12 as a duplicate"]) {
      expect(screen.getByRole("dialog", { name }).query()).toBeNull();
    }
    expect(changesOf(spy)).toHaveLength(1);

    response.resolve(convergenceResponse());

    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(actionsButton(screen)).toHaveFocus();
    const message = screen.getByText("Convergence started.", { exact: true });
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.info);
    expect(announcements(screen)).not.toContain("Convergence started.");
    expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
    // Actions stays, with the same items, available again.
    const again = await openActions(screen);
    for (const name of IN_NEW) {
      await expect
        .element(itemOf(again, name))
        .not.toHaveAttribute("aria-disabled");
    }
    expect(itemsOf(again)).toEqual(IN_ANALYSIS);
  });

  test("keeps Set severity… and Associate CVE… of a Ticket without a CVE unavailable until Sentinel answers, opening neither dialog", async () => {
    const response = later();
    const spy = showingStatus("analysis", {
      ticket: () => ticketIn("analysis", { cve: null }),
      ticketChange: () => response.promise,
    });
    const { screen } = await renderTicket();

    const menu = await choose(screen, "Rerun convergence");

    await expect
      .element(itemOf(menu, "Rerun convergence"))
      .toHaveAccessibleDescription("Starting the convergence.");
    const corrections = ["Set severity…", "Associate CVE…"];
    for (const name of corrections) {
      await expect
        .element(itemOf(menu, name))
        .toHaveAttribute("aria-disabled", "true");
    }
    for (const name of corrections) {
      await itemOf(menu, name).click({ force: true });
    }
    await frames();
    await expect.element(menu).toBeVisible();
    for (const name of [
      "Set the severity of SNTL-12",
      "Associate a CVE with SNTL-12",
    ]) {
      expect(screen.getByRole("dialog", { name }).query()).toBeNull();
    }
    expect(changesOf(spy)).toHaveLength(1);

    response.resolve(convergenceResponse());

    await expect.element(menu).not.toBeInTheDocument();
  });

  test("starts the convergence for a user who holds manage_fetchers alone", async () => {
    const spy = showingStatus("resolved", { user: FETCHER_MANAGER });
    const { screen } = await renderTicket();

    await choose(screen, "Rerun convergence");

    await expect
      .element(screen.getByText("Convergence started.", { exact: true }))
      .toBeVisible();
    expect(changesOf(spy)).toEqual([["rerun-reactivation", undefined]]);
    await expect.element(actionsButton(screen)).toHaveFocus();
  });

  test("handles no code specifically: 409 TICKET_INVALID_TRANSITION shows in the presentation of its status", async () => {
    showingStatus("analysis", {
      ticketChange: () => errorResponse(409, "TICKET_INVALID_TRANSITION"),
    });
    const { screen } = await renderTicket();

    await choose(screen, "Rerun convergence");

    const error = screen.getByText(MESSAGE_CONFLICT, { exact: true });
    await expect.element(error).toBeVisible();
    expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES.danger);
    expect(screen.getByText(/is no longer/).query()).toBeNull();
  });
});

describe("the reads after an action that applies at once", () => {
  test.each(AT_ONCE)(
    "%s reads again the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, and the reads of the Ticket list, its duplicates included where the details show them",
    async (name, status) => {
      // A Duplicated Ticket has no duplicates, whose read its details do not
      // show (Sentinel docs/features/tickets/tickets.md, Duplicate Handling,
      // Invariant).
      const duplicatesShown = status !== "duplicated";
      const spy = stubTicket({
        user: { data: { ...MAINTAINER.data, capabilities: ["triage_ticket"] } },
        ticket: () => ticketIn(status, { packages: [fictionalPackage()] }),
      });
      const { screen } = await renderTicket();
      await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
      await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
      const reads = {
        ticket: requestsTo(spy, TICKET),
        actors: requestsTo(spy, ACTORS),
        work: requestsTo(spy, YOUR_WORK),
        duplicates: readsOf(spy, TICKETS),
      };
      // The user saw the Ticket list and Audit log before, which wait in the
      // cache.
      client.setQueryData([EVENTS], {});
      client.setQueryData([TICKETS, { page: 1 }], {});

      await choose(screen, name);

      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
      await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
      await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(reads.work + 1);
      await expect
        .poll(() => readsOf(spy, TICKETS))
        .toBe(reads.duplicates + (duplicatesShown ? 1 : 0));
      await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
      expect(leftInvalidated(EVENTS)).toBe(true);
      expect(leftInvalidated(TICKETS)).toBe(true);
    },
  );
});

describe("an action that ends after the user left the screen", () => {
  test.each<
    [string, string, () => Response, keyof typeof MESSAGE_TONES, string]
  >([
    [
      "Ignore as not shipped by SUSE",
      "analysis",
      () => ticketIn("ignored", { assignee: YOU }),
      "success",
      IGNORED,
    ],
    [
      "Reopen",
      "ignored",
      () =>
        ticketResponse(
          fictionalTicketDetail({ status: "analysis", assignee: YOU }),
        ),
      "success",
      "Reopened: Analysis, assigned to you.",
    ],
    [
      "Revert duplicate",
      "duplicated",
      () =>
        ticketResponse(
          fictionalTicketDetail({ status: "analyzed", assignee: BOB }),
        ),
      "success",
      "Duplicate reverted: Analyzed, assigned to Bob Wilson.",
    ],
    [
      "Rerun convergence",
      "analysis",
      () => convergenceResponse(),
      "info",
      "Convergence started.",
    ],
  ])(
    "shows the outcome of %s in the message area, naming the Ticket with a link to it",
    async (name, status, answer, tone, text) => {
      const response = later();
      showingStatus(status, { ticketChange: () => response.promise });
      const { router, screen } = await renderTicket();
      await choose(screen, name);

      await leaveForTickets(router, screen);
      response.resolve(answer());

      const message = screen.getByText(`SNTL-12: ${text}`, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES[tone]);
      await expect
        .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
        .toHaveAttribute("href", "/tickets/SNTL-12");
    },
  );

  test.each<
    [
      string,
      string,
      string,
      () => Response,
      string,
      keyof typeof MESSAGE_TONES,
      boolean,
    ]
  >([
    [
      "Ignore as not shipped by SUSE",
      "409 TICKET_INVALID_TRANSITION, in the presentation of its status",
      "analysis",
      () => errorResponse(409, "TICKET_INVALID_TRANSITION"),
      MESSAGE_CONFLICT,
      "danger",
      false,
    ],
    [
      "Ignore as not shipped by SUSE",
      "a 503, as a warning with its reference",
      "new",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      MESSAGE_UNCONFIRMED,
      "warning",
      true,
    ],
    [
      "Reopen",
      "409 TICKET_INVALID_TRANSITION, in the presentation of its status",
      "ignored",
      () => errorResponse(409, "TICKET_INVALID_TRANSITION"),
      MESSAGE_CONFLICT,
      "danger",
      false,
    ],
    [
      "Revert duplicate",
      "409 TICKET_INVALID_TRANSITION, in the presentation of its status",
      "duplicated",
      () => errorResponse(409, "TICKET_INVALID_TRANSITION"),
      MESSAGE_CONFLICT,
      "danger",
      false,
    ],
    [
      "Rerun convergence",
      "503 CELERY_UNAVAILABLE, as a warning with its reference",
      "analysis",
      () => errorResponse(503, "CELERY_UNAVAILABLE"),
      MESSAGE_UNCONFIRMED,
      "warning",
      true,
    ],
  ])(
    "shows a failure of %s, %s, in the message area, naming the Ticket",
    async (name, _, status, answer, text, tone, referenced) => {
      const response = later();
      showingStatus(status, { ticketChange: () => response.promise });
      const { router, screen } = await renderTicket();
      await choose(screen, name);

      await leaveForTickets(router, screen);
      response.resolve(answer());

      const message = screen.getByText(`SNTL-12: ${text}`, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES[tone]);
      await expect
        .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
        .toHaveAttribute("href", "/tickets/SNTL-12");
      if (referenced) {
        await expect
          .element(screen.getByText(REFERENCE, { exact: true }))
          .toBeVisible();
      } else {
        expect(screen.getByText(/^Reference:/).query()).toBeNull();
      }
      expect(screen.getByText(/is no longer/).query()).toBeNull();
    },
  );
});

describe("Ignore…", () => {
  test("opens its dialog once the menu has closed, its first reason taking the focus, without a request, and the focus returns to Actions as the dialog closes on Cancel", async () => {
    const spy = showingStatus("analysis");
    const { screen } = await renderTicket();

    const menu = await choose(screen, "Ignore…");

    const dialog = screen.getByRole("dialog", {
      name: "Ignore SNTL-12",
      exact: true,
    });
    await expect
      .element(dialog.getByRole("radio", { name: "Not shipped", exact: true }))
      .toHaveFocus();
    expect(menu.query()).toBeNull();
    expect(changesOf(spy)).toEqual([]);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsButton(screen));
    expect(changesOf(spy)).toEqual([]);
  });

  test.each(["new", "analysis"])(
    "opens its dialog from the keyboard on a Ticket in %s, the menu opening on Ignore…, its first item, so that Enter opens a dialog rather than ignoring at once, and the focus returns to Actions as Escape closes it",
    async (status) => {
      const spy = showingStatus(status);
      const { screen } = await renderTicket();
      actionsButton(screen).element().focus();
      await userEvent.keyboard("{Enter}");
      const menu = actionsMenu(screen);
      await expect.element(itemOf(menu, "Ignore…")).toHaveFocus();

      await userEvent.keyboard("{Enter}");

      const dialog = screen.getByRole("dialog", {
        name: "Ignore SNTL-12",
        exact: true,
      });
      await expect
        .element(
          dialog.getByRole("radio", { name: "Not shipped", exact: true }),
        )
        .toHaveFocus();
      expect(changesOf(spy)).toEqual([]);
      await userEvent.keyboard("{Escape}");
      await expect.element(dialog).not.toBeInTheDocument();
      await expectFocusSettledOn(actionsButton(screen));
      expect(changesOf(spy)).toEqual([]);
    },
  );
});

describe("Mark as duplicate…", () => {
  test("opens its dialog once the menu has closed, its field taking the focus, and the focus returns to Actions as the dialog closes on Cancel", async () => {
    showingStatus("analyzed");
    const { screen } = await renderTicket();

    const menu = await choose(screen, "Mark as duplicate…");

    const dialog = screen.getByRole("dialog", {
      name: "Mark SNTL-12 as a duplicate",
      exact: true,
    });
    await expect
      .element(dialog.getByRole("combobox", { name: "Original", exact: true }))
      .toHaveFocus();
    expect(menu.query()).toBeNull();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsButton(screen));
  });

  test("opens its dialog from the keyboard, and the focus returns to Actions as Escape closes it", async () => {
    showingStatus("new");
    const { screen } = await renderTicket();
    actionsButton(screen).element().focus();
    await userEvent.keyboard("{Enter}");
    const menu = actionsMenu(screen);
    // The menu opens on its first item, Ignore…, before it.
    await expect.element(itemOf(menu, "Ignore…")).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await expect.element(itemOf(menu, "Mark as duplicate…")).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    const dialog = screen.getByRole("dialog", {
      name: "Mark SNTL-12 as a duplicate",
      exact: true,
    });
    await expect
      .element(dialog.getByRole("combobox", { name: "Original", exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsButton(screen));
  });

  test("opens its dialog from the menu that it offered as the menu opened, after a read of the signed-in user took triage_ticket away, and Actions goes as the dialog closes, the focus moving to the screen's heading", async () => {
    let user = ANALYST;
    showingStatus("analyzed", { user: () => user });
    const { screen } = await renderTicket();
    const menu = await openActions(screen);
    user = WITHOUT_CAPABILITIES;
    await returnToForeground();
    await expect.element(editAssignee(screen)).not.toBeInTheDocument();

    await itemOf(menu, "Mark as duplicate…").click();

    const dialog = screen.getByRole("dialog", {
      name: "Mark SNTL-12 as a duplicate",
      exact: true,
    });
    await expect
      .element(dialog.getByRole("combobox", { name: "Original", exact: true }))
      .toHaveFocus();
    await frames();
    expect(document.activeElement).toBe(
      dialog.getByRole("combobox", { name: "Original", exact: true }).element(),
    );
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(actionsButton(screen)).not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("keeps its dialog open without input, with the heading row and Actions, when a navigation opens another tab of the Ticket, and the focus returns to Actions as the dialog closes", async () => {
    showingStatus("analyzed");
    const { router, screen } = await renderTicket();
    await choose(screen, "Mark as duplicate…");
    const dialog = screen.getByRole("dialog", {
      name: "Mark SNTL-12 as a duplicate",
      exact: true,
    });
    const field = dialog.getByRole("combobox", {
      name: "Original",
      exact: true,
    });
    await expect.element(field).toHaveFocus();

    router.history.push("/tickets/SNTL-12/audit-log");

    // The tab that the navigation opens, behind the dialog, which keeps it
    // from assistive technologies.
    await expect
      .element(
        screen.getByRole("tab", {
          name: "Audit log",
          exact: true,
          includeHidden: true,
        }),
      )
      .toHaveAttribute("aria-selected", "true");
    await nextFrames();
    await expect.element(dialog).toBeVisible();
    expect(document.activeElement).toBe(field.element());
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }).query(),
    ).toBeNull();
    expect(
      screen
        .getByRole("heading", {
          level: 1,
          name: "SNTL-12",
          exact: true,
          includeHidden: true,
        })
        .query(),
    ).not.toBeNull();
    expect(
      screen
        .getByRole("button", {
          name: "Actions of SNTL-12",
          exact: true,
          includeHidden: true,
        })
        .query(),
    ).not.toBeNull();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/tickets/SNTL-12/audit-log");
    await expectFocusSettledOn(actionsButton(screen));
  });

  test("keeps Actions while its dialog is open after a read of the signed-in user takes triage_ticket away, then goes as the dialog closes, and the focus moves to the screen's heading", async () => {
    let user = ANALYST;
    showingStatus("analyzed", { user: () => user });
    const { screen } = await renderTicket();
    await choose(screen, "Mark as duplicate…");
    const dialog = screen.getByRole("dialog", {
      name: "Mark SNTL-12 as a duplicate",
      exact: true,
    });
    await expect.element(dialog).toBeVisible();
    user = WITHOUT_CAPABILITIES;

    await returnToForeground();

    await expect.element(editAssignee(screen)).not.toBeInTheDocument();
    await expect.element(dialog).toBeVisible();
    expect(
      screen
        .getByRole("button", {
          name: "Actions of SNTL-12",
          exact: true,
          includeHidden: true,
        })
        .query(),
    ).not.toBeNull();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(actionsButton(screen)).not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });
});
