import { afterEach, beforeEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot } from "../test-screenshot";
import { formatDateTime } from "./date-time";
import { TrackMilestones, type MilestoneTrack } from "./track-milestones";

// The milestones of a track (docs/design-system.md, Track Milestones), at a
// wide window, in the light theme.

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

async function renderMilestones(milestones: MilestoneTrack, scale = 1) {
  document.documentElement.style.fontSize = `${16 * scale}px`;
  const screen = await render(
    <div className="p-4">
      <TrackMilestones track={milestones} subject={SUBJECT} now={NOW} />
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
  const { pipeline } = await renderMilestones(track());

  await pipeline.hover();
  expect(getComputedStyle(pipeline.element()).backgroundColor).toBe(
    NEUTRAL_SOFT,
  );
  await pipeline.click();
  await page.elementLocator(document.body).hover({ position: { x: 1, y: 1 } });

  expect(getComputedStyle(pipeline.element()).backgroundColor).toBe(
    NEUTRAL_SOFT,
  );
});

test("opens Phases, which takes the focus, with each phase, its actor, its state, and its due date, and returns the focus on Escape", async () => {
  const milestones = track();
  const { screen, pipeline } = await renderMilestones(milestones);

  await pipeline.click();

  const phases = screen.getByRole("dialog", { name: "Phases" });
  await expect.element(phases).toHaveFocus();
  expect(phases.element().parentElement!.getBoundingClientRect().width).toBe(
    320,
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

  const lines = screen
    .getByRole("dialog", { name: "Phases" })
    .getByRole("listitem")
    .elements()
    .map((element) => element.textContent);
  expect(lines.slice(1)).toEqual([
    "Submission · MaintainerNot observed",
    "UM · Maintenance update teamWaived",
    "QA · QANot observed",
  ]);
});
