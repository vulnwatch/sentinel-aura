import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Trash } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  ReferenceTypeValue,
  type TicketReferenceResponse,
} from "../api/generated/model";
import { useListReferences } from "../api/generated/ticket-references";
import { useGetTicket } from "../api/generated/tickets";
import { AbsentValue } from "../components/absent-value";
import { Button } from "../components/button";
import { useMounted, useOutcomeAfterRead } from "../components/change-outcome";
import { ClampedText } from "../components/clamped-text";
import { counted } from "../components/count";
import {
  EmptyState,
  FramedTable,
  type TableColumn,
} from "../components/data-table";
import { DateTime } from "../components/date-time";
import {
  ClearFilters,
  ClearFiltersAction,
  FilterGroup,
  Filters,
  FilterSelect,
  type FilterOption,
  type SelectOption,
} from "../components/filters";
import { IconButton } from "../components/icon-button";
import { Loading, UpdatingBar } from "../components/loading";
import { OptionsStatus } from "../components/options";
import { dataPlace, placeMessage } from "../components/read-view";
import { referenceTypeName } from "../components/reference-type";
import {
  ResultAnnouncement,
  useChangedSinceOpened,
} from "../components/result-announcement";
import { useRowFocusAfterRemoval } from "../components/row-focus";
import { FocusHandOff } from "../components/screen-heading";
import { addressText, WebLink } from "../components/web-link";
import {
  searchRedirect,
  stringifySearch,
  valueListParam,
} from "../search-params";
import { useSignedInUser } from "../session-gate";
import { CVE_FETCHER_NAMES, ticketRecord, ticketRoute } from "./ticket";
import { DeleteDialog } from "./ticket-references/delete-dialog";
import {
  ReferenceDialog,
  type DialogMode,
} from "./ticket-references/reference-dialog";
import { DELETE, EDIT, referenceName } from "./ticket-references/shared";

// The tab References of the Ticket screen (docs/screens/ticket.md,
// References): the references of the Ticket, from List References, which a
// user who holds manage_references adds, edits, and deletes when they are
// manual (Sentinel docs/features/tickets/ticket-references.md, API Endpoints;
// Sentinel docs/features/identity/rbac.md, Endpoint Permission Map, Ticket
// References).

// The source of the references that users manage; any other is the name of
// the fetcher that owns an automatic reference, which no user changes
// (Sentinel docs/features/tickets/ticket-references.md, Purpose).
const MANUAL = "manual";

// The source of a reference: Manual, or the CVE source of the fetcher that
// owns an automatic reference, as Sentinel names it, or as received
// (CVE_FETCHER_NAMES).
function sourceName(source: string): string {
  return source === MANUAL
    ? "Manual"
    : (CVE_FETCHER_NAMES.get(source) ?? source);
}

// ----------------------------------------------------------------------------
// The table

interface ReferenceCellProps {
  reference: TicketReferenceResponse;
}

// A reference: its title, a link to its address, at weight 500, or without a
// title its address as the link; below it, in text-13, fg-muted, the address
// that the link leads to; and below that its description, cut to its first
// four lines with Show more (docs/design-system.md, Main Content). An address
// breaks where it must (docs/behaviors.md, Links to Other Sites). It carries
// the identifier of the reference, by which the tab finds its row again.
function ReferenceCell({ reference }: ReferenceCellProps) {
  const address = addressText(reference.url);
  return (
    <div
      data-reference-id={reference.id}
      className="flex flex-col items-start gap-0.5"
    >
      <span className="font-medium wrap-anywhere">
        <WebLink address={reference.url}>{reference.title ?? address}</WebLink>
      </span>
      {reference.title !== null && (
        <span className="text-13 wrap-anywhere text-fg-muted">{address}</span>
      )}
      {reference.description !== null && (
        <div className="mt-1 max-w-full">
          <ClampedText>{reference.description}</ClampedText>
        </div>
      )}
    </div>
  );
}

interface RowActions {
  edit: (reference: TicketReferenceResponse) => void;
  remove: (reference: TicketReferenceResponse, index: number) => void;
}

