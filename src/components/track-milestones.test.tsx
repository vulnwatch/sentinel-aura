import { afterEach, beforeEach, expect, test } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot } from "../test-screenshot";
import { formatDateTime } from "./date-time";
import { DescriptionItem, DescriptionList } from "./description-list";
import {
  TrackDelivery,
  TrackMilestones,
  type MilestoneTrack,
  type PhaseExtras,
} from "./track-milestones";

// The milestones of a track (docs/design-system.md, Track Milestones), and
// its delivery, at a wide window, in the light theme.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  document.documentElement.style.removeProperty("font-size");
  await page.viewport(414, 896);
});

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
// The instant with which the tests compare the due dates.
const NOW = Date.parse("2099-10-20T12:00:00Z");

// The colors of docs/design-system.md (Color Tokens; Tones) in the light
// theme.
const FG_MUTED = "rgb(89, 99, 110)";
const BORDER_STRONG = "rgb(129, 139, 152)";
const DANGER_ON_SOFT = "rgb(164, 14, 38)";
const NEUTRAL_SOFT = "rgb(239, 242, 245)";
const CANVAS = "#f6f8fa";
const INFO_SOFT = "#ddf4ff";
const DANGER_SOFT = "#ffebe9";
const SUCCESS_ICON = "#1a7f37";
const DANGER_ICON = "#cf222e";
const NEUTRAL_ICON = "#6e7781";
const INFO_ICON = "#0969da";

// A date and time of the API that lies the duration from NOW.
function fromNow(duration: number): string {
  return new Date(NOW + duration).toISOString();
}

// A track whose triage is done, whose submission is overdue by 2 days and
// current, and whose later phases are pending, with the fields that a test
// sets.
function track(fields: Partial<MilestoneTrack> = {}): MilestoneTrack {
  return {
    triage_due_at: fromNow(-5 * DAY),
    submission_due_at: fromNow(-2 * DAY + HOUR),
    um_due_at: fromNow(3 * DAY + HOUR),
    qa_due_at: fromNow(10 * DAY + HOUR),
    milestones: {
      triage: "done",
      submission: "overdue",
      um: "pending",
      qa: "pending",
    },
    current_phase: "submission",
    ...fields,
  };
}

const SUBJECT = "fictional-openssl, SUSE:FLES-15-SP7:Update";

async function renderMilestones(
  milestones: MilestoneTrack,
  scale = 1,
  delivery?: string,
  extras?: PhaseExtras,
) {
  document.documentElement.style.fontSize = `${16 * scale}px`;
  const screen = await render(
    <div className="p-4">
      <TrackMilestones
        track={milestones}
        subject={SUBJECT}
        now={NOW}
        delivery={delivery}
        extras={extras}
      />
    </div>,
  );
  return {
    screen,
    pipeline: screen.getByRole("button", { name: /^Phases of / }),
  };
}

test("is one button whose name states the subject and the state of each phase, its icons hidden from assistive technologies", async () => {
  const { screen, pipeline } = await renderMilestones(track());

  await expect
    .element(pipeline)
    .toHaveAccessibleName(
      `Phases of ${SUBJECT}: Triage done; Submission overdue by 2 days, current; UM due in 3 days; QA due in 10 days`,
    );
  expect(screen.getByRole("img").query()).toBeNull();
});

test.each([
  ["not applicable", "not_applicable", "Submission not applicable"],
  ["not observed", null, "Submission not observed"],
  ["as received", "waived", "Submission waived"],
])("names a phase %s", async (_, status, words) => {
  const { pipeline } = await renderMilestones(
    track({
      milestones: {
        triage: "done",
        submission: status,
        um: "pending",
        qa: "pending",
      },
      current_phase: "um",
    }),
  );

  expect(pipeline.element().getAttribute("aria-label")).toContain(
    `; ${words}; UM due in 3 days, current;`,
  );
});

