import { useQueryClient } from "@tanstack/react-query";
import {
  createRoute,
  linkOptions,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  ClockAlert,
  RefreshCw,
  TriangleAlert,
  UserPen,
  UserRoundKey,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Form } from "react-aria-components";
import { z } from "zod";
import {
  grantAccessFieldError,
  isNotConfidential,
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentChangeFailure,
  presentRefetchFailure,
  validationErrorFields,
} from "../api/errors";
import { useGetCna } from "../api/generated/cnas";
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
import {
  CVSS2AccessComplexity,
  CVSS2AccessVector,
  CVSS2Authentication,
  CVSS2Impact,
  CVSS3Scope,
  CVSS3UserInteraction,
  CVSS4AttackRequirements,
  CVSS4UserInteraction,
  CVSSAttackComplexity,
  CVSSAttackVector,
  CVSSImpact,
  CVSSPrivilegesRequired,
  CVSSVersionValue,
  EligibilitySource,
} from "../api/generated/model";
import type {
  CNASummary,
  CVECVSSAssessments,
  CVEDetail,
  CVEEPSSResponse,
  CVERefetchResult,
  CVESourceDerivedStatusValue,
  CVESourceStatusItem,
  CVESSVCResponse,
  CVSSAssessmentItem,
  CurrentPhaseValue,
  LifecyclePhaseValue,
  PackageDetail,
  PackageStatusValue,
  ProductDetail,
  ProductReasonValue,
  SSVCAutomatable,
  SSVCExploitation,
  SSVCTechnicalImpact,
  TicketAccessGrantResponse,
  TicketDetail,
  TrackDetail,
  UserDirectoryData,
} from "../api/generated/model";
import {
  getListTicketActorsQueryKey,
  getListTicketEventsQueryKey,
  useListTicketActors,
} from "../api/generated/ticket-audit-log";
import {
  getGetTicketQueryKey,
  getListTicketAccessGrantsQueryKey,
  getListTicketsQueryKey,
  useGrantTicketAccess,
  useListTicketAccessGrants,
  useListTickets,
  useRevokeTicketAccess,
} from "../api/generated/tickets";
import { AbsentValue } from "../components/absent-value";
import { Button } from "../components/button";
import { ClampedText } from "../components/clamped-text";
import { ConfidentialMark } from "../components/confidential-mark";
import { FramedTable, type TableColumn } from "../components/data-table";
import { CvssVector } from "../components/cvss-vector";
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
  sectionHeadingId,
  showAnchorTarget,
  SideSection,
} from "../components/detail-screen";
import { DetailsName, DetailsValue } from "../components/details-popover";
import { IconButton } from "../components/icon-button";
import { Label, LabelList } from "../components/label";
import { Link } from "../components/link";
import { Maintainers } from "../components/maintainers";
import {
  MarkedValue,
  ValueMark,
  type MarkedName,
} from "../components/marked-value";
import { Loading, UpdatingBar } from "../components/loading";
import { useShowMessage, type MessageRecord } from "../components/message-area";
import type { MessageTone } from "../components/message";
import {
  ConfirmationDialog,
  DialogErrorMessage,
  FirstFieldFocus,
  ModalDialog,
  type DialogError,
} from "../components/modal-dialog";
import { userOptionText } from "../components/options";
import {
  dataShown,
  marksPlace,
  PartRead,
  type Read,
} from "../components/read-view";
import {
  FocusHandOff,
  focusScreenHeading,
  useFocusHeadingOnRemoval,
} from "../components/screen-heading";
import { Severity } from "../components/severity";
import { Switch } from "../components/switch";
import { TrackDelivery, TrackMilestones } from "../components/track-milestones";
import { displayName, User, type UserFields } from "../components/user";
import { UserComboBox } from "../components/user-combobox";
import { UserGroup } from "../components/user-group";
import { WebLink } from "../components/web-link";
import { sameSearch } from "../search-params";
import { useSignedInUser } from "../session-gate";
import { ticketRoute, useShownTicket } from "./ticket";

// Overview, the first tab of the Ticket screen (docs/screens/ticket.md): the
// CVE, the CVSS assessments, and the package tree of the Ticket in the main
// column, and its details, the sources of its CVE, and its participants in
// the side column, in two columns where the main content is wide enough, and
// otherwise in one, the details first and the sources and the participants
// last (docs/design-system.md, Detail Screens).

// The anchors of the parts that the tab shows, the same on every Ticket,
// although a Ticket without a CVE lacks its CVSS assessments and its
// sources.
const CVE_ANCHOR = "cve";
const PACKAGES_ANCHOR = "packages";
const CVSS_ANCHOR = "cvss";
const DETAILS_ANCHOR = "details";
const SOURCES_ANCHOR = "sources";
const PARTICIPANTS_ANCHOR = "participants";

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

// The read of the details of a CNA, Get CNA, which its popover sends each
// time it opens, so that they follow the CNA as Sentinel describes it then:
// the query goes when the popover closes, and the details are not read again
// while it is open (docs/screens/ticket.md, CVE; Sentinel
// docs/features/tickets/cna.md, Get CNA).
function useCna(orgId: string) {
  return useGetCna(orgId, {
    query: { gcTime: 0, refetchOnWindowFocus: false },
  });
}

interface CnaShortNameProps {
  orgId: string;
  name: string;
}

// The short name of a CNA below the title of its popover, once its details
// arrive, unless it is absent or is the name, as it is while the CNA list of
// the CVE Program has not given the CNA an organization name.
function CnaShortName({ orgId, name }: CnaShortNameProps) {
  const shortName = useCna(orgId).data?.data.short_name ?? null;
  return shortName === null || shortName === name ? null : shortName;
}

interface CnaDetailsProps {
  orgId: string;
}

// The details of a CNA in its popover, as a description list: its types, a
// list of labels as received, since Sentinel does not close their set;
// whether its new Tickets are ignored automatically; and its scope, plain
// text that can run to many lines, last, below its term, cut to four lines
// with Show more (Sentinel docs/features/tickets/cna.md, Response Schemas;
// Flag; Security). While they load, the loading indicator takes their place,
// and when their read fails, the line of the failure of a user card, which a
// status region announces, since the popover holds the focus
// (docs/design-system.md, Menus, Popovers, and Tooltips; docs/behaviors.md,
// Accessibility, Announcements).
function CnaDetails({ orgId }: CnaDetailsProps) {
  const read = useCna(orgId);
  const cna = read.data?.data;
  return (
    <>
      <output className="block">
        {cna === undefined && read.status === "error" && (
          <span className="text-fg-muted">Other details aren't available.</span>
        )}
      </output>
      {cna === undefined ? (
        read.status === "pending" && <Loading inValue />
      ) : (
        <DescriptionList>
          <DescriptionItem term="Types">
            {cna.types.length === 0 ? (
              <AbsentValue />
            ) : (
              <LabelList labels={cna.types} />
            )}
          </DescriptionItem>
          <DescriptionItem term="Auto-ignore">
            {cna.auto_ignore
              ? "Yes, new Tickets are ignored automatically"
              : "No"}
          </DescriptionItem>
          <DescriptionItem term="Scope" stacked>
            {cna.scope === null ? (
              <AbsentValue />
            ) : (
              <ClampedText>{cna.scope}</ClampedText>
            )}
          </DescriptionItem>
        </DescriptionList>
      )}
    </>
  );
}

