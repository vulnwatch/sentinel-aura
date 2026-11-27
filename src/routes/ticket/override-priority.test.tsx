import { describe, expect, test } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import { TicketPriorityValue } from "../../api/generated/model";
import type { TicketDetail } from "../../api/generated/model";
import {
  errorResponse,
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
  mainContent,
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

// Override priority…, the dialog that Actions opens in the heading row of
// the Ticket screen (src/routes/ticket/override-priority.tsx;
// docs/screens/ticket.md, Actions; States), shown over Overview, at the
// browser's default text size, in the light theme.

prepareEachTest();

const EXPLANATION =
  "An override replaces the automatic priority of SNTL-12 until it is cleared. Sentinel keeps calculating the automatic priority.";

// The options of Priority, in their order, each with its meaning, for the
// Ticket of the tests, whose automatic priority is P2.
const OPTIONS: [string, string][] = [
  ["Automatic", "The automatic priority, now P2."],
  ["P1", "Remediate immediately."],
  ["P2", "Remediate with high urgency."],
  ["P3", "Remediate in the normal flow."],
  ["P4", "Remediate when convenient."],
];

const MESSAGE_FORBIDDEN = "You don't have permission to do this.";
const PRIORITY = `${TICKET}/priority`;

// SNTL-12 in Analysis, with the fields that a test sets, as Get Ticket
// returns it.
function inAnalysis(fields: Partial<TicketDetail> = {}): Response {
  return ticketResponse(
    fictionalTicketDetail({ status: "analysis", ...fields }),
  );
}

// SNTL-12 with the override, as Set Priority Override returns it, its
// effective priority the override or, without one, its automatic priority,
// P2 unless the test sets another.
function overriddenWith(
  override: TicketDetail["priority_override"],
  fields: Partial<TicketDetail> = {},
): Response {
  const automatic =
    fields.priority_automatic === undefined ? "p2" : fields.priority_automatic;
  return ticketResponse(
    fictionalTicketDetail({
      status: "analysis",
      priority_override: override,
      priority: override ?? automatic,
      ...fields,
    }),
  );
}

// The override that a body of Set Priority Override sends.
function priorityIn(body: unknown): TicketDetail["priority_override"] {
  const sent =
    typeof body === "object" && body !== null && "priority" in body
      ? body.priority
      : null;
  return (
    Object.values(TicketPriorityValue).find((level) => level === sent) ?? null
  );
}

// Answers for the analyst, who holds triage_ticket, with SNTL-12 in Analysis
// with the fields, and Set Priority Override with SNTL-12 with the override
// sent, and the other responses that the test sets.
function showingOverridable(
  fields: Partial<TicketDetail> = {},
  stub: Partial<Stub> = {},
) {
  return stubTicket({
    user: OTHER_USER,
    ticket: () => inAnalysis(fields),
    ticketChange: (_, body) => overriddenWith(priorityIn(body)),
    ...stub,
  });
}

// Answers as showingOverridable does, with Get Ticket returning SNTL-12 in
// Analysis until Set Priority Override answers, and then as it returned it.
function showingChange(
  answer: () => Response | Promise<Response>,
  fields: Partial<TicketDetail> = {},
) {
  let changed = false;
  return showingOverridable(fields, {
    ticket: () => (changed ? answer() : inAnalysis(fields)),
    ticketChange: () => {
      changed = true;
      return answer();
    },
  });
}

function actionsButton(screen: Screen) {
  return screen.getByRole("button", {
    name: "Actions of SNTL-12",
    exact: true,
  });
}

function overrideDialog(screen: Screen) {
  return screen.getByRole("dialog", {
    name: "Override the priority of SNTL-12",
    exact: true,
  });
}

function discardDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Discard changes?" });
}

function priorityGroup(dialog: Locator) {
  return dialog.getByRole("radiogroup", { name: "Priority", exact: true });
}

function optionOf(dialog: Locator, name: string) {
  return dialog.getByRole("radio", { name, exact: true });
}

function saveButton(dialog: Locator) {
  return dialog.getByRole("button", { name: "Save", exact: true });
}

function cancelButton(dialog: Locator) {
  return dialog.getByRole("button", { name: "Cancel", exact: true });
}

// Opens Override priority… from Actions and waits until the option of the
// name, the one chosen, has the focus.
async function openOverride(screen: Screen, focused = "Automatic") {
  await actionsButton(screen).click();
  await screen
    .getByRole("menuitem", { name: "Override priority…", exact: true })
    .click();
  const dialog = overrideDialog(screen);
  await expect.element(optionOf(dialog, focused)).toHaveFocus();
  return dialog;
}

