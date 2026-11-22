import { useQueryClient } from "@tanstack/react-query";
import { UserRoundKey } from "lucide-react";
import { useEffect, useState } from "react";
import { isNotConfidential } from "../../api/errors";
import type {
  TicketAccessGrantResponse,
  TicketDetail,
} from "../../api/generated/model";
import { useListTicketActors } from "../../api/generated/ticket-audit-log";
import {
  getGetTicketQueryKey,
  useListTicketAccessGrants,
} from "../../api/generated/tickets";
import { Button } from "../../components/button";
import { sectionHeadingId, SideSection } from "../../components/detail-screen";
import { PartRead, type Read } from "../../components/read-view";
import {
  FocusHandOff,
  focusScreenHeading,
} from "../../components/screen-heading";
import { displayName, type UserFields } from "../../components/user";
import { UserGroup } from "../../components/user-group";
import { useSignedInUser } from "../../session-gate";
import { AccessGrantsDialog } from "./access-grants";
import { PARTICIPANTS_ANCHOR } from "./shared";

// The participants of the Ticket, the last part of the side column of Overview
// (src/routes/ticket-overview.tsx), with Access grants, which opens their
// dialog (src/routes/ticket-overview/access-grants.tsx).

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