interface CnaProps {
  cna: CNASummary | null;
}

// The CNA that owns the record of the CVE, by its name, which opens its
// details, with its short name below the title of the popover; never by an
// identifier. A CNA without a name, which Sentinel knows only by its
// identifier, shows "Unnamed CNA" without a popover, and a CVE without a CNA
// an absent value (Sentinel docs/features/tickets/cna.md, Display Name).
function Cna({ cna }: CnaProps) {
  if (cna === null) {
    return <AbsentValue />;
  }
  if (cna.name === null) {
    return <AbsentValue name="Unnamed CNA" />;
  }
  return (
    <DetailsName
      name={cna.name}
      identifier={<CnaShortName orgId={cna.org_id} name={cna.name} />}
    >
      <CnaDetails orgId={cna.org_id} />
    </DetailsName>
  );
}

interface FactsProps {
  cve: CVEDetail;
}

// The dates and the identifiers of the CVE, on one line that wraps: when it
// was published and last modified, and when it was rejected, each with its
// time (docs/behaviors.md, Dates and Times, Display); its CNA; its
// weaknesses; and its external identifiers, such as a GHSA identifier, as
// links to other sites.
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
      <InlineField term="CNA">
        <Cna cna={cve.cna} />
      </InlineField>
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
  // Whether the track that holds the Product is Fixed on a Ticket with a
  // CVE, where a Product that receives the fix, actionable and eligible, and
  // is not released keeps the Ticket from Resolved (Sentinel
  // docs/features/tickets/tickets.md, Gate: Analyzed → Resolved). A Product
  // of a track that is not actionable is not actionable either.
  releaseGates: boolean;
}

