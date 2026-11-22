import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import "../../styles.css";
import type { TicketReferenceResponse } from "../../api/generated/model";
import { errorResponse, requestsTo } from "../../test-api";
import {
  addButton,
  ADVISORY,
  announcementsOf,
  backgroundBehind,
  confirmationOf,
  deleted,
  deleteOf,
  deleteReference,
  EVERY_REFERENCE,
  expectFocusOnError,
  expectFocusSettledOn,
  focused,
  frames,
  heading,
  ISSUE,
  later,
  MESSAGE_CONFLICT,
  MESSAGE_GONE,
  MESSAGE_NOT_ACCEPTED,
  MESSAGE_TONES,
  MESSAGE_UNCONFIRMED,
  nameOf,
  namesOf,
  NVD,
  panelOf,
  PATCH,
  PATH,
  POST,
  prepareEachTest,
  REFERENCES,
  referencesResponse,
  renderTab,
  requestsWith,
  returnToForeground,
  rowOf,
  stubReferences,
  TICKET,
} from "./test-support";

// Delete of the tab References
// (src/routes/ticket-references/delete-dialog.tsx; docs/screens/ticket.md,
// References), at the browser's default text size, in the light theme.

prepareEachTest();

// Deletes a reference among others, and waits until the read after it has
// taken the reference away from the table and its outcome is announced.
async function deleteAmong(
  before: TicketReferenceResponse[],
  reference: TicketReferenceResponse,
  path = PATH,
) {
  let references = before;
  stubReferences({
    references: () => referencesResponse(references),
    remove: () => {
      references = before.filter((item) => item.id !== reference.id);
      return deleted();
    },
  });
  const { screen } = await renderTab(path);

  await deleteReference(screen, reference);

  await expect.poll(() => rowOf(screen, reference).query()).toBeNull();
  await expect
    .poll(() => announcementsOf(screen))
    .toEqual([`Reference ${nameOf(reference)} deleted.`]);
  return { screen };
}

