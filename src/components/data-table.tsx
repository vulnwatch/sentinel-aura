import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import {
  Cell,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
} from "react-aria-components";
import { INSIDE_FOCUS_RING } from "./focus-ring";
import { Loading, UpdatingBar } from "./loading";
import { dataPlace, type Read } from "./read-view";
import { FocusHandOff } from "./screen-heading";

// A table of the data of a read (docs/design-system.md, Tables).

export interface TableColumn<TRow> {
  id: string;
  // The name in its header.
  name: string;
  // Whether its name is for assistive technologies alone, as that of the
  // actions of the rows, which their own names state.
  hidesName?: boolean;
  // Whether its cells name their row, such as the identifier of a record.
  isRowHeader?: boolean;
  // Whether the user can sort the rows by it, by pressing its header.
  allowsSorting?: boolean;
  // Whether it takes the width that the other columns leave: at least
  // 100 px, its text cut with an ellipsis where it is longer, or, when its
  // text wraps, at least 192 px, which fits the frame at 320 CSS px, so that
  // the table scrolls within its frame rather than breaking every word of
  // the column.
  grows?: boolean;
  // Whether its text wraps where it is longer than its column, and its row
  // grows, as in a table whose records have no screen of their own
  // (docs/design-system.md, Tables).
  wraps?: boolean;
  // The content of its cell in the row.
  render: (row: TRow) => ReactNode;
}

// The column by which the rows are sorted, by its id, and the direction.
export interface TableSort {
  column: string;
  direction: "ascending" | "descending";
}

interface TableProps<TRow> {
  // The accessible name of the table.
  label: string;
  columns: readonly TableColumn<TRow>[];
  // The rows, or none, such as while the data loads, which leaves the header
  // row alone.
  rows: readonly TRow[];
  rowId: (row: TRow) => string;
  // The sorting of the rows, which shows in the header of its column.
  sort?: TableSort | undefined;
  // Called with the id of a column that allows sorting when the user presses
  // its header.
  onSort?: ((column: string) => void) | undefined;
}

// The header row is 36 px high, on surface-2, its names in text-13, weight
// 500, fg-muted, the sorted column with arrow-up or arrow-down at 14 px after
// its name. A column that allows sorting sorts when the user presses its
// header, with a click, Enter, or Space; under the pointer, its header is on
// surface-hover with its name in fg; and assistive technologies read whether
// and in which direction the rows are sorted by it. Each row is at least
// 36 px high, in text-14, with a border line below it and surface-hover under
// the pointer; its cells hold one line, centered vertically, with 10 px of
// side padding, the first and the last 16 px at the outer side. A row or a
// cell has its focus ring inside it, so that the frame does not cut it.
function DataRows<TRow>({
  label,
  columns,
  rows,
  rowId,
  sort,
  onSort,
}: TableProps<TRow>) {
  const padding = "px-2.5 first:pl-4 last:pr-4";
  // A growing column takes the width that the others leave, in its header
  // as in its cells, so that the header row keeps its columns when the rows
  // arrive.
  const width = (column: TableColumn<TRow>) => {
    if (column.grows !== true) {
      return "";
    }
    return column.wraps === true
      ? "w-full max-w-0 min-w-48"
      : "w-full max-w-0 min-w-25";
  };
  return (
    <Table
      aria-label={label}
      sortDescriptor={sort}
      onSortChange={({ column }) => {
        onSort?.(String(column));
      }}
      className="w-full border-collapse"
    >
      <TableHeader columns={columns}>
        {(column) => (
          <Column
            id={column.id}
            isRowHeader={column.isRowHeader === true}
            allowsSorting={column.allowsSorting === true}
            // Positioned, so that a name for assistive technologies alone
            // stays within the frame, which scrolls, rather than widening the
            // page.
            className={`relative h-9 cursor-default bg-surface-2 text-start align-middle text-13 font-medium whitespace-nowrap text-fg-muted data-hovered:bg-surface-hover data-hovered:text-fg ${padding} ${width(column)} ${INSIDE_FOCUS_RING}`}
          >
            <span className="inline-flex items-center gap-1">
              {column.hidesName === true ? (
                <span className="sr-only">{column.name}</span>
              ) : (
                column.name
              )}
              {sort?.column === column.id &&
                (sort.direction === "ascending" ? (
                  <ArrowUp aria-hidden className="size-3.5 shrink-0" />
                ) : (
                  <ArrowDown aria-hidden className="size-3.5 shrink-0" />
                ))}
            </span>
          </Column>
        )}
      </TableHeader>
      <TableBody items={rows} dependencies={[columns]}>
        {(row) => (
          <Row
            id={rowId(row)}
            columns={columns}
            className={`h-9 border-t border-border text-14 hover:bg-surface-hover ${INSIDE_FOCUS_RING}`}
          >
            {(column) => (
              // Positioned, so that its content can fill it, as the button of
              // the explanation of a priority does (priority-explanation).
              <Cell
                className={`relative align-middle ${column.wraps === true ? "py-2" : "whitespace-nowrap"} ${padding} ${width(column)} ${INSIDE_FOCUS_RING}`}
              >
                {column.grows === true && column.wraps !== true ? (
                  <div className="truncate">{column.render(row)}</div>
                ) : (
                  column.render(row)
                )}
              </Cell>
            )}
          </Row>
        )}
      </TableBody>
    </Table>
  );
}

