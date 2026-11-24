import { describe, expect, test } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import type {
  TicketCVEConflictErrorResponse,
  TicketDetail,
} from "../../api/generated/model";
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
import { pointerAwayFrom } from "../../test-pointer";
import { screenshot } from "../../test-screenshot";
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

// Associate CVE…, the dialog that Actions opens in the heading row of the
// Ticket screen for a Ticket without a CVE, with its confirmation
// (src/routes/ticket/associate-cve.tsx; docs/screens/ticket.md, Actions;
// States), shown over Overview, at the browser's default text size, in the
// light theme.

prepareEachTest();

const EXPLANATION =
  "SNTL-12 takes the severity, the CVSS assessments, the sources, and the affected versions of the CVE that you enter. Sentinel creates a CVE that it doesn't know yet, so check its ID.";
const UNDONE =
  "No action removes a CVE from a Ticket, so this can't be undone.";
const MESSAGE_FORMAT = "Enter a CVE ID, such as CVE-2099-1234.";
const MESSAGE_ALREADY_SET = "SNTL-12 already has a CVE.";
// What the confirmation adds for an Analyzed and for a Resolved Ticket.
const BACK_TO_ANALYSIS =
  "SNTL-12 can also return to Analysis until CVE-2099-1234 has a SUSE assessment.";
const BACK_TO_ANALYZED =
  "SNTL-12 can also return to Analysis until CVE-2099-1234 has a SUSE assessment, and to Analyzed until its eligible Products are released.";

// The color of a danger button in the light theme (docs/design-system.md,
// Buttons and Links): danger-solid, as a style and as a pixel.
const DANGER_SOLID = "rgb(207, 34, 46)";
const DANGER_SOLID_PIXEL = "#cf222e";

const ASSOCIATE = `${TICKET}/associate-cve`;

// SNTL-12 without a CVE in Analysis, with the severity High set by hand
// unless the test sets another, as Get Ticket returns it.
function withoutCve(fields: Partial<TicketDetail> = {}): Response {
  return ticketResponse(
    fictionalTicketDetail({ status: "analysis", cve: null, ...fields }),
  );
}

// SNTL-12 with the CVE, as Associate CVE returns it.
function withCve(cveId: string): Response {
  return ticketResponse(
    fictionalTicketDetail({
      status: "analysis",
      severity: null,
      cve: fictionalCve({ cve_id: cveId }),
    }),
  );
}

// The 409 TICKET_CVE_CONFLICT of a CVE that another Ticket holds.
function conflict(existing: unknown): Response {
  const body: Omit<TicketCVEConflictErrorResponse, "existing_ticket_id"> & {
    existing_ticket_id?: unknown;
  } = { code: "TICKET_CVE_CONFLICT", detail: "A fictional detail" };
  if (existing !== undefined) {
    body.existing_ticket_id = existing;
  }
  return jsonResponse(409, body);
}

// The CVE ID that a body of Associate CVE sends.
function cveIdIn(body: unknown): string {
  return typeof body === "object" && body !== null && "cve_id" in body
    ? String(body.cve_id)
    : "";
}

