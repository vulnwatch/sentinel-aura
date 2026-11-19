import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Form } from "react-aria-components";
import {
  cvssVectorError,
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentChangeFailure,
  presentFailure,
  validationErrorFields,
} from "../../api/errors";
import {
  getGetCveCvssAssessmentsQueryOptions,
  useDeleteSuseCvssAssessment,
  useUpsertSuseCvssAssessment,
} from "../../api/generated/cves";
import { useGetCvssBaseScore } from "../../api/generated/cvss";
import {
  CVSS3Scope,
  CVSS3UserInteraction,
  CVSS4AttackRequirements,
  CVSS4UserInteraction,
  CVSSAttackComplexity,
  CVSSAttackVector,
  CVSSImpact,
  CVSSPrivilegesRequired,
  TicketStatusValue,
} from "../../api/generated/model";
import type {
  CVECVSSAssessments,
  CVSSAssessmentItem,
  CVSSAssessmentResponse,
} from "../../api/generated/model";
import { ApiError } from "../../api/request";
import { Button } from "../../components/button";
import { useChangeOutcome } from "../../components/change-outcome";
import { DialogTabs } from "../../components/dialog-tabs";
import { useDiscardQuestion } from "../../components/discard-question";
import { ErrorInPlace } from "../../components/error-in-place";
import { FOCUS_RING } from "../../components/focus-ring";
import { Loading, UpdatingBar } from "../../components/loading";
import { Message } from "../../components/message";
import {
  ConfirmationDialog,
  DialogErrorMessage,
  ModalDialog,
  type DialogError,
} from "../../components/modal-dialog";
import { SegmentedControl } from "../../components/segmented-control";
import { SelectField, type FieldOption } from "../../components/select-field";
import { Severity, severityName } from "../../components/severity";
import { TextField } from "../../components/text-field";
import { ticketRecord } from "../ticket";
import { cvssVersion, SCORE, Score, valueInWords } from "./shared";

// The dialogs of the SUSE assessment of the CVE, which the CVSS assessments
// open (src/routes/ticket-overview/cvss.tsx): Add and Edit, with its metrics
// and its Base score, and Delete.

// The versions of the SUSE assessment that the screen adds, edits, and
// deletes: those that can be the default CVSS version. Sentinel accepts a
// SUSE assessment of every version that it lists, and the screen shows one of
// another version read-only (docs/screens/ticket.md, Actions; Sentinel
// docs/features/tickets/cvss-scoring.md, Set or Update SUSE CVSS Assessment).
const EDITABLE_VERSIONS = ["3.1", "4.0"] as const;

type EditableVersion = (typeof EDITABLE_VERSIONS)[number];

export function isEditableVersion(version: string): version is EditableVersion {
  return EDITABLE_VERSIONS.some((item) => item === version);
}

// The provider of the SUSE assessment, as Sentinel stores it (Sentinel
// docs/features/tickets/cvss-scoring.md, Provider Identity and Authority).
const SUSE = "SUSE";

// The statuses of a Ticket in which Sentinel accepts a change of the SUSE
// assessment of its CVE: Ignored and Duplicated refuse it with 409
// TICKET_NOT_MUTABLE, and a status that the pinned contract does not list
// offers no action (Sentinel docs/features/tickets/ticket-mutations.md, CVSS
// Status Matrix; docs/behaviors.md, Unknown Values).
export const SUSE_CHANGEABLE_STATUSES = new Set<string>([
  TicketStatusValue.new,
  TicketStatusValue.analysis,
  TicketStatusValue.analyzed,
  TicketStatusValue.resolved,
]);

// Whether the screen edits and deletes an assessment: one of SUSE in a
// version that it changes.
export function isChangeable(assessment: CVSSAssessmentItem): boolean {
  return (
    assessment.provider_name === SUSE &&
    isEditableVersion(assessment.cvss_version)
  );
}

// The versions of which SUSE has no assessment, which Add SUSE assessment
// adds.
export function versionsToAdd(
  assessments: readonly CVSSAssessmentItem[],
): EditableVersion[] {
  return EDITABLE_VERSIONS.filter(
    (version) =>
      !assessments.some(
        (assessment) =>
          assessment.provider_name === SUSE &&
          assessment.cvss_version === version,
      ),
  );
}

// The longest vector that Set or Update SUSE CVSS Assessment accepts, in
// characters, as Sentinel counts them, by code point (Sentinel
// docs/features/tickets/cvss-scoring.md, Input Rules).
const VECTOR_MAX_LENGTH = 200;

// A value of a metric: its letter in the vector and its value in the API,
// whose words name it (Sentinel docs/features/tickets/cvss-scoring.md, CVSS
// v3.0 and v3.1 Base Metrics; CVSS v4.0 Base Metrics).
interface FormValue {
  letter: string;
  value: string;
}

// A metric of the form: its abbreviation in the vector, its field in
// metrics of the API, its name, and its values from the one that lowers the
// Base score to the one that raises it, in every version.
interface FormMetric {
  abbreviation: string;
  field: string;
  name: string;
  values: readonly FormValue[];
}

interface FormGroup {
  term: string;
  metrics: readonly FormMetric[];
}

// The form of a version: the prefix of its vectors and its metrics, in the
// groups of FIRST's specification of the version, by the names that the
// popover of a vector gives them.
interface VersionForm {
  prefix: string;
  groups: readonly FormGroup[];
}

