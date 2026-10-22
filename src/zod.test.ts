import { expect, test } from "vitest";
import { z } from "zod";
import "./zod";

test("disables the JIT of Zod", () => {
  expect(z.config().jitless).toBe(true);
});