// Answers for the analyst, who holds triage_ticket, with SNTL-12 without a
// CVE until Associate CVE answers, and then with the CVE sent.
function showingAssociable(
  fields: Partial<TicketDetail> = {},
  stub: Partial<Stub> = {},
) {
  let associated: string | undefined;
  return stubTicket({
    user: OTHER_USER,
    ticket: () =>
      associated === undefined ? withoutCve(fields) : withCve(associated),
    ticketChange: (_, body) => {
      associated = cveIdIn(body);
      return withCve(associated);
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

function associateDialog(screen: Screen) {
  return screen.getByRole("dialog", {
    name: "Associate a CVE with SNTL-12",
    exact: true,
  });
}

function confirmation(screen: Screen, cveId: string) {
  return screen.getByRole("dialog", {
    name: `Associate ${cveId} with SNTL-12?`,
    exact: true,
  });
}

function discardDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Discard changes?" });
}

function cveField(dialog: Locator) {
  return dialog.getByRole("textbox", { name: "CVE ID", exact: true });
}

function associateButton(dialog: Locator) {
  return dialog.getByRole("button", { name: "Associate CVE", exact: true });
}

function cancelButton(dialog: Locator) {
  return dialog.getByRole("button", { name: "Cancel", exact: true });
}

// Opens Associate CVE… from Actions and waits until its field has the focus.
async function openAssociate(screen: Screen) {
  await actionsButton(screen).click();
  await screen
    .getByRole("menuitem", { name: "Associate CVE…", exact: true })
    .click();
  const dialog = associateDialog(screen);
  await expect.element(cveField(dialog)).toHaveFocus();
  return dialog;
}

// Opens the dialog, enters the CVE ID, and submits the form, which asks for
// confirmation of the CVE ID that it sends.
async function submitCveId(screen: Screen, typed: string, cveId = typed) {
  const dialog = await openAssociate(screen);
  await cveField(dialog).fill(typed);
  await associateButton(dialog).click();
  const asked = confirmation(screen, cveId);
  await expect.element(asked).toBeVisible();
  return { dialog, asked };
}

// Submits the CVE ID and confirms it.
async function associate(screen: Screen, cveId: string) {
  const { dialog, asked } = await submitCveId(screen, cveId);
  await associateButton(asked).click();
  return { dialog, asked };
}

// The bodies of the requests of Associate CVE.
function associations(spy: ReturnType<typeof stubApi>): unknown[] {
  return spy.mock.calls
    .filter(
      ([input, init]) =>
        init?.method === "POST" && urlOf(input).pathname === ASSOCIATE,
    )
    .map(([, init]) =>
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    );
}

describe("the dialog of Associate CVE…", () => {
  test("says in fg-muted what the CVE brings, then shows CVE ID with its description, which takes the focus, then Cancel and Associate CVE, at most 560 px wide", async () => {
    showingAssociable();
    const { screen } = await renderTicket();

    const dialog = await openAssociate(screen);

    const explanation = dialog.getByText(EXPLANATION, { exact: true });
    await expect.element(explanation).toBeVisible();
    expect(getComputedStyle(explanation.element()).color).toBe(FG_MUTED);
    await expect
      .element(cveField(dialog))
      .toHaveAccessibleDescription("Such as CVE-2099-1234.");
    expect(textsOf(dialog.getByRole("button"))).toEqual([
      "Cancel",
      "Associate CVE",
    ]);
    expect(boxOf(dialog).width).toBe(560);
  });

  test("spans CVE ID, as what the dialog says, from its start to the end of its buttons", async () => {
    showingAssociable();
    const { screen } = await renderTicket();

    const dialog = await openAssociate(screen);

    // To within the rounding of a browser.
    const explanation = boxOf(dialog.getByText(EXPLANATION, { exact: true }));
    const field = boxOf(cveField(dialog));
    expect(field.left).toBeCloseTo(explanation.left, 0);
    expect(field.right).toBeCloseTo(explanation.right, 0);
    expect(field.right).toBeCloseTo(boxOf(associateButton(dialog)).right, 0);
  });
});

describe("the check of Associate CVE…", () => {
  test.each([
    ["an empty CVE ID", "   ", "Enter the CVE ID."],
    [
      "a CVE ID of more than 20 characters",
      "CVE-2099-123456789012",
      "Enter at most 20 characters.",
    ],
    ["a text that is not a CVE ID", "2099-1234", MESSAGE_FORMAT],
    ["a CVE ID with too few digits", "CVE-2099-123", MESSAGE_FORMAT],
    // 20 characters as Sentinel counts them, by code point, of which each
    // digit outside the Basic Multilingual Plane takes two UTF-16 code units.
    [
      "a text of 20 characters, counted by code point, that is not a CVE ID",
      `CVE-2099-${"𝟙".repeat(11)}`,
      MESSAGE_FORMAT,
    ],
  ])(
    "states its error at the field for %s, the field taking the focus, without a confirmation or a request, until the input changes",
    async (_, typed, message) => {
      const spy = showingAssociable();
      const { screen } = await renderTicket();
      const dialog = await openAssociate(screen);
      await cveField(dialog).fill(typed);

      await associateButton(dialog).click();

      await expect
        .element(cveField(dialog))
        .toHaveAccessibleDescription(`Such as CVE-2099-1234. ${message}`);
      await expect.element(cveField(dialog)).toHaveFocus();
      await nextFrames();
      expect(screen.getByRole("dialog").elements()).toHaveLength(1);
      expect(associations(spy)).toEqual([]);

      await userEvent.keyboard("9");

      await expect
        .element(cveField(dialog))
        .toHaveAccessibleDescription("Such as CVE-2099-1234.");
    },
  );

  test("takes the CVE ID without its surrounding whitespace and with CVE- in any letter case, which it sends in capitals", async () => {
    const spy = showingAssociable();
    const { screen } = await renderTicket();

    const { asked } = await submitCveId(
      screen,
      "  cve-2099-1234 ",
      "CVE-2099-1234",
    );
    await associateButton(asked).click();

    await expect
      .poll(() => associations(spy))
      .toEqual([{ cve_id: "CVE-2099-1234" }]);
  });
});

describe("the confirmation of Associate CVE…", () => {
  test("asks for the CVE and the Ticket, states that the CVE sets the severity in place of the one set by hand and cannot be removed, with Cancel, which takes the focus, and Associate CVE, a danger button, without a request until it is confirmed", async () => {
    const spy = showingAssociable();
    const { screen } = await renderTicket();

    const { asked } = await submitCveId(screen, "CVE-2099-1234");

    await expect
      .element(
        asked.getByText(
          "SNTL-12 takes its severity from the CVSS assessments of CVE-2099-1234, in place of the severity High set by hand, and Sentinel fetches the CVE from its sources.",
          { exact: true },
        ),
      )
      .toBeVisible();
    await expect
      .element(asked.getByText(UNDONE, { exact: true }))
      .toBeVisible();
    expect(asked.getByText(/return to Analysis/).query()).toBeNull();
    await expect.element(cancelButton(asked)).toHaveFocus();
    await pointerAwayFrom(associateButton(asked));
    expect(
      getComputedStyle(associateButton(asked).element()).backgroundColor,
    ).toBe(DANGER_SOLID);
    expect(associations(spy)).toEqual([]);
  });

  test.each([
    ["an Analyzed Ticket can return to Analysis", "analyzed", BACK_TO_ANALYSIS],
    [
      "a Resolved Ticket can return to Analysis, and to Analyzed",
      "resolved",
      BACK_TO_ANALYZED,
    ],
  ] as const)(
    "states that %s, without the severity set by hand when the Ticket has none",
    async (_, status, consequence) => {
      showingAssociable({ status, severity: null });
      const { screen } = await renderTicket();

      const { asked } = await submitCveId(screen, "CVE-2099-1234");

      await expect
        .element(
          asked.getByText(
            "SNTL-12 takes its severity from the CVSS assessments of CVE-2099-1234, and Sentinel fetches the CVE from its sources.",
            { exact: true },
          ),
        )
        .toBeVisible();
      await expect
        .element(asked.getByText(consequence, { exact: true }))
        .toBeVisible();
      expect(asked.getByText(/return to Analysis/).elements()).toHaveLength(1);
      await expect
        .element(asked.getByText(UNDONE, { exact: true }))
        .toBeVisible();
    },
  );

  test("states the consequences of the status of the Ticket as a read shows it while the form is open, none for a status that the pinned contract does not list", async () => {
    // The status that the reads of the Ticket return, one that the pinned
    // contract does not list included.
    let status = "analysis";
    showingAssociable(
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
    const dialog = await openAssociate(screen);
    status = "resolved";

    await returnToForeground();

    await readEnded(TICKET);
    await cveField(dialog).fill("CVE-2099-1234");
    await associateButton(dialog).click();
    const asked = confirmation(screen, "CVE-2099-1234");
    await expect
      .element(asked.getByText(BACK_TO_ANALYZED, { exact: true }))
      .toBeVisible();

    await cancelButton(asked).click();
    await expect.element(asked).not.toBeInTheDocument();
    status = "fictional_status";
    await returnToForeground();

    await readEnded(TICKET);
    await associateButton(dialog).click();
    await expect
      .element(asked.getByText(UNDONE, { exact: true }))
      .toBeVisible();
    expect(asked.getByText(/return to Analysis/).query()).toBeNull();
  });

  test("returns to the form with its CVE ID on Cancel, without a request", async () => {
    const spy = showingAssociable();
    const { screen } = await renderTicket();
    const { dialog, asked } = await submitCveId(screen, "CVE-2099-1234");

    await cancelButton(asked).click();

    await expect.element(asked).not.toBeInTheDocument();
    await expect.element(dialog).toBeVisible();
    await expect.element(cveField(dialog)).toHaveValue("CVE-2099-1234");
    await expect
      .poll(() => dialog.element().contains(document.activeElement))
      .toBe(true);
    expect(associations(spy)).toEqual([]);
  });
});

describe("the submission of Associate CVE…", () => {
  test("sends the CVE ID once confirmed, with nothing else in the body, closes, returns the focus to Actions, announces the CVE that Sentinel returns once the read of the Ticket after it arrives, and leaves Actions without Set severity… and Associate CVE…", async () => {
    const spy = showingAssociable();
    const { screen } = await renderTicket();

    const { dialog, asked } = await associate(screen, "CVE-2099-1234");

    await expect.element(asked).not.toBeInTheDocument();
    await expect.element(dialog).not.toBeInTheDocument();
    expect(associations(spy)).toEqual([{ cve_id: "CVE-2099-1234" }]);
    await expect
      .poll(() => announcements(screen))
      .toContain("CVE-2099-1234 associated.");
    await expectFocusSettledOn(actionsButton(screen));
    await actionsButton(screen).click();
    const menu = screen.getByRole("menu", { name: "Actions of SNTL-12" });
    await expect.element(menu).toBeVisible();
    expect(textsOf(menu.getByRole("menuitem"))).not.toContain("Set severity…");
    expect(textsOf(menu.getByRole("menuitem"))).not.toContain("Associate CVE…");
  });

  test("reads again the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, and the reads of the Ticket list, but not its duplicates, which the change leaves as they are", async () => {
    const spy = showingAssociable(
      { packages: [fictionalPackage()] },
      {
        user: { data: { ...MAINTAINER.data, capabilities: ["triage_ticket"] } },
      },
    );
    const { screen } = await renderTicket();
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
    const { asked } = await submitCveId(screen, "CVE-2099-1234");
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

    await associateButton(asked).click();

    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(reads.work + 1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    // The read of the duplicates, which the details show, is not sent again.
    expect(readsOf(spy, TICKETS)).toBe(reads.duplicates);
    expect(leftInvalidated(EVENTS)).toBe(true);
    expect(leftInvalidated(TICKETS)).toBe(true);
  });

  test("keeps the confirmation open and busy while the change is in progress, which neither Cancel nor Escape closes, and sends one request", async () => {
    const response = later();
    const spy = showingAssociable({}, { ticketChange: () => response.promise });
    const { screen } = await renderTicket();

    const { dialog, asked } = await associate(screen, "CVE-2099-1234");

    await expect
      .element(associateButton(asked))
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(cancelButton(asked)).toBeDisabled();
    await associateButton(asked).click({ force: true });
    await userEvent.keyboard("{Escape}");
    await nextFrames();
    await expect.element(asked).toBeVisible();
    expect(associations(spy)).toHaveLength(1);

    response.resolve(withCve("CVE-2099-1234"));

    await expect.element(dialog).not.toBeInTheDocument();
  });

  test("shows the outcome of a change that ends after the user left the screen in the message area, naming the Ticket", async () => {
    const response = later();
    showingAssociable({}, { ticketChange: () => response.promise });
    const { router, screen } = await renderTicket();
    const { asked } = await associate(screen, "CVE-2099-1234");
    await expect
      .element(associateButton(asked))
      .toHaveAttribute("aria-disabled", "true");

    await leaveForTickets(router, screen);
    response.resolve(withCve("CVE-2099-1234"));

    const message = screen.getByText("SNTL-12: CVE-2099-1234 associated.", {
      exact: true,
    });
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
  });
});

describe("a failure of Associate CVE…", () => {
  test("closes the confirmation and shows 409 TICKET_CVE_CONFLICT at the field, naming the Ticket that holds the CVE as a link to its screen, the field taking the focus, until the input changes", async () => {
    const spy = showingAssociable(
      {},
      { ticketChange: () => conflict("SNTL-21") },
    );
    const { screen } = await renderTicket();
    const reads = requestsTo(spy, TICKET);

    const { dialog, asked } = await associate(screen, "CVE-2099-0012");

    await expect.element(asked).not.toBeInTheDocument();
    const field = cveField(dialog);
    await expect
      .element(field)
      .toHaveAccessibleDescription(
        "Such as CVE-2099-1234. CVE-2099-0012 is already the CVE of SNTL-21.",
      );
    await expect.element(field).toHaveFocus();
    await expect.element(field).toHaveValue("CVE-2099-0012");
    const link = dialog.getByRole("link", { name: "SNTL-21", exact: true });
    await expect.element(link).toHaveAttribute("href", "/tickets/SNTL-21");
    // Whatever its outcome, the screen reads again what it affects.
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);

    await userEvent.keyboard("3");

    await expect.element(link).not.toBeInTheDocument();
  });

  test.each([
    ["without the Ticket", undefined],
    ["with a Ticket that is not in the form SNTL-{n}", "SNTL-0021"],
    ["with a Ticket that is not text", 21],
  ])(
    "shows 409 TICKET_CVE_CONFLICT %s as the CVE of another Ticket, without a link",
    async (_, existing) => {
      showingAssociable({}, { ticketChange: () => conflict(existing) });
      const { screen } = await renderTicket();

      const { dialog } = await associate(screen, "CVE-2099-0012");

      await expect
        .element(cveField(dialog))
        .toHaveAccessibleDescription(
          "Such as CVE-2099-1234. CVE-2099-0012 is already the CVE of another Ticket.",
        );
      expect(dialog.getByRole("link").query()).toBeNull();
    },
  );

  test.each([
    [
      "422 CVE_INVALID_FORMAT",
      () => errorResponse(422, "CVE_INVALID_FORMAT"),
      MESSAGE_FORMAT,
    ],
    [
      "a field error of a VALIDATION_ERROR for cve_id",
      () => validationError([["body", "cve_id"]]),
      MESSAGE_INVALID,
    ],
  ])("shows %s at the field", async (_, failure, message) => {
    showingAssociable({}, { ticketChange: failure });
    const { screen } = await renderTicket();

    const { dialog } = await associate(screen, "CVE-2099-1234");

    await expect
      .element(cveField(dialog))
      .toHaveAccessibleDescription(`Such as CVE-2099-1234. ${message}`);
    await expect.element(cveField(dialog)).toHaveFocus();
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
      "400 TICKET_CVE_ALREADY_SET, of a Ticket that has a CVE since the dialog opened, as an error",
      () => errorResponse(400, "TICKET_CVE_ALREADY_SET"),
      MESSAGE_ALREADY_SET,
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
      "the code of a conflict with another status, as an error",
      () => errorResponse(400, "TICKET_CVE_CONFLICT"),
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
    "closes the confirmation and shows %s at the top of the form, which takes the focus and keeps the CVE ID",
    async (_, failure, message, tone, referenced) => {
      showingAssociable({}, { ticketChange: failure });
      const { screen } = await renderTicket();

      const { dialog, asked } = await associate(screen, "CVE-2099-1234");

      await expect.element(asked).not.toBeInTheDocument();
      const error = dialog.getByText(message, { exact: true });
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES[tone]);
      await expectFocusOnError(error);
      expect(boxOf(error).bottom).toBeLessThan(boxOf(cveField(dialog)).top);
      if (referenced) {
        await expect
          .element(dialog.getByText(REFERENCE, { exact: true }))
          .toBeVisible();
      } else {
        expect(dialog.getByText(/^Reference:/).query()).toBeNull();
      }
      await expect.element(cveField(dialog)).toHaveValue("CVE-2099-1234");
      await expect
        .element(cveField(dialog))
        .toHaveAccessibleDescription("Such as CVE-2099-1234.");
    },
  );

  test("shows 409 TICKET_CVE_CONFLICT of a change that ends after the user left the screen in the message area, naming the Ticket, without a link to the Ticket that holds the CVE", async () => {
    const response = later();
    showingAssociable({}, { ticketChange: () => response.promise });
    const { router, screen } = await renderTicket();
    const { asked } = await associate(screen, "CVE-2099-0012");
    await expect
      .element(associateButton(asked))
      .toHaveAttribute("aria-disabled", "true");

    await leaveForTickets(router, screen);
    response.resolve(conflict("SNTL-21"));

    const error = screen.getByText(
      "SNTL-12: CVE-2099-0012 is already the CVE of SNTL-21.",
      { exact: true },
    );
    await expect.element(error).toBeVisible();
    expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES.danger);
    expect(screen.getByRole("link", { name: "SNTL-21" }).query()).toBeNull();
  });
});

describe("leaving Associate CVE…", () => {
  test("asks before Cancel discards a CVE ID, saying that no CVE is associated, and closes on Discard", async () => {
    const spy = showingAssociable();
    const { screen } = await renderTicket();
    const dialog = await openAssociate(screen);
    await cveField(dialog).fill("CVE-2099-1234");

    await cancelButton(dialog).click();

    const discard = discardDialog(screen);
    await expect
      .element(
        discard.getByText("No CVE is associated with SNTL-12.", {
          exact: true,
        }),
      )
      .toBeVisible();
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsButton(screen));
    expect(associations(spy)).toEqual([]);
  });

  test("closes at once on Escape with only whitespace in the field", async () => {
    showingAssociable();
    const { screen } = await renderTicket();
    const dialog = await openAssociate(screen);
    await cveField(dialog).fill("  ");

    await userEvent.keyboard("{Escape}");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(discardDialog(screen).query()).toBeNull();
  });

  test.each(["Cancel", "Escape", "a navigation"])(
    "closes on %s without asking, and without a request, once a read shows the Ticket with a CVE, also with a CVE ID in the field",
    async (way) => {
      let fields: Partial<TicketDetail> = {};
      const spy = showingAssociable({}, { ticket: () => withoutCve(fields) });
      const { router, screen } = await renderTicket();
      const dialog = await openAssociate(screen);
      await cveField(dialog).fill("CVE-2099-1234");
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
      await expect.element(cveField(dialog)).toHaveValue("CVE-2099-1234");
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
      expect(associations(spy)).toEqual([]);
    },
  );

  test("asks over the confirmation before a navigation discards the CVE ID, returns to the confirmation on Keep editing, and closes both and leaves on Discard", async () => {
    const spy = showingAssociable();
    const { router, screen } = await renderTicket();
    const { dialog, asked } = await submitCveId(screen, "CVE-2099-1234");
    await expect.element(cancelButton(asked)).toHaveFocus();

    router.history.push("/tickets");

    const discard = discardDialog(screen);
    const keep = discard.getByRole("button", { name: "Keep editing" });
    await expect.element(keep).toHaveFocus();
    await expect
      .element(
        discard.getByText("No CVE is associated with SNTL-12.", {
          exact: true,
        }),
      )
      .toBeVisible();
    // The question shows above the confirmation, which would otherwise cover
    // it: its Discard, a danger button, shows its color beside its label.
    const discardButton = discard.getByRole("button", {
      name: "Discard",
      exact: true,
    });
    const picture = await screenshot(discardButton);
    expect(picture.at(4, picture.height / 2)).toBe(DANGER_SOLID_PIXEL);
    await nextFrames();
    expect(router.state.location.pathname).toBe("/tickets/SNTL-12");
    await keep.click();
    await expect.element(discard).not.toBeInTheDocument();
    await nextFrames();
    await expect.element(asked).toBeVisible();
    await expect
      .poll(() => asked.element().contains(document.activeElement))
      .toBe(true);
    expect(router.state.location.pathname).toBe("/tickets/SNTL-12");

    router.history.push("/tickets");
    await discardButton.click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
    expect(asked.query()).toBeNull();
    expect(dialog.query()).toBeNull();
    expect(associations(spy)).toEqual([]);
  });
});
