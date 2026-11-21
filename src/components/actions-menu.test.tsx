import { Ban, ChevronDown, CirclePlay } from "lucide-react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { pointerAwayFrom } from "../test-pointer";
import { ActionsMenu, ScreenActionsMenu } from "./actions-menu";
import { MenuAction } from "./menu";

// The menu of the other actions of a record (docs/design-system.md, Menus,
// Popovers, and Tooltips), and the menu of the actions of a detail screen
// (Detail Screens), at a wide window, in the light theme.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

interface MenuProps {
  busy?: boolean;
  onExclude?: () => void;
  // The id of the item.
  itemId?: string;
}

function Menu({
  busy = false,
  onExclude = () => undefined,
  itemId = "exclude",
}: MenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <ActionsMenu
      label="Actions of fictional-openssl"
      isOpen={open}
      onOpenChange={setOpen}
      busy={busy}
    >
      <MenuAction
        key={itemId}
        id={itemId}
        icon={Ban}
        busy={busy ? "Excluding." : undefined}
        shouldCloseOnSelect={false}
        onAction={onExclude}
      >
        Exclude
      </MenuAction>
    </ActionsMenu>
  );
}

test("is an icon button of 24 px named by its record, whose tooltip says Actions, which opens the actions as a menu of the same name", async () => {
  const onExclude = vi.fn<() => void>();
  const screen = await render(<Menu onExclude={onExclude} />);
  const button = screen.getByRole("button", {
    name: "Actions of fictional-openssl",
  });
  await expect.element(button).toBeVisible();
  expect(button.element().getBoundingClientRect().width).toBe(24);
  expect(button.element().getBoundingClientRect().height).toBe(24);
  // Keyboard focus shows the tooltip at once.
  await userEvent.keyboard("{Tab}");
  await expect.element(button).toHaveFocus();
  await expect
    .element(screen.getByRole("tooltip"))
    .toHaveTextContent("Actions");

  await button.click();

  const menu = screen.getByRole("menu", {
    name: "Actions of fictional-openssl",
  });
  await expect.element(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Exclude" }).click();
  expect(onExclude).toHaveBeenCalledOnce();
});

test("shows the focus ring inside the menu when the menu holds the focus itself, as when its item that held it leaves", async () => {
  const { rerender, ...screen } = await render(<Menu />);
  screen.getByRole("button").element().focus();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(screen.getByRole("menuitem", { name: "Exclude" }))
    .toHaveFocus();

  await rerender(<Menu itemId="another" />);

  const menu = screen.getByRole("menu");
  await expect.element(menu).toHaveFocus();
  const ring = getComputedStyle(menu.element());
  expect([ring.outlineStyle, ring.outlineWidth, ring.outlineOffset]).toEqual([
    "solid",
    "2px",
    "-2px",
  ]);
  expect(ring.outlineColor).toBe("rgb(9, 105, 218)");
});

// Waits until the browser has rendered two more frames, after which what a
// key or a press set has rendered.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

interface ScreenMenuProps {
  busy?: boolean;
  compact?: boolean;
  onReopen?: () => void;
}

function ScreenMenu({
  busy = false,
  compact = false,
  onReopen = () => undefined,
}: ScreenMenuProps) {
  const [open, setOpen] = useState(false);
  // In the middle of the window, so that the menu shows where its placement
  // puts it, not where the edge of the window pushes it.
  return (
    <div className="flex justify-center p-4">
      <ScreenActionsMenu
        label="Actions of SNTL-42"
        isOpen={open}
        onOpenChange={setOpen}
        busy={busy}
        compact={compact}
      >
        <MenuAction
          id="reopen"
          icon={CirclePlay}
          busy={busy ? "Reopening." : undefined}
          shouldCloseOnSelect={false}
          onAction={onReopen}
        >
          Reopen
        </MenuAction>
      </ScreenActionsMenu>
    </div>
  );
}

describe("the actions of a screen", () => {
  test("are a secondary button 36 px high that shows Actions, with chevron-down after it, named by its record, which opens them as a menu of the same name below its end", async () => {
    const onReopen = vi.fn<() => void>();
    const screen = await render(<ScreenMenu onReopen={onReopen} />);
    const chevron = await render(<ChevronDown />);
    const button = screen.getByRole("button", {
      name: "Actions of SNTL-42",
      exact: true,
    });
    await expect.element(button).toBeVisible();
    expect(button.element().textContent).toBe("Actions");
    expect(button.element().querySelector("svg")?.innerHTML).toBe(
      chevron.container.querySelector("svg")?.innerHTML,
    );
    const box = button.element().getBoundingClientRect();
    expect(box.height).toBe(36);
    // The pointer away from the button, where an earlier test can leave it.
    await pointerAwayFrom(button);
    const style = getComputedStyle(button.element());
    expect([style.backgroundColor, style.borderTopWidth]).toEqual([
      "rgb(255, 255, 255)",
      "1px",
    ]);

    await button.click();

    const menu = screen.getByRole("menu", {
      name: "Actions of SNTL-42",
      exact: true,
    });
    await expect.element(menu).toBeVisible();
    // Below the button, its end, within the padding and the line of the
    // menu, at the end of the button, and wider than the button: 176 px
    // wide, its least width, which its one short item does not reach.
    const items = menu.element().getBoundingClientRect();
    expect(items.top).toBeGreaterThan(box.bottom);
    expect(items.right).toBeLessThanOrEqual(box.right);
    expect(box.right - items.right).toBeLessThan(8);
    expect(items.left).toBeLessThan(box.left);
    expect(items.width).toBe(176);
    await menu.getByRole("menuitem", { name: "Reopen" }).click();
    expect(onReopen).toHaveBeenCalledOnce();
  });

  test("are a button 32 px high in text-14 in the compact heading", async () => {
    const screen = await render(<ScreenMenu compact />);
    const button = screen.getByRole("button", {
      name: "Actions of SNTL-42",
      exact: true,
    });

    await expect.element(button).toBeVisible();
    expect(button.element().getBoundingClientRect().height).toBe(32);
    expect(getComputedStyle(button.element()).fontSize).toBe("14px");
  });

  test("open and close their menu with the button while no change is in progress", async () => {
    const screen = await render(<ScreenMenu />);
    const button = screen.getByRole("button", {
      name: "Actions of SNTL-42",
      exact: true,
    });
    button.element().focus();

    await userEvent.keyboard("{Enter}");

    await expect
      .element(screen.getByRole("menuitem", { name: "Reopen" }))
      .toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    await expect.element(button).toHaveFocus();
  });

  test("cannot be closed while the change of an item is in progress, whose item is busy", async () => {
    const { rerender, ...screen } = await render(<ScreenMenu />);
    const button = screen
      .getByRole("button", { name: "Actions of SNTL-42", exact: true })
      .element();
    await screen.getByRole("button").click();
    await rerender(<ScreenMenu busy />);

    await expect
      .element(screen.getByRole("menuitem", { name: "Reopen" }))
      .toHaveAccessibleDescription("Reopening.");

    await userEvent.keyboard("{Escape}");
    await nextFrames();
    expect(screen.getByRole("menu").query()).not.toBeNull();
    // A press of the button, which the open menu covers.
    await userEvent.click(button, { force: true });
    await nextFrames();
    expect(screen.getByRole("menu").query()).not.toBeNull();

    await expect.element(screen.getByRole("menu")).toBeVisible();

    await rerender(<ScreenMenu />);
    await userEvent.keyboard("{Escape}");

    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
  });
});

test("cannot be closed while the change of an item is in progress, whose item is busy", async () => {
  const { rerender, ...screen } = await render(<Menu />);
  await screen.getByRole("button").click();
  await rerender(<Menu busy />);

  await expect
    .element(screen.getByRole("menuitem", { name: "Exclude" }))
    .toHaveAccessibleDescription("Excluding.");
  await userEvent.keyboard("{Escape}");

  await expect.element(screen.getByRole("menu")).toBeVisible();

  await rerender(<Menu />);
  await userEvent.keyboard("{Escape}");

  await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
});
