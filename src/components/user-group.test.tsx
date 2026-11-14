import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { FICTIONAL_PICTURE, FICTIONAL_PICTURE_COLOR } from "../test-api";
import { screenshot } from "../test-screenshot";
import type { UserFields } from "./user";
import { UserGroup } from "./user-group";

// A group of users (docs/design-system.md, Representation of a User), in the
// light theme.

const PERSON: UserFields = {
  id: "00000000-0000-0000-0000-000000000004",
  username: "dbrown",
  full_name: "Dave Brown",
  active: true,
  bot: false,
  avatar_url: null,
};
const INACTIVE: UserFields = {
  id: "00000000-0000-0000-0000-000000000005",
  username: "ghill",
  full_name: null,
  active: false,
  bot: false,
  avatar_url: null,
};
const BOT: UserFields = {
  id: "00000000-0000-0000-0000-000000000006",
  username: "fictional-bot",
  full_name: "Fictional Bot",
  active: false,
  bot: true,
  avatar_url: null,
};

async function renderGroup(users: UserFields[]) {
  return render(
    <div className="p-8">
      <button type="button">Before</button>
      <h2 id="group-heading">Participants</h2>
      <UserGroup users={users} labelledBy="group-heading" />
      <button type="button">After</button>
    </div>,
  );
}

test("is a list in a toolbar named by its heading, each user its avatar named in the compact form", async () => {
  const screen = await renderGroup([PERSON, INACTIVE, BOT]);

  const group = screen.getByRole("toolbar", { name: "Participants" });
  await expect.element(group.getByRole("list")).toBeVisible();
  expect(
    group
      .getByRole("img")
      .elements()
      .map((element) => element.getAttribute("aria-label")),
  ).toEqual([
    "Dave Brown",
    "ghill (inactive)",
    "Fictional Bot (bot) (inactive)",
  ]);
});

test("shows every user at the medium size, 6 px apart, a person round and a bot account square", async () => {
  const screen = await renderGroup([PERSON, BOT]);

  const [person, bot] = screen.getByRole("img").elements();
  const first = person!.getBoundingClientRect();
  const second = bot!.getBoundingClientRect();
  expect([first.width, first.height]).toEqual([32, 32]);
  expect(second.left - first.right).toBe(6);
  expect(getComputedStyle(person!).borderRadius).not.toBe(
    getComputedStyle(bot!).borderRadius,
  );
});

test("shows a person's profile picture as the avatar of the user, named in the compact form", async () => {
  const screen = await renderGroup([
    { ...PERSON, avatar_url: FICTIONAL_PICTURE },
  ]);
  const avatar = screen.getByRole("img", { name: "Dave Brown" });

  expect((await screenshot(avatar)).at(16, 16)).toBe(FICTIONAL_PICTURE_COLOR);
});

test("is one stop of the Tab key, the arrow keys moving from user to user, and shows the name of the user with the focus", async () => {
  const screen = await renderGroup([PERSON, INACTIVE, BOT]);
  const [person, inactive, bot] = screen.getByRole("img").all();
  screen.getByRole("button", { name: "Before" }).element().focus();

  await userEvent.tab();
  await expect.element(person!).toHaveFocus();
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(inactive!).toHaveFocus();
  await expect
    .element(screen.getByRole("tooltip"))
    .toHaveTextContent("ghill (inactive)");
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(bot!).toHaveFocus();
  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(inactive!).toHaveFocus();

  await userEvent.tab();
  await expect
    .element(screen.getByRole("button", { name: "After" }))
    .toHaveFocus();
  await userEvent.tab({ shift: true });
  await expect.element(inactive!).toHaveFocus();
  await userEvent.tab({ shift: true });
  await expect
    .element(screen.getByRole("button", { name: "Before" }))
    .toHaveFocus();
});

test("shows the name of a user under the pointer", async () => {
  const screen = await renderGroup([PERSON]);
  // React Aria shows a tooltip on hover only once the user works with a
  // pointer, as a click shows.
  await screen.getByRole("button", { name: "Before" }).click();

  const avatar = screen.getByRole("img", { name: "Dave Brown" });
  await avatar.hover();

  await expect
    .element(screen.getByRole("tooltip"))
    .toHaveTextContent("Dave Brown");
  // The pointer leaves, so that it rests on no element of a later test.
  await userEvent.unhover(avatar);
});
