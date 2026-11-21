import { describe, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import type { TicketSummary } from "../../api/generated/model";
import { SEARCH_DELAY_MS } from "../../components/search-combobox";
import {
  errorResponse,
  fictionalPackage,
  fictionalTicket,
  fictionalTicketDetail,
  jsonResponse,
  OTHER_USER,
  requestsTo,
  stubApi,
  ticketPage,
  ticketResponse,
  urlOf,
  validationError,
} from "../../test-api";
import { pointerAwayFrom } from "../../test-pointer";
import {
  ACTORS,
  announcements,
  backgroundBehind,
  boxOf,
  client,
  EVENTS,
  expectFocusOnError,
  expectFocusSettledOn,
  expectSuccessMessage,
  FG_MUTED,
  later,
  leaveForTickets,
  leftInvalidated,
  MAINTAINER,
  MESSAGE_CONFLICT,
  MESSAGE_INVALID,
  MESSAGE_NOT_ACCEPTED,
  MESSAGE_TONES,
  MESSAGE_UNAVAILABLE,
  MESSAGE_UNCONFIRMED,
  nextFrames,
  prepareEachTest,
  readEnded,
  REFERENCE,
  renderApp,
  renderTicket,
  type Screen,
  type Stub,
  stubTicket,
  textsOf,
  TICKET,
  TICKETS,
  YOUR_WORK,
} from "../ticket-overview/test-support";
import { typedTicketId } from "./mark-duplicate";

// Mark as duplicate…, the dialog that Actions opens in the heading row of
// the Ticket screen (src/routes/ticket/mark-duplicate.tsx;
// docs/screens/ticket.md, Actions), shown over Overview, at the browser's
// default text size, in the light theme.

prepareEachTest();

// What the field of the original says that it takes.
const DESCRIPTION =
  "Type its identifier, its CVE ID, or the name of one of its packages to find it.";
const EXPLANATION =
  "SNTL-12 becomes a duplicate of the Ticket that you choose, and accepts no other change until Revert duplicate.";
const DUPLICATES_UNKNOWN =
  "Its duplicates, if it has any, become duplicates of that Ticket too.";

const MESSAGE_EMPTY = "Choose the original Ticket.";
const MESSAGE_NOT_AN_ID =
  "Choose a Ticket, or enter its identifier, such as SNTL-42.";
const MESSAGE_ITSELF = "A Ticket can't be a duplicate of itself.";
const MESSAGE_DUPLICATES_BUSY =
  "A duplicate of this Ticket was being changed at the same time, so Sentinel changed nothing. Try again.";
const MESSAGE_INTERNAL =
  "Something went wrong in Sentinel. Try again, and if it happens again, report it with the reference below.";
const MESSAGE_FORBIDDEN = "You don't have permission to do this.";

// The outcome of a mark of SNTL-12 as a duplicate of SNTL-21.
const MARKED = "Marked as a duplicate of SNTL-21.";

// The color of a primary button in the light theme (docs/design-system.md,
// Buttons and Links): accent.
const ACCENT = "rgb(9, 105, 218)";

const DUPLICATE = `${TICKET}/duplicate`;

// A Ticket as List Tickets returns it, with the identifier and the fields
// that a test sets.
function summary(
  ticketId: string,
  fields: Partial<TicketSummary> = {},
): TicketSummary {
  return fictionalTicket({ ticket_id: ticketId, ...fields });
}

// The CVE of a Ticket as List Tickets returns it, with its title.
function cveOf(
  cveId: string,
  title: string | null = `Fictional flaw ${cveId}`,
) {
  return { cve_id: cveId, title, description: null, cna: null };
}

// SNTL-21, New, a Ticket that the field offers as the original.
const ORIGINAL = summary("SNTL-21", { cve: cveOf("CVE-2099-0021") });

// A page of List Tickets whose Tickets can hold a status that the pinned
// contract does not list, which a later Sentinel release can return.
function searchPage(
  tickets: (Omit<TicketSummary, "status"> & { status: string })[],
): Response {
  return jsonResponse(200, {
    data: tickets,
    meta: { total: tickets.length, page: 1, per_page: 20 },
  });
}

// SNTL-12 Duplicated, in a response that does not give its original, as the
// answer to the change and to the read after it.
function markedWithoutOriginal(): Response {
  return ticketResponse(
    fictionalTicketDetail({
      status: "duplicated",
      duplicate_of_ticket_id: null,
    }),
  );
}

interface Reads {
  // The response to the read of the duplicates of SNTL-12.
  duplicates?: () => Response | Promise<Response>;
  // The response to the search of the field, given its query.
  search?: (query: URLSearchParams) => Response | Promise<Response>;
}

// Answers for the analyst, who holds triage_ticket, with SNTL-12 Analyzed,
// the read of its duplicates, by default without any, and the search of the
// field, by default with SNTL-21 alone, and the other responses that the test
// sets.
function showingMarkable(
  {
    duplicates = () => ticketPage([]),
    search = () => ticketPage([ORIGINAL]),
  }: Reads = {},
  stub: Partial<Stub> = {},
) {
  return stubTicket({
    user: OTHER_USER,
    duplicates: (query) => (query.has("search") ? search(query) : duplicates()),
    ...stub,
  });
}

// Answers as showingMarkable does, with the search of the field as the test
// sets it, the duplicates of SNTL-12 without any, and 409
// TICKET_DUPLICATE_TARGET_DUPLICATED to Mark Ticket as Duplicate; and the
// reads of the Ticket list screen, which have neither a search nor the
// duplicates of a Ticket, with SNTL-12 and SNTL-41, a duplicate of SNTL-40
// when that list was read.
function showingAfterTicketList(search: (query: URLSearchParams) => Response) {
  return stubTicket({
    user: OTHER_USER,
    duplicates: (query) => {
      if (query.has("search")) {
        return search(query);
      }
      if (query.has("duplicate_of_ticket_id")) {
        return ticketPage([]);
      }
      return ticketPage([
        summary("SNTL-12", { status: "analyzed" }),
        summary("SNTL-41", {
          status: "duplicated",
          duplicate_of_ticket_id: "SNTL-40",
        }),
      ]);
    },
    ticketChange: () =>
      errorResponse(409, "TICKET_DUPLICATE_TARGET_DUPLICATED"),
  });
}

// Renders the Ticket list, once it shows SNTL-41, and opens SNTL-12 from it,
// as the user does: the read of the list stays in the query client, in which
// the screen of the Ticket finds it.
async function renderTicketFromList() {
  const rendered = await renderApp("/tickets");
  const list = rendered.screen.getByRole("grid", { name: "Tickets" });
  await expect
    .element(list.getByRole("link", { name: "SNTL-41", exact: true }))
    .toBeVisible();
  await list.getByRole("link", { name: "SNTL-12", exact: true }).click();
  await expect
    .element(
      rendered.screen.getByRole("heading", {
        level: 1,
        name: "SNTL-12",
        exact: true,
      }),
    )
    .toBeVisible();
  return rendered;
}

function actionsButton(screen: Screen) {
  return screen.getByRole("button", {
    name: "Actions of SNTL-12",
    exact: true,
  });
}

function markDialog(screen: Screen) {
  return screen.getByRole("dialog", {
    name: "Mark SNTL-12 as a duplicate",
    exact: true,
  });
}

function discardDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Discard changes?" });
}

function originalField(dialog: Locator) {
  return dialog.getByRole("combobox", { name: "Original", exact: true });
}

function submitButton(dialog: Locator) {
  return dialog.getByRole("button", {
    name: "Mark as duplicate",
    exact: true,
  });
}

function cancelButton(dialog: Locator) {
  return dialog.getByRole("button", { name: "Cancel", exact: true });
}

// The option of a Ticket, by its identifier.
function optionOf(screen: Screen, ticketId: string) {
  return screen
    .getByRole("option")
    .filter({ has: page.getByText(ticketId, { exact: true }) });
}

