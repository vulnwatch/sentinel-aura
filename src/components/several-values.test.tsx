import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { SeveralValues } from "./several-values";

// A cell of a table with several values (docs/design-system.md, Tables), as
// the Ticket list shows the packages of a Ticket, in the light theme.

// The colors of docs/design-system.md (Tones) in the light theme.
const NEUTRAL_SOFT = "rgb(239, 242, 245)";
const NEUTRAL_ON_SOFT = "rgb(59, 67, 75)";

const PACKAGE = { one: "package", other: "packages" };

// The packages in a cell of a table, after a control that the tests use
// first: React Aria shows a tooltip on hover only once the user works with a
// pointer, as a click shows.
async function renderCell(values: readonly string[]) {
  const screen = await render(
    <>
      <Button>Before</Button>
      <table>
        <tbody>
          <tr>
            <td>
              <SeveralValues values={values} noun={PACKAGE} />
            </td>
          </tr>
        </tbody>
      </table>
    </>,
  );
  return { screen, cell: screen.getByRole("cell") };
}

type Screen = Awaited<ReturnType<typeof renderCell>>["screen"];

const THREE = ["fictional-curl", "fictional-libcurl4", "fictional-curl-mini"];

test("shows an absent value without values", async () => {
  const { screen } = await renderCell([]);

  await expect.element(screen.getByText("–", { exact: true })).toBeVisible();
  await expect
    .element(screen.getByRole("cell", { name: "Not set", exact: true }))
    .toBeVisible();
});

test("shows a single value alone", async () => {
  const { screen, cell } = await renderCell(["fictional-curl"]);

  await expect
    .element(screen.getByRole("cell", { name: "fictional-curl", exact: true }))
    .toBeVisible();
  expect(cell.getByRole("button").query()).toBeNull();
});

test("shows the first value, then +N, the number of the others, as a button named by the others, 6 px later", async () => {
  const { cell } = await renderCell(THREE);
  const first = cell.getByText("fictional-curl", { exact: true });
  const more = cell.getByRole("button", {
    name: "2 more packages: fictional-libcurl4, fictional-curl-mini",
    exact: true,
  });

  await expect.element(first).toBeVisible();
  await expect.element(more).toHaveTextContent("+2");
  expect(
    more.element().getBoundingClientRect().left -
      first.element().getBoundingClientRect().right,
  ).toBeCloseTo(6);
});

test("names the one other value in the singular", async () => {
  const { cell } = await renderCell(["fictional-curl", "fictional-libcurl4"]);

  await expect
    .element(
      cell.getByRole("button", {
        name: "1 more package: fictional-libcurl4",
        exact: true,
      }),
    )
    .toHaveTextContent("+1");
});

test("groups the thousands of the number of the others", async () => {
  const values = Array.from(
    { length: 1251 },
    (_, index) => `fictional-package-${index}`,
  );
  const { cell } = await renderCell(values);

  await expect
    .element(cell.getByRole("button", { name: /^1,250 more packages: / }))
    .toHaveTextContent("+1,250");
});

test("draws +N 24 px high in text-13, weight 500, neutral-on-soft on neutral-soft, with a 4 px radius", async () => {
  const { cell } = await renderCell(THREE);
  const more = cell.getByRole("button");

  await expect.element(more).toBeVisible();
  const style = getComputedStyle(more.element());
  expect([
    more.element().getBoundingClientRect().height,
    style.fontSize,
    style.fontWeight,
    style.color,
    style.backgroundColor,
    style.borderTopLeftRadius,
  ]).toEqual([24, "13px", "500", NEUTRAL_ON_SOFT, NEUTRAL_SOFT, "4px"]);
});

test.each([
  [
    "under the pointer",
    async (screen: Screen) => {
      await screen.getByRole("button", { name: "Before" }).click();
      await screen.getByRole("button", { name: /^2 more/ }).hover();
    },
  ],
  [
    "on keyboard focus",
    async (screen: Screen) => {
      // Away from +N, where an earlier test can leave the pointer, so that
      // the focus alone shows the tooltip.
      await screen.getByRole("button", { name: "Before" }).hover();
      await expect.element(screen.getByRole("tooltip")).not.toBeInTheDocument();
      await userEvent.keyboard("{Tab}{Tab}");
      await expect
        .element(screen.getByRole("button", { name: /^2 more/ }))
        .toHaveFocus();
    },
  ],
])(
  "lists every value, one a line, under their count, in its tooltip %s",
  async (_, show) => {
    const { screen } = await renderCell(THREE);
    await expect
      .element(screen.getByRole("button", { name: /^2 more/ }))
      .toBeVisible();

    await show(screen);

    const tooltip = screen.getByRole("tooltip");
    await expect.element(tooltip).toBeVisible();
    const count = tooltip.getByText("3 packages", { exact: true });
    const lines = tooltip.getByRole("listitem");
    expect(lines.elements().map((line) => line.textContent)).toEqual(THREE);
    let bottom = count.element().getBoundingClientRect().bottom;
    for (const line of lines.elements()) {
      const box = line.getBoundingClientRect();
      expect(box.top).toBeGreaterThanOrEqual(bottom);
      bottom = box.bottom;
    }
  },
);
