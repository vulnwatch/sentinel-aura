import { focusManager, type QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { commands, page, userEvent, type Locator } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { App } from "../../app";
import type {
  CNAResponse,
  CVSS20Assessment,
  CVSS40Assessment,
  CVSSAssessmentItem,
  CVSSAssessmentResponse,
  CVSSAssessmentSeverity,
  CVSSBaseScore,
  CVSSBaseScoreResponse,
  CurrentUserResponse,
  MaintainedPackageListResponse,
  PackageAdditionResponse,
  PackageAdditionResult,
  PackageDetail,
  PackageExclusionResponse,
  ProductDetail,
  ProductEligibilityResponse,
  ProductExclusionResponse,
  TicketConvergenceDispatchDataResponse,
  TicketDetail,
  TrackDetail,
  TrackExclusionResponse,
  TrackStatusTrack,
} from "../../api/generated/model";
import { createQueryClient } from "../../query-client";
import { createAppRouter } from "../../router";
import { RETURN_URL_KEY, SESSION_RECORD_KEY } from "../../session";
import {
  actorsResponse,
  cvssResponse,
  errorResponse,
  eventPage,
  FICTIONAL_ACTORS,
  fictionalGrant,
  grantResponse,
  grantsResponse,
  usersPage,
  fictionalAssessment,
  fictionalEvent,
  fictionalPackage,
  fictionalProduct,
  fictionalSuseAssessment,
  fictionalTicketDetail,
  fictionalTrack,
  jsonResponse,
  OTHER_USER,
  refetchResponse,
  releaseRequestsResponse,
  sourcesResponse,
  stubApi,
  submissionRequestsResponse,
  ticketPage,
  ticketResponse,
  ticketWorkResponse,
  urlOf,
} from "../../test-api";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reduce: boolean) => Promise<void>;
  }
}

// What the test files of the modules of Overview, the first tab of the Ticket
// screen (src/routes/ticket-overview.tsx), share, with those of Actions in its
// heading row (src/routes/ticket/), which show over Overview: the responses
// of the API to the screen, its rendering, the elements of its parts, and the
// waits for its reads.

export const ME = "/api/v1/users/me";
export const TICKETS = "/api/v1/tickets";
export const TICKET = "/api/v1/tickets/SNTL-12";
export const YOUR_WORK = "/api/v1/my/packages/tickets/SNTL-12";
export const CVSS = "/api/v1/cves/CVE-2099-0012/cvss";
export const SUSE_ASSESSMENT = "/api/v1/cves/CVE-2099-0012/cvss/suse";
export const SOURCES = "/api/v1/cves/CVE-2099-0012/sources";
export const REFETCH = "/api/v1/cves/CVE-2099-0012/refetch";
export const BASE_SCORE = "/api/v1/cvss/base-score";
export const ACTORS = "/api/v1/tickets/SNTL-12/actors";
export const EVENTS = "/api/v1/tickets/SNTL-12/audit-log";
export const ACCESS = "/api/v1/tickets/SNTL-12/access";
export const SUBMISSION_REQUESTS =
  "/api/v1/tickets/SNTL-12/submission-requests";
export const RELEASE_REQUESTS = "/api/v1/tickets/SNTL-12/release-requests";
export const USERS = "/api/v1/users";
export const ASSIGNEE = "/api/v1/tickets/SNTL-12/assignee";
export const CNAS = "/api/v1/cnas/";
export const ADD_PACKAGE = "/api/v1/tickets/SNTL-12/packages";
export const MAINTAINED_PACKAGES = "/api/v1/maintained-packages";
export const DAY = 24 * 60 * 60 * 1000;
export const HOUR = 60 * 60 * 1000;

// The colors of docs/design-system.md (Color Tokens; Tones) in the light
// theme.
export const FG = "rgb(31, 35, 40)";
export const FG_MUTED = "rgb(89, 99, 110)";
export const NEUTRAL_SOFT = "rgb(239, 242, 245)";
export const LINK = "rgb(9, 105, 218)";
export const BORDER = "rgb(216, 222, 228)";
export const INFO_SOFT = "rgb(221, 244, 255)";
export const INFO_ON_SOFT = "rgb(10, 48, 105)";
export const WARNING_ON_SOFT = "rgb(108, 68, 0)";
export const WARNING_ICON = "#9a6700";
export const INFO_ICON = "#0969da";
export const SUCCESS_ICON = "#1a7f37";
export const DANGER_ICON = "#cf222e";
export const NEUTRAL_ICON = "#6e7781";

