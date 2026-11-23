import { getLocalTimeZone, today } from "@internationalized/date";
import { keepPreviousData } from "@tanstack/react-query";
import {
  createRoute,
  linkOptions,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { z } from "zod";
import type { TicketAuditListResponse } from "../api/generated/model";
import {
  useListTicketActors,
  useListTicketEvents,
} from "../api/generated/ticket-audit-log";
import { useGetTicket } from "../api/generated/tickets";
import { Button } from "../components/button";
import { ButtonLink } from "../components/button-link";
import { EmptyState } from "../components/data-table";
import { DateRangeFilter } from "../components/date-range-filter";
import { dayOf } from "../components/date-time";
import {
  FilterGroup,
  Filters,
  FilterSelect,
  type SelectOption,
} from "../components/filters";
import { Label } from "../components/label";
import { Loading, UpdatingBar } from "../components/loading";
import {
  OptionsStatus,
  userOptionText,
  UserOptionLabel,
} from "../components/options";
import { Pagination } from "../components/pagination";
import { dataPlace, placeMessage } from "../components/read-view";
import {
  ResultAnnouncement,
  useChangedSinceOpened,
} from "../components/result-announcement";
import { FocusHandOff } from "../components/screen-heading";
import { SearchField } from "../components/search-field";
import { Timeline } from "../components/timeline";
import { Actor, type UserFields } from "../components/user";
import {
  LAST_PAGE,
  SEARCH_MAX_LENGTH,
  searchRedirect,
  searchTermParam,
  stringifySearch,
  valueListParam,
  wholeNumberParam,
} from "../search-params";
import { useSignedInUser } from "../session-gate";
import { ticketRoute } from "./ticket";
import { KIND_IDS, KIND_OPTIONS, KINDS } from "./ticket-audit-log/kinds";
import { timelineEventOf } from "./ticket-audit-log/sentences";

// The tab Audit log of the Ticket screen (docs/screens/ticket.md, Audit log):
// the events of the Ticket as a timeline (docs/design-system.md, Timelines),
// from List Ticket Events, which the user searches and filters by actor, kind,
// and period, from List Ticket Actors (Sentinel
// docs/features/tickets/ticket-audit-log.md, List Ticket Events; List Ticket
// Actors).

// The events of a page.
const PER_PAGE = 50;
// The first and the last date of the period in the URL, and the first date
// that its fields take until the screen has read the day of the first event
// (docs/screens/ticket.md, Navigation; Audit log).
const FIRST_DAY = "1970-01-01";
const LAST_DAY = "9999-12-30";

// --------------------------------------------------------------------------
// The search parameters (docs/screens/ticket.md, Navigation).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The actor: system, or the id of a user in lower case, never a username,
// which can change and can be system (Sentinel
// docs/features/tickets/ticket-audit-log.md, List Ticket Events).
const actorParam = z
  .string()
  .refine((value) => value === "system" || UUID.test(value))
  .transform((value) => value.toLowerCase())
  .optional()
  .catch(undefined);

// The year, the month, and the day of a date such as 2026-11-08, or
// undefined for another value.
function partsOf(value: string) {
  const groups = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(
    value,
  )?.groups;
  if (groups === undefined) {
    return undefined;
  }
  return {
    year: Number(groups.year),
    month: Number(groups.month),
    day: Number(groups.day),
  };
}

// Whether a value is a date, such as 2026-11-08, of the period.
function isPeriodDate(value: string): boolean {
  const parts = partsOf(value);
  if (parts === undefined) {
    return false;
  }
  const { year, month, day } = parts;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    value >= FIRST_DAY &&
    value <= LAST_DAY
  );
}

const dateParam = z.string().refine(isPeriodDate).optional().catch(undefined);

const auditLogParams = z.object({
  search: searchTermParam,
  actor: actorParam,
  kind: valueListParam(KIND_IDS),
  from: dateParam,
  to: dateParam,
  page: wholeNumberParam(LAST_PAGE),
});

type AuditLogSearch = z.output<typeof auditLogParams>;

