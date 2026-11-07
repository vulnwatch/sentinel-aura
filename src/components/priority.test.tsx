import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import type { Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot } from "../test-screenshot";
import { Priority } from "./priority";

// A priority (docs/design-system.md, Priority), in the light theme. Each test
// shows it in a cell of a table, whose accessible name assistive technologies
// read, and in a figure, whose screenshot shows the mark, which is hidden
// from them. The tests of the mark set the text size of the browser to 64 px,
// four times the default, which enlarges the mark to 56 px, so that each
// point that they read lies well inside a shape.

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

const SCALE = 4;
// fg and fg-muted of the light theme, as text, and the colors of the marks:
// danger-solid, on-danger-solid, fg-muted, border, and canvas, the page.
const FG = "rgb(31, 35, 40)";
const FG_MUTED = "rgb(89, 99, 110)";
const DANGER_SOLID = "#cf222e";
const ON_DANGER_SOLID = "#ffffff";
const MUTED = "#59636e";
const BORDER = "#d8dee4";
const CANVAS = "#f6f8fa";

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

type Point = [x: number, y: number];

// The colors of points of the mark, in its 14 units, enlarged four times.
async function markColors(figure: Locator, points: Point[]) {
  const picture = await screenshot(figure);
  // The mark is centered on the line of the level.
  const top = (picture.height - 14 * SCALE) / 2;
  return points.map(([x, y]) => picture.at(x * SCALE, top + y * SCALE));
}

test("shows P1 as a red square with an exclamation mark, then P1 in fg at weight 600", async () => {
  const { screen, figure } = await renderValue(
    <Priority priority="p1" />,
    SCALE,
  );
  const level = figure.getByText("P1", { exact: true });
  // Inside the square, around the exclamation mark, above its line and
  // between its line and its dot, and inside its corner, which a radius
  // larger than 3 would leave out; on the line and the dot; outside the
  // rounded corner of the square, and in the space before the level.
  const square: Point[] = [
    [2, 7],
    [4, 5],
    [7, 1.8],
    [7, 8.95],
    [12, 12],
    [1.2, 1.2],
  ];
  const sign: Point[] = [
    [7, 3.5],
    [7, 5.4],
    [7, 7.3],
    [7, 10.4],
  ];
  const page: Point[] = [
    [0.25, 0.25],
    [14.75, 7],
  ];
  const colors = await markColors(figure, [...square, ...sign, ...page]);

  await expect
    .element(screen.getByRole("cell", { name: "P1", exact: true }))
    .toBeVisible();
  expect(screen.getByRole("img").query()).toBeNull();
  expect(getComputedStyle(level.element()).color).toBe(FG);
  expect(getComputedStyle(level.element()).fontWeight).toBe("600");
  expect(colors).toEqual([
    ...square.map(() => DANGER_SOLID),
    ...sign.map(() => ON_DANGER_SOLID),
    ...page.map(() => CANVAS),
  ]);
});

// The center of each bar, from the first, and a point above each, before the
// first, between each two, after the last, and below the line on which they
// stand.
const BAR_CENTERS: Point[] = [
  [2.5, 11],
  [7, 9.25],
  [11.5, 7.5],
];
const AROUND_BARS: Point[] = [
  [2.5, 7.5],
  [7, 4],
  [11.5, 0.75],
  [0.5, 11],
  [4.75, 11],
  [9.25, 11],
  [13.5, 11],
  [7, 13.75],
];

test.each([
  ["p2", "P2", [MUTED, MUTED, MUTED]],
  ["p3", "P3", [MUTED, MUTED, BORDER]],
  ["p4", "P4", [MUTED, BORDER, BORDER]],
])(
  "shows %s as three rising bars, the first filled ones in fg-muted and the others in border, then %s in fg-muted",
  async (value, name, bars) => {
    const { screen, figure } = await renderValue(
      <Priority priority={value} />,
      SCALE,
    );
    const level = figure.getByText(name, { exact: true });
    const colors = await markColors(figure, [...BAR_CENTERS, ...AROUND_BARS]);

    await expect
      .element(screen.getByRole("cell", { name, exact: true }))
      .toBeVisible();
    expect(screen.getByRole("img").query()).toBeNull();
    expect(getComputedStyle(level.element()).color).toBe(FG_MUTED);
    expect(getComputedStyle(level.element()).fontWeight).toBe("400");
    expect(colors).toEqual([...bars, ...AROUND_BARS.map(() => CANVAS)]);
  },
);

test.each([
  ["p1", "P1"],
  ["p3", "P3"],
])(
  "shows the level of %s 6 px after its mark of 14 px",
  async (value, name) => {
    const { figure } = await renderValue(<Priority priority={value} />);
    const level = figure.getByText(name, { exact: true });

    expect(
      level.element().getBoundingClientRect().left -
        figure.element().getBoundingClientRect().left,
    ).toBe(20);
  },
);

test.each([
  ["p1", "P1"],
  ["p3", "P3"],
])(
  "ends an override of %s with user-pen at 14 px in fg-muted, 4 px after the level, hidden from assistive technologies",
  async (value, name) => {
    const { screen, figure } = await renderValue(
      <Priority priority={value} isOverride />,
    );
    const level = figure.getByText(name, { exact: true });
    // The icon follows the mark of the level.
    const icon = [...figure.element().querySelectorAll("svg")].at(-1)!;

    // The element that shows the override names it (priority-explanation).
    await expect
      .element(screen.getByRole("cell", { name, exact: true }))
      .toBeVisible();
    expect(screen.getByRole("img").query()).toBeNull();
    const box = icon.getBoundingClientRect();
    expect([box.width, box.height]).toEqual([14, 14]);
    expect(box.left - level.element().getBoundingClientRect().right).toBe(4);
    expect(getComputedStyle(icon).color).toBe(FG_MUTED);
  },
);

test("shows a priority that is not an override without the icon", async () => {
  const { figure } = await renderValue(<Priority priority="p1" />);

  expect(figure.element().querySelectorAll("svg")).toHaveLength(1);
  expect(figure.element().textContent).toBe("P1");
});

test("shows null as an absent value", async () => {
  const { screen, figure } = await renderValue(<Priority priority={null} />);

  await expect
    .element(screen.getByRole("cell", { name: "Not set", exact: true }))
    .toBeVisible();
  await expect.element(figure.getByText("–", { exact: true })).toBeVisible();
});

test.each(["p0", "constructor"])(
  "shows %s, which the pinned contract does not list, as received in fg, without a mark",
  async (value) => {
    const { screen, figure } = await renderValue(<Priority priority={value} />);
    const text = figure.getByText(value, { exact: true });

    await expect
      .element(screen.getByRole("cell", { name: value, exact: true }))
      .toBeVisible();
    expect(getComputedStyle(text.element()).color).toBe(FG);
    expect(getComputedStyle(text.element()).fontWeight).toBe("400");
    expect(text.element().getBoundingClientRect().left).toBe(
      figure.element().getBoundingClientRect().left,
    );
  },
);
