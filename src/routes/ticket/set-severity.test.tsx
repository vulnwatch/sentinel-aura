import { describe, expect, test } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import { SeverityValue } from "../../api/generated/model";
import type { TicketDetail } from "../../api/generated/model";
import {
  errorResponse,
  fictionalCve,
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
  FG_MUTED,
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

// Set severity…, the dialog that Actions opens in the heading row of the
// Ticket screen for a Ticket without a CVE
// (src/routes/ticket/set-severity.tsx; docs/screens/ticket.md, Actions;
// States), shown over Overview, at the browser's default text size, in the
// light theme.

prepareEachTest();

const EXPLANATION =
  "Without a CVE, SNTL-12 has the severity that you set here. It decides the deadlines and the automatic priority of SNTL-12.";
const NONE = "Informational: no deadline applies.";
const NOT_SET = "SNTL-12 can't become Analyzed without a severity.";
const NOT_SET_RETURNS = "SNTL-12 returns to Analysis without a severity.";
const MESSAGE_DERIVED =
  "SNTL-12 now has a CVE, whose CVSS assessments set its severity.";

const SEVERITY = `${TICKET}/severity`;

// The options of Severity, in their order.
const OPTIONS = ["Critical", "High", "Medium", "Low", "None", "Not set"];

// SNTL-12 without a CVE in Analysis, with the severity High set by hand
// unless the test sets another, as Get Ticket returns it.
function withoutCve(fields: Partial<TicketDetail> = {}): Response {
  return ticketResponse(
    fictionalTicketDetail({ status: "analysis", cve: null, ...fields }),
  );
}

// The severity that a body of Set Severity Manual sends.
function severityIn(body: unknown): TicketDetail["severity"] {
  const sent =
    typeof body === "object" && body !== null && "severity" in body
      ? body.severity
      : null;
  return Object.values(SeverityValue).find((value) => value === sent) ?? null;
}

// Answers for the analyst, who holds triage_ticket, with SNTL-12 without a
// CVE, and Set Severity Manual with SNTL-12 with the severity sent.
function showingSettable(
  fields: Partial<TicketDetail> = {},
  stub: Partial<Stub> = {},
) {
  return stubTicket({
    user: OTHER_USER,
    ticket: () => withoutCve(fields),
    ticketChange: (_, body) => withoutCve({ severity: severityIn(body) }),
    ...stub,
  });
}

function actionsButton(screen: Screen) {
  return screen.getByRole("button", {
    name: "Actions of SNTL-12",
    exact: true,
  });
}

function severityDialog(screen: Screen) {
  return screen.getByRole("dialog", {
    name: "Set the severity of SNTL-12",
    exact: true,
  });
}

function discardDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Discard changes?" });
}

