import { describe, expect, test } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import type {
  CurrentUserResponse,
  TicketDetail,
} from "../../api/generated/model";
import {
  formatDateTime,
  formatUtcDateTime,
  timeZoneName,
} from "../../components/date-time";
import {
  errorResponse,
  FICTIONAL_USER,
  fictionalPackage,
  fictionalTicketDetail,
  jsonResponse,
  OTHER_USER,
  requestsTo,
  stubApi,
  ticketResponse,
  urlOf,
  validationError,
} from "../../test-api";
import { pointerAwayFrom } from "../../test-pointer";
import {
  ACTORS,
  animationsIn,
  announcements,
  backgroundBehind,
  boxOf,
  client,
  EVENTS,
  expectFocusOnError,
  expectFocusSettledOn,
  expectSuccessMessage,
  FG_MUTED,
  frames,
  later,
  leaveForTickets,
  leftInvalidated,
  MAINTAINER,
  MESSAGE_CONFLICT,
  MESSAGE_INVALID,
  MESSAGE_NOT_ACCEPTED,
  MESSAGE_TONES,
  MESSAGE_UNCONFIRMED,
  nextFrames,
  prepareEachTest,
  REFERENCE,
  region,
  renderTicket,
  returnToForeground,
  type Screen,
  screenHeading,
  type Stub,
  stubTicket,
  TICKET,
  TICKETS,
  type UserBody,
  valueOf,
  YOUR_WORK,
} from "./test-support";

// The Coordinated Release Date in the details of Overview, the first tab of
// the Ticket screen, with its pencil and its dialog
// (src/routes/ticket-overview/coordinated-release-date.tsx;
// docs/screens/ticket.md), at the browser's default text size, in the light
// theme, in the time zone of the browser, whatever it is: each date and time
// that the user enters is a local time, which the API receives in UTC.

prepareEachTest();

// Alice Smith, an analyst who also holds manage_confidentiality.
const MANAGER: UserBody = {
  data: {
    ...OTHER_USER.data,
    capabilities: ["triage_ticket", "manage_confidentiality"],
  },
};

// The same user after a read of the signed-in user took their capabilities
// away.
const WITHOUT_CAPABILITIES: CurrentUserResponse = {
  data: { ...OTHER_USER.data, roles: [], capabilities: [] },
};

const CRD = `${TICKET}/coordinated-release-date`;

