import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";
import { focusScreenHeading } from "./screen-heading";

// The focus in a table whose rows a change or a read takes away
// (docs/behaviors.md, Accessibility, Focus after an action).

// A row that Delete deleted, with its place among the rows, which the focus
// takes once a read no longer returns it, and the instant at which Sentinel
// confirmed it, after which the first read of the rows decides: a read that
// fails drops it, and a later read that removes the row moves the focus as
// for any row that a read removes.
interface Removed {
  id: string;
  index: number;
  at: number;
}

// The identifier of the row that holds an element, which an element of the
// row carries in the attribute, or undefined outside the rows.
function rowIdOf(element: Element, attribute: string): string | undefined {
  return (
    element
      .closest("tbody > tr")
      ?.querySelector(`[${CSS.escape(attribute)}]`)
      ?.getAttribute(attribute) ?? undefined
  );
}

// The row of the table with the identifier.
function rowOf(
  place: Element,
  attribute: string,
  id: string,
): HTMLElement | null {
  return (
    place
      .querySelector(`[${CSS.escape(attribute)}="${CSS.escape(id)}"]`)
      ?.closest<HTMLElement>("tbody > tr") ?? null
  );
}

// How many frames the focus waits at most for the table to take a row away.
const REMOVAL_FRAMES = 10;

interface RowFocusOptions<TRow> {
  // The element around the table.
  container: RefObject<HTMLElement | null>;
  // The rows that the table shows, or undefined while it shows none.
  rows: readonly TRow[] | undefined;
  rowId: (row: TRow) => string;
  // The attribute that an element of each row carries with the identifier
  // of its row.
  attribute: string;
  // The element of a row that takes the focus after Delete of the row
  // before it, or null for the row itself.
  control: (row: HTMLElement) => HTMLElement | null;
  // The element that takes the focus after Delete when no row follows.
  fallback: () => HTMLElement | null | undefined;
  // The read of the rows.
  read: { dataUpdatedAt: number; errorUpdatedAt: number };
}

