import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import {
  FilterGroup,
  Filters,
  FilterSelect,
  type FilterOption,
  type SelectOption,
} from "./filters";

// The filters of a list (docs/design-system.md, Lists; Menus, Popovers, and
// Tooltips), at a wide window, in the light theme.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

// The colors of docs/design-system.md (Color Tokens) in the light theme.
const FG_MUTED = "rgb(89, 99, 110)";
const SURFACE = "rgb(255, 255, 255)";
const BORDER = "rgb(216, 222, 228)";
const BORDER_STRONG = "rgb(129, 139, 152)";

type Severity = "critical" | "high" | "low";

const SEVERITIES: readonly FilterOption<Severity>[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
];

const PRIORITIES: readonly FilterOption<"p1" | "p2">[] = [
  { value: "p1", label: "P1" },
  { value: "p2", label: "P2" },
];

interface ListFiltersProps {
  // The severities that apply as the list starts.
  initial?: readonly Severity[];
  // Called with the severities that the user selects.
  onChange?: (values: Severity[]) => void;
}

// The filters of a fictional list, at the end of its toolbar, which apply the
// severities that the user selects, as the URL of a list keeps them.
function ListFilters({ initial = [], onChange }: ListFiltersProps) {
  const [severities, setSeverities] = useState<readonly Severity[]>(initial);
  return (
    <div className="flex justify-end p-8">
      <Filters applied={severities.length > 0 ? 1 : 0} status="">
        <FilterGroup
          label="Severity"
          options={SEVERITIES}
          selected={severities}
          onChange={(values) => {
            onChange?.(values);
            setSeverities(values);
          }}
        />
        <FilterGroup
          label="Priority"
          options={PRIORITIES}
          selected={[]}
          onChange={() => {}}
        />
      </Filters>
    </div>
  );
}

// Opens the popover of the filters, and returns it.
async function openFilters(button: Locator) {
  await button.click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  await expect.element(dialog).toBeVisible();
  return dialog;
}

// The popover around the dialog of the filters, the nearest element around it
// with a border line.
function popoverOf(dialog: Locator): Element {
  let element = dialog.element().parentElement;
  while (
    element !== null &&
    getComputedStyle(element).borderTopWidth !== "1px"
  ) {
    element = element.parentElement;
  }
  return element!;
}

test("is a secondary button 32 px high named Filters while no filter applies", async () => {
  const screen = await render(<ListFilters />);
  const button = screen.getByRole("button", { name: "Filters", exact: true });

  await expect.element(button).toBeVisible();
  // Away from the pointer, which an earlier test can leave over it.
  await userEvent.unhover(button);
  const style = getComputedStyle(button.element());
  expect([
    button.element().getBoundingClientRect().height,
    style.backgroundColor,
    style.borderTopColor,
  ]).toEqual([32, SURFACE, BORDER_STRONG]);
  expect(screen.container.textContent).toBe("Filters");
});

test("shows the number of the filters that apply after its label, which assistive technologies read as applied", async () => {
  const screen = await render(
    <Filters applied={2} status="">
      <FilterGroup
        label="Severity"
        options={SEVERITIES}
        selected={["high"]}
        onChange={() => {}}
      />
    </Filters>,
  );
  const button = screen.getByRole("button", {
    name: "Filters 2 applied",
    exact: true,
  });

  await expect.element(button).toBeVisible();
  await expect.element(button.getByText("2", { exact: true })).toBeVisible();
  // The words take no room on the screen.
  expect(
    button.getByText("applied").element().getBoundingClientRect().width,
  ).toBeLessThanOrEqual(1);
});

