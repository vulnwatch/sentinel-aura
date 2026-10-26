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
    - [Tooling Language](#tooling-language)
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
declares in `contract/sentinel-version`: the supported Sentinel version.
Sentinel's API is not considered stable before version 1.0.0, and its
consumers pin exact versions rather than version ranges (Sentinel
`docs/deployment.md`, Pre-1.0 Policy).

- The repository keeps a copy of the OpenAPI document of the supported
  version, `contract/sentinel.openapi.json`: the pinned OpenAPI document. The
  copy is the release asset `sentinel-<version>.openapi.json` of that
  version's published GitHub Release, the only source of a version's contract
  (Sentinel `docs/deployment.md`, API Documentation Publication). A release
  that does not publish this asset cannot be the supported version. The copy
  keeps its name from one version to the next, so that the diff of a change
  of the supported version shows the changes of the document.
- The copy is identical to the release asset, and an automated check of the CI
  pipeline verifies it (`docs/deployment.md`, Workflow Inventory).
- The repository also pins the digest of Sentinel's image of the supported
  version, in `contract/sentinel-image-digest`, and the backends of local
  development, the end-to-end tests, and the local preview run the image by
  it (Development Environment). The registry does not enforce the
  immutability of image tags, so a consumer keeps the digest that a version's
  tag names (Sentinel `docs/deployment.md`, Consumer discovery and
  verification). The version stays declared in one place,
  `contract/sentinel-version`, and the digest is pinned when the version
  changes. The same automated check verifies that the tag still names the
  pinned digest: Sentinel's release process never moves a published tag
  (Sentinel `docs/deployment.md`, Release Publication and Immutability), so a
  tag that moves for the same version is reported to Sentinel, and the pin is
  kept. The pin does not verify the provenance attestations of the image,
  which Sentinel's consumer procedure also describes. Not verifying them is
  an accepted risk: the backends that run the image hold only fictional data
  and run unprivileged on a developer's host or a CI runner.
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
  Versioning), so that the next UI release supports the new version
  (`docs/deployment.md`, Supported Sentinel Version).
- Agents read Sentinel's specifications from a read-only local clone, at the
  revision that `AGENTS.md` (Sentinel as an External Authority) selects.

## Hosting Constraints

Sentinel's contract fixes how the UI is hosted. Each constraint holds in every
environment unless it names one.

### Same Origin

- The UI is served from the same origin as the API. In staging and in
  production, one host in each, the Sentinel host, serves both: its reverse
  proxy or ingress routes `/api` and every path under `/api/` to Sentinel's
  API, and every other path to the UI's image (Packaging and Serving). It
  matches the prefix by whole path segment, so `/apidocs` goes to the UI, and
  forwards the path unchanged (Sentinel `docs/deployment.md`, Sentinel Host;
  Kubernetes Workloads). The UI's own URLs are therefore never `/api` or under
  `/api/`.
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
  Protection). The UI never needs an entry. Sentinel's staging configuration
  leaves `CORS_ORIGINS` empty, and its Pre-Production Checklist keeps it empty
  unless a browser client is served from another origin (Sentinel
  `docs/deployment.md`, Staging Deployment; Pre-Production Checklist).
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
tests. Docker Engine starts the containers, through a script of this
repository that CI runs as well, so every command runs the same way locally
and in CI. It is the engine of GitHub's runners, and Sentinel's local
development supports it, as well as Docker Desktop, but not Podman (Sentinel
`docs/deployment.md`, Software Requirements; Local Development), so a
developer of both repositories who uses it needs one engine. The tooling
image is the official Playwright image, which provides Node.js, npm, and the
test browsers, pinned by version and digest. The containers follow these
rules:

- A container receives from the host the repository and the directory of its
  dependencies, and nothing else: no other part of the home directory, and no
  credentials, keys, or tokens.
- Dependencies are installed outside the working tree, in a directory of each
  clone in the user's cache directory, from which the host executes nothing.
  The script records the installation that the directory holds in a file
  beside it, which no container can reach.
