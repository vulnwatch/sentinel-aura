import type {
  CVSSAssessmentSeverity,
  SeverityValue,
} from "../api/generated/model";
import { AbsentValue } from "./absent-value";

interface KnownSeverity {
  name: string;
  // The class of the color of its mark (docs/design-system.md, Severity
  // Marks).
  mark: string;
}

// The severities that the pinned contract lists, by their value. A Map, so
// that a value that a later Sentinel release returns is looked up only among
// them, never among the members of an object's prototype (docs/conventions.md,
// Data Read from the API).
const SEVERITIES = new Map<string, KnownSeverity>(
  Object.entries({
    critical: { name: "Critical", mark: "fill-mark-critical" },
    high: { name: "High", mark: "fill-mark-high" },
    medium: { name: "Medium", mark: "fill-mark-medium" },
    low: { name: "Low", mark: "fill-mark-low" },
    none: { name: "None", mark: "fill-mark-none" },
  } satisfies Record<SeverityValue | CVSSAssessmentSeverity, KnownSeverity>),
);

interface SeverityProps {
  // The resolved severity of a Ticket or a CVE: a value of SeverityValue,
  // another value that a later Sentinel release returns, or null when no
  // assessment resolves it (Sentinel docs/features/tickets/tickets.md,
  // Severity Resolution; Sentinel docs/features/tickets/cvss-scoring.md,
  // Unified CVE Severity). Or the severity of one CVSS assessment, a value of
  // CVSSAssessmentSeverity, which has the same values and shows in the same
  // way (same document, Version-Specific Assessment Severity).
  severity: string | null;
  // The word that the screen document gives a severity of null, such as in
  // a heading row, where no column header names it; an en dash otherwise
  // (docs/behaviors.md, Absent Values).
  absentName?: string;
}

// A severity (docs/design-system.md, Severity): a dot of 8 px in its mark,
// then, 6 px later, its name in fg, on the baseline of the text around it,
// with the dot centered on the line. The dot is hidden from assistive
// technologies, which read the name. null is an absent value, and a value
// that the pinned contract does not list shows as received after a hollow
// dot in neutral-icon (docs/behaviors.md, Unknown Values).
export function Severity({ severity, absentName }: SeverityProps) {
  if (severity === null) {
    return <AbsentValue name={absentName} />;
  }
  const known = SEVERITIES.get(severity);
  return (
    <span className="inline-flex items-baseline gap-1.5 text-fg">
      <svg
        aria-hidden
        viewBox="0 0 8 8"
        className="size-2 shrink-0 self-center"
      >
        {known === undefined ? (
          <circle
            cx={4}
            cy={4}
            r={3.5}
            strokeWidth={1}
            className="fill-none stroke-neutral-icon"
          />
        ) : (
          <circle cx={4} cy={4} r={4} className={known.mark} />
        )}
      </svg>
      <span>{known === undefined ? severity : known.name}</span>
    </span>
  );
}
