import type { UserReference } from "../api/generated/model";
import { Avatar, NoActorPicture, type AvatarSize } from "./avatar";

// The representation of a user (docs/behaviors.md, Representation of a User;
// docs/design-system.md, Representation of a User).

// The fields of a user that its representation shows, which every user
// representation of the API carries: a user reference, a directory entry,
// the complete profile and its manager, and the signed-in user.
export type UserFields = Pick<
  UserReference,
  "id" | "username" | "full_name" | "active" | "bot"
>;

// The display name: full_name, or the username when full_name is null or
// blank, a fallback that Sentinel leaves to the presentation (Sentinel
// docs/features/identity/user-management.md, Get User).
export function displayName(user: UserFields): string {
  return user.full_name === null || user.full_name.trim() === ""
    ? user.username
    : user.full_name;
}

// The name of a user in the compact form, where the avatar stands alone in
// its control: the accessible name of the control and the text of its
// tooltip, which end with "(bot)", then "(inactive)", as the labels do.
export function compactName(user: UserFields): string {
  const bot = user.bot ? " (bot)" : "";
  const inactive = user.active ? "" : " (inactive)";
  return `${displayName(user)}${bot}${inactive}`;
}

interface LabelProps {
  children: string;
}

// The label Bot or Inactive after the name of a user.
function Label({ children }: LabelProps) {
  return (
    <span className="shrink-0 rounded border border-border-strong px-1 text-12 font-medium text-fg-muted">
      {children}
    </span>
  );
}

interface UserProps {
  user: UserFields;
  // Small in text, table rows, and the options of a field; medium in other
  // lists of users; large in the heading of a user's screen.
  size?: AvatarSize;
  // Whether the username follows the display name when the two differ,
  // where users must be told apart exactly, such as in a user picker.
  withUsername?: boolean;
}

// A user in the full form: the avatar, then the display name in the style of
// the surrounding text, and the labels Bot, then Inactive. An inactive user's
// name is in fg-muted. Where the place is too narrow, only the name ends with
// an ellipsis, and assistive technologies read it whole.
export function User({
  user,
  size = "small",
  withUsername = false,
}: UserProps) {
  const name = displayName(user);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 align-middle">
      <Avatar user={user} size={size} />
      <span
        className={`min-w-0 truncate ${user.active ? "" : "text-fg-muted"}`}
      >
        {name}
        {withUsername && user.username !== name && (
          <span className="text-fg-muted"> {user.username}</span>
        )}
      </span>
      {user.bot && <Label>Bot</Label>}
      {!user.active && <Label>Inactive</Label>}
    </span>
  );
}

interface ActorProps {
  // The user that the recorded action names as its actor, or null when it
  // names none.
  actor: UserFields | null;
  size?: AvatarSize;
}

// The actor of a recorded action: the user in the full form, or "System"
// with the Sentinel mark in place of an avatar when no user is recorded
// (Sentinel docs/features/identity/rbac.md, Actor Identities). Only the actor
// of a recorded action is System: another field without a user is an absent
// value (docs/behaviors.md, Absent Values).
export function Actor({ actor, size = "small" }: ActorProps) {
  if (actor === null) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 align-middle">
        <NoActorPicture size={size} />
        <span className="min-w-0 truncate">System</span>
      </span>
    );
  }
  return <User user={actor} size={size} />;
}
