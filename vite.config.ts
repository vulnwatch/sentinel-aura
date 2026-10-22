import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Holds the screenshots of failed tests, among other attachments.
    attachmentsDir: "test-results/vitest",
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }, { browser: "firefox" }],
    },
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.{ts,tsx}"],
      // clover.xml is the report that CI uploads to Codecov.
      reporter: ["text", "html", "clover"],
      // A subdirectory, because Vitest removes and recreates the reports
      // directory, and coverage/ is a mount point in the tooling container.
      reportsDirectory: "coverage/unit",
    },
  },
});
