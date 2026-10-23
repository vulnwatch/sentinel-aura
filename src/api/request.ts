// The shared request function of the generated API client
// (docs/architecture.md, API Client Generation): every generated request
// function calls apiRequest, and orval.config.ts names it.

// Every operation that the UI calls is under this prefix, addressed by an
// origin-relative URL (Sentinel docs/api-spec.md, Base URL).
const API_PREFIX = "/api/v1/";

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

  constructor(status: number, code: string | undefined, body: unknown) {
    super(
      code === undefined
        ? `API request failed with status ${status}`
        : `API request failed with status ${status} and code ${code}`,
    );
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

// The error type of the generated hooks. Orval passes the error bodies that
// the operation declares, but an error response may not match them, so it is
// not used. A request that receives no response fails with the browser's own
// error, such as a TypeError or an AbortError.
export type ErrorType<_DeclaredBody> = ApiError | Error;

// Sends a request of the generated client and returns its parsed JSON body,
// or undefined for 204 No Content. Throws an ApiError for every response
// whose status is not successful.
export async function apiRequest<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  if (!url.startsWith(API_PREFIX)) {
    throw new TypeError(`Not an API URL under ${API_PREFIX}: ${url}`);
  }
  // The browser's default, stated so that no caller can change it: the
  // session cookie goes only to the UI's own origin.
  const response = await fetch(url, { ...init, credentials: "same-origin" });
  if (!response.ok) {
    throw await toApiError(response);
  }
  // The generated type of a 204 response is void.
  const body: unknown =
    response.status === 204 ? undefined : await response.json();
  // The generated client types the body by the pinned OpenAPI document, which
  // the response is not validated against at run time.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return body as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Not JSON, such as an HTML error page of a proxy: no code.
    return new ApiError(response.status, undefined, undefined);
  }
  if (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
  ) {
    return new ApiError(response.status, body.code, body);
  }
  return new ApiError(response.status, undefined, undefined);
}
