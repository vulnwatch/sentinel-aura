import {
  CircleQuestionMark,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  type LucideIcon,
} from "lucide-react";
import {
  useListReleaseRequests,
  useListSubmissionRequests,
} from "../../api/generated/ibs-submission-tracking";
import type {
  IBSRequestStateValue,
  SubmissionRequestItem,
} from "../../api/generated/model";
import { counted, type Noun } from "../../components/count";
import { Loading } from "../../components/loading";
import type { Read } from "../../components/read-view";
import { andMore, LISTED, MoreValues } from "../../components/several-values";
import { Tooltip } from "../../components/tooltip";
import { WebLink } from "../../components/web-link";

// The IBS requests of a track, in its phases in the package tree
// (src/routes/ticket-overview/packages.tsx).

// How the state of a request shows: its name, and a mark whose shape and
// color tell the open requests from the accepted and the closed ones
// (docs/design-system.md, Other Values).
interface RequestState {
  name: string;
  icon: LucideIcon;
  color: string;
}

// New and Review: a request in progress.
const OPEN_REQUEST = { icon: GitPullRequest, color: "text-info-icon" };
// Declined, Revoked, Superseded, and Deleted: a request that failed, which
// no longer establishes progress by itself (Sentinel
// docs/features/packages/ibs-submission-tracking.md, Effective SR), in red,
// so that an analyst sees at once that the latest request was stopped.
const CLOSED_REQUEST = {
  icon: GitPullRequestClosed,
  color: "text-danger-icon",
};

// The states of an IBS request, as Sentinel names them (Sentinel
// docs/features/packages/ibs-submission-tracking.md, Request States). A Map,
// so that a value that a later Sentinel release returns is looked up only
// among them (docs/conventions.md, Data Read from the API).
const REQUEST_STATES = new Map<string, RequestState>(
  Object.entries({
    new: { name: "New", ...OPEN_REQUEST },
    review: { name: "Review", ...OPEN_REQUEST },
    accepted: { name: "Accepted", icon: GitMerge, color: "text-success-icon" },
    declined: { name: "Declined", ...CLOSED_REQUEST },
    revoked: { name: "Revoked", ...CLOSED_REQUEST },
    superseded: { name: "Superseded", ...CLOSED_REQUEST },
    deleted: { name: "Deleted", ...CLOSED_REQUEST },
  } satisfies Record<IBSRequestStateValue, RequestState>),
);

// The fields of an IBS request that a line shows, which a submission request
// and a release request share.
type IbsRequest = Pick<
  SubmissionRequestItem,
  "id" | "request_number" | "state" | "superseded_by_request_number" | "ibs_url"
>;

// The state of a request: its name, followed for a superseded request by the
// number of the request that replaced it, or the state as received.
function requestState(request: IbsRequest): string {
  const name = REQUEST_STATES.get(request.state)?.name ?? request.state;
  return request.state === "superseded" &&
    request.superseded_by_request_number !== null
    ? `${name} by ${request.superseded_by_request_number}`
    : name;
}

// The requests of one track, of the package and the codestream that its
// reference names (Sentinel docs/features/packages/ibs-submission-tracking.md,
// Package and Codestream Identity), the most recently created first (same
// document, Common Query Rules), and their number: the latest request and the
// ten others that "+N" names, as many as a cell of a table names
// (docs/design-system.md, Tables). They are read each time the popover that
// shows them opens, as the details of a CNA are: the query goes when the
// popover closes, and is not read again while it is open, even when the tab
// returns to the foreground (docs/behaviors.md, Loading).
function requestsQuery(packageName: string, reference: string) {
  return {
    params: {
      package_name: packageName,
      codestream_name: reference,
      sort_by: "upstream_created_at",
      sort_order: "desc",
      per_page: LISTED + 1,
    },
    options: { query: { gcTime: 0, refetchOnWindowFocus: false } },
  } as const;
}

// The mark of the state of a request, at 14 px, hidden from assistive
// technologies, which read the state with the request: git-pull-request in
// info-icon for New and Review, git-merge in success-icon for Accepted,
// git-pull-request-closed in danger-icon for Declined, Revoked, Superseded,
// and Deleted, and circle-question-mark in neutral-icon for a state that the
// pinned contract does not list (docs/design-system.md, Other Values).
function RequestMark({ state }: { state: string }) {
  const known = REQUEST_STATES.get(state);
  const Icon = known?.icon ?? CircleQuestionMark;
  return (
    <Icon
      aria-hidden
      className={`size-3.5 shrink-0 ${known?.color ?? "text-neutral-icon"}`}
    />
  );
}

