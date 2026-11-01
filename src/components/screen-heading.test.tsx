import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { focusScreenHeading, ScreenHeading } from "./screen-heading";

afterEach(() => {
  document.title = "Sentinel";
});

test("names the screen with a level-one heading and titles the page after it", async () => {
  const screen = await render(<ScreenHeading>Fetcher run</ScreenHeading>);

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Fetcher run" }))
    .toBeVisible();
  expect(document.title).toBe("Fetcher run – Sentinel");
});

test("titles the page after a heading that changes", async () => {
  const screen = await render(<ScreenHeading>Fetcher run</ScreenHeading>);

  await screen.rerender(<ScreenHeading>Not found</ScreenHeading>);

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
    .toBeVisible();
  expect(document.title).toBe("Not found – Sentinel");
});

test("gives the page the product name as its title when the screen goes", async () => {
  const screen = await render(<ScreenHeading>Fetcher run</ScreenHeading>);

  await screen.unmount();

  expect(document.title).toBe("Sentinel");
});

test("takes the focus when asked to", async () => {
  const screen = await render(<ScreenHeading>Fetcher run</ScreenHeading>);

  focusScreenHeading();

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Fetcher run" }))
    .toHaveFocus();
});

test("passes the focus to the heading that replaces it", async () => {
  const screen = await render(
    <ScreenHeading key="record">Fictional record</ScreenHeading>,
  );
  focusScreenHeading();

  await screen.rerender(<ScreenHeading key="error">Not found</ScreenHeading>);

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
    .toHaveFocus();
});

test("asks for nothing when no heading is shown", () => {
  expect(() => {
    focusScreenHeading();
  }).not.toThrow();
  expect(document.activeElement).toBe(document.body);
});
