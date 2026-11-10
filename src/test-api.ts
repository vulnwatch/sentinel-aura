import { vi } from "vitest";
import type {
  CVECVSSAssessments,
  CVECVSSAssessmentsResponse,
  CVEDetail,
  CVSS31Assessment,
  CurrentUserResponse,
  ErrorResponse,
  LoginResponse,
  MaintainerTicketWorkResponse,
  PackageDetail,
  ProductDetail,
  TicketDetail,
  TicketDetailResponse,
  TicketListResponse,
  TicketSummary,
  TrackDetail,
  ValidationErrorResponse,
} from "./api/generated/model";

// What several unit and component tests share (docs/conventions.md, Tests):
// fictional responses of Sentinel's API, which replace the browser's fetch
// under the shared request function, so that no test makes a network request.

const REQUEST_ID = "01890a5d-ac96-774b-bcce-b302099a8057";

// The signed-in user of the tests, as Get Current User returns it, who holds
// no role, and so can be the assignee of no Ticket.
export const FICTIONAL_USER: CurrentUserResponse = {
  data: {
    id: "00000000-0000-0000-0000-000000000001",
    username: "jdoe",
    email: "john.doe@example.com",
    full_name: "John Doe",
    roles: [],
    capabilities: [],
    active: true,
    bot: false,
    assignment_eligibility: "none",
  },
};

// Another user, who signs in in another tab, and who holds the
// vulnerability_analyst role, with triage_ticket, and can be the assignee of
// every Ticket.
export const OTHER_USER: CurrentUserResponse = {
  data: {
    id: "00000000-0000-0000-0000-000000000002",
    username: "asmith",
    email: "alice.smith@example.com",
    full_name: "Alice Smith",
    roles: ["vulnerability_analyst"],
    capabilities: ["triage_ticket"],
    active: true,
    bot: false,
    assignment_eligibility: "all",
  },
};

// A JSON response with the request identifier that Sentinel sets.
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Request-ID": REQUEST_ID },
  });
}

// An error response of Sentinel, with its code.
export function errorResponse(status: number, code: string): Response {
  const body: ErrorResponse = { code, detail: "A fictional detail" };
  return jsonResponse(status, body);
}

// The response with which Sentinel answers a request without a valid
// session.
export function unauthorized(): Response {
  return errorResponse(401, "AUTH_NOT_AUTHENTICATED");
}

// A VALIDATION_ERROR response with the locations of its errors.
export function validationError(locations: (string | number)[][]): Response {
  const body: ValidationErrorResponse = {
    code: "VALIDATION_ERROR",
    detail: "Request validation failed",
    errors: locations.map((loc) => ({
      loc,
      msg: "A fictional message",
      type: "string_type",
    })),
  };
  return jsonResponse(422, body);
}

// A successful sign-in, whose token the UI does not use.
export function signedIn(): Response {
  const body: LoginResponse = {
    data: {
      access_token: "fictional.access.token",
      token_type: "bearer",
      expires_at: "2026-10-09T14:05:09Z",
    },
  };
  return jsonResponse(200, body);
}