test("is 24 px high, its four boxes of 22 px joined by lines of 6 px, with 4 px of side padding", async () => {
  const { pipeline } = await renderMilestones(track());

  const box = pipeline.element().getBoundingClientRect();
  expect(box.height).toBe(24);
  expect(box.width).toBe(4 + 4 * 22 + 3 * 6 + 4);
  expect(getComputedStyle(pipeline.element()).borderRadius).toBe("4px");
});

// The colors of the pipeline, enlarged three times: the stroke at the left of
// the icon of each phase, and the background of its box above the icon.
async function phaseColors(milestones: MilestoneTrack) {
  const { pipeline } = await renderMilestones(milestones, 3);
  const picture = await screenshot(pipeline);
  const middle = picture.height / 2;
  return [0, 1, 2, 3].map((index) => {
    const left = (4 + index * (22 + 6)) * 3;
    const center = left + 11 * 3;
    return {
      // The circle of the icon, of radius 10 of its 24 units, its stroke 2:
      // 20 px from the center of a box of 66 px here.
      icon: picture.at(center - 20, middle),
      // Above the icon of 48 px, inside the round box.
      box: picture.at(center, middle - 30),
    };
  });
}

test("shows the icon of the status of each phase, and the current phase on the soft background of its tone", async () => {
  const overdue = await phaseColors(track());

  expect(overdue.map((phase) => phase.icon)).toEqual([
    SUCCESS_ICON,
    DANGER_ICON,
    NEUTRAL_ICON,
    NEUTRAL_ICON,
  ]);
  expect(overdue.map((phase) => phase.box)).toEqual([
    CANVAS,
    DANGER_SOFT,
    CANVAS,
    CANVAS,
  ]);
});

test("shows a pending current phase on info-soft, its circle in info-icon, and the icons of a phase not applicable and of a status as received", async () => {
  const colors = await phaseColors(
    track({
      milestones: {
        triage: "done",
        submission: "pending",
        um: "not_applicable",
        qa: "waived",
      },
    }),
  );

  expect(colors.map((phase) => phase.icon)).toEqual([
    SUCCESS_ICON,
    INFO_ICON,
    NEUTRAL_ICON,
    NEUTRAL_ICON,
  ]);
  expect(colors[1]?.box).toBe(INFO_SOFT);
});

test("is on neutral-soft under the pointer and while Phases is open", async () => {
  const { screen, pipeline } = await renderMilestones(track());

  await pipeline.hover();
  await expect
    .poll(() => getComputedStyle(pipeline.element()).backgroundColor)
    .toBe(NEUTRAL_SOFT);
  await pipeline.click();
  await expect
    .element(screen.getByRole("dialog", { name: "Phases" }))
    .toHaveFocus();
  await page.elementLocator(document.body).hover({ position: { x: 1, y: 1 } });

  // Open, but no longer under the pointer.
  await expect
    .poll(() => pipeline.element().matches("[data-hovered]"))
    .toBe(false);
  expect(getComputedStyle(pipeline.element()).backgroundColor).toBe(
    NEUTRAL_SOFT,
  );
});

test("opens Phases, 400 px wide, which takes the focus, with each phase, its actor, its state, and its due date, and returns the focus on Escape", async () => {
  const milestones = track();
  const { screen, pipeline } = await renderMilestones(milestones);

  await pipeline.click();

  const phases = screen.getByRole("dialog", { name: "Phases" });
  await expect.element(phases).toHaveFocus();
  expect(phases.element().parentElement!.getBoundingClientRect().width).toBe(
    400,
  );
  const lines = phases
    .getByRole("listitem")
    .elements()
    .map((element) => element.textContent);
  expect(lines).toEqual([
    `Triage · Vulnerability analystDone · due ${formatDateTime(milestones.triage_due_at!)}`,
    `Submission · MaintainerOverdue by 2 days · due ${formatDateTime(milestones.submission_due_at!)}`,
    `UM · Maintenance update teamDue in 3 days · due ${formatDateTime(milestones.um_due_at!)}`,
    `QA · QADue in 10 days · due ${formatDateTime(milestones.qa_due_at!)}`,
  ]);
  const current = phases.getByText("Submission", { exact: true }).element();
  expect(getComputedStyle(current).fontWeight).toBe("600");
  expect(
    getComputedStyle(phases.getByText("Triage", { exact: true }).element())
      .fontWeight,
  ).toBe("400");
  const late = phases.getByText("Overdue by 2 days", { exact: true }).element();
  expect(getComputedStyle(late).color).toBe(DANGER_ON_SOFT);
  expect(getComputedStyle(late).fontWeight).toBe("500");
  expect(
    getComputedStyle(phases.getByText("Done", { exact: true }).element()).color,
  ).toBe(FG_MUTED);

  await userEvent.keyboard("{Escape}");

  await expect.element(pipeline).toHaveFocus();
  expect(screen.getByRole("dialog").query()).toBeNull();
});

