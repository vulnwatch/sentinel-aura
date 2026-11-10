import { useRef } from "react";
import {
  Button as AriaButton,
  DialogTrigger,
  Heading,
} from "react-aria-components";
import type {
  EPSSPercentilePriorityEvidence,
  ExploitationLevel,
  KEVPriorityEvidence,
  PriorityEvidence,
  SSVCExploitationEvidenceValue,
  SSVCExploitationPriorityEvidence,
} from "../api/generated/model";
import { AbsentValue } from "./absent-value";
import { DateTime, formatDate } from "./date-time";
import { FOCUS_RING } from "./focus-ring";
import { InfoPopover, PopoverLine } from "./info-popover";
import { Priority, priorityName } from "./priority";
import { Severity } from "./severity";
import { User, type UserFields } from "./user";

// The explanation of the priority of a Ticket (docs/design-system.md,
// Priority, Explanation): whether the effective priority is automatic or an
// override, what the automatic priority is based on, and who set an override
// and when.

// A piece of deciding evidence of a kind that the pinned contract lists, with
// its value (Sentinel docs/features/tickets/tickets.md, PriorityEvidence).
// The value of SSVC takes every string: a later Sentinel release can return
// one that the pinned contract does not list (Sentinel docs/api-spec.md,
// Response Enums).
type ListedEvidence =
  | KEVPriorityEvidence
  | (Omit<SSVCExploitationPriorityEvidence, "value"> & { value: string })
  | EPSSPercentilePriorityEvidence;

// A piece of deciding evidence of any kind, one that the pinned contract
// does not list included.
type Evidence = ListedEvidence | { kind: string; value?: unknown };

// The fields of a Ticket that its explanation shows, which TicketSummary and
// TicketDetail carry. They suffice: the explanation needs no copy of the
// Decision Table or of the threshold of the EPSS percentile (Sentinel
// docs/features/tickets/tickets.md, PriorityBasis; PriorityEvidence; Sentinel
// docs/features/tickets/ticket-priority.md, Automatic Priority Basis). The
// values of their enums take every string, as a later Sentinel release can
// return another. The user who set the override and the time at which they
// set it are its provenance, which Sentinel returns exactly when an override
// is set (Sentinel docs/features/tickets/ticket-priority.md, Persistence and
// Effective Priority).
export interface PriorityFields {
  priority: string | null;
  priority_automatic: string | null;
  priority_override: string | null;
  priority_override_by: UserFields | null;
  priority_override_at: string | null;
  priority_automatic_basis: {
    severity: string | null;
    exploitation: string;
    evidence: readonly Evidence[];
  };
}

// The kinds of deciding evidence that the pinned contract lists, each of
// which ListedEvidence types.
const LISTED_KINDS = new Set<string>(
  Object.keys({
    kev: true,
    ssvc_exploitation: true,
    epss_percentile: true,
  } satisfies Record<PriorityEvidence["kind"], true>),
);

function isListed(evidence: Evidence): evidence is ListedEvidence {
  return LISTED_KINDS.has(evidence.kind);
}

// The exploitation levels that the pinned contract lists, by their value. A
// Map, so that a value that a later Sentinel release returns is looked up
// only among them, never among the members of an object's prototype
// (docs/conventions.md, Data Read from the API).
const EXPLOITATION_LEVELS = new Map<string, string>(
  Object.entries({
    kev: "KEV",
    active: "Active",
    likely: "Likely",
    unknown: "Unknown",
  } satisfies Record<ExploitationLevel, string>),
);

// The values of the SSVC exploitation decision point that decide a level, as
// CISA SSVC names them.
const SSVC_EXPLOITATION = new Map<string, string>(
  Object.entries({
    active: "Active",
    poc: "PoC",
  } satisfies Record<SSVCExploitationEvidenceValue, string>),
);

// A percentile cut to two decimals, such as 0.97 for 0.9712, so that it never
// shows more than its value. Its text with ten decimals leaves out the error
// of its binary representation, which would cut 0.29 to 0.28.
function cutPercentile(value: number): string {
  const text = value.toFixed(10);
  return text.slice(0, text.indexOf(".") + 3);
}

