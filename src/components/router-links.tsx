import {
  useRouter,
  type NavigateOptions,
  type ToOptions,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RouterProvider } from "react-aria-components";
import { WebAddress } from "./web-link";

// The address of a screen of the UI as a link takes it: the router's typed
// path, such as "/users", or, for a link with path or search parameters, its
// options as linkOptions checks them against the route tree, such as
// linkOptions({ to: "/tickets", search: { view: "new" } }).
export type ScreenHref = ToOptions["to"] | ToOptions;

// React Aria's links take the address of a screen and the router's
// navigation options, or a web address that the browser loads itself
// (src/components/web-link.tsx).
declare module "react-aria-components" {
  interface RouterConfig {
    href: ScreenHref | WebAddress;
    routerOptions: Omit<NavigateOptions, keyof ToOptions>;
  }
}

// The router's options of the address of a screen.
export function screenOptions(href: ScreenHref): ToOptions {
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
// it to every screen (src/routes/root.tsx). A web address is never the
// router's: a link to another site loads it as the browser does, and so does
// one on the UI's own origin, which the browser then loads as a new page
// (docs/behaviors.md, Links to Other Sites).
export function RouterLinks({ onNavigate, children }: RouterLinksProps) {
  const router = useRouter();
  return (
    <RouterProvider
      navigate={(href, options) => {
        onNavigate?.();
        if (href instanceof WebAddress) {
          href.load();
          return;
        }
        void router.navigate({ ...options, ...screenOptions(href) });
      }}
      useHref={(href) =>
        href instanceof WebAddress
          ? href.url.href
          : router.buildLocation(screenOptions(href)).href
      }
    >
      {children}
    </RouterProvider>
  );
}
