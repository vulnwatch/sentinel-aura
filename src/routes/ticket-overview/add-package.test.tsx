import { Plus } from "lucide-react";
import { describe, expect, test, vi } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../../styles.css";
import type {
  CurrentUserResponse,
  PackageDetail,
  TicketDetail,
} from "../../api/generated/model";
import { SEARCH_DELAY_MS } from "../../components/search-combobox";
import {
  errorResponse,
  FICTIONAL_USER,
  fictionalPackage,
  fictionalProduct,
  fictionalTicketDetail,
  fictionalTrack,
  jsonResponse,
  OTHER_USER,
  requestsTo,
  stubApi,
  ticketResponse,
  urlOf,
  validationError,
} from "../../test-api";
import { pointerAwayFrom } from "../../test-pointer";
import {
  ACTORS,
  ADD_PACKAGE,
  backgroundBehind,
  boxOf,
  client,
  EVENTS,
  excludedPackage,
  expectFocusOnError,
  expectFocusSettledOn,
  frames,
  later,
  leaveForTickets,
  leftInvalidated,
  MAINTAINED_PACKAGES,
  maintainedPackagesPage,
  MAINTAINER,
  MESSAGE_CONFLICT,
  MESSAGE_INVALID,
  MESSAGE_NOT_ACCEPTED,
  MESSAGE_TONES,
  MESSAGE_UNAVAILABLE,
  MESSAGE_UNCONFIRMED,
  nextFrames,
  NOT_APPLICABLE,
  packageAdditionResponse,
  packagesPart,
  prepareEachTest,
  readEnded,
  readsOf,
  REFERENCE,
  renderTree,
  requestsWith,
  returnToForeground,
  type Screen,
  screenHeading,
  showHidden,
  type Stub,
  stubTicket,
  textsOf,
  TICKET,
  TICKETS,
  YOUR_WORK,
} from "./test-support";

// Add package in the package tree of Overview, the first tab of the Ticket
// screen (src/routes/ticket-overview/add-package.tsx;
// src/routes/ticket-overview/packages.tsx), at the browser's default text
// size, in the light theme.

prepareEachTest();

// An analyst who holds manage_packages and maintains no package.
const PACKAGE_MANAGER: CurrentUserResponse = {
  data: {
    ...OTHER_USER.data,
    capabilities: ["manage_packages", "triage_ticket"],
  },
};

// An administrator, who holds admin_ticket_ops alone of the capabilities of
// the package tree.
const TICKET_ADMIN: CurrentUserResponse = {
  data: {
    ...FICTIONAL_USER.data,
    roles: ["admin"],
    capabilities: ["admin_ticket_ops"],
  },
};

// What the name field says that it takes.
const DESCRIPTION =
  "The source package as SMELT names it, such as fictional-openssl. Type part of it to find it.";

const MESSAGE_PATTERN =
  "Enter only letters, digits, and . _ + -, starting with a letter or a digit.";
const MESSAGE_INTERNAL =
  "Something went wrong in Sentinel. Try again, and if it happens again, report it with the reference below.";
const MESSAGE_FORBIDDEN = "You don't have permission to do this.";
const MESSAGE_NOT_IN_SMELT =
  "SMELT doesn't maintain a package of this name. Check the name, whose letter case counts.";
const MESSAGE_SMELT_UNAVAILABLE =
  "Sentinel couldn't get the tracks and Products of this package from SMELT, so it added nothing. Try again later.";

// The colors of a primary and a secondary button in the light theme
// (docs/design-system.md, Buttons and Links): accent, and surface.
const ACCENT = "rgb(9, 105, 218)";
const SURFACE = "rgb(255, 255, 255)";

// The outcome of the default addition (packageAdditionResponse).
const ADDED = "Package fictional-openssl: 3 tracks and 7 Products added.";

// fictional-openssl as a Ticket read after its addition shows it while none
// of its Products is actionable, as at the end of its life: hidden.
function hiddenOpenssl(): PackageDetail {
  return fictionalPackage({
    actionable: false,
    non_actionable_reason: "no_actionable_tracks",
    tracks: [
      fictionalTrack({
        status: "analysis",
        actionable: false,
        non_actionable_reason: "no_actionable_products",
        products: [
          fictionalProduct({
            lifecycle_phase: "eol",
            actionable: false,
            non_actionable_reason: "eol",
          }),
        ],
        ...NOT_APPLICABLE,
      }),
    ],
  });
}

// Answers for a user who holds manage_packages unless the test says
// otherwise, with SNTL-12 holding fictional-openssl, or the fields that the
// test sets.
function showingAddable(
  stub: Partial<Stub> = {},
  ticket: Partial<TicketDetail> = {},
) {
  return stubTicket({
    user: PACKAGE_MANAGER,
    ticket: () =>
      ticketResponse(
        fictionalTicketDetail({ packages: [fictionalPackage()], ...ticket }),
      ),
    ...stub,
  });
}

// Answers Get Ticket with the package tree that the function returns at each
// read, for a user who holds manage_packages, and Add Package to Ticket with
// the response.
function showingTree(
  tree: () => PackageDetail[],
  addPackage: Stub["addPackage"] = () => packageAdditionResponse(),
) {
  return stubTicket({
    user: PACKAGE_MANAGER,
    ticket: () => ticketResponse(fictionalTicketDetail({ packages: tree() })),
    addPackage,
  });
}

function addButton(screen: Screen) {
  return packagesPart(screen).getByRole("button", {
    name: "Add package",
    exact: true,
  });
}

// The part and its Add package while a dialog keeps them out of reach of
// assistive technologies.
function addButtonBehindDialog(screen: Screen) {
  return screen
    .getByRole("region", { name: "Packages", exact: true, includeHidden: true })
    .getByRole("button", {
      name: "Add package",
      exact: true,
      includeHidden: true,
    });
}

function addDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Add package", exact: true });
}

function discardDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Discard changes?" });
}

