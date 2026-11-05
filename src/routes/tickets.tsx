import { keepPreviousData } from "@tanstack/react-query";
import {
  createRoute,
  linkOptions,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import type {
  CurrentUserData,
  ListTicketsCurrentPhaseItem,
  ListTicketsOverdueItem,
  ListTicketsParams,
  ListTicketsPriorityItem,
  ListTicketsSeverityItem,
  ListTicketsStatusItem,
  SortOrder,
  TicketListResponse,
  TicketSortField,
  TicketSummary,
} from "../api/generated/model";
import { useListTickets } from "../api/generated/tickets";
import { AbsentValue } from "../components/absent-value";
import { Button } from "../components/button";
import { ButtonLink } from "../components/button-link";
import { ConfidentialMark } from "../components/confidential-mark";
import { CountLink } from "../components/count-link";
import {
  DataTable,
  EmptyState,
  type TableColumn,
  type TableSort,
} from "../components/data-table";
import { DateTime } from "../components/date-time";
import { DeadlineBadge } from "../components/deadline-badge";
import { FilterGroup, Filters, type FilterOption } from "../components/filters";
import { Link } from "../components/link";
import { Pagination } from "../components/pagination";
import { Priority } from "../components/priority";
import { placeMessage, ScreenRead } from "../components/read-view";
import { FocusHandOff, ScreenHeading } from "../components/screen-heading";
import { SearchField } from "../components/search-field";
import { Severity } from "../components/severity";
import { SeveralValues } from "../components/several-values";
import { TicketStatus } from "../components/ticket-status";
import { User } from "../components/user";
import { Count, ViewTabs } from "../components/view-tabs";
import {
  sameSearch,
  stringifySearch,
  valueListParam,
  wholeNumberParam,
} from "../search-params";
import { useSignedInUser } from "../session-gate";
import { rootRoute } from "./root";

// The Ticket list (docs/screens/ticket-list.md): the Tickets in the views of
// docs/screen-map.md (Ticket List Views), which the user refines with a
// search, filters, and sorting, and the attention summary
// (docs/screen-map.md, Attention Summary), from List Tickets (Sentinel
// docs/features/tickets/tickets.md, List Tickets).

// The rows of a page (Sentinel docs/api-spec.md, Pagination).
const PER_PAGE = 20;
// The last page that Sentinel accepts (same section).
const LAST_PAGE = 2_147_483_647;
// The longest search term that Sentinel accepts (Sentinel docs/api-spec.md,
// Query Parameter Length Limit).
const SEARCH_MAX_LENGTH = 500;

// The views that the view search parameter names; the All view has none.
const QUEUES = [
  "new",
  "unassigned",
  "analysis",
  "analyzed",
  "assigned-to-me",
] as const;
type Queue = (typeof QUEUES)[number];

// The values of the filters, in the order of the pinned contract (List
// Tickets): the statuses, the resolved severities and the effective
// priorities, each with unresolved for none, the current phases, and the
// phases whose milestones can be overdue (Sentinel
// docs/features/tickets/ticket-deadlines.md, Ticket-Level Overdue Filter;
// Current Phase Filter).
const STATUSES = [
  "new",
  "analysis",
  "analyzed",
  "resolved",
  "ignored",
  "duplicated",
] as const satisfies readonly ListTicketsStatusItem[];
const SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
  "none",
  "unresolved",
] as const satisfies readonly ListTicketsSeverityItem[];
const PRIORITIES = [
  "p1",
  "p2",
  "p3",
  "p4",
  "unresolved",
] as const satisfies readonly ListTicketsPriorityItem[];
const PHASES = [
  "triage",
  "submission",
  "um",
  "qa",
  "done",
] as const satisfies readonly ListTicketsCurrentPhaseItem[];
const OVERDUE_PHASES = [
  "triage",
  "submission",
  "um",
  "qa",
] as const satisfies readonly ListTicketsOverdueItem[];

// The columns by which the user can sort, as the sort search parameter names
// them.
const SORT_COLUMNS = [
  "ticket",
  "status",
  "severity",
  "priority",
  "deadline",
  "last-modified",
] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

