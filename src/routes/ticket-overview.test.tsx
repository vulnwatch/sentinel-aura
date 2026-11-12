import { focusManager, type QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { commands, page, userEvent, type Locator } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import type {
  CVECVSSAssessments,
  CVESourceStatusItem,
  CVSS20Assessment,
  CVSS30Assessment,
  CVSS40Assessment,
  CurrentUserResponse,
  PackageDetail,
  ProductDetail,
  TicketDetail,
  TrackDetail,
} from "../api/generated/model";
import { formatDateTime } from "../components/date-time";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import { participantsOf } from "./ticket-overview";
import { RETURN_URL_KEY, SESSION_RECORD_KEY } from "../session";
import {
  actorsResponse,
  cvssResponse,
  errorResponse,
  FICTIONAL_ACTORS,
  FICTIONAL_USER,
  fictionalDirectoryUser,
  fictionalGrant,
  grantResponse,
  grantsResponse,
  usersPage,
  validationError,
  fictionalAssessment,
  fictionalCvssAssessments,
  fictionalPackage,
  fictionalProduct,
  fictionalSource,
  fictionalSuseAssessment,
  fictionalTicketDetail,
  fictionalTrack,
  jsonResponse,
  OTHER_USER,
  refetchResponse,
  requestsTo,
  sourcesResponse,
  stubApi,
  ticketPage,
  ticketResponse,
  ticketWorkResponse,
  urlOf,
} from "../test-api";
import { screenshot } from "../test-screenshot";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reduce: boolean) => Promise<void>;
  }
}

// The package tree, the CVSS assessments, and the sources of the CVE of
// Overview, the first tab of the Ticket screen (docs/screens/ticket.md), at
// the browser's default text size, in the light theme.

const ME = "/api/v1/users/me";
const TICKETS = "/api/v1/tickets";
const TICKET = "/api/v1/tickets/SNTL-12";
const YOUR_WORK = "/api/v1/my/packages/tickets/SNTL-12";
const CVSS = "/api/v1/cves/CVE-2099-0012/cvss";
const SOURCES = "/api/v1/cves/CVE-2099-0012/sources";
const REFETCH = "/api/v1/cves/CVE-2099-0012/refetch";
const ACTORS = "/api/v1/tickets/SNTL-12/actors";
const ACCESS = "/api/v1/tickets/SNTL-12/access";
const USERS = "/api/v1/users";
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// The colors of docs/design-system.md (Color Tokens; Tones) in the light
// theme.
const FG = "rgb(31, 35, 40)";
const FG_MUTED = "rgb(89, 99, 110)";
const NEUTRAL_SOFT = "rgb(239, 242, 245)";
const LINK = "rgb(9, 105, 218)";
const BORDER = "rgb(216, 222, 228)";
const INFO_SOFT = "rgb(221, 244, 255)";
const INFO_ON_SOFT = "rgb(10, 48, 105)";
const WARNING_ON_SOFT = "rgb(108, 68, 0)";
const WARNING_ICON = "#9a6700";

// A maintainer without a role, who maintains fictional-openssl, the package
// of fictionalPackage.
const MAINTAINER: CurrentUserResponse = {
  data: {
    id: "00000000-0000-0000-0000-000000000004",
    username: "dbrown",
    email: "dave.brown@example.com",
    full_name: "Dave Brown",
    roles: [],
    capabilities: [],
    active: true,
    bot: false,
    assignment_eligibility: "none",
  },
};

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
  vi.useRealTimers();
  focusManager.setFocused(undefined);
  await commands.emulateReducedMotion(false);
  // What the session leaves in the storage, which the tab keeps for the test
  // files after this one: the record of the session, and the URL of the
  // screen that a test saves when it ends the session.
  window.localStorage.removeItem(SESSION_RECORD_KEY);
  window.sessionStorage.removeItem(RETURN_URL_KEY);
  document.title = "Sentinel";
  window.scrollTo(0, 0);
  await page.viewport(414, 896);
});

interface Stub {
  // The signed-in user, or the user at each read of it.
  user: CurrentUserResponse | (() => CurrentUserResponse);
  // The response to Get Ticket.
  ticket: () => Response | Promise<Response>;
  // The response to the read of the work of the signed-in user on the
  // Ticket.
  yourWork: () => Response | Promise<Response>;
  // The response to the read of the CVSS assessments of the CVE.
  cvss: () => Response | Promise<Response>;
  // The response to the read of the sources of the CVE.
  sources: () => Response | Promise<Response>;
  // The response to a refetch of the CVE, given its query.
  refetch: (query: URLSearchParams) => Response | Promise<Response>;
  // The response to the read of the users who acted on the Ticket.
  actors: () => Response | Promise<Response>;
  // The response to the read of the access grants of the Ticket.
  grants: () => Response | Promise<Response>;
  // The response to a search of the directory, given its query.
  users: (query: URLSearchParams) => Response | Promise<Response>;
  // The response to Grant Access, given its body.
  grant: (body: unknown) => Response | Promise<Response>;
  // The response to Revoke Access, given its path.
  revoke: (path: string) => Response | Promise<Response>;
}

// Answers the read of the signed-in user, an analyst who maintains no
// package unless the test says otherwise, Get Ticket, the read of the
// duplicates, the read of the work of the user, the read of the CVSS
// assessments, the read of the sources of the CVE, and its refetch, the
// reads of the participants, by default without any, the search of the
// directory, and Grant and Revoke Access, and returns the spy, whose calls
// name the requests.
function stubTicket(fields: Partial<Stub> = {}) {
  const stub: Stub = {
    user: OTHER_USER,
    ticket: () => ticketResponse(fictionalTicketDetail()),
    yourWork: () => ticketWorkResponse(),
    cvss: () => cvssResponse(),
    sources: () => sourcesResponse(),
    refetch: () => refetchResponse({ sources_enqueued: ["nvd"] }),
    actors: () => actorsResponse([]),
    grants: () => grantsResponse([]),
    users: () => usersPage([]),
    grant: () => grantResponse(fictionalGrant()),
    revoke: () => new Response(null, { status: 204 }),
    ...fields,
  };
  return stubApi((request) => {
    if (request.path === ME) {
      return jsonResponse(
        200,
        typeof stub.user === "function" ? stub.user() : stub.user,
      );
    }
    if (request.path === TICKETS) {
      return ticketPage([]);
    }
    if (request.path === YOUR_WORK) {
      return stub.yourWork();
    }
    if (request.path === ACTORS) {
      return stub.actors();
    }
    if (request.path === ACCESS && request.method === "POST") {
      return stub.grant(request.body);
    }
    if (request.path === ACCESS) {
      return stub.grants();
    }
    if (request.path.startsWith(`${ACCESS}/`) && request.method === "DELETE") {
      return stub.revoke(request.path);
    }
    if (request.path === USERS) {
      return stub.users(request.query);
    }
    if (request.path.startsWith(`${TICKETS}/`)) {
      return stub.ticket();
    }
    if (request.path === CVSS) {
      return stub.cvss();
    }
    if (request.path === SOURCES) {
      return stub.sources();
    }
    if (request.path === REFETCH && request.method === "POST") {
      return stub.refetch(request.query);
    }
    return errorResponse(404, "RESOURCE_NOT_FOUND");
  });
}

// Answers Get Ticket with a Ticket that has the packages.
function showing(
  packages: PackageDetail[],
  fields: Partial<TicketDetail> = {},
  stub: Partial<Stub> = {},
) {
  return stubTicket({
    ticket: () =>
      ticketResponse(fictionalTicketDetail({ packages, ...fields })),
    ...stub,
  });
}

// Answers Get Ticket with a Ticket whose package tree holds values that the
// pinned contract does not list, which a later Sentinel release can return.
function showingUnlisted(packages: Record<string, unknown>[]) {
  return stubTicket({
    ticket: () =>
      jsonResponse(200, { data: { ...fictionalTicketDetail(), packages } }),
  });
}

async function renderApp(path: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  return { router, screen };
}

type Screen = Awaited<ReturnType<typeof renderApp>>["screen"];

// Renders the screen of SNTL-12 and waits until it shows its package tree.
async function renderTree(path = "/tickets/SNTL-12") {
  const rendered = await renderApp(path);
  await expect.element(packagesPart(rendered.screen)).toBeVisible();
  return rendered;
}

function packagesPart(screen: Screen) {
  return screen.getByRole("region", { name: "Packages", exact: true });
}

// The band of a package, by the name of its heading.
function band(screen: Screen, name: string): HTMLElement {
  const title = packagesPart(screen)
    .getByRole("heading", { level: 3, name, exact: true })
    .element();
  if (!(title.parentElement instanceof HTMLElement)) {
    throw new Error(`The package ${name} has no band`);
  }
  return title.parentElement;
}

// The list item of a track, by its reference: the innermost of the items
// that hold it, the last in the order of the page, within the item of its
// package. A locator within a filter is relative to the items, so it starts
// from the page.
function trackOf(screen: Screen, reference: string): Locator {
  return packagesPart(screen)
    .getByRole("listitem")
    .filter({ has: page.getByText(reference, { exact: true }) })
    .last();
}

// The list item of a Product, by its name.
function productOf(screen: Screen, name: string): Locator {
  return packagesPart(screen)
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name, exact: true }) })
    .last();
}

// The distance between two colors, #rrggbb, as the largest difference of
// their channels.
function distance(one: string, other: string): number {
  return Math.max(
    ...[1, 3, 5].map((start) =>
      Math.abs(
        Number.parseInt(one.slice(start, start + 2), 16) -
          Number.parseInt(other.slice(start, start + 2), 16),
      ),
    ),
  );
}

// The release of a Product as its details show it, or undefined where they
// show none; the details close again.
async function releaseInDetails(
  screen: Screen,
  name: string,
): Promise<string | undefined> {
  await screen.getByRole("button", { name, exact: true }).click();
  const details = screen.getByRole("dialog", { name });
  await expect.element(details).toHaveFocus();
  const terms = details
    .getByRole("term")
    .elements()
    .map((element) => element.textContent);
  const definitions = details
    .getByRole("definition")
    .elements()
    .map((element) => element.textContent);
  await userEvent.keyboard("{Escape}");
  await expect.element(details).not.toBeInTheDocument();
  const index = terms.indexOf("Release");
  return index === -1 ? undefined : (definitions[index] ?? undefined);
}

function showHidden(screen: Screen) {
  return screen.getByRole("switch", { name: /^Show hidden/ });
}

// Presses Show hidden where a pointer does: on its rail and its label, which
// cover the input of the switch.
async function pressShowHidden(screen: Screen) {
  const label = showHidden(screen).element().closest("label");
  if (label === null) {
    throw new Error("Show hidden has no label");
  }
  await page.elementLocator(label).click();
}

// The rectangle of an element on the screen.
function boxOf(element: Locator | Element): DOMRect {
  return (
    "element" in element ? element.element() : element
  ).getBoundingClientRect();
}

function colorOf(element: Element): string {
  return getComputedStyle(element).color;
}

// A date and time of the API that lies the duration from now.
function fromNow(duration: number): string {
  return new Date(Date.now() + duration).toISOString();
}

// The tab returns to the foreground after being hidden.
function returnToForeground() {
  focusManager.setFocused(false);
  focusManager.setFocused(true);
}

// A response that the test gives when it chooses.
function later() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// The milestones of a track whose every phase is not applicable, such as a
// track that is not actionable, whose current phase is done.
const NOT_APPLICABLE: Pick<TrackDetail, "milestones" | "current_phase"> = {
  milestones: {
    triage: "not_applicable",
    submission: "not_applicable",
    um: "not_applicable",
    qa: "not_applicable",
  },
  current_phase: "done",
};

// The fields of a track without due dates, whose Ticket has no SLA.
const NO_SLA: Partial<TrackDetail> = {
  triage_due_at: null,
  submission_due_at: null,
  um_due_at: null,
  qa_due_at: null,
  release_due_at: null,
  milestones: { triage: null, submission: null, um: null, qa: null },
  current_phase: null,
};

// The milestones of a track whose later phases Sentinel does not observe,
// such as a Git track or a track of a Ticket without a CVE, after its triage,
// with due dates: its current phase is null.
const UNOBSERVED: Pick<TrackDetail, "milestones" | "current_phase"> = {
  milestones: { triage: "done", submission: null, um: null, qa: null },
  current_phase: null,
};

// The eligibility of a Product that a user set by hand to not eligible, with
// its provenance, which Sentinel returns with every override (Sentinel
// docs/features/packages/package-model.md, Override Model).
const SET_BY_HAND: Partial<ProductDetail> = {
  eligible: false,
  is_eligible_override: true,
  eligibility_override_by: {
    id: "00000000-0000-0000-0000-000000000003",
    username: "asmith",
    full_name: "Alice Smith",
    active: true,
    bot: false,
  },
  eligibility_override_at: "2099-10-10T11:00:00Z",
};

// A Product that is excluded from its track.
function excludedProduct(fields: Partial<ProductDetail> = {}): ProductDetail {
  return fictionalProduct({
    id: "00000000-0000-0000-0000-0000000000c2",
    product_name: "Fictional Linux Enterprise Desktop 15 SP7",
    product_cpe: "cpe:/o:example:fled:15:sp7",
    deleted_at: "2099-10-10T10:00:00Z",
    actionable: false,
    non_actionable_reason: "product_excluded",
    ...fields,
  });
}

// A Product at the end of its life.
function eolProduct(fields: Partial<ProductDetail> = {}): ProductDetail {
  return fictionalProduct({
    id: "00000000-0000-0000-0000-0000000000c3",
    product_name: "Fictional Linux Enterprise Server 15 SP3",
    product_cpe: "cpe:/o:example:fles:15:sp3",
    lifecycle_phase: "eol",
    actionable: false,
    non_actionable_reason: "eol",
    ...fields,
  });
}

// A track that is excluded, with a Product that is excluded through it.
function excludedTrack(fields: Partial<TrackDetail> = {}): TrackDetail {
  return fictionalTrack({
    id: "00000000-0000-0000-0000-0000000000b2",
    reference: "SUSE:FLES-15-SP6:Update",
    status: "analysis",
    deleted_at: "2099-10-10T10:00:00Z",
    actionable: false,
    non_actionable_reason: "track_excluded",
    products: [
      fictionalProduct({
        id: "00000000-0000-0000-0000-0000000000c4",
        product_name: "Fictional Linux Enterprise Server 15 SP6",
        product_cpe: "cpe:/o:example:fles:15:sp6",
        actionable: false,
        non_actionable_reason: "track_excluded",
      }),
    ],
    ...NOT_APPLICABLE,
    ...fields,
  });
}

// A package that is excluded, with its track and Product.
function excludedPackage(): PackageDetail {
  return fictionalPackage({
    id: "00000000-0000-0000-0000-0000000000a3",
    package_name: "fictional-libpng",
    deleted_at: "2099-10-10T10:00:00Z",
    actionable: false,
    non_actionable_reason: "package_excluded",
    maintainers: [],
    tracks: [
      fictionalTrack({
        id: "00000000-0000-0000-0000-0000000000b3",
        status: "analysis",
        actionable: false,
        non_actionable_reason: "package_excluded",
        products: [
          fictionalProduct({
            id: "00000000-0000-0000-0000-0000000000c5",
            actionable: false,
            non_actionable_reason: "package_excluded",
          }),
        ],
        ...NOT_APPLICABLE,
      }),
    ],
  });
}

