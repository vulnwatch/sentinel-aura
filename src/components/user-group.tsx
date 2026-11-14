import { Focusable, Toolbar } from "react-aria-components";
import { Avatar } from "./avatar";
import { FOCUS_RING } from "./focus-ring";
import { Tooltip } from "./tooltip";
import { compactName, type UserFields } from "./user";

interface UserGroupProps {
  // The users of the group, each once, in the order in which they show.
  users: readonly UserFields[];
  // The identifier of the heading that names the group.
  labelledBy: string;
}

// A group of users, such as the participants of a Ticket
// (docs/design-system.md, Representation of a User): every user in the
// compact form at the medium size, 6 px apart, in rows that wrap, as a list
// within a toolbar named by its heading. The toolbar is one stop of the Tab
// key, within which the arrow keys move from user to user, and the Tab key
// leaves it from the user who has the focus; the focus returns to that user
// when it comes back. Each user takes the focus, with the focus ring around
// the shape of the avatar, and shows its name in a tooltip, on hover and on
// keyboard focus, which ends with "(bot)" or "(inactive)" as the compact form
// does (docs/behaviors.md, Representation of a User). The avatar is the
// picture of the user for assistive technologies, named by the same name.
// Until the UI has the screen of a user, a user is not a link and has no
// card (docs/behaviors.md, Open Decisions).
export function UserGroup({ users, labelledBy }: UserGroupProps) {
  return (
    <Toolbar aria-labelledby={labelledBy}>
      <ul className="flex flex-wrap gap-1.5">
        {users.map((user) => {
          const name = compactName(user);
          return (
            <li key={user.id} className="flex">
              <Tooltip text={name} placement="top">
                <Focusable>
                  <span
                    // The avatar is hidden from assistive technologies, the
                    // generated one an SVG drawn by React, which an img
                    // element cannot hold (Avatar), so the element that
                    // holds it is its picture for assistive technologies.
                    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an img element cannot hold the SVG of the avatar
                    role="img"
                    aria-label={name}
                    className={`flex ${user.bot ? "rounded-[20%]" : "rounded-full"} ${FOCUS_RING}`}
                  >
                    <Avatar user={user} size="medium" />
                  </span>
                </Focusable>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </Toolbar>
  );
}
