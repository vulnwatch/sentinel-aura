import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import type { Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot } from "../test-screenshot";
import { TicketStatus } from "./ticket-status";

// A Ticket status (docs/design-system.md, Ticket Status), in the light theme.
// Each test shows it in a cell of a table, whose accessible name assistive
// technologies read, and in a figure, whose screenshot shows the mark, which
// is hidden from them. The tests of the mark set the text size of the
// browser to 48 px, three times the default, which enlarges the mark to
// 48 px, so that each point that they read lies well inside a shape.

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

const SCALE = 3;
// fg of the light theme, as text, and the colors of the marks: info-icon,
// success-icon, neutral-icon, surface, and canvas, the page.
const FG = "rgb(31, 35, 40)";
const INFO = "#0969da";
const SUCCESS = "#1a7f37";
const NEUTRAL = "#6e7781";
const SURFACE = "#ffffff";
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

// The colors of points of the mark, in its box of 16 units, which the mark
// fills, enlarged scale times.
async function markColors(figure: Locator, points: Point[], scale = SCALE) {
  const picture = await screenshot(figure);
  // The mark is centered on the line of the name.
  const top = (picture.height - 16 * scale) / 2;
  return points.map(([x, y]) => picture.at(x * scale, top + y * scale));
}

// The point of the ring of radius 6.25 at an angle, in degrees clockwise
// from the right.
function onRing(degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return [8 + 6.25 * Math.cos(radians), 8 + 6.25 * Math.sin(radians)];
}

// Points of each mark: in the color of the status, on its lines and fills;
// in surface, on the lines inside a disc; and in the page, inside the ring
// outside its fill and around the mark.
const MARKS: [
  value: string,
  name: string,
  color: string,
  colored: Point[],
  inSurface: Point[],
  inPage: Point[],
][] = [
  [
    "new",
    "New",
    INFO,
    // The middle of the dashes on the axes and on a diagonal.
    [onRing(0), onRing(45), onRing(90), onRing(180), onRing(270)],
    [],
    // The middle of the gaps between the dashes, and the center.
    [onRing(22.5), onRing(112.5), onRing(202.5), onRing(292.5), [8, 8]],
  ],
  [
    "analysis",
    "Analysis",
    INFO,
    // The ring, where New has gaps, and the right half of the disc.
    [onRing(0), onRing(22.5), onRing(202.5), [9.5, 6.5], [9.5, 9.5]],
    [],
    // The last point just beyond the ring.
    [
      [6.5, 6.5],
      [6.5, 9.5],
      [12.5, 8],
      [0.5, 0.5],
      [15.6, 8],
    ],
  ],
  [
    "analyzed",
    "Analyzed",
    INFO,
    // The ring and three quarters of the disc, without the upper left one.
    [onRing(0), onRing(22.5), [9.5, 6.5], [9.5, 9.5], [6.5, 9.5]],
    [],
    // The last point just beyond the ring.
    [
      [6.5, 6.5],
      [12.5, 8],
      [0.5, 0.5],
      [15.6, 8],
    ],
  ],
  [
    "resolved",
    "Resolved",
    SUCCESS,
    // The disc, the last point near its edge.
    [
      [12.5, 8],
      [8, 3.5],
      [3, 8],
      [14.5, 8],
    ],
    // The check: its ends, its corner, and the middle of its short line.
    [
      [4.9, 8.2],
      [5.95, 9.2],
      [7, 10.2],
      [11.1, 5.9],
    ],
    [
      [0.5, 8],
      [15.5, 8],
      [0.5, 0.5],
    ],
  ],
  [
    "ignored",
    "Ignored",
    NEUTRAL,
    // The disc, the last point near its edge.
    [
      [12.5, 8],
      [8, 3.5],
      [3.5, 8],
      [14.5, 8],
    ],
    // The slash: its ends and its middle.
    [
      [5.2, 10.8],
      [8, 8],
      [10.8, 5.2],
    ],
    [
      [0.5, 8],
      [0.5, 0.5],
    ],
  ],
  [
    "duplicated",
    "Duplicated",
    NEUTRAL,
    // The disc, the last point near its edge.
    [
      [8, 3.5],
      [12.5, 8],
      [8, 12.5],
      [14.5, 8],
    ],
    // The arrow: the ends of its line and of its head.
    [
      [4.6, 8],
      [7, 8],
      [10.8, 8],
      [8.4, 5.6],
      [8.4, 10.4],
    ],
    [
      [0.5, 8],
      [0.5, 0.5],
    ],
  ],
];

