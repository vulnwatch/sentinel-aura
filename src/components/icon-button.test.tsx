import { X } from "lucide-react";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { IconButton } from "./icon-button";

// A quiet button with an icon alone (docs/design-system.md, Buttons and
// Links). The medium icon, at 18 px, shows in the reference screenshots of
// the sidebar (test/e2e/screenshots/home.png).

afterEach(() => {
  vi.restoreAllMocks();
});

test.each([
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
