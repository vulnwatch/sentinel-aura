import { MutationObserver as ChangeObserver } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../../styles.css";
import type { CurrentUserResponse } from "../../api/generated/model";
import { formatDateTime } from "../../components/date-time";
import { getRevokeTicketAccessMutationKey } from "../../api/generated/tickets";
import { participantsOf } from "./participants";
import {
  actorsResponse,
  errorResponse,
  FICTIONAL_ACTORS,
  FICTIONAL_USER,
  fictionalDirectoryUser,
  fictionalGrant,
  grantResponse,
  grantsResponse,
  usersPage,
  validationError,
  fictionalPackage,
  fictionalTicketDetail,
  OTHER_USER,
  requestsTo,
  ticketResponse,
} from "../../test-api";
import {
  ACCESS,
  ACTORS,
  backgroundBehind,
  boxOf,
  client,
  confidentialTicket,
  later,
  leaveForTickets,
  ME,
  MESSAGE_CONFLICT,
  MESSAGE_TONES,
  nextFrames,
  prepareEachTest,
  press,
  readsOf,
  renderApp,
  requestsWith,
  returnToForeground,
  type Screen,
  sourcesPart,
  stubTicket,
  TICKET,
} from "./test-support";

// The participants and the access grants of Overview, the first tab of the
// Ticket screen (src/routes/ticket-overview/participants.tsx;
// docs/screens/ticket.md), at the browser's default text size, in the light
// theme.

prepareEachTest();

// An analyst who manages confidentiality, who grants and revokes access.
const MANAGER: CurrentUserResponse = {
  data: {
    ...OTHER_USER.data,
    capabilities: ["triage_ticket", "manage_confidentiality"],
  },
};

// Carol White, who holds the grant of fictionalGrant, and a second grantee.
const CAROL = fictionalGrant();
const EMMA = fictionalGrant({
  user: {
    id: "00000000-0000-0000-0000-000000000009",
    username: "egreen",
    full_name: "Emma Green",
    active: true,
    bot: false,
    avatar_url: null,
  },
  granted_at: "2099-10-11T08:00:00Z",
});

// The same SNTL-12, no longer confidential.
function declassifiedTicket() {
  return ticketResponse(
    fictionalTicketDetail({ assignee: FICTIONAL_ACTORS[1]! }),
  );
}

function participantsPart(screen: Screen) {
  return screen.getByRole("region", { name: "Participants", exact: true });
}

function participantsGroup(screen: Screen) {
  return participantsPart(screen).getByRole("toolbar", {
    name: "Participants",
  });
}

// The names of the participants, in their order.
function participantNames(screen: Screen): (string | null)[] {
  return participantsGroup(screen)
    .getByRole("img")
    .elements()
    .map((element) => element.getAttribute("aria-label"));
}

function accessGrantsButton(screen: Screen) {
  return participantsPart(screen).getByRole("button", {
    name: "Access grants",
    exact: true,
  });
}

function accessGrantsDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Access grants" });
}

function userField(screen: Screen) {
  return accessGrantsDialog(screen).getByRole("combobox", { name: "User" });
}

function grantButton(screen: Screen) {
  return accessGrantsDialog(screen).getByRole("button", {
    name: "Grant access",
    exact: true,
  });
}

function revokeOf(screen: Screen, name: string) {
  return accessGrantsDialog(screen).getByRole("button", {
    name: `Revoke access of ${name}`,
    exact: true,
  });
}

function confirmationOf(screen: Screen, name: string) {
  return screen.getByRole("dialog", { name: `Revoke access of ${name}?` });
}

// What the status regions of the dialog of the access grants say.
function dialogStatus(screen: Screen): string {
  return accessGrantsDialog(screen)
    .getByRole("status")
    .elements()
    .map((region) => region.textContent ?? "")
    .join("");
}

// The lines of the grants in the dialog, in their order.
function grantLines(screen: Screen): (string | null)[] {
  return accessGrantsDialog(screen)
    .getByRole("list", { name: "Access grants" })
    .getByRole("listitem")
    .elements()
    .map((element) => element.textContent);
}

// Renders the screen of SNTL-12 and waits until its participants show.
async function renderParticipants() {
  const rendered = await renderApp("/tickets/SNTL-12");
  await expect
    .element(
      participantsPart(rendered.screen)
        .getByRole("toolbar")
        .or(participantsPart(rendered.screen).getByText("No participants.")),
    )
    .toBeVisible();
  return rendered;
}

