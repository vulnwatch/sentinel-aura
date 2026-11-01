import { QueryClient } from "@tanstack/react-query";
import { ApiError, NetworkError } from "./api/request";

// The query client of the UI, which holds the data read from the API
// (docs/conventions.md, Data Read from the API), with the defaults of every
// read and change (docs/behaviors.md, Retries and Unconfirmed Changes;
// Loading).

// How many more times a failed read is sent before its error shows.
const READ_RETRIES = 2;

// A read is sent again only after a network failure or a 5xx; a cancelled
// read is not a failure, and TanStack Query never retries it.
function isRetried(error: unknown): boolean {
  return (
    error instanceof NetworkError ||
    (error instanceof ApiError && error.status >= 500)
  );
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          failureCount < READ_RETRIES && isRetried(error),
        // A screen reads its data again when the tab returns to the
        // foreground, which TanStack Query detects as a change of the
        // visibility of the page, but not when the network returns. A read
        // that failed without data has no data to read again: its error
        // stays, and Try again sends it again.
        refetchOnWindowFocus: (query) => query.state.data !== undefined,
        refetchOnReconnect: false,
        // Every request is sent whatever the browser reports about the
        // network: a read then fails with its error instead of waiting, and
        // a change never waits to be sent later on its own.
        networkMode: "always",
      },
      mutations: {
        retry: false,
        networkMode: "always",
      },
    },
  });
}
