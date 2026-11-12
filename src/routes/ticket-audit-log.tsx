import { getLocalTimeZone, today } from "@internationalized/date";
import { keepPreviousData } from "@tanstack/react-query";
import {
  createRoute,
  linkOptions,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  CircleDot,
  CircleQuestionMark,
  EyeOff,
  Flag,
  Gauge,
  Link as LinkIcon,
  Package,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { z } from "zod";
import type {
  TicketAuditEventData,
  TicketAuditEventType,
  TicketAuditListResponse,
} from "../api/generated/model";
import {
  useListTicketActors,
  useListTicketEvents,
} from "../api/generated/ticket-audit-log";
import { useGetTicket } from "../api/generated/tickets";
import { Button } from "../components/button";
import { CvssVector } from "../components/cvss-vector";
import { ButtonLink } from "../components/button-link";
import { EmptyState } from "../components/data-table";
import { DateRangeFilter } from "../components/date-range-filter";
import { dayOf, formatDateTime } from "../components/date-time";
import {
  FilterGroup,
  Filters,
  FilterSelect,
  type FilterOption,
  type SelectOption,
} from "../components/filters";
import { Label } from "../components/label";
import { Link } from "../components/link";
import { Loading, UpdatingBar } from "../components/loading";
import {
  OptionsStatus,
  userOptionText,
  UserOptionLabel,
} from "../components/options";
import { Pagination } from "../components/pagination";
import { dataPlace, placeMessage } from "../components/read-view";
import { FocusHandOff } from "../components/screen-heading";
import { SearchField } from "../components/search-field";
import {
  Timeline,
  TimelineObject,
  type TimelineEvent,
} from "../components/timeline";
import { Actor, type UserFields } from "../components/user";
import { WebAddress, WebLink } from "../components/web-link";
import {
  LAST_PAGE,
  sameSearch,
  SEARCH_MAX_LENGTH,
  searchTermParam,
  stringifySearch,
  valueListParam,
  wholeNumberParam,
} from "../search-params";
import { useSignedInUser } from "../session-gate";
import { isTicketId, ticketRoute } from "./ticket";

// The tab Audit log of the Ticket screen (docs/screens/ticket.md, Audit log):
// the events of the Ticket as a timeline (docs/design-system.md, Timelines),
// from List Ticket Events, which the user searches and filters by actor, kind,
// and period, from List Ticket Actors (Sentinel
// docs/features/tickets/ticket-audit-log.md, List Ticket Events; List Ticket
// Actors).

// The events of a page.
const PER_PAGE = 50;
// The first and the last date of the period in the URL, and the first date
// that its fields take until the screen has read the day of the first event
// (docs/screens/ticket.md, Navigation; Audit log).
const FIRST_DAY = "1970-01-01";
const LAST_DAY = "9999-12-30";

// The kinds of event, each a group of event types with its icon
// (docs/design-system.md, Icons by Need), in the order of the filter.
// The values of the kind search parameter.
const KIND_IDS = [
  "status",
  "assignment",
  "packages",
  "cve",
  "priority",
  "confidentiality",
  "references",
] as const;

type KindId = (typeof KIND_IDS)[number];

interface Kind {
  id: KindId;
  label: string;
  icon: LucideIcon;
  types: readonly TicketAuditEventType[];
}

const KINDS = [
  {
    id: "status",
    label: "Status",
    icon: CircleDot,
    types: [
      "ticket_created",
      "status_change",
      "duplicate_set",
      "duplicate_removed",
      "duplicate_target_changed",
    ],
  },
  {
    id: "assignment",
    label: "Assignment",
    icon: UserCheck,
    types: ["assignment"],
  },
  {
    id: "packages",
    label: "Packages",
    icon: Package,
    types: [
      "package_added",
      "package_maintainer_added",
      "package_excluded",
      "package_restored",
      "track_status_changed",
      "track_excluded",
      "track_restored",
      "product_released",
      "product_eligibility_changed",
      "product_excluded",
      "product_restored",
    ],
  },
  {
    id: "cve",
    label: "CVE and CVSS",
    icon: Gauge,
    types: ["cve_associated", "cvss_assessment_changed", "severity_changed"],
  },
  {
    id: "priority",
    label: "Priority",
    icon: Flag,
    types: ["priority_changed"],
  },
  {
    id: "confidentiality",
    label: "Confidentiality",
    icon: EyeOff,
    types: [
      "confidentiality_changed",
      "coordinated_release_changed",
      "access_grant_added",
      "access_grant_removed",
    ],
  },
  {
    id: "references",
    label: "References",
    icon: LinkIcon,
    types: [
      "reference_added",
      "reference_deleted",
      "reference_url_changed",
      "reference_type_changed",
      "reference_title_changed",
      "reference_description_changed",
    ],
  },
] as const satisfies readonly Kind[];

// The icon of the kind of an event type, or of an event type that the
// pinned contract does not list (docs/behaviors.md, Unknown Values).
function iconOf(type: string): LucideIcon {
  return (
    KINDS.find((kind) => (kind.types as readonly string[]).includes(type))
      ?.icon ?? CircleQuestionMark
  );
}

const KIND_OPTIONS: readonly FilterOption<KindId>[] = KINDS.map((kind) => ({
  value: kind.id,
  label: (
    <span className="inline-flex items-center gap-1.5">
      <kind.icon aria-hidden className="size-3.5 text-fg-muted" />
      {kind.label}
    </span>
  ),
}));

// --------------------------------------------------------------------------
// The search parameters (docs/screens/ticket.md, Navigation).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The actor: system, or the id of a user in lower case, never a username,
// which can change and can be system (Sentinel
// docs/features/tickets/ticket-audit-log.md, List Ticket Events).
const actorParam = z
  .string()
  .refine((value) => value === "system" || UUID.test(value))
  .transform((value) => value.toLowerCase())
  .optional()
  .catch(undefined);

// The year, the month, and the day of a date such as 2026-11-08, or
// undefined for another value.
function partsOf(value: string) {
  const groups = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(
    value,
  )?.groups;
  if (groups === undefined) {
    return undefined;
  }
  return {
    year: Number(groups.year),
    month: Number(groups.month),
    day: Number(groups.day),
  };
}

// Whether a value is a date, such as 2026-11-08, of the period.
function isPeriodDate(value: string): boolean {
  const parts = partsOf(value);
  if (parts === undefined) {
    return false;
  }
  const { year, month, day } = parts;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    value >= FIRST_DAY &&
    value <= LAST_DAY
  );
}

