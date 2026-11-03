import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { ConfidentialMark } from "./confidential-mark";

// The mark of a confidential Ticket (docs/design-system.md, Confidential
// Tickets), after the identifier of a Ticket in a cell of a table, as the
// Ticket list shows it, in the light theme.

// fg-muted of the light theme.
const FG_MUTED = "rgb(89, 99, 110)";

function renderAfterIdentifier() {
  return render(
    <table>
      <tbody>
        <tr>
          <td>
            <a href="/tickets/SNTL-42">SNTL-42</a>
            <ConfidentialMark />
          </td>
        </tr>
      </tbody>
    </table>,
  );
}

test("shows lock, named Confidential, after the identifier", async () => {
  const screen = await renderAfterIdentifier();
  const lock = screen.getByRole("img", { name: "Confidential", exact: true });

  await expect.element(lock).toBeVisible();
  await expect
    .element(
      screen.getByRole("cell", { name: "SNTL-42 Confidential", exact: true }),
    )
    .toBeVisible();
});

test("is 14 px in fg-muted, 4 px after the identifier, on its line", async () => {
  const screen = await renderAfterIdentifier();
  const lock = screen.getByRole("img", { name: "Confidential" }).element();
  const identifier = screen.getByRole("link", { name: "SNTL-42" }).element();
  const box = lock.getBoundingClientRect();
  const line = identifier.getBoundingClientRect();

  expect([box.width, box.height]).toEqual([14, 14]);
  expect(getComputedStyle(lock).color).toBe(FG_MUTED);
  expect(box.left - line.right).toBe(4);
  expect(box.top).toBeGreaterThanOrEqual(line.top);
  expect(box.bottom).toBeLessThanOrEqual(line.bottom);
});