test("opens a dialog named Filters, whose first checkbox takes the focus, with each filter as a group named by its label and listing its values in order", async () => {
  const screen = await render(<ListFilters />);

  const dialog = await openFilters(
    screen.getByRole("button", { name: "Filters" }),
  );

  const groups = dialog.getByRole("group");
  expect(groups.elements()).toHaveLength(2);
  for (const [index, [name, values]] of (
    [
      ["Severity", ["Critical", "High", "Low"]],
      ["Priority", ["P1", "P2"]],
    ] as const
  ).entries()) {
    await expect.element(groups.nth(index)).toHaveAccessibleName(name);
    const boxes = groups.nth(index).getByRole("checkbox");
    expect(boxes.elements()).toHaveLength(values.length);
    for (const [position, value] of values.entries()) {
      await expect.element(boxes.nth(position)).toHaveAccessibleName(value);
      await expect.element(boxes.nth(position)).not.toBeChecked();
    }
  }
  await expect
    .element(dialog.getByRole("checkbox", { name: "Critical" }))
    .toHaveFocus();
});

test("applies the values that the user selects at once, in the order of the values of the filter", async () => {
  const onChange = vi.fn<(values: Severity[]) => void>();
  const screen = await render(<ListFilters onChange={onChange} />);
  const dialog = await openFilters(
    screen.getByRole("button", { name: "Filters" }),
  );
  const severity = dialog.getByRole("group", { name: "Severity" });

  await severity.getByText("Low", { exact: true }).click();
  expect(onChange).toHaveBeenLastCalledWith(["low"]);
  await severity.getByText("Critical", { exact: true }).click();
  expect(onChange).toHaveBeenLastCalledWith(["critical", "low"]);
  await severity.getByText("Low", { exact: true }).click();
  expect(onChange).toHaveBeenLastCalledWith(["critical"]);

  expect(onChange).toHaveBeenCalledTimes(3);
  // The popover stays, with the values that apply checked.
  await expect
    .element(severity.getByRole("checkbox", { name: "Critical" }))
    .toBeChecked();
  await expect
    .element(severity.getByRole("checkbox", { name: "Low" }))
    .not.toBeChecked();
});

test("shows the values that apply as checked", async () => {
  const screen = await render(<ListFilters initial={["critical", "low"]} />);

  const dialog = await openFilters(
    screen.getByRole("button", { name: "Filters 1 applied" }),
  );

  const severity = dialog.getByRole("group", { name: "Severity" });
  await expect
    .element(severity.getByRole("checkbox", { name: "Critical" }))
    .toBeChecked();
  await expect
    .element(severity.getByRole("checkbox", { name: "High" }))
    .not.toBeChecked();
  await expect
    .element(severity.getByRole("checkbox", { name: "Low" }))
    .toBeChecked();
});

test("closes with Escape, and returns the focus to Filters", async () => {
  const screen = await render(<ListFilters />);
  const button = screen.getByRole("button", { name: "Filters" });
  const dialog = await openFilters(button);
  await expect
    .element(dialog.getByRole("checkbox", { name: "Critical" }))
    .toHaveFocus();

  await userEvent.keyboard("{Escape}");

  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(button).toHaveFocus();
});

test("opens below Filters, aligned to its end, on surface with a border line, an 8 px radius, a shadow, and 16 px of padding, 448 px wide", async () => {
  const screen = await render(<ListFilters />);
  const button = screen.getByRole("button", { name: "Filters" });

  const dialog = await openFilters(button);

  const popover = popoverOf(dialog);
  const style = getComputedStyle(popover);
  expect([
    style.backgroundColor,
    style.borderTopColor,
    style.borderTopLeftRadius,
    style.paddingTop,
    style.paddingLeft,
  ]).toEqual([SURFACE, BORDER, "8px", "16px", "16px"]);
  expect(style.boxShadow).not.toBe("none");
  const box = popover.getBoundingClientRect();
  const trigger = button.element().getBoundingClientRect();
  expect(box.width).toBe(448);
  expect(box.top - trigger.bottom).toBe(4);
  expect(box.right).toBeCloseTo(trigger.right);
});

test("takes the width of a narrow window", async () => {
  await page.viewport(320, 640);
  const screen = await render(<ListFilters />);

  const dialog = await openFilters(
    screen.getByRole("button", { name: "Filters" }),
  );

  const box = popoverOf(dialog).getBoundingClientRect();
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(320);
});

