import { afterEach, expect, test, vi } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot } from "../test-screenshot";
import { Button } from "./button";
import { MESSAGE_TIMEOUT_MS } from "./message-area";
import { Message, type MessageTone } from "./message";
import { applyThemePreference } from "../theme";

afterEach(() => {
  applyThemePreference("system");
});

// Waits until the browser has rendered two more frames.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

// The colors of a success message in the light theme: its soft background,
// and the on-soft color of its text, its icon, and its line of the time left
// (docs/design-system.md, Tones), and the border line.
const SUCCESS_SOFT = "#dafbe1";
const SUCCESS_ON_SOFT = "#0f5323";
const BORDER = "#d8dee4";

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
  const text = screen.getByText("This couldn't be updated.");
  const reference = screen.getByText(
    "Reference: 01890a5d-ac96-774b-bcce-b302099a8057",
  );

  await expect.element(reference).toBeVisible();
  expect(
    reference.element().getBoundingClientRect().top,
  ).toBeGreaterThanOrEqual(text.element().getBoundingClientRect().bottom);
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

test("ends with Dismiss, a target of 24 px, when it can be dismissed", async () => {
  const dismiss = vi.fn();
  const screen = await render(
    <Message tone="danger" onDismiss={dismiss}>
      Sentinel isn't available right now.
    </Message>,
  );
  const button = screen.getByRole("button", { name: "Dismiss" });
  await expect.element(button).toBeVisible();
  const box = button.element().getBoundingClientRect();
  const text = screen.getByText("Sentinel isn't available right now.");

  expect([box.width, box.height]).toEqual([24, 24]);
  expect(box.left).toBeGreaterThan(
    text.element().getBoundingClientRect().right,
  );
  await button.click();
  expect(dismiss).toHaveBeenCalledTimes(1);
});

test("has no Dismiss unless it can be dismissed", async () => {
  const screen = await render(
    <Message tone="danger">Sentinel isn't available right now.</Message>,
  );

  await expect
    .element(screen.getByText("Sentinel isn't available right now."))
    .toBeVisible();
  expect(screen.getByRole("button").query()).toBeNull();
});

test("leaves the focus where it was when the pointer presses Dismiss, also where no element had it", async () => {
  const dismiss = vi.fn();
  const screen = await render(
    <>
      <Button>Edit priority</Button>
      <Message tone="danger" onDismiss={dismiss}>
        Sentinel isn't available right now.
      </Message>
    </>,
  );
  const before = screen.getByRole("button", { name: "Edit priority" });
  const button = screen.getByRole("button", { name: "Dismiss" });
  before.element().focus();

  await button.click();

  expect(dismiss).toHaveBeenCalledTimes(1);
  await expect.element(before).toHaveFocus();
  before.element().blur();
  await button.click();
  expect(dismiss).toHaveBeenCalledTimes(2);
  await nextFrames();
  expect(document.activeElement).toBe(document.body);
});

test("floats in the message area with a border line and the shadow of a popover, and has neither elsewhere", async () => {
  applyThemePreference("light");
  const screen = await render(
    <>
      <Message tone="success" floating focusable>
        API key revoked.
      </Message>
      <Message tone="success" focusable>
        Refetch started.
      </Message>
    </>,
  );
  const floating = getComputedStyle(
    screen.getByRole("group", { name: "API key revoked." }).element(),
  );
  const inPlace = getComputedStyle(
    screen.getByRole("group", { name: "Refetch started." }).element(),
  );

  // border of the light theme, and shadow-lg.
  expect([
    floating.borderTopWidth,
    floating.borderTopStyle,
    floating.borderTopColor,
  ]).toEqual(["1px", "solid", "rgb(216, 222, 228)"]);
  expect(floating.boxShadow).toContain("0px 10px 15px -3px");
  expect(floating.boxShadow).toContain("0px 4px 6px -4px");
  expect([inPlace.borderTopWidth, inPlace.boxShadow]).toEqual(["0px", "none"]);
});

// The colors of the top edge of a message, inside its border line, where the
// line of the time left shows, at the points of its width that the test
// gives, in CSS pixels from its start, or from its end where negative.
async function topEdge(message: Locator, ...points: number[]) {
  const picture = await screenshot(message);
  return points.map((x) => picture.at(x < 0 ? picture.width + x : x, 2));
}

// The line of the time left of a message, which an animation shortens.
function lineOf(message: Locator): CSSAnimation {
  const animations = message.element().getAnimations({ subtree: true });
  const [line] = animations;
  if (animations.length !== 1 || !(line instanceof CSSAnimation)) {
    throw new Error("The message shows no line of the time left");
  }
  return line;
}

