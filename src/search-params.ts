import { z } from "zod";

// How the router reads and writes the search parameters of a URL
// (docs/conventions.md, Routes): as the browser's URLSearchParams do, each
// value as its text, and a parameter with several values given once for each,
// such as status=new&status=analysis, never as JSON. A URL then stays readable
// in a bookmark or a shared link, and a filter with several values reads as
// Sentinel's repeatable filters do (Sentinel docs/api-spec.md, Enum Filter
// Validation).

// The search parameters of a URL as the router reads them: the text of the
// value of each, or the texts of its values when the URL gives it more than
// once. A route's schema reads its parameters from them.
export type SearchParams = Record<string, string | string[]>;

function valueOf(values: string[]): string | string[] {
  const [only, ...others] = values;
  return only !== undefined && others.length === 0 ? only : values;
}

// Reads the search parameters of a URL, such as "?view=new&page=2". A
// parameter named after a member of an object's prototype, such as
// __proto__, is a parameter like any other.
export function parseSearch(searchStr: string): SearchParams {
  const values = new Map<string, string[]>();
  for (const [key, value] of new URLSearchParams(searchStr)) {
    const given = values.get(key);
    if (given === undefined) {
      values.set(key, [value]);
    } else {
      given.push(value);
    }
  }
  return Object.fromEntries(
    [...values].map(([key, given]) => [key, valueOf(given)]),
  );
}

// The text of a value of a search parameter, or undefined for a value that a
// URL does not write, such as undefined.
function textOf(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (
    (typeof value === "number" && Number.isFinite(value)) ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return undefined;
}

// Writes search parameters as a URL gives them, such as "?view=new&page=2",
// or "" without any: a parameter with several values once for each, in their
// order, and none that is undefined.
export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    const values: unknown[] = Array.isArray(value) ? value : [value];
    for (const item of values) {
      const text = textOf(item);
      if (text !== undefined) {
        params.append(key, text);
      }
    }
  }
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

function canonicalSearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams(stringifySearch(search));
  params.sort();
  return params.toString();
}

// Whether two searches give a URL the same parameters with the same values,
// in the same order for each parameter, whichever parameter comes first and
// whether a value is its text or a number, such as page "2" in a URL and 2
// in a route's schema.
export function sameSearch(
  first: Record<string, unknown>,
  second: Record<string, unknown>,
): boolean {
  return canonicalSearch(first) === canonicalSearch(second);
}

// The number of a whole-number parameter, as a URL writes it: digits without
// a sign or a leading zero. Any other text stays as it is, so that the
// schema does not accept it.
function wholeNumberOf(value: unknown): unknown {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value)
    ? Number(value)
    : value;
}

// A search parameter whose value is a whole number from 1 to max, such as the
// page of a list: any other value counts as absent (docs/behaviors.md,
// Invalid Search Parameters). A link gives it as a number.
export function wholeNumberParam(max: number) {
  return z
    .preprocess(
      (value: number | undefined) => wholeNumberOf(value),
      z.int().min(1).max(max).optional(),
    )
    .catch(undefined);
}

// The values that the parameter gives among the known ones, once each, in the
// order of the known ones, or undefined when it gives none of them.
function knownValuesOf(
  known: readonly string[],
  value: unknown,
): string[] | undefined {
  const given: unknown[] = Array.isArray(value) ? value : [value];
  const kept = known.filter((item) => given.includes(item));
  return kept.length === 0 ? undefined : kept;
}

// A search parameter with one or more of the known values, such as the
// statuses of a filter of a list, given once for each value. It keeps the
// values that it knows, once each and in their order, which makes one URL of
// each set of values, and drops the others (docs/behaviors.md, Invalid Search
// Parameters). A link gives its values as an array.
export function valueListParam<const T extends readonly [string, ...string[]]>(
  known: T,
) {
  return z
    .preprocess(
      (value: T[number][] | undefined) => knownValuesOf(known, value),
      z.array(z.enum(known)).optional(),
    )
    .catch(undefined);
}

// The last page of a list that Sentinel accepts (Sentinel docs/api-spec.md,
// Pagination).
export const LAST_PAGE = 2_147_483_647;

// The longest search term that Sentinel accepts (Sentinel docs/api-spec.md,
// Query Parameter Length Limit).
export const SEARCH_MAX_LENGTH = 500;

// The search term of a list, without its surrounding whitespace: at most the
// length that Sentinel accepts and without U+0000, which Sentinel rejects
// (Sentinel docs/api-spec.md, Query Parameter Length Limit; Inadmissible
// Characters in Request Input). An empty term counts as absent.
export const searchTermParam = z
  .string()
  .trim()
  .max(SEARCH_MAX_LENGTH)
  .refine((term) => !term.includes("\u0000"))
  .transform((term) => (term === "" ? undefined : term))
  .optional()
  .catch(undefined);
