import { expect, test } from "vitest";
import { PHASE_NAMES, PHASES } from "./phases";

// The phases of the remediation of a Ticket and of its tracks (Sentinel
// docs/features/tickets/ticket-deadlines.md, Actors and Phases; Due Dates;
// docs/behaviors.md, Deadlines).

test("lists the phases in their order, each with its name and the field of its due date", () => {
  expect(PHASES).toEqual([
    { phase: "triage", name: "Triage", due: "triage_due_at" },
    { phase: "submission", name: "Submission", due: "submission_due_at" },
    { phase: "um", name: "UM", due: "um_due_at" },
    { phase: "qa", name: "QA", due: "qa_due_at" },
  ]);
});

test("names each phase as the list names it", () => {
  expect(PHASE_NAMES).toEqual({
    triage: "Triage",
    submission: "Submission",
    um: "UM",
    qa: "QA",
  });
});
