import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { DialogTrigger } from "react-aria-components";
import {
  assigneeFieldError,
  isAssigneeChanged,
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentChangeFailure,
  validationErrorFields,
} from "../../api/errors";
import { TicketStatusValue } from "../../api/generated/model";
import type {
  ListUsersAssignmentEligibilityItem,
  TicketDetail,
  TicketDetailResponse,
} from "../../api/generated/model";
import { useAssignTicket, useGetTicket } from "../../api/generated/tickets";
import { getListUsersQueryKey } from "../../api/generated/users";
import { AbsentValue } from "../../components/absent-value";
import {
  useChangeOutcome,
  useMounted,
  useOutcomeAfterRead,
} from "../../components/change-outcome";
import { IconButton } from "../../components/icon-button";
import { InfoPopover } from "../../components/info-popover";
import { useShowMessage } from "../../components/message-area";
import {
  DialogErrorMessage,
  FirstFieldFocus,
  type DialogError,
} from "../../components/modal-dialog";
import { displayName, User, type UserFields } from "../../components/user";
import { UserPicker } from "../../components/user-picker";
import { useSignedInUser } from "../../session-gate";
import { ticketRecord } from "../ticket";
import { useReadAfterTicketChange } from "./shared";

// The assignee of the Ticket in its details
// (src/routes/ticket-overview/details.tsx), with its change from them.

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
// Ticket after it arrives, or shows in the message area when that read fails
// (useOutcomeAfterRead). A failure shows in the popover: the errors of the
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
export function useAssignee(ticket: TicketDetail, twoColumns: boolean) {
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

export type Assignee = ReturnType<typeof useAssignee>;

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
export function AssigneeField({ ticket, assignee }: AssigneeFieldProps) {
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
