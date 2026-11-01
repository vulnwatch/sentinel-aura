import { CatchBoundary } from "@tanstack/react-router";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ApiError, NetworkError } from "../api/request";
import { Button } from "./button";
import { ErrorInPlace } from "./error-in-place";
import { ScreenHeading } from "./screen-heading";

const REQUEST_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const UNAVAILABLE = new ApiError(
  503,
  "REDIS_UNAVAILABLE",
  { code: "REDIS_UNAVAILABLE", detail: "Redis is unavailable" },
  REQUEST_ID,
);
const NOT_FOUND = new ApiError(404, "TICKET_NOT_FOUND", {}, REQUEST_ID);
const FORBIDDEN = new ApiError(
  403,
  "AUTH_INSUFFICIENT_PERMISSION",
  {},
  undefined,
);

afterEach(() => {
  document.title = "Sentinel";
});

function retry() {
  // The action of Try again, which the tests check where it matters.
}

describe("in place of the content of a screen", () => {
  test("names the error with the screen's heading and offers Try again after a 5xx, with the reference", async () => {
    const onRetry = vi.fn();
    const screen = await render(
      <ErrorInPlace error={UNAVAILABLE} placement="screen" onRetry={onRetry} />,
    );

    await expect
      .element(
        screen.getByRole("heading", {
          level: 1,
          name: "This page couldn't be loaded",
        }),
      )
      .toBeVisible();
    expect(document.title).toBe("This page couldn't be loaded – Sentinel");
    await expect
      .element(
        screen.getByText(
          "Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByText(`Reference: ${REQUEST_ID}`))
      .toBeVisible();
    expect(screen.getByRole("link").query()).toBeNull();

    await screen.getByRole("button", { name: "Try again" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test("offers Try again after a network failure, without a reference", async () => {
    const screen = await render(
      <ErrorInPlace
        error={new NetworkError({ cause: new TypeError("Failed to fetch") })}
        placement="screen"
        onRetry={retry}
      />,
    );

    await expect
      .element(
        screen.getByText(
          "Sentinel can't be reached. Check your connection and try again.",
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toBeVisible();
    expect(screen.getByText(/Reference/).query()).toBeNull();
  });

  test("shows Not found for a 404, with a link to the landing", async () => {
    const screen = await render(
      <ErrorInPlace error={NOT_FOUND} placement="screen" onRetry={retry} />,
    );

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    expect(document.title).toBe("Not found – Sentinel");
    await expect
      .element(
        screen.getByText(
          "This page doesn't exist, or you don't have access to it.",
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Go to the start page" }))
      .toHaveAttribute("href", "/");
    expect(screen.getByRole("button").query()).toBeNull();
  });

  test("shows No access for a 403, with a link to the landing", async () => {
    const screen = await render(
      <ErrorInPlace error={FORBIDDEN} placement="screen" onRetry={retry} />,
    );

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "No access" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("You don't have permission to view this page."))
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Go to the start page" }))
      .toBeVisible();
  });
});

describe("in place of a part of a screen", () => {
  test("shows the message without a heading, with Try again after a 5xx", async () => {
    const onRetry = vi.fn();
    const screen = await render(
      <ErrorInPlace error={UNAVAILABLE} placement="part" onRetry={onRetry} />,
    );

    await expect
      .element(
        screen.getByText(
          "Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    expect(screen.getByRole("heading").query()).toBeNull();
    expect(document.title).toBe("Sentinel");

    await screen.getByRole("button", { name: "Try again" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test("offers no action for a failure that Try again does not follow", async () => {
    const screen = await render(
      <ErrorInPlace error={NOT_FOUND} placement="part" onRetry={retry} />,
    );

    await expect
      .element(
        screen.getByText(
          "This no longer exists, or you no longer have access to it.",
        ),
      )
      .toBeVisible();
    expect(screen.getByRole("button").query()).toBeNull();
    expect(screen.getByRole("link").query()).toBeNull();
  });
});

test("shows nothing for a 401, because the session has ended", async () => {
  const screen = await render(
    <ErrorInPlace
      error={new ApiError(401, "AUTH_NOT_AUTHENTICATED", {}, REQUEST_ID)}
      placement="screen"
      onRetry={retry}
    />,
  );

  expect(screen.container.textContent).toBe("");
});

test("leaves any other error to the page of a failure of the UI", async () => {
  const screen = await render(
    <CatchBoundary
      getResetKey={() => "fictional"}
      errorComponent={({ error }) => <p>The UI failed: {String(error)}</p>}
    >
      <ErrorInPlace
        error={new TypeError("Cannot read properties of undefined")}
        placement="part"
        onRetry={retry}
      />
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

// A screen whose read failed, which Try again replaces with its data under
// its own heading, or which another control of the screen replaces.
function RetriedScreen() {
  const [failed, setFailed] = useState(true);
  return (
    <>
      <Button
        onPress={() => {
          setFailed(false);
        }}
      >
        Show the data
      </Button>
      {failed ? (
        <ErrorInPlace
          error={UNAVAILABLE}
          placement="part"
          onRetry={() => {
            setFailed(false);
          }}
        />
      ) : (
        <ScreenHeading>Fictional record</ScreenHeading>
      )}
    </>
  );
}

describe("when the error disappears", () => {
  test("moves the focus from Try again to the screen's heading", async () => {
    const screen = await render(<RetriedScreen />);
    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toBeVisible();

    await userEvent.keyboard("{Tab}{Tab}");
    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "Fictional record" }),
      )
      .toHaveFocus();
  });

  test("leaves the focus where it is when it was elsewhere", async () => {
    const screen = await render(<RetriedScreen />);
    const other = screen.getByRole("button", { name: "Show the data" });

    await userEvent.keyboard("{Tab}");
    await expect.element(other).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "Fictional record" }),
      )
      .toBeVisible();
    await expect.element(other).toHaveFocus();
  });
});
