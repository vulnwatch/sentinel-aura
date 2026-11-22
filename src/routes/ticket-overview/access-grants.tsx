import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { Form } from "react-aria-components";
import {
  grantAccessFieldError,
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentChangeFailure,
  validationErrorFields,
} from "../../api/errors";
import type {
  TicketAccessGrantDataResponse,
  TicketAccessGrantListResponse,
  TicketAccessGrantResponse,
  UserDirectoryData,
} from "../../api/generated/model";
import {
  getListTicketActorsQueryKey,
  getListTicketEventsQueryKey,
} from "../../api/generated/ticket-audit-log";
import {
  getGetTicketQueryKey,
  getListTicketAccessGrantsQueryKey,
  getRevokeTicketAccessMutationKey,
  useGrantTicketAccess,
  useListTicketAccessGrants,
  useRevokeTicketAccess,
} from "../../api/generated/tickets";
import { Button } from "../../components/button";
import {
  useChangeOutcome,
  useOutcomeAfterRead,
} from "../../components/change-outcome";
import { DateTime } from "../../components/date-time";
import { useDiscardQuestion } from "../../components/discard-question";
import { useFieldErrorFocus } from "../../components/field-error-focus";
import {
  ConfirmationDialog,
  DialogErrorMessage,
  FirstFieldFocus,
  ModalDialog,
  type DialogError,
} from "../../components/modal-dialog";
import { Message } from "../../components/message";
import { userOptionText } from "../../components/options";
import { dataShown, PartRead } from "../../components/read-view";
import { displayName, User } from "../../components/user";
import { UserComboBox } from "../../components/user-combobox";
import { ticketRecord } from "../ticket";

// The access grants of a confidential Ticket, the dialog that the
// participants (src/routes/ticket-overview/participants.tsx) open, with Grant
// access and the grants.

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

// The outcome of a change that the dialog of the access grants shows at its
// top after a failed read, with a key that changes with each, so that the
// same text is announced again.
interface ShownOutcome {
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
  // Records the outcome of a grant that Sentinel confirmed, which the dialog
  // shows once the read of the grants after it arrives
  // (useOutcomeAfterRead).
  after: (text: string) => void;
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
// access or in the field, and the dialog announces it once the read of the
// grants after it arrives, such as "Access granted to Carol White.". The
// errors of the user field, 404
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
  after,
  inputRef,
}: GrantAccessFormProps) {
  const grant = useGrantTicketAccess({
    mutation: useChangeOutcome(
      ticketRecord(ticketId),
      (response: TicketAccessGrantDataResponse) =>
        grantedText(response.data.user),
      readAgain,
      (response: TicketAccessGrantDataResponse) => {
        after(grantedText(response.data.user));
      },
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
  const [fieldError, setFieldError] = useState<{ text: string }>();
  const [formError, setFormError] = useState<DialogError>();
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  // After a failure at the field, the field takes the focus, or its error is
  // announced when it holds the focus already (docs/behaviors.md,
  // Accessibility, Announcements).
  const { focusField, region } = useFieldErrorFocus(fieldError !== undefined);
  useEffect(() => {
    if (fieldError !== undefined) {
      focusField(inputRef.current, fieldError.text);
    }
  }, [fieldError, inputRef, focusField]);
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
      setFieldError({ text: atField });
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
      setFieldError({ text: "Choose a user." });
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    onBusyChange(true);
    try {
      await grant.mutateAsync({
        ticketId,
        data: { user: user.id },
      });
      choose(null);
      refocus.current = document.activeElement === inputRef.current;
      setFieldKey((key) => key + 1);
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
        error={fieldError?.text}
      />
      {region}
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
        // Records the outcome of a revocation that Sentinel confirmed, which
        // the dialog shows once the read of the grants after it arrives
        // (useOutcomeAfterRead).
        after: (text: string) => void;
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
// Sentinel confirms it, the confirmation closes, and the dialog announces it
// once the read of the grants after it arrives. Whatever its outcome, the
// screen then reads again what it affects, and the outcome of a revocation
// that ends after the user left the tab shows in the message area
// (useChangeOutcome).
function GrantItem({ ticketId, grant, revoke }: GrantItemProps) {
  const name = displayName(grant.user);
  const revokedText = `Access of ${name} revoked.`;
  const mutation = useRevokeTicketAccess({
    mutation: useChangeOutcome(
      ticketRecord(ticketId),
      () => revokedText,
      () => {
        revoke?.readAgain();
      },
      () => {
        revoke?.after(revokedText);
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
  // The read of the access grants of useParticipantReads
  // (src/routes/ticket-overview/participants.tsx).
  read: ReturnType<
    typeof useListTicketAccessGrants<TicketAccessGrantListResponse>
  >;
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
// dialog, which the rest of the page cannot hold while the dialog is open,
// once the read of the grants after it arrives; when that read fails, it
// shows at the top of the dialog instead, until the dialog closes, and once
// the dialog has closed, in the message area.
// When a grant whose line holds the focus leaves the list, as after its
// Revoke access, the focus moves to the Revoke access of the grant that
// followed it, or to the user field when none follows (docs/behaviors.md,
// Accessibility, Focus after an action). A Ticket that is no longer
// confidential keeps the dialog open, which then says so in place of its
// form and its grants, and takes the focus.
export function AccessGrantsDialog({
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
  // The outcome that the dialog shows at its top after a failed read, until
  // it closes.
  const [shown, setShown] = useState<ShownOutcome>();
  // The outcome of a grant or a revocation is announced once the read of the
  // grants after it arrives, when the confirmation of a revocation has
  // closed, so that the confirmation, which hides the rest of the page, does
  // not hide it. When that read fails, the grants show as before, so the
  // outcomes that it releases show together at the top of the dialog, which
  // keeps the rest of the page out of reach, in place of the earlier ones.
  // Once the dialog has closed, they show in the message area instead,
  // whatever the outcome of that read (docs/behaviors.md, Outcome of a
  // Change).
  const record = useMemo(() => ticketRecord(ticketId), [ticketId]);
  const showAtTop = useCallback((text: string) => {
    setShown((current) => ({ key: (current?.key ?? 0) + 1, text }));
  }, []);
  const outcome = useOutcomeAfterRead(
    read,
    record,
    isOpen ? showAtTop : undefined,
  );
  const content = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const focused = useRef<FocusedGrant>(undefined);
  const grants = dataShown(read)?.data;
  // The focus moves in the same commit in which the grant leaves the list,
  // so that it does not fall to the page meanwhile.
  useLayoutEffect(() => {
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
  }, [grants]);
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
    setShown(undefined);
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
      {/* The outcome after a failed read, in a status region that is there
          before it, so that it is announced. */}
      <output className="block">
        {shown !== undefined && (
          <div key={shown.key} className="mb-3">
            <Message tone="success">{shown.text}</Message>
          </div>
        )}
      </output>
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
                    after={outcome.after}
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
                                  after: outcome.after,
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
      {outcome.region}
    </ModalDialog>
  );
}
