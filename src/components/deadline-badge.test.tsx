import type { ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot } from "../test-screenshot";
import { deadline, DeadlineBadge, type DeadlineTicket } from "./deadline-badge";

// The deadline badge of a Ticket (docs/behaviors.md, Deadlines;
// docs/design-system.md, Deadline Badge), in the light theme.

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

const DAY = 24 * 60 * 60 * 1000;

// A fictional Ticket of the SLA of 30 days, with the due dates that Sentinel
// gives its phases (Sentinel docs/features/tickets/ticket-deadlines.md, Due
// Dates), in microseconds, as Sentinel writes them. The instants of the
// tests are the same dates, in milliseconds.
const CREATED = Date.UTC(2026, 9, 5, 9, 30, 0, 123);
const TRIAGE_DUE = CREATED + 3 * DAY;
const SUBMISSION_DUE = CREATED + 18 * DAY;
const UM_DUE = CREATED + 21 * DAY;
const QA_DUE = CREATED + 30 * DAY;

const TICKET: DeadlineTicket = {
  current_phase: "triage",
  created_at: "2026-10-05T09:30:00.123456Z",
  triage_due_at: "2026-10-08T09:30:00.123456Z",
  submission_due_at: "2026-10-23T09:30:00.123456Z",
  um_due_at: "2026-10-26T09:30:00.123456Z",
  qa_due_at: "2026-11-04T09:30:00.123456Z",
  release_due_at: "2026-11-04T09:30:00.123456Z",
};

// The Ticket whose current phase is phase.
function inPhase(phase: string | null): DeadlineTicket {
  return { ...TICKET, current_phase: phase };
}

describe("deadline", () => {
  test.each([
    ["triage", "Triage", TRIAGE_DUE],
    ["submission", "Submission", SUBMISSION_DUE],
    ["um", "UM", UM_DUE],
    ["qa", "QA", QA_DUE],
    [null, "Release", QA_DUE],
  ])(
    "for a current phase of %s is %s with the days to its date",
    (phase, name, due) => {
      expect(deadline(inPhase(phase), due - 3 * DAY)).toMatchObject({
        text: `${name} 3d`,
        description: `${name} due in 3 days`,
      });
    },
  );

  test.each([
    ["done", inPhase("done")],
    [
      "null without due dates",
      {
        ...inPhase(null),
        triage_due_at: null,
        submission_due_at: null,
        um_due_at: null,
        qa_due_at: null,
        release_due_at: null,
      },
    ],
    ["um without its due date", { ...inPhase("um"), um_due_at: null }],
    [
      "submission without the date that starts its window",
      { ...inPhase("submission"), triage_due_at: null },
    ],
  ])("is none for %s", (_, ticket) => {
    expect(deadline(ticket, TRIAGE_DUE - DAY)).toBeUndefined();
  });

  test.each(["release_review", "constructor"])(
    "for %s, which the pinned contract does not list, is the phase as received, in the neutral tone, without days",
    (phase) => {
      expect(deadline(inPhase(phase), TRIAGE_DUE - DAY)).toEqual({
        tone: "neutral",
        text: phase,
        description: phase,
      });
    },
  );

  // Counted from the triage due date.
  test.each([
    ["three days before", "Triage 3d", "Triage due in 3 days", -3 * DAY],
    ["a day before", "Triage 1d", "Triage due in 1 day", -DAY],
    [
      "less than a day before",
      "Triage 0d",
      "Triage due in less than a day",
      -DAY + 1,
    ],
    ["at the date", "Triage 0d", "Triage due in less than a day", 0],
    ["just after the date", "Triage -1d", "Triage overdue by 1 day", 1],
    ["a day after", "Triage -1d", "Triage overdue by 1 day", DAY],
    [
      "just after a day after",
      "Triage -2d",
      "Triage overdue by 2 days",
      DAY + 1,
    ],
    [
      "1,250 days before",
      "Triage 1,250d",
      "Triage due in 1,250 days",
      -1250 * DAY,
    ],
    [
      "1,250 days after",
      "Triage -1,250d",
      "Triage overdue by 1,250 days",
      1250 * DAY,
    ],
  ])("%s, shows %j, read as %j", (_, text, description, offset) => {
    expect(deadline(TICKET, TRIAGE_DUE + offset)).toMatchObject({
      text,
      description,
    });
  });

  // The window of each deadline, from the date that starts it to its due
  // date.
  test.each([
    ["triage", CREATED, TRIAGE_DUE],
    ["submission", TRIAGE_DUE, SUBMISSION_DUE],
    ["um", SUBMISSION_DUE, UM_DUE],
    ["qa", UM_DUE, QA_DUE],
    [null, CREATED, QA_DUE],
  ])(
    "for %s, is green while a third of its window remains, then yellow, then red once the date is past",
    (phase, start, due) => {
      const ticket = inPhase(phase);
      const third = (due - start) / 3;

      expect(deadline(ticket, start)?.tone).toBe("success");
      expect(deadline(ticket, due - third)?.tone).toBe("success");
      expect(deadline(ticket, due - third + 1)?.tone).toBe("warning");
      expect(deadline(ticket, due)?.tone).toBe("warning");
      expect(deadline(ticket, due + 1)?.tone).toBe("danger");
    },
  );
});

