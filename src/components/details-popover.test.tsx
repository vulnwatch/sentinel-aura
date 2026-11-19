import { Ban, UserPen } from "lucide-react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { DescriptionItem, DescriptionList } from "./description-list";
import { DetailsName, DetailsValue, ValueRecords } from "./details-popover";
import { MenuAction } from "./menu";
import { ScreenHeading } from "./screen-heading";

// A name that opens a popover with the details of its record
// (docs/design-system.md, Menus, Popovers, and Tooltips), at a wide window,
// in the light theme.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

// The colors of docs/design-system.md (Color Tokens) in the light theme.
const FG = "rgb(31, 35, 40)";
const FG_MUTED = "rgb(89, 99, 110)";
const SURFACE = "rgb(255, 255, 255)";
const BORDER = "rgb(216, 222, 228)";
const BORDER_STRONG = "rgb(129, 139, 152)";

const NAME = "Fictional Linux Enterprise Server 15 SP7";

interface RecordProps {
  // The class of the color of the text around the name.
  tone?: string;
  // The width of the place of the name.
  width?: string;
  // Whether the name shows.
  shown?: boolean;
}

// The name of a fictional Product in the text around it, with the screen's
// heading, which takes the focus when the name leaves the page.
function Record({
  tone = "text-fg",
  width = "w-96",
  shown = true,
}: RecordProps) {
  return (
    <main className="p-4">
      <ScreenHeading>Fictional record</ScreenHeading>
      <p className={`${width} text-14 ${tone}`}>
        {shown && (
          <DetailsName
            name={NAME}
            identifier={
              <span className="font-mono">cpe:/o:example:fles:15:sp7</span>
            }
          >
            <DescriptionList>
              <DescriptionItem term="Lifecycle">
                General support
              </DescriptionItem>
            </DescriptionList>
          </DetailsName>
        )}
      </p>
    </main>
  );
}

test("is a button in the style of the text around it, with a dotted underline in border-strong 3 px below it, at least 24 px high", async () => {
  const screen = await render(<Record tone="text-fg-muted" />);
  const name = screen.getByRole("button", { name: NAME });
  // The pointer away from the name, where an earlier test may have left it.
  await screen.getByRole("heading", { level: 1 }).hover();

  const style = getComputedStyle(name.element());
  expect(style.color).toBe(FG_MUTED);
  expect(style.fontSize).toBe("14px");
  expect(style.textDecorationLine).toBe("underline");
  expect(style.textDecorationStyle).toBe("dotted");
  expect(style.textDecorationColor).toBe(BORDER_STRONG);
  expect(style.textUnderlineOffset).toBe("3px");
  expect(name.element().getBoundingClientRect().height).toBeGreaterThanOrEqual(
    24,
  );

  await name.hover();

  await expect
    .poll(() => getComputedStyle(name.element()).textDecorationColor)
    .toBe(FG);
});

test("wraps where its place is too narrow", async () => {
  const screen = await render(<Record width="w-32" />);
  const name = screen.getByRole("button", { name: NAME });

  expect(name.element().getBoundingClientRect().width).toBeLessThanOrEqual(128);
  expect(name.element().getBoundingClientRect().height).toBeGreaterThan(24);
});

