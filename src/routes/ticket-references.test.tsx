import { describe, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import "../styles.css";
import type { TicketReferenceResponse } from "../api/generated/model";
import { formatDateTime } from "../components/date-time";
import {
  errorResponse,
  fictionalTicketDetail,
  OTHER_USER,
  stubApi,
  ticketResponse,
  urlOf,
} from "../test-api";
import {
  announcedAgain,
  announcementNode,
  inReach,
} from "../test-announcements";
import {
  addButton,
  ADDED,
  ADVISORY,
  announcementsOf,
  areaMessage,
  backgroundBehind,
  chooseType,
  client,
  confirmationOf,
  deleted,
  deleteOf,
  deleteReference,
  editOf,
  EVERY_REFERENCE,
  expectFocusSettledOn,
  expectStays,
  fakeMessageClock,
  fictionalReference,
  fieldOf,
  focused,
  frames,
  heading,
  ISSUE,
  later,
  leave,
  mainContent,
  ME,
  MESSAGE_CONFLICT,
  MESSAGE_NOT_ACCEPTED,
  MESSAGE_TONES,
  MESSAGE_UNCONFIRMED,
  namesOf,
  NVD,
  ON_FAKE_CLOCK,
  openAdd,
  openEdit,
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
  returnToForeground,
  rowOf,
  rowsOf,
  showing,
  stubReferences,
  submit,
  tableOf,
  TICKET,
  unlistedResponse,
  type Router,
  type Screen,
} from "./ticket-references/test-support";

// The tab References of the Ticket screen (docs/screens/ticket.md,
// References), at the browser's default text size, in the light theme. Its
// dates and times are local times of the browser, sent in UTC as the API
// sends them, so that the tests hold in every time zone.

prepareEachTest();

const MESSAGE_UNAVAILABLE =
  "Sentinel isn't available right now. Try again later.";

// The reference of the errors of the tests (src/test-api.ts), as the
// announcer announces it after the message of the error.
const REFERENCE = "Reference: 01890a5d-ac96-774b-bcce-b302099a8057";

const NO_MATCH = "No references match the filters.";

// fg-muted of the light theme.
const FG_MUTED = "rgb(89, 99, 110)";

// The cells of each row of the table, in their order, as assistive
// technologies read them.
function cellsOf(screen: Screen): string[][] {
  return rowsOf(screen).map((row) =>
    [...row.querySelectorAll('[role="rowheader"], [role="gridcell"]')].map(
      readText,
    ),
  );
}

// The elements in the order of the page.
function inPageOrder(...elements: Element[]): Element[] {
  return elements.toSorted((first, second) =>
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1,
  );
}

// The number of lines on which an element shows, by the tops of the boxes
// of its text.
function linesOf(element: Element): number {
  return new Set(
    [...element.getClientRects()].map((box) => Math.round(box.top)),
  ).size;
}

// The element of the frame of the table that scrolls it sideways: the first
// within the frame, the nearest element around the table with a border line.
function scrollerOf(screen: Screen): Element {
  let frame = tableOf(screen).element().parentElement;
  while (frame !== null && getComputedStyle(frame).borderTopWidth !== "1px") {
    frame = frame.parentElement;
  }
  const scroller = frame?.firstElementChild;
  if (scroller == null) {
    throw new Error("The table has no frame");
  }
  return scroller;
}

// The width of the page: that of the window, less the room that a page with
// the message area keeps for its scrollbar also while it does not scroll
// (src/styles.css), which the body leaves out. Chromium gives the root's
// clientWidth as the width of the window while that room is empty.
function layoutWidth(): number {
  return document.body.clientWidth;
}

// Waits until no read of the path is in progress and the tab has its
// outcome, for a read whose outcome the tab does not show yet, such as a
// failure that waits for the Ticket: TanStack Query tells the tab of the end
// of a read in a later task, which runs before this one ends.
async function readEnded(path: string) {
  await expect
    .poll(() => client.isFetching({ queryKey: [path] }), { interval: 0 })
    .toBe(0);
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// The paths of the requests to the API, other than the read of the
// signed-in user.
function pathsOf(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input).pathname)
    .filter((path) => path !== ME);
}

// Opens the popover of the filters, and returns it.
async function openFilters(screen: Screen) {
  await screen.getByRole("button", { name: /^Filters/ }).click();
  const dialog = screen.getByRole("dialog", { name: "Filters" });
  await expect.element(dialog).toBeVisible();
  return dialog;
}

// Checks or unchecks a type, with a click on its name, as its box covers its
// input.
async function toggleType(dialog: Locator, type: string) {
  await dialog
    .getByRole("group", { name: "Type" })
    .getByText(type, { exact: true })
    .click();
}

// The select of the source in the popover of the filters, named by the
// option that it shows and its name.
function sourceSelectOf(dialog: Locator) {
  return dialog.getByRole("button", { name: /Source$/ });
}

// Opens the options of the source, and returns them.
async function openSources(dialog: Locator) {
  await sourceSelectOf(dialog).click();
  const options = page.getByRole("listbox", { name: "Source" });
  await expect.element(options).toBeVisible();
  return options;
}

// The menu of the options of the source, which a popover of its own holds,
// named after the filter.
function sourceMenuOf() {
  return page.getByRole("dialog", { name: "Source" });
}

// The status regions of an element that hold the text and that assistive
// technologies can reach, which announce it.
function statusRegionsWith(container: Locator, text: string): Element[] {
  return container
    .getByRole("status")
    .filter({ hasText: text })
    .elements()
    .filter(inReach);
}

