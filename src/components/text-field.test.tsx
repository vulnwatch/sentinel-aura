import { useRef, useState } from "react";
import { Form } from "react-aria-components";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { TextAreaField, TextField } from "./text-field";

// The colors of docs/design-system.md (Color Tokens; Tones) in the light
// theme of the default color scheme.
const FG_MUTED = "rgb(89, 99, 110)";
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

test("states in its label that it may stay empty, in fg-muted at weight 400 after the name at weight 500", async () => {
  const screen = await render(<TextField label="Title" optional />);

  const field = screen.getByRole("textbox", { name: "Title (optional)" });
  await expect.element(field).toBeVisible();
  const suffix = screen.getByText("(optional)").element();
  expect(getComputedStyle(suffix).color).toBe(FG_MUTED);
  expect(getComputedStyle(suffix).fontWeight).toBe("400");
  const label = screen.getByText("Title (optional)").element();
  expect(getComputedStyle(label).fontWeight).toBe("500");
});

test("names a field that may not stay empty by its label alone", async () => {
  const screen = await render(<TextField label="Address" />);

  await expect
    .element(screen.getByRole("textbox", { name: "Address", exact: true }))
    .toBeVisible();
  expect(screen.getByText("(optional)").query()).toBeNull();
});

// A form with a multi-line field of at most 20 characters.
function DescriptionForm() {
  const [value, setValue] = useState("");
  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <TextAreaField
        label="Description"
        name="description"
        optional
        value={value}
        onChange={setValue}
        validate={(text) =>
          text.length > 20 ? "Enter at most 20 characters." : null
        }
      />
      <Button type="submit">Save</Button>
    </Form>
  );
}

// A multi-line field whose form focuses its control.
function FocusedArea() {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <TextAreaField label="Description" inputRef={ref} />
      <Button
        onPress={() => {
          ref.current?.focus();
        }}
      >
        Focus the description
      </Button>
    </>
  );
}

describe("a multi-line field", () => {
  test("names its control with its label, above it, and keeps the line breaks of its text", async () => {
    const screen = await render(<DescriptionForm />);
    const field = screen.getByRole("textbox", {
      name: "Description (optional)",
    });

    await field.fill("First line\nSecond line");

    await expect.element(field).toHaveValue("First line\nSecond line");
    expect(
      screen
        .getByText("Description (optional)")
        .element()
        .getBoundingClientRect().bottom,
    ).toBeLessThanOrEqual(field.element().getBoundingClientRect().top);
  });

  test("is at least 88 px high, three lines of text, with a boundary in border-strong, and lets the user make it taller", async () => {
    const screen = await render(<DescriptionForm />);
    const field = screen
      .getByRole("textbox", { name: "Description (optional)" })
      .element();

    expect(field.getBoundingClientRect().height).toBeGreaterThanOrEqual(88);
    expect(getComputedStyle(field).borderTopColor).toBe(BORDER_STRONG);
    expect(getComputedStyle(field).borderTopWidth).toBe("1px");
    expect(getComputedStyle(field).resize).toBe("vertical");
    // Three lines of text fit without scrolling.
    await screen
      .getByRole("textbox", { name: "Description (optional)" })
      .fill("One\nTwo\nThree");
    expect(field.scrollHeight).toBeLessThanOrEqual(field.clientHeight);
  });

  test("states its error after it when the form is submitted, as the description of its control", async () => {
    const screen = await render(<DescriptionForm />);
    const field = screen.getByRole("textbox", {
      name: "Description (optional)",
    });
    await field.fill("A fictional description too long");
    // From the keyboard: leaving the field shows its error, which moves the
    // button away from the pointer before its press ends.
    screen.getByRole("button", { name: "Save" }).element().focus();

    await userEvent.keyboard("{Enter}");

    const error = screen.getByText("Enter at most 20 characters.");
    await expect.element(error).toBeVisible();
    await expect.element(field).toBeInvalid();
    await expect
      .element(field)
      .toHaveAccessibleDescription("Enter at most 20 characters.");
    await expect.element(field).toHaveFocus();
    expect(getComputedStyle(field.element()).borderTopColor).toBe(DANGER_ICON);
    expect(getComputedStyle(field.element()).borderTopWidth).toBe("2px");
    expect(error.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
      field.element().getBoundingClientRect().bottom,
    );
  });

  test("lets the form reach its control", async () => {
    const screen = await render(<FocusedArea />);

    await screen.getByRole("button", { name: "Focus the description" }).click();

    await expect
      .element(screen.getByRole("textbox", { name: "Description" }))
      .toHaveFocus();
  });
});
