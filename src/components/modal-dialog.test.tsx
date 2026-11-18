import { useEffect, useRef, useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { FramedTable, type TableColumn } from "./data-table";
import {
  ConfirmationDialog,
  ModalDialog,
  type DialogError,
} from "./modal-dialog";

// A dialog centered over the page and a confirmation (docs/design-system.md,
// Dialogs; docs/behaviors.md, Confirmation), in the light theme.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

// danger-solid and on-danger-solid of the light theme.
const DANGER_SOLID = "rgb(207, 34, 46)";
const ON_DANGER_SOLID = "rgb(255, 255, 255)";

interface ConfirmationProps {
  onConfirm?: () => void;
  isBusy?: boolean;
  // The error that the action fails with.
  failure?: DialogError | undefined;
}

// A confirmation that opens from a button, which closes it on Cancel, and
// whose action fails with the failure.
function Confirmation({
  onConfirm = () => undefined,
  isBusy = false,
  failure,
}: ConfirmationProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<DialogError>();
  return (
    <>
      <Button
        onPress={() => {
          setOpen(true);
        }}
      >
        Revoke access
      </Button>
      <ConfirmationDialog
        isOpen={open}
        onCancel={() => {
          setOpen(false);
        }}
        title="Revoke access of Carol White?"
        action="Revoke access"
        onConfirm={() => {
          onConfirm();
          setError(failure);
        }}
        isBusy={isBusy}
        error={error}
      >
        Carol White no longer sees this Ticket.
      </ConfirmationDialog>
    </>
  );
}

async function openConfirmation(props: ConfirmationProps = {}) {
  const screen = await render(<Confirmation {...props} />);
  await screen.getByRole("button", { name: "Revoke access" }).click();
  const dialog = screen.getByRole("dialog", {
    name: "Revoke access of Carol White?",
  });
  await expect.element(dialog).toBeVisible();
  return { screen, dialog };
}

test("asks with its title, states the consequence, and gives Cancel the focus", async () => {
  const { dialog } = await openConfirmation();

  await expect
    .element(dialog.getByText("Carol White no longer sees this Ticket."))
    .toBeVisible();
  await expect
    .element(dialog.getByRole("button", { name: "Cancel" }))
    .toHaveFocus();
});

test("confirms with a danger button named after the action, after Cancel", async () => {
  const onConfirm = vi.fn();
  const { dialog } = await openConfirmation({ onConfirm });
  const [cancel, action] = dialog.getByRole("button").elements();

  expect(cancel?.textContent).toBe("Cancel");
  expect(action?.textContent).toBe("Revoke access");
  expect(getComputedStyle(action!).backgroundColor).toBe(DANGER_SOLID);
  expect(getComputedStyle(action!).color).toBe(ON_DANGER_SOLID);
  await dialog.getByRole("button", { name: "Revoke access" }).click();

  expect(onConfirm).toHaveBeenCalledOnce();
});

test("is at most 400 px wide, centered over the page", async () => {
  const { dialog } = await openConfirmation();

  const box = dialog.element().getBoundingClientRect();
  expect(box.width).toBe(400);
  expect(box.left + box.width / 2).toBe(640);
});

test("is at most 488 px wide for a form alone, centered over the page", async () => {
  const screen = await render(
    <ModalDialog
      isOpen
      onClose={() => undefined}
      width="form-only"
      title="Add reference"
      buttons={<Button>Cancel</Button>}
    >
      Fictional content
    </ModalDialog>,
  );

  const dialog = screen.getByRole("dialog", { name: "Add reference" });
  await expect.element(dialog).toBeVisible();
  const box = dialog.element().getBoundingClientRect();
  expect(box.width).toBe(488);
  expect(box.left + box.width / 2).toBe(640);
});

test("is at most 880 px wide for a form in two columns, centered over the page", async () => {
  const screen = await render(
    <ModalDialog
      isOpen
      onClose={() => undefined}
      width="two-columns"
      title="Add SUSE assessment"
      buttons={<Button>Cancel</Button>}
    >
      Fictional content
    </ModalDialog>,
  );

  const dialog = screen.getByRole("dialog", { name: "Add SUSE assessment" });
  await expect.element(dialog).toBeVisible();
  const box = dialog.element().getBoundingClientRect();
  expect(box.width).toBe(880);
  expect(box.left + box.width / 2).toBe(640);
});

test("breaks a word of its title longer than its line, such as an address, at 320 CSS pixels", async () => {
  await page.viewport(320, 640);
  const address = `https://advisories.example.com/${"fictional-".repeat(12)}advisory`;
  const screen = await render(
    <ConfirmationDialog
      isOpen
      onCancel={() => undefined}
      title={`Delete reference ${address}?`}
      action="Delete reference"
      onConfirm={() => undefined}
      isBusy={false}
      error={undefined}
    >
      The reference is removed from this Ticket.
    </ConfirmationDialog>,
  );

  const dialog = screen.getByRole("dialog", {
    name: `Delete reference ${address}?`,
  });
  await expect.element(dialog).toBeVisible();
  const title = dialog.getByRole("heading").element();
  // The address takes several lines of its own, after Delete reference.
  expect(title.getBoundingClientRect().height).toBeGreaterThan(
    3 * Number.parseFloat(getComputedStyle(title).lineHeight),
  );
  expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
  expect(dialog.element().getBoundingClientRect().right).toBeLessThanOrEqual(
    320,
  );
});

test.each(["Cancel", "Escape"])(
  "closes on %s, and returns the focus to the button that opened it",
  async (way) => {
    const { screen, dialog } = await openConfirmation();

    if (way === "Escape") {
      await userEvent.keyboard("{Escape}");
    } else {
      await dialog.getByRole("button", { name: "Cancel" }).click();
    }

    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Revoke access" }))
      .toHaveFocus();
  },
);

test("names the button that keeps things as they are Keep editing before discarding input", async () => {
  const screen = await render(
    <ConfirmationDialog
      isOpen
      onCancel={() => undefined}
      title="Discard changes?"
      action="Discard"
      cancelLabel="Keep editing"
      onConfirm={() => undefined}
      isBusy={false}
      error={undefined}
    >
      The user that you chose isn&apos;t granted access.
    </ConfirmationDialog>,
  );

  const dialog = screen.getByRole("dialog", { name: "Discard changes?" });
  await expect
    .element(dialog.getByRole("button", { name: "Keep editing" }))
    .toHaveFocus();
  await expect
    .element(dialog.getByRole("button", { name: "Discard" }))
    .toBeVisible();
});

test("cannot be closed while its action is in progress", async () => {
  const { dialog } = await openConfirmation({ isBusy: true });

  await userEvent.keyboard("{Escape}");

  await expect.element(dialog).toBeVisible();
  await expect
    .element(dialog.getByRole("button", { name: "Cancel" }))
    .toBeDisabled();
});

test("shows the error of its action at its top, with its reference, which takes the focus", async () => {
  const { dialog } = await openConfirmation({
    failure: {
      message: "Sentinel didn't confirm this change.",
      reference: "01890a5d-ac96-774b-bcce-b302099a8057",
      unconfirmed: true,
    },
  });

  await dialog.getByRole("button", { name: "Revoke access" }).click();

  const message = dialog.getByText("Sentinel didn't confirm this change.");
  await expect.element(message).toBeVisible();
  expect(
    message.element().closest("[tabindex]")?.contains(document.activeElement),
  ).toBe(true);
  await expect
    .element(dialog.getByText("01890a5d-ac96-774b-bcce-b302099a8057"))
    .toBeVisible();
});

// A screen with its heading and an open dialog, which a press of Remove
// removes from the page while it is open.
function RemovedDialog() {
  const [shown, setShown] = useState(true);
  return (
    <>
      <h1 tabIndex={-1}>SNTL-12</h1>
      {shown && (
        <ModalDialog
          isOpen
          onClose={() => undefined}
          width="form"
          title="Access grants"
          buttons={
            <Button
              onPress={() => {
                setShown(false);
              }}
            >
              Remove
            </Button>
          }
        >
          Fictional content
        </ModalDialog>
      )}
    </>
  );
}

// The event by which React Aria returns the focus to the element that opened
// a dialog, which a collection of React Aria, such as a table, takes over to
// return the focus itself once it renders again, which can take longer than
// a frame.
const RESTORE_FOCUS = "react-aria-focus-scope-restore";

// A screen with its heading and a confirmation that a button opens, in an
// element that takes over the return of the focus to the button without
// returning it, and that Cancel removes from the page.
function ConfirmationInCollection() {
  const [open, setOpen] = useState(false);
  const collection = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = collection.current;
    const takeOver = (event: Event) => {
      event.preventDefault();
    };
    element?.addEventListener(RESTORE_FOCUS, takeOver);
    return () => {
      element?.removeEventListener(RESTORE_FOCUS, takeOver);
    };
  }, []);
  return (
    <>
      <h1 tabIndex={-1}>SNTL-12</h1>
      <div ref={collection}>
        <Button
          onPress={() => {
            setOpen(true);
          }}
        >
          Delete
        </Button>
      </div>
      {open && (
        <ConfirmationDialog
          isOpen
          onCancel={() => {
            setOpen(false);
          }}
          title="Delete reference?"
          action="Delete reference"
          onConfirm={() => undefined}
          isBusy={false}
          error={undefined}
        >
          The reference is removed from this Ticket.
        </ConfirmationDialog>
      )}
    </>
  );
}

