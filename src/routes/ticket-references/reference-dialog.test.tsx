import { describe, expect, test } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import type { TicketReferenceResponse } from "../../api/generated/model";
import {
  errorResponse,
  jsonResponse,
  requestsTo,
  validationError,
} from "../../test-api";
import {
  ACTORS,
  addButton,
  ADDED,
  ADVISORY,
  announcementsOf,
  backgroundBehind,
  chooseType,
  client,
  editDialog,
  editOf,
  EVENTS,
  expectFocusOnError,
  expectFocusSettledOn,
  fictionalReference,
  fieldOf,
  frames,
  heading,
  ISSUE,
  later,
  leave,
  MESSAGE_CONFLICT,
  MESSAGE_GONE,
  MESSAGE_NOT_ACCEPTED,
  MESSAGE_TONES,
  MESSAGE_UNCONFIRMED,
  namesOf,
  NVD,
  openAdd,
  openEdit,
  openTypes,
  optionNames,
  panelOf,
  PATCH,
  PATH,
  POST,
  prepareEachTest,
  press,
  readText,
  referenceReads,
  referenceResponse,
  REFERENCES,
  referencesResponse,
  renderApp,
  renderTab,
  requestsWith,
  showing,
  stubReferences,
  submit,
  TICKET,
  typeSelectOf,
  unlistedResponse,
} from "./test-support";

// Add reference and Edit reference of the tab References
// (src/routes/ticket-references/reference-dialog.tsx; docs/screens/ticket.md,
// References), at the browser's default text size, in the light theme.

prepareEachTest();

const MESSAGE_INVALID = "This value isn't valid.";
const MESSAGE_ADDRESS_TAKEN =
  "This Ticket already has a reference with this address.";

// The texts of the status regions of a dialog.
function statusTexts(dialog: Locator): string[] {
  return dialog
    .getByRole("status")
    .elements()
    .map((status) => status.textContent ?? "");
}

// Waits until the browser has rendered two more frames, after which the
// effects of the commits before have run, and what they set has rendered.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

// Submits the form of a dialog with its button from the keyboard, for values
// that are not valid: leaving a field shows its error, which moves the button
// away from a pointer before its press ends.
async function submitFromKeyboard(
  dialog: Locator,
  label: "Add reference" | "Save",
) {
  await press(dialog.getByRole("button", { name: label, exact: true }));
}

// Whether every read of the path that the query client holds is to be read
// again, which a screen that shows it does as it opens.
function invalidated(path: string): boolean {
  const queries = client.getQueryCache().findAll({ queryKey: [path] });
  return (
    queries.length > 0 && queries.every((query) => query.state.isInvalidated)
  );
}

