import { describe, expect, test } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import type { TicketDetail, UserReference } from "../../api/generated/model";
import {
  errorResponse,
  fictionalCve,
  fictionalPackage,
  fictionalTicketDetail,
  jsonResponse,
  OTHER_USER,
  referenceOf,
  requestsTo,
  stubApi,
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
  leaveForTickets,
  later,
  leftInvalidated,
  MAINTAINER,
  MESSAGE_CONFLICT,
  MESSAGE_INVALID,
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
  type Stub,
  stubTicket,
  textsOf,
  TICKET,
  TICKETS,
  YOUR_WORK,
} from "../ticket-overview/test-support";

// Ignore…, the dialog that Actions opens in the heading row of the Ticket
// screen (src/routes/ticket/ignore.tsx; docs/screens/ticket.md, Actions;
// States), shown over Overview, at the browser's default text size, in the
// light theme. The quick action Ignore as not shipped by SUSE has its tests
// with the other items of Actions (src/routes/ticket/actions.test.tsx).

prepareEachTest();

// What the dialog says that the change does, and what each reason means.
const EXPLANATION =
  "SNTL-12 stops being worked, and accepts no change to its analysis until Reopen.";
const NOT_SHIPPED =
  "SUSE ships none of the affected software. If SUSE ships it but the issue doesn't affect it, set its tracks to Not affected instead.";
const CVE_REJECTED =
  "CVE-2099-0012 is rejected. If the rejection is reverted, SNTL-12 reopens by itself.";
const OTHER = "Another reason. SNTL-12 stays ignored until someone reopens it.";

const MESSAGE_NO_REASON = "Choose a reason.";
const MESSAGE_NOT_REJECTED =
  "CVE-2099-0012 is no longer rejected. Choose another reason.";
const MESSAGE_FORBIDDEN = "You don't have permission to do this.";

// The color of a primary button in the light theme (docs/design-system.md,
// Buttons and Links): accent.
const ACCENT = "rgb(9, 105, 218)";

const IGNORE = `${TICKET}/ignore`;

// Alice Smith, the analyst who holds triage_ticket (OTHER_USER), as the
// assignee of a Ticket.
const YOU = referenceOf(OTHER_USER);

// Bob Wilson, another analyst, as the assignee of a Ticket.
const BOB: UserReference = {
  id: "00000000-0000-0000-0000-000000000009",
  username: "bwilson",
  full_name: "Bob Wilson",
  active: true,
  bot: false,
  avatar_url: null,
};

// The CVE of SNTL-12, rejected.
const REJECTED: Partial<TicketDetail> = {
  cve: fictionalCve({
    cve_state: "rejected",
    date_rejected: "2099-10-09T08:00:00Z",
  }),
};

// SNTL-12 in Analysis, with the fields that a test sets, as Get Ticket
// returns it.
function inAnalysis(fields: Partial<TicketDetail> = {}): Response {
  return ticketResponse(
    fictionalTicketDetail({ status: "analysis", ...fields }),
  );
}

// SNTL-12 Ignored with the reason, which can be one that the pinned contract
// does not list, and the assignee, as Ignore Ticket and Get Ticket return
// it.
function ignoredWith(
  reason: string,
  assignee: TicketDetail["assignee"] = YOU,
): Response {
  return jsonResponse(200, {
    data: {
      ...fictionalTicketDetail({ status: "ignored", assignee }),
      ignore_reason: reason,
    },
  });
}

// The reason that a body of Ignore Ticket sends.
function reasonIn(body: unknown): string {
  return typeof body === "object" && body !== null && "reason" in body
    ? String(body.reason)
    : "";
}

// Answers for the analyst, who holds triage_ticket, with SNTL-12 in Analysis
// with the fields, and Ignore Ticket with SNTL-12 Ignored with the reason
// sent, assigned to the analyst, and the other responses that the test sets.
function showingIgnorable(
  fields: Partial<TicketDetail> = {},
  stub: Partial<Stub> = {},
) {
  return stubTicket({
    user: OTHER_USER,
    ticket: () => inAnalysis(fields),
    ticketChange: (_, body) => ignoredWith(reasonIn(body)),
    ...stub,
  });
}