// The field of List Tickets by which each column sorts, and the direction in
// which pressing its header first sorts (docs/screens/ticket-list.md): the
// queues are sorted by priority, by effective priority, P1 first, then by
// the due date of the current phase, the deadline of the row, earliest first
// (Sentinel docs/features/tickets/ticket-deadlines.md, Current Due Date).
const SORTING: Record<
  SortColumn,
  { sortBy: TicketSortField; first: SortOrder }
> = {
  ticket: { sortBy: "ticket_id", first: "desc" },
  status: { sortBy: "status", first: "asc" },
  severity: { sortBy: "severity", first: "desc" },
  priority: { sortBy: "priority_then_current_due", first: "desc" },
  deadline: { sortBy: "current_due_at", first: "asc" },
  "last-modified": { sortBy: "updated_at", first: "desc" },
};

function isSortColumn(column: string): column is SortColumn {
  return SORT_COLUMNS.some((known) => known === column);
}

// The search term, without its surrounding whitespace: at most the length
// that Sentinel accepts and without U+0000, which Sentinel rejects (Sentinel
// docs/api-spec.md, Query Parameter Length Limit; Inadmissible Characters in
// Request Input). An empty term counts as absent.
const searchTermParam = z
  .string()
  .trim()
  .max(SEARCH_MAX_LENGTH)
  .refine((term) => !term.includes("\u0000"))
  .transform((term) => (term === "" ? undefined : term))
  .optional()
  .catch(undefined);

// The search parameters that the Ticket list accepts: a value that it does
// not accept counts as absent (docs/behaviors.md, Invalid Search Parameters).
// A sorting that it does not accept reads as null until acceptedInView
// removes it, so that it removes its order too.
const ticketListParams = z.object({
  view: z.enum(QUEUES).optional().catch(undefined),
  search: searchTermParam,
  status: valueListParam(STATUSES),
  severity: valueListParam(SEVERITIES),
  priority: valueListParam(PRIORITIES),
  phase: valueListParam(PHASES),
  overdue: valueListParam(OVERDUE_PHASES),
  sort: z.enum(SORT_COLUMNS).nullable().optional().catch(null),
  order: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: wholeNumberParam(LAST_PAGE),
});

type TicketListSearch = Omit<z.output<typeof ticketListParams>, "sort"> & {
  sort?: SortColumn | undefined;
};

type ColumnId =
  | "ticket"
  | "cve"
  | "title"
  | "packages"
  | "status"
  | "severity"
  | "priority"
  | "deadline"
  | "assignee"
  | "last-modified";

interface TicketView {
  // The key of its tab.
  id: Queue | "all";
  // Its name, the label of its tab.
  name: string;
  // Whether only a user who can be the assignee of a Ticket sees it.
  assigneesOnly: boolean;
  // Whether each of its Tickets waits for someone to take it: the queues
  // that analysts empty, which a line sets apart from the other views
  // (docs/screen-map.md, Ticket List Views).
  waiting: boolean;
  // The filters of its Tickets, for the signed-in user.
  filters: (user: CurrentUserData) => ListTicketsParams;
  // Its columns, in their order: a view omits a column whose value it fixes.
  columns: readonly ColumnId[];
  // The column by which its Tickets are sorted until the user sorts them:
  // the queues by priority, the All view by last modification.
  sort: SortColumn;
}

const ALL_VIEW: TicketView = {
  id: "all",
  name: "All",
  assigneesOnly: false,
  waiting: false,
  filters: () => ({}),
  columns: [
    "ticket",
    "cve",
    "title",
    "packages",
    "status",
    "severity",
    "priority",
    "deadline",
    "assignee",
    "last-modified",
  ],
  sort: "last-modified",
};

