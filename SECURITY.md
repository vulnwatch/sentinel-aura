# Security Policy

## Supported Versions

sentinel-aura has no release yet.
Once releases exist, security fixes are applied to the latest release only,
and this section will list the supported versions.

## Reporting a Vulnerability

If you discover a security vulnerability in sentinel-aura, please report it responsibly.
**Do not open a public GitHub issue for security vulnerabilities.**

### How to report

Send an email to **security@suse.com** (or **security@suse.de**) with:

- A description of the vulnerability
- Steps to reproduce the issue, including the browser and its version
- The affected version(s) or commit
- Any potential impact assessment

We strongly encourage encrypting your report with the SUSE Security Team GPG key.
Note that GPG encryption does not cover the email subject or names of attached files — avoid putting confidential information there.

The current GPG key and full reporting guidelines are published at:
<https://www.suse.com/support/security/contact/>

### What to expect

The SUSE Security Team will review and address the reported vulnerability.
Please refer to the [SUSE Security Contacts](https://www.suse.com/support/security/contact/) page for the official acknowledgment policy and response timelines.

### Scope

The following are in scope for security reports:

- Cross-site scripting (stored, reflected, or DOM-based), including unsafe rendering of data received from the Sentinel API
- Session handling flaws, such as exposing the session to scripts or failing to end it on logout
- Cross-site request forgery or other cross-origin attacks that make the UI act on a user's behalf
- Clickjacking and missing or weak security headers on the served UI
- Open redirects and unsafe navigation
- Sensitive data exposure in the browser (browser storage, logs, URLs, or error messages)
- Insecure default configurations
- Dependency vulnerabilities with a demonstrated exploit path in the UI

### Out of scope

- Vulnerabilities in the Sentinel backend and API: they follow the
  [Sentinel security policy](https://github.com/vulnwatch/sentinel/blob/master/SECURITY.md),
  which uses the same reporting channel
- Vulnerabilities in dependencies without a demonstrated impact on sentinel-aura
- Issues that require a compromised browser, a malicious browser extension, or physical access to the user's device
- Self-XSS that requires the victim to paste code into the browser's developer tools
- Social engineering attacks

## Security Measures

The repository currently has the following measures enabled:

- **Secret detection**: GitHub secret scanning with push protection, and an optional gitleaks scan in the local pre-commit hook
- **Dependency alerts**: GitHub Dependabot alerts, with Renovate raising fix pull requests for direct dependencies and lock file maintenance covering transitive ones; see [Dependency Updates](docs/deployment.md#dependency-updates)
- **Dependency audit**: `npm audit signatures`, which verifies the registry signatures and provenance attestations of the installed packages, and `npm audit`, which reports their known vulnerabilities, run in CI on every change to the dependencies and block it on any finding; see [Workflow Inventory](docs/deployment.md#workflow-inventory)
- **Code scanning**: GitHub CodeQL default setup, for the JavaScript and TypeScript of the UI and for the workflows
- **CI hardening**: workflows pin every action by commit SHA and run with least-privilege permissions; see [Workflow Conventions](docs/deployment.md#workflow-conventions)
- **Isolated tooling**: every Node.js command, locally and in CI, runs in a disposable Docker container with the invoking user's IDs, without capabilities, and unable to gain privileges, that receives only the repository, mounted read-only except the outputs and the files that the command changes by design, and the directory of its dependencies, with no other part of the home directory and no credentials; see [Development Environment](docs/architecture.md#development-environment). The checks and tests also run without network access; see [Development Setup](CONTRIBUTING.md#development-setup)
- **npm hardening**: a committed lockfile with exact versions, blocked install scripts, a seven-day minimum release age that Renovate's routine updates also wait for, no dependencies from Git or URLs, and a layout that rejects undeclared imports; see [Build Tool, Package Manager, and Node.js](docs/architecture.md#build-tool-package-manager-and-nodejs) and [Dependency Updates](docs/deployment.md#dependency-updates)
- **Static analysis of the UI code**: Oxlint with type-aware, React, and accessibility rules, which rejects `dangerouslySetInnerHTML` and evaluated code; see [Code Conventions](docs/conventions.md#code-conventions)
- **Security headers**: the image that serves the UI sends, on every response, a strict Content Security Policy that requires Trusted Types and forbids framing, together with `X-Content-Type-Options`, `Referrer-Policy`, cross-origin opener and resource policies, and a `Permissions-Policy` that disables the browser features that the UI does not use; CI checks them; see [Security Headers](docs/architecture.md#security-headers)
- **Minimal, unprivileged image**: the image runs nginx as a numeric non-root user and adds to the official unprivileged nginx image only its server configuration and the production build, without Node.js, which CI checks; see [Packaging and Serving](docs/architecture.md#packaging-and-serving)
- **Image vulnerability scan**: a weekly Trivy scan of the image's operating system packages, which tracks fixable HIGH and CRITICAL vulnerabilities in a `security` issue; see [Workflow Inventory](docs/deployment.md#workflow-inventory)

Further measures for the UI stack, such as release supply-chain artifacts, are added as the tooling of the chosen stack ([docs/architecture.md](docs/architecture.md#technology-stack)) is built.