// Answers as showingIgnorable does, with Get Ticket returning SNTL-12 in
// Analysis until Ignore Ticket answers, and then as Ignore Ticket returned
// it, as the change of the test.
function showingChange(
  answer: () => Response | Promise<Response>,
  fields: Partial<TicketDetail> = {},
  stub: Partial<Stub> = {},
) {
  let changed = false;
  return showingIgnorable(fields, {
    ticket: () => (changed ? answer() : inAnalysis(fields)),
    ticketChange: () => {
      changed = true;
      return answer();
    },
    ...stub,
  });
}

function actionsButton(screen: Screen) {
  return screen.getByRole("button", {
    name: "Actions of SNTL-12",
    exact: true,
  });
}

function ignoreDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Ignore SNTL-12", exact: true });
}

function discardDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Discard changes?" });
}

function reasonGroup(dialog: Locator) {
  return dialog.getByRole("radiogroup", { name: "Reason", exact: true });
}

function reasonOf(dialog: Locator, name: string) {
  return dialog.getByRole("radio", { name, exact: true });
}

function submitButton(dialog: Locator) {
  return dialog.getByRole("button", { name: "Ignore", exact: true });
}

function cancelButton(dialog: Locator) {
  return dialog.getByRole("button", { name: "Cancel", exact: true });
}

// The reasons that the dialog offers are the radio buttons of the names, in
// their order.
function expectReasons(dialog: Locator, names: readonly string[]) {
  const radios = reasonGroup(dialog).getByRole("radio").elements();
  expect(radios).toHaveLength(names.length);
  for (const [index, name] of names.entries()) {
    expect(reasonOf(dialog, name).element()).toBe(radios[index]);
  }
}

// Opens Ignore… from Actions and waits until its first reason has the focus.
async function openIgnore(screen: Screen) {
  await actionsButton(screen).click();
  await screen.getByRole("menuitem", { name: "Ignore…", exact: true }).click();
  const dialog = ignoreDialog(screen);
  await expect.element(reasonOf(dialog, "Not shipped")).toHaveFocus();
  return dialog;
}

// Chooses the reason with a press of its label, as the user does.
async function chooseReason(dialog: Locator, name: string) {
  await dialog.getByText(name, { exact: true }).click();
  await expect.element(reasonOf(dialog, name)).toBeChecked();
}

// Opens Ignore…, chooses the reason, and submits it.
async function ignoreAs(screen: Screen, name: string) {
  const dialog = await openIgnore(screen);
  await chooseReason(dialog, name);
  await submitButton(dialog).click();
  return dialog;
}

// The bodies of the requests of Ignore Ticket.
function ignores(spy: ReturnType<typeof stubApi>): unknown[] {
  return spy.mock.calls
    .filter(
      ([input, init]) =>
        init?.method === "POST" && urlOf(input).pathname === IGNORE,
    )
    .map(([, init]) =>
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    );
}

// The elements outside the status regions that hold the text, such as the
// message area.
function shownOutsideStatus(screen: Screen, text: string): Element[] {
  return screen
    .getByText(text, { exact: true })
    .elements()
    .filter((element) => element.closest("output") === null);
}

