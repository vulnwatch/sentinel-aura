import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useGetCveCvssAssessments } from "../../api/generated/cves";
import {
  CVSS2AccessComplexity,
  CVSS2AccessVector,
  CVSS2Authentication,
  CVSS2Impact,
  CVSS3Scope,
  CVSS3UserInteraction,
  CVSS4AttackRequirements,
  CVSS4UserInteraction,
  CVSSAttackComplexity,
  CVSSAttackVector,
  CVSSImpact,
  CVSSPrivilegesRequired,
  EligibilitySource,
} from "../../api/generated/model";
import type {
  CVECVSSAssessments,
  CVSSAssessmentItem,
  TicketDetail,
} from "../../api/generated/model";
import { getListTicketEventsQueryKey } from "../../api/generated/ticket-audit-log";
import { getListTicketsQueryKey } from "../../api/generated/tickets";
import { AbsentValue } from "../../components/absent-value";
import { Button } from "../../components/button";
import {
  useMounted,
  useOutcomeAfterRead,
} from "../../components/change-outcome";
import { FramedTable, type TableColumn } from "../../components/data-table";
import { CvssVector } from "../../components/cvss-vector";
import {
  DescriptionGroup,
  DescriptionItem,
  DescriptionList,
  GroupedItem,
} from "../../components/description-list";
import { Part } from "../../components/detail-screen";
import { DetailsValue } from "../../components/details-popover";
import { IconButton } from "../../components/icon-button";
import { dataShown, PartRead } from "../../components/read-view";
import { FocusHandOff } from "../../components/screen-heading";
import { useRowFocusAfterRemoval } from "../../components/row-focus";
import { Severity } from "../../components/severity";
import { WebLink } from "../../components/web-link";
import { useSignedInUser } from "../../session-gate";
import { ticketRecord } from "../ticket";
import { OPERABLE_STATUSES } from "../ticket/shared";
import {
  CVSS_ANCHOR,
  CVSS_VERSIONS,
  cvssVersion,
  InlineField,
  SCORE,
  Score,
  useReadAgain,
  valueInWords,
} from "./shared";
import {
  DeleteSuseDialog,
  type Deleting,
  isChangeable,
  isEditableVersion,
  SuseAssessmentDialog,
  type SuseDialogMode,
  versionsToAdd,
} from "./suse-assessment";

// The CVSS assessments of the CVE of the Ticket, a part of the main column of
// Overview (src/routes/ticket-overview.tsx), with Edit and Delete on the rows
// of the SUSE assessment, whose dialogs are in
// src/routes/ticket-overview/suse-assessment.tsx.

// The sources of an eligibility score that the pinned contract lists.
const ELIGIBILITY_SOURCES = new Set<string>(Object.values(EligibilitySource));

interface ScoredSeverityProps {
  severity: string;
  score: number;
}

// A severity followed by the score that gives it in parentheses, such as
// "High (8.1)".
function ScoredSeverity({ severity, score }: ScoredSeverityProps) {
  return (
    <>
      <Severity severity={severity} /> (<Score value={score} />)
    </>
  );
}

interface BaseScoreProps {
  score: number;
  // The severity of the assessment, or null where it is left out.
  severity: string | null;
}

// The score of an assessment, then its severity, such as "7.8 High". The
// score ends a place as wide as "10.0", the widest score, so that the
// severities of the rows of a column align.
function BaseScore({ score, severity }: BaseScoreProps) {
  return (
    <span className="whitespace-nowrap">
      <span className="inline-block min-w-[4ch] text-end tabular-nums">
        {SCORE.format(score)}
      </span>
      {severity !== null && (
        <>
          {" "}
          <Severity severity={severity} />
        </>
      )}
    </span>
  );
}

// The read of the CVSS assessments of the CVE of the Ticket, sent only for a
// Ticket with a CVE (Sentinel docs/features/tickets/cvss-scoring.md, Get
// CVSS Assessments for a CVE).
export function useCvssAssessments(ticket: TicketDetail) {
  const cveId = ticket.cve?.cve_id;
  return useGetCveCvssAssessments(cveId ?? "", {
    query: { enabled: cveId !== undefined },
  });
}