test("names each filter in text-12, weight 500, fg-muted, and shows the filters 16 px apart", async () => {
  const screen = await render(<ListFilters />);

  const dialog = await openFilters(
    screen.getByRole("button", { name: "Filters" }),
  );

  const name = getComputedStyle(
    dialog.getByText("Severity", { exact: true }).element(),
  );
  expect([name.fontSize, name.fontWeight, name.color]).toEqual([
    "12px",
    "500",
    FG_MUTED,
  ]);
  expect(
    dialog
      .getByRole("group", { name: "Priority" })
      .element()
      .getBoundingClientRect().top -
      dialog
        .getByRole("group", { name: "Severity" })
        .element()
        .getBoundingClientRect().bottom,
  ).toBe(16);
});

test("announces its status in a status region of its own, which stays within reach while it is open", async () => {
  const screen = await render(
    <Filters applied={1} status="3 Tickets">
      <FilterGroup
        label="Severity"
        options={SEVERITIES}
        selected={["high"]}
        onChange={() => {}}
      />
    </Filters>,
  );

  const dialog = await openFilters(
    screen.getByRole("button", { name: "Filters 1 applied" }),
  );

  await expect
    .element(dialog.getByRole("status"))
    .toHaveTextContent("3 Tickets");
});

test("scrolls its filters within it in a window shorter than they are, as at a high zoom", async () => {
  await page.viewport(1280, 160);
  const screen = await render(<ListFilters />);

  const dialog = await openFilters(
    screen.getByRole("button", { name: "Filters" }),
  );

  const popover = popoverOf(dialog);
  expect(getComputedStyle(popover).overflowY).toBe("auto");
  expect(popover.scrollHeight).toBeGreaterThan(popover.clientHeight);
  // The label of the last value, which scrolling brings into the popover,
  // within the window.
  const last = dialog.getByText("P2", { exact: true });
  last.element().scrollIntoView({ block: "nearest" });
  await expect
    .poll(() => last.element().getBoundingClientRect().bottom)
    .toBeLessThanOrEqual(popover.getBoundingClientRect().bottom);
  expect(popover.getBoundingClientRect().bottom).toBeLessThanOrEqual(160);
});

// The options of a fictional select of the actor: Any actor and System, then
// two users, each by the label that the screen gives it.
const ACTORS: readonly (readonly SelectOption<string>[])[] = [
  [
    { value: "any", text: "Any actor", label: "Any actor" },
    { value: "system", text: "System", label: "System" },
  ],
  [
    { value: "agarcia", text: "Ana Garcia", label: "Ana Garcia" },
    { value: "rlee", text: "Robert Lee", label: <i>Robert Lee</i> },
  ],
];

interface ActorFiltersProps {
  // The groups of the options.
  groups?: readonly (readonly SelectOption<string>[])[];
  // The value that applies as the list starts.
  initial?: string;
  // In place of the options that the filter reads.
  status?: ReactNode;
  // Called with the value that the user chooses.
  onChange?: (value: string) => void;
}

// The filters of a fictional list whose first filter is a select of the
// actor, which applies the value that the user chooses, as the URL of a list
// keeps it.
function ActorFilters({
  groups = ACTORS,
  initial = "any",
  status,
  onChange,
}: ActorFiltersProps) {
  const [selected, setSelected] = useState(initial);
  return (
    <div className="flex justify-end p-8">
      <Filters applied={0} status="">
        <FilterSelect
          label="Actor"
          groups={groups}
          status={status}
          selected={selected}
          unlisted={<span>Fictional unknown actor</span>}
          onChange={(value) => {
            onChange?.(value);
            setSelected(value);
          }}
        />
        <FilterGroup
          label="Severity"
          options={SEVERITIES}
          selected={[]}
          onChange={() => {}}
        />
      </Filters>
    </div>
  );
}

// The select of the actor in the popover of the filters, named by the option
// that it shows and its name.
function actorSelect(dialog: Locator) {
  return dialog.getByRole("button", { name: /Actor$/ });
}

// Opens the options of the select, and returns them.
async function openOptions(dialog: Locator) {
  await actorSelect(dialog).click();
  const options = page.getByRole("listbox", { name: "Actor" });
  await expect.element(options).toBeVisible();
  return options;
}

