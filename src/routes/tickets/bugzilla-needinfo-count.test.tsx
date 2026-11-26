import { describe, expect, test } from "vitest";
import "../../styles.css";
import { errorResponse, jsonResponse, requestsTo, urlOf } from "../../test-api";
import {
  ANALYST,
  client,
  expectSummary,
  later,
  NEEDINFO,
  NEEDINFO_SEARCH,
  needinfoCount,
  prepareEachTest,
  READER,
  renderApp,
  returnToForeground,
  ROW,
  stubTickets,
  summaryOf,
  tableOf,
  withCapabilities,
  type Screen,
} from "./test-support";

// The Bugzilla needinfo count of the attention summary of the Ticket list
// (src/routes/tickets/bugzilla-needinfo-count.tsx;
// docs/screens/ticket-list.md), from Get Bugzilla Needinfo Count (Sentinel
// docs/features/integrations/bugzilla-needinfo-count.md).

prepareEachTest();

// The count, by its label, whether it is a link or not.
function labelOf(screen: Screen) {
  return summaryOf(screen).getByText("Bugzilla needinfo", { exact: true });
}

// The count as a link, by its accessible name.
function linkOf(screen: Screen, name: string) {
  return summaryOf(screen).getByRole("link", { name, exact: true });
}

// The item of the summary that holds the count, whether it is a link or not.
function itemOf(screen: Screen) {
  return summaryOf(screen)
    .getByRole("listitem")
    .filter({ hasText: "Bugzilla needinfo" });
}

// The text of the count, with the words that assistive technologies read
// after its label.
function textOf(screen: Screen): string {
  return itemOf(screen).element().textContent;
}

// The queries of the reads of the count, in their order.
function needinfoQueries(spy: ReturnType<typeof stubTickets>["spy"]) {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname === NEEDINFO)
    .map((url) => url.search);
}

// Waits until no read is in progress, then for the two animation frames in
// which React renders what the reads set and runs the effects of that render
// (docs/conventions.md, Tests).
async function settled() {
  await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
}

// The error that the browser's fetch raises when no response arrives.
function networkFailure(): Promise<Response> {
  return Promise.reject(new TypeError("Failed to fetch"));
}