describe("the part", () => {
  test("follows the CVE in the main column, with a level-two heading, and is the target of its anchor", async () => {
    await page.viewport(1280, 300);
    showing([fictionalPackage()]);

    const { screen } = await renderTree("/tickets/SNTL-12#packages");

    const part = packagesPart(screen);
    await expect
      .element(part.getByRole("heading", { level: 2, name: "Packages" }))
      .toBeVisible();
    expect(
      screen
        .getByRole("region", { name: "CVE-2099-0012" })
        .element()
        .compareDocumentPosition(part.element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    await expect
      .element(part.getByRole("heading", { level: 2 }))
      .toBeInViewport();
  });

  test("says No packages. for a Ticket without packages, without the switch", async () => {
    showing([]);

    const { screen } = await renderTree();

    await expect
      .element(packagesPart(screen).getByText("No packages.", { exact: true }))
      .toBeVisible();
    expect(colorOf(screen.getByText("No packages.").element())).toBe(FG_MUTED);
    expect(showHidden(screen).elements()).toHaveLength(0);
  });

  test("shows each package as a group under a band, 32 px apart, its tracks 12 px below the band and indented by 12 px, in the order of the API", async () => {
    showing([
      fictionalPackage(),
      fictionalPackage({
        id: "00000000-0000-0000-0000-0000000000a2",
        package_name: "fictional-zlib",
        tracks: [
          fictionalTrack({
            id: "00000000-0000-0000-0000-0000000000b2",
            workflow_type: "git",
            reference: "fles-16.0",
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const headings = packagesPart(screen).getByRole("heading", { level: 3 });
    expect(headings.elements().map((element) => element.textContent)).toEqual([
      "fictional-openssl",
      "fictional-zlib",
    ]);
    const first = band(screen, "fictional-openssl");
    const style = getComputedStyle(first);
    expect(style.backgroundColor).toBe(NEUTRAL_SOFT);
    expect(style.borderRadius).toBe("6px");
    expect(style.paddingLeft).toBe("12px");
    expect(style.borderTopWidth).toBe("0px");
    expect(boxOf(first).height).toBeGreaterThanOrEqual(32);
    const title = getComputedStyle(
      screen.getByRole("heading", { name: "fictional-openssl" }).element(),
    );
    expect(title.fontSize).toBe("15px");
    expect(title.fontWeight).toBe("600");
    const track = trackOf(screen, "SUSE:FLES-15-SP7:Update").first();
    expect(boxOf(track).top - boxOf(first).bottom).toBe(12);
    expect(boxOf(track).left - boxOf(first).left).toBe(12);
    const second = band(screen, "fictional-zlib");
    const firstGroup = first.parentElement;
    expect(firstGroup).not.toBeNull();
    expect(boxOf(second).top - boxOf(firstGroup!).bottom).toBe(32);
  });

  test("lists the tracks and the Products as nested lists", async () => {
    showing([fictionalPackage()]);

    const { screen } = await renderTree();

    const product = screen.getByRole("button", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });
    // The Product, in the list of its track, in the list of the package, in
    // the list of the packages.
    let lists = 0;
    for (
      let element = product.element().parentElement;
      element !== null;
      element = element.parentElement
    ) {
      if (element.tagName === "UL") {
        lists += 1;
      }
    }
    expect(lists).toBe(3);
  });

  test("reflows at 320 CSS pixels without scrolling in two directions, its names wrapping", async () => {
    await page.viewport(320, 640);
    // Names without a place where a line breaks by itself, such as a space or
    // a hyphen.
    const long = `fictional${"package".repeat(8)}`;
    showing([
      fictionalPackage({
        package_name: long,
        tracks: [
          fictionalTrack({
            reference: "SUSE:FLES-15-SP7:Update:Fictional:Very:Long:Reference",
            products: [
              fictionalProduct({
                product_name: `Fictional Linux Enterprise ${"Server".repeat(8)} 15 SP7`,
              }),
            ],
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    expect(document.documentElement.scrollWidth).toBe(
      document.documentElement.clientWidth,
    );
    await expect
      .element(screen.getByRole("heading", { level: 3, name: long }))
      .toBeVisible();
  });
});

describe("a package", () => {
  test("shows its maintainers in its band, and opens them in the order of the API", async () => {
    showing([
      fictionalPackage({
        maintainers: [
          {
            id: "00000000-0000-0000-0000-000000000004",
            username: "dbrown",
            full_name: "Dave Brown",
            active: true,
            bot: false,
          },
          {
            id: "00000000-0000-0000-0000-000000000005",
            username: "ghill",
            full_name: "Grace Hill",
            active: false,
            bot: false,
          },
        ],
      }),
    ]);
    const { screen } = await renderTree();
    const button = screen.getByRole("button", {
      name: "2 maintainers of fictional-openssl",
    });
    expect(band(screen, "fictional-openssl").contains(button.element())).toBe(
      true,
    );

    await button.click();

    const popover = screen.getByRole("dialog", {
      name: "Maintainers of fictional-openssl",
    });
    await expect.element(popover).toHaveFocus();
    expect(
      popover
        .getByRole("listitem")
        .elements()
        .map((element) => element.textContent),
    ).toEqual(["Dave Brown @dbrown", "Grace Hill @ghillInactive"]);
  });
});

describe("a track", () => {
  test("shows its reference and its affectedness on its first line, without its workflow", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack(),
          fictionalTrack({
            id: "00000000-0000-0000-0000-0000000000b2",
            workflow_type: "git",
            reference: "fles-16.0",
            status: "not_affected",
            delivery_relevant: false,
            ...NOT_APPLICABLE,
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const ibs = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    await expect
      .element(ibs.getByText("Affected", { exact: true }))
      .toBeVisible();
    const git = trackOf(screen, "fles-16.0");
    await expect
      .element(git.getByText("Not affected", { exact: true }))
      .toBeVisible();
    for (const track of [ibs, git]) {
      expect(track.getByText(/^(?:IBS|Git)$/i).elements()).toHaveLength(0);
    }
    // The affectedness on the line of the reference, toward its end.
    const affected = boxOf(ibs.getByText("Affected", { exact: true }));
    expect(affected.top).toBeLessThan(
      boxOf(ibs.getByText("SUSE:FLES-15-SP7:Update")).bottom,
    );
    expect(affected.left).toBeGreaterThan(
      boxOf(packagesPart(screen)).right - 104,
    );
    const reference = getComputedStyle(
      screen.getByText("SUSE:FLES-15-SP7:Update", { exact: true }).element(),
    );
    expect(reference.fontWeight).toBe("500");
  });

  test("lines up the pipelines and the affectedness of its tracks, 12 px apart", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({ status: "analysis" }),
          fictionalTrack({
            id: "00000000-0000-0000-0000-0000000000b2",
            reference: "SUSE:FLES-15-SP6:Update",
            status: "fixed",
            delivery_relevant: false,
          }),
          fictionalTrack({
            id: "00000000-0000-0000-0000-0000000000b3",
            workflow_type: "git",
            reference: "fles-16.0",
            status: "not_affected",
            delivery_relevant: false,
            ...NOT_APPLICABLE,
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    await expect
      .element(
        trackOf(screen, "SUSE:FLES-15-SP7:Update").getByRole("button", {
          name: /^Phases of/,
        }),
      )
      .toBeVisible();
    const tracks = (
      [
        ["SUSE:FLES-15-SP7:Update", "Analysis"],
        ["SUSE:FLES-15-SP6:Update", "Fixed"],
        ["fles-16.0", "Not affected"],
      ] as const
    ).map(([reference, affectedness]) => {
      const track = trackOf(screen, reference);
      return {
        item: boxOf(track),
        reference: boxOf(track.getByText(reference, { exact: true })),
        affectedness: boxOf(track.getByText(affectedness, { exact: true })),
        pipeline: track.getByRole("button", { name: /^Phases of/ }).query(),
      };
    });
    const pipelines = tracks
      .slice(0, 2)
      .map(({ pipeline }) => boxOf(pipeline!));
    // Each pipeline on the line of its reference, at the same place.
    for (const [index, pipeline] of pipelines.entries()) {
      expect(pipeline.top).toBeLessThan(tracks[index]!.reference.bottom);
    }
    expect(pipelines[0]!.right).toBeCloseTo(pipelines[1]!.right, 0);
    // The affectedness on the line of its reference, at the same place on
    // every track, Not affected, the widest, included; its text follows its
    // dot of 8 px 6 px later, 12 px after the pipeline.
    for (const { affectedness, reference } of tracks) {
      expect(affectedness.top).toBeLessThan(reference.bottom);
      expect(affectedness.left).toBeCloseTo(tracks[0]!.affectedness.left, 0);
    }
    expect(tracks[0]!.affectedness.left - pipelines[0]!.right).toBeCloseTo(
      12 + 8 + 6,
      0,
    );
    // The tracks 12 px apart.
    expect(tracks[1]!.item.top - tracks[0]!.item.bottom).toBeCloseTo(12, 0);
    expect(tracks[2]!.item.top - tracks[1]!.item.bottom).toBeCloseTo(12, 0);
  });

  test.each<[TrackDetail["status"], string]>([
    ["analysis", "Analysis"],
    ["affected", "Affected"],
    ["not_affected", "Not affected"],
    ["fixed", "Fixed"],
    ["wont_fix", "Won't fix"],
  ])("names the affectedness %s %s", async (status, name) => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            status,
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    await expect
      .element(
        trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText(name, {
          exact: true,
        }),
      )
      .toBeVisible();
  });

  test("shows values that the pinned contract does not list as received", async () => {
    showingUnlisted([
      {
        ...fictionalPackage(),
        tracks: [
          {
            ...fictionalTrack(),
            status: "partially_affected",
            delivery_status: "on_hold",
            milestones: {
              triage: "done",
              submission: "waived",
              um: "pending",
              qa: "pending",
            },
          },
        ],
      },
    ]);

    const { screen } = await renderTree();

    const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    await expect
      .element(track.getByText("partially_affected", { exact: true }))
      .toBeVisible();
    // An affectedness that it does not list has no work, so the delivery,
    // which is not Pending, shows as a signal, without the pipeline.
    await expect
      .element(track.getByText("on_hold", { exact: true }))
      .toBeVisible();
    expect(
      track.getByRole("button", { name: /^Phases of/ }).elements(),
    ).toHaveLength(0);
  });

  test.each<[TrackDetail["status"]]>([["analysis"], ["affected"], ["fixed"]])(
    "shows its pipeline on its line, and its delivery in Phases, while it has work, in %s",
    async (status) => {
      showing([
        fictionalPackage({
          tracks: [
            fictionalTrack({
              status,
              submission_due_at: fromNow(3 * DAY + HOUR),
            }),
          ],
        }),
      ]);

      const { screen } = await renderTree();

      const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
      const pipeline = track.getByRole("button", {
        name: /^Phases of fictional-openssl, SUSE:FLES-15-SP7:Update: .*; delivery pending$/,
      });
      await expect.element(pipeline).toBeVisible();
      // On the line of the reference.
      expect(boxOf(pipeline).top).toBeLessThan(
        boxOf(track.getByText("SUSE:FLES-15-SP7:Update")).bottom,
      );
      expect(track.getByText("Delivery").elements()).toHaveLength(0);

      await pipeline.click();

      const phases = screen.getByRole("dialog", { name: "Phases" });
      await expect.element(phases).toHaveFocus();
      const delivery = phases.getByText("Delivery", { exact: true });
      expect(colorOf(delivery.element())).toBe(FG_MUTED);
      expect(phases.element().textContent).toMatch(/DeliveryPending$/);
    },
  );

  test("shows no deadline badge, its pipeline showing its deadline", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            submission_due_at: fromNow(-3 * DAY + HOUR),
            milestones: {
              triage: "done",
              submission: "overdue",
              um: "pending",
              qa: "pending",
            },
          }),
          // A Git track, whose current phase is null with due dates: a badge
          // would name its release.
          fictionalTrack({
            id: "00000000-0000-0000-0000-0000000000b2",
            workflow_type: "git",
            reference: "fles-16.0",
            release_due_at: fromNow(9 * DAY + HOUR),
            qa_due_at: fromNow(9 * DAY + HOUR),
            ...UNOBSERVED,
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const ibs = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    await expect
      .element(
        ibs.getByRole("button", {
          name: /: Triage done; Submission overdue by 3 days, current;/,
        }),
      )
      .toBeVisible();
    const git = trackOf(screen, "fles-16.0");
    await expect
      .element(git.getByRole("button", { name: /^Phases of/ }))
      .toBeVisible();
    for (const track of [ibs, git]) {
      // Neither the text of a badge nor its words.
      expect(
        track
          .getByText(/^(?:Triage|Submission|UM|QA|Release) -?\d+d$/)
          .elements(),
      ).toHaveLength(0);
      expect(
        track.getByText(/(?:due in|overdue by) \d+ days?$/).elements(),
      ).toHaveLength(0);
    }
  });

  test.each<
    [string, Partial<TrackDetail>, Partial<TicketDetail>, string | undefined]
  >([
    ["whose submission Sentinel observes: Pending", {}, {}, "Pending"],
    [
      "of Git, whose submission Sentinel does not observe: no Delivery Pending",
      { workflow_type: "git", reference: "fles-16.0", ...UNOBSERVED },
      {},
      undefined,
    ],
    [
      "of a Ticket without a CVE, whose submission Sentinel does not observe: no Delivery Pending",
      UNOBSERVED,
      { cve: null },
      undefined,
    ],
    [
      "of Git, once Sentinel observes its submission: Pending",
      { workflow_type: "git", reference: "fles-16.0" },
      {},
      "Pending",
    ],
    [
      "whose submission Sentinel does not observe, when it is not Pending: In progress",
      {
        workflow_type: "git",
        reference: "fles-16.0",
        delivery_status: "in_progress",
        ...UNOBSERVED,
      },
      {},
      "In progress",
    ],
  ])(
    "shows the delivery of a track with work %s",
    async (_, fields, ticket, status) => {
      showing([fictionalPackage({ tracks: [fictionalTrack(fields)] })], ticket);

      const { screen } = await renderTree();

      const track = trackOf(
        screen,
        fields.reference ?? "SUSE:FLES-15-SP7:Update",
      );
      // The track has work and due dates, so its pipeline shows, and Phases
      // holds its delivery.
      const pipeline = track.getByRole("button", { name: /^Phases of/ });
      await expect.element(pipeline).toBeVisible();
      expect(track.getByText("Delivery").elements()).toHaveLength(0);

      await pipeline.click();

      const phases = screen.getByRole("dialog", { name: "Phases" });
      await expect.element(phases).toHaveFocus();
      if (status === undefined) {
        expect(pipeline.element().getAttribute("aria-label")).not.toMatch(
          /delivery/i,
        );
        expect(phases.getByText("Delivery").elements()).toHaveLength(0);
      } else {
        expect(pipeline.element().getAttribute("aria-label")).toMatch(
          new RegExp(`; delivery ${status.toLowerCase()}$`),
        );
        expect(phases.element().textContent).toMatch(
          new RegExp(`Delivery${status}$`),
        );
      }
    },
  );

  test("decides Delivery Pending by the submission and the release by the QA, a milestone that the pinned contract does not list counting as observed", async () => {
    showingUnlisted([
      {
        ...fictionalPackage(),
        tracks: [
          {
            ...fictionalTrack(),
            milestones: {
              triage: "done",
              submission: "waived",
              um: null,
              qa: null,
            },
            current_phase: null,
          },
          {
            ...fictionalTrack({
              id: "00000000-0000-0000-0000-0000000000b2",
              reference: "SUSE:FLES-15-SP6:Update",
              products: [
                fictionalProduct({
                  id: "00000000-0000-0000-0000-0000000000c9",
                  product_name: "Fictional Linux Enterprise Server 15 SP6",
                  product_cpe: "cpe:/o:example:fles:15:sp6",
                }),
              ],
            }),
            milestones: {
              triage: "done",
              submission: null,
              um: null,
              qa: "waived",
            },
            current_phase: null,
          },
        ],
      },
    ]);

    const { screen } = await renderTree();

    const submitted = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    await expect
      .element(
        submitted.getByRole("button", {
          name: /^Phases of .*; delivery pending$/,
        }),
      )
      .toBeVisible();
    expect(
      await releaseInDetails(
        screen,
        "Fictional Linux Enterprise Server 15 SP7",
      ),
    ).toBe("Not observed");
    const tested = trackOf(screen, "SUSE:FLES-15-SP6:Update");
    expect(
      tested
        .getByRole("button", { name: /^Phases of/ })
        .element()
        .getAttribute("aria-label"),
    ).not.toMatch(/delivery/);
    expect(
      await releaseInDetails(
        screen,
        "Fictional Linux Enterprise Server 15 SP6",
      ),
    ).toBe("Not released");
  });

  test.each<[string, TrackDetail["status"]]>([
    ["Not affected", "not_affected"],
    ["Won't fix", "wont_fix"],
  ])(
    "shows no pipeline and no Delivery Pending while it is %s, without work",
    async (_, status) => {
      showing([
        fictionalPackage({
          tracks: [
            fictionalTrack({
              status,
              delivery_relevant: false,
              ...NOT_APPLICABLE,
            }),
          ],
        }),
      ]);

      const { screen } = await renderTree();

      const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
      expect(track.getByText("Delivery").elements()).toHaveLength(0);
      expect(
        track.getByRole("button", { name: /^Phases of/ }).elements(),
      ).toHaveLength(0);
    },
  );

  test("shows no pipeline and no Delivery Pending while it is Affected without a Product that is eligible", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            products: [fictionalProduct({ eligible: false })],
            milestones: {
              triage: "done",
              submission: "not_applicable",
              um: "not_applicable",
              qa: "not_applicable",
            },
            current_phase: "done",
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    expect(track.getByText("Delivery").elements()).toHaveLength(0);
    expect(
      track.getByRole("button", { name: /^Phases of/ }).elements(),
    ).toHaveLength(0);
  });

  test("shows a delivery other than Pending as a signal on a track without work", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            status: "not_affected",
            delivery_status: "in_progress",
            delivery_relevant: true,
            ...NOT_APPLICABLE,
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    const status = track.getByText("In progress", { exact: true });
    await expect.element(status).toBeVisible();
    expect(
      track.getByRole("button", { name: /^Phases of/ }).elements(),
    ).toHaveLength(0);
    // On the line of the reference, in place of the pipeline, before the
    // affectedness: "Delivery" in fg-muted, then its status in fg, 6 px later,
    // without a mark between them.
    const label = track.getByText("Delivery", { exact: true });
    expect(colorOf(label.element())).toBe(FG_MUTED);
    expect(colorOf(status.element())).toBe(FG);
    expect(boxOf(status).left - boxOf(label).right).toBeCloseTo(6, 0);
    expect(boxOf(label).top).toBeLessThan(
      boxOf(track.getByText("SUSE:FLES-15-SP7:Update")).bottom,
    );
    expect(boxOf(status).right).toBeLessThan(
      boxOf(track.getByText("Not affected", { exact: true })).left,
    );
  });

  test("shows no delivery where it is not relevant", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            status: "fixed",
            delivery_relevant: false,
            products: [
              fictionalProduct({ released_at: "2099-10-20T09:00:00Z" }),
            ],
            milestones: {
              triage: "done",
              submission: "done",
              um: "done",
              qa: "done",
            },
            current_phase: "done",
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    expect(
      trackOf(screen, "SUSE:FLES-15-SP7:Update")
        .getByText("Delivery")
        .elements(),
    ).toHaveLength(0);
  });

  test("shows only what happened on a track without due dates, whose Ticket has no SLA: no pipeline, no Delivery Pending, and no release that is due", async () => {
    // A Ticket whose severity is None has no SLA (Sentinel
    // docs/features/tickets/ticket-deadlines.md, Null Due Dates), so the
    // milestones of its tracks do not show which phases Sentinel observes.
    showing(
      [
        fictionalPackage({
          tracks: [
            fictionalTrack(NO_SLA),
            fictionalTrack({
              ...NO_SLA,
              id: "00000000-0000-0000-0000-0000000000b2",
              reference: "SUSE:FLES-15-SP6:Update",
              delivery_status: "in_progress",
              products: [
                fictionalProduct({
                  id: "00000000-0000-0000-0000-0000000000c9",
                  product_name: "Fictional Linux Enterprise Server 15 SP6",
                  product_cpe: "cpe:/o:example:fles:15:sp6",
                  released_at: "2099-10-20T09:00:00Z",
                }),
              ],
            }),
          ],
        }),
      ],
      {
        severity: "none",
        triage_due_at: null,
        submission_due_at: null,
        um_due_at: null,
        qa_due_at: null,
        release_due_at: null,
        current_phase: null,
        current_phase_milestone: null,
      },
    );

    const { screen } = await renderTree();

    const pending = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    await expect
      .element(pending.getByText("Affected", { exact: true }))
      .toBeVisible();
    expect(pending.getByText("Delivery").elements()).toHaveLength(0);
    expect(
      pending.getByRole("button", { name: /^Phases of/ }).elements(),
    ).toHaveLength(0);
    expect(pending.getByText(/release/i).elements()).toHaveLength(0);
    const delivered = trackOf(screen, "SUSE:FLES-15-SP6:Update");
    await expect
      .element(delivered.getByText("In progress", { exact: true }))
      .toBeVisible();
    expect(
      await releaseInDetails(
        screen,
        "Fictional Linux Enterprise Server 15 SP7",
      ),
    ).toBeUndefined();
    expect(
      await releaseInDetails(
        screen,
        "Fictional Linux Enterprise Server 15 SP6",
      ),
    ).toBe(`Released ${formatDateTime("2099-10-20T09:00:00Z")}`);
  });

  test.each<[TicketDetail["status"]]>([["ignored"], ["duplicated"]])(
    "shows no work on a track of a Ticket that is %s: no Delivery Pending and no release that is due, only a release that happened",
    async (status) => {
      showing(
        [
          fictionalPackage({
            tracks: [
              fictionalTrack({
                ...NO_SLA,
                products: [
                  fictionalProduct(),
                  fictionalProduct({
                    id: "00000000-0000-0000-0000-0000000000c9",
                    product_name: "Fictional Linux Enterprise Server 16.0",
                    product_cpe: "cpe:/o:example:fles:16.0",
                    released_at: "2099-10-20T09:00:00Z",
                  }),
                ],
              }),
            ],
          }),
        ],
        {
          status,
          // An Ignored Ticket always carries its reason (Sentinel
          // docs/features/tickets/tickets.md, Ignore Reason).
          ignore_reason: status === "ignored" ? "other" : null,
          triage_due_at: null,
          submission_due_at: null,
          um_due_at: null,
          qa_due_at: null,
          release_due_at: null,
          current_phase: null,
          current_phase_milestone: null,
        },
      );

      const { screen } = await renderTree();

      const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
      await expect
        .element(track.getByText("Affected", { exact: true }))
        .toBeVisible();
      expect(track.getByText("Delivery").elements()).toHaveLength(0);
      expect(
        await releaseInDetails(
          screen,
          "Fictional Linux Enterprise Server 15 SP7",
        ),
      ).toBeUndefined();
      expect(
        await releaseInDetails(
          screen,
          "Fictional Linux Enterprise Server 16.0",
        ),
      ).toBe(`Released ${formatDateTime("2099-10-20T09:00:00Z")}`);
    },
  );
});

describe("a Product", () => {
  test("shows its name as a button that opens its details, without its release on its line", async () => {
    showing([fictionalPackage()]);

    const { screen } = await renderTree();

    const name = screen.getByRole("button", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });
    await expect.element(name).toBeVisible();
    expect(colorOf(name.element())).toBe(FG);
    expect(boxOf(name).height).toBeGreaterThanOrEqual(24);
    expect(
      productOf(screen, "Fictional Linux Enterprise Server 15 SP7")
        .getByText(/release/i)
        .elements(),
    ).toHaveLength(0);
    expect(
      await releaseInDetails(
        screen,
        "Fictional Linux Enterprise Server 15 SP7",
      ),
    ).toBe("Not released");
  });

  test("shows at the end of its line the release that keeps a Ticket with a CVE from Resolved", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            status: "fixed",
            delivery_status: "released",
            milestones: {
              triage: "done",
              submission: "done",
              um: "done",
              qa: "pending",
            },
            current_phase: "qa",
            products: [
              fictionalProduct(),
              fictionalProduct({
                id: "00000000-0000-0000-0000-0000000000c9",
                product_name: "Fictional Linux Enterprise Server LTSS 15 SP7",
                product_cpe: "cpe:/o:example:fles-ltss:15:sp7",
                released_at: "2099-10-20T09:00:00Z",
              }),
            ],
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const product = productOf(
      screen,
      "Fictional Linux Enterprise Server 15 SP7",
    );
    const release = product.getByText("Not released", { exact: true });
    await expect.element(release).toBeVisible();
    const style = getComputedStyle(release.element());
    expect(style.color).toBe(WARNING_ON_SOFT);
    expect(style.fontSize).toBe("13px");
    expect(style.fontWeight).toBe("500");
    expect(boxOf(release).right).toBeCloseTo(boxOf(product).right, 0);
    // triangle-alert at 14 px in warning-icon starts it, 4 px before its
    // words: the pixel of the first 14 px closest to warning-icon is it,
    // apart from the smoothing of its edges.
    const words = release.element().lastChild;
    const range = document.createRange();
    range.selectNodeContents(words!);
    expect(
      range.getBoundingClientRect().left - boxOf(release).left,
    ).toBeCloseTo(14 + 4, 0);
    const picture = await screenshot(release);
    const pixels = Array.from({ length: 14 * picture.height }, (_, index) =>
      picture.at(index % 14, Math.floor(index / 14)),
    );
    expect(
      Math.min(...pixels.map((pixel) => distance(pixel, WARNING_ICON))),
    ).toBeLessThan(24);
    // The released Product shows nothing on its line.
    expect(
      productOf(screen, "Fictional Linux Enterprise Server LTSS 15 SP7")
        .getByText(/release/i)
        .elements(),
    ).toHaveLength(0);
  });

  test.each<
    [
      string,
      Partial<TrackDetail>,
      Partial<TicketDetail>,
      string | undefined,
      string,
    ]
  >([
    [
      "a Fixed track whose QA Sentinel observes, on its line too",
      { status: "fixed" },
      {},
      "Not released",
      "Not released",
    ],
    [
      "a Fixed Git track, whose QA Sentinel does not observe, on its line too",
      {
        status: "fixed",
        workflow_type: "git",
        reference: "fles-16.0",
        ...UNOBSERVED,
      },
      {},
      "Release not observed",
      "Not observed",
    ],
    [
      "a Fixed track of a Ticket without a CVE, which it does not keep from Resolved",
      { status: "fixed", ...UNOBSERVED },
      { cve: null },
      undefined,
      "Not observed",
    ],
    [
      "an Affected track whose QA Sentinel observes",
      {},
      {},
      undefined,
      "Not released",
    ],
    [
      "an Affected Git track, once Sentinel observes its QA",
      { workflow_type: "git", reference: "fles-16.0" },
      {},
      undefined,
      "Not released",
    ],
    [
      "a track in Analysis whose QA Sentinel does not observe",
      { status: "analysis", ...UNOBSERVED },
      {},
      undefined,
      "Not observed",
    ],
  ])(
    "shows below %s that it is not released",
    async (_, track, ticket, line, details) => {
      showing([fictionalPackage({ tracks: [fictionalTrack(track)] })], ticket);
      const { screen } = await renderTree();
      const product = productOf(
        screen,
        "Fictional Linux Enterprise Server 15 SP7",
      );
      await expect.element(product).toBeVisible();
      if (line === undefined) {
        expect(product.getByText(/release/i).elements()).toHaveLength(0);
      } else {
        await expect
          .element(product.getByText(line, { exact: true }))
          .toBeVisible();
        expect(product.getByText(/release/i).elements()).toHaveLength(1);
      }

      expect(
        await releaseInDetails(
          screen,
          "Fictional Linux Enterprise Server 15 SP7",
        ),
      ).toBe(details);
    },
  );

  test.each<[string, Partial<TrackDetail>, Partial<ProductDetail>]>([
    ["that is not eligible", {}, { eligible: false }],
    ["of a track without due dates, whose Ticket has no SLA", NO_SLA, {}],
  ])(
    "shows no release on the line of a Product of a Fixed track %s",
    async (_, track, product) => {
      showing([
        fictionalPackage({
          tracks: [
            fictionalTrack({
              ...track,
              status: "fixed",
              products: [
                fictionalProduct(product),
                fictionalProduct({
                  id: "00000000-0000-0000-0000-0000000000c9",
                  product_name: "Fictional Linux Enterprise Server 15 SP6",
                  product_cpe: "cpe:/o:example:fles:15:sp6",
                  released_at: "2099-10-20T09:00:00Z",
                }),
              ],
            }),
          ],
        }),
      ]);

      const { screen } = await renderTree();

      await expect
        .element(
          screen.getByRole("button", {
            name: "Fictional Linux Enterprise Server 15 SP7",
          }),
        )
        .toBeVisible();
      expect(
        packagesPart(screen)
          .getByText(/release/i)
          .elements(),
      ).toHaveLength(0);
    },
  );

  test("shows when it was released in its details, also on a track that expects no fix", async () => {
    const releasedAt = "2099-10-20T09:00:00Z";
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            status: "not_affected",
            products: [fictionalProduct({ released_at: releasedAt })],
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    expect(
      await releaseInDetails(
        screen,
        "Fictional Linux Enterprise Server 15 SP7",
      ),
    ).toBe(`Released ${formatDateTime(releasedAt)}`);
    expect(
      productOf(screen, "Fictional Linux Enterprise Server 15 SP7")
        .getByText(/released/i)
        .elements(),
    ).toHaveLength(0);
  });

  test.each<[string, Partial<TrackDetail>, Partial<ProductDetail>]>([
    ["on a track that expects no fix", { status: "wont_fix" }, {}],
    ["when it is not eligible", {}, { eligible: false }],
  ])("shows no release %s", async (_, track, product) => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            ...track,
            products: [fictionalProduct(product)],
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();
    expect(
      productOf(screen, "Fictional Linux Enterprise Server 15 SP7")
        .getByText(/released/i)
        .elements(),
    ).toHaveLength(0);

    await screen
      .getByRole("button", { name: "Fictional Linux Enterprise Server 15 SP7" })
      .click();

    // Nor do its details.
    const details = screen.getByRole("dialog", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });
    await expect.element(details).toBeVisible();
    expect(
      details
        .getByRole("term")
        .elements()
        .map((element) => element.textContent),
    ).toEqual(["Eligibility", "Lifecycle"]);
  });

  test("marks a Product that is not eligible, in gray, and one whose eligibility is set by hand", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            products: [fictionalProduct(SET_BY_HAND)],
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const product = productOf(
      screen,
      "Fictional Linux Enterprise Server 15 SP7",
    );
    await expect
      .element(product.getByText("Not eligible", { exact: true }))
      .toBeVisible();
    expect(product.element().textContent).toContain(
      "Fictional Linux Enterprise Server 15 SP7, eligibility set by hand",
    );
    expect(
      colorOf(
        screen
          .getByRole("button", {
            name: "Fictional Linux Enterprise Server 15 SP7",
          })
          .element(),
      ),
    ).toBe(FG_MUTED);
  });

  test("opens its details, which take the focus, without actions", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            products: [fictionalProduct(SET_BY_HAND)],
          }),
        ],
      }),
    ]);
    const { screen } = await renderTree();
    const name = screen.getByRole("button", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });

    await name.click();

    const details = screen.getByRole("dialog", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });
    await expect.element(details).toHaveFocus();
    await expect
      .element(details.getByText("cpe:/o:example:fles:15:sp7"))
      .toBeVisible();
    expect(
      details
        .getByRole("term")
        .elements()
        .map((element) => element.textContent),
    ).toEqual(["Eligibility", "Lifecycle"]);
    expect(
      details
        .getByRole("definition")
        .elements()
        .map((element) => element.textContent),
    ).toEqual(["Not eligible · set by hand", "General support"]);
    expect(details.getByRole("button").elements()).toHaveLength(0);
  });

  test.each<[string, Partial<TrackDetail>, Partial<ProductDetail>, string[]]>([
    [
      "an automatic eligibility, no lifecycle data, and a Git release that Sentinel does not observe",
      { workflow_type: "git", reference: "fles-16.0", ...UNOBSERVED },
      { lifecycle_phase: null },
      ["Eligible · automatic", "Not available", "Not observed"],
    ],
    [
      "a release",
      {},
      { released_at: "2099-10-20T09:00:00Z", lifecycle_phase: "pre_release" },
      [
        "Eligible · automatic",
        "Pre-release",
        `Released ${formatDateTime("2099-10-20T09:00:00Z")}`,
      ],
    ],
  ])("shows in its details %s", async (_, track, product, values) => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            ...track,
            products: [fictionalProduct(product)],
          }),
        ],
      }),
    ]);
    const { screen } = await renderTree();

    await screen
      .getByRole("button", {
        name: "Fictional Linux Enterprise Server 15 SP7",
      })
      .click();

    const details = screen.getByRole("dialog", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });
    await expect.element(details).toBeVisible();
    expect(
      details
        .getByRole("definition")
        .elements()
        .map((element) => element.textContent),
    ).toEqual(values);
  });

  test.each([
    ["product_excluded", "No, it is excluded from this track"],
    ["track_excluded", "No, its track is excluded"],
    ["package_excluded", "No, its package is excluded"],
    ["eol", "No, it has reached its end of life"],
    ["withdrawn", "No, withdrawn"],
  ])("says in its details why it takes no part: %s", async (reason, words) => {
    showingUnlisted([
      {
        ...fictionalPackage(),
        tracks: [
          {
            ...fictionalTrack(),
            products: [
              fictionalProduct(),
              {
                ...excludedProduct(),
                lifecycle_phase: "sunset",
                non_actionable_reason: reason,
              },
            ],
          },
        ],
      },
    ]);
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    await screen
      .getByRole("button", {
        name: "Fictional Linux Enterprise Desktop 15 SP7",
      })
      .click();

    const details = screen.getByRole("dialog", {
      name: "Fictional Linux Enterprise Desktop 15 SP7",
    });
    await expect.element(details).toBeVisible();
    expect(
      details
        .getByRole("definition")
        .elements()
        .map((element) => element.textContent),
    ).toEqual(["Eligible · automatic", "sunset", words]);
  });
});