// The identifiers of the options, in their order.
function optionIds(screen: Screen): (string | undefined)[] {
  return textsOf(screen.getByRole("option")).map(
    (text) => /^SNTL-\d+/.exec(text ?? "")?.[0],
  );
}

// Opens Mark as duplicate… from Actions and waits until its field has the
// focus.
async function openMark(screen: Screen) {
  await actionsButton(screen).click();
  await screen
    .getByRole("menuitem", { name: "Mark as duplicate…", exact: true })
    .click();
  const dialog = markDialog(screen);
  await expect.element(originalField(dialog)).toHaveFocus();
  return dialog;
}

// Submits the form from the keyboard, from its field: Tab leaves the field
// for Cancel, which closes the menu of the field, which keeps the rest of the
// dialog from assistive technologies while it is open, and then for Mark as
// duplicate.
async function submitFromField(dialog: Locator) {
  await expect.element(originalField(dialog)).toHaveFocus();
  await userEvent.keyboard("{Tab}");
  await expect.element(cancelButton(dialog)).toHaveFocus();
  await userEvent.keyboard("{Tab}");
  await expect.element(submitButton(dialog)).toHaveFocus();
  await userEvent.keyboard("{Enter}");
}

// Opens Mark as duplicate…, types the original, and submits it.
async function markAs(screen: Screen, original: string) {
  const dialog = await openMark(screen);
  await originalField(dialog).fill(original);
  await submitFromField(dialog);
  return dialog;
}

// The bodies of the requests of Mark Ticket as Duplicate.
function marks(spy: ReturnType<typeof stubApi>): unknown[] {
  return spy.mock.calls
    .filter(
      ([input, init]) =>
        init?.method === "POST" && urlOf(input).pathname === DUPLICATE,
    )
    .map(([, init]) =>
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    );
}

// The queries of the searches of the field.
function searches(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname === TICKETS && url.searchParams.has("search"))
    .map((url) => url.search);
}

// How many reads of the duplicates of SNTL-12 the spy received.
function duplicatesReads(spy: ReturnType<typeof stubApi>): number {
  return spy.mock.calls.filter(([input]) => {
    const url = urlOf(input);
    return (
      url.pathname === TICKETS &&
      url.searchParams.get("duplicate_of_ticket_id") === "SNTL-12"
    );
  }).length;
}

describe("typedTicketId", () => {
  test.each([
    ["SNTL-42", "SNTL-42"],
    ["sntl-42", "SNTL-42"],
    ["Sntl-42", "SNTL-42"],
    ["42", "SNTL-42"],
    ["1", "SNTL-1"],
    ["SNTL-2147483647", "SNTL-2147483647"],
    ["2147483647", "SNTL-2147483647"],
  ])("reads %s as %s", (text, id) => {
    expect(typedTicketId(text)).toBe(id);
  });

  test.each([
    ["an empty text", ""],
    ["a leading zero", "SNTL-0042"],
    ["a number with a leading zero", "0042"],
    ["zero", "0"],
    ["the identifier zero", "SNTL-0"],
    ["the prefix alone", "SNTL-"],
    ["a word", "abc"],
    ["a number above 2147483647", "SNTL-2147483648"],
    ["a long number above 2147483647", "99999999999999999999"],
    ["surrounding whitespace, which the form removes first", " 42 "],
    ["a space after the prefix", "SNTL- 42"],
    ["another separator", "SNTL_42"],
    ["a suffix", "SNTL-42a"],
    ["a negative number", "-42"],
    ["a decimal number", "42.0"],
    ["an exponent", "4e2"],
    ["digits of another script", "SNTL-٤٢"],
    ["a UUID", "00000000-0000-0000-0000-000000000042"],
  ])("reads %s as no identifier", (_, text) => {
    expect(typedTicketId(text)).toBeUndefined();
  });
});

describe("the dialog of Mark as duplicate…", () => {
  test("says what the change does, then shows Original, a combobox that takes the focus and says what it takes, then Cancel and Mark as duplicate, a primary button, at most 560 px wide", async () => {
    showingMarkable();
    const { screen } = await renderTicket();

    const dialog = await openMark(screen);

    const explanation = dialog.getByText(EXPLANATION, { exact: true });
    await expect.element(explanation).toBeVisible();
    expect(getComputedStyle(explanation.element()).color).toBe(FG_MUTED);
    const field = originalField(dialog);
    await expect.element(field).toHaveValue("");
    await expect.element(field).toHaveAccessibleDescription(DESCRIPTION);
    expect(boxOf(explanation).bottom).toBeLessThan(boxOf(field).top);
    expect(dialog.getByRole("combobox").elements()).toHaveLength(1);
    expect(textsOf(dialog.getByRole("button"))).toEqual([
      "Cancel",
      "Mark as duplicate",
    ]);
    await pointerAwayFrom(submitButton(dialog));
    expect(
      getComputedStyle(submitButton(dialog).element()).backgroundColor,
    ).toBe(ACCENT);
    expect(boxOf(dialog).width).toBe(560);
  });

  test("keeps Original and its options at most 448 px wide, as a field of a form is, while what the dialog says takes its whole width", async () => {
    showingMarkable();
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);
    const field = originalField(dialog);

    expect(boxOf(dialog).width).toBe(560);
    expect(boxOf(field).width).toBe(448);
    // The explanation spans the dialog, to the end of its buttons, beyond
    // the end of the field, to within the rounding of a browser.
    const explanation = boxOf(dialog.getByText(EXPLANATION, { exact: true }));
    expect(explanation.left).toBeCloseTo(boxOf(field).left, 0);
    expect(explanation.right).toBeCloseTo(boxOf(submitButton(dialog)).right, 0);
    expect(explanation.width).toBeGreaterThan(448);

    await field.fill("21");

    // The options open below the field, within its width.
    await expect.element(optionOf(screen, "SNTL-21")).toBeVisible();
    const options = boxOf(screen.getByRole("listbox"));
    expect(options.top).toBeGreaterThan(boxOf(field).bottom);
    expect(options.left).toBeGreaterThanOrEqual(boxOf(field).left);
    expect(options.right).toBeLessThanOrEqual(boxOf(field).right);
  });

  test.each([
    [
      "two duplicates",
      () =>
        ticketPage([
          summary("SNTL-22", { status: "duplicated" }),
          summary("SNTL-32", { status: "duplicated" }),
        ]),
      "SNTL-22 and SNTL-32, its duplicates, become duplicates of that Ticket too.",
    ],
    [
      "one duplicate",
      () => ticketPage([summary("SNTL-22", { status: "duplicated" })]),
      "SNTL-22, its duplicate, becomes a duplicate of that Ticket too.",
    ],
    [
      "more duplicates than the page of their read",
      () =>
        ticketPage(
          [
            summary("SNTL-22", { status: "duplicated" }),
            summary("SNTL-32", { status: "duplicated" }),
          ],
          { total: 5 },
        ),
      "SNTL-22, SNTL-32, and 3 more, its duplicates, become duplicates of that Ticket too.",
    ],
    [
      "one duplicate on a page that holds more",
      () =>
        ticketPage([summary("SNTL-22", { status: "duplicated" })], {
          total: 3,
        }),
      "SNTL-22 and 2 more, its duplicates, become duplicates of that Ticket too.",
    ],
    [
      "duplicates whose number has thousands",
      () =>
        ticketPage(
          [
            summary("SNTL-22", { status: "duplicated" }),
            summary("SNTL-32", { status: "duplicated" }),
          ],
          { total: 1236 },
        ),
      "SNTL-22, SNTL-32, and 1,234 more, its duplicates, become duplicates of that Ticket too.",
    ],
  ])(
    "says what the change does to the visible duplicates of the Ticket, for %s",
    async (_, duplicates, text) => {
      showingMarkable({ duplicates });
      const { screen } = await renderTicket();

      const dialog = await openMark(screen);

      const sentence = dialog.getByText(text, { exact: true });
      await expect.element(sentence).toBeVisible();
      expect(getComputedStyle(sentence.element()).color).toBe(FG_MUTED);
      expect(boxOf(dialog.getByText(EXPLANATION)).bottom).toBeLessThanOrEqual(
        boxOf(sentence).top,
      );
      expect(dialog.getByText(DUPLICATES_UNKNOWN).query()).toBeNull();
    },
  );

  test("says nothing of the duplicates of a Ticket without visible duplicates", async () => {
    const spy = showingMarkable();
    const { screen } = await renderTicket();
    await expect.poll(() => duplicatesReads(spy)).toBe(1);
    await readEnded(TICKETS);

    const dialog = await openMark(screen);

    await nextFrames();
    await expect.element(dialog.getByText(EXPLANATION)).toBeVisible();
    expect(dialog.getByText(/that Ticket too\.$/).query()).toBeNull();
  });

  test("says that the duplicates, if any, move too until the read of the duplicates arrives, then names them", async () => {
    const response = later();
    showingMarkable({ duplicates: () => response.promise });
    const { screen } = await renderTicket();

    const dialog = await openMark(screen);

    await expect
      .element(dialog.getByText(DUPLICATES_UNKNOWN, { exact: true }))
      .toBeVisible();
    response.resolve(
      ticketPage([summary("SNTL-22", { status: "duplicated" })]),
    );
    await expect
      .element(
        dialog.getByText(
          "SNTL-22, its duplicate, becomes a duplicate of that Ticket too.",
          { exact: true },
        ),
      )
      .toBeVisible();
    expect(dialog.getByText(DUPLICATES_UNKNOWN).query()).toBeNull();
  });

  test.each([
    ["500", () => errorResponse(500, "INTERNAL_ERROR")],
    [
      "a status and a code that the pinned contract does not list",
      () => errorResponse(418, "FICTIONAL_CODE"),
    ],
  ])(
    "says that the duplicates, if any, move too when the read of the duplicates fails with %s",
    async (_, duplicates) => {
      const spy = showingMarkable({ duplicates });
      const { screen } = await renderTicket();
      await expect.poll(() => duplicatesReads(spy)).toBeGreaterThan(0);
      await readEnded(TICKETS);

      const dialog = await openMark(screen);

      await expect
        .element(dialog.getByText(DUPLICATES_UNKNOWN, { exact: true }))
        .toBeVisible();
    },
  );

  test("reads the duplicates itself on a tab that does not show them", async () => {
    const spy = showingMarkable({
      duplicates: () =>
        ticketPage([
          summary("SNTL-22", { status: "duplicated" }),
          summary("SNTL-32", { status: "duplicated" }),
        ]),
    });
    const { screen } = await renderTicket("/tickets/SNTL-12/audit-log");
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    expect(duplicatesReads(spy)).toBe(0);

    const dialog = await openMark(screen);

    await expect
      .element(
        dialog.getByText(
          "SNTL-22 and SNTL-32, its duplicates, become duplicates of that Ticket too.",
          { exact: true },
        ),
      )
      .toBeVisible();
    expect(duplicatesReads(spy)).toBe(1);
  });
});

