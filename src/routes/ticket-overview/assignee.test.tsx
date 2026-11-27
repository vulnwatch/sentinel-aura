import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../../styles.css";
import type { TicketDetail } from "../../api/generated/model";
import {
  errorResponse,
  FICTIONAL_ACTORS,
  FICTIONAL_USER,
  fictionalDirectoryUser,
  usersPage,
  validationError,
  fictionalPackage,
  fictionalTicketDetail,
  jsonResponse,
  OTHER_USER,
  requestsTo,
  stubApi,
  ticketResponse,
  urlOf,
} from "../../test-api";
import { timesAnnounced } from "../../test-announcements";
import {
  ACTORS,
  animationsIn,
  announcements,
  ASSIGNEE,
  backgroundBehind,
  boxOf,
  client,
  EVENTS,
  interactOutside,
  later,
  leftInvalidated,
  mainContent,
  MAINTAINER,
  ME,
  MESSAGE_TONES,
  nextFrames,
  prepareEachTest,
  readEnded,
  readsOf,
  renderApp,
  requestsWith,
  returnToForeground,
  type Screen,
  type Stub,
  stubTicket,
  TICKET,
  TICKETS,
  type UserBody,
  USERS,
  YOUR_WORK,
} from "./test-support";

// The assignee in the details of Overview, the first tab of the Ticket screen
// (src/routes/ticket-overview/assignee.tsx; docs/screens/ticket.md), at the
// browser's default text size, in the light theme.

prepareEachTest();

// Alice Smith, the signed-in user of OTHER_USER, as the assignee of a
// Ticket, and Bob Wilson, an analyst of the directory.
const ALICE = FICTIONAL_ACTORS[1]!;
const BOB_ENTRY = fictionalDirectoryUser({
  id: "00000000-0000-0000-0000-000000000010",
  username: "bwilson",
  email: "bob.wilson@example.com",
  full_name: "Bob Wilson",
});
const BOB = {
  id: BOB_ENTRY.id,
  username: BOB_ENTRY.username,
  full_name: BOB_ENTRY.full_name,
  active: true,
  bot: false,
  avatar_url: null,
};
const ANA_ENTRY = fictionalDirectoryUser();
const ALICE_ENTRY = fictionalDirectoryUser({
  id: ALICE.id,
  username: ALICE.username,
  email: "alice.smith@example.com",
  full_name: ALICE.full_name,
});

function detailsPart(screen: Screen) {
  return screen.getByRole("region", { name: "Details", exact: true });
}

// The value of the assignee, the first field of the details.
function assigneeValue(screen: Screen) {
  return detailsPart(screen).getByRole("definition").first();
}

function editAssignee(screen: Screen) {
  return detailsPart(screen).getByRole("button", { name: "Edit assignee" });
}

function assigneePopover(screen: Screen) {
  return screen.getByRole("dialog", { name: "Assignee" });
}

function searchUsers(screen: Screen) {
  return assigneePopover(screen).getByRole("searchbox", {
    name: "Search users",
  });
}

function userOption(screen: Screen, name: string) {
  return assigneePopover(screen).getByRole("option", { name, exact: true });
}

// The names of the options of the popover, in their order.
function assigneeOptions(screen: Screen): (string | null)[] {
  return assigneePopover(screen)
    .getByRole("option")
    .elements()
    .map((element) => element.textContent);
}

// A SNTL-12 with the assignee.
function assignedTo(assignee: TicketDetail["assignee"]) {
  return ticketResponse(fictionalTicketDetail({ assignee }));
}

// Renders the screen of SNTL-12 and waits until its details show.
async function renderDetails() {
  const rendered = await renderApp("/tickets/SNTL-12");
  await expect.element(detailsPart(rendered.screen)).toBeVisible();
  return rendered;
}

// Opens the popover of the assignee and waits until it lists the option.
async function openAssignee(screen: Screen, option: string) {
  await editAssignee(screen).click();
  await expect.element(userOption(screen, option)).toBeVisible();
}

