import { useQueryClient } from "@tanstack/react-query";
import {
  createRoute,
  linkOptions,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { ClockAlert, RefreshCw, UserPen } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";
import { isRequestFailure, presentRefetchFailure } from "../api/errors";
import {
  getGetCveCvssAssessmentsQueryKey,
  getGetCveSourceStatusQueryKey,
  useGetCveCvssAssessments,
  useGetCveSourceStatus,
  useRefetchCve,
} from "../api/generated/cves";
import {
  getGetTicketPackageWorkQueryKey,
  useGetTicketPackageWork,
} from "../api/generated/maintainer-operations";
import { CVSSVersionValue, EligibilitySource } from "../api/generated/model";
import type {
  CVECVSSAssessments,
  CVEDetail,
  CVEEPSSResponse,
  CVERefetchResult,
  CVESourceDerivedStatusValue,
  CVESourceStatusItem,
  CVESSVCResponse,
  CVSSAssessmentItem,
  CurrentPhaseValue,
  DeliveryStatusValue,
  LifecyclePhaseValue,
  PackageDetail,
  PackageStatusValue,
  ProductDetail,
  ProductReasonValue,
  SSVCAutomatable,
  SSVCExploitation,
  SSVCTechnicalImpact,
  TicketDetail,
  TrackDetail,
} from "../api/generated/model";
import {
  getGetTicketQueryKey,
  getListTicketsQueryKey,
  useListTickets,
} from "../api/generated/tickets";
import { AbsentValue } from "../components/absent-value";
import { Button } from "../components/button";
import { ClampedText } from "../components/clamped-text";
import { ConfidentialMark } from "../components/confidential-mark";
import { FramedTable, type TableColumn } from "../components/data-table";
import { CalendarDate, DateTime } from "../components/date-time";
import { dueState } from "../components/deadline-badge";
import {
  DescriptionGroup,
  DescriptionItem,
  DescriptionList,
  GroupedItem,
} from "../components/description-list";
import {
  DetailColumns,
  Part,
  showAnchorTarget,
  SideSection,
} from "../components/detail-screen";
import { DetailsName } from "../components/details-popover";
import { IconButton } from "../components/icon-button";
import { Label } from "../components/label";
import { Link } from "../components/link";
import { Maintainers } from "../components/maintainers";
import { MarkedValue, type MarkedName } from "../components/marked-value";
import { UpdatingBar } from "../components/loading";
import { useShowMessage, type MessageRecord } from "../components/message-area";
import type { MessageTone } from "../components/message";
import {
  dataShown,
  marksPlace,
  PartRead,
  type Read,
} from "../components/read-view";
import {
  FocusHandOff,
  useFocusHeadingOnRemoval,
} from "../components/screen-heading";
import { Severity } from "../components/severity";
import { Switch } from "../components/switch";
import { TrackMilestones } from "../components/track-milestones";
import { User } from "../components/user";
import { WebLink } from "../components/web-link";
import { sameSearch } from "../search-params";
import { useSignedInUser } from "../session-gate";
import { ticketRoute, useShownTicket } from "./ticket";

// Overview, the first tab of the Ticket screen (docs/screens/ticket.md): the
// CVE, the package tree, and the CVSS assessments of the Ticket in the main
// column, and its details and the sources of its CVE in the side column, in
// two columns where the main content is wide enough, and otherwise in one,
// the details first and the sources last (docs/design-system.md, Detail
// Screens).

// The anchors of the parts that the tab shows, the same on every Ticket,
// although a Ticket without a CVE lacks its CVSS assessments and its
// sources.
const CVE_ANCHOR = "cve";
const PACKAGES_ANCHOR = "packages";
const CVSS_ANCHOR = "cvss";
const DETAILS_ANCHOR = "details";
const SOURCES_ANCHOR = "sources";

// The public CVE page of SUSE, a composed address of another site, with its
// fixed origin, which holds the CVE ID encoded in a path segment
// (docs/behaviors.md, Links to Other Sites, Composed addresses).
function suseCvePage(cveId: string): string {
  return `https://www.suse.com/security/cve/${encodeURIComponent(cveId)}.html`;
}

// The largest page of List Tickets (Sentinel docs/api-spec.md, Pagination):
// the details show at most this many duplicates, and how many more there are.
const DUPLICATES_PAGE = 100;

// A count, its thousands grouped (docs/behaviors.md, Style).
const COUNT = new Intl.NumberFormat("en-US");

// ----------------------------------------------------------------------------
// Details

// The phases of the remediation of a Ticket, in their order, with their due
// dates (Sentinel docs/features/tickets/ticket-deadlines.md, Actors and
// Phases; Due Dates).
type Phase = Exclude<CurrentPhaseValue, "done">;
const PHASES: readonly { phase: Phase; name: string; due: DueField }[] = [
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

// How a phase of the deadlines shows: in fg-muted before the current phase,
// which no track holds open any more; at weight 600, with its state, as the
// current phase; plain after it.
type PhaseLook = "over" | "current" | "ahead";

// The look of each phase for the current phase of the Ticket: every phase is
// over once the current phase is done; Triage is over when it is null with
// due dates, as on an Analyzed Ticket without a CVE, and the other phases are
// ahead; a current phase that the pinned contract does not list marks none.
function looksOf(currentPhase: string | null): PhaseLook[] {
  if (currentPhase === "done") {
    return PHASES.map(() => "over");
  }
  if (currentPhase === null) {
    return PHASES.map((_, index) => (index === 0 ? "over" : "ahead"));
  }
  const current = PHASES.findIndex(({ phase }) => phase === currentPhase);
  if (current === -1) {
    return PHASES.map(() => "ahead");
  }
  return PHASES.map((_, index) => {
    if (index < current) {
      return "over";
    }
    return index === current ? "current" : "ahead";
  });
}

const LOOKS: Record<PhaseLook, string> = {
  over: "text-fg-muted",
  current: "font-semibold text-fg",
  ahead: "text-fg",
};

interface PhaseStateProps {
  ticket: TicketDetail;
  due: string | null;
  now: number;
}

// The state of the current phase, below its date, in text-13: the days of the
// badge in words, as the milestone of the current phase states it, such as
// "Due in 3 days" in fg-muted, or "Overdue by 2 days" in danger-on-soft at
// weight 500 after clock-alert at 14 px in danger-icon; a state that the
// pinned contract does not list shows as received (docs/behaviors.md,
// Deadlines). The days compare the date with the same instant as the badge.
function PhaseState({ ticket, due, now }: PhaseStateProps) {
  const milestone = ticket.current_phase_milestone;
  const state = dueState(due, now);
  if (milestone === null || state === undefined) {
    return null;
  }
  if (milestone !== "pending" && milestone !== "overdue") {
    return (
      <span className="block text-13 font-normal text-fg-muted">
        {milestone}
      </span>
    );
  }
  const words = `${state.words.charAt(0).toUpperCase()}${state.words.slice(1)}`;
  if (state.tone === "danger") {
    return (
      <span className="flex items-center gap-1 text-13 font-medium text-danger-on-soft">
        <ClockAlert
          aria-hidden
          className="size-3.5 shrink-0 text-danger-icon"
        />
        {words}
      </span>
    );
  }
  return (
    <span className="block text-13 font-normal text-fg-muted">{words}</span>
  );
}

interface DeadlinesProps {
  ticket: TicketDetail;
  now: number;
}

// The deadlines of the Ticket as one group, a line per phase with its exact
// due date (docs/behaviors.md, Dates and Times, Display). Sentinel returns a
// state only for the current phase, so the other phases show their date
// alone, and it does not report a phase completed late, so neither does the
// screen (Sentinel docs/features/tickets/ticket-deadlines.md, Ticket Current
// Phase; Accepted Limitation). QA is due at the final release deadline, so
// its line says so while the two are equal; otherwise the final release
// deadline has a line of its own. Without due dates no SLA applies, and the
// group shows an absent value (same document, Null Due Dates).
function Deadlines({ ticket, now }: DeadlinesProps) {
  if (PHASES.every(({ due }) => ticket[due] === null)) {
    return (
      <DescriptionItem term="Deadlines">
        <AbsentValue />
      </DescriptionItem>
    );
  }
  const looks = looksOf(ticket.current_phase);
  const releaseApart = ticket.release_due_at !== ticket.qa_due_at;
  return (
    <DescriptionGroup term="Deadlines">
      {PHASES.map(({ phase, name, due }, index) => {
        const look = looks[index] ?? "ahead";
        const value = ticket[due];
        return (
          <GroupedItem
            key={phase}
            term={phase === "qa" && !releaseApart ? "QA, release" : name}
            tone={LOOKS[look]}
          >
            {value === null ? <AbsentValue /> : <DateTime value={value} />}
            {look === "current" && (
              <PhaseState ticket={ticket} due={value} now={now} />
            )}
          </GroupedItem>
        );
      })}
      {releaseApart && (
        <GroupedItem term="Release" tone={LOOKS.ahead}>
          {ticket.release_due_at === null ? (
            <AbsentValue />
          ) : (
            <DateTime value={ticket.release_due_at} />
          )}
        </GroupedItem>
      )}
    </DescriptionGroup>
  );
}

// A link to the screen of another Ticket.
function TicketLink({ ticketId }: { ticketId: string }) {
  return (
    <Link
      placement="list"
      href={linkOptions({ to: "/tickets/$ticketId", params: { ticketId } })}
    >
      {ticketId}
    </Link>
  );
}

// The parameters of the read of the duplicates of a Ticket: the visible
// Tickets whose original it is, the oldest first, at most a page of them
// (Sentinel docs/features/tickets/tickets.md, List Tickets, Duplicate filter).
function duplicatesOf(ticketId: string) {
  return {
    duplicate_of_ticket_id: ticketId,
    sort_by: "ticket_id",
    sort_order: "asc",
    per_page: DUPLICATES_PAGE,
  } as const;
}

// The read of the duplicates of a Ticket that is not a duplicate itself. A
// duplicate has none, since an original is never Duplicated (same document,
// Duplicate Handling, Invariant), so its read is not sent.
function useDuplicates(ticket: TicketDetail) {
  return useListTickets(duplicatesOf(ticket.ticket_id), {
    query: { enabled: ticket.duplicate_of_ticket_id === null },
  });
}

type DuplicatesRead = ReturnType<typeof useDuplicates>;

interface DuplicatesProps {
  read: DuplicatesRead;
}

// The duplicates of the Ticket, each a link to its screen, followed by the
// lock of a confidential one, then, beyond a page, how many more there are,
// without a link; "None" without any. Their read loads and fails in place of
// the value (docs/behaviors.md, Where Errors Appear).
function Duplicates({ read }: DuplicatesProps) {
  return (
    <PartRead read={read} inValue>
      {(page) =>
        page.data.length === 0 ? (
          <AbsentValue name="None" />
        ) : (
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {page.data.map((duplicate) => (
              <li key={duplicate.ticket_id}>
                <TicketLink ticketId={duplicate.ticket_id} />
                {duplicate.is_confidential && <ConfidentialMark />}
              </li>
            ))}
            {page.meta.total > page.data.length && (
              <li className="text-fg-muted">
                and {COUNT.format(page.meta.total - page.data.length)} more
              </li>
            )}
          </ul>
        )
      }
    </PartRead>
  );
}

interface DetailsProps {
  ticket: TicketDetail;
  now: number;
  duplicates: DuplicatesRead;
}

// The details of the Ticket, read-only, as a description list
// (docs/design-system.md, Detail Screens): the assignee in the full form, or
// "Unassigned"; the Coordinated Release Date while the Ticket is
// confidential, as an absent value without a date, and while it has one,
// also after it became non-confidential (Sentinel
// docs/features/tickets/tickets.md, Coordinated Release Date); the
// deadlines; the original of a duplicate, which is only an identifier, or the
// duplicates of any other Ticket; the creation; and the last change, as
// "Last modified", as the Ticket list names it. Users show without a link
// and a card while the UI has no screen User (docs/behaviors.md, Open
// Decisions).
function Details({ ticket, now, duplicates }: DetailsProps) {
  return (
    <SideSection id={DETAILS_ANCHOR} heading="Details">
      <DescriptionList>
        <DescriptionItem term="Assignee">
          {ticket.assignee === null ? (
            <AbsentValue name="Unassigned" />
          ) : (
            <User user={ticket.assignee} />
          )}
        </DescriptionItem>
        {(ticket.is_confidential || ticket.coordinated_release_at !== null) && (
          <DescriptionItem term="Coordinated Release Date">
            {ticket.coordinated_release_at === null ? (
              <AbsentValue />
            ) : (
              <DateTime value={ticket.coordinated_release_at} />
            )}
          </DescriptionItem>
        )}
        <Deadlines ticket={ticket} now={now} />
        {ticket.duplicate_of_ticket_id === null ? (
          <DescriptionItem term="Duplicates">
            <Duplicates read={duplicates} />
          </DescriptionItem>
        ) : (
          <DescriptionItem term="Original">
            <TicketLink ticketId={ticket.duplicate_of_ticket_id} />
          </DescriptionItem>
        )}
        <DescriptionItem term="Created">
          <DateTime value={ticket.created_at} />
        </DescriptionItem>
        <DescriptionItem term="Last modified">
          <DateTime value={ticket.updated_at} />
        </DescriptionItem>
      </DescriptionList>
    </SideSection>
  );
}

// ----------------------------------------------------------------------------
// CVE

interface InlineFieldProps {
  term: string;
  children: ReactNode;
}

// A field whose term, in fg-muted, starts its line, 6 px before its value.
function InlineField({ term, children }: InlineFieldProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5">
      <dt className="text-fg-muted">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

// A date and time of the API, or an absent value.
function MaybeDateTime({ value }: { value: string | null }) {
  return value === null ? <AbsentValue /> : <DateTime value={value} />;
}

// The values of the SSVC decision points that the pinned contract lists, as
// CISA SSVC names them; a value that it does not list shows as received
// (docs/behaviors.md, Unknown Values). Maps, so that such a value is looked up
// only among them, never among the members of an object's prototype
// (docs/conventions.md, Data Read from the API).
const SSVC_EXPLOITATION = new Map<string, string>(
  Object.entries({
    none: "None",
    poc: "PoC",
    active: "Active",
  } satisfies Record<SSVCExploitation, string>),
);
const SSVC_AUTOMATABLE = new Map<string, string>(
  Object.entries({ no: "No", yes: "Yes" } satisfies Record<
    SSVCAutomatable,
    string
  >),
);
const SSVC_TECHNICAL_IMPACT = new Map<string, string>(
  Object.entries({
    partial: "Partial",
    total: "Total",
  } satisfies Record<SSVCTechnicalImpact, string>),
);

// An EPSS probability or percentile, from 0 to 1, cut to the five decimals
// that FIRST publishes, and with at least two, such as 0.94 or 0.00043, so
// that it never shows more than its value. Its text with ten decimals leaves
// out the error of its binary representation.
export function epssNumber(value: number): string {
  const text = value.toFixed(10);
  const point = text.indexOf(".");
  const cut = text.slice(0, point + 6).replace(/0+$/, "");
  const decimals = cut.length - point - 1;
  return decimals < 2 ? `${cut}${"0".repeat(2 - decimals)}` : cut;
}

interface SsvcProps {
  ssvc: CVESSVCResponse;
}

function Ssvc({ ssvc }: SsvcProps) {
  return (
    <dl className="flex flex-col gap-0.5">
      <InlineField term="Exploitation">
        {SSVC_EXPLOITATION.get(ssvc.exploitation) ?? ssvc.exploitation}
      </InlineField>
      <InlineField term="Automatable">
        {SSVC_AUTOMATABLE.get(ssvc.automatable) ?? ssvc.automatable}
      </InlineField>
      <InlineField term="Technical impact">
        {SSVC_TECHNICAL_IMPACT.get(ssvc.technical_impact) ??
          ssvc.technical_impact}
      </InlineField>
      <InlineField term="Version">{ssvc.version}</InlineField>
      <InlineField term="Assessed">
        <MaybeDateTime value={ssvc.assessed_at} />
      </InlineField>
    </dl>
  );
}

interface EpssProps {
  epss: CVEEPSSResponse;
}

function Epss({ epss }: EpssProps) {
  return (
    <dl className="flex flex-col gap-0.5">
      <InlineField term="Score">{epssNumber(epss.score)}</InlineField>
      <InlineField term="Percentile">{epssNumber(epss.percentile)}</InlineField>
      <InlineField term="Assessed">
        <CalendarDate value={epss.assessed_at} />
      </InlineField>
    </dl>
  );
}

interface ExploitationProps {
  cve: CVEDetail;
}

// The exploitation of the CVE, a box on surface with a border line and an
// 8 px radius, in three columns apart by border lines, which stand one below
// the other where the part is narrower than 576 px: CISA KEV, "Not listed"
// or the date on which the entry was added, never that the CVE is in KEV now;
// SSVC, with its decision points, version, and date and time; and EPSS, with
// its score, percentile, and date. Without SSVC or EPSS data, an absent
// value.
function Exploitation({ cve }: ExploitationProps) {
  const column = "px-4 py-3";
  const term = "text-13 text-fg-muted";
  return (
    <dl className="grid divide-y divide-border rounded-lg border border-border bg-surface text-14 @min-[36rem]:grid-cols-3 @min-[36rem]:divide-x @min-[36rem]:divide-y-0">
      <div className={column}>
        <dt className={term}>CISA KEV</dt>
        <dd className="mt-1">
          {cve.kev === null ? (
            "Not listed"
          ) : (
            <dl>
              <InlineField term="Added">
                <CalendarDate value={cve.kev.date_added} />
              </InlineField>
            </dl>
          )}
        </dd>
      </div>
      <div className={column}>
        <dt className={term}>SSVC</dt>
        <dd className="mt-1">
          {cve.ssvc === null ? <AbsentValue /> : <Ssvc ssvc={cve.ssvc} />}
        </dd>
      </div>
      <div className={column}>
        <dt className={term}>EPSS</dt>
        <dd className="mt-1">
          {cve.epss === null ? <AbsentValue /> : <Epss epss={cve.epss} />}
        </dd>
      </div>
    </dl>
  );
}

interface FactsProps {
  cve: CVEDetail;
}

// The dates and the identifiers of the CVE, on one line that wraps: when it
// was published and last modified, and when it was rejected, each with its
// time (docs/behaviors.md, Dates and Times, Display); its weaknesses; and its
// external identifiers, such as a GHSA identifier, as links to other sites.
function Facts({ cve }: FactsProps) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-14">
      <InlineField term="Published">
        <MaybeDateTime value={cve.published_date} />
      </InlineField>
      <InlineField term="Modified">
        <MaybeDateTime value={cve.modified_date} />
      </InlineField>
      {cve.cve_state === "rejected" && (
        <InlineField term="Rejected">
          <MaybeDateTime value={cve.date_rejected} />
        </InlineField>
      )}
      <InlineField term="CWE">
        {cve.cwes.length === 0 ? (
          <AbsentValue />
        ) : (
          cve.cwes.map((weakness) => weakness.cwe_id).join(", ")
        )}
      </InlineField>
      {cve.external_identifiers.length > 0 && (
        <InlineField term="External identifiers">
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {cve.external_identifiers.map((external) => (
              <li key={`${external.source}-${external.identifier}`}>
                <WebLink address={external.url}>{external.identifier}</WebLink>
              </li>
            ))}
          </ul>
        </InlineField>
      )}
    </dl>
  );
}

interface CvePartProps {
  cve: CVEDetail | null;
}

// The CVE of the Ticket, from Get Ticket, in its compact form: its CVE ID as
// the heading of the part, with the label Rejected while the CVE is rejected,
// or its state as received when the pinned contract does not list it, and
// next to it a link to the public CVE page of SUSE; its title and its
// description, which break a word longer than their place, the description
// cut to four lines with Show more; its dates and identifiers;
// and its exploitation. A Ticket without a CVE shows "No CVE." in its place.
function CvePart({ cve }: CvePartProps) {
  if (cve === null) {
    return (
      <Part id={CVE_ANCHOR} heading="CVE">
        <p className="text-fg-muted">No CVE.</p>
      </Part>
    );
  }
  let state: string | undefined;
  if (cve.cve_state === "rejected") {
    state = "Rejected";
  } else if (cve.cve_state !== "published") {
    state = cve.cve_state;
  }
  return (
    <Part
      id={CVE_ANCHOR}
      heading={
        // The label follows the CVE ID after a space, which assistive
        // technologies read between them, and 2 px more, 6 px in all.
        <>
          {cve.cve_id}
          {state !== undefined && (
            <>
              {" "}
              <span className="ms-0.5 align-[0.0625rem]">
                <Label>{state}</Label>
              </span>
            </>
          )}
        </>
      }
      besideHeading={
        <span className="text-14">
          <WebLink address={suseCvePage(cve.cve_id)}>SUSE CVE page</WebLink>
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          {cve.title !== null && (
            <p className="max-w-180 wrap-break-word">{cve.title}</p>
          )}
          {cve.description === null ? (
            <p className="text-fg-muted">No description.</p>
          ) : (
            <ClampedText>{cve.description}</ClampedText>
          )}
        </div>
        <Facts cve={cve} />
        <Exploitation cve={cve} />
      </div>
    </Part>
  );
}

// ----------------------------------------------------------------------------
// Packages

// The value of the search parameter hidden while the package tree shows its
// hidden records.
const HIDDEN_SHOWN = "shown";

// The affectedness of a track, with the tone of its meaning: Analysis blue,
// Affected orange, as warning, since red stays for lateness and errors, Not
// affected and Fixed green, Won't fix gray (docs/design-system.md, Other
// Values; Sentinel docs/features/packages/package-model.md, Axis 1:
// Affectedness).
const AFFECTEDNESS = new Map<string, MarkedName>(
  Object.entries({
    analysis: { name: "Analysis", tone: "info" },
    affected: { name: "Affected", tone: "warning" },
    not_affected: { name: "Not affected", tone: "success" },
    fixed: { name: "Fixed", tone: "success" },
    wont_fix: { name: "Won't fix", tone: "neutral" },
  } satisfies Record<PackageStatusValue, MarkedName>),
);

// The delivery status of a track: Pending neutral, In progress blue,
// Released green (same document, Axis 3: Delivery and Release Observation).
const DELIVERY = new Map<string, MarkedName>(
  Object.entries({
    pending: { name: "Pending", tone: "neutral" },
    in_progress: { name: "In progress", tone: "info" },
    released: { name: "Released", tone: "success" },
  } satisfies Record<DeliveryStatusValue, MarkedName>),
);

// The lifecycle phase of a Product (Sentinel
// docs/features/packages/product-catalog.md, Product Lifecycle Phases).
const LIFECYCLE_PHASES = new Map<string, string>(
  Object.entries({
    pre_release: "Pre-release",
    general_support: "General support",
    extended_support: "Extended support",
    reactive_support: "Reactive support",
    eol: "EOL",
  } satisfies Record<LifecyclePhaseValue, string>),
);

// Why a Product takes no part in the work on the Ticket, by the first
// reason that applies (Sentinel docs/features/packages/package-model.md,
// Derived Actionability).
const PRODUCT_REASONS = new Map<string, string>(
  Object.entries({
    package_excluded: "No, its package is excluded",
    track_excluded: "No, its track is excluded",
    product_excluded: "No, it is excluded from this track",
    eol: "No, it has reached its end of life",
  } satisfies Record<ProductReasonValue, string>),
);

// The affectedness of a track that expects a fix, under which the release of
// its Products shows.
const EXPECTS_FIX = new Set<string>(["analysis", "affected", "fixed"]);

// Whether a track expects a fix: in Analysis, Affected, or Fixed.
function expectsFix(track: TrackDetail): boolean {
  return EXPECTS_FIX.has(track.status);
}

// Whether a Product takes part and receives the fix: actionable and eligible.
function receivesFix(product: ProductDetail): boolean {
  return product.actionable && product.eligible;
}

// The release of a Product that its line and its details show: when it was
// released, on every released Product; and, on a Product that receives the
// fix under a track that expects one (expectsFix), that it is not released
// where Sentinel observes the QA of the track, which the release of its
// Products completes, or that its release is not observed (observes);
// otherwise none, as on a track without due dates.
type Release =
  | { kind: "released"; at: string }
  | { kind: "not-released" }
  | { kind: "not-observed" };

function releaseOf(
  product: ProductDetail,
  fixExpected: boolean,
  observed: boolean | undefined,
): Release | undefined {
  if (product.released_at !== null) {
    return { kind: "released", at: product.released_at };
  }
  if (observed === undefined || !receivesFix(product) || !fixExpected) {
    return undefined;
  }
  return observed ? { kind: "not-released" } : { kind: "not-observed" };
}

interface ReleaseTextProps {
  release: Release;
  // The words of a release that Sentinel does not observe.
  notObserved: string;
}

// A release in words: "Released" and its date and time, "Not released", or
// the words of a release that is not observed.
function ReleaseText({ release, notObserved }: ReleaseTextProps) {
  if (release.kind === "released") {
    return (
      <>
        Released <DateTime value={release.at} />
      </>
    );
  }
  return release.kind === "not-released" ? "Not released" : notObserved;
}

// Whether a track has work: actionable and in Analysis, or Affected or Fixed
// with a Product that is actionable and eligible. A track without work, a
// hidden one included, shows no pipeline and no "Delivery Pending".
function hasWork(track: TrackDetail): boolean {
  if (!track.actionable) {
    return false;
  }
  if (track.status === "analysis") {
    return true;
  }
  return (
    (track.status === "affected" || track.status === "fixed") &&
    track.products.some(receivesFix)
  );
}

// Whether the Ticket has an SLA for the track: without one, as on an Ignored
// or Duplicated Ticket, every due date and every milestone is null (Sentinel
// docs/features/tickets/ticket-deadlines.md, Null Due Dates).
function hasDueDates(track: TrackDetail): boolean {
  return PHASES.some(({ due }) => track[due] !== null);
}

// Whether Sentinel observes a phase of a track, as its milestones state it:
// on a track with due dates, a milestone of null is a phase that Sentinel
// does not observe for the track, such as the submission, the UM, and the QA
// of a Git track or of a track of a Ticket without a CVE, and every other
// value one that it observes (Sentinel
// docs/features/tickets/ticket-deadlines.md, Track Milestones; Observability
// of Later Phases); undefined on a track without due dates, whose milestones
// are all null because no SLA applies, so that it shows neither "Delivery
// Pending" nor a release that is due.
function observes(
  track: TrackDetail,
  phase: "submission" | "qa",
): boolean | undefined {
  if (!hasDueDates(track)) {
    return undefined;
  }
  return track.milestones[phase] !== null;
}

// The number of hidden records that "Show hidden" shows: every record that
// is not actionable and whose parent shows, a hidden package or track
// counting once with what it holds. A record is hidden exactly when it is not
// actionable: excluded, directly or through its parent, at the end of its
// life, or holding no record that is actionable (Sentinel
// docs/features/packages/package-model.md, Derived Actionability).
function hiddenCount(packages: readonly PackageDetail[]): number {
  let count = 0;
  for (const ticketPackage of packages) {
    if (!ticketPackage.actionable) {
      count += 1;
      continue;
    }
    for (const track of ticketPackage.tracks) {
      count += track.actionable
        ? track.products.filter((product) => !product.actionable).length
        : 1;
    }
  }
  return count;
}

// The key of a track of a package, by which the tracks that wait for the
// user are matched: Sentinel keeps the reference unique within a package
// (Sentinel docs/features/packages/package-model.md, TicketPackageTrack).
function trackKey(packageName: string, reference: string): string {
  return JSON.stringify([packageName, reference]);
}

interface HiddenLabelsProps {
  // Whether its own marker excludes it.
  excluded: boolean;
  // Whether it has reached the end of its life.
  eol?: boolean;
}

// The labels of a record whose own state hides it, such as Excluded, also
// under a hidden parent; a record hidden only because of its parent or of
// the records that it holds carries none (docs/design-system.md, Detail
// Screens).
function HiddenLabels({ excluded, eol = false }: HiddenLabelsProps) {
  return (
    <>
      {excluded && <Label>Excluded</Label>}
      {eol && <Label>EOL</Label>}
    </>
  );
}

// The text color of a record: fg-muted for a hidden record and everything it
// holds, so that it reads apart from the records that count.
function mutedIf(hidden: boolean): string {
  return hidden ? "text-fg-muted" : "";
}

interface ProductDetailsProps {
  product: ProductDetail;
  release: Release | undefined;
}

// The details of a Product, as its popover shows them: its eligibility,
// automatic or set by hand; its lifecycle phase, or "Not available" without
// lifecycle data; its release, where its line shows one; and, for a Product
// that takes no part, why. Values that the pinned contract does not list
// show as received.
function ProductDetails({ product, release }: ProductDetailsProps) {
  return (
    <DescriptionList>
      <DescriptionItem term="Eligibility">
        {product.eligible ? "Eligible" : "Not eligible"}
        {" · "}
        {product.is_eligible_override ? (
          <span className="inline-flex items-center gap-1 align-bottom">
            <UserPen aria-hidden className="size-3.5 text-fg-muted" />
            set by hand
          </span>
        ) : (
          "automatic"
        )}
      </DescriptionItem>
      <DescriptionItem term="Lifecycle">
        {product.lifecycle_phase === null ? (
          <AbsentValue name="Not available" />
        ) : (
          (LIFECYCLE_PHASES.get(product.lifecycle_phase) ??
          product.lifecycle_phase)
        )}
      </DescriptionItem>
      {release !== undefined && (
        <DescriptionItem term="Release">
          <ReleaseText release={release} notObserved="Not observed" />
        </DescriptionItem>
      )}
      {!product.actionable && (
        <DescriptionItem term="Actionable">
          {product.non_actionable_reason === null
            ? "No"
            : (PRODUCT_REASONS.get(product.non_actionable_reason) ??
              `No, ${product.non_actionable_reason}`)}
        </DescriptionItem>
      )}
    </DescriptionList>
  );
}

interface ProductItemProps {
  product: ProductDetail;
  // Whether the track that holds the Product is hidden.
  trackHidden: boolean;
  // Whether the track that holds the Product expects a fix (expectsFix).
  fixExpected: boolean;
  // Whether Sentinel observes the QA of the track, the release of its
  // Products (observes).
  releaseObserved: boolean | undefined;
}

// A Product of a track: its name, which opens its details, in fg-muted when
// it is hidden or not eligible, and wraps; user-pen at 14 px in fg-muted when
// its eligibility is set by hand, read as ", eligibility set by hand"; the
// label Not eligible, and the labels of its own hidden state; and at the end
// its release (releaseOf), in text-13, fg-muted: "Released" with the date and
// time, "Not released", or "Release not observed".
function ProductItem({
  product,
  trackHidden,
  fixExpected,
  releaseObserved: observed,
}: ProductItemProps) {
  const ref = useRef<HTMLLIElement>(null);
  useFocusHeadingOnRemoval(ref);
  const hidden = trackHidden || !product.actionable;
  const release = releaseOf(product, fixExpected, observed);
  return (
    <li
      ref={ref}
      className="flex flex-wrap items-center justify-between gap-x-3"
    >
      <span
        className={`flex min-w-0 flex-wrap items-center gap-x-1.5 ${mutedIf(hidden || !product.eligible)}`}
      >
        <DetailsName
          name={product.product_name}
          identifier={<span className="font-mono">{product.product_cpe}</span>}
        >
          <ProductDetails product={product} release={release} />
        </DetailsName>
        {product.is_eligible_override && (
          <>
            <UserPen aria-hidden className="size-3.5 shrink-0 text-fg-muted" />
            <span className="sr-only">, eligibility set by hand</span>
          </>
        )}
        {!product.eligible && <Label>Not eligible</Label>}
        <HiddenLabels
          excluded={product.deleted_at !== null}
          eol={product.lifecycle_phase === "eol"}
        />
      </span>
      {release !== undefined && (
        <span className="text-13 text-fg-muted">
          <ReleaseText release={release} notObserved="Release not observed" />
        </span>
      )}
    </li>
  );
}

interface TrackItemProps {
  packageName: string;
  track: TrackDetail;
  // Whether the package that holds the track is hidden.
  packageHidden: boolean;
  // Whether the track waits for the signed-in user.
  waitsForYou: boolean;
  showHidden: boolean;
  now: number;
}

// A track of a package, on two lines, with a border line at its left, or,
// when it waits for the signed-in user, a bar of 3 px in link:
// - its reference at weight 500, "Needs your action" when it waits for the
//   user, the label of its own hidden state, and at the end its
//   affectedness;
// - "Delivery" and its status, where it is relevant (Sentinel
//   docs/features/packages/package-model.md, Delivery Relevance Indicator)
//   and either its status is not Pending or the track has work and Sentinel
//   observes its submission, which its delivery completes (observes;
//   Sentinel docs/features/tickets/ticket-deadlines.md, Completion
//   Evidence); and the pipeline of its phases, when it has work and due
//   dates, which shows the deadlines of the track in place of a badge;
// then its Products, as a list with a border line at its left. A hidden
// track shows its hidden Products; another track only while "Show hidden" is
// on.
function TrackItem({
  packageName,
  track,
  packageHidden,
  waitsForYou,
  showHidden,
  now,
}: TrackItemProps) {
  const ref = useRef<HTMLLIElement>(null);
  useFocusHeadingOnRemoval(ref);
  const hidden = packageHidden || !track.actionable;
  const work = hasWork(track);
  const delivery =
    track.delivery_relevant &&
    (track.delivery_status !== "pending" ||
      (work && observes(track, "submission") === true));
  const pipeline = work && hasDueDates(track);
  const products = track.products.filter(
    (product) => showHidden || product.actionable,
  );
  return (
    <li
      ref={ref}
      className={`border-s ${waitsForYou ? "border-s-3 border-link ps-2.5" : "border-border ps-3"} ${mutedIf(hidden)}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="font-medium wrap-anywhere">{track.reference}</span>
          {waitsForYou && <NeedsYourAction />}
          <HiddenLabels excluded={track.deleted_at !== null} />
        </span>
        <span className="text-14">
          <MarkedValue value={track.status} known={AFFECTEDNESS} />
        </span>
      </div>
      {(delivery || pipeline) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-14">
          {delivery && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-fg-muted">Delivery</span>
              <MarkedValue value={track.delivery_status} known={DELIVERY} />
            </span>
          )}
          {pipeline && (
            <TrackMilestones
              track={track}
              subject={`${packageName}, ${track.reference}`}
              now={now}
            />
          )}
        </div>
      )}
      {products.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5 border-s border-border ps-3 text-14">
          {products.map((product) => (
            <ProductItem
              key={product.id}
              product={product}
              trackHidden={hidden}
              fixExpected={expectsFix(track)}
              releaseObserved={observes(track, "qa")}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// The label of a track that waits for the signed-in user, 20 px high, in
// text-12, weight 500, info-on-soft on info-soft, without a boundary, with
// 6 px of side padding and a 4 px radius (docs/design-system.md, Labels). It
// says "Needs your action" rather than "Pending", which names the delivery
// status of the same track (docs/behaviors.md, Deadlines).
function NeedsYourAction() {
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded bg-info-soft px-1.5 text-12 font-medium text-info-on-soft">
      Needs your action
    </span>
  );
}

interface PackageGroupProps {
  ticketPackage: PackageDetail;
  // The keys of the tracks that wait for the signed-in user (trackKey).
  waiting: ReadonlySet<string>;
  showHidden: boolean;
  now: number;
}

// A package as a group under a band (docs/design-system.md, Detail Screens):
// the band, on neutral-soft, at least 32 px high, with a 6 px radius and
// 12 px of side padding, holds its name as a level-three heading in text-15,
// weight 600, which wraps, its maintainers, and the label of its own hidden
// state; its tracks follow 12 px below the band, indented by 12 px, 16 px
// apart. A hidden package shows its hidden tracks; another package only
// while "Show hidden" is on.
function PackageGroup({
  ticketPackage,
  waiting,
  showHidden,
  now,
}: PackageGroupProps) {
  const ref = useRef<HTMLLIElement>(null);
  useFocusHeadingOnRemoval(ref);
  const hidden = !ticketPackage.actionable;
  const tracks = ticketPackage.tracks.filter(
    (track) => showHidden || track.actionable,
  );
  return (
    <li ref={ref}>
      <div
        className={`flex min-h-8 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-neutral-soft px-3 py-1 ${mutedIf(hidden)}`}
      >
        <h3 className="min-w-0 text-15 font-semibold wrap-anywhere">
          {ticketPackage.package_name}
        </h3>
        <Maintainers
          users={ticketPackage.maintainers}
          packageName={ticketPackage.package_name}
        />
        <HiddenLabels excluded={ticketPackage.deleted_at !== null} />
      </div>
      {tracks.length > 0 && (
        <ul className="ms-3 mt-3 flex flex-col gap-4 text-15">
          {tracks.map((track) => (
            <TrackItem
              key={track.id}
              packageName={ticketPackage.package_name}
              track={track}
              packageHidden={hidden}
              waitsForYou={waiting.has(
                trackKey(ticketPackage.package_name, track.reference),
              )}
              showHidden={showHidden}
              now={now}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// Whether the user is a maintainer of a package of the Ticket that is not
// excluded: the associations through which Sentinel gives them work on the
// Ticket (Sentinel docs/features/packages/package-maintainership.md,
// Maintainers in the Package Tree; Workbench Dependency).
function maintainsIncludedPackage(
  ticket: TicketDetail,
  userId: string | undefined,
): boolean {
  return ticket.packages.some(
    (ticketPackage) =>
      ticketPackage.deleted_at === null &&
      ticketPackage.maintainers.some((maintainer) => maintainer.id === userId),
  );
}

// The read of the work of the signed-in user on the Ticket, which only adds
// marks to the package tree: sent only for a user whom the package tree lists
// as a maintainer of a package that is not excluded, and read again whenever
// the tab returns to the foreground, as it shows no error in place of content
// (src/query-client.ts). While the read is not sent, such as once the user
// no longer maintains a package that is not excluded, what an earlier read
// left in the query cache marks nothing.
function useYourWork(ticket: TicketDetail) {
  const user = useSignedInUser();
  const sent = maintainsIncludedPackage(ticket, user?.id);
  const read = useGetTicketPackageWork(ticket.ticket_id, {
    query: { enabled: sent, refetchOnWindowFocus: true },
  });
  return { read, sent };
}

type YourWorkRead = ReturnType<typeof useYourWork>;

interface PackagesPartProps {
  ticket: TicketDetail;
  now: number;
  yourWork: YourWorkRead;
}

// The package tree of the Ticket, from Get Ticket (Sentinel
// docs/features/tickets/tickets.md, TicketDetail; Sentinel
// docs/features/packages/package-model.md, List Ticket Packages), in the
// order of the API, read-only: each package as a group under a band, 32 px
// apart, its tracks and their Products as nested lists. The excluded and EOL
// records are hidden until "Show hidden", a switch at the end of the line of
// the heading followed by the number of hidden records, shows them, in
// fg-muted; the switch is disabled without hidden records, and its state is
// in the URL (docs/screen-map.md, Browser History), where it adds an entry
// to the browser history and keeps the anchor and the scroll position. The
// tracks that the work of the signed-in user lists as pending, matched by
// package and reference, wait for them; until that read arrives, no track is
// marked, and when it fails, a warning above the tree says that they
// couldn't be shown, so that the absence of marks is not read as no work,
// or, once a read of them has succeeded, that they couldn't be updated,
// while they stay shown, marked as being updated while they are read again
// (docs/behaviors.md, Where Errors Appear; Loading). A Ticket without packages shows
// "No packages.", and a tree whose packages are all hidden, "All packages
// are hidden.".
function PackagesPart({ ticket, now, yourWork }: PackagesPartProps) {
  const { hidden } = ticketOverviewRoute.useSearch();
  const navigate = useNavigate();
  const showHidden = hidden === HIDDEN_SHOWN;
  const { marks, warning, updating } = yourWork.sent
    ? marksPlace(yourWork.read, {
        notShown: "The tracks that wait for you couldn't be shown.",
        notUpdated: "The tracks that wait for you couldn't be updated.",
      })
    : { marks: undefined, warning: null, updating: false };
  const waiting = new Set(
    (marks?.data.pending ?? []).map((item) =>
      trackKey(item.package_name, item.reference),
    ),
  );
  const packages = ticket.packages.filter(
    (ticketPackage) => showHidden || ticketPackage.actionable,
  );
  const count = hiddenCount(ticket.packages);
  const toggle = (shown: boolean) => {
    void navigate({
      to: "/tickets/$ticketId",
      params: { ticketId: ticket.ticket_id },
      search: { hidden: shown ? HIDDEN_SHOWN : undefined },
      hash: true,
      resetScroll: false,
      hashScrollIntoView: false,
    });
  };
  return (
    <Part
      id={PACKAGES_ANCHOR}
      heading="Packages"
      actions={
        ticket.packages.length > 0 ? (
          <Switch
            isSelected={showHidden}
            onChange={toggle}
            isDisabled={count === 0}
          >
            Show hidden{" "}
            <span className="tabular-nums">{COUNT.format(count)}</span>
          </Switch>
        ) : undefined
      }
    >
      <div className="relative">
        {updating && <UpdatingBar />}
        <output className="block">{warning}</output>
        {ticket.packages.length === 0 && (
          <p className="text-fg-muted">No packages.</p>
        )}
        {ticket.packages.length > 0 && packages.length === 0 && (
          <p className="text-fg-muted">All packages are hidden.</p>
        )}
        {packages.length > 0 && (
          <ul className="flex flex-col gap-8">
            {packages.map((ticketPackage) => (
              <PackageGroup
                key={ticketPackage.id}
                ticketPackage={ticketPackage}
                waiting={waiting}
                showHidden={showHidden}
                now={now}
              />
            ))}
          </ul>
        )}
      </div>
    </Part>
  );
}

// ----------------------------------------------------------------------------
// CVSS assessments

// The CVSS versions that the pinned contract lists. A Set, so that a version
// that a later Sentinel release returns is looked up only among them
// (docs/conventions.md, Data Read from the API).
const CVSS_VERSIONS = new Set<string>(Object.values(CVSSVersionValue));

// The sources of an eligibility score that the pinned contract lists.
const ELIGIBILITY_SOURCES = new Set<string>(Object.values(EligibilitySource));

// A CVSS version with a "v", such as "v3.1", so that it is not read as a
// score; a version that the pinned contract does not list shows as received
// (docs/behaviors.md, Unknown Values).
function cvssVersion(version: string): string {
  return CVSS_VERSIONS.has(version) ? `v${version}` : version;
}

// A CVSS score, from 0.0 to 10.0, with its one decimal, such as 10.0.
const SCORE = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function Score({ value }: { value: number }) {
  return <span className="tabular-nums">{SCORE.format(value)}</span>;
}

interface ScoredSeverityProps {
  severity: string;
  score: number;
}

// A severity followed by the score that gives it, such as "High 8.1".
function ScoredSeverity({ severity, score }: ScoredSeverityProps) {
  return (
    <>
      <Severity severity={severity} /> <Score value={score} />
    </>
  );
}

// The read of the CVSS assessments of the CVE of the Ticket, sent only for a
// Ticket with a CVE (Sentinel docs/features/tickets/cvss-scoring.md, Get
// CVSS Assessments for a CVE).
function useCvssAssessments(ticket: TicketDetail) {
  const cveId = ticket.cve?.cve_id;
  return useGetCveCvssAssessments(cveId ?? "", {
    query: { enabled: cveId !== undefined },
  });
}

type CvssRead = ReturnType<typeof useCvssAssessments>;

interface ResolutionProps {
  assessments: CVECVSSAssessments;
}

// What the assessments resolve, which Sentinel resolves apart (Sentinel
// docs/features/tickets/cvss-scoring.md, Core Distinctions): the severity of
// the CVE, with the assessment that gives it, and the eligibility score with
// which the Products are calculated. When the SUSE assessment of the default
// CVSS version gives both, which the source suse of the eligibility score
// states, one line says so; otherwise two lines, the second the eligibility
// score, which without that assessment is the fallback 10.0 (same document,
// Severity Resolution Cascade; Eligibility Score Resolution). A source that
// the pinned contract does not list shows as received after the score
// (docs/behaviors.md, Unknown Values).
function Resolution({ assessments }: ResolutionProps) {
  const { severity, eligibility } = assessments;
  if (severity !== null && eligibility.source === "suse") {
    return (
      <dl className="text-14">
        <InlineField term="Severity">
          <ScoredSeverity severity={severity.label} score={severity.score} />{" "}
          from {severity.provider} CVSS {cvssVersion(severity.version)}, which
          also sets the eligibility score of the Products
        </InlineField>
      </dl>
    );
  }
  return (
    <dl className="flex flex-col gap-1 text-14">
      <InlineField term="Severity">
        {severity === null ? (
          <AbsentValue />
        ) : (
          <>
            <ScoredSeverity severity={severity.label} score={severity.score} />{" "}
            from {severity.provider} CVSS {cvssVersion(severity.version)}
          </>
        )}
      </InlineField>
      <InlineField term="Eligibility score">
        <Score value={eligibility.score} />
        {eligibility.source === "fallback" &&
          `, the fallback without a SUSE CVSS ${cvssVersion(assessments.default_cvss_version)} assessment`}
        {!ELIGIBILITY_SOURCES.has(eligibility.source) &&
          `, ${eligibility.source}`}
      </InlineField>
    </dl>
  );
}

interface VectorProps {
  value: string;
}

// A CVSS vector in monospace, which users copy character by character
// (docs/design-system.md, Font), with a place to break after each "/", so
// that it wraps between its metrics where its column is narrower than it.
function Vector({ value }: VectorProps) {
  const metrics = value.split("/");
  return (
    <span className="font-mono">
      {metrics.map((metric, index) => (
        // The place of a metric keys it, since a vector, which a new read
        // replaces whole, never reorders its metrics.
        <span key={index}>
          {metric}
          {index < metrics.length - 1 && (
            <>
              /<wbr />
            </>
          )}
        </span>
      ))}
    </span>
  );
}

// The columns of the table of the assessments: the provider and the version,
// which name the assessment; its severity by the scale of its version, which
// is not the resolved severity, with its score; and its vector. The texts
// wrap, as in a table whose records have no screen of their own
// (docs/design-system.md, Tables). Of an assessment of a version that the
// pinned contract does not list, the severity, whose scale depends on the
// version, is left out, and its score shows alone (docs/behaviors.md, Unknown
// Values).
const ASSESSMENT_COLUMNS: readonly TableColumn<CVSSAssessmentItem>[] = [
  {
    id: "provider",
    name: "Provider",
    isRowHeader: true,
    wraps: true,
    render: (assessment) => assessment.provider_name,
  },
  {
    id: "version",
    name: "Version",
    isRowHeader: true,
    render: (assessment) => cvssVersion(assessment.cvss_version),
  },
  {
    id: "severity",
    name: "Assessment severity",
    render: (assessment) =>
      CVSS_VERSIONS.has(assessment.cvss_version) ? (
        <ScoredSeverity
          severity={assessment.severity}
          score={assessment.score}
        />
      ) : (
        <Score value={assessment.score} />
      ),
  },
  {
    id: "vector",
    name: "Vector",
    wraps: true,
    render: (assessment) => <Vector value={assessment.vector_string} />,
  },
];

interface CvssPartProps {
  read: CvssRead;
}

// The CVSS assessments of the CVE of the Ticket, from Get CVSS Assessments
// for a CVE, read-only: what they resolve, then the table of the
// assessments in the order of the API, by version, then by provider (Sentinel
// docs/features/tickets/cvss-scoring.md, Version Precedence), or "No CVSS
// assessments." without any. The part reads them on its own, and their
// loading and their errors show in its place (docs/behaviors.md, Loading;
// Where Errors Appear).
function CvssPart({ read }: CvssPartProps) {
  return (
    <Part id={CVSS_ANCHOR} heading="CVSS assessments">
      <PartRead read={read}>
        {({ data }) =>
          data.assessments.length === 0 ? (
            <p className="text-fg-muted">No CVSS assessments.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <Resolution assessments={data} />
              <FramedTable
                label="CVSS assessments"
                columns={ASSESSMENT_COLUMNS}
                rows={data.assessments}
                rowId={(assessment) => assessment.id}
              />
            </div>
          )
        }
      </PartRead>
    </Part>
  );
}

// ----------------------------------------------------------------------------
// Sources of the CVE

// How often the sources are read again while the fetch of one of them is
// pending (docs/behaviors.md, Loading).
const PENDING_READ_INTERVAL_MS = 5_000;

// The names of the CVE sources, as Sentinel names them (Sentinel
// docs/features/tickets/cve-tracking.md, CVE Sources). The registry of the
// fetchers decides the sources, so the pinned OpenAPI document types them as
// text (Sentinel docs/api-spec.md, Response Enums), and a source that the
// pinned contract does not list shows as received (docs/behaviors.md,
// Unknown Values). A Map, so that such a source is looked up only among
// them (docs/conventions.md, Data Read from the API).
const SOURCE_NAMES = new Map<string, string>(
  Object.entries({
    epss: "EPSS",
    ghsa: "GHSA",
    kernel: "Linux Kernel CNA",
    kev: "CISA KEV",
    mitre: "MITRE",
    nvd: "NVD",
    osv: "OSV",
    redhat: "Red Hat",
  }),
);

function sourceName(source: string): string {
  return SOURCE_NAMES.get(source) ?? source;
}

// The status of a source, with the tone of its meaning: Success green,
// Failure red, Missing gray, Pending blue, turning, as an operation that the
// screen follows by reading it again, and Not attempted with a dashed circle,
// as an observation never made (docs/design-system.md, Other Values;
// Sentinel docs/features/tickets/cve-service.md, CVE Source Status, Status
// values).
const SOURCE_STATUSES = new Map<string, MarkedName>(
  Object.entries({
    success: { name: "Success", tone: "success" },
    failure: { name: "Failure", tone: "danger" },
    missing: { name: "Missing", tone: "neutral" },
    pending: { name: "Pending", tone: "info", mark: "progress" },
    not_attempted: {
      name: "Not attempted",
      tone: "neutral",
      mark: "unobserved",
    },
  } satisfies Record<CVESourceDerivedStatusValue, MarkedName>),
);

function statusName(status: string): string {
  return SOURCE_STATUSES.get(status)?.name ?? status;
}

// Whether a source can be refetched: currently registered, able to fetch one
// CVE, and enabled (Sentinel docs/features/tickets/cve-tracking.md, Re-fetch
// CVE Data). CISA KEV, which downloads its whole catalog, cannot.
function canRefetch(source: CVESourceStatusItem): boolean {
  return source.registered && source.refetchable && source.enabled;
}

// The read of the sources of the CVE of the Ticket, sent only for a Ticket
// with a CVE (Sentinel docs/features/tickets/cve-service.md, CVE Source
// Status). While a fetch of a source is pending, the read is sent again at
// intervals, but not while the tab is hidden, the default of TanStack Query,
// and not after a read of them failed, until a read of them succeeds again,
// as after Try again or when the tab returns to the foreground
// (docs/behaviors.md, Loading).
function useCveSources(ticket: TicketDetail) {
  const cveId = ticket.cve?.cve_id;
  return useGetCveSourceStatus(cveId ?? "", {
    query: {
      enabled: cveId !== undefined,
      refetchInterval: (query) =>
        query.state.status === "success" &&
        query.state.data?.data.some((source) => source.status === "pending") ===
          true
          ? PENDING_READ_INTERVAL_MS
          : false,
    },
  });
}

type SourcesRead = ReturnType<typeof useCveSources>;

// Reads again the data of the tab of a Ticket with a CVE, as when the tab
// returns to the foreground: the Ticket, its duplicates, the work of a
// maintainer on it, and the CVSS assessments of its CVE, with its sources
// where asked: the reads of the tab that the anchor of the URL waits for
// (TicketOverview), and the Ticket, so that a read added to the tab is
// added to both. A read that the tab does not send, such as the duplicates
// of a duplicate, is not sent.
function useReadAgain(ticketId: string, cveId: string) {
  const client = useQueryClient();
  return useCallback(
    (withSources: boolean) => {
      const keys: (readonly unknown[])[] = [
        getGetTicketQueryKey(ticketId),
        getListTicketsQueryKey(duplicatesOf(ticketId)),
        getGetTicketPackageWorkQueryKey(ticketId),
        getGetCveCvssAssessmentsQueryKey(cveId),
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

type ReadAgain = ReturnType<typeof useReadAgain>;

// The sources that a read showed pending, by source, each with the time of
// its last completed attempt then.
type PendingSources = ReadonlyMap<string, string | null>;

function pendingOf(sources: readonly CVESourceStatusItem[]): PendingSources {
  return new Map(
    sources
      .filter((source) => source.status === "pending")
      .map((source) => [source.source, source.fetched_at]),
  );
}

// What a read shows of the fetches that an earlier read showed pending and
// that it no longer shows so, in the order of the sources, such as "MITRE:
// no new result. NVD: Failure.": the status of each, or that it shows no
// new result when the time of its last completed attempt has not changed,
// as when Sentinel did not run the fetch, or does not tell that it is still
// pending (Sentinel docs/features/tickets/cve-service.md, CVE Source Status,
// Completed timestamps during pending; Redis graceful degradation); "" when
// no fetch ended.
function endsOf(
  pending: PendingSources,
  sources: readonly CVESourceStatusItem[],
): string {
  return sources
    .filter(
      (source) => pending.has(source.source) && source.status !== "pending",
    )
    .map((source) =>
      pending.get(source.source) === source.fetched_at
        ? `${sourceName(source.source)}: no new result.`
        : `${sourceName(source.source)}: ${statusName(source.status)}.`,
    )
    .join(" ");
}

interface Announcement {
  // The time of the read, which gives each announcement a node of its own.
  key: number;
  text: string;
}

// Follows the fetches of the sources: when a read no longer shows pending a
// source that an earlier read of the screen showed so, it announces what it
// shows of each, in one announcement, and reads the data of the tab again
// (docs/behaviors.md, Outcome of a Change). The sources that the screen
// shows as it opens from an earlier visit, until its first read arrives,
// are not such a read. It keeps only which sources were pending, and when
// they were last attempted, not the data of the read.
function useEndsOfFetches(
  read: SourcesRead,
  readAgain: ReadAgain,
): Announcement | undefined {
  const { data, dataUpdatedAt } = read;
  // The time of the data that the screen showed as it opened, which a read
  // of the screen replaces.
  const [openedWith] = useState(dataUpdatedAt);
  const pending = useRef<PendingSources | undefined>(undefined);
  const [announcement, setAnnouncement] = useState<Announcement>();
  useEffect(() => {
    if (data === undefined || dataUpdatedAt <= openedWith) {
      return;
    }
    const before = pending.current;
    pending.current = pendingOf(data.data);
    const text = before === undefined ? "" : endsOf(before, data.data);
    if (text !== "") {
      setAnnouncement({ key: dataUpdatedAt, text });
      readAgain(false);
    }
  }, [data, dataUpdatedAt, openedWith, readAgain]);
  return announcement;
}

// The names of several sources, such as "OSV and Red Hat".
const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });

function sourceNames(sources: readonly string[]): string {
  return LIST.format(sources.map(sourceName));
}

// The message of a refetch that Sentinel accepted, which has started, not
// finished (docs/behaviors.md, Outcome of a Change): that the refetch of the
// source, or of every source, started, or was already in progress; the
// sources that it skipped as disabled; and, as a warning, those whose fetch
// Sentinel did not confirm, which may still start (Sentinel
// docs/features/tickets/cve-tracking.md, Re-fetch CVE Data).
function refetchMessage(
  result: CVERefetchResult,
  source: string | undefined,
): { tone: MessageTone; text: string } {
  const started = result.sources_enqueued.length > 0;
  const what =
    source === undefined ? "Refetch" : `Refetch of ${sourceName(source)}`;
  const sentences = [
    started ? `${what} started.` : `${what} was already in progress.`,
  ];
  const disabled = result.sources_disabled;
  if (disabled.length > 0) {
    sentences.push(
      disabled.length === 1
        ? `${sourceNames(disabled)} is disabled and was skipped.`
        : `${sourceNames(disabled)} are disabled and were skipped.`,
    );
  }
  const failed = result.sources_failed;
  if (failed.length > 0) {
    sentences.push(
      `Sentinel didn't confirm the refetch of ${sourceNames(failed)}: ${failed.length === 1 ? "it" : "they"} may still start.`,
    );
  }
  return {
    tone: failed.length > 0 ? "warning" : "info",
    text: sentences.join(" "),
  };
}

interface RefetchTarget {
  ticketId: string;
  cveId: string;
  // The source to refetch, or undefined for every source.
  source: string | undefined;
  readAgain: ReadAgain;
}

// Refetch of a source, or of every source, of the CVE of the Ticket, Re-fetch
// CVE Data, POST /api/v1/cves/{cve_id}/refetch, with the source when one
// (Sentinel docs/features/tickets/cve-tracking.md, Re-fetch CVE Data). It asks
// for no confirmation. Its message, or the message of its failure, shows in
// the message area, and names the Ticket, with a link to it, when it shows
// after the user left its screen (docs/behaviors.md, Outcome of a Change);
// then the data of the tab, its sources included, is read again. The outcome
// applies also when the button that started it has left the page.
function useRefetch({ ticketId, cveId, source, readAgain }: RefetchTarget) {
  const showMessage = useShowMessage();
  // A failure of the UI itself, which the root route shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const record: MessageRecord = {
    name: ticketId,
    href: linkOptions({ to: "/tickets/$ticketId", params: { ticketId } }),
  };
  const refetch = useRefetchCve({
    mutation: {
      onSuccess: (response) => {
        showMessage({ ...refetchMessage(response.data, source), record });
      },
      onError: (failure) => {
        if (!isRequestFailure(failure)) {
          setUiFailure({ error: failure });
          return;
        }
        const presentation = presentRefetchFailure(failure);
        if (presentation !== undefined) {
          showMessage({
            tone: presentation.unconfirmed ? "warning" : "danger",
            text: presentation.message,
            reference: presentation.reference,
            record,
          });
        }
      },
      onSettled: () => {
        readAgain(true);
      },
    },
  });
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }
  // The button is busy while the refetch is in progress, so it cannot start
  // another one meanwhile.
  return {
    start: () => {
      refetch.mutate({
        cveId,
        params: source === undefined ? undefined : { source },
      });
    },
    busy: refetch.isPending,
  };
}

