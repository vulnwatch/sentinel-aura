# Sign in

This screen document records Sign in as built (`docs/conventions.md`, Screen
Documents). It follows the foundation documents and states only what the
screen adds to them: the session, the return after sign-in, and the
expiration message belong to `docs/behaviors.md` (Session), and the layout of
the screen to `docs/design-system.md` (Sign In Page). Backend behavior and the
API contract belong to Sentinel (`README.md`, Specification Boundary).

## Purpose

Sign in starts a session with a username and a password, through Sentinel's
local sign-in (Sentinel `docs/features/identity/local-authentication.md`,
Login). Every user who has a local account uses it. SSO is deferred in
Sentinel, and the pinned contract has none of its operations (Sentinel
`docs/features/identity/sso-authentication.md`, Status), so Sign in offers
local sign-in only (`docs/screen-map.md`, Contract URLs).

## Access

Sign in shows only without a session. Opened with one, it opens the saved URL
or the landing, as when it learns that a session exists
(`docs/behaviors.md`, Return After Sign-in). It needs no capability.

## Navigation

- Path: `/login` (`docs/screen-map.md`, Areas and Screens). Sign in accepts no
  search parameter: it removes every one from its URL
  (`docs/behaviors.md`, Invalid Search Parameters).
- The UI leads to Sign in from every screen that requires a session when the
  browser has none, in place of that screen in the browser history
  (`docs/behaviors.md`, Session State; `docs/screen-map.md`, Browser History).
- After the sign-in, it opens the saved URL, or the landing, in place of Sign
  in in the browser history.
- The product name above the card is not a link: without a session, the
  landing leads back to Sign in.

## Content

- The heading "Sign in", and the page title "Sign in – Sentinel".
- The information "Your session has expired. Sign in again." when the UI led
  to Sign in and the browser had a session before (`docs/behaviors.md`,
  Session Expiration Message). It stays while Sign in shows, also after a
  reload.
- The form: Username and Password, which state their purpose to the browser
  as a username and a current password and accept pasting and password
  managers (`docs/behaviors.md`, Accessibility, Sign in), and the primary
  button "Sign in".

## Actions

**Sign in** sends `POST /api/v1/auth/login` with the username and the
password as typed; Sentinel removes the whitespace around the username and
lowercases it (Sentinel `docs/features/identity/local-authentication.md`,
Login). It asks for no confirmation.

- Before sending, it checks that the username, without its surrounding
  whitespace, and the password are not empty. An empty field says "Enter your
  username." or "Enter your password.", and nothing is sent. Sentinel's
  contract publishes no other constraint for these fields: it answers the
  lengths that it limits with its generic `401` (Sentinel `docs/api-spec.md`,
  Published Input Constraints).
- While the sign-in is in progress, the button is busy, and pressing it or
  Enter in a field sends nothing more.
- On success, Sign in reads the signed-in user (Sentinel
  `docs/features/identity/authentication.md`, Get Current User), and then
  leaves, as Return After Sign-in states. The button stays busy until then.
  The token of the response is not used: the browser holds the session cookie
  (`docs/architecture.md`, Session Cookie).

## States

- Loading: the button is busy (`docs/behaviors.md`, Loading).
- Errors of the sign-in, and of the read of the signed-in user that follows
  it, show at the top of the form, as a `danger` message, and the form keeps
  its input (`docs/behaviors.md`, Where Errors Appear). The focus then moves to
  the message, or, when only fields have errors, to the first of them in the
  form (`docs/behaviors.md`, Accessibility, Announcements). The button is then
  no longer busy, and the user can sign in again.
- A field error goes once its value changes and the focus leaves the field;
  the message at the top of the form goes when the form is sent again.

| Request | Response | Shows |
|---|---|---|
| Sign-in | `401 AUTH_INVALID_CREDENTIALS`, and any other `401` | "The username or password isn't correct." Sentinel answers every credential failure alike, so Sign in never tells whether the username exists (Sentinel `docs/features/identity/local-authentication.md`, Login) |
| Sign-in | `429 AUTH_ACCOUNT_LOCKED` | The message of `429`, "Too many attempts. Try again later." The time that the `Retry-After` header states is not shown (Sentinel `docs/features/identity/local-authentication.md`, Account lockout) |
| Sign-in | `422 VALIDATION_ERROR` | Each field error at its field, as `docs/behaviors.md` (Where Errors Appear) states |
| Read of the signed-in user after a successful sign-in | `401` | "Sentinel signed you in, but this browser didn't keep the session. Allow cookies for Sentinel, then sign in again." The session cookie did not reach Sentinel, for example because the browser refuses cookies for the site (Sentinel `docs/features/identity/authentication.md`, Session cookie; Frontend session behavior) |
| Either | Any other failure | The message of its status for sign-in (`docs/behaviors.md`, Default Presentation by Status; Retries and Unconfirmed Changes) |

## Cross-references

- `docs/behaviors.md` — Session; Errors; Loading; Accessibility; Wording
- `docs/design-system.md` — Sign In Page; Buttons and Links; Forms; Messages
- `docs/screen-map.md` — Areas and Screens; Browser History; Landing;
  Contract URLs
- `docs/architecture.md` — Session Cookie
- Sentinel `docs/features/identity/local-authentication.md` — Login; Account
  lockout; Login Page
- Sentinel `docs/features/identity/authentication.md` — Session cookie;
  Frontend session behavior; Get Current User
- Sentinel `docs/features/identity/sso-authentication.md` — Status
- Sentinel `docs/api-spec.md` — Published Input Constraints; Response Format;
  Global Responses