function nameField(dialog: Locator) {
  return dialog.getByRole("combobox", { name: "Package name", exact: true });
}

function submitButton(dialog: Locator) {
  return dialog.getByRole("button", { name: "Add package", exact: true });
}

function cancelButton(dialog: Locator) {
  return dialog.getByRole("button", { name: "Cancel", exact: true });
}

function option(screen: Screen, name: string) {
  return screen.getByRole("option", { name, exact: true });
}

// Opens Add package and waits until its field has the focus.
async function openAdd(screen: Screen) {
  await addButton(screen).click();
  const dialog = addDialog(screen);
  await expect.element(nameField(dialog)).toHaveFocus();
  return dialog;
}

// Submits the form from the keyboard, from its field: Tab leaves the field
// for Cancel, which closes the menu of the field, which keeps the rest of the
// dialog from assistive technologies while it is open, and then for Add
// package.
async function submitFromField(dialog: Locator) {
  await expect.element(nameField(dialog)).toHaveFocus();
  await userEvent.keyboard("{Tab}");
  await expect.element(cancelButton(dialog)).toHaveFocus();
  await userEvent.keyboard("{Tab}");
  await expect.element(submitButton(dialog)).toHaveFocus();
  await userEvent.keyboard("{Enter}");
}

// Opens Add package, types the name, and submits it.
async function addName(screen: Screen, name: string) {
  const dialog = await openAdd(screen);
  await nameField(dialog).fill(name);
  await submitFromField(dialog);
  return dialog;
}

// Waits until the message area shows the text as a success message, outside
// the part, rather than only announcing it.
async function expectSuccessMessage(screen: Screen, text: string) {
  const message = screen.getByText(text, { exact: true });
  await expect.element(message).toBeVisible();
  expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
  expect(packagesPart(screen).element().contains(message.element())).toBe(
    false,
  );
}

// The response of a search of the maintained packages among two names that
// differ in letter case alone: those that contain its term without regard to
// letter case, as Sentinel matches them.
function imageToolNames(query: URLSearchParams): Response {
  const term = (query.get("search") ?? "").toLowerCase();
  return maintainedPackagesPage(
    ["Fictional-ImageTool", "fictional-imagetool"].filter((name) =>
      name.toLowerCase().includes(term),
    ),
  );
}

// The bodies of the requests of Add Package to Ticket.
function additions(spy: ReturnType<typeof stubApi>): unknown[] {
  return requestsWith(spy, "POST")
    .filter(([input]) => urlOf(input).pathname === ADD_PACKAGE)
    .map(([, init]) =>
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    );
}

// The queries of the searches of the maintained packages.
function searches(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname === MAINTAINED_PACKAGES)
    .map((url) => url.search);
}