describe("the suggestions of Original", () => {
  test.each([
    ["1 character", "2"],
    ["1 character within surrounding whitespace", " 2 "],
  ])("are not read for %s, and no menu opens", async (_, text) => {
    const spy = showingMarkable();
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    // The clock of the pause, which the test moves past its end itself.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    await originalField(dialog).fill(text);
    vi.advanceTimersByTime(SEARCH_DELAY_MS);
    vi.useRealTimers();

    await expect.element(originalField(dialog)).toHaveValue(text);
    await nextFrames();
    expect(searches(spy)).toEqual([]);
    expect(screen.getByRole("listbox").query()).toBeNull();
  });

  test("are read once the user stops typing, with the term without its surrounding whitespace, by identifier, at most 20, and listed in the order of the response", async () => {
    const spy = showingMarkable({
      search: () =>
        ticketPage([
          summary("SNTL-21", { cve: cveOf("CVE-2099-0021") }),
          summary("SNTL-210", { cve: cveOf("CVE-2099-0210") }),
          summary("SNTL-1021", { cve: cveOf("CVE-2099-1021") }),
        ]),
    });
    const { screen } = await renderTicket();
    await openMark(screen);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    // The clock of the pause, which the test moves itself, so that the time
    // between two inputs does not depend on the speed of the browser. The
    // keyboard types without moving it.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    await userEvent.keyboard(" 2");
    vi.advanceTimersByTime(SEARCH_DELAY_MS - 1);
    await userEvent.keyboard("1 ");
    vi.advanceTimersByTime(SEARCH_DELAY_MS - 1);
    await nextFrames();
    expect(searches(spy)).toEqual([]);
    vi.advanceTimersByTime(1);
    vi.useRealTimers();

    await expect.element(optionOf(screen, "SNTL-1021")).toBeVisible();
    expect(optionIds(screen)).toEqual(["SNTL-21", "SNTL-210", "SNTL-1021"]);
    expect(searches(spy)).toEqual([
      "?search=21&sort_by=ticket_id&sort_order=asc&per_page=20",
    ]);
  });

  test("show each Ticket on two lines: its identifier at weight 500, the lock of a confidential one, its status, and the label of one that the field does not offer; below them its CVE ID and the title of its CVE, or No CVE and its packages, in text-13, fg-muted, on one line", async () => {
    showingMarkable({
      search: () =>
        searchPage([
          summary("SNTL-12", {
            status: "analyzed",
            cve: cveOf("CVE-2099-0012"),
          }),
          summary("SNTL-13", {
            status: "analysis",
            is_confidential: true,
            cve: cveOf("CVE-2099-0013"),
          }),
          summary("SNTL-14", {
            status: "new",
            cve: cveOf("CVE-2099-0014", null),
          }),
          summary("SNTL-15", {
            status: "resolved",
            cve: null,
            package_names: ["fictional-lz4"],
          }),
          summary("SNTL-16", {
            status: "ignored",
            cve: null,
            package_names: ["fictional-lz4", "fictional-zstd"],
          }),
          summary("SNTL-17", { status: "new", cve: null, package_names: [] }),
          summary("SNTL-18", {
            status: "duplicated",
            duplicate_of_ticket_id: "SNTL-21",
            cve: cveOf("CVE-2099-0018"),
          }),
          {
            ...summary("SNTL-19", { cve: cveOf("CVE-2099-0019") }),
            status: "fictional_status",
          },
        ]),
    });
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);

    await originalField(dialog).fill("fictional");

    await expect.element(optionOf(screen, "SNTL-19")).toBeVisible();
    const lines: [string, string, string][] = [
      ["SNTL-12", "Analyzed", "CVE-2099-0012 · Fictional flaw CVE-2099-0012"],
      ["SNTL-13", "Analysis", "CVE-2099-0013 · Fictional flaw CVE-2099-0013"],
      ["SNTL-14", "New", "CVE-2099-0014"],
      ["SNTL-15", "Resolved", "No CVE · fictional-lz4"],
      ["SNTL-16", "Ignored", "No CVE · fictional-lz4, fictional-zstd"],
      ["SNTL-17", "New", "No CVE"],
      ["SNTL-18", "Duplicated", "CVE-2099-0018 · Fictional flaw CVE-2099-0018"],
      [
        "SNTL-19",
        "fictional_status",
        "CVE-2099-0019 · Fictional flaw CVE-2099-0019",
      ],
    ];
    expect(optionIds(screen)).toEqual(lines.map(([id]) => id));
    for (const [id, status, about] of lines) {
      const option = optionOf(screen, id);
      const identifier = option.getByText(id, { exact: true });
      expect(getComputedStyle(identifier.element()).fontWeight).toBe("500");
      await expect
        .element(option.getByText(status, { exact: true }))
        .toBeVisible();
      const second = option.getByText(about, { exact: true });
      await expect.element(second).toBeVisible();
      const style = getComputedStyle(second.element());
      expect([style.fontSize, style.color, style.whiteSpace]).toEqual([
        "13px",
        FG_MUTED,
        "nowrap",
      ]);
      expect(style.textOverflow).toBe("ellipsis");
      expect(boxOf(identifier).bottom).toBeLessThanOrEqual(boxOf(second).top);
    }
    await expect
      .element(
        optionOf(screen, "SNTL-13").getByRole("img", { name: "Confidential" }),
      )
      .toBeVisible();
    expect(
      screen.getByRole("img", { name: "Confidential" }).elements(),
    ).toHaveLength(1);
  });

  test("list the Ticket itself and a Duplicated Ticket disabled, with the label that says why, and offer the others", async () => {
    showingMarkable({
      search: () =>
        ticketPage([
          summary("SNTL-12", { status: "analyzed" }),
          summary("SNTL-17", {
            status: "duplicated",
            duplicate_of_ticket_id: "SNTL-21",
          }),
          ORIGINAL,
        ]),
    });
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);

    await originalField(dialog).fill("fictional");

    const itself = optionOf(screen, "SNTL-12");
    await expect.element(itself).toBeVisible();
    await expect.element(itself).toHaveAttribute("aria-disabled", "true");
    await expect
      .element(itself.getByText("This Ticket", { exact: true }))
      .toBeVisible();
    const duplicate = optionOf(screen, "SNTL-17");
    await expect.element(duplicate).toHaveAttribute("aria-disabled", "true");
    await expect
      .element(duplicate.getByText("Duplicate of SNTL-21", { exact: true }))
      .toBeVisible();
    await expect
      .element(optionOf(screen, "SNTL-21"))
      .not.toHaveAttribute("aria-disabled");
    expect(
      screen.getByText(/^(This Ticket|Duplicate of )/).elements(),
    ).toHaveLength(2);

    // The arrow keys pass over the options that the field does not offer.
    await userEvent.keyboard("{ArrowDown}{Enter}");

    await expect.element(originalField(dialog)).toHaveValue("SNTL-21");

    // A press of an option that the field does not offer chooses nothing.
    await originalField(dialog).fill("fictional");
    await expect.element(itself).toBeVisible();
    await itself.click({ force: true });
    await nextFrames();
    await expect.element(originalField(dialog)).toHaveValue("fictional");
  });

  test("list a duplicate of the Ticket itself disabled, with the label Duplicate of this Ticket, and a duplicate of another Ticket with the label of its original", async () => {
    showingMarkable({
      search: () =>
        ticketPage([
          summary("SNTL-22", {
            status: "duplicated",
            duplicate_of_ticket_id: "SNTL-12",
          }),
          summary("SNTL-32", {
            status: "duplicated",
            duplicate_of_ticket_id: "SNTL-21",
          }),
          ORIGINAL,
        ]),
    });
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);

    await originalField(dialog).fill("fictional");

    const own = optionOf(screen, "SNTL-22");
    await expect.element(own).toBeVisible();
    await expect.element(own).toHaveAttribute("aria-disabled", "true");
    await expect
      .element(own.getByText("Duplicate of this Ticket", { exact: true }))
      .toBeVisible();
    const other = optionOf(screen, "SNTL-32");
    await expect.element(other).toHaveAttribute("aria-disabled", "true");
    await expect
      .element(other.getByText("Duplicate of SNTL-21", { exact: true }))
      .toBeVisible();
    expect(
      textsOf(screen.getByRole("listbox").getByText(/^Duplicate of /)),
    ).toEqual(["Duplicate of this Ticket", "Duplicate of SNTL-21"]);
    await expect
      .element(optionOf(screen, "SNTL-21"))
      .not.toHaveAttribute("aria-disabled");
  });

  test("offer a Ticket of a status that the pinned contract does not list, since Sentinel decides, which the user can choose and send", async () => {
    const spy = showingMarkable({
      search: () =>
        searchPage([
          {
            ...summary("SNTL-19", { cve: cveOf("CVE-2099-0019") }),
            status: "fictional_status",
          },
        ]),
    });
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);
    await originalField(dialog).fill("19");

    const option = optionOf(screen, "SNTL-19");
    await expect
      .element(option.getByText("fictional_status", { exact: true }))
      .toBeVisible();
    await expect.element(option).not.toHaveAttribute("aria-disabled");
    expect(textsOf(option.getByText(/^(This Ticket|Duplicate)/))).toEqual([]);

    await userEvent.keyboard("{ArrowDown}{Enter}");

    await expect.element(originalField(dialog)).toHaveValue("SNTL-19");
    await submitFromField(dialog);
    await expect.element(dialog).not.toBeInTheDocument();
    expect(marks(spy)).toEqual([{ duplicate_of_ticket_id: "SNTL-19" }]);
  });

  test("list a Duplicated Ticket whose original the response does not give disabled, with the label Duplicate", async () => {
    showingMarkable({
      search: () =>
        ticketPage([
          summary("SNTL-17", {
            status: "duplicated",
            duplicate_of_ticket_id: null,
          }),
          ORIGINAL,
        ]),
    });
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);

    await originalField(dialog).fill("fictional");

    const duplicate = optionOf(screen, "SNTL-17");
    await expect.element(duplicate).toHaveAttribute("aria-disabled", "true");
    await expect
      .element(duplicate.getByText("Duplicate", { exact: true }))
      .toBeVisible();
    expect(screen.getByText(/^Duplicate of /).query()).toBeNull();
  });

  test("write the identifier of the Ticket chosen in the field, which Mark as duplicate sends", async () => {
    const spy = showingMarkable();
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);
    await originalField(dialog).fill("fictional-openssl");

    await optionOf(screen, "SNTL-21").click();

    await expect.element(originalField(dialog)).toHaveValue("SNTL-21");
    await submitFromField(dialog);
    await expect.element(dialog).not.toBeInTheDocument();
    expect(marks(spy)).toEqual([{ duplicate_of_ticket_id: "SNTL-21" }]);
  });

  test("say that no Ticket matches", async () => {
    showingMarkable({ search: () => ticketPage([]) });
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);

    await originalField(dialog).fill("fictional-none");

    await expect
      .element(screen.getByText("No Tickets match.", { exact: true }))
      .toBeVisible();
    expect(screen.getByRole("option").elements()).toHaveLength(0);
  });

  test("say how many Tickets match when more match than they list", async () => {
    const tickets = Array.from({ length: 20 }, (_, index) =>
      summary(`SNTL-${index + 100}`),
    );
    showingMarkable({ search: () => ticketPage(tickets, { total: 63 }) });
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);

    await originalField(dialog).fill("fictional");

    await expect.element(optionOf(screen, "SNTL-100")).toBeVisible();
    expect(screen.getByRole("option").elements()).toHaveLength(20);
    await expect
      .element(
        screen.getByText(
          "The first 20 of 63 Tickets that match. Type more to narrow them.",
          { exact: true },
        ),
      )
      .toBeVisible();
  });

  test("say nothing of a count when they list every Ticket that matches", async () => {
    showingMarkable();
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);

    await originalField(dialog).fill("21");

    await expect.element(optionOf(screen, "SNTL-21")).toBeVisible();
    await nextFrames();
    expect(screen.getByText(/Tickets that match/).query()).toBeNull();
    expect(screen.getByText("No Tickets match.").query()).toBeNull();
  });

  test("show the loading indicator while they load", async () => {
    const response = later();
    const spy = showingMarkable({ search: () => response.promise });
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);

    await originalField(dialog).fill("21");

    await expect.poll(() => searches(spy)).toHaveLength(1);
    const loading = screen.getByRole("progressbar", { name: "Loading" });
    await expect.element(loading).toBeVisible();
    response.resolve(ticketPage([ORIGINAL]));
    await expect.element(optionOf(screen, "SNTL-21")).toBeVisible();
    expect(loading.query()).toBeNull();
  });

  test.each([
    ["500", () => errorResponse(500, "INTERNAL_ERROR"), MESSAGE_INTERNAL],
    [
      "a status and a code that the pinned contract does not list",
      () => errorResponse(503, "FICTIONAL_UNAVAILABLE"),
      MESSAGE_UNAVAILABLE,
    ],
  ])(
    "say in the menu the message of the failure of their read after %s, and the identifier typed can still be sent",
    async (_, failure, message) => {
      const spy = showingMarkable({ search: failure });
      const { screen } = await renderTicket();
      const dialog = await openMark(screen);

      await originalField(dialog).fill("21");

      await expect
        .element(screen.getByText(message, { exact: true }))
        .toBeVisible();
      expect(screen.getByRole("listbox").element().textContent).toBe("");
      await submitFromField(dialog);
      await expect.element(dialog).not.toBeInTheDocument();
      expect(marks(spy)).toEqual([{ duplicate_of_ticket_id: "SNTL-21" }]);
    },
  );
});

