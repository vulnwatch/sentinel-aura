import { useState } from "react";
import { isRequestFailure, presentChangeFailure } from "../../api/errors";
import type { TicketReferenceResponse } from "../../api/generated/model";
import { useDeleteReference } from "../../api/generated/ticket-references";
import { useChangeOutcome } from "../../components/change-outcome";
import {
  ConfirmationDialog,
  type DialogError,
} from "../../components/modal-dialog";
import { ticketRecord } from "../ticket";
import { DELETE, referenceName, useReadAgain } from "./shared";

// The confirmation of Delete of the tab References
// (src/routes/ticket-references.tsx).

interface DeleteDialogProps {
  ticketId: string;
  reference: TicketReferenceResponse;
  onClose: () => void;
  onDone: (text: string) => void;
}

// Delete, Delete Reference,
// DELETE /api/v1/tickets/{ticket_id}/references/{reference_id}, which asks
// for confirmation, since it cannot be undone in the UI (docs/behaviors.md,
// Confirmation): its question names the reference, and Delete reference, a
// danger button, deletes it. Its error shows at the top of the confirmation,
// which stays open; once Sentinel confirms it, the confirmation closes.
export function DeleteDialog({
  ticketId,
  reference,
  onClose,
  onDone,
}: DeleteDialogProps) {
  const deleted = `Reference ${referenceName(reference)} deleted.`;
  const readAgain = useReadAgain(ticketId);
  const remove = useDeleteReference({
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
  const confirm = async () => {
    setError(undefined);
    try {
      await remove.mutateAsync({ ticketId, referenceId: reference.id });
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
      title={`${DELETE} ${referenceName(reference)}?`}
      action={DELETE}
      onConfirm={() => {
        void confirm();
      }}
      isBusy={remove.isPending}
      error={error}
    >
      {"The reference is removed from this Ticket. This can't be undone."}
    </ConfirmationDialog>
  );
}
