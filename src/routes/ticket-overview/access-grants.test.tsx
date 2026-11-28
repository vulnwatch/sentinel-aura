import { MutationObserver as ChangeObserver } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../../styles.css";
import type { CurrentUserResponse } from "../../api/generated/model";
import { formatDateTime } from "../../components/date-time";
import { getRevokeTicketAccessMutationKey } from "../../api/generated/tickets";
import {
  errorResponse,
  FICTIONAL_ACTORS,
  FICTIONAL_USER,
  fictionalDirectoryUser,
  fictionalGrant,
  grantResponse,
  grantsResponse,
  usersPage,
  validationError,
  OTHER_USER,
  requestsTo,
} from "../../test-api";
import {
  ACCESS,
  accessGrantsButton,
  accessGrantsDialog,
  ACTORS,
  announcements,
  areaMessage,
  backgroundBehind,
  boxOf,
  CAROL,
  client,
  confidentialTicket,
  declassifiedTicket,
  EMMA,
  expectGoesOnItsOwn,
  fakeMessageClock,
  grantLines,
  later,
  layoutWidth,
  leaveForTickets,
  mainContent,
  ME,
  MESSAGE_CONFLICT,
  MESSAGE_TONES,
  nextFrames,
  ON_FAKE_CLOCK,
  participantNames,
  prepareEachTest,
  readsOf,
  renderParticipants,
  requestsWith,
  returnToForeground,
  type Screen,
  stubTicket,
  TICKET,
} from "./test-support";

// The access grants of Overview, the first tab of the Ticket screen
// (src/routes/ticket-overview/access-grants.tsx; docs/screens/ticket.md), at
// the browser's default text size, in the light theme.

prepareEachTest();

// An analyst who manages confidentiality, who grants and revokes access.
const MANAGER: CurrentUserResponse = {
  data: {
    ...OTHER_USER.data,
    capabilities: ["triage_ticket", "manage_confidentiality"],
  },
};

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