test("returns the focus to the button that opened it when React Aria has not after two frames, as in a table", async () => {
  const screen = await render(<ConfirmationInCollection />);
  await screen.getByRole("button", { name: "Delete" }).click();
  const dialog = screen.getByRole("dialog", { name: "Delete reference?" });

  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect.element(dialog).not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("button", { name: "Delete" }))
    .toHaveFocus();
});

// Waits for the frames in which the focus returns once a dialog has closed:
// React Aria returns it in the next frame, and the dialog checks it in the
// frame after.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

interface FictionalRow {
  id: string;
  name: string;
}

const ROWS: readonly FictionalRow[] = [
  { id: "advisory", name: "Fictional advisory" },
  { id: "patch", name: "Fictional patch" },
];

// A screen with its heading and a table whose rows open a confirmation, whose
// action removes its row and leaves it open, as a read that removes the row
// while the confirmation is open does.
function ConfirmationFromRow() {
  const [rows, setRows] = useState(ROWS);
  const [deleting, setDeleting] = useState<string>();
  const columns: TableColumn<FictionalRow>[] = [
    {
      id: "name",
      name: "Reference",
      isRowHeader: true,
      render: (row) => row.name,
    },
    {
      id: "actions",
      name: "Actions",
      hidesName: true,
      render: (row) => (
        <Button
          onPress={() => {
            setDeleting(row.id);
          }}
        >
          {`Delete ${row.name}`}
        </Button>
      ),
    },
  ];
  return (
    <>
      <h1 tabIndex={-1}>SNTL-12</h1>
      <FramedTable
        label="References"
        columns={columns}
        rows={rows}
        rowId={(row) => row.id}
      />
      {deleting !== undefined && (
        <ConfirmationDialog
          isOpen
          onCancel={() => {
            setDeleting(undefined);
          }}
          title="Delete reference?"
          action="Delete reference"
          onConfirm={() => {
            setRows((current) => current.filter((row) => row.id !== deleting));
          }}
          isBusy={false}
          error={undefined}
        >
          The reference is removed from this Ticket.
        </ConfirmationDialog>
      )}
    </>
  );
}