- The repository is mounted read-only, except the paths that a command writes:
  its outputs, such as the build, test reports, and the generated API client,
  and the tracked files that it changes by design, such as formatting or a
  dependency change. No command can write the Git metadata, the Git hooks, the
  agent configuration, the workflows, or the scripts, which the host executes.
- A container runs with the user and group IDs of the user who starts it, so
  that the files that it writes belong to that user, without capabilities and
  unable to gain privileges: dependency code never runs as root.
- The commands that need no network, such as the static checks, the unit and
  component tests, and API client generation, run without it.
- Every port that a container publishes, such as the development server's, is
  bound to the loopback interface only.

The supported setup is Docker Engine 28.0.0 or later on Linux, with its
default daemon, which runs as root on the same host, reached through its
default socket, `/var/run/docker.sock`, as on GitHub's runners; Docker Desktop
is not needed. Version 28.0.0 stops other hosts of the network from reaching
the ports published on the loopback interface (moby/moby#49325); versions
28.2.0 to 28.3.2 lose that protection after a reload of firewalld
(CVE-2025-54388). The Sentinel backend (below) also needs Docker Engine's
Compose plugin, 2.32.2 or later, the minimum of Sentinel's local development
(Sentinel `docs/deployment.md`, Software Requirements). The scripts refuse
every other setup with a message: an older version; any other endpoint (a
remote daemon, or one in a virtual machine, as with Docker Desktop); Podman's
Docker API; Docker's rootless mode and user namespace remapping; and running
them as root. In rootless mode only the root user of a container maps to the
user who starts it, and Docker has no option that maps the user's own IDs
into the container, as Podman's `keep-id` does: a container that runs with
those IDs writes files that belong to other IDs of the host, and one that
runs as its root runs dependency code as root. User namespace remapping has
the same effect.

The Docker daemon runs as root, and a user who can use it, such as a member of
the `docker` group, is equivalent to root on the host: whatever reaches the
daemon's socket can start a privileged container. The containers do not
receive the socket, so dependency code cannot use it. A developer of Sentinel
who uses Docker Engine's default daemon has this access already.

For local development, the end-to-end tests, and the local preview, the
Sentinel backend runs from Sentinel's published image at the supported
version, by its pinned digest (Backend Contract), with the PostgreSQL and
Redis that it requires (Sentinel `docs/deployment.md`, Software
Requirements), in containers of the same engine; Sentinel's image does not
depend on a specific runtime (Sentinel `docs/architecture.md`, Design
Constraints). Docker Compose starts them from `compose.yaml`, through
`scripts/dev-env.sh` (Backend orchestration, below).
That backend holds fictional data only: it is loaded with Sentinel's example
dataset, which the image of the supported version provides (Sentinel
`docs/features/platform/example-dataset.md`, Purpose):

- The dataset is loaded into a newly created, migrated database before any
  other Sentinel process starts. The backend is recreated, never migrated, to
  restore the dataset or to move to another supported version (Sentinel
  `docs/deployment.md`, Loading the Example Dataset). Its data lives only as
  long as its containers, and every new backend loads the dataset into a new
  database. In local development, the script reuses a running backend only
  while its configuration and the supported version are unchanged, and
  removes the data with the containers when it stops the backend.
- The backend's containers receive nothing from the host and run as the
  non-root users of their images, without capabilities and unable to gain
  privileges. They publish no port. In local development, the development
  server joins the backend's network, where its proxy reaches the API (Local
  Development); in the end-to-end tests and the local preview, the UI's image
  and a reverse proxy join it, under the same rules, except that the proxy
  receives its configuration, read-only, and the preview's proxy publishes
  its port (End-to-end environment and Local preview, below).
