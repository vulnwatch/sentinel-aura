import { useRef, useState } from "react";
import { Form } from "react-aria-components";
import { afterEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { SelectField, type FieldOption } from "./select-field";

// A select of a form (docs/design-system.md, Forms), at the browser's
// default text size, in the light theme.

// The colors of docs/design-system.md (Color Tokens; Tones) in the light
// theme of the default color scheme.
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