// The parameters in the form that the screen gives them: without the first
// page, and without a range whose start follows its end (docs/behaviors.md,
// Invalid Search Parameters).
const auditLogSearch = auditLogParams.transform((search): AuditLogSearch => {
  const inverted =
    search.from !== undefined &&
    search.to !== undefined &&
    search.from > search.to;
  return {
    ...search,
    from: inverted ? undefined : search.from,
    to: inverted ? undefined : search.to,
    page: search.page === 1 ? undefined : search.page,
  };
});

// The first instant of a day in the time zone of the browser, or its last,
// in UTC, which the period sends (docs/behaviors.md, Dates and Times, Input;
// Sentinel docs/api-spec.md, Date Range Interpretation).
function instantOf(date: string | undefined, end: boolean): string | undefined {
  const parts = date === undefined ? undefined : partsOf(date);
  if (parts === undefined) {
    return undefined;
  }
  const { year, month, day } = parts;
  if (!end) {
    return new Date(year, month - 1, day).toISOString();
  }
  // The microsecond before the next day starts, the resolution of the times
  // of Sentinel, so that the day keeps every event up to its end, also on a
  // day whose last hour repeats when the clock goes back.
  const next = new Date(year, month - 1, day + 1);
  return new Date(next.getTime() - 1)
    .toISOString()
    .replace(/\.(\d{3})Z$/, ".$1999Z");
}

// The number of the filters that apply.
function filtersApplied(search: AuditLogSearch): number {
  return [search.actor, search.kind, search.from ?? search.to].filter(
    (value) => value !== undefined,
  ).length;
}

// What the user refined the events with: the search alone, filters, with or
// without the search, or nothing.
function refinedBy(search: AuditLogSearch): "search" | "filters" | undefined {
  if (filtersApplied(search) > 0) {
    return "filters";
  }
  return search.search === undefined ? undefined : "search";
}

// --------------------------------------------------------------------------
// The screen.

const COUNT = new Intl.NumberFormat("en-US");

// The empty state of a page without events (docs/behaviors.md, Empty States).
function emptyMessage(
  { meta }: TicketAuditListResponse,
  search: AuditLogSearch,
): string {
  if (meta.total > 0) {
    return "There are no events on this page.";
  }
  switch (refinedBy(search)) {
    case "search":
      return "No events match the search.";
    case "filters":
      return "No events match the filters.";
    default:
      return "No events.";
  }
}

// What the timeline shows, in words, which assistive technologies announce
// after another page, search, or filter (docs/behaviors.md, Accessibility,
// Focus after a navigation).
function resultText(list: TicketAuditListResponse, search: AuditLogSearch) {
  const { data, meta } = list;
  if (data.length === 0) {
    return emptyMessage(list, search);
  }
  if (meta.total <= meta.per_page) {
    return `${COUNT.format(meta.total)} ${meta.total === 1 ? "event" : "events"}`;
  }
  const first = (meta.page - 1) * meta.per_page + 1;
  const last = first + data.length - 1;
  return `${COUNT.format(first)}–${COUNT.format(last)} of ${COUNT.format(meta.total)} events`;
}

// The value of the actor filter without one.
const ANY_ACTOR = "any";

// An actor as an option of the filter, in the full form with the username
// and the labels, and the label You for the signed-in user.
function actorOption(actor: UserFields, you: boolean): SelectOption<string> {
  return {
    value: actor.id,
    text: userOptionText(actor),
    label: (
      <UserOptionLabel
        user={actor}
        labels={you ? <Label>You</Label> : undefined}
      />
    ),
  };
}

interface ActorFilterProps {
  ticketId: string;
  selected: string | undefined;
  onChange: (actor: string | undefined) => void;
}

