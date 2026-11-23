// A count as the UI writes it (docs/behaviors.md, Wording, Style): its
// thousands grouped with commas, such as "1,250", and the noun that follows
// it in the singular or the plural, such as "1 Ticket" and "2 Tickets".

// The format of a count.
export const COUNT = new Intl.NumberFormat("en-US");

// What a value is, in the singular and the plural, such as "package" and
// "packages".
export interface Noun {
  one: string;
  other: string;
}

// A number of values with their noun, such as "1 package" or "1,250
// packages".
export function counted(count: number, { one, other }: Noun): string {
  return `${COUNT.format(count)} ${count === 1 ? one : other}`;
}
