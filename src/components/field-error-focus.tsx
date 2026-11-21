import { useCallback, useState, type ReactNode, type RefCallback } from "react";

// The focus after a submission whose errors are at fields alone, which moves
// to the first field with an error, so that assistive technologies read the
// error with it (docs/behaviors.md, Accessibility, Announcements). A field
// that holds the focus already, as after Enter in it or on a radio button,
// fires no event as it takes the focus again, and assistive technologies do
// not read a description that changes on the element with the focus: its
// error is announced instead, by a status region of the form that is there
// before the error, so that each submission announces it, also with the
// same error. A field that takes the focus is read with its error, which is
// then not announced as well.

interface Announcement {
  // A new key for each announcement, so that the same text is announced
  // again.
  key: number;
  text: string;
}

export interface FieldErrorFocus {
  // Moves the focus to the field with the error, or announces the error
  // when the field holds the focus already. A form calls it once for each
  // submission that shows the error.
  focusField: (field: HTMLElement | null | undefined, error: string) => void;
  // The ref of a form whose fields the browser checks as it is submitted,
  // such as a required field: React Aria moves the focus to the first field
  // that fails its check, whose error this announces when that field holds
  // the focus already.
  formRef: RefCallback<HTMLFormElement>;
  // The status region, which the form, or the popover of a field, holds.
  region: ReactNode;
}

// The first field of the form that fails the browser's check, to which React
// Aria moves the focus.
function firstInvalid(form: HTMLFormElement): Element | undefined {
  return [...form.elements].find(
    (element) =>
      "validity" in element &&
      element.validity instanceof ValidityState &&
      !element.validity.valid,
  );
}

// shown tells whether the form still shows an error at a field, as it holds
// it: once it shows none, the region empties too, also when the error goes
// without an event of the field, as when a radio button is chosen by its
// label.
export function useFieldErrorFocus(shown = true): FieldErrorFocus {
  const [announcement, setAnnouncement] = useState<Announcement>();
  if (!shown && announcement !== undefined) {
    setAnnouncement(undefined);
  }
  // The region holds the error until the user changes the input of the field
  // or the field loses the focus, so that it does not repeat later an error
  // that may have gone. It follows these events on the document, once React
  // has handled them: a render during the input event, before React reads
  // the new value, would give the field its value before the input again.
  const announce = useCallback((field: HTMLElement, text: string) => {
    setAnnouncement((current) => ({ key: (current?.key ?? 0) + 1, text }));
    const done = new AbortController();
    const clear = (event: Event) => {
      if (event.target === field) {
        setAnnouncement(undefined);
        done.abort();
      }
    };
    for (const type of ["input", "change", "focusout"]) {
      field.ownerDocument.addEventListener(type, clear, {
        signal: done.signal,
      });
    }
  }, []);

  const focusField = useCallback(
    (field: HTMLElement | null | undefined, error: string) => {
      if (field === null || field === undefined) {
        return;
      }
      if (field === document.activeElement) {
        announce(field, error);
      } else {
        field.focus();
      }
    },
    [announce],
  );

  // In the capture phase, before React Aria moves the focus: the event does
  // not bubble.
  const formRef = useCallback(
    (form: HTMLFormElement | null) => {
      if (form === null) {
        return undefined;
      }
      const onInvalid = (event: Event) => {
        const field = event.target;
        if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement
        ) {
          if (
            field === document.activeElement &&
            field === firstInvalid(form)
          ) {
            announce(field, field.validationMessage);
          }
        }
      };
      form.addEventListener("invalid", onInvalid, true);
      return () => {
        form.removeEventListener("invalid", onInvalid, true);
      };
    },
    [announce],
  );

  return {
    focusField,
    formRef,
    region: (
      <output className="sr-only">
        <span key={announcement?.key}>{announcement?.text}</span>
      </output>
    ),
  };
}
