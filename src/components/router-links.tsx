import {
  useRouter,
  type NavigateOptions,
  type ToOptions,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RouterProvider } from "react-aria-components";

// The address of a screen of the UI as a link takes it: the router's typed
// path, such as "/cves", or, for a link with path or search parameters, its
// options as linkOptions checks them against the route tree, such as
// linkOptions({ to: "/tickets", search: { view: "new" } }).
export type ScreenHref = ToOptions["to"] | ToOptions;

// React Aria's links take the address of a screen and the router's
// navigation options.
declare module "react-aria-components" {
  interface RouterConfig {
    href: ScreenHref;
    routerOptions: Omit<NavigateOptions, keyof ToOptions>;
  }
}

function toOptions(href: ScreenHref): ToOptions {
  return href === undefined || typeof href === "string" ? { to: href } : href;
}

interface RouterLinksProps {
  // Called when a link inside navigates, before the navigation, such as to
  // close the sidebar opened over the content.
  onNavigate?: () => void;
  children: ReactNode;
}

// Makes React Aria's links, and the components that contain links, navigate
// through the router instead of loading a new page, to the address that
// their href shows, its search parameters included. The root route provides
// it to every screen (src/routes/root.tsx).
export function RouterLinks({ onNavigate, children }: RouterLinksProps) {
  const router = useRouter();
  return (
    <RouterProvider
      navigate={(href, options) => {
        onNavigate?.();
        void router.navigate({ ...options, ...toOptions(href) });
      }}
      useHref={(href) => router.buildLocation(toOptions(href)).href}
    >
      {children}
    </RouterProvider>
  );
}
