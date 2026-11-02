import type { UserReference } from "../api/generated/model";
import { avatarGrid, avatarPicture } from "../avatar";
import { SentinelMark } from "./sentinel-mark";

// The fields of a user that its avatar depends on, which every user
// representation of the API carries (docs/behaviors.md, Representation of a
// User).
export type AvatarUser = Pick<UserReference, "id" | "active" | "bot">;

// The sizes of the representation of a user (docs/design-system.md,
// Representation of a User): 24, 32, and 64 px at the browser's default text
// size.
const SIZES = { small: "size-6", medium: "size-8", large: "size-16" } as const;

export type AvatarSize = keyof typeof SIZES;

// The colors of the Palette by their index, as the classes of their fills
// (docs/design-system.md, Palette).
const PALETTE = [
  "fill-avatar-0",
  "fill-avatar-1",
  "fill-avatar-2",
  "fill-avatar-3",
  "fill-avatar-4",
  "fill-avatar-5",
  "fill-avatar-6",
  "fill-avatar-7",
] as const;

interface AvatarProps {
  user: AvatarUser;
  size: AvatarSize;
}

// The avatar of a user (docs/design-system.md, Avatar): the square picture
// that its id selects, in the colors of a person or, inverted, of a bot
// account, and in gray for an inactive user, shown through a circle for a
// person and with rounded corners for a bot account. The filled cells are one
// path, so that no seam shows between them. It accompanies the name of the
// user, or the name of the control that holds it, so it is hidden from
// assistive technologies (docs/behaviors.md, Representation of a User). It is
// React SVG elements, which the Content Security Policy allows
// (docs/conventions.md, No Raw HTML Injection).
export function Avatar({ user, size }: AvatarProps) {
  const picture = avatarPicture(user.id);
  // The index is three bits of the digest, so the Palette has its color.
  const color = user.active ? PALETTE[picture.color]! : "fill-avatar-inactive";
  const cells = avatarGrid(picture.cells)
    .flatMap((row, r) =>
      row.flatMap((filled, c) =>
        filled ? [`M${0.5 + c} ${0.5 + r}h1v1h-1z`] : [],
      ),
    )
    .join("");
  return (
    <svg
      aria-hidden
      viewBox="0 0 6 6"
      className={`shrink-0 overflow-hidden ${SIZES[size]} ${user.bot ? "rounded-[20%]" : "rounded-full"}`}
    >
      <rect
        width={6}
        height={6}
        className={user.bot ? color : "fill-avatar-bg"}
      />
      <path d={cells} className={user.bot ? "fill-avatar-bg" : color} />
    </svg>
  );
}

interface NoActorPictureProps {
  size: AvatarSize;
}

// The picture of a recorded action without an actor, in place of an avatar
// (docs/design-system.md, Representation of a User): the Sentinel mark at 70 %
// of the size, on a square with rounded corners. It accompanies "System", and
// the mark is hidden from assistive technologies.
export function NoActorPicture({ size }: NoActorPictureProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[20%] bg-neutral-soft text-neutral-on-soft ${SIZES[size]}`}
    >
      <SentinelMark className="size-[70%]" />
    </span>
  );
}
