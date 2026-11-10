import { useRef, useState, type ReactNode } from "react";
import { isRequestFailure, presentFailure } from "../api/errors";
import { ApiError } from "../api/request";
import { Button } from "./button";
import { ErrorInPlace } from "./error-in-place";
import { Loading, UpdatingBar } from "./loading";
import { Message } from "./message";
import { FocusHandOff, useFocusHeadingOnRemoval } from "./screen-heading";

// A read that a screen shows, as a query hook of the generated client
// returns it (docs/conventions.md, Data Read from the API).
export interface Read<TData> {
  data: TData | undefined;
  error: unknown;
  status: "pending" | "error" | "success";
  // Whether data stays shown while other data loads, such as another page
  // of a list, which the query keeps with placeholderData.
  isPlaceholderData: boolean;
  // Whether the read is being sent, also again after it failed.
  isFetching: boolean;
  refetch: () => unknown;
}

// A 403 or a 404 of a new read replaces the data that stays shown as for the
// first read, because the user may no longer see it (docs/behaviors.md,
// Where Errors Appear).
function replacesShownData(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 403 || error.status === 404)
  );
}

function retry(read: Read<unknown>) {
  void read.refetch();
}

// The warning above data that stays shown after a new read of it failed,
// with the message of the failure.
function updateFailedText(message: string): string {
  return `This couldn't be updated. ${message}`;
}

interface UpdateFailedProps {
  error: unknown;
  // Sends the read again.
  onRetry: () => void;
  // The text of the warning, given the message of the failure.
  text?: (message: string) => string;
}

// Above data that stays shown after a new read of it failed: a warning that
// says that it could not be updated, with the message of the failure, and,
// when the failure offers it, Try again below it, on the background of the
// screen or of its part (docs/behaviors.md, Where Errors Appear;
// docs/design-system.md, Messages). When the warning goes, the focus on Try
// again passes to the screen's heading.
function UpdateFailed({
  error,
  onRetry,
  text = updateFailedText,
}: UpdateFailedProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusHeadingOnRemoval(ref);
  if (!isRequestFailure(error)) {
    throw error;
  }
  const presentation = presentFailure(error, "part");
  if (presentation === undefined) {
    return null;
  }
  return (
    <div ref={ref} className="mb-4">
      <Message tone="warning" reference={presentation.reference}>
        {text(presentation.message)}
      </Message>
      {presentation.retry && (
        <div className="mt-2">
          <Button onPress={onRetry}>Try again</Button>
        </div>
      )}
    </div>
  );
}

// The data that the place of a read shows: the data that has arrived, also
// while other data loads, but none after a 403 or a 404, which replaces it.
function dataShown<TData>(read: Read<TData>): TData | undefined {
  return read.status === "error" && replacesShownData(read.error)
    ? undefined
    : read.data;
}

// What the place of the data of a read shows, which a place arranges, such as
// Data or the frame of a table (src/components/data-table.tsx).
export interface DataPlace<TData> {
  // The data that shows (dataShown), or undefined.
  data: TData | undefined;
  // In place of the data: the error of a read that failed without data to
  // show, or null.
  failure: ReactNode;
  // Above the data that stays shown: the warning of a new read of it that
  // failed, which goes while the data is read again, or null.
  warning: ReactNode;
  // Whether the place waits for its data, and so shows the loading
  // indicator.
  waiting: boolean;
  // Whether the data that shows is marked as being updated: while other data
  // loads, and while it is read again after a read of it failed.
  updating: boolean;
}

// What the place of the data of a read says of the failure of the read, as
// the status region of the place announces it: the message of the error in
// place of the data, or the warning above data that stays shown, or "" when
// it shows neither (dataPlace). A screen whose status regions are out of
// reach of assistive technologies, such as behind a modal popover, announces
// it there instead.
export function placeMessage<TData>(read: Read<TData>): string {
  if (read.status !== "error" || !isRequestFailure(read.error)) {
    return "";
  }
  const message = presentFailure(read.error, "part")?.message;
  if (message === undefined) {
    return "";
  }
  if (dataShown(read) === undefined) {
    return message;
  }
  return read.isFetching ? "" : updateFailedText(message);
}

// What the place of the data of a read shows (docs/behaviors.md, Where Errors
// Appear; Loading).
export function dataPlace<TData>(read: Read<TData>): DataPlace<TData> {
  const failed = read.status === "error";
  const data = dataShown(read);
  const onRetry = () => {
    retry(read);
  };
  return {
    data,
    failure:
      failed && data === undefined ? (
        <ErrorInPlace error={read.error} placement="part" onRetry={onRetry} />
      ) : null,
    warning:
      failed && data !== undefined && !read.isFetching ? (
        <UpdateFailed error={read.error} onRetry={onRetry} />
      ) : null,
    waiting: data === undefined && !failed,
    updating:
      data !== undefined &&
      (read.isPlaceholderData || (failed && read.isFetching)),
  };
}

// What a read that only adds marks to data that another read shows gives
// its place, such as the tracks of a package tree that wait for the
// signed-in user (docs/behaviors.md, Where Errors Appear).
export interface MarksPlace<TData> {
  // The data of the marks, or undefined while no mark shows: until the read
  // arrives, and after a 403 or a 404, which removes the marks.
  marks: TData | undefined;
  // Above the data that the marks mark, which stays shown and usable: the
  // warning of a read of the marks that failed, which goes while the read is
  // sent again, or null.
  warning: ReactNode;
  // Whether the marks, which stay shown after a later read of them failed,
  // are read again, and so are marked as being updated (UpdatingBar).
  updating: boolean;
}