// The columns of the table: the reference, which names its row; its type;
// its source; when it was added; and, for a user who holds
// manage_references, Edit and Delete at the end of the row of a manual
// reference (docs/design-system.md, Tables).
function columnsOf(
  rows: readonly TicketReferenceResponse[],
  actions: RowActions | undefined,
): TableColumn<TicketReferenceResponse>[] {
  const columns: TableColumn<TicketReferenceResponse>[] = [
    {
      id: "reference",
      name: "Reference",
      isRowHeader: true,
      grows: true,
      wraps: true,
      render: (reference) => <ReferenceCell reference={reference} />,
    },
    {
      id: "type",
      name: "Type",
      // Without a type, Uncategorized names the absence of one, which is not
      // another type (Sentinel docs/features/tickets/ticket-references.md,
      // ReferenceType; docs/behaviors.md, Absent Values).
      render: (reference) =>
        reference.type === null ? (
          <AbsentValue name={referenceTypeName(null)} />
        ) : (
          referenceTypeName(reference.type)
        ),
    },
    {
      id: "source",
      name: "Source",
      render: (reference) => sourceName(reference.source),
    },
    {
      id: "added",
      name: "Added",
      render: (reference) => <DateTime value={reference.created_at} />,
    },
  ];
  if (actions === undefined) {
    return columns;
  }
  return [
    ...columns,
    {
      id: "actions",
      name: "Actions",
      hidesName: true,
      // 14 px before the buttons, which with the padding of the cell leave it
      // 24 px of its own: once one of them has had the focus, React Aria's
      // table makes the cell its tab stop, and so a target of its own, which
      // needs that room beside them (WCAG 2.5.8, Target Size (Minimum)).
      render: (reference) =>
        reference.source === MANUAL ? (
          <div className="flex justify-end gap-1 ps-3.5 text-fg-muted">
            <IconButton
              size="small"
              icon={Pencil}
              label={`${EDIT} ${referenceName(reference)}`}
              tooltip="Edit"
              onPress={() => {
                actions.edit(reference);
              }}
            />
            <IconButton
              size="small"
              icon={Trash}
              label={`${DELETE} ${referenceName(reference)}`}
              tooltip="Delete"
              onPress={() => {
                actions.remove(
                  reference,
                  rows.findIndex((row) => row.id === reference.id),
                );
              }}
            />
          </div>
        ) : null,
    },
  ];
}

// A reference that Delete deletes, with its place in the table, which the
// focus takes once a read no longer returns it (useRowFocusAfterRemoval).
interface Removed {
  reference: TicketReferenceResponse;
  index: number;
}

// The identifier of a reference, which identifies its row.
function referenceId(reference: TicketReferenceResponse): string {
  return reference.id;
}

// The Delete of the row of a reference, which takes the focus after Delete
// of the row before it, or null without one.
function deleteIn(row: HTMLElement): HTMLElement | null {
  return row.querySelector<HTMLElement>(`button[aria-label^="${DELETE}"]`);
}

// ----------------------------------------------------------------------------
// The filters

// The values of the type filter: the types of the contract, and
// uncategorized for a reference without a type. List References returns
// every reference of the Ticket at once, without pages (Sentinel
// docs/features/tickets/ticket-references.md, List References), so the tab
// filters the references that it shows itself, also by a set of types and by
// the absence of one, which the filters of List References do not take.
const TYPE_FILTERS = [
  "advisory",
  "patch",
  "issue",
  "article",
  "uncategorized",
] as const satisfies readonly (ReferenceTypeValue | "uncategorized")[];

const TYPE_FILTER_OPTIONS: readonly FilterOption<
  (typeof TYPE_FILTERS)[number]
>[] = TYPE_FILTERS.map((value) => ({
  value,
  label:
    value === "uncategorized"
      ? referenceTypeName(null)
      : referenceTypeName(value),
}));

// The source filter: one source, as Sentinel records it, at most as long as
// it records one (same document, TicketReference), without U+0000.
const sourceParam = z
  .string()
  .min(1)
  .max(100)
  .refine((source) => !source.includes("\u0000"))
  .optional()
  .catch(undefined);

