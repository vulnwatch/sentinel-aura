import { ApiError, NetworkError, UnreadableResponseError } from "./request";

// The presentation of every failure of a request that a screen does not
// handle specifically (docs/behaviors.md, Errors; docs/conventions.md, Error
// Codes and Messages). It decides by the HTTP status and Sentinel's code,
// never by detail, and shows no text of an error response. A status or code
// that the contract of the pinned version does not list for an operation
// gets the presentation of its status (Sentinel docs/api-spec.md, Client
// Tolerance of Non-Breaking Changes).

// A failure of a request: an error response, no response, or a successful
// response that the UI cannot read (src/api/request.ts).
export type RequestFailure = ApiError | NetworkError | UnreadableResponseError;

export function isRequestFailure(error: unknown): error is RequestFailure {
  return (
    error instanceof ApiError ||
    error instanceof NetworkError ||
    error instanceof UnreadableResponseError
  );
}

// What failed (docs/behaviors.md, Where Errors Appear; Retries and
// Unconfirmed Changes):
// - screen: a read in place of the content of a screen;
// - part: any other read, in place of a part of a screen or of its data, or
//   next to data that stays shown;
// - change: a change of Sentinel's data;
// - session: sign-in or sign-out, which are harmless to repeat.
export type FailureContext = "screen" | "part" | "change" | "session";

export interface FailurePresentation {
  // The heading in place of the content of a screen.
  heading: string;
  message: string;
  // The request identifier, shown after "Reference:", when the message has
  // a reference and the response carried an identifier.
  reference: string | undefined;
  // Whether the failure offers Try again: after a network failure, a 429, a
  // 5xx, or a successful response that the UI cannot read.
  retry: boolean;
}

// The page of a missing or inaccessible record, and of a path that matches
// no screen (docs/behaviors.md, Missing and Inaccessible Records).
export const NOT_FOUND = {
  heading: "Not found",
  message: "This page doesn't exist, or you don't have access to it.",
} as const;

const HEADING_NO_ACCESS = "No access";
const HEADING_NOT_LOADED = "This page couldn't be loaded";

const MESSAGE_NETWORK =
  "Sentinel can't be reached. Check your connection and try again.";
const MESSAGE_NOT_ACCEPTED = "Sentinel didn't accept this request.";
const MESSAGE_FORBIDDEN = "You don't have permission to do this.";
const MESSAGE_FORBIDDEN_SCREEN = "You don't have permission to view this page.";
const MESSAGE_GONE =
  "This no longer exists, or you no longer have access to it.";
const MESSAGE_CONFLICT =
  "This can't be done in the current state, which may have changed. Check it and try again.";
const MESSAGE_TOO_MANY = "Too many attempts. Try again later.";
const MESSAGE_INTERNAL =
  "Something went wrong in Sentinel. Try again, and if it happens again, report it with the reference below.";
// The same message for a response without a request identifier, such as one
// of a proxy in front of Sentinel, which promises no reference.
const MESSAGE_INTERNAL_WITHOUT_REFERENCE =
  "Something went wrong in Sentinel. Try again, and if it happens again, report it.";
const MESSAGE_UNAVAILABLE =
  "Sentinel isn't available right now. Try again later.";
const MESSAGE_UNCONFIRMED =
  "Sentinel didn't confirm this change. It may have taken effect: check before trying again.";

// The presentation of a failure in its context, or undefined for a 401,
// which shows no message: the session has ended (docs/behaviors.md, Session
// State).
export function presentFailure(
  failure: RequestFailure,
  context: FailureContext,
): FailurePresentation | undefined {
  if (failure instanceof NetworkError) {
    return {
      heading: HEADING_NOT_LOADED,
      message: context === "change" ? MESSAGE_UNCONFIRMED : MESSAGE_NETWORK,
      reference: undefined,
      retry: true,
    };
  }
  if (failure instanceof UnreadableResponseError) {
    return internal(failure.requestId, true);
  }
  return presentErrorResponse(failure, context);
}

