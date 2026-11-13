import {
  keepPreviousData,
  QueryClientProvider,
  useQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import { ApiError } from "../api/request";
import { createQueryClient } from "../query-client";
import { Button } from "./button";
import {
  DataTable,
  EmptyState,
  FramedTable,
  type TableColumn,
  type TableSort,
} from "./data-table";
import { ScreenHeading } from "./screen-heading";

// The table of the data of a read (docs/design-system.md, Tables), at the
// browser's default text size, in the light theme.

interface FictionalRecord {
  id: string;
  title: string;
}

interface FictionalPage {
  records: FictionalRecord[];
}

const UNAVAILABLE = new ApiError(503, "REDIS_UNAVAILABLE", {}, undefined);
const FORBIDDEN = new ApiError(403, "AUTH_FORBIDDEN", {}, undefined);

const COLUMNS: readonly TableColumn<FictionalRecord>[] = [
  {
    id: "id",
    name: "Record",
    isRowHeader: true,
    render: (record) => <button type="button">{record.id}</button>,
  },
  { id: "title", name: "Title", grows: true, render: (record) => record.title },
  {
    id: "state",
    name: "State",
    allowsSorting: true,
    render: () => "A fictional state of the record",
  },
];

// The response to each page, which a test prepares in turn.
const respond = vi.fn<(page: number) => Promise<FictionalPage>>();

let client: QueryClient;

beforeEach(async () => {
  client = createQueryClient();
  await page.viewport(1280, 800);
});

afterEach(async () => {
  // Before the responses go, so that the table of the test reads nothing
  // more.
  await cleanup();
  client.clear();
  respond.mockReset();
  document.title = "Sentinel";
  await page.viewport(414, 896);
});

function later() {
  let resolve!: (records: FictionalPage) => void;
  const promise = new Promise<FictionalPage>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function pageOf(...ids: string[]): FictionalPage {
  return { records: ids.map((id) => ({ id, title: `Fictional ${id}` })) };
}

interface RecordsProps {
  page: number;
  sort?: TableSort;
  onSort?: (column: string) => void;
}

function Records({ page: number, sort, onSort }: RecordsProps) {
  const read = useQuery({
    queryKey: ["records", number],
    queryFn: () => respond(number),
    retryDelay: 0,
    placeholderData: keepPreviousData,
  });
  return (
    <main>
      <ScreenHeading>Records</ScreenHeading>
      <DataTable
        read={read}
        label="Records"
        columns={COLUMNS}
        rows={(data) => data.records}
        rowId={(record) => record.id}
        sort={sort}
        onSort={onSort}
        renderEmpty={() => (
          <EmptyState
            message="No records."
            action={<Button>Fictional action</Button>}
          />
        )}
      />
    </main>
  );
}

async function renderRecords(
  number = 1,
  sorting: Omit<RecordsProps, "page"> = {},
) {
  const screen = await render(
    <QueryClientProvider client={client}>
      <Records page={number} {...sorting} />
    </QueryClientProvider>,
  );
  const rerender = (next: number, nextSorting = sorting) =>
    screen.rerender(
      <QueryClientProvider client={client}>
        <Records page={next} {...nextSorting} />
      </QueryClientProvider>,
    );
  return { screen, rerender };
}

// The shapes of an icon, which tell one icon from another.
async function shapesOf(icon: ReactNode): Promise<string> {
  const screen = await render(<div data-icon>{icon}</div>);
  const shapes = screen.container.querySelector("[data-icon] svg")!.innerHTML;
  await screen.unmount();
  return shapes;
}

type Screen = Awaited<ReturnType<typeof renderRecords>>["screen"];

function tableOf(screen: Screen) {
  return screen.getByRole("grid", { name: "Records" });
}

// The frame of the table, the nearest element around it with a border line.
function frameOf(screen: Screen): Element {
  let element = tableOf(screen).element().parentElement;
  while (
    element !== null &&
    getComputedStyle(element).borderTopWidth !== "1px"
  ) {
    element = element.parentElement;
  }
  return element!;
}

// The frame of a table, the nearest element around it with a border line.
function frameOfTable(table: Element): Element {
  let element = table.parentElement;
  while (
    element !== null &&
    getComputedStyle(element).borderTopWidth !== "1px"
  ) {
    element = element.parentElement;
  }
  return element!;
}

interface FramedRecordsProps {
  records: FictionalRecord[];
}

// A screen with its heading and records that a place shows in a framed
// table, with an empty state of records that match no filter.
function FramedRecords({ records }: FramedRecordsProps) {
  return (
    <main>
      <ScreenHeading>Records</ScreenHeading>
      <FramedTable
        label="Records"
        columns={COLUMNS}
        rows={records}
        rowId={(record) => record.id}
        empty={
          <EmptyState
            message="No records match the filters."
            action={<Button>Clear filters</Button>}
          />
        }
      />
    </main>
  );
}

describe("the table", () => {
  test("shows its header row and its rows, in the sizes and colors of the design system", async () => {
    respond.mockResolvedValue(pageOf("R-1", "R-2"));
    const { screen } = await renderRecords();
    const header = tableOf(screen).getByRole("columnheader", {
      name: "Record",
    });
    const row = tableOf(screen).getByRole("row").nth(1);

    await expect.element(row).toBeVisible();
    const headerStyle = getComputedStyle(header.element());
    expect(header.element().getBoundingClientRect().height).toBe(36);
    expect([
      headerStyle.fontSize,
      headerStyle.fontWeight,
      headerStyle.color,
      headerStyle.backgroundColor,
      headerStyle.paddingLeft,
    ]).toEqual([
      "13px",
      "500",
      "rgb(89, 99, 110)",
      "rgb(246, 248, 250)",
      "16px",
    ]);
    expect(row.element().getBoundingClientRect().height).toBe(36);
    expect(getComputedStyle(row.element()).fontSize).toBe("14px");
    expect(getComputedStyle(row.element()).borderTopColor).toBe(
      "rgb(216, 222, 228)",
    );
    const first = row.getByRole("rowheader").element();
    const cells = row.getByRole("gridcell").elements();
    expect(getComputedStyle(first).paddingLeft).toBe("16px");
    expect(getComputedStyle(cells[0]!).paddingLeft).toBe("10px");
    expect(getComputedStyle(cells.at(-1)!).paddingRight).toBe("16px");
    const frame = getComputedStyle(frameOf(screen));
    expect([
      frame.backgroundColor,
      frame.borderTopColor,
      frame.borderTopLeftRadius,
    ]).toEqual(["rgb(255, 255, 255)", "rgb(216, 222, 228)", "8px"]);
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "R-1" }))
      .toBeVisible();
  });

  test.each([
    ["descending", <ArrowDown key="down" />],
    ["ascending", <ArrowUp key="up" />],
  ] as const)(
    "marks the column sorted in %s order with its arrow at 14 px after its name, and tells assistive technologies the direction",
    async (direction, icon) => {
      const shapes = await shapesOf(icon);
      respond.mockResolvedValue(pageOf("R-1"));
      const { screen } = await renderRecords(1, {
        sort: { column: "state", direction },
      });
      const sorted = tableOf(screen).getByRole("columnheader", {
        name: "State",
      });

      await expect.element(sorted).toHaveAttribute("aria-sort", direction);
      const arrow = sorted.element().querySelector("svg")!;
      expect(arrow.getBoundingClientRect().width).toBe(14);
      expect(arrow.innerHTML).toBe(shapes);
      const title = tableOf(screen).getByRole("columnheader", {
        name: "Title",
        exact: true,
      });
      expect(title.element().querySelector("svg")).toBeNull();
      // A column that does not allow sorting tells nothing of it.
      await expect.element(title).not.toHaveAttribute("aria-sort");
    },
  );

  test("sorts by a column that allows sorting when the user presses its header with a click, Enter, or Space", async () => {
    const onSort = vi.fn<(column: string) => void>();
    respond.mockResolvedValue(pageOf("R-1"));
    const { screen } = await renderRecords(1, {
      sort: { column: "state", direction: "descending" },
      onSort,
    });
    const state = tableOf(screen).getByRole("columnheader", { name: "State" });
    await expect.element(state).toBeVisible();

    await state.click();
    expect(onSort).toHaveBeenLastCalledWith("state");
    await expect.element(state).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onSort).toHaveBeenCalledTimes(3);

    await tableOf(screen)
      .getByRole("columnheader", { name: "Title", exact: true })
      .click();
    expect(onSort).toHaveBeenCalledTimes(3);
  });

  test("shows the header of a column that allows sorting on surface-hover with its name in fg under the pointer", async () => {
    respond.mockResolvedValue(pageOf("R-1"));
    const { screen } = await renderRecords(1, { onSort: vi.fn() });
    const state = tableOf(screen).getByRole("columnheader", { name: "State" });
    const title = tableOf(screen).getByRole("columnheader", {
      name: "Title",
      exact: true,
    });
    await expect.element(state).toBeVisible();

    await userEvent.hover(state);
    await expect
      .poll(() => getComputedStyle(state.element()).backgroundColor)
      .toBe("rgb(243, 245, 248)");
    expect(getComputedStyle(state.element()).color).toBe("rgb(31, 35, 40)");

    await userEvent.hover(title);
    await expect
      .poll(() => getComputedStyle(title.element()).backgroundColor)
      .toBe("rgb(246, 248, 250)");
    expect(getComputedStyle(title.element()).color).toBe("rgb(89, 99, 110)");
  });

  test("shows the header row at once, and the loading indicator inside the frame while the data loads", async () => {
    const { promise, resolve } = later();
    respond.mockReturnValueOnce(promise);
    const { screen } = await renderRecords();

    await expect
      .element(tableOf(screen).getByRole("columnheader", { name: "Record" }))
      .toBeVisible();
    const indicator = screen.getByRole("progressbar", { name: "Loading" });
    await expect.element(indicator).toBeVisible();
    expect(frameOf(screen).contains(indicator.element())).toBe(true);

    resolve(pageOf("R-1"));
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "R-1" }))
      .toBeVisible();
    expect(screen.getByRole("progressbar").query()).toBeNull();
  });

  test("gives a growing column the width that the others leave also in the header row without rows", async () => {
    const { promise } = later();
    respond.mockReturnValueOnce(promise);
    const { screen } = await renderRecords();
    await expect.element(screen.getByRole("progressbar")).toBeVisible();
    const title = tableOf(screen)
      .getByRole("columnheader", { name: "Title", exact: true })
      .element()
      .getBoundingClientRect().width;

    // The other columns take the width of their names, so the header row
    // places its columns as the rows will.
    expect(title).toBeGreaterThan(
      tableOf(screen).element().getBoundingClientRect().width / 2,
    );
  });

  test("moves the focus to the screen's heading when the rows take the place of the table without rows that holds it", async () => {
    const { promise, resolve } = later();
    respond.mockReturnValueOnce(promise);
    const { screen } = await renderRecords();
    await expect.element(screen.getByRole("progressbar")).toBeVisible();
    await userEvent.keyboard("{Tab}");
    expect(tableOf(screen).element().contains(document.activeElement)).toBe(
      true,
    );

    resolve(pageOf("R-1"));

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Records" }))
      .toHaveFocus();
  });

  test("moves the focus to the screen's heading when the empty state that holds it leaves the page", async () => {
    respond.mockResolvedValueOnce(pageOf());
    const { screen, rerender } = await renderRecords();
    const action = screen.getByRole("button", { name: "Fictional action" });
    await action.click();
    await expect.element(action).toHaveFocus();
    respond.mockResolvedValueOnce(pageOf("R-21"));

    await rerender(2);

    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "R-21" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Records" }))
      .toHaveFocus();
  });

  test("shows its empty state inside the frame, below the header row, when the data has no rows", async () => {
    respond.mockResolvedValue(pageOf());
    const { screen } = await renderRecords();
    const message = screen.getByText("No records.");

    await expect.element(message).toBeVisible();
    expect(frameOf(screen).contains(message.element())).toBe(true);
    expect(message.element().getBoundingClientRect().top).toBeGreaterThan(
      tableOf(screen).element().getBoundingClientRect().bottom,
    );
  });

  test("keeps the rows that show while other data loads, marked by the progress bar along the top edge of the frame", async () => {
    respond.mockResolvedValueOnce(pageOf("R-1"));
    const { screen, rerender } = await renderRecords();
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "R-1" }))
      .toBeVisible();
    const { promise, resolve } = later();
    respond.mockReturnValueOnce(promise);

    await rerender(2);

    const bar = screen.getByRole("progressbar", { name: "Updating" });
    await expect.element(bar).toBeVisible();
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "R-1" }))
      .toBeVisible();
    expect(bar.element().getBoundingClientRect().top).toBe(
      frameOf(screen).getBoundingClientRect().top + 1,
    );
    resolve(pageOf("R-21"));
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "R-21" }))
      .toBeVisible();
    expect(screen.getByRole("progressbar").query()).toBeNull();
  });

  test("shows the error of a read of other data in place of the rows, inside the frame, in a status region", async () => {
    respond.mockResolvedValueOnce(pageOf("R-1"));
    const { screen, rerender } = await renderRecords();
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "R-1" }))
      .toBeVisible();
    respond.mockRejectedValue(UNAVAILABLE);

    await rerender(2);

    const message = screen.getByText(
      "Sentinel isn't available right now. Try again later.",
    );
    await expect.element(message).toBeVisible();
    expect(frameOf(screen).contains(message.element())).toBe(true);
    expect(message.element().closest("output")).not.toBeNull();
    expect(tableOf(screen).getByRole("rowheader").query()).toBeNull();
    await expect
      .element(tableOf(screen).getByRole("columnheader", { name: "Record" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toBeVisible();
  });

  test("keeps the rows after a new read of them failed, with the warning above the frame", async () => {
    respond.mockResolvedValueOnce(pageOf("R-1"));
    const { screen } = await renderRecords();
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "R-1" }))
      .toBeVisible();
    respond.mockRejectedValue(UNAVAILABLE);

    await client.refetchQueries({ queryKey: ["records"] });

    const warning = screen.getByText(/^This couldn't be updated\./);
    await expect.element(warning).toBeVisible();
    expect(frameOf(screen).contains(warning.element())).toBe(false);
    expect(warning.element().getBoundingClientRect().bottom).toBeLessThan(
      frameOf(screen).getBoundingClientRect().top,
    );
    expect(warning.element().closest("output")).not.toBeNull();
    await expect
      .element(tableOf(screen).getByRole("rowheader", { name: "R-1" }))
      .toBeVisible();
  });

  test("moves the focus to the screen's heading when a read removes the rows that hold it", async () => {
    respond.mockResolvedValueOnce(pageOf("R-1"));
    const { screen } = await renderRecords();
    const control = screen.getByRole("button", { name: "R-1" });
    await control.click();
    await expect.element(control).toHaveFocus();
    respond.mockRejectedValue(FORBIDDEN);

    await client.refetchQueries({ queryKey: ["records"] });

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Records" }))
      .toHaveFocus();
  });

  test("gives a growing column at least 100 px, cuts its text with an ellipsis, and scrolls within its frame when it is wider than its place", async () => {
    await page.viewport(320, 600);
    respond.mockResolvedValue({
      records: [{ id: "R-1", title: `Fictional ${"long ".repeat(60)}title` }],
    });
    const { screen } = await renderRecords();
    const cell = tableOf(screen).getByRole("gridcell").first();

    await expect.element(cell).toBeVisible();
    expect(cell.element().getBoundingClientRect().width).toBe(100);
    const text = cell.element().firstElementChild!;
    expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
    expect(getComputedStyle(text).textOverflow).toBe("ellipsis");
    const scroller = frameOf(screen).firstElementChild!;
    expect(getComputedStyle(scroller).overflowX).toBe("auto");
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  });
});