type CvssRead = ReturnType<typeof useCvssAssessments>;

interface ResolutionProps {
  assessments: CVECVSSAssessments;
}

// What the assessments resolve, which Sentinel resolves apart (Sentinel
// docs/features/tickets/cvss-scoring.md, Core Distinctions): the severity of
// the CVE, with the assessment that gives it, and the eligibility score with
// which the Products are calculated. When the SUSE assessment of the default
// CVSS version gives both, which the source suse of the eligibility score
// states, one line says so; otherwise two lines, the second the eligibility
// score, which without that assessment is the fallback 10.0 (same document,
// Severity Resolution Cascade; Eligibility Score Resolution). A source that
// the pinned contract does not list shows as received after the score
// (docs/behaviors.md, Unknown Values).
function Resolution({ assessments }: ResolutionProps) {
  const { severity, eligibility } = assessments;
  if (severity !== null && eligibility.source === "suse") {
    return (
      <dl className="text-14">
        <InlineField term="Severity">
          <ScoredSeverity severity={severity.label} score={severity.score} />{" "}
          from {severity.provider} CVSS {cvssVersion(severity.version)}, which
          also sets the eligibility score of the Products
        </InlineField>
      </dl>
    );
  }
  return (
    <dl className="flex flex-col gap-1 text-14">
      <InlineField term="Severity">
        {severity === null ? (
          <AbsentValue />
        ) : (
          <>
            <ScoredSeverity severity={severity.label} score={severity.score} />{" "}
            from {severity.provider} CVSS {cvssVersion(severity.version)}
          </>
        )}
      </InlineField>
      <InlineField term="Eligibility score">
        <Score value={eligibility.score} />
        {eligibility.source === "fallback" &&
          `, the fallback without a SUSE CVSS ${cvssVersion(assessments.default_cvss_version)} assessment`}
        {!ELIGIBILITY_SOURCES.has(eligibility.source) &&
          `, ${eligibility.source}`}
      </InlineField>
    </dl>
  );
}

// A metric of a vector in words: the name that Sentinel gives the metric,
// without what the term of its group says, and its value.
interface Metric {
  name: string;
  value: string;
}

// A metric and its value, which shows in sentence case, such as
// adjacent_network as "Adjacent network", or as received when the pinned
// contract does not list it among the values of the metric
// (docs/behaviors.md, Domain Terms; Unknown Values).
function metricInWords(
  name: string,
  value: string,
  values: Readonly<Record<string, string>>,
): Metric {
  if (!new Set(Object.values(values)).has(value)) {
    return { name, value };
  }
  return { name, value: valueInWords(value) };
}

// A group of the metrics of a vector, by the term of the group.
interface MetricGroup {
  term: string;
  metrics: readonly Metric[];
}