// The instant of a date and time in the time zone of the browser, in
// milliseconds since the epoch.
function local(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

// The Coordinated Release Date of the tests, 25 Nov 2099, 13:00 in the time
// zone of the browser, as the API returns it, and another date and time.
const SET = local(2099, 11, 25, 13, 0);
const SET_AT = new Date(SET).toISOString();
const LATER = local(2099, 11, 26, 14, 30);

// The creation of SNTL-12 (fictionalTicketDetail), 9 Oct 2099, 14:05:09 UTC,
// and the first instant that the field takes, the next whole minute.
const CREATED = Date.UTC(2099, 9, 9, 14, 5, 9);
const FIRST = Date.UTC(2099, 9, 9, 14, 6);

const RANGE = `Enter a date and time from ${formatDateTime(new Date(FIRST).toISOString())} to 30 Dec 9999, 23:59.`;
const INCOMPLETE = "Enter the day, the month, the year, and the time.";
// 409 TICKET_NOT_CONFIDENTIAL of a change, and the intro of a Ticket that a
// read shows no longer confidential and without a date.
const NOT_CONFIDENTIAL =
  "SNTL-12 is no longer confidential and has no Coordinated Release Date.";
const INTRO_CLOSED =
  "SNTL-12 is no longer confidential and has no Coordinated Release Date, so it can't receive one.";
const INTRO_CONFIDENTIAL =
  "The date and time agreed with the other parties at which the embargo of SNTL-12 ends. Its deadlines divide the time from its creation to it, and follow the SLA without it.";
const INTRO_DECLASSIFIED =
  "SNTL-12 is no longer confidential, but its Coordinated Release Date still decides its deadlines: they divide the time from its creation to it, and follow the SLA without it. Once removed, it can't be set again.";
const REMOVE_CONSEQUENCE =
  "SNTL-12 is no longer confidential, so it can't receive a Coordinated Release Date again, and its deadlines then follow the SLA. This can't be undone.";
const DISCARD_CONSEQUENCE =
  "The Coordinated Release Date of SNTL-12 isn't changed.";
const MESSAGE_FORBIDDEN = "You don't have permission to do this.";

// The colors of the light theme (docs/design-system.md, Color Tokens): the
// fill of a primary button, and the fill and the boundary of a secondary
// one, and the fill of a danger button.
const ACCENT = "rgb(9, 105, 218)";
const SURFACE = "rgb(255, 255, 255)";
const BORDER_STRONG = "rgb(129, 139, 152)";
const DANGER_SOLID = "rgb(207, 34, 46)";

// The description of the field: the time zone of the browser, named for the
// instant, and, for a complete date and time, the same instant in UTC.
function zoneOnly(instant: number): string {
  return `In your time zone, ${timeZoneName(instant)}.`;
}
function zoneWithUtc(instant: number): string {
  return `In your time zone, ${timeZoneName(instant)}: ${formatUtcDateTime(instant)} UTC.`;
}

// A text as a regular expression that matches it within a longer text.
function within(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

// A number of two digits, such as 05.
function two(value: number): string {
  return String(value).padStart(2, "0");
}

// The digits that the user types for an instant, in the order of the parts
// of the field: the day, the month, the year, the hour, and the minute, in
// the time zone of the browser.
function digitsOf(instant: number): string {
  const date = new Date(instant);
  return [
    two(date.getDate()),
    two(date.getMonth() + 1),
    String(date.getFullYear()),
    two(date.getHours()),
    two(date.getMinutes()),
  ].join("");
}

// The Coordinated Release Date that a body of Set Coordinated Release Date
// sends, or null.
function releaseIn(body: unknown): string | null {
  return typeof body === "object" &&
    body !== null &&
    "coordinated_release_at" in body &&
    typeof body.coordinated_release_at === "string"
    ? body.coordinated_release_at
    : null;
}

// SNTL-12 with the fields, in a status that can be one that the pinned
// contract does not list.
function ticketIn(status: string, fields: Partial<TicketDetail>): Response {
  return jsonResponse(200, {
    data: { ...fictionalTicketDetail(fields), status },
  });
}

// Answers for the manager unless the test says otherwise, with SNTL-12,
// confidential with the Coordinated Release Date of the tests unless the
// fields say otherwise, in Analyzed or the status; and Set Coordinated
// Release Date with SNTL-12 with the date sent, which the Ticket then has.
function showingRelease(
  fields: Partial<TicketDetail> = {},
  stub: Partial<Stub> = {},
  status = "analyzed",
) {
  let current: Partial<TicketDetail> = {
    is_confidential: true,
    coordinated_release_at: SET_AT,
    ...fields,
  };
  return stubTicket({
    user: MANAGER,
    ticket: () => ticketIn(status, current),
    ticketChange: (_, body) => {
      current = { ...current, coordinated_release_at: releaseIn(body) };
      return ticketIn(status, current);
    },
    ...stub,
  });
}

// The bodies of the requests of Set Coordinated Release Date.
function releases(spy: ReturnType<typeof stubApi>): unknown[] {
  return spy.mock.calls
    .filter(
      ([input, init]) =>
        init?.method === "PATCH" && urlOf(input).pathname === CRD,
    )
    .map(([, init]) =>
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    );
}

function pencilOf(screen: Screen) {
  return region(screen, "Details").getByRole("button", {
    name: "Edit Coordinated Release Date",
    exact: true,
  });
}

// The pencil, also while a dialog keeps it from assistive technologies.
function anyPencil(screen: Screen) {
  return screen.getByRole("button", {
    name: "Edit Coordinated Release Date",
    exact: true,
    includeHidden: true,
  });
}

function releaseDialog(screen: Screen) {
  return screen.getByRole("dialog", {
    name: "Edit the Coordinated Release Date of SNTL-12",
    exact: true,
  });
}

function removeConfirmation(screen: Screen) {
  return screen.getByRole("dialog", {
    name: "Remove the Coordinated Release Date of SNTL-12?",
    exact: true,
  });
}

function discardDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Discard changes?" });
}

function fieldOf(dialog: Locator) {
  return dialog.getByRole("group", {
    name: "Coordinated Release Date",
    exact: true,
  });
}

// A part of the field: 0 the day, 1 the month, 2 the year, 3 the hour, 4 the
// minute.
function partOf(dialog: Locator, index: number) {
  return fieldOf(dialog).getByRole("spinbutton").nth(index);
}

// What the field shows, such as 25/11/2099, 13:00, without the marks that
// isolate the direction of the time.
function shownIn(dialog: Locator): string {
  return (fieldOf(dialog).element().textContent ?? "").replace(
    /[\u2066-\u2069]/g,
    "",
  );
}

// The description of the field, as it shows below it.
function descriptionOf(dialog: Locator, text: string) {
  return dialog.getByText(text, { exact: true });
}

function buttonOf(dialog: Locator, name: string) {
  return dialog.getByRole("button", { name, exact: true });
}

// Whether the parts of the field are marked as invalid for assistive
// technologies.
function invalid(dialog: Locator): boolean {
  return fieldOf(dialog)
    .getByRole("spinbutton")
    .elements()
    .every((part) => part.getAttribute("aria-invalid") === "true");
}

// What the status regions of the dialog say, such as the error of the field
// that its part with the focus announces.
function formStatus(dialog: Locator): string {
  return dialog
    .getByRole("status")
    .elements()
    .map((status) => status.textContent)
    .join("");
}

// Opens the dialog from the pencil and waits until the day of the field has
// the focus.
async function openRelease(screen: Screen) {
  await pencilOf(screen).click();
  const dialog = releaseDialog(screen);
  await expect.element(partOf(dialog, 0)).toHaveFocus();
  return dialog;
}

// Types digits into the field from its day, which takes the focus as from
// the keyboard, without opening the calendar.
async function typeInto(dialog: Locator, digits: string) {
  const day = partOf(dialog, 0).element();
  if (day instanceof HTMLElement) {
    day.focus();
  }
  await userEvent.keyboard(digits);
}

// Opens the dialog, types the date and time of the instant, and saves it.
async function saveInstant(screen: Screen, instant: number) {
  const dialog = await openRelease(screen);
  await typeInto(dialog, digitsOf(instant));
  await buttonOf(dialog, "Save").click();
  return dialog;
}

// The outcomes of a change that ends after the user left the tab or the
// screen: what the user started, the answer of Sentinel, the message, and
// its tone.
const LEFT: [
  string,
  "Save" | "Remove date",
  () => Response,
  string,
  keyof typeof MESSAGE_TONES,
][] = [
  [
    "the outcome of a date set",
    "Save",
    () =>
      ticketResponse(
        fictionalTicketDetail({
          is_confidential: true,
          coordinated_release_at: new Date(LATER).toISOString(),
        }),
      ),
    `Coordinated Release Date set to ${formatDateTime(new Date(LATER).toISOString())}.`,
    "success",
  ],
  [
    "the outcome of a date removed",
    "Remove date",
    () =>
      ticketResponse(
        fictionalTicketDetail({
          is_confidential: true,
          coordinated_release_at: null,
        }),
      ),
    "Coordinated Release Date removed.",
    "success",
  ],
  [
    "the failure 409 TICKET_NOT_CONFIDENTIAL, with its own message,",
    "Save",
    () => errorResponse(409, "TICKET_NOT_CONFIDENTIAL"),
    NOT_CONFIDENTIAL,
    "danger",
  ],
  [
    "the failure 422 TICKET_COORDINATED_RELEASE_BEFORE_CREATION, with the range that the field takes,",
    "Save",
    () => errorResponse(422, "TICKET_COORDINATED_RELEASE_BEFORE_CREATION"),
    RANGE,
    "danger",
  ],
  [
    "a failure with a 409 code that the pinned contract does not list, in the presentation of its status,",
    "Save",
    () => errorResponse(409, "FICTIONAL_CONFLICT"),
    MESSAGE_CONFLICT,
    "danger",
  ],
  [
    "a failure with a 503, as a warning,",
    "Save",
    () => errorResponse(503, "SERVICE_UNAVAILABLE"),
    MESSAGE_UNCONFIRMED,
    "warning",
  ],
];

// Opens the dialog and starts a change, another date or its removal, and
// waits until it is in progress.
async function startChange(screen: Screen, action: "Save" | "Remove date") {
  const dialog = await openRelease(screen);
  if (action === "Save") {
    await typeInto(dialog, digitsOf(LATER));
  }
  await buttonOf(dialog, action).click();
  await expect
    .element(buttonOf(dialog, action))
    .toHaveAttribute("aria-disabled", "true");
}

// The rectangles of the details and of the CVE, whose places tell the
// layout, also while a dialog keeps them from assistive technologies.
function detailsBox(screen: Screen): DOMRect {
  return boxOf(
    screen.getByRole("region", {
      name: "Details",
      exact: true,
      includeHidden: true,
    }),
  );
}
function cveBox(screen: Screen): DOMRect {
  return boxOf(
    screen.getByRole("region", {
      name: "CVE-2099-0012",
      exact: true,
      includeHidden: true,
    }),
  );
}

// Whether the details show beside the CVE, in the side column.
function inSideColumn(screen: Screen): boolean {
  return detailsBox(screen).left > cveBox(screen).right;
}

// Whether the details show above the CVE, in one column.
function aboveParts(screen: Screen): boolean {
  return detailsBox(screen).bottom < cveBox(screen).top;
}

describe("the pencil of the Coordinated Release Date", () => {
  test("shows at the end of its line to a user who holds manage_confidentiality, an icon button 24 px square named Edit Coordinated Release Date, which its tooltip shows", async () => {
    showingRelease();
    const { screen } = await renderTicket();

    const pencil = pencilOf(screen);
    await expect.element(pencil).toBeVisible();
    const value = valueOf(screen, "Coordinated Release Date");
    expect(value.contains(pencil.element())).toBe(true);
    expect(value.textContent).toBe(formatDateTime(SET_AT));
    expect([boxOf(pencil).width, boxOf(pencil).height]).toEqual([24, 24]);
    expect(boxOf(pencil).right).toBe(value.getBoundingClientRect().right);
    expect(
      pencil.element().querySelector("svg")?.getAttribute("class"),
    ).toMatch(/lucide-pencil/);

    // Keyboard focus shows the tooltip at once.
    pencil.element().focus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}{Tab}");

    await expect.element(pencil).toHaveFocus();
    await expect
      .element(
        page.getByRole("tooltip", { name: "Edit Coordinated Release Date" }),
      )
      .toBeVisible();
  });

  test.each<[string, Partial<TicketDetail>, string]>([
    [
      "a confidential Ticket without a date, beside its absent value",
      { coordinated_release_at: null },
      "–Not set",
    ],
    ["a confidential Ticket with a date", {}, formatDateTime(SET_AT)],
    [
      "a Ticket no longer confidential that keeps its date",
      { is_confidential: false },
      formatDateTime(SET_AT),
    ],
  ])("shows on %s", async (_, fields, text) => {
    showingRelease(fields);
    const { screen } = await renderTicket();

    await expect.element(pencilOf(screen)).toBeVisible();
    expect(valueOf(screen, "Coordinated Release Date").textContent).toBe(text);
  });

  test.each([
    "new",
    "analysis",
    "analyzed",
    "resolved",
    "ignored",
    "duplicated",
    "fictional_status",
  ])("shows on a Ticket in %s", async (status) => {
    showingRelease(
      {
        ignore_reason: status === "ignored" ? "other" : null,
        duplicate_of_ticket_id: status === "duplicated" ? "SNTL-21" : null,
      },
      {},
      status,
    );
    const { screen } = await renderTicket();

    await expect.element(pencilOf(screen)).toBeVisible();
  });

  test.each<[string, UserBody]>([
    ["an analyst who holds triage_ticket alone", OTHER_USER],
    ["a user who holds no capability", FICTIONAL_USER],
  ])("does not show to %s, who sees the date alone", async (_, user) => {
    showingRelease({}, { user });
    const { screen } = await renderTicket();

    await expect
      .element(region(screen, "Details").getByText("Last modified"))
      .toBeVisible();
    expect(valueOf(screen, "Coordinated Release Date").textContent).toBe(
      formatDateTime(SET_AT),
    );
    expect(anyPencil(screen).query()).toBeNull();
  });

  test("does not show, with its field, on a Ticket that is not confidential and has no date", async () => {
    showingRelease({ is_confidential: false, coordinated_release_at: null });
    const { screen } = await renderTicket();

    await expect
      .element(region(screen, "Details").getByText("Last modified"))
      .toBeVisible();
    expect(
      region(screen, "Details")
        .getByText("Coordinated Release Date")
        .elements(),
    ).toHaveLength(0);
    expect(anyPencil(screen).query()).toBeNull();
  });

  test("stays while its dialog is open after a read of the signed-in user takes manage_confidentiality away, then goes as the dialog closes, and the focus moves to the screen's heading", async () => {
    let user: UserBody = MANAGER;
    showingRelease({}, { user: () => user });
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);
    user = WITHOUT_CAPABILITIES;

    await returnToForeground();

    // The pencil of the assignee, behind the dialog, goes with
    // triage_ticket.
    await expect
      .element(
        screen.getByRole("button", {
          name: "Edit assignee",
          exact: true,
          includeHidden: true,
        }),
      )
      .not.toBeInTheDocument();
    await expect.element(dialog).toBeVisible();
    expect(anyPencil(screen).query()).not.toBeNull();

    await buttonOf(dialog, "Cancel").click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(anyPencil(screen)).not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });
});

