import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { pointerAwayFrom } from "../test-pointer";
import { ChoiceMenu, type Choice } from "./choice-menu";

// A select of a value of a record whose choice applies at once
// (docs/design-system.md, Forms; Menus, Popovers, and Tooltips), at a wide
// window, in the light theme.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

const CHOICES: Choice[] = [
  { id: "analysis", textValue: "Analysis", content: "Analysis" },
  { id: "affected", textValue: "Affected", content: "Affected" },
  { id: "not_affected", textValue: "Not affected", content: "Not affected" },
];

interface MenuProps {
  busy?: string | null;
  onChoose?: (id: string) => void;
  choices?: Choice[];
}

// The select, open or closed as the user leaves it, with the value Affected.
function Menu({
  busy = null,
  onChoose = () => undefined,
  choices = CHOICES,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <ChoiceMenu
      label="Affectedness of fictional-openssl, SUSE:FLES-15-SP7:Update: Affected"
      value="Affected"
      choices={choices}
      chosen="affected"
      busy={busy}
      busyText="Changing the affectedness."
      isOpen={open}
      onOpenChange={setOpen}
      onChoose={onChoose}
    />
  );
}

test("opens its choices as a menu named by its button, the value chosen checked, and applies another choice", async () => {
  const onChoose = vi.fn<(id: string) => void>();
  const screen = await render(<Menu onChoose={onChoose} />);
  const button = screen.getByRole("button", {
    name: "Affectedness of fictional-openssl, SUSE:FLES-15-SP7:Update: Affected",
  });
  await expect.element(button).toHaveTextContent("Affected");

  await button.click();

  const menu = screen.getByRole("menu", {
    name: "Affectedness of fictional-openssl, SUSE:FLES-15-SP7:Update: Affected",
  });
  await expect.element(menu).toBeVisible();
  await expect
    .element(menu.getByRole("menuitemradio", { name: "Affected", exact: true }))
    .toBeChecked();
  await menu.getByRole("menuitemradio", { name: "Not affected" }).click();
  expect(onChoose).toHaveBeenCalledExactlyOnceWith("not_affected");
});

test("changes nothing while the user types on the button closed", async () => {
  const onChoose = vi.fn<(id: string) => void>();
  const screen = await render(<Menu onChoose={onChoose} />);
  const button = screen.getByRole("button");
  button.element().focus();

  await userEvent.keyboard("n");

  await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
  expect(onChoose).not.toHaveBeenCalled();
});

test("closes without a choice when the user chooses the value chosen", async () => {
  const onChoose = vi.fn<(id: string) => void>();
  const screen = await render(<Menu onChoose={onChoose} />);
  await screen.getByRole("button").click();

  await screen
    .getByRole("menuitemradio", { name: "Affected", exact: true })
    .click();

  await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
  expect(onChoose).not.toHaveBeenCalled();
});

test("marks the choice whose change is in progress as busy and the others unavailable, takes no other choice, and cannot be closed", async () => {
  const onChoose = vi.fn<(id: string) => void>();
  const { rerender, ...screen } = await render(<Menu onChoose={onChoose} />);
  await screen.getByRole("button").click();
  await rerender(<Menu busy="not_affected" onChoose={onChoose} />);

  const busy = screen.getByRole("menuitemradio", { name: "Not affected" });
  await expect
    .element(busy)
    .toHaveAccessibleDescription("Changing the affectedness.");
  await expect.element(busy).not.toHaveAttribute("aria-disabled");
  for (const name of ["Analysis", "Affected"]) {
    const other = screen.getByRole("menuitemradio", { name, exact: true });
    await expect.element(other).toHaveAttribute("aria-disabled", "true");
    expect(getComputedStyle(other.element()).opacity).toBe("0.6");
  }
  // The arrow keys pass over the others, and a press on one does nothing.
  busy.element().focus();
  await userEvent.keyboard("{ArrowDown}");
  await expect.element(busy).toHaveFocus();
  await userEvent.keyboard("{ArrowUp}");
  await expect.element(busy).toHaveFocus();
  await screen
    .getByRole("menuitemradio", { name: "Analysis" })
    .click({ force: true });
  await userEvent.keyboard("{Escape}");

  await expect.element(screen.getByRole("menu")).toBeVisible();
  expect(onChoose).not.toHaveBeenCalled();

  await rerender(<Menu onChoose={onChoose} />);

  await expect
    .element(screen.getByRole("menuitemradio", { name: "Analysis" }))
    .not.toHaveAttribute("aria-disabled");
});

test("shows the focus ring inside the menu when the menu holds the focus itself, as when a read removes the choice that held it", async () => {
  const { rerender, ...screen } = await render(<Menu />);
  screen.getByRole("button").element().focus();
  await userEvent.keyboard("{Enter}");
  const analysis = screen.getByRole("menuitemradio", { name: "Analysis" });
  analysis.element().focus();
  await userEvent.keyboard("{ArrowUp}{ArrowDown}");
  await expect.element(analysis).toHaveFocus();

  await rerender(<Menu choices={CHOICES.slice(1)} />);

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

test("is a quiet button 28 px high, without a boundary or a fill, in fg", async () => {
  const screen = await render(
    <div className="text-fg-muted">
      <Menu />
    </div>,
  );
  const button = screen.getByRole("button").element();
  await expect.element(screen.getByRole("button")).toBeVisible();
  // The pointer away from the button, where an earlier test can leave it.
  await pointerAwayFrom(screen.getByRole("button"));
  const style = getComputedStyle(button);
  expect(button.getBoundingClientRect().height).toBe(28);
  expect(style.borderTopWidth).toBe("0px");
  expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(style.color).toBe("rgb(31, 35, 40)");
});