// A maintainer without a role, who maintains fictional-openssl, the package
// of fictionalPackage.
export const MAINTAINER: CurrentUserResponse = {
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

export let client: QueryClient;

// Gives each test of the file that calls it at its top level a query client of
// its own and the viewport of the tests, and restores after it what the test
// changed.
export function prepareEachTest() {
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
}

// Get Current User's response, whose assignment eligibility can be a value
// that the pinned contract does not list, which a later Sentinel release can
// return.
export interface UserBody {
  data: Omit<CurrentUserResponse["data"], "assignment_eligibility"> & {
    assignment_eligibility: string;
  };
}

export interface Stub {
  // The signed-in user, or the user at each read of it.
  user: UserBody | (() => UserBody);
  // The response to Get Ticket.
  ticket: () => Response | Promise<Response>;
  // The response to the read of the duplicates, given its query.
  duplicates: (query: URLSearchParams) => Response | Promise<Response>;
  // The response to the read of the work of the signed-in user on the
  // Ticket.
  yourWork: () => Response | Promise<Response>;
  // The response to the read of the CVSS assessments of the CVE.
  cvss: () => Response | Promise<Response>;
  // The response to the read of the sources of the CVE.
  sources: () => Response | Promise<Response>;
  // The response to a refetch of the CVE, given its query.
  refetch: (query: URLSearchParams) => Response | Promise<Response>;
  // The response to Get CNA, given its path.
  cna: (path: string) => Response | Promise<Response>;
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
  // The response to Add Package to Ticket, given its body.
  addPackage: (body: unknown) => Response | Promise<Response>;
  // The response to a search of the maintained packages, given its query.
  maintainedPackages: (query: URLSearchParams) => Response | Promise<Response>;
  // The response to a change of the status of the Ticket or to a rerun of
  // its convergence from Actions (src/routes/ticket/actions.tsx), given the
  // last segment of its path, such as reopen, and its body.
  ticketChange: (action: string, body: unknown) => Response | Promise<Response>;
}

// Answers the read of the signed-in user, an analyst who maintains no
// package unless the test says otherwise, Get Ticket, the read of the
// duplicates, by default without any, the read of the work of the user, the
// read of the CVSS assessments and the changes of the SUSE assessment, the
// read of the sources of the CVE, and its refetch, Get CNA, by default the
// CNA of the tests (fictionalCna), the reads of the participants, by
// default without any, the reads of the requests of a track, by default
// without any, the search of the directory, Grant and Revoke Access, Assign
// Ticket, Add Package to Ticket, by default an addition of
// fictional-openssl, the search of the maintained packages, by default
// without any, the changes of Actions (ticketChangeResponse), and the reads
// of Audit log, and returns the spy, whose calls name the requests.
export function stubTicket(fields: Partial<Stub> = {}) {
  const stub: Stub = {
    user: OTHER_USER,
    ticket: () => ticketResponse(fictionalTicketDetail()),
    duplicates: () => ticketPage([]),
    yourWork: () => ticketWorkResponse(),
    cvss: () => cvssResponse(),
    sources: () => sourcesResponse(),
    refetch: () => refetchResponse({ sources_enqueued: ["nvd"] }),
    cna: () => cnaResponse(),
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
    addPackage: () => packageAdditionResponse(),
    maintainedPackages: () => maintainedPackagesPage([]),
    ticketChange: ticketChangeResponse,
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
      return stub.duplicates(request.query);
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
    if (request.path === ADD_PACKAGE && request.method === "POST") {
      return stub.addPackage(request.body);
    }
    if (request.path === MAINTAINED_PACKAGES) {
      return stub.maintainedPackages(request.query);
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
    if (request.path.startsWith(`${TICKET}/`) && request.method === "POST") {
      return stub.ticketChange(
        request.path.slice(`${TICKET}/`.length),
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
    if (request.path.startsWith(CNAS)) {
      return stub.cna(request.path);
    }
    return errorResponse(404, "RESOURCE_NOT_FOUND");
  });
}

// Answers Get Ticket with a Ticket that has the packages.
export function showing(
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

// Answers Get Ticket with the Ticket.
export function showingTicket(ticket: TicketDetail) {
  return stubTicket({ ticket: () => ticketResponse(ticket) });
}

// Answers Get Ticket with a Ticket whose fields hold values that the pinned
// contract does not list, which a later Sentinel release can return.
export function showingUnlistedTicket(ticket: Record<string, unknown>) {
  return stubTicket({ ticket: () => jsonResponse(200, { data: ticket }) });
}

// The CNA of the CVE in the tests, under the auto-ignore policy, as Get
// CNA returns it, with the fields that a test sets.
export const ORG_ID = "00000000-0000-4000-8000-0000000000a2";
export const CNA_NAME = "Fictional Plugin Foundation";

function fictionalCna(fields: Partial<CNAResponse> = {}): CNAResponse {
  return {
    org_id: ORG_ID,
    name: CNA_NAME,
    short_name: "fictional-plugins",
    organization_name: CNA_NAME,
    types: ["Open Source", "Researcher"],
    scope:
      "Plugins of the fictional plugin directory.\nPlugin list: https://plugins.example.com",
    auto_ignore: true,
    created_at: "2099-10-01T08:00:00Z",
    updated_at: "2099-10-01T08:05:00Z",
    ...fields,
  };
}

export function cnaResponse(fields: Partial<CNAResponse> = {}): Response {
  return jsonResponse(200, { data: fictionalCna(fields) });
}

export async function renderApp(path: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  return { router, screen };
}

export type Screen = Awaited<ReturnType<typeof renderApp>>["screen"];

// Renders the screen of the Ticket and waits until it shows the Ticket.
export async function renderTicket(
  path = "/tickets/SNTL-12",
  name = "SNTL-12",
) {
  const rendered = await renderApp(path);
  await expect.element(heading(rendered.screen, name)).toBeVisible();
  return rendered;
}

export function heading(screen: Screen, name: string) {
  return screen.getByRole("heading", { level: 1, name, exact: true });
}

export function region(screen: Screen, name: string) {
  return screen.getByRole("region", { name, exact: true });
}

// The value of a field of the details, by its term: the definition of the
// same rank as the term, as each term has one.
export function valueOf(screen: Screen, term: string): HTMLElement {
  const details = region(screen, "Details");
  const index = details
    .getByRole("term")
    .elements()
    .findIndex((candidate) => candidate.textContent === term);
  const element = details.getByRole("definition").elements()[index];
  if (index === -1 || !(element instanceof HTMLElement)) {
    throw new Error(`The details have no field ${term}`);
  }
  return element;
}

// The terms of a list, in their order.
export function textsOf(locator: Locator): (string | null)[] {
  return locator.elements().map((element) => element.textContent);
}

// The paths and queries of the requests to the API, other than the read of
// the signed-in user.
export function requestsOf(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname !== ME)
    .map((url) => `${url.pathname}${url.search}`);
}

// Renders the screen of SNTL-12 and waits until it shows its package tree.
export async function renderTree(path = "/tickets/SNTL-12") {
  const rendered = await renderApp(path);
  await expect.element(packagesPart(rendered.screen)).toBeVisible();
  return rendered;
}

export function packagesPart(screen: Screen) {
  return screen.getByRole("region", { name: "Packages", exact: true });
}

// The band of a package, by the name of its heading.
export function band(screen: Screen, name: string): HTMLElement {
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
export function trackOf(screen: Screen, reference: string): Locator {
  return packagesPart(screen)
    .getByRole("listitem")
    .filter({ has: page.getByText(reference, { exact: true }) })
    .last();
}

// The list item of a Product, by its name.
export function productOf(screen: Screen, name: string): Locator {
  return packagesPart(screen)
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name, exact: true }) })
    .last();
}

