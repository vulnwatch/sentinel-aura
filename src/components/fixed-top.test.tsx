import { useLayoutEffect, useRef } from "react";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { fixedTopHeight, useFixedTopHeight } from "./fixed-top";

// The compact heading of a detail screen, which stays at the top of the
// window while the page scrolls, gives its height to the scroll padding at
// the top of the page (docs/design-system.md, Main Content; Detail Screens).

interface TopProps {
  fixed: boolean;
  // The class of its height.
  height: string;
}

// An element at the top of the window, such as the compact heading of a
// detail screen, while it is fixed there.
function CompactHeading({ fixed, height }: TopProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFixedTopHeight("--compact-heading-height", ref, fixed);
  return <div ref={ref} className={height} />;
}

function scrollPadding(): string {
  return getComputedStyle(document.documentElement).scrollPaddingTop;
}

// Reads the scroll padding in the commit in which it first renders, after the
// element before it, as code that moves the focus in that commit sees it.
function ReadAtCommit({ onRead }: { onRead: (padding: string) => void }) {
  useLayoutEffect(() => {
    onRead(scrollPadding());
  }, [onRead]);
  return null;
}

test("gives the page a scroll padding at its top as high as the compact heading while it stays at the top of the window, and none otherwise", async () => {
  const screen = await render(<CompactHeading fixed height="h-20" />);

  expect(scrollPadding()).toBe("80px");
  expect(fixedTopHeight("--compact-heading-height")).toBe(80);
  // Only at the top: the message area gives the scroll padding at the bottom
  // itself (src/components/message-area.tsx).
  expect(getComputedStyle(document.documentElement).scrollPaddingBottom).toBe(
    "0px",
  );

  await screen.rerender(<CompactHeading fixed height="h-12" />);

  await expect.poll(scrollPadding).toBe("48px");
  expect(fixedTopHeight("--compact-heading-height")).toBe(48);
  await screen.rerender(<CompactHeading fixed={false} height="h-12" />);
  await expect.poll(scrollPadding).toBe("0px");
  expect(fixedTopHeight("--compact-heading-height")).toBe(0);
  await screen.rerender(<CompactHeading fixed height="h-12" />);
  await expect.poll(scrollPadding).toBe("48px");
  await screen.unmount();
  expect(scrollPadding()).toBe("0px");
  expect(fixedTopHeight("--compact-heading-height")).toBe(0);
});

test("gives the scroll padding in the commit that fixes the element, before its size is observed", async () => {
  const read: string[] = [];
  await render(
    <>
      <CompactHeading fixed height="h-20" />
      <ReadAtCommit
        onRead={(padding) => {
          read.push(padding);
        }}
      />
    </>,
  );

  expect(read[0]).toBe("80px");
});
