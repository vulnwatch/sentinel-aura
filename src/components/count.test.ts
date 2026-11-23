import { expect, test } from "vitest";
import { COUNT, counted } from "./count";

// A count as the UI writes it (docs/behaviors.md, Wording, Style).

const TICKETS = { one: "Ticket", other: "Tickets" };

test.each([
  [0, "0"],
  [42, "42"],
  [1250, "1,250"],
  [2_147_483_647, "2,147,483,647"],
])("writes %i with its thousands grouped with commas, as %j", (value, text) => {
  expect(COUNT.format(value)).toBe(text);
});

test("names one value in the singular", () => {
  expect(counted(1, TICKETS)).toBe("1 Ticket");
});

test.each([
  [0, "0 Tickets"],
  [2, "2 Tickets"],
  [1250, "1,250 Tickets"],
])("names %i values in the plural, as %j", (count, text) => {
  expect(counted(count, TICKETS)).toBe(text);
});