describe("Add package", () => {
  test("is a secondary button with plus at the end of the line of the heading, after Show hidden, for a user who holds manage_packages", async () => {
    showingAddable();
    const { screen } = await renderTree();

    const button = addButton(screen);
    await expect.element(button).toBeVisible();
    const toggle = showHidden(screen).element();
    expect(
      toggle.compareDocumentPosition(button.element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const label = toggle.closest("label");
    expect(label).not.toBeNull();
    expect(boxOf(label!).right).toBeLessThan(boxOf(button).left);
    expect(boxOf(button).right).toBeCloseTo(
      boxOf(packagesPart(screen)).right,
      0,
    );
    const heading = packagesPart(screen).getByRole("heading", { level: 2 });
    expect(boxOf(button).top).toBeLessThan(boxOf(heading).bottom);
    // The pointer away from the button, where an earlier test can leave it.
    await pointerAwayFrom(button);
    const style = getComputedStyle(button.element());
    expect([style.backgroundColor, style.borderTopWidth]).toEqual([
      SURFACE,
      "1px",
    ]);
    const plus = await render(<Plus />);
    expect(button.element().querySelector("svg")?.innerHTML).toBe(
      plus.container.querySelector("svg")?.innerHTML,
    );
  });

  test.each(["new", "analysis", "analyzed", "resolved"] as const)(
    "is offered on a Ticket in %s",
    async (status) => {
      showingAddable({}, { status });
      const { screen } = await renderTree();

      await expect.element(addButton(screen)).toBeVisible();
    },
  );

  test("is offered on a Ticket without packages, which says No packages. without the switch", async () => {
    showingAddable({}, { packages: [] });
    const { screen } = await renderTree();

    await expect.element(addButton(screen)).toBeVisible();
    await expect
      .element(packagesPart(screen).getByText("No packages.", { exact: true }))
      .toBeVisible();
    expect(showHidden(screen).query()).toBeNull();
  });

  test.each([
    ["without manage_packages", OTHER_USER],
    ["with admin_ticket_ops alone", TICKET_ADMIN],
  ])("is not offered to a user %s", async (_, user) => {
    showingAddable({ user });
    const { screen } = await renderTree();

    // The switch shows with the tree, as Add package would.
    await expect.element(showHidden(screen)).toBeVisible();
    expect(addButton(screen).query()).toBeNull();
  });

  test.each(["ignored", "duplicated", "fictional_status"])(
    "is not offered on a Ticket in %s",
    async (status) => {
      stubTicket({
        user: PACKAGE_MANAGER,
        ticket: () =>
          jsonResponse(200, {
            data: {
              ...fictionalTicketDetail({ packages: [fictionalPackage()] }),
              status,
            },
          }),
      });
      const { screen } = await renderTree();

      await expect.element(showHidden(screen)).toBeVisible();
      expect(addButton(screen).query()).toBeNull();
    },
  );

  test("goes after a read of the signed-in user takes manage_packages away while its dialog stays open with its form, and the focus moves to the screen's heading once the dialog closes", async () => {
    let user = PACKAGE_MANAGER;
    showingAddable({ user: () => user });
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);
    await nameField(dialog).fill("fictional-openssl");
    user = OTHER_USER;

    await returnToForeground();

    // The menu of the actions of the package goes with manage_packages.
    await expect
      .element(
        screen
          .getByRole("region", {
            name: "Packages",
            exact: true,
            includeHidden: true,
          })
          .getByRole("button", {
            name: "Actions of fictional-openssl",
            includeHidden: true,
          }),
      )
      .not.toBeInTheDocument();
    expect(addButtonBehindDialog(screen).query()).toBeNull();
    await expect.element(dialog).toBeVisible();
    await expect.element(nameField(dialog)).toHaveValue("fictional-openssl");

    // Tab closes the menu of the field, which keeps the buttons from
    // assistive technologies while it is open.
    await userEvent.keyboard("{Tab}");
    await expect.element(submitButton(dialog)).toBeVisible();
    await cancelButton(dialog).click();
    await discardDialog(screen)
      .getByRole("button", { name: "Discard", exact: true })
      .click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });
});

describe("the dialog of Add package", () => {
  test("opens a form with Package name, a combobox that takes the focus and says what it takes, then Cancel and Add package, a primary button", async () => {
    showingAddable();
    const { screen } = await renderTree();

    const dialog = await openAdd(screen);

    const field = nameField(dialog);
    await expect.element(field).toHaveValue("");
    await expect.element(field).toHaveAccessibleDescription(DESCRIPTION);
    expect(dialog.getByRole("combobox").elements()).toHaveLength(1);
    expect(dialog.getByRole("textbox").elements()).toHaveLength(0);
    expect(textsOf(dialog.getByRole("button"))).toEqual([
      "Cancel",
      "Add package",
    ]);
    await pointerAwayFrom(submitButton(dialog));
    expect(
      getComputedStyle(submitButton(dialog).element()).backgroundColor,
    ).toBe(ACCENT);
  });

  test.each([
    ["an empty name", "", "Enter the package name."],
    ["a name of whitespace alone", "   ", "Enter the package name."],
    [
      "a name longer than 255 characters",
      "a".repeat(256),
      "Enter at most 255 characters.",
    ],
    ["a name that starts with a hyphen", "-openssl", MESSAGE_PATTERN],
    ["a name with a space", "open ssl", MESSAGE_PATTERN],
    ["a name with a letter outside ASCII", "café", MESSAGE_PATTERN],
  ])(
    "states the error of %s at Package name, which takes the focus, without a request",
    async (_, name, message) => {
      const spy = showingAddable();
      const { screen } = await renderTree();
      const dialog = await openAdd(screen);
      if (name !== "") {
        await nameField(dialog).fill(name);
      }

      await submitFromField(dialog);

      const field = nameField(dialog);
      await expect
        .element(field)
        .toHaveAccessibleDescription(`${DESCRIPTION} ${message}`);
      await expect.element(field).toBeInvalid();
      await expect.element(field).toHaveFocus();
      await expect.element(field).toHaveValue(name);
      expect(additions(spy)).toHaveLength(0);
    },
  );

  test.each([
    ["a name of 1 character", "a", "a"],
    ["a name that ends with plus signs", "libxml++", "libxml++"],
    [
      "a name of 255 characters within surrounding whitespace",
      ` ${"a".repeat(255)} `,
      "a".repeat(255),
    ],
    [
      "a name with surrounding whitespace",
      "  fictional-openssl  ",
      "fictional-openssl",
    ],
  ])(
    "sends %s with Add Package to Ticket, without its surrounding whitespace",
    async (_, name, sent) => {
      const spy = showingAddable();
      const { screen } = await renderTree();

      const dialog = await addName(screen, name);

      await expect.element(dialog).not.toBeInTheDocument();
      expect(additions(spy)).toEqual([{ package_name: sent }]);
    },
  );

  test("announces the error of a check after Enter in the field in a status region that was there before it, while the field keeps the focus", async () => {
    showingAddable();
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);
    const statuses = dialog.getByRole("status").elements();

    await userEvent.keyboard("{Enter}");

    const field = nameField(dialog);
    await expect
      .element(field)
      .toHaveAccessibleDescription(`${DESCRIPTION} Enter the package name.`);
    await expect.element(field).toHaveFocus();
    const error = dialog
      .getByText("Enter the package name.", { exact: true })
      .element();
    expect(statuses.some((status) => status.contains(error))).toBe(true);
  });

  test("submits the form with Enter in the field once its menu is closed, the field keeping the focus while the addition is in progress, and sends one request", async () => {
    const response = later();
    const spy = showingAddable({
      maintainedPackages: () =>
        maintainedPackagesPage(["fictional-openssl", "fictional-openssl-3"]),
      addPackage: () => response.promise,
    });
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);
    const field = nameField(dialog);
    await field.fill("fictional-openssl");
    await expect.element(option(screen, "fictional-openssl")).toBeVisible();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect.element(field).toHaveAttribute("aria-expanded", "false");
    expect(additions(spy)).toHaveLength(0);

    await userEvent.keyboard("{Enter}");

    await expect
      .element(submitButton(dialog))
      .toHaveAttribute("aria-disabled", "true");
    expect(additions(spy)).toEqual([{ package_name: "fictional-openssl" }]);
    await nextFrames();
    expect(document.activeElement).toBe(field.element());
    // Enter in the field again while the addition is in progress.
    await userEvent.keyboard("{Enter}");
    await nextFrames();
    expect(additions(spy)).toHaveLength(1);

    response.resolve(packageAdditionResponse());

    await expect.element(dialog).not.toBeInTheDocument();
  });

  test("closes the menu with Enter in the field while the arrow keys made no option current, keeping the text and sending nothing", async () => {
    const spy = showingAddable({ maintainedPackages: imageToolNames });
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);
    const field = nameField(dialog);
    await field.fill("imagetool");
    await expect.element(option(screen, "Fictional-ImageTool")).toBeVisible();

    await userEvent.keyboard("{Enter}");

    await expect.element(field).toHaveAttribute("aria-expanded", "false");
    await expect.element(screen.getByRole("listbox")).not.toBeInTheDocument();
    await nextFrames();
    await expect.element(field).toHaveValue("imagetool");
    await expect.element(field).not.toBeInvalid();
    await expect.element(dialog).toBeVisible();
    expect(additions(spy)).toHaveLength(0);
  });

  test("takes the error of a check away once the name changes", async () => {
    showingAddable();
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);
    await submitFromField(dialog);
    const field = nameField(dialog);
    await expect.element(field).toBeInvalid();
    await expect.element(field).toHaveFocus();

    await userEvent.keyboard("f");

    await expect.element(field).not.toBeInvalid();
    await expect.element(field).toHaveAccessibleDescription(DESCRIPTION);
  });
});

