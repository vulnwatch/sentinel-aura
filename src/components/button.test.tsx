import { afterEach, describe, expect, test, vi } from "vitest";
import { commands, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reduce: boolean) => Promise<void>;
  }
}

// The names of the animations that run in an element and its descendants.
function animationsIn(element: Element): string[] {
  return element
    .getAnimations({ subtree: true })
    .map((animation) =>
      animation instanceof CSSAnimation ? animation.animationName : "",
    );
}

test("performs its action when the user presses it", async () => {
  const onPress = vi.fn();
  const screen = await render(<Button onPress={onPress}>Try again</Button>);

  await screen.getByRole("button", { name: "Try again" }).click();

  expect(onPress).toHaveBeenCalledOnce();
});

test("performs its action from the keyboard", async () => {
  const onPress = vi.fn();
  await render(<Button onPress={onPress}>Try again</Button>);

  await userEvent.keyboard("{Tab}{Enter}");

  expect(onPress).toHaveBeenCalledOnce();
});

test("cannot be pressed while it is disabled", async () => {
  const onPress = vi.fn();
  const screen = await render(
    <Button onPress={onPress} isDisabled>
      Try again
    </Button>,
  );
  const button = screen.getByRole("button", { name: "Try again" });

  await expect.element(button).toBeDisabled();
  await button.click({ force: true });

  expect(onPress).not.toHaveBeenCalled();
});

test("is 36 px high", async () => {
  const screen = await render(<Button>Try again</Button>);
  const button = screen.getByRole("button", { name: "Try again" });

  await expect.element(button).toBeVisible();
  expect(button.element().getBoundingClientRect().height).toBe(36);
});

test("is 40 px high, with 16 px of side padding, in forms and dialogs", async () => {
  const screen = await render(<Button size="large">Sign in</Button>);
  const button = screen.getByRole("button", { name: "Sign in" });

  await expect.element(button).toBeVisible();
  expect(button.element().getBoundingClientRect().height).toBe(40);
  expect(getComputedStyle(button.element()).paddingLeft).toBe("16px");
});

// The fill and text of each variant (docs/design-system.md, Buttons and
// Links; Color Tokens), in the light theme of the default color scheme.
test.each([
  ["secondary", "rgb(255, 255, 255)", "rgb(31, 35, 40)", "1px"],
  ["primary", "rgb(9, 105, 218)", "rgb(255, 255, 255)", "0px"],
] as const)(
  "shows the %s variant in its colors",
  async (variant, background, color, border) => {
    const screen = await render(<Button variant={variant}>Sign in</Button>);
    const locator = screen.getByRole("button", { name: "Sign in" });
    // The pointer of an earlier test may rest where the button shows.
    await userEvent.unhover(locator);
    const button = locator.element();

    expect(getComputedStyle(button).backgroundColor).toBe(background);
    expect(getComputedStyle(button).color).toBe(color);
    expect(getComputedStyle(button).borderTopWidth).toBe(border);
  },
);

describe("busy", () => {
  afterEach(async () => {
    await commands.emulateReducedMotion(false);
  });

  test("keeps its label and the focus, turns its spinner, and cannot be pressed", async () => {
    const onPress = vi.fn();
    const screen = await render(
      <Button variant="primary" onPress={onPress} isBusy>
        Sign in
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Sign in" });

    await expect.element(button).toHaveAttribute("aria-disabled", "true");
    expect(animationsIn(button.element())).toEqual(["spin"]);
    await button.click({ force: true });
    await userEvent.keyboard("{Enter}");

    await expect.element(button).toHaveFocus();
    expect(onPress).not.toHaveBeenCalled();
  });

  test("does not submit its form", async () => {
    const onSubmit = vi.fn();
    const screen = await render(
      <form
        aria-label="Fictional form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Button type="submit" isBusy>
          Save
        </Button>
      </form>,
    );

    await screen.getByRole("button", { name: "Save" }).click({ force: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("stands its spinner still under reduced motion", async () => {
    const screen = await render(
      <Button variant="primary" isBusy>
        Sign in
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Sign in" });
    await expect.element(button).toBeVisible();

    await commands.emulateReducedMotion(true);

    expect(animationsIn(button.element())).toEqual([]);
  });

  test("shows no spinner while its action is not in progress", async () => {
    const screen = await render(<Button variant="primary">Sign in</Button>);
    const button = screen.getByRole("button", { name: "Sign in" });

    await expect.element(button).not.toHaveAttribute("aria-disabled");
    expect(animationsIn(button.element())).toEqual([]);
  });
});
