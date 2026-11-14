import { focusManager, type QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import type {
  CVEAffectedVersionEntry,
  CVEAffectedVersionGroup,
  CVEAffectedVersionsResponse,
} from "../api/generated/model";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import {
  errorResponse,
  FICTIONAL_USER,
  fictionalTicketDetail,
  jsonResponse,
  requestsTo,
  stubApi,
  ticketPage,
  ticketResponse,
  urlOf,
} from "../test-api";

// The tab Affected versions of the Ticket screen (docs/screens/ticket.md,
// Affected versions), at the browser's default text size, in the light
// theme, with fictional entries in the shapes that the mapping of each
// source gives them (Sentinel docs/features/tickets/cve-tracking.md, Get CVE
// Affected Versions, Interpreting entries).

const ME = "/api/v1/users/me";
const TICKETS = "/api/v1/tickets";
const TICKET = "/api/v1/tickets/SNTL-12";
const VERSIONS = "/api/v1/cves/CVE-2099-0012/affected-versions";
// The path of the tab.
const PATH = "/tickets/SNTL-12/affected-versions";

const MESSAGE_UNAVAILABLE =
  "Sentinel isn't available right now. Try again later.";
const MESSAGE_GONE =
  "This no longer exists, or you no longer have access to it.";
const NO_MATCH = "No entries match the search.";
const NO_ENTRIES = "Sentinel has no version data for this CVE.";
const EXPLANATION =
  "The versions of the affected software as the sources of the CVE report them.";

// The colors of docs/design-system.md (Color Tokens) in the light theme.
const SURFACE = "rgb(255, 255, 255)";
const TRANSPARENT = "rgba(0, 0, 0, 0)";

// A fictional entry, with every field absent but those that a test sets.
function entry(
  fields: Partial<CVEAffectedVersionEntry> = {},
): CVEAffectedVersionEntry {
  return {
    vendor: null,
    product: null,
    package_url: null,
    collection_url: null,
    package_name: null,
    repo: null,
    version: null,
    version_type: null,
    version_end: null,
    version_end_inclusive: null,
    program_files: null,
    cpe: null,
    ecosystem: null,
    status: null,
    default_status: null,
    ...fields,
  };
}

function group(
  source_container: string,
  ...entries: CVEAffectedVersionEntry[]
): CVEAffectedVersionGroup {
  return { source_container, entries };
}

const REPO = "https://git.example.com/fictional-tar";
const CNA_TAR = {
  vendor: "Example",
  product: "fictional-tar",
  collection_url: "https://packages.example.com",
  package_name: "fictional-tar",
  repo: REPO,
  program_files: ["src/extract.c", "src/names.c"],
  cpe: "cpe:2.3:a:example:fictional-tar:*:*:*:*:*:*:*:*",
  default_status: "unaffected",
};
const ADP_TAR = {
  vendor: "example",
  product: "fictional_tar",
  cpe: "cpe:2.3:a:example:fictional_tar:*:*:*:*:*:*:*:*",
  default_status: "unknown",
};
const NPM_TAR = {
  product: "fictional-tar",
  package_name: "fictional-tar",
  ecosystem: "npm",
};
const COMMIT_START = "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d";
const COMMIT_END = "9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c";

// The groups of a fictional CVE with four scopes, in the order of the API,
// as the example dataset gives CVE-2099-0009 (Sentinel
// docs/features/platform/example-dataset.md, Affected Versions).
const EVERY_SCOPE: CVEAffectedVersionGroup[] = [
  group(
    "adp:CISA-ADP",
    entry({
      ...ADP_TAR,
      version: "1.0",
      version_type: "custom",
      version_end: "1.4.2",
      version_end_inclusive: true,
      status: "affected",
    }),
    entry({
      ...ADP_TAR,
      version: "2.0.0-rc1",
      version_type: "custom",
      status: "unknown",
    }),
  ),
  group(
    "cna",
    entry({
      ...CNA_TAR,
      version: "1.0",
      version_type: "semver",
      version_end: "1.5",
      version_end_inclusive: false,
      status: "affected",
    }),
    entry({
      ...CNA_TAR,
      version: "1.5",
      version_type: "semver",
      status: "unaffected",
    }),
  ),
  group(
    "ghsa",
    entry({
      ...NPM_TAR,
      repo: REPO,
      version: "1.0.0",
      version_end: "1.5.0",
      version_end_inclusive: false,
    }),
  ),
  group(
    "osv",
    entry({
      repo: REPO,
      version: COMMIT_START,
      version_type: "git",
      version_end: COMMIT_END,
      version_end_inclusive: false,
    }),
    entry({
      ...NPM_TAR,
      package_url: "pkg:npm/fictional-tar",
      version: "1.0.0",
      version_end: "1.5.0",
      version_end_inclusive: false,
    }),
  ),
];

// Get CVE Affected Versions's response.
function versionsResponse(
  groups: readonly CVEAffectedVersionGroup[] = EVERY_SCOPE,
): Response {
  const body: CVEAffectedVersionsResponse = { data: [...groups] };
  return jsonResponse(200, body);
}

let client: QueryClient;

beforeEach(async () => {
  client = createQueryClient();
  // The delay between attempts is TanStack Query's; the tests remove it.
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
  });
  await page.viewport(1280, 800);
});

