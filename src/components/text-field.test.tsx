import { useRef, useState } from "react";
import { Form } from "react-aria-components";
import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { TextField } from "./text-field";

// The colors of docs/design-system.md (Color Tokens; Tones) in the light
// theme of the default color scheme.
const BORDER_STRONG = "rgb(129, 139, 152)";
const DANGER_ICON = "rgb(207, 34, 46)";
const DANGER_ON_SOFT = "rgb(164, 14, 38)";

// A form with one field that may not stay empty.
function NameForm() {
  const [value, setValue] = useState("");
  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <TextField
        label="Name"
        name="name"
        value={value}
        onChange={setValue}
        validate={(name) => (name === "" ? "Enter a name." : null)}
      />
      <Button type="submit">Save</Button>
    </Form>
  );
}

test("names its control with its label, above it", async () => {
  const screen = await render(<NameForm />);
  const field = screen.getByRole("textbox", { name: "Name" });
  const label = screen.getByText("Name", { exact: true });

  await expect.element(field).toBeVisible();
  expect(label.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(
    field.element().getBoundingClientRect().top,
  );
});

test("is 40 px high, with a boundary in border-strong", async () => {
  const screen = await render(<NameForm />);
  const field = screen.getByRole("textbox", { name: "Name" }).element();

  expect(field.getBoundingClientRect().height).toBe(40);
  expect(getComputedStyle(field).borderTopColor).toBe(BORDER_STRONG);
  expect(getComputedStyle(field).borderTopWidth).toBe("1px");
});

test("states its error after it when the form is submitted, as the description of its control", async () => {
  const screen = await render(<NameForm />);
  const field = screen.getByRole("textbox", { name: "Name" });
  await expect
    .element(screen.getByText("Enter a name."))
    .not.toBeInTheDocument();

  await screen.getByRole("button", { name: "Save" }).click();

  const error = screen.getByText("Enter a name.");
  await expect.element(error).toBeVisible();
  await expect.element(field).toBeInvalid();
  await expect.element(field).toHaveAccessibleDescription("Enter a name.");
  await expect.element(field).toHaveFocus();
  expect(getComputedStyle(field.element()).borderTopColor).toBe(DANGER_ICON);
  expect(getComputedStyle(field.element()).borderTopWidth).toBe("2px");
  expect(field.element().getBoundingClientRect().height).toBe(40);
  expect(getComputedStyle(error.element()).color).toBe(DANGER_ON_SOFT);
  expect(error.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
    field.element().getBoundingClientRect().bottom,
  );
});

test("clears its error once the value is valid and the user leaves the field", async () => {
  const screen = await render(<NameForm />);
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Enter a name.")).toBeVisible();

  await screen.getByRole("textbox", { name: "Name" }).fill("Fictional name");
  await userEvent.keyboard("{Tab}");

  await expect
    .element(screen.getByText("Enter a name."))
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("textbox", { name: "Name" }))
    .not.toBeInvalid();
});

// A field whose form focuses its control.
function FocusedField() {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <TextField label="Name" inputRef={ref} />
      <Button
        onPress={() => {
          ref.current?.focus();
        }}
      >
        Focus the name
      </Button>
    </>
  );
}

test("lets the form reach its control", async () => {
  const screen = await render(<FocusedField />);

  await screen.getByRole("button", { name: "Focus the name" }).click();

  await expect
    .element(screen.getByRole("textbox", { name: "Name" }))
    .toHaveFocus();
});
