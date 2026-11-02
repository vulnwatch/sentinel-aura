import { useQueryClient } from "@tanstack/react-query";
import {
  createRoute,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Form } from "react-aria-components";
import {
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentSignInFailure,
  validationErrorFields,
  type MessagePresentation,
} from "../api/errors";
import { useLogin } from "../api/generated/authentication";
import { getGetCurrentUserProfileQueryOptions } from "../api/generated/users";
import { Button } from "../components/button";
import { FOCUS_RING } from "../components/focus-ring";
import { Message } from "../components/message";
import { ScreenHeading } from "../components/screen-heading";
import { SignInColumn } from "../components/sign-in-column";
import { TextField } from "../components/text-field";
import { hasSessionRecord } from "../session";
import { readSignedInUser } from "../session-gate";
import { rootRoute } from "./root";

// Sign in (docs/screens/sign-in.md): local sign-in with a username and a
// password (Sentinel docs/features/identity/local-authentication.md, Login).
// It shows only without a session; once one exists, the session gate leaves
// it (src/session-gate.tsx).

const FIELDS = ["username", "password"] as const;
type Field = (typeof FIELDS)[number];

// What a submission that failed shows: a message at the top of the form, with
// its reference, and the fields with an error, in the order of the form.
interface Failure {
  top: MessagePresentation | undefined;
  fields: readonly Field[];
}

const NO_FAILURE: Failure = { top: undefined, fields: [] };

// A username without its surrounding whitespace, which Sentinel removes
// before it looks the user up (same section).
function validateUsername(value: string): string | null {
  return value.trim() === "" ? "Enter your username." : null;
}

function validatePassword(value: string): string | null {
  return value === "" ? "Enter your password." : null;
}

// What a failure of the sign-in, or of the read of the signed-in user that
// follows it, shows (docs/screens/sign-in.md, States; docs/behaviors.md,
// Where Errors Appear): the field errors of a VALIDATION_ERROR at their
// fields, and any other error as the message at the top of the form. A
// failure of the UI itself is thrown, for the router to show.
function failureOf(
  failure: unknown,
  request: "sign-in" | "signed-in user",
): Failure {
  if (!isRequestFailure(failure)) {
    throw failure;
  }
  const { fields, unmatched } = validationErrorFields(failure, FIELDS);
  return {
    top: unmatched ? presentSignInFailure(failure, request) : undefined,
    fields,
  };
}

function SignInForm() {
  const client = useQueryClient();
  const router = useRouter();
  // The input lives in the form until it is submitted; the change keeps none
  // of it once the form is gone.
  const signIn = useLogin({ mutation: { gcTime: 0 } });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(NO_FAILURE);
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const messageRef = useRef<HTMLDivElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // After a submission that failed, the focus moves to the message at the
  // top of the form, or to the first field of the form with an error
  // (docs/behaviors.md, Accessibility, Announcements).
  useEffect(() => {
    const [field] = failure.fields;
    if (failure.top !== undefined) {
      messageRef.current?.focus();
    } else if (field !== undefined) {
      (field === "username" ? usernameRef : passwordRef).current?.focus();
    }
  }, [failure]);

  // The field errors of the failure, which the form shows until the user
  // changes the value of their field. The form shows them again only for
  // another failure, so they are built once for each.
  const validationErrors = useMemo(
    () =>
      Object.fromEntries(
        failure.fields.map((field) => [field, MESSAGE_INVALID_VALUE]),
      ),
    [failure],
  );

  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }

  const fail = (error: unknown, request: "sign-in" | "signed-in user") => {
    try {
      setFailure(failureOf(error, request));
    } catch (uiError) {
      setUiFailure({ error: uiError });
    }
    setBusy(false);
  };

  // Signs in, then reads the signed-in user, from which the session gate
  // learns that a session exists and leaves Sign in. The button stays busy
  // until then. The token of the response is not used: the browser holds the
  // session cookie (docs/architecture.md, Session Cookie).
  const submit = async () => {
    setBusy(true);
    setFailure(NO_FAILURE);
    try {
      await signIn.mutateAsync({ data: { username, password } });
    } catch (error) {
      fail(error, "sign-in");
      return;
    }
    try {
      await client.fetchQuery(
        getGetCurrentUserProfileQueryOptions({
          query: { queryFn: readSignedInUser(client, router), staleTime: 0 },
        }),
      );
    } catch (error) {
      fail(error, "signed-in user");
    }
  };

  // While the button is busy, it does not submit the form, and Enter in a
  // field does not either: a form without a submit button and with two fields
  // is not submitted implicitly (HTML, Implicit submission). A form with one
  // field would guard its submission itself.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  return (
    <Form
      onSubmit={onSubmit}
      validationErrors={validationErrors}
      className="flex flex-col gap-3"
    >
      {failure.top !== undefined && (
        <div
          ref={messageRef}
          tabIndex={-1}
          className={`rounded-md ${FOCUS_RING}`}
        >
          <Message tone="danger" reference={failure.top.reference}>
            {failure.top.message}
          </Message>
        </div>
      )}
      <TextField
        label="Username"
        name="username"
        autoComplete="username"
        isRequired
        value={username}
        onChange={setUsername}
        validate={validateUsername}
        inputRef={usernameRef}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        isRequired
        value={password}
        onChange={setPassword}
        validate={validatePassword}
        inputRef={passwordRef}
      />
      <div className="mt-1 flex justify-end">
        <Button type="submit" variant="primary" size="large" isBusy={busy}>
          Sign in
        </Button>
      </div>
    </Form>
  );
}

export function SignInPage() {
  const navigate = useNavigate();
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const ledHere = useRouterState({
    select: (state) => state.location.state.ledToSignIn === true,
  });
  // The UI led here, as the entry of Sign in in the browser history records
  // (src/session-gate.tsx), and the browser had a session before, which only
  // the session record shows (docs/behaviors.md, Session Expiration Message).
  // Read once, so that the message stays while Sign in shows.
  const [expired] = useState(() => ledHere && hasSessionRecord());

  // Sign in accepts no search parameter, so it drops every one from its URL,
  // and keeps the state of its entry (docs/behaviors.md, Invalid Search
  // Parameters).
  useEffect(() => {
    if (search !== "") {
      void navigate({ to: "/login", hash: true, state: true, replace: true });
    }
  }, [search, navigate]);

  return (
    <SignInColumn>
      <ScreenHeading>Sign in</ScreenHeading>
      {expired && (
        <Message tone="info">Your session has expired. Sign in again.</Message>
      )}
      <SignInForm />
    </SignInColumn>
  );
}

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  staticData: { session: "sign-in" },
  component: SignInPage,
});
