import { CirclePlay, ListRestart, Merge, Split } from "lucide-react";
import { useRef, useState } from "react";
import { Separator } from "react-aria-components";
import {
  isRequestFailure,
  presentChangeFailure,
  presentExitConflict,
} from "../../api/errors";
import { TicketStatusValue } from "../../api/generated/model";
import type {
  TicketDetail,
  TicketDetailResponse,
} from "../../api/generated/model";
import {
  useGetTicket,
  useReopenTicket,
  useRerunTicketConvergence,
  useRevertTicketDuplicate,
} from "../../api/generated/tickets";
import { ScreenActionsMenu } from "../../components/actions-menu";
import {
  useChangeOutcome,
  useMounted,
  useOutcomeAfterRead,
} from "../../components/change-outcome";
import { MENU_SEPARATOR, MenuAction } from "../../components/menu";
import {
  useShowMessage,
  type MessageRecord,
} from "../../components/message-area";
import {
  FocusHandOff,
  focusHeadingAfterClose,
} from "../../components/screen-heading";
import { ticketStatusName } from "../../components/ticket-status";
import { displayName } from "../../components/user";
import { useSignedInUser } from "../../session-gate";
import { useReadAfterTicketChange } from "../ticket-overview/shared";
import { MarkDuplicateDialog } from "./mark-duplicate";

// Actions, the menu at the end of the heading row of the Ticket screen
// (src/routes/ticket.tsx; docs/design-system.md, Detail Screens), with the
// changes of the status of the Ticket and Rerun convergence.

// The actions of the menu, in its order: those of the status, then, apart,
// Rerun convergence, a recovery of Sentinel's own work.
type ActionId = "mark-duplicate" | "reopen" | "revert-duplicate" | "rerun";

// The statuses from which Sentinel marks a Ticket as a duplicate, its
// operable statuses, and those in which it reruns its convergence: New is
// not among the latter (Sentinel docs/features/tickets/tickets.md,
// Mark-as-Duplicate Operation; Rerun Ticket Convergence). A status that the
// pinned contract does not list offers no action (docs/behaviors.md, Unknown
// Values).
const MARKABLE_STATUSES = new Set<string>([
  TicketStatusValue.new,
  TicketStatusValue.analysis,
  TicketStatusValue.analyzed,
  TicketStatusValue.resolved,
]);
const RERUNNABLE_STATUSES = new Set<string>([
  TicketStatusValue.analysis,
  TicketStatusValue.analyzed,
  TicketStatusValue.resolved,
]);

// The actions that the user can take on the Ticket in its status: those of
// its status with triage_ticket, and Rerun convergence with triage_ticket or
// manage_fetchers (Sentinel docs/features/identity/rbac.md, Endpoint
// Permission Map (Tickets)). An action that the status does not allow is not
// offered (docs/screens/ticket.md, Actions).
function actionsOf(
  status: string,
  capabilities: readonly string[],
): readonly ActionId[] {
  const triages = capabilities.includes("triage_ticket");
  const actions: ActionId[] = [];
  if (triages && MARKABLE_STATUSES.has(status)) {
    actions.push("mark-duplicate");
  }
  if (triages && status === TicketStatusValue.ignored) {
    actions.push("reopen");
  }
  if (triages && status === TicketStatusValue.duplicated) {
    actions.push("revert-duplicate");
  }
  if (
    (triages || capabilities.includes("manage_fetchers")) &&
    RERUNNABLE_STATUSES.has(status)
  ) {
    actions.push("rerun");
  }
  return actions;
}

// The outcome of a change of the status, as Sentinel returns the Ticket
// after it: what it did, then the status and the assignee that the Ticket
// now has, such as "Reopened: Analysis, assigned to you.".
function statusOutcome(
  done: string,
  { data }: TicketDetailResponse,
  signedInUser: string | undefined,
): string {
  let assignee = "unassigned";
  if (data.assignee !== null) {
    assignee =
      data.assignee.id === signedInUser
        ? "assigned to you"
        : `assigned to ${displayName(data.assignee)}`;
  }
  return `${done}: ${ticketStatusName(data.status)}, ${assignee}.`;
}