// The views, in the order of their tabs (docs/screen-map.md, Ticket List
// Views).
const VIEWS: readonly TicketView[] = [
  {
    id: "new",
    name: "New",
    assigneesOnly: false,
    waiting: true,
    filters: () => ({ status: ["new"] }),
    columns: [
      "ticket",
      "cve",
      "title",
      "packages",
      "severity",
      "priority",
      "deadline",
    ],
    sort: "priority",
  },
  {
    id: "unassigned",
    name: "Unassigned",
    assigneesOnly: false,
    waiting: true,
    filters: () => ({ status: ["analysis", "analyzed"], assignee: "none" }),
    columns: [
      "ticket",
      "cve",
      "title",
      "packages",
      "status",
      "severity",
      "priority",
      "deadline",
    ],
    sort: "priority",
  },
  {
    id: "analysis",
    name: "Analysis",
    assigneesOnly: false,
    waiting: false,
    filters: () => ({ status: ["analysis"] }),
    columns: [
      "ticket",
      "cve",
      "title",
      "packages",
      "severity",
      "priority",
      "deadline",
      "assignee",
    ],
    sort: "priority",
  },
  {
    id: "analyzed",
    name: "Analyzed",
    assigneesOnly: false,
    waiting: false,
    filters: () => ({ status: ["analyzed"] }),
    columns: [
      "ticket",
      "cve",
      "title",
      "packages",
      "severity",
      "priority",
      "deadline",
      "assignee",
    ],
    sort: "priority",
  },
  ALL_VIEW,
  {
    id: "assigned-to-me",
    name: "Assigned to me",
    assigneesOnly: true,
    waiting: false,
    // By the user's id, which never changes, unlike the username (Sentinel
    // docs/api-spec.md, User Identifier Resolution).
    filters: (user) => ({
      assignee: user.id,
      status: ["analysis", "analyzed"],
    }),
    columns: [
      "ticket",
      "cve",
      "title",
      "packages",
      "status",
      "severity",
      "priority",
      "deadline",
    ],
    sort: "priority",
  },
];

// The view that the view search parameter names, whoever the user is.
function viewNamed(id: Queue | undefined): TicketView {
  return VIEWS.find((view) => view.id === id) ?? ALL_VIEW;
}

// The column of a sorting that the view accepts: one that the view shows.
// Any other, null included, is undefined.
function sortShownIn(
  view: TicketView,
  sort: SortColumn | null | undefined,
): SortColumn | undefined {
  return sort !== null && sort !== undefined && view.columns.includes(sort)
    ? sort
    : undefined;
}

// The search parameters that the view accepts, in the form that the list
// gives them (docs/behaviors.md, Invalid Search Parameters): the status
// filter only in the All view, whose Tickets have every status; the sorting
// by a column that the view shows, left out when it is the view's own; its
// order, left out when it is the first direction of the column, and when the
// list does not accept the sorting; and the page, left out when it is the
// first. So the same state always gives the same parameters.
function acceptedInView(
  search: z.output<typeof ticketListParams>,
): TicketListSearch {
  const view = viewNamed(search.view);
  const shown = sortShownIn(view, search.sort);
  const rejected = shown === undefined && search.sort !== undefined;
  const column = shown ?? view.sort;
  return {
    ...search,
    status: view === ALL_VIEW ? search.status : undefined,
    sort: shown === view.sort ? undefined : shown,
    order:
      rejected || search.order === SORTING[column].first
        ? undefined
        : search.order,
    page: search.page === 1 ? undefined : search.page,
  };
}

const ticketListSearch = ticketListParams.transform(acceptedInView);

// Whether the user can be the assignee of a Ticket, of every Ticket or of
// the non-confidential ones, as Get Current User reports the outcome of
// Sentinel's rule, which the UI does not derive (docs/screen-map.md, Roles,
// Principles; Sentinel docs/features/identity/rbac.md, Assignment
// Eligibility Wire Format). none, and a value that the pinned contract does
// not list, admit no Ticket (docs/behaviors.md, Unknown Values).
function canBeAssignee(user: CurrentUserData): boolean {
  return (
    user.assignment_eligibility === "all" ||
    user.assignment_eligibility === "non_confidential"
  );
}

// The views that the user is shown.
function viewsOf(user: CurrentUserData): readonly TicketView[] {
  const assignee = canBeAssignee(user);
  return VIEWS.filter((view) => assignee || !view.assigneesOnly);
}

// The value of the view search parameter of a view.
function searchOf(view: TicketView): Queue | undefined {
  return view.id === "all" ? undefined : view.id;
}

