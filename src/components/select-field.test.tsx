import { useRef, useState } from "react";
import { Form } from "react-aria-components";
import { afterEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { SelectField, type FieldOption } from "./select-field";
import { Severity } from "./severity";

// A select of a form (docs/design-system.md, Forms), at the browser's
// default text size, in the light theme.

// The colors of docs/design-system.md (Color Tokens; Tones) in the light
// theme of the default color scheme.
const FG_MUTED = "rgb(89, 99, 110)";
const BORDER_STRONG = "rgb(129, 139, 152)";
const DANGER_ICON = "rgb(207, 34, 46)";
const DANGER_ON_SOFT = "rgb(164, 14, 38)";

type FictionalType = "advisory" | "patch" | "uncategorized";

const TYPES: readonly FieldOption<FictionalType>[] = [
  { value: "advisory", label: "Advisory" },
  { value: "patch", label: "Patch" },
  { value: "uncategorized", label: "Uncategorized" },
];

afterEach(() => {
  vi.restoreAllMocks();
});

interface TypeFormProps {
  onChange?: (value: FictionalType) => void;
  // The errors of the fields of the form, by their names.
  errors?: Record<string, string>;
}

// A form with the select of a type, Advisory at first.
function TypeForm({ onChange = () => undefined, errors = {} }: TypeFormProps) {
  const [value, setValue] = useState<FictionalType>("advisory");
  return (
    <Form validationErrors={errors}>
      <SelectField
        label="Type"
        name="type"
        options={TYPES}
        value={value}
        onChange={(chosen) => {
          setValue(chosen);
          onChange(chosen);
        }}
      />
    </Form>
  );
}

// The button of the select, named by the option that it shows and the
// label.
function selectOf(screen: Awaited<ReturnType<typeof render>>) {
  return screen.getByRole("button", { name: /Type$/ });
}

test("shows the option chosen in a button named by it and its label, which is above it", async () => {
  const screen = await render(<TypeForm />);
  const button = screen.getByRole("button", { name: "Advisory Type" });

  await expect.element(button).toBeVisible();
  expect(
    screen.getByText("Type", { exact: true }).element().getBoundingClientRect()
      .bottom,
  ).toBeLessThanOrEqual(button.element().getBoundingClientRect().top);
});

test("is a field-like button 40 px high, with a boundary in border-strong, that ends with an icon hidden from assistive technologies", async () => {
  const screen = await render(<TypeForm />);
  const button = selectOf(screen).element();

  expect(button.getBoundingClientRect().height).toBe(40);
  expect(getComputedStyle(button).borderTopColor).toBe(BORDER_STRONG);
  expect(getComputedStyle(button).borderTopWidth).toBe("1px");
  const icon = button.querySelector("svg");
  expect(icon?.getAttribute("aria-hidden")).toBe("true");
  expect(button.textContent).toBe("Advisory");
});

test("opens its options in their order below it, named by its label, the option chosen marked", async () => {
  const screen = await render(<TypeForm />);

  await selectOf(screen).click();

  const options = page.getByRole("listbox", { name: "Type" });
  await expect.element(options).toBeVisible();
  expect(
    options
      .getByRole("option")
      .elements()
      .map((option) => option.textContent),
  ).toEqual(["Advisory", "Patch", "Uncategorized"]);
  await expect
    .element(options.getByRole("option", { name: "Advisory" }))
    .toHaveAttribute("aria-selected", "true");
  await expect
    .element(options.getByRole("option", { name: "Patch" }))
    .toHaveAttribute("aria-selected", "false");
  expect(options.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
    selectOf(screen).element().getBoundingClientRect().bottom,
  );
});

test("gives the value of the option that the user chooses, and shows it", async () => {
  const onChange = vi.fn<(value: FictionalType) => void>();
  const screen = await render(<TypeForm onChange={onChange} />);
  await selectOf(screen).click();

  await page.getByRole("option", { name: "Uncategorized" }).click();

  expect(onChange).toHaveBeenCalledExactlyOnceWith("uncategorized");
  await expect
    .element(screen.getByRole("button", { name: "Uncategorized Type" }))
    .toHaveFocus();
});

test("chooses an option from the keyboard", async () => {
  const onChange = vi.fn<(value: FictionalType) => void>();
  const screen = await render(<TypeForm onChange={onChange} />);
  selectOf(screen).element().focus();

  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("listbox", { name: "Type" }))
    .toBeVisible();
  await userEvent.keyboard("{ArrowDown}");
  await userEvent.keyboard("{Enter}");

  expect(onChange).toHaveBeenCalledExactlyOnceWith("patch");
  await expect
    .element(screen.getByRole("button", { name: "Patch Type" }))
    .toBeVisible();
});

