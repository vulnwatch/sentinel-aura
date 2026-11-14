import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { useGetCveAffectedVersions } from "../api/generated/cves";
import type {
  CVEAffectedVersionEntry,
  CVEAffectedVersionGroup,
} from "../api/generated/model";
import { useGetTicket } from "../api/generated/tickets";
import { AbsentValue } from "../components/absent-value";
import { Button } from "../components/button";
import { ClampedText } from "../components/clamped-text";
import { EmptyState } from "../components/data-table";
import {
  DescriptionItem,
  DescriptionList,
  FIELD,
} from "../components/description-list";
import { DetailsName } from "../components/details-popover";
import { GroupBand } from "../components/group-band";
import { Loading, UpdatingBar } from "../components/loading";
import { MarkedValue, type MarkedName } from "../components/marked-value";
import { dataPlace } from "../components/read-view";
import {
  FocusHandOff,
  useFocusHeadingOnRemoval,
} from "../components/screen-heading";
import { SearchField } from "../components/search-field";
import { addressText, WebLink } from "../components/web-link";
import {
  sameSearch,
  SEARCH_MAX_LENGTH,
  searchTermParam,
  stringifySearch,
} from "../search-params";
import { CVE_SOURCE_NAMES, ticketRoute } from "./ticket";

// The tab Affected versions of the Ticket screen (docs/screens/ticket.md,
// Affected versions): the affected products and versions of the CVE of the
// Ticket, as its sources report them, from Get CVE Affected Versions
// (Sentinel docs/features/tickets/cve-tracking.md, Get CVE Affected
// Versions), by affected product, and within a product by the source that
// reports them: the provenance scope of the entries, which is not one of the
// CVE sources that Overview shows.

// A count, its thousands grouped (docs/behaviors.md, Style).
const COUNT = new Intl.NumberFormat("en-US");

function entriesText(count: number): string {
  return `${COUNT.format(count)} ${count === 1 ? "entry" : "entries"}`;
}

// ----------------------------------------------------------------------------
// Sources

// How the entries of a scope read, which depends on the writer of the scope
// (Sentinel docs/features/tickets/cve-tracking.md, Get CVE Affected
// Versions, Interpreting entries): the CVE JSON 5.x containers, cna and
// adp:*; ghsa; osv; and other, a scope that the pinned contract does not
// list, whose entries show only what their fields state, without a meaning
// that depends on the writer (docs/behaviors.md, Unknown Values).
type ScopeKind = "record" | "ghsa" | "osv" | "other";

interface Scope {
  // The name of the source, the heading of its block.
  name: string;
  kind: ScopeKind;
}

const CNA = "cna";
const ADP_PREFIX = "adp:";

// The source of a scope, as the tab names it: CNA, the short name of an ADP,
// such as CISA-ADP, and the CVE sources GHSA and OSV as Sentinel names them
// (CVE_SOURCE_NAMES); any other as received (docs/behaviors.md, Unknown
// Values).
function scopeOf(container: string): Scope {
  if (container === CNA) {
    return { name: "CNA", kind: "record" };
  }
  if (
    container.startsWith(ADP_PREFIX) &&
    container.length > ADP_PREFIX.length
  ) {
    return { name: container.slice(ADP_PREFIX.length), kind: "record" };
  }
  if (container === "ghsa" || container === "osv") {
    return {
      name: CVE_SOURCE_NAMES.get(container) ?? container,
      kind: container,
    };
  }
  return { name: container, kind: "other" };
}

// ----------------------------------------------------------------------------
// Packages

// The fields that name a package, in the order in which the tab takes the
// first that an entry has: its product, its package name, or, without
// either, the first address or identifier that it has.
const NAME_FIELDS = [
  "product",
  "package_name",
  "repo",
  "collection_url",
  "package_url",
  "cpe",
] as const;

type NameField = (typeof NAME_FIELDS)[number];

function nameFieldOf(entry: CVEAffectedVersionEntry): NameField | undefined {
  return NAME_FIELDS.find((field) => (entry[field] ?? "").trim() !== "");
}

