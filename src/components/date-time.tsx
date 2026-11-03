// A date and time of the API (docs/behaviors.md, Dates and Times, Display).

// The parts of a date and time in the time zone of the browser: the English
// abbreviations of the months, such as Sep, which the British English format
// writes Sept, and the 24-hour clock with two digits, 00 to 23.
const PARTS = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// A date and time of the API, which Sentinel sends in UTC, in the time zone
// of the browser, as 9 Oct 2026, 14:05: the day without a leading zero, the
// abbreviation of the month, the year, and the time on the 24-hour clock,
// without the time zone. A value that is not a date and time shows as
// received.
export function formatDateTime(value: string): string {
  const instant = Date.parse(value);
  if (Number.isNaN(instant)) {
    return value;
  }
  const parts = new Map(
    PARTS.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.get(type) ?? "";
  return `${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")}`;
}

interface DateTimeProps {
  // A date and time of the API, in UTC.
  value: string;
}

// A date and time of the API, in the time zone of the browser
// (formatDateTime), with tabular figures, so that dates align in a column
// (docs/design-system.md, Type Scale).
export function DateTime({ value }: DateTimeProps) {
  return (
    <time dateTime={value} className="tabular-nums">
      {formatDateTime(value)}
    </time>
  );
}
