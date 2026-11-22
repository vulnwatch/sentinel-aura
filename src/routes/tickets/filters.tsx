import type { ReactNode } from "react";
import {
  FilterGroup,
  Filters,
  type FilterOption,
} from "../../components/filters";
import { Priority } from "../../components/priority";
import { Severity } from "../../components/severity";
import { TicketStatus } from "../../components/ticket-status";
import {
  EMBARGO_STATES,
  EMBARGO_VIEW,
  filtersApplied,
  OVERDUE_PHASES,
  PHASE_NAMES,
  PHASES,
  PRIORITIES,
  SEVERITIES,
  STATUSES,
  type TicketListSearch,
  type TicketView,
} from "./shared";

// Filters of the toolbar of the Ticket list (src/routes/tickets.tsx), with
// its filters.

// The options of the filters (docs/design-system.md, Values; docs/behaviors.md,
// Domain Terms): a status, a severity, or a priority with its mark, and
// "Not set" for the absence that unresolved filters.
const STATUS_OPTIONS: readonly FilterOption<(typeof STATUSES)[number]>[] =
  STATUSES.map((status) => ({
    value: status,
    label: <TicketStatus status={status} />,
  }));

const SEVERITY_OPTIONS: readonly FilterOption<(typeof SEVERITIES)[number]>[] =
  SEVERITIES.map((severity) => ({
    value: severity,
    label:
      severity === "unresolved" ? "Not set" : <Severity severity={severity} />,
  }));

const PRIORITY_OPTIONS: readonly FilterOption<(typeof PRIORITIES)[number]>[] =
  PRIORITIES.map((priority) => ({
    value: priority,
    label:
      priority === "unresolved" ? "Not set" : <Priority priority={priority} />,
  }));

const PHASE_OPTIONS: readonly FilterOption<(typeof PHASES)[number]>[] =
  PHASES.map((phase) => ({ value: phase, label: PHASE_NAMES[phase] }));

const OVERDUE_OPTIONS: readonly FilterOption<
  (typeof OVERDUE_PHASES)[number]
>[] = OVERDUE_PHASES.map((phase) => ({
  value: phase,
  label: PHASE_NAMES[phase],
}));

const EMBARGO_OPTIONS: readonly FilterOption<
  (typeof EMBARGO_STATES)[number]
>[] = [{ value: "expired", label: "Expired" }];

interface TicketFiltersProps {
  // The view that the list shows, which decides the filters that it accepts.
  view: TicketView;
  // The search parameters that apply.
  search: TicketListSearch;
  // What the popover announces (Filters).
  status: ReactNode;
  // Applies a change of the filters (src/routes/tickets.tsx, TicketList).
  onRefine: (change: Partial<TicketListSearch>) => void;
}

// Filters, with the number of the filters that apply and a group of
// checkboxes for each filter that the view accepts: the status in a view
// whose Tickets have every status, and the embargo in the Embargo view.
export function TicketFilters({
  view,
  search,
  status,
  onRefine: refine,
}: TicketFiltersProps) {
  return (
    <Filters applied={filtersApplied(search)} status={status}>
      {view.everyStatus && (
        <FilterGroup
          label="Status"
          options={STATUS_OPTIONS}
          selected={search.status ?? []}
          onChange={(values) => {
            refine({ status: values });
          }}
        />
      )}
      {view === EMBARGO_VIEW && (
        <FilterGroup
          label="Embargo"
          options={EMBARGO_OPTIONS}
          selected={search.embargo ?? []}
          onChange={(values) => {
            refine({ embargo: values });
          }}
        />
      )}
      <FilterGroup
        label="Severity"
        options={SEVERITY_OPTIONS}
        selected={search.severity ?? []}
        onChange={(values) => {
          refine({ severity: values });
        }}
      />
      <FilterGroup
        label="Priority"
        options={PRIORITY_OPTIONS}
        selected={search.priority ?? []}
        onChange={(values) => {
          refine({ priority: values });
        }}
      />
      <FilterGroup
        label="Current phase"
        options={PHASE_OPTIONS}
        selected={search.phase ?? []}
        onChange={(values) => {
          refine({ phase: values });
        }}
      />
      <FilterGroup
        label="Overdue"
        options={OVERDUE_OPTIONS}
        selected={search.overdue ?? []}
        onChange={(values) => {
          refine({ overdue: values });
        }}
      />
    </Filters>
  );
}