const dateParam = z.string().refine(isPeriodDate).optional().catch(undefined);

const auditLogParams = z.object({
  search: searchTermParam,
  actor: actorParam,
  kind: valueListParam(KIND_IDS),
  from: dateParam,
  to: dateParam,
  page: wholeNumberParam(LAST_PAGE),
});

type AuditLogSearch = z.output<typeof auditLogParams>;

// The parameters in the form that the screen gives them: without the first
// page, and without a range whose start follows its end (docs/behaviors.md,
// Invalid Search Parameters).
const auditLogSearch = auditLogParams.transform((search): AuditLogSearch => {
  const inverted =
    search.from !== undefined &&
    search.to !== undefined &&
    search.from > search.to;
  return {
    ...search,
    from: inverted ? undefined : search.from,
    to: inverted ? undefined : search.to,
    page: search.page === 1 ? undefined : search.page,
  };
});

// The first instant of a day in the time zone of the browser, or its last,
// in UTC, which the period sends (docs/behaviors.md, Dates and Times, Input;
// Sentinel docs/api-spec.md, Date Range Interpretation).
function instantOf(date: string | undefined, end: boolean): string | undefined {
  const parts = date === undefined ? undefined : partsOf(date);
  if (parts === undefined) {
    return undefined;
  }
  const { year, month, day } = parts;
  if (!end) {
    return new Date(year, month - 1, day).toISOString();
  }
  // The microsecond before the next day starts, the resolution of the times
  // of Sentinel, so that the day keeps every event up to its end, also on a
  // day whose last hour repeats when the clock goes back.
  const next = new Date(year, month - 1, day + 1);
  return new Date(next.getTime() - 1)
    .toISOString()
    .replace(/\.(\d{3})Z$/, ".$1999Z");
}

// The number of the filters that apply.
function filtersApplied(search: AuditLogSearch): number {
  return [search.actor, search.kind, search.from ?? search.to].filter(
    (value) => value !== undefined,
  ).length;
}

// What the user refined the events with: the search alone, filters, with or
// without the search, or nothing.
function refinedBy(search: AuditLogSearch): "search" | "filters" | undefined {
  if (filtersApplied(search) > 0) {
    return "filters";
  }
  return search.search === undefined ? undefined : "search";
}

// --------------------------------------------------------------------------
// The sentences (docs/screens/ticket.md, Audit log).

