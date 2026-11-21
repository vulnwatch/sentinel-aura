import { createRef, useState } from "react";
import { Form } from "react-aria-components";
import { expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { RadioGroupField, type RadioOption } from "./radio-group";

// A group of radio buttons of a form (docs/design-system.md, Forms), at the
// browser's default text size, in the light theme.

// The colors of docs/design-system.md (Color Tokens; Tones) in the light
// theme.
const FG = "rgb(31, 35, 40)";
const FG_MUTED = "rgb(89, 99, 110)";
const DANGER_ON_SOFT = "rgb(164, 14, 38)";

type Delivery = "pickup" | "courier" | "post";

const DELIVERIES: readonly RadioOption<Delivery>[] = [
  {
    value: "pickup",
    label: "Pickup",
    description: "Collect the fictional parcel at the counter.",
  },
  {
    value: "courier",
    label: "Courier",
    description: "A fictional courier brings it the same day.",
  },
  {
    value: "post",
    label: "Post",
    description: "The fictional post brings it within a week.",
  },
];

interface DeliveryFormProps {
  // The option chosen at first, if any.
  initial?: Delivery | undefined;
  onChange?: (value: Delivery) => void;
  // The errors of the fields of the form, by their names.
  errors?: Record<string, string>;
  isReadOnly?: boolean;
}

// A form with the choice of a delivery.
function DeliveryForm({
  initial,
  onChange = () => undefined,
  errors = {},
  isReadOnly = false,
}: DeliveryFormProps) {
  const [value, setValue] = useState(initial);
  return (
    <Form validationErrors={errors}>
      <RadioGroupField
        label="Delivery"
        name="delivery"
        options={DELIVERIES}
        value={value}
        onChange={(chosen) => {
          setValue(chosen);
          onChange(chosen);
        }}
        isReadOnly={isReadOnly}
      />
    </Form>
  );
}

type Screen = Awaited<ReturnType<typeof render>>;

function groupOf(screen: Screen) {
  return screen.getByRole("radiogroup", { name: "Delivery", exact: true });
}

function radioOf(screen: Screen, name: string) {
  return screen.getByRole("radio", { name, exact: true });
}

function boxOf(screen: Screen, text: string): DOMRect {
  return screen
    .getByText(text, { exact: true })
    .element()
    .getBoundingClientRect();
}

// Waits until the browser has rendered two more frames, after which what a
// press set has rendered.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

test("is a group of radio buttons named by its label, each option a radio button named by its label and described by its meaning, in their order", async () => {
  const screen = await render(<DeliveryForm />);

  const group = groupOf(screen);
  await expect.element(group).toBeVisible();
  const radios = group.getByRole("radio").elements();
  expect(radios).toHaveLength(DELIVERIES.length);
  for (const [index, option] of DELIVERIES.entries()) {
    const radio = radioOf(screen, option.label);
    expect(radio.element()).toBe(radios[index]);
    await expect.element(radio).toHaveAccessibleDescription(option.description);
  }
});

test("shows its label above its options in text-15 at weight 500, then each option with its label in text-15 and its meaning below it in text-13, fg-muted, 12 px apart", async () => {
  const screen = await render(<DeliveryForm />);
  await expect.element(groupOf(screen)).toBeVisible();

  const label = getComputedStyle(
    screen.getByText("Delivery", { exact: true }).element(),
  );
  expect([label.fontSize, label.fontWeight]).toEqual(["15px", "500"]);
  expect(boxOf(screen, "Delivery").bottom).toBeLessThanOrEqual(
    boxOf(screen, "Pickup").top,
  );
  for (const option of DELIVERIES) {
    const name = getComputedStyle(
      screen.getByText(option.label, { exact: true }).element(),
    );
    expect([name.fontSize, name.color]).toEqual(["15px", FG]);
    const meaning = getComputedStyle(
      screen.getByText(option.description, { exact: true }).element(),
    );
    expect([meaning.fontSize, meaning.color]).toEqual(["13px", FG_MUTED]);
    expect(boxOf(screen, option.description).top).toBeGreaterThanOrEqual(
      boxOf(screen, option.label).bottom,
    );
  }
  expect(
    boxOf(screen, "Courier").top -
      boxOf(screen, DELIVERIES[0]!.description).bottom,
  ).toBe(12);
  expect(
    boxOf(screen, "Post").top -
      boxOf(screen, DELIVERIES[1]!.description).bottom,
  ).toBe(12);
});

test("checks no option before the user chooses one", async () => {
  const screen = await render(<DeliveryForm />);

  await expect.element(groupOf(screen)).toBeVisible();
  for (const radio of screen.getByRole("radio").elements()) {
    expect(radio).not.toBeChecked();
  }
});

test("checks the option chosen alone", async () => {
  const screen = await render(<DeliveryForm initial="courier" />);

  await expect.element(radioOf(screen, "Courier")).toBeChecked();
  for (const name of ["Pickup", "Post"]) {
    await expect.element(radioOf(screen, name)).not.toBeChecked();
  }
});

test("gives the value of the option that the user chooses with a press of its label or of its meaning, which it then checks in place of the one chosen before", async () => {
  const onChange = vi.fn<(value: Delivery) => void>();
  const screen = await render(<DeliveryForm onChange={onChange} />);

  await screen.getByText("Courier", { exact: true }).click();

  expect(onChange).toHaveBeenLastCalledWith("courier");
  await expect.element(radioOf(screen, "Courier")).toBeChecked();

  await screen.getByText("Post", { exact: true }).click();

  expect(onChange).toHaveBeenLastCalledWith("post");
  await expect.element(radioOf(screen, "Post")).toBeChecked();
  await expect.element(radioOf(screen, "Courier")).not.toBeChecked();

  await screen.getByText(DELIVERIES[0]!.description, { exact: true }).click();

  expect(onChange).toHaveBeenLastCalledWith("pickup");
  await expect.element(radioOf(screen, "Pickup")).toBeChecked();
  expect(onChange.mock.calls).toEqual([["courier"], ["post"], ["pickup"]]);
});

test("moves between its options with the arrow keys, which choose them", async () => {
  const onChange = vi.fn<(value: Delivery) => void>();
  const screen = await render(<DeliveryForm onChange={onChange} />);

  await userEvent.keyboard("{Tab}");
  await expect.element(radioOf(screen, "Pickup")).toHaveFocus();
  await userEvent.keyboard("{ArrowDown}");
  await expect.element(radioOf(screen, "Courier")).toHaveFocus();
  await expect.element(radioOf(screen, "Courier")).toBeChecked();
  await userEvent.keyboard("{ArrowDown}");
  await expect.element(radioOf(screen, "Post")).toHaveFocus();
  await userEvent.keyboard("{ArrowUp}");

  await expect.element(radioOf(screen, "Courier")).toHaveFocus();
  await expect.element(radioOf(screen, "Courier")).toBeChecked();
  expect(onChange).toHaveBeenLastCalledWith("courier");
});

test("states the error of the form after its options, in danger-on-soft, as the description of the group, which assistive technologies read with each option after its meaning", async () => {
  const screen = await render(
    <DeliveryForm errors={{ delivery: "Choose a delivery." }} />,
  );

  const error = screen.getByText("Choose a delivery.", { exact: true });
  await expect.element(error).toBeVisible();
  expect(getComputedStyle(error.element()).color).toBe(DANGER_ON_SOFT);
  expect(error.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
    boxOf(screen, DELIVERIES[2]!.description).bottom,
  );
  await expect
    .element(groupOf(screen))
    .toHaveAccessibleDescription("Choose a delivery.");
  for (const option of DELIVERIES) {
    await expect
      .element(radioOf(screen, option.label))
      .toHaveAccessibleDescription(`${option.description} Choose a delivery.`);
  }
});

test("states no error of another field of the form", async () => {
  const screen = await render(
    <DeliveryForm errors={{ title: "Choose a delivery." }} />,
  );

  await expect.element(groupOf(screen)).toBeVisible();
  expect(screen.getByText("Choose a delivery.").query()).toBeNull();
  await expect.element(groupOf(screen)).not.toHaveAccessibleDescription();
});

test("keeps the option chosen while it is read-only, from a press and from the arrow keys", async () => {
  const onChange = vi.fn<(value: Delivery) => void>();
  const screen = await render(
    <DeliveryForm initial="courier" onChange={onChange} isReadOnly />,
  );
  await expect
    .element(groupOf(screen))
    .toHaveAttribute("aria-readonly", "true");

  await screen.getByText("Post", { exact: true }).click();
  await screen.getByText(DELIVERIES[0]!.description, { exact: true }).click();
  radioOf(screen, "Courier").element().focus();
  await expect.element(radioOf(screen, "Courier")).toHaveFocus();
  await userEvent.keyboard("{ArrowDown}");
  await nextFrames();

  expect(onChange).not.toHaveBeenCalled();
  await expect.element(radioOf(screen, "Courier")).toBeChecked();
  await expect.element(radioOf(screen, "Post")).not.toBeChecked();
  await expect.element(radioOf(screen, "Pickup")).not.toBeChecked();
});

test("gives the form its group, in which the form finds the buttons that take the focus with an error", async () => {
  const group = createRef<HTMLDivElement>();
  const screen = await render(
    <RadioGroupField
      label="Delivery"
      name="delivery"
      options={DELIVERIES}
      value={undefined}
      onChange={() => undefined}
      groupRef={group}
    />,
  );

  await expect.element(groupOf(screen)).toBeVisible();
  expect(group.current).toBe(groupOf(screen).element());
});