test("shows in Phases a phase without a due date with its state alone, and a status as received", async () => {
  const { screen, pipeline } = await renderMilestones(
    track({
      submission_due_at: null,
      um_due_at: null,
      qa_due_at: null,
      milestones: {
        triage: "done",
        submission: null,
        um: "waived",
        qa: null,
      },
      current_phase: null,
    }),
  );

  await pipeline.click();

  const phases = screen.getByRole("dialog", { name: "Phases" });
  await expect.element(phases).toHaveFocus();
  const lines = phases
    .getByRole("listitem")
    .elements()
    .map((element) => element.textContent);
  expect(lines.slice(1)).toEqual([
    "Submission · MaintainerNot observed",
    "UM · Maintenance update teamWaived",
    "QA · QANot observed",
  ]);
});

test.each([
  ["pending", "Pending", "delivery pending"],
  ["in_progress", "In progress", "delivery in progress"],
  ["released", "Released", "delivery released"],
  ["on_hold", "on_hold", "delivery on_hold"],
])(
  "ends its name and Phases with the delivery %s, after a border line",
  async (status, name, words) => {
    const { screen, pipeline } = await renderMilestones(track(), 1, status);

    await expect
      .element(pipeline)
      .toHaveAccessibleName(
        `Phases of ${SUBJECT}: Triage done; Submission overdue by 2 days, current; UM due in 3 days; QA due in 10 days; ${words}`,
      );

    await pipeline.click();

    const phases = screen.getByRole("dialog", { name: "Phases" });
    await expect.element(phases).toHaveFocus();
    // The delivery is the last line of Phases, below its phases.
    expect(phases.element().textContent).toMatch(
      new RegExp(`QA · QA.*Delivery${name}$`),
    );
    const label = phases.getByText("Delivery", { exact: true });
    const value = phases.getByText(name, { exact: true });
    expect(getComputedStyle(label.element()).color).toBe(FG_MUTED);
    // Its status 6 px after its label, without a mark between them.
    expect(
      value.element().getBoundingClientRect().left -
        label.element().getBoundingClientRect().right,
    ).toBeCloseTo(6, 0);
    // A border line 12 px below the last phase and 12 px above the delivery.
    const lines = phases.getByRole("separator").elements();
    expect(lines).toHaveLength(2);
    const line = lines[1]!.getBoundingClientRect();
    const last = phases.getByRole("listitem").elements().at(-1)!;
    expect(line.top - last.getBoundingClientRect().bottom).toBeCloseTo(12, 0);
    expect(
      label.element().getBoundingClientRect().top - line.bottom,
    ).toBeGreaterThanOrEqual(12);
  },
);

test("shows no delivery without one", async () => {
  const { screen, pipeline } = await renderMilestones(track());

  expect(pipeline.element().getAttribute("aria-label")).not.toContain(
    "delivery",
  );

  await pipeline.click();

  const phases = screen.getByRole("dialog", { name: "Phases" });
  await expect.element(phases).toHaveFocus();
  expect(phases.getByText("Delivery").elements()).toHaveLength(0);
  expect(phases.getByRole("separator").elements()).toHaveLength(1);
});

// The rectangle of an element on the screen.
function boxOf(element: Locator): DOMRect {
  return element.element().getBoundingClientRect();
}

