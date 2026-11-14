import { afterEach, describe, expect, test, vi } from "vitest";
import { TicketStatusValue } from "./generated/model";
import { listTickets, createTicket, getTicket } from "./generated/tickets";
import { getUser } from "./generated/users";
import {
  ApiError,
  apiRequest,
  NetworkError,
  UnreadableResponseError,
} from "./request";

function stubFetch(response: Response) {
  return vi.spyOn(window, "fetch").mockResolvedValue(response);
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("The promise was not rejected");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiRequest", () => {
  test("sends the request with same-origin credentials and returns the JSON body", async () => {
    const fetch = stubFetch(jsonResponse(200, { data: { id: "SNTL-1" } }));
    const signal = new AbortController().signal;

    const body = await apiRequest("/api/v1/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cve_id: "CVE-2024-1234" }),
      signal,
    });

    expect(body).toEqual({ data: { id: "SNTL-1" } });
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/v1/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cve_id: "CVE-2024-1234" }),
      signal,
      credentials: "same-origin",
    });
  });

  test("keeps same-origin credentials whatever the caller passes", async () => {
    const fetch = stubFetch(jsonResponse(200, { data: [] }));

    await apiRequest("/api/v1/tickets", {
      method: "GET",
      credentials: "include",
    });

    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/v1/tickets", {
      method: "GET",
      credentials: "same-origin",
    });
  });

  test("returns undefined for 204 No Content", async () => {
    stubFetch(new Response(null, { status: 204 }));

    await expect(
      apiRequest("/api/v1/auth/logout", { method: "POST" }),
    ).resolves.toBeUndefined();
  });

  test.each([
    "https://sentinel.example.com/api/v1/tickets",
    "//sentinel.example.com/api/v1/tickets",
    "/api/v2/tickets",
    "/api/openapi.json",
    "/apidocs",
    "api/v1/tickets",
  ])(
    "refuses %s, which is not an origin-relative URL under /api/v1/",
    async (url) => {
      const fetch = stubFetch(jsonResponse(200, {}));

      await expect(apiRequest(url, { method: "GET" })).rejects.toThrow(
        TypeError,
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  test("turns an error response of Sentinel into an ApiError with its code and body", async () => {
    const errorBody = {
      code: "VALIDATION_ERROR",
      detail: "Request validation failed",
      errors: [
        { loc: ["body", "cve_id"], msg: "Field required", type: "missing" },
      ],
    };
    stubFetch(jsonResponse(422, errorBody));

    const error = await rejection(
      apiRequest("/api/v1/tickets", { method: "POST" }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      body: errorBody,
    });
  });

  test("turns an error response without JSON into an ApiError without a code", async () => {
    stubFetch(
      new Response("<html><body>Bad Gateway</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
    );

    const error = await rejection(
      apiRequest("/api/v1/tickets", { method: "GET" }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 502,
      code: undefined,
      body: undefined,
    });
  });

  test.each([
    ["a code that is not a string", { code: 404, detail: "Not Found" }],
    ["no code", { detail: "Not Found" }],
    ["a JSON value that is not an object", "Not Found"],
  ])(
    "turns an error response with %s into an ApiError without a code",
    async (_, body) => {
      stubFetch(jsonResponse(404, body));

      const error = await rejection(
        apiRequest("/api/v1/tickets", { method: "GET" }),
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 404,
        code: undefined,
        body: undefined,
      });
    },
  );

  test("gives an error response the identifier of its request", async () => {
    stubFetch(
      jsonResponse(
        503,
        { code: "REDIS_UNAVAILABLE", detail: "Redis is unavailable" },
        { "X-Request-ID": "01890a5d-ac96-774b-bcce-b302099a8057" },
      ),
    );

    const error = await rejection(
      apiRequest("/api/v1/tickets", { method: "GET" }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 503,
      code: "REDIS_UNAVAILABLE",
      requestId: "01890a5d-ac96-774b-bcce-b302099a8057",
    });
  });

  test("gives an error response without JSON the identifier of its request", async () => {
    stubFetch(
      new Response("Internal Server Error", {
        status: 500,
        headers: { "X-Request-ID": "01890a5d-ac96-774b-bcce-b302099a8058" },
      }),
    );

    const error = await rejection(
      apiRequest("/api/v1/tickets", { method: "GET" }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 500,
      code: undefined,
      requestId: "01890a5d-ac96-774b-bcce-b302099a8058",
    });
  });

  test("gives an error response without the header no request identifier", async () => {
    stubFetch(jsonResponse(429, "Too Many Requests"));

    const error = await rejection(
      apiRequest("/api/v1/tickets", { method: "GET" }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, requestId: undefined });
  });

  test("turns a request that receives no response into a NetworkError", async () => {
    const failure = new TypeError("Failed to fetch");
    vi.spyOn(window, "fetch").mockRejectedValue(failure);

    const error = await rejection(
      apiRequest("/api/v1/tickets", { method: "GET" }),
    );

    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({ cause: failure });
  });

  test("lets a cancelled request fail with the browser's error", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.spyOn(window, "fetch").mockRejectedValue(controller.signal.reason);

    await expect(
      apiRequest("/api/v1/tickets", {
        method: "GET",
        signal: controller.signal,
      }),
    ).rejects.toBe(controller.signal.reason);
  });

  test.each([
    ["is not JSON", "<html><body>Sentinel</body></html>"],
    ["is empty", null],
  ])(
    "turns a successful response whose body %s into an UnreadableResponseError",
    async (_, body) => {
      stubFetch(
        new Response(body, {
          status: 200,
          headers: { "X-Request-ID": "01890a5d-ac96-774b-bcce-b302099a8059" },
        }),
      );

      const error = await rejection(
        apiRequest("/api/v1/tickets", { method: "GET" }),
      );

      expect(error).toBeInstanceOf(UnreadableResponseError);
      expect(error).toMatchObject({
        status: 200,
        requestId: "01890a5d-ac96-774b-bcce-b302099a8059",
      });
    },
  );

  test("turns a successful response whose body breaks off into a NetworkError", async () => {
    const failure = new TypeError("network error");
    const response = jsonResponse(200, { data: [] });
    vi.spyOn(response, "text").mockRejectedValue(failure);
    stubFetch(response);

    const error = await rejection(
      apiRequest("/api/v1/tickets", { method: "GET" }),
    );

    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({ cause: failure });
  });

  test.each([200, 404])(
    "lets a request that is cancelled while its body with status %i is read fail with the browser's error",
    async (status) => {
      const controller = new AbortController();
      controller.abort();
      const reason: unknown = controller.signal.reason;
      const response = jsonResponse(status, { data: [] });
      // A successful response is read as text, an error response as JSON.
      vi.spyOn(response, status === 200 ? "text" : "json").mockRejectedValue(
        reason,
      );
      stubFetch(response);

      await expect(
        apiRequest("/api/v1/tickets", {
          method: "GET",
          signal: controller.signal,
        }),
      ).rejects.toBe(reason);
    },
  );
});

