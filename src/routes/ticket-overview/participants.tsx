import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { UserRoundKey } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { Form } from "react-aria-components";
import {
  grantAccessFieldError,
  isNotConfidential,
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentChangeFailure,
  validationErrorFields,
} from "../../api/errors";
import type {
  TicketAccessGrantDataResponse,
  TicketAccessGrantResponse,
  TicketDetail,
  UserDirectoryData,
} from "../../api/generated/model";
import {
  getListTicketActorsQueryKey,
  getListTicketEventsQueryKey,
  useListTicketActors,
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
import { useChangeOutcome } from "../../components/change-outcome";
import { DateTime } from "../../components/date-time";
import { sectionHeadingId, SideSection } from "../../components/detail-screen";
import { useDiscardQuestion } from "../../components/discard-question";
import {
  ConfirmationDialog,
  DialogErrorMessage,
  FirstFieldFocus,
  ModalDialog,
  type DialogError,
} from "../../components/modal-dialog";
import { userOptionText } from "../../components/options";
import { dataShown, PartRead, type Read } from "../../components/read-view";
import {
  FocusHandOff,
  focusScreenHeading,
} from "../../components/screen-heading";
import { displayName, User, type UserFields } from "../../components/user";
import { UserComboBox } from "../../components/user-combobox";
import { UserGroup } from "../../components/user-group";
import { useSignedInUser } from "../../session-gate";
import { ticketRecord } from "../ticket";
import { PARTICIPANTS_ANCHOR } from "./shared";

// The participants of the Ticket, the last part of the side column of Overview
// (src/routes/ticket-overview.tsx), with its access grants.

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
export function useParticipantReads(ticket: TicketDetail) {
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
export function ParticipantsSection({
  ticket,
  reads,
}: ParticipantsSectionProps) {
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