describe("the checks of Mark as duplicate…", () => {
  test.each([
    ["an empty original", "", MESSAGE_EMPTY],
    ["an original of whitespace alone", "   ", MESSAGE_EMPTY],
    [
      "a text that is not an identifier",
      "fictional-openssl",
      MESSAGE_NOT_AN_ID,
    ],
    ["an identifier with a leading zero", "SNTL-0021", MESSAGE_NOT_AN_ID],
    ["an identifier beyond the largest", "SNTL-2147483648", MESSAGE_NOT_AN_ID],
    ["the Ticket itself", "SNTL-12", MESSAGE_ITSELF],
    ["the number of the Ticket itself", "12", MESSAGE_ITSELF],
    ["the Ticket itself in lower case", " sntl-12 ", MESSAGE_ITSELF],
  ])(
    "state the error of %s at Original, which takes the focus, without a request",
    async (_, text, message) => {
      const spy = showingMarkable();
      const { screen } = await renderTicket();
      const dialog = await openMark(screen);
      if (text !== "") {
        await originalField(dialog).fill(text);
      }

      await submitFromField(dialog);

      const field = originalField(dialog);
      await expect
        .element(field)
        .toHaveAccessibleDescription(`${DESCRIPTION} ${message}`);
      await expect.element(field).toBeInvalid();
      await expect.element(field).toHaveFocus();
      await expect.element(field).toHaveValue(text);
      await expect.element(dialog).toBeVisible();
      expect(marks(spy)).toHaveLength(0);
    },
  );

  test("take the error away once the original changes", async () => {
    showingMarkable();
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);
    await submitFromField(dialog);
    const field = originalField(dialog);
    await expect.element(field).toBeInvalid();
    await expect.element(field).toHaveFocus();

    await userEvent.keyboard("2");

    await expect.element(field).not.toBeInvalid();
    await expect.element(field).toHaveAccessibleDescription(DESCRIPTION);
  });
});