describe("the dialog of Ignore…", () => {
  test("says in fg-muted what the change does, then shows Reason, a group of radio buttons, none chosen, whose first reason takes the focus, then Cancel and Ignore, a primary button, at most 560 px wide", async () => {
    showingIgnorable();
    const { screen } = await renderTicket();

    const dialog = await openIgnore(screen);

    const explanation = dialog.getByText(EXPLANATION, { exact: true });
    await expect.element(explanation).toBeVisible();
    expect(getComputedStyle(explanation.element()).color).toBe(FG_MUTED);
    const group = reasonGroup(dialog);
    await expect.element(group).toBeVisible();
    expect(boxOf(explanation).bottom).toBeLessThan(boxOf(group).top);
    for (const radio of group.getByRole("radio").elements()) {
      expect(radio).not.toBeChecked();
    }
    expect(dialog.getByRole("radiogroup").elements()).toHaveLength(1);
    expect(textsOf(dialog.getByRole("button"))).toEqual(["Cancel", "Ignore"]);
    await pointerAwayFrom(submitButton(dialog));
    expect(
      getComputedStyle(submitButton(dialog).element()).backgroundColor,
    ).toBe(ACCENT);
    expect(boxOf(dialog).width).toBe(560);
  });

  test.each<[string, string[], Partial<TicketDetail>]>([
    ["a Ticket whose CVE is published", ["Not shipped", "Other"], {}],
    ["a Ticket without a CVE", ["Not shipped", "Other"], { cve: null }],
    [
      "a Ticket whose CVE is rejected",
      ["Not shipped", "CVE rejected", "Other"],
      REJECTED,
    ],
  ])("offers, for %s, the reasons %j", async (_, names, fields) => {
    showingIgnorable(fields);
    const { screen } = await renderTicket();

    const dialog = await openIgnore(screen);

    expectReasons(dialog, names);
    expect(dialog.getByText("CNA policy").query()).toBeNull();
  });

  test("offers no CVE rejected for a Ticket whose CVE is in a state that the pinned contract does not list", async () => {
    showingIgnorable(
      {},
      {
        ticket: () =>
          jsonResponse(200, {
            data: {
              ...fictionalTicketDetail({ status: "analysis" }),
              cve: { ...fictionalCve(), cve_state: "fictional_state" },
            },
          }),
      },
    );
    const { screen } = await renderTicket();

    const dialog = await openIgnore(screen);

    expectReasons(dialog, ["Not shipped", "Other"]);
  });

  test.each([
    ["Not shipped", NOT_SHIPPED],
    ["CVE rejected", CVE_REJECTED],
    ["Other", OTHER],
  ])(
    "names the reason %s by its label, with its meaning below it as its description",
    async (name, meaning) => {
      showingIgnorable(REJECTED);
      const { screen } = await renderTicket();

      const dialog = await openIgnore(screen);

      const reason = reasonOf(dialog, name);
      await expect.element(reason).toHaveAccessibleDescription(meaning);
      const text = dialog.getByText(meaning, { exact: true });
      await expect.element(text).toBeVisible();
      expect(boxOf(text).top).toBeGreaterThanOrEqual(
        boxOf(dialog.getByText(name, { exact: true })).bottom,
      );
    },
  );

  test("chooses a reason with a press of its meaning", async () => {
    showingIgnorable();
    const { screen } = await renderTicket();
    const dialog = await openIgnore(screen);

    await dialog.getByText(OTHER, { exact: true }).click();

    await expect.element(reasonOf(dialog, "Other")).toBeChecked();
    await expect.element(reasonOf(dialog, "Not shipped")).not.toBeChecked();
  });

  test("chooses a reason with the arrow keys", async () => {
    const spy = showingIgnorable();
    const { screen } = await renderTicket();
    const dialog = await openIgnore(screen);

    await userEvent.keyboard("{ArrowDown}");

    await expect.element(reasonOf(dialog, "Other")).toBeChecked();
    await expect.element(reasonOf(dialog, "Other")).toHaveFocus();
    await submitButton(dialog).click();
    await expect.element(dialog).not.toBeInTheDocument();
    expect(ignores(spy)).toEqual([{ reason: "other" }]);
  });
});

describe("the check of Ignore…", () => {
  test("states Choose a reason. at Reason when the form is submitted without one, the first reason taking the focus, without a request", async () => {
    const spy = showingIgnorable(REJECTED);
    const { screen } = await renderTicket();
    const dialog = await openIgnore(screen);

    await submitButton(dialog).click();

    const group = reasonGroup(dialog);
    await expect.element(group).toHaveAccessibleDescription(MESSAGE_NO_REASON);
    const error = dialog.getByText(MESSAGE_NO_REASON, { exact: true });
    await expect.element(error).toBeVisible();
    expect(boxOf(error).top).toBeGreaterThanOrEqual(
      boxOf(dialog.getByText(OTHER, { exact: true })).bottom,
    );
    await expect.element(reasonOf(dialog, "Not shipped")).toHaveFocus();
    await expect.element(dialog).toBeVisible();
    for (const radio of group.getByRole("radio").elements()) {
      expect(radio).not.toBeChecked();
    }
    expect(ignores(spy)).toEqual([]);
  });

  test("takes the error away once a reason is chosen", async () => {
    showingIgnorable();
    const { screen } = await renderTicket();
    const dialog = await openIgnore(screen);
    await submitButton(dialog).click();
    const group = reasonGroup(dialog);
    await expect.element(group).toHaveAccessibleDescription(MESSAGE_NO_REASON);

    await chooseReason(dialog, "Other");

    await expect.element(group).not.toHaveAccessibleDescription();
    expect(dialog.getByText(MESSAGE_NO_REASON).query()).toBeNull();
  });
});