describe("the dialog of the Coordinated Release Date", () => {
  test("is at most 560 px wide, says in fg-muted what the date of a confidential Ticket decides, then shows Coordinated Release Date, whose day takes the focus, with the date of the Ticket in the time zone of the browser and that zone and the same instant in UTC as its description, then Remove date, a secondary button at the start, Cancel, and Save, a primary button", async () => {
    showingRelease();
    const { screen } = await renderTicket();

    const dialog = await openRelease(screen);

    expect(boxOf(dialog).width).toBe(560);
    const intro = dialog.getByText(INTRO_CONFIDENTIAL, { exact: true });
    await expect.element(intro).toBeVisible();
    expect(getComputedStyle(intro.element()).color).toBe(FG_MUTED);
    expect(boxOf(intro).bottom).toBeLessThan(boxOf(fieldOf(dialog)).top);
    // The day, the month, the year, then the hour and the minute on the
    // 24-hour clock, of 25 Nov 2099, 13:00 in the time zone of the browser.
    expect(shownIn(dialog)).toBe("25/11/2099, 13:00");
    const parts = fieldOf(dialog).getByRole("spinbutton");
    for (const [index, [name, value]] of [
      ["day", "25"],
      ["month", "11"],
      ["year", "2099"],
      ["hour", "13"],
      ["minute", "0"],
    ].entries()) {
      await expect
        .element(parts.nth(index))
        .toHaveAccessibleName(
          new RegExp(`^${name},? Coordinated Release Date$`),
        );
      await expect
        .element(parts.nth(index))
        .toHaveAttribute("aria-valuenow", value);
    }
    const description = descriptionOf(dialog, zoneWithUtc(SET));
    await expect.element(description).toBeVisible();
    expect(boxOf(description).top).toBeGreaterThan(
      boxOf(fieldOf(dialog)).bottom,
    );
    // The instant in UTC, as a time element with the instant that it shows.
    const utc = dialog
      .getByText(`${formatUtcDateTime(SET)} UTC`, { exact: true })
      .element();
    expect(utc.tagName).toBe("TIME");
    expect(utc.getAttribute("datetime")).toBe(SET_AT);
    await expect
      .element(partOf(dialog, 0))
      .toHaveAccessibleDescription(within(zoneWithUtc(SET)));
    // The button of the calendar of the field, then the buttons of the
    // dialog.
    expect(
      dialog
        .getByRole("button")
        .elements()
        .map((button) => button.textContent),
    ).toEqual(["", "Remove date", "Cancel", "Save"]);
    const remove = buttonOf(dialog, "Remove date");
    const cancel = buttonOf(dialog, "Cancel");
    const save = buttonOf(dialog, "Save");
    expect(boxOf(remove).right).toBeLessThan(boxOf(cancel).left);
    expect(boxOf(remove).left - boxOf(dialog).left).toBe(21);
    await pointerAwayFrom(remove);
    const removeStyle = getComputedStyle(remove.element());
    expect([
      removeStyle.backgroundColor,
      removeStyle.borderTopColor,
      boxOf(remove).height,
    ]).toEqual([SURFACE, BORDER_STRONG, 40]);
    expect(getComputedStyle(save.element()).backgroundColor).toBe(ACCENT);
    expect(boxOf(save).right).toBeGreaterThan(boxOf(cancel).right);
  });

  test("says of a Ticket no longer confidential that the date still decides its deadlines and can't be set again once removed", async () => {
    showingRelease({ is_confidential: false });
    const { screen } = await renderTicket();

    const dialog = await openRelease(screen);

    await expect
      .element(dialog.getByText(INTRO_DECLASSIFIED, { exact: true }))
      .toBeVisible();
    expect(dialog.getByText(INTRO_CONFIDENTIAL).query()).toBeNull();
    await expect.element(buttonOf(dialog, "Remove date")).toBeVisible();
  });

  test("opens empty on a Ticket without a date, its description naming the time zone of the browser alone, without Remove date", async () => {
    showingRelease({ coordinated_release_at: null });
    const { screen } = await renderTicket();

    const dialog = await openRelease(screen);

    expect(shownIn(dialog)).toBe("dd/mm/yyyy, ––:––");
    await expect
      .element(descriptionOf(dialog, zoneOnly(Date.now())))
      .toBeVisible();
    expect(
      dialog
        .getByRole("button")
        .elements()
        .map((button) => button.textContent),
    ).toEqual(["", "Cancel", "Save"]);
  });

  test("names the time zone of the date and time entered, with the same instant in UTC once they are complete, and says when that instant has already passed", async () => {
    showingRelease({ coordinated_release_at: null });
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);

    // Only some of the parts: the time zone of the browser now.
    await typeInto(dialog, "2511");
    await expect
      .element(descriptionOf(dialog, zoneOnly(Date.now())))
      .toBeVisible();

    // Complete, in the future.
    await typeInto(dialog, digitsOf(LATER));
    await expect
      .element(descriptionOf(dialog, zoneWithUtc(LATER)))
      .toBeVisible();

    // Complete, in the summer, which a time zone that moves its clocks names
    // otherwise than the winter in which the tests mostly enter dates.
    const summer = local(2099, 7, 15, 12, 0);
    await typeInto(dialog, digitsOf(summer));
    await expect
      .element(descriptionOf(dialog, zoneWithUtc(summer)))
      .toBeVisible();

    // Complete, in the past.
    const past = local(2025, 1, 15, 9, 30);
    await typeInto(dialog, digitsOf(past));
    await expect
      .element(
        descriptionOf(dialog, `${zoneWithUtc(past)} It has already passed.`),
      )
      .toBeVisible();
    await expect
      .element(partOf(dialog, 0))
      .toHaveAccessibleDescription(/It has already passed\.$/);
  });

  test("states 25 Nov 2099, 13:00 UTC for that instant, whatever the time zone of the browser", async () => {
    showingRelease({ coordinated_release_at: null });
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);
    const instant = Date.UTC(2099, 10, 25, 13, 0);

    await typeInto(dialog, digitsOf(instant));

    await expect
      .element(
        descriptionOf(
          dialog,
          `In your time zone, ${timeZoneName(instant)}: 25 Nov 2099, 13:00 UTC.`,
        ),
      )
      .toBeVisible();
  });

  test.each<[string, Partial<TicketDetail>]>([
    ["a confidential Ticket with a date", {}],
    ["a confidential Ticket without a date", { coordinated_release_at: null }],
    ["a Ticket no longer confidential with a date", { is_confidential: false }],
  ])(
    "says, once a read shows %s, on which it opened, no longer confidential and without a date, that it can't receive one, without Remove date",
    async (_, fields) => {
      let shown: Partial<TicketDetail> = {
        is_confidential: true,
        coordinated_release_at: SET_AT,
        ...fields,
      };
      showingRelease({}, { ticket: () => ticketIn("analyzed", shown) });
      const { screen } = await renderTicket();
      const dialog = await openRelease(screen);
      // Meanwhile another user made it non-confidential and removed its date.
      shown = { is_confidential: false, coordinated_release_at: null };

      await returnToForeground();

      await expect
        .element(dialog.getByText(INTRO_CLOSED, { exact: true }))
        .toBeVisible();
      expect(
        getComputedStyle(dialog.getByText(INTRO_CLOSED).element()).color,
      ).toBe(FG_MUTED);
      expect(dialog.getByText(INTRO_CONFIDENTIAL).query()).toBeNull();
      expect(dialog.getByText(INTRO_DECLASSIFIED).query()).toBeNull();
      expect(buttonOf(dialog, "Remove date").query()).toBeNull();
      expect(
        dialog
          .getByRole("button")
          .elements()
          .map((button) => button.textContent),
      ).toEqual(["", "Cancel", "Save"]);
    },
  );

  test("says, once a read shows the confidential Ticket on which it opened no longer confidential with its date, what the date of such a Ticket decides, and Remove date then asks first", async () => {
    let confidential = true;
    const spy = showingRelease(
      {},
      {
        ticket: () =>
          ticketIn("analyzed", {
            is_confidential: confidential,
            coordinated_release_at: SET_AT,
          }),
      },
    );
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);
    // Meanwhile another user made it non-confidential.
    confidential = false;

    await returnToForeground();

    await expect
      .element(dialog.getByText(INTRO_DECLASSIFIED, { exact: true }))
      .toBeVisible();
    expect(dialog.getByText(INTRO_CONFIDENTIAL).query()).toBeNull();
    await buttonOf(dialog, "Remove date").click();
    const confirmation = removeConfirmation(screen);
    await expect.element(buttonOf(confirmation, "Cancel")).toHaveFocus();
    await expect
      .element(confirmation.getByText(REMOVE_CONSEQUENCE, { exact: true }))
      .toBeVisible();
    expect(releases(spy)).toEqual([]);
  });
});