function presentErrorResponse(
  { status, code, requestId }: ApiError,
  context: FailureContext,
): FailurePresentation | undefined {
  if (status === 401) {
    return undefined;
  }
  if (status >= 500) {
    // A change may have taken effect (Sentinel docs/api-spec.md,
    // Infrastructure Dependency Errors (HTTP 503)).
    if (context === "change") {
      return {
        heading: HEADING_NOT_LOADED,
        message: MESSAGE_UNCONFIRMED,
        reference: requestId,
        retry: true,
      };
    }
    return status === 500
      ? internal(requestId, true)
      : {
          heading: HEADING_NOT_LOADED,
          message: MESSAGE_UNAVAILABLE,
          reference: requestId,
          retry: true,
        };
  }
  switch (status) {
    case 403:
      // A fault in how the UI is served, not a missing permission
      // (docs/architecture.md, Cross-Origin Requests).
      if (code === "AUTH_CROSS_ORIGIN_REJECTED") {
        return internal(requestId, false);
      }
      return {
        heading: HEADING_NO_ACCESS,
        message:
          context === "screen" ? MESSAGE_FORBIDDEN_SCREEN : MESSAGE_FORBIDDEN,
        reference: undefined,
        retry: false,
      };
    case 404:
      return context === "screen"
        ? { ...NOT_FOUND, reference: undefined, retry: false }
        : notRetried(MESSAGE_GONE);
    case 409:
      return notRetried(MESSAGE_CONFLICT);
    case 429:
      return { ...notRetried(MESSAGE_TOO_MANY), retry: true };
    default:
      // Every other 4xx, 422 included: a form matches the field errors of
      // VALIDATION_ERROR to its fields itself. A status that is neither
      // successful nor an error is a response that the UI cannot read.
      return status >= 400
        ? notRetried(MESSAGE_NOT_ACCEPTED)
        : internal(requestId, true);
  }
}

// The message of a change that failed in the message area, with whether
// Sentinel left its outcome unknown, after a network failure or a 5xx, which
// shows as a warning rather than an error (docs/behaviors.md, Retries and
// Unconfirmed Changes; docs/design-system.md, Messages).
export interface ChangeFailurePresentation {
  message: string;
  reference: string | undefined;
  unconfirmed: boolean;
}

// The presentation of a change that failed, or undefined for a 401
// (presentFailure).
export function presentChangeFailure(
  failure: RequestFailure,
): ChangeFailurePresentation | undefined {
  const presentation = presentFailure(failure, "change");
  if (presentation === undefined) {
    return undefined;
  }
  return {
    message: presentation.message,
    reference: presentation.reference,
    unconfirmed:
      failure instanceof NetworkError ||
      (failure instanceof ApiError && failure.status >= 500),
  };
}

// The message of a refetch of a CVE that Sentinel answers with 503
// CVE_FETCH_FAILED: no enabled source can refetch the CVE, and Sentinel
// published nothing, so the change did not take effect (Sentinel
// docs/features/tickets/cve-tracking.md, Re-fetch CVE Data).
const MESSAGE_NO_REFETCHABLE_SOURCE = "No enabled source can refetch this CVE.";

// The presentation of a refetch of a CVE that failed (docs/screens/ticket.md,
// States): 503 CVE_FETCH_FAILED says that no source can refetch it, with the
// reference of a 5xx (docs/behaviors.md, Default Presentation by Status), and
// every other failure gets the presentation of a change.
export function presentRefetchFailure(
  failure: RequestFailure,
): ChangeFailurePresentation | undefined {
  if (
    failure instanceof ApiError &&
    failure.status === 503 &&
    failure.code === "CVE_FETCH_FAILED"
  ) {
    return {
      message: MESSAGE_NO_REFETCHABLE_SOURCE,
      reference: failure.requestId,
      unconfirmed: false,
    };
  }
  return presentChangeFailure(failure);
}

// The messages of the user field of Grant access, at the field
// (docs/screens/ticket.md, States): Sentinel knows no such user, or the user
// is inactive and holds no grant yet (Sentinel
// docs/features/tickets/tickets.md, Grant Access).
const MESSAGE_GRANT_USER_NOT_FOUND = "Sentinel doesn't know this user.";
const MESSAGE_GRANT_USER_INACTIVE =
  "This user is inactive, so they can't be granted access.";

// The error of the user field of Grant access that a failure states, or
// undefined for a failure of the form: 404 USER_NOT_FOUND and 409
// USER_INACTIVE.
export function grantAccessFieldError(
  failure: RequestFailure,
): string | undefined {
  if (!(failure instanceof ApiError)) {
    return undefined;
  }
  if (failure.status === 404 && failure.code === "USER_NOT_FOUND") {
    return MESSAGE_GRANT_USER_NOT_FOUND;
  }
  if (failure.status === 409 && failure.code === "USER_INACTIVE") {
    return MESSAGE_GRANT_USER_INACTIVE;
  }
  return undefined;
}

