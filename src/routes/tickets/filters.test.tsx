import { describe, expect, test } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import {
  ALL_PAGE,
  EMBARGO_ANALYST,
  EMBARGO_PAGE,
  EXPIRED,
  FILTERS,
  openFilters,
  prepareEachTest,
  queriesOf,
  QUEUE_SORT,
  renderApp,
  stubTickets,
  toggle,
} from "./test-support";

// The filters of the Ticket list (src/routes/tickets/filters.tsx;
// docs/screens/ticket-list.md), at the browser's default text size, in the
// light theme.

prepareEachTest();

// The checkbox of a value of a filter in the popover of the filters.
function optionOf(dialog: Locator, filter: string, value: string) {
  return dialog
    .getByRole("group", { name: filter })
    .getByRole("checkbox", { name: value });
}

describe("the filters", () => {
  // The filters of every view, with the names of their values.
  const FILTER_VALUES = [
    ["Severity", ["Critical", "High", "Medium", "Low", "None", "Not set"]],
    ["Priority", ["P1", "P2", "P3", "P4", "Not set"]],
    ["Current phase", ["Triage", "Submission", "UM", "QA", "Done"]],
    ["Overdue", ["Triage", "Submission", "UM", "QA"]],
  ] as const;
  const STATUS_VALUES = [
    "Status",
    ["New", "Analysis", "Analyzed", "Resolved", "Ignored", "Duplicated"],
  ] as const;
  // The reasons of an ignored Ticket by their names (Sentinel
  // docs/features/tickets/tickets.md, Ignore Reason).
  const IGNORE_REASON_VALUES = [
    "Ignore reason",
    ["Not shipped", "CVE rejected", "CNA policy", "Other"],
  ] as const;
  const EMBARGO_VALUES = ["Embargo", ["Expired"]] as const;

  test.each([
    [
      "the All view",
      "",
      [STATUS_VALUES, IGNORE_REASON_VALUES, ...FILTER_VALUES],
      "New",
    ],
    [
      "a queue, without the status and the ignore reason filters",
      "?view=new",
      FILTER_VALUES,
      "Critical",
    ],
    [
      "a queue of several statuses, without the status and the ignore reason filters",
      "?view=unassigned",
      FILTER_VALUES,
      "Critical",
    ],
    [
      "the Embargo view, with the status, the ignore reason, and the embargo filters",
      "?view=embargo",
      [STATUS_VALUES, IGNORE_REASON_VALUES, EMBARGO_VALUES, ...FILTER_VALUES],
      "New",
    ],
  ])(
    "offer in %s their values, and move the focus to the first",
    async (_, search, filters, first) => {
      stubTickets({ user: EMBARGO_ANALYST });
      const { screen } = await renderApp(`/tickets${search}`);

      const dialog = await openFilters(screen);

      const groups = dialog.getByRole("group");
      expect(groups.elements()).toHaveLength(filters.length);
      for (const [index, [name, values]] of filters.entries()) {
        await expect.element(groups.nth(index)).toHaveAccessibleName(name);
        const boxes = groups.nth(index).getByRole("checkbox");
        expect(boxes.elements()).toHaveLength(values.length);
        for (const [position, value] of values.entries()) {
          await expect.element(boxes.nth(position)).toHaveAccessibleName(value);
          await expect.element(boxes.nth(position)).not.toBeChecked();
        }
      }
      await expect
        .element(groups.first().getByRole("checkbox", { name: first }))
        .toHaveFocus();
    },
  );

  test.each([
    ["Status", "Resolved", "status=resolved", "status=resolved"],
    [
      "Ignore reason",
      "CNA policy",
      "ignore_reason=cna_policy",
      "ignore_reason=cna_policy",
    ],
    ["Severity", "Not set", "severity=unresolved", "severity=unresolved"],
    ["Priority", "P1", "priority=p1", "priority=p1"],
    ["Current phase", "UM", "phase=um", "current_phase=um"],
    ["Overdue", "QA", "overdue=qa", "overdue=qa"],
  ])(
    "apply %s %s at once, at the first page, as a new entry of the browser history",
    async (filter, value, parameter, read) => {
      const { spy } = stubTickets();
      const { router, screen } = await renderApp("/tickets?page=2");
      const dialog = await openFilters(screen);

      await toggle(dialog, filter, value);

      await expect
        .poll(() => router.state.location.href)
        .toBe(`/tickets?${parameter}`);
      expect(router.history.length).toBe(2);
      await expect
        .poll(() => queriesOf(spy, "list").at(-1))
        .toBe(`${read}&${ALL_PAGE}`);
      // The popover stays, with the value checked.
      await expect.element(optionOf(dialog, filter, value)).toBeChecked();
    },
  );

  test("apply an ignore reason as a filter of its own, which leaves the statuses that apply as they are", async () => {
    const { spy } = stubTickets();
    const { router, screen } = await renderApp("/tickets?status=new");
    const dialog = await openFilters(screen);

    await toggle(dialog, "Ignore reason", "CNA policy");

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?status=new&ignore_reason=cna_policy");
    await expect
      .poll(() => queriesOf(spy, "list").at(-1))
      .toBe(`status=new&ignore_reason=cna_policy&${ALL_PAGE}`);
    await expect.element(optionOf(dialog, "Status", "New")).toBeChecked();
    await expect
      .element(optionOf(dialog, "Status", "Ignored"))
      .not.toBeChecked();
    await expect
      .element(screen.getByRole("button", { name: "Filters 2 applied" }))
      .toBeInTheDocument();
  });

  test("apply Embargo Expired at once in the Embargo view, at the first page, and count it among the filters that apply", async () => {
    const { spy } = stubTickets({ user: EMBARGO_ANALYST });
    const { router, screen } = await renderApp("/tickets?view=embargo&page=2");
    const dialog = await openFilters(screen);

    await toggle(dialog, "Embargo", "Expired");

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=embargo&embargo=expired");
    expect(router.history.length).toBe(2);
    await expect
      .poll(() => queriesOf(spy, "list").at(-1))
      .toBe(`${EXPIRED}&${EMBARGO_PAGE}`);
    await expect.element(optionOf(dialog, "Embargo", "Expired")).toBeChecked();

    await userEvent.keyboard("{Escape}");
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toHaveFocus();
  });

  test("keep the values of a filter in the order of the contract, count the filters that apply, and remove a filter without values", async () => {
    const { spy } = stubTickets();
    const { router, screen } = await renderApp("/tickets?view=new");
    const dialog = await openFilters(screen);

    await toggle(dialog, "Severity", "High");
    await toggle(dialog, "Severity", "Critical");
    await toggle(dialog, "Priority", "P2");

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=new&severity=critical&severity=high&priority=p2");
    await expect
      .poll(() => queriesOf(spy, "list").at(-1))
      .toBe(
        `${FILTERS.New}&severity=critical&severity=high&priority=p2&${QUEUE_SORT}&sort_order=desc&page=1&per_page=20`,
      );

    await toggle(dialog, "Severity", "High");
    await toggle(dialog, "Severity", "Critical");
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets?view=new&priority=p2");

    // Escape closes the popover, and the focus returns to Filters.
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toHaveFocus();
  });

  test("show the values that apply as checked", async () => {
    stubTickets();
    const { screen } = await renderApp(
      "/tickets?status=new&ignore_reason=not_shipped&severity=none&phase=done&overdue=triage",
    );
    await expect
      .element(screen.getByRole("button", { name: "Filters 5 applied" }))
      .toBeVisible();

    const dialog = await openFilters(screen);

    expect(
      dialog
        .getByRole("checkbox")
        .elements()
        .filter((box) => box instanceof HTMLInputElement && box.checked),
    ).toHaveLength(5);
    for (const [filter, value] of [
      ["Status", "New"],
      ["Ignore reason", "Not shipped"],
      ["Severity", "None"],
      ["Current phase", "Done"],
      ["Overdue", "Triage"],
    ] as const) {
      await expect.element(optionOf(dialog, filter, value)).toBeChecked();
    }
  });
});