test("shows the time left of a floating message that goes on its own as a line 2 px high in its on-soft color along its top edge, which shortens from the whole width toward the start in the time of the countdown", async () => {
  applyThemePreference("light");
  const screen = await render(
    <Message tone="success" floating focusable countdown={{ paused: false }}>
      API key revoked.
    </Message>,
  );
  const message = screen.getByRole("group", { name: "API key revoked." });
  await expect.element(message).toBeVisible();
  const line = lineOf(message);
  expect([line.animationName, line.playState]).toEqual([
    "countdown",
    "running",
  ]);
  expect(line.effect?.getComputedTiming().duration).toBe(MESSAGE_TIMEOUT_MS);

  // As the countdown starts, and halfway through it, which the test holds.
  line.pause();
  line.currentTime = 0;
  const start = await screenshot(message);

  expect(
    [8, start.width / 2, start.width - 8].map((x) => start.at(x, 2)),
  ).toEqual([SUCCESS_ON_SOFT, SUCCESS_ON_SOFT, SUCCESS_ON_SOFT]);
  // Inside the border line, and 2 px high.
  expect(start.at(start.width / 2, 0)).toBe(BORDER);
  expect(start.at(start.width / 2, 3)).toBe(SUCCESS_SOFT);
  line.currentTime = MESSAGE_TIMEOUT_MS / 2;
  const half = await screenshot(message);
  expect([
    half.at(half.width / 4, 2),
    half.at((3 * half.width) / 4, 2),
  ]).toEqual([SUCCESS_ON_SOFT, SUCCESS_SOFT]);
});

test("stops its line where it is while the countdown waits", async () => {
  const screen = await render(
    <Message tone="success" floating focusable countdown={{ paused: true }}>
      API key revoked.
    </Message>,
  );
  const message = screen.getByRole("group", { name: "API key revoked." });
  await expect.element(message).toBeVisible();
  const line = lineOf(message);
  const at = line.currentTime;

  await nextFrames();

  expect(line.playState).toBe("paused");
  expect(line.currentTime).toBe(at);
  await screen.rerender(
    <Message tone="success" floating focusable countdown={{ paused: false }}>
      API key revoked.
    </Message>,
  );
  await expect.poll(() => lineOf(message).playState).toBe("running");
  expect(lineOf(message)).toBe(line);
});

test.each([
  ["a floating message that stays until it is dismissed", true, undefined],
  ["a message outside the message area", false, { paused: false }],
])("shows no line of the time left for %s", async (_, floating, countdown) => {
  applyThemePreference("light");
  const screen = await render(
    <Message tone="success" floating={floating} focusable countdown={countdown}>
      API key revoked.
    </Message>,
  );
  const message = screen.getByRole("group", { name: "API key revoked." });
  await expect.element(message).toBeVisible();

  expect(message.element().getAnimations({ subtree: true })).toEqual([]);
  expect(await topEdge(message, 8, -8)).toEqual([SUCCESS_SOFT, SUCCESS_SOFT]);
});

test("takes the focus itself where it can, as a group named by its words, outside the order of Tab", async () => {
  const screen = await render(
    <>
      <Button>Edit priority</Button>
      <Message
        tone="danger"
        focusable
        reference="01890a5d-ac96-774b-bcce-b302099a8057"
        onDismiss={() => {}}
      >
        Sentinel isn't available right now.
      </Message>
    </>,
  );
  const message = screen.getByRole("group");

  await expect
    .element(message)
    .toHaveAccessibleName(
      "Sentinel isn't available right now. Reference: 01890a5d-ac96-774b-bcce-b302099a8057",
    );
  message.element().focus();
  await expect.element(message).toHaveFocus();
  screen.getByRole("button", { name: "Edit priority" }).element().focus();
  await userEvent.keyboard("{Tab}");
  await expect
    .element(screen.getByRole("button", { name: "Dismiss" }))
    .toHaveFocus();
});

test("is no group, and does not take the focus itself, unless it can", async () => {
  const screen = await render(
    <Message tone="danger">Sentinel isn't available right now.</Message>,
  );
  const text = screen.getByText("Sentinel isn't available right now.");
  await expect.element(text).toBeVisible();
  expect(document.activeElement).toBe(document.body);

  // A press of the pointer focuses the nearest element around it that can
  // take the focus, which a message that can take it would be.
  await text.click();

  expect(screen.getByRole("group").query()).toBeNull();
  expect(document.activeElement).toBe(document.body);
});
