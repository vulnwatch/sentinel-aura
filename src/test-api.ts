import { vi } from "vitest";
import type {
  CurrentUserResponse,
  ErrorResponse,
  LoginResponse,
  ValidationErrorResponse,
} from "./api/generated/model";

// What several unit and component tests share (docs/conventions.md, Tests):
// fictional responses of Sentinel's API, which replace the browser's fetch
// under the shared request function, so that no test makes a network request.

const REQUEST_ID = "01890a5d-ac96-774b-bcce-b302099a8057";

// The signed-in user of the tests, as Get Current User returns it.
export const FICTIONAL_USER: CurrentUserResponse = {
  data: {
    id: "00000000-0000-0000-0000-000000000001",
    username: "jdoe",
    email: "john.doe@example.com",
    full_name: "John Doe",
    roles: [],
    capabilities: [],
    active: true,
    bot: false,
  },
};

// Another user, who signs in in another tab.
export const OTHER_USER: CurrentUserResponse = {
  data: {
    id: "00000000-0000-0000-0000-000000000002",
    username: "asmith",
    email: "alice.smith@example.com",
    full_name: "Alice Smith",
    roles: ["vulnerability_analyst"],
    capabilities: ["triage_ticket"],
    active: true,
    bot: false,
  },
};

// A JSON response with the request identifier that Sentinel sets.
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Request-ID": REQUEST_ID },
  });
}

// An error response of Sentinel, with its code.
export function errorResponse(status: number, code: string): Response {
  const body: ErrorResponse = { code, detail: "A fictional detail" };
  return jsonResponse(status, body);
}

// The response with which Sentinel answers a request without a valid
// session.
export function unauthorized(): Response {
  return errorResponse(401, "AUTH_NOT_AUTHENTICATED");
}

// A VALIDATION_ERROR response with the locations of its errors.
export function validationError(locations: (string | number)[][]): Response {
  const body: ValidationErrorResponse = {
    code: "VALIDATION_ERROR",
    detail: "Request validation failed",
    errors: locations.map((loc) => ({
      loc,
      msg: "A fictional message",
      type: "string_type",
    })),
  };
  return jsonResponse(422, body);
}

// A successful sign-in, whose token the UI does not use.
export function signedIn(): Response {
  const body: LoginResponse = {
    data: {
      access_token: "fictional.access.token",
      token_type: "bearer",
      expires_at: "2026-10-09T14:05:09Z",
    },
  };
  return jsonResponse(200, body);
}

// A request that a test answers.
export interface ApiRequest {
  method: string;
  // The path of the URL, such as /api/v1/users/me.
  path: string;
  // The parsed JSON body, or undefined.
  body: unknown;
}

export type ApiResponder = (
  request: ApiRequest,
) => Response | Promise<Response>;

// The path of the URL of a request.
function pathOf(input: RequestInfo | URL): string {
  const url = input instanceof Request ? input.url : input.toString();
  return new URL(url, window.location.origin).pathname;
}

// Answers every request of the page with the responder, and returns the spy,
// whose calls name the requests.
export function stubApi(respond: ApiResponder) {
  return vi.spyOn(window, "fetch").mockImplementation((input, init) => {
    const body = init?.body;
    return Promise.resolve(
      respond({
        method: init?.method ?? "GET",
        path: pathOf(input),
        body: typeof body === "string" ? JSON.parse(body) : undefined,
      }),
    );
  });
}

// How many requests the spy received for the path.
export function requestsTo(
  spy: ReturnType<typeof stubApi>,
  path: string,
): number {
  return spy.mock.calls.filter(([input]) => pathOf(input) === path).length;
}
