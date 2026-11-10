import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Label, ProgressBar } from "react-aria-components";

// How long a part waits for its data before it shows that it is loading, so
// that a fast response shows nothing (docs/behaviors.md, Loading).
export const LOADING_DELAY_MS = 300;

// Whether the delay has passed since the component mounted.
function useDelayPassed(): boolean {
  const [passed, setPassed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setPassed(true);
    }, LOADING_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return passed;
}

interface LoadingProps {
  // Whether the place is a value of a description list, such as a field of
  // the details of a record, which the indicator takes without the space of
  // a part above and below it.
  inValue?: boolean;
}

// The loading indicator of a part that waits for its data, centered in its
// place (docs/design-system.md, Loading). The spinner stands still when the
// browser reports a preference for reduced motion (Focus and Motion).
export function Loading({ inValue = false }: LoadingProps) {
  const shown = useDelayPassed();
  if (!shown) {
    return null;
  }
  return (
    <ProgressBar
      isIndeterminate
      className={`flex items-center justify-center gap-2 text-fg-muted ${inValue ? "" : "py-10"}`}
    >
      <LoaderCircle
        aria-hidden
        className="size-4.5 animate-spin motion-reduce:animate-none"
      />
      <Label>Loading</Label>
    </ProgressBar>
  );
}

// The mark of data that stays shown while other data loads: a progress bar
// 2 px high along the top edge of the place of the data, which is positioned
// (docs/design-system.md, Loading). It shows after the same delay as the
// loading indicator, and stands still under reduced motion.
export function UpdatingBar() {
  const shown = useDelayPassed();
  if (!shown) {
    return null;
  }
  return (
    <ProgressBar
      isIndeterminate
      aria-label="Updating"
      className="absolute inset-x-0 top-0 h-0.5 overflow-hidden"
    >
      <div className="h-full w-1/3 animate-progress bg-accent motion-reduce:animate-none" />
    </ProgressBar>
  );
}