// A user reference, as a response of the API carries it, with the avatar_url
// that a test gives it.
function userWith(avatarUrl: string | null) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    username: "jdoe",
    full_name: "John Doe",
    active: true,
    bot: false,
    avatar_url: avatarUrl,
  };
}

// A response with its own URL, as the browser gives it after any redirect,
// which a response that a test creates lacks.
function responseAt(url: string, body: unknown): Response {
  const response = jsonResponse(200, body);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

// The avatar_url of every user representation is a URI reference, which the
// shared request function resolves against the URL of the response that
// carries it (Sentinel docs/features/identity/user-avatars.md, Avatar URL;
// docs/conventions.md, API Access).
describe("the URL of a user's profile picture", () => {
  const RESPONSE_URL = "https://sentinel.example.com/api/v1/tickets/SNTL-1";

  test.each([
    [
      "an absolute URL, which stays unchanged,",
      "https://avatars.slack-edge.com/fictional/jdoe_192.jpg",
      "https://avatars.slack-edge.com/fictional/jdoe_192.jpg",
    ],
    [
      "a path",
      "/pictures/jdoe.jpg",
      "https://sentinel.example.com/pictures/jdoe.jpg",
    ],
    [
      "a relative path",
      "pictures/jdoe.jpg",
      "https://sentinel.example.com/api/v1/tickets/pictures/jdoe.jpg",
    ],
    [
      "a relative path with dot segments",
      "../../pictures/jdoe.jpg",
      "https://sentinel.example.com/api/pictures/jdoe.jpg",
    ],
    [
      "a reference without a scheme",
      "//pictures.example.com/jdoe.jpg",
      "https://pictures.example.com/jdoe.jpg",
    ],
  ])(
    "resolves %s against the URL of the response",
    async (_, avatarUrl, resolved) => {
      stubFetch(responseAt(RESPONSE_URL, { data: userWith(avatarUrl) }));

      const body = await apiRequest("/api/v1/tickets/SNTL-1", {
        method: "GET",
      });

      expect(body).toEqual({ data: userWith(resolved) });
    },
  );

  test("resolves against the URL of the response after a redirect, not of the request", async () => {
    stubFetch(
      responseAt("https://sentinel.example.com/api/v1/users/jdoe", {
        data: userWith("pictures/jdoe.jpg"),
      }),
    );

    const body = await apiRequest("/api/v1/users/me", { method: "GET" });

    expect(body).toEqual({
      data: userWith(
        "https://sentinel.example.com/api/v1/users/pictures/jdoe.jpg",
      ),
    });
  });

  test("resolves against the URL of the request when the response states none", async () => {
    stubFetch(jsonResponse(200, { data: userWith("pictures/jdoe.jpg") }));

    const body = await apiRequest("/api/v1/users/me", { method: "GET" });

    expect(body).toEqual({
      data: userWith(
        `${window.location.origin}/api/v1/users/pictures/jdoe.jpg`,
      ),
    });
  });

  test("resolves every user of the response, at any depth, and keeps null", async () => {
    stubFetch(
      responseAt(RESPONSE_URL, {
        data: {
          assignee: userWith("/pictures/a.jpg"),
          priority_override_by: userWith(null),
          packages: [{ maintainers: [userWith("/pictures/b.jpg")] }],
        },
      }),
    );

    const body = await apiRequest("/api/v1/tickets/SNTL-1", {
      method: "GET",
    });

    expect(body).toEqual({
      data: {
        assignee: userWith("https://sentinel.example.com/pictures/a.jpg"),
        priority_override_by: userWith(null),
        packages: [
          {
            maintainers: [
              userWith("https://sentinel.example.com/pictures/b.jpg"),
            ],
          },
        ],
      },
    });
  });

  test("gives null for a value that does not resolve, as for a picture that fails to load", async () => {
    stubFetch(responseAt(RESPONSE_URL, { data: userWith("https://[") }));

    const body = await apiRequest("/api/v1/tickets/SNTL-1", {
      method: "GET",
    });

    expect(body).toEqual({ data: userWith(null) });
  });

  test("resolves no other field", async () => {
    const references = {
      url: "pictures/jdoe.jpg",
      reference_url: "/pictures/jdoe.jpg",
      title: "avatar_url",
    };
    stubFetch(responseAt(RESPONSE_URL, { data: references }));

    const body = await apiRequest("/api/v1/tickets/SNTL-1", {
      method: "GET",
    });

    expect(body).toEqual({ data: references });
  });
});

describe("the generated client", () => {
  test("sends a query through apiRequest", async () => {
    const fetch = stubFetch(
      jsonResponse(200, {
        data: [],
        meta: { total: 0, page: 2, per_page: 20 },
      }),
    );

    await listTickets({ page: 2, status: ["new", "analysis"] });

    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "/api/v1/tickets?page=2&status=new&status=analysis",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
  });

  test("sends a JSON request body through apiRequest", async () => {
    const fetch = stubFetch(jsonResponse(201, { data: { id: "SNTL-1" } }));

    await createTicket({ cve_id: "CVE-2024-1234" });

    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "/api/v1/tickets",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ cve_id: "CVE-2024-1234" }),
        credentials: "same-origin",
      }),
    );
  });

  test.each([
    [() => getTicket("SNTL-1"), "/api/v1/tickets/SNTL-1"],
    [() => getUser("jdoe/../admin"), "/api/v1/users/jdoe%2F..%2Fadmin"],
  ])("encodes the path parameters", async (request, url) => {
    const fetch = stubFetch(jsonResponse(200, { data: {} }));

    await request();

    expect(fetch).toHaveBeenCalledExactlyOnceWith(url, expect.anything());
  });

  // A later Sentinel release within the supported Sentinel versions can
  // return what the contract of the pinned version does not list (Sentinel
  // docs/api-spec.md, Client Tolerance of Non-Breaking Changes;
  // docs/conventions.md, Data Read from the API; Error Codes and Messages).
  test("returns a field and an enum value that the pinned contract does not list unchanged", async () => {
    // Neither the status value nor the field is in TicketDetail of the
    // pinned OpenAPI document.
    const body = {
      data: {
        ticket_id: "SNTL-1",
        status: "embargoed",
        review_notes: "A fictional field of a later release",
      },
    };
    expect(Object.values(TicketStatusValue)).not.toContain("embargoed");
    stubFetch(jsonResponse(200, body));

    await expect(getTicket("SNTL-1")).resolves.toEqual(body);
  });

  test("turns an error with a status and a code that the operation does not list into an ApiError", async () => {
    // The pinned OpenAPI document lists neither 409 nor this code for
    // GET /api/v1/tickets/{ticket_id}.
    const errorBody = {
      code: "TICKET_FICTIONAL_CONDITION",
      detail: "A fictional condition of a later release",
    };
    stubFetch(jsonResponse(409, errorBody));

    const error = await rejection(getTicket("SNTL-1"));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "TICKET_FICTIONAL_CONDITION",
      body: errorBody,
    });
  });
});