// The calendar that is open, over the dialog, in a popover of the page.
function calendar(): Locator {
  return page.getByRole("dialog").filter({ has: page.getByRole("grid") });
}

// The days of the month that the calendar shows, each with whether it
// enables it.
function daysOf(): [number, boolean][] {
  return calendar()
    .getByRole("grid")
    .getByRole("button")
    .elements()
    .filter((cell) => getComputedStyle(cell).visibility !== "hidden")
    .map((cell) => [
      Number(cell.textContent),
      cell.getAttribute("aria-disabled") !== "true",
    ]);
}

describe("the calendar of the Coordinated Release Date", () => {
  test.each<[string, string, number, number, boolean]>([
    [
      "of the creation of the Ticket",
      "2099-10-09T14:05:09Z",
      // October 2099, whose days after the first it enables to the end.
      31,
      31,
      false,
    ],
    [
      "of the creation of a Ticket created in December 9999 to 30 Dec 9999",
      "9999-12-20T12:00:00Z",
      31,
      30,
      true,
    ],
  ])(
    "of an empty field opens on the first month in which it enables a day, and enables the days from that %s",
    async (_, created, length, last, lastMonth) => {
      showingRelease({ coordinated_release_at: null, created_at: created });
      const { screen } = await renderTicket();
      const dialog = await openRelease(screen);
      // The first day that the field takes, in the time zone of the
      // browser: the day of the next whole minute after the creation.
      const first = new Date(
        Math.ceil(Date.parse(created) / 60_000) * 60_000,
      ).getDate();

      await fieldOf(dialog)
        .getByRole("button", {
          name: "Calendar Coordinated Release Date",
          exact: true,
        })
        .click();

      await expect.element(calendar()).toBeVisible();
      // The day before the first disabled, the first enabled, and, in
      // December 9999, 31 Dec disabled.
      expect(daysOf()).toEqual(
        Array.from({ length }, (_day, index) => [
          index + 1,
          index + 1 >= first && index + 1 <= last,
        ]),
      );
      await expect
        .element(calendar().getByRole("button", { name: "Previous month" }))
        .toBeDisabled();
      expect(
        calendar()
          .getByRole("button", { name: "Next month" })
          .element()
          .hasAttribute("disabled"),
      ).toBe(lastMonth);
    },
  );
});