describe("the submission of Mark as duplicate…", () => {
  test.each([
    ["an identifier", "SNTL-21"],
    ["a number", "21"],
    ["an identifier in lower case", "sntl-21"],
    ["an identifier within surrounding whitespace", "  Sntl-21  "],
  ])(
    "sends %s in its canonical form, with nothing else in the body",
    async (_, text) => {
      const spy = showingMarkable();
      const { screen } = await renderTicket();

      const dialog = await markAs(screen, text);

      await expect.element(dialog).not.toBeInTheDocument();
      expect(marks(spy)).toEqual([{ duplicate_of_ticket_id: "SNTL-21" }]);
    },
  );

  test("keeps the identifier typed, which no option holds, as Escape closes the menu of the field, and sends it", async () => {
    const spy = showingMarkable();
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);
    const field = originalField(dialog);
    await field.fill("21");
    await expect.element(optionOf(screen, "SNTL-21")).toBeVisible();

    await userEvent.keyboard("{Escape}");

    await expect.element(field).toHaveValue("21");
    await expect.element(field).toHaveAttribute("aria-expanded", "false");
    await expect.element(dialog).toBeVisible();
    await submitFromField(dialog);
    await expect.element(dialog).not.toBeInTheDocument();
    expect(marks(spy)).toEqual([{ duplicate_of_ticket_id: "SNTL-21" }]);
  });

  test("is busy while the change is in progress, with Enter in the field, whose original stays read-only with the focus, sends one request, and cannot be closed", async () => {
    const response = later();
    const spy = showingMarkable({}, { ticketChange: () => response.promise });
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);
    const field = originalField(dialog);
    await field.fill("21");
    await expect.element(optionOf(screen, "SNTL-21")).toBeVisible();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect.element(field).toHaveAttribute("aria-expanded", "false");
    expect(marks(spy)).toHaveLength(0);

    await userEvent.keyboard("{Enter}");

    await expect
      .element(submitButton(dialog))
      .toHaveAttribute("aria-disabled", "true");
    expect(marks(spy)).toEqual([{ duplicate_of_ticket_id: "SNTL-21" }]);
    await expect.element(field).toHaveAttribute("readonly");
    await expect.element(cancelButton(dialog)).toBeDisabled();
    await nextFrames();
    expect(document.activeElement).toBe(field.element());
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");
    await nextFrames();
    await expect.element(dialog).toBeVisible();
    expect(discardDialog(screen).query()).toBeNull();
    expect(marks(spy)).toHaveLength(1);
    // Typing in the field changes nothing.
    await userEvent.keyboard("x");
    await nextFrames();
    expect(field.element()).toHaveValue("SNTL-21");

    response.resolve(
      ticketResponse(
        fictionalTicketDetail({
          status: "duplicated",
          duplicate_of_ticket_id: "SNTL-21",
        }),
      ),
    );

    await expect.element(dialog).not.toBeInTheDocument();
  });

  test("keeps the original sent in its field while the change is in progress, so that an error at the field concerns the original that it shows, and takes input again after it", async () => {
    const response = later();
    showingMarkable({}, { ticketChange: () => response.promise });
    const { screen } = await renderTicket();
    const dialog = await markAs(screen, "SNTL-20");
    await expect
      .element(submitButton(dialog))
      .toHaveAttribute("aria-disabled", "true");
    const field = originalField(dialog);
    // The user tries to correct the original meanwhile.
    await field.click();
    await userEvent.keyboard("{Backspace}1");
    await nextFrames();

    response.resolve(errorResponse(404, "TICKET_NOT_FOUND"));

    await expect
      .element(field)
      .toHaveAccessibleDescription(
        `${DESCRIPTION} SNTL-20 doesn't exist, or you don't have access to it.`,
      );
    expect(field.element()).toHaveValue("SNTL-20");
    await expect.element(field).not.toHaveAttribute("readonly");
    await expect.element(field).toHaveFocus();
  });
});

