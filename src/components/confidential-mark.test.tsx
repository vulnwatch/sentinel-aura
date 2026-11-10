import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot } from "../test-screenshot";
import { ConfidentialLabel, ConfidentialMark } from "./confidential-mark";

// The mark of a confidential Ticket (docs/design-system.md, Confidential
// Tickets), after the identifier of a Ticket in a cell of a table, as the
// Ticket list shows it, in the light theme.

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

// fg-muted of the light theme, as text and as the color of the lines of the
// mark, border-strong, the boundary of a label, and canvas, the page.
const FG_MUTED = "rgb(89, 99, 110)";
const BORDER_STRONG = "rgb(129, 139, 152)";
const MUTED = "#59636e";
const CANVAS = "#f6f8fa";

function renderAfterIdentifier() {
  return render(
    <table>
      <tbody>
        <tr>
          <td>
            <a href="/tickets/SNTL-42">SNTL-42</a>
            <ConfidentialMark />
          </td>
        </tr>
      </tbody>
    </table>,
  );
}

test("shows lock, named Confidential, after the identifier", async () => {
  const screen = await renderAfterIdentifier();
  const lock = screen.getByRole("img", { name: "Confidential", exact: true });

  await expect.element(lock).toBeVisible();
  await expect
    .element(
      screen.getByRole("cell", { name: "SNTL-42 Confidential", exact: true }),
    )
    .toBeVisible();
});

test("is 14 px in fg-muted, 4 px after the identifier, on its line", async () => {
  const screen = await renderAfterIdentifier();
  const lock = screen.getByRole("img", { name: "Confidential" }).element();
  const identifier = screen.getByRole("link", { name: "SNTL-42" }).element();
  const box = lock.getBoundingClientRect();
  const line = identifier.getBoundingClientRect();

  expect([box.width, box.height]).toEqual([14, 14]);
  expect(getComputedStyle(lock).color).toBe(FG_MUTED);
  expect(box.left - line.right).toBeCloseTo(4);
  expect(box.top).toBeGreaterThanOrEqual(line.top);
  expect(box.bottom).toBeLessThanOrEqual(line.bottom);
});

test("draws lock in fg-muted", async () => {
  // At a text size of 64 px, four times the default, which enlarges lock to
  // 56 px, so that each point that the test reads lies well inside a line.
  document.documentElement.style.fontSize = "64px";
  const screen = await renderAfterIdentifier();
  const picture = await screenshot(
    screen.getByRole("img", { name: "Confidential", exact: true }),
  );
  // In the 24 units of the icon: the top of its shackle, the middle of the
  // left, right, and bottom sides of its body, and inside its body.
  const points: [x: number, y: number][] = [
    [12, 2],
    [3, 16.5],
    [21, 16.5],
    [12, 22],
    [12, 16.5],
  ];

  expect(
    points.map(([x, y]) =>
      picture.at((x * picture.width) / 24, (y * picture.height) / 24),
    ),
  ).toEqual([MUTED, MUTED, MUTED, MUTED, CANVAS]);
});

test("follows the lock with the label Confidential on a detail screen, which assistive technologies read once", async () => {
  const screen = await render(
    <p className="flex items-center gap-1">
      <span>SNTL-42</span>
      <ConfidentialLabel />
    </p>,
  );
  const label = screen.getByText("Confidential", { exact: true }).element();
  const lock = label.parentElement?.querySelector("svg");
  const style = getComputedStyle(label);

  expect(screen.getByRole("img").elements()).toHaveLength(0);
  expect(lock?.getAttribute("aria-hidden")).toBe("true");
  expect(lock?.getBoundingClientRect().width).toBe(14);
  expect(lock && getComputedStyle(lock).color).toBe(FG_MUTED);
  // A label (docs/design-system.md, Labels), 6 px after the lock.
  expect([
    style.fontSize,
    style.fontWeight,
    style.color,
    style.borderTopWidth,
    style.borderTopColor,
    style.borderTopLeftRadius,
    style.paddingLeft,
    style.paddingRight,
  ]).toEqual([
    "12px",
    "500",
    FG_MUTED,
    "1px",
    BORDER_STRONG,
    "4px",
    "4px",
    "4px",
  ]);
  expect(
    label.getBoundingClientRect().left -
      (lock?.getBoundingClientRect().right ?? 0),
  ).toBeCloseTo(6);
});
