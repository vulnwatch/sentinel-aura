import { afterEach, describe, expect, test } from "vitest";
import { commands } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Loading, LOADING_DELAY_MS, UpdatingBar } from "./loading";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reduce: boolean) => Promise<void>;
  }
}

afterEach(async () => {
  await commands.emulateReducedMotion(false);
});

// The names of the animations that run in an element and its descendants.
function animationsIn(element: Element): string[] {
  return element
    .getAnimations({ subtree: true })
    .map((animation) =>
      animation instanceof CSSAnimation ? animation.animationName : "",
    );
}

function elapsed(since: number) {
  return performance.now() - since;
}

describe("Loading", () => {
  test("shows nothing until the data has taken longer than 300 ms", async () => {
    const start = performance.now();
    const screen = await render(<Loading />);
    const indicator = screen.getByRole("progressbar", { name: "Loading" });

    expect(indicator.query()).toBeNull();
    await expect.element(indicator).toBeVisible();
    expect(elapsed(start)).toBeGreaterThanOrEqual(LOADING_DELAY_MS);
    await expect.element(screen.getByText("Loading")).toBeVisible();
  });

  test("turns its spinner, which stands still under reduced motion", async () => {
    const screen = await render(<Loading />);
    const indicator = screen.getByRole("progressbar", { name: "Loading" });
    await expect.element(indicator).toBeVisible();

    expect(animationsIn(indicator.element())).toEqual(["spin"]);
    await commands.emulateReducedMotion(true);
    expect(animationsIn(indicator.element())).toEqual([]);
  });
});

describe("UpdatingBar", () => {
  test("shows nothing during the first 300 ms", async () => {
    const start = performance.now();
    const screen = await render(<UpdatingBar />);
    const bar = screen.getByRole("progressbar", { name: "Updating" });

    expect(bar.query()).toBeNull();
    await expect.element(bar).toBeInTheDocument();
    expect(elapsed(start)).toBeGreaterThanOrEqual(LOADING_DELAY_MS);
  });

  test("runs, and stands still under reduced motion", async () => {
    const screen = await render(<UpdatingBar />);
    const bar = screen.getByRole("progressbar", { name: "Updating" });
    await expect.element(bar).toBeInTheDocument();

    expect(animationsIn(bar.element())).toEqual(["progress"]);
    await commands.emulateReducedMotion(true);
    expect(animationsIn(bar.element())).toEqual([]);
  });
});