describe("the tab", () => {
  test("opens at its path, selected, between Overview and Affected versions", async () => {
    stubReferences();

    const { screen } = await renderTab();

    const tabs = screen.getByRole("tablist", { name: "Ticket" });
    expect(
      tabs
        .getByRole("tab")
        .elements()
        .map((tab) => tab.textContent),
    ).toEqual(["Overview", "References", "Affected versions", "Audit log"]);
    await expect
      .element(tabs.getByRole("tab", { name: "References" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(tabs.getByRole("tab", { name: "References" }))
      .toHaveAttribute("href", PATH);
    expect(document.title).toBe("SNTL-12 – Sentinel");
  });

  test("shows the toolbar, the tabs, and the references at once, while Get Ticket is still pending", async () => {
    const ticket = later();
    stubReferences({ ticket: () => ticket.promise });

    const { screen } = await renderApp(PATH);

    await expect.element(heading(screen, "Ticket")).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Filters" }))
      .toBeVisible();
    await expect.element(addButton(screen)).toBeVisible();
    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    await expect.element(heading(screen, "Ticket")).toBeVisible();

    ticket.resolve(ticketResponse(fictionalTicketDetail()));

    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
  });

  test("reads the Ticket and the whole list of its references, without parameters, as it opens, and none of the reads of the other tabs", async () => {
    const { spy } = stubReferences();

    await renderTab(`${PATH}?type=patch&source=manual`);

    await expect
      .poll(() => new Set(pathsOf(spy)))
      .toEqual(new Set([TICKET, REFERENCES]));
    expect(pathsOf(spy)).toHaveLength(2);
    expect(referenceReads(spy)).toEqual([""]);
  });

  test("opens at its path without parameters from the tab, which Overview leaves", async () => {
    stubReferences();
    const { router, screen } = await renderTab(`${PATH}?type=patch`);
    const tabs = screen.getByRole("tablist", { name: "Ticket" });
    await expect
      .element(tabs.getByRole("tab", { name: "References" }))
      .toHaveAttribute("href", PATH);

    await tabs.getByRole("tab", { name: "Overview" }).click();

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets/SNTL-12");
    await tabs.getByRole("tab", { name: "References" }).click();
    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect.poll(() => namesOf(screen)).toHaveLength(5);
  });
});

describe("the table", () => {
  test("shows each reference in the order of the API: the reference, its type, its source, and when it was added, with the column of the actions", async () => {
    stubReferences();

    const { screen } = await renderTab();

    expect(
      tableOf(screen)
        .getByRole("columnheader")
        .elements()
        .map((header) => header.textContent),
    ).toEqual(["Reference", "Type", "Source", "Added", "Actions"]);
    expect(cellsOf(screen)).toEqual([
      [
        "NVD (another site) https://nvd.example.com/vuln/detail/CVE-2099-0012",
        "Advisory",
        "NVD",
        formatDateTime(NVD.created_at),
        "",
      ],
      [
        "Fictional advisory (another site) https://advisories.example.com/fictional-openssl/2099-0012 A fictional advisory of fictional-openssl.",
        "Advisory",
        "Manual",
        formatDateTime(ADVISORY.created_at),
        "",
      ],
      [
        "https://git.example.org/fictional-openssl/commit/0a1b2c3d (another site)",
        "Patch",
        "Manual",
        formatDateTime(PATCH.created_at),
        "",
      ],
      [
        "Fictional bug report (another site) https://bugzilla.example.com/show_bug.cgi?id=1201",
        "Issue",
        "Red Hat",
        formatDateTime(ISSUE.created_at),
        "",
      ],
      [
        "Fictional mailing list post (another site) https://lists.example.org/fictional/2099/11/1",
        "Uncategorized",
        "Manual",
        formatDateTime(POST.created_at),
        "",
      ],
    ]);
  });

  test("names each row by its reference, which links its title to its address, with the address below it in text-13 and fg-muted", async () => {
    stubReferences();
    const { screen } = await renderTab();
    const row = rowOf(screen, ADVISORY);

    const link = row.getByRole("link", {
      name: "Fictional advisory (another site)",
    });
    await expect.element(link).toHaveAttribute("href", ADVISORY.url);
    expect(readText(row.getByRole("rowheader").element())).toMatch(
      /^Fictional advisory \(another site\) /,
    );
    const address = row.getByText(ADVISORY.url, { exact: true }).element();
    expect(getComputedStyle(address).fontSize).toBe("13px");
    expect(getComputedStyle(address).color).toBe(FG_MUTED);
    expect(address.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      link.element().getBoundingClientRect().bottom,
    );
    expect(getComputedStyle(link.element()).fontWeight).toBe("500");
  });

  test("links a reference without a title by its address, without the address below it", async () => {
    showing(PATCH);
    const { screen } = await renderTab();

    const row = rowOf(screen, PATCH);
    await expect
      .element(row.getByRole("link"))
      .toHaveAttribute("href", PATCH.url);
    expect(readText(row.getByRole("rowheader").element())).toBe(
      `${PATCH.url} (another site)`,
    );
    // No text of the address but that of the link.
    expect(row.getByText(PATCH.url, { exact: true }).elements()).toEqual([]);
  });

  test("shows and links the address as the browser parses it", async () => {
    showing(
      fictionalReference({
        url: "https://advisories.example.com/fictional advisory",
        title: null,
      }),
      fictionalReference({
        id: "00000000-0000-7000-8000-0000000000f6",
        url: "https://advisories.example.com/fictional advisory 2",
      }),
    );
    const { screen } = await renderTab();

    const parsed = "https://advisories.example.com/fictional%20advisory";
    await expect
      .element(
        tableOf(screen).getByRole("link", {
          name: `${parsed} (another site)`,
          exact: true,
        }),
      )
      .toHaveAttribute("href", parsed);
    await expect
      .element(tableOf(screen).getByText(`${parsed}%202`, { exact: true }))
      .toBeVisible();
  });

  test("cuts a description longer than four lines with Show more, which shows it whole", async () => {
    showing(
      fictionalReference({
        description: Array.from(
          { length: 8 },
          (_, index) => `Fictional line ${String(index + 1)} of the analysis.`,
        ).join("\n"),
      }),
    );
    const { screen } = await renderTab();
    const more = tableOf(screen).getByRole("button", { name: "Show more" });

    await expect.element(more).toBeVisible();
    await expect.element(more).toHaveAttribute("aria-expanded", "false");
    await more.click();

    await expect
      .element(tableOf(screen).getByRole("button", { name: "Show less" }))
      .toHaveAttribute("aria-expanded", "true");
  });

  test("shows a reference without a type as Uncategorized, in fg-muted, and a type that the pinned contract does not list as received", async () => {
    stubReferences({
      references: () =>
        unlistedResponse(
          { ...ADVISORY, type: "fictional_type" },
          { ...POST, fictional_field: "A fictional value" },
        ),
    });
    const { screen } = await renderTab();

    expect(cellsOf(screen).map((cells) => cells[1])).toEqual([
      "fictional_type",
      "Uncategorized",
    ]);
    const uncategorized = rowOf(screen, POST).getByText("Uncategorized", {
      exact: true,
    });
    expect(getComputedStyle(uncategorized.element()).color).toBe(FG_MUTED);
    const unlisted = rowOf(screen, ADVISORY).getByText("fictional_type", {
      exact: true,
    });
    expect(getComputedStyle(unlisted.element()).color).not.toBe(FG_MUTED);
  });

  test("names the source of each reference: Manual, the CVE source of each fetcher, and a fetcher that the pinned contract does not list as received", async () => {
    const sources = [
      ["manual", "Manual"],
      ["sync_nvd_cves", "NVD"],
      ["sync_mitre_cves", "MITRE"],
      ["sync_kernel_cves", "Linux Kernel CNA"],
      ["sync_ghsa_advisories", "GHSA"],
      ["sync_redhat_cves", "Red Hat"],
      ["sync_osv_advisories", "OSV"],
      ["sync_cisa_kev", "CISA KEV"],
      ["sync_epss_scores", "EPSS"],
      ["sync_bugzilla_bugs", "SUSE Bugzilla"],
      ["sync_fictional_cves", "sync_fictional_cves"],
    ] as const;
    showing(
      ...sources.map(([source], index) =>
        fictionalReference({
          id: `00000000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`,
          url: `https://advisories.example.com/${source}`,
          title: null,
          source,
        }),
      ),
    );

    const { screen } = await renderTab();

    expect(cellsOf(screen).map((cells) => cells[2])).toEqual(
      sources.map(([, name]) => name),
    );
  });

  test("says No references. without any, with Filters and Add reference, also while a filter applies", async () => {
    showing();

    const { screen } = await renderTab(`${PATH}?type=patch`);

    await expect
      .element(panelOf(screen).getByText("No references.", { exact: true }))
      .toBeVisible();
    expect(tableOf(screen).query()).toBeNull();
    expect(panelOf(screen).getByText(NO_MATCH).query()).toBeNull();
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toBeVisible();
    await expect.element(addButton(screen)).toBeVisible();
  });

  test.each([
    ["without a filter", "", ["Add reference", "Filters"]],
    [
      "with a filter",
      "?type=patch",
      ["Add reference", "Filters 1 applied", "Clear filters"],
    ],
  ])(
    "puts Add reference, Filters, and Clear filters while a filter applies, last, in this order at the end of the line above the table, %s",
    async (_, search, names) => {
      stubReferences();
      const { screen } = await renderTab(`${PATH}${search}`);

      const buttons = names.map((name) =>
        panelOf(screen).getByRole("button", { name, exact: true }).element(),
      );
      expect(inPageOrder(...buttons)).toEqual(buttons);
      const boxes = buttons.map((button) => button.getBoundingClientRect());
      for (const [index, box] of boxes.entries()) {
        const before = boxes[index - 1];
        if (before !== undefined) {
          expect(box.left).toBeGreaterThan(before.right);
          expect(box.top).toBe(before.top);
        }
      }
      const table = tableOf(screen).element().getBoundingClientRect();
      expect(boxes.at(-1)?.bottom).toBeLessThan(table.top);
      // The table ends within the border line of its frame.
      expect(Math.abs((boxes.at(-1)?.right ?? 0) - table.right)).toBeLessThan(
        1.5,
      );
    },
  );

  test("reflows at 320 CSS pixels, the table scrolling within its frame rather than the page", async () => {
    await page.viewport(320, 640);
    stubReferences();
    const { screen } = await renderTab();

    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    expect(document.documentElement.scrollWidth).toBe(layoutWidth());
    expect(
      tableOf(screen)
        .getByRole("columnheader", { name: "Reference" })
        .element()
        .getBoundingClientRect().width,
    ).toBeGreaterThanOrEqual(192);
    const scroller = scrollerOf(screen);
    expect(getComputedStyle(scroller).overflowX).toBe("auto");
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  });

  test("wraps a title and an address without a point where they could break over several lines, the table keeping to its frame", async () => {
    const address = `https://advisories.example.com/${"fictional".repeat(40)}`;
    const titled = fictionalReference({
      title: "Fictional".repeat(30),
      url: address,
      description: null,
    });
    const untitled = fictionalReference({
      id: "00000000-0000-7000-8000-0000000000f6",
      title: null,
      url: `${address}-2`,
      description: null,
    });
    showing(titled, untitled);
    const { screen } = await renderTab();

    await expect.poll(() => namesOf(screen)).toHaveLength(2);
    const scroller = scrollerOf(screen);
    expect(scroller.scrollWidth).toBe(scroller.clientWidth);
    for (const reference of [titled, untitled]) {
      expect(
        linesOf(rowOf(screen, reference).getByRole("link").element()),
      ).toBeGreaterThan(1);
    }
    // The address below the title is a box of its own, as high as its lines.
    const below = rowOf(screen, titled)
      .getByText(address, { exact: true })
      .element();
    expect(below.getBoundingClientRect().height).toBeGreaterThan(
      1.5 * Number.parseFloat(getComputedStyle(below).lineHeight),
    );
  });
});

describe("the actions", () => {
  test("offer Edit and Delete at the end of the row of each manual reference alone, named after the reference, to a user who manages references", async () => {
    stubReferences();
    const { screen } = await renderTab();

    expect(
      tableOf(screen)
        .getByRole("button")
        .elements()
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Edit reference “Fictional advisory”",
      "Delete reference “Fictional advisory”",
      `Edit reference ${PATCH.url}`,
      `Delete reference ${PATCH.url}`,
      "Edit reference “Fictional mailing list post”",
      "Delete reference “Fictional mailing list post”",
    ]);
    for (const reference of [NVD, ISSUE]) {
      expect(rowOf(screen, reference).getByRole("button").elements()).toEqual(
        [],
      );
    }
    const row = rowOf(screen, ADVISORY).element().getBoundingClientRect();
    expect(
      Math.round(
        deleteOf(screen, ADVISORY).element().getBoundingClientRect().right,
      ),
    ).toBe(Math.round(row.right) - 16);
  });

  test("name the column of the actions for assistive technologies alone", async () => {
    stubReferences();
    const { screen } = await renderTab();

    const header = tableOf(screen).getByRole("columnheader", {
      name: "Actions",
    });
    await expect.element(header).toBeInTheDocument();
    // The header's own text, apart from Actions of the heading row of the
    // screen, which shows its label.
    expect(
      header
        .getByText("Actions", { exact: true })
        .element()
        .getBoundingClientRect().width,
    ).toBeLessThanOrEqual(1);
  });

  test.each([
    ["Edit", editOf],
    ["Delete", deleteOf],
  ] as const)(
    "show %s alone in the tooltip of the action",
    async (action, buttonOf) => {
      stubReferences();
      const { screen } = await renderTab();
      // React Aria shows a tooltip on hover only once the user works with a
      // pointer, as a click shows.
      await heading(screen, "SNTL-12").click();

      await userEvent.hover(buttonOf(screen, ADVISORY));

      const tooltip = page.getByRole("tooltip");
      await expect.element(tooltip).toBeVisible();
      expect(tooltip.element().textContent).toBe(action);
    },
  );

  test("offer neither Add reference nor Edit and Delete, nor the column of the actions, to a user who does not manage references", async () => {
    stubReferences({ user: OTHER_USER });
    const { screen } = await renderTab();

    expect(
      tableOf(screen)
        .getByRole("columnheader")
        .elements()
        .map((header) => header.textContent),
    ).toEqual(["Reference", "Type", "Source", "Added"]);
    expect(addButton(screen).query()).toBeNull();
    expect(
      tableOf(screen)
        .getByRole("button", { name: /^(Edit|Delete) reference/ })
        .elements(),
    ).toEqual([]);
    await expect
      .element(screen.getByRole("button", { name: "Filters" }))
      .toBeVisible();
  });
});

describe("the filters", () => {
  test("filter by the types chosen, Uncategorized included, each change as a new entry of the browser history, and announce what the table shows, also while the popover is open", async () => {
    stubReferences();
    const { router, screen } = await renderTab();
    const dialog = await openFilters(screen);
    await frames();
    expect(announcementsOf()).toEqual([]);
    expect(
      dialog
        .getByRole("group", { name: "Type" })
        .getByRole("checkbox")
        .elements()
        .map((checkbox) => readText(checkbox.closest("label") ?? checkbox)),
    ).toEqual(["Advisory", "Patch", "Issue", "Article", "Uncategorized"]);

    await toggleType(dialog, "Uncategorized");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?type=uncategorized`);
    await expect.poll(() => namesOf(screen)).toEqual([POST.title]);
    await expect.poll(() => announcementsOf()).toEqual(["1 reference"]);
    // Not again by a status region of the popover.
    expect(
      dialog.getByRole("status").filter({ hasText: "1 reference" }).query(),
    ).toBeNull();

    await toggleType(dialog, "Advisory");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?type=advisory&type=uncategorized`);
    await expect
      .poll(() => namesOf(screen))
      .toEqual([NVD.title, ADVISORY.title, POST.title]);
    await expect.poll(() => announcementsOf()).toEqual(["3 references"]);
    expect(router.history.length).toBe(3);
    await expect
      .element(screen.getByRole("button", { name: "Filters 1 applied" }))
      .toBeInTheDocument();

    await toggleType(dialog, "Advisory");
    await toggleType(dialog, "Uncategorized");

    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    await expect.poll(() => announcementsOf()).toEqual(["5 references"]);
  });

  test("leave a reference of a type that the pinned contract does not list out of every type", async () => {
    stubReferences({
      references: () =>
        unlistedResponse(ADVISORY, { ...ISSUE, type: "fictional_type" }),
    });
    const { screen } = await renderTab(
      `${PATH}?type=advisory&type=patch&type=issue&type=article&type=uncategorized`,
    );

    await expect.poll(() => namesOf(screen)).toEqual([ADVISORY.title]);
  });

  test("filter by the source chosen among the sources of the Ticket, Manual first and then by name, after Any source", async () => {
    stubReferences({
      references: () =>
        referencesResponse([
          ...EVERY_REFERENCE,
          fictionalReference({
            id: "00000000-0000-7000-8000-0000000000f6",
            url: "https://advisories.example.com/fictional-fetcher",
            title: "Fictional fetcher",
            source: "fictional_fetcher",
          }),
          fictionalReference({
            id: "00000000-0000-7000-8000-0000000000f7",
            url: "https://github.example.com/advisories/GHSA-0000-0000-0001",
            title: "GHSA advisory",
            source: "sync_ghsa_advisories",
          }),
        ]),
    });
    const { router, screen } = await renderTab();
    const dialog = await openFilters(screen);
    expect(readText(sourceSelectOf(dialog).element())).toBe("Any source");

    const options = await openSources(dialog);

    expect(optionNames(options)).toEqual([
      "Any source",
      "Manual",
      "GHSA",
      "NVD",
      "Red Hat",
    ]);
    await options.getByRole("option", { name: "Red Hat" }).click();

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?source=sync_redhat_cves`);
    await expect.poll(() => namesOf(screen)).toEqual([ISSUE.title]);
    expect(readText(sourceSelectOf(dialog).element())).toBe("Red Hat");
    await expect.poll(() => announcementsOf()).toEqual(["1 reference"]);
    expect(router.history.length).toBe(2);

    const again = await openSources(dialog);
    await again.getByRole("option", { name: "Any source" }).click();

    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect.poll(() => namesOf(screen)).toHaveLength(7);
  });

  test("offer no source that the pinned contract does not list, whose references still show, and which a URL still applies, shown as received", async () => {
    const unlisted = fictionalReference({
      id: "00000000-0000-7000-8000-0000000000f6",
      url: "https://advisories.example.com/fictional-fetcher",
      title: "Fictional fetcher",
      source: "fictional_fetcher",
    });
    stubReferences({
      references: () => referencesResponse([...EVERY_REFERENCE, unlisted]),
    });
    const { router, screen } = await renderTab();
    expect(namesOf(screen)).toContain(unlisted.title);
    expect(cellsOf(screen).at(-1)?.[2]).toBe("fictional_fetcher");
    const dialog = await openFilters(screen);

    const options = await openSources(dialog);

    expect(optionNames(options)).toEqual([
      "Any source",
      "Manual",
      "NVD",
      "Red Hat",
    ]);
    await userEvent.keyboard("{Escape}");
    await expect.element(options).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).not.toBeInTheDocument();

    router.history.push(`${PATH}?source=fictional_fetcher`);

    await expect.poll(() => namesOf(screen)).toEqual([unlisted.title]);
    const again = await openFilters(screen);
    expect(readText(sourceSelectOf(again).element())).toBe("fictional_fetcher");
  });

  test("apply the type and the source together", async () => {
    stubReferences();

    const { screen } = await renderTab(
      `${PATH}?type=advisory&type=issue&source=manual`,
    );

    await expect.poll(() => namesOf(screen)).toEqual([ADVISORY.title]);
    await expect
      .element(screen.getByRole("button", { name: "Filters 2 applied" }))
      .toBeVisible();
  });

  test("show the filters that apply", async () => {
    stubReferences();
    const { screen } = await renderTab(
      `${PATH}?type=issue&source=sync_redhat_cves`,
    );

    const dialog = await openFilters(screen);

    const types = dialog.getByRole("group", { name: "Type" });
    await expect
      .element(types.getByRole("checkbox", { name: "Issue" }))
      .toBeChecked();
    await expect
      .element(types.getByRole("checkbox", { name: "Advisory" }))
      .not.toBeChecked();
    expect(readText(sourceSelectOf(dialog).element())).toBe("Red Hat");
  });

  test.each([
    ["a source that it names", "sync_epss_scores", "EPSS"],
    [
      "a source that the pinned contract does not list",
      "fictional_fetcher",
      "fictional_fetcher",
    ],
  ])(
    "show %s that no reference has, from the URL, by its name, with no reference",
    async (_, source, name) => {
      stubReferences();
      const { screen } = await renderTab(`${PATH}?source=${source}`);

      await expect
        .element(panelOf(screen).getByText(NO_MATCH, { exact: true }))
        .toBeVisible();
      const dialog = await openFilters(screen);
      expect(readText(sourceSelectOf(dialog).element())).toBe(name);
    },
  );

  test("show the loading indicator in place of the sources while the references load", async () => {
    const references = later();
    stubReferences({ references: () => references.promise });
    const { screen } = await renderApp(PATH);
    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
    const dialog = await openFilters(screen);

    const options = await openSources(dialog);

    expect(optionNames(options)).toEqual(["Any source"]);
    // The loading indicator describes the options, so that it is read as
    // they open.
    await expect.element(options).toHaveAccessibleDescription("Loading");
    references.resolve(referencesResponse());
    await expect.poll(() => optionNames(options)).toHaveLength(4);
  });

  test("show the failure of the read of the references in place of the sources, and keep its announcement in reach while the popover is open", async () => {
    stubReferences({
      references: () => errorResponse(503, "DATABASE_UNAVAILABLE"),
    });
    const { screen } = await renderApp(PATH);
    await expect
      .element(panelOf(screen).getByText(MESSAGE_UNAVAILABLE))
      .toBeVisible();
    const dialog = await openFilters(screen);
    await expect
      .poll(() => announcementsOf())
      .toEqual([`${MESSAGE_UNAVAILABLE} ${REFERENCE}`]);

    const options = await openSources(dialog);

    expect(optionNames(options)).toEqual(["Any source"]);
    // The message describes the options, so that it is read as they open.
    await expect
      .element(options)
      .toHaveAccessibleDescription(MESSAGE_UNAVAILABLE);
  });

  test("show the failure of the read of the references in place of the sources when it fails while their menu is open, announced once, by the tab", async () => {
    const references = later();
    const { stub } = stubReferences({ references: () => references.promise });
    const { screen } = await renderApp(PATH);
    // The Ticket has arrived, so the tab shows the failure in its place.
    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
    const dialog = await openFilters(screen);
    const options = await openSources(dialog);
    stub.references = () => errorResponse(503, "DATABASE_UNAVAILABLE");

    references.resolve(errorResponse(503, "DATABASE_UNAVAILABLE"));

    await expect
      .element(sourceMenuOf().getByText(MESSAGE_UNAVAILABLE, { exact: true }))
      .toBeVisible();
    expect(optionNames(options)).toEqual(["Any source"]);
    await expect
      .poll(() => announcementsOf())
      .toEqual([`${MESSAGE_UNAVAILABLE} ${REFERENCE}`]);
    // Not again by a status region of the menu.
    expect(statusRegionsWith(sourceMenuOf(), MESSAGE_UNAVAILABLE)).toEqual([]);
  });

  test("announce the failure of the read of the references in place of the sources from their menu while the tab waits for the Ticket, which does not announce it", async () => {
    const ticket = later();
    const references = later();
    const { stub } = stubReferences({
      ticket: () => ticket.promise,
      references: () => references.promise,
    });
    const { screen } = await renderApp(PATH);
    await expect.element(heading(screen, "Ticket")).toBeVisible();
    const dialog = await openFilters(screen);
    await openSources(dialog);
    stub.references = () => errorResponse(503, "DATABASE_UNAVAILABLE");

    references.resolve(errorResponse(503, "DATABASE_UNAVAILABLE"));

    await expect
      .element(sourceMenuOf().getByText(MESSAGE_UNAVAILABLE, { exact: true }))
      .toBeVisible();
    // In a status region of the menu, which announces it while the menu
    // holds the focus.
    expect(statusRegionsWith(sourceMenuOf(), MESSAGE_UNAVAILABLE)).toHaveLength(
      1,
    );
    expect(announcementsOf()).toEqual([]);
  });
});

describe("Clear filters", () => {
  test.each([
    ["without a filter", "", false],
    ["with a type", "?type=patch", true],
    ["with a source", "?source=manual", true],
  ])("shows in the toolbar %s: %s", async (_, search, shown) => {
    stubReferences();
    const { screen } = await renderTab(`${PATH}${search}`);

    const clear = panelOf(screen).getByRole("button", {
      name: "Clear filters",
    });
    if (shown) {
      await expect.element(clear).toBeVisible();
    } else {
      expect(clear.query()).toBeNull();
    }
  });

  test("removes the filters, as a new entry of the browser history, and moves the focus to the heading", async () => {
    stubReferences();
    const { router, screen } = await renderTab(
      `${PATH}?type=patch&source=manual`,
    );
    await expect.poll(() => namesOf(screen)).toEqual([PATCH.url]);

    await press(panelOf(screen).getByRole("button", { name: "Clear filters" }));

    await expect.poll(() => router.state.location.href).toBe(PATH);
    expect(router.history.length).toBe(2);
    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    await expect.element(heading(screen, "SNTL-12")).toHaveFocus();
  });

  test("shows that no reference matches the filters inside the frame of the table, below its header row, with Clear filters, which shows them all and moves the focus to the heading", async () => {
    stubReferences();
    const { router, screen } = await renderTab(
      `${PATH}?type=article&source=manual`,
    );
    const message = panelOf(screen).getByText(NO_MATCH, { exact: true });

    await expect.element(message).toBeVisible();
    expect(rowsOf(screen)).toEqual([]);
    await expect
      .element(tableOf(screen).getByRole("columnheader", { name: "Reference" }))
      .toBeVisible();
    expect(message.element().getBoundingClientRect().top).toBeGreaterThan(
      tableOf(screen).element().getBoundingClientRect().bottom,
    );
    const clear = panelOf(screen).getByRole("button", {
      name: "Clear filters",
    });
    // The one of the toolbar, and the one of the empty state.
    expect(clear.elements()).toHaveLength(2);
    expect(clear.elements()[1]!.getBoundingClientRect().top).toBeGreaterThan(
      message.element().getBoundingClientRect().bottom,
    );

    await press(clear.nth(1));

    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    expect(router.state.location.href).toBe(PATH);
    expect(router.history.length).toBe(2);
    await expect.element(heading(screen, "SNTL-12")).toHaveFocus();
  });
});

describe("the announcements of the filters", () => {
  test("say nothing as the tab opens, also with filters", async () => {
    stubReferences();
    const { screen } = await renderTab(`${PATH}?type=patch`);
    await expect.poll(() => namesOf(screen)).toEqual([PATCH.url]);
    expect(announcementsOf()).toEqual([]);

    await openFilters(screen);

    await frames();
    expect(announcementsOf()).toEqual([]);
  });

  test("say that no reference matches the filters after a change that leaves none", async () => {
    stubReferences();
    const { screen } = await renderTab(`${PATH}?source=sync_redhat_cves`);
    const dialog = await openFilters(screen);

    await toggleType(dialog, "Patch");

    await expect.poll(() => announcementsOf()).toEqual([NO_MATCH]);
    await expect.element(dialog).toBeVisible();
  });

  test("say in the tab what the table shows after Clear filters on the line above it", async () => {
    stubReferences();
    const { screen } = await renderTab(`${PATH}?type=patch`);
    await expect.poll(() => namesOf(screen)).toEqual([PATCH.url]);

    await press(panelOf(screen).getByRole("button", { name: "Clear filters" }));

    await expect.poll(() => announcementsOf()).toEqual(["5 references"]);
  });

  test("say in the tab what the table shows after Clear filters of the empty state", async () => {
    stubReferences();
    const { screen } = await renderTab(`${PATH}?type=article&source=manual`);
    const clear = panelOf(screen).getByRole("button", {
      name: "Clear filters",
    });
    await expect.poll(() => clear.elements()).toHaveLength(2);

    await press(clear.nth(1));

    await expect.poll(() => announcementsOf()).toEqual(["5 references"]);
  });

  test("say in the tab what the table shows after the browser history changes the filters, and leave the focus where it was", async () => {
    stubReferences();
    const { router, screen } = await renderTab();
    const add = addButton(screen);
    add.element().focus();

    router.history.push(`${PATH}?type=patch`);
    await expect.poll(() => announcementsOf()).toEqual(["1 reference"]);
    router.history.push(`${PATH}?type=article`);
    await expect.poll(() => announcementsOf()).toEqual([NO_MATCH]);
    router.history.back();
    await expect.poll(() => announcementsOf()).toEqual(["1 reference"]);
    router.history.back();

    await expect.poll(() => announcementsOf()).toEqual(["5 references"]);
    expect(router.state.location.href).toBe(PATH);
    await expect.element(add).toHaveFocus();
  });

  test.each([
    [
      "a Delete that leaves no reference that matches them",
      "?type=uncategorized",
      async (screen: Screen) => {
        await deleteReference(screen, POST);
      },
      "Reference “Fictional mailing list post” deleted.",
    ],
    [
      "an Add of a reference that matches them",
      "?type=issue",
      async (screen: Screen) => {
        const dialog = await openAdd(screen);
        await fieldOf(dialog, "Address").fill(ADDED.url);
        await submit(dialog, "Add reference");
      },
      "Reference “Fictional packaging issue” added.",
    ],
  ])(
    "keep saying in the tab what the table showed after a change of the filters, after %s, which announces its own outcome",
    async (_, search, change, outcome) => {
      let references: TicketReferenceResponse[] = [...EVERY_REFERENCE];
      stubReferences({
        references: () => referencesResponse(references),
        add: () => {
          references = [...references, ADDED];
          return referenceResponse(ADDED, 201);
        },
        remove: () => {
          references = references.filter((item) => item.id !== POST.id);
          return deleted();
        },
      });
      const { router, screen } = await renderTab();
      router.history.push(`${PATH}${search}`);
      await expect.poll(() => announcementsOf()).toEqual(["1 reference"]);

      await change(screen);

      await expect
        .poll(() => announcementsOf())
        .toEqual(["1 reference", outcome]);
      await frames();
      expect(announcementsOf()).toEqual(["1 reference", outcome]);
    },
  );

  test("say each change of the filters in a node of its own, also with the same words", async () => {
    stubReferences();
    const { router } = await renderTab();
    router.history.push(`${PATH}?type=patch`);
    await expect.poll(() => announcementsOf()).toEqual(["1 reference"]);
    const node = announcementNode("1 reference");
    expect(node).not.toBeNull();

    router.history.push(`${PATH}?type=patch&source=manual`);

    await expect.poll(() => announcedAgain("1 reference", node)).toBe(true);
    expect(announcementsOf()).toEqual(["1 reference"]);
  });

  test("say No references. after a change of the filters of a Ticket without references, in the tab and in the popover", async () => {
    showing();
    const { screen } = await renderTab(`${PATH}?type=patch`);

    await press(panelOf(screen).getByRole("button", { name: "Clear filters" }));

    await expect.poll(() => announcementsOf()).toEqual(["No references."]);
    const node = announcementNode("No references.");
    expect(node).not.toBeNull();
    const dialog = await openFilters(screen);
    await toggleType(dialog, "Issue");
    await expect.poll(() => announcedAgain("No references.", node)).toBe(true);
    expect(announcementsOf()).toEqual(["No references."]);
    await expect.element(dialog).toBeVisible();
  });
});

describe("the URL", () => {
  test.each([
    ["a parameter that the tab does not accept", "?view=new", PATH],
    ["a type that it does not know", "?type=fictional", PATH],
    ["a type in another letter case", "?type=Patch", PATH],
    ["an empty source", "?source=", PATH],
    ["a repeated source", "?source=manual&source=sync_nvd_cves", PATH],
    [
      "a source of more than 100 characters",
      `?source=${"a".repeat(101)}`,
      PATH,
    ],
    ["a source with U+0000", "?source=man%00ual", PATH],
    [
      "the types once each, in their order, without one that it does not know",
      "?type=uncategorized&type=issue&type=fictional&type=issue",
      `${PATH}?type=issue&type=uncategorized`,
    ],
  ])(
    "leads from %s to the URL that the tab gives, in place of the URL",
    async (_, search, accepted) => {
      stubReferences();
      const { router } = await renderTab(`${PATH}${search}`);

      await expect.poll(() => router.state.location.href).toBe(accepted);
      expect(router.history.length).toBe(1);
    },
  );

  test("leads from a URL that the tab opens with a parameter that it does not accept to the URL that it gives, in place of that URL", async () => {
    stubReferences();
    const { router, screen } = await renderTab();

    router.history.push(`${PATH}?type=patch&view=new`);

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?type=patch`);
    expect(router.history.length).toBe(2);
    await expect.poll(() => namesOf(screen)).toEqual([PATCH.url]);
  });

  test("keeps every parameter that it accepts, in any order, the longest source included", async () => {
    stubReferences();
    const search = `?source=${"a".repeat(100)}&type=advisory&type=patch&type=issue&type=article&type=uncategorized`;
    const { router, screen } = await renderTab(`${PATH}${search}`);

    expect(router.state.location.href).toBe(`${PATH}${search}`);
    expect(router.history.length).toBe(1);
    await expect
      .element(screen.getByRole("button", { name: "Filters 2 applied" }))
      .toBeVisible();
  });

  test("keeps the anchor of a URL that it leads from", async () => {
    stubReferences();
    const { router } = await renderTab(`${PATH}?view=new#fictional`);

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}#fictional`);
  });
});