describe("Save", () => {
  test.each<[string, Partial<TicketDetail>, string]>([
    ["with the date and time with which it opened", {}, ""],
    [
      "with the date and time with which it opened, typed again",
      {},
      digitsOf(SET),
    ],
    [
      "on an empty field that opened empty",
      { coordinated_release_at: null },
      "",
    ],
  ])(
    "closes the dialog without a request %s, and returns the focus to the pencil",
    async (_, fields, digits) => {
      const spy = showingRelease(fields);
      const { screen } = await renderTicket();
      const dialog = await openRelease(screen);
      if (digits !== "") {
        await typeInto(dialog, digits);
      }

      await buttonOf(dialog, "Save").click();

      await expect.element(dialog).not.toBeInTheDocument();
      expect(discardDialog(screen).query()).toBeNull();
      await expectFocusSettledOn(pencilOf(screen));
      expect(releases(spy)).toEqual([]);
    },
  );

  test("closes the dialog without a request when only the seconds of the date of the Ticket differ from the minute that the field shows", async () => {
    const spy = showingRelease({
      coordinated_release_at: new Date(SET + 30_000).toISOString(),
    });
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);

    await buttonOf(dialog, "Save").click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(releases(spy)).toEqual([]);
  });

  test("sends the date and time entered in the time zone of the browser in UTC, with nothing else in the body, busy and with the field read-only until Sentinel confirms it; then closes, returns the focus to the pencil, and announces the date that Sentinel returns once the read of the Ticket after it arrives", async () => {
    const response = later();
    const reread = later();
    let changed = false;
    const spy = showingRelease(
      {},
      {
        ticket: () =>
          changed
            ? reread.promise
            : ticketResponse(
                fictionalTicketDetail({
                  is_confidential: true,
                  coordinated_release_at: SET_AT,
                }),
              ),
        ticketChange: () => {
          changed = true;
          return response.promise;
        },
      },
    );
    const { screen } = await renderTicket();
    const reads = requestsTo(spy, TICKET);

    const dialog = await saveInstant(screen, LATER);

    const save = buttonOf(dialog, "Save");
    await expect.element(save).toHaveAttribute("aria-disabled", "true");
    expect(animationsIn(save.element())).toEqual(["spin"]);
    expect(releases(spy)).toEqual([
      { coordinated_release_at: new Date(LATER).toISOString() },
    ]);
    await expect.element(buttonOf(dialog, "Cancel")).toBeDisabled();
    await expect.element(buttonOf(dialog, "Remove date")).toBeDisabled();
    for (const part of fieldOf(dialog).getByRole("spinbutton").elements()) {
      expect(part.getAttribute("aria-readonly")).toBe("true");
    }
    const shown = shownIn(dialog);
    await save.click({ force: true });
    // Typing, and Enter, in the field, which keeps the focus.
    await typeInto(dialog, "0");
    await expect.element(partOf(dialog, 0)).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");
    await nextFrames();
    await expect.element(dialog).toBeVisible();
    expect(discardDialog(screen).query()).toBeNull();
    expect(shownIn(dialog)).toBe(shown);
    expect(releases(spy)).toHaveLength(1);

    // Sentinel returns the date as another user changed it meanwhile.
    const returned = new Date(LATER + 60_000).toISOString();
    response.resolve(
      ticketResponse(
        fictionalTicketDetail({
          is_confidential: true,
          coordinated_release_at: returned,
        }),
      ),
    );

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(pencilOf(screen));
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    await frames();
    expect(announcements(screen)).not.toContain("Coordinated Release Date");
    // The read shows the deadlines that Sentinel derived from the date.
    reread.resolve(
      ticketResponse(
        fictionalTicketDetail({
          is_confidential: true,
          coordinated_release_at: returned,
          qa_due_at: "2099-11-20T14:05:09Z",
          release_due_at: returned,
        }),
      ),
    );

    const text = `Coordinated Release Date set to ${formatDateTime(returned)}.`;
    await expect.poll(() => announcements(screen)).toContain(text);
    expect(valueOf(screen, "Coordinated Release Date").textContent).toBe(
      formatDateTime(returned),
    );
    expect(valueOf(screen, "Release").textContent).toBe(
      formatDateTime(returned),
    );
    expect(document.activeElement).toBe(pencilOf(screen).element());
  });

  test("sends a date on a Ticket that had none", async () => {
    const spy = showingRelease({ coordinated_release_at: null });
    const { screen } = await renderTicket();

    const dialog = await saveInstant(screen, LATER);

    await expect.element(dialog).not.toBeInTheDocument();
    expect(releases(spy)).toEqual([
      { coordinated_release_at: new Date(LATER).toISOString() },
    ]);
    await expect
      .poll(() => announcements(screen))
      .toContain(
        `Coordinated Release Date set to ${formatDateTime(new Date(LATER).toISOString())}.`,
      );
  });

  test("submits with Enter in a part of the field", async () => {
    const spy = showingRelease();
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);
    await typeInto(dialog, digitsOf(LATER));
    await expect.element(partOf(dialog, 4)).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(releases(spy)).toEqual([
      { coordinated_release_at: new Date(LATER).toISOString() },
    ]);
  });

  test.each<[string, Partial<TicketDetail>, number]>([
    ["the first whole minute after the creation of the Ticket", {}, FIRST],
    ["the last minute of 30 Dec 9999", {}, local(9999, 12, 30, 23, 59)],
    [
      "an instant that has already passed, after the creation of the Ticket",
      { created_at: "2025-01-10T08:00:00Z" },
      local(2025, 6, 15, 12, 0),
    ],
  ])("takes %s", async (_, fields, instant) => {
    const spy = showingRelease({ coordinated_release_at: null, ...fields });
    const { screen } = await renderTicket();

    const dialog = await saveInstant(screen, instant);

    await expect.element(dialog).not.toBeInTheDocument();
    expect(releases(spy)).toEqual([
      { coordinated_release_at: new Date(instant).toISOString() },
    ]);
  });

  test("shows Enter the day, the month, the year, and the time. at the field for only some of its parts, without a request, the field taking the focus, until the input changes", async () => {
    const spy = showingRelease({ coordinated_release_at: null });
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);
    await typeInto(dialog, "25112099");

    await buttonOf(dialog, "Save").click();

    const error = dialog.getByText(INCOMPLETE, { exact: true });
    await expect.element(error).toBeVisible();
    expect(boxOf(error).top).toBeGreaterThan(boxOf(fieldOf(dialog)).bottom);
    expect(invalid(dialog)).toBe(true);
    await expect
      .element(partOf(dialog, 0))
      .toHaveAccessibleDescription(within(INCOMPLETE));
    await expect.element(partOf(dialog, 0)).toHaveFocus();
    expect(releases(spy)).toEqual([]);

    await userEvent.keyboard("2");

    await expect.element(error).not.toBeInTheDocument();
    expect(invalid(dialog)).toBe(false);
  });

  test("announces the error of the field in a status region of the form after Enter in its day, which keeps the focus", async () => {
    showingRelease({ coordinated_release_at: null });
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);
    await typeInto(dialog, "25");
    partOf(dialog, 0).element().focus();
    await expect.element(partOf(dialog, 0)).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    await expect
      .poll(() =>
        dialog
          .getByRole("status")
          .elements()
          .map((status) => status.textContent)
          .join(""),
      )
      .toBe(INCOMPLETE);
    await expect.element(partOf(dialog, 0)).toHaveFocus();
  });

  test.each<[string, Partial<Stub>, string, string]>([
    ["only some of its parts", {}, "25112099", INCOMPLETE],
    [
      "a date and time before the creation of the Ticket",
      {},
      digitsOf(CREATED - 60_000),
      RANGE,
    ],
    [
      "422 TICKET_COORDINATED_RELEASE_BEFORE_CREATION",
      {
        ticketChange: () =>
          errorResponse(422, "TICKET_COORDINATED_RELEASE_BEFORE_CREATION"),
      },
      digitsOf(LATER),
      RANGE,
    ],
  ])(
    "keeps the focus on the minute after Enter in it for %s, and announces the error at the field in a status region of the form",
    async (_, stub, digits, message) => {
      showingRelease({ coordinated_release_at: null }, stub);
      const { screen } = await renderTicket();
      const dialog = await openRelease(screen);
      await typeInto(dialog, digits);
      partOf(dialog, 4).element().focus();
      await expect.element(partOf(dialog, 4)).toHaveFocus();

      await userEvent.keyboard("{Enter}");

      await expect
        .element(partOf(dialog, 0))
        .toHaveAccessibleDescription(within(message));
      expect(invalid(dialog)).toBe(true);
      await expect.poll(() => formStatus(dialog)).toBe(message);
      // The frames in which the focus would move to the day.
      await nextFrames();
      expect(document.activeElement).toBe(partOf(dialog, 4).element());
    },
  );

  test.each<[string, number]>([
    ["before the creation of the Ticket", CREATED - 60_000],
    ["in the minute of the creation, before its next whole minute", CREATED],
  ])(
    "shows the range that the field takes at the field for a date and time %s, without a request",
    async (_, instant) => {
      const spy = showingRelease({ coordinated_release_at: null });
      const { screen } = await renderTicket();

      const dialog = await saveInstant(screen, instant);

      await expect
        .element(dialog.getByText(RANGE, { exact: true }))
        .toBeVisible();
      expect(invalid(dialog)).toBe(true);
      await expect.element(partOf(dialog, 0)).toHaveFocus();
      expect(releases(spy)).toEqual([]);
    },
  );

  test("shows the range that the field takes at the field for a day after 30 Dec 9999, without a request", async () => {
    const spy = showingRelease({ coordinated_release_at: null });
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);
    // The month first, so that the day can be the 31st.
    partOf(dialog, 1).element().focus();
    await userEvent.keyboard("1299991000");
    await typeInto(dialog, "31");
    expect(shownIn(dialog)).toBe("31/12/9999, 10:00");

    await buttonOf(dialog, "Save").click();

    await expect
      .element(dialog.getByText(RANGE, { exact: true }))
      .toBeVisible();
    expect(releases(spy)).toEqual([]);
  });
});

