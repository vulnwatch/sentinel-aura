import { linkOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { TicketAuditEventData } from "../../api/generated/model";
import { CvssVector } from "../../components/cvss-vector";
import { formatDateTime } from "../../components/date-time";
import { ignoreReasonName } from "../../components/ignore-reason";
import { Link } from "../../components/link";
import { referenceTypeName } from "../../components/reference-type";
import { TimelineObject, type TimelineEvent } from "../../components/timeline";
import { WebAddress, WebLink } from "../../components/web-link";
import { isTicketId } from "../ticket";
import { iconOf } from "./kinds";

// The sentences of the events of the tab Audit log
// (src/routes/ticket-audit-log.tsx; docs/screens/ticket.md, Audit log): what
// the actor of each event did, by its type, and the event as the timeline
// shows it.

const TRACK_STATUSES: Record<string, string> = {
  ANALYSIS: "Analysis",
  AFFECTED: "Affected",
  NOT_AFFECTED: "Not affected",
  FIXED: "Fixed",
  WONT_FIX: "Won't fix",
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
        ignored the Ticket as {ignoreReasonName(reason)}, from{" "}
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
          {referenceTypeName(before)} to {referenceTypeName(after)}
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
export function timelineEventOf(event: TicketAuditEventData): TimelineEvent {
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