describe("Delete", () => {
  test("asks for confirmation, naming the reference, with the consequence, Cancel, which takes the focus, and Delete reference as a danger button", async () => {
    stubReferences();
    const { screen } = await renderTab();

    await deleteOf(screen, ADVISORY).click();

    const confirmation = confirmationOf(screen, ADVISORY);
    await expect
      .element(confirmation.getByRole("button", { name: "Cancel" }))
      .toHaveFocus();
    await expect
      .element(
        confirmation.getByText(
          "The reference is removed from this Ticket. This can't be undone.",
        ),
      )
      .toBeVisible();
    const action = confirmation.getByRole("button", {
      name: "Delete reference",
      exact: true,
    });
    expect(getComputedStyle(action.element()).backgroundColor).toBe(
      "rgb(207, 34, 46)",
    );
    expect(confirmation.element().getBoundingClientRect().width).toBe(400);
  });

  test("names a reference without a title by its address in the question", async () => {
    stubReferences();
    const { screen } = await renderTab();

    await deleteOf(screen, PATCH).click();

    await expect
      .element(
        screen.getByRole("dialog", {
          name: `Delete reference ${PATCH.url}?`,
        }),
      )
      .toBeVisible();
  });

  test("deletes the reference with Delete Reference, then announces it once the references are read again, and reads again what it affects", async () => {
    let references: TicketReferenceResponse[] = [...EVERY_REFERENCE];
    const removed: string[] = [];
    const { spy } = stubReferences({
      references: () => referencesResponse(references),
      remove: (path) => {
        removed.push(path);
        references = [NVD, PATCH, ISSUE, POST];
        return deleted();
      },
    });
    const { screen } = await renderTab();
    const reads = requestsTo(spy, TICKET);

    const confirmation = await deleteReference(screen, ADVISORY);

    await expect.element(confirmation).not.toBeInTheDocument();
    await expect
      .poll(() => namesOf(screen))
      .toEqual([NVD.title, PATCH.url, ISSUE.title, POST.title]);
    expect(removed).toEqual([`${REFERENCES}/${ADVISORY.id}`]);
    await expect
      .poll(() => announcementsOf(screen))
      .toEqual(["Reference “Fictional advisory” deleted."]);
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
  });

  test("moves the focus to Add reference after Delete of the last reference, which leaves No references.", async () => {
    let references: TicketReferenceResponse[] = [ADVISORY];
    stubReferences({
      references: () => referencesResponse(references),
      remove: () => {
        references = [];
        return deleted();
      },
    });
    const { screen } = await renderTab();

    await deleteReference(screen, ADVISORY);

    await expect
      .element(panelOf(screen).getByText("No references.", { exact: true }))
      .toBeVisible();
    await expect.element(addButton(screen)).toHaveFocus();
    await frames();
    expect(focused()).toBe(addButton(screen).element());
  });

  test("keeps the reference after Cancel, without a request", async () => {
    const { spy } = stubReferences();
    const { screen } = await renderTab();

    await deleteOf(screen, ADVISORY).click();
    await confirmationOf(screen, ADVISORY)
      .getByRole("button", { name: "Cancel" })
      .click();

    await expect
      .element(confirmationOf(screen, ADVISORY))
      .not.toBeInTheDocument();
    expect(requestsWith(spy, "DELETE")).toHaveLength(0);
    expect(namesOf(screen)).toHaveLength(5);
  });

  describe("the focus after Delete", () => {
    test("moves to the Delete of the row that takes its place", async () => {
      const { screen } = await deleteAmong([...EVERY_REFERENCE], ADVISORY);

      await expectFocusSettledOn(deleteOf(screen, PATCH));
    });

    test("moves to the row that takes the place of the reference when it has no Delete", async () => {
      const { screen } = await deleteAmong([ADVISORY, ISSUE], ADVISORY);

      await expectFocusSettledOn(rowOf(screen, ISSUE));
    });

    test("moves to Add reference after Delete of the last row", async () => {
      const { screen } = await deleteAmong([NVD, POST], POST);

      await expectFocusSettledOn(addButton(screen));
    });

    test("moves to the Delete of the row that takes its place among the rows that match the filters", async () => {
      const { screen } = await deleteAmong(
        [...EVERY_REFERENCE],
        ADVISORY,
        `${PATH}?source=manual`,
      );

      await expectFocusSettledOn(deleteOf(screen, PATCH));
    });

    test("moves no more once the read after Delete fails, and moves to the screen's heading when a later read removes the row of the focus", async () => {
      let phase: "before" | "failing" | "gone" = "before";
      stubReferences({
        references: () => {
          if (phase === "failing") {
            return errorResponse(503, "DATABASE_UNAVAILABLE");
          }
          return referencesResponse(
            phase === "gone" ? [NVD, PATCH, ISSUE, POST] : EVERY_REFERENCE,
          );
        },
        remove: () => {
          phase = "failing";
          return deleted();
        },
      });
      const { screen } = await renderTab();

      await deleteReference(screen, ADVISORY);

      await expect
        .element(panelOf(screen).getByText(/^This couldn't be updated\./))
        .toBeVisible();
      await expect
        .poll(() =>
          rowOf(screen, ADVISORY).element().contains(document.activeElement),
        )
        .toBe(true);
      await frames();
      expect(
        rowOf(screen, ADVISORY).element().contains(document.activeElement),
      ).toBe(true);
      // Meanwhile another analyst deleted it, or Sentinel had.
      phase = "gone";

      await returnToForeground();

      await expect.poll(() => rowOf(screen, ADVISORY).query()).toBeNull();
      await expectFocusSettledOn(heading(screen, "SNTL-12"));
    });

    test("stays where the user moved it out of the table before the reference left it", async () => {
      const reread = later();
      let removed = false;
      stubReferences({
        references: () => (removed ? reread.promise : referencesResponse()),
        remove: () => {
          removed = true;
          return deleted();
        },
      });
      const { screen } = await renderTab();
      const confirmation = await deleteReference(screen, ADVISORY);
      await expect.element(confirmation).not.toBeInTheDocument();
      const filters = screen.getByRole("button", { name: "Filters" });
      filters.element().focus();

      reread.resolve(referencesResponse([NVD, PATCH, ISSUE, POST]));

      await expect.poll(() => rowOf(screen, ADVISORY).query()).toBeNull();
      await frames();
      expect(focused()).toBe(filters.element());
    });
  });

  test("keeps the confirmation open while Delete is in progress", async () => {
    const response = later();
    stubReferences({ remove: () => response.promise });
    const { screen } = await renderTab();

    const confirmation = await deleteReference(screen, ADVISORY);

    await expect
      .element(
        confirmation.getByRole("button", {
          name: "Delete reference",
          exact: true,
        }),
      )
      .toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");
    await expect.element(confirmation).toBeVisible();
    response.resolve(deleted());
    await expect.element(confirmation).not.toBeInTheDocument();
  });

  test.each([
    [
      "an automatic reference, as an error",
      () => errorResponse(409, "RESOURCE_NOT_EDITABLE"),
      MESSAGE_CONFLICT,
      MESSAGE_TONES.danger,
    ],
    [
      "a reference that no longer exists, as an error",
      () => errorResponse(404, "RESOURCE_NOT_FOUND"),
      MESSAGE_GONE,
      MESSAGE_TONES.danger,
    ],
    [
      "a change that Sentinel did not confirm, as a warning",
      () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      MESSAGE_UNCONFIRMED,
      MESSAGE_TONES.warning,
    ],
    [
      "a status and a code that the pinned contract does not list, as an error",
      () => errorResponse(418, "FICTIONAL_CODE"),
      MESSAGE_NOT_ACCEPTED,
      MESSAGE_TONES.danger,
    ],
  ])(
    "shows the failure of %s at the top of the confirmation, which stays open and takes the focus, and reads again what it affects",
    async (_, response, message, tone) => {
      const { spy } = stubReferences({ remove: response });
      const { screen } = await renderTab();
      const reads = requestsTo(spy, TICKET);

      const confirmation = await deleteReference(screen, ADVISORY);

      const error = confirmation.getByText(message);
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(tone);
      await expectFocusOnError(error);
      await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads + 1);
      await expect.element(confirmation).toBeVisible();
    },
  );

  test("shows Delete in the message area, as a success, once the read of the references after it fails, and announces nothing in the tab", async () => {
    const reread = later();
    let removed = false;
    stubReferences({
      references: () => (removed ? reread.promise : referencesResponse()),
      remove: () => {
        removed = true;
        return deleted();
      },
    });
    const { screen } = await renderTab();
    const text = "Reference “Fictional advisory” deleted.";
    const message = screen.getByText(text, { exact: true });

    const confirmation = await deleteReference(screen, ADVISORY);

    await expect.element(confirmation).not.toBeInTheDocument();
    expect(announcementsOf(screen)).toEqual([]);
    expect(message.query()).toBeNull();
    reread.resolve(errorResponse(503, "DATABASE_UNAVAILABLE"));

    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
    await frames();
    expect(announcementsOf(screen)).not.toContain(text);
  });
});