describe("Remove date", () => {
  test("removes the date of a confidential Ticket at once, busy with Save unavailable until Sentinel confirms it; then closes, returns the focus to the pencil, and announces it once the read of the Ticket after it arrives", async () => {
    const response = later();
    let removed = false;
    const spy = showingRelease(
      {},
      {
        ticket: () =>
          ticketResponse(
            fictionalTicketDetail({
              is_confidential: true,
              coordinated_release_at: removed ? null : SET_AT,
            }),
          ),
        ticketChange: () => {
          removed = true;
          return response.promise;
        },
      },
    );
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);

    await buttonOf(dialog, "Remove date").click();

    const remove = buttonOf(dialog, "Remove date");
    await expect.element(remove).toHaveAttribute("aria-disabled", "true");
    expect(animationsIn(remove.element())).toEqual(["spin"]);
    expect(releases(spy)).toEqual([{ coordinated_release_at: null }]);
    expect(removeConfirmation(screen).query()).toBeNull();
    await expect.element(buttonOf(dialog, "Save")).toBeDisabled();
    await expect.element(buttonOf(dialog, "Cancel")).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await remove.click({ force: true });
    await nextFrames();
    await expect.element(dialog).toBeVisible();
    expect(releases(spy)).toHaveLength(1);

    response.resolve(
      ticketResponse(
        fictionalTicketDetail({
          is_confidential: true,
          coordinated_release_at: null,
        }),
      ),
    );

    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .poll(() => announcements(screen))
      .toContain("Coordinated Release Date removed.");
    await expectFocusSettledOn(pencilOf(screen));
    expect(valueOf(screen, "Coordinated Release Date").textContent).toBe(
      "–Not set",
    );
  });

  test("asks first on a Ticket no longer confidential, saying that it can't receive a date again, with Cancel, which takes the focus, and Remove date, a danger button, and sends nothing on Cancel", async () => {
    const spy = showingRelease({ is_confidential: false });
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);

    await buttonOf(dialog, "Remove date").click();

    const confirmation = removeConfirmation(screen);
    await expect.element(buttonOf(confirmation, "Cancel")).toHaveFocus();
    await expect
      .element(confirmation.getByText(REMOVE_CONSEQUENCE, { exact: true }))
      .toBeVisible();
    const action = buttonOf(confirmation, "Remove date");
    expect(getComputedStyle(action.element()).backgroundColor).toBe(
      DANGER_SOLID,
    );
    expect(boxOf(confirmation).width).toBe(400);
    expect(releases(spy)).toEqual([]);

    await buttonOf(confirmation, "Cancel").click();

    await expect.element(confirmation).not.toBeInTheDocument();
    await expect.element(dialog).toBeVisible();
    await expect.element(buttonOf(dialog, "Remove date")).toHaveFocus();
    expect(releases(spy)).toEqual([]);
  });

  test("removes the date of a Ticket no longer confidential once confirmed, busy until Sentinel confirms it; then closes both dialogs, announces it, and moves the focus from the pencil to the screen's heading once the read of the Ticket no longer shows the field", async () => {
    const response = later();
    const reread = later();
    let removed = false;
    const spy = showingRelease(
      { is_confidential: false },
      {
        ticket: () =>
          removed
            ? reread.promise
            : ticketResponse(
                fictionalTicketDetail({ coordinated_release_at: SET_AT }),
              ),
        ticketChange: () => {
          removed = true;
          return response.promise;
        },
      },
    );
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);
    await buttonOf(dialog, "Remove date").click();
    const confirmation = removeConfirmation(screen);

    await buttonOf(confirmation, "Remove date").click();

    const action = buttonOf(confirmation, "Remove date");
    await expect.element(action).toHaveAttribute("aria-disabled", "true");
    expect(releases(spy)).toEqual([{ coordinated_release_at: null }]);
    await userEvent.keyboard("{Escape}");
    await nextFrames();
    await expect.element(confirmation).toBeVisible();

    const answer = fictionalTicketDetail({ coordinated_release_at: null });
    response.resolve(ticketResponse(answer));

    await expect.element(confirmation).not.toBeInTheDocument();
    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(pencilOf(screen));
    reread.resolve(ticketResponse(answer));

    await expect
      .poll(() => announcements(screen))
      .toContain("Coordinated Release Date removed.");
    await expect.element(anyPencil(screen)).not.toBeInTheDocument();
    expect(
      region(screen, "Details")
        .getByText("Coordinated Release Date")
        .elements(),
    ).toHaveLength(0);
    await expectFocusSettledOn(screenHeading(screen));
  });

  test.each<[string, () => Response, string, keyof typeof MESSAGE_TONES]>([
    [
      "a 503, as a warning",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      MESSAGE_UNCONFIRMED,
      "warning",
    ],
    [
      "a status and a code that the pinned contract does not list",
      () => errorResponse(418, "FICTIONAL_CODE"),
      MESSAGE_NOT_ACCEPTED,
      "danger",
    ],
  ])(
    "shows %s of a confirmed removal at the top of the confirmation, which stays open and takes the focus",
    async (_, failure, message, tone) => {
      showingRelease({ is_confidential: false }, { ticketChange: failure });
      const { screen } = await renderTicket();
      const dialog = await openRelease(screen);
      await buttonOf(dialog, "Remove date").click();
      const confirmation = removeConfirmation(screen);

      await buttonOf(confirmation, "Remove date").click();

      const error = confirmation.getByText(message, { exact: true });
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES[tone]);
      await expectFocusOnError(error);
      await expect.element(confirmation).toBeVisible();
      await expect
        .element(buttonOf(confirmation, "Remove date"))
        .not.toHaveAttribute("aria-disabled");
      expect(dialog.getByText(message).query()).toBeNull();
    },
  );

  test("closes the confirmation of a removal that Sentinel refuses with 409 TICKET_NOT_CONFIDENTIAL, and shows it at the top of the form, as an error that takes the focus", async () => {
    const spy = showingRelease(
      { is_confidential: false },
      { ticketChange: () => errorResponse(409, "TICKET_NOT_CONFIDENTIAL") },
    );
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);
    await buttonOf(dialog, "Remove date").click();
    const confirmation = removeConfirmation(screen);

    await buttonOf(confirmation, "Remove date").click();

    await expect.element(confirmation).not.toBeInTheDocument();
    const error = dialog.getByText(NOT_CONFIDENTIAL, { exact: true });
    await expect.element(error).toBeVisible();
    expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES.danger);
    await expectFocusOnError(error);
    // Once the confirmation has given back the focus.
    await nextFrames();
    await expectFocusOnError(error);
    expect(boxOf(error).bottom).toBeLessThan(boxOf(fieldOf(dialog)).top);
    expect(dialog.getByText(/^Reference:/).query()).toBeNull();
    expect(releases(spy)).toEqual([{ coordinated_release_at: null }]);
  });

  test("shows a failure of the removal of the date of a confidential Ticket at the top of the form, which keeps the date", async () => {
    showingRelease(
      {},
      { ticketChange: () => errorResponse(503, "SERVICE_UNAVAILABLE") },
    );
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);

    await buttonOf(dialog, "Remove date").click();

    const error = dialog.getByText(MESSAGE_UNCONFIRMED, { exact: true });
    await expect.element(error).toBeVisible();
    expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES.warning);
    await expectFocusOnError(error);
    expect(shownIn(dialog)).toBe("25/11/2099, 13:00");
    await expect
      .element(buttonOf(dialog, "Remove date"))
      .not.toHaveAttribute("aria-disabled");
  });
});

