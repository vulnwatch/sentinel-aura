import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import type { ListUsersAssignmentEligibilityItem } from "../api/generated/model";
import { createQueryClient } from "../query-client";
import {
  errorResponse,
  fictionalDirectoryUser,
  stubApi,
  urlOf,
  usersPage,
} from "../test-api";
import type { UserFields } from "./user";
import { SEARCH_DELAY_MS } from "./search-combobox";
import { UserPicker } from "./user-picker";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reduce: boolean) => Promise<void>;
  }
}

// A combobox of users that lists its users at once (docs/design-system.md,
// Forms), which reads the directory (Sentinel
// docs/features/identity/user-management.md, List Users).

const USERS = "/api/v1/users";

const ANA = fictionalDirectoryUser();
const BOB = fictionalDirectoryUser({
  id: "00000000-0000-0000-0000-000000000003",
  username: "bwilson",
  email: "bob.wilson@example.com",
  full_name: "Bob Wilson",
});
const ALICE = fictionalDirectoryUser({
  id: "00000000-0000-0000-0000-000000000002",
  username: "asmith",
  email: "alice.smith@example.com",
  full_name: "Alice Smith",
});

let client: QueryClient;

beforeEach(async () => {
  client = createQueryClient();
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
  });
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await cleanup();
  client.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
  await commands.emulateReducedMotion(false);
  await page.viewport(414, 896);
});

interface PickerProps {
  eligibility?: readonly ListUsersAssignmentEligibilityItem[];
  first?: UserFields;
  chosen?: string | null;
  busy?: string | null;
  action?: string;
  onChoose?: (choice: UserFields | "action") => void;
  error?: string;
  onInput?: () => void;
}

function Picker({
  eligibility = ["all", "non_confidential"],
  first,
  chosen = null,
  busy = null,
  action,
  onChoose = () => undefined,
  error,
  onInput = () => undefined,
}: PickerProps) {
  return (
    <QueryClientProvider client={client}>
      <div className="w-80 p-4">
        <UserPicker
          label="Search users"
          eligibility={eligibility}
          first={
            first === undefined ? undefined : { user: first, label: "You" }
          }
          chosen={chosen}
          busy={busy}
          action={action}
          onChoose={onChoose}
          busyText="Changing the assignee."
          error={error}
          onInput={onInput}
        />
      </div>
    </QueryClientProvider>
  );
}

async function renderPicker(props: PickerProps = {}) {
  const screen = await render(<Picker {...props} />);
  return {
    screen,
    field: screen.getByRole("searchbox", { name: "Search users" }),
    // Renders the picker again with other props, as its popover does after
    // a choice.
    rerender: (next: PickerProps) => screen.rerender(<Picker {...next} />),
  };
}

// The node that a status region of the picker added for a text, which
// assistive technologies announce as it is added.
function announcedNode(
  screen: Awaited<ReturnType<typeof renderPicker>>["screen"],
  text: string,
): Element | undefined {
  return (
    screen
      .getByRole("status")
      .elements()
      .find((status) => status.textContent === text)?.firstElementChild ??
    undefined
  );
}

// The text of the status regions of the picker.
function statusTexts(
  screen: Awaited<ReturnType<typeof renderPicker>>["screen"],
): string[] {
  return screen
    .getByRole("status")
    .elements()
    .map((status) => status.textContent ?? "");
}

// The reads of the directory, as their queries.
function reads(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname === USERS)
    .map((url) => url.search);
}

// The names of the options, in their order.
function optionNames(
  screen: Awaited<ReturnType<typeof renderPicker>>["screen"],
) {
  return screen
    .getByRole("option")
    .elements()
    .map((option) => option.textContent);
}

// The names of the animations that run in an element and its descendants.
function animationsIn(element: Element): string[] {
  return element
    .getAnimations({ subtree: true })
    .map((animation) =>
      animation instanceof CSSAnimation ? animation.animationName : "",
    );
}

// The options of each group of the list, by their names.
function groupsOf(
  screen: Awaited<ReturnType<typeof renderPicker>>["screen"],
): (string | null)[][] {
  return screen
    .getByRole("listbox", { name: "Users" })
    .getByRole("group")
    .elements()
    .map((group) =>
      page
        .elementLocator(group)
        .getByRole("option")
        .elements()
        .map((option) => option.textContent),
    )
    .filter((names) => names.length > 0);
}

// Waits until the browser has rendered two more frames, after which the
// field has rendered the term that settled, and a read of it has started.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

test("lists the first 20 users of the eligibility at once, by username, without a term", async () => {
  const spy = stubApi(() => usersPage([ANA, BOB]));
  const { screen } = await renderPicker();

  await expect
    .element(screen.getByRole("option", { name: "Bob Wilson @bwilson" }))
    .toBeVisible();
  expect(optionNames(screen)).toEqual([
    "Ana Garcia @agarcia",
    "Bob Wilson @bwilson",
  ]);
  expect(reads(spy)).toEqual([
    "?assignment_eligibility=all&assignment_eligibility=non_confidential&per_page=20",
  ]);
});