afterEach(async () => {
  // Before the responses go, so that the screen of the test reads nothing
  // more.
  await cleanup();
  client.clear();
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
  document.title = "Sentinel";
  window.scrollTo(0, 0);
  await page.viewport(414, 896);
});

interface Stub {
  // The response to Get Ticket.
  ticket: () => Response | Promise<Response>;
  // The response to Get CVE Affected Versions.
  versions: () => Response | Promise<Response>;
}

// Answers the read of the signed-in user, Get Ticket, Get CVE Affected
// Versions with every scope, and List Tickets, as the test sets them, every
// other read with a 404, and returns the stub, which a test can change, and
// the spy, whose calls name the requests.
function stubVersions(fields: Partial<Stub> = {}) {
  const stub: Stub = {
    ticket: () => ticketResponse(fictionalTicketDetail()),
    versions: () => versionsResponse(),
    ...fields,
  };
  const spy = stubApi((request) => {
    if (request.path === ME) {
      return jsonResponse(200, FICTIONAL_USER);
    }
    if (request.path === TICKET) {
      return stub.ticket();
    }
    if (request.path === VERSIONS) {
      return stub.versions();
    }
    if (request.path === TICKETS) {
      return ticketPage([]);
    }
    return errorResponse(404, "RESOURCE_NOT_FOUND");
  });
  return { stub, spy };
}

// Answers Get CVE Affected Versions with the groups.
function showing(...groups: CVEAffectedVersionGroup[]) {
  return stubVersions({ versions: () => versionsResponse(groups) });
}

async function renderApp(path: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  return { router, screen };
}

type Screen = Awaited<ReturnType<typeof renderApp>>["screen"];

function heading(screen: Screen, name: string) {
  return screen.getByRole("heading", { level: 1, name, exact: true });
}

function panelOf(screen: Screen) {
  return screen.getByRole("tabpanel", { name: "Affected versions" });
}

function searchOf(screen: Screen) {
  return panelOf(screen).getByRole("searchbox", { name: "Search entries" });
}

// Renders the tab and waits until it shows the Ticket and the first package
// of its CVE.
async function renderTab(path = PATH) {
  const rendered = await renderApp(path);
  await expect.element(heading(rendered.screen, "SNTL-12")).toBeVisible();
  await expect
    .element(
      panelOf(rendered.screen).getByRole("heading", { level: 2 }).first(),
    )
    .toBeVisible();
  return rendered;
}

// The text of a node as assistive technologies read it: without what it
// hides from them, such as the dot of a status, with a space around each
// element that is not inline.
function textOf(node: Node): string {
  if (node instanceof Text) {
    return node.data;
  }
  if (
    !(node instanceof Element) ||
    node.getAttribute("aria-hidden") === "true"
  ) {
    return "";
  }
  const text = [...node.childNodes].map(textOf).join("");
  return getComputedStyle(node).display === "inline" ? text : ` ${text} `;
}

// The text of an element as assistive technologies read it, with its spaces
// collapsed, as a line shows them.
function readText(element: Element): string {
  return textOf(element).replace(/\s+/g, " ").trim();
}

// The names of the packages, the level-two headings of the tab, in their
// order.
function packageNames(screen: Screen): string[] {
  return panelOf(screen)
    .getByRole("heading", { level: 2 })
    .elements()
    .map(readText);
}

interface ShownSource {
  source: string;
  lines: string[];
}

// The blocks of the sources of each package, by the name of the package:
// the name of each source, and each of its lines, as assistive technologies
// read them.
function blocksOf(screen: Screen): Record<string, ShownSource[]> {
  return Object.fromEntries(
    panelOf(screen)
      .getByRole("heading", { level: 2 })
      .elements()
      .map((name) => [
        readText(name),
        [...(name.closest("li")?.querySelectorAll("dt") ?? [])].map((term) => ({
          source: readText(term),
          lines: [
            ...(term.nextElementSibling?.querySelectorAll("li") ?? []),
          ].map(readText),
        })),
      ]),
  );
}

// The line of the versions that holds a text.
function lineOf(screen: Screen, text: string): Locator {
  return panelOf(screen).getByRole("listitem").filter({ hasText: text }).last();
}

