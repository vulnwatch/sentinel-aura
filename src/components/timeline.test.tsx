import { Gauge } from "lucide-react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { page, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { screenshot } from "../test-screenshot";
import { Timeline, TimelineObject, type TimelineEvent } from "./timeline";
import type { UserFields } from "./user";

// The audit log of one record as a timeline (docs/design-system.md,
// Timelines), at the browser's default text size, in the light theme. Its
// dates and times are local times of the browser, sent in UTC as the API
// sends them, so that the tests hold in every time zone.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

// The colors of docs/design-system.md (Color Tokens) in the light theme.
const FG = "rgb(31, 35, 40)";
const FG_MUTED = "rgb(89, 99, 110)";
const BORDER = "rgb(216, 222, 228)";
const BORDER_STRONG = "rgb(129, 139, 152)";

const ALICE: UserFields = {
  id: "00000000-0000-0000-0000-000000000002",
  username: "asmith",
  full_name: "Alice Smith",
  active: true,
  bot: false,
  avatar_url: null,
};

// A date and time of the API of a local time of the browser.
function at(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

// An event of the timeline, with the fields that a test sets: Alice Smith
// set a track from Analysis to Affected, without a comment.
function event(fields: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: "e1",
    at: at(2099, 11, 8, 14, 10),
    actor: ALICE,
    icon: Gauge,
    sentence: (
      <>
        set <TimelineObject>fictional-zlib · fles-16.0</TimelineObject> from
        Analysis to Affected
      </>
    ),
    ...fields,
  };
}

// The marker of an event, hidden from assistive technologies, which holds
// its icon: the first icon of its row, before the avatar of the actor.
function markerOf(item: Locator): Element {
  const icon = item.element().querySelector("svg");
  if (icon?.parentElement == null) {
    throw new Error("The event has no marker");
  }
  return icon.parentElement;
}

test("groups the events by the day of their date in the time zone of the browser, in their order, each day a level-two heading and its events a list", async () => {
  const screen = await render(
    <Timeline
      events={[
        event({ id: "e1", at: at(2099, 11, 8, 14, 10) }),
        event({ id: "e2", at: at(2099, 11, 8, 0, 5) }),
        event({ id: "e3", at: at(2099, 11, 7, 23, 59) }),
      ]}
    />,
  );

  const headings = screen.getByRole("heading", { level: 2 });
  expect(headings.elements().map((day) => day.textContent)).toEqual([
    "8 Nov 2099",
    "7 Nov 2099",
  ]);
  const day = headings.first().element();
  expect(day.querySelector("time")?.getAttribute("datetime")).toBe(
    "2099-11-08",
  );
  const style = getComputedStyle(day);
  expect([style.fontSize, style.fontWeight, style.color]).toEqual([
    "13px",
    "600",
    FG_MUTED,
  ]);
  const lists = screen.getByRole("list");
  expect(
    lists
      .elements()
      .map(
        (list) =>
          page.elementLocator(list).getByRole("listitem").elements().length,
      ),
  ).toEqual([2, 1]);
  // Each list 4 px below its heading, and each day 16 px below the events of
  // the day before.
  const first = lists.first().element().getBoundingClientRect();
  expect(first.top - day.getBoundingClientRect().bottom).toBe(4);
  expect(
    headings.last().element().getBoundingClientRect().top - first.bottom,
  ).toBe(16);
});

test("shows the time of each event in a time element with its local time, in text-13, fg-muted, with tabular figures, at the end of a column of 48 px", async () => {
  const instant = at(2099, 11, 8, 9, 5);
  const screen = await render(<Timeline events={[event({ at: instant })]} />);

  const time = screen.getByText("09:05", { exact: true }).element();
  expect(time.tagName).toBe("TIME");
  // The time alone, which the heading of its day completes with the date.
  expect(time.getAttribute("datetime")).toBe("09:05");
  const column = time.parentElement;
  if (column === null) {
    throw new Error("The time has no column");
  }
  const style = getComputedStyle(column);
  expect([
    style.fontSize,
    style.color,
    style.fontVariantNumeric,
    style.textAlign,
    column.getBoundingClientRect().width,
  ]).toEqual(["13px", FG_MUTED, "tabular-nums", "end", 48]);
  expect(time.getBoundingClientRect().right).toBe(
    column.getBoundingClientRect().right,
  );
});

