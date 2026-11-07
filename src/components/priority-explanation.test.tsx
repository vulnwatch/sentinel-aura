import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { ExplainedPriority, type PriorityFields } from "./priority-explanation";

// The explanation of the priority of a Ticket (docs/design-system.md,
// Priority, Explanation), at a wide window, in the light theme.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

// The colors of docs/design-system.md (Color Tokens; Tones) in the light
// theme.
const FG = "rgb(31, 35, 40)";
const FG_MUTED = "rgb(89, 99, 110)";
const SURFACE = "rgb(255, 255, 255)";
const BORDER = "rgb(216, 222, 228)";
const NEUTRAL_SOFT = "rgb(239, 242, 245)";
const FOCUS = "rgb(9, 105, 218)";
const TRANSPARENT = "rgba(0, 0, 0, 0)";

// A Ticket whose automatic priority P1 follows from its Critical severity
// and the CISA KEV entry of its CVE (Sentinel
// docs/features/tickets/ticket-priority.md, Decision Table; Automatic
// Priority Basis), with the fields that a test sets.
function fields(changes: Partial<PriorityFields> = {}): PriorityFields {
  return {
    priority: "p1",
    priority_automatic: "p1",
    priority_override: null,
    priority_automatic_basis: {
      severity: "critical",
      exploitation: "kev",
      evidence: [{ kind: "kev", value: "2026-10-09" }],
    },
    ...changes,
  };
}

// An override of P1 over the automatic P3 of a High severity without
// exploitation evidence.
const OVERRIDE_ABOVE = fields({
  priority: "p1",
  priority_automatic: "p3",
  priority_override: "p1",
  priority_automatic_basis: {
    severity: "high",
    exploitation: "unknown",
    evidence: [],
  },
});

// The priority of a Ticket in a positioned cell of a table, 36 px high with
// 10 px of side padding, as a cell of a table of the UI is
// (docs/design-system.md, Tables), after a control that the tests use first,
// and the screen's heading, which takes the focus when the priority leaves
// the page while its explanation holds it.
async function renderPriority(
  ticket: PriorityFields,
  onBefore: () => void = () => {},
) {
  // Away from the edges of the window, which the popover keeps 12 px from.
  const screen = await render(
    <div className="p-8">
      <h1 tabIndex={-1}>Tickets</h1>
      <Button onPress={onBefore}>Before</Button>
      <table className="w-60">
        <tbody>
          <tr>
            <td className="relative h-9 px-2.5">
              <ExplainedPriority ticket={ticket} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>,
  );
  return { screen, cell: screen.getByRole("cell") };
}

type Screen = Awaited<ReturnType<typeof renderPriority>>["screen"];

// Opens the explanation with a click on the priority, and returns it.
async function openExplanation(screen: Screen, name: string) {
  await screen.getByRole("cell").getByRole("button").click();
  const dialog = page.getByRole("dialog", { name, exact: true });
  await expect.element(dialog).toBeVisible();
  return dialog;
}

// The box in which the priority shows in its cell, the nearest element
// around the text with a radius.
function boxOf(cell: Locator, text: string): Element {
  let element = cell.getByText(text, { exact: true }).element();
  while (getComputedStyle(element).borderTopLeftRadius !== "4px") {
    element = element.parentElement!;
  }
  return element;
}

// The popover around the explanation, the nearest element around it with a
// border line.
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

// The texts of the lines of a section of the explanation, after its heading.
function sectionLines(dialog: Locator, heading: string): string[] {
  const section = dialog
    .getByRole("heading", { level: 3, name: heading })
    .element().parentElement!;
  return [...section.children]
    .slice(1)
    .flatMap((line) =>
      line.tagName === "UL"
        ? [...line.children].map((item) => item.textContent)
        : [line.textContent],
    );
}