test.each(["Cancel", "Escape"])(
  "moves the focus to the screen's heading on %s when the row that opened it has left the page meanwhile",
  async (way) => {
    const screen = await render(<ConfirmationFromRow />);
    const opener = screen.getByRole("button", {
      name: "Delete Fictional advisory",
    });
    const element = opener.element();
    await opener.click();
    const dialog = screen.getByRole("dialog", { name: "Delete reference?" });
    await expect
      .element(dialog.getByRole("button", { name: "Cancel" }))
      .toHaveFocus();

    await dialog.getByRole("button", { name: "Delete reference" }).click();
    expect(element.isConnected).toBe(false);
    if (way === "Escape") {
      await userEvent.keyboard("{Escape}");
    } else {
      await dialog.getByRole("button", { name: "Cancel" }).click();
    }

    await expect.element(dialog).not.toBeInTheDocument();
    const title = screen.getByRole("heading", { level: 1 });
    await expect.element(title).toHaveFocus();
    // React Aria's table, which held the row, does not take it back.
    await nextFrames();
    expect(document.activeElement).toBe(title.element());
  },
);

// A screen with its heading and a dialog of grants, which a button opens,
// whose Revoke access opens a confirmation, whose action removes its grant
// and leaves it open.
function ConfirmationInDialog() {
  const [open, setOpen] = useState(false);
  const [grants, setGrants] = useState(["Carol White", "Emma Green"]);
  const [revoking, setRevoking] = useState<string>();
  return (
    <>
      <h1 tabIndex={-1}>SNTL-12</h1>
      <Button
        onPress={() => {
          setOpen(true);
        }}
      >
        Access grants
      </Button>
      {open && (
        <ModalDialog
          isOpen
          onClose={() => {
            setOpen(false);
          }}
          width="form"
          title="Access grants"
          buttons={<Button>Close</Button>}
        >
          {grants.map((grant) => (
            <Button
              key={grant}
              onPress={() => {
                setRevoking(grant);
              }}
            >
              {`Revoke access of ${grant}`}
            </Button>
          ))}
          {revoking !== undefined && (
            <ConfirmationDialog
              isOpen
              onCancel={() => {
                setRevoking(undefined);
              }}
              title={`Revoke access of ${revoking}?`}
              action="Revoke access"
              onConfirm={() => {
                setGrants((current) =>
                  current.filter((grant) => grant !== revoking),
                );
              }}
              isBusy={false}
              error={undefined}
            >
              {`${revoking} no longer sees this Ticket.`}
            </ConfirmationDialog>
          )}
        </ModalDialog>
      )}
    </>
  );
}

