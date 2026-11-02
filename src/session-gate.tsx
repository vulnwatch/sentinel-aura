import {
  hashKey,
  useQueryClient,
  type Mutation,
  type Query,
  type QueryClient,
  type QueryFunction,
  type QueryState,
} from "@tanstack/react-query";
import {
  useRouter,
  useRouterState,
  type AnyRouter,
  type StaticDataRouteOption,
} from "@tanstack/react-router";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "./api/request";
import {
  getLoginMutationKey,
  getLogoutMutationKey,
} from "./api/generated/authentication";
import type { CurrentUserResponse } from "./api/generated/model";
import {
  getCurrentUserProfile,
  getGetCurrentUserProfileQueryKey,
  useGetCurrentUserProfile,
} from "./api/generated/users";
import { ErrorInPlace } from "./components/error-in-place";
import { Loading } from "./components/loading";
import { focusScreenHeading } from "./components/screen-heading";
import { SignInColumn } from "./components/sign-in-column";
import { rememberSession, saveReturnUrl, takeReturnUrl } from "./session";

// The session of the UI (docs/behaviors.md, Session State; Return After
// Sign-in; The Signed-in User): the read of the signed-in user before any
// screen, Sign in when the browser has no valid session, and the return from
// Sign in once a session exists. The UI cannot read the session cookie, so it
// learns the state of the session only from the API's responses
// (docs/architecture.md, Session Cookie).

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    // How the route depends on the session: Sign in, which shows only without
    // one, or optional, as for /auth/callback. A route without it requires a
    // session (docs/screen-map.md, Contract URLs).
    session?: "sign-in" | "optional";
  }

  interface HistoryState {
    // Whether the UI led to Sign in, which the entry of Sign in in the
    // browser history keeps across a reload, and which Sign in opened
    // directly lacks (docs/behaviors.md, Session Expiration Message).
    ledToSignIn?: boolean;
  }
}

type SessionRequirement = "required" | "sign-in" | "optional";

// The requirement of the screen that the matches show: the one of the route
// that declares it, or a session. A path that matches no screen requires one
// too, so that Not found shows only to a signed-in user.
function requirementOf(
  matches: readonly { staticData: StaticDataRouteOption }[],
): SessionRequirement {
  for (const match of matches) {
    const { session } = match.staticData;
    if (session !== undefined) {
      return session;
    }
  }
  return "required";
}

// The requirement of the screen to which the router leads: its latest
// location, which a navigation sets at once, before the screen shows.
function latestRequirement(router: AnyRouter): SessionRequirement {
  return requirementOf(router.matchRoutes(router.latestLocation));
}

const USER_QUERY_HASH = hashKey(getGetCurrentUserProfileQueryKey());
const SESSION_MUTATIONS = new Set([
  hashKey(getLoginMutationKey()),
  hashKey(getLogoutMutationKey()),
]);

function isUserQuery(query: Query): boolean {
  return query.queryHash === USER_QUERY_HASH;
}

// Sign-in and sign-out, whose 401 does not end a session (Sentinel
// docs/features/identity/local-authentication.md, Login; Sentinel
// docs/features/identity/authentication.md, Logout).
function isSessionChange(mutation: Mutation) {
  const key = mutation.options.mutationKey;
  return key !== undefined && SESSION_MUTATIONS.has(hashKey(key));
}

// A 401, which means that the browser has no valid session (Sentinel
// docs/features/identity/authentication.md, Frontend session behavior).
function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

// A 403 after which the UI reads the signed-in user again: every 403 but
// AUTH_CROSS_ORIGIN_REJECTED, which reports how the UI is served
// (docs/behaviors.md, Default Presentation by Status).
function isForbidden(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.code !== "AUTH_CROSS_ORIGIN_REJECTED"
  );
}

// Whether a read of the signed-in user that failed shows its error in place of
// the screen: one that failed without data, other than with a 401, as the UI
// loads or on a screen that requires a session. Only Try again reads it again
// then, not the return of the tab to the foreground (docs/behaviors.md,
// Loading).
function failsInPlace(
  state: Pick<QueryState<unknown, unknown>, "status" | "data" | "error">,
  known: boolean,
  requirement: SessionRequirement,
): boolean {
  return (
    state.status === "error" &&
    state.data === undefined &&
    !isUnauthorized(state.error) &&
    (!known || requirement === "required")
  );
}

// Discards the data read from the API, so that the next user of the browser
// cannot see it, and the changes with their input: every query except the
// read of the signed-in user when it is kept.
function discardApiData(client: QueryClient, keep: (query: Query) => boolean) {
  client.removeQueries({ predicate: (query) => !keep(query) });
  client.getMutationCache().clear();
}

// The read of the signed-in user, which every caller that reads it uses, so
// that each read checks the user that it returns, whoever sends it. A read
// that returns another user than the one that the tab shows, for example
// after another account signed in in another tab, discards all the data read
// from the API except that user's, and opens the landing of that user
// (docs/behaviors.md, The Signed-in User).
export function readSignedInUser(
  client: QueryClient,
  router: AnyRouter,
): QueryFunction<CurrentUserResponse> {
  return async ({ signal }) => {
    const shown = client.getQueryData<CurrentUserResponse>(
      getGetCurrentUserProfileQueryKey(),
    );
    const read = await getCurrentUserProfile({ signal });
    if (shown !== undefined && shown.data.id !== read.data.id) {
      discardApiData(client, isUserQuery);
      void router.navigate({ to: "/", replace: true });
    }
    return read;
  };
}

