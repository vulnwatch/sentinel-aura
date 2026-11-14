import type { ReactNode } from "react";

interface GroupBandProps {
  // The heading of the group, such as the name of a package.
  heading: ReactNode;
  // The level of the heading: one below the heading of the place of the
  // group.
  level: 2 | 3;
  // Whether the group is a hidden record that shows (docs/design-system.md,
  // Detail Screens).
  muted?: boolean;
  // What follows the heading, such as the values and the labels of the group.
  children?: ReactNode;
}

// The heading row of a group of items within a part of a detail screen, such
// as a package of a Ticket with its tracks (docs/design-system.md, Detail
// Screens): a band on neutral-soft, without a frame, at least 32 px high,
// with a 6 px radius and 12 px of side padding, which holds the heading of
// the group in text-15, weight 600, which wraps, followed 6 px later by its
// values and labels; a hidden record that shows is in fg-muted.
export function GroupBand({
  heading,
  level,
  muted = false,
  children,
}: GroupBandProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div
      className={`flex min-h-8 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-neutral-soft px-3 py-1 ${muted ? "text-fg-muted" : ""}`}
    >
      <Heading className="min-w-0 text-15 font-semibold wrap-anywhere">
        {heading}
      </Heading>
      {children}
    </div>
  );
}
