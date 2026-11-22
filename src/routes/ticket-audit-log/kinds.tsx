import {
  CircleDot,
  CircleQuestionMark,
  EyeOff,
  Flag,
  Gauge,
  Link as LinkIcon,
  Package,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { TicketAuditEventType } from "../../api/generated/model";
import type { FilterOption } from "../../components/filters";

// The kinds of event of the tab Audit log (src/routes/ticket-audit-log.tsx),
// which its kind filter and the icons of its events share.

// The kinds of event, each a group of event types with its icon
// (docs/design-system.md, Icons by Need), in the order of the filter.
// The values of the kind search parameter.
export const KIND_IDS = [
  "status",
  "assignment",
  "packages",
  "cve",
  "priority",
  "confidentiality",
  "references",
] as const;

type KindId = (typeof KIND_IDS)[number];

interface Kind {
  id: KindId;
  label: string;
  icon: LucideIcon;
  types: readonly TicketAuditEventType[];
}

export const KINDS = [
  {
    id: "status",
    label: "Status",
    icon: CircleDot,
    types: [
      "ticket_created",
      "status_change",
      "duplicate_set",
      "duplicate_removed",
      "duplicate_target_changed",
    ],
  },
  {
    id: "assignment",
    label: "Assignment",
    icon: UserCheck,
    types: ["assignment"],
  },
  {
    id: "packages",
    label: "Packages",
    icon: Package,
    types: [
      "package_added",
      "package_maintainer_added",
      "package_excluded",
      "package_restored",
      "track_status_changed",
      "track_excluded",
      "track_restored",
      "product_released",
      "product_eligibility_changed",
      "product_excluded",
      "product_restored",
    ],
  },
  {
    id: "cve",
    label: "CVE and CVSS",
    icon: Gauge,
    types: ["cve_associated", "cvss_assessment_changed", "severity_changed"],
  },
  {
    id: "priority",
    label: "Priority",
    icon: Flag,
    types: ["priority_changed"],
  },
  {
    id: "confidentiality",
    label: "Confidentiality",
    icon: EyeOff,
    types: [
      "confidentiality_changed",
      "coordinated_release_changed",
      "access_grant_added",
      "access_grant_removed",
    ],
  },
  {
    id: "references",
    label: "References",
    icon: LinkIcon,
    types: [
      "reference_added",
      "reference_deleted",
      "reference_url_changed",
      "reference_type_changed",
      "reference_title_changed",
      "reference_description_changed",
    ],
  },
] as const satisfies readonly Kind[];

// The icon of the kind of an event type, or of an event type that the
// pinned contract does not list (docs/behaviors.md, Unknown Values).
export function iconOf(type: string): LucideIcon {
  return (
    KINDS.find((kind) => (kind.types as readonly string[]).includes(type))
      ?.icon ?? CircleQuestionMark
  );
}

export const KIND_OPTIONS: readonly FilterOption<KindId>[] = KINDS.map(
  (kind) => ({
    value: kind.id,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <kind.icon aria-hidden className="size-3.5 text-fg-muted" />
        {kind.label}
      </span>
    ),
  }),
);
