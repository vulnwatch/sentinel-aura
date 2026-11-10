import {
  createRoute,
  linkOptions,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { ClockAlert } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type {
  CVEDetail,
  CVEEPSSResponse,
  CVESSVCResponse,
  CurrentPhaseValue,
  SSVCAutomatable,
  SSVCExploitation,
  SSVCTechnicalImpact,
  TicketDetail,
} from "../api/generated/model";
import { useListTickets } from "../api/generated/tickets";
import { AbsentValue } from "../components/absent-value";
import { ClampedText } from "../components/clamped-text";
import { ConfidentialMark } from "../components/confidential-mark";
import { CalendarDate, DateTime } from "../components/date-time";
import { dueState } from "../components/deadline-badge";
import {
  DescriptionGroup,
  DescriptionItem,
  DescriptionList,
  GroupedItem,
} from "../components/description-list";
import { DetailColumns, Part, SideSection } from "../components/detail-screen";
import { Label } from "../components/label";
import { Link } from "../components/link";
import { PartRead, type Read } from "../components/read-view";
import { User } from "../components/user";
import { WebLink } from "../components/web-link";
import { sameSearch } from "../search-params";
import { ticketRoute, useShownTicket } from "./ticket";

// Overview, the first tab of the Ticket screen (docs/screens/ticket.md): the
// CVE of the Ticket in the main column, and its details in the side column,
// in two columns where the main content is wide enough, and otherwise in one,
// the details first (docs/design-system.md, Detail Screens).

// The anchors of the parts that the tab shows, which every Ticket has.
const CVE_ANCHOR = "cve";
const DETAILS_ANCHOR = "details";

// The public CVE page of SUSE, a composed address of another site, with its
// fixed origin, which holds the CVE ID encoded in a path segment
// (docs/behaviors.md, Links to Other Sites, Composed addresses).
function suseCvePage(cveId: string): string {
  return `https://www.suse.com/security/cve/${encodeURIComponent(cveId)}.html`;
}

// The largest page of List Tickets (Sentinel docs/api-spec.md, Pagination):
// the details show at most this many duplicates, and how many more there are.
const DUPLICATES_PAGE = 100;

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

// The read of the duplicates of a Ticket that is not a duplicate itself: the
// visible Tickets whose original it is, the oldest first, at most a page of
// them (Sentinel docs/features/tickets/tickets.md, List Tickets, Duplicate
// filter). A duplicate has none, since an original is never Duplicated (same
// document, Duplicate Handling, Invariant), so its read is not sent.
function useDuplicates(ticket: TicketDetail) {
  return useListTickets(
    {
      duplicate_of_ticket_id: ticket.ticket_id,
      sort_by: "ticket_id",
      sort_order: "asc",
      per_page: DUPLICATES_PAGE,
    },
    { query: { enabled: ticket.duplicate_of_ticket_id === null } },
  );
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
                and {page.meta.total - page.data.length} more
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
// (docs/design-system.md, Detail Screens): the assignee in the full form,
// whose name wraps, since nothing else on the screen shows it whole, or
// "Unassigned"; the Coordinated Release Date while the Ticket is
// confidential, as an absent value without a date, and while it has one,
// also after it became non-confidential (Sentinel
// docs/features/tickets/tickets.md, Coordinated Release Date); the
// deadlines; the original of a duplicate, which is only an identifier, or the
// duplicates of any other Ticket; the creation; and the last change, as
// "Last modified", as the Ticket list names it. Users show without a link
// until Users links them (docs/behaviors.md, Representation of a User).
function Details({ ticket, now, duplicates }: DetailsProps) {
  return (
    <SideSection id={DETAILS_ANCHOR} heading="Details">
      <DescriptionList>
        <DescriptionItem term="Assignee">
          {ticket.assignee === null ? (
            <AbsentValue name="Unassigned" />
          ) : (
            <User user={ticket.assignee} wrap />
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
// settled, unless the user has scrolled meanwhile, so that a read that arrives later does not move the target out
// of view; the window scrolls it below what stays at the top of the window
// (src/components/fixed-top.ts). An anchor whose target the Ticket lacks,
// such as a part that it does not have, shows the top of the screen
// (docs/design-system.md, Main Content).
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
      target.scrollIntoView();
    }
  }, [ready, hash]);
}

// ----------------------------------------------------------------------------
// Overview

function TicketOverview() {
  const { ticket, now, twoColumns } = useShownTicket();
  const duplicates = useDuplicates(ticket);
  useAnchorTarget([duplicates]);
  return (
    <DetailColumns
      twoColumns={twoColumns}
      leadingSections={
        <Details ticket={ticket} now={now} duplicates={duplicates} />
      }
      parts={<CvePart cve={ticket.cve} />}
    />
  );
}

// Overview, at the path of the Ticket. It takes no search parameter: a URL
// with one leads to the URL without it, in place of the URL in the browser
// history, keeping its anchor (docs/behaviors.md, Invalid Search Parameters;
// docs/screen-map.md, Browser History).
export const ticketOverviewRoute = createRoute({
  getParentRoute: () => ticketRoute,
  path: "/",
  beforeLoad: ({ location, params }) => {
    if (!sameSearch(location.search, {})) {
      throw redirect({
        to: "/tickets/$ticketId",
        params,
        search: {},
        hash: location.hash,
        replace: true,
      });
    }
  },
  component: TicketOverview,
});