- Signing in there uses Sentinel's local authentication, with the dataset's
  users and its published password. SSO is not available there: it matches
  only external users, and every dataset user is a local user (Sentinel
  `docs/features/platform/example-dataset.md`, Credentials; Sentinel
  `docs/features/identity/sso-authentication.md`, Identity Mapping).
- Because that password is public, the backend is reachable only from the
  developer's host or from inside its test environment: every published port
  through which it can be reached, its own or that of a proxy in front of it,
  is bound to the loopback interface only (Sentinel
  `docs/features/platform/example-dataset.md`, Security Considerations).
- Every fetcher is disabled after the load and is never enabled on that
  backend, and an operation that needs an external source, such as adding a
  package through the API, does not complete there (Sentinel
  `docs/features/platform/example-dataset.md`, Operating a Dataset Backend).
- A capability that the UI needs and the dataset lacks is requested as a
  change of Sentinel's dataset specification (Sentinel
  `docs/features/platform/example-dataset.md`, Drift Protection; `AGENTS.md`,
  Sentinel as an External Authority).

| Option | Impact |
|---|---|
| Tooling on the host | The simplest setup. Every dependency's code runs with access to the user's home directory, the target of the credential-stealing npm worms of 2025 and 2026, and caches and browsers accumulate there. The Node.js version drifts with the host |
| **Docker Engine** (chosen) | Dependency code sees only the repository and its dependencies, and runs with the user's IDs, without capabilities. The engine of GitHub's runners and one that Sentinel's local development supports, so a developer of both repositories can use one engine. Its daemon runs as root, so access to it amounts to root on the host. The host needs Docker Engine with its Buildx and Compose plugins, Git, `curl`, and `jq`; the dependencies live in the user's cache directory and the images in Docker's storage, each removable at once. Costs about half a second per command and a tooling image of about 2 GB |
| Rootless Podman | The same isolation, without a daemon that runs as root. A developer of both repositories needs a second engine, which Sentinel's local development does not support, and the scripts diverge from Sentinel's development and test tooling, which supports only Docker (Sentinel `docs/deployment.md`, Local Development) |
| Docker in rootless mode | No daemon that runs as root, but the files that the containers write in the repository belong to other IDs of the host unless dependency code runs as root in the container, and CI does not run it |
| Docker Desktop | Docker Engine in a virtual machine, which Linux does not need, behind a socket of the user. Bind mounts and published ports cross the virtual machine's file sharing and port forwarding, which CI does not run, and its license requires a paid subscription in larger organizations |
| Development containers or a virtual machine | More setup, and coupling to an editor or a hypervisor |

**Rationale:** the main threat to developers who use npm is dependency code
that steals credentials and plants persistence on the workstation, and agents
install and run dependencies constantly. A container limits that code to the
repository at a small cost, and the read-only mount keeps it from writing the
files that the host executes. Rootless Podman was chosen first, because it
needs no daemon that runs as root; Docker Engine replaced it once Sentinel's
local development required Docker, so that one engine can serve both
repositories and CI. Running the containers with the user's IDs keeps
dependency code unprivileged on the host, as rootless Podman did, and also
inside the container.

**Backend orchestration:** `compose.yaml` declares the backend's containers,
the order of their start, and their health checks, and Docker Compose runs
them; two profiles add the containers of the end-to-end environment and of
the local preview. `scripts/dev-env.sh` adds what Compose cannot decide: it
reads the supported version and its image digest from `contract/`, reuses or
recreates the backend under the rules above, creates one for each browser of
the end-to-end tests and one for the preview, and starts the development
server and the end-to-end tests through `scripts/tooling.sh`, which keeps the
rules of the tooling containers in one place.

| Option | Impact |
|---|---|
| **Docker Compose** (chosen) | Starts the containers in order, waits until each one is healthy or has completed, and removes them with their data. Separate projects run several backends side by side, as the end-to-end tests need. Renovate updates the images of `compose.yaml`. One plugin of Docker's CLI, which Sentinel's local development requires too |
| A script of `docker run` commands | No other tool, but the script implements the order, the waits, the separation of several backends, and the cleanup itself |
| Sentinel's own Compose files | They serve Sentinel's development from source and the tests of its image, load no example dataset, and are not part of Sentinel's contract |

