import {
  focusManager,
  MutationObserver as ChangeObserver,
  type QueryClient,
} from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import {
  CircleQuestionMark,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  type LucideIcon,
} from "lucide-react";
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
  CVSSAssessmentItem,
  CVSSAssessmentResponse,
  CVSSAssessmentSeverity,
  CVSSBaseScore,
  CVSSBaseScoreResponse,
  CurrentUserResponse,
  IBSRequestStateValue,
  PackageDetail,
  PackageExclusionResponse,
  ProductDetail,
  SubmissionRequestItem,
  TicketDetail,
  TicketStatusValue,
  TrackDetail,
  TrackExclusionResponse,
  TrackStatusTrack,
} from "../api/generated/model";
import { formatDateTime } from "../components/date-time";
import { LOADING_DELAY_MS } from "../components/loading";
import { getRevokeTicketAccessMutationKey } from "../api/generated/tickets";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import { participantsOf, SCORE_DELAY_MS } from "./ticket-overview";
import { RETURN_URL_KEY, SESSION_RECORD_KEY } from "../session";
import {
  actorsResponse,
  cvssResponse,
  errorResponse,
  eventPage,
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
  fictionalEvent,
  fictionalPackage,
  fictionalProduct,
  fictionalReleaseRequest,
  fictionalSource,
  fictionalSubmissionRequest,
  fictionalSuseAssessment,
  fictionalTicketDetail,
  fictionalTrack,
  jsonResponse,
  OTHER_USER,
  refetchResponse,
  releaseRequestsResponse,
  requestsTo,
  sourcesResponse,
  stubApi,
  submissionRequestsResponse,
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
const SUSE_ASSESSMENT = "/api/v1/cves/CVE-2099-0012/cvss/suse";
const SOURCES = "/api/v1/cves/CVE-2099-0012/sources";
const REFETCH = "/api/v1/cves/CVE-2099-0012/refetch";
const BASE_SCORE = "/api/v1/cvss/base-score";
const ACTORS = "/api/v1/tickets/SNTL-12/actors";
const EVENTS = "/api/v1/tickets/SNTL-12/audit-log";
const ACCESS = "/api/v1/tickets/SNTL-12/access";
const SUBMISSION_REQUESTS = "/api/v1/tickets/SNTL-12/submission-requests";
const RELEASE_REQUESTS = "/api/v1/tickets/SNTL-12/release-requests";
const USERS = "/api/v1/users";
const ASSIGNEE = "/api/v1/tickets/SNTL-12/assignee";
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
const INFO_ICON = "#0969da";
const SUCCESS_ICON = "#1a7f37";
const DANGER_ICON = "#cf222e";
const NEUTRAL_ICON = "#6e7781";

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
    avatar_url: null,
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

// Get Current User's response, whose assignment eligibility can be a value
// that the pinned contract does not list, which a later Sentinel release can
// return.
interface UserBody {
  data: Omit<CurrentUserResponse["data"], "assignment_eligibility"> & {
    assignment_eligibility: string;
  };
}

interface Stub {
  // The signed-in user, or the user at each read of it.
  user: UserBody | (() => UserBody);
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
  // The responses to the reads of the submission requests and of the
  // release requests of a track, given their query.
  submissionRequests: (query: URLSearchParams) => Response | Promise<Response>;
  releaseRequests: (query: URLSearchParams) => Response | Promise<Response>;
  // The response to a search of the directory, given its query.
  users: (query: URLSearchParams) => Response | Promise<Response>;
  // The response to Grant Access, given its body.
  grant: (body: unknown) => Response | Promise<Response>;
  // The response to Revoke Access, given its path.
  revoke: (path: string) => Response | Promise<Response>;
  // The response to Assign Ticket, given its body.
  assign: (body: unknown) => Response | Promise<Response>;
  // The response to Set or Update SUSE CVSS Assessment, given its body.
  upsertSuse: (body: unknown) => Response | Promise<Response>;
  // The response to Delete SUSE CVSS Assessment, given its path.
  deleteSuse: (path: string) => Response | Promise<Response>;
  // The response to Calculate CVSS Base Score, given its query.
  baseScore: (query: URLSearchParams) => Response | Promise<Response>;
  // The response to an edit of the package tree, given its method, its path
  // under the packages of the Ticket, and its body.
  packageChange: (
    method: string,
    path: string,
    body: unknown,
  ) => Response | Promise<Response>;
}

// Answers the read of the signed-in user, an analyst who maintains no
// package unless the test says otherwise, Get Ticket, the read of the
// duplicates, the read of the work of the user, the read of the CVSS
// assessments and the changes of the SUSE assessment, the read of the
// sources of the CVE, and its refetch, the reads of the participants, by
// default without any, the reads of the requests of a track, by default
// without any, the search of the directory, Grant and Revoke Access, Assign
// Ticket, and the reads of Audit log, and returns the spy, whose calls name
// the requests.
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
    submissionRequests: () => submissionRequestsResponse([]),
    releaseRequests: () => releaseRequestsResponse([]),
    users: () => usersPage([]),
    grant: () => grantResponse(fictionalGrant()),
    revoke: () => new Response(null, { status: 204 }),
    assign: () => ticketResponse(fictionalTicketDetail()),
    upsertSuse: () => suseResponse(fictionalSuseAssessment()),
    deleteSuse: () => new Response(null, { status: 204 }),
    baseScore: (query) => baseScoreResponse(query.get("vector_string") ?? ""),
    packageChange: packageChangeResponse,
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
    if (request.path === SUBMISSION_REQUESTS) {
      return stub.submissionRequests(request.query);
    }
    if (request.path === RELEASE_REQUESTS) {
      return stub.releaseRequests(request.query);
    }
    if (request.path === USERS) {
      return stub.users(request.query);
    }
    if (request.path === EVENTS) {
      return eventPage([fictionalEvent()]);
    }
    if (request.path === ASSIGNEE && request.method === "PATCH") {
      return stub.assign(request.body);
    }
    if (
      request.path.startsWith(`${TICKET}/packages/`) &&
      request.method !== "GET"
    ) {
      return stub.packageChange(
        request.method,
        request.path.slice(`${TICKET}/packages/`.length),
        request.body,
      );
    }
    if (request.path.startsWith(`${TICKETS}/`)) {
      return stub.ticket();
    }
    if (request.path === CVSS) {
      return stub.cvss();
    }
    if (request.path === SUSE_ASSESSMENT && request.method === "POST") {
      return stub.upsertSuse(request.body);
    }
    if (
      request.path.startsWith(`${SUSE_ASSESSMENT}/`) &&
      request.method === "DELETE"
    ) {
      return stub.deleteSuse(request.path);
    }
    if (request.path === BASE_SCORE) {
      return stub.baseScore(request.query);
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
  // The heading and its values are a line of their own, which the band holds
  // with its actions.
  const line = title.parentElement;
  if (!(line?.parentElement instanceof HTMLElement)) {
    throw new Error(`The package ${name} has no band`);
  }
  return line.parentElement;
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

// Shows a package tree with one Product with the fields, opens its details,
// and returns them.
async function openProductDetails(
  product: Partial<ProductDetail>,
): Promise<Locator> {
  showing([
    fictionalPackage({
      tracks: [fictionalTrack({ products: [fictionalProduct(product)] })],
    }),
  ]);
  const { screen } = await renderTree();
  await screen
    .getByRole("button", { name: "Fictional Linux Enterprise Server 15 SP7" })
    .click();
  const details = screen.getByRole("dialog", {
    name: "Fictional Linux Enterprise Server 15 SP7",
  });
  await expect.element(details).toHaveFocus();
  return details;
}

// The value of Eligibility in the details of a Product, their first field.
function eligibilityIn(details: Locator): Element {
  return details.getByRole("definition").first().element();
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

// The tab returns to the foreground after being hidden, once no read is in
// progress: a return during a read joins it rather than reading again
// (TanStack Query's Query.onFocus), so the reads that a test expects after
// the return do not depend on when the reads before it end. The poll moves
// no fake clock (sourcesSettled).
async function returnToForeground() {
  await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
  focusManager.setFocused(false);
  focusManager.setFocused(true);
}

// Waits until no read of the path is in progress and the screen shows its
// outcome, for a read whose outcome shows nothing of its own, such as the
// requests of a phase without any: TanStack Query tells the screen of the
// end of a read in a later task, which runs before this one ends.
async function readEnded(path: string) {
  await expect
    .poll(() => client.isFetching({ queryKey: [path] }), { interval: 0 })
    .toBe(0);
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// Waits until the browser has rendered two more frames, after which the
// effects of the commits before have run, and what they set has rendered,
// such as an announcement that an effect sets once the data of a read show.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
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

// The user who set the eligibility of a Product by hand, and when, its
// provenance (Sentinel docs/features/packages/package-model.md, Override
// Model).
const SETTER: NonNullable<ProductDetail["eligibility_override_by"]> = {
  id: "00000000-0000-0000-0000-000000000003",
  username: "asmith",
  full_name: "Alice Smith",
  active: true,
  bot: false,
  avatar_url: null,
};
const SET_AT = "2099-10-10T11:00:00Z";

// The eligibility of a Product that a user set by hand to not eligible, with
// its provenance, which Sentinel returns with every override.
const SET_BY_HAND: Partial<ProductDetail> = {
  eligible: false,
  is_eligible_override: true,
  eligibility_override_by: SETTER,
  eligibility_override_at: SET_AT,
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
            status: "fixed",
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
    // The line of the track wraps: its pipeline below the reference, and its
    // affectedness, in its place of 104 px, below the pipeline, each at the
    // end of its line; the text of the affectedness follows its dot of 8 px
    // 6 px later.
    const track = trackOf(
      screen,
      "SUSE:FLES-15-SP7:Update:Fictional:Very:Long:Reference",
    );
    const end = boxOf(track).right;
    const pipeline = boxOf(track.getByRole("button", { name: /^Phases of/ }));
    const reference = boxOf(
      track.getByText("SUSE:FLES-15-SP7:Update:Fictional:Very:Long:Reference"),
    );
    const affectedness = boxOf(track.getByText("Fixed", { exact: true }));
    expect(pipeline.top).toBeGreaterThanOrEqual(reference.bottom);
    expect(pipeline.right).toBeCloseTo(end, 0);
    expect(affectedness.top).toBeGreaterThanOrEqual(pipeline.bottom);
    expect(affectedness.left).toBeCloseTo(end - 104 + 8 + 6, 0);
    // The release of its Product, which keeps the Ticket from Resolved, at
    // the end of the line below its name.
    const product = track.getByRole("listitem");
    const release = boxOf(product.getByText("Not released", { exact: true }));
    expect(release.top).toBeGreaterThanOrEqual(
      boxOf(product.getByRole("button")).bottom,
    );
    expect(release.right).toBeCloseTo(boxOf(product).right, 0);
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
            avatar_url: null,
          },
          {
            id: "00000000-0000-0000-0000-000000000005",
            username: "ghill",
            full_name: "Grace Hill",
            active: false,
            bot: false,
            avatar_url: null,
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

  test("keeps its pipeline and its affectedness at the end of their line where its reference takes a line of its own", async () => {
    const long = `SUSE:FLES-15-SP7:Update:${"Fictional".repeat(12)}`;
    showing([
      fictionalPackage({ tracks: [fictionalTrack({ reference: long })] }),
    ]);

    const { screen } = await renderTree();

    const track = trackOf(screen, long);
    const pipeline = boxOf(track.getByRole("button", { name: /^Phases of/ }));
    expect(pipeline.top).toBeGreaterThanOrEqual(
      boxOf(track.getByText(long)).bottom,
    );
    const affectedness = boxOf(track.getByText("Affected", { exact: true }));
    expect(affectedness.top).toBeLessThan(pipeline.bottom);
    expect(affectedness.left).toBeCloseTo(boxOf(track).right - 104 + 8 + 6, 0);
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

    const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    // Neither on its line nor in the name of its pipeline, nor in Phases.
    const pipeline = track.getByRole("button", { name: /^Phases of/ });
    await expect.element(pipeline).toBeVisible();
    expect(track.getByText("Delivery").elements()).toHaveLength(0);
    expect(pipeline.element().getAttribute("aria-label")).not.toMatch(
      /delivery/,
    );

    await pipeline.click();

    const phases = screen.getByRole("dialog", { name: "Phases" });
    await expect.element(phases).toHaveFocus();
    expect(phases.getByText("Delivery").elements()).toHaveLength(0);
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

// The queries of the reads of the path that the screen sent, in their order.
function queriesTo(
  spy: ReturnType<typeof stubApi>,
  path: string,
): Record<string, string>[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname === path)
    .map((url) => Object.fromEntries(url.searchParams));
}

// The query of each read of the requests of the track of fictionalTrack:
// its package and its reference, the most recently created first, as many as
// "+N" names.
const TRACK_QUERY = {
  package_name: "fictional-openssl",
  codestream_name: "SUSE:FLES-15-SP7:Update",
  sort_by: "upstream_created_at",
  sort_order: "desc",
  per_page: "11",
};

// Opens Phases of a track, by its reference, which takes the focus.
async function openPhases(
  screen: Screen,
  reference = "SUSE:FLES-15-SP7:Update",
): Promise<Locator> {
  await trackOf(screen, reference)
    .getByRole("button", { name: /^Phases of/ })
    .click();
  const phases = screen.getByRole("dialog", { name: "Phases" });
  await expect.element(phases).toHaveFocus();
  return phases;
}

// The line of a phase in Phases, by the name of the phase.
function phaseIn(phases: Locator, name: string): Locator {
  return phases
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// The fields of a track without work whose delivery, In progress, shows on
// its line, in place of a pipeline.
const DELIVERED: Partial<TrackDetail> = {
  status: "not_affected",
  delivery_status: "in_progress",
  delivery_relevant: true,
  ...NOT_APPLICABLE,
};

const DELIVERY =
  "Delivery of fictional-openssl, SUSE:FLES-15-SP7:Update: In progress";

// A popover that shows the requests of a track, with the place of its
// latest submission request and that of its latest release request.
interface RequestPlaces {
  popover: Locator;
  submission: Locator;
  qa: Locator;
}

// Opens Phases of the track of fictionalTrack: the requests at the ends of
// the lines of Submission and QA.
async function inPhases(screen: Screen): Promise<RequestPlaces> {
  const phases = await openPhases(screen);
  return {
    popover: phases,
    submission: phaseIn(phases, "Submission"),
    qa: phaseIn(phases, "QA"),
  };
}

// Opens the delivery on the line of the track of fictionalTrack without a
// pipeline: the requests in Submission and QA of its popover.
async function inDelivery(screen: Screen): Promise<RequestPlaces> {
  await screen.getByRole("button", { name: DELIVERY, exact: true }).click();
  const popover = screen.getByRole("dialog", { name: "Delivery" });
  await expect.element(popover).toHaveFocus();
  return {
    popover,
    submission: popover.getByRole("definition").first(),
    qa: popover.getByRole("definition").last(),
  };
}

// The popovers that show the requests of a track, with the fields of a track
// that shows each.
const REQUEST_POPOVERS: [
  string,
  Partial<TrackDetail>,
  (screen: Screen) => Promise<RequestPlaces>,
][] = [
  ["Phases", {}, inPhases],
  ["the popover of a delivery", DELIVERED, inDelivery],
];

// What the place of the latest submission request and that of the latest
// release request say when the read of their requests fails.
const UNAVAILABLE = {
  submission: "The submission requests aren't available.",
  qa: "The release requests aren't available.",
};

// Fails unless an element shows its text whole within its box, unlike a text
// for assistive technologies alone, whose box of 1 px clips it.
function expectShownWhole(element: Element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const text = range.getBoundingClientRect();
  const box = boxOf(element);
  expect(text.width).toBeGreaterThan(0);
  expect(text.left).toBeGreaterThanOrEqual(box.left - 0.5);
  expect(text.right).toBeLessThanOrEqual(box.right + 0.5);
  expect(text.top).toBeGreaterThanOrEqual(box.top - 0.5);
  expect(text.bottom).toBeLessThanOrEqual(box.bottom + 0.5);
}

// The distance to the color of the pixel closest to it in the mark of the
// state of a request, which is hidden from assistive technologies: the 14 px
// that end 4 px before the link of the request, across the middle of its
// height, as a screenshot of the place of the request shows them.
async function markDistance(
  place: Locator,
  link: Locator,
  color: string,
): Promise<number> {
  const origin = boxOf(place);
  const box = boxOf(link);
  const picture = await screenshot(place);
  const left = box.left - origin.left - 4 - 14;
  const top = (box.top + box.bottom) / 2 - origin.top - 7;
  const pixels = Array.from({ length: 14 * 14 }, (_, index) =>
    picture.at(left + (index % 14), top + Math.floor(index / 14)),
  );
  return Math.min(...pixels.map((pixel) => distance(pixel, color)));
}

// The drawing of an icon, which tells one icon from another.
async function drawingOf(Icon: LucideIcon): Promise<string> {
  const reference = await render(<Icon />);
  const drawing = reference.container.querySelector("svg")!.innerHTML;
  await reference.unmount();
  return drawing;
}

// The drawing of the mark of the state of a request, which is hidden from
// assistive technologies: the icon in the middle of the 14 px that end 4 px
// before the link of the request.
function markDrawing(link: Locator): string | undefined {
  const box = boxOf(link);
  return document
    .elementFromPoint(box.left - 4 - 7, (box.top + box.bottom) / 2)
    ?.closest("svg")?.innerHTML;
}

// A state of a request that the pinned contract does not list, which a later
// Sentinel release could return.
const UNLISTED_STATE = "fictional_state";

// List Submission Requests's response with the request SR 900001 in a state,
// with the fields that a test sets: as the pinned contract types it for a
// state that the contract lists, and untyped for UNLISTED_STATE.
function submissionRequestIn(
  state: IBSRequestStateValue | typeof UNLISTED_STATE,
  fields: Partial<SubmissionRequestItem> = {},
): Response {
  if (state === UNLISTED_STATE) {
    return jsonResponse(200, {
      data: [{ ...fictionalSubmissionRequest(fields), state }],
      meta: { total: 1, page: 1, per_page: 11 },
    });
  }
  return submissionRequestsResponse([
    fictionalSubmissionRequest({ state, ...fields }),
  ]);
}

// The submission requests SR 900020 to SR 900010 of a track, the latest
// first, in review, and the others declined.
function manyRequests(): SubmissionRequestItem[] {
  return Array.from({ length: 11 }, (_, index) =>
    fictionalSubmissionRequest({
      request_number: 900020 - index,
      state: index === 0 ? "review" : "declined",
    }),
  );
}

describe("the IBS requests of a track", () => {
  test("are not read before Phases opens, and are then read once each, for the package and the reference of the track whose Phases opens, the latest first, as many as +N names", async () => {
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
        submissionRequests: () =>
          submissionRequestsResponse([fictionalSubmissionRequest()]),
        releaseRequests: () =>
          releaseRequestsResponse([fictionalReleaseRequest()]),
      },
    );
    const { screen } = await renderTree();
    await expect
      .element(
        trackOf(screen, "SUSE:FLES-15-SP6:Update").getByRole("button", {
          name: /^Phases of/,
        }),
      )
      .toBeVisible();
    expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([]);
    expect(queriesTo(spy, RELEASE_REQUESTS)).toEqual([]);

    const phases = await openPhases(screen, "SUSE:FLES-15-SP6:Update");

    await expect
      .element(phases.getByRole("link", { name: /^SR 900001\b/ }))
      .toBeVisible();
    await expect
      .element(phases.getByRole("link", { name: /^RR 900003\b/ }))
      .toBeVisible();
    const query = {
      ...TRACK_QUERY,
      codestream_name: "SUSE:FLES-15-SP6:Update",
    };
    expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([query]);
    expect(queriesTo(spy, RELEASE_REQUESTS)).toEqual([query]);
  });

  test("show the latest submission request at the end of the line of Submission and the latest release request at the end of the line of QA, as links to IBS 24 px high in text-13, lined up, and none under Triage and UM", async () => {
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse([fictionalSubmissionRequest()]),
        releaseRequests: () =>
          releaseRequestsResponse([fictionalReleaseRequest()]),
      },
    );
    const { screen } = await renderTree();

    const phases = await openPhases(screen);

    const submission = phaseIn(phases, "Submission");
    const sr = submission.getByRole("link", { name: /^SR 900001\b/ });
    await expect
      .element(sr)
      .toHaveAttribute("href", "https://build.suse.de/request/show/900001");
    const qa = phaseIn(phases, "QA");
    const rr = qa.getByRole("link", { name: /^RR 900003\b/ });
    await expect
      .element(rr)
      .toHaveAttribute("href", "https://build.suse.de/request/show/900003");
    expect(phases.getByRole("link").elements()).toHaveLength(2);
    for (const name of ["Triage", "UM"]) {
      expect(phaseIn(phases, name).getByRole("link").elements()).toHaveLength(
        0,
      );
    }
    for (const [link, name] of [
      [sr, "Submission"],
      [rr, "QA"],
    ] as const) {
      const box = boxOf(link);
      const nameBox = boxOf(phases.getByText(name, { exact: true }));
      // On the line of the name of the phase, after it.
      expect(box.top).toBeLessThan(nameBox.bottom);
      expect(box.bottom).toBeGreaterThan(nameBox.top);
      expect(box.left).toBeGreaterThan(nameBox.right + 12);
      expect(box.height).toBeGreaterThanOrEqual(24);
      expect(getComputedStyle(link.element()).fontSize).toBe("13px");
    }
    expect(boxOf(sr).left).toBeCloseTo(boxOf(rr).left, 0);
    // The release request is new: in progress.
    expect(await markDistance(qa, rr, INFO_ICON)).toBeLessThan(24);
  });

  test("show nothing at a phase without requests", async () => {
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse([fictionalSubmissionRequest()]),
      },
    );
    const { screen } = await renderTree();

    const phases = await openPhases(screen);

    await expect
      .element(phases.getByRole("link", { name: /^SR 900001\b/ }))
      .toBeVisible();
    // The release requests, of which none shows, arrive by a read of their
    // own.
    await readEnded(RELEASE_REQUESTS);
    const qa = phaseIn(phases, "QA");
    expect(qa.getByRole("link").elements()).toHaveLength(0);
    expect(qa.getByRole("button").elements()).toHaveLength(0);
    expect(qa.element().textContent).toMatch(/^QA · QA(?:Due|Overdue) /);
    expect(qa.element().textContent).not.toMatch(/RR|None|available/);
  });

  test.each<
    [
      IBSRequestStateValue | typeof UNLISTED_STATE,
      string,
      string,
      string,
      LucideIcon,
      Partial<SubmissionRequestItem>,
    ]
  >([
    ["new", "New", "in progress", INFO_ICON, GitPullRequest, {}],
    ["review", "Review", "in progress", INFO_ICON, GitPullRequest, {}],
    ["accepted", "Accepted", "accepted", SUCCESS_ICON, GitMerge, {}],
    ["declined", "Declined", "failed", DANGER_ICON, GitPullRequestClosed, {}],
    ["revoked", "Revoked", "failed", DANGER_ICON, GitPullRequestClosed, {}],
    [
      "superseded",
      "Superseded by 900014",
      "failed",
      DANGER_ICON,
      GitPullRequestClosed,
      { superseded_by_request_number: 900014 },
    ],
    ["deleted", "Deleted", "failed", DANGER_ICON, GitPullRequestClosed, {}],
    [
      UNLISTED_STATE,
      UNLISTED_STATE,
      "unknown",
      NEUTRAL_ICON,
      CircleQuestionMark,
      {},
    ],
  ])(
    "show a request %s as %s in the tooltip of its link and after its number for assistive technologies, with the mark of a request %s",
    async (state, words, _, color, icon, fields) => {
      const drawing = await drawingOf(icon);
      showing(
        [fictionalPackage()],
        {},
        { submissionRequests: () => submissionRequestIn(state, fields) },
      );
      const { screen } = await renderTree();
      const phases = await openPhases(screen);
      const submission = phaseIn(phases, "Submission");
      const link = submission.getByRole("link", { name: /^SR 900001\b/ });
      await expect.element(link).toBeVisible();

      expect(await markDistance(submission, link, color)).toBeLessThan(24);
      expect(markDrawing(link)).toBe(drawing);

      // Keyboard focus shows the tooltip at once.
      await userEvent.keyboard("{Tab}");

      await expect.element(link).toHaveFocus();
      const tooltip = screen.getByRole("tooltip");
      await expect.element(tooltip).toBeVisible();
      expect(tooltip.element().textContent).toBe(words);
      await expect
        .element(link)
        .toHaveAccessibleName(`SR 900001, ${words} (another site)`);
    },
  );

  test("show the state of a request in the tooltip of its link under the pointer", async () => {
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse([fictionalSubmissionRequest()]),
      },
    );
    const { screen } = await renderTree();
    const phases = await openPhases(screen);
    const link = phases.getByRole("link", { name: /^SR 900001\b/ });
    await expect.element(link).toBeVisible();

    await link.hover();

    const tooltip = screen.getByRole("tooltip");
    await expect.element(tooltip).toBeVisible();
    expect(tooltip.element().textContent).toBe("Review");
  });

  test("follow the latest request as +N, 6 px after its link, named after the other requests with their state, whose tooltip lists every request with its state below their number", async () => {
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse([
            fictionalSubmissionRequest(),
            fictionalSubmissionRequest({
              request_number: 900000,
              state: "declined",
            }),
          ]),
        releaseRequests: () =>
          releaseRequestsResponse([
            fictionalReleaseRequest({ request_number: 900005 }),
            fictionalReleaseRequest({
              state: "superseded",
              superseded_by_request_number: 900005,
            }),
          ]),
      },
    );
    const { screen } = await renderTree();
    const phases = await openPhases(screen);

    const sr = phases.getByRole("link", { name: /^SR 900001\b/ });
    const more = phaseIn(phases, "Submission").getByRole("button", {
      name: "1 more submission request: SR 900000, Declined",
      exact: true,
    });
    await expect.element(more).toHaveTextContent("+1");
    expect(boxOf(more).left - boxOf(sr).right).toBeCloseTo(6, 0);
    await expect
      .element(
        phaseIn(phases, "QA").getByRole("button", {
          name: "1 more release request: RR 900003, Superseded by 900005",
          exact: true,
        }),
      )
      .toHaveTextContent("+1");

    await more.hover();

    const tooltip = screen.getByRole("tooltip");
    await expect.element(tooltip).toBeVisible();
    await expect
      .element(tooltip.getByText("2 submission requests", { exact: true }))
      .toBeVisible();
    expect(
      tooltip
        .getByRole("listitem")
        .elements()
        .map((line) => line.textContent),
    ).toEqual(["SR 900001 · Review", "SR 900000 · Declined"]);
    expect(tooltip.getByText(/more$/).elements()).toHaveLength(0);
  });

  test.each<[string, number, string, string]>([
    [
      "names ten other requests and how many more, and lists ten requests and how many more",
      15,
      "14 more submission requests",
      "5",
    ],
    [
      "names ten other requests whole, and lists ten requests and one more",
      11,
      "10 more submission requests",
      "1",
    ],
  ])("+N %s", async (_, total, count, more) => {
    const requests = manyRequests();
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse(requests, { total }),
      },
    );
    const { screen } = await renderTree();
    const phases = await openPhases(screen);
    const others = requests
      .slice(1)
      .map((request) => `SR ${request.request_number}, Declined`);
    const unnamed = total - 11;
    const button = phases.getByRole("button", {
      name: `${count}: ${[...others, ...(unnamed > 0 ? [`and ${unnamed} more`] : [])].join("; ")}`,
      exact: true,
    });
    await expect.element(button).toHaveTextContent(`+${total - 1}`);

    await button.hover();

    const tooltip = screen.getByRole("tooltip");
    await expect.element(tooltip).toBeVisible();
    await expect
      .element(
        tooltip.getByText(`${total} submission requests`, { exact: true }),
      )
      .toBeVisible();
    expect(
      tooltip
        .getByRole("listitem")
        .elements()
        .map((line) => line.textContent),
    ).toEqual(
      requests
        .slice(0, 10)
        .map(
          (request) =>
            `SR ${request.request_number} · ${request.state === "review" ? "Review" : "Declined"}`,
        ),
    );
    await expect
      .element(tooltip.getByText(`…and ${more} more`, { exact: true }))
      .toBeVisible();
  });

  test.each(REQUEST_POPOVERS)(
    "show the loading indicator in place of a request in %s until its read arrives, and the other request and the phases at once",
    async (_, fields, open) => {
      const submission = later();
      showing(
        [fictionalPackage({ tracks: [fictionalTrack(fields)] })],
        {},
        {
          submissionRequests: () => submission.promise,
          releaseRequests: () =>
            releaseRequestsResponse([fictionalReleaseRequest()]),
        },
      );
      const { screen } = await renderTree();

      const places = await open(screen);

      await expect
        .element(
          places.submission.getByRole("progressbar", { name: "Loading" }),
        )
        .toBeVisible();
      await expect
        .element(places.qa.getByRole("link", { name: /^RR 900003\b/ }))
        .toBeVisible();
      await expect
        .element(places.popover.getByText("Submission", { exact: true }))
        .toBeVisible();
      expect(places.submission.getByRole("link").elements()).toHaveLength(0);

      submission.resolve(
        submissionRequestsResponse([fictionalSubmissionRequest()]),
      );

      await expect
        .element(places.submission.getByRole("link", { name: /^SR 900001\b/ }))
        .toBeVisible();
      expect(places.popover.getByRole("progressbar").elements()).toHaveLength(
        0,
      );
    },
  );

  test.each<
    [
      string,
      (typeof REQUEST_POPOVERS)[number],
      "submission" | "qa",
      number,
      string,
    ]
  >([
    ["Phases", REQUEST_POPOVERS[0]!, "submission", 500, "INTERNAL_ERROR"],
    ["Phases", REQUEST_POPOVERS[0]!, "qa", 404, "TICKET_NOT_FOUND"],
    [
      "the popover of a delivery",
      REQUEST_POPOVERS[1]!,
      "submission",
      409,
      "FICTIONAL_CONFLICT",
    ],
    [
      "the popover of a delivery",
      REQUEST_POPOVERS[1]!,
      "qa",
      400,
      "FICTIONAL_CODE",
    ],
  ])(
    "say in place of a request in %s whose read fails, in fg-muted, that the requests of its kind aren't available, which a status region announces, and keep the other request and the phases shown",
    async (_, [, fields, open], kind, status, code) => {
      const failure = later();
      const fails = () =>
        failure.promise.then(() => errorResponse(status, code));
      showing(
        [fictionalPackage({ tracks: [fictionalTrack(fields)] })],
        {},
        {
          submissionRequests:
            kind === "submission"
              ? fails
              : () =>
                  submissionRequestsResponse([fictionalSubmissionRequest()]),
          releaseRequests:
            kind === "qa"
              ? fails
              : () => releaseRequestsResponse([fictionalReleaseRequest()]),
        },
      );
      const { screen } = await renderTree();
      const places = await open(screen);
      const failed = places[kind];
      const other = places[kind === "submission" ? "qa" : "submission"];
      // The status region is there before the failure, which it announces.
      const announced = failed.getByRole("status");
      await expect.element(announced).toBeInTheDocument();
      expect(announced.element().textContent).toBe("");

      failure.resolve(new Response());

      // The line that shows is the one that the region announces, and
      // nothing else says it.
      const shown = announced.getByText(UNAVAILABLE[kind], { exact: true });
      await expect.element(shown).toBeVisible();
      expectShownWhole(shown.element());
      expect(shown.element().closest("[aria-hidden]")).toBeNull();
      expect(announced.element().textContent).toBe(UNAVAILABLE[kind]);
      expect(colorOf(shown.element())).toBe(FG_MUTED);
      expect(failed.element().textContent).not.toMatch(/Not available/);
      if (open === inPhases && kind === "submission") {
        // Too wide for the line of "Submission · Maintainer", it stands
        // below the name of the phase, above its state.
        const box = boxOf(shown);
        expect(box.top).toBeGreaterThanOrEqual(
          boxOf(failed.getByText("Submission", { exact: true })).bottom,
        );
        expect(box.bottom).toBeLessThanOrEqual(
          boxOf(failed.getByText(/^(?:Due|Overdue) /)).top,
        );
      }
      expect(failed.getByRole("link").elements()).toHaveLength(0);
      await expect
        .element(other.getByRole("link", { name: /^(?:SR|RR) 9000/ }))
        .toBeVisible();
      expect(other.getByRole("status").element().textContent).toBe("");
      await expect
        .element(places.popover.getByText("Submission", { exact: true }))
        .toBeVisible();
    },
  );

  test.each(REQUEST_POPOVERS)(
    "are read again when %s opens again, after a failure too",
    async (_, fields, open) => {
      let fail = true;
      const spy = showing(
        [fictionalPackage({ tracks: [fictionalTrack(fields)] })],
        {},
        {
          submissionRequests: () =>
            fail
              ? errorResponse(404, "TICKET_NOT_FOUND")
              : submissionRequestsResponse([fictionalSubmissionRequest()]),
        },
      );
      const { screen } = await renderTree();
      let places = await open(screen);
      const shown = places.submission
        .getByRole("status")
        .getByText(UNAVAILABLE.submission, { exact: true });
      await expect.element(shown).toBeVisible();
      expectShownWhole(shown.element());
      expect(colorOf(shown.element())).toBe(FG_MUTED);
      await userEvent.keyboard("{Escape}");
      await expect.element(places.popover).not.toBeInTheDocument();

      fail = false;
      places = await open(screen);

      await expect
        .element(places.submission.getByRole("link", { name: /^SR 900001\b/ }))
        .toBeVisible();
      expect(places.submission.getByRole("status").element().textContent).toBe(
        "",
      );
      expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([
        TRACK_QUERY,
        TRACK_QUERY,
      ]);
      expect(queriesTo(spy, RELEASE_REQUESTS)).toEqual([
        TRACK_QUERY,
        TRACK_QUERY,
      ]);
    },
  );

  test("are read again each time Phases opens, without showing those of the earlier opening meanwhile", async () => {
    const second = later();
    let reads = 0;
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () => {
          reads += 1;
          return reads === 1
            ? submissionRequestsResponse([fictionalSubmissionRequest()])
            : second.promise;
        },
      },
    );
    const { screen } = await renderTree();
    let phases = await openPhases(screen);
    await expect
      .element(phases.getByRole("link", { name: /^SR 900001\b/ }))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(phases).not.toBeInTheDocument();

    phases = await openPhases(screen);

    await expect
      .element(phases.getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();
    expect(phases.getByRole("link").elements()).toHaveLength(0);
    expect(reads).toBe(2);

    second.resolve(
      submissionRequestsResponse([
        fictionalSubmissionRequest({ request_number: 900002 }),
      ]),
    );

    await expect
      .element(phases.getByRole("link", { name: /^SR 900002\b/ }))
      .toBeVisible();
  });

  test("are not read again while Phases is open, also when the tab returns to the foreground", async () => {
    const spy = showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse([fictionalSubmissionRequest()]),
      },
    );
    const { screen } = await renderTree();
    const phases = await openPhases(screen);
    await expect
      .element(phases.getByRole("link", { name: /^SR 900001\b/ }))
      .toBeVisible();

    await returnToForeground();

    // The Ticket is read again, which shows that the return took effect.
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(2);
    expect(queriesTo(spy, SUBMISSION_REQUESTS)).toHaveLength(1);
    expect(queriesTo(spy, RELEASE_REQUESTS)).toHaveLength(1);
    await expect.element(phases).toHaveFocus();
  });

  test.each<[string, Partial<TrackDetail>, Partial<TicketDetail>]>([
    ["a Git track", { workflow_type: "git", reference: "fles-16.0" }, {}],
    ["an IBS track of a Ticket without a CVE", UNOBSERVED, { cve: null }],
  ])(
    "are neither read nor shown in Phases of %s",
    async (_, fields, ticket) => {
      const spy = showing(
        [fictionalPackage({ tracks: [fictionalTrack(fields)] })],
        ticket,
        {
          submissionRequests: () =>
            submissionRequestsResponse([fictionalSubmissionRequest()]),
          releaseRequests: () =>
            releaseRequestsResponse([fictionalReleaseRequest()]),
        },
      );
      const { screen } = await renderTree();

      const phases = await openPhases(
        screen,
        fields.reference ?? "SUSE:FLES-15-SP7:Update",
      );

      expect(phases.getByRole("listitem").elements()).toHaveLength(4);
      // Neither a request nor the place of one.
      expect(phases.getByRole("link").elements()).toHaveLength(0);
      expect(phases.getByRole("status").elements()).toHaveLength(0);
      expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([]);
      expect(queriesTo(spy, RELEASE_REQUESTS)).toEqual([]);
    },
  );

  test("leave the name of the pipeline as it is, without them", async () => {
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse([
            fictionalSubmissionRequest(),
            fictionalSubmissionRequest({
              request_number: 900000,
              state: "declined",
            }),
          ]),
        releaseRequests: () =>
          releaseRequestsResponse([fictionalReleaseRequest()]),
      },
    );
    const { screen } = await renderTree();
    const pipeline = trackOf(screen, "SUSE:FLES-15-SP7:Update").getByRole(
      "button",
      { name: /^Phases of/ },
    );
    await expect.element(pipeline).toBeVisible();
    const name = pipeline.element().getAttribute("aria-label");
    expect(name).toMatch(
      /^Phases of fictional-openssl, SUSE:FLES-15-SP7:Update: Triage done; Submission [^;]+, current; UM [^;]+; QA [^;]+; delivery pending$/,
    );

    const phases = await openPhases(screen);
    await expect
      .element(phases.getByRole("link", { name: /^RR 900003\b/ }))
      .toBeVisible();
    await expect
      .element(phases.getByRole("link", { name: /^SR 900001\b/ }))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");

    await expect.element(pipeline).toHaveFocus();
    expect(pipeline.element().getAttribute("aria-label")).toBe(name);
  });

  test.each<[string, TrackDetail["status"]]>([
    ["Not affected", "not_affected"],
    ["Won't fix", "wont_fix"],
  ])(
    "open from the delivery on the line of an IBS track without a pipeline, %s, in a popover titled Delivery with Submission and QA, and None without a request",
    async (affectedness, status) => {
      const spy = showing(
        [
          fictionalPackage({
            tracks: [fictionalTrack({ ...DELIVERED, status })],
          }),
        ],
        {},
        {
          submissionRequests: () =>
            submissionRequestsResponse([fictionalSubmissionRequest()]),
        },
      );
      const { screen } = await renderTree();
      const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
      const delivery = track.getByRole("button", {
        name: DELIVERY,
        exact: true,
      });
      await expect.element(delivery).toHaveTextContent("In progress");
      await expect
        .element(track.getByText(affectedness, { exact: true }))
        .toBeVisible();
      expect(
        track.getByRole("button", { name: /^Phases of/ }).elements(),
      ).toHaveLength(0);
      expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([]);

      const { popover, submission, qa } = await inDelivery(screen);

      await expect
        .element(submission.getByRole("link", { name: /^SR 900001\b/ }))
        .toHaveAttribute("href", "https://build.suse.de/request/show/900001");
      expect(
        popover
          .getByRole("term")
          .elements()
          .map((element) => element.textContent),
      ).toEqual(["Submission", "QA"]);
      // The release requests arrive by a read of their own.
      await expect.poll(() => qa.element().textContent).toBe("None");
      expect(colorOf(qa.getByText("None", { exact: true }).element())).toBe(
        FG_MUTED,
      );
      expect(popover.getByText("In progress").elements()).toHaveLength(0);
      expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([TRACK_QUERY]);
      expect(queriesTo(spy, RELEASE_REQUESTS)).toEqual([TRACK_QUERY]);

      await userEvent.keyboard("{Escape}");

      await expect.element(delivery).toHaveFocus();
    },
  );

  test("say None in Submission of the popover of a delivery without a submission request", async () => {
    showing(
      [fictionalPackage({ tracks: [fictionalTrack(DELIVERED)] })],
      {},
      {
        releaseRequests: () =>
          releaseRequestsResponse([fictionalReleaseRequest()]),
      },
    );
    const { screen } = await renderTree();

    const { submission, qa } = await inDelivery(screen);

    await expect
      .element(qa.getByRole("link", { name: /^RR 900003\b/ }))
      .toBeVisible();
    // The submission requests arrive by a read of their own.
    await expect.poll(() => submission.element().textContent).toBe("None");
  });

  test.each<[string, Partial<TrackDetail>, Partial<TicketDetail>]>([
    ["a Git track", { workflow_type: "git", reference: "fles-16.0" }, {}],
    ["an IBS track of a Ticket without a CVE", {}, { cve: null }],
  ])(
    "are not read for the delivery on the line of %s without a pipeline, whose status is text",
    async (_, fields, ticket) => {
      const spy = showing(
        [
          fictionalPackage({
            tracks: [fictionalTrack({ ...DELIVERED, ...fields })],
          }),
        ],
        ticket,
      );
      const { screen } = await renderTree();

      const track = trackOf(
        screen,
        fields.reference ?? "SUSE:FLES-15-SP7:Update",
      );
      await expect
        .element(track.getByText("In progress", { exact: true }))
        .toBeVisible();
      expect(
        track.getByRole("button", { name: /Delivery|In progress/ }).elements(),
      ).toHaveLength(0);
      expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([]);
      expect(queriesTo(spy, RELEASE_REQUESTS)).toEqual([]);
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
      "a Fixed track of a Ticket without a CVE, which it does not keep from Resolved, in its details only",
      { status: "fixed", ...UNOBSERVED },
      { cve: null },
      undefined,
      "Not observed",
    ],
    [
      "an Affected track whose QA Sentinel observes, in its details only",
      {},
      {},
      undefined,
      "Not released",
    ],
    [
      "an Affected Git track, once Sentinel observes its QA, in its details only",
      { workflow_type: "git", reference: "fles-16.0" },
      {},
      undefined,
      "Not released",
    ],
    [
      "a track in Analysis whose QA Sentinel does not observe, in its details only",
      { status: "analysis", ...UNOBSERVED },
      {},
      undefined,
      "Not observed",
    ],
  ])(
    "shows that it is not released, below %s",
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
    ).toEqual([
      `Not eligible, set by handSet by Alice Smith on ${formatDateTime(SET_AT)}`,
      "General support",
    ]);
    expect(details.getByRole("button").elements()).toHaveLength(0);
  });

  test('ends an eligibility set by hand with user-pen at 14 px in fg-muted, 4 px after it, read as ", set by hand"', async () => {
    const details = await openProductDetails(SET_BY_HAND);

    const eligibility = eligibilityIn(details);
    // The icon, hidden from assistive technologies, follows the words of the
    // eligibility.
    const icons = eligibility.querySelectorAll("svg");
    expect(icons).toHaveLength(1);
    const icon = icons[0]!;
    const words = document.createRange();
    words.selectNodeContents(icon.previousSibling!);
    const box = icon.getBoundingClientRect();
    expect([box.width, box.height]).toEqual([14, 14]);
    expect(box.left - words.getBoundingClientRect().right).toBeCloseTo(4, 0);
    expect(colorOf(icon)).toBe(FG_MUTED);
    expect(details.getByRole("img").query()).toBeNull();
    expect(eligibility.textContent).toMatch(/^Not eligible, set by handSet by/);
  });

  test("shows below an eligibility set by hand who set it, in the name form, and when, as a date and time on one line, in text-13, fg-muted", async () => {
    const details = await openProductDetails(SET_BY_HAND);

    const eligibility = eligibilityIn(details);
    const line = details.getByText(/^Set by /);
    const time = line.getByText(formatDateTime(SET_AT), { exact: true });
    await expect.element(time).toHaveAttribute("datetime", SET_AT);
    expect(line.element().textContent).toBe(
      `Set by Alice Smith on ${formatDateTime(SET_AT)}`,
    );
    const style = getComputedStyle(line.element());
    expect([style.fontSize, style.color]).toEqual(["13px", FG_MUTED]);
    // The name form, without the avatar, in the color of the line, on its
    // baseline.
    const name = line.getByText("Alice Smith", { exact: true }).element();
    expect(line.element().querySelectorAll("svg")).toHaveLength(0);
    expect(colorOf(name)).toBe(FG_MUTED);
    const setBy = document.createRange();
    setBy.selectNodeContents(line.element().firstChild!);
    const nameText = document.createRange();
    nameText.selectNodeContents(name);
    expect(nameText.getBoundingClientRect().bottom).toBeCloseTo(
      setBy.getBoundingClientRect().bottom,
      0,
    );
    // Below the words of the eligibility, 2 px after their line, at the
    // start of the value.
    const value = eligibility.firstElementChild!.getBoundingClientRect();
    expect(boxOf(line).top - value.bottom).toBeCloseTo(2, 0);
    expect(boxOf(line).left).toBe(eligibility.getBoundingClientRect().left);
    // The line wraps, but never within the date and time.
    expect(boxOf(line).height).toBeGreaterThan(20);
    expect(time.element().getClientRects()).toHaveLength(1);
  });

  test.each([
    [
      "an inactive user with the label Inactive",
      { ...SETTER, active: false },
      "Alice SmithInactive",
    ],
    [
      "a bot account with the label Bot",
      { ...SETTER, bot: true },
      "Alice SmithBot",
    ],
    [
      "a user without a full name by the username",
      { ...SETTER, full_name: null },
      "asmith",
    ],
  ])(
    "shows who set an eligibility by hand when it is %s",
    async (_, user, text) => {
      const details = await openProductDetails({
        ...SET_BY_HAND,
        eligibility_override_by: user,
      });

      expect(details.getByText(/^Set by /).element().textContent).toBe(
        `Set by ${text} on ${formatDateTime(SET_AT)}`,
      );
    },
  );

  // Each value apart, so that each shows in its own place.
  test.each<[string, Partial<ProductDetail>, string]>([
    [
      "a setter",
      { eligibility_override_by: null },
      `Set by –Not set on ${formatDateTime(SET_AT)}`,
    ],
    [
      "a time",
      { eligibility_override_at: null },
      "Set by Alice Smith on –Not set",
    ],
  ])(
    "shows %s that is absent under an eligibility set by hand as an absent value, not as System",
    async (_, changes, text) => {
      const details = await openProductDetails({ ...SET_BY_HAND, ...changes });

      expect(eligibilityIn(details).textContent).toBe(
        `Not eligible, set by hand${text}`,
      );
    },
  );

  test("wraps a long name of who set an eligibility by hand within the details, which show it whole", async () => {
    const details = await openProductDetails({
      ...SET_BY_HAND,
      eligibility_override_by: {
        ...SETTER,
        full_name: "Alexandra Fictional Konstantinopoulou-Example",
        active: false,
      },
    });

    const name = details
      .getByText("Alexandra Fictional Konstantinopoulou-Example", {
        exact: true,
      })
      .element();
    expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth);
    expect(name.getBoundingClientRect().height).toBeGreaterThan(20);
    // Within the details, apart from a fraction of a pixel of rounding.
    const bounds = details.element().getBoundingClientRect();
    const label = details.getByText("Inactive", { exact: true }).element();
    expect(name.getBoundingClientRect().right - bounds.right).toBeLessThan(0.5);
    expect(label.getBoundingClientRect().right - bounds.right).toBeLessThan(
      0.5,
    );
  });

  test.each<[string, boolean]>([
    ["Eligible", true],
    ["Not eligible", false],
  ])(
    "shows an automatic eligibility, %s, without user-pen and without who set it",
    async (words, eligible) => {
      const details = await openProductDetails({ eligible });

      const eligibility = eligibilityIn(details);
      expect(eligibility.textContent).toBe(words);
      expect(eligibility.querySelectorAll("svg")).toHaveLength(0);
    },
  );

  test.each<[string, Partial<TrackDetail>, Partial<ProductDetail>, string[]]>([
    [
      "an automatic eligibility, no lifecycle data, and a Git release that Sentinel does not observe",
      { workflow_type: "git", reference: "fles-16.0", ...UNOBSERVED },
      { lifecycle_phase: null },
      ["Eligible", "Not available", "Not observed"],
    ],
    [
      "a release",
      {},
      { released_at: "2099-10-20T09:00:00Z", lifecycle_phase: "pre_release" },
      [
        "Eligible",
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
    ).toEqual(["Eligible", "sunset", words]);
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

    await returnToForeground();

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

    await returnToForeground();

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

    await returnToForeground();

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

    await returnToForeground();

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
              avatar_url: null,
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

    await returnToForeground();

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

    await returnToForeground();

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
  success: "rgb(218, 251, 225)",
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
// intervals is not merged into it. expect.poll moves a fake clock by its
// interval after each failed attempt; an interval of 0 leaves the clock where
// the test set it, so that the next read at intervals comes when the test
// counts it.
async function sourcesSettled() {
  await expect
    .poll(() => client.isFetching({ queryKey: [SOURCES] }), { interval: 0 })
    .toBe(0);
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
          fictionalSource({ source: "bugzilla" }),
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
      `SUSE Bugzilla Success Last attempt ${attempted}`,
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

    await returnToForeground();

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
    // Away from the line, where the pointer of an earlier test can stay.
    await screen.getByRole("heading", { level: 2, name: "Details" }).hover();
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

    // The wait for the screen moves the clock by as long as it takes, so the
    // test moves it on to the first read at intervals, and counts from there.
    vi.advanceTimersToNextTimer();
    await sourcesSettled();
    expect(requestsTo(spy, SOURCES)).toBe(2);

    vi.advanceTimersByTime(4_999);
    expect(requestsTo(spy, SOURCES)).toBe(2);
    vi.advanceTimersByTime(1);
    await sourcesSettled();
    expect(requestsTo(spy, SOURCES)).toBe(3);

    // While the tab is hidden, no read at intervals is sent.
    focusManager.setFocused(false);
    vi.advanceTimersByTime(15_000);
    expect(requestsTo(spy, SOURCES)).toBe(3);
    // The tab returns to the foreground, where the sources are read again.
    focusManager.setFocused(true);
    await expect.poll(() => requestsTo(spy, SOURCES)).toBe(4);
    await sourcesSettled();

    sources = pendingSources().map((source) =>
      source.status === "pending"
        ? { ...source, status: "success", fetched_at: LATER_ATTEMPT }
        : source,
    );
    vi.advanceTimersByTime(5_000);
    await expect.poll(() => requestsTo(spy, SOURCES)).toBe(5);
    await sourcesSettled();

    vi.advanceTimersByTime(30_000);
    expect(requestsTo(spy, SOURCES)).toBe(5);
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
    await returnToForeground();
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
    // The announcement would follow, set by an effect of that commit.
    await nextFrames();
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

    await returnToForeground();

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
    avatar_url: null,
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

// How many reads of the path the spy received, without the changes sent to
// the same path, such as Grant Access.
function readsOf(spy: ReturnType<typeof stubApi>, path: string): number {
  return requestsWith(spy, "GET").filter(
    ([input]) => urlOf(input).pathname === path,
  ).length;
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
                    avatar_url: null,
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
      avatar_url: null,
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

    await returnToForeground();

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
    await nextFrames();
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
      grants: readsOf(spy, ACCESS),
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
    await expect.poll(() => readsOf(spy, ACCESS)).toBe(reads.grants + 1);
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
      // The error takes the focus once it has shown, after the response.
      await expect
        .poll(() =>
          error
            .element()
            .closest("[tabindex]")
            ?.contains(document.activeElement),
        )
        .toBe(true);
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

  test("ask before a navigation of the UI discards the user chosen, keep the dialog and the user on Keep editing, and leave on Discard", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse(),
      users: () => usersPage([fictionalDirectoryUser()]),
    });
    const { router, screen } = await renderParticipants();
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");

    router.history.push("/tickets");

    const discard = screen.getByRole("dialog", { name: "Discard changes?" });
    await expect
      .element(
        discard.getByText("The user that you chose isn't granted access."),
      )
      .toBeVisible();
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect.element(discard).not.toBeInTheDocument();
    await nextFrames();
    expect(router.state.location.pathname).toBe("/tickets/SNTL-12");
    await expect.element(userField(screen)).toHaveValue("Ana Garcia @agarcia");

    router.history.push("/tickets");
    await discard.getByRole("button", { name: "Discard", exact: true }).click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
  });

  test("ask before Close discards the user chosen while a revocation of another Ticket is in progress", async () => {
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse([CAROL]),
      users: () => usersPage([fictionalDirectoryUser()]),
    });
    const { screen } = await renderParticipants();
    // A revocation on another Ticket, which the user started there and which
    // has not ended.
    void new ChangeObserver<never, Error, { ticketId: string; user: string }>(
      client,
      {
        mutationKey: getRevokeTicketAccessMutationKey(),
        mutationFn: () => new Promise<never>(() => undefined),
      },
    ).mutate({ ticketId: "SNTL-13", user: CAROL.user.id });
    await expect
      .poll(() =>
        client.isMutating({ mutationKey: getRevokeTicketAccessMutationKey() }),
      )
      .toBe(1);
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");

    await accessGrantsDialog(screen)
      .getByRole("button", { name: "Close" })
      .click();

    await expect
      .element(screen.getByRole("dialog", { name: "Discard changes?" }))
      .toBeVisible();
  });

  test("ask nothing before a navigation while a revocation is in progress with a user chosen", async () => {
    const response = later();
    stubTicket({
      user: MANAGER,
      ticket: () => confidentialTicket(),
      grants: () => grantsResponse([CAROL]),
      users: () => usersPage([fictionalDirectoryUser()]),
      revoke: () => response.promise,
    });
    const { router, screen } = await renderParticipants();
    await openAccessGrants(screen);
    await chooseUser(screen, "ana", "Ana Garcia @agarcia");
    await revokeCarol(screen);
    await expect
      .element(
        confirmationOf(screen, "Carol White").getByRole("button", {
          name: "Revoke access",
          exact: true,
        }),
      )
      .toHaveAttribute("aria-disabled", "true");

    await leaveForTickets(router, screen);

    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }).query(),
    ).toBeNull();
    response.resolve(new Response(null, { status: 204 }));
    await expect
      .element(screen.getByText("SNTL-12: Access of Carol White revoked."))
      .toBeVisible();
  });

  test.each<
    [string, (screen: Screen) => Promise<void>, () => Response, string, string]
  >([
    [
      "a grant",
      async (screen) => {
        await chooseUser(screen, "ana", "Ana Garcia @agarcia");
        await grantButton(screen).click();
        await expect
          .element(grantButton(screen))
          .toHaveAttribute("aria-disabled", "true");
      },
      () => grantResponse(fictionalGrant({ user: FICTIONAL_ACTORS[0]! })),
      "SNTL-12: Access granted to Ana Garcia.",
      MESSAGE_TONES.success,
    ],
    [
      "a grant that Sentinel refuses",
      async (screen) => {
        await chooseUser(screen, "ana", "Ana Garcia @agarcia");
        await grantButton(screen).click();
        await expect
          .element(grantButton(screen))
          .toHaveAttribute("aria-disabled", "true");
      },
      () => errorResponse(409, "TICKET_NOT_CONFIDENTIAL"),
      `SNTL-12: ${MESSAGE_CONFLICT}`,
      MESSAGE_TONES.danger,
    ],
    [
      "a revocation",
      async (screen) => {
        await revokeCarol(screen);
        await expect
          .element(
            confirmationOf(screen, "Carol White").getByRole("button", {
              name: "Revoke access",
              exact: true,
            }),
          )
          .toHaveAttribute("aria-disabled", "true");
      },
      () => new Response(null, { status: 204 }),
      "SNTL-12: Access of Carol White revoked.",
      MESSAGE_TONES.success,
    ],
  ])(
    "leave without a question while %s is in progress, and show its outcome in the message area, naming the Ticket",
    async (_, start, outcome, text, tone) => {
      const response = later();
      stubTicket({
        user: MANAGER,
        ticket: () => confidentialTicket(),
        grants: () => grantsResponse([CAROL]),
        users: () => usersPage([fictionalDirectoryUser()]),
        grant: () => response.promise,
        revoke: () => response.promise,
      });
      const { router, screen } = await renderParticipants();
      await openAccessGrants(screen);
      await start(screen);

      await leaveForTickets(router, screen);

      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();
      response.resolve(outcome());
      const message = screen.getByText(text);
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(tone);
      await expect
        .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
        .toHaveAttribute("href", "/tickets/SNTL-12");
    },
  );

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

    await returnToForeground();

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
    await nextFrames();
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

