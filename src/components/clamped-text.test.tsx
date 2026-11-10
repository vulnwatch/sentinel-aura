import { afterEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { ClampedText } from "./clamped-text";

// The description of a record on its detail screen, cut to four lines with
// Show more (docs/design-system.md, Main Content), at the browser's default
// text size, in the light theme.

afterEach(async () => {
  await page.viewport(414, 896);
});

// link of the light theme.
const LINK = "rgb(9, 105, 218)";

const LONG_TEXT = Array.from(
  { length: 40 },
  (_, index) => `Fictional sentence ${index + 1} of a long description.`,
).join(" ");

// The height of a line of text-15.
const LINE = 24;

test("cuts a longer text to its first four lines, with Show more below them, which shows it whole and becomes Show less", async () => {
  await page.viewport(1280, 800);
  const screen = await render(<ClampedText>{LONG_TEXT}</ClampedText>);
  const text = screen.getByText(LONG_TEXT).element();
  const more = screen.getByRole("button", { name: "Show more" });

  await expect.element(more).toHaveAttribute("aria-expanded", "false");
  expect(text.getBoundingClientRect().height).toBe(4 * LINE);
  // Running text, at most 720 px wide.
  expect(text.getBoundingClientRect().width).toBeLessThanOrEqual(720);
  expect(more.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
    text.getBoundingClientRect().bottom,
  );

  await more.click();

  const less = screen.getByRole("button", { name: "Show less" });
  await expect.element(less).toHaveAttribute("aria-expanded", "true");
  expect(text.getBoundingClientRect().height).toBeGreaterThan(4 * LINE);
  expect(text.scrollHeight).toBe(text.clientHeight);

  await less.click();

  await expect
    .element(screen.getByRole("button", { name: "Show more" }))
    .toHaveAttribute("aria-expanded", "false");
  expect(text.getBoundingClientRect().height).toBe(4 * LINE);
});

test("gives assistive technologies the whole text while it is cut", async () => {
  await page.viewport(1280, 800);
  const screen = await render(<ClampedText>{LONG_TEXT}</ClampedText>);

  await expect
    .element(screen.getByRole("button", { name: "Show more" }))
    .toBeVisible();
  // The text is cut on the screen only.
  expect(screen.getByText(LONG_TEXT).element().textContent).toBe(LONG_TEXT);
  const more = screen.getByRole("button", { name: "Show more" }).element();
  expect(more.getAttribute("aria-controls")).toBe(
    screen.getByText(LONG_TEXT).element().id,
  );
});

test("shows a text of four lines or fewer whole, without Show more", async () => {
  await page.viewport(1280, 800);
  const screen = await render(
    <ClampedText>A fictional short description.</ClampedText>,
  );

  await expect
    .element(screen.getByText("A fictional short description."))
    .toBeVisible();
  expect(screen.getByRole("button").elements()).toHaveLength(0);
});

test("offers Show more once a narrower window cuts the text", async () => {
  await page.viewport(1280, 800);
  const text = LONG_TEXT.slice(0, 250);
  const screen = await render(<ClampedText>{text}</ClampedText>);
  await expect.element(screen.getByText(text)).toBeVisible();
  expect(screen.getByRole("button").elements()).toHaveLength(0);

  await page.viewport(320, 640);

  await expect
    .element(screen.getByRole("button", { name: "Show more" }))
    .toBeVisible();
});

test("shows Show more in link, text-14, at weight 500, 24 px high, with the focus ring on keyboard focus", async () => {
  await page.viewport(1280, 800);
  const screen = await render(<ClampedText>{LONG_TEXT}</ClampedText>);
  const more = screen.getByRole("button", { name: "Show more" });
  await expect.element(more).toBeVisible();

  await userEvent.keyboard("{Tab}");

  await expect.element(more).toHaveFocus();
  const style = getComputedStyle(more.element());
  expect([style.color, style.fontSize, style.fontWeight]).toEqual([
    LINK,
    "14px",
    "500",
  ]);
  expect(more.element().getBoundingClientRect().height).toBe(24);
  expect(style.outlineStyle).toBe("solid");
});

test("measures another text again, which starts cut", async () => {
  await page.viewport(1280, 800);
  const screen = await render(
    <ClampedText>A fictional short text.</ClampedText>,
  );
  expect(screen.getByRole("button").elements()).toHaveLength(0);

  await screen.rerender(<ClampedText>{LONG_TEXT}</ClampedText>);

  await expect
    .element(screen.getByRole("button", { name: "Show more" }))
    .toHaveAttribute("aria-expanded", "false");

  await screen.getByRole("button", { name: "Show more" }).click();
  await expect
    .element(screen.getByRole("button", { name: "Show less" }))
    .toBeVisible();
  await screen.rerender(
    <ClampedText>{`${LONG_TEXT} Another fictional sentence.`}</ClampedText>,
  );

  await expect
    .element(screen.getByRole("button", { name: "Show more" }))
    .toHaveAttribute("aria-expanded", "false");
});

test("keeps the line breaks of the text, collapses its runs of spaces, and breaks a word longer than its place", async () => {
  await page.viewport(320, 640);
  const word = "fictional_function_".repeat(6);
  const screen = await render(
    <ClampedText>{`First    line.\nSecond line ${word}.`}</ClampedText>,
  );
  const paragraph = screen.getByText(/First/);
  await expect.element(paragraph).toBeVisible();
  const text = paragraph.element();
  const node = text.firstChild!;

  const first = document.createRange();
  first.setStart(node, 0);
  first.setEnd(node, "First    line.".length);
  const second = document.createRange();
  second.setStart(node, "First    line.\n".length);
  second.setEnd(node, "First    line.\nSecond".length);
  // The line break starts a new line, and the first sentence, its spaces
  // collapsed to one, takes less than the width of the text.
  expect(first.getClientRects()).toHaveLength(1);
  expect(second.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    first.getBoundingClientRect().bottom - 1,
  );
  expect(first.getBoundingClientRect().width).toBeLessThan(
    text.getBoundingClientRect().width / 2,
  );
  // The long word breaks within the width of the text, which stays within
  // the window.
  const long = document.createRange();
  long.setStart(node, node.textContent!.indexOf(word));
  long.setEnd(node, node.textContent!.indexOf(word) + word.length);
  expect(long.getBoundingClientRect().right).toBeLessThanOrEqual(
    text.getBoundingClientRect().right + 1,
  );
  expect(text.getBoundingClientRect().right).toBeLessThanOrEqual(
    window.innerWidth,
  );
  expect(document.documentElement.scrollWidth).toBe(
    document.documentElement.clientWidth,
  );
});
