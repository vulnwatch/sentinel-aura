import type { ReferenceTypeValue } from "../api/generated/model";

// The types of a reference of a Ticket by their names (docs/behaviors.md,
// Domain Terms; Sentinel docs/features/tickets/ticket-references.md,
// ReferenceType), which the tab References and the audit log of a Ticket
// share. A Map, so that a type that a later Sentinel release returns is
// looked up only among them (docs/conventions.md, Data Read from the API),
// and every type of the pinned contract has its name.
const REFERENCE_TYPES = new Map<string, string>(
  Object.entries({
    advisory: "Advisory",
    patch: "Patch",
    issue: "Issue",
    article: "Article",
  } satisfies Record<ReferenceTypeValue, string>),
);

// The name of the type of a reference; Uncategorized without one, which
// Sentinel records as null, the absence of a type rather than another type
// (Sentinel docs/features/tickets/ticket-references.md, ReferenceType); or
// the type as received when the pinned contract does not list it
// (docs/behaviors.md, Unknown Values).
export function referenceTypeName(type: string | null): string {
  return type === null ? "Uncategorized" : (REFERENCE_TYPES.get(type) ?? type);
}
