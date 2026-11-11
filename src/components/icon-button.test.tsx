import { RefreshCw, X } from "lucide-react";
import { afterEach, expect, test, vi } from "vitest";
import { commands, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot } from "../test-screenshot";
import { Button } from "./button";
import { IconButton } from "./icon-button";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reduce: boolean) => Promise<void>;
  }
}

// A quiet button with an icon alone (docs/design-system.md, Buttons and
// Links). The medium icon, at 18 px, shows in the reference screenshots of
// the sidebar (test/e2e/screenshots/ticket-list.png).

afterEach(async () => {
  vi.restoreAllMocks();
  await commands.emulateReducedMotion(false);
});

// The names of the animations that run in an element and its descendants.
function animationsIn(element: Element): string[] {
  return element
    .getAnimations({ subtree: true })
    .map((animation) =>
      animation instanceof CSSAnimation ? animation.animationName : "",
    );
}

test.each([
  ["inline", 24],
  ["small", 24],
  ["medium", 32],
] as const)(
  "is named by its label, with its icon hidden from assistive technologies: %s, a target of %i px",
  async (size, target) => {
    const screen = await render(
      <IconButton label="Dismiss" icon={X} size={size} onPress={() => {}} />,
    );
    const button = screen.getByRole("button", { name: "Dismiss" });

    await expect.element(button).toBeVisible();
    const box = button.element().getBoundingClientRect();
    expect([box.width, box.height]).toEqual([target, target]);
    expect(button.getByRole("img").query()).toBeNull();
    expect(button.element().textContent).toBe("");
  },
);

// How many rows of pixels of its target an icon button draws in.
async function drawnRows(size: "inline" | "small"): Promise<number> {
  const screen = await render(
    <IconButton
      label={`Refetch ${size}`}
      icon={RefreshCw}
      size={size}
      onPress={() => {}}
    />,
  );
  const picture = await screenshot(
    screen.getByRole("button", { name: `Refetch ${size}` }),
  );
  const background = picture.at(0, 0);
  return Array.from({ length: picture.height }, (_, y) => y).filter((y) =>
    Array.from({ length: picture.width }, (__, x) => x).some(
      (x) => picture.at(x + 0.5, y + 0.5) !== background,
    ),
  ).length;
}

test("draws the icon of an inline button at 14 px, smaller than the 16 px of a small one, in the same target", async () => {
  const inline = await drawnRows("inline");
  const small = await drawnRows("small");

  // RefreshCw draws in about five sixths of the height of its box.
  expect(inline).toBeLessThanOrEqual(14);
  expect(small).toBeGreaterThan(inline);
});

test("acts when pressed", async () => {
  const press = vi.fn();
  const screen = await render(
    <IconButton label="Dismiss" icon={X} size="small" onPress={press} />,
  );

  await screen.getByRole("button", { name: "Dismiss" }).click();

  expect(press).toHaveBeenCalledTimes(1);
});

test("shows its name in a tooltip", async () => {
  const screen = await render(
    <>
      <Button>Before</Button>
      <IconButton label="Dismiss" icon={X} size="small" onPress={() => {}} />
    </>,
  );
  await screen.getByRole("button", { name: "Before" }).click();

  await userEvent.keyboard("{Tab}");

  await expect
    .element(screen.getByRole("tooltip", { name: "Dismiss" }))
    .toBeVisible();
});

test("keeps its name and the focus while busy, turns its spinner in place of its icon, and cannot be pressed", async () => {
  const press = vi.fn();
  const screen = await render(
    <IconButton
      label="Refetch NVD"
      icon={RefreshCw}
      size="inline"
      isBusy
      onPress={press}
    />,
  );
  const button = screen.getByRole("button", { name: "Refetch NVD" });
  button.element().focus();

  await expect.element(button).toHaveAttribute("aria-disabled", "true");
  expect(animationsIn(button.element())).toEqual(["spin"]);
  await userEvent.keyboard("{Enter}");
  await button.click({ force: true });

  await expect.element(button).toHaveFocus();
  expect(press).not.toHaveBeenCalled();
  expect(button.element().getBoundingClientRect().width).toBe(24);

  await commands.emulateReducedMotion(true);

  expect(animationsIn(button.element())).toEqual([]);
});

test("acts and shows no spinner while it is not busy", async () => {
  const press = vi.fn();
  const screen = await render(
    <IconButton
      label="Refetch NVD"
      icon={RefreshCw}
      size="inline"
      onPress={press}
    />,
  );
  const button = screen.getByRole("button", { name: "Refetch NVD" });

  await button.click();

  await expect.element(button).not.toHaveAttribute("aria-disabled");
  expect(animationsIn(button.element())).toEqual([]);
  expect(press).toHaveBeenCalledTimes(1);
});

test.each([
  ["no element", false],
  ["another button", true],
])(
  "leaves the focus where it was, on %s, when the pointer presses it while it prevents the focus on a press",
  async (_, focused) => {
    const press = vi.fn();
    const screen = await render(
      <>
        <Button>Before</Button>
        <IconButton
          label="Refetch NVD"
          icon={RefreshCw}
          size="inline"
          preventFocusOnPress
          onPress={press}
        />
      </>,
    );
    const before = screen.getByRole("button", { name: "Before" });
    if (focused) {
      before.element().focus();
    }
    const active = document.activeElement;

    await screen.getByRole("button", { name: "Refetch NVD" }).click();

    expect(press).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(active);
  },
);
