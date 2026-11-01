import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Button } from "./button";
import { UiFailure } from "./ui-failure";

afterEach(() => {
  document.title = "Sentinel";
});

test("reloads the page with Reload page", async () => {
  const onReload = vi.fn();
  const screen = await render(<UiFailure onReload={onReload} />);

  await expect
    .element(
      screen.getByRole("heading", { level: 1, name: "Something went wrong" }),
    )
    .toBeVisible();
  await screen.getByRole("button", { name: "Reload page" }).click();

  expect(onReload).toHaveBeenCalledOnce();
});

// A control that stays on the page, beside the place where the failure
// shows.
function FailureBeside() {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Button
        onPress={() => {
          setFailed(true);
        }}
      >
        Show the failure
      </Button>
      {failed && <UiFailure onReload={vi.fn()} />}
    </>
  );
}

test("leaves the focus on a control that stays on the page", async () => {
  const screen = await render(<FailureBeside />);
  const control = screen.getByRole("button", { name: "Show the failure" });

  await userEvent.keyboard("{Tab}");
  await expect.element(control).toHaveFocus();
  await userEvent.keyboard("{Enter}");

  await expect
    .element(
      screen.getByRole("heading", { level: 1, name: "Something went wrong" }),
    )
    .toBeVisible();
  await expect.element(control).toHaveFocus();
});