test("starts the sentence with the actor in the full form at weight 500, then says what the actor did in text-14 and fg, with its objects at weight 500", async () => {
  const screen = await render(<Timeline events={[event()]} />);

  const sentence = screen.getByRole("paragraph");
  await expect
    .element(sentence)
    .toHaveTextContent(
      "Alice Smith set fictional-zlib · fles-16.0 from Analysis to Affected",
    );
  expect(sentence.element().textContent).not.toContain(" · Fictional");
  const style = getComputedStyle(sentence.element());
  expect([style.fontSize, style.color, style.fontWeight]).toEqual([
    "14px",
    FG,
    "400",
  ]);
  const name = sentence.getByText("Alice Smith", { exact: true }).element();
  expect(getComputedStyle(name).fontWeight).toBe("500");
  // The avatar of the full form, before the name.
  expect(sentence.element().querySelector("svg")).not.toBeNull();
  expect(
    getComputedStyle(
      sentence
        .getByText("fictional-zlib · fles-16.0", { exact: true })
        .element(),
    ).fontWeight,
  ).toBe("500");
  // 8 px of space above and below the row of a person's action.
  const row = getComputedStyle(screen.getByRole("listitem").element());
  expect([row.paddingTop, row.paddingBottom]).toEqual(["8px", "8px"]);
});

test("ends the sentence with its comment after a middle dot, in fg-muted, as received", async () => {
  const screen = await render(
    <Timeline
      events={[event({ comment: "Fictional comment, as received" })]}
    />,
  );

  const sentence = screen.getByRole("paragraph");
  await expect
    .element(sentence)
    .toHaveTextContent(
      "Alice Smith set fictional-zlib · fles-16.0 from Analysis to Affected · Fictional comment, as received",
    );
  const comment = sentence.getByText("· Fictional comment, as received");
  expect(getComputedStyle(comment.element()).color).toBe(FG_MUTED);
});

test("starts an event without an actor with System and the Sentinel mark, in text-13 and fg-muted, with 4 px of space above and below, and its marker in border and fg-muted", async () => {
  const screen = await render(
    <Timeline
      events={[event({ id: "e1" }), event({ id: "e2", actor: null })]}
    />,
  );
  const [person, system] = screen.getByRole("listitem").elements();
  if (person === undefined || system === undefined) {
    throw new Error("The timeline has no two events");
  }

  const sentence = page.elementLocator(system).getByRole("paragraph");
  await expect
    .element(sentence)
    .toHaveTextContent(
      "System set fictional-zlib · fles-16.0 from Analysis to Affected",
    );
  // The Sentinel mark, in place of an avatar.
  expect(sentence.element().querySelector("svg")).not.toBeNull();
  const style = getComputedStyle(sentence.element());
  expect([style.fontSize, style.color]).toEqual(["13px", FG_MUTED]);
  const row = getComputedStyle(system);
  expect([row.paddingTop, row.paddingBottom]).toEqual(["4px", "4px"]);
  const marker = getComputedStyle(markerOf(page.elementLocator(system)));
  expect([marker.borderTopColor, marker.color]).toEqual([BORDER, FG_MUTED]);
  const personMarker = getComputedStyle(markerOf(page.elementLocator(person)));
  expect([personMarker.borderTopColor, personMarker.color]).toEqual([
    BORDER_STRONG,
    FG,
  ]);
});

