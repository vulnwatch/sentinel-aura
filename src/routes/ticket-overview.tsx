import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import {
  createRoute,
  linkOptions,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  Ban,
  CircleQuestionMark,
  ClockAlert,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash,
  TriangleAlert,
  Undo2,
  UserPen,
  UserRoundKey,
  type LucideIcon,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { DialogTrigger, Form } from "react-aria-components";
import { z } from "zod";
import {
  assigneeFieldError,
  cvssVectorError,
  grantAccessFieldError,
  isAssigneeChanged,
  isNotConfidential,
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentChangeFailure,
  presentFailure,
  presentMarkerConflict,
  presentRefetchFailure,
  validationErrorFields,
} from "../api/errors";
import { useGetCna } from "../api/generated/cnas";
import {
  getGetCveCvssAssessmentsQueryKey,
  getGetCveCvssAssessmentsQueryOptions,
  getGetCveSourceStatusQueryKey,
  useDeleteSuseCvssAssessment,
  useGetCveCvssAssessments,
  useGetCveSourceStatus,
  useRefetchCve,
  useUpsertSuseCvssAssessment,
} from "../api/generated/cves";
import { useGetCvssBaseScore } from "../api/generated/cvss";
import {
  useListReleaseRequests,
  useListSubmissionRequests,
} from "../api/generated/ibs-submission-tracking";
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
  PackageStatusValue,
  TicketStatusValue,
  type IBSRequestStateValue,
  type SubmissionRequestItem,
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
  CVSSAssessmentResponse,
  CurrentPhaseValue,
  LifecyclePhaseValue,
  PackageDetail,
  ProductDetail,
  ProductReasonValue,
  SSVCAutomatable,
  SSVCExploitation,
  SSVCTechnicalImpact,
  ListUsersAssignmentEligibilityItem,
  TicketAccessGrantDataResponse,
  TicketAccessGrantResponse,
  TicketDetail,
  TicketDetailResponse,
  TrackDetail,
  TrackStatusResponse,
  UserDirectoryData,
} from "../api/generated/model";
import {
  getListTicketActorsQueryKey,
  getListTicketEventsQueryKey,
  useListTicketActors,
} from "../api/generated/ticket-audit-log";
import {
  useChangeTrackStatus,
  useExcludePackage,
  useExcludeTrack,
  useRestorePackage,
  useRestoreTrack,
} from "../api/generated/ticket-packages";
import {
  getGetTicketQueryKey,
  getListTicketAccessGrantsQueryKey,
  getListTicketsQueryKey,
  getRevokeTicketAccessMutationKey,
  useAssignTicket,
  useGetTicket,
  useGrantTicketAccess,
  useListTicketAccessGrants,
  useListTickets,
  useRevokeTicketAccess,
} from "../api/generated/tickets";
import { ApiError } from "../api/request";
import { getListUsersQueryKey } from "../api/generated/users";
import { AbsentValue } from "../components/absent-value";
import { ActionsMenu } from "../components/actions-menu";
import { Button } from "../components/button";
import {
  useChangeOutcome,
  useMounted,
  useOutcomeAfterRead,
} from "../components/change-outcome";
import { ChoiceMenu } from "../components/choice-menu";
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
import { DialogTabs } from "../components/dialog-tabs";
import { useDiscardQuestion } from "../components/discard-question";
import { ErrorInPlace } from "../components/error-in-place";
import { FOCUS_RING } from "../components/focus-ring";
import { GroupBand } from "../components/group-band";
import { IconButton } from "../components/icon-button";
import { InfoPopover } from "../components/info-popover";
import { Label, LabelList } from "../components/label";
import { Link } from "../components/link";
import { Maintainers } from "../components/maintainers";
import {
  MarkedValue,
  ValueMark,
  type MarkedName,
} from "../components/marked-value";
import { Loading, UpdatingBar } from "../components/loading";
import { MenuAction } from "../components/menu";
import { useShowMessage, type MessageRecord } from "../components/message-area";
import { Message, type MessageTone } from "../components/message";
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
import {
  andMore,
  counted,
  LISTED,
  MoreValues,
  type Noun,
} from "../components/several-values";
import { useRowFocusAfterRemoval } from "../components/row-focus";
import { SegmentedControl } from "../components/segmented-control";
import { SelectField, type FieldOption } from "../components/select-field";
import { Severity, severityName } from "../components/severity";
import { Switch } from "../components/switch";
import { TextField } from "../components/text-field";
import { Tooltip } from "../components/tooltip";
import {
  TrackDelivery,
  TrackMilestones,
  type PhaseExtras,
} from "../components/track-milestones";
import { displayName, User, type UserFields } from "../components/user";
import { UserComboBox } from "../components/user-combobox";
import { UserGroup } from "../components/user-group";
import { UserPicker } from "../components/user-picker";
import { WebLink } from "../components/web-link";
import { sameSearch } from "../search-params";
import { useSignedInUser } from "../session-gate";
import {
  CVE_SOURCE_NAMES,
  ticketRecord,
  ticketRoute,
  useShownTicket,
} from "./ticket";

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

// The statuses of a Ticket in which Sentinel accepts an assignment: Ignored
// and Duplicated refuse it with 409 TICKET_NOT_MUTABLE, and a status that the
// pinned contract does not list offers no action (Sentinel
// docs/features/tickets/tickets.md, Reassignment; Sentinel
// docs/api-spec.md, Manual-Zone Mutability Guard; docs/behaviors.md, Unknown
// Values).
const ASSIGNABLE_STATUSES = new Set<string>([
  TicketStatusValue.new,
  TicketStatusValue.analysis,
  TicketStatusValue.analyzed,
  TicketStatusValue.resolved,
]);

// The assignment eligibility of the users who can be the assignee of a
// Ticket: all for a confidential Ticket, all and non_confidential for every
// other Ticket (docs/screen-map.md, Roles, Principles; Sentinel
// docs/features/identity/user-management.md, List Users).
function eligibilityOf(
  ticket: TicketDetail,
): ListUsersAssignmentEligibilityItem[] {
  return ticket.is_confidential ? ["all"] : ["all", "non_confidential"];
}

// Whether an assignment eligibility admits the Ticket; a value that the
// pinned contract does not list admits none (docs/screen-map.md, Roles,
// Principles).
function admits(eligibility: string, ticket: TicketDetail): boolean {
  return (
    eligibility === "all" ||
    (eligibility === "non_confidential" && !ticket.is_confidential)
  );
}

// The outcome of an assignment, as Sentinel returns the Ticket after it,
// such as "Assigned to Bob Wilson.", "Assigned to you.", or, after a
// self-unassignment, "You're no longer the assignee.".
function assignedText(
  { data }: TicketDetailResponse,
  signedInUser: string | undefined,
): string {
  if (data.assignee === null) {
    return "You're no longer the assignee.";
  }
  return data.assignee.id === signedInUser
    ? "Assigned to you."
    : `Assigned to ${displayName(data.assignee)}.`;
}

// The choice whose assignment is in progress: a user's id, or "action" for a
// self-unassignment (UserPicker).
function choiceOf(userId: string | null): string {
  return userId ?? "action";
}

// What the popover of the assignee shows at its top after a failure: that
// the assignee changed meanwhile, from the instant of the failure, once the
// read of the Ticket after it has arrived, or another error of the change.
type AssigneeError =
  { kind: "changed"; at: number } | { kind: "failure"; error: DialogError };

// Reads again what an assignment or an edit of the package tree affects: the
// Ticket, whose status, assignee, and package tree it can change, the work of
// a maintainer on it, the users who acted on it, its audit log, and the reads
// of the Ticket list, but for the duplicates of the Ticket, whose
// identifiers, confidentiality, and number a change of their original does
// not change (docs/behaviors.md, Outcome of a Change).
function useReadAfterTicketChange(ticketId: string) {
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

// The assignment of the Ticket from its details, Assign Ticket, PATCH
// /api/v1/tickets/{ticket_id}/assignee, for a user who holds triage_ticket
// (Sentinel docs/features/tickets/tickets.md, Assign Ticket): the state of the
// pencil of the assignee and of its popover, which the screen keeps across a
// change of layout, which moves the details (docs/design-system.md, Detail
// Screens). The request carries as the expected assignee the one that the
// screen shows. It asks for no confirmation (docs/behaviors.md, Confirmation).
// While it is in progress, the pencil and the choice are busy, and the popover
// cannot be closed; once Sentinel confirms it, the popover closes, the focus
// returns to the pencil, and the outcome is announced once the read of the
// Ticket after it arrives. A failure shows in the popover: the errors of the
// user field at the field, which keeps the focus as the choice leaves it
// there, after which the users are read again; an assignee that changed
// meanwhile, at the top of the popover, with the assignee that the Ticket has
// now, once the read of the Ticket after it arrives; every other failure at
// the top of the popover, as a warning when Sentinel did not confirm the
// change. A change of layout closes the popover, also while its change is in
// progress, whose failure then shows in the message area; the outcome of an
// assignment that ends after the user left the tab shows there too, naming the
// Ticket (docs/behaviors.md, Where Errors Appear; Outcome of a Change).
// Whatever the outcome, the screen then reads again what the assignment
// affects.
function useAssignee(ticket: TicketDetail, twoColumns: boolean) {
  const ticketId = ticket.ticket_id;
  const client = useQueryClient();
  const user = useSignedInUser();
  const showMessage = useShowMessage();
  const mounted = useMounted();
  const record = useMemo(() => ticketRecord(ticketId), [ticketId]);
  const ticketRead = useGetTicket(ticketId, { query: { enabled: false } });
  const outcome = useOutcomeAfterRead(ticketRead, record);
  const readAgain = useReadAfterTicketChange(ticketId);
  const assign = useAssignTicket({
    mutation: useChangeOutcome(
      record,
      (response: TicketDetailResponse) => assignedText(response, user?.id),
      readAgain,
    ),
  });
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);
  // A change of layout closes the popover, as a click outside it does, so
  // that it does not open again in the new place of the details.
  const [layout, setLayout] = useState(twoColumns);
  if (layout !== twoColumns) {
    setLayout(twoColumns);
    setOpen(false);
  }
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<AssigneeError>();
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }
  const pending = assign.isPending;
  const capable =
    user?.capabilities.includes("triage_ticket") === true &&
    ASSIGNABLE_STATUSES.has(ticket.status);
  const eligible =
    user !== undefined && admits(user.assignment_eligibility, ticket);
  // Whether the open popover offers the signed-in user first, as it did as it
  // opened (docs/behaviors.md, The Signed-in User).
  const [offeredAtOpen, setOfferedAtOpen] = useState(false);
  const me =
    user !== undefined && (open ? offeredAtOpen : eligible) ? user : undefined;

  const fail = (failure: unknown) => {
    if (!isRequestFailure(failure)) {
      setUiFailure({ error: failure });
      return;
    }
    if (!openRef.current) {
      const presentation = presentChangeFailure(failure);
      if (presentation !== undefined) {
        showMessage({
          tone: presentation.unconfirmed ? "warning" : "danger",
          text: presentation.message,
          reference: presentation.reference,
        });
      }
      return;
    }
    const atField =
      assigneeFieldError(failure) ??
      (validationErrorFields(failure, ["user_id"] as const).fields.length > 0
        ? MESSAGE_INVALID_VALUE
        : undefined);
    if (atField !== undefined) {
      setFieldError(atField);
      void client.invalidateQueries({ queryKey: getListUsersQueryKey() });
      return;
    }
    if (isAssigneeChanged(failure)) {
      setError({ kind: "changed", at: Date.now() });
      return;
    }
    const presentation = presentChangeFailure(failure);
    if (presentation !== undefined) {
      setError({
        kind: "failure",
        error: {
          message: presentation.message,
          reference: presentation.reference,
          unconfirmed: presentation.unconfirmed,
        },
      });
    }
  };

  const choose = async (choice: UserFields | null) => {
    if (pending) {
      return;
    }
    setFieldError(undefined);
    setError(undefined);
    try {
      const response = await assign.mutateAsync({
        ticketId,
        data: {
          user_id: choice?.id ?? null,
          expected_assignee_id: ticket.assignee?.id ?? null,
        },
      });
      if (mounted.current) {
        setOpen(false);
        outcome.after(assignedText(response, user?.id));
      }
    } catch (failure) {
      if (mounted.current) {
        fail(failure);
      }
    }
  };

  return {
    // Whether the details show the pencil: to a user who holds
    // triage_ticket, on a Ticket whose status admits an assignment, and while
    // the popover is open or its change is in progress, which keep it as
    // they started (docs/behaviors.md, The Signed-in User).
    offered: capable || open || pending,
    open,
    setOpen: (next: boolean) => {
      // The popover cannot be opened again or closed while its change is in
      // progress (docs/behaviors.md, Loading).
      if (pending) {
        return;
      }
      setOpen(next);
      if (next) {
        setOfferedAtOpen(eligible);
        setFieldError(undefined);
        setError(undefined);
      }
    },
    pending,
    busy: pending ? choiceOf(assign.variables?.data.user_id ?? null) : null,
    // The signed-in user, and the same user when their assignment eligibility
    // admits the Ticket.
    userId: user?.id,
    me,
    choose,
    fieldError,
    clearFieldError: () => {
      setFieldError(undefined);
    },
    error,
    ticketRead,
    region: outcome.region,
  };
}

