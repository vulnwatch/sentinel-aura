import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import {
  CalendarDate,
  DateTime,
  dayOf,
  formatDate,
  formatDateTime,
  formatTime,
} from "./date-time";

// A date and time of the API (docs/behaviors.md, Dates and Times, Display),
// in the time zone of the browser, whatever it is: each instant of the tests
// is a local time, sent in UTC as the API sends it.

test.each([
  [new Date(2026, 9, 9, 14, 5, 9), "9 Oct 2026, 14:05"],
  [new Date(2026, 8, 30, 0, 7), "30 Sep 2026, 00:07"],
  [new Date(2027, 0, 1, 9, 0), "1 Jan 2027, 09:00"],
  [new Date(2026, 11, 31, 23, 59, 59), "31 Dec 2026, 23:59"],
])("shows %s as %s", (date, text) => {
  expect(formatDateTime(date.toISOString())).toBe(text);
});

test("reads the microseconds that the API sends", () => {
  const instant = new Date(2026, 9, 9, 14, 5, 9, 123);
  const value = instant.toISOString().replace("Z", "456Z");

  expect(formatDateTime(value)).toBe("9 Oct 2026, 14:05");
});

test("shows a value that is not a date and time as received", () => {
  expect(formatDateTime("not a date")).toBe("not a date");
});

test.each([
  [new Date(2026, 9, 9, 14, 5, 9), "14:05"],
  [new Date(2026, 8, 30, 0, 7), "00:07"],
  [new Date(2027, 0, 1, 9, 0), "09:00"],
  [new Date(2026, 11, 31, 23, 59, 59), "23:59"],
])("shows the time alone of %s as %s", (date, text) => {
  expect(formatTime(date.toISOString())).toBe(text);
});

test("reads the microseconds that the API sends for the time alone", () => {
  const instant = new Date(2026, 9, 9, 14, 5, 9, 123);
  const value = instant.toISOString().replace("Z", "456Z");

  expect(formatTime(value)).toBe("14:05");
});

test("shows the time alone of a value that is not a date and time as received", () => {
  expect(formatTime("not a date")).toBe("not a date");
});

test.each([
  [new Date(2026, 9, 9, 14, 5), "2026-10-09", "9 Oct 2026"],
  [new Date(2026, 8, 30, 0, 0), "2026-09-30", "30 Sep 2026"],
  [new Date(2026, 11, 31, 23, 59, 59, 999), "2026-12-31", "31 Dec 2026"],
  [new Date(2027, 0, 1, 0, 0), "2027-01-01", "1 Jan 2027"],
])(
  "gives %s the day of the time zone of the browser, %s, named %s",
  (date, day, text) => {
    expect(dayOf(date.toISOString())).toEqual({ date: day, text });
  },
);

test("gives a value that is not a date and time a day of its own, named as received", () => {
  expect(dayOf("not a date")).toEqual({
    date: "not a date",
    text: "not a date",
  });
});

test.each([
  ["2026-10-09", "9 Oct 2026"],
  ["2026-09-30", "30 Sep 2026"],
  ["2027-01-01", "1 Jan 2027"],
  ["2026-12-31", "31 Dec 2026"],
])("shows the date %s as %s", (value, text) => {
  expect(formatDate(value)).toBe(text);
});

test.each(["2026-02-30", "2026-13-01", "2026-10-09T14:05:09Z", "not a date"])(
  "shows %s, which is not a date, as received",
  (value) => {
    expect(formatDate(value)).toBe(value);
  },
);

test("shows a date and time in a time element, with tabular figures", async () => {
  const value = new Date(2026, 9, 9, 14, 5).toISOString();
  const screen = await render(<DateTime value={value} />);
  const time = screen.getByText("9 Oct 2026, 14:05").element();

  expect(time.tagName).toBe("TIME");
  expect(time.getAttribute("datetime")).toBe(value);
  expect(getComputedStyle(time).fontVariantNumeric).toBe("tabular-nums");
});

test("shows a date without a time in a time element, as the API returns it, with tabular figures", async () => {
  const screen = await render(<CalendarDate value="2026-10-09" />);
  const time = screen.getByText("9 Oct 2026").element();

  expect(time.tagName).toBe("TIME");
  expect(time.getAttribute("datetime")).toBe("2026-10-09");
  expect(getComputedStyle(time).fontVariantNumeric).toBe("tabular-nums");
});
