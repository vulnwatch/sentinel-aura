import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Ban,
  Plus,
  RotateCcw,
  TriangleAlert,
  Undo2,
  UserPen,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  isRequestFailure,
  presentChangeFailure,
  presentMarkerConflict,
} from "../../api/errors";
import { useGetTicketPackageWork } from "../../api/generated/maintainer-operations";
import { PackageStatusValue } from "../../api/generated/model";
import type {
  LifecyclePhaseValue,
  PackageAdditionResponse,
  PackageDetail,
  ProductDetail,
  ProductEligibilityResponse,
  ProductReasonValue,
  TicketDetail,
  TicketDetailResponse,
  TrackDetail,
} from "../../api/generated/model";
import {
  useExcludeProduct,
  useOverrideProductEligibility,
  useRestoreProduct,
} from "../../api/generated/ticket-packages";
import {
  getGetTicketQueryKey,
  useGetTicket,
} from "../../api/generated/tickets";
import { AbsentValue } from "../../components/absent-value";
import { Button } from "../../components/button";
import {
  useChangeOutcome,
  useMounted,
  useOutcomeAfterRead,
} from "../../components/change-outcome";
import { COUNT } from "../../components/count";
import { DateTime } from "../../components/date-time";
import {
  DescriptionItem,
  DescriptionList,
} from "../../components/description-list";
import { Part } from "../../components/detail-screen";
import { DetailsName } from "../../components/details-popover";
import { GroupBand } from "../../components/group-band";
import { Label } from "../../components/label";
import { Maintainers } from "../../components/maintainers";
import { UpdatingBar } from "../../components/loading";
import { MenuAction } from "../../components/menu";
import { useShowMessage } from "../../components/message-area";
import { marksPlace } from "../../components/read-view";
import {
  FocusHandOff,
  useFocusHeadingOnRemoval,
} from "../../components/screen-heading";
import { Switch } from "../../components/switch";
import {
  TrackDelivery,
  TrackMilestones,
  type PhaseExtras,
} from "../../components/track-milestones";
import { User } from "../../components/user";
import { useSignedInUser } from "../../session-gate";
import { ticketRecord } from "../ticket";
import { OPERABLE_STATUSES } from "../ticket/shared";
import { AddPackageDialog, addedText } from "./add-package";
import { ReleaseRequests, SubmissionRequests } from "./ibs-requests";
import {
  createRecordTriggers,
  MANAGED_AFFECTEDNESS,
  PackageActions,
  TrackActions,
  TrackAffectedness,
  type TreeEdits,
  useFocusAfterExclusion,
  useMarkerOutcome,
} from "./package-edits";
import {
  MaybeDateTime,
  PACKAGES_ANCHOR,
  PHASES,
  useReadAfterTicketChange,
} from "./shared";

// The package tree of the Ticket, the last part of the main column of Overview
// (src/routes/ticket-overview.tsx): its packages, their tracks, and their
// Products, with the actions of a Product, the IBS requests of a track
// (src/routes/ticket-overview/ibs-requests.tsx), and the edits of the packages
// and the tracks (src/routes/ticket-overview/package-edits.tsx).

// The value of the search parameter hidden while the package tree shows its
// hidden records.
export const HIDDEN_SHOWN = "shown";

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

// The actions of a Product that its popover offers (ProductName).
type ProductAction = "eligibility" | "automatic" | "exclude" | "restore";

// What the actions of a Product depend on, as the popover offers them: its
// eligibility, whether a user set it by hand, and whether its own marker
// excludes it.
interface ProductState {
  eligible: boolean;
  override: boolean;
  excluded: boolean;
}

function productState(product: ProductDetail): ProductState {
  return {
    eligible: product.eligible,
    override: product.is_eligible_override,
    excluded: product.deleted_at !== null,
  };
}

interface ProductNameProps {
  product: ProductDetail;
  release: Release | undefined;
  packageId: string;
  packageName: string;
  trackId: string;
  reference: string;
  edits: TreeEdits;
}

