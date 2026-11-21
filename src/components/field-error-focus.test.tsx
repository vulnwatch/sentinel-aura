import { useEffect, useRef, useState, type FormEvent } from "react";
import { Form } from "react-aria-components";
import { afterEach, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { useFieldErrorFocus } from "./field-error-focus";
import { TextField } from "./text-field";

// The focus after a submission whose errors are at fields alone, and the
// announcement of the error of a field that holds the focus already
// (docs/behaviors.md, Accessibility, Announcements).

afterEach(async () => {
  await cleanup();
});

const MESSAGE_NAME = "Enter the name.";
const MESSAGE_CODE = "Enter the code.";

interface CheckedFormProps {
  // Whether the form drops the error of its field, as it can without an
  // event of the field.
  drops?: boolean;
}

// A form that checks its fields itself as it is submitted, and gives the
// first field with an error its error, a new object for each submission.
function CheckedForm({ drops = false }: CheckedFormProps) {
  const [name, setName] = useState("");
  const [checked, setFailure] = useState<{ text: string }>();
  const failure = drops ? undefined : checked;
  const nameRef = useRef<HTMLInputElement>(null);
  const { focusField, region } = useFieldErrorFocus(failure !== undefined);
  useEffect(() => {
    if (failure !== undefined) {
      focusField(nameRef.current, failure.text);
    }
  }, [failure, focusField]);
  return (
    <Form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFailure(name.trim() === "" ? { text: MESSAGE_NAME } : undefined);
      }}
    >
      <TextField
        label="Name"
        value={name}
        onChange={(value) => {
          setName(value);
          setFailure(undefined);
        }}
        inputRef={nameRef}
        error={failure?.text}
      />
      <TextField label="Note" optional />
      {region}
      <Button type="submit">Save</Button>
    </Form>
  );
}

// The check of a code, which the browser applies as the form is submitted.
function required(value: string): string | null {
  return value === "" ? MESSAGE_CODE : null;
}

// A form whose fields the browser checks as it is submitted.
function NativeForm() {
  const { formRef, region } = useFieldErrorFocus();
  return (
    <Form
      ref={formRef}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
      }}
    >
      <TextField label="Code" name="code" validate={required} />
      <TextField label="Other code" name="other" validate={required} />
      {region}
      <Button type="submit">Save</Button>
    </Form>
  );
}

type Screen = Awaited<ReturnType<typeof render>>;

// Waits for the two animation frames in which React renders what the
// submission set and runs the effects of that render.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

function field(screen: Screen, name: string) {
  return screen.getByRole("textbox", { name, exact: true });
}

// The texts of the status regions of the form.
function statusTexts(screen: Screen): string[] {
  return screen
    .getByRole("status")
    .elements()
    .map((status) => status.textContent ?? "");
}

// The node that the status region added for the text, which assistive
// technologies announce as it is added.
function announcedNode(screen: Screen, text: string): Element | undefined {
  return (
    screen
      .getByRole("status")
      .elements()
      .find((status) => status.textContent === text)?.firstElementChild ??
    undefined
  );
}

test("announces the error of the field that holds the focus as the form is submitted, as after Enter in it, and keeps the focus there", async () => {
  const screen = await render(<CheckedForm />);
  const name = field(screen, "Name");
  await name.click();

  await userEvent.keyboard("{Enter}");

  await expect.element(name).toHaveAccessibleDescription(MESSAGE_NAME);
  await expect.poll(() => statusTexts(screen)).toEqual([MESSAGE_NAME]);
  await expect.element(name).toHaveFocus();
});

test("moves the focus to the field with the error when the focus is elsewhere, which reads the error with the field, without announcing it as well", async () => {
  const screen = await render(<CheckedForm />);

  await screen.getByRole("button", { name: "Save" }).click();

  const name = field(screen, "Name");
  await expect.element(name).toHaveFocus();
  await expect.element(name).toHaveAccessibleDescription(MESSAGE_NAME);
  await nextFrames();
  expect(statusTexts(screen)).toEqual([""]);
});

test("announces the same error again for each submission", async () => {
  const screen = await render(<CheckedForm />);
  await field(screen, "Name").click();
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => announcedNode(screen, MESSAGE_NAME)).toBeDefined();
  const first = announcedNode(screen, MESSAGE_NAME);

  await userEvent.keyboard("{Enter}");

  await expect.poll(() => announcedNode(screen, MESSAGE_NAME)).not.toBe(first);
  expect(announcedNode(screen, MESSAGE_NAME)).toBeDefined();
});

test.each<[string, () => Promise<void>]>([
  [
    "the input of the field changes",
    async () => {
      await userEvent.keyboard("J");
    },
  ],
  [
    "the field loses the focus",
    async () => {
      await userEvent.keyboard("{Tab}");
    },
  ],
])(
  "empties the region once %s, so that it does not repeat the error later",
  async (_, leave) => {
    const screen = await render(<CheckedForm />);
    await field(screen, "Name").click();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => statusTexts(screen)).toEqual([MESSAGE_NAME]);

    await leave();

    await expect.poll(() => statusTexts(screen)).toEqual([""]);
  },
);

test("empties the region once the form no longer shows the error, also without an event of the field", async () => {
  const screen = await render(<CheckedForm />);
  const name = field(screen, "Name");
  await name.click();
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => statusTexts(screen)).toEqual([MESSAGE_NAME]);

  await screen.rerender(<CheckedForm drops />);

  await expect.element(name).toHaveAccessibleDescription("");
  await expect.poll(() => statusTexts(screen)).toEqual([""]);
  await expect.element(name).toHaveFocus();
});

test("keeps every key that the user types as the region empties", async () => {
  const screen = await render(<CheckedForm />);
  const name = field(screen, "Name");
  await name.click();
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => statusTexts(screen)).toEqual([MESSAGE_NAME]);

  await userEvent.keyboard("Jo");

  await expect.element(name).toHaveValue("Jo");
});

test("announces the error of the browser's check of the field that holds the focus, as after Enter in it", async () => {
  const screen = await render(<NativeForm />);
  const code = field(screen, "Code");
  await code.click();

  await userEvent.keyboard("{Enter}");

  await expect.element(code).toHaveAccessibleDescription(MESSAGE_CODE);
  await expect.poll(() => statusTexts(screen)).toEqual([MESSAGE_CODE]);
  await expect.element(code).toHaveFocus();
});

test.each<[string, (screen: Screen) => Promise<void>]>([
  [
    "from the submit button",
    async (screen) => {
      await screen.getByRole("button", { name: "Save" }).click();
    },
  ],
  [
    "from a later field that fails the check too",
    async (screen) => {
      await field(screen, "Other code").click();
      await userEvent.keyboard("{Enter}");
    },
  ],
])(
  "moves the focus to the first field that fails the browser's check %s, without announcing its error",
  async (_, submit) => {
    const screen = await render(<NativeForm />);

    await submit(screen);

    const code = field(screen, "Code");
    await expect.element(code).toHaveFocus();
    await expect.element(code).toHaveAccessibleDescription(MESSAGE_CODE);
    await nextFrames();
    expect(statusTexts(screen)).toEqual([""]);
  },
);
