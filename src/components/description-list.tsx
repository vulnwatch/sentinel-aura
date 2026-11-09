import type { ReactNode } from "react";

// The fields of a record as a description list (docs/design-system.md,
// Detail Screens): each term on the line of its value, in text-13, fg-muted,
// in a column of 104 px, 12 px before the value in text-14, fg, the fields
// 8 px apart. Where the list is narrower than 280 px, each term stands above
// its value. The widths follow the text size, as every size does
// (docs/design-system.md, Spacing and Sizes).

interface DescriptionListProps {
  // The fields, each a DescriptionItem.
  children: ReactNode;
}

export function DescriptionList({ children }: DescriptionListProps) {
  return (
    <div className="@container">
      <dl className="flex flex-col gap-2">{children}</dl>
    </div>
  );
}

// The grid of a term and its value: one column, or, where the list is at
// least 280 px wide, the column of the term, 104 px, and 12 px later that of
// the value.
const FIELD =
  "grid grid-cols-[minmax(0,1fr)] @min-[17.5rem]:grid-cols-[6.5rem_minmax(0,1fr)] @min-[17.5rem]:gap-x-3";

interface DescriptionItemProps {
  term: string;
  // The value, which a field without one shows as an absent value
  // (docs/behaviors.md, Absent Values).
  children: ReactNode;
}

// A field: its term, then its value, which starts on the line of the term,
// aligned with it on its first line.
export function DescriptionItem({ term, children }: DescriptionItemProps) {
  return (
    <div className={`${FIELD} items-baseline`}>
      <dt className="text-13 text-fg-muted">{term}</dt>
      <dd className="min-w-0 text-14 text-fg">{children}</dd>
    </div>
  );
}

interface DescriptionGroupProps {
  term: string;
  // The fields of the group, each a GroupedItem.
  children: ReactNode;
}

// A group of fields under one term, such as the deadlines of a Ticket: the
// term on a line of its own, then the fields, 4 px apart, their terms
// indented by 12 px in the column of the terms.
export function DescriptionGroup({ term, children }: DescriptionGroupProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-13 text-fg-muted">{term}</dt>
      <dd>
        <dl className="flex flex-col gap-1">{children}</dl>
      </dd>
    </div>
  );
}

interface GroupedItemProps {
  // The term, in the style of the value, such as the name of a phase.
  term: ReactNode;
  children: ReactNode;
  // The classes of the color and the weight of the term and the value, such
  // as fg-muted for a phase that is over.
  tone?: string;
}

// A field of a group (DescriptionGroup).
export function GroupedItem({ term, children, tone = "" }: GroupedItemProps) {
  return (
    <div className={`${FIELD} items-baseline text-14 ${tone}`}>
      <dt className="ps-3">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
