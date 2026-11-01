import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Message, type MessageTone } from "./message";
import { Reference } from "./reference";
import { applyThemePreference } from "../theme";

afterEach(() => {
  applyThemePreference("system");
});

// The color behind an element: the background of the nearest element, itself
// or one that contains it, that has one.
function backgroundBehind(element: Element): string {
  for (
    let current: Element | null = element;
    current;
    current = current.parentElement
  ) {
    const background = getComputedStyle(current).backgroundColor;
    if (background !== "rgba(0, 0, 0, 0)") {
      return background;
    }
  }
  return "transparent";
}

// The background of each tone in the light theme (docs/design-system.md,
// Tones), as the browser computes it.
const TONES: [MessageTone, string][] = [
  ["success", "rgb(218, 251, 225)"],
  ["info", "rgb(221, 244, 255)"],
  ["warning", "rgb(255, 248, 197)"],
  ["danger", "rgb(255, 235, 233)"],
];

test.each(TONES)(
  "shows a %s message in the soft background of its tone, with its icon hidden from assistive technologies",
  async (tone, background) => {
    applyThemePreference("light");
    const screen = await render(
      <Message tone={tone}>Sentinel isn't available right now.</Message>,
    );
    const text = screen.getByText("Sentinel isn't available right now.");

    await expect.element(text).toBeVisible();
    expect(backgroundBehind(text.element())).toBe(background);
    expect(screen.getByRole("img").query()).toBeNull();
  },
);

test("follows the text with the reference of an error on its own line", async () => {
  const screen = await render(
    <Message tone="warning" reference="01890a5d-ac96-774b-bcce-b302099a8057">
      This couldn't be updated.
    </Message>,
  );

  await expect
    .element(
      screen.getByText("Reference: 01890a5d-ac96-774b-bcce-b302099a8057"),
    )
    .toBeVisible();
});

test("shows no reference without a request identifier", async () => {
  const screen = await render(
    <Message tone="warning">This couldn't be updated.</Message>,
  );

  await expect
    .element(screen.getByText("This couldn't be updated."))
    .toBeVisible();
  expect(screen.getByText(/Reference/).query()).toBeNull();
});

test("shows the identifier of a reference in monospace", async () => {
  const screen = await render(
    <Reference requestId="01890a5d-ac96-774b-bcce-b302099a8057" />,
  );
  const identifier = screen.getByText("01890a5d-ac96-774b-bcce-b302099a8057", {
    exact: true,
  });

  await expect.element(identifier).toBeVisible();
  expect(getComputedStyle(identifier.element()).fontFamily).toBe(
    "ui-monospace, monospace",
  );
});