const TRACK_STATUSES: Record<string, string> = {
  ANALYSIS: "Analysis",
  AFFECTED: "Affected",
  NOT_AFFECTED: "Not affected",
  FIXED: "Fixed",
  WONT_FIX: "Won't fix",
};

const IGNORE_REASONS: Record<string, string> = {
  not_shipped: "Not shipped",
  cve_rejected: "CVE rejected",
  cna_policy: "CNA policy",
  other: "Other",
};

const REFERENCE_TYPES: Record<string, string> = {
  advisory: "Advisory",
  patch: "Patch",
  issue: "Issue",
  article: "Article",
};

const ELIGIBILITY_REASONS: Record<string, string> = {
  cvss: "after a change of the CVSS assessments or of the default CVSS version",
  threshold: "after a change of its CVSS threshold",
  reactive_ltss: "after a change of its lifecycle phase",
  reactivation: "as the Ticket left Ignored or Duplicated",
};

// The name of a value that a table names, or the value as received.
function named(table: Record<string, string>, value: string): string {
  return Object.hasOwn(table, value) ? (table[value] ?? value) : value;
}

// A Ticket status, a severity, or a priority, which Sentinel records by its
// name, such as Analysis, High, or P1; an absent severity or priority is Not
// set.
function valueOrNotSet(value: string | null): string {
  return value ?? "Not set";
}

// A text field of detail, or undefined.
function textIn(detail: TicketAuditEventData["detail"], key: string) {
  const value = detail?.[key];
  return typeof value === "string" ? value : undefined;
}

function Username({ name }: { name: string }) {
  return <TimelineObject>@{name}</TimelineObject>;
}

// A Ticket identifier, a link to its screen.
function TicketReference({ value }: { value: string }) {
  return (
    <TimelineObject>
      {isTicketId(value) ? (
        <Link
          href={linkOptions({
            to: "/tickets/$ticketId",
            params: { ticketId: value },
          })}
        >
          {value}
        </Link>
      ) : (
        value
      )}
    </TimelineObject>
  );
}

// The address of a reference, a link to it, which shows the address as the
// browser parses it (docs/behaviors.md, Links to Other Sites).
function Address({ value }: { value: string }) {
  return (
    <TimelineObject>
      <WebLink address={value} placement="text">
        {WebAddress.of(value)?.url.href ?? value}
      </WebLink>
    </TimelineObject>
  );
}

// The package and the track of an event, or "a track" without them.
function trackOf(detail: TicketAuditEventData["detail"]): ReactNode {
  const pkg = textIn(detail, "package");
  const track = textIn(detail, "track");
  return pkg === undefined || track === undefined ? (
    "a track"
  ) : (
    <TimelineObject>
      {pkg} · {track}
    </TimelineObject>
  );
}

// The Product of an event, or "a Product" without it.
function productOf(
  detail: TicketAuditEventData["detail"],
  fallback: string | null,
): ReactNode {
  const name = textIn(detail, "product_name") ?? fallback;
  return name === null ? "a Product" : <TimelineObject>{name}</TimelineObject>;
}

// The parts of a canonical CVSS assessment value, such as
// "NVD v3.1 CVSS:3.1/AV:N/… (8.1)" (Sentinel
// docs/features/tickets/ticket-audit-log.md, Event Type Contract, Rules).
function assessmentOf(value: string) {
  const groups =
    /^(?<provider>.+) v(?<version>\S+) (?<vector>\S+) \((?<score>\d+\.\d)\)$/.exec(
      value,
    )?.groups;
  if (groups === undefined) {
    return undefined;
  }
  return {
    name: `${groups.provider ?? ""} CVSS v${groups.version ?? ""}`,
    vector: groups.vector ?? "",
    score: groups.score ?? "",
  };
}

function Assessment({ value }: { value: string }) {
  const parts = assessmentOf(value);
  if (parts === undefined) {
    return <>{value}</>;
  }
  return (
    <>
      {parts.score}, <CvssVector value={parts.vector} />
    </>
  );
}

// A quoted text of a reference, such as its title.
function quoted(value: string): string {
  return `“${value}”`;
}

interface Sentence {
  sentence: ReactNode;
  // Whether the sentence says the comment of the event.
  saysComment: boolean;
}

function says(sentence: ReactNode, saysComment = false): Sentence {
  return { sentence, saysComment };
}

