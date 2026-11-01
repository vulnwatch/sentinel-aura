import { expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Button } from "./button";

test("performs its action when the user presses it", async () => {
  const onPress = vi.fn();
  const screen = await render(<Button onPress={onPress}>Try again</Button>);

  await screen.getByRole("button", { name: "Try again" }).click();

  expect(onPress).toHaveBeenCalledOnce();
});

test("performs its action from the keyboard", async () => {
  const onPress = vi.fn();
  await render(<Button onPress={onPress}>Try again</Button>);

  await userEvent.keyboard("{Tab}{Enter}");

  expect(onPress).toHaveBeenCalledOnce();
});

test("cannot be pressed while it is disabled", async () => {
  const onPress = vi.fn();
  const screen = await render(
    <Button onPress={onPress} isDisabled>
      Try again
    </Button>,
  );
  const button = screen.getByRole("button", { name: "Try again" });

  await expect.element(button).toBeDisabled();
  await button.click({ force: true });

  expect(onPress).not.toHaveBeenCalled();
});
