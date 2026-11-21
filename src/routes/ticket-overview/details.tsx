import { linkOptions } from "@tanstack/react-router";
import { ClockAlert } from "lucide-react";
import { TicketStatusValue } from "../../api/generated/model";
import type { TicketDetail } from "../../api/generated/model";
import { useListTickets } from "../../api/generated/tickets";
import { AbsentValue } from "../../components/absent-value";
import { ConfidentialMark } from "../../components/confidential-mark";
import { DateTime } from "../../components/date-time";
import { dueState } from "../../components/deadline-badge";
import {
  DescriptionGroup,
  DescriptionItem,
  DescriptionList,
  GroupedItem,
} from "../../components/description-list";
import { SideSection } from "../../components/detail-screen";
import { ignoreReasonName } from "../../components/ignore-reason";
import { Link } from "../../components/link";
import { PartRead } from "../../components/read-view";
import { type Assignee, AssigneeField } from "./assignee";
import { COUNT, DETAILS_ANCHOR, duplicatesOf, PHASES } from "./shared";

// The details of the Ticket, the first part of the side column of Overview
// (src/routes/ticket-overview.tsx): its fields, with its deadlines, its
// duplicates, and its assignee (src/routes/ticket-overview/assignee.tsx).

// How a phase of the deadlines shows: in fg-muted before the current phase,
// which no track holds open any more; at weight 600, with its state, as the
// current phase; plain after it.
type PhaseLook = "over" | "current" | "ahead";

// The look of each phase for the current phase of the Ticket: every phase is
// over once the current phase is done; Triage is over when it is null with
// due dates, as on an Analyzed Ticket without a CVE, and the other phases are
// ahead; a current phase that the pinned contract does not list marks none.
function looksOf(currentPhase: string | null): PhaseLook[] {
  if (currentPhase === "done") {
    return PHASES.map(() => "over");
  }
  if (currentPhase === null) {
    return PHASES.map((_, index) => (index === 0 ? "over" : "ahead"));
  }
  const current = PHASES.findIndex(({ phase }) => phase === currentPhase);
  if (current === -1) {
    return PHASES.map(() => "ahead");
  }
  return PHASES.map((_, index) => {
    if (index < current) {
      return "over";
    }
    return index === current ? "current" : "ahead";
  });
}

const LOOKS: Record<PhaseLook, string> = {
  over: "text-fg-muted",
  current: "font-semibold text-fg",
  ahead: "text-fg",
};

interface PhaseStateProps {
  ticket: TicketDetail;
  due: string | null;
  now: number;
}

// The state of the current phase, below its date, in text-13: the days of the
// badge in words, as the milestone of the current phase states it, such as
// "Due in 3 days" in fg-muted, or "Overdue by 2 days" in danger-on-soft at
// weight 500 after clock-alert at 14 px in danger-icon; a state that the
// pinned contract does not list shows as received (docs/behaviors.md,
// Deadlines). The days compare the date with the same instant as the badge.
function PhaseState({ ticket, due, now }: PhaseStateProps) {
  const milestone = ticket.current_phase_milestone;
  const state = dueState(due, now);
  if (milestone === null || state === undefined) {
    return null;
  }
  if (milestone !== "pending" && milestone !== "overdue") {
    return (
      <span className="block text-13 font-normal text-fg-muted">
        {milestone}
      </span>
    );
  }
  const words = `${state.words.charAt(0).toUpperCase()}${state.words.slice(1)}`;
  if (state.tone === "danger") {
    return (
      <span className="flex items-center gap-1 text-13 font-medium text-danger-on-soft">
        <ClockAlert
          aria-hidden
          className="size-3.5 shrink-0 text-danger-icon"
        />
        {words}
      </span>
    );
  }
  return (
    <span className="block text-13 font-normal text-fg-muted">{words}</span>
  );
}

interface DeadlinesProps {
  ticket: TicketDetail;
  now: number;
}

// The deadlines of the Ticket as one group, a line per phase with its exact
// due date (docs/behaviors.md, Dates and Times, Display). Sentinel returns a
// state only for the current phase, so the other phases show their date
// alone, and it does not report a phase completed late, so neither does the
// screen (Sentinel docs/features/tickets/ticket-deadlines.md, Ticket Current
// Phase; Accepted Limitation). QA is due at the final release deadline, so
// its line says so while the two are equal; otherwise the final release
// deadline has a line of its own. Without due dates no SLA applies, and the
// group shows an absent value (same document, Null Due Dates).
function Deadlines({ ticket, now }: DeadlinesProps) {
  if (PHASES.every(({ due }) => ticket[due] === null)) {
    return (
      <DescriptionItem term="Deadlines">
        <AbsentValue />
      </DescriptionItem>
    );
  }
  const looks = looksOf(ticket.current_phase);
  const releaseApart = ticket.release_due_at !== ticket.qa_due_at;
  return (
    <DescriptionGroup term="Deadlines">
      {PHASES.map(({ phase, name, due }, index) => {
        const look = looks[index] ?? "ahead";
        const value = ticket[due];
        return (
          <GroupedItem
            key={phase}
            term={phase === "qa" && !releaseApart ? "QA, release" : name}
            tone={LOOKS[look]}
          >
            {value === null ? <AbsentValue /> : <DateTime value={value} />}
            {look === "current" && (
              <PhaseState ticket={ticket} due={value} now={now} />
            )}
          </GroupedItem>
        );
      })}
      {releaseApart && (
        <GroupedItem term="Release" tone={LOOKS.ahead}>
          {ticket.release_due_at === null ? (
            <AbsentValue />
          ) : (
            <DateTime value={ticket.release_due_at} />
          )}
        </GroupedItem>
      )}
    </DescriptionGroup>
  );
}