// Rows that the place around the table shows, such as a part of a detail
// screen with a read of its own, as a table in its frame, on surface with a
// border line and an 8 px radius, which scrolls horizontally within the frame
// when it is wider than its place (docs/design-system.md, Tables;
// docs/behaviors.md, Accessibility). The place shows the loading and the
// errors of the read, and what shows without rows. When the table leaves the
// page while it holds the focus, such as when a new read of the place has no
// rows, the focus moves to the screen's heading (docs/behaviors.md,
// Accessibility, Focus after an action).
// Without rows, it shows what empty gives inside the frame, below the header
// row, such as an empty state of rows that do not match the filters of the
// place (docs/design-system.md, Tables; Empty States); when that leaves the
// page with the focus, the focus moves to the screen's heading too.
export function FramedTable<TRow>({
  empty,
  ...props
}: TableProps<TRow> & { empty?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <FocusHandOff>
          <DataRows {...props} />
        </FocusHandOff>
      </div>
      {props.rows.length === 0 && empty !== undefined && (
        <FocusHandOff>
          <div className="border-t border-border">{empty}</div>
        </FocusHandOff>
      )}
    </div>
  );
}

interface DataTableProps<TData, TRow> {
  // The read of the data.
  read: Read<TData>;
  // The accessible name of the table.
  label: string;
  columns: readonly TableColumn<TRow>[];
  // The rows of the data.
  rows: (data: TData) => readonly TRow[];
  rowId: (row: TRow) => string;
  // What shows in place of the rows when the data has none, such as an empty
  // state (docs/design-system.md, Empty States).
  renderEmpty: (data: TData) => ReactNode;
  // The sorting of the rows, and what sorts them by another column.
  sort?: TableSort | undefined;
  onSort?: ((column: string) => void) | undefined;
}

// The data of a read as a table in its frame, on surface with a border line
// and an 8 px radius, which scrolls horizontally within the frame when it is
// wider than its place (docs/design-system.md, Tables; docs/behaviors.md,
// Accessibility). The header row shows at once. Below it, inside the frame,
// show the loading indicator while the data loads, the error of a read that
// failed in place of the data, and what renderEmpty gives when the data has
// no rows. Data that stays shown while other data loads is marked by the
// progress bar along the top edge of the frame, and the warning of a new read
// that failed shows above the frame (docs/behaviors.md, Where Errors Appear;
// Loading). The error and the warning appear in status regions that are
// there before them, so that assistive technologies announce them without
// moving the focus (docs/behaviors.md, Accessibility, Announcements). When
// what holds the focus leaves the page, such as the rows, the table without
// rows when they arrive, or the action of an empty state, the focus moves to
// the screen's heading (docs/behaviors.md, Accessibility, Focus after an
// action).
export function DataTable<TData, TRow>({
  read,
  label,
  columns,
  rows,
  rowId,
  renderEmpty,
  sort,
  onSort,
}: DataTableProps<TData, TRow>) {
  const place = dataPlace(read);
  const shownRows = place.data === undefined ? [] : rows(place.data);
  const table = { label, columns, rowId, sort, onSort };
  return (
    <>
      <output className="block">{place.warning}</output>
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface">
        {place.updating && <UpdatingBar />}
        <div className="overflow-x-auto">
          {shownRows.length === 0 ? (
            <FocusHandOff key="header">
              <DataRows {...table} rows={[]} />
            </FocusHandOff>
          ) : (
            <FocusHandOff key="rows">
              <DataRows {...table} rows={shownRows} />
            </FocusHandOff>
          )}
        </div>
        <output className="block">
          {place.failure !== null && (
            <div className="border-t border-border p-4">{place.failure}</div>
          )}
        </output>
        {place.waiting && <Loading />}
        {place.data !== undefined && shownRows.length === 0 && (
          <FocusHandOff>
            <div className="border-t border-border">
              {renderEmpty(place.data)}
            </div>
          </FocusHandOff>
        )}
      </div>
    </>
  );
}

interface EmptyStateProps {
  // What is absent, such as "No Tickets in this view.".
  message: string;
  // The action that leads out of it, such as a link to the first page.
  action?: ReactNode;
}

// An empty list in place of its rows: its message in fg, centered, with 40 px
// of space above and below, and its action below it as a secondary button
// (docs/design-system.md, Empty States).
export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-10 text-center text-15 text-fg">
      <p>{message}</p>
      {action}
    </div>
  );
}
