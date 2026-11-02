import { afterEach, expect, test } from "vitest";
import { page, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { avatarGrid, avatarPicture } from "../avatar";
import { Avatar, NoActorPicture, type AvatarSize } from "./avatar";

// The avatar (docs/design-system.md, Avatar; Representation of a User), at
// the browser's default text size. The avatar is hidden from assistive
// technologies, so each test names a wrapper of its own to find it, and reads
// the colors of its picture from a screenshot of that wrapper.

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

// Test vector 1, of color 7, and its grid, row 0 first.
const ID = "019a2b3c-4d5e-7f00-8000-000000000001";
const GRID = ["..#..", "#.#.#", "#...#", "##.##", "....."];
const COLOR = "#a21caf";
const BACKGROUND = "#f0f0f0";
const GRAY = "#6e6e6e";
// The page behind the avatar: canvas in the light and in the dark theme.
const CANVAS_LIGHT = "#f6f8fa";
const CANVAS_DARK = "#0d1117";

const PERSON = { id: ID, active: true, bot: false };
const BOT = { id: ID, active: true, bot: true };

function renderAvatar(user: typeof PERSON, size: AvatarSize = "large") {
  return render(
    <figure aria-label="Fictional avatar" className="inline-flex">
      <Avatar user={user} size={size} />
    </figure>,
  );
}

interface Picture {
  width: number;
  height: number;
  // The color of the pixel at a point given in the 6 units of the picture,
  // as #rrggbb.
  at: (x: number, y: number) => string;
}

// A screenshot of an element, whose pixels the test reads.
async function screenshot(element: Locator): Promise<Picture> {
  const base64 = await page.screenshot({ element, save: false });
  const png = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const bitmap = await createImageBitmap(
    new Blob([png], { type: "image/png" }),
  );
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("the browser gives no 2D context");
  }
  context.drawImage(bitmap, 0, 0);
  const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  const unit = bitmap.width / 6;
  return {
    width: bitmap.width,
    height: bitmap.height,
    at: (x, y) => {
      const offset =
        4 * (Math.floor(y * unit) * bitmap.width + Math.floor(x * unit));
      return `#${Array.from(data.slice(offset, offset + 3), (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("")}`;
    },
  };
}

// The color of the center of every cell of the grid, row 0 first.
function cellColors(picture: Picture): string[][] {
  return GRID.map((row, r) =>
    row.split("").map((_, c) => picture.at(1 + c, 1 + r)),
  );
}

// The colors that the grid gives to its filled and its empty cells.
function expectedCells(filled: string, empty: string): string[][] {
  return GRID.map((row) =>
    row.split("").map((cell) => (cell === "#" ? filled : empty)),
  );
}

// A point in the margin of the picture, beside the corner: inside the
// rounded corners of a bot account, outside the circle of a person.
const CORNER: [number, number] = [0.25, 1];
// A point in the margin halfway down the left side, inside both shapes.
const SIDE: [number, number] = [0.25, 3];

test("draws a person's cells in the color of the Palette on #F0F0F0, through a circle", async () => {
  const screen = await renderAvatar(PERSON);
  const picture = await screenshot(screen.getByRole("figure"));

  expect(cellColors(picture)).toEqual(expectedCells(COLOR, BACKGROUND));
  expect(picture.at(...SIDE)).toBe(BACKGROUND);
  expect(picture.at(...CORNER)).toBe(CANVAS_LIGHT);
});

test("draws a bot account's cells in #F0F0F0 on the color, with rounded corners", async () => {
  const screen = await renderAvatar(BOT);
  const picture = await screenshot(screen.getByRole("figure"));

  expect(cellColors(picture)).toEqual(expectedCells(BACKGROUND, COLOR));
  expect(picture.at(...SIDE)).toBe(COLOR);
  expect(picture.at(...CORNER)).toBe(COLOR);
  expect(picture.at(0.05, 0.05)).toBe(CANVAS_LIGHT);
});

test("draws an inactive person's cells in gray", async () => {
  const screen = await renderAvatar({ ...PERSON, active: false });
  const picture = await screenshot(screen.getByRole("figure"));

  expect(cellColors(picture)).toEqual(expectedCells(GRAY, BACKGROUND));
  expect(picture.at(...CORNER)).toBe(CANVAS_LIGHT);
});

test("draws an inactive bot account in #F0F0F0 on gray", async () => {
  const screen = await renderAvatar({ ...BOT, active: false });
  const picture = await screenshot(screen.getByRole("figure"));

  expect(cellColors(picture)).toEqual(expectedCells(BACKGROUND, GRAY));
  expect(picture.at(...CORNER)).toBe(GRAY);
});

