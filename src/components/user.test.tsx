import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import {
  Actor,
  compactName,
  displayName,
  StackedUser,
  User,
  type UserFields,
} from "./user";

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
  "shows the username of %s after the display name, as @ and the username in fg-muted, when asked",
  async (_, user) => {
    const screen = await render(<User user={user} withUsername />);
    const username = screen.getByText("@asmith", { exact: true });

    await expect.element(screen.getByText("Alice Smith @asmith")).toBeVisible();
    expect(getComputedStyle(username.element()).color).toBe(FG_MUTED);
  },
);

test("shows the username also when it is the display name", async () => {
  const screen = await render(
    <section aria-label="Row">
      <User user={{ ...ALICE, full_name: null }} withUsername />
    </section>,
  );
  const row = screen.getByRole("region");

  await expect.element(row).toBeVisible();
  expect(row.element().textContent).toBe("asmith @asmith");
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

test("cuts only the name, with its username, when the place is too narrow, and keeps it whole for assistive technologies", async () => {
  const longName = "Alice Fictional Smith-Wilson-Brown";
  const screen = await render(
    <section aria-label="Narrow place" className="w-40">
      <User
        user={{ ...SCANNER, full_name: longName, active: false }}
        withUsername
      />
    </section>,
  );
  const place = screen.getByRole("region").element().getBoundingClientRect();
  const name = screen.getByText(`${longName} @security-scanner`).element();

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

test("wraps the name, with its username, where the place is too narrow when asked, and keeps the labels within it", async () => {
  const longName = "Alice Fictional Smith-Wilson-Brown";
  const screen = await render(
    <section aria-label="Narrow place" className="w-40">
      <User
        user={{ ...SCANNER, full_name: longName, active: false }}
        withUsername
        wrap
      />
    </section>,
  );
  const place = screen.getByRole("region").element().getBoundingClientRect();
  const name = screen.getByText(`${longName} @security-scanner`).element();

  await expect.element(screen.getByText("Inactive")).toBeVisible();
  expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth);
  expect(name.getBoundingClientRect().height).toBeGreaterThan(24);
  for (const text of ["Bot", "Inactive"]) {
    const box = screen
      .getByText(text, { exact: true })
      .element()
      .getBoundingClientRect();
    expect(box.right, text).toBeLessThanOrEqual(place.right);
  }
});

test("shows the name form without the avatar: the name at the start of its place, as high as the surrounding text, followed by the labels", async () => {
  const screen = await render(
    <section aria-label="Row" className="flex text-14">
      <User user={{ ...SCANNER, active: false }} withAvatar={false} />
    </section>,
  );
  const row = screen.getByRole("region").element().getBoundingClientRect();
  const name = screen.getByText("Security Scanner", { exact: true }).element();

  await expect.element(screen.getByText("Inactive")).toBeVisible();
  expect(screen.getByRole("region").element().textContent).toBe(
    "Security ScannerBotInactive",
  );
  expect(name.getBoundingClientRect().left).toBe(row.left);
  // The line of text-14, 20 px, below the 24 px of the small avatar.
  expect(row.height).toBe(20);
  expect(getComputedStyle(name).color).toBe(FG_MUTED);
});

test.each([
  ["cut", false],
  ["wrapped", true],
])(
  "stands the name form, %s, on the baseline of the text around it",
  async (_, wrap) => {
    const screen = await render(
      <p className="text-13">
        Granted by{" "}
        <User
          user={{ ...ALICE, active: false }}
          withAvatar={false}
          wrap={wrap}
        />{" "}
        on
      </p>,
    );
    const line = screen.getByText(/^Granted by/).element();
    const name = screen.getByText("Alice Smith", { exact: true }).element();

    await expect.element(screen.getByText("Inactive")).toBeVisible();
    const around = document.createRange();
    around.selectNodeContents(line.firstChild!);
    const words = document.createRange();
    words.selectNodeContents(name);
    expect(words.getBoundingClientRect().bottom).toBeCloseTo(
      around.getBoundingClientRect().bottom,
      0,
    );
  },
);

describe("with the username on a line of its own", () => {
  test.each([
    ["a user with a full name", ALICE, "Alice Smith", "@asmith"],
    [
      "a user whose display name is the username",
      { ...ALICE, full_name: null },
      "asmith",
      "@asmith",
    ],
  ])(
    "shows the username below the name, always: %s",
    async (_, user, name, username) => {
      const screen = await render(
        <p className="font-semibold">
          <StackedUser user={user} size="medium" />
        </p>,
      );
      const nameText = screen.getByText(name, { exact: true });
      const usernameText = screen.getByText(username, { exact: true });

      await expect.element(usernameText).toBeVisible();
      expect(
        usernameText.element().getBoundingClientRect().top,
      ).toBeGreaterThanOrEqual(
        nameText.element().getBoundingClientRect().bottom,
      );
      const style = getComputedStyle(usernameText.element());
      expect([style.fontSize, style.fontWeight, style.color]).toEqual([
        "13px",
        "400",
        FG_MUTED,
      ]);
      expect(getComputedStyle(nameText.element()).fontWeight).toBe("600");
      expect(screen.getByRole("img").query()).toBeNull();
    },
  );

  test("shows the labels after the name, on its line", async () => {
    const screen = await render(
      <StackedUser user={{ ...SCANNER, active: false }} size="medium" />,
    );
    const name = screen.getByText("Security Scanner", { exact: true });
    const bot = screen.getByText("Bot", { exact: true });
    const inactive = screen.getByText("Inactive", { exact: true });

    await expect.element(inactive).toBeVisible();
    const nameBox = name.element().getBoundingClientRect();
    const usernameBox = screen
      .getByText("@security-scanner")
      .element()
      .getBoundingClientRect();
    expect(bot.element().getBoundingClientRect().left).toBeGreaterThan(
      nameBox.right,
    );
    expect(inactive.element().getBoundingClientRect().left).toBeGreaterThan(
      bot.element().getBoundingClientRect().right,
    );
    // The labels on the line of the name, above the username.
    for (const label of [bot, inactive]) {
      expect(
        label.element().getBoundingClientRect().bottom,
      ).toBeLessThanOrEqual(usernameBox.top);
    }
    expect(usernameBox.top).toBeGreaterThanOrEqual(nameBox.bottom);
    expect(getComputedStyle(name.element()).color).toBe(FG_MUTED);
  });

  test("wraps the name and the username where the place is too narrow, instead of cutting them", async () => {
    const longName = "Alice Fictional Smith-Wilson-Brown";
    const screen = await render(
      <section aria-label="Narrow place" className="w-40">
        <StackedUser
          user={{
            ...SCANNER,
            full_name: longName,
            username: "security-scanner-of-the-fictional-pipelines",
          }}
          size="medium"
        />
      </section>,
    );
    const place = screen.getByRole("region").element().getBoundingClientRect();

    await expect.element(screen.getByText("Bot")).toBeVisible();
    for (const text of [
      longName,
      "@security-scanner-of-the-fictional-pipelines",
    ]) {
      const element = screen.getByText(text, { exact: true }).element();
      expect(element.scrollWidth, text).toBeLessThanOrEqual(
        element.clientWidth,
      );
      expect(element.getBoundingClientRect().height, text).toBeGreaterThan(24);
      expect(element.getBoundingClientRect().right, text).toBeLessThanOrEqual(
        place.right,
      );
    }
  });
});

test("shows the username at weight 400 after a name at another weight", async () => {
  const screen = await render(
    <p className="font-semibold">
      <User user={ALICE} withUsername />
    </p>,
  );
  const username = screen.getByText("@asmith", { exact: true });

  await expect.element(username).toBeVisible();
  expect(getComputedStyle(username.element()).fontWeight).toBe("400");
  expect(
    getComputedStyle(screen.getByText("Alice Smith @asmith").element())
      .fontWeight,
  ).toBe("600");
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
