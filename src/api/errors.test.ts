import { describe, expect, test } from "vitest";
import {
  isRequestFailure,
  presentFailure,
  type FailurePresentation,
  type RequestFailure,
} from "./errors";
import { ApiError, NetworkError, UnreadableResponseError } from "./request";

const REQUEST_ID = "01890a5d-ac96-774b-bcce-b302099a8057";

function errorResponse(status: number, code?: string): ApiError {
  return new ApiError(
    status,
    code,
    code === undefined ? undefined : { code, detail: "A fictional detail" },
    REQUEST_ID,
  );
}

const NOT_LOADED = "This page couldn't be loaded";
const NETWORK =
  "Sentinel can't be reached. Check your connection and try again.";
const NOT_ACCEPTED = "Sentinel didn't accept this request.";
const CONFLICT =
  "This can't be done in the current state, which may have changed. Check it and try again.";
const TOO_MANY = "Too many attempts. Try again later.";
const INTERNAL =
  "Something went wrong in Sentinel. Try again, and if it happens again, report it with the reference below.";
const UNAVAILABLE = "Sentinel isn't available right now. Try again later.";
const GONE = "This no longer exists, or you no longer have access to it.";
const UNCONFIRMED =
  "Sentinel didn't confirm this change. It may have taken effect: check before trying again.";

function shown(
  message: string,
  { reference, retry }: { reference?: string; retry: boolean },
  heading = NOT_LOADED,
): FailurePresentation {
  return { heading, message, reference, retry };
}

// docs/behaviors.md, Default Presentation by Status. Each failure of a read
// shows the same in place of a part of a screen and of the screen, except a
// 403 and a 404 (below).
const READ_FAILURES: [string, RequestFailure, FailurePresentation][] = [
  [
    "a network failure",
    new NetworkError({ cause: new TypeError("Failed to fetch") }),
    shown(NETWORK, { retry: true }),
  ],
  ["400", errorResponse(400), shown(NOT_ACCEPTED, { retry: false })],
  [
    "a 4xx that no row names",
    errorResponse(418, "FICTIONAL_CONDITION"),
    shown(NOT_ACCEPTED, { retry: false }),
  ],
  [
    "422 VALIDATION_ERROR of a request that no form sent",
    errorResponse(422, "VALIDATION_ERROR"),
    shown(NOT_ACCEPTED, { retry: false }),
  ],
  [
    "a 422 other than VALIDATION_ERROR",
    errorResponse(422, "FETCHER_SETTING_INVALID"),
    shown(NOT_ACCEPTED, { retry: false }),
  ],
  [
    "403 AUTH_CROSS_ORIGIN_REJECTED",
    errorResponse(403, "AUTH_CROSS_ORIGIN_REJECTED"),
    shown(INTERNAL, { reference: REQUEST_ID, retry: false }),
  ],
  [
    "409",
    errorResponse(409, "TICKET_INVALID_TRANSITION"),
    shown(CONFLICT, { retry: false }),
  ],
  [
    "a 409 with a code that the pinned contract does not list",
    errorResponse(409, "TICKET_FICTIONAL_CONDITION"),
    shown(CONFLICT, { retry: false }),
  ],
  [
    "429 of a proxy, without a code",
    errorResponse(429),
    shown(TOO_MANY, { retry: true }),
  ],
  [
    "429 AUTH_ACCOUNT_LOCKED",
    errorResponse(429, "AUTH_ACCOUNT_LOCKED"),
    shown(TOO_MANY, { retry: true }),
  ],
  [
    "500",
    errorResponse(500, "INTERNAL_ERROR"),
    shown(INTERNAL, { reference: REQUEST_ID, retry: true }),
  ],
  [
    "502 of a proxy, without a code",
    errorResponse(502),
    shown(UNAVAILABLE, { reference: REQUEST_ID, retry: true }),
  ],
  [
    "503",
    errorResponse(503, "REDIS_UNAVAILABLE"),
    shown(UNAVAILABLE, { reference: REQUEST_ID, retry: true }),
  ],
  [
    "504",
    errorResponse(504),
    shown(UNAVAILABLE, { reference: REQUEST_ID, retry: true }),
  ],
  [
    "a 5xx that no row names",
    errorResponse(507, "FICTIONAL_UNAVAILABLE"),
    shown(UNAVAILABLE, { reference: REQUEST_ID, retry: true }),
  ],
  [
    "a successful response that the UI cannot read",
    new UnreadableResponseError(200, REQUEST_ID, {
      cause: new SyntaxError("Unexpected token"),
    }),
    shown(INTERNAL, { reference: REQUEST_ID, retry: false }),
  ],
  [
    "a status that is neither successful nor an error",
    errorResponse(304),
    shown(INTERNAL, { reference: REQUEST_ID, retry: false }),
  ],
];