const referencesSearch = z.object({
  type: valueListParam(TYPE_FILTERS),
  source: sourceParam,
});

type ReferencesSearch = z.output<typeof referencesSearch>;

// The number of the filters that apply.
function filtersApplied(search: ReferencesSearch): number {
  return [search.type, search.source].filter((value) => value !== undefined)
    .length;
}

// Whether a reference matches the filters: one of the types chosen, a
// reference without a type matching Uncategorized and one of a type that the
// pinned contract does not list matching none (docs/behaviors.md, Unknown
// Values); and the source chosen.
function matches(
  reference: TicketReferenceResponse,
  search: ReferencesSearch,
): boolean {
  const type = reference.type ?? "uncategorized";
  return (
    (search.type === undefined ||
      search.type.some((value) => value === type)) &&
    (search.source === undefined || reference.source === search.source)
  );
}

// The value of the source filter without one.
const ANY_SOURCE = "";

// The sources of the references of the Ticket, as options of the filter:
// Manual first, then the others by their name.
function sourceOptions(
  references: readonly TicketReferenceResponse[],
): SelectOption<string>[] {
  // Only the sources that the pinned contract lists (docs/behaviors.md,
  // Unknown Values); a reference of another source shows in the table, and
  // a URL can still name its source.
  const sources = [
    ...new Set(references.map((reference) => reference.source)),
  ].filter((source) => source === MANUAL || CVE_FETCHER_NAMES.has(source));
  return sources
    .map((source) => ({
      value: source,
      text: sourceName(source),
      label: sourceName(source),
    }))
    .toSorted((first, second) => {
      if (first.value === MANUAL || second.value === MANUAL) {
        return first.value === MANUAL ? -1 : 1;
      }
      return first.text.localeCompare(second.text, "en");
    });
}

// What the tab shows after a change of the filters, in words, which
// assistive technologies announce: the references that match, or the line
// in their place.
function resultText(shown: number, all: number): string {
  if (all === 0) {
    return NO_REFERENCES;
  }
  if (shown === 0) {
    return NO_MATCH;
  }
  return counted(shown, { one: "reference", other: "references" });
}

const NO_MATCH = "No references match the filters.";
const NO_REFERENCES = "No references.";

// ----------------------------------------------------------------------------
// The tab

