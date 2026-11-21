import { expect, test } from "vitest";
import { ignoreReasonName } from "./ignore-reason";

// The names of the reasons of an ignored Ticket (docs/screens/ticket.md,
// Content, Details; Actions; Audit Log).

test.each([
  ["not_shipped", "Not shipped"],
  ["cve_rejected", "CVE rejected"],
  ["cna_policy", "CNA policy"],
  ["other", "Other"],
])("names the reason %s %s", (reason, name) => {
  expect(ignoreReasonName(reason)).toBe(name);
});

test.each([
  ["a reason that the pinned contract does not list", "fictional_reason"],
  ["a reason named as a member of every object", "constructor"],
])("gives %s as received", (_, reason) => {
  expect(ignoreReasonName(reason)).toBe(reason);
});
