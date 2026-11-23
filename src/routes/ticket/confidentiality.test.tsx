import { describe, expect, test } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import type { TicketDetail, UserReference } from "../../api/generated/model";
import {
  errorResponse,
  fictionalPackage,
  fictionalTicketDetail,
  grantsResponse,
  jsonResponse,
  OTHER_USER,
  referenceOf,
  requestsTo,
  stubApi,
  urlOf,
  validationError,
} from "../../test-api";
import {
  ACCESS,
  ACTORS,
  animationsIn,
  announcements,
  backgroundBehind,
  boxOf,
  CAROL,
  client,
  EVENTS,
  expectFocusOnError,
  expectFocusSettledOn,
  frames,
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
  type Stub,
  stubTicket,
  TICKET,
  TICKETS,
  type UserBody,
  YOUR_WORK,
} from "../ticket-overview/test-support";

// Make confidential… and Make non-confidential…, the items of Actions in the
// heading row of the Ticket screen that change the confidentiality of the
// Ticket, with their confirmations (src/routes/ticket/confidentiality.tsx;
// docs/screens/ticket.md, Actions), shown over Overview, at the browser's
// default text size, in the light theme. Which items Actions offers has its
// own tests (src/routes/ticket/actions.test.tsx).

prepareEachTest();

// Alice Smith, an analyst who also holds manage_confidentiality and can be
// the assignee of every Ticket, and the same user as the assignee of a
// Ticket.
const MANAGER: UserBody = {
  data: {
    ...OTHER_USER.data,
    capabilities: ["triage_ticket", "manage_confidentiality"],
  },
};
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

const CONFIDENTIALITY = `${TICKET}/confidentiality`;
const MESSAGE_FORBIDDEN = "You don't have permission to do this.";

// danger-solid of the light theme.
const DANGER_SOLID = "rgb(207, 34, 46)";

// What the confirmations say (docs/screens/ticket.md, Actions).
const RESTRICTED =
  "Only the users who see every Ticket, the maintainers of its packages that are not excluded, and the users to whom access is granted then see SNTL-12. Every other user loses access to it.";
const BOB_UNASSIGNED =
  "If Bob Wilson, the assignee, can't be the assignee of a confidential Ticket, SNTL-12 becomes unassigned.";
const YOU_UNASSIGNED =
  "You can't be the assignee of a confidential Ticket, so SNTL-12 becomes unassigned.";
const DISCLOSED =
  "Every user can then see SNTL-12. Making it confidential again doesn't undo that disclosure.";
const GRANTS_DELETED =
  "Its access grants are deleted, and making it confidential again doesn't restore them.";
const RELEASE_STAYS =
  "Its Coordinated Release Date stays, and still decides its deadlines.";

// SNTL-12 with the fields, in a status that can be one that the pinned
// contract does not list: an Ignored Ticket with its reason, and a
// Duplicated one with its original, SNTL-21.
function ticketIn(status: string, fields: Partial<TicketDetail> = {}) {
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

// The confidentiality that a body of Set Confidentiality sends.
function confidentialIn(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "is_confidential" in body &&
    body.is_confidential === true
  );
}

// Answers for the manager unless the test says otherwise, with SNTL-12 with
// the fields, in Analyzed or the status, and Set Confidentiality with
// SNTL-12 as the body makes it, which the Ticket then is.
function showing(
  fields: Partial<TicketDetail> = {},
  stub: Partial<Stub> = {},
  status = "analyzed",
) {
  let current = fields;
  return stubTicket({
    user: MANAGER,
    ticket: () => ticketIn(status, current),
    ticketChange: (_, body) => {
      current = { ...current, is_confidential: confidentialIn(body) };
      return ticketIn(status, current);
    },
    ...stub,
  });
}