// The messages of the user field of the assignee of a Ticket, at the field
// (docs/screens/ticket.md, States): Sentinel knows no such user, the user is
// inactive, or the user cannot be the assignee of the Ticket (Sentinel
// docs/features/tickets/tickets.md, Assign Ticket; Reassignment).
const MESSAGE_ASSIGNEE_NOT_FOUND = "Sentinel doesn't know this user.";
const MESSAGE_ASSIGNEE_INACTIVE =
  "This user is inactive, so they can't be the assignee.";
const MESSAGE_ASSIGNEE_NOT_ELIGIBLE =
  "This user can't be the assignee of this Ticket.";

// The error of the user field of the assignee that a failure of Assign
// Ticket states, or undefined for a failure of the popover: 404
// USER_NOT_FOUND, 409 TICKET_ASSIGNEE_INACTIVE, and 400
// TICKET_ASSIGNEE_NOT_ELIGIBLE.
export function assigneeFieldError(
  failure: RequestFailure,
): string | undefined {
  if (!(failure instanceof ApiError)) {
    return undefined;
  }
  if (failure.status === 404 && failure.code === "USER_NOT_FOUND") {
    return MESSAGE_ASSIGNEE_NOT_FOUND;
  }
  if (failure.status === 409 && failure.code === "TICKET_ASSIGNEE_INACTIVE") {
    return MESSAGE_ASSIGNEE_INACTIVE;
  }
  if (
    failure.status === 400 &&
    failure.code === "TICKET_ASSIGNEE_NOT_ELIGIBLE"
  ) {
    return MESSAGE_ASSIGNEE_NOT_ELIGIBLE;
  }
  return undefined;
}

// Whether Assign Ticket failed because the assignee is not the one that the
// screen showed: 409 TICKET_ASSIGNEE_CHANGED, or 409
// TICKET_ASSIGNEE_NOT_CALLER, for a self-unassignment of a Ticket that
// another user took meanwhile (Sentinel docs/features/tickets/tickets.md,
// Reassignment, Expected assignee; Self-Unassignment).
export function isAssigneeChanged(failure: RequestFailure): boolean {
  return (
    failure instanceof ApiError &&
    failure.status === 409 &&
    (failure.code === "TICKET_ASSIGNEE_CHANGED" ||
      failure.code === "TICKET_ASSIGNEE_NOT_CALLER")
  );
}

// The message of the address field of a reference that another reference of
// the Ticket has, after normalization, 409 RESOURCE_CONFLICT (Sentinel
// docs/features/tickets/ticket-references.md, Add Reference; Update
// Reference).
const MESSAGE_REFERENCE_ADDRESS_TAKEN =
  "This Ticket already has a reference with this address.";

// The error of the address field of Add reference or Edit reference that a
// failure states, or undefined for a failure of the form.
export function referenceAddressError(
  failure: RequestFailure,
): string | undefined {
  return failure instanceof ApiError &&
    failure.status === 409 &&
    failure.code === "RESOURCE_CONFLICT"
    ? MESSAGE_REFERENCE_ADDRESS_TAKEN
    : undefined;
}

// The error of the vector field of Add SUSE assessment or Edit that a failure
// states, or undefined for a failure of the form: 422 CVSS_INVALID_VECTOR, a
// vector that passes the shape of the request but is not a complete CVSS
// Base vector of an accepted version, such as one with a Temporal metric
// (Sentinel docs/features/tickets/cvss-scoring.md, Input Rules; Set or Update
// SUSE CVSS Assessment). The version is the one that the dialog sets, such as
// "3.1".
export function cvssVectorError(
  failure: RequestFailure,
  version: string,
): string | undefined {
  return failure instanceof ApiError &&
    failure.status === 422 &&
    failure.code === "CVSS_INVALID_VECTOR"
    ? `Sentinel doesn't accept this vector. Enter a complete CVSS v${version} Base vector.`
    : undefined;
}

