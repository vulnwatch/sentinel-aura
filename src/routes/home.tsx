import { createRoute } from "@tanstack/react-router";
import { ScreenHeading } from "../components/screen-heading";
import { rootRoute } from "./root";

// The Home, the landing (docs/screen-map.md, Landing): its heading, and the
// page title "Home – Sentinel".
export function HomePage() {
  return <ScreenHeading>Home</ScreenHeading>;
}

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});