describe("the Bugzilla needinfo count", () => {
  test("shows a user who holds triage_ticket the number of bugs, as a link to the Bugzilla search of the response, read once, without parameters", async () => {
    const { spy } = stubTickets();
    const { screen } = await renderApp("/tickets?view=new");
    const link = linkOf(screen, "4 Bugzilla needinfo (another site)");

    await expect.element(link).toHaveAttribute("href", NEEDINFO_SEARCH);
    await expectSummary(screen);
    await settled();
    expect(needinfoQueries(spy)).toEqual([""]);
  });

  test.each([
    ["holds no capability", READER],
    [
      "holds other capabilities, without triage_ticket",
      withCapabilities(ANALYST, ["create_ticket", "manage_packages"]),
    ],
  ])(
    "shows no count, and sends no read of it, to a user who %s",
    async (_, user) => {
      const { spy } = stubTickets({ user });
      const { screen } = await renderApp("/tickets?view=new");
      await expectSummary(screen, false);
      await settled();

      expect(labelOf(screen).query()).toBeNull();
      expect(requestsTo(spy, NEEDINFO)).toBe(0);
    },
  );

  test.each([
    ["authenticated", true],
    ["anonymous", false],
  ])(
    "shows the same count when the read of Bugzilla was %s",
    async (_, authenticated) => {
      stubTickets({
        needinfo: () => needinfoCount(4, NEEDINFO_SEARCH, authenticated),
      });
      const { screen } = await renderApp("/tickets?view=new");
      const link = linkOf(screen, "4 Bugzilla needinfo (another site)");

      await expect.element(link).toBeVisible();
      expect(link.element().textContent).toBe(
        "4 Bugzilla needinfo (another site)",
      );
    },
  );

  test("shows zero, not as not available", async () => {
    stubTickets({ needinfo: () => needinfoCount(0) });
    const { screen } = await renderApp("/tickets?view=new");

    await expect
      .element(linkOf(screen, "0 Bugzilla needinfo (another site)"))
      .toHaveAttribute("href", NEEDINFO_SEARCH);
  });

  test("shows its label alone, without a link, while it loads, and delays neither the other counts nor the rows", async () => {
    const pending = later();
    stubTickets({ needinfo: () => pending.promise });
    const { screen } = await renderApp("/tickets?view=new");

    await expectSummary(screen, false);
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: ROW.ticket_id }))
      .toBeVisible();
    await expect.element(labelOf(screen)).toBeVisible();
    expect(textOf(screen)).toBe("Bugzilla needinfo");
    expect(itemOf(screen).getByRole("link").query()).toBeNull();

    pending.resolve(needinfoCount());
    await expect
      .element(linkOf(screen, "4 Bugzilla needinfo (another site)"))
      .toBeVisible();
  });

  test.each([
    [
      "503 BUGZILLA_UNAVAILABLE, after its two retries",
      () => errorResponse(503, "BUGZILLA_UNAVAILABLE"),
      3,
    ],
    ["a network failure, after its two retries", networkFailure, 3],
    [
      "a 500, after its two retries",
      () => errorResponse(500, "INTERNAL_ERROR"),
      3,
    ],
    [
      "an error that the contract does not list for the operation",
      () => errorResponse(409, "FICTIONAL_CONFLICT"),
      1,
    ],
    [
      "a successful response that the UI cannot read",
      () =>
        new Response("not JSON", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      1,
    ],
  ])(
    "shows as not available, without a link, when its read fails with %s, and leaves the rest of the screen as it is",
    async (_, failure, reads) => {
      const { spy } = stubTickets({ needinfo: failure });
      const { screen } = await renderApp("/tickets?view=new");

      await expect
        .element(itemOf(screen))
        .toHaveTextContent("– Bugzilla needinfo not available");
      expect(itemOf(screen).getByRole("link").query()).toBeNull();
      await expectSummary(screen, false);
      await expect
        .element(
          tableOf(screen).getByRole("rowheader", { name: ROW.ticket_id }),
        )
        .toBeVisible();
      expect(screen.getByRole("alert").query()).toBeNull();
      await settled();
      expect(requestsTo(spy, NEEDINFO)).toBe(reads);
    },
  );

  test("reads it again with the next read of the list while its read has failed, still not available until that read succeeds, and no longer once it has a number", async () => {
    const { stub, spy } = stubTickets({
      needinfo: () => errorResponse(503, "BUGZILLA_UNAVAILABLE"),
    });
    const { router, screen } = await renderApp("/tickets?view=new");
    await expect
      .element(itemOf(screen))
      .toHaveTextContent("– Bugzilla needinfo not available");
    await settled();
    expect(requestsTo(spy, NEEDINFO)).toBe(3);

    const pending = later();
    stub.needinfo = () => pending.promise;
    router.history.push("/tickets?view=analysis");

    // Not available while it is read again.
    await expect.poll(() => requestsTo(spy, NEEDINFO)).toBe(4);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    expect(textOf(screen)).toBe("– Bugzilla needinfo not available");

    pending.resolve(needinfoCount());
    await expect
      .element(linkOf(screen, "4 Bugzilla needinfo (another site)"))
      .toBeVisible();
    expect(requestsTo(spy, NEEDINFO)).toBe(4);

    router.history.push("/tickets?view=analyzed");
    await expect
      .element(screen.getByRole("tab", { name: /^Analyzed/ }))
      .toHaveAttribute("aria-selected", "true");
    await settled();
    expect(requestsTo(spy, NEEDINFO)).toBe(4);
  });

  test("is read again when the tab returns to the foreground once it has a number, and keeps the link of its last search when that read fails", async () => {
    const { stub, spy } = stubTickets();
    const { screen } = await renderApp("/tickets?view=new");
    await expect
      .element(linkOf(screen, "4 Bugzilla needinfo (another site)"))
      .toBeVisible();

    stub.needinfo = () => errorResponse(503, "BUGZILLA_UNAVAILABLE");
    await returnToForeground();

    const failed = linkOf(
      screen,
      "Bugzilla needinfo not available (another site)",
    );
    await expect.element(failed).toHaveAttribute("href", NEEDINFO_SEARCH);
    expect(failed.element().textContent).toBe(
      "– Bugzilla needinfo not available (another site)",
    );
    await settled();
    // The first read, then the read after the return and its two retries.
    expect(requestsTo(spy, NEEDINFO)).toBe(4);

    stub.needinfo = () => needinfoCount(5);
    await returnToForeground();

    await expect
      .element(linkOf(screen, "5 Bugzilla needinfo (another site)"))
      .toBeVisible();
  });

  test.each([
    // A value that the check rejects, never a URL that the code follows.
    // oxlint-disable-next-line no-script-url
    ["javascript:alert(1)"],
    ["pkg:rpm/suse/fictional-bugzilla"],
    ["/buglist.cgi?v1=needinfo%3F"],
    [""],
  ])(
    "shows its number without a link when the address of the search is %j, which is not a web address",
    async (url) => {
      stubTickets({ needinfo: () => needinfoCount(4, url) });
      const { screen } = await renderApp("/tickets?view=new");

      await expect
        .element(summaryOf(screen).getByText("4 Bugzilla needinfo"))
        .toBeVisible();
      expect(textOf(screen)).toBe("4 Bugzilla needinfo");
      expect(itemOf(screen).getByRole("link").query()).toBeNull();
    },
  );

  test("goes, and the focus moves from it to the heading, when a read of the signed-in user tells that the user no longer holds triage_ticket", async () => {
    const { stub } = stubTickets();
    const { screen } = await renderApp("/tickets?view=new");
    const count = linkOf(screen, "4 Bugzilla needinfo (another site)");
    await expect.element(count).toBeVisible();
    count.element().focus();

    stub.user = withCapabilities(ANALYST, []);
    await returnToForeground();

    await expect.element(labelOf(screen)).not.toBeInTheDocument();
    await expectSummary(screen, false);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toHaveFocus();
  });

  test("shows when a read of the signed-in user tells that the user holds triage_ticket", async () => {
    const { stub, spy } = stubTickets({ user: READER });
    const { screen } = await renderApp("/tickets?view=new");
    await expectSummary(screen, false);

    // The same user, with triage_ticket.
    stub.user = withCapabilities(READER, ["triage_ticket"]);
    await returnToForeground();

    await expect
      .element(linkOf(screen, "4 Bugzilla needinfo (another site)"))
      .toBeVisible();
    await settled();
    expect(requestsTo(spy, NEEDINFO)).toBe(1);
  });
});

// A response of Get Bugzilla Needinfo Count with a field that the pinned
// contract does not list, which a later Sentinel release can add (Sentinel
// docs/api-spec.md, Client Tolerance of Non-Breaking Changes).
test("ignores a field of the response that the pinned contract does not list", async () => {
  stubTickets({
    needinfo: () =>
      jsonResponse(200, {
        data: {
          count: 4,
          authenticated: true,
          url: NEEDINFO_SEARCH,
          fictional_field: "fictional",
        },
      }),
  });
  const { screen } = await renderApp("/tickets?view=new");

  await expect
    .element(linkOf(screen, "4 Bugzilla needinfo (another site)"))
    .toHaveAttribute("href", NEEDINFO_SEARCH);
});
