import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { homeRoute } from "./routes/home";
import { rootRoute } from "./routes/root";

const routeTree = rootRoute.addChildren([homeRoute]);

// Tests pass a memory history; the application uses the browser's.
export function createAppRouter(options: { history?: RouterHistory } = {}) {
  return createRouter({ routeTree, ...options });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
