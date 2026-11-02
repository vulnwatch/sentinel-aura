import {
  createRootRoute,
  Outlet,
  useRouter,
  type NavigateOptions,
  type ToOptions,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RouterProvider } from "react-aria-components";
import { SessionGate } from "../session-gate";

// React Aria's links take the router's typed paths and navigation options.
declare module "react-aria-components" {
  interface RouterConfig {
    href: ToOptions["to"];
    routerOptions: Omit<NavigateOptions, keyof ToOptions>;
  }
}

interface RouterLinksProps {
  children: ReactNode;
}

// Makes React Aria's links, and the components that contain links, navigate
// through the router instead of loading a new page.
export function RouterLinks({ children }: RouterLinksProps) {
  const router = useRouter();
  return (
    <RouterProvider
      navigate={(to, options) => {
        void router.navigate({ ...options, to });
      }}
      useHref={(to) => router.buildLocation({ to }).href}
    >
      {children}
    </RouterProvider>
  );
}

// The root of every screen: links through the router, and the screen of the
// URL once the session allows it (src/session-gate.tsx).
export function RootLayout() {
  return (
    <RouterLinks>
      <SessionGate>
        <Outlet />
      </SessionGate>
    </RouterLinks>
  );
}

export const rootRoute = createRootRoute({ component: RootLayout });