// A package with a track that shows, holding a Product that shows, an
// excluded Product, and a Product at the end of its life; an excluded track;
// and an excluded package.
function withHiddenRecords(): PackageDetail[] {
  return [
    fictionalPackage({
      tracks: [
        fictionalTrack({
          products: [fictionalProduct(), excludedProduct(), eolProduct()],
        }),
        excludedTrack(),
      ],
    }),
    excludedPackage(),
  ];
}

describe("the hidden records", () => {
  test("hides the excluded and EOL records until Show hidden shows them", async () => {
    showing(withHiddenRecords());

    const { screen } = await renderTree();

    const toggle = showHidden(screen);
    await expect.element(toggle).not.toBeChecked();
    await expect.element(toggle).toHaveAccessibleName("Show hidden 4");
    expect(
      packagesPart(screen)
        .getByRole("heading", { level: 3 })
        .elements()
        .map((element) => element.textContent),
    ).toEqual(["fictional-openssl"]);
    expect(screen.getByText("SUSE:FLES-15-SP6:Update").elements()).toHaveLength(
      0,
    );
    expect(
      screen
        .getByRole("button", {
          name: "Fictional Linux Enterprise Desktop 15 SP7",
        })
        .elements(),
    ).toHaveLength(0);
    expect(
      screen
        .getByRole("button", {
          name: "Fictional Linux Enterprise Server 15 SP3",
        })
        .elements(),
    ).toHaveLength(0);
  });

  test("puts the switch at the end of the line of the heading", async () => {
    showing(withHiddenRecords());

    const { screen } = await renderTree();

    const heading = packagesPart(screen).getByRole("heading", { level: 2 });
    const toggle = showHidden(screen).element().closest("label");
    expect(toggle).not.toBeNull();
    expect(boxOf(toggle!).right).toBeCloseTo(
      boxOf(packagesPart(screen)).right,
      0,
    );
    expect(boxOf(toggle!).top).toBeLessThan(boxOf(heading).bottom);
  });

  test("shows them in gray, with the label of their own state, and keeps the state in the URL", async () => {
    showing(withHiddenRecords());
    const { router, screen } = await renderTree("/tickets/SNTL-12#packages");

    await pressShowHidden(screen);

    await expect.element(showHidden(screen)).toBeChecked();
    expect(router.state.location.href).toBe(
      "/tickets/SNTL-12?hidden=shown#packages",
    );
    expect(router.history.length).toBe(2);
    await expect.element(showHidden(screen)).toHaveFocus();
    // The excluded package, in gray, with its label in its band.
    const libpng = band(screen, "fictional-libpng");
    expect(colorOf(libpng)).toBe(FG_MUTED);
    expect(libpng.textContent).toContain("Excluded");
    // The excluded track, with its label, and its Product, without one.
    const track = trackOf(screen, "SUSE:FLES-15-SP6:Update");
    await expect
      .element(track.getByText("Excluded", { exact: true }))
      .toBeVisible();
    expect(colorOf(track.element())).toBe(FG_MUTED);
    const throughTrack = productOf(
      screen,
      "Fictional Linux Enterprise Server 15 SP6",
    );
    expect(throughTrack.getByText("Excluded").elements()).toHaveLength(0);
    expect(
      colorOf(
        screen
          .getByRole("button", {
            name: "Fictional Linux Enterprise Server 15 SP6",
          })
          .element(),
      ),
    ).toBe(FG_MUTED);
    // The excluded Product and the Product at the end of its life, each with
    // its label.
    await expect
      .element(
        productOf(
          screen,
          "Fictional Linux Enterprise Desktop 15 SP7",
        ).getByText("Excluded", { exact: true }),
      )
      .toBeVisible();
    await expect
      .element(
        productOf(screen, "Fictional Linux Enterprise Server 15 SP3").getByText(
          "EOL",
          { exact: true },
        ),
      )
      .toBeVisible();
    // The records that count keep their colors, unlike the Product of the
    // same name in the excluded package.
    expect(colorOf(band(screen, "fictional-openssl"))).toBe(FG);
    const products = screen
      .getByRole("button", { name: "Fictional Linux Enterprise Server 15 SP7" })
      .elements();
    expect(products.map(colorOf)).toEqual([FG, FG_MUTED]);

    await pressShowHidden(screen);

    expect(router.state.location.href).toBe("/tickets/SNTL-12#packages");
    await expect.element(showHidden(screen)).not.toBeChecked();
  });

  test("keeps the scroll position when Show hidden changes, also with an anchor in the URL", async () => {
    await page.viewport(1280, 400);
    // More packages after them, so that the page goes on below the package
    // tree, which the anchor can then scroll to the top of the window.
    showing([
      ...withHiddenRecords(),
      ...["fictional-curl", "fictional-zlib", "fictional-libxml2"].map(
        (name, index) =>
          fictionalPackage({
            id: `00000000-0000-0000-0000-0000000000b${index}`,
            package_name: name,
          }),
      ),
    ]);
    const { router, screen } = await renderTree("/tickets/SNTL-12#packages");
    // Once the reads of the tab have settled, the page has shown the target
    // of the anchor; it then lies elsewhere.
    await expect
      .element(screen.getByText("None", { exact: true }))
      .toBeVisible();
    await expect.poll(() => window.scrollY).toBeGreaterThan(100);
    // 60 px above, where the switch still shows, so that the click needs no
    // scroll of its own.
    const elsewhere = window.scrollY - 60;
    window.scrollTo(0, elsewhere);
    await expect.poll(() => window.scrollY).toBe(elsewhere);

    await pressShowHidden(screen);

    await expect.element(showHidden(screen)).toBeChecked();
    expect(router.state.location.hash).toBe("packages");
    expect(window.scrollY).toBe(elsewhere);
  });

  test.each([
    [
      "the name of a hidden Product",
      "Fictional Linux Enterprise Desktop 15 SP7",
    ],
    [
      "the maintainers of a hidden package",
      "No maintainer of fictional-libpng",
    ],
  ])(
    "moves the focus to the screen's heading when %s leaves the page, as Back hides the records",
    async (_, name) => {
      showing(withHiddenRecords());
      const { router, screen } = await renderTree();
      await pressShowHidden(screen);
      const control = screen.getByRole("button", { name, exact: true });
      control.element().focus();
      await expect.element(control).toHaveFocus();

      router.history.back();

      await expect.element(showHidden(screen)).not.toBeChecked();
      await expect
        .element(screen.getByRole("heading", { level: 1 }))
        .toHaveFocus();
    },
  );

  test("shows the label of a record that its own state hides also under a hidden parent", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack(),
          excludedTrack({
            products: [eolProduct({ non_actionable_reason: "track_excluded" })],
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    await expect
      .element(
        productOf(screen, "Fictional Linux Enterprise Server 15 SP3").getByText(
          "EOL",
          { exact: true },
        ),
      )
      .toBeVisible();
  });

  test("shows a track without a Product that takes part in gray, without a label", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack(),
          fictionalTrack({
            id: "00000000-0000-0000-0000-0000000000b4",
            reference: "SUSE:FLES-15-SP3:Update",
            status: "analysis",
            actionable: false,
            non_actionable_reason: "no_actionable_products",
            products: [eolProduct()],
            ...NOT_APPLICABLE,
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    const track = trackOf(screen, "SUSE:FLES-15-SP3:Update");
    await expect.element(track).toBeVisible();
    expect(colorOf(track.element())).toBe(FG_MUTED);
    expect(track.getByText("Excluded").elements()).toHaveLength(0);
    await expect
      .element(showHidden(screen))
      .toHaveAccessibleName("Show hidden 1");
  });

  test("disables the switch without hidden records, and keeps its state", async () => {
    showing([fictionalPackage()]);

    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    await expect.element(showHidden(screen)).toBeDisabled();
    await expect.element(showHidden(screen)).toBeChecked();
    await expect
      .element(showHidden(screen))
      .toHaveAccessibleName("Show hidden 0");
  });

  test("says that every package is hidden while the switch is off", async () => {
    showing([excludedPackage()]);

    const { screen } = await renderTree();

    await expect
      .element(screen.getByText("All packages are hidden.", { exact: true }))
      .toBeVisible();
    expect(
      colorOf(screen.getByText("All packages are hidden.").element()),
    ).toBe(FG_MUTED);
  });

  test("removes a value of hidden that it does not accept from the URL, in place of the URL, and keeps the anchor", async () => {
    showing(withHiddenRecords());

    const { router, screen } = await renderTree(
      "/tickets/SNTL-12?hidden=yes&view=new#packages",
    );

    expect(router.state.location.href).toBe("/tickets/SNTL-12#packages");
    expect(router.history.length).toBe(1);
    await expect.element(showHidden(screen)).not.toBeChecked();
  });
});

describe("the tracks that wait for the signed-in user", () => {
  test("show Needs your action with a bar for a maintainer, on the pending tracks that the read of their work returns", async () => {
    const spy = showing(
      [
        fictionalPackage({
          tracks: [
            fictionalTrack(),
            fictionalTrack({
              id: "00000000-0000-0000-0000-0000000000b2",
              reference: "SUSE:FLES-15-SP6:Update",
            }),
          ],
        }),
      ],
      {},
      {
        user: MAINTAINER,
        yourWork: () =>
          ticketWorkResponse([
            {
              packageName: "fictional-openssl",
              reference: "SUSE:FLES-15-SP7:Update",
            },
          ]),
      },
    );

    const { screen } = await renderTree();

    const label = packagesPart(screen).getByText("Needs your action", {
      exact: true,
    });
    await expect.element(label).toBeVisible();
    const waiting = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    expect(waiting.element().contains(label.element())).toBe(true);
    const style = getComputedStyle(label.element());
    expect(style.backgroundColor).toBe(INFO_SOFT);
    expect(style.color).toBe(INFO_ON_SOFT);
    expect(style.fontSize).toBe("12px");
    expect(boxOf(label).height).toBe(20);
    const bar = getComputedStyle(waiting.element());
    expect(bar.borderLeftWidth).toBe("3px");
    expect(bar.borderLeftColor).toBe(LINK);
    const other = trackOf(screen, "SUSE:FLES-15-SP6:Update");
    expect(other.getByText("Needs your action").elements()).toHaveLength(0);
    expect(getComputedStyle(other.element()).borderLeftWidth).toBe("1px");
    expect(getComputedStyle(other.element()).borderLeftColor).toBe(BORDER);
    expect(requestsTo(spy, YOUR_WORK)).toBe(1);
  });

  test("match the pending tracks by package as well as by reference", async () => {
    showing(
      [
        fictionalPackage(),
        fictionalPackage({
          id: "00000000-0000-0000-0000-0000000000a2",
          package_name: "fictional-zlib",
          tracks: [
            fictionalTrack({ id: "00000000-0000-0000-0000-0000000000b2" }),
          ],
        }),
      ],
      {},
      {
        user: MAINTAINER,
        yourWork: () =>
          ticketWorkResponse([
            {
              packageName: "fictional-zlib",
              reference: "SUSE:FLES-15-SP7:Update",
            },
          ]),
      },
    );

    const { screen } = await renderTree();

    const label = packagesPart(screen).getByText("Needs your action");
    await expect.element(label).toBeVisible();
    expect(label.elements()).toHaveLength(1);
    expect(
      packagesPart(screen)
        .getByRole("listitem")
        .filter({
          has: page.getByRole("heading", { name: "fictional-zlib" }),
        })
        .element()
        .contains(label.element()),
    ).toBe(true);
  });

  test("are read again when the tab returns to the foreground", async () => {
    let fails = true;
    showing(
      [fictionalPackage()],
      {},
      {
        user: MAINTAINER,
        yourWork: () =>
          fails
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : ticketWorkResponse([
                {
                  packageName: "fictional-openssl",
                  reference: "SUSE:FLES-15-SP7:Update",
                },
              ]),
      },
    );
    const { screen } = await renderTree();
    await expect.element(screen.getByText(/couldn't be shown/)).toBeVisible();
    fails = false;

    returnToForeground();

    await expect.element(screen.getByText("Needs your action")).toBeVisible();
    expect(screen.getByText(/couldn't be shown/).elements()).toHaveLength(0);
  });

  test("stay marked, saying that they couldn't be updated, when a later read of them fails, and marked as being updated while Try again reads them", async () => {
    let fails = false;
    const retried = later();
    let retrying = false;
    showing(
      [fictionalPackage()],
      {},
      {
        user: MAINTAINER,
        yourWork: () => {
          if (retrying) {
            return retried.promise;
          }
          return fails
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : ticketWorkResponse([
                {
                  packageName: "fictional-openssl",
                  reference: "SUSE:FLES-15-SP7:Update",
                },
              ]);
        },
      },
    );
    const { screen } = await renderTree();
    await expect.element(screen.getByText("Needs your action")).toBeVisible();
    fails = true;

    returnToForeground();

    await expect
      .element(
        screen.getByText(
          "The tracks that wait for you couldn't be updated. Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    await expect.element(screen.getByText("Needs your action")).toBeVisible();
    retrying = true;

    await screen.getByRole("button", { name: "Try again" }).click();

    await expect
      .element(
        packagesPart(screen).getByRole("progressbar", { name: "Updating" }),
      )
      .toBeInTheDocument();
    await expect.element(screen.getByText("Needs your action")).toBeVisible();
    retried.resolve(ticketWorkResponse());
    await expect
      .poll(() => screen.getByText("Needs your action").elements().length)
      .toBe(0);
    expect(
      packagesPart(screen).getByRole("progressbar").elements(),
    ).toHaveLength(0);
  });

  test("mark nothing once the user no longer maintains a package that is not excluded, and are no longer read", async () => {
    let excluded = false;
    const spy = stubTicket({
      user: MAINTAINER,
      ticket: () =>
        ticketResponse(
          fictionalTicketDetail({
            packages: [
              excluded
                ? fictionalPackage({
                    deleted_at: "2099-10-10T10:00:00Z",
                    actionable: false,
                    non_actionable_reason: "package_excluded",
                    tracks: [
                      fictionalTrack({
                        actionable: false,
                        non_actionable_reason: "package_excluded",
                        ...NOT_APPLICABLE,
                      }),
                    ],
                  })
                : fictionalPackage(),
            ],
          }),
        ),
      yourWork: () =>
        ticketWorkResponse([
          {
            packageName: "fictional-openssl",
            reference: "SUSE:FLES-15-SP7:Update",
          },
        ]),
    });
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");
    await expect.element(screen.getByText("Needs your action")).toBeVisible();
    excluded = true;
    const before = requestsTo(spy, `${TICKETS}/SNTL-12`);

    returnToForeground();

    await expect
      .poll(() => requestsTo(spy, `${TICKETS}/SNTL-12`))
      .toBe(before + 1);
    await expect
      .poll(() => band(screen, "fictional-openssl").textContent)
      .toContain("Excluded");
    expect(screen.getByText("Needs your action").elements()).toHaveLength(0);
    // The next return of the tab reads the Ticket, not the work any more.
    const work = requestsTo(spy, YOUR_WORK);
    const tickets = requestsTo(spy, `${TICKETS}/SNTL-12`);

    returnToForeground();

    await expect
      .poll(() => requestsTo(spy, `${TICKETS}/SNTL-12`))
      .toBe(tickets + 1);
    expect(requestsTo(spy, YOUR_WORK)).toBe(work);
  });

  test("are not read for a user whom no package lists as a maintainer", async () => {
    const spy = showing([fictionalPackage()]);

    const { screen } = await renderTree();

    await expect
      .element(screen.getByText("SUSE:FLES-15-SP7:Update"))
      .toBeVisible();
    expect(requestsTo(spy, YOUR_WORK)).toBe(0);
  });

  test("are not read for a user who maintains only an excluded package", async () => {
    const spy = showing(
      [
        fictionalPackage({ maintainers: [] }),
        {
          ...excludedPackage(),
          maintainers: [
            {
              id: MAINTAINER.data.id,
              username: "dbrown",
              full_name: "Dave Brown",
              active: true,
              bot: false,
            },
          ],
        },
      ],
      {},
      { user: MAINTAINER },
    );

    const { screen } = await renderTree();

    await expect
      .element(screen.getByText("SUSE:FLES-15-SP7:Update"))
      .toBeVisible();
    expect(requestsTo(spy, YOUR_WORK)).toBe(0);
  });

  test("show no mark until the read arrives", async () => {
    const response = later();
    showing(
      [fictionalPackage()],
      {},
      {
        user: MAINTAINER,
        yourWork: () => response.promise,
      },
    );

    const { screen } = await renderTree();

    expect(screen.getByText("Needs your action").elements()).toHaveLength(0);
    response.resolve(
      ticketWorkResponse([
        {
          packageName: "fictional-openssl",
          reference: "SUSE:FLES-15-SP7:Update",
        },
      ]),
    );
    await expect.element(screen.getByText("Needs your action")).toBeVisible();
  });

  test("say above the tree that they couldn't be shown when the read fails, with Try again where the failure offers it", async () => {
    let fails = true;
    showing(
      [fictionalPackage()],
      {},
      {
        user: MAINTAINER,
        yourWork: () =>
          fails
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : ticketWorkResponse([
                {
                  packageName: "fictional-openssl",
                  reference: "SUSE:FLES-15-SP7:Update",
                },
              ]),
      },
    );

    const { screen } = await renderTree();

    const warning = screen.getByText(
      "The tracks that wait for you couldn't be shown. Sentinel isn't available right now. Try again later.",
    );
    await expect.element(warning).toBeVisible();
    expect(boxOf(warning).bottom).toBeLessThan(
      boxOf(band(screen, "fictional-openssl")).top,
    );
    // In a status region of the part that is there before it, so that
    // assistive technologies announce it.
    expect(
      packagesPart(screen)
        .getByRole("status")
        .element()
        .contains(warning.element()),
    ).toBe(true);
    // The tree stays usable.
    await expect
      .element(
        screen.getByRole("button", {
          name: "Fictional Linux Enterprise Server 15 SP7",
        }),
      )
      .toBeEnabled();

    fails = false;
    await screen.getByRole("button", { name: "Try again" }).click();

    await expect.element(screen.getByText("Needs your action")).toBeVisible();
    expect(screen.getByText(/couldn't be shown/).elements()).toHaveLength(0);
  });
});

// NVD's CVSS v4.0 assessment of CVE-2099-0012, Critical 9.3.
const NVD_V40: CVSS40Assessment = {
  id: "00000000-0000-0000-0000-0000000000d3",
  provider_name: "NVD",
  cvss_version: "4.0",
  score: 9.3,
  severity: "critical",
  vector_string:
    "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
  metrics: {
    attack_vector: "network",
    attack_complexity: "low",
    attack_requirements: "none",
    privileges_required: "none",
    user_interaction: "none",
    vulnerable_system_confidentiality: "high",
    vulnerable_system_integrity: "high",
    vulnerable_system_availability: "high",
    subsequent_system_confidentiality: "none",
    subsequent_system_integrity: "none",
    subsequent_system_availability: "none",
  },
  created_at: "2099-10-01T08:00:00Z",
  updated_at: "2099-10-01T08:00:00Z",
};

// A CNA's CVSS v2.0 assessment of CVE-2099-0012, High 7.5, by the scale
// of its version.
const CNA_V20: CVSS20Assessment = {
  id: "00000000-0000-0000-0000-0000000000d4",
  provider_name: "Fictional CNA",
  cvss_version: "2.0",
  score: 7.5,
  severity: "high",
  vector_string: "AV:N/AC:L/Au:N/C:P/I:P/A:P",
  metrics: {
    access_vector: "network",
    access_complexity: "low",
    authentication: "none",
    confidentiality_impact: "partial",
    integrity_impact: "partial",
    availability_impact: "partial",
  },
  created_at: "2099-10-01T08:00:00Z",
  updated_at: "2099-10-01T08:00:00Z",
};

// Answers Get Ticket with SNTL-12 and its CVE-2099-0012, and the read of
// the CVSS assessments with the assessments.
function showingCvss(
  assessments: CVECVSSAssessments | Record<string, unknown>,
) {
  return stubTicket({
    cvss: () => jsonResponse(200, { data: assessments }),
  });
}

function cvssPart(screen: Screen) {
  return screen.getByRole("region", {
    name: "CVSS assessments",
    exact: true,
  });
}

// Renders the screen of SNTL-12 and waits until its CVSS assessments show
// the text.
async function renderCvss(text: string) {
  const rendered = await renderApp("/tickets/SNTL-12");
  await expect
    .element(cvssPart(rendered.screen).getByText(text).first())
    .toBeVisible();
  return rendered;
}

// The lines of what the assessments resolve, each its term and its value.
function linesOf(screen: Screen): string[][] {
  const part = cvssPart(screen);
  const values = part.getByRole("definition").elements();
  return part
    .getByRole("term")
    .elements()
    .map((term, index) => [
      term.textContent ?? "",
      values[index]?.textContent ?? "",
    ]);
}

// The rows of the table of the assessments, each the texts of its cells.
function rowsOf(screen: Screen): string[][] {
  const table = cvssPart(screen).getByRole("grid", {
    name: "CVSS assessments",
  });
  return table
    .getByRole("row")
    .elements()
    .slice(1)
    .map((row) => {
      const cells = page.elementLocator(row);
      return [
        ...cells.getByRole("rowheader").elements(),
        ...cells.getByRole("gridcell").elements(),
      ].map((cell) => cell.textContent ?? "");
    });
}

// The text of each line of an element, from the top of each of its
// characters, without the spaces at which the lines break.
function linesOfText(element: Element): string[] {
  const lines = new Map<number, string>();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    for (let index = 0; index < text.length; index += 1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const top = Math.round(range.getBoundingClientRect().top);
      lines.set(top, `${lines.get(top) ?? ""}${text.charAt(index)}`);
    }
  }
  return [...lines.entries()]
    .toSorted(([first], [second]) => first - second)
    .map(([, text]) => text.trim());
}

// The vector of fictionalAssessment, NVD's v3.1 assessment.
const NVD_V31_VECTOR = "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H";

// The terms of the popover of a vector, each with the definition of the
// same rank, as each term has one: a group's definition holds the terms of
// its metrics, which follow it.
function fieldsOf(popover: Locator): [Element, Element][] {
  const definitions = popover.getByRole("definition").elements();
  return popover
    .getByRole("term")
    .elements()
    .flatMap((term, index): [Element, Element][] => {
      const definition = definitions[index];
      return definition === undefined ? [] : [[term, definition]];
    });
}

// Whether a definition is that of a group, which holds terms of its own.
function isGroup(definition: Element): boolean {
  return (
    page.elementLocator(definition).getByRole("term").elements().length > 0
  );
}

// The metrics of the popover of a vector, in their order: the term of each
// group, and each metric as its term and its value.
function metricsOf(popover: Locator): (string | string[])[] {
  return fieldsOf(popover).map(([term, definition]) =>
    isGroup(definition)
      ? (term.textContent ?? "")
      : [term.textContent ?? "", definition.textContent ?? ""],
  );
}

// The terms and the values of the metrics of the popover of a vector, each
// group's term left out.
function metricFieldsOf(popover: Locator): [Element, Element][] {
  return fieldsOf(popover).filter(([, definition]) => !isGroup(definition));
}

describe("the CVSS assessments", () => {
  test("follow the CVE and precede the package tree, under a level-two heading", async () => {
    stubTicket();
    const { screen } = await renderCvss("SUSE");

    await expect
      .element(
        cvssPart(screen).getByRole("heading", {
          level: 2,
          name: "CVSS assessments",
        }),
      )
      .toBeVisible();
    expect(boxOf(cvssPart(screen)).top).toBeGreaterThan(
      boxOf(screen.getByRole("region", { name: "CVE-2099-0012", exact: true }))
        .bottom,
    );
    expect(boxOf(cvssPart(screen)).bottom).toBeLessThan(
      boxOf(packagesPart(screen)).top,
    );
  });

  test("say in one line that the SUSE assessment of the default version sets the severity and the eligibility score", async () => {
    stubTicket();
    const { screen } = await renderCvss("SUSE");

    expect(linesOf(screen)).toEqual([
      [
        "Severity",
        "Medium (5.5) from SUSE CVSS v3.1, which also sets the eligibility score of the Products",
      ],
    ]);
  });

  test("show the severity and the fallback eligibility score apart without a SUSE assessment of the default version", async () => {
    showingCvss(
      fictionalCvssAssessments({
        assessments: [NVD_V40],
        severity: {
          score: 9.3,
          version: "4.0",
          provider: "NVD",
          label: "critical",
        },
        eligibility: { score: 10, source: "fallback" },
      }),
    );
    const { screen } = await renderCvss("NVD");

    expect(linesOf(screen)).toEqual([
      ["Severity", "Critical (9.3) from NVD CVSS v4.0"],
      [
        "Eligibility score",
        "10.0, the fallback without a SUSE CVSS v3.1 assessment",
      ],
    ]);
    // The eligibility score starts a line below the severity.
    const [severity, eligibility] = cvssPart(screen)
      .getByRole("term")
      .elements();
    expect(boxOf(eligibility!).top).toBeGreaterThanOrEqual(
      boxOf(severity!).bottom,
    );
  });

  test("name the default version that the eligibility score lacks when a SUSE assessment of another version sets the severity", async () => {
    showingCvss(
      fictionalCvssAssessments({
        default_cvss_version: "4.0",
        eligibility: { score: 10, source: "fallback" },
      }),
    );
    const { screen } = await renderCvss("SUSE");

    expect(linesOf(screen)).toEqual([
      ["Severity", "Medium (5.5) from SUSE CVSS v3.1"],
      [
        "Eligibility score",
        "10.0, the fallback without a SUSE CVSS v4.0 assessment",
      ],
    ]);
  });

  test("show a source of the eligibility score and versions that the pinned contract does not list as received", async () => {
    showingCvss({
      ...fictionalCvssAssessments(),
      default_cvss_version: "5.0",
      severity: { score: 8.1, version: "5.0", provider: "NVD", label: "high" },
      eligibility: { score: 7, source: "fictional_source" },
    });
    const { screen } = await renderCvss("SUSE");

    expect(linesOf(screen)).toEqual([
      ["Severity", "High (8.1) from NVD CVSS 5.0"],
      ["Eligibility score", "7.0, fictional_source"],
    ]);
  });

  test("list the assessments in the order of the API, by provider and version, with the Base score and the severity of each by its version, and its vector", async () => {
    // An order that neither the version nor the provider gives, and the
    // widest score, so that the severities align after scores of two widths.
    showingCvss(
      fictionalCvssAssessments({
        assessments: [
          fictionalSuseAssessment(),
          { ...CNA_V20, score: 10 },
          NVD_V40,
        ],
      }),
    );
    const { screen } = await renderCvss("Fictional CNA");
    const table = cvssPart(screen).getByRole("grid", {
      name: "CVSS assessments",
    });

    expect(
      table
        .getByRole("columnheader")
        .elements()
        .map((header) => header.textContent),
    ).toEqual(["Provider", "Version", "Base score", "Vector"]);
    expect(rowsOf(screen)).toEqual([
      [
        "SUSE",
        "v3.1",
        "5.5 Medium",
        "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
      ],
      ["Fictional CNA", "v2.0", "10.0 High", "AV:N/AC:L/Au:N/C:P/I:P/A:P"],
      [
        "NVD",
        "v4.0",
        "9.3 Critical",
        "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
      ],
    ]);
    // The scores align in their column, in tabular figures
    // (docs/design-system.md, Type Scale), and end at the same place, so
    // that the severities after them align too.
    const scores = ["5.5", "10.0", "9.3"].map((score) =>
      table.getByText(score, { exact: true }),
    );
    for (const score of scores) {
      expect(getComputedStyle(score.element()).fontVariantNumeric).toBe(
        "tabular-nums",
      );
    }
    expect(new Set(scores.map((score) => boxOf(score).right)).size).toBe(1);
    expect(
      new Set(
        ["Medium", "High", "Critical"].map(
          (name) => boxOf(table.getByText(name, { exact: true })).left,
        ),
      ).size,
    ).toBe(1);
    // Assistive technologies name each row by its provider and its version.
    expect(
      table
        .getByRole("rowheader")
        .elements()
        .map((cell) => cell.textContent),
    ).toEqual(["SUSE", "v3.1", "Fictional CNA", "v2.0", "NVD", "v4.0"]);
  });

  test("show a version and a severity of an assessment that the pinned contract does not list as received, without the severity of an unlisted version", async () => {
    showingCvss({
      ...fictionalCvssAssessments(),
      assessments: [
        {
          ...fictionalAssessment(),
          cvss_version: "5.0",
          severity: "high",
          score: 6.2,
          vector_string: "CVSS:5.0/AV:N",
        },
        {
          ...fictionalSuseAssessment(),
          severity: "fictional_severity",
        },
      ],
    });
    const { screen } = await renderCvss("CVSS:5.0/AV:N");

    // The scale of the severity depends on the version, so the severity of
    // an unlisted version is left out (docs/behaviors.md, Unknown Values).
    expect(rowsOf(screen)).toEqual([
      ["NVD", "5.0", "6.2", "CVSS:5.0/AV:N"],
      [
        "SUSE",
        "v3.1",
        "5.5 fictional_severity",
        "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
      ],
    ]);
    // The metrics of an unlisted version depend on it, so its vector shows
    // as text, without the popover of its metrics, which a listed version
    // opens.
    expect(
      cvssPart(screen).getByRole("button", { name: "CVSS:5.0/AV:N" }).query(),
    ).toBeNull();
    await expect
      .element(
        cvssPart(screen).getByRole("button", {
          name: "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
        }),
      )
      .toBeVisible();
  });

  test("show the vector in monospace, wrapping only after a slash where its column is narrower than it", async () => {
    await page.viewport(320, 800);
    showingCvss(fictionalCvssAssessments({ assessments: [NVD_V40] }));
    const { screen } = await renderCvss(NVD_V40.vector_string);
    const vector = cvssPart(screen)
      .getByText(NVD_V40.vector_string, { exact: true })
      .element();

    expect(getComputedStyle(vector).fontFamily).toContain("monospace");
    // The lines break between the metrics, and the text stays the vector,
    // which the user copies.
    const texts = linesOfText(vector);
    expect(texts.length).toBeGreaterThan(1);
    expect(texts.join("")).toBe(NVD_V40.vector_string);
    expect(texts.slice(0, -1).every((text) => text.endsWith("/"))).toBe(true);
    // The page does not scroll horizontally (docs/behaviors.md,
    // Accessibility, Reflow and text size).
    expect(document.documentElement.scrollWidth).toBe(320);
  });

  test("wrap a provider longer than its column", async () => {
    await page.viewport(320, 800);
    const provider = "Fictional Coordinated Disclosure Team";
    showingCvss(
      fictionalCvssAssessments({
        assessments: [{ ...NVD_V40, provider_name: provider }],
      }),
    );
    const { screen } = await renderCvss(provider);

    expect(
      linesOfText(
        cvssPart(screen).getByText(provider, { exact: true }).element(),
      ),
    ).toEqual(["Fictional", "Coordinated", "Disclosure", "Team"]);
  });

  test("open the metrics of a v3.1 vector in a popover, which takes the focus, with the vector and a link to the calculator of FIRST", async () => {
    stubTicket();
    const { screen } = await renderCvss("SUSE");
    const vector = cvssPart(screen).getByRole("button", {
      name: NVD_V31_VECTOR,
      exact: true,
    });

    await vector.click();

    const metrics = screen.getByRole("dialog", { name: "NVD CVSS v3.1" });
    await expect.element(metrics).toHaveFocus();
    expect(metricsOf(metrics)).toEqual([
      "Exploitability",
      ["Attack vector", "Network"],
      ["Attack complexity", "High"],
      ["Privileges required", "None"],
      ["User interaction", "None"],
      ["Scope", "Unchanged"],
      "Impact",
      ["Confidentiality", "High"],
      ["Integrity", "High"],
      ["Availability", "High"],
    ]);
    // The vector, which the user can select and copy, in monospace.
    const shown = metrics.getByText(NVD_V31_VECTOR, { exact: true }).element();
    expect(getComputedStyle(shown).fontFamily).toContain("monospace");
    expect(getComputedStyle(shown).userSelect).not.toBe("none");
    // The calculator of FIRST reads the vector from the fragment as it is.
    expect(
      metrics
        .getByRole("link", {
          name: "Open in the FIRST calculator (another site)",
        })
        .element()
        .getAttribute("href"),
    ).toBe(`https://www.first.org/cvss/calculator/3.1#${NVD_V31_VECTOR}`);

    await userEvent.keyboard("{Escape}");

    await expect.element(metrics).not.toBeInTheDocument();
    await expect.element(vector).toHaveFocus();
  });

  test("open the metrics of a v4.0 vector in its groups, their terms in a column as wide as the longest one", async () => {
    showingCvss(fictionalCvssAssessments({ assessments: [NVD_V40] }));
    const { screen } = await renderCvss("NVD");

    await cvssPart(screen)
      .getByRole("button", { name: NVD_V40.vector_string, exact: true })
      .click();

    const metrics = screen.getByRole("dialog", { name: "NVD CVSS v4.0" });
    await expect.element(metrics).toBeVisible();
    expect(metricsOf(metrics)).toEqual([
      "Exploitability",
      ["Attack vector", "Network"],
      ["Attack complexity", "Low"],
      ["Attack requirements", "None"],
      ["Privileges required", "None"],
      ["User interaction", "None"],
      "Vulnerable system",
      ["Confidentiality", "High"],
      ["Integrity", "High"],
      ["Availability", "High"],
      "Subsequent system",
      ["Confidentiality", "None"],
      ["Integrity", "None"],
      ["Availability", "None"],
    ]);
    // No term wraps, and the values of every group start at the same place.
    const fields = metricFieldsOf(metrics);
    for (const [term] of fields) {
      expect(linesOfText(term)).toHaveLength(1);
    }
    expect(new Set(fields.map(([, value]) => boxOf(value).left)).size).toBe(1);
    // The vector wraps only after a slash, as in the table.
    const texts = linesOfText(
      metrics.getByText(NVD_V40.vector_string, { exact: true }).element(),
    );
    expect(texts.length).toBeGreaterThan(1);
    expect(texts.slice(0, -1).every((text) => text.endsWith("/"))).toBe(true);
    expect(
      metrics
        .getByRole("link", {
          name: "Open in the FIRST calculator (another site)",
        })
        .element()
        .getAttribute("href"),
    ).toBe(
      `https://www.first.org/cvss/calculator/4.0#${NVD_V40.vector_string}`,
    );
  });

  test("open the metrics of a v2.0 vector without a link, for which FIRST has no calculator, and show a value that the pinned contract does not list as received", async () => {
    showingCvss({
      ...fictionalCvssAssessments(),
      assessments: [
        {
          ...CNA_V20,
          metrics: { ...CNA_V20.metrics, access_vector: "fictional_vector" },
        },
      ],
    });
    const { screen } = await renderCvss("Fictional CNA");

    await cvssPart(screen)
      .getByRole("button", { name: CNA_V20.vector_string, exact: true })
      .click();

    const metrics = screen.getByRole("dialog", {
      name: "Fictional CNA CVSS v2.0",
    });
    await expect.element(metrics).toBeVisible();
    expect(metricsOf(metrics)).toEqual([
      "Exploitability",
      ["Access vector", "fictional_vector"],
      ["Access complexity", "Low"],
      ["Authentication", "None"],
      "Impact",
      ["Confidentiality", "Partial"],
      ["Integrity", "Partial"],
      ["Availability", "Partial"],
    ]);
    expect(metrics.getByRole("link").query()).toBeNull();
  });

  test("open the metrics of a v3.0 vector in the groups of v3.1, with a link to the calculator of FIRST for v3.0", async () => {
    const vector = "CVSS:3.0/AV:A/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N";
    showingCvss(
      fictionalCvssAssessments({
        assessments: [
          {
            ...fictionalAssessment(),
            provider_name: "Fictional CNA",
            cvss_version: "3.0",
            score: 5.4,
            severity: "medium",
            vector_string: vector,
            metrics: {
              attack_vector: "adjacent",
              attack_complexity: "low",
              privileges_required: "low",
              user_interaction: "required",
              scope: "changed",
              confidentiality_impact: "low",
              integrity_impact: "low",
              availability_impact: "none",
            },
          } satisfies CVSS30Assessment,
        ],
      }),
    );
    const { screen } = await renderCvss("Fictional CNA");

    await cvssPart(screen)
      .getByRole("button", { name: vector, exact: true })
      .click();

    const metrics = screen.getByRole("dialog", {
      name: "Fictional CNA CVSS v3.0",
    });
    await expect.element(metrics).toBeVisible();
    expect(metricsOf(metrics)).toEqual([
      "Exploitability",
      ["Attack vector", "Adjacent"],
      ["Attack complexity", "Low"],
      ["Privileges required", "Low"],
      ["User interaction", "Required"],
      ["Scope", "Changed"],
      "Impact",
      ["Confidentiality", "Low"],
      ["Integrity", "Low"],
      ["Availability", "None"],
    ]);
    expect(
      metrics
        .getByRole("link", {
          name: "Open in the FIRST calculator (another site)",
        })
        .element()
        .getAttribute("href"),
    ).toBe(`https://www.first.org/cvss/calculator/3.0#${vector}`);
  });

  test("show a metric value of several words in sentence case", async () => {
    showingCvss(
      fictionalCvssAssessments({
        assessments: [
          {
            ...CNA_V20,
            vector_string: "AV:A/AC:L/Au:N/C:P/I:P/A:P",
            metrics: { ...CNA_V20.metrics, access_vector: "adjacent_network" },
          },
        ],
      }),
    );
    const { screen } = await renderCvss("Fictional CNA");

    await cvssPart(screen)
      .getByRole("button", { name: "AV:A/AC:L/Au:N/C:P/I:P/A:P", exact: true })
      .click();

    const metrics = screen.getByRole("dialog", {
      name: "Fictional CNA CVSS v2.0",
    });
    await expect.element(metrics).toBeVisible();
    expect(metricsOf(metrics)[1]).toEqual([
      "Access vector",
      "Adjacent network",
    ]);
  });

  test("move the focus to the screen's heading when a new read leaves no table where it was", async () => {
    let assessments = fictionalCvssAssessments();
    stubTicket({ cvss: () => cvssResponse(assessments) });
    const { screen } = await renderCvss("SUSE");
    const table = cvssPart(screen).getByRole("grid", {
      name: "CVSS assessments",
    });
    await table.getByRole("rowheader", { name: "NVD" }).click();
    expect(table.element().contains(document.activeElement)).toBe(true);
    // Meanwhile the assessments of the CVE are gone.
    assessments = fictionalCvssAssessments({
      assessments: [],
      severity: null,
      eligibility: { score: 10, source: "fallback" },
    });

    returnToForeground();

    await expect
      .element(cvssPart(screen).getByText("No CVSS assessments."))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toHaveFocus();
  });

  test("say No CVSS assessments. without any", async () => {
    showingCvss(
      fictionalCvssAssessments({
        assessments: [],
        severity: null,
        eligibility: { score: 10, source: "fallback" },
      }),
    );
    const { screen } = await renderCvss("No CVSS assessments.");

    expect(cvssPart(screen).getByRole("grid").query()).toBeNull();
    expect(linesOf(screen)).toEqual([]);
  });

  test("are neither read nor shown for a Ticket without a CVE", async () => {
    const spy = showing([fictionalPackage()], { cve: null });
    const { screen } = await renderTree();

    await expect
      .element(screen.getByRole("region", { name: "CVE", exact: true }))
      .toBeVisible();
    expect(cvssPart(screen).query()).toBeNull();
    // No read of the CVSS assessments of any CVE.
    expect(
      spy.mock.calls
        .map(([input]) => urlOf(input).pathname)
        .filter((path) => /^\/api\/v1\/cves\/.*\/cvss$/.test(path)),
    ).toEqual([]);
  });

  test("show the loading indicator in their place until their read arrives", async () => {
    const response = later();
    stubTicket({ cvss: () => response.promise });
    const { screen } = await renderTree();

    await expect
      .element(cvssPart(screen).getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();

    response.resolve(cvssResponse());

    await expect
      .element(cvssPart(screen).getByRole("grid", { name: "CVSS assessments" }))
      .toBeVisible();
  });

  test("show the failure of their read in their place, with Try again where it offers it, and leave the rest of the screen usable", async () => {
    let fails = true;
    const spy = stubTicket({
      cvss: () =>
        fails ? errorResponse(503, "SERVICE_UNAVAILABLE") : cvssResponse(),
    });
    const { screen } = await renderTree();

    await expect
      .element(
        cvssPart(screen).getByText(
          "Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    // Sent again twice before the error shows (docs/behaviors.md, Retries
    // and Unconfirmed Changes).
    expect(requestsTo(spy, CVSS)).toBe(3);
    await expect
      .element(packagesPart(screen).getByText("No packages."))
      .toBeVisible();

    fails = false;
    await cvssPart(screen).getByRole("button", { name: "Try again" }).click();

    await expect
      .element(cvssPart(screen).getByRole("grid", { name: "CVSS assessments" }))
      .toBeVisible();
  });

  test("say that the CVE no longer exists after a 404, without Try again", async () => {
    stubTicket({ cvss: () => errorResponse(404, "CVE_NOT_FOUND") });
    const { screen } = await renderTree();

    await expect
      .element(
        cvssPart(screen).getByText(
          "This no longer exists, or you no longer have access to it.",
        ),
      )
      .toBeVisible();
    expect(
      cvssPart(screen).getByRole("button", { name: "Try again" }).query(),
    ).toBeNull();
  });

  test("are read again when the tab returns to the foreground, and stay shown with a warning when that read fails", async () => {
    let fails = false;
    const spy = stubTicket({
      cvss: () =>
        fails ? errorResponse(503, "SERVICE_UNAVAILABLE") : cvssResponse(),
    });
    const { screen } = await renderCvss("SUSE");
    fails = true;

    returnToForeground();

    await expect
      .element(
        cvssPart(screen).getByText(
          "This couldn't be updated. Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    expect(requestsTo(spy, CVSS)).toBe(4);
    expect(rowsOf(screen)).toHaveLength(2);
  });
});

// The dates and times of the sources of the tests.
const ATTEMPTED = "2099-10-08T08:00:00Z";
const LATER_ATTEMPT = "2099-10-09T09:30:00Z";
const FAILING_SINCE = "2099-10-06T06:00:00Z";
const KEV_UPDATED = "2099-10-07T04:00:00Z";

// The backgrounds of the messages of each tone in the light theme
// (docs/design-system.md, Tones).
const MESSAGE_TONES = {
  info: "rgb(221, 244, 255)",
  warning: "rgb(255, 248, 197)",
  danger: "rgb(255, 235, 233)",
} as const;

// The reference of the errors of the tests (src/test-api.ts).
const REFERENCE = "Reference: 01890a5d-ac96-774b-bcce-b302099a8057";

// An administrator who operates the fetchers, without triage_ticket.
const FETCHER_ADMIN: CurrentUserResponse = {
  data: {
    ...OTHER_USER.data,
    roles: ["admin"],
    capabilities: ["manage_fetchers"],
    assignment_eligibility: "none",
  },
};

// Waits until no read of the sources is in progress, so that a read at
// intervals is not merged into it.
async function sourcesSettled() {
  await expect.poll(() => client.isFetching({ queryKey: [SOURCES] })).toBe(0);
}

function sourcesPart(screen: Screen) {
  return screen.getByRole("region", {
    name: "Sources of the CVE",
    exact: true,
  });
}

// Renders the screen of SNTL-12 and waits until its sources show the text.
async function renderSources(text = "NVD", path = "/tickets/SNTL-12") {
  const rendered = await renderApp(path);
  await expect
    .element(
      sourcesPart(rendered.screen).getByText(text, { exact: true }).first(),
    )
    .toBeVisible();
  return rendered;
}

// The list item of a source, by its name.
function sourceOf(screen: Screen, name: string): Locator {
  return sourcesPart(screen)
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// Whether the user sees the element: neither it nor an element that holds it
// is transparent.
function seen(locator: Locator): boolean {
  return locator.element().checkVisibility({ opacityProperty: true });
}

// The element that a press reaches at the center of the mark of a source, in
// the middle of the place of 24 px at the start of its line.
function atMarkOf(screen: Screen, name: string): Element | null {
  const item = boxOf(sourceOf(screen, name));
  return document.elementFromPoint(item.left + 12, item.top + 12);
}

// The texts of an element, apart by a space.
function wordsOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const texts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    texts.push(node.textContent ?? "");
  }
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

// The line of each source, in the order of the page.
function sourceLines(screen: Screen): string[] {
  return sourcesPart(screen).getByRole("listitem").elements().map(wordsOf);
}

// What the status regions of the sources say, other than nothing.
function statusesOf(screen: Screen): string[] {
  return sourcesPart(screen)
    .getByRole("status")
    .elements()
    .map((region) => region.textContent ?? "")
    .filter((text) => text !== "");
}

function refetchOf(screen: Screen, name: string) {
  return sourcesPart(screen).getByRole("button", {
    name: `Refetch ${name}`,
    exact: true,
  });
}

function refetchAll(screen: Screen) {
  return sourcesPart(screen).getByRole("button", {
    name: "Refetch all",
    exact: true,
  });
}

// Presses a button from the keyboard, which keeps the focus on it.
async function press(button: Locator) {
  button.element().focus();
  await userEvent.keyboard("{Enter}");
}

// The color behind an element: the background of the nearest element, itself
// or one that contains it, that has one.
function backgroundBehind(element: Element): string {
  for (
    let current: Element | null = element;
    current;
    current = current.parentElement
  ) {
    const background = getComputedStyle(current).backgroundColor;
    if (background !== "rgba(0, 0, 0, 0)") {
      return background;
    }
  }
  return "transparent";
}

// The names of the animations that run in an element and its descendants.
function animationsIn(element: Element): string[] {
  return element
    .getAnimations({ subtree: true })
    .map((animation) =>
      animation instanceof CSSAnimation ? animation.animationName : "",
    );
}

// The pending fetch of MITRE and of NVD, and CISA KEV, which cannot be
// refetched.
function pendingSources(): CVESourceStatusItem[] {
  return [
    fictionalSource({
      source: "kev",
      status: "missing",
      refetchable: false,
    }),
    fictionalSource({
      source: "mitre",
      status: "pending",
      first_failed_at: FAILING_SINCE,
    }),
    fictionalSource({ status: "pending", fetched_at: null }),
  ];
}

describe("the sources of the CVE", () => {
  test("follow the details in the side column, 288 px wide, under a level-two heading, after a border line", async () => {
    stubTicket();
    const { screen } = await renderSources();
    const details = screen.getByRole("region", { name: "Details" });
    const part = sourcesPart(screen);

    await expect
      .element(
        part.getByRole("heading", { level: 2, name: "Sources of the CVE" }),
      )
      .toBeVisible();
    expect(boxOf(part).width).toBe(288);
    expect(boxOf(part).left).toBe(boxOf(details).left);
    expect(boxOf(part).top).toBeCloseTo(boxOf(details).bottom, 1);
    // 16 px below the content of the details, a border line, and the section
    // 16 px below it.
    const above = getComputedStyle(details.element());
    expect([
      above.paddingBottom,
      above.borderBottomWidth,
      above.borderBottomColor,
    ]).toEqual(["16px", "1px", BORDER]);
    expect(getComputedStyle(part.element()).paddingTop).toBe("16px");
    expect(
      details.element().compareDocumentPosition(part.element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("follow the package tree in one column, last in the order of the page, after a border line 32 px below it", async () => {
    await page.viewport(900, 800);
    stubTicket();
    const { screen } = await renderSources();
    const packages = packagesPart(screen);
    await expect
      .element(cvssPart(screen).getByRole("grid", { name: "CVSS assessments" }))
      .toBeVisible();
    const part = sourcesPart(screen);

    expect(
      packages.element().compareDocumentPosition(part.element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(boxOf(part).width).toBe(boxOf(packages).width);
    // 32 px below the content of the package tree, a border line, and the
    // section 16 px below it.
    expect(boxOf(part).top - boxOf(packages).bottom).toBeCloseTo(
      32 + 1 + 16,
      1,
    );
  });

  test("stay in their place, with the focus and a refetch in progress, when the layout changes", async () => {
    const response = later();
    stubTicket({ refetch: () => response.promise });
    const { screen } = await renderSources();
    const refetch = refetchOf(screen, "NVD");
    await press(refetch);
    await expect.element(refetch).toHaveAttribute("aria-disabled", "true");

    await page.viewport(900, 800);

    await expect
      .poll(
        () =>
          boxOf(sourcesPart(screen)).top > boxOf(packagesPart(screen)).bottom,
      )
      .toBe(true);
    await expect.element(refetch).toHaveFocus();
    expect(refetch.element().getAttribute("aria-disabled")).toBe("true");

    response.resolve(refetchResponse({ sources_enqueued: ["nvd"] }));

    await expect.element(refetch).not.toHaveAttribute("aria-disabled");
  });

  test("show each source in the order of the API: its name, its status, its labels, and the dates of its last attempt and of the start of its failure streak", async () => {
    stubTicket({
      sources: () =>
        sourcesResponse([
          fictionalSource({
            source: "epss",
            status: "not_attempted",
            fetched_at: null,
            enabled: false,
          }),
          fictionalSource({
            source: "ghsa",
            status: "pending",
            fetched_at: null,
          }),
          fictionalSource({
            source: "kernel",
            status: "missing",
          }),
          fictionalSource({
            source: "kev",
            status: "success",
            fetched_at: KEV_UPDATED,
            refetchable: false,
          }),
          fictionalSource({
            source: "mitre",
            status: "failure",
            first_failed_at: FAILING_SINCE,
          }),
          // A retry in flight keeps the dates of the last attempt and of the
          // failure streak.
          fictionalSource({
            status: "pending",
            first_failed_at: FAILING_SINCE,
          }),
          fictionalSource({ source: "osv", enabled: false }),
          fictionalSource({
            source: "redhat",
            status: "missing",
            registered: false,
            refetchable: false,
            enabled: false,
          }),
        ]),
    });
    const { screen } = await renderSources();
    const attempted = formatDateTime(ATTEMPTED);
    const since = formatDateTime(FAILING_SINCE);

    // The name of each status follows the name of its source for assistive
    // technologies; an absent date reads "Not set" (docs/behaviors.md,
    // Absent Values).
    expect(sourceLines(screen)).toEqual([
      "EPSS Not attempted Disabled Last attempt – Not set",
      "GHSA Pending Last attempt – Not set",
      `Linux Kernel CNA Missing Last attempt ${attempted}`,
      `CISA KEV Success Updated ${formatDateTime(KEV_UPDATED)}`,
      `MITRE Failure Last attempt ${attempted} Failing since ${since}`,
      `NVD Pending Last attempt ${attempted} Failing since ${since}`,
      `OSV Success Disabled Last attempt ${attempted}`,
      `Red Hat Missing Retired Last attempt ${attempted}`,
    ]);
    expect(sourcesPart(screen).getByRole("list").elements()).toHaveLength(1);
    // The name of the source at weight 500, the dates in text-13 and
    // fg-muted.
    const mitre = sourceOf(screen, "MITRE");
    expect(
      getComputedStyle(mitre.getByText("MITRE", { exact: true }).element())
        .fontWeight,
    ).toBe("500");
    const failing = mitre.getByText(/^Failing since/).element();
    expect([
      getComputedStyle(failing).fontSize,
      getComputedStyle(failing).color,
    ]).toEqual(["13px", FG_MUTED]);
    // The mark alone in a place of 24 px, the name 8 px after it, and the
    // name of the status only for assistive technologies.
    const osv = sourceOf(screen, "OSV");
    const item = boxOf(osv);
    const name = boxOf(osv.getByText("OSV", { exact: true }));
    expect(name.left - item.left).toBe(24 + 8);
    expect(boxOf(osv.getByText("Success")).width).toBeLessThanOrEqual(1);
    // The label at the end of the first line, centered on it
    // (docs/design-system.md, Labels).
    const label = boxOf(osv.getByText("Disabled", { exact: true }));
    expect(label.right).toBeCloseTo(item.right, 1);
    expect((label.top + label.bottom) / 2).toBeCloseTo(item.top + 12, 0);
    // The dates below the name, across the width of the line, the place of
    // the label included.
    const date = boxOf(osv.getByText(/^Last attempt/));
    expect(date.left).toBe(name.left);
    expect(date.right).toBeCloseTo(item.right, 1);
    expect(date.top).toBeGreaterThanOrEqual(label.bottom);
  });

  test("mark each status in the color of its tone, never by the color alone, the pending fetch turning and standing still under reduced motion", async () => {
    stubTicket({
      sources: () =>
        sourcesResponse([
          fictionalSource({
            source: "epss",
            status: "not_attempted",
            fetched_at: null,
          }),
          fictionalSource({
            source: "ghsa",
            status: "pending",
            fetched_at: null,
          }),
          fictionalSource({ source: "kernel", status: "missing" }),
          fictionalSource({
            source: "mitre",
            status: "failure",
            first_failed_at: FAILING_SINCE,
          }),
          fictionalSource(),
        ]),
    });
    const { screen } = await renderSources();
    // The color at the center of the mark of a status, in the middle of its
    // place of 24 px at the start of the line; the shapes and sizes of the
    // marks are those of src/components/marked-value.test.tsx.
    const markAt = async (name: string) => {
      const picture = await screenshot(sourceOf(screen, name));
      return picture.at(12, 12);
    };

    expect(await markAt("NVD")).toBe("#1a7f37");
    expect(await markAt("MITRE")).toBe("#cf222e");
    // Failure differs from Success also by the start of its failure streak.
    expect(sourceLines(screen)[3]).toMatch(/Failing since/);
    expect(sourceLines(screen)[4]).not.toMatch(/Failing since/);
    // The circle of Missing and the dashed circle of Not attempted are
    // hollow, unlike a dot.
    expect(await markAt("Linux Kernel CNA")).toBe("#f6f8fa");
    expect(await markAt("EPSS")).toBe("#f6f8fa");
    expect(animationsIn(sourceOf(screen, "EPSS").element())).toEqual([]);
    expect(animationsIn(sourceOf(screen, "GHSA").element())).toEqual(["spin"]);

    await commands.emulateReducedMotion(true);

    expect(animationsIn(sourceOf(screen, "GHSA").element())).toEqual([]);
  });

  test("show a source and a status that the pinned contract does not list as received", async () => {
    stubTicket({
      sources: () =>
        jsonResponse(200, {
          data: [
            fictionalSource({
              source: "fictional_source",
              registered: false,
              refetchable: false,
              enabled: false,
            }),
            { ...fictionalSource(), status: "fictional_status" },
          ],
        }),
    });
    const { screen } = await renderSources("fictional_source");
    const attempted = formatDateTime(ATTEMPTED);

    expect(sourceLines(screen)).toEqual([
      `fictional_source Success Retired Last attempt ${attempted}`,
      `NVD fictional_status Last attempt ${attempted}`,
    ]);
    // The status as received only for assistive technologies, after the
    // mark of an unknown value (docs/behaviors.md, Unknown Values), and no
    // Refetch of a source whose status the screen cannot tell.
    expect(
      boxOf(sourceOf(screen, "NVD").getByText("fictional_status")).width,
    ).toBeLessThanOrEqual(1);
    expect(refetchOf(screen, "NVD").query()).toBeNull();
    await expect.element(refetchAll(screen)).toBeVisible();
  });

  test("say No sources. without any, without Refetch all", async () => {
    stubTicket({ sources: () => sourcesResponse([]) });
    const { screen } = await renderSources("No sources.");

    expect(refetchAll(screen).query()).toBeNull();
    expect(sourcesPart(screen).getByRole("list").query()).toBeNull();
  });

  test("are neither read nor shown for a Ticket without a CVE", async () => {
    const spy = showing([fictionalPackage()], { cve: null });
    const { screen } = await renderTree();

    await expect
      .element(screen.getByRole("region", { name: "Details" }))
      .toBeVisible();
    expect(sourcesPart(screen).query()).toBeNull();
    expect(
      spy.mock.calls
        .map(([input]) => urlOf(input).pathname)
        .filter((path) => path.startsWith("/api/v1/cves/")),
    ).toEqual([]);
  });

  test("show the loading indicator in their place until their read arrives, and the failure of their read in their place, with Try again", async () => {
    const first = later();
    let read = 0;
    let fails = true;
    const spy = stubTicket({
      sources: () => {
        read += 1;
        if (read === 1) {
          return first.promise;
        }
        return fails ? errorResponse(500, "INTERNAL_ERROR") : sourcesResponse();
      },
    });
    const { screen } = await renderTree();

    await expect
      .element(
        sourcesPart(screen).getByRole("progressbar", { name: "Loading" }),
      )
      .toBeVisible();

    first.resolve(errorResponse(500, "INTERNAL_ERROR"));

    await expect
      .element(
        sourcesPart(screen).getByText(
          "Something went wrong in Sentinel. Try again, and if it happens again, report it with the reference below.",
        ),
      )
      .toBeVisible();
    expect(requestsTo(spy, SOURCES)).toBe(3);
    expect(refetchAll(screen).query()).toBeNull();
    await expect
      .element(screen.getByRole("region", { name: "Details" }))
      .toBeVisible();

    fails = false;
    await sourcesPart(screen)
      .getByRole("button", { name: "Try again" })
      .click();

    await expect.element(sourceOf(screen, "NVD")).toBeVisible();
  });

  test("remove the sources and Refetch all when a new read of them is refused with a 404, the focus on Refetch all moving to the screen's heading", async () => {
    let refused = false;
    stubTicket({
      sources: () =>
        refused ? errorResponse(404, "CVE_NOT_FOUND") : sourcesResponse(),
    });
    const { screen } = await renderSources();
    refetchAll(screen).element().focus();
    await expect.element(refetchAll(screen)).toHaveFocus();
    refused = true;

    returnToForeground();

    await expect
      .element(
        sourcesPart(screen).getByText(
          "This no longer exists, or you no longer have access to it.",
        ),
      )
      .toBeVisible();
    expect(refetchAll(screen).query()).toBeNull();
    expect(sourcesPart(screen).getByRole("listitem").query()).toBeNull();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toHaveFocus();
  });

  test("offer Refetch of each source that can be refetched and is not pending, named after it, and Refetch all, to a user with triage_ticket", async () => {
    stubTicket({
      sources: () =>
        sourcesResponse([
          fictionalSource({ source: "epss", enabled: false }),
          fictionalSource({
            source: "kev",
            status: "missing",
            refetchable: false,
          }),
          fictionalSource({
            source: "legacy_source",
            registered: false,
            refetchable: false,
            enabled: false,
          }),
          fictionalSource({ source: "mitre", status: "pending" }),
          fictionalSource(),
        ]),
    });
    const { screen } = await renderSources();

    expect(
      sourcesPart(screen)
        .getByRole("button", { name: /^Refetch/ })
        .elements()
        .map(
          (button) => button.getAttribute("aria-label") ?? button.textContent,
        ),
    ).toEqual(["Refetch all", "Refetch NVD"]);
    // A target of 24 px in the place of the mark, at the start of the line
    // of its source, and Refetch all a quiet button 32 px high at the end of
    // the heading.
    const refetch = boxOf(refetchOf(screen, "NVD"));
    const item = boxOf(sourceOf(screen, "NVD"));
    expect([refetch.width, refetch.height]).toEqual([24, 24]);
    expect([refetch.left, refetch.top]).toEqual([item.left, item.top]);
    const all = refetchAll(screen).element();
    expect(boxOf(refetchAll(screen)).height).toBe(32);
    expect([
      getComputedStyle(all).borderTopWidth,
      getComputedStyle(all).backgroundColor,
    ]).toEqual(["0px", "rgba(0, 0, 0, 0)"]);
    expect(boxOf(refetchAll(screen)).right).toBeCloseTo(
      boxOf(sourcesPart(screen)).right,
      1,
    );
    expect(boxOf(refetchAll(screen)).bottom).toBeLessThanOrEqual(
      boxOf(sourceOf(screen, "EPSS")).top,
    );
  });

  test.each<[string, CurrentUserResponse]>([
    ["a reader", FICTIONAL_USER],
    ["a user without triage_ticket", FETCHER_ADMIN],
  ])("offer no Refetch to %s", async (_, user) => {
    stubTicket({ user });
    const { screen } = await renderSources();

    expect(sourcesPart(screen).getByRole("button").query()).toBeNull();
  });

  test("offer no Refetch all when no source can be refetched", async () => {
    stubTicket({
      sources: () =>
        sourcesResponse([
          fictionalSource({ source: "mitre", enabled: false }),
          fictionalSource({ enabled: false }),
        ]),
    });
    const { screen } = await renderSources();

    expect(sourcesPart(screen).getByRole("button").query()).toBeNull();
  });

  test("show Refetch of a source in place of its mark while the pointer is over the line of the source, and let the pointer reach it only then", async () => {
    stubTicket();
    const { screen } = await renderSources();
    const refetch = refetchOf(screen, "NVD");
    await screen.getByRole("heading", { level: 2, name: "Details" }).hover();

    // Transparent, and a press at its place, such as a tap, does not reach
    // it, while it stays for the keyboard and assistive technologies.
    expect(seen(refetch)).toBe(false);
    expect(refetch.element().contains(atMarkOf(screen, "NVD"))).toBe(false);

    await sourceOf(screen, "NVD")
      .getByText(/^Last attempt/)
      .hover();

    await expect.poll(() => seen(refetch)).toBe(true);
    expect(refetch.element().contains(atMarkOf(screen, "NVD"))).toBe(true);
    // The other sources keep their marks.
    expect(seen(refetchOf(screen, "MITRE"))).toBe(false);
  });

  test("bring the mark back in place of Refetch of a source with Escape while the pointer stays over the line, until the pointer leaves it, except while Refetch has the focus", async () => {
    stubTicket();
    const { screen } = await renderSources();
    const refetch = refetchOf(screen, "NVD");
    const line = sourceOf(screen, "NVD").getByText(/^Last attempt/);
    await line.hover();
    await expect.poll(() => seen(refetch)).toBe(true);

    await userEvent.keyboard("{Escape}");

    await expect.poll(() => seen(refetch)).toBe(false);
    expect(refetch.element().contains(atMarkOf(screen, "NVD"))).toBe(false);
    // The focus shows it again, and the pointer reaches it, still over the
    // line.
    refetch.element().focus({ focusVisible: true });
    await expect.element(refetch).toHaveFocus();
    expect(seen(refetch)).toBe(true);
    expect(refetch.element().contains(atMarkOf(screen, "NVD"))).toBe(true);
    refetch.element().blur();

    await screen.getByRole("heading", { level: 2, name: "Details" }).hover();
    await line.hover();

    await expect.poll(() => seen(refetch)).toBe(true);
    expect(refetch.element().contains(atMarkOf(screen, "NVD"))).toBe(true);
  });

  test("show Refetch of a source in place of its mark while it has the focus", async () => {
    stubTicket();
    const { screen } = await renderSources();
    const refetch = refetchOf(screen, "NVD");
    expect((await screenshot(sourceOf(screen, "NVD"))).at(12, 12)).toBe(
      "#1a7f37",
    );

    refetch.element().focus({ focusVisible: true });

    await expect.element(refetch).toHaveFocus();
    expect(seen(refetch)).toBe(true);
    // The dot gives way to refresh-cw, whose center shows the page.
    expect((await screenshot(sourceOf(screen, "NVD"))).at(12, 12)).toBe(
      "#f6f8fa",
    );
  });

  test("keep Refetch of a source shown while it is busy, and leave the focus where it was after a press of the pointer, when the read after it shows the source Pending", async () => {
    const response = later();
    let sources = [fictionalSource({ source: "mitre" }), fictionalSource()];
    stubTicket({
      refetch: () => response.promise,
      sources: () => sourcesResponse(sources),
    });
    const { screen } = await renderSources();
    const refetch = refetchOf(screen, "NVD");
    await sourceOf(screen, "NVD")
      .getByText(/^Last attempt/)
      .hover();

    await refetch.click();

    await expect.element(refetch).toHaveAttribute("aria-disabled", "true");
    expect(refetch.element()).not.toBe(document.activeElement);
    await screen.getByRole("heading", { level: 2, name: "Details" }).hover();
    expect(seen(refetch)).toBe(true);
    expect(seen(refetchOf(screen, "MITRE"))).toBe(false);
    // The dot gives way to the spinner, whose center shows the page.
    expect((await screenshot(sourceOf(screen, "NVD"))).at(12, 12)).toBe(
      "#f6f8fa",
    );

    sources = [
      fictionalSource({ source: "mitre" }),
      fictionalSource({ status: "pending" }),
    ];
    response.resolve(refetchResponse({ sources_enqueued: ["nvd"] }));

    await expect
      .element(screen.getByText("Refetch of NVD started."))
      .toBeVisible();
    await expect.poll(() => refetch.query()).toBeNull();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .not.toHaveFocus();
  });

  test("move the focus to the screen's heading when the read after a refetch from the keyboard shows its source Pending", async () => {
    let sources = [fictionalSource()];
    stubTicket({
      refetch: () => {
        sources = [fictionalSource({ status: "pending" })];
        return refetchResponse({ sources_enqueued: ["nvd"] });
      },
      sources: () => sourcesResponse(sources),
    });
    const { screen } = await renderSources();

    await press(refetchOf(screen, "NVD"));

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toHaveFocus();
    expect(refetchOf(screen, "NVD").query()).toBeNull();
  });

  test("refetch a source with Re-fetch CVE Data, busy until Sentinel answers, then say that it started and read the sources again", async () => {
    const response = later();
    const spy = stubTicket({ refetch: () => response.promise });
    const { screen } = await renderSources();
    const refetch = refetchOf(screen, "NVD");

    await press(refetch);

    await expect.element(refetch).toHaveAttribute("aria-disabled", "true");
    expect(animationsIn(refetch.element())).toEqual(["spin"]);
    const requests = spy.mock.calls
      .map(([input, init]) => [init?.method, urlOf(input)] as const)
      .filter(([, url]) => url.pathname === REFETCH);
    expect(requests.map(([method, url]) => [method, url.search])).toEqual([
      ["POST", "?source=nvd"],
    ]);
    // Pressing it again while it is busy sends nothing.
    await userEvent.keyboard("{Enter}");
    expect(requestsTo(spy, REFETCH)).toBe(1);
    // Only the button that started the refetch is busy.
    expect(refetchAll(screen).element().getAttribute("aria-disabled")).toBe(
      null,
    );
    const sourcesRead = requestsTo(spy, SOURCES);
    const ticketRead = requestsTo(spy, TICKET);

    response.resolve(refetchResponse({ sources_enqueued: ["nvd"] }));

    const message = screen.getByText("Refetch of NVD started.");
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.info);
    await expect.element(refetch).not.toHaveAttribute("aria-disabled");
    await expect.element(refetch).toHaveFocus();
    await expect
      .poll(() => requestsTo(spy, SOURCES))
      .toBeGreaterThan(sourcesRead);
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(ticketRead + 1);
  });

  test("refetch every source with Refetch all, busy until Sentinel answers", async () => {
    const response = later();
    stubTicket({ refetch: () => response.promise });
    const { screen } = await renderSources();
    // CISA KEV, Missing here, shows when its last attempt was, as in every
    // status but Success, whose date is the last change of its evidence.
    expect(sourceLines(screen)[0]).toBe(
      `CISA KEV Missing Last attempt ${formatDateTime("2099-10-08T04:00:00Z")}`,
    );

    await press(refetchAll(screen));

    await expect
      .element(refetchAll(screen))
      .toHaveAttribute("aria-disabled", "true");
    expect(animationsIn(refetchAll(screen).element())).toEqual(["spin"]);
    expect(
      refetchOf(screen, "NVD").element().getAttribute("aria-disabled"),
    ).toBe(null);

    response.resolve(refetchResponse({ sources_enqueued: ["mitre", "nvd"] }));

    await expect
      .element(screen.getByText("Refetch started.", { exact: true }))
      .toBeVisible();
    await expect
      .element(refetchAll(screen))
      .not.toHaveAttribute("aria-disabled");
  });

  test.each<[string, string, Parameters<typeof refetchResponse>[0], string]>([
    [
      "NVD",
      "?source=nvd",
      { sources_already_pending: ["nvd"] },
      "Refetch of NVD was already in progress.",
    ],
    [
      "all",
      "",
      { sources_enqueued: ["mitre", "nvd"], sources_disabled: ["osv"] },
      "Refetch started. OSV is disabled and was skipped.",
    ],
    [
      "all",
      "",
      {
        sources_enqueued: ["nvd"],
        sources_already_pending: ["mitre"],
        sources_disabled: ["ghsa", "fictional_source"],
      },
      "Refetch started. GHSA and fictional_source are disabled and were skipped.",
    ],
    [
      "all",
      "",
      { sources_already_pending: ["mitre", "nvd"] },
      "Refetch was already in progress.",
    ],
  ])(
    "say what a refetch of %s (%s) started: %j",
    async (name, search, result, text) => {
      const spy = stubTicket({ refetch: () => refetchResponse(result) });
      const { screen } = await renderSources();

      await press(
        name === "all" ? refetchAll(screen) : refetchOf(screen, name),
      );

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.info);
      const [input] = spy.mock.calls.find(
        ([request]) => urlOf(request).pathname === REFETCH,
      )!;
      expect(urlOf(input).search).toBe(search);
    },
  );

  test.each<[Parameters<typeof refetchResponse>[0], string]>([
    [
      {
        sources_enqueued: ["nvd"],
        sources_disabled: ["osv"],
        sources_failed: ["mitre"],
      },
      "Refetch started. OSV is disabled and was skipped. Sentinel didn't confirm the refetch of MITRE: it may still start.",
    ],
    [
      { sources_already_pending: ["nvd"], sources_failed: ["mitre", "redhat"] },
      "Refetch was already in progress. Sentinel didn't confirm the refetch of MITRE and Red Hat: they may still start.",
    ],
  ])(
    "warn of the sources whose refetch Sentinel did not confirm: %j",
    async (result, text) => {
      stubTicket({ refetch: () => refetchResponse(result) });
      const { screen } = await renderSources();

      await press(refetchAll(screen));

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.warning);
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
      "503 CVE_FETCH_FAILED",
      () => errorResponse(503, "CVE_FETCH_FAILED"),
      "No enabled source can refetch this CVE.",
      "danger",
      true,
    ],
    [
      "503 CELERY_UNAVAILABLE",
      () => errorResponse(503, "CELERY_UNAVAILABLE"),
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      "warning",
      true,
    ],
    [
      "a network failure",
      () => Promise.reject(new TypeError("Failed to fetch")),
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      "warning",
      false,
    ],
    [
      "409 FETCHER_DISABLED",
      () => errorResponse(409, "FETCHER_DISABLED"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
      false,
    ],
    [
      "404 CVE_NOT_FOUND",
      () => errorResponse(404, "CVE_NOT_FOUND"),
      "This no longer exists, or you no longer have access to it.",
      "danger",
      false,
    ],
    [
      "422 CVE_INVALID_SOURCE",
      () => errorResponse(422, "CVE_INVALID_SOURCE"),
      "Sentinel didn't accept this request.",
      "danger",
      false,
    ],
    [
      "a status and a code that the pinned contract does not list",
      () => errorResponse(418, "FICTIONAL_CODE"),
      "Sentinel didn't accept this request.",
      "danger",
      false,
    ],
  ])(
    "show the failure of a refetch, %s, in the message area, and read the sources again",
    async (_, respond, text, tone, reference) => {
      const spy = stubTicket({ refetch: respond });
      const { screen } = await renderSources();
      const sourcesRead = requestsTo(spy, SOURCES);

      await press(refetchOf(screen, "NVD"));

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES[tone]);
      expect(screen.getByText(REFERENCE).query() !== null).toBe(reference);
      await expect
        .poll(() => requestsTo(spy, SOURCES))
        .toBeGreaterThan(sourcesRead);
      // A change is never sent again by itself (docs/behaviors.md, Retries
      // and Unconfirmed Changes).
      expect(requestsTo(spy, REFETCH)).toBe(1);
    },
  );

  test("end the session after a 401 of a refetch, without a failure of the UI", async () => {
    stubTicket({ refetch: () => errorResponse(401, "AUTH_NOT_AUTHENTICATED") });
    const { screen } = await renderSources();

    await press(refetchOf(screen, "NVD"));

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
  });

  test("leave an answer of a refetch that the UI cannot show to the page of a failure of the UI", async () => {
    // The answer of a later release that lacks the lists, which the
    // message cannot name.
    stubTicket({ refetch: () => jsonResponse(202, { data: {} }) });
    const { screen } = await renderSources();

    await press(refetchOf(screen, "NVD"));

    await expect
      .element(
        screen.getByRole("heading", {
          level: 1,
          name: "Something went wrong",
        }),
      )
      .toBeVisible();
  });

  test("name the Ticket with a link in the message of a refetch that ends after the user left its screen", async () => {
    const response = later();
    stubTicket({ refetch: () => response.promise });
    const { router, screen } = await renderSources();
    await press(refetchOf(screen, "NVD"));
    await router.navigate({ to: "/tickets" });
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();

    response.resolve(refetchResponse({ sources_enqueued: ["nvd"] }));

    await expect
      .element(screen.getByText("SNTL-12: Refetch of NVD started."))
      .toBeVisible();
    const link = screen.getByRole("link", { name: "SNTL-12", exact: true });
    await expect.element(link).toHaveAttribute("href", "/tickets/SNTL-12");

    await link.click();

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toBeVisible();
  });

  test("name the Ticket in the message of a failed refetch that ends after the user left its screen", async () => {
    const response = later();
    stubTicket({ refetch: () => response.promise });
    const { router, screen } = await renderSources();
    await press(refetchOf(screen, "NVD"));
    await router.navigate({ to: "/tickets" });
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();

    response.resolve(errorResponse(409, "FETCHER_DISABLED"));

    await expect
      .element(
        screen.getByText(
          "SNTL-12: This can't be done in the current state, which may have changed. Check it and try again.",
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
      .toHaveAttribute("href", "/tickets/SNTL-12");
  });

  test("are read again every 5 seconds while a fetch is pending, not while the tab is hidden, and no longer once none is", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let sources = pendingSources();
    const spy = stubTicket({ sources: () => sourcesResponse(sources) });
    await renderSources();
    expect(requestsTo(spy, SOURCES)).toBe(1);

    vi.advanceTimersByTime(4_999);
    expect(requestsTo(spy, SOURCES)).toBe(1);
    vi.advanceTimersByTime(1);
    await expect.poll(() => requestsTo(spy, SOURCES)).toBe(2);
    await sourcesSettled();

    // While the tab is hidden, no read at intervals is sent.
    focusManager.setFocused(false);
    vi.advanceTimersByTime(15_000);
    expect(requestsTo(spy, SOURCES)).toBe(2);
    // The tab returns to the foreground, where the sources are read again.
    focusManager.setFocused(true);
    await expect.poll(() => requestsTo(spy, SOURCES)).toBe(3);
    await sourcesSettled();

    sources = pendingSources().map((source) =>
      source.status === "pending"
        ? { ...source, status: "success", fetched_at: LATER_ATTEMPT }
        : source,
    );
    vi.advanceTimersByTime(5_000);
    await expect.poll(() => requestsTo(spy, SOURCES)).toBe(4);

    vi.advanceTimersByTime(30_000);
    expect(requestsTo(spy, SOURCES)).toBe(4);
  });

  test("stop the reads at intervals after one fails, keeping the sources shown with a warning, until a read of them succeeds", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let fails = false;
    const spy = stubTicket({
      sources: () =>
        fails
          ? errorResponse(503, "SERVICE_UNAVAILABLE")
          : sourcesResponse(pendingSources()),
    });
    const { screen } = await renderSources();
    fails = true;

    vi.advanceTimersByTime(5_000);

    const warning = sourcesPart(screen).getByText(
      "This couldn't be updated. Sentinel isn't available right now. Try again later.",
    );
    await expect.element(warning).toBeVisible();
    // The read and its two retries (docs/behaviors.md, Retries and
    // Unconfirmed Changes).
    expect(requestsTo(spy, SOURCES)).toBe(4);
    await expect.element(sourceOf(screen, "NVD")).toBeVisible();
    vi.advanceTimersByTime(30_000);
    expect(requestsTo(spy, SOURCES)).toBe(4);

    fails = false;
    await sourcesPart(screen)
      .getByRole("button", { name: "Try again" })
      .click();
    await expect.element(warning).not.toBeInTheDocument();
    expect(requestsTo(spy, SOURCES)).toBe(5);
    await sourcesSettled();

    vi.advanceTimersByTime(5_000);
    await expect.poll(() => requestsTo(spy, SOURCES)).toBe(6);
  });

  test("announce what a read shows of the fetches that ended, in one announcement in the order of the sources, and read the data of the tab again", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let sources = pendingSources();
    const spy = stubTicket({ sources: () => sourcesResponse(sources) });
    const { screen } = await renderSources();
    await expect
      .element(cvssPart(screen).getByRole("grid", { name: "CVSS assessments" }))
      .toBeVisible();
    const ticketRead = requestsTo(spy, TICKET);
    const duplicatesRead = requestsTo(spy, TICKETS);
    const cvssRead = requestsTo(spy, CVSS);
    sources = [
      sources[0]!,
      { ...sources[1]!, status: "failure", fetched_at: LATER_ATTEMPT },
      { ...sources[2]!, status: "success", fetched_at: LATER_ATTEMPT },
    ];

    vi.advanceTimersByTime(5_000);

    await expect
      .poll(() => statusesOf(screen))
      .toEqual(["MITRE: Failure. NVD: Success."]);
    // The text in its place, without a message.
    expect(sourceLines(screen)[1]).toBe(
      `MITRE Failure Last attempt ${formatDateTime(LATER_ATTEMPT)} Failing since ${formatDateTime(FAILING_SINCE)}`,
    );
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(ticketRead + 1);
    await expect.poll(() => requestsTo(spy, TICKETS)).toBe(duplicatesRead + 1);
    await expect.poll(() => requestsTo(spy, CVSS)).toBe(cvssRead + 1);
    // The sources themselves are not read again, nor at intervals.
    vi.advanceTimersByTime(30_000);
    expect(requestsTo(spy, SOURCES)).toBe(2);
  });

  test("read again the work of a maintainer when a fetch ends", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let sources = [fictionalSource({ status: "pending" })];
    const spy = showing(
      [fictionalPackage()],
      {},
      { user: MAINTAINER, sources: () => sourcesResponse(sources) },
    );
    await renderSources("Pending");
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
    sources = [fictionalSource({ fetched_at: LATER_ATTEMPT })];

    vi.advanceTimersByTime(5_000);

    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(2);
  });

  test("read again the users who acted on the Ticket and its access grants when a fetch ends", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let sources = [fictionalSource({ status: "pending" })];
    const spy = stubTicket({
      ticket: () =>
        ticketResponse(fictionalTicketDetail({ is_confidential: true })),
      sources: () => sourcesResponse(sources),
    });
    await renderSources("Pending");
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(1);
    await expect.poll(() => requestsTo(spy, ACCESS)).toBe(1);
    sources = [fictionalSource({ fetched_at: LATER_ATTEMPT })];

    vi.advanceTimersByTime(5_000);

    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(2);
    await expect.poll(() => requestsTo(spy, ACCESS)).toBe(2);
  });

  test("announce each end in a node of its own, so that the same words are announced again", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const pending = [fictionalSource({ status: "pending" })];
    const ended = [fictionalSource({ fetched_at: LATER_ATTEMPT })];
    let sources = pending;
    stubTicket({ sources: () => sourcesResponse(sources) });
    const { screen } = await renderSources();
    sources = ended;
    vi.advanceTimersByTime(5_000);
    await expect.poll(() => statusesOf(screen)).toEqual(["NVD: Success."]);
    const first = sourcesPart(screen).getByText("NVD: Success.").element();

    // Another fetch, which ends in the same way.
    sources = pending;
    returnToForeground();
    await expect
      .element(sourceOf(screen, "NVD").getByText("Pending"))
      .toBeVisible();
    await sourcesSettled();
    sources = ended;
    vi.advanceTimersByTime(5_000);

    await expect
      .poll(() => sourcesPart(screen).getByText("NVD: Success.").element())
      .not.toBe(first);
  });

  test("announce a status that the pinned contract does not list as received", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let sources: object[] = [fictionalSource({ status: "pending" })];
    stubTicket({ sources: () => jsonResponse(200, { data: sources }) });
    const { screen } = await renderSources();
    sources = [
      { ...fictionalSource({ fetched_at: LATER_ATTEMPT }), status: "paused" },
    ];

    vi.advanceTimersByTime(5_000);

    await expect.poll(() => statusesOf(screen)).toEqual(["NVD: paused."]);
  });

  test("announce no new result for a fetch that ended without a new attempt", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let sources = pendingSources();
    stubTicket({ sources: () => sourcesResponse(sources) });
    const { screen } = await renderSources();
    // MITRE goes back to the status of its last attempt, as when Sentinel
    // did not run its fetch, and NVD stays without one.
    sources = [
      sources[0]!,
      { ...sources[1]!, status: "failure" },
      { ...sources[2]!, status: "not_attempted" },
    ];

    vi.advanceTimersByTime(5_000);

    await expect
      .poll(() => statusesOf(screen))
      .toEqual(["MITRE: no new result. NVD: no new result."]);
  });

  test("announce nothing of a fetch that no read of the screen showed pending, such as one that the screen showed from an earlier visit", async () => {
    let sources = pendingSources();
    const spy = stubTicket({ sources: () => sourcesResponse(sources) });
    const { router, screen } = await renderSources("Pending");
    await router.navigate({ to: "/tickets" });
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
    sources = pendingSources().map((source) =>
      source.status === "pending"
        ? { ...source, status: "success", fetched_at: LATER_ATTEMPT }
        : source,
    );
    const sourcesRead = requestsTo(spy, SOURCES);

    await router.navigate({
      to: "/tickets/$ticketId",
      params: { ticketId: "SNTL-12" },
    });

    await expect.poll(() => requestsTo(spy, SOURCES)).toBe(sourcesRead + 1);
    await expect
      .element(sourceOf(screen, "NVD").getByText("Success"))
      .toBeVisible();
    expect(statusesOf(screen)).toEqual([]);
  });

  test("move the focus to the screen's heading when a new read removes the Refetch that has it", async () => {
    let sources = [fictionalSource()];
    stubTicket({ sources: () => sourcesResponse(sources) });
    const { screen } = await renderSources();
    refetchOf(screen, "NVD").element().focus();
    await expect.element(refetchOf(screen, "NVD")).toHaveFocus();
    // Meanwhile NVD was disabled.
    sources = [fictionalSource({ enabled: false })];

    returnToForeground();

    await expect
      .element(sourceOf(screen, "NVD").getByText("Disabled"))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toHaveFocus();
  });
});

// ----------------------------------------------------------------------------
// Participants

// An analyst who manages confidentiality, who grants and revokes access.
const MANAGER: CurrentUserResponse = {
  data: {
    ...OTHER_USER.data,
    capabilities: ["triage_ticket", "manage_confidentiality"],
  },
};

// Carol White, who holds the grant of fictionalGrant, and a second grantee.
const CAROL = fictionalGrant();
const EMMA = fictionalGrant({
  user: {
    id: "00000000-0000-0000-0000-000000000009",
    username: "egreen",
    full_name: "Emma Green",
    active: true,
    bot: false,
  },
  granted_at: "2099-10-11T08:00:00Z",
});

// A confidential SNTL-12, assigned to Alice Smith, the user of OTHER_USER.
function confidentialTicket(fields: Partial<TicketDetail> = {}) {
  return ticketResponse(
    fictionalTicketDetail({
      is_confidential: true,
      assignee: FICTIONAL_ACTORS[1]!,
      ...fields,
    }),
  );
}

// The same SNTL-12, no longer confidential.
function declassifiedTicket() {
  return ticketResponse(
    fictionalTicketDetail({ assignee: FICTIONAL_ACTORS[1]! }),
  );
}

function participantsPart(screen: Screen) {
  return screen.getByRole("region", { name: "Participants", exact: true });
}

function participantsGroup(screen: Screen) {
  return participantsPart(screen).getByRole("toolbar", {
    name: "Participants",
  });
}

// The names of the participants, in their order.
function participantNames(screen: Screen): (string | null)[] {
  return participantsGroup(screen)
    .getByRole("img")
    .elements()
    .map((element) => element.getAttribute("aria-label"));
}

function accessGrantsButton(screen: Screen) {
  return participantsPart(screen).getByRole("button", {
    name: "Access grants",
    exact: true,
  });
}

function accessGrantsDialog(screen: Screen) {
  return screen.getByRole("dialog", { name: "Access grants" });
}

function userField(screen: Screen) {
  return accessGrantsDialog(screen).getByRole("combobox", { name: "User" });
}

function grantButton(screen: Screen) {
  return accessGrantsDialog(screen).getByRole("button", {
    name: "Grant access",
    exact: true,
  });
}

function revokeOf(screen: Screen, name: string) {
  return accessGrantsDialog(screen).getByRole("button", {
    name: `Revoke access of ${name}`,
    exact: true,
  });
}

function confirmationOf(screen: Screen, name: string) {
  return screen.getByRole("dialog", { name: `Revoke access of ${name}?` });
}

// What the status regions of the dialog of the access grants say.
function dialogStatus(screen: Screen): string {
  return accessGrantsDialog(screen)
    .getByRole("status")
    .elements()
    .map((region) => region.textContent ?? "")
    .join("");
}

// The lines of the grants in the dialog, in their order.
function grantLines(screen: Screen): (string | null)[] {
  return accessGrantsDialog(screen)
    .getByRole("list", { name: "Access grants" })
    .getByRole("listitem")
    .elements()
    .map((element) => element.textContent);
}

// Renders the screen of SNTL-12 and waits until its participants show.
async function renderParticipants() {
  const rendered = await renderApp("/tickets/SNTL-12");
  await expect
    .element(
      participantsPart(rendered.screen)
        .getByRole("toolbar")
        .or(participantsPart(rendered.screen).getByText("No participants.")),
    )
    .toBeVisible();
  return rendered;
}

// Opens the access grants and waits until they show, or say that the Ticket
// has none.
async function openAccessGrants(screen: Screen, empty = false) {
  await accessGrantsButton(screen).click();
  const dialog = accessGrantsDialog(screen);
  await expect
    .element(
      empty
        ? dialog.getByText("No access grants.")
        : dialog.getByRole("list", { name: "Access grants" }),
    )
    .toBeVisible();
}

// Chooses the user of the directory in the user field, by typing a part of
// the name.
async function chooseUser(screen: Screen, term: string, option: string) {
  await userField(screen).fill(term);
  await screen.getByRole("option", { name: option }).click();
  await expect.element(userField(screen)).toHaveValue(option);
}

// Opens the confirmation of Revoke access of Carol White and confirms it.
async function revokeCarol(screen: Screen) {
  await revokeOf(screen, "Carol White @cwhite").click();
  await confirmationOf(screen, "Carol White")
    .getByRole("button", { name: "Revoke access", exact: true })
    .click();
}

// The requests of the spy with the method.
function requestsWith(spy: ReturnType<typeof stubApi>, method: string) {
  return spy.mock.calls.filter(([, init]) => init?.method === method);
}

describe("the participants", () => {
  test("show each participant once, the assignee first and then by display name, an inactive user named so, without bot accounts and the maintainers of an excluded package", async () => {
    stubTicket({
      ticket: () =>
        confidentialTicket({
          packages: [
            fictionalPackage(),
            {
              ...fictionalPackage({
                id: "00000000-0000-0000-0000-0000000000a2",
                package_name: "fictional-zlib",
                maintainers: [
                  {
                    id: "00000000-0000-0000-0000-00000000000a",
                    username: "ghill",
                    full_name: "Grace Hill",
                    active: true,
                    bot: false,
                  },
                ],
              }),
              deleted_at: "2099-10-10T12:00:00Z",
            },
          ],
        }),
      actors: () => actorsResponse(),
      grants: () =>
        grantsResponse([
          CAROL,
          fictionalGrant({ user: FICTIONAL_ACTORS[2]! }),
          fictionalGrant({ user: FICTIONAL_ACTORS[0]! }),
        ]),
    });

    const { screen } = await renderParticipants();

    expect(participantNames(screen)).toEqual([
      "Alice Smith",
      "Ana Garcia",
      "Carol White",
      "Dave Brown",
      "Robert Lee (inactive)",
    ]);
    await expect
      .element(participantsGroup(screen).getByRole("list"))
      .toBeVisible();
  });

  test("order users of the same display name by username", () => {
    const namesake = {
      id: "00000000-0000-0000-0000-00000000000b",
      username: "agarcia2",
      full_name: "Ana Garcia",
      active: true,
      bot: false,
    };

    const participants = participantsOf(
      fictionalTicketDetail({ assignee: null, packages: [] }),
      [namesake],
      [fictionalGrant({ user: FICTIONAL_ACTORS[0]! })],
    );

    expect(participants.map((user) => user.username)).toEqual([
      "agarcia",
      "agarcia2",
    ]);
  });

  test("show the assignee alone, without reading access grants, on a Ticket that is not confidential", async () => {
    const spy = stubTicket({ ticket: () => declassifiedTicket() });

    const { screen } = await renderParticipants();

    expect(participantNames(screen)).toEqual(["Alice Smith"]);
    expect(requestsTo(spy, ACCESS)).toBe(0);
    await expect.element(accessGrantsButton(screen)).not.toBeInTheDocument();
  });

  test("say that the Ticket has none without an assignee and actors", async () => {
    stubTicket({
      ticket: () =>
        ticketResponse(fictionalTicketDetail({ assignee: null, packages: [] })),
    });

    const { screen } = await renderParticipants();

    await expect
      .element(participantsPart(screen).getByText("No participants."))
      .toBeVisible();
  });

  test("are the last section of the side column, in the order of the page", async () => {
    stubTicket();

    const { screen } = await renderParticipants();

    const sources = sourcesPart(screen).element();
    const participants = participantsPart(screen).element();
    expect(
      sources.compareDocumentPosition(participants) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(participants.nextElementSibling).toBeNull();
  });

  test("show the loading indicator until both reads arrive, and Access grants at once", async () => {
    const grants = later();
    stubTicket({
      ticket: () => confidentialTicket(),
      grants: () => grants.promise,
    });
    const { screen } = await renderApp("/tickets/SNTL-12");

    await expect.element(accessGrantsButton(screen)).toBeVisible();
    await expect
      .element(
        participantsPart(screen).getByRole("progressbar", { name: "Loading" }),
      )
      .toBeVisible();
    await accessGrantsButton(screen).click();
    await expect
      .element(
        accessGrantsDialog(screen).getByRole("progressbar", {
          name: "Loading",
        }),
      )
      .toBeVisible();

    grants.resolve(grantsResponse());

    await expect.poll(() => grantLines(screen).length).toBe(1);
    expect(participantNames(screen)).toEqual(["Alice Smith", "Carol White"]);
  });

  test("show the failure of a read of the users who acted in their place, with Try again, and then the participants", async () => {
    let failing = true;
    stubTicket({
      ticket: () => declassifiedTicket(),
      actors: () =>
        failing ? errorResponse(503, "SERVICE_UNAVAILABLE") : actorsResponse(),
    });
    const { screen } = await renderApp("/tickets/SNTL-12");

    await expect
      .element(
        participantsPart(screen).getByText(
          "Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    failing = false;
    await participantsPart(screen)
      .getByRole("button", { name: "Try again" })
      .click();

    await expect
      .poll(() => participantNames(screen))
      .toEqual(["Alice Smith", "Ana Garcia", "Robert Lee (inactive)"]);
  });

  test("show the failure of the read of the access grants in their place and in their dialog, each with Try again", async () => {
    let failing = true;
    const spy = stubTicket({
      ticket: () => confidentialTicket(),
      grants: () =>
        failing ? errorResponse(503, "SERVICE_UNAVAILABLE") : grantsResponse(),
    });
    const { screen } = await renderApp("/tickets/SNTL-12");
    const message = "Sentinel isn't available right now. Try again later.";

    await expect
      .element(participantsPart(screen).getByText(message))
      .toBeVisible();
    await accessGrantsButton(screen).click();
    await expect
      .element(accessGrantsDialog(screen).getByText(message))
      .toBeVisible();
    const reads = requestsTo(spy, ACCESS);
    failing = false;
    await press(
      accessGrantsDialog(screen).getByRole("button", { name: "Try again" }),
    );

    await expect.poll(() => grantLines(screen).length).toBe(1);
    expect(requestsTo(spy, ACCESS)).toBe(reads + 1);
    // Try again leaves with the error, and the focus stays in the dialog.
    await expect.element(accessGrantsDialog(screen)).toHaveFocus();
  });

  test("show a conflict of the read of the access grants with another code as a failure", async () => {
    const spy = stubTicket({
      ticket: () => confidentialTicket(),
      grants: () => errorResponse(409, "FICTIONAL_CODE"),
    });
    const { screen } = await renderApp("/tickets/SNTL-12");

    await expect
      .element(
        participantsPart(screen).getByText(
          "This can't be done in the current state, which may have changed. Check it and try again.",
        ),
      )
      .toBeVisible();
    expect(requestsTo(spy, TICKET)).toBe(1);
    await expect.element(accessGrantsButton(screen)).toBeVisible();
  });

  test("show the participants without access grants, and read the Ticket again, when Sentinel says that it is no longer confidential", async () => {
    let confidential = true;
    const spy = stubTicket({
      ticket: () =>
        confidential ? confidentialTicket() : declassifiedTicket(),
      grants: () => {
        confidential = false;
        return errorResponse(409, "TICKET_NOT_CONFIDENTIAL");
      },
    });

    const { screen } = await renderParticipants();

    expect(participantNames(screen)).toEqual(["Alice Smith"]);
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(2);
    await expect.element(accessGrantsButton(screen)).not.toBeInTheDocument();
  });

  test("move the focus to the screen's heading when a read removes Access grants while it has it", async () => {
    let confidential = true;
    stubTicket({
      ticket: () =>
        confidential ? confidentialTicket() : declassifiedTicket(),
      grants: () => grantsResponse(),
    });
    const { screen } = await renderParticipants();
    accessGrantsButton(screen).element().focus();
    confidential = false;

    returnToForeground();

    await expect.element(accessGrantsButton(screen)).not.toBeInTheDocument();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toHaveFocus();
  });
});

describe("the access grants", () => {
  test("show every user who can see a confidential Ticket its grants, with who granted them and when, a bot account with its label, without Revoke access and the user field", async () => {
    const bot = fictionalGrant({
      user: FICTIONAL_ACTORS[2]!,
      granted_at: "2099-10-12T08:00:00Z",
    });
    stubTicket({
      user: FICTIONAL_USER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse([CAROL, EMMA, bot]),
    });
    const { screen } = await renderParticipants();

    await openAccessGrants(screen);

    const dialog = accessGrantsDialog(screen);
    await expect.element(dialog).toHaveFocus();
    await expect
      .element(
        dialog.getByText(
          "An access grant lets a user see this confidential Ticket. The users who see every Ticket, and the maintainers of its packages that are not excluded, see it without one.",
        ),
      )
      .toBeVisible();
    expect(grantLines(screen)).toEqual([
      `Carol White @cwhiteGranted by Alice Smith on ${formatDateTime(CAROL.granted_at)}`,
      `Emma Green @egreenGranted by Alice Smith on ${formatDateTime(EMMA.granted_at)}`,
      `Fictional Bot @fictional-botBotGranted by Alice Smith on ${formatDateTime(bot.granted_at)}`,
    ]);
    await expect
      .element(dialog.getByRole("button", { name: /^Revoke access/ }))
      .not.toBeInTheDocument();
    await expect.element(dialog.getByRole("combobox")).not.toBeInTheDocument();
  });

  test("close with Close, which returns the focus to the button that opened them", async () => {
    stubTicket({
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .click();

    await expect.element(accessGrantsDialog(screen)).not.toBeInTheDocument();
    await expect.element(accessGrantsButton(screen)).toHaveFocus();
  });

  test("return the focus to Access grants on Escape, also from a grant", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    revokeOf(screen, "Carol White @cwhite").element().focus();

    await userEvent.keyboard("{Escape}");

    await expect.element(accessGrantsDialog(screen)).not.toBeInTheDocument();
    await expect.element(accessGrantsButton(screen)).toHaveFocus();
    // Not for a moment the heading, as the dialog left.
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
    await expect.element(accessGrantsButton(screen)).toHaveFocus();
  });

  test("say that the Ticket has none", async () => {
    stubTicket({ user: FICTIONAL_USER, ticket: () => confidentialTicket() });
    const { screen } = await renderParticipants();

    await openAccessGrants(screen, true);
  });

  test("give the user field the focus for a user who manages confidentiality, and list a grantee as granted, disabled", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () =>
        usersPage([
          fictionalDirectoryUser(),
          fictionalDirectoryUser({
            id: CAROL.user.id,
            username: "cwhite",
            full_name: "Carol White",
          }),
        ]),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    await expect.element(userField(screen)).toHaveFocus();
    await expect.element(userField(screen)).toHaveAttribute("maxlength", "500");

    await userField(screen).fill("an");

    await expect
      .element(screen.getByRole("option", { name: "Ana Garcia @agarcia" }))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("option", { name: "Carol White @cwhite Granted" }),
      )
      .toHaveAttribute("aria-disabled", "true");
  });

  test("grant access to the chosen user, then empty the field, keep the focus on Grant access, announce it, and read again what it affects", async () => {
    let grants = [CAROL];
    const bodies: unknown[] = [];
    const spy = stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(grants),
      users: () => usersPage([fictionalDirectoryUser()]),
      grant: (body) => {
        bodies.push(body);
        const grant = fictionalGrant({ user: FICTIONAL_ACTORS[0]! });
        grants = [CAROL, grant];
        return grantResponse(grant);
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      grants: requestsTo(spy, ACCESS),
      actors: requestsTo(spy, ACTORS),
    };

    await chooseUser(screen, "ana", "Ana Garcia @agarcia");
    await grantButton(screen).click();

    await expect
      .poll(() => dialogStatus(screen))
      .toBe("Access granted to Ana Garcia.");
    expect(bodies).toEqual([{ user: fictionalDirectoryUser().id }]);
    await expect.element(revokeOf(screen, "Ana Garcia @agarcia")).toBeVisible();
    await expect.element(userField(screen)).toHaveValue("");
    await expect.element(grantButton(screen)).toHaveFocus();
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
    expect(requestsTo(spy, ACCESS)).toBeGreaterThan(reads.grants);
    await expect.poll(() => participantNames(screen)).toContain("Ana Garcia");
  });

  test("keep the focus in the field after a grant submitted with Enter, which sends one request while it is in progress", async () => {
    const response = later();
    const spy = stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () => usersPage([fictionalDirectoryUser()]),
      grant: () => response.promise,
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");

    await userEvent.keyboard("{Enter}");
    await expect
      .element(grantButton(screen))
      .toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Enter}");
    // While the grant is in progress, the dialog cannot be closed.
    await userEvent.keyboard("{Escape}");
    await expect
      .element(
        accessGrantsDialog(screen).getByRole("button", { name: "Close" }),
      )
      .toBeDisabled();
    expect(requestsWith(spy, "POST")).toHaveLength(1);
    response.resolve(
      grantResponse(fictionalGrant({ user: FICTIONAL_ACTORS[0]! })),
    );

    await expect.element(userField(screen)).toHaveValue("");
    await expect.element(userField(screen)).toHaveFocus();
    await expect.element(accessGrantsDialog(screen)).toBeVisible();
  });

  test("ask for a user before granting access", async () => {
    const spy = stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await grantButton(screen).click();

    await expect
      .element(accessGrantsDialog(screen).getByText("Choose a user."))
      .toBeVisible();
    await expect.element(userField(screen)).toHaveFocus();
    await expect
      .element(userField(screen))
      .toHaveAttribute("aria-invalid", "true");
    expect(requestsWith(spy, "POST")).toHaveLength(0);
    // The error goes as the user types.
    await userField(screen).fill("an");
    await expect
      .element(userField(screen))
      .not.toHaveAttribute("aria-invalid", "true");
  });

  test.each([
    [
      "an inactive user",
      () => errorResponse(409, "USER_INACTIVE"),
      "This user is inactive, so they can't be granted access.",
    ],
    [
      "an unknown user",
      () => errorResponse(404, "USER_NOT_FOUND"),
      "Sentinel doesn't know this user.",
    ],
    [
      "a field error of a VALIDATION_ERROR",
      () => validationError([["body", "user"]]),
      "This value isn't valid.",
    ],
  ])(
    "show the error of %s at the user field, which takes the focus",
    async (_case, response, message) => {
      stubTicket({
        user: MANAGER,
        ticket: () => confidentialTicket(),
        grants: () => grantsResponse(),
        users: () => usersPage([fictionalDirectoryUser()]),
        grant: response,
      });
      const { screen } = await renderParticipants();
      await openAccessGrants(screen);
      await chooseUser(screen, "ana", "Ana Garcia @agarcia");

      await grantButton(screen).click();

      await expect
        .element(accessGrantsDialog(screen).getByText(message))
        .toBeVisible();
      await expect.element(userField(screen)).toHaveFocus();
      await expect
        .element(userField(screen))
        .toHaveAttribute("aria-invalid", "true");
    },
  );

  test.each([
    [
      "a change that Sentinel did not confirm, as a warning",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      MESSAGE_TONES.warning,
    ],
    [
      "a VALIDATION_ERROR of no field, as an error",
      () => validationError([["body"]]),
      "Sentinel didn't accept this request.",
      MESSAGE_TONES.danger,
    ],
    [
      "a status and a code that the pinned contract does not list, as an error",
      () => errorResponse(418, "FICTIONAL_CODE"),
      "Sentinel didn't accept this request.",
      MESSAGE_TONES.danger,
    ],
  ])(
    "show %s at the top of the form, which takes the focus and keeps the user",
    async (_case, response, message, tone) => {
      const spy = stubTicket({
        user: MANAGER,
        ticket: () => confidentialTicket(),
        grants: () => grantsResponse(),
        users: () => usersPage([fictionalDirectoryUser()]),
        grant: response,
      });
      const { screen } = await renderParticipants();
      await openAccessGrants(screen);
      await chooseUser(screen, "ana", "Ana Garcia @agarcia");
      const reads = requestsTo(spy, TICKET);

      await grantButton(screen).click();

      const error = accessGrantsDialog(screen).getByText(message);
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(tone);
      expect(
        error.element().closest("[tabindex]")?.contains(document.activeElement),
      ).toBe(true);
      await expect
        .element(userField(screen))
        .toHaveValue("Ana Garcia @agarcia");
      // Whatever its outcome, the screen reads again what it affects.
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
    },
  );

  test("keep the dialog open when the Ticket is no longer confidential, say so, take the focus, and move it to the screen's heading once closed", async () => {
    let confidential = true;
    stubTicket({
      user: MANAGER,
      ticket: () =>
        confidential ? confidentialTicket() : declassifiedTicket(),
      grants: () =>
        confidential
          ? grantsResponse()
          : errorResponse(409, "TICKET_NOT_CONFIDENTIAL"),
      users: () => usersPage([fictionalDirectoryUser()]),
      grant: () => {
        confidential = false;
        return errorResponse(409, "TICKET_NOT_CONFIDENTIAL");
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");

    await grantButton(screen).click();

    const dialog = accessGrantsDialog(screen);
    await expect
      .element(
        dialog.getByText(
          "This Ticket is no longer confidential, so it has no access grants.",
        ),
      )
      .toBeVisible();
    await expect.element(dialog).toHaveFocus();
    expect(dialogStatus(screen)).toContain(
      "This Ticket is no longer confidential, so it has no access grants.",
    );
    await expect.element(dialog.getByRole("combobox")).not.toBeInTheDocument();
    await expect.element(accessGrantsButton(screen)).not.toBeInTheDocument();

    // Without a grant to make, Close asks nothing.
    await dialog.getByRole("button", { name: "Close" }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toHaveFocus();
  });

  test("ask before Close discards the user chosen, keep it on Keep editing, and close on Discard", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () => usersPage([fictionalDirectoryUser()]),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");

    await accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .click();
    const discard = screen.getByRole("dialog", { name: "Discard changes?" });
    await expect
      .element(discard.getByRole("button", { name: "Keep editing" }))
      .toHaveFocus();
    await expect
      .element(
        discard.getByText("The user that you chose isn't granted access."),
      )
      .toBeVisible();
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect.element(discard).not.toBeInTheDocument();
    await expect.element(userField(screen)).toHaveValue("Ana Garcia @agarcia");

    // Escape asks too.
    userField(screen).element().focus();
    await userEvent.keyboard("{Escape}");
    await expect.element(discard).toBeVisible();
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect.element(accessGrantsDialog(screen)).not.toBeInTheDocument();
    await expect.element(accessGrantsButton(screen)).toHaveFocus();
    // The dialog opens again without the user, and closes without a
    // question.
    await openAccessGrants(screen);
    await expect.element(userField(screen)).toHaveValue("");
    await accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .click();
    await expect.element(accessGrantsDialog(screen)).not.toBeInTheDocument();
  });

  test("close without a question with a term typed and no user chosen", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () => usersPage([fictionalDirectoryUser()]),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    // Found before the menu of the field opens, which hides the rest of the
    // page from assistive technologies.
    const close = accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .element();
    await userField(screen).fill("ana");
    const option = screen.getByRole("option", { name: "Ana Garcia @agarcia" });
    await expect.element(option).toBeVisible();

    close.focus();
    await userEvent.keyboard("{Enter}");

    // The dialog leaves the page, rather than hiding behind a question.
    await expect.poll(() => close.isConnected).toBe(false);
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }).query(),
    ).toBeNull();
  });

  test("revoke a grant after confirmation, then move the focus to the next Revoke access, announce it, and read again what it affects", async () => {
    let grants = [CAROL, EMMA];
    const revoked: string[] = [];
    const spy = stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(grants),
      revoke: (path) => {
        revoked.push(path);
        grants = [EMMA];
        return new Response(null, { status: 204 });
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      actors: requestsTo(spy, ACTORS),
    };

    await revokeOf(screen, "Carol White @cwhite").click();
    const confirmation = confirmationOf(screen, "Carol White");
    await expect
      .element(confirmation.getByRole("button", { name: "Cancel" }))
      .toHaveFocus();
    await expect
      .element(
        confirmation.getByText(
          "Carol White loses the access grant to this confidential Ticket, and no longer sees it unless their roles or the packages that they maintain let them.",
        ),
      )
      .toBeVisible();
    await confirmation
      .getByRole("button", { name: "Revoke access", exact: true })
      .click();

    await expect.element(confirmation).not.toBeInTheDocument();
    await expect.element(revokeOf(screen, "Emma Green @egreen")).toHaveFocus();
    expect(revoked).toEqual([`${ACCESS}/${CAROL.user.id}`]);
    expect(dialogStatus(screen)).toBe("Access of Carol White revoked.");
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
  });

  test("move the focus to the user field after Revoke access of the last grant", async () => {
    let grants = [EMMA, CAROL];
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(grants),
      revoke: () => {
        grants = [EMMA];
        return new Response(null, { status: 204 });
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    // The element with the focus as the grant leaves the list, which the
    // focus does not leave for the page meanwhile.
    const list = accessGrantsDialog(screen)
      .getByRole("list", { name: "Access grants" })
      .element();
    let focusedAsRemoved: Element | null = null;
    const observer = new MutationObserver(() => {
      if (focusedAsRemoved === null && list.childElementCount === 1) {
        focusedAsRemoved = document.activeElement;
      }
    });
    observer.observe(list, { childList: true });

    try {
      await revokeCarol(screen);

      await expect
        .element(revokeOf(screen, "Carol White @cwhite"))
        .not.toBeInTheDocument();
    } finally {
      observer.disconnect();
    }
    await expect.element(userField(screen)).toHaveFocus();
    expect(focusedAsRemoved).toBe(userField(screen).element());
  });

  test("move the focus to the next Revoke access when a read removes the grant whose Revoke access has it", async () => {
    let grants = [CAROL, EMMA];
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(grants),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    revokeOf(screen, "Carol White @cwhite").element().focus();
    // Meanwhile another analyst revoked it.
    grants = [EMMA];

    returnToForeground();

    await expect
      .element(revokeOf(screen, "Carol White @cwhite"))
      .not.toBeInTheDocument();
    await expect.element(revokeOf(screen, "Emma Green @egreen")).toHaveFocus();
  });

  test("keep the grant after Cancel", async () => {
    const spy = stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await revokeOf(screen, "Carol White @cwhite").click();
    await confirmationOf(screen, "Carol White")
      .getByRole("button", { name: "Cancel" })
      .click();

    await expect.element(revokeOf(screen, "Carol White @cwhite")).toHaveFocus();
    expect(requestsWith(spy, "DELETE")).toHaveLength(0);
  });

  test("keep the confirmation open while Revoke access is in progress", async () => {
    const response = later();
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      revoke: () => response.promise,
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await revokeCarol(screen);
    const confirmation = confirmationOf(screen, "Carol White");
    await expect
      .element(
        confirmation.getByRole("button", {
          name: "Revoke access",
          exact: true,
        }),
      )
      .toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");

    await expect.element(confirmation).toBeVisible();
    response.resolve(new Response(null, { status: 204 }));
    await expect.element(confirmation).not.toBeInTheDocument();
  });

  test("show the failure of Revoke access at the top of the confirmation, which stays open, also once the user no longer manages confidentiality", async () => {
    let refused = false;
    const spy = stubTicket({
      user: () => (refused ? OTHER_USER : MANAGER),
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      revoke: () => {
        refused = true;
        return errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION");
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);
    const userReads = requestsTo(spy, ME);

    await revokeCarol(screen);

    const confirmation = confirmationOf(screen, "Carol White");
    const error = confirmation.getByText(
      "You don't have permission to do this.",
    );
    await expect.element(error).toBeVisible();
    // The read of the signed-in user after the 403 removes the capability,
    // which the dialog keeps while it is open.
    await expect.poll(() => requestsTo(spy, ME)).toBe(userReads + 1);
    await expect.poll(() => client.isFetching()).toBe(0);
    await expect.element(confirmation).toBeVisible();
    await expect.element(error).toBeVisible();

    // Once the dialog opens again, it offers no change.
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .click();
    await openAccessGrants(screen);
    await expect
      .element(accessGrantsDialog(screen).getByRole("combobox"))
      .not.toBeInTheDocument();
    expect(
      accessGrantsDialog(screen)
        .getByRole("button", { name: /^Revoke access/ })
        .query(),
    ).toBeNull();
  });

  test("say that the Ticket is no longer confidential in place of the confirmation of Revoke access, and take the focus", async () => {
    let confidential = true;
    stubTicket({
      user: MANAGER,
      ticket: () =>
        confidential ? confidentialTicket() : declassifiedTicket(),
      grants: () =>
        confidential
          ? grantsResponse()
          : errorResponse(409, "TICKET_NOT_CONFIDENTIAL"),
      revoke: () => {
        confidential = false;
        return errorResponse(409, "TICKET_NOT_CONFIDENTIAL");
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await revokeCarol(screen);

    const dialog = accessGrantsDialog(screen);
    await expect
      .element(
        dialog.getByText(
          "This Ticket is no longer confidential, so it has no access grants.",
        ),
      )
      .toBeVisible();
    await expect
      .element(confirmationOf(screen, "Carol White"))
      .not.toBeInTheDocument();
    await expect.element(dialog).toHaveFocus();
    // Not for a moment the heading, behind the dialog.
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
    await expect.element(dialog).toHaveFocus();
  });

  test("announce Revoke access once a read of the grants after it arrives, also one that fails", async () => {
    const reread = later();
    let revoked = false;
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => (revoked ? reread.promise : grantsResponse([CAROL, EMMA])),
      revoke: () => {
        revoked = true;
        return new Response(null, { status: 204 });
      },
    });
    const { screen } = await renderParticipants();
    await openAccessGrants(screen);

    await revokeCarol(screen);

    await expect
      .element(confirmationOf(screen, "Carol White"))
      .not.toBeInTheDocument();
    expect(dialogStatus(screen)).toBe("");
    reread.resolve(errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION"));

    await expect
      .poll(() => dialogStatus(screen))
      .toContain("Access of Carol White revoked.");
  });
});

test("show Revoke access below its user where the dialog is narrow, at 320 CSS pixels", async () => {
  await page.viewport(320, 800);
  stubTicket({
    user: MANAGER,
    ticket: () => confidentialTicket(),
    grants: () => grantsResponse(),
  });
  const { screen } = await renderParticipants();
  await openAccessGrants(screen);

  const name = accessGrantsDialog(screen)
    .getByText("Carol White", { exact: false })
    .first();
  const revoke = boxOf(revokeOf(screen, "Carol White @cwhite"));
  expect(revoke.top).toBeGreaterThanOrEqual(boxOf(name).bottom);
  expect(name.element().scrollWidth).toBeLessThanOrEqual(
    name.element().clientWidth,
  );
});
