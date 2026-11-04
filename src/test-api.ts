import { vi } from "vitest";
import type {
  CurrentUserResponse,
  ErrorResponse,
  LoginResponse,
  TicketListResponse,
  TicketSummary,
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
// unassigned, and a triage deadline, with the fields that a test sets.
export function fictionalTicket(
  fields: Partial<TicketSummary> = {},
): TicketSummary {
  return {
    ticket_id: "SNTL-1",
    status: "new",
    severity: "high",
    priority: "p2",
    assignee: null,
    cve: {
      cve_id: "CVE-2099-0001",
      title: "Fictional buffer overflow in fictional-curl",
      description: "A fictional description.",
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