// A form with the select of a type, which no option is chosen in at first.
function UnchosenForm({
  onChange,
}: {
  onChange: (value: FictionalType) => void;
}) {
  const [value, setValue] = useState<FictionalType | null>(null);
  return (
    <Form>
      <SelectField
        label="Type"
        name="type"
        options={TYPES}
        value={value}
        onChange={(chosen) => {
          setValue(chosen);
          onChange(chosen);
        }}
      />
    </Form>
  );
}

test("shows itself empty, with no option marked, before the user chooses one, and then the option chosen", async () => {
  const onChange = vi.fn<(value: FictionalType) => void>();
  const screen = await render(<UnchosenForm onChange={onChange} />);
  await expect.element(selectOf(screen)).toBeVisible();
  expect(selectOf(screen).element().textContent).toBe("");

  await selectOf(screen).click();

  const options = page.getByRole("listbox", { name: "Type" });
  await expect.element(options).toBeVisible();
  for (const option of options.getByRole("option").elements()) {
    expect(option.getAttribute("aria-selected")).not.toBe("true");
  }
  await options.getByRole("option", { name: "Patch" }).click();

  expect(onChange).toHaveBeenCalledExactlyOnceWith("patch");
  await expect
    .element(screen.getByRole("button", { name: "Patch Type" }))
    .toBeVisible();
});

test("states the error of the form at its name after it, with a 2 px boundary in danger-icon", async () => {
  const screen = await render(
    <TypeForm errors={{ type: "This value isn't valid." }} />,
  );
  const button = selectOf(screen);

  const error = screen.getByText("This value isn't valid.");
  await expect.element(error).toBeVisible();
  expect(getComputedStyle(error.element()).color).toBe(DANGER_ON_SOFT);
  expect(error.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
    button.element().getBoundingClientRect().bottom,
  );
  expect(getComputedStyle(button.element()).borderTopColor).toBe(DANGER_ICON);
  expect(getComputedStyle(button.element()).borderTopWidth).toBe("2px");
  expect(button.element().getBoundingClientRect().height).toBe(40);
});

test("states no error of another field of the form", async () => {
  const screen = await render(
    <TypeForm errors={{ title: "This value isn't valid." }} />,
  );

  await expect.element(selectOf(screen)).toBeVisible();
  expect(screen.getByText("This value isn't valid.").query()).toBeNull();
  expect(getComputedStyle(selectOf(screen).element()).borderTopWidth).toBe(
    "1px",
  );
});

// A select whose form focuses its button.
function FocusedSelect() {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <SelectField
        label="Type"
        name="type"
        options={TYPES}
        value="patch"
        onChange={() => undefined}
        buttonRef={ref}
      />
      <Button
        onPress={() => {
          ref.current?.focus();
        }}
      >
        Focus the type
      </Button>
    </>
  );
}

test("lets the form reach its button", async () => {
  const screen = await render(<FocusedSelect />);

  await screen.getByRole("button", { name: "Focus the type" }).click();

  await expect
    .element(screen.getByRole("button", { name: "Patch Type" }))
    .toHaveFocus();
});

test("states in its label that it may stay empty, in fg-muted at weight 400 after the name at weight 500", async () => {
  const screen = await render(
    <SelectField
      label="Type"
      name="type"
      optional
      options={TYPES}
      value={null}
      onChange={() => undefined}
    />,
  );

  await expect
    .element(
      screen.getByRole("button", { name: "Type (optional)", exact: true }),
    )
    .toBeVisible();
  const suffix = screen.getByText("(optional)", { exact: true }).element();
  expect(getComputedStyle(suffix).color).toBe(FG_MUTED);
  expect(getComputedStyle(suffix).fontWeight).toBe("400");
  const label = screen.getByText("Type (optional)", { exact: true }).element();
  expect(getComputedStyle(label).fontWeight).toBe("500");
});