**Rationale:** the backend is a group of containers that depend on one
another, and the end-to-end tests add more of them; Compose describes such a
group in one file, and the script stays limited to the decisions that depend
on this repository.

**End-to-end environment:** the end-to-end tests run the UI's production
image (Packaging and Serving) behind a reverse proxy that stands for the one
of the Sentinel host: it runs the base image of the UI's image, routes `/api`
and every path under `/api/` to the API and every other path to the UI's
image, matched by whole path segment, and forwards the path, the `Host`,
`Origin`, and `Sec-Fetch-Site` headers, and the response headers unchanged
(Same Origin; Cross-Origin Requests). `test/e2e/proxy.conf` configures it.
The tests run in a tooling container that shares the network namespace of
the proxy, so the browsers reach the UI on `http://localhost:8080`, a secure
origin for the session cookie (Local Development), and the environment
publishes no port.

Each browser runs the tests against its own backend, newly loaded with the
dataset, and its tests share it one at a time. Tests change data, and even a
sign-in changes the sessions of its user, while the dataset is restored only
by recreating the backend (Sentinel `docs/deployment.md`, Loading the Example
Dataset): with one backend for both browsers, the second would find the data
that the first left, and a screen would show different data in each.

**Local preview:** `scripts/dev-env.sh preview` lets a maintainer try a pull
request before approving its merge. It downloads the production build that
the CI of the pull request's latest commit tested (`docs/deployment.md`,
Workflow Inventory), builds the UI's image from it with the `Containerfile`
and the nginx configuration of the local checkout, and runs it behind the
reverse proxy of the end-to-end environment against a new dataset backend,
at the supported version and image digest that the pull request declares:
the checkout's pinned digest for the checkout's supported version, and for
another version only a published Sentinel release whose tag names that
digest (Backend Contract). The proxy is published on the loopback interface
only, on `http://localhost:4173`. The preview also needs the GitHub CLI on
the host, which downloads the build.

The pull request's input is that build and the version and digest that it
declares; the files of the local checkout that the preview uses instead,
such as `compose.yaml`, are listed when the pull request changes them.
Nothing of the pull request runs on the host: its code runs in the
maintainer's browser, on a `localhost` origin, where the security headers
and the routing of the checkout confine it. That is why the nginx and proxy
configuration come from the checkout, not from the pull request. Browsers
share the cookies of `localhost` among its ports, so a pull request from
outside the project is previewed in a separate browser profile
(`CONTRIBUTING.md`, Trying a Pull Request).

| Option | Impact |
|---|---|
| **Local preview of the build that CI tested** (chosen) | The build that the tests passed, in an image rebuilt with the checkout's `Containerfile` and nginx configuration, so with the tested headers unless the pull request or the checkout changes them, against a dataset backend that only the developer's host reaches. Needs the GitHub CLI, and a successful CI run of the pull request's latest commit within the seven days that its build is kept |
| Building a checkout of the pull request locally | Works without CI, but runs the pull request's scripts and dependency installation on the host, and builds an image other than the one that the tests passed |
| Downloading the image that CI built | The image that the tests passed, but loading an archive that a pull request's workflow produced can replace any image of the host's engine |
| A preview deployment of each pull request | Needs a backend reachable from a shared network, which a dataset backend must not be (Sentinel `docs/features/platform/example-dataset.md`, Security Considerations), and hosting with write access |

**Rationale:** the owner approves a change by looking at the result, which
the preview shows as it will be released, while the pull request's code
stays in the browser and the dataset backend on the developer's host.

#### Tooling Language

**Choice:** the scripts, their libraries, and the Git hooks are written in
bash and run on the host. The checks of the HTTP responses of the UI's image
and of the environments that the scripts start are the one exception: they
are written in TypeScript, as Playwright tests that run in the tooling
container. `docs/conventions.md` (Shell Scripting, Tooling Structure) states
the rule.