describe("the read", () => {
  test("shows the loading indicator in place of the references until they arrive", async () => {
    const references = later();
    stubReferences({ references: () => references.promise });
    const { screen } = await renderApp(PATH);

    await expect
      .element(panelOf(screen).getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();
    references.resolve(referencesResponse());

    await expect.poll(() => namesOf(screen)).toHaveLength(5);
    expect(
      panelOf(screen).getByRole("progressbar", { name: "Loading" }).query(),
    ).toBeNull();
  });

  test("shows its failure in place of the references, below the toolbar, announced, with Try again", async () => {
    let fail = true;
    stubReferences({
      references: () =>
        fail
          ? errorResponse(503, "DATABASE_UNAVAILABLE")
          : referencesResponse(),
    });
    const { screen } = await renderApp(PATH);

    const message = panelOf(screen).getByText(MESSAGE_UNAVAILABLE);
    await expect.element(message).toBeVisible();
    await expect
      .poll(() => announcementsOf())
      .toEqual([`${MESSAGE_UNAVAILABLE} ${REFERENCE}`]);
    expect(message.element().getBoundingClientRect().top).toBeGreaterThan(
      addButton(screen).element().getBoundingClientRect().bottom,
    );
    await expect.element(addButton(screen)).toBeVisible();
    fail = false;

    await panelOf(screen).getByRole("button", { name: "Try again" }).click();

    await expect.poll(() => namesOf(screen)).toHaveLength(5);
  });

  test.each([
    [
      "a status and a code that the contract does not list for it",
      418,
      "FICTIONAL_CODE",
      MESSAGE_NOT_ACCEPTED,
      false,
    ],
    [
      "a 5xx with a code that the contract does not list for it",
      507,
      "FICTIONAL_STORAGE_FULL",
      MESSAGE_UNAVAILABLE,
      true,
    ],
  ])(
    "shows the presentation of the status of %s",
    async (_, status, code, message, retry) => {
      stubReferences({ references: () => errorResponse(status, code) });
      const { screen } = await renderApp(PATH);

      await expect
        .element(panelOf(screen).getByText(message, { exact: true }))
        .toBeVisible();
      expect(
        panelOf(screen).getByRole("button", { name: "Try again" }).elements(),
      ).toHaveLength(retry ? 1 : 0);
    },
  );

  test("waits for the Ticket before its failure shows, with the loading indicator meanwhile", async () => {
    const ticket = later();
    const { spy } = stubReferences({
      ticket: () => ticket.promise,
      references: () => errorResponse(503, "DATABASE_UNAVAILABLE"),
    });
    const { screen } = await renderApp(PATH);

    // Sent again twice after a 5xx, as every read (docs/behaviors.md,
    // Retries and Unconfirmed Changes).
    await expect.poll(() => referenceReads(spy)).toHaveLength(3);
    await readEnded(REFERENCES);
    await expect
      .element(panelOf(screen).getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();
    expect(
      panelOf(screen).getByText(MESSAGE_UNAVAILABLE).elements(),
    ).toHaveLength(0);

    ticket.resolve(ticketResponse(fictionalTicketDetail()));

    await expect
      .element(panelOf(screen).getByText(MESSAGE_UNAVAILABLE))
      .toBeVisible();
    expect(
      panelOf(screen).getByRole("progressbar", { name: "Loading" }).query(),
    ).toBeNull();
  });

  test("keeps the references after a new read of them fails, with its warning above them and Try again", async () => {
    const { stub } = stubReferences();
    const { screen } = await renderTab();

    stub.references = () => errorResponse(503, "DATABASE_UNAVAILABLE");
    await returnToForeground();

    const warning = panelOf(screen).getByText(
      `This couldn't be updated. ${MESSAGE_UNAVAILABLE}`,
    );
    await expect.element(warning).toBeVisible();
    expect(warning.element().getBoundingClientRect().bottom).toBeLessThan(
      tableOf(screen).element().getBoundingClientRect().top,
    );
    expect(namesOf(screen)).toHaveLength(5);

    stub.references = () => referencesResponse([ADVISORY]);
    await panelOf(screen).getByRole("button", { name: "Try again" }).click();

    await expect.poll(() => namesOf(screen)).toEqual([ADVISORY.title]);
    expect(
      panelOf(screen)
        .getByText(/couldn't be updated/)
        .elements(),
    ).toHaveLength(0);
  });

  test("marks the references as being updated while Try again reads them after a new read failed", async () => {
    const { stub } = stubReferences();
    const { screen } = await renderTab();
    stub.references = () => errorResponse(503, "DATABASE_UNAVAILABLE");
    await returnToForeground();
    await expect
      .element(panelOf(screen).getByText(/couldn't be updated/))
      .toBeVisible();
    const reread = later();
    stub.references = () => reread.promise;

    await panelOf(screen).getByRole("button", { name: "Try again" }).click();

    await expect
      .element(panelOf(screen).getByRole("progressbar", { name: "Updating" }))
      .toBeVisible();
    reread.resolve(referencesResponse());
    await expect
      .element(panelOf(screen).getByRole("progressbar", { name: "Updating" }))
      .not.toBeInTheDocument();
  });
});

// Holds the animation frames that the page asks for, as a browser that
// renders no frame meanwhile, until the function that it returns renders
// the next one: it runs the callbacks held, in their order, after which the
// page has its frames again.
function holdFrames(): () => void {
  const requestFrame = window.requestAnimationFrame.bind(window);
  const cancelFrame = window.cancelAnimationFrame.bind(window);
  const held = new Map<number, FrameRequestCallback>();
  let holding = true;
  // Below the handles of the browser, which are positive.
  let handle = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    if (!holding) {
      return requestFrame(callback);
    }
    handle -= 1;
    held.set(handle, callback);
    return handle;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    if (!held.delete(id)) {
      cancelFrame(id);
    }
  });
  return () => {
    holding = false;
    const time = performance.now();
    for (const [id, callback] of held) {
      held.delete(id);
      callback(time);
    }
  };
}

// Gives a control of a row the focus as a press of the pointer does, so that
// React Aria's table records the cell that holds it: a focus while the user
// works with the keyboard, which treats the table as one stop of the tab
// order, moves on to the row that the table last focused, or to its first
// row.
async function focusInRow(screen: Screen, control: Locator) {
  await heading(screen, "SNTL-12").click();
  control.element().focus();
  await expect.element(control).toHaveFocus();
}

describe("the focus after a read", () => {
  test.each([
    [
      "Edit of a row, which a press of the pointer gave the focus",
      async (screen: Screen) => {
        await focusInRow(screen, editOf(screen, ADVISORY));
        return ADVISORY;
      },
    ],
    [
      "a row, which the keyboard reached",
      async (screen: Screen) => {
        // The last control of the line above the table without a filter.
        screen.getByRole("button", { name: "Filters" }).element().focus();
        await userEvent.keyboard("{Tab}");
        await expect.element(rowOf(screen, NVD)).toHaveFocus();
        return NVD;
      },
    ],
  ])(
    "moves to the screen's heading when a read removes the row of the focus, on %s",
    async (_, focus) => {
      const { stub } = stubReferences();
      const { screen } = await renderTab();
      const reference = await focus(screen);
      // Meanwhile another analyst deleted it.
      stub.references = () =>
        referencesResponse(
          EVERY_REFERENCE.filter((item) => item.id !== reference.id),
        );

      await returnToForeground();

      await expect.poll(() => namesOf(screen)).toHaveLength(4);
      await expectFocusSettledOn(heading(screen, "SNTL-12"));
    },
  );

  test("moves to the screen's heading after an Edit that the filters no longer match", async () => {
    const changed = { ...ADVISORY, type: "issue" as const };
    let references: TicketReferenceResponse[] = [...EVERY_REFERENCE];
    stubReferences({
      references: () => referencesResponse(references),
      update: () => {
        references = [NVD, PATCH, ISSUE, changed, POST];
        return referenceResponse(changed);
      },
    });
    const { screen } = await renderTab(`${PATH}?type=advisory`);
    const dialog = await openEdit(screen, ADVISORY);
    await chooseType(dialog, "Issue");

    await submit(dialog, "Save");

    await expect.poll(() => namesOf(screen)).toEqual([NVD.title]);
    await expectFocusSettledOn(heading(screen, "SNTL-12"));
  });

  test("moves to the screen's heading after an Edit that the filters no longer match, also when the read after it arrives as the focus returns to the row", async () => {
    const changed = { ...ADVISORY, type: "issue" as const };
    const reread = later();
    let updated = false;
    stubReferences({
      references: () =>
        updated ? reread.promise : referencesResponse(EVERY_REFERENCE),
      update: () => {
        updated = true;
        return referenceResponse(changed);
      },
    });
    const { screen } = await renderTab(`${PATH}?type=advisory`);
    const dialog = await openEdit(screen, ADVISORY);
    await chooseType(dialog, "Issue");
    const edit = editOf(screen, ADVISORY).element();
    // The read arrives as soon as the focus is back on Edit, before the
    // dialog that closed checks where the focus went.
    const onFocusIn = (event: FocusEvent) => {
      if (event.target === edit) {
        reread.resolve(referencesResponse([NVD, PATCH, ISSUE, changed, POST]));
      }
    };
    document.addEventListener("focusin", onFocusIn);

    try {
      await submit(dialog, "Save");

      await expect.poll(() => namesOf(screen)).toEqual([NVD.title]);
      await expectFocusSettledOn(heading(screen, "SNTL-12"));
    } finally {
      document.removeEventListener("focusin", onFocusIn);
    }
  });

  test("moves to the screen's heading after an Edit that the filters no longer match, also when the read after it takes the row away before the focus returns from the dialog", async () => {
    const changed = { ...ADVISORY, type: "issue" as const };
    const response = later();
    let references: TicketReferenceResponse[] = [...EVERY_REFERENCE];
    stubReferences({
      references: () => referencesResponse(references),
      update: () => {
        references = [NVD, PATCH, ISSUE, changed, POST];
        return response.promise;
      },
    });
    const { screen } = await renderTab(`${PATH}?type=advisory`);
    const dialog = await openEdit(screen, ADVISORY);
    await chooseType(dialog, "Issue");
    await submit(dialog, "Save");
    // The read after the change arrives before the browser renders a frame
    // after the dialog closes, in which React Aria returns the focus.
    const release = holdFrames();

    try {
      response.resolve(referenceResponse(changed));
      await expect.element(dialog).not.toBeInTheDocument();
      await expect.poll(() => namesOf(screen)).toEqual([NVD.title]);
      expect(focused()).toBe(document.body);
    } finally {
      release();
    }

    await expectFocusSettledOn(heading(screen, "SNTL-12"));
  });

  test.each([
    ["Edit reference", "Cancel"],
    ["Edit reference", "Escape"],
    ["Edit reference", "Discard"],
    ["the confirmation of Delete", "Cancel"],
    ["the confirmation of Delete", "Escape"],
  ] as const)(
    "moves to the screen's heading when a read removes the row of %s while it is open, once %s closes it",
    async (opened, way) => {
      const { stub } = stubReferences();
      const { screen } = await renderTab();
      const edits = opened === "Edit reference";
      const opener = (edits ? editOf : deleteOf)(screen, ADVISORY).element();
      let dialog: Locator;
      if (edits) {
        dialog = await openEdit(screen, ADVISORY);
        if (way === "Discard") {
          await fieldOf(dialog, "Title (optional)").fill("Fictional title");
        }
      } else {
        await deleteOf(screen, ADVISORY).click();
        dialog = confirmationOf(screen, ADVISORY);
        await expect
          .element(dialog.getByRole("button", { name: "Cancel" }))
          .toHaveFocus();
      }
      // Meanwhile another analyst deleted it.
      stub.references = () =>
        referencesResponse(
          EVERY_REFERENCE.filter((item) => item.id !== ADVISORY.id),
        );

      await returnToForeground();
      // The dialog keeps the rest of the page out of reach of assistive
      // technologies, so the test follows the element that opened it.
      await expect.poll(() => opener.isConnected).toBe(false);
      if (way === "Escape") {
        await userEvent.keyboard("{Escape}");
      } else {
        await dialog.getByRole("button", { name: "Cancel" }).click();
      }
      if (way === "Discard") {
        await screen
          .getByRole("dialog", { name: "Discard changes?" })
          .getByRole("button", { name: "Discard", exact: true })
          .click();
      }

      await expect.element(dialog).not.toBeInTheDocument();
      await expectFocusSettledOn(heading(screen, "SNTL-12"));
    },
  );

  test("moves to the screen's heading when a read leaves no reference where a row held it", async () => {
    const { stub } = stubReferences();
    const { screen } = await renderTab();
    await focusInRow(screen, editOf(screen, ADVISORY));
    stub.references = () => referencesResponse([]);

    await returnToForeground();

    await expect
      .element(panelOf(screen).getByText("No references.", { exact: true }))
      .toBeVisible();
    await expect.element(heading(screen, "SNTL-12")).toHaveFocus();
  });

  test("moves no more once the focus left the rows", async () => {
    const { stub } = stubReferences();
    const { screen } = await renderTab();
    await focusInRow(screen, editOf(screen, ADVISORY));
    addButton(screen).element().focus();
    addButton(screen).element().blur();
    stub.references = () => referencesResponse([NVD, PATCH, ISSUE, POST]);

    await returnToForeground();

    await expect.poll(() => namesOf(screen)).toHaveLength(4);
    await frames();
    expect(focused()).toBe(document.body);
  });

  test("moves no more once the pointer pressed outside the rows, where no element takes the focus", async () => {
    const { stub } = stubReferences();
    const { screen } = await renderTab();
    await focusInRow(screen, editOf(screen, ADVISORY));

    // On the empty space of the sidebar, below its links.
    await screen
      .getByRole("navigation", { name: "Main" })
      .click({ position: { x: 100, y: 400 } });
    expect(focused()).toBe(document.body);
    stub.references = () => referencesResponse([NVD, PATCH, ISSUE, POST]);
    await returnToForeground();

    await expect.poll(() => namesOf(screen)).toHaveLength(4);
    await frames();
    expect(focused()).toBe(document.body);
  });
});

describe("a change that ends after the user left the tab", () => {
  test("shows its success in the message area, naming the Ticket with a link to it", async () => {
    const response = later();
    stubReferences({ add: () => response.promise });
    const { router, screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await submit(dialog, "Add reference");
    await leave(router, screen);

    response.resolve(referenceResponse(ADDED, 201));

    const message = mainContent(screen).getByText(
      "SNTL-12: Reference “Fictional packaging issue” added.",
    );
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
    const link = screen.getByRole("link", { name: "SNTL-12", exact: true });
    await expect.element(link).toHaveAttribute("href", "/tickets/SNTL-12");

    await link.click();

    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
  });

  test("shows one message, naming the Ticket, for a reference that the filters of the tab hid", async () => {
    const response = later();
    stubReferences({ add: () => response.promise });
    const { router, screen } = await renderTab(`${PATH}?type=patch`);
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await submit(dialog, "Add reference");
    await leave(router, screen);

    response.resolve(referenceResponse(ADDED, 201));

    await expect
      .element(
        mainContent(screen).getByText(
          "SNTL-12: Reference “Fictional packaging issue” added.",
        ),
      )
      .toBeVisible();
    await frames();
    expect(
      mainContent(screen)
        .getByText(/added\.$/)
        .elements(),
    ).toHaveLength(1);
    expect(announcementsOf()).toEqual([
      "SNTL-12: Reference “Fictional packaging issue” added.",
    ]);
  });

  test.each([
    [
      "another tab of the Ticket, without the Ticket",
      async (screen: Screen) => {
        await screen.getByRole("tab", { name: "Audit log" }).click();
        await expect
          .element(screen.getByRole("tabpanel", { name: "Audit log" }))
          .toBeVisible();
      },
      "Reference “Fictional packaging issue” added.",
    ],
    [
      "another screen, naming the Ticket",
      async (screen: Screen, router: Router) => {
        await leave(router, screen);
      },
      "SNTL-12: Reference “Fictional packaging issue” added.",
    ],
  ])(
    "shows the outcome of a reference that the filters hid, which waited for the next read, once as the user leaves the tab for %s",
    async (_, leaveTab, text) => {
      const reread = later();
      let added = false;
      stubReferences({
        references: () => (added ? reread.promise : referencesResponse()),
        add: () => {
          added = true;
          return referenceResponse(ADDED, 201);
        },
      });
      const { router, screen } = await renderTab(`${PATH}?type=patch`);
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      await submit(dialog, "Add reference");
      await expect.element(dialog).not.toBeInTheDocument();
      expect(screen.getByText(/added\.$/).query()).toBeNull();

      await leaveTab(screen, router);

      const message = mainContent(screen).getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
      const record = screen.getByRole("link", { name: "SNTL-12", exact: true });
      if (text.startsWith("SNTL-12:")) {
        await expect
          .element(record)
          .toHaveAttribute("href", "/tickets/SNTL-12");
      } else {
        expect(record.query()).toBeNull();
      }
      // The read that it waited for adds nothing.
      reread.resolve(referencesResponse([...EVERY_REFERENCE, ADDED]));
      await frames();
      expect(
        mainContent(screen)
          .getByText(/added\.$/)
          .elements(),
      ).toHaveLength(1);
      expect(announcementsOf()).toEqual([text]);
    },
  );

  test("keeps its success in the message area until it is dismissed", async () => {
    const response = later();
    stubReferences({ add: () => response.promise });
    const { router, screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await submit(dialog, "Add reference");
    await leave(router, screen);
    await fakeMessageClock(screen);

    response.resolve(referenceResponse(ADDED, 201));

    const message = areaMessage(
      screen,
      "SNTL-12: Reference “Fictional packaging issue” added.",
    );
    await expect.element(message, ON_FAKE_CLOCK).toBeVisible();
    await expectStays(message);
  });

  test("keeps the outcome of a reference that the filters hid, which waited for the next read as the user left the tab, until it is dismissed", async () => {
    const reread = later();
    let added = false;
    stubReferences({
      references: () => (added ? reread.promise : referencesResponse()),
      add: () => {
        added = true;
        return referenceResponse(ADDED, 201);
      },
    });
    const { router, screen } = await renderTab(`${PATH}?type=patch`);
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);
    await submit(dialog, "Add reference");
    await expect.element(dialog).not.toBeInTheDocument();
    await fakeMessageClock(screen);

    await leave(router, screen);

    const message = areaMessage(
      screen,
      "SNTL-12: Reference “Fictional packaging issue” added.",
    );
    await expect.element(message, ON_FAKE_CLOCK).toBeVisible();
    await expectStays(message);
  });

  test("shows a change of a reference in the message area", async () => {
    const response = later();
    stubReferences({ update: () => response.promise });
    const { router, screen } = await renderTab();
    const dialog = await openEdit(screen, ADVISORY);
    await fieldOf(dialog, "Title (optional)").fill("Fictional title");
    await submit(dialog, "Save");
    await leave(router, screen);

    response.resolve(
      referenceResponse({ ...ADVISORY, title: "Fictional title" }),
    );

    await expect
      .element(
        mainContent(screen).getByText(
          "SNTL-12: Reference “Fictional title” changed.",
        ),
      )
      .toBeVisible();
  });

  test("shows Delete in the message area", async () => {
    const response = later();
    stubReferences({ remove: () => response.promise });
    const { router, screen } = await renderTab();
    await deleteReference(screen, PATCH);
    await leave(router, screen);

    response.resolve(deleted());

    await expect
      .element(
        mainContent(screen).getByText(
          `SNTL-12: Reference ${PATCH.url} deleted.`,
        ),
      )
      .toBeVisible();
  });

  test.each([
    [
      "that Sentinel did not confirm, as a warning",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      MESSAGE_UNCONFIRMED,
      MESSAGE_TONES.warning,
    ],
    [
      "that Sentinel refused, as an error",
      () => errorResponse(409, "RESOURCE_CONFLICT"),
      MESSAGE_CONFLICT,
      MESSAGE_TONES.danger,
    ],
  ])(
    "shows its failure %s in the message area, naming the Ticket",
    async (_, failure, message, tone) => {
      const response = later();
      stubReferences({ add: () => response.promise });
      const { router, screen } = await renderTab();
      const dialog = await openAdd(screen);
      await fieldOf(dialog, "Address").fill(ADDED.url);
      await submit(dialog, "Add reference");
      await leave(router, screen);

      response.resolve(failure());

      const shown = mainContent(screen).getByText(`SNTL-12: ${message}`);
      await expect.element(shown).toBeVisible();
      expect(backgroundBehind(shown.element())).toBe(tone);
      await expect
        .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
        .toHaveAttribute("href", "/tickets/SNTL-12");
    },
  );

  test("shows nothing in the message area for a change that ends on the tab", async () => {
    stubReferences({ add: () => referenceResponse(ADDED, 201) });
    const { screen } = await renderTab();
    const dialog = await openAdd(screen);
    await fieldOf(dialog, "Address").fill(ADDED.url);

    await submit(dialog, "Add reference");

    await expect
      .poll(() => announcementsOf())
      .toEqual(["Reference “Fictional packaging issue” added."]);
    expect(screen.getByText(/added\.$/).elements()).toHaveLength(1);
  });
});
