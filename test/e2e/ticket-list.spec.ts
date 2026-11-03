import type { Page } from "@playwright/test";
import {
  avatars,
  dateTimes,
  expect,
  expectAccessible,
  signIn,
  test,
} from "./fixtures";

// The Ticket list (docs/screens/ticket-list.md), against a backend loaded
// with Sentinel's example dataset, whose Tickets, users, and roles the tests
// rely on as loaded (Sentinel docs/features/platform/example-dataset.md,
// Users; CVEs; Tickets; Aged Tickets).

function views(page: Page) {
  return page.getByRole("tablist", { name: "Views" }).getByRole("tab");
}

function table(page: Page) {
  return page.getByRole("grid", { name: "Tickets" });
}

// The identifiers of the rows, in their order.
function identifiers(page: Page) {
  return table(page).getByRole("rowheader");
}

// The reference screenshots mask the avatars and the dates, which change
// from one load of the dataset to the next.
function masked(page: Page) {
  return { mask: [avatars(page), dateTimes(page)] };
}

// Moves the pointer away from the rows, which it would mark, to the empty
// part of the sidebar, before a reference screenshot.
async function pointerAway(page: Page) {
  await page.mouse.move(100, 500);
}

test.describe("for an analyst", () => {
  test("lands on the New view, sorted by priority, with the counts of the views", async ({
    page,
  }) => {
    // asmith holds the vulnerability_analyst role and sees every Ticket.
    await signIn(page, "asmith");

    await expect(
      page.getByRole("heading", { level: 1, name: "Tickets" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Tickets – Sentinel");
    await expect(views(page)).toHaveText([
      "New 12",
      "Assigned to me 4",
      "Analysis 5",
      "Analyzed 3",
      "Orphaned 1",
      "All 26",
    ]);
    await expect(views(page).first()).toHaveAttribute("aria-selected", "true");
    // P1, P2, the P3 Tickets newest first, the P4 Tickets newest first, and
    // the Ticket without a priority last (Sentinel
    // docs/features/tickets/ticket-priority.md, Decision Table).
    await expect(identifiers(page)).toHaveText([
      "SNTL-1",
      "SNTL-7",
      "SNTL-24",
      "SNTL-10",
      "SNTL-2",
      "SNTL-25",
      "SNTL-23",
      "SNTL-20",
      "SNTL-5",
      "SNTL-4",
      "SNTL-3",
      "SNTL-6",
    ]);
    await expect(
      table(page).getByRole("columnheader", {
        name: "Priority (sorted descending)",
      }),
    ).toBeVisible();
    // SNTL-7 is past its triage due date (Aged Tickets).
    await expect(
      table(page).getByRole("row", { name: /SNTL-7/ }),
    ).toContainText("Triage -3d");
    await pointerAway(page);

    await expect(page).toHaveScreenshot("ticket-list.png", masked(page));
  });

  test("opens a view with its tab, and the landing leads to the New view", async ({
    page,
  }) => {
    await signIn(page, "asmith");

    await views(page).filter({ hasText: "Analysis" }).first().click();

    await expect(page).toHaveURL("/tickets?view=analysis");
    await expect(identifiers(page)).toHaveCount(5);
    // The confidential Tickets that asmith sees (Tickets).
    for (const ticket of ["SNTL-18", "SNTL-19"]) {
      await expect(
        table(page)
          .getByRole("rowheader", { name: new RegExp(ticket) })
          .getByRole("img", { name: "Confidential" }),
      ).toBeVisible();
    }
    await expect(
      table(page).getByRole("row", { name: /SNTL-9/ }),
    ).toContainText("Unassigned");
    await expectAccessible(page);
    await pointerAway(page);

    await expect(page).toHaveScreenshot(
      "ticket-list-analysis.png",
      masked(page),
    );

    await page.goto("/");
    await expect(page).toHaveURL("/tickets?view=new");
  });

  test("shows the Tickets assigned to the analyst", async ({ page }) => {
    await signIn(page, "asmith");

    await views(page).filter({ hasText: "Assigned to me" }).click();

    await expect(page).toHaveURL("/tickets?view=assigned-to-me");
    await expect(identifiers(page)).toHaveText([
      "SNTL-12",
      "SNTL-18",
      "SNTL-21",
      "SNTL-13",
    ]);
  });

  test("pages the All view, sorted by last modification", async ({ page }) => {
    await signIn(page, "asmith");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Tickets", exact: true })
      .click();
    await views(page).filter({ hasText: "All" }).click();

    await expect(page).toHaveURL("/tickets");
    await expect(identifiers(page)).toHaveCount(20);
    await expect(
      table(page).getByRole("columnheader", {
        name: "Last modified (sorted descending)",
      }),
    ).toBeVisible();
    const pagination = page.getByRole("navigation", { name: "Pagination" });
    await expect(pagination).toContainText("1–20 of 26");
    await expectAccessible(page);
    await pointerAway(page);

    await expect(page).toHaveScreenshot("ticket-list-all.png", masked(page));

    await pagination.getByRole("link", { name: "Next" }).click();

    await expect(page).toHaveURL("/tickets?page=2");
    await expect(identifiers(page)).toHaveCount(6);
    await expect(pagination).toContainText("21–26 of 26");
    // Next is disabled on the last page, and the focus moves to Previous.
    await expect(
      pagination.getByRole("link", { name: "Previous" }),
    ).toBeFocused();
    await pointerAway(page);

    await expect(page).toHaveScreenshot(
      "ticket-list-all-last-page.png",
      masked(page),
    );
  });

  test("tells that a page beyond the last has no Tickets", async ({ page }) => {
    await signIn(page, "asmith");

    await page.goto("/tickets?view=analyzed&page=3");

    await expect(
      page.getByText("There are no Tickets on this page."),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Pagination" }),
    ).toHaveCount(0);
    await expectAccessible(page);
    await pointerAway(page);

    await expect(page).toHaveScreenshot(
      "ticket-list-beyond-last-page.png",
      masked(page),
    );

    await page.getByRole("link", { name: "Go to the first page" }).click();

    await expect(page).toHaveURL("/tickets?view=analyzed");
    await expect(identifiers(page)).toHaveCount(3);
    await expect(
      page.getByRole("heading", { level: 1, name: "Tickets" }),
    ).toBeFocused();
  });
});

test("shows a user without the role the views of every user, and the All view from the Tickets entry", async ({
  page,
}) => {
  // dbrown holds no role, and sees the non-confidential Tickets and the
  // confidential SNTL-18 of a package that dbrown maintains (Packages,
  // Tracks, and Maintainers).
  await signIn(page, "dbrown");

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Tickets", exact: true })
    .click();

  await expect(page).toHaveURL("/tickets");
  await expect(views(page)).toHaveText([
    "New 12",
    "Analysis 4",
    "Analyzed 3",
    "Orphaned 1",
    "All 25",
  ]);
  await expect(views(page).last()).toHaveAttribute("aria-selected", "true");

  // A view that the user is not shown opens the All view, and leaves the URL.
  await page.goto("/tickets?view=assigned-to-me");
  await expect(page).toHaveURL("/tickets");
  await expect(views(page).last()).toHaveAttribute("aria-selected", "true");
});
