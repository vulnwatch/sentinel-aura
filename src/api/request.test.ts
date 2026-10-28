import { afterEach, describe, expect, test, vi } from "vitest";
import { TicketStatusValue } from "./generated/model";
import { listTickets, createTicket, getTicket } from "./generated/tickets";
import { getUser } from "./generated/users";
import { ApiError, apiRequest } from "./request";

function stubFetch(response: Response) {
  return vi.spyOn(window, "fetch").mockResolvedValue(response);
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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

  test("lets a request that receives no response fail with the browser's error", async () => {
    const failure = new TypeError("Failed to fetch");
    vi.spyOn(window, "fetch").mockRejectedValue(failure);

    await expect(apiRequest("/api/v1/tickets", { method: "GET" })).rejects.toBe(
      failure,
    );
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
