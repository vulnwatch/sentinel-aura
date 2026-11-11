import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { dayOf, formatTime } from "./date-time";
import { Actor, type UserFields } from "./user";

// The audit log of one record as a timeline (docs/design-system.md,
// Timelines).

export interface TimelineEvent {
  // The key of the event among the events of the timeline.
  id: string;
  // When it happened, a date and time of the API.
  at: string;
  // Its actor, or null for an event without one, which shows as System.
  actor: UserFields | null;
  // The icon of its kind.
  icon: LucideIcon;
  // What the actor did, after the actor.
  sentence: ReactNode;
  // A comment of the event that the sentence does not already say, or
  // undefined.
  comment?: string | undefined;
}

interface TimelineObjectProps {
  children: ReactNode;
}

// An object of the sentence of an event, such as a package with its track, a
// Product, a reference, or a user, at weight 500, so that the eye finds what
// changed; its values, such as a status, stay at weight 400.
export function TimelineObject({ children }: TimelineObjectProps) {
  return <span className="font-medium">{children}</span>;
}

interface RowProps {
  event: TimelineEvent;
  first: boolean;
  last: boolean;
}

// The line that joins the markers of a day, behind them: the part of a row,
// from the middle of the marker of the first row of the day to the middle of
// the marker of its last row, across the rows between them.
function lineOf(system: boolean, first: boolean, last: boolean): string {
  if (first && last) {
    return "hidden";
  }
  if (first) {
    return `bottom-0 ${system ? "top-4" : "top-5"}`;
  }
  if (last) {
    return `top-0 ${system ? "h-4" : "h-5"}`;
  }
  return "inset-y-0";
}

// An event: its time at the end of a column of 48 px; 12 px later its
// marker, a round box of 24 px with the icon of its kind, hidden from
// assistive technologies, which read the sentence; 12 px later its sentence,
// which starts with its actor and wraps, also within a value without a place
// to break, such as an address, and ends with its comment after " · ", in
// fg-muted. An event without an actor is in text-13 and fg-muted, with its
// marker in border and fg-muted, and 4 px of space above and below it rather
// than 8 px, so that the actions of people stand out from their automatic
// consequences.
function Row({ event, first, last }: RowProps) {
  const system = event.actor === null;
  const Icon = event.icon;
  return (
    <li
      className={`relative flex items-start gap-3 ${system ? "py-1" : "py-2"}`}
    >
      <span
        aria-hidden
        className={`absolute start-[71px] w-0.5 bg-border ${lineOf(system, first, last)}`}
      />
      <span className="w-12 shrink-0 text-end text-13 leading-6 text-fg-muted tabular-nums">
        <time dateTime={formatTime(event.at)}>{formatTime(event.at)}</time>
      </span>
      <span
        aria-hidden
        className={`relative flex size-6 shrink-0 items-center justify-center rounded-full border bg-surface ${system ? "border-border text-fg-muted" : "border-border-strong text-fg"}`}
      >
        <Icon className="size-3.5" />
      </span>
      <p
        className={`min-w-0 leading-6 wrap-anywhere ${system ? "text-13 text-fg-muted" : "text-14 text-fg"}`}
      >
        <span className="font-medium">
          <Actor actor={event.actor} />
        </span>{" "}
        {event.sentence}
        {event.comment !== undefined && (
          <span className="text-fg-muted"> · {event.comment}</span>
        )}
      </p>
    </li>
  );
}

interface Day {
  date: string;
  text: string;
  events: TimelineEvent[];
}

// The events grouped by the day of their date in the time zone of the
// browser, in their order.
function daysOf(events: readonly TimelineEvent[]): Day[] {
  const days: Day[] = [];
  for (const event of events) {
    const { date, text } = dayOf(event.at);
    const day = days.at(-1);
    if (day?.date === date) {
      day.events.push(event);
    } else {
      days.push({ date, text, events: [event] });
    }
  }
  return days;
}

interface TimelineProps {
  // The events, newest first.
  events: readonly TimelineEvent[];
}

// The events grouped by day: each day a level-two heading in text-13, weight
// 600, fg-muted, 16 px below the events of the day before, and its events a
// list 4 px below it, joined by a vertical line of 2 px in border behind
// their markers.
export function Timeline({ events }: TimelineProps) {
  return (
    <div className="flex flex-col gap-4">
      {daysOf(events).map((day) => (
        <div key={day.date}>
          <h2 className="text-13 font-semibold text-fg-muted">
            <time dateTime={day.date}>{day.text}</time>
          </h2>
          <ol className="mt-1">
            {day.events.map((event, index) => (
              <Row
                key={event.id}
                event={event}
                first={index === 0}
                last={index === day.events.length - 1}
              />
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