describe("the outcome of Mark as duplicate…", () => {
  test("closes the dialog, returns the focus to Actions, and announces the outcome, as Sentinel returns the Ticket, once the read of the Ticket after it arrives", async () => {
    const reread = later();
    let marked = false;
    showingMarkable(
      {},
      {
        ticket: () =>
          marked ? reread.promise : ticketResponse(fictionalTicketDetail()),
        ticketChange: () => {
          marked = true;
          return ticketResponse(
            fictionalTicketDetail({
              status: "duplicated",
              duplicate_of_ticket_id: "SNTL-21",
            }),
          );
        },
      },
    );
    const { screen } = await renderTicket();

    const dialog = await markAs(screen, "21");

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsButton(screen));
    expect(announcements(screen)).not.toContain(MARKED);
    reread.resolve(
      ticketResponse(
        fictionalTicketDetail({
          status: "duplicated",
          duplicate_of_ticket_id: "SNTL-21",
        }),
      ),
    );

    await expect.poll(() => announcements(screen)).toContain(MARKED);
    expect(
      screen
        .getByText(MARKED, { exact: true })
        .elements()
        .filter((element) => element.closest("output") === null),
    ).toHaveLength(0);
    // Actions stays, with the focus, and offers Revert duplicate on the
    // Duplicated Ticket.
    expect(document.activeElement).toBe(actionsButton(screen).element());
    await actionsButton(screen).click();
    await expect
      .poll(() =>
        textsOf(
          screen
            .getByRole("menu", { name: "Actions of SNTL-12" })
            .getByRole("menuitem"),
        ),
      )
      .toEqual(["Revert duplicate"]);
  });

  test("announces the outcome without the original when Sentinel returns the Ticket without one", async () => {
    let changed = false;
    showingMarkable(
      {},
      {
        ticket: () =>
          changed
            ? markedWithoutOriginal()
            : ticketResponse(fictionalTicketDetail()),
        ticketChange: () => {
          changed = true;
          return markedWithoutOriginal();
        },
      },
    );
    const { screen } = await renderTicket();

    await markAs(screen, "21");

    await expect
      .poll(() => announcements(screen))
      .toContain("Marked as a duplicate.");
    expect(announcements(screen)).not.toContain("Marked as a duplicate of");
  });

  test("leaves an answer that the UI cannot show to the page of a failure of the UI", async () => {
    // The answer of a later release that lacks the Ticket, whose original
    // the outcome cannot name.
    showingMarkable({}, { ticketChange: () => jsonResponse(200, {}) });
    const { screen } = await renderTicket();

    await markAs(screen, "21");

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "Something went wrong" }),
      )
      .toBeVisible();
  });

  test("shows the outcome in the message area when the read of the Ticket after it fails", async () => {
    let marked = false;
    showingMarkable(
      {},
      {
        ticket: () =>
          marked
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : ticketResponse(fictionalTicketDetail()),
        ticketChange: () => {
          marked = true;
          return ticketResponse(
            fictionalTicketDetail({
              status: "duplicated",
              duplicate_of_ticket_id: "SNTL-21",
            }),
          );
        },
      },
    );
    const { screen } = await renderTicket();

    await markAs(screen, "21");

    await expectSuccessMessage(screen, MARKED);
  });

  test("reads again the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, and the reads of the Ticket list, its duplicates included", async () => {
    const spy = showingMarkable(
      {},
      {
        user: { data: { ...MAINTAINER.data, capabilities: ["triage_ticket"] } },
        ticket: () =>
          ticketResponse(
            fictionalTicketDetail({ packages: [fictionalPackage()] }),
          ),
      },
    );
    const { screen } = await renderTicket();
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
    // The dialog, whose read of the duplicates the details also show.
    const dialog = await openMark(screen);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      actors: requestsTo(spy, ACTORS),
      work: requestsTo(spy, YOUR_WORK),
      duplicates: duplicatesReads(spy),
    };
    // The user saw the Ticket list and Audit log before, which wait in the
    // cache.
    client.setQueryData([EVENTS], {});
    client.setQueryData([TICKETS, { page: 1 }], {});

    await originalField(dialog).fill("21");
    await submitFromField(dialog);

    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(reads.work + 1);
    await expect.poll(() => duplicatesReads(spy)).toBe(reads.duplicates + 1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    expect(leftInvalidated(EVENTS)).toBe(true);
    expect(leftInvalidated(TICKETS)).toBe(true);
  });

  test("shows the outcome of a change that ends after the user left the screen in the message area, naming the Ticket, without asking to discard the original", async () => {
    const response = later();
    showingMarkable({}, { ticketChange: () => response.promise });
    const { router, screen } = await renderTicket();
    const dialog = await markAs(screen, "21");
    await expect
      .element(submitButton(dialog))
      .toHaveAttribute("aria-disabled", "true");

    await leaveForTickets(router, screen);
    expect(discardDialog(screen).query()).toBeNull();
    response.resolve(
      ticketResponse(
        fictionalTicketDetail({
          status: "duplicated",
          duplicate_of_ticket_id: "SNTL-21",
        }),
      ),
    );

    const message = screen.getByText(`SNTL-12: ${MARKED}`, { exact: true });
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
    await expect
      .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
      .toHaveAttribute("href", "/tickets/SNTL-12");
  });

  test.each<
    [string, () => Response, string, keyof typeof MESSAGE_TONES, boolean]
  >([
    [
      "409 TICKET_DUPLICATE_TARGET_DUPLICATED, as the error of the field, which names the original sent and no original of it",
      () => errorResponse(409, "TICKET_DUPLICATE_TARGET_DUPLICATED"),
      "SNTL-21 is a duplicate itself: choose its original instead.",
      "danger",
      false,
    ],
    [
      "404 TICKET_NOT_FOUND, as an error that names both the Ticket and the original sent",
      () => errorResponse(404, "TICKET_NOT_FOUND"),
      "This Ticket or the original SNTL-21 doesn't exist, or you don't have access to it.",
      "danger",
      false,
    ],
    [
      "409 TICKET_DUPLICATE_CONCURRENT_MODIFICATION, as in the dialog",
      () => errorResponse(409, "TICKET_DUPLICATE_CONCURRENT_MODIFICATION"),
      MESSAGE_DUPLICATES_BUSY,
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
  ])(
    "shows a failure that ends after the user left the screen in the message area, naming the Ticket: %s",
    async (_, failure, text, tone, referenced) => {
      const response = later();
      showingMarkable({}, { ticketChange: () => response.promise });
      const { router, screen } = await renderTicket();
      // The original is sent in its canonical form.
      const dialog = await markAs(screen, " sntl-21 ");
      await expect
        .element(submitButton(dialog))
        .toHaveAttribute("aria-disabled", "true");

      await leaveForTickets(router, screen);
      response.resolve(failure());

      const error = screen.getByText(`SNTL-12: ${text}`, { exact: true });
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES[tone]);
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
    },
  );
});