// The sentence of a status_change.
function statusChange({
  old_value: before,
  new_value: after,
  detail,
  comment,
}: TicketAuditEventData): Sentence {
  const reason = textIn(detail, "ignore_reason");
  if (after === "Ignored" && reason !== undefined) {
    return says(
      <>
        ignored the Ticket as {named(IGNORE_REASONS, reason)}, from{" "}
        {valueOrNotSet(before)}
      </>,
      comment === "CVE rejected" || comment === "CNA auto-ignore policy",
    );
  }
  return says(
    <>
      changed the status from {valueOrNotSet(before)} to {valueOrNotSet(after)}
    </>,
  );
}

// The sentence of an assignment.
function assignment({
  old_value: before,
  new_value: after,
  comment,
  actor,
}: TicketAuditEventData): Sentence {
  const unassigned =
    actor === null && after === null
      ? /^Unassigned from (\S+): (.+)$/.exec(comment ?? "")
      : null;
  if (unassigned !== null) {
    return says(
      <>
        unassigned <Username name={unassigned[1] ?? ""} />: {unassigned[2]}
      </>,
      true,
    );
  }
  if (before === null && after !== null) {
    return says(
      <>
        assigned the Ticket to <Username name={after} />
      </>,
    );
  }
  if (before !== null && after === null) {
    return says(
      <>
        unassigned <Username name={before} />
      </>,
    );
  }
  return says(
    <>
      reassigned the Ticket from <Username name={before ?? ""} /> to{" "}
      <Username name={after ?? ""} />
    </>,
  );
}

// The sentence of a product_eligibility_changed.
function eligibility({
  new_value: after,
  detail,
}: TicketAuditEventData): Sentence {
  const product = productOf(detail, null);
  const track = trackOf(detail);
  const eligible =
    after === "true"
      ? "eligible"
      : after === "false"
        ? "not eligible"
        : (after ?? "");
  const reason = textIn(detail, "reason");
  if (reason === "va_override") {
    if (textIn(detail, "override_action") === "cleared") {
      return says(
        <>
          returned {product} of {track} to automatic eligibility, {eligible}
        </>,
      );
    }
    return says(
      <>
        set {product} of {track} as {eligible} by hand
      </>,
    );
  }
  const why =
    reason === undefined ? undefined : named(ELIGIBILITY_REASONS, reason);
  return says(
    <>
      made {product} of {track} {eligible}
      {why === undefined ? "" : reason === why ? `, ${why}` : ` ${why}`}
    </>,
  );
}

// The sentence of a priority_changed.
function priority({
  old_value: before,
  new_value: after,
  detail,
}: TicketAuditEventData): Sentence {
  const from = valueOrNotSet(before);
  const to = valueOrNotSet(after);
  switch (textIn(detail, "override_action")) {
    case "set":
      return says(
        <>
          overrode the priority from {from} to {to}
        </>,
      );
    case "changed":
      return says(
        <>
          changed the priority override from {from} to {to}
        </>,
      );
    case "cleared":
      return says(
        <>
          cleared the priority override, from {from} to {to}
        </>,
      );
    default:
      return says(
        before === null ? (
          <>set the priority to {to}</>
        ) : (
          <>
            changed the priority from {from} to {to}
          </>
        ),
      );
  }
}

// The sentence of a cvss_assessment_changed.
function cvss({
  old_value: before,
  new_value: after,
}: TicketAuditEventData): Sentence {
  const name = assessmentOf(after ?? before ?? "")?.name;
  const assessment =
    name === undefined ? (
      "a CVSS assessment"
    ) : (
      <>
        the <TimelineObject>{name}</TimelineObject> assessment
      </>
    );
  if (before === null) {
    return says(
      <>
        added {assessment} <Assessment value={after ?? ""} />
      </>,
    );
  }
  if (after === null) {
    return says(
      <>
        deleted {assessment} <Assessment value={before} />
      </>,
    );
  }
  return says(
    <>
      changed {assessment} from <Assessment value={before} /> to{" "}
      <Assessment value={after} />
    </>,
  );
}

// The sentence of a change of a field of a reference that may be empty,
// such as its title.
function referenceText(
  field: string,
  { old_value: before, new_value: after, detail }: TicketAuditEventData,
): Sentence {
  const url = textIn(detail, "url");
  const reference = url === undefined ? "a reference" : <Address value={url} />;
  if (before === null) {
    return says(
      <>
        set the {field} of {reference} to {quoted(after ?? "")}
      </>,
    );
  }
  if (after === null) {
    return says(
      <>
        removed the {field} {quoted(before)} of {reference}
      </>,
    );
  }
  return says(
    <>
      changed the {field} of {reference} from {quoted(before)} to{" "}
      {quoted(after)}
    </>,
  );
}

