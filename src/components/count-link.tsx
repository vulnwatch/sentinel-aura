import { ExternalLink } from "lucide-react";
import { Link as AriaLink } from "react-aria-components";
import { COUNT } from "./count";
import { FOCUS_RING } from "./focus-ring";
import type { ScreenHref } from "./router-links";
import { OTHER_SITE, WebAddress } from "./web-link";

interface CountLinkProps {
  // The name of what it counts, such as "Active P1", or, in a group of
  // counts, what sets it apart from the others, such as "Triage".
  label: string;
  // The name of the group of the count, such as "overdue", which shows once
  // before the group and which assistive technologies read after the label
  // of each of its counts, as "1 Triage overdue".
  groupName?: string | undefined;
  // The number, or undefined while it loads.
  value: number | undefined;
  // Whether its read failed, even after it showed a number.
  failed: boolean;
  // The address of the list of what it counts: a screen of the UI, or a web
  // address, as src/components/web-link.tsx checks an address of the API,
  // which the browser loads; or undefined while no address is known, when the
  // count is not a link.
  href: ScreenHref | WebAddress | undefined;
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

const BOX =
  "inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-14 whitespace-nowrap";

// A count of the attention summary, which links to the list of what it
// counts (docs/design-system.md, Lists; Other Values): 32 px high, on surface
// with a border line and a 6 px radius, in text-14, the number at weight 600,
// in danger-on-soft above zero and in fg at zero, then its label in
// fg-muted, with surface-hover under the pointer. While the number loads,
// the label shows alone; when its read failed, an en dash in fg-muted takes
// the place of the number, and assistive technologies read the label
// followed by "not available" (docs/behaviors.md, Where Errors Appear). The
// name of its group follows the label for assistive technologies alone. A
// count whose list lies on another site ends with external-link at 14 px in
// fg-muted, 4 px after its label, hidden from assistive technologies, which
// read "(another site)" last (docs/behaviors.md, Links to Other Sites,
// Marked). A count without an address shows in the same box, without the
// hover, and is not a link.
export function CountLink({
  label,
  groupName,
  value,
  failed,
  href,
}: CountLinkProps) {
  const otherSite = href instanceof WebAddress && href.isOtherSite;
  const content = (
    <span>
      <CountValue value={value} failed={failed} />
      <span className="text-fg-muted">{label}</span>
      {groupName !== undefined && (
        <span className="sr-only">{` ${groupName}`}</span>
      )}
      {failed && <span className="sr-only"> not available</span>}
      {otherSite && <span className="sr-only">{OTHER_SITE}</span>}
    </span>
  );
  if (href === undefined) {
    return <span className={BOX}>{content}</span>;
  }
  return (
    <AriaLink
      href={href}
      className={`${BOX} data-hovered:bg-surface-hover ${FOCUS_RING}`}
    >
      {content}
      {otherSite && (
        <ExternalLink
          aria-hidden
          className="ms-1 size-3.5 shrink-0 text-fg-muted"
        />
      )}
    </AriaLink>
  );
}