test("marks each event with the icon of its kind at 14 px, in a round marker of 24 px hidden from assistive technologies, 12 px after the time and 12 px before the sentence", async () => {
  const screen = await render(<Timeline events={[event()]} />);
  const icon = await render(<Gauge />);
  const item = screen.getByRole("listitem");

  const marker = markerOf(item);

  expect(marker.querySelector("svg")?.innerHTML).toBe(
    icon.container.querySelector("svg")?.innerHTML,
  );
  expect(marker.getAttribute("aria-hidden")).toBe("true");
  const box = marker.getBoundingClientRect();
  expect([box.width, box.height]).toEqual([24, 24]);
  expect(getComputedStyle(marker).borderTopLeftRadius).not.toBe("0px");
  expect(marker.querySelector("svg")?.getBoundingClientRect().width).toBe(14);
  const time = item.getByText("14:10", { exact: true }).element();
  const sentence = item.getByRole("paragraph").element();
  expect(box.left - time.getBoundingClientRect().right).toBe(12);
  expect(sentence.getBoundingClientRect().left - box.right).toBe(12);
});

test("joins the markers of a day with a vertical line in border, behind them, and leaves a day of one event without it", async () => {
  const screen = await render(
    <Timeline
      events={[
        event({ id: "e1", at: at(2099, 11, 8, 14, 10) }),
        event({ id: "e2", at: at(2099, 11, 8, 9, 5) }),
        event({ id: "e3", at: at(2099, 11, 7, 9, 5) }),
      ]}
    />,
  );
  const [first, second, alone] = screen.getByRole("listitem").elements();
  if (first === undefined || second === undefined || alone === undefined) {
    throw new Error("The timeline has no three events");
  }
  const day = screen.getByRole("list").first();
  const picture = await screenshot(day);
  const origin = day.element().getBoundingClientRect();
  const top = markerOf(page.elementLocator(first)).getBoundingClientRect();
  const bottom = markerOf(page.elementLocator(second)).getBoundingClientRect();
  const middle = (top.left + top.right) / 2 - origin.left;

  // Between the two markers of the day, and not above the first.
  expect(picture.at(middle, (top.bottom + bottom.top) / 2 - origin.top)).toBe(
    "#d8dee4",
  );
  expect(picture.at(middle, top.top - origin.top - 4)).not.toBe("#d8dee4");

  const single = screen.getByRole("list").last();
  const lonely = await screenshot(single);
  const box = markerOf(page.elementLocator(alone)).getBoundingClientRect();
  const singleOrigin = single.element().getBoundingClientRect();
  expect(
    lonely.at(
      (box.left + box.right) / 2 - singleOrigin.left,
      box.bottom - singleOrigin.top + 4,
    ),
  ).not.toBe("#d8dee4");
});

test("names a value that is not a date and time as received, as a day of its own", async () => {
  const screen = await render(
    <Timeline
      events={[
        event({ id: "e1", at: at(2099, 11, 8, 14, 10) }),
        event({ id: "e2", at: "not a date" }),
      ]}
    />,
  );

  expect(
    screen
      .getByRole("heading", { level: 2 })
      .elements()
      .map((day) => day.textContent),
  ).toEqual(["8 Nov 2099", "not a date"]);
  const time = screen.getByRole("listitem").last().getByText("not a date");
  expect(time.element().tagName).toBe("TIME");
});

test("wraps a sentence, also within a value without a place to break, such as an address, where its line is too narrow", async () => {
  const address = `https://bugzilla.example.com/${"fictional_path_".repeat(10)}`;
  const screen = await render(
    <div className="w-80">
      <Timeline
        events={[
          event({
            sentence: (
              <>
                added the reference <TimelineObject>{address}</TimelineObject>
              </>
            ),
          }),
        ]}
      />
    </div>,
  );

  const sentence = screen.getByRole("paragraph").element();
  expect(sentence.scrollWidth).toBe(sentence.clientWidth);
  expect(sentence.getBoundingClientRect().height).toBeGreaterThan(24);
  expect(sentence.getBoundingClientRect().right).toBeLessThanOrEqual(
    screen.container.getBoundingClientRect().left + 320,
  );
});