// The address of a view as its tab opens it: at its first page, without the
// search, the filters, and the sorting that the user applied.
function viewHref(view: TicketView) {
  return linkOptions({ to: "/tickets", search: { view: searchOf(view) } });
}

// The address of the list in a view at a page, with the search, the filters,
// and the sorting that apply; the first page omits it.
function pageHref(view: TicketView, search: TicketListSearch, page: number) {
  return linkOptions({
    to: "/tickets",
    search: {
      ...search,
      view: searchOf(view),
      page: page === 1 ? undefined : page,
    },
  });
}

// The sorting of the Tickets: by the column of the sort search parameter or
// of the view, in the direction of the order search parameter or the first
// direction of the column.
interface Sorting {
  column: SortColumn;
  order: SortOrder;
}

function sortingOf(search: TicketListSearch, view: TicketView): Sorting {
  const column = search.sort ?? view.sort;
  return { column, order: search.order ?? SORTING[column].first };
}

function tableSortOf({ column, order }: Sorting): TableSort {
  return { column, direction: order === "asc" ? "ascending" : "descending" };
}

// The search and the filters that the user applied, as List Tickets receives
// them, and as they read the Tickets of a count of the attention summary.
// Only the All view accepts the status filter, so it never replaces the
// statuses of a queue.
function refinementOf(search: TicketListSearch): ListTicketsParams {
  return {
    search: search.search,
    severity: search.severity,
    priority: search.priority,
    current_phase: search.phase,
    overdue: search.overdue,
    ...(search.status === undefined ? {} : { status: search.status }),
  };
}

// The number of the filters that apply.
function filtersApplied(search: TicketListSearch): number {
  return [
    search.status,
    search.severity,
    search.priority,
    search.phase,
    search.overdue,
  ].filter((values) => values !== undefined).length;
}

// What the user refined the view with: the search alone, filters, with or
// without the search, or nothing.
function refinedBy(search: TicketListSearch): "search" | "filters" | undefined {
  if (filtersApplied(search) > 0) {
    return "filters";
  }
  return search.search === undefined ? undefined : "search";
}

// The options of the filters (docs/design-system.md, Values; docs/behaviors.md,
// Domain Terms): a status, a severity, or a priority with its mark, and
// "Not set" for the absence that unresolved filters.
const STATUS_OPTIONS: readonly FilterOption<(typeof STATUSES)[number]>[] =
  STATUSES.map((status) => ({
    value: status,
    label: <TicketStatus status={status} />,
  }));

const SEVERITY_OPTIONS: readonly FilterOption<(typeof SEVERITIES)[number]>[] =
  SEVERITIES.map((severity) => ({
    value: severity,
    label:
      severity === "unresolved" ? "Not set" : <Severity severity={severity} />,
  }));

const PRIORITY_OPTIONS: readonly FilterOption<(typeof PRIORITIES)[number]>[] =
  PRIORITIES.map((priority) => ({
    value: priority,
    label:
      priority === "unresolved" ? "Not set" : <Priority priority={priority} />,
  }));

// The names of the phases (Sentinel docs/features/tickets/ticket-deadlines.md,
// Actors and Phases; docs/behaviors.md, Deadlines).
const PHASE_NAMES: Record<(typeof PHASES)[number], string> = {
  triage: "Triage",
  submission: "Submission",
  um: "UM",
  qa: "QA",
  done: "Done",
};

const PHASE_OPTIONS: readonly FilterOption<(typeof PHASES)[number]>[] =
  PHASES.map((phase) => ({ value: phase, label: PHASE_NAMES[phase] }));

const OVERDUE_OPTIONS: readonly FilterOption<
  (typeof OVERDUE_PHASES)[number]
