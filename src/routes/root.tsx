import {
  createRootRoute,
  Outlet,
  useRouter,
  type NavigateOptions,
  type ToOptions,
} from "@tanstack/react-router";
import { RouterProvider } from "react-aria-components";

// React Aria's links take the router's typed paths and navigation options.
declare module "react-aria-components" {
  interface RouterConfig {
    href: ToOptions["to"];
    routerOptions: Omit<NavigateOptions, keyof ToOptions>;
  }
}

// Makes React Aria's links, and the components that contain links, navigate
// through the router instead of loading a new page.
export function RootLayout() {
  const router = useRouter();
  return (
    <RouterProvider
      navigate={(to, options) => {
        void router.navigate({ ...options, to });
      }}
      useHref={(to) => router.buildLocation({ to }).href}
    >
      <Outlet />
    </RouterProvider>
  );
}

export const rootRoute = createRootRoute({ component: RootLayout });
