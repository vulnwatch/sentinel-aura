# Conventions

## Contents

- [Document Scope, Authority, and Navigation](#document-scope-authority-and-navigation)
- [General Principles](#general-principles)
- [Cross-Cutting Rules](#cross-cutting-rules)
  - [Example Data in Documentation](#example-data-in-documentation)
  - [Dependency Admission](#dependency-admission)
- [Code Conventions](#code-conventions)
  - [Directory Structure and Naming](#directory-structure-and-naming)
  - [Routes](#routes)
  - [API Access](#api-access)
  - [Data Read from the API](#data-read-from-the-api)
  - [Error Codes and Messages](#error-codes-and-messages)
  - [Components and Styling](#components-and-styling)
  - [No Raw HTML Injection](#no-raw-html-injection)
  - [Links from the API](#links-from-the-api)
  - [Tests](#tests)
  - [End-to-End Tests](#end-to-end-tests)
  - [Checks](#checks)
- [Shell Scripting](#shell-scripting)
  - [Tooling Structure](#tooling-structure)
  - [Scope](#scope)
  - [Interpreter and Safety](#interpreter-and-safety)
  - [Static Analysis — shellcheck](#static-analysis--shellcheck)
  - [Formatting — shfmt](#formatting--shfmt)
  - [Workflow Shell — actionlint](#workflow-shell--actionlint)
  - [Naming and Structure](#naming-and-structure)
  - [File Placement](#file-placement)
  - [Enforcement](#enforcement)
- [Git Conventions](#git-conventions)
  - [Workflow](#workflow)
    - [Issues and work units](#issues-and-work-units)
  - [Pull Request Requirements](#pull-request-requirements)
  - [Issue and PR Body Formatting](#issue-and-pr-body-formatting)
  - [Branch Naming](#branch-naming)
  - [Commit Messages](#commit-messages)
  - [Versioning](#versioning)
- [Specification Writing](#specification-writing)
  - [Specification Ownership](#specification-ownership)
  - [Foundation Documents](#foundation-documents)
  - [Screen Documents](#screen-documents)
  - [Sentinel Cross-references](#sentinel-cross-references)
  - [Roadmap Independence](#roadmap-independence)

## Document Scope, Authority, and Navigation

This document defines Sentinel Aura's technical, documentation, and Git
conventions. It owns reusable engineering patterns, naming, repository
workflow, and specification-writing rules, including the format of the
foundation and screen documents. UI behavior belongs to the foundation and
screen documents; backend behavior, the API contract, and the obligations that
the contract places on clients belong to Sentinel's specifications (`README.md`,
Specification Boundary).

Summaries and examples here explain how to apply a convention; they do not
replace a more specific owning contract. When this document names such an
authority, follow that authority for behavior and use this document for the
shared implementation or writing pattern. `AGENTS.md` defines when each
section and related authority must be loaded.

## General Principles

- All code, comments, and documentation MUST be in English
- Follow the principle of least surprise: code should do what a reader expects
- Prefer explicit over implicit
- Keep functions short and focused on a single responsibility
- Use Sentinel only through its API, as its contract defines it. Never depend
  on backend behavior that Sentinel's specifications and the pinned OpenAPI
  document do not state (`AGENTS.md`, Sentinel as an External Authority)

## Cross-Cutting Rules

### Example Data in Documentation

All examples, API response samples, test fixtures, screenshots, and
documentation snippets MUST use fictional placeholder data. Never copy real
personal identifiers — names, email addresses, usernames, Distinguished Names,
or any other PII — from a Sentinel deployment or any other external system
into the repository, an issue, or a pull request.

Approved placeholder patterns:

| Type          | Examples                                             |
|---------------|------------------------------------------------------|
| Person names  | `John Doe`, `Alice Smith`, `Bob Wilson`              |
| Usernames     | `jdoe`, `asmith`, `bwilson`                          |
| Emails        | `john.doe@suse.com`, `alice.smith@example.com`       |
| Groups        | `pkg-maintainers`, `kernel-team`                     |
| Group emails  | `pkg-maintainers@suse.de`                            |
| External IDs  | `ext-12345`, `00000000-0000-0000-0000-000000000001` |
| IPv4 addresses | RFC 5737 TEST-NET ranges: `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` |

When documenting an API response, first sanitize it by replacing all real
identifiers with fictional equivalents before inserting it into a document.
Capture screenshots from an environment that contains only fictional data;
never attach a screenshot that shows real personal identifiers.

### Dependency Admission

A new dependency is added only after the repository owner's explicit
decision. A new dependency is a third-party component that a change would
declare, pin, install, or load for the first time: for example an npm
package, at run time or for development, including another package of a
family already in use; a container image; a GitHub Action; a tool that CI, a
Git hook, or a script runs; or an asset that the UI would load from a third
party. The packages that a dependency brings with it are part of its
footprint, not separate admissions. The same decision is needed before a
document under `docs/` prescribes a new dependency; naming one in a tracking
issue is not that decision.

No further decision is needed for the dependencies of the UI stack that
`docs/architecture.md` (Approved Dependencies) lists, for any other
dependency that a merged document under `docs/` prescribes, or for a
component that the repository already declares or pins. Updates, version
changes, and removals of declared dependencies are outside this rule;
Renovate and the normal review process handle them (`docs/deployment.md`,
Dependency Updates).

The request for the decision states:

- the current requirement that the dependency serves, not an anticipated one;
- why the web platform, the language, or an already declared dependency does
  not suffice;
- where it runs or ships: the browser, the released image, CI, or the tooling
  only;
- its maintenance: release activity, maintainers and governance, and whether
  its releases carry provenance attestations;
- its transitive footprint: the packages that it adds, and whether any of them
  has install scripts; and
- its license, and whether it allows that use, including redistribution when
  the dependency ships in the browser or the released image.

The pull request that adds the dependency records the justification and the
decision. The pull request that adds or removes a dependency of the UI stack
also adds or removes its Approved Dependencies entry; the entry only records
the admission, so it needs no separate documentation pull request
(Specification Ownership). When a dependency would change a choice that
`docs/architecture.md` records, such as using no form library, that choice
changes first, through a documentation pull request, and the dependency then
needs no further decision.

Three package manager exceptions require the same decision and
justification: allowing the install scripts of a dependency and installing a
version younger than the minimum release age other than through a
vulnerability-fix update, both exceptions to the package manager settings
(`docs/architecture.md`, Build Tool, Package Manager, and Node.js), and
overriding the version of a package that a dependency requires, which
`docs/deployment.md` (Dependency Updates) admits only for a vulnerability fix
outside the ranges that its dependents allow. The justification of an
override names the advisories that it fixes.

## Code Conventions

This section governs the UI's source code and its unit and component tests,
under `src/`, and its end-to-end tests, under `test/e2e/`. The technologies
come from `docs/architecture.md` (Technology Stack); what the UI does comes
from the foundation and screen documents, and what the API does from
Sentinel's contract. The tools that Checks lists enforce part of these
rules; review enforces the rest.

### Directory Structure and Naming

| Path | Contents |
|---|---|
| `src/main.tsx` | The entry point: global configuration, then the mounting of the application |
| `src/zod.ts` | Zod's global configuration, which `src/main.tsx` imports first |
| `src/styles.css` | The stylesheet: the Tailwind CSS entry point, with the tokens, the themes, and the font of `docs/design-system.md` |
| `src/preferences.ts` | The preferences of the browser in the origin's local storage (`docs/behaviors.md`, Preferences): how a stored value reads and changes in every open tab, and the preference of the sidebar |
| `src/theme.ts` | The theme preference (`docs/behaviors.md`, Preferences): how a stored value reads, and the theme that the page shows while it runs |
| `src/theme-script.ts` | The script that the entry document runs in its head, which applies the stored theme before the page renders: a classic script, so it imports and exports nothing |
| `src/favicon.svg` | The favicon, which the entry document links: the Sentinel mark in its own colors (`docs/design-system.md`, Sentinel Mark) |
| `src/app.tsx` | The providers that every screen shares |
| `src/query-client.ts` | The query client, with the defaults of every read and change (`docs/behaviors.md`, Retries and Unconfirmed Changes; Loading) |
| `src/session.ts` | What the UI keeps of the session in the origin's browser storage: the session record, and the saved URL with its check, both forgotten after a sign-out (`docs/behaviors.md`, Return After Sign-in; Session Expiration Message; Sign-out) |
| `src/session-gate.tsx` | What the root route shows before and around every screen as the session requires: the read of the signed-in user, Sign in after a `401`, the read after a `403`, another user, the return from Sign in, and Sign out (`docs/behaviors.md`, Session); and the signed-in user for the screens that depend on it, with the role that decides the landing (`docs/screen-map.md`, Landing; Roles) |
| `src/avatar.ts` | The pattern and the color of the avatar (`docs/design-system.md`, Avatar, Definition, Version 1): the SHA-256 digest of a user's `id`, and the cells and the index of the color in the Palette that it selects |
| `src/router.ts` | The route tree and the router, with what every route shows when its screen does not apply: Not found and the page of a failure of the UI itself |
| `src/search-params.ts` | How the router reads and writes the search parameters of a URL, as text (Routes), and the schemas of the parameters whose value is a whole number or a list |
| `src/routes/` | One module per route: its definition and its page component |
| `src/routes/unbuilt.ts` | The routes of the screens of `docs/screen-map.md` (Areas and Screens) to which the sidebar, the account menu, and the screens lead before those screens are built: each shows Not found, and the change that builds a screen replaces its route |
| `src/components/` | The components that several routes share |
| `src/api/` | The shared request function (`request.ts`), and the mapping of error codes to messages and of field errors to the fields of a form (`errors.ts`) |
| `src/api/generated/` | The API client that Orval generates from the pinned OpenAPI document (API Access) |
| `src/test-api.ts` | What several unit and component tests share: fictional responses of the API, which replace the browser's `fetch` beneath the shared request function (Tests) |
| `src/test-screenshot.ts` | What several component tests share: the colors of the pixels of a screenshot of an element, such as a mark that is hidden from assistive technologies (Tests) |
| `src/test-setup.ts` | The setup that Vitest runs in the document of every unit and component test file before its tests: it gives that document the focus, which Playwright's Firefox does not reliably move into it |
| `src/no-node-types.ts` | A module that nothing imports: the check that the UI's program has no types of Node.js (Checks) |
| `test/e2e/` | The end-to-end tests, those of how the UI is served included, and their shared fixture, `fixtures.ts` (End-to-End Tests), and the configuration of the reverse proxy in front of the UI and the API, `proxy.conf` (`docs/architecture.md`, Development Environment) |
| `test/e2e/screenshots/` | The reference screenshots of the end-to-end tests (End-to-End Tests) |

A path of this table that does not exist yet is created by the first change
that needs it; content of another kind needs a new row first.

- File and directory names are kebab-case, such as `ticket-list.tsx`. A
  module that contains JSX ends in `.tsx`, any other in `.ts`.
- Components are named in PascalCase, hooks start with `use`, and other
  functions and variables are named in camelCase.
- Modules use named exports. A tool configuration file that requires a
  default export, such as `vite.config.ts`, is the only exception.

### Routes

- Routes are defined in code with TanStack Router's route functions, without
  a route generator (`docs/architecture.md`, Routing, Server State, and
  Forms). Each route module exports its route, and `src/router.ts` assembles
  the route tree.
- The state that a screen keeps in its URL, such as filters, sorting, and
  pagination, lives in the route's path and search parameters. A Zod schema
  in the route definition validates the search parameters, and the screen
  reads them through the router's typed hooks.
- The router reads and writes the search parameters as the browser's
  `URLSearchParams` do, never as JSON (`src/search-params.ts`): each value is
  its text, such as `page=2` or `search=42`, and a parameter with several
  values is given once for each, such as `status=new&status=analysis`, as
  Sentinel's repeatable filters are (Sentinel `docs/api-spec.md`, Enum Filter
  Validation). A schema therefore reads a number or a list from that text.
- The schema gives each search parameter `.catch(undefined)`, so that a
  value that the screen does not accept counts as absent; a parameter whose
  rejection also removes another one, such as a sorting with its order,
  catches it as `null`, which the schema's transform removes with the other.
  When the URL carries a parameter or a value that the schema does not
  accept, or a value in another form than the one that the schema gives, such
  as a search term with surrounding whitespace, the route's `beforeLoad`
  redirects to the parameters that the schema gives, replacing the URL
  (`docs/behaviors.md`, Invalid Search Parameters). The router's search of a
  route also passes on the parameters of the URL that its schema does not
  declare, and gives every value as text, so `beforeLoad` compares the URL
  with the schema's own result as the URLs that they give, whichever
  parameter comes first. A parameter that the screen accepts only for some
  users, such as a view that a role decides, is removed by the screen in the
  same way, once it knows the user.
- Links between the UI's screens use the router's typed paths: React Aria's
  links, and the components that contain links, navigate through the router,
  which the root route connects to React Aria. A link with path or search
  parameters takes as its address the options that the router's
  `linkOptions` checks against the route tree, such as
  `linkOptions({ to: "/tickets/$ticketId", params: { ticketId } })`: the
  type check rejects a path, a parameter, or a value that the route does not
  declare, the router encodes the parameters, and the link shows the address
  that it leads to. No code interpolates a value into the path of a link.
  A link to an address that the API returns, or to an address of another
  site that the UI composes from a value of the API, follows Links from the
  API instead.

### API Access

- The UI calls Sentinel's API only through the client that Orval generates
  from the pinned OpenAPI document: its request functions and TanStack Query
  hooks (`docs/architecture.md`, Backend Contract and API Client Generation).
  No other module under `src/` calls `fetch` or `XMLHttpRequest` or builds an
  API URL.
- Every request goes through the query client, as a read of a hook or of
  `fetchQuery`, or as a change: a generated request function is called
  directly only inside a query or mutation function. The UI learns of every
  response there, so that a behavior that applies to a response of any
  operation, such as the end of the session after a `401`, reaches every
  request (Error Codes and Messages).
- The generated code is never edited by hand, and its types are the API
  types: no module declares an API type itself. A change comes from the
  pinned OpenAPI document, from the generator's configuration,
  `orval.config.ts`, or from the generator's version, after which
  `scripts/tooling.sh generate` regenerates the client; CI fails when the
  committed client differs (`docs/deployment.md`, Workflow Inventory).
- Every generated request goes through one shared request function. It uses
  origin-relative URLs under `/api/v1/` and the browser's default same-origin
  credentials, and it turns every error response into an error that carries
  the HTTP status and, when the response provides one, Sentinel's `code`
  (`docs/architecture.md`, API Client Generation; Sentinel
  `docs/api-spec.md`, Response Format).
- A request sends only the query parameters and request body members that
  the contract of the pinned version declares for the operation: a later
  Sentinel release within the supported Sentinel versions can declare
  another one and reject its invalid values (Sentinel `docs/api-spec.md`,
  Undeclared Query Parameters; Client Tolerance of Non-Breaking Changes). The
  generated request functions type them, except the keys of a member that the
  pinned OpenAPI document leaves open, such as `custom_settings` of
  `PATCH /api/v1/fetchers/{fetcher_name}/config`, whose keys Sentinel's
  contract declares (Sentinel
  `docs/features/platform/fetcher-infrastructure.md`, Custom Settings
  Schema). No code passes to a generated request function an object that
  also carries other members, such as the state of a form.

### Data Read from the API

- Data read from the API lives only in TanStack Query's cache, read through
  the generated hooks. Components do not copy it into their state, a context,
  a module variable, or browser storage.
- After a change, whether it succeeds or fails, the code invalidates the
  queries whose data the change affects, so that they are read again from the
  API, instead of editing the cached data (`docs/behaviors.md`, Outcome of a
  Change).
- Form input lives in React state until it is submitted
  (`docs/architecture.md`, Routing, Server State, and Forms).
- A later Sentinel release within the supported Sentinel versions can return
  a field, or a value of a response enum, that the contract of the pinned
  version does not list (Sentinel `docs/api-spec.md`, Versioning; Response
  Enums). Code ignores a field of a response that the contract of the pinned
  version does not list, also where it iterates over the fields of a
  response, and no validation of a response at run time rejects a field or a
  value that the pinned OpenAPI document does not list (Sentinel
  `docs/api-spec.md`, Client Tolerance of Non-Breaking Changes).
- Code that maps a value of a response enum, for example to a label, an
  icon, or a color, or that branches on it, gives every value that the
  contract of the pinned version does not list a default instead of failing,
  and no exhaustiveness check over such a value throws at run time.
  `docs/behaviors.md` (Unknown Values) defines the presentation of that
  default, as it defines the default error presentation (Error Codes and
  Messages).

### Error Codes and Messages

- Code decides on an error by its `code`, never by `detail`, which may
  change without notice (Sentinel `docs/api-spec.md`, Response Format). An
  error without `code`, such as a response produced before the request
  reaches Sentinel, is treated like an error with an unknown code.
- One module in `src/api/` maps error codes to the messages that the UI
  shows. A screen handles specifically only the codes that its screen
  document lists (Specification Writing, Screen Documents); every other code
  gets the default presentation that `docs/behaviors.md` (Errors) defines:
  the one of its HTTP status, except for the few codes that it names. That
  document also defines the wording of the messages and where they appear.
- A later Sentinel release within the supported Sentinel versions can answer
  an operation with a status or a code that the contract of the pinned
  version does not list for it, such as the error response of a new
  condition (Sentinel `docs/api-spec.md`, Error Responses). Code handles it
  like every other code that its screen does not handle specifically, by its
  HTTP status, and never fails on it or rejects it because the pinned OpenAPI
  document lacks that status or code for the operation (Sentinel
  `docs/api-spec.md`, Client Tolerance of Non-Breaking Changes).
- No code relies on `500 INTERNAL_ERROR` for a condition, or on which of two
  conditions an error response reports where Sentinel's contract does not
  state their precedence (Sentinel `docs/api-spec.md`, Client Tolerance of
  Non-Breaking Changes).
- The field errors of a `VALIDATION_ERROR` response are matched to the form
  fields by their `loc` (Sentinel `docs/api-spec.md`, Response Format).
- A behavior that applies to a response of any operation, such as the end of
  the session after a `401` (`docs/behaviors.md`, Session State; Sentinel
  `docs/features/identity/authentication.md`, Frontend session behavior), is
  implemented once, for every request, never by each screen.

### Components and Styling

- Components are functions. Interactive elements, such as buttons, links,
  form fields, menus, dialogs, and tables, are built from React Aria
  Components (`docs/architecture.md`, Components and Styling), never from
  native elements with hand-written behavior or ARIA attributes.
- `src/components/` holds the components that several routes share. A React
  Aria component is styled once, in the shared component that wraps it, and
  routes use that component.
- Styling uses the Tailwind CSS utility classes of the tokens that
  `docs/design-system.md` defines, which replace Tailwind's default colors
  and type sizes. `src/styles.css`, which holds the tokens, is the only
  stylesheet of the page besides the one that React Aria inserts
  (`docs/architecture.md`, Security Headers).
- The themes are in the tokens (`docs/design-system.md`, Themes):
  `src/styles.css` gives each color token its value in each theme, and a
  screen or a component uses the same classes in both themes, so that it is
  correct in both as built. None of its classes applies to one theme alone,
  with the `dark:` variant or in any other way, or sets the color scheme of
  its element, which would show the element in one theme alone.
- A color or a type size is set only by the class of its token, such as
  `text-fg-muted`, `stroke-danger-icon`, or `text-14`: not by an arbitrary
  value or property of Tailwind, such as `text-[#9A6700]`, `bg-(--accent)`,
  or `[color:#FFFFFF]`; not by a modifier of a class, such as the opacity of
  `text-fg/70`; and not by a `style` attribute. An SVG element or an icon
  takes its colors and type size from classes, such as `fill-none` and
  `stroke-current`, never from an attribute or a prop, such as `fill`,
  `stroke`, `color`, or `fontSize`. The favicon, whose colors are its own, is
  the exception (`docs/design-system.md`, Sentinel Mark). Checks states what
  the lint and the design token check reject.
- A component declares the type of its props in its own module.

### No Raw HTML Injection

- Text from the API, including what Sentinel takes from external sources,
  such as CVE descriptions, is rendered as React text, which React escapes.
- No code inserts HTML: no `dangerouslySetInnerHTML`, and no `innerHTML`,
  `outerHTML`, `insertAdjacentHTML`, or `document.write`. No code evaluates a
  string: no `eval`, `new Function`, or string passed to `setTimeout` or
  `setInterval`.
- Lint rejects `dangerouslySetInnerHTML` and evaluated code, and in
  production the Content Security Policy with Trusted Types blocks the
  injection of HTML into the page (`docs/architecture.md`, Security Headers).
  Neither replaces this rule.

### Links from the API

- A link to an address that the API returns, or to an address of another
  site that the UI composes from a value of the API (`docs/behaviors.md`,
  Links to Other Sites), is built only by one shared component, which
  applies that section: the check of the address, the mark of a link to
  another site, and the loading of the address by the browser rather than by
  the router. The link leads to, and where its text is the address shows,
  the URL that the check parsed, never the value as received, so that the
  check and the browser read the same address. A composed address takes the
  fixed origin that its screen document states, and holds the value of the
  API, or the part of it that the screen document names, only encoded,
  within a path segment or as the value of a query parameter. No other code
  passes a value of the API as the address of a link or of a navigation,
  such as an `href`, `window.location`, or `window.open`.
- No code looks for addresses inside a text of the API to turn them into
  links (`docs/behaviors.md`, Links to Other Sites).
- The Content Security Policy blocks an address with the scheme `javascript`
  (`docs/architecture.md`, Security Headers), but not the other schemes, and
  does not replace this rule.

### Tests

- A unit or component test sits next to the module that it tests, as
  `<module>.test.ts` or `<module>.test.tsx`, and runs in Vitest's browser
  mode in Chromium and Firefox (`docs/architecture.md`, Static Checks and
  Tests).
- Tests find elements as users do: by role and accessible name, or by
  visible text, never by CSS class or document structure.
- Component tests replace the shared request function, or the browser's
  `fetch` beneath it, with prepared responses and make no network request.
- A test checks the outcome of the behavior that it covers, as a user or a
  caller observes it, so that it fails when the behavior breaks. A test that
  runs code without checking its outcome proves nothing, and the minimum
  coverage (Checks) never justifies one.
- Each unit or component test that a change adds, or whose assertions it
  changes, is seen to fail when the behavior that it checks breaks: the
  author breaks that behavior in the code, or for a fix restores the defect,
  runs the test, sees it fail because of the break, and restores the code.
  The pull request records the break and the failure of each such test with
  its test evidence (Pull Request Requirements).
- The tests of code that maps or branches on a value of a response enum, or
  that handles an error code or status specifically, also cover a value of
  that enum, or an error code and a status, that the contract of the pinned
  version does not list (Data Read from the API; Error Codes and Messages).
- Test data is fictional (Example Data in Documentation).

### End-to-End Tests

- The end-to-end tests run with Playwright, in Chromium and Firefox, against
  the UI's production image and a Sentinel backend loaded with the example
  dataset (`docs/architecture.md`, Static Checks and Tests; Development
  Environment). `scripts/dev-env.sh e2e` runs them. A test module is
  `test/e2e/<subject>.spec.ts`, named after the screen or area that it
  covers.
- Two modules check how the UI is served (`docs/architecture.md`, Hosting
  Constraints; Packaging and Serving; Security Headers):
  `same-origin.spec.ts`, the same origin of the UI and the API, and
  `image.spec.ts`, the responses of the UI's image. The projects named after
  the browsers run every module but `image.spec.ts` against the end-to-end
  environment, and two more projects run these modules in Chromium:
  `dev-server` runs `same-origin.spec.ts` against the development server and
  a backend of its own (`scripts/dev-env.sh test`), and `image` runs
  `image.spec.ts` against a container of the UI's image alone
  (`scripts/image.sh test`). Those scripts check themselves what only Docker
  shows, such as the published ports, the user and the content of the
  image, its processes, and its access log (`docs/deployment.md`, Workflow
  Inventory).
- Every test imports `test` and `expect` from `test/e2e/fixtures.ts`, whose
  fixture fails it on any Content Security Policy violation, on any uncaught
  exception of a page, and on any violation of the WCAG 2.2 A and AA rules of
  axe-core in its final state. A test checks every further state that it
  shows, such as an open dialog or a field error, with `expectAccessible`.
  The fixture and `expectAccessible` check each state under the light and
  under the dark color scheme of the browser, which show the light and the
  dark theme unless the user chooses one (`docs/behaviors.md`, Preferences),
  and then return the page to its own color scheme, so that the test
  continues, and takes its screenshots, in the theme that it shows. No test
  turns a check off, excludes an element or a rule from it, or changes the
  policy.
- Tests find elements as users do (Tests), and sign in as a user of the
  dataset, with its published password (Sentinel
  `docs/features/platform/example-dataset.md`, Credentials).
- Each browser runs the tests one at a time against its own backend, newly
  loaded with the dataset (`docs/architecture.md`, Development Environment).
  A test relies only on the dataset as loaded and on the data that it
  creates itself, which it finds by what it created, not by a count or a
  position that another test could change. A test that changes data changes
  only data that no other test of its Playwright project relies on (the
  tests that take references run in an earlier project, below); a failed
  sign-in counts toward the lockout of its user (Sentinel
  `docs/features/identity/local-authentication.md`, Account lockout), so it
  uses a user that no other test signs in as.
- A test may send requests to the API itself, for example to check the
  environment or to create the data that it uses.
- A screenshot is a reference in `test/e2e/screenshots/`, taken in Chromium,
  whose default light color scheme shows the light theme, at the viewport of
  the tests, where the sidebar is expanded by default (`docs/behaviors.md`,
  Preferences), and named after the screen and the state that it shows, never
  after the test: `<screen>.png` for the main state of a screen and
  `<screen>-<state>.png` for each other state that it shows, such as
  `ticket-list-empty.png`.
  Transient states, such as loading, and states that a dataset backend
  cannot produce, such as one that needs an external source (Sentinel
  `docs/features/platform/example-dataset.md`, Operating a Dataset Backend),
  have none, and neither has the dark theme. A region that changes from one
  run to the next, such as a date that the dataset computes from the instant
  of its load (Sentinel `docs/features/platform/example-dataset.md`, Time
  Base) or the avatar of a user, whose `id` the dataset does not fix (same
  document, Users), is masked.
- A test that changes no data that a screen shows takes the references of
  the dataset as loaded; its own sign-in, which changes only the sessions and
  the time of last sign-in of its user, is not such a change. It runs before
  every test of its browser that changes such data: the project named after
  the browser, which `scripts/dev-env.sh e2e` selects, holds the tests that
  change such data and depends on a project of the other tests. A test that
  changes such data takes the reference of the state that its own change
  produces, such as the result of an action, showing only data that no other
  test of its project changes.
- A change that alters what a screen shows regenerates its references with
  `scripts/dev-env.sh update-screenshots`, which writes those that are new or
  differ, and removes in the same change the references that no test takes
  any more.

### Checks

- Every change passes the type check (the TypeScript compiler in strict mode,
  `tsconfig.json`), the lint (Oxlint, `.oxlintrc.json`), the format check
  (Prettier, on the paths that `.prettierignore` leaves in scope), and the
  unit and component tests. CI runs them as required checks
  (`docs/deployment.md`, Workflow Inventory).
- The type check covers the two programs that `tsconfig.json` references
  and whose settings it holds: the UI and its unit and component tests,
  which run in the browser (`tsconfig.app.json`), and the code that runs in
  Node.js, the end-to-end tests and the configuration of the tools
  (`tsconfig.node.json`). Only the latter has the types of Node.js, so the
  type check rejects a global or a module of Node.js, such as `process`,
  `Buffer`, or `node:fs`, in the UI. `src/no-node-types.ts` expects the
  errors of `process` and `Buffer`, so the type check also fails when a
  dependency brings the types of Node.js into the UI's program.
- Like every Node.js command, they run through `scripts/tooling.sh`
  (`docs/architecture.md`, Development Environment), never on the host; the
  `check` script of `package.json` runs all four.
- The unit and component tests measure their coverage with Istanbul
  (`docs/architecture.md`, Static Checks and Tests) and fail when the
  statements, the branches, the functions, or the lines that they run fall
  below 95 % of those of the measured files together: the modules under
  `src/` other than the generated API client, whose requests are tested
  through the shared request function, and other than the setup of the
  tests, `src/test-setup.ts`, which Vitest never measures. The
  `test:coverage` script of `package.json`, which `check` and `scripts/ci.sh`
  run, applies the minimum. It applies to every measured module, so a module
  that the tests do not load counts as not covered; a run of the tests of
  some modules therefore uses the `test` script, which measures no coverage.
- The minimum coverage is a floor, not a target: it catches code that no test
  runs, while the tests are judged by the behavior that they check (Tests).
  The margin below 100 % is not room for untested behavior: a change still
  tests every behavior that it adds or alters. No comment, such as
  `istanbul ignore`, hides a line, a branch, or a function from the
  measurement. The measured files, which an exclusion changes, change only
  with the repository owner's decision and never to reach the minimum; the
  minimum changes only with that decision. The pull request that changes
  either records the decision.
- Every change also passes the design token check, which
  `scripts/ci.sh ui-checks` runs after the lint, in the required `UI Checks`
  job and in `scripts/ci.sh all` (`docs/deployment.md`, Workflow Inventory).
  In the modules under `src/` other than the generated API client, it
  rejects the classes that set a color or a type size with an arbitrary
  value or property of Tailwind or with a modifier, the classes that apply
  to one theme alone with `dark:`, with an arbitrary variant of
  `prefers-color-scheme`, or with a variant of the attribute with which the
  root element marks the theme that the user chose, and the classes that
  set the color scheme of an element (Components and Styling). Tailwind CSS
  finds its classes in the text of those files, comments included, and so
  does the check. A change that adds another way for a class to apply to one
  theme alone, such as another selector that marks the theme of the page,
  also extends the check, so that it rejects those classes too. The lint
  rejects the `style` attribute and the attributes and props of colors and
  type sizes, such as `fill`, on elements and components alike. For a `style`
  attribute that sets neither a color nor a type size, the rule is disabled
  inline as a false positive (below).
- Every change also passes the end-to-end tests, which CI runs as a required
  check too (`docs/deployment.md`, Workflow Inventory) and
  `scripts/dev-env.sh e2e` runs locally.
- Before pushing, run `scripts/ci.sh all`: it runs locally every check of the
  required `Shell Lint`, `UI Checks`, and `End-to-End Tests` jobs, as CI runs
  them (`docs/deployment.md`, Workflow Inventory, Local run).
- Code uses no `any`. A lint rule is disabled only inline, for the smallest
  span, with a comment that explains why the finding is a false positive or
  an accepted trade-off. The generated API client is the only exception: it
  cannot carry such comments, so `.oxlintrc.json` disables for it, with a
  comment, only the rules that report patterns of its generator.

## Shell Scripting

This section governs the repository's tooling: the structure of its scripts,
Git hooks, and workflows, in any language (Tooling Structure), and the rules
of its shell code, in standalone scripts, Git hooks, and CI workflows. Shell
in this repository is limited to repository orchestration and developer or CI
tooling; application logic is never written in shell.

### Tooling Structure

These rules keep each concern of the tooling in one place, so that a change of
the tooling edits one script and the documents that state what it guarantees.
`docs/architecture.md` (Tooling Language) records the decision behind the
first rule.

- **Language**: the tooling is written in bash: the scripts and their
  libraries, which run on the host, and the Git hooks, together with the
  processing that their work needs, such as reading JSON or matching regular
  expressions. The checks of the HTTP responses of what a script starts, the
  UI's image and the environments of `scripts/dev-env.sh`, are the one
  exception: they are written in TypeScript, as Playwright tests in
  `test/e2e/` (Code Conventions, End-to-End Tests), which that script runs in
  the tooling container (`docs/architecture.md`, Development Environment);
  it keeps the checks that need Docker. Any other language or runtime is a
  new dependency (Dependency Admission)
- **Owning scripts**: each concern has one owning script under `scripts/`,
  and a new capability of a concern becomes a command of its owner, never a
  new script or a copy:

  | Concern | Owning script |
  |---|---|
  | The tooling containers, which run every Node.js command | `scripts/tooling.sh` |
  | The environments: the local backend, the end-to-end environments, and the local preview | `scripts/dev-env.sh` |
  | The image that serves the UI in production: its build, test, SBOM, scan, push, and pull | `scripts/image.sh` |
  | The publication of a release: its checks and its GitHub Release | `scripts/release.sh` |
  | The Sentinel contract: the pinned OpenAPI document and image digest | `scripts/sentinel-contract.sh` |
  | The checks of the `UI Checks` and `End-to-End Tests` jobs, and the local run of the checks of CI | `scripts/ci.sh` |
  | One task of a workflow or a Git hook that no other concern covers | A single-purpose script, without commands, such as `scripts/lint-shell.sh` or `scripts/check-pr-metadata.sh` |

  A new script is added only for such a single-purpose task, or for a new
  concern, which first gets its row in this table
- **Shared code**: a function, validation, or constant that several scripts
  or hooks need lives in a library under `scripts/lib/` (Naming and
  Structure), which they source; it is never copied. A value that a file of
  another tool also holds and that cannot source the library, such as the
  port of the development server in `vite.config.ts`, is repeated, with a
  comment beside the copy in the script that names the file to keep in sync
  with
- **Documentation of commands**: each command is documented once, in the
  header comment of its script: its syntax — its arguments, its options, and
  the environment variables that configure it — and what it does. A script
  with commands prints its header with its `help` command. `CONTRIBUTING.md`
  says which command serves which task of a contributor and names it by its
  script and command only, such as `scripts/dev-env.sh start`, without its
  arguments or options; it keeps what a contributor needs around the command,
  such as its setup, how to use its result, and its security cautions. The
  documents under `docs/` state the guarantees of the tooling and name the
  command that provides each, never its syntax; a procedure may show the
  arguments that a command passes on to another tool, such as npm

### Scope

The rules of the shell code apply to:

- Standalone scripts under `scripts/`, and the libraries under `scripts/lib/`
  that they source
- Git hooks under `.githooks/`
- Shell embedded in `run:` steps of `.github/workflows/*.yml`

### Interpreter and Safety

- **Shebang**: `#!/usr/bin/env bash`. Scripts target Bash and use Bash
  features (`[[ ]]`, `BASH_SOURCE`, arrays); POSIX `sh` is not assumed
- **Strict mode**: every script MUST start with `set -euo pipefail`
  immediately after the shebang/header comment, so failures, unset
  variables, and broken pipes abort the script instead of propagating
  silently. A library does not set it: it runs under the strict mode of the
  script that sources it (Naming and Structure)
- **Quoting**: quote all variable expansions (`"${var}"`). The only
  accepted exception is an intentional word-split of an assembled command
  string, which MUST carry a narrowly-scoped, justified
  `# shellcheck disable=SC2086` directive
- **Diagnostics and exit codes**: write error and warning messages to
  stderr; reserve stdout for results. Return a non-zero exit code on
  failure and propagate the exit code of the meaningful inner command
  when the script is a wrapper

### Static Analysis — shellcheck

All shell scripts MUST pass `shellcheck` with no findings.

- Suppressions MUST be **inline**, **narrowly scoped** (a single check
  ID, applied to the smallest possible span — a command or a function),
  and **justified** with a trailing comment explaining why the finding is
  a false positive or an accepted trade-off. Example:

  ```bash
  # shellcheck disable=SC2317  # body is reachable: invoked indirectly via 'trap teardown EXIT'
  teardown() {
      ...
  }
  ```

- Blanket, file-level, or unexplained disables are not allowed. A
  repository-wide `.shellcheckrc` MUST NOT be used to hide findings
  globally

### Formatting — shfmt

All shell scripts MUST be formatted with `shfmt`, which takes its settings
from `.editorconfig`: 4-space indentation and indented switch cases.
`scripts/lint-shell.sh` verifies it (Enforcement) and changes no file: for a
file that is not formatted, it prints the diff that formats it, which is the
change to apply. shfmt ignores `.editorconfig` when it receives a formatting
flag, such as `-i`, so it runs without one.

### Workflow Shell — actionlint

Shell embedded in GitHub Actions `run:` steps is validated by
`actionlint`, which checks workflow syntax and runs the `shellcheck` of its
image on each `run:` block. Keep embedded shell short; when a `run:` block
grows beyond simple orchestration, extract it into a script under `scripts/`,
a command of the script that owns its concern or a single-purpose script
(Tooling Structure), which is then covered by the standalone `shellcheck` and
`shfmt` rules, and invoke that script from the workflow.

### Naming and Structure

- **Files**: `kebab-case.sh` for standalone scripts and libraries. Git hooks
  use the fixed names Git requires (`pre-commit`, `commit-msg`, `pre-push`)
  with no extension
- **Functions**: `snake_case`; **constants/globals**: `UPPER_SNAKE_CASE`
- Provide a header comment describing the script's purpose and its usage,
  with each of its commands, the only documentation of their syntax (Tooling
  Structure), and route subcommand dispatch through a `main` function
- **Libraries**: a library under `scripts/lib/` holds functions and constants
  that several scripts and hooks share, which source it after their strict
  mode. It has the shebang and a header comment that describes its purpose,
  but no `set` command and no `main`: sourcing it only defines its functions
  and constants. A script names it in a
  `# shellcheck source=<path from the repository root>` directive, and
  shellcheck follows it (`--external-sources`)
- **English only** (`AGENTS.md`, Stop conditions before retained work) applies
  to all comments and messages

### File Placement

- `scripts/` — repository-level orchestration and developer or CI tooling
- `scripts/lib/` — the libraries that the scripts and hooks source
- `.githooks/` — Git hooks (activation covered in `docs/deployment.md`, Local
  Git Hooks)

See the placement table in `AGENTS.md` (Stop conditions before retained work)
for the authoritative mapping.

### Enforcement

- **CI**: the `Shell Lint` job of `.github/workflows/ci.yml` is the
  authoritative gate. It runs `scripts/lint-shell.sh`, which discovers every
  tracked `*.sh` file and every file under `.githooks/` with `git ls-files`,
  so new scripts, libraries, and hooks are covered automatically, runs
  `shellcheck` and `shfmt` on them, and runs `actionlint` on the workflows.
  The script runs each tool from its official image, pinned by version and
  digest (`docs/deployment.md`, Workflow Conventions), through Docker Engine,
  in a container without network that reads the repository only, so the
  tools run the same way in CI and locally
- **Pre-commit hook**: `.githooks/pre-commit` runs `scripts/lint-shell.sh`
  on the staged files, the same checks, selected in the same way, as a fast
  local safety net, which warns instead of failing when Docker Engine cannot
  run the images (`docs/deployment.md`, Local Git Hooks)

## Git Conventions

### Workflow

Sentinel Aura uses GitHub Flow: `master` is always the stable branch. All
changes are developed on short-lived topic branches and merged via pull
request.

**Branch lifecycle**: create from `origin/master`, push regularly, open
a draft PR early, mark ready when implementation, verification evidence,
and applicable reviewer work are complete, squash-merge after approval,
branch auto-deleted.

#### Issues and work units

GitHub Issues are the canonical work item for every substantive,
human-directed repository change — including work an automation agent
performs on a person's request. Specifications, issues, pull requests, and
Projects each own a distinct concern:

| Owner | Owns |
|---|---|
| Foundation and screen documents (`docs/`) | UI behavioral and structural contracts |
| Sentinel's specifications | Backend behavior, the API contract, and client obligations |
| Issues | The problem or outcome, bounded scope, acceptance criteria, owning-specification links, direct blockers |
| Pull requests | Implementation evidence: tests, screenshots, manual verification, reviewer results, risks |
| Projects | Optional, initiative-scoped presentation of live status — never an additional completion gate |

Before creating a topic branch, search open issues in this repository.
Reuse a suitable issue only when all of the following hold: its outcome,
scope, acceptance criteria, and owning specifications cover the requested
change; it is a concrete work item and not a phase/initiative/parent issue;
it has no active linked branch or pull request; and its direct blockers are
resolved. Otherwise create a new issue with the sections Outcome or problem,
Owning specifications, Scope, Acceptance criteria, Verification, and Direct
blockers, which the Work item issue form provides — no separate approval is
needed merely to create the tracking object. The acceptance criteria of a UI
feature are agreed with the repository owner before implementation starts;
they replace a separate specification pull request (Specification Writing,
Screen Documents).

A capability that the UI needs and Sentinel's API lacks is never tracked as
implementation work here: it becomes an issue in `vulnwatch/sentinel`
(`AGENTS.md`, Sentinel as an External Authority), and the issue in this
repository that depends on it declares it as a direct blocker.

**Blocker linkage**: when an issue has direct blockers, declare them both
in the issue's "Direct blockers" section and via GitHub's native
`blocked_by` issue relationship (UI "Add blocked by" command, or the
GraphQL `addBlockedBy` mutation). The free-text section keeps the blocker
readable without leaving the issue body; the native relationship links
both issues bidirectionally, surfaces in each issue's sidebar, and warns
against closing an issue while an open blocker remains.

**Exemptions** — an issue is not required for:

- a pull request generated and maintained exclusively by Renovate or
  release-please (human-directed scope added to such a PR removes the
  exemption; a maintainer's commit that only regenerates files from the
  updated dependency, as `docs/deployment.md` (Dependency Updates)
  prescribes, adds none);
- pure exploration that creates no retained branch, commit, PR, or
  tracked-file change; or
- a genuinely cosmetic change limited to spelling, punctuation,
  whitespace, comments, or formatting, with no change to behavior,
  requirements, identifiers, commands, paths, or configuration.

When uncertain, create an issue.

**Single active branch**: develop one dependent work unit at a time.
Multiple branches may exist for genuinely independent concerns (for example,
a dependency update and a UI feature), but dependent work is not stacked
across unmerged branches.

**Work unit boundary**: the normal implementation unit is one tracking
issue, one topic branch created from the current `origin/master`, and one
squash-merged pull request. A milestone or roadmap phase groups multiple
work units; it is never itself a long-lived implementation branch. Start
a dependent work unit only after every direct blocker PR has merged, then
branch from the updated `origin/master`.

**Issue linkage**: every non-exempt pull request uses `Closes #<issue>` in
its body so merge completion closes the tracking issue. Exempt
human-authored PRs declare `N/A - <specific reason>` instead; approved
automated PRs (Renovate, release-please) are exempt entirely. Pull Request
Requirements defines the accepted formats. If a gap in the foundation
documents blocks implementation, resolve it in a separate documentation
issue, branch, and merged PR before creating or resuming the implementation
branch — unless the combined-PR exception in `AGENTS.md` (GitHub and release
workflow) applies.

**No direct pushes to `master`**: all changes arrive via squash merge
of a reviewed PR. The pre-push hook enforces this locally; server-side, the
`master` branch protection requires a pull request with passing required
status checks (`docs/deployment.md`, Workflow Inventory) and applies to
administrators as well.

**No force pushes**: never rewrite published branch history.

**No manual tags**: tags are created exclusively by release-please. The
pre-push hook blocks tag pushes locally.

**Squash merge**: the only allowed merge method. The PR title becomes
the commit message on `master`, except where `docs/deployment.md` requires
a Renovate pull request to land with a `fix(deps):` subject. Renovate
restores the title that it generates whenever it updates its pull request,
so a renamed title may not last until the merge: the maintainer sets the
subject when squash-merging instead, in GitHub's merge dialog or with
`gh pr merge <number> --squash --subject "fix(deps): <description> (#<number>)"`.
The subject is a valid PR title (Pull Request Requirements) followed by the
`(#<number>)` suffix that GitHub adds to the default subject. The
`PR Metadata` check validates the title, not the subject, so the maintainer
checks the subject before confirming the merge. A maintainer's own pull
request carries `fix(deps):` in its title instead.

**Branch deletion**: branches are deleted automatically after merge.

### Pull Request Requirements

- **Title**: Conventional Commits format (Commit Messages), under 72
  characters.
- **Description**: at minimum: issue linkage, owning documents (foundation
  and screen documents of this repository and the Sentinel specifications
  relied on), scope summary, test evidence, with the failures of the unit and
  component tests that it adds or whose assertions it changes (Code
  Conventions, Tests), the reference screenshots that it changes when
  required, delegated decisions, new dependencies, reviewer results, manual
  verification notes. The pull request template provides these sections.
- **Issue linkage**: `Closes #<issue>` for normal work, `N/A - <specific
  reason>` for an exempt human-authored PR under "Issues and work units"
  in Workflow. Use an `- Issue linkage:` field, or a standalone
  `Closes #<issue>` line anywhere in the body; when the body contains the
  field, the field holds the linkage. Approved automated PRs (Renovate,
  release-please) are exempt from this field.
- **PR Metadata check**: the required `PR Metadata` check validates the title
  and the issue linkage as defined above (`docs/deployment.md`, Workflow
  Inventory).
- **Screenshots**: a PR that changes what the UI shows adds or updates the
  reference screenshots of the affected screens (End-to-End Tests), which its
  diff shows, taken with the fictional example dataset (Example Data in
  Documentation), and updates the affected screen document with what was
  built; a change that only a state without a reference shows (End-to-End
  Tests) is described in the PR instead. The repository owner approves such a
  change by looking at the result, in the diff and, when useful, in a local
  preview of the PR (`scripts/dev-env.sh preview`; `docs/architecture.md`,
  Development Environment).
- **Delegated decisions**: record the interface details and other decisions
  taken under delegation (`AGENTS.md`, Delegated decisions), with the options
  considered and the choice.
- **New dependencies**: record each new dependency with its justification and
  the repository owner's decision (Dependency Admission).
- **Sentinel version**: a PR that changes the pinned Sentinel version
  shows the resulting API changes in its diff and states which screens they
  affect.
- **Manual verification**: record the exercised behavior and observed result.
  If no meaningful manual path exists, record `N/A` with a reason.
- **CI**: all checks must pass on the latest commit before merge is
  requested.
- **Reviewers**: applicable reviewer agents must be invoked and
  findings addressed (`AGENTS.md`, Reviewer Trigger Matrix).
- **Human approval**: the repository owner must explicitly authorize
  the merge by referencing the PR number.

### Issue and PR Body Formatting

Issue descriptions and pull request bodies are rendered as HTML by
GitHub's web UI, which wraps text to the viewport width automatically.
Do NOT hard-wrap lines in issue or PR bodies at a fixed column width
(72, 80, or any other limit) — let the browser handle wrapping. A
paragraph should be written as a single unwrapped line (or with one
sentence per line, if preferred for diff readability); it must not be
manually broken into fixed-width lines.

The 72-character hard-wrapping convention remains scoped to:

- The first line (subject) of commit messages — a Git convention
  respected by `git log`, terminal pagers, and `gh` output
- Files in the repository read in editors or terminals (source code,
  Markdown documentation, configuration), which follow standard prose
  wrapping for documentation and the line length of their own conventions
  for code

### Branch Naming

| Prefix | Use |
|--------|-----|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation changes |
| `refactor/` | Code refactoring |
| `chore/` | Infrastructure, configuration, dependencies |
| `ci/` | CI/CD pipeline changes |
| `test/` | Test-only changes |

### Commit Messages

- Use conventional commits format: `type: description`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`
- Use `!` only with `feat` or `fix` to signal a breaking change:
  `feat!: description`, `fix(scope)!: description`
- Keep the first line under 72 characters
- Use imperative mood: "add feature" not "added feature"
- The `commit-msg` hook validates the type, the breaking marker, and the
  length of the first line (`docs/deployment.md`, Local Git Hooks)
- Examples:
  - `feat: add CVE severity filtering to the ticket list`
  - `fix: show the session expiration notice after a 401 response`
  - `feat!: remove the legacy ticket export view`
  - `docs: describe the empty state of the CVE list`
  - `test: cover the login error messages`

### Versioning

The commit subjects on `master` carry the release signal used by
release-please, which owns versions and tags. Through squash merge they are
the PR titles, unless the maintainer sets the subject at merge (Workflow,
Squash merge):

| Commit type | Release signal |
|-------------|----------------|
| `fix` | Patch |
| `feat` | Minor |
| `fix!`, `feat!` | Breaking release; the resulting version depends on whether the project is pre-1.0 or stable |
| `docs`, `chore`, `ci`, `test`, `refactor` | No release on their own; `!` is not permitted |

The complete Semantic Versioning interpretation, changelog policy, and version
source of truth belong to the release process, `docs/deployment.md` (Release
Process, Versions).

## Specification Writing

### Specification Ownership

This repository specifies the UI: navigation, screens, presentation, and
client-side behavior. Its documents never define backend behavior, the API
contract, or an obligation that the contract places on clients; they
reference the owning Sentinel specification instead of restating it
(Sentinel Cross-references). Client-side behavior is specified only here: a
Sentinel specification that justifies a backend decision by what a client can
do through the API states rationale of the contract and prescribes no
presentation (`README.md`, Specification Boundary).

UI documents are of two kinds:

| Document | Owns | Changed by |
|---|---|---|
| Foundation documents | The UI as a whole: architecture, users, screen map, roles, cross-cutting behaviors, design system | A documentation pull request merged before the code that depends on it (specification first) |
| Screen documents | What one screen or area does, as built | The pull request that builds or changes the screen |

Both describe observable behavior and its constraints, not implementation:
they name no component, file, library API, or internal state unless that name
is itself part of the contract (for example, a URL that users can bookmark).
An architecture decision is such a contract for what it chooses: it names the
technologies, tools, and mechanisms that it selects and the files that carry
them. So is a choice of the design system, such as its font, its icon set,
and its Tailwind CSS tokens.

### Foundation Documents

The UI foundations are written once, before any feature code, and cover:

- **Users and frequent tasks**: who uses the UI under each profile and what
  they do most often (`docs/screen-map.md`)
- **Screen map and navigation**: the screens and areas, how users move between
  them, and the URLs that are part of the contract (`docs/screen-map.md`)
- **Roles**: what each profile sees and can do, expressed in terms of
  Sentinel's capabilities and access levels rather than a copy of its role
  definitions (`docs/screen-map.md`)
- **Cross-cutting behaviors**: session handling, error presentation, the
  presentation of a value of a response enum that the contract of the pinned
  version does not list (Data Read from the API), the links to other sites
  built from values of the API (Links from the API), loading and empty
  states, date and time display, confirmations and the outcome of changes,
  accessibility requirements, wording, the representation of a user, and the
  preferences of the browser (`docs/behaviors.md`)
- **Design system**: the visual language, the themes, the reusable interface
  patterns, and the avatar (`docs/design-system.md`)

A screen follows the foundations. A screen that needs to depart from a
cross-cutting behavior changes the foundations first.

### Screen Documents

A feature has no separate specification pull request. Its issue holds a short
description and acceptance criteria agreed with the repository owner; the pull
request implements the feature, shows screenshots, and creates or updates the
screen document with what was built; the owner approves by looking at the
result.

The screen documents are in `docs/screens/`, one for each screen or area,
named after it in kebab-case, such as `docs/screens/sign-in.md`.

A screen document is short. It states what a reader needs to understand and
verify the screen, references the foundations instead of restating their
defaults, and omits sections that do not apply:

- **Purpose**: what the screen is for and who uses it
- **Access**: the profiles that can open it and what each sees or can do when
  that differs, in terms of the capabilities that its actions need
  (`docs/screen-map.md`, Roles)
- **Navigation**: how users reach the screen and where it leads, including its
  URL when the URL is part of the contract (`docs/screen-map.md`, Contract
  URLs)
- **Content**: what the screen shows and the Sentinel API operations that
  provide it (method and path), including the filtering, sorting, and
  pagination it exposes
- **Actions**: what users can do, the operation each action calls, any
  confirmation, and the visible result (`docs/behaviors.md`, Confirmations and
  Outcomes)
- **States**: loading, empty, and error states, with the Sentinel error codes
  that the screen handles specifically, when they differ from the foundations'
  defaults (`docs/behaviors.md`, Errors; Loading and Empty States)
- **Cross-references**: the Sentinel specification sections and foundation
  sections the screen relies on

Interface details that neither the foundations nor Sentinel's contract cover
are delegated decisions (`AGENTS.md`, Delegated decisions): the screen document
records the outcome, and the pull request records the choice.

### Sentinel Cross-references

Reference a Sentinel contract by its path relative to the Sentinel repository
root and its section name, for example Sentinel
`docs/features/identity/authentication.md` (Session cookie). Cite section
names, not line numbers. Do not copy Sentinel's rules into this repository; a
short summary that helps the reader is allowed only next to the reference, and
the referenced section remains authoritative.

### Roadmap Independence

Behavioral documents — the foundation documents, the screen documents, and the
architecture and deployment documents of this repository — describe what the
UI does. They MUST remain fully valid regardless of implementation
sequencing: which phase is in progress, which work item introduced a
behavior, or whether a given planning artifact still exists.

**Forbidden** in behavioral documents:

- A roadmap phase label used to scope, justify, or explain a documented
  boundary (e.g., "Phase 3 owns...", "Excluded from Phase N",
  "(Phase N+)")
- A work-item, piece, or gate identifier cited as the reason for a behavior
  or a scope boundary
- A cross-reference into a roadmap or planning document as the
  explanation for why something is or is not specified here
- A reviewer-finding identifier (e.g., "G-01", "GAP-3") or a reference
  to a "Reviewer Findings" section that does not exist in the document
  itself

**Allowed**:

- "Phase" or "step" as a generic English word for a step within a flow or
  lifecycle (e.g., "step 2 of the login flow")
- A scope statement expressed purely in ownership terms, with a
  cross-reference to the actual owner (e.g., "The session cookie is defined
  in Sentinel `docs/features/identity/authentication.md` (Session cookie),
  not here") — without naming a roadmap phase or work-item ID

**Where this information belongs instead**:

- The GitHub issues and milestones that track an execution roadmap, when
  one is in use — they own macro-area and work-item sequencing, dependency
  rationale, and deferrals between work items; no repository planning file
  duplicates them
- The GitHub issue tracking a specific work item — its description and
  comments are the right place to record phase-specific notes,
  implementation decisions, and notes on how reviewer findings were
  addressed for that piece of work (see Workflow — Issues and work units)

**Rationale**: work-item identifiers get renumbered as a roadmap
evolves, and planning artifacts are retired once fully consumed. A document
that cites a phase number, work-item ID, or planning document by name
will silently go stale when the roadmap changes shape or the planning
document disappears, with no code or behavioral change to signal the
drift. The information worth keeping — which document owns which
behavior — is always expressible as a cross-reference, independent of any
roadmap state.
