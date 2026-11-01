import { NOT_FOUND } from "../api/errors";
import { ErrorContent } from "./error-in-place";
import { Link } from "./link";

// The page of a path that matches no screen, `/auth/callback` included while
// it is reserved, which the router shows (docs/behaviors.md, Missing and
// Inaccessible Records; docs/screen-map.md, Contract URLs). A 404 of the read
// of a screen shows the same in place of its content (ErrorInPlace).
export function NotFound() {
  return (
    <main className="p-6">
      <ErrorContent
        heading={NOT_FOUND.heading}
        message={NOT_FOUND.message}
        action={<Link href="/">Go to the start page</Link>}
      />
    </main>
  );
}
