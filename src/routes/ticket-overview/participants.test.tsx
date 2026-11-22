import { describe, expect, test } from "vitest";
import "../../styles.css";
import { participantsOf } from "./participants";
import {
  actorsResponse,
  errorResponse,
  FICTIONAL_ACTORS,
  fictionalGrant,
  grantsResponse,
  fictionalPackage,
  fictionalTicketDetail,
  requestsTo,
  ticketResponse,
} from "../../test-api";
import {
  ACCESS,
  accessGrantsButton,
  accessGrantsDialog,
  CAROL,
  confidentialTicket,
  declassifiedTicket,
  grantLines,
  later,
  participantNames,
  participantsGroup,
  participantsPart,
  prepareEachTest,
  press,
  renderApp,
  renderParticipants,
  returnToForeground,
  sourcesPart,
  stubTicket,
  TICKET,
} from "./test-support";

// The participants of Overview, the first tab of the Ticket screen
// (src/routes/ticket-overview/participants.tsx; docs/screens/ticket.md), at
// the browser's default text size, in the light theme.

prepareEachTest();

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
