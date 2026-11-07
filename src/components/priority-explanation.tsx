import { useId, useLayoutEffect, useRef } from "react";
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Heading,
  Popover,
} from "react-aria-components";
import type {
  EPSSPercentilePriorityEvidence,
  ExploitationLevel,
  KEVPriorityEvidence,
  PriorityEvidence,
  SSVCExploitationEvidenceValue,
  SSVCExploitationPriorityEvidence,
} from "../api/generated/model";
import { formatDate } from "./date-time";
import { FOCUS_RING } from "./focus-ring";
import { Priority, priorityName } from "./priority";
import { focusScreenHeading } from "./screen-heading";
import { Severity } from "./severity";

// The explanation of the priority of a Ticket (docs/design-system.md,
// Priority, Explanation): whether the effective priority is automatic or an
// override, and what the automatic priority is based on.

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
// return another.
export interface PriorityFields {
  priority: string | null;
  priority_automatic: string | null;
  priority_override: string | null;
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

// The content of the explanation: its title, which names it, a border line
// 12 px below it and 12 px above the sections, then the section of the basis
// and the section of the evidence, 12 px apart, each with its heading in
// text-12, weight 500, fg-muted, and its lines 4 px apart.
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
      <hr className="my-3 border-border" />
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
    </>
  );
}

interface ExplainedPriorityProps {
  ticket: PriorityFields;
}

// The priority of a Ticket in a cell of a table, whose whole cell is the
// button of its explanation: the button fills the cell, the nearest
// positioned element around it, so that the cell holds no smaller target
// beside it once the focus is in it, and is named by the priority, as the
// level followed by ", override" for an override. In the cell, the priority,
// with the icon of an override, shows in a box 24 px high and at least 24 px
// wide, with 4 px of side padding that keeps the level where the priority
// shows without a button, and a 4 px radius, on neutral-soft under the
// pointer and while the popover is open, with the focus ring around it. A
// click, a tap, Enter, or Space opens the explanation in a popover 288 px
// wide, with 16 px of padding, in text-14, below the box and aligned to its
// start, or above it where the window has no room below, moved toward the
// start where it would pass the end of the window, and scrolling within it in
// a window shorter than it is. The explanation holds no control and takes the
// focus itself, with the focus ring around its content on keyboard focus,
// named by its title; while it is open, the rest of the page is
// out of reach. Escape or a click outside closes it, and the focus returns to
// the priority.
export function ExplainedPriority({ ticket }: ExplainedPriorityProps) {
  const dialogId = useId();
  const box = useRef<HTMLSpanElement>(null);
  // When the priority leaves the page while its explanation holds the focus,
  // such as a row that a read of the list removes, the focus moves to the
  // screen's heading (docs/behaviors.md, Accessibility, Focus after an
  // action). The explanation shows outside the content around the priority,
  // which hands off only the focus that it holds itself (FocusHandOff).
  // Closing the explanation leaves the priority, to which the focus returns.
  useLayoutEffect(
    () => () => {
      if (document.getElementById(dialogId)?.contains(document.activeElement)) {
        queueMicrotask(focusScreenHeading);
      }
    },
    [dialogId],
  );
  const isOverride = ticket.priority_override !== null;
  const name = priorityName(ticket.priority);
  return (
    <DialogTrigger>
      {/* Before the box, whose look follows its state (peer). It extends a
          pixel beyond the cell, whose bounds include half of its border
          line, so that the cell is covered whole. */}
      <AriaButton
        aria-label={isOverride ? `${name}, override` : name}
        className="peer absolute -inset-px cursor-default outline-none"
      />
      <span
        ref={box}
        aria-hidden
        className="-mx-1 inline-flex h-6 min-w-6 items-center rounded px-1 align-middle peer-data-hovered:bg-neutral-soft peer-aria-expanded:bg-neutral-soft peer-data-focus-visible:outline-2 peer-data-focus-visible:outline-offset-2 peer-data-focus-visible:outline-focus"
      >
        <Priority priority={ticket.priority} isOverride={isOverride} />
      </span>
      <Popover
        triggerRef={box}
        placement="bottom start"
        offset={4}
        className="w-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-border bg-surface p-4 text-14 text-fg shadow-lg outline-none"
      >
        <Dialog id={dialogId} className={FOCUS_RING}>
          <Explanation ticket={ticket} isOverride={isOverride} />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
