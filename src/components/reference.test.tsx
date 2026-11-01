import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Reference } from "./reference";

test('names the request after "Reference:", with its identifier in monospace', async () => {
  const screen = await render(
    <Reference requestId="01890a5d-ac96-774b-bcce-b302099a8057" />,
  );
  const identifier = screen.getByText("01890a5d-ac96-774b-bcce-b302099a8057", {
    exact: true,
  });

  await expect
    .element(
      screen.getByText("Reference: 01890a5d-ac96-774b-bcce-b302099a8057"),
    )
    .toBeVisible();
  expect(getComputedStyle(identifier.element()).fontFamily).toBe(
    "ui-monospace, monospace",
  );
});
