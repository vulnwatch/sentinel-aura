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
- **Dependency alerts**: GitHub Dependabot alerts, with Renovate raising fix pull requests
- **Code scanning**: GitHub CodeQL default setup
- **CI hardening**: workflows pin every action by commit SHA and run with least-privilege permissions; see [Workflow Conventions](docs/deployment.md#workflow-conventions)

Further measures for the UI stack, such as static analysis, dependency auditing, security headers, and release supply-chain artifacts, are added as the tooling of the chosen stack ([docs/architecture.md](docs/architecture.md#technology-stack)) is built.
