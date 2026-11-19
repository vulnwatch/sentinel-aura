import { useState } from "react";
import { expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { pointerAwayFrom } from "../test-pointer";
import { SegmentedControl, type SegmentedOption } from "./segmented-control";

// A segmented control (docs/design-system.md, Forms), in the light theme.

// The colors of docs/design-system.md (Color Tokens) in the light theme.
const FG = "rgb(31, 35, 40)";
const SURFACE = "rgb(255, 255, 255)";
const ACCENT = "rgb(9, 105, 218)";
const ON_ACCENT = "rgb(255, 255, 255)";

type Letter = "N" | "A" | "L" | "P";

const ATTACK_VECTOR: readonly SegmentedOption<Letter>[] = [
  { value: "N", label: "Network" },
  { value: "A", label: "Adjacent" },
  { value: "L", label: "Local" },
  { value: "P", label: "Physical" },
];

interface MetricProps {
  // The option chosen at first, if any.
  initial?: Letter | undefined;
  onChange?: (value: Letter) => void;
}

// The control of a metric, named by the name of the metric beside it and
// described by a note below it.
function Metric({ initial, onChange = () => undefined }: MetricProps) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <span id="metric-name">Attack vector</span>
      <SegmentedControl
        labelledBy="metric-name"
        describedBy="metric-note"
        options={ATTACK_VECTOR}
        value={value}
        onChange={(chosen) => {
          setValue(chosen);
          onChange(chosen);
        }}
      />
      <span id="metric-note">NVD: Network</span>
    </>
  );
}

function radioOf(screen: Awaited<ReturnType<typeof render>>, name: string) {
  return screen.getByRole("radio", { name, exact: true });
}

test("shows the chosen segment in accent, its label in on-accent at weight 500, and the others on surface, their labels in fg", async () => {
  const screen = await render(<Metric initial="L" />);

  await expect.element(radioOf(screen, "Local")).toBeChecked();
  // The pointer away from the segments, where an earlier test can leave it.
  await pointerAwayFrom(screen.getByRole("radiogroup"));
  const chosen = getComputedStyle(radioOf(screen, "Local").element());
  expect([chosen.backgroundColor, chosen.color, chosen.fontWeight]).toEqual([
    ACCENT,
    ON_ACCENT,
    "500",
  ]);
  const other = getComputedStyle(radioOf(screen, "Network").element());
  expect([other.backgroundColor, other.color]).toEqual([SURFACE, FG]);
});

test("is a group of radio buttons named by the element that names it and described by the one that describes it, each option a radio button named by its label, in their order", async () => {
  const screen = await render(<Metric />);

  const group = screen.getByRole("radiogroup", { name: "Attack vector" });
  await expect.element(group).toHaveAccessibleDescription("NVD: Network");
  expect(
    group
      .getByRole("radio")
      .elements()
      .map((radio) => radio.textContent),
  ).toEqual(["Network", "Adjacent", "Local", "Physical"]);
});

test("has no description without an element that describes it", async () => {
  const screen = await render(
    <>
      <span id="metric-name">Scope</span>
      <SegmentedControl
        labelledBy="metric-name"
        options={[
          { value: "U", label: "Unchanged" },
          { value: "C", label: "Changed" },
        ]}
        value="U"
        onChange={() => undefined}
      />
    </>,
  );

  await expect
    .element(screen.getByRole("radiogroup", { name: "Scope" }))
    .not.toHaveAccessibleDescription();
});

test("checks no option before the user chooses one", async () => {
  const screen = await render(<Metric />);

  await expect.element(radioOf(screen, "Network")).toBeVisible();
  for (const radio of screen.getByRole("radio").elements()) {
    expect(radio).not.toBeChecked();
  }
});

test("checks the option chosen alone", async () => {
  const screen = await render(<Metric initial="A" />);

  await expect.element(radioOf(screen, "Adjacent")).toBeChecked();
  for (const name of ["Network", "Local", "Physical"]) {
    await expect.element(radioOf(screen, name)).not.toBeChecked();
  }
});

test("gives the value of the option that the user chooses, which it then checks in place of the one chosen before", async () => {
  const onChange = vi.fn<(value: Letter) => void>();
  const screen = await render(<Metric initial="N" onChange={onChange} />);

  await radioOf(screen, "Local").click();

  expect(onChange).toHaveBeenCalledExactlyOnceWith("L");
  await expect.element(radioOf(screen, "Local")).toBeChecked();
  await expect.element(radioOf(screen, "Network")).not.toBeChecked();
});

test("keeps the option chosen when the user presses it again", async () => {
  const onChange = vi.fn<(value: Letter) => void>();
  const screen = await render(<Metric initial="N" onChange={onChange} />);

  await radioOf(screen, "Network").click();

  await expect.element(radioOf(screen, "Network")).toBeChecked();
  expect(screen.getByRole("radio", { checked: true }).elements()).toHaveLength(
    1,
  );
  for (const [value] of onChange.mock.calls) {
    expect(value).toBe("N");
  }
});

test("moves between its options with the arrow keys, and chooses one with Space", async () => {
  const onChange = vi.fn<(value: Letter) => void>();
  const screen = await render(<Metric onChange={onChange} />);

  await userEvent.keyboard("{Tab}");
  await expect.element(radioOf(screen, "Network")).toHaveFocus();
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(radioOf(screen, "Adjacent")).toHaveFocus();
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(radioOf(screen, "Local")).toHaveFocus();
  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(radioOf(screen, "Adjacent")).toHaveFocus();

  await userEvent.keyboard(" ");

  expect(onChange).toHaveBeenLastCalledWith("A");
  await expect.element(radioOf(screen, "Adjacent")).toBeChecked();
});
