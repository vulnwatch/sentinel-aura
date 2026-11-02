import { useQueryClient } from "@tanstack/react-query";
import {
  createRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Form } from "react-aria-components";
import {
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentFailure,
  validationErrorFields,
} from "../api/errors";
import { useLogin } from "../api/generated/authentication";
import { getGetCurrentUserProfileQueryOptions } from "../api/generated/users";
import { ApiError } from "../api/request";
import { Button } from "../components/button";
import { FOCUS_RING } from "../components/focus-ring";
import { Message } from "../components/message";
import { ScreenHeading } from "../components/screen-heading";
import { SignInColumn } from "../components/sign-in-column";
import { TextField } from "../components/text-field";
import { hasSavedReturnUrl, hasSessionRecord } from "../session";
import { rootRoute } from "./root";

// Sign in (docs/screens/sign-in.md): local sign-in with a username and a
// password (Sentinel docs/features/identity/local-authentication.md, Login).
// It shows only without a session; once one exists, the session gate leaves
// it (src/session-gate.tsx).

const FIELDS = ["username", "password"] as const;
type Field = (typeof FIELDS)[number];

// The message of a rejected sign-in. Sentinel answers every credential
// failure with the same generic 401, so that a sign-in does not reveal
// whether its username exists (Sentinel
// docs/features/identity/local-authentication.md, Login).
const MESSAGE_REJECTED = "The username or password isn't correct.";

// What a submission that failed shows: a message at the top of the form, with
// its reference, and the fields with an error.
interface Failure {
  message: { text: string; reference: string | undefined } | undefined;
  fields: readonly Field[];
}

const NO_FAILURE: Failure = { message: undefined, fields: [] };

// A username without its surrounding whitespace, which Sentinel removes
// before it looks the user up (same section).
function validateUsername(value: string): string | null {
  return value.trim() === "" ? "Enter your username." : null;
}

function validatePassword(value: string): string | null {
  return value === "" ? "Enter your password." : null;
}

// What a failed sign-in shows (docs/behaviors.md, Where Errors Appear;
// Default Presentation by Status; Retries and Unconfirmed Changes): a 401, as
// Sentinel answers rejected credentials, the message of a rejected sign-in;
// the field errors of a VALIDATION_ERROR at their fields; and every other
// failure, 429 AUTH_ACCOUNT_LOCKED included, the message of its status for
// sign-in.
function signInFailure(failure: unknown): Failure {
  if (!isRequestFailure(failure)) {
    throw failure;
  }
  if (failure instanceof ApiError && failure.status === 401) {
    return {
      message: { text: MESSAGE_REJECTED, reference: undefined },
      fields: [],
    };
  }
  if (failure instanceof ApiError && failure.code === "VALIDATION_ERROR") {
    const { fields, unmatched } = validationErrorFields(failure, FIELDS);
    if (!unmatched) {
      return { message: undefined, fields };
    }
    return { message: messageOf(failure), fields };
  }
  return { message: messageOf(failure), fields: [] };
}

// The message of the status of a failure of sign-in, or of the read of the
// signed-in user that follows it: none for a 401, whose session has ended.
function messageOf(failure: unknown): Failure["message"] {
  if (!isRequestFailure(failure)) {
    throw failure;
  }
  const presentation = presentFailure(failure, "session");
  return (
    presentation && {
      text: presentation.message,
      reference: presentation.reference,
    }
  );
}

function SignInForm() {
  const client = useQueryClient();
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
  // top of the form, or to the first field with an error (docs/behaviors.md,
  // Accessibility, Announcements).
  useEffect(() => {
    const [field] = failure.fields;
    if (failure.message !== undefined) {
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

  const fail = (error: unknown, toFailure: (error: unknown) => Failure) => {
    try {
      setFailure(toFailure(error));
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
      fail(error, signInFailure);
      return;
    }
    try {
      await client.fetchQuery({
        ...getGetCurrentUserProfileQueryOptions(),
        staleTime: 0,
      });
    } catch (error) {
      fail(error, (read) => ({ message: messageOf(read), fields: [] }));
    }
  };

  // While the button is busy, it does not submit the form, and Enter in a
  // field does not either: a form without a submit button and with two fields
  // is not submitted implicitly (HTML, Implicit submission).
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
      {failure.message !== undefined && (
        <div
          ref={messageRef}
          tabIndex={-1}
          className={`rounded-md ${FOCUS_RING}`}
        >
          <Message tone="danger" reference={failure.message.reference}>
            {failure.message.text}
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
  // The UI led here and the browser had a session before, which only the
  // session record shows (docs/behaviors.md, Session Expiration Message). Read
  // once, so that the message stays while Sign in shows.
  const [expired] = useState(() => hasSavedReturnUrl() && hasSessionRecord());

  // Sign in accepts no search parameter, so it drops every one from its URL
  // (docs/behaviors.md, Invalid Search Parameters).
  useEffect(() => {
    if (search !== "") {
      void navigate({ to: "/login", hash: true, replace: true });
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