// Refetch of one source, an icon button at the end of its line, named after
// the source, such as "Refetch NVD", busy while its refetch is in progress.
// When a new read removes it while it has the focus, such as after the source
// became disabled, the focus moves to the screen's heading
// (docs/behaviors.md, Accessibility, Focus after an action).
function RefetchSource(target: RefetchTarget & { source: string }) {
  const refetch = useRefetch(target);
  return (
    <FocusHandOff>
      <IconButton
        label={`Refetch ${sourceName(target.source)}`}
        icon={RefreshCw}
        size="inline"
        isBusy={refetch.busy}
        onPress={refetch.start}
      />
    </FocusHandOff>
  );
}

// Refetch of every source that can be refetched, a small secondary button in
// the heading of the section, busy while its refetch is in progress.
function RefetchAll(target: RefetchTarget) {
  const refetch = useRefetch(target);
  return (
    <FocusHandOff>
      <Button
        size="small"
        icon={RefreshCw}
        isBusy={refetch.busy}
        onPress={refetch.start}
      >
        Refetch all
      </Button>
    </FocusHandOff>
  );
}

interface SourceItemProps {
  source: CVESourceStatusItem;
  // Refetch of the source, for a user who can take it.
  refetch: ReactNode;
}

// A source of the CVE, as a list item: its name, then its status, by its
// mark and its name, and the label Disabled of a source that is disabled, or
// Retired of one that is no longer registered; below them, in text-13 and
// fg-muted, the date and time of its last completed attempt, or, for the
// evidence of CISA KEV, of its last change, and the start of its failure
// streak (Sentinel docs/features/tickets/cve-service.md, CVE Source Status);
// and at the end of its first line, Refetch.
function SourceItem({ source, refetch }: SourceItemProps) {
  const kevEvidence = source.source === "kev" && source.status === "success";
  return (
    <li className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="font-medium wrap-break-word">
            {sourceName(source.source)}
          </span>
          <MarkedValue value={source.status} known={SOURCE_STATUSES} />
          {!source.registered && <Label>Retired</Label>}
          {source.registered && !source.enabled && <Label>Disabled</Label>}
        </div>
        {source.fetched_at !== null && (
          <p className="text-13 text-fg-muted">
            {kevEvidence ? "Updated" : "Last attempt"}{" "}
            <DateTime value={source.fetched_at} />
          </p>
        )}
        {source.first_failed_at !== null && (
          <p className="text-13 text-fg-muted">
            Failing since <DateTime value={source.first_failed_at} />
          </p>
        )}
      </div>
      {refetch !== undefined && <div className="-my-0.5">{refetch}</div>}
    </li>
  );
}

