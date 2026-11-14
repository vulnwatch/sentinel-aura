import { afterEach, beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { GroupBand } from "./group-band";

// The band of a group of items within a part of a detail screen
// (docs/design-system.md, Detail Screens), at a wide window, in the light
// theme.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

// The colors of docs/design-system.md (Color Tokens) in the light theme.
const FG = "rgb(31, 35, 40)";
const FG_MUTED = "rgb(89, 99, 110)";
const NEUTRAL_SOFT = "rgb(239, 242, 245)";

test.each([2, 3] as const)(
  "holds the heading of the group at level %i in text-15, weight 600, on neutral-soft, at least 32 px high, with a 6 px radius and 12 px of side padding, its values 6 px after it",
  async (level) => {
    const screen = await render(
      <div className="text-fg">
        <GroupBand heading="fictional-openssl" level={level}>
          <span>2 maintainers</span>
        </GroupBand>
      </div>,
    );

    const heading = screen.getByRole("heading", {
      level,
      name: "fictional-openssl",
    });
    await expect.element(heading).toBeVisible();
    const band = heading.element().parentElement;
    if (band === null) {
      throw new Error("The heading has no band");
    }
    const style = getComputedStyle(band);
    expect(style.backgroundColor).toBe(NEUTRAL_SOFT);
    expect(style.borderTopLeftRadius).toBe("6px");
    expect(style.paddingLeft).toBe("12px");
    expect(style.paddingRight).toBe("12px");
    expect(band.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    expect(style.color).toBe(FG);
    const headingStyle = getComputedStyle(heading.element());
    expect(headingStyle.fontSize).toBe("15px");
    expect(headingStyle.fontWeight).toBe("600");
    const value = screen.getByText("2 maintainers").element();
    expect(
      value.getBoundingClientRect().left -
        heading.element().getBoundingClientRect().right,
    ).toBe(6);
  },
);

test("shows a hidden record that shows in fg-muted", async () => {
  const screen = await render(
    <div className="text-fg">
      <GroupBand heading="fictional-openssl" level={3} muted />
    </div>,
  );

  const heading = screen.getByRole("heading", { level: 3 });
  await expect.element(heading).toBeVisible();
  expect(getComputedStyle(heading.element()).color).toBe(FG_MUTED);
});