// The fields that the entries of one block share, as the entries of one
// affected[] element of a CVE record do: what the line of its source and
// the fields below it show.
function blockKey(container: string, entry: CVEAffectedVersionEntry): string {
  return JSON.stringify([
    container,
    entry.vendor,
    entry.product,
    entry.package_name,
    entry.ecosystem,
    entry.repo,
    entry.collection_url,
    entry.package_url,
    entry.cpe,
    entry.program_files,
    entry.default_status,
  ]);
}

// The entries of one source for one package, which share the fields of
// blockKey, in the order of the API.
interface SourceBlock {
  key: string;
  scope: Scope;
  entries: CVEAffectedVersionEntry[];
}

interface PackageView {
  // The name of the package, or null for an entry without any field that
  // names one.
  name: string | null;
  // Whether the name is an address, which shows as a link.
  isAddress: boolean;
  blocks: SourceBlock[];
}

const COLLATOR = new Intl.Collator("en");

// Packages in alphabetical order of their name, a package without a name
// last.
function compareNames(first: PackageView, second: PackageView): number {
  if (first.name === null || second.name === null) {
    return Number(first.name === null) - Number(second.name === null);
  }
  return COLLATOR.compare(first.name, second.name);
}

// The entries of the CVE by package, a package being every entry whose name
// is the same, as Sentinel returns it: within a package, each block of a
// source, the CNA first, the authority of the record of the CVE, then the
// other sources in the order of the API, and the entries of each block in
// that order (Sentinel docs/features/tickets/cve-tracking.md, Get CVE
// Affected Versions, Filtering and sorting).
function packagesOf(groups: readonly CVEAffectedVersionGroup[]): PackageView[] {
  const ordered = [
    ...groups.filter((group) => group.source_container === CNA),
    ...groups.filter((group) => group.source_container !== CNA),
  ];
  const packages = new Map<string, PackageView>();
  const blocks = new Map<string, SourceBlock>();
  for (const group of ordered) {
    const scope = scopeOf(group.source_container);
    for (const entry of group.entries) {
      const nameField = nameFieldOf(entry);
      const name = nameField === undefined ? null : entry[nameField];
      const packageId = JSON.stringify(name);
      let view = packages.get(packageId);
      if (view === undefined) {
        view = {
          name,
          isAddress: nameField === "repo" || nameField === "collection_url",
          blocks: [],
        };
        packages.set(packageId, view);
      }
      const key = `${packageId}\u0000${blockKey(group.source_container, entry)}`;
      let block = blocks.get(key);
      if (block === undefined) {
        block = { key, scope, entries: [] };
        blocks.set(key, block);
        view.blocks.push(block);
      }
      block.entries.push(entry);
    }
  }
  return [...packages.values()].toSorted(compareNames);
}

// ----------------------------------------------------------------------------
// Versions

// The statuses of an entry (Sentinel docs/features/tickets/cve-tracking.md,
// Get CVE Affected Versions, CVEAffectedVersionEntry), with the
// tone of their meaning: Affected orange, as the affectedness of a track,
// Unaffected green, Unknown gray (docs/design-system.md, Other Values).
const STATUSES = new Map<string, MarkedName>(
  Object.entries({
    affected: { name: "Affected", tone: "warning" },
    unaffected: { name: "Unaffected", tone: "success" },
    unknown: { name: "Unknown", tone: "neutral" },
  }),
);

// Whether an entry makes a line of its own: an entry of a CVE JSON 5.x
// container without a version, an end, or a status of its own carries no
// version detail, and the last line of its block says what applies to its
// versions (SourceItem).
function namesVersions(entry: CVEAffectedVersionEntry, kind: ScopeKind) {
  return (
    kind !== "record" ||
    entry.version !== null ||
    entry.version_end !== null ||
    entry.status !== null
  );
}

interface VersionValueProps {
  value: string;
  // Whether the value is a commit, which shows in monospace.
  commit: boolean;
}

