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
// the values, one a line, under their count, such as "3 packages", and its
// accessible name states the others, such as "2 more packages:
// fictional-openssl, fictional-zlib". Each names at most 10 values, then
// "and N more", such as "and 42 more". Without values, an absent value.
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
        <Tooltip
          placement="top"
          text={
            <>
              <p>{counted(values.length, noun)}</p>
              <ul>
                {all.named.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
              {all.more !== undefined && <p>{all.more}</p>}
            </>
          }
        >
          <AriaButton
            aria-label={`${counted(others.length, {
              one: `more ${noun.one}`,
              other: `more ${noun.other}`,
            })}: ${[...rest.named, ...(rest.more === undefined ? [] : [rest.more])].join(", ")}`}
            className={`h-6 cursor-default rounded bg-neutral-soft px-1.5 text-13 font-medium text-neutral-on-soft tabular-nums ${FOCUS_RING}`}
          >
            {`+${COUNT.format(others.length)}`}
          </AriaButton>
        </Tooltip>
      )}
    </span>
  );
}