interface TicketActionsProps {
  ticket: TicketDetail;
  // The Ticket as the record of the outcomes of its changes.
  record: MessageRecord;
  // Whether the heading row is the compact heading.
  compact: boolean;
}

// Actions, for a user who can take at least one of its actions on the
// Ticket, and while it is open, its change is in progress, or the dialog of
// Mark as duplicate is open, which keep it as it started (docs/behaviors.md,
// The Signed-in User). Mark as duplicate… opens its dialog; Reopen, Revert
// duplicate, and Rerun convergence apply at once, without confirmation
// (docs/behaviors.md, Confirmation): while one is in progress, its item is
// busy, the other items are unavailable, and the menu cannot be closed; once
// Sentinel answers, the menu closes and the focus returns to Actions. The
// outcome of Reopen and Revert duplicate is announced once the read of the
// Ticket after it arrives, or shows in the message area when that read
// fails; Rerun convergence, which Sentinel accepts with 202, says in the
// message area that it started. A failure shows in the message area; one
// that says that the Ticket already left its status says so in the info
// tone (docs/behaviors.md, Where Errors Appear; Outcome of a Change).
export function TicketActions({ ticket, record, compact }: TicketActionsProps) {
  const ticketId = ticket.ticket_id;
  const user = useSignedInUser();
  const showMessage = useShowMessage();
  const mounted = useMounted();
  const ticketRead = useGetTicket(ticketId, { query: { enabled: false } });
  const outcome = useOutcomeAfterRead(ticketRead, record);
  // The reads after a change of the status, the duplicates of the Ticket
  // included.
  const readAgain = useReadAfterTicketChange(ticketId, true);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // Whether the dialog of Mark as duplicate is open, or opens once the menu
  // has closed.
  const [marking, setMarking] = useState<"opening" | "open">();
  const [offeredAtOpen, setOfferedAtOpen] = useState<readonly ActionId[]>([]);
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const reopenedText = (response: TicketDetailResponse) =>
    statusOutcome("Reopened", response, user?.id);
  const revertedText = (response: TicketDetailResponse) =>
    statusOutcome("Duplicate reverted", response, user?.id);
  // The outcome waits for the read of the Ticket after the change from the
  // instant at which Sentinel confirmed it, before the reads after it are
  // sent (useChangeOutcome).
  const reopen = useReopenTicket({
    mutation: useChangeOutcome(
      record,
      reopenedText,
      readAgain,
      (response: TicketDetailResponse) => {
        outcome.after(reopenedText(response));
      },
    ),
  });
  const revert = useRevertTicketDuplicate({
    mutation: useChangeOutcome(
      record,
      revertedText,
      readAgain,
      (response: TicketDetailResponse) => {
        outcome.after(revertedText(response));
      },
    ),
  });
  // Sentinel accepts the rerun with 202: it has started, not finished, so
  // its message, in the info tone, and the message of its failure show in
  // the message area, naming the Ticket after the user left its screen
  // (docs/behaviors.md, Outcome of a Change).
  const rerun = useRerunTicketConvergence({
    mutation: {
      gcTime: 0,
      onSuccess: () => {
        showMessage({ tone: "info", text: "Convergence started.", record });
      },
      onError: (failure: unknown) => {
        if (!isRequestFailure(failure)) {
          if (mounted.current) {
            setUiFailure({ error: failure });
          }
          return;
        }
        const presentation = presentChangeFailure(failure);
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
        readAgain();
      },
    },
  });
  const offered = actionsOf(ticket.status, user?.capabilities ?? []);
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }
  const pending = reopen.isPending || revert.isPending || rerun.isPending;
  // The menu cannot be closed while a change is in progress, and the dialog
  // opens from an item of the menu, so the items that the menu offered as
  // it opened are never empty then.
  const shown = open || marking !== undefined ? offeredAtOpen : offered;
  if (shown.length === 0) {
    return outcome.region;
  }

  // Once the menu has closed while the screen no longer offers Actions, as
  // after a read of the signed-in user took the capability away while it was
  // open or its change was in progress, the focus moves to the screen's
  // heading (focusHeadingAfterClose).
  const handOffAfterClose = () => {
    focusHeadingAfterClose(() => button.current);
  };

  const run = async (action: Exclude<ActionId, "mark-duplicate">) => {
    if (pending) {
      return;
    }
    try {
      if (action === "rerun") {
        await rerun.mutateAsync({ ticketId });
      } else if (action === "reopen") {
        await reopen.mutateAsync({ ticketId });
      } else {
        await revert.mutateAsync({ ticketId });
      }
      if (mounted.current) {
        setOpen(false);
        handOffAfterClose();
      }
    } catch (failure) {
      if (!mounted.current) {
        return;
      }
      setOpen(false);
      handOffAfterClose();
      // The rerun shows its own failure (above).
      if (action === "rerun") {
        return;
      }
      if (!isRequestFailure(failure)) {
        setUiFailure({ error: failure });
        return;
      }
      const left = presentExitConflict(
        failure,
        ticketId,
        action === "reopen" ? "Ignored" : "Duplicated",
      );
      if (left !== undefined) {
        showMessage({ tone: "info", text: left });
        return;
      }
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

  const statusItems = shown.filter((action) => action !== "rerun");
  return (
    <>
      <FocusHandOff>
        <ScreenActionsMenu
          label={`Actions of ${ticketId}`}
          isOpen={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) {
              setOfferedAtOpen(offered);
            } else {
              handOffAfterClose();
            }
          }}
          busy={pending}
          compact={compact}
          ref={button}
        >
          {shown.includes("mark-duplicate") && (
            <MenuAction
              id="mark-duplicate"
              icon={Merge}
              unavailable={pending}
              onAction={() => {
                // The dialog returns the focus, as it closes, to the element
                // that has it as it opens, so it opens once the menu has
                // closed and React Aria has returned the focus to Actions,
                // in a later frame in some browsers, rather than on the
                // item, which leaves the page with the menu.
                setMarking("opening");
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    setMarking("open");
                  });
                });
              }}
            >
              Mark as duplicate…
            </MenuAction>
          )}
          {shown.includes("reopen") && (
            <MenuAction
              id="reopen"
              icon={CirclePlay}
              busy={reopen.isPending ? "Reopening." : undefined}
              shouldCloseOnSelect={false}
              onAction={() => {
                void run("reopen");
              }}
            >
              Reopen
            </MenuAction>
          )}
          {shown.includes("revert-duplicate") && (
            <MenuAction
              id="revert-duplicate"
              icon={Split}
              busy={revert.isPending ? "Reverting the duplicate." : undefined}
              shouldCloseOnSelect={false}
              onAction={() => {
                void run("revert-duplicate");
              }}
            >
              Revert duplicate
            </MenuAction>
          )}
          {shown.includes("rerun") && statusItems.length > 0 && (
            <Separator className={MENU_SEPARATOR} />
          )}
          {shown.includes("rerun") && (
            <MenuAction
              id="rerun"
              icon={ListRestart}
              busy={rerun.isPending ? "Starting the convergence." : undefined}
              shouldCloseOnSelect={false}
              onAction={() => {
                void run("rerun");
              }}
            >
              Rerun convergence
            </MenuAction>
          )}
        </ScreenActionsMenu>
      </FocusHandOff>
      {outcome.region}
      {marking === "open" && (
        <MarkDuplicateDialog
          ticketId={ticketId}
          record={record}
          readAgain={readAgain}
          onClose={() => {
            setMarking(undefined);
          }}
          onDone={(text) => {
            setMarking(undefined);
            outcome.after(text);
          }}
        />
      )}
    </>
  );
}