// The message of an exclusion or a restore of a record of the package tree of
// a Ticket that another user made meanwhile, which says the state that the
// record now has (docs/screens/ticket.md, States): 409 PACKAGE_ALREADY_EXCLUDED
// of an exclusion, and 422 PACKAGE_NOT_EXCLUDED of a restore, which concern
// the record's own marker (Sentinel docs/features/packages/package-model.md,
// Soft-Delete Package from Ticket; Restore Package; Soft-Delete Track;
// Restore Track; Soft-Delete Product; Restore Product). The subject names the
// record, such as "Package fictional-openssl". Every other failure, such as
// one of these codes from the other operation, has the presentation of a
// change.
export function presentMarkerConflict(
  failure: RequestFailure,
  change: "exclude" | "restore",
  subject: string,
): string | undefined {
  if (!(failure instanceof ApiError)) {
    return undefined;
  }
  if (
    change === "exclude" &&
    failure.status === 409 &&
    failure.code === "PACKAGE_ALREADY_EXCLUDED"
  ) {
    return `${subject} is already excluded.`;
  }
  if (
    change === "restore" &&
    failure.status === 422 &&
    failure.code === "PACKAGE_NOT_EXCLUDED"
  ) {
    return `${subject} is no longer excluded.`;
  }
  return undefined;
}

// The messages of the field of the original of Mark as duplicate, at the
// field (docs/screens/ticket.md, States): the original is the Ticket itself;
// Sentinel finds no such Ticket that the user can see, which it does not
// tell apart (Sentinel docs/api-spec.md, Anti-Enumeration Boundary); or the
// original is a duplicate itself, whose own original the user chooses
// instead (Sentinel docs/features/tickets/tickets.md, Mark Ticket as
// Duplicate), which the message names when the screen knows it, so that a
// user who cannot read the label of its option learns it too (WCAG 2.2,
// 3.3.3 Error Suggestion); a duplicate of the Ticket itself is reverted
// first.
export const MESSAGE_DUPLICATE_OF_ITSELF =
  "A Ticket can't be a duplicate of itself.";
// What the screen knows of the Ticket that a request named as the original:
// its identifier, by which the messages name it, since "this Ticket" is the
// Ticket that the request marks; the Ticket of which a read of the dialog
// shows it to be a duplicate, if any; and the Ticket that the request marks.
export interface NamedOriginal {
  original: string;
  duplicateOf: string | undefined;
  ticketId: string;
}

// The error of the field of the original that a failure of Mark Ticket as
// Duplicate states, or undefined for a failure of the form: 400
// TICKET_SELF_DUPLICATE, 404 TICKET_NOT_FOUND, and 409
// TICKET_DUPLICATE_TARGET_DUPLICATED, which names the original of the Ticket
// named when named gives it.
export function duplicateOriginalError(
  failure: RequestFailure,
  named: NamedOriginal,
): string | undefined {
  if (!(failure instanceof ApiError)) {
    return undefined;
  }
  if (failure.status === 400 && failure.code === "TICKET_SELF_DUPLICATE") {
    return MESSAGE_DUPLICATE_OF_ITSELF;
  }
  if (failure.status === 404 && failure.code === "TICKET_NOT_FOUND") {
    return `${named.original} doesn't exist, or you don't have access to it.`;
  }
  if (
    failure.status === 409 &&
    failure.code === "TICKET_DUPLICATE_TARGET_DUPLICATED"
  ) {
    if (named.duplicateOf === undefined) {
      return `${named.original} is a duplicate itself: choose its original instead.`;
    }
    return named.duplicateOf === named.ticketId
      ? `${named.original} is a duplicate of this Ticket: to make it the original, use Revert duplicate on ${named.original} first.`
      : `${named.original} is a duplicate of ${named.duplicateOf}: choose ${named.duplicateOf} instead.`;
  }
  return undefined;
}

// The message of Mark as duplicate when a duplicate of the Ticket was locked
// by another change, after which Sentinel changed nothing and asks the
// client to read again and retry (Sentinel docs/features/tickets/tickets.md,
// Mark-as-Duplicate Operation).
const MESSAGE_DUPLICATES_BUSY =
  "A duplicate of this Ticket was being changed at the same time, so Sentinel changed nothing. Try again.";

// The presentation of a failure of Mark as duplicate at the top of its form
// (docs/screens/ticket.md, States): 409
// TICKET_DUPLICATE_CONCURRENT_MODIFICATION as an error, and every other
// failure as a change.
export function presentMarkDuplicateFailure(
  failure: RequestFailure,
): ChangeFailurePresentation | undefined {
  if (
    failure instanceof ApiError &&
    failure.status === 409 &&
    failure.code === "TICKET_DUPLICATE_CONCURRENT_MODIFICATION"
  ) {
    return {
      message: MESSAGE_DUPLICATES_BUSY,
      reference: undefined,
      unconfirmed: false,
    };
  }
  return presentChangeFailure(failure);
}

