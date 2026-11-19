import { describe, expect, test } from "vitest";
import { page, type Locator } from "vitest/browser";
import "../styles.css";
import type { CVEDetail } from "../api/generated/model";
import {
  actorsResponse,
  cvssResponse,
  fictionalCve,
  fictionalSource,
  fictionalTicketDetail,
  sourcesResponse,
  ticketPage,
  ticketResponse,
} from "../test-api";
import {
  boxOf,
  heading,
  later,
  nextFrames,
  prepareEachTest,
  region,
  renderTicket,
  type Screen,
  showingTicket,
  stubTicket,
  valueOf,
} from "./ticket-overview/test-support";

// Overview, the first tab of the Ticket screen (src/routes/ticket-overview.tsx;
// docs/screens/ticket.md): the target of the anchor of its URL, at the
// browser's default text size, in the light theme.

prepareEachTest();

// A CVE with many weaknesses, so that the main column is longer than the
// side column, which then sticks while the page scrolls.
function longCve(): CVEDetail {
  return fictionalCve({
    cwes: Array.from({ length: 200 }, (_, index) => ({
      cwe_id: `CWE-${index + 1000}`,
      sources: ["nvd"],
    })),
  });
}

// Every source of a CVE, each that can be refetched but CISA KEV, so that
// the side column is taller than a short window.
const EVERY_SOURCE = [
  "bugzilla",
  "epss",
  "ghsa",
  "kernel",
  "kev",
  "mitre",
  "nvd",
  "osv",
  "redhat",
].map((source) => fictionalSource({ source, refetchable: source !== "kev" }));

// The parts of Overview that the target of an anchor waits for besides the
// duplicates and the work of the signed-in user, which these tests do not
// read, by the name of their region, each with what it shows once its read
// has ended.
const READ_PARTS = {
  "CVSS assessments": (part: Locator) => part.getByText("SUSE").first(),
  "Sources of the CVE": (part: Locator) =>
    part.getByText("NVD", { exact: true }).first(),
  Participants: (part: Locator) =>
    part.getByRole("toolbar", { name: "Participants" }),
};

// Waits until each part of Overview whose read the test does not hold back
// shows what its read gave, and then for two more frames of the page, after
// which the effect of the commit that showed them has run, such as the one
// that shows the target of the anchor.
async function partsShown(screen: Screen, held?: keyof typeof READ_PARTS) {
  for (const [name, shown] of Object.entries(READ_PARTS)) {
    if (name !== held) {
      await expect.element(shown(region(screen, name))).toBeVisible();
    }
  }
  await nextFrames();
}