describe("the suggestions of Package name", () => {
  test.each([
    ["1 character", "a"],
    ["1 character within surrounding whitespace", " a "],
    // One character outside the Basic Multilingual Plane, two units of a
    // string of JavaScript.
    ["1 character outside the Basic Multilingual Plane", "\u{1F600}"],
  ])("are not read for %s, and no menu opens", async (_, name) => {
    const spy = showingAddable();
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    // The clock of the pause, which the test moves past its end itself.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    await nameField(dialog).fill(name);
    vi.advanceTimersByTime(SEARCH_DELAY_MS);
    vi.useRealTimers();

    await expect.element(nameField(dialog)).toHaveValue(name);
    await nextFrames();
    expect(requestsTo(spy, MAINTAINED_PACKAGES)).toBe(0);
    expect(screen.getByRole("listbox").query()).toBeNull();
  });

  test("are read once the user stops typing, with the term without its surrounding whitespace, and listed in the order of the response", async () => {
    const spy = showingAddable({
      maintainedPackages: () =>
        maintainedPackagesPage([
          "fictional-openssl",
          "fictional-openssh",
          "compat-fictional-openssl",
        ]),
    });
    const { screen } = await renderTree();
    await openAdd(screen);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    // The clock of the pause, which the test moves itself, so that the time
    // between two inputs does not depend on the speed of the browser. The
    // keyboard types without moving it.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    await userEvent.keyboard(" op");
    vi.advanceTimersByTime(SEARCH_DELAY_MS - 1);
    await userEvent.keyboard("en ");
    vi.advanceTimersByTime(SEARCH_DELAY_MS - 1);
    await nextFrames();
    expect(requestsTo(spy, MAINTAINED_PACKAGES)).toBe(0);
    vi.advanceTimersByTime(1);
    vi.useRealTimers();

    await expect.element(option(screen, "fictional-openssl")).toBeVisible();
    expect(textsOf(screen.getByRole("option"))).toEqual([
      "fictional-openssl",
      "fictional-openssh",
      "compat-fictional-openssl",
    ]);
    expect(searches(spy)).toEqual(["?search=open&per_page=20"]);
  });

  test("write the name chosen in the field with its letter case, which Add package sends", async () => {
    const spy = showingAddable({
      maintainedPackages: () =>
        maintainedPackagesPage(["Fictional-ImageTool", "fictional-imagetool"]),
    });
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);
    await nameField(dialog).fill("imagetool");

    await option(screen, "Fictional-ImageTool").click();

    await expect.element(nameField(dialog)).toHaveValue("Fictional-ImageTool");
    await submitFromField(dialog);
    await expect.element(dialog).not.toBeInTheDocument();
    expect(additions(spy)).toEqual([{ package_name: "Fictional-ImageTool" }]);
  });

  test("stay open for a term that equals a maintained name once they arrive, listed in the order of the response, and write the one chosen in the field", async () => {
    showingAddable({
      maintainedPackages: () =>
        maintainedPackagesPage([
          "fictional-openssl",
          "fictional-openssl-3",
          "libfictional-openssl",
        ]),
    });
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);

    await nameField(dialog).fill("fictional-openssl");

    await expect.element(option(screen, "fictional-openssl-3")).toBeVisible();
    // The render that brings the names and its effects, in which the menu
    // would close, have passed.
    await nextFrames();
    expect(nameField(dialog).element().getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(textsOf(screen.getByRole("option"))).toEqual([
      "fictional-openssl",
      "fictional-openssl-3",
      "libfictional-openssl",
    ]);
    await option(screen, "fictional-openssl-3").click();
    await expect.element(nameField(dialog)).toHaveValue("fictional-openssl-3");
  });

  test.each(["the pointer", "the arrow keys and Enter"])(
    "close once the user chooses one with %s, and stay closed once the names of the term of the name chosen have arrived",
    async (way) => {
      const spy = showingAddable({ maintainedPackages: imageToolNames });
      const { screen } = await renderTree();
      const dialog = await openAdd(screen);
      const field = nameField(dialog);
      await field.fill("imagetool");
      await expect.element(option(screen, "Fictional-ImageTool")).toBeVisible();

      if (way === "the pointer") {
        await option(screen, "Fictional-ImageTool").click();
      } else {
        await userEvent.keyboard("{ArrowDown}{Enter}");
      }

      await expect.element(field).toHaveValue("Fictional-ImageTool");
      await expect.element(field).toHaveAttribute("aria-expanded", "false");
      await expect.element(screen.getByRole("listbox")).not.toBeInTheDocument();
      // The name chosen is the term of a read of its own, whose names hold it.
      await expect
        .poll(() => searches(spy))
        .toContain("?search=Fictional-ImageTool&per_page=20");
      await readEnded(MAINTAINED_PACKAGES);
      await nextFrames();
      expect(field.element().getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByRole("listbox").query()).toBeNull();
      await expect.element(field).toHaveValue("Fictional-ImageTool");
    },
  );

  test("open again for the terms that the user types after choosing one, also one equal to the name chosen", async () => {
    showingAddable({ maintainedPackages: imageToolNames });
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);
    const field = nameField(dialog);
    await field.fill("imagetool");
    await option(screen, "Fictional-ImageTool").click();
    await expect.element(field).toHaveAttribute("aria-expanded", "false");

    await userEvent.keyboard("x");

    await expect.element(field).toHaveValue("Fictional-ImageToolx");
    await expect
      .element(
        screen.getByText("Sentinel knows no maintained package that matches.", {
          exact: true,
        }),
      )
      .toBeVisible();
    await nextFrames();
    expect(field.element().getAttribute("aria-expanded")).toBe("true");

    // The text equals the name chosen again, which the user no longer holds
    // as chosen.
    await userEvent.keyboard("{Backspace}");

    await expect.element(field).toHaveValue("Fictional-ImageTool");
    await expect.element(option(screen, "fictional-imagetool")).toBeVisible();
    await readEnded(MAINTAINED_PACKAGES);
    await nextFrames();
    expect(field.element().getAttribute("aria-expanded")).toBe("true");
    expect(textsOf(screen.getByRole("option"))).toEqual([
      "Fictional-ImageTool",
      "fictional-imagetool",
    ]);
  });

  test("say that no maintained package matches", async () => {
    showingAddable();
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);

    await nameField(dialog).fill("fictional-none");

    await expect
      .element(
        screen.getByText("Sentinel knows no maintained package that matches.", {
          exact: true,
        }),
      )
      .toBeVisible();
    expect(screen.getByRole("option").elements()).toHaveLength(0);
  });

  test.each([
    [
      "none matches",
      () => maintainedPackagesPage([]),
      "Sentinel knows no maintained package that matches.",
    ],
    [
      "their read fails",
      () => errorResponse(500, "INTERNAL_ERROR"),
      MESSAGE_INTERNAL,
    ],
  ])(
    "leave no option in the menu while it shows only its line, when %s",
    async (_, response, line) => {
      showingAddable({ maintainedPackages: response });
      const { screen } = await renderTree();
      const dialog = await openAdd(screen);

      await nameField(dialog).fill("fictional-none");

      await expect
        .element(screen.getByText(line, { exact: true }))
        .toBeVisible();
      await nextFrames();
      const listbox = screen.getByRole("listbox");
      await expect.element(listbox).toBeInTheDocument();
      expect(
        listbox.getByRole("option", { includeHidden: true }).elements(),
      ).toHaveLength(0);
    },
  );

  test("say how many packages match when more match than they list", async () => {
    const names = Array.from(
      { length: 20 },
      (_, index) => `fictional-lib${String(index + 1).padStart(2, "0")}`,
    );
    showingAddable({
      maintainedPackages: () => maintainedPackagesPage(names, { total: 63 }),
    });
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);

    await nameField(dialog).fill("lib");

    await expect.element(option(screen, "fictional-lib01")).toBeVisible();
    expect(screen.getByRole("option").elements()).toHaveLength(20);
    await expect
      .element(
        screen.getByText(
          "The first 20 of 63 packages that match. Type more to narrow them.",
          { exact: true },
        ),
      )
      .toBeVisible();
  });

  test("say nothing of a count when they list every package that matches", async () => {
    showingAddable({
      maintainedPackages: () => maintainedPackagesPage(["fictional-openssl"]),
    });
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);

    await nameField(dialog).fill("openssl");

    await expect.element(option(screen, "fictional-openssl")).toBeVisible();
    await nextFrames();
    expect(screen.getByText(/packages that match/).query()).toBeNull();
    expect(
      screen
        .getByText("Sentinel knows no maintained package that matches.")
        .query(),
    ).toBeNull();
  });

  test("show the loading indicator while they load", async () => {
    const response = later();
    const spy = showingAddable({ maintainedPackages: () => response.promise });
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);

    await nameField(dialog).fill("openssl");

    await expect.poll(() => requestsTo(spy, MAINTAINED_PACKAGES)).toBe(1);
    const loading = screen.getByRole("progressbar", { name: "Loading" });
    await expect.element(loading).toBeVisible();
    response.resolve(maintainedPackagesPage(["fictional-openssl"]));
    await expect.element(option(screen, "fictional-openssl")).toBeVisible();
    expect(loading.query()).toBeNull();
  });

  test.each([
    ["500", () => errorResponse(500, "INTERNAL_ERROR"), MESSAGE_INTERNAL],
    [
      "a status and a code that the pinned contract does not list",
      () => errorResponse(503, "FICTIONAL_UNAVAILABLE"),
      MESSAGE_UNAVAILABLE,
    ],
  ])(
    "say in the menu the message of the failure of their read after %s, and the name typed can still be added",
    async (_, failure, message) => {
      const spy = showingAddable({ maintainedPackages: failure });
      const { screen } = await renderTree();
      const dialog = await openAdd(screen);

      await nameField(dialog).fill("fictional-zlib");

      await expect
        .element(screen.getByText(message, { exact: true }))
        .toBeVisible();
      expect(screen.getByRole("listbox").element().textContent).toBe("");
      await submitFromField(dialog);
      await expect.element(dialog).not.toBeInTheDocument();
      expect(additions(spy)).toEqual([{ package_name: "fictional-zlib" }]);
    },
  );

  test("leave a name that no suggestion holds to be added as typed", async () => {
    const spy = showingAddable({
      maintainedPackages: () => maintainedPackagesPage(["fictional-zlib-ng"]),
    });
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);
    await nameField(dialog).fill("fictional-zlib");
    await expect.element(option(screen, "fictional-zlib-ng")).toBeVisible();

    await submitFromField(dialog);

    await expect.element(dialog).not.toBeInTheDocument();
    expect(additions(spy)).toEqual([{ package_name: "fictional-zlib" }]);
  });
});