function referenceType(value: string | null): string {
  return value === null ? "Uncategorized" : named(REFERENCE_TYPES, value);
}

// What the actor of an event did, by its type (docs/screens/ticket.md, Audit
// log); an event type that the pinned contract does not list shows its type
// as received, and none of its values (docs/behaviors.md, Unknown Values).
function sentenceOf(event: TicketAuditEventData): Sentence {
  const { old_value: before, new_value: after, detail, comment } = event;
  // The event type as received, which can be one that the pinned contract
  // does not list.
  const type: string = event.event_type;
  switch (type) {
    case "ticket_created": {
      const source = /^CVE ingested from (.+)$/.exec(comment ?? "")?.[1];
      return source === undefined
        ? says(<>created the Ticket</>, comment === "Ticket created manually")
        : says(
            <>created the Ticket from its CVE, ingested from {source}</>,
            true,
          );
    }
    case "status_change":
      return statusChange(event);
    case "assignment":
      return assignment(event);
    case "duplicate_set":
      return says(
        <>
          marked the Ticket as a duplicate of{" "}
          <TicketReference value={after ?? ""} />
        </>,
      );
    case "duplicate_removed":
      return says(
        <>
          reverted the duplicate of <TicketReference value={before ?? ""} />
        </>,
      );
    case "duplicate_target_changed": {
      const trigger = textIn(detail, "triggered_by_ticket");
      return says(
        <>
          changed the original from <TicketReference value={before ?? ""} /> to{" "}
          <TicketReference value={after ?? ""} />
          {trigger !== undefined && (
            <>
              , as <TicketReference value={trigger} /> was marked as a duplicate
            </>
          )}
        </>,
      );
    }
    case "package_added":
      return says(
        <>
          added or completed the package{" "}
          <TimelineObject>{after}</TimelineObject>
        </>,
      );
    case "package_maintainer_added": {
      const pkg = textIn(detail, "package");
      return says(
        <>
          added the maintainer <Username name={after ?? ""} />
          {pkg !== undefined && (
            <>
              {" "}
              to <TimelineObject>{pkg}</TimelineObject>
            </>
          )}
        </>,
      );
    }
    case "package_excluded":
      return says(
        <>
          excluded the package <TimelineObject>{before}</TimelineObject>
        </>,
      );
    case "package_restored":
      return says(
        <>
          restored the package <TimelineObject>{after}</TimelineObject>
        </>,
      );
    case "track_status_changed":
      return says(
        <>
          set {trackOf(detail)} from {named(TRACK_STATUSES, before ?? "")} to{" "}
          {named(TRACK_STATUSES, after ?? "")}
        </>,
      );
    case "track_excluded":
      return says(<>excluded the track {trackOf(detail)}</>);
    case "track_restored":
      return says(<>restored the track {trackOf(detail)}</>);
    case "product_released": {
      const advisory = textIn(detail, "advisory_id");
      return says(
        <>
          recorded the release of {productOf(detail, null)} of {trackOf(detail)}{" "}
          on {formatDateTime(after ?? "")}
          {advisory !== undefined && `, in ${advisory}`}
        </>,
      );
    }
    case "product_eligibility_changed":
      return eligibility(event);
    case "product_excluded":
      return says(
        <>
          excluded {productOf(detail, before)} from {trackOf(detail)}
        </>,
      );
    case "product_restored":
      return says(
        <>
          restored {productOf(detail, after)} on {trackOf(detail)}
        </>,
      );
    case "cve_associated":
      return says(
        <>
          associated <TimelineObject>{after}</TimelineObject>
        </>,
      );
    case "severity_changed":
      if (before === null) {
        return says(<>set the severity to {valueOrNotSet(after)}</>);
      }
      if (after === null) {
        return says(<>removed the severity {before}</>);
      }
      return says(
        <>
          changed the severity from {before} to {after}
        </>,
      );
    case "priority_changed":
      return priority(event);
    case "cvss_assessment_changed":
      return cvss(event);
    case "confidentiality_changed":
      if (after === "true") {
        return says(<>made the Ticket confidential</>);
      }
      if (after === "false") {
        return says(<>made the Ticket non-confidential</>);
      }
      return says(
        <>
          changed the confidentiality from {valueOrNotSet(before)} to{" "}
          {valueOrNotSet(after)}
        </>,
      );
    case "coordinated_release_changed":
      if (before === null) {
        return says(
          <>
            set the Coordinated Release Date to {formatDateTime(after ?? "")}
          </>,
        );
      }
      if (after === null) {
        return says(
          <>removed the Coordinated Release Date {formatDateTime(before)}</>,
        );
      }
      return says(
        <>
          changed the Coordinated Release Date from {formatDateTime(before)} to{" "}
          {formatDateTime(after)}
        </>,
      );
    case "access_grant_added":
      return says(
        <>
          granted access to <Username name={after ?? ""} />
        </>,
      );
    case "access_grant_removed":
      return says(
        <>
          revoked the access of <Username name={before ?? ""} />
        </>,
      );
    case "reference_added":
      return says(
        <>
          added the reference <Address value={after ?? ""} />
        </>,
      );
    case "reference_deleted":
      return says(
        <>
          deleted the reference <Address value={before ?? ""} />
        </>,
      );
    case "reference_url_changed":
      return says(
        <>
          changed the address of a reference from{" "}
          <Address value={before ?? ""} /> to <Address value={after ?? ""} />
        </>,
      );
    case "reference_type_changed": {
      const url = textIn(detail, "url");
      return says(
        <>
          changed the type of{" "}
          {url === undefined ? "a reference" : <Address value={url} />} from{" "}
          {referenceType(before)} to {referenceType(after)}
        </>,
      );
    }
    case "reference_title_changed":
      return referenceText("title", event);
    case "reference_description_changed":
      return referenceText("description", event);
    default:
      return says(<>{type}</>);
  }
}