// Chooses the option with a press of its meaning, as the user does.
async function choose(dialog: Locator, name: string) {
  const meaning = OPTIONS.find(([option]) => option === name)?.[1] ?? name;
  await dialog.getByText(meaning, { exact: true }).click();
  await expect.element(optionOf(dialog, name)).toBeChecked();
}

// Opens the dialog, chooses the option, and saves it.
async function overrideWith(screen: Screen, name: string, focused?: string) {
  const dialog = await openOverride(screen, focused);
  await choose(dialog, name);
  await saveButton(dialog).click();
  return dialog;
}

// The bodies of the requests of Set Priority Override.
function overrides(spy: ReturnType<typeof stubApi>): unknown[] {
  return spy.mock.calls
    .filter(
      ([input, init]) =>
        init?.method === "PATCH" && urlOf(input).pathname === PRIORITY,
    )
    .map(([, init]) =>
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    );
}

// The nearest element around the element with a boundary, its frame.
function frameOf(element: Element): Element {
  let node = element.parentElement;
  while (node !== null && getComputedStyle(node).borderTopWidth !== "1px") {
    node = node.parentElement;
  }
  return node ?? document.body;
}

describe("the dialog of Override priority…", () => {
  test("says in fg-muted what an override does, shows the automatic priority with its basis in a frame, then Priority with Automatic and the levels, each with its meaning, Automatic chosen and focused without an override, then Cancel and Save, at most 560 px wide", async () => {
    showingOverridable();
    const { screen } = await renderTicket();

    const dialog = await openOverride(screen);

    const explanation = dialog.getByText(EXPLANATION, { exact: true });
    await expect.element(explanation).toBeVisible();
    expect(getComputedStyle(explanation.element()).color).toBe(FG_MUTED);
    // The basis, as the explanation of an override shows it, its headings
    // one level below the title of the dialog.
    const basis = dialog.getByRole("heading", {
      level: 4,
      name: "Automatic priority",
      exact: true,
    });
    await expect.element(basis).toBeVisible();
    await expect
      .element(
        dialog.getByRole("heading", {
          level: 4,
          name: "Evidence",
          exact: true,
        }),
      )
      .toBeVisible();
    for (const text of ["Severity", "High", "Exploitation", "Likely"]) {
      await expect
        .element(dialog.getByText(text, { exact: true }).first())
        .toBeVisible();
    }
    await expect
      .element(dialog.getByText("SSVC exploitation PoC", { exact: true }))
      .toBeVisible();
    const frame = getComputedStyle(frameOf(basis.element()));
    expect([frame.borderTopWidth, frame.borderTopLeftRadius]).toEqual([
      "1px",
      "8px",
    ]);
    const group = priorityGroup(dialog);
    expect(boxOf(explanation).bottom).toBeLessThan(boxOf(basis).top);
    expect(boxOf(basis).bottom).toBeLessThan(boxOf(group).top);
    const radios = group.getByRole("radio").elements();
    expect(radios).toHaveLength(OPTIONS.length);
    for (const [index, [name, meaning]] of OPTIONS.entries()) {
      const option = optionOf(dialog, name);
      expect(option.element()).toBe(radios[index]);
      await expect.element(option).toHaveAccessibleDescription(meaning);
    }
    await expect.element(optionOf(dialog, "Automatic")).toBeChecked();
    expect(textsOf(dialog.getByRole("button"))).toEqual(["Cancel", "Save"]);
    expect(boxOf(dialog).width).toBe(560);
  });

  test("spans the frame of the automatic priority and Priority, as what the dialog says, from its start to the end of its buttons", async () => {
    showingOverridable();
    const { screen } = await renderTicket();

    const dialog = await openOverride(screen);

    // To within the rounding of a browser.
    const explanation = boxOf(dialog.getByText(EXPLANATION, { exact: true }));
    const end = boxOf(saveButton(dialog)).right;
    expect(explanation.right).toBeCloseTo(end, 0);
    const frame = frameOf(
      dialog
        .getByRole("heading", {
          level: 4,
          name: "Automatic priority",
          exact: true,
        })
        .element(),
    ).getBoundingClientRect();
    expect(frame.left).toBeCloseTo(explanation.left, 0);
    expect(frame.right).toBeCloseTo(end, 0);
    const group = boxOf(priorityGroup(dialog));
    expect(group.left).toBeCloseTo(explanation.left, 0);
    expect(group.right).toBeCloseTo(end, 0);
  });

  test("chooses and focuses the override with which the dialog opens", async () => {
    showingOverridable({ priority: "p1", priority_override: "p1" });
    const { screen } = await renderTicket();

    const dialog = await openOverride(screen, "P1");

    await expect.element(optionOf(dialog, "P1")).toBeChecked();
    await expect.element(optionOf(dialog, "Automatic")).not.toBeChecked();
  });

  test("says that the automatic priority is not yet prioritizable when Sentinel cannot prioritize the Ticket", async () => {
    showingOverridable({
      priority: null,
      priority_automatic: null,
      priority_automatic_basis: {
        severity: null,
        exploitation: "unknown",
        evidence: [],
      },
    });
    const { screen } = await renderTicket();

    const dialog = await openOverride(screen);

    await expect
      .element(optionOf(dialog, "Automatic"))
      .toHaveAccessibleDescription(
        "The automatic priority, not yet prioritizable now.",
      );
    await expect
      .element(dialog.getByText("Not yet prioritizable", { exact: true }))
      .toBeVisible();
  });

  test("shows the automatic priority and its basis as a read of the Ticket shows them while it is open, keeping the choice", async () => {
    let fields: Partial<TicketDetail> = {};
    showingOverridable({}, { ticket: () => inAnalysis(fields) });
    const { screen } = await renderTicket();
    const dialog = await openOverride(screen);
    await choose(dialog, "P3");
    fields = {
      priority: "p1",
      priority_automatic: "p1",
      priority_automatic_basis: {
        severity: "high",
        exploitation: "kev",
        evidence: [{ kind: "kev", value: "2099-10-09" }],
      },
    };

    await returnToForeground();

    await readEnded(TICKET);
    await expect
      .element(optionOf(dialog, "Automatic"))
      .toHaveAccessibleDescription("The automatic priority, now P1.");
    await expect
      .element(dialog.getByText(/^Listed in CISA KEV on /))
      .toBeVisible();
    await expect.element(optionOf(dialog, "P3")).toBeChecked();
  });

  test("chooses none for an override that the pinned contract does not list, and says Choose a priority. at Priority on Save, the first option taking the focus, without a request", async () => {
    const spy = showingOverridable(
      {},
      {
        ticket: () =>
          jsonResponse(200, {
            data: {
              ...fictionalTicketDetail({ status: "analysis" }),
              priority: "p9",
              priority_override: "p9",
            },
          }),
      },
    );
    const { screen } = await renderTicket();
    await actionsButton(screen).click();
    await screen
      .getByRole("menuitem", { name: "Override priority…", exact: true })
      .click();
    const dialog = overrideDialog(screen);
    await expect.element(optionOf(dialog, "Automatic")).toHaveFocus();
    for (const radio of priorityGroup(dialog).getByRole("radio").elements()) {
      expect(radio).not.toBeChecked();
    }

    await saveButton(dialog).click();

    await expect
      .element(priorityGroup(dialog))
      .toHaveAccessibleDescription("Choose a priority.");
    await expect.element(optionOf(dialog, "Automatic")).toHaveFocus();
    expect(overrides(spy)).toEqual([]);
  });
});

