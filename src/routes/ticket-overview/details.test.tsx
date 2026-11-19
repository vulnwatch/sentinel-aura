import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import "../../styles.css";
import type { TicketSummary } from "../../api/generated/model";
import { formatDateTime } from "../../components/date-time";
import {
  errorResponse,
  fictionalTicket,
  fictionalTicketDetail,
  ticketPage,
} from "../../test-api";
import {
  boxOf,
  colorOf,
  CVSS,
  DAY,
  HOUR,
  later,
  prepareEachTest,
  region,
  renderTicket,
  requestsOf,
  showingTicket,
  showingUnlistedTicket,
  SOURCES,
  stubTicket,
  textsOf,
  TICKETS,
  valueOf,
} from "./test-support";

// The details of Overview, the first tab of the Ticket screen
// (src/routes/ticket-overview/details.tsx; docs/screens/ticket.md), with the
// deadlines and the duplicates, at the browser's default text size, in the
// light theme.

prepareEachTest();

// A date and time of the API that lies the duration from now.
function fromNow(duration: number): string {
  return new Date(Date.now() + duration).toISOString();
}

describe("the details", () => {
  test("are a part of the side column with a level-two heading", async () => {
    showingTicket(fictionalTicketDetail());
    const { screen } = await renderTicket();

    await expect
      .element(
        region(screen, "Details").getByRole("heading", {
          level: 2,
          name: "Details",
        }),
      )
      .toBeVisible();
  });

  test("show the assignee in the full form", async () => {
    showingTicket(fictionalTicketDetail());
    const { screen } = await renderTicket();

    expect(valueOf(screen, "Assignee").textContent).toBe("Alice Smith");
    expect(valueOf(screen, "Assignee").querySelector("svg")).not.toBeNull();
  });

  test("cut a name of the assignee longer than its place with an ellipsis, on one line, its labels showing and its text whole", async () => {
    showingTicket(
      fictionalTicketDetail({
        assignee: {
          id: "00000000-0000-0000-0000-000000000004",
          username: "apapadopoulou",
          full_name: "Alexandra Konstantina Papadopoulou-Fictional",
          active: false,
          bot: false,
          avatar_url: null,
        },
      }),
    );
    const { screen } = await renderTicket();

    const name = screen.getByText(
      "Alexandra Konstantina Papadopoulou-Fictional",
    );
    await expect.element(name).toBeVisible();
    expect(name.element().scrollWidth).toBeGreaterThan(
      name.element().clientWidth,
    );
    expect(boxOf(name).height).toBe(20);
    const label = region(screen, "Details").getByText("Inactive", {
      exact: true,
    });
    await expect.element(label).toBeVisible();
    expect(boxOf(label).right).toBeLessThanOrEqual(
      boxOf(region(screen, "Details")).right,
    );
    expect(valueOf(screen, "Assignee").textContent).toBe(
      "Alexandra Konstantina Papadopoulou-FictionalInactive",
    );
  });

  test("show Unassigned for a Ticket without an assignee", async () => {
    showingTicket(fictionalTicketDetail({ assignee: null }));
    const { screen } = await renderTicket();

    expect(valueOf(screen, "Assignee").textContent).toBe("Unassigned");
  });

  test("show the fields in their order, the term on the line of its value", async () => {
    showingTicket(fictionalTicketDetail());
    const { screen } = await renderTicket();

    expect(textsOf(region(screen, "Details").getByRole("term"))).toEqual([
      "Assignee",
      "Deadlines",
      "Triage",
      "Submission",
      "UM",
      "QA, release",
      "Duplicates",
      "Created",
      "Last modified",
    ]);
    const term = region(screen, "Details").getByText("Created", {
      exact: true,
    });
    const value = valueOf(screen, "Created");
    expect(value.textContent).toBe(formatDateTime("2099-10-09T14:05:09Z"));
    expect(valueOf(screen, "Last modified").textContent).toBe(
      formatDateTime("2099-10-10T09:30:00Z"),
    );
    // 104 px of term, then 12 px.
    expect(value.getBoundingClientRect().left - boxOf(term).left).toBe(116);
  });

  test.each([
    [
      "while a Ticket is confidential, as an absent value without a date",
      { is_confidential: true },
      "–Not set",
    ],
    [
      "while a Ticket has one, also after it became non-confidential",
      { coordinated_release_at: "2099-11-01T12:00:00Z" },
      formatDateTime("2099-11-01T12:00:00Z"),
    ],
  ])("show the Coordinated Release Date %s", async (_, fields, text) => {
    showingTicket(fictionalTicketDetail(fields));
    const { screen } = await renderTicket();

    expect(valueOf(screen, "Coordinated Release Date").textContent).toBe(text);
  });

  test("show no Coordinated Release Date for a non-confidential Ticket without one", async () => {
    showingTicket(fictionalTicketDetail());
    const { screen } = await renderTicket();

    expect(
      region(screen, "Details")
        .getByText("Coordinated Release Date")
        .elements(),
    ).toHaveLength(0);
  });

  describe("the deadlines", () => {
    test("show the date of each phase, the earlier ones in fg-muted, the current one at weight 600 with its state, and the later ones plain", async () => {
      const ticket = fictionalTicketDetail({
        submission_due_at: fromNow(3 * DAY + HOUR),
      });
      showingTicket(ticket);
      const { screen } = await renderTicket();

      const muted = colorOf(
        region(screen, "Details").getByText("Deadlines").element(),
      );
      const triage = valueOf(screen, "Triage");
      const submission = valueOf(screen, "Submission");
      const um = valueOf(screen, "UM");
      expect(triage.textContent).toBe(
        formatDateTime(ticket.triage_due_at ?? ""),
      );
      expect(colorOf(triage)).toBe(muted);
      expect(submission.textContent).toBe(
        `${formatDateTime(ticket.submission_due_at ?? "")}Due in 3 days`,
      );
      expect(getComputedStyle(submission).fontWeight).toBe("600");
      expect(colorOf(um)).not.toBe(muted);
      expect(getComputedStyle(um).fontWeight).toBe("400");
    });

    test("mark an overdue current phase with the icon, in words", async () => {
      showingTicket(
        fictionalTicketDetail({
          submission_due_at: fromNow(-2 * DAY + HOUR),
          current_phase_milestone: "overdue",
        }),
      );
      const { screen } = await renderTicket();

      const submission = valueOf(screen, "Submission");
      expect(submission.textContent).toMatch(/Overdue by 2 days$/);
      expect(submission.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    });

    test("show every phase in fg-muted once the current phase is done", async () => {
      showingTicket(
        fictionalTicketDetail({
          current_phase: "done",
          current_phase_milestone: null,
        }),
      );
      const { screen } = await renderTicket();

      const muted = colorOf(
        region(screen, "Details").getByText("Deadlines").element(),
      );
      for (const phase of ["Triage", "Submission", "UM", "QA, release"]) {
        expect(colorOf(valueOf(screen, phase))).toBe(muted);
      }
    });

    test("show Triage in fg-muted and the other phases plain, without a state, when the current phase is null with due dates", async () => {
      showingTicket(
        fictionalTicketDetail({
          cve: null,
          current_phase: null,
          current_phase_milestone: null,
        }),
      );
      const { screen } = await renderTicket();

      const muted = colorOf(
        region(screen, "Details").getByText("Deadlines").element(),
      );
      expect(colorOf(valueOf(screen, "Triage"))).toBe(muted);
      expect(colorOf(valueOf(screen, "Submission"))).not.toBe(muted);
      expect(valueOf(screen, "Submission").textContent).toBe(
        formatDateTime("2099-10-27T14:05:09Z"),
      );
    });

    test("give the final release deadline a line of its own when it differs from the QA due date", async () => {
      showingTicket(
        fictionalTicketDetail({ release_due_at: "2099-11-09T14:05:09Z" }),
      );
      const { screen } = await renderTicket();

      expect(valueOf(screen, "QA").textContent).toBe(
        formatDateTime("2099-11-08T14:05:09Z"),
      );
      expect(valueOf(screen, "Release").textContent).toBe(
        formatDateTime("2099-11-09T14:05:09Z"),
      );
    });

    test("show an absent value without due dates", async () => {
      showingTicket(
        fictionalTicketDetail({
          triage_due_at: null,
          submission_due_at: null,
          um_due_at: null,
          qa_due_at: null,
          release_due_at: null,
          current_phase: null,
          current_phase_milestone: null,
        }),
      );
      const { screen } = await renderTicket();

      expect(valueOf(screen, "Deadlines").textContent).toBe("–Not set");
    });

    test("mark no phase for a current phase that the pinned contract does not list", async () => {
      showingUnlistedTicket({
        ...fictionalTicketDetail(),
        current_phase: "fictional_phase",
      });
      const { screen } = await renderTicket();

      for (const phase of ["Triage", "Submission", "UM", "QA, release"]) {
        expect(getComputedStyle(valueOf(screen, phase)).fontWeight).toBe("400");
      }
    });

    test("show a state of the current phase that the pinned contract does not list as received", async () => {
      showingUnlistedTicket({
        ...fictionalTicketDetail(),
        current_phase_milestone: "fictional_milestone",
      });
      const { screen } = await renderTicket();

      expect(valueOf(screen, "Submission").textContent).toBe(
        `${formatDateTime("2099-10-27T14:05:09Z")}fictional_milestone`,
      );
    });
  });

  describe("the duplicates", () => {
    test("link to the original of a duplicate, without reading duplicates", async () => {
      const spy = showingTicket(
        fictionalTicketDetail({
          status: "duplicated",
          duplicate_of_ticket_id: "SNTL-21",
        }),
      );
      const { screen } = await renderTicket();

      const link = screen.getByRole("link", { name: "SNTL-21" });
      await expect.element(link).toHaveAttribute("href", "/tickets/SNTL-21");
      expect(valueOf(screen, "Original").contains(link.element())).toBe(true);
      expect(requestsOf(spy)).toEqual([
        `${TICKETS}/SNTL-12`,
        CVSS,
        SOURCES,
        `${TICKETS}/SNTL-12/actors`,
      ]);
    });

    test("link to each duplicate, with the lock of a confidential one", async () => {
      const duplicates: TicketSummary[] = [
        fictionalTicket({ ticket_id: "SNTL-22", status: "duplicated" }),
        fictionalTicket({
          ticket_id: "SNTL-30",
          status: "duplicated",
          is_confidential: true,
        }),
      ];
      stubTicket({ duplicates: () => ticketPage(duplicates) });
      const { screen } = await renderTicket();

      await expect
        .element(screen.getByRole("link", { name: "SNTL-30" }))
        .toHaveAttribute("href", "/tickets/SNTL-30");
      const value = page.elementLocator(valueOf(screen, "Duplicates"));
      expect(textsOf(value.getByRole("link"))).toEqual(["SNTL-22", "SNTL-30"]);
      expect(
        screen.getByRole("img", { name: "Confidential" }).elements(),
      ).toHaveLength(1);
    });

    test("say how many more there are beyond a page", async () => {
      const duplicates = Array.from({ length: 100 }, (_, index) =>
        fictionalTicket({ ticket_id: `SNTL-${index + 100}` }),
      );
      stubTicket({
        duplicates: () => ticketPage(duplicates, { total: 1250, perPage: 100 }),
      });
      const { screen } = await renderTicket();

      // Their thousands grouped (docs/behaviors.md, Style).
      await expect.element(screen.getByText("and 1,150 more")).toBeVisible();
    });

    test("show None without any", async () => {
      stubTicket();
      const { screen } = await renderTicket();

      await expect
        .poll(() => valueOf(screen, "Duplicates").textContent)
        .toBe("None");
    });

    test("show the loading indicator of their read in place of their value, without the space of a part", async () => {
      const duplicates = later();
      stubTicket({ duplicates: () => duplicates.promise });
      const { screen } = await renderTicket();

      const indicator = region(screen, "Details").getByRole("progressbar", {
        name: "Loading",
      });
      await expect.element(indicator).toBeVisible();
      expect(valueOf(screen, "Duplicates").contains(indicator.element())).toBe(
        true,
      );
      expect(getComputedStyle(indicator.element()).paddingTop).toBe("0px");
    });

    test("show the failure of their read in place of their value, with Try again", async () => {
      let fail = true;
      stubTicket({
        duplicates: () =>
          fail ? errorResponse(503, "SERVICE_UNAVAILABLE") : ticketPage([]),
      });
      const { screen } = await renderTicket();

      const message = screen.getByText(
        "Sentinel isn't available right now. Try again later.",
      );
      await expect.element(message).toBeVisible();
      expect(valueOf(screen, "Duplicates").contains(message.element())).toBe(
        true,
      );
      expect(
        screen.getByText("CVE-2099-0012").elements().length,
      ).toBeGreaterThan(0);
      fail = false;

      await screen.getByRole("button", { name: "Try again" }).click();

      await expect
        .poll(() => valueOf(screen, "Duplicates").textContent)
        .toBe("None");
    });
  });
});
