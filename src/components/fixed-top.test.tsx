import { useLayoutEffect, useRef } from "react";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { fixedTopHeight, useFixedTopHeight } from "./fixed-top";

// What stays at the top of the window while the page scrolls gives its
// height to the scroll padding of the page (docs/design-system.md, Main
// Content; Detail Screens).

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

// The message area, while it holds a message.
function MessageArea({ fixed, height }: TopProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFixedTopHeight("--message-area-height", ref, fixed);
  return <div ref={ref} className={height} />;
}

function scrollPadding(): string {
  return getComputedStyle(document.documentElement).scrollPaddingTop;
}

// Reads the scroll padding in the commit in which it first renders, after the
// elements before it, as code that moves the focus in that commit sees it.
function ReadAtCommit({ onRead }: { onRead: (padding: string) => void }) {
  useLayoutEffect(() => {
    onRead(scrollPadding());
  }, [onRead]);
  return null;
}

test("gives the page the scroll padding of the heights of what stays at the top, while it stays there", async () => {
  const screen = await render(
    <>
      <MessageArea fixed height="h-10" />
      <CompactHeading fixed height="h-20" />
    </>,
  );

  expect(scrollPadding()).toBe("120px");
  expect(fixedTopHeight("--message-area-height")).toBe(40);
  expect(fixedTopHeight("--compact-heading-height")).toBe(80);

  await screen.rerender(
    <>
      <MessageArea fixed height="h-12" />
      <CompactHeading fixed={false} height="h-20" />
    </>,
  );

  await expect.poll(scrollPadding).toBe("48px");
  expect(fixedTopHeight("--compact-heading-height")).toBe(0);

  await screen.unmount();

  expect(scrollPadding()).toBe("0px");
  expect(fixedTopHeight("--message-area-height")).toBe(0);
});

test("gives the scroll padding in the commit that fixes the element, before its size is observed", async () => {
  const read: string[] = [];
  await render(
    <>
      <MessageArea fixed height="h-10" />
      <CompactHeading fixed height="h-20" />
      <ReadAtCommit
        onRead={(padding) => {
          read.push(padding);
        }}
      />
    </>,
  );

  expect(read[0]).toBe("120px");
});