describe("a failure of Add package", () => {
  test.each([
    [
      "422 PACKAGE_NOT_FOUND_IN_SMELT",
      () => errorResponse(422, "PACKAGE_NOT_FOUND_IN_SMELT"),
      MESSAGE_NOT_IN_SMELT,
    ],
    [
      "422 PACKAGE_TARGETS_UNRESOLVED",
      () => errorResponse(422, "PACKAGE_TARGETS_UNRESOLVED"),
      "Sentinel found no Product that it tracks among those that SMELT lists for this package, so it added nothing.",
    ],
    [
      "409 PACKAGE_ALREADY_EXCLUDED",
      () => errorResponse(409, "PACKAGE_ALREADY_EXCLUDED"),
      "This package is excluded from this Ticket: Show hidden shows it, and Restore in the menu of its actions includes it again.",
    ],
    [
      "a field error of the name",
      () => validationError([["body", "package_name"]]),
      MESSAGE_INVALID,
    ],
  ])(
    "shows %s at Package name, which takes the focus and keeps the name, until the name changes",
    async (_, failure, message) => {
      const spy = showingAddable({ addPackage: failure });
      const { screen } = await renderTree();
      const reads = requestsTo(spy, TICKET);

      const dialog = await addName(screen, "fictional-openssl");

      const field = nameField(dialog);
      await expect
        .element(field)
        .toHaveAccessibleDescription(`${DESCRIPTION} ${message}`);
      await expect.element(field).toBeInvalid();
      await expect.element(field).toHaveFocus();
      await expect.element(field).toHaveValue("fictional-openssl");
      // The message shows at the field alone.
      expect(dialog.getByText(message).elements()).toHaveLength(1);
      // Whatever its outcome, the screen reads again what it affects.
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);

      await userEvent.keyboard("-3");

      await expect.element(field).not.toBeInvalid();
      await expect.element(field).toHaveAccessibleDescription(DESCRIPTION);
    },
  );

  test.each<
    [
      string,
      () => Response | Promise<Response>,
      string,
      keyof typeof MESSAGE_TONES,
      boolean,
    ]
  >([
    [
      "503 SMELT_UNAVAILABLE, as an error with its reference",
      () => errorResponse(503, "SMELT_UNAVAILABLE"),
      MESSAGE_SMELT_UNAVAILABLE,
      "danger",
      true,
    ],
    [
      "503 PRODUCT_CATALOG_NOT_READY, as an error with its reference",
      () => errorResponse(503, "PRODUCT_CATALOG_NOT_READY"),
      "Sentinel hasn't loaded the Products from SMELT yet, so it added nothing. Try again later.",
      "danger",
      true,
    ],
    [
      "409 TICKET_NOT_MUTABLE, as an error",
      () => errorResponse(409, "TICKET_NOT_MUTABLE"),
      MESSAGE_CONFLICT,
      "danger",
      false,
    ],
    [
      "a 503 with a code that the pinned contract does not list, as a warning with its reference",
      () => errorResponse(503, "FICTIONAL_UNAVAILABLE"),
      MESSAGE_UNCONFIRMED,
      "warning",
      true,
    ],
    [
      "a 502 of a proxy, without a code, as a warning",
      () => new Response("Bad Gateway", { status: 502 }),
      MESSAGE_UNCONFIRMED,
      "warning",
      false,
    ],
    [
      "a network failure, as a warning",
      () => Promise.reject(new TypeError("Failed to fetch")),
      MESSAGE_UNCONFIRMED,
      "warning",
      false,
    ],
    [
      "403, as an error",
      () => errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION"),
      MESSAGE_FORBIDDEN,
      "danger",
      false,
    ],
    [
      "a 422 with a code that the pinned contract does not list, as an error",
      () => errorResponse(422, "FICTIONAL_CODE"),
      MESSAGE_NOT_ACCEPTED,
      "danger",
      false,
    ],
    [
      "a VALIDATION_ERROR of no field, as an error",
      () => validationError([["body"]]),
      MESSAGE_NOT_ACCEPTED,
      "danger",
      false,
    ],
    [
      "a status and a code that the pinned contract does not list, as an error",
      () => errorResponse(418, "FICTIONAL_CODE"),
      MESSAGE_NOT_ACCEPTED,
      "danger",
      false,
    ],
  ])(
    "shows %s at the top of the form, which takes the focus and keeps the name",
    async (_, failure, message, tone, referenced) => {
      const spy = showingAddable({ addPackage: failure });
      const { screen } = await renderTree();
      const reads = requestsTo(spy, TICKET);

      const dialog = await addName(screen, "fictional-openssl");

      const error = dialog.getByText(message, { exact: true });
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES[tone]);
      await expectFocusOnError(error);
      expect(boxOf(error).bottom).toBeLessThan(boxOf(nameField(dialog)).top);
      if (referenced) {
        await expect
          .element(dialog.getByText(REFERENCE, { exact: true }))
          .toBeVisible();
      } else {
        expect(dialog.getByText(/^Reference:/).query()).toBeNull();
      }
      const field = nameField(dialog);
      await expect.element(field).toHaveValue("fictional-openssl");
      await expect.element(field).not.toBeInvalid();
      // Whatever its outcome, the screen reads again what it affects.
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    },
  );

  test("shows the error of the field and of the form for a VALIDATION_ERROR with an error of another member, the form taking the focus", async () => {
    showingAddable({
      addPackage: () =>
        validationError([
          ["body", "package_name"],
          ["body", "fictional_member"],
        ]),
    });
    const { screen } = await renderTree();

    const dialog = await addName(screen, "fictional-openssl");

    const error = dialog.getByText(MESSAGE_NOT_ACCEPTED, { exact: true });
    await expect.element(error).toBeVisible();
    await expect
      .element(nameField(dialog))
      .toHaveAccessibleDescription(`${DESCRIPTION} ${MESSAGE_INVALID}`);
    await expectFocusOnError(error);
  });

  test("is busy while the addition is in progress, with the field still enabled, sends one request, and cannot be closed", async () => {
    const response = later();
    const spy = showingAddable({ addPackage: () => response.promise });
    const { screen } = await renderTree();

    const dialog = await addName(screen, "fictional-openssl");

    await expect
      .element(submitButton(dialog))
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(nameField(dialog)).toBeEnabled();
    await expect.element(cancelButton(dialog)).toBeDisabled();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");
    await nextFrames();
    await expect.element(dialog).toBeVisible();
    expect(discardDialog(screen).query()).toBeNull();
    expect(additions(spy)).toHaveLength(1);

    response.resolve(packageAdditionResponse());

    await expect.element(dialog).not.toBeInTheDocument();
  });
});

