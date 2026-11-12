import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Button } from "./button";
import { FOCUS_RING } from "./focus-ring";
import { Message } from "./message";
import { focusScreenHeading } from "./screen-heading";

// A dialog centered over the page (docs/design-system.md, Dialogs).

// Its widths: at most 400 px for a confirmation, and 560 px for a dialog with
// a form; a window narrower than the dialog with its margin keeps it inside.
const WIDTHS = {
  confirmation: "max-w-100",
  form: "max-w-140",
} as const;

interface ModalDialogProps {
  isOpen: boolean;
  // Closes the dialog, as Escape does.
  onClose: () => void;
  width: keyof typeof WIDTHS;
  // The title, which names the dialog.
  title: string;
  // Whether the dialog can be closed: not while its change is in progress
  // (docs/behaviors.md, Loading).
  closable?: boolean;
  // Its content, which scrolls within the dialog in a window shorter than
  // it is.
  children: ReactNode;
  // Its buttons, at its end, which stay in view.
  buttons: ReactNode;
}

// A dialog over overlay, centered, on surface with a border line, an 8 px
// radius, shadow-xl, and 20 px of padding: its title in text-16, weight 600,
// its content 12 px below, and its buttons 20 px below the content, 8 px
// apart, aligned to its end. A dialog taller than the window scrolls its
// content and keeps its buttons in view. It has no close icon: its buttons
// and Escape close it, a click outside does not. While it is open, the rest
// of the page is out of reach of the keyboard and of assistive technologies;
// once it closes, the focus returns to the element that opened it
// (docs/behaviors.md, Accessibility, Dialogs). The dialog takes the focus
// itself as it opens, unless an element of its content takes it. When it
// leaves the page while it is open, as when a read removes what opened it,
// the focus moves to the screen's heading (docs/behaviors.md, Accessibility,
// Focus after an action).
export function ModalDialog({
  isOpen,
  onClose,
  width,
  title,
  closable = true,
  children,
  buttons,
}: ModalDialogProps) {
  const dialogId = useId();
  // React Aria returns the focus to the element that opened the dialog, or
  // to a dialog that holds this one, in the next frame, when it can; the
  // screen's heading takes the focus only when it could not.
  useLayoutEffect(
    () => () => {
      if (document.getElementById(dialogId)?.contains(document.activeElement)) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (
              document.activeElement === null ||
              document.activeElement === document.body
            ) {
              focusScreenHeading();
            }
          });
        });
      }
    },
    [dialogId],
  );
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      isKeyboardDismissDisabled={!closable}
      className="fixed inset-0 z-30 flex items-center justify-center bg-overlay p-4"
    >
      <Modal
        className={`flex max-h-full w-full flex-col outline-none ${WIDTHS[width]}`}
      >
        <Dialog
          id={dialogId}
          className={`flex max-h-full min-h-0 flex-col rounded-lg border border-border bg-surface p-5 text-15 text-fg shadow-xl ${FOCUS_RING}`}
        >
          <Heading slot="title" className="text-16 font-semibold">
            {title}
          </Heading>
          <div className="-mx-1 mt-3 min-h-0 overflow-y-auto px-1">
            {children}
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">{buttons}</div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

interface FirstFieldFocusProps {
  children: ReactNode;
}

// Content of a dialog whose first field, or first button, takes the focus as
// the dialog opens (docs/behaviors.md, Accessibility, Dialogs), such as the
// field of a form, or Cancel in a confirmation. It adds no box of its own to
// the layout.
export function FirstFieldFocus({ children }: FirstFieldFocusProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input, button")?.focus();
  }, []);
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}

// The error of a change submitted from a dialog, which shows at the top of
// its content (docs/behaviors.md, Where Errors Appear).
export interface DialogError {
  message: string;
  reference: string | undefined;
  // Whether Sentinel did not confirm the change, which shows as a warning
  // rather than as an error (docs/design-system.md, Forms).
  unconfirmed: boolean;
}

interface DialogErrorMessageProps {
  error: DialogError;
}

// The error at the top of a dialog or of its form, without a dismiss button,
// which takes the focus as it shows, so that it is read
// (docs/behaviors.md, Accessibility, Announcements).
export function DialogErrorMessage({ error }: DialogErrorMessageProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The focus moves to each new error, also one with the same message.
  useEffect(() => {
    ref.current?.focus();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- each new error is the event that the effect follows
  }, [error]);
  return (
    <div ref={ref} tabIndex={-1} className={`mb-3 rounded-md ${FOCUS_RING}`}>
      <Message
        tone={error.unconfirmed ? "warning" : "danger"}
        reference={error.reference}
      >
        {error.message}
      </Message>
    </div>
  );
}

interface ConfirmationDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  // The title, which asks for the action and its object, such as "Revoke
  // access of Carol White?".
  title: string;
  // The consequence of the action.
  children: ReactNode;
  // The name of the action, the label of the button that confirms it, such
  // as "Revoke access".
  action: string;
  // The label of the button that keeps things as they are: Cancel, or Keep
  // editing before discarding input (docs/behaviors.md, Confirmation).
  cancelLabel?: "Cancel" | "Keep editing";
  onConfirm: () => void;
  // Whether the confirmed action is in progress.
  isBusy: boolean;
  // The error of the action, or undefined.
  error: DialogError | undefined;
}

// A confirmation (docs/behaviors.md, Confirmation): a dialog at most 400 px
// wide, its title the question, its text the consequence in fg-muted, then
// Cancel, or Keep editing, a secondary button, which takes the focus as the
// dialog opens, and the action, a danger button. While the action is in
// progress, its button is busy, and the dialog cannot be closed. An error of the action shows at
// the top of the dialog, which stays open.
export function ConfirmationDialog({
  isOpen,
  onCancel,
  title,
  children,
  action,
  cancelLabel = "Cancel",
  onConfirm,
  isBusy,
  error,
}: ConfirmationDialogProps) {
  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onCancel}
      width="confirmation"
      title={title}
      closable={!isBusy}
      buttons={
        <>
          <FirstFieldFocus>
            <Button size="large" isDisabled={isBusy} onPress={onCancel}>
              {cancelLabel}
            </Button>
          </FirstFieldFocus>
          <Button
            size="large"
            variant="danger"
            isBusy={isBusy}
            onPress={onConfirm}
          >
            {action}
          </Button>
        </>
      }
    >
      {error !== undefined && <DialogErrorMessage error={error} />}
      <div className="text-fg-muted">{children}</div>
    </ModalDialog>
  );
}
