import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleQuestionMark,
  ClockAlert,
  type LucideIcon,
} from "lucide-react";
import { Fragment } from "react";
import { Button as AriaButton, DialogTrigger } from "react-aria-components";
import type { MilestoneStatusValue, TrackDetail } from "../api/generated/model";
import { DateTime } from "./date-time";
import { dueState } from "./deadline-badge";
import { FOCUS_RING } from "./focus-ring";
import { InfoPopover, PopoverLine, PopoverTitle } from "./info-popover";

// The milestones of a track (docs/design-system.md, Track Milestones;
// Sentinel docs/features/tickets/ticket-deadlines.md, Actors and Phases;
// Track Milestones).

type Phase = "triage" | "submission" | "um" | "qa";

// The phases of a track in their order, each with its actor and its due
// date.
const PHASES: readonly {
  phase: Phase;
  name: string;
  actor: string;
  due: "triage_due_at" | "submission_due_at" | "um_due_at" | "qa_due_at";
}[] = [
  {
    phase: "triage",
    name: "Triage",
    actor: "Vulnerability analyst",
    due: "triage_due_at",
  },
  {
    phase: "submission",
    name: "Submission",
    actor: "Maintainer",
    due: "submission_due_at",
  },
  {
    phase: "um",
    name: "UM",
    actor: "Maintenance update team",
    due: "um_due_at",
  },
  { phase: "qa", name: "QA", actor: "QA", due: "qa_due_at" },
];

// The fields of a track that its milestones show. A milestone status and the
// current phase take every string: a later Sentinel release can return a
// value that the pinned contract does not list (Sentinel docs/api-spec.md,
// Response Enums).
export type MilestoneTrack = Pick<
  TrackDetail,
  "triage_due_at" | "submission_due_at" | "um_due_at" | "qa_due_at"
> & {
  milestones: Record<Phase, string | null>;
  current_phase: string | null;
};

interface KnownStatus {
  icon: LucideIcon;
  // The class of the color of its icon.
  color: string;
  // The state of the phase in words, when it does not count the days.
  words?: string;
}

// The statuses that the pinned contract lists, by their value, and null, a
// phase that Sentinel does not observe for a track with due dates. A Map,
// so that a value that a later Sentinel release returns is looked up only
// among them, never among the members of an object's prototype
// (docs/conventions.md, Data Read from the API).
const STATUSES = new Map<string, KnownStatus>(
  Object.entries({
    done: { icon: CircleCheck, color: "text-success-icon", words: "done" },
    overdue: { icon: ClockAlert, color: "text-danger-icon" },
    pending: { icon: Circle, color: "text-neutral-icon" },
    not_applicable: {
      icon: CircleMinus,
      color: "text-neutral-icon",
      words: "not applicable",
    },
  } satisfies Record<MilestoneStatusValue, KnownStatus>),
);
const NOT_OBSERVED: KnownStatus = {
  icon: CircleDashed,
  color: "text-neutral-icon",
  words: "not observed",
};
const UNLISTED: Omit<KnownStatus, "words"> = {
  icon: CircleQuestionMark,
  color: "text-neutral-icon",
};

interface PhaseView {
  name: string;
  actor: string;
  status: string | null;
  icon: LucideIcon;
  color: string;
  // The state in words, such as "done" or "overdue by 2 days".
  words: string;
  due: string | null;
  current: boolean;
}

// The phases of the track as its milestones show them at the instant now,
// in milliseconds since the epoch: a pending or overdue phase states the
// days of the badge in words, as docs/behaviors.md (Deadlines) words them,
// and a status that the pinned contract does not list shows as received
// (docs/behaviors.md, Unknown Values).
function phasesOf(track: MilestoneTrack, now: number): PhaseView[] {
  return PHASES.map(({ phase, name, actor, due }) => {
    const status = track.milestones[phase];
    const known = status === null ? NOT_OBSERVED : STATUSES.get(status);
    const dueAt = track[due];
    let words = known?.words ?? status ?? "";
    if (status === "pending" || status === "overdue") {
      words = dueState(dueAt, now)?.words ?? status;
    }
    return {
      name,
      actor,
      status,
      icon: (known ?? UNLISTED).icon,
      color: (known ?? UNLISTED).color,
      words,
      due: dueAt,
      current: track.current_phase === phase,
    };
  });
}

