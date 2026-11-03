import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import type { Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot } from "../test-screenshot";
import { Severity } from "./severity";

// A severity (docs/design-system.md, Severity; Severity Marks), in the light
// theme. Each test shows it in a cell of a table, whose accessible name
// assistive technologies read, and in a figure, whose screenshot shows the
// dot, which is hidden from them. The tests of the dot set the text size of
// the browser to 48 px, three times the default, which enlarges the dot to
// 24 px, so that each point that they read lies well inside a shape.

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

const SCALE = 3;
// fg of the light theme, canvas, the page, and neutral-icon.
const FG = "rgb(31, 35, 40)";
const CANVAS = "#f6f8fa";
const NEUTRAL_ICON = "#6e7781";

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
      <figure aria-label="Fictional value" className="inline-flex">
        {node}
      </figure>
    </>,
  );
  return { screen, figure: screen.getByRole("figure") };
}

// Points of the dot of 8 units, from the top left corner of its box: its
// center, and a point within the inner side of an edge of 1 unit; inside
// that edge on the left and at the top; and beyond the dot, in its corner,
// below it, and in the space before the name.
const INSIDE: [number, number][] = [
  [4, 4],
  [1.5, 4],
];
const INSIDE_EDGE: [number, number][] = [
  [0.5, 4],
  [4, 0.5],
];
const OUTSIDE: [number, number][] = [
  [0.8, 0.8],
  [4, 8.5],
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
    edge: INSIDE_EDGE.map(at),
    outside: OUTSIDE.map(at),
  };
}

test.each([
  ["critical", "#e5252a", "Critical"],
  ["high", "#f76b15", "High"],
  ["medium", "#f5c400", "Medium"],
  ["low", "#3b82f6", "Low"],
  ["none", "#8b949e", "None"],
])(
  "shows %s as a dot of 8 px in its mark, %s, then its name %s in fg",
  async (value, mark, name) => {
    const { screen, figure } = await renderValue(
      <Severity severity={value} />,
      SCALE,
    );
    const dot = await dotColors(figure);

    await expect
      .element(screen.getByRole("cell", { name, exact: true }))
      .toBeVisible();
    expect(screen.getByRole("img").query()).toBeNull();
    expect(
      getComputedStyle(figure.getByText(name, { exact: true }).element()).color,
    ).toBe(FG);
    expect(dot.inside).toEqual([mark, mark]);
    expect(dot.edge).toEqual([mark, mark]);
    expect(dot.outside).toEqual([CANVAS, CANVAS, CANVAS]);
  },
);

test("shows the name 6 px after the dot of 8 px", async () => {
  const { figure } = await renderValue(<Severity severity="high" />);
  const name = figure.getByText("High", { exact: true });

  expect(
    name.element().getBoundingClientRect().left -
      figure.element().getBoundingClientRect().left,
  ).toBe(14);
});

test("shows null as an absent value", async () => {
  const { screen, figure } = await renderValue(<Severity severity={null} />);

  await expect
    .element(screen.getByRole("cell", { name: "Not set", exact: true }))
    .toBeVisible();
  await expect.element(figure.getByText("–", { exact: true })).toBeVisible();
});

test.each(["catastrophic", "constructor"])(
  "shows %s, which the pinned contract does not list, as received, after a hollow dot in neutral-icon",
  async (value) => {
    const { screen, figure } = await renderValue(
      <Severity severity={value} />,
      SCALE,
    );
    const dot = await dotColors(figure);

    await expect
      .element(screen.getByRole("cell", { name: value, exact: true }))
      .toBeVisible();
    expect(
      getComputedStyle(figure.getByText(value, { exact: true }).element())
        .color,
    ).toBe(FG);
    // The edge is 1 px, 3 px here, around the page.
    expect(dot.inside).toEqual([CANVAS, CANVAS]);
    expect(dot.edge).toEqual([NEUTRAL_ICON, NEUTRAL_ICON]);
    expect(dot.outside).toEqual([CANVAS, CANVAS, CANVAS]);
  },
);
