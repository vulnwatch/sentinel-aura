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
- Agents read Sentinel's specifications from a read-only local clone, at the
  revision that `AGENTS.md` (Sentinel as an External Authority) selects.

## Hosting Constraints

Sentinel's contract fixes how the UI is hosted. Each constraint holds in every
environment unless it names one.

### Same Origin

- The UI is served from the same origin as the API: one host serves both, and
  its reverse proxy or ingress routes `/api` to Sentinel's backend (Sentinel
  `docs/deployment.md`, Pre-Production Checklist). The UI's own URLs therefore
  never start with `/api`.
- The UI addresses the API through origin-relative URLs under `/api/v1/`
  (Sentinel `docs/api-spec.md`, Base URL), never through a host name.
- Sentinel registers `/auth/callback` on the UI's origin as the address to
  which the identity provider returns the browser after SSO authentication,
  in local development on the port of the UI development server (Sentinel
  `docs/deployment.md`, IdP Client Registration (id.suse.com); Sentinel
  `docs/features/identity/sso-authentication.md`, Configuration). That URL is
  part of the contract: the host answers it with the UI.
- No component that serves the UI on the Sentinel host logs the `Cookie`
  request header, which carries the session token on every path of the host,
  the UI's paths included (Sentinel `docs/deployment.md`, Pre-Production
  Checklist; Sentinel `docs/features/identity/authentication.md`, Session
  cookie).

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
  `docs/features/identity/authentication.md`, Session cookie). Production
  serves the UI over HTTPS (Sentinel `docs/deployment.md`, Pre-Production
  Checklist); Local Development states the condition for the development
  origin.

### Cross-Origin Requests

- The UI does not use CORS in any environment. A browser client served from
  the API's origin needs no configuration, and `CORS_ORIGINS`, empty by
  default, lists only browser clients served from another origin (Sentinel
  `docs/configuration.md`, Application; Sentinel
  `docs/features/identity/authentication.md`, Cross-Origin Request
  Protection). The UI never needs an entry.
- Sentinel rejects every unsafe request, with any method other than `GET`,
  `HEAD`, and `OPTIONS`, that a browser sends for a page of another origin not
  listed in `CORS_ORIGINS`, with `403 AUTH_CROSS_ORIGIN_REJECTED` (Sentinel
  `docs/features/identity/authentication.md`, Cross-Origin Request
  Protection; Sentinel `docs/api-spec.md`, Cross-Origin Request Protection).
  Its decision reads the `Host`, `Origin`, and `Sec-Fetch-Site` request
  headers, so every reverse proxy in front of the API, in production and in
  local development, forwards them unchanged (Sentinel
  `docs/features/identity/authentication.md`, Cross-Origin Request
  Protection, Deployment Requirement).

### Local Development

- A development server on `localhost` serves the UI and proxies `/api` to a
  Sentinel backend at the supported version, so that the browser sees one
  origin, as in production. Its proxy follows Cross-Origin Requests: no CORS,
  and the `Host`, `Origin`, and `Sec-Fetch-Site` headers forwarded unchanged.
- Sentinel's SSO configuration for local development returns the browser to
  `http://localhost:{port}/auth/callback`, where `{port}` is the port of the UI
  development server (Sentinel `docs/deployment.md`, IdP Client Registration
  (id.suse.com)).
- The browser accepts the `Secure`, `__Host-` session cookie only from a
  secure context (Sentinel `docs/features/identity/authentication.md`, Session
  cookie). The development origin `http://localhost:{port}` is one only in a
  browser that treats `localhost` as a secure context, and the choice of the
  supported browsers verifies this for each of them (Open Decisions). An HTTPS
  development origin would not match the local redirect URI that Sentinel
  registers, so it requires a change in Sentinel first.

## Architecture Decisions

Each entry states the choice and its rationale. An entry that comes from Open
Decisions also states the options considered and their impact.

### Static Single-Page Application

The UI is a single-page application that the browser loads as static files. In
production it runs no server of its own: no server-side rendering, no
backend-for-frontend, and no API of its own. Serving the static files is the
only server-side task, and how it is done is an open decision (Open
Decisions).

**Rationale:** Sentinel is the only backend and the browser holds the session,
so the UI has no server-side state or logic to host. A server of the UI's own
would be one more component in front of the API that must meet the hosting
constraints, such as forwarding the request headers unchanged and not logging
the `Cookie` header, without adding any capability.

## Open Decisions

These decisions are not taken yet. Every design that depends on one of them
waits for it. When a decision is taken, its entry moves to Architecture
Decisions.

| Decision | Decided by | When |
|---|---|---|
| Technology stack: framework and language, libraries, build and test tooling, and supported browsers. The stack satisfies every constraint of this document, and for each supported browser the decision verifies the session cookie condition of Local Development | The repository owner, who approves the decision recorded in this document | Before any application code is written |
| Packaging and serving: how the static files are packaged and served on the Sentinel host | The repository owner, together with the technology stack. When serving the UI requires a change to a component of Sentinel's deployment, such as the routing of its reverse proxy or ingress, Sentinel's specifications state the requirement | With the technology stack; in Sentinel, before the UI is first packaged for deployment |
| Where the security headers of the UI's responses are set, such as the Content Security Policy, HSTS, `frame-ancestors`, and the Referrer Policy | The repository owner, together with the technology stack. When the chosen place is a component of Sentinel's deployment, such as its reverse proxy or ingress, Sentinel's specifications state the requirement | With the technology stack; in Sentinel, before the UI is first packaged for deployment |
| Public exposure of Sentinel's root paths. Sentinel's API serves its OpenAPI document at `/openapi.json` (Sentinel `docs/deployment.md`, API Documentation Publication) and its interactive documentation at `/docs` and `/redoc`, all at the site root outside `/api`, so a host that routes only `/api` to the backend does not expose them | Sentinel, through an issue in `vulnwatch/sentinel`, because these paths and their routing belong to Sentinel's API and deployment | Before the UI is first packaged for deployment |