// The name of a Product, which opens its details (ProductDetails), and, for
// a user who excluded and restored the records of the package tree as the
// popover opened (docs/behaviors.md, The Signed-in User), its actions, which
// follow the Product as the screen shows it, except while one is in
// progress: Mark as eligible or Mark as not eligible, whichever changes its
// eligibility, Override Product Eligibility, PATCH
// .../products/{ticket_package_product_id}; Return to automatic eligibility,
// with eligible null, while its eligibility is set by hand; and Exclude from
// this track, Soft-Delete Product, POST .../products/{id}/exclude, or
// Restore, Restore Product, POST .../products/{id}/restore, for a Product
// that its own marker excludes (Sentinel
// docs/features/packages/package-model.md, Override Product Eligibility,
// Reset behavior; Soft-Delete Product; Restore Product). Sentinel accepts
// them also on a hidden Product. None asks for confirmation: the exclusion
// of a Product ends no access, since maintainership concerns the package
// (Sentinel docs/features/packages/package-maintainership.md, Confidential
// Ticket Visibility), and another action reverses each. While an action is
// in progress, its item is busy, the others are unavailable, and the popover
// cannot be closed; once Sentinel answers, the popover closes and the focus
// returns to the name. The outcome is announced once the read of the Ticket
// after it arrives, or shows in the message area then when Sentinel answers
// that the Product is not actionable while "Show hidden" is off, as after an
// exclusion, or when that read fails; a failure shows in the message
// area, and one that says that another user did the same meanwhile says the
// state that the Product now has (docs/behaviors.md, Where Errors Appear;
// Outcome of a Change). The hooks of the changes live here, with the name,
// which stays on the page while the popover closes.
function ProductName({
  product,
  release,
  packageId,
  packageName,
  trackId,
  reference,
  edits,
}: ProductNameProps) {
  const showMessage = useShowMessage();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [offersAtOpen, setOffersAtOpen] = useState(false);
  // The action in progress, with the state of the Product as it started,
  // which its item keeps until Sentinel answers.
  const [running, setRunning] = useState<{
    action: ProductAction;
    state: ProductState;
  }>();
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const subject = `Product ${product.product_name} of ${packageName} · ${reference}`;
  const record = { packageId, trackId, productId: product.id };
  const eligibilityText = ({ data }: ProductEligibilityResponse) => {
    const value = data.eligible ? "eligible" : "not eligible";
    return data.is_eligible_override
      ? `${subject} marked as ${value}.`
      : `${subject} returned to automatic eligibility, ${value}.`;
  };
  const eligibility = useOverrideProductEligibility({
    mutation: useChangeOutcome(
      edits.record,
      eligibilityText,
      edits.readAgain,
      (response: ProductEligibilityResponse) => {
        edits.after(eligibilityText(response));
      },
    ),
  });
  const exclude = useExcludeProduct({
    mutation: useMarkerOutcome(edits, record, `${subject} excluded.`),
  });
  const restore = useRestoreProduct({
    mutation: useMarkerOutcome(edits, record, `${subject} restored.`),
  });
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }
  const busy = running !== undefined;
  const state = running?.state ?? productState(product);
  const ids = {
    ticketId: edits.ticketId,
    packageId,
    trackId,
    ticketPackageProductId: product.id,
  };

  const run = async (action: ProductAction) => {
    if (busy) {
      return;
    }
    setRunning({ action, state });
    try {
      if (action === "eligibility" || action === "automatic") {
        await eligibility.mutateAsync({
          ...ids,
          data: { eligible: action === "automatic" ? null : !state.eligible },
        });
      } else {
        await (action === "exclude" ? exclude : restore).mutateAsync(ids);
      }
    } catch (failure) {
      if (!mounted.current) {
        return;
      }
      if (!isRequestFailure(failure)) {
        setUiFailure({ error: failure });
        return;
      }
      const conflict =
        action === "exclude" || action === "restore"
          ? presentMarkerConflict(failure, action, subject)
          : undefined;
      const presentation =
        conflict === undefined ? presentChangeFailure(failure) : undefined;
      if (conflict !== undefined) {
        showMessage({ tone: "info", text: conflict });
      } else if (presentation !== undefined) {
        showMessage({
          tone: presentation.unconfirmed ? "warning" : "danger",
          text: presentation.message,
          reference: presentation.reference,
        });
      }
    }
    if (mounted.current) {
      setRunning(undefined);
      setOpen(false);
    }
  };

  // Each item keeps its id while a read changes its action, as from Exclude
  // to Restore, so that it keeps the focus; when a read removes the item
  // with the focus, React Aria gives it to the menu, the one stop of Tab of
  // its items.
  const item = (
    action: ProductAction,
    icon: LucideIcon,
    label: string,
    busyText: string,
  ) => (
    <MenuAction
      id={action === "restore" ? "exclude" : action}
      icon={icon}
      busy={running?.action === action ? busyText : undefined}
      unavailable={busy && running.action !== action}
      shouldCloseOnSelect={false}
      onAction={() => {
        void run(action);
      }}
    >
      {label}
    </MenuAction>
  );
  const actions = (
    <>
      {state.eligible
        ? item(
            "eligibility",
            UserPen,
            "Mark as not eligible",
            "Marking as not eligible.",
          )
        : item(
            "eligibility",
            UserPen,
            "Mark as eligible",
            "Marking as eligible.",
          )}
      {state.override &&
        item(
          "automatic",
          RotateCcw,
          "Return to automatic eligibility",
          "Returning to automatic eligibility.",
        )}
      {state.excluded
        ? item("restore", Undo2, "Restore", "Restoring.")
        : item("exclude", Ban, "Exclude from this track", "Excluding.")}
    </>
  );
  return (
    <DetailsName
      ref={edits.triggers.ref(product.id)}
      name={product.product_name}
      identifier={<span className="font-mono">{product.product_cpe}</span>}
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setOffersAtOpen(edits.manages);
        }
      }}
      actions={offersAtOpen ? actions : undefined}
      busy={busy}
    >
      <ProductDetails product={product} release={release} />
    </DetailsName>
  );
}