describe("a failure of Save", () => {
  test("shows 409 TICKET_NOT_CONFIDENTIAL at the top of the form, as an error that names the Ticket, which takes the focus and keeps the input", async () => {
    showingRelease(
      { is_confidential: false, coordinated_release_at: SET_AT },
      { ticketChange: () => errorResponse(409, "TICKET_NOT_CONFIDENTIAL") },
    );
    const { screen } = await renderTicket();

    const dialog = await saveInstant(screen, LATER);

    const error = dialog.getByText(NOT_CONFIDENTIAL, { exact: true });
    await expect.element(error).toBeVisible();
    expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES.danger);
    await expectFocusOnError(error);
    expect(boxOf(error).bottom).toBeLessThan(boxOf(fieldOf(dialog)).top);
    expect(dialog.getByText(/^Reference:/).query()).toBeNull();
    expect(invalid(dialog)).toBe(false);
    expect(shownIn(dialog)).toBe("26/11/2099, 14:30");
  });

  test.each<[string, () => Response, string]>([
    [
      "422 TICKET_COORDINATED_RELEASE_BEFORE_CREATION, with the range that the field takes",
      () => errorResponse(422, "TICKET_COORDINATED_RELEASE_BEFORE_CREATION"),
      RANGE,
    ],
    [
      "a field error of a VALIDATION_ERROR for coordinated_release_at",
      () => validationError([["body", "coordinated_release_at"]]),
      MESSAGE_INVALID,
    ],
  ])(
    "shows %s at the field, which takes the focus, until the input changes",
    async (_, failure, message) => {
      showingRelease({}, { ticketChange: failure });
      const { screen } = await renderTicket();

      const dialog = await saveInstant(screen, LATER);

      const error = dialog.getByText(message, { exact: true });
      await expect.element(error).toBeVisible();
      expect(boxOf(error).top).toBeGreaterThan(boxOf(fieldOf(dialog)).bottom);
      expect(invalid(dialog)).toBe(true);
      await expect.element(partOf(dialog, 0)).toHaveFocus();
      expect(dialog.getByText(MESSAGE_NOT_ACCEPTED).query()).toBeNull();
      expect(shownIn(dialog)).toBe("26/11/2099, 14:30");

      await userEvent.keyboard("2");

      await expect.element(error).not.toBeInTheDocument();
      expect(invalid(dialog)).toBe(false);
    },
  );

  test.each<
    [
      string,
      () => Response | Promise<Response>,
      string,
      keyof typeof MESSAGE_TONES,
      boolean,
    ]
  >([
    [
      "a 409 with a code that the pinned contract does not list",
      () => errorResponse(409, "FICTIONAL_CONFLICT"),
      MESSAGE_CONFLICT,
      "danger",
      false,
    ],
    [
      "TICKET_NOT_CONFIDENTIAL with another status",
      () => errorResponse(400, "TICKET_NOT_CONFIDENTIAL"),
      MESSAGE_NOT_ACCEPTED,
      "danger",
      false,
    ],
    [
      "TICKET_COORDINATED_RELEASE_BEFORE_CREATION with another status",
      () => errorResponse(400, "TICKET_COORDINATED_RELEASE_BEFORE_CREATION"),
      MESSAGE_NOT_ACCEPTED,
      "danger",
      false,
    ],
    [
      "a 422 with a code that the pinned contract does not list",
      () => errorResponse(422, "FICTIONAL_INVALID"),
      MESSAGE_NOT_ACCEPTED,
      "danger",
      false,
    ],
    [
      "a VALIDATION_ERROR of no field of the form",
      () => validationError([["body"]]),
      MESSAGE_NOT_ACCEPTED,
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
      "a status and a code that the pinned contract does not list",
      () => errorResponse(418, "FICTIONAL_CODE"),
      MESSAGE_NOT_ACCEPTED,
      "danger",
      false,
    ],
    [
      "a 503, as a warning with its reference",
      () => errorResponse(503, "FICTIONAL_UNAVAILABLE"),
      MESSAGE_UNCONFIRMED,
      "warning",
      true,
    ],
    [
      "a network failure, as a warning",
      () => Promise.reject(new TypeError("Failed to fetch")),
      MESSAGE_UNCONFIRMED,
      "warning",
      false,
    ],
  ])(
    "shows %s at the top of the form, which takes the focus and keeps the input",
    async (_, failure, message, tone, referenced) => {
      const spy = showingRelease({}, { ticketChange: failure });
      const { screen } = await renderTicket();
      const reads = requestsTo(spy, TICKET);

      const dialog = await saveInstant(screen, LATER);

      const error = dialog.getByText(message, { exact: true });
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES[tone]);
      await expectFocusOnError(error);
      expect(boxOf(error).bottom).toBeLessThan(boxOf(fieldOf(dialog)).top);
      if (referenced) {
        await expect
          .element(dialog.getByText(REFERENCE, { exact: true }))
          .toBeVisible();
      } else {
        expect(dialog.getByText(/^Reference:/).query()).toBeNull();
      }
      expect(invalid(dialog)).toBe(false);
      expect(shownIn(dialog)).toBe("26/11/2099, 14:30");
      await expect
        .element(buttonOf(dialog, "Save"))
        .not.toHaveAttribute("aria-disabled");
      // Whatever its outcome, the screen reads again what it affects.
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    },
  );

  test("removes the error at the top of the form as the date is sent again", async () => {
    let fail = true;
    const response = later();
    const spy = showingRelease(
      {},
      {
        ticketChange: () =>
          fail ? errorResponse(409, "FICTIONAL_CONFLICT") : response.promise,
      },
    );
    const { screen } = await renderTicket();
    const dialog = await saveInstant(screen, LATER);
    const error = dialog.getByText(MESSAGE_CONFLICT, { exact: true });
    await expect.element(error).toBeVisible();
    fail = false;

    await buttonOf(dialog, "Save").click();

    // While the change that it sent again is in progress.
    await expect
      .element(buttonOf(dialog, "Save"))
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(error).not.toBeInTheDocument();
    expect(releases(spy)).toHaveLength(2);
    response.resolve(
      ticketResponse(
        fictionalTicketDetail({
          is_confidential: true,
          coordinated_release_at: new Date(LATER).toISOString(),
        }),
      ),
    );
    await expect.element(dialog).not.toBeInTheDocument();
  });

  test("leaves an answer that the UI cannot show to the page of a failure of the UI", async () => {
    // The answer of a later release that lacks the Ticket, whose date the
    // outcome cannot state.
    showingRelease({}, { ticketChange: () => jsonResponse(200, {}) });
    const { screen } = await renderTicket();

    await saveInstant(screen, LATER);

    await expect
      .element(
        screen.getByRole("heading", {
          level: 1,
          name: "Something went wrong",
        }),
      )
      .toBeVisible();
  });
});

