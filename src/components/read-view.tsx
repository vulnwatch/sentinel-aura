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

interface UpdateFailedProps {
  error: unknown;
  // Sends the read again.
  onRetry: () => void;
}

// Above data that stays shown after a new read of it failed: a warning that
// says that it could not be updated, with the message of the failure, and,
// when the failure offers it, Try again below it, on the background of the
// screen or of its part (docs/behaviors.md, Where Errors Appear;
// docs/design-system.md, Messages). When the warning goes, the focus on Try
// again passes to the screen's heading.
function UpdateFailed({ error, onRetry }: UpdateFailedProps) {
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
        {`This couldn't be updated. ${presentation.message}`}
      </Message>
      {presentation.retry && (
        <div className="mt-2">
          <Button onPress={onRetry}>Try again</Button>
        </div>
      )}
    </div>
  );
}

interface DataProps<TData> {
  read: Read<TData>;
  children: (data: TData) => ReactNode;
}

// The data of a read in its place: the loading indicator while it waits, its
// error in place of the data, or the data, marked while other data loads, and
// below the warning of a new read that failed, which goes, with the data
// marked, while the data is read again. The error and the warning appear in a status region that is
// there before them, so that assistive technologies announce them without
// moving the focus (docs/behaviors.md, Accessibility, Announcements). When the
// data leaves the page while it holds the focus, such as data that a 403
// replaces, the focus moves to the screen's heading.
function Data<TData>({ read, children }: DataProps<TData>) {
  const failed = read.status === "error";
  const data = failed && replacesShownData(read.error) ? undefined : read.data;
  const onRetry = () => {
    retry(read);
  };
  let status: ReactNode;
  if (failed && data === undefined) {
    status = (
      <ErrorInPlace error={read.error} placement="part" onRetry={onRetry} />
    );
  } else if (failed && !read.isFetching) {
    status = <UpdateFailed error={read.error} onRetry={onRetry} />;
  }
  return (
    <div className="relative">
      {data !== undefined &&
        (read.isPlaceholderData || (failed && read.isFetching)) && (
          <UpdatingBar />
        )}
      <output className="block">{status}</output>
      {data === undefined ? (
        !failed && <Loading />
      ) : (
        <FocusHandOff>{children(data)}</FocusHandOff>
      )}
    </div>
  );
}

interface ScreenReadProps<TData> {
  // The read without which the screen shows nothing, such as the record of a
  // detail screen or the list of a list screen.
  read: Read<TData>;
  // The screen around the place of its data, given that place and the data
  // when it has arrived: its heading and controls, which show at once
  // (docs/behaviors.md, Loading). A heading that depends on the data names
  // the kind of screen until the data arrives.
  renderFrame: (place: ReactNode, data: TData | undefined) => ReactNode;
  children: (data: TData) => ReactNode;
}

// A screen that shows the data of one read (docs/behaviors.md, Where Errors
// Appear). When its first read fails, or a new read fails with a 403 or a
// 404, the error replaces the content of the screen, its heading and controls
// included. Once the screen has shown data, a read of other data for it, such
// as another page or filter of a list, fails in place of the data only.
// The screen starts again when it opens with other path parameters, such as
// another Ticket (src/router.ts). When an error replaces the screen while one
// of its elements holds the focus, the focus moves to the error's heading.
export function ScreenRead<TData>({
  read,
  renderFrame,
  children,
}: ScreenReadProps<TData>) {
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
  return (
    <FocusHandOff>
      {renderFrame(<Data read={read}>{children}</Data>, read.data)}
    </FocusHandOff>
  );
}

interface PartReadProps<TData> {
  // The read of one part of a screen, such as a section or a tab, whose
  // failure leaves the rest of the screen usable.
  read: Read<TData>;
  children: (data: TData) => ReactNode;
}

// A part of a screen that shows the data of one read, below the heading of
// the part (docs/behaviors.md, Where Errors Appear).
export function PartRead<TData>({ read, children }: PartReadProps<TData>) {
  return <Data read={read}>{children}</Data>;
}
