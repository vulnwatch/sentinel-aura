import { useState } from "react";
import { Announcement } from "./announcer";

// The announcement of what a list shows after a change of the state that its
// screen keeps in its URL, such as its view, its filters, its search, or its
// page, with the focus where it was; the screen or the tab as it opens
// announces nothing (docs/behaviors.md, Accessibility, Focus after a
// navigation).

// Whether the state of a screen, as the URL that it gives, such as
// "?page=2", has changed since the screen opened: once it has, it stays
// changed, also when the user returns to the state with which it opened.
export function useChangedSinceOpened(state: string): boolean {
  const [openedAt] = useState(state);
  const [changed, setChanged] = useState(false);
  if (!changed && state !== openedAt) {
    setChanged(true);
  }
  return changed;
}

interface ResultAnnouncementProps {
  // The state that the text describes, as the URL that it gives.
  state: string;
  // What the list shows, in words, or "" while there is nothing to announce.
  children: string;
}

// The announcement of the text through the announcer of the page, which
// announces it without moving the focus, also while a modal overlay is open,
// such as the popover of the filters (src/components/announcer.tsx). Each
// state gives the text an announcement of its own, so that the same words as
// before are announced too.
export function ResultAnnouncement({
  state,
  children,
}: ResultAnnouncementProps) {
  return <Announcement id={state}>{children}</Announcement>;
}