// ----------------------------------------------------------------------------
// The assignee

// Alice Smith, the signed-in user of OTHER_USER, as the assignee of a
// Ticket, and Bob Wilson, an analyst of the directory.
const ALICE = FICTIONAL_ACTORS[1]!;
const BOB_ENTRY = fictionalDirectoryUser({
  id: "00000000-0000-0000-0000-000000000010",
  username: "bwilson",
  email: "bob.wilson@example.com",
  full_name: "Bob Wilson",
});
const BOB = {
  id: BOB_ENTRY.id,
  username: BOB_ENTRY.username,
  full_name: BOB_ENTRY.full_name,
  active: true,
  bot: false,
  avatar_url: null,
};
const ANA_ENTRY = fictionalDirectoryUser();
const ALICE_ENTRY = fictionalDirectoryUser({
  id: ALICE.id,
  username: ALICE.username,
  email: "alice.smith@example.com",
  full_name: ALICE.full_name,
});

function detailsPart(screen: Screen) {
  return screen.getByRole("region", { name: "Details", exact: true });
}

// The value of the assignee, the first field of the details.
function assigneeValue(screen: Screen) {
  return detailsPart(screen).getByRole("definition").first();
}

function editAssignee(screen: Screen) {
  return detailsPart(screen).getByRole("button", { name: "Edit assignee" });
}

function assigneePopover(screen: Screen) {
  return screen.getByRole("dialog", { name: "Assignee" });
}

function searchUsers(screen: Screen) {
  return assigneePopover(screen).getByRole("searchbox", {
    name: "Search users",
  });
}

function userOption(screen: Screen, name: string) {
  return assigneePopover(screen).getByRole("option", { name, exact: true });
}

// The names of the options of the popover, in their order.
function assigneeOptions(screen: Screen): (string | null)[] {
  return assigneePopover(screen)
    .getByRole("option")
    .elements()
    .map((element) => element.textContent);
}

// A SNTL-12 with the assignee.
function assignedTo(assignee: TicketDetail["assignee"]) {
  return ticketResponse(fictionalTicketDetail({ assignee }));
}

// Renders the screen of SNTL-12 and waits until its details show.
async function renderDetails() {
  const rendered = await renderApp("/tickets/SNTL-12");
  await expect.element(detailsPart(rendered.screen)).toBeVisible();
  return rendered;
}

// Opens the popover of the assignee and waits until it lists the option.
async function openAssignee(screen: Screen, option: string) {
  await editAssignee(screen).click();
  await expect.element(userOption(screen, option)).toBeVisible();
}

// The bodies of the requests of Assign Ticket.
function assignments(spy: ReturnType<typeof stubApi>): unknown[] {
  return requestsWith(spy, "PATCH")
    .filter(([input]) => urlOf(input).pathname === ASSIGNEE)
    .map(([, init]) =>
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    );
}

// The queries of the reads of the directory.
function directoryReads(spy: ReturnType<typeof stubApi>): string[] {
  return requestsWith(spy, "GET")
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname === USERS)
    .map((url) => url.search);
}

// A press of a pointer outside the popover, which React Aria takes from the
// document.
function interactOutside() {
  for (const type of ["pointerdown", "pointerup", "click"]) {
    document.body.dispatchEvent(
      new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0 }),
    );
  }
}

// What the status regions of the screen outside a dialog say.
function announcements(screen: Screen): string {
  return screen
    .getByRole("status")
    .elements()
    .filter((region) => region.closest('[role="dialog"]') === null)
    .map((region) => region.textContent ?? "")
    .join("");
}