// The presentation of a failure of Mark as duplicate that ends after the
// user left the screen, in the message area of the screen that the user is
// on (docs/screens/ticket.md, States): an error of its field as an error,
// which names the original, without the original of a duplicate, which the
// reads of the dialog told, and every other failure as in the dialog.
// Sentinel answers 404 TICKET_NOT_FOUND alike for the original and for the
// Ticket that the request marks (Sentinel docs/features/tickets/tickets.md,
// Mark Ticket as Duplicate), and no read of its screen then tells which, so
// the message names both.
export function presentLeftMarkDuplicateFailure(
  failure: RequestFailure,
  original: string,
): ChangeFailurePresentation | undefined {
  const atField = duplicateOriginalError(failure, {
    original,
    duplicateOf: undefined,
    ticketId: "",
  });
  if (atField === undefined) {
    return presentMarkDuplicateFailure(failure);
  }
  return {
    message:
      failure instanceof ApiError && failure.status === 404
        ? `This Ticket or the original ${original} doesn't exist, or you don't have access to it.`
        : atField,
    reference: undefined,
    unconfirmed: false,
  };
}

// The message of Reopen or Revert duplicate of a Ticket that another user,
// or Sentinel, took out of Ignored or Duplicated meanwhile, 409
// TICKET_INVALID_TRANSITION (Sentinel docs/features/tickets/tickets.md,
// Reopen Ticket; Revert Duplicate Status), such as "SNTL-17 is no longer
// Ignored.". Every other failure has the presentation of a change.
export function presentExitConflict(
  failure: RequestFailure,
  ticketId: string,
  status: "Ignored" | "Duplicated",
): string | undefined {
  return failure instanceof ApiError &&
    failure.status === 409 &&
    failure.code === "TICKET_INVALID_TRANSITION"
    ? `${ticketId} is no longer ${status}.`
    : undefined;
}

// The error of the reason of Ignore… that a failure of Ignore Ticket states,
// or undefined for a failure of the form: 409 TICKET_CVE_NOT_REJECTED, for
// the reason cve_rejected of a Ticket whose CVE is no longer rejected, which
// names the CVE (Sentinel docs/features/tickets/tickets.md, Ignore Ticket).
export function ignoreReasonError(
  failure: RequestFailure,
  cveId: string,
): string | undefined {
  return failure instanceof ApiError &&
    failure.status === 409 &&
    failure.code === "TICKET_CVE_NOT_REJECTED"
    ? `${cveId} is no longer rejected. Choose another reason.`
    : undefined;
}

// The presentation of a failure of Ignore… that ends after the user left the
// screen, in the message area of the screen that the user is on: the error
// of its reason as an error, and every other failure as a change.
export function presentLeftIgnoreFailure(
  failure: RequestFailure,
  cveId: string,
): ChangeFailurePresentation | undefined {
  const atField = ignoreReasonError(failure, cveId);
  return atField === undefined
    ? presentChangeFailure(failure)
    : { message: atField, reference: undefined, unconfirmed: false };
}

// The message of Set severity… on a Ticket that another user associated with
// a CVE meanwhile, 409 TICKET_SEVERITY_DERIVED: the CVSS assessments of its
// CVE then set its severity (Sentinel docs/features/tickets/tickets.md, Set
// Severity Manual; Severity Resolution), such as "SNTL-21 now has a CVE,
// whose CVSS assessments set its severity.". Every other failure has the
// presentation of a change.
export function presentSetSeverityFailure(
  failure: RequestFailure,
  ticketId: string,
): ChangeFailurePresentation | undefined {
  if (
    failure instanceof ApiError &&
    failure.status === 409 &&
    failure.code === "TICKET_SEVERITY_DERIVED"
  ) {
    return {
      message: `${ticketId} now has a CVE, whose CVSS assessments set its severity.`,
      reference: undefined,
      unconfirmed: false,
    };
  }
  return presentChangeFailure(failure);
}

// The message of a CVE ID that does not have the form of the contract,
// which the form of Associate CVE… checks before sending it, and which
// Sentinel answers with 422 CVE_INVALID_FORMAT (Sentinel
// docs/features/tickets/tickets.md, Associate CVE).
export const MESSAGE_CVE_ID_FORMAT = "Enter a CVE ID, such as CVE-2099-1234.";

// The canonical identity of a Ticket, as the link to a Ticket that another
// response names takes it (Sentinel docs/api-spec.md, Ticket Identifier
// Resolution).
const CANONICAL_TICKET_ID = /^SNTL-[1-9][0-9]*$/;

