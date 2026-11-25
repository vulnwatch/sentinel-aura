// An EPSS percentile, from 0 to 1, cut to two decimals, such as 0.97 for
// 0.9712, so that it never shows more than its value: the explanation of a
// priority and the CVE of a Ticket show it alike (docs/design-system.md,
// Priority, Explanation; docs/screens/ticket.md, CVE). Its text with ten
// decimals leaves out the error of its binary representation, which would
// cut 0.29 to 0.28.
export function cutPercentile(value: number): string {
  const text = value.toFixed(10);
  return text.slice(0, text.indexOf(".") + 3);
}