// The texts of the status regions of the tab that say something.
function announcementsOf(screen: Screen): string[] {
  return panelOf(screen)
    .getByRole("status")
    .elements()
    .map((region) => region.textContent)
    .filter((text) => text !== "");
}

// The paths of the requests to the API, other than the read of the
// signed-in user.
function pathsOf(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input).pathname)
    .filter((path) => path !== ME);
}

// A response that the test gives when it chooses.
function later() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Presses a button from the keyboard, which keeps the focus on it.
async function press(button: Locator) {
  button.element().focus();
  await userEvent.keyboard("{Enter}");
}

// Applies a search term from the search field.
async function searchFor(screen: Screen, term: string) {
  await searchOf(screen).fill(term);
  await userEvent.keyboard("{Enter}");
}

// Opens the details of a source of a package, and returns them.
async function openDetails(screen: Screen, name: string) {
  await panelOf(screen).getByRole("button", { name, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect.element(dialog).toBeVisible();
  return dialog;
}

// The fields of a description list, as term and value.
function fieldsOf(list: Locator): [string, string][] {
  const values = list.getByRole("definition").elements();
  return list
    .getByRole("term")
    .elements()
    .map((term, index) => [
      readText(term),
      values[index] === undefined ? "" : readText(values[index]),
    ]);
}

describe("the tab", () => {
  test("opens at its path, selected, after References and before Audit log", async () => {
    stubVersions();

    const { screen } = await renderTab();

    const tabs = screen.getByRole("tablist", { name: "Ticket" });
    expect(
      tabs
        .getByRole("tab")
        .elements()
        .map((tab) => tab.textContent),
    ).toEqual(["Overview", "References", "Affected versions", "Audit log"]);
    await expect
      .element(tabs.getByRole("tab", { name: "Affected versions" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(tabs.getByRole("tab", { name: "Affected versions" }))
      .toHaveAttribute("href", PATH);
    expect(document.title).toBe("SNTL-12 – Sentinel");
  });

  test("shows its toolbar and the tabs at once, and reads the entries of the CVE once the Ticket names it", async () => {
    const ticket = later();
    const { spy } = stubVersions({ ticket: () => ticket.promise });

    const { screen } = await renderApp(PATH);

    await expect.element(heading(screen, "Ticket")).toBeVisible();
    await expect.element(searchOf(screen)).toBeVisible();
    await expect
      .element(panelOf(screen).getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();
    expect(requestsTo(spy, VERSIONS)).toBe(0);

    ticket.resolve(ticketResponse(fictionalTicketDetail()));

    await expect
      .poll(() => packageNames(screen))
      .toEqual(["fictional_tar", "fictional-tar", `${REPO} (another site)`]);
    await expect
      .element(panelOf(screen).getByText(EXPLANATION, { exact: true }))
      .toBeVisible();
  });

  test("reads the Ticket and the affected versions of its CVE, without parameters, as it opens, and none of the reads of the other tabs", async () => {
    const { spy } = stubVersions();

    await renderTab(`${PATH}?search=npm`);

    expect(new Set(pathsOf(spy))).toEqual(new Set([TICKET, VERSIONS]));
    expect(requestsTo(spy, VERSIONS)).toBe(1);
    const read = spy.mock.calls.find(
      ([input]) => urlOf(input).pathname === VERSIONS,
    );
    expect(read === undefined ? undefined : urlOf(read[0]).search).toBe("");
  });

  test("reads the affected versions only when it opens, not with Overview", async () => {
    const { spy } = stubVersions();
    const { router, screen } = await renderApp("/tickets/SNTL-12");
    await expect.element(heading(screen, "SNTL-12")).toBeVisible();
    await expect
      .element(screen.getByRole("heading", { level: 2, name: "Details" }))
      .toBeVisible();
    expect(requestsTo(spy, VERSIONS)).toBe(0);

    await screen
      .getByRole("tablist", { name: "Ticket" })
      .getByRole("tab", { name: "Affected versions" })
      .click();

    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect.poll(() => requestsTo(spy, VERSIONS)).toBe(1);
  });
});

describe("the packages", () => {
  test("show the entries by package, in alphabetical order, each a level-two heading in a band, the name of a repository as a link to it", async () => {
    stubVersions();

    const { screen } = await renderTab();

    expect(packageNames(screen)).toEqual([
      "fictional_tar",
      "fictional-tar",
      `${REPO} (another site)`,
    ]);
    await expect
      .element(
        panelOf(screen).getByRole("link", { name: `${REPO} (another site)` }),
      )
      .toHaveAttribute("href", REPO);
  });

  test("show within a package the block of each source, the CNA first, then the others in the order of the API, with the entries of each in that order", async () => {
    stubVersions();

    const { screen } = await renderTab();

    expect(blocksOf(screen)).toEqual({
      fictional_tar: [
        {
          source: "CISA-ADP",
          lines: [
            "From 1.0 through 1.4.2 Affected",
            "2.0.0-rc1 Unknown",
            "Other versions Unknown",
          ],
        },
      ],
      "fictional-tar": [
        {
          source: "CNA",
          lines: [
            "From 1.0 before 1.5 Affected",
            "1.5 Unaffected",
            "Other versions Unaffected",
          ],
        },
        { source: "GHSA", lines: ["From 1.0.0 before 1.5.0"] },
        { source: "OSV", lines: ["From 1.0.0 before 1.5.0"] },
      ],
      [`${REPO} (another site)`]: [
        {
          source: "OSV",
          lines: [`From ${COMMIT_START} before ${COMMIT_END}`],
        },
      ],
    });
  });

  test("put the CNA first within a package, before an ADP that the API orders before it", async () => {
    showing(
      group(
        "adp:CISA-ADP",
        entry({ product: "fictional-zlib", version: "1.1" }),
      ),
      group(
        "cna",
        entry({ product: "fictional-zlib", version: "1.2" }),
        entry({ product: "fictional-zlib", version: "1.0" }),
      ),
      group("osv", entry({ product: "fictional-zlib", version: "1.5" })),
    );

    const { screen } = await renderTab();

    expect(blocksOf(screen)["fictional-zlib"]).toEqual([
      { source: "CNA", lines: ["1.2", "1.0"] },
      { source: "CISA-ADP", lines: ["1.1"] },
      { source: "OSV", lines: ["From 1.5"] },
    ]);
  });

  test("name a package by its package name without a product, and show a package without any name last, as Unnamed product", async () => {
    showing(
      group(
        "ghsa",
        entry({ version: "1.0" }),
        entry({ package_name: "fictional-zlib", version: "2.0" }),
      ),
      group("cna", entry({ product: "fictional-zlib", version: "1.2" })),
    );

    const { screen } = await renderTab();

    expect(packageNames(screen)).toEqual(["fictional-zlib", "Unnamed product"]);
    expect(blocksOf(screen)["fictional-zlib"]).toEqual([
      { source: "CNA", lines: ["1.2"] },
      { source: "GHSA", lines: ["From 2.0"] },
    ]);
  });

  test("show a block for each set of the fields that the entries of a source share", async () => {
    const kernel = {
      vendor: "Fictional",
      product: "fictional-kernel",
      repo: "https://git.example.com/fictional-kernel.git",
    };
    showing(
      group(
        "cna",
        entry({
          ...kernel,
          default_status: "unaffected",
          version: COMMIT_START,
          version_type: "git",
          version_end: COMMIT_END,
          version_end_inclusive: false,
          status: "affected",
        }),
        entry({
          ...kernel,
          default_status: "affected",
          version: "6.1",
          status: "affected",
        }),
        entry({
          ...kernel,
          default_status: "affected",
          version: "6.7",
          version_type: "original_commit_for_fix",
          version_end: "*",
          version_end_inclusive: true,
          status: "unaffected",
        }),
      ),
    );

    const { screen } = await renderTab();

    expect(blocksOf(screen)["fictional-kernel"]).toEqual([
      {
        source: "CNA",
        lines: [
          `From ${COMMIT_START} before ${COMMIT_END} Affected`,
          "Other versions Unaffected",
        ],
      },
      {
        source: "CNA",
        lines: [
          "6.1 Affected",
          "From 6.7 through * Unaffected",
          "Other versions Affected",
        ],
      },
    ]);
  });

  test("name the scope of an ADP by its short name, GHSA and OSV as Sentinel names them, and a scope that the pinned contract does not list as received", async () => {
    showing(
      group("adp:", entry({ product: "fictional-zlib", version: "1.0" })),
      group(
        "adp:CISA-ADP",
        entry({ product: "fictional-zlib", version: "1.1" }),
      ),
      group("cna", entry({ product: "fictional-zlib", version: "1.2" })),
      group(
        "fictional_scope",
        entry({ product: "fictional-zlib", version: "1.3" }),
      ),
      group("ghsa", entry({ product: "fictional-zlib", version: "1.4" })),
      group("osv", entry({ product: "fictional-zlib", version: "1.5" })),
    );

    const { screen } = await renderTab();

    expect(blocksOf(screen)["fictional-zlib"]).toEqual([
      { source: "CNA", lines: ["1.2"] },
      { source: "adp:", lines: ["1.0"] },
      { source: "CISA-ADP", lines: ["1.1"] },
      { source: "fictional_scope", lines: ["1.3"] },
      { source: "GHSA", lines: ["From 1.4"] },
      { source: "OSV", lines: ["From 1.5"] },
    ]);
  });
});

describe("the versions", () => {
  test.each([
    ["a single version of a CVE record", "cna", { version: "1.5" }, "1.5"],
    [
      "a range of a CVE record that ends before its end",
      "cna",
      { version: "1.0", version_end: "1.5", version_end_inclusive: false },
      "From 1.0 before 1.5",
    ],
    [
      "a range of a CVE record that ends with its end",
      "adp:CISA-ADP",
      { version: "1.0", version_end: "1.4.2", version_end_inclusive: true },
      "From 1.0 through 1.4.2",
    ],
    [
      "a range without a start that ends before its end",
      "cna",
      { version_end: "1.5", version_end_inclusive: false },
      "Before 1.5",
    ],
    [
      "a range without a start that ends with its end",
      "ghsa",
      { version_end: "1.5", version_end_inclusive: true },
      "Through 1.5",
    ],
    [
      "a range whose end Sentinel does not say whether it includes",
      "cna",
      { version: "1.0", version_end: "2.0" },
      "From 1.0 up to 2.0",
    ],
    [
      "a range without a start whose end Sentinel does not say whether it includes",
      "cna",
      { version_end: "2.0" },
      "Up to 2.0",
    ],
    ["an open range of GHSA", "ghsa", { version: "1.0.0" }, "From 1.0.0"],
    ["an open range of OSV", "osv", { version: "1.0.0" }, "From 1.0.0"],
    [
      "a range of GHSA of one version",
      "ghsa",
      { version: "1.5.0", version_end: "1.5.0", version_end_inclusive: true },
      "1.5.0",
    ],
    [
      "an enumerated version of OSV",
      "osv",
      { version: "1.2.3", version_type: "exact" },
      "1.2.3",
    ],
    ["an entry of OSV without versions", "osv", {}, "Every version"],
    ["an entry of GHSA without versions", "ghsa", {}, "No version details"],
    [
      "a single version of a scope that the pinned contract does not list",
      "fictional_scope",
      { version: "1.5" },
      "1.5",
    ],
    [
      "a value that the source writes as a pattern, as received",
      "cna",
      { version: "6.1.42", version_end: "6.1.*", version_end_inclusive: true },
      "From 6.1.42 through 6.1.*",
    ],
  ])("say %s in words", async (_, scope, fields, words) => {
    showing(group(scope, entry({ product: "fictional-zlib", ...fields })));

    const { screen } = await renderTab();

    expect(blocksOf(screen)["fictional-zlib"]?.[0]?.lines).toEqual([words]);
  });

  test("show a commit in monospace", async () => {
    stubVersions();

    const { screen } = await renderTab();

    const commit = panelOf(screen).getByText(COMMIT_START, { exact: true });
    expect(getComputedStyle(commit.element()).fontFamily).toMatch(/mono/i);
    const version = panelOf(screen).getByText("2.0.0-rc1", { exact: true });
    expect(getComputedStyle(version.element()).fontFamily).not.toMatch(/mono/i);
  });

  test("show the status of each line at its end, the entry-level status of a line without its own, and a status that the pinned contract does not list as received", async () => {
    showing(
      group(
        "cna",
        entry({
          product: "fictional-zlib",
          version: "1.0",
          status: "affected",
        }),
        entry({
          product: "fictional-zlib",
          version: "1.1",
          status: "unaffected",
        }),
        entry({ product: "fictional-zlib", version: "1.2", status: "unknown" }),
        entry({ product: "fictional-zlib", version: "1.3", status: "fixed" }),
      ),
      group(
        "fictional_scope",
        entry({
          product: "fictional-zlib",
          version: "2.0",
          default_status: "affected",
        }),
      ),
    );

    const { screen } = await renderTab();

    expect(blocksOf(screen)["fictional-zlib"]).toEqual([
      {
        source: "CNA",
        lines: ["1.0 Affected", "1.1 Unaffected", "1.2 Unknown", "1.3 fixed"],
      },
      {
        source: "fictional_scope",
        lines: ["2.0 Affected", "Other versions Affected"],
      },
    ]);
    // The status ends the line, in a column of 104 px after its padding of
    // 8 px, far from the versions at the start of the line.
    const line = lineOf(screen, "1.0").element().getBoundingClientRect();
    const status = panelOf(screen)
      .getByText("Affected", { exact: true })
      .first()
      .element()
      .parentElement?.parentElement?.getBoundingClientRect();
    expect(status?.width).toBe(104);
    expect(line.right - (status?.right ?? 0)).toBe(8);
    expect(status?.left ?? 0).toBeGreaterThan(line.left + 700);
  });

  test("end a CVE record container with what applies to the versions that it does not list: Other versions, All versions when it lists none, or No version details without a default status", async () => {
    showing(
      group(
        "cna",
        entry({
          product: "fictional-zlib",
          version: "1.0",
          status: "affected",
          default_status: "unaffected",
        }),
        entry({ product: "fictional-curl", default_status: "affected" }),
        entry({ product: "fictional-lz4" }),
      ),
    );

    const { screen } = await renderTab();

    expect(blocksOf(screen)).toEqual({
      "fictional-curl": [{ source: "CNA", lines: ["All versions Affected"] }],
      "fictional-lz4": [{ source: "CNA", lines: ["No version details"] }],
      "fictional-zlib": [
        {
          source: "CNA",
          lines: ["1.0 Affected", "Other versions Unaffected"],
        },
      ],
    });
  });

  test("put a line on surface under the pointer", async () => {
    stubVersions();
    const { screen } = await renderTab();
    const line = lineOf(screen, "From 1.0 before 1.5");
    await heading(screen, "SNTL-12").hover();
    expect(getComputedStyle(line.element()).backgroundColor).toBe(TRANSPARENT);

    await line.hover();

    await expect
      .poll(() => getComputedStyle(line.element()).backgroundColor)
      .toBe(SURFACE);
  });

  test("keep the status of a line beside the first line of its versions where they wrap, at 320 CSS pixels", async () => {
    stubVersions();
    await page.viewport(320, 800);

    const { screen } = await renderTab();

    const line = lineOf(screen, "From 1.0 through 1.4.2").element();
    const [text, status] = [...line.children];
    const single = lineOf(screen, "2.0.0-rc1").element();
    expect(line.getBoundingClientRect().height).toBeGreaterThan(
      single.getBoundingClientRect().height * 1.5,
    );
    expect(
      Math.abs(
        (status?.getBoundingClientRect().top ?? 0) -
          (text?.getBoundingClientRect().top ?? 0),
      ),
    ).toBeLessThan(4);
    expect(document.documentElement.scrollWidth).toBe(
      document.documentElement.clientWidth,
    );
  });
});

describe("the details of a source", () => {
  test("open from the name of the source, named after its package, with the fields that its entries share", async () => {
    stubVersions();
    const { screen } = await renderTab();

    const dialog = await openDetails(screen, "CNA for fictional-tar");

    await expect
      .element(dialog.getByRole("heading", { name: "CNA" }))
      .toBeVisible();
    await expect.element(dialog.getByText("fictional-tar")).toBeVisible();
    expect(fieldsOf(dialog)).toEqual([
      ["Vendor", "Example"],
      ["Repository", `${REPO} (another site)`],
      ["Collection URL", "https://packages.example.com/ (another site)"],
      ["CPE", "cpe:2.3:a:example:fictional-tar:*:*:*:*:*:*:*:*"],
      ["Version type", "semver"],
      ["Program files", "src/extract.c, src/names.c"],
    ]);
    await expect
      .element(dialog.getByRole("link", { name: `${REPO} (another site)` }))
      .toHaveAttribute("href", REPO);

    await userEvent.keyboard("{Escape}");

    await expect
      .element(
        panelOf(screen).getByRole("button", { name: "CNA for fictional-tar" }),
      )
      .toHaveFocus();
  });

  test("show the ecosystem, the Package URL as text, a package name other than the name of the package, and each version type once", async () => {
    showing(
      group(
        "osv",
        entry({
          product: "fictional-kernel",
          package_name: "linux-fictional",
          ecosystem: "Debian:12",
          package_url: "pkg:deb/debian/linux-fictional",
          version_end: "6.1.42-1",
          version_end_inclusive: false,
        }),
        entry({
          product: "fictional-kernel",
          package_name: "linux-fictional",
          ecosystem: "Debian:12",
          package_url: "pkg:deb/debian/linux-fictional",
          version: "6.6",
          version_type: "exact",
        }),
        entry({
          product: "fictional-kernel",
          package_name: "linux-fictional",
          ecosystem: "Debian:12",
          package_url: "pkg:deb/debian/linux-fictional",
          version: "6.7",
          version_type: "exact",
        }),
      ),
    );
    const { screen } = await renderTab();

    const dialog = await openDetails(screen, "OSV for fictional-kernel");

    expect(fieldsOf(dialog)).toEqual([
      ["Package name", "linux-fictional"],
      ["Ecosystem", "Debian:12"],
      ["Package URL", "pkg:deb/debian/linux-fictional"],
      ["Version type", "exact"],
    ]);
    expect(dialog.getByRole("link").elements()).toHaveLength(0);
  });

  test("show an address that is not a web address as text, and leave out the field that names the package", async () => {
    showing(
      group(
        "osv",
        entry({
          repo: "https://git.example.com/fictional-zlib",
          collection_url: "git://git.example.com/fictional-zlib.git",
          version: COMMIT_START,
          version_type: "git",
        }),
      ),
    );
    const { screen } = await renderTab();

    const dialog = await openDetails(
      screen,
      "OSV for https://git.example.com/fictional-zlib",
    );

    expect(fieldsOf(dialog)).toEqual([
      ["Collection URL", "git://git.example.com/fictional-zlib.git"],
      ["Version type", "git"],
    ]);
    expect(dialog.getByRole("link").elements()).toHaveLength(0);
  });

  test("leave the name of a source whose entries share no field as text", async () => {
    showing(
      group("ghsa", entry({ product: "fictional-zlib", version: "1.0" })),
    );

    const { screen } = await renderTab();

    await expect
      .element(panelOf(screen).getByRole("term").first())
      .toHaveTextContent("GHSA");
    expect(
      panelOf(screen).getByRole("button", { name: /GHSA/ }).query(),
    ).toBeNull();
  });
});

describe("the search", () => {
  test("shows the entries that hold the term, without regard to case, in a value of the entry or of its details, as a new entry of the browser history", async () => {
    stubVersions();
    const { router, screen } = await renderTab();

    await searchFor(screen, "NPM");

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?search=NPM`);
    expect(router.history.length).toBe(2);
    await expect
      .poll(() => blocksOf(screen))
      .toEqual({
        "fictional-tar": [
          { source: "GHSA", lines: ["From 1.0.0 before 1.5.0"] },
          { source: "OSV", lines: ["From 1.0.0 before 1.5.0"] },
        ],
      });

    await searchFor(screen, "names.c");

    await expect
      .poll(() => blocksOf(screen))
      .toEqual({
        "fictional-tar": [
          {
            source: "CNA",
            lines: [
              "From 1.0 before 1.5 Affected",
              "1.5 Unaffected",
              "Other versions Unaffected",
            ],
          },
        ],
      });
  });

  test("keeps the line of the versions that a block does not list while it shows some of its entries", async () => {
    stubVersions();
    const { screen } = await renderTab(`${PATH}?search=1.4.2`);

    await expect
      .poll(() => blocksOf(screen))
      .toEqual({
        fictional_tar: [
          {
            source: "CISA-ADP",
            lines: [
              "From 1.0 through 1.4.2 Affected",
              "Other versions Unknown",
            ],
          },
        ],
      });
  });

  test("says that no entry matches inside the tab, with Clear filters, which shows every entry and moves the focus to the heading", async () => {
    stubVersions();
    const { router, screen } = await renderApp(`${PATH}?search=fictional-zlib`);
    const message = panelOf(screen).getByText(NO_MATCH, { exact: true });
    await expect.element(message).toBeVisible();
    const clear = panelOf(screen).getByRole("button", {
      name: "Clear filters",
    });
    // The one of the toolbar, and the one of the empty state.
    await expect.poll(() => clear.elements()).toHaveLength(2);

    await press(clear.nth(1));

    await expect.poll(() => packageNames(screen)).toHaveLength(3);
    expect(router.state.location.href).toBe(PATH);
    await expect.element(heading(screen, "SNTL-12")).toHaveFocus();
  });

  test("shows Clear filters in the toolbar while a search applies, which removes it", async () => {
    stubVersions();
    const { router, screen } = await renderTab();
    const clear = panelOf(screen).getByRole("button", {
      name: "Clear filters",
    });
    expect(clear.query()).toBeNull();
    await searchFor(screen, "npm");
    await expect.element(clear).toBeVisible();

    await press(clear);

    await expect.poll(() => router.state.location.href).toBe(PATH);
    await expect.poll(() => packageNames(screen)).toHaveLength(3);
    await expect.element(heading(screen, "SNTL-12")).toHaveFocus();
    await expect.element(searchOf(screen)).toHaveValue("");
  });

  test("announces what the tab shows after a search, and nothing as it opens, also with a search", async () => {
    stubVersions();
    const { router, screen } = await renderTab(`${PATH}?search=npm`);
    await expect.poll(() => packageNames(screen)).toEqual(["fictional-tar"]);
    expect(announcementsOf(screen)).toEqual([]);

    router.history.push(`${PATH}?search=custom`);
    await expect.poll(() => announcementsOf(screen)).toEqual(["2 entries"]);
    router.history.push(`${PATH}?search=2.0.0-rc1`);
    await expect.poll(() => announcementsOf(screen)).toEqual(["1 entry"]);
    router.history.push(`${PATH}?search=fictional-zlib`);
    await expect.poll(() => announcementsOf(screen)).toEqual([NO_MATCH]);
    router.history.push(PATH);

    await expect.poll(() => announcementsOf(screen)).toEqual(["7 entries"]);
  });

  test("announces No version data after a search of a CVE without entries", async () => {
    showing();
    const { router, screen } = await renderApp(`${PATH}?search=npm`);
    await expect
      .element(panelOf(screen).getByText(NO_ENTRIES, { exact: true }))
      .toBeVisible();

    router.history.push(PATH);

    await expect.poll(() => announcementsOf(screen)).toEqual([NO_ENTRIES]);
  });

  test.each([
    ["a parameter that the tab does not accept", "?view=new", PATH],
    ["an empty search", "?search=", PATH],
    ["a search of whitespace alone", "?search=%20%20", PATH],
    [
      "a search with surrounding whitespace",
      "?search=%20npm%20",
      `${PATH}?search=npm`,
    ],
    [
      "a search of more than 500 characters",
      `?search=${"a".repeat(501)}`,
      PATH,
    ],
    ["a search with U+0000", "?search=np%00m", PATH],
    ["a repeated search", "?search=npm&search=git", PATH],
  ])(
    "leads from a URL with %s to the URL that the tab gives, in place of the URL",
    async (_, search, accepted) => {
      stubVersions();
      const { router } = await renderApp(`${PATH}${search}`);

      await expect.poll(() => router.state.location.href).toBe(accepted);
      expect(router.history.length).toBe(1);
    },
  );

  test("keeps the longest search and the anchor of a URL", async () => {
    stubVersions();
    const term = "a".repeat(500);
    const { router } = await renderApp(`${PATH}?search=${term}&view=new#top`);

    await expect
      .poll(() => router.state.location.href)
      .toBe(`${PATH}?search=${term}#top`);
  });
});

describe("the states", () => {
  test("say that Sentinel has no version data for a CVE without entries, with the search", async () => {
    showing();

    const { screen } = await renderApp(PATH);

    await expect
      .element(panelOf(screen).getByText(NO_ENTRIES, { exact: true }))
      .toBeVisible();
    await expect.element(searchOf(screen)).toBeVisible();
  });

  test("say that a Ticket without a CVE has none, without the explanation, the search, and the read of the affected versions", async () => {
    const { spy } = stubVersions({
      ticket: () => ticketResponse(fictionalTicketDetail({ cve: null })),
    });

    const { screen } = await renderApp(PATH);

    await expect
      .element(
        panelOf(screen).getByText("This Ticket has no CVE.", { exact: true }),
      )
      .toBeVisible();
    expect(searchOf(screen).query()).toBeNull();
    expect(panelOf(screen).getByText(EXPLANATION).query()).toBeNull();
    expect(
      pathsOf(spy).filter((path) => path.startsWith("/api/v1/cves")),
    ).toEqual([]);
  });

  test("show the loading indicator in place of the entries until they arrive", async () => {
    const versions = later();
    stubVersions({ versions: () => versions.promise });
    const { screen } = await renderApp(PATH);
    await expect.element(heading(screen, "SNTL-12")).toBeVisible();

    await expect
      .element(panelOf(screen).getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();
    versions.resolve(versionsResponse());

    await expect.poll(() => packageNames(screen)).toHaveLength(3);
    expect(
      panelOf(screen).getByRole("progressbar", { name: "Loading" }).query(),
    ).toBeNull();
  });

  test("show the failure of the read in place of the entries, below the toolbar, in a status region, with Try again", async () => {
    let fail = true;
    stubVersions({
      versions: () =>
        fail ? errorResponse(503, "DATABASE_UNAVAILABLE") : versionsResponse(),
    });
    const { screen } = await renderApp(PATH);

    const message = panelOf(screen).getByText(MESSAGE_UNAVAILABLE);
    await expect.element(message).toBeVisible();
    expect(message.element().closest("output")).not.toBeNull();
    expect(message.element().getBoundingClientRect().top).toBeGreaterThan(
      searchOf(screen).element().getBoundingClientRect().bottom,
    );
    fail = false;

    await panelOf(screen).getByRole("button", { name: "Try again" }).click();

    await expect.poll(() => packageNames(screen)).toHaveLength(3);
  });

  test("show a CVE that is gone as a part that no longer exists, without Try again", async () => {
    stubVersions({ versions: () => errorResponse(404, "CVE_NOT_FOUND") });

    const { screen } = await renderApp(PATH);

    await expect
      .element(panelOf(screen).getByText(MESSAGE_GONE, { exact: true }))
      .toBeVisible();
    expect(
      panelOf(screen).getByRole("button", { name: "Try again" }).query(),
    ).toBeNull();
  });

  test("keep the entries after a new read of them fails, with its warning above them", async () => {
    const { stub } = stubVersions();
    const { screen } = await renderTab();

    stub.versions = () => errorResponse(503, "DATABASE_UNAVAILABLE");
    focusManager.setFocused(false);
    focusManager.setFocused(true);

    const warning = panelOf(screen).getByText(
      `This couldn't be updated. ${MESSAGE_UNAVAILABLE}`,
    );
    await expect.element(warning).toBeVisible();
    expect(packageNames(screen)).toHaveLength(3);
  });
});