// The room of the scrollbar that a page with the message area keeps also
// while it does not scroll (layoutWidth), as an element keeps it with the
// same rule (src/styles.css): that of a classic scrollbar in Chromium, also
// where the tests hide its scrollbars, or none where the scrollbars overlay
// the page, as Firefox's do.
function scrollbarRoom(): number {
  const probe = document.createElement("div");
  probe.style.setProperty("overflow", "hidden");
  probe.style.setProperty("scrollbar-gutter", "stable");
  document.body.append(probe);
  const room = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return room;
}

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
      .poll(() => announcements())
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

  test("announce Choose a user. after Enter in the user field in a status region of the dialog, while the field keeps the focus", async () => {
    const spy = stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    await expect.element(userField(screen)).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    await expect
      .element(userField(screen))
      .toHaveAccessibleDescription("Choose a user.");
    await expect.poll(() => dialogStatus(screen)).toBe("Choose a user.");
    await expect.element(userField(screen)).toHaveFocus();
    expect(requestsWith(spy, "POST")).toHaveLength(0);
  });

  test("do not announce Choose a user. as well when the user field takes the focus from Grant access", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await grantButton(screen).click();

    await expect
      .element(userField(screen))
      .toHaveAccessibleDescription("Choose a user.");
    await expect.element(userField(screen)).toHaveFocus();
    await nextFrames();
    expect(dialogStatus(screen)).toBe("");
  });

  test("keep Choose a user. after Enter in the user field once the field loses the focus, until the input changes", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () => usersPage([fictionalDirectoryUser()]),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    await expect.element(userField(screen)).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect
      .element(userField(screen))
      .toHaveAccessibleDescription("Choose a user.");
    await expect.element(userField(screen)).toHaveFocus();

    await userEvent.keyboard("{Tab}");

    await expect.element(grantButton(screen)).toHaveFocus();
    await nextFrames();
    expect(userField(screen).element()).toBeInvalid();
    expect(userField(screen).element()).toHaveAccessibleDescription(
      "Choose a user.",
    );
    await userField(screen).fill("an");
    await expect.element(userField(screen)).not.toBeInvalid();
    await expect.element(userField(screen)).toHaveAccessibleDescription("");
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

  test("announce the error of 404 USER_NOT_FOUND after Enter in the user field in a status region of the dialog, while the field keeps the focus", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () => usersPage([fictionalDirectoryUser()]),
      grant: () => errorResponse(404, "USER_NOT_FOUND"),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");
    await expect.element(userField(screen)).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    await expect
      .element(userField(screen))
      .toHaveAccessibleDescription("Sentinel doesn't know this user.");
    await expect
      .poll(() => dialogStatus(screen))
      .toBe("Sentinel doesn't know this user.");
    await expect.element(userField(screen)).toHaveFocus();
    await expect.element(userField(screen)).toHaveValue("Ana Garcia @agarcia");
  });

  test("keep the error of 404 USER_NOT_FOUND after Enter in the user field once the field loses the focus, until the input changes", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () => usersPage([fictionalDirectoryUser()]),
      grant: () => errorResponse(404, "USER_NOT_FOUND"),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");
    await expect.element(userField(screen)).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect
      .element(userField(screen))
      .toHaveAccessibleDescription("Sentinel doesn't know this user.");
    await expect.element(userField(screen)).toHaveFocus();

    await userEvent.keyboard("{Tab}");

    await expect.element(grantButton(screen)).toHaveFocus();
    await nextFrames();
    expect(userField(screen).element()).toBeInvalid();
    expect(userField(screen).element()).toHaveAccessibleDescription(
      "Sentinel doesn't know this user.",
    );
    expect(userField(screen).element()).toHaveValue("Ana Garcia @agarcia");
    await userField(screen).fill("an");
    await expect.element(userField(screen)).not.toBeInvalid();
    await expect.element(userField(screen)).toHaveAccessibleDescription("");
  });

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
      .element(
        mainContent(screen).getByText(
          "SNTL-12: Access of Carol White revoked.",
        ),
      )
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
      const message = mainContent(screen).getByText(text);
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
    await expect
      .poll(() => announcements())
      .toBe("Access of Carol White revoked.");
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

  test.each([
    [
      "Grant access",
      "Access granted to Ana Garcia.",
      async (screen: Screen) => {
        await chooseUser(screen, "ana", "Ana Garcia @agarcia");
        await grantButton(screen).click();
        await expect.element(userField(screen)).toHaveValue("");
      },
    ],
    [
      "Revoke access",
      "Access of Carol White revoked.",
      async (screen: Screen) => {
        await revokeCarol(screen);
        await expect
          .element(confirmationOf(screen, "Carol White"))
          .not.toBeInTheDocument();
      },
    ],
  ])(
    "announce %s once the read of the grants after it arrives, not before",
    async (_, text, change) => {
      const reread = later();
      let changed = false;
      stubTicket({
        user: MANAGER,
        ticket: () => confidentialTicket(),
        grants: () =>
          changed ? reread.promise : grantsResponse([CAROL, EMMA]),
        users: () => usersPage([fictionalDirectoryUser()]),
        grant: () => {
          changed = true;
          return grantResponse(fictionalGrant({ user: FICTIONAL_ACTORS[0]! }));
        },
        revoke: () => {
          changed = true;
          return new Response(null, { status: 204 });
        },
      });
      const { screen } = await renderParticipants();
      await openAccessGrants(screen);

      await change(screen);

      await nextFrames();
      expect(announcements()).toBe("");
      expect(dialogStatus(screen)).toBe("");
      reread.resolve(grantsResponse([CAROL, EMMA]));

      await expect.poll(() => announcements()).toBe(text);
      // Announced, without a message at the top of the dialog.
      expect(
        accessGrantsDialog(screen).getByText(text, { exact: true }).elements(),
      ).toHaveLength(0);
    },
  );

  test.each([
    [
      "Grant access",
      "Access granted to Ana Garcia.",
      async (screen: Screen) => {
        await chooseUser(screen, "ana", "Ana Garcia @agarcia");
        await grantButton(screen).click();
        await expect.element(userField(screen)).toHaveValue("");
      },
    ],
    [
      "Revoke access",
      "Access of Carol White revoked.",
      async (screen: Screen) => {
        await revokeCarol(screen);
        await expect
          .element(confirmationOf(screen, "Carol White"))
          .not.toBeInTheDocument();
      },
    ],
  ])(
    "show %s at the top of the dialog, as a success message, once the read of the grants after it fails, until the dialog closes",
    async (_, text, change) => {
      const reread = later();
      let changed = false;
      stubTicket({
        user: MANAGER,
        ticket: () => confidentialTicket(),
        grants: () =>
          changed ? reread.promise : grantsResponse([CAROL, EMMA]),
        users: () => usersPage([fictionalDirectoryUser()]),
        grant: () => {
          changed = true;
          return grantResponse(fictionalGrant({ user: FICTIONAL_ACTORS[0]! }));
        },
        revoke: () => {
          changed = true;
          return new Response(null, { status: 204 });
        },
      });
      const { screen } = await renderParticipants();
      await openAccessGrants(screen);
      const message = accessGrantsDialog(screen).getByText(text, {
        exact: true,
      });

      await change(screen);

      await nextFrames();
      expect(message.query()).toBeNull();
      reread.resolve(errorResponse(503, "DATABASE_UNAVAILABLE"));

      // The one element with the text, the message, which its status region
      // announces, before the explanation of the dialog.
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
      const explanation = accessGrantsDialog(screen).getByText(
        /^An access grant lets a user see/,
      );
      expect(
        message.element().compareDocumentPosition(explanation.element()) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(message.element().closest("output")?.textContent).toBe(text);
      // It stays until the dialog closes, and the next opening shows none.
      await accessGrantsDialog(screen)
        .getByRole("button", { name: "Close" })
        .click();
      await expect.element(accessGrantsDialog(screen)).not.toBeInTheDocument();
      await accessGrantsButton(screen).click();
      await expect.element(accessGrantsDialog(screen)).toBeVisible();
      expect(message.query()).toBeNull();
    },
  );

  test("show together at the top of the dialog the outcomes that one failed read releases, in place of those of an earlier failed read", async () => {
    let reread = later();
    let changes = 0;
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () =>
        changes > 0 ? reread.promise : grantsResponse([CAROL, EMMA]),
      users: () => usersPage([fictionalDirectoryUser()]),
      grant: () => {
        changes += 1;
        return grantResponse(fictionalGrant({ user: FICTIONAL_ACTORS[0]! }));
      },
      revoke: () => {
        changes += 1;
        return new Response(null, { status: 204 });
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    const dialog = accessGrantsDialog(screen);

    // Two revocations before the read after the first one has ended.
    await revokeCarol(screen);
    await expect
      .element(confirmationOf(screen, "Carol White"))
      .not.toBeInTheDocument();
    await revokeOf(screen, "Emma Green @egreen").click();
    await confirmationOf(screen, "Emma Green")
      .getByRole("button", { name: "Revoke access", exact: true })
      .click();
    await expect
      .element(confirmationOf(screen, "Emma Green"))
      .not.toBeInTheDocument();
    await expect.poll(() => changes).toBe(2);
    reread.resolve(errorResponse(503, "DATABASE_UNAVAILABLE"));

    const both = dialog.getByText(
      "Access of Carol White revoked. Access of Emma Green revoked.",
      { exact: true },
    );
    await expect.element(both).toBeVisible();
    expect(backgroundBehind(both.element())).toBe(MESSAGE_TONES.success);

    // A later grant whose read fails too takes their place.
    reread = later();
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");
    await grantButton(screen).click();
    await expect.element(userField(screen)).toHaveValue("");
    reread.resolve(errorResponse(503, "DATABASE_UNAVAILABLE"));

    await expect
      .element(
        dialog.getByText("Access granted to Ana Garcia.", { exact: true }),
      )
      .toBeVisible();
    expect(both.query()).toBeNull();
  });

  test.each([
    [
      "Grant access",
      "Access granted to Ana Garcia.",
      async (screen: Screen) => {
        await chooseUser(screen, "ana", "Ana Garcia @agarcia");
        await grantButton(screen).click();
        await expect.element(userField(screen)).toHaveValue("");
      },
    ],
    [
      "Revoke access",
      "Access of Carol White revoked.",
      async (screen: Screen) => {
        await revokeCarol(screen);
        await expect
          .element(confirmationOf(screen, "Carol White"))
          .not.toBeInTheDocument();
      },
    ],
  ])(
    "show %s in the message area, as a success, when the dialog closed before the read of the grants after it arrives",
    async (_, text, change) => {
      const reread = later();
      let changed = false;
      stubTicket({
        user: MANAGER,
        ticket: () => confidentialTicket(),
        grants: () =>
          changed ? reread.promise : grantsResponse([CAROL, EMMA]),
        users: () => usersPage([fictionalDirectoryUser()]),
        grant: () => {
          changed = true;
          return grantResponse(fictionalGrant({ user: FICTIONAL_ACTORS[0]! }));
        },
        revoke: () => {
          changed = true;
          return new Response(null, { status: 204 });
        },
      });
      const { screen } = await renderParticipants();
      await openAccessGrants(screen);
      await change(screen);

      await accessGrantsDialog(screen)
        .getByRole("button", { name: "Close" })
        .click();
      await expect.element(accessGrantsDialog(screen)).not.toBeInTheDocument();
      const message = mainContent(screen).getByText(text, { exact: true });
      await nextFrames();
      expect(screen.getByText(text, { exact: true }).query()).toBeNull();
      reread.resolve(grantsResponse([EMMA]));

      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
      expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
    },
  );

  test("show Revoke access in the message area, as a success, when the dialog closed before the read of the grants after it fails", async () => {
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

    await accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .click();
    await expect.element(accessGrantsDialog(screen)).not.toBeInTheDocument();
    reread.resolve(errorResponse(503, "DATABASE_UNAVAILABLE"));

    const message = mainContent(screen).getByText(
      "Access of Carol White revoked.",
      { exact: true },
    );
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
    expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
  });

  test("let Revoke access, shown in the message area as the dialog closed before the read of the grants after it arrives, go on its own 10 seconds after it appears", async () => {
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
    await accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .click();
    await expect.element(accessGrantsDialog(screen)).not.toBeInTheDocument();
    await fakeMessageClock(screen);

    reread.resolve(grantsResponse([EMMA]));

    const message = areaMessage(screen, "Access of Carol White revoked.");
    await expect.element(message, ON_FAKE_CLOCK).toBeVisible();
    await expectGoesOnItsOwn(message);
  });
});