test("makes the whole cell a button named by the priority, which shows in a box 24 px high", async () => {
  const { cell } = await renderPriority(fields());
  const button = cell.getByRole("button", { name: "P1", exact: true });

  await expect.element(button).toBeVisible();
  await expect.element(button).toHaveAttribute("aria-expanded", "false");
  const area = button.element().getBoundingClientRect();
  const bounds = cell.element().getBoundingClientRect();
  expect([
    area.left <= bounds.left,
    area.top <= bounds.top,
    area.right >= bounds.right,
    area.bottom >= bounds.bottom,
  ]).toEqual([true, true, true, true]);
  const box = boxOf(cell, "P1");
  expect(box.getBoundingClientRect().height).toBe(24);
  // Its 4 px of side padding reach into those of the cell, so that the level
  // stays where it shows without a button.
  expect(getComputedStyle(box).paddingLeft).toBe("4px");
  expect(box.getBoundingClientRect().left - bounds.left).toBe(6);
});

test("shows the focus ring around the box on keyboard focus", async () => {
  const { screen, cell } = await renderPriority(fields());
  screen.getByRole("button", { name: "Before" }).element().focus();

  await userEvent.keyboard("{Tab}");

  await expect.element(cell.getByRole("button", { name: "P1" })).toHaveFocus();
  const style = getComputedStyle(boxOf(cell, "P1"));
  expect([
    style.outlineStyle,
    style.outlineWidth,
    style.outlineOffset,
    style.outlineColor,
  ]).toEqual(["solid", "2px", "2px", FOCUS]);
});

test("explains an automatic priority from its basis and its evidence", async () => {
  const { screen } = await renderPriority(fields());

  const dialog = await openExplanation(screen, "P1, automatic");

  await expect
    .element(dialog.getByRole("heading", { level: 2 }))
    .toHaveTextContent("P1·automatic");
  expect(sectionLines(dialog, "Based on")).toEqual([
    "SeverityCritical",
    "ExploitationKEV",
  ]);
  expect(sectionLines(dialog, "Evidence")).toEqual([
    "Listed in CISA KEV on 9 Oct 2026",
  ]);
  await expect.element(dialog.getByRole("listitem")).toBeVisible();
});

test("explains an override with the automatic priority that it replaces", async () => {
  const { screen, cell } = await renderPriority(OVERRIDE_ABOVE);

  await expect
    .element(cell.getByRole("button", { name: "P1, override", exact: true }))
    .toBeVisible();
  const dialog = await openExplanation(screen, "P1, override");

  expect(
    dialog
      .getByRole("heading", { level: 3 })
      .elements()
      .map((h) => h.textContent),
  ).toEqual(["Automatic priority", "Evidence"]);
  expect(sectionLines(dialog, "Automatic priority")).toEqual([
    "P3",
    "SeverityHigh",
    "ExploitationUnknown",
  ]);
  expect(sectionLines(dialog, "Evidence")).toEqual(["No evidence."]);
  expect(
    getComputedStyle(dialog.getByText("No evidence.").element()).color,
  ).toBe(FG_MUTED);
});

test("shows the automatic P1 that an override hides, with its deciding evidence", async () => {
  const { screen } = await renderPriority(
    fields({
      priority: "p3",
      priority_automatic: "p1",
      priority_override: "p3",
      priority_automatic_basis: {
        severity: "high",
        exploitation: "active",
        evidence: [{ kind: "ssvc_exploitation", value: "active" }],
      },
    }),
  );

  const dialog = await openExplanation(screen, "P3, override");

  expect(sectionLines(dialog, "Automatic priority")).toEqual([
    "P1",
    "SeverityHigh",
    "ExploitationActive",
  ]);
  const p1 = dialog.getByText("P1", { exact: true });
  expect(getComputedStyle(p1.element()).fontWeight).toBe("600");
  expect(sectionLines(dialog, "Evidence")).toEqual([
    "SSVC exploitation Active",
  ]);
});

