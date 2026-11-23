import type { CurrentPhaseValue } from "../api/generated/model";

// The phases of the remediation of a Ticket and of its tracks that Sentinel
// observes, in their order, each with its name and the field of its due
// date (Sentinel docs/features/tickets/ticket-deadlines.md, Actors and
// Phases; Due Dates; docs/behaviors.md, Deadlines), which the deadline
// badge, the track milestones, and the screens of Tickets share.

// A phase, as the contract names it: triage, submission, um, or qa.
export type Phase = Exclude<CurrentPhaseValue, "done">;

// The field of the due date of a phase, in a Ticket and in a track.
export type DueField =
  "triage_due_at" | "submission_due_at" | "um_due_at" | "qa_due_at";

// The name of each phase.
export const PHASE_NAMES = {
  triage: "Triage",
  submission: "Submission",
  um: "UM",
  qa: "QA",
} satisfies Record<Phase, string>;

export interface RemediationPhase {
  phase: Phase;
  name: string;
  due: DueField;
}

// The phases, in their order.
export const PHASES: readonly RemediationPhase[] = [
  { phase: "triage", name: PHASE_NAMES.triage, due: "triage_due_at" },
  {
    phase: "submission",
    name: PHASE_NAMES.submission,
    due: "submission_due_at",
  },
  { phase: "um", name: PHASE_NAMES.um, due: "um_due_at" },
  { phase: "qa", name: PHASE_NAMES.qa, due: "qa_due_at" },
];
