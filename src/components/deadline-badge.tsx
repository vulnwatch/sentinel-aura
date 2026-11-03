import { ClockAlert } from "lucide-react";
import type { CurrentPhaseValue, TicketSummary } from "../api/generated/model";

// The deadline of a Ticket (docs/behaviors.md, Deadlines;
// docs/design-system.md, Deadline Badge; Sentinel
// docs/features/tickets/ticket-deadlines.md, Due Dates; Ticket Current
// Phase).

const DAY_MS = 24 * 60 * 60 * 1000;

type DueDate =
  | "triage_due_at"
  | "submission_due_at"
  | "um_due_at"
  | "qa_due_at"
  | "release_due_at";

// The fields of a Ticket that its deadline depends on, which TicketSummary
// and TicketDetail carry. current_phase takes every string: a later Sentinel
// release can return a phase that the pinned contract does not list (Sentinel
// docs/api-spec.md, Response Enums).
export type DeadlineTicket = Pick<TicketSummary, DueDate> & {
  current_phase: string | null;
};

interface Phase {
  name: string;
  due: DueDate;
}

// The final release deadline, which a Ticket shows when its current phase is
// null and it has due dates: no phase that Sentinel observes is open, but a
// track may still have work in a phase that Sentinel cannot observe (Sentinel
// docs/features/tickets/ticket-deadlines.md, Observability of Later Phases).
const RELEASE: Phase = { name: "Release", due: "release_due_at" };

// The current phases that the pinned contract lists, by their value; done,
// which leaves no deadline, is null. A Map, so that a value that a later
// Sentinel release returns is looked up only among them, never among the
// members of an object's prototype (docs/conventions.md, Data Read from the
// API).
const PHASES = new Map<string, Phase | null>(
  Object.entries({
    triage: { name: "Triage", due: "triage_due_at" },
    submission: { name: "Submission", due: "submission_due_at" },
    um: { name: "UM", due: "um_due_at" },
    qa: { name: "QA", due: "qa_due_at" },
    done: null,
  } satisfies Record<CurrentPhaseValue, Phase | null>),
);

export type DeadlineTone = "success" | "warning" | "danger" | "neutral";

export interface Deadline {
  tone: DeadlineTone;
  // The text of the badge, such as "Submission 3d".
  text: string;
  // Its accessible name, such as "Submission due in 3 days".
  description: string;
}

// The instant of a date and time of the API in milliseconds, or NaN when it
// is null or not a date and time.
function instant(value: string | null): number {
  return value === null ? Number.NaN : Date.parse(value);
}

const COUNT = new Intl.NumberFormat("en-US");

// A number of days, with the singular or the plural (docs/behaviors.md,
// Style).
function dayCount(days: number): string {
  return `${COUNT.format(days)} ${days === 1 ? "day" : "days"}`;
}

// The deadline that the badge of a Ticket shows at the instant now, in
// milliseconds since the epoch, or undefined when it shows no badge: for done,
// for a current phase of null without due dates, and for a phase without its
// due date. A day is 24 hours: the badge shows the whole days that remain to
// the date, 0 in the last day, and once the date is past, which Sentinel
// defines as before the current instant (Sentinel
// docs/features/tickets/ticket-deadlines.md, Evaluation Instant), the days
// begun since, as a negative number. It is red once the date is past, yellow
// in the last day, and green otherwise, so that the same days show in the
// same color in every row. A phase that the pinned contract does not list
// shows as received, in the neutral tone, without days (docs/behaviors.md,
// Unknown Values).
export function deadline(
  ticket: DeadlineTicket,
  now: number,
): Deadline | undefined {
  let phase: Phase | null | undefined = RELEASE;
  if (ticket.current_phase !== null) {
    phase = PHASES.get(ticket.current_phase);
    if (phase === undefined) {
      return {
        tone: "neutral",
        text: ticket.current_phase,
        description: ticket.current_phase,
      };
    }
  }
  if (phase === null) {
    return undefined;
  }
  const due = instant(ticket[phase.due]);
  if (Number.isNaN(due)) {
    return undefined;
  }
  const days = Math.floor((due - now) / DAY_MS);
  if (due < now) {
    return {
      tone: "danger",
      text: `${phase.name} -${COUNT.format(-days)}d`,
      description: `${phase.name} overdue by ${dayCount(-days)}`,
    };
  }
  if (days === 0) {
    return {
      tone: "warning",
      text: `${phase.name} 0d`,
      description: `${phase.name} due in less than a day`,
    };
  }
  return {
    tone: "success",
    text: `${phase.name} ${COUNT.format(days)}d`,
    description: `${phase.name} due in ${dayCount(days)}`,
  };
}

// The colors of each tone (docs/design-system.md, Tones).
const TONES = {
  success: "bg-success-soft text-success-on-soft",
  warning: "bg-warning-soft text-warning-on-soft",
  danger: "bg-danger-soft text-danger-on-soft",
  neutral: "bg-neutral-soft text-neutral-on-soft",
} as const satisfies Record<DeadlineTone, string>;

interface DeadlineBadgeProps {
  ticket: DeadlineTicket;
  // The instant with which the badge compares the date, in milliseconds since
  // the epoch: the browser's clock when the screen shows its data, the same
  // for every badge of the screen.
  now: number;
}

// The deadline badge of a Ticket (docs/design-system.md, Deadline Badge):
// 24 px high, in the soft background of its tone, its text in text-13 at
// weight 500 with tabular figures, and once the date is past, clock-alert at
// 12 px 4 px before it. Assistive technologies read the deadline in words in
// place of the text. Without a deadline, nothing shows, and the place stays
// empty.
export function DeadlineBadge({ ticket, now }: DeadlineBadgeProps) {
  const shown = deadline(ticket, now);
  if (shown === undefined) {
    return null;
  }
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded px-2 align-middle text-13 font-medium whitespace-nowrap tabular-nums ${TONES[shown.tone]}`}
    >
      {shown.tone === "danger" && (
        <ClockAlert aria-hidden className="size-3 shrink-0" />
      )}
      {shown.text === shown.description ? (
        <span>{shown.text}</span>
      ) : (
        <>
          <span aria-hidden>{shown.text}</span>
          <span className="sr-only">{shown.description}</span>
        </>
      )}
    </span>
  );
}