describe("Add reference", () => {
  test("opens a form alone, 488 px wide, with Address, which takes the focus, Title, Type, and Description", async () => {
    stubReferences();
    const { screen } = await renderTab();

    const dialog = await openAdd(screen);

    expect(dialog.element().getBoundingClientRect().width).toBe(488);
    await expect.element(fieldOf(dialog, "Address")).toHaveValue("");
    await expect
      .element(fieldOf(dialog, "Address"))
      .toHaveAttribute("type", "url");
    await expect.element(fieldOf(dialog, "Title (optional)")).toHaveValue("");
    expect(readText(typeSelectOf(dialog).element())).toBe(
      "Detect from the address",
    );
    await expect
      .element(fieldOf(dialog, "Description (optional)"))
      .toHaveValue("");
    expect(
      dialog
        .getByRole("button")
        .elements()
        .map((button) => readText(button))
        .slice(-2),
    ).toEqual(["Cancel", "Add reference"]);
  });

  test("offers Detect from the address first among the types, then the types and Uncategorized", async () => {
    stubReferences();
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);

    const options = await openTypes(dialog);

    expect(optionNames(options)).toEqual([
      "Detect from the address",
      "Advisory",
      "Patch",
      "Issue",
      "Article",
      "Uncategorized",
    ]);
  });

  test("adds a reference with Add Reference, the address without its surrounding whitespace and no type to detect it, then announces it once the references are read again, and returns the focus to Add reference", async () => {
    let references: TicketReferenceResponse[] = [NVD];
    const bodies: unknown[] = [];
    const { spy } = stubReferences({
      references: () => referencesResponse(references),
      add: (body) => {
        bodies.push(body);
        references = [NVD, ADDED];
        return referenceResponse(ADDED, 201);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);

    await fieldOf(dialog, "Address").fill(`  ${ADDED.url}  `);
    await fieldOf(dialog, "Title (optional)").fill(
      " Fictional packaging issue",
    );
    await fieldOf(dialog, "Description (optional)").fill(
      "Tracks the fictional\npackaging review.",
    );
    await submit(dialog, "Add reference");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(bodies).toEqual([
      {
        url: ADDED.url,
        title: " Fictional packaging issue",
        description: "Tracks the fictional\npackaging review.",
      },
    ]);
    expect(requestsWith(spy, "POST")).toHaveLength(1);
    await expect.poll(() => namesOf(screen)).toEqual([NVD.title, ADDED.title]);
    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["Reference “Fictional packaging issue” added."]);
    await expect.element(addButton(screen)).toHaveFocus();
  });

  test.each([
    ["a type", "Patch", "patch"],
    ["Uncategorized", "Uncategorized", null],
  ])("sends %s chosen", async (_, type, sent) => {
    const bodies: unknown[] = [];
    stubReferences({
      add: (body) => {
        bodies.push(body);
        return referenceResponse(ADDED, 201);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await chooseType(dialog, type);
    expect(readText(typeSelectOf(dialog).element())).toBe(type);
    await submit(dialog, "Add reference");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(bodies).toEqual([
      { url: ADDED.url, title: null, description: null, type: sent },
    ]);
  });

  test("sends no title and no description where they are empty or hold whitespace alone", async () => {
    const bodies: unknown[] = [];
    stubReferences({
      add: (body) => {
        bodies.push(body);
        return referenceResponse(ADDED, 201);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await fieldOf(dialog, "Title (optional)").fill("   ");
    await fieldOf(dialog, "Description (optional)").fill(" \n ");

    await submit(dialog, "Add reference");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(bodies).toEqual([
      { url: ADDED.url, title: null, description: null },
    ]);
  });

  test("announces a reference without a title by its address as Sentinel returns it, without quotation marks", async () => {
    const untitled = { ...ADDED, title: null };
    stubReferences({ add: () => referenceResponse(untitled, 201) });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(
      "HTTP://Issues.Example.com/fictional-openssl/12",
    );

    await submit(dialog, "Add reference");

    await expect
      .poll(() => announcementsOf(screen))
      .toEqual([`Reference ${ADDED.url} added.`]);
  });

  test.each([
    ["arrives", () => referencesResponse()],
    ["fails", () => errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION")],
  ])(
    "shows the outcome of a reference that the filters hide in the message area once the next read of the references %s, as a success without the Ticket, and announces nothing in the tab",
    async (_, response) => {
      const reread = later();
      let added = false;
      stubReferences({
        references: () => (added ? reread.promise : referencesResponse()),
        add: () => {
          added = true;
          return referenceResponse(ADDED, 201);
        },
      });
      const { screen } = await renderTab(`${PATH}?type=patch`);
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      const text = "Reference “Fictional packaging issue” added.";
      const message = screen.getByText(text, { exact: true });

      await submit(dialog, "Add reference");

      await expect.element(dialog).not.toBeInTheDocument();
      await frames();
      expect(message.query()).toBeNull();
      reread.resolve(response());

      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
      expect(panelOf(screen).element().contains(message.element())).toBe(false);
      expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
      await frames();
      expect(announcementsOf(screen)).not.toContain(text);
      expect(screen.getByText(/added\.$/).elements()).toHaveLength(1);
    },
  );

  test("announces the outcome of a reference that the filters show in the tab, and shows nothing in the message area", async () => {
    stubReferences({ add: () => referenceResponse(ADDED, 201) });
    const { screen } = await renderTab(`${PATH}?type=issue`);
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await submit(dialog, "Add reference");

    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["Reference “Fictional packaging issue” added."]);
    expect(screen.getByText(/added\.$/).elements()).toHaveLength(1);
  });

  test("shows in the message area the outcome of a reference that the filters which the user chose during the change hide", async () => {
    const response = later();
    stubReferences({ add: () => response.promise });
    const { router, screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await submit(dialog, "Add reference");
    await expect
      .element(dialog.getByRole("button", { name: "Add reference" }))
      .toHaveAttribute("aria-disabled", "true");
    router.history.push(`${PATH}?type=patch`);
    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?type=patch`);

    response.resolve(referenceResponse(ADDED, 201));

    await expect
      .element(
        screen.getByText("Reference “Fictional packaging issue” added.", {
          exact: true,
        }),
      )
      .toBeVisible();
    expect(
      backgroundBehind(
        screen
          .getByText("Reference “Fictional packaging issue” added.", {
            exact: true,
          })
          .element(),
      ),
    ).toBe(MESSAGE_TONES.success);
  });

  test("reads again the references, the Ticket, its audit log, and the users who acted on it after the change", async () => {
    const { spy } = stubReferences();
    const { screen } = await renderApp("/tickets/SNTL-12/audit-log");
    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(1);
    await screen.getByRole("tab", { name: "References" }).click();
    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      references: referenceReads(spy).length,
    };
    expect(invalidated(EVENTS)).toBe(false);
    expect(invalidated(ACTORS)).toBe(false);
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await submit(dialog, "Add reference");

    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect
      .poll(() => referenceReads(spy).length)
      .toBe(reads.references + 1);
    expect(invalidated(EVENTS)).toBe(true);
    expect(invalidated(ACTORS)).toBe(true);
  });

  test("shows the change in the message area, as a success without the Ticket, once the next read of the references fails, and announces nothing in the tab", async () => {
    const reread = later();
    let added = false;
    stubReferences({
      references: () => (added ? reread.promise : referencesResponse()),
      add: () => {
        added = true;
        return referenceResponse(ADDED, 201);
      },
    });
    const { router, screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    const text = "Reference “Fictional packaging issue” added.";
    const message = screen.getByText(text, { exact: true });

    await submit(dialog, "Add reference");

    await expect.element(dialog).not.toBeInTheDocument();
    // A change of the filters meanwhile changes the rows, not the read.
    router.history.push(`${PATH}?type=advisory`);
    await expect
      .poll(() => namesOf(screen))
      .toEqual([NVD.title, ADVISORY.title]);
    await expect.poll(() => announcementsOf(screen)).toEqual(["2 references"]);
    expect(message.query()).toBeNull();
    reread.resolve(errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION"));

    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
    expect(panelOf(screen).element().contains(message.element())).toBe(false);
    expect(screen.getByText(/^SNTL-12:/).query()).toBeNull();
    await frames();
    expect(announcementsOf(screen)).not.toContain(text);
    expect(screen.getByText(/added\.$/).elements()).toHaveLength(1);
  });

  test("announces each change again in a node of its own, also with the same words", async () => {
    stubReferences({ add: () => referenceResponse(ADDED, 201) });
    const { screen } = await renderTab();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      const before = panelOf(screen)
        .getByText("Reference “Fictional packaging issue” added.")
        .query();

      await submit(dialog, "Add reference");

      await expect
        .poll(() =>
          panelOf(screen)
            .getByText("Reference “Fictional packaging issue” added.")
            .query(),
        )
        .not.toBe(before);
      await expect.element(addButton(screen)).toHaveFocus();
    }
  });

  test.each([
    ["an empty address", "", "Enter the address."],
    ["an address of whitespace alone", "   ", "Enter the address."],
    [
      "an address without a scheme",
      "advisories.example.com/fictional",
      "Enter a web address that starts with https:// or http://.",
    ],
    [
      "an address of another scheme",
      "ftp://files.example.com/fictional",
      "Enter a web address that starts with https:// or http://.",
    ],
    [
      "an address with a user name",
      "https://jdoe@advisories.example.com/fictional",
      "Enter a web address that starts with https:// or http://.",
    ],
    [
      "an address longer than 2,048 characters",
      `https://advisories.example.com/${"a".repeat(2018)}`,
      "Enter at most 2,048 characters.",
    ],
  ])(
    "states the error of %s at Address, which takes the focus, without a request",
    async (_, address, message) => {
      const { spy } = stubReferences();
      const { screen } = await renderTab();
      const dialog = await openAdd(screen);
      if (address !== "") {
        await fieldOf(dialog, "Address").fill(address);
      }

      await submitFromKeyboard(dialog, "Add reference");

      const field = fieldOf(dialog, "Address");
      await expect.element(field).toHaveAccessibleDescription(message);
      await expect.element(field).toBeInvalid();
      await expect.element(field).toHaveFocus();
      expect(requestsWith(spy, "POST")).toHaveLength(0);
    },
  );

  test("announces the error of the check of an empty address after Enter in it in a status region of the dialog, while the address keeps the focus, without a request", async () => {
    const { spy } = stubReferences();
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);

    await userEvent.keyboard("{Enter}");

    const field = fieldOf(dialog, "Address");
    await expect
      .element(field)
      .toHaveAccessibleDescription("Enter the address.");
    await expect
      .poll(() => statusTexts(dialog))
      .toContain("Enter the address.");
    await expect.element(field).toHaveFocus();
    expect(requestsWith(spy, "POST")).toHaveLength(0);
  });

  test("does not announce the error of the check of an empty address as well when the address takes the focus from Add reference", async () => {
    stubReferences();
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);

    await submitFromKeyboard(dialog, "Add reference");

    const field = fieldOf(dialog, "Address");
    await expect
      .element(field)
      .toHaveAccessibleDescription("Enter the address.");
    await expect.element(field).toHaveFocus();
    await nextFrames();
    expect(statusTexts(dialog)).not.toContain("Enter the address.");
  });

  test("announces 409 RESOURCE_CONFLICT after Enter in the address in a status region of the dialog, while the address keeps the focus", async () => {
    stubReferences({ add: () => errorResponse(409, "RESOURCE_CONFLICT") });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    const field = fieldOf(dialog, "Address");
    await field.fill(ADDED.url);

    await userEvent.keyboard("{Enter}");

    await expect
      .element(field)
      .toHaveAccessibleDescription(MESSAGE_ADDRESS_TAKEN);
    await expect
      .poll(() => statusTexts(dialog))
      .toContain(MESSAGE_ADDRESS_TAKEN);
    await expect.element(field).toHaveFocus();
    await expect.element(field).toHaveValue(ADDED.url);
  });

  test.each([
    ["Title (optional)", 500, "Enter at most 500 characters."],
    ["Description (optional)", 2000, "Enter at most 2,000 characters."],
  ])(
    "states the error of a value of %s longer than %i characters at its field, which takes the focus, without a request",
    async (label, max, message) => {
      const { spy } = stubReferences();
      const { screen } = await renderTab();
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      await fieldOf(dialog, label).fill("a".repeat(max + 1));

      await submitFromKeyboard(dialog, "Add reference");

      const field = fieldOf(dialog, label);
      await expect.element(field).toHaveAccessibleDescription(message);
      await expect.element(field).toHaveFocus();
      expect(requestsWith(spy, "POST")).toHaveLength(0);
    },
  );

  test("accepts the longest values, counted by code point as Sentinel counts them", async () => {
    const bodies: unknown[] = [];
    stubReferences({
      add: (body) => {
        bodies.push(body);
        return referenceResponse(ADDED, 201);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    // 2,048 code points, of which the emoji take two code units each.
    const address = `https://advisories.example.com/${"😀".repeat(2017)}`;
    const title = "😀".repeat(500);
    const description = "😀".repeat(2000);
    await fieldOf(dialog, "Address").fill(address);
    await fieldOf(dialog, "Title (optional)").fill(title);
    await fieldOf(dialog, "Description (optional)").fill(description);

    await submit(dialog, "Add reference");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(bodies).toEqual([{ url: address, title, description }]);
  });

  test.each([
    [
      "an address that another reference of the Ticket has",
      () => errorResponse(409, "RESOURCE_CONFLICT"),
      "Address",
      MESSAGE_ADDRESS_TAKEN,
    ],
    [
      "a field error of the address",
      () => validationError([["body", "url"]]),
      "Address",
      MESSAGE_INVALID,
    ],
    [
      "a field error of the title",
      () => validationError([["body", "title"]]),
      "Title (optional)",
      MESSAGE_INVALID,
    ],
    [
      "a field error of the description",
      () => validationError([["body", "description"]]),
      "Description (optional)",
      MESSAGE_INVALID,
    ],
  ])(
    "shows %s at its field, which takes the focus, and keeps the input",
    async (_, response, label, message) => {
      stubReferences({ add: response });
      const { screen } = await renderTab();
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      await fieldOf(dialog, "Title (optional)").fill("Fictional title");
      await fieldOf(dialog, "Description (optional)").fill("Fictional text");

      await submit(dialog, "Add reference");

      const field = fieldOf(dialog, label);
      await expect.element(field).toHaveAccessibleDescription(message);
      await expect.element(field).toBeInvalid();
      await expect.element(field).toHaveFocus();
      await expect.element(fieldOf(dialog, "Address")).toHaveValue(ADDED.url);
      // The error goes once the user changes the value and leaves the field.
      await field.fill("https://advisories.example.com/fictional-other");
      await userEvent.keyboard("{Tab}");
      await expect.element(field).not.toBeInvalid();
    },
  );

  test("shows a field error of the type at the type, which takes the focus", async () => {
    stubReferences({ add: () => validationError([["body", "type"]]) });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await chooseType(dialog, "Patch");

    await submit(dialog, "Add reference");

    await expect
      .element(dialog.getByText(MESSAGE_INVALID, { exact: true }))
      .toBeVisible();
    await expect.element(typeSelectOf(dialog)).toHaveFocus();
    expect(
      dialog.getByText(MESSAGE_INVALID).element().getBoundingClientRect().top,
    ).toBeGreaterThan(
      typeSelectOf(dialog).element().getBoundingClientRect().top,
    );
  });

  test.each([
    [
      "a change that Sentinel did not confirm, as a warning",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      MESSAGE_UNCONFIRMED,
      MESSAGE_TONES.warning,
    ],
    [
      "a network failure, as a warning",
      () => Promise.reject(new TypeError("Failed to fetch")),
      MESSAGE_UNCONFIRMED,
      MESSAGE_TONES.warning,
    ],
    [
      "a conflict with a code that the pinned contract does not list, as an error",
      () => errorResponse(409, "FICTIONAL_CODE"),
      MESSAGE_CONFLICT,
      MESSAGE_TONES.danger,
    ],
    [
      "a VALIDATION_ERROR of no field, as an error",
      () => validationError([["body"]]),
      MESSAGE_NOT_ACCEPTED,
      MESSAGE_TONES.danger,
    ],
    [
      "a status and a code that the pinned contract does not list, as an error",
      () => errorResponse(418, "FICTIONAL_CODE"),
      MESSAGE_NOT_ACCEPTED,
      MESSAGE_TONES.danger,
    ],
  ])(
    "shows %s at the top of the form, which takes the focus and keeps the input",
    async (_, response, message, tone) => {
      const { spy } = stubReferences({ add: response });
      const { screen } = await renderTab();
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      const reads = requestsTo(spy, TICKET);

      await submit(dialog, "Add reference");

      const error = dialog.getByText(message);
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(tone);
      await expectFocusOnError(error);
      expect(error.element().getBoundingClientRect().bottom).toBeLessThan(
        fieldOf(dialog, "Address").element().getBoundingClientRect().top,
      );
      await expect.element(fieldOf(dialog, "Address")).toHaveValue(ADDED.url);
      // Whatever its outcome, the screen reads again what it affects.
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    },
  );

  test("shows the error of a field and of the form for a VALIDATION_ERROR with an error of another member, the form taking the focus", async () => {
    stubReferences({
      add: () =>
        validationError([
          ["body", "url"],
          ["body", "fictional_member"],
        ]),
    });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await submit(dialog, "Add reference");

    const error = dialog.getByText(MESSAGE_NOT_ACCEPTED);
    await expect.element(error).toBeVisible();
    await expect
      .element(fieldOf(dialog, "Address"))
      .toHaveAccessibleDescription(MESSAGE_INVALID);
    await expectFocusOnError(error);
  });

  test("shows the error of another failure again, which takes the focus again", async () => {
    stubReferences({ add: () => errorResponse(503, "SERVICE_UNAVAILABLE") });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await submit(dialog, "Add reference");
    const error = dialog.getByText(MESSAGE_UNCONFIRMED);
    await expect.element(error).toBeVisible();

    await submit(dialog, "Add reference");

    await expectFocusOnError(dialog.getByText(MESSAGE_UNCONFIRMED));
  });

  test("leaves an answer that the UI cannot show to the page of a failure of the UI", async () => {
    // The answer of a later release that lacks the reference, which the
    // announcement cannot name.
    stubReferences({ add: () => jsonResponse(201, {}) });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await submit(dialog, "Add reference");

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "Something went wrong" }),
      )
      .toBeVisible();
  });

  test("is busy while the change is in progress, sends one request, and cannot be closed", async () => {
    const response = later();
    const { spy } = stubReferences({ add: () => response.promise });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await userEvent.keyboard("{Enter}");
    const button = dialog.getByRole("button", {
      name: "Add reference",
      exact: true,
    });
    await expect.element(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");
    await expect
      .element(dialog.getByRole("button", { name: "Cancel" }))
      .toBeDisabled();
    expect(requestsWith(spy, "POST")).toHaveLength(1);
    await expect.element(dialog).toBeVisible();
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }).query(),
    ).toBeNull();

    response.resolve(referenceResponse(ADDED, 201));

    await expect.element(dialog).not.toBeInTheDocument();
  });

  test.each(["Cancel", "Escape"])(
    "closes on %s without a question while nothing was entered, and returns the focus to Add reference",
    async (way) => {
      stubReferences();
      const { screen } = await renderTab();
      const dialog = await openAdd(screen);

      if (way === "Escape") {
        await userEvent.keyboard("{Escape}");
      } else {
        await dialog.getByRole("button", { name: "Cancel" }).click();
      }

      await expect.element(dialog).not.toBeInTheDocument();
      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();
      await expect.element(addButton(screen)).toHaveFocus();
    },
  );

  test.each([
    [
      "an address",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Address").fill(ADDED.url);
      },
    ],
    [
      "a type",
      async (dialog: Locator) => {
        await chooseType(dialog, "Article");
      },
    ],
    [
      "a description",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Description (optional)").fill(" ");
      },
    ],
  ])(
    "asks before Cancel or Escape discard %s, keeps it on Keep editing, and closes on Discard",
    async (_, enter) => {
      const { spy } = stubReferences();
      const { screen } = await renderTab();
      const dialog = await openAdd(screen);
      await enter(dialog);

      await dialog.getByRole("button", { name: "Cancel" }).click();

      const discard = screen.getByRole("dialog", { name: "Discard changes?" });
      await expect
        .element(discard.getByRole("button", { name: "Keep editing" }))
        .toHaveFocus();
      await expect
        .element(
          discard.getByText("The reference that you entered isn't added."),
        )
        .toBeVisible();
      await discard.getByRole("button", { name: "Keep editing" }).click();
      await expect.element(discard).not.toBeInTheDocument();
      await expect.element(dialog).toBeVisible();

      fieldOf(dialog, "Title (optional)").element().focus();
      await userEvent.keyboard("{Escape}");
      await expect.element(discard).toBeVisible();
      await discard
        .getByRole("button", { name: "Discard", exact: true })
        .click();

      await expect.element(dialog).not.toBeInTheDocument();
      await expect.element(addButton(screen)).toHaveFocus();
      expect(requestsWith(spy, "POST")).toHaveLength(0);
      // The dialog opens again empty.
      const again = await openAdd(screen);
      await expect.element(fieldOf(again, "Address")).toHaveValue("");
      expect(readText(typeSelectOf(again).element())).toBe(
        "Detect from the address",
      );
    },
  );
  test("asks before Back discards the input, also for another filter of the tab, keeps the dialog, the input, and the URL on Keep editing, and closes the dialog on Discard", async () => {
    const { spy } = stubReferences();
    const { router, screen } = await renderTab(PATH, "hash");
    router.history.push(`${PATH}?type=patch`);
    await expect.poll(() => window.location.hash).toBe(`#${PATH}?type=patch`);
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    router.history.back();

    const discard = screen.getByRole("dialog", { name: "Discard changes?" });
    await expect
      .element(discard.getByRole("button", { name: "Keep editing" }))
      .toHaveFocus();
    await expect
      .element(discard.getByText("The reference that you entered isn't added."))
      .toBeVisible();
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect.element(discard).not.toBeInTheDocument();
    await expect.poll(() => window.location.hash).toBe(`#${PATH}?type=patch`);
    await expect.element(fieldOf(dialog, "Address")).toHaveValue(ADDED.url);
    await expect.element(fieldOf(dialog, "Address")).toHaveFocus();

    router.history.back();
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    // The router follows Back to the tab without the filter.
    await expect.poll(() => router.state.location.href).toBe(PATH);
    expect(window.location.hash).toBe(`#${PATH}`);
    await expect
      .element(screen.getByRole("button", { name: "Filters" }))
      .toBeVisible();
    expect(requestsWith(spy, "POST")).toHaveLength(0);
  });

  test("asks before a navigation to another screen discards the input, and leaves on Discard", async () => {
    stubReferences();
    const { router, screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    router.history.push("/tickets");

    const discard = screen.getByRole("dialog", { name: "Discard changes?" });
    await expect.element(discard).toBeVisible();
    expect(router.state.location.pathname).toBe(PATH);
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
  });

  test("asks nothing before a navigation while nothing was entered, nor while the change is in progress", async () => {
    const response = later();
    stubReferences({ add: () => response.promise });
    const { router, screen } = await renderTab();
    const dialog = await openAdd(screen);
    router.history.push(`${PATH}?type=patch`);
    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?type=patch`);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await submit(dialog, "Add reference");
    await expect
      .element(dialog.getByRole("button", { name: "Add reference" }))
      .toHaveAttribute("aria-disabled", "true");

    await leave(router, screen);

    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }).query(),
    ).toBeNull();
    response.resolve(referenceResponse(ADDED, 201));
    await expect
      .element(
        screen.getByText(
          "SNTL-12: Reference “Fictional packaging issue” added.",
        ),
      )
      .toBeVisible();
  });
});

describe("Edit reference", () => {
  test("opens a form alone with the values of the reference, Address taking the focus, and the types without Detect from the address", async () => {
    stubReferences();
    const { screen } = await renderTab();

    const dialog = await openEdit(screen, ADVISORY);

    expect(dialog.element().getBoundingClientRect().width).toBe(488);
    await expect.element(fieldOf(dialog, "Address")).toHaveValue(ADVISORY.url);
    await expect
      .element(fieldOf(dialog, "Title (optional)"))
      .toHaveValue("Fictional advisory");
    expect(readText(typeSelectOf(dialog).element())).toBe("Advisory");
    await expect
      .element(fieldOf(dialog, "Description (optional)"))
      .toHaveValue(ADVISORY.description);
    expect(
      dialog
        .getByRole("button")
        .elements()
        .map((button) => readText(button))
        .slice(-2),
    ).toEqual(["Cancel", "Save"]);
    const options = await openTypes(dialog);
    expect(optionNames(options)).toEqual([
      "Advisory",
      "Patch",
      "Issue",
      "Article",
      "Uncategorized",
    ]);
  });

  test("shows a reference without a title, a type, and a description with empty fields and Uncategorized, its address as the browser parses it", async () => {
    showing(
      fictionalReference({
        url: "https://advisories.example.com/fictional advisory",
        title: null,
        type: null,
        description: null,
      }),
    );
    const { screen } = await renderTab();
    await press(
      panelOf(screen).getByRole("button", { name: /^Edit reference/ }),
    );
    const dialog = editDialog(screen);

    await expect
      .element(fieldOf(dialog, "Address"))
      .toHaveValue("https://advisories.example.com/fictional%20advisory");
    await expect.element(fieldOf(dialog, "Title (optional)")).toHaveValue("");
    expect(readText(typeSelectOf(dialog).element())).toBe("Uncategorized");
    await expect
      .element(fieldOf(dialog, "Description (optional)"))
      .toHaveValue("");
  });

  test.each([
    [
      "the address, without its surrounding whitespace",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Address").fill(
          " https://advisories.example.com/fictional-openssl/2099-0013 ",
        );
      },
      { url: "https://advisories.example.com/fictional-openssl/2099-0013" },
    ],
    [
      "the title",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Title (optional)").fill(
          "Fictional advisory, revised",
        );
      },
      { title: "Fictional advisory, revised" },
    ],
    [
      "the title, removed",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Title (optional)").fill(" ");
      },
      { title: null },
    ],
    [
      "the type",
      async (dialog: Locator) => {
        await chooseType(dialog, "Article");
      },
      { type: "article" },
    ],
    [
      "the type, removed",
      async (dialog: Locator) => {
        await chooseType(dialog, "Uncategorized");
      },
      { type: null },
    ],
    [
      "the description, removed",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Description (optional)").fill("");
      },
      { description: null },
    ],
    [
      "every field",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Address").fill(
          "https://advisories.example.com/fictional-openssl/2099-0013",
        );
        await fieldOf(dialog, "Title (optional)").fill("Fictional title");
        await chooseType(dialog, "Patch");
        await fieldOf(dialog, "Description (optional)").fill("Fictional text");
      },
      {
        url: "https://advisories.example.com/fictional-openssl/2099-0013",
        title: "Fictional title",
        type: "patch",
        description: "Fictional text",
      },
    ],
  ])("changes %s alone with Update Reference", async (_, change, body) => {
    const requests: [string, unknown][] = [];
    stubReferences({
      update: (path, sent) => {
        requests.push([path, sent]);
        return referenceResponse(ADVISORY);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);

    await change(dialog);
    await submit(dialog, "Save");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(requests).toEqual([[`${REFERENCES}/${ADVISORY.id}`, body]]);
  });

  test("announces the change by the reference as Sentinel returns it once the references are read again, returns the focus to Edit, and reads again what it affects", async () => {
    const revised = { ...ADVISORY, title: "Fictional advisory, revised" };
    let references: TicketReferenceResponse[] = [ADVISORY];
    const { spy } = stubReferences({
      references: () => referencesResponse(references),
      update: () => {
        references = [revised];
        return referenceResponse(revised);
      },
    });
    const { screen } = await renderTab();
    const reads = requestsTo(spy, TICKET);
    const dialog = await openEdit(screen, ADVISORY);

    await fieldOf(dialog, "Title (optional)").fill(revised.title);
    await submit(dialog, "Save");

    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["Reference “Fictional advisory, revised” changed."]);
    expect(namesOf(screen)).toEqual([revised.title]);
    await expect.element(editOf(screen, revised)).toHaveFocus();
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
  });

  test.each([
    [
      "that the filters still show, in the tab",
      "?type=advisory",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Title (optional)").fill("Fictional title");
      },
      { ...ADVISORY, title: "Fictional title" },
      true,
    ],
    [
      "that takes the reference out of the filters, in the message area",
      "?type=advisory",
      async (dialog: Locator) => {
        await chooseType(dialog, "Issue");
      },
      { ...ADVISORY, title: "Fictional title", type: "issue" as const },
      false,
    ],
  ])(
    "tells the outcome of a change %s",
    async (_, search, change, returned, announced) => {
      stubReferences({ update: () => referenceResponse(returned) });
      const { screen } = await renderTab(`${PATH}${search}`);
      const dialog = await openEdit(screen, ADVISORY);
      await change(dialog);

      await submit(dialog, "Save");

      const text = "Reference “Fictional title” changed.";
      if (announced) {
        await expect.poll(() => announcementsOf(screen)).toEqual([text]);
      } else {
        const message = screen.getByText(text, { exact: true });
        await expect.element(message).toBeVisible();
        expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
        await frames();
        expect(announcementsOf(screen)).toEqual([]);
      }
      expect(screen.getByText(/changed\.$/).elements()).toHaveLength(1);
    },
  );

  test("offers a type that the pinned contract does not list as received, and keeps it, sending no type", async () => {
    const bodies: unknown[] = [];
    stubReferences({
      references: () =>
        unlistedResponse({ ...ADVISORY, type: "fictional_type" }),
      update: (_, body) => {
        bodies.push(body);
        return referenceResponse(ADVISORY);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    expect(readText(typeSelectOf(dialog).element())).toBe("fictional_type");
    const options = await openTypes(dialog);
    expect(optionNames(options)).toEqual([
      "Advisory",
      "Patch",
      "Issue",
      "Article",
      "Uncategorized",
      "fictional_type",
    ]);
    await userEvent.keyboard("{Escape}");

    await fieldOf(dialog, "Title (optional)").fill("Fictional title");
    await submit(dialog, "Save");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(bodies).toEqual([{ title: "Fictional title" }]);
  });

  test("sends no type when the user chooses again a type that the pinned contract does not list", async () => {
    const bodies: unknown[] = [];
    stubReferences({
      references: () =>
        unlistedResponse({ ...ADVISORY, type: "fictional_type" }),
      update: (_, body) => {
        bodies.push(body);
        return referenceResponse(ADVISORY);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await chooseType(dialog, "Patch");
    await chooseType(dialog, "fictional_type");
    await fieldOf(dialog, "Title (optional)").fill("Fictional title");

    await submit(dialog, "Save");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(bodies).toEqual([{ title: "Fictional title" }]);
  });

  test.each([
    ["nothing", async () => undefined],
    [
      "a change that the user undid",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Title (optional)").fill("Fictional title");
        await fieldOf(dialog, "Title (optional)").fill("Fictional advisory");
      },
    ],
    [
      "whitespace alone around the address",
      async (dialog: Locator) => {
        await fieldOf(dialog, "Address").fill(` ${ADVISORY.url} `);
      },
    ],
  ])(
    "closes without a request after Save with %s changed, and returns the focus to Edit",
    async (_, change) => {
      const { spy } = stubReferences();
      const { screen } = await renderTab();
      const dialog = await openEdit(screen, ADVISORY);

      await change(dialog);
      await submit(dialog, "Save");

      await expect.element(dialog).not.toBeInTheDocument();
      expect(requestsWith(spy, "PATCH")).toHaveLength(0);
      await expect.element(editOf(screen, ADVISORY)).toHaveFocus();
    },
  );

  test("closes without a request after Save with whitespace alone in place of an absent title", async () => {
    const { spy } = showing(PATCH);
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, PATCH);

    await fieldOf(dialog, "Title (optional)").fill("  ");
    await submit(dialog, "Save");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(requestsWith(spy, "PATCH")).toHaveLength(0);
  });

  test.each([
    [
      "an address that another reference of the Ticket has, at Address",
      () => errorResponse(409, "RESOURCE_CONFLICT"),
      MESSAGE_ADDRESS_TAKEN,
      true,
    ],
    [
      "an automatic reference, at the top of the form",
      () => errorResponse(409, "RESOURCE_NOT_EDITABLE"),
      MESSAGE_CONFLICT,
      false,
    ],
    [
      "a reference that no longer exists, at the top of the form",
      () => errorResponse(404, "RESOURCE_NOT_FOUND"),
      MESSAGE_GONE,
      false,
    ],
  ])("shows the failure of %s", async (_, response, message, atField) => {
    stubReferences({ update: response });
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await fieldOf(dialog, "Address").fill(
      "https://advisories.example.com/fictional-openssl/2099-0013",
    );

    await submit(dialog, "Save");

    const error = dialog.getByText(message);
    await expect.element(error).toBeVisible();
    if (atField) {
      await expect
        .element(fieldOf(dialog, "Address"))
        .toHaveAccessibleDescription(message);
      await expect.element(fieldOf(dialog, "Address")).toHaveFocus();
    } else {
      await expectFocusOnError(error);
    }
    await expect.element(dialog).toBeVisible();
  });

  test("states the errors of the values before a request", async () => {
    const { spy } = stubReferences();
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await fieldOf(dialog, "Address").fill("");

    await submitFromKeyboard(dialog, "Save");

    await expect
      .element(fieldOf(dialog, "Address"))
      .toHaveAccessibleDescription("Enter the address.");
    expect(requestsWith(spy, "PATCH")).toHaveLength(0);
  });

  test("asks before Cancel discards the changes, and closes on Discard, returning the focus to Edit", async () => {
    const { spy } = stubReferences();
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await fieldOf(dialog, "Title (optional)").fill("Fictional title");

    await dialog.getByRole("button", { name: "Cancel" }).click();

    const discard = screen.getByRole("dialog", { name: "Discard changes?" });
    await expect
      .element(
        discard.getByText("Your changes to this reference aren't saved."),
      )
      .toBeVisible();
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(editOf(screen, ADVISORY)).toHaveFocus();
    expect(requestsWith(spy, "PATCH")).toHaveLength(0);
  });

  test("asks before Back discards the changes, and keeps them on Keep editing", async () => {
    const { spy } = stubReferences();
    const { router, screen } = await renderTab(PATH, "hash");
    router.history.push(`${PATH}?type=advisory`);
    await expect
      .poll(() => window.location.hash)
      .toBe(`#${PATH}?type=advisory`);
    const dialog = await openEdit(screen, ADVISORY);
    await fieldOf(dialog, "Title (optional)").fill("Fictional title");

    router.history.back();

    const discard = screen.getByRole("dialog", { name: "Discard changes?" });
    await expect
      .element(
        discard.getByText("Your changes to this reference aren't saved."),
      )
      .toBeVisible();
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect.element(discard).not.toBeInTheDocument();
    await expect
      .poll(() => window.location.hash)
      .toBe(`#${PATH}?type=advisory`);
    await expect
      .element(fieldOf(dialog, "Title (optional)"))
      .toHaveValue("Fictional title");
    expect(requestsWith(spy, "PATCH")).toHaveLength(0);
  });

  test("closes on Cancel without a question while nothing changed", async () => {
    stubReferences();
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);

    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }).query(),
    ).toBeNull();
  });

  test("is busy while the change is in progress, and cannot be closed", async () => {
    const response = later();
    stubReferences({ update: () => response.promise });
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await fieldOf(dialog, "Title (optional)").fill("Fictional title");

    await submit(dialog, "Save");

    await expect
      .element(dialog.getByRole("button", { name: "Save" }))
      .toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).toBeVisible();
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }).query(),
    ).toBeNull();
    response.resolve(referenceResponse(ADVISORY));
    await expect.element(dialog).not.toBeInTheDocument();
  });

  test("keeps the focus on Edit of a reference whose row moves once a change of its type orders the rows", async () => {
    const changed = { ...ADVISORY, type: "issue" as const };
    const reread = later();
    let updated = false;
    stubReferences({
      references: () =>
        updated
          ? reread.promise
          : referencesResponse([NVD, ADVISORY, PATCH, ISSUE, POST]),
      update: () => {
        updated = true;
        return referenceResponse(changed);
      },
    });
    const { screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await chooseType(dialog, "Issue");
    await submit(dialog, "Save");
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(editOf(screen, ADVISORY)).toHaveFocus();

    reread.resolve(referencesResponse([NVD, PATCH, ISSUE, changed, POST]));

    await expect
      .poll(() => namesOf(screen))
      .toEqual([NVD.title, PATCH.url, ISSUE.title, ADVISORY.title, POST.title]);
    await expectFocusSettledOn(editOf(screen, changed));
    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["Reference “Fictional advisory” changed."]);
  });
});