test("moves the focus to the dialog that held the element that opened it when that element has left the page meanwhile", async () => {
  const screen = await render(<ConfirmationInDialog />);
  await screen.getByRole("button", { name: "Access grants" }).click();
  const grants = screen.getByRole("dialog", { name: "Access grants" });
  const opener = grants.getByRole("button", {
    name: "Revoke access of Carol White",
  });
  const element = opener.element();
  await opener.click();
  const confirmation = screen.getByRole("dialog", {
    name: "Revoke access of Carol White?",
  });
  await expect
    .element(confirmation.getByRole("button", { name: "Cancel" }))
    .toHaveFocus();

  await confirmation
    .getByRole("button", { name: "Revoke access", exact: true })
    .click();
  expect(element.isConnected).toBe(false);
  await confirmation.getByRole("button", { name: "Cancel" }).click();

  await expect.element(confirmation).not.toBeInTheDocument();
  await expect.element(grants).toHaveFocus();
  await nextFrames();
  expect(document.activeElement).toBe(grants.element());
});

test("moves the focus to the screen's heading when it leaves the page while it is open", async () => {
  const screen = await render(<RemovedDialog />);
  const dialog = screen.getByRole("dialog", { name: "Access grants" });
  await expect.element(dialog).toBeVisible();
  expect(dialog.element().getBoundingClientRect().width).toBe(560);

  await dialog.getByRole("button", { name: "Remove" }).click();

  await expect.element(screen.getByRole("heading", { level: 1 })).toHaveFocus();
});