Most of the code that runs on the host runs host tools: Docker Engine and its
plugins, the GitHub CLI, Git, and `curl`. The tooling container cannot run
them, because it receives neither the Docker daemon's socket nor credentials
(Development Environment). The rest of that code processes what those tools
return, such as JSON, with `jq`, and validates values with regular
expressions. The checks of the HTTP responses of the UI's image and of the
environments need nothing of the host, and run as Playwright tests in the
container (`docs/conventions.md`, End-to-End Tests).

| Option | Impact |
|---|---|
| **Bash, with the checks of the image and the environments in TypeScript** (chosen) | No new dependency. TypeScript is the language of the UI, with its type check, lint, format check, and tests; Playwright, which the end-to-end tests use already, checks HTTP responses; and the container confines the code of the dependencies that it runs. Bash suits the scripts that run host tools, which the container cannot run; shellcheck and shfmt check them (`docs/conventions.md`, Shell Scripting), but they have no tests of their own, and CI exercises them |
| TypeScript in the tooling container for every check that needs nothing of the host | Typed and linted code for more of the tooling. A check of a file in a command or job that uses the container, such as a validator of what a build produces, could belong to either language, and such a validator would become a Playwright project among the end-to-end tests |
| Python, with its standard library only | Better than bash at JSON, HTTP, the cleanup of what a script started, and testing. A third language, whose checks would need further tools, such as Ruff and a type checker, and a CI job; a minimum Python version on every host; and a rewrite of working scripts, in which the code that runs host tools gets longer. Sentinel, a Python project, still writes most of its host orchestration in bash and uses Python for validators, such as its check of a Renovate lookup log |
| Python with uv and third-party packages | Third-party code on the host, which Development Environment excludes for npm, against a threat that applies to PyPI as well |
| Deno or Bun | A new runtime on every host. Deno's permissions cannot confine a script that runs Docker, whose access is equivalent to root on the host (Development Environment) |
| A Makefile, as Sentinel has | One entry point for every command, but a layer over the scripts and one more place that describes the commands |

**Rationale:** the tooling mostly orchestrates host tools, which bash
expresses directly. The logic that bash handled poorly, the checks of the
HTTP responses of the image and of the environments, needs no host access, so
it runs as typed and linted TypeScript in the container, where the code of
its dependencies is confined. Any other logic stays in bash, in the script or
library whose work needs it, so that each piece of tooling has one language
and one place. The decision is revisited when tooling logic other than these
checks grows too complex for bash.

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
request function for each operation, and the TanStack Query hooks.
`orval.config.ts` configures the generation, and the generated code is
committed in `src/api/generated/`; CI regenerates it and fails when the result
differs, so a change of the contract appears in the pull request diff (Backend
Contract). The client covers only the operations under `/api/v1/`: the
document also describes the probes `/health` and `/ready`, which the Sentinel
host does not route to the API (Same Origin). The requests use origin-relative
URLs under `/api/v1/` (Same Origin) and the browser's default same-origin
credentials, through one shared request function, in `src/api/request.ts`,
that turns every error response into an error, carrying Sentinel's `code` when
the response provides one (Sentinel `docs/api-spec.md`, Response Format).

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
| End-to-end tests and screenshots | Playwright, in Chromium and Firefox, against the production image and a Sentinel backend at the supported version (Development Environment, End-to-end environment); reference screenshots in Chromium |
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

**Screenshots in pull requests:** the screenshots that a pull request shows
(`docs/conventions.md`, Pull Request Requirements) are the reference
screenshots of the end-to-end tests, committed in `test/e2e/screenshots/`,
with which Playwright compares each screen on every run. A change that alters
a screen updates its references in the same pull request, whose diff shows
them before and after; a screen that changes while its reference does not
fails the tests, so they are also a visual regression test. The references
are taken in Chromium only, because each engine renders text differently;
Firefox runs the same tests without them.

