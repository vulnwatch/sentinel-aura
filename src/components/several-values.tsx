import type { ReactNode } from "react";
import { Button as AriaButton } from "react-aria-components";
import { AbsentValue } from "./absent-value";
import { FOCUS_RING } from "./focus-ring";
import { Tooltip } from "./tooltip";

const COUNT = new Intl.NumberFormat("en-US");

interface SeveralValuesProps {
  // The values, distinct, in the order in which they show.
  values: readonly string[];
  // What a value is, in the singular and the plural, such as "package" and
  // "packages".
  noun: { one: string; other: string };
}

// The most values that the tooltip and the accessible name of "+N" list, so
// that the tooltip of a record with many values fits in the window.
const LISTED = 10;

// A number of values, such as "3 packages" or "1 package".
function counted(count: number, { one, other }: SeveralValuesProps["noun"]) {
  return `${COUNT.format(count)} ${count === 1 ? one : other}`;
}

// The values that a list names, at most LISTED, and "and N more" for the
// others, or undefined without others.
function listed(values: readonly string[]) {
  const rest = values.length - LISTED;
  return {
    named: values.slice(0, LISTED),
    more: rest > 0 ? `and ${COUNT.format(rest)} more` : undefined,
  };
}

// A cell of a table with several values, such as the packages of a Ticket
// (docs/design-system.md, Tables): the first value, then, 6 px later, "+N",
// the number of the others, as a button 24 px high in text-13, weight 500,
// neutral-on-soft on neutral-soft, with a 4 px radius. Its tooltip lists
// the values, one a line at weight 400, 4 px under their count, such as "3
// packages", at weight 600, so that the count is not taken for a value; its
// accessible name states the others, such as "2 more packages:
// fictional-openssl, fictional-zlib". Each names at most 10 values, then
// "and N more", such as "and 42 more", which the tooltip shows as "…and 42
// more" in muted-on-fg, so that it is not taken for a value either, with the
// ellipsis hidden from assistive technologies. Without values, an absent
// value.
export function SeveralValues({ values, noun }: SeveralValuesProps) {
  const [first, ...others] = values;
  if (first === undefined) {
    return <AbsentValue />;
  }
  const all = listed(values);
  const rest = listed(others);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{first}</span>
      {others.length > 0 && (
        <MoreValues
          count={others.length}
          label={`${counted(others.length, {
            one: `more ${noun.one}`,
            other: `more ${noun.other}`,
          })}: ${[...rest.named, ...(rest.more === undefined ? [] : [rest.more])].join(", ")}`}
          heading={counted(values.length, noun)}
          values={all.named}
          more={all.more}
        />
      )}
    </span>
  );
}

interface MoreValuesProps {
  // The number of the other values.
  count: number;
  // The accessible name of the button, which states the other values.
  label: string;
  // The count of every value, above them in the tooltip.
  heading: string;
  // The values that the tooltip lists, one a line.
  values: readonly ReactNode[];
  // How many more values the tooltip does not list, such as "and 42 more".
  more: string | undefined;
}

// "+N", the number of the other values, as a button 24 px high in text-13,
// weight 500, neutral-on-soft on neutral-soft, with a 4 px radius, whose
// tooltip lists the values (SeveralValues).
export function MoreValues({
  count,
  label,
  heading,
  values,
  more,
}: MoreValuesProps) {
  return (
    <Tooltip
      placement="top"
      text={
        <>
          <p className="mb-1 font-semibold">{heading}</p>
          <ul className="font-normal">
            {values.map((value, index) => (
              // A value of the list keeps its place while the tooltip shows.
              <li key={index}>{value}</li>
            ))}
          </ul>
          {more !== undefined && (
            <p className="font-normal text-muted-on-fg">
              <span aria-hidden>…</span>
              {more}
            </p>
          )}
        </>
      }
    >
      <AriaButton
        aria-label={label}
        className={`h-6 cursor-default rounded bg-neutral-soft px-1.5 text-13 font-medium text-neutral-on-soft tabular-nums ${FOCUS_RING}`}
      >
        {`+${COUNT.format(count)}`}
      </AriaButton>
    </Tooltip>
  );
}
