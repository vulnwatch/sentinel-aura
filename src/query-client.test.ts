import {
  focusManager,
  MutationObserver,
  onlineManager,
  QueryObserver,
  type QueryClient,
} from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiRequest, NetworkError } from "./api/request";
import { createQueryClient } from "./query-client";

let client: QueryClient;

// Mounted, as QueryClientProvider mounts it, so that it follows the visibility
// of the page and the network.
beforeEach(() => {
  client = createQueryClient();
  client.mount();
});

afterEach(() => {
  client.unmount();
  client.clear();
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// A read through the shared request function. The delay between attempts is
// TanStack Query's, which the behavior does not fix; the tests remove it.
function read() {
  return client.fetchQuery({
    queryKey: ["tickets"],
    queryFn: ({ signal }) =>
      apiRequest("/api/v1/tickets", { method: "GET", signal }),
    retryDelay: 0,
  });
}

function change() {
  return new MutationObserver(client, {
    mutationFn: () => apiRequest("/api/v1/tickets", { method: "POST" }),
  }).mutate();
}

// Observes a read as a screen does until it has succeeded or failed, and
// returns the function that stops observing it.
async function observe(until: "success" | "error") {
  const observer = new QueryObserver(client, {
    queryKey: ["tickets"],
    queryFn: ({ signal }) =>
      apiRequest("/api/v1/tickets", { method: "GET", signal }),
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await vi.waitUntil(() => observer.getCurrentResult().status === until);
  return unsubscribe;
}

// Resolves once the pending callbacks of the timers have run.
function settle() {
  return new Promise((resolve) => {
    setTimeout(resolve, 50);
  });
}

describe("a read", () => {
  test("is sent again up to two more times after a network failure", async () => {
    const fetch = vi
      .spyOn(window, "fetch")
      .mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(read()).rejects.toBeInstanceOf(NetworkError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test.each([500, 502, 503, 504])(
    "is sent again up to two more times after a %i",
    async (status) => {
      const fetch = vi
        .spyOn(window, "fetch")
        .mockImplementation(() =>
          Promise.resolve(jsonResponse(status, { code: "REDIS_UNAVAILABLE" })),
        );

      await expect(read()).rejects.toMatchObject({ status });
      expect(fetch).toHaveBeenCalledTimes(3);
    },
  );

  test("shows its data when a later attempt succeeds", async () => {
    const fetch = vi
      .spyOn(window, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await expect(read()).resolves.toEqual({ data: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test.each([
    ["a 400", () => jsonResponse(400, { code: "DATE_RANGE_INVERTED" })],
    [
      "a 403",
      () => jsonResponse(403, { code: "AUTH_INSUFFICIENT_PERMISSION" }),
    ],
    ["a 404", () => jsonResponse(404, { code: "TICKET_NOT_FOUND" })],
    ["a 429", () => new Response("Too Many Requests", { status: 429 })],
    ["an unreadable response", () => new Response("<html>", { status: 200 })],
  ])("is not sent again after %s", async (_, response) => {
    const fetch = vi
      .spyOn(window, "fetch")
      .mockImplementation(() => Promise.resolve(response()));

    await expect(read()).rejects.toBeInstanceOf(Error);
    expect(fetch).toHaveBeenCalledOnce();
  });

  test("is sent while the browser reports itself offline", async () => {
    onlineManager.setOnline(false);
    const fetch = vi
      .spyOn(window, "fetch")
      .mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(read()).rejects.toBeInstanceOf(NetworkError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  describe("that a screen shows", () => {
    test("is read again when the tab returns to the foreground", async () => {
      const fetch = vi
        .spyOn(window, "fetch")
        .mockImplementation(() =>
          Promise.resolve(jsonResponse(200, { data: [] })),
        );
      const unsubscribe = await observe("success");

      focusManager.setFocused(false);
      focusManager.setFocused(true);

      await expect.poll(() => fetch.mock.calls.length).toBe(2);
      unsubscribe();
    });

    test("is not read again when the tab returns to the foreground after it failed without data", async () => {
      const fetch = vi
        .spyOn(window, "fetch")
        .mockImplementation(() =>
          Promise.resolve(jsonResponse(404, { code: "TICKET_NOT_FOUND" })),
        );
      const unsubscribe = await observe("error");

      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await settle();

      expect(fetch).toHaveBeenCalledOnce();
      unsubscribe();
    });

    test("is read again when the tab returns to the foreground after a new read of its data failed", async () => {
      const fetch = vi
        .spyOn(window, "fetch")
        .mockResolvedValueOnce(jsonResponse(200, { data: [] }))
        .mockImplementation(() =>
          Promise.resolve(jsonResponse(404, { code: "TICKET_NOT_FOUND" })),
        );
      const unsubscribe = await observe("success");
      await client.refetchQueries({ queryKey: ["tickets"] });
      expect(client.getQueryState(["tickets"])?.status).toBe("error");

      focusManager.setFocused(false);
      focusManager.setFocused(true);

      await expect.poll(() => fetch.mock.calls.length).toBe(3);
      unsubscribe();
    });

    test("is not read again when the network returns", async () => {
      const fetch = vi
        .spyOn(window, "fetch")
        .mockImplementation(() =>
          Promise.resolve(jsonResponse(200, { data: [] })),
        );
      const unsubscribe = await observe("success");

      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await settle();

      expect(fetch).toHaveBeenCalledOnce();
      unsubscribe();
    });
  });
});

describe("a change", () => {
  test.each([
    [
      "a network failure",
      () => Promise.reject(new TypeError("Failed to fetch")),
    ],
    [
      "a 503",
      () => Promise.resolve(jsonResponse(503, { code: "CELERY_UNAVAILABLE" })),
    ],
  ])("is never sent again after %s", async (_, response) => {
    const fetch = vi.spyOn(window, "fetch").mockImplementation(response);

    await expect(change()).rejects.toBeInstanceOf(Error);
    await settle();
    expect(fetch).toHaveBeenCalledOnce();
  });

  test("is sent at once while the browser reports itself offline", async () => {
    onlineManager.setOnline(false);
    const fetch = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(jsonResponse(201, { data: { id: "SNTL-1" } }));

    await expect(change()).resolves.toEqual({ data: { id: "SNTL-1" } });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
