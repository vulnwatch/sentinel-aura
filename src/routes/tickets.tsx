import { keepPreviousData } from "@tanstack/react-query";
import {
  createRoute,
  deepEqual,
  linkOptions,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import type {
  CurrentUserData,
  ListTicketsParams,
  TicketListResponse,
  TicketSummary,
} from "../api/generated/model";
import { useListTickets } from "../api/generated/tickets";
import { AbsentValue } from "../components/absent-value";
import { ButtonLink } from "../components/button-link";
import { ConfidentialMark } from "../components/confidential-mark";
import {
  DataTable,
  EmptyState,
  type TableColumn,
} from "../components/data-table";
import { DateTime } from "../components/date-time";
import { DeadlineBadge } from "../components/deadline-badge";
import { Link } from "../components/link";
import { Pagination } from "../components/pagination";
import { Priority } from "../components/priority";
import { ScreenRead } from "../components/read-view";
import { ScreenHeading } from "../components/screen-heading";
import { Severity } from "../components/severity";
import { TicketStatus } from "../components/ticket-status";
import { User } from "../components/user";
import { Count, ViewTabs } from "../components/view-tabs";
import { holdsAnalystRole, useSignedInUser } from "../session-gate";
import { rootRoute } from "./root";

// The Ticket list (docs/screens/ticket-list.md): the Tickets in the views of
// docs/screen-map.md (Ticket List Views), from List Tickets (Sentinel
// docs/features/tickets/tickets.md, List Tickets).

// The rows of a page (Sentinel docs/api-spec.md, Pagination).
const PER_PAGE = 20;
// The last page that Sentinel accepts (same section).
const LAST_PAGE = 2_147_483_647;

// The views that the view search parameter names; the All view has none.
const QUEUES = [
  "new",
  "assigned-to-me",
  "analysis",
  "analyzed",
  "unassigned",
] as const;
type Queue = (typeof QUEUES)[number];

// The search parameters that the Ticket list accepts: a value that it does
// not accept counts as absent (docs/behaviors.md, Invalid Search Parameters).
const ticketListSearch = z.object({
  view: z.enum(QUEUES).optional().catch(undefined),
  page: z.int().min(1).max(LAST_PAGE).optional().catch(undefined),
});

type TicketListSearch = z.infer<typeof ticketListSearch>;

type ColumnId =
  | "ticket"
  | "cve"
  | "title"
  | "status"
  | "severity"
  | "priority"
  | "deadline"
  | "assignee"
  | "updated";

interface TicketView {
  // The key of its tab.
  id: Queue | "all";
  // Its name, the label of its tab.
  name: string;
  // Whether only a user who holds the vulnerability_analyst role sees it.
  analystsOnly: boolean;
  // The filters of its Tickets, for the signed-in user.
  filters: (user: CurrentUserData) => ListTicketsParams;
  // Its columns, in their order: a view omits a column whose value it fixes.
  columns: readonly ColumnId[];
  // The field by which its Tickets are sorted, in descending order: the
  // queues by effective priority, P1 first and null last, and the All view by
  // last modification, newest first.
  sortBy: "priority" | "updated_at";
}

const ALL_VIEW: TicketView = {
  id: "all",
  name: "All",
  analystsOnly: false,
  filters: () => ({}),
  columns: [
    "ticket",
    "cve",
    "title",
    "status",
    "severity",
    "priority",
    "deadline",
    "assignee",
    "updated",
  ],
  sortBy: "updated_at",
};

// The views, in the order of their tabs (docs/screen-map.md, Ticket List
// Views).
const VIEWS: readonly TicketView[] = [
  {
    id: "new",
    name: "New",
    analystsOnly: false,
    filters: () => ({ status: ["new"] }),
    columns: ["ticket", "cve", "title", "severity", "priority", "deadline"],
    sortBy: "priority",
  },
  {
    id: "assigned-to-me",
    name: "Assigned to me",
    analystsOnly: true,
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
      "status",
      "severity",
      "priority",
      "deadline",
    ],
    sortBy: "priority",
  },
  {
    id: "analysis",
    name: "Analysis",
    analystsOnly: false,
    filters: () => ({ status: ["analysis"] }),
    columns: [
      "ticket",
      "cve",
      "title",
      "severity",
      "priority",
      "deadline",
      "assignee",
    ],
    sortBy: "priority",
  },
  {
    id: "analyzed",
    name: "Analyzed",
    analystsOnly: false,
    filters: () => ({ status: ["analyzed"] }),
    columns: [
      "ticket",
      "cve",
      "title",
      "severity",
      "priority",
      "deadline",
      "assignee",
    ],
    sortBy: "priority",
  },
  {
    id: "unassigned",
    name: "Unassigned",
    analystsOnly: false,
    filters: () => ({ status: ["analysis", "analyzed"], assignee: "none" }),
    columns: [
      "ticket",
      "cve",
      "title",
      "status",
      "severity",
      "priority",
      "deadline",
    ],
    sortBy: "priority",
  },
  ALL_VIEW,
];

