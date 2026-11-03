import { createRoute } from "@tanstack/react-router";
import { NotFound } from "../components/not-found";
import { rootRoute } from "./root";

// The screens of docs/screen-map.md (Areas and Screens) to which the sidebar,
// the account menu, and the screens lead and that are not built yet, such as
// a Ticket and a CVE, to which the rows of the Ticket list link. Each path
// shows Not found, as a path that matches no screen does (docs/behaviors.md,
// Missing and Inaccessible Records), and requires a session. A route makes
// the path one of the router's typed paths, which links take
// (docs/conventions.md, Routes); the work that builds a screen replaces its
// route here with the route of the screen.
function unbuiltScreen<TPath extends string>(path: TPath) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: NotFound,
  });
}

export const unbuiltScreenRoutes = [
  unbuiltScreen("/tickets/$ticketId"),
  unbuiltScreen("/cves"),
  unbuiltScreen("/cves/$cveId"),
  unbuiltScreen("/packages"),
  unbuiltScreen("/products"),
  unbuiltScreen("/my-packages"),
  unbuiltScreen("/data-sources"),
  unbuiltScreen("/account"),
  unbuiltScreen("/account/api-keys"),
  unbuiltScreen("/account/identity-audit-log"),
  unbuiltScreen("/admin/users"),
  unbuiltScreen("/admin/settings"),
] as const;
