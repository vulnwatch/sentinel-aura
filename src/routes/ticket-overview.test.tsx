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
import {
  cvssResponse,
  errorResponse,
  FICTIONAL_USER,
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
  document.title = "Sentinel";
  window.scrollTo(0, 0);
  await page.viewport(414, 896);
});

interface Stub {
  // The signed-in user.
  user: CurrentUserResponse;
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
}

// Answers the read of the signed-in user, an analyst who maintains no
// package unless the test says otherwise, Get Ticket, the read of the
// duplicates, the read of the work of the user, the read of the CVSS
// assessments, the read of the sources of the CVE, and its refetch, and
// returns the spy, whose calls name the requests.
function stubTicket(fields: Partial<Stub> = {}) {
  const stub: Stub = {
    user: OTHER_USER,
    ticket: () => ticketResponse(fictionalTicketDetail()),
    yourWork: () => ticketWorkResponse(),
    cvss: () => cvssResponse(),
    sources: () => sourcesResponse(),
    refetch: () => refetchResponse({ sources_enqueued: ["nvd"] }),
    ...fields,
  };
  return stubApi((request) => {
    if (request.path === ME) {
      return jsonResponse(200, stub.user);
    }
    if (request.path === TICKETS) {
      return ticketPage([]);
    }
    if (request.path === YOUR_WORK) {
      return stub.yourWork();
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
    // The affectedness at the end of the line.
    expect(boxOf(ibs.getByText("Affected", { exact: true })).right).toBeCloseTo(
      boxOf(packagesPart(screen)).right,
      0,
    );
    const reference = getComputedStyle(
      screen.getByText("SUSE:FLES-15-SP7:Update", { exact: true }).element(),
    );
    expect(reference.fontWeight).toBe("500");
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
    "shows its delivery and its pipeline on its second line while it has work, in %s",
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
      const delivery = track.getByText("Delivery", { exact: true });
      await expect.element(delivery).toBeVisible();
      expect(colorOf(delivery.element())).toBe(FG_MUTED);
      await expect
        .element(track.getByText("Pending", { exact: true }))
        .toBeVisible();
      const pipeline = track.getByRole("button", {
        name: /^Phases of fictional-openssl, SUSE:FLES-15-SP7:Update: /,
      });
      await expect.element(pipeline).toBeVisible();
      // On the line below the reference.
      expect(boxOf(delivery).top).toBeGreaterThan(
        boxOf(track.getByText("SUSE:FLES-15-SP7:Update")).bottom,
      );
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
      // The track has work and due dates, so its pipeline shows.
      await expect
        .element(track.getByRole("button", { name: /^Phases of/ }))
        .toBeVisible();
      if (status === undefined) {
        expect(track.getByText("Delivery").elements()).toHaveLength(0);
      } else {
        await expect
          .element(track.getByText("Delivery", { exact: true }))
          .toBeVisible();
        await expect
          .element(track.getByText(status, { exact: true }))
          .toBeVisible();
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
      .element(submitted.getByText("Delivery", { exact: true }))
      .toBeVisible();
    await expect
      .element(
        productOf(screen, "Fictional Linux Enterprise Server 15 SP7").getByText(
          "Release not observed",
          { exact: true },
        ),
      )
      .toBeVisible();
    const tested = trackOf(screen, "SUSE:FLES-15-SP6:Update");
    expect(tested.getByText("Delivery").elements()).toHaveLength(0);
    await expect
      .element(
        productOf(screen, "Fictional Linux Enterprise Server 15 SP6").getByText(
          "Not released",
          { exact: true },
        ),
      )
      .toBeVisible();
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
    await expect
      .element(track.getByText("In progress", { exact: true }))
      .toBeVisible();
    expect(
      track.getByRole("button", { name: /^Phases of/ }).elements(),
    ).toHaveLength(0);
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
    await expect
      .element(
        delivered.getByText(
          `Released ${formatDateTime("2099-10-20T09:00:00Z")}`,
        ),
      )
      .toBeVisible();
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
      expect(track.getByText("Not released").elements()).toHaveLength(0);
      await expect
        .element(
          productOf(screen, "Fictional Linux Enterprise Server 16.0").getByText(
            /^Released /,
          ),
        )
        .toBeVisible();
    },
  );
});

describe("a Product", () => {
  test("shows its name as a button that opens its details, and its release at the end of its line", async () => {
    showing([fictionalPackage()]);

    const { screen } = await renderTree();

    const product = productOf(
      screen,
      "Fictional Linux Enterprise Server 15 SP7",
    );
    const release = product.getByText("Not released", { exact: true });
    await expect.element(release).toBeVisible();
    expect(colorOf(release.element())).toBe(FG_MUTED);
    expect(getComputedStyle(release.element()).fontSize).toBe("13px");
    const name = screen.getByRole("button", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });
    expect(colorOf(name.element())).toBe(FG);
    expect(boxOf(name).height).toBeGreaterThanOrEqual(24);
    expect(boxOf(release).right).toBeCloseTo(boxOf(product).right, 0);
  });

  test.each<
    [string, Partial<TrackDetail>, Partial<TicketDetail>, string, string]
  >([
    [
      "a track whose QA Sentinel observes",
      {},
      {},
      "Not released",
      "Not released",
    ],
    [
      "a Git track, whose QA Sentinel does not observe",
      { workflow_type: "git", reference: "fles-16.0", ...UNOBSERVED },
      {},
      "Release not observed",
      "Not observed",
    ],
    [
      "a track of a Ticket without a CVE, whose QA Sentinel does not observe",
      UNOBSERVED,
      { cve: null },
      "Release not observed",
      "Not observed",
    ],
    [
      "a Git track, once Sentinel observes its QA",
      { workflow_type: "git", reference: "fles-16.0" },
      {},
      "Not released",
      "Not released",
    ],
  ])(
    "shows below %s that it is not released",
    async (_, track, ticket, line, details) => {
      showing([fictionalPackage({ tracks: [fictionalTrack(track)] })], ticket);
      const { screen } = await renderTree();
      await expect
        .element(
          productOf(
            screen,
            "Fictional Linux Enterprise Server 15 SP7",
          ).getByText(line, { exact: true }),
        )
        .toBeVisible();

      await screen
        .getByRole("button", {
          name: "Fictional Linux Enterprise Server 15 SP7",
        })
        .click();

      const popover = screen.getByRole("dialog", {
        name: "Fictional Linux Enterprise Server 15 SP7",
      });
      await expect.element(popover).toBeVisible();
      expect(
        popover
          .getByRole("definition")
          .elements()
          .map((element) => element.textContent)
          .at(-1),
      ).toBe(details);
    },
  );

  test("shows when it was released, also on a track that expects no fix", async () => {
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

    await expect
      .element(
        productOf(screen, "Fictional Linux Enterprise Server 15 SP7").getByText(
          `Released ${formatDateTime(releasedAt)}`,
        ),
      )
      .toBeVisible();
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
    showing(withHiddenRecords());
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

describe("the CVSS assessments", () => {
  test("follow the package tree, under a level-two heading", async () => {
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
      boxOf(packagesPart(screen)).bottom,
    );
  });

  test("say in one line that the SUSE assessment of the default version sets the severity and the eligibility score", async () => {
    stubTicket();
    const { screen } = await renderCvss("SUSE");

    expect(linesOf(screen)).toEqual([
      [
        "Severity",
        "Medium 5.5 from SUSE CVSS v3.1, which also sets the eligibility score of the Products",
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
      ["Severity", "Critical 9.3 from NVD CVSS v4.0"],
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
      ["Severity", "Medium 5.5 from SUSE CVSS v3.1"],
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
      ["Severity", "High 8.1 from NVD CVSS 5.0"],
      ["Eligibility score", "7.0, fictional_source"],
    ]);
  });

  test("list the assessments in the order of the API, by provider and version, with the severity of each by its version and its vector", async () => {
    // An order that neither the version nor the provider gives.
    showingCvss(
      fictionalCvssAssessments({
        assessments: [fictionalSuseAssessment(), CNA_V20, NVD_V40],
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
    ).toEqual(["Provider", "Version", "Assessment severity", "Vector"]);
    expect(rowsOf(screen)).toEqual([
      [
        "SUSE",
        "v3.1",
        "Medium 5.5",
        "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
      ],
      ["Fictional CNA", "v2.0", "High 7.5", "AV:N/AC:L/Au:N/C:P/I:P/A:P"],
      [
        "NVD",
        "v4.0",
        "Critical 9.3",
        "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
      ],
    ]);
    // The scores align in their column, in tabular figures
    // (docs/design-system.md, Type Scale).
    expect(
      getComputedStyle(
        cvssPart(screen).getByText("7.5", { exact: true }).element(),
      ).fontVariantNumeric,
    ).toBe("tabular-nums");
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
        "fictional_severity 5.5",
        "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
      ],
    ]);
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

  test("follow the CVSS assessments in one column, last in the order of the page, after a border line 32 px below them", async () => {
    await page.viewport(900, 800);
    stubTicket();
    const { screen } = await renderSources();
    const cvss = cvssPart(screen);
    await expect
      .element(cvss.getByRole("grid", { name: "CVSS assessments" }))
      .toBeVisible();
    const part = sourcesPart(screen);

    expect(
      cvss.element().compareDocumentPosition(part.element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(boxOf(part).width).toBe(boxOf(cvss).width);
    // 32 px below the content of the CVSS assessments, a border line, and the
    // section 16 px below it.
    expect(boxOf(part).top - boxOf(cvss).bottom).toBeCloseTo(32 + 1 + 16, 1);
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
        () => boxOf(sourcesPart(screen)).top > boxOf(cvssPart(screen)).bottom,
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

    expect(sourceLines(screen)).toEqual([
      "EPSS Not attempted Disabled",
      "GHSA Pending",
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
    // The color at the center of the mark of a status, whose dot of 8 px ends
    // 6 px before its name, and whose icon of 12 px ends there too.
    const markAt = async (name: string, status: string, size: number) => {
      const item = sourceOf(screen, name);
      const picture = await screenshot(item);
      const text = boxOf(item.getByText(status, { exact: true }));
      const box = boxOf(item);
      return picture.at(
        text.left - box.left - 6 - size / 2,
        (text.top + text.bottom) / 2 - box.top,
      );
    };

    expect(await markAt("NVD", "Success", 8)).toBe("#1a7f37");
    expect(await markAt("MITRE", "Failure", 8)).toBe("#cf222e");
    expect(await markAt("Linux Kernel CNA", "Missing", 8)).toBe("#6e7781");
    // The dashed circle of Not attempted is hollow, unlike a dot.
    expect(await markAt("EPSS", "Not attempted", 12)).toBe("#f6f8fa");
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

  test("remove the sources and Refetch all when a new read of them is refused with a 404", async () => {
    let refused = false;
    stubTicket({
      sources: () =>
        refused ? errorResponse(404, "CVE_NOT_FOUND") : sourcesResponse(),
    });
    const { screen } = await renderSources();
    await expect.element(refetchAll(screen)).toBeVisible();
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
  });

  test("offer Refetch of each source that can be refetched, named after it, and Refetch all, to a user with triage_ticket", async () => {
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
    ).toEqual(["Refetch all", "Refetch MITRE", "Refetch NVD"]);
    // A target of 24 px at the end of the first line of its source, and
    // Refetch all a small secondary button at the end of the heading.
    const refetch = boxOf(refetchOf(screen, "NVD"));
    expect([refetch.width, refetch.height]).toEqual([24, 24]);
    expect(refetch.right).toBeCloseTo(boxOf(sourcesPart(screen)).right, 1);
    const all = boxOf(refetchAll(screen));
    expect(all.height).toBe(32);
    expect(all.right).toBeCloseTo(boxOf(sourcesPart(screen)).right, 1);
    expect(all.bottom).toBeLessThanOrEqual(boxOf(sourceOf(screen, "EPSS")).top);
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
    const sourcesRead = requestsTo(spy, SOURCES);

    response.resolve(refetchResponse({ sources_enqueued: ["nvd"] }));

    const message = screen.getByText("Refetch of NVD started.");
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.info);
    await expect.element(refetch).not.toHaveAttribute("aria-disabled");
    await expect.element(refetch).toHaveFocus();
    await expect
      .poll(() => requestsTo(spy, SOURCES))
      .toBeGreaterThan(sourcesRead);
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

  test("end the session after a 401 of a refetch, without a message", async () => {
    stubTicket({ refetch: () => errorResponse(401, "AUTH_NOT_AUTHENTICATED") });
    const { screen } = await renderSources();

    await press(refetchOf(screen, "NVD"));

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    expect(screen.getByText(/Refetch/).query()).toBeNull();
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
    await expect.poll(() => requestsTo(spy, CVSS)).toBe(cvssRead + 1);
    // The sources themselves are not read again, nor at intervals.
    vi.advanceTimersByTime(30_000);
    expect(requestsTo(spy, SOURCES)).toBe(2);
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
