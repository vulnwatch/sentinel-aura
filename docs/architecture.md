# Architecture

This document defines the architecture of Sentinel Aura: its scope and system
boundary, its link to Sentinel's API contract, the hosting constraints that
Sentinel fixes, and the architecture decisions, both those taken and those
still open. It is the foundation document on which every other design builds.
The screen map, roles, cross-cutting behaviors, and design system belong to the
other foundation documents (`docs/conventions.md`, Foundation Documents); the
CI pipeline and the release process belong to `docs/deployment.md`; backend
behavior, the API contract, and the obligations that the contract places on
clients belong to Sentinel (`README.md`, Specification Boundary).

Every constraint taken from Sentinel is summarized next to the Sentinel section
that states it, and that section remains authoritative (`docs/conventions.md`,
Sentinel Cross-references). A disagreement between a summary here and its
source is a conflict to report, never a choice (`AGENTS.md`).

## Contents

- [Scope and System Boundary](#scope-and-system-boundary)
- [Authority Between the Repositories](#authority-between-the-repositories)
- [Backend Contract](#backend-contract)
- [Hosting Constraints](#hosting-constraints)
  - [Same Origin](#same-origin)
  - [Session Cookie](#session-cookie)
  - [Cross-Origin Requests](#cross-origin-requests)
  - [Local Development](#local-development)
- [Architecture Decisions](#architecture-decisions)
  - [Static Single-Page Application](#static-single-page-application)
  - [Technology Stack](#technology-stack)
    - [Framework and Language](#framework-and-language)
    - [Build Tool, Package Manager, and Node.js](#build-tool-package-manager-and-nodejs)
    - [Development Environment](#development-environment)
    - [Routing, Server State, and Forms](#routing-server-state-and-forms)
    - [Components and Styling](#components-and-styling)
    - [API Client Generation](#api-client-generation)
    - [Static Checks and Tests](#static-checks-and-tests)
    - [Approved Dependencies](#approved-dependencies)
  - [Packaging and Serving](#packaging-and-serving)
  - [Security Headers](#security-headers)
  - [Supported Browsers](#supported-browsers)
- [Open Decisions](#open-decisions)

## Scope and System Boundary

Sentinel Aura is the browser interface of Sentinel. Sentinel provides the
backend and the REST API; the UI presents Sentinel's data and invokes its
operations through that API (Sentinel `docs/architecture.md`, System
Boundary). The API is Sentinel's primary interface and stays independent of
any client or hosting strategy (Sentinel `docs/architecture.md`, Design
Constraints, API-first): the UI adapts to the API, and an operation that the
UI needs is added to the API for every consumer.

**What the UI does:**

- Provides the navigation, screens, presentation, and client-side behavior
  through which users work with Sentinel
- Reads and changes Sentinel's data only through Sentinel's REST API, whose
  endpoints are under `/api/v1/` (Sentinel `docs/api-spec.md`, Base URL)
- Honors every obligation that Sentinel's contract places on clients, such as
  session cookie handling, error handling by the `code` field, and
  non-disclosure semantics (`README.md`, Specification Boundary)

**What the UI does not do:**

- Use a backend other than Sentinel. Sentinel's API is the only backend: the
  UI calls no other service and has no server-side data store or logic of its
  own. A browser navigation that Sentinel's contract prescribes, such as
  the redirect to the identity provider in the SSO login flow (Sentinel
  `docs/features/identity/sso-authentication.md`, Frontend flow), is not a
  backend call
- Define backend behavior. A capability that the UI needs and the API lacks is
  specified and implemented in Sentinel first (`AGENTS.md`, Sentinel as an
  External Authority)
- Enforce authorization. Sentinel decides what each caller may see and do
  (Sentinel `docs/architecture.md`, Capability-based RBAC). What the UI shows
  to each role guides its users and never replaces the API's decision; the
  roles section of the UI foundations defines it (`docs/conventions.md`,
  Foundation Documents)

**Audience and language.** The UI is for internal use only. It is written in
English only and has no localization. Its visual design belongs to the design
system of the UI foundations (`docs/conventions.md`, Foundation Documents).

## Authority Between the Repositories

Sentinel owns the domain and API contract specifications, including the
obligations that its contracts place on clients; this repository owns the UI
and its specifications. `README.md` (Specification Boundary) defines this
boundary, in agreement with Sentinel `docs/architecture.md` (System Boundary).
Within this repository, the foundation documents, this one included, own the
UI as a whole and change before the code that depends on them, while the
screen documents record what each screen does as built (`docs/conventions.md`,
Specification Ownership). `AGENTS.md` (Sentinel as an External Authority)
defines how agents read Sentinel's specifications and what happens when the UI
needs a capability that the API lacks.

## Backend Contract

The UI is built against one exact Sentinel version, which this repository
declares: the supported Sentinel version. Sentinel's API is not considered
stable before version 1.0.0, and its consumers pin exact versions rather than
version ranges (Sentinel `docs/deployment.md`, Pre-1.0 Policy).

- The repository keeps a copy of the OpenAPI document of the supported
  version: the pinned OpenAPI document. The copy is the release asset
  `sentinel-<version>.openapi.json` of that version's published GitHub
  Release, the only source of a version's contract (Sentinel
  `docs/deployment.md`, API Documentation Publication). A release that does
  not publish this asset cannot be the supported version.
- The copy is identical to the release asset, and an automated check of the CI
  pipeline verifies it.
- The API types that the UI uses are generated from the copy, not written by
  hand, so that a change of the contract becomes a visible change of the
  generated types.
- The supported version changes only through an explicit pull request whose
  diff shows the API changes and that states which screens they affect;
  automation may propose such a pull request (`docs/conventions.md`, Pull
  Request Requirements).
- The UI release deployed on a Sentinel host is the one that supports the
  Sentinel version deployed there, so an upgrade of Sentinel moves both
  (Sentinel `docs/deployment.md`, Sentinel Host). Each release of the UI
  therefore states the Sentinel version that it supports, and every change of
  the supported version carries a release signal (`docs/conventions.md`,
  Versioning), so that a UI release supports each Sentinel version that the
  UI moves to.
- Agents read Sentinel's specifications from a read-only local clone, at the
  revision that `AGENTS.md` (Sentinel as an External Authority) selects.

## Hosting Constraints

Sentinel's contract fixes how the UI is hosted. Each constraint holds in every
environment unless it names one.

### Same Origin

- The UI is served from the same origin as the API. In staging and in
  production, one host in each, the Sentinel host, serves both: its reverse
  proxy or ingress routes `/api` and every path under `/api/` to Sentinel's API, and
  every other path to the UI's image (Packaging and Serving). It matches the
  prefix by whole path segment, so `/apidocs` goes to the UI, and forwards the
  path unchanged (Sentinel `docs/deployment.md`, Sentinel Host; Kubernetes
  Workloads). The UI's own URLs are therefore never `/api` or under `/api/`.
- Every path that the API serves is under `/api/`, its OpenAPI document at
  `/api/openapi.json` and its interactive documentation at `/api/docs`
  included, except the probes `/health` and `/ready` (Sentinel
  `docs/api-spec.md`, Base URL; OpenAPI Document and Interactive
  Documentation). The host does not route the probes to the API: there they
  belong to the UI, and a check of the API through the host requests a path
  under `/api/` (Sentinel `docs/deployment.md`, Sentinel Host).
- The UI addresses the API through origin-relative URLs under `/api/v1/`
  (Sentinel `docs/api-spec.md`, Base URL), never through a host name.
- Sentinel registers `/auth/callback` on the UI's origin as the address to
  which the identity provider returns the browser after SSO authentication,
  in local development on the port of the UI development server (Sentinel
  `docs/deployment.md`, IdP Client Registration (id.suse.com); Sentinel
  `docs/features/identity/sso-authentication.md`, Configuration). That URL is
  part of the contract: the host answers it with the UI (Sentinel
  `docs/deployment.md`, Sentinel Host).
- No component that serves the UI on the Sentinel host logs the `Cookie`
  request header, which carries the session token on every path of the host,
  the UI's paths included (Sentinel `docs/deployment.md`, Sentinel Host;
  Sentinel `docs/features/identity/authentication.md`, Session cookie).
- Sentinel's interactive documentation page, `/api/docs`, runs in this
  origin, and every script that it loads acts with the access of the user who
  opens it (Sentinel `docs/api-spec.md`, OpenAPI Document and Interactive
  Documentation). Such a script can also read and change the origin's browser
  storage. The UI therefore keeps no API data there (`docs/conventions.md`,
  Data Read from the API), treats every value that it reads from that storage
  as untrusted input, such as the return URL that the post-login redirect
  keeps in `sessionStorage` (Sentinel
  `docs/features/identity/authentication.md`, Frontend session behavior), and
  registers no service worker, whose cache such a script could fill with
  responses of its own.

### Session Cookie

- A browser session is carried by Sentinel's session cookie,
  `__Host-sentinel_session`, which Sentinel's login and sliding refresh set and
  its logout clears. It is `HttpOnly`, `Secure`, `SameSite=Strict`, and
  `Path=/`, without a `Domain` attribute (Sentinel
  `docs/features/identity/authentication.md`, Session cookie).
- The UI never handles the token: it does not read, store, or send it itself.
  The browser attaches the cookie to the UI's API requests (Sentinel
  `docs/features/identity/authentication.md`, Frontend session behavior and
  Security Considerations).
- Because scripts cannot read an `HttpOnly` cookie, the UI knows the state of
  the session only from the API's responses, for example the `401` that
  triggers the session expiration handling (Sentinel
  `docs/features/identity/authentication.md`, Frontend session behavior).
- A browser accepts the cookie only from a secure origin (Sentinel
  `docs/features/identity/authentication.md`, Session cookie). The Sentinel
  host is served over HTTPS only, in staging as in production: it answers a
  plain HTTP request only with a redirect to the same URL over HTTPS (Sentinel
  `docs/deployment.md`, Sentinel Host). Local Development states the
  condition for the development origin.

### Cross-Origin Requests

- The UI does not use CORS in any environment. A browser client served from
  the API's origin needs no configuration, and `CORS_ORIGINS`, empty by
  default, lists only browser clients served from another origin (Sentinel
  `docs/configuration.md`, Application; Sentinel
  `docs/features/identity/authentication.md`, Cross-Origin Request
  Protection). The UI never needs an entry, and Sentinel's staging and
  production configuration leaves `CORS_ORIGINS` empty unless a browser
  client served from another origin needs one (Sentinel `docs/deployment.md`,
  Staging Deployment; Pre-Production Checklist).
- Sentinel rejects every unsafe request, with any method other than `GET`,
  `HEAD`, and `OPTIONS`, that a browser sends for a page of another origin not
  listed in `CORS_ORIGINS`, with `403 AUTH_CROSS_ORIGIN_REJECTED` (Sentinel
  `docs/features/identity/authentication.md`, Cross-Origin Request
  Protection; Sentinel `docs/api-spec.md`, Cross-Origin Request Protection).
  Its decision reads the `Host`, `Origin`, and `Sec-Fetch-Site` request
  headers, so every reverse proxy in front of the API, on the Sentinel host
  and in local development, forwards them unchanged (Sentinel
  `docs/features/identity/authentication.md`, Cross-Origin Request
  Protection, Deployment Requirement; Sentinel `docs/deployment.md`, Sentinel
  Host).

### Local Development

- A development server on `localhost` serves the UI and proxies `/api` and
  every path under `/api/` to a Sentinel backend at the supported version, so
  that the browser sees one origin, as on the Sentinel host. Its proxy routes
  as the host does (Same Origin): it matches the prefix by whole path segment
  and forwards the path unchanged. It also follows Cross-Origin Requests: no
  CORS, and the `Host`, `Origin`, and `Sec-Fetch-Site` headers forwarded
  unchanged.
- Sentinel's SSO configuration for local development returns the browser to
  `http://localhost:{port}/auth/callback`, where `{port}` is the port of the UI
  development server (Sentinel `docs/deployment.md`, IdP Client Registration
  (id.suse.com)).
- The browser accepts the `Secure`, `__Host-` session cookie only from a
  secure origin (Sentinel `docs/features/identity/authentication.md`, Session
  cookie). The development origin `http://localhost:{port}` qualifies only in
  a browser that accepts `Secure` cookies from `localhost`; Supported Browsers
  states which browsers do. An HTTPS development origin would not match the
  local redirect URI that Sentinel registers, so it requires a change in
  Sentinel first.

## Architecture Decisions

Each entry states the choice and its rationale. An entry that comes from Open
Decisions also states the options considered and their impact.

### Static Single-Page Application

The UI is a single-page application that the browser loads as static files. In
production it runs no server of its own: no server-side rendering, no
backend-for-frontend, and no API of its own. Serving the static files is the
only server-side task (Packaging and Serving).

**Rationale:** Sentinel is the only backend and the browser holds the session,
so the UI has no server-side state or logic to host. A server of the UI's own
would be one more component in front of the API that must meet the hosting
constraints, such as forwarding the request headers unchanged and not logging
the `Cookie` header, without adding any capability.

### Technology Stack

The stack satisfies every constraint of this document. Its options were
compared on six criteria: fit with the hosting constraints (static files, same
origin, cookie session); how reliably LLM agents, which write the code, use the
technology; the maturity, maintenance, and governance of the project; the
supply-chain footprint; accessibility; and testability. A technology that
agents know well was not preferred over a sounder one, and a recent technology
was accepted only where its project shows sustained maintenance.

Each subsection states the choice, the options considered with their impact,
and the rationale. The lockfile pins the versions and Renovate updates them;
a subsection names a version only where the decision depends on it.

#### Framework and Language

**Choice:** React, written in TypeScript and type-checked by the native
TypeScript compiler (TypeScript 7 or later).

| Option | Impact |
|---|---|
| **React** (chosen) | The most widely used UI framework and the one that LLM agents generate most reliably. Governed by the React Foundation of the Linux Foundation since February 2026. The widest choice of accessible component libraries (Components and Styling). Escapes rendered text by default and supports Trusted Types. Its server components, the subject of critical vulnerabilities in December 2025, are not part of a static single-page application. It imposes little structure, so `docs/conventions.md` provides it |
| Angular | One vendor, Google, with a support window of 24 months per major version, a complete built-in toolset, and the strongest built-in protections against injection. Its ongoing move to signals and zoneless change detection leaves agents mixing old and new patterns, and a 2025 benchmark of front-end code generation (DesignBench) measured fewer compiling results for Angular than for React or Vue. Its accessible headless components date from 2025. Its build tooling adds about 285 packages, and its packages carry no provenance attestations |
| Vue | Mature, small, and well known to agents, with fewer accessible component libraries of the depth of React Aria |
| Svelte | Small output from a compiler, but its syntax changed with Svelte 5 and agents still mix the two; a smaller ecosystem |
| SolidJS, Lit | Small ecosystems; Lit's shadow DOM complicates accessibility relationships between components |

**Rationale:** React combines the most reliable agent output with the
strongest accessibility ecosystem and neutral, foundation-based governance.
Angular's built-in structure would help consistency, but `docs/conventions.md`
and the reviewers provide it, while weaker agent output and heavier tooling
would cost on every change.

TypeScript lets the API types be generated from the pinned OpenAPI document
(Backend Contract). The native compiler, stable since July 2026, type-checks
about ten times faster than TypeScript 6. It ships without a programmatic API
until a later minor version, so tools that need that API, such as
typescript-eslint and openapi-typescript, cannot run on it; the chosen static
checks and API client generator do not need it. Should a required tool need
the API, TypeScript 6 can run beside TypeScript 7, as Microsoft documents.

#### Build Tool, Package Manager, and Node.js

**Choice:** Vite builds the UI and serves it during development. npm, the
package manager bundled with Node.js, installs the dependencies. Node.js runs
only the tooling, never in production, and its version is the long-term
support (LTS) line of the tooling image (Development Environment).

| Option | Impact |
|---|---|
| **Vite** (chosen) | The standard build tool for React single-page applications, maintained by VoidZero. Its development server proxies `/api` with the request headers unchanged (Local Development), and its production build contains no inline script |
| Rsbuild | Comparable features, with smaller adoption |
| webpack, Parcel | Slower and more configuration (webpack), or a smaller community (Parcel) |

| Option | Impact |
|---|---|
| **npm** (chosen) | Ships with Node.js, so no other tool needs installing, pinning, or updating. It blocks the install scripts of dependencies by default and can refuse versions younger than a minimum age and dependencies fetched from Git or a URL; Renovate supports it. Its default layout lets code import a package that it does not declare, which its linked layout prevents |
| pnpm | Stricter by default: a minimum release age, blocked exotic sub-dependencies, and a layout that rejects undeclared imports. One more tool to install, pin, and update, and its current major version is a rewrite |
| Yarn, Bun | One more tool, with compatibility costs (Yarn's Plug'n'Play) or a shorter track record as a package manager (Bun) |

| Option | Impact |
|---|---|
| **The LTS line of the tooling image** (chosen) | One Node.js version for development, CI, and tests, updated together with the test browsers |
| The newest LTS line from a Node.js image, with a separate image for the browsers | The build and the tests run on different Node.js versions |
| Node.js installed on the host | The version drifts with the host, and dependency code runs on the host (Development Environment) |

npm is configured as follows:

- The lockfile is committed, and CI installs exactly what it records.
- The install scripts of dependencies stay blocked; allowing one is an
  admission decision (`docs/conventions.md`, Dependency Admission).
- npm uses its linked layout, so code can import only the packages that
  `package.json` declares, and the type check fails on any other import.
- npm resolves only versions published at least seven days earlier, and
  Renovate applies the same minimum release age to its updates. The malicious
  versions published through hijacked maintainer accounts and release
  pipelines in 2025 and 2026 were mostly detected and removed within hours or
  a few days. Vulnerability-fix updates are exempt: Renovate does not hold
  them back, but npm still applies the age to their lockfile, so a maintainer
  delivers a fix younger than the age with only the fixed packages excluded
  from it (`docs/deployment.md`, Dependency Updates). npm installs a version
  that the lockfile records whatever its age.
- Dependencies fetched from Git or from a URL are refused, and `package.json`
  records exact versions, so every update is a visible change.
- The Node.js line is an active or maintenance LTS line, never a Current or
  end-of-life one; `package.json` declares it, and npm refuses to install on
  another line.

**Rationale:** with these settings, npm closes the main install-time attack
paths and, through its linked layout, matches pnpm's strictness on undeclared
imports, without adding a tool.

#### Development Environment

**Choice:** every Node.js command runs in a disposable container of one
tooling image, never directly on the host: dependency installation, the
development server, the build, API client generation, static checks, and
tests. Rootless Podman starts the containers, through a script of this
repository that CI runs as well, so every command runs the same way locally
and in CI. The tooling image is the official Playwright image, which provides
Node.js, npm, and the test browsers, pinned by version and digest. The
containers follow these rules:

- A container receives the repository and nothing else from the host: no home
  directory, credentials, keys, or tokens.
- Dependencies are installed in a container volume, not in the working tree.
- The repository is mounted read-only, except the paths that a command writes:
  its outputs, such as the build, test reports, and the generated API client,
  and the tracked files that it changes by design, such as formatting or a
  dependency change. No command can write the Git metadata, the Git hooks, the
  agent configuration, the workflows, or the scripts, which the host executes.
- The development server is published on the loopback interface only.

For local development and the end-to-end tests, the Sentinel backend runs from
Sentinel's published image at the supported version, with the PostgreSQL and
Redis that it requires (Sentinel `docs/deployment.md`, Software
Requirements), in containers of the same engine; Sentinel's image does not
depend on a specific runtime (Sentinel `docs/architecture.md`, Design
Constraints). That backend holds fictional data only (Open Decisions), so
signing in there uses Sentinel's local authentication: SSO matches real
identity provider accounts (Sentinel
`docs/features/identity/sso-authentication.md`, Identity Mapping).

| Option | Impact |
|---|---|
| Tooling on the host | The simplest setup. Every dependency's code runs with access to the user's home directory, the target of the credential-stealing npm worms of 2025 and 2026, and caches and browsers accumulate there. The Node.js version drifts with the host |
| **Rootless Podman** (chosen) | Dependency code sees only the repository. The host needs only Podman and Git, and every artifact lives in the repository or in Podman's storage, removable at once. Costs about a second per command and a tooling image of about 2 GB |
| Docker | The same isolation, through a daemon that runs as root by default |
| Development containers or a virtual machine | More setup, and coupling to an editor or a hypervisor |

**Rationale:** the main threat to developers who use npm is dependency code
that steals credentials and plants persistence on the workstation, and agents
install and run dependencies constantly. A container limits that code to the
repository at a small cost, and the read-only mount keeps it from writing the
files that the host executes.

#### Routing, Server State, and Forms

**Choice:** TanStack Router, with routes defined in code, for navigation;
TanStack Query for the data read from the API; forms built from React Aria's
form components and validated with Zod, without a form library.

| Option | Impact |
|---|---|
| **TanStack Router** (chosen) | Path and search parameters are typed and validated by a schema, so the filters, sorting, and pagination kept in the URL are checked at compile time and on every navigation. Brings 9 runtime packages, some of them used only for server rendering. Routes defined in code need no route generator |
| React Router | The most widely used router, with 2 runtime packages and yearly major versions announced through future flags. Search parameters are untyped strings that each screen parses itself |
| Wouter | Minimal, without data loading or validated search parameters |

| Option | Impact |
|---|---|
| **TanStack Query** (chosen) | The standard for server state in React: caching, request deduplication, retries, and invalidation after a change. The API client generator produces its hooks (API Client Generation). One runtime package of its own |
| SWR | Smaller, with weaker support for changes and invalidation |
| Router loaders alone | No cache shared between screens |

| Option | Impact |
|---|---|
| **React Aria form components and Zod** (chosen) | Labels, descriptions, and error messages are accessible by construction, and form state stays in React's own state. Zod also validates the search parameters and has no dependencies |
| React Hook Form | Widely used; one maintainer, and releases without provenance attestations |
| TanStack Form | Stable since 2025, from the maintainers of the router |

**Rationale:** typed URL state is the core of a UI made of filtered and
paginated lists, and TanStack Router is the only option that checks it. A form
library can be admitted later (`docs/conventions.md`, Dependency Admission)
when a form needs one.

#### Components and Styling

**Choice:** React Aria Components provide the behavior and accessibility of the
interactive elements, and Tailwind CSS styles them. The visual design belongs
to the design system of the UI foundations (`docs/conventions.md`, Foundation
Documents).

| Option | Impact |
|---|---|
| **React Aria Components** (chosen) | Adobe's unstyled components, tested with screen readers across browsers and input modes, including tables with sorting and selection, dialogs, menus, comboboxes, and date fields. Brings 12 runtime packages from one team, published from maintainer accounts without provenance attestations. Inserts one fixed stylesheet at run time (Security Headers) |
| Radix UI Primitives, and shadcn/ui on top of it | Very popular and well known to agents. One package per component, with more transitive packages (24 for the dialog), and no table or date components |
| Base UI | Unstyled components from the MUI team, stable since December 2025, so with a shorter history |
| MUI, Mantine, PatternFly, Carbon, Fluent UI | Ready-made design systems that would impose their visual language on the foundations. MUI and Fluent UI insert styles at run time, which a strict Content Security Policy on static files cannot allow |

| Option | Impact |
|---|---|
| **Tailwind CSS** (chosen) | Generates one static stylesheet at build time. A shared scale of colors, spacing, and type, defined by the design system, keeps screens built in separate agent sessions consistent, and agents use it fluently. Its company cut most of its engineering team in January 2026, then gained sponsors, and releases continue; the generated CSS does not depend on the project's future, and CSS Modules are the fallback. Used only at build time |
| CSS Modules | Built into Vite, with no dependency. More hand-written CSS, and no shared scale unless the design system writes one |
| CSS-in-JS at run time | Conflicts with the strict Content Security Policy |

**Rationale:** accessibility is a primary criterion, and React Aria is the most
thoroughly accessible option while leaving the visual design to the
foundations. Tailwind's static output fits the Content Security Policy, and
its shared scale counters drift between screens.

#### API Client Generation

**Choice:** Orval generates, from the pinned OpenAPI document, the API types, a
request function for each operation, and the TanStack Query hooks. The
generated code is committed; CI regenerates it and fails when the result
differs, so a change of the contract appears in the pull request diff (Backend
Contract). The requests use origin-relative URLs under `/api/v1/` (Same
Origin) and the browser's default same-origin credentials, through one shared
request function that turns every error response into an error, carrying
Sentinel's `code` when the response provides one (Sentinel `docs/api-spec.md`,
Response Format).

| Option | Impact |
|---|---|
| **Orval** (chosen) | Generates the types, the requests, and the query hooks, and runs with the native TypeScript compiler because it does not use the TypeScript API. Released several times a month by several maintainers. Adds no runtime dependency besides TanStack Query; used only at build time, where it brings about 110 packages, published without provenance attestations |
| openapi-typescript with openapi-fetch | Types and a minimal client, the smallest footprint. Requires the TypeScript 5 API and cannot be installed with TypeScript 7; no release since February 2026 |
| Hey API | Pre-1.0, with breaking changes in minor releases, and one main maintainer |
| Kubb | Active, with smaller adoption and one main maintainer |
| Hand-written types | Contradict Backend Contract |

**Rationale:** Orval is the maintained generator that works with the chosen
compiler and also produces the query layer, which would otherwise be written
by hand for every operation.

#### Static Checks and Tests

**Choice:**

| Concern | Tool |
|---|---|
| Type check | The TypeScript compiler |
| Lint, including type-aware, React hooks, and accessibility (jsx-a11y) rules | Oxlint |
| Formatting | Prettier |
| Unit and component tests | Vitest in browser mode, in Chromium and Firefox through Playwright, with coverage measured by Istanbul |
| End-to-end tests and screenshots | Playwright, in Chromium and Firefox, against the production build served as in production and a Sentinel backend at the supported version |
| Automated accessibility checks | axe-core, through its Playwright integration, with the WCAG 2.2 A and AA rules, in the end-to-end tests |

Automated accessibility checks find only part of the WCAG failures; the
accessibility requirements of the UI foundations cover the rest
(`docs/conventions.md`, Foundation Documents).

| Option | Impact |
|---|---|
| ESLint with typescript-eslint and plugins | The most widely used linter and the best known to agents. Its type-aware rules need the TypeScript 6 API beside TypeScript 7, and the set adds about 230 packages |
| Biome | One binary without dependencies; its type-aware rules rely on its own type inference rather than on the compiler |
| **Oxlint** (chosen) | One binary in platform packages, about 20 packages in total. Runs 59 of the 61 type-aware rules of typescript-eslint on the native compiler, includes the jsx-a11y and React hooks rules, and keeps ESLint's rule names |

| Option | Impact |
|---|---|
| **Prettier** (chosen) | The standard formatter, with no dependencies |
| Oxfmt, Biome | Faster, but pre-1.0 (Oxfmt) or tied to a linter not chosen (Biome) |

| Option | Impact |
|---|---|
| Jest or Vitest with a simulated DOM (jsdom) | Faster startup, but focus, layout, and the accessibility tree are approximations, which matters for a UI with accessibility as a primary criterion |
| **Vitest in browser mode** (chosen) | Tests run in the browser engines of the users and of the end-to-end tests. Istanbul measures coverage in every browser, while V8 coverage supports Chromium only |
| Mock Service Worker for API responses | About 46 packages; component tests replace the shared request function instead, and the end-to-end tests use a real backend |

| Option | Impact |
|---|---|
| **Playwright** (chosen) | Chromium and Firefox in one runner, an official container image with the browsers, isolated browser contexts, and screenshots |
| Cypress | Runs inside the browser, without several tabs or origins in one test, and with a heavier runner |

| Option | Impact |
|---|---|
| **axe-core** (chosen) | The most widely used accessibility rule engine, maintained by Deque, with an official Playwright integration of one package |
| Pa11y, Lighthouse | Run axe-core or a similar engine through a separate runner, with more packages and no integration into the end-to-end tests |

**Rationale:** the chosen tools run on the native compiler, add the fewest
packages, and test in real browsers, which accessibility testing needs.

#### Approved Dependencies

These are the direct dependencies that the stack approves; a new one requires
the decision that `docs/conventions.md` (Dependency Admission) defines. The
dependencies that reach the browser bring about 30 packages in total.

| Dependency | Purpose | In the browser |
|---|---|---|
| `react`, `react-dom` | Framework | Yes |
| `@tanstack/react-router` | Routing | Yes |
| `@tanstack/react-query` | Server state | Yes |
| `react-aria-components` | Accessible components | Yes |
| `zod` | Validation of search parameters and form input | Yes |
| `typescript`, `@types/react`, `@types/react-dom` | Language and type check | No |
| `vite`, `@vitejs/plugin-react` | Build and development server | No |
| `tailwindcss`, `@tailwindcss/vite` | Styling | No |
| `orval` | API client generation | No |
| `oxlint`, `oxlint-tsgolint` | Lint | No |
| `prettier` | Formatting | No |
| `vitest`, `@vitest/browser-playwright`, `vitest-browser-react`, `@vitest/coverage-istanbul` | Unit and component tests | No |
| `@playwright/test`, `@axe-core/playwright` | End-to-end and accessibility tests | No |
| Container image `mcr.microsoft.com/playwright` | Tooling image (Development Environment) | No |
| Container image `nginxinc/nginx-unprivileged` | Base of the released image (Packaging and Serving) | No |
| Container images `ghcr.io/vulnwatch/sentinel` at the supported version, and the official `postgres` and `redis` images at the versions that Sentinel requires | Backend for local development and end-to-end tests | No |

### Packaging and Serving

**Choice:** a release publishes an OCI image that serves the production build
with nginx. The image is built on the official unprivileged nginx image,
pinned by version and digest, runs as a non-root user, and contains only
nginx, its configuration, and the static files. On the Sentinel host, the
reverse proxy or ingress routes to this image every path that is not `/api`
or under `/api/` (Same Origin). The image:

- answers every path outside the build's asset directory that is not a file
  of the build, `/auth/callback` included, with the application's entry
  document, so that the application resolves the path;
- serves the content-hashed files of the asset directory with long-lived
  caching, answers a missing one with `404`, and serves the entry document
  without caching;
- sets the security headers of its responses (Security Headers);
- answers no request with a redirect, so that its responses depend on
  neither the scheme nor the `Host` header with which a request reaches it:
  TLS ends at another component of the host, and Sentinel's requirement that
  request headers arrive unchanged covers only the API (Sentinel
  `docs/deployment.md`, Sentinel Host); and
- writes nginx's default access log, which does not include the `Cookie`
  header (Same Origin).

| Option | Impact |
|---|---|
| **OCI image with nginx** (chosen) | Deployable beside Sentinel's images with any container runtime; the headers and the path fallback travel with the release and are tested in CI. nginx is small, mature, and promptly patched |
| Static archive served by the host's reverse proxy | One container less, but every deployment must reproduce the path fallback and the headers in its own proxy configuration |
| Static files served by Sentinel's API | Couples Sentinel's image to the UI, against Sentinel's API-first constraint (Sentinel `docs/architecture.md`, Design Constraints) |
| SUSE's nginx image | Supported by SUSE, but runs as root by default, is distributed under the SUSE Linux Enterprise EULA, and follows an older nginx line |
| Caddy, static-web-server | Capable, but less widely deployed and audited than nginx for this use |

**Rationale:** an image keeps everything that the UI's correctness and security
depend on under this repository's tests, and needs from Sentinel's deployment
only the routing of the host and the pass-through of its response headers,
which Sentinel requires (Same Origin; Security Headers).

### Security Headers

**Choice:** the UI's image sets these headers on its responses:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'none'; script-src 'self'; style-src 'self' '<hash>'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Permissions-Policy` | Every browser feature that the UI does not use, disabled |

`<hash>` is the hash of the one fixed stylesheet that React Aria inserts at run
time. A production build of the stack runs under this policy without
violations in Chromium and Firefox: it needs no inline script, no evaluated
code, and no inserted style except the hashed one, once Zod's run-time code
generation is disabled. The end-to-end tests fail on any policy violation, so
a library update that breaks the policy is caught before release.

The image does not set `Strict-Transport-Security`, because the header
applies to the whole host and only over HTTPS. The component that terminates
TLS for the Sentinel host sets it on every HTTPS response of the host, the
API's and the UI's alike, with a `max-age` of at least one year and without
`preload`. The reverse proxy neither removes nor changes the headers that the
image sets (Sentinel `docs/deployment.md`, Sentinel Host).

| Option | Impact |
|---|---|
| **The UI's image** (chosen) | The policy is tested with the build that it protects and released with it |
| The reverse proxy or ingress of the Sentinel host | One place for the whole host, but every deployment must copy a policy that depends on the UI's build |
| A `meta` element in the entry document | Cannot express `frame-ancestors` or the other headers |

**Rationale:** the UI displays text from external sources, such as CVE
descriptions. React escapes it, and a strict policy with Trusted Types blocks
the common forms of script injection that an escaping mistake would allow.

### Supported Browsers

**Choice:** the two latest major versions of Chrome and Firefox, and the
current Firefox Extended Support Release. Edge and Safari are not supported.
Local development and the tests use Chromium and Firefox.

| Option | Impact |
|---|---|
| **Chrome and Firefox** (chosen) | Both accept `Secure` cookies from `http://localhost`, and with them Sentinel's session cookie on the development origin (Local Development). The Extended Support Release covers enterprise Linux desktops, which ship it. The tests cover both engines |
| Also Edge | Shares Chrome's engine, so it would add no test, but the UI's users do not use it, and supporting it would commit the project to fixing the problems specific to it |
| Also Safari | WebKit rejects a `Secure` cookie from `http://localhost` (WebKit bug 232088), so Safari cannot serve local development, and every test run would add a third engine |

Vite's default build target, the browsers of Baseline Widely Available, is
older than these versions, so the build needs no other target.

**Rationale:** the UI is for internal use only (Scope and System Boundary),
and its users, SUSE employees, do not use Edge. The repository owner chose not
to support Edge or Safari. Chromium and Firefox are also the two engines that
local development can use.

## Open Decisions

These decisions are not taken yet. Every design that depends on one of them
waits for it. When this repository takes a decision, its entry moves to
Architecture Decisions; when Sentinel takes one, its entry is removed, and the
sections that depend on it state the outcome and cite Sentinel's section.

| Decision | Decided by | When |
|---|---|---|
| Fictional data for local development and the end-to-end tests: how a Sentinel backend at the supported version is loaded with fictional data only (`docs/conventions.md`, Example Data in Documentation) | Sentinel, through an issue in `vulnwatch/sentinel`, because loading data into the backend belongs to Sentinel | Before the local development environment and the end-to-end tests are built |