interface ProductItemProps {
  product: ProductDetail;
  packageId: string;
  packageName: string;
  trackId: string;
  reference: string;
  edits: TreeEdits;
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

// A Product of a track: its name, which opens its details and its actions
// (ProductName), in fg-muted when it is hidden or not eligible, and wraps;
// user-pen at 14 px in fg-muted when its eligibility is set by hand, read as
// ", eligibility set by hand"; the label Not eligible, and the labels of its
// own hidden state. Its release (releaseOf) shows in its details; at the end
// of its line only when the Product keeps the Ticket from Resolved:
// triangle-alert at 14 px in warning-icon, then "Not released", or "Release
// not observed", in text-13, weight 500, warning-on-soft, at the end of the
// next line where the line wraps.
function ProductItem({
  product,
  packageId,
  packageName,
  trackId,
  reference,
  edits,
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
        <ProductName
          product={product}
          release={release}
          packageId={packageId}
          packageName={packageName}
          trackId={trackId}
          reference={reference}
          edits={edits}
        />
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
              packageId={packageId}
              packageName={packageName}
              trackId={track.id}
              reference={track.reference}
              edits={edits}
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
export function useYourWork(ticket: TicketDetail) {
  const user = useSignedInUser();
  const sent = maintainsIncludedPackage(ticket, user?.id);
  const read = useGetTicketPackageWork(ticket.ticket_id, {
    query: { enabled: sent, refetchOnWindowFocus: true },
  });
  return { read, sent };
}

type YourWorkRead = ReturnType<typeof useYourWork>;

// The outcome of Add package, which shows in the message area once the read
// of the Ticket after it arrives, also when that read fails, since
// the counts that Sentinel returns say what it created, which the tree does
// not show (docs/behaviors.md, Outcome of a Change): followed, while "Show
// hidden" is off and that read shows the package hidden, by where it is.
function addedOutcome(
  response: PackageAdditionResponse,
  ticket: () => TicketDetail | undefined,
  showsHidden: () => boolean,
): () => string {
  return () => {
    const text = addedText(response);
    const added = ticket()?.packages.find(
      (ticketPackage) =>
        ticketPackage.package_name === response.data.package_name,
    );
    return added !== undefined && !added.actionable && !showsHidden()
      ? `${text} Show hidden shows it, since none of its Products is actionable.`
      : text;
  };
}

interface PackagesPartProps {
  ticket: TicketDetail;
  now: number;
  yourWork: YourWorkRead;
  // Whether the tree shows its hidden records, as hidden=shown in the URL
  // of the tab says.
  showHidden: boolean;
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
// accepts the edit, excludes and restores its packages, tracks, and Products,
// sets the affectedness of the tracks and the eligibility of the Products,
// and a user who holds admin_ticket_ops sets Fixed, as
// does manage_packages on a Ticket without a CVE (TreeEdits; Sentinel
// docs/features/identity/rbac.md, Endpoint Permission Map, Ticket Packages);
// after an edit, the screen reads again what it affects.
export function PackagesPart({
  ticket,
  now,
  yourWork,
  showHidden,
}: PackagesPartProps) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const ticketId = ticket.ticket_id;
  const [adding, setAdding] = useState(false);
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
  const editable = OPERABLE_STATUSES.has(ticket.status);
  const manages = editable && capabilities.includes("manage_packages");
  // Add package, for a user who adds packages; its dialog stays open, with
  // what it offered as it opened, also once a read of the signed-in user
  // takes the capability away (docs/behaviors.md, The Signed-in User).
  const offersAdd = manages;
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
      params: { ticketId },
      search: { hidden: shown ? HIDDEN_SHOWN : undefined },
      hash: true,
      resetScroll: false,
      hashScrollIntoView: false,
    });
  };
  // The switch is on only while the tree has hidden records: once a read
  // shows none, as after the restore of the last one, the screen removes
  // hidden=shown from its URL, in place of the URL in the browser history,
  // and the switch is off and disabled; the tree shows the same records
  // either way (docs/screen-map.md, Browser History). The removal asks
  // nothing of a dialog that holds input, which stays open with it
  // (docs/behaviors.md, Confirmation).
  const noneHidden = showHidden && count === 0;
  useEffect(() => {
    if (noneHidden) {
      void navigate({
        to: "/tickets/$ticketId",
        params: { ticketId },
        search: { hidden: undefined },
        hash: true,
        replace: true,
        resetScroll: false,
        hashScrollIntoView: false,
        ignoreBlocker: true,
      });
    }
  }, [noneHidden, navigate, ticketId]);
  // The announcements of the edits follow the part, apart from the warning
  // of the read of the work of a maintainer, which is its status region.
  const part = (
    <Part
      id={PACKAGES_ANCHOR}
      heading="Packages"
      actions={
        ticket.packages.length > 0 || offersAdd ? (
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            {ticket.packages.length > 0 && (
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
            )}
            {offersAdd && (
              <FocusHandOff>
                <Button
                  size="small"
                  icon={Plus}
                  onPress={() => {
                    setAdding(true);
                  }}
                >
                  Add package
                </Button>
              </FocusHandOff>
            )}
          </div>
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
      {adding && (
        <AddPackageDialog
          ticketId={ticketId}
          onClose={() => {
            setAdding(false);
          }}
          onDone={(response) => {
            setAdding(false);
            outcome.after(
              addedOutcome(
                response,
                () =>
                  client.getQueryData<TicketDetailResponse>(
                    getGetTicketQueryKey(ticketId),
                  )?.data,
                () => showsHidden.current,
              ),
              true,
            );
          }}
        />
      )}
    </>
  );
}