const ATTACK_VECTOR: readonly FormValue[] = [
  { letter: "P", value: CVSSAttackVector.physical },
  { letter: "L", value: CVSSAttackVector.local },
  { letter: "A", value: CVSSAttackVector.adjacent },
  { letter: "N", value: CVSSAttackVector.network },
];

const ATTACK_COMPLEXITY: readonly FormValue[] = [
  { letter: "H", value: CVSSAttackComplexity.high },
  { letter: "L", value: CVSSAttackComplexity.low },
];

const PRIVILEGES_REQUIRED: readonly FormValue[] = [
  { letter: "H", value: CVSSPrivilegesRequired.high },
  { letter: "L", value: CVSSPrivilegesRequired.low },
  { letter: "N", value: CVSSPrivilegesRequired.none },
];

const NONE_LOW_HIGH: readonly FormValue[] = [
  { letter: "N", value: CVSSImpact.none },
  { letter: "L", value: CVSSImpact.low },
  { letter: "H", value: CVSSImpact.high },
];

const VERSION_FORMS: Readonly<Record<EditableVersion, VersionForm>> = {
  "3.1": {
    prefix: "CVSS:3.1/",
    groups: [
      {
        term: "Exploitability",
        metrics: [
          {
            abbreviation: "AV",
            field: "attack_vector",
            name: "Attack vector",
            values: ATTACK_VECTOR,
          },
          {
            abbreviation: "AC",
            field: "attack_complexity",
            name: "Attack complexity",
            values: ATTACK_COMPLEXITY,
          },
          {
            abbreviation: "PR",
            field: "privileges_required",
            name: "Privileges required",
            values: PRIVILEGES_REQUIRED,
          },
          {
            abbreviation: "UI",
            field: "user_interaction",
            name: "User interaction",
            values: [
              { letter: "R", value: CVSS3UserInteraction.required },
              { letter: "N", value: CVSS3UserInteraction.none },
            ],
          },
        ],
      },
      {
        term: "Scope",
        metrics: [
          {
            abbreviation: "S",
            field: "scope",
            name: "Scope",
            values: [
              { letter: "U", value: CVSS3Scope.unchanged },
              { letter: "C", value: CVSS3Scope.changed },
            ],
          },
        ],
      },
      {
        term: "Impact",
        metrics: [
          {
            abbreviation: "C",
            field: "confidentiality_impact",
            name: "Confidentiality",
            values: NONE_LOW_HIGH,
          },
          {
            abbreviation: "I",
            field: "integrity_impact",
            name: "Integrity",
            values: NONE_LOW_HIGH,
          },
          {
            abbreviation: "A",
            field: "availability_impact",
            name: "Availability",
            values: NONE_LOW_HIGH,
          },
        ],
      },
    ],
  },
  "4.0": {
    prefix: "CVSS:4.0/",
    groups: [
      {
        term: "Exploitability",
        metrics: [
          {
            abbreviation: "AV",
            field: "attack_vector",
            name: "Attack vector",
            values: ATTACK_VECTOR,
          },
          {
            abbreviation: "AC",
            field: "attack_complexity",
            name: "Attack complexity",
            values: ATTACK_COMPLEXITY,
          },
          {
            abbreviation: "AT",
            field: "attack_requirements",
            name: "Attack requirements",
            values: [
              { letter: "P", value: CVSS4AttackRequirements.present },
              { letter: "N", value: CVSS4AttackRequirements.none },
            ],
          },
          {
            abbreviation: "PR",
            field: "privileges_required",
            name: "Privileges required",
            values: PRIVILEGES_REQUIRED,
          },
          {
            abbreviation: "UI",
            field: "user_interaction",
            name: "User interaction",
            values: [
              { letter: "A", value: CVSS4UserInteraction.active },
              { letter: "P", value: CVSS4UserInteraction.passive },
              { letter: "N", value: CVSS4UserInteraction.none },
            ],
          },
        ],
      },
      {
        term: "Vulnerable system",
        metrics: [
          {
            abbreviation: "VC",
            field: "vulnerable_system_confidentiality",
            name: "Confidentiality",
            values: NONE_LOW_HIGH,
          },
          {
            abbreviation: "VI",
            field: "vulnerable_system_integrity",
            name: "Integrity",
            values: NONE_LOW_HIGH,
          },
          {
            abbreviation: "VA",
            field: "vulnerable_system_availability",
            name: "Availability",
            values: NONE_LOW_HIGH,
          },
        ],
      },
      {
        term: "Subsequent system",
        metrics: [
          {
            abbreviation: "SC",
            field: "subsequent_system_confidentiality",
            name: "Confidentiality",
            values: NONE_LOW_HIGH,
          },
          {
            abbreviation: "SI",
            field: "subsequent_system_integrity",
            name: "Integrity",
            values: NONE_LOW_HIGH,
          },
          {
            abbreviation: "SA",
            field: "subsequent_system_availability",
            name: "Availability",
            values: NONE_LOW_HIGH,
          },
        ],
      },
    ],
  },
};

function formMetrics(version: EditableVersion): FormMetric[] {
  return VERSION_FORMS[version].groups.flatMap((group) => group.metrics);
}

// The values that a vector chooses, by the abbreviation of their metric.
type Chosen = ReadonlyMap<string, string>;

