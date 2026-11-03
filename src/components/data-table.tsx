import { ArrowDown } from "lucide-react";
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
  // Whether its cells name their row, such as the identifier of a record.
  isRowHeader?: boolean;
  // Whether the rows are sorted by it, in descending order.
  isSorted?: boolean;
  // Whether it takes the width that the other columns leave, at least
  // 100 px, its text cut with an ellipsis where it is longer.
  grows?: boolean;
  // The content of its cell in the row.
  render: (row: TRow) => ReactNode;
}

interface TableProps<TRow> {
  // The accessible name of the table.
  label: string;
  columns: readonly TableColumn<TRow>[];
  // The rows, or none, such as while the data loads, which leaves the header
  // row alone.
  rows: readonly TRow[];
  rowId: (row: TRow) => string;
}

// The header row is 36 px high, on surface-2, its names in text-13, weight
// 500, fg-muted, the sorted column with arrow-down at 14 px after its name.
// Each row is at least 36 px high, in text-14, with a border line below it
// and surface-hover under the pointer; its cells hold one line, centered
// vertically, with 10 px of side padding, the first and the last 16 px at the
// outer side. A row or a cell has its focus ring inside it, so that the frame
// does not cut it.
function DataRows<TRow>({ label, columns, rows, rowId }: TableProps<TRow>) {
  const padding = "px-2.5 first:pl-4 last:pr-4";
  // A growing column takes the width that the others leave, in its header
  // as in its cells, so that the header row keeps its columns when the rows
  // arrive.
  const width = (column: TableColumn<TRow>) =>
    column.grows === true ? "w-full max-w-0 min-w-25" : "";
  return (
    <Table aria-label={label} className="w-full border-collapse">
      <TableHeader columns={columns}>
        {(column) => (
          <Column
            id={column.id}
            isRowHeader={column.isRowHeader === true}
            className={`h-9 bg-surface-2 text-start align-middle text-13 font-medium whitespace-nowrap text-fg-muted ${padding} ${width(column)} ${INSIDE_FOCUS_RING}`}
          >
            {column.isSorted === true ? (
              <>
                <span aria-hidden className="inline-flex items-center gap-1">
                  {column.name}
                  <ArrowDown className="size-3.5 shrink-0" />
                </span>
                <span className="sr-only">{`${column.name} (sorted descending)`}</span>
              </>
            ) : (
              column.name
            )}
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
              <Cell
                className={`align-middle whitespace-nowrap ${padding} ${width(column)} ${INSIDE_FOCUS_RING}`}
              >
                {column.grows === true ? (
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
}: DataTableProps<TData, TRow>) {
  const place = dataPlace(read);
  const shownRows = place.data === undefined ? [] : rows(place.data);
  const table = { label, columns, rowId };
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
