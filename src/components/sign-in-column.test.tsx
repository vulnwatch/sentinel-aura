import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { SignInColumn } from "./sign-in-column";

// The column of the Sign In Page (docs/design-system.md, Sign In Page), at
// the browser's default text size.

test("shows the product name above its content, in the main landmark, without a link", async () => {
  const screen = await render(
    <SignInColumn>
      <h1>Fictional screen</h1>
    </SignInColumn>,
  );
  const main = screen.getByRole("main");
  const name = main.getByText("Sentinel", { exact: true });
  const heading = main.getByRole("heading", { name: "Fictional screen" });

  await expect.element(name).toBeVisible();
  expect(name.element().getBoundingClientRect().bottom).toBeLessThan(
    heading.element().getBoundingClientRect().top,
  );
  expect(getComputedStyle(name.element()).fontSize).toBe("20px");
  await expect.element(main.getByRole("link")).not.toBeInTheDocument();
});

// The mark itself, its size and color, shows in the reference screenshots of
// Sign in (test/e2e/screenshots/sign-in.png).
test("hides the Sentinel mark from assistive technologies", async () => {
  const screen = await render(
    <SignInColumn>
      <h1>Fictional screen</h1>
    </SignInColumn>,
  );
  await expect
    .element(screen.getByRole("main").getByText("Sentinel", { exact: true }))
    .toBeVisible();

  expect(screen.getByRole("img").query()).toBeNull();
});

test("is at most 400 px wide, centered in the window", async () => {
  await page.viewport(1280, 800);
  const screen = await render(
    <SignInColumn>
      <h1>Fictional screen</h1>
    </SignInColumn>,
  );
  const heading = screen.getByRole("heading", { name: "Fictional screen" });
  await expect.element(heading).toBeVisible();
  // The card holds the heading, with 24 px of padding and a 1 px boundary.
  const card = heading.element().getBoundingClientRect();
  const width = card.width + 2 * (24 + 1);

  expect(width).toBe(400);
  expect(card.left - 25 + width / 2).toBe(640);
});