// The metrics that a vector of the version chooses: each metric of the
// version followed by one of its letters, the last one where a metric
// repeats; nothing for a vector of another version.
function chosenOf(version: EditableVersion, vector: string): Chosen {
  const { prefix } = VERSION_FORMS[version];
  const text = vector.trim();
  const chosen = new Map<string, string>();
  if (!text.startsWith(prefix)) {
    return chosen;
  }
  const metrics = formMetrics(version);
  for (const token of text.slice(prefix.length).split("/")) {
    const [abbreviation, letter] = token.split(":");
    const metric = metrics.find((item) => item.abbreviation === abbreviation);
    if (
      metric !== undefined &&
      metric.values.some((item) => item.letter === letter) &&
      letter !== undefined
    ) {
      chosen.set(metric.abbreviation, letter);
    }
  }
  return chosen;
}

// The vector of the metrics chosen, in FIRST's order, or nothing without
// any: Sentinel checks it as it is (Sentinel
// docs/features/tickets/cvss-scoring.md, Input Rules).
function vectorOf(version: EditableVersion, chosen: Chosen): string {
  const tokens = formMetrics(version).flatMap((metric) => {
    const letter = chosen.get(metric.abbreviation);
    return letter === undefined ? [] : [`${metric.abbreviation}:${letter}`];
  });
  return tokens.length === 0
    ? ""
    : `${VERSION_FORMS[version].prefix}${tokens.join("/")}`;
}

// The value of a field of the metrics of an assessment, or undefined.
function metricValue(
  assessment: CVSSAssessmentItem,
  field: string,
): string | undefined {
  const value: unknown = Object.entries(assessment.metrics).find(
    ([name]) => name === field,
  )?.[1];
  return typeof value === "string" ? value : undefined;
}

// An assessment as an option of Start from: its provider, its score, and its
// severity with its mark, such as "NVD, 7.5 ● High", which the keyboard finds
// by its text (docs/design-system.md, Severity; Forms).
function assessmentOption(
  value: string,
  provider: string,
  assessment: CVSSAssessmentItem,
): FieldOption<string> {
  return {
    value,
    label: `${provider}, ${SCORE.format(assessment.score)} ${severityName(assessment.severity)}`,
    content: (
      <span className="inline-flex items-baseline gap-1">
        {`${provider},`} <Score value={assessment.score} />{" "}
        <Severity severity={assessment.severity} />
      </span>
    ),
  };
}

// The length of a text as Sentinel counts it, by code point.
function codePoints(value: string): number {
  // oxlint-disable-next-line typescript/no-misused-spread -- the code points are what Sentinel counts, as Python's len does
  return [...value].length;
}

interface MetricColumnProps {
  version: EditableVersion;
  groups: readonly FormGroup[];
  chosen: Chosen;
  // The assessments of the other providers of the version.
  others: readonly CVSSAssessmentItem[];
  onChoose: (abbreviation: string, letter: string) => void;
}