function VersionValue({ value, commit }: VersionValueProps) {
  return (
    <span className={`wrap-anywhere ${commit ? "font-mono text-13" : ""}`}>
      {value}
    </span>
  );
}

function capitalized(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

// The versions of an entry in words, as its scope means them (Sentinel
// docs/features/tickets/cve-tracking.md, Get CVE Affected Versions,
// Interpreting entries): a range, "From 1.0 before 1.5", "From 1.0 through
// 1.4.2", or, without a start, "Before 1.5"; a single version, "1.5"; an
// open range of GHSA or OSV, "From 1.0.0"; an entry of OSV without versions,
// "Every version"; and an entry without version details. A version alone of
// a scope that the pinned contract does not list shows as received.
function versionsOf(
  entry: CVEAffectedVersionEntry,
  kind: ScopeKind,
): ReactNode {
  const { version, version_end: end, version_end_inclusive: inclusive } = entry;
  const commit = entry.version_type === "git";
  let endWord = "up to";
  if (inclusive === true) {
    endWord = "through";
  } else if (inclusive === false) {
    endWord = "before";
  }
  if (version !== null && end !== null) {
    if (version === end && inclusive === true) {
      return <VersionValue value={version} commit={commit} />;
    }
    return (
      <>
        From <VersionValue value={version} commit={commit} /> {endWord}{" "}
        <VersionValue value={end} commit={commit} />
      </>
    );
  }
  if (version !== null) {
    if (
      kind === "record" ||
      kind === "other" ||
      entry.version_type === "exact"
    ) {
      return <VersionValue value={version} commit={commit} />;
    }
    return (
      <>
        From <VersionValue value={version} commit={commit} />
      </>
    );
  }
  if (end !== null) {
    return (
      <>
        {capitalized(endWord)} <VersionValue value={end} commit={commit} />
      </>
    );
  }
  return kind === "osv" ? (
    "Every version"
  ) : (
    <AbsentValue name="No version details" />
  );
}

interface VersionLineProps {
  children: ReactNode;
  // The status of the line, or null without one, which leaves the end of the
  // line empty.
  status: string | null;
}

// A line of the versions of a block: its versions, which wrap, and at its
// end, 12 px later, in a column of 104 px, its status with the dot of its
// tone, on the first line of the versions. Under the pointer the line is on
// surface, with a 4 px radius, so that the eye follows it to its status
// (docs/design-system.md, Detail Screens).
function VersionLine({ children, status }: VersionLineProps) {
  return (
    <li className="-mx-2 grid grid-cols-[minmax(0,1fr)_6.5rem] items-baseline gap-x-3 rounded px-2 py-0.5 hover:bg-surface">
      <span className="min-w-0">{children}</span>
      <span>
        {status !== null && <MarkedValue value={status} known={STATUSES} />}
      </span>
    </li>
  );
}

// ----------------------------------------------------------------------------
// The blocks

interface AddressProps {
  value: string;
}

// An address of an entry: a link where it is a web address, its text
// otherwise (docs/behaviors.md, Links to Other Sites).
function Address({ value }: AddressProps) {
  return <WebLink address={value}>{addressText(value)}</WebLink>;
}

interface BlockFieldsProps {
  entry: CVEAffectedVersionEntry;
  // The name of the package, which the fields do not repeat.
  name: string | null;
}

// The fields that the entries of a block share, as the details of its
// source, without the one that names the package, or an empty list without
// any: its vendor; its package name; its ecosystem; its repository and its
// collection URL, links where they are web addresses; its Package URL and
// its CPE, as text; the version types of its entries; and, last, its program
// files, below their term, cut to their first four lines.
function blockFields({
  entry,
  name,
  types,
}: BlockFieldsProps & { types: readonly string[] }): ReactNode[] {
  const fields: ReactNode[] = [];
  const shown = (value: string | null): value is string =>
    value !== null && value !== name;
  if (entry.vendor !== null) {
    fields.push(
      <DescriptionItem key="vendor" term="Vendor">
        <span className="wrap-anywhere">{entry.vendor}</span>
      </DescriptionItem>,
    );
  }
  if (shown(entry.package_name) && entry.package_name !== entry.product) {
    fields.push(
      <DescriptionItem key="package" term="Package name">
        <span className="wrap-anywhere">{entry.package_name}</span>
      </DescriptionItem>,
    );
  }
  if (entry.ecosystem !== null) {
    fields.push(
      <DescriptionItem key="ecosystem" term="Ecosystem">
        {entry.ecosystem}
      </DescriptionItem>,
    );
  }
  if (shown(entry.repo)) {
    fields.push(
      <DescriptionItem key="repo" term="Repository">
        <span className="wrap-anywhere">
          <Address value={entry.repo} />
        </span>
      </DescriptionItem>,
    );
  }
  if (shown(entry.collection_url)) {
    fields.push(
      <DescriptionItem key="collection" term="Collection URL">
        <span className="wrap-anywhere">
          <Address value={entry.collection_url} />
        </span>
      </DescriptionItem>,
    );
  }
  if (shown(entry.package_url)) {
    fields.push(
      <DescriptionItem key="purl" term="Package URL">
        <span className="font-mono text-13 wrap-anywhere">
          {entry.package_url}
        </span>
      </DescriptionItem>,
    );
  }
  if (shown(entry.cpe)) {
    fields.push(
      <DescriptionItem key="cpe" term="CPE">
        <span className="font-mono text-13 wrap-anywhere">{entry.cpe}</span>
      </DescriptionItem>,
    );
  }
  if (types.length > 0) {
    fields.push(
      <DescriptionItem key="types" term="Version type">
        {types.join(", ")}
      </DescriptionItem>,
    );
  }
  const files = entry.program_files ?? [];
  if (files.length > 0) {
    fields.push(
      <DescriptionItem key="files" term="Program files" stacked>
        <ClampedText>{files.join(", ")}</ClampedText>
      </DescriptionItem>,
    );
  }
  return fields;
}

// The version types of the entries of a block, each once, in their order.
function versionTypes(entries: readonly CVEAffectedVersionEntry[]): string[] {
  return [
    ...new Set(
      entries.flatMap((entry) =>
        entry.version_type === null ? [] : [entry.version_type],
      ),
    ),
  ];
}

interface SourceItemProps {
  block: SourceBlock;
  // The entries of the block that the search shows, in its order.
  shown: readonly CVEAffectedVersionEntry[];
  name: string | null;
  // What tells the block from the other blocks of its source in its product,
  // such as ", 2 of 2", or "" for the one block of its source.
  ordinal: string;
}

// The block of a source within its affected product, a field of the
// description list of the product (docs/design-system.md, Detail Screens):
// the name of the source as its term, in text-13, fg-muted, in the column of
// 104 px, which opens the fields that its entries share, as the name of a
// record opens its details (docs/design-system.md, Menus, Popovers, and
// Tooltips), or is text without any; and its versions as its value, a list,
// each line with its status. For a CVE JSON 5.x container, an entry without
// a status of its own takes the status of its affected[] element, and a last
// line with that status says what applies to the versions that the source
// does not list, "Other versions", or "All versions" when it lists none,
// while the search hides none of its lines, so that it never seems to cover
// a version that the search hides. When the block leaves the page with the
// focus, as after a search, the focus moves to the screen's heading
// (docs/behaviors.md, Accessibility, Focus after an action).
function SourceItem({ block, shown, name, ordinal }: SourceItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusHeadingOnRemoval(ref);
  const [first] = block.entries;
  if (first === undefined) {
    return null;
  }
  const { kind } = block.scope;
  const record = kind === "record";
  const listed = block.entries.filter((entry) => namesVersions(entry, kind));
  const lines = shown.filter((entry) => namesVersions(entry, kind));
  const fields = blockFields({
    entry: first,
    name,
    types: versionTypes(block.entries),
  });
  return (
    <div ref={ref} className={`${FIELD} items-baseline gap-y-1`}>
      <dt className="text-13 text-fg-muted">
        {fields.length === 0 ? (
          block.scope.name
        ) : (
          <DetailsName
            name={block.scope.name}
            label={`${block.scope.name} for ${name ?? "the unnamed product"}${ordinal}`}
            identifier={name ?? undefined}
          >
            <DescriptionList>{fields}</DescriptionList>
          </DetailsName>
        )}
      </dt>
      <dd className="min-w-0">
        <ul className="flex flex-col text-14">
          {lines.map((entry, index) => (
            <VersionLine
              // oxlint-disable-next-line react/no-array-index-key -- the entries have no identifier, and their order is fixed
              key={index}
              status={entry.status ?? (record ? entry.default_status : null)}
            >
              {versionsOf(entry, kind)}
            </VersionLine>
          ))}
          {record &&
            first.default_status !== null &&
            lines.length === listed.length && (
              <VersionLine status={first.default_status}>
                <span className="text-fg-muted">
                  {listed.length === 0 ? "All versions" : "Other versions"}
                </span>
              </VersionLine>
            )}
          {record && first.default_status === null && listed.length === 0 && (
            <VersionLine status={null}>
              <AbsentValue name="No version details" />
            </VersionLine>
          )}
        </ul>
      </dd>
    </div>
  );
}

// What tells each block of a product from the other blocks of its source in
// the product, by the key of the block: ", 1 of 2" and ", 2 of 2" for a
// source with two blocks, such as the Git ranges and the stable versions of
// a kernel CVE, which the accessible name of its details adds, so that each
// name tells its control from the others (WCAG 2.2, 2.4.6), and "" for a
// source with one. A search keeps the ordinal of each block.
function ordinalsOf(blocks: readonly SourceBlock[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const block of blocks) {
    counts.set(block.scope.name, (counts.get(block.scope.name) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return new Map(
    blocks.map((block) => {
      const count = counts.get(block.scope.name) ?? 1;
      const rank = (seen.get(block.scope.name) ?? 0) + 1;
      seen.set(block.scope.name, rank);
      return [block.key, count === 1 ? "" : `, ${rank} of ${count}`];
    }),
  );
}

interface PackageGroupProps {
  view: PackageView;
  // The entries that the search shows, by block.
  shown: ReadonlyMap<string, readonly CVEAffectedVersionEntry[]>;
}

// An affected product as a group under a band (GroupBand): its name as a
// level-two heading, a link where it is a web address, or "Unnamed product"
// in fg-muted for entries without any field that names one; below it,
// indented by 12 px, the blocks of its sources as a description list, 12 px
// apart, each term above its value where the list is narrower than 280 px.
// When the product leaves the page with the focus, as after a search, the
// focus moves to the screen's heading.
function PackageGroup({ view, shown }: PackageGroupProps) {
  const ref = useRef<HTMLLIElement>(null);
  useFocusHeadingOnRemoval(ref);
  const ordinals = ordinalsOf(view.blocks);
  const blocks = view.blocks.filter(
    (block) => (shown.get(block.key)?.length ?? 0) > 0,
  );
  return (
    <li ref={ref}>
      <GroupBand
        level={2}
        heading={
          view.name === null ? (
            <AbsentValue name="Unnamed product" />
          ) : view.isAddress ? (
            <Address value={view.name} />
          ) : (
            view.name
          )
        }
      />
      <div className="@container ms-3 mt-3">
        <dl className="flex flex-col gap-3">
          {blocks.map((block) => (
            <SourceItem
              key={block.key}
              block={block}
              shown={shown.get(block.key) ?? []}
              name={view.name}
              ordinal={ordinals.get(block.key) ?? ""}
            />
          ))}
        </dl>
      </div>
    </li>
  );
}

// ----------------------------------------------------------------------------
// The search

// Whether an entry holds the term, without regard to case, in one of its
// values as received.
function holds(entry: CVEAffectedVersionEntry, term: string): boolean {
  const values = [
    entry.vendor,
    entry.product,
    entry.package_name,
    entry.ecosystem,
    entry.repo,
    entry.collection_url,
    entry.package_url,
    entry.cpe,
    entry.version,
    entry.version_type,
    entry.version_end,
    entry.status,
    entry.default_status,
    ...(entry.program_files ?? []),
  ];
  return values.some(
    (value) => value?.toLocaleLowerCase("en").includes(term) === true,
  );
}

// The entries of each block that hold the term, or every entry without one.
function shownEntries(
  packages: readonly PackageView[],
  search: string | undefined,
): Map<string, readonly CVEAffectedVersionEntry[]> {
  const term = search?.toLocaleLowerCase("en");
  return new Map(
    packages.flatMap((view) =>
      view.blocks.map((block) => [
        block.key,
        term === undefined
          ? block.entries
          : block.entries.filter((entry) => holds(entry, term)),
      ]),
    ),
  );
}

const NO_MATCH = "No entries match the search.";
const NO_ENTRIES = "Sentinel has no version data for this CVE.";
const NO_CVE = "This Ticket has no CVE.";

// What the tab shows after a search, in words, which assistive technologies
// announce.
function resultText(shown: number, all: number): string {
  if (all === 0) {
    return NO_ENTRIES;
  }
  return shown === 0 ? NO_MATCH : entriesText(shown);
}

// ----------------------------------------------------------------------------
// The tab

interface VersionsProps {
  cveId: string;
  search: string | undefined;
  // Whether the search changed since the tab opened, after which the tab
  // announces what it shows.
  searched: boolean;
  onClear: () => void;
}

// The entries of the CVE, from Get CVE Affected Versions,
// GET /api/v1/cves/{cve_id}/affected-versions, read when the tab opens:
// every entry at once, without pages (Sentinel
// docs/features/tickets/cve-tracking.md, Get CVE Affected Versions,
// Pagination), by affected product, 32 px apart. "Sentinel has no version
// data for this CVE." without entries, since Sentinel does not tell a scope
// that its source emptied from one that it never observed (same section,
// Empty and absent scopes); "No entries match the search." with Clear
// filters when none holds the term.
function Versions({ cveId, search, searched, onClear }: VersionsProps) {
  const read = useGetCveAffectedVersions(cveId);
  const place = dataPlace(read);
  const groups = place.data?.data;
  const packages = useMemo(
    () => (groups === undefined ? undefined : packagesOf(groups)),
    [groups],
  );
  const shown = useMemo(
    () => (packages === undefined ? undefined : shownEntries(packages, search)),
    [packages, search],
  );
  const all =
    groups?.reduce((count, group) => count + group.entries.length, 0) ?? 0;
  const shownCount = [...(shown?.values() ?? [])].reduce(
    (count, entries) => count + entries.length,
    0,
  );
  const announcement =
    searched && shown !== undefined ? resultText(shownCount, all) : "";
  const shownPackages = packages?.filter((view) =>
    view.blocks.some((block) => (shown?.get(block.key)?.length ?? 0) > 0),
  );
  return (
    <div className="relative">
      <output className="sr-only">
        <span key={search ?? ""}>{announcement}</span>
      </output>
      {place.updating && <UpdatingBar />}
      <output className="block">{place.failure ?? place.warning}</output>
      {groups === undefined ||
      shown === undefined ||
      shownPackages === undefined ? (
        place.waiting && <Loading />
      ) : groups.length === 0 ? (
        <FocusHandOff key="empty">
          <p className="text-fg-muted">{NO_ENTRIES}</p>
        </FocusHandOff>
      ) : shownPackages.length === 0 ? (
        <FocusHandOff key="no-match">
          <EmptyState
            message={NO_MATCH}
            action={
              <Button onPress={onClear}>
                <X aria-hidden className="size-4" />
                Clear filters
              </Button>
            }
          />
        </FocusHandOff>
      ) : (
        <FocusHandOff key="packages">
          <ul className="flex flex-col gap-8">
            {shownPackages.map((view) => (
              <PackageGroup
                key={JSON.stringify(view.name)}
                view={view}
                shown={shown}
              />
            ))}
          </ul>
        </FocusHandOff>
      )}
    </div>
  );
}

// The tab, which takes the whole width (docs/design-system.md, Detail
// Screens): at the start of its toolbar, in fg-muted, what the entries are,
// which takes the room that the controls leave, at least 240 px or the
// whole row; then the search field and, while a search applies, Clear
// filters, each an item of the row, so that the row wraps one control at a
// time (docs/design-system.md, Lists); the products 16 px below. The toolbar
// shows at once with the tabs, and goes once the Ticket shows without a CVE,
// handing the focus to the screen's heading; the entries wait for the
// Ticket, which names the CVE, and a Ticket without a CVE says so. The tab
// filters the entries itself, since Get CVE Affected Versions takes no
// parameter (Sentinel docs/features/tickets/cve-tracking.md, Get CVE
// Affected Versions, Filtering and sorting). A search announces what the tab
// shows; the tab as it opens does not (docs/behaviors.md, Accessibility,
// Focus after a navigation).
function TicketAffectedVersions() {
  const { ticketId } = ticketAffectedVersionsRoute.useParams();
  const search = ticketAffectedVersionsRoute.useSearch();
  const navigate = useNavigate();
  const ticket = useGetTicket(ticketId, { query: { enabled: false } }).data
    ?.data;
  const key = stringifySearch(search);
  const [openedAt] = useState(key);
  const [searched, setSearched] = useState(false);
  if (!searched && key !== openedAt) {
    setSearched(true);
  }
  const refine = (term: string) => {
    void navigate({
      to: "/tickets/$ticketId/affected-versions",
      params: { ticketId },
      search: { search: term === "" ? undefined : term },
    });
  };
  const clear = () => {
    refine("");
  };
  // Until the Ticket shows without a CVE.
  const toolbar = ticket?.cve !== null;
  return (
    <>
      {toolbar && (
        <FocusHandOff>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <p className="me-auto max-w-180 min-w-0 grow basis-60 pe-2 text-14 text-fg-muted">
              The versions of the affected software as the CVE record and other
              databases report them.
            </p>
            <SearchField
              placeholder="Search entries"
              applied={search.search ?? ""}
              maxLength={SEARCH_MAX_LENGTH}
              onApply={refine}
            />
            {search.search !== undefined && (
              <FocusHandOff>
                <Button variant="quiet" size="small" onPress={clear}>
                  <X aria-hidden className="size-4" />
                  Clear filters
                </Button>
              </FocusHandOff>
            )}
          </div>
        </FocusHandOff>
      )}
      <div className={toolbar ? "mt-4" : ""}>
        {ticket === undefined ? (
          <Loading />
        ) : ticket.cve === null ? (
          <p className="text-fg-muted">{NO_CVE}</p>
        ) : (
          <Versions
            cveId={ticket.cve.cve_id}
            search={search.search}
            searched={searched}
            onClear={clear}
          />
        )}
      </div>
    </>
  );
}

const affectedVersionsSearch = z.object({ search: searchTermParam });

// The tab Affected versions, at its path under the path of the Ticket. A URL
// with a search parameter that it does not accept, or with a value that it
// does not accept or gives in another form, leads to the URL that it gives
// that state, in place of the URL in the browser history (docs/behaviors.md,
// Invalid Search Parameters; docs/screen-map.md, Browser History).
export const ticketAffectedVersionsRoute = createRoute({
  getParentRoute: () => ticketRoute,
  path: "affected-versions",
  validateSearch: affectedVersionsSearch,
  beforeLoad: ({ location, params }) => {
    // The router's search of the route also passes on every parameter of the
    // URL that the schema does not declare, so the schema reads the URL
    // itself.
    const accepted = affectedVersionsSearch.parse(location.search);
    if (!sameSearch(location.search, accepted)) {
      throw redirect({
        to: "/tickets/$ticketId/affected-versions",
        params,
        search: accepted,
        hash: location.hash,
        replace: true,
      });
    }
  },
  component: TicketAffectedVersions,
});