describe("a select", () => {
  test("is a field-like button 40 px high on surface with a border-strong boundary, named by its name above it and showing the option that applies, which takes the focus as the filters open", async () => {
    const screen = await render(<ActorFilters />);

    const dialog = await openFilters(
      screen.getByRole("button", { name: "Filters" }),
    );

    const select = actorSelect(dialog);
    await expect.element(select).toHaveAccessibleName("Any actor Actor");
    await expect.element(select).toHaveFocus();
    const box = select.element().getBoundingClientRect();
    const style = getComputedStyle(select.element());
    expect([
      box.height,
      style.backgroundColor,
      style.borderTopColor,
      style.fontSize,
    ]).toEqual([40, SURFACE, BORDER_STRONG, "15px"]);
    // Its name in the style of the name of a group of checkboxes, 4 px
    // above it, and the select 16 px above the next filter.
    const name = dialog.getByText("Actor", { exact: true }).element();
    const nameStyle = getComputedStyle(name);
    expect([nameStyle.fontSize, nameStyle.fontWeight, nameStyle.color]).toEqual(
      ["12px", "500", FG_MUTED],
    );
    expect(box.top - name.getBoundingClientRect().bottom).toBe(4);
    expect(
      dialog
        .getByRole("group", { name: "Severity" })
        .element()
        .getBoundingClientRect().top - box.bottom,
    ).toBe(16);
    // chevron-down at its end, hidden from assistive technologies.
    const chevron = [...select.element().querySelectorAll("svg")].at(-1);
    expect(chevron?.getAttribute("aria-hidden")).toBe("true");
    // Its 16 px of side padding inside its boundary of 1 px.
    expect(box.right - (chevron?.getBoundingClientRect().right ?? 0)).toBe(17);
  });

  test("opens its options below it, at least as wide as it, in their groups and order, a line in border between two groups, with the option that applies selected", async () => {
    const screen = await render(<ActorFilters />);
    const dialog = await openFilters(
      screen.getByRole("button", { name: "Filters" }),
    );

    const options = await openOptions(dialog);

    const items = options.getByRole("option");
    expect(items.elements().map((item) => item.textContent)).toEqual([
      "Any actor",
      "System",
      "Ana Garcia",
      "Robert Lee",
    ]);
    await expect
      .element(items.first())
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(items.nth(1))
      .toHaveAttribute("aria-selected", "false");
    // The groups, the second with its line at its top.
    const groups = options.getByRole("group");
    expect(groups.elements()).toHaveLength(2);
    const line = groups.nth(1).element().getBoundingClientRect();
    expect(line.top).toBeGreaterThanOrEqual(
      items.nth(1).element().getBoundingClientRect().bottom,
    );
    expect(line.top).toBeLessThanOrEqual(
      items.nth(2).element().getBoundingClientRect().top,
    );
    expect(getComputedStyle(groups.nth(1).element()).borderTopColor).toBe(
      BORDER,
    );
    expect(getComputedStyle(groups.nth(1).element()).borderTopWidth).toBe(
      "1px",
    );
    expect(getComputedStyle(groups.first().element()).borderTopWidth).toBe(
      "0px",
    );
    const button = actorSelect(dialog).element().getBoundingClientRect();
    const menu = page
      .getByRole("dialog", { name: "Actor" })
      .element()
      .getBoundingClientRect();
    expect(menu.top).toBeGreaterThan(button.bottom);
    expect(menu.width).toBeGreaterThanOrEqual(button.width);
    // Each option at least 36 px high.
    expect(items.first().element().getBoundingClientRect().height).toBe(36);
  });

  test("shows no group without options, and no line for it", async () => {
    const [fixed = []] = ACTORS;
    const screen = await render(<ActorFilters groups={[fixed, []]} />);
    const dialog = await openFilters(
      screen.getByRole("button", { name: "Filters" }),
    );

    const options = await openOptions(dialog);

    expect(
      options
        .getByRole("option")
        .elements()
        .map((item) => item.textContent),
    ).toEqual(["Any actor", "System"]);
    expect(options.getByRole("group").elements()).toHaveLength(1);
  });

  test("applies the option that the user chooses at once, and shows it as the option shows", async () => {
    const onChange = vi.fn<(value: string) => void>();
    const screen = await render(<ActorFilters onChange={onChange} />);
    const dialog = await openFilters(
      screen.getByRole("button", { name: "Filters" }),
    );
    const options = await openOptions(dialog);

    await options.getByRole("option", { name: "Robert Lee" }).click();

    expect(onChange).toHaveBeenCalledExactlyOnceWith("rlee");
    await expect.element(options).not.toBeInTheDocument();
    await expect
      .element(actorSelect(dialog))
      .toHaveAccessibleName("Robert Lee Actor");
    // As the option shows it, in its own markup.
    expect(actorSelect(dialog).element().querySelector("i")?.textContent).toBe(
      "Robert Lee",
    );
    // The popover of the filters stays.
    await expect.element(dialog).toBeVisible();
  });

  test("finds an option by its text from the keyboard", async () => {
    const onChange = vi.fn<(value: string) => void>();
    const screen = await render(<ActorFilters onChange={onChange} />);
    await openFilters(screen.getByRole("button", { name: "Filters" }));

    await userEvent.keyboard("{ArrowDown}");
    await expect
      .element(page.getByRole("listbox", { name: "Actor" }))
      .toBeVisible();
    // The start of the text of Ana Garcia, and not of the value of her
    // option, agarcia, nor of Any actor, which has the focus.
    await userEvent.keyboard("ana");
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith("agarcia");
  });

  test("shows what the screen gives for a value that applies but is not among its options", async () => {
    const screen = await render(<ActorFilters initial="fictional-actor" />);

    const dialog = await openFilters(
      screen.getByRole("button", { name: "Filters" }),
    );

    await expect
      .element(actorSelect(dialog))
      .toHaveAccessibleName("Fictional unknown actor Actor");
  });

  test("shows the status of the options that it reads after its options, such as the message of a failure", async () => {
    const screen = await render(
      <ActorFilters
        groups={ACTORS.slice(0, 1)}
        status={<p>Fictional failure of the read of the users.</p>}
      />,
    );
    const dialog = await openFilters(
      screen.getByRole("button", { name: "Filters" }),
    );

    const options = await openOptions(dialog);

    const status = page.getByText(
      "Fictional failure of the read of the users.",
    );
    await expect.element(status).toBeVisible();
    expect(status.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
      options.getByRole("option").last().element().getBoundingClientRect()
        .bottom,
    );
    // In a status region of the menu, which assistive technologies announce
    // while the menu holds the focus.
    await expect
      .element(page.getByRole("dialog", { name: "Actor" }).getByRole("status"))
      .toHaveTextContent("Fictional failure of the read of the users.");
    // And it describes the options, so that it is read as the menu opens,
    // also when the status was there before it opened.
    await expect
      .element(page.getByRole("listbox", { name: "Actor" }))
      .toHaveAccessibleDescription(
        "Fictional failure of the read of the users.",
      );
  });

  test("keeps the status region of its menu before its status arrives, so that the region announces it", async () => {
    const screen = await render(<ActorFilters groups={ACTORS.slice(0, 1)} />);
    const dialog = await openFilters(
      screen.getByRole("button", { name: "Filters" }),
    );
    await openOptions(dialog);
    const status = page
      .getByRole("dialog", { name: "Actor" })
      .getByRole("status");
    await expect.element(status).toBeInTheDocument();
    expect(status.element().textContent).toBe("");
    const region = status.element();

    await screen.rerender(
      <ActorFilters
        groups={ACTORS.slice(0, 1)}
        status={<p>Fictional failure of the read of the users.</p>}
      />,
    );

    await expect
      .element(status)
      .toHaveTextContent("Fictional failure of the read of the users.");
    // The same region, which the status fills.
    expect(status.element()).toBe(region);
  });
});