// The metrics of an assessment, from metrics of the API, in the groups of
// FIRST's specification of its version, by Sentinel's names of the metrics
// (Sentinel docs/features/tickets/cvss-scoring.md, CVSS v2.0 Base Metrics;
// CVSS v3.0 and v3.1 Base Metrics; CVSS v4.0 Base Metrics). An assessment of
// a version that the pinned contract does not list has none.
function metricGroups(assessment: CVSSAssessmentItem): MetricGroup[] {
  switch (assessment.cvss_version) {
    case "2.0": {
      const metrics = assessment.metrics;
      return [
        {
          term: "Exploitability",
          metrics: [
            metricInWords(
              "Access vector",
              metrics.access_vector,
              CVSS2AccessVector,
            ),
            metricInWords(
              "Access complexity",
              metrics.access_complexity,
              CVSS2AccessComplexity,
            ),
            metricInWords(
              "Authentication",
              metrics.authentication,
              CVSS2Authentication,
            ),
          ],
        },
        {
          term: "Impact",
          metrics: [
            metricInWords(
              "Confidentiality",
              metrics.confidentiality_impact,
              CVSS2Impact,
            ),
            metricInWords("Integrity", metrics.integrity_impact, CVSS2Impact),
            metricInWords(
              "Availability",
              metrics.availability_impact,
              CVSS2Impact,
            ),
          ],
        },
      ];
    }
    case "3.0":
    case "3.1": {
      const metrics = assessment.metrics;
      return [
        {
          term: "Exploitability",
          metrics: [
            metricInWords(
              "Attack vector",
              metrics.attack_vector,
              CVSSAttackVector,
            ),
            metricInWords(
              "Attack complexity",
              metrics.attack_complexity,
              CVSSAttackComplexity,
            ),
            metricInWords(
              "Privileges required",
              metrics.privileges_required,
              CVSSPrivilegesRequired,
            ),
            metricInWords(
              "User interaction",
              metrics.user_interaction,
              CVSS3UserInteraction,
            ),
          ],
        },
        {
          term: "Scope",
          metrics: [metricInWords("Scope", metrics.scope, CVSS3Scope)],
        },
        {
          term: "Impact",
          metrics: [
            metricInWords(
              "Confidentiality",
              metrics.confidentiality_impact,
              CVSSImpact,
            ),
            metricInWords("Integrity", metrics.integrity_impact, CVSSImpact),
            metricInWords(
              "Availability",
              metrics.availability_impact,
              CVSSImpact,
            ),
          ],
        },
      ];
    }
    case "4.0": {
      const metrics = assessment.metrics;
      return [
        {
          term: "Exploitability",
          metrics: [
            metricInWords(
              "Attack vector",
              metrics.attack_vector,
              CVSSAttackVector,
            ),
            metricInWords(
              "Attack complexity",
              metrics.attack_complexity,
              CVSSAttackComplexity,
            ),
            metricInWords(
              "Attack requirements",
              metrics.attack_requirements,
              CVSS4AttackRequirements,
            ),
            metricInWords(
              "Privileges required",
              metrics.privileges_required,
              CVSSPrivilegesRequired,
            ),
            metricInWords(
              "User interaction",
              metrics.user_interaction,
              CVSS4UserInteraction,
            ),
          ],
        },
        {
          term: "Vulnerable system",
          metrics: [
            metricInWords(
              "Confidentiality",
              metrics.vulnerable_system_confidentiality,
              CVSSImpact,
            ),
            metricInWords(
              "Integrity",
              metrics.vulnerable_system_integrity,
              CVSSImpact,
            ),
            metricInWords(
              "Availability",
              metrics.vulnerable_system_availability,
              CVSSImpact,
            ),
          ],
        },
        {
          term: "Subsequent system",
          metrics: [
            metricInWords(
              "Confidentiality",
              metrics.subsequent_system_confidentiality,
              CVSSImpact,
            ),
            metricInWords(
              "Integrity",
              metrics.subsequent_system_integrity,
              CVSSImpact,
            ),
            metricInWords(
              "Availability",
              metrics.subsequent_system_availability,
              CVSSImpact,
            ),
          ],
        },
      ];
    }
    default:
      return [];
  }
}

// The paths of the calculators of FIRST, by the version that each
// calculates: FIRST has none for v2.0.
const CALCULATORS = new Map<string, string>([
  ["3.0", "3.0"],
  ["3.1", "3.1"],
  ["4.0", "4.0"],
]);

// The calculator of FIRST for the vector of an assessment, composed with the
// fixed origin https://www.first.org and the vector as its fragment, encoded
// as the URL parser encodes a fragment, which keeps its ":" and "/": the
// calculator reads the vector from the fragment as it is, without decoding it
// (docs/screens/ticket.md, CVSS assessments; docs/conventions.md, Links from
// the API). Undefined for a version without a calculator.
function firstCalculator(assessment: CVSSAssessmentItem): string | undefined {
  const path = CALCULATORS.get(assessment.cvss_version);
  if (path === undefined) {
    return undefined;
  }
  const address = new URL(`https://www.first.org/cvss/calculator/${path}`);
  address.hash = assessment.vector_string;
  return address.href;
}

interface VectorMetricsProps {
  assessment: CVSSAssessmentItem;
}

