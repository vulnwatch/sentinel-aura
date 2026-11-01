import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./root";

export function HomePage() {
  return (
    <main className="p-6">
      <h1 className="text-20 font-semibold">Sentinel Aura</h1>
    </main>
  );
}

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});