describe("the assignee", () => {
  test("has a pencil, Edit assignee, at the end of its line for a user who holds triage_ticket", async () => {
    stubTicket({ ticket: () => assignedTo(BOB) });
    const { screen } = await renderDetails();

    const pencil = editAssignee(screen);
    await expect.element(pencil).toBeVisible();
    expect(boxOf(pencil).width).toBe(24);
    expect(boxOf(pencil).height).toBe(24);
    expect(boxOf(pencil).right).toBe(boxOf(assigneeValue(screen)).right);
    const term = detailsPart(screen).getByText("Assignee", { exact: true });
    expect(boxOf(pencil).top).toBeLessThan(boxOf(term).bottom);
    await expect.element(assigneeValue(screen)).toHaveTextContent("Bob Wilson");
  });

  test.each(["new", "analysis", "analyzed", "resolved"] as const)(
    "has a pencil on a Ticket in %s",
    async (status) => {
      stubTicket({
        ticket: () => ticketResponse(fictionalTicketDetail({ status })),
      });
      const { screen } = await renderDetails();

      await expect.element(editAssignee(screen)).toBeVisible();
    },
  );

  test.each<[string, Partial<Stub>]>([
    ["without triage_ticket", { user: FICTIONAL_USER }],
    [
      "on an Ignored Ticket",
      {
        ticket: () =>
          ticketResponse(
            fictionalTicketDetail({
              status: "ignored",
              ignore_reason: "other",
            }),
          ),
      },
    ],
    [
      "on a Duplicated Ticket",
      {
        ticket: () =>
          ticketResponse(
            fictionalTicketDetail({
              status: "duplicated",
              duplicate_of_ticket_id: "SNTL-21",
            }),
          ),
      },
    ],
    [
      "on a Ticket of a status that the pinned contract does not list",
      {
        ticket: () =>
          jsonResponse(200, {
            data: { ...fictionalTicketDetail(), status: "fictional_status" },
          }),
      },
    ],
  ])("has no pencil %s", async (_, stub) => {
    stubTicket(stub);
    const { screen } = await renderDetails();

    await expect
      .element(detailsPart(screen).getByText("Last modified"))
      .toBeVisible();
    expect(editAssignee(screen).query()).toBeNull();
  });

  test("opens a popover whose search field takes the focus, with the users who can be the assignee of a non-confidential Ticket, the signed-in user first with You, and the assignee chosen", async () => {
    const spy = stubTicket({
      ticket: () => assignedTo(BOB),
      users: () => usersPage([ANA_ENTRY, ALICE_ENTRY, BOB_ENTRY]),
    });
    const { screen } = await renderDetails();

    await openAssignee(screen, "Bob Wilson @bwilson");

    await expect.element(searchUsers(screen)).toHaveFocus();
    expect(assigneeOptions(screen)).toEqual([
      "Alice Smith @asmithYou",
      "Ana Garcia @agarcia",
      "Bob Wilson @bwilson",
    ]);
    await expect
      .element(userOption(screen, "Bob Wilson @bwilson"))
      .toHaveAttribute("aria-selected", "true");
    expect(directoryReads(spy)).toEqual([
      "?assignment_eligibility=all&assignment_eligibility=non_confidential&per_page=20",
    ]);
    // 320 px wide with 16 px of padding, below the pencil.
    const popover = assigneePopover(screen).element().parentElement!;
    expect(boxOf(popover).width).toBe(320);
    expect(getComputedStyle(popover).paddingTop).toBe("16px");
    expect(boxOf(popover).top).toBeGreaterThan(
      boxOf(editAssignee(screen)).bottom,
    );

    await userEvent.keyboard("{Escape}");

    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await expect.element(editAssignee(screen)).toHaveFocus();
  });

  test.each<[string, string, boolean, string[]]>([
    [
      "all, on a confidential Ticket",
      "all",
      true,
      ["Alice Smith @asmithYou", "Bob Wilson @bwilson"],
    ],
    [
      "non_confidential, on a non-confidential Ticket",
      "non_confidential",
      false,
      ["Alice Smith @asmithYou", "Bob Wilson @bwilson"],
    ],
    [
      "non_confidential, on a confidential Ticket",
      "non_confidential",
      true,
      ["Bob Wilson @bwilson"],
    ],
    [
      "a value that the pinned contract does not list, on a non-confidential Ticket",
      "fictional",
      false,
      ["Bob Wilson @bwilson"],
    ],
  ])(
    "puts the signed-in user first by their assignment eligibility, %s, among the users of the eligibility that the Ticket admits",
    async (_, eligibility, confidential, options) => {
      const spy = stubTicket({
        user: {
          data: { ...OTHER_USER.data, assignment_eligibility: eligibility },
        },
        ticket: () =>
          ticketResponse(
            fictionalTicketDetail({
              is_confidential: confidential,
              assignee: BOB,
            }),
          ),
        users: () => usersPage([BOB_ENTRY]),
      });
      const { screen } = await renderDetails();

      await openAssignee(screen, "Bob Wilson @bwilson");

      expect(assigneeOptions(screen)).toEqual(options);
      expect(directoryReads(spy)).toEqual([
        confidential
          ? "?assignment_eligibility=all&per_page=20"
          : "?assignment_eligibility=all&assignment_eligibility=non_confidential&per_page=20",
      ]);
    },
  );

  test("reads its users each time it opens, and not when the tab returns to the foreground while it is open", async () => {
    const spy = stubTicket({
      ticket: () => assignedTo(BOB),
      users: () => usersPage([BOB_ENTRY]),
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");
    expect(directoryReads(spy)).toHaveLength(1);

    await returnToForeground();
    await readEnded(TICKET);
    await nextFrames();
    expect(directoryReads(spy)).toHaveLength(1);

    await userEvent.keyboard("{Escape}");
    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await openAssignee(screen, "Bob Wilson @bwilson");

    expect(directoryReads(spy)).toHaveLength(2);
  });

  test("assigns the Ticket at once to the user chosen, expecting the assignee shown, busy and open until Sentinel confirms it; then closes, returns the focus to the pencil, and announces it", async () => {
    let assignee: TicketDetail["assignee"] = null;
    const response = later();
    const spy = stubTicket({
      ticket: () => assignedTo(assignee),
      users: () => usersPage([ANA_ENTRY, BOB_ENTRY]),
      assign: () => response.promise,
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");
    const reads = readsOf(spy, TICKET);

    await userOption(screen, "Bob Wilson @bwilson").click();

    await expect
      .element(editAssignee(screen))
      .toHaveAttribute("aria-disabled", "true");
    expect(assignments(spy)).toEqual([
      { user_id: BOB.id, expected_assignee_id: null },
    ]);
    expect(
      animationsIn(userOption(screen, "Bob Wilson @bwilson").element()),
    ).toEqual(["spin"]);
    await expect
      .element(
        assigneePopover(screen)
          .getByRole("status")
          .getByText("Changing the assignee."),
      )
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    interactOutside();
    await nextFrames();
    await expect.element(assigneePopover(screen)).toBeVisible();

    assignee = BOB;
    response.resolve(assignedTo(BOB));

    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await expect.element(editAssignee(screen)).toHaveFocus();
    await expect.element(assigneeValue(screen)).toHaveTextContent("Bob Wilson");
    await expect
      .poll(() => announcements(screen))
      .toContain("Assigned to Bob Wilson.");
    expect(readsOf(spy, TICKET)).toBeGreaterThan(reads);
    expect(readsOf(spy, ACTORS)).toBeGreaterThan(1);
    await expect
      .element(editAssignee(screen))
      .not.toHaveAttribute("aria-disabled");
  });

  test("assigns the Ticket to the signed-in user, which it announces as Assigned to you.", async () => {
    let assignee: TicketDetail["assignee"] = BOB;
    const spy = stubTicket({
      ticket: () => assignedTo(assignee),
      users: () => usersPage([BOB_ENTRY]),
      assign: () => {
        assignee = ALICE;
        return assignedTo(ALICE);
      },
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Alice Smith @asmith You");

    await userOption(screen, "Alice Smith @asmith You").click();

    await expect
      .poll(() => announcements(screen))
      .toContain("Assigned to you.");
    expect(assignments(spy)).toEqual([
      { user_id: ALICE.id, expected_assignee_id: BOB.id },
    ]);
  });

  test("offers Unassign yourself first to the signed-in user who is the assignee, which returns the Ticket to the queue", async () => {
    let assignee: TicketDetail["assignee"] = ALICE;
    const spy = stubTicket({
      ticket: () => assignedTo(assignee),
      users: () => usersPage([ALICE_ENTRY, BOB_ENTRY]),
      assign: () => {
        assignee = null;
        return assignedTo(null);
      },
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");
    expect(assigneeOptions(screen)).toEqual([
      "Unassign yourself",
      "Alice Smith @asmithYou",
      "Bob Wilson @bwilson",
    ]);

    await userOption(screen, "Unassign yourself").click();

    await expect
      .poll(() => announcements(screen))
      .toContain("You're no longer the assignee.");
    await expect.element(assigneeValue(screen)).toHaveTextContent("Unassigned");
    expect(assignments(spy)).toEqual([
      { user_id: null, expected_assignee_id: ALICE.id },
    ]);
  });

  test("offers no Unassign yourself when another user is the assignee", async () => {
    stubTicket({
      ticket: () => assignedTo(BOB),
      users: () => usersPage([BOB_ENTRY]),
    });
    const { screen } = await renderDetails();

    await openAssignee(screen, "Bob Wilson @bwilson");

    expect(userOption(screen, "Unassign yourself").query()).toBeNull();
  });

  test.each<[string, () => Response, string]>([
    [
      "404 USER_NOT_FOUND",
      () => errorResponse(404, "USER_NOT_FOUND"),
      "Sentinel doesn't know this user.",
    ],
    [
      "409 TICKET_ASSIGNEE_INACTIVE",
      () => errorResponse(409, "TICKET_ASSIGNEE_INACTIVE"),
      "This user is inactive, so they can't be the assignee.",
    ],
    [
      "400 TICKET_ASSIGNEE_NOT_ELIGIBLE",
      () => errorResponse(400, "TICKET_ASSIGNEE_NOT_ELIGIBLE"),
      "This user can't be the assignee of this Ticket.",
    ],
    [
      "a field error of a VALIDATION_ERROR for user_id",
      () => validationError([["body", "user_id"]]),
      "This value isn't valid.",
    ],
  ])(
    "shows %s at the user field, which keeps the focus, reads the users again, and drops the error once the term changes",
    async (_, failure, message) => {
      const spy = stubTicket({
        ticket: () => assignedTo(null),
        users: () => usersPage([BOB_ENTRY]),
        assign: failure,
      });
      const { screen } = await renderDetails();
      await openAssignee(screen, "Bob Wilson @bwilson");

      await userOption(screen, "Bob Wilson @bwilson").click();

      const error = assigneePopover(screen).getByText(message);
      await expect.element(error).toBeVisible();
      await expect.element(searchUsers(screen)).toHaveFocus();
      await expect
        .element(searchUsers(screen))
        .toHaveAccessibleDescription(message);
      await expect.poll(() => directoryReads(spy)).toHaveLength(2);
      await expect
        .element(editAssignee(screen))
        .not.toHaveAttribute("aria-disabled");

      await userEvent.keyboard("b");

      await expect.element(error).not.toBeInTheDocument();
    },
  );

  test.each<[string, TicketDetail["assignee"], string]>([
    // Another user took the unassigned Ticket before the user chose Ana.
    ["TICKET_ASSIGNEE_CHANGED", null, "Ana Garcia @agarcia"],
    // Another user took the Ticket before the signed-in user, its assignee,
    // unassigned themselves (Sentinel docs/features/tickets/tickets.md,
    // Self-Unassignment).
    ["TICKET_ASSIGNEE_NOT_CALLER", ALICE, "Unassign yourself"],
  ])(
    "says at the top of the popover who the assignee is now after 409 %s, once the Ticket is read again",
    async (code, before, choice) => {
      let assignee = before;
      stubTicket({
        ticket: () => assignedTo(assignee),
        users: () => usersPage([ANA_ENTRY, BOB_ENTRY]),
        assign: () => {
          assignee = BOB;
          return errorResponse(409, code);
        },
      });
      const { screen } = await renderDetails();
      await openAssignee(screen, choice);

      await userOption(screen, choice).click();

      const message = assigneePopover(screen).getByText(
        "The assignee changed meanwhile: the Ticket is now assigned to Bob Wilson.",
      );
      await expect.element(message).toBeVisible();
      await expect
        .poll(() =>
          message
            .element()
            .closest("[tabindex]")
            ?.contains(document.activeElement),
        )
        .toBe(true);
      await expect
        .element(userOption(screen, "Bob Wilson @bwilson"))
        .toHaveAttribute("aria-selected", "true");
      await expect
        .element(assigneeValue(screen))
        .toHaveTextContent("Bob Wilson");
      // The signed-in user is no longer the assignee.
      expect(userOption(screen, "Unassign yourself").query()).toBeNull();
    },
  );

  test.each<[TicketDetail["assignee"], string]>([
    [null, "The assignee changed meanwhile: the Ticket is now unassigned."],
    [
      ALICE,
      "The assignee changed meanwhile: the Ticket is now assigned to you.",
    ],
  ])(
    "names an assignee that changed meanwhile as the Ticket shows it",
    async (now, text) => {
      let assignee: TicketDetail["assignee"] = BOB;
      stubTicket({
        ticket: () => assignedTo(assignee),
        users: () => usersPage([ANA_ENTRY, BOB_ENTRY]),
        assign: () => {
          assignee = now;
          return errorResponse(409, "TICKET_ASSIGNEE_CHANGED");
        },
      });
      const { screen } = await renderDetails();
      await openAssignee(screen, "Ana Garcia @agarcia");

      await userOption(screen, "Ana Garcia @agarcia").click();

      await expect
        .element(assigneePopover(screen).getByText(text))
        .toBeVisible();
    },
  );

  test("says only that the assignee changed when the read of the Ticket after it fails", async () => {
    let fails = false;
    stubTicket({
      ticket: () =>
        fails ? errorResponse(503, "SERVICE_UNAVAILABLE") : assignedTo(null),
      users: () => usersPage([BOB_ENTRY]),
      assign: () => {
        fails = true;
        return errorResponse(409, "TICKET_ASSIGNEE_CHANGED");
      },
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");

    await userOption(screen, "Bob Wilson @bwilson").click();

    await expect
      .element(
        assigneePopover(screen).getByText("The assignee changed meanwhile.", {
          exact: true,
        }),
      )
      .toBeVisible();
  });

  test.each<[string, () => Response, string, "danger" | "warning"]>([
    [
      "409 TICKET_NOT_MUTABLE",
      () => errorResponse(409, "TICKET_NOT_MUTABLE"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
    [
      "a 503, which Sentinel did not confirm",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      "warning",
    ],
    [
      "a code and a status that the pinned contract does not list",
      () => errorResponse(418, "FICTIONAL_CODE"),
      "Sentinel didn't accept this request.",
      "danger",
    ],
    [
      "a field error of a VALIDATION_ERROR for no field of the popover",
      () => validationError([["body", "expected_assignee_id"]]),
      "Sentinel didn't accept this request.",
      "danger",
    ],
  ])(
    "shows %s at the top of the popover, which stays open and takes the focus",
    async (_, failure, message, tone) => {
      stubTicket({
        ticket: () => assignedTo(null),
        users: () => usersPage([BOB_ENTRY]),
        assign: failure,
      });
      const { screen } = await renderDetails();
      await openAssignee(screen, "Bob Wilson @bwilson");

      await userOption(screen, "Bob Wilson @bwilson").click();

      const text = assigneePopover(screen).getByText(message);
      await expect.element(text).toBeVisible();
      const box = text.element().closest("[tabindex]");
      expect(box).not.toBeNull();
      await expect.element(page.elementLocator(box!)).toHaveFocus();
      expect(backgroundBehind(text.element())).toBe(MESSAGE_TONES[tone]);
      await expect
        .element(editAssignee(screen))
        .not.toHaveAttribute("aria-disabled");
    },
  );

  test("keeps the pencil and the popover with the signed-in user first after a 403 that removes triage_ticket and their eligibility, until the popover closes", async () => {
    let user: UserBody = OTHER_USER;
    const spy = stubTicket({
      user: () => user,
      ticket: () => assignedTo(null),
      users: () => usersPage([BOB_ENTRY]),
      assign: () => {
        user = {
          data: {
            ...OTHER_USER.data,
            roles: [],
            capabilities: [],
            assignment_eligibility: "none",
          },
        };
        return errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION");
      },
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");

    await userOption(screen, "Alice Smith @asmith You").click();

    await expect
      .element(
        assigneePopover(screen).getByText(
          "You don't have permission to do this.",
        ),
      )
      .toBeVisible();
    // Once the read of the signed-in user after the 403 has ended.
    await expect.poll(() => requestsTo(spy, ME)).toBe(2);
    await readEnded(ME);
    await nextFrames();
    await expect.element(assigneePopover(screen)).toBeVisible();
    expect(assigneeOptions(screen)).toEqual([
      "Alice Smith @asmithYou",
      "Bob Wilson @bwilson",
    ]);

    await userEvent.keyboard("{Escape}");

    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await expect.element(editAssignee(screen)).not.toBeInTheDocument();
  });

  test("reads again after an assignment the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, and the reads of the Ticket list, but not its duplicates", async () => {
    const spy = stubTicket({
      user: { data: { ...MAINTAINER.data, capabilities: ["triage_ticket"] } },
      ticket: () =>
        ticketResponse(
          fictionalTicketDetail({
            assignee: BOB,
            packages: [fictionalPackage()],
          }),
        ),
      users: () => usersPage([ANA_ENTRY, BOB_ENTRY]),
      assign: () => assignedTo(BOB),
    });
    // The user saw the Ticket list, and Audit log, before Overview.
    const { router, screen } = await renderApp("/tickets");
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
    await router.navigate({
      to: "/tickets/$ticketId/audit-log",
      params: { ticketId: "SNTL-12" },
    });
    await expect
      .element(screen.getByRole("tabpanel", { name: "Audit log" }))
      .toBeVisible();
    await screen.getByRole("tab", { name: "Overview" }).click();
    await expect.element(detailsPart(screen)).toBeVisible();
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      actors: requestsTo(spy, ACTORS),
      work: requestsTo(spy, YOUR_WORK),
      duplicates: readsOf(spy, TICKETS),
    };
    expect(leftInvalidated(EVENTS)).toBe(false);
    expect(leftInvalidated(TICKETS)).toBe(false);
    await openAssignee(screen, "Ana Garcia @agarcia");

    await userOption(screen, "Ana Garcia @agarcia").click();

    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(reads.work + 1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    expect(readsOf(spy, TICKETS)).toBe(reads.duplicates);
    expect(leftInvalidated(EVENTS)).toBe(true);
    expect(leftInvalidated(TICKETS)).toBe(true);
  });

  test("closes the popover when the layout changes, the focus moving to the heading of the screen", async () => {
    stubTicket({
      ticket: () => assignedTo(null),
      users: () => usersPage([BOB_ENTRY]),
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");

    await page.viewport(900, 800);

    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "SNTL-12" }))
      .toHaveFocus();
    await expect.element(editAssignee(screen)).toBeVisible();
  });

  test("keeps the pencil busy in its new place when the layout changes during an assignment, whose failure then shows in the message area", async () => {
    const response = later();
    stubTicket({
      ticket: () => assignedTo(null),
      users: () => usersPage([BOB_ENTRY]),
      assign: () => response.promise,
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");
    await userOption(screen, "Bob Wilson @bwilson").click();
    await expect
      .element(editAssignee(screen))
      .toHaveAttribute("aria-disabled", "true");

    await page.viewport(900, 800);

    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();
    await expect
      .element(editAssignee(screen))
      .toHaveAttribute("aria-disabled", "true");
    // A press that the pointer cannot give a button that is not enabled, as
    // assistive technologies give it.
    editAssignee(screen)
      .element()
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrames();
    expect(assigneePopover(screen).query()).toBeNull();

    response.resolve(errorResponse(503, "SERVICE_UNAVAILABLE"));

    await expect
      .element(
        screen.getByText(
          "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
        ),
      )
      .toBeVisible();
    await expect
      .element(editAssignee(screen))
      .not.toHaveAttribute("aria-disabled");
    expect(assigneePopover(screen).query()).toBeNull();
  });

  test("announces an assignment that ends after the layout changed", async () => {
    let assignee: TicketDetail["assignee"] = null;
    const response = later();
    stubTicket({
      ticket: () => assignedTo(assignee),
      users: () => usersPage([BOB_ENTRY]),
      assign: () => response.promise,
    });
    const { screen } = await renderDetails();
    await openAssignee(screen, "Bob Wilson @bwilson");
    await userOption(screen, "Bob Wilson @bwilson").click();
    await page.viewport(900, 800);
    await expect.element(assigneePopover(screen)).not.toBeInTheDocument();

    assignee = BOB;
    response.resolve(assignedTo(BOB));

    await expect
      .poll(() => announcements(screen))
      .toContain("Assigned to Bob Wilson.");
    expect(assigneePopover(screen).query()).toBeNull();
  });

  test.each<[string, () => Response, string]>([
    [
      "an assignment",
      () => assignedTo(BOB),
      "SNTL-12: Assigned to Bob Wilson.",
    ],
    [
      "a failed assignment",
      () => errorResponse(409, "TICKET_ASSIGNEE_CHANGED"),
      "SNTL-12: This can't be done in the current state, which may have changed. Check it and try again.",
    ],
  ])(
    "names the Ticket with a link in the message of %s that ends after the user left its screen",
    async (_, outcome, message) => {
      const response = later();
      stubTicket({
        ticket: () => assignedTo(null),
        users: () => usersPage([BOB_ENTRY]),
        assign: () => response.promise,
      });
      const { router, screen } = await renderDetails();
      await openAssignee(screen, "Bob Wilson @bwilson");
      await userOption(screen, "Bob Wilson @bwilson").click();
      await router.navigate({ to: "/tickets" });
      await expect
        .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
        .toBeVisible();

      response.resolve(outcome());

      await expect.element(screen.getByText(message)).toBeVisible();
      await expect
        .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
        .toHaveAttribute("href", "/tickets/SNTL-12");
    },
  );
});

// ----------------------------------------------------------------------------
// The SUSE assessment

// An analyst who manages the CVSS assessments, who adds, edits, and deletes
// the SUSE assessment of the CVE of a Ticket.
const ASSESSOR: CurrentUserResponse = {
  data: {
    ...OTHER_USER.data,
    capabilities: ["triage_ticket", "manage_cvss"],
  },
};

// The messages of the failures of a change (docs/behaviors.md, Default
// Presentation by Status; Missing and Inaccessible Records; Retries and
// Unconfirmed Changes).
const MESSAGE_CONFLICT =
  "This can't be done in the current state, which may have changed. Check it and try again.";
const MESSAGE_GONE =
  "This no longer exists, or you no longer have access to it.";
const MESSAGE_NOT_ACCEPTED = "Sentinel didn't accept this request.";
const MESSAGE_UNCONFIRMED =
  "Sentinel didn't confirm this change. It may have taken effect: check before trying again.";
const MESSAGE_UNAVAILABLE =
  "Sentinel isn't available right now. Try again later.";
const MESSAGE_INVALID = "This value isn't valid.";

// What the field of the vector says of itself, which assistive technologies
// read with it before its error.
const VECTOR_DESCRIPTION =
  "The metrics write it, and a vector entered here chooses them.";

// What the tab of a version of which SUSE has an assessment says in Add.
const TAKEN_V31 =
  "SUSE already has a CVSS v3.1 assessment: Edit in its row of the table changes it.";

// What the tooltip of the default CVSS version says.
const DEFAULT_VERSION_TEXT =
  "The default CVSS version: its SUSE assessment also sets the eligibility score of the Products.";

// The SUSE CVSS v3.1 assessment of fictionalSuseAssessment, Medium 5.5, and
// NVD's of fictionalAssessment, High 8.1.
const SUSE_V31 = fictionalSuseAssessment();
const NVD_V31 = fictionalAssessment();

// A CNA's CVSS v3.1 assessment, High 7.5.
const CNA_V31 = fictionalAssessment({
  id: "00000000-0000-0000-0000-0000000000d5",
  provider_name: "Fictional CNA",
  score: 7.5,
  severity: "high",
  vector_string: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H",
  metrics: {
    attack_vector: "network",
    attack_complexity: "low",
    privileges_required: "none",
    user_interaction: "none",
    scope: "unchanged",
    confidentiality_impact: "none",
    integrity_impact: "none",
    availability_impact: "high",
  },
});

// The SUSE CVSS v4.0 assessment, Medium 6.9.
const SUSE_V40: CVSS40Assessment = {
  ...NVD_V40,
  id: "00000000-0000-0000-0000-0000000000d6",
  provider_name: "SUSE",
  score: 6.9,
  severity: "medium",
  vector_string:
    "CVSS:4.0/AV:L/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N",
  metrics: {
    attack_vector: "local",
    attack_complexity: "low",
    attack_requirements: "none",
    privileges_required: "low",
    user_interaction: "none",
    vulnerable_system_confidentiality: "high",
    vulnerable_system_integrity: "none",
    vulnerable_system_availability: "none",
    subsequent_system_confidentiality: "none",
    subsequent_system_integrity: "none",
    subsequent_system_availability: "none",
  },
  created_at: "2099-10-09T15:00:00Z",
  updated_at: "2099-10-09T15:00:00Z",
};

// SUSE assessments of the versions that the screen shows read-only, v3.0
// and v2.0.
const SUSE_V30: CVSS30Assessment = {
  ...fictionalSuseAssessment(),
  id: "00000000-0000-0000-0000-0000000000d7",
  cvss_version: "3.0",
  vector_string: "CVSS:3.0/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
};
const SUSE_V20: CVSS20Assessment = {
  ...CNA_V20,
  id: "00000000-0000-0000-0000-0000000000d8",
  provider_name: "SUSE",
};

// The vectors that the user enters, of v3.1, High 7.5, and of v4.0.
const VECTOR_V31 = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H";
const VECTOR_V40 =
  "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N";

// The SUSE CVSS v3.1 assessment that Set or Update SUSE CVSS Assessment
// returns for VECTOR_V31.
const SAVED_V31 = fictionalAssessment({
  ...CNA_V31,
  id: SUSE_V31.id,
  provider_name: "SUSE",
  created_at: "2099-10-12T08:00:00Z",
  updated_at: "2099-10-12T08:00:00Z",
});

// The SUSE CVSS v4.0 assessment that Set or Update SUSE CVSS Assessment
// returns for VECTOR_V40, High 8.7.
const SAVED_V40: CVSS40Assessment = {
  ...SUSE_V40,
  score: 8.7,
  severity: "high",
  vector_string: VECTOR_V40,
  metrics: {
    ...NVD_V40.metrics,
    vulnerable_system_confidentiality: "none",
    vulnerable_system_integrity: "none",
  },
  created_at: "2099-10-12T08:00:00Z",
  updated_at: "2099-10-12T08:00:00Z",
};

// The metrics of each version, as their controls are named, in their order.
const METRICS_V31 = [
  "Attack vector",
  "Attack complexity",
  "Privileges required",
  "User interaction",
  "Scope",
  "Confidentiality",
  "Integrity",
  "Availability",
] as const;
const METRICS_V40 = [
  "Attack vector",
  "Attack complexity",
  "Attack requirements",
  "Privileges required",
  "User interaction",
  "Confidentiality Vulnerable system",
  "Integrity Vulnerable system",
  "Availability Vulnerable system",
  "Confidentiality Subsequent system",
  "Integrity Subsequent system",
  "Availability Subsequent system",
] as const;

// The consequence of Delete, with what it adds for the assessment of the
// default CVSS version, and for the last SUSE assessment of an Analyzed or
// Resolved Ticket, then its last sentence.
const DELETE_CONSEQUENCE =
  "Sentinel calculates the severity of the CVE again from the other assessments, and the eligibility of the Products, which can change the priority and the deadlines of the Ticket.";
function fallbackSentence(version: string): string {
  return ` Without a SUSE CVSS v${version} assessment, the eligibility score of the Products is the fallback 10.0.`;
}
const RETURNS_TO_ANALYSIS =
  " As the last SUSE assessment of the CVE, it also returns the Ticket to Analysis.";
const CANNOT_BE_UNDONE = " This can't be undone.";

// The CVSS assessments of CVE-2099-0012, in the order of the API, by version,
// then by provider, with the default CVSS version.
function assessmentsWith(
  assessments: CVSSAssessmentItem[],
  defaultVersion: CVECVSSAssessments["default_cvss_version"] = "3.1",
): CVECVSSAssessments {
  return fictionalCvssAssessments({
    assessments,
    default_cvss_version: defaultVersion,
  });
}

// What Calculate CVSS Base Score returns for a vector: a fictional score and
// severity, 5.5 and medium unless the test says otherwise, of the version of
// its prefix, with fictional metrics of that version, those of CNA_V31 and
// NVD_V40.
function baseScoreOf(
  vector: string,
  score = 5.5,
  severity: CVSSAssessmentSeverity = "medium",
): CVSSBaseScore {
  return vector.startsWith("CVSS:4.0/")
    ? {
        cvss_version: "4.0",
        score,
        severity,
        vector_string: vector,
        metrics: NVD_V40.metrics,
      }
    : {
        cvss_version: "3.1",
        score,
        severity,
        vector_string: vector,
        metrics: CNA_V31.metrics,
      };
}

// Calculate CVSS Base Score's response for a vector (baseScoreOf).
function baseScoreResponse(
  vector: string,
  score?: number,
  severity?: CVSSAssessmentSeverity,
): Response {
  const body: CVSSBaseScoreResponse = {
    data: baseScoreOf(vector, score, severity),
  };
  return jsonResponse(200, body);
}

// The response of Set or Update SUSE CVSS Assessment: 201 for an assessment
// that it created, 200 for one that it updated.
function suseResponse(
  assessment: CVSSAssessmentItem,
  status: 200 | 201 = 200,
): Response {
  const body: CVSSAssessmentResponse = { data: assessment };
  return jsonResponse(status, body);
}

// Answers as stubTicket does, for an analyst who manages the CVSS
// assessments unless the test says otherwise, and answers the read of the
// CVSS assessments with what read returns at the time.
function stubSuse(read: () => object, fields: Partial<Stub> = {}) {
  return stubTicket({
    user: ASSESSOR,
    cvss: () => jsonResponse(200, { data: read() }),
    ...fields,
  });
}

// Get Ticket's response with SNTL-12 in the status.
function ticketIn(status: string) {
  return () =>
    jsonResponse(200, { data: { ...fictionalTicketDetail(), status } });
}

// Renders the screen of SNTL-12 and waits until it shows the table of the
// CVSS assessments.
async function renderSuse(path = "/tickets/SNTL-12") {
  const rendered = await renderApp(path);
  await expect
    .element(
      cvssPart(rendered.screen).getByRole("grid", {
        name: "CVSS assessments",
      }),
    )
    .toBeVisible();
  return rendered;
}

function screenHeading(screen: Screen) {
  return screen.getByRole("heading", {
    level: 1,
    name: "SNTL-12",
    exact: true,
  });
}

function addSuse(screen: Screen) {
  return cvssPart(screen).getByRole("button", {
    name: "Add SUSE assessment",
    exact: true,
  });
}

function editSuse(screen: Screen, version = "3.1") {
  return cvssPart(screen).getByRole("button", {
    name: `Edit SUSE assessment v${version}`,
    exact: true,
  });
}

function deleteSuse(screen: Screen, version = "3.1") {
  return cvssPart(screen).getByRole("button", {
    name: `Delete SUSE assessment v${version}`,
    exact: true,
  });
}

// The buttons of the table that change the SUSE assessment.
function rowActions(screen: Screen): (string | null)[] {
  return cvssPart(screen)
    .getByRole("grid", { name: "CVSS assessments" })
    .getByRole("button", { name: /^(Edit|Delete) SUSE assessment/ })
    .elements()
    .map((button) => button.getAttribute("aria-label"));
}

// The row of an assessment, which its provider and its version name.
function assessmentRow(screen: Screen, provider: string, version: string) {
  return cvssPart(screen).getByRole("row", {
    name: `${provider} v${version}`,
    exact: true,
  });
}

function suseDialog(screen: Screen, name = "Add SUSE assessment") {
  return screen.getByRole("dialog", { name, exact: true });
}

// The tab of the version that is the default one, named by its label and the
// name of its mark.
function markedTab(dialog: Locator, version: string) {
  return dialog.getByRole("tab", {
    name: `CVSS v${version}, the default version`,
    exact: true,
  });
}

// The tab of a version, whether it is the default one or not.
function versionTab(dialog: Locator, version: string) {
  return dialog.getByRole("tab", {
    name: new RegExp(
      `^CVSS v${version.replace(".", "\\.")}(, the default version)?$`,
    ),
  });
}

function vectorOf(dialog: Locator) {
  return dialog.getByRole("textbox", { name: "Vector", exact: true });
}

// The select of Start from, named by the option that it shows and its label,
// "Start from (optional)" in Add and "Start from" in Edit.
function startFromOf(dialog: Locator) {
  return dialog.getByRole("button", { name: /Start from( \(optional\))?$/ });
}

function submitOf(dialog: Locator, label = "Add SUSE assessment") {
  return dialog.getByRole("button", { name: label, exact: true });
}

function metricOf(dialog: Locator, name: string) {
  return dialog.getByRole("radiogroup", { name, exact: true });
}

function segmentOf(dialog: Locator, metric: string, value: string) {
  return metricOf(dialog, metric).getByRole("radio", {
    name: value,
    exact: true,
  });
}

// The value chosen of each metric, or null for a metric without a choice.
function choicesOf(dialog: Locator, metrics: readonly string[]) {
  return metrics.map(
    (name) =>
      metricOf(dialog, name).getByRole("radio", { checked: true }).query()
        ?.textContent ?? null,
  );
}

// Opens Add SUSE assessment and waits until it shows the tab that it opens
// on.
async function openSuseAdd(screen: Screen) {
  await addSuse(screen).click();
  const dialog = suseDialog(screen);
  await expect
    .element(dialog.getByRole("tab", { selected: true }))
    .toBeVisible();
  return dialog;
}

// Opens Edit of the SUSE assessment of the version and waits until its first
// field, Start from, has the focus.
async function openSuseEdit(screen: Screen, version = "3.1") {
  await editSuse(screen, version).click();
  const dialog = suseDialog(screen, `Edit SUSE assessment v${version}`);
  await expect.element(startFromOf(dialog)).toHaveFocus();
  return dialog;
}

// Enters VECTOR_V31 in the tab of v3.1 of Add, on which it opens, and
// VECTOR_V40 in that of v4.0, then returns to the tab of v3.1.
async function enterInBothTabs(dialog: Locator) {
  await vectorOf(dialog).fill(VECTOR_V31);
  await versionTab(dialog, "4.0").click();
  await expect.element(vectorOf(dialog)).toHaveValue("");
  await vectorOf(dialog).fill(VECTOR_V40);
  await versionTab(dialog, "3.1").click();
  await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
}

// The marks of the severities in the light theme (docs/design-system.md,
// Severity Marks).
const MARK_HIGH = "rgb(247, 107, 21)";
const MARK_MEDIUM = "rgb(245, 196, 0)";

// The color of the mark of the severity that an element shows, a dot that is
// hidden from assistive technologies, or undefined without one.
function markOf(element: Element): string | undefined {
  const dot = element.querySelector('svg[aria-hidden="true"] circle');
  return dot === null ? undefined : getComputedStyle(dot).fill;
}

// The element of a dialog that scrolls its content, the nearest one around
// the element that scrolls.
function contentScrollerOf(element: Element): Element {
  for (
    let current = element.parentElement;
    current !== null;
    current = current.parentElement
  ) {
    if (getComputedStyle(current).overflowY === "auto") {
      return current;
    }
  }
  throw new Error("No element around it scrolls");
}

// Opens the options of Start from, and returns them.
async function openStartFrom(dialog: Locator) {
  await startFromOf(dialog).click();
  const options = page.getByRole("listbox", {
    name: /^Start from( \(optional\))?$/,
  });
  await expect.element(options).toBeVisible();
  return options;
}

function deleteConfirmation(screen: Screen, version = "3.1") {
  return screen.getByRole("dialog", {
    name: `Delete SUSE assessment v${version}?`,
    exact: true,
  });
}

// Opens the confirmation of Delete of the SUSE assessment of the version and
// confirms it.
async function confirmDelete(screen: Screen, version = "3.1") {
  await deleteSuse(screen, version).click();
  const confirmation = deleteConfirmation(screen, version);
  await expect
    .element(confirmation.getByRole("button", { name: "Cancel" }))
    .toHaveFocus();
  await confirmation
    .getByRole("button", { name: "Delete SUSE assessment", exact: true })
    .click();
  return confirmation;
}

// What the status regions of the CVSS assessments say, other than nothing.
function cvssAnnouncements(screen: Screen): string[] {
  return cvssPart(screen)
    .getByRole("status")
    .elements()
    .map((region) => region.textContent ?? "")
    .filter((text) => text !== "");
}

// The requests of the CVSS assessments and of the changes of the SUSE
// assessment, in their order, each as its method and its path.
function assessmentRequests(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input, init]) => ({
      method: init?.method ?? "GET",
      path: urlOf(input).pathname,
    }))
    .filter(({ path }) => path.startsWith(CVSS))
    .map(({ method, path }) => `${method} ${path}`);
}

// Whether every read of the path that the query client holds for a screen
// that no longer shows it, such as a screen that the user left, is to be
// read again, which that screen does once it shows again.
function leftInvalidated(path: string): boolean {
  const queries = client
    .getQueryCache()
    .findAll({ queryKey: [path], type: "inactive" });
  return (
    queries.length > 0 && queries.every((query) => query.state.isInvalidated)
  );
}

// Waits until the error at the top of a dialog holds the focus, which it
// takes once it has shown, in a render after the response.
async function expectFocusOnError(error: Locator) {
  await expect
    .poll(() =>
      error.element().closest("[tabindex]")?.contains(document.activeElement),
    )
    .toBe(true);
}

// Waits until the browser has rendered more frames than the part waits at
// most for a row to leave the table before it moves the focus, after which
// the focus has settled.
async function frames() {
  for (let frame = 0; frame < 15; frame += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
}

// Waits until the element has the focus, and checks that it keeps it once the
// table has settled, as React Aria's table moves the focus itself.
async function expectFocusSettledOn(locator: Locator) {
  await expect.element(locator).toHaveFocus();
  await frames();
  expect(document.activeElement).toBe(locator.element());
}

// Gives a control of a row the focus as a press of the pointer does, so that
// React Aria's table records the cell that holds it.
async function focusInRow(screen: Screen, control: Locator) {
  await screenHeading(screen).click();
  control.element().focus();
  await expect.element(control).toHaveFocus();
}

type Router = Awaited<ReturnType<typeof renderApp>>["router"];

// Leaves for Ticket list, while the change is in progress.
async function leaveForTickets(router: Router, screen: Screen) {
  await router.navigate({ to: "/tickets" });
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
    .toBeVisible();
}

// Opens Edit of the SUSE assessment of v3.1 and saves VECTOR_V31.
async function editToV31(screen: Screen) {
  const dialog = await openSuseEdit(screen);
  await vectorOf(dialog).fill(VECTOR_V31);
  await submitOf(dialog, "Save").click();
}

// Deletes an assessment among others, and waits until the read after it
// has taken its row away from the table and its outcome is announced.
async function deleteSuseAmong(before: CVSSAssessmentItem[], version: string) {
  let assessments = assessmentsWith(before);
  stubSuse(() => assessments, {
    deleteSuse: () => {
      assessments = assessmentsWith(
        before.filter(
          (item) =>
            item.provider_name !== "SUSE" || item.cvss_version !== version,
        ),
      );
      return new Response(null, { status: 204 });
    },
  });
  const { screen } = await renderSuse();

  await confirmDelete(screen, version);

  await expect
    .element(assessmentRow(screen, "SUSE", version))
    .not.toBeInTheDocument();
  await expect
    .poll(() => cvssAnnouncements(screen))
    .toEqual([`SUSE assessment v${version} deleted.`]);
  return { screen };
}

// The place of the Base score in the dialog, a status region named after
// it, since Add has another one.
function scorePlaceOf(dialog: Locator) {
  return dialog.getByRole("status", { name: "Base score", exact: true });
}

// What an element says to assistive technologies: its text without what it
// hides from them.
function spokenOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const texts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.parentElement?.closest('[aria-hidden="true"]') === null) {
      texts.push(node.textContent ?? "");
    }
  }
  return texts.join("");
}

// What the place of the score shows that assistive technologies do not
// read, each text with its color.
function seenOf(place: Locator): [string, string][] {
  const walker = document.createTreeWalker(
    place.element(),
    NodeFilter.SHOW_TEXT,
  );
  const texts: [string, string][] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent !== null && parent.closest('[aria-hidden="true"]') !== null) {
      texts.push([node.textContent ?? "", colorOf(parent)]);
    }
  }
  return texts;
}

// What the place of the score of the dialog says to assistive technologies.
function scoreSaid(dialog: Locator): string {
  return spokenOf(scorePlaceOf(dialog).element());
}

// Records what the place of the score says to assistive technologies after
// each change of the dialog, until stop, so that a test sees an outcome
// that shows for one render alone.
function recordScore(dialog: Locator) {
  const said: string[] = [];
  const observer = new MutationObserver(() => {
    const place = scorePlaceOf(dialog).query();
    said.push(place === null ? "" : spokenOf(place));
  });
  observer.observe(dialog.element(), {
    subtree: true,
    childList: true,
    characterData: true,
  });
  return {
    said,
    stop: () => {
      observer.disconnect();
    },
  };
}

// Calculate CVSS Base Score's response for every vector: High 6.1.
function highScore(query: URLSearchParams): Response {
  return baseScoreResponse(query.get("vector_string") ?? "", 6.1, "high");
}

// Its response as Sentinel rejects a vector with a Temporal metric, 422
// CVSS_INVALID_VECTOR, and High 6.1 for every other vector.
function rejectingTemporal(query: URLSearchParams): Response {
  const vector = query.get("vector_string") ?? "";
  return vector.includes("/E:")
    ? errorResponse(422, "CVSS_INVALID_VECTOR")
    : baseScoreResponse(vector, 6.1, "high");
}

// The vectors of the reads of the Base score, in their order.
function scoreReads(spy: ReturnType<typeof stubApi>): (string | null)[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname === BASE_SCORE)
    .map((url) => url.searchParams.get("vector_string"));
}

// Waits until no read is in progress and the screen shows the outcome of
// each, before a test fakes the clock, on which TanStack Query gives the
// screen the outcome of a read (readEnded).
async function readsEnded() {
  await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("the SUSE assessment", () => {
  describe("its actions", () => {
    test("offer Edit and Delete at the end of the rows of the SUSE assessments of v3.1 and v4.0 alone, named after their version, and no Add SUSE assessment while SUSE has both", async () => {
      stubSuse(() =>
        assessmentsWith([
          NVD_V40,
          SUSE_V40,
          NVD_V31,
          SUSE_V31,
          SUSE_V30,
          SUSE_V20,
        ]),
      );
      const { screen } = await renderSuse();

      expect(rowActions(screen)).toEqual([
        "Edit SUSE assessment v4.0",
        "Delete SUSE assessment v4.0",
        "Edit SUSE assessment v3.1",
        "Delete SUSE assessment v3.1",
      ]);
      for (const [provider, version] of [
        ["NVD", "4.0"],
        ["NVD", "3.1"],
        ["SUSE", "3.0"],
        ["SUSE", "2.0"],
      ] as const) {
        expect(
          assessmentRow(screen, provider, version)
            .getByRole("button", { name: /SUSE assessment/ })
            .elements(),
        ).toEqual([]);
      }
      expect(addSuse(screen).query()).toBeNull();
    });

    test("offer neither Edit nor Delete on a SUSE assessment of a version that the pinned contract does not list", async () => {
      stubSuse(() => ({
        ...assessmentsWith([]),
        assessments: [
          {
            ...SUSE_V40,
            id: "00000000-0000-0000-0000-0000000000d9",
            cvss_version: "5.0",
            vector_string: "CVSS:5.0/AV:L",
          },
          NVD_V31,
          SUSE_V31,
        ],
      }));
      const { screen } = await renderSuse();

      await expect
        .element(
          cvssPart(screen).getByRole("row", { name: "SUSE 5.0", exact: true }),
        )
        .toBeVisible();
      expect(rowActions(screen)).toEqual([
        "Edit SUSE assessment v3.1",
        "Delete SUSE assessment v3.1",
      ]);
      expect(
        cvssPart(screen)
          .getByRole("row", { name: "SUSE 5.0", exact: true })
          .getByRole("button", { name: /SUSE assessment/ })
          .elements(),
      ).toEqual([]);
      // SUSE has no assessment of v4.0 that the screen changes.
      await expect.element(addSuse(screen)).toBeVisible();
    });

    test.each([
      ["no SUSE assessment", [NVD_V40, NVD_V31]],
      ["a SUSE assessment of v3.1 alone", [NVD_V31, SUSE_V31]],
      ["a SUSE assessment of v4.0 alone", [SUSE_V40, NVD_V31]],
      [
        "SUSE assessments of the versions that it shows read-only",
        [NVD_V31, SUSE_V30, SUSE_V20],
      ],
    ])(
      "offer Add SUSE assessment at the end of the line of the heading with %s",
      async (_, assessments) => {
        stubSuse(() => assessmentsWith(assessments));
        const { screen } = await renderSuse();

        await expect.element(addSuse(screen)).toBeVisible();
        const heading = cvssPart(screen)
          .getByRole("heading", { level: 2, name: "CVSS assessments" })
          .element()
          .getBoundingClientRect();
        const add = addSuse(screen).element().getBoundingClientRect();
        expect(add.left).toBeGreaterThan(heading.right);
        expect(add.top).toBeLessThan(heading.bottom);
      },
    );

    test.each(["new", "analysis", "analyzed", "resolved"])(
      "are offered on a Ticket in %s",
      async (status) => {
        stubSuse(() => fictionalCvssAssessments(), {
          ticket: ticketIn(status),
        });
        const { screen } = await renderSuse();

        await expect.element(addSuse(screen)).toBeVisible();
        expect(rowActions(screen)).toEqual([
          "Edit SUSE assessment v3.1",
          "Delete SUSE assessment v3.1",
        ]);
      },
    );

    test.each<[string, CurrentUserResponse, () => Response]>([
      [
        "to a user who does not manage the CVSS assessments",
        OTHER_USER,
        ticketIn("analyzed"),
      ],
      ["on an Ignored Ticket", ASSESSOR, ticketIn("ignored")],
      [
        "on a Duplicated Ticket",
        ASSESSOR,
        () =>
          ticketResponse(
            fictionalTicketDetail({
              status: "duplicated",
              duplicate_of_ticket_id: "SNTL-1",
            }),
          ),
      ],
      [
        "on a Ticket in a status that the pinned contract does not list",
        ASSESSOR,
        ticketIn("fictional_status"),
      ],
    ])(
      "are not offered %s, nor the column of the actions",
      async (_, user, ticket) => {
        stubSuse(() => assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]), {
          user,
          ticket,
        });
        const { screen } = await renderSuse();

        expect(
          cvssPart(screen)
            .getByRole("columnheader")
            .elements()
            .map((header) => header.textContent),
        ).toEqual(["Provider", "Version", "Base score", "Vector"]);
        expect(rowActions(screen)).toEqual([]);
        expect(addSuse(screen).query()).toBeNull();
      },
    );

    test.each([
      ["Edit", editSuse],
      ["Delete", deleteSuse],
    ] as const)(
      "show %s alone in the tooltip of the action",
      async (action, buttonOf) => {
        stubSuse(() => fictionalCvssAssessments());
        const { screen } = await renderSuse();
        // React Aria shows a tooltip on hover only once the user works with
        // a pointer, as a click shows.
        await screenHeading(screen).click();

        await userEvent.hover(buttonOf(screen));

        const tooltip = page.getByRole("tooltip");
        await expect.element(tooltip).toBeVisible();
        expect(tooltip.element().textContent).toBe(action);
      },
    );

    // React Aria's table makes a cell a tab stop once a control in it has
    // had the focus, and so a target of its own, which needs 24 px beside
    // the buttons of the actions (WCAG 2.5.8, Target Size (Minimum)).
    test.each([1280, 320])(
      "leave the cells of the vector and of the actions 24 px of their own beside their buttons, at %i CSS pixels",
      async (width) => {
        await page.viewport(width, 800);
        stubSuse(() => assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]));
        const { screen } = await renderSuse();
        const row = assessmentRow(screen, "SUSE", "3.1");
        const cellOf = (button: string) =>
          row.getByRole("gridcell").filter({
            has: page.getByRole("button", { name: button, exact: true }),
          });
        const vector = row.getByRole("button", {
          name: SUSE_V31.vector_string,
          exact: true,
        });
        await expect.element(vector).toBeVisible();

        expect(
          boxOf(cellOf(SUSE_V31.vector_string)).right - boxOf(vector).right,
        ).toBeGreaterThanOrEqual(24);
        expect(
          boxOf(editSuse(screen)).left -
            boxOf(cellOf("Edit SUSE assessment v3.1")).left,
        ).toBeGreaterThanOrEqual(24);
      },
    );

    test("offer Add SUSE assessment only once the read of the assessments has arrived", async () => {
      const response = later();
      stubSuse(() => fictionalCvssAssessments(), {
        cvss: () => response.promise,
      });
      const { screen } = await renderTree();
      await expect
        .element(cvssPart(screen).getByRole("progressbar", { name: "Loading" }))
        .toBeVisible();
      expect(addSuse(screen).query()).toBeNull();

      response.resolve(cvssResponse());

      await expect.element(addSuse(screen)).toBeVisible();
    });

    test("offer no Add SUSE assessment after the read of the assessments failed", async () => {
      stubSuse(() => fictionalCvssAssessments(), {
        cvss: () => errorResponse(404, "CVE_NOT_FOUND"),
      });
      const { screen } = await renderTree();

      await expect
        .element(cvssPart(screen).getByText(MESSAGE_GONE))
        .toBeVisible();
      expect(addSuse(screen).query()).toBeNull();
    });

    test("offer Add SUSE assessment no more once a new read of the assessments fails with a 404, whose error the part shows", async () => {
      let fails = false;
      stubSuse(() => fictionalCvssAssessments(), {
        cvss: () =>
          fails ? errorResponse(404, "CVE_NOT_FOUND") : cvssResponse(),
      });
      const { screen } = await renderSuse();
      await expect.element(addSuse(screen)).toBeVisible();
      // Meanwhile Sentinel no longer finds the CVE.
      fails = true;

      await returnToForeground();

      await expect
        .element(cvssPart(screen).getByText(MESSAGE_GONE))
        .toBeVisible();
      expect(addSuse(screen).query()).toBeNull();
    });
  });

  describe("Add SUSE assessment", () => {
    test("opens a dialog 880 px wide, with the tabs of the versions, the default one marked and described, then Cancel and Add SUSE assessment", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();

      const dialog = await openSuseAdd(screen);

      expect(dialog.element().getBoundingClientRect().width).toBe(880);
      await expect
        .element(dialog.getByRole("tablist", { name: "CVSS version" }))
        .toBeVisible();
      const marked = markedTab(dialog, "3.1");
      await expect
        .element(marked)
        .toHaveAccessibleDescription(DEFAULT_VERSION_TEXT);
      const other = dialog.getByRole("tab", {
        name: "CVSS v4.0",
        exact: true,
      });
      await expect.element(other).not.toHaveAccessibleDescription();
      expect(dialog.getByRole("tab").elements()).toEqual([
        marked.element(),
        other.element(),
      ]);
      expect(
        dialog
          .getByRole("button")
          .elements()
          .slice(-2)
          .map((button) => button.textContent),
      ).toEqual(["Cancel", "Add SUSE assessment"]);
    });

    test.each<
      [
        string,
        CVSSAssessmentItem[],
        CVECVSSAssessments["default_cvss_version"],
        string,
      ]
    >([
      [
        "the default version v3.1, which SUSE lacks",
        [NVD_V40, NVD_V31],
        "3.1",
        "3.1",
      ],
      [
        "the default version v4.0, which SUSE lacks",
        [NVD_V40, NVD_V31],
        "4.0",
        "4.0",
      ],
      [
        "v4.0 when SUSE has the default version v3.1",
        [NVD_V31, SUSE_V31],
        "3.1",
        "4.0",
      ],
      [
        "v3.1 when SUSE has the default version v4.0",
        [SUSE_V40, NVD_V31],
        "4.0",
        "3.1",
      ],
    ])("opens on %s", async (_, assessments, defaultVersion, opened) => {
      stubSuse(() => assessmentsWith(assessments, defaultVersion));
      const { screen } = await renderSuse();

      await addSuse(screen).click();

      const dialog = suseDialog(screen);
      await expect
        .element(versionTab(dialog, opened))
        .toHaveAttribute("aria-selected", "true");
      await expect.element(markedTab(dialog, defaultVersion)).toBeVisible();
      await expect.element(vectorOf(dialog)).toHaveValue("");
    });

    test.each<
      [
        string,
        CVSSAssessmentItem[],
        (screen: Screen) => Promise<void>,
        (screen: Screen) => Locator,
      ]
    >([
      [
        "Start from in Add, opened with the pointer",
        [NVD_V40, NVD_V31],
        async (screen) => {
          await addSuse(screen).click();
        },
        (screen) => startFromOf(suseDialog(screen)),
      ],
      [
        "Start from in Add, opened from the keyboard",
        [NVD_V40, NVD_V31],
        async (screen) => {
          await press(addSuse(screen));
        },
        (screen) => startFromOf(suseDialog(screen)),
      ],
      [
        "the first segment in Add without Start from",
        [NVD_V31, SUSE_V31],
        async (screen) => {
          await addSuse(screen).click();
        },
        (screen) => segmentOf(suseDialog(screen), "Attack vector", "Physical"),
      ],
      [
        "Start from in Edit",
        [NVD_V31, SUSE_V31],
        async (screen) => {
          await editSuse(screen).click();
        },
        (screen) =>
          startFromOf(suseDialog(screen, "Edit SUSE assessment v3.1")),
      ],
    ])(
      "gives the focus to the first field of its form as it opens: %s",
      async (_, assessments, open, field) => {
        stubSuse(() => assessmentsWith(assessments));
        const { screen } = await renderSuse();

        await open(screen);

        await expectFocusSettledOn(field(screen));
      },
    );

    test("leaves the focus on a tab that the user opens, with the pointer or the keyboard, rather than moving it into its form", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect.element(startFromOf(dialog)).toHaveFocus();

      await versionTab(dialog, "4.0").click();

      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");
      await expect
        .element(metricOf(dialog, "Attack requirements"))
        .toBeVisible();
      await expectFocusSettledOn(versionTab(dialog, "4.0"));

      await userEvent.keyboard("{ArrowLeft}");
      await expect.element(versionTab(dialog, "3.1")).toHaveFocus();
      await userEvent.keyboard("{Enter}");

      await expect
        .element(versionTab(dialog, "3.1"))
        .toHaveAttribute("aria-selected", "true");
      await expect.element(metricOf(dialog, "Scope")).toBeVisible();
      await expectFocusSettledOn(versionTab(dialog, "3.1"));
    });

    test("leaves the focus on the tab of a version that SUSE has as the user opens it from its form, without moving it through the line that says so", async () => {
      stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect
        .element(segmentOf(dialog, "Attack vector", "Physical"))
        .toHaveFocus();
      // What takes the focus, which assistive technologies announce.
      const focused: Element[] = [];
      dialog.element().addEventListener("focusin", (event) => {
        if (event.target instanceof Element) {
          focused.push(event.target);
        }
      });

      await versionTab(dialog, "3.1").click();

      const line = dialog.getByText(TAKEN_V31, { exact: true });
      await expect.element(line).toBeVisible();
      await expectFocusSettledOn(versionTab(dialog, "3.1"));
      expect(focused).toEqual([versionTab(dialog, "3.1").element()]);
    });

    test("marks no tab when the default version is one that the pinned contract does not list", async () => {
      stubSuse(() => ({
        ...assessmentsWith([NVD_V31]),
        default_cvss_version: "5.0",
      }));
      const { screen } = await renderSuse();

      const dialog = await openSuseAdd(screen);

      for (const name of ["CVSS v3.1", "CVSS v4.0"]) {
        const tab = dialog.getByRole("tab", { name, exact: true });
        await expect.element(tab).toBeVisible();
        await expect.element(tab).not.toHaveAccessibleDescription();
      }
      await expect
        .element(dialog.getByRole("tab", { name: "CVSS v3.1", exact: true }))
        .toHaveAttribute("aria-selected", "true");
    });

    test("says in the tab of a version that SUSE has that Edit in its row changes it, with Add SUSE assessment disabled", async () => {
      stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");

      await versionTab(dialog, "3.1").click();

      await expect
        .element(dialog.getByText(TAKEN_V31, { exact: true }))
        .toBeVisible();
      expect(vectorOf(dialog).query()).toBeNull();
      await expect.element(submitOf(dialog)).toBeDisabled();

      await versionTab(dialog, "4.0").click();

      await expect.element(vectorOf(dialog)).toBeVisible();
      await expect.element(submitOf(dialog)).toBeEnabled();
    });

    test("keeps the input of each tab while the user moves between them", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await vectorOf(dialog).fill(VECTOR_V31);
      await versionTab(dialog, "4.0").click();
      await expect.element(vectorOf(dialog)).toHaveValue("");
      await segmentOf(dialog, "Attack requirements", "Present").click();
      await expect.element(vectorOf(dialog)).toHaveValue("CVSS:4.0/AT:P");

      await versionTab(dialog, "3.1").click();
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
      await expect
        .element(segmentOf(dialog, "Availability", "High"))
        .toBeChecked();

      await versionTab(dialog, "4.0").click();
      await expect.element(vectorOf(dialog)).toHaveValue("CVSS:4.0/AT:P");
      await expect
        .element(segmentOf(dialog, "Attack requirements", "Present"))
        .toBeChecked();
    });

    test("reads the assessments again, then adds the vector without its surrounding whitespace with Set or Update SUSE CVSS Assessment, closes, returns the focus to Add SUSE assessment, and announces it once the assessments are read again", async () => {
      let assessments = assessmentsWith([NVD_V40, NVD_V31]);
      const bodies: unknown[] = [];
      const spy = stubSuse(() => assessments, {
        upsertSuse: (body) => {
          bodies.push(body);
          assessments = assessmentsWith([NVD_V40, NVD_V31, SAVED_V31]);
          return suseResponse(SAVED_V31, 201);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      const before = assessmentRequests(spy).length;

      await vectorOf(dialog).fill(`  ${VECTOR_V31}  `);
      await submitOf(dialog).click();

      await expect.element(dialog).not.toBeInTheDocument();
      expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
      await expect
        .poll(() => cvssAnnouncements(screen))
        .toEqual(["SUSE assessment v3.1 added."]);
      expect(assessmentRequests(spy).slice(before)).toEqual([
        `GET ${CVSS}`,
        `POST ${SUSE_ASSESSMENT}`,
        `GET ${CVSS}`,
      ]);
      await expect.element(assessmentRow(screen, "SUSE", "3.1")).toBeVisible();
      await expectFocusSettledOn(addSuse(screen));
    });

    test("stays open after Add on the tab of the other version, which holds input and which SUSE lacks by the read before Add, says above the tabs what it added in a status region, drops the input of the version added, whose tab says that SUSE has it once the read after the change arrives, keeps the focus on Add SUSE assessment, and sends nothing more", async () => {
      let added = false;
      // The read of the assessments after the change, which waits until the
      // test answers it.
      const after = later();
      const bodies: unknown[] = [];
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        cvss: () =>
          added
            ? after.promise
            : cvssResponse(assessmentsWith([NVD_V40, NVD_V31])),
        upsertSuse: (body) => {
          bodies.push(body);
          added = true;
          return suseResponse(SAVED_V31, 201);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await enterInBothTabs(dialog);
      const regions = dialog.getByRole("status").elements();
      const before = assessmentRequests(spy).length;

      await press(submitOf(dialog));

      const text = "SUSE assessment v3.1 added.";
      const message = dialog.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      // A status region that was there before it announces it.
      const region = dialog.getByRole("status").filter({ hasText: text });
      expect(regions).toContain(region.element());
      expect(region.element().textContent).toBe(text);
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
      expect(boxOf(message).bottom).toBeLessThanOrEqual(
        boxOf(dialog.getByRole("tablist", { name: "CVSS version" })).top,
      );
      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V40);
      await expectFocusSettledOn(submitOf(dialog));
      expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
      await expect
        .poll(() => assessmentRequests(spy).slice(before))
        .toEqual([`GET ${CVSS}`, `POST ${SUSE_ASSESSMENT}`, `GET ${CVSS}`]);

      await versionTab(dialog, "3.1").click();

      // Before the read after the change arrives, the tab shows its form,
      // empty.
      await expect.element(vectorOf(dialog)).toHaveValue("");
      expect(dialog.getByRole("radio", { checked: true }).elements()).toEqual(
        [],
      );
      after.resolve(
        cvssResponse(assessmentsWith([NVD_V40, NVD_V31, SAVED_V31])),
      );

      await expect
        .element(dialog.getByText(TAKEN_V31, { exact: true }))
        .toBeVisible();
      await readEnded(CVSS);
      await nextFrames();
      await expect.element(dialog).toBeVisible();
      expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
      expect(assessmentRequests(spy).slice(before)).toEqual([
        `GET ${CVSS}`,
        `POST ${SUSE_ASSESSMENT}`,
        `GET ${CVSS}`,
      ]);
      // The dialog says what it added: the part announces nothing.
      expect(cvssAnnouncements(screen)).toEqual([]);
    });

    test("stays open on the tab of the other version after Add submitted with Enter in Vector, whose form leaves with its tab, and keeps the focus on Add SUSE assessment", async () => {
      const bodies: unknown[] = [];
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        upsertSuse: (body) => {
          bodies.push(body);
          return suseResponse(SAVED_V31, 201);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await enterInBothTabs(dialog);
      vectorOf(dialog).element().focus();
      await expect.element(vectorOf(dialog)).toHaveFocus();

      await userEvent.keyboard("{Enter}");

      await expect
        .element(
          dialog.getByText("SUSE assessment v3.1 added.", { exact: true }),
        )
        .toBeVisible();
      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V40);
      await expectFocusSettledOn(submitOf(dialog));
      expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
    });

    test("adds the version of the other tab on Add again, then closes, moves the focus to the Delete of the new row once the read after it no longer shows Add SUSE assessment, and announces what it added", async () => {
      let assessments = assessmentsWith([NVD_V40, NVD_V31]);
      const bodies: unknown[] = [];
      stubSuse(() => assessments, {
        upsertSuse: (body) => {
          bodies.push(body);
          if (bodies.length === 1) {
            assessments = assessmentsWith([NVD_V40, NVD_V31, SAVED_V31]);
            return suseResponse(SAVED_V31, 201);
          }
          assessments = assessmentsWith([
            NVD_V40,
            SAVED_V40,
            NVD_V31,
            SAVED_V31,
          ]);
          return suseResponse(SAVED_V40, 201);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await enterInBothTabs(dialog);
      await submitOf(dialog).click();
      await expect
        .element(
          dialog.getByText("SUSE assessment v3.1 added.", { exact: true }),
        )
        .toBeVisible();
      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");

      await submitOf(dialog).click();

      await expect.element(dialog).not.toBeInTheDocument();
      expect(bodies).toEqual([
        { vector_string: VECTOR_V31 },
        { vector_string: VECTOR_V40 },
      ]);
      await expect
        .poll(() => cvssAnnouncements(screen))
        .toEqual(["SUSE assessment v4.0 added."]);
      await expect.element(addSuse(screen)).not.toBeInTheDocument();
      await expect.element(assessmentRow(screen, "SUSE", "4.0")).toBeVisible();
      await expect.element(assessmentRow(screen, "SUSE", "3.1")).toBeVisible();
      await expectFocusSettledOn(deleteSuse(screen, "4.0"));
    });

    test("asks Discard changes? on Cancel after an Add after which it stays open only for the input of the other tab, and closes without asking once that input is gone", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        upsertSuse: () => suseResponse(SAVED_V31, 201),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await enterInBothTabs(dialog);
      await press(submitOf(dialog));
      await expect
        .element(
          dialog.getByText("SUSE assessment v3.1 added.", { exact: true }),
        )
        .toBeVisible();
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V40);

      await dialog.getByRole("button", { name: "Cancel" }).click();

      const discard = screen.getByRole("dialog", { name: "Discard changes?" });
      await expect
        .element(
          discard.getByText(
            "The SUSE assessment that you entered isn't added.",
          ),
        )
        .toBeVisible();
      await discard.getByRole("button", { name: "Keep editing" }).click();
      await expect.element(discard).not.toBeInTheDocument();
      await vectorOf(dialog).fill("");

      await dialog.getByRole("button", { name: "Cancel" }).click();

      await expect.element(dialog).not.toBeInTheDocument();
      expect(discard.query()).toBeNull();
    });

    test.each<
      [
        string,
        CVSSAssessmentItem[],
        (dialog: Locator) => Promise<void>,
        (screen: Screen) => Locator,
      ]
    >([
      [
        "the other tab holds no input",
        [],
        async (dialog) => {
          await enterInBothTabs(dialog);
          await versionTab(dialog, "4.0").click();
          await vectorOf(dialog).fill("");
          await versionTab(dialog, "3.1").click();
          await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
        },
        (screen) => addSuse(screen),
      ],
      [
        "the read before Add shows that SUSE has the version of the other tab by then",
        [SUSE_V40],
        enterInBothTabs,
        (screen) => deleteSuse(screen, "3.1"),
      ],
    ])(
      "closes after Add when %s, and announces what it added, with the focus as after every Add",
      async (_, meanwhile, enter, focused) => {
        let assessments = assessmentsWith([NVD_V40, NVD_V31]);
        const bodies: unknown[] = [];
        stubSuse(() => assessments, {
          upsertSuse: (body) => {
            bodies.push(body);
            assessments = assessmentsWith([
              NVD_V40,
              ...meanwhile,
              NVD_V31,
              SAVED_V31,
            ]);
            return suseResponse(SAVED_V31, 201);
          },
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await enter(dialog);
        // What another analyst added meanwhile.
        assessments = assessmentsWith([NVD_V40, ...meanwhile, NVD_V31]);

        await submitOf(dialog).click();

        await expect.element(dialog).not.toBeInTheDocument();
        expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
        await expect
          .poll(() => cvssAnnouncements(screen))
          .toEqual(["SUSE assessment v3.1 added."]);
        await expectFocusSettledOn(focused(screen));
      },
    );

    test("says in place of the form that SUSE has the version, with Add SUSE assessment disabled and the focus on that line, without adding it, when the read before the change shows that SUSE has it by then", async () => {
      let assessments = assessmentsWith([NVD_V40, NVD_V31]);
      const spy = stubSuse(() => assessments);
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      // Meanwhile another analyst added it.
      assessments = assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]);
      const reads = readsOf(spy, CVSS);

      await press(submitOf(dialog));

      const line = dialog.getByText(TAKEN_V31, { exact: true });
      await expect.element(line).toBeVisible();
      await expectFocusSettledOn(line);
      expect(vectorOf(dialog).query()).toBeNull();
      await expect.element(submitOf(dialog)).toBeDisabled();
      expect(
        dialog
          .getByText(
            "SUSE already has a CVSS v3.1 assessment: edit it in its row.",
          )
          .query(),
      ).toBeNull();
      expect(readsOf(spy, CVSS)).toBe(reads + 1);
      expect(requestsWith(spy, "POST")).toHaveLength(0);
    });

    test("turns the tab of a version into the line that says that SUSE has it once a read while it is open shows that SUSE has it, and keeps the form of the other tab", async () => {
      let assessments = assessmentsWith([NVD_V40, NVD_V31]);
      stubSuse(() => assessments);
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect.element(vectorOf(dialog)).toBeVisible();
      // Meanwhile another analyst added it.
      assessments = assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]);

      await returnToForeground();

      await expect
        .element(dialog.getByText(TAKEN_V31, { exact: true }))
        .toBeVisible();
      expect(vectorOf(dialog).query()).toBeNull();
      await expect.element(submitOf(dialog)).toBeDisabled();

      await versionTab(dialog, "4.0").click();

      await expect.element(vectorOf(dialog)).toBeVisible();
      await expect.element(submitOf(dialog)).toBeEnabled();
    });

    test.each([
      ["", false],
      [", also after the user has opened the other tab and come back", true],
    ])(
      "keeps the focus in the dialog, on the line that says that SUSE has the version, when a read while it is open replaces the form that holds it with that line%s",
      async (_, switched) => {
        let assessments = assessmentsWith([NVD_V40, NVD_V31]);
        stubSuse(() => assessments);
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        if (switched) {
          await versionTab(dialog, "4.0").click();
          await expect
            .element(metricOf(dialog, "Attack requirements"))
            .toBeVisible();
          await versionTab(dialog, "3.1").click();
          await expect.element(metricOf(dialog, "Scope")).toBeVisible();
        }
        await vectorOf(dialog).fill(VECTOR_V31);
        await expect.element(vectorOf(dialog)).toHaveFocus();
        assessments = assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]);

        await returnToForeground();

        const line = dialog.getByText(TAKEN_V31, { exact: true });
        await expect.element(line).toBeVisible();
        await expectFocusSettledOn(line);
      },
    );

    test("marks the default version as the read of the assessments shows it while it is open", async () => {
      let assessments = assessmentsWith([NVD_V40, NVD_V31], "3.1");
      stubSuse(() => assessments);
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect.element(markedTab(dialog, "3.1")).toBeVisible();
      // Meanwhile an administrator changed the default CVSS version.
      assessments = assessmentsWith([NVD_V40, NVD_V31], "4.0");

      await returnToForeground();

      await expect.element(markedTab(dialog, "4.0")).toBeVisible();
      await expect
        .element(markedTab(dialog, "4.0"))
        .toHaveAccessibleDescription(DEFAULT_VERSION_TEXT);
      const other = dialog.getByRole("tab", { name: "CVSS v3.1", exact: true });
      await expect.element(other).not.toHaveAccessibleDescription();
      // The version of the form stays the one that the user sees.
      await expect.element(other).toHaveAttribute("aria-selected", "true");
    });

    test("stays open with its form and its input once a new read of the assessments fails with a 404", async () => {
      let fails = false;
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        cvss: () =>
          fails
            ? errorResponse(404, "CVE_NOT_FOUND")
            : cvssResponse(assessmentsWith([NVD_V40, NVD_V31])),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      // Meanwhile Sentinel no longer finds the CVE.
      fails = true;

      await returnToForeground();

      // The part shows the error behind the dialog.
      await expect.element(screen.getByText(MESSAGE_GONE)).toBeVisible();
      await nextFrames();
      await expect.element(dialog).toBeVisible();
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
      await expect
        .element(segmentOf(dialog, "Availability", "High"))
        .toBeChecked();
      await expect.element(submitOf(dialog)).toBeEnabled();
    });

    test("shows the failure of the read before the change at the top of the form, which takes the focus and keeps the input, without adding it", async () => {
      let fails = false;
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        cvss: () =>
          fails
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : cvssResponse(assessmentsWith([NVD_V40, NVD_V31])),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      fails = true;

      await submitOf(dialog).click();

      const error = dialog.getByText(MESSAGE_UNAVAILABLE);
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES.danger);
      await expect.element(dialog.getByText(REFERENCE)).toBeVisible();
      await expectFocusOnError(error);
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
      await expect.element(vectorOf(dialog)).not.toBeInvalid();
      expect(requestsWith(spy, "POST")).toHaveLength(0);
    });

    test("is busy from the read before the change until Sentinel answers the change, sends one change, and cannot be closed meanwhile", async () => {
      const reread = later();
      const response = later();
      let submitted = false;
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        cvss: () =>
          submitted
            ? reread.promise
            : cvssResponse(assessmentsWith([NVD_V40, NVD_V31])),
        upsertSuse: () => response.promise,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      submitted = true;

      await userEvent.keyboard("{Enter}");

      const button = submitOf(dialog);
      await expect.element(button).toHaveAttribute("aria-disabled", "true");
      await expect
        .element(dialog.getByRole("button", { name: "Cancel" }))
        .toBeDisabled();
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => readsOf(spy, CVSS)).toBe(2);
      expect(requestsWith(spy, "POST")).toHaveLength(0);
      reread.resolve(cvssResponse(assessmentsWith([NVD_V40, NVD_V31])));
      await expect.poll(() => requestsWith(spy, "POST")).toHaveLength(1);
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard("{Escape}");
      await expect.element(button).toHaveAttribute("aria-disabled", "true");
      await expect.element(dialog).toBeVisible();
      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();

      response.resolve(suseResponse(SAVED_V31, 201));

      await expect.element(dialog).not.toBeInTheDocument();
      expect(requestsWith(spy, "POST")).toHaveLength(1);
    });

    test.each([
      ["with the pointer", false],
      ["from the keyboard", true],
    ])(
      "moves the focus from Add SUSE assessment to the Delete of the new row once the read after Add of the last version that SUSE lacked, pressed %s, shows the row and no longer Add SUSE assessment",
      async (_, keyboard) => {
        let assessments = assessmentsWith([SUSE_V40, NVD_V31]);
        stubSuse(() => assessments, {
          upsertSuse: () => {
            assessments = assessmentsWith([SUSE_V40, NVD_V31, SAVED_V31]);
            return suseResponse(SAVED_V31, 201);
          },
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await vectorOf(dialog).fill(VECTOR_V31);

        // The table takes a focus that enters it from the keyboard to the row
        // that it holds as focused, its first row at first.
        if (keyboard) {
          await press(submitOf(dialog));
        } else {
          await submitOf(dialog).click();
        }

        await expect.element(dialog).not.toBeInTheDocument();
        await expect.element(addSuse(screen)).not.toBeInTheDocument();
        await expect
          .element(assessmentRow(screen, "SUSE", "3.1"))
          .toBeVisible();
        await expectFocusSettledOn(deleteSuse(screen, "3.1"));
      },
    );

    test("moves the focus no more once the read after Add fails, and to the screen's heading when a later read removes Add SUSE assessment", async () => {
      let phase: "before" | "failing" | "added" = "before";
      stubSuse(() => assessmentsWith([SUSE_V40, NVD_V31]), {
        cvss: () => {
          if (phase === "failing") {
            return errorResponse(503, "DATABASE_UNAVAILABLE");
          }
          return cvssResponse(
            phase === "added"
              ? assessmentsWith([SUSE_V40, NVD_V31, SAVED_V31])
              : assessmentsWith([SUSE_V40, NVD_V31]),
          );
        },
        upsertSuse: () => {
          phase = "failing";
          return suseResponse(SAVED_V31, 201);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);

      await submitOf(dialog).click();

      await expect.element(dialog).not.toBeInTheDocument();
      await expect
        .element(cvssPart(screen).getByText(/^This couldn't be updated\./))
        .toBeVisible();
      await expectFocusSettledOn(addSuse(screen));
      // Meanwhile Sentinel shows the assessment that it added.
      phase = "added";

      await returnToForeground();

      await expect.element(addSuse(screen)).not.toBeInTheDocument();
      await expect.element(assessmentRow(screen, "SUSE", "3.1")).toBeVisible();
      await expectFocusSettledOn(screenHeading(screen));
    });

    test("hides the tooltip of the default version with Escape and stays open", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect.element(startFromOf(dialog)).toHaveFocus();

      // Back to the tab of the default version, from the keyboard.
      await userEvent.keyboard("{Shift>}{Tab}{/Shift}");

      await expect.element(markedTab(dialog, "3.1")).toHaveFocus();
      const tooltip = page.getByRole("tooltip");
      await expect.element(tooltip).toBeVisible();
      expect(tooltip.element().textContent).toBe(DEFAULT_VERSION_TEXT);
      await userEvent.keyboard("{Escape}");
      await expect.element(tooltip).not.toBeInTheDocument();
      await frames();
      await expect.element(dialog).toBeVisible();
      await expect.element(markedTab(dialog, "3.1")).toHaveFocus();

      // Without the tooltip, Escape closes the dialog.
      await userEvent.keyboard("{Escape}");

      await expect.element(dialog).not.toBeInTheDocument();
    });
  });

  describe("Start from", () => {
    test("is optional and empty as Add SUSE assessment opens, and offers the assessments of the other providers of the version alone, each by its provider, its score, and its severity with its mark", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, CNA_V31, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      const field = dialog.getByRole("button", {
        name: "Start from (optional)",
        exact: true,
      });
      await expect.element(field).toBeVisible();
      expect(field.element().textContent).toBe("");
      const optional = dialog.getByText("(optional)", { exact: true });
      expect(getComputedStyle(optional.element()).color).toBe(FG_MUTED);
      expect(getComputedStyle(optional.element()).fontWeight).toBe("400");

      const options = await openStartFrom(dialog);

      expect(
        options
          .getByRole("option")
          .elements()
          .map((option) => option.textContent),
      ).toEqual(["Fictional CNA, 7.5 High", "NVD, 8.1 High"]);
      for (const option of options.getByRole("option").elements()) {
        expect(option.getAttribute("aria-selected")).not.toBe("true");
        // The mark of the severity, which assistive technologies do not read.
        expect(markOf(option)).toBe(MARK_HIGH);
      }
      // Assistive technologies, and the keyboard, find each by its text.
      await expect
        .element(
          options.getByRole("option", { name: "NVD, 8.1 High", exact: true }),
        )
        .toBeVisible();
    });

    test("fills the vector of the assessment chosen, which chooses its metrics", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, CNA_V31, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      const options = await openStartFrom(dialog);

      await options
        .getByRole("option", { name: "NVD, 8.1 High", exact: true })
        .click();

      await expect.element(vectorOf(dialog)).toHaveValue(NVD_V31_VECTOR);
      // The field shows the option as the option shows it.
      const field = dialog.getByRole("button", {
        name: "NVD, 8.1 High Start from (optional)",
        exact: true,
      });
      await expect.element(field).toBeVisible();
      expect(field.element().textContent).toBe("NVD, 8.1 High");
      expect(markOf(field.element())).toBe(MARK_HIGH);
      expect(choicesOf(dialog, METRICS_V31)).toEqual([
        "Network",
        "High",
        "None",
        "None",
        "Unchanged",
        "High",
        "High",
        "High",
      ]);
    });

    test("is not offered without an assessment of another provider of the version", async () => {
      stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();

      const dialog = await openSuseAdd(screen);

      await expect.element(vectorOf(dialog)).toBeVisible();
      expect(startFromOf(dialog).query()).toBeNull();
    });

    test("starts in Edit, labelled Start from (optional), at the assessment as saved, and offers it before the assessments of the other providers", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      const field = dialog.getByRole("button", {
        name: "SUSE, as saved, 5.5 Medium Start from (optional)",
        exact: true,
      });
      await expect.element(field).toBeVisible();
      expect(field.element().textContent).toBe("SUSE, as saved, 5.5 Medium");
      expect(markOf(field.element())).toBe(MARK_MEDIUM);
      const optional = dialog.getByText("(optional)", { exact: true });
      await expect.element(optional).toBeVisible();
      expect(getComputedStyle(optional.element()).color).toBe(FG_MUTED);
      expect(getComputedStyle(optional.element()).fontWeight).toBe("400");
      await expect
        .element(vectorOf(dialog))
        .toHaveValue(SUSE_V31.vector_string);

      const options = await openStartFrom(dialog);
      expect(
        options
          .getByRole("option")
          .elements()
          .map((option) => option.textContent),
      ).toEqual(["SUSE, as saved, 5.5 Medium", "NVD, 8.1 High"]);
      expect(
        options
          .getByRole("option")
          .elements()
          .map((option) => markOf(option)),
      ).toEqual([MARK_MEDIUM, MARK_HIGH]);
      await options
        .getByRole("option", { name: "NVD, 8.1 High", exact: true })
        .click();
      await expect.element(vectorOf(dialog)).toHaveValue(NVD_V31_VECTOR);

      await (
        await openStartFrom(dialog)
      )
        .getByRole("option", {
          name: "SUSE, as saved, 5.5 Medium",
          exact: true,
        })
        .click();

      await expect
        .element(vectorOf(dialog))
        .toHaveValue(SUSE_V31.vector_string);
    });

    test.each<
      [
        string,
        CVSSAssessmentItem[],
        (screen: Screen) => Promise<Locator>,
        string,
        string,
        [string, string],
      ]
    >([
      [
        "the assessment as saved, as Edit opens",
        [NVD_V40, NVD_V31, SUSE_V31],
        (screen) => openSuseEdit(screen),
        "SUSE, as saved, 5.5 Medium",
        SUSE_V31.vector_string,
        ["High", "None"],
      ],
      [
        "the assessment of NVD, once chosen in Add",
        [NVD_V40, NVD_V31],
        async (screen) => {
          const dialog = await openSuseAdd(screen);
          await (
            await openStartFrom(dialog)
          )
            .getByRole("option", { name: "NVD, 8.1 High", exact: true })
            .click();
          return dialog;
        },
        "NVD, 8.1 High",
        NVD_V31_VECTOR,
        ["Low", "High"],
      ],
    ])(
      "shows %s while the form holds its vector, nothing once a metric changes it, and the assessment again when the user chooses it, when the metrics return to its vector, and when the user enters it with surrounding whitespace",
      async (_, assessments, open, option, vector, [changed, original]) => {
        stubSuse(() => assessmentsWith(assessments));
        const { screen } = await renderSuse();
        const dialog = await open(screen);
        const shown = dialog.getByRole("button", {
          name: `${option} Start from (optional)`,
          exact: true,
        });
        const empty = dialog.getByRole("button", {
          name: "Start from (optional)",
          exact: true,
        });
        await expect.element(shown).toBeVisible();
        await expect.element(vectorOf(dialog)).toHaveValue(vector);

        await segmentOf(dialog, "Integrity", changed).click();

        await expect.element(empty).toBeVisible();
        expect(empty.element().textContent).toBe("");
        expect(markOf(empty.element())).toBeUndefined();

        await (
          await openStartFrom(dialog)
        )
          .getByRole("option", { name: option, exact: true })
          .click();

        await expect.element(vectorOf(dialog)).toHaveValue(vector);
        await expect.element(shown).toBeVisible();
        expect(shown.element().textContent).toBe(option);
        await segmentOf(dialog, "Integrity", changed).click();
        await expect.element(empty).toBeVisible();

        await segmentOf(dialog, "Integrity", original).click();

        await expect.element(vectorOf(dialog)).toHaveValue(vector);
        await expect.element(shown).toBeVisible();
        // CNA_V31's vector, which no assessment that it offers has.
        await vectorOf(dialog).fill(VECTOR_V31);
        await expect.element(empty).toBeVisible();

        await vectorOf(dialog).fill(`  ${vector} `);

        await expect.element(shown).toBeVisible();
        expect(shown.element().textContent).toBe(option);
      },
    );

    test("shows the first of two assessments with the vector that the form holds, also once the user chooses the second", async () => {
      // An assessment of another provider with CNA_V31's vector, after it.
      const same = fictionalAssessment({
        ...CNA_V31,
        id: "00000000-0000-0000-0000-0000000000e4",
        provider_name: "Fictional Security Team",
      });
      stubSuse(() => assessmentsWith([NVD_V40, CNA_V31, same, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      const first = dialog.getByRole("button", {
        name: "Fictional CNA, 7.5 High Start from (optional)",
        exact: true,
      });

      await vectorOf(dialog).fill(VECTOR_V31);

      await expect.element(first).toBeVisible();
      expect(first.element().textContent).toBe("Fictional CNA, 7.5 High");
      const options = await openStartFrom(dialog);
      expect(
        options
          .getByRole("option")
          .elements()
          .map((option) => option.textContent),
      ).toEqual([
        "Fictional CNA, 7.5 High",
        "Fictional Security Team, 7.5 High",
        "NVD, 8.1 High",
      ]);

      await options
        .getByRole("option", {
          name: "Fictional Security Team, 7.5 High",
          exact: true,
        })
        .click();

      await expect.element(options).not.toBeInTheDocument();
      await nextFrames();
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
      expect(first.element().textContent).toBe("Fictional CNA, 7.5 High");
    });
  });

  describe("the metrics", () => {
    test.each<
      [
        string,
        CVECVSSAssessments["default_cvss_version"],
        string[],
        [string, string[]][],
      ]
    >([
      [
        "v3.1",
        "3.1",
        ["Exploitability", "Scope", "Impact"],
        [
          ["Attack vector", ["Physical", "Local", "Adjacent", "Network"]],
          ["Attack complexity", ["High", "Low"]],
          ["Privileges required", ["High", "Low", "None"]],
          ["User interaction", ["Required", "None"]],
          ["Scope", ["Unchanged", "Changed"]],
          ["Confidentiality", ["None", "Low", "High"]],
          ["Integrity", ["None", "Low", "High"]],
          ["Availability", ["None", "Low", "High"]],
        ],
      ],
      [
        "v4.0",
        "4.0",
        ["Exploitability", "Vulnerable system", "Subsequent system"],
        [
          ["Attack vector", ["Physical", "Local", "Adjacent", "Network"]],
          ["Attack complexity", ["High", "Low"]],
          ["Attack requirements", ["Present", "None"]],
          ["Privileges required", ["High", "Low", "None"]],
          ["User interaction", ["Active", "Passive", "None"]],
          ["Confidentiality Vulnerable system", ["None", "Low", "High"]],
          ["Integrity Vulnerable system", ["None", "Low", "High"]],
          ["Availability Vulnerable system", ["None", "Low", "High"]],
          ["Confidentiality Subsequent system", ["None", "Low", "High"]],
          ["Integrity Subsequent system", ["None", "Low", "High"]],
          ["Availability Subsequent system", ["None", "Low", "High"]],
        ],
      ],
    ])(
      "of %s show in the groups of the version, each metric a segmented control of its values, none chosen as Add opens, a name that repeats named with its group",
      async (_, version, groups, metrics) => {
        stubSuse(() => assessmentsWith([NVD_V40, NVD_V31], version));
        const { screen } = await renderSuse();

        const dialog = await openSuseAdd(screen);

        expect(
          dialog
            .getByRole("heading", { level: 3 })
            .elements()
            .map((heading) => heading.textContent),
        ).toEqual(groups);
        expect(dialog.getByRole("radiogroup").elements()).toEqual(
          metrics.map(([name]) => metricOf(dialog, name).element()),
        );
        for (const [name, values] of metrics) {
          expect(
            metricOf(dialog, name)
              .getByRole("radio")
              .elements()
              .map((radio) => radio.textContent),
          ).toEqual(values);
        }
        expect(dialog.getByRole("radio", { checked: true }).elements()).toEqual(
          [],
        );
      },
    );

    // The form of v3.1 with Start from, and that of v4.0 without it, as no
    // other provider has an assessment of v4.0.
    test.each<
      [number, CVECVSSAssessments["default_cvss_version"], string, string]
    >([
      [1280, "3.1", "with Start from", "Scope"],
      [320, "3.1", "with Start from", "Scope"],
      [1280, "4.0", "without Start from", "Vulnerable system"],
      [320, "4.0", "without Start from", "Vulnerable system"],
    ])(
      "stand at %i CSS pixels, for v%s %s, in two columns where the dialog is wide enough and otherwise in one, the name of each metric before its values or, in a narrow form, above them, without scrolling sideways",
      async (width, version, _, second) => {
        await page.viewport(width, 800);
        stubSuse(() => assessmentsWith([NVD_V31], version));
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        const exploitability = dialog.getByRole("heading", {
          level: 3,
          name: "Exploitability",
          exact: true,
        });
        const next = dialog.getByRole("heading", {
          level: 3,
          name: second,
          exact: true,
        });
        await expect.element(next).toBeVisible();
        // The metrics of Exploitability, the last of which is User
        // interaction.
        const firstColumn =
          version === "3.1" ? METRICS_V31.slice(0, 4) : METRICS_V40.slice(0, 5);
        const last = boxOf(metricOf(dialog, "User interaction"));
        const name = boxOf(dialog.getByText("Attack vector", { exact: true }));
        const control = boxOf(metricOf(dialog, "Attack vector"));

        if (width === 1280) {
          // The second group stands beside Exploitability, 40 px after the
          // widest control of the first column at least.
          expect(
            Math.abs(boxOf(next).top - boxOf(exploitability).top),
          ).toBeLessThan(1);
          const widest = Math.max(
            ...firstColumn.map(
              (metric) => boxOf(metricOf(dialog, metric)).right,
            ),
          );
          expect(boxOf(next).left - widest).toBeGreaterThanOrEqual(40);
          // The name stands at the start of the line of its values.
          expect(name.right).toBeLessThanOrEqual(control.left);
          expect(name.top).toBeLessThan(control.bottom);
          expect(name.bottom).toBeGreaterThan(control.top);
        } else {
          expect(boxOf(next).top).toBeGreaterThanOrEqual(last.bottom);
          expect(name.bottom).toBeLessThanOrEqual(control.top);
          expect(boxOf(dialog).right).toBeLessThanOrEqual(width);
        }
        const content = contentScrollerOf(
          metricOf(dialog, "Attack vector").element(),
        );
        expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
        expect(document.documentElement.scrollWidth).toBe(width);
      },
    );

    test("write the vector of the metrics chosen, in the order of FIRST, as the user chooses them", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await segmentOf(dialog, "Availability", "High").click();
      await expect.element(vectorOf(dialog)).toHaveValue("CVSS:3.1/A:H");
      await segmentOf(dialog, "Attack vector", "Network").click();
      await expect.element(vectorOf(dialog)).toHaveValue("CVSS:3.1/AV:N/A:H");
      await segmentOf(dialog, "Scope", "Changed").click();
      await expect
        .element(vectorOf(dialog))
        .toHaveValue("CVSS:3.1/AV:N/S:C/A:H");

      await segmentOf(dialog, "Attack vector", "Local").click();

      await expect
        .element(vectorOf(dialog))
        .toHaveValue("CVSS:3.1/AV:L/S:C/A:H");
      expect(choicesOf(dialog, METRICS_V31)).toEqual([
        "Local",
        null,
        null,
        null,
        "Changed",
        null,
        null,
        "High",
      ]);
    });

    test("write the metric of the group chosen in v4.0, whose names repeat", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31], "4.0"));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await segmentOf(
        dialog,
        "Confidentiality Subsequent system",
        "High",
      ).click();
      await expect.element(vectorOf(dialog)).toHaveValue("CVSS:4.0/SC:H");
      await segmentOf(
        dialog,
        "Confidentiality Vulnerable system",
        "Low",
      ).click();

      await expect.element(vectorOf(dialog)).toHaveValue("CVSS:4.0/VC:L/SC:H");
    });

    test("are chosen by a vector that the user enters, and by nothing of another version", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await vectorOf(dialog).fill(
        "CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:C/C:L/I:N/A:H",
      );

      await expect
        .poll(() => choicesOf(dialog, METRICS_V31))
        .toEqual([
          "Local",
          "High",
          "High",
          "Required",
          "Changed",
          "Low",
          "None",
          "High",
        ]);

      await vectorOf(dialog).fill("CVSS:3.1/AV:P/AC:L");
      await expect
        .poll(() => choicesOf(dialog, METRICS_V31))
        .toEqual(["Physical", "Low", null, null, null, null, null, null]);
      // A choice then adds to what the vector chose.
      await segmentOf(dialog, "Integrity", "Low").click();
      await expect
        .element(vectorOf(dialog))
        .toHaveValue("CVSS:3.1/AV:P/AC:L/I:L");

      await vectorOf(dialog).fill(VECTOR_V40);
      await expect
        .poll(() => dialog.getByRole("radio", { checked: true }).elements())
        .toEqual([]);
    });

    test("show below a metric whose choice differs from another provider's assessment of the version that provider's value, which describes its control, and nothing below one that matches", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, CNA_V31, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect.element(metricOf(dialog, "Attack vector")).toBeVisible();
      expect(dialog.getByText(/^(NVD|Fictional CNA): /).elements()).toEqual([]);

      await vectorOf(dialog).fill(
        "CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      );

      // Both assessments of v3.1, and not NVD's of v4.0, whose vector also
      // says AV:N.
      await expect
        .element(metricOf(dialog, "Attack vector"))
        .toHaveAccessibleDescription("Fictional CNA: Network · NVD: Network");
      await expect
        .element(metricOf(dialog, "Attack complexity"))
        .toHaveAccessibleDescription("NVD: High");
      await expect
        .element(metricOf(dialog, "Confidentiality"))
        .toHaveAccessibleDescription("Fictional CNA: None");
      for (const name of [
        "Privileges required",
        "User interaction",
        "Scope",
        "Availability",
      ]) {
        await expect
          .element(metricOf(dialog, name))
          .not.toHaveAccessibleDescription();
      }
      const note = dialog.getByText("NVD: High", { exact: true });
      expect(boxOf(note).top).toBeGreaterThanOrEqual(
        boxOf(metricOf(dialog, "Attack complexity")).bottom,
      );
    });

    test("show another provider's value below the values of its metric, where they start, in a form narrower than 320 px, without scrolling sideways", async () => {
      await page.viewport(320, 800);
      stubSuse(() => assessmentsWith([NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await vectorOf(dialog).fill(
        "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      );

      const control = metricOf(dialog, "Attack complexity");
      await expect.element(control).toHaveAccessibleDescription("NVD: High");
      const note = boxOf(dialog.getByText("NVD: High", { exact: true }));
      expect(note.top).toBeGreaterThanOrEqual(boxOf(control).bottom);
      expect(note.left).toBe(boxOf(control).left);
      const content = contentScrollerOf(control.element());
      expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
    });

    test("wrap the values of other providers below a metric within the column of the controls, which they do not widen, without scrolling sideways", async () => {
      stubSuse(() =>
        assessmentsWith([
          fictionalAssessment({
            id: "00000000-0000-0000-0000-0000000000e1",
            provider_name:
              "Fictional Coordinated Vulnerability Disclosure Program",
          }),
          fictionalAssessment({
            id: "00000000-0000-0000-0000-0000000000e2",
            provider_name: "Fictional Open Source Security Response Foundation",
            metrics: { ...NVD_V31.metrics, attack_vector: "adjacent" },
          }),
          fictionalAssessment({
            id: "00000000-0000-0000-0000-0000000000e3",
            provider_name:
              "Fictional Regional Computer Emergency Response Team",
            metrics: { ...NVD_V31.metrics, attack_vector: "local" },
          }),
        ]),
      );
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      // Physical, which none of them chooses, and their other metrics.
      await vectorOf(dialog).fill(
        "CVSS:3.1/AV:P/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
      );

      const control = metricOf(dialog, "Attack vector");
      await expect
        .element(control)
        .toHaveAccessibleDescription(
          /^Fictional Coordinated Vulnerability Disclosure Program: .+ · Fictional Open Source Security Response Foundation: .+ · Fictional Regional Computer Emergency Response Team: /,
        );
      const note = dialog.getByText(
        /^Fictional Coordinated Vulnerability Disclosure Program: /,
      );
      expect(boxOf(note).height).toBeGreaterThan(
        Number.parseFloat(getComputedStyle(note.element()).lineHeight),
      );
      // The controls of the column of Attack vector, the widest of which
      // ends where the column ends.
      const controls = METRICS_V31.slice(0, 4).map((name) =>
        boxOf(metricOf(dialog, name)),
      );
      expect(boxOf(note).left).toBe(boxOf(control).left);
      expect(boxOf(note).right).toBeLessThanOrEqual(
        Math.max(...controls.map((box) => box.right)),
      );
      const content = contentScrollerOf(control.element());
      expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
    });

    test("show no note for a value of another provider that the pinned contract does not list", async () => {
      stubSuse(() => ({
        ...assessmentsWith([]),
        assessments: [
          {
            ...NVD_V31,
            metrics: { ...NVD_V31.metrics, attack_vector: "fictional_vector" },
          },
        ],
      }));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await vectorOf(dialog).fill(
        "CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      );

      await expect
        .element(metricOf(dialog, "Attack complexity"))
        .toHaveAccessibleDescription("NVD: High");
      await expect
        .element(metricOf(dialog, "Attack vector"))
        .not.toHaveAccessibleDescription();
      expect(dialog.getByText(/^NVD: /).elements()).toHaveLength(1);
    });
  });

  describe("the checks of the vector", () => {
    test.each<[string, CVSSAssessmentItem[], string, string]>([
      [
        "an empty vector",
        [NVD_V40, NVD_V31],
        "",
        "Choose the metrics, or enter the vector.",
      ],
      [
        "a vector of whitespace alone",
        [NVD_V40, NVD_V31],
        "   ",
        "Choose the metrics, or enter the vector.",
      ],
      [
        "a vector longer than 200 characters, counted by code point",
        [NVD_V40, NVD_V31],
        `CVSS:3.1/${"😀".repeat(192)}`,
        "Enter at most 200 characters.",
      ],
      [
        "a vector of v4.0, which SUSE lacks too",
        [NVD_V40, NVD_V31],
        VECTOR_V40,
        "Enter a CVSS v3.1 vector, which starts with CVSS:3.1/.",
      ],
      [
        "a vector without a version",
        [NVD_V40, NVD_V31],
        "AV:N/AC:L/Au:N/C:P/I:P/A:P",
        "Enter a CVSS v3.1 vector, which starts with CVSS:3.1/.",
      ],
      [
        "a vector of v4.0, which SUSE has",
        [SUSE_V40, NVD_V31],
        VECTOR_V40,
        "SUSE already has a CVSS v4.0 assessment: edit it in its row.",
      ],
    ])(
      "state the error of %s in Add at the vector, which takes the focus, without a request",
      async (_, assessments, vector, message) => {
        const spy = stubSuse(() => assessmentsWith(assessments));
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await expect
          .element(versionTab(dialog, "3.1"))
          .toHaveAttribute("aria-selected", "true");
        if (vector !== "") {
          await vectorOf(dialog).fill(vector);
        }
        const reads = readsOf(spy, CVSS);

        await press(submitOf(dialog));

        const field = vectorOf(dialog);
        await expect
          .element(field)
          .toHaveAccessibleDescription(`${VECTOR_DESCRIPTION} ${message}`);
        await expect.element(field).toBeInvalid();
        await expect.element(field).toHaveFocus();
        expect(readsOf(spy, CVSS)).toBe(reads);
        expect(requestsWith(spy, "POST")).toHaveLength(0);
      },
    );

    test.each([
      ["an empty vector", "", "Choose the metrics, or enter the vector."],
      [
        "a vector of v4.0, also when SUSE has an assessment of v4.0",
        VECTOR_V40,
        "Enter a CVSS v3.1 vector, which starts with CVSS:3.1/.",
      ],
    ])(
      "state the error of %s in Edit at the vector, without a request",
      async (_, vector, message) => {
        const spy = stubSuse(() => assessmentsWith([SUSE_V40, SUSE_V31]));
        const { screen } = await renderSuse();
        const dialog = await openSuseEdit(screen);
        await vectorOf(dialog).fill(vector);

        await press(submitOf(dialog, "Save"));

        const field = vectorOf(dialog);
        await expect
          .element(field)
          .toHaveAccessibleDescription(`${VECTOR_DESCRIPTION} ${message}`);
        await expect.element(field).toHaveFocus();
        expect(requestsWith(spy, "POST")).toHaveLength(0);
      },
    );

    test("accept a vector of 200 characters, counted by code point as Sentinel counts them", async () => {
      // 200 code points, of which the emoji take two code units each.
      const vector = `CVSS:3.1/${"😀".repeat(191)}`;
      const bodies: unknown[] = [];
      stubSuse(() => fictionalCvssAssessments(), {
        upsertSuse: (body) => {
          bodies.push(body);
          return errorResponse(422, "CVSS_INVALID_VECTOR");
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(vector);

      await press(submitOf(dialog, "Save"));

      await expect
        .element(vectorOf(dialog))
        .toHaveAccessibleDescription(
          `${VECTOR_DESCRIPTION} Sentinel doesn't accept this vector. Enter a complete CVSS v3.1 Base vector.`,
        );
      expect(bodies).toEqual([{ vector_string: vector }]);
    });

    test.each<[string, (dialog: Locator) => Promise<void>]>([
      [
        "the user types",
        async (dialog) => {
          await vectorOf(dialog).fill("C");
        },
      ],
      [
        "the user chooses a metric",
        async (dialog) => {
          await segmentOf(dialog, "Scope", "Unchanged").click();
        },
      ],
      [
        "the user moves to another tab",
        async (dialog) => {
          await versionTab(dialog, "4.0").click();
          await versionTab(dialog, "3.1").click();
        },
      ],
    ])("clear the error once %s", async (_, change) => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await press(submitOf(dialog));
      await expect.element(vectorOf(dialog)).toBeInvalid();

      await change(dialog);

      await expect.element(vectorOf(dialog)).not.toBeInvalid();
      await expect
        .element(vectorOf(dialog))
        .toHaveAccessibleDescription(VECTOR_DESCRIPTION);
    });
  });

  describe("its Base score", () => {
    // What the place of the score says of an empty vector.
    const NO_VECTOR = "No score. Choose the metrics, or enter the vector.";
    // A vector of v3.1 with a Temporal metric, which Sentinel does not
    // accept, and the error of the field for it.
    const TEMPORAL_V31 = `${VECTOR_V31}/E:P`;
    const NOT_ACCEPTED_V31 =
      "Sentinel doesn't accept this vector. Enter a complete CVSS v3.1 Base vector.";
    const MESSAGE_NETWORK =
      "Sentinel can't be reached. Check your connection and try again.";
    // The mark of None in the light theme (docs/design-system.md, Severity
    // Marks).
    const MARK_NONE = "rgb(139, 148, 158)";
    // What the place of the score says of a vector that Sentinel rejects.
    const REJECTED = "No score. Sentinel doesn't accept this vector.";
    // VECTOR_V31 with Availability Low.
    const LOW_V31 = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L";
    // How the form of v3.1 in Add returns to its vector once its outcome has
    // shown: from the tab of v4.0, or from LOW_V31, once its score shows.
    const RETURNS: [
      string,
      (dialog: Locator, vector: string) => Promise<void>,
    ][] = [
      [
        "from the other tab",
        async (dialog) => {
          await versionTab(dialog, "4.0").click();
          await expect
            .element(metricOf(dialog, "Attack requirements"))
            .toBeVisible();
          await versionTab(dialog, "3.1").click();
        },
      ],
      [
        "from another vector",
        async (dialog, vector) => {
          await vectorOf(dialog).fill(LOW_V31);
          await expect
            .poll(() => scoreSaid(dialog))
            .toBe("Base score 6.1, High");
          await vectorOf(dialog).fill(vector);
        },
      ],
    ];

    test("is read for the saved vector as Edit opens, without a pause, and shows the score and the severity with its mark, hidden from assistive technologies, which read them as one sentence", async () => {
      const response = later();
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        baseScore: () => response.promise,
      });
      const { screen } = await renderSuse();
      await focusInRow(screen, editSuse(screen));
      await readsEnded();
      // The clock of the pause, which stays where it is until the read is
      // sent.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

      await userEvent.keyboard("{Enter}");

      await expect
        .poll(() => scoreReads(spy), { interval: 0 })
        .toEqual([SUSE_V31.vector_string]);
      vi.useRealTimers();
      response.resolve(baseScoreResponse(SUSE_V31.vector_string, 6.1, "high"));
      const dialog = suseDialog(screen, "Edit SUSE assessment v3.1");
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      const place = scorePlaceOf(dialog);
      expect(seenOf(place)).toEqual([
        ["6.1", FG],
        ["High", FG],
      ]);
      expect(markOf(place.element())).toBe(MARK_HIGH);
      await expect
        .element(place.getByText("6.1", { exact: true }))
        .toBeVisible();
      await expect
        .element(place.getByText("High", { exact: true }))
        .toBeVisible();
    });

    test("is read for the vector without its surrounding whitespace", async () => {
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        baseScore: highScore,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await vectorOf(dialog).fill(`  ${VECTOR_V31} `);

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(scoreReads(spy)).toEqual([VECTOR_V31]);
    });

    test("is read once the vector has paused for 250 ms, for the last vector alone, rather than at each change", async () => {
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        baseScore: highScore,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      vectorOf(dialog).element().focus();
      await readsEnded();
      // The clock of the pause, which the test moves itself: the keyboard
      // types and presses without moving it.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

      // A vector that chooses every metric, typed key by key, then two
      // choices of a metric, each change shortly before the pause after the
      // one before ends.
      await userEvent.keyboard("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L");
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await press(segmentOf(dialog, "Availability", "None"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await press(segmentOf(dialog, "Availability", "High"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await nextFrames();
      expect(scoreReads(spy)).toEqual([]);
      vi.advanceTimersByTime(1);
      vi.useRealTimers();

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(scoreReads(spy)).toEqual([VECTOR_V31]);
    });

    test.each<[string, CVSSAssessmentItem[], string, string]>([
      ["an empty vector", [NVD_V40, NVD_V31], "", NO_VECTOR],
      [
        "a vector that does not choose every metric",
        [NVD_V40, NVD_V31],
        "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N",
        "No score. Choose every metric.",
      ],
      [
        "a vector of the other version",
        [NVD_V40, NVD_V31],
        VECTOR_V40,
        "No score. Enter a CVSS v3.1 vector, which starts with CVSS:3.1/.",
      ],
      [
        "a vector longer than 200 characters that chooses every metric",
        [NVD_V40, NVD_V31],
        `${VECTOR_V31}/${"😀".repeat(156)}`,
        "No score. Enter at most 200 characters.",
      ],
      [
        "a vector of a version of which SUSE has an assessment",
        [SUSE_V40, NVD_V31],
        VECTOR_V40,
        "No score. SUSE already has a CVSS v4.0 assessment: edit it in its row.",
      ],
    ])(
      "is not read for %s in Add, whose place shows 0.0 and None in fg-muted, which assistive technologies read as the reason",
      async (_, assessments, vector, reason) => {
        const spy = stubSuse(() => assessmentsWith(assessments));
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await expect
          .element(versionTab(dialog, "3.1"))
          .toHaveAttribute("aria-selected", "true");

        if (vector !== "") {
          await vectorOf(dialog).fill(vector);
        }

        await expect.poll(() => scoreSaid(dialog)).toBe(reason);
        const place = scorePlaceOf(dialog);
        expect(seenOf(place)).toEqual([
          ["0.0", FG_MUTED],
          ["None", FG_MUTED],
        ]);
        expect(markOf(place.element())).toBe(MARK_NONE);
        await nextFrames();
        expect(scoreReads(spy)).toEqual([]);
      },
    );

    test("does not show in the tab of a version of which SUSE has an assessment", async () => {
      stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect.poll(() => scoreSaid(dialog)).toBe(NO_VECTOR);

      await versionTab(dialog, "3.1").click();

      await expect
        .element(dialog.getByText(TAKEN_V31, { exact: true }))
        .toBeVisible();
      expect(scorePlaceOf(dialog).query()).toBeNull();
    });

    test("shows nothing of a read that a newer vector overtakes, whose response arrives while the score of the newer vector is read, and keeps the outcome before them, marked as being updated, until the newer score arrives", async () => {
      // The saved vector with Integrity Low, whose read the newer vector,
      // with Integrity High, overtakes; each read waits until the test
      // answers it.
      const overtaken = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N";
      const newer = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N";
      const overtakenResponse = later();
      const newerResponse = later();
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        baseScore: (query) => {
          const vector = query.get("vector_string");
          if (vector === overtaken) {
            return overtakenResponse.promise;
          }
          return vector === newer ? newerResponse.promise : highScore(query);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await segmentOf(dialog, "Integrity", "Low").click();
      await expect
        .poll(() => scoreReads(spy))
        .toEqual([SUSE_V31.vector_string, overtaken]);
      await segmentOf(dialog, "Integrity", "High").click();
      await expect
        .poll(() => scoreReads(spy))
        .toEqual([SUSE_V31.vector_string, overtaken, newer]);
      const updating = dialog.getByRole("progressbar", { name: "Updating" });
      await expect.element(updating).toBeVisible();
      const record = recordScore(dialog);

      overtakenResponse.resolve(baseScoreResponse(overtaken, 9.8, "critical"));

      // No read of it is in progress any more, while the newer one is.
      await expect
        .poll(
          () =>
            client.isFetching({
              queryKey: [BASE_SCORE, { vector_string: overtaken }],
            }),
          { interval: 0 },
        )
        .toBe(0);
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      await nextFrames();
      record.stop();
      expect(
        record.said.filter((said) => said !== "Base score 6.1, High"),
      ).toEqual([]);
      expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(seenOf(scorePlaceOf(dialog))).toEqual([
        ["6.1", FG],
        ["High", FG],
      ]);
      expect(dialog.getByText(/9\.8|Critical/).elements()).toEqual([]);
      await expect.element(updating).toBeVisible();
      newerResponse.resolve(baseScoreResponse(newer, 7.1, "high"));

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 7.1, High");
      await expect.element(updating).not.toBeInTheDocument();
      expect(scoreReads(spy)).toEqual([
        SUSE_V31.vector_string,
        overtaken,
        newer,
      ]);
    });

    test("shows nothing of a read that a newer vector overtakes, whose response arrives while the newer vector has not paused, and keeps the outcome before them until the newer score arrives", async () => {
      // The saved vector with Integrity Low, whose read the vector with
      // Integrity High overtakes before it is answered; each read waits until
      // the test answers it.
      const overtaken = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N";
      const newer = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N";
      const overtakenResponse = later();
      const newerResponse = later();
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        baseScore: (query) => {
          const vector = query.get("vector_string");
          if (vector === overtaken) {
            return overtakenResponse.promise;
          }
          return vector === newer ? newerResponse.promise : highScore(query);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await readsEnded();
      // The clock of the pause, and of the task in which TanStack Query gives
      // the screen the outcome of a read, which the test moves itself.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      await press(segmentOf(dialog, "Integrity", "Low"));
      vi.advanceTimersByTime(SCORE_DELAY_MS);
      await expect
        .poll(() => scoreReads(spy), { interval: 0 })
        .toEqual([SUSE_V31.vector_string, overtaken]);
      const record = recordScore(dialog);
      await press(segmentOf(dialog, "Integrity", "High"));

      overtakenResponse.resolve(baseScoreResponse(overtaken, 9.8, "critical"));

      // Its read ends, and the clock, which stops short of the end of the
      // pause of the newer vector, moves past the task in which the screen
      // has its outcome.
      await expect
        .poll(
          () =>
            client.isFetching({
              queryKey: [BASE_SCORE, { vector_string: overtaken }],
            }),
          { interval: 0 },
        )
        .toBe(0);
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await nextFrames();
      expect(
        record.said.filter((said) => said !== "Base score 6.1, High"),
      ).toEqual([]);
      expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(seenOf(scorePlaceOf(dialog))).toEqual([
        ["6.1", FG],
        ["High", FG],
      ]);
      expect(dialog.getByText(/9\.8|Critical/).elements()).toEqual([]);
      expect(scoreReads(spy)).toEqual([SUSE_V31.vector_string, overtaken]);
      vi.advanceTimersByTime(1);
      await expect
        .poll(() => scoreReads(spy), { interval: 0 })
        .toEqual([SUSE_V31.vector_string, overtaken, newer]);
      vi.useRealTimers();
      newerResponse.resolve(baseScoreResponse(newer, 7.1, "high"));

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 7.1, High");
      record.stop();
      expect(new Set(record.said)).toEqual(
        new Set(["Base score 6.1, High", "Base score 7.1, High"]),
      );
    });

    test("keeps the outcome of the vector before while the score of a new vector is read, marked as being updated, until the new score arrives", async () => {
      const response = later();
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        baseScore: (query) =>
          query.get("vector_string") === VECTOR_V31
            ? response.promise
            : highScore(query),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");

      await vectorOf(dialog).fill(VECTOR_V31);

      await expect
        .poll(() => scoreReads(spy))
        .toEqual([SUSE_V31.vector_string, VECTOR_V31]);
      const updating = dialog.getByRole("progressbar", { name: "Updating" });
      await expect.element(updating).toBeVisible();
      expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(seenOf(scorePlaceOf(dialog))).toEqual([
        ["6.1", FG],
        ["High", FG],
      ]);
      response.resolve(baseScoreResponse(VECTOR_V31, 7.5, "high"));

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 7.5, High");
      await expect.element(updating).not.toBeInTheDocument();
    });

    test("marks the outcome of the vector before as being updated only once the read of the new vector has taken 300 ms, never while the vector has not paused", async () => {
      const response = later();
      // The saved vector with Integrity High.
      const changed = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N";
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        baseScore: (query) =>
          query.get("vector_string") === changed
            ? response.promise
            : highScore(query),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await readsEnded();
      // The clock of the pause and of the delay of the mark, which the test
      // moves itself.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const updating = dialog.getByRole("progressbar", { name: "Updating" });

      // Three choices of a metric, each shortly before the pause after the
      // one before ends, which keep the vector from pausing for longer than
      // the delay of the mark.
      await press(segmentOf(dialog, "Integrity", "Low"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await press(segmentOf(dialog, "Integrity", "None"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await press(segmentOf(dialog, "Integrity", "High"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      expect(3 * (SCORE_DELAY_MS - 1)).toBeGreaterThan(LOADING_DELAY_MS);
      await nextFrames();
      expect(updating.query()).toBeNull();
      expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(scoreReads(spy)).toEqual([SUSE_V31.vector_string]);

      vi.advanceTimersByTime(1);

      await expect
        .poll(() => scoreReads(spy), { interval: 0 })
        .toEqual([SUSE_V31.vector_string, changed]);
      vi.advanceTimersByTime(LOADING_DELAY_MS - 1);
      await nextFrames();
      expect(updating.query()).toBeNull();
      expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
      vi.advanceTimersByTime(1);
      await expect.poll(() => updating.query(), { interval: 0 }).not.toBeNull();
      expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
      vi.useRealTimers();
      response.resolve(baseScoreResponse(changed, 7.1, "high"));

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 7.1, High");
      await expect.element(updating).not.toBeInTheDocument();
    });

    test("shows the loading indicator in its place, beside Start from, until the first outcome of the vector is known", async () => {
      const response = later();
      stubSuse(() => fictionalCvssAssessments(), {
        baseScore: () => response.promise,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      const loading = dialog.getByRole("progressbar", { name: "Loading" });

      await expect.element(loading).toBeVisible();
      expect(scoreSaid(dialog)).toBe("");
      expect(boxOf(loading).left).toBeGreaterThan(
        boxOf(startFromOf(dialog)).right,
      );
      expect(boxOf(loading).bottom).toBeLessThanOrEqual(
        boxOf(metricOf(dialog, "Attack vector")).top,
      );
      expect(
        dialog.getByRole("progressbar", { name: "Updating" }).query(),
      ).toBeNull();
      response.resolve(baseScoreResponse(SUSE_V31.vector_string, 6.1, "high"));

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await expect.element(loading).not.toBeInTheDocument();
    });

    test.each<[string, (dialog: Locator) => Locator]>([
      ["on the field", (dialog) => vectorOf(dialog)],
      ["on a metric", (dialog) => segmentOf(dialog, "Availability", "Low")],
    ])(
      "shows 422 CVSS_INVALID_VECTOR of the read at the vector at once and no score in its place, leaving the focus %s",
      async (_, focused) => {
        stubSuse(() => fictionalCvssAssessments(), {
          baseScore: rejectingTemporal,
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseEdit(screen);
        await vectorOf(dialog).fill(TEMPORAL_V31);
        focused(dialog).element().focus();

        await expect
          .element(vectorOf(dialog))
          .toHaveAccessibleDescription(
            `${VECTOR_DESCRIPTION} ${NOT_ACCEPTED_V31}`,
          );
        await expect.element(vectorOf(dialog)).toBeInvalid();
        await expect
          .poll(() => scoreSaid(dialog))
          .toBe("No score. Sentinel doesn't accept this vector.");
        expect(seenOf(scorePlaceOf(dialog))).toEqual([
          ["0.0", FG_MUTED],
          ["None", FG_MUTED],
        ]);
        await expectFocusSettledOn(focused(dialog));
      },
    );

    test("takes the error of 422 CVSS_INVALID_VECTOR of the read away from the vector as soon as the input changes, before the vector pauses", async () => {
      stubSuse(() => fictionalCvssAssessments(), {
        baseScore: rejectingTemporal,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(TEMPORAL_V31);
      await expect.element(vectorOf(dialog)).toBeInvalid();
      await readsEnded();
      // The clock of the pause, which does not move: the pause after the
      // change does not end.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

      await press(segmentOf(dialog, "Availability", "Low"));

      await expect
        .poll(() => vectorOf(dialog).element(), { interval: 0 })
        .not.toBeInvalid();
      await expect
        .poll(() => vectorOf(dialog).element(), { interval: 0 })
        .toHaveAccessibleDescription(VECTOR_DESCRIPTION);
      await expect
        .poll(() => vectorOf(dialog).element(), { interval: 0 })
        .toHaveValue("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L");
      vi.useRealTimers();
    });

    test("leaves Save sending a vector that the read rejects with 422 CVSS_INVALID_VECTOR", async () => {
      const bodies: unknown[] = [];
      stubSuse(() => fictionalCvssAssessments(), {
        baseScore: rejectingTemporal,
        upsertSuse: (body) => {
          bodies.push(body);
          return errorResponse(422, "CVSS_INVALID_VECTOR");
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(TEMPORAL_V31);
      await expect.element(vectorOf(dialog)).toBeInvalid();

      await submitOf(dialog, "Save").click();

      await expect
        .poll(() => bodies)
        .toEqual([{ vector_string: TEMPORAL_V31 }]);
      await expect.element(vectorOf(dialog)).toHaveFocus();
    });

    test.each<
      [string, () => Response | Promise<Response>, string, boolean, number]
    >([
      [
        "a 503, read three times",
        () => errorResponse(503, "SERVICE_UNAVAILABLE"),
        MESSAGE_UNAVAILABLE,
        true,
        3,
      ],
      [
        "a network failure, read three times",
        () => Promise.reject(new TypeError("Failed to fetch")),
        MESSAGE_NETWORK,
        true,
        3,
      ],
      [
        "a VALIDATION_ERROR of the vector, read once",
        () => validationError([["query", "vector_string"]]),
        MESSAGE_NOT_ACCEPTED,
        false,
        1,
      ],
      [
        "a 422 with a code that the pinned contract does not list, read once",
        () => errorResponse(422, "FICTIONAL_CODE"),
        MESSAGE_NOT_ACCEPTED,
        false,
        1,
      ],
      [
        "a status and a code that the pinned contract does not list, read once",
        () => errorResponse(418, "FICTIONAL_CODE"),
        MESSAGE_NOT_ACCEPTED,
        false,
        1,
      ],
    ])(
      "shows the failure of %s in its place, with Try again where it offers it, without an error at the vector, and Add SUSE assessment still adds it",
      async (_, response, message, retry, reads) => {
        const bodies: unknown[] = [];
        const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          baseScore: response,
          upsertSuse: (body) => {
            bodies.push(body);
            return suseResponse(SAVED_V31, 201);
          },
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);

        await vectorOf(dialog).fill(VECTOR_V31);

        const place = scorePlaceOf(dialog);
        await expect.element(place.getByText(message)).toBeVisible();
        expect(scoreReads(spy)).toEqual(
          Array.from({ length: reads }, () => VECTOR_V31),
        );
        const tryAgain = place.getByRole("button", { name: "Try again" });
        if (retry) {
          await expect.element(tryAgain).toBeVisible();
        } else {
          expect(tryAgain.query()).toBeNull();
        }
        await expect.element(vectorOf(dialog)).not.toBeInvalid();
        await expect
          .element(vectorOf(dialog))
          .toHaveAccessibleDescription(VECTOR_DESCRIPTION);

        await submitOf(dialog).click();

        await expect.element(dialog).not.toBeInTheDocument();
        expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
      },
    );

    test("is read again on Try again after a failure, and then shows", async () => {
      let fails = true;
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        baseScore: (query) =>
          fails ? errorResponse(503, "SERVICE_UNAVAILABLE") : highScore(query),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      const place = scorePlaceOf(dialog);
      await expect.element(place.getByText(MESSAGE_UNAVAILABLE)).toBeVisible();
      fails = false;

      await place.getByRole("button", { name: "Try again" }).click();

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(scoreReads(spy)).toEqual([
        VECTOR_V31,
        VECTOR_V31,
        VECTOR_V31,
        VECTOR_V31,
      ]);
    });

    test.each(RETURNS)(
      "shows the rejection of a vector by 422 CVSS_INVALID_VECTOR again, at the vector and in its place, as the form returns to it %s, without waiting for a read or reading it again",
      async (_, back) => {
        const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          baseScore: rejectingTemporal,
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await vectorOf(dialog).fill(TEMPORAL_V31);
        await expect.element(vectorOf(dialog)).toBeInvalid();
        await expect.poll(() => scoreSaid(dialog)).toBe(REJECTED);
        const readsOfVector = () =>
          scoreReads(spy).filter((vector) => vector === TEMPORAL_V31);
        expect(readsOfVector()).toHaveLength(1);
        const record = recordScore(dialog);

        await back(dialog, TEMPORAL_V31);

        await expect
          .element(vectorOf(dialog))
          .toHaveAccessibleDescription(
            `${VECTOR_DESCRIPTION} ${NOT_ACCEPTED_V31}`,
          );
        await expect.element(vectorOf(dialog)).toBeInvalid();
        await expect.poll(() => scoreSaid(dialog)).toBe(REJECTED);
        await nextFrames();
        record.stop();
        // The place never waited for a read meanwhile.
        expect(record.said).not.toContain("");
        expect(readsOfVector()).toHaveLength(1);
      },
    );

    test.each(RETURNS)(
      "reads again a vector whose read failed with a 503 as the form returns to it %s",
      async (_, back) => {
        const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          baseScore: (query) =>
            query.get("vector_string") === VECTOR_V31
              ? errorResponse(503, "SERVICE_UNAVAILABLE")
              : highScore(query),
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await vectorOf(dialog).fill(VECTOR_V31);
        const place = scorePlaceOf(dialog);
        await expect
          .element(place.getByText(MESSAGE_UNAVAILABLE))
          .toBeVisible();
        const readsOfVector = () =>
          scoreReads(spy).filter((vector) => vector === VECTOR_V31);
        expect(readsOfVector()).toHaveLength(3);

        await back(dialog, VECTOR_V31);

        await expect.poll(readsOfVector).toHaveLength(6);
        await expect
          .element(place.getByText(MESSAGE_UNAVAILABLE))
          .toBeVisible();
      },
    );

    test.each<
      [
        string,
        (dialog: Locator) => Promise<void>,
        (dialog: Locator) => Promise<void>,
      ]
    >([
      [
        "from the other tab",
        async (dialog) => {
          await versionTab(dialog, "4.0").click();
          await expect
            .element(metricOf(dialog, "Attack requirements"))
            .toBeVisible();
        },
        async (dialog) => {
          await versionTab(dialog, "3.1").click();
        },
      ],
      [
        "from another vector",
        async (dialog) => {
          await vectorOf(dialog).fill(LOW_V31);
          await expect
            .poll(() => scoreSaid(dialog))
            .toBe("Base score 6.1, High");
        },
        async (dialog) => {
          await vectorOf(dialog).fill(VECTOR_V31);
        },
      ],
    ])(
      "shows the failure of a 422 with a code that the pinned contract does not list again in its place as the form returns to its vector %s, without waiting for a read or reading it again",
      async (_, leave, back) => {
        const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          baseScore: (query) =>
            query.get("vector_string") === VECTOR_V31
              ? errorResponse(422, "FICTIONAL_CODE")
              : highScore(query),
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await vectorOf(dialog).fill(VECTOR_V31);
        const place = scorePlaceOf(dialog);
        await expect
          .element(place.getByText(MESSAGE_NOT_ACCEPTED))
          .toBeVisible();
        const readsOfVector = () =>
          scoreReads(spy).filter((vector) => vector === VECTOR_V31);
        expect(readsOfVector()).toHaveLength(1);
        await leave(dialog);
        const record = recordScore(dialog);

        await back(dialog);

        await expect
          .element(place.getByText(MESSAGE_NOT_ACCEPTED))
          .toBeVisible();
        await nextFrames();
        record.stop();
        // The place never waited for a read meanwhile.
        expect(record.said).not.toContain("");
        expect(readsOfVector()).toHaveLength(1);
        expect(
          place.getByRole("button", { name: "Try again" }).query(),
        ).toBeNull();
        await expect.element(vectorOf(dialog)).not.toBeInvalid();
      },
    );

    test.each<[string, () => Response | Promise<Response>, string]>([
      [
        "a 503",
        () => errorResponse(503, "SERVICE_UNAVAILABLE"),
        MESSAGE_UNAVAILABLE,
      ],
      [
        "a network failure",
        () => Promise.reject(new TypeError("Failed to fetch")),
        MESSAGE_NETWORK,
      ],
    ])(
      "offers Try again after %s of the read only while the form holds its vector: neither while the next vector pauses nor while its score is read, when its place shows the loading indicator",
      async (_, failure, message) => {
        const response = later();
        const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          baseScore: (query) =>
            query.get("vector_string") === VECTOR_V31
              ? failure()
              : response.promise,
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await vectorOf(dialog).fill(VECTOR_V31);
        const place = scorePlaceOf(dialog);
        const tryAgain = place.getByRole("button", { name: "Try again" });
        await expect.element(tryAgain).toBeVisible();
        await expect.element(place.getByText(message)).toBeVisible();
        await readsEnded();
        // The clock of the pause and of the delay of the loading indicator,
        // which the test moves itself.
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

        await press(segmentOf(dialog, "Availability", "Low"));

        await expect
          .poll(() => vectorOf(dialog).element(), { interval: 0 })
          .toHaveValue(LOW_V31);
        vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
        await nextFrames();
        expect(tryAgain.query()).toBeNull();
        expect(place.getByText(message).query()).toBeNull();
        vi.advanceTimersByTime(1);
        await expect
          .poll(() => scoreReads(spy), { interval: 0 })
          .toEqual([VECTOR_V31, VECTOR_V31, VECTOR_V31, LOW_V31]);
        vi.advanceTimersByTime(LOADING_DELAY_MS);
        await expect
          .poll(
            () => dialog.getByRole("progressbar", { name: "Loading" }).query(),
            { interval: 0 },
          )
          .not.toBeNull();
        expect(tryAgain.query()).toBeNull();
        expect(place.getByText(message).query()).toBeNull();
        vi.useRealTimers();
        response.resolve(baseScoreResponse(LOW_V31, 6.1, "high"));

        await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      },
    );

    test("shows the loading indicator after a failure of the read only once the read of the next vector has taken 300 ms, never while that vector has not paused", async () => {
      const response = later();
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        baseScore: (query) =>
          query.get("vector_string") === VECTOR_V31
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : response.promise,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      await expect
        .element(scorePlaceOf(dialog).getByText(MESSAGE_UNAVAILABLE))
        .toBeVisible();
      await readsEnded();
      // The clock of the pause and of the delay of the indicator, which the
      // test moves itself.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const loading = dialog.getByRole("progressbar", { name: "Loading" });

      // Three choices of a metric, each shortly before the pause after the
      // one before ends, which keep the vector from pausing for longer than
      // the delay of the indicator, and end on LOW_V31.
      await press(segmentOf(dialog, "Availability", "Low"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await press(segmentOf(dialog, "Availability", "None"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await press(segmentOf(dialog, "Availability", "Low"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      expect(3 * (SCORE_DELAY_MS - 1)).toBeGreaterThan(LOADING_DELAY_MS);
      await nextFrames();
      expect(loading.query()).toBeNull();
      expect(scoreSaid(dialog)).toBe("");
      expect(scoreReads(spy)).toEqual([VECTOR_V31, VECTOR_V31, VECTOR_V31]);

      vi.advanceTimersByTime(1);

      await expect
        .poll(() => scoreReads(spy), { interval: 0 })
        .toEqual([VECTOR_V31, VECTOR_V31, VECTOR_V31, LOW_V31]);
      vi.advanceTimersByTime(LOADING_DELAY_MS - 1);
      await nextFrames();
      expect(loading.query()).toBeNull();
      vi.advanceTimersByTime(1);
      await expect.poll(() => loading.query(), { interval: 0 }).not.toBeNull();
      vi.useRealTimers();
      response.resolve(baseScoreResponse(LOW_V31, 6.1, "high"));

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await expect.element(loading).not.toBeInTheDocument();
    });

    test("shows in each tab of Add the outcome of its own vector at once, never that of the other tab, and the score of a tab again without reading it again", async () => {
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31], "4.0"), {
        baseScore: highScore,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");
      await vectorOf(dialog).fill(VECTOR_V40);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await readsEnded();
      const record = recordScore(dialog);
      // The clock of the pause, which does not move: what a tab shows before
      // the pause ends is what it shows at once.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

      await press(versionTab(dialog, "3.1"));

      await expect
        .poll(() => scoreSaid(dialog), { interval: 0 })
        .toBe(NO_VECTOR);
      await nextFrames();
      expect(new Set(record.said.splice(0))).toEqual(new Set([NO_VECTOR]));

      await press(versionTab(dialog, "4.0"));

      await expect
        .poll(() => scoreSaid(dialog), { interval: 0 })
        .toBe("Base score 6.1, High");
      await nextFrames();
      expect(new Set(record.said)).toEqual(new Set(["Base score 6.1, High"]));
      record.stop();
      vi.useRealTimers();
      expect(scoreReads(spy)).toEqual([VECTOR_V40]);
    });

    test("shows in a tab of Add whose vector is being read the loading indicator, and nothing of the outcome of the other tab", async () => {
      // The reads of VECTOR_V31 wait until the test lets them through, each
      // with its own response.
      const gate = later();
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        baseScore: (query) =>
          query.get("vector_string") === VECTOR_V31
            ? gate.promise.then(() =>
                baseScoreResponse(VECTOR_V31, 9.8, "critical"),
              )
            : highScore(query),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      await expect.poll(() => scoreReads(spy)).toEqual([VECTOR_V31]);
      await versionTab(dialog, "4.0").click();
      await expect.element(vectorOf(dialog)).toHaveValue("");
      await vectorOf(dialog).fill(VECTOR_V40);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      const record = recordScore(dialog);

      await versionTab(dialog, "3.1").click();

      await expect
        .element(dialog.getByRole("progressbar", { name: "Loading" }))
        .toBeVisible();
      record.stop();
      expect(record.said.filter((said) => said !== "")).toEqual([]);
      expect(scoreSaid(dialog)).toBe("");
      gate.resolve(new Response());

      await expect
        .poll(() => scoreSaid(dialog))
        .toBe("Base score 9.8, Critical");
    });

    test("is read once for a vector: neither when the vector returns to it nor when the tab returns to the foreground", async () => {
      // The saved vector with Integrity High.
      const changed = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N";
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        baseScore: (query) =>
          query.get("vector_string") === changed
            ? baseScoreResponse(changed, 7.1, "high")
            : highScore(query),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await segmentOf(dialog, "Integrity", "High").click();
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 7.1, High");

      await segmentOf(dialog, "Integrity", "None").click();

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await nextFrames();
      expect(scoreReads(spy)).toEqual([SUSE_V31.vector_string, changed]);
      const reads = readsOf(spy, CVSS);

      await returnToForeground();

      // The assessments, which the tab reads again, tell that the return has
      // been handled.
      await expect.poll(() => readsOf(spy, CVSS)).toBe(reads + 1);
      await nextFrames();
      expect(scoreReads(spy)).toEqual([SUSE_V31.vector_string, changed]);
    });

    test.each<[string, (dialog: Locator) => Promise<Locator>]>([
      [
        "on the field, as the user enters the vector",
        async (dialog) => {
          await vectorOf(dialog).fill(VECTOR_V31);
          return vectorOf(dialog);
        },
      ],
      [
        "on a metric, as the user chooses it",
        async (dialog) => {
          await vectorOf(dialog).fill(
            "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N",
          );
          const segment = segmentOf(dialog, "Availability", "High");
          await press(segment);
          return segment;
        },
      ],
    ])(
      "announces the score in its status region, leaving the focus %s",
      async (_, change) => {
        stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          baseScore: highScore,
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await expect.poll(() => scoreSaid(dialog)).toBe(NO_VECTOR);

        const focused = await change(dialog);

        await expect
          .element(scorePlaceOf(dialog).getByText("Base score 6.1, High"))
          .toBeInTheDocument();
        expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
        await expectFocusSettledOn(focused);
      },
    );

    test("shows a severity that the pinned contract does not list as received, which assistive technologies read as received", async () => {
      stubSuse(() => fictionalCvssAssessments(), {
        baseScore: (query) =>
          jsonResponse(200, {
            data: {
              ...baseScoreOf(query.get("vector_string") ?? "", 6.1),
              severity: "fictional_level",
            },
          }),
      });
      const { screen } = await renderSuse();

      const dialog = await openSuseEdit(screen);

      await expect
        .poll(() => scoreSaid(dialog))
        .toBe("Base score 6.1, fictional_level");
      const place = scorePlaceOf(dialog);
      expect(seenOf(place)).toEqual([
        ["6.1", FG],
        ["fictional_level", FG],
      ]);
      // The hollow dot of a value that the pinned contract does not list.
      expect(markOf(place.element())).toBe("none");
    });
  });

  describe("Edit", () => {
    test("opens a dialog 880 px wide without tabs, named after the version, with the saved vector and its metrics, then Cancel and Save", async () => {
      stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();

      const dialog = await openSuseEdit(screen);

      expect(dialog.element().getBoundingClientRect().width).toBe(880);
      expect(dialog.getByRole("tablist").query()).toBeNull();
      await expect
        .element(vectorOf(dialog))
        .toHaveValue(SUSE_V31.vector_string);
      expect(choicesOf(dialog, METRICS_V31)).toEqual([
        "Local",
        "Low",
        "Low",
        "None",
        "Unchanged",
        "High",
        "None",
        "None",
      ]);
      expect(
        dialog
          .getByRole("button")
          .elements()
          .slice(-2)
          .map((button) => button.textContent),
      ).toEqual(["Cancel", "Save"]);
    });

    test("opens on the version of its row, v4.0", async () => {
      stubSuse(() => assessmentsWith([SUSE_V40, NVD_V31, SUSE_V31]));
      const { screen } = await renderSuse();

      const dialog = await openSuseEdit(screen, "4.0");

      await expect
        .element(vectorOf(dialog))
        .toHaveValue(SUSE_V40.vector_string);
      expect(choicesOf(dialog, METRICS_V40)).toEqual([
        "Local",
        "Low",
        "None",
        "Low",
        "None",
        "High",
        "None",
        "None",
        "None",
        "None",
        "None",
      ]);
    });

    test.each([
      ["as saved", SUSE_V31.vector_string],
      ["with surrounding whitespace", `  ${SUSE_V31.vector_string} `],
    ])(
      "closes on Save without a request with the vector %s, and returns the focus to Edit",
      async (_, vector) => {
        const spy = stubSuse(() => fictionalCvssAssessments());
        const { screen } = await renderSuse();
        const dialog = await openSuseEdit(screen);
        await vectorOf(dialog).fill(vector);

        await submitOf(dialog, "Save").click();

        await expect.element(dialog).not.toBeInTheDocument();
        expect(requestsWith(spy, "POST")).toHaveLength(0);
        await expect.element(editSuse(screen)).toHaveFocus();
      },
    );

    test("saves a changed vector with Set or Update SUSE CVSS Assessment without reading first, then announces it once the assessments are read again, and returns the focus to Edit", async () => {
      let assessments = fictionalCvssAssessments();
      const bodies: unknown[] = [];
      const spy = stubSuse(() => assessments, {
        upsertSuse: (body) => {
          bodies.push(body);
          assessments = assessmentsWith([NVD_V31, SAVED_V31]);
          return suseResponse(SAVED_V31);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      const before = assessmentRequests(spy).length;

      await vectorOf(dialog).fill(` ${VECTOR_V31}`);
      await submitOf(dialog, "Save").click();

      await expect.element(dialog).not.toBeInTheDocument();
      expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
      await expect
        .poll(() => cvssAnnouncements(screen))
        .toEqual(["SUSE assessment v3.1 changed."]);
      expect(assessmentRequests(spy).slice(before)).toEqual([
        `POST ${SUSE_ASSESSMENT}`,
        `GET ${CVSS}`,
      ]);
      await expect
        .element(
          assessmentRow(screen, "SUSE", "3.1").getByText(VECTOR_V31, {
            exact: true,
          }),
        )
        .toBeVisible();
      await expectFocusSettledOn(editSuse(screen));
    });

    test("is busy while the change is in progress, and cannot be closed", async () => {
      const response = later();
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        upsertSuse: () => response.promise,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(VECTOR_V31);

      await submitOf(dialog, "Save").click();

      await expect
        .element(submitOf(dialog, "Save"))
        .toHaveAttribute("aria-disabled", "true");
      await expect
        .element(dialog.getByRole("button", { name: "Cancel" }))
        .toBeDisabled();
      await userEvent.keyboard("{Escape}");
      await expect.element(dialog).toBeVisible();
      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();
      expect(requestsWith(spy, "POST")).toHaveLength(1);

      response.resolve(suseResponse(SAVED_V31));

      await expect.element(dialog).not.toBeInTheDocument();
    });
  });

  describe("the failure of a change", () => {
    test.each([
      [
        "422 CVSS_INVALID_VECTOR",
        () => errorResponse(422, "CVSS_INVALID_VECTOR"),
        "Sentinel doesn't accept this vector. Enter a complete CVSS v3.1 Base vector.",
      ],
      [
        "a field error of the vector",
        () => validationError([["body", "vector_string"]]),
        MESSAGE_INVALID,
      ],
    ])(
      "shows %s at the vector, which takes the focus, and keeps the input",
      async (_, response, message) => {
        stubSuse(() => fictionalCvssAssessments(), { upsertSuse: response });
        const { screen } = await renderSuse();
        const dialog = await openSuseEdit(screen);
        await vectorOf(dialog).fill(VECTOR_V31);

        await submitOf(dialog, "Save").click();

        const field = vectorOf(dialog);
        await expect
          .element(field)
          .toHaveAccessibleDescription(`${VECTOR_DESCRIPTION} ${message}`);
        await expect.element(field).toBeInvalid();
        await expect.element(field).toHaveFocus();
        await expect.element(field).toHaveValue(VECTOR_V31);
        expect(dialog.getByRole("alert").query()).toBeNull();
      },
    );

    test("names the version of the tab in the error of 422 CVSS_INVALID_VECTOR in Add", async () => {
      stubSuse(() => fictionalCvssAssessments(), {
        upsertSuse: () => errorResponse(422, "CVSS_INVALID_VECTOR"),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");
      await vectorOf(dialog).fill(VECTOR_V40);

      await submitOf(dialog).click();

      await expect
        .element(vectorOf(dialog))
        .toHaveAccessibleDescription(
          `${VECTOR_DESCRIPTION} Sentinel doesn't accept this vector. Enter a complete CVSS v4.0 Base vector.`,
        );
      await expect.element(vectorOf(dialog)).toHaveFocus();
    });

    test.each([
      [
        "409 TICKET_NOT_MUTABLE, as an error",
        () => errorResponse(409, "TICKET_NOT_MUTABLE"),
        MESSAGE_CONFLICT,
        MESSAGE_TONES.danger,
      ],
      [
        "404 CVE_NOT_FOUND, as an error",
        () => errorResponse(404, "CVE_NOT_FOUND"),
        MESSAGE_GONE,
        MESSAGE_TONES.danger,
      ],
      [
        "a VALIDATION_ERROR of another member, as an error",
        () => validationError([["body", "fictional_member"]]),
        MESSAGE_NOT_ACCEPTED,
        MESSAGE_TONES.danger,
      ],
      [
        "a 422 with a code that the pinned contract does not list, as an error",
        () => errorResponse(422, "FICTIONAL_CODE"),
        MESSAGE_NOT_ACCEPTED,
        MESSAGE_TONES.danger,
      ],
      [
        "a status and a code that the pinned contract does not list, as an error",
        () => errorResponse(418, "FICTIONAL_CODE"),
        MESSAGE_NOT_ACCEPTED,
        MESSAGE_TONES.danger,
      ],
      [
        "a 500 that Sentinel did not confirm, as a warning",
        () => errorResponse(500, "INTERNAL_ERROR"),
        MESSAGE_UNCONFIRMED,
        MESSAGE_TONES.warning,
      ],
      [
        "a network failure, as a warning",
        () => Promise.reject(new TypeError("Failed to fetch")),
        MESSAGE_UNCONFIRMED,
        MESSAGE_TONES.warning,
      ],
    ])(
      "shows %s at the top of the form, which takes the focus and keeps the input",
      async (_, response, message, tone) => {
        stubSuse(() => fictionalCvssAssessments(), { upsertSuse: response });
        const { screen } = await renderSuse();
        const dialog = await openSuseEdit(screen);
        await vectorOf(dialog).fill(VECTOR_V31);

        await submitOf(dialog, "Save").click();

        const error = dialog.getByText(message);
        await expect.element(error).toBeVisible();
        expect(backgroundBehind(error.element())).toBe(tone);
        await expectFocusOnError(error);
        expect(boxOf(error).bottom).toBeLessThan(
          boxOf(metricOf(dialog, "Attack vector")).top,
        );
        await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
        await expect.element(vectorOf(dialog)).not.toBeInvalid();
      },
    );

    test("shows the reference of a change that Sentinel did not confirm", async () => {
      stubSuse(() => fictionalCvssAssessments(), {
        upsertSuse: () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(VECTOR_V31);

      await submitOf(dialog, "Save").click();

      await expect.element(dialog.getByText(MESSAGE_UNCONFIRMED)).toBeVisible();
      await expect.element(dialog.getByText(REFERENCE)).toBeVisible();
    });

    test("shows the error of the vector and of the form for a VALIDATION_ERROR with an error of another member, the form taking the focus", async () => {
      stubSuse(() => fictionalCvssAssessments(), {
        upsertSuse: () =>
          validationError([
            ["body", "vector_string"],
            ["body", "fictional_member"],
          ]),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(VECTOR_V31);

      await submitOf(dialog, "Save").click();

      const error = dialog.getByText(MESSAGE_NOT_ACCEPTED);
      await expect.element(error).toBeVisible();
      await expect
        .element(vectorOf(dialog))
        .toHaveAccessibleDescription(
          `${VECTOR_DESCRIPTION} ${MESSAGE_INVALID}`,
        );
      await expectFocusOnError(error);
    });
  });

  describe("the reads after a change", () => {
    // A maintainer of fictional-openssl who manages the CVSS assessments.
    const MAINTAINING_ASSESSOR: CurrentUserResponse = {
      data: { ...MAINTAINER.data, capabilities: ["manage_cvss"] },
    };

    test.each<[string, (screen: Screen) => Promise<unknown>, Partial<Stub>]>([
      [
        "Edit that Sentinel confirms",
        editToV31,
        { upsertSuse: () => suseResponse(SAVED_V31) },
      ],
      [
        "Edit that Sentinel refuses",
        editToV31,
        { upsertSuse: () => errorResponse(409, "TICKET_NOT_MUTABLE") },
      ],
      ["Delete that Sentinel confirms", confirmDelete, {}],
      [
        "Delete that Sentinel did not confirm",
        confirmDelete,
        { deleteSuse: () => errorResponse(503, "SERVICE_UNAVAILABLE") },
      ],
    ])(
      "read again after %s the Ticket, the assessments, the users who acted on it, its access grants, the work of a maintainer, its duplicates, its audit log, and the Ticket list",
      async (_, change, fields) => {
        const spy = stubSuse(() => fictionalCvssAssessments(), {
          user: MAINTAINING_ASSESSOR,
          ticket: () => confidentialTicket({ packages: [fictionalPackage()] }),
          grants: () => grantsResponse(),
          ...fields,
        });
        // The user saw the Ticket list, and Audit log, before Overview.
        const { router, screen } = await renderApp("/tickets");
        await expect
          .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
          .toBeVisible();
        await router.navigate({
          to: "/tickets/$ticketId/audit-log",
          params: { ticketId: "SNTL-12" },
        });
        await expect
          .element(screen.getByRole("tabpanel", { name: "Audit log" }))
          .toBeVisible();
        await screen.getByRole("tab", { name: "Overview" }).click();
        await expect
          .element(
            cvssPart(screen).getByRole("grid", { name: "CVSS assessments" }),
          )
          .toBeVisible();
        await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
        await expect.poll(() => readsOf(spy, ACCESS)).toBe(1);
        await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
        const reads = {
          ticket: requestsTo(spy, TICKET),
          cvss: readsOf(spy, CVSS),
          actors: requestsTo(spy, ACTORS),
          grants: readsOf(spy, ACCESS),
          work: requestsTo(spy, YOUR_WORK),
          duplicates: readsOf(spy, TICKETS),
        };
        expect(leftInvalidated(EVENTS)).toBe(false);
        expect(leftInvalidated(TICKETS)).toBe(false);

        await change(screen);

        await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
        await expect.poll(() => readsOf(spy, CVSS)).toBe(reads.cvss + 1);
        await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
        await expect.poll(() => readsOf(spy, ACCESS)).toBe(reads.grants + 1);
        await expect
          .poll(() => requestsTo(spy, YOUR_WORK))
          .toBe(reads.work + 1);
        await expect
          .poll(() => readsOf(spy, TICKETS))
          .toBe(reads.duplicates + 1);
        // Once every read has ended, each was sent once: the duplicates too,
        // which both the reads of the tab and those of the Ticket list hold.
        await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
        expect(readsOf(spy, TICKETS)).toBe(reads.duplicates + 1);
        expect(requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
        expect(readsOf(spy, CVSS)).toBe(reads.cvss + 1);
        expect(leftInvalidated(EVENTS)).toBe(true);
        expect(leftInvalidated(TICKETS)).toBe(true);
      },
    );
  });

  describe("the announcement of a change", () => {
    test.each([
      [
        "arrives",
        () => cvssResponse(assessmentsWith([NVD_V40, NVD_V31, SAVED_V31])),
      ],
      ["fails", () => errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION")],
    ])(
      "comes in the part once the next read of the assessments after Add %s, not before",
      async (_, response) => {
        const reread = later();
        let added = false;
        stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          cvss: () =>
            added
              ? reread.promise
              : cvssResponse(assessmentsWith([NVD_V40, NVD_V31])),
          upsertSuse: () => {
            added = true;
            return suseResponse(SAVED_V31, 201);
          },
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await vectorOf(dialog).fill(VECTOR_V31);

        await submitOf(dialog).click();

        await expect.element(dialog).not.toBeInTheDocument();
        await frames();
        expect(cvssAnnouncements(screen)).toEqual([]);
        reread.resolve(response());

        await expect
          .poll(() => cvssAnnouncements(screen))
          .toContain("SUSE assessment v3.1 added.");
        expect(screen.getByText(/added\.$/).elements()).toHaveLength(1);
      },
    );

    test.each([
      ["arrives", () => cvssResponse(assessmentsWith([NVD_V31, SAVED_V31]))],
      ["fails", () => errorResponse(404, "CVE_NOT_FOUND")],
    ])(
      "comes in the part once the next read of the assessments after Edit %s, not before",
      async (_, response) => {
        const reread = later();
        let saved = false;
        stubSuse(() => fictionalCvssAssessments(), {
          cvss: () => (saved ? reread.promise : cvssResponse()),
          upsertSuse: () => {
            saved = true;
            return suseResponse(SAVED_V31);
          },
        });
        const { screen } = await renderSuse();

        await editToV31(screen);

        await expect
          .element(suseDialog(screen, "Edit SUSE assessment v3.1"))
          .not.toBeInTheDocument();
        await frames();
        expect(cvssAnnouncements(screen)).toEqual([]);
        reread.resolve(response());

        await expect
          .poll(() => cvssAnnouncements(screen))
          .toContain("SUSE assessment v3.1 changed.");
      },
    );

    test.each([
      ["arrives", () => cvssResponse(assessmentsWith([NVD_V31]))],
      ["fails", () => errorResponse(503, "DATABASE_UNAVAILABLE")],
    ])(
      "comes in the part once the next read of the assessments after Delete %s, not before",
      async (_, response) => {
        const reread = later();
        let removed = false;
        stubSuse(() => fictionalCvssAssessments(), {
          cvss: () => (removed ? reread.promise : cvssResponse()),
          deleteSuse: () => {
            removed = true;
            return new Response(null, { status: 204 });
          },
        });
        const { screen } = await renderSuse();

        const confirmation = await confirmDelete(screen);

        await expect.element(confirmation).not.toBeInTheDocument();
        await frames();
        expect(cvssAnnouncements(screen)).toEqual([]);
        reread.resolve(response());

        await expect
          .poll(() => cvssAnnouncements(screen))
          .toContain("SUSE assessment v3.1 deleted.");
      },
    );
  });

  describe("a change that ends after the user left the screen", () => {
    test.each<
      [
        string,
        (screen: Screen) => Promise<void>,
        "upsertSuse" | "deleteSuse",
        () => Response | Promise<Response>,
        string,
        string,
      ]
    >([
      [
        "Add",
        async (screen) => {
          const dialog = await openSuseAdd(screen);
          await vectorOf(dialog).fill(VECTOR_V40);
          await submitOf(dialog).click();
        },
        "upsertSuse",
        () => suseResponse(SUSE_V40, 201),
        "SNTL-12: SUSE assessment v4.0 added.",
        MESSAGE_TONES.success,
      ],
      [
        "Edit",
        async (screen) => {
          const dialog = await openSuseEdit(screen);
          await vectorOf(dialog).fill(VECTOR_V31);
          await submitOf(dialog, "Save").click();
        },
        "upsertSuse",
        () => suseResponse(SAVED_V31),
        "SNTL-12: SUSE assessment v3.1 changed.",
        MESSAGE_TONES.success,
      ],
      [
        "Delete",
        async (screen) => {
          await confirmDelete(screen);
        },
        "deleteSuse",
        () => new Response(null, { status: 204 }),
        "SNTL-12: SUSE assessment v3.1 deleted.",
        MESSAGE_TONES.success,
      ],
      [
        "Add that Sentinel refuses",
        async (screen) => {
          const dialog = await openSuseAdd(screen);
          await vectorOf(dialog).fill(VECTOR_V40);
          await submitOf(dialog).click();
        },
        "upsertSuse",
        () => errorResponse(409, "TICKET_NOT_MUTABLE"),
        `SNTL-12: ${MESSAGE_CONFLICT}`,
        MESSAGE_TONES.danger,
      ],
      [
        "Delete that Sentinel did not confirm",
        async (screen) => {
          await confirmDelete(screen);
        },
        "deleteSuse",
        () => errorResponse(503, "SERVICE_UNAVAILABLE"),
        `SNTL-12: ${MESSAGE_UNCONFIRMED}`,
        MESSAGE_TONES.warning,
      ],
    ])(
      "shows the outcome of %s in the message area, naming the Ticket with a link to it",
      async (_, start, operation, outcome, text, tone) => {
        const response = later();
        const pending = () => response.promise;
        const spy = stubSuse(
          () => assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]),
          operation === "upsertSuse"
            ? { upsertSuse: pending }
            : { deleteSuse: pending },
        );
        const { router, screen } = await renderSuse();
        await start(screen);
        await expect
          .poll(() =>
            spy.mock.calls.filter(([input]) =>
              urlOf(input).pathname.startsWith(SUSE_ASSESSMENT),
            ),
          )
          .toHaveLength(1);
        await leaveForTickets(router, screen);

        response.resolve(await outcome());

        const message = screen.getByText(text);
        await expect.element(message).toBeVisible();
        expect(backgroundBehind(message.element())).toBe(tone);
        const link = screen.getByRole("link", { name: "SNTL-12", exact: true });
        await expect.element(link).toHaveAttribute("href", "/tickets/SNTL-12");

        await link.click();

        await expect.element(screenHeading(screen)).toBeVisible();
      },
    );
  });

  describe("Discard changes", () => {
    test.each<[string, (dialog: Locator) => Promise<void>]>([
      [
        "a vector",
        async (dialog) => {
          await vectorOf(dialog).fill(VECTOR_V31);
        },
      ],
      [
        "a metric",
        async (dialog) => {
          await segmentOf(dialog, "Scope", "Changed").click();
        },
      ],
      [
        "an assessment to start from",
        async (dialog) => {
          await (
            await openStartFrom(dialog)
          )
            .getByRole("option", { name: "NVD, 8.1 High", exact: true })
            .click();
        },
      ],
      [
        "a vector in the other tab",
        async (dialog) => {
          await vectorOf(dialog).fill(VECTOR_V31);
          await versionTab(dialog, "4.0").click();
          await expect.element(vectorOf(dialog)).toHaveValue("");
        },
      ],
    ])(
      "is asked before Cancel or Escape discard %s in Add, keeps it on Keep editing, and closes on Discard",
      async (_, enter) => {
        const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await enter(dialog);
        const vector = vectorOf(dialog).element();
        const entered = vector instanceof HTMLInputElement ? vector.value : "";

        await dialog.getByRole("button", { name: "Cancel" }).click();

        const discard = screen.getByRole("dialog", {
          name: "Discard changes?",
        });
        await expect
          .element(discard.getByRole("button", { name: "Keep editing" }))
          .toHaveFocus();
        await expect
          .element(
            discard.getByText(
              "The SUSE assessment that you entered isn't added.",
            ),
          )
          .toBeVisible();
        await discard.getByRole("button", { name: "Keep editing" }).click();
        await expect.element(discard).not.toBeInTheDocument();
        await expect.element(vectorOf(dialog)).toHaveValue(entered);

        vectorOf(dialog).element().focus();
        await userEvent.keyboard("{Escape}");
        await expect.element(discard).toBeVisible();
        await discard
          .getByRole("button", { name: "Discard", exact: true })
          .click();

        await expect.element(dialog).not.toBeInTheDocument();
        await expect.element(addSuse(screen)).toHaveFocus();
        expect(requestsWith(spy, "POST")).toHaveLength(0);
        // The dialog opens again empty.
        const again = await openSuseAdd(screen);
        await expect.element(vectorOf(again)).toHaveValue("");
        await versionTab(again, "4.0").click();
        await expect.element(vectorOf(again)).toHaveValue("");
      },
    );

    test("is asked before Cancel or Escape discard a changed vector in Edit, keeps it on Keep editing, and closes on Discard", async () => {
      const spy = stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(VECTOR_V31);

      await dialog.getByRole("button", { name: "Cancel" }).click();

      const discard = screen.getByRole("dialog", { name: "Discard changes?" });
      await expect
        .element(discard.getByRole("button", { name: "Keep editing" }))
        .toHaveFocus();
      await expect
        .element(
          discard.getByText(
            "Your changes to this SUSE assessment aren't saved.",
          ),
        )
        .toBeVisible();
      await discard.getByRole("button", { name: "Keep editing" }).click();
      await expect.element(discard).not.toBeInTheDocument();
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);

      vectorOf(dialog).element().focus();
      await userEvent.keyboard("{Escape}");
      await expect.element(discard).toBeVisible();
      await discard
        .getByRole("button", { name: "Discard", exact: true })
        .click();

      await expect.element(dialog).not.toBeInTheDocument();
      await expect.element(editSuse(screen)).toHaveFocus();
      expect(requestsWith(spy, "POST")).toHaveLength(0);
    });

    test.each([
      ["Add without input", true],
      ["Edit without a change", false],
    ])(
      "is not asked on Cancel or Escape in %s, which closes at once and returns the focus to the button that opened it",
      async (_, add) => {
        stubSuse(() => fictionalCvssAssessments());
        const { screen } = await renderSuse();
        for (const way of ["Cancel", "Escape"]) {
          const dialog = await (add
            ? openSuseAdd(screen)
            : openSuseEdit(screen));

          if (way === "Escape") {
            await userEvent.keyboard("{Escape}");
          } else {
            await dialog.getByRole("button", { name: "Cancel" }).click();
          }

          await expect.element(dialog).not.toBeInTheDocument();
          expect(
            screen.getByRole("dialog", { name: "Discard changes?" }).query(),
          ).toBeNull();
          await expect
            .element(add ? addSuse(screen) : editSuse(screen))
            .toHaveFocus();
        }
      },
    );

    test("is asked before a navigation of the UI in Edit, also one that stays on the screen, keeps the dialog, the vector, and the URL on Keep editing, and closes the dialog on Discard", async () => {
      const spy = stubSuse(() => fictionalCvssAssessments());
      const { router, screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(VECTOR_V31);

      router.history.push("/tickets/SNTL-12?hidden=shown");

      const discard = screen.getByRole("dialog", { name: "Discard changes?" });
      await expect
        .element(
          discard.getByText(
            "Your changes to this SUSE assessment aren't saved.",
          ),
        )
        .toBeVisible();
      await discard.getByRole("button", { name: "Keep editing" }).click();
      await expect.element(discard).not.toBeInTheDocument();
      await nextFrames();
      expect(router.state.location.href).toBe("/tickets/SNTL-12");
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);

      router.history.push("/tickets/SNTL-12?hidden=shown");
      await discard
        .getByRole("button", { name: "Discard", exact: true })
        .click();

      await expect.element(dialog).not.toBeInTheDocument();
      await expect
        .poll(() => router.state.location.href)
        .toBe("/tickets/SNTL-12?hidden=shown");
      expect(requestsWith(spy, "POST")).toHaveLength(0);
    });

    // Add with input in the tab that it sends alone is "shows the outcome of
    // Add in the message area" of a change that ends after the user left.
    test("is not asked before a navigation while Add is in progress and another tab holds input, and its outcome shows in the message area", async () => {
      const response = later();
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        upsertSuse: () => response.promise,
      });
      const { router, screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await enterInBothTabs(dialog);
      await submitOf(dialog).click();
      await expect
        .element(submitOf(dialog))
        .toHaveAttribute("aria-disabled", "true");

      await leaveForTickets(router, screen);

      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();
      response.resolve(suseResponse(SAVED_V31, 201));
      await expect
        .element(screen.getByText("SNTL-12: SUSE assessment v3.1 added."))
        .toBeVisible();
    });

    test("is not asked in Edit once the vector is the saved one again", async () => {
      stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await segmentOf(dialog, "Integrity", "High").click();
      await segmentOf(dialog, "Integrity", "None").click();
      await expect
        .element(vectorOf(dialog))
        .toHaveValue(SUSE_V31.vector_string);

      await dialog.getByRole("button", { name: "Cancel" }).click();

      await expect.element(dialog).not.toBeInTheDocument();
      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();
    });
  });

  describe("Delete", () => {
    test("asks for confirmation, naming the assessment, with the consequence, Cancel, which takes the focus, and Delete SUSE assessment as a danger button", async () => {
      stubSuse(() => assessmentsWith([NVD_V31, SUSE_V31]), {
        ticket: ticketIn("analysis"),
      });
      const { screen } = await renderSuse();

      await deleteSuse(screen).click();

      const confirmation = deleteConfirmation(screen);
      await expect
        .element(confirmation.getByRole("button", { name: "Cancel" }))
        .toHaveFocus();
      // The assessment of the default CVSS version, v3.1.
      await expect
        .element(
          confirmation.getByText(
            `${DELETE_CONSEQUENCE}${fallbackSentence("3.1")}${CANNOT_BE_UNDONE}`,
            { exact: true },
          ),
        )
        .toBeVisible();
      const action = confirmation.getByRole("button", {
        name: "Delete SUSE assessment",
        exact: true,
      });
      expect(getComputedStyle(action.element()).backgroundColor).toBe(
        "rgb(207, 34, 46)",
      );
      expect(confirmation.element().getBoundingClientRect().width).toBe(400);
    });

    test.each<
      [
        string,
        string,
        CVSSAssessmentItem[],
        CVECVSSAssessments["default_cvss_version"],
        string,
        boolean,
        boolean,
      ]
    >([
      [
        "the last SUSE assessment, of the default version, of an Analyzed Ticket",
        "analyzed",
        [NVD_V31, SUSE_V31],
        "3.1",
        "3.1",
        true,
        true,
      ],
      [
        "the last SUSE assessment, of the default version, of a Resolved Ticket",
        "resolved",
        [NVD_V31, SUSE_V31],
        "3.1",
        "3.1",
        true,
        true,
      ],
      [
        "the last SUSE assessment of a Ticket in Analysis",
        "analysis",
        [NVD_V31, SUSE_V31],
        "3.1",
        "3.1",
        true,
        false,
      ],
      [
        "the last SUSE assessment of a New Ticket",
        "new",
        [NVD_V31, SUSE_V31],
        "3.1",
        "3.1",
        true,
        false,
      ],
      [
        "one of two SUSE assessments, of the default version, of an Analyzed Ticket",
        "analyzed",
        [SUSE_V40, NVD_V31, SUSE_V31],
        "3.1",
        "3.1",
        true,
        false,
      ],
      [
        "a SUSE assessment beside one of v2.0 of an Analyzed Ticket",
        "analyzed",
        [NVD_V31, SUSE_V31, SUSE_V20],
        "3.1",
        "3.1",
        true,
        false,
      ],
      [
        "the SUSE assessment of v4.0 while the default version is v3.1",
        "analysis",
        [SUSE_V40, NVD_V31, SUSE_V31],
        "3.1",
        "4.0",
        false,
        false,
      ],
      [
        "the SUSE assessment of v4.0, the default version",
        "analysis",
        [SUSE_V40, NVD_V31, SUSE_V31],
        "4.0",
        "4.0",
        true,
        false,
      ],
      [
        "the last SUSE assessment, of v4.0, of an Analyzed Ticket whose default version is v3.1",
        "analyzed",
        [SUSE_V40, NVD_V31],
        "3.1",
        "4.0",
        false,
        true,
      ],
      [
        "the SUSE assessment of v3.1 while the default version is v4.0",
        "analysis",
        [SUSE_V40, NVD_V31, SUSE_V31],
        "4.0",
        "3.1",
        false,
        false,
      ],
    ])(
      "says for %s whether the eligibility score falls back and whether it returns the Ticket to Analysis",
      async (
        _,
        status,
        assessments,
        defaultVersion,
        version,
        fallback,
        returns,
      ) => {
        stubSuse(() => assessmentsWith(assessments, defaultVersion), {
          ticket: ticketIn(status),
        });
        const { screen } = await renderSuse();

        await deleteSuse(screen, version).click();

        await expect
          .element(
            deleteConfirmation(screen, version).getByText(
              `${DELETE_CONSEQUENCE}${fallback ? fallbackSentence(version) : ""}${returns ? RETURNS_TO_ANALYSIS : ""}${CANNOT_BE_UNDONE}`,
              { exact: true },
            ),
          )
          .toBeVisible();
      },
    );

    test("says nothing of the eligibility score falling back when the default version is one that the pinned contract does not list", async () => {
      stubSuse(
        () => ({
          ...assessmentsWith([NVD_V31, SUSE_V31]),
          default_cvss_version: "5.0",
        }),
        { ticket: ticketIn("analysis") },
      );
      const { screen } = await renderSuse();

      await deleteSuse(screen).click();

      await expect
        .element(
          deleteConfirmation(screen).getByText(
            `${DELETE_CONSEQUENCE}${CANNOT_BE_UNDONE}`,
            { exact: true },
          ),
        )
        .toBeVisible();
    });

    test("states the consequence as the read of the assessments shows them while it is open", async () => {
      let assessments = assessmentsWith([SUSE_V40, NVD_V31, SUSE_V31]);
      stubSuse(() => assessments, { ticket: ticketIn("analyzed") });
      const { screen } = await renderSuse();
      await deleteSuse(screen).click();
      const confirmation = deleteConfirmation(screen);
      const without = `${DELETE_CONSEQUENCE}${fallbackSentence("3.1")}${CANNOT_BE_UNDONE}`;
      await expect
        .element(confirmation.getByText(without, { exact: true }))
        .toBeVisible();
      // Meanwhile another analyst deleted the SUSE assessment of v4.0, and an
      // administrator made v4.0 the default version.
      assessments = assessmentsWith([NVD_V31, SUSE_V31], "4.0");

      await returnToForeground();

      await expect
        .element(
          confirmation.getByText(
            `${DELETE_CONSEQUENCE}${RETURNS_TO_ANALYSIS}${CANNOT_BE_UNDONE}`,
            { exact: true },
          ),
        )
        .toBeVisible();
      await expect.element(confirmation).toBeVisible();
    });

    test("states whether it returns the Ticket to Analysis as the read of the Ticket shows its status while it is open", async () => {
      let status = "analysis";
      stubSuse(() => assessmentsWith([NVD_V31, SUSE_V31]), {
        ticket: () => ticketIn(status)(),
      });
      const { screen } = await renderSuse();
      await deleteSuse(screen).click();
      const confirmation = deleteConfirmation(screen);
      await expect
        .element(
          confirmation.getByText(
            `${DELETE_CONSEQUENCE}${fallbackSentence("3.1")}${CANNOT_BE_UNDONE}`,
            { exact: true },
          ),
        )
        .toBeVisible();
      // Meanwhile another analyst completed the analysis.
      status = "analyzed";

      await returnToForeground();

      await expect
        .element(
          confirmation.getByText(
            `${DELETE_CONSEQUENCE}${fallbackSentence("3.1")}${RETURNS_TO_ANALYSIS}${CANNOT_BE_UNDONE}`,
            { exact: true },
          ),
        )
        .toBeVisible();
      await expect.element(confirmation).toBeVisible();
    });

    test("deletes the assessment of its version with Delete SUSE CVSS Assessment, then removes its row once the assessments are read again", async () => {
      let assessments = assessmentsWith([SUSE_V40, NVD_V31, SUSE_V31]);
      const removed: string[] = [];
      stubSuse(() => assessments, {
        deleteSuse: (path) => {
          removed.push(path);
          assessments = assessmentsWith([SUSE_V40, NVD_V31]);
          return new Response(null, { status: 204 });
        },
      });
      const { screen } = await renderSuse();

      const confirmation = await confirmDelete(screen);

      await expect.element(confirmation).not.toBeInTheDocument();
      await expect
        .element(assessmentRow(screen, "SUSE", "3.1"))
        .not.toBeInTheDocument();
      expect(removed).toEqual([`${SUSE_ASSESSMENT}/3.1`]);
      await expect
        .poll(() => cvssAnnouncements(screen))
        .toEqual(["SUSE assessment v3.1 deleted."]);
    });

    test("keeps the assessment after Cancel, without a request", async () => {
      const spy = stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();

      await deleteSuse(screen).click();
      await deleteConfirmation(screen)
        .getByRole("button", { name: "Cancel" })
        .click();

      await expect.element(deleteConfirmation(screen)).not.toBeInTheDocument();
      await expect.element(deleteSuse(screen)).toHaveFocus();
      expect(requestsWith(spy, "DELETE")).toHaveLength(0);
    });

    test("keeps the confirmation open while Delete is in progress", async () => {
      const response = later();
      stubSuse(() => fictionalCvssAssessments(), {
        deleteSuse: () => response.promise,
      });
      const { screen } = await renderSuse();

      const confirmation = await confirmDelete(screen);

      await expect
        .element(
          confirmation.getByRole("button", {
            name: "Delete SUSE assessment",
            exact: true,
          }),
        )
        .toHaveAttribute("aria-disabled", "true");
      await userEvent.keyboard("{Escape}");
      await expect.element(confirmation).toBeVisible();
      response.resolve(new Response(null, { status: 204 }));
      await expect.element(confirmation).not.toBeInTheDocument();
    });

    test.each([
      [
        "an assessment that no longer exists, as an error",
        () => errorResponse(404, "CVSS_ASSESSMENT_NOT_FOUND"),
        MESSAGE_GONE,
        MESSAGE_TONES.danger,
      ],
      [
        "a Ticket that does not accept the change, as an error",
        () => errorResponse(409, "TICKET_NOT_MUTABLE"),
        MESSAGE_CONFLICT,
        MESSAGE_TONES.danger,
      ],
      [
        "a change that Sentinel did not confirm, as a warning",
        () => errorResponse(503, "SERVICE_UNAVAILABLE"),
        MESSAGE_UNCONFIRMED,
        MESSAGE_TONES.warning,
      ],
      [
        "a status and a code that the pinned contract does not list, as an error",
        () => errorResponse(418, "FICTIONAL_CODE"),
        MESSAGE_NOT_ACCEPTED,
        MESSAGE_TONES.danger,
      ],
    ])(
      "shows the failure of %s at the top of the confirmation, which stays open and takes the focus",
      async (_, response, message, tone) => {
        stubSuse(() => fictionalCvssAssessments(), { deleteSuse: response });
        const { screen } = await renderSuse();

        const confirmation = await confirmDelete(screen);

        const error = confirmation.getByText(message);
        await expect.element(error).toBeVisible();
        expect(backgroundBehind(error.element())).toBe(tone);
        await expectFocusOnError(error);
        await expect.element(confirmation).toBeVisible();
      },
    );

    describe("the focus after Delete", () => {
      test("moves to the Delete of the row that takes its place", async () => {
        const { screen } = await deleteSuseAmong([SUSE_V40, SUSE_V31], "4.0");

        await expectFocusSettledOn(deleteSuse(screen, "3.1"));
      });

      test("moves to the row that takes its place when it has no Delete", async () => {
        const { screen } = await deleteSuseAmong(
          [NVD_V40, SUSE_V40, NVD_V31],
          "4.0",
        );

        await expectFocusSettledOn(assessmentRow(screen, "NVD", "3.1"));
      });

      test("moves to Add SUSE assessment when no row follows, also when Add SUSE assessment shows only after the read", async () => {
        const { screen } = await deleteSuseAmong(
          [NVD_V40, SUSE_V40, NVD_V31, SUSE_V31],
          "3.1",
        );

        await expectFocusSettledOn(addSuse(screen));
      });

      test("moves no more once the read after Delete fails, and moves to the screen's heading when a later read removes the row of the focus", async () => {
        let phase: "before" | "failing" | "gone" = "before";
        stubSuse(() => fictionalCvssAssessments(), {
          cvss: () => {
            if (phase === "failing") {
              return errorResponse(503, "DATABASE_UNAVAILABLE");
            }
            return cvssResponse(
              phase === "gone"
                ? assessmentsWith([NVD_V31])
                : fictionalCvssAssessments(),
            );
          },
          deleteSuse: () => {
            phase = "failing";
            return new Response(null, { status: 204 });
          },
        });
        const { screen } = await renderSuse();

        await confirmDelete(screen);

        await expect
          .element(cvssPart(screen).getByText(/^This couldn't be updated\./))
          .toBeVisible();
        const row = assessmentRow(screen, "SUSE", "3.1");
        await expect
          .poll(() => row.element().contains(document.activeElement))
          .toBe(true);
        await frames();
        expect(row.element().contains(document.activeElement)).toBe(true);
        // Meanwhile another analyst deleted it, or Sentinel had.
        phase = "gone";

        await returnToForeground();

        await expect.element(row).not.toBeInTheDocument();
        await expectFocusSettledOn(screenHeading(screen));
      });
    });
  });

  describe("the focus after a read", () => {
    test("moves to the screen's heading when a read removes the row whose Edit has the focus", async () => {
      let assessments = fictionalCvssAssessments();
      stubSuse(() => assessments);
      const { screen } = await renderSuse();
      await focusInRow(screen, editSuse(screen));
      // Meanwhile another analyst deleted it.
      assessments = assessmentsWith([NVD_V31]);

      await returnToForeground();

      await expect
        .element(assessmentRow(screen, "SUSE", "3.1"))
        .not.toBeInTheDocument();
      await expectFocusSettledOn(screenHeading(screen));
    });

    test("moves to the screen's heading when a read removes Add SUSE assessment while it has the focus", async () => {
      let assessments = fictionalCvssAssessments();
      stubSuse(() => assessments);
      const { screen } = await renderSuse();
      addSuse(screen).element().focus();
      await expect.element(addSuse(screen)).toHaveFocus();
      // Meanwhile another analyst added the assessment of v4.0.
      assessments = assessmentsWith([SUSE_V40, NVD_V31, SUSE_V31]);

      await returnToForeground();

      await expect.element(addSuse(screen)).not.toBeInTheDocument();
      await expectFocusSettledOn(screenHeading(screen));
    });
  });
});

// ----------------------------------------------------------------------------
// The edits of the package tree

// The response of an exclusion or a restore of fictional-openssl, with its
// actionability after it.
function packageMarkerResponse(actionable: boolean): Response {
  const body: PackageExclusionResponse = {
    data: {
      package_name: "fictional-openssl",
      actionable,
      non_actionable_reason: actionable ? null : "package_excluded",
    },
  };
  return jsonResponse(200, body);
}

// The response of an exclusion or a restore of the SP7 track of
// fictional-openssl, with its actionability after it.
function trackMarkerResponse(actionable: boolean): Response {
  const body: TrackExclusionResponse = {
    data: {
      reference: "SUSE:FLES-15-SP7:Update",
      actionable,
      non_actionable_reason: actionable ? null : "track_excluded",
    },
  };
  return jsonResponse(200, body);
}

// The response of Change Track Status with the SP7 track of
// fictional-openssl and the affectedness, which can be a value that the
// pinned contract does not list.
function trackStatusResponse(status: string): Response {
  const { products, ...track } = fictionalTrack();
  const data: Omit<TrackStatusTrack, "status"> & { status: string } = {
    ticket_id: "SNTL-12",
    package_name: "fictional-openssl",
    reference: track.reference,
    status,
    delivery_status: track.delivery_status,
    delivery_relevant: track.delivery_relevant,
    actionable: track.actionable,
    non_actionable_reason: track.non_actionable_reason,
    products: products.map(
      ({ released_at: _released, deleted_at: _deleted, ...product }) => product,
    ),
  };
  return jsonResponse(200, { data });
}

// The response of an edit of the package tree by its method and its path
// under the packages of the Ticket: the record after it, actionable after a
// restore and not after an exclusion, or the track with the affectedness
// that the body sends.
function packageChangeResponse(
  method: string,
  path: string,
  body: unknown,
): Response {
  if (method === "PATCH") {
    const status =
      typeof body === "object" && body !== null && "status" in body
        ? String(body.status)
        : "";
    return trackStatusResponse(status);
  }
  const actionable = path.endsWith("/restore");
  return path.includes("/tracks/")
    ? trackMarkerResponse(actionable)
    : packageMarkerResponse(actionable);
}

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

const OPENSSL_ID = "00000000-0000-0000-0000-0000000000a1";
const ZLIB_ID = "00000000-0000-0000-0000-0000000000a2";
const SP7_ID = "00000000-0000-0000-0000-0000000000b1";
const FLES_ID = "00000000-0000-0000-0000-0000000000b2";
const ZLIB_TRACK_ID = "00000000-0000-0000-0000-0000000000b3";
const OPENSSL_SP7 = "fictional-openssl, SUSE:FLES-15-SP7:Update";
const OPENSSL_FLES = "fictional-openssl, fles-16.0";

// A track of fictional-openssl after its SP7 track, fles-16.0, in Analysis.
function flesTrack(fields: Partial<TrackDetail> = {}): TrackDetail {
  return fictionalTrack({
    id: FLES_ID,
    workflow_type: "git",
    reference: "fles-16.0",
    status: "analysis",
    products: [
      fictionalProduct({
        id: "00000000-0000-0000-0000-0000000000c2",
        product_cpe: "cpe:/o:example:fles:16.0",
        product_name: "Fictional Linux Enterprise Server 16.0",
      }),
    ],
    ...fields,
  });
}

// fictional-zlib, after fictional-openssl, without a maintainer.
function zlibPackage(fields: Partial<PackageDetail> = {}): PackageDetail {
  return fictionalPackage({
    id: ZLIB_ID,
    package_name: "fictional-zlib",
    maintainers: [],
    tracks: [
      fictionalTrack({
        id: ZLIB_TRACK_ID,
        reference: "SUSE:FLES-15-SP6:Update",
        products: [
          fictionalProduct({ id: "00000000-0000-0000-0000-0000000000c3" }),
        ],
      }),
    ],
    ...fields,
  });
}

// The tree of the tests: fictional-openssl with its SP7 and fles-16.0
// tracks, then fictional-zlib.
function editableTree(
  openssl: Partial<PackageDetail> = {},
  zlib: Partial<PackageDetail> = {},
): PackageDetail[] {
  return [
    fictionalPackage({ tracks: [fictionalTrack(), flesTrack()], ...openssl }),
    zlibPackage(zlib),
  ];
}

// The tree after an exclusion of the SP7 track of fictional-openssl.
function treeWithoutSp7(): PackageDetail[] {
  return editableTree({
    tracks: [
      excludedTrack({ id: SP7_ID, reference: "SUSE:FLES-15-SP7:Update" }),
      flesTrack(),
    ],
  });
}

// Answers Get Ticket with the package tree that the function returns at each
// read, for a user who holds manage_packages unless the test says otherwise.
function showingEditable(
  tree: () => PackageDetail[] = () => editableTree(),
  stub: Partial<Stub> = {},
  ticket: Partial<TicketDetail> = {},
) {
  return stubTicket({
    user: PACKAGE_MANAGER,
    ticket: () =>
      ticketResponse(fictionalTicketDetail({ packages: tree(), ...ticket })),
    ...stub,
  });
}

// The menu of the actions of a record, by the record that its name states.
function actionsOf(screen: Screen, record: string) {
  return packagesPart(screen).getByRole("button", {
    name: `Actions of ${record}`,
    exact: true,
  });
}

// The select of the affectedness of a track, by the track that its name
// states, whatever its value.
function affectednessOf(screen: Screen, track: string) {
  return packagesPart(screen).getByRole("button", {
    name: new RegExp(
      `^Affectedness of ${track.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: `,
    ),
  });
}

function menuOf(screen: Screen, name: string) {
  return screen.getByRole("menu", { name, exact: true });
}

// The requests of the edits of the package tree: their method and their path
// under the packages of the Ticket, with their body.
function packageChanges(
  spy: ReturnType<typeof stubApi>,
): [string, string, unknown][] {
  return spy.mock.calls
    .filter(
      ([input, init]) =>
        urlOf(input).pathname.startsWith(`${TICKET}/packages/`) &&
        init?.method !== undefined &&
        init.method !== "GET",
    )
    .map(([input, init]) => [
      init?.method ?? "GET",
      urlOf(input).pathname.slice(`${TICKET}/packages/`.length),
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    ]);
}

// Opens the menu of the actions of a record, and chooses the item.
async function chooseAction(screen: Screen, record: string, item: string) {
  await actionsOf(screen, record).click();
  await screen.getByRole("menuitem", { name: item, exact: true }).click();
}

// Opens the select of the affectedness of a track, and chooses the value.
async function chooseAffectedness(
  screen: Screen,
  track: string,
  value: string,
) {
  await affectednessOf(screen, track).click();
  await screen.getByRole("menuitemradio", { name: value, exact: true }).click();
}

// The names of the items of a menu, in their order, which a poll reads
// once the menu has opened.
function itemsOf(
  menu: Pick<Locator, "getByRole">,
  role: "menuitem" | "menuitemradio",
): (string | null)[] {
  return menu
    .getByRole(role)
    .elements()
    .map((item) => item.textContent);
}

describe("the edits of the package tree", () => {
  test("offer the menu of the actions of each package and track, an icon button of 24 px named by its record, whose tooltip says Actions, and the affectedness of each track as a select, to a user who holds manage_packages", async () => {
    showingEditable();
    const { screen } = await renderTree();

    const openssl = actionsOf(screen, "fictional-openssl");
    await expect.element(openssl).toBeVisible();
    expect(boxOf(openssl).width).toBe(24);
    expect(boxOf(openssl).height).toBe(24);
    expect(band(screen, "fictional-openssl").contains(openssl.element())).toBe(
      true,
    );
    // The menu of a track ends where the menu of its package ends: the
    // tracks keep the padding of the band on both sides.
    expect(boxOf(actionsOf(screen, OPENSSL_SP7)).right).toBe(
      boxOf(openssl).right,
    );
    await expect.element(actionsOf(screen, OPENSSL_FLES)).toBeVisible();
    await expect.element(actionsOf(screen, "fictional-zlib")).toBeVisible();
    const select = affectednessOf(screen, OPENSSL_SP7);
    await expect
      .element(select)
      .toHaveAccessibleName(`Affectedness of ${OPENSSL_SP7}: Affected`);
    await expect.element(select).toHaveTextContent("Affected");
    // A quiet select, without a boundary or a fill, in fg.
    const style = getComputedStyle(select.element());
    expect(style.borderTopWidth).toBe("0px");
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(style.color).toBe(FG);
    expect(boxOf(select).height).toBe(28);

    // React Aria shows a tooltip on hover only once the user works with a
    // pointer, as a click shows.
    await screenHeading(screen).click();
    await userEvent.hover(openssl);

    await expect
      .element(screen.getByRole("tooltip"))
      .toHaveTextContent("Actions");
  });

  test("open the actions of a record as a menu named by its record, with Exclude, and with Restore for a record that its own marker excludes", async () => {
    showingEditable(() =>
      editableTree(
        {},
        {
          deleted_at: "2099-10-09T10:00:00Z",
          actionable: false,
          non_actionable_reason: "package_excluded",
        },
      ),
    );
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    await actionsOf(screen, OPENSSL_SP7).click();

    const menu = menuOf(screen, `Actions of ${OPENSSL_SP7}`);
    await expect.element(menu).toBeVisible();
    await expect.poll(() => itemsOf(menu, "menuitem")).toEqual(["Exclude"]);

    await userEvent.keyboard("{Escape}");
    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(actionsOf(screen, OPENSSL_SP7)).toHaveFocus();

    await actionsOf(screen, "fictional-zlib").click();

    const zlib = menuOf(screen, "Actions of fictional-zlib");
    await expect.poll(() => itemsOf(zlib, "menuitem")).toEqual(["Restore"]);
    // A track below an excluded package keeps Exclude, which Sentinel
    // accepts there (Soft-Delete Track).
    await userEvent.keyboard("{Escape}");
    await actionsOf(screen, "fictional-zlib, SUSE:FLES-15-SP6:Update").click();
    await expect
      .element(screen.getByRole("menuitem", { name: "Exclude", exact: true }))
      .toBeVisible();
  });

  test("offer, with manage_packages on a Ticket with a CVE, every affectedness but Fixed, the current one chosen, in the order of the contract", async () => {
    showingEditable();
    const { screen } = await renderTree();

    await affectednessOf(screen, OPENSSL_SP7).click();

    const menu = menuOf(screen, `Affectedness of ${OPENSSL_SP7}: Affected`);
    await expect.element(menu).toBeVisible();
    await expect
      .poll(() => itemsOf(menu, "menuitemradio"))
      .toEqual(["Analysis", "Affected", "Not affected", "Won't fix"]);
    await expect
      .element(
        menu.getByRole("menuitemradio", { name: "Affected", exact: true }),
      )
      .toBeChecked();
    await expect
      .element(menu.getByRole("menuitemradio", { name: "Analysis" }))
      .not.toBeChecked();
  });

  test("offer Fixed with manage_packages on a Ticket without a CVE", async () => {
    showingEditable(undefined, {}, { cve: null });
    const { screen } = await renderTree();

    await affectednessOf(screen, OPENSSL_SP7).click();

    await expect
      .poll(() => itemsOf(screen, "menuitemradio"))
      .toEqual(["Analysis", "Affected", "Not affected", "Fixed", "Won't fix"]);
  });

  test("offer a user who holds admin_ticket_ops alone the select with Fixed, and no menu of actions", async () => {
    showingEditable(undefined, { user: TICKET_ADMIN });
    const { screen } = await renderTree();

    await affectednessOf(screen, OPENSSL_SP7).click();

    await expect
      .poll(() => itemsOf(screen, "menuitemradio"))
      .toEqual(["Affected", "Fixed"]);
    expect(
      packagesPart(screen)
        .getByRole("button", { name: /^Actions of/ })
        .elements(),
    ).toHaveLength(0);
  });

  test("show the affectedness as text, without a select, of a Fixed track to a user who holds admin_ticket_ops alone, who could set no other value", async () => {
    showingEditable(
      () => editableTree({ tracks: [fictionalTrack({ status: "fixed" })] }),
      { user: TICKET_ADMIN },
    );
    const { screen } = await renderTree();

    await expect
      .element(trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText("Fixed"))
      .toBeVisible();
    await expect
      .element(affectednessOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
  });

  test("offer none of these controls to a user without manage_packages and admin_ticket_ops", async () => {
    showingEditable(undefined, { user: OTHER_USER });
    const { screen } = await renderTree();

    await expect
      .element(trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText("Affected"))
      .toBeVisible();
    expect(
      packagesPart(screen)
        .getByRole("button", { name: /^(Actions|Affectedness) of/ })
        .elements(),
    ).toHaveLength(0);
  });

  test.each(["ignored", "duplicated", "fictional_status"])(
    "offer none of these controls on a Ticket in %s",
    async (status) => {
      stubTicket({
        user: PACKAGE_MANAGER,
        ticket: () =>
          jsonResponse(200, {
            data: {
              ...fictionalTicketDetail({ packages: editableTree() }),
              status,
            },
          }),
      });
      const { screen } = await renderTree();

      await expect
        .element(
          trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText("Affected"),
        )
        .toBeVisible();
      expect(
        packagesPart(screen)
          .getByRole("button", { name: /^(Actions|Affectedness) of/ })
          .elements(),
      ).toHaveLength(0);
    },
  );

  test("show an affectedness that the pinned contract does not list as received, without a select", async () => {
    stubTicket({
      user: PACKAGE_MANAGER,
      ticket: () =>
        jsonResponse(200, {
          data: {
            ...fictionalTicketDetail(),
            packages: [
              {
                ...fictionalPackage(),
                tracks: [
                  { ...fictionalTrack(), status: "fictional_affectedness" },
                ],
              },
            ],
          },
        }),
    });
    const { screen } = await renderTree();

    await expect
      .element(packagesPart(screen).getByText("fictional_affectedness"))
      .toBeVisible();
    await expect
      .element(affectednessOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expect.element(actionsOf(screen, OPENSSL_SP7)).toBeVisible();
  });

  test("exclude a track at once, with its item busy and the menu open until Sentinel answers, then close the menu, return the focus to its button, and announce the outcome once the read of the Ticket after it arrives, while Show hidden is on", async () => {
    const response = later();
    let tree = editableTree();
    const spy = showingEditable(() => tree, {
      packageChange: () => response.promise,
    });
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");
    const reads = requestsTo(spy, TICKET);

    await chooseAction(screen, OPENSSL_SP7, "Exclude");

    const menu = menuOf(screen, `Actions of ${OPENSSL_SP7}`);
    const item = menu.getByRole("menuitem", { name: "Exclude", exact: true });
    await expect.element(item).toHaveAccessibleDescription("Excluding.");
    expect(packageChanges(spy)).toEqual([
      ["POST", `${OPENSSL_ID}/tracks/${SP7_ID}/exclude`, undefined],
    ]);
    await userEvent.keyboard("{Escape}");
    interactOutside();
    await nextFrames();
    await expect.element(menu).toBeVisible();
    await item.click();
    expect(packageChanges(spy)).toHaveLength(1);

    tree = treeWithoutSp7();
    response.resolve(trackMarkerResponse(false));

    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(actionsOf(screen, OPENSSL_SP7)).toHaveFocus();
    await expect
      .poll(() => announcements(screen))
      .toContain("Track fictional-openssl · SUSE:FLES-15-SP7:Update excluded.");
    expect(requestsTo(spy, TICKET)).toBeGreaterThan(reads);
    // The track stays, in gray, with its label.
    await expect
      .element(
        trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText("Excluded", {
          exact: true,
        }),
      )
      .toBeVisible();
    expect(
      screen
        .getByText(
          "Track fictional-openssl · SUSE:FLES-15-SP7:Update excluded.",
        )
        .elements()
        .filter((element) => element.closest("output") === null),
    ).toHaveLength(0);
  });

  test("read again after an edit the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, and the reads of the Ticket list, but not its duplicates", async () => {
    const spy = showingEditable(undefined, {
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

    await chooseAffectedness(screen, OPENSSL_SP7, "Not affected");

    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(reads.work + 1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    expect(readsOf(spy, TICKETS)).toBe(reads.duplicates);
    expect(leftInvalidated(EVENTS)).toBe(true);
    expect(leftInvalidated(TICKETS)).toBe(true);
  });

  test("show in the message area the outcome of an exclusion that hides its record while Show hidden is off, and move the focus to the menu of the next track of its package", async () => {
    let tree = editableTree();
    showingEditable(() => tree, {
      packageChange: () => {
        tree = treeWithoutSp7();
        return trackMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseAction(screen, OPENSSL_SP7, "Exclude");

    const message = screen.getByText(
      "Track fictional-openssl · SUSE:FLES-15-SP7:Update excluded.",
      { exact: true },
    );
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
    await expect
      .element(actionsOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, OPENSSL_FLES));
  });

  test("move the focus after an exclusion of the last track of a package that shows to the menu of its package", async () => {
    let tree = editableTree();
    showingEditable(() => tree, {
      packageChange: () => {
        tree = editableTree({
          tracks: [
            fictionalTrack(),
            excludedTrack({ id: FLES_ID, reference: "fles-16.0" }),
          ],
        });
        return trackMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseAction(screen, OPENSSL_FLES, "Exclude");

    await expect
      .element(actionsOf(screen, OPENSSL_FLES))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, "fictional-openssl"));
  });

  test("move the focus after an exclusion that hides a package to the menu of the next package that shows, and otherwise to Show hidden", async () => {
    let tree = editableTree();
    const hidden = {
      deleted_at: "2099-10-09T10:00:00Z",
      actionable: false,
      non_actionable_reason: "package_excluded",
    } as const;
    showingEditable(() => tree, {
      packageChange: (_method, path) => {
        tree = path.startsWith(OPENSSL_ID)
          ? editableTree(hidden)
          : editableTree(hidden, hidden);
        return packageMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseAction(screen, "fictional-openssl", "Exclude");

    await expect
      .element(actionsOf(screen, "fictional-openssl"))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, "fictional-zlib"));

    await chooseAction(screen, "fictional-zlib", "Exclude");

    await expect
      .element(packagesPart(screen).getByText("All packages are hidden."))
      .toBeVisible();
    await expectFocusSettledOn(showHidden(screen));
  });

  test("leave the focus where it is when the read of the Ticket after an exclusion fails, and let no later read move it as after the exclusion", async () => {
    let fail = false;
    let tree = editableTree();
    showingEditable(undefined, {
      ticket: () =>
        fail
          ? errorResponse(503, "FICTIONAL_UNAVAILABLE")
          : ticketResponse(fictionalTicketDetail({ packages: tree })),
      packageChange: () => {
        fail = true;
        tree = treeWithoutSp7();
        return trackMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseAction(screen, OPENSSL_SP7, "Exclude");

    await expect
      .element(screen.getByText("This couldn't be updated.", { exact: false }))
      .toBeVisible();
    await expectFocusSettledOn(actionsOf(screen, OPENSSL_SP7));

    // A later read shows the track hidden: the focus leaves its menu for the
    // screen's heading, as when any read removes it.
    fail = false;
    await returnToForeground();

    await expect
      .element(actionsOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("restore a package that its own marker excludes, and announce it", async () => {
    let tree = editableTree({
      deleted_at: "2099-10-09T10:00:00Z",
      actionable: false,
      non_actionable_reason: "package_excluded",
    });
    const spy = showingEditable(() => tree, {
      packageChange: () => {
        tree = editableTree();
        return packageMarkerResponse(true);
      },
    });
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    await chooseAction(screen, "fictional-openssl", "Restore");

    expect(packageChanges(spy)).toEqual([
      ["POST", `${OPENSSL_ID}/restore`, undefined],
    ]);
    await expect
      .poll(() => announcements(screen))
      .toContain("Package fictional-openssl restored.");
    await expect.element(actionsOf(screen, "fictional-openssl")).toHaveFocus();
  });

  test("change the affectedness of a track at once, with its choice busy and the menu open until Sentinel answers, then announce the value that Sentinel returns", async () => {
    const response = later();
    const spy = showingEditable(undefined, {
      packageChange: () => response.promise,
    });
    const { screen } = await renderTree();

    await chooseAffectedness(screen, OPENSSL_SP7, "Not affected");

    const menu = menuOf(screen, `Affectedness of ${OPENSSL_SP7}: Affected`);
    await expect
      .element(menu.getByRole("menuitemradio", { name: "Not affected" }))
      .toHaveAccessibleDescription("Changing the affectedness.");
    expect(packageChanges(spy)).toEqual([
      ["PATCH", `${OPENSSL_ID}/tracks/${SP7_ID}`, { status: "not_affected" }],
    ]);
    await userEvent.keyboard("{Escape}");
    await nextFrames();
    await expect.element(menu).toBeVisible();
    await menu.getByRole("menuitemradio", { name: "Won't fix" }).click();
    expect(packageChanges(spy)).toHaveLength(1);

    response.resolve(trackStatusResponse("not_affected"));

    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(affectednessOf(screen, OPENSSL_SP7)).toHaveFocus();
    await expect
      .poll(() => announcements(screen))
      .toContain(
        "Affectedness of fictional-openssl · SUSE:FLES-15-SP7:Update changed to Not affected.",
      );
  });

  test("announce the outcome of each of two edits whose reads overlap, together, in their order", async () => {
    const reads: ReturnType<typeof later>[] = [];
    let first = true;
    showingEditable(undefined, {
      ticket: () => {
        if (first) {
          first = false;
          return ticketResponse(
            fictionalTicketDetail({ packages: editableTree() }),
          );
        }
        const read = later();
        reads.push(read);
        return read.promise;
      },
    });
    const { screen } = await renderTree();

    await chooseAffectedness(screen, OPENSSL_SP7, "Not affected");
    await expect.poll(() => reads.length).toBe(1);
    await chooseAffectedness(screen, OPENSSL_FLES, "Affected");
    await expect.poll(() => reads.length).toBe(2);
    for (const read of reads) {
      read.resolve(
        ticketResponse(fictionalTicketDetail({ packages: editableTree() })),
      );
    }

    await expect
      .poll(() => announcements(screen))
      .toContain(
        "Affectedness of fictional-openssl · SUSE:FLES-15-SP7:Update changed to Not affected. Affectedness of fictional-openssl · fles-16.0 changed to Affected.",
      );
  });

  test("send nothing when the user chooses the affectedness that the track has, and close the menu", async () => {
    const spy = showingEditable();
    const { screen } = await renderTree();

    await chooseAffectedness(screen, OPENSSL_SP7, "Affected");

    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    expect(packageChanges(spy)).toEqual([]);
  });

  test.each<[string, () => Response, string, keyof typeof MESSAGE_TONES]>([
    [
      "409 TICKET_NOT_MUTABLE",
      () => errorResponse(409, "TICKET_NOT_MUTABLE"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
    [
      "a 503",
      () => errorResponse(503, "FICTIONAL_UNAVAILABLE"),
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      "warning",
    ],
    [
      "409 PACKAGE_ALREADY_EXCLUDED, which the change of the affectedness does not handle",
      () => errorResponse(409, "PACKAGE_ALREADY_EXCLUDED"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
  ])(
    "show a failure of the change of the affectedness in the message area: %s",
    async (_name, failure, text, tone) => {
      showingEditable(undefined, { packageChange: failure });
      const { screen } = await renderTree();

      await chooseAffectedness(screen, OPENSSL_SP7, "Not affected");

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES[tone]);
      await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
      await expect.element(affectednessOf(screen, OPENSSL_SP7)).toHaveFocus();
    },
  );

  test.each<
    [string, string, string, () => Response, string, keyof typeof MESSAGE_TONES]
  >([
    [
      "409 PACKAGE_ALREADY_EXCLUDED of Exclude",
      "fictional-openssl",
      "Exclude",
      () => errorResponse(409, "PACKAGE_ALREADY_EXCLUDED"),
      "Package fictional-openssl is already excluded.",
      "info",
    ],
    [
      "422 PACKAGE_NOT_EXCLUDED of Restore",
      "fictional-zlib",
      "Restore",
      () => errorResponse(422, "PACKAGE_NOT_EXCLUDED"),
      "Package fictional-zlib is no longer excluded.",
      "info",
    ],
    [
      "409 PACKAGE_ALREADY_EXCLUDED of Restore, which Restore does not handle",
      "fictional-zlib",
      "Restore",
      () => errorResponse(409, "PACKAGE_ALREADY_EXCLUDED"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
    [
      "422 PACKAGE_NOT_EXCLUDED of Exclude, which Exclude does not handle",
      "fictional-openssl",
      "Exclude",
      () => errorResponse(422, "PACKAGE_NOT_EXCLUDED"),
      "Sentinel didn't accept this request.",
      "danger",
    ],
    [
      "a code that the pinned contract does not list",
      "fictional-openssl",
      "Exclude",
      () => errorResponse(409, "FICTIONAL_CONFLICT"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
    [
      "a 404",
      "fictional-openssl",
      "Exclude",
      () => errorResponse(404, "RESOURCE_NOT_FOUND"),
      "This no longer exists, or you no longer have access to it.",
      "danger",
    ],
    [
      "a network failure",
      "fictional-openssl",
      "Exclude",
      () => {
        throw new TypeError("Failed to fetch");
      },
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      "warning",
    ],
  ])(
    "show a failure of an exclusion or a restore in the message area: %s",
    async (_name, record, action, failure, text, tone) => {
      showingEditable(
        () =>
          editableTree(
            {},
            {
              deleted_at: "2099-10-09T10:00:00Z",
              actionable: false,
              non_actionable_reason: "package_excluded",
            },
          ),
        { packageChange: failure },
      );
      const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

      await chooseAction(screen, record, action);

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES[tone]);
      await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
      await expect.element(actionsOf(screen, record)).toHaveFocus();
    },
  );

  test("ask for confirmation before excluding a package with maintainers of a confidential Ticket, which ends their access, and send nothing on Cancel", async () => {
    const spy = showingEditable(undefined, {}, { is_confidential: true });
    const { screen } = await renderTree();

    await chooseAction(screen, "fictional-openssl", "Exclude…");

    const confirmation = screen.getByRole("dialog", {
      name: "Exclude fictional-openssl?",
    });
    await expect.element(confirmation).toBeVisible();
    await expect
      .element(
        confirmation.getByText(
          "The maintainers of fictional-openssl no longer see this confidential Ticket, unless their roles, an access grant, or another package that they maintain let them. Restore gives them this access back.",
          { exact: true },
        ),
      )
      .toBeVisible();
    await expect
      .element(confirmation.getByRole("button", { name: "Cancel" }))
      .toHaveFocus();

    await confirmation.getByRole("button", { name: "Cancel" }).click();

    await expect.element(confirmation).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, "fictional-openssl"));
    expect(packageChanges(spy)).toEqual([]);
    // A package without maintainers, and every track, exclude at once.
    await actionsOf(screen, "fictional-zlib").click();
    await expect
      .element(screen.getByRole("menuitem", { name: "Exclude", exact: true }))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    await actionsOf(screen, OPENSSL_SP7).click();
    await expect
      .element(screen.getByRole("menuitem", { name: "Exclude", exact: true }))
      .toBeVisible();
  });

  test("exclude a package of a confidential Ticket once confirmed, with the confirmation busy until Sentinel answers, and show a failure at its top, which stays open", async () => {
    const response = later();
    let pending = false;
    const spy = showingEditable(
      undefined,
      {
        packageChange: () =>
          pending
            ? response.promise
            : errorResponse(503, "FICTIONAL_UNAVAILABLE"),
      },
      { is_confidential: true },
    );
    const { screen } = await renderTree();
    await chooseAction(screen, "fictional-openssl", "Exclude…");
    const confirmation = screen.getByRole("dialog", {
      name: "Exclude fictional-openssl?",
    });

    await confirmation.getByRole("button", { name: "Exclude package" }).click();

    const error = confirmation.getByText(
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
    );
    await expect.element(error).toBeVisible();
    await expectFocusOnError(error);

    pending = true;
    await confirmation.getByRole("button", { name: "Exclude package" }).click();

    await expect
      .element(confirmation.getByRole("button", { name: "Cancel" }))
      .toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await nextFrames();
    await expect.element(confirmation).toBeVisible();
    response.resolve(packageMarkerResponse(false));
    await expect.element(confirmation).not.toBeInTheDocument();
    expect(packageChanges(spy)).toEqual([
      ["POST", `${OPENSSL_ID}/exclude`, undefined],
      ["POST", `${OPENSSL_ID}/exclude`, undefined],
    ]);
    await expect
      .element(
        screen.getByText("Package fictional-openssl excluded.", {
          exact: true,
        }),
      )
      .toBeVisible();
  });

  test("keep the menu of the actions and the select as they were while their menu is open, after a read of the signed-in user takes manage_packages away", async () => {
    let user = PACKAGE_MANAGER;
    showingEditable(undefined, { user: () => user });
    const { screen } = await renderTree();
    await actionsOf(screen, OPENSSL_SP7).click();
    const menu = menuOf(screen, `Actions of ${OPENSSL_SP7}`);
    await expect.element(menu).toBeVisible();
    user = OTHER_USER;

    await returnToForeground();

    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    await expect
      .element(affectednessOf(screen, OPENSSL_FLES))
      .not.toBeInTheDocument();
    await expect
      .element(menu.getByRole("menuitem", { name: "Exclude" }))
      .toBeVisible();

    await userEvent.keyboard("{Escape}");

    // The menu closes with its button, which the screen no longer offers:
    // the focus moves to the screen's heading.
    await expect
      .element(actionsOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test.each(["the menu of the actions", "the select of the affectedness"])(
    "move the focus to the screen's heading when Sentinel refuses the change of %s that the screen no longer offers, after a read of the signed-in user took manage_packages away",
    async (control) => {
      let user = PACKAGE_MANAGER;
      showingEditable(undefined, {
        user: () => user,
        packageChange: () => errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION"),
      });
      const { screen } = await renderTree();
      const actions = control === "the menu of the actions";
      await (
        actions
          ? actionsOf(screen, OPENSSL_SP7)
          : affectednessOf(screen, OPENSSL_SP7)
      ).click();
      await expect.element(screen.getByRole("menu")).toBeVisible();
      user = OTHER_USER;
      await returnToForeground();
      await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);

      await (
        actions
          ? screen.getByRole("menuitem", { name: "Exclude", exact: true })
          : screen.getByRole("menuitemradio", { name: "Not affected" })
      ).click();

      await expect
        .element(screen.getByText("You don't have permission to do this."))
        .toBeVisible();
      await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
      await expectFocusSettledOn(screenHeading(screen));
    },
  );

  test("keep the values that the select of the affectedness offered as it opened, after a read of the signed-in user takes manage_packages away", async () => {
    let user = PACKAGE_MANAGER;
    showingEditable(undefined, { user: () => user });
    const { screen } = await renderTree();
    await affectednessOf(screen, OPENSSL_SP7).click();
    const menu = menuOf(screen, `Affectedness of ${OPENSSL_SP7}: Affected`);
    await expect.element(menu).toBeVisible();
    user = OTHER_USER;

    await returnToForeground();

    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    await expect
      .element(affectednessOf(screen, OPENSSL_FLES))
      .not.toBeInTheDocument();
    await expect
      .poll(() => itemsOf(menu, "menuitemradio"))
      .toEqual(["Analysis", "Affected", "Not affected", "Won't fix"]);

    await userEvent.keyboard("{Escape}");

    // The menu closes with its select, which the screen no longer offers:
    // the focus moves to the screen's heading.
    await expect
      .element(affectednessOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("show the outcome of an edit that ends after the user left the screen in the message area, naming the Ticket", async () => {
    const response = later();
    showingEditable(undefined, { packageChange: () => response.promise });
    const { router, screen } = await renderTree();
    await chooseAction(screen, OPENSSL_SP7, "Exclude");

    await leaveForTickets(router, screen);
    response.resolve(trackMarkerResponse(false));

    await expect
      .element(
        screen.getByText(
          "SNTL-12: Track fictional-openssl · SUSE:FLES-15-SP7:Update excluded.",
          { exact: true },
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
      .toHaveAttribute("href", "/tickets/SNTL-12");
  });

  test("keep the select of a hidden track in its own colors", async () => {
    showingEditable(() => treeWithoutSp7());
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    const select = affectednessOf(screen, OPENSSL_SP7);
    await expect.element(select).toBeVisible();
    expect(
      colorOf(
        trackOf(screen, "SUSE:FLES-15-SP7:Update")
          .getByText("SUSE:FLES-15-SP7:Update")
          .element(),
      ),
    ).toBe(FG_MUTED);
    expect(colorOf(select.element())).toBe(FG);
    // The menu of its actions keeps its color too.
    expect(colorOf(actionsOf(screen, OPENSSL_SP7).element())).toBe(FG);
  });

  test("move the focus to the screen's heading when the select leaves the page after a change that leaves the user no other value, as Fixed for a user who holds admin_ticket_ops alone", async () => {
    let tree = editableTree();
    showingEditable(() => tree, {
      user: TICKET_ADMIN,
      packageChange: () => {
        tree = editableTree({
          tracks: [fictionalTrack({ status: "fixed" }), flesTrack()],
        });
        return trackStatusResponse("fixed");
      },
    });
    const { screen } = await renderTree();

    await chooseAffectedness(screen, OPENSSL_SP7, "Fixed");

    await expect
      .element(affectednessOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expect
      .element(trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText("Fixed"))
      .toBeVisible();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("move the focus to the screen's heading when a read removes the menu of the actions of a record that holds it", async () => {
    let status: TicketStatusValue = "analyzed";
    stubTicket({
      user: PACKAGE_MANAGER,
      ticket: () =>
        ticketResponse(
          fictionalTicketDetail({ packages: editableTree(), status }),
        ),
    });
    const { screen } = await renderTree();
    actionsOf(screen, OPENSSL_SP7).element().focus();
    await expect.element(actionsOf(screen, OPENSSL_SP7)).toHaveFocus();
    // Meanwhile another analyst ignored the Ticket.
    status = "ignored";

    await returnToForeground();

    await expect
      .element(actionsOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("move the focus after an exclusion of a track that hides its package to the menu of the next package that shows", async () => {
    const hiddenPackage = {
      actionable: false,
      non_actionable_reason: "no_actionable_tracks",
    } as const;
    let tree = editableTree({ tracks: [fictionalTrack()] });
    showingEditable(() => tree, {
      packageChange: () => {
        tree = editableTree({
          ...hiddenPackage,
          tracks: [
            excludedTrack({ id: SP7_ID, reference: "SUSE:FLES-15-SP7:Update" }),
          ],
        });
        return trackMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseAction(screen, OPENSSL_SP7, "Exclude");

    await expect
      .element(actionsOf(screen, "fictional-openssl"))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, "fictional-zlib"));
  });

  test("move the focus after a confirmed exclusion that hides a package to the menu of the next package that shows", async () => {
    let tree = editableTree();
    showingEditable(
      () => tree,
      {
        packageChange: () => {
          tree = editableTree({
            deleted_at: "2099-10-09T10:00:00Z",
            actionable: false,
            non_actionable_reason: "package_excluded",
          });
          return packageMarkerResponse(false);
        },
      },
      { is_confidential: true },
    );
    const { screen } = await renderTree();
    await chooseAction(screen, "fictional-openssl", "Exclude…");

    await screen
      .getByRole("dialog", { name: "Exclude fictional-openssl?" })
      .getByRole("button", { name: "Exclude package" })
      .click();

    await expect
      .element(actionsOf(screen, "fictional-openssl"))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, "fictional-zlib"));
  });

  test("close the confirmation and say in the message area that the package is already excluded after 409 PACKAGE_ALREADY_EXCLUDED", async () => {
    showingEditable(
      undefined,
      { packageChange: () => errorResponse(409, "PACKAGE_ALREADY_EXCLUDED") },
      { is_confidential: true },
    );
    const { screen } = await renderTree();
    await chooseAction(screen, "fictional-openssl", "Exclude…");
    const confirmation = screen.getByRole("dialog", {
      name: "Exclude fictional-openssl?",
    });

    await confirmation.getByRole("button", { name: "Exclude package" }).click();

    await expect.element(confirmation).not.toBeInTheDocument();
    const message = screen.getByText(
      "Package fictional-openssl is already excluded.",
      { exact: true },
    );
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.info);
  });

  test.each(["ignored", "duplicated", "fictional_status"])(
    "offer a user who holds admin_ticket_ops alone no select on a Ticket in %s",
    async (status) => {
      stubTicket({
        user: TICKET_ADMIN,
        ticket: () =>
          jsonResponse(200, {
            data: {
              ...fictionalTicketDetail({ packages: editableTree() }),
              status,
            },
          }),
      });
      const { screen } = await renderTree();

      await expect
        .element(
          trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText("Affected"),
        )
        .toBeVisible();
      await expect
        .element(affectednessOf(screen, OPENSSL_SP7))
        .not.toBeInTheDocument();
    },
  );

  test("announce an affectedness that Sentinel returns and that the pinned contract does not list as received", async () => {
    showingEditable(undefined, {
      packageChange: () => trackStatusResponse("fictional_affectedness"),
    });
    const { screen } = await renderTree();

    await chooseAffectedness(screen, OPENSSL_SP7, "Not affected");

    await expect
      .poll(() => announcements(screen))
      .toContain(
        "Affectedness of fictional-openssl · SUSE:FLES-15-SP7:Update changed to fictional_affectedness.",
      );
  });

  test("line up the selects of the affectedness and the pipelines of the tracks for a user who sets the affectedness, whatever the width of each value", async () => {
    showingEditable(() =>
      editableTree({
        tracks: [fictionalTrack({ status: "fixed" }), flesTrack()],
      }),
    );
    const { screen } = await renderTree();

    const fixed = affectednessOf(screen, OPENSSL_SP7);
    const analysis = affectednessOf(screen, OPENSSL_FLES);
    await expect.element(fixed).toBeVisible();
    expect(boxOf(fixed).width).toBeLessThan(boxOf(analysis).width);
    expect(boxOf(fixed).left).toBe(boxOf(analysis).left);
    const pipelines = packagesPart(screen)
      .getByRole("button", { name: /^Phases of fictional-openssl/ })
      .elements();
    expect(pipelines).toHaveLength(2);
    expect(boxOf(pipelines[0]!).right).toBe(boxOf(pipelines[1]!).right);
    // The place of the select is at least as wide as the select of Not
    // affected: 136 px.
    expect(
      boxOf(actionsOf(screen, OPENSSL_SP7)).left - boxOf(fixed).left,
    ).toBeGreaterThanOrEqual(136);
  });

  test("show in the message area the outcome of an exclusion whose read after it replaces the screen, as the 404 of a Ticket that the exclusion hid from the user", async () => {
    let hidden = false;
    showingEditable(undefined, {
      ticket: () =>
        hidden
          ? errorResponse(404, "TICKET_NOT_FOUND")
          : ticketResponse(
              fictionalTicketDetail({
                packages: editableTree(),
                is_confidential: true,
              }),
            ),
      packageChange: () => {
        hidden = true;
        return packageMarkerResponse(false);
      },
    });
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");
    await chooseAction(screen, "fictional-openssl", "Exclude…");

    await screen
      .getByRole("dialog", { name: "Exclude fictional-openssl?" })
      .getByRole("button", { name: "Exclude package" })
      .click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    await expect
      .element(
        screen.getByText("Package fictional-openssl excluded.", {
          exact: true,
        }),
      )
      .toBeVisible();
  });
});
