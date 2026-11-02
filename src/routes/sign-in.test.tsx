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
  FICTIONAL_USER,
  jsonResponse,
  requestsTo,
  stubApi,
  unauthorized,
  type ApiRequest,
} from "../test-api";

const LOGIN = "/api/v1/auth/login";
const REQUEST_ID = "01890a5d-ac96-774b-bcce-b302099a8057";

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
  me: () => Response = () => jsonResponse(200, FICTIONAL_USER),
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

function signedIn(): Response {
  return jsonResponse(200, {
    data: {
      access_token: "fictional.access.token",
      token_type: "bearer",
      expires_at: "2026-10-09T14:05:09Z",
    },
  });
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

async function fillIn(
  screen: Awaited<ReturnType<typeof renderSignIn>>["screen"],
  username: string,
  password: string,
) {
  if (username !== "") {
    await screen.getByRole("textbox", { name: "Username" }).fill(username);
  }
  if (password !== "") {
    await screen.getByLabelText("Password").fill(password);
  }
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
    expect(signIns).toEqual([
      {
        method: "POST",
        path: LOGIN,
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
      .element(screen.getByRole("heading", { level: 1, name: "Sentinel Aura" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/");
  });

  test("is busy until the session is known, and sends the sign-in once", async () => {
    let answer!: (response: Response) => void;
    const fetch = stubSignIn(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    const { screen } = await renderSignIn();
    await fillIn(screen, "jdoe", "fictional password");
    const button = screen.getByRole("button", { name: "Sign in" });

    await button.click();
    await expect.poll(() => requestsTo(fetch, LOGIN)).toBe(1);
    await expect.element(button).toHaveAttribute("aria-disabled", "true");
    await button.click({ force: true });
    await screen.getByLabelText("Password").click();
    await userEvent.keyboard("{Enter}");
    answer(signedIn());

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sentinel Aura" }))
      .toBeVisible();
    expect(requestsTo(fetch, LOGIN)).toBe(1);
  });
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

describe("Sign in, after a failure", () => {
  test.each([
    [
      "rejected credentials",
      () =>
        jsonResponse(401, {
          code: "AUTH_INVALID_CREDENTIALS",
          detail: "Invalid username or password.",
        }),
      "The username or password isn't correct.",
      false,
    ],
    [
      "a 401 without a code",
      () => new Response("Unauthorized", { status: 401 }),
      "The username or password isn't correct.",
      false,
    ],
    [
      "a locked account",
      () =>
        new Response(
          JSON.stringify({
            code: "AUTH_ACCOUNT_LOCKED",
            detail: "Account temporarily locked. Try again later.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "540",
            },
          },
        ),
      "Too many attempts. Try again later.",
      false,
    ],
    [
      "a 500",
      () => jsonResponse(500, { code: "INTERNAL_ERROR" }),
      "Something went wrong in Sentinel. Try again, and if it happens again, report it with the reference below.",
      true,
    ],
    [
      "a 503",
      () => jsonResponse(503, { code: "DATABASE_UNAVAILABLE" }),
      "Sentinel isn't available right now. Try again later.",
      true,
    ],
    [
      "403 AUTH_CROSS_ORIGIN_REJECTED",
      () => jsonResponse(403, { code: "AUTH_CROSS_ORIGIN_REJECTED" }),
      "Something went wrong in Sentinel. Try again, and if it happens again, report it with the reference below.",
      true,
    ],
    [
      "a status that the pinned contract does not list",
      () => jsonResponse(418, { code: "FICTIONAL_UNLISTED_CODE" }),
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

      const text = screen.getByText(message);
      await expect.element(text).toBeVisible();
      expect(text.element().closest("[tabindex='-1']")).toBe(
        document.activeElement,
      );
      if (reference) {
        await expect.element(screen.getByText(REQUEST_ID)).toBeVisible();
      }
      await expect
        .element(screen.getByRole("textbox", { name: "Username" }))
        .toHaveValue("jdoe");
      await expect
        .element(screen.getByLabelText("Password"))
        .toHaveValue("fictional password");
      await expect
        .element(screen.getByRole("button", { name: "Sign in" }))
        .not.toHaveAttribute("aria-disabled");
      expect(router.state.location.pathname).toBe("/login");
    },
  );

  test("shows the field errors of a VALIDATION_ERROR at their fields, and moves the focus to the first", async () => {
    stubSignIn(() =>
      jsonResponse(422, {
        code: "VALIDATION_ERROR",
        detail: "Request validation failed",
        errors: [
          { loc: ["body", "password"], msg: "Fictional", type: "string_type" },
        ],
      }),
    );
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

  test("shows a field error of a VALIDATION_ERROR that matches no field as an error of the form", async () => {
    stubSignIn(() =>
      jsonResponse(422, {
        code: "VALIDATION_ERROR",
        detail: "Request validation failed",
        errors: [{ loc: ["body"], msg: "Fictional", type: "json_invalid" }],
      }),
    );
    const { screen } = await renderSignIn();
    await fillIn(screen, "jdoe", "fictional password");

    await screen.getByRole("button", { name: "Sign in" }).click();

    await expect
      .element(screen.getByText("Sentinel didn't accept this request."))
      .toBeVisible();
  });

  test("shows the failure of the read of the signed-in user that follows a sign-in", async () => {
    stubSignIn(signedIn, () =>
      jsonResponse(503, { code: "DATABASE_UNAVAILABLE" }),
    );
    const { router, screen } = await renderSignIn();
    await fillIn(screen, "jdoe", "fictional password");

    await screen.getByRole("button", { name: "Sign in" }).click();

    await expect
      .element(
        screen.getByText(
          "Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
  });

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

  test("clears the message of a failure when the form is sent again", async () => {
    let answer!: (response: Response) => void;
    let attempts = 0;
    stubSignIn(() => {
      attempts += 1;
      return attempts === 1
        ? jsonResponse(401, { code: "AUTH_INVALID_CREDENTIALS" })
        : new Promise<Response>((resolve) => {
            answer = resolve;
          });
    });
    const { screen } = await renderSignIn();
    await fillIn(screen, "jdoe", "fictional password");
    await screen.getByRole("button", { name: "Sign in" }).click();
    const message = screen.getByText("The username or password isn't correct.");
    await expect.element(message).toBeVisible();

    await screen.getByRole("button", { name: "Sign in" }).click();

    await expect
      .element(screen.getByRole("button", { name: "Sign in" }))
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(message).not.toBeInTheDocument();
    answer(signedIn());
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sentinel Aura" }))
      .toBeVisible();
  });
});
