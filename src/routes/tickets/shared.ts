import { linkOptions } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
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
  TicketSortField,
} from "../../api/generated/model";
import { useListTickets } from "../../api/generated/tickets";
import { PHASE_NAMES as REMEDIATION_PHASE_NAMES } from "../../components/phases";
import {
  LAST_PAGE,
  searchTermParam,
  valueListParam,
  wholeNumberParam,
} from "../../search-params";

// What several parts of the Ticket list (src/routes/tickets.tsx) share: the
// values of the search parameters and of the filters, the sorting, the
// schema of the search parameters, the views, the address of a page, the
// search and the filters that apply, the names of the phases, and the read
// of a count.

// The views that the view search parameter names; the All view has none.
const QUEUES = [
  "new",
  "unassigned",
  "analysis",
  "analyzed",
  "assigned-to-me",
  "embargo",
] as const;
type Queue = (typeof QUEUES)[number];

// The values of the filters, in the order of the pinned contract (List
// Tickets): the statuses, the resolved severities and the effective
// priorities, each with unresolved for none, the current phases, and the
// phases whose milestones can be overdue (Sentinel
// docs/features/tickets/ticket-deadlines.md, Ticket-Level Overdue Filter;
// Current Phase Filter).
export const STATUSES = [
  "new",
  "analysis",
  "analyzed",
  "resolved",
  "ignored",
  "duplicated",
] as const satisfies readonly ListTicketsStatusItem[];
export const SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
  "none",
  "unresolved",
] as const satisfies readonly ListTicketsSeverityItem[];
export const PRIORITIES = [
  "p1",
  "p2",
  "p3",
  "p4",
  "unresolved",
] as const satisfies readonly ListTicketsPriorityItem[];
export const PHASES = [
  "triage",
  "submission",
  "um",
  "qa",
  "done",
] as const satisfies readonly ListTicketsCurrentPhaseItem[];
export const OVERDUE_PHASES = [
  "triage",
  "submission",
  "um",
  "qa",
] as const satisfies readonly ListTicketsOverdueItem[];
// The state of an embargo that the embargo filter of the Embargo view names:
// expired, a confidential Ticket whose Coordinated Release Date has passed
// (Sentinel docs/features/tickets/tickets.md, List Tickets, Embargo filters).
export const EMBARGO_STATES = ["expired"] as const;

// The columns by which the user can sort, as the sort search parameter names
// them.
const SORT_COLUMNS = [
  "ticket",
  "status",
  "severity",
  "priority",
  "deadline",
  "coordinated-release-date",
  "last-modified",
] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];

// The field of List Tickets by which each column sorts, and the direction in
// which pressing its header first sorts (docs/screens/ticket-list.md): the
// queues are sorted by priority, by effective priority, P1 first, then by
// the due date of the current phase, the deadline of the row, earliest first
// (Sentinel docs/features/tickets/ticket-deadlines.md, Current Due Date), and
// the embargoes by their Coordinated Release Dates, earliest first, and a
// Ticket without one last in either direction (Sentinel
// docs/features/tickets/tickets.md, List Tickets, Embargo filters).
export const SORTING: Record<
  SortColumn,
  { sortBy: TicketSortField; first: SortOrder }
> = {
  ticket: { sortBy: "ticket_id", first: "desc" },
  status: { sortBy: "status", first: "asc" },
  severity: { sortBy: "severity", first: "desc" },
  priority: { sortBy: "priority_then_current_due", first: "desc" },
  deadline: { sortBy: "current_due_at", first: "asc" },
  "coordinated-release-date": {
    sortBy: "coordinated_release_at",
    first: "asc",
  },
  "last-modified": { sortBy: "updated_at", first: "desc" },
};

export function isSortColumn(column: string): column is SortColumn {
  return SORT_COLUMNS.some((known) => known === column);
}

// The search parameters that the Ticket list accepts: a value that it does
// not accept counts as absent (docs/behaviors.md, Invalid Search Parameters).
// A sorting that it does not accept reads as null until acceptedInView
// (src/routes/tickets.tsx) removes it, so that it removes its order too.
export const ticketListParams = z.object({
  view: z.enum(QUEUES).optional().catch(undefined),
  search: searchTermParam,
  status: valueListParam(STATUSES),
  embargo: valueListParam(EMBARGO_STATES),
  severity: valueListParam(SEVERITIES),
  priority: valueListParam(PRIORITIES),
  phase: valueListParam(PHASES),
  overdue: valueListParam(OVERDUE_PHASES),
  sort: z.enum(SORT_COLUMNS).nullable().optional().catch(null),
  order: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: wholeNumberParam(LAST_PAGE),
});

export type TicketListSearch = Omit<
  z.output<typeof ticketListParams>,
  "sort"
> & {
  sort?: SortColumn | undefined;
};

export type ColumnId =
  | "ticket"
  | "cve"
  | "title"
  | "packages"
  | "status"
  | "severity"
  | "priority"
  | "deadline"
  | "coordinated-release-date"
  | "assignee"
  | "last-modified";

