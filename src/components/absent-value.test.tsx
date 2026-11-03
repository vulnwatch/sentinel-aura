import type { ReactNode } from "react";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { AbsentValue } from "./absent-value";

// An absent value (docs/behaviors.md, Absent Values; docs/design-system.md,
// Other Values), in a cell of a table, as a screen shows a field without a
// value, in the light theme.

// fg-muted of the light theme.
const FG_MUTED = "rgb(89, 99, 110)";

function renderInCell(node: ReactNode) {
  return render(
    <table>
      <tbody>
        <tr>
          <td>{node}</td>
        </tr>
      </tbody>
    </table>,
  );
}

test("shows an en dash in fg-muted, which assistive technologies read as Not set", async () => {
  const screen = await renderInCell(<AbsentValue />);
  const dash = screen.getByText("–", { exact: true });
  const spoken = screen.getByText("Not set", { exact: true });

  await expect.element(dash).toBeVisible();
  expect(getComputedStyle(dash.element()).color).toBe(FG_MUTED);
  await expect
    .element(screen.getByRole("cell", { name: "Not set", exact: true }))
    .toBeVisible();
  // The words take no room on the screen.
  expect(spoken.element().getBoundingClientRect().width).toBeLessThanOrEqual(1);
});

test("shows the word that names the absence in place of the dash, in fg-muted", async () => {
  const screen = await renderInCell(<AbsentValue name="Unassigned" />);
  const name = screen.getByText("Unassigned", { exact: true });

  await expect.element(name).toBeVisible();
  expect(getComputedStyle(name.element()).color).toBe(FG_MUTED);
  await expect
    .element(screen.getByRole("cell", { name: "Unassigned", exact: true }))
    .toBeVisible();
  await expect.element(screen.getByText("–")).not.toBeInTheDocument();
  await expect.element(screen.getByText("Not set")).not.toBeInTheDocument();
});
