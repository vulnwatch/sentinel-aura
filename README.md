<p align="center">
<picture>
<source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.svg">
<img src=".github/assets/banner.svg" alt="Sentinel Aura — Web interface for Linux vulnerability management" width="520">
</picture>
</p>

<p align="center">
<a href="https://github.com/vulnwatch/sentinel-aura/actions/workflows/ci.yml"><img src="https://github.com/vulnwatch/sentinel-aura/actions/workflows/ci.yml/badge.svg?branch=master" alt="CI"></a>
<a href="https://codecov.io/gh/vulnwatch/sentinel-aura"><img src="https://codecov.io/gh/vulnwatch/sentinel-aura/graph/badge.svg" alt="codecov"></a>
<a href="https://github.com/vulnwatch/sentinel-aura/releases"><img src="https://img.shields.io/github/v/release/vulnwatch/sentinel-aura" alt="Release"></a>
<a href="docs/behaviors.md#accessibility"><img src="https://img.shields.io/badge/accessibility-WCAG_2.2_AA-blue" alt="Accessibility: WCAG 2.2 AA"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License: Apache 2.0"></a>
</p>

Sentinel Aura is the web interface of
[Sentinel](https://github.com/vulnwatch/sentinel), the security update
management platform for SUSE and openSUSE-based Linux distributions. It brings
Sentinel's Tickets, with their CVEs, packages, and deadlines, to the browser,
for the people who work with them: the vulnerability analysts who triage and
follow their queues all day, the package maintainers who look for the fixes
that wait for them, and every colleague who needs SUSE's status for a CVE.

> [!NOTE]
> **Internal, non-commercial project.** Sentinel Aura is the web interface of
> Sentinel, an internal tool of the SUSE Security Team, published as open
> source. Neither is a commercial product: SUSE does not sell, market, or
> offer them as a product or service. They are not related to, affiliated
> with, or endorsed by any other product or company that uses the name
> Sentinel. All trademarks belong to their respective owners.

<p align="center">
<img src=".github/assets/screenshot-ticket-list.png" alt="The Ticket list of Sentinel Aura, in the light theme on the left and the dark theme on the right, split along a diagonal: the Tickets that need attention, the views of the list, and a page of Tickets with their CVE, packages, status, severity, priority, deadline, and assignee">
<br>
<sub>The Ticket list in the light and the dark theme, with fictional data from Sentinel's example dataset.</sub>
</p>

## Highlights

- **Accessible.** Designed to meet WCAG 2.2 at levels A and AA in both
  themes, and never to convey information by color alone
  ([Accessibility](#accessibility)).
- **Light and dark.** Follows the color scheme of the desktop, or the theme
  that each user chooses.
- **API only.** A static single-page application that reads and changes
  Sentinel's data only through its REST API, on the same origin, with no
  backend or server-side data store of its own.
- **Pinned to the contract.** Every release is built and tested against one
  exact Sentinel version, with an API client generated from that version's
  OpenAPI document.
- **Hardened.** Served by an unprivileged nginx image, under a strict Content
  Security Policy that requires Trusted Types.
- **Verifiable.** Every release publishes its image with a CycloneDX SBOM and
  signed SLSA build provenance
  ([Verifying a Release](docs/deployment.md#verifying-a-release)).

## Accessibility

Sentinel Aura is designed to meet
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) at levels A and AA, in the light and
the dark theme alike:

- **Checked on every change.** Every end-to-end test checks the states it
  shows against axe-core's WCAG 2.2 A and AA rules, under the light and the
  dark color scheme, and fails on any violation
  ([End-to-End Tests](docs/conventions.md#end-to-end-tests)); lint applies the
  accessibility rules of jsx-a11y to the code.
- **Contrast in both themes.** Every text has a contrast of at least 4.5:1,
  and every graphic needed to understand a screen at least 3:1, in each theme
  ([Contrast](docs/design-system.md#contrast)).
- **Never color alone.** A status, a severity, a priority, or a deadline
  always comes with a text or an icon, so it stays readable with any color
  vision.
- **Beyond automated checks.** Keyboard operation, focus, landmarks,
  announcements, reflow, and text resizing are requirements of every screen
  ([Accessibility](docs/behaviors.md#accessibility)).

<p align="center">
<picture>
<source media="(prefers-color-scheme: dark)" srcset=".github/assets/color-vision-dark.png">
<img src=".github/assets/color-vision.png" alt="Three rows of the Ticket list with typical color vision and with protanopia, deuteranopia, tritanopia, and achromatopsia: in each, every status, severity, priority, and deadline stays readable through its text" width="600">
</picture>
<br>
<sub>Rows of the Ticket list with typical color vision and with four color vision deficiencies, simulated by Chromium.</sub>
</p>

## Technology

| Concern | Technology |
|---|---|
| Language | TypeScript |
| UI framework | React |
| Routing and server state | TanStack Router, TanStack Query |
| Accessible components | React Aria Components |
| Styling | Tailwind CSS |
| Build | Vite |
| Tests | Vitest in browser mode, Playwright, axe-core |
| Serving | nginx, in an unprivileged OCI image |

[Technology Stack](docs/architecture.md#technology-stack) records each choice,
the options considered, and the rationale.

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | Scope, link to Sentinel's API contract, hosting constraints, and architecture decisions |
| [Screen Map](docs/screen-map.md) | Users and their tasks, screens and navigation, contract URLs, and roles |
| [Cross-Cutting Behaviors](docs/behaviors.md) | Session, preferences, errors, loading, dates, confirmations, accessibility, and wording |
| [Design System](docs/design-system.md) | Themes, colors and contrast, type, icons, layout, and interface patterns |
| [Screens](docs/screens/) | What each screen does, as built |
| [Conventions](docs/conventions.md) | Code, shell, Git, and specification-writing conventions |
| [Deployment](docs/deployment.md) | CI pipeline, dependency updates, release process, supported Sentinel versions, and release verification |

## Specification Boundary

[Sentinel](https://github.com/vulnwatch/sentinel) owns the domain and API
contract specifications, including the obligations that its contracts place on
clients, such as session cookie handling, error handling by the `code` field,
tolerance of non-breaking API changes, and non-disclosure semantics.

This repository owns the UI and its specifications: navigation, screens,
presentation, and client-side behavior. The UI uses Sentinel only through its
API, as defined by the OpenAPI document published with each Sentinel release
and by Sentinel's specifications. UI specifications never define backend
behavior: a capability that the UI needs and the API lacks is specified and
implemented in Sentinel first.

Client-side behavior is specified only here. A Sentinel specification may
justify a backend decision by what a client can do through the API; that
justification is rationale of the contract and prescribes no presentation.

See the System Boundary section of Sentinel's
[architecture document](https://github.com/vulnwatch/sentinel/blob/master/docs/architecture.md#system-boundary).
