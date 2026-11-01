import { useState, type ReactNode } from "react";
import { isRequestFailure, presentFailure } from "../api/errors";
import { ApiError } from "../api/request";
import { ErrorInPlace } from "./error-in-place";
import { Loading, UpdatingBar } from "./loading";
import { Message } from "./message";

// A read that a screen shows, as a query hook of the generated client
// returns it (docs/conventions.md, Data Read from the API).
export interface Read<TData> {
  data: TData | undefined;
  error: unknown;
  status: "pending" | "error" | "success";
  // Whether data stays shown while other data loads, such as another page
  // of a list, which the query keeps with placeholderData.
  isPlaceholderData: boolean;
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
}

// Above data that stays shown after a new read of it failed: a warning that
// says that it could not be updated, with the message of the failure
// (docs/behaviors.md, Where Errors Appear; docs/design-system.md, Messages).
function UpdateFailed({ error }: UpdateFailedProps) {
  if (!isRequestFailure(error)) {
    throw error;
  }
  const presentation = presentFailure(error, "part");
  if (presentation === undefined) {
    return null;
  }
  return (
    <output className="mb-4 block">
      <Message tone="warning" reference={presentation.reference}>
        {`This couldn't be updated. ${presentation.message}`}
      </Message>
    </output>
  );
}

interface DataProps<TData> {
  read: Read<TData>;
  children: (data: TData) => ReactNode;
}

// The data of a read in its place: the loading indicator while it waits, its
// error in place of the data, or the data, marked while other data loads and
// below the warning of a new read that failed.
function Data<TData>({ read, children }: DataProps<TData>) {
  const failed = read.status === "error";
  if (read.data !== undefined && !(failed && replacesShownData(read.error))) {
    return (
      <div className="relative">
        {read.isPlaceholderData && <UpdatingBar />}
        {failed && <UpdateFailed error={read.error} />}
        {children(read.data)}
      </div>
    );
  }
  if (failed) {
    return (
      <ErrorInPlace
        error={read.error}
        placement="part"
        onRetry={() => {
          retry(read);
        }}
      />
    );
  }
  return <Loading />;
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
// another Ticket (src/router.ts).
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
  return renderFrame(<Data read={read}>{children}</Data>, read.data);
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