describe("leaving the dialog of the Coordinated Release Date", () => {
  test("asks before Cancel discards another date and time, saying that the date isn't changed, keeps the input on Keep editing, and closes on Discard", async () => {
    const spy = showingRelease();
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);
    await typeInto(dialog, digitsOf(LATER));

    await buttonOf(dialog, "Cancel").click();

    const discard = discardDialog(screen);
    await expect
      .element(discard.getByText(DISCARD_CONSEQUENCE, { exact: true }))
      .toBeVisible();
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect.element(discard).not.toBeInTheDocument();
    await expect.element(dialog).toBeVisible();
    expect(shownIn(dialog)).toBe("26/11/2099, 14:30");

    await userEvent.keyboard("{Escape}");
    await expect.element(discard).toBeVisible();
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(pencilOf(screen));
    expect(releases(spy)).toEqual([]);
  });

  test("asks before Escape discards only some of the parts of a field that opened empty", async () => {
    showingRelease({ coordinated_release_at: null });
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);
    await typeInto(dialog, "25");

    await userEvent.keyboard("{Escape}");

    await expect
      .element(discardDialog(screen).getByText(DISCARD_CONSEQUENCE))
      .toBeVisible();
  });

  test.each(["Cancel", "Escape"])(
    "closes at once on %s with the date and time with which it opened, also after another was undone",
    async (way) => {
      showingRelease();
      const { screen } = await renderTicket();
      const dialog = await openRelease(screen);
      await typeInto(dialog, digitsOf(LATER));
      await typeInto(dialog, digitsOf(SET));

      if (way === "Escape") {
        await userEvent.keyboard("{Escape}");
      } else {
        await buttonOf(dialog, "Cancel").click();
      }

      await expect.element(dialog).not.toBeInTheDocument();
      expect(discardDialog(screen).query()).toBeNull();
      await expectFocusSettledOn(pencilOf(screen));
    },
  );
});

describe("the layout while the dialog is open", () => {
  test("waits while the dialog is open for a window that becomes too narrow for two columns, keeping the details in the side column and the input in the dialog, and moves the details above the parts once it closes", async () => {
    showingRelease();
    const { screen } = await renderTicket();
    expect(inSideColumn(screen)).toBe(true);
    const dialog = await openRelease(screen);
    await typeInto(dialog, digitsOf(LATER));
    const width = cveBox(screen).width;

    await page.viewport(900, 800);

    // The main column takes the width that the window leaves it, beside the
    // side column.
    await expect.poll(() => cveBox(screen).width).toBeLessThan(width);
    await nextFrames();
    expect(inSideColumn(screen)).toBe(true);
    await expect.element(dialog).toBeVisible();
    expect(shownIn(dialog)).toBe("26/11/2099, 14:30");

    await buttonOf(dialog, "Cancel").click();
    await discardDialog(screen)
      .getByRole("button", { name: "Discard", exact: true })
      .click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.poll(() => aboveParts(screen)).toBe(true);
    // The focus, which returned to the pencil in the details, moves to the
    // screen's heading as they move.
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("waits while the dialog is open for a window that becomes wide enough for two columns, keeping the details above the parts, and moves them to the side column once it closes", async () => {
    await page.viewport(900, 800);
    showingRelease();
    const { screen } = await renderTicket();
    expect(aboveParts(screen)).toBe(true);
    const dialog = await openRelease(screen);
    const width = cveBox(screen).width;

    await page.viewport(1280, 800);

    await expect.poll(() => cveBox(screen).width).toBeGreaterThan(width);
    await nextFrames();
    expect(aboveParts(screen)).toBe(true);
    await expect.element(dialog).toBeVisible();

    await buttonOf(dialog, "Cancel").click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.poll(() => inSideColumn(screen)).toBe(true);
  });

  test("waits while the dialog is open for a larger text size, which leaves too little room for two columns, and follows it once the dialog closes", async () => {
    showingRelease();
    const { screen } = await renderTicket();
    const dialog = await openRelease(screen);
    const width = cveBox(screen).width;

    try {
      document.documentElement.style.fontSize = "20px";

      await expect.poll(() => cveBox(screen).width).not.toBe(width);
      await nextFrames();
      expect(inSideColumn(screen)).toBe(true);
      await expect.element(dialog).toBeVisible();

      await buttonOf(dialog, "Cancel").click();

      await expect.element(dialog).not.toBeInTheDocument();
      await expect.poll(() => aboveParts(screen)).toBe(true);
    } finally {
      document.documentElement.style.removeProperty("font-size");
    }
  });

  test("keeps the change in progress while the layout waits, and follows the width once Sentinel confirms it and the dialog closes", async () => {
    const response = later();
    showingRelease({}, { ticketChange: () => response.promise });
    const { screen } = await renderTicket();
    const dialog = await saveInstant(screen, LATER);
    await expect
      .element(buttonOf(dialog, "Save"))
      .toHaveAttribute("aria-disabled", "true");
    const width = cveBox(screen).width;

    await page.viewport(900, 800);

    await expect.poll(() => cveBox(screen).width).toBeLessThan(width);
    await nextFrames();
    expect(inSideColumn(screen)).toBe(true);
    await expect
      .element(buttonOf(dialog, "Save"))
      .toHaveAttribute("aria-disabled", "true");

    response.resolve(
      ticketResponse(
        fictionalTicketDetail({
          is_confidential: true,
          coordinated_release_at: new Date(LATER).toISOString(),
        }),
      ),
    );

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.poll(() => aboveParts(screen)).toBe(true);
    await expect
      .poll(() => announcements(screen))
      .toContain(
        `Coordinated Release Date set to ${formatDateTime(new Date(LATER).toISOString())}.`,
      );
  });
});

describe("the outcome of a change of the Coordinated Release Date", () => {
  test("reads again the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, and the reads of the Ticket list", async () => {
    const spy = showingRelease(
      { packages: [fictionalPackage()] },
      {
        user: {
          data: {
            ...MAINTAINER.data,
            capabilities: ["manage_confidentiality"],
          },
        },
      },
    );
    const { screen } = await renderTicket();
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      actors: requestsTo(spy, ACTORS),
      work: requestsTo(spy, YOUR_WORK),
    };
    // The user saw the Ticket list and Audit log before, which wait in the
    // cache.
    client.setQueryData([EVENTS], {});
    client.setQueryData([TICKETS, { page: 1 }], {});

    await saveInstant(screen, LATER);

    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(reads.work + 1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    expect(leftInvalidated(EVENTS)).toBe(true);
    expect(leftInvalidated(TICKETS)).toBe(true);
  });

  test("shows the outcome in the message area when the read of the Ticket after it fails", async () => {
    let changed = false;
    showingRelease(
      {},
      {
        ticket: () =>
          changed
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : ticketResponse(
                fictionalTicketDetail({
                  is_confidential: true,
                  coordinated_release_at: SET_AT,
                }),
              ),
        ticketChange: (_, body) => {
          changed = true;
          return ticketResponse(
            fictionalTicketDetail({
              is_confidential: true,
              coordinated_release_at: releaseIn(body),
            }),
          );
        },
      },
    );
    const { screen } = await renderTicket();

    await saveInstant(screen, LATER);

    await expectSuccessMessage(
      screen,
      `Coordinated Release Date set to ${formatDateTime(new Date(LATER).toISOString())}.`,
    );
    expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
  });

  test.each(LEFT)(
    "shows %s that ends after the user left the tab in the message area of the Ticket screen, which it does not name",
    async (_, action, answer, text, tone) => {
      const response = later();
      showingRelease({}, { ticketChange: () => response.promise });
      const { router, screen } = await renderTicket();
      await startChange(screen, action);

      await router.navigate({
        to: "/tickets/$ticketId/audit-log",
        params: { ticketId: "SNTL-12" },
      });
      await expect
        .element(screen.getByRole("tabpanel", { name: "Audit log" }))
        .toBeVisible();
      response.resolve(answer());

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES[tone]);
      expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
      expect(announcements(screen)).not.toContain(text);
    },
  );

  test.each(LEFT)(
    "shows %s that ends after the user left the screen in the message area, naming the Ticket with a link to it",
    async (_, action, answer, text, tone) => {
      const response = later();
      showingRelease({}, { ticketChange: () => response.promise });
      const { router, screen } = await renderTicket();
      await startChange(screen, action);

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
});