// An event as the timeline shows it.
function timelineEventOf(event: TicketAuditEventData): TimelineEvent {
  const { sentence, saysComment } = sentenceOf(event);
  return {
    id: event.id,
    at: event.created_at,
    actor: event.actor,
    icon: iconOf(event.event_type),
    sentence,
    comment:
      saysComment || event.comment === null || event.comment === ""
        ? undefined
        : event.comment,
  };
}

// --------------------------------------------------------------------------
// The screen.

const COUNT = new Intl.NumberFormat("en-US");

// The empty state of a page without events (docs/behaviors.md, Empty States).
function emptyMessage(
  { meta }: TicketAuditListResponse,
  search: AuditLogSearch,
): string {
  if (meta.total > 0) {
    return "There are no events on this page.";
  }
  switch (refinedBy(search)) {
    case "search":
      return "No events match the search.";
    case "filters":
      return "No events match the filters.";
    default:
      return "No events.";
  }
}

// What the timeline shows, in words, which assistive technologies announce
// after another page, search, or filter (docs/behaviors.md, Accessibility,
// Focus after a navigation).
function resultText(list: TicketAuditListResponse, search: AuditLogSearch) {
  const { data, meta } = list;
  if (data.length === 0) {
    return emptyMessage(list, search);
  }
  if (meta.total <= meta.per_page) {
    return `${COUNT.format(meta.total)} ${meta.total === 1 ? "event" : "events"}`;
  }
  const first = (meta.page - 1) * meta.per_page + 1;
  const last = first + data.length - 1;
  return `${COUNT.format(first)}–${COUNT.format(last)} of ${COUNT.format(meta.total)} events`;
}

// The value of the actor filter without one.
const ANY_ACTOR = "any";

// An actor as an option of the filter, in the full form with the username
// and the labels, and the label You for the signed-in user.
function actorOption(actor: UserFields, you: boolean): SelectOption<string> {
  return {
    value: actor.id,
    text: userOptionText(actor),
    label: (
      <UserOptionLabel
        user={actor}
        labels={you ? <Label>You</Label> : undefined}
      />
    ),
  };
}

interface ActorFilterProps {
  ticketId: string;
  selected: string | undefined;
  onChange: (actor: string | undefined) => void;
}

