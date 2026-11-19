import { useQueryClient } from "@tanstack/react-query";
import { useCallback, type ReactNode } from "react";
import {
  getGetCveCvssAssessmentsQueryKey,
  getGetCveSourceStatusQueryKey,
} from "../../api/generated/cves";
import { getGetTicketPackageWorkQueryKey } from "../../api/generated/maintainer-operations";
import { CVSSVersionValue } from "../../api/generated/model";
import type { CurrentPhaseValue } from "../../api/generated/model";
import {
  getListTicketActorsQueryKey,
  getListTicketEventsQueryKey,
} from "../../api/generated/ticket-audit-log";
import {
  getGetTicketQueryKey,
  getListTicketAccessGrantsQueryKey,
  getListTicketsQueryKey,
} from "../../api/generated/tickets";
import { AbsentValue } from "../../components/absent-value";
import { DateTime } from "../../components/date-time";

// What several parts of Overview (src/routes/ticket-overview.tsx) share: the
// anchors of the parts, the formats of a count and of a score, the phases of
// the remediation of a Ticket, the fields of a line, and the reads after a
// change.

// The anchors of the parts that the tab shows, the same on every Ticket,
// although a Ticket without a CVE lacks its CVSS assessments and its
// sources.
export const CVE_ANCHOR = "cve";
export const PACKAGES_ANCHOR = "packages";
export const CVSS_ANCHOR = "cvss";
export const DETAILS_ANCHOR = "details";
export const SOURCES_ANCHOR = "sources";
export const PARTICIPANTS_ANCHOR = "participants";

// The largest page of List Tickets (Sentinel docs/api-spec.md, Pagination):
// the details show at most this many duplicates, and how many more there are.
const DUPLICATES_PAGE = 100;

// A count, its thousands grouped (docs/behaviors.md, Style).
export const COUNT = new Intl.NumberFormat("en-US");

// The phases of the remediation of a Ticket, in their order, with their due
// dates (Sentinel docs/features/tickets/ticket-deadlines.md, Actors and
// Phases; Due Dates).
type Phase = Exclude<CurrentPhaseValue, "done">;
export const PHASES: readonly { phase: Phase; name: string; due: DueField }[] =
  [
    { phase: "triage", name: "Triage", due: "triage_due_at" },
    { phase: "submission", name: "Submission", due: "submission_due_at" },
    { phase: "um", name: "UM", due: "um_due_at" },
    { phase: "qa", name: "QA", due: "qa_due_at" },
  ];

type DueField =
  | "triage_due_at"
  | "submission_due_at"
  | "um_due_at"
  | "qa_due_at"
  | "release_due_at";

// The parameters of the read of the duplicates of a Ticket: the visible
// Tickets whose original it is, the oldest first, at most a page of them
// (Sentinel docs/features/tickets/tickets.md, List Tickets, Duplicate filter).
export function duplicatesOf(ticketId: string) {
  return {
    duplicate_of_ticket_id: ticketId,
    sort_by: "ticket_id",
    sort_order: "asc",
    per_page: DUPLICATES_PAGE,
  } as const;
}

// Reads again what an assignment or an edit of the package tree affects: the
// Ticket, whose status, assignee, and package tree it can change, the work of
// a maintainer on it, the users who acted on it, its audit log, and the reads
// of the Ticket list, but for the duplicates of the Ticket, whose
// identifiers, confidentiality, and number a change of their original does
// not change (docs/behaviors.md, Outcome of a Change).
export function useReadAfterTicketChange(ticketId: string) {
  const client = useQueryClient();
  return useCallback(() => {
    for (const queryKey of [
      getGetTicketQueryKey(ticketId),
      getGetTicketPackageWorkQueryKey(ticketId),
      getListTicketActorsQueryKey(ticketId),
      getListTicketEventsQueryKey(ticketId),
    ]) {
      void client.invalidateQueries({ queryKey });
    }
    const duplicates = JSON.stringify(
      getListTicketsQueryKey(duplicatesOf(ticketId)),
    );
    void client.invalidateQueries({
      queryKey: getListTicketsQueryKey(),
      predicate: (query) => JSON.stringify(query.queryKey) !== duplicates,
    });
  }, [client, ticketId]);
}

interface InlineFieldProps {
  term: string;
  children: ReactNode;
}

// A field whose term, in fg-muted, starts its line, 6 px before its value.
export function InlineField({ term, children }: InlineFieldProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5">
      <dt className="text-fg-muted">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

// A date and time of the API, or an absent value.
export function MaybeDateTime({ value }: { value: string | null }) {
  return value === null ? <AbsentValue /> : <DateTime value={value} />;
}

// The CVSS versions that the pinned contract lists. A Set, so that a version
// that a later Sentinel release returns is looked up only among them
// (docs/conventions.md, Data Read from the API).
export const CVSS_VERSIONS = new Set<string>(Object.values(CVSSVersionValue));

// A CVSS version with a "v", such as "v3.1", so that it is not read as a
// score; a version that the pinned contract does not list shows as received
// (docs/behaviors.md, Unknown Values).
export function cvssVersion(version: string): string {
  return CVSS_VERSIONS.has(version) ? `v${version}` : version;
}

// A CVSS score, from 0.0 to 10.0, with its one decimal, such as 10.0.
export const SCORE = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function Score({ value }: { value: number }) {
  return <span className="tabular-nums">{SCORE.format(value)}</span>;
}

// A value of a metric that the pinned contract lists in sentence case, such
// as adjacent_network as "Adjacent network".
export function valueInWords(value: string): string {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Reads again the data of the tab of a Ticket with a CVE, as when the tab
// returns to the foreground: the Ticket, its duplicates, the work of a
// maintainer on it, the CVSS assessments of its CVE, the users who acted on
// it, and its access grants, with the sources of its CVE where asked: the
// reads of the tab that the anchor of the URL waits for
// (src/routes/ticket-overview.tsx), and the Ticket, so that a read added to
// the tab is added to both. A read that the tab does not send, such as the
// duplicates of a duplicate or the access grants of a Ticket that is not
// confidential, is not sent.
export function useReadAgain(ticketId: string, cveId: string) {
  const client = useQueryClient();
  return useCallback(
    (withSources: boolean) => {
      const keys: (readonly unknown[])[] = [
        getGetTicketQueryKey(ticketId),
        getListTicketsQueryKey(duplicatesOf(ticketId)),
        getGetTicketPackageWorkQueryKey(ticketId),
        getGetCveCvssAssessmentsQueryKey(cveId),
        getListTicketActorsQueryKey(ticketId),
        getListTicketAccessGrantsQueryKey(ticketId),
      ];
      if (withSources) {
        keys.push(getGetCveSourceStatusQueryKey(cveId));
      }
      for (const queryKey of keys) {
        void client.invalidateQueries({ queryKey });
      }
    },
    [client, ticketId, cveId],
  );
}

export type ReadAgain = ReturnType<typeof useReadAgain>;