// A fictional id of each color of the Palette, by its index, with the
// color: vectors 1 to 5 of the design system and three more.
test.each([
  ["019a2b3c-4d5e-7f00-8000-00000000000a", "#65730f"],
  ["019a2b3c-4d5e-7f00-8000-000000000007", "#c2410c"],
  ["019a2b3c-4d5e-7f00-8000-00000000000d", "#a16207"],
  ["019a2b3c-4d5f-7f00-8000-000000000001", "#15803d"],
  ["019a2b3c-4d5e-7f00-8000-000000000004", "#0f766e"],
  ["019a2b3c-4d5e-7f00-8000-000000000003", "#0369a1"],
  ["019a2b3c-4d5e-7f00-8000-000000000002", "#4338ca"],
  ["019a2b3c-4d5e-7f00-8000-000000000001", "#a21caf"],
])("draws the cells of %s in the color of its index, %s", async (id, color) => {
  const grid = avatarGrid(avatarPicture(id).cells);
  const row = grid.findIndex((cells) => cells.includes(true));
  const column = grid[row]?.indexOf(true) ?? -1;
  const screen = await renderAvatar({ ...PERSON, id });
  const picture = await screenshot(screen.getByRole("figure"));

  expect(picture.at(1 + column, 1 + row)).toBe(color);
});

test("shows no seam between neighboring cells", async () => {
  const screen = await renderAvatar(PERSON);
  const picture = await screenshot(screen.getByRole("figure"));
  const unit = picture.width / 6;
  // Along row 3, across the cells of columns 0 and 1, and down column 0,
  // across the cells of rows 1 to 3, one pixel at a time.
  const across = Array.from({ length: Math.floor(1.8 * unit) }, (_, i) =>
    picture.at(0.6 + i / unit, 4),
  );
  const down = Array.from({ length: Math.floor(2.8 * unit) }, (_, i) =>
    picture.at(1, 1.6 + i / unit),
  );

  expect(new Set(across)).toEqual(new Set([COLOR]));
  expect(new Set(down)).toEqual(new Set([COLOR]));
});

test("is the same picture in the dark theme", async () => {
  document.documentElement.dataset.theme = "dark";
  const screen = await renderAvatar(PERSON);
  const picture = await screenshot(screen.getByRole("figure"));

  expect(cellColors(picture)).toEqual(expectedCells(COLOR, BACKGROUND));
  expect(picture.at(...CORNER)).toBe(CANVAS_DARK);
});

test.each([
  ["small", 24],
  ["medium", 32],
  ["large", 64],
] as const)("is %s, %i px", async (size, pixels) => {
  const screen = await renderAvatar(PERSON, size);
  const box = screen.getByRole("figure").element().getBoundingClientRect();

  expect([box.width, box.height]).toEqual([pixels, pixels]);
});

test("is hidden from assistive technologies", async () => {
  const screen = await render(<Avatar user={PERSON} size="large" />);

  expect(screen.getByRole("img").query()).toBeNull();
});

// The picture of an action without an actor, in place of an avatar.

const NEUTRAL_SOFT = "#eff2f5";
const NEUTRAL_ON_SOFT = "#3b434b";

function renderNoActor(size: AvatarSize = "large") {
  return render(
    <figure aria-label="Fictional system" className="inline-flex">
      <NoActorPicture size={size} />
    </figure>,
  );
}

test("draws the Sentinel mark on neutral-soft, with rounded corners, for no actor", async () => {
  const screen = await renderNoActor();
  const picture = await screenshot(screen.getByRole("figure"));
  const unit = picture.width / 6;
  // The centers of the pixels of the mark, darker than neutral-soft, in the
  // units of the picture, and how many of them are neutral-on-soft.
  const mark: [number, number][] = [];
  let onSoft = 0;
  for (let j = 0; j < picture.height; j++) {
    for (let i = 0; i < picture.width; i++) {
      const point: [number, number] = [(i + 0.5) / unit, (j + 0.5) / unit];
      const color = picture.at(...point);
      if (Number.parseInt(color.slice(1, 3), 16) < 0x90) {
        mark.push(point);
      }
      if (color === NEUTRAL_ON_SOFT) {
        onSoft++;
      }
    }
  }

  expect(picture.at(...SIDE)).toBe(NEUTRAL_SOFT);
  expect(picture.at(...CORNER)).toBe(NEUTRAL_SOFT);
  expect(picture.at(0.05, 0.05)).toBe(CANVAS_LIGHT);
  expect(onSoft).toBeGreaterThan(50);
  // The mark is 70 % of the size, centered: within 0.9 units of each side.
  expect(mark.filter(([x, y]) => Math.min(x, y, 6 - x, 6 - y) < 0.9)).toEqual(
    [],
  );
});

test.each([
  ["small", 24],
  ["medium", 32],
  ["large", 64],
] as const)("for no actor is %s, %i px", async (size, pixels) => {
  const screen = await renderNoActor(size);
  const box = screen.getByRole("figure").element().getBoundingClientRect();

  expect([box.width, box.height]).toEqual([pixels, pixels]);
});

test("for no actor is hidden from assistive technologies", async () => {
  const screen = await render(<NoActorPicture size="large" />);

  expect(screen.getByRole("img").query()).toBeNull();
});