test("opens its popover, 320 px wide, which takes the focus, with its title, what identifies the record, a line, and the details", async () => {
  const screen = await render(<Record />);
  const name = screen.getByRole("button", { name: NAME });

  await name.click();

  const popover = screen.getByRole("dialog", { name: NAME });
  await expect.element(popover).toHaveFocus();
  const frame = popover.element().parentElement!;
  const style = getComputedStyle(frame);
  expect(frame.getBoundingClientRect().width).toBe(320);
  expect(style.backgroundColor).toBe(SURFACE);
  expect(style.borderTopColor).toBe(BORDER);
  expect(style.borderTopLeftRadius).toBe("8px");
  expect(style.paddingTop).toBe("16px");
  const title = popover.getByRole("heading", { name: NAME }).element();
  expect(getComputedStyle(title).fontSize).toBe("16px");
  expect(getComputedStyle(title).fontWeight).toBe("600");
  const identifier = popover
    .getByText("cpe:/o:example:fles:15:sp7", { exact: true })
    .element().parentElement!;
  expect(getComputedStyle(identifier).fontSize).toBe("13px");
  expect(getComputedStyle(identifier).color).toBe(FG_MUTED);
  // A border line with 12 px of space above and below it.
  const line = popover.getByRole("separator").element();
  const lineStyle = getComputedStyle(line);
  expect([
    lineStyle.marginTop,
    lineStyle.marginBottom,
    lineStyle.borderTopColor,
  ]).toEqual(["12px", "12px", BORDER]);
  expect(
    identifier.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  await expect
    .element(popover.getByRole("definition"))
    .toHaveTextContent("General support");

  await userEvent.keyboard("{Escape}");

  await expect.element(name).toHaveFocus();
});

test("takes an accessible name that tells it from the other names of its kind, while its popover keeps the name as its title", async () => {
  const screen = await render(
    <DetailsName name="CNA" label="CNA for fictional-tar">
      <DescriptionList>
        <DescriptionItem term="Vendor">Example</DescriptionItem>
      </DescriptionList>
    </DetailsName>,
  );
  const name = screen.getByRole("button", {
    name: "CNA for fictional-tar",
    exact: true,
  });
  await expect.element(name).toHaveTextContent("CNA");

  await name.click();

  await expect
    .element(screen.getByRole("dialog", { name: "CNA", exact: true }))
    .toHaveFocus();
});

test("moves the focus to the screen's heading when the name leaves the page while its popover holds the focus", async () => {
  const screen = await render(<Record />);
  await screen.getByRole("button", { name: NAME }).click();
  await expect
    .element(screen.getByRole("dialog", { name: NAME }))
    .toHaveFocus();

  // The record leaves the page, as when a read removes it.
  await screen.rerender(<Record shown={false} />);

  await expect.element(screen.getByRole("heading", { level: 1 })).toHaveFocus();
});

interface ActionsRecordProps {
  // Whether the change of an action is in progress.
  busy?: boolean;
}

// The name of a fictional Product with its actions, whose popover the
// record opens and closes as its name asks, unless a change is in progress.
function ActionsRecord({ busy = false }: ActionsRecordProps) {
  const [open, setOpen] = useState(false);
  return (
    <main className="p-4">
      <ScreenHeading>Fictional record</ScreenHeading>
      <p className="w-96 text-14">
        <DetailsName
          name={NAME}
          isOpen={open}
          onOpenChange={setOpen}
          busy={busy}
          actions={
            <>
              <MenuAction
                id="eligibility"
                icon={UserPen}
                busy={busy ? "Marking as not eligible." : undefined}
              >
                Mark as not eligible
              </MenuAction>
              <MenuAction id="exclude" icon={Ban}>
                Exclude from this track
              </MenuAction>
            </>
          }
        >
          <DescriptionList>
            <DescriptionItem term="Lifecycle">General support</DescriptionItem>
          </DescriptionList>
        </DetailsName>
      </p>
    </main>
  );
}

test("ends its popover with the actions of its record, below another line, as the menu Actions, one stop of Tab, whose icons start where the details start", async () => {
  const screen = await render(<ActionsRecord />);

  await screen.getByRole("button", { name: NAME }).click();

  const popover = screen.getByRole("dialog", { name: NAME });
  await expect.element(popover).toHaveFocus();
  const separators = popover.getByRole("separator").elements();
  expect(separators).toHaveLength(2);
  const menu = popover.getByRole("menu", { name: "Actions", exact: true });
  expect(
    popover
      .getByRole("definition")
      .element()
      .compareDocumentPosition(separators[1]!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    separators[1]!.compareDocumentPosition(menu.element()) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  const items = menu.getByRole("menuitem").elements();
  expect(items.map((item) => item.textContent)).toEqual([
    "Mark as not eligible",
    "Exclude from this track",
  ]);
  const icon = items[0]!.querySelector("svg")!;
  expect(icon.getBoundingClientRect().left).toBe(
    popover.getByRole("term").element().getBoundingClientRect().left,
  );

  await userEvent.keyboard("{Tab}");

  await expect
    .element(menu.getByRole("menuitem", { name: "Mark as not eligible" }))
    .toHaveFocus();

  await userEvent.keyboard("{ArrowDown}");

  await expect
    .element(menu.getByRole("menuitem", { name: "Exclude from this track" }))
    .toHaveFocus();

  // The menu is one stop of Tab: its other items are not.
  expect(items.map((element) => element.tabIndex)).toEqual([-1, 0]);
});

test("stays open while the change of one of its actions is in progress, on Escape and on a click outside", async () => {
  const screen = await render(<ActionsRecord />);
  await screen.getByRole("button", { name: NAME }).click();
  const popover = screen.getByRole("dialog", { name: NAME });
  await expect.element(popover).toHaveFocus();

  await screen.rerender(<ActionsRecord busy />);
  const item = popover.getByRole("menuitem", { name: "Mark as not eligible" });
  await expect
    .element(item)
    .toHaveAccessibleDescription("Marking as not eligible.");
  await userEvent.keyboard("{Escape}");
  // A press of the pointer outside the popover, which React Aria closes it
  // on.
  for (const type of ["pointerdown", "pointerup", "click"]) {
    document.body.dispatchEvent(
      new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0 }),
    );
  }
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));

  await expect.element(popover).toBeVisible();

  await screen.rerender(<ActionsRecord />);
  await userEvent.keyboard("{Escape}");

  await expect.element(popover).not.toBeInTheDocument();
});

