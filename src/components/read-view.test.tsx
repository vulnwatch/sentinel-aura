import {
  keepPreviousData,
  QueryClientProvider,
  useQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { CatchBoundary } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { DialogTrigger } from "react-aria-components";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { announcements } from "../test-announcements";
import { Announcer } from "./announcer";
import {
  ApiError,
  NetworkError,
  UnreadableResponseError,
} from "../api/request";
import { createQueryClient } from "../query-client";
import { Button } from "./button";
import { InfoPopover, PopoverTitle } from "./info-popover";
import { Loading, UpdatingBar } from "./loading";
import {
  marksPlace,
  PartRead,
  placeMessage,
  ScreenRead,
  type Read,
} from "./read-view";
import { ScreenHeading } from "./screen-heading";

// A fictional record of a detail screen, or a page of a list.
interface FictionalRecord {
  title: string;
}

const REQUEST_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const UNAVAILABLE = new ApiError(503, "REDIS_UNAVAILABLE", {}, REQUEST_ID);
const NOT_FOUND = new ApiError(404, "RESOURCE_NOT_FOUND", {}, REQUEST_ID);
const FORBIDDEN = new ApiError(
  403,
  "AUTH_INSUFFICIENT_PERMISSION",
  {},
  undefined,
);
const ENDED = new ApiError(401, "AUTH_NOT_AUTHENTICATED", {}, REQUEST_ID);

// The warning of a new read of a screen that fails with UNAVAILABLE, as it
// shows above the data, and as the announcer announces it, with its
// reference.
const NOT_UPDATED =
  "This couldn't be updated. Sentinel isn't available right now. Try again later.";
const NOT_UPDATED_ANNOUNCED = `${NOT_UPDATED} Reference: ${REQUEST_ID}`;

// The read of each test: the response to each page, which a test prepares
// in turn, as component tests replace the shared request function.
const respond = vi.fn<(page: number) => Promise<FictionalRecord>>();

let client: QueryClient;

beforeEach(() => {
  client = createQueryClient();
});

afterEach(() => {
  client.clear();
  respond.mockReset();
  document.title = "Sentinel";
});

// The color behind an element, outside the element itself: the background of
// the nearest element that contains it and has one.
function backgroundBehind(element: Element): string {
  for (
    let current = element.parentElement;
    current;
    current = current.parentElement
  ) {
    const background = getComputedStyle(current).backgroundColor;
    if (background !== "rgba(0, 0, 0, 0)") {
      return background;
    }
  }
  return "transparent";
}

// A response that the test gives when it chooses.
function later() {
  let resolve!: (record: FictionalRecord) => void;
  let reject!: (failure: unknown) => void;
  const promise = new Promise<FictionalRecord>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function useRecord(page: number) {
  return useQuery({
    queryKey: ["records", page],
    queryFn: () => respond(page),
    // The delay between attempts is TanStack Query's; the tests remove it.
    retryDelay: 0,
    placeholderData: keepPreviousData,
  });
}

// A screen of a list, whose heading and control show at once.
function ListScreen({ page }: { page: number }) {
  const read = useRecord(page);
  return (
    <ScreenRead
      read={read}
      renderFrame={(place) => (
        <main>
          <ScreenHeading>Records</ScreenHeading>
          <Button>Next</Button>
          {place}
        </main>
      )}
    >
      {(record) => <p>{record.title}</p>}
    </ScreenRead>
  );
}

// A screen of one record, whose heading names it once it arrives.
function DetailScreen() {
  const read = useRecord(1);
  return (
    <ScreenRead
      read={read}
      renderFrame={(place, record) => (
        <main>
          <ScreenHeading>{record?.title ?? "Record"}</ScreenHeading>
          {place}
        </main>
      )}
    >
      {(record) => <p>Details of {record.title}</p>}
    </ScreenRead>
  );
}

// A screen of one record with a button that opens a modal popover.
function PopoverScreen() {
  const read = useRecord(1);
  return (
    <ScreenRead
      read={read}
      renderFrame={(place) => (
        <main>
          <ScreenHeading>Record</ScreenHeading>
          <DialogTrigger>
            <Button>Details</Button>
            <InfoPopover width="narrow">
              <PopoverTitle>Details of the record</PopoverTitle>
            </InfoPopover>
          </DialogTrigger>
          {place}
        </main>
      )}
    >
      {(record) => <p>Details of {record.title}</p>}
    </ScreenRead>
  );
}

// The main content of the screen, where its data and the failures of its
// reads show: the announcer of the page, outside it, holds the words of each
// failure too.
function mainContent(screen: Awaited<ReturnType<typeof render>>) {
  return screen.getByRole("main");
}

// A screen of a list that gives the place of its data itself, given its
// read, as the frame of a table does.
function OwnPlaceScreen() {
  const read = useRecord(1);
  return (
    <ScreenRead
      read={read}
      renderFrame={(place) => (
        <main>
          <ScreenHeading>Records</ScreenHeading>
          {place}
        </main>
      )}
      renderPlace={(given) => (
        <p>{`Place of a read in status ${given.status}: ${given.data?.title ?? "none"}`}</p>
      )}
    />
  );
}

// A part of a screen under its own heading.
function PartScreen() {
  const read = useRecord(1);
  return (
    <main>
      <ScreenHeading>Record</ScreenHeading>
      <h2>References</h2>
      <PartRead read={read}>{(record) => <p>{record.title}</p>}</PartRead>
    </main>
  );
}

// A screen, and a part of a screen, whose data holds a control.
function EditableScreen() {
  const read = useRecord(1);
  return (
    <ScreenRead
      read={read}
      renderFrame={(place, record) => (
        <main>
          <ScreenHeading>{record?.title ?? "Record"}</ScreenHeading>
          {place}
        </main>
      )}
    >
      {(record) => <Button>Edit {record.title}</Button>}
    </ScreenRead>
  );
}

function EditablePart() {
  const read = useRecord(1);
  return (
    <main>
      <ScreenHeading>Record</ScreenHeading>
      <h2>References</h2>
      <PartRead read={read}>
        {(record) => <Button>Edit {record.title}</Button>}
      </PartRead>
    </main>
  );
}

// Says when the read of the record has failed, together with the screen that
// shows it, which re-renders with it, for a test whose screen shows no
// change after the failure.
function ReadStatus() {
  const { status } = useRecord(1);
  return status === "error" ? <p>The read failed</p> : null;
}

function renderWithClient(ui: ReactNode) {
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
    { wrapper: Announcer },
  );
}

function refetch() {
  return client.refetchQueries({ queryKey: ["records"] });
}

describe("ScreenRead", () => {
  test("shows the heading and controls at once, the loading indicator while the read waits, then the data", async () => {
    const { promise, resolve } = later();
    respond.mockReturnValueOnce(promise);
    const screen = await renderWithClient(<DetailScreen />);

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Record" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();
    resolve({ title: "Fictional record" });

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "Fictional record" }),
      )
      .toBeVisible();
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    expect(screen.getByRole("progressbar").query()).toBeNull();
  });

  test("replaces the content of the screen when its first read fails, until Try again succeeds", async () => {
    respond
      .mockRejectedValueOnce(UNAVAILABLE)
      .mockRejectedValueOnce(UNAVAILABLE)
      .mockRejectedValueOnce(UNAVAILABLE)
      .mockResolvedValueOnce({ title: "Fictional record" });
    const screen = await renderWithClient(<ListScreen page={1} />);

    await expect
      .element(
        screen.getByRole("heading", {
          level: 1,
          name: "This page couldn't be loaded",
        }),
      )
      .toBeVisible();
    expect(screen.getByRole("heading", { name: "Records" }).query()).toBeNull();
    expect(screen.getByRole("button", { name: "Next" }).query()).toBeNull();
    await expect
      .element(screen.getByText(`Reference: ${REQUEST_ID}`))
      .toBeVisible();
    expect(respond).toHaveBeenCalledTimes(3);

    await screen.getByRole("button", { name: "Try again" }).click();

    await expect.element(screen.getByText("Fictional record")).toBeVisible();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Records" }))
      .toHaveFocus();
  });

  test("moves the focus to the heading of the error when the read fails again after Try again", async () => {
    respond.mockRejectedValue(UNAVAILABLE);
    const screen = await renderWithClient(<ListScreen page={1} />);

    await screen.getByRole("button", { name: "Try again" }).click();

    await expect
      .element(
        screen.getByRole("heading", {
          level: 1,
          name: "This page couldn't be loaded",
        }),
      )
      .toHaveFocus();
    expect(respond).toHaveBeenCalledTimes(6);
  });

  test("shows Not found in place of the screen when its record does not exist", async () => {
    respond.mockRejectedValueOnce(NOT_FOUND);
    const screen = await renderWithClient(<DetailScreen />);

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Go to the start page" }))
      .toBeVisible();
    expect(screen.getByRole("heading", { name: "Record" }).query()).toBeNull();
  });

  test("keeps the data shown, marked as updated, while it reads other data", async () => {
    respond.mockResolvedValueOnce({ title: "First page" });
    const screen = await renderWithClient(<ListScreen page={1} />);
    await expect.element(screen.getByText("First page")).toBeVisible();
    const { promise, resolve } = later();
    respond.mockReturnValueOnce(promise);

    await screen.rerender(
      <QueryClientProvider client={client}>
        <ListScreen page={2} />
      </QueryClientProvider>,
    );

    await expect
      .element(screen.getByRole("progressbar", { name: "Updating" }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("First page")).toBeVisible();
    resolve({ title: "Second page" });
    await expect.element(screen.getByText("Second page")).toBeVisible();
    expect(screen.getByRole("progressbar").query()).toBeNull();
  });

  test("shows a failed read of other data in place of the data, keeping the heading and controls", async () => {
    respond.mockResolvedValueOnce({ title: "First page" });
    const screen = await renderWithClient(<ListScreen page={1} />);
    await expect.element(screen.getByText("First page")).toBeVisible();
    respond.mockRejectedValue(UNAVAILABLE);

    await screen.rerender(
      <QueryClientProvider client={client}>
        <ListScreen page={2} />
      </QueryClientProvider>,
    );

    await expect
      .element(
        screen.getByText(
          "Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Records" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Next" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toBeVisible();
    expect(screen.getByText("First page").query()).toBeNull();
  });

  test("keeps the data shown when a new read of it fails, saying that it couldn't be updated", async () => {
    respond.mockResolvedValueOnce({ title: "Fictional record" });
    const screen = await renderWithClient(<DetailScreen />);
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    respond.mockRejectedValue(UNAVAILABLE);

    await refetch();

    await expect
      .element(mainContent(screen).getByText(NOT_UPDATED))
      .toBeVisible();
    await expect
      .element(mainContent(screen).getByText(`Reference: ${REQUEST_ID}`))
      .toBeVisible();
    await expect.poll(announcements).toEqual([NOT_UPDATED_ANNOUNCED]);
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "Fictional record" }),
      )
      .toBeVisible();
  });

  test.each([
    ["a network failure", new NetworkError({ cause: new TypeError("Failed") })],
    ["a 500", new ApiError(500, "INTERNAL_ERROR", {}, REQUEST_ID)],
    ["a 429", new ApiError(429, undefined, undefined, undefined)],
    [
      "an unreadable response",
      new UnreadableResponseError(200, REQUEST_ID, {
        cause: new SyntaxError("Unexpected token"),
      }),
    ],
  ])("offers Try again next to the data shown after %s", async (_, failure) => {
    respond.mockResolvedValueOnce({ title: "Fictional record" });
    const screen = await renderWithClient(<DetailScreen />);
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    respond.mockRejectedValue(failure);

    await refetch();

    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
  });

  test("offers no Try again next to the data shown after a 409", async () => {
    respond.mockResolvedValueOnce({ title: "Fictional record" });
    const screen = await renderWithClient(<DetailScreen />);
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    respond.mockRejectedValue(
      new ApiError(409, "RESOURCE_CONFLICT", {}, REQUEST_ID),
    );

    await refetch();

    await expect
      .element(
        mainContent(screen).getByText(
          "This couldn't be updated. This can't be done in the current state, which may have changed. Check it and try again.",
        ),
      )
      .toBeVisible();
    expect(screen.getByRole("button").query()).toBeNull();
  });

  test("hides the warning while Try again reads the data again, then shows the new data", async () => {
    respond.mockResolvedValueOnce({ title: "Fictional record" });
    const screen = await renderWithClient(<DetailScreen />);
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    respond.mockRejectedValue(UNAVAILABLE);
    await refetch();
    const { promise, resolve } = later();
    respond.mockReset();
    respond.mockReturnValueOnce(promise);

    await screen.getByRole("button", { name: "Try again" }).click();

    await expect.element(screen.getByText(NOT_UPDATED)).not.toBeInTheDocument();
    await expect.poll(announcements).toEqual([]);
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "Fictional record" }),
      )
      .toHaveFocus();
    await expect
      .element(screen.getByRole("progressbar", { name: "Updating" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    resolve({ title: "Renamed record" });
    await expect
      .element(screen.getByText("Details of Renamed record"))
      .toBeVisible();
    expect(screen.getByText(NOT_UPDATED).query()).toBeNull();
    expect(announcements()).toEqual([]);
    expect(screen.getByRole("progressbar").query()).toBeNull();
  });

  test("shows Try again below the warning, outside it", async () => {
    respond.mockResolvedValueOnce({ title: "Fictional record" });
    const screen = await renderWithClient(<DetailScreen />);
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    respond.mockRejectedValue(UNAVAILABLE);

    await refetch();

    const reference = screen.getByText(`Reference: ${REQUEST_ID}`);
    const action = screen.getByRole("button", { name: "Try again" });
    await expect.element(action).toBeVisible();
    expect(action.element().getBoundingClientRect().top).toBeGreaterThan(
      reference.element().getBoundingClientRect().bottom,
    );
    expect(backgroundBehind(action.element())).not.toBe(
      backgroundBehind(reference.element()),
    );
  });

  test("announces the warning again when the read that Try again sends fails too", async () => {
    respond.mockResolvedValueOnce({ title: "Fictional record" });
    const screen = await renderWithClient(<DetailScreen />);
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    respond.mockRejectedValue(UNAVAILABLE);
    await refetch();
    await expect.poll(announcements).toEqual([NOT_UPDATED_ANNOUNCED]);
    const { promise, reject } = later();
    respond.mockReset();
    respond.mockReturnValueOnce(promise).mockRejectedValue(UNAVAILABLE);

    await screen.getByRole("button", { name: "Try again" }).click();
    await expect.poll(announcements).toEqual([]);
    reject(UNAVAILABLE);

    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toBeVisible();
    await expect.poll(announcements).toEqual([NOT_UPDATED_ANNOUNCED]);
  });

  test("announces the warning of a new read that fails while a modal popover is open, once, and leaves the focus in the popover", async () => {
    respond.mockResolvedValueOnce({ title: "Fictional record" });
    const screen = await renderWithClient(<PopoverScreen />);
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    await screen.getByRole("button", { name: "Details" }).click();
    const popover = screen.getByRole("dialog", {
      name: "Details of the record",
    });
    await expect.element(popover).toHaveFocus();
    respond.mockRejectedValue(UNAVAILABLE);

    await refetch();

    await expect
      .element(mainContent(screen).getByText(NOT_UPDATED))
      .toBeVisible();
    await expect.poll(announcements).toEqual([NOT_UPDATED_ANNOUNCED]);
    await expect.element(popover).toHaveFocus();
  });

  test.each([
    ["a 404", NOT_FOUND, "Not found"],
    ["a 403", FORBIDDEN, "No access"],
  ])(
    "replaces the data shown when a new read of it fails with %s",
    async (_, failure, heading) => {
      respond.mockResolvedValueOnce({ title: "Fictional record" });
      const screen = await renderWithClient(<DetailScreen />);
      await expect
        .element(screen.getByText("Details of Fictional record"))
        .toBeVisible();
      respond.mockRejectedValue(failure);

      await refetch();

      await expect
        .element(screen.getByRole("heading", { level: 1, name: heading }))
        .toBeVisible();
      expect(
        screen.getByText("Details of Fictional record").query(),
      ).toBeNull();
    },
  );

  test("keeps the data shown without a message when a new read of it ends the session", async () => {
    respond.mockResolvedValueOnce({ title: "Fictional record" });
    const screen = await renderWithClient(
      <>
        <DetailScreen />
        <ReadStatus />
      </>,
    );
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    respond.mockRejectedValue(ENDED);

    await refetch();

    await expect.element(screen.getByText("The read failed")).toBeVisible();
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    expect(screen.getByText(/couldn't be updated/).query()).toBeNull();
    expect(announcements()).toEqual([]);
  });

  test("leaves a new read of the data shown that fails in the UI itself to the page of a failure of the UI", async () => {
    respond.mockResolvedValueOnce({ title: "Fictional record" });
    const screen = await renderWithClient(
      <CatchBoundary
        getResetKey={() => "fictional"}
        errorComponent={({ error }) => <p>The UI failed: {String(error)}</p>}
      >
        <DetailScreen />
      </CatchBoundary>,
    );
    await expect
      .element(screen.getByText("Details of Fictional record"))
      .toBeVisible();
    respond.mockRejectedValue(
      new TypeError("Cannot read properties of undefined"),
    );

    await refetch();

    await expect
      .element(
        screen.getByText(
          "The UI failed: TypeError: Cannot read properties of undefined",
        ),
      )
      .toBeVisible();
  });

  test("shows the place that the screen gives itself, given the read", async () => {
    const { promise, resolve } = later();
    respond.mockReturnValueOnce(promise);
    const screen = await renderWithClient(<OwnPlaceScreen />);

    await expect
      .element(screen.getByText("Place of a read in status pending: none"))
      .toBeVisible();
    resolve({ title: "Fictional record" });

    await expect
      .element(
        screen.getByText("Place of a read in status success: Fictional record"),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Records" }))
      .toBeVisible();
  });

  test("replaces also a screen that gives its place itself when its first read fails", async () => {
    respond.mockRejectedValue(UNAVAILABLE);
    const screen = await renderWithClient(<OwnPlaceScreen />);

    await expect
      .element(
        screen.getByRole("heading", {
          level: 1,
          name: "This page couldn't be loaded",
        }),
      )
      .toBeVisible();
    expect(screen.getByText(/Place of a read/).query()).toBeNull();
  });
});

describe("PartRead", () => {
  test("shows the failure of its read in place of the part, below its heading", async () => {
    respond.mockRejectedValueOnce(NOT_FOUND);
    const screen = await renderWithClient(<PartScreen />);

    await expect
      .element(
        mainContent(screen).getByText(
          "This no longer exists, or you no longer have access to it.",
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("heading", { level: 2, name: "References" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Record" }))
      .toBeVisible();
  });

  test("announces the failure of its read as it appears", async () => {
    const { promise, reject } = later();
    respond.mockReturnValueOnce(promise);
    const screen = await renderWithClient(<PartScreen />);
    await expect
      .element(screen.getByRole("heading", { level: 2, name: "References" }))
      .toBeVisible();
    expect(announcements()).toEqual([]);

    reject(NOT_FOUND);

    await expect
      .poll(announcements)
      .toEqual(["This no longer exists, or you no longer have access to it."]);
  });

  test("announces the failure of its read with the reference of its error", async () => {
    respond.mockRejectedValue(UNAVAILABLE);
    const screen = await renderWithClient(<PartScreen />);

    await expect
      .element(
        mainContent(screen).getByText(
          "Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    await expect
      .element(mainContent(screen).getByText(`Reference: ${REQUEST_ID}`))
      .toBeVisible();
    await expect
      .poll(announcements)
      .toEqual([
        `Sentinel isn't available right now. Try again later. Reference: ${REQUEST_ID}`,
      ]);
  });

  test("offers Try again after a network failure, and moves the focus to the screen's heading", async () => {
    respond
      .mockRejectedValueOnce(
        new NetworkError({ cause: new TypeError("Failed to fetch") }),
      )
      .mockRejectedValueOnce(
        new NetworkError({ cause: new TypeError("Failed to fetch") }),
      )
      .mockRejectedValueOnce(
        new NetworkError({ cause: new TypeError("Failed to fetch") }),
      )
      .mockResolvedValueOnce({ title: "Fictional reference" });
    const screen = await renderWithClient(<PartScreen />);

    await screen.getByRole("button", { name: "Try again" }).click();

    await expect.element(screen.getByText("Fictional reference")).toBeVisible();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Record" }))
      .toHaveFocus();
  });

  test("replaces its data when a new read of it fails with a 403", async () => {
    respond.mockResolvedValueOnce({ title: "Fictional reference" });
    const screen = await renderWithClient(<PartScreen />);
    await expect.element(screen.getByText("Fictional reference")).toBeVisible();
    respond.mockRejectedValue(FORBIDDEN);

    await refetch();

    await expect
      .element(
        mainContent(screen).getByText("You don't have permission to do this."),
      )
      .toBeVisible();
    expect(screen.getByText("Fictional reference").query()).toBeNull();
  });
});

test("leaves a read that fails in the UI itself to the page of a failure of the UI", async () => {
  respond.mockRejectedValueOnce(
    new TypeError("Cannot read properties of undefined"),
  );
  const screen = await renderWithClient(
    <CatchBoundary
      getResetKey={() => "fictional"}
      errorComponent={({ error }) => <p>The UI failed: {String(error)}</p>}
    >
      <DetailScreen />
    </CatchBoundary>,
  );

  await expect
    .element(
      screen.getByText(
        "The UI failed: TypeError: Cannot read properties of undefined",
      ),
    )
    .toBeVisible();
});

describe("when a new read replaces what holds the focus", () => {
  test.each([
    [
      "the data of the screen",
      <EditableScreen key="screen" />,
      "Edit Fictional record",
      NOT_FOUND,
      "Not found",
    ],
    [
      "a control of the screen",
      <ListScreen key="list" page={1} />,
      "Next",
      FORBIDDEN,
      "No access",
    ],
    [
      "the data of a part",
      <EditablePart key="part" />,
      "Edit Fictional record",
      FORBIDDEN,
      "Record",
    ],
  ])(
    "moves the focus to the screen's heading when it replaces %s",
    async (_, ui, name, failure, heading) => {
      respond.mockResolvedValueOnce({ title: "Fictional record" });
      const screen = await renderWithClient(ui);
      const control = screen.getByRole("button", { name });
      await expect.element(control).toBeVisible();
      await userEvent.keyboard("{Tab}");
      await expect.element(control).toHaveFocus();
      respond.mockRejectedValue(failure);

      await refetch();

      await expect
        .element(screen.getByRole("heading", { level: 1, name: heading }))
        .toHaveFocus();
    },
  );
});

// A read of the tests, in a state that a test sets.
function readOf(fields: Partial<Read<FictionalRecord>>): Read<FictionalRecord> {
  return {
    data: undefined,
    error: null,
    status: "pending",
    isPlaceholderData: false,
    isFetching: false,
    refetch: () => undefined,
    ...fields,
  };
}

describe("placeMessage", () => {
  const RECORD = { title: "A fictional record" };

  test.each([
    [
      "a read that has not failed",
      readOf({ status: "success", data: RECORD }),
      "",
    ],
    ["a read that loads", readOf({ isFetching: true }), ""],
    [
      "the error in place of the data",
      readOf({ status: "error", error: UNAVAILABLE }),
      "Sentinel isn't available right now. Try again later.",
    ],
    [
      "the error in place of the data, also while the read is sent again",
      readOf({ status: "error", error: UNAVAILABLE, isFetching: true }),
      "Sentinel isn't available right now. Try again later.",
    ],
    [
      "the warning above data that stays shown",
      readOf({ status: "error", error: UNAVAILABLE, data: RECORD }),
      "This couldn't be updated. Sentinel isn't available right now. Try again later.",
    ],
    [
      "nothing while data that stays shown is read again",
      readOf({
        status: "error",
        error: UNAVAILABLE,
        data: RECORD,
        isFetching: true,
      }),
      "",
    ],
    [
      "the error that replaces data that stayed shown",
      readOf({ status: "error", error: NOT_FOUND, data: RECORD }),
      "This no longer exists, or you no longer have access to it.",
    ],
    [
      "nothing for the end of the session",
      readOf({ status: "error", error: ENDED }),
      "",
    ],
    [
      "nothing for a failure of the UI itself",
      readOf({ status: "error", error: new TypeError("A fictional failure") }),
      "",
    ],
  ])("gives %s", (_, read, message) => {
    expect(placeMessage(read)).toBe(message);
  });
});

// A list whose items a read only marks, such as the tracks of a package tree
// that wait for the signed-in user: the items show at once, and the item that
// the record names is marked once the read arrives.
function MarkedList() {
  const read = useRecord(1);
  const { marks, warning, updating } = marksPlace(read, {
    notShown: "The marks of the items couldn't be shown.",
    notUpdated: "The marks of the items couldn't be updated.",
  });
  return (
    <main className="relative">
      <ScreenHeading>Items</ScreenHeading>
      {updating && <UpdatingBar />}
      {warning}
      <ul>
        {["First item", "Second item"].map((item) => (
          <li key={item}>
            {item}
            {marks?.title === item && " (marked)"}
          </li>
        ))}
      </ul>
    </main>
  );
}

// Starts the loading indicator, which the test does not check, when the test
// asks (delayPassed).
let startReference: () => void = () => undefined;

function DelayReference() {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    startReference = () => {
      setStarted(true);
    };
  }, []);
  return started ? <Loading /> : null;
}

// Waits until the delay after which UpdatingBar shows has passed since now,
// for a test that checks that it does not show: the loading indicator, which
// waits as long, starts now and shows after the bar would have shown, had it
// mounted before (src/components/loading.tsx).
async function delayPassed(screen: Awaited<ReturnType<typeof render>>) {
  startReference();
  await expect
    .element(screen.getByRole("progressbar", { name: "Loading" }))
    .toBeVisible();
}

function updatingBar(screen: Awaited<ReturnType<typeof render>>) {
  return screen.getByRole("progressbar", { name: "Updating" });
}

describe("marksPlace", () => {
  test("marks nothing until the read arrives, then its marks", async () => {
    const { promise, resolve } = later();
    respond.mockReturnValueOnce(promise);
    const screen = await renderWithClient(
      <>
        <MarkedList />
        <DelayReference />
      </>,
    );

    await expect.element(screen.getByText("First item")).toBeVisible();
    await delayPassed(screen);
    expect(screen.getByText("(marked)").query()).toBeNull();
    expect(updatingBar(screen).query()).toBeNull();
    resolve({ title: "Second item" });

    await expect
      .element(screen.getByText("Second item (marked)"))
      .toBeVisible();
  });

  test("says what couldn't be shown, with the message of the failure and Try again, while the data stays usable", async () => {
    respond
      .mockRejectedValueOnce(UNAVAILABLE)
      .mockRejectedValueOnce(UNAVAILABLE)
      .mockRejectedValueOnce(UNAVAILABLE)
      .mockResolvedValueOnce({ title: "First item" });
    const screen = await renderWithClient(<MarkedList />);

    const warning = screen.getByText(
      "The marks of the items couldn't be shown. Sentinel isn't available right now. Try again later.",
    );
    await expect.element(warning).toBeVisible();
    await expect
      .element(screen.getByText(`Reference: ${REQUEST_ID}`))
      .toBeVisible();
    await expect
      .poll(announcements)
      .toEqual([
        `The marks of the items couldn't be shown. Sentinel isn't available right now. Try again later. Reference: ${REQUEST_ID}`,
      ]);
    await expect.element(screen.getByText("First item")).toBeVisible();

    await screen.getByRole("button", { name: "Try again" }).click();

    await expect.element(screen.getByText("First item (marked)")).toBeVisible();
    expect(screen.getByText(/couldn't be shown/).query()).toBeNull();
  });

  test("hides the warning while Try again sends the read again", async () => {
    const { promise, resolve } = later();
    respond
      .mockRejectedValueOnce(UNAVAILABLE)
      .mockRejectedValueOnce(UNAVAILABLE)
      .mockRejectedValueOnce(UNAVAILABLE)
      .mockReturnValueOnce(promise);
    const screen = await renderWithClient(<MarkedList />);
    await expect
      .element(mainContent(screen).getByText(/couldn't be shown/))
      .toBeVisible();

    await screen.getByRole("button", { name: "Try again" }).click();

    await expect
      .poll(() => screen.getByText(/couldn't be shown/).query())
      .toBeNull();
    resolve({ title: "First item" });
    await expect.element(screen.getByText("First item (marked)")).toBeVisible();
  });

  test("offers no Try again after a failure that does not offer it", async () => {
    respond.mockRejectedValueOnce(FORBIDDEN);
    const screen = await renderWithClient(<MarkedList />);

    await expect
      .element(
        mainContent(screen).getByText(
          "The marks of the items couldn't be shown. You don't have permission to do this.",
        ),
      )
      .toBeVisible();
    expect(
      screen.getByRole("button", { name: "Try again" }).query(),
    ).toBeNull();
  });

  test("keeps the marks, saying what couldn't be updated, when a later read of them fails", async () => {
    respond.mockResolvedValueOnce({ title: "First item" });
    const screen = await renderWithClient(<MarkedList />);
    await expect.element(screen.getByText("First item (marked)")).toBeVisible();
    respond.mockRejectedValue(UNAVAILABLE);

    await refetch();

    await expect
      .element(
        screen.getByText(
          "The marks of the items couldn't be updated. Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    await expect.element(screen.getByText("First item (marked)")).toBeVisible();
  });

  test("marks the marks that stay shown as being updated while Try again reads them again", async () => {
    respond.mockResolvedValueOnce({ title: "First item" });
    const screen = await renderWithClient(
      <>
        <MarkedList />
        <DelayReference />
      </>,
    );
    await expect.element(screen.getByText("First item (marked)")).toBeVisible();
    respond.mockRejectedValue(UNAVAILABLE);
    await refetch();
    await expect
      .element(mainContent(screen).getByText(/couldn't be updated/))
      .toBeVisible();
    await delayPassed(screen);
    expect(updatingBar(screen).query()).toBeNull();
    const { promise, resolve } = later();
    respond.mockReset();
    respond.mockReturnValueOnce(promise);

    await screen.getByRole("button", { name: "Try again" }).click();

    await expect.element(updatingBar(screen)).toBeInTheDocument();
    await expect.element(screen.getByText("First item (marked)")).toBeVisible();
    resolve({ title: "Second item" });
    await expect
      .element(screen.getByText("Second item (marked)"))
      .toBeVisible();
    expect(updatingBar(screen).query()).toBeNull();
  });

  test("removes the marks when a later read of them fails with a 404", async () => {
    respond.mockResolvedValueOnce({ title: "First item" });
    const screen = await renderWithClient(<MarkedList />);
    await expect.element(screen.getByText("First item (marked)")).toBeVisible();
    respond.mockRejectedValue(NOT_FOUND);

    await refetch();

    await expect
      .element(
        mainContent(screen).getByText(
          "The marks of the items couldn't be shown. This no longer exists, or you no longer have access to it.",
        ),
      )
      .toBeVisible();
    expect(screen.getByText("(marked)").query()).toBeNull();
  });

  test("shows no message when the read ends the session", async () => {
    respond.mockRejectedValueOnce(ENDED);
    const screen = await renderWithClient(
      <>
        <MarkedList />
        <ReadStatus />
      </>,
    );

    await expect.element(screen.getByText("The read failed")).toBeVisible();
    expect(screen.getByText(/couldn't be shown/).query()).toBeNull();
    expect(announcements()).toEqual([]);
  });
});