test("lists each piece of deciding evidence on a line of its own, in the order of the basis", async () => {
  const { screen } = await renderPriority(
    fields({
      priority: "p3",
      priority_automatic: "p3",
      priority_automatic_basis: {
        severity: "medium",
        exploitation: "likely",
        evidence: [
          { kind: "ssvc_exploitation", value: "poc" },
          { kind: "epss_percentile", value: 0.9712 },
        ],
      },
    }),
  );

  const dialog = await openExplanation(screen, "P3, automatic");

  expect(sectionLines(dialog, "Based on")).toEqual([
    "SeverityMedium",
    "ExploitationLikely",
  ]);
  await expect
    .element(dialog.getByRole("listitem").nth(0))
    .toHaveTextContent("SSVC exploitation PoC");
  await expect
    .element(dialog.getByRole("listitem").nth(1))
    .toHaveTextContent("EPSS percentile 0.97");
  expect(dialog.getByRole("listitem").elements()).toHaveLength(2);
});

test.each([
  [0.95, "0.95"],
  [0.9599999, "0.95"],
  [0.99999, "0.99"],
  [1, "1.00"],
  // Below its decimal value in binary, as 0.57 * 100 is 56.99999999999999.
  [0.57, "0.57"],
])(
  "shows the EPSS percentile %s cut to two decimals, as %s",
  async (value, text) => {
    const { screen } = await renderPriority(
      fields({
        priority: "p2",
        priority_automatic: "p2",
        priority_automatic_basis: {
          severity: "critical",
          exploitation: "likely",
          evidence: [{ kind: "epss_percentile", value }],
        },
      }),
    );

    const dialog = await openExplanation(screen, "P2, automatic");

    expect(sectionLines(dialog, "Evidence")).toEqual([
      `EPSS percentile ${text}`,
    ]);
  },
);

test("shows the date of a KEV entry as received when it is not a date", async () => {
  const { screen } = await renderPriority(
    fields({
      priority_automatic_basis: {
        severity: "critical",
        exploitation: "kev",
        evidence: [{ kind: "kev", value: "2026-02-30" }],
      },
    }),
  );

  const dialog = await openExplanation(screen, "P1, automatic");

  expect(sectionLines(dialog, "Evidence")).toEqual([
    "Listed in CISA KEV on 2026-02-30",
  ]);
});

test("explains a Ticket that is not yet prioritizable", async () => {
  const { screen, cell } = await renderPriority(
    fields({
      priority: null,
      priority_automatic: null,
      priority_automatic_basis: {
        severity: null,
        exploitation: "unknown",
        evidence: [],
      },
    }),
  );
  const button = cell.getByRole("button", { name: "Not set", exact: true });

  await expect.element(button).toBeVisible();
  expect(boxOf(cell, "–").getBoundingClientRect().width).toBeGreaterThanOrEqual(
    24,
  );
  const dialog = await openExplanation(screen, "Not yet prioritizable");

  expect(sectionLines(dialog, "Based on")).toEqual([
    "Severity–Not set",
    "ExploitationUnknown",
  ]);
  expect(sectionLines(dialog, "Evidence")).toEqual(["No evidence."]);
});

test("explains an override over an automatic priority that is not yet prioritizable", async () => {
  const { screen } = await renderPriority(
    fields({
      priority: "p2",
      priority_automatic: null,
      priority_override: "p2",
      priority_automatic_basis: {
        severity: null,
        exploitation: "unknown",
        evidence: [],
      },
    }),
  );

  const dialog = await openExplanation(screen, "P2, override");

  expect(sectionLines(dialog, "Automatic priority")).toEqual([
    "Not yet prioritizable",
    "Severity–Not set",
    "ExploitationUnknown",
  ]);
});

