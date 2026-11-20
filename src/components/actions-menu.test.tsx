import { Ban } from "lucide-react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { ActionsMenu } from "./actions-menu";
import { MenuAction } from "./menu";

// The menu of the other actions of a record (docs/design-system.md, Menus,
// Popovers, and Tooltips), at a wide window, in the light theme.

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
