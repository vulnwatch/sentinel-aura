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
});