// A text with its first letter in upper case, as it starts a line.
function capitalized(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

interface PhasesProps {
  phases: readonly PhaseView[];
}

// Phases: its title, a border line, and a line for each phase, 10 px apart:
// the icon of its status, then, 8 px later, the name of the phase, at weight
// 600 for the current one, with " · " and its actor in fg-muted, and below
// it, in text-13, its state, in danger-on-soft at weight 500 when it is
// overdue and in fg-muted otherwise, followed, for a phase with a due date, by
// " · due " and its date and time (docs/behaviors.md, Dates and Times,
// Display). The icon starts the line, so the state takes no icon of its own.
function Phases({ phases }: PhasesProps) {
  return (
    <>
      <PopoverTitle>Phases</PopoverTitle>
      <PopoverLine />
      <ul className="flex flex-col gap-2.5">
        {phases.map((phase) => {
          const Icon = phase.icon;
          return (
            <li key={phase.name} className="flex gap-2">
              <Icon
                aria-hidden
                className={`mt-0.5 size-4 shrink-0 ${phase.color}`}
              />
              <div className="min-w-0">
                <p>
                  <span className={phase.current ? "font-semibold" : ""}>
                    {phase.name}
                  </span>
                  <span className="text-fg-muted"> · {phase.actor}</span>
                </p>
                <p className="text-13">
                  <span
                    className={
                      phase.status === "overdue"
                        ? "font-medium text-danger-on-soft"
                        : "text-fg-muted"
                    }
                  >
                    {capitalized(phase.words)}
                  </span>
                  {phase.due !== null && (
                    <span className="text-fg-muted">
                      {" · due "}
                      <DateTime value={phase.due} />
                    </span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

interface TrackMilestonesProps {
  track: MilestoneTrack;
  // What the milestones belong to, as their name states it, such as
  // "fictional-openssl, SUSE:FLES-15-SP7:Update".
  subject: string;
  // The instant with which the states compare the due dates, in milliseconds
  // since the epoch, the same as that of the badges of the screen.
  now: number;
}

// The milestones of a track as a pipeline, its four phases in their order:
// the icon of the status of each phase at 16 px, centered in a round box of
// 22 px, the boxes joined by lines of 1 px in border-strong, 6 px long; the
// box of the current phase in the soft background of its tone, danger-soft
// when it is overdue and info-soft otherwise, where its circle is in
// info-icon. The pipeline is one button, at least 24 px high, with 4 px of
// side padding and a 4 px radius, on neutral-soft under the pointer and while
// its popover is open, with the focus ring around it. Its icons and lines are
// hidden from assistive technologies, and its accessible name states the
// subject and the state of each phase, such as "Phases of fictional-openssl,
// SUSE:FLES-15-SP7:Update: Triage done; Submission overdue by 2 days,
// current; UM due in 3 days; QA due in 10 days". A click, a tap, Enter, or
// Space opens Phases, 320 px wide (InfoPopover).
export function TrackMilestones({ track, subject, now }: TrackMilestonesProps) {
  const phases = phasesOf(track, now);
  const states = phases
    .map(
      (phase) =>
        `${phase.name} ${phase.words}${phase.current ? ", current" : ""}`,
    )
    .join("; ");
  return (
    <DialogTrigger>
      <AriaButton
        aria-label={`Phases of ${subject}: ${states}`}
        className={`inline-flex h-6 shrink-0 cursor-default items-center rounded px-1 data-hovered:bg-neutral-soft aria-expanded:bg-neutral-soft ${FOCUS_RING}`}
      >
        <span aria-hidden className="flex items-center">
          {phases.map((phase, index) => {
            const Icon = phase.icon;
            let box = "";
            let color = phase.color;
            if (phase.current) {
              box =
                phase.status === "overdue" ? "bg-danger-soft" : "bg-info-soft";
              color =
                phase.status === "overdue"
                  ? "text-danger-icon"
                  : "text-info-icon";
            }
            return (
              <Fragment key={phase.name}>
                {index > 0 && <span className="h-px w-1.5 bg-border-strong" />}
                <span
                  className={`flex size-5.5 items-center justify-center rounded-full ${box}`}
                >
                  <Icon className={`size-4 ${color}`} />
                </span>
              </Fragment>
            );
          })}
        </span>
      </AriaButton>
      <InfoPopover width="wide">
        <Phases phases={phases} />
      </InfoPopover>
    </DialogTrigger>
  );
}