describe("a failure of Mark as duplicate…", () => {
  test.each([
    [
      "400 TICKET_SELF_DUPLICATE",
      () => errorResponse(400, "TICKET_SELF_DUPLICATE"),
      MESSAGE_ITSELF,
    ],
    [
      "404 TICKET_NOT_FOUND",
      () => errorResponse(404, "TICKET_NOT_FOUND"),
      "SNTL-21 doesn't exist, or you don't have access to it.",
    ],
    [
      "409 TICKET_DUPLICATE_TARGET_DUPLICATED",
      () => errorResponse(409, "TICKET_DUPLICATE_TARGET_DUPLICATED"),
      "SNTL-21 is a duplicate itself: choose its original instead.",
    ],
    [
      "a field error of the original",
      () => validationError([["body", "duplicate_of_ticket_id"]]),
      MESSAGE_INVALID,
    ],
  ])(
    "shows %s at Original, which takes the focus and keeps the original, until it changes",
    async (_, failure, message) => {
      const spy = showingMarkable({}, { ticketChange: failure });
      const { screen } = await renderTicket();
      const reads = requestsTo(spy, TICKET);

      const dialog = await markAs(screen, "SNTL-21");

      const field = originalField(dialog);
      await expect
        .element(field)
        .toHaveAccessibleDescription(`${DESCRIPTION} ${message}`);
      await expect.element(field).toBeInvalid();
      await expect.element(field).toHaveFocus();
      await expect.element(field).toHaveValue("SNTL-21");
      // The message shows at the field alone.
      expect(dialog.getByText(message).elements()).toHaveLength(1);
      // Whatever its outcome, the screen reads again what it affects.
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);

      await userEvent.keyboard("{Backspace}2");

      await expect.element(field).not.toBeInvalid();
      await expect.element(field).toHaveAccessibleDescription(DESCRIPTION);
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
      "409 TICKET_DUPLICATE_CONCURRENT_MODIFICATION, as an error",
      () => errorResponse(409, "TICKET_DUPLICATE_CONCURRENT_MODIFICATION"),
      MESSAGE_DUPLICATES_BUSY,
      "danger",
      false,
    ],
    [
      "409 TICKET_NOT_MUTABLE, as an error",
      () => errorResponse(409, "TICKET_NOT_MUTABLE"),
      MESSAGE_CONFLICT,
      "danger",
      false,
    ],
    [
      "a 409 with a code that the pinned contract does not list, as an error",
      () => errorResponse(409, "FICTIONAL_CONFLICT"),
      MESSAGE_CONFLICT,
      "danger",
      false,
    ],
    [
      "a code of the field with another status, as an error",
      () => errorResponse(409, "TICKET_SELF_DUPLICATE"),
      MESSAGE_CONFLICT,
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
      "403, as an error",
      () => errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION"),
      MESSAGE_FORBIDDEN,
      "danger",
      false,
    ],
    [
      "a VALIDATION_ERROR of no field, as an error",
      () => validationError([["body"]]),
      MESSAGE_NOT_ACCEPTED,
      "danger",
      false,
    ],
    [
      "a status and a code that the pinned contract does not list, as an error",
      () => errorResponse(418, "FICTIONAL_CODE"),
      MESSAGE_NOT_ACCEPTED,
      "danger",
      false,
    ],
  ])(
    "shows %s at the top of the form, which takes the focus and keeps the original",
    async (_, failure, message, tone, referenced) => {
      const spy = showingMarkable({}, { ticketChange: failure });
      const { screen } = await renderTicket();
      const reads = requestsTo(spy, TICKET);

      const dialog = await markAs(screen, "SNTL-21");

      const error = dialog.getByText(message, { exact: true });
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES[tone]);
      await expectFocusOnError(error);
      expect(boxOf(error).bottom).toBeLessThan(
        boxOf(originalField(dialog)).top,
      );
      if (referenced) {
        await expect
          .element(dialog.getByText(REFERENCE, { exact: true }))
          .toBeVisible();
      } else {
        expect(dialog.getByText(/^Reference:/).query()).toBeNull();
      }
      const field = originalField(dialog);
      await expect.element(field).toHaveValue("SNTL-21");
      await expect.element(field).not.toBeInvalid();
      // Whatever its outcome, the screen reads again what it affects.
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    },
  );

  test("names after 409 TICKET_DUPLICATE_TARGET_DUPLICATED the original of the Ticket sent, which the suggestions of the field show, so that a user who cannot read the label of its option learns it too", async () => {
    showingMarkable(
      {
        search: () =>
          ticketPage([
            summary("SNTL-41", {
              status: "duplicated",
              duplicate_of_ticket_id: "SNTL-40",
            }),
          ]),
      },
      {
        ticketChange: () =>
          errorResponse(409, "TICKET_DUPLICATE_TARGET_DUPLICATED"),
      },
    );
    const { screen } = await renderTicket();
    const dialog = await openMark(screen);
    const field = originalField(dialog);
    // The number of the Ticket, which the form sends as SNTL-41.
    await field.fill("41");
    await expect
      .element(optionOf(screen, "SNTL-41"))
      .toHaveAttribute("aria-disabled", "true");

    await submitFromField(dialog);

    await expect
      .element(field)
      .toHaveAccessibleDescription(
        `${DESCRIPTION} SNTL-41 is a duplicate of SNTL-40: choose SNTL-40 instead.`,
      );
    await expect.element(field).toBeInvalid();
    await expect.element(field).toHaveFocus();
    await expect.element(field).toHaveValue("41");
  });

  test.each<[string, () => Response, (screen: Screen) => Locator]>([
    [
      "which the suggestions of the field show too",
      () =>
        ticketPage([
          summary("SNTL-31", {
            status: "duplicated",
            duplicate_of_ticket_id: "SNTL-12",
          }),
        ]),
      (screen) => optionOf(screen, "SNTL-31"),
    ],
    [
      "without the suggestions of the field, whose read failed",
      () => errorResponse(500, "INTERNAL_ERROR"),
      (screen) => screen.getByText(MESSAGE_INTERNAL, { exact: true }),
    ],
  ])(
    "says after 409 TICKET_DUPLICATE_TARGET_DUPLICATED that the Ticket sent is a duplicate of this Ticket, which the read of its duplicates shows, %s",
    async (_, search, shown) => {
      showingMarkable(
        {
          duplicates: () =>
            ticketPage([
              summary("SNTL-31", {
                status: "duplicated",
                duplicate_of_ticket_id: "SNTL-12",
              }),
            ]),
          search,
        },
        {
          ticketChange: () =>
            errorResponse(409, "TICKET_DUPLICATE_TARGET_DUPLICATED"),
        },
      );
      const { screen } = await renderTicket();
      const dialog = await openMark(screen);
      await expect
        .element(
          dialog.getByText(
            "SNTL-31, its duplicate, becomes a duplicate of that Ticket too.",
            { exact: true },
          ),
        )
        .toBeVisible();
      const field = originalField(dialog);
      await field.fill("SNTL-31");
      // The menu of the field shows the outcome of the read of its
      // suggestions.
      await expect.element(shown(screen)).toBeVisible();

      await submitFromField(dialog);

      await expect
        .element(field)
        .toHaveAccessibleDescription(
          `${DESCRIPTION} SNTL-31 is a duplicate of this Ticket: to make it the original, use Revert duplicate on SNTL-31 first.`,
        );
      await expect.element(field).toBeInvalid();
      await expect.element(field).toHaveFocus();
    },
  );

  test.each([
    [
      "no read shows the Ticket sent, while they show other duplicates with their originals",
      () =>
        ticketPage([
          summary("SNTL-41", {
            status: "duplicated",
            duplicate_of_ticket_id: "SNTL-40",
          }),
          summary("SNTL-42", {
            status: "duplicated",
            duplicate_of_ticket_id: "SNTL-12",
          }),
        ]),
      "SNTL-4",
      "SNTL-4 is a duplicate itself: choose its original instead.",
    ],
    [
      "the suggestions show the Ticket sent as a duplicate without its original",
      () =>
        ticketPage([
          summary("SNTL-41", {
            status: "duplicated",
            duplicate_of_ticket_id: null,
          }),
        ]),
      "SNTL-41",
      "SNTL-41 is a duplicate itself: choose its original instead.",
    ],
  ])(
    "says after 409 TICKET_DUPLICATE_TARGET_DUPLICATED that the Ticket sent is a duplicate, without naming its original, when %s",
    async (_, search, original, message) => {
      showingMarkable(
        {
          duplicates: () =>
            ticketPage([
              summary("SNTL-31", {
                status: "duplicated",
                duplicate_of_ticket_id: "SNTL-12",
              }),
            ]),
          search,
        },
        {
          ticketChange: () =>
            errorResponse(409, "TICKET_DUPLICATE_TARGET_DUPLICATED"),
        },
      );
      const { screen } = await renderTicket();
      const dialog = await openMark(screen);
      await expect
        .element(dialog.getByText(/^SNTL-31, its duplicate/))
        .toBeVisible();
      const field = originalField(dialog);
      await field.fill(original);
      await expect.element(optionOf(screen, "SNTL-41")).toBeVisible();

      await submitFromField(dialog);

      await expect
        .element(field)
        .toHaveAccessibleDescription(`${DESCRIPTION} ${message}`);
      await expect.element(field).toBeInvalid();
      await expect.element(field).toHaveFocus();
    },
  );

  test("names after 409 TICKET_DUPLICATE_TARGET_DUPLICATED the original of the Ticket sent that the suggestions of the field show, rather than the one that an older read of the Ticket list of another screen shows", async () => {
    showingAfterTicketList(() =>
      ticketPage([
        summary("SNTL-41", {
          status: "duplicated",
          duplicate_of_ticket_id: "SNTL-50",
        }),
      ]),
    );
    const { screen } = await renderTicketFromList();
    const dialog = await openMark(screen);
    const field = originalField(dialog);
    await field.fill("41");
    await expect
      .element(
        optionOf(screen, "SNTL-41").getByText("Duplicate of SNTL-50", {
          exact: true,
        }),
      )
      .toBeVisible();

    await submitFromField(dialog);

    await expect
      .element(field)
      .toHaveAccessibleDescription(
        `${DESCRIPTION} SNTL-41 is a duplicate of SNTL-50: choose SNTL-50 instead.`,
      );
    await expect.element(field).toHaveFocus();
  });

  test.each<[string, () => Response, (screen: Screen) => Locator]>([
    [
      "whose read failed",
      () => errorResponse(500, "INTERNAL_ERROR"),
      (screen) => screen.getByText(MESSAGE_INTERNAL, { exact: true }),
    ],
    [
      "which do not list it",
      () => ticketPage([summary("SNTL-410")]),
      (screen) => optionOf(screen, "SNTL-410"),
    ],
  ])(
    "says after 409 TICKET_DUPLICATE_TARGET_DUPLICATED that the Ticket sent is a duplicate, without naming its original, when only an older read of the Ticket list of another screen shows its original, not the suggestions of the field, %s",
    async (_, search, shown) => {
      showingAfterTicketList(search);
      const { screen } = await renderTicketFromList();
      const dialog = await openMark(screen);
      const field = originalField(dialog);
      await field.fill("41");
      // The menu of the field shows the outcome of the read of its
      // suggestions.
      await expect.element(shown(screen)).toBeVisible();

      await submitFromField(dialog);

      await expect
        .element(field)
        .toHaveAccessibleDescription(
          `${DESCRIPTION} SNTL-41 is a duplicate itself: choose its original instead.`,
        );
      await expect.element(field).toHaveFocus();
    },
  );

  test("shows the error of the field and of the form for a VALIDATION_ERROR with an error of another member, the form taking the focus", async () => {
    showingMarkable(
      {},
      {
        ticketChange: () =>
          validationError([
            ["body", "duplicate_of_ticket_id"],
            ["body", "fictional_member"],
          ]),
      },
    );
    const { screen } = await renderTicket();

    const dialog = await markAs(screen, "SNTL-21");

    const error = dialog.getByText(MESSAGE_NOT_ACCEPTED, { exact: true });
    await expect.element(error).toBeVisible();
    await expect
      .element(originalField(dialog))
      .toHaveAccessibleDescription(`${DESCRIPTION} ${MESSAGE_INVALID}`);
    await expectFocusOnError(error);
  });
});