test("shows values that the pinned contract does not list as received, and an evidence of an unlisted kind without its value", async () => {
  const { screen, cell } = await renderPriority({
    priority: "p0",
    priority_automatic: "p0",
    priority_override: null,
    priority_automatic_basis: {
      // Values that a later Sentinel release can return (Sentinel
      // docs/api-spec.md, Response Enums).
      severity: "fictional_severity",
      exploitation: "fictional_level",
      evidence: [
        { kind: "ssvc_exploitation", value: "fictional_value" },
        { kind: "fictional_kind", value: "fictional value" },
      ],
    },
  });

  await expect
    .element(cell.getByRole("button", { name: "p0", exact: true }))
    .toBeVisible();
  const dialog = await openExplanation(screen, "p0, automatic");

  expect(sectionLines(dialog, "Based on")).toEqual([
    "Severityfictional_severity",
    "Exploitationfictional_level",
  ]);
  expect(sectionLines(dialog, "Evidence")).toEqual([
    "SSVC exploitation fictional_value",
    "fictional_kind",
  ]);
});

test("looks up the names of the values only among those of the pinned contract", async () => {
  const { screen } = await renderPriority(
    fields({
      priority_automatic_basis: {
        severity: "critical",
        exploitation: "constructor",
        evidence: [
          { kind: "ssvc_exploitation", value: "toString" },
          { kind: "hasOwnProperty" },
        ],
      },
    }),
  );

  const dialog = await openExplanation(screen, "P1, automatic");

  expect(sectionLines(dialog, "Based on")).toEqual([
    "SeverityCritical",
    "Exploitationconstructor",
  ]);
  expect(sectionLines(dialog, "Evidence")).toEqual([
    "SSVC exploitation toString",
    "hasOwnProperty",
  ]);
});

test("opens with Enter, takes the focus itself, and returns it to the priority on Escape", async () => {
  const { screen, cell } = await renderPriority(fields());
  const button = cell.getByRole("button", { name: "P1" });
  button.element().focus();

  await userEvent.keyboard("{Enter}");

  const dialog = page.getByRole("dialog", { name: "P1, automatic" });
  await expect.element(dialog).toHaveFocus();
  await expect.element(button).toHaveAttribute("aria-expanded", "true");
  // It holds no control, and the rest of the page is out of reach of the
  // keyboard.
  await userEvent.keyboard("{Tab}");
  await expect.element(dialog).toHaveFocus();

  await userEvent.keyboard("{Escape}");

  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(button).toHaveFocus();
  expect(screen.getByRole("heading", { level: 1 }).element()).not.toBe(
    document.activeElement,
  );
});

test("opens with Space", async () => {
  const { cell } = await renderPriority(fields());
  cell.getByRole("button", { name: "P1" }).element().focus();

  await userEvent.keyboard(" ");

  await expect
    .element(page.getByRole("dialog", { name: "P1, automatic" }))
    .toHaveFocus();
});

test("closes on a click outside without acting on what it hits, and returns the focus to the priority", async () => {
  const onBefore = vi.fn<() => void>();
  const { screen, cell } = await renderPriority(fields(), onBefore);
  const dialog = await openExplanation(screen, "P1, automatic");

  await userEvent.click(screen.getByRole("button", { name: "Before" }), {
    force: true,
  });

  await expect.element(dialog).not.toBeInTheDocument();
  expect(onBefore).not.toHaveBeenCalled();
  await expect.element(cell.getByRole("button", { name: "P1" })).toHaveFocus();
});

test("moves the focus to the screen's heading when the priority leaves the page while its explanation holds it", async () => {
  const { screen } = await renderPriority(fields());
  const dialog = await openExplanation(screen, "P1, automatic");
  await expect.element(dialog).toHaveFocus();

  await screen.rerender(
    <div className="p-8">
      <h1 tabIndex={-1}>Tickets</h1>
      <Button>Before</Button>
    </div>,
  );

  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(screen.getByRole("heading", { level: 1 })).toHaveFocus();
});