export interface TicketView {
  // The key of its tab.
  id: Queue | "all";
  // Its name, the label of its tab.
  name: string;
  // Whether the user is shown it (docs/screen-map.md, Ticket List Views;
  // Roles, Principles).
  shownTo: (user: CurrentUserData) => boolean;
  // Whether each of its Tickets waits for someone to take it: the queues
  // that analysts empty, which a line sets apart from the other views
  // (docs/screen-map.md, Ticket List Views).
  waiting: boolean;
  // Whether its Tickets have every status, so that the status filter refines
  // it without replacing the statuses of a queue.
  everyStatus: boolean;
  // The filters of its Tickets, for the signed-in user.
  filters: (user: CurrentUserData) => ListTicketsParams;
  // Its columns, in their order: a view omits a column whose value it fixes.
  columns: readonly ColumnId[];
  // The column by which its Tickets are sorted until the user sorts them:
  // the queues by priority, the All view by last modification, and the
  // embargoes by their Coordinated Release Dates.
  sort: SortColumn;
}

function everyUser(): boolean {
  return true;
}

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

// Whether the user holds manage_confidentiality, the capability with which
// the embargoes are worked, as Get Current User returns the capabilities
// (docs/screen-map.md, Roles, Principles; Sentinel
// docs/features/identity/rbac.md, Capabilities).
export function holdsConfidentiality(user: CurrentUserData): boolean {
  return user.capabilities.includes("manage_confidentiality");
}

export const ALL_VIEW: TicketView = {
  id: "all",
  name: "All",
  shownTo: everyUser,
  waiting: false,
  everyStatus: true,
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

// The confidential Tickets, in every status, which the users who hold
// manage_confidentiality make non-confidential once their Coordinated
// Release Dates have passed (docs/screen-map.md, Ticket List Views; Sentinel
// docs/features/tickets/tickets.md, Coordinated Release Date; List Tickets,
// Embargo filters). It follows the embargoes by their dates, so it shows
// neither their severity, their priority, nor their last modification.
export const EMBARGO_VIEW: TicketView = {
  id: "embargo",
  name: "Embargo",
  shownTo: holdsConfidentiality,
  waiting: false,
  everyStatus: true,
  filters: () => ({ is_confidential: true }),
  columns: [
    "ticket",
    "cve",
    "title",
    "packages",
    "status",
    "coordinated-release-date",
    "deadline",
    "assignee",
  ],
  sort: "coordinated-release-date",
};

// The views, in the order of their tabs (docs/screen-map.md, Ticket List
// Views).
export const VIEWS: readonly TicketView[] = [
  {
    id: "new",
    name: "New",
    shownTo: everyUser,
    waiting: true,
    everyStatus: false,
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
    shownTo: everyUser,
    waiting: true,
    everyStatus: false,
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
    shownTo: everyUser,
    waiting: false,
    everyStatus: false,
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
    shownTo: everyUser,
    waiting: false,
    everyStatus: false,
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
    shownTo: canBeAssignee,
    waiting: false,
    everyStatus: false,
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
  EMBARGO_VIEW,
];

// The view that the view search parameter names, whoever the user is.
export function viewNamed(id: Queue | undefined): TicketView {
  return VIEWS.find((view) => view.id === id) ?? ALL_VIEW;
}

// The value of the view search parameter of a view.
export function searchOf(view: TicketView): Queue | undefined {
  return view.id === "all" ? undefined : view.id;
}

// The address of the list in a view at a page, with the search, the filters,
// and the sorting that apply; the first page omits it.
export function pageHref(
  view: TicketView,
  search: TicketListSearch,
  page: number,
) {
  return linkOptions({
    to: "/tickets",
    search: {
      ...search,
      view: searchOf(view),
      page: page === 1 ? undefined : page,
    },
  });
}

// The search and the filters that the user applied, as List Tickets receives
// them, and as they read the Tickets of a count of the attention summary.
// Only a view whose Tickets have every status accepts the status filter, so
// it never replaces the statuses of a queue; an expired embargo is a
// confidential Ticket whose Coordinated Release Date has passed (Sentinel
// docs/features/tickets/tickets.md, List Tickets, Embargo filters).
export function refinementOf(search: TicketListSearch): ListTicketsParams {
  return {
    search: search.search,
    severity: search.severity,
    priority: search.priority,
    current_phase: search.phase,
    overdue: search.overdue,
    coordinated_release_passed:
      search.embargo?.includes("expired") === true ? true : undefined,
    ...(search.status === undefined ? {} : { status: search.status }),
  };
}

// The number of the filters that apply.
export function filtersApplied(search: TicketListSearch): number {
  return [
    search.status,
    search.embargo,
    search.severity,
    search.priority,
    search.phase,
    search.overdue,
  ].filter((values) => values !== undefined).length;
}

// What the user refined the view with: the search alone, filters, with or
// without the search, or nothing.
export function refinedBy(
  search: TicketListSearch,
): "search" | "filters" | undefined {
  if (filtersApplied(search) > 0) {
    return "filters";
  }
  return search.search === undefined ? undefined : "search";
}

// The names of the phases (src/components/phases.ts), and Done, the current
// phase of a Ticket without a phase left (Sentinel
// docs/features/tickets/ticket-deadlines.md, Ticket Current Phase).
export const PHASE_NAMES: Record<(typeof PHASES)[number], string> = {
  ...REMEDIATION_PHASE_NAMES,
  done: "Done",
};

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
export function useTicketCount(
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
