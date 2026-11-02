import {
  createRootRoute,
  Outlet,
  useRouter,
  type NavigateOptions,
  type ToOptions,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RouterProvider } from "react-aria-components";
import { AppFrame } from "../components/app-frame";
import { FocusAfterNavigation } from "../components/screen-heading";
import { SignInColumn } from "../components/sign-in-column";
import { UiFailurePage } from "../components/ui-failure";
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

// The root of every screen: links through the router, the focus after a
// navigation, and the screen of the URL once the session allows it
// (src/session-gate.tsx), in its frame: beside the sidebar for a signed-in
// user, and in the column of the Sign In Page while no signed-in user is
// known, as on Sign in (docs/screen-map.md, Sidebar; docs/design-system.md,
// Main Content).
export function RootLayout() {
  return (
    <RouterLinks>
      <FocusAfterNavigation>
        <SessionGate>
          {(user) =>
            user === undefined ? (
              <SignInColumn>
                <Outlet />
              </SignInColumn>
            ) : (
              <AppFrame user={user}>
                <Outlet />
              </AppFrame>
            )
          }
        </SessionGate>
      </FocusAfterNavigation>
    </RouterLinks>
  );
}

// A failure of the UI in the root layout itself, such as in the sidebar,
// which leaves no frame: the page of the failure shows in the column of the
// Sign In Page (docs/design-system.md, Main Content).
export function RootFailure() {
  return (
    <SignInColumn>
      <UiFailurePage />
    </SignInColumn>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
  errorComponent: RootFailure,
});
