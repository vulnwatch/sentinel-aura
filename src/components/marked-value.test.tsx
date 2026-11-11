import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import { commands, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot } from "../test-screenshot";
import {
  MarkedValue,
  ValueMark,
  type MarkedName,
  type Tone,
} from "./marked-value";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reduce: boolean) => Promise<void>;
  }
}

// A value of a response enum that a screen document marks with a tone
// (docs/design-system.md, Other Values; Tones), in the light theme. Each
// test shows it in a cell of a table, whose accessible name assistive
// technologies read, and in a figure, whose screenshot shows the dot, which
// is hidden from them. The tests of the dot set the text size of the browser
// to 48 px, three times the default, which enlarges the dot to 24 px, so
// that each point that they read lies well inside a shape.

afterEach(async () => {
  document.documentElement.style.removeProperty("font-size");
  await commands.emulateReducedMotion(false);
});

const SCALE = 3;
// fg-muted of the light theme, canvas, the page, and neutral-icon.
const FG_MUTED = "rgb(89, 99, 110)";
const CANVAS = "#f6f8fa";
const NEUTRAL_ICON = "#6e7781";

// The values of a fictional enum, one of each tone, an operation in
// progress, an observation never made, and an attempt that found nothing.
const KNOWN = new Map<string, MarkedName>(
  Object.entries({
    idle: { name: "Idle", tone: "neutral" },
    running: { name: "Running", tone: "info" },
    passed: { name: "Passed", tone: "success" },
    late: { name: "Late", tone: "warning" },
    failed: { name: "Failed", tone: "danger" },
    pending: { name: "Pending", tone: "info", mark: "progress" },
    unseen: { name: "Not attempted", tone: "neutral", mark: "unobserved" },
    none: { name: "Missing", tone: "neutral", mark: "empty" },
  }),
);
const INFO_ICON = "#0969da";

// The names of the animations that run in an element and its descendants.
function animationsIn(element: Element): string[] {
  return element
    .getAnimations({ subtree: true })
    .map((animation) =>
      animation instanceof CSSAnimation ? animation.animationName : "",
    );
}

// The color at a point of an icon of 12 units before the name, in the units
// of Lucide's grid of 24, enlarged three times.
async function iconColor(figure: Locator, [x, y]: [number, number]) {
  const picture = await screenshot(figure);
  // The icon is centered on the line of the name.
  const top = (picture.height - 12 * SCALE) / 2;
  return picture.at((x / 2) * SCALE, top + (y / 2) * SCALE);
}

async function renderValue(node: ReactNode, scale = 1) {
  document.documentElement.style.fontSize = `${16 * scale}px`;
  const screen = await render(
    <>
      <table>
        <tbody>
          <tr>
            <td>{node}</td>
          </tr>
        </tbody>
      </table>
      <figure
        aria-label="Fictional value"
        className="inline-flex text-fg-muted"
      >
        {node}
      </figure>
    </>,
  );
  return { screen, figure: screen.getByRole("figure") };
}

// Points of the dot of 8 units, from the top left corner of its box: its
// center, and a point within the inner side of an edge of 1 unit; inside
// that edge on the left; and beyond the dot, in its corner and in the space
// before the name.
const INSIDE: [number, number][] = [
  [4, 4],
  [1.5, 4],
];
const EDGE: [number, number] = [0.5, 4];
const OUTSIDE: [number, number][] = [
  [0.8, 0.8],
  [8.5, 4],
];

// The colors of the points of the dot, enlarged three times.
async function dotColors(figure: Locator) {
  const picture = await screenshot(figure);
  // The dot is centered on the line of the name.
  const top = (picture.height - 8 * SCALE) / 2;
  const at = ([x, y]: [number, number]) =>
    picture.at(x * SCALE, top + y * SCALE);
  return {
    inside: INSIDE.map(at),
    edge: at(EDGE),
    outside: OUTSIDE.map(at),
  };
}

test.each<[string, Tone, string, string]>([
  ["idle", "neutral", "#6e7781", "Idle"],
  ["running", "info", "#0969da", "Running"],
  ["passed", "success", "#1a7f37", "Passed"],
  ["late", "warning", "#9a6700", "Late"],
  ["failed", "danger", "#cf222e", "Failed"],
])(
  "shows %s, of the %s tone, as a dot of 8 px in %s, then its name %s in the color of the text around it",
  async (value, _, icon, name) => {
    const { screen, figure } = await renderValue(
      <MarkedValue value={value} known={KNOWN} />,
      SCALE,
    );
    const dot = await dotColors(figure);

    await expect
      .element(screen.getByRole("cell", { name, exact: true }))
      .toBeVisible();
    expect(screen.getByRole("img").query()).toBeNull();
    expect(
      getComputedStyle(figure.getByText(name, { exact: true }).element()).color,
    ).toBe(FG_MUTED);
    expect(dot.inside).toEqual([icon, icon]);
    expect(dot.edge).toBe(icon);
    expect(dot.outside).toEqual([CANVAS, CANVAS]);
  },
);

test("shows the name 6 px after the dot of 8 px", async () => {
  const { figure } = await renderValue(
    <MarkedValue value="running" known={KNOWN} />,
  );
  const name = figure.getByText("Running", { exact: true });

  expect(
    name.element().getBoundingClientRect().left -
      figure.element().getBoundingClientRect().left,
  ).toBe(14);
});