// A column of the metrics: each group its heading, then each metric its
// name on the line of its values, a segmented control, the names in a
// column of 140 px, or above their values where the form is narrower than
// 320 px, and, below a metric whose choice differs from that of
// another provider's assessment, that provider's value, such as "NVD:
// Network", which assistive technologies read with the control. A metric
// whose name repeats in the version, such as Confidentiality in v4.0, is
// named with the term of its group too.
function MetricColumn({
  version,
  groups,
  chosen,
  others,
  onChoose,
}: MetricColumnProps) {
  const id = useId();
  const names = formMetrics(version).map((metric) => metric.name);
  return (
    <div className="grid grid-cols-1 content-start items-center gap-x-3 gap-y-2 @min-[20rem]:grid-cols-[8.75rem_auto]">
      {groups.map((group, index) => {
        const groupId = `${id}-group-${index}`;
        return (
          <Fragment key={group.term}>
            <h3
              id={groupId}
              className={`col-span-full text-14 font-semibold ${index > 0 ? "mt-3" : ""}`}
            >
              {group.term}
            </h3>
            {group.metrics.map((metric) => {
              const nameId = `${id}-${metric.abbreviation}`;
              const differsId = `${nameId}-differs`;
              const letter = chosen.get(metric.abbreviation);
              const differs =
                letter === undefined
                  ? []
                  : others.flatMap((other) => {
                      const theirs = metric.values.find(
                        (item) =>
                          item.value === metricValue(other, metric.field),
                      );
                      return theirs === undefined || theirs.letter === letter
                        ? []
                        : [
                            `${other.provider_name}: ${valueInWords(theirs.value)}`,
                          ];
                    });
              const repeated =
                names.filter((name) => name === metric.name).length > 1;
              return (
                <Fragment key={metric.abbreviation}>
                  <span id={nameId} className="text-14">
                    {metric.name}
                  </span>
                  <SegmentedControl
                    labelledBy={repeated ? `${nameId} ${groupId}` : nameId}
                    describedBy={differs.length > 0 ? differsId : undefined}
                    options={metric.values.map((item) => ({
                      value: item.letter,
                      label: valueInWords(item.value),
                    }))}
                    value={letter}
                    onChange={(next) => {
                      onChoose(metric.abbreviation, next);
                    }}
                  />
                  {differs.length > 0 && (
                    // It wraps within its column, which it does not widen.
                    <span
                      id={differsId}
                      className="-mt-1 w-0 min-w-full text-13 text-fg-muted @min-[20rem]:col-start-2"
                    >
                      {differs.join(" · ")}
                    </span>
                  )}
                </Fragment>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

// How long the dialog waits once the vector stops changing before it reads
// its score, so that it does not read it at each key.
export const SCORE_DELAY_MS = 250;

// A vector of the form of a version.
interface VersionVector {
  version: EditableVersion;
  vector: string;
}

// The vector once it has stopped changing for SCORE_DELAY_MS; the tab of
// another version shows its own vector at once.
function usePausedVector(version: EditableVersion, vector: string): string {
  const [paused, setPaused] = useState<VersionVector>({ version, vector });
  if (paused.version !== version) {
    setPaused({ version, vector });
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      setPaused({ version, vector });
    }, SCORE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [version, vector]);
  return paused.version === version ? paused.vector : vector;
}

// Whether a read of a score failed with a 422, CVSS_INVALID_VECTOR or
// VALIDATION_ERROR, which depends on the vector alone.
function rejectsVector(error: unknown): boolean {
  return error instanceof ApiError && error.status === 422;
}

// The read of the score of a vector, sent when enabled. Its result depends
// only on the vector (Sentinel docs/features/tickets/cvss-scoring.md,
// Calculate CVSS Base Score), so the score of a vector is read once, and so
// is a vector that Sentinel rejects; Try again reads it again.
function useBaseScore(vector: string, enabled: boolean) {
  return useGetCvssBaseScore(
    { vector_string: vector },
    {
      query: {
        enabled: (query) => enabled && !rejectsVector(query.state.error),
        staleTime: Infinity,
      },
    },
  );
}

type BaseScoreRead = ReturnType<typeof useBaseScore>;

// What the place of the score shows for a vector: why it has no score,
// without a read; its score as Sentinel's read returns it; that Sentinel
// rejects it; the failure of the read; or nothing yet.
type ScoreOutcome =
  | { kind: "none"; reason: string }
  | { kind: "score"; score: number; severity: string }
  | { kind: "rejected" }
  | { kind: "failed"; read: BaseScoreRead }
  | { kind: "waiting" };

function scoreOutcome(
  reason: string | null,
  read: BaseScoreRead,
  version: EditableVersion,
): ScoreOutcome {
  if (reason !== null) {
    return { kind: "none", reason };
  }
  if (read.status === "success") {
    return {
      kind: "score",
      score: read.data.data.score,
      severity: read.data.data.severity,
    };
  }
  if (read.status === "error") {
    return isRequestFailure(read.error) &&
      cvssVectorError(read.error, version) !== undefined
      ? { kind: "rejected" }
      : { kind: "failed", read };
  }
  return { kind: "waiting" };
}

// What a vector that Sentinel rejects says in the place of its score.
const REJECTED_TEXT = "Sentinel doesn't accept this vector.";

interface ScorePlaceProps {
  outcome: ScoreOutcome;
  // Whether the score of the vector is being read, while the outcome of the
  // vector before it shows, or nothing yet.
  updating: boolean;
}

// The Base score of the vector of the form, beside Start from, at the end of
// the second column, or after Start from in one column: the score in
// text-40, as the calculator of FIRST shows it, and below it the severity
// with its mark in text-20, both at weight 600, without a label. A vector
// that Sentinel does not score shows 0.0 and None in fg-muted, which
// assistive technologies read as the reason, such as "No score. Choose every
// metric."; the failure of the read shows in its place, with Try again. A
// status region, so that each outcome is announced without moving the
// focus, once the vector has paused; what shows while the next outcome is
// read is marked as being updated (docs/behaviors.md, Loading). It does not
// widen its column.
function ScorePlace({ outcome, updating }: ScorePlaceProps) {
  let content: ReactNode = null;
  if (outcome.kind === "score") {
    content = (
      <>
        <span
          aria-hidden
          className="text-40 font-semibold tabular-nums text-fg"
        >
          {SCORE.format(outcome.score)}
        </span>
        <span aria-hidden className="text-20 font-semibold">
          <Severity severity={outcome.severity} />
        </span>
        <span className="sr-only">{`Base score ${SCORE.format(outcome.score)}, ${severityName(outcome.severity)}`}</span>
      </>
    );
  } else if (outcome.kind === "none" || outcome.kind === "rejected") {
    content = (
      <>
        <span
          aria-hidden
          className="text-40 font-semibold tabular-nums text-fg-muted"
        >
          {SCORE.format(0)}
        </span>
        <span aria-hidden className="text-20 font-semibold">
          <Severity severity="none" muted />
        </span>
        <span className="sr-only">{`No score. ${outcome.kind === "none" ? outcome.reason : REJECTED_TEXT}`}</span>
      </>
    );
  } else if (outcome.kind === "failed") {
    const { read } = outcome;
    content = (
      <ErrorInPlace
        error={read.error}
        placement="part"
        onRetry={() => {
          void read.refetch();
        }}
      />
    );
  }
  return (
    <div className="relative min-h-18 w-0 min-w-full">
      {updating && outcome.kind !== "waiting" && <UpdatingBar />}
      {updating && outcome.kind === "waiting" && <Loading inValue />}
      <output
        aria-label="Base score"
        className={
          outcome.kind === "failed"
            ? "block"
            : "flex flex-col items-start @min-[52rem]:items-end"
        }
      >
        {content}
      </output>
    </div>
  );
}

interface VectorScore {
  // The place of the score.
  place: ReactNode;
  // The error of a vector that Sentinel's read rejects, which its field
  // shows while it holds that vector, or undefined.
  rejection: string | undefined;
}

// The Base score of the vector of the form of a version, Calculate CVSS Base
// Score, GET /api/v1/cvss/base-score, which applies to a vector the rules of
// Set or Update SUSE CVSS Assessment and stores nothing (Sentinel
// docs/features/tickets/cvss-scoring.md, Calculate CVSS Base Score): read
// once the vector has paused, and only when the form would send it and it
// names every metric, otherwise reasonOf says why it has no score. While the
// score of a new vector is read, the outcome of the vector before it stays,
// and a read that a newer vector overtakes shows nothing.
function useVectorScore(
  version: EditableVersion,
  vector: string,
  reasonOf: (vector: string) => string | null,
): VectorScore {
  const current = vector.trim();
  const paused = usePausedVector(version, current);
  const reason = reasonOf(paused);
  const read = useBaseScore(paused, reason === null);
  const answered = reason !== null || read.status !== "pending";
  // Whether the outcome of the vector of the form is known: a vector that
  // changed since it paused overtakes its read.
  const known = answered && current === paused;
  // The vector whose outcome shows, which follows the paused vector once
  // its outcome is known.
  const [shown, setShown] = useState<VersionVector | null>(null);
  if (known && (shown?.version !== version || shown.vector !== paused)) {
    setShown({ version, vector: paused });
  }
  const previous = shown?.version === version ? shown.vector : null;
  // Its read, which the query client keeps, and which is not sent again.
  const previousRead = useBaseScore(previous ?? "", false);
  let outcome: ScoreOutcome = { kind: "waiting" };
  if (known) {
    outcome = scoreOutcome(reason, read, version);
  } else if (previous !== null) {
    outcome = scoreOutcome(reasonOf(previous), previousRead, version);
  }
  // A failure offers Try again for the vector of the form alone.
  if (outcome.kind === "failed" && !known) {
    outcome = { kind: "waiting" };
  }
  const rejection =
    known &&
    reason === null &&
    read.status === "error" &&
    isRequestFailure(read.error)
      ? cvssVectorError(read.error, version)
      : undefined;
  return {
    place: (
      <ScorePlace outcome={outcome} updating={!answered || read.isFetching} />
    ),
    rejection,
  };
}

// What the tooltip of the default CVSS version says (Sentinel
// docs/features/tickets/cvss-scoring.md, Eligibility Score Resolution).
const DEFAULT_VERSION_TEXT =
  "The default CVSS version: its SUSE assessment also sets the eligibility score of the Products.";

// What Start from offers in Edit for the assessment as Sentinel stores it.
const SAVED = "saved";

// An option of Start from, with the vector that it takes.
interface StartOption {
  option: FieldOption<string>;
  vector: string;
}

// What a submission that failed shows: the error of the vector, and the
// error at the top of the form.
interface VectorFailure {
  field: string | undefined;
  form: DialogError | undefined;
}

const NO_VECTOR_FAILURE: VectorFailure = { field: undefined, form: undefined };

// Add, or Edit of an assessment, as it was when Edit opened, which gives the
// form its input.
export type SuseDialogMode =
  | { kind: "add" }
  | {
      kind: "edit";
      assessment: CVSSAssessmentItem;
      version: EditableVersion;
    };

interface SuseAssessmentDialogProps {
  ticketId: string;
  cveId: string;
  mode: SuseDialogMode;
  // The assessments of the CVE as the read of the part shows them.
  assessments: CVECVSSAssessments;
  readAgain: () => void;
  onClose: () => void;
  // Tells that Sentinel confirmed the change, with its outcome and the
  // assessment as Sentinel returns it.
  onDone: (text: string, assessment: CVSSAssessmentItem) => void;
}

// The outcome of a change of the SUSE assessment, as Sentinel returns it.
function suseChangedText(
  kind: SuseDialogMode["kind"],
  { data }: CVSSAssessmentResponse,
): string {
  return `SUSE assessment ${cvssVersion(data.cvss_version)} ${kind === "add" ? "added" : "changed"}.`;
}

// Add SUSE assessment and Edit, Set or Update SUSE CVSS Assessment,
// POST /api/v1/cves/{cve_id}/cvss/suse, in a dialog with a form in two
// columns (docs/design-system.md, Dialogs; Forms). Add opens on tabs of the
// versions, the default one marked with star, on the default version when
// SUSE has no assessment of it, otherwise on the other; the tab of a version
// of which SUSE has one says so, and Add SUSE assessment is disabled there.
// Each tab keeps its input; after Add, the dialog stays open on another tab
// that holds input while SUSE lacks its version, and says what was added.
// Start from takes the vector of an assessment of another provider of the
// version, or in Edit the saved one, and shows the assessment whose vector
// the form holds, or nothing; each metric is
// a segmented control, whose choice writes the vector, and a vector typed in
// its field chooses them. Beside Start from, the score of the vector as
// Sentinel calculates it (useVectorScore); a vector that Sentinel's read
// rejects shows its error at the field at once, without moving the focus,
// and the form still sends it. The form checks the vector before sending it: it
// is required, at most 200 characters, and of the version of the tab; Add
// reads the assessments again first, so that it never replaces one that
// SUSE has (Sentinel docs/features/tickets/cvss-scoring.md, Set or Update
// SUSE CVSS Assessment: the vector selects the assessment). A vector that
// Sentinel refuses, 422 CVSS_INVALID_VECTOR, and a field error of a
// VALIDATION_ERROR show at the field, which takes the focus; every other
// failure at the top of the form, which takes it, as a warning when
// Sentinel did not confirm the change (docs/behaviors.md, Where Errors
// Appear). Edit without a change closes without a request. With input,
// Cancel, Escape, and every navigation of the UI, such as Back, ask "Discard
// changes?" first, and closing or reloading the page shows the browser's own
// prompt (docs/behaviors.md, Confirmation). While the change is in progress,
// the dialog cannot be closed, and its input counts as submitted, that of
// every tab included: a navigation asks nothing, and the outcome shows on the
// screen that the user is on (useChangeOutcome).
export function SuseAssessmentDialog({
  ticketId,
  cveId,
  mode,
  assessments: shown,
  readAgain,
  onClose,
  onDone,
}: SuseAssessmentDialogProps) {
  const client = useQueryClient();
  const upsert = useUpsertSuseCvssAssessment({
    mutation: useChangeOutcome(
      ticketRecord(ticketId),
      (response: CVSSAssessmentResponse) =>
        suseChangedText(mode.kind, response),
      readAgain,
    ),
  });
  const formId = useId();
  const assessments = shown.assessments;
  const toAdd = versionsToAdd(assessments);
  const defaultVersion = shown.default_cvss_version;
  const [version, setVersion] = useState<EditableVersion>(() => {
    if (mode.kind === "edit") {
      return mode.version;
    }
    return (
      toAdd.find((item) => item === defaultVersion) ??
      toAdd[0] ??
      EDITABLE_VERSIONS[0]
    );
  });
  const saved = mode.kind === "edit" ? mode.assessment.vector_string : "";
  // The vector of each version, as the user enters it.
  const [inputs, setInputs] = useState<
    Readonly<Record<EditableVersion, string>>
  >(() => ({
    "3.1": "",
    "4.0": "",
    ...(mode.kind === "edit" ? { [mode.version]: saved } : {}),
  }));
  // What Add added while the dialog stays open on another tab.
  const [added, setAdded] = useState<string>();
  const [busy, setBusy] = useState(false);
  // A new object for each failure, so that each shows again.
  const [failure, setFailure] = useState<VectorFailure>(NO_VECTOR_FAILURE);
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const vectorRef = useRef<HTMLInputElement>(null);
  // The dialog takes the focus at the first field of its form as it opens
  // (docs/behaviors.md, Accessibility, Dialogs), once: the form shows again
  // with each tab.
  const opened = useRef(false);
  const firstField = useCallback((element: HTMLDivElement | null) => {
    if (element !== null && !opened.current) {
      opened.current = true;
      element.querySelector<HTMLElement>("input, button")?.focus();
    }
  }, []);
  // The line of a tab that says that SUSE has the version takes the focus
  // as it shows in place of the form, when the read before Add finds it, or
  // when a read takes the form away while it holds the focus, which the
  // browser then leaves on the page or on the dialog (docs/behaviors.md,
  // Accessibility, Focus after an action).
  // A form that the user takes away by opening another tab leaves the focus
  // on that tab.
  const takenFound = useRef(false);
  const switched = useRef(false);
  const takenLine = useCallback((element: HTMLParagraphElement | null) => {
    if (element === null) {
      return;
    }
    const active = document.activeElement;
    const lost =
      active === null ||
      active === document.body ||
      active.getAttribute("role") === "dialog";
    if (takenFound.current || (lost && !switched.current)) {
      takenFound.current = false;
      element.focus();
    }
  }, []);
  // Once the tab that the user opened shows, a read that takes its form
  // away is no longer the user's switch.
  useEffect(() => {
    switched.current = false;
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- each version shown is the event that the effect follows
  }, [version]);
  // After a failure at the field alone, the field takes the focus; the error
  // of the form takes it itself (docs/behaviors.md, Accessibility,
  // Announcements).
  useEffect(() => {
    if (failure.field !== undefined && failure.form === undefined) {
      vectorRef.current?.focus();
    }
  }, [failure]);

  const entered = inputs[version];
  const { prefix } = VERSION_FORMS[version];
  const taken = mode.kind === "add" && !toAdd.includes(version);
  const others = assessments.filter(
    (assessment) =>
      assessment.provider_name !== SUSE && assessment.cvss_version === version,
  );
  const chosen = chosenOf(version, entered);
  const changed =
    mode.kind === "edit"
      ? entered !== saved
      : EDITABLE_VERSIONS.some((item) => inputs[item] !== "");
  // While the change is in progress, the input of every tab counts as
  // submitted.
  const { close, question } = useDiscardQuestion({
    held: changed && !busy,
    consequence:
      mode.kind === "add"
        ? "The SUSE assessment that you entered isn't added."
        : "Your changes to this SUSE assessment aren't saved.",
    onDiscard: onClose,
  });
  const change = (vector: string) => {
    setInputs((current) => ({ ...current, [version]: vector }));
    setFailure(NO_VECTOR_FAILURE);
  };

  // A choice of a metric writes the vector of the metrics chosen.
  const choose = (abbreviation: string, letter: string) => {
    change(vectorOf(version, new Map([...chosen, [abbreviation, letter]])));
  };

  const starts: StartOption[] = [
    ...(mode.kind === "edit"
      ? [
          {
            option: assessmentOption(SAVED, "SUSE, as saved", mode.assessment),
            vector: saved,
          },
        ]
      : []),
    ...others.map((other) => ({
      option: assessmentOption(other.id, other.provider_name, other),
      vector: other.vector_string,
    })),
  ];
  // Start from shows the assessment whose vector the form holds, so that
  // choosing an assessment always takes its vector.
  const start =
    starts.find((item) => item.vector === entered.trim())?.option.value ?? null;

  // The check of the vector before it is sent, or null.
  const check = (vector: string): string | null => {
    if (vector === "") {
      return "Choose the metrics, or enter the vector.";
    }
    if (codePoints(vector) > VECTOR_MAX_LENGTH) {
      return `Enter at most ${VECTOR_MAX_LENGTH} characters.`;
    }
    if (!vector.startsWith(prefix)) {
      const other = EDITABLE_VERSIONS.find(
        (item) =>
          item !== version && vector.startsWith(VERSION_FORMS[item].prefix),
      );
      return mode.kind === "add" &&
        other !== undefined &&
        !toAdd.includes(other)
        ? takenText(other)
        : `Enter a CVSS v${version} vector, which starts with ${prefix}.`;
    }
    return null;
  };

  // Why a vector has no score, or null: the check before it is sent, or a
  // metric that it does not choose.
  const scoreReason = (vector: string): string | null =>
    check(vector) ??
    (chosenOf(version, vector).size < formMetrics(version).length
      ? "Choose every metric."
      : null);
  const score = useVectorScore(version, entered, scoreReason);
  const vectorError = failure.field ?? score.rejection;
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }

  // A failure of the read of the assessments before Add, or of the change.
  const fail = (error: unknown, read: boolean) => {
    if (!isRequestFailure(error)) {
      setUiFailure({ error });
      return;
    }
    if (read) {
      const presentation = presentFailure(error, "part");
      setFailure({
        field: undefined,
        form:
          presentation === undefined
            ? undefined
            : {
                message: presentation.message,
                reference: presentation.reference,
                unconfirmed: false,
              },
      });
      return;
    }
    const atField = cvssVectorError(error, version);
    if (atField !== undefined) {
      setFailure({ field: atField, form: undefined });
      return;
    }
    const { fields, unmatched } = validationErrorFields(error, [
      "vector_string",
    ]);
    const presentation = unmatched ? presentChangeFailure(error) : undefined;
    setFailure({
      field: fields.length > 0 ? MESSAGE_INVALID_VALUE : undefined,
      form:
        presentation === undefined
          ? undefined
          : {
              message: presentation.message,
              reference: presentation.reference,
              unconfirmed: presentation.unconfirmed,
            },
    });
  };

  const submit = async () => {
    if (busy || taken) {
      return;
    }
    const vector = entered.trim();
    const problem = check(vector);
    if (problem !== null) {
      setFailure({ field: problem, form: undefined });
      return;
    }
    if (mode.kind === "edit" && vector === saved) {
      onClose();
      return;
    }
    setFailure(NO_VECTOR_FAILURE);
    setBusy(true);
    let lacking = toAdd;
    if (mode.kind === "add") {
      // Sentinel replaces the assessment of the version of the vector, so
      // Add reads them again: another user may have added it meanwhile.
      try {
        const current = await client.fetchQuery({
          ...getGetCveCvssAssessmentsQueryOptions(cveId),
          staleTime: 0,
        });
        lacking = versionsToAdd(current.data.assessments);
        if (!lacking.includes(version)) {
          takenFound.current = true;
          setBusy(false);
          return;
        }
      } catch (error) {
        fail(error, true);
        setBusy(false);
        return;
      }
    }
    try {
      const response = await upsert.mutateAsync({
        cveId,
        data: { vector_string: vector },
      });
      const text = suseChangedText(mode.kind, response);
      // After Add, the dialog stays open on another tab that holds input
      // while SUSE lacks its version, so that the user adds it too.
      const next =
        mode.kind === "add"
          ? EDITABLE_VERSIONS.find(
              (item) =>
                item !== version &&
                inputs[item].trim() !== "" &&
                lacking.includes(item),
            )
          : undefined;
      if (next === undefined) {
        onDone(text, response.data);
      } else {
        // The action keeps the focus, also when the form that held it, such
        // as after Enter in Vector, leaves with its tab (docs/behaviors.md,
        // Accessibility, Focus after an action).
        const action = document.querySelector<HTMLElement>(
          `button[form="${CSS.escape(formId)}"]`,
        );
        setInputs((current) => ({ ...current, [version]: "" }));
        setAdded(text);
        switched.current = true;
        setVersion(next);
        requestAnimationFrame(() => {
          action?.focus();
        });
      }
    } catch (error) {
      fail(error, false);
    }
    setBusy(false);
  };

  const form = taken ? (
    <p
      ref={takenLine}
      tabIndex={-1}
      className={`rounded text-fg-muted ${FOCUS_RING}`}
    >
      {`SUSE already has a CVSS v${version} assessment: Edit in its row of the table changes it.`}
    </p>
  ) : (
    <Form
      id={formId}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void submit();
      }}
      validationErrors={
        vectorError === undefined ? {} : { vector_string: vectorError }
      }
      className="flex flex-col gap-5"
    >
      {failure.form !== undefined && (
        <DialogErrorMessage error={failure.form} />
      )}
      {/* Two columns, each as wide as its widest line, where the dialog is
          wide enough, otherwise one. */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-y-5 @min-[52rem]:grid-cols-[max-content_max-content] @min-[52rem]:justify-between @min-[52rem]:gap-x-10">
          {starts.length > 0 ? (
            <div className="w-80 max-w-full">
              <SelectField
                label="Start from"
                name="start"
                optional
                options={starts.map((item) => item.option)}
                value={start}
                onChange={(value) => {
                  const from = starts.find(
                    (item) => item.option.value === value,
                  );
                  if (from !== undefined) {
                    change(from.vector);
                  }
                }}
              />
            </div>
          ) : (
            // Without Start from, the score keeps its place in the second
            // column.
            <div aria-hidden className="hidden @min-[52rem]:block" />
          )}
          {score.place}
          <MetricColumn
            version={version}
            groups={VERSION_FORMS[version].groups.slice(0, 1)}
            chosen={chosen}
            others={others}
            onChoose={choose}
          />
          <MetricColumn
            version={version}
            groups={VERSION_FORMS[version].groups.slice(1)}
            chosen={chosen}
            others={others}
            onChoose={choose}
          />
        </div>
      </div>
      <TextField
        label="Vector"
        name="vector_string"
        monospace
        autoComplete="off"
        description="The metrics write it, and a vector entered here chooses them."
        value={entered}
        onChange={change}
        inputRef={vectorRef}
      />
    </Form>
  );

  return (
    <ModalDialog
      isOpen
      onClose={close}
      width="two-columns"
      title={
        mode.kind === "add"
          ? "Add SUSE assessment"
          : `Edit SUSE assessment ${cvssVersion(mode.version)}`
      }
      closable={!busy}
      buttons={
        <>
          <Button size="large" isDisabled={busy} onPress={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            size="large"
            isBusy={busy}
            isDisabled={taken}
          >
            {mode.kind === "add" ? "Add SUSE assessment" : "Save"}
          </Button>
          {question}
        </>
      }
    >
      {mode.kind === "add" ? (
        <>
          {/* What Add added while the dialog stays open, in a status region
              that is there before it, so that it is announced. */}
          <output className="block">
            {added !== undefined && (
              <div className="mb-3">
                <Message tone="success">{added}</Message>
              </div>
            )}
          </output>
          <DialogTabs
            label="CVSS version"
            tabs={EDITABLE_VERSIONS.map((item) => ({
              id: item,
              label: `CVSS ${cvssVersion(item)}`,
              mark:
                item === defaultVersion
                  ? {
                      icon: Star,
                      name: "the default version",
                      text: DEFAULT_VERSION_TEXT,
                    }
                  : undefined,
            }))}
            selected={version}
            onSelect={(next) => {
              switched.current = true;
              setVersion(next);
              setFailure(NO_VECTOR_FAILURE);
            }}
          >
            <div ref={firstField} className="contents">
              {form}
            </div>
          </DialogTabs>
        </>
      ) : (
        <div ref={firstField} className="contents">
          {form}
        </div>
      )}
    </ModalDialog>
  );
}

// What a vector of a version of which SUSE has an assessment says in Add.
function takenText(version: EditableVersion): string {
  return `SUSE already has a CVSS v${version} assessment: edit it in its row.`;
}

// An assessment that Delete deletes, with its place in the table.
export interface Deleting {
  assessment: CVSSAssessmentItem;
  index: number;
}

interface DeleteSuseDialogProps {
  ticketId: string;
  cveId: string;
  deleting: Deleting;
  // The assessments of the CVE as the read of the part shows them, and the
  // status of the Ticket as the screen shows it.
  assessments: CVECVSSAssessments;
  status: string;
  readAgain: () => void;
  onClose: () => void;
  onDone: (text: string) => void;
}

// Delete, Delete SUSE CVSS Assessment,
// DELETE /api/v1/cves/{cve_id}/cvss/suse/{cvss_version}, which asks for
// confirmation, since it cannot be undone in the UI and Sentinel calculates
// the severity and the eligibility again (docs/behaviors.md, Confirmation):
// its question names the assessment, and its consequence says that, and,
// for the assessment of the default CVSS version, that the eligibility score
// is then the fallback 10.0 (Sentinel docs/features/tickets/cvss-scoring.md,
// Eligibility Score Resolution), and, for the last SUSE assessment of the
// CVE of an Analyzed or Resolved Ticket, that the Ticket returns to Analysis
// (Sentinel docs/features/tickets/tickets.md, Gate: Analysis → Analyzed).
// Its error shows at the top of the confirmation, which stays open.
export function DeleteSuseDialog({
  ticketId,
  cveId,
  deleting,
  assessments,
  status,
  readAgain,
  onClose,
  onDone,
}: DeleteSuseDialogProps) {
  const { assessment } = deleting;
  const name = `SUSE assessment ${cvssVersion(assessment.cvss_version)}`;
  const deleted = `${name} deleted.`;
  const remove = useDeleteSuseCvssAssessment({
    mutation: useChangeOutcome(
      ticketRecord(ticketId),
      () => deleted,
      readAgain,
    ),
  });
  const [error, setError] = useState<DialogError>();
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }
  const last =
    assessments.assessments.filter((item) => item.provider_name === SUSE)
      .length === 1;
  const returns =
    last &&
    (status === TicketStatusValue.analyzed ||
      status === TicketStatusValue.resolved);
  const fallback = assessment.cvss_version === assessments.default_cvss_version;
  const confirm = async () => {
    setError(undefined);
    try {
      await remove.mutateAsync({
        cveId,
        cvssVersion: assessment.cvss_version,
      });
      onDone(deleted);
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
    <ConfirmationDialog
      isOpen
      onCancel={onClose}
      title={`Delete ${name}?`}
      action="Delete SUSE assessment"
      onConfirm={() => {
        void confirm();
      }}
      isBusy={remove.isPending}
      error={error}
    >
      {`Sentinel calculates the severity of the CVE again from the other assessments, and the eligibility of the Products, which can change the priority and the deadlines of the Ticket.${fallback ? ` Without a SUSE CVSS ${cvssVersion(assessment.cvss_version)} assessment, the eligibility score of the Products is the fallback 10.0.` : ""}${returns ? " As the last SUSE assessment of the CVE, it also returns the Ticket to Analysis." : ""} This can't be undone.`}
    </ConfirmationDialog>
  );
}