| Option | Impact |
|---|---|
| **Committed reference screenshots, in Chromium** (chosen) | Visible in the pull request diff without uploads, write permissions, or services, and a visual regression test. Every intended visual change, and every update that changes the rendering, regenerates references, and the repository grows with them |
| References in Chromium and Firefox | Also catches regressions specific to Firefox, at twice the images and updates |
| CI posts the screenshots in a comment, or commits them to the branch | Needs write permission and somewhere to host the images, against the read-only workflows (`docs/deployment.md`, Workflow Conventions), and is delicate for pull requests from forks |
| Workflow artifacts | A download, not visible in the pull request |
| A preview deployment of each pull request | Needs a backend reachable from a shared network, which a dataset backend must not be (Development Environment) |

**Rationale:** the screenshots reach the pull request through the diff that
the owner reviews anyway, with no permission or service beyond those of the
tests, and they keep screens built in separate agent sessions from drifting
unnoticed.

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
| `@types/node` | Type check of the code that runs in Node.js, the end-to-end tests and the configuration of the tools, at the major version of the Node.js line | No |
| `vite`, `@vitejs/plugin-react` | Build and development server | No |
| `tailwindcss`, `@tailwindcss/vite` | Styling | No |
| `orval` | API client generation | No |
| `oxlint`, `oxlint-tsgolint` | Lint | No |
| `prettier` | Formatting | No |
| `vitest`, `@vitest/browser-playwright`, `vitest-browser-react`, `@vitest/coverage-istanbul` | Unit and component tests | No |
| `@playwright/test`, `@axe-core/playwright` | End-to-end and accessibility tests | No |
| Container image `mcr.microsoft.com/playwright` | Tooling image (Development Environment) | No |
| Container image `nginx/nginx-unprivileged` | Base of the released image (Packaging and Serving), and the reverse proxy of the end-to-end tests and the local preview (Development Environment) | No |
| Container images `ghcr.io/vulnwatch/sentinel` at the supported version, and the official `postgres` and `redis` images at the versions that Sentinel requires | Backend for local development, the end-to-end tests, and the local preview | No |

### Packaging and Serving

**Choice:** a release publishes `ghcr.io/vulnwatch/sentinel-aura`, an OCI
image that serves the production build with nginx, with its SBOM and signed
attestations (`docs/deployment.md`, Release Process). The image is built on
the official unprivileged nginx image, pinned by version and digest, runs as
a non-root user, and contains only nginx, its configuration, and the static
files. The `Containerfile` builds it from the production build, and
`nginx/default.conf` configures its server, which listens on port 8080; the
image declares the base image's user numerically, as `101:101`. On the
Sentinel host, the reverse proxy or ingress routes to this image every path
that is not `/api` or under `/api/` (Same Origin). The image:

- answers every path outside the build's asset directory that is not a file
  of the build, `/auth/callback` included, with the application's entry
  document, so that the application resolves the path;
- serves the content-hashed files of the asset directory with long-lived
  caching, answers a missing one with `404`, and serves the entry document
  with `Cache-Control: no-cache`, so that the browser revalidates it on every
  load and a new release takes effect at once;
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
only the routing of the host and the pass-through of the image's response
headers, which Sentinel requires (Same Origin; Security Headers).

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

`Permissions-Policy` leaves one feature enabled although the UI does not use
it yet: `aria-notify`, through which an accessibility library can make
assistive technologies announce changes. It gives a script no access to data
or devices, and disabling it would silence such announcements without an
error once a library adopts it.

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

No architecture decision is open. A decision that is not taken yet is listed
here, with who decides it and when, and every design that depends on it waits
for it. When this repository takes a decision, its entry moves to
Architecture Decisions; when Sentinel takes one, its entry is removed, and the
sections that depend on it state the outcome and cite Sentinel's section.
