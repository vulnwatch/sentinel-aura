import { page, type Locator } from "vitest/browser";

// A screenshot of an element, whose pixels a component test reads: the
// colors and shapes of a mark that is hidden from assistive technologies, so
// that the test can find it only through an element around it.
export interface Screenshot {
  // The size of the element, in CSS pixels.
  width: number;
  height: number;
  // The color of the pixel at a point of the element, in CSS pixels from its
  // top left corner, as #rrggbb.
  at: (x: number, y: number) => string;
}

// Moves the pointer to a corner of the window that the element does not
// cover. Vitest runs several test files one after another in one page, so
// the pointer rests where an earlier test left it, and where it rests on the
// element, the element shows its colors under the pointer.
async function pointerAwayFrom(element: Locator) {
  const box = element.element().getBoundingClientRect();
  const width = window.innerWidth;
  const height = window.innerHeight;
  const corners = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
  ];
  const corner =
    corners.find(
      ({ x, y }) =>
        x < box.left || x >= box.right || y < box.top || y >= box.bottom,
    ) ?? corners[0]!;
  // The root element starts at the top left corner of the window unless the
  // page scrolls; force skips the check that the pointer reaches the root
  // element itself, since an element of the page lies over it.
  const root = document.documentElement.getBoundingClientRect();
  await page.elementLocator(document.documentElement).hover({
    position: { x: corner.x - root.left, y: corner.y - root.top },
    force: true,
  });
}

// Waits until every picture that the element loads, such as a profile
// picture, has loaded and can be drawn, or has failed to load. A picture is
// hidden from assistive technologies, so the wait finds the pictures as the
// browser does, as the images of the element.
export async function picturesLoaded(element: Locator): Promise<void> {
  await Promise.allSettled(
    Array.from(element.element().querySelectorAll("img"), (image) =>
      image.decode(),
    ),
  );
}

// A screenshot of the element as it shows once its pictures have loaded.
export async function screenshot(element: Locator): Promise<Screenshot> {
  await picturesLoaded(element);
  await pointerAwayFrom(element);
  const base64 = await page.screenshot({ element, save: false });
  // Measured after the screenshot, which can follow the load of a font that
  // changes the width of a text in the element.
  const box = element.element().getBoundingClientRect();
  const png = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const bitmap = await createImageBitmap(
    new Blob([png], { type: "image/png" }),
  );
  // A new canvas has no other context, so the browser gives it a 2D one.
  const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext(
    "2d",
  )!;
  context.drawImage(bitmap, 0, 0);
  const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  // The pixels of the screenshot per CSS pixel.
  const scale = bitmap.width / box.width;
  return {
    width: box.width,
    height: box.height,
    at: (x, y) => {
      const offset =
        4 * (Math.floor(y * scale) * bitmap.width + Math.floor(x * scale));
      return `#${Array.from(data.slice(offset, offset + 3), (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("")}`;
    },
  };
}
