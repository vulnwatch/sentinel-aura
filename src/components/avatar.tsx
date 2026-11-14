import { useState } from "react";
import type { UserReference } from "../api/generated/model";
import { avatarGrid, avatarPattern } from "../avatar";
import { SentinelMark } from "./sentinel-mark";

// The fields of a user that its avatar depends on, which every user
// representation of the API carries (docs/behaviors.md, Representation of a
// User). The shared request function has resolved avatar_url
// (docs/conventions.md, API Access).
export type AvatarUser = Pick<
  UserReference,
  "id" | "active" | "bot" | "avatar_url"
>;

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

// The avatar of a user (docs/design-system.md, Avatar): the profile picture
// of an active person who has one, and otherwise the generated avatar. An
// inactive user and a bot account always show the generated avatar, so that
// their state shows whatever avatar_url holds. It accompanies the name of the
// user, or the name of the control that holds it, so it is hidden from
// assistive technologies (docs/behaviors.md, Representation of a User).
export function Avatar({ user, size }: AvatarProps) {
  const src = user.active && !user.bot ? user.avatar_url : null;
  // A new picture is loaded anew, even after an earlier one failed.
  return src === null ? (
    <GeneratedAvatar user={user} size={size} />
  ) : (
    <ProfilePicture key={src} user={user} size={size} src={src} />
  );
}

interface ProfilePictureProps {
  user: AvatarUser;
  size: AvatarSize;
  // The absolute URL of the picture.
  src: string;
}

// A person's profile picture (docs/design-system.md, Profile Picture): the
// image, scaled to cover the square of the size, through a circle, on
// avatar-bg, which shows while it loads and through its transparent parts.
// Once it fails to load, the generated avatar takes its place, at the same
// size. The browser sends the host no Referer, as the policy of the UI's
// responses also requires (docs/architecture.md, Security Headers), and no
// crossorigin attribute asks the host for CORS headers, which it does not
// promise.
function ProfilePicture({ user, size, src }: ProfilePictureProps) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <GeneratedAvatar user={user} size={size} />;
  }
  return (
    <img
      alt=""
      src={src}
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => {
        setFailed(true);
      }}
      className={`shrink-0 rounded-full bg-avatar-bg object-cover ${SIZES[size]}`}
    />
  );
}

// The generated avatar of a user (docs/design-system.md, Avatar, Definition,
// Version 1): the square picture that its id selects, in the colors of a
// person or, inverted, of a bot account, and in gray for an inactive user,
// shown through a circle for a person and with rounded corners for a bot
// account. The filled cells are one path, so that no seam shows between
// them. It is React SVG elements, which the Content Security Policy allows
// (docs/conventions.md, No Raw HTML Injection).
function GeneratedAvatar({ user, size }: AvatarProps) {
  const pattern = avatarPattern(user.id);
  // The index is three bits of the digest, so the Palette has its color.
  const color = user.active ? PALETTE[pattern.color]! : "fill-avatar-inactive";
  const cells = avatarGrid(pattern.cells)
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