describe("leaving Add package", () => {
  test.each(["Cancel", "Escape"])(
    "on %s without a name closes at once, and returns the focus to Add package",
    async (way) => {
      showingAddable();
      const { screen } = await renderTree();
      const dialog = await openAdd(screen);

      if (way === "Escape") {
        await userEvent.keyboard("{Escape}");
      } else {
        await cancelButton(dialog).click();
      }

      await expect.element(dialog).not.toBeInTheDocument();
      expect(discardDialog(screen).query()).toBeNull();
      await expect.element(addButton(screen)).toHaveFocus();
    },
  );

  test.each(["Cancel", "Escape"])(
    "on %s with a name of whitespace alone closes at once, and returns the focus to Add package",
    async (way) => {
      showingAddable();
      const { screen } = await renderTree();
      const dialog = await openAdd(screen);
      await nameField(dialog).fill("   ");

      if (way === "Escape") {
        await userEvent.keyboard("{Escape}");
      } else {
        await cancelButton(dialog).click();
      }

      await expect.element(dialog).not.toBeInTheDocument();
      expect(discardDialog(screen).query()).toBeNull();
      await expect.element(addButton(screen)).toHaveFocus();
    },
  );

  test("asks before Cancel or Escape discard the name typed, keeps it on Keep editing, and closes on Discard", async () => {
    const spy = showingAddable();
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);
    await nameField(dialog).fill("fictional-openssl");
    // Tab closes the menu of the field, which keeps Cancel from assistive
    // technologies while it is open.
    await userEvent.keyboard("{Tab}");

    await cancelButton(dialog).click();

    const discard = discardDialog(screen);
    await expect
      .element(discard.getByRole("button", { name: "Keep editing" }))
      .toHaveFocus();
    await expect
      .element(discard.getByText("The package that you entered isn't added."))
      .toBeVisible();
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect.element(discard).not.toBeInTheDocument();
    await expect.element(dialog).toBeVisible();
    await expect.element(nameField(dialog)).toHaveValue("fictional-openssl");

    // From Cancel, where the focus returned, rather than from the field,
    // whose menu Escape would close first.
    await expect.element(cancelButton(dialog)).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect.element(discard).toBeVisible();
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(addButton(screen)).toHaveFocus();
    expect(additions(spy)).toHaveLength(0);
    // The dialog opens again empty.
    const again = await openAdd(screen);
    await expect.element(nameField(again)).toHaveValue("");
  });

  test("asks before a navigation discards the name typed, and leaves on Discard", async () => {
    showingAddable();
    const { router, screen } = await renderTree();
    const dialog = await openAdd(screen);
    await nameField(dialog).fill("fictional-openssl");

    router.history.push("/tickets");

    const discard = discardDialog(screen);
    await expect.element(discard).toBeVisible();
    expect(router.state.location.pathname).toBe("/tickets/SNTL-12");
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
  });
});