test("reads only the users of the eligibility that it is given", async () => {
  const spy = stubApi(() => usersPage([ANA]));
  const { screen } = await renderPicker({ eligibility: ["all"] });

  await expect
    .element(screen.getByRole("option", { name: "Ana Garcia @agarcia" }))
    .toBeVisible();
  expect(reads(spy)).toEqual(["?assignment_eligibility=all&per_page=20"]);
});

test("puts the first user first with its label, also when the page does not hold them, and keeps 20 users", async () => {
  const twenty = Array.from({ length: 20 }, (_, index) =>
    fictionalDirectoryUser({
      id: `00000000-0000-0000-0000-0000000001${String(index).padStart(2, "0")}`,
      username: `user${String(index).padStart(2, "0")}`,
      full_name: `Fictional User ${String(index).padStart(2, "0")}`,
    }),
  );
  stubApi(() => usersPage(twenty, { total: 63 }));
  const { screen } = await renderPicker({ first: ALICE });

  await expect
    .element(
      screen.getByText("The first 20 of 63 users. Type to find the others."),
    )
    .toBeVisible();
  const names = optionNames(screen);
  expect(names).toHaveLength(20);
  expect(names[0]).toBe("Alice Smith @asmithYou");
  expect(names[19]).toBe("Fictional User 18 @user18");
});

test("lists the first user once when the page holds them, in a group of their own before the others", async () => {
  stubApi(() => usersPage([ANA, ALICE, BOB]));
  const { screen } = await renderPicker({ first: ALICE });

  await expect
    .element(screen.getByRole("option", { name: "Bob Wilson @bwilson" }))
    .toBeVisible();
  expect(groupsOf(screen)).toEqual([
    ["Alice Smith @asmithYou"],
    ["Ana Garcia @agarcia", "Bob Wilson @bwilson"],
  ]);
});