// A fictional Ticket, as List Tickets returns it: SNTL-1, New, with a CVE,
// unassigned, and a triage deadline, with the fields that a test sets. Its
// automatic priority P2 follows from its High severity and the SSVC
// exploitation poc of its CVE (Sentinel
// docs/features/tickets/ticket-priority.md, Decision Table; Automatic
// Priority Basis).
export function fictionalTicket(
  fields: Partial<TicketSummary> = {},
): TicketSummary {
  return {
    ticket_id: "SNTL-1",
    status: "new",
    ignore_reason: null,
    severity: "high",
    priority: "p2",
    priority_automatic: "p2",
    priority_override: null,
    priority_override_by: null,
    priority_override_at: null,
    priority_automatic_basis: {
      severity: "high",
      exploitation: "likely",
      evidence: [{ kind: "ssvc_exploitation", value: "poc" }],
    },
    assignee: null,
    cve: {
      cve_id: "CVE-2099-0001",
      title: "Fictional buffer overflow in fictional-curl",
      description: "A fictional description.",
      cna: null,
    },
    duplicate_of_ticket_id: null,
    is_confidential: false,
    coordinated_release_at: null,
    triage_due_at: "2099-10-12T14:05:09Z",
    submission_due_at: "2099-10-27T14:05:09Z",
    um_due_at: "2099-10-30T14:05:09Z",
    qa_due_at: "2099-11-08T14:05:09Z",
    release_due_at: "2099-11-08T14:05:09Z",
    current_phase: "triage",
    current_phase_milestone: "pending",
    package_names: [],
    created_at: "2099-10-09T14:05:09Z",
    updated_at: "2099-10-09T14:05:09Z",
    ...fields,
  };
}

// A fictional Ticket, as Get Ticket returns it: SNTL-12, Analyzed, with a
// CVE, assigned, without packages, its current phase Submission, with the
// fields that a test sets. Its automatic priority P2 follows from its High
// severity and the SSVC exploitation poc of its CVE (Sentinel
// docs/features/tickets/ticket-priority.md, Decision Table; Automatic
// Priority Basis).
export function fictionalTicketDetail(
  fields: Partial<TicketDetail> = {},
): TicketDetail {
  return {
    ticket_id: "SNTL-12",
    status: "analyzed",
    ignore_reason: null,
    severity: "high",
    priority: "p2",
    priority_automatic: "p2",
    priority_override: null,
    priority_override_by: null,
    priority_override_at: null,
    priority_automatic_basis: {
      severity: "high",
      exploitation: "likely",
      evidence: [{ kind: "ssvc_exploitation", value: "poc" }],
    },
    assignee: {
      id: "00000000-0000-0000-0000-000000000003",
      username: "asmith",
      full_name: "Alice Smith",
      active: true,
      bot: false,
    },
    cve: fictionalCve(),
    duplicate_of_ticket_id: null,
    is_confidential: false,
    coordinated_release_at: null,
    triage_due_at: "2099-10-12T14:05:09Z",
    submission_due_at: "2099-10-27T14:05:09Z",
    um_due_at: "2099-10-30T14:05:09Z",
    qa_due_at: "2099-11-08T14:05:09Z",
    release_due_at: "2099-11-08T14:05:09Z",
    current_phase: "submission",
    current_phase_milestone: "pending",
    packages: [],
    created_at: "2099-10-09T14:05:09Z",
    updated_at: "2099-10-10T09:30:00Z",
    ...fields,
  };
}

// The CVE of a fictional Ticket, as Get Ticket returns it, with the fields
// that a test sets.
export function fictionalCve(fields: Partial<CVEDetail> = {}): CVEDetail {
  return {
    cve_id: "CVE-2099-0012",
    title: "Fictional flaw CVE-2099-0012",
    description: "A fictional description of CVE-2099-0012.",
    published_date: "2099-10-01T08:00:00Z",
    modified_date: "2099-10-08T08:00:00Z",
    cve_state: "published",
    date_rejected: null,
    severity: "high",
    cna: null,
    external_identifiers: [],
    kev: null,
    epss: null,
    ssvc: {
      exploitation: "poc",
      automatable: "no",
      technical_impact: "partial",
      version: "2.0.3",
      assessed_at: "2099-10-06T10:15:00Z",
    },
    cwes: [],
    ...fields,
  };
}