interface SessionGateProps {
  // The screen of the URL.
  children: ReactNode;
}

// Shows the screen of the URL once the session allows it. The screen starts
// again when another user signs in, so that it keeps nothing of the previous
// one, such as input not yet submitted (docs/behaviors.md, Session State).
export function SessionGate({ children }: SessionGateProps) {
  const router = useRouter();
  const client = useQueryClient();
  const requirement = useRouterState({
    select: (state) => requirementOf(state.matches),
  });
  // Whether the UI has learned whether a session exists: from a user, or from
  // a 401. A later read that fails otherwise changes nothing.
  const [known, setKnown] = useState(false);
  const user = useGetCurrentUserProfile({
    query: {
      queryFn: readSignedInUser(client, router),
      refetchOnWindowFocus: (query) =>
        !failsInPlace(query.state, known, requirement),
    },
  });
  const noSession = isUnauthorized(user.error);
  const signedIn = user.data !== undefined && !noSession;
  if (!known && (signedIn || noSession)) {
    setKnown(true);
  }

  // Leads from a screen that requires a session to Sign in, in place of the
  // screen in the browser history (docs/screen-map.md, Browser History), and
  // saves the URL of the screen. The read of the signed-in user is kept only
  // when it holds no user, as after a 401 as the UI loads. It leads there
  // once, however many responses end the session: the navigation sets the
  // router's latest location at once.
  const endSession = useCallback(() => {
    if (latestRequirement(router) !== "required") {
      return;
    }
    saveReturnUrl(router.state.location.href);
    discardApiData(
      client,
      (query) => isUserQuery(query) && query.state.data === undefined,
    );
    void router.navigate({
      to: "/login",
      replace: true,
      state: { ledToSignIn: true },
    });
  }, [client, router]);

  useEffect(() => {
    if (requirement === "required" && noSession) {
      endSession();
    }
  }, [requirement, noSession, endSession]);

  // Sign in shows only without a session: once one exists, it opens the saved
  // URL when it passes its check, and the landing otherwise, in place of Sign
  // in (docs/behaviors.md, Return After Sign-in).
  useEffect(() => {
    if (
      requirement === "sign-in" &&
      signedIn &&
      latestRequirement(router) === "sign-in"
    ) {
      void router.navigate({ href: takeReturnUrl() ?? "/", replace: true });
    }
  }, [requirement, signedIn, router]);

  // Every successful read of the signed-in user records that this browser has
  // a session (docs/behaviors.md, Session Expiration Message).
  useEffect(() => {
    if (signedIn && user.dataUpdatedAt > 0) {
      rememberSession();
    }
  }, [signedIn, user.dataUpdatedAt]);

  // A 401 of any other request than sign-in and sign-out ends the session on a
  // screen that requires one; on Sign in and /auth/callback it changes
  // nothing. A 403 reads the signed-in user again, whose roles may have
  // changed (docs/behaviors.md, Session State; The Signed-in User).
  useEffect(() => {
    const onFailure = (error: unknown) => {
      if (isUnauthorized(error)) {
        endSession();
      } else if (isForbidden(error)) {
        void client.invalidateQueries({
          queryKey: getGetCurrentUserProfileQueryKey(),
        });
      }
    };
    const unsubscribeQueries = client.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.action.type === "error" &&
        !isUserQuery(event.query)
      ) {
        onFailure(event.action.error);
      }
    });
    const unsubscribeMutations = client
      .getMutationCache()
      .subscribe((event) => {
        if (
          event.type === "updated" &&
          event.action.type === "error" &&
          !isSessionChange(event.mutation)
        ) {
          onFailure(event.action.error);
        }
      });
    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [client, endSession]);

  const failed = failsInPlace(user, known, requirement);
  const waiting =
    !failed &&
    (!known || (requirement === "required" && !signedIn && !noSession));

  // Try again replaces its error with the loading indicator, which has no
  // heading, so the focus that it held moves to the heading of what shows
  // once the read ends: its error again, or the screen, after the navigation
  // that leaves Sign in when it applies (docs/behaviors.md, Accessibility,
  // Focus after an action).
  const retried = useRef(false);
  useEffect(() => {
    if (retried.current && !waiting && document.querySelector("h1") !== null) {
      retried.current = false;
      focusScreenHeading();
    }
  });

  if (failed) {
    return (
      <SignInColumn>
        <ErrorInPlace
          error={user.error}
          placement="screen"
          retryAlways
          onRetry={() => {
            retried.current = true;
            void user.refetch();
          }}
        />
      </SignInColumn>
    );
  }
  if (waiting) {
    // As the UI loads, it shows only the loading indicator, centered in the
    // window, until it knows whether a session exists (docs/design-system.md,
    // Loading).
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loading />
      </div>
    );
  }
  if (
    (requirement === "required" && !signedIn) ||
    (requirement === "sign-in" && signedIn)
  ) {
    // Leading to Sign in, or away from it.
    return null;
  }
  return <Fragment key={user.data?.data.id ?? ""}>{children}</Fragment>;
}