test("stays within a narrow window", async () => {
  await page.viewport(320, 640);
  const screen = await render(<Record width="w-full" />);

  await screen.getByRole("button", { name: NAME }).click();

  const popover = screen.getByRole("dialog", { name: NAME });
  await expect.element(popover).toHaveFocus();
  const box = popover.element().parentElement!.getBoundingClientRect();
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(320);
});

test("scrolls its content within it in a window shorter than it is", async () => {
  await page.viewport(1280, 160);
  const screen = await render(<Record />);

  await screen.getByRole("button", { name: NAME }).click();

  const popover = screen.getByRole("dialog", { name: NAME });
  await expect.element(popover).toHaveFocus();
  const frame = popover.element().parentElement!;
  expect(getComputedStyle(frame).overflowY).toBe("auto");
  expect(frame.scrollHeight).toBeGreaterThan(frame.clientHeight);
  expect(frame.getBoundingClientRect().bottom).toBeLessThanOrEqual(160);
});

const VECTOR = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H";

interface ValueProps {
  // Whether the popover ends with a link.
  link?: boolean;
}

// A fictional CVSS vector, in monospace, that opens its metrics.
function Value({ link = false }: ValueProps) {
  return (
    <main className="p-4">
      <p className="w-96 text-14">
        <DetailsValue
          value={<span className="font-mono">{VECTOR}</span>}
          title="NVD CVSS v3.1"
          link={
            link ? (
              <a href="https://www.example.com/">Explanation</a>
            ) : undefined
          }
        >
          <DescriptionList fittedTerms>
            <DescriptionItem term="Scope">Unchanged</DescriptionItem>
          </DescriptionList>
        </DetailsValue>
      </p>
    </main>
  );
}

test("shows a value as a button in its type, with the dotted underline of a name, at least 24 px high", async () => {
  const screen = await render(<Value />);
  const value = screen.getByRole("button", { name: VECTOR });

  const style = getComputedStyle(value.element());
  expect(style.textDecorationStyle).toBe("dotted");
  expect(style.textDecorationColor).toBe(BORDER_STRONG);
  expect(
    getComputedStyle(value.getByText(VECTOR).element()).fontFamily,
  ).toContain("monospace");
  expect(value.element().getBoundingClientRect().height).toBeGreaterThanOrEqual(
    24,
  );
});