// The kind of a request: its abbreviation, as IBS and Sentinel name it, the
// kind in words, and what its place says when the requests of the kind are
// not available.
interface RequestKind {
  abbreviation: string;
  noun: Noun;
  failure: string;
}

const SUBMISSION_REQUEST: RequestKind = {
  abbreviation: "SR",
  noun: { one: "submission request", other: "submission requests" },
  failure: "The submission requests aren't available.",
};

const RELEASE_REQUEST: RequestKind = {
  abbreviation: "RR",
  noun: { one: "release request", other: "release requests" },
  failure: "The release requests aren't available.",
};

interface RequestCellProps {
  read: Read<{ data: IbsRequest[]; meta: { total: number } }>;
  kind: RequestKind;
  // What the place says without requests, or nothing.
  empty?: string;
}

// The most recently created request of a track in a phase: the mark of its
// state, then its kind and number, such as "SR 900001", as a link to it in
// IBS, 24 px high, whose tooltip states its state and whose accessible name
// states it after the number, such as "SR 900001, Review"; then, 6 px later,
// "+N", the number of the others, whose tooltip lists the requests with their
// state (docs/design-system.md, Tables). While they load, the loading
// indicator takes their place, and when their read fails, the line of the
// failure in fg-muted, such as "The submission requests aren't available.",
// which a status region announces, since the popover holds the focus, as the
// details of a popover of a name do (docs/design-system.md, Menus, Popovers,
// and Tooltips); opening the popover again reads them again. Without
// requests, the place says what empty says, or nothing.
function RequestCell({ read, kind, empty }: RequestCellProps) {
  const list = read.data;
  const [latest] = list?.data ?? [];
  const total = list?.meta.total ?? 0;
  const line = (request: IbsRequest, separator: string) =>
    `${kind.abbreviation} ${request.request_number}${separator}${requestState(request)}`;
  const others = (list?.data ?? [])
    .slice(1, LISTED + 1)
    .map((request) => line(request, ", "));
  const unnamed = andMore(total - 1 - LISTED);
  if (unnamed !== undefined) {
    others.push(unnamed);
  }
  return (
    <>
      <output className="block">
        {list === undefined && read.status === "error" && (
          <span className="flex min-h-6 items-center text-fg-muted">
            {kind.failure}
          </span>
        )}
      </output>
      {list === undefined && read.status === "pending" && <Loading inValue />}
      {list !== undefined && latest === undefined && empty !== undefined && (
        <span className="text-fg-muted">{empty}</span>
      )}
      {list !== undefined && latest !== undefined && (
        <span className="inline-flex items-center gap-1">
          <RequestMark state={latest.state} />
          <Tooltip placement="top" text={requestState(latest)}>
            <WebLink
              address={latest.ibs_url}
              tall
              detail={requestState(latest)}
            >
              {`${kind.abbreviation} ${latest.request_number}`}
            </WebLink>
          </Tooltip>
          {total > 1 && (
            <span className="ms-0.5">
              <MoreValues
                count={total - 1}
                label={`${counted(total - 1, {
                  one: `more ${kind.noun.one}`,
                  other: `more ${kind.noun.other}`,
                })}: ${others.join("; ")}`}
                heading={counted(total, kind.noun)}
                values={list.data
                  .slice(0, LISTED)
                  .map((request) => line(request, " · "))}
                more={andMore(total - LISTED)}
              />
            </span>
          )}
        </span>
      )}
    </>
  );
}

interface TrackRequestsProps {
  ticketId: string;
  packageName: string;
  reference: string;
  empty?: string;
}

// The submission requests of a track, from List Submission Requests,
// `GET /api/v1/tickets/{ticket_id}/submission-requests` (Sentinel
// docs/features/packages/ibs-submission-tracking.md, List Submission
// Requests).
export function SubmissionRequests({
  ticketId,
  packageName,
  reference,
  empty,
}: TrackRequestsProps) {
  const { params, options } = requestsQuery(packageName, reference);
  const read = useListSubmissionRequests(ticketId, params, options);
  return <RequestCell read={read} kind={SUBMISSION_REQUEST} empty={empty} />;
}

// The release requests of a track, from List Release Requests,
// `GET /api/v1/tickets/{ticket_id}/release-requests` (same document, List
// Release Requests).
export function ReleaseRequests({
  ticketId,
  packageName,
  reference,
  empty,
}: TrackRequestsProps) {
  const { params, options } = requestsQuery(packageName, reference);
  const read = useListReleaseRequests(ticketId, params, options);
  return <RequestCell read={read} kind={RELEASE_REQUEST} empty={empty} />;
}