type Assignee = ReturnType<typeof useAssignee>;

interface AssigneeErrorMessageProps {
  ticket: TicketDetail;
  assignee: Assignee;
}

// The error at the top of the popover of the assignee: that the assignee
// changed meanwhile, once the read of the Ticket after the failure has
// arrived, with the assignee that the Ticket has now, such as "The assignee
// changed meanwhile: the Ticket is now assigned to Bob Wilson.", or without it
// when that read failed; or another error of the change. It takes the focus
// as it shows (docs/behaviors.md, Accessibility, Announcements).
function AssigneeErrorMessage({ ticket, assignee }: AssigneeErrorMessageProps) {
  const { error, ticketRead, userId: me } = assignee;
  let changed: string | undefined;
  if (error?.kind === "changed") {
    if (ticketRead.dataUpdatedAt >= error.at) {
      let now = "unassigned";
      if (ticket.assignee !== null) {
        now =
          ticket.assignee.id === me
            ? "assigned to you"
            : `assigned to ${displayName(ticket.assignee)}`;
      }
      changed = `The assignee changed meanwhile: the Ticket is now ${now}.`;
    } else if (ticketRead.errorUpdatedAt >= error.at) {
      changed = "The assignee changed meanwhile.";
    }
  }
  const shown = useMemo<DialogError | undefined>(() => {
    if (error?.kind === "failure") {
      return error.error;
    }
    return changed === undefined
      ? undefined
      : { message: changed, reference: undefined, unconfirmed: false };
  }, [error, changed]);
  return shown === undefined ? null : <DialogErrorMessage error={shown} />;
}

interface AssigneeFieldProps {
  ticket: TicketDetail;
  assignee: Assignee;
}

// The assignee in the full form, or "Unassigned", and, for a user who can
// change it, at the end of its line, the pencil, an icon button of 24 px with
// pencil at 14 px, named "Edit assignee", which its tooltip shows, busy while
// an assignment is in progress (docs/design-system.md, Detail Screens). It
// opens the popover of the assignee below it, 320 px wide with 16 px of
// padding, named "Assignee", whose search field takes the focus as it opens:
// the error of the last assignment at its top, then the users who can be the
// assignee of the Ticket, the signed-in user first with the label You when
// their own assignment eligibility admits the Ticket, the assignee marked as
// chosen, and, for a signed-in user who is the assignee, Unassign yourself
// before them, which returns the Ticket to the queue (Sentinel
// docs/features/tickets/tickets.md, Self-Unassignment). Choosing a user who is
// not the assignee assigns the Ticket at once.
function AssigneeField({ ticket, assignee }: AssigneeFieldProps) {
  const value =
    ticket.assignee === null ? (
      <AbsentValue name="Unassigned" />
    ) : (
      <User user={ticket.assignee} />
    );
  if (!assignee.offered) {
    return value;
  }
  const { me } = assignee;
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">{value}</div>
      <DialogTrigger isOpen={assignee.open} onOpenChange={assignee.setOpen}>
        <IconButton
          label="Edit assignee"
          icon={Pencil}
          size="inline"
          isBusy={assignee.pending}
          onPress={() => undefined}
        />
        <InfoPopover width="wide" label="Assignee">
          <AssigneeErrorMessage ticket={ticket} assignee={assignee} />
          <FirstFieldFocus>
            <UserPicker
              label="Search users"
              eligibility={eligibilityOf(ticket)}
              first={me === undefined ? undefined : { user: me, label: "You" }}
              chosen={ticket.assignee?.id ?? null}
              busy={assignee.busy}
              action={
                ticket.assignee !== null &&
                ticket.assignee.id === assignee.userId
                  ? "Unassign yourself"
                  : undefined
              }
              onChoose={(choice) => {
                void assignee.choose(choice === "action" ? null : choice);
              }}
              busyText="Changing the assignee."
              error={assignee.fieldError}
              onInput={assignee.clearFieldError}
            />
          </FirstFieldFocus>
        </InfoPopover>
      </DialogTrigger>
    </div>
  );
}

interface DetailsProps {
  ticket: TicketDetail;
  now: number;
  duplicates: DuplicatesRead;
  assignee: Assignee;
}

// The details of the Ticket, as a description list (docs/design-system.md,
// Detail Screens): the assignee in the full form, or "Unassigned", with its
// pencil for a user who can change it (AssigneeField); the Coordinated Release
// Date while the Ticket is confidential, as an absent value without a date,
// and while it has one, also after it became non-confidential (Sentinel
// docs/features/tickets/tickets.md, Coordinated Release Date); the deadlines;
// the original of a duplicate, which is only an identifier, or the duplicates
// of any other Ticket; the creation; and the last change, as "Last modified",
// as the Ticket list names it. Users show without a link and a card while the
// UI has no screen User (docs/behaviors.md, Open Decisions).
function Details({ ticket, now, duplicates, assignee }: DetailsProps) {
  return (
    <SideSection id={DETAILS_ANCHOR} heading="Details">
      <DescriptionList>
        <DescriptionItem term="Assignee">
          <AssigneeField ticket={ticket} assignee={assignee} />
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

// The release of a Product that its details show, and its line where the
// Product keeps the Ticket from Resolved (ProductItem): when it was
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

// The statuses of a Ticket in which Sentinel accepts an edit of its package
// tree: Ignored and Duplicated refuse it with 409 TICKET_NOT_MUTABLE, and a
// status that the pinned contract does not list offers no action (Sentinel
// docs/features/tickets/tickets.md, Mutability Guard; Sentinel
// docs/api-spec.md, Manual-Zone Mutability Guard; docs/behaviors.md, Unknown
// Values).
const PACKAGE_EDITABLE_STATUSES = new Set<string>([
  TicketStatusValue.new,
  TicketStatusValue.analysis,
  TicketStatusValue.analyzed,
  TicketStatusValue.resolved,
]);

// The affectedness of a track that manage_packages sets on every Ticket.
// Fixed needs admin_ticket_ops, or manage_packages on a Ticket without a CVE
// (Sentinel docs/features/packages/package-model.md, Manual Transitions).
const MANAGED_AFFECTEDNESS: readonly PackageStatusValue[] = [
  PackageStatusValue.analysis,
  PackageStatusValue.affected,
  PackageStatusValue.not_affected,
  PackageStatusValue.wont_fix,
];

// The affectedness of a track in the order of the contract, which the select
// of the affectedness follows (Sentinel docs/features/packages/package-model.md,
// Axis 1: Affectedness).
const AFFECTEDNESS_ORDER = Object.values(PackageStatusValue);

// The name of an affectedness, or the value as received.
function affectednessName(status: string): string {
  return AFFECTEDNESS.get(status)?.name ?? status;
}

// A record of the package tree that an exclusion that Sentinel confirmed
// hides, while "Show hidden" is off: a package, or a track of it, with the
// instant at which Sentinel confirmed it, after which the first read of the
// Ticket decides where the focus moves (useFocusAfterExclusion).
interface HiddenRecord {
  packageId: string;
  trackId?: string;
  at: number;
}

// The menus of the actions of the records, by the id of their record, which
// take the focus after an exclusion hides the record before them.
interface RecordTriggers {
  ref: (id: string) => (element: HTMLButtonElement | null) => void;
  get: (id: string) => HTMLButtonElement | undefined;
}

function createRecordTriggers(): RecordTriggers {
  const elements = new Map<string, HTMLButtonElement>();
  const refs = new Map<string, (element: HTMLButtonElement | null) => void>();
  return {
    ref: (id) => {
      let ref = refs.get(id);
      if (ref === undefined) {
        ref = (element) => {
          if (element === null) {
            elements.delete(id);
          } else {
            elements.set(id, element);
          }
        };
        refs.set(id, ref);
      }
      return ref;
    },
    get: (id) => elements.get(id),
  };
}

// Moves the focus to the screen's heading once a menu has closed whose
// button the screen no longer offers, as after a read of the signed-in user
// took its capability away while it was open: React Aria cannot return the
// focus to the button, which leaves the page with the menu
// (docs/behaviors.md, Accessibility, Focus after an action). Where the button
// stays, React Aria has returned the focus to it by then, and the focus
// stays there.
function handOffAfterClose() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (
        document.activeElement === null ||
        document.activeElement === document.body
      ) {
        focusScreenHeading();
      }
    });
  });
}

// What the records of the package tree need for their edits (PackagesPart).
interface TreeEdits {
  ticketId: string;
  // Whether the user excludes and restores the records: with
  // manage_packages, on a Ticket whose status accepts the edit.
  manages: boolean;
  // The affectedness that the user sets on the tracks, as the capabilities
  // and the Ticket allow (docs/screen-map.md, Roles, Principles).
  settable: ReadonlySet<string>;
  confidential: boolean;
  record: MessageRecord;
  // Reads again what an edit affects, whatever its outcome.
  readAgain: () => void;
  // Announces the outcome of an edit once the read of the Ticket after it
  // arrives, or shows it in the message area then (useOutcomeAfterRead).
  after: (text: string, inMessageArea?: boolean) => void;
  // Whether the tree shows its hidden records as an edit ends.
  showsHidden: () => boolean;
  // Tells that an exclusion hid its record (HiddenRecord).
  hid: (record: Omit<HiddenRecord, "at">) => void;
  triggers: RecordTriggers;
}

// An exclusion or a restore of a record, which sends the change.
interface MarkerChange {
  run: () => Promise<unknown>;
  pending: boolean;
}

// The callbacks of an exclusion or a restore of a record (useChangeOutcome),
// which says so in its outcome, such as "Package fictional-openssl
// excluded.": once Sentinel confirms it, the outcome waits for the read of
// the Ticket after it, announced, or shown in the message area when the
// record no longer shows, as after an exclusion while "Show hidden" is off,
// and then the focus moves on (useFocusAfterExclusion).
function useMarkerOutcome(
  edits: TreeEdits,
  record: Omit<HiddenRecord, "at">,
  text: string,
) {
  return useChangeOutcome(
    edits.record,
    () => text,
    edits.readAgain,
    ({ data }: { data: { actionable: boolean } }) => {
      const shows = edits.showsHidden() || data.actionable;
      if (!shows) {
        edits.hid(record);
      }
      edits.after(text, !shows);
    },
  );
}

// The confirmation of an exclusion that ends the access of other users to a
// confidential Ticket (docs/behaviors.md, Confirmation).
interface MarkerConfirmation {
  title: string;
  consequence: string;
  action: string;
}

interface MarkerActionsProps {
  // The record, as the name of the menu states it, such as
  // "fictional-openssl" or "fictional-openssl, SUSE:FLES-15-SP7:Update".
  name: string;
  // The record, as the messages name it, such as "Package fictional-openssl".
  subject: string;
  // Whether its own marker excludes it.
  excluded: boolean;
  confirmation?: MarkerConfirmation | undefined;
  exclude: MarkerChange;
  restore: MarkerChange;
  edits: TreeEdits;
  // The record that an exclusion hides.
  record: Omit<HiddenRecord, "at">;
}

