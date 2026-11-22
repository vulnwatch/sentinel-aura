import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  ReferenceTypeValue,
  type TicketReferenceResponse,
} from "../../api/generated/model";
import {
  getListTicketActorsQueryKey,
  getListTicketEventsQueryKey,
} from "../../api/generated/ticket-audit-log";
import { getListReferencesQueryKey } from "../../api/generated/ticket-references";
import { getGetTicketQueryKey } from "../../api/generated/tickets";
import { addressText } from "../../components/web-link";

// What the tab References (src/routes/ticket-references.tsx) and its dialogs
// share: the count format, the names of the types of a reference, the name
// of a reference and of its actions, and the reads after a change of the
// references.

// A count, its thousands grouped (docs/behaviors.md, Style).
export const COUNT = new Intl.NumberFormat("en-US");

// The names of the types of a reference (Sentinel
// docs/features/tickets/ticket-references.md, ReferenceType). A Map, so that a
// type that a later Sentinel release returns is looked up only among them
// (docs/conventions.md, Data Read from the API).
const TYPE_NAMES = new Map<string, string>(
  Object.entries({
    advisory: "Advisory",
    patch: "Patch",
    issue: "Issue",
    article: "Article",
  } satisfies Record<ReferenceTypeValue, string>),
);

// The type of a reference by its name, Uncategorized without one, or as
// received when the pinned contract does not list it (docs/behaviors.md,
// Unknown Values).
export function typeName(type: string | null): string {
  return type === null ? "Uncategorized" : (TYPE_NAMES.get(type) ?? type);
}

// What names a reference in the actions on it and in their outcome: its
// title in quotation marks, as the audit log quotes it, or without one its
// address, which it does not (docs/screens/ticket.md, Audit log).
export function referenceName(reference: TicketReferenceResponse): string {
  return reference.title === null
    ? addressText(reference.url)
    : `“${reference.title}”`;
}

// The names of Edit and Delete, before the name of their reference, by which
// the tab also finds them again in their row.
export const EDIT = "Edit reference";
export const DELETE = "Delete reference";

// What a change of the references of a Ticket affects, which the screen
// reads again whatever its outcome (useChangeOutcome): the references, the
// audit log, the users who acted on the Ticket, and the Ticket
// (docs/behaviors.md, Outcome of a Change).
export function useReadAgain(ticketId: string) {
  const client = useQueryClient();
  return useCallback(() => {
    for (const queryKey of [
      getListReferencesQueryKey(ticketId),
      getListTicketEventsQueryKey(ticketId),
      getListTicketActorsQueryKey(ticketId),
      getGetTicketQueryKey(ticketId),
    ]) {
      void client.invalidateQueries({ queryKey });
    }
  }, [client, ticketId]);
}
