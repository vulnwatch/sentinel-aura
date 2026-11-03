import type { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import { getGetCurrentUserProfileQueryKey } from "../api/generated/users";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import { RETURN_URL_KEY, SESSION_RECORD_KEY } from "../session";
import {
  errorResponse,
  FICTIONAL_USER,
  jsonResponse,
  requestsTo,
  signedIn,
  stubApi,
  unauthorized,
  validationError,
  type ApiRequest,
} from "../test-api";

const LOGIN = "/api/v1/auth/login";
const ME = "/api/v1/users/me";
const REQUEST_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const INTERNAL =
  "Something went wrong in Sentinel. Try again, and if it happens again, report it with the reference below.";
const REJECTED = "The username or password isn't correct.";

let client: QueryClient;

beforeEach(() => {
  client = createQueryClient();
  client.setQueryDefaults(getGetCurrentUserProfileQueryKey(), {
    retryDelay: 0,
  });
});

afterEach(() => {
  client.clear();
  vi.restoreAllMocks();
  window.localStorage.removeItem(SESSION_RECORD_KEY);
  window.sessionStorage.removeItem(RETURN_URL_KEY);
  document.title = "Sentinel";
});

// Answers sign-in with the response of the test, after which the read of the
// signed-in user returns the user when the sign-in succeeded.
function stubSignIn(
  respond: (request: ApiRequest) => Response | Promise<Response>,
  me: () => Response | Promise<Response> = () =>
    jsonResponse(200, FICTIONAL_USER),
) {
  let session = false;
  return stubApi(async (request) => {
    if (request.path === LOGIN) {
      const response = await respond(request);
      session = response.ok;
      return response;
    }
    return session ? me() : unauthorized();
  });
}

// A response that the test gives when it chooses.
function later() {
  let answer!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    answer = resolve;
  });
  return { response, answer };
}

async function renderSignIn(path = "/login") {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
    .toBeVisible();
  return { router, screen };
}

type Screen = Awaited<ReturnType<typeof renderSignIn>>["screen"];

async function fillIn(screen: Screen, username: string, password: string) {
  if (username !== "") {
    await screen.getByRole("textbox", { name: "Username" }).fill(username);
  }
  if (password !== "") {
    await screen.getByLabelText("Password").fill(password);
  }
}

// Expects the focus on the message at the top of the form that holds the
// text.
async function expectFocusOnMessage(text: string) {
  await expect
    .poll(() => document.activeElement?.textContent ?? "")
    .toContain(text);
}

// Expects the input of the test kept, the button no longer busy, and Sign in
// still shown.
async function expectFormKept(screen: Screen) {
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("textbox", { name: "Username" }))
    .toHaveValue("jdoe");
  await expect
    .element(screen.getByLabelText("Password"))
    .toHaveValue("fictional password");
  await expect
    .element(screen.getByRole("button", { name: "Sign in" }))
    .not.toHaveAttribute("aria-disabled");
}