// The menu of the actions of a package or of a track (ActionsMenu), for a
// user who excludes and restores them, and while it is open or its change is
// in progress, which keep it as it started (docs/behaviors.md, The Signed-in
// User): Exclude, or Restore for a record that its own marker excludes,
// which Sentinel accepts also below an excluded record (Sentinel
// docs/features/packages/package-model.md, Exclusion and Actionability).
// Exclude asks for confirmation where confirmation states it, and is then
// "Exclude…". While the change is in progress, its item is busy and the menu
// cannot be closed; once Sentinel answers, the menu closes and the focus
// returns to its button. The outcome is announced once the read of the
// Ticket after it arrives, or shows in the message area then when the record
// no longer shows, as after an exclusion while "Show hidden" is off. A
// failure shows in the message area, or at the top of the confirmation,
// which stays open; one that says that another user did the same meanwhile
// says the state that the record now has (docs/behaviors.md, Where Errors
// Appear; Outcome of a Change).
function MarkerActions({
  name,
  subject,
  excluded,
  confirmation,
  exclude,
  restore,
  edits,
  record,
}: MarkerActionsProps) {
  const showMessage = useShowMessage();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<DialogError>();
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }
  const pending = exclude.pending || restore.pending;
  if (!edits.manages && !open && !pending && !confirming) {
    return null;
  }

  const run = async (which: "exclude" | "restore", fromDialog: boolean) => {
    if (pending) {
      return;
    }
    setError(undefined);
    try {
      await (which === "exclude" ? exclude : restore).run();
      if (!mounted.current) {
        return;
      }
      setOpen(false);
      setConfirming(false);
    } catch (failure) {
      if (!mounted.current) {
        return;
      }
      if (!isRequestFailure(failure)) {
        setUiFailure({ error: failure });
        return;
      }
      const conflict = presentMarkerConflict(failure, which, subject);
      if (conflict !== undefined) {
        setOpen(false);
        setConfirming(false);
        handOffAfterClose();
        showMessage({ tone: "info", text: conflict });
        return;
      }
      const presentation = presentChangeFailure(failure);
      if (presentation === undefined) {
        return;
      }
      if (fromDialog) {
        setError(presentation);
        return;
      }
      setOpen(false);
      handOffAfterClose();
      showMessage({
        tone: presentation.unconfirmed ? "warning" : "danger",
        text: presentation.message,
        reference: presentation.reference,
      });
    }
  };

  let item: ReactNode;
  if (excluded) {
    item = (
      <MenuAction
        id="restore"
        icon={Undo2}
        busy={restore.pending ? "Restoring." : undefined}
        shouldCloseOnSelect={false}
        onAction={() => {
          void run("restore", false);
        }}
      >
        Restore
      </MenuAction>
    );
  } else if (confirmation === undefined) {
    item = (
      <MenuAction
        id="exclude"
        icon={Ban}
        busy={exclude.pending ? "Excluding." : undefined}
        shouldCloseOnSelect={false}
        onAction={() => {
          void run("exclude", false);
        }}
      >
        Exclude
      </MenuAction>
    );
  } else {
    item = (
      <MenuAction
        id="exclude"
        icon={Ban}
        onAction={() => {
          setError(undefined);
          setConfirming(true);
        }}
      >
        Exclude…
      </MenuAction>
    );
  }
  return (
    <>
      <FocusHandOff>
        <ActionsMenu
          label={`Actions of ${name}`}
          isOpen={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next && !edits.manages) {
              handOffAfterClose();
            }
          }}
          busy={pending}
          ref={edits.triggers.ref(record.trackId ?? record.packageId)}
        >
          {item}
        </ActionsMenu>
      </FocusHandOff>
      {confirmation !== undefined && (
        <ConfirmationDialog
          isOpen={confirming}
          onCancel={() => {
            setConfirming(false);
          }}
          title={confirmation.title}
          action={confirmation.action}
          onConfirm={() => {
            void run("exclude", true);
          }}
          isBusy={exclude.pending}
          error={error}
        >
          {confirmation.consequence}
        </ConfirmationDialog>
      )}
    </>
  );
}

interface TrackAffectednessProps {
  track: TrackDetail;
  packageId: string;
  packageName: string;
  edits: TreeEdits;
}

// The affectedness of a track: for a user who sets another value on it
// (TreeEdits), and while its menu is open or its change is in progress,
// which keep the values that it offered as it opened (docs/behaviors.md,
// The Signed-in User), a select whose choice applies at once (ChoiceMenu),
// named such as "Affectedness of fictional-openssl, SUSE:FLES-15-SP7:Update:
// Affected", which offers those values and the current one in the order of
// the contract (Sentinel docs/features/packages/package-model.md, Change
// Track Status); otherwise, and for a value that the pinned contract does
// not list, the value with its mark. It asks for no confirmation
// (docs/behaviors.md, Confirmation). The outcome is announced once the read
// of the Ticket after it arrives, such as "Affectedness of
// fictional-openssl · SUSE:FLES-15-SP7:Update changed to Affected."; a
// failure shows in the message area.
function TrackAffectedness({
  track,
  packageId,
  packageName,
  edits,
}: TrackAffectednessProps) {
  const showMessage = useShowMessage();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [offeredAtOpen, setOfferedAtOpen] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const subject = `${packageName} · ${track.reference}`;
  const changedText = ({ data }: TrackStatusResponse) =>
    `Affectedness of ${subject} changed to ${affectednessName(data.status)}.`;
  const change = useChangeTrackStatus({
    mutation: useChangeOutcome(
      edits.record,
      changedText,
      edits.readAgain,
      (response: TrackStatusResponse) => {
        edits.after(changedText(response));
      },
    ),
  });
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }
  const pending = change.isPending;
  const choicesOf = (settable: ReadonlySet<string>) =>
    AFFECTEDNESS_ORDER.filter(
      (status) => settable.has(status) || status === track.status,
    );
  // Whether the values settable offer another value than the current one,
  // which the pinned contract lists.
  const offers = (settable: ReadonlySet<string>) =>
    AFFECTEDNESS.has(track.status) &&
    choicesOf(settable).some((status) => status !== track.status);
  const choices = choicesOf(open || pending ? offeredAtOpen : edits.settable);
  const value = <MarkedValue value={track.status} known={AFFECTEDNESS} />;
  if (!open && !pending && !offers(edits.settable)) {
    return value;
  }

  const choose = async (choice: string) => {
    const status = AFFECTEDNESS_ORDER.find((known) => known === choice);
    if (pending || status === undefined) {
      return;
    }
    try {
      await change.mutateAsync({
        ticketId: edits.ticketId,
        packageId,
        trackId: track.id,
        data: { status },
      });
      if (mounted.current) {
        setOpen(false);
      }
    } catch (failure) {
      if (!mounted.current) {
        return;
      }
      if (!isRequestFailure(failure)) {
        setUiFailure({ error: failure });
        return;
      }
      setOpen(false);
      handOffAfterClose();
      const presentation = presentChangeFailure(failure);
      if (presentation !== undefined) {
        showMessage({
          tone: presentation.unconfirmed ? "warning" : "danger",
          text: presentation.message,
          reference: presentation.reference,
        });
      }
    }
  };

  return (
    <FocusHandOff>
      <ChoiceMenu
        label={`Affectedness of ${packageName}, ${track.reference}: ${affectednessName(track.status)}`}
        value={value}
        choices={choices.map((status) => ({
          id: status,
          textValue: affectednessName(status),
          content: <MarkedValue value={status} known={AFFECTEDNESS} />,
        }))}
        chosen={track.status}
        busy={pending ? (change.variables?.data.status ?? null) : null}
        busyText="Changing the affectedness."
        isOpen={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setOfferedAtOpen(edits.settable);
          } else if (!offers(edits.settable)) {
            handOffAfterClose();
          }
        }}
        onChoose={(choice) => {
          void choose(choice);
        }}
      />
    </FocusHandOff>
  );
}

// Where the focus moves after an exclusion hides its record while "Show
// hidden" is off, once the read of the Ticket after it shows the record no
// longer (docs/behaviors.md, Accessibility, Focus after an action): after a
// track, to the menu of the actions of the next track of its package that
// shows, otherwise to that of its package, and, when the package no longer
// shows either, as after an exclusion of the package: to the menu of the
// next package that shows, otherwise to "Show hidden", which leads to
// Restore. When that read fails, the focus stays where it is, and it moves
// only from the record that left the page, or from the screen's heading,
// so that a user who moved it meanwhile keeps it.
function useFocusAfterExclusion(
  packages: readonly PackageDetail[],
  read: { dataUpdatedAt: number; errorUpdatedAt: number },
  triggers: RecordTriggers,
  showHidden: RefObject<HTMLElement | null>,
) {
  const hidden = useRef<HiddenRecord>(undefined);
  const readAt = read.dataUpdatedAt;
  const failedAt = read.errorUpdatedAt;
  // In the render that removes the record, before the record that left
  // hands the focus to the screen's heading (useFocusHeadingOnRemoval), so
  // that the page does not scroll to the heading on its way.
  useLayoutEffect(() => {
    const gone = hidden.current;
    if (gone === undefined) {
      return;
    }
    if (failedAt >= gone.at && readAt < gone.at) {
      hidden.current = undefined;
      return;
    }
    if (readAt < gone.at) {
      return;
    }
    hidden.current = undefined;
    const index = packages.findIndex((item) => item.id === gone.packageId);
    const ticketPackage = packages[index];
    let target: HTMLElement | null | undefined;
    if (gone.trackId !== undefined && ticketPackage?.actionable === true) {
      const tracks = ticketPackage.tracks;
      const at = tracks.findIndex((track) => track.id === gone.trackId);
      if (tracks[at]?.actionable === true) {
        return;
      }
      const next = tracks.slice(at + 1).find((track) => track.actionable);
      target = triggers.get(next?.id ?? ticketPackage.id);
    } else {
      if (gone.trackId === undefined && ticketPackage?.actionable === true) {
        return;
      }
      const next = packages.slice(index + 1).find((item) => item.actionable);
      target =
        next === undefined
          ? showHidden.current?.querySelector("input")
          : triggers.get(next.id);
    }
    const active = document.activeElement;
    if (
      (active === null || active === document.body || active.matches("h1")) &&
      target !== null &&
      target !== undefined
    ) {
      target.focus();
    }
  }, [packages, readAt, failedAt, triggers, showHidden]);
  return useCallback((record: Omit<HiddenRecord, "at">) => {
    hidden.current = { ...record, at: Date.now() };
  }, []);
}

interface ProductDetailsProps {
  product: ProductDetail;
  release: Release | undefined;
}

interface OverrideProvenanceProps {
  product: ProductDetail;
}

// Who set the eligibility of a Product by hand and when, below its value, in
// text-13, fg-muted: "Set by", the user in the name form, which wraps, since
// nothing else in the details shows it whole, "on", and the date and time on
// one line. The user is the setter's current profile, so a user deactivated
// since shows as inactive. Sentinel returns both with every override
// (Sentinel docs/features/packages/package-model.md, Override Model); a value
// that is absent shows as an absent value, never as System, since no system
// task sets an override.
function OverrideProvenance({ product }: OverrideProvenanceProps) {
  const setter = product.eligibility_override_by;
  return (
    <p className="mt-0.5 text-13 text-fg-muted">
      Set by{" "}
      {setter === null ? (
        <AbsentValue />
      ) : (
        <User user={setter} withAvatar={false} wrap />
      )}{" "}
      on{" "}
      <span className="whitespace-nowrap">
        <MaybeDateTime value={product.eligibility_override_at} />
      </span>
    </p>
  );
}