>[] = OVERDUE_PHASES.map((phase) => ({
  value: phase,
  label: PHASE_NAMES[phase],
}));

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
    cve: {
      id: "cve",
      name: "CVE",
      render: (row) =>
        row.cve === null ? (
          <AbsentValue />
        ) : (
          <span className="font-medium">
            <Link
              placement="list"
              href={linkOptions({
                to: "/cves/$cveId",
                params: { cveId: row.cve.cve_id },
              })}
            >
              {row.cve.cve_id}
            </Link>
          </span>
        ),
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
    status: {
      id: "status",
      name: "Status",
      allowsSorting: true,
      render: (row) => <TicketStatus status={row.status} />,
    },
    severity: {
      id: "severity",
      name: "Severity",
      allowsSorting: true,
      render: (row) => <Severity severity={row.severity} />,
    },
    priority: {
      id: "priority",
      name: "Priority",
      allowsSorting: true,
      render: (row) => <Priority priority={row.priority} />,
    },
    deadline: {
      id: "deadline",
      name: "Deadline",
      allowsSorting: true,
      render: (row) => <DeadlineBadge ticket={row} now={now} />,
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

const COUNT = new Intl.NumberFormat("en-US");

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
function resultText(list: TicketListResponse, search: TicketListSearch) {
  const { data, meta } = list;
  if (data.length === 0) {
    return emptyMessage(list, search);
  }
  if (meta.total <= meta.per_page) {
    return `${COUNT.format(meta.total)} ${meta.total === 1 ? "Ticket" : "Tickets"}`;
  }
  const first = (meta.page - 1) * meta.per_page + 1;
  const last = first + data.length - 1;
  return `${COUNT.format(first)}–${COUNT.format(last)} of ${COUNT.format(meta.total)} Tickets`;
}

// Removes from the URL the view that the user is not shown, which opens the
// All view, as the search parameters that the list does not accept are
// (ticketListRoute), in place of the URL in the browser history, and keeps
// the other parameters. The list already shows the All view, so no request
// carries the view.
function useShownView(search: TicketListSearch, view: TicketView) {
  const navigate = useNavigate();
  const hidden = search.view !== undefined && search.view !== view.id;
  useEffect(() => {
    if (hidden) {
      void navigate({
        to: "/tickets",
        search: (previous) => ({ ...previous, view: undefined }),
        hash: true,
        replace: true,
      });
    }
  }, [hidden, navigate]);
}

interface CountRead {
  // The number, or undefined while it loads.
  value: number | undefined;
  // Whether its read failed, even after it showed a number.
  failed: boolean;
}

// The count of the Tickets that the filters match, the total of a read of
// one Ticket, without the search and the filters that the user adds
// (docs/screen-map.md, Ticket List Views; Attention Summary). The count of
// the view that the list shows is read again when the list shows the view
// and with each read of the list, so that the tab and the list agree; the
// others, as the screen's data is (docs/behaviors.md, Loading). When its
// read fails, it is not available, and the screen's next read of the list
// tries it again (docs/behaviors.md, Where Errors Appear).
function useTicketCount(
  filters: ListTicketsParams,
  selected: boolean,
  listFetching: boolean,
): CountRead {
  const count = useListTickets({ ...filters, per_page: 1 });
  const failed = count.status === "error";
  const { refetch } = count;
  const wasFetching = useRef(listFetching);
  const wasSelected = useRef(selected);
  useEffect(() => {
    const started = listFetching && !wasFetching.current;
    const opened = selected && !wasSelected.current;
    wasFetching.current = listFetching;
    wasSelected.current = selected;
    if ((started && (selected || failed)) || opened) {
      void refetch({ cancelRefetch: false });
    }
  }, [listFetching, selected, failed, refetch]);
  return { value: count.data?.meta.total, failed };
}

interface ViewCountProps {
  // The filters of the view.
  filters: ListTicketsParams;
  // Whether the list shows the view.
  selected: boolean;
  // Whether the screen reads its list.
  listFetching: boolean;
}

// The count of a view, after the label of its tab.
function ViewCount({ filters, selected, listFetching }: ViewCountProps) {
  return <Count {...useTicketCount(filters, selected, listFetching)} />;
}

// A count of the attention summary (docs/screen-map.md, Attention Summary).
interface AttentionCount {
  id: string;
  // Its label after its number: what it counts, or, among the overdue
  // counts, its phase.
  label: string;
  // The filters of the All view that hold its Tickets, which the count reads
  // and to which it links.
  search: TicketListSearch;
}

// The Tickets of effective priority P1 in an active status (Sentinel
// docs/features/tickets/ticket-priority.md, Persistence and Effective
// Priority).
const ACTIVE_P1: AttentionCount = {
  id: "active-p1",
  label: "Active P1",
  search: { status: ["new", "analysis", "analyzed"], priority: ["p1"] },
};

// The Tickets whose current phase is past due, a count for each phase, in
// the order of the phases: those whose current_phase and overdue filters
// both name the phase (Sentinel docs/features/tickets/ticket-deadlines.md,
// Relation to the Overdue Filter).
const OVERDUE_COUNTS: readonly AttentionCount[] = OVERDUE_PHASES.map(
  (phase) => ({
    id: `${phase}-overdue`,
    label: PHASE_NAMES[phase],
    search: { phase: [phase], overdue: [phase] },
  }),
);

interface AttentionCountLinkProps {
  count: AttentionCount;
  // The name of its group, which assistive technologies read after its
  // label (CountLink).
  groupName?: string;
  // Whether the screen reads its list.
  listFetching: boolean;
}

function AttentionCountLink({
  count,
  groupName,
  listFetching,
}: AttentionCountLinkProps) {
  const read = useTicketCount(refinementOf(count.search), false, listFetching);
  return (
    <CountLink
      label={count.label}
      groupName={groupName}
      {...read}
      href={linkOptions({ to: "/tickets", search: count.search })}
    />
  );
}

interface AttentionSummaryProps {
  // Whether the screen reads its list.
  listFetching: boolean;
}

// The attention summary of every user, in the heading row after the heading:
// five counts of the Tickets that List Tickets returns to the user, each a
// link to the All view refined to its Tickets (docs/screen-map.md, Attention
// Summary; docs/design-system.md, Lists). Active P1 measures priority, and
// the four overdue counts, which never count the same Ticket, form a group
// after it: a vertical line, the name "Overdue", and the counts, 8 px apart,
// each showing its phase, as "1 Triage", and read whole, as "1 Triage
// overdue". The line and the name are hidden from assistive technologies,
// which read the name with each count. The group wraps to the next line as a
// whole, and its counts after its name when it is wider than its line.
function AttentionSummary({ listFetching }: AttentionSummaryProps) {
  return (
    <ul
      aria-label="Tickets that need attention"
      className="flex flex-wrap items-start gap-y-2"
    >
      <li>
        <AttentionCountLink count={ACTIVE_P1} listFetching={listFetching} />
      </li>
      <li className="flex items-start">
        <span aria-hidden className="flex h-8 items-center px-3">
          <span className="h-5 w-px bg-border" />
        </span>
        <span
          aria-hidden
          className="me-2 flex h-8 items-center text-14 text-fg-muted"
        >
          Overdue
        </span>
        <ul className="flex flex-wrap gap-2">
          {OVERDUE_COUNTS.map((count) => (
            <li key={count.id}>
              <AttentionCountLink
                count={count}
                groupName="overdue"
                listFetching={listFetching}
              />
            </li>
          ))}
        </ul>
      </li>
    </ul>
  );
}

// The data of the list that shows.
interface Shown {
  // The instant at which it arrived, in milliseconds since the epoch.
  at: number;
  // Its view.
  view: TicketView;
  // Its search parameters, and the URL that they give.
  search: TicketListSearch;
  key: string;
}

// The data of the list that shows, which stays while other data loads, of
// another view, page, search, filter, or sorting (docs/behaviors.md,
// Loading): its rows keep the columns and the pages of their view, and
// their links the search, the filters, and the sorting of their data, until
// the new rows arrive, and their deadlines the instant at which they
// arrived.
function useShown(
  read: { dataUpdatedAt: number; isPlaceholderData: boolean },
  view: TicketView,
  search: TicketListSearch,
  key: string,
): Shown {
  const [shown, setShown] = useState<Shown>({ at: 0, view, search, key });
  if (
    !read.isPlaceholderData &&
    (read.dataUpdatedAt !== shown.at ||
      view !== shown.view ||
      key !== shown.key)
  ) {
    setShown({ at: read.dataUpdatedAt, view, search, key });
  }
  return shown;
}

interface TicketListProps {
  user: CurrentUserData;
}

function TicketList({ user }: TicketListProps) {
  const search = ticketListRoute.useSearch();
  const navigate = useNavigate();
  const views = viewsOf(user);
  // A view that the user is not shown counts as absent, and opens the All
  // view (docs/screen-map.md, Ticket List Views).
  const view = views.find((shown) => shown.id === search.view) ?? ALL_VIEW;
  const page = search.page ?? 1;
  useShownView(search, view);
  const sorting = sortingOf(search, view);
  const refined = refinedBy(search);

  const list = useListTickets(
    {
      ...view.filters(user),
      ...refinementOf(search),
      sort_by: SORTING[sorting.column].sortBy,
      sort_order: sorting.order,
      page,
      per_page: PER_PAGE,
    },
    { query: { placeholderData: keepPreviousData } },
  );
  // The URL of what the list shows, which changes with each view, page,
  // search, filter, and sorting.
  const key = stringifySearch({ ...search, view: searchOf(view) });
  const shown = useShown(list, view, search, key);
  const columns = useMemo(
    () => columnsOf(shown.view, shown.at),
    [shown.view, shown.at],
  );
  // The header shows the sorting that the user chose at once, as the tabs,
  // the search, and the filters do, while the rows of the same view stay;
  // the rows of another view keep the sorting of their own.
  const sort = tableSortOf(
    shown.view === view ? sorting : sortingOf(shown.search, shown.view),
  );

  // A change of the search, a filter, or the sorting opens the first page,
  // as a new entry of the browser history (docs/screen-map.md, Browser
  // History). An empty search term, or a filter without values, reads as
  // absent (ticketListParams), so it leaves the URL.
  const refine = (change: Partial<TicketListSearch>) => {
    void navigate({
      to: "/tickets",
      search: (previous) => ({ ...previous, ...change, page: undefined }),
    });
  };
  // Clear filters removes the search and the filters, and keeps the view and
  // the sorting.
  const clearFilters = () => {
    void navigate({
      to: "/tickets",
      search: (previous) => ({
        view: previous.view,
        sort: previous.sort,
        order: previous.order,
      }),
    });
  };
  // Pressing the header of another column sorts by it in its first
  // direction, and pressing the header of the column that sorts the rows, the
  // view's own included, reverses the direction. The schema leaves out of the
  // URL a sorting that is the view's and a direction that is the column's
  // first (acceptedInView).
  const sortBy = (id: string) => {
    if (!isSortColumn(id)) {
      return;
    }
    const order =
      id !== sorting.column
        ? SORTING[id].first
        : sorting.order === "asc"
          ? "desc"
          : "asc";
    refine({ sort: id, order });
  };

  // A change of the view, the page, the search, a filter, or the sorting
  // announces what the list shows, once it shows it, and the screen as it
  // opens does not (docs/behaviors.md, Accessibility, Focus after a
  // navigation). Each change gives the announcement a node of its own, so
  // that the same words as before are announced too.
  const [openedAt] = useState(key);
  const [changed, setChanged] = useState(false);
  if (!changed && key !== openedAt) {
    setChanged(true);
  }
  const announcement =
    changed && list.status === "success" && !list.isPlaceholderData
      ? resultText(list.data, search)
      : "";
  // While the popover of the filters is open, it announces what the list
  // shows, or what the place of the rows says of the failure of its read,
  // which the screen's status regions cannot announce then. A failure is
  // announced also before any change, such as that of a new read when the
  // tab returns to the foreground: the first read's failure replaces the
  // screen, so no popover is open then.
  const filtersStatus =
    list.status === "error" ? placeMessage(list) : announcement;

  return (
    <ScreenRead
      read={list}
      renderFrame={(place, data) => (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ScreenHeading>Tickets</ScreenHeading>
            <AttentionSummary listFetching={list.isFetching} />
          </div>
          <div className="mt-4">
            <ViewTabs
              label="Views"
              selected={view.id}
              views={views.map((tab, index) => ({
                id: tab.id,
                label: tab.name,
                href: viewHref(tab),
                // The first view after the queues of the Tickets that wait
                // for someone to take them starts the group of the others.
                startsGroup: views[index - 1]?.waiting === true && !tab.waiting,
                count: (
                  <ViewCount
                    filters={tab.filters(user)}
                    selected={tab === view}
                    listFetching={list.isFetching}
                  />
                ),
              }))}
              toolbar={
                <>
                  <SearchField
                    placeholder="Search Tickets"
                    applied={search.search ?? ""}
                    maxLength={SEARCH_MAX_LENGTH}
                    onApply={(term) => {
                      refine({ search: term });
                    }}
                  />
                  <Filters
                    applied={filtersApplied(search)}
                    status={<span key={key}>{filtersStatus}</span>}
                  >
                    {view === ALL_VIEW && (
                      <FilterGroup
                        label="Status"
                        options={STATUS_OPTIONS}
                        selected={search.status ?? []}
                        onChange={(values) => {
                          refine({ status: values });
                        }}
                      />
                    )}
                    <FilterGroup
                      label="Severity"
                      options={SEVERITY_OPTIONS}
                      selected={search.severity ?? []}
                      onChange={(values) => {
                        refine({ severity: values });
                      }}
                    />
                    <FilterGroup
                      label="Priority"
                      options={PRIORITY_OPTIONS}
                      selected={search.priority ?? []}
                      onChange={(values) => {
                        refine({ priority: values });
                      }}
                    />
                    <FilterGroup
                      label="Current phase"
                      options={PHASE_OPTIONS}
                      selected={search.phase ?? []}
                      onChange={(values) => {
                        refine({ phase: values });
                      }}
                    />
                    <FilterGroup
                      label="Overdue"
                      options={OVERDUE_OPTIONS}
                      selected={search.overdue ?? []}
                      onChange={(values) => {
                        refine({ overdue: values });
                      }}
                    />
                  </Filters>
                  {refined !== undefined && (
                    // When it leaves the page with the search and the
                    // filters that it removed, the focus moves to the
                    // screen's heading.
                    <FocusHandOff>
                      <Button
                        variant="quiet"
                        size="small"
                        onPress={clearFilters}
                      >
                        <X aria-hidden className="size-4" />
                        Clear filters
                      </Button>
                    </FocusHandOff>
                  )}
                </>
              }
            >
              {place}
              {data !== undefined && (
                <Pagination
                  page={data.meta.page}
                  perPage={data.meta.per_page}
                  total={data.meta.total}
                  href={(target) => pageHref(shown.view, shown.search, target)}
                />
              )}
            </ViewTabs>
          </div>
          <output className="sr-only">
            <span key={key}>{announcement}</span>
          </output>
        </>
      )}
      renderPlace={(read) => (
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
                  <Button onPress={clearFilters}>
                    <X aria-hidden className="size-4" />
                    Clear filters
                  </Button>
                )
              }
            />
          )}
        />
      )}
    />
  );
}