test("show Grant access at the end of the line of the user field, 8 px after its control and aligned with it, also with an error, ending where Close does, with the options of the field below the control, from its start", async () => {
  stubTicket({
    user: MANAGER,
    ticket: () => confidentialTicket(),
    grants: () => grantsResponse(),
    users: () => usersPage([fictionalDirectoryUser()]),
  });
  const { screen } = await renderParticipants();
  await openAccessGrants(screen);
  const dialog = accessGrantsDialog(screen);
  const close = dialog.getByRole("button", { name: "Close", exact: true });

  // To within the rounding of a browser.
  const expectInLine = () => {
    const field = boxOf(userField(screen));
    const grant = boxOf(grantButton(screen));
    expect([field.height, grant.height]).toEqual([40, 40]);
    expect(grant.top).toBeCloseTo(field.top, 0);
    expect(grant.left - field.right).toBeCloseTo(8, 0);
    expect(grant.right).toBeCloseTo(boxOf(close).right, 0);
  };
  expectInLine();
  const explanation = boxOf(
    dialog.getByText("An access grant lets a user see", { exact: false }),
  );
  expect(boxOf(userField(screen)).left).toBeCloseTo(explanation.left, 0);

  await grantButton(screen).click();

  // The error below the control leaves Grant access in line with it.
  await expect.element(dialog.getByText("Choose a user.")).toBeVisible();
  expectInLine();

  await userField(screen).fill("an");

  await expect
    .element(screen.getByRole("option", { name: "Ana Garcia @agarcia" }))
    .toBeVisible();
  const options = boxOf(screen.getByRole("listbox"));
  const field = boxOf(userField(screen));
  expect(options.top).toBeGreaterThan(field.bottom);
  // The list starts within the 1 px line and the 4 px of padding of its
  // menu, which starts with the control, to within the rounding of a
  // browser.
  expect(options.left - field.left).toBeCloseTo(5, 0);
});