// A fictional CVSS v3.1 assessment of CVE-2099-0012, as Get CVSS Assessments
// for a CVE returns it: NVD's, High 8.1, with the fields that a test sets.
export function fictionalAssessment(
  fields: Partial<CVSS31Assessment> = {},
): CVSS31Assessment {
  return {
    id: "00000000-0000-0000-0000-0000000000d1",
    provider_name: "NVD",
    cvss_version: "3.1",
    score: 8.1,
    severity: "high",
    vector_string: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
    metrics: {
      attack_vector: "network",
      attack_complexity: "high",
      privileges_required: "none",
      user_interaction: "none",
      scope: "unchanged",
      confidentiality_impact: "high",
      integrity_impact: "high",
      availability_impact: "high",
    },
    created_at: "2099-10-01T08:00:00Z",
    updated_at: "2099-10-01T08:00:00Z",
    ...fields,
  };
}

// The SUSE CVSS v3.1 assessment of CVE-2099-0012, Medium 5.5.
export function fictionalSuseAssessment(): CVSS31Assessment {
  return fictionalAssessment({
    id: "00000000-0000-0000-0000-0000000000d2",
    provider_name: "SUSE",
    score: 5.5,
    severity: "medium",
    vector_string: "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
    metrics: {
      attack_vector: "local",
      attack_complexity: "low",
      privileges_required: "low",
      user_interaction: "none",
      scope: "unchanged",
      confidentiality_impact: "high",
      integrity_impact: "none",
      availability_impact: "none",
    },
    created_at: "2099-10-09T15:00:00Z",
    updated_at: "2099-10-09T15:00:00Z",
  });
}

// The CVSS assessments of CVE-2099-0012, as Get CVSS Assessments for a CVE
// returns them, with the fields that a test sets: those of NVD and SUSE,
// both v3.1, the default CVSS version, so that the SUSE assessment gives
// both the severity and the eligibility score (Sentinel
// docs/features/tickets/cvss-scoring.md, Severity Resolution Cascade;
// Eligibility Score Resolution).
export function fictionalCvssAssessments(
  fields: Partial<CVECVSSAssessments> = {},
): CVECVSSAssessments {
  return {
    assessments: [fictionalAssessment(), fictionalSuseAssessment()],
    default_cvss_version: "3.1",
    severity: { score: 5.5, version: "3.1", provider: "SUSE", label: "medium" },
    eligibility: { score: 5.5, source: "suse" },
    ...fields,
  };
}

// Get CVSS Assessments for a CVE's response.
export function cvssResponse(
  assessments: CVECVSSAssessments = fictionalCvssAssessments(),
): Response {
  const body: CVECVSSAssessmentsResponse = { data: assessments };
  return jsonResponse(200, body);
}

// A fictional Product occurrence of a track, as the package tree returns it:
// Fictional Linux Enterprise Server 15 SP7, eligible by the automatic
// calculation, not released, in General Support, and actionable, with the
// fields that a test sets.
export function fictionalProduct(
  fields: Partial<ProductDetail> = {},
): ProductDetail {
  return {
    id: "00000000-0000-0000-0000-0000000000c1",
    product_cpe: "cpe:/o:example:fles:15:sp7",
    product_name: "Fictional Linux Enterprise Server 15 SP7",
    eligible: true,
    is_eligible_override: false,
    eligibility_override_by: null,
    eligibility_override_at: null,
    released_at: null,
    lifecycle_phase: "general_support",
    deleted_at: null,
    actionable: true,
    non_actionable_reason: null,
    ...fields,
  };
}

// A fictional track of a package, as the package tree returns it: the IBS
// codestream SUSE:FLES-15-SP7:Update, Affected, its delivery Pending, with
// one Product and the due dates of fictionalTicketDetail, its submission
// pending and current, with the fields that a test sets.
export function fictionalTrack(fields: Partial<TrackDetail> = {}): TrackDetail {
  return {
    id: "00000000-0000-0000-0000-0000000000b1",
    workflow_type: "ibs",
    reference: "SUSE:FLES-15-SP7:Update",
    status: "affected",
    delivery_status: "pending",
    delivery_relevant: true,
    products: [fictionalProduct()],
    deleted_at: null,
    actionable: true,
    non_actionable_reason: null,
    triage_due_at: "2099-10-12T14:05:09Z",
    submission_due_at: "2099-10-27T14:05:09Z",
    um_due_at: "2099-10-30T14:05:09Z",
    qa_due_at: "2099-11-08T14:05:09Z",
    release_due_at: "2099-11-08T14:05:09Z",
    milestones: {
      triage: "done",
      submission: "pending",
      um: "pending",
      qa: "pending",
    },
    current_phase: "submission",
    ...fields,
  };
}

