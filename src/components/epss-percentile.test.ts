import { expect, test } from "vitest";
import { cutPercentile } from "./epss-percentile";

test.each([
  [0.95, "0.95"],
  [0.9599999, "0.95"],
  [0.99999, "0.99"],
  [1, "1.00"],
  [0, "0.00"],
  [0.3, "0.30"],
  // Below its decimal value in binary, as 0.29 * 100 is 28.999999999999996.
  [0.29, "0.29"],
])("cuts the EPSS percentile %s to two decimals, as %s", (value, text) => {
  expect(cutPercentile(value)).toBe(text);
});