// The vector of an assessment as a value that opens a popover with its
// metrics (docs/design-system.md, Menus, Popovers, and Tooltips): its title
// the provider and the version, such as "NVD CVSS v3.1", the vector below it,
// its metrics by group, each group a term with its metrics below it, or a
// group of one metric on the line of its term, such as Scope, and, for a
// version with a calculator of FIRST, the link to it.
function VectorMetrics({ assessment }: VectorMetricsProps) {
  const calculator = firstCalculator(assessment);
  return (
    <DetailsValue
      value={<CvssVector value={assessment.vector_string} />}
      title={`${assessment.provider_name} CVSS ${cvssVersion(assessment.cvss_version)}`}
      link={
        calculator === undefined ? undefined : (
          <WebLink address={calculator}>Open in the FIRST calculator</WebLink>
        )
      }
    >
      <DescriptionList fittedTerms>
        {metricGroups(assessment).map(({ term, metrics }) => {
          const [only] = metrics;
          return metrics.length === 1 && only !== undefined ? (
            <DescriptionItem key={term} term={term}>
              {only.value}
            </DescriptionItem>
          ) : (
            <DescriptionGroup key={term} term={term}>
              {metrics.map(({ name, value }) => (
                <GroupedItem key={name} term={name}>
                  {value}
                </GroupedItem>
              ))}
            </DescriptionGroup>
          );
        })}
      </DescriptionList>
    </DetailsValue>
  );
}

// The columns of the table of the assessments: the provider and the version,
// which name the assessment; its Base score, then its severity by the scale
// of its version, which is not the resolved severity; and its vector, which
// opens its metrics. The texts wrap, as in a table whose records have no
// screen of their own (docs/design-system.md, Tables). Of an assessment of a
// version that the pinned contract does not list, the severity, whose scale
// depends on the version, is left out, and its score shows alone, and its
// vector shows as text, without its metrics (docs/behaviors.md, Unknown
// Values).
const ASSESSMENT_COLUMNS: readonly TableColumn<CVSSAssessmentItem>[] = [
  {
    id: "provider",
    name: "Provider",
    isRowHeader: true,
    wraps: true,
    // The provider carries the identifier of its assessment, by which the
    // part finds its row (CvssPart).
    render: (assessment) => (
      <span data-assessment-id={assessment.id}>{assessment.provider_name}</span>
    ),
  },
  {
    id: "version",
    name: "Version",
    isRowHeader: true,
    render: (assessment) => cvssVersion(assessment.cvss_version),
  },
  {
    id: "score",
    name: "Base score",
    render: (assessment) => (
      <BaseScore
        score={assessment.score}
        severity={
          CVSS_VERSIONS.has(assessment.cvss_version)
            ? assessment.severity
            : null
        }
      />
    ),
  },
  {
    id: "vector",
    name: "Vector",
    wraps: true,
    render: (assessment) =>
      CVSS_VERSIONS.has(assessment.cvss_version) ? (
        <VectorMetrics assessment={assessment} />
      ) : (
        <CvssVector value={assessment.vector_string} />
      ),
  },
];

interface CvssPartProps {
  read: CvssRead;
  ticket: TicketDetail;
}

// The attribute that the provider of each assessment carries with its
// identifier, by which the part finds its row.
const ASSESSMENT_ATTRIBUTE = "data-assessment-id";

function assessmentId(assessment: CVSSAssessmentItem): string {
  return assessment.id;
}

// The names of Edit and Delete, before the version of their assessment.
const EDIT_SUSE = "Edit SUSE assessment";
const DELETE_SUSE = "Delete SUSE assessment";

// The Delete of the row of an assessment, which takes the focus after Delete
// of the row before it, or null without one.
function deleteIn(row: HTMLElement): HTMLElement | null {
  return row.querySelector<HTMLElement>(`button[aria-label^="${DELETE_SUSE}"]`);
}

interface RowActions {
  edit: (assessment: CVSSAssessmentItem) => void;
  remove: (assessment: CVSSAssessmentItem) => void;
}

