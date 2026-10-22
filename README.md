# sentinel-aura

Web user interface for [Sentinel](https://github.com/vulnwatch/sentinel), the
security update management platform for SUSE and openSUSE-based Linux
distributions. Sentinel provides the backend and the REST API; this repository
provides the browser interface built on that API.

## Project Status

This repository is being bootstrapped and is **not usable yet**: it contains
no application code. The technology stack is recorded in
[docs/architecture.md](docs/architecture.md#technology-stack).

The bootstrap and the roadmap are tracked in
[#7](https://github.com/vulnwatch/sentinel-aura/issues/7).

## Specification Boundary

[Sentinel](https://github.com/vulnwatch/sentinel) owns the domain and API
contract specifications, including the obligations that its contracts place on
clients, such as session cookie handling, error handling by the `code` field,
and non-disclosure semantics.

This repository owns the UI and its specifications: navigation, screens,
presentation, and client-side behavior. The UI uses Sentinel only through its
API, as defined by the OpenAPI document published with each Sentinel release
and by Sentinel's specifications. UI specifications never define backend
behavior: a capability that the UI needs and the API lacks is specified and
implemented in Sentinel first.

Client-side behavior that Sentinel's specifications already describe remains
authoritative there until a change moves it to this repository. New
client-side behavior is specified only here.

See the System Boundary section of Sentinel's
[architecture document](https://github.com/vulnwatch/sentinel/blob/master/docs/architecture.md#system-boundary).

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md).

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