describe("Sign in", () => {
  test("shows the product name, its heading, and the form, and titles the page", async () => {
    stubSignIn(signedIn);
    const { screen } = await renderSignIn();

    await expect
      .element(screen.getByRole("main").getByText("Sentinel", { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("textbox", { name: "Username" }))
      .toHaveAttribute("autocomplete", "username");
    await expect
      .element(screen.getByLabelText("Password"))
      .toHaveAttribute("autocomplete", "current-password");
    await expect
      .element(screen.getByLabelText("Password"))
      .toHaveAttribute("type", "password");
    await expect
      .element(screen.getByRole("button", { name: "Sign in" }))
      .toBeVisible();
    expect(document.title).toBe("Sign in – Sentinel");
    // Sign in has no sidebar, and leads nowhere without a session.
    await expect
      .element(screen.getByRole("navigation"))
      .not.toBeInTheDocument();
    await expect.element(screen.getByRole("link")).not.toBeInTheDocument();
  });

  test("drops every search parameter from its URL", async () => {
    stubSignIn(signedIn);
    const { router } = await renderSignIn("/login?next=%2Ftickets#top");

    await expect.poll(() => router.state.location.href).toBe("/login#top");
    expect(router.history.length).toBe(1);
  });

  test("signs in with the username and password as typed, then opens the saved URL in its place", async () => {
    window.sessionStorage.setItem(RETURN_URL_KEY, "/fictional/path?view=all");
    const signIns: ApiRequest[] = [];
    stubSignIn((request) => {
      signIns.push(request);
      return signedIn();
    });
    const { router, screen } = await renderSignIn();

    await fillIn(screen, " JDoe ", "fictional password");
    await screen.getByRole("button", { name: "Sign in" }).click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    expect(router.state.location.href).toBe("/fictional/path?view=all");
    expect(router.history.length).toBe(1);
    expect(
      signIns.map(({ method, path, query, body }) => ({
        method,
        path,
        query: query.toString(),
        body,
      })),
    ).toEqual([
      {
        method: "POST",
        path: LOGIN,
        query: "",
        body: { username: " JDoe ", password: "fictional password" },
      },
    ]);
  });

  test("opens the landing after a sign-in without a saved URL", async () => {
    stubSignIn(signedIn);
    const { router, screen } = await renderSignIn();

    await fillIn(screen, "jdoe", "fictional password");
    await userEvent.keyboard("{Enter}");

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Home" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/");
  });

  test.each([
    ["the sign-in", "sign-in"],
    ["the read of the signed-in user that follows it", "read"],
  ] as const)(
    "is busy while %s is in progress, and sends the sign-in once",
    async (_, waiting) => {
      const { response, answer } = later();
      const fetch = stubSignIn(
        () => (waiting === "sign-in" ? response : signedIn()),
        () =>
          waiting === "read" ? response : jsonResponse(200, FICTIONAL_USER),
      );
      const { screen } = await renderSignIn();
      await fillIn(screen, "jdoe", "fictional password");
      const button = screen.getByRole("button", { name: "Sign in" });

      await button.click();
      await expect
        .poll(() => requestsTo(fetch, waiting === "sign-in" ? LOGIN : ME))
        .toBe(waiting === "sign-in" ? 1 : 2);
      await expect.element(button).toHaveAttribute("aria-disabled", "true");
      await button.click({ force: true });
      await screen.getByLabelText("Password").click();
      await userEvent.keyboard("{Enter}");
      answer(
        waiting === "sign-in" ? signedIn() : jsonResponse(200, FICTIONAL_USER),
      );

      await expect
        .element(screen.getByRole("heading", { level: 1, name: "Home" }))
        .toBeVisible();
      expect(requestsTo(fetch, LOGIN)).toBe(1);
    },
  );
});

describe("Sign in, before sending", () => {
  test.each([
    ["both fields are empty", "", "", "Username"],
    [
      "the username is only whitespace",
      "   ",
      "fictional password",
      "Username",
    ],
    ["the password is empty", "jdoe", "", "Password"],
  ])(
    "sends nothing when %s, and moves the focus to the first field with an error",
    async (_, username, password, focused) => {
      const fetch = stubSignIn(signedIn);
      const { screen } = await renderSignIn();

      await fillIn(screen, username, password);
      await screen.getByRole("button", { name: "Sign in" }).click();

      if (username.trim() === "") {
        await expect
          .element(screen.getByText("Enter your username."))
          .toBeVisible();
      }
      if (password === "") {
        await expect
          .element(screen.getByText("Enter your password."))
          .toBeVisible();
      }
      await expect.element(screen.getByLabelText(focused)).toHaveFocus();
      expect(requestsTo(fetch, LOGIN)).toBe(0);
    },
  );

  test("says which field is empty through the field", async () => {
    stubSignIn(signedIn);
    const { screen } = await renderSignIn();

    await screen.getByRole("button", { name: "Sign in" }).click();

    await expect
      .element(screen.getByRole("textbox", { name: "Username" }))
      .toHaveAccessibleDescription("Enter your username.");
    await expect
      .element(screen.getByRole("textbox", { name: "Username" }))
      .toBeInvalid();
  });
});

// A 429 of Sentinel, with the time that remains until the lockout expires.
function locked() {
  const response = errorResponse(429, "AUTH_ACCOUNT_LOCKED");
  response.headers.set("Retry-After", "540");
  return response;
}

describe("Sign in, after a failure", () => {
  test.each([
    [
      "rejected credentials",
      () => errorResponse(401, "AUTH_INVALID_CREDENTIALS"),
      REJECTED,
      false,
    ],
    [
      "a 401 without a code",
      () => new Response("Unauthorized", { status: 401 }),
      REJECTED,
      false,
    ],
    ["a locked account", locked, "Too many attempts. Try again later.", false],
    ["a 500", () => errorResponse(500, "INTERNAL_ERROR"), INTERNAL, true],
    [
      "a 503",
      () => errorResponse(503, "DATABASE_UNAVAILABLE"),
      "Sentinel isn't available right now. Try again later.",
      true,
    ],
    [
      "403 AUTH_CROSS_ORIGIN_REJECTED",
      () => errorResponse(403, "AUTH_CROSS_ORIGIN_REJECTED"),
      INTERNAL,
      true,
    ],
    [
      "a status that the pinned contract does not list",
      () => errorResponse(418, "FICTIONAL_UNLISTED_CODE"),
      "Sentinel didn't accept this request.",
      false,
    ],
    [
      "a network failure",
      () => Promise.reject(new TypeError("Failed to fetch")),
      "Sentinel can't be reached. Check your connection and try again.",
      false,
    ],
  ])(
    "shows %s at the top of the form, keeps the input, and moves the focus to the message",
    async (_, respond, message, reference) => {
      stubSignIn(respond);
      const { router, screen } = await renderSignIn();
      await fillIn(screen, "jdoe", "fictional password");

      await screen.getByRole("button", { name: "Sign in" }).click();

      await expect.element(screen.getByText(message)).toBeVisible();
      await expectFocusOnMessage(message);
      if (reference) {
        await expect.element(screen.getByText(REQUEST_ID)).toBeVisible();
      }
      await expectFormKept(screen);
      expect(router.state.location.pathname).toBe("/login");
    },
  );

  test("shows the field errors of a VALIDATION_ERROR at their fields, and moves the focus to the first of the form", async () => {
    stubSignIn(() =>
      validationError([
        ["body", "password"],
        ["body", "username"],
      ]),
    );
    const { screen } = await renderSignIn();
    await fillIn(screen, "jdoe", "fictional password");

    await screen.getByRole("button", { name: "Sign in" }).click();

    await expect
      .element(screen.getByLabelText("Password"))
      .toHaveAccessibleDescription("This value isn't valid.");
    await expect
      .element(screen.getByRole("textbox", { name: "Username" }))
      .toHaveAccessibleDescription("This value isn't valid.");
    await expect
      .element(screen.getByRole("textbox", { name: "Username" }))
      .toHaveFocus();
  });

  test("clears a field error of a VALIDATION_ERROR once its value changes, and only that one", async () => {
    stubSignIn(() => validationError([["body", "password"]]));
    const { screen } = await renderSignIn();
    await fillIn(screen, "jdoe", "fictional password");

    await screen.getByRole("button", { name: "Sign in" }).click();

    await expect
      .element(screen.getByLabelText("Password"))
      .toHaveAccessibleDescription("This value isn't valid.");
    await expect.element(screen.getByLabelText("Password")).toHaveFocus();
    await expect
      .element(screen.getByRole("textbox", { name: "Username" }))
      .not.toBeInvalid();

    // A changed value clears the error once the user leaves the field, and
    // the error does not return while the user changes another field.
    await screen.getByLabelText("Password").fill("another fictional password");
    await userEvent.keyboard("{Tab}");
    await expect
      .element(screen.getByText("This value isn't valid."))
      .not.toBeInTheDocument();
    await screen.getByRole("textbox", { name: "Username" }).fill("asmith");

    await expect
      .element(screen.getByText("This value isn't valid."))
      .not.toBeInTheDocument();
  });

  test("shows a field error of a VALIDATION_ERROR that matches no field as an error of the form, with the others at their fields", async () => {
    stubSignIn(() => validationError([["body"], ["body", "password"]]));
    const { screen } = await renderSignIn();
    await fillIn(screen, "jdoe", "fictional password");

    await screen.getByRole("button", { name: "Sign in" }).click();

    await expect
      .element(screen.getByText("Sentinel didn't accept this request."))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText("Password"))
      .toHaveAccessibleDescription("This value isn't valid.");
    await expectFocusOnMessage("Sentinel didn't accept this request.");
  });

  test.each([
    [
      "a 503",
      () => errorResponse(503, "DATABASE_UNAVAILABLE"),
      "Sentinel isn't available right now. Try again later.",
    ],
    [
      "a 401, after which the browser has no session",
      unauthorized,
      "Sentinel signed you in, but this browser didn't keep the session. Allow cookies for Sentinel, then sign in again.",
    ],
  ])(
    "shows %s of the read of the signed-in user that follows a sign-in, and stays",
    async (_, me, message) => {
      stubSignIn(signedIn, me);
      const { router, screen } = await renderSignIn();
      await fillIn(screen, "jdoe", "fictional password");

      await screen.getByRole("button", { name: "Sign in" }).click();

      await expect.element(screen.getByText(message)).toBeVisible();
      await expectFocusOnMessage(message);
      await expectFormKept(screen);
      expect(router.state.location.pathname).toBe("/login");
    },
  );

  test("leaves a failure of the UI itself to the page of a failure of the UI", async () => {
    stubSignIn(signedIn);
    const { screen } = await renderSignIn();
    await fillIn(screen, "jdoe", "fictional password");
    // A fault of the code that reads the response, not a failure of the
    // request.
    vi.spyOn(Headers.prototype, "get").mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined");
    });

    await screen.getByRole("button", { name: "Sign in" }).click();

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "Something went wrong" }),
      )
      .toBeVisible();
  });

  test("moves the focus to the empty field when the check stops the form, and keeps the message of the earlier failure", async () => {
    const fetch = stubSignIn(() =>
      errorResponse(401, "AUTH_INVALID_CREDENTIALS"),
    );
    const { screen } = await renderSignIn();
    await fillIn(screen, "jdoe", "fictional password");
    await screen.getByRole("button", { name: "Sign in" }).click();
    await expectFocusOnMessage(REJECTED);

    await screen.getByLabelText("Password").clear();
    await userEvent.keyboard("{Enter}");

    await expect
      .element(screen.getByText("Enter your password."))
      .toBeVisible();
    await expect.element(screen.getByLabelText("Password")).toHaveFocus();
    await expect.element(screen.getByText(REJECTED)).toBeVisible();
    expect(requestsTo(fetch, LOGIN)).toBe(1);
  });

  test("clears the message of a failure when the form is sent again", async () => {
    const { response, answer } = later();
    let attempts = 0;
    stubSignIn(() => {
      attempts += 1;
      return attempts === 1
        ? errorResponse(401, "AUTH_INVALID_CREDENTIALS")
        : response;
    });
    const { screen } = await renderSignIn();
    await fillIn(screen, "jdoe", "fictional password");
    await screen.getByRole("button", { name: "Sign in" }).click();
    const message = screen.getByText(REJECTED);
    await expect.element(message).toBeVisible();

    await screen.getByRole("button", { name: "Sign in" }).click();

    await expect
      .element(screen.getByRole("button", { name: "Sign in" }))
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(message).not.toBeInTheDocument();
    answer(signedIn());
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Home" }))
      .toBeVisible();
  });
});
