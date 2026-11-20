import { Ban, Undo2 } from "lucide-react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  isRequestFailure,
  presentChangeFailure,
  presentMarkerConflict,
} from "../../api/errors";
import {
  PackageStatusValue,
  TicketStatusValue,
} from "../../api/generated/model";
import type {
  PackageDetail,
  TrackDetail,
  TrackStatusResponse,
} from "../../api/generated/model";
import {
  useChangeTrackStatus,
  useExcludePackage,
  useExcludeTrack,
  useRestorePackage,
  useRestoreTrack,
} from "../../api/generated/ticket-packages";
import { ActionsMenu } from "../../components/actions-menu";
import { useChangeOutcome, useMounted } from "../../components/change-outcome";
import { ChoiceMenu } from "../../components/choice-menu";
import { MarkedValue, type MarkedName } from "../../components/marked-value";
import { MenuAction } from "../../components/menu";
import {
  useShowMessage,
  type MessageRecord,
} from "../../components/message-area";
import {
  ConfirmationDialog,
  type DialogError,
} from "../../components/modal-dialog";
import {
  FocusHandOff,
  focusScreenHeading,
} from "../../components/screen-heading";

// The edits of the packages and the tracks of the package tree
// (src/routes/ticket-overview/packages.tsx): their Exclude and Restore, the
// affectedness of a track, and the focus after a record leaves the tree, with
// what every edit of the tree shares.

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

// The statuses of a Ticket in which Sentinel accepts an edit of its package
// tree: Ignored and Duplicated refuse it with 409 TICKET_NOT_MUTABLE, and a
// status that the pinned contract does not list offers no action (Sentinel
// docs/features/tickets/tickets.md, Mutability Guard; Sentinel
// docs/api-spec.md, Manual-Zone Mutability Guard; docs/behaviors.md, Unknown
// Values).
export const PACKAGE_EDITABLE_STATUSES = new Set<string>([
  TicketStatusValue.new,
  TicketStatusValue.analysis,
  TicketStatusValue.analyzed,
  TicketStatusValue.resolved,
]);

// The affectedness of a track that manage_packages sets on every Ticket.
// Fixed needs admin_ticket_ops, or manage_packages on a Ticket without a CVE
// (Sentinel docs/features/packages/package-model.md, Manual Transitions).
export const MANAGED_AFFECTEDNESS: readonly PackageStatusValue[] = [
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
// hides, while "Show hidden" is off: a package, a track of it, or a Product
// of the track, with the instant at which Sentinel confirmed it, after which
// the first read of the Ticket decides where the focus moves
// (useFocusAfterExclusion).
interface HiddenRecord {
  packageId: string;
  trackId?: string;
  productId?: string;
  at: number;
}

// The menus of the actions of the packages and tracks, and the names of the
// Products, by the id of their record, which take the focus after an
// exclusion hides the record before them.
interface RecordTriggers {
  ref: (id: string) => (element: HTMLButtonElement | null) => void;
  get: (id: string) => HTMLButtonElement | undefined;
}

export function createRecordTriggers(): RecordTriggers {
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
// stays, React Aria returns the focus to it, in a later frame in some
// browsers, and the focus is left to it.
function handOffAfterClose(button: () => HTMLElement | null | undefined) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const element = button();
      if (
        (document.activeElement === null ||
          document.activeElement === document.body) &&
        (element === null || element === undefined || !element.isConnected)
      ) {
        focusScreenHeading();
      }
    });
  });
}