test("show Grant access at the end of the line of the user field, 8 px after its control, where the dialog is just wide enough for the line, at 464 CSS pixels", async () => {
  // The form is then 390 px wide: wider than the 384 px from which the line
  // shows, narrower than the field at its own width with Grant access. The
  // window is wider by the room of its scrollbar (scrollbarRoom).
  await page.viewport(464 + scrollbarRoom(), 800);
  stubTicket({
    user: MANAGER,
    ticket: () => confidentialTicket(),
    grants: () => grantsResponse(),
  });
  const { screen } = await renderParticipants();
  expect(layoutWidth()).toBe(464);
  await openAccessGrants(screen);

  // The field narrows for Grant access, to within the rounding of a browser.
  const field = boxOf(userField(screen));
  const grant = boxOf(grantButton(screen));
  const close = accessGrantsDialog(screen).getByRole("button", {
    name: "Close",
    exact: true,
  });
  expect(grant.top).toBeCloseTo(field.top, 0);
  expect(grant.left - field.right).toBeCloseTo(8, 0);
  expect(grant.right).toBeCloseTo(boxOf(close).right, 0);
});

test("show Grant access below the user field, at the end of the form, where the form is just narrower than 384 px, at 456 CSS pixels", async () => {
  // The form is then 382 px wide. The window is wider by the room of its
  // scrollbar (scrollbarRoom).
  await page.viewport(456 + scrollbarRoom(), 800);
  stubTicket({
    user: MANAGER,
    ticket: () => confidentialTicket(),
    grants: () => grantsResponse(),
  });
  const { screen } = await renderParticipants();
  expect(layoutWidth()).toBe(456);
  await openAccessGrants(screen);

  const field = boxOf(userField(screen));
  const grant = boxOf(grantButton(screen));
  // 12 px below the field, to within the rounding of a browser.
  expect(grant.top).toBeCloseTo(field.bottom + 12, 0);
  expect(grant.right).toBeCloseTo(field.right, 0);
});

test("show Grant access below the user field, at the end of the form, where the dialog is narrow, at 320 CSS pixels", async () => {
  await page.viewport(320, 800);
  stubTicket({
    user: MANAGER,
    ticket: () => confidentialTicket(),
    grants: () => grantsResponse(),
  });
  const { screen } = await renderParticipants();
  await openAccessGrants(screen);

  const field = boxOf(userField(screen));
  const grant = boxOf(grantButton(screen));
  // 12 px below the field, to within the rounding of a browser.
  expect(grant.top).toBeCloseTo(field.bottom + 12, 0);
  expect(grant.right).toBeCloseTo(field.right, 0);
  expect(grant.left).toBeGreaterThan(field.left);
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
