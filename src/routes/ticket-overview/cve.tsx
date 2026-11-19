import { useGetCna } from "../../api/generated/cnas";
import type {
  CNASummary,
  CVEDetail,
  CVEEPSSResponse,
  CVESSVCResponse,
  SSVCAutomatable,
  SSVCExploitation,
  SSVCTechnicalImpact,
} from "../../api/generated/model";
import { AbsentValue } from "../../components/absent-value";
import { ClampedText } from "../../components/clamped-text";
import { CalendarDate } from "../../components/date-time";
import {
  DescriptionItem,
  DescriptionList,
} from "../../components/description-list";
import { Part } from "../../components/detail-screen";
import { DetailsName } from "../../components/details-popover";
import { Label, LabelList } from "../../components/label";
import { Loading } from "../../components/loading";
import { WebLink } from "../../components/web-link";
import { CVE_ANCHOR, InlineField, MaybeDateTime } from "./shared";

// The CVE of the Ticket, the first part of the main column of Overview
// (src/routes/ticket-overview.tsx), with its CNA and its exploitation.

// The public CVE page of SUSE, a composed address of another site, with its
// fixed origin, which holds the CVE ID encoded in a path segment
// (docs/behaviors.md, Links to Other Sites, Composed addresses).
function suseCvePage(cveId: string): string {
  return `https://www.suse.com/security/cve/${encodeURIComponent(cveId)}.html`;
}

// The values of the SSVC decision points that the pinned contract lists, as
// CISA SSVC names them; a value that it does not list shows as received
// (docs/behaviors.md, Unknown Values). Maps, so that such a value is looked up
// only among them, never among the members of an object's prototype
// (docs/conventions.md, Data Read from the API).
const SSVC_EXPLOITATION = new Map<string, string>(
  Object.entries({
    none: "None",
    poc: "PoC",
    active: "Active",
  } satisfies Record<SSVCExploitation, string>),
);
const SSVC_AUTOMATABLE = new Map<string, string>(
  Object.entries({ no: "No", yes: "Yes" } satisfies Record<
    SSVCAutomatable,
    string
  >),
);
const SSVC_TECHNICAL_IMPACT = new Map<string, string>(
  Object.entries({
    partial: "Partial",
    total: "Total",
  } satisfies Record<SSVCTechnicalImpact, string>),
);

// An EPSS probability or percentile, from 0 to 1, cut to the five decimals
// that FIRST publishes, and with at least two, such as 0.94 or 0.00043, so
// that it never shows more than its value. Its text with ten decimals leaves
// out the error of its binary representation.
export function epssNumber(value: number): string {
  const text = value.toFixed(10);
  const point = text.indexOf(".");
  const cut = text.slice(0, point + 6).replace(/0+$/, "");
  const decimals = cut.length - point - 1;
  return decimals < 2 ? `${cut}${"0".repeat(2 - decimals)}` : cut;
}

interface SsvcProps {
  ssvc: CVESSVCResponse;
}

function Ssvc({ ssvc }: SsvcProps) {
  return (
    <dl className="flex flex-col gap-0.5">
      <InlineField term="Exploitation">
        {SSVC_EXPLOITATION.get(ssvc.exploitation) ?? ssvc.exploitation}
      </InlineField>
      <InlineField term="Automatable">
        {SSVC_AUTOMATABLE.get(ssvc.automatable) ?? ssvc.automatable}
      </InlineField>
      <InlineField term="Technical impact">
        {SSVC_TECHNICAL_IMPACT.get(ssvc.technical_impact) ??
          ssvc.technical_impact}
      </InlineField>
      <InlineField term="Version">{ssvc.version}</InlineField>
      <InlineField term="Assessed">
        <MaybeDateTime value={ssvc.assessed_at} />
      </InlineField>
    </dl>
  );
}

interface EpssProps {
  epss: CVEEPSSResponse;
}

function Epss({ epss }: EpssProps) {
  return (
    <dl className="flex flex-col gap-0.5">
      <InlineField term="Score">{epssNumber(epss.score)}</InlineField>
      <InlineField term="Percentile">{epssNumber(epss.percentile)}</InlineField>
      <InlineField term="Assessed">
        <CalendarDate value={epss.assessed_at} />
      </InlineField>
    </dl>
  );
}