test("shows an operation in progress with loader-circle of 12 px in info-icon, turning, which stands still under reduced motion, its name 6 px after it", async () => {
  const { screen, figure } = await renderValue(
    <MarkedValue value="pending" known={KNOWN} />,
    SCALE,
  );
  await expect
    .element(screen.getByRole("cell", { name: "Pending", exact: true }))
    .toBeVisible();
  expect(animationsIn(figure.element())).toEqual(["spin"]);

  await commands.emulateReducedMotion(true);

  expect(animationsIn(figure.element())).toEqual([]);
  // The arc of loader-circle starts at the middle of its right side, at 21
  // of its 24 units, and leaves the center empty.
  expect(await iconColor(figure, [21, 12])).toBe(INFO_ICON);
  expect(await iconColor(figure, [12, 12])).toBe(CANVAS);
  const name = figure.getByText("Pending", { exact: true });
  expect(
    name.element().getBoundingClientRect().left -
      figure.element().getBoundingClientRect().left,
  ).toBe(18 * SCALE);
});

test("shows an observation never made with circle-dashed of 12 px in neutral-icon, still, its name 6 px after it", async () => {
  const { screen, figure } = await renderValue(
    <MarkedValue value="unseen" known={KNOWN} />,
    SCALE,
  );
  await expect
    .element(screen.getByRole("cell", { name: "Not attempted", exact: true }))
    .toBeVisible();

  expect(animationsIn(figure.element())).toEqual([]);
  // The dash at the middle of its right side, at 21.8 of its 24 units, and
  // its empty center.
  expect(await iconColor(figure, [21.8, 12])).toBe(NEUTRAL_ICON);
  expect(await iconColor(figure, [12, 12])).toBe(CANVAS);
  const name = figure.getByText("Not attempted", { exact: true });
  expect(
    name.element().getBoundingClientRect().left -
      figure.element().getBoundingClientRect().left,
  ).toBe(18 * SCALE);
});

test.each(["paused", "constructor"])(
  "shows %s, which the pinned contract does not list, as received, after a hollow dot in neutral-icon",
  async (value) => {
    const { screen, figure } = await renderValue(
      <MarkedValue value={value} known={KNOWN} />,
      SCALE,
    );
    const dot = await dotColors(figure);

    await expect
      .element(screen.getByRole("cell", { name: value, exact: true }))
      .toBeVisible();
    // The edge is 1 px, 3 px here, around the page.
    expect(dot.inside).toEqual([CANVAS, CANVAS]);
    expect(dot.edge).toBe(NEUTRAL_ICON);
    expect(dot.outside).toEqual([CANVAS, CANVAS]);
  },
);

test("shows an attempt that found nothing with circle of 12 px in neutral-icon, hollow, its name 6 px after it", async () => {
  const { screen, figure } = await renderValue(
    <MarkedValue value="none" known={KNOWN} />,
    SCALE,
  );
  await expect
    .element(screen.getByRole("cell", { name: "Missing", exact: true }))
    .toBeVisible();

  // Its edge at the middle of its right side, at 22 of its 24 units, and
  // 22.5 degrees above it, where a dashed circle leaves a gap between two
  // dashes; and its empty center.
  expect(await iconColor(figure, [22, 12])).toBe(NEUTRAL_ICON);
  expect(await iconColor(figure, [21.24, 8.17])).toBe(NEUTRAL_ICON);
  expect(await iconColor(figure, [12, 12])).toBe(CANVAS);
  const name = figure.getByText("Missing", { exact: true });
  expect(
    name.element().getBoundingClientRect().left -
      figure.element().getBoundingClientRect().left,
  ).toBe(18 * SCALE);
});

// The mark of a value alone, without its name, as the status of a source of
// a CVE shows it (docs/design-system.md, Other Values): the screen names the
// value for assistive technologies itself.
test.each<[string, string, number, [number, number]]>([
  // A dot is filled at its center.
  ["passed", "#1a7f37", 10, [5, 5]],
  ["failed", "#cf222e", 10, [5, 5]],
  // An icon draws its edge at the middle of its right side, at 21 to 22 of
  // its 24 units, half a pixel each.
  ["none", NEUTRAL_ICON, 12, [11, 6]],
  ["pending", INFO_ICON, 12, [10.5, 6]],
  ["unseen", NEUTRAL_ICON, 12, [10.9, 6]],
  ["paused", NEUTRAL_ICON, 12, [11, 6]],
])(
  "shows the mark of %s alone, in %s, %i px wide, without a name",
  async (value, color, size, [x, y]) => {
    // The spinner of an operation in progress stands still, where its arc
    // starts.
    await commands.emulateReducedMotion(true);
    const { figure } = await renderValue(
      <ValueMark value={value} known={KNOWN} />,
      SCALE,
    );
    const picture = await screenshot(figure);

    expect(figure.element().textContent).toBe("");
    expect(picture.width).toBe(size * SCALE);
    expect(picture.at(x * SCALE, y * SCALE)).toBe(color);
  },
);

test("shows the mark of a value that the pinned contract does not list alone as circle-question-mark, unlike the hollow circle of an attempt that found nothing", async () => {
  const unknown = await renderValue(
    <ValueMark value="paused" known={KNOWN} />,
    SCALE,
  );
  // The top of the curve of the question mark, at 7 of the 24 units, above
  // the center.
  expect(await iconColor(unknown.figure, [12, 7])).toBe(NEUTRAL_ICON);
  await unknown.screen.unmount();

  const missing = await renderValue(
    <ValueMark value="none" known={KNOWN} />,
    SCALE,
  );
  expect(await iconColor(missing.figure, [12, 7])).toBe(CANVAS);
});