describe("leaving Mark as duplicate…", () => {
  test.each([
    ["Cancel", ""],
    ["Escape", ""],
    ["Cancel", "   "],
    ["Escape", "   "],
  ])(
    "on %s without an original other than whitespace closes at once, and returns the focus to Actions",
    async (way, text) => {
      showingMarkable();
      const { screen } = await renderTicket();
      const dialog = await openMark(screen);
      if (text !== "") {
        await originalField(dialog).fill(text);
      }

      if (way === "Escape") {
        await userEvent.keyboard("{Escape}");
      } else {
        await cancelButton(dialog).click();
      }

      await expect.element(dialog).not.toBeInTheDocument();
      expect(discardDialog(screen).query()).toBeNull();
      await expectFocusSettledOn(actionsButton(screen));
    },
  );

  test.each(["typed", "chosen"])(
    "asks before Cancel or Escape discard an original %s, keeps it on Keep editing, and closes on Discard",
    async (how) => {
      const spy = showingMarkable();
      const { screen } = await renderTicket();
      const dialog = await openMark(screen);
      await originalField(dialog).fill("21");
      if (how === "chosen") {
        await optionOf(screen, "SNTL-21").click();
      }
      const value = how === "chosen" ? "SNTL-21" : "21";
      await expect.element(originalField(dialog)).toHaveValue(value);
      // Tab closes the menu of the field, which keeps Cancel from assistive
      // technologies while it is open.
      await userEvent.keyboard("{Tab}");

      await cancelButton(dialog).click();

      const discard = discardDialog(screen);
      await expect
        .element(discard.getByRole("button", { name: "Keep editing" }))
        .toHaveFocus();
      await expect
        .element(
          discard.getByText("SNTL-12 isn't marked as a duplicate.", {
            exact: true,
          }),
        )
        .toBeVisible();
      await discard.getByRole("button", { name: "Keep editing" }).click();
      await expect.element(discard).not.toBeInTheDocument();
      await expect.element(dialog).toBeVisible();
      await expect.element(originalField(dialog)).toHaveValue(value);

      // From Cancel, where the focus returned, rather than from the field,
      // whose menu Escape would close first.
      await expect.element(cancelButton(dialog)).toHaveFocus();
      await userEvent.keyboard("{Escape}");
      await expect.element(discard).toBeVisible();
      await discard
        .getByRole("button", { name: "Discard", exact: true })
        .click();

      await expect.element(dialog).not.toBeInTheDocument();
      await expectFocusSettledOn(actionsButton(screen));
      expect(marks(spy)).toHaveLength(0);
      // The dialog opens again empty.
      const again = await openMark(screen);
      await expect.element(originalField(again)).toHaveValue("");
    },
  );

  test("asks before a navigation discards the original typed, and leaves on Discard", async () => {
    showingMarkable();
    const { router, screen } = await renderTicket();
    const dialog = await openMark(screen);
    await originalField(dialog).fill("21");

    router.history.push("/tickets");

    const discard = discardDialog(screen);
    await expect.element(discard).toBeVisible();
    expect(router.state.location.pathname).toBe("/tickets/SNTL-12");
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
  });

  test("leaves at once on a navigation without an original", async () => {
    showingMarkable();
    const { router, screen } = await renderTicket();
    await openMark(screen);

    router.history.push("/tickets");

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
    expect(discardDialog(screen).query()).toBeNull();
  });
});

describe("the status of the Ticket after Mark as duplicate…", () => {
  test("is read again, also after Sentinel refuses the change because the Ticket became Ignored meanwhile", async () => {
    let status = "analyzed";
    showingMarkable(
      {},
      {
        ticket: () =>
          jsonResponse(200, { data: { ...fictionalTicketDetail(), status } }),
        ticketChange: () => {
          status = "ignored";
          return errorResponse(409, "TICKET_NOT_MUTABLE");
        },
      },
    );
    const { screen } = await renderTicket();

    const dialog = await markAs(screen, "21");

    await expect
      .element(dialog.getByText(MESSAGE_CONFLICT, { exact: true }))
      .toBeVisible();
    // The heading row, behind the dialog, shows the status that the read
    // after the change returns.
    await expect
      .element(screen.getByText("Ignored", { exact: true }))
      .toBeVisible();
    await cancelButton(dialog).click();
    await discardDialog(screen)
      .getByRole("button", { name: "Discard", exact: true })
      .click();
    await expect.element(dialog).not.toBeInTheDocument();
    await actionsButton(screen).click();
    await expect
      .poll(() =>
        textsOf(
          screen
            .getByRole("menu", { name: "Actions of SNTL-12" })
            .getByRole("menuitem"),
        ),
      )
      .toEqual(["Reopen"]);
  });
});