// The error of the CVE ID of Associate CVE… at its field: its message, and,
// for a CVE that another Ticket holds, that Ticket, which the message names
// last, before its period, and which the field shows as a link to it.
export interface CveIdError {
  message: string;
  holder: string | undefined;
}

// The error of the CVE ID that a failure of Associate CVE states, or
// undefined for a failure of the form: 422 CVE_INVALID_FORMAT, and 409
// TICKET_CVE_CONFLICT, for a CVE that another Ticket holds, which names that
// Ticket by the existing_ticket_id of the response when it has the form
// SNTL-{n}. That Ticket can be one that the user does not see, whose screen
// then shows Not found (Sentinel docs/features/tickets/tickets.md, CVE
// Resolution Behavior; Identifier Disclosure Boundary).
export function cveIdError(
  failure: RequestFailure,
  cveId: string,
): CveIdError | undefined {
  if (!(failure instanceof ApiError)) {
    return undefined;
  }
  if (failure.status === 422 && failure.code === "CVE_INVALID_FORMAT") {
    return { message: MESSAGE_CVE_ID_FORMAT, holder: undefined };
  }
  if (failure.status !== 409 || failure.code !== "TICKET_CVE_CONFLICT") {
    return undefined;
  }
  const holder =
    typeof failure.body === "object" &&
    failure.body !== null &&
    "existing_ticket_id" in failure.body &&
    typeof failure.body.existing_ticket_id === "string" &&
    CANONICAL_TICKET_ID.test(failure.body.existing_ticket_id)
      ? failure.body.existing_ticket_id
      : undefined;
  return holder === undefined
    ? { message: `${cveId} is already the CVE of another Ticket.`, holder }
    : { message: `${cveId} is already the CVE of ${holder}.`, holder };
}

// The presentation of a failure of Associate CVE… at the top of its form
// (docs/screens/ticket.md, States): 400 TICKET_CVE_ALREADY_SET, for a Ticket
// that has a CVE since the dialog opened, as an error that names no actor,
// since the association can be another user's or the user's own that
// Sentinel did not confirm; and every other failure as a change.
export function presentAssociateCveFailure(
  failure: RequestFailure,
  ticketId: string,
): ChangeFailurePresentation | undefined {
  if (
    failure instanceof ApiError &&
    failure.status === 400 &&
    failure.code === "TICKET_CVE_ALREADY_SET"
  ) {
    return {
      message: `${ticketId} already has a CVE.`,
      reference: undefined,
      unconfirmed: false,
    };
  }
  return presentChangeFailure(failure);
}

// The presentation of a failure of Associate CVE… that ends after the user
// left the screen, in the message area of the screen that the user is on:
// the error of its CVE ID as an error, and every other failure as in the
// form.
export function presentLeftAssociateCveFailure(
  failure: RequestFailure,
  cveId: string,
  ticketId: string,
): ChangeFailurePresentation | undefined {
  const atField = cveIdError(failure, cveId);
  return atField === undefined
    ? presentAssociateCveFailure(failure, ticketId)
    : { message: atField.message, reference: undefined, unconfirmed: false };
}

// The messages of the name field of Add package, at the field
// (docs/screens/ticket.md, States): SMELT maintains no package of the name,
// whose letter case counts; no Product that SMELT lists for it, in a
// codestream that Sentinel supports, is in Sentinel's current catalog; or the
// package is on the Ticket, directly excluded, which
// Restore includes again (Sentinel docs/features/packages/package-model.md,
// Add Package to Ticket; SMELT Query for Package Resolution).
const MESSAGE_PACKAGE_NOT_IN_SMELT =
  "SMELT doesn't maintain a package of this name. Check the name, whose letter case counts.";
const MESSAGE_PACKAGE_TARGETS_UNRESOLVED =
  "Sentinel can't add any of the Products that SMELT lists for this package, so it added nothing.";
const MESSAGE_PACKAGE_EXCLUDED =
  "This package is excluded from this Ticket: Show hidden shows it, and Restore in the menu of its actions includes it again.";

