import {
  keepPreviousData,
  QueryClientProvider,
  useQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { CatchBoundary } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { ApiError, NetworkError } from "../api/request";
import { createQueryClient } from "../query-client";
import { Button } from "./button";
import { PartRead, ScreenRead } from "./read-view";
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
    const region = screen.getByRole("status").element();
    respond.mockRejectedValue(UNAVAILABLE);

    await refetch();

    expect(screen.getByRole("status").element()).toBe(region);
    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent(
        `This couldn't be updated. Sentinel isn't available right now. Try again later.Reference: ${REQUEST_ID}`,
      );
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
    await expect.element(screen.getByRole("status")).toBeEmptyDOMElement();
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
});

describe("PartRead", () => {
  test("shows the failure of its read in place of the part, below its heading", async () => {
    respond.mockRejectedValueOnce(NOT_FOUND);
    const screen = await renderWithClient(<PartScreen />);

    await expect
      .element(
        screen.getByText(
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

  test("announces the failure of its read in a status region that is there before it", async () => {
    const { promise, reject } = later();
    respond.mockReturnValueOnce(promise);
    const screen = await renderWithClient(<PartScreen />);
    const region = screen.getByRole("status");
    await expect.element(region).toBeEmptyDOMElement();
    const before = region.element();

    reject(NOT_FOUND);

    await expect
      .element(region)
      .toHaveTextContent(
        "This no longer exists, or you no longer have access to it.",
      );
    expect(region.element()).toBe(before);
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
      .element(screen.getByText("You don't have permission to do this."))
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
