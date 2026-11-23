import { linkOptions } from "@tanstack/react-router";
import { useMemo } from "react";
import type {
  TicketListResponse,
  TicketSummary,
} from "../../api/generated/model";
import { AbsentValue } from "../../components/absent-value";
import { ButtonLink } from "../../components/button-link";
import { ConfidentialMark } from "../../components/confidential-mark";
import { COUNT, counted } from "../../components/count";
import {
  DataTable,
  EmptyState,
  type TableColumn,
  type TableSort,
} from "../../components/data-table";
import { DateTime } from "../../components/date-time";
import { DeadlineBadge } from "../../components/deadline-badge";
import { ClearFiltersAction } from "../../components/filters";
import { ignoreReasonName } from "../../components/ignore-reason";
import { Link } from "../../components/link";
import { ExplainedPriority } from "../../components/priority-explanation";
import type { Read } from "../../components/read-view";
import { Severity } from "../../components/severity";
import { SeveralValues } from "../../components/several-values";
import { TicketStatus } from "../../components/ticket-status";
import { User } from "../../components/user";
import {
  pageHref,
  refinedBy,
  type ColumnId,
  type TicketListSearch,
  type TicketView,
} from "./shared";

// The table of the Ticket list (src/routes/tickets.tsx), with its columns,
// its empty state, and what the list shows, in words.

interface IgnoreReasonProps {
  // A value of TicketIgnoreReason, or another value that a later Sentinel
  // release returns.
  reason: string;
}

// The reason of an ignored Ticket, 6 px after its status and centered on its
// line, as "· CNA policy" in fg-muted: by its name, or as received
// (docs/behaviors.md, Unknown Values).
function IgnoreReason({ reason }: IgnoreReasonProps) {
  return <span className="text-fg-muted">· {ignoreReasonName(reason)}</span>;
}

// The columns of the table, with the cell of each column in a row. The
// deadline badge compares with now, the instant at which the list's data
// arrived, the same for every row.
function columnsOf(
  view: TicketView,
  now: number,
): TableColumn<TicketSummary>[] {
  const columns: Record<ColumnId, TableColumn<TicketSummary>> = {
    ticket: {
      id: "ticket",
      name: "Ticket",
      isRowHeader: true,
      allowsSorting: true,
      render: (row) => (
        <>
          <span className="font-medium">
            <Link
              placement="list"
              href={linkOptions({
                to: "/tickets/$ticketId",
                params: { ticketId: row.ticket_id },
              })}
            >
              {row.ticket_id}
            </Link>
          </span>
          {row.is_confidential && <ConfidentialMark />}
        </>
      ),
    },
    // The CVE ID as text: a CVE has no screen of its own, and its address
    // leads to the Ticket to which the row already links
    // (docs/screen-map.md, Links Between Areas).
    cve: {
      id: "cve",
      name: "CVE",
      render: (row) => (row.cve === null ? <AbsentValue /> : row.cve.cve_id),
    },
    title: {
      id: "title",
      name: "Title",
      grows: true,
      render: (row) =>
        row.cve?.title == null ? <AbsentValue /> : row.cve.title,
    },
    packages: {
      id: "packages",
      name: "Packages",
      render: (row) => (
        <SeveralValues
          values={row.package_names}
          noun={{ one: "package", other: "packages" }}
        />
      ),
    },
    // The status, followed by the reason of an ignored Ticket, so that the
    // Tickets that the CNA auto-ignore policy ignored stand apart from those
    // that a user ignored (Sentinel docs/features/tickets/tickets.md, Ignore
    // Reason).
    status: {
      id: "status",
      name: "Status",
      allowsSorting: true,
      render: (row) =>
        row.ignore_reason === null ? (
          <TicketStatus status={row.status} />
        ) : (
          <span className="inline-flex items-center gap-1.5 align-middle">
            <TicketStatus status={row.status} />
            <IgnoreReason reason={row.ignore_reason} />
          </span>
        ),
    },
    severity: {
      id: "severity",
      name: "Severity",
      allowsSorting: true,
      render: (row) => <Severity severity={row.severity} />,
    },
    // The effective priority as the button of its explanation, from the
    // fields of the row (docs/design-system.md, Priority, Explanation).
    priority: {
      id: "priority",
      name: "Priority",
      allowsSorting: true,
      render: (row) => <ExplainedPriority ticket={row} />,
    },
    deadline: {
      id: "deadline",
      name: "Deadline",
      allowsSorting: true,
      render: (row) => <DeadlineBadge ticket={row} now={now} />,
    },
    // The date and time of the embargo, never the days that remain to it:
    // the days to a deadline are the only relative value
    // (docs/behaviors.md, Dates and Times, Display).
    "coordinated-release-date": {
      id: "coordinated-release-date",
      name: "Coordinated Release Date",
      allowsSorting: true,
      render: (row) =>
        row.coordinated_release_at === null ? (
          <AbsentValue />
        ) : (
          <DateTime value={row.coordinated_release_at} />
        ),
    },
    assignee: {
      id: "assignee",
      name: "Assignee",
      render: (row) =>
        row.assignee === null ? (
          <AbsentValue name="Unassigned" />
        ) : (
          <User user={row.assignee} />
        ),
    },
    "last-modified": {
      id: "last-modified",
      name: "Last modified",
      allowsSorting: true,
      render: (row) => <DateTime value={row.updated_at} />,
    },
  };
  return view.columns.map((id) => columns[id]);
}