// The error of the name field of Add package that a failure of Add Package
// to Ticket states, or undefined for a failure of the form: 422
// PACKAGE_NOT_FOUND_IN_SMELT, 422 PACKAGE_TARGETS_UNRESOLVED, and 409
// PACKAGE_ALREADY_EXCLUDED.
export function packageNameError(failure: RequestFailure): string | undefined {
  if (!(failure instanceof ApiError)) {
    return undefined;
  }
  if (failure.status === 422 && failure.code === "PACKAGE_NOT_FOUND_IN_SMELT") {
    return MESSAGE_PACKAGE_NOT_IN_SMELT;
  }
  if (failure.status === 422 && failure.code === "PACKAGE_TARGETS_UNRESOLVED") {
    return MESSAGE_PACKAGE_TARGETS_UNRESOLVED;
  }
  if (failure.status === 409 && failure.code === "PACKAGE_ALREADY_EXCLUDED") {
    return MESSAGE_PACKAGE_EXCLUDED;
  }
  return undefined;
}

// The messages of Add package that Sentinel returns before any change, since
// SMELT and the Product catalog come before every write (Sentinel
// docs/features/packages/package-model.md, Adding Packages to a Ticket):
// SMELT gave no valid answer, or no complete Product catalog is published
// yet.
const MESSAGE_SMELT_UNAVAILABLE =
  "Sentinel couldn't get the tracks and Products of this package from SMELT, so it added nothing. Try again later.";
const MESSAGE_CATALOG_NOT_READY =
  "Sentinel hasn't loaded the Products from SMELT yet, so it added nothing. Try again later.";

// The presentation of a failure of Add package at the top of its form
// (docs/screens/ticket.md, States): 503 SMELT_UNAVAILABLE and 503
// PRODUCT_CATALOG_NOT_READY as errors with the reference of a 5xx, rather
// than as a change that Sentinel did not confirm, and every other failure as
// a change.
export function presentAddPackageFailure(
  failure: RequestFailure,
): ChangeFailurePresentation | undefined {
  if (failure instanceof ApiError && failure.status === 503) {
    const message =
      failure.code === "SMELT_UNAVAILABLE"
        ? MESSAGE_SMELT_UNAVAILABLE
        : failure.code === "PRODUCT_CATALOG_NOT_READY"
          ? MESSAGE_CATALOG_NOT_READY
          : undefined;
    if (message !== undefined) {
      return { message, reference: failure.requestId, unconfirmed: false };
    }
  }
  return presentChangeFailure(failure);
}

// The presentation of a failure of Add package that ends after the user left
// the screen, in the message area of the screen that the user is on
// (docs/screens/ticket.md, Actions): the errors of its field and those that
// Sentinel returns before any change as errors, the others as a change, each
// after the package that it concerns, such as "Package fictional-openssl: ",
// since the dialog that held the name is gone.
export function presentLeftAddPackageFailure(
  failure: RequestFailure,
  packageName: string,
): ChangeFailurePresentation | undefined {
  const atField = packageNameError(failure);
  const presentation =
    atField === undefined
      ? presentAddPackageFailure(failure)
      : { message: atField, reference: undefined, unconfirmed: false };
  return presentation === undefined
    ? undefined
    : {
        ...presentation,
        message: `Package ${packageName}: ${presentation.message}`,
      };
}

// Whether a read of the access grants of a Ticket failed because the Ticket
// is no longer confidential, 409 TICKET_NOT_CONFIDENTIAL, after which it has
// no grants (Sentinel docs/features/tickets/tickets.md, List Access Grants;
// Set Confidentiality).
export function isNotConfidential(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === "TICKET_NOT_CONFIDENTIAL"
  );
}

// Whether Set Coordinated Release Date refused an instant before the creation
// of the Ticket, 422 TICKET_COORDINATED_RELEASE_BEFORE_CREATION, which shows
// at the field (Sentinel docs/features/tickets/tickets.md, Set Coordinated
// Release Date).
export function isCoordinatedReleaseBeforeCreation(
  failure: RequestFailure,
): boolean {
  return (
    failure instanceof ApiError &&
    failure.status === 422 &&
    failure.code === "TICKET_COORDINATED_RELEASE_BEFORE_CREATION"
  );
}

// The presentation of a failure of Set Coordinated Release Date at the top of
// its form (docs/screens/ticket.md, States): 409 TICKET_NOT_CONFIDENTIAL, for
// a Ticket that is no longer confidential and has no Coordinated Release
// Date, as after another user made it non-confidential and removed its date
// meanwhile, whether the user set the date or removed it, as an error, since
// Sentinel then changed nothing (Sentinel
// docs/features/tickets/tickets.md, Set Coordinated Release Date); and every
// other failure as a change.
export function presentCoordinatedReleaseFailure(
  failure: RequestFailure,
  ticketId: string,
): ChangeFailurePresentation | undefined {
  if (isNotConfidential(failure)) {
    return {
      message: `${ticketId} is no longer confidential and has no Coordinated Release Date.`,
      reference: undefined,
      unconfirmed: false,
    };
  }
  return presentChangeFailure(failure);
}

