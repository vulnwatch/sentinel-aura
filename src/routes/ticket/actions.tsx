import {
  CirclePause,
  CirclePlay,
  Gauge,
  ListRestart,
  Lock,
  LockOpen,
  Merge,
  Plus,
  Split,
  UserPen,
} from "lucide-react";
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
  useIgnoreTicket,
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
import { useSignedInUser } from "../../session-gate";
import { useReadAfterTicketChange } from "../ticket-overview/shared";
import { AssociateCveDialog } from "./associate-cve";
import {
  ConfidentialityDialog,
  useReadAfterConfidentiality,
} from "./confidentiality";
import { IgnoreDialog, ignoredText } from "./ignore";
import { MarkDuplicateDialog } from "./mark-duplicate";
import { OverridePriorityDialog } from "./override-priority";
import { SetSeverityDialog } from "./set-severity";
import { assigneeOutcome, OPERABLE_STATUSES } from "./shared";

// Actions, the menu at the end of the heading row of the Ticket screen
// (src/routes/ticket.tsx; docs/design-system.md, Detail Screens), with the
// changes of the status of the Ticket, the corrections of what Sentinel
// derived for it, and Rerun convergence.

// The actions of the menu, in its order: those of the status, Ignore…
// first, so that the keyboard, which opens the menu on its first item, opens
// a dialog rather than ignoring at once; then, apart, the corrections of
// what Sentinel derived for the Ticket; then, apart, Rerun convergence, a
// recovery of Sentinel's own work; then, apart, the change of the
// confidentiality.
type ActionId =
  | "ignore"
  | "ignore-not-shipped"
  | "mark-duplicate"
  | "reopen"
  | "revert-duplicate"
  | "override-priority"
  | "set-severity"
  | "associate-cve"
  | "rerun"
  | "make-confidential"
  | "make-non-confidential";

// The dialogs that an action opens.
type DialogId =
  | "ignore"
  | "mark-duplicate"
  | "override-priority"
  | "set-severity"
  | "associate-cve"
  | "confidentiality";

// The actions that change the confidentiality of the Ticket, each with its
// confirmation.
const CONFIDENTIALITY = new Set<ActionId>([
  "make-confidential",
  "make-non-confidential",
]);

// The actions that correct what Sentinel derived for the Ticket.
const CORRECTIONS = new Set<ActionId>([
  "override-priority",
  "set-severity",
  "associate-cve",
]);

// The statuses from which Sentinel ignores a Ticket (Sentinel
// docs/features/tickets/tickets.md, Status Transitions; Ignore Ticket).
const IGNORABLE_STATUSES = new Set<string>([
  TicketStatusValue.new,
  TicketStatusValue.analysis,
]);

// The statuses in which Sentinel reruns the convergence of a Ticket: New is
// not among them (Sentinel docs/features/tickets/tickets.md, Rerun Ticket
// Convergence). Sentinel marks a Ticket as a duplicate from its operable
// statuses (OPERABLE_STATUSES). A status that the pinned contract does not
// list offers no action (docs/behaviors.md, Unknown Values).
const RERUNNABLE_STATUSES = new Set<string>([
  TicketStatusValue.analysis,
  TicketStatusValue.analyzed,
  TicketStatusValue.resolved,
]);