// The details of a Product, as its popover shows them: its eligibility, and,
// when it is set by hand, user-pen at 14 px in fg-muted 4 px after it, read
// as ", set by hand", and who set it and when below it (OverrideProvenance);
// its lifecycle phase, or "Not available" without lifecycle data; its
// release, where it has one (releaseOf); and, for a Product that takes no
// part, why. Values that the pinned contract does not list show as received.
function ProductDetails({ product, release }: ProductDetailsProps) {
  return (
    <DescriptionList>
      <DescriptionItem term="Eligibility">
        <span className="inline-flex items-center gap-1">
          {product.eligible ? "Eligible" : "Not eligible"}
          {product.is_eligible_override && (
            <>
              <UserPen aria-hidden className="size-3.5 text-fg-muted" />
              <span className="sr-only">, set by hand</span>
            </>
          )}
        </span>
        {product.is_eligible_override && (
          <OverrideProvenance product={product} />
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
// weight 500, warning-on-soft, at the end of the next line where the line
// wraps.
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
        <span className="ms-auto inline-flex items-center gap-1 text-13 font-medium text-warning-on-soft">
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
function SubmissionRequests({
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
function ReleaseRequests({
  ticketId,
  packageName,
  reference,
  empty,
}: TrackRequestsProps) {
  const { params, options } = requestsQuery(packageName, reference);
  const read = useListReleaseRequests(ticketId, params, options);
  return <RequestCell read={read} kind={RELEASE_REQUEST} empty={empty} />;
}

interface TrackActionsProps {
  track: TrackDetail;
  packageId: string;
  packageName: string;
  edits: TreeEdits;
}

// The menu of the actions of a track (MarkerActions), with Exclude, Soft-Delete
// Track, POST .../packages/{package_id}/tracks/{track_id}/exclude, or
// Restore, Restore Track, POST .../tracks/{track_id}/restore (Sentinel
// docs/features/packages/package-model.md, Soft-Delete Track; Restore
// Track), neither with confirmation: the exclusion of a track ends no access,
// since maintainership concerns the package (Sentinel
// docs/features/packages/package-maintainership.md, Confidential Ticket
// Visibility).
function TrackActions({
  track,
  packageId,
  packageName,
  edits,
}: TrackActionsProps) {
  const subject = `Track ${packageName} · ${track.reference}`;
  const ids = { ticketId: edits.ticketId, packageId, trackId: track.id };
  const exclude = useExcludeTrack({
    mutation: useMarkerOutcome(
      edits,
      { packageId, trackId: track.id },
      `${subject} excluded.`,
    ),
  });
  const restore = useRestoreTrack({
    mutation: useMarkerOutcome(
      edits,
      { packageId, trackId: track.id },
      `${subject} restored.`,
    ),
  });
  return (
    <MarkerActions
      name={`${packageName}, ${track.reference}`}
      subject={subject}
      excluded={track.deleted_at !== null}
      exclude={{
        run: () => exclude.mutateAsync(ids),
        pending: exclude.isPending,
      }}
      restore={{
        run: () => restore.mutateAsync(ids),
        pending: restore.isPending,
      }}
      edits={edits}
      record={{ packageId, trackId: track.id }}
    />
  );
}

interface TrackItemProps {
  ticketId: string;
  packageId: string;
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
  edits: TreeEdits;
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
// with a pipeline, in Phases. On an IBS track of a Ticket with a CVE, Phases
// shows the latest submission request at the end of the line of Submission
// and the latest release request at the end of the line of QA, and the
// delivery on the line of a track without a pipeline opens the same requests.
// For a user who can edit them, the affectedness is a select, in a place at
// least as wide as the select of Not affected, and the menu of the actions
// of the track ends the line. Then its Products, as a list with a border
// line at its left. A hidden track shows its hidden Products; another track
// only while "Show hidden" is on.
function TrackItem({
  ticketId,
  packageId,
  packageName,
  track,
  packageHidden,
  waitsForYou,
  hasCve,
  showHidden,
  now,
  edits,
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
  const subject = `${packageName}, ${track.reference}`;
  // Sentinel correlates IBS requests only to the IBS tracks of a Ticket with
  // a CVE, through the CVE that their diff names (Sentinel
  // docs/features/packages/ibs-submission-tracking.md, Scope; Action-Scoped
  // CVE Evidence), so the requests of any other track are not read.
  const requests = hasCve && track.workflow_type === "ibs";
  const target = { ticketId, packageName, reference: track.reference };
  // The submission requests show under Submission, and the release requests
  // under QA: UM creates a release request to end its phase, and the request
  // then waits for the tests of QA (Sentinel
  // docs/features/tickets/ticket-deadlines.md, Actors and Phases; Completion
  // Evidence).
  const extras: PhaseExtras | undefined = requests
    ? {
        submission: <SubmissionRequests {...target} />,
        qa: <ReleaseRequests {...target} />,
      }
    : undefined;
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
              subject={subject}
              now={now}
              delivery={delivery ? track.delivery_status : undefined}
              extras={extras}
            />
          ) : (
            delivery && (
              <TrackDelivery
                status={track.delivery_status}
                records={
                  requests
                    ? {
                        subject,
                        content: (
                          <DescriptionList fittedTerms>
                            <DescriptionItem term="Submission">
                              <SubmissionRequests {...target} empty="None" />
                            </DescriptionItem>
                            <DescriptionItem term="QA">
                              <ReleaseRequests {...target} empty="None" />
                            </DescriptionItem>
                          </DescriptionList>
                        ),
                      }
                    : undefined
                }
              />
            )
          )}
          <span className="flex items-center gap-1">
            <span className={edits.settable.size > 0 ? "min-w-34" : "min-w-26"}>
              <TrackAffectedness
                track={track}
                packageId={packageId}
                packageName={packageName}
                edits={edits}
              />
            </span>
            <TrackActions
              track={track}
              packageId={packageId}
              packageName={packageName}
              edits={edits}
            />
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

interface PackageActionsProps {
  ticketPackage: PackageDetail;
  edits: TreeEdits;
}

// The menu of the actions of a package (MarkerActions), with Exclude,
// Soft-Delete Package from Ticket, POST .../packages/{package_id}/exclude,
// or Restore, Restore Package, POST .../packages/{package_id}/restore
// (Sentinel docs/features/packages/package-model.md, Soft-Delete Package
// from Ticket; Restore Package). On a confidential Ticket, the exclusion of
// a package with maintainers asks for confirmation, since it ends their
// access to the Ticket unless another path gives it to them, which Restore
// gives back (docs/behaviors.md, Confirmation; Sentinel
// docs/features/packages/package-maintainership.md, Confidential Ticket
// Visibility).
function PackageActions({ ticketPackage, edits }: PackageActionsProps) {
  const name = ticketPackage.package_name;
  const subject = `Package ${name}`;
  const ids = { ticketId: edits.ticketId, packageId: ticketPackage.id };
  const exclude = useExcludePackage({
    mutation: useMarkerOutcome(
      edits,
      { packageId: ticketPackage.id },
      `${subject} excluded.`,
    ),
  });
  const restore = useRestorePackage({
    mutation: useMarkerOutcome(
      edits,
      { packageId: ticketPackage.id },
      `${subject} restored.`,
    ),
  });
  return (
    <MarkerActions
      name={name}
      subject={subject}
      excluded={ticketPackage.deleted_at !== null}
      confirmation={
        edits.confidential && ticketPackage.maintainers.length > 0
          ? {
              title: `Exclude ${name}?`,
              consequence: `The maintainers of ${name} no longer see this confidential Ticket, unless their roles, an access grant, or another package that they maintain let them. Restore gives them this access back.`,
              action: "Exclude package",
            }
          : undefined
      }
      exclude={{
        run: () => exclude.mutateAsync(ids),
        pending: exclude.isPending,
      }}
      restore={{
        run: () => restore.mutateAsync(ids),
        pending: restore.isPending,
      }}
      edits={edits}
      record={{ packageId: ticketPackage.id }}
    />
  );
}

interface PackageGroupProps {
  ticketId: string;
  ticketPackage: PackageDetail;
  // The keys of the tracks that wait for the signed-in user (trackKey).
  waiting: ReadonlySet<string>;
  // Whether the Ticket has a CVE.
  hasCve: boolean;
  showHidden: boolean;
  now: number;
  edits: TreeEdits;
}

// A package as a group under a band (GroupBand): its name as a level-three
// heading, its maintainers, and the label of its own hidden state, and at
// its end the menu of its actions; its tracks follow 12 px below the band,
// indented by 12 px, 12 px apart. A hidden package shows its hidden tracks;
// another package only while "Show hidden" is on.
function PackageGroup({
  ticketId,
  ticketPackage,
  waiting,
  hasCve,
  showHidden,
  now,
  edits,
}: PackageGroupProps) {
  const ref = useRef<HTMLLIElement>(null);
  useFocusHeadingOnRemoval(ref);
  const hidden = !ticketPackage.actionable;
  const tracks = ticketPackage.tracks.filter(
    (track) => showHidden || track.actionable,
  );
  return (
    <li ref={ref}>
      <GroupBand
        heading={ticketPackage.package_name}
        level={3}
        muted={hidden}
        actions={<PackageActions ticketPackage={ticketPackage} edits={edits} />}
      >
        <Maintainers
          users={ticketPackage.maintainers}
          packageName={ticketPackage.package_name}
        />
        <HiddenLabels excluded={ticketPackage.deleted_at !== null} />
      </GroupBand>
      {tracks.length > 0 && (
        <ul className="mx-3 mt-3 flex flex-col gap-3 text-15">
          {tracks.map((track) => (
            <TrackItem
              key={track.id}
              ticketId={ticketId}
              packageId={ticketPackage.id}
              packageName={ticketPackage.package_name}
              track={track}
              packageHidden={hidden}
              waitsForYou={waiting.has(
                trackKey(ticketPackage.package_name, track.reference),
              )}
              hasCve={hasCve}
              showHidden={showHidden}
              now={now}
              edits={edits}
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
// order of the API: each package as a group under a band, 32 px
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
// are hidden.". A user who holds manage_packages, on a Ticket whose status
// accepts the edit, excludes and restores its packages and tracks and sets
// their affectedness, and a user who holds admin_ticket_ops sets Fixed, as
// does manage_packages on a Ticket without a CVE (TreeEdits; Sentinel
// docs/features/identity/rbac.md, Endpoint Permission Map, Ticket Packages);
// after an edit, the screen reads again what it affects.
function PackagesPart({ ticket, now, yourWork }: PackagesPartProps) {
  const { hidden } = ticketOverviewRoute.useSearch();
  const navigate = useNavigate();
  const showHidden = hidden === HIDDEN_SHOWN;
  const ticketId = ticket.ticket_id;
  const user = useSignedInUser();
  const ticketRead = useGetTicket(ticketId, { query: { enabled: false } });
  const record = useMemo(() => ticketRecord(ticketId), [ticketId]);
  const outcome = useOutcomeAfterRead(ticketRead, record);
  const readAgain = useReadAfterTicketChange(ticketId);
  const [triggers] = useState(createRecordTriggers);
  const switchPlace = useRef<HTMLSpanElement>(null);
  const hid = useFocusAfterExclusion(
    ticket.packages,
    ticketRead,
    triggers,
    switchPlace,
  );
  const showsHidden = useRef(showHidden);
  useLayoutEffect(() => {
    showsHidden.current = showHidden;
  }, [showHidden]);
  const capabilities = user?.capabilities ?? [];
  const editable = PACKAGE_EDITABLE_STATUSES.has(ticket.status);
  const manages = editable && capabilities.includes("manage_packages");
  const fixes =
    editable &&
    (capabilities.includes("admin_ticket_ops") ||
      (manages && ticket.cve === null));
  const settable = useMemo(
    () =>
      new Set<string>([
        ...(manages ? MANAGED_AFFECTEDNESS : []),
        ...(fixes ? [PackageStatusValue.fixed] : []),
      ]),
    [manages, fixes],
  );
  const edits: TreeEdits = {
    ticketId,
    manages,
    settable,
    confidential: ticket.is_confidential,
    record,
    readAgain,
    after: outcome.after,
    showsHidden: () => showsHidden.current,
    hid,
    triggers,
  };
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
  // The announcements of the edits follow the part, apart from the warning
  // of the read of the work of a maintainer, which is its status region.
  const part = (
    <Part
      id={PACKAGES_ANCHOR}
      heading="Packages"
      actions={
        ticket.packages.length > 0 ? (
          <span ref={switchPlace} className="contents">
            <Switch
              isSelected={showHidden}
              onChange={toggle}
              isDisabled={count === 0}
            >
              Show hidden{" "}
              <span className="tabular-nums">{COUNT.format(count)}</span>
            </Switch>
          </span>
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
                ticketId={ticket.ticket_id}
                ticketPackage={ticketPackage}
                waiting={waiting}
                hasCve={ticket.cve !== null}
                showHidden={showHidden}
                now={now}
                edits={edits}
              />
            ))}
          </ul>
        )}
      </div>
    </Part>
  );
  return (
    <>
      {part}
      {outcome.region}
    </>
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
  return { name, value: valueInWords(value) };
}

// A value of a metric that the pinned contract lists in sentence case, such
// as adjacent_network as "Adjacent network".
function valueInWords(value: string): string {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
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
    // The provider carries the identifier of its assessment, by which the
    // part finds its row (CvssPart).
    render: (assessment) => (
      <span data-assessment-id={assessment.id}>{assessment.provider_name}</span>
    ),
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
  ticket: TicketDetail;
}

// ----------------------------------------------------------------------------
// The SUSE assessment

// The versions of the SUSE assessment that the screen adds, edits, and
// deletes: those that can be the default CVSS version. Sentinel accepts a
// SUSE assessment of every version that it lists, and the screen shows one of
// another version read-only (docs/screens/ticket.md, Actions; Sentinel
// docs/features/tickets/cvss-scoring.md, Set or Update SUSE CVSS Assessment).
const EDITABLE_VERSIONS = ["3.1", "4.0"] as const;

type EditableVersion = (typeof EDITABLE_VERSIONS)[number];

function isEditableVersion(version: string): version is EditableVersion {
  return EDITABLE_VERSIONS.some((item) => item === version);
}

// The provider of the SUSE assessment, as Sentinel stores it (Sentinel
// docs/features/tickets/cvss-scoring.md, Provider Identity and Authority).
const SUSE = "SUSE";

// The statuses of a Ticket in which Sentinel accepts a change of the SUSE
// assessment of its CVE: Ignored and Duplicated refuse it with 409
// TICKET_NOT_MUTABLE, and a status that the pinned contract does not list
// offers no action (Sentinel docs/features/tickets/ticket-mutations.md, CVSS
// Status Matrix; docs/behaviors.md, Unknown Values).
const SUSE_CHANGEABLE_STATUSES = new Set<string>([
  TicketStatusValue.new,
  TicketStatusValue.analysis,
  TicketStatusValue.analyzed,
  TicketStatusValue.resolved,
]);

// Whether the screen edits and deletes an assessment: one of SUSE in a
// version that it changes.
function isChangeable(assessment: CVSSAssessmentItem): boolean {
  return (
    assessment.provider_name === SUSE &&
    isEditableVersion(assessment.cvss_version)
  );
}

// The versions of which SUSE has no assessment, which Add SUSE assessment
// adds.
function versionsToAdd(
  assessments: readonly CVSSAssessmentItem[],
): EditableVersion[] {
  return EDITABLE_VERSIONS.filter(
    (version) =>
      !assessments.some(
        (assessment) =>
          assessment.provider_name === SUSE &&
          assessment.cvss_version === version,
      ),
  );
}

// The longest vector that Set or Update SUSE CVSS Assessment accepts, in
// characters, as Sentinel counts them, by code point (Sentinel
// docs/features/tickets/cvss-scoring.md, Input Rules).
const VECTOR_MAX_LENGTH = 200;

// A value of a metric: its letter in the vector and its value in the API,
// whose words name it (Sentinel docs/features/tickets/cvss-scoring.md, CVSS
// v3.0 and v3.1 Base Metrics; CVSS v4.0 Base Metrics).
interface FormValue {
  letter: string;
  value: string;
}

// A metric of the form: its abbreviation in the vector, its field in
// metrics of the API, its name, and its values from the one that lowers the
// Base score to the one that raises it, in every version.
interface FormMetric {
  abbreviation: string;
  field: string;
  name: string;
  values: readonly FormValue[];
}

interface FormGroup {
  term: string;
  metrics: readonly FormMetric[];
}

// The form of a version: the prefix of its vectors and its metrics, in the
// groups of FIRST's specification of the version, by the names that the
// popover of a vector gives them.
interface VersionForm {
  prefix: string;
  groups: readonly FormGroup[];
}

const ATTACK_VECTOR: readonly FormValue[] = [
  { letter: "P", value: CVSSAttackVector.physical },
  { letter: "L", value: CVSSAttackVector.local },
  { letter: "A", value: CVSSAttackVector.adjacent },
  { letter: "N", value: CVSSAttackVector.network },
];

const ATTACK_COMPLEXITY: readonly FormValue[] = [
  { letter: "H", value: CVSSAttackComplexity.high },
  { letter: "L", value: CVSSAttackComplexity.low },
];

const PRIVILEGES_REQUIRED: readonly FormValue[] = [
  { letter: "H", value: CVSSPrivilegesRequired.high },
  { letter: "L", value: CVSSPrivilegesRequired.low },
  { letter: "N", value: CVSSPrivilegesRequired.none },
];

const NONE_LOW_HIGH: readonly FormValue[] = [
  { letter: "N", value: CVSSImpact.none },
  { letter: "L", value: CVSSImpact.low },
  { letter: "H", value: CVSSImpact.high },
];

const VERSION_FORMS: Readonly<Record<EditableVersion, VersionForm>> = {
  "3.1": {
    prefix: "CVSS:3.1/",
    groups: [
      {
        term: "Exploitability",
        metrics: [
          {
            abbreviation: "AV",
            field: "attack_vector",
            name: "Attack vector",
            values: ATTACK_VECTOR,
          },
          {
            abbreviation: "AC",
            field: "attack_complexity",
            name: "Attack complexity",
            values: ATTACK_COMPLEXITY,
          },
          {
            abbreviation: "PR",
            field: "privileges_required",
            name: "Privileges required",
            values: PRIVILEGES_REQUIRED,
          },
          {
            abbreviation: "UI",
            field: "user_interaction",
            name: "User interaction",
            values: [
              { letter: "R", value: CVSS3UserInteraction.required },
              { letter: "N", value: CVSS3UserInteraction.none },
            ],
          },
        ],
      },
      {
        term: "Scope",
        metrics: [
          {
            abbreviation: "S",
            field: "scope",
            name: "Scope",
            values: [
              { letter: "U", value: CVSS3Scope.unchanged },
              { letter: "C", value: CVSS3Scope.changed },
            ],
          },
        ],
      },
      {
        term: "Impact",
        metrics: [
          {
            abbreviation: "C",
            field: "confidentiality_impact",
            name: "Confidentiality",
            values: NONE_LOW_HIGH,
          },
          {
            abbreviation: "I",
            field: "integrity_impact",
            name: "Integrity",
            values: NONE_LOW_HIGH,
          },
          {
            abbreviation: "A",
            field: "availability_impact",
            name: "Availability",
            values: NONE_LOW_HIGH,
          },
        ],
      },
    ],
  },
  "4.0": {
    prefix: "CVSS:4.0/",
    groups: [
      {
        term: "Exploitability",
        metrics: [
          {
            abbreviation: "AV",
            field: "attack_vector",
            name: "Attack vector",
            values: ATTACK_VECTOR,
          },
          {
            abbreviation: "AC",
            field: "attack_complexity",
            name: "Attack complexity",
            values: ATTACK_COMPLEXITY,
          },
          {
            abbreviation: "AT",
            field: "attack_requirements",
            name: "Attack requirements",
            values: [
              { letter: "P", value: CVSS4AttackRequirements.present },
              { letter: "N", value: CVSS4AttackRequirements.none },
            ],
          },
          {
            abbreviation: "PR",
            field: "privileges_required",
            name: "Privileges required",
            values: PRIVILEGES_REQUIRED,
          },
          {
            abbreviation: "UI",
            field: "user_interaction",
            name: "User interaction",
            values: [
              { letter: "A", value: CVSS4UserInteraction.active },
              { letter: "P", value: CVSS4UserInteraction.passive },
              { letter: "N", value: CVSS4UserInteraction.none },
            ],
          },
        ],
      },
      {
        term: "Vulnerable system",
        metrics: [
          {
            abbreviation: "VC",
            field: "vulnerable_system_confidentiality",
            name: "Confidentiality",
            values: NONE_LOW_HIGH,
          },
          {
            abbreviation: "VI",
            field: "vulnerable_system_integrity",
            name: "Integrity",
            values: NONE_LOW_HIGH,
          },
          {
            abbreviation: "VA",
            field: "vulnerable_system_availability",
            name: "Availability",
            values: NONE_LOW_HIGH,
          },
        ],
      },
      {
        term: "Subsequent system",
        metrics: [
          {
            abbreviation: "SC",
            field: "subsequent_system_confidentiality",
            name: "Confidentiality",
            values: NONE_LOW_HIGH,
          },
          {
            abbreviation: "SI",
            field: "subsequent_system_integrity",
            name: "Integrity",
            values: NONE_LOW_HIGH,
          },
          {
            abbreviation: "SA",
            field: "subsequent_system_availability",
            name: "Availability",
            values: NONE_LOW_HIGH,
          },
        ],
      },
    ],
  },
};

function formMetrics(version: EditableVersion): FormMetric[] {
  return VERSION_FORMS[version].groups.flatMap((group) => group.metrics);
}

// The values that a vector chooses, by the abbreviation of their metric.
type Chosen = ReadonlyMap<string, string>;

// The metrics that a vector of the version chooses: each metric of the
// version followed by one of its letters, the last one where a metric
// repeats; nothing for a vector of another version.
function chosenOf(version: EditableVersion, vector: string): Chosen {
  const { prefix } = VERSION_FORMS[version];
  const text = vector.trim();
  const chosen = new Map<string, string>();
  if (!text.startsWith(prefix)) {
    return chosen;
  }
  const metrics = formMetrics(version);
  for (const token of text.slice(prefix.length).split("/")) {
    const [abbreviation, letter] = token.split(":");
    const metric = metrics.find((item) => item.abbreviation === abbreviation);
    if (
      metric !== undefined &&
      metric.values.some((item) => item.letter === letter) &&
      letter !== undefined
    ) {
      chosen.set(metric.abbreviation, letter);
    }
  }
  return chosen;
}

// The vector of the metrics chosen, in FIRST's order, or nothing without
// any: Sentinel checks it as it is (Sentinel
// docs/features/tickets/cvss-scoring.md, Input Rules).
function vectorOf(version: EditableVersion, chosen: Chosen): string {
  const tokens = formMetrics(version).flatMap((metric) => {
    const letter = chosen.get(metric.abbreviation);
    return letter === undefined ? [] : [`${metric.abbreviation}:${letter}`];
  });
  return tokens.length === 0
    ? ""
    : `${VERSION_FORMS[version].prefix}${tokens.join("/")}`;
}

// The value of a field of the metrics of an assessment, or undefined.
function metricValue(
  assessment: CVSSAssessmentItem,
  field: string,
): string | undefined {
  const value: unknown = Object.entries(assessment.metrics).find(
    ([name]) => name === field,
  )?.[1];
  return typeof value === "string" ? value : undefined;
}

// An assessment as an option of Start from: its provider, its score, and its
// severity with its mark, such as "NVD, 7.5 ● High", which the keyboard finds
// by its text (docs/design-system.md, Severity; Forms).
function assessmentOption(
  value: string,
  provider: string,
  assessment: CVSSAssessmentItem,
): FieldOption<string> {
  return {
    value,
    label: `${provider}, ${SCORE.format(assessment.score)} ${severityName(assessment.severity)}`,
    content: (
      <span className="inline-flex items-baseline gap-1">
        {`${provider},`} <Score value={assessment.score} />{" "}
        <Severity severity={assessment.severity} />
      </span>
    ),
  };
}

// The length of a text as Sentinel counts it, by code point.
function codePoints(value: string): number {
  // oxlint-disable-next-line typescript/no-misused-spread -- the code points are what Sentinel counts, as Python's len does
  return [...value].length;
}

interface MetricColumnProps {
  version: EditableVersion;
  groups: readonly FormGroup[];
  chosen: Chosen;
  // The assessments of the other providers of the version.
  others: readonly CVSSAssessmentItem[];
  onChoose: (abbreviation: string, letter: string) => void;
}

// A column of the metrics: each group its heading, then each metric its
// name on the line of its values, a segmented control, the names in a
// column of 140 px, or above their values where the form is narrower than
// 320 px, and, below a metric whose choice differs from that of
// another provider's assessment, that provider's value, such as "NVD:
// Network", which assistive technologies read with the control. A metric
// whose name repeats in the version, such as Confidentiality in v4.0, is
// named with the term of its group too.
function MetricColumn({
  version,
  groups,
  chosen,
  others,
  onChoose,
}: MetricColumnProps) {
  const id = useId();
  const names = formMetrics(version).map((metric) => metric.name);
  return (
    <div className="grid grid-cols-1 content-start items-center gap-x-3 gap-y-2 @min-[20rem]:grid-cols-[8.75rem_auto]">
      {groups.map((group, index) => {
        const groupId = `${id}-group-${index}`;
        return (
          <Fragment key={group.term}>
            <h3
              id={groupId}
              className={`col-span-full text-14 font-semibold ${index > 0 ? "mt-3" : ""}`}
            >
              {group.term}
            </h3>
            {group.metrics.map((metric) => {
              const nameId = `${id}-${metric.abbreviation}`;
              const differsId = `${nameId}-differs`;
              const letter = chosen.get(metric.abbreviation);
              const differs =
                letter === undefined
                  ? []
                  : others.flatMap((other) => {
                      const theirs = metric.values.find(
                        (item) =>
                          item.value === metricValue(other, metric.field),
                      );
                      return theirs === undefined || theirs.letter === letter
                        ? []
                        : [
                            `${other.provider_name}: ${valueInWords(theirs.value)}`,
                          ];
                    });
              const repeated =
                names.filter((name) => name === metric.name).length > 1;
              return (
                <Fragment key={metric.abbreviation}>
                  <span id={nameId} className="text-14">
                    {metric.name}
                  </span>
                  <SegmentedControl
                    labelledBy={repeated ? `${nameId} ${groupId}` : nameId}
                    describedBy={differs.length > 0 ? differsId : undefined}
                    options={metric.values.map((item) => ({
                      value: item.letter,
                      label: valueInWords(item.value),
                    }))}
                    value={letter}
                    onChange={(next) => {
                      onChoose(metric.abbreviation, next);
                    }}
                  />
                  {differs.length > 0 && (
                    // It wraps within its column, which it does not widen.
                    <span
                      id={differsId}
                      className="-mt-1 w-0 min-w-full text-13 text-fg-muted @min-[20rem]:col-start-2"
                    >
                      {differs.join(" · ")}
                    </span>
                  )}
                </Fragment>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

// How long the dialog waits once the vector stops changing before it reads
// its score, so that it does not read it at each key.
export const SCORE_DELAY_MS = 250;

// A vector of the form of a version.
interface VersionVector {
  version: EditableVersion;
  vector: string;
}

// The vector once it has stopped changing for SCORE_DELAY_MS; the tab of
// another version shows its own vector at once.
function usePausedVector(version: EditableVersion, vector: string): string {
  const [paused, setPaused] = useState<VersionVector>({ version, vector });
  if (paused.version !== version) {
    setPaused({ version, vector });
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      setPaused({ version, vector });
    }, SCORE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [version, vector]);
  return paused.version === version ? paused.vector : vector;
}

// Whether a read of a score failed with a 422, CVSS_INVALID_VECTOR or
// VALIDATION_ERROR, which depends on the vector alone.
function rejectsVector(error: unknown): boolean {
  return error instanceof ApiError && error.status === 422;
}

// The read of the score of a vector, sent when enabled. Its result depends
// only on the vector (Sentinel docs/features/tickets/cvss-scoring.md,
// Calculate CVSS Base Score), so the score of a vector is read once, and so
// is a vector that Sentinel rejects; Try again reads it again.
function useBaseScore(vector: string, enabled: boolean) {
  return useGetCvssBaseScore(
    { vector_string: vector },
    {
      query: {
        enabled: (query) => enabled && !rejectsVector(query.state.error),
        staleTime: Infinity,
      },
    },
  );
}

type BaseScoreRead = ReturnType<typeof useBaseScore>;

// What the place of the score shows for a vector: why it has no score,
// without a read; its score as Sentinel's read returns it; that Sentinel
// rejects it; the failure of the read; or nothing yet.
type ScoreOutcome =
  | { kind: "none"; reason: string }
  | { kind: "score"; score: number; severity: string }
  | { kind: "rejected" }
  | { kind: "failed"; read: BaseScoreRead }
  | { kind: "waiting" };

function scoreOutcome(
  reason: string | null,
  read: BaseScoreRead,
  version: EditableVersion,
): ScoreOutcome {
  if (reason !== null) {
    return { kind: "none", reason };
  }
  if (read.status === "success") {
    return {
      kind: "score",
      score: read.data.data.score,
      severity: read.data.data.severity,
    };
  }
  if (read.status === "error") {
    return isRequestFailure(read.error) &&
      cvssVectorError(read.error, version) !== undefined
      ? { kind: "rejected" }
      : { kind: "failed", read };
  }
  return { kind: "waiting" };
}

// What a vector that Sentinel rejects says in the place of its score.
const REJECTED_TEXT = "Sentinel doesn't accept this vector.";

interface ScorePlaceProps {
  outcome: ScoreOutcome;
  // Whether the score of the vector is being read, while the outcome of the
  // vector before it shows, or nothing yet.
  updating: boolean;
}

// The Base score of the vector of the form, beside Start from, at the end of
// the second column, or after Start from in one column: the score in
// text-40, as the calculator of FIRST shows it, and below it the severity
// with its mark in text-20, both at weight 600, without a label. A vector
// that Sentinel does not score shows 0.0 and None in fg-muted, which
// assistive technologies read as the reason, such as "No score. Choose every
// metric."; the failure of the read shows in its place, with Try again. A
// status region, so that each outcome is announced without moving the
// focus, once the vector has paused; what shows while the next outcome is
// read is marked as being updated (docs/behaviors.md, Loading). It does not
// widen its column.
function ScorePlace({ outcome, updating }: ScorePlaceProps) {
  let content: ReactNode = null;
  if (outcome.kind === "score") {
    content = (
      <>
        <span
          aria-hidden
          className="text-40 font-semibold tabular-nums text-fg"
        >
          {SCORE.format(outcome.score)}
        </span>
        <span aria-hidden className="text-20 font-semibold">
          <Severity severity={outcome.severity} />
        </span>
        <span className="sr-only">{`Base score ${SCORE.format(outcome.score)}, ${severityName(outcome.severity)}`}</span>
      </>
    );
  } else if (outcome.kind === "none" || outcome.kind === "rejected") {
    content = (
      <>
        <span
          aria-hidden
          className="text-40 font-semibold tabular-nums text-fg-muted"
        >
          {SCORE.format(0)}
        </span>
        <span aria-hidden className="text-20 font-semibold">
          <Severity severity="none" muted />
        </span>
        <span className="sr-only">{`No score. ${outcome.kind === "none" ? outcome.reason : REJECTED_TEXT}`}</span>
      </>
    );
  } else if (outcome.kind === "failed") {
    const { read } = outcome;
    content = (
      <ErrorInPlace
        error={read.error}
        placement="part"
        onRetry={() => {
          void read.refetch();
        }}
      />
    );
  }
  return (
    <div className="relative min-h-18 w-0 min-w-full">
      {updating && outcome.kind !== "waiting" && <UpdatingBar />}
      {updating && outcome.kind === "waiting" && <Loading inValue />}
      <output
        aria-label="Base score"
        className={
          outcome.kind === "failed"
            ? "block"
            : "flex flex-col items-start @min-[52rem]:items-end"
        }
      >
        {content}
      </output>
    </div>
  );
}

interface VectorScore {
  // The place of the score.
  place: ReactNode;
  // The error of a vector that Sentinel's read rejects, which its field
  // shows while it holds that vector, or undefined.
  rejection: string | undefined;
}

// The Base score of the vector of the form of a version, Calculate CVSS Base
// Score, GET /api/v1/cvss/base-score, which applies to a vector the rules of
// Set or Update SUSE CVSS Assessment and stores nothing (Sentinel
// docs/features/tickets/cvss-scoring.md, Calculate CVSS Base Score): read
// once the vector has paused, and only when the form would send it and it
// names every metric, otherwise reasonOf says why it has no score. While the
// score of a new vector is read, the outcome of the vector before it stays,
// and a read that a newer vector overtakes shows nothing.
function useVectorScore(
  version: EditableVersion,
  vector: string,
  reasonOf: (vector: string) => string | null,
): VectorScore {
  const current = vector.trim();
  const paused = usePausedVector(version, current);
  const reason = reasonOf(paused);
  const read = useBaseScore(paused, reason === null);
  const answered = reason !== null || read.status !== "pending";
  // Whether the outcome of the vector of the form is known: a vector that
  // changed since it paused overtakes its read.
  const known = answered && current === paused;
  // The vector whose outcome shows, which follows the paused vector once
  // its outcome is known.
  const [shown, setShown] = useState<VersionVector | null>(null);
  if (known && (shown?.version !== version || shown.vector !== paused)) {
    setShown({ version, vector: paused });
  }
  const previous = shown?.version === version ? shown.vector : null;
  // Its read, which the query client keeps, and which is not sent again.
  const previousRead = useBaseScore(previous ?? "", false);
  let outcome: ScoreOutcome = { kind: "waiting" };
  if (known) {
    outcome = scoreOutcome(reason, read, version);
  } else if (previous !== null) {
    outcome = scoreOutcome(reasonOf(previous), previousRead, version);
  }
  // A failure offers Try again for the vector of the form alone.
  if (outcome.kind === "failed" && !known) {
    outcome = { kind: "waiting" };
  }
  const rejection =
    known &&
    reason === null &&
    read.status === "error" &&
    isRequestFailure(read.error)
      ? cvssVectorError(read.error, version)
      : undefined;
  return {
    place: (
      <ScorePlace outcome={outcome} updating={!answered || read.isFetching} />
    ),
    rejection,
  };
}

// What the tooltip of the default CVSS version says (Sentinel
// docs/features/tickets/cvss-scoring.md, Eligibility Score Resolution).
const DEFAULT_VERSION_TEXT =
  "The default CVSS version: its SUSE assessment also sets the eligibility score of the Products.";

// What Start from offers in Edit for the assessment as Sentinel stores it.
const SAVED = "saved";

// An option of Start from, with the vector that it takes.
interface StartOption {
  option: FieldOption<string>;
  vector: string;
}

// What a submission that failed shows: the error of the vector, and the
// error at the top of the form.
interface VectorFailure {
  field: string | undefined;
  form: DialogError | undefined;
}

const NO_VECTOR_FAILURE: VectorFailure = { field: undefined, form: undefined };

// Add, or Edit of an assessment, as it was when Edit opened, which gives the
// form its input.
type SuseDialogMode =
  | { kind: "add" }
  | {
      kind: "edit";
      assessment: CVSSAssessmentItem;
      version: EditableVersion;
    };

interface SuseAssessmentDialogProps {
  ticketId: string;
  cveId: string;
  mode: SuseDialogMode;
  // The assessments of the CVE as the read of the part shows them.
  assessments: CVECVSSAssessments;
  readAgain: () => void;
  onClose: () => void;
  // Tells that Sentinel confirmed the change, with its outcome and the
  // assessment as Sentinel returns it.
  onDone: (text: string, assessment: CVSSAssessmentItem) => void;
}

// The outcome of a change of the SUSE assessment, as Sentinel returns it.
function suseChangedText(
  kind: SuseDialogMode["kind"],
  { data }: CVSSAssessmentResponse,
): string {
  return `SUSE assessment ${cvssVersion(data.cvss_version)} ${kind === "add" ? "added" : "changed"}.`;
}

// Add SUSE assessment and Edit, Set or Update SUSE CVSS Assessment,
// POST /api/v1/cves/{cve_id}/cvss/suse, in a dialog with a form in two
// columns (docs/design-system.md, Dialogs; Forms). Add opens on tabs of the
// versions, the default one marked with star, on the default version when
// SUSE has no assessment of it, otherwise on the other; the tab of a version
// of which SUSE has one says so, and Add SUSE assessment is disabled there.
// Each tab keeps its input; after Add, the dialog stays open on another tab
// that holds input while SUSE lacks its version, and says what was added.
// Start from takes the vector of an assessment of another provider of the
// version, or in Edit the saved one, and shows the assessment whose vector
// the form holds, or nothing; each metric is
// a segmented control, whose choice writes the vector, and a vector typed in
// its field chooses them. Beside Start from, the score of the vector as
// Sentinel calculates it (useVectorScore); a vector that Sentinel's read
// rejects shows its error at the field at once, without moving the focus,
// and the form still sends it. The form checks the vector before sending it: it
// is required, at most 200 characters, and of the version of the tab; Add
// reads the assessments again first, so that it never replaces one that
// SUSE has (Sentinel docs/features/tickets/cvss-scoring.md, Set or Update
// SUSE CVSS Assessment: the vector selects the assessment). A vector that
// Sentinel refuses, 422 CVSS_INVALID_VECTOR, and a field error of a
// VALIDATION_ERROR show at the field, which takes the focus; every other
// failure at the top of the form, which takes it, as a warning when
// Sentinel did not confirm the change (docs/behaviors.md, Where Errors
// Appear). Edit without a change closes without a request. With input,
// Cancel, Escape, and every navigation of the UI, such as Back, ask "Discard
// changes?" first, and closing or reloading the page shows the browser's own
// prompt (docs/behaviors.md, Confirmation). While the change is in progress,
// the dialog cannot be closed, and its input counts as submitted, that of
// every tab included: a navigation asks nothing, and the outcome shows on the
// screen that the user is on (useChangeOutcome).
function SuseAssessmentDialog({
  ticketId,
  cveId,
  mode,
  assessments: shown,
  readAgain,
  onClose,
  onDone,
}: SuseAssessmentDialogProps) {
  const client = useQueryClient();
  const upsert = useUpsertSuseCvssAssessment({
    mutation: useChangeOutcome(
      ticketRecord(ticketId),
      (response: CVSSAssessmentResponse) =>
        suseChangedText(mode.kind, response),
      readAgain,
    ),
  });
  const formId = useId();
  const assessments = shown.assessments;
  const toAdd = versionsToAdd(assessments);
  const defaultVersion = shown.default_cvss_version;
  const [version, setVersion] = useState<EditableVersion>(() => {
    if (mode.kind === "edit") {
      return mode.version;
    }
    return (
      toAdd.find((item) => item === defaultVersion) ??
      toAdd[0] ??
      EDITABLE_VERSIONS[0]
    );
  });
  const saved = mode.kind === "edit" ? mode.assessment.vector_string : "";
  // The vector of each version, as the user enters it.
  const [inputs, setInputs] = useState<
    Readonly<Record<EditableVersion, string>>
  >(() => ({
    "3.1": "",
    "4.0": "",
    ...(mode.kind === "edit" ? { [mode.version]: saved } : {}),
  }));
  // What Add added while the dialog stays open on another tab.
  const [added, setAdded] = useState<string>();
  const [busy, setBusy] = useState(false);
  // A new object for each failure, so that each shows again.
  const [failure, setFailure] = useState<VectorFailure>(NO_VECTOR_FAILURE);
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const vectorRef = useRef<HTMLInputElement>(null);
  // The dialog takes the focus at the first field of its form as it opens
  // (docs/behaviors.md, Accessibility, Dialogs), once: the form shows again
  // with each tab.
  const opened = useRef(false);
  const firstField = useCallback((element: HTMLDivElement | null) => {
    if (element !== null && !opened.current) {
      opened.current = true;
      element.querySelector<HTMLElement>("input, button")?.focus();
    }
  }, []);
  // The line of a tab that says that SUSE has the version takes the focus
  // as it shows in place of the form, when the read before Add finds it, or
  // when a read takes the form away while it holds the focus, which the
  // browser then leaves on the page or on the dialog (docs/behaviors.md,
  // Accessibility, Focus after an action).
  // A form that the user takes away by opening another tab leaves the focus
  // on that tab.
  const takenFound = useRef(false);
  const switched = useRef(false);
  const takenLine = useCallback((element: HTMLParagraphElement | null) => {
    if (element === null) {
      return;
    }
    const active = document.activeElement;
    const lost =
      active === null ||
      active === document.body ||
      active.getAttribute("role") === "dialog";
    if (takenFound.current || (lost && !switched.current)) {
      takenFound.current = false;
      element.focus();
    }
  }, []);
  // Once the tab that the user opened shows, a read that takes its form
  // away is no longer the user's switch.
  useEffect(() => {
    switched.current = false;
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- each version shown is the event that the effect follows
  }, [version]);
  // After a failure at the field alone, the field takes the focus; the error
  // of the form takes it itself (docs/behaviors.md, Accessibility,
  // Announcements).
  useEffect(() => {
    if (failure.field !== undefined && failure.form === undefined) {
      vectorRef.current?.focus();
    }
  }, [failure]);

  const entered = inputs[version];
  const { prefix } = VERSION_FORMS[version];
  const taken = mode.kind === "add" && !toAdd.includes(version);
  const others = assessments.filter(
    (assessment) =>
      assessment.provider_name !== SUSE && assessment.cvss_version === version,
  );
  const chosen = chosenOf(version, entered);
  const changed =
    mode.kind === "edit"
      ? entered !== saved
      : EDITABLE_VERSIONS.some((item) => inputs[item] !== "");
  // While the change is in progress, the input of every tab counts as
  // submitted.
  const { close, question } = useDiscardQuestion({
    held: changed && !busy,
    consequence:
      mode.kind === "add"
        ? "The SUSE assessment that you entered isn't added."
        : "Your changes to this SUSE assessment aren't saved.",
    onDiscard: onClose,
  });
  const change = (vector: string) => {
    setInputs((current) => ({ ...current, [version]: vector }));
    setFailure(NO_VECTOR_FAILURE);
  };

  // A choice of a metric writes the vector of the metrics chosen.
  const choose = (abbreviation: string, letter: string) => {
    change(vectorOf(version, new Map([...chosen, [abbreviation, letter]])));
  };

  const starts: StartOption[] = [
    ...(mode.kind === "edit"
      ? [
          {
            option: assessmentOption(SAVED, "SUSE, as saved", mode.assessment),
            vector: saved,
          },
        ]
      : []),
    ...others.map((other) => ({
      option: assessmentOption(other.id, other.provider_name, other),
      vector: other.vector_string,
    })),
  ];
  // Start from shows the assessment whose vector the form holds, so that
  // choosing an assessment always takes its vector.
  const start =
    starts.find((item) => item.vector === entered.trim())?.option.value ?? null;

  // The check of the vector before it is sent, or null.
  const check = (vector: string): string | null => {
    if (vector === "") {
      return "Choose the metrics, or enter the vector.";
    }
    if (codePoints(vector) > VECTOR_MAX_LENGTH) {
      return `Enter at most ${VECTOR_MAX_LENGTH} characters.`;
    }
    if (!vector.startsWith(prefix)) {
      const other = EDITABLE_VERSIONS.find(
        (item) =>
          item !== version && vector.startsWith(VERSION_FORMS[item].prefix),
      );
      return mode.kind === "add" &&
        other !== undefined &&
        !toAdd.includes(other)
        ? takenText(other)
        : `Enter a CVSS v${version} vector, which starts with ${prefix}.`;
    }
    return null;
  };

  // Why a vector has no score, or null: the check before it is sent, or a
  // metric that it does not choose.
  const scoreReason = (vector: string): string | null =>
    check(vector) ??
    (chosenOf(version, vector).size < formMetrics(version).length
      ? "Choose every metric."
      : null);
  const score = useVectorScore(version, entered, scoreReason);
  const vectorError = failure.field ?? score.rejection;
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }

  // A failure of the read of the assessments before Add, or of the change.
  const fail = (error: unknown, read: boolean) => {
    if (!isRequestFailure(error)) {
      setUiFailure({ error });
      return;
    }
    if (read) {
      const presentation = presentFailure(error, "part");
      setFailure({
        field: undefined,
        form:
          presentation === undefined
            ? undefined
            : {
                message: presentation.message,
                reference: presentation.reference,
                unconfirmed: false,
              },
      });
      return;
    }
    const atField = cvssVectorError(error, version);
    if (atField !== undefined) {
      setFailure({ field: atField, form: undefined });
      return;
    }
    const { fields, unmatched } = validationErrorFields(error, [
      "vector_string",
    ]);
    const presentation = unmatched ? presentChangeFailure(error) : undefined;
    setFailure({
      field: fields.length > 0 ? MESSAGE_INVALID_VALUE : undefined,
      form:
        presentation === undefined
          ? undefined
          : {
              message: presentation.message,
              reference: presentation.reference,
              unconfirmed: presentation.unconfirmed,
            },
    });
  };

  const submit = async () => {
    if (busy || taken) {
      return;
    }
    const vector = entered.trim();
    const problem = check(vector);
    if (problem !== null) {
      setFailure({ field: problem, form: undefined });
      return;
    }
    if (mode.kind === "edit" && vector === saved) {
      onClose();
      return;
    }
    setFailure(NO_VECTOR_FAILURE);
    setBusy(true);
    let lacking = toAdd;
    if (mode.kind === "add") {
      // Sentinel replaces the assessment of the version of the vector, so
      // Add reads them again: another user may have added it meanwhile.
      try {
        const current = await client.fetchQuery({
          ...getGetCveCvssAssessmentsQueryOptions(cveId),
          staleTime: 0,
        });
        lacking = versionsToAdd(current.data.assessments);
        if (!lacking.includes(version)) {
          takenFound.current = true;
          setBusy(false);
          return;
        }
      } catch (error) {
        fail(error, true);
        setBusy(false);
        return;
      }
    }
    try {
      const response = await upsert.mutateAsync({
        cveId,
        data: { vector_string: vector },
      });
      const text = suseChangedText(mode.kind, response);
      // After Add, the dialog stays open on another tab that holds input
      // while SUSE lacks its version, so that the user adds it too.
      const next =
        mode.kind === "add"
          ? EDITABLE_VERSIONS.find(
              (item) =>
                item !== version &&
                inputs[item].trim() !== "" &&
                lacking.includes(item),
            )
          : undefined;
      if (next === undefined) {
        onDone(text, response.data);
      } else {
        // The action keeps the focus, also when the form that held it, such
        // as after Enter in Vector, leaves with its tab (docs/behaviors.md,
        // Accessibility, Focus after an action).
        const action = document.querySelector<HTMLElement>(
          `button[form="${CSS.escape(formId)}"]`,
        );
        setInputs((current) => ({ ...current, [version]: "" }));
        setAdded(text);
        switched.current = true;
        setVersion(next);
        requestAnimationFrame(() => {
          action?.focus();
        });
      }
    } catch (error) {
      fail(error, false);
    }
    setBusy(false);
  };

  const form = taken ? (
    <p
      ref={takenLine}
      tabIndex={-1}
      className={`rounded text-fg-muted ${FOCUS_RING}`}
    >
      {`SUSE already has a CVSS v${version} assessment: Edit in its row of the table changes it.`}
    </p>
  ) : (
    <Form
      id={formId}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void submit();
      }}
      validationErrors={
        vectorError === undefined ? {} : { vector_string: vectorError }
      }
      className="flex flex-col gap-5"
    >
      {failure.form !== undefined && (
        <DialogErrorMessage error={failure.form} />
      )}
      {/* Two columns, each as wide as its widest line, where the dialog is
          wide enough, otherwise one. */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-y-5 @min-[52rem]:grid-cols-[max-content_max-content] @min-[52rem]:justify-between @min-[52rem]:gap-x-10">
          {starts.length > 0 ? (
            <div className="w-80 max-w-full">
              <SelectField
                label="Start from"
                name="start"
                optional
                options={starts.map((item) => item.option)}
                value={start}
                onChange={(value) => {
                  const from = starts.find(
                    (item) => item.option.value === value,
                  );
                  if (from !== undefined) {
                    change(from.vector);
                  }
                }}
              />
            </div>
          ) : (
            // Without Start from, the score keeps its place in the second
            // column.
            <div aria-hidden className="hidden @min-[52rem]:block" />
          )}
          {score.place}
          <MetricColumn
            version={version}
            groups={VERSION_FORMS[version].groups.slice(0, 1)}
            chosen={chosen}
            others={others}
            onChoose={choose}
          />
          <MetricColumn
            version={version}
            groups={VERSION_FORMS[version].groups.slice(1)}
            chosen={chosen}
            others={others}
            onChoose={choose}
          />
        </div>
      </div>
      <TextField
        label="Vector"
        name="vector_string"
        monospace
        autoComplete="off"
        description="The metrics write it, and a vector entered here chooses them."
        value={entered}
        onChange={change}
        inputRef={vectorRef}
      />
    </Form>
  );

  return (
    <ModalDialog
      isOpen
      onClose={close}
      width="two-columns"
      title={
        mode.kind === "add"
          ? "Add SUSE assessment"
          : `Edit SUSE assessment ${cvssVersion(mode.version)}`
      }
      closable={!busy}
      buttons={
        <>
          <Button size="large" isDisabled={busy} onPress={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            size="large"
            isBusy={busy}
            isDisabled={taken}
          >
            {mode.kind === "add" ? "Add SUSE assessment" : "Save"}
          </Button>
          {question}
        </>
      }
    >
      {mode.kind === "add" ? (
        <>
          {/* What Add added while the dialog stays open, in a status region
              that is there before it, so that it is announced. */}
          <output className="block">
            {added !== undefined && (
              <div className="mb-3">
                <Message tone="success">{added}</Message>
              </div>
            )}
          </output>
          <DialogTabs
            label="CVSS version"
            tabs={EDITABLE_VERSIONS.map((item) => ({
              id: item,
              label: `CVSS ${cvssVersion(item)}`,
              mark:
                item === defaultVersion
                  ? {
                      icon: Star,
                      name: "the default version",
                      text: DEFAULT_VERSION_TEXT,
                    }
                  : undefined,
            }))}
            selected={version}
            onSelect={(next) => {
              switched.current = true;
              setVersion(next);
              setFailure(NO_VECTOR_FAILURE);
            }}
          >
            <div ref={firstField} className="contents">
              {form}
            </div>
          </DialogTabs>
        </>
      ) : (
        <div ref={firstField} className="contents">
          {form}
        </div>
      )}
    </ModalDialog>
  );
}

// What a vector of a version of which SUSE has an assessment says in Add.
function takenText(version: EditableVersion): string {
  return `SUSE already has a CVSS v${version} assessment: edit it in its row.`;
}

// An assessment that Delete deletes, with its place in the table.
interface Deleting {
  assessment: CVSSAssessmentItem;
  index: number;
}

interface DeleteSuseDialogProps {
  ticketId: string;
  cveId: string;
  deleting: Deleting;
  // The assessments of the CVE as the read of the part shows them, and the
  // status of the Ticket as the screen shows it.
  assessments: CVECVSSAssessments;
  status: string;
  readAgain: () => void;
  onClose: () => void;
  onDone: (text: string) => void;
}

// Delete, Delete SUSE CVSS Assessment,
// DELETE /api/v1/cves/{cve_id}/cvss/suse/{cvss_version}, which asks for
// confirmation, since it cannot be undone in the UI and Sentinel calculates
// the severity and the eligibility again (docs/behaviors.md, Confirmation):
// its question names the assessment, and its consequence says that, and,
// for the assessment of the default CVSS version, that the eligibility score
// is then the fallback 10.0 (Sentinel docs/features/tickets/cvss-scoring.md,
// Eligibility Score Resolution), and, for the last SUSE assessment of the
// CVE of an Analyzed or Resolved Ticket, that the Ticket returns to Analysis
// (Sentinel docs/features/tickets/tickets.md, Gate: Analysis → Analyzed).
// Its error shows at the top of the confirmation, which stays open.
function DeleteSuseDialog({
  ticketId,
  cveId,
  deleting,
  assessments,
  status,
  readAgain,
  onClose,
  onDone,
}: DeleteSuseDialogProps) {
  const { assessment } = deleting;
  const name = `SUSE assessment ${cvssVersion(assessment.cvss_version)}`;
  const deleted = `${name} deleted.`;
  const remove = useDeleteSuseCvssAssessment({
    mutation: useChangeOutcome(
      ticketRecord(ticketId),
      () => deleted,
      readAgain,
    ),
  });
  const [error, setError] = useState<DialogError>();
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }
  const last =
    assessments.assessments.filter((item) => item.provider_name === SUSE)
      .length === 1;
  const returns =
    last &&
    (status === TicketStatusValue.analyzed ||
      status === TicketStatusValue.resolved);
  const fallback = assessment.cvss_version === assessments.default_cvss_version;
  const confirm = async () => {
    setError(undefined);
    try {
      await remove.mutateAsync({
        cveId,
        cvssVersion: assessment.cvss_version,
      });
      onDone(deleted);
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
  };
  return (
    <ConfirmationDialog
      isOpen
      onCancel={onClose}
      title={`Delete ${name}?`}
      action="Delete SUSE assessment"
      onConfirm={() => {
        void confirm();
      }}
      isBusy={remove.isPending}
      error={error}
    >
      {`Sentinel calculates the severity of the CVE again from the other assessments, and the eligibility of the Products, which can change the priority and the deadlines of the Ticket.${fallback ? ` Without a SUSE CVSS ${cvssVersion(assessment.cvss_version)} assessment, the eligibility score of the Products is the fallback 10.0.` : ""}${returns ? " As the last SUSE assessment of the CVE, it also returns the Ticket to Analysis." : ""} This can't be undone.`}
    </ConfirmationDialog>
  );
}

// The attribute that the provider of each assessment carries with its
// identifier, by which the part finds its row.
const ASSESSMENT_ATTRIBUTE = "data-assessment-id";

function assessmentId(assessment: CVSSAssessmentItem): string {
  return assessment.id;
}

// The names of Edit and Delete, before the version of their assessment.
const EDIT_SUSE = "Edit SUSE assessment";
const DELETE_SUSE = "Delete SUSE assessment";

// The Delete of the row of an assessment, which takes the focus after Delete
// of the row before it, or null without one.
function deleteIn(row: HTMLElement): HTMLElement | null {
  return row.querySelector<HTMLElement>(`button[aria-label^="${DELETE_SUSE}"]`);
}

interface RowActions {
  edit: (assessment: CVSSAssessmentItem) => void;
  remove: (assessment: CVSSAssessmentItem) => void;
}

// The columns of the table, with Edit and Delete at the end of the row of a
// SUSE assessment that the screen changes, for a user who holds
// manage_cvss (docs/design-system.md, Tables).
function columnsOf(
  actions: RowActions | undefined,
): readonly TableColumn<CVSSAssessmentItem>[] {
  if (actions === undefined) {
    return ASSESSMENT_COLUMNS;
  }
  return [
    // Before the actions of a row, the vector keeps 14 px after it, which
    // with the padding of the cell leave the cell 24 px of its own beside its
    // button: React Aria's table makes the cell a tab stop once the button
    // has had the focus, and so a target of its own (WCAG 2.5.8, Target Size
    // (Minimum)).
    ...ASSESSMENT_COLUMNS.map((column) =>
      column.id === "vector"
        ? {
            ...column,
            render: (assessment: CVSSAssessmentItem) => (
              <div className="pe-3.5">{column.render(assessment)}</div>
            ),
          }
        : column,
    ),
    {
      id: "actions",
      name: "Actions",
      hidesName: true,
      // 14 px before the buttons, which with the padding of the cell leave it
      // 24 px of its own: once one of them has had the focus, React Aria's
      // table makes the cell its tab stop, and so a target of its own, which
      // needs that room beside them (WCAG 2.5.8, Target Size (Minimum)).
      render: (assessment) =>
        isChangeable(assessment) ? (
          <div className="flex justify-end gap-1 ps-3.5 text-fg-muted">
            <IconButton
              size="small"
              icon={Pencil}
              label={`${EDIT_SUSE} ${cvssVersion(assessment.cvss_version)}`}
              tooltip="Edit"
              onPress={() => {
                actions.edit(assessment);
              }}
            />
            <IconButton
              size="small"
              icon={Trash}
              label={`${DELETE_SUSE} ${cvssVersion(assessment.cvss_version)}`}
              tooltip="Delete"
              onPress={() => {
                actions.remove(assessment);
              }}
            />
          </div>
        ) : null,
    },
  ];
}

// Reads again what a change of the SUSE assessment affects, whatever its
// outcome: the reads of the tab, the Ticket among them, whose severity,
// priority, status, assignee, and package tree the change can change; its
// audit log; and the reads of the Ticket list, whose rows show those values
// (docs/behaviors.md, Outcome of a Change; Sentinel
// docs/features/tickets/cvss-scoring.md, Assessment Persistence and Ticket
// Status).
function useReadAfterSuseChange(ticketId: string, cveId: string) {
  const client = useQueryClient();
  const readAgain = useReadAgain(ticketId, cveId);
  return useCallback(() => {
    readAgain(false);
    void client.invalidateQueries({
      queryKey: getListTicketEventsQueryKey(ticketId),
    });
    // The reads of the Ticket list hold that of the duplicates of the Ticket,
    // which readAgain has just sent again: it is kept, not sent twice.
    void client.invalidateQueries(
      { queryKey: getListTicketsQueryKey() },
      { cancelRefetch: false },
    );
  }, [client, readAgain, ticketId]);
}

// The CVSS assessments of the CVE of the Ticket, from Get CVSS Assessments
// for a CVE: what they resolve, then the table of the assessments in the
// order of the API, by version, then by provider (Sentinel
// docs/features/tickets/cvss-scoring.md, Version Precedence), or "No CVSS
// assessments." without any. The part reads them on its own, and their
// loading and their errors show in its place (docs/behaviors.md, Loading;
// Where Errors Appear). For a user who holds manage_cvss, on a Ticket whose
// status lets Sentinel change its SUSE assessment, Add SUSE assessment at
// the end of the line of the heading, once the assessments have arrived,
// while SUSE lacks one of the versions that the screen changes, and Edit and
// Delete on the rows of the SUSE assessments of these versions
// (docs/screen-map.md, Roles, Principles). The outcome of a change is
// announced once a read of the assessments after it arrives. After Delete,
// the focus moves to the Delete of the row that takes its place, or to that
// row without one, or to Add SUSE assessment when no row follows; when a
// read removes the row that holds it, to the screen's heading
// (docs/behaviors.md, Accessibility, Focus after an action).
function CvssPart({ read, ticket }: CvssPartProps) {
  const user = useSignedInUser();
  const changes =
    user?.capabilities.includes("manage_cvss") === true &&
    SUSE_CHANGEABLE_STATUSES.has(ticket.status);
  const ticketId = ticket.ticket_id;
  const cveId = ticket.cve?.cve_id ?? "";
  // The assessments of the open dialogs, which keep their input and show
  // their error at the top of their form after a 403 or a 404, and those
  // that the part shows, after which Add SUSE assessment follows them.
  const data = read.data?.data;
  const shownData = dataShown(read)?.data;
  const mounted = useMounted();
  const record = useMemo(() => ticketRecord(ticketId), [ticketId]);
  const outcome = useOutcomeAfterRead(read, record);
  const container = useRef<HTMLDivElement>(null);
  const add = useRef<HTMLDivElement>(null);
  const fallback = useCallback(() => add.current?.querySelector("button"), []);
  const rowFocus = useRowFocusAfterRemoval({
    container,
    rows: data?.assessments,
    rowId: assessmentId,
    attribute: ASSESSMENT_ATTRIBUTE,
    control: deleteIn,
    fallback,
    read,
  });
  const readAgain = useReadAfterSuseChange(ticketId, cveId);
  const [dialog, setDialog] = useState<SuseDialogMode>();
  const [deleting, setDeleting] = useState<Deleting>();
  const actions = useMemo<RowActions | undefined>(
    () =>
      changes && data !== undefined
        ? {
            edit: (assessment) => {
              if (isEditableVersion(assessment.cvss_version)) {
                setDialog({
                  kind: "edit",
                  assessment,
                  version: assessment.cvss_version,
                });
              }
            },
            remove: (assessment) => {
              setDeleting({
                assessment,
                index: data.assessments.findIndex(
                  (row) => row.id === assessment.id,
                ),
              });
            },
          }
        : undefined,
    [changes, data, setDialog, setDeleting],
  );
  const columns = useMemo(() => columnsOf(actions), [actions]);
  return (
    <Part
      id={CVSS_ANCHOR}
      heading="CVSS assessments"
      actions={
        changes &&
        shownData !== undefined &&
        versionsToAdd(shownData.assessments).length > 0 ? (
          <FocusHandOff>
            <div ref={add}>
              <Button
                size="small"
                icon={Plus}
                onPress={() => {
                  setDialog({ kind: "add" });
                }}
              >
                Add SUSE assessment
              </Button>
            </div>
          </FocusHandOff>
        ) : undefined
      }
    >
      <div ref={container}>
        <PartRead read={read}>
          {({ data: shown }) =>
            shown.assessments.length === 0 ? (
              <p className="text-fg-muted">No CVSS assessments.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <Resolution assessments={shown} />
                <FramedTable
                  label="CVSS assessments"
                  columns={columns}
                  rows={shown.assessments}
                  rowId={assessmentId}
                />
              </div>
            )
          }
        </PartRead>
      </div>
      {outcome.region}
      {dialog !== undefined && data !== undefined && (
        <SuseAssessmentDialog
          ticketId={ticketId}
          cveId={cveId}
          mode={dialog}
          assessments={data}
          readAgain={readAgain}
          onClose={() => {
            setDialog(undefined);
          }}
          onDone={(text, assessment) => {
            if (!mounted.current) {
              return;
            }
            setDialog(undefined);
            // The dialog returns the focus to the Edit that opened it as it
            // closes (docs/behaviors.md, Accessibility, Dialogs), so its row
            // holds the focus from now on, also before React Aria has
            // returned it. After Add, it returns it to Add SUSE assessment,
            // which the next read removes once SUSE has every version: the
            // new row then takes it, at its Delete.
            if (dialog.kind === "edit") {
              rowFocus.holds(dialog.assessment.id);
            } else {
              rowFocus.added(assessment.id);
            }
            outcome.after(text);
          }}
        />
      )}
      {deleting !== undefined && data !== undefined && (
        <DeleteSuseDialog
          ticketId={ticketId}
          cveId={cveId}
          deleting={deleting}
          assessments={data}
          status={ticket.status}
          readAgain={readAgain}
          onClose={() => {
            setDeleting(undefined);
          }}
          onDone={(text) => {
            if (!mounted.current) {
              return;
            }
            rowFocus.deleted(deleting.assessment.id, deleting.index);
            setDeleting(undefined);
            outcome.after(text);
          }}
        />
      )}
    </Part>
  );
}

// ----------------------------------------------------------------------------
// Sources of the CVE

// How often the sources are read again while the fetch of one of them is
// pending (docs/behaviors.md, Loading).
const PENDING_READ_INTERVAL_MS = 5_000;

// The name of a CVE source, as Sentinel names it, or as received
// (CVE_SOURCE_NAMES).
function sourceName(source: string): string {
  return CVE_SOURCE_NAMES.get(source) ?? source;
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

// The outcome of a grant, naming its user, such as "Access granted to Carol
// White.".
function grantedText(user: TicketAccessGrantResponse["user"]): string {
  return `Access granted to ${displayName(user)}.`;
}

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
// reads again what it affects, and the outcome of a grant that ends after
// the user left the tab shows in the message area (useChangeOutcome).
function GrantAccessForm({
  ticketId,
  granted,
  onBusyChange,
  onInputChange,
  readAgain,
  announce,
  inputRef,
}: GrantAccessFormProps) {
  const grant = useGrantTicketAccess({
    mutation: useChangeOutcome(
      ticketRecord(ticketId),
      (response: TicketAccessGrantDataResponse) =>
        grantedText(response.data.user),
      readAgain,
    ),
  });
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
      announce(grantedText(response.data.user));
    } catch (error) {
      fail(error);
    }
    setBusy(false);
    onBusyChange(false);
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
// screen then reads again what it affects, and the outcome of a revocation
// that ends after the user left the tab shows in the message area
// (useChangeOutcome).
function GrantItem({ ticketId, grant, revoke }: GrantItemProps) {
  const name = displayName(grant.user);
  const mutation = useRevokeTicketAccess({
    mutation: useChangeOutcome(
      ticketRecord(ticketId),
      () => `Access of ${name} revoked.`,
      () => {
        revoke?.readAgain();
      },
    ),
  });
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
// granted, Close, Escape, and every navigation of the UI, such as Back, ask
// "Discard changes?" first, and closing or reloading the page shows the
// browser's own prompt (docs/behaviors.md, Confirmation); while a grant or
// a revocation is in progress, the user chosen counts as submitted. The
// outcome of a grant or a revocation is announced in a status region of the
// dialog, which the rest of the page cannot hold while the dialog is open.
// When a grant whose line holds the focus leaves the list, as after its
// Revoke access, the focus moves to the Revoke access of the grant that
// followed it, or to the user field when none follows (docs/behaviors.md,
// Accessibility, Focus after an action). A Ticket that is no longer
// confidential keeps the dialog open, which then says so in place of its
// form and its grants, and takes the focus.
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
  // Whether a revocation of this Ticket is in progress, also one that an
  // earlier opening of the dialog started.
  const revoking =
    useIsMutating({
      mutationKey: getRevokeTicketAccessMutationKey(),
      predicate: ({ state: { variables } }) =>
        typeof variables === "object" &&
        variables !== null &&
        "ticketId" in variables &&
        variables.ticketId === ticketId,
    }) > 0;
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
  const { close, question } = useDiscardQuestion({
    held: isOpen && confidential && chosen && !busy && !revoking,
    consequence: "The user that you chose isn't granted access.",
    onDiscard: finish,
  });
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
          {question}
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
  const assignee = useAssignee(ticket, twoColumns);
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
    <>
      <DetailColumns
        twoColumns={twoColumns}
        leadingSections={
          <Details
            ticket={ticket}
            now={now}
            duplicates={duplicates}
            assignee={assignee}
          />
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
            {ticket.cve !== null && <CvssPart read={cvss} ticket={ticket} />}
            <PackagesPart ticket={ticket} now={now} yourWork={yourWork} />
          </>
        }
      />
      {assignee.region}
    </>
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
