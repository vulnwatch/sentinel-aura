import type { TicketPriorityValue } from "../api/generated/model";
import { AbsentValue } from "./absent-value";

// The levels that the pinned contract lists, by their value: 1 for P1 to 4
// for P4. A Map, so that a value that a later Sentinel release returns is
// looked up only among them, never among the members of an object's
// prototype (docs/conventions.md, Data Read from the API).
const LEVELS = new Map<string, number>(
  Object.entries({
    p1: 1,
    p2: 2,
    p3: 3,
    p4: 4,
  } satisfies Record<TicketPriorityValue, number>),
);

// The marks, in a box of 14 by 14 units, at 14 px (docs/design-system.md,
// Priority). They are hidden from assistive technologies, which read the
// level that follows them.

function P1Mark() {
  return (
    <svg aria-hidden viewBox="0 0 14 14" className="size-3.5 shrink-0">
      <rect width={14} height={14} rx={3} className="fill-danger-solid" />
      <path
        d="M7 3.2V7.6"
        strokeLinecap="round"
        className="fill-none stroke-on-danger-solid stroke-[1.8]"
      />
      <circle cx={7} cy={10.4} r={1} className="fill-on-danger-solid" />
    </svg>
  );
}

// The three rising bars, standing on the line y = 13, from left to right.
const BARS = [
  { x: 1, height: 4 },
  { x: 5.5, height: 7.5 },
  { x: 10, height: 11 },
];

interface BarsMarkProps {
  // How many bars, from the first, are filled: 3 for P2, 2 for P3, 1 for P4.
  filled: number;
}

function BarsMark({ filled }: BarsMarkProps) {
  return (
    <svg aria-hidden viewBox="0 0 14 14" className="size-3.5 shrink-0">
      {BARS.map(({ x, height }, index) => (
        <rect
          key={x}
          x={x}
          y={13 - height}
          width={3}
          height={height}
          rx={0.8}
          className={index < filled ? "fill-fg-muted" : "fill-border"}
        />
      ))}
    </svg>
  );
}

interface PriorityProps {
  // The effective priority of a Ticket: a value of TicketPriorityValue,
  // another value that a later Sentinel release returns, or null while the
  // Ticket is not yet prioritizable (Sentinel
  // docs/features/tickets/ticket-priority.md, Priority Levels; Persistence
  // and Effective Priority).
  priority: string | null;
}

// A priority (docs/design-system.md, Priority): P1 as its red mark, then
// "P1" in fg at weight 600; P2, P3, and P4 as the bars, of which the first
// three, two, or one are filled, then the level in fg-muted; the mark 6 px
// before the level. null is an absent value, and a value that the pinned
// contract does not list shows as received, in fg, without a mark
// (docs/behaviors.md, Unknown Values).
export function Priority({ priority }: PriorityProps) {
  if (priority === null) {
    return <AbsentValue />;
  }
  const level = LEVELS.get(priority);
  if (level === undefined) {
    return <span className="text-fg">{priority}</span>;
  }
  if (level === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 align-middle font-semibold text-fg">
        <P1Mark />
        <span>P1</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 align-middle text-fg-muted">
      <BarsMark filled={5 - level} />
      <span>{`P${level}`}</span>
    </span>
  );
}
