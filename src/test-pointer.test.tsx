import { Button } from "react-aria-components";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "./styles.css";
import { pointerAwayFrom } from "./test-pointer";

// The move of the pointer away from an element whose colors change under the
// pointer, in the light theme.

// canvas and neutral-soft of the light theme.
const CANVAS = "rgb(246, 248, 250)";
const NEUTRAL_SOFT = "rgb(239, 242, 245)";

test.each([
  ["the top left corner", "top-0 left-0 size-24"],
  ["the top right corner", "top-0 right-0 size-24"],
  ["the bottom left corner", "bottom-0 left-0 size-24"],
  ["both top corners", "inset-x-0 top-0 h-24"],
])(
  "moves the pointer off an element over %s of the window, which then shows its own colors",
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

    await pointerAwayFrom(box);

    expect(getComputedStyle(box.element()).backgroundColor).toBe(CANVAS);
  },
);

test("returns once the page shows an element of React Aria that the pointer left without its state under the pointer", async () => {
  const screen = await render(
    <Button className="fixed top-0 left-0 size-24 bg-canvas data-hovered:bg-neutral-soft">
      Press
    </Button>,
  );
  const button = screen.getByRole("button", { name: "Press" });
  await button.hover();
  await expect.element(button).toHaveAttribute("data-hovered", "true");

  await pointerAwayFrom(button);

  expect(button.element().hasAttribute("data-hovered")).toBe(false);
  expect(getComputedStyle(button.element()).backgroundColor).toBe(CANVAS);
});