// The actor filter: Any actor, System, and the signed-in user with the
// label You when they acted on the Ticket; then the other users who acted on
// it, from List Ticket Actors, in its order.
function ActorFilter({ ticketId, selected, onChange }: ActorFilterProps) {
  const me = useSignedInUser();
  // The tab reads the actors; the filter shows them as they are cached.
  const actors = useListTicketActors(ticketId, { query: { enabled: false } });
  const users = actors.data?.data ?? [];
  const mine = users.find((user) => user.id === me?.id);
  const fixed: SelectOption<string>[] = [
    { value: ANY_ACTOR, text: "Any actor", label: "Any actor" },
    {
      value: "system",
      text: "System",
      label: <Actor actor={null} />,
    },
    ...(mine === undefined ? [] : [actorOption(mine, true)]),
  ];
  const others = users
    .filter((user) => user.id !== me?.id)
    .map((user) => actorOption(user, false));
  let status: ReactNode = null;
  if (actors.data === undefined) {
    status = (
      <OptionsStatus>
        {actors.status === "error" ? (
          <p>{placeMessage(actors)}</p>
        ) : (
          <Loading inValue />
        )}
      </OptionsStatus>
    );
  }
  return (
    <FilterSelect
      label="Actor"
      groups={[fixed, others]}
      status={status}
      selected={selected ?? ANY_ACTOR}
      unlisted={
        actors.status === "pending" ? (
          <Loading inValue />
        ) : (
          <span className="text-fg-muted">Unknown user</span>
        )
      }
      onChange={(value) => {
        onChange(value === ANY_ACTOR ? undefined : value);
      }}
    />
  );
}

// The data of the timeline that shows, which stays while other data loads,
// with the search parameters of its read, which its empty state and its
// pagination keep.
function useShownSearch(
  read: { dataUpdatedAt: number; isPlaceholderData: boolean },
  search: AuditLogSearch,
): AuditLogSearch {
  const [shown, setShown] = useState({ at: 0, search });
  if (!read.isPlaceholderData && read.dataUpdatedAt !== shown.at) {
    setShown({ at: read.dataUpdatedAt, search });
  }
  return shown.search;
}

