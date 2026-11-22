import { linkOptions } from "@tanstack/react-router";
import type { CurrentUserData } from "../../api/generated/model";
import { CountLink } from "../../components/count-link";
import { FocusHandOff } from "../../components/screen-heading";
import {
  holdsConfidentiality,
  OVERDUE_PHASES,
  PHASE_NAMES,
  refinementOf,
  useTicketCount,
  viewNamed,
  type TicketListSearch,
} from "./shared";

// The attention summary of the Ticket list (src/routes/tickets.tsx), in its
// heading row.

// A count of the attention summary (docs/screen-map.md, Attention Summary).
interface AttentionCount {
  id: string;
  // Its label after its number: what it counts, or, among the overdue
  // counts, its phase.
  label: string;
  // The view and the filters that hold its Tickets, the All view unless it
  // names another, which the count reads and to which it links.
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

// The confidential Tickets whose Coordinated Release Date has passed, in
// every status, which the Embargo view lists with its embargo filter, with
// their dates (docs/screen-map.md, Attention Summary).
const EMBARGO_EXPIRED: AttentionCount = {
  id: "embargo-expired",
  label: "Embargo expired",
  search: { view: "embargo", embargo: ["expired"] },
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
  user: CurrentUserData;
  count: AttentionCount;
  // The name of its group, which assistive technologies read after its
  // label (CountLink).
  groupName?: string;
  // Whether the screen reads its list.
  listFetching: boolean;
}

// A count of the attention summary, which reads the Tickets of its view with
// its filters, so that it counts the rows of the list to which it links.
function AttentionCountLink({
  user,
  count,
  groupName,
  listFetching,
}: AttentionCountLinkProps) {
  const read = useTicketCount(
    {
      ...viewNamed(count.search.view).filters(user),
      ...refinementOf(count.search),
    },
    false,
    listFetching,
  );
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
  user: CurrentUserData;
  // Whether the screen reads its list.
  listFetching: boolean;
}

// The attention summary, in the heading row after the heading: counts of the
// Tickets that List Tickets returns to the user, each a link to the list
// refined to its Tickets (docs/screen-map.md, Attention Summary;
// docs/design-system.md, Lists). Active P1 measures priority, and Embargo
// expired, for a user who holds manage_confidentiality, the confidentiality
// that remains after the Coordinated Release Date; each stands alone, 8 px
// apart. The four overdue counts, which never count the same Ticket, form a
// group after them: a vertical line, 12 px from the count before it and from
// the name "Overdue", and the counts, 8 px apart, each showing its phase, as
// "1 Triage", and read whole, as "1 Triage overdue". The line and the name
// are hidden from assistive technologies, which read the name with each
// count. The group wraps to the next line as a whole, where its line stands
// 4 px after the start of the row, as the line of the views does, and its
// counts after its name when it is wider than its line. When Embargo expired
// leaves the page while it holds the focus, because a read of the signed-in
// user tells that the user no longer holds the capability, the focus moves to
// the screen's heading (docs/behaviors.md, Accessibility, Focus after an
// action).
export function AttentionSummary({
  user,
  listFetching,
}: AttentionSummaryProps) {
  return (
    <ul
      aria-label="Tickets that need attention"
      className="flex flex-wrap items-start gap-x-2 gap-y-2"
    >
      <li>
        <AttentionCountLink
          user={user}
          count={ACTIVE_P1}
          listFetching={listFetching}
        />
      </li>
      {holdsConfidentiality(user) && (
        <li>
          <FocusHandOff>
            <AttentionCountLink
              user={user}
              count={EMBARGO_EXPIRED}
              listFetching={listFetching}
            />
          </FocusHandOff>
        </li>
      )}
      <li className="flex items-start">
        <span aria-hidden className="flex h-8 items-center ps-1 pe-3">
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
                user={user}
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