// Where the focus moves when the row that holds it leaves the table: after
// Delete, which deleted tells once Sentinel has confirmed it, to the control
// of the row that takes its place, or to that row without one, or to the
// fallback when no row follows; otherwise, as when a read removes the row or
// a change takes it out of the rows that the table shows, to the screen's
// heading. A row that a read moves keeps it. added tells that a change that
// Sentinel confirmed added a row, which takes the focus at its control once
// it shows when the element that started the change has left the page
// meanwhile, such as an add action that the new row leaves with nothing to
// add. holds tells that a row holds
// the focus, as the row of a dialog that closes after a change that Sentinel
// confirmed does before the dialog has returned the focus to it. The options
// other than the rows and the read keep their identity from one render to
// the next, such as functions of a module, so that the focus moves only as
// the rows change.
export function useRowFocusAfterRemoval<TRow>({
  container,
  rows,
  rowId,
  attribute,
  control,
  fallback,
  read,
}: RowFocusOptions<TRow>): {
  deleted: (id: string, index: number) => void;
  holds: (id: string) => void;
  added: (id: string) => void;
} {
  const removed = useRef<Removed>(undefined);
  const focused = useRef<string>(undefined);
  // A row that a change added, with the instant at which Sentinel confirmed
  // it (added).
  const fresh = useRef<{ id: string; at: number }>(undefined);

  // The row that has the focus, which the focus leaves for good when it
  // moves out of the container, or when the pointer presses outside it; a
  // row that leaves the page takes the focus without either. A dialog that a
  // row opened takes it, and gives it back to the row as it closes (holds).
  useEffect(() => {
    const element = container.current;
    if (element === null) {
      return undefined;
    }
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Element) {
        focused.current = rowIdOf(event.target, attribute);
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      if (
        event.relatedTarget instanceof Node &&
        !element.contains(event.relatedTarget)
      ) {
        focused.current = undefined;
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target)) {
        focused.current = undefined;
      }
    };
    element.addEventListener("focusin", onFocusIn);
    element.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      element.removeEventListener("focusin", onFocusIn);
      element.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [container, attribute]);

  const readAt = read.dataUpdatedAt;
  const failedAt = read.errorUpdatedAt;
  // A Delete whose first read after it fails moves the focus no more
  // (Removed).
  useLayoutEffect(() => {
    const pending = removed.current?.at;
    if (pending !== undefined && failedAt >= pending && readAt < pending) {
      removed.current = undefined;
    }
    const adding = fresh.current?.at;
    if (adding !== undefined && failedAt >= adding && readAt < adding) {
      fresh.current = undefined;
    }
  }, [readAt, failedAt]);

  // React Aria's table takes the row away from the page in a later render
  // and moves the focus within the table itself, so the focus moves once the
  // row has left the page, unless the user moved it out of the container
  // meanwhile.
  useEffect(() => {
    const element = container.current;
    if (rows === undefined || element === null) {
      return;
    }
    // A row that a change added takes the focus, at its control, once it
    // shows, when the element that started the change has left the page
    // meanwhile, so that the focus is on the body or on the screen's
    // heading, where that element hands it off: the row holds the action
    // that reverses the change.
    const added = fresh.current;
    if (added !== undefined && rows.some((row) => rowId(row) === added.id)) {
      fresh.current = undefined;
      let waited = 0;
      const show = () => {
        if (!element.isConnected) {
          return;
        }
        const row = rowOf(element, attribute, added.id);
        if (row === null && waited < REMOVAL_FRAMES) {
          waited += 1;
          requestAnimationFrame(show);
          return;
        }
        const active = document.activeElement;
        if (
          row !== null &&
          (active === null || active === document.body || active.matches("h1"))
        ) {
          (control(row) ?? row).focus();
        }
      };
      requestAnimationFrame(show);
    }
    const gone = removed.current;
    const holder = focused.current;
    let goneId: string;
    let moveFocus: () => void;
    if (gone !== undefined && !rows.some((row) => rowId(row) === gone.id)) {
      removed.current = undefined;
      focused.current = undefined;
      goneId = gone.id;
      const next = rows[gone.index];
      moveFocus = () => {
        const row =
          next === undefined ? null : rowOf(element, attribute, rowId(next));
        (row === null ? fallback() : (control(row) ?? row))?.focus();
      };
    } else if (
      holder !== undefined &&
      !rows.some((row) => rowId(row) === holder)
    ) {
      focused.current = undefined;
      goneId = holder;
      moveFocus = focusScreenHeading;
    } else {
      return;
    }
    let frames = 0;
    const move = () => {
      if (!element.isConnected) {
        return;
      }
      // While the focus is on the body after the row left, or on the
      // screen's heading, where a dialog that closed returns it when the
      // element that opened it has left, React Aria's table has yet to move
      // it into the row that takes its place, which would take it back from
      // where the focus moves.
      const unsettled =
        document.activeElement === document.body ||
        document.activeElement?.matches("h1") === true;
      if (
        (rowOf(element, attribute, goneId) !== null || unsettled) &&
        frames < REMOVAL_FRAMES
      ) {
        frames += 1;
        requestAnimationFrame(move);
        return;
      }
      const active = document.activeElement;
      if (
        active === null ||
        active === document.body ||
        active.matches("h1") ||
        element.contains(active)
      ) {
        moveFocus();
      }
    };
    requestAnimationFrame(move);
  }, [rows, container, rowId, attribute, control, fallback]);

  const deleted = useCallback((id: string, index: number) => {
    removed.current = { id, index, at: Date.now() };
  }, []);
  const holds = useCallback((id: string) => {
    focused.current = id;
  }, []);
  const added = useCallback((id: string) => {
    fresh.current = { id, at: Date.now() };
  }, []);
  return { deleted, holds, added };
}