describe("the anchor of the URL", () => {
  test("shows its part once the reads of the tab have settled", async () => {
    await page.viewport(900, 300);
    const duplicates = later();
    stubTicket({ duplicates: () => duplicates.promise });
    const { screen } = await renderTicket("/tickets/SNTL-12#cve");
    await partsShown(screen);
    expect(window.scrollY).toBe(0);

    duplicates.resolve(ticketPage([]));

    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    expect(Math.round(boxOf(region(screen, "CVE-2099-0012")).top)).toBe(0);
  });

  test("shows its part below the compact heading with two columns", async () => {
    await page.viewport(1280, 300);
    showingTicket(fictionalTicketDetail({ cve: longCve() }));
    const { screen } = await renderTicket("/tickets/SNTL-12#cve");

    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    const title = heading(screen, "SNTL-12");
    await expect
      .poll(() => getComputedStyle(title.element()).fontSize)
      .toBe("16px");
    const tabs = boxOf(screen.getByRole("tab", { name: "Overview" }));
    expect(boxOf(region(screen, "CVE-2099-0012")).top).toBeGreaterThanOrEqual(
      tabs.bottom,
    );
    await expect
      .element(
        region(screen, "CVE-2099-0012").getByRole("heading", { level: 2 }),
      )
      .toBeInViewport();
  });

  test.each([
    ["two columns", 1280],
    ["one column", 900],
  ])("shows the details in %s", async (_, width) => {
    await page.viewport(width, 300);
    showingTicket(fictionalTicketDetail({ cve: longCve() }));
    const { screen } = await renderTicket("/tickets/SNTL-12#details");

    // The page scrolls to the details, which start below the tabs.
    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    const details = region(screen, "Details");
    const tabs = boxOf(screen.getByRole("tab", { name: "Overview" }));
    expect(boxOf(details).top).toBeGreaterThanOrEqual(Math.max(tabs.bottom, 0));
    await expect
      .element(details.getByRole("heading", { level: 2, name: "Details" }))
      .toBeInViewport();
  });

  test("shows its part on a duplicate, whose duplicates the tab does not read", async () => {
    await page.viewport(900, 300);
    showingTicket(
      fictionalTicketDetail({
        status: "duplicated",
        duplicate_of_ticket_id: "SNTL-21",
      }),
    );
    const { screen } = await renderTicket("/tickets/SNTL-12#cve");

    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    expect(Math.round(boxOf(region(screen, "CVE-2099-0012")).top)).toBe(0);
  });

  test("shows the CVSS assessments once their read has settled", async () => {
    await page.viewport(900, 300);
    const cvss = later();
    stubTicket({ cvss: () => cvss.promise });
    const { screen } = await renderTicket("/tickets/SNTL-12#cvss");
    await expect
      .poll(() => valueOf(screen, "Duplicates").textContent)
      .toBe("None");
    await partsShown(screen, "CVSS assessments");
    expect(window.scrollY).toBe(0);

    cvss.resolve(cvssResponse());

    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    await expect
      .element(
        region(screen, "CVSS assessments").getByRole("heading", {
          level: 2,
          name: "CVSS assessments",
        }),
      )
      .toBeInViewport();
  });

  test.each([
    ["two columns", 1280],
    ["one column", 900],
  ])(
    "shows the sources of the CVE in %s once their read has settled",
    async (_, width) => {
      await page.viewport(width, 300);
      const sources = later();
      stubTicket({
        ticket: () => ticketResponse(fictionalTicketDetail({ cve: longCve() })),
        sources: () => sources.promise,
      });
      const { screen } = await renderTicket("/tickets/SNTL-12#sources");
      await expect
        .poll(() => valueOf(screen, "Duplicates").textContent)
        .toBe("None");
      await partsShown(screen, "Sources of the CVE");
      expect(window.scrollY).toBe(0);

      // Every source, so that the window shows the start of the sources
      // before the end of the page.
      sources.resolve(sourcesResponse(EVERY_SOURCE));

      await expect.poll(() => window.scrollY).toBeGreaterThan(0);
      const title = region(screen, "Sources of the CVE").getByRole("heading", {
        level: 2,
        name: "Sources of the CVE",
      });
      await expect.element(title).toBeInViewport();
      // Below the tabs, and so below the compact heading with two columns.
      const tabs = boxOf(screen.getByRole("tab", { name: "Overview" }));
      expect(boxOf(title).top).toBeGreaterThanOrEqual(tabs.bottom);
    },
  );

  test.each([
    ["two columns", 1280],
    ["one column", 900],
  ])(
    "shows the participants in %s once their read has settled",
    async (_, width) => {
      await page.viewport(width, 300);
      const actors = later();
      stubTicket({
        ticket: () => ticketResponse(fictionalTicketDetail({ cve: longCve() })),
        actors: () => actors.promise,
      });
      const { screen } = await renderTicket("/tickets/SNTL-12#participants");
      await expect
        .poll(() => valueOf(screen, "Duplicates").textContent)
        .toBe("None");
      await partsShown(screen, "Participants");
      expect(window.scrollY).toBe(0);

      actors.resolve(actorsResponse([]));

      await expect.poll(() => window.scrollY).toBeGreaterThan(0);
      const title = region(screen, "Participants").getByRole("heading", {
        level: 2,
        name: "Participants",
      });
      await expect.element(title).toBeInViewport();
      const tabs = boxOf(screen.getByRole("tab", { name: "Overview" }));
      expect(boxOf(title).top).toBeGreaterThanOrEqual(tabs.bottom);
    },
  );

  test.each(["cvss", "sources"])(
    "shows the top of the screen when the Ticket lacks the target %s",
    async (anchor) => {
      await page.viewport(900, 300);
      const duplicates = later();
      // The CVSS assessments and the sources of a Ticket without a CVE.
      stubTicket({
        ticket: () => ticketResponse(fictionalTicketDetail({ cve: null })),
        duplicates: () => duplicates.promise,
      });
      const { screen } = await renderTicket(`/tickets/SNTL-12#${anchor}`);
      // The page lies elsewhere, without the user having scrolled it.
      window.scrollTo(0, 10);
      await expect.poll(() => window.scrollY).toBe(10);

      duplicates.resolve(ticketPage([]));

      await expect
        .poll(() => valueOf(screen, "Duplicates").textContent)
        .toBe("None");
      await expect.poll(() => window.scrollY).toBe(0);
    },
  );

  test("leaves the page where the user scrolled it with the keyboard meanwhile", async () => {
    await page.viewport(900, 300);
    const duplicates = later();
    stubTicket({ duplicates: () => duplicates.promise });
    const { screen } = await renderTicket("/tickets/SNTL-12#cve");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
    window.scrollTo(0, 10);

    duplicates.resolve(ticketPage([]));

    await expect
      .poll(() => valueOf(screen, "Duplicates").textContent)
      .toBe("None");
    await partsShown(screen);
    expect(window.scrollY).toBe(10);
  });

  test("still shows its part after a key that does not scroll the page", async () => {
    await page.viewport(900, 300);
    const duplicates = later();
    stubTicket({ duplicates: () => duplicates.promise });
    const { screen } = await renderTicket("/tickets/SNTL-12#cve");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));

    duplicates.resolve(ticketPage([]));

    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    expect(Math.round(boxOf(region(screen, "CVE-2099-0012")).top)).toBe(0);
  });

  test("leaves the page where the user scrolled it meanwhile", async () => {
    await page.viewport(900, 300);
    const duplicates = later();
    stubTicket({ duplicates: () => duplicates.promise });
    const { screen } = await renderTicket("/tickets/SNTL-12#cve");
    window.dispatchEvent(new WheelEvent("wheel"));
    window.scrollTo(0, 10);

    duplicates.resolve(ticketPage([]));

    await expect
      .poll(() => valueOf(screen, "Duplicates").textContent)
      .toBe("None");
    await partsShown(screen);
    expect(window.scrollY).toBe(10);
  });
});
