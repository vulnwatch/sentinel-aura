import { page } from "vitest/browser";

// Whether assistive technologies can reach the element: React Aria hides
// the rest of the page while a modal overlay is open, with inert on the
// elements that hold it, which the locators of the tests do not take into
// account, or with aria-hidden, which they do.
export function inReach(element: Element): boolean {
  return element.closest('[inert], [aria-hidden="true"]') === null;
}

// What the announcer of the page holds, one entry for each announcement, in
// the order in which they arrived (src/components/announcer.tsx). The
// announcer is found by its role and name, as assistive technologies find
// it, and the function throws while they cannot reach it, such as when an
// open modal overlay hides it, so a check that retries, such as
// expect.poll, waits until they can.
export function announcements(): string[] {
  const region = page.getByRole("status", { name: "Announcements" }).element();
  if (!inReach(region)) {
    throw new Error("The announcer is out of reach of assistive technologies");
  }
  return Array.from(region.children, (node) => node.textContent ?? "");
}

// How many announcements of the announcer of the page say the words, such
// as those of a message, which the message area announces once, and which
// the part of the screen where the user acted does not announce again.
export function timesAnnounced(words: string): number {
  return announcements().filter((announced) => announced === words).length;
}

// The node of the announcer of the page that holds the words, or null while
// it holds none: a new announcement with the same words is a new node, which
// assistive technologies announce again.
export function announcementNode(words: string): Element | null {
  return page
    .getByRole("status", { name: "Announcements" })
    .getByText(words, { exact: true })
    .query();
}

// Whether the announcer of the page holds the words in a node other than the
// one before, as a new announcement with the same words.
export function announcedAgain(words: string, before: Element | null): boolean {
  const node = announcementNode(words);
  return node !== null && node !== before;
}