// What a screen adds to the phases of the tests: two values of different
// widths, both narrower than their column, at Submission and at QA.
const EXTRAS: PhaseExtras = {
  submission: "SR 900001",
  qa: "RR 900003 +12",
};

// Opens Phases of the track with the extras, and returns it.
async function openPhases(extras: PhaseExtras | undefined) {
  const { screen, pipeline } = await renderMilestones(
    track(),
    1,
    undefined,
    extras,
  );
  await pipeline.click();
  const phases = screen.getByRole("dialog", { name: "Phases" });
  await expect.element(phases).toHaveFocus();
  return phases;
}

test("shows what the screen adds to a phase at the end of the line of its name, 12 px or more after it, in text-13, in a column at least 144 px wide whose values line up", async () => {
  const phases = await openPhases(EXTRAS);

  const submission = phases.getByText("SR 900001", { exact: true });
  const qa = phases.getByText("RR 900003 +12", { exact: true });
  await expect.element(submission).toBeVisible();
  for (const [value, name, actor] of [
    [submission, "Submission", "· Maintainer"],
    [qa, "QA", "· QA"],
  ] as const) {
    const box = boxOf(value);
    const nameBox = boxOf(phases.getByText(name, { exact: true }));
    const line = boxOf(
      phases
        .getByRole("listitem")
        .filter({ has: page.getByText(name, { exact: true }) }),
    );
    // On the line of the name, centered on it, at its end.
    expect(
      Math.abs((box.top + box.bottom) / 2 - (nameBox.top + nameBox.bottom) / 2),
    ).toBeLessThan(1);
    expect(box.right).toBeCloseTo(line.right, 0);
    expect(box.width).toBeGreaterThanOrEqual(144);
    expect(
      box.left - boxOf(phases.getByText(actor, { exact: true })).right,
    ).toBeGreaterThanOrEqual(12);
    expect(getComputedStyle(value.element()).fontSize).toBe("13px");
  }
  expect(boxOf(submission).left).toBeCloseTo(boxOf(qa).left, 0);
  // The state of the phase stays on the line below the name.
  expect(
    boxOf(phases.getByText("Overdue by 2 days", { exact: true })).top,
  ).toBeGreaterThanOrEqual(boxOf(submission).bottom);

  // In a window where the line of Submission leaves only 6 px between the
  // name and the column, the value goes below the name: Phases, narrower
  // than its 400 px, then takes the width of the window less 16 px.
  const name = phases.getByText("Submission", { exact: true });
  const line = phases
    .getByRole("listitem")
    .filter({ has: page.getByText("Submission", { exact: true }) });
  const start = boxOf(name).left;
  const used =
    boxOf(phases.getByText("· Maintainer", { exact: true })).right - start;
  const room = boxOf(line).right - start;
  await page.viewport(Math.round(used + 144 + 6 + 416 - room), 800);
  await expect
    .poll(() => phases.element().parentElement!.getBoundingClientRect().width)
    .toBeLessThan(400);
  const left = boxOf(line).right - boxOf(name).left - used - 144;
  expect(left).toBeGreaterThan(0);
  expect(left).toBeLessThan(12);
  expect(boxOf(submission).top).toBeGreaterThanOrEqual(boxOf(name).bottom);
});

test("shows nothing more at a phase to which the screen adds nothing", async () => {
  const milestones = track();
  const phases = await openPhases(EXTRAS);

  const lines = phases
    .getByRole("listitem")
    .elements()
    .map((element) => element.textContent);
  expect([lines[0], lines[2]]).toEqual([
    `Triage · Vulnerability analystDone · due ${formatDateTime(milestones.triage_due_at!)}`,
    `UM · Maintenance update teamDue in 3 days · due ${formatDateTime(milestones.um_due_at!)}`,
  ]);
  expect(lines[1]).toBe(
    `Submission · MaintainerSR 900001Overdue by 2 days · due ${formatDateTime(milestones.submission_due_at!)}`,
  );
});

