import {
  redirect,
  createHashHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useRouter,
  type AnyRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { useLayoutEffect, useState } from "react";
import { afterEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { z } from "zod";
import "../styles.css";
import { Button } from "./button";
import { useDiscardQuestion } from "./discard-question";
import { ModalDialog } from "./modal-dialog";
import { RouterLinks } from "./router-links";
import { TextField } from "./text-field";

// The question before input not yet submitted is discarded
// (docs/behaviors.md, Confirmation).

let history: RouterHistory | undefined;

afterEach(() => {
  history?.destroy();
  history = undefined;
  window.location.hash = "";
});

// A dialog with a field, whose input it holds once the user types, except
// while a change is in progress, whose input counts as submitted.
function EditDialog({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { close, question } = useDiscardQuestion({
    held: input !== "" && !busy,
    consequence: "The note that you entered isn't added.",
    onDiscard: onClose,
  });
  return (
    <ModalDialog
      isOpen
      onClose={close}
      width="form"
      title="Add note"
      buttons={
        <>
          <Button size="large" onPress={close}>
            Cancel
          </Button>
          <Button
            size="large"
            onPress={() => {
              setBusy(true);
            }}
          >
            Start a change
          </Button>
          {question}
        </>
      }
    >
      <TextField label="Note" value={input} onChange={setInput} />
    </ModalDialog>
  );
}

// A screen that opens the dialog, and whose search, the view, stays with the
// screen.
function NotesScreen({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <h1>{title}</h1>
      <Button
        onPress={() => {
          setOpen(true);
        }}
      >
        Add note
      </Button>
      {open && (
        <EditDialog
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

// A screen that leads at once to Other in its place, as the landing does
// with the router's Navigate, in the commit in which it shows.
function LeadsToOther() {
  const router = useRouter();
  useLayoutEffect(() => {
    router.history.replace("/other");
  }, [router]);
  return null;
}

function createTestRouter(routerHistory: RouterHistory): AnyRouter {
  history = routerHistory;
  const root = createRootRoute({
    component: () => (
      <RouterLinks>
        <Outlet />
      </RouterLinks>
    ),
  });
  const notes = createRoute({
    getParentRoute: () => root,
    path: "/notes",
    validateSearch: z.object({ view: z.string().optional() }),
    // A view in another letter case leads to its own form, in place of the
    // URL, as a screen's search parameters do.
    beforeLoad: ({ search }) => {
      if (
        search.view !== undefined &&
        search.view !== search.view.toLowerCase()
      ) {
        throw redirect({
          href: `/notes?view=${search.view.toLowerCase()}`,
          replace: true,
        });
      }
    },
    component: () => <NotesScreen title="Notes" />,
  });
  const other = createRoute({
    getParentRoute: () => root,
    path: "/other",
    component: () => <h1>Other</h1>,
  });
  const signIn = createRoute({
    getParentRoute: () => root,
    path: "/sign-in",
    component: () => <h1>Sign in</h1>,
  });
  // A screen that leads at once to another, as the landing does.
  const start = createRoute({
    getParentRoute: () => root,
    path: "/start",
    component: LeadsToOther,
  });
  return createRouter({
    routeTree: root.addChildren([notes, other, signIn, start]),
    history: routerHistory,
  });
}

// The router at Notes, after Other in the history, or in that of a hash
// history, which
// follows Back and Forward as the browser's history does without changing the
// address of the document of the tests.
async function renderNotes(kind: "memory" | "browser" = "memory") {
  let router: AnyRouter;
  if (kind === "memory") {
    router = createTestRouter(
      createMemoryHistory({ initialEntries: ["/other", "/notes"] }),
    );
  } else {
    window.location.hash = "#/other";
    router = createTestRouter(createHashHistory());
  }
  const screen = await render(<RouterProvider router={router} />);
  if (kind === "browser") {
    await expect
      .element(screen.getByRole("heading", { name: "Other" }))
      .toBeVisible();
    router.history.push("/notes");
  }
  await expect
    .element(screen.getByRole("heading", { name: "Notes" }))
    .toBeVisible();
  return { router, screen };
}

async function openWithInput(screen: Awaited<ReturnType<typeof render>>) {
  await screen.getByRole("button", { name: "Add note" }).click();
  const dialog = screen.getByRole("dialog", { name: "Add note" });
  await dialog.getByRole("textbox", { name: "Note" }).fill("Fictional note");
  return dialog;
}

function discardQuestion() {
  return page.getByRole("dialog", { name: "Discard changes?" });
}

// Whether a beforeunload event that the window receives is cancelled, so
// that the browser shows its own prompt before it unloads the page.
function unload(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

// Waits until the browser has rendered two more frames, after which the
// effects of the commits before have run.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

test("closes without a question when the dialog holds no input", async () => {
  const { screen } = await renderNotes();
  await screen.getByRole("button", { name: "Add note" }).click();
  const dialog = screen.getByRole("dialog", { name: "Add note" });
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect.element(dialog).not.toBeInTheDocument();
  expect(discardQuestion().query()).toBeNull();
});

test("asks before Cancel discards the input, keeps it on Keep editing, and closes on Discard", async () => {
  const { screen } = await renderNotes();
  const dialog = await openWithInput(screen);
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect
    .element(discardQuestion().getByRole("button", { name: "Keep editing" }))
    .toHaveFocus();
  await expect
    .element(
      discardQuestion().getByText("The note that you entered isn't added."),
    )
    .toBeVisible();
  await discardQuestion().getByRole("button", { name: "Keep editing" }).click();
  await expect.element(discardQuestion()).not.toBeInTheDocument();
  await expect
    .element(dialog.getByRole("textbox", { name: "Note" }))
    .toHaveValue("Fictional note");

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await discardQuestion()
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await expect.element(dialog).not.toBeInTheDocument();
});

test("asks before a navigation of the UI discards the input, keeps the screen, the dialog, the input, and the URL on Keep editing, and leaves on Discard", async () => {
  const { router, screen } = await renderNotes();
  const dialog = await openWithInput(screen);

  router.history.push("/other");
  await expect.element(discardQuestion()).toBeVisible();
  await discardQuestion().getByRole("button", { name: "Keep editing" }).click();
  await expect.element(discardQuestion()).not.toBeInTheDocument();
  await nextFrames();
  expect(router.state.location.pathname).toBe("/notes");
  await expect
    .element(dialog.getByRole("textbox", { name: "Note" }))
    .toHaveValue("Fictional note");

  router.history.push("/other");
  await discardQuestion()
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await expect
    .element(screen.getByRole("heading", { name: "Other" }))
    .toBeVisible();
  expect(router.state.location.pathname).toBe("/other");
});

test("asks before Back discards the input, restores the URL on Keep editing, and follows it on Discard", async () => {
  const { router, screen } = await renderNotes("browser");
  const dialog = await openWithInput(screen);

  router.history.back();
  await expect.element(discardQuestion()).toBeVisible();
  await discardQuestion().getByRole("button", { name: "Keep editing" }).click();
  await expect.element(discardQuestion()).not.toBeInTheDocument();
  await expect.poll(() => window.location.hash).toBe("#/notes");
  await nextFrames();
  expect(router.state.location.pathname).toBe("/notes");
  await expect
    .element(dialog.getByRole("textbox", { name: "Note" }))
    .toHaveValue("Fictional note");

  router.history.back();
  await discardQuestion()
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await expect
    .element(screen.getByRole("heading", { name: "Other" }))
    .toBeVisible();
  expect(window.location.hash).toBe("#/other");
});

test("asks before Forward discards the input, restores the URL on Keep editing, and follows it on Discard", async () => {
  const { router, screen } = await renderNotes("browser");
  // Notes, then Other, then back to Notes, with Other forward of it.
  router.history.push("/other");
  await expect
    .element(screen.getByRole("heading", { name: "Other" }))
    .toBeVisible();
  router.history.back();
  await expect
    .element(screen.getByRole("heading", { name: "Notes" }))
    .toBeVisible();
  const dialog = await openWithInput(screen);

  router.history.forward();
  await expect.element(discardQuestion()).toBeVisible();
  await discardQuestion().getByRole("button", { name: "Keep editing" }).click();
  await expect.element(discardQuestion()).not.toBeInTheDocument();
  await expect.poll(() => window.location.hash).toBe("#/notes");
  await nextFrames();
  expect(router.state.location.pathname).toBe("/notes");
  await expect
    .element(dialog.getByRole("textbox", { name: "Note" }))
    .toHaveValue("Fictional note");

  router.history.forward();
  await discardQuestion()
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await expect
    .element(screen.getByRole("heading", { name: "Other" }))
    .toBeVisible();
  expect(window.location.hash).toBe("#/other");
});

test("asks before a navigation that stays on the screen, and closes the dialog on Discard, asking nothing before the redirect that follows", async () => {
  const { router, screen } = await renderNotes();
  const dialog = await openWithInput(screen);

  router.history.push("/notes?view=All");
  await expect.element(discardQuestion()).toBeVisible();
  await discardQuestion()
    .getByRole("button", { name: "Discard", exact: true })
    .click();

  await expect.element(dialog).not.toBeInTheDocument();
  expect(discardQuestion().query()).toBeNull();
  await expect
    .poll(() => router.state.location.search)
    .toEqual({
      view: "all",
    });
  await expect
    .element(screen.getByRole("heading", { name: "Notes" }))
    .toBeVisible();
});

test("leaves the browser's own prompt before unloading the page only while the dialog holds input", async () => {
  const { screen } = await renderNotes("browser");
  expect(unload()).toBe(false);
  await screen.getByRole("button", { name: "Add note" }).click();
  const dialog = screen.getByRole("dialog", { name: "Add note" });
  await expect.element(dialog).toBeVisible();
  expect(unload()).toBe(false);

  await dialog.getByRole("textbox", { name: "Note" }).fill("Fictional note");
  await nextFrames();
  expect(unload()).toBe(true);

  await dialog.getByRole("textbox", { name: "Note" }).fill("");
  await nextFrames();
  expect(unload()).toBe(false);
});

test("asks nothing while a change is in progress, whose input counts as submitted, and keeps the dialog", async () => {
  const { router, screen } = await renderNotes();
  const dialog = await openWithInput(screen);
  await dialog.getByRole("button", { name: "Start a change" }).click();
  await nextFrames();

  router.history.push("/notes?view=all");
  await expect
    .poll(() => router.state.location.search)
    .toEqual({ view: "all" });
  await nextFrames();
  expect(discardQuestion().query()).toBeNull();
  await expect.element(dialog).toBeVisible();

  router.history.push("/other");
  await expect
    .element(screen.getByRole("heading", { name: "Other" }))
    .toBeVisible();
});

test("drops a navigation of the UI that waits for the question when the session forces another", async () => {
  const { router, screen } = await renderNotes();
  await openWithInput(screen);

  router.history.push("/notes?view=all");
  await expect.element(discardQuestion()).toBeVisible();
  router.history.replace("/sign-in", undefined, { ignoreBlocker: true });

  await expect
    .element(screen.getByRole("heading", { name: "Sign in" }))
    .toBeVisible();
  await expect.element(discardQuestion()).not.toBeInTheDocument();
  await nextFrames();
  expect(router.state.location.pathname).toBe("/sign-in");
});

test("asks nothing before a navigation that the screen to which the session leads makes at once, once the dialog has left the page", async () => {
  const { router, screen } = await renderNotes();
  await openWithInput(screen);

  router.history.replace("/start", undefined, { ignoreBlocker: true });

  await expect
    .element(screen.getByRole("heading", { name: "Other" }))
    .toBeVisible();
  expect(discardQuestion().query()).toBeNull();
});

test("keeps the entry that Back reached when the session forces a navigation while the question waits", async () => {
  const { router, screen } = await renderNotes("browser");
  await openWithInput(screen);

  router.history.back();
  await expect.element(discardQuestion()).toBeVisible();
  router.history.replace("/sign-in", undefined, { ignoreBlocker: true });

  await expect
    .element(screen.getByRole("heading", { name: "Sign in" }))
    .toBeVisible();
  await expect.element(discardQuestion()).not.toBeInTheDocument();
  await nextFrames();
  expect(router.state.location.pathname).toBe("/sign-in");
  expect(window.location.hash).toBe("#/sign-in");
});