// What the records of the package tree need for their edits (PackagesPart,
// src/routes/ticket-overview/packages.tsx).
export interface TreeEdits {
  ticketId: string;
  // Whether the user excludes and restores the records and sets the
  // eligibility of the Products: with manage_packages, on a Ticket whose
  // status accepts the edit.
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
// response says that the record is not actionable while "Show hidden" is
// off, as after an exclusion, also when that read shows the record again,
// as after another user restored it meanwhile; and then the focus moves on
// (useFocusAfterExclusion).
export function useMarkerOutcome(
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

// The id of the one item of the menu of the actions of a package or a track,
// Exclude, Exclude…, or Restore.
const MARKER_ITEM = "marker";

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
// "Exclude…". The item follows the record as a read shows it, keeping the
// focus. While the change is in progress, its item is busy, stays as it
// started, and the menu cannot be closed; once Sentinel answers, the menu
// closes and the focus returns to its button. The outcome is announced once
// the read of the Ticket after it arrives, or shows in the message area then
// when Sentinel answers that the record is not actionable while "Show
// hidden" is off, as after an exclusion, or when that read fails. A
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
  const button = () => edits.triggers.get(record.trackId ?? record.packageId);
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
        handOffAfterClose(button);
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
      handOffAfterClose(button);
      showMessage({
        tone: presentation.unconfirmed ? "warning" : "danger",
        text: presentation.message,
        reference: presentation.reference,
      });
    }
  };

  // The item follows the record as the screen shows it, except while its
  // change is in progress, which keeps the item that started it; Exclude,
  // Exclude…, and Restore have one id, so that a read that turns one into
  // another keeps the focus on the item.
  const shown = exclude.pending
    ? "exclude"
    : restore.pending || excluded
      ? "restore"
      : "exclude";
  let item: ReactNode;
  if (shown === "restore") {
    item = (
      <MenuAction
        id={MARKER_ITEM}
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
  } else if (confirmation === undefined || exclude.pending) {
    item = (
      <MenuAction
        id={MARKER_ITEM}
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
        id={MARKER_ITEM}
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
              handOffAfterClose(button);
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
// (docs/behaviors.md, Confirmation). While its change is in progress, its
// other choices are unavailable. The outcome is announced once the read of
// the Ticket after it arrives, such as "Affectedness of fictional-openssl ·
// SUSE:FLES-15-SP7:Update changed to Affected.", or shows in the message
// area when that read fails; a failure shows in the message area.
export function TrackAffectedness({
  track,
  packageId,
  packageName,
  edits,
}: TrackAffectednessProps) {
  const showMessage = useShowMessage();
  const mounted = useMounted();
  const select = useRef<HTMLButtonElement>(null);
  const button = () => select.current;
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
      handOffAfterClose(button);
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
        ref={select}
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
            handOffAfterClose(button);
          }
        }}
        onChoose={(choice) => {
          void choose(choice);
        }}
      />
    </FocusHandOff>
  );
}

// The element that takes the focus after an exclusion hid its record
// (useFocusAfterExclusion), given the package tree that the read after it
// shows: after a Product, the name of the next Product of its track that
// shows, otherwise the menu of the actions of its track, and, when the track
// no longer shows either, as after an exclusion of the track; after a track,
// the menu of the next track of its package that shows, otherwise that of
// its package, and, when the package no longer shows either, as after an
// exclusion of the package; after a package, the menu of the next package
// that shows, otherwise "Show hidden", which leads to Restore. null while the
// record still shows, as when another user restored it meanwhile.
function focusTargetAfter(
  packages: readonly PackageDetail[],
  gone: Omit<HiddenRecord, "at">,
  triggers: RecordTriggers,
  showHidden: HTMLElement | null,
): HTMLElement | null | undefined {
  const index = packages.findIndex((item) => item.id === gone.packageId);
  const ticketPackage = packages[index];
  if (gone.trackId !== undefined && ticketPackage?.actionable === true) {
    const tracks = ticketPackage.tracks;
    const at = tracks.findIndex((track) => track.id === gone.trackId);
    const track = tracks[at];
    if (track?.actionable === true) {
      if (gone.productId === undefined) {
        return null;
      }
      const products = track.products;
      const place = products.findIndex(
        (product) => product.id === gone.productId,
      );
      if (products[place]?.actionable === true) {
        return null;
      }
      const next = products
        .slice(place + 1)
        .find((product) => product.actionable);
      return triggers.get(next?.id ?? track.id);
    }
    const next = tracks.slice(at + 1).find((item) => item.actionable);
    return triggers.get(next?.id ?? ticketPackage.id);
  }
  if (gone.trackId === undefined && ticketPackage?.actionable === true) {
    return null;
  }
  const next = packages.slice(index + 1).find((item) => item.actionable);
  return next === undefined
    ? showHidden?.querySelector("input")
    : triggers.get(next.id);
}

// Where the focus moves after an exclusion hides its record while "Show
// hidden" is off, once the read of the Ticket after it shows the record no
// longer (focusTargetAfter; docs/behaviors.md, Accessibility, Focus after an
// action). When that read fails, the focus stays where it is, and it moves
// only from the record that left the page, or from the screen's heading,
// so that a user who moved it meanwhile keeps it.
export function useFocusAfterExclusion(
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
    const target = focusTargetAfter(
      packages,
      gone,
      triggers,
      showHidden.current,
    );
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
export function TrackActions({
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
export function PackageActions({ ticketPackage, edits }: PackageActionsProps) {
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