test("shows the box on neutral-soft while the pointer is over the cell and while the explanation is open, and transparent otherwise", async () => {
  const { screen, cell } = await renderPriority(fields());
  const box = boxOf(cell, "P1");
  // React Aria marks the pointer over a button only once the user works with
  // a pointer, as a click shows.
  await screen.getByRole("button", { name: "Before" }).click();

  expect(getComputedStyle(box).backgroundColor).toBe(TRANSPARENT);
  // At the end of the cell, away from the box.
  await cell.getByRole("button").hover({ position: { x: 230, y: 18 } });
  await expect
    .poll(() => getComputedStyle(box).backgroundColor)
    .toBe(NEUTRAL_SOFT);
  await openExplanation(screen, "P1, automatic");
  await page.elementLocator(document.body).hover({ position: { x: 2, y: 2 } });
  expect(getComputedStyle(box).backgroundColor).toBe(NEUTRAL_SOFT);
});

test("opens below the priority, aligned to its start, on surface with a border line, an 8 px radius, a shadow, and 16 px of padding, 288 px wide", async () => {
  const { screen, cell } = await renderPriority(fields());

  const dialog = await openExplanation(screen, "P1, automatic");

  const popover = popoverOf(dialog);
  const style = getComputedStyle(popover);
  expect([
    style.backgroundColor,
    style.borderTopColor,
    style.borderTopLeftRadius,
    style.paddingTop,
    style.paddingLeft,
    style.fontSize,
    style.color,
  ]).toEqual([SURFACE, BORDER, "8px", "16px", "16px", "14px", FG]);
  expect(style.boxShadow).not.toBe("none");
  const box = popover.getBoundingClientRect();
  const priority = boxOf(cell, "P1").getBoundingClientRect();
  expect(box.width).toBe(288);
  // React Aria places the popover on whole pixels, and the priority, centered
  // in its cell, can lie between two.
  expect(Math.abs(box.top - priority.bottom - 4)).toBeLessThan(1);
  expect(Math.abs(box.left - priority.left)).toBeLessThan(1);
});

test("shows its title in text-16 at weight 600, a border line 12 px around, and the headings of its sections in text-12, weight 500, fg-muted, 12 px apart", async () => {
  const { screen } = await renderPriority(fields());

  const dialog = await openExplanation(screen, "P1, automatic");

  const title = dialog.getByRole("heading", { level: 2 }).element();
  expect([
    getComputedStyle(title).fontSize,
    getComputedStyle(title).fontWeight,
  ]).toEqual(["16px", "600"]);
  const line = title.nextElementSibling!;
  expect(getComputedStyle(line).borderTopColor).toBe(BORDER);
  expect(
    line.getBoundingClientRect().top - title.getBoundingClientRect().bottom,
  ).toBe(12);
  const basis = dialog.getByRole("heading", { level: 3, name: "Based on" });
  const evidence = dialog.getByRole("heading", { level: 3, name: "Evidence" });
  expect(
    basis.element().getBoundingClientRect().top -
      line.getBoundingClientRect().bottom,
  ).toBe(12);
  const heading = getComputedStyle(basis.element());
  expect([heading.fontSize, heading.fontWeight, heading.color]).toEqual([
    "12px",
    "500",
    FG_MUTED,
  ]);
  expect(
    evidence.element().getBoundingClientRect().top -
      basis.element().parentElement!.getBoundingClientRect().bottom,
  ).toBe(12);
  expect(
    getComputedStyle(dialog.getByText("Severity", { exact: true }).element())
      .color,
  ).toBe(FG_MUTED);
});

test("stays within a narrow window", async () => {
  await page.viewport(320, 640);
  const { screen } = await renderPriority(fields());

  const dialog = await openExplanation(screen, "P1, automatic");

  const box = popoverOf(dialog).getBoundingClientRect();
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(320);
});

test("scrolls its content within it in a window shorter than it is", async () => {
  await page.viewport(1280, 160);
  const { screen } = await renderPriority(OVERRIDE_ABOVE);

  const dialog = await openExplanation(screen, "P1, override");

  const popover = popoverOf(dialog);
  expect(getComputedStyle(popover).overflowY).toBe("auto");
  expect(popover.scrollHeight).toBeGreaterThan(popover.clientHeight);
  expect(popover.getBoundingClientRect().bottom).toBeLessThanOrEqual(160);
});