function severityGroup(dialog: Locator) {
  return dialog.getByRole("radiogroup", { name: "Severity", exact: true });
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

// Opens Set severity… from Actions and waits until the option of the name,
// the one chosen, has the focus.
async function openSeverity(screen: Screen, focused = "High") {
  await actionsButton(screen).click();
  await screen
    .getByRole("menuitem", { name: "Set severity…", exact: true })
    .click();
  const dialog = severityDialog(screen);
  await expect.element(optionOf(dialog, focused)).toHaveFocus();
  return dialog;
}

// Chooses the option with a press of its label, as the user does.
async function choose(dialog: Locator, name: string) {
  await severityGroup(dialog).getByText(name, { exact: true }).click();
  await expect.element(optionOf(dialog, name)).toBeChecked();
}

async function setTo(screen: Screen, name: string, focused?: string) {
  const dialog = await openSeverity(screen, focused);
  await choose(dialog, name);
  await saveButton(dialog).click();
  return dialog;
}

// The bodies of the requests of Set Severity Manual.
function severities(spy: ReturnType<typeof stubApi>): unknown[] {
  return spy.mock.calls
    .filter(
      ([input, init]) =>
        init?.method === "PATCH" && urlOf(input).pathname === SEVERITY,
    )
    .map(([, init]) =>
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    );
}

describe("the dialog of Set severity…", () => {
  test("says in fg-muted what the severity decides, then shows Severity with the severities, None and Not set with their meanings, the severity of the Ticket chosen and focused, then Cancel and Save, at most 560 px wide", async () => {
    showingSettable();
    const { screen } = await renderTicket();

    const dialog = await openSeverity(screen);

    const explanation = dialog.getByText(EXPLANATION, { exact: true });
    await expect.element(explanation).toBeVisible();
    expect(getComputedStyle(explanation.element()).color).toBe(FG_MUTED);
    const radios = severityGroup(dialog).getByRole("radio").elements();
    expect(radios).toHaveLength(OPTIONS.length);
    for (const [index, name] of OPTIONS.entries()) {
      expect(optionOf(dialog, name).element()).toBe(radios[index]);
    }
    for (const name of ["Critical", "High", "Medium", "Low"]) {
      await expect
        .element(optionOf(dialog, name))
        .not.toHaveAccessibleDescription();
    }
    await expect
      .element(optionOf(dialog, "None"))
      .toHaveAccessibleDescription(NONE);
    await expect
      .element(optionOf(dialog, "Not set"))
      .toHaveAccessibleDescription(NOT_SET);
    // Each severity shows its mark before its name.
    const critical = severityGroup(dialog)
      .getByText("Critical", { exact: true })
      .element();
    expect(
      critical.parentElement?.querySelector("svg[aria-hidden]"),
    ).not.toBeNull();
    await expect.element(optionOf(dialog, "High")).toBeChecked();
    expect(textsOf(dialog.getByRole("button"))).toEqual(["Cancel", "Save"]);
    expect(boxOf(dialog).width).toBe(560);
  });

  test("chooses and focuses Not set for a Ticket without a severity", async () => {
    showingSettable({ severity: null });
    const { screen } = await renderTicket();

    const dialog = await openSeverity(screen, "Not set");

    await expect.element(optionOf(dialog, "Not set")).toBeChecked();
  });

  test.each(["analyzed", "resolved"] as const)(
    "says at Not set that a Ticket in %s returns to Analysis without a severity",
    async (status) => {
      showingSettable({ status });
      const { screen } = await renderTicket();

      const dialog = await openSeverity(screen);

      await expect
        .element(optionOf(dialog, "Not set"))
        .toHaveAccessibleDescription(NOT_SET_RETURNS);
    },
  );

  test("says at Not set what it means for the status of the Ticket as a read shows it while it is open, keeping the choice, and that a Ticket of a status that the pinned contract does not list can't become Analyzed", async () => {
    // The status that the reads of the Ticket return, one that the pinned
    // contract does not list included.
    let status = "analysis";
    showingSettable(
      {},
      {
        ticket: () =>
          jsonResponse(200, {
            data: {
              ...fictionalTicketDetail({ status: "analysis", cve: null }),
              status,
            },
          }),
      },
    );
    const { screen } = await renderTicket();
    const dialog = await openSeverity(screen);
    await choose(dialog, "Low");
    status = "analyzed";

    await returnToForeground();

    await readEnded(TICKET);
    await expect
      .element(optionOf(dialog, "Not set"))
      .toHaveAccessibleDescription(NOT_SET_RETURNS);
    await expect.element(optionOf(dialog, "Low")).toBeChecked();

    status = "fictional_status";
    await returnToForeground();

    await readEnded(TICKET);
    await expect
      .element(optionOf(dialog, "Not set"))
      .toHaveAccessibleDescription(NOT_SET);
    await expect.element(optionOf(dialog, "Low")).toBeChecked();
  });

  test("chooses none for a severity that the pinned contract does not list, and says Choose a severity. on Save, without a request", async () => {
    const spy = showingSettable(
      {},
      {
        ticket: () =>
          jsonResponse(200, {
            data: {
              ...fictionalTicketDetail({ status: "analysis", cve: null }),
              severity: "fictional_severity",
            },
          }),
      },
    );
    const { screen } = await renderTicket();
    const dialog = await openSeverity(screen, "Critical");
    for (const radio of severityGroup(dialog).getByRole("radio").elements()) {
      expect(radio).not.toBeChecked();
    }

    await saveButton(dialog).click();

    await expect
      .element(severityGroup(dialog))
      .toHaveAccessibleDescription("Choose a severity.");
    await expect.element(optionOf(dialog, "Critical")).toHaveFocus();
    expect(severities(spy)).toEqual([]);
  });
});

describe("the submission of Set severity…", () => {
  test("closes without a request when Save keeps the severity with which the dialog opened", async () => {
    const spy = showingSettable();
    const { screen } = await renderTicket();
    const dialog = await openSeverity(screen);

    await saveButton(dialog).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsButton(screen));
    expect(severities(spy)).toEqual([]);
  });

  test("closes without a request when Save keeps the severity with which the dialog opened, also after a read meanwhile shows another severity", async () => {
    let fields: Partial<TicketDetail> = {};
    const spy = showingSettable({}, { ticket: () => withoutCve(fields) });
    const { screen } = await renderTicket();
    const dialog = await openSeverity(screen);
    // Another user sets the severity Critical meanwhile.
    fields = { severity: "critical" };

    await returnToForeground();

    await readEnded(TICKET);
    // The heading row, behind the dialog, which keeps it from assistive
    // technologies, shows the severity Critical, the one text Critical of
    // the main content, outside which the dialog shows.
    await expect
      .element(
        screen
          .getByRole("main", { includeHidden: true })
          .getByText("Critical", { exact: true }),
      )
      .toBeInTheDocument();
    await expect.element(optionOf(dialog, "High")).toBeChecked();
    await saveButton(dialog).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(discardDialog(screen).query()).toBeNull();
    await expectFocusSettledOn(actionsButton(screen));
    expect(severities(spy)).toEqual([]);
  });

  test.each<[string, TicketDetail["severity"], string]>([
    ["Critical", "critical", "Severity set to Critical."],
    ["None", "none", "Severity set to None."],
    ["Not set", null, "Severity removed."],
  ])(
    "sends %s as %j, with nothing else in the body, and announces the severity that Sentinel returns once the read of the Ticket after it arrives",
    async (name, severity, text) => {
      let changed = false;
      const spy = showingSettable(
        {},
        {
          ticket: () => (changed ? withoutCve({ severity }) : withoutCve()),
          ticketChange: () => {
            changed = true;
            return withoutCve({ severity });
          },
        },
      );
      const { screen } = await renderTicket();

      const dialog = await setTo(screen, name);

      await expect.element(dialog).not.toBeInTheDocument();
      expect(severities(spy)).toEqual([{ severity }]);
      await expect.poll(() => announcements(screen)).toContain(text);
      await expectFocusSettledOn(actionsButton(screen));
    },
  );

  test("is busy while the change is in progress, sends one request, keeps the choice, read-only, and cannot be closed", async () => {
    const response = later();
    const spy = showingSettable({}, { ticketChange: () => response.promise });
    const { screen } = await renderTicket();

    const dialog = await setTo(screen, "Low");

    await expect
      .element(saveButton(dialog))
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(cancelButton(dialog)).toBeDisabled();
    await expect
      .element(severityGroup(dialog))
      .toHaveAttribute("aria-readonly", "true");
    await saveButton(dialog).click({ force: true });
    await severityGroup(dialog).getByText("Critical", { exact: true }).click();
    await userEvent.keyboard("{Escape}");
    await nextFrames();
    await expect.element(dialog).toBeVisible();
    expect(discardDialog(screen).query()).toBeNull();
    await expect.element(optionOf(dialog, "Low")).toBeChecked();
    await expect.element(optionOf(dialog, "Critical")).not.toBeChecked();
    expect(severities(spy)).toHaveLength(1);

    response.resolve(withoutCve({ severity: "low" }));

    await expect.element(dialog).not.toBeInTheDocument();
  });

  test("reads again the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, and the reads of the Ticket list, but not its duplicates, which the change leaves as they are", async () => {
    const spy = showingSettable(
      { packages: [fictionalPackage()] },
      {
        user: { data: { ...MAINTAINER.data, capabilities: ["triage_ticket"] } },
      },
    );
    const { screen } = await renderTicket();
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
    const dialog = await openSeverity(screen);
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

    await choose(dialog, "Low");
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
});

describe("a failure of Set severity…", () => {
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
      "409 TICKET_SEVERITY_DERIVED, of a Ticket that another user associated with a CVE meanwhile, as an error",
      () => errorResponse(409, "TICKET_SEVERITY_DERIVED"),
      MESSAGE_DERIVED,
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
      "the code of a derived severity with another status, as an error",
      () => errorResponse(400, "TICKET_SEVERITY_DERIVED"),
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
      "a VALIDATION_ERROR of no field, as an error",
      () => validationError([["body"]]),
      MESSAGE_NOT_ACCEPTED,
      "danger",
      false,
    ],
  ])(
    "shows %s at the top of the form, which takes the focus and keeps the choice",
    async (_, failure, message, tone, referenced) => {
      showingSettable({}, { ticketChange: failure });
      const { screen } = await renderTicket();

      const dialog = await setTo(screen, "Low");

      const error = dialog.getByText(message, { exact: true });
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES[tone]);
      await expectFocusOnError(error);
      expect(boxOf(error).bottom).toBeLessThan(
        boxOf(severityGroup(dialog)).top,
      );
      if (referenced) {
        await expect
          .element(dialog.getByText(REFERENCE, { exact: true }))
          .toBeVisible();
      } else {
        expect(dialog.getByText(/^Reference:/).query()).toBeNull();
      }
      await expect.element(optionOf(dialog, "Low")).toBeChecked();
      await expect
        .element(severityGroup(dialog))
        .not.toHaveAccessibleDescription();
    },
  );

  test("shows a field error of a VALIDATION_ERROR for severity at Severity, until another severity is chosen", async () => {
    showingSettable(
      {},
      { ticketChange: () => validationError([["body", "severity"]]) },
    );
    const { screen } = await renderTicket();

    const dialog = await setTo(screen, "Low");

    const group = severityGroup(dialog);
    await expect.element(group).toHaveAccessibleDescription(MESSAGE_INVALID);
    await expect.element(optionOf(dialog, "Low")).toHaveFocus();

    await choose(dialog, "Medium");

    await expect.element(group).not.toHaveAccessibleDescription();
  });

  test("shows 409 TICKET_SEVERITY_DERIVED of a change that ends after the user left the screen in the message area, naming the Ticket", async () => {
    const response = later();
    showingSettable({}, { ticketChange: () => response.promise });
    const { router, screen } = await renderTicket();
    const dialog = await setTo(screen, "Low");
    await expect
      .element(saveButton(dialog))
      .toHaveAttribute("aria-disabled", "true");

    await leaveForTickets(router, screen);
    response.resolve(errorResponse(409, "TICKET_SEVERITY_DERIVED"));

    const error = screen.getByText(`SNTL-12: ${MESSAGE_DERIVED}`, {
      exact: true,
    });
    await expect.element(error).toBeVisible();
    expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES.danger);
  });
});