// The message of a field error of a VALIDATION_ERROR response
// (docs/behaviors.md, Where Errors Appear).
export const MESSAGE_INVALID_VALUE = "This value isn't valid.";

export interface ValidationErrorFields<TField extends string> {
  // The fields of the form that an error of the response locates, in the
  // order of the form.
  fields: TField[];
  // Whether an error of the response matches no field of the form, or the
  // response locates none, which makes it an error of the form.
  unmatched: boolean;
}

// The fields of a form that the field errors of a VALIDATION_ERROR response
// locate, matched by their loc, the request body member of the field, as
// ["body", <field>] (docs/conventions.md, Error Codes and Messages; Sentinel
// docs/api-spec.md, Response Format). Every other error response locates no
// field.
export function validationErrorFields<TField extends string>(
  failure: RequestFailure,
  fields: readonly TField[],
): ValidationErrorFields<TField> {
  const located = new Set<TField>();
  let unmatched = false;
  const errors =
    failure instanceof ApiError &&
    failure.code === "VALIDATION_ERROR" &&
    typeof failure.body === "object" &&
    failure.body !== null &&
    "errors" in failure.body
      ? failure.body.errors
      : undefined;
  if (!Array.isArray(errors) || errors.length === 0) {
    return { fields: [], unmatched: true };
  }
  for (const error of errors) {
    const field = fieldOf(error, fields);
    if (field === undefined) {
      unmatched = true;
    } else {
      located.add(field);
    }
  }
  return { fields: fields.filter((field) => located.has(field)), unmatched };
}

// The messages of Sign in, which handles a 401 itself (docs/screens/sign-in.md,
// States): Sentinel answers every credential failure of local sign-in with a
// 401 (Sentinel docs/features/identity/local-authentication.md, Login). The
// read of the signed-in user answers a 401 whatever the cause (Sentinel
// docs/features/identity/authentication.md, Frontend session behavior); right
// after a successful sign-in, the likely cause is that the browser did not
// keep the session cookie.
const MESSAGE_SIGN_IN_REJECTED = "The username or password isn't correct.";
const MESSAGE_SESSION_NOT_KEPT =
  "Sentinel signed you in, but this browser didn't keep the session. Allow cookies for Sentinel, then sign in again.";

export interface MessagePresentation {
  message: string;
  // The request identifier, shown after "Reference:", when the message has a
  // reference and the response carried an identifier.
  reference: string | undefined;
}

// The message at the top of the Sign in form after a failure of the sign-in,
// or of the read of the signed-in user that follows it: a 401 as Sign in
// handles it, and every other failure as for sign-in (presentFailure).
export function presentSignInFailure(
  failure: RequestFailure,
  request: "sign-in" | "signed-in user",
): MessagePresentation {
  const presentation = presentFailure(failure, "session");
  if (presentation !== undefined) {
    return {
      message: presentation.message,
      reference: presentation.reference,
    };
  }
  // A 401, whatever its code: the only failure without a presentation.
  return {
    message:
      request === "sign-in"
        ? MESSAGE_SIGN_IN_REJECTED
        : MESSAGE_SESSION_NOT_KEPT,
    reference: undefined,
  };
}

function fieldOf<TField extends string>(
  error: unknown,
  fields: readonly TField[],
): TField | undefined {
  if (typeof error !== "object" || error === null || !("loc" in error)) {
    return undefined;
  }
  const { loc } = error;
  if (!Array.isArray(loc) || loc.length !== 2 || loc[0] !== "body") {
    return undefined;
  }
  const member: unknown = loc[1];
  return fields.find((field) => field === member);
}

function internal(
  requestId: string | undefined,
  retry: boolean,
): FailurePresentation {
  return {
    heading: HEADING_NOT_LOADED,
    message:
      requestId === undefined
        ? MESSAGE_INTERNAL_WITHOUT_REFERENCE
        : MESSAGE_INTERNAL,
    reference: requestId,
    retry,
  };
}

function notRetried(message: string): FailurePresentation {
  return {
    heading: HEADING_NOT_LOADED,
    message,
    reference: undefined,
    retry: false,
  };
}
