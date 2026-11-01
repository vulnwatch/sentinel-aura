// Temporary: code that no test runs, which shows that the tests fail below
// the minimum coverage (docs/conventions.md, Checks).
export function coverageProbe(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    total += value > 0 ? value : -value;
  }
  return total;
}
