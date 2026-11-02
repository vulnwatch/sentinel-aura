interface SentinelMarkProps {
  // The size of the mark, as the class of a width and height, such as size-6.
  className: string;
}

// The Sentinel mark in the page (docs/design-system.md, Sentinel Mark): one
// line on Lucide's 24-unit grid, with its stroke of 2 and round ends and
// joins, in the color of the text. It accompanies the product name, which
// names it, so it is hidden from assistive technologies.
export function SentinelMark({ className }: SentinelMarkProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={`shrink-0 fill-none stroke-current stroke-2 ${className}`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 8V4.5C17.5 5 14 4.5 12 2C10 4.5 6.5 5 4 4.5V9.5L19.5 13.5C18 18.5 16.16 20.55 12 22C8.61 20.82 6.77 19.24 5.39 16" />
    </svg>
  );
}
