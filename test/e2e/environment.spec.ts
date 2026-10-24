import { expect, test } from "./fixtures";

test.describe("the end-to-end environment", () => {
  test("serves the UI's production image with its policy", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toContain(
      "require-trusted-types-for 'script'",
    );
  });
});

// Each of these tests breaks one check of the shared fixture, which must then
// fail it.
test.describe("the checks of every test", () => {
  test("fail on a policy violation", async ({ page }) => {
    test.fail();
    await page.goto("/");
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.textContent = "body { color: black; }";
      document.head.append(style);
    });
  });

  test("fail on an uncaught exception", async ({ page }) => {
    test.fail();
    await page.goto("/");
    const error = page.waitForEvent("pageerror");
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error("A fictional uncaught exception");
      });
    });
    await error;
  });

  test("fail on an accessibility violation", async ({ page }) => {
    test.fail();
    await page.goto("/");
    await page.evaluate(() => {
      document.body.append(document.createElement("button"));
    });
  });
});