// The views that the user is shown.
function viewsOf(user: CurrentUserData): readonly TicketView[] {
  const analyst = holdsAnalystRole(user);
  return VIEWS.filter((view) => analyst || !view.analystsOnly);
}

// The value of the view search parameter of a view.
function searchOf(view: TicketView): Queue | undefined {
  return view.id === "all" ? undefined : view.id;
}

// The address of the list in a view at a page; the first page omits it.
function listHref(view: TicketView, page: number) {
  return linkOptions({
    to: "/tickets",
    search: { view: searchOf(view), page: page === 1 ? undefined : page },
  });
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
    status: {
      id: "status",
      name: "Status",
      render: (row) => <TicketStatus status={row.status} />,
    },
    severity: {
      id: "severity",
      name: "Severity",
      render: (row) => <Severity severity={row.severity} />,
    },
    priority: {
      id: "priority",
      name: "Priority",
      isSorted: view.sortBy === "priority",
      render: (row) => <Priority priority={row.priority} />,
    },
    deadline: {
      id: "deadline",
      name: "Deadline",
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
    updated: {
      id: "updated",
      name: "Last modified",
      isSorted: view.sortBy === "updated_at",
      render: (row) => <DateTime value={row.updated_at} />,
    },
  };
  return view.columns.map((id) => columns[id]);
}

const COUNT = new Intl.NumberFormat("en-US");

// The empty state of a page of the list without Tickets: a view without
// Tickets, on any page, or a page beyond the last (docs/behaviors.md, Empty
// States).
function emptyMessage({ meta }: TicketListResponse): string {
  return meta.total === 0
    ? "No Tickets in this view."
    : "There are no Tickets on this page.";
}

