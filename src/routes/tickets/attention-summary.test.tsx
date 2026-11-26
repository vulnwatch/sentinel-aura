import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import "../../styles.css";
import { errorResponse, ticketPage } from "../../test-api";
import {
  ALL_PAGE,
  ANALYST,
  ATTENTION,
  countOf,
  countQuery,
  EMBARGO_ANALYST,
  EMBARGO_PAGE,
  expectSummary,
  expectTabs,
  EXPIRED,
  filtersOf,
  later,
  NEEDINFO_SEARCH,
  NEEDINFO_TEXT,
  prepareEachTest,
  queriesOf,
  READER,
  renderApp,
  returnToForeground,
  stubTickets,
  summaryOf,
  withEligibility,
} from "./test-support";

// The attention summary of the Ticket list
// (src/routes/tickets/attention-summary.tsx; docs/screens/ticket-list.md), at
// the browser's default text size, in the light theme.

prepareEachTest();

describe("the attention summary", () => {
  test("shows its counts in the heading row, each a link to the All view refined to its Tickets, and Bugzilla needinfo after Active P1, a link to its search on Bugzilla", async () => {
    stubTickets();
    const { screen } = await renderApp("/tickets?view=new");
    const links = summaryOf(screen).getByRole("link");

    await expect
      .poll(() => links.elements().map((link) => link.textContent))
      .toEqual([
        "2 Active P1",
        NEEDINFO_TEXT,
        "1 Triage overdue",
        "0 Submission overdue",
        "1 UM overdue",
        "3 QA overdue",
      ]);
    expect(links.elements().map((link) => link.getAttribute("href"))).toEqual([
      "/tickets?status=new&status=analysis&status=analyzed&priority=p1",
      NEEDINFO_SEARCH,
      "/tickets?phase=triage&overdue=triage",
      "/tickets?phase=submission&overdue=submission",
      "/tickets?phase=um&overdue=um",
      "/tickets?phase=qa&overdue=qa",
    ]);
    // After the heading, on its row.
    const heading = screen
      .getByRole("heading", { level: 1, name: "Tickets" })
      .element()
      .getBoundingClientRect();
    const first = links.first().element().getBoundingClientRect();
    expect(first.left).toBeGreaterThan(heading.right);
    expect(first.top).toBeLessThan(heading.bottom);
  });

  test("sets the overdue counts apart from Active P1: a line, then the name Overdue, hidden from assistive technologies, then each count with its phase alone", async () => {
    // A user without triage_ticket, whose summary has no Bugzilla needinfo
    // count between Active P1 and the overdue counts.
    stubTickets({ user: READER });
    const { screen } = await renderApp("/tickets");
    const active = summaryOf(screen).getByRole("link", { name: "2 Active P1" });
    const triage = summaryOf(screen).getByRole("link", {
      name: "1 Triage overdue",
    });
    const label = summaryOf(screen).getByText("Overdue", { exact: true });
    await expectSummary(screen, false);

    // The counts show their phase, and the name of the group once.
    await expect
      .element(triage.getByText("Triage", { exact: true }))
      .toBeVisible();
    await expect.element(label).toBeVisible();
    expect(label.element().closest('[aria-hidden="true"]')).not.toBeNull();
    const style = getComputedStyle(label.element());
    expect([style.fontSize, style.color]).toEqual(["14px", "rgb(89, 99, 110)"]);
    // A line of 1 px in border, 20 px high, 12 px from Active P1 and from the
    // name, which is 8 px before the first count.
    const first = active.element().getBoundingClientRect();
    const line = document.elementFromPoint(
      first.right + 12.5,
      first.top + first.height / 2,
    )!;
    const box = line.getBoundingClientRect();
    expect([
      Math.round(box.left - first.right),
      Math.round(box.width),
      Math.round(box.height),
      getComputedStyle(line).backgroundColor,
    ]).toEqual([12, 1, 20, "rgb(216, 222, 228)"]);
    const name = label.element().getBoundingClientRect();
    expect(Math.round(name.left - box.right)).toBe(12);
    expect(
      Math.round(triage.element().getBoundingClientRect().left - name.right),
    ).toBe(8);
    // On one line in a wide window.
    expect(
      summaryOf(screen)
        .getByRole("link")
        .elements()
        .map((link) => link.getBoundingClientRect().top),
    ).toEqual(Array.from({ length: 5 }, () => first.top));
  });

  test("wraps the group of the overdue counts to the next line as a whole, and its counts after its name, in a narrow window", async () => {
    await page.viewport(320, 800);
    stubTickets();
    const { screen } = await renderApp("/tickets?view=new");
    const rect = (name: string) =>
      summaryOf(screen)
        .getByRole("link", { name })
        .element()
        .getBoundingClientRect();
    await expectSummary(screen);

    const active = rect("2 Active P1");
    const triage = rect("1 Triage overdue");
    const qa = rect("3 QA overdue");
    const name = summaryOf(screen)
      .getByText("Overdue", { exact: true })
      .element()
      .getBoundingClientRect();
    expect(triage.top).toBeGreaterThan(active.bottom);
    expect(name.top).toBe(triage.top);
    // The line stands 4 px after the start of the line, as the line of the
    // views does, and 12 px before the name.
    const line = document.elementFromPoint(
      active.left + 4.5,
      name.top + name.height / 2,
    )!;
    const box = line.getBoundingClientRect();
    expect([
      Math.round(box.left - active.left),
      Math.round(name.left - box.right),
      getComputedStyle(line).backgroundColor,
    ]).toEqual([4, 12, "rgb(216, 222, 228)"]);
    expect(qa.top).toBeGreaterThan(triage.top);
    expect(qa.left).toBeGreaterThanOrEqual(name.right);
    expect(qa.right).toBeLessThanOrEqual(window.innerWidth);
  });

  test("reads each count with its filters alone, from a read of one Ticket, whatever the user refined", async () => {
    const { spy } = stubTickets();
    const { screen } = await renderApp(
      "/tickets?view=new&search=curl&severity=high&sort=deadline",
    );
    await expect
      .element(summaryOf(screen).getByRole("link", { name: "3 QA overdue" }))
      .toBeVisible();

    const counts = queriesOf(spy, "count");
    for (const filters of Object.values(ATTENTION)) {
      expect(
        counts.filter((query) => query === countQuery(filters)),
      ).toHaveLength(1);
    }
  });

  test("shows the label of a count alone while it loads", async () => {
    const pending = later();
    stubTickets({
      count: (query) =>
        filtersOf(query) === ATTENTION["UM overdue"]
          ? pending.promise
          : countOf(query),
    });
    const { screen } = await renderApp("/tickets?view=new");

    await expect
      .element(summaryOf(screen).getByRole("link", { name: "3 QA overdue" }))
      .toBeVisible();
    await expect
      .element(
        summaryOf(screen).getByRole("link", {
          name: "UM overdue",
          exact: true,
        }),
      )
      .toBeVisible();

    pending.resolve(ticketPage([], { total: 1, perPage: 1 }));
    await expect
      .element(summaryOf(screen).getByRole("link", { name: "1 UM overdue" }))
      .toBeVisible();
  });

  test("shows a count as not available when its read fails, and reads it again with the next read of the list, still not available until that read succeeds", async () => {
    const { stub, spy } = stubTickets({
      count: (query) =>
        filtersOf(query) === ATTENTION["Active P1"]
          ? errorResponse(503, "DATABASE_UNAVAILABLE")
          : countOf(query),
    });
    const { router, screen } = await renderApp("/tickets?view=new");
    const failed = summaryOf(screen).getByRole("link", {
      name: "Active P1 not available",
    });

    await expect.element(failed).toBeVisible();
    expect(failed.element().textContent).toBe("– Active P1 not available");
    const reads = () =>
      queriesOf(spy, "count").filter(
        (query) => query === countQuery(ATTENTION["Active P1"]),
      ).length;
    // The read and its two retries.
    expect(reads()).toBe(3);

    const pending = later();
    stub.count = (query) =>
      filtersOf(query) === ATTENTION["Active P1"]
        ? pending.promise
        : countOf(query);
    router.history.push("/tickets?view=new&page=2");

    await expect.poll(reads).toBe(4);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    expect(failed.element().textContent).toBe("– Active P1 not available");

    pending.resolve(countOf(new URLSearchParams(ATTENTION["Active P1"])));
    await expect
      .element(summaryOf(screen).getByRole("link", { name: "2 Active P1" }))
      .toBeVisible();
    expect(reads()).toBe(4);
    // A count that loaded is not read again with the list.
    expect(
      queriesOf(spy, "count").filter(
        (query) => query === countQuery(ATTENTION["QA overdue"]),
      ),
    ).toHaveLength(1);
  });

  test("opens the All view refined to the Tickets of a count", async () => {
    const { spy } = stubTickets();
    const { router, screen } = await renderApp("/tickets?view=new");

    await summaryOf(screen).getByRole("link", { name: "1 UM overdue" }).click();

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?phase=um&overdue=um");
    await expect
      .element(screen.getByRole("tab", { name: /^All/ }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .poll(() => queriesOf(spy, "list").at(-1))
      .toBe(`current_phase=um&overdue=um&${ALL_PAGE}`);
  });

  test("shows Embargo expired after Active P1 and before Bugzilla needinfo to a user who holds manage_confidentiality, standing alone, as a link to the Embargo view refined to its Tickets", async () => {
    const { spy } = stubTickets({ user: EMBARGO_ANALYST });
    const { screen } = await renderApp("/tickets?view=new");
    const links = summaryOf(screen).getByRole("link");

    await expect
      .poll(() => links.elements().map((link) => link.textContent))
      .toEqual([
        "2 Active P1",
        "1 Embargo expired",
        NEEDINFO_TEXT,
        "1 Triage overdue",
        "0 Submission overdue",
        "1 UM overdue",
        "3 QA overdue",
      ]);
    await expect
      .element(links.nth(1))
      .toHaveAttribute("href", "/tickets?view=embargo&embargo=expired");
    expect(
      queriesOf(spy, "count").filter((query) => query === countQuery(EXPIRED)),
    ).toHaveLength(1);
    // 8 px after Active P1 and before Bugzilla needinfo, and the line of the
    // overdue counts 12 px after that, all on one line in a wide window.
    const active = links.first().element().getBoundingClientRect();
    const expired = links.nth(1).element().getBoundingClientRect();
    const needinfo = links.nth(2).element().getBoundingClientRect();
    expect([
      Math.round(expired.left - active.right),
      Math.round(needinfo.left - expired.right),
    ]).toEqual([8, 8]);
    const line = document.elementFromPoint(
      needinfo.right + 12.5,
      needinfo.top + needinfo.height / 2,
    )!;
    const box = line.getBoundingClientRect();
    expect([
      Math.round(box.left - needinfo.right),
      Math.round(box.width),
      getComputedStyle(line).backgroundColor,
    ]).toEqual([12, 1, "rgb(216, 222, 228)"]);
    expect(
      links.elements().map((link) => link.getBoundingClientRect().top),
    ).toEqual(Array.from({ length: 7 }, () => active.top));
  });

  test("opens the Embargo view refined to the Tickets of Embargo expired", async () => {
    const { spy } = stubTickets({ user: EMBARGO_ANALYST });
    const { router, screen } = await renderApp("/tickets?view=new");

    await summaryOf(screen)
      .getByRole("link", { name: "1 Embargo expired" })
      .click();

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=embargo&embargo=expired");
    await expect
      .element(screen.getByRole("tab", { name: "Embargo 3" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .poll(() => queriesOf(spy, "list").at(-1))
      .toBe(`${EXPIRED}&${EMBARGO_PAGE}`);
  });

  test("moves the focus from Embargo expired to the heading when a read of the signed-in user tells that the user no longer holds manage_confidentiality", async () => {
    const { stub } = stubTickets({ user: EMBARGO_ANALYST });
    const { screen } = await renderApp("/tickets?view=new");
    const count = summaryOf(screen).getByRole("link", {
      name: "1 Embargo expired",
    });
    await expect.element(count).toBeVisible();
    count.element().focus();

    stub.user = ANALYST;
    await returnToForeground();

    await expect.element(count).not.toBeInTheDocument();
    await expectSummary(screen);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toHaveFocus();
  });

  test("shows the same counts to a user who holds no capability and can be the assignee of no Ticket", async () => {
    const { spy } = stubTickets({ user: READER });
    const { screen } = await renderApp("/tickets");
    await expectTabs(screen, [
      "New 12",
      "Unassigned 1",
      "Analysis 5",
      "Analyzed 3",
      "All 1,250",
    ]);

    await expectSummary(screen, false);
    // The counts of the five views, and those of the summary.
    expect(queriesOf(spy, "count")).toHaveLength(10);
  });

  test("stays, with the focus on its count, when a read of the signed-in user tells that the user lost every capability and can be the assignee of no Ticket", async () => {
    const { stub } = stubTickets();
    const { screen } = await renderApp("/tickets");
    const count = summaryOf(screen).getByRole("link", { name: "2 Active P1" });
    await expect.element(count).toBeVisible();
    count.element().focus();

    stub.user = withEligibility(
      { data: { ...ANALYST.data, roles: [], capabilities: [] } },
      "none",
    );
    await returnToForeground();

    await expect
      .element(screen.getByRole("tab", { name: /^Assigned to me/ }))
      .not.toBeInTheDocument();
    await expectSummary(screen, false);
    await expect.element(count).toHaveFocus();
  });
});