// The columns of the table, with Edit and Delete at the end of the row of a
// SUSE assessment that the screen changes, for a user who holds
// manage_cvss (docs/design-system.md, Tables).
function columnsOf(
  actions: RowActions | undefined,
): readonly TableColumn<CVSSAssessmentItem>[] {
  if (actions === undefined) {
    return ASSESSMENT_COLUMNS;
  }
  return [
    // Before the actions of a row, the vector keeps 14 px after it, which
    // with the padding of the cell leave the cell 24 px of its own beside its
    // button: React Aria's table makes the cell a tab stop once the button
    // has had the focus, and so a target of its own (WCAG 2.5.8, Target Size
    // (Minimum)).
    ...ASSESSMENT_COLUMNS.map((column) =>
      column.id === "vector"
        ? {
            ...column,
            render: (assessment: CVSSAssessmentItem) => (
              <div className="pe-3.5">{column.render(assessment)}</div>
            ),
          }
        : column,
    ),
    {
      id: "actions",
      name: "Actions",
      hidesName: true,
      // 14 px before the buttons, which with the padding of the cell leave it
      // 24 px of its own: once one of them has had the focus, React Aria's
      // table makes the cell its tab stop, and so a target of its own, which
      // needs that room beside them (WCAG 2.5.8, Target Size (Minimum)).
      render: (assessment) =>
        isChangeable(assessment) ? (
          <div className="flex justify-end gap-1 ps-3.5 text-fg-muted">
            <IconButton
              size="small"
              icon={Pencil}
              label={`${EDIT_SUSE} ${cvssVersion(assessment.cvss_version)}`}
              tooltip="Edit"
              onPress={() => {
                actions.edit(assessment);
              }}
            />
            <IconButton
              size="small"
              icon={Trash}
              label={`${DELETE_SUSE} ${cvssVersion(assessment.cvss_version)}`}
              tooltip="Delete"
              onPress={() => {
                actions.remove(assessment);
              }}
            />
          </div>
        ) : null,
    },
  ];
}

// Reads again what a change of the SUSE assessment affects, whatever its
// outcome: the reads of the tab, the Ticket among them, whose severity,
// priority, status, assignee, and package tree the change can change; its
// audit log; and the reads of the Ticket list, whose rows show those values
// (docs/behaviors.md, Outcome of a Change; Sentinel
// docs/features/tickets/cvss-scoring.md, Assessment Persistence and Ticket
// Status).
function useReadAfterSuseChange(ticketId: string, cveId: string) {
  const client = useQueryClient();
  const readAgain = useReadAgain(ticketId, cveId);
  return useCallback(() => {
    readAgain(false);
    void client.invalidateQueries({
      queryKey: getListTicketEventsQueryKey(ticketId),
    });
    // The reads of the Ticket list hold that of the duplicates of the Ticket,
    // which readAgain has just sent again: it is kept, not sent twice.
    void client.invalidateQueries(
      { queryKey: getListTicketsQueryKey() },
      { cancelRefetch: false },
    );
  }, [client, readAgain, ticketId]);
}

