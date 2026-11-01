import { useEffect } from "react";
import { Button } from "./button";
import { ErrorContent } from "./error-in-place";
import { focusScreenHeading } from "./screen-heading";

interface UiFailureProps {
  // Reloads the page.
  onReload: () => void;
}

// A failure of the UI itself, such as an error while it shows data, in place
// of the content of the screen (docs/behaviors.md, Default Presentation by
// Status). When the failure removed the element that held the focus, such as
// the control that the user had just used, the focus moves to its heading
// (docs/behaviors.md, Accessibility, Focus after an action).
export function UiFailure({ onReload }: UiFailureProps) {
  useEffect(() => {
    if (document.activeElement === document.body) {
      focusScreenHeading();
    }
  }, []);
  return (
    <main className="p-6">
      <ErrorContent
        heading="Something went wrong"
        message="This page couldn't be shown. Reload the page to try again."
        action={<Button onPress={onReload}>Reload page</Button>}
      />
    </main>
  );
}

function reloadPage() {
  window.location.reload();
}

// The page that the router shows when a screen fails (src/router.ts).
export function UiFailurePage() {
  return <UiFailure onReload={reloadPage} />;
}