// Opens the access grants and waits until they show, or say that the Ticket
// has none.
async function openAccessGrants(screen: Screen, empty = false) {
  await accessGrantsButton(screen).click();
  const dialog = accessGrantsDialog(screen);
  await expect
    .element(
      empty
        ? dialog.getByText("No access grants.")
        : dialog.getByRole("list", { name: "Access grants" }),
    )
    .toBeVisible();
}

// Chooses the user of the directory in the user field, by typing a part of
// the name.
async function chooseUser(screen: Screen, term: string, option: string) {
  await userField(screen).fill(term);
  await screen.getByRole("option", { name: option }).click();
  await expect.element(userField(screen)).toHaveValue(option);
}

// Opens the confirmation of Revoke access of Carol White and confirms it.
async function revokeCarol(screen: Screen) {
  await revokeOf(screen, "Carol White @cwhite").click();
  await confirmationOf(screen, "Carol White")
    .getByRole("button", { name: "Revoke access", exact: true })
    .click();
}

describe("the participants", () => {
  test("show each participant once, the assignee first and then by display name, an inactive user named so, without bot accounts and the maintainers of an excluded package", async () => {
    stubTicket({
      ticket: () =>
        confidentialTicket({
          packages: [
            fictionalPackage(),
            {
              ...fictionalPackage({
                id: "00000000-0000-0000-0000-0000000000a2",
                package_name: "fictional-zlib",
                maintainers: [
                  {
                    id: "00000000-0000-0000-0000-00000000000a",
                    username: "ghill",
                    full_name: "Grace Hill",
                    active: true,
                    bot: false,
                    avatar_url: null,
                  },
                ],
              }),
              deleted_at: "2099-10-10T12:00:00Z",
            },
          ],
        }),
      actors: () => actorsResponse(),
      grants: () =>
        grantsResponse([
          CAROL,
          fictionalGrant({ user: FICTIONAL_ACTORS[2]! }),
          fictionalGrant({ user: FICTIONAL_ACTORS[0]! }),
        ]),
    });

    const { screen } = await renderParticipants();

    expect(participantNames(screen)).toEqual([
      "Alice Smith",
      "Ana Garcia",
      "Carol White",
      "Dave Brown",
      "Robert Lee (inactive)",
    ]);
    await expect
      .element(participantsGroup(screen).getByRole("list"))
      .toBeVisible();
  });

  test("order users of the same display name by username", () => {
    const namesake = {
      id: "00000000-0000-0000-0000-00000000000b",
      username: "agarcia2",
      full_name: "Ana Garcia",
      active: true,
      bot: false,
      avatar_url: null,
    };

    const participants = participantsOf(
      fictionalTicketDetail({ assignee: null, packages: [] }),
      [namesake],
      [fictionalGrant({ user: FICTIONAL_ACTORS[0]! })],
    );

    expect(participants.map((user) => user.username)).toEqual([
      "agarcia",
      "agarcia2",
    ]);
  });

  test("show the assignee alone, without reading access grants, on a Ticket that is not confidential", async () => {
    const spy = stubTicket({ ticket: () => declassifiedTicket() });

    const { screen } = await renderParticipants();

    expect(participantNames(screen)).toEqual(["Alice Smith"]);
    expect(requestsTo(spy, ACCESS)).toBe(0);
    await expect.element(accessGrantsButton(screen)).not.toBeInTheDocument();
  });

  test("say that the Ticket has none without an assignee and actors", async () => {
    stubTicket({
      ticket: () =>
        ticketResponse(fictionalTicketDetail({ assignee: null, packages: [] })),
    });

    const { screen } = await renderParticipants();

    await expect
      .element(participantsPart(screen).getByText("No participants."))
      .toBeVisible();
  });

  test("are the last section of the side column, in the order of the page", async () => {
    stubTicket();

    const { screen } = await renderParticipants();

    const sources = sourcesPart(screen).element();
    const participants = participantsPart(screen).element();
    expect(
      sources.compareDocumentPosition(participants) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(participants.nextElementSibling).toBeNull();
  });

  test("show the loading indicator until both reads arrive, and Access grants at once", async () => {
    const grants = later();
    stubTicket({
      ticket: () => confidentialTicket(),
      grants: () => grants.promise,
    });
    const { screen } = await renderApp("/tickets/SNTL-12");

    await expect.element(accessGrantsButton(screen)).toBeVisible();
    await expect
      .element(
        participantsPart(screen).getByRole("progressbar", { name: "Loading" }),
      )
      .toBeVisible();
    await accessGrantsButton(screen).click();
    await expect
      .element(
        accessGrantsDialog(screen).getByRole("progressbar", {
          name: "Loading",
        }),
      )
      .toBeVisible();

    grants.resolve(grantsResponse());

    await expect.poll(() => grantLines(screen).length).toBe(1);
    expect(participantNames(screen)).toEqual(["Alice Smith", "Carol White"]);
  });

  test("show the failure of a read of the users who acted in their place, with Try again, and then the participants", async () => {
    let failing = true;
    stubTicket({
      ticket: () => declassifiedTicket(),
      actors: () =>
        failing ? errorResponse(503, "SERVICE_UNAVAILABLE") : actorsResponse(),
    });
    const { screen } = await renderApp("/tickets/SNTL-12");

    await expect
      .element(
        participantsPart(screen).getByText(
          "Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    failing = false;
    await participantsPart(screen)
      .getByRole("button", { name: "Try again" })
      .click();

    await expect
      .poll(() => participantNames(screen))
      .toEqual(["Alice Smith", "Ana Garcia", "Robert Lee (inactive)"]);
  });

  test("show the failure of the read of the access grants in their place and in their dialog, each with Try again", async () => {
    let failing = true;
    const spy = stubTicket({
      ticket: () => confidentialTicket(),
      grants: () =>
        failing ? errorResponse(503, "SERVICE_UNAVAILABLE") : grantsResponse(),
    });
    const { screen } = await renderApp("/tickets/SNTL-12");
    const message = "Sentinel isn't available right now. Try again later.";

    await expect
      .element(participantsPart(screen).getByText(message))
      .toBeVisible();
    await accessGrantsButton(screen).click();
    await expect
      .element(accessGrantsDialog(screen).getByText(message))
      .toBeVisible();
    const reads = requestsTo(spy, ACCESS);
    failing = false;
    await press(
      accessGrantsDialog(screen).getByRole("button", { name: "Try again" }),
    );

    await expect.poll(() => grantLines(screen).length).toBe(1);
    expect(requestsTo(spy, ACCESS)).toBe(reads + 1);
    // Try again leaves with the error, and the focus stays in the dialog.
    await expect.element(accessGrantsDialog(screen)).toHaveFocus();
  });

  test("show a conflict of the read of the access grants with another code as a failure", async () => {
    const spy = stubTicket({
      ticket: () => confidentialTicket(),
      grants: () => errorResponse(409, "FICTIONAL_CODE"),
    });
    const { screen } = await renderApp("/tickets/SNTL-12");

    await expect
      .element(
        participantsPart(screen).getByText(
          "This can't be done in the current state, which may have changed. Check it and try again.",
        ),
      )
      .toBeVisible();
    expect(requestsTo(spy, TICKET)).toBe(1);
    await expect.element(accessGrantsButton(screen)).toBeVisible();
  });

  test("show the participants without access grants, and read the Ticket again, when Sentinel says that it is no longer confidential", async () => {
    let confidential = true;
    const spy = stubTicket({
      ticket: () =>
        confidential ? confidentialTicket() : declassifiedTicket(),
      grants: () => {
        confidential = false;
        return errorResponse(409, "TICKET_NOT_CONFIDENTIAL");
      },
    });

    const { screen } = await renderParticipants();

    expect(participantNames(screen)).toEqual(["Alice Smith"]);
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(2);
    await expect.element(accessGrantsButton(screen)).not.toBeInTheDocument();
  });

  test("move the focus to the screen's heading when a read removes Access grants while it has it", async () => {
    let confidential = true;
    stubTicket({
      ticket: () =>
        confidential ? confidentialTicket() : declassifiedTicket(),
      grants: () => grantsResponse(),
    });
    const { screen } = await renderParticipants();
    accessGrantsButton(screen).element().focus();
    confidential = false;

    await returnToForeground();

    await expect.element(accessGrantsButton(screen)).not.toBeInTheDocument();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toHaveFocus();
  });
});

describe("the access grants", () => {
  test("show every user who can see a confidential Ticket its grants, with who granted them and when, a bot account with its label, without Revoke access and the user field", async () => {
    const bot = fictionalGrant({
      user: FICTIONAL_ACTORS[2]!,
      granted_at: "2099-10-12T08:00:00Z",
    });
    stubTicket({
      user: FICTIONAL_USER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse([CAROL, EMMA, bot]),
    });
    const { screen } = await renderParticipants();

    await openAccessGrants(screen);

    const dialog = accessGrantsDialog(screen);
    await expect.element(dialog).toHaveFocus();
    await expect
      .element(
        dialog.getByText(
          "An access grant lets a user see this confidential Ticket. The users who see every Ticket, and the maintainers of its packages that are not excluded, see it without one.",
        ),
      )
      .toBeVisible();
    expect(grantLines(screen)).toEqual([
      `Carol White @cwhiteGranted by Alice Smith on ${formatDateTime(CAROL.granted_at)}`,
      `Emma Green @egreenGranted by Alice Smith on ${formatDateTime(EMMA.granted_at)}`,
      `Fictional Bot @fictional-botBotGranted by Alice Smith on ${formatDateTime(bot.granted_at)}`,
    ]);
    await expect
      .element(dialog.getByRole("button", { name: /^Revoke access/ }))
      .not.toBeInTheDocument();
    await expect.element(dialog.getByRole("combobox")).not.toBeInTheDocument();
  });

  test("close with Close, which returns the focus to the button that opened them", async () => {
    stubTicket({
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .click();

    await expect.element(accessGrantsDialog(screen)).not.toBeInTheDocument();
    await expect.element(accessGrantsButton(screen)).toHaveFocus();
  });

  test("return the focus to Access grants on Escape, also from a grant", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    revokeOf(screen, "Carol White @cwhite").element().focus();

    await userEvent.keyboard("{Escape}");

    await expect.element(accessGrantsDialog(screen)).not.toBeInTheDocument();
    await expect.element(accessGrantsButton(screen)).toHaveFocus();
    // Not for a moment the heading, as the dialog left.
    await nextFrames();
    await expect.element(accessGrantsButton(screen)).toHaveFocus();
  });

  test("say that the Ticket has none", async () => {
    stubTicket({ user: FICTIONAL_USER, ticket: () => confidentialTicket() });
    const { screen } = await renderParticipants();

    await openAccessGrants(screen, true);
  });

  test("give the user field the focus for a user who manages confidentiality, and list a grantee as granted, disabled", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () =>
        usersPage([
          fictionalDirectoryUser(),
          fictionalDirectoryUser({
            id: CAROL.user.id,
            username: "cwhite",
            full_name: "Carol White",
          }),
        ]),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    await expect.element(userField(screen)).toHaveFocus();
    await expect.element(userField(screen)).toHaveAttribute("maxlength", "500");

    await userField(screen).fill("an");

    await expect
      .element(screen.getByRole("option", { name: "Ana Garcia @agarcia" }))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("option", { name: "Carol White @cwhite Granted" }),
      )
      .toHaveAttribute("aria-disabled", "true");
  });

  test("grant access to the chosen user, then empty the field, keep the focus on Grant access, announce it, and read again what it affects", async () => {
    let grants = [CAROL];
    const bodies: unknown[] = [];
    const spy = stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(grants),
      users: () => usersPage([fictionalDirectoryUser()]),
      grant: (body) => {
        bodies.push(body);
        const grant = fictionalGrant({ user: FICTIONAL_ACTORS[0]! });
        grants = [CAROL, grant];
        return grantResponse(grant);
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      grants: readsOf(spy, ACCESS),
      actors: requestsTo(spy, ACTORS),
    };

    await chooseUser(screen, "ana", "Ana Garcia @agarcia");
    await grantButton(screen).click();

    await expect
      .poll(() => dialogStatus(screen))
      .toBe("Access granted to Ana Garcia.");
    expect(bodies).toEqual([{ user: fictionalDirectoryUser().id }]);
    await expect.element(revokeOf(screen, "Ana Garcia @agarcia")).toBeVisible();
    await expect.element(userField(screen)).toHaveValue("");
    await expect.element(grantButton(screen)).toHaveFocus();
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
    await expect.poll(() => readsOf(spy, ACCESS)).toBe(reads.grants + 1);
    await expect.poll(() => participantNames(screen)).toContain("Ana Garcia");
  });

  test("keep the focus in the field after a grant submitted with Enter, which sends one request while it is in progress", async () => {
    const response = later();
    const spy = stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () => usersPage([fictionalDirectoryUser()]),
      grant: () => response.promise,
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");

    await userEvent.keyboard("{Enter}");
    await expect
      .element(grantButton(screen))
      .toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Enter}");
    // While the grant is in progress, the dialog cannot be closed.
    await userEvent.keyboard("{Escape}");
    await expect
      .element(
        accessGrantsDialog(screen).getByRole("button", { name: "Close" }),
      )
      .toBeDisabled();
    expect(requestsWith(spy, "POST")).toHaveLength(1);
    response.resolve(
      grantResponse(fictionalGrant({ user: FICTIONAL_ACTORS[0]! })),
    );

    await expect.element(userField(screen)).toHaveValue("");
    await expect.element(userField(screen)).toHaveFocus();
    await expect.element(accessGrantsDialog(screen)).toBeVisible();
  });

  test("ask for a user before granting access", async () => {
    const spy = stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await grantButton(screen).click();

    await expect
      .element(accessGrantsDialog(screen).getByText("Choose a user."))
      .toBeVisible();
    await expect.element(userField(screen)).toHaveFocus();
    await expect
      .element(userField(screen))
      .toHaveAttribute("aria-invalid", "true");
    expect(requestsWith(spy, "POST")).toHaveLength(0);
    // The error goes as the user types.
    await userField(screen).fill("an");
    await expect
      .element(userField(screen))
      .not.toHaveAttribute("aria-invalid", "true");
  });

  test.each([
    [
      "an inactive user",
      () => errorResponse(409, "USER_INACTIVE"),
      "This user is inactive, so they can't be granted access.",
    ],
    [
      "an unknown user",
      () => errorResponse(404, "USER_NOT_FOUND"),
      "Sentinel doesn't know this user.",
    ],
    [
      "a field error of a VALIDATION_ERROR",
      () => validationError([["body", "user"]]),
      "This value isn't valid.",
    ],
  ])(
    "show the error of %s at the user field, which takes the focus",
    async (_case, response, message) => {
      stubTicket({
        user: MANAGER,
        ticket: () => confidentialTicket(),
        grants: () => grantsResponse(),
        users: () => usersPage([fictionalDirectoryUser()]),
        grant: response,
      });
      const { screen } = await renderParticipants();
      await openAccessGrants(screen);
      await chooseUser(screen, "ana", "Ana Garcia @agarcia");

      await grantButton(screen).click();

      await expect
        .element(accessGrantsDialog(screen).getByText(message))
        .toBeVisible();
      await expect.element(userField(screen)).toHaveFocus();
      await expect
        .element(userField(screen))
        .toHaveAttribute("aria-invalid", "true");
    },
  );

  test.each([
    [
      "a change that Sentinel did not confirm, as a warning",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      MESSAGE_TONES.warning,
    ],
    [
      "a VALIDATION_ERROR of no field, as an error",
      () => validationError([["body"]]),
      "Sentinel didn't accept this request.",
      MESSAGE_TONES.danger,
    ],
    [
      "a status and a code that the pinned contract does not list, as an error",
      () => errorResponse(418, "FICTIONAL_CODE"),
      "Sentinel didn't accept this request.",
      MESSAGE_TONES.danger,
    ],
  ])(
    "show %s at the top of the form, which takes the focus and keeps the user",
    async (_case, response, message, tone) => {
      const spy = stubTicket({
        user: MANAGER,
        ticket: () => confidentialTicket(),
        grants: () => grantsResponse(),
        users: () => usersPage([fictionalDirectoryUser()]),
        grant: response,
      });
      const { screen } = await renderParticipants();
      await openAccessGrants(screen);
      await chooseUser(screen, "ana", "Ana Garcia @agarcia");
      const reads = requestsTo(spy, TICKET);

      await grantButton(screen).click();

      const error = accessGrantsDialog(screen).getByText(message);
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(tone);
      // The error takes the focus once it has shown, after the response.
      await expect
        .poll(() =>
          error
            .element()
            .closest("[tabindex]")
            ?.contains(document.activeElement),
        )
        .toBe(true);
      await expect
        .element(userField(screen))
        .toHaveValue("Ana Garcia @agarcia");
      // Whatever its outcome, the screen reads again what it affects.
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    },
  );

  test("keep the dialog open when the Ticket is no longer confidential, say so, take the focus, and move it to the screen's heading once closed", async () => {
    let confidential = true;
    stubTicket({
      user: MANAGER,
      ticket: () =>
        confidential ? confidentialTicket() : declassifiedTicket(),
      grants: () =>
        confidential
          ? grantsResponse()
          : errorResponse(409, "TICKET_NOT_CONFIDENTIAL"),
      users: () => usersPage([fictionalDirectoryUser()]),
      grant: () => {
        confidential = false;
        return errorResponse(409, "TICKET_NOT_CONFIDENTIAL");
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");

    await grantButton(screen).click();

    const dialog = accessGrantsDialog(screen);
    await expect
      .element(
        dialog.getByText(
          "This Ticket is no longer confidential, so it has no access grants.",
        ),
      )
      .toBeVisible();
    await expect.element(dialog).toHaveFocus();
    expect(dialogStatus(screen)).toContain(
      "This Ticket is no longer confidential, so it has no access grants.",
    );
    await expect.element(dialog.getByRole("combobox")).not.toBeInTheDocument();
    await expect.element(accessGrantsButton(screen)).not.toBeInTheDocument();

    // Without a grant to make, Close asks nothing.
    await dialog.getByRole("button", { name: "Close" }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toHaveFocus();
  });

  test("ask before Close discards the user chosen, keep it on Keep editing, and close on Discard", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () => usersPage([fictionalDirectoryUser()]),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");

    await accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .click();
    const discard = screen.getByRole("dialog", { name: "Discard changes?" });
    await expect
      .element(discard.getByRole("button", { name: "Keep editing" }))
      .toHaveFocus();
    await expect
      .element(
        discard.getByText("The user that you chose isn't granted access."),
      )
      .toBeVisible();
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect.element(discard).not.toBeInTheDocument();
    await expect.element(userField(screen)).toHaveValue("Ana Garcia @agarcia");

    // Escape asks too.
    userField(screen).element().focus();
    await userEvent.keyboard("{Escape}");
    await expect.element(discard).toBeVisible();
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect.element(accessGrantsDialog(screen)).not.toBeInTheDocument();
    await expect.element(accessGrantsButton(screen)).toHaveFocus();
    // The dialog opens again without the user, and closes without a
    // question.
    await openAccessGrants(screen);
    await expect.element(userField(screen)).toHaveValue("");
    await accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .click();
    await expect.element(accessGrantsDialog(screen)).not.toBeInTheDocument();
  });

  test("ask before a navigation of the UI discards the user chosen, keep the dialog and the user on Keep editing, and leave on Discard", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () => usersPage([fictionalDirectoryUser()]),
    });
    const { router, screen } = await renderParticipants();
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");

    router.history.push("/tickets");

    const discard = screen.getByRole("dialog", { name: "Discard changes?" });
    await expect
      .element(
        discard.getByText("The user that you chose isn't granted access."),
      )
      .toBeVisible();
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect.element(discard).not.toBeInTheDocument();
    await nextFrames();
    expect(router.state.location.pathname).toBe("/tickets/SNTL-12");
    await expect.element(userField(screen)).toHaveValue("Ana Garcia @agarcia");

    router.history.push("/tickets");
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
  });

  test("ask before Close discards the user chosen while a revocation of another Ticket is in progress", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse([CAROL]),
      users: () => usersPage([fictionalDirectoryUser()]),
    });
    const { screen } = await renderParticipants();
    // A revocation on another Ticket, which the user started there and which
    // has not ended.
    void new ChangeObserver<never, Error, { ticketId: string; user: string }>(
      client,
      {
        mutationKey: getRevokeTicketAccessMutationKey(),
        mutationFn: () => new Promise<never>(() => undefined),
      },
    ).mutate({ ticketId: "SNTL-13", user: CAROL.user.id });
    await expect
      .poll(() =>
        client.isMutating({ mutationKey: getRevokeTicketAccessMutationKey() }),
      )
      .toBe(1);
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");

    await accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .click();

    await expect
      .element(screen.getByRole("dialog", { name: "Discard changes?" }))
      .toBeVisible();
  });

  test("ask nothing before a navigation while a revocation is in progress with a user chosen", async () => {
    const response = later();
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse([CAROL]),
      users: () => usersPage([fictionalDirectoryUser()]),
      revoke: () => response.promise,
    });
    const { router, screen } = await renderParticipants();
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");
    await revokeCarol(screen);
    await expect
      .element(
        confirmationOf(screen, "Carol White").getByRole("button", {
          name: "Revoke access",
          exact: true,
        }),
      )
      .toHaveAttribute("aria-disabled", "true");

    await leaveForTickets(router, screen);

    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }).query(),
    ).toBeNull();
    response.resolve(new Response(null, { status: 204 }));
    await expect
      .element(screen.getByText("SNTL-12: Access of Carol White revoked."))
      .toBeVisible();
  });

  test.each<
    [string, (screen: Screen) => Promise<void>, () => Response, string, string]
  >([
    [
      "a grant",
      async (screen) => {
        await chooseUser(screen, "ana", "Ana Garcia @agarcia");
        await grantButton(screen).click();
        await expect
          .element(grantButton(screen))
          .toHaveAttribute("aria-disabled", "true");
      },
      () => grantResponse(fictionalGrant({ user: FICTIONAL_ACTORS[0]! })),
      "SNTL-12: Access granted to Ana Garcia.",
      MESSAGE_TONES.success,
    ],
    [
      "a grant that Sentinel refuses",
      async (screen) => {
        await chooseUser(screen, "ana", "Ana Garcia @agarcia");
        await grantButton(screen).click();
        await expect
          .element(grantButton(screen))
          .toHaveAttribute("aria-disabled", "true");
      },
      () => errorResponse(409, "TICKET_NOT_CONFIDENTIAL"),
      `SNTL-12: ${MESSAGE_CONFLICT}`,
      MESSAGE_TONES.danger,
    ],
    [
      "a revocation",
      async (screen) => {
        await revokeCarol(screen);
        await expect
          .element(
            confirmationOf(screen, "Carol White").getByRole("button", {
              name: "Revoke access",
              exact: true,
            }),
          )
          .toHaveAttribute("aria-disabled", "true");
      },
      () => new Response(null, { status: 204 }),
      "SNTL-12: Access of Carol White revoked.",
      MESSAGE_TONES.success,
    ],
  ])(
    "leave without a question while %s is in progress, and show its outcome in the message area, naming the Ticket",
    async (_, start, outcome, text, tone) => {
      const response = later();
      stubTicket({
        user: MANAGER,
        ticket: () => confidentialTicket(),
        grants: () => grantsResponse([CAROL]),
        users: () => usersPage([fictionalDirectoryUser()]),
        grant: () => response.promise,
        revoke: () => response.promise,
      });
      const { router, screen } = await renderParticipants();
      await openAccessGrants(screen);
      await start(screen);

      await leaveForTickets(router, screen);

      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();
      response.resolve(outcome());
      const message = screen.getByText(text);
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(tone);
      await expect
        .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
        .toHaveAttribute("href", "/tickets/SNTL-12");
    },
  );

  test("close without a question with a term typed and no user chosen", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () => usersPage([fictionalDirectoryUser()]),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    // Found before the menu of the field opens, which hides the rest of the
    // page from assistive technologies.
    const close = accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .element();
    await userField(screen).fill("ana");
    const option = screen.getByRole("option", { name: "Ana Garcia @agarcia" });
    await expect.element(option).toBeVisible();

    close.focus();
    await userEvent.keyboard("{Enter}");

    // The dialog leaves the page, rather than hiding behind a question.
    await expect.poll(() => close.isConnected).toBe(false);
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }).query(),
    ).toBeNull();
  });

  test("revoke a grant after confirmation, then move the focus to the next Revoke access, announce it, and read again what it affects", async () => {
    let grants = [CAROL, EMMA];
    const revoked: string[] = [];
    const spy = stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(grants),
      revoke: (path) => {
        revoked.push(path);
        grants = [EMMA];
        return new Response(null, { status: 204 });
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      actors: requestsTo(spy, ACTORS),
    };

    await revokeOf(screen, "Carol White @cwhite").click();
    const confirmation = confirmationOf(screen, "Carol White");
    await expect
      .element(confirmation.getByRole("button", { name: "Cancel" }))
      .toHaveFocus();
    await expect
      .element(
        confirmation.getByText(
          "Carol White loses the access grant to this confidential Ticket, and no longer sees it unless their roles or the packages that they maintain let them.",
        ),
      )
      .toBeVisible();
    await confirmation
      .getByRole("button", { name: "Revoke access", exact: true })
      .click();

    await expect.element(confirmation).not.toBeInTheDocument();
    await expect.element(revokeOf(screen, "Emma Green @egreen")).toHaveFocus();
    expect(revoked).toEqual([`${ACCESS}/${CAROL.user.id}`]);
    expect(dialogStatus(screen)).toBe("Access of Carol White revoked.");
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
  });

  test("move the focus to the user field after Revoke access of the last grant", async () => {
    let grants = [EMMA, CAROL];
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(grants),
      revoke: () => {
        grants = [EMMA];
        return new Response(null, { status: 204 });
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    // The element with the focus as the grant leaves the list, which the
    // focus does not leave for the page meanwhile.
    const list = accessGrantsDialog(screen)
      .getByRole("list", { name: "Access grants" })
      .element();
    let focusedAsRemoved: Element | null = null;
    const observer = new MutationObserver(() => {
      if (focusedAsRemoved === null && list.childElementCount === 1) {
        focusedAsRemoved = document.activeElement;
      }
    });
    observer.observe(list, { childList: true });

    try {
      await revokeCarol(screen);

      await expect
        .element(revokeOf(screen, "Carol White @cwhite"))
        .not.toBeInTheDocument();
    } finally {
      observer.disconnect();
    }
    await expect.element(userField(screen)).toHaveFocus();
    expect(focusedAsRemoved).toBe(userField(screen).element());
  });

  test("move the focus to the next Revoke access when a read removes the grant whose Revoke access has it", async () => {
    let grants = [CAROL, EMMA];
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(grants),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    revokeOf(screen, "Carol White @cwhite").element().focus();
    // Meanwhile another analyst revoked it.
    grants = [EMMA];

    await returnToForeground();

    await expect
      .element(revokeOf(screen, "Carol White @cwhite"))
      .not.toBeInTheDocument();
    await expect.element(revokeOf(screen, "Emma Green @egreen")).toHaveFocus();
  });

  test("keep the grant after Cancel", async () => {
    const spy = stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await revokeOf(screen, "Carol White @cwhite").click();
    await confirmationOf(screen, "Carol White")
      .getByRole("button", { name: "Cancel" })
      .click();

    await expect.element(revokeOf(screen, "Carol White @cwhite")).toHaveFocus();
    expect(requestsWith(spy, "DELETE")).toHaveLength(0);
  });

  test("keep the confirmation open while Revoke access is in progress", async () => {
    const response = later();
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      revoke: () => response.promise,
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await revokeCarol(screen);
    const confirmation = confirmationOf(screen, "Carol White");
    await expect
      .element(
        confirmation.getByRole("button", {
          name: "Revoke access",
          exact: true,
        }),
      )
      .toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");

    await expect.element(confirmation).toBeVisible();
    response.resolve(new Response(null, { status: 204 }));
    await expect.element(confirmation).not.toBeInTheDocument();
  });

  test("show the failure of Revoke access at the top of the confirmation, which stays open, also once the user no longer manages confidentiality", async () => {
    let refused = false;
    const spy = stubTicket({
      user: () => (refused ? OTHER_USER : MANAGER),
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      revoke: () => {
        refused = true;
        return errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION");
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    const userReads = requestsTo(spy, ME);

    await revokeCarol(screen);

    const confirmation = confirmationOf(screen, "Carol White");
    const error = confirmation.getByText(
      "You don't have permission to do this.",
    );
    await expect.element(error).toBeVisible();
    // The read of the signed-in user after the 403 removes the capability,
    // which the dialog keeps while it is open.
    await expect.poll(() => requestsTo(spy, ME)).toBe(userReads + 1);
    await expect.poll(() => client.isFetching()).toBe(0);
    await expect.element(confirmation).toBeVisible();
    await expect.element(error).toBeVisible();

    // Once the dialog opens again, it offers no change.
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .click();
    await openAccessGrants(screen);
    await expect
      .element(accessGrantsDialog(screen).getByRole("combobox"))
      .not.toBeInTheDocument();
    expect(
      accessGrantsDialog(screen)
        .getByRole("button", { name: /^Revoke access/ })
        .query(),
    ).toBeNull();
  });

  test("say that the Ticket is no longer confidential in place of the confirmation of Revoke access, and take the focus", async () => {
    let confidential = true;
    stubTicket({
      user: MANAGER,
      ticket: () =>
        confidential ? confidentialTicket() : declassifiedTicket(),
      grants: () =>
        confidential
          ? grantsResponse()
          : errorResponse(409, "TICKET_NOT_CONFIDENTIAL"),
      revoke: () => {
        confidential = false;
        return errorResponse(409, "TICKET_NOT_CONFIDENTIAL");
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await revokeCarol(screen);

    const dialog = accessGrantsDialog(screen);
    await expect
      .element(
        dialog.getByText(
          "This Ticket is no longer confidential, so it has no access grants.",
        ),
      )
      .toBeVisible();
    await expect
      .element(confirmationOf(screen, "Carol White"))
      .not.toBeInTheDocument();
    await expect.element(dialog).toHaveFocus();
    // Not for a moment the heading, behind the dialog.
    await nextFrames();
    await expect.element(dialog).toHaveFocus();
  });

  test("announce Revoke access once a read of the grants after it arrives, also one that fails", async () => {
    const reread = later();
    let revoked = false;
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => (revoked ? reread.promise : grantsResponse([CAROL, EMMA])),
      revoke: () => {
        revoked = true;
        return new Response(null, { status: 204 });
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await revokeCarol(screen);

    await expect
      .element(confirmationOf(screen, "Carol White"))
      .not.toBeInTheDocument();
    expect(dialogStatus(screen)).toBe("");
    reread.resolve(errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION"));

    await expect
      .poll(() => dialogStatus(screen))
      .toContain("Access of Carol White revoked.");
  });
});

test("show Revoke access below its user where the dialog is narrow, at 320 CSS pixels", async () => {
  await page.viewport(320, 800);
  stubTicket({
    user: MANAGER,
    ticket: () => confidentialTicket(),
    grants: () => grantsResponse(),
  });
  const { screen } = await renderParticipants();
  await openAccessGrants(screen);

  const name = accessGrantsDialog(screen)
    .getByText("Carol White", { exact: false })
    .first();
  const revoke = boxOf(revokeOf(screen, "Carol White @cwhite"));
  expect(revoke.top).toBeGreaterThanOrEqual(boxOf(name).bottom);
  expect(name.element().scrollWidth).toBeLessThanOrEqual(
    name.element().clientWidth,
  );
});
