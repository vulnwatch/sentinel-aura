import { createRoute, Navigate } from "@tanstack/react-router";
import { landingOf, useSignedInUser } from "../session-gate";
import { rootRoute } from "./root";

// / leads to the landing of the user (docs/screen-map.md, Landing): the view
// of the Ticket list that the Tickets entry opens, in place of / in the
// browser history (Browser History), so that every way to the landing leads
// there, such as the product name, "Go to the start page", and Sign in
// without a saved URL. / shows no screen of its own.
export function LandingRedirect() {
  const user = useSignedInUser();
  if (user === undefined) {
    return null;
  }
  return <Navigate {...landingOf(user)} replace />;
}

export const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingRedirect,
});
