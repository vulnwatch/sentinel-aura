import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import type { Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot } from "../test-screenshot";
import { MarkedValue, type MarkedName, type Tone } from "./marked-value";

// A value of a response enum that a screen document marks with a tone
// (docs/design-system.md, Other Values; Tones), in the light theme. Each
// test shows it in a cell of a table, whose accessible name assistive
// technologies read, and in a figure, whose screenshot shows the dot, which
// is hidden from them. The tests of the dot set the text size of the browser
// to 48 px, three times the default, which enlarges the dot to 24 px, so
// that each point that they read lies well inside a shape.

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

const SCALE = 3;
// fg-muted of the light theme, canvas, the page, and neutral-icon.
const FG_MUTED = "rgb(89, 99, 110)";
const CANVAS = "#f6f8fa";
const NEUTRAL_ICON = "#6e7781";

// The values of a fictional enum, one of each tone.
const KNOWN = new Map<string, MarkedName>(
  Object.entries({
    idle: { name: "Idle", tone: "neutral" },
    running: { name: "Running", tone: "info" },
    passed: { name: "Passed", tone: "success" },
    late: { name: "Late", tone: "warning" },
    failed: { name: "Failed", tone: "danger" },
  }),
);

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