// The CVSS assessments of the CVE of the Ticket, from Get CVSS Assessments
// for a CVE: what they resolve, then the table of the assessments in the
// order of the API, by version, then by provider (Sentinel
// docs/features/tickets/cvss-scoring.md, Version Precedence), or "No CVSS
// assessments." without any. The part reads them on its own, and their
// loading and their errors show in its place (docs/behaviors.md, Loading;
// Where Errors Appear). For a user who holds manage_cvss, on a Ticket whose
// status lets Sentinel change its SUSE assessment, Add SUSE assessment at
// the end of the line of the heading, once the assessments have arrived,
// while SUSE lacks one of the versions that the screen changes, and Edit and
// Delete on the rows of the SUSE assessments of these versions
// (docs/screen-map.md, Roles, Principles). The outcome of a change is
// announced once a read of the assessments after it arrives, or shows in the
// message area when that read fails (useOutcomeAfterRead). After Delete,
// the focus moves to the Delete of the row that takes its place, or to that
// row without one, or to Add SUSE assessment when no row follows; when a
// read removes the row that holds it, to the screen's heading
// (docs/behaviors.md, Accessibility, Focus after an action).
export function CvssPart({ read, ticket }: CvssPartProps) {
  const user = useSignedInUser();
  const changes =
    user?.capabilities.includes("manage_cvss") === true &&
    OPERABLE_STATUSES.has(ticket.status);
  const ticketId = ticket.ticket_id;
  const cveId = ticket.cve?.cve_id ?? "";
  // The assessments of the open dialogs, which keep their input and show
  // their error at the top of their form after a 403 or a 404, and those
  // that the part shows, after which Add SUSE assessment follows them.
  const data = read.data?.data;
  const shownData = dataShown(read)?.data;
  const mounted = useMounted();
  const record = useMemo(() => ticketRecord(ticketId), [ticketId]);
  const outcome = useOutcomeAfterRead(read, record);
  const container = useRef<HTMLDivElement>(null);
  const add = useRef<HTMLDivElement>(null);
  const fallback = useCallback(() => add.current?.querySelector("button"), []);
  const rowFocus = useRowFocusAfterRemoval({
    container,
    rows: data?.assessments,
    rowId: assessmentId,
    attribute: ASSESSMENT_ATTRIBUTE,
    control: deleteIn,
    fallback,
    read,
  });
  const readAgain = useReadAfterSuseChange(ticketId, cveId);
  const [dialog, setDialog] = useState<SuseDialogMode>();
  const [deleting, setDeleting] = useState<Deleting>();
  const actions = useMemo<RowActions | undefined>(
    () =>
      changes && data !== undefined
        ? {
            edit: (assessment) => {
              if (isEditableVersion(assessment.cvss_version)) {
                setDialog({
                  kind: "edit",
                  assessment,
                  version: assessment.cvss_version,
                });
              }
            },
            remove: (assessment) => {
              setDeleting({
                assessment,
                index: data.assessments.findIndex(
                  (row) => row.id === assessment.id,
                ),
              });
            },
          }
        : undefined,
    [changes, data, setDialog, setDeleting],
  );
  const columns = useMemo(() => columnsOf(actions), [actions]);
  return (
    <Part
      id={CVSS_ANCHOR}
      heading="CVSS assessments"
      actions={
        changes &&
        shownData !== undefined &&
        versionsToAdd(shownData.assessments).length > 0 ? (
          <FocusHandOff>
            <div ref={add}>
              <Button
                size="small"
                icon={Plus}
                onPress={() => {
                  setDialog({ kind: "add" });
                }}
              >
                Add SUSE assessment
              </Button>
            </div>
          </FocusHandOff>
        ) : undefined
      }
    >
      <div ref={container}>
        <PartRead read={read}>
          {({ data: shown }) =>
            shown.assessments.length === 0 ? (
              <p className="text-fg-muted">No CVSS assessments.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <Resolution assessments={shown} />
                <FramedTable
                  label="CVSS assessments"
                  columns={columns}
                  rows={shown.assessments}
                  rowId={assessmentId}
                />
              </div>
            )
          }
        </PartRead>
      </div>
      {outcome.region}
      {dialog !== undefined && data !== undefined && (
        <SuseAssessmentDialog
          ticketId={ticketId}
          cveId={cveId}
          mode={dialog}
          assessments={data}
          readAgain={readAgain}
          onClose={() => {
            setDialog(undefined);
          }}
          onDone={(text, assessment) => {
            if (!mounted.current) {
              return;
            }
            setDialog(undefined);
            // The dialog returns the focus to the Edit that opened it as it
            // closes (docs/behaviors.md, Accessibility, Dialogs), so its row
            // holds the focus from now on, also before React Aria has
            // returned it. After Add, it returns it to Add SUSE assessment,
            // which the next read removes once SUSE has every version: the
            // new row then takes it, at its Delete.
            if (dialog.kind === "edit") {
              rowFocus.holds(dialog.assessment.id);
            } else {
              rowFocus.added(assessment.id);
            }
            outcome.after(text);
          }}
        />
      )}
      {deleting !== undefined && data !== undefined && (
        <DeleteSuseDialog
          ticketId={ticketId}
          cveId={cveId}
          deleting={deleting}
          assessments={data}
          status={ticket.status}
          readAgain={readAgain}
          onClose={() => {
            setDeleting(undefined);
          }}
          onDone={(text) => {
            if (!mounted.current) {
              return;
            }
            rowFocus.deleted(deleting.assessment.id, deleting.index);
            setDeleting(undefined);
            outcome.after(text);
          }}
        />
      )}
    </Part>
  );
}
