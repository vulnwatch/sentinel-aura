import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
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
