import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import type { ListUsersAssignmentEligibilityItem } from "../api/generated/model";
import { createQueryClient } from "../query-client";
import {
  errorResponse,
  fictionalDirectoryUser,
  requestsTo,
  stubApi,
  urlOf,
  usersPage,
} from "../test-api";
import type { UserFields } from "./user";
import { SEARCH_DELAY_MS } from "./user-combobox";
import { UserPicker } from "./user-picker";

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

async function renderPicker({
  eligibility = ["all", "non_confidential"],
  first,
  chosen = null,
  busy = null,
  action,
  onChoose = () => undefined,
  error,
  onInput = () => undefined,
}: PickerProps = {}) {
  const screen = await render(
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
          error={error}
          onInput={onInput}
        />
      </div>
    </QueryClientProvider>,
  );
  return {
    screen,
    field: screen.getByRole("searchbox", { name: "Search users" }),
  };
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
    .element(screen.getByRole("option", { name: "Alice Smith @asmith You" }))
    .toBeVisible();
  const names = optionNames(screen);
  expect(names).toHaveLength(20);
  expect(names[0]).toBe("Alice Smith @asmithYou");
  expect(names[19]).toBe("Fictional User 18 @user18");
  await expect
    .element(
      screen.getByText("The first 20 of 63 users. Type to find the others."),
    )
    .toBeVisible();
});

test("lists the first user once when the page holds them", async () => {
  stubApi(() => usersPage([ANA, ALICE, BOB]));
  const { screen } = await renderPicker({ first: ALICE });

  await expect
    .element(screen.getByRole("option", { name: "Alice Smith @asmith You" }))
    .toBeVisible();
  expect(optionNames(screen)).toEqual([
    "Alice Smith @asmithYou",
    "Ana Garcia @agarcia",
    "Bob Wilson @bwilson",
  ]);
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

  await action.click();
  expect(onChoose).toHaveBeenCalledExactlyOnceWith("action");

  await field.fill("a");
  await expect.element(action).not.toBeInTheDocument();
});

test("marks the choice in progress busy, and takes no other choice meanwhile", async () => {
  stubApi(() => usersPage([ANA, BOB]));
  const onChoose = vi.fn();
  const { screen } = await renderPicker({ busy: BOB.id, onChoose });
  const bob = screen.getByRole("option", { name: "Bob Wilson @bwilson" });
  await expect.element(bob).toBeVisible();

  expect(bob.element().querySelector(".animate-spin")).not.toBeNull();
  expect(
    screen
      .getByRole("option", { name: "Ana Garcia @agarcia" })
      .element()
      .querySelector(".animate-spin"),
  ).toBeNull();
  await screen.getByRole("option", { name: "Ana Garcia @agarcia" }).click();
  expect(onChoose).not.toHaveBeenCalled();
});

test("shows its error at the field, and tells when the term changes", async () => {
  const spy = stubApi(() => usersPage([]));
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

  await field.fill("b");
  expect(onInput).toHaveBeenCalled();
  expect(requestsTo(spy, USERS)).toBe(1);
});
