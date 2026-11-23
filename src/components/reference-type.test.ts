import { expect, test } from "vitest";
import { ReferenceTypeValue } from "../api/generated/model";
import { referenceTypeName } from "./reference-type";

// The names of the types of a reference of a Ticket (docs/behaviors.md,
// Domain Terms; Unknown Values; Sentinel
// docs/features/tickets/ticket-references.md, ReferenceType).

test("names each type of the pinned contract in sentence case", () => {
  expect(Object.values(ReferenceTypeValue).map(referenceTypeName)).toEqual([
    "Advisory",
    "Patch",
    "Issue",
    "Article",
  ]);
});

test("names the absence of a type Uncategorized", () => {
  expect(referenceTypeName(null)).toBe("Uncategorized");
});

test.each(["writeup", "uncategorized", "constructor", "__proto__"])(
  "shows %j, a type that the pinned contract does not list, as received",
  (type) => {
    expect(referenceTypeName(type)).toBe(type);
  },
);
