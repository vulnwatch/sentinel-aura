import { keepPreviousData } from "@tanstack/react-query";
import {
  createRoute,
  linkOptions,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { z } from "zod";
import type {
  CurrentUserData,
  ListTicketsParams,
  SortOrder,
} from "../api/generated/model";
import { useListTickets } from "../api/generated/tickets";
import { Button } from "../components/button";
import type { TableSort } from "../components/data-table";
import { Pagination } from "../components/pagination";
import { placeMessage, ScreenRead } from "../components/read-view";
import { FocusHandOff, ScreenHeading } from "../components/screen-heading";
import { SearchField } from "../components/search-field";
import { Count, ViewTabs } from "../components/view-tabs";
import {
  SEARCH_MAX_LENGTH,
  searchRedirect,
  stringifySearch,
} from "../search-params";
import { useSignedInUser } from "../session-gate";
import { rootRoute } from "./root";
import { AttentionSummary } from "./tickets/attention-summary";
import { TicketFilters } from "./tickets/filters";
import {
  ALL_VIEW,
  EMBARGO_VIEW,
  isSortColumn,
  pageHref,
  refinedBy,
  refinementOf,
  searchOf,
  SORTING,
  ticketListParams,
  useTicketCount,
  viewNamed,
  VIEWS,
  type SortColumn,
  type TicketListSearch,
  type TicketView,
} from "./tickets/shared";
import { resultText, TicketTable } from "./tickets/table";

// The Ticket list (docs/screens/ticket-list.md): the Tickets in the views of
// docs/screen-map.md (Ticket List Views), which the user refines with a
// search, filters, and sorting, and the attention summary
// (docs/screen-map.md, Attention Summary), from List Tickets (Sentinel
// docs/features/tickets/tickets.md, List Tickets). This module composes the
// parts of the list, which src/routes/tickets/ holds, and reads its search
// parameters, which it passes to them.

// The rows of a page (Sentinel docs/api-spec.md, Pagination).
const PER_PAGE = 20;

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
// filter only in a view whose Tickets have every status; the embargo filter
// only in the Embargo view; the sorting by a column that the view shows,
// left out when it is the view's own; its order, left out when it is the
// first direction of the column, and when the list does not accept the
// sorting; and the page, left out when it is the first. So the same state
// always gives the same parameters.
function acceptedInView(
  search: z.output<typeof ticketListParams>,
): TicketListSearch {
  const view = viewNamed(search.view);
  const shown = sortShownIn(view, search.sort);
  const rejected = shown === undefined && search.sort !== undefined;
  const column = shown ?? view.sort;
  return {
    ...search,
    status: view.everyStatus ? search.status : undefined,
    embargo: view === EMBARGO_VIEW ? search.embargo : undefined,
    sort: shown === view.sort ? undefined : shown,
    order:
      rejected || search.order === SORTING[column].first
        ? undefined
        : search.order,
    page: search.page === 1 ? undefined : search.page,
  };
}

const ticketListSearch = ticketListParams.transform(acceptedInView);

// The views that the user is shown.
function viewsOf(user: CurrentUserData): readonly TicketView[] {
  return VIEWS.filter((view) => view.shownTo(user));
}

// The address of a view as its tab opens it: at its first page, without the
// search, the filters, and the sorting that the user applied.
function viewHref(view: TicketView) {
  return linkOptions({ to: "/tickets", search: { view: searchOf(view) } });
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

// The search parameters of the All view, which opens in place of a view that
// the user is not shown: the parameters that only that view accepts, such as
// the embargo filter or a sorting by a column that the All view does not
// show, leave with it (acceptedInView).
function acceptedInAllView(search: TicketListSearch): TicketListSearch {
  return acceptedInView({ ...search, view: undefined });
}

// Removes from the URL the view that the user is not shown, which opens the
// All view, with the parameters that the All view does not accept, as the
// search parameters that the list does not accept are (ticketListRoute), in
// place of the URL in the browser history, and keeps the other parameters.
// The list already shows the All view with the parameters that it accepts,
// so no request carries the others.
function useShownView(search: TicketListSearch, view: TicketView) {
  const navigate = useNavigate();
  const hidden = search.view !== undefined && search.view !== view.id;
  useEffect(() => {
    if (hidden) {
      void navigate({
        to: "/tickets",
        search: acceptedInAllView,
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

// The count of a view, after the label of its tab.
function ViewCount({ filters, selected, listFetching }: ViewCountProps) {
  return <Count {...useTicketCount(filters, selected, listFetching)} />;
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
  const url = ticketListRoute.useSearch();
  const navigate = useNavigate();
  const views = viewsOf(user);
  // A view that the user is not shown counts as absent, and opens the All
  // view (docs/screen-map.md, Ticket List Views), with the parameters that
  // the All view accepts.
  const view = views.find((shown) => shown.id === url.view) ?? ALL_VIEW;
  const search = url.view === searchOf(view) ? url : acceptedInAllView(url);
  const page = search.page ?? 1;
  useShownView(url, view);
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
  // The header shows the sorting that the user chose at once, as the tabs,
  // the search, and the filters do, while the rows of the same view stay;
  // the rows of another view keep the sorting of their own.
  const sort = tableSortOf(
    shown.view === view ? sorting : sortingOf(shown.search, shown.view),
  );

  // A change of the search, a filter, or the sorting opens the first page,
  // as a new entry of the browser history (docs/screen-map.md, Browser
  // History). An empty search term, or a filter without values, reads as
  // absent (ticketListParams, src/routes/tickets/shared.ts), so it leaves
  // the URL.
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
            <AttentionSummary user={user} listFetching={list.isFetching} />
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
                  <TicketFilters
                    view={view}
                    search={search}
                    status={<span key={key}>{filtersStatus}</span>}
                    onRefine={refine}
                  />
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
        <TicketTable
          read={read}
          shown={shown}
          sort={sort}
          onSort={sortBy}
          onClear={clearFilters}
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
    const accepted = searchRedirect(ticketListSearch, location);
    if (accepted !== undefined) {
      throw redirect({ to: "/tickets", ...accepted });
    }
  },
  component: TicketListPage,
});