// What the list shows, in words, which assistive technologies announce after
// another view or page (docs/behaviors.md, Accessibility, Focus after a
// navigation): the number of its Tickets, with the range of the page when
// they take more than one, or its empty state.
function resultText(list: TicketListResponse): string {
  const { data, meta } = list;
  if (data.length === 0) {
    return emptyMessage(list);
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

interface ViewCountProps {
  // The filters of the view.
  filters: ListTicketsParams;
  // Whether the list shows the view.
  selected: boolean;
  // Whether the screen reads its list.
  listFetching: boolean;
}

// The count of a view: the total of its Tickets, without the page, the
// sorting, and the filters and search that the user adds
// (docs/screen-map.md, Ticket List Views), from a read of one Ticket. The
// count of the view that the list shows is read again when the list shows
// the view and with each read of the list, so that the tab and the list
// agree; the others, as the screen's data is (docs/behaviors.md, Loading).
// When its read fails, it is not available, and the screen's next read of
// the list tries it again (docs/behaviors.md, Where Errors Appear).
function ViewCount({ filters, selected, listFetching }: ViewCountProps) {
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
  return <Count value={count.data?.meta.total} failed={failed} />;
}

// The data of the list that shows.
interface Shown {
  // The instant at which it arrived, in milliseconds since the epoch.
  at: number;
  // Its view.
  view: TicketView;
}

// The data of the list that shows, which stays while the data of another
// view or page loads (docs/behaviors.md, Loading): its rows keep the columns,
// the sorting, and the pages of their view until the new rows arrive, and
// their deadlines the instant at which they arrived.
function useShown(
  read: { dataUpdatedAt: number; isPlaceholderData: boolean },
  view: TicketView,
): Shown {
  const [shown, setShown] = useState<Shown>({ at: 0, view });
  if (
    !read.isPlaceholderData &&
    (read.dataUpdatedAt !== shown.at || view !== shown.view)
  ) {
    setShown({ at: read.dataUpdatedAt, view });
  }
  return shown;
}

interface TicketListProps {
  user: CurrentUserData;
}

function TicketList({ user }: TicketListProps) {
  const search = ticketListRoute.useSearch();
  const views = viewsOf(user);
  // A view that the user is not shown counts as absent, and opens the All
  // view (docs/screen-map.md, Ticket List Views).
  const view = views.find((shown) => shown.id === search.view) ?? ALL_VIEW;
  const page = search.page ?? 1;
  useShownView(search, view);

  const list = useListTickets(
    {
      ...view.filters(user),
      sort_by: view.sortBy,
      sort_order: "desc",
      page,
      per_page: PER_PAGE,
    },
    { query: { placeholderData: keepPreviousData } },
  );
  const shown = useShown(list, view);
  const columns = useMemo(
    () => columnsOf(shown.view, shown.at),
    [shown.view, shown.at],
  );

  // A change of the view or the page announces what the list shows, once it
  // shows it, and the screen as it opens does not (docs/behaviors.md,
  // Accessibility, Focus after a navigation). Each change gives the
  // announcement a node of its own, so that the same words as before are
  // announced too.
  const key = `${view.id}/${page}`;
  const [openedAt] = useState(key);
  const [changed, setChanged] = useState(false);
  if (!changed && key !== openedAt) {
    setChanged(true);
  }
  const announcement =
    changed && list.status === "success" && !list.isPlaceholderData
      ? resultText(list.data)
      : "";

  return (
    <ScreenRead
      read={list}
      renderFrame={(place, data) => (
        <>
          <ScreenHeading>Tickets</ScreenHeading>
          <div className="mt-4">
            <ViewTabs
              label="Views"
              selected={view.id}
              views={views.map((tab) => ({
                id: tab.id,
                label: tab.name,
                href: listHref(tab, 1),
                count: (
                  <ViewCount
                    filters={tab.filters(user)}
                    selected={tab === view}
                    listFetching={list.isFetching}
                  />
                ),
              }))}
            >
              {place}
              {data !== undefined && (
                <Pagination
                  page={data.meta.page}
                  perPage={data.meta.per_page}
                  total={data.meta.total}
                  href={(target) => listHref(shown.view, target)}
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
          renderEmpty={(data) => (
            <EmptyState
              message={emptyMessage(data)}
              action={
                data.meta.total === 0 ? undefined : (
                  <ButtonLink href={listHref(shown.view, 1)}>
                    Go to the first page
                  </ButtonLink>
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
// Search Parameters; docs/screen-map.md, Browser History). The redirect comes
// before the screen shows, so no request carries the parameter.
export const ticketListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tickets",
  validateSearch: ticketListSearch,
  beforeLoad: ({ location }) => {
    // The router's search of the route also passes on every parameter of the
    // URL that the schema does not declare, so the schema reads the URL
    // itself.
    const accepted = ticketListSearch.parse(location.search);
    if (!deepEqual(location.search, accepted)) {
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