describe("the submission of Ignore…", () => {
  test.each<
    [string, Partial<TicketDetail>, string, TicketDetail["assignee"], string]
  >([
    [
      "Not shipped",
      {},
      "not_shipped",
      YOU,
      "Ignored as Not shipped, assigned to you.",
    ],
    [
      "CVE rejected",
      REJECTED,
      "cve_rejected",
      BOB,
      "Ignored as CVE rejected, assigned to Bob Wilson.",
    ],
    ["Other", {}, "other", null, "Ignored as Other, unassigned."],
  ])(
    "sends the reason chosen, %s, with nothing else in the body, and announces the reason and the assignee that Sentinel returns",
    async (name, fields, reason, assignee, text) => {
      const spy = showingChange(() => ignoredWith(reason, assignee), fields);
      const { screen } = await renderTicket();

      const dialog = await ignoreAs(screen, name);

      await expect.element(dialog).not.toBeInTheDocument();
      expect(ignores(spy)).toEqual([{ reason }]);
      await expect.poll(() => announcements(screen)).toContain(text);
    },
  );

  test("announces a reason that the pinned contract does not list, which Sentinel returns, as received", async () => {
    showingChange(() => ignoredWith("fictional_reason", null));
    const { screen } = await renderTicket();

    await ignoreAs(screen, "Other");

    await expect
      .poll(() => announcements(screen))
      .toContain("Ignored as fictional_reason, unassigned.");
  });

  test("is busy while the change is in progress, sends one request, keeps the reason chosen, read-only, and cannot be closed", async () => {
    const response = later();
    const spy = showingIgnorable({}, { ticketChange: () => response.promise });
    const { screen } = await renderTicket();

    const dialog = await ignoreAs(screen, "Other");

    await expect
      .element(submitButton(dialog))
      .toHaveAttribute("aria-disabled", "true");
    expect(ignores(spy)).toEqual([{ reason: "other" }]);
    await expect.element(cancelButton(dialog)).toBeDisabled();
    const group = reasonGroup(dialog);
    await expect.element(group).toHaveAttribute("aria-readonly", "true");
    // Another submission, another reason, and Escape change nothing.
    await submitButton(dialog).click({ force: true });
    await dialog.getByText("Not shipped", { exact: true }).click();
    reasonOf(dialog, "Other").element().focus();
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.keyboard("{Escape}");
    await nextFrames();
    await expect.element(dialog).toBeVisible();
    expect(discardDialog(screen).query()).toBeNull();
    await expect.element(reasonOf(dialog, "Other")).toBeChecked();
    await expect.element(reasonOf(dialog, "Not shipped")).not.toBeChecked();
    expect(ignores(spy)).toHaveLength(1);

    response.resolve(ignoredWith("other"));

    await expect.element(dialog).not.toBeInTheDocument();
  });
});