test.each(MARKS)(
  "shows %s as its mark of 16 px, then its name %s in fg",
  async (value, name, color, colored, inSurface, inPage) => {
    const { screen, figure } = await renderValue(
      <TicketStatus status={value} />,
      SCALE,
    );
    const colors = await markColors(figure, [
      ...colored,
      ...inSurface,
      ...inPage,
    ]);

    await expect
      .element(screen.getByRole("cell", { name, exact: true }))
      .toBeVisible();
    expect(screen.getByRole("img").query()).toBeNull();
    expect(
      getComputedStyle(figure.getByText(name, { exact: true }).element()).color,
    ).toBe(FG);
    expect(colors).toEqual([
      ...colored.map(() => color),
      ...inSurface.map(() => SURFACE),
      ...inPage.map(() => CANVAS),
    ]);
  },
);

test("centers the dashes of New on the axes and the diagonals", async () => {
  // At a text size of 96 px, six times the default, so that each point lies
  // well inside a dash or a gap.
  const scale = 6;
  const { figure } = await renderValue(<TicketStatus status="new" />, scale);
  // Each dash, with its round ends, reaches 13.8 degrees on each side of its
  // axis or diagonal: points inside both of its ends, and beyond them, in the
  // gaps. Dashes moved along the ring leave a point of one side out and cover
  // a point of the other. The dashes at the bottom and the top, where the
  // ring runs across, so that the figure, whose top can fall between two
  // pixels, does not move the points along the ring.
  const centers = [90, 270];
  const inDashes = centers.flatMap((center) => [
    onRing(center - 10.2),
    onRing(center + 10.2),
  ]);
  const inGaps = centers.flatMap((center) => [
    onRing(center - 17.4),
    onRing(center + 17.4),
  ]);
  const colors = await markColors(figure, [...inDashes, ...inGaps], scale);

  expect(colors).toEqual([
    ...inDashes.map(() => INFO),
    ...inGaps.map(() => CANVAS),
  ]);
});

test.each([
  ["analyzed", "Analyzed"],
  ["review", "review"],
])("shows the name of %s 6 px after its mark of 16 px", async (value, name) => {
  const { figure } = await renderValue(<TicketStatus status={value} />);
  const text = figure.getByText(name, { exact: true });

  expect(
    text.element().getBoundingClientRect().left -
      figure.element().getBoundingClientRect().left,
  ).toBe(22);
});

test.each(["review", "constructor"])(
  "shows %s, which the pinned contract does not list, as received, after circle-question-mark in neutral-icon",
  async (value) => {
    const { screen, figure } = await renderValue(
      <TicketStatus status={value} />,
      SCALE,
    );
    // In the 24 units of the icon: its circle on the right and on the left,
    // the hook of the question mark at its top and on its right, and inside
    // the circle, beside the question mark.
    const colors = await markColors(
      figure,
      (
        [
          [22, 12],
          [2, 12],
          [12, 7],
          [14.5, 9.5],
          [7, 12],
        ] satisfies Point[]
      ).map(([x, y]) => [(x * 16) / 24, (y * 16) / 24]),
    );

    await expect
      .element(screen.getByRole("cell", { name: value, exact: true }))
      .toBeVisible();
    expect(screen.getByRole("img").query()).toBeNull();
    expect(
      getComputedStyle(figure.getByText(value, { exact: true }).element())
        .color,
    ).toBe(FG);
    expect(colors).toEqual([NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL, CANVAS]);
  },
);