// The badge, which each test shows in a cell of a table, whose accessible
// name assistive technologies read, and in a figure, whose screenshot shows
// its colors.

async function renderBadge(node: ReactNode) {
  const screen = await render(
    <>
      <table>
        <tbody>
          <tr>
            <td>{node}</td>
          </tr>
        </tbody>
      </table>
      <figure aria-label="Fictional badge" className="inline-flex">
        {node}
      </figure>
    </>,
  );
  return { screen, figure: screen.getByRole("figure") };
}

const CANVAS = "#f6f8fa";

describe("badge", () => {
  test.each([
    [
      "green",
      "triage",
      TRIAGE_DUE - 2 * DAY,
      "Triage 2d",
      "Triage due in 2 days",
      "#dafbe1",
      "rgb(15, 83, 35)",
    ],
    [
      "yellow",
      "um",
      UM_DUE - 1,
      "UM 0d",
      "UM due in less than a day",
      "#fff8c5",
      "rgb(108, 68, 0)",
    ],
    [
      "red",
      "qa",
      QA_DUE + 2 * DAY,
      "QA -2d",
      "QA overdue by 2 days",
      "#ffebe9",
      "rgb(164, 14, 38)",
    ],
  ])(
    "is %s, showing %s",
    async (_, phase, now, text, description, background, color) => {
      const { screen, figure } = await renderBadge(
        <DeadlineBadge ticket={inPhase(phase)} now={now} />,
      );
      const shown = figure.getByText(text, { exact: true });
      const spoken = figure.getByText(description, { exact: true });
      const picture = await screenshot(figure);

      await expect.element(shown).toBeVisible();
      await expect
        .element(screen.getByRole("cell", { name: description, exact: true }))
        .toBeVisible();
      // The words take no room on the screen.
      expect(
        spoken.element().getBoundingClientRect().width,
      ).toBeLessThanOrEqual(1);
      expect(getComputedStyle(shown.element()).color).toBe(color);
      // In the side padding, on the left edge and halfway down.
      expect(picture.at(3, 12)).toBe(background);
      expect(picture.at(0.5, 12)).toBe(background);
    },
  );

  test("is 24 px high, with 8 px of side padding, in text-13 at weight 500 with tabular figures", async () => {
    const { figure } = await renderBadge(
      <DeadlineBadge ticket={TICKET} now={TRIAGE_DUE - 2 * DAY} />,
    );
    const shown = figure.getByText("Triage 2d", { exact: true }).element();
    const badge = figure.element().getBoundingClientRect();
    const text = shown.getBoundingClientRect();
    const style = getComputedStyle(shown);

    expect(badge.height).toBe(24);
    expect(text.left - badge.left).toBe(8);
    expect(badge.right - text.right).toBeCloseTo(8);
    expect(style.fontSize).toBe("13px");
    expect(style.fontWeight).toBe("500");
    expect(style.fontVariantNumeric).toBe("tabular-nums");
  });

  test("has corners rounded at 4 px", async () => {
    // At a text size of 48 px, the badge is three times larger: its corners
    // are rounded at 12 px.
    document.documentElement.style.fontSize = "48px";
    const { figure } = await renderBadge(
      <DeadlineBadge ticket={TICKET} now={TRIAGE_DUE - 2 * DAY} />,
    );
    const picture = await screenshot(figure);

    expect(picture.at(2.5, 2.5)).toBe(CANVAS);
    expect(picture.at(4.5, 4.5)).toBe("#dafbe1");
    expect(picture.at(2.5, picture.height / 2)).toBe("#dafbe1");
  });

  test("shows clock-alert of 12 px, 4 px before the text, once the date is past", async () => {
    const { figure } = await renderBadge(
      <DeadlineBadge ticket={inPhase("qa")} now={QA_DUE + 1} />,
    );
    const shown = figure.getByText("QA -1d", { exact: true }).element();
    const picture = await screenshot(figure);
    const badge = figure.element().getBoundingClientRect();
    // The pixels of the icon, between the side padding and the text, in the
    // color of the text: some of them, not all, which antialiasing blends.
    let icon = 0;
    for (let y = 6; y < 18; y++) {
      for (let x = 8; x < 20; x++) {
        if (picture.at(x + 0.5, y + 0.5) !== "#ffebe9") {
          icon++;
        }
      }
    }

    expect(shown.getBoundingClientRect().left - badge.left).toBe(24);
    expect(icon).toBeGreaterThan(20);
  });

  test("shows clock-alert, a clock open on the right onto an exclamation mark, in the color of its text", async () => {
    // At a text size of 48 px, the badge is three times larger: the icon is
    // 36 px, after 24 px of side padding, and centered on the height of the
    // badge, so that each point that the test reads lies well inside a line
    // or away from every line.
    document.documentElement.style.fontSize = "48px";
    const { figure } = await renderBadge(
      <DeadlineBadge ticket={inPhase("qa")} now={QA_DUE + 1} />,
    );
    const picture = await screenshot(figure);
    const top = (picture.height - 36) / 2;
    // In the 24 units of the icon: the circle on the left, the line of the
    // exclamation mark, and the opening of the circle on the right.
    const points: [x: number, y: number][] = [
      [2, 12],
      [20, 14.5],
      [22, 12],
    ];

    expect(
      points.map(([x, y]) => picture.at(24 + x * 1.5, top + y * 1.5)),
    ).toEqual(["#a40e26", "#a40e26", "#ffebe9"]);
  });

  test.each([
    ["green", TRIAGE_DUE - 2 * DAY, "Triage 2d"],
    ["yellow", TRIAGE_DUE - 1, "Triage 0d"],
  ])("shows no icon while it is %s", async (_, now, text) => {
    const { figure } = await renderBadge(
      <DeadlineBadge ticket={TICKET} now={now} />,
    );
    const shown = figure.getByText(text, { exact: true }).element();

    expect(
      shown.getBoundingClientRect().left -
        figure.element().getBoundingClientRect().left,
    ).toBe(8);
  });

  test("shows a phase that the pinned contract does not list as received, in the neutral tone, without an icon", async () => {
    const { screen, figure } = await renderBadge(
      <DeadlineBadge ticket={inPhase("release_review")} now={QA_DUE + 1} />,
    );
    const shown = figure.getByText("release_review", { exact: true });
    const picture = await screenshot(figure);

    await expect.element(shown).toBeVisible();
    await expect
      .element(
        screen.getByRole("cell", { name: "release_review", exact: true }),
      )
      .toBeVisible();
    expect(getComputedStyle(shown.element()).color).toBe("rgb(59, 67, 75)");
    expect(picture.at(3, 12)).toBe("#eff2f5");
    expect(
      shown.element().getBoundingClientRect().left -
        figure.element().getBoundingClientRect().left,
    ).toBe(8);
  });

  test.each([
    ["done", inPhase("done")],
    [
      "a current phase of null without due dates",
      {
        ...inPhase(null),
        triage_due_at: null,
        submission_due_at: null,
        um_due_at: null,
        qa_due_at: null,
        release_due_at: null,
      },
    ],
  ])("leaves its place empty for %s", async (_, ticket) => {
    const { screen, figure } = await renderBadge(
      <DeadlineBadge ticket={ticket} now={TRIAGE_DUE} />,
    );

    expect(screen.getByRole("cell").element().textContent).toBe("");
    expect(figure.element().getBoundingClientRect().width).toBe(0);
  });
});
