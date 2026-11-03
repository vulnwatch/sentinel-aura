import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  linkOptions,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { ButtonLink } from "./button-link";
import { RouterLinks } from "./router-links";

// A link that looks like a secondary button (docs/design-system.md, Buttons
// and Links), in the light theme.

function renderAt(content: ReactNode) {
  const root = createRootRoute({
    component: () => (
      <RouterLinks>
        <Outlet />
      </RouterLinks>
    ),
  });
  const start = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => content,
  });
  const tickets = createRoute({
    getParentRoute: () => root,
    path: "/tickets",
    component: () => <h1>Tickets page</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([start, tickets]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return { router, rendered: render(<RouterProvider router={router} />) };
}

test("looks like a secondary button, and leads through the router to the address that it shows", async () => {
  const { router, rendered } = renderAt(
    <ButtonLink href={linkOptions({ to: "/tickets", search: { page: 2 } })}>
      Next
    </ButtonLink>,
  );
  const screen = await rendered;
  const link = screen.getByRole("link", { name: "Next" });

  await expect.element(link).toHaveAttribute("href", "/tickets?page=2");
  // Away from the pointer, which an earlier test can leave over it.
  await userEvent.unhover(link);
  const style = getComputedStyle(link.element());
  expect([
    link.element().getBoundingClientRect().height,
    style.fontSize,
    style.fontWeight,
    style.color,
    style.backgroundColor,
    style.borderTopColor,
    style.borderTopLeftRadius,
    style.paddingLeft,
  ]).toEqual([
    36,
    "15px",
    "500",
    "rgb(31, 35, 40)",
    "rgb(255, 255, 255)",
    "rgb(129, 139, 152)",
    "6px",
    "12px",
  ]);

  await link.click();

  await expect
    .element(screen.getByRole("heading", { name: "Tickets page" }))
    .toBeVisible();
  expect(router.state.location.href).toBe("/tickets?page=2");
});

test("is 32 px high in text-14 at the small size", async () => {
  const { rendered } = renderAt(
    <ButtonLink size="small" href="/tickets">
      Previous
    </ButtonLink>,
  );
  const screen = await rendered;
  const link = screen.getByRole("link", { name: "Previous" }).element();

  expect(link.getBoundingClientRect().height).toBe(32);
  expect(getComputedStyle(link).fontSize).toBe("14px");
});

test("shows at 60 % opacity and leads nowhere when it is disabled", async () => {
  const { rendered } = renderAt(<ButtonLink isDisabled>Previous</ButtonLink>);
  const screen = await rendered;
  const link = screen.getByRole("link", { name: "Previous" });

  await expect.element(link).toHaveAttribute("aria-disabled", "true");
  await expect.element(link).not.toHaveAttribute("href");
  expect(getComputedStyle(link.element()).opacity).toBe("0.6");
});