// A link to the screen of another Ticket.
function TicketLink({ ticketId }: { ticketId: string }) {
  return (
    <Link
      placement="list"
      href={linkOptions({ to: "/tickets/$ticketId", params: { ticketId } })}
    >
      {ticketId}
    </Link>
  );
}

// The read of the duplicates of a Ticket that is not a duplicate itself. A
// duplicate has none, since an original is never Duplicated (same document,
// Duplicate Handling, Invariant), so its read is not sent.
export function useDuplicates(ticket: TicketDetail) {
  return useListTickets(duplicatesOf(ticket.ticket_id), {
    query: { enabled: ticket.duplicate_of_ticket_id === null },
  });
}

type DuplicatesRead = ReturnType<typeof useDuplicates>;

interface DuplicatesProps {
  read: DuplicatesRead;
}

// The duplicates of the Ticket, each a link to its screen, followed by the
// lock of a confidential one, then, beyond a page, how many more there are,
// without a link; "None" without any. Their read loads and fails in place of
// the value (docs/behaviors.md, Where Errors Appear).
function Duplicates({ read }: DuplicatesProps) {
  return (
    <PartRead read={read} inValue>
      {(page) =>
        page.data.length === 0 ? (
          <AbsentValue name="None" />
        ) : (
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {page.data.map((duplicate) => (
              <li key={duplicate.ticket_id}>
                <TicketLink ticketId={duplicate.ticket_id} />
                {duplicate.is_confidential && <ConfidentialMark />}
              </li>
            ))}
            {page.meta.total > page.data.length && (
              <li className="text-fg-muted">
                and {COUNT.format(page.meta.total - page.data.length)} more
              </li>
            )}
          </ul>
        )
      }
    </PartRead>
  );
}

interface DetailsProps {
  ticket: TicketDetail;
  now: number;
  duplicates: DuplicatesRead;
  assignee: Assignee;
}

// The details of the Ticket, as a description list (docs/design-system.md,
// Detail Screens): the assignee in the full form, or "Unassigned", with its
// pencil for a user who can change it (AssigneeField); the Coordinated Release
// Date while the Ticket is confidential, as an absent value without a date,
// and while it has one, also after it became non-confidential (Sentinel
// docs/features/tickets/tickets.md, Coordinated Release Date); the deadlines;
// the original of a duplicate, which is only an identifier, or the duplicates
// of any other Ticket; the creation; and the last change, as "Last modified",
// as the Ticket list names it. Users show without a link and a card while the
// UI has no screen User (docs/behaviors.md, Open Decisions).
export function Details({ ticket, now, duplicates, assignee }: DetailsProps) {
  return (
    <SideSection id={DETAILS_ANCHOR} heading="Details">
      <DescriptionList>
        <DescriptionItem term="Assignee">
          <AssigneeField ticket={ticket} assignee={assignee} />
        </DescriptionItem>
        {ticket.status === TicketStatusValue.ignored && (
          <DescriptionItem term="Ignore reason">
            {ticket.ignore_reason === null ? (
              <AbsentValue />
            ) : (
              ignoreReasonName(ticket.ignore_reason)
            )}
          </DescriptionItem>
        )}
        {(ticket.is_confidential || ticket.coordinated_release_at !== null) && (
          <DescriptionItem term="Coordinated Release Date">
            {ticket.coordinated_release_at === null ? (
              <AbsentValue />
            ) : (
              <DateTime value={ticket.coordinated_release_at} />
            )}
          </DescriptionItem>
        )}
        <Deadlines ticket={ticket} now={now} />
        {ticket.duplicate_of_ticket_id === null ? (
          <DescriptionItem term="Duplicates">
            <Duplicates read={duplicates} />
          </DescriptionItem>
        ) : (
          <DescriptionItem term="Original">
            <TicketLink ticketId={ticket.duplicate_of_ticket_id} />
          </DescriptionItem>
        )}
        <DescriptionItem term="Created">
          <DateTime value={ticket.created_at} />
        </DescriptionItem>
        <DescriptionItem term="Last modified">
          <DateTime value={ticket.updated_at} />
        </DescriptionItem>
      </DescriptionList>
    </SideSection>
  );
}