interface SourcesSectionProps {
  ticketId: string;
  cveId: string;
  read: SourcesRead;
}

// The sources of the CVE of the Ticket, the last section of the side column,
// from CVE Source Status, in the order of the API, by source, a source of
// the CVE per line (Sentinel docs/features/tickets/cve-service.md, CVE
// Source Status), or "No sources." without any. With triage_ticket, Refetch
// of each source that can be refetched, and Refetch all while one can
// (docs/screen-map.md, Roles, Principles). The section reads them on its
// own, and their loading and their errors show in its place
// (docs/behaviors.md, Loading; Where Errors Appear). The end of a fetch that
// it follows is announced in a status region of its own, which is there
// before it.
function SourcesSection({ ticketId, cveId, read }: SourcesSectionProps) {
  const readAgain = useReadAgain(ticketId, cveId);
  const user = useSignedInUser();
  const triage = user?.capabilities.includes("triage_ticket") === true;
  const announcement = useEndsOfFetches(read, readAgain);
  const shown = dataShown(read)?.data;
  return (
    <SideSection
      id={SOURCES_ANCHOR}
      heading="Sources of the CVE"
      actions={
        triage && shown?.some(canRefetch) === true ? (
          <RefetchAll
            ticketId={ticketId}
            cveId={cveId}
            source={undefined}
            readAgain={readAgain}
          />
        ) : undefined
      }
    >
      <PartRead read={read}>
        {({ data }) =>
          data.length === 0 ? (
            <p className="text-14 text-fg-muted">No sources.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-14">
              {data.map((source) => (
                <SourceItem
                  key={source.source}
                  source={source}
                  refetch={
                    triage && canRefetch(source) ? (
                      <RefetchSource
                        ticketId={ticketId}
                        cveId={cveId}
                        source={source.source}
                        readAgain={readAgain}
                      />
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )
        }
      </PartRead>
      <output className="sr-only">
        <span key={announcement?.key}>{announcement?.text}</span>
      </output>
    </SideSection>
  );
}

// ----------------------------------------------------------------------------
// Anchors

// The keys that scroll the page, with which a user scrolls it by the keyboard.
const SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
  " ",
]);

// A read of the tab, which has settled once it has its data or its error, or
// when it is not sent, such as the duplicates of a duplicate.
type TabRead = Pick<Read<unknown>, "status" | "isFetching">;

function settled(read: TabRead): boolean {
  return read.status !== "pending" || !read.isFetching;
}

// Shows the target of the anchor of the URL once every read of the tab has
// settled, unless the user has scrolled meanwhile, so that a read that
// arrives later does not move the target out of view; the window scrolls it
// below what stays at the top of the window (src/components/fixed-top.ts),
// also in the side column, which can show it only toward the end of the page
// (showAnchorTarget). An anchor whose target the Ticket lacks, such as a part
// that it does not have, shows the top of the screen (docs/design-system.md,
// Main Content).
function useAnchorTarget(reads: readonly TabRead[]) {
  const ready = reads.every(settled);
  const hash = useRouterState({ select: (state) => state.location.hash });
  const scrolled = useRef(false);
  const shown = useRef(false);
  useEffect(() => {
    const onScrollIntent = () => {
      scrolled.current = true;
    };
    const onKey = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) {
        scrolled.current = true;
      }
    };
    window.addEventListener("wheel", onScrollIntent, { passive: true });
    window.addEventListener("touchmove", onScrollIntent, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onScrollIntent);
      window.removeEventListener("touchmove", onScrollIntent);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => {
    if (!ready || shown.current) {
      return;
    }
    shown.current = true;
    if (hash === "" || scrolled.current) {
      return;
    }
    const target = document.getElementById(hash);
    if (target === null) {
      window.scrollTo(0, 0);
    } else {
      showAnchorTarget(target);
    }
  }, [ready, hash]);
}

// ----------------------------------------------------------------------------
// Overview

function TicketOverview() {
  const { ticket, now, twoColumns } = useShownTicket();
  const duplicates = useDuplicates(ticket);
  const yourWork = useYourWork(ticket);
  const cvss = useCvssAssessments(ticket);
  const sources = useCveSources(ticket);
  // The reads of the tab, which useReadAgain reads again too.
  useAnchorTarget([duplicates, yourWork.read, cvss, sources]);
  return (
    <DetailColumns
      twoColumns={twoColumns}
      leadingSections={
        <Details ticket={ticket} now={now} duplicates={duplicates} />
      }
      trailingSections={
        ticket.cve !== null && (
          <SourcesSection
            ticketId={ticket.ticket_id}
            cveId={ticket.cve.cve_id}
            read={sources}
          />
        )
      }
      parts={
        <>
          <CvePart cve={ticket.cve} />
          <PackagesPart ticket={ticket} now={now} yourWork={yourWork} />
          {ticket.cve !== null && <CvssPart read={cvss} />}
        </>
      }
    />
  );
}

// The search parameters that Overview accepts: hidden, while the package
// tree shows its hidden records. A value that it does not accept counts as
// absent (docs/behaviors.md, Invalid Search Parameters).
const ticketOverviewSearch = z.object({
  hidden: z.literal(HIDDEN_SHOWN).optional().catch(undefined),
});

// Overview, at the path of the Ticket. A URL with a search parameter that it
// does not accept, or with a value that it does not accept, leads to the URL
// without it, in place of the URL in the browser history, keeping its anchor
// (docs/behaviors.md, Invalid Search Parameters; docs/screen-map.md, Browser
// History).
export const ticketOverviewRoute = createRoute({
  getParentRoute: () => ticketRoute,
  path: "/",
  validateSearch: ticketOverviewSearch,
  beforeLoad: ({ location, params }) => {
    // The router's search of the route also passes on every parameter of the
    // URL that the schema does not declare, so the schema reads the URL
    // itself.
    const accepted = ticketOverviewSearch.parse(location.search);
    if (!sameSearch(location.search, accepted)) {
      throw redirect({
        to: "/tickets/$ticketId",
        params,
        search: accepted,
        hash: location.hash,
        replace: true,
      });
    }
  },
  component: TicketOverview,
});