describe("the submission of Override priority…", () => {
  test("closes without a request when Save keeps the choice with which the dialog opened, and returns the focus to Actions", async () => {
    const spy = showingOverridable();
    const { screen } = await renderTicket();
    const dialog = await openOverride(screen);

    await saveButton(dialog).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(discardDialog(screen).query()).toBeNull();
    await expectFocusSettledOn(actionsButton(screen));
    expect(overrides(spy)).toEqual([]);
  });

  test("closes without a request when Save keeps the choice with which the dialog opened, also after a read meanwhile shows another override", async () => {
    let fields: Partial<TicketDetail> = {};
    const spy = showingOverridable({}, { ticket: () => inAnalysis(fields) });
    const { screen } = await renderTicket();
    const dialog = await openOverride(screen);
    // Another user overrides the priority with P2 meanwhile.
    fields = { priority: "p2", priority_override: "p2" };

    await returnToForeground();

    await readEnded(TICKET);
    // The priority of the heading row, behind the dialog, which keeps it
    // from assistive technologies, shows the override.
    await expect
      .element(
        screen.getByRole("button", {
          name: "P2, override",
          exact: true,
          includeHidden: true,
        }),
      )
      .toBeInTheDocument();
    await expect.element(optionOf(dialog, "Automatic")).toBeChecked();
    await saveButton(dialog).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(discardDialog(screen).query()).toBeNull();
    await expectFocusSettledOn(actionsButton(screen));
    expect(overrides(spy)).toEqual([]);
  });

  test.each<[string, Partial<TicketDetail>, string, string, unknown, string]>([
    [
      "sets an override",
      {},
      "Automatic",
      "P1",
      { priority: "p1" },
      "Priority overridden: P1.",
    ],
    [
      "changes an override",
      { priority: "p1", priority_override: "p1" },
      "P1",
      "P4",
      { priority: "p4" },
      "Priority overridden: P4.",
    ],
    [
      "clears an override with Automatic",
      { priority: "p1", priority_override: "p1" },
      "P1",
      "Automatic",
      { priority: null },
      "Priority override cleared: P2, automatic.",
    ],
  ])(
    "%s, sending the level chosen or null with nothing else in the body, and announces the priority that Sentinel returns once the read of the Ticket after it arrives",
    async (_, fields, focused, name, body, text) => {
      const sent = priorityIn(body);
      const spy = showingChange(() => overriddenWith(sent), fields);
      const { screen } = await renderTicket();

      const dialog = await overrideWith(screen, name, focused);

      await expect.element(dialog).not.toBeInTheDocument();
      expect(overrides(spy)).toEqual([body]);
      await expect.poll(() => announcements()).toContain(text);
      await expectFocusSettledOn(actionsButton(screen));
    },
  );

  test("announces that a Ticket whose override is cleared is not yet prioritizable when Sentinel returns no priority", async () => {
    showingChange(
      () => overriddenWith(null, { priority_automatic: null, priority: null }),
      { priority: "p1", priority_override: "p1" },
    );
    const { screen } = await renderTicket();

    await overrideWith(screen, "Automatic", "P1");

    await expect
      .poll(() => announcements())
      .toContain("Priority override cleared: not yet prioritizable.");
  });

  test("is busy while the change is in progress, sends one request, keeps the choice, read-only, and cannot be closed", async () => {
    const response = later();
    const spy = showingOverridable(
      {},
      { ticketChange: () => response.promise },
    );
    const { screen } = await renderTicket();

    const dialog = await overrideWith(screen, "P3");

    await expect
      .element(saveButton(dialog))
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(cancelButton(dialog)).toBeDisabled();
    await expect
      .element(priorityGroup(dialog))
      .toHaveAttribute("aria-readonly", "true");
    await saveButton(dialog).click({ force: true });
    await dialog.getByText("Remediate immediately.", { exact: true }).click();
    await userEvent.keyboard("{Escape}");
    await nextFrames();
    await expect.element(dialog).toBeVisible();
    expect(discardDialog(screen).query()).toBeNull();
    await expect.element(optionOf(dialog, "P3")).toBeChecked();
    expect(overrides(spy)).toHaveLength(1);

    response.resolve(overriddenWith("p3"));

    await expect.element(dialog).not.toBeInTheDocument();
  });
});