test("names a field that may not stay empty by its label alone", async () => {
  const screen = await render(<TypeForm />);

  await expect
    .element(screen.getByRole("button", { name: "Advisory Type", exact: true }))
    .toBeVisible();
  expect(screen.getByText("(optional)").query()).toBeNull();
});

type FictionalAssessment = "nvd" | "cna";

// Options that show a severity with its mark after their provider and their
// score, as the assessments of a select do.
const ASSESSMENTS: readonly FieldOption<FictionalAssessment>[] = [
  {
    value: "nvd",
    label: "NVD, 7.5 High",
    content: (
      <span className="inline-flex items-baseline gap-1">
        NVD, 7.5 <Severity severity="high" />
      </span>
    ),
  },
  {
    value: "cna",
    label: "Fictional CNA, 5.5 Medium",
    content: (
      <span className="inline-flex items-baseline gap-1">
        Fictional CNA, 5.5 <Severity severity="medium" />
      </span>
    ),
  },
];

// The marks of the severities in the light theme (docs/design-system.md,
// Severity Marks).
const MARK_HIGH = "rgb(247, 107, 21)";
const MARK_MEDIUM = "rgb(245, 196, 0)";

// The color of the mark of the severity that an element shows, a dot that is
// hidden from assistive technologies, or undefined without one.
function markOf(element: Element): string | undefined {
  const dot = element.querySelector('svg[aria-hidden="true"] circle');
  return dot === null ? undefined : getComputedStyle(dot).fill;
}

interface AssessmentFormProps {
  onChange: (value: FictionalAssessment) => void;
}

// A form with the select of an assessment, which no option is chosen in at
// first.
function AssessmentForm({ onChange }: AssessmentFormProps) {
  const [value, setValue] = useState<FictionalAssessment | null>(null);
  return (
    <Form>
      <SelectField
        label="Start from"
        name="start"
        options={ASSESSMENTS}
        value={value}
        onChange={(chosen) => {
          setValue(chosen);
          onChange(chosen);
        }}
      />
    </Form>
  );
}

test("shows the content of an option in the option and in the field once it is chosen, the option named by its label", async () => {
  const onChange = vi.fn<(value: FictionalAssessment) => void>();
  const screen = await render(<AssessmentForm onChange={onChange} />);
  const field = screen.getByRole("button", { name: /Start from$/ });

  await field.click();

  const options = page.getByRole("listbox", { name: "Start from" });
  const nvd = options.getByRole("option", {
    name: "NVD, 7.5 High",
    exact: true,
  });
  await expect.element(nvd).toBeVisible();
  expect(nvd.element().textContent).toBe("NVD, 7.5 High");
  expect(markOf(nvd.element())).toBe(MARK_HIGH);
  expect(
    markOf(
      options
        .getByRole("option", { name: "Fictional CNA, 5.5 Medium", exact: true })
        .element(),
    ),
  ).toBe(MARK_MEDIUM);

  await nvd.click();

  expect(onChange).toHaveBeenCalledExactlyOnceWith("nvd");
  const chosen = screen.getByRole("button", {
    name: "NVD, 7.5 High Start from",
    exact: true,
  });
  await expect.element(chosen).toBeVisible();
  expect(chosen.element().textContent).toBe("NVD, 7.5 High");
  expect(markOf(chosen.element())).toBe(MARK_HIGH);
});

test("lets the keyboard find an option with content by the text of its label", async () => {
  const onChange = vi.fn<(value: FictionalAssessment) => void>();
  const screen = await render(<AssessmentForm onChange={onChange} />);
  screen
    .getByRole("button", { name: /Start from$/ })
    .element()
    .focus();

  await userEvent.keyboard("f");

  expect(onChange).toHaveBeenCalledExactlyOnceWith("cna");
  const chosen = screen.getByRole("button", {
    name: "Fictional CNA, 5.5 Medium Start from",
    exact: true,
  });
  await expect.element(chosen).toBeVisible();
  expect(markOf(chosen.element())).toBe(MARK_MEDIUM);
});
