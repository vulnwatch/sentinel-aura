import { UserRound, UserRoundX, UsersRound } from "lucide-react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot, type Screenshot } from "../test-screenshot";
import { Maintainers } from "./maintainers";
import type { UserFields } from "./user";

// The maintainers of a package (Sentinel
// docs/features/packages/package-maintainership.md, Maintainers in the
// Package Tree; docs/design-system.md, Icons by Need), at a wide window, in
// the light theme.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  document.documentElement.style.removeProperty("font-size");
  await page.viewport(414, 896);
});

// fg-muted and surface-hover of the light theme.
const FG_MUTED = "rgb(89, 99, 110)";
const SURFACE_HOVER = "rgb(243, 245, 248)";

const DBROWN: UserFields = {
  id: "00000000-0000-0000-0000-000000000004",
  username: "dbrown",
  full_name: "Dave Brown",
  active: true,
  bot: false,
  avatar_url: null,
};
const GHILL: UserFields = {
  id: "00000000-0000-0000-0000-000000000005",
  username: "ghill",
  full_name: "Grace Hill",
  active: false,
  bot: false,
  avatar_url: null,
};

async function renderMaintainers(users: UserFields[], scale = 1) {
  document.documentElement.style.fontSize = `${16 * scale}px`;
  return render(
    <div className="p-8">
      <Maintainers users={users} packageName="fictional-openssl" />
    </div>,
  );
}

test.each([
  [[], "No maintainer of fictional-openssl", ""],
  [[DBROWN], "1 maintainer of fictional-openssl", "1"],
  [[DBROWN, GHILL], "2 maintainers of fictional-openssl", "2"],
])(
  "is a button named by the number of the maintainers and the package, which shows the number: %#",
  async (users, name, number) => {
    const screen = await renderMaintainers(users);

    const button = screen.getByRole("button", { name, exact: true });
    await expect.element(button).toBeVisible();
    expect(button.element().textContent).toBe(number);
    const style = getComputedStyle(button.element());
    expect(style.color).toBe(FG_MUTED);
    expect(style.fontSize).toBe("14px");
    const box = button.element().getBoundingClientRect();
    expect(box.height).toBe(24);
    expect(box.width).toBeGreaterThanOrEqual(24);
  },
);

// The pixels of an icon of 48 px, the icon of 16 px at a text size of 48 px,
// on a grid of 3 px, from the top left corner of the icon in a screenshot.
function iconGrid(picture: Screenshot, left: number, top: number): string[] {
  const pixels: string[] = [];
  for (let y = 0; y < 48; y += 3) {
    for (let x = 0; x < 48; x += 3) {
      pixels.push(picture.at(left + x + 1, top + y + 1));
    }
  }
  return pixels;
}

const ICONS = {
  "user-round": UserRound,
  "users-round": UsersRound,
  "user-round-x": UserRoundX,
} as const;

// The icon of the maintainers, enlarged three times, compared with each of
// the three icons as Lucide draws them in the same color: the names of the
// icons that it is closest to.
async function iconOf(users: UserFields[]): Promise<string[]> {
  const screen = await renderMaintainers(users, 3);
  const references = await render(
    <div className="flex gap-2 text-fg-muted">
      {Object.entries(ICONS).map(([name, Icon]) => (
        <figure key={name} aria-label={name} className="inline-flex">
          <Icon className="size-4" />
        </figure>
      ))}
    </div>,
  );
  const button = await screenshot(screen.getByRole("button"));
  // The icon after 4 px of padding, 12 px here, centered vertically.
  const shown = iconGrid(button, 12, (button.height - 48) / 2);
  // The number of points of the grid at which each icon differs, which the
  // edges of the strokes can make more than none.
  const differences = new Map<string, number>();
  for (const name of Object.keys(ICONS)) {
    const reference = iconGrid(
      await screenshot(references.getByRole("figure", { name })),
      0,
      0,
    );
    differences.set(
      name,
      reference.filter((pixel, index) => pixel !== shown[index]).length,
    );
  }
  const closest = Math.min(...differences.values());
  return [...differences]
    .filter(([, count]) => count === closest)
    .map(([name]) => name);
}

test.each([
  ["user-round-x", "without any", []],
  ["user-round", "for one", [DBROWN]],
  ["users-round", "for several", [DBROWN, GHILL]],
])("shows %s %s", async (icon, _, users) => {
  expect(await iconOf(users)).toEqual([icon]);
});

test("shows its name in a tooltip on keyboard focus, and is on surface-hover under the pointer", async () => {
  const screen = await renderMaintainers([DBROWN]);
  const button = screen.getByRole("button");

  await userEvent.keyboard("{Tab}");

  await expect.element(button).toHaveFocus();
  await expect
    .element(screen.getByRole("tooltip"))
    .toHaveTextContent("1 maintainer of fictional-openssl");
  await button.hover();
  await expect
    .poll(() => getComputedStyle(button.element()).backgroundColor)
    .toBe(SURFACE_HOVER);
});

test("opens the maintainers in a popover that takes the focus, each in the full form with the username, and returns the focus on Escape", async () => {
  const screen = await renderMaintainers([DBROWN, GHILL]);
  const button = screen.getByRole("button");

  await button.click();

  const popover = screen.getByRole("dialog", {
    name: "Maintainers of fictional-openssl",
  });
  await expect.element(popover).toHaveFocus();
  expect(popover.element().parentElement!.getBoundingClientRect().width).toBe(
    288,
  );
  await expect
    .element(popover.getByRole("heading", { name: "Maintainers" }))
    .toBeVisible();
  await expect
    .element(popover.getByText("fictional-openssl", { exact: true }))
    .toBeVisible();
  expect(
    popover
      .getByRole("listitem")
      .elements()
      .map((element) => element.textContent),
  ).toEqual(["Dave Brown @dbrown", "Grace Hill @ghillInactive"]);

  await userEvent.keyboard("{Escape}");

  await expect.element(button).toHaveFocus();
});

test("says in its popover that Sentinel knows no maintainer of a package without any", async () => {
  const screen = await renderMaintainers([]);

  await screen.getByRole("button").click();

  const popover = screen.getByRole("dialog", {
    name: "Maintainers of fictional-openssl",
  });
  await expect
    .element(
      popover.getByText("Sentinel knows no maintainer of this package.", {
        exact: true,
      }),
    )
    .toBeVisible();
  expect(popover.getByRole("listitem").elements()).toHaveLength(0);
});