// The line of a piece of deciding evidence. A kind that the pinned contract
// does not list, which a later Sentinel release can return, shows as
// received, without its value, whose meaning depends on the kind
// (docs/behaviors.md, Unknown Values).
function evidenceLine(evidence: Evidence): string {
  if (!isListed(evidence)) {
    return evidence.kind;
  }
  if (evidence.kind === "kev") {
    return `Listed in CISA KEV on ${formatDate(evidence.value)}`;
  }
  if (evidence.kind === "ssvc_exploitation") {
    return `SSVC exploitation ${SSVC_EXPLOITATION.get(evidence.value) ?? evidence.value}`;
  }
  return `EPSS percentile ${cutPercentile(evidence.value)}`;
}

interface ExplanationProps {
  ticket: PriorityFields;
  isOverride: boolean;
}

interface ProvenanceProps {
  ticket: PriorityFields;
}

// Who set an override and when, in text-13, on two lines 4 px apart: the
// user in the name form, and the date and time. A value that is absent shows
// as an absent value, never as System, since no system task sets an override
// (Sentinel docs/features/tickets/ticket-priority.md, Manual Override). Each
// value starts after its label, on the baseline of its first line, and
// shrinks to the room that the label leaves, so that the label stays whole;
// the name wraps, so that the explanation, which holds nothing else that
// shows it, shows it whole.
function Provenance({ ticket }: ProvenanceProps) {
  return (
    <div className="flex flex-col gap-1 text-13">
      <p className="flex items-baseline gap-1.5">
        <span className="shrink-0 text-fg-muted">Override set by</span>
        {ticket.priority_override_by === null ? (
          <AbsentValue />
        ) : (
          // A flex container, in which the user takes no vertical alignment of
          // its own and gives its first line as the baseline.
          <span className="flex min-w-0">
            <User user={ticket.priority_override_by} withAvatar={false} wrap />
          </span>
        )}
      </p>
      <p className="flex items-baseline gap-1.5">
        <span className="shrink-0 text-fg-muted">Override set on</span>
        {ticket.priority_override_at === null ? (
          <AbsentValue />
        ) : (
          <DateTime value={ticket.priority_override_at} />
        )}
      </p>
    </div>
  );
}

