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

interface LabelsProps {
  user: UserFields;
}

// The labels of a user: Bot, then Inactive.
function Labels({ user }: LabelsProps) {
  return (
    <>
      {user.bot && <Label>Bot</Label>}
      {!user.active && <Label>Inactive</Label>}
    </>
  );
}

interface UserProps {
  user: UserFields;
  // Small in text, table rows, and the options of a field; medium in other
  // lists of users; large in the heading of a user's screen.
  size?: AvatarSize;
  // Whether the avatar shows, as in the full form, or not, as in the name
  // form, which has no size, where the user is a detail of another value,
  // such as who set a priority override.
  withAvatar?: boolean;
  // Whether the username follows the display name, as @ and the username in
  // fg-muted, also when it is the display name, where users must be told
  // apart exactly, such as in a user picker.
  withUsername?: boolean;
  // Whether the name, with its username, wraps where the place is too
  // narrow, instead of ending with an ellipsis, where nothing else shows it
  // whole, such as the explanation of a priority.
  wrap?: boolean;
}

// A user in the full form: the avatar, then the display name in the style of
// the surrounding text, the username when asked, at weight 400, and the labels
// Bot, then Inactive; or in the name form, the same without the avatar. An
// inactive user's name is in fg-muted, and the @ sets its username apart from
// it. Where the place is too narrow, only the name, with its username, ends
// with an ellipsis, and assistive technologies read it whole, or wraps when
// asked.
export function User({
  user,
  size = "small",
  withAvatar = true,
  withUsername = false,
  wrap = false,
}: UserProps) {
  const name = displayName(user);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 align-middle">
      {withAvatar && <Avatar user={user} size={size} />}
      <span
        className={`min-w-0 ${wrap ? "wrap-anywhere" : "truncate"} ${user.active ? "" : "text-fg-muted"}`}
      >
        {name}
        {withUsername && (
          <span className="font-normal text-fg-muted"> @{user.username}</span>
        )}
      </span>
      <Labels user={user} />
    </span>
  );
}

interface StackedUserProps {
  user: UserFields;
  size: AvatarSize;
}

// A user with the username on a line of its own, as the account menu shows
// the signed-in user (docs/design-system.md, Account Menu): the avatar, then
// the display name in the style of the surrounding text with its labels, and
// below them @ and the username in text-13, fg-muted, at weight 400. The name
// and the username wrap where the place is too narrow, instead of ending with
// an ellipsis.
export function StackedUser({ user, size }: StackedUserProps) {
  return (
    <span className="flex max-w-full items-center gap-1.5">
      <Avatar user={user} size={size} />
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={`min-w-0 wrap-anywhere ${user.active ? "" : "text-fg-muted"}`}
          >
            {displayName(user)}
          </span>
          <Labels user={user} />
        </span>
        <span className="text-13 font-normal wrap-anywhere text-fg-muted">
          @{user.username}
        </span>
      </span>
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
