import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Form } from "react-aria-components";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import type { UserDirectoryData } from "../api/generated/model";
import { createQueryClient } from "../query-client";
import {
  errorResponse,
  fictionalDirectoryUser,
  requestsTo,
  stubApi,
  urlOf,
  usersPage,
} from "../test-api";
import { SEARCH_DELAY_MS, UserComboBox } from "./user-combobox";

// A combobox of users (docs/design-system.md, Forms), which searches the
// directory (Sentinel docs/features/identity/user-management.md, List Users).

const USERS = "/api/v1/users";

const CAROL = fictionalDirectoryUser({
  id: "00000000-0000-0000-0000-000000000008",
  username: "cwhite",
  email: "carol.white@example.com",
  full_name: "Carol White",
  roles: ["restricted_analyst"],
  assignment_eligibility: "non_confidential",
});

let client: QueryClient;

beforeEach(async () => {
  client = createQueryClient();
  // The delay between attempts is TanStack Query's; the tests remove it.
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

interface FieldProps {
  onChange?: (user: UserDirectoryData | null) => void;
  error?: string;
}

// The field in a form, which holds the user chosen.
function Field({ onChange = () => undefined, error }: FieldProps) {
  const [user, setUser] = useState<UserDirectoryData | null>(null);
  return (
    <Form validationErrors={error === undefined ? undefined : { user: error }}>
      <UserComboBox
        label="User"
        name="user"
        value={user}
        onChange={(chosen) => {
          setUser(chosen);
          onChange(chosen);
        }}
        unavailable={{ ids: new Set([CAROL.id]), label: "Has access" }}
      />
    </Form>
  );
}

async function renderField(props: FieldProps = {}) {
  const screen = await render(
    <QueryClientProvider client={client}>
      <div className="p-8">
        <Field {...props} />
      </div>
    </QueryClientProvider>,
  );
  return { screen, field: screen.getByRole("combobox", { name: "User" }) };
}

// The searches of the directory, as their queries.
function searches(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname === USERS)
    .map((url) => url.search);
}

test("asks for at least 2 characters without reading the directory", async () => {
  const spy = stubApi(() => usersPage([]));
  const { screen, field } = await renderField();

  await field.fill(" a ");

  await expect
    .element(screen.getByText("Enter at least 2 characters."))
    .toBeVisible();
  expect(requestsTo(spy, USERS)).toBe(0);
});

test("reads the active users of the term once the user stops typing, and lists each with the username", async () => {
  const spy = stubApi(() => usersPage([fictionalDirectoryUser(), CAROL]));
  const { screen, field } = await renderField();
  // The clock of the pause, which the test moves itself, so that the time
  // between two inputs does not depend on the speed of the browser.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  await field.fill("an");
  vi.advanceTimersByTime(SEARCH_DELAY_MS - 1);
  await field.fill("ana ");
  vi.advanceTimersByTime(SEARCH_DELAY_MS - 1);
  expect(requestsTo(spy, USERS)).toBe(0);
  vi.advanceTimersByTime(1);
  vi.useRealTimers();

  await expect
    .element(screen.getByRole("option", { name: "Ana Garcia @agarcia" }))
    .toBeVisible();
  expect(searches(spy)).toEqual(["?search=ana&active=true&per_page=20"]);
});

test("lists a user that it does not offer with the label that says why, disabled", async () => {
  stubApi(() => usersPage([fictionalDirectoryUser(), CAROL]));
  const { screen, field } = await renderField();

  await field.fill("an");

  const option = screen.getByRole("option", {
    name: "Carol White @cwhite Has access",
  });
  await expect.element(option).toHaveAttribute("aria-disabled", "true");
});

test("counts the characters of the term as Sentinel does, not the units of a string", async () => {
  const spy = stubApi(() => usersPage([]));
  const { screen, field } = await renderField();

  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  // One character outside the Basic Multilingual Plane, two units of a
  // string of JavaScript.
  await field.fill("\u{1F600}");
  vi.advanceTimersByTime(SEARCH_DELAY_MS);
  vi.useRealTimers();

  await expect
    .element(screen.getByText("Enter at least 2 characters."))
    .toBeVisible();
  expect(requestsTo(spy, USERS)).toBe(0);
});

test("shows the loading indicator in place of the users while they load", async () => {
  let respond!: (response: Response) => void;
  stubApi(
    () =>
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
  );
  const { screen, field } = await renderField();

  await field.fill("an");

  await expect
    .element(screen.getByRole("progressbar", { name: "Loading" }))
    .toBeVisible();
  respond(usersPage([fictionalDirectoryUser()]));
  await expect
    .element(screen.getByRole("option", { name: "Ana Garcia @agarcia" }))
    .toBeVisible();
  expect(
    screen.getByRole("progressbar", { name: "Loading" }).query(),
  ).toBeNull();
});

test("says how many users match when more match than it lists", async () => {
  stubApi(() => usersPage([fictionalDirectoryUser()], { total: 63 }));
  const { screen, field } = await renderField();

  await field.fill("an");

  await expect
    .element(screen.getByRole("option", { name: "Ana Garcia @agarcia" }))
    .toBeVisible();
  await expect
    .element(
      screen.getByText(
        "The first 1 of 63 users that match. Type more to narrow them.",
      ),
    )
    .toBeVisible();
});

test("says that no user matches", async () => {
  stubApi(() => usersPage([]));
  const { screen, field } = await renderField();

  await field.fill("zz");

  await expect.element(screen.getByText("No users match.")).toBeVisible();
});

test("says why the users couldn't be read", async () => {
  stubApi(() => errorResponse(503, "SERVICE_UNAVAILABLE"));
  const { screen, field } = await renderField();

  await field.fill("an");

  await expect
    .element(
      screen.getByText("Sentinel isn't available right now. Try again later."),
    )
    .toBeVisible();
});

test("shows the user chosen as its text, and holds no user once the input changes", async () => {
  stubApi(() => usersPage([fictionalDirectoryUser()]));
  const onChange = vi.fn();
  const { screen, field } = await renderField({ onChange });

  await field.fill("an");
  await screen.getByRole("option", { name: "Ana Garcia @agarcia" }).click();

  await expect.element(field).toHaveValue("Ana Garcia @agarcia");
  expect(onChange).toHaveBeenLastCalledWith(fictionalDirectoryUser());
  await field.fill("Ana");
  expect(onChange).toHaveBeenLastCalledWith(null);
});

test("shows the error of its form at the field", async () => {
  stubApi(() => usersPage([]));
  const { screen, field } = await renderField({ error: "Choose a user." });

  await expect.element(screen.getByText("Choose a user.")).toBeVisible();
  await expect.element(field).toHaveAttribute("aria-invalid", "true");
});
