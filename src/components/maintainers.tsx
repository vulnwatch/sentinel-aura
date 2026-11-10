import { UserRound, UserRoundX, UsersRound } from "lucide-react";
import { Button as AriaButton, DialogTrigger } from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import { InfoPopover, PopoverLine, PopoverTitle } from "./info-popover";
import { Tooltip } from "./tooltip";
import { User, type UserFields } from "./user";

// The maintainers of a package, the users that Sentinel associated with it
// (Sentinel docs/features/packages/package-maintainership.md, Maintainers in
// the Package Tree).

const COUNT = new Intl.NumberFormat("en-US");

// The name of the maintainers of a package, such as "2 maintainers of
// fictional-openssl" or "No maintainer of fictional-openssl", which names the
// package, since every package of a Ticket shows its maintainers.
function maintainersName(count: number, packageName: string): string {
  if (count === 0) {
    return `No maintainer of ${packageName}`;
  }
  const noun = count === 1 ? "maintainer" : "maintainers";
  return `${COUNT.format(count)} ${noun} of ${packageName}`;
}

interface MaintainersProps {
  // The maintainers, in the order of the API.
  users: readonly UserFields[];
  packageName: string;
}

// The maintainers of a package as an icon with their number: user-round for
// one, users-round for several, and user-round-x without any, at 16 px in
// fg-muted, the number 4 px after the icon in text-14, fg-muted, with tabular
// figures (docs/design-system.md, Icons by Need). Icon and number are one
// button, at least 24 by 24 px, with a 6 px radius, on surface-hover under
// the pointer and while its popover is open, named by the number and the
// package, which its tooltip shows. It opens a popover, 288 px wide
// (InfoPopover), with the title "Maintainers" and the package below it, a
// border line, and the maintainers, 8 px apart, each in the full form at the
// medium size with the username (docs/behaviors.md, Representation of a
// User), or a line that says that Sentinel knows none.
export function Maintainers({ users, packageName }: MaintainersProps) {
  const count = users.length;
  let Icon = UsersRound;
  if (count === 0) {
    Icon = UserRoundX;
  } else if (count === 1) {
    Icon = UserRound;
  }
  const name = maintainersName(count, packageName);
  return (
    <DialogTrigger>
      <Tooltip text={name} placement="top">
        <AriaButton
          aria-label={name}
          className={`inline-flex h-6 min-w-6 shrink-0 cursor-default items-center justify-center gap-1 rounded-md px-1 text-14 text-fg-muted data-hovered:bg-surface-hover aria-expanded:bg-surface-hover ${FOCUS_RING}`}
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          {count > 0 && (
            <span aria-hidden className="tabular-nums">
              {COUNT.format(count)}
            </span>
          )}
        </AriaButton>
      </Tooltip>
      <InfoPopover width="narrow" label={`Maintainers of ${packageName}`}>
        <PopoverTitle>Maintainers</PopoverTitle>
        <p className="text-13 wrap-anywhere text-fg-muted">{packageName}</p>
        <PopoverLine />
        {count === 0 ? (
          <p className="text-fg-muted">
            Sentinel knows no maintainer of this package.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.map((user) => (
              <li key={user.id} className="flex min-w-0">
                <User user={user} size="medium" withUsername />
              </li>
            ))}
          </ul>
        )}
      </InfoPopover>
    </DialogTrigger>
  );
}