// A Product of a track: its name, which opens its details, in fg-muted when
// it is hidden or not eligible, and wraps; user-pen at 14 px in fg-muted when
// its eligibility is set by hand, read as ", eligibility set by hand"; the
// label Not eligible, and the labels of its own hidden state. Its release
// (releaseOf) shows in its details; at the end of its line only when the
// Product keeps the Ticket from Resolved: triangle-alert at 14 px in
// warning-icon, then "Not released", or "Release not observed", in text-13,
// weight 500, warning-on-soft.
function ProductItem({
  product,
  trackHidden,
  fixExpected,
  releaseObserved: observed,
  releaseGates,
}: ProductItemProps) {
  const ref = useRef<HTMLLIElement>(null);
  useFocusHeadingOnRemoval(ref);
  const hidden = trackHidden || !product.actionable;
  const release = releaseOf(product, fixExpected, observed);
  const blocks =
    releaseGates && release !== undefined && release.kind !== "released";
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
      {blocks && (
        <span className="inline-flex items-center gap-1 text-13 font-medium text-warning-on-soft">
          <TriangleAlert
            aria-hidden
            className="size-3.5 shrink-0 text-warning-icon"
          />
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
  // Whether the Ticket has a CVE.
  hasCve: boolean;
  showHidden: boolean;
  now: number;
}

// A track of a package, on one line that wraps, with a border line at its
// left, or, when it waits for the signed-in user, a bar of 3 px in link: its
// reference at weight 500, "Needs your action" when it waits for the user,
// and the label of its own hidden state; then, at the end, the pipeline of its
// phases, when it has work and due dates, which shows the deadlines of the
// track in place of a badge, or else its delivery, and its affectedness, in a
// place at least as wide as Not affected, so that the pipelines and the
// affectedness of the tracks line up. The delivery shows where it is relevant
// (Sentinel docs/features/packages/package-model.md, Delivery Relevance
// Indicator) and either its status is not Pending or the track has work and
// Sentinel observes its submission, which its delivery completes (observes;
// Sentinel docs/features/tickets/ticket-deadlines.md, Completion Evidence);
// with a pipeline, in Phases. Then its Products, as a list with a border line
// at its left. A hidden track shows its hidden Products; another track only
// while "Show hidden" is on.
function TrackItem({
  packageName,
  track,
  packageHidden,
  waitsForYou,
  hasCve,
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
        <span className="ms-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-14">
          {pipeline ? (
            <TrackMilestones
              track={track}
              subject={`${packageName}, ${track.reference}`}
              now={now}
              delivery={delivery ? track.delivery_status : undefined}
            />
          ) : (
            delivery && <TrackDelivery status={track.delivery_status} />
          )}
          <span className="min-w-26">
            <MarkedValue value={track.status} known={AFFECTEDNESS} />
          </span>
        </span>
      </div>
      {products.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5 border-s border-border ps-3 text-14">
          {products.map((product) => (
            <ProductItem
              key={product.id}
              product={product}
              trackHidden={hidden}
              fixExpected={expectsFix(track)}
              releaseGates={hasCve && track.status === "fixed"}
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
  // Whether the Ticket has a CVE.
  hasCve: boolean;
  showHidden: boolean;
  now: number;
}

// A package as a group under a band (docs/design-system.md, Detail Screens):
// the band, on neutral-soft, at least 32 px high, with a 6 px radius and
// 12 px of side padding, holds its name as a level-three heading in text-15,
// weight 600, which wraps, its maintainers, and the label of its own hidden
// state; its tracks follow 12 px below the band, indented by 12 px, 12 px
// apart. A hidden package shows its hidden tracks; another package only
// while "Show hidden" is on.
function PackageGroup({
  ticketPackage,
  waiting,
  hasCve,
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
        <ul className="ms-3 mt-3 flex flex-col gap-3 text-15">
          {tracks.map((track) => (
            <TrackItem
              key={track.id}
              packageName={ticketPackage.package_name}
              track={track}
              packageHidden={hidden}
              waitsForYou={waiting.has(
                trackKey(ticketPackage.package_name, track.reference),
              )}
              hasCve={hasCve}
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
                hasCve={ticket.cve !== null}
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

// A severity followed by the score that gives it in parentheses, such as
// "High (8.1)".
function ScoredSeverity({ severity, score }: ScoredSeverityProps) {
  return (
    <>
      <Severity severity={severity} /> (<Score value={score} />)
    </>
  );
}

interface BaseScoreProps {
  score: number;
  // The severity of the assessment, or null where it is left out.
  severity: string | null;
}

// The score of an assessment, then its severity, such as "7.8 High". The
// score ends a place as wide as "10.0", the widest score, so that the
// severities of the rows of a column align.
function BaseScore({ score, severity }: BaseScoreProps) {
  return (
    <span className="whitespace-nowrap">
      <span className="inline-block min-w-[4ch] text-end tabular-nums">
        {SCORE.format(score)}
      </span>
      {severity !== null && (
        <>
          {" "}
          <Severity severity={severity} />
        </>
      )}
    </span>
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

// A metric of a vector in words: the name that Sentinel gives the metric,
// without what the term of its group says, and its value.
interface Metric {
  name: string;
  value: string;
}

// A metric and its value, which shows in sentence case, such as
// adjacent_network as "Adjacent network", or as received when the pinned
// contract does not list it among the values of the metric
// (docs/behaviors.md, Domain Terms; Unknown Values).
function metricInWords(
  name: string,
  value: string,
  values: Readonly<Record<string, string>>,
): Metric {
  if (!new Set(Object.values(values)).has(value)) {
    return { name, value };
  }
  const words = value.replaceAll("_", " ");
  return { name, value: words.charAt(0).toUpperCase() + words.slice(1) };
}

// A group of the metrics of a vector, by the term of the group.
interface MetricGroup {
  term: string;
  metrics: readonly Metric[];
}

// The metrics of an assessment, from metrics of the API, in the groups of
// FIRST's specification of its version, by Sentinel's names of the metrics
// (Sentinel docs/features/tickets/cvss-scoring.md, CVSS v2.0 Base Metrics;
// CVSS v3.0 and v3.1 Base Metrics; CVSS v4.0 Base Metrics). An assessment of
// a version that the pinned contract does not list has none.
function metricGroups(assessment: CVSSAssessmentItem): MetricGroup[] {
  switch (assessment.cvss_version) {
    case "2.0": {
      const metrics = assessment.metrics;
      return [
        {
          term: "Exploitability",
          metrics: [
            metricInWords(
              "Access vector",
              metrics.access_vector,
              CVSS2AccessVector,
            ),
            metricInWords(
              "Access complexity",
              metrics.access_complexity,
              CVSS2AccessComplexity,
            ),
            metricInWords(
              "Authentication",
              metrics.authentication,
              CVSS2Authentication,
            ),
          ],
        },
        {
          term: "Impact",
          metrics: [
            metricInWords(
              "Confidentiality",
              metrics.confidentiality_impact,
              CVSS2Impact,
            ),
            metricInWords("Integrity", metrics.integrity_impact, CVSS2Impact),
            metricInWords(
              "Availability",
              metrics.availability_impact,
              CVSS2Impact,
            ),
          ],
        },
      ];
    }
    case "3.0":
    case "3.1": {
      const metrics = assessment.metrics;
      return [
        {
          term: "Exploitability",
          metrics: [
            metricInWords(
              "Attack vector",
              metrics.attack_vector,
              CVSSAttackVector,
            ),
            metricInWords(
              "Attack complexity",
              metrics.attack_complexity,
              CVSSAttackComplexity,
            ),
            metricInWords(
              "Privileges required",
              metrics.privileges_required,
              CVSSPrivilegesRequired,
            ),
            metricInWords(
              "User interaction",
              metrics.user_interaction,
              CVSS3UserInteraction,
            ),
          ],
        },
        {
          term: "Scope",
          metrics: [metricInWords("Scope", metrics.scope, CVSS3Scope)],
        },
        {
          term: "Impact",
          metrics: [
            metricInWords(
              "Confidentiality",
              metrics.confidentiality_impact,
              CVSSImpact,
            ),
            metricInWords("Integrity", metrics.integrity_impact, CVSSImpact),
            metricInWords(
              "Availability",
              metrics.availability_impact,
              CVSSImpact,
            ),
          ],
        },
      ];
    }
    case "4.0": {
      const metrics = assessment.metrics;
      return [
        {
          term: "Exploitability",
          metrics: [
            metricInWords(
              "Attack vector",
              metrics.attack_vector,
              CVSSAttackVector,
            ),
            metricInWords(
              "Attack complexity",
              metrics.attack_complexity,
              CVSSAttackComplexity,
            ),
            metricInWords(
              "Attack requirements",
              metrics.attack_requirements,
              CVSS4AttackRequirements,
            ),
            metricInWords(
              "Privileges required",
              metrics.privileges_required,
              CVSSPrivilegesRequired,
            ),
            metricInWords(
              "User interaction",
              metrics.user_interaction,
              CVSS4UserInteraction,
            ),
          ],
        },
        {
          term: "Vulnerable system",
          metrics: [
            metricInWords(
              "Confidentiality",
              metrics.vulnerable_system_confidentiality,
              CVSSImpact,
            ),
            metricInWords(
              "Integrity",
              metrics.vulnerable_system_integrity,
              CVSSImpact,
            ),
            metricInWords(
              "Availability",
              metrics.vulnerable_system_availability,
              CVSSImpact,
            ),
          ],
        },
        {
          term: "Subsequent system",
          metrics: [
            metricInWords(
              "Confidentiality",
              metrics.subsequent_system_confidentiality,
              CVSSImpact,
            ),
            metricInWords(
              "Integrity",
              metrics.subsequent_system_integrity,
              CVSSImpact,
            ),
            metricInWords(
              "Availability",
              metrics.subsequent_system_availability,
              CVSSImpact,
            ),
          ],
        },
      ];
    }
    default:
      return [];
  }
}

// The paths of the calculators of FIRST, by the version that each
// calculates: FIRST has none for v2.0.
const CALCULATORS = new Map<string, string>([
  ["3.0", "3.0"],
  ["3.1", "3.1"],
  ["4.0", "4.0"],
]);

// The calculator of FIRST for the vector of an assessment, composed with the
// fixed origin https://www.first.org and the vector as its fragment, encoded
// as the URL parser encodes a fragment, which keeps its ":" and "/": the
// calculator reads the vector from the fragment as it is, without decoding it
// (docs/screens/ticket.md, CVSS assessments; docs/conventions.md, Links from
// the API). Undefined for a version without a calculator.
function firstCalculator(assessment: CVSSAssessmentItem): string | undefined {
  const path = CALCULATORS.get(assessment.cvss_version);
  if (path === undefined) {
    return undefined;
  }
  const address = new URL(`https://www.first.org/cvss/calculator/${path}`);
  address.hash = assessment.vector_string;
  return address.href;
}

interface VectorMetricsProps {
  assessment: CVSSAssessmentItem;
}

// The vector of an assessment as a value that opens a popover with its
// metrics (docs/design-system.md, Menus, Popovers, and Tooltips): its title
// the provider and the version, such as "NVD CVSS v3.1", the vector below it,
// its metrics by group, each group a term with its metrics below it, or a
// group of one metric on the line of its term, such as Scope, and, for a
// version with a calculator of FIRST, the link to it.
function VectorMetrics({ assessment }: VectorMetricsProps) {
  const calculator = firstCalculator(assessment);
  return (
    <DetailsValue
      value={<CvssVector value={assessment.vector_string} />}
      title={`${assessment.provider_name} CVSS ${cvssVersion(assessment.cvss_version)}`}
      link={
        calculator === undefined ? undefined : (
          <WebLink address={calculator}>Open in the FIRST calculator</WebLink>
        )
      }
    >
      <DescriptionList fittedTerms>
        {metricGroups(assessment).map(({ term, metrics }) => {
          const [only] = metrics;
          return metrics.length === 1 && only !== undefined ? (
            <DescriptionItem key={term} term={term}>
              {only.value}
            </DescriptionItem>
          ) : (
            <DescriptionGroup key={term} term={term}>
              {metrics.map(({ name, value }) => (
                <GroupedItem key={name} term={name}>
                  {value}
                </GroupedItem>
              ))}
            </DescriptionGroup>
          );
        })}
      </DescriptionList>
    </DetailsValue>
  );
}

// The columns of the table of the assessments: the provider and the version,
// which name the assessment; its Base score, then its severity by the scale
// of its version, which is not the resolved severity; and its vector, which
// opens its metrics. The texts wrap, as in a table whose records have no
// screen of their own (docs/design-system.md, Tables). Of an assessment of a
// version that the pinned contract does not list, the severity, whose scale
// depends on the version, is left out, and its score shows alone, and its
// vector shows as text, without its metrics (docs/behaviors.md, Unknown
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
    id: "score",
    name: "Base score",
    render: (assessment) => (
      <BaseScore
        score={assessment.score}
        severity={
          CVSS_VERSIONS.has(assessment.cvss_version)
            ? assessment.severity
            : null
        }
      />
    ),
  },
  {
    id: "vector",
    name: "Vector",
    wraps: true,
    render: (assessment) =>
      CVSS_VERSIONS.has(assessment.cvss_version) ? (
        <VectorMetrics assessment={assessment} />
      ) : (
        <CvssVector value={assessment.vector_string} />
      ),
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
// Failure red, Missing a hollow circle, as an attempt that found nothing,
// Pending blue, turning, as an operation that the screen follows by reading
// it again, and Not attempted with a dashed circle, as an observation never
// made (docs/design-system.md, Other Values; Sentinel
// docs/features/tickets/cve-service.md, CVE Source Status, Status values).
const SOURCE_STATUSES = new Map<string, MarkedName>(
  Object.entries({
    success: { name: "Success", tone: "success" },
    failure: { name: "Failure", tone: "danger" },
    missing: { name: "Missing", tone: "neutral", mark: "empty" },
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

// Whether Refetch of the source is offered: it can be refetched, and its
// status is neither Pending, whose fetch is in progress, nor one that the
// pinned contract does not list (docs/behaviors.md, Unknown Values).
function offersRefetch(source: CVESourceStatusItem): boolean {
  return (
    canRefetch(source) &&
    source.status !== "pending" &&
    SOURCE_STATUSES.has(source.status)
  );
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
// maintainer on it, the CVSS assessments of its CVE, the users who acted on
// it, and its access grants, with the sources of its CVE where asked: the
// reads of the tab that the anchor of the URL waits for (TicketOverview),
// and the Ticket, so that a read added to the tab is added to both. A read
// that the tab does not send, such as the duplicates of a duplicate or the
// access grants of a Ticket that is not confidential, is not sent.
function useReadAgain(ticketId: string, cveId: string) {
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

// Refetch of one source, an icon button of 24 px named after the source, such
// as "Refetch NVD", in the place of the mark of its status, which it takes
// while the pointer is over the line of the source, until Escape brings the
// mark back while the pointer stays there (WCAG 2.2, 1.4.13 Content on Hover
// or Focus), while it has the focus, and while it is busy. Otherwise it is
// transparent, but stays in the order of the focus and for assistive
// technologies; until the pointer shows it, a press does not reach it, so
// that a tap of a touch screen, which shows nothing on hover, does not start
// a refetch that it cannot see. A press of the pointer leaves the focus where
// it was, so that the button, which the read after the refetch removes as
// the source turns Pending, does not send the focus to the screen's heading.
// When a new read removes it while it has the focus from the keyboard, the
// focus moves there (docs/behaviors.md, Accessibility, Focus after an
// action).
function RefetchSource({
  mark,
  ...target
}: RefetchTarget & { source: string; mark: ReactNode }) {
  const refetch = useRefetch(target);
  const place = useRef<HTMLDivElement>(null);
  // Whether Escape brought the mark back while the pointer is over the line.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const line = place.current?.closest("li");
    if (line == null) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && line.matches(":hover")) {
        setDismissed(true);
      }
    };
    const onPointerLeave = () => {
      setDismissed(false);
    };
    document.addEventListener("keydown", onKeyDown);
    line.addEventListener("pointerleave", onPointerLeave);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      line.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);
  let markClass = "group-focus-within:opacity-0 group-hover:opacity-0";
  let buttonClass =
    "pointer-events-none opacity-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100";
  if (refetch.busy) {
    markClass = "opacity-0";
    buttonClass = "";
  } else if (dismissed) {
    markClass = "group-focus-within:opacity-0";
    // The button that has the focus still shows, and the pointer reaches it.
    buttonClass =
      "pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100";
  }
  return (
    <>
      <span className={`flex ${markClass}`}>{mark}</span>
      <div ref={place} className={`absolute inset-0 flex ${buttonClass}`}>
        <FocusHandOff>
          <IconButton
            label={`Refetch ${sourceName(target.source)}`}
            icon={RefreshCw}
            size="inline"
            isBusy={refetch.busy}
            preventFocusOnPress
            onPress={refetch.start}
          />
        </FocusHandOff>
      </div>
    </>
  );
}

// Refetch of every source that can be refetched, a quiet button in the
// heading of the section, busy while its refetch is in progress.
function RefetchAll(target: RefetchTarget) {
  const refetch = useRefetch(target);
  return (
    <FocusHandOff>
      <Button
        variant="quiet"
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
  // The refetch of the source, for a user who can take it.
  refetch: (RefetchTarget & { source: string }) | undefined;
}

// A source of the CVE, as a list item (docs/design-system.md, Other Values):
// the mark of its status alone, in a place of 24 px, or Refetch in its place;
// 8 px later its name, followed for assistive technologies by the name of
// its status; at the end of its first line, the label Disabled of a source
// that is disabled, or Retired of one that is no longer registered; below
// them, across the width of the line, in text-13 and fg-muted, the date and
// time of its last completed attempt, or of the last change of the evidence
// of CISA KEV, or an absent value, and the start of its failure streak
// (Sentinel docs/features/tickets/cve-service.md, CVE Source Status).
function SourceItem({ source, refetch }: SourceItemProps) {
  const kevEvidence = source.source === "kev" && source.status === "success";
  const mark = <ValueMark value={source.status} known={SOURCE_STATUSES} />;
  return (
    <li className="group flex items-start gap-2">
      <div className="relative flex size-6 shrink-0 items-center justify-center">
        {refetch === undefined ? (
          mark
        ) : (
          <RefetchSource {...refetch} mark={mark} />
        )}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 wrap-break-word">
            <span className="font-medium">{sourceName(source.source)}</span>
            <span className="sr-only"> {statusName(source.status)}</span>
          </p>
          {(!source.registered || !source.enabled) && (
            <Label>{source.registered ? "Disabled" : "Retired"}</Label>
          )}
        </div>
        <p className="text-13 text-fg-muted">
          {kevEvidence ? "Updated" : "Last attempt"}{" "}
          {source.fetched_at === null ? (
            <AbsentValue />
          ) : (
            <DateTime value={source.fetched_at} />
          )}
        </p>
        {source.first_failed_at !== null && (
          <p className="text-13 text-fg-muted">
            Failing since <DateTime value={source.first_failed_at} />
          </p>
        )}
      </div>
    </li>
  );
}

interface SourcesSectionProps {
  ticketId: string;
  cveId: string;
  read: SourcesRead;
}

// The sources of the CVE of the Ticket, a section of the side column before
// the participants, from CVE Source Status, in the order of the API, by
// source, a source of the CVE per line (Sentinel
// docs/features/tickets/cve-service.md, CVE Source Status), or "No sources." without any. With triage_ticket, Refetch
// of each source that offers it, and Refetch all while a source can be
// refetched (docs/screen-map.md, Roles, Principles). The section reads them on its
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
            <ul className="flex flex-col gap-1 text-14">
              {data.map((source) => (
                <SourceItem
                  key={source.source}
                  source={source}
                  refetch={
                    triage && offersRefetch(source)
                      ? {
                          ticketId,
                          cveId,
                          source: source.source,
                          readAgain,
                        }
                      : undefined
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
// Participants

// The order of the display names of the participants.
const NAME_ORDER = new Intl.Collator("en-US");

// The participants of a Ticket (docs/screens/ticket.md, Participants): its
// assignee, the users who acted on it, the maintainers of its packages that
// are not excluded, and the users with an access grant, each once, without
// the bot accounts. The assignee comes first, then the others by display
// name, and by username between equal names. An inactive user is a
// participant.
export function participantsOf(
  ticket: TicketDetail,
  actors: readonly UserFields[],
  grants: readonly TicketAccessGrantResponse[],
): UserFields[] {
  const users = new Map<string, UserFields>();
  const add = (user: UserFields) => {
    if (!user.bot && !users.has(user.id)) {
      users.set(user.id, user);
    }
  };
  const { assignee } = ticket;
  if (assignee !== null) {
    add(assignee);
  }
  for (const actor of actors) {
    add(actor);
  }
  for (const pkg of ticket.packages) {
    if (pkg.deleted_at === null) {
      for (const maintainer of pkg.maintainers) {
        add(maintainer);
      }
    }
  }
  for (const grant of grants) {
    add(grant.user);
  }
  const others = [...users.values()]
    .filter((user) => user.id !== assignee?.id)
    .toSorted(
      (a, b) =>
        NAME_ORDER.compare(displayName(a), displayName(b)) ||
        NAME_ORDER.compare(a.username, b.username),
    );
  const first = assignee === null ? undefined : users.get(assignee.id);
  return first === undefined ? others : [first, ...others];
}

// The reads of the participants: the users who acted on the Ticket, from
// List Ticket Actors, and, for a confidential Ticket, its access grants, from
// List Access Grants, which every user who can see the Ticket reads (Sentinel
// docs/features/tickets/ticket-audit-log.md, List Ticket Actors; Sentinel
// docs/features/tickets/tickets.md, List Access Grants). A Ticket that is no
// longer confidential, which Sentinel answers with 409
// TICKET_NOT_CONFIDENTIAL, has no grants, and the screen reads the Ticket
// again.
function useParticipantReads(ticket: TicketDetail) {
  const client = useQueryClient();
  const ticketId = ticket.ticket_id;
  const actors = useListTicketActors(ticketId);
  const grants = useListTicketAccessGrants(ticketId, {
    query: { enabled: ticket.is_confidential },
  });
  const notConfidential =
    grants.status === "error" && isNotConfidential(grants.error);
  useEffect(() => {
    if (notConfidential) {
      void client.invalidateQueries({
        queryKey: getGetTicketQueryKey(ticketId),
      });
    }
  }, [client, ticketId, notConfidential]);
  return {
    actors,
    grants,
    // Whether the Ticket has access grants to show.
    confidential: ticket.is_confidential && !notConfidential,
  };
}

type ParticipantReads = ReturnType<typeof useParticipantReads>;

// The participants as one read, which has its data once both reads have
// theirs, and fails when either fails.
function participantsRead(
  ticket: TicketDetail,
  { actors, grants, confidential }: ParticipantReads,
): Read<UserFields[]> {
  const reads: Read<unknown>[] = confidential ? [actors, grants] : [actors];
  const failed = reads.find((read) => read.status === "error");
  const grantsData = confidential ? grants.data?.data : [];
  const data =
    actors.data === undefined || grantsData === undefined
      ? undefined
      : participantsOf(ticket, actors.data.data, grantsData);
  let status: Read<unknown>["status"] = "success";
  if (failed !== undefined) {
    status = "error";
  } else if (data === undefined) {
    status = "pending";
  }
  return {
    data,
    error: failed?.error ?? null,
    status,
    isPlaceholderData: false,
    isFetching: reads.some((read) => read.isFetching),
    refetch: () => {
      for (const read of reads) {
        if (read.status === "error") {
          void read.refetch();
        }
      }
    },
  };
}

// Reads again what a change of the access grants of the Ticket affects: the
// Ticket, its access grants, the users who acted on it, and its audit log
// (docs/behaviors.md, Outcome of a Change).
function useReadAfterAccessChange(ticketId: string) {
  const client = useQueryClient();
  return useCallback(() => {
    for (const queryKey of [
      getGetTicketQueryKey(ticketId),
      getListTicketAccessGrantsQueryKey(ticketId),
      getListTicketActorsQueryKey(ticketId),
      getListTicketEventsQueryKey(ticketId),
    ]) {
      void client.invalidateQueries({ queryKey });
    }
  }, [client, ticketId]);
}

// The announcement of the outcome of a change in the dialog of the access
// grants, with a key that changes with each, so that the same text is
// announced again.
interface Announcement {
  key: number;
  text: string;
}

// The consequence of a grant, which the dialog states.
const GRANTS_TEXT =
  "An access grant lets a user see this confidential Ticket. The users who see every Ticket, and the maintainers of its packages that are not excluded, see it without one.";

// What the dialog says of a Ticket that is no longer confidential, which has
// no access grants (Sentinel docs/features/tickets/tickets.md, Set
// Confidentiality).
const NOT_CONFIDENTIAL_TEXT =
  "This Ticket is no longer confidential, so it has no access grants.";

// The label of a user whom the user field lists but does not offer, since
// the user holds a grant already.
const GRANTED = "Granted";

interface GrantAccessFormProps {
  ticketId: string;
  // The users who hold a grant, whom the field does not offer.
  granted: ReadonlySet<string>;
  // Tells whether the grant is in progress, during which the dialog cannot
  // be closed.
  onBusyChange: (busy: boolean) => void;
  // Tells whether the field holds a user chosen and not yet granted, which
  // closing the dialog would discard.
  onInputChange: (chosen: boolean) => void;
  readAgain: () => void;
  announce: (text: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

// Grant access, Grant Access, POST /api/v1/tickets/{ticket_id}/access, for a
// user who holds manage_confidentiality (Sentinel
// docs/features/tickets/tickets.md, Grant Access): a form at most 448 px
// wide, the user field, which takes the focus as the dialog opens, then
// Grant access, a primary button at the end of the form
// (docs/design-system.md, Forms). Without a user, Grant access says "Choose
// a user." at the field. The grant asks for no confirmation: it ends no
// one's access. It is busy while its request is in progress. Once Sentinel
// confirms it, the field empties, the focus stays where it was, on Grant
// access or in the field, and the dialog announces it, such as "Access
// granted to Carol White.". The errors of the user field, 404
// USER_NOT_FOUND, 409 USER_INACTIVE, and a field error of a
// VALIDATION_ERROR, show at the field, which takes the focus; every other
// error at the top of the form, which takes it, as a warning when Sentinel
// did not confirm the change (docs/behaviors.md, Where Errors Appear;
// Retries and Unconfirmed Changes). Whatever its outcome, the screen then
// reads again what it affects.
function GrantAccessForm({
  ticketId,
  granted,
  onBusyChange,
  onInputChange,
  readAgain,
  announce,
  inputRef,
}: GrantAccessFormProps) {
  const grant = useGrantTicketAccess({ mutation: { gcTime: 0 } });
  const [user, setUser] = useState<UserDirectoryData | null>(null);
  // A new field after each grant, which empties it, and whether the new
  // field takes the focus, as the field that it replaces had it.
  const [fieldKey, setFieldKey] = useState(0);
  const refocus = useRef(false);
  const [busy, setBusy] = useState(false);
  // The error of the field and of the form, a new object for each failure,
  // so that each shows again.
  const [fieldError, setFieldError] = useState<{ user: string }>();
  const [formError, setFormError] = useState<DialogError>();
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  useEffect(() => {
    if (fieldError !== undefined) {
      inputRef.current?.focus();
    }
  }, [fieldError, inputRef]);
  useLayoutEffect(() => {
    if (refocus.current) {
      refocus.current = false;
      inputRef.current?.focus();
    }
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- each new field is the event that the effect follows
  }, [fieldKey, inputRef]);
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }

  const choose = (chosen: UserDirectoryData | null) => {
    setUser(chosen);
    onInputChange(chosen !== null);
  };

  const fail = (error: unknown) => {
    if (!isRequestFailure(error)) {
      setUiFailure({ error });
      return;
    }
    const atField =
      grantAccessFieldError(error) ??
      (validationErrorFields(error, ["user"] as const).fields.length > 0
        ? MESSAGE_INVALID_VALUE
        : undefined);
    if (atField !== undefined) {
      setFieldError({ user: atField });
      return;
    }
    const presentation = presentChangeFailure(error);
    if (presentation !== undefined) {
      setFormError({
        message: presentation.message,
        reference: presentation.reference,
        unconfirmed: presentation.unconfirmed,
      });
    }
  };

  const submit = async () => {
    if (busy) {
      return;
    }
    setFormError(undefined);
    if (user === null) {
      setFieldError({ user: "Choose a user." });
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    onBusyChange(true);
    try {
      const response = await grant.mutateAsync({
        ticketId,
        data: { user: user.id },
      });
      choose(null);
      refocus.current = document.activeElement === inputRef.current;
      setFieldKey((key) => key + 1);
      announce(`Access granted to ${displayName(response.data.user)}.`);
    } catch (error) {
      fail(error);
    }
    setBusy(false);
    onBusyChange(false);
    readAgain();
  };

  return (
    <Form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void submit();
      }}
      validationErrors={fieldError}
      aria-label="Grant access"
      className="flex max-w-112 flex-col gap-3"
    >
      {formError !== undefined && <DialogErrorMessage error={formError} />}
      <UserComboBox
        key={fieldKey}
        label="User"
        name="user"
        value={user}
        onChange={(chosen) => {
          choose(chosen);
          setFieldError(undefined);
        }}
        onInput={() => {
          setFieldError(undefined);
        }}
        unavailable={{ ids: granted, label: GRANTED }}
        inputRef={inputRef}
      />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="large" isBusy={busy}>
          Grant access
        </Button>
      </div>
    </Form>
  );
}

interface GrantItemProps {
  ticketId: string;
  grant: TicketAccessGrantResponse;
  // Revoke access, for a user who holds manage_confidentiality, or
  // undefined.
  revoke:
    | {
        readAgain: () => void;
        // Tells that Revoke access takes the focus.
        onFocus: () => void;
        // Tells that Sentinel revoked the grant, with the announcement of
        // the revocation.
        onRevoked: (text: string) => void;
      }
    | undefined;
}

// An access grant: its user in the full form at the medium size with the
// username, and below it, in text-13, fg-muted, who granted it and when, the
// user in the name form without the username, such as "Granted by Alice
// Smith on 8 Nov 2026, 13:05" (docs/behaviors.md, Representation of a
// User). With manage_confidentiality, Revoke access at its end, or below the
// user where the line is too narrow, Revoke Access,
// DELETE /api/v1/tickets/{ticket_id}/access/{user}, named after the user,
// such as "Revoke access of Carol White @cwhite", which asks for
// confirmation, as it ends another person's access (docs/behaviors.md,
// Confirmation; Sentinel docs/features/tickets/tickets.md, Revoke Access).
// Its error shows at the top of the confirmation, which stays open; once
// Sentinel confirms it, the confirmation closes. Whatever its outcome, the
// screen then reads again what it affects.
function GrantItem({ ticketId, grant, revoke }: GrantItemProps) {
  const name = displayName(grant.user);
  const mutation = useRevokeTicketAccess({ mutation: { gcTime: 0 } });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<DialogError>();
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }
  const confirm = async () => {
    if (revoke === undefined) {
      return;
    }
    setError(undefined);
    try {
      await mutation.mutateAsync({ ticketId, user: grant.user.id });
      setConfirming(false);
      revoke.onRevoked(`Access of ${name} revoked.`);
    } catch (failure) {
      if (!isRequestFailure(failure)) {
        setUiFailure({ error: failure });
        return;
      }
      const presentation = presentChangeFailure(failure);
      if (presentation !== undefined) {
        setError({
          message: presentation.message,
          reference: presentation.reference,
          unconfirmed: presentation.unconfirmed,
        });
      }
    }
    revoke.readAgain();
  };
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 py-2">
      <div className="min-w-0 flex-1 basis-48">
        <div className="flex min-w-0">
          <User user={grant.user} size="medium" withUsername />
        </div>
        <p className="mt-0.5 text-13 text-fg-muted">
          Granted by <User user={grant.granted_by} withAvatar={false} /> on{" "}
          <DateTime value={grant.granted_at} />
        </p>
      </div>
      {revoke !== undefined && (
        <>
          <Button
            size="large"
            aria-label={`Revoke access of ${userOptionText(grant.user)}`}
            onFocus={revoke.onFocus}
            onPress={() => {
              setError(undefined);
              setConfirming(true);
            }}
          >
            Revoke access
          </Button>
          <ConfirmationDialog
            isOpen={confirming}
            onCancel={() => {
              setConfirming(false);
            }}
            title={`Revoke access of ${name}?`}
            action="Revoke access"
            onConfirm={() => {
              void confirm();
            }}
            isBusy={mutation.isPending}
            error={error}
          >
            {`${name} loses the access grant to this confidential Ticket, and no longer sees it unless their roles or the packages that they maintain let them.`}
          </ConfirmationDialog>
        </>
      )}
    </li>
  );
}

// The grant whose line last held the focus, with its place in the list.
interface FocusedGrant {
  id: string;
  index: number;
}

interface AccessGrantsDialogProps {
  ticketId: string;
  read: ParticipantReads["grants"];
  // Whether the Ticket is still confidential, as the screen last read it.
  confidential: boolean;
  // Whether the user holds manage_confidentiality, as they did when the
  // dialog opened, with which they grant and revoke access.
  manages: boolean;
  isOpen: boolean;
  onClose: () => void;
}

// The access grants of a confidential Ticket, in a dialog at most 560 px
// wide (docs/design-system.md, Dialogs), "Access grants": what a grant does;
// for a user who holds manage_confidentiality, the form of Grant access,
// whose field takes the focus as the dialog opens, which otherwise takes it
// itself, so that its content is read first; then the grants, from List
// Access Grants, in its order, by the time of the grant, as a list whose
// items a border line parts, or "No access grants.", which load and fail as
// a part does; and Close, which closes it, as Escape does, except while a
// grant is in progress. While the field holds a user chosen and not yet
// granted, Close and Escape ask "Discard changes?" first
// (docs/behaviors.md, Confirmation). The outcome of a grant or a revocation
// is announced in a status region of the dialog, which the rest of the page
// cannot hold while the dialog is open. When a grant whose line holds the
// focus leaves the list, as after its Revoke access, the focus moves to the
// Revoke access of the grant that followed it, or to the user field when
// none follows (docs/behaviors.md, Accessibility, Focus after an action). A
// Ticket that is no longer confidential keeps the dialog open, which then
// says so in place of its form and its grants, and takes the focus.
function AccessGrantsDialog({
  ticketId,
  read,
  confidential,
  manages,
  isOpen,
  onClose,
}: AccessGrantsDialogProps) {
  const readAgain = useReadAfterAccessChange(ticketId);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement>();
  const announce = useCallback((text: string) => {
    setAnnouncement((current) => ({ key: (current?.key ?? 0) + 1, text }));
  }, []);
  const content = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const focused = useRef<FocusedGrant>(undefined);
  // The announcement of a revocation, which the dialog makes once a read of
  // the grants after it arrives, when the confirmation has closed, so that
  // the confirmation, which hides the rest of the page, does not hide it.
  const revoked = useRef<{ text: string; at: number }>(undefined);
  const grants = dataShown(read)?.data;
  const readAt = read.dataUpdatedAt;
  const failedAt = read.errorUpdatedAt;
  // The announcement of a revocation waits for the first read of the grants
  // after it, whatever its outcome. The focus moves in the same commit in
  // which the grant leaves the list, so that it does not fall to the page
  // meanwhile.
  useLayoutEffect(() => {
    const done = revoked.current;
    if (done !== undefined && (readAt >= done.at || failedAt >= done.at)) {
      revoked.current = undefined;
      announce(done.text);
    }
    if (grants === undefined) {
      return;
    }
    const line = focused.current;
    const active = document.activeElement;
    if (
      line === undefined ||
      grants.some((grant) => grant.user.id === line.id) ||
      (active !== null &&
        active !== document.body &&
        content.current?.closest('[role="dialog"]')?.contains(active) === true)
    ) {
      return;
    }
    focused.current = undefined;
    const next = list.current
      ?.querySelectorAll(":scope > li")
      .item(line.index)
      ?.querySelector("button");
    (next ?? field.current)?.focus();
  }, [grants, readAt, failedAt, announce]);
  // A Ticket found no longer confidential while the dialog is open: the
  // dialog takes the focus, which its form or its grants may have held, and
  // its status region announces the line that says so.
  // React Aria moves the focus out of a confirmation that leaves the page, as
  // the form and the grants do, in the next frame, so the dialog takes it
  // after that.
  useLayoutEffect(() => {
    if (!isOpen || confidential) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      content.current
        ?.closest<HTMLElement>('[role="dialog"]')
        ?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [isOpen, confidential]);
  const granted = new Set((grants ?? []).map((grant) => grant.user.id));
  // Closes the dialog, whose form leaves with what it holds.
  const finish = () => {
    setChosen(false);
    onClose();
  };
  const close = () => {
    if (chosen && confidential) {
      setDiscarding(true);
    } else {
      finish();
    }
  };
  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={close}
      width="form"
      title="Access grants"
      closable={!busy}
      buttons={
        <>
          <Button size="large" isDisabled={busy} onPress={close}>
            Close
          </Button>
          <ConfirmationDialog
            isOpen={discarding}
            onCancel={() => {
              setDiscarding(false);
            }}
            title="Discard changes?"
            action="Discard"
            cancelLabel="Keep editing"
            onConfirm={() => {
              setDiscarding(false);
              finish();
            }}
            isBusy={false}
            error={undefined}
          >
            The user that you chose isn't granted access.
          </ConfirmationDialog>
        </>
      }
    >
      <div ref={content}>
        {confidential ? (
          <>
            <p className="text-fg-muted">{GRANTS_TEXT}</p>
            {manages && (
              <div className="mt-4">
                <FirstFieldFocus>
                  <GrantAccessForm
                    ticketId={ticketId}
                    granted={granted}
                    onBusyChange={setBusy}
                    onInputChange={setChosen}
                    readAgain={readAgain}
                    announce={announce}
                    inputRef={field}
                  />
                </FirstFieldFocus>
              </div>
            )}
            <div className="mt-4">
              <PartRead read={read}>
                {({ data }) =>
                  data.length === 0 ? (
                    <p className="text-14 text-fg-muted">No access grants.</p>
                  ) : (
                    <ul
                      ref={list}
                      aria-label="Access grants"
                      className="divide-y divide-border border-y border-border"
                    >
                      {data.map((grant, index) => (
                        <GrantItem
                          key={grant.user.id}
                          ticketId={ticketId}
                          grant={grant}
                          revoke={
                            manages
                              ? {
                                  readAgain,
                                  onFocus: () => {
                                    focused.current = {
                                      id: grant.user.id,
                                      index,
                                    };
                                  },
                                  onRevoked: (text) => {
                                    revoked.current = {
                                      text,
                                      at: Date.now(),
                                    };
                                  },
                                }
                              : undefined
                          }
                        />
                      ))}
                    </ul>
                  )
                }
              </PartRead>
            </div>
          </>
        ) : null}
        <output className="block">
          {!confidential && (
            <p className="text-fg-muted">{NOT_CONFIDENTIAL_TEXT}</p>
          )}
        </output>
      </div>
      <output className="sr-only">
        <span key={announcement?.key}>{announcement?.text}</span>
      </output>
    </ModalDialog>
  );
}

interface ParticipantsSectionProps {
  ticket: TicketDetail;
  reads: ParticipantReads;
}

// The participants of the Ticket, the last section of the side column
// (docs/screens/ticket.md, Participants), as a group of users named by the
// heading of the section (docs/design-system.md, Representation of a User),
// or "No participants." without any. Its reads load and fail in its place
// (docs/behaviors.md, Loading; Where Errors Appear). On a confidential
// Ticket, Access grants, a quiet button with user-round-key at the end of
// the heading, which opens the access grants for every user who can see
// the Ticket; granting and revoking them need manage_confidentiality
// (docs/screen-map.md, Roles, Principles), as the user holds it when the
// dialog opens, so that what the dialog offers, and the error of a change
// that Sentinel refuses, stay while it is open. When a read removes Access
// grants while it has the focus, the focus moves to the screen's heading;
// when the dialog closes without Access grants, it does too
// (docs/behaviors.md, Accessibility, Focus after an action).
function ParticipantsSection({ ticket, reads }: ParticipantsSectionProps) {
  const user = useSignedInUser();
  const manages =
    user?.capabilities.includes("manage_confidentiality") === true;
  // The dialog while it is open, with whether it offers the changes.
  const [opened, setOpened] = useState<{ manages: boolean }>();
  return (
    <SideSection
      id={PARTICIPANTS_ANCHOR}
      heading="Participants"
      actions={
        reads.confidential ? (
          <FocusHandOff>
            <Button
              variant="quiet"
              size="small"
              icon={UserRoundKey}
              onPress={() => {
                setOpened({ manages });
              }}
            >
              Access grants
            </Button>
          </FocusHandOff>
        ) : undefined
      }
    >
      <PartRead read={participantsRead(ticket, reads)}>
        {(users) =>
          users.length === 0 ? (
            <p className="text-14 text-fg-muted">No participants.</p>
          ) : (
            <UserGroup
              users={users}
              labelledBy={sectionHeadingId(PARTICIPANTS_ANCHOR)}
            />
          )
        }
      </PartRead>
      {(reads.confidential || opened !== undefined) && (
        <AccessGrantsDialog
          ticketId={ticket.ticket_id}
          read={reads.grants}
          confidential={reads.confidential}
          manages={opened?.manages ?? manages}
          isOpen={opened !== undefined}
          onClose={() => {
            setOpened(undefined);
            if (!reads.confidential) {
              queueMicrotask(focusScreenHeading);
            }
          }}
        />
      )}
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
  const participants = useParticipantReads(ticket);
  // The reads of the tab, which useReadAgain reads again too.
  useAnchorTarget([
    duplicates,
    yourWork.read,
    cvss,
    sources,
    participants.actors,
    participants.grants,
  ]);
  return (
    <DetailColumns
      twoColumns={twoColumns}
      leadingSections={
        <Details ticket={ticket} now={now} duplicates={duplicates} />
      }
      trailingSections={
        <>
          {ticket.cve !== null && (
            <SourcesSection
              ticketId={ticket.ticket_id}
              cveId={ticket.cve.cve_id}
              read={sources}
            />
          )}
          <ParticipantsSection ticket={ticket} reads={participants} />
        </>
      }
      parts={
        <>
          <CvePart cve={ticket.cve} />
          {ticket.cve !== null && <CvssPart read={cvss} />}
          <PackagesPart ticket={ticket} now={now} yourWork={yourWork} />
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