// What the warning of a failed read of marks says, before the message of the
// failure.
export interface MarksWarnings {
  // Before the read has shown its marks, such as "The tracks that wait for
  // you couldn't be shown."
  notShown: string;
  // Once it has, such as "The tracks that wait for you couldn't be updated."
  notUpdated: string;
}

// The marks of a read and the warning of its failure: before the read has
// shown its marks, a warning that says what couldn't be shown, followed by
// the message of the failure, and Try again when the failure offers it; once
// it has, a later read of them is a new read of the same data, whose failure
// keeps the marks and says what couldn't be updated, unless it is a 403 or a
// 404, which removes them as for the first read. The marks that stay shown
// are marked as being updated while they are read again.
export function marksPlace<TData>(
  read: Read<TData>,
  { notShown, notUpdated }: MarksWarnings,
): MarksPlace<TData> {
  const marks = dataShown(read);
  const onRetry = () => {
    retry(read);
  };
  const failed = read.status === "error";
  let warning: ReactNode = null;
  if (failed && !read.isFetching) {
    const what = marks === undefined ? notShown : notUpdated;
    warning = (
      <UpdateFailed
        error={read.error}
        onRetry={onRetry}
        text={(message) => `${what} ${message}`}
      />
    );
  }
  return {
    marks,
    warning,
    updating: failed && marks !== undefined && read.isFetching,
  };
}

interface DataProps<TData> {
  read: Read<TData>;
  children: (data: TData) => ReactNode;
  // Whether the place is a value of a description list (Loading).
  inValue?: boolean;
}

// The data of a read in its place: the loading indicator while it waits, its
// error in place of the data, or the data, marked while other data loads. A
// new read that failed shows its warning above the data, which goes while the
// data is read again, marked meanwhile. The error and the warning appear in a
// status region that is there before them, so that assistive technologies
// announce them without moving the focus (docs/behaviors.md, Accessibility,
// Announcements). When the data leaves the page while it holds the focus,
// such as data that a 403 replaces, the focus moves to the screen's heading.
function Data<TData>({ read, children, inValue = false }: DataProps<TData>) {
  const place = dataPlace(read);
  return (
    <div className="relative">
      {place.updating && <UpdatingBar />}
      <output className="block">{place.failure ?? place.warning}</output>
      {place.data === undefined ? (
        place.waiting && <Loading inValue={inValue} />
      ) : (
        <FocusHandOff>{children(place.data)}</FocusHandOff>
      )}
    </div>
  );
}

type ScreenReadProps<TData> = {
  // The read without which the screen shows nothing, such as the record of a
  // detail screen or the list of a list screen.
  read: Read<TData>;
  // The screen around the place of its data, given that place and the data
  // when it has arrived: its heading and controls, which show at once
  // (docs/behaviors.md, Loading). A heading that depends on the data names
  // the kind of screen until the data arrives.
  renderFrame: (place: ReactNode, data: TData | undefined) => ReactNode;
} & (
  | {
      // The data in its place, as Data shows it.
      children: (data: TData) => ReactNode;
      renderPlace?: never;
    }
  | {
      // The place of the data itself, given the read, for a place that
      // arranges what it shows otherwise (dataPlace), such as the frame of a
      // table.
      renderPlace: (read: Read<TData>) => ReactNode;
      children?: never;
    }
);

// A screen that shows the data of one read (docs/behaviors.md, Where Errors
// Appear). When its first read fails, or a new read fails with a 403 or a
// 404, the error replaces the content of the screen, its heading and controls
// included. Once the screen has shown data, a read of other data for it, such
// as another page or filter of a list, fails in place of the data only.
// The screen starts again when it opens with other path parameters, such as
// another Ticket (src/router.ts). When an error replaces the screen while one
// of its elements holds the focus, the focus moves to the error's heading.
export function ScreenRead<TData>(props: ScreenReadProps<TData>) {
  const { read, renderFrame } = props;
  const [shownData, setShownData] = useState(false);
  if (read.status === "success" && !read.isPlaceholderData && !shownData) {
    setShownData(true);
  }
  const failed =
    read.status === "error" &&
    (read.data === undefined ? !shownData : replacesShownData(read.error));
  if (failed) {
    return (
      <ErrorInPlace
        error={read.error}
        placement="screen"
        onRetry={() => {
          retry(read);
        }}
      />
    );
  }
  const place =
    props.renderPlace === undefined ? (
      <Data read={read}>{props.children}</Data>
    ) : (
      props.renderPlace(read)
    );
  return <FocusHandOff>{renderFrame(place, read.data)}</FocusHandOff>;
}

interface PartReadProps<TData> {
  // The read of one part of a screen, such as a section or a tab, whose
  // failure leaves the rest of the screen usable.
  read: Read<TData>;
  children: (data: TData) => ReactNode;
  // Whether the part is a value of a description list, such as a field of
  // the details of a record with a read of its own.
  inValue?: boolean;
}

// A part of a screen that shows the data of one read, below the heading of
// the part (docs/behaviors.md, Where Errors Appear).
export function PartRead<TData>({
  read,
  children,
  inValue = false,
}: PartReadProps<TData>) {
  return (
    <Data read={read} inValue={inValue}>
      {children}
    </Data>
  );
}
