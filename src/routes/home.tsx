import { createRoute, Navigate } from "@tanstack/react-router";
import { ScreenHeading } from "../components/screen-heading";
import { triagesTickets, useSignedInUser } from "../session-gate";
import { rootRoute } from "./root";

// The landing at / (docs/screen-map.md, Landing): for a user who holds
// triage_ticket, the Ticket list in its New view, in place of / in the
// browser history (Browser History), so that every way to the landing leads
// there, such as the product name, "Go to the start page", and Sign in
// without a saved URL; for every other user, the Home, with its heading and
// the page title "Home – Sentinel".
export function HomePage() {
  const user = useSignedInUser();
  if (user === undefined) {
    return null;
  }
  if (triagesTickets(user)) {
    return <Navigate to="/tickets" search={{ view: "new" }} replace />;
  }
  return <ScreenHeading>Home</ScreenHeading>;
}

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});