// The bodies of the requests of Set Confidentiality.
function changes(spy: ReturnType<typeof stubApi>): unknown[] {
  return spy.mock.calls
    .filter(
      ([input, init]) =>
        init?.method === "PATCH" && urlOf(input).pathname === CONFIDENTIALITY,
    )
    .map(([, init]) =>
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    );
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

function confirmationOf(screen: Screen, confidential: boolean) {
  return screen.getByRole("dialog", {
    name: confidential
      ? "Make SNTL-12 confidential?"
      : "Make SNTL-12 non-confidential?",
    exact: true,
  });
}

function buttonOf(dialog: Locator, name: string) {
  return dialog.getByRole("button", { name, exact: true });
}

// The action of a confirmation, Make confidential or Make non-confidential.
function actionOf(dialog: Locator, confidential: boolean) {
  return buttonOf(
    dialog,
    confidential ? "Make confidential" : "Make non-confidential",
  );
}

// Opens Actions, chooses the item that makes the Ticket confidential or
// non-confidential, and waits until its confirmation gives Cancel the focus.
async function openConfirmation(screen: Screen, confidential: boolean) {
  await actionsButton(screen).click();
  await actionsMenu(screen)
    .getByRole("menuitem", {
      name: confidential ? "Make confidential…" : "Make non-confidential…",
      exact: true,
    })
    .click();
  const dialog = confirmationOf(screen, confidential);
  await expect.element(buttonOf(dialog, "Cancel")).toHaveFocus();
  return dialog;
}

// Opens the confirmation and confirms it.
async function confirm(screen: Screen, confidential: boolean) {
  const dialog = await openConfirmation(screen, confidential);
  await actionOf(dialog, confidential).click();
  return dialog;
}

// The texts of the confirmation that mention the assignee.
function assigneeTexts(dialog: Locator): string[] {
  return dialog
    .getByText(/assignee|unassigned/)
    .elements()
    .map((element) => element.textContent ?? "");
}

describe("the confirmation of Make confidential…", () => {
  test("opens once the menu has closed, asks Make SNTL-12 confidential?, says who then sees the Ticket, gives Cancel the focus, and confirms with Make confidential, a danger button after Cancel, at most 400 px wide, without a request", async () => {
    const spy = showing({ assignee: YOU });
    const { screen } = await renderTicket();

    const dialog = await openConfirmation(screen, true);

    expect(actionsMenu(screen).query()).toBeNull();
    await expect
      .element(dialog.getByText(RESTRICTED, { exact: true }))
      .toBeVisible();
    expect(
      dialog
        .getByRole("button")
        .elements()
        .map((button) => button.textContent),
    ).toEqual(["Cancel", "Make confidential"]);
    expect(
      getComputedStyle(actionOf(dialog, true).element()).backgroundColor,
    ).toBe(DANGER_SOLID);
    expect(boxOf(dialog).width).toBe(400);
    expect(changes(spy)).toEqual([]);
  });

  test.each(["new", "analysis", "analyzed"])(
    "says on a Ticket in %s that Bob Wilson, the assignee, may leave it unassigned",
    async (status) => {
      showing({ assignee: BOB }, {}, status);
      const { screen } = await renderTicket();

      const dialog = await openConfirmation(screen, true);

      await expect
        .element(dialog.getByText(RESTRICTED, { exact: true }))
        .toBeVisible();
      await expect
        .element(dialog.getByText(BOB_UNASSIGNED, { exact: true }))
        .toBeVisible();
      expect(assigneeTexts(dialog)).toEqual([BOB_UNASSIGNED]);
      expect(
        boxOf(dialog.getByText(RESTRICTED, { exact: true })).bottom,
      ).toBeLessThan(boxOf(dialog.getByText(BOB_UNASSIGNED)).top);
    },
  );

  test.each<[string, string]>([
    ["non_confidential", "new"],
    ["none", "analysis"],
    ["a value that the pinned contract does not list", "analyzed"],
  ])(
    "says that the signed-in user, the assignee, whose assignment eligibility is %s, can't be the assignee of a confidential Ticket, on a Ticket in %s",
    async (eligibility, status) => {
      showing(
        { assignee: YOU },
        {
          user: {
            data: {
              ...MANAGER.data,
              assignment_eligibility: eligibility.startsWith("a value")
                ? "fictional_eligibility"
                : eligibility,
            },
          },
        },
        status,
      );
      const { screen } = await renderTicket();

      const dialog = await openConfirmation(screen, true);

      await expect
        .element(dialog.getByText(YOU_UNASSIGNED, { exact: true }))
        .toBeVisible();
      expect(assigneeTexts(dialog)).toEqual([YOU_UNASSIGNED]);
    },
  );

  test.each<[string, string, TicketDetail["assignee"]]>([
    [
      "for the signed-in user as the assignee, who can be the assignee of every Ticket",
      "analysis",
      YOU,
    ],
    ["on an unassigned Ticket", "new", null],
    ["on a Resolved Ticket", "resolved", BOB],
    ["on an Ignored Ticket", "ignored", BOB],
    ["on a Duplicated Ticket", "duplicated", BOB],
    [
      "on a Ticket in a status that the pinned contract does not list",
      "fictional_status",
      BOB,
    ],
  ])("says nothing of the assignee %s", async (_, status, assignee) => {
    showing({ assignee }, {}, status);
    const { screen } = await renderTicket();

    const dialog = await openConfirmation(screen, true);

    await expect
      .element(dialog.getByText(RESTRICTED, { exact: true }))
      .toBeVisible();
    expect(assigneeTexts(dialog)).toEqual([]);
  });

  test("says nothing of the assignee of a Resolved Ticket also for the signed-in user who can't be the assignee of a confidential Ticket", async () => {
    showing(
      { assignee: YOU },
      {
        user: {
          data: { ...MANAGER.data, assignment_eligibility: "non_confidential" },
        },
      },
      "resolved",
    );
    const { screen } = await renderTicket();

    const dialog = await openConfirmation(screen, true);

    await expect
      .element(dialog.getByText(RESTRICTED, { exact: true }))
      .toBeVisible();
    expect(assigneeTexts(dialog)).toEqual([]);
  });
});

describe("the confirmation of Make non-confidential…", () => {
  test("asks Make SNTL-12 non-confidential?, says that every user then sees it and that its access grants are deleted, gives Cancel the focus, and confirms with Make non-confidential, a danger button, without a request", async () => {
    const spy = showing({ is_confidential: true, assignee: BOB });
    const { screen } = await renderTicket();

    const dialog = await openConfirmation(screen, false);

    const disclosed = dialog.getByText(DISCLOSED, { exact: true });
    await expect.element(disclosed).toBeVisible();
    const deleted = dialog.getByText(GRANTS_DELETED, { exact: true });
    await expect.element(deleted).toBeVisible();
    expect(boxOf(disclosed).bottom).toBeLessThan(boxOf(deleted).top);
    expect(dialog.getByText(/Coordinated Release Date/).query()).toBeNull();
    expect(assigneeTexts(dialog)).toEqual([]);
    expect(
      dialog
        .getByRole("button")
        .elements()
        .map((button) => button.textContent),
    ).toEqual(["Cancel", "Make non-confidential"]);
    expect(
      getComputedStyle(actionOf(dialog, false).element()).backgroundColor,
    ).toBe(DANGER_SOLID);
    expect(changes(spy)).toEqual([]);
  });

  test("says that the Coordinated Release Date stays and still decides the deadlines of a Ticket that has one", async () => {
    showing({
      is_confidential: true,
      coordinated_release_at: "2099-11-25T13:00:00Z",
    });
    const { screen } = await renderTicket();

    const dialog = await openConfirmation(screen, false);

    const deleted = dialog.getByText(GRANTS_DELETED, { exact: true });
    await expect.element(deleted).toBeVisible();
    const stays = dialog.getByText(RELEASE_STAYS, { exact: true });
    await expect.element(stays).toBeVisible();
    expect(boxOf(deleted).bottom).toBeLessThan(boxOf(stays).top);
  });
});

describe("confirming a change of the confidentiality", () => {
  test("Make confidential sends is_confidential true alone, with its action busy and the confirmation open until Sentinel answers, then closes it, returns the focus to Actions, and announces Made confidential. once the read of the Ticket after it arrives", async () => {
    const response = later();
    const reread = later();
    let changed = false;
    const spy = showing(
      { assignee: YOU },
      {
        ticket: () =>
          changed ? reread.promise : ticketIn("analyzed", { assignee: YOU }),
        ticketChange: () => {
          changed = true;
          return response.promise;
        },
      },
    );
    const { screen } = await renderTicket();
    const reads = requestsTo(spy, TICKET);

    const dialog = await confirm(screen, true);

    const action = actionOf(dialog, true);
    await expect.element(action).toHaveAttribute("aria-disabled", "true");
    expect(animationsIn(action.element())).toEqual(["spin"]);
    expect(changes(spy)).toEqual([{ is_confidential: true }]);
    await expect.element(buttonOf(dialog, "Cancel")).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await action.click({ force: true });
    await nextFrames();
    await expect.element(dialog).toBeVisible();
    expect(changes(spy)).toHaveLength(1);

    response.resolve(
      ticketIn("analyzed", { is_confidential: true, assignee: YOU }),
    );

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsButton(screen));
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    await frames();
    expect(announcements(screen)).not.toContain("Made confidential");
    reread.resolve(
      ticketIn("analyzed", { is_confidential: true, assignee: YOU }),
    );

    await expect
      .poll(() => announcements(screen))
      .toContain("Made confidential.");
    // The heading row and Actions show the Ticket that the read shows.
    await expect
      .element(screen.getByText("Confidential", { exact: true }))
      .toBeVisible();
    expect(document.activeElement).toBe(actionsButton(screen).element());
    await actionsButton(screen).click();
    await expect
      .element(
        actionsMenu(screen).getByRole("menuitem", {
          name: "Make non-confidential…",
          exact: true,
        }),
      )
      .toBeVisible();
  });

  test.each<
    [string, TicketDetail["assignee"], TicketDetail["assignee"], string]
  >([
    [
      "the assignee that the screen showed, which Sentinel no longer returns",
      BOB,
      null,
      "Made confidential, unassigned.",
    ],
    ["an assignee that Sentinel keeps", BOB, BOB, "Made confidential."],
    [
      "no assignee, as the screen showed none",
      null,
      null,
      "Made confidential.",
    ],
  ])(
    "Make confidential announces the outcome as Sentinel returns the Ticket, with %s",
    async (_, before, after, text) => {
      let changed = false;
      showing(
        {},
        {
          ticket: () =>
            ticketIn("analysis", {
              is_confidential: changed,
              assignee: changed ? after : before,
            }),
          ticketChange: () => {
            changed = true;
            return ticketIn("analysis", {
              is_confidential: true,
              assignee: after,
            });
          },
        },
      );
      const { screen } = await renderTicket();

      await confirm(screen, true);

      await expect.poll(() => announcements(screen)).toContain(text);
    },
  );

  test("Make non-confidential sends is_confidential false alone, and announces Made non-confidential. once the read of the Ticket after it arrives", async () => {
    const spy = showing({ is_confidential: true });
    const { screen } = await renderTicket();

    const dialog = await confirm(screen, false);

    await expect.element(dialog).not.toBeInTheDocument();
    expect(changes(spy)).toEqual([{ is_confidential: false }]);
    await expect
      .poll(() => announcements(screen))
      .toContain("Made non-confidential.");
    await expect
      .element(screen.getByText("Confidential", { exact: true }))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsButton(screen));
  });

  test("sends the confidentiality that its item offered as it opened, also after a read meanwhile shows the Ticket already confidential", async () => {
    let confidential = false;
    const spy = showing(
      {},
      {
        ticket: () => ticketIn("analyzed", { is_confidential: confidential }),
      },
    );
    const { screen } = await renderTicket();
    const dialog = await openConfirmation(screen, true);
    // Meanwhile another user makes the Ticket confidential.
    confidential = true;

    await returnToForeground();

    await readEnded(TICKET);
    // The heading row, behind the confirmation, which keeps it from
    // assistive technologies, shows the Ticket confidential.
    await expect
      .element(screen.getByText("Confidential", { exact: true }))
      .toBeInTheDocument();
    await nextFrames();
    await expect.element(dialog).toBeVisible();
    await expect
      .element(dialog.getByText(RESTRICTED, { exact: true }))
      .toBeVisible();

    await actionOf(dialog, true).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(changes(spy)).toEqual([{ is_confidential: true }]);
  });

  test.each(["Cancel", "Escape"])(
    "closes on %s without a request, and the focus returns to Actions",
    async (way) => {
      const spy = showing();
      const { screen } = await renderTicket();
      const dialog = await openConfirmation(screen, true);

      if (way === "Escape") {
        await userEvent.keyboard("{Escape}");
      } else {
        await buttonOf(dialog, "Cancel").click();
      }

      await expect.element(dialog).not.toBeInTheDocument();
      await expectFocusSettledOn(actionsButton(screen));
      expect(changes(spy)).toEqual([]);
    },
  );

  test("leaves an answer that the UI cannot show to the page of a failure of the UI", async () => {
    // The answer of a later release that lacks the Ticket, whose
    // confidentiality the outcome cannot state.
    showing({}, { ticketChange: () => jsonResponse(200, {}) });
    const { screen } = await renderTicket();

    await confirm(screen, true);

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

describe("the reads after a change of the confidentiality", () => {
  test.each<[string, Partial<Stub>]>([
    ["that Sentinel confirms", {}],
    [
      "that fails",
      { ticketChange: () => errorResponse(409, "FICTIONAL_CONFLICT") },
    ],
  ])(
    "read again, after a change %s, the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, the reads of the Ticket list, and its access grants",
    async (_, outcome) => {
      const spy = showing(
        { is_confidential: true, packages: [fictionalPackage()] },
        {
          user: {
            data: {
              ...MAINTAINER.data,
              capabilities: ["manage_confidentiality"],
            },
          },
          grants: () => grantsResponse([CAROL]),
          ...outcome,
        },
      );
      const { screen } = await renderTicket();
      await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
      await expect.poll(() => readsOf(spy, ACCESS)).toBe(1);
      await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
      const reads = {
        ticket: requestsTo(spy, TICKET),
        actors: requestsTo(spy, ACTORS),
        work: requestsTo(spy, YOUR_WORK),
        grants: readsOf(spy, ACCESS),
      };
      // The user saw the Ticket list, with Embargo, and Audit log before,
      // which wait in the cache.
      client.setQueryData([EVENTS], {});
      client.setQueryData([TICKETS, { page: 1, is_confidential: true }], {});

      await confirm(screen, false);

      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
      await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
      await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(reads.work + 1);
      await expect.poll(() => readsOf(spy, ACCESS)).toBe(reads.grants + 1);
      await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
      expect(leftInvalidated(EVENTS)).toBe(true);
      expect(leftInvalidated(TICKETS)).toBe(true);
    },
  );
});

// The failures of Set Confidentiality, which the screen handles in the
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
    "a 409 with a code that the pinned contract does not list",
    () => errorResponse(409, "FICTIONAL_CONFLICT"),
    MESSAGE_CONFLICT,
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
    "a VALIDATION_ERROR for is_confidential",
    () => validationError([["body", "is_confidential"]]),
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
    "404 TICKET_NOT_FOUND",
    () => errorResponse(404, "TICKET_NOT_FOUND"),
    MESSAGE_GONE,
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
    () => errorResponse(503, "SERVICE_UNAVAILABLE"),
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
];

describe("a failure of a change of the confidentiality", () => {
  test.each(
    [true, false].flatMap((confidential) =>
      FAILURES.map(
        ([failure, response, message, tone, referenced]) =>
          [
            confidential ? "Make confidential" : "Make non-confidential",
            failure,
            confidential,
            response,
            message,
            tone,
            referenced,
          ] as const,
      ),
    ),
  )(
    "of %s shows at the top of the confirmation, which stays open and takes the focus: %s",
    async (_, __, confidential, response, message, tone, referenced) => {
      showing({ is_confidential: !confidential }, { ticketChange: response });
      const { screen } = await renderTicket();

      const dialog = await confirm(screen, confidential);

      const error = dialog.getByText(message, { exact: true });
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES[tone]);
      await expectFocusOnError(error);
      const text = dialog.getByText(confidential ? RESTRICTED : DISCLOSED, {
        exact: true,
      });
      expect(boxOf(error).bottom).toBeLessThan(boxOf(text).top);
      if (referenced) {
        await expect
          .element(dialog.getByText(REFERENCE, { exact: true }))
          .toBeVisible();
      } else {
        expect(dialog.getByText(/^Reference:/).query()).toBeNull();
      }
      await expect.element(dialog).toBeVisible();
      await expect
        .element(actionOf(dialog, confidential))
        .not.toHaveAttribute("aria-disabled");
      expect(announcements(screen)).not.toContain(message);
    },
  );

  test("sends again from the confirmation after a failure, whose error goes as it is sent", async () => {
    let fail = true;
    const response = later();
    const spy = showing(
      {},
      {
        ticketChange: () =>
          fail ? errorResponse(503, "SERVICE_UNAVAILABLE") : response.promise,
      },
    );
    const { screen } = await renderTicket();
    const dialog = await confirm(screen, true);
    const error = dialog.getByText(MESSAGE_UNCONFIRMED, { exact: true });
    await expect.element(error).toBeVisible();
    fail = false;

    await actionOf(dialog, true).click();

    // While the change that it sent again is in progress.
    await expect
      .element(actionOf(dialog, true))
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(error).not.toBeInTheDocument();
    response.resolve(ticketIn("analyzed", { is_confidential: true }));
    await expect.element(dialog).not.toBeInTheDocument();
    expect(changes(spy)).toEqual([
      { is_confidential: true },
      { is_confidential: true },
    ]);
    await expect
      .poll(() => announcements(screen))
      .toContain("Made confidential.");
  });
});

describe("a change of the confidentiality that ends after the user left the screen", () => {
  test.each<[string, boolean, Partial<TicketDetail>, () => Response, string]>([
    [
      "Make confidential",
      true,
      {},
      () => ticketIn("analyzed", { is_confidential: true }),
      "Made confidential.",
    ],
    [
      "Make confidential, which unassigned the Ticket,",
      true,
      { assignee: BOB },
      () => ticketIn("analyzed", { is_confidential: true, assignee: null }),
      "Made confidential, unassigned.",
    ],
    [
      "Make non-confidential",
      false,
      { is_confidential: true },
      () => ticketIn("analyzed", { is_confidential: false }),
      "Made non-confidential.",
    ],
  ])(
    "shows the outcome of %s in the message area, naming the Ticket with a link to it",
    async (_, confidential, fields, answer, text) => {
      const response = later();
      showing(fields, { ticketChange: () => response.promise });
      const { router, screen } = await renderTicket();
      const dialog = await confirm(screen, confidential);
      await expect
        .element(actionOf(dialog, confidential))
        .toHaveAttribute("aria-disabled", "true");

      await leaveForTickets(router, screen);
      response.resolve(answer());

      const message = screen.getByText(`SNTL-12: ${text}`, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
      await expect
        .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
        .toHaveAttribute("href", "/tickets/SNTL-12");
    },
  );

  test.each<
    [string, () => Response, string, keyof typeof MESSAGE_TONES, boolean]
  >([
    [
      "a 409, in the presentation of its status",
      () => errorResponse(409, "FICTIONAL_CONFLICT"),
      MESSAGE_CONFLICT,
      "danger",
      false,
    ],
    [
      "a 503, as a warning with its reference",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      MESSAGE_UNCONFIRMED,
      "warning",
      true,
    ],
  ])(
    "shows a failure, %s, in the message area, naming the Ticket",
    async (_, failure, text, tone, referenced) => {
      const response = later();
      showing({}, { ticketChange: () => response.promise });
      const { router, screen } = await renderTicket();
      const dialog = await confirm(screen, true);
      await expect
        .element(actionOf(dialog, true))
        .toHaveAttribute("aria-disabled", "true");

      await leaveForTickets(router, screen);
      response.resolve(failure());

      const message = screen.getByText(`SNTL-12: ${text}`, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES[tone]);
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