// The content of the explanation: its title, which names it, a border line
// 12 px below it and 12 px above the sections, then the section of the basis
// and the section of the evidence, 12 px apart, each with its heading in
// text-12, weight 500, fg-muted, and its lines 4 px apart, and last, for an
// override, another border line 12 px around and who set it and when, as
// details of the override, right below the evidence with which the reader
// compares them.
function Explanation({ ticket, isOverride }: ExplanationProps) {
  const basis = ticket.priority_automatic_basis;
  const heading = "text-12 font-medium text-fg-muted";
  return (
    <>
      {ticket.priority === null ? (
        <Heading slot="title" level={2} className="text-16 font-semibold">
          Not yet prioritizable
        </Heading>
      ) : (
        // Named as assistive technologies read it, such as "P1, override",
        // without the middle dot that sets the words apart on the screen.
        <Heading
          slot="title"
          level={2}
          aria-label={`${priorityName(ticket.priority)}, ${isOverride ? "override" : "automatic"}`}
          className="flex flex-wrap items-center gap-1.5 text-16 font-semibold"
        >
          <Priority priority={ticket.priority} />
          <span>·</span>
          <span>{isOverride ? "override" : "automatic"}</span>
        </Heading>
      )}
      <PopoverLine />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className={heading}>
            {isOverride ? "Automatic priority" : "Based on"}
          </h3>
          {isOverride && (
            <p className="flex items-center">
              {ticket.priority_automatic === null ? (
                "Not yet prioritizable"
              ) : (
                <Priority priority={ticket.priority_automatic} />
              )}
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <span className="text-fg-muted">Severity</span>
            <Severity severity={basis.severity} />
          </p>
          <p className="flex items-center gap-1.5">
            <span className="text-fg-muted">Exploitation</span>
            <span>
              {EXPLOITATION_LEVELS.get(basis.exploitation) ??
                basis.exploitation}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className={heading}>Evidence</h3>
          {basis.evidence.length === 0 ? (
            <p className="text-fg-muted">No evidence.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {basis.evidence.map((evidence, index) => (
                <li key={`${evidence.kind}-${index}`}>
                  {evidenceLine(evidence)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {isOverride && (
        <>
          <PopoverLine />
          <Provenance ticket={ticket} />
        </>
      )}
    </>
  );
}

interface ExplainedPriorityProps {
  ticket: PriorityFields;
  // Where the priority shows: in a cell of a table, whose whole cell is the
  // button, or in the text around it, such as the heading row of a detail
  // screen, where the box is the button (docs/design-system.md, Priority,
  // Explanation).
  placement?: "cell" | "inline";
  // The word that the screen document gives a priority of null, which also
  // names the button, such as in a heading row, where no column header
  // names it (docs/behaviors.md, Absent Values).
  absentName?: string;
}

// The priority of a Ticket as the button of its explanation, named by the
// priority, as the level followed by ", override" for an override. In a cell
// of a table, the button fills the cell, the nearest positioned element
// around it, so that the cell holds no smaller target beside it once the
// focus is in it; elsewhere, the button is the box. The priority, with the
// icon of an override, shows in a box 24 px high and at least 24 px wide,
// with 4 px of side padding that keeps the level where the priority shows
// without a button, and a 4 px radius, on neutral-soft under the pointer and
// while the popover is open, with the focus ring around it. A click, a tap,
// Enter, or Space opens the explanation in a popover 288 px wide, with 16 px
// of padding, in text-14, below the box and aligned to its start, or above it
// where the window has no room below, moved toward the start where it would
// pass the end of the window, and scrolling within it in a window shorter
// than it is (InfoPopover). The explanation holds no control and takes the focus itself,
// with the focus ring around its content on keyboard focus, named by its
// title; while it is open, the rest of the page is out of reach. Escape or a
// click outside closes it, and the focus returns to the priority.
export function ExplainedPriority({
  ticket,
  placement = "cell",
  absentName,
}: ExplainedPriorityProps) {
  const cellBox = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const isOverride = ticket.priority_override !== null;
  const name =
    ticket.priority === null && absentName !== undefined
      ? absentName
      : priorityName(ticket.priority);
  const label = isOverride ? `${name}, override` : name;
  return (
    <DialogTrigger>
      {placement === "cell" ? (
        <>
          {/* Before the box, whose look follows its state (peer). It extends
              a pixel beyond the cell, whose bounds include part of the border
              lines between its row and the rows around it, so that the cell
              is covered whole, except below the last row, which has no line
              below it, so that the button does not reach past the table. */}
          <AriaButton
            aria-label={label}
            className="peer absolute -inset-px cursor-default outline-none in-[tr:last-child]:bottom-0"
          />
          <span
            ref={cellBox}
            aria-hidden
            className="-mx-1 inline-flex h-6 min-w-6 items-center rounded px-1 align-middle peer-data-hovered:bg-neutral-soft peer-aria-expanded:bg-neutral-soft peer-data-focus-visible:outline-2 peer-data-focus-visible:outline-offset-2 peer-data-focus-visible:outline-focus"
          >
            <Priority priority={ticket.priority} isOverride={isOverride} />
          </span>
        </>
      ) : (
        <AriaButton
          ref={button}
          aria-label={label}
          className={`-mx-1 inline-flex h-6 min-w-6 cursor-default items-center rounded px-1 align-middle data-hovered:bg-neutral-soft aria-expanded:bg-neutral-soft ${FOCUS_RING}`}
        >
          <span aria-hidden className="contents">
            <Priority
              priority={ticket.priority}
              isOverride={isOverride}
              absentName={absentName}
            />
          </span>
        </AriaButton>
      )}
      <InfoPopover
        width="narrow"
        triggerRef={placement === "cell" ? cellBox : button}
      >
        <Explanation ticket={ticket} isOverride={isOverride} />
      </InfoPopover>
    </DialogTrigger>
  );
}