describe("the outcome of Ignore…", () => {
  test("closes the dialog, returns the focus to Actions, and announces the outcome, as Sentinel returns the Ticket, once the read of the Ticket after it arrives", async () => {
    const reread = later();
    let ignored = false;
    showingIgnorable(
      {},
      {
        ticket: () => (ignored ? reread.promise : inAnalysis()),
        ticketChange: () => {
          ignored = true;
          return ignoredWith("other", YOU);
        },
      },
    );
    const { screen } = await renderTicket();

    const dialog = await ignoreAs(screen, "Other");

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsButton(screen));
    expect(announcements(screen)).not.toContain("Ignored");
    // The read shows the Ticket as a later change left it: the outcome
    // states the Ticket as Sentinel returned it after this one.
    reread.resolve(ignoredWith("not_shipped", BOB));

    const text = "Ignored as Other, assigned to you.";
    await expect.poll(() => announcements(screen)).toContain(text);
    expect(shownOutsideStatus(screen, text)).toHaveLength(0);
    // Actions stays, with the focus, and offers Reopen on the Ignored
    // Ticket.
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
      .toEqual(["Reopen"]);
  });

  test("shows the outcome in the message area when the read of the Ticket after it fails", async () => {
    let ignored = false;
    showingIgnorable(
      {},
      {
        ticket: () =>
          ignored ? errorResponse(503, "SERVICE_UNAVAILABLE") : inAnalysis(),
        ticketChange: () => {
          ignored = true;
          return ignoredWith("other", YOU);
        },
      },
    );
    const { screen } = await renderTicket();

    await ignoreAs(screen, "Other");

    await expectSuccessMessage(screen, "Ignored as Other, assigned to you.");
  });

  test("leaves an answer that the UI cannot show to the page of a failure of the UI", async () => {
    // The answer of a later release that lacks the Ticket, whose reason and
    // assignee the outcome cannot state.
    showingIgnorable({}, { ticketChange: () => jsonResponse(200, {}) });
    const { screen } = await renderTicket();

    await ignoreAs(screen, "Other");

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "Something went wrong" }),
      )
      .toBeVisible();
  });

  test("reads again the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, and the reads of the Ticket list, its duplicates included", async () => {
    const spy = showingIgnorable(
      { packages: [fictionalPackage()] },
      {
        user: { data: { ...MAINTAINER.data, capabilities: ["triage_ticket"] } },
      },
    );
    const { screen } = await renderTicket();
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
    const dialog = await openIgnore(screen);
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

    await chooseReason(dialog, "Not shipped");
    await submitButton(dialog).click();

    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(reads.work + 1);
    await expect.poll(() => readsOf(spy, TICKETS)).toBe(reads.duplicates + 1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    expect(leftInvalidated(EVENTS)).toBe(true);
    expect(leftInvalidated(TICKETS)).toBe(true);
  });

  test("shows the outcome of a change that ends after the user left the screen in the message area, naming the Ticket, without asking to discard the reason", async () => {
    const response = later();
    showingIgnorable({}, { ticketChange: () => response.promise });
    const { router, screen } = await renderTicket();
    const dialog = await ignoreAs(screen, "Other");
    await expect
      .element(submitButton(dialog))
      .toHaveAttribute("aria-disabled", "true");

    await leaveForTickets(router, screen);
    expect(discardDialog(screen).query()).toBeNull();
    response.resolve(ignoredWith("other", YOU));

    const message = screen.getByText(
      "SNTL-12: Ignored as Other, assigned to you.",
      { exact: true },
    );
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
      "409 TICKET_CVE_NOT_REJECTED, as the error of the reason, which names the CVE",
      () => errorResponse(409, "TICKET_CVE_NOT_REJECTED"),
      MESSAGE_NOT_REJECTED,
      "danger",
      false,
    ],
    [
      "409 TICKET_INVALID_TRANSITION, in the presentation of its status",
      () => errorResponse(409, "TICKET_INVALID_TRANSITION"),
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
  ])(
    "shows a failure that ends after the user left the screen in the message area, naming the Ticket: %s",
    async (_, failure, text, tone, referenced) => {
      const response = later();
      showingIgnorable(REJECTED, { ticketChange: () => response.promise });
      const { router, screen } = await renderTicket();
      const dialog = await ignoreAs(screen, "CVE rejected");
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

describe("a failure of Ignore…", () => {
  test("shows 409 TICKET_CVE_NOT_REJECTED at Reason, naming the CVE, which assistive technologies read with each reason, the reason chosen staying chosen, until another reason is chosen", async () => {
    const spy = showingIgnorable(REJECTED, {
      ticketChange: () => errorResponse(409, "TICKET_CVE_NOT_REJECTED"),
    });
    const { screen } = await renderTicket();
    const reads = requestsTo(spy, TICKET);

    const dialog = await ignoreAs(screen, "CVE rejected");

    const group = reasonGroup(dialog);
    await expect
      .element(group)
      .toHaveAccessibleDescription(MESSAGE_NOT_REJECTED);
    const chosen = reasonOf(dialog, "CVE rejected");
    await expect
      .element(chosen)
      .toHaveAccessibleDescription(`${CVE_REJECTED} ${MESSAGE_NOT_REJECTED}`);
    await expect.element(chosen).toBeChecked();
    // The message shows at the reason alone, after the reasons.
    const error = dialog.getByText(MESSAGE_NOT_REJECTED, { exact: true });
    expect(dialog.getByText(MESSAGE_NOT_REJECTED).elements()).toHaveLength(1);
    expect(boxOf(error).top).toBeGreaterThanOrEqual(
      boxOf(dialog.getByText(OTHER, { exact: true })).bottom,
    );
    expect(dialog.getByText(/^Reference:/).query()).toBeNull();
    // Whatever its outcome, the screen reads again what it affects.
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);

    await chooseReason(dialog, "Other");

    await expect.element(group).not.toHaveAccessibleDescription();
    await expect.element(chosen).toHaveAccessibleDescription(CVE_REJECTED);
    expect(dialog.getByText(MESSAGE_NOT_REJECTED).query()).toBeNull();
  });

  test("shows a field error of a VALIDATION_ERROR for reason at Reason, the reason chosen staying chosen, until another reason is chosen", async () => {
    showingIgnorable(
      {},
      { ticketChange: () => validationError([["body", "reason"]]) },
    );
    const { screen } = await renderTicket();

    const dialog = await ignoreAs(screen, "Other");

    const group = reasonGroup(dialog);
    await expect.element(group).toHaveAccessibleDescription(MESSAGE_INVALID);
    await expect.element(reasonOf(dialog, "Other")).toBeChecked();
    expect(dialog.getByText(MESSAGE_INVALID).elements()).toHaveLength(1);
    expect(dialog.getByText(MESSAGE_NOT_ACCEPTED).query()).toBeNull();

    await chooseReason(dialog, "Not shipped");

    await expect.element(group).not.toHaveAccessibleDescription();
  });

  test.each<[string, Partial<TicketDetail>, () => Response, string, string]>([
    [
      "409 TICKET_CVE_NOT_REJECTED",
      REJECTED,
      () => errorResponse(409, "TICKET_CVE_NOT_REJECTED"),
      "CVE rejected",
      MESSAGE_NOT_REJECTED,
    ],
    [
      "a field error of a VALIDATION_ERROR for reason",
      {},
      () => validationError([["body", "reason"]]),
      "Other",
      MESSAGE_INVALID,
    ],
    [
      "a field error of a VALIDATION_ERROR for reason, with the first reason chosen",
      {},
      () => validationError([["body", "reason"]]),
      "Not shipped",
      MESSAGE_INVALID,
    ],
  ])(
    "gives the focus to the reason chosen with the error of %s",
    async (_, fields, failure, name, message) => {
      showingIgnorable(fields, { ticketChange: failure });
      const { screen } = await renderTicket();

      const dialog = await ignoreAs(screen, name);

      await expect
        .element(reasonGroup(dialog))
        .toHaveAccessibleDescription(message);
      await expect.element(reasonOf(dialog, name)).toHaveFocus();
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
      "409 TICKET_INVALID_TRANSITION of a Ticket that became Analyzed meanwhile, as an error",
      () => errorResponse(409, "TICKET_INVALID_TRANSITION"),
      MESSAGE_CONFLICT,
      "danger",
      false,
    ],
    [
      "409 TICKET_NOT_MUTABLE of a Ticket that became Ignored or Duplicated meanwhile, as an error",
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
      "the code of the reason with another status, as an error",
      () => errorResponse(400, "TICKET_CVE_NOT_REJECTED"),
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
    "shows %s at the top of the form, which takes the focus and keeps the reason",
    async (_, failure, message, tone, referenced) => {
      const spy = showingIgnorable(REJECTED, { ticketChange: failure });
      const { screen } = await renderTicket();
      const reads = requestsTo(spy, TICKET);

      const dialog = await ignoreAs(screen, "CVE rejected");

      const error = dialog.getByText(message, { exact: true });
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES[tone]);
      await expectFocusOnError(error);
      expect(boxOf(error).bottom).toBeLessThan(boxOf(reasonGroup(dialog)).top);
      if (referenced) {
        await expect
          .element(dialog.getByText(REFERENCE, { exact: true }))
          .toBeVisible();
      } else {
        expect(dialog.getByText(/^Reference:/).query()).toBeNull();
      }
      await expect.element(reasonOf(dialog, "CVE rejected")).toBeChecked();
      await expect
        .element(reasonGroup(dialog))
        .not.toHaveAccessibleDescription();
      // Whatever its outcome, the screen reads again what it affects.
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    },
  );

  test("shows the error of the reason and of the form for a VALIDATION_ERROR with an error of another member, the form taking the focus", async () => {
    showingIgnorable(
      {},
      {
        ticketChange: () =>
          validationError([
            ["body", "reason"],
            ["body", "fictional_member"],
          ]),
      },
    );
    const { screen } = await renderTicket();

    const dialog = await ignoreAs(screen, "Other");

    const error = dialog.getByText(MESSAGE_NOT_ACCEPTED, { exact: true });
    await expect.element(error).toBeVisible();
    await expect
      .element(reasonGroup(dialog))
      .toHaveAccessibleDescription(MESSAGE_INVALID);
    await expectFocusOnError(error);
  });
});

describe("leaving Ignore…", () => {
  test.each(["Cancel", "Escape"])(
    "on %s without a reason chosen closes at once, and returns the focus to Actions",
    async (way) => {
      const spy = showingIgnorable();
      const { screen } = await renderTicket();
      const dialog = await openIgnore(screen);

      if (way === "Escape") {
        await userEvent.keyboard("{Escape}");
      } else {
        await cancelButton(dialog).click();
      }

      await expect.element(dialog).not.toBeInTheDocument();
      expect(discardDialog(screen).query()).toBeNull();
      await expectFocusSettledOn(actionsButton(screen));
      expect(ignores(spy)).toEqual([]);
    },
  );

  test("asks before Cancel or Escape discard the reason chosen, saying that the Ticket isn't ignored, keeps it on Keep editing, and closes on Discard", async () => {
    const spy = showingIgnorable();
    const { screen } = await renderTicket();
    const dialog = await openIgnore(screen);
    await chooseReason(dialog, "Other");

    await cancelButton(dialog).click();

    const discard = discardDialog(screen);
    await expect
      .element(discard.getByRole("button", { name: "Keep editing" }))
      .toHaveFocus();
    await expect
      .element(discard.getByText("SNTL-12 isn't ignored.", { exact: true }))
      .toBeVisible();
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect.element(discard).not.toBeInTheDocument();
    await expect.element(dialog).toBeVisible();
    await expect.element(reasonOf(dialog, "Other")).toBeChecked();

    await userEvent.keyboard("{Escape}");
    await expect.element(discard).toBeVisible();
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsButton(screen));
    expect(ignores(spy)).toEqual([]);
    // The dialog opens again without a reason chosen.
    const again = await openIgnore(screen);
    for (const radio of reasonGroup(again).getByRole("radio").elements()) {
      expect(radio).not.toBeChecked();
    }
  });

  test("asks before a navigation discards the reason chosen, and leaves on Discard", async () => {
    showingIgnorable();
    const { router, screen } = await renderTicket();
    const dialog = await openIgnore(screen);
    await chooseReason(dialog, "Not shipped");

    router.history.push("/tickets");

    const discard = discardDialog(screen);
    await expect.element(discard).toBeVisible();
    expect(router.state.location.pathname).toBe("/tickets/SNTL-12");
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
  });

  test("leaves at once on a navigation without a reason chosen", async () => {
    showingIgnorable();
    const { router, screen } = await renderTicket();
    await openIgnore(screen);

    router.history.push("/tickets");

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
    expect(discardDialog(screen).query()).toBeNull();
  });

  test("stays open without a reason chosen, with the heading row and Actions, when a navigation opens another tab of the Ticket, and the focus returns to Actions as the dialog closes", async () => {
    showingIgnorable();
    const { router, screen } = await renderTicket();
    const dialog = await openIgnore(screen);
    const first = reasonOf(dialog, "Not shipped");

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
    expect(document.activeElement).toBe(first.element());
    expect(discardDialog(screen).query()).toBeNull();
    await cancelButton(dialog).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/tickets/SNTL-12/audit-log");
    await expectFocusSettledOn(actionsButton(screen));
  });
});

describe("the reasons of Ignore…", () => {
  test.each<[string, Partial<TicketDetail>, Partial<TicketDetail>, string[]]>([
    [
      "no longer rejected",
      REJECTED,
      {},
      ["Not shipped", "CVE rejected", "Other"],
    ],
    ["rejected", {}, REJECTED, ["Not shipped", "Other"]],
  ])(
    "stay those of the Ticket as the dialog opened when a read meanwhile shows its CVE %s",
    async (_, before, after, names) => {
      let fields = before;
      showingIgnorable({}, { ticket: () => inAnalysis(fields) });
      const { screen } = await renderTicket();
      const dialog = await openIgnore(screen);
      expectReasons(dialog, names);
      // The CVE part, behind the dialog, shows the label Rejected while the
      // CVE is rejected.
      const rejectedShown = () =>
        screen.getByText("Rejected", { exact: true }).elements().length > 0;
      expect(rejectedShown()).toBe(before.cve?.cve_state === "rejected");
      fields = after;

      await returnToForeground();

      await readEnded(TICKET);
      await expect
        .poll(rejectedShown)
        .toBe(after.cve?.cve_state === "rejected");
      await nextFrames();
      expectReasons(dialog, names);
    },
  );
});
