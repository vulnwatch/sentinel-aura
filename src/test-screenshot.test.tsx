import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "./styles.css";
import { FICTIONAL_PICTURE, FICTIONAL_PICTURE_COLOR } from "./test-api";
import { screenshot } from "./test-screenshot";

// The screenshot of an element whose colors change under the pointer, and of
// an element with pictures, in the light theme.

const CANVAS = "#f6f8fa";
const NEUTRAL_SOFT = "rgb(239, 242, 245)";

test.each([
  ["the top left corner", "top-0 left-0 size-24"],
  ["the top right corner", "top-0 right-0 size-24"],
  ["the bottom left corner", "bottom-0 left-0 size-24"],
  ["both top corners", "inset-x-0 top-0 h-24"],
])(
  "shows an element over %s of the window in its own colors, away from the pointer that rests on it",
  async (_, position) => {
    const screen = await render(
      <figure
        aria-label="Box"
        className={`fixed ${position} bg-canvas hover:bg-neutral-soft`}
      />,
    );
    const box = screen.getByRole("figure", { name: "Box" });
    await box.hover();
    await expect
      .poll(() => getComputedStyle(box.element()).backgroundColor)
      .toBe(NEUTRAL_SOFT);

    const picture = await screenshot(box);

    expect(picture.at(picture.width / 2, picture.height / 2)).toBe(CANVAS);
  },
);

test("shows a picture of an element, also beside a picture that fails to load", async () => {
  const screen = await render(
    <figure aria-label="Pictures" className="flex">
      <img alt="" src={FICTIONAL_PICTURE} className="size-16" />
      <img alt="" src="data:image/png;base64,AAAA" className="size-16" />
    </figure>,
  );

  const picture = await screenshot(screen.getByRole("figure"));

  expect(picture.at(32, 32)).toBe(FICTIONAL_PICTURE_COLOR);
});