test.each([
  ["without", undefined],
  ["with", EXTRAS],
])(
  "gives the line of the name of each phase at least 24 px, %s what the screen adds",
  async (_, extras) => {
    const phases = await openPhases(extras);

    // The state below the name starts at least 24 px below the top of the
    // line of the phase; the text of its own line is 20 px high.
    for (const [name, state] of [
      ["Triage", "Done"],
      ["Submission", "Overdue by 2 days"],
      ["UM", "Due in 3 days"],
      ["QA", "Due in 10 days"],
    ] as const) {
      const line = boxOf(
        phases
          .getByRole("listitem")
          .filter({ has: page.getByText(name, { exact: true }) }),
      );
      expect(
        boxOf(phases.getByText(state, { exact: true })).top - line.top,
      ).toBeGreaterThanOrEqual(24);
    }
  },
);

test("puts what the screen adds to a phase below its name and above its state where Phases is too narrow for both, at 320 CSS px", async () => {
  await page.viewport(320, 640);

  const phases = await openPhases(EXTRAS);

  const frame = phases.element().parentElement!.getBoundingClientRect();
  expect(frame.left).toBeGreaterThanOrEqual(0);
  expect(frame.right).toBeLessThanOrEqual(320);
  const value = boxOf(phases.getByText("SR 900001", { exact: true }));
  expect(value.top).toBeGreaterThanOrEqual(
    boxOf(phases.getByText("Submission", { exact: true })).bottom,
  );
  expect(value.bottom).toBeLessThanOrEqual(
    boxOf(phases.getByText("Overdue by 2 days", { exact: true })).top,
  );
  expect(value.right).toBeLessThanOrEqual(frame.right);
});

// The delivery of a track on its line, with its records where the test gives
// them: the submission request of the track.
async function renderDelivery(status: string, records: boolean) {
  return render(
    <p className="p-4 text-14 text-fg">
      <TrackDelivery
        status={status}
        records={
          records
            ? {
                subject: SUBJECT,
                content: (
                  <DescriptionList fittedTerms>
                    <DescriptionItem term="Submission">
                      SR 900001
                    </DescriptionItem>
                  </DescriptionList>
                ),
              }
            : undefined
        }
      />
    </p>,
  );
}

test.each([
  ["in_progress", "In progress"],
  ["released", "Released"],
  ["on_hold", "on_hold"],
])(
  "opens the records of the delivery %s from its status, a button named after what the delivery belongs to and the status, in a popover titled Delivery that does not repeat the status",
  async (status, name) => {
    const screen = await renderDelivery(status, true);
    const button = screen.getByRole("button", {
      name: `Delivery of ${SUBJECT}: ${name}`,
      exact: true,
    });
    await expect.element(button).toHaveTextContent(name);
    const label = screen.getByText("Delivery", { exact: true });
    // The pointer away from the button, where an earlier test may have left
    // it.
    await label.hover();
    // In the style of a name that opens a popover, 6 px after "Delivery" in
    // fg-muted.
    await expect
      .poll(() => getComputedStyle(button.element()).textDecorationColor)
      .toBe(BORDER_STRONG);
    expect(getComputedStyle(button.element()).textDecorationStyle).toBe(
      "dotted",
    );
    expect(getComputedStyle(label.element()).color).toBe(FG_MUTED);
    expect(boxOf(button).left - boxOf(label).right).toBeCloseTo(6, 0);

    await button.click();

    const popover = screen.getByRole("dialog", { name: "Delivery" });
    await expect.element(popover).toHaveFocus();
    await expect
      .element(popover.getByRole("definition"))
      .toHaveTextContent("SR 900001");
    expect(popover.getByText(name, { exact: true }).elements()).toHaveLength(0);
    expect(popover.getByRole("separator").elements()).toHaveLength(1);

    await userEvent.keyboard("{Escape}");

    await expect.element(button).toHaveFocus();
    expect(screen.getByRole("dialog").query()).toBeNull();
  },
);

test("shows the status of a delivery without records as text", async () => {
  const screen = await renderDelivery("in_progress", false);

  await expect
    .element(screen.getByText("In progress", { exact: true }))
    .toBeVisible();
  expect(screen.getByRole("button").query()).toBeNull();
});
