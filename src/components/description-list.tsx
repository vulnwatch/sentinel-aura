import { createContext, useContext, type ReactNode } from "react";

// The fields of a record as a description list (docs/design-system.md,
// Detail Screens): each term on the line of its value, in text-13, fg-muted,
// in a column of 104 px, 12 px before the value in text-14, fg, the fields
// 8 px apart. Where the list is narrower than 280 px, each term stands above
// its value. The widths follow the text size, as every size does
// (docs/design-system.md, Spacing and Sizes). In the popover of a value, the
// column of the terms takes the width of the longest one instead, so that
// none wraps (docs/design-system.md, Menus, Popovers, and Tooltips).

// Whether the column of the terms takes the width of the longest one: its
// fields then share the columns of the list.
const FittedTerms = createContext(false);

interface DescriptionListProps {
  // The fields, each a DescriptionItem or a DescriptionGroup.
  children: ReactNode;
  // Whether the column of the terms takes the width of the longest one,
  // rather than 104 px.
  fittedTerms?: boolean;
}

export function DescriptionList({
  children,
  fittedTerms = false,
}: DescriptionListProps) {
  return (
    <div className="@container">
      <dl
        className={
          fittedTerms ? `${FITTED_COLUMNS} gap-y-2` : "flex flex-col gap-2"
        }
      >
        <FittedTerms.Provider value={fittedTerms}>
          {children}
        </FittedTerms.Provider>
      </dl>
    </div>
  );
}

// The grid of a term and its value: one column, or, where the list is at
// least 280 px wide, the column of the term, 104 px, and 12 px later that of
// the value. A list whose terms or values a screen builds itself, such as the
// sources of an affected product with their versions, takes it from here.
export const FIELD =
  "grid grid-cols-[minmax(0,1fr)] @min-[17.5rem]:grid-cols-[6.5rem_minmax(0,1fr)] @min-[17.5rem]:gap-x-3";

// The columns of a list whose terms take the width of the longest one: one
// column, or, where the list is at least 280 px wide, the column of the
// terms and 12 px later that of the values.
const FITTED_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)] @min-[17.5rem]:grid-cols-[max-content_minmax(0,1fr)] @min-[17.5rem]:gap-x-3";

// An element of a list whose terms take the width of the longest one, which
// spans its columns and shares them with what it holds.
const SHARED_COLUMNS = "col-span-full grid grid-cols-subgrid";

// The grid of a field: its own columns, or those of the list.
function useFieldGrid(): string {
  return useContext(FittedTerms) ? `${SHARED_COLUMNS} gap-y-0` : FIELD;
}

interface DescriptionItemProps {
  term: string;
  // The value, which a field without one shows as an absent value
  // (docs/behaviors.md, Absent Values).
  children: ReactNode;
  // Whether the term stands above the value, which takes the width of the
  // list, as in a list narrower than 280 px: for a value that can run to
  // many lines, such as the scope of a CNA in its popover, which comes last
  // (docs/design-system.md, Menus, Popovers, and Tooltips).
  stacked?: boolean;
}

// A field: its term, then its value, which starts on the line of the term,
// aligned with it on its first line, or below the term when it is stacked.
export function DescriptionItem({
  term,
  children,
  stacked = false,
}: DescriptionItemProps) {
  const grid = useFieldGrid();
  return (
    <div className={stacked ? STACKED : `${grid} items-baseline`}>
      <dt className="text-13 text-fg-muted">{term}</dt>
      <dd className="min-w-0 text-14 text-fg">{children}</dd>
    </div>
  );
}

// The grid of a stacked field: one column, across the columns of a list
// whose terms take the width of the longest one.
const STACKED = "col-span-full grid grid-cols-[minmax(0,1fr)]";

interface DescriptionGroupProps {
  term: string;
  // The fields of the group, each a GroupedItem.
  children: ReactNode;
}

// A group of fields under one term, such as the deadlines of a Ticket: the
// term on a line of its own, then the fields, 4 px apart, their terms
// indented by 12 px in the column of the terms.
export function DescriptionGroup({ term, children }: DescriptionGroupProps) {
  if (useContext(FittedTerms)) {
    return (
      <div className={`${SHARED_COLUMNS} gap-y-1`}>
        <dt className="col-span-full text-13 text-fg-muted">{term}</dt>
        <dd className={SHARED_COLUMNS}>
          <dl className={`${SHARED_COLUMNS} gap-y-1`}>{children}</dl>
        </dd>
      </div>
    );
  }
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
    <div className={`${useFieldGrid()} items-baseline text-14 ${tone}`}>
      <dt className="ps-3">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