describe("the outcome of Override priority…", () => {
  test("shows the outcome in the message area when the read of the Ticket after it fails", async () => {
    let changed = false;
    showingOverridable(
      {},
      {
        ticket: () =>
          changed ? errorResponse(503, "SERVICE_UNAVAILABLE") : inAnalysis(),
        ticketChange: () => {
          changed = true;
          return overriddenWith("p1");
        },
      },
    );
    const { screen } = await renderTicket();

    await overrideWith(screen, "P1");

    await expectSuccessMessage(screen, "Priority overridden: P1.");
  });

  test("reads again the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, and the reads of the Ticket list, but not its duplicates, which the change leaves as they are", async () => {
    const spy = showingOverridable(
      { packages: [fictionalPackage()] },
      {
        user: { data: { ...MAINTAINER.data, capabilities: ["triage_ticket"] } },
      },
    );
    const { screen } = await renderTicket();
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
    const dialog = await openOverride(screen);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      actors: requestsTo(spy, ACTORS),
      work: requestsTo(spy, YOUR_WORK),
      duplicates: readsOf(spy, TICKETS),
    };
    client.setQueryData([EVENTS], {});
    client.setQueryData([TICKETS, { page: 1 }], {});

    await choose(dialog, "P1");
    await saveButton(dialog).click();

    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(reads.work + 1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    // The read of the duplicates, which the details show, is not sent again.
    expect(readsOf(spy, TICKETS)).toBe(reads.duplicates);
    expect(leftInvalidated(EVENTS)).toBe(true);
    expect(leftInvalidated(TICKETS)).toBe(true);
  });

  test("shows the outcome of a change that ends after the user left the screen in the message area, naming the Ticket", async () => {
    const response = later();
    showingOverridable({}, { ticketChange: () => response.promise });
    const { router, screen } = await renderTicket();
    const dialog = await overrideWith(screen, "P1");
    await expect
      .element(saveButton(dialog))
      .toHaveAttribute("aria-disabled", "true");

    await leaveForTickets(router, screen);
    response.resolve(overriddenWith("p1"));

    const message = mainContent(screen).getByText(
      "SNTL-12: Priority overridden: P1.",
      { exact: true },
    );
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
  });

  test("shows a failure that ends after the user left the screen in the message area, naming the Ticket", async () => {
    const response = later();
    showingOverridable({}, { ticketChange: () => response.promise });
    const { router, screen } = await renderTicket();
    const dialog = await overrideWith(screen, "P1");
    await expect
      .element(saveButton(dialog))
      .toHaveAttribute("aria-disabled", "true");

    await leaveForTickets(router, screen);
    response.resolve(errorResponse(409, "TICKET_NOT_MUTABLE"));

    const error = mainContent(screen).getByText(
      `SNTL-12: ${MESSAGE_CONFLICT}`,
      { exact: true },
    );
    await expect.element(error).toBeVisible();
    expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES.danger);
  });
});