describe("leaving Set severity…", () => {
  test("asks before Cancel discards another severity, saying that the severity isn't changed, and closes on Discard", async () => {
    const spy = showingSettable();
    const { screen } = await renderTicket();
    const dialog = await openSeverity(screen);
    await choose(dialog, "Critical");

    await cancelButton(dialog).click();

    const discard = discardDialog(screen);
    await expect
      .element(
        discard.getByText("The severity of SNTL-12 isn't changed.", {
          exact: true,
        }),
      )
      .toBeVisible();
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsButton(screen));
    expect(severities(spy)).toEqual([]);
  });

  test.each(["Cancel", "Escape", "a navigation"])(
    "closes on %s without asking, and without a request, once a read shows the Ticket with a CVE, whose severity Sentinel then derives, also with another severity chosen",
    async (way) => {
      let fields: Partial<TicketDetail> = {};
      const spy = showingSettable({}, { ticket: () => withoutCve(fields) });
      const { router, screen } = await renderTicket();
      const dialog = await openSeverity(screen);
      await choose(dialog, "Critical");
      // Another user associates a CVE with the Ticket meanwhile.
      fields = { cve: fictionalCve() };

      await returnToForeground();

      await readEnded(TICKET);
      // The heading row, behind the dialog, which keeps it from assistive
      // technologies, shows the CVE ID.
      await expect
        .element(
          screen
            .getByRole("main", { includeHidden: true })
            .getByText("CVE-2099-0012", { exact: true })
            .first(),
        )
        .toBeInTheDocument();
      await expect.element(optionOf(dialog, "Critical")).toBeChecked();
      if (way === "Escape") {
        await userEvent.keyboard("{Escape}");
      } else if (way === "Cancel") {
        await cancelButton(dialog).click();
      } else {
        router.history.push("/tickets");
      }

      await expect.element(dialog).not.toBeInTheDocument();
      expect(discardDialog(screen).query()).toBeNull();
      if (way === "a navigation") {
        await expect
          .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
          .toBeVisible();
      } else {
        await expectFocusSettledOn(actionsButton(screen));
      }
      expect(severities(spy)).toEqual([]);
    },
  );
});