test("opens the popover of a value, which takes the focus, with its title, the value in text-13 and fg-muted, a line, and the details, without a link", async () => {
  const screen = await render(<Value />);
  const value = screen.getByRole("button", { name: VECTOR });

  await value.click();

  const popover = screen.getByRole("dialog", { name: "NVD CVSS v3.1" });
  await expect.element(popover).toHaveFocus();
  expect(popover.element().parentElement!.getBoundingClientRect().width).toBe(
    320,
  );
  const shown = popover.getByText(VECTOR, { exact: true }).element();
  const line = shown.parentElement!;
  expect(getComputedStyle(line).fontSize).toBe("13px");
  expect(getComputedStyle(line).color).toBe(FG_MUTED);
  expect(getComputedStyle(shown).fontFamily).toContain("monospace");
  const separators = popover.getByRole("separator").elements();
  expect(separators).toHaveLength(1);
  expect(
    line.compareDocumentPosition(separators[0]!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  await expect
    .element(popover.getByRole("definition"))
    .toHaveTextContent("Unchanged");
  expect(popover.getByRole("link").query()).toBeNull();

  await userEvent.keyboard("{Escape}");

  await expect.element(value).toHaveFocus();
});

const DELIVERY =
  "Delivery of fictional-openssl, SUSE:FLES-15-SP7:Update: In progress";

// The delivery of a fictional track, which opens the requests that
// establish it.
function Records() {
  return (
    <main className="p-4">
      <p className="w-96 text-14 text-fg-muted">
        <ValueRecords value="In progress" label={DELIVERY} title="Delivery">
          <DescriptionList fittedTerms>
            <DescriptionItem term="Submission">SR 900001</DescriptionItem>
            <DescriptionItem term="QA">None</DescriptionItem>
          </DescriptionList>
        </ValueRecords>
      </p>
    </main>
  );
}

test("shows a value that opens its records as a button with the value, named after the record of the value and the value, in the style of a name, at least 24 px high", async () => {
  const screen = await render(<Records />);
  const value = screen.getByRole("button", { name: DELIVERY, exact: true });
  // The pointer away from the value, where an earlier test may have left it.
  await page.elementLocator(document.body).hover({ position: { x: 1, y: 1 } });

  await expect.element(value).toHaveTextContent("In progress");
  await expect
    .poll(() => getComputedStyle(value.element()).textDecorationColor)
    .toBe(BORDER_STRONG);
  const style = getComputedStyle(value.element());
  expect(style.color).toBe(FG_MUTED);
  expect(style.textDecorationStyle).toBe("dotted");
  expect(value.element().getBoundingClientRect().height).toBeGreaterThanOrEqual(
    24,
  );
});

test("opens the records of a value in a popover of a name, 320 px wide, which takes the focus, with its title, a line, and the records, without the value, and returns the focus on Escape", async () => {
  const screen = await render(<Records />);
  const value = screen.getByRole("button", { name: DELIVERY, exact: true });

  await value.click();

  const popover = screen.getByRole("dialog", { name: "Delivery", exact: true });
  await expect.element(popover).toHaveFocus();
  expect(popover.element().parentElement!.getBoundingClientRect().width).toBe(
    320,
  );
  const title = popover.getByRole("heading", { name: "Delivery" }).element();
  expect(getComputedStyle(title).fontSize).toBe("16px");
  expect(getComputedStyle(title).fontWeight).toBe("600");
  // The line 12 px below the title, with nothing between them.
  const lines = popover.getByRole("separator").elements();
  expect(lines).toHaveLength(1);
  expect(
    lines[0]!.getBoundingClientRect().top -
      title.getBoundingClientRect().bottom,
  ).toBeCloseTo(12, 0);
  expect(popover.getByText("In progress").elements()).toHaveLength(0);
  expect(
    popover
      .getByRole("definition")
      .elements()
      .map((element) => element.textContent),
  ).toEqual(["SR 900001", "None"]);

  await userEvent.keyboard("{Escape}");

  await expect.element(value).toHaveFocus();
  expect(screen.getByRole("dialog").query()).toBeNull();
});

test("ends the popover of a value with its link, below another line", async () => {
  const screen = await render(<Value link />);

  await screen.getByRole("button", { name: VECTOR }).click();

  const popover = screen.getByRole("dialog", { name: "NVD CVSS v3.1" });
  await expect.element(popover).toHaveFocus();
  const separators = popover.getByRole("separator").elements();
  expect(separators).toHaveLength(2);
  const definition = popover.getByRole("definition").element();
  const link = popover.getByRole("link", { name: "Explanation" }).element();
  expect(
    definition.compareDocumentPosition(separators[1]!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    separators[1]!.compareDocumentPosition(link) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
