import { ChevronDown, RefreshCw } from "lucide-react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { commands, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { pointerAwayFrom } from "../test-pointer";
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

test("shows its icon at 16 px before its label, 8 px apart, hidden from assistive technologies", async () => {
  const screen = await render(
    <>
      <Button size="small" icon={RefreshCw}>
        Refetch all
      </Button>
      <Button size="small">Refetch all</Button>
    </>,
  );
  const [withIcon, without] = screen
    .getByRole("button", { name: "Refetch all" })
    .elements();

  // The icon of 16 px and the space of 8 px after it.
  expect(
    withIcon!.getBoundingClientRect().width -
      without!.getBoundingClientRect().width,
  ).toBe(24);
  expect(screen.getByRole("img").query()).toBeNull();
});

test("shows its end icon at 16 px after its label, 8 px apart, hidden from assistive technologies, without changing its name", async () => {
  const screen = await render(
    <>
      <Button endIcon={ChevronDown}>Actions</Button>
      <Button>Actions</Button>
    </>,
  );
  const [withIcon, without] = screen
    .getByRole("button", { name: "Actions", exact: true })
    .elements();
  const chevron = await render(<ChevronDown />);

  // The space of 8 px before the icon and the icon of 16 px.
  expect(
    withIcon!.getBoundingClientRect().width -
      without!.getBoundingClientRect().width,
  ).toBe(24);
  const icon = withIcon!.querySelector("svg");
  expect(icon?.innerHTML).toBe(
    chevron.container.querySelector("svg")?.innerHTML,
  );
  // At the end of the button, within its side padding of 12 px and its
  // line, after the label.
  expect(icon!.getBoundingClientRect().width).toBe(16);
  expect(icon!.getBoundingClientRect().right).toBe(
    withIcon!.getBoundingClientRect().right - 12 - 1,
  );
  expect(icon!.previousSibling?.textContent).toBe("Actions");
  expect(icon!.getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByRole("img").query()).toBeNull();
});

test("shows its icon before its label and its end icon after it", async () => {
  const screen = await render(
    <Button icon={RefreshCw} endIcon={ChevronDown}>
      Refetch all
    </Button>,
  );
  const button = screen.getByRole("button", {
    name: "Refetch all",
    exact: true,
  });

  await expect.element(button).toBeVisible();
  const [first, last] = button.element().querySelectorAll("svg");
  // Within the side padding of 12 px and the line of 1 px of the button.
  const box = button.element().getBoundingClientRect();
  expect(first!.getBoundingClientRect().left).toBe(box.left + 12 + 1);
  expect(last!.getBoundingClientRect().right).toBe(box.right - 12 - 1);
  expect(button.element().textContent).toBe("Refetch all");
});

test("is 36 px high, in text-15, with 12 px of side padding", async () => {
  const screen = await render(<Button>Try again</Button>);
  const button = screen.getByRole("button", { name: "Try again" });

  await expect.element(button).toBeVisible();
  const style = getComputedStyle(button.element());
  expect(button.element().getBoundingClientRect().height).toBe(36);
  expect([style.fontSize, style.paddingLeft, style.paddingRight]).toEqual([
    "15px",
    "12px",
    "12px",
  ]);
});

test("is 40 px high, in text-15, with 16 px of side padding, in forms and dialogs", async () => {
  const screen = await render(<Button size="large">Sign in</Button>);
  const button = screen.getByRole("button", { name: "Sign in" });

  await expect.element(button).toBeVisible();
  expect(button.element().getBoundingClientRect().height).toBe(40);
  expect(getComputedStyle(button.element()).fontSize).toBe("15px");
  expect(getComputedStyle(button.element()).paddingLeft).toBe("16px");
});

test("is 32 px high, in text-14, with 12 px of side padding, in the toolbar of a list", async () => {
  const screen = await render(<Button size="small">Filters</Button>);
  const button = screen.getByRole("button", { name: "Filters" });

  await expect.element(button).toBeVisible();
  const style = getComputedStyle(button.element());
  expect(button.element().getBoundingClientRect().height).toBe(32);
  expect([style.fontSize, style.paddingLeft, style.paddingRight]).toEqual([
    "14px",
    "12px",
    "12px",
  ]);
});

// The fill and text of each variant (docs/design-system.md, Buttons and
// Links; Color Tokens), in the light theme of the default color scheme.
test.each([
  ["secondary", "rgb(255, 255, 255)", "rgb(31, 35, 40)", "1px"],
  ["primary", "rgb(9, 105, 218)", "rgb(255, 255, 255)", "0px"],
  ["quiet", "rgba(0, 0, 0, 0)", "rgb(31, 35, 40)", "0px"],
  ["danger", "rgb(207, 34, 46)", "rgb(255, 255, 255)", "0px"],
] as const)(
  "shows the %s variant in its colors",
  async (variant, background, color, border) => {
    const screen = await render(<Button variant={variant}>Sign in</Button>);
    const locator = screen.getByRole("button", { name: "Sign in" });
    // The pointer away from the button, where an earlier test can leave it.
    await pointerAwayFrom(locator);
    const button = locator.element();

    expect(getComputedStyle(button).backgroundColor).toBe(background);
    expect(getComputedStyle(button).color).toBe(color);
    expect(getComputedStyle(button).borderTopWidth).toBe(border);
  },
);

test("shows the quiet variant on surface-hover under the pointer", async () => {
  const screen = await render(<Button variant="quiet">Clear filters</Button>);
  const button = screen.getByRole("button", { name: "Clear filters" });
  await expect.element(button).toBeVisible();

  await userEvent.hover(button);

  await expect
    .poll(() => getComputedStyle(button.element()).backgroundColor)
    .toBe("rgb(243, 245, 248)");
  expect(getComputedStyle(button.element()).color).toBe("rgb(31, 35, 40)");
});

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

  test("shows its spinner in place of its icon, at the same width", async () => {
    const screen = await render(
      <>
        <Button size="small" icon={RefreshCw}>
          Refetch all
        </Button>
        <Button size="small" icon={RefreshCw} isBusy>
          Refetch all
        </Button>
      </>,
    );
    const [idle, busy] = screen
      .getByRole("button", { name: "Refetch all" })
      .elements();

    expect(animationsIn(idle!)).toEqual([]);
    expect(animationsIn(busy!)).toEqual(["spin"]);
    expect(busy!.getBoundingClientRect().width).toBe(
      idle!.getBoundingClientRect().width,
    );
  });

  test("shows no spinner while its action is not in progress", async () => {
    const screen = await render(<Button variant="primary">Sign in</Button>);
    const button = screen.getByRole("button", { name: "Sign in" });

    await expect.element(button).not.toHaveAttribute("aria-disabled");
    expect(animationsIn(button.element())).toEqual([]);
  });
});