// The distance between two colors, #rrggbb, as the largest difference of
// their channels.
export function distance(one: string, other: string): number {
  return Math.max(
    ...[1, 3, 5].map((start) =>
      Math.abs(
        Number.parseInt(one.slice(start, start + 2), 16) -
          Number.parseInt(other.slice(start, start + 2), 16),
      ),
    ),
  );
}

export function showHidden(screen: Screen) {
  return screen.getByRole("switch", { name: /^Show hidden/ });
}

// The rectangle of an element on the screen.
export function boxOf(element: Locator | Element): DOMRect {
  return (
    "element" in element ? element.element() : element
  ).getBoundingClientRect();
}

export function colorOf(element: Element): string {
  return getComputedStyle(element).color;
}

// The tab returns to the foreground after being hidden, once no read is in
// progress: a return during a read joins it rather than reading again
// (TanStack Query's Query.onFocus), so the reads that a test expects after
// the return do not depend on when the reads before it end. The poll moves
// no fake clock (sourcesSettled,
// src/routes/ticket-overview/sources.test.tsx).
export async function returnToForeground() {
  await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
  focusManager.setFocused(false);
  focusManager.setFocused(true);
}

// Waits until no read of the path is in progress and the screen shows its
// outcome, for a read whose outcome shows nothing of its own, such as the
// requests of a phase without any: TanStack Query tells the screen of the
// end of a read in a later task, which runs before this one ends.
export async function readEnded(path: string) {
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
export async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

// A response that the test gives when it chooses.
export function later() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// The milestones of a track whose every phase is not applicable, such as a
// track that is not actionable, whose current phase is done.
export const NOT_APPLICABLE: Pick<TrackDetail, "milestones" | "current_phase"> =
  {
    milestones: {
      triage: "not_applicable",
      submission: "not_applicable",
      um: "not_applicable",
      qa: "not_applicable",
    },
    current_phase: "done",
  };

// The milestones of a track whose later phases Sentinel does not observe,
// such as a Git track or a track of a Ticket without a CVE, after its triage,
// with due dates: its current phase is null.
export const UNOBSERVED: Pick<TrackDetail, "milestones" | "current_phase"> = {
  milestones: { triage: "done", submission: null, um: null, qa: null },
  current_phase: null,
};

// The user who set the eligibility of a Product by hand, and when, its
// provenance (Sentinel docs/features/packages/package-model.md, Override
// Model).
export const SETTER: NonNullable<ProductDetail["eligibility_override_by"]> = {
  id: "00000000-0000-0000-0000-000000000003",
  username: "asmith",
  full_name: "Alice Smith",
  active: true,
  bot: false,
  avatar_url: null,
};
export const SET_AT = "2099-10-10T11:00:00Z";

// The eligibility of a Product that a user set by hand to not eligible, with
// its provenance, which Sentinel returns with every override.
export const SET_BY_HAND: Partial<ProductDetail> = {
  eligible: false,
  is_eligible_override: true,
  eligibility_override_by: SETTER,
  eligibility_override_at: SET_AT,
};

// A track that is excluded, with a Product that is excluded through it.
export function excludedTrack(fields: Partial<TrackDetail> = {}): TrackDetail {
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
export function excludedPackage(): PackageDetail {
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

// NVD's CVSS v4.0 assessment of CVE-2099-0012, Critical 9.3.
export const NVD_V40: CVSS40Assessment = {
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
export const CNA_V20: CVSS20Assessment = {
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

export function cvssPart(screen: Screen) {
  return screen.getByRole("region", {
    name: "CVSS assessments",
    exact: true,
  });
}

// The vector of fictionalAssessment, NVD's v3.1 assessment.
export const NVD_V31_VECTOR = "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H";

// The backgrounds of the messages of each tone in the light theme
// (docs/design-system.md, Tones).
export const MESSAGE_TONES = {
  info: "rgb(221, 244, 255)",
  success: "rgb(218, 251, 225)",
  warning: "rgb(255, 248, 197)",
  danger: "rgb(255, 235, 233)",
} as const;

// The reference of the errors of the tests (src/test-api.ts).
export const REFERENCE = "Reference: 01890a5d-ac96-774b-bcce-b302099a8057";

export function sourcesPart(screen: Screen) {
  return screen.getByRole("region", {
    name: "Sources of the CVE",
    exact: true,
  });
}

// Presses a button from the keyboard, which keeps the focus on it.
export async function press(button: Locator) {
  button.element().focus();
  await userEvent.keyboard("{Enter}");
}

// The color behind an element: the background of the nearest element, itself
// or one that contains it, that has one.
export function backgroundBehind(element: Element): string {
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

// The outcome of a change as a success message, such as in the message area
// after the read after the change failed (docs/behaviors.md, Outcome of a
// Change): the one element with its text.
export async function expectSuccessMessage(screen: Screen, text: string) {
  const message = screen.getByText(text, { exact: true });
  await expect.element(message).toBeVisible();
  expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
}

// The names of the animations that run in an element and its descendants.
export function animationsIn(element: Element): string[] {
  return element
    .getAnimations({ subtree: true })
    .map((animation) =>
      animation instanceof CSSAnimation ? animation.animationName : "",
    );
}

// A confidential SNTL-12, assigned to Alice Smith, the user of OTHER_USER.
export function confidentialTicket(fields: Partial<TicketDetail> = {}) {
  return ticketResponse(
    fictionalTicketDetail({
      is_confidential: true,
      assignee: FICTIONAL_ACTORS[1]!,
      ...fields,
    }),
  );
}

// The requests of the spy with the method.
export function requestsWith(spy: ReturnType<typeof stubApi>, method: string) {
  return spy.mock.calls.filter(([, init]) => init?.method === method);
}

// How many reads of the path the spy received, without the changes sent to
// the same path, such as Grant Access.
export function readsOf(spy: ReturnType<typeof stubApi>, path: string): number {
  return requestsWith(spy, "GET").filter(
    ([input]) => urlOf(input).pathname === path,
  ).length;
}

// A press of a pointer outside the popover, which React Aria takes from the
// document.
export function interactOutside() {
  for (const type of ["pointerdown", "pointerup", "click"]) {
    document.body.dispatchEvent(
      new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0 }),
    );
  }
}

// What the status regions of the screen outside a dialog say.
export function announcements(screen: Screen): string {
  return screen
    .getByRole("status")
    .elements()
    .filter((status) => status.closest('[role="dialog"]') === null)
    .map((status) => status.textContent ?? "")
    .join("");
}

// The messages of the failures of a change (docs/behaviors.md, Default
// Presentation by Status; Missing and Inaccessible Records; Retries and
// Unconfirmed Changes).
export const MESSAGE_CONFLICT =
  "This can't be done in the current state, which may have changed. Check it and try again.";
export const MESSAGE_GONE =
  "This no longer exists, or you no longer have access to it.";
export const MESSAGE_NOT_ACCEPTED = "Sentinel didn't accept this request.";
export const MESSAGE_UNCONFIRMED =
  "Sentinel didn't confirm this change. It may have taken effect: check before trying again.";
export const MESSAGE_UNAVAILABLE =
  "Sentinel isn't available right now. Try again later.";
export const MESSAGE_INVALID = "This value isn't valid.";

// A CNA's CVSS v3.1 assessment, High 7.5.
export const CNA_V31 = fictionalAssessment({
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

// What Calculate CVSS Base Score returns for a vector: a fictional score and
// severity, 5.5 and medium unless the test says otherwise, of the version of
// its prefix, with fictional metrics of that version, those of CNA_V31 and
// NVD_V40.
export function baseScoreOf(
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
export function baseScoreResponse(
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
export function suseResponse(
  assessment: CVSSAssessmentItem,
  status: 200 | 201 = 200,
): Response {
  const body: CVSSAssessmentResponse = { data: assessment };
  return jsonResponse(status, body);
}

export function screenHeading(screen: Screen) {
  return screen.getByRole("heading", {
    level: 1,
    name: "SNTL-12",
    exact: true,
  });
}

export function deleteSuse(screen: Screen, version = "3.1") {
  return cvssPart(screen).getByRole("button", {
    name: `Delete SUSE assessment v${version}`,
    exact: true,
  });
}

// Whether every read of the path that the query client holds for a screen
// that no longer shows it, such as a screen that the user left, is to be
// read again, which that screen does once it shows again.
export function leftInvalidated(path: string): boolean {
  const queries = client
    .getQueryCache()
    .findAll({ queryKey: [path], type: "inactive" });
  return (
    queries.length > 0 && queries.every((query) => query.state.isInvalidated)
  );
}

// Waits until the error at the top of a dialog holds the focus, which it
// takes once it has shown, in a render after the response.
export async function expectFocusOnError(error: Locator) {
  await expect
    .poll(() =>
      error.element().closest("[tabindex]")?.contains(document.activeElement),
    )
    .toBe(true);
}

// Waits until the browser has rendered more frames than the part waits at
// most for a row to leave the table before it moves the focus, after which
// the focus has settled.
export async function frames() {
  for (let frame = 0; frame < 15; frame += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
}

// Waits until the element has the focus, and checks that it keeps it once the
// table has settled, as React Aria's table moves the focus itself.
export async function expectFocusSettledOn(locator: Locator) {
  await expect.element(locator).toHaveFocus();
  await frames();
  expect(document.activeElement).toBe(locator.element());
}

type Router = Awaited<ReturnType<typeof renderApp>>["router"];

// Leaves for Ticket list, while the change is in progress.
export async function leaveForTickets(router: Router, screen: Screen) {
  await router.navigate({ to: "/tickets" });
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
    .toBeVisible();
}

// The response of an exclusion or a restore of fictional-openssl, with its
// actionability after it.
export function packageMarkerResponse(actionable: boolean): Response {
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
export function trackMarkerResponse(actionable: boolean): Response {
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
export function trackStatusResponse(status: string): Response {
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

// The response of an exclusion or a restore of the Product of the SP7 track
// of fictional-openssl, with its actionability after it.
export function productMarkerResponse(actionable: boolean): Response {
  const body: ProductExclusionResponse = {
    data: {
      id: "00000000-0000-0000-0000-0000000000c1",
      product_cpe: "cpe:/o:example:fles:15:sp7",
      product_name: "Fictional Linux Enterprise Server 15 SP7",
      actionable,
      non_actionable_reason: actionable ? null : "product_excluded",
    },
  };
  return jsonResponse(200, body);
}

// The response of Override Product Eligibility with the Product of the SP7
// track of fictional-openssl: its eligibility set by hand to the value, or,
// for null, automatic and eligible, as the 10.0 fallback makes it.
export function productEligibilityResponse(eligible: boolean | null): Response {
  const body: ProductEligibilityResponse = {
    data: {
      ticket_id: "SNTL-12",
      package_name: "fictional-openssl",
      reference: "SUSE:FLES-15-SP7:Update",
      id: "00000000-0000-0000-0000-0000000000c1",
      product_cpe: "cpe:/o:example:fles:15:sp7",
      product_name: "Fictional Linux Enterprise Server 15 SP7",
      eligible: eligible ?? true,
      is_eligible_override: eligible !== null,
      eligibility_override_by: eligible === null ? null : SETTER,
      eligibility_override_at: eligible === null ? null : SET_AT,
      lifecycle_phase: "general_support",
      actionable: true,
      non_actionable_reason: null,
    },
  };
  return jsonResponse(200, body);
}

// The response of an edit of the package tree by its method and its path
// under the packages of the Ticket: the record after it, actionable after a
// restore and not after an exclusion, the track with the affectedness that
// the body sends, or the Product with the eligibility that the body sends.
function packageChangeResponse(
  method: string,
  path: string,
  body: unknown,
): Response {
  if (path.includes("/products/")) {
    if (method === "PATCH") {
      const eligible =
        typeof body === "object" && body !== null && "eligible" in body
          ? body.eligible
          : undefined;
      return productEligibilityResponse(
        typeof eligible === "boolean" ? eligible : null,
      );
    }
    return productMarkerResponse(path.endsWith("/restore"));
  }
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

// The 201 response of Add Package to Ticket: fictional-openssl, with 3 tracks
// and 7 Products created and none skipped, with the fields that a test sets.
export function packageAdditionResponse(
  fields: Partial<PackageAdditionResult> = {},
): Response {
  const body: PackageAdditionResponse = {
    data: {
      package_name: "fictional-openssl",
      tracks_created: 3,
      tracks_skipped: 0,
      products_created: 7,
      products_skipped: 0,
      ...fields,
    },
  };
  return jsonResponse(201, body);
}

// The 202 response of Rerun Ticket Convergence for SNTL-12.
export function convergenceResponse(): Response {
  const body: TicketConvergenceDispatchDataResponse = {
    data: {
      ticket_id: "SNTL-12",
      task_id: "01994c20-7c00-7000-8000-000000000002",
    },
  };
  return jsonResponse(202, body);
}

// The response of a change of Actions by the last segment of its path: SNTL-12
// after it, Duplicated, a duplicate of the original that the body sends,
// after Mark Ticket as Duplicate, and in Analysis after Reopen Ticket and
// Revert Duplicate Status; and the 202 of Rerun Ticket Convergence.
function ticketChangeResponse(action: string, body: unknown): Response {
  if (action === "rerun-reactivation") {
    return convergenceResponse();
  }
  if (action === "duplicate") {
    const original =
      typeof body === "object" &&
      body !== null &&
      "duplicate_of_ticket_id" in body
        ? String(body.duplicate_of_ticket_id)
        : null;
    return ticketResponse(
      fictionalTicketDetail({
        status: "duplicated",
        duplicate_of_ticket_id: original,
      }),
    );
  }
  return ticketResponse(fictionalTicketDetail({ status: "analysis" }));
}

// A page of Search Maintained Packages, of 20 names: the names, in their
// order, of a list of total names.
export function maintainedPackagesPage(
  names: readonly string[],
  { total = names.length } = {},
): Response {
  const body: MaintainedPackageListResponse = {
    data: names.map((name) => ({ name })),
    meta: { total, page: 1, per_page: 20 },
  };
  return jsonResponse(200, body);
}