// The actions that the user can take on the Ticket in its status: those of
// its status with triage_ticket, Rerun convergence with triage_ticket or
// manage_fetchers, and the change of the confidentiality with
// manage_confidentiality, in every status, since Sentinel accepts it also on
// an Ignored or Duplicated Ticket (Sentinel docs/features/identity/rbac.md,
// Endpoint Permission Map (Tickets); Sentinel
// docs/features/tickets/tickets.md, Set Confidentiality). An action that the
// status does not allow is not offered (docs/screens/ticket.md, Actions), and
// neither are Set severity… and Associate CVE… on a Ticket with a CVE.
function actionsOf(
  ticket: TicketDetail,
  capabilities: readonly string[],
): readonly ActionId[] {
  const status = ticket.status;
  const hasCve = ticket.cve !== null;
  const triages = capabilities.includes("triage_ticket");
  const actions: ActionId[] = [];
  if (triages && IGNORABLE_STATUSES.has(status)) {
    actions.push("ignore", "ignore-not-shipped");
  }
  if (triages && OPERABLE_STATUSES.has(status)) {
    actions.push("mark-duplicate");
  }
  if (triages && status === TicketStatusValue.ignored) {
    actions.push("reopen");
  }
  if (triages && status === TicketStatusValue.duplicated) {
    actions.push("revert-duplicate");
  }
  // Without a CVE, Sentinel takes the severity set by hand, and the Ticket
  // can take a CVE (Sentinel docs/features/tickets/tickets.md, Set Severity
  // Manual; Associate CVE).
  if (triages && OPERABLE_STATUSES.has(status)) {
    actions.push("override-priority");
    if (!hasCve) {
      actions.push("set-severity", "associate-cve");
    }
  }
  if (
    (triages || capabilities.includes("manage_fetchers")) &&
    RERUNNABLE_STATUSES.has(status)
  ) {
    actions.push("rerun");
  }
  if (capabilities.includes("manage_confidentiality")) {
    actions.push(
      ticket.is_confidential ? "make-non-confidential" : "make-confidential",
    );
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
  return `${done}: ${ticketStatusName(data.status)}, ${assigneeOutcome(data.assignee, signedInUser)}.`;
}

interface TicketActionsProps {
  ticket: TicketDetail;
  // The Ticket as the record of the outcomes of its changes.
  record: MessageRecord;
  // Whether the heading row is the compact heading.
  compact: boolean;
}

// Actions, for a user who can take at least one of its actions on the
// Ticket, and while it is open, its change is in progress, or a dialog of
// one of its items is open, which keep it as it started (docs/behaviors.md,
// The Signed-in User). Ignore…, Mark as duplicate…, and the corrections open
// their dialogs, and Make confidential… and Make non-confidential… their
// confirmations (src/routes/ticket/confidentiality.tsx);
// the quick action that ignores the Ticket as not shipped, Reopen, Revert
// duplicate, and Rerun convergence apply at once, without confirmation
// (docs/behaviors.md, Confirmation): while one is in progress, its item is
// busy, the other items are unavailable, and the menu cannot be closed; once
// Sentinel answers, the menu closes and the focus returns to Actions. The
// outcome of a change of the status is announced once the read of the
// Ticket after it arrives, or shows in the message area when that read
// fails; Rerun convergence, which Sentinel accepts with 202, says in the
// message area that it started. A failure shows in the message area; one
// that says that the Ticket already left Ignored or Duplicated says so in
// the info tone (docs/behaviors.md, Where Errors Appear; Outcome of a
// Change).
export function TicketActions({ ticket, record, compact }: TicketActionsProps) {
  const ticketId = ticket.ticket_id;
  const user = useSignedInUser();
  const showMessage = useShowMessage();
  const mounted = useMounted();
  const ticketRead = useGetTicket(ticketId, { query: { enabled: false } });
  const outcome = useOutcomeAfterRead(ticketRead, record);
  // The reads after a change of the status, the duplicates of the Ticket
  // included, which it can move to another original.
  const readAgain = useReadAfterTicketChange(ticketId, true);
  // The reads after a correction of the priority, the severity, or the CVE,
  // which changes none of the duplicates (docs/screens/ticket.md, Actions).
  const readAfterCorrection = useReadAfterTicketChange(ticketId);
  const readAfterConfidentiality = useReadAfterConfidentiality(ticketId);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // The dialog that is open, or opens once the menu has closed.
  const [dialog, setDialog] = useState<{
    id: DialogId;
    open: boolean;
  }>();
  const [offeredAtOpen, setOfferedAtOpen] = useState<readonly ActionId[]>([]);
  // Whether the confirmation of the confidentiality makes the Ticket
  // confidential, as its item did.
  const [makesConfidential, setMakesConfidential] = useState(false);
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
  // The quick action, which ignores the Ticket with the reason not_shipped
  // (Sentinel docs/features/tickets/tickets.md, Ignore Ticket).
  const ignoredOutcome = (response: TicketDetailResponse) =>
    ignoredText(response, user?.id);
  const ignore = useIgnoreTicket({
    mutation: useChangeOutcome(
      record,
      ignoredOutcome,
      readAgain,
      (response: TicketDetailResponse) => {
        outcome.after(ignoredOutcome(response));
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
  const offered = actionsOf(ticket, user?.capabilities ?? []);
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }
  const pending =
    ignore.isPending || reopen.isPending || revert.isPending || rerun.isPending;
  // The menu cannot be closed while a change is in progress, and the dialog
  // opens from an item of the menu, so the items that the menu offered as
  // it opened are never empty then.
  const shown = open || dialog !== undefined ? offeredAtOpen : offered;
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

  // The dialog returns the focus, as it closes, to the element that has it
  // as it opens, so it opens once the menu has closed and React Aria has
  // returned the focus to Actions, in a later frame in some browsers, rather
  // than on the item, which leaves the page with the menu.
  const openDialog = (id: DialogId) => {
    setDialog({ id, open: false });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDialog({ id, open: true });
      });
    });
  };

  const run = async (
    action: Exclude<
      ActionId,
      DialogId | "make-confidential" | "make-non-confidential"
    >,
  ) => {
    if (pending) {
      return;
    }
    try {
      if (action === "rerun") {
        await rerun.mutateAsync({ ticketId });
      } else if (action === "ignore-not-shipped") {
        await ignore.mutateAsync({
          ticketId,
          data: { reason: "not_shipped" },
        });
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
      const left =
        action === "ignore-not-shipped"
          ? undefined
          : presentExitConflict(
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

  const statusItems = shown.filter(
    (action) =>
      action !== "rerun" &&
      !CORRECTIONS.has(action) &&
      !CONFIDENTIALITY.has(action),
  );
  const corrections = shown.filter((action) => CORRECTIONS.has(action));
  const confidentiality = shown.filter((action) => CONFIDENTIALITY.has(action));
  // The dialog of a correction that is open, with the outcome of its change
  // and the reads after it, without the duplicates.
  const dialogProps = {
    ticket,
    record,
    readAgain: readAfterCorrection,
    onClose: () => {
      setDialog(undefined);
    },
    onDone: (text: string) => {
      setDialog(undefined);
      outcome.after(text);
    },
  };
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
          {shown.includes("ignore") && (
            <MenuAction
              id="ignore"
              icon={CirclePause}
              unavailable={pending}
              onAction={() => {
                openDialog("ignore");
              }}
            >
              Ignore…
            </MenuAction>
          )}
          {shown.includes("ignore-not-shipped") && (
            <MenuAction
              id="ignore-not-shipped"
              icon={CirclePause}
              busy={ignore.isPending ? "Ignoring." : undefined}
              unavailable={pending && !ignore.isPending}
              shouldCloseOnSelect={false}
              onAction={() => {
                void run("ignore-not-shipped");
              }}
            >
              Ignore as not shipped by SUSE
            </MenuAction>
          )}
          {shown.includes("mark-duplicate") && (
            <MenuAction
              id="mark-duplicate"
              icon={Merge}
              unavailable={pending}
              onAction={() => {
                openDialog("mark-duplicate");
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
          {corrections.length > 0 && statusItems.length > 0 && (
            <Separator className={MENU_SEPARATOR} />
          )}
          {shown.includes("override-priority") && (
            <MenuAction
              id="override-priority"
              icon={UserPen}
              unavailable={pending}
              onAction={() => {
                openDialog("override-priority");
              }}
            >
              Override priority…
            </MenuAction>
          )}
          {shown.includes("set-severity") && (
            <MenuAction
              id="set-severity"
              icon={Gauge}
              unavailable={pending}
              onAction={() => {
                openDialog("set-severity");
              }}
            >
              Set severity…
            </MenuAction>
          )}
          {shown.includes("associate-cve") && (
            <MenuAction
              id="associate-cve"
              icon={Plus}
              unavailable={pending}
              onAction={() => {
                openDialog("associate-cve");
              }}
            >
              Associate CVE…
            </MenuAction>
          )}
          {shown.includes("rerun") &&
            statusItems.length + corrections.length > 0 && (
              <Separator className={MENU_SEPARATOR} />
            )}
          {shown.includes("rerun") && (
            <MenuAction
              id="rerun"
              icon={ListRestart}
              busy={rerun.isPending ? "Starting the convergence." : undefined}
              unavailable={pending && !rerun.isPending}
              shouldCloseOnSelect={false}
              onAction={() => {
                void run("rerun");
              }}
            >
              Rerun convergence
            </MenuAction>
          )}
          {confidentiality.length > 0 &&
            shown.length > confidentiality.length && (
              <Separator className={MENU_SEPARATOR} />
            )}
          {shown.includes("make-confidential") && (
            <MenuAction
              id="make-confidential"
              icon={Lock}
              unavailable={pending}
              onAction={() => {
                setMakesConfidential(true);
                openDialog("confidentiality");
              }}
            >
              Make confidential…
            </MenuAction>
          )}
          {shown.includes("make-non-confidential") && (
            <MenuAction
              id="make-non-confidential"
              icon={LockOpen}
              unavailable={pending}
              onAction={() => {
                setMakesConfidential(false);
                openDialog("confidentiality");
              }}
            >
              Make non-confidential…
            </MenuAction>
          )}
        </ScreenActionsMenu>
      </FocusHandOff>
      {outcome.region}
      {dialog?.open === true && dialog.id === "mark-duplicate" && (
        <MarkDuplicateDialog
          ticketId={ticketId}
          record={record}
          readAgain={readAgain}
          onClose={() => {
            setDialog(undefined);
          }}
          onDone={(text) => {
            setDialog(undefined);
            outcome.after(text);
          }}
        />
      )}
      {dialog?.open === true && dialog.id === "override-priority" && (
        <OverridePriorityDialog {...dialogProps} />
      )}
      {dialog?.open === true && dialog.id === "set-severity" && (
        <SetSeverityDialog {...dialogProps} />
      )}
      {dialog?.open === true && dialog.id === "associate-cve" && (
        <AssociateCveDialog {...dialogProps} />
      )}
      {dialog?.open === true && dialog.id === "confidentiality" && (
        <ConfidentialityDialog
          {...dialogProps}
          readAgain={readAfterConfidentiality}
          confidential={makesConfidential}
          user={user}
        />
      )}
      {dialog?.open === true && dialog.id === "ignore" && (
        <IgnoreDialog
          ticket={ticket}
          record={record}
          signedInUser={user?.id}
          readAgain={readAgain}
          onClose={() => {
            setDialog(undefined);
          }}
          onDone={(text) => {
            setDialog(undefined);
            outcome.after(text);
          }}
        />
      )}
    </>
  );
}
