import { linkOptions } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isRequestFailure, presentRefetchFailure } from "../../api/errors";
import { useGetCveSourceStatus, useRefetchCve } from "../../api/generated/cves";
import type {
  CVERefetchResult,
  CVESourceDerivedStatusValue,
  CVESourceStatusItem,
  TicketDetail,
} from "../../api/generated/model";
import { AbsentValue } from "../../components/absent-value";
import { Button } from "../../components/button";
import { DateTime } from "../../components/date-time";
import { SideSection } from "../../components/detail-screen";
import { IconButton } from "../../components/icon-button";
import { Label } from "../../components/label";
import { ValueMark, type MarkedName } from "../../components/marked-value";
import {
  useShowMessage,
  type MessageRecord,
} from "../../components/message-area";
import type { MessageTone } from "../../components/message";
import { dataShown, PartRead } from "../../components/read-view";
import { FocusHandOff } from "../../components/screen-heading";
import { useSignedInUser } from "../../session-gate";
import { CVE_SOURCE_NAMES } from "../ticket";
import { type ReadAgain, SOURCES_ANCHOR, useReadAgain } from "./shared";

// The sources of the CVE of the Ticket, in the side column of Overview
// (src/routes/ticket-overview.tsx), with Refetch.

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
export function useCveSources(ticket: TicketDetail) {
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
export function SourcesSection({ ticketId, cveId, read }: SourcesSectionProps) {
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