// The actor filter: Any actor, System, and the signed-in user with the
// label You when they acted on the Ticket; then the other users who acted on
// it, from List Ticket Actors, in its order.
function ActorFilter({ ticketId, selected, onChange }: ActorFilterProps) {
  const me = useSignedInUser();
  // The tab reads the actors; the filter shows them as they are cached.
  const actors = useListTicketActors(ticketId, { query: { enabled: false } });
  const users = actors.data?.data ?? [];
  const mine = users.find((user) => user.id === me?.id);
  const fixed: SelectOption<string>[] = [
    { value: ANY_ACTOR, text: "Any actor", label: "Any actor" },
    {
      value: "system",
      text: "System",
      label: <Actor actor={null} />,
    },
    ...(mine === undefined ? [] : [actorOption(mine, true)]),
  ];
  const others = users
    .filter((user) => user.id !== me?.id)
    .map((user) => actorOption(user, false));
  let status: ReactNode = null;
  if (actors.data === undefined) {
    status = (
      <OptionsStatus>
        {actors.status === "error" ? (
          <p>{placeMessage(actors)}</p>
        ) : (
          <Loading inValue />
        )}
      </OptionsStatus>
    );
  }
  return (
    <FilterSelect
      label="Actor"
      groups={[fixed, others]}
      status={status}
      selected={selected ?? ANY_ACTOR}
      unlisted={
        actors.status === "pending" ? (
          <Loading inValue />
        ) : (
          <span className="text-fg-muted">Unknown user</span>
        )
      }
      onChange={(value) => {
        onChange(value === ANY_ACTOR ? undefined : value);
      }}
    />
  );
}

// The data of the timeline that shows, which stays while other data loads,
// with the search parameters of its read, which its empty state and its
// pagination keep.
function useShownSearch(
  read: { dataUpdatedAt: number; isPlaceholderData: boolean },
  search: AuditLogSearch,
): AuditLogSearch {
  const [shown, setShown] = useState({ at: 0, search });
  if (!read.isPlaceholderData && read.dataUpdatedAt !== shown.at) {
    setShown({ at: read.dataUpdatedAt, search });
  }
  return shown.search;
}