describe("EmptyState", () => {
  test("shows its message in fg, centered, with 40 px above and below, and its action below it", async () => {
    const screen = await render(
      <EmptyState
        message="No records."
        action={<button type="button">Fictional action</button>}
      />,
    );
    const message = screen.getByText("No records.").element();
    const box = message.parentElement!;

    expect(getComputedStyle(message).color).toBe("rgb(31, 35, 40)");
    expect(getComputedStyle(box).textAlign).toBe("center");
    expect([
      getComputedStyle(box).paddingTop,
      getComputedStyle(box).paddingBottom,
    ]).toEqual(["40px", "40px"]);
    expect(
      screen
        .getByRole("button", { name: "Fictional action" })
        .element()
        .getBoundingClientRect().top,
    ).toBeGreaterThan(message.getBoundingClientRect().bottom);
  });
});

describe("FramedTable", () => {
  const WRAPPING: readonly TableColumn<FictionalRecord>[] = [
    {
      id: "id",
      name: "Record",
      isRowHeader: true,
      render: (record) => record.id,
    },
    {
      id: "title",
      name: "Title",
      wraps: true,
      render: (record) => record.title,
    },
  ];

  async function renderFramed(records: FictionalRecord[]) {
    const screen = await render(
      <FramedTable
        label="Records"
        columns={WRAPPING}
        rows={records}
        rowId={(record) => record.id}
      />,
    );
    const table = screen.getByRole("grid", { name: "Records" });
    await expect.element(table).toBeVisible();
    let frame = table.element().parentElement;
    while (frame !== null && getComputedStyle(frame).borderTopWidth !== "1px") {
      frame = frame.parentElement;
    }
    return { table, frame: frame! };
  }

  test("shows its rows in the frame of a table, on surface with a border line and an 8 px radius", async () => {
    const { table, frame } = await renderFramed([
      { id: "R-1", title: "Fictional R-1" },
      { id: "R-2", title: "Fictional R-2" },
    ]);

    expect(
      table
        .getByRole("rowheader")
        .elements()
        .map((cell) => cell.textContent),
    ).toEqual(["R-1", "R-2"]);
    expect(getComputedStyle(frame).backgroundColor).toBe("rgb(255, 255, 255)");
    expect(getComputedStyle(frame).borderTopColor).toBe("rgb(216, 222, 228)");
    expect(getComputedStyle(frame).borderTopLeftRadius).toBe("8px");
  });

  test("shows what it shows without rows inside the frame, below the header row", async () => {
    const screen = await render(
      <FramedTable
        label="Records"
        columns={WRAPPING}
        rows={[]}
        rowId={(record) => record.id}
        empty={<EmptyState message="No records match the filters." />}
      />,
    );
    const table = screen.getByRole("grid", { name: "Records" });
    const message = screen.getByText("No records match the filters.");

    await expect.element(message).toBeVisible();
    await expect
      .element(table.getByRole("columnheader", { name: "Record" }))
      .toBeVisible();
    expect(table.getByRole("rowheader").query()).toBeNull();
    expect(frameOfTable(table.element()).contains(message.element())).toBe(
      true,
    );
    expect(message.element().getBoundingClientRect().top).toBeGreaterThan(
      table.element().getBoundingClientRect().bottom,
    );
  });

  test("shows its rows alone, without what it shows without rows", async () => {
    const screen = await render(
      <FramedTable
        label="Records"
        columns={WRAPPING}
        rows={[{ id: "R-1", title: "Fictional R-1" }]}
        rowId={(record) => record.id}
        empty={<EmptyState message="No records match the filters." />}
      />,
    );

    await expect
      .element(screen.getByRole("rowheader", { name: "R-1" }))
      .toBeVisible();
    expect(screen.getByText("No records match the filters.").query()).toBe(
      null,
    );
  });

  test("moves the focus to the screen's heading when what it shows without rows leaves the page with the focus", async () => {
    const screen = await render(<FramedRecords records={[]} />);
    const action = screen.getByRole("button", { name: "Clear filters" });
    await action.click();
    await expect.element(action).toHaveFocus();

    await screen.rerender(
      <FramedRecords records={[{ id: "R-1", title: "Fictional R-1" }]} />,
    );

    await expect
      .element(screen.getByRole("rowheader", { name: "R-1" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Records" }))
      .toHaveFocus();
  });

  test("wraps the text of a wrapping column, whose row grows, so that the table keeps to its place", async () => {
    await page.viewport(320, 600);
    const { table, frame } = await renderFramed([
      { id: "R-1", title: `Fictional ${"long ".repeat(60)}title` },
      { id: "R-2", title: "Fictional R-2" },
    ]);
    const rows = table.getByRole("row");

    // The cell of the long title holds several lines, 8 px from the lines
    // between the rows.
    const cell = rows.nth(1).getByRole("gridcell").element();
    const line = Number.parseFloat(getComputedStyle(cell).lineHeight);
    expect(cell.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      2 * line + 16,
    );
    expect(getComputedStyle(cell).paddingTop).toBe("8px");
    expect(rows.nth(2).element().getBoundingClientRect().height).toBeLessThan(
      40,
    );
    const scroller = frame.firstElementChild!;
    expect(getComputedStyle(scroller).overflowX).toBe("auto");
    expect(scroller.scrollWidth).toBe(scroller.clientWidth);
  });
});

// A record with the text of a long title, which wraps.
const LONG_TITLE = `Fictional ${"long ".repeat(60)}title`;

describe("a growing column whose text wraps", () => {
  const COLUMNS_THAT_WRAP: readonly TableColumn<FictionalRecord>[] = [
    {
      id: "id",
      name: "Record",
      isRowHeader: true,
      render: (record) => record.id,
    },
    {
      id: "title",
      name: "Title",
      grows: true,
      wraps: true,
      render: (record) => record.title,
    },
    {
      id: "state",
      name: "State",
      render: () => "A fictional state of the record",
    },
  ];

  async function renderWrapping() {
    const screen = await render(
      <FramedTable
        label="Records"
        columns={COLUMNS_THAT_WRAP}
        rows={[{ id: "R-1", title: LONG_TITLE }]}
        rowId={(record) => record.id}
      />,
    );
    const table = screen.getByRole("grid", { name: "Records" });
    await expect.element(table).toBeVisible();
    return { table, cell: table.getByRole("gridcell").first().element() };
  }

  test("takes the width that the other columns leave, and wraps its text whole, without cutting it", async () => {
    const { table, cell } = await renderWrapping();

    expect(cell.getBoundingClientRect().width).toBeGreaterThan(
      table.element().getBoundingClientRect().width / 2,
    );
    const line = Number.parseFloat(getComputedStyle(cell).lineHeight);
    expect(cell.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      2 * line + 16,
    );
    expect(cell.textContent).toBe(LONG_TITLE);
    expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth);
    expect(
      [cell, ...cell.querySelectorAll("*")].map(
        (element) => getComputedStyle(element).textOverflow,
      ),
    ).not.toContain("ellipsis");
  });

  test("keeps at least 192 px at 320 CSS pixels, the table scrolling within its frame", async () => {
    await page.viewport(320, 600);
    const { table, cell } = await renderWrapping();

    expect(cell.getBoundingClientRect().width).toBe(192);
    expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth);
    const scroller = frameOfTable(table.element()).firstElementChild!;
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    expect(document.documentElement.scrollWidth).toBe(320);
  });
});

describe("a column whose name is for assistive technologies alone", () => {
  const COLUMNS_WITH_ACTIONS: readonly TableColumn<FictionalRecord>[] = [
    {
      id: "id",
      name: "Record",
      isRowHeader: true,
      render: (record) => record.id,
    },
    {
      id: "title",
      name: "Title",
      render: (record) => record.title,
    },
    {
      id: "actions",
      name: "Actions",
      hidesName: true,
      render: (record) => (
        <button type="button" aria-label={`Edit ${record.id}`}>
          E
        </button>
      ),
    },
  ];

  async function renderActions(title: string) {
    const screen = await render(
      <FramedTable
        label="Records"
        columns={COLUMNS_WITH_ACTIONS}
        rows={[{ id: "R-1", title }]}
        rowId={(record) => record.id}
      />,
    );
    const table = screen.getByRole("grid", { name: "Records" });
    await expect.element(table).toBeVisible();
    return { screen, table };
  }

  test("is named in its header, which shows no name", async () => {
    const { screen, table } = await renderActions("Fictional R-1");

    await expect
      .element(table.getByRole("columnheader", { name: "Actions" }))
      .toBeInTheDocument();
    const name = screen.getByText("Actions", { exact: true }).element();
    expect(name.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(
      screen
        .getByText("Title", { exact: true })
        .element()
        .getBoundingClientRect().width,
    ).toBeGreaterThan(1);
  });

  test("keeps the name within the frame, which scrolls, rather than widening the page, at 320 CSS pixels", async () => {
    await page.viewport(320, 600);
    const { table } = await renderActions(
      `Fictional ${"wide ".repeat(30)}title`,
    );

    const scroller = frameOfTable(table.element()).firstElementChild!;
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    expect(
      table
        .getByRole("columnheader", { name: "Actions" })
        .element()
        .getBoundingClientRect().left,
    ).toBeGreaterThan(320);
    expect(document.documentElement.scrollWidth).toBe(320);
  });
});
