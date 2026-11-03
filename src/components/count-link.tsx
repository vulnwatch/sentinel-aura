import { Link as AriaLink } from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import type { ScreenHref } from "./router-links";

const COUNT = new Intl.NumberFormat("en-US");

interface CountLinkProps {
  // The name of what it counts, such as "Active P1".
  label: string;
  // The number, or undefined while it loads.
  value: number | undefined;
  // Whether its read failed, even after it showed a number.
  failed: boolean;
  // The address of the list of what it counts.
  href: ScreenHref;
}

// The number of a count, or the en dash of a count that is not available.
function CountValue({
  value,
  failed,
}: Pick<CountLinkProps, "value" | "failed">) {
  if (failed) {
    return (
      <>
        <span aria-hidden className="text-fg-muted">
          –
        </span>{" "}
      </>
    );
  }
  if (value === undefined) {
    return null;
  }
  return (
    <>
      <span
        className={`font-semibold tabular-nums ${value > 0 ? "text-danger-on-soft" : "text-fg"}`}
      >
        {COUNT.format(value)}
      </span>{" "}
    </>
  );
}

// A count of the attention summary, which links to the list of what it
// counts (docs/design-system.md, Lists; Other Values): 32 px high, on surface
// with a border line and a 6 px radius, in text-14, the number at weight 600,
// in danger-on-soft above zero and in fg at zero, then its label in
// fg-muted, with surface-hover under the pointer. While the number loads,
// the label shows alone; when its read failed, an en dash in fg-muted takes
// the place of the number, and assistive technologies read the label
// followed by "not available" (docs/behaviors.md, Where Errors Appear).
export function CountLink({ label, value, failed, href }: CountLinkProps) {
  return (
    <AriaLink
      href={href}
      className={`inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-14 whitespace-nowrap data-hovered:bg-surface-hover ${FOCUS_RING}`}
    >
      <span>
        <CountValue value={value} failed={failed} />
        <span className="text-fg-muted">{label}</span>
        {failed && <span className="sr-only"> not available</span>}
      </span>
    </AriaLink>
  );
}