interface ExploitationProps {
  cve: CVEDetail;
}

// The exploitation of the CVE, a box on surface with a border line and an
// 8 px radius, in three columns apart by border lines, which stand one below
// the other where the part is narrower than 576 px: CISA KEV, "Not listed"
// or the date on which the entry was added, never that the CVE is in KEV now;
// SSVC, with its decision points, version, and date and time; and EPSS, with
// its score, percentile, and date. Without SSVC or EPSS data, an absent
// value.
function Exploitation({ cve }: ExploitationProps) {
  const column = "px-4 py-3";
  const term = "text-13 text-fg-muted";
  return (
    <dl className="grid divide-y divide-border rounded-lg border border-border bg-surface text-14 @min-[36rem]:grid-cols-3 @min-[36rem]:divide-x @min-[36rem]:divide-y-0">
      <div className={column}>
        <dt className={term}>CISA KEV</dt>
        <dd className="mt-1">
          {cve.kev === null ? (
            "Not listed"
          ) : (
            <dl>
              <InlineField term="Added">
                <CalendarDate value={cve.kev.date_added} />
              </InlineField>
            </dl>
          )}
        </dd>
      </div>
      <div className={column}>
        <dt className={term}>SSVC</dt>
        <dd className="mt-1">
          {cve.ssvc === null ? <AbsentValue /> : <Ssvc ssvc={cve.ssvc} />}
        </dd>
      </div>
      <div className={column}>
        <dt className={term}>EPSS</dt>
        <dd className="mt-1">
          {cve.epss === null ? <AbsentValue /> : <Epss epss={cve.epss} />}
        </dd>
      </div>
    </dl>
  );
}

// The read of the details of a CNA, Get CNA, which its popover sends each
// time it opens, so that they follow the CNA as Sentinel describes it then:
// the query goes when the popover closes, and the details are not read again
// while it is open (docs/screens/ticket.md, CVE; Sentinel
// docs/features/tickets/cna.md, Get CNA).
function useCna(orgId: string) {
  return useGetCna(orgId, {
    query: { gcTime: 0, refetchOnWindowFocus: false },
  });
}

interface CnaShortNameProps {
  orgId: string;
  name: string;
}

// The short name of a CNA below the title of its popover, once its details
// arrive, unless it is absent or is the name, as it is while the CNA list of
// the CVE Program has not given the CNA an organization name.
function CnaShortName({ orgId, name }: CnaShortNameProps) {
  const shortName = useCna(orgId).data?.data.short_name ?? null;
  return shortName === null || shortName === name ? null : shortName;
}

interface CnaDetailsProps {
  orgId: string;
}

// The details of a CNA in its popover, as a description list: its types, a
// list of labels as received, since Sentinel does not close their set;
// whether its new Tickets are ignored automatically; and its scope, plain
// text that can run to many lines, last, below its term, cut to four lines
// with Show more (Sentinel docs/features/tickets/cna.md, Response Schemas;
// Flag; Security). While they load, the loading indicator takes their place,
// and when their read fails, the line of the failure of a user card, which a
// status region announces, since the popover holds the focus
// (docs/design-system.md, Menus, Popovers, and Tooltips; docs/behaviors.md,
// Accessibility, Announcements).
function CnaDetails({ orgId }: CnaDetailsProps) {
  const read = useCna(orgId);
  const cna = read.data?.data;
  return (
    <>
      <output className="block">
        {cna === undefined && read.status === "error" && (
          <span className="text-fg-muted">Other details aren't available.</span>
        )}
      </output>
      {cna === undefined ? (
        read.status === "pending" && <Loading inValue />
      ) : (
        <DescriptionList>
          <DescriptionItem term="Types">
            {cna.types.length === 0 ? (
              <AbsentValue />
            ) : (
              <LabelList labels={cna.types} />
            )}
          </DescriptionItem>
          <DescriptionItem term="Auto-ignore">
            {cna.auto_ignore
              ? "Yes, new Tickets are ignored automatically"
              : "No"}
          </DescriptionItem>
          <DescriptionItem term="Scope" stacked>
            {cna.scope === null ? (
              <AbsentValue />
            ) : (
              <ClampedText>{cna.scope}</ClampedText>
            )}
          </DescriptionItem>
        </DescriptionList>
      )}
    </>
  );
}

