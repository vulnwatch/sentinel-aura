import {
  useRouter,
  type NavigateOptions,
  type ToOptions,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RouterProvider } from "react-aria-components";

// React Aria's links take the router's typed paths and navigation options.
declare module "react-aria-components" {
  interface RouterConfig {
    href: ToOptions["to"];
    routerOptions: Omit<NavigateOptions, keyof ToOptions>;
  }
}

interface RouterLinksProps {
  // Called when a link inside navigates, before the navigation, such as to
  // close the sidebar opened over the content.
  onNavigate?: () => void;
  children: ReactNode;
}

// Makes React Aria's links, and the components that contain links, navigate
// through the router instead of loading a new page. The root route provides
// it to every screen (src/routes/root.tsx).
export function RouterLinks({ onNavigate, children }: RouterLinksProps) {
  const router = useRouter();
  return (
    <RouterProvider
      navigate={(to, options) => {
        onNavigate?.();
        void router.navigate({ ...options, to });
      }}
      useHref={(to) => router.buildLocation({ to }).href}
    >
      {children}
    </RouterProvider>
  );
}
