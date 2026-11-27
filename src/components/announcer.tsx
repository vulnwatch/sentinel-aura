import { createContext, use, useState, type Key, type ReactNode } from "react";
import { createPortal } from "react-dom";

// The announcer of the page: the one live region through which the UI
// announces, without moving the focus, what appears outside an open overlay,
// such as a message, the failure of a read, the outcome of a change, or what
// a list shows after a change (docs/behaviors.md, Accessibility,
// Announcements; 4.1.3 Status Messages).
//
// While a modal overlay is open, such as a popover, a menu, or a dialog,
// React Aria hides the rest of the page from assistive technologies, every
// live region of the page included, except the elements that carry
// data-live-announcer="true", which it keeps for its own announcer, or
// data-react-aria-top-layer (react-aria 3.53.1, ariaHideOutside: the
// selector of its walk, and isAlwaysVisibleNode for the elements added
// later). The announcer carries the first, so that what it announces is heard
// while an overlay is open too. The attribute is not part of React Aria's
// documented API (adobe/react-spectrum#10912), so the tests of this module
// fail when an update of React Aria stops keeping the announcer in reach.
//
// The announcer is there from the start, before its first announcement, and
// stays as screens open and close, so that no announcement depends on a
// region that appears with it or that an overlay hid as it opened.

// The element of the announcer once it is on the page, null before, or
// undefined outside the announcer.
const AnnouncerContext = createContext<HTMLElement | null | undefined>(
  undefined,
);

interface AnnouncerProps {
  children: ReactNode;
}

// The announcer, after what it holds, for every screen inside it: a status
// region that only assistive technologies perceive, named "Announcements",
// which announces each announcement that it receives on its own, and not
// again those that it held before (aria-atomic false).
export function Announcer({ children }: AnnouncerProps) {
  const [region, setRegion] = useState<HTMLOutputElement | null>(null);
  return (
    <>
      <AnnouncerContext value={region}>{children}</AnnouncerContext>
      <output
        ref={setRegion}
        aria-label="Announcements"
        aria-atomic="false"
        data-live-announcer="true"
        className="sr-only"
      />
    </>
  );
}

interface AnnouncementProps {
  // What assistive technologies announce, or "" while there is nothing to
  // announce.
  children: string;
  // What tells one announcement from another: another one, also with the
  // same words, is announced again. By default, the words themselves.
  id?: Key | undefined;
}

// An announcement, which the announcer holds while the component that makes
// it is on the page and gives it, and announces as it arrives. The words that
// the component gave before leave the announcer without being announced.
export function Announcement({ children, id }: AnnouncementProps) {
  const region = use(AnnouncerContext);
  if (region === undefined) {
    throw new Error("An announcement is made outside the announcer");
  }
  if (region === null || children === "") {
    return null;
  }
  return createPortal(<p key={id ?? children}>{children}</p>, region);
}

// The words of a message with the reference of its error, when it has one,
// as the message shows them (docs/design-system.md, Messages).
export function withReference(
  text: string,
  reference: string | undefined,
): string {
  return reference === undefined ? text : `${text} Reference: ${reference}`;
}