function TicketAuditLog() {
  const { ticketId } = ticketAuditLogRoute.useParams();
  const search = ticketAuditLogRoute.useSearch();
  const navigate = useNavigate();
  const page = search.page ?? 1;
  // Whether the Ticket has arrived: until it has, a failure of the events
  // waits, so that a Ticket that the user cannot see shows Not found rather
  // than the failure of a part (docs/screens/ticket.md, States).
  const ticketShown =
    useGetTicket(ticketId, { query: { enabled: false } }).data !== undefined;

  const types = search.kind?.flatMap(
    (id) => KINDS.find((kind) => kind.id === id)?.types ?? [],
  );
  const events = useListTicketEvents(
    ticketId,
    {
      event_type: types,
      actor: search.actor,
      search: search.search,
      from_date: instantOf(search.from, false),
      to_date: instantOf(search.to, true),
      page,
      per_page: PER_PAGE,
    },
    { query: { placeholderData: keepPreviousData } },
  );
  // List Ticket Actors is read when the tab opens, not when Filters opens
  // the actor filter, which reads it from the cache (docs/screens/ticket.md,
  // Audit log).
  useListTicketActors(ticketId);
  // The first event of the Ticket, its ticket_created, gives the period its
  // first day, in the time zone of the browser (docs/screens/ticket.md, Audit
  // log; Sentinel docs/features/tickets/ticket-audit-log.md, Cross-Event
  // Ordering, Locking, and Rollback). Until a read of it succeeds, the period
  // takes the days from FIRST_DAY, and its failure shows nowhere
  // (docs/behaviors.md, Where Errors Appear).
  // As its failure shows nowhere, the screen reads it again when the tab
  // returns to the foreground also without data (src/query-client.ts).
  const created = useListTicketEvents(
    ticketId,
    { event_type: ["ticket_created"], per_page: 1 },
    { query: { refetchOnWindowFocus: true } },
  ).data?.data[0]?.created_at;
  const firstDay = created === undefined ? undefined : dayOf(created).date;
  const now = today(getLocalTimeZone()).toString();
  // Today, or a first day after it, which a clock of the browser behind
  // Sentinel's gives.
  const lastDay = firstDay !== undefined && firstDay > now ? firstDay : now;
  const shownSearch = useShownSearch(events, search);
  const refined = refinedBy(search);

  const refine = (change: Partial<AuditLogSearch>) => {
    void navigate({
      to: "/tickets/$ticketId/audit-log",
      params: { ticketId },
      search: (previous) => ({ ...previous, ...change, page: undefined }),
    });
  };
  const clearFilters = () => {
    void navigate({
      to: "/tickets/$ticketId/audit-log",
      params: { ticketId },
      search: {},
    });
  };
  const pageHref = (target: number) =>
    linkOptions({
      to: "/tickets/$ticketId/audit-log",
      params: { ticketId },
      search: { ...shownSearch, page: target === 1 ? undefined : target },
    });

  // A change of the page, the search, or a filter announces what the
  // timeline shows, once it shows it; the tab as it opens does not
  // (docs/behaviors.md, Accessibility, Focus after a navigation).
  const key = stringifySearch(search);
  const [openedAt] = useState(key);
  const [changed, setChanged] = useState(false);
  if (!changed && key !== openedAt) {
    setChanged(true);
  }
  const announcement =
    changed && events.status === "success" && !events.isPlaceholderData
      ? resultText(events.data, search)
      : "";
  const filtersStatus =
    events.status === "error" ? placeMessage(events) : announcement;

  const place = dataPlace(events);
  const failure = ticketShown ? place.failure : null;
  const waiting = place.waiting || (place.failure !== null && !ticketShown);
  const data = place.data;

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SearchField
          placeholder="Search events"
          applied={search.search ?? ""}
          maxLength={SEARCH_MAX_LENGTH}
          onApply={(term) => {
            refine({ search: term });
          }}
        />
        <Filters
          applied={filtersApplied(search)}
          status={<span key={key}>{filtersStatus}</span>}
        >
          <ActorFilter
            ticketId={ticketId}
            selected={search.actor}
            onChange={(actor) => {
              refine({ actor });
            }}
          />
          <FilterGroup
            label="Kind"
            options={KIND_OPTIONS}
            selected={search.kind ?? []}
            onChange={(values) => {
              refine({ kind: values });
            }}
          />
          <DateRangeFilter
            startLabel="From"
            endLabel="To"
            applied={{ start: search.from, end: search.to }}
            startDefault={firstDay}
            min={firstDay ?? FIRST_DAY}
            max={lastDay}
            onApply={({ start, end }) => {
              refine({ from: start, to: end });
            }}
          />
        </Filters>
        {refined !== undefined && (
          <FocusHandOff>
            <Button variant="quiet" size="small" onPress={clearFilters}>
              <X aria-hidden className="size-4" />
              Clear filters
            </Button>
          </FocusHandOff>
        )}
      </div>
      <div className="relative mt-4">
        {place.updating && <UpdatingBar />}
        <output className="block">{failure ?? place.warning}</output>
        {data === undefined ? (
          waiting && <Loading />
        ) : data.data.length === 0 ? (
          // A key of each place, so that the one that leaves the page hands
          // the focus off, rather than taking the content of the other.
          <FocusHandOff key="empty">
            <EmptyState
              message={emptyMessage(data, shownSearch)}
              action={
                data.meta.total > 0 ? (
                  <ButtonLink href={pageHref(1)}>
                    Go to the first page
                  </ButtonLink>
                ) : refinedBy(shownSearch) === undefined ? undefined : (
                  <Button onPress={clearFilters}>
                    <X aria-hidden className="size-4" />
                    Clear filters
                  </Button>
                )
              }
            />
          </FocusHandOff>
        ) : (
          <FocusHandOff key="events">
            <Timeline events={data.data.map(timelineEventOf)} />
          </FocusHandOff>
        )}
        {data !== undefined && (
          <Pagination
            page={data.meta.page}
            perPage={data.meta.per_page}
            total={data.meta.total}
            href={pageHref}
          />
        )}
      </div>
      <output className="sr-only">
        <span key={key}>{announcement}</span>
      </output>
    </>
  );
}

// The tab Audit log, at its path under the path of the Ticket. A URL with a
// search parameter that it does not accept, or with a value that it does not
// accept or gives in another form, leads to the URL that it gives that state,
// in place of the URL in the browser history (docs/behaviors.md, Invalid
// Search Parameters; docs/screen-map.md, Browser History).
export const ticketAuditLogRoute = createRoute({
  getParentRoute: () => ticketRoute,
  path: "audit-log",
  validateSearch: auditLogSearch,
  beforeLoad: ({ location, params }) => {
    // The router's search of the route also passes on every parameter of the
    // URL that the schema does not declare, so the schema reads the URL
    // itself.
    const accepted = auditLogSearch.parse(location.search);
    if (!sameSearch(location.search, accepted)) {
      throw redirect({
        to: "/tickets/$ticketId/audit-log",
        params,
        search: accepted,
        hash: location.hash,
        replace: true,
      });
    }
  },
  component: TicketAuditLog,
});
