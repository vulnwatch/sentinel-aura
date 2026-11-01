// The shared request function of the generated API client
// (docs/architecture.md, API Client Generation): every generated request
// function calls apiRequest, and orval.config.ts names it.

// Every operation that the UI calls is under this prefix, addressed by an
// origin-relative URL (Sentinel docs/api-spec.md, Base URL).
const API_PREFIX = "/api/v1/";

// The header that identifies a request in Sentinel's logs, which a report of
// an error names (Sentinel docs/api-spec.md, Request Tracing).
const REQUEST_ID_HEADER = "X-Request-ID";

// An error response of the API, or any other error response that a request
// receives, such as one produced before the request reaches Sentinel.
export class ApiError extends Error {
  // The HTTP status of the response.
  readonly status: number;
  // Sentinel's error code, when the response provides one (Sentinel
  // docs/api-spec.md, Response Format).
  readonly code: string | undefined;
  // The parsed JSON body of the response when it provides a code, such as
  // the field errors of VALIDATION_ERROR; otherwise undefined.
  readonly body: unknown;
  // The identifier of the request, when the response carries one: a
  // response that Sentinel did not produce may not.
  readonly requestId: string | undefined;

  constructor(
    status: number,
    code: string | undefined,
    body: unknown,
    requestId: string | undefined,
  ) {
    super(
      code === undefined
        ? `API request failed with status ${status}`
        : `API request failed with status ${status} and code ${code}`,
    );
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
    this.requestId = requestId;
  }
}

// A request that received no response, because the network, Sentinel's
// host, or Sentinel could not be reached. A request that its caller cancels
// fails with the browser's own error instead, such as an AbortError.
export class NetworkError extends Error {
  constructor(options: ErrorOptions) {
    super("API request received no response", options);
    this.name = "NetworkError";
  }
}

// A successful response whose body the UI cannot read, such as one that is
// not JSON.
export class UnreadableResponseError extends Error {
  // The HTTP status of the response.
  readonly status: number;
  // The identifier of the request, when the response carries one.
  readonly requestId: string | undefined;

  constructor(
    status: number,
    requestId: string | undefined,
    options: ErrorOptions,
  ) {
    super(`API response with status ${status} cannot be read`, options);
    this.name = "UnreadableResponseError";
    this.status = status;
    this.requestId = requestId;
  }
}

// The error type of the generated hooks. Orval passes the error bodies that
// the operation declares, but an error response may not match them, so it is
// not used. A cancelled request fails with the browser's own error, such as
// an AbortError.
export type ErrorType<_DeclaredBody> =
  ApiError | NetworkError | UnreadableResponseError | Error;

// Sends a request of the generated client and returns its parsed JSON body,
// or undefined for 204 No Content. Throws an ApiError for every response
// whose status is not successful, a NetworkError when no response arrives,
// and an UnreadableResponseError when the body of a successful response
// cannot be read; a cancelled request keeps the browser's error.
export async function apiRequest<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  if (!url.startsWith(API_PREFIX)) {
    throw new TypeError(`Not an API URL under ${API_PREFIX}: ${url}`);
  }
  let response: Response;
  try {
    // The browser's default, stated so that no caller can change it: the
    // session cookie goes only to the UI's own origin.
    response = await fetch(url, { ...init, credentials: "same-origin" });
  } catch (error) {
    throw init.signal?.aborted ? error : new NetworkError({ cause: error });
  }
  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? undefined;
  if (!response.ok) {
    throw await toApiError(response, requestId, init.signal);
  }
  // The generated type of a 204 response is void.
  let body: unknown;
  if (response.status !== 204) {
    try {
      body = await response.json();
    } catch (error) {
      throw init.signal?.aborted
        ? error
        : new UnreadableResponseError(response.status, requestId, {
            cause: error,
          });
    }
  }
  // The generated client types the body by the pinned OpenAPI document, which
  // the response is not validated against at run time.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return body as T;
}

async function toApiError(
  response: Response,
  requestId: string | undefined,
  signal: AbortSignal | null | undefined,
): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    // Not JSON, such as an HTML error page of a proxy: no code.
    return new ApiError(response.status, undefined, undefined, requestId);
  }
  if (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
  ) {
    return new ApiError(response.status, body.code, body, requestId);
  }
  return new ApiError(response.status, undefined, undefined, requestId);
}