describe("the outcome of Add package", () => {
  test("closes the dialog, returns the focus to Add package, and shows the outcome in the message area once the read of the Ticket after it arrives", async () => {
    const reread = later();
    let added = false;
    showingAddable({
      ticket: () =>
        added
          ? reread.promise
          : ticketResponse(fictionalTicketDetail({ packages: [] })),
      addPackage: () => {
        added = true;
        return packageAdditionResponse();
      },
    });
    const { screen } = await renderTree();
    const message = screen.getByText(ADDED, { exact: true });

    const dialog = await addName(screen, "fictional-openssl");

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(addButton(screen)).toHaveFocus();
    await frames();
    expect(message.query()).toBeNull();
    reread.resolve(
      ticketResponse(fictionalTicketDetail({ packages: [fictionalPackage()] })),
    );

    await expectSuccessMessage(screen, ADDED);
    expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
    await expect
      .element(
        packagesPart(screen).getByRole("heading", {
          level: 3,
          name: "fictional-openssl",
        }),
      )
      .toBeVisible();
  });

  test("shows the outcome with the read of the Ticket that the addition sends, also when that read ends before the answer of the addition has reached the dialog", async () => {
    const reread = later();
    let added = false;
    // The clock of the outcome and of the reads, which the test moves
    // itself. The read after the addition is sent a second after Sentinel
    // confirmed it and ends half a second after it: the order of a read that
    // ends before the request of the addition has returned to the dialog,
    // which the outcome must not wait past.
    let now = 0;
    let confirmed = 0;
    showingAddable({
      ticket: () => {
        if (!added) {
          return ticketResponse(fictionalTicketDetail({ packages: [] }));
        }
        now = confirmed + 1000;
        return reread.promise;
      },
      addPackage: () => {
        added = true;
        return packageAdditionResponse();
      },
    });
    const { screen } = await renderTree();
    const dialog = await openAdd(screen);
    await nameField(dialog).fill("fictional-openssl");
    now = Date.now();
    confirmed = now;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    await submitFromField(dialog);

    await expect.element(dialog).not.toBeInTheDocument();
    now = confirmed + 500;
    reread.resolve(
      ticketResponse(fictionalTicketDetail({ packages: [fictionalPackage()] })),
    );
    await expectSuccessMessage(screen, ADDED);
  });

  test("shows the outcome also when the read of the Ticket after it fails", async () => {
    let added = false;
    showingAddable({
      ticket: () =>
        added
          ? errorResponse(503, "SERVICE_UNAVAILABLE")
          : ticketResponse(fictionalTicketDetail({ packages: [] })),
      addPackage: () => {
        added = true;
        return packageAdditionResponse();
      },
    });
    const { screen } = await renderTree();

    await addName(screen, "fictional-openssl");

    await expectSuccessMessage(screen, ADDED);
  });

  test.each([
    [
      "1 track and 1 Product",
      { tracks_created: 1, products_created: 1 },
      "Package fictional-openssl: 1 track and 1 Product added.",
    ],
    [
      "Products alone",
      { tracks_created: 0, tracks_skipped: 2, products_created: 2 },
      "Package fictional-openssl: 2 Products added.",
    ],
    [
      "nothing",
      {
        tracks_created: 0,
        tracks_skipped: 3,
        products_created: 0,
        products_skipped: 7,
      },
      "Package fictional-openssl already has every track and Product that Sentinel finds for it in SMELT, so none was added.",
    ],
  ])("says what an addition that created %s added", async (_, counts, text) => {
    showingAddable({ addPackage: () => packageAdditionResponse(counts) });
    const { screen } = await renderTree();

    await addName(screen, "fictional-openssl");

    await expectSuccessMessage(screen, text);
  });

  test("says where the package is while Show hidden is off and the read after the addition shows it hidden", async () => {
    let tree: PackageDetail[] = [];
    showingTree(
      () => tree,
      () => {
        tree = [hiddenOpenssl()];
        return packageAdditionResponse();
      },
    );
    const { screen } = await renderTree();

    await addName(screen, "fictional-openssl");

    await expectSuccessMessage(
      screen,
      `${ADDED} Show hidden shows it, since none of its Products is actionable.`,
    );
    await expect
      .element(
        packagesPart(screen).getByText("All packages are hidden.", {
          exact: true,
        }),
      )
      .toBeVisible();
  });

  test("does not say where the package is while Show hidden is on", async () => {
    let tree: PackageDetail[] = [excludedPackage()];
    showingTree(
      () => tree,
      () => {
        tree = [excludedPackage(), hiddenOpenssl()];
        return packageAdditionResponse();
      },
    );
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");
    await expect.element(showHidden(screen)).toBeChecked();

    await addName(screen, "fictional-openssl");

    await expectSuccessMessage(screen, ADDED);
    expect(screen.getByText(/Show hidden shows it/).query()).toBeNull();
  });

  test("does not say where the package is when another package of the tree is hidden while the package added shows", async () => {
    let tree: PackageDetail[] = [];
    showingTree(
      () => tree,
      () => {
        tree = [excludedPackage(), fictionalPackage()];
        return packageAdditionResponse();
      },
    );
    const { screen } = await renderTree();

    await addName(screen, "fictional-openssl");

    await expectSuccessMessage(screen, ADDED);
    expect(screen.getByText(/Show hidden shows it/).query()).toBeNull();
    await expect.element(showHidden(screen)).not.toBeChecked();
    await expect
      .element(
        packagesPart(screen).getByRole("heading", {
          level: 3,
          name: "fictional-openssl",
        }),
      )
      .toBeVisible();
  });

  test("reads again the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, and the reads of the Ticket list, but not its duplicates", async () => {
    const spy = showingAddable({
      user: { data: { ...MAINTAINER.data, capabilities: ["manage_packages"] } },
    });
    const { screen } = await renderTree();
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      actors: requestsTo(spy, ACTORS),
      work: requestsTo(spy, YOUR_WORK),
      duplicates: readsOf(spy, TICKETS),
    };
    // The user saw the Ticket list and Audit log before, which wait in the
    // cache.
    client.setQueryData([EVENTS], {});
    client.setQueryData([TICKETS, { page: 1 }], {});

    await addName(screen, "fictional-openssl");

    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(reads.work + 1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    expect(readsOf(spy, TICKETS)).toBe(reads.duplicates);
    expect(leftInvalidated(EVENTS)).toBe(true);
    expect(leftInvalidated(TICKETS)).toBe(true);
  });

  test("shows the outcome of an addition that ends after the user left the screen in the message area, naming the Ticket, without asking to discard the name", async () => {
    const response = later();
    showingAddable({ addPackage: () => response.promise });
    const { router, screen } = await renderTree();
    const dialog = await addName(screen, "fictional-openssl");
    await expect
      .element(submitButton(dialog))
      .toHaveAttribute("aria-disabled", "true");

    await leaveForTickets(router, screen);
    expect(discardDialog(screen).query()).toBeNull();
    response.resolve(packageAdditionResponse());

    await expect
      .element(screen.getByText(`SNTL-12: ${ADDED}`, { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
      .toHaveAttribute("href", "/tickets/SNTL-12");
  });

  test.each([
    [
      "503 SMELT_UNAVAILABLE, with its reference",
      () => errorResponse(503, "SMELT_UNAVAILABLE"),
      MESSAGE_SMELT_UNAVAILABLE,
      true,
    ],
    [
      "422 PACKAGE_NOT_FOUND_IN_SMELT",
      () => errorResponse(422, "PACKAGE_NOT_FOUND_IN_SMELT"),
      MESSAGE_NOT_IN_SMELT,
      false,
    ],
  ])(
    "shows a failure of an addition that ends after the user left the screen, %s, in the message area as an error, naming the Ticket and the package sent",
    async (_, failure, message, referenced) => {
      const response = later();
      showingAddable({ addPackage: () => response.promise });
      const { router, screen } = await renderTree();
      // The name is sent without its surrounding whitespace.
      const dialog = await addName(screen, "  fictional-openssl  ");
      await expect
        .element(submitButton(dialog))
        .toHaveAttribute("aria-disabled", "true");

      await leaveForTickets(router, screen);
      response.resolve(failure());

      const error = screen.getByText(
        `SNTL-12: Package fictional-openssl: ${message}`,
        { exact: true },
      );
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES.danger);
      await expect
        .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
        .toHaveAttribute("href", "/tickets/SNTL-12");
      if (referenced) {
        await expect
          .element(screen.getByText(REFERENCE, { exact: true }))
          .toBeVisible();
      } else {
        expect(screen.getByText(/^Reference:/).query()).toBeNull();
      }
    },
  );
});