// The empty state of a page of the list without Tickets: a view without
// Tickets, or a view that the user refined without Tickets that match, on
// any page, or a page beyond the last (docs/behaviors.md, Empty States).
function emptyMessage(
  { meta }: TicketListResponse,
  search: TicketListSearch,
): string {
  if (meta.total > 0) {
    return "There are no Tickets on this page.";
  }
  switch (refinedBy(search)) {
    case "search":
      return "No Tickets in this view match the search.";
    case "filters":
      return "No Tickets in this view match the filters.";
    default:
      return "No Tickets in this view.";
  }
}

// What the list shows, in words, which assistive technologies announce after
// another view, page, search, filter, or sorting (docs/behaviors.md,
// Accessibility, Focus after a navigation): the number of its Tickets, with
// the range of the page when they take more than one, or its empty state.
export function resultText(list: TicketListResponse, search: TicketListSearch) {
  const { data, meta } = list;
  if (data.length === 0) {
    return emptyMessage(list, search);
  }
  if (meta.total <= meta.per_page) {
    return counted(meta.total, { one: "Ticket", other: "Tickets" });
  }
  const first = (meta.page - 1) * meta.per_page + 1;
  const last = first + data.length - 1;
  return `${COUNT.format(first)}–${COUNT.format(last)} of ${COUNT.format(meta.total)} Tickets`;
}

interface TicketTableProps {
  // The read of the list.
  read: Read<TicketListResponse>;
  // The data of the list that shows: the instant at which it arrived, its
  // view, and its search parameters (src/routes/tickets.tsx, useShown).
  shown: { at: number; view: TicketView; search: TicketListSearch };
  // The sorting that the header shows.
  sort: TableSort;
  // Sorts the Tickets by the column whose header the user pressed.
  onSort: (column: string) => void;
  // Removes the search and the filters (src/routes/tickets.tsx, TicketList).
  onClear: () => void;
}

// The table of the Tickets of a page, or the empty state of a page without
// Tickets.
export function TicketTable({
  read,
  shown,
  sort,
  onSort: sortBy,
  onClear: clearFilters,
}: TicketTableProps) {
  const columns = useMemo(
    () => columnsOf(shown.view, shown.at),
    [shown.view, shown.at],
  );
  return (
    <DataTable
      read={read}
      label="Tickets"
      columns={columns}
      rows={(data) => data.data}
      rowId={(row) => row.ticket_id}
      sort={sort}
      onSort={sortBy}
      renderEmpty={(data) => (
        <EmptyState
          message={emptyMessage(data, shown.search)}
          action={
            data.meta.total > 0 ? (
              <ButtonLink href={pageHref(shown.view, shown.search, 1)}>
                Go to the first page
              </ButtonLink>
            ) : refinedBy(shown.search) === undefined ? undefined : (
              <ClearFiltersAction onPress={clearFilters} />
            )
          }
        />
      )}
    />
  );
}