// The bodies of the requests of Assign Ticket.
function assignments(spy: ReturnType<typeof stubApi>): unknown[] {
  return requestsWith(spy, "PATCH")
    .filter(([input]) => urlOf(input).pathname === ASSIGNEE)
    .map(([, init]) =>
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    );
}

// The queries of the reads of the directory.
function directoryReads(spy: ReturnType<typeof stubApi>): string[] {
  return requestsWith(spy, "GET")
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname === USERS)
    .map((url) => url.search);
}

describe("the assignee", () => {
  test("has a pencil, Edit assignee, at the end of its line for a user who holds triage_ticket", async () => {
    stubTicket({ ticket: () => assignedTo(BOB) });
    const { screen } = await renderDetails();

    const pencil = editAssignee(screen);
    await expect.element(pencil).toBeVisible();
    expect(boxOf(pencil).width).toBe(24);
    expect(boxOf(pencil).height).toBe(24);
    expect(boxOf(pencil).right).toBe(boxOf(assigneeValue(screen)).right);
    const term = detailsPart(screen).getByText("Assignee", { exact: true });
    expect(boxOf(pencil).top).toBeLessThan(boxOf(term).bottom);
    await expect.element(assigneeValue(screen)).toHaveTextContent("Bob Wilson");
  });

  test.each(["new", "analysis", "analyzed", "resolved"] as const)(
    "has a pencil on a Ticket in %s",
    async (status) => {
      stubTicket({
        ticket: () => ticketResponse(fictionalTicketDetail({ status })),
      });
      const { screen } = await renderDetails();

      await expect.element(editAssignee(screen)).toBeVisible();
    },
  );

  test.each<[string, Partial<Stub>]>([
    ["without triage_ticket", { user: FICTIONAL_USER }],
    [
      "on an Ignored Ticket",
      {
        ticket: () =>
          ticketResponse(
            fictionalTicketDetail({
              status: "ignored",
              ignore_reason: "other",
            }),
          ),
      },
    ],
    [
      "on a Duplicated Ticket",
      {
        ticket: () =>
          ticketResponse(
            fictionalTicketDetail({
              status: "duplicated",
              duplicate_of_ticket_id: "SNTL-21",
            }),
          ),
      },
    ],
    [
      "on a Ticket of a status that the pinned contract does not list",
      {
        ticket: () =>
          jsonResponse(200, {
            data: { ...fictionalTicketDetail(), status: "fictional_status" },
          }),
      },
    ],
  ])("has no pencil %s", async (_, stub) => {
    stubTicket(stub);
    const { screen } = await renderDetails();

    await expect
      .element(detailsPart(screen).getByText("Last modified"))
      .toBeVisible();
    expect(editAssignee(screen).query()).toBeNull();
  });

  test("opens a popover whose search field takes the focus, with the users who can be the assignee of a non-confidential Ticket, the signed-in user first with You, and the assignee chosen", async () => {
    const spy = stubTicket({
      ticket: () => assignedTo(BOB),
      users: () => usersPage([ANA_ENTRY, ALICE_ENTRY, BOB_ENTRY]),
    });
    const { screen } = await renderDetails();

    await openAssignee(screen, "Bob Wilson @bwilson");

    await expect.element(searchUsers(screen)).toHaveFocus();
    expect(assigneeOptions(screen)).toEqual([
      "Alice Smith @asmithYou",
      "Ana Garcia @agarcia",
      "Bob Wilson @bwilson",
    ]);
    await expect
      .element(userOption(screen, "Bob Wilson @bwilson"))
      .toHaveAttribute("aria-selected", "true");
    expect(directoryReads(spy)).toEqual([
      "?assignment_eligibility=all&assignment_eligibility=non_confidential&per_page=20",
    ]);
    // 320 px wide with 16 px of padding, below the pencil.
    const popover = assigneePopover(screen).element().parentElement!;
    expect(boxOf(popover).width).toBe(320);
    expect(getComputedStyle(popover).paddingTop).toBe("16px");
    expect(boxOf(popover).top).toBeGreaterThan(
      boxOf(editAssignee(screen)).bottom,
    );

    await userEvent.keyboard("{Escape}");

    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await expect.element(editAssignee(screen)).toHaveFocus();
  });

  test.each<[string, string, boolean, string[]]>([
    [
      "all, on a confidential Ticket",
      "all",
      true,
      ["Alice Smith @asmithYou", "Bob Wilson @bwilson"],
    ],
    [
      "non_confidential, on a non-confidential Ticket",
      "non_confidential",
      false,
      ["Alice Smith @asmithYou", "Bob Wilson @bwilson"],
    ],
    [
      "non_confidential, on a confidential Ticket",
      "non_confidential",
      true,
      ["Bob Wilson @bwilson"],
    ],
    [
      "a value that the pinned contract does not list, on a non-confidential Ticket",
      "fictional",
      false,
      ["Bob Wilson @bwilson"],
    ],
  ])(
    "puts the signed-in user first by their assignment eligibility, %s, among the users of the eligibility that the Ticket admits",
    async (_, eligibility, confidential, options) => {
      const spy = stubTicket({
        user: {
          data: { ...OTHER_USER.data, assignment_eligibility: eligibility },
        },
        ticket: () =>
          ticketResponse(
            fictionalTicketDetail({
              is_confidential: confidential,
              assignee: BOB,
            }),
          ),
        users: () => usersPage([BOB_ENTRY]),
      });
      const { screen } = await renderDetails();

      await openAssignee(screen, "Bob Wilson @bwilson");

      expect(assigneeOptions(screen)).toEqual(options);
      expect(directoryReads(spy)).toEqual([
        confidential
          ? "?assignment_eligibility=all&per_page=20"
          : "?assignment_eligibility=all&assignment_eligibility=non_confidential&per_page=20",
      ]);
    },
  );

  test("reads its users each time it opens, and not when the tab returns to the foreground while it is open", async () => {
    const spy = stubTicket({
      ticket: () => assignedTo(BOB),
      users: () => usersPage([BOB_ENTRY]),
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");
    expect(directoryReads(spy)).toHaveLength(1);

    await returnToForeground();
    await readEnded(TICKET);
    await nextFrames();
    expect(directoryReads(spy)).toHaveLength(1);

    await userEvent.keyboard("{Escape}");
    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await openAssignee(screen, "Bob Wilson @bwilson");

    expect(directoryReads(spy)).toHaveLength(2);
  });

  test("assigns the Ticket at once to the user chosen, expecting the assignee shown, busy and open until Sentinel confirms it; then closes, returns the focus to the pencil, and announces it", async () => {
    let assignee: TicketDetail["assignee"] = null;
    const response = later();
    const spy = stubTicket({
      ticket: () => assignedTo(assignee),
      users: () => usersPage([ANA_ENTRY, BOB_ENTRY]),
      assign: () => response.promise,
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");
    const reads = readsOf(spy, TICKET);

    await userOption(screen, "Bob Wilson @bwilson").click();

    await expect
      .element(editAssignee(screen))
      .toHaveAttribute("aria-disabled", "true");
    expect(assignments(spy)).toEqual([
      { user_id: BOB.id, expected_assignee_id: null },
    ]);
    expect(
      animationsIn(userOption(screen, "Bob Wilson @bwilson").element()),
    ).toEqual(["spin"]);
    await expect
      .element(
        assigneePopover(screen)
          .getByRole("status")
          .getByText("Changing the assignee."),
      )
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    interactOutside();
    await nextFrames();
    await expect.element(assigneePopover(screen)).toBeVisible();

    assignee = BOB;
    response.resolve(assignedTo(BOB));

    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await expect.element(editAssignee(screen)).toHaveFocus();
    await expect.element(assigneeValue(screen)).toHaveTextContent("Bob Wilson");
    await expect
      .poll(() => announcements())
      .toContain("Assigned to Bob Wilson.");
    expect(readsOf(spy, TICKET)).toBeGreaterThan(reads);
    expect(readsOf(spy, ACTORS)).toBeGreaterThan(1);
    await expect
      .element(editAssignee(screen))
      .not.toHaveAttribute("aria-disabled");
  });

  test("assigns the Ticket to the signed-in user, which it announces as Assigned to you.", async () => {
    let assignee: TicketDetail["assignee"] = BOB;
    const spy = stubTicket({
      ticket: () => assignedTo(assignee),
      users: () => usersPage([BOB_ENTRY]),
      assign: () => {
        assignee = ALICE;
        return assignedTo(ALICE);
      },
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Alice Smith @asmith You");

    await userOption(screen, "Alice Smith @asmith You").click();

    await expect.poll(() => announcements()).toContain("Assigned to you.");
    expect(assignments(spy)).toEqual([
      { user_id: ALICE.id, expected_assignee_id: BOB.id },
    ]);
  });

  test("shows the assignment in the message area, as a success without the Ticket, once the read of the Ticket after it fails, which the details do not announce again", async () => {
    const reread = later();
    let assigned = false;
    stubTicket({
      ticket: () => (assigned ? reread.promise : assignedTo(null)),
      users: () => usersPage([ANA_ENTRY, BOB_ENTRY]),
      assign: () => {
        assigned = true;
        return assignedTo(BOB);
      },
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");
    const message = mainContent(screen).getByText("Assigned to Bob Wilson.", {
      exact: true,
    });

    await userOption(screen, "Bob Wilson @bwilson").click();

    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await nextFrames();
    expect(
      screen.getByText("Assigned to Bob Wilson.", { exact: true }).query(),
    ).toBeNull();
    reread.resolve(errorResponse(503, "DATABASE_UNAVAILABLE"));

    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
    expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
    await nextFrames();
    // The message alone announces it.
    expect(timesAnnounced("Assigned to Bob Wilson.")).toBe(1);
  });

  test("offers Unassign yourself first to the signed-in user who is the assignee, which returns the Ticket to the queue", async () => {
    let assignee: TicketDetail["assignee"] = ALICE;
    const spy = stubTicket({
      ticket: () => assignedTo(assignee),
      users: () => usersPage([ALICE_ENTRY, BOB_ENTRY]),
      assign: () => {
        assignee = null;
        return assignedTo(null);
      },
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");
    expect(assigneeOptions(screen)).toEqual([
      "Unassign yourself",
      "Alice Smith @asmithYou",
      "Bob Wilson @bwilson",
    ]);

    await userOption(screen, "Unassign yourself").click();

    await expect
      .poll(() => announcements())
      .toContain("You're no longer the assignee.");
    await expect.element(assigneeValue(screen)).toHaveTextContent("Unassigned");
    expect(assignments(spy)).toEqual([
      { user_id: null, expected_assignee_id: ALICE.id },
    ]);
  });

  test("offers no Unassign yourself when another user is the assignee", async () => {
    stubTicket({
      ticket: () => assignedTo(BOB),
      users: () => usersPage([BOB_ENTRY]),
    });
    const { screen } = await renderDetails();

    await openAssignee(screen, "Bob Wilson @bwilson");

    expect(userOption(screen, "Unassign yourself").query()).toBeNull();
  });

  test.each<[string, () => Response, string]>([
    [
      "404 USER_NOT_FOUND",
      () => errorResponse(404, "USER_NOT_FOUND"),
      "Sentinel doesn't know this user.",
    ],
    [
      "409 TICKET_ASSIGNEE_INACTIVE",
      () => errorResponse(409, "TICKET_ASSIGNEE_INACTIVE"),
      "This user is inactive, so they can't be the assignee.",
    ],
    [
      "400 TICKET_ASSIGNEE_NOT_ELIGIBLE",
      () => errorResponse(400, "TICKET_ASSIGNEE_NOT_ELIGIBLE"),
      "This user can't be the assignee of this Ticket.",
    ],
    [
      "a field error of a VALIDATION_ERROR for user_id",
      () => validationError([["body", "user_id"]]),
      "This value isn't valid.",
    ],
  ])(
    "shows %s at the user field, which keeps the focus and announces it, reads the users again, and drops the error once the term changes",
    async (_, failure, message) => {
      const spy = stubTicket({
        ticket: () => assignedTo(null),
        users: () => usersPage([BOB_ENTRY]),
        assign: failure,
      });
      const { screen } = await renderDetails();
      await openAssignee(screen, "Bob Wilson @bwilson");

      await userOption(screen, "Bob Wilson @bwilson").click();

      await expect
        .element(searchUsers(screen))
        .toHaveAccessibleDescription(message);
      await expect.element(searchUsers(screen)).toBeInvalid();
      await expect.element(searchUsers(screen)).toHaveFocus();
      // The field held the focus as the choice failed, so a status region of
      // the popover announces the error.
      await expect
        .element(
          assigneePopover(screen)
            .getByRole("status")
            .getByText(message, { exact: true }),
        )
        .toBeInTheDocument();
      await expect.poll(() => directoryReads(spy)).toHaveLength(2);
      await expect
        .element(editAssignee(screen))
        .not.toHaveAttribute("aria-disabled");

      await userEvent.keyboard("b");

      await expect.element(searchUsers(screen)).not.toBeInvalid();
      await expect.element(searchUsers(screen)).toHaveAccessibleDescription("");
      expect(assigneePopover(screen).getByText(message).query()).toBeNull();
    },
  );

  test.each<[string, TicketDetail["assignee"], string]>([
    // Another user took the unassigned Ticket before the user chose Ana.
    ["TICKET_ASSIGNEE_CHANGED", null, "Ana Garcia @agarcia"],
    // Another user took the Ticket before the signed-in user, its assignee,
    // unassigned themselves (Sentinel docs/features/tickets/tickets.md,
    // Self-Unassignment).
    ["TICKET_ASSIGNEE_NOT_CALLER", ALICE, "Unassign yourself"],
  ])(
    "says at the top of the popover who the assignee is now after 409 %s, once the Ticket is read again",
    async (code, before, choice) => {
      let assignee = before;
      stubTicket({
        ticket: () => assignedTo(assignee),
        users: () => usersPage([ANA_ENTRY, BOB_ENTRY]),
        assign: () => {
          assignee = BOB;
          return errorResponse(409, code);
        },
      });
      const { screen } = await renderDetails();
      await openAssignee(screen, choice);

      await userOption(screen, choice).click();

      const message = assigneePopover(screen).getByText(
        "The assignee changed meanwhile: the Ticket is now assigned to Bob Wilson.",
      );
      await expect.element(message).toBeVisible();
      await expect
        .poll(() =>
          message
            .element()
            .closest("[tabindex]")
            ?.contains(document.activeElement),
        )
        .toBe(true);
      await expect
        .element(userOption(screen, "Bob Wilson @bwilson"))
        .toHaveAttribute("aria-selected", "true");
      await expect
        .element(assigneeValue(screen))
        .toHaveTextContent("Bob Wilson");
      // The signed-in user is no longer the assignee.
      expect(userOption(screen, "Unassign yourself").query()).toBeNull();
    },
  );

  test.each<[TicketDetail["assignee"], string]>([
    [null, "The assignee changed meanwhile: the Ticket is now unassigned."],
    [
      ALICE,
      "The assignee changed meanwhile: the Ticket is now assigned to you.",
    ],
  ])(
    "names an assignee that changed meanwhile as the Ticket shows it",
    async (now, text) => {
      let assignee: TicketDetail["assignee"] = BOB;
      stubTicket({
        ticket: () => assignedTo(assignee),
        users: () => usersPage([ANA_ENTRY, BOB_ENTRY]),
        assign: () => {
          assignee = now;
          return errorResponse(409, "TICKET_ASSIGNEE_CHANGED");
        },
      });
      const { screen } = await renderDetails();
      await openAssignee(screen, "Ana Garcia @agarcia");

      await userOption(screen, "Ana Garcia @agarcia").click();

      await expect
        .element(assigneePopover(screen).getByText(text))
        .toBeVisible();
    },
  );

  test("says only that the assignee changed when the read of the Ticket after it fails", async () => {
    let fails = false;
    stubTicket({
      ticket: () =>
        fails ? errorResponse(503, "SERVICE_UNAVAILABLE") : assignedTo(null),
      users: () => usersPage([BOB_ENTRY]),
      assign: () => {
        fails = true;
        return errorResponse(409, "TICKET_ASSIGNEE_CHANGED");
      },
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");

    await userOption(screen, "Bob Wilson @bwilson").click();

    await expect
      .element(
        assigneePopover(screen).getByText("The assignee changed meanwhile.", {
          exact: true,
        }),
      )
      .toBeVisible();
  });

  test.each<[string, () => Response, string, "danger" | "warning"]>([
    [
      "409 TICKET_NOT_MUTABLE",
      () => errorResponse(409, "TICKET_NOT_MUTABLE"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
    [
      "a 503, which Sentinel did not confirm",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      "warning",
    ],
    [
      "a code and a status that the pinned contract does not list",
      () => errorResponse(418, "FICTIONAL_CODE"),
      "Sentinel didn't accept this request.",
      "danger",
    ],
    [
      "a field error of a VALIDATION_ERROR for no field of the popover",
      () => validationError([["body", "expected_assignee_id"]]),
      "Sentinel didn't accept this request.",
      "danger",
    ],
  ])(
    "shows %s at the top of the popover, which stays open and takes the focus",
    async (_, failure, message, tone) => {
      stubTicket({
        ticket: () => assignedTo(null),
        users: () => usersPage([BOB_ENTRY]),
        assign: failure,
      });
      const { screen } = await renderDetails();
      await openAssignee(screen, "Bob Wilson @bwilson");

      await userOption(screen, "Bob Wilson @bwilson").click();

      const text = assigneePopover(screen).getByText(message);
      await expect.element(text).toBeVisible();
      const box = text.element().closest("[tabindex]");
      expect(box).not.toBeNull();
      await expect.element(page.elementLocator(box!)).toHaveFocus();
      expect(backgroundBehind(text.element())).toBe(MESSAGE_TONES[tone]);
      await expect
        .element(editAssignee(screen))
        .not.toHaveAttribute("aria-disabled");
    },
  );

  test("keeps the pencil and the popover with the signed-in user first after a 403 that removes triage_ticket and their eligibility, until the popover closes", async () => {
    let user: UserBody = OTHER_USER;
    const spy = stubTicket({
      user: () => user,
      ticket: () => assignedTo(null),
      users: () => usersPage([BOB_ENTRY]),
      assign: () => {
        user = {
          data: {
            ...OTHER_USER.data,
            roles: [],
            capabilities: [],
            assignment_eligibility: "none",
          },
        };
        return errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION");
      },
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");

    await userOption(screen, "Alice Smith @asmith You").click();

    await expect
      .element(
        assigneePopover(screen).getByText(
          "You don't have permission to do this.",
        ),
      )
      .toBeVisible();
    // Once the read of the signed-in user after the 403 has ended.
    await expect.poll(() => requestsTo(spy, ME)).toBe(2);
    await readEnded(ME);
    await nextFrames();
    await expect.element(assigneePopover(screen)).toBeVisible();
    expect(assigneeOptions(screen)).toEqual([
      "Alice Smith @asmithYou",
      "Bob Wilson @bwilson",
    ]);

    await userEvent.keyboard("{Escape}");

    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await expect.element(editAssignee(screen)).not.toBeInTheDocument();
  });

  test("reads again after an assignment the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, and the reads of the Ticket list, but not its duplicates", async () => {
    const spy = stubTicket({
      user: { data: { ...MAINTAINER.data, capabilities: ["triage_ticket"] } },
      ticket: () =>
        ticketResponse(
          fictionalTicketDetail({
            assignee: BOB,
            packages: [fictionalPackage()],
          }),
        ),
      users: () => usersPage([ANA_ENTRY, BOB_ENTRY]),
      assign: () => assignedTo(BOB),
    });
    // The user saw the Ticket list, and Audit log, before Overview.
    const { router, screen } = await renderApp("/tickets");
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
    await router.navigate({
      to: "/tickets/$ticketId/audit-log",
      params: { ticketId: "SNTL-12" },
    });
    await expect
      .element(screen.getByRole("tabpanel", { name: "Audit log" }))
      .toBeVisible();
    await screen.getByRole("tab", { name: "Overview" }).click();
    await expect.element(detailsPart(screen)).toBeVisible();
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      actors: requestsTo(spy, ACTORS),
      work: requestsTo(spy, YOUR_WORK),
      duplicates: readsOf(spy, TICKETS),
    };
    expect(leftInvalidated(EVENTS)).toBe(false);
    expect(leftInvalidated(TICKETS)).toBe(false);
    await openAssignee(screen, "Ana Garcia @agarcia");

    await userOption(screen, "Ana Garcia @agarcia").click();

    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(reads.work + 1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    expect(readsOf(spy, TICKETS)).toBe(reads.duplicates);
    expect(leftInvalidated(EVENTS)).toBe(true);
    expect(leftInvalidated(TICKETS)).toBe(true);
  });

  test("closes the popover when the layout changes, the focus moving to the heading of the screen", async () => {
    stubTicket({
      ticket: () => assignedTo(null),
      users: () => usersPage([BOB_ENTRY]),
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");

    await page.viewport(900, 800);

    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "SNTL-12" }))
      .toHaveFocus();
    await expect.element(editAssignee(screen)).toBeVisible();
  });

  test("keeps the pencil busy in its new place when the layout changes during an assignment, whose failure then shows in the message area", async () => {
    const response = later();
    stubTicket({
      ticket: () => assignedTo(null),
      users: () => usersPage([BOB_ENTRY]),
      assign: () => response.promise,
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");
    await userOption(screen, "Bob Wilson @bwilson").click();
    await expect
      .element(editAssignee(screen))
      .toHaveAttribute("aria-disabled", "true");

    await page.viewport(900, 800);

    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await expect
      .element(editAssignee(screen))
      .toHaveAttribute("aria-disabled", "true");
    // A press that the pointer cannot give a button that is not enabled, as
    // assistive technologies give it.
    editAssignee(screen)
      .element()
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrames();
    expect(assigneePopover(screen).query()).toBeNull();

    response.resolve(errorResponse(503, "SERVICE_UNAVAILABLE"));

    await expect
      .element(
        screen.getByText(
          "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
        ),
      )
      .toBeVisible();
    await expect
      .element(editAssignee(screen))
      .not.toHaveAttribute("aria-disabled");
    expect(assigneePopover(screen).query()).toBeNull();
  });

  test("announces an assignment that ends after the layout changed", async () => {
    let assignee: TicketDetail["assignee"] = null;
    const response = later();
    stubTicket({
      ticket: () => assignedTo(assignee),
      users: () => usersPage([BOB_ENTRY]),
      assign: () => response.promise,
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");
    await userOption(screen, "Bob Wilson @bwilson").click();
    await page.viewport(900, 800);
    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();

    assignee = BOB;
    response.resolve(assignedTo(BOB));

    await expect
      .poll(() => announcements())
      .toContain("Assigned to Bob Wilson.");
    expect(assigneePopover(screen).query()).toBeNull();
  });

  test.each<[string, () => Response, string]>([
    [
      "an assignment",
      () => assignedTo(BOB),
      "SNTL-12: Assigned to Bob Wilson.",
    ],
    [
      "a failed assignment",
      () => errorResponse(409, "TICKET_ASSIGNEE_CHANGED"),
      "SNTL-12: This can't be done in the current state, which may have changed. Check it and try again.",
    ],
  ])(
    "names the Ticket with a link in the message of %s that ends after the user left its screen",
    async (_, outcome, message) => {
      const response = later();
      stubTicket({
        ticket: () => assignedTo(null),
        users: () => usersPage([BOB_ENTRY]),
        assign: () => response.promise,
      });
      const { router, screen } = await renderDetails();
      await openAssignee(screen, "Bob Wilson @bwilson");
      await userOption(screen, "Bob Wilson @bwilson").click();
      await router.navigate({ to: "/tickets" });
      await expect
        .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
        .toBeVisible();

      response.resolve(outcome());

      await expect
        .element(mainContent(screen).getByText(message))
        .toBeVisible();
      await expect
        .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
        .toHaveAttribute("href", "/tickets/SNTL-12");
    },
  );
});
