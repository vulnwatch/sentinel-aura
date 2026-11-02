import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Actor, compactName, displayName, User, type UserFields } from "./user";

// The representation of a user (docs/behaviors.md, Representation of a User;
// docs/design-system.md, Representation of a User), at the browser's default
// text size, in the light theme.

const ALICE: UserFields = {
  id: "019a2b3c-4d5e-7f00-8000-00000000000a",
  username: "asmith",
  full_name: "Alice Smith",
  active: true,
  bot: false,
};
const SCANNER: UserFields = {
  id: "019a2b3c-4d5e-7f00-8000-00000000000d",
  username: "security-scanner",
  full_name: "Security Scanner",
  active: true,
  bot: true,
};

// fg and fg-muted of the light theme.
const FG = "rgb(31, 35, 40)";
const FG_MUTED = "rgb(89, 99, 110)";

describe("display name", () => {
  test("is the full name", () => {
    expect(displayName(ALICE)).toBe("Alice Smith");
  });

  test.each([
    ["null", null],
    ["empty", ""],
    ["blank", "  "],
  ])("is the username when the full name is %s", (_, fullName) => {
    expect(displayName({ ...ALICE, full_name: fullName })).toBe("asmith");
  });
});

test.each([
  ["a person", "Alice Smith", ALICE],
  ["an inactive person", "Alice Smith (inactive)", { ...ALICE, active: false }],
  ["a bot account", "Security Scanner (bot)", SCANNER],
  [
    "an inactive bot account",
    "Security Scanner (bot) (inactive)",
    { ...SCANNER, active: false },
  ],
  ["a user without a full name", "asmith", { ...ALICE, full_name: null }],
])("the compact name of %s is %j", (_, name, user) => {
  expect(compactName(user)).toBe(name);
});

test("shows the display name in the style of the surrounding text, and hides the avatar", async () => {
  const screen = await render(
    <p className="text-14">
      <User user={ALICE} />
    </p>,
  );
  const name = screen.getByText("Alice Smith", { exact: true });

  await expect.element(name).toBeVisible();
  expect(getComputedStyle(name.element()).fontSize).toBe("14px");
  expect(getComputedStyle(name.element()).color).toBe(FG);
  expect(screen.getByRole("img").query()).toBeNull();
  await expect.element(screen.getByText("Bot")).not.toBeInTheDocument();
  await expect.element(screen.getByText("Inactive")).not.toBeInTheDocument();
});

// An inactive user's name is in fg-muted too, so the @ sets the username
// apart from the name.
test.each([
  ["an active user", ALICE],
  ["an inactive user", { ...ALICE, active: false }],
])(
  "shows the username of %s after the display name, as @ and the username in fg-muted, when asked and when the two differ",
  async (_, user) => {
    const screen = await render(<User user={user} withUsername />);
    const username = screen.getByText("@asmith", { exact: true });

    await expect.element(screen.getByText("Alice Smith @asmith")).toBeVisible();
    expect(getComputedStyle(username.element()).color).toBe(FG_MUTED);
  },
);

test("shows the username once when it is the display name", async () => {
  const screen = await render(
    <section aria-label="Row">
      <User user={{ ...ALICE, full_name: null }} withUsername />
    </section>,
  );
  const row = screen.getByRole("region");

  await expect.element(row).toBeVisible();
  expect(row.element().textContent).toBe("asmith");
});

test("shows no username unless asked", async () => {
  const screen = await render(<User user={ALICE} />);

  await expect.element(screen.getByText("Alice Smith")).toBeVisible();
  await expect.element(screen.getByText("asmith")).not.toBeInTheDocument();
});

test("shows an inactive user's name in fg-muted, followed by Inactive", async () => {
  const screen = await render(<User user={{ ...ALICE, active: false }} />);
  const name = screen.getByText("Alice Smith");
  const label = screen.getByText("Inactive", { exact: true });

  await expect.element(label).toBeVisible();
  expect(getComputedStyle(name.element()).color).toBe(FG_MUTED);
  expect(getComputedStyle(label.element()).fontSize).toBe("12px");
  expect(label.element().getBoundingClientRect().left).toBeGreaterThan(
    name.element().getBoundingClientRect().right,
  );
});

test("shows Bot after a bot account's name, and Inactive after Bot", async () => {
  const screen = await render(<User user={{ ...SCANNER, active: false }} />);
  const name = screen.getByText("Security Scanner");
  const bot = screen.getByText("Bot", { exact: true });
  const inactive = screen.getByText("Inactive", { exact: true });

  await expect.element(bot).toBeVisible();
  await expect.element(inactive).toBeVisible();
  expect(bot.element().getBoundingClientRect().left).toBeGreaterThan(
    name.element().getBoundingClientRect().right,
  );
  expect(inactive.element().getBoundingClientRect().left).toBeGreaterThan(
    bot.element().getBoundingClientRect().right,
  );
});

test("cuts only the name when the place is too narrow, and keeps it whole for assistive technologies", async () => {
  const longName = "Alice Fictional Smith-Wilson-Brown";
  const screen = await render(
    <section aria-label="Narrow place" className="w-40">
      <User user={{ ...SCANNER, full_name: longName, active: false }} />
    </section>,
  );
  const place = screen.getByRole("region").element().getBoundingClientRect();
  const name = screen.getByText(longName).element();

  await expect.element(screen.getByText("Inactive")).toBeVisible();
  expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
  expect(getComputedStyle(name).textOverflow).toBe("ellipsis");
  for (const label of ["Bot", "Inactive"]) {
    const box = screen
      .getByText(label, { exact: true })
      .element()
      .getBoundingClientRect();
    expect(box.right, label).toBeLessThanOrEqual(place.right);
  }
});

// The small avatar is as high as the line of the name, so only the medium
// and the large sizes show in the height; a small avatar by default does
// not show a medium one.
test.each([
  ["small, by default", 24, undefined],
  ["medium", 32, "medium"],
  ["large", 64, "large"],
] as const)(
  "takes the height of its avatar: %s, %i px",
  async (_, pixels, size) => {
    const screen = await render(
      <section aria-label="Row" className="flex">
        <User user={ALICE} size={size} />
      </section>,
    );

    await expect.element(screen.getByText("Alice Smith")).toBeVisible();
    expect(
      screen.getByRole("region").element().getBoundingClientRect().height,
    ).toBe(pixels);
  },
);

describe("actor of a recorded action", () => {
  test("is the user in the full form", async () => {
    const screen = await render(<Actor actor={SCANNER} />);

    await expect.element(screen.getByText("Security Scanner")).toBeVisible();
    await expect
      .element(screen.getByText("Bot", { exact: true }))
      .toBeVisible();
  });

  test("is System, with its picture hidden from assistive technologies, when no user is recorded", async () => {
    const screen = await render(<Actor actor={null} />);

    await expect
      .element(screen.getByText("System", { exact: true }))
      .toBeVisible();
    expect(screen.getByRole("img").query()).toBeNull();
  });

  test.each([
    ["small, by default", 24, undefined],
    ["medium", 32, "medium"],
    ["large", 64, "large"],
  ] as const)(
    "System takes the height of its picture: %s, %i px",
    async (_, pixels, size) => {
      const screen = await render(
        <section aria-label="Row" className="flex">
          <Actor actor={null} size={size} />
        </section>,
      );

      await expect.element(screen.getByText("System")).toBeVisible();
      expect(
        screen.getByRole("region").element().getBoundingClientRect().height,
      ).toBe(pixels);
    },
  );
});