function TicketAuditLog() {
  const { ticketId } = ticketAuditLogRoute.useParams();
  const search = ticketAuditLogRoute.useSearch();
  const navigate = useNavigate();
  const page = search.page ?? 1;
  // Whether the Ticket has arrived: until it has, a failure of the events
  // waits, so that a Ticket that the user cannot see shows Not found rather
  // than the failure of a part (docs/screens/ticket.md, States).
  const ticketShown =
    useGetTicket(ticketId, { query: { enabled: false } }).data !== undefined;

  const types = search.kind?.flatMap(
    (id) => KINDS.find((kind) => kind.id === id)?.types ?? [],
  );
  const events = useListTicketEvents(
    ticketId,
    {
      event_type: types,
      actor: search.actor,
      search: search.search,
      from_date: instantOf(search.from, false),
      to_date: instantOf(search.to, true),
      page,
      per_page: PER_PAGE,
    },
    { query: { placeholderData: keepPreviousData } },
  );
  // List Ticket Actors is read when the tab opens, not when Filters opens
  // the actor filter, which reads it from the cache (docs/screens/ticket.md,
  // Audit log).
  useListTicketActors(ticketId);
  // The first event of the Ticket, its ticket_created, gives the period its
  // first day, in the time zone of the browser (docs/screens/ticket.md, Audit
  // log; Sentinel docs/features/tickets/ticket-audit-log.md, Cross-Event
  // Ordering, Locking, and Rollback). Until a read of it succeeds, the period
  // takes the days from FIRST_DAY, and its failure shows nowhere
  // (docs/behaviors.md, Where Errors Appear).
  // As its failure shows nowhere, the screen reads it again when the tab
  // returns to the foreground also without data (src/query-client.ts).
  const created = useListTicketEvents(
    ticketId,
    { event_type: ["ticket_created"], per_page: 1 },
    { query: { refetchOnWindowFocus: true } },
  ).data?.data[0]?.created_at;
  const firstDay = created === undefined ? undefined : dayOf(created).date;
  const now = today(getLocalTimeZone()).toString();
  // Today, or a first day after it, which a clock of the browser behind
  // Sentinel's gives.
  const lastDay = firstDay !== undefined && firstDay > now ? firstDay : now;
  const shownSearch = useShownSearch(events, search);
  const refined = refinedBy(search);

  const refine = (change: Partial<AuditLogSearch>) => {
    void navigate({
      to: "/tickets/$ticketId/audit-log",
      params: { ticketId },
      search: (previous) => ({ ...previous, ...change, page: undefined }),
    });
  };
  const clearFilters = () => {
    void navigate({
      to: "/tickets/$ticketId/audit-log",
      params: { ticketId },
      search: {},
    });
  };
  const pageHref = (target: number) =>
    linkOptions({
      to: "/tickets/$ticketId/audit-log",
      params: { ticketId },
      search: { ...shownSearch, page: target === 1 ? undefined : target },
    });

  // A change of the page, the search, or a filter announces what the
  // timeline shows, once it shows it; the tab as it opens does not
  // (docs/behaviors.md, Accessibility, Focus after a navigation).
  const key = stringifySearch(search);
  const changed = useChangedSinceOpened(key);
  const announcement =
    changed && events.status === "success" && !events.isPlaceholderData
      ? resultText(events.data, search)
      : "";
  const filtersStatus =
    events.status === "error" ? placeMessage(events) : announcement;

  const place = dataPlace(events);
  const failure = ticketShown ? place.failure : null;
  const waiting = place.waiting || (place.failure !== null && !ticketShown);
  const data = place.data;

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SearchField
          placeholder="Search events"
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
          <ActorFilter
            ticketId={ticketId}
            selected={search.actor}
            onChange={(actor) => {
              refine({ actor });
            }}
          />
          <FilterGroup
            label="Kind"
            options={KIND_OPTIONS}
            selected={search.kind ?? []}
            onChange={(values) => {
              refine({ kind: values });
            }}
          />
          <DateRangeFilter
            startLabel="From"
            endLabel="To"
            applied={{ start: search.from, end: search.to }}
            startDefault={firstDay}
            min={firstDay ?? FIRST_DAY}
            max={lastDay}
            onApply={({ start, end }) => {
              refine({ from: start, to: end });
            }}
          />
        </Filters>
        {refined !== undefined && (
          <FocusHandOff>
            <Button variant="quiet" size="small" onPress={clearFilters}>
              <X aria-hidden className="size-4" />
              Clear filters
            </Button>
          </FocusHandOff>
        )}
      </div>
      <div className="relative mt-4">
        {place.updating && <UpdatingBar />}
        <output className="block">{failure ?? place.warning}</output>
        {data === undefined ? (
          waiting && <Loading />
        ) : data.data.length === 0 ? (
          // A key of each place, so that the one that leaves the page hands
          // the focus off, rather than taking the content of the other.
          <FocusHandOff key="empty">
            <EmptyState
              message={emptyMessage(data, shownSearch)}
              action={
                data.meta.total > 0 ? (
                  <ButtonLink href={pageHref(1)}>
                    Go to the first page
                  </ButtonLink>
                ) : refinedBy(shownSearch) === undefined ? undefined : (
                  <Button onPress={clearFilters}>
                    <X aria-hidden className="size-4" />
                    Clear filters
                  </Button>
                )
              }
            />
          </FocusHandOff>
        ) : (
          <FocusHandOff key="events">
            <Timeline events={data.data.map(timelineEventOf)} />
          </FocusHandOff>
        )}
        {data !== undefined && (
          <Pagination
            page={data.meta.page}
            perPage={data.meta.per_page}
            total={data.meta.total}
            href={pageHref}
          />
        )}
      </div>
      <ResultAnnouncement state={key}>{announcement}</ResultAnnouncement>
    </>
  );
}

// The tab Audit log, at its path under the path of the Ticket. A URL with a
// search parameter that it does not accept, or with a value that it does not
// accept or gives in another form, leads to the URL that it gives that state,
// in place of the URL in the browser history (docs/behaviors.md, Invalid
// Search Parameters; docs/screen-map.md, Browser History).
export const ticketAuditLogRoute = createRoute({
  getParentRoute: () => ticketRoute,
  path: "audit-log",
  validateSearch: auditLogSearch,
  beforeLoad: ({ location, params }) => {
    const accepted = searchRedirect(auditLogSearch, location);
    if (accepted !== undefined) {
      throw redirect({
        to: "/tickets/$ticketId/audit-log",
        params,
        ...accepted,
      });
    }
  },
  component: TicketAuditLog,
});
