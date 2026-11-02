import { createRoute } from "@tanstack/react-router";
import { NotFound } from "../components/not-found";
import { rootRoute } from "./root";

// /auth/callback, the address to which the identity provider returns the
// browser after SSO, which Sentinel fixes (docs/screen-map.md, Contract URLs).
// It is reserved while Sentinel's SSO is deferred: no screen uses it, so it
// shows as missing, with or without a session.
export const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  staticData: { session: "optional" },
  component: NotFound,
});