describe("a failure of Override priority…", () => {
  test("shows a field error of a VALIDATION_ERROR for priority at Priority, the choice staying chosen and focused, until another is chosen", async () => {
    showingOverridable(
      {},
      { ticketChange: () => validationError([["body", "priority"]]) },
    );
    const { screen } = await renderTicket();

    const dialog = await overrideWith(screen, "P3");

    const group = priorityGroup(dialog);
    await expect.element(group).toHaveAccessibleDescription(MESSAGE_INVALID);
    await expect.element(optionOf(dialog, "P3")).toBeChecked();
    await expect.element(optionOf(dialog, "P3")).toHaveFocus();
    expect(dialog.getByText(MESSAGE_NOT_ACCEPTED).query()).toBeNull();

    await choose(dialog, "P4");

    await expect.element(group).not.toHaveAccessibleDescription();
  });

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
      "409 TICKET_NOT_MUTABLE of a Ticket that became Ignored meanwhile, as an error",
      () => errorResponse(409, "TICKET_NOT_MUTABLE"),
      MESSAGE_CONFLICT,
      "danger",
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
    "shows %s at the top of the form, which takes the focus and keeps the choice",
    async (_, failure, message, tone, referenced) => {
      const spy = showingOverridable({}, { ticketChange: failure });
      const { screen } = await renderTicket();
      const reads = requestsTo(spy, TICKET);

      const dialog = await overrideWith(screen, "P3");

      const error = dialog.getByText(message, { exact: true });
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES[tone]);
      await expectFocusOnError(error);
      expect(boxOf(error).bottom).toBeLessThan(
        boxOf(priorityGroup(dialog)).top,
      );
      if (referenced) {
        await expect
          .element(dialog.getByText(REFERENCE, { exact: true }))
          .toBeVisible();
      } else {
        expect(dialog.getByText(/^Reference:/).query()).toBeNull();
      }
      await expect.element(optionOf(dialog, "P3")).toBeChecked();
      await expect
        .element(priorityGroup(dialog))
        .not.toHaveAccessibleDescription();
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    },
  );
});

describe("leaving Override priority…", () => {
  test("asks before Cancel discards another choice, saying that the priority isn't changed, keeps it on Keep editing, and closes on Discard", async () => {
    const spy = showingOverridable();
    const { screen } = await renderTicket();
    const dialog = await openOverride(screen);
    await choose(dialog, "P1");

    await cancelButton(dialog).click();

    const discard = discardDialog(screen);
    await expect
      .element(
        discard.getByText("The priority of SNTL-12 isn't changed.", {
          exact: true,
        }),
      )
      .toBeVisible();
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect.element(discard).not.toBeInTheDocument();
    await expect.element(optionOf(dialog, "P1")).toBeChecked();

    await userEvent.keyboard("{Escape}");
    await expect.element(discard).toBeVisible();
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsButton(screen));
    expect(overrides(spy)).toEqual([]);
  });

  test("closes at once on Cancel when the choice is the one with which it opened, also after another choice was undone", async () => {
    showingOverridable();
    const { screen } = await renderTicket();
    const dialog = await openOverride(screen);
    await choose(dialog, "P1");
    await choose(dialog, "Automatic");

    await cancelButton(dialog).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(discardDialog(screen).query()).toBeNull();
  });
});
