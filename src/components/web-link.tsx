import { ExternalLink } from "lucide-react";
import { Link as AriaLink } from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";

// The links to an address that the API returns, or to an address of another
// site that the UI composes from a value of the API (docs/behaviors.md, Links
// to Other Sites; docs/conventions.md, Links from the API). This module is the
// only one that builds them.

// A value as the browser parses it as an absolute URL, or undefined when it
// is not one.
function parsed(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

// A web address that a link may lead to: an absolute URL whose scheme is
// http or https, whatever its letter case, without a user name or password,
// as the browser parses it. Only of() makes one, so every address of this
// kind passed that check. The browser loads it as a new page, also on the
// UI's own origin, rather than the router (src/components/router-links.tsx).
export class WebAddress {
  readonly url: URL;

  private constructor(url: URL) {
    this.url = url;
  }

  // The web address of a value of the API, or undefined for any other value:
  // null, omitted, empty, or made of whitespace only, a relative address, or
  // an address of another scheme, such as a Package URL (pkg:) or javascript:.
  static of(value: string | null | undefined): WebAddress | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const url = parsed(value);
    if (
      url === undefined ||
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return undefined;
    }
    return new WebAddress(url);
  }

  // Whether the address lies on an origin other than the UI's, another
  // site.
  get isOtherSite(): boolean {
    return this.url.origin !== window.location.origin;
  }

  // Loads the address as a new page, as the browser loads a link.
  load() {
    window.location.assign(this.url.href);
  }
}

// The size of the icon of a link to another site: that of an icon beside the
// text of the link (docs/design-system.md, Icon Set).
const ICON_SIZES = {
  // Beside text of 13 or 14 px.
  small: "size-3.5",
  // Beside text of 15 px.
  medium: "size-4",
} as const;

// In running text, underlined; in a table or a list, where the link is an
// identifier, a name, or an address, underlined under the pointer and on
// focus (docs/design-system.md, Buttons and Links).
const PLACEMENTS = {
  text: "underline",
  list: "data-focus-visible:underline data-hovered:underline",
} as const;

interface WebLinkProps {
  // The address that the API returns, or that the screen composes from a
  // value of the API with the fixed origin that its screen document states.
  address: string | null | undefined;
  // The text of the link, which shows as received, without a link, when the
  // address is not a web address.
  children: string;
  placement?: keyof typeof PLACEMENTS;
  // The size of the text around the link.
  size?: keyof typeof ICON_SIZES;
}

// A link to an address of the API (docs/behaviors.md, Links to Other Sites):
// only a web address becomes a link, which leads to the address as the
// browser parsed it; any other value shows the text without a link. A link
// to another site ends with external-link, 4 px after its text, in link,
// hidden from assistive technologies, which read the text followed by
// "(another site)"; the icon stays on the line of the last characters when
// the text wraps. A link on the UI's own origin leads to Sentinel, so it has
// no mark. Either opens in the same tab, as the browser opens a link.
export function WebLink({
  address,
  children,
  placement = "list",
  size = "small",
}: WebLinkProps) {
  const web = WebAddress.of(address);
  if (web === undefined) {
    return <span>{children}</span>;
  }
  return (
    <AriaLink
      href={web}
      className={`text-link ${PLACEMENTS[placement]} ${FOCUS_RING}`}
    >
      {children}
      {web.isOtherSite && (
        <>
          {/* A word joiner, which keeps the icon on the line of the last
              characters of the text, hidden with the icon. */}
          <span aria-hidden className="whitespace-nowrap">
            {"\u2060"}
            <ExternalLink
              className={`ms-1 inline-block shrink-0 align-[-0.125em] ${ICON_SIZES[size]}`}
            />
          </span>
          <span className="sr-only"> (another site)</span>
        </>
      )}
    </AriaLink>
  );
}