// A fictional package of a Ticket, as the package tree returns it:
// fictional-openssl, with one track and one maintainer, with the fields that
// a test sets.
export function fictionalPackage(
  fields: Partial<PackageDetail> = {},
): PackageDetail {
  return {
    id: "00000000-0000-0000-0000-0000000000a1",
    package_name: "fictional-openssl",
    tracks: [fictionalTrack()],
    deleted_at: null,
    actionable: true,
    non_actionable_reason: null,
    maintainers: [
      {
        id: "00000000-0000-0000-0000-000000000004",
        username: "dbrown",
        full_name: "Dave Brown",
        active: true,
        bot: false,
      },
    ],
    ...fields,
  };
}

// The work of the signed-in user on a Ticket, as Get My Package Work for a
// Ticket returns it, with the pending tracks of the packages that a test
// names, and nothing in progress or completed.
export function ticketWorkResponse(
  pending: readonly { packageName: string; reference: string }[] = [],
): Response {
  const body: MaintainerTicketWorkResponse = {
    data: {
      pending: pending.map(({ packageName, reference }) => ({
        package_name: packageName,
        ticket_id: "SNTL-12",
        is_confidential: false,
        cve_id: "CVE-2099-0012",
        severity: "high",
        workflow_type: "ibs",
        reference,
        status: "affected",
        delivery_status: "pending",
        submission_due_at: "2099-10-27T14:05:09Z",
        submission_milestone: "pending",
      })),
      in_progress: [],
      completed: [],
    },
  };
  return jsonResponse(200, body);
}

// Get Ticket's response for a Ticket.
export function ticketResponse(ticket: TicketDetail): Response {
  const body: TicketDetailResponse = { data: ticket };
  return jsonResponse(200, body);
}

// A page of List Tickets: the Tickets, of a list of total Tickets.
export function ticketPage(
  tickets: TicketSummary[],
  { total = tickets.length, page = 1, perPage = 20 } = {},
): Response {
  const body: TicketListResponse = {
    data: tickets,
    meta: { total, page, per_page: perPage },
  };
  return jsonResponse(200, body);
}

// A request that a test answers.
export interface ApiRequest {
  method: string;
  // The path of the URL, such as /api/v1/users/me.
  path: string;
  // The query parameters of the URL.
  query: URLSearchParams;
  // The parsed JSON body, or undefined.
  body: unknown;
}

export type ApiResponder = (
  request: ApiRequest,
) => Response | Promise<Response>;

// The URL of a request.
export function urlOf(input: RequestInfo | URL): URL {
  const url = input instanceof Request ? input.url : input.toString();
  return new URL(url, window.location.origin);
}

// The path of the URL of a request.
function pathOf(input: RequestInfo | URL): string {
  return urlOf(input).pathname;
}

// Answers every request of the page with the responder, and returns the spy,
// whose calls name the requests.
export function stubApi(respond: ApiResponder) {
  return vi.spyOn(window, "fetch").mockImplementation((input, init) => {
    const body = init?.body;
    return Promise.resolve(
      respond({
        method: init?.method ?? "GET",
        path: pathOf(input),
        query: urlOf(input).searchParams,
        body: typeof body === "string" ? JSON.parse(body) : undefined,
      }),
    );
  });
}

// How many requests the spy received for the path.
export function requestsTo(
  spy: ReturnType<typeof stubApi>,
  path: string,
): number {
  return spy.mock.calls.filter(([input]) => pathOf(input) === path).length;
}
