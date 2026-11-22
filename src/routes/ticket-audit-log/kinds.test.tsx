import { describe, expect, test } from "vitest";
import "../../styles.css";
import { TicketAuditEventType } from "../../api/generated/model";
import {
  eventReads,
  FIRST_PAGE,
  KINDS,
  openFilters,
  PATH,
  prepareEachTest,
  renderEvents,
  stubLog,
  toggleKind,
  typesOf,
} from "./test-support";

// The kinds of event of the tab Audit log
// (src/routes/ticket-audit-log/kinds.tsx; docs/screens/ticket.md, Audit log),
// at the browser's default text size, in the light theme.

prepareEachTest();

describe("the kinds", () => {
  test("are a group of checkboxes in their order, each with an icon, which cover every event type of the pinned contract once", async () => {
    stubLog();
    const { screen } = await renderEvents();

    const dialog = await openFilters(screen);

    const kinds = dialog.getByRole("group", { name: "Kind" });
    const boxes = kinds.getByRole("checkbox");
    expect(boxes.elements()).toHaveLength(KINDS.length);
    for (const [index, [name]] of KINDS.entries()) {
      await expect.element(boxes.nth(index)).toHaveAccessibleName(name);
      await expect.element(boxes.nth(index)).not.toBeChecked();
      expect(
        kinds.getByText(name, { exact: true }).element().querySelector("svg"),
      ).not.toBeNull();
    }
    expect(KINDS.flatMap(([, , types]) => types).toSorted()).toEqual(
      Object.values(TicketAuditEventType).toSorted(),
    );
  });

  test.each(KINDS)(
    "send the event types of %s at once, at the first page, as a new entry of the browser history",
    async (name, id, types) => {
      const { spy } = stubLog();
      const { router, screen } = await renderEvents(`${PATH}?page=2`);
      const dialog = await openFilters(screen);

      await toggleKind(dialog, name);

      await expect
        .poll(() => router.state.location.href)
        .toBe(`${PATH}?kind=${id}`);
      expect(router.history.length).toBe(2);
      await expect
        .poll(() => eventReads(spy).at(-1))
        .toBe(`${typesOf(...types)}&${FIRST_PAGE}`);
      await expect
        .element(
          dialog
            .getByRole("group", { name: "Kind" })
            .getByRole("checkbox", { name }),
        )
        .toBeChecked();
    },
  );

  test("keep the kinds in their order, and remove the filter without any", async () => {
    const { spy } = stubLog();
    const { router, screen } = await renderEvents();
    const dialog = await openFilters(screen);

    await toggleKind(dialog, "References");
    await toggleKind(dialog, "Status");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?kind=status&kind=references`);
    await expect
      .poll(() => eventReads(spy).at(-1))
      .toBe(`${typesOf(...KINDS[0][2], ...KINDS[6][2])}&${FIRST_PAGE}`);
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toBeVisible();

    await toggleKind(dialog, "References");
    await toggleKind(dialog, "Status");

    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect.poll(() => eventReads(spy).at(-1)).toBe(FIRST_PAGE);
  });
});