describe("presentFailure", () => {
  test.each(READ_FAILURES)(
    "presents %s of a read in place of a part",
    (_, failure, presentation) => {
      expect(presentFailure(failure, "part")).toEqual(presentation);
    },
  );

  test.each(READ_FAILURES)(
    "presents %s of a read in place of the content of a screen",
    (_, failure, presentation) => {
      expect(presentFailure(failure, "screen")).toEqual(presentation);
    },
  );

  test("shows no reference for a response without a request identifier", () => {
    const failure = new ApiError(503, undefined, undefined, undefined);

    expect(presentFailure(failure, "part")).toEqual(
      shown(UNAVAILABLE, { retry: true }),
    );
  });

  test.each([
    ["a code", errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION")],
    ["no code", errorResponse(403)],
  ])("presents a 403 with %s by where it appears", (_, failure) => {
    expect(presentFailure(failure, "screen")).toEqual(
      shown(
        "You don't have permission to view this page.",
        { retry: false },
        "No access",
      ),
    );
    expect(presentFailure(failure, "part")).toEqual(
      shown(
        "You don't have permission to do this.",
        { retry: false },
        "No access",
      ),
    );
    expect(presentFailure(failure, "change")).toEqual(
      shown(
        "You don't have permission to do this.",
        { retry: false },
        "No access",
      ),
    );
  });

  test.each([
    ["a code", errorResponse(404, "TICKET_NOT_FOUND")],
    ["the code of a route", errorResponse(404, "ROUTE_NOT_FOUND")],
    ["no code", errorResponse(404)],
  ])("presents a 404 with %s by where it appears", (_, failure) => {
    expect(presentFailure(failure, "screen")).toEqual(
      shown(
        "This page doesn't exist, or you don't have access to it.",
        { retry: false },
        "Not found",
      ),
    );
    expect(presentFailure(failure, "part")).toEqual(
      shown(GONE, { retry: false }),
    );
    expect(presentFailure(failure, "change")).toEqual(
      shown(GONE, { retry: false }),
    );
  });

  test.each(["screen", "part", "change", "session"] as const)(
    "shows no message for a 401 of a %s, whose session has ended",
    (context) => {
      expect(
        presentFailure(errorResponse(401, "AUTH_NOT_AUTHENTICATED"), context),
      ).toBeUndefined();
    },
  );

  test("decides by the status and the code, not by the detail", () => {
    const failure = new ApiError(
      409,
      "TICKET_INVALID_TRANSITION",
      { code: "TICKET_INVALID_TRANSITION", detail: "Ticket SNTL-1 is Ignored" },
      undefined,
    );

    expect(presentFailure(failure, "change")).toEqual(
      shown(CONFLICT, { retry: false }),
    );
  });

  describe("a change of Sentinel's data", () => {
    test("that receives no response is unconfirmed", () => {
      const failure = new NetworkError({
        cause: new TypeError("NetworkError"),
      });

      expect(presentFailure(failure, "change")?.message).toBe(UNCONFIRMED);
      expect(presentFailure(failure, "change")?.reference).toBeUndefined();
    });

    test.each([
      errorResponse(500, "INTERNAL_ERROR"),
      errorResponse(502),
      errorResponse(503, "CELERY_UNAVAILABLE"),
      errorResponse(507, "FICTIONAL_UNAVAILABLE"),
    ])(
      "that fails with $status is unconfirmed, with the reference",
      (failure) => {
        expect(presentFailure(failure, "change")).toMatchObject({
          message: UNCONFIRMED,
          reference: REQUEST_ID,
        });
      },
    );

    test.each([
      [
        "403 AUTH_CROSS_ORIGIN_REJECTED",
        errorResponse(403, "AUTH_CROSS_ORIGIN_REJECTED"),
        INTERNAL,
      ],
      ["409", errorResponse(409, "RESOURCE_CONFLICT"), CONFLICT],
      ["429", errorResponse(429), TOO_MANY],
      ["422", errorResponse(422, "VALIDATION_ERROR"), NOT_ACCEPTED],
    ])(
      "that fails with %s gets the message of its status",
      (_, failure, message) => {
        expect(presentFailure(failure, "change")?.message).toBe(message);
      },
    );
  });

  describe("sign-in and sign-out", () => {
    test.each([
      [
        "a network failure",
        new NetworkError({ cause: new TypeError("Failed to fetch") }),
        NETWORK,
      ],
      ["500", errorResponse(500, "INTERNAL_ERROR"), INTERNAL],
      ["503", errorResponse(503, "REDIS_UNAVAILABLE"), UNAVAILABLE],
    ])(
      "get the message of %s, not of an unconfirmed change",
      (_, failure, message) => {
        expect(presentFailure(failure, "session")?.message).toBe(message);
      },
    );
  });
});

describe("isRequestFailure", () => {
  test.each([
    errorResponse(404),
    new NetworkError({ cause: new TypeError("Failed to fetch") }),
    new UnreadableResponseError(200, undefined, { cause: undefined }),
  ])("is true for a failure of a request: %s", (error) => {
    expect(isRequestFailure(error)).toBe(true);
  });

  test.each([
    new TypeError("Cannot read properties of undefined"),
    new DOMException("The operation was aborted.", "AbortError"),
    "a string",
    undefined,
  ])("is false for anything else: %s", (error) => {
    expect(isRequestFailure(error)).toBe(false);
  });
});
