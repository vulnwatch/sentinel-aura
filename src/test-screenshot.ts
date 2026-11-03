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

export async function screenshot(element: Locator): Promise<Screenshot> {
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
