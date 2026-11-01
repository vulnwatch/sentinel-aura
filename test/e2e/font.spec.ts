import { expect, test } from "./fixtures";

// The font of the UI (docs/design-system.md, Font): Inter, served from the
// UI's origin under its Content Security Policy, in its Latin and Latin
// Extended subsets only, each of which the browser downloads only for a text
// that needs it.

test.describe("the font", () => {
  test("shows the text in Inter, served from the UI's origin", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const font = await page.evaluate(async () => {
      await document.fonts.ready;
      const faces: string[] = [];
      document.fonts.forEach((face) => {
        faces.push(`${face.family.replaceAll('"', "")}: ${face.status}`);
      });
      // The faces that a text in Latin Extended and one in Cyrillic need.
      const extended = await document.fonts.load("15px Inter", "Łź");
      const cyrillic = await document.fonts.load("15px Inter", "Жук");
      return {
        family: getComputedStyle(document.body).fontFamily,
        faces,
        rendered: document.fonts.check("15px Inter"),
        extended: extended.length,
        cyrillic: cyrillic.length,
        files: performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => name.endsWith(".woff2")),
      };
    });
    const origin = new URL(page.url()).origin;
    expect(font.family).toMatch(/^Inter, /);
    // Two faces, of which the page's text needed the Latin one.
    expect(font.faces.toSorted()).toEqual(["Inter: loaded", "Inter: unloaded"]);
    expect(font.rendered).toBe(true);
    expect(font.extended, "the Latin Extended face").toBe(1);
    expect(font.cyrillic, "no Cyrillic face").toBe(0);
    expect(font.files.toSorted()).toEqual([
      expect.stringMatching(
        new RegExp(
          `^${origin}/assets/inter-latin-ext-opsz-normal-[^/]+\\.woff2$`,
        ),
      ),
      expect.stringMatching(
        new RegExp(`^${origin}/assets/inter-latin-opsz-normal-[^/]+\\.woff2$`),
      ),
    ]);
  });
});
