import { expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { SearchField } from "./search-field";

// The search field of a list (docs/design-system.md, Lists; Forms), in the
// light theme.

// The colors of docs/design-system.md (Color Tokens) in the light theme.
const FG = "rgb(31, 35, 40)";
const SURFACE = "rgb(255, 255, 255)";
const BORDER_STRONG = "rgb(129, 139, 152)";

// The field of a fictional list, with the term that applies, and a control
// after it, which the focus can reach.
async function renderField(applied = "") {
  const onApply = vi.fn<(term: string) => void>();
  const field = (term: string) => (
    <>
      <SearchField
        placeholder="Search Records"
        applied={term}
        onApply={onApply}
        maxLength={50}
      />
      <Button>After</Button>
    </>
  );
  const screen = await render(field(applied));
  return {
    screen,
    onApply,
    rerender: (term: string) => screen.rerender(field(term)),
    input: screen.getByRole("searchbox", { name: "Search Records" }),
    clear: screen.getByRole("button", { name: "Clear search" }),
  };
}

type Field = Awaited<ReturnType<typeof renderField>>;

// The two ways to remove the term: the clear button, and Escape in the field.
// Escape first moves the pointer away from the clear button, where an earlier
// test can leave it, and waits until its tooltip does not show: while the
// tooltip shows, Escape hides it rather than reaching the field
// (docs/design-system.md, Menus, Popovers, and Tooltips).
const REMOVALS = [
  [
    "its clear button",
    async ({ clear }: Field) => {
      await clear.click();
    },
  ],
  [
    "Escape",
    async ({ screen, input }: Field) => {
      await screen.getByRole("button", { name: "After" }).hover();
      await expect.element(screen.getByRole("tooltip")).not.toBeInTheDocument();
      await input.click();
      await userEvent.keyboard("{Escape}");
    },
  ],
] as const;

test("is named by its placeholder, which it shows while it is empty", async () => {
  const { input } = await renderField();

  await expect.element(input).toBeVisible();
  await expect.element(input).toHaveValue("");
  await expect.element(input).toHaveAttribute("placeholder", "Search Records");
});

test("is 224 px wide and 32 px high, on surface with a border-strong boundary and a 6 px radius, in text-14 and fg", async () => {
  const { input } = await renderField("fictional-curl");

  await expect.element(input).toBeVisible();
  const box = input.element().getBoundingClientRect();
  const style = getComputedStyle(input.element());
  expect([box.width, box.height]).toEqual([224, 32]);
  expect([
    style.backgroundColor,
    style.borderTopColor,
    style.borderTopLeftRadius,
    style.fontSize,
    style.color,
  ]).toEqual([SURFACE, BORDER_STRONG, "6px", "14px", FG]);
});

test("applies the typed term with Enter, without its surrounding whitespace, and shows it", async () => {
  const { input, onApply } = await renderField();

  await input.fill("  fictional-curl ");
  await userEvent.keyboard("{Enter}");

  expect(onApply).toHaveBeenCalledExactlyOnceWith("fictional-curl");
  await expect.element(input).toHaveValue("fictional-curl");
});

test.each([
  ["as it is", "fictional-curl"],
  ["with surrounding whitespace", " fictional-curl  "],
])(
  "does not apply again with Enter the term that applies, %s",
  async (_, typed) => {
    const { input, onApply } = await renderField("fictional-curl");

    await input.fill(typed);
    await userEvent.keyboard("{Enter}");

    await expect.element(input).toHaveValue("fictional-curl");
    expect(onApply).not.toHaveBeenCalled();
  },
);

test.each([
  ["emptied", ""],
  ["of whitespace alone", "   "],
])(
  "removes the term that applies with Enter in a field %s",
  async (_, typed) => {
    const { input, onApply } = await renderField("fictional-curl");

    await input.fill(typed);
    await userEvent.keyboard("{Enter}");

    expect(onApply).toHaveBeenCalledExactlyOnceWith("");
    await expect.element(input).toHaveValue("");
  },
);

test("shows its clear button only with a value", async () => {
  const { input, clear } = await renderField();
  await expect.element(input).toBeVisible();
  expect(clear.query()).toBeNull();

  await input.fill("fictional-curl");

  await expect.element(clear).toBeVisible();
});

test.each(REMOVALS)(
  "removes the term that applies with %s, empties the field, and keeps the focus in it",
  async (_, remove) => {
    const field = await renderField("fictional-curl");
    await expect.element(field.input).toHaveValue("fictional-curl");

    await remove(field);

    expect(field.onApply).toHaveBeenCalledExactlyOnceWith("");
    await expect.element(field.input).toHaveValue("");
    await expect.element(field.input).toHaveFocus();
  },
);

test.each(REMOVALS)(
  "empties the field with %s without applying anything while no term applies",
  async (_, remove) => {
    const field = await renderField();
    await field.input.fill("fictional-curl");

    await remove(field);

    await expect.element(field.input).toHaveValue("");
    expect(field.onApply).not.toHaveBeenCalled();
  },
);

test("returns a typed term that is not applied to the applied one when the focus leaves the field", async () => {
  const { screen, input, onApply } = await renderField("fictional-curl");

  await input.fill("fictional-openssl");
  await userEvent.keyboard("{Tab}");

  await expect
    .element(screen.getByRole("button", { name: "After" }))
    .toHaveFocus();
  await expect.element(input).toHaveValue("fictional-curl");
  expect(onApply).not.toHaveBeenCalled();
});

test("shows the term that applies when it changes otherwise, as with back", async () => {
  const { input, rerender } = await renderField("fictional-curl");
  await input.fill("fictional-openssl");

  await rerender("fictional-zlib");
  await expect.element(input).toHaveValue("fictional-zlib");

  await rerender("");
  await expect.element(input).toHaveValue("");
});

test("accepts at most its longest term", async () => {
  const { input } = await renderField();

  await expect.element(input).toHaveAttribute("maxlength", "50");
});

test("names its clear button in a tooltip under the pointer", async () => {
  const { screen, clear } = await renderField("fictional-curl");
  // React Aria shows a tooltip on hover only once the user works with a
  // pointer, as a click shows.
  await screen.getByRole("button", { name: "After" }).click();

  await clear.hover();

  await expect
    .element(screen.getByRole("tooltip", { name: "Clear search" }))
    .toBeVisible();
});
