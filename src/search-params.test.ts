import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  parseSearch,
  sameSearch,
  stringifySearch,
  valueListParam,
  wholeNumberParam,
} from "./search-params";

// How the router reads and writes the search parameters of a URL, and the
// schemas of the parameters that a route accepts (docs/conventions.md,
// Routes; docs/behaviors.md, Invalid Search Parameters).

describe("parseSearch", () => {
  test("reads each value as its text", () => {
    expect(parseSearch("?page=2&search=42")).toEqual({
      page: "2",
      search: "42",
    });
  });

  test("never reads a value as JSON", () => {
    expect(parseSearch("?search=%2242%22&overdue=true")).toEqual({
      search: '"42"',
      overdue: "true",
    });
  });

  test("reads a parameter given more than once as its values, in their order", () => {
    expect(
      parseSearch("?status=new&view=all&status=analysis&status=analysis"),
    ).toEqual({ status: ["new", "analysis", "analysis"], view: "all" });
  });

  test("reads the parameters with or without the leading question mark", () => {
    expect(parseSearch("view=new&page=2")).toEqual({ view: "new", page: "2" });
  });

  test("decodes a plus as a space and percent-encoded characters", () => {
    expect(parseSearch("?search=fictional+curl%26openssl%2F%C3%A9")).toEqual({
      search: "fictional curl&openssl/é",
    });
  });

  test("reads an empty value as an empty text", () => {
    expect(parseSearch("?search=")).toEqual({ search: "" });
  });

  test.each(["", "?"])("reads no parameters from %j", (searchStr) => {
    expect(parseSearch(searchStr)).toEqual({});
  });

  test("reads a parameter named __proto__ as a parameter like any other, without changing the prototype", () => {
    const search = parseSearch("?__proto__=fictional&view=new");

    expect(Object.entries(search)).toEqual([
      ["__proto__", "fictional"],
      ["view", "new"],
    ]);
    expect(Object.hasOwn(search, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(search)).toBe(Object.prototype);
  });
});

describe("stringifySearch", () => {
  test("writes text as it is, and numbers and booleans as their text", () => {
    expect(
      stringifySearch({ view: "new", page: 2, ratio: 0.5, overdue: true }),
    ).toBe("?view=new&page=2&ratio=0.5&overdue=true");
    expect(stringifySearch({ archived: false })).toBe("?archived=false");
  });

  test("writes a parameter with several values once for each, in their order", () => {
    expect(
      stringifySearch({ status: ["new", "analysis"], page: 3, severity: [] }),
    ).toBe("?status=new&status=analysis&page=3");
  });

  test("writes no value that a URL does not give", () => {
    expect(
      stringifySearch({
        missing: undefined,
        empty: null,
        nan: Number.NaN,
        infinite: Number.POSITIVE_INFINITY,
        record: { view: "new" },
        status: [undefined, "new", null, { view: "new" }, "analysis"],
        view: "all",
      }),
    ).toBe("?status=new&status=analysis&view=all");
  });

  test.each([
    ["no parameters", {}],
    ["parameters without a value that a URL gives", { page: undefined }],
  ])("writes nothing for %s", (_, search) => {
    expect(stringifySearch(search)).toBe("");
  });

  test("encodes spaces and special characters as the browser's URLSearchParams do", () => {
    expect(stringifySearch({ search: "fictional curl&openssl=1/é?" })).toBe(
      "?search=fictional+curl%26openssl%3D1%2F%C3%A9%3F",
    );
    expect(stringifySearch({ "fictional key": "" })).toBe("?fictional+key=");
  });

  test("writes what parseSearch reads back", () => {
    const search = {
      view: "all",
      search: 'fictional "curl" & openssl',
      status: ["new", "analysis"],
      page: "2",
    };

    expect(parseSearch(stringifySearch(search))).toEqual(search);
    expect(
      stringifySearch(parseSearch("?status=new&status=analysis&page=2")),
    ).toBe("?status=new&status=analysis&page=2");
  });
});

describe("sameSearch", () => {
  test("holds for the same parameters given in another order", () => {
    expect(
      sameSearch(
        { view: "new", status: ["new", "analysis"], page: "2" },
        { page: "2", status: ["new", "analysis"], view: "new" },
      ),
    ).toBe(true);
  });

  test("holds for a value as its text and as a number", () => {
    expect(sameSearch({ page: "2" }, { page: 2 })).toBe(true);
  });

  test("ignores parameters without a value", () => {
    expect(
      sameSearch({ page: "2", search: undefined }, { page: "2", view: null }),
    ).toBe(true);
  });

  test.each([
    [
      "the values of a parameter in another order",
      { status: ["new", "analysis"] },
      { status: ["analysis", "new"] },
    ],
    ["another value", { page: "2" }, { page: "3" }],
    ["another parameter", { page: "2" }, { view: "2" }],
    ["one more value", { status: "new" }, { status: ["new", "analysis"] }],
  ])("fails for %s", (_, first, second) => {
    expect(sameSearch(first, second)).toBe(false);
  });
});

describe("wholeNumberParam", () => {
  const schema = z.object({ page: wholeNumberParam(100) });

  test.each([
    ["1", 1],
    ["42", 42],
    ["100", 100],
    [7, 7],
  ])("accepts %j as %i", (value, page) => {
    expect(schema.parse({ page: value })).toEqual({ page });
  });

  test.each([
    ["zero", "0"],
    ["a leading zero", "01"],
    ["a negative number", "-1"],
    ["a sign", "+1"],
    ["a fraction", "1.5"],
    ["an exponent", "1e2"],
    ["surrounding whitespace", " 2"],
    ["a word", "two"],
    ["an empty text", ""],
    ["a value above the maximum", "101"],
    ["a number above the maximum", 101],
    ["a number that is not whole", 1.5],
    ["a number below one", 0],
    ["a value given more than once", ["2", "3"]],
    ["a value given once in a list", ["2"]],
    ["no value", undefined],
  ])("reads %s as absent", (_, value) => {
    expect(schema.parse({ page: value }).page).toBeUndefined();
  });

  test("reads a missing parameter as absent", () => {
    expect(schema.parse({}).page).toBeUndefined();
  });
});

describe("valueListParam", () => {
  const schema = z.object({
    status: valueListParam(["new", "analysis", "resolved"]),
  });

  test("reads a single value as a list of it", () => {
    expect(schema.parse({ status: "analysis" })).toEqual({
      status: ["analysis"],
    });
  });

  test("keeps the known values once each, in the order of the known ones", () => {
    expect(
      schema.parse({
        status: ["resolved", "fictional", "new", "resolved", "new"],
      }),
    ).toEqual({ status: ["new", "resolved"] });
  });

  test("ignores the values that are not text", () => {
    expect(
      schema.parse({ status: [1, null, { status: "new" }, "analysis"] }),
    ).toEqual({ status: ["analysis"] });
  });

  test.each([
    ["an unknown value", "fictional"],
    ["unknown values", ["fictional", "NEW"]],
    ["an empty list", []],
    ["no value", undefined],
  ])("reads %s as absent", (_, value) => {
    expect(schema.parse({ status: value }).status).toBeUndefined();
  });

  test("reads a missing parameter as absent", () => {
    expect(schema.parse({}).status).toBeUndefined();
  });
});
