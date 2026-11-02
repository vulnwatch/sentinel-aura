import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { NotFound } from "./components/not-found";
import { UiFailurePage } from "./components/ui-failure";
import { authCallbackRoute } from "./routes/auth-callback";
import { homeRoute } from "./routes/home";
import { rootRoute } from "./routes/root";
import { signInRoute } from "./routes/sign-in";
import { unbuiltScreenRoutes } from "./routes/unbuilt";

const routeTree = rootRoute.addChildren([
  homeRoute,
  signInRoute,
  authCallbackRoute,
  ...unbuiltScreenRoutes,
]);

// What every route shows when its screen does not apply: Not found for a
// path that matches no screen, and the page of a failure of the UI itself
// when a screen fails (docs/behaviors.md, Missing and Inaccessible Records;
// Default Presentation by Status). A screen that opens with other path
// parameters, such as another Ticket, starts again, with its first read,
// while other search parameters, such as another page of a list, keep it
// (docs/behaviors.md, Where Errors Appear).
export const routerDefaults = {
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: UiFailurePage,
  defaultRemountDeps: ({ params }: { params: unknown }) => params,
};

// Tests pass a memory history; the application uses the browser's.
export function createAppRouter(options: { history?: RouterHistory } = {}) {
  return createRouter({ routeTree, ...routerDefaults, ...options });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
