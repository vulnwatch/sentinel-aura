import { CircleQuestionMark } from "lucide-react";
import type { ReactNode } from "react";
import type { TicketStatusValue } from "../api/generated/model";

// The marks of the statuses, in a box of 16 by 16 units centered on (8, 8),
// in the color of the status, with lines 1.75 wide (docs/design-system.md,
// Ticket Status). An active status is a ring, more filled the further the
// Ticket has come; an inactive one is a disc, with its sign in surface.

const RADIUS = 6.25;
const LINE = 1.75;

// New: the ring as eight equal dashes, centered on the axes and the
// diagonals, with gaps of 1.9 between their round ends. Each round end
// reaches half the line beyond its dash, so the gap of the pattern is the
// visible gap and a whole line.
const NEW_PERIOD = (2 * Math.PI * RADIUS) / 8;
const NEW_GAP = 1.9 + LINE;
const NEW_DASH = NEW_PERIOD - NEW_GAP;

function Ring() {
  return (
    <circle cx={8} cy={8} r={RADIUS} className="fill-none stroke-current" />
  );
}

function Disc() {
  return <circle cx={8} cy={8} r={7} className="fill-current" />;
}

interface SignProps {
  d: string;
}

// A line inside a disc, in surface.
function Sign({ d }: SignProps) {
  return <path d={d} className="fill-none stroke-surface" />;
}

interface KnownStatus {
  name: string;
  // The class of the color of its mark.
  color: string;
  shapes: ReactNode;
}

// The statuses that the pinned contract lists, by their value: info-icon for
// the active ones, success-icon for Resolved, and neutral-icon for Ignored
// and Duplicated (Sentinel docs/features/tickets/tickets.md, Statuses; Status
// Categories). A Map, so that a value that a later Sentinel release returns
// is looked up only among them, never among the members of an object's
// prototype (docs/conventions.md, Data Read from the API).
const STATUSES = new Map<string, KnownStatus>(
  Object.entries({
    new: {
      name: "New",
      color: "text-info-icon",
      shapes: (
        <circle
          cx={8}
          cy={8}
          r={RADIUS}
          strokeDasharray={`${NEW_DASH} ${NEW_GAP}`}
          strokeDashoffset={NEW_DASH / 2}
          className="fill-none stroke-current"
        />
      ),
    },
    analysis: {
      name: "Analysis",
      color: "text-info-icon",
      shapes: (
        <>
          <Ring />
          <path d="M8 8V4.5A3.5 3.5 0 0 1 8 11.5Z" className="fill-current" />
        </>
      ),
    },
    analyzed: {
      name: "Analyzed",
      color: "text-info-icon",
      shapes: (
        <>
          <Ring />
          <path d="M8 8V4.5A3.5 3.5 0 1 1 4.5 8Z" className="fill-current" />
        </>
      ),
    },
    resolved: {
      name: "Resolved",
      color: "text-success-icon",
      shapes: (
        <>
          <Disc />
          <Sign d="M4.9 8.2 7 10.2l4.1-4.3" />
        </>
      ),
    },
    ignored: {
      name: "Ignored",
      color: "text-neutral-icon",
      shapes: (
        <>
          <Disc />
          <Sign d="M5.2 10.8 10.8 5.2" />
        </>
      ),
    },
    duplicated: {
      name: "Duplicated",
      color: "text-neutral-icon",
      shapes: (
        <>
          <Disc />
          <Sign d="M4.6 8h6.1M8.4 5.6 10.8 8l-2.4 2.4" />
        </>
      ),
    },
  } satisfies Record<TicketStatusValue, KnownStatus>),
);

interface TicketStatusProps {
  // A value of TicketStatusValue, or another value that a later Sentinel
  // release returns.
  status: string;
}

// A Ticket status: its mark of 16 px, then, 6 px later, its name in fg
// (docs/behaviors.md, Domain Terms). The mark is hidden from assistive
// technologies, which read the name. A status that the pinned contract does
// not list shows as received, after circle-question-mark in neutral-icon
// (docs/behaviors.md, Unknown Values).
export function TicketStatus({ status }: TicketStatusProps) {
  const known = STATUSES.get(status);
  return (
    <span className="inline-flex items-center gap-1.5 align-middle text-fg">
      {known === undefined ? (
        <CircleQuestionMark
          aria-hidden
          className="size-4 shrink-0 text-neutral-icon"
        />
      ) : (
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          strokeWidth={LINE}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-4 shrink-0 ${known.color}`}
        >
          {known.shapes}
        </svg>
      )}
      <span>{known === undefined ? status : known.name}</span>
    </span>
  );
}
