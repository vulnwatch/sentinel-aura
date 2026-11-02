import { X } from "lucide-react";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { TOOLTIP_DELAY_MS } from "./tooltip";

// A quiet button with an icon alone (docs/design-system.md, Buttons and
// Links), with its tooltip (Menus, Popovers, and Tooltips).

afterEach(() => {
  vi.restoreAllMocks();
});

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

test.each([
  ["small", 24, 16],
  ["medium", 32, 18],
] as const)(
  "is named by its label, with an icon hidden from assistive technologies: %s, a target of %i px",
  async (size, target, icon) => {
    const screen = await render(
      <IconButton label="Dismiss" icon={X} size={size} onPress={() => {}} />,
    );
    const button = screen.getByRole("button", { name: "Dismiss" });

    await expect.element(button).toBeVisible();
    const box = button.element().getBoundingClientRect();
    expect([box.width, box.height]).toEqual([target, target]);
    const svg = button.element().querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getBoundingClientRect().width).toBe(icon);
  },
);

test("acts when pressed", async () => {
  const press = vi.fn();
  const screen = await render(
    <IconButton label="Dismiss" icon={X} size="small" onPress={press} />,
  );

  await screen.getByRole("button", { name: "Dismiss" }).click();

  expect(press).toHaveBeenCalledTimes(1);
});

test("shows its name in a tooltip at once on keyboard focus, which Escape hides", async () => {
  const screen = await render(
    <>
      <Button>Before</Button>
      <IconButton label="Dismiss" icon={X} size="small" onPress={() => {}} />
    </>,
  );
  await screen.getByRole("button", { name: "Before" }).click();

  await userEvent.keyboard("{Tab}");

  await expect
    .element(screen.getByRole("button", { name: "Dismiss" }))
    .toHaveFocus();
  const tooltip = screen.getByRole("tooltip", { name: "Dismiss" });
  await expect.element(tooltip).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(tooltip).not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("button", { name: "Dismiss" }))
    .toHaveFocus();
});

test("shows its tooltip after the pointer has rested on it, and keeps it while the pointer is over the tooltip", async () => {
  const screen = await render(
    <>
      <Button>Before</Button>
      <IconButton label="Dismiss" icon={X} size="small" onPress={() => {}} />
    </>,
  );
  const button = screen.getByRole("button", { name: "Dismiss" });
  await expect.element(button).toBeVisible();
  // React Aria shows a tooltip on hover once the user works with a pointer,
  // as a click shows, and at once while another tooltip has just closed.
  await screen.getByRole("button", { name: "Before" }).click();
  await wait(1000);

  await button.hover();

  const tooltip = screen.getByRole("tooltip", { name: "Dismiss" });
  // Not yet a third of the delay later.
  await wait(TOOLTIP_DELAY_MS / 3);
  expect(tooltip.query()).toBeNull();
  await expect.element(tooltip).toBeVisible();
  await tooltip.hover();
  await wait(1000);
  await expect.element(tooltip).toBeVisible();
});

test("shows its tooltip with the colors of text inverted", async () => {
  const screen = await render(
    <>
      <Button>Before</Button>
      <IconButton label="Dismiss" icon={X} size="small" onPress={() => {}} />
    </>,
  );
  await screen.getByRole("button", { name: "Before" }).click();
  await userEvent.keyboard("{Tab}");
  const tooltip = screen.getByRole("tooltip", { name: "Dismiss" });
  await expect.element(tooltip).toBeVisible();

  const style = getComputedStyle(tooltip.element());
  // fg and surface of the light theme.
  expect(style.backgroundColor).toBe("rgb(31, 35, 40)");
  expect(style.color).toBe("rgb(255, 255, 255)");
  expect(style.fontSize).toBe("13px");
});