interface CnaProps {
  cna: CNASummary | null;
}

// The CNA that owns the record of the CVE, by its name, which opens its
// details, with its short name below the title of the popover; never by an
// identifier. A CNA without a name, which Sentinel knows only by its
// identifier, shows "Unnamed CNA" without a popover, and a CVE without a CNA
// an absent value (Sentinel docs/features/tickets/cna.md, Display Name).
function Cna({ cna }: CnaProps) {
  if (cna === null) {
    return <AbsentValue />;
  }
  if (cna.name === null) {
    return <AbsentValue name="Unnamed CNA" />;
  }
  return (
    <DetailsName
      name={cna.name}
      identifier={<CnaShortName orgId={cna.org_id} name={cna.name} />}
    >
      <CnaDetails orgId={cna.org_id} />
    </DetailsName>
  );
}

interface FactsProps {
  cve: CVEDetail;
}

// The dates and the identifiers of the CVE, on one line that wraps: when it
// was published and last modified, and when it was rejected, each with its
// time (docs/behaviors.md, Dates and Times, Display); its CNA; its
// weaknesses; and its external identifiers, such as a GHSA identifier, as
// links to other sites.
function Facts({ cve }: FactsProps) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-14">
      <InlineField term="Published">
        <MaybeDateTime value={cve.published_date} />
      </InlineField>
      <InlineField term="Modified">
        <MaybeDateTime value={cve.modified_date} />
      </InlineField>
      {cve.cve_state === "rejected" && (
        <InlineField term="Rejected">
          <MaybeDateTime value={cve.date_rejected} />
        </InlineField>
      )}
      <InlineField term="CNA">
        <Cna cna={cve.cna} />
      </InlineField>
      <InlineField term="CWE">
        {cve.cwes.length === 0 ? (
          <AbsentValue />
        ) : (
          cve.cwes.map((weakness) => weakness.cwe_id).join(", ")
        )}
      </InlineField>
      {cve.external_identifiers.length > 0 && (
        <InlineField term="External identifiers">
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {cve.external_identifiers.map((external) => (
              <li key={`${external.source}-${external.identifier}`}>
                <WebLink address={external.url}>{external.identifier}</WebLink>
              </li>
            ))}
          </ul>
        </InlineField>
      )}
    </dl>
  );
}

interface CvePartProps {
  cve: CVEDetail | null;
}

// The CVE of the Ticket, from Get Ticket, in its compact form: its CVE ID as
// the heading of the part, with the label Rejected while the CVE is rejected,
// or its state as received when the pinned contract does not list it, and
// next to it a link to the public CVE page of SUSE; its title and its
// description, which break a word longer than their place, the description
// cut to four lines with Show more; its dates and identifiers;
// and its exploitation. A Ticket without a CVE shows "No CVE." in its place.
export function CvePart({ cve }: CvePartProps) {
  if (cve === null) {
    return (
      <Part id={CVE_ANCHOR} heading="CVE">
        <p className="text-fg-muted">No CVE.</p>
      </Part>
    );
  }
  let state: string | undefined;
  if (cve.cve_state === "rejected") {
    state = "Rejected";
  } else if (cve.cve_state !== "published") {
    state = cve.cve_state;
  }
  return (
    <Part
      id={CVE_ANCHOR}
      heading={
        // The label follows the CVE ID after a space, which assistive
        // technologies read between them, and 2 px more, 6 px in all.
        <>
          {cve.cve_id}
          {state !== undefined && (
            <>
              {" "}
              <span className="ms-0.5 align-[0.0625rem]">
                <Label>{state}</Label>
              </span>
            </>
          )}
        </>
      }
      besideHeading={
        <span className="text-14">
          <WebLink address={suseCvePage(cve.cve_id)}>SUSE CVE page</WebLink>
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          {cve.title !== null && (
            <p className="max-w-180 wrap-break-word">{cve.title}</p>
          )}
          {cve.description === null ? (
            <p className="text-fg-muted">No description.</p>
          ) : (
            <ClampedText>{cve.description}</ClampedText>
          )}
        </div>
        <Facts cve={cve} />
        <Exploitation cve={cve} />
      </div>
    </Part>
  );
}