test("shows the first user at once, while the others load", async () => {
  let respond!: (response: Response) => void;
  stubApi(
    () =>
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
  );
  const { screen } = await renderPicker({ first: ALICE });

  await expect
    .element(screen.getByRole("option", { name: "Alice Smith @asmith You" }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("progressbar", { name: "Loading" }))
    .toBeVisible();
  respond(usersPage([ANA]));
  await expect
    .element(screen.getByRole("option", { name: "Ana Garcia @agarcia" }))
    .toBeVisible();
});

test("shows the option that the arrow keys make current with the focus ring inside it", async () => {
  stubApi(() => usersPage([ANA, BOB]));
  const { screen, field } = await renderPicker();
  const bob = screen.getByRole("option", { name: "Bob Wilson @bwilson" });
  await expect.element(bob).toBeVisible();
  field.element().focus();

  await userEvent.keyboard("{ArrowDown}{ArrowDown}");

  await expect
    .poll(() => getComputedStyle(bob.element()).outlineStyle)
    .toBe("solid");
  expect(getComputedStyle(bob.element()).outlineWidth).toBe("2px");
  expect(
    getComputedStyle(
      screen.getByRole("option", { name: "Ana Garcia @agarcia" }).element(),
    ).outlineStyle,
  ).toBe("none");
  await expect.element(field).toHaveFocus();
});

test("keeps the users without a term for 1 character, and reads those that match from 2 once the user stops typing", async () => {
  const spy = stubApi((request) =>
    usersPage(request.query.get("search") === "bo" ? [BOB] : [ANA, BOB]),
  );
  const { screen, field } = await renderPicker({ first: ALICE });
  await expect
    .element(screen.getByRole("option", { name: "Bob Wilson @bwilson" }))
    .toBeVisible();
  field.element().focus();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  await userEvent.keyboard("b");
  vi.advanceTimersByTime(SEARCH_DELAY_MS);
  await nextFrames();
  expect(reads(spy)).toHaveLength(1);
  expect(optionNames(screen)).toHaveLength(3);

  await userEvent.keyboard("o");
  vi.advanceTimersByTime(SEARCH_DELAY_MS - 1);
  await nextFrames();
  expect(reads(spy)).toHaveLength(1);
  // The users without a term no longer show while the term settles.
  expect(optionNames(screen)).toEqual([]);
  vi.advanceTimersByTime(1);
  vi.useRealTimers();

  await expect.poll(() => optionNames(screen)).toEqual(["Bob Wilson @bwilson"]);
  expect(reads(spy)).toEqual([
    "?assignment_eligibility=all&assignment_eligibility=non_confidential&per_page=20",
    "?search=bo&assignment_eligibility=all&assignment_eligibility=non_confidential&per_page=20",
  ]);
});

test("puts the first user first among the users that match when they match", async () => {
  stubApi((request) =>
    usersPage(request.query.has("search") ? [ANA, ALICE] : []),
  );
  const { screen, field } = await renderPicker({ first: ALICE });

  await field.fill("a");
  await field.fill("an");

  await expect
    .poll(() => optionNames(screen))
    .toEqual(["Alice Smith @asmithYou", "Ana Garcia @agarcia"]);
});

test("says how many users match when more match than it lists, and that none match", async () => {
  stubApi((request) =>
    request.query.get("search") === "zz"
      ? usersPage([])
      : usersPage([ANA], { total: 63 }),
  );
  const { screen, field } = await renderPicker();

  await field.fill("an");
  await expect
    .element(
      screen.getByText(
        "The first 1 of 63 users that match. Type more to narrow them.",
      ),
    )
    .toBeVisible();

  await field.fill("zz");
  await expect.element(screen.getByText("No users match.")).toBeVisible();
});

test("shows the loading indicator while the users load, and why they couldn't be read", async () => {
  let respond!: (response: Response) => void;
  stubApi(
    () =>
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
  );
  const { screen } = await renderPicker();

  await expect
    .element(screen.getByRole("progressbar", { name: "Loading" }))
    .toBeVisible();
  respond(errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION"));

  await expect
    .element(screen.getByText("You don't have permission to do this."))
    .toBeVisible();
  expect(
    screen.getByRole("progressbar", { name: "Loading" }).query(),
  ).toBeNull();
});

test("marks the user who holds the field as chosen, and takes no choice of them", async () => {
  stubApi(() => usersPage([ANA, BOB]));
  const onChoose = vi.fn();
  const { screen } = await renderPicker({ chosen: BOB.id, onChoose });
  const bob = screen.getByRole("option", { name: "Bob Wilson @bwilson" });
  await expect.element(bob).toHaveAttribute("aria-selected", "true");

  await bob.click();
  await nextFrames();

  expect(onChoose).not.toHaveBeenCalled();
  await screen.getByRole("option", { name: "Ana Garcia @agarcia" }).click();
  expect(onChoose).toHaveBeenCalledExactlyOnceWith(ANA);
});

test("chooses a user from the keyboard, from the search field", async () => {
  stubApi(() => usersPage([ANA, BOB]));
  const onChoose = vi.fn();
  const { screen, field } = await renderPicker({ onChoose });
  await expect
    .element(screen.getByRole("option", { name: "Bob Wilson @bwilson" }))
    .toBeVisible();
  field.element().focus();

  await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

  expect(onChoose).toHaveBeenCalledExactlyOnceWith(BOB);
  await expect.element(field).toHaveFocus();
});

test("makes no user current as the users of a term arrive, so that Enter chooses only a user that the arrow keys made current", async () => {
  stubApi((request) =>
    usersPage(request.query.get("search") === "bo" ? [BOB] : [ANA, BOB]),
  );
  const onChoose = vi.fn();
  const { screen, field } = await renderPicker({ first: ALICE, onChoose });
  await expect
    .element(screen.getByRole("option", { name: "Ana Garcia @agarcia" }))
    .toBeVisible();
  field.element().focus();

  await userEvent.keyboard("bo");
  await expect.poll(() => optionNames(screen)).toEqual(["Bob Wilson @bwilson"]);
  // Once React Aria has followed the new users.
  await nextFrames();
  await userEvent.keyboard("{Enter}");

  expect(field.element().getAttribute("aria-activedescendant")).toBeNull();
  expect(onChoose).not.toHaveBeenCalled();
  await userEvent.keyboard("{ArrowDown}{Enter}");
  expect(onChoose).toHaveBeenCalledExactlyOnceWith(BOB);
});

test("offers its action before the users while no term is typed", async () => {
  stubApi(() => usersPage([ANA]));
  const onChoose = vi.fn();
  const { screen, field } = await renderPicker({
    action: "Unassign yourself",
    onChoose,
  });
  const action = screen.getByRole("option", { name: "Unassign yourself" });
  await expect
    .element(screen.getByRole("option", { name: "Ana Garcia @agarcia" }))
    .toBeVisible();
  expect(optionNames(screen)).toEqual([
    "Unassign yourself",
    "Ana Garcia @agarcia",
  ]);

  expect(groupsOf(screen)).toEqual([
    ["Unassign yourself"],
    ["Ana Garcia @agarcia"],
  ]);

  await action.click();
  expect(onChoose).toHaveBeenCalledExactlyOnceWith("action");

  await field.fill("a");
  await expect.element(action).not.toBeInTheDocument();
});

test("marks the choice in progress busy, says so, and the other choices unavailable, which take no choice meanwhile", async () => {
  stubApi(() => usersPage([ANA, BOB]));
  const onChoose = vi.fn();
  const { screen, field } = await renderPicker({
    action: "Unassign yourself",
    busy: BOB.id,
    onChoose,
  });
  const bob = screen.getByRole("option", { name: "Bob Wilson @bwilson" });
  await expect.element(bob).toBeVisible();

  expect(animationsIn(bob.element())).toEqual(["spin"]);
  await expect.element(bob).not.toHaveAttribute("aria-disabled");
  const ana = screen.getByRole("option", { name: "Ana Garcia @agarcia" });
  expect(animationsIn(ana.element())).toEqual([]);
  for (const other of [
    ana,
    screen.getByRole("option", { name: "Unassign yourself" }),
  ]) {
    await expect.element(other).toHaveAttribute("aria-disabled", "true");
    expect(getComputedStyle(other.element()).opacity).toBe("0.6");
  }
  await expect
    .element(screen.getByRole("status").getByText("Changing the assignee."))
    .toBeVisible();
  // The arrow keys pass over the other choices.
  field.element().focus();
  await userEvent.keyboard("{ArrowDown}");
  await expect
    .element(field)
    .toHaveAttribute("aria-activedescendant", bob.element().id);
  await ana.click({ force: true });
  expect(onChoose).not.toHaveBeenCalled();
});

test("marks its action busy while it is in progress, its mark standing still under reduced motion", async () => {
  stubApi(() => usersPage([ANA]));
  const { screen } = await renderPicker({
    action: "Unassign yourself",
    busy: "action",
  });
  const action = screen.getByRole("option", { name: "Unassign yourself" });
  await expect.element(action).toBeVisible();
  expect(animationsIn(action.element())).toEqual(["spin"]);

  await commands.emulateReducedMotion(true);

  await expect.poll(() => animationsIn(action.element())).toEqual([]);
});

test("ends its search field with Clear search while it holds a term, which brings back the users without a term and the action, and takes at most 500 characters", async () => {
  stubApi((request) =>
    usersPage(request.query.get("search") === "bo" ? [BOB] : [ANA, BOB]),
  );
  const { screen, field } = await renderPicker({ action: "Unassign yourself" });
  const clear = screen.getByRole("button", { name: "Clear search" });
  await expect
    .element(screen.getByRole("option", { name: "Ana Garcia @agarcia" }))
    .toBeVisible();
  expect(clear.query()).toBeNull();
  await expect.element(field).toHaveAttribute("maxlength", "500");

  await field.fill("bo");
  await expect.poll(() => optionNames(screen)).toEqual(["Bob Wilson @bwilson"]);
  await clear.click();

  await expect.element(field).toHaveValue("");
  await expect
    .poll(() => optionNames(screen))
    .toEqual([
      "Unassign yourself",
      "Ana Garcia @agarcia",
      "Bob Wilson @bwilson",
    ]);
});

test("shows its error at the field, which takes the focus, and tells when the term changes", async () => {
  stubApi(() => usersPage([]));
  const onInput = vi.fn();
  const { screen, field } = await renderPicker({
    error: "This user can't be the assignee of this Ticket.",
    onInput,
  });

  await expect
    .element(
      screen.getByText("This user can't be the assignee of this Ticket."),
    )
    .toBeVisible();
  await expect.element(field).toHaveAttribute("aria-invalid", "true");
  await expect
    .element(field)
    .toHaveAccessibleDescription(
      "This user can't be the assignee of this Ticket.",
    );
  // The field that takes the focus is read with its error, which is then
  // not announced as well.
  await expect.element(field).toHaveFocus();
  await nextFrames();
  expect(statusTexts(screen)).not.toContain(
    "This user can't be the assignee of this Ticket.",
  );

  await field.fill("b");
  expect(onInput).toHaveBeenCalled();
});

test("announces its error while the field holds the focus, as after a choice, for each new error, until the term changes", async () => {
  stubApi(() => usersPage([]));
  const { screen, field, rerender } = await renderPicker();
  await field.click();
  await expect.element(field).toHaveFocus();
  const message = "This user can't be the assignee of this Ticket.";

  await rerender({ error: message });

  await expect.poll(() => statusTexts(screen)).toContain(message);
  await expect.element(field).toHaveFocus();
  await expect.element(field).toHaveAccessibleDescription(message);

  // A new failure with the same error is announced again: the region adds
  // the text anew, which assistive technologies announce.
  const announced = announcedNode(screen, message);
  await rerender({});
  await rerender({ error: message });

  await expect.poll(() => announcedNode(screen, message)).not.toBe(announced);
  expect(announcedNode(screen, message)).toBeDefined();

  await userEvent.keyboard("b");

  await expect.poll(() => statusTexts(screen)).not.toContain(message);
});