// The references of the Ticket, from List References,
// GET /api/v1/tickets/{ticket_id}/references, in the order of the API, by
// type, then by the time they were added (Sentinel
// docs/features/tickets/ticket-references.md, List References): at the end
// of the toolbar above them, Add reference for a user who holds
// manage_references, then Filters, by type and by source, and Clear filters
// while a filter applies, which comes last, so that it moves no other
// control to another row as it appears (docs/design-system.md, Lists);
// then the references that match the filters as a table across the width of
// the tab (docs/design-system.md, Tables; Lists), "No references match the
// filters." with Clear filters inside its frame when none matches, or "No
// references." without any. A change of the filters announces what the table
// shows. The read shows at once with the
// tabs, and its failure once the Ticket has arrived, so that a Ticket that
// the user cannot see shows Not found (docs/behaviors.md, Loading; Where
// Errors Appear). The outcome of a change is announced once a read of the
// references after it arrives, or shows in the message area when that read
// fails (useOutcomeAfterRead). The focus follows
// docs/behaviors.md (Accessibility, Focus after an action): after Delete, it
// moves to the Delete of the row that takes its place, or to that row when
// it has none, or to Add reference when no row follows; and when a read
// removes the row that holds it, or an Edit takes that row out of the
// filters, it moves to the screen's heading. A row that a read moves, as
// after an Edit that changes the type, which orders the rows, keeps it.
function TicketReferences() {
  const { ticketId } = ticketReferencesRoute.useParams();
  const user = useSignedInUser();
  const manages = user?.capabilities.includes("manage_references") === true;
  const ticketShown =
    useGetTicket(ticketId, { query: { enabled: false } }).data !== undefined;
  const read = useListReferences(ticketId);
  const search = ticketReferencesRoute.useSearch();
  // The filters that apply as a change ends, which the user can change while
  // it is in progress, such as with back.
  const applies = useRef(search);
  useLayoutEffect(() => {
    applies.current = search;
  }, [search]);
  const navigate = useNavigate();
  // Whether the tab is still on the page as a change ends: once the user
  // has left it, the change shows its outcome itself (useChangeOutcome).
  const mounted = useMounted();
  const place = dataPlace(read);
  const all = place.data?.data;
  const rows = useMemo(
    () => all?.filter((reference) => matches(reference, search)),
    [all, search],
  );
  const applied = filtersApplied(search);
  const failure = ticketShown ? place.failure : null;
  const waiting = place.waiting || (place.failure !== null && !ticketShown);

  const [dialog, setDialog] = useState<DialogMode>();
  const [deleting, setDeleting] = useState<Removed>();
  const add = useRef<HTMLDivElement>(null);
  const references = useRef<HTMLDivElement>(null);
  // The outcome of a change, which the tab announces once a read of the
  // references after it arrives, or shows in the message area, naming the
  // Ticket once the user has left the tab (useOutcomeAfterRead).
  const record = useMemo(() => ticketRecord(ticketId), [ticketId]);
  const outcome = useOutcomeAfterRead(read, record);
  // The focus when the row that holds it leaves the table: after Delete, to
  // the Delete of the row that takes its place, or to that row without one,
  // or to Add reference when no row follows; otherwise, as when a read
  // removes it or an Edit takes it out of the filters, to the screen's
  // heading (useRowFocusAfterRemoval).
  const fallback = useCallback(() => add.current?.querySelector("button"), []);
  const rowFocus = useRowFocusAfterRemoval({
    container: references,
    rows,
    rowId: referenceId,
    attribute: "data-reference-id",
    control: deleteIn,
    fallback,
    read,
  });

  const actions = useMemo<RowActions | undefined>(
    () =>
      manages
        ? {
            edit: (reference) => {
              setDialog({ kind: "edit", reference });
            },
            remove: (reference, index) => {
              setDeleting({ reference, index });
            },
          }
        : undefined,
    [manages],
  );
  const columns = useMemo(
    () => columnsOf(rows ?? [], actions),
    [rows, actions],
  );

  const refine = (change: Partial<ReferencesSearch>) => {
    void navigate({
      to: "/tickets/$ticketId/references",
      params: { ticketId },
      search: (previous) => ({ ...previous, ...change }),
    });
  };
  const clearFilters = () => {
    void navigate({
      to: "/tickets/$ticketId/references",
      params: { ticketId },
      search: {},
    });
  };
  // A change of the filters announces what the table shows; the tab as it
  // opens does not (docs/behaviors.md, Accessibility, Focus after a
  // navigation).
  const key = stringifySearch(search);
  const changed = useChangedSinceOpened(key);
  // What the tab shows after the change of the filters, as it shows it
  // then: a later change of the references, such as a Delete, announces its
  // own outcome, not the result of the filters again.
  const [result, setResult] = useState<{ key: string; text: string }>();
  if (
    changed &&
    rows !== undefined &&
    all !== undefined &&
    result?.key !== key
  ) {
    setResult({ key, text: resultText(rows.length, all.length) });
  }
  const filtered = result?.key === key ? result.text : "";
  const filtersStatus = read.status === "error" ? placeMessage(read) : filtered;
  const sources = sourceOptions(all ?? []);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {manages && (
          <div ref={add}>
            <Button
              size="small"
              icon={Plus}
              onPress={() => {
                setDialog({ kind: "add" });
              }}
            >
              Add reference
            </Button>
          </div>
        )}
        <Filters
          applied={applied}
          status={<span key={key}>{filtersStatus}</span>}
        >
          <FilterGroup
            label="Type"
            options={TYPE_FILTER_OPTIONS}
            selected={search.type ?? []}
            onChange={(values) => {
              refine({ type: values.length === 0 ? undefined : values });
            }}
          />
          <FilterSelect
            label="Source"
            groups={[
              [{ value: ANY_SOURCE, text: "Any source", label: "Any source" }],
              sources,
            ]}
            status={
              all === undefined ? (
                <OptionsStatus>
                  {read.status === "error" ? (
                    <p>{placeMessage(read)}</p>
                  ) : (
                    <Loading inValue />
                  )}
                </OptionsStatus>
              ) : null
            }
            selected={search.source ?? ANY_SOURCE}
            unlisted={sourceName(search.source ?? "")}
            onChange={(source) => {
              refine({ source: source === ANY_SOURCE ? undefined : source });
            }}
          />
        </Filters>
        {applied > 0 && <ClearFilters onPress={clearFilters} />}
      </div>
      <div ref={references} className="relative">
        {place.updating && <UpdatingBar />}
        <output className="block">{failure ?? place.warning}</output>
        {all === undefined || rows === undefined ? (
          waiting && <Loading />
        ) : all.length === 0 ? (
          // A key of each place, so that the one that leaves the page hands
          // the focus off, rather than taking the content of the other.
          <FocusHandOff key="empty">
            <p className="text-fg-muted">No references.</p>
          </FocusHandOff>
        ) : (
          <FramedTable
            key="rows"
            label="References"
            columns={columns}
            rows={rows}
            rowId={referenceId}
            empty={
              <EmptyState
                message={NO_MATCH}
                action={<ClearFiltersAction onPress={clearFilters} />}
              />
            }
          />
        )}
      </div>
      {/* What the tab shows after a change of the filters, also one that
          Clear filters or the browser history makes, outside the popover
          (docs/behaviors.md, Accessibility, Focus after a navigation); and
          the outcome of a change. */}
      <ResultAnnouncement state={key}>{filtered}</ResultAnnouncement>
      {outcome.region}
      {dialog !== undefined && (
        <ReferenceDialog
          ticketId={ticketId}
          mode={dialog}
          onClose={() => {
            setDialog(undefined);
          }}
          onDone={(text, reference) => {
            if (!mounted.current) {
              return;
            }
            setDialog(undefined);
            // The dialog returns the focus to the Edit that opened it as it
            // closes (docs/behaviors.md, Accessibility, Dialogs), so its row
            // holds the focus from now on, also before React Aria has
            // returned it: a read that takes the row away meanwhile moves the
            // focus to the screen's heading.
            if (dialog.kind === "edit") {
              rowFocus.holds(dialog.reference.id);
            }
            // A reference that the filters hide shows nowhere where the user
            // acted, so its outcome shows in the message area
            // (docs/behaviors.md, Outcome of a Change), also once the next
            // read has arrived, after the dialog has given the page back to
            // assistive technologies.
            outcome.after(text, !matches(reference, applies.current));
          }}
        />
      )}
      {deleting !== undefined && (
        <DeleteDialog
          ticketId={ticketId}
          reference={deleting.reference}
          onClose={() => {
            setDeleting(undefined);
          }}
          onDone={(text) => {
            if (!mounted.current) {
              return;
            }
            rowFocus.deleted(deleting.reference.id, deleting.index);
            setDeleting(undefined);
            outcome.after(text);
          }}
        />
      )}
    </>
  );
}

// The tab References, at its path under the path of the Ticket. A URL with a
// search parameter that it does not accept, or with a value that it does not
// accept or gives in another form, leads to the URL that it gives that state,
// in place of the URL in the browser history (docs/behaviors.md, Invalid
// Search Parameters; docs/screen-map.md, Browser History).
export const ticketReferencesRoute = createRoute({
  getParentRoute: () => ticketRoute,
  path: "references",
  validateSearch: referencesSearch,
  beforeLoad: ({ location, params }) => {
    const accepted = searchRedirect(referencesSearch, location);
    if (accepted !== undefined) {
      throw redirect({
        to: "/tickets/$ticketId/references",
        params,
        ...accepted,
      });
    }
  },
  component: TicketReferences,
});