// The Ticket list, which shows with the signed-in user.
function TicketListPage() {
  const user = useSignedInUser();
  return user === undefined ? null : <TicketList user={user} />;
}

// The route of the Ticket list. A URL with a search parameter that the list
// does not accept, or with a value that it does not accept, leads to the URL
// without it, in place of the URL in the browser history, so that back,
// reload, and a bookmark show what the list shows (docs/behaviors.md, Invalid
// Search Parameters; docs/screen-map.md, Browser History). So does a URL
// whose search term has surrounding whitespace, whose filter repeats a value
// or gives its values in another order, or that names a default, such as the
// first page, which leads to the parameters that the list gives that state.
// The redirect comes before the screen shows, so no request carries the
// parameter.
export const ticketListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tickets",
  validateSearch: ticketListSearch,
  beforeLoad: ({ location }) => {
    // The router's search of the route also passes on every parameter of the
    // URL that the schema does not declare, so the schema reads the URL
    // itself. The URL gives every value as text, such as the page, which
    // the schema reads as a number, so the two compare as URLs.
    const accepted = ticketListSearch.parse(location.search);
    if (!sameSearch(location.search, accepted)) {
      throw redirect({
        to: "/tickets",
        search: accepted,
        hash: location.hash,
        replace: true,
      });
    }
  },
  component: TicketListPage,
});
