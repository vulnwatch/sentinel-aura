import { focusManager } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import { commands, page, userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import type {
  CVESourceStatusItem,
  CurrentUserResponse,
} from "../../api/generated/model";
import { formatDateTime } from "../../components/date-time";
import {
  errorResponse,
  FICTIONAL_USER,
  fictionalPackage,
  fictionalSource,
  fictionalTicketDetail,
  jsonResponse,
  OTHER_USER,
  refetchResponse,
  requestsTo,
  sourcesResponse,
  ticketResponse,
  urlOf,
} from "../../test-api";
import { screenshot } from "../../test-screenshot";
import {
  ACCESS,
  ACTORS,
  animationsIn,
  backgroundBehind,
  BORDER,
  boxOf,
  client,
  CVSS,
  cvssPart,
  FG_MUTED,
  later,
  MAINTAINER,
  MESSAGE_TONES,
  nextFrames,
  packagesPart,
  prepareEachTest,
  press,
  REFERENCE,
  REFETCH,
  renderApp,
  renderTree,
  returnToForeground,
  type Screen,
  showing,
  SOURCES,
  sourcesPart,
  stubTicket,
  TICKET,
  TICKETS,
  YOUR_WORK,
} from "./test-support";

// The sources of the CVE of Overview, the first tab of the Ticket screen
// (src/routes/ticket-overview/sources.tsx; docs/screens/ticket.md), at the
// browser's default text size, in the light theme.

prepareEachTest();

// The dates and times of the sources of the tests.
const ATTEMPTED = "2099-10-08T08:00:00Z";
const LATER_ATTEMPT = "2099-10-09T09:30:00Z";
const FAILING_SINCE = "2099-10-06T06:00:00Z";
const KEV_UPDATED = "2099-10-07T04:00:00Z";

// An administrator who operates the fetchers, without triage_ticket.
const FETCHER_ADMIN: CurrentUserResponse = {
  data: {
    ...OTHER_USER.data,
    roles: ["admin"],
    capabilities: ["manage_fetchers"],
    assignment_eligibility: "none",
  },
};

// Waits until no read of the sources is in progress, so that a read at
// intervals is not merged into it. expect.poll moves a fake clock by its
// interval after each failed attempt; an interval of 0 leaves the clock where
// the test set it, so that the next read at intervals comes when the test
// counts it.
async function sourcesSettled() {
  await expect
    .poll(() => client.isFetching({ queryKey: [SOURCES] }), { interval: 0 })
    .toBe(0);
}

// Renders the screen of SNTL-12 and waits until its sources show the text.
async function renderSources(text = "NVD", path = "/tickets/SNTL-12") {
  const rendered = await renderApp(path);
  await expect
    .element(
      sourcesPart(rendered.screen).getByText(text, { exact: true }).first(),
    )
    .toBeVisible();
  return rendered;
}

// The list item of a source, by its name.
function sourceOf(screen: Screen, name: string): Locator {
  return sourcesPart(screen)
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// Whether the user sees the element: neither it nor an element that holds it
// is transparent.
function seen(locator: Locator): boolean {
  return locator.element().checkVisibility({ opacityProperty: true });
}

// The element that a press reaches at the center of the mark of a source, in
// the middle of the place of 24 px at the start of its line.
function atMarkOf(screen: Screen, name: string): Element | null {
  const item = boxOf(sourceOf(screen, name));
  return document.elementFromPoint(item.left + 12, item.top + 12);
}

// The texts of an element, apart by a space.
function wordsOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const texts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    texts.push(node.textContent ?? "");
  }
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

// The line of each source, in the order of the page.
function sourceLines(screen: Screen): string[] {
  return sourcesPart(screen).getByRole("listitem").elements().map(wordsOf);
}

// What the status regions of the sources say, other than nothing.
function statusesOf(screen: Screen): string[] {
  return sourcesPart(screen)
    .getByRole("status")
    .elements()
    .map((region) => region.textContent ?? "")
    .filter((text) => text !== "");
}

function refetchOf(screen: Screen, name: string) {
  return sourcesPart(screen).getByRole("button", {
    name: `Refetch ${name}`,
    exact: true,
  });
}

function refetchAll(screen: Screen) {
  return sourcesPart(screen).getByRole("button", {
    name: "Refetch all",
    exact: true,
  });
}

// The pending fetch of MITRE and of NVD, and CISA KEV, which cannot be
// refetched.
function pendingSources(): CVESourceStatusItem[] {
  return [
    fictionalSource({
      source: "kev",
      status: "missing",
      refetchable: false,
    }),
    fictionalSource({
      source: "mitre",
      status: "pending",
      first_failed_at: FAILING_SINCE,
    }),
    fictionalSource({ status: "pending", fetched_at: null }),
  ];
}

describe("the sources of the CVE", () => {
  test("follow the details in the side column, 288 px wide, under a level-two heading, after a border line", async () => {
    stubTicket();
    const { screen } = await renderSources();
    const details = screen.getByRole("region", { name: "Details" });
    const part = sourcesPart(screen);

    await expect
      .element(
        part.getByRole("heading", { level: 2, name: "Sources of the CVE" }),
      )
      .toBeVisible();
    expect(boxOf(part).width).toBe(288);
    expect(boxOf(part).left).toBe(boxOf(details).left);
    expect(boxOf(part).top).toBeCloseTo(boxOf(details).bottom, 1);
    // 16 px below the content of the details, a border line, and the section
    // 16 px below it.
    const above = getComputedStyle(details.element());
    expect([
      above.paddingBottom,
      above.borderBottomWidth,
      above.borderBottomColor,
    ]).toEqual(["16px", "1px", BORDER]);
    expect(getComputedStyle(part.element()).paddingTop).toBe("16px");
    expect(
      details.element().compareDocumentPosition(part.element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("follow the package tree in one column, last in the order of the page, after a border line 32 px below it", async () => {
    await page.viewport(900, 800);
    stubTicket();
    const { screen } = await renderSources();
    const packages = packagesPart(screen);
    await expect
      .element(cvssPart(screen).getByRole("grid", { name: "CVSS assessments" }))
      .toBeVisible();
    const part = sourcesPart(screen);

    expect(
      packages.element().compareDocumentPosition(part.element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(boxOf(part).width).toBe(boxOf(packages).width);
    // 32 px below the content of the package tree, a border line, and the
    // section 16 px below it.
    expect(boxOf(part).top - boxOf(packages).bottom).toBeCloseTo(
      32 + 1 + 16,
      1,
    );
  });

  test("stay in their place, with the focus and a refetch in progress, when the layout changes", async () => {
    const response = later();
    stubTicket({ refetch: () => response.promise });
    const { screen } = await renderSources();
    const refetch = refetchOf(screen, "NVD");
    await press(refetch);
    await expect.element(refetch).toHaveAttribute("aria-disabled", "true");

    await page.viewport(900, 800);

    await expect
      .poll(
        () =>
          boxOf(sourcesPart(screen)).top > boxOf(packagesPart(screen)).bottom,
      )
      .toBe(true);
    await expect.element(refetch).toHaveFocus();
    expect(refetch.element().getAttribute("aria-disabled")).toBe("true");

    response.resolve(refetchResponse({ sources_enqueued: ["nvd"] }));

    await expect.element(refetch).not.toHaveAttribute("aria-disabled");
  });

  test("show each source in the order of the API: its name, its status, its labels, and the dates of its last attempt and of the start of its failure streak", async () => {
    stubTicket({
      sources: () =>
        sourcesResponse([
          fictionalSource({ source: "bugzilla" }),
          fictionalSource({
            source: "epss",
            status: "not_attempted",
            fetched_at: null,
            enabled: false,
          }),
          fictionalSource({
            source: "ghsa",
            status: "pending",
            fetched_at: null,
          }),
          fictionalSource({
            source: "kernel",
            status: "missing",
          }),
          fictionalSource({
            source: "kev",
            status: "success",
            fetched_at: KEV_UPDATED,
            refetchable: false,
          }),
          fictionalSource({
            source: "mitre",
            status: "failure",
            first_failed_at: FAILING_SINCE,
          }),
          // A retry in flight keeps the dates of the last attempt and of the
          // failure streak.
          fictionalSource({
            status: "pending",
            first_failed_at: FAILING_SINCE,
          }),
          fictionalSource({ source: "osv", enabled: false }),
          fictionalSource({
            source: "redhat",
            status: "missing",
            registered: false,
            refetchable: false,
            enabled: false,
          }),
        ]),
    });
    const { screen } = await renderSources();
    const attempted = formatDateTime(ATTEMPTED);
    const since = formatDateTime(FAILING_SINCE);

    // The name of each status follows the name of its source for assistive
    // technologies; an absent date reads "Not set" (docs/behaviors.md,
    // Absent Values).
    expect(sourceLines(screen)).toEqual([
      `SUSE Bugzilla Success Last attempt ${attempted}`,
      "EPSS Not attempted Disabled Last attempt – Not set",
      "GHSA Pending Last attempt – Not set",
      `Linux Kernel CNA Missing Last attempt ${attempted}`,
      `CISA KEV Success Updated ${formatDateTime(KEV_UPDATED)}`,
      `MITRE Failure Last attempt ${attempted} Failing since ${since}`,
      `NVD Pending Last attempt ${attempted} Failing since ${since}`,
      `OSV Success Disabled Last attempt ${attempted}`,
      `Red Hat Missing Retired Last attempt ${attempted}`,
    ]);
    expect(sourcesPart(screen).getByRole("list").elements()).toHaveLength(1);
    // The name of the source at weight 500, the dates in text-13 and
    // fg-muted.
    const mitre = sourceOf(screen, "MITRE");
    expect(
      getComputedStyle(mitre.getByText("MITRE", { exact: true }).element())
        .fontWeight,
    ).toBe("500");
    const failing = mitre.getByText(/^Failing since/).element();
    expect([
      getComputedStyle(failing).fontSize,
      getComputedStyle(failing).color,
    ]).toEqual(["13px", FG_MUTED]);
    // The mark alone in a place of 24 px, the name 8 px after it, and the
    // name of the status only for assistive technologies.
    const osv = sourceOf(screen, "OSV");
    const item = boxOf(osv);
    const name = boxOf(osv.getByText("OSV", { exact: true }));
    expect(name.left - item.left).toBe(24 + 8);
    expect(boxOf(osv.getByText("Success")).width).toBeLessThanOrEqual(1);
    // The label at the end of the first line, centered on it
    // (docs/design-system.md, Labels).
    const label = boxOf(osv.getByText("Disabled", { exact: true }));
    expect(label.right).toBeCloseTo(item.right, 1);
    expect((label.top + label.bottom) / 2).toBeCloseTo(item.top + 12, 0);
    // The dates below the name, across the width of the line, the place of
    // the label included.
    const date = boxOf(osv.getByText(/^Last attempt/));
    expect(date.left).toBe(name.left);
    expect(date.right).toBeCloseTo(item.right, 1);
    expect(date.top).toBeGreaterThanOrEqual(label.bottom);
  });

  test("mark each status in the color of its tone, never by the color alone, the pending fetch turning and standing still under reduced motion", async () => {
    stubTicket({
      sources: () =>
        sourcesResponse([
          fictionalSource({
            source: "epss",
            status: "not_attempted",
            fetched_at: null,
          }),
          fictionalSource({
            source: "ghsa",
            status: "pending",
            fetched_at: null,
          }),
          fictionalSource({ source: "kernel", status: "missing" }),
          fictionalSource({
            source: "mitre",
            status: "failure",
            first_failed_at: FAILING_SINCE,
          }),
          fictionalSource(),
        ]),
    });
    const { screen } = await renderSources();
    // The color at the center of the mark of a status, in the middle of its
    // place of 24 px at the start of the line; the shapes and sizes of the
    // marks are those of src/components/marked-value.test.tsx.
    const markAt = async (name: string) => {
      const picture = await screenshot(sourceOf(screen, name));
      return picture.at(12, 12);
    };

    expect(await markAt("NVD")).toBe("#1a7f37");
    expect(await markAt("MITRE")).toBe("#cf222e");
    // Failure differs from Success also by the start of its failure streak.
    expect(sourceLines(screen)[3]).toMatch(/Failing since/);
    expect(sourceLines(screen)[4]).not.toMatch(/Failing since/);
    // The circle of Missing and the dashed circle of Not attempted are
    // hollow, unlike a dot.
    expect(await markAt("Linux Kernel CNA")).toBe("#f6f8fa");
    expect(await markAt("EPSS")).toBe("#f6f8fa");
    expect(animationsIn(sourceOf(screen, "EPSS").element())).toEqual([]);
    expect(animationsIn(sourceOf(screen, "GHSA").element())).toEqual(["spin"]);

    await commands.emulateReducedMotion(true);

    expect(animationsIn(sourceOf(screen, "GHSA").element())).toEqual([]);
  });

  test("show a source and a status that the pinned contract does not list as received", async () => {
    stubTicket({
      sources: () =>
        jsonResponse(200, {
          data: [
            fictionalSource({
              source: "fictional_source",
              registered: false,
              refetchable: false,
              enabled: false,
            }),
            { ...fictionalSource(), status: "fictional_status" },
          ],
        }),
    });
    const { screen } = await renderSources("fictional_source");
    const attempted = formatDateTime(ATTEMPTED);

    expect(sourceLines(screen)).toEqual([
      `fictional_source Success Retired Last attempt ${attempted}`,
      `NVD fictional_status Last attempt ${attempted}`,
    ]);
    // The status as received only for assistive technologies, after the
    // mark of an unknown value (docs/behaviors.md, Unknown Values), and no
    // Refetch of a source whose status the screen cannot tell.
    expect(
      boxOf(sourceOf(screen, "NVD").getByText("fictional_status")).width,
    ).toBeLessThanOrEqual(1);
    expect(refetchOf(screen, "NVD").query()).toBeNull();
    await expect.element(refetchAll(screen)).toBeVisible();
  });

  test("say No sources. without any, without Refetch all", async () => {
    stubTicket({ sources: () => sourcesResponse([]) });
    const { screen } = await renderSources("No sources.");

    expect(refetchAll(screen).query()).toBeNull();
    expect(sourcesPart(screen).getByRole("list").query()).toBeNull();
  });

  test("are neither read nor shown for a Ticket without a CVE", async () => {
    const spy = showing([fictionalPackage()], { cve: null });
    const { screen } = await renderTree();

    await expect
      .element(screen.getByRole("region", { name: "Details" }))
      .toBeVisible();
    expect(sourcesPart(screen).query()).toBeNull();
    expect(
      spy.mock.calls
        .map(([input]) => urlOf(input).pathname)
        .filter((path) => path.startsWith("/api/v1/cves/")),
    ).toEqual([]);
  });

  test("show the loading indicator in their place until their read arrives, and the failure of their read in their place, with Try again", async () => {
    const first = later();
    let read = 0;
    let fails = true;
    const spy = stubTicket({
      sources: () => {
        read += 1;
        if (read === 1) {
          return first.promise;
        }
        return fails ? errorResponse(500, "INTERNAL_ERROR") : sourcesResponse();
      },
    });
    const { screen } = await renderTree();

    await expect
      .element(
        sourcesPart(screen).getByRole("progressbar", { name: "Loading" }),
      )
      .toBeVisible();

    first.resolve(errorResponse(500, "INTERNAL_ERROR"));

    await expect
      .element(
        sourcesPart(screen).getByText(
          "Something went wrong in Sentinel. Try again, and if it happens again, report it with the reference below.",
        ),
      )
      .toBeVisible();
    expect(requestsTo(spy, SOURCES)).toBe(3);
    expect(refetchAll(screen).query()).toBeNull();
    await expect
      .element(screen.getByRole("region", { name: "Details" }))
      .toBeVisible();

    fails = false;
    await sourcesPart(screen)
      .getByRole("button", { name: "Try again" })
      .click();

    await expect.element(sourceOf(screen, "NVD")).toBeVisible();
  });

  test("remove the sources and Refetch all when a new read of them is refused with a 404, the focus on Refetch all moving to the screen's heading", async () => {
    let refused = false;
    stubTicket({
      sources: () =>
        refused ? errorResponse(404, "CVE_NOT_FOUND") : sourcesResponse(),
    });
    const { screen } = await renderSources();
    refetchAll(screen).element().focus();
    await expect.element(refetchAll(screen)).toHaveFocus();
    refused = true;

    await returnToForeground();

    await expect
      .element(
        sourcesPart(screen).getByText(
          "This no longer exists, or you no longer have access to it.",
        ),
      )
      .toBeVisible();
    expect(refetchAll(screen).query()).toBeNull();
    expect(sourcesPart(screen).getByRole("listitem").query()).toBeNull();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toHaveFocus();
  });

  test("offer Refetch of each source that can be refetched and is not pending, named after it, and Refetch all, to a user with triage_ticket", async () => {
    stubTicket({
      sources: () =>
        sourcesResponse([
          fictionalSource({ source: "epss", enabled: false }),
          fictionalSource({
            source: "kev",
            status: "missing",
            refetchable: false,
          }),
          fictionalSource({
            source: "legacy_source",
            registered: false,
            refetchable: false,
            enabled: false,
          }),
          fictionalSource({ source: "mitre", status: "pending" }),
          fictionalSource(),
        ]),
    });
    const { screen } = await renderSources();

    expect(
      sourcesPart(screen)
        .getByRole("button", { name: /^Refetch/ })
        .elements()
        .map(
          (button) => button.getAttribute("aria-label") ?? button.textContent,
        ),
    ).toEqual(["Refetch all", "Refetch NVD"]);
    // A target of 24 px in the place of the mark, at the start of the line
    // of its source, and Refetch all a quiet button 32 px high at the end of
    // the heading.
    const refetch = boxOf(refetchOf(screen, "NVD"));
    const item = boxOf(sourceOf(screen, "NVD"));
    expect([refetch.width, refetch.height]).toEqual([24, 24]);
    expect([refetch.left, refetch.top]).toEqual([item.left, item.top]);
    const all = refetchAll(screen).element();
    expect(boxOf(refetchAll(screen)).height).toBe(32);
    expect([
      getComputedStyle(all).borderTopWidth,
      getComputedStyle(all).backgroundColor,
    ]).toEqual(["0px", "rgba(0, 0, 0, 0)"]);
    expect(boxOf(refetchAll(screen)).right).toBeCloseTo(
      boxOf(sourcesPart(screen)).right,
      1,
    );
    expect(boxOf(refetchAll(screen)).bottom).toBeLessThanOrEqual(
      boxOf(sourceOf(screen, "EPSS")).top,
    );
  });

  test.each<[string, CurrentUserResponse]>([
    ["a reader", FICTIONAL_USER],
    ["a user without triage_ticket", FETCHER_ADMIN],
  ])("offer no Refetch to %s", async (_, user) => {
    stubTicket({ user });
    const { screen } = await renderSources();

    expect(sourcesPart(screen).getByRole("button").query()).toBeNull();
  });

  test("offer no Refetch all when no source can be refetched", async () => {
    stubTicket({
      sources: () =>
        sourcesResponse([
          fictionalSource({ source: "mitre", enabled: false }),
          fictionalSource({ enabled: false }),
        ]),
    });
    const { screen } = await renderSources();

    expect(sourcesPart(screen).getByRole("button").query()).toBeNull();
  });

  test("show Refetch of a source in place of its mark while the pointer is over the line of the source, and let the pointer reach it only then", async () => {
    stubTicket();
    const { screen } = await renderSources();
    const refetch = refetchOf(screen, "NVD");
    await screen.getByRole("heading", { level: 2, name: "Details" }).hover();

    // Transparent, and a press at its place, such as a tap, does not reach
    // it, while it stays for the keyboard and assistive technologies.
    expect(seen(refetch)).toBe(false);
    expect(refetch.element().contains(atMarkOf(screen, "NVD"))).toBe(false);

    await sourceOf(screen, "NVD")
      .getByText(/^Last attempt/)
      .hover();

    await expect.poll(() => seen(refetch)).toBe(true);
    expect(refetch.element().contains(atMarkOf(screen, "NVD"))).toBe(true);
    // The other sources keep their marks.
    expect(seen(refetchOf(screen, "MITRE"))).toBe(false);
  });

  test("bring the mark back in place of Refetch of a source with Escape while the pointer stays over the line, until the pointer leaves it, except while Refetch has the focus", async () => {
    stubTicket();
    const { screen } = await renderSources();
    const refetch = refetchOf(screen, "NVD");
    const line = sourceOf(screen, "NVD").getByText(/^Last attempt/);
    await line.hover();
    await expect.poll(() => seen(refetch)).toBe(true);

    await userEvent.keyboard("{Escape}");

    await expect.poll(() => seen(refetch)).toBe(false);
    expect(refetch.element().contains(atMarkOf(screen, "NVD"))).toBe(false);
    // The focus shows it again, and the pointer reaches it, still over the
    // line.
    refetch.element().focus({ focusVisible: true });
    await expect.element(refetch).toHaveFocus();
    expect(seen(refetch)).toBe(true);
    expect(refetch.element().contains(atMarkOf(screen, "NVD"))).toBe(true);
    refetch.element().blur();

    await screen.getByRole("heading", { level: 2, name: "Details" }).hover();
    await line.hover();

    await expect.poll(() => seen(refetch)).toBe(true);
    expect(refetch.element().contains(atMarkOf(screen, "NVD"))).toBe(true);
  });

  test("show Refetch of a source in place of its mark while it has the focus", async () => {
    stubTicket();
    const { screen } = await renderSources();
    const refetch = refetchOf(screen, "NVD");
    // Away from the line, where the pointer of an earlier test can stay.
    await screen.getByRole("heading", { level: 2, name: "Details" }).hover();
    expect((await screenshot(sourceOf(screen, "NVD"))).at(12, 12)).toBe(
      "#1a7f37",
    );

    refetch.element().focus({ focusVisible: true });

    await expect.element(refetch).toHaveFocus();
    expect(seen(refetch)).toBe(true);
    // The dot gives way to refresh-cw, whose center shows the page.
    expect((await screenshot(sourceOf(screen, "NVD"))).at(12, 12)).toBe(
      "#f6f8fa",
    );
  });

  test("keep Refetch of a source shown while it is busy, and leave the focus where it was after a press of the pointer, when the read after it shows the source Pending", async () => {
    const response = later();
    let sources = [fictionalSource({ source: "mitre" }), fictionalSource()];
    stubTicket({
      refetch: () => response.promise,
      sources: () => sourcesResponse(sources),
    });
    const { screen } = await renderSources();
    const refetch = refetchOf(screen, "NVD");
    await sourceOf(screen, "NVD")
      .getByText(/^Last attempt/)
      .hover();

    await refetch.click();

    await expect.element(refetch).toHaveAttribute("aria-disabled", "true");
    expect(refetch.element()).not.toBe(document.activeElement);
    await screen.getByRole("heading", { level: 2, name: "Details" }).hover();
    expect(seen(refetch)).toBe(true);
    expect(seen(refetchOf(screen, "MITRE"))).toBe(false);
    // The dot gives way to the spinner, whose center shows the page.
    expect((await screenshot(sourceOf(screen, "NVD"))).at(12, 12)).toBe(
      "#f6f8fa",
    );

    sources = [
      fictionalSource({ source: "mitre" }),
      fictionalSource({ status: "pending" }),
    ];
    response.resolve(refetchResponse({ sources_enqueued: ["nvd"] }));

    await expect
      .element(screen.getByText("Refetch of NVD started."))
      .toBeVisible();
    await expect.poll(() => refetch.query()).toBeNull();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .not.toHaveFocus();
  });

  test("move the focus to the screen's heading when the read after a refetch from the keyboard shows its source Pending", async () => {
    let sources = [fictionalSource()];
    stubTicket({
      refetch: () => {
        sources = [fictionalSource({ status: "pending" })];
        return refetchResponse({ sources_enqueued: ["nvd"] });
      },
      sources: () => sourcesResponse(sources),
    });
    const { screen } = await renderSources();

    await press(refetchOf(screen, "NVD"));

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toHaveFocus();
    expect(refetchOf(screen, "NVD").query()).toBeNull();
  });

  test("refetch a source with Re-fetch CVE Data, busy until Sentinel answers, then say that it started and read the sources again", async () => {
    const response = later();
    const spy = stubTicket({ refetch: () => response.promise });
    const { screen } = await renderSources();
    const refetch = refetchOf(screen, "NVD");

    await press(refetch);

    await expect.element(refetch).toHaveAttribute("aria-disabled", "true");
    expect(animationsIn(refetch.element())).toEqual(["spin"]);
    const requests = spy.mock.calls
      .map(([input, init]) => [init?.method, urlOf(input)] as const)
      .filter(([, url]) => url.pathname === REFETCH);
    expect(requests.map(([method, url]) => [method, url.search])).toEqual([
      ["POST", "?source=nvd"],
    ]);
    // Pressing it again while it is busy sends nothing.
    await userEvent.keyboard("{Enter}");
    expect(requestsTo(spy, REFETCH)).toBe(1);
    // Only the button that started the refetch is busy.
    expect(refetchAll(screen).element().getAttribute("aria-disabled")).toBe(
      null,
    );
    const sourcesRead = requestsTo(spy, SOURCES);
    const ticketRead = requestsTo(spy, TICKET);

    response.resolve(refetchResponse({ sources_enqueued: ["nvd"] }));

    const message = screen.getByText("Refetch of NVD started.");
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.info);
    await expect.element(refetch).not.toHaveAttribute("aria-disabled");
    await expect.element(refetch).toHaveFocus();
    await expect
      .poll(() => requestsTo(spy, SOURCES))
      .toBeGreaterThan(sourcesRead);
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(ticketRead + 1);
  });

  test("refetch every source with Refetch all, busy until Sentinel answers", async () => {
    const response = later();
    stubTicket({ refetch: () => response.promise });
    const { screen } = await renderSources();
    // CISA KEV, Missing here, shows when its last attempt was, as in every
    // status but Success, whose date is the last change of its evidence.
    expect(sourceLines(screen)[0]).toBe(
      `CISA KEV Missing Last attempt ${formatDateTime("2099-10-08T04:00:00Z")}`,
    );

    await press(refetchAll(screen));

    await expect
      .element(refetchAll(screen))
      .toHaveAttribute("aria-disabled", "true");
    expect(animationsIn(refetchAll(screen).element())).toEqual(["spin"]);
    expect(
      refetchOf(screen, "NVD").element().getAttribute("aria-disabled"),
    ).toBe(null);

    response.resolve(refetchResponse({ sources_enqueued: ["mitre", "nvd"] }));

    await expect
      .element(screen.getByText("Refetch started.", { exact: true }))
      .toBeVisible();
    await expect
      .element(refetchAll(screen))
      .not.toHaveAttribute("aria-disabled");
  });

  test.each<[string, string, Parameters<typeof refetchResponse>[0], string]>([
    [
      "NVD",
      "?source=nvd",
      { sources_already_pending: ["nvd"] },
      "Refetch of NVD was already in progress.",
    ],
    [
      "all",
      "",
      { sources_enqueued: ["mitre", "nvd"], sources_disabled: ["osv"] },
      "Refetch started. OSV is disabled and was skipped.",
    ],
    [
      "all",
      "",
      {
        sources_enqueued: ["nvd"],
        sources_already_pending: ["mitre"],
        sources_disabled: ["ghsa", "fictional_source"],
      },
      "Refetch started. GHSA and fictional_source are disabled and were skipped.",
    ],
    [
      "all",
      "",
      { sources_already_pending: ["mitre", "nvd"] },
      "Refetch was already in progress.",
    ],
  ])(
    "say what a refetch of %s (%s) started: %j",
    async (name, search, result, text) => {
      const spy = stubTicket({ refetch: () => refetchResponse(result) });
      const { screen } = await renderSources();

      await press(
        name === "all" ? refetchAll(screen) : refetchOf(screen, name),
      );

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.info);
      const [input] = spy.mock.calls.find(
        ([request]) => urlOf(request).pathname === REFETCH,
      )!;
      expect(urlOf(input).search).toBe(search);
    },
  );

  test.each<[Parameters<typeof refetchResponse>[0], string]>([
    [
      {
        sources_enqueued: ["nvd"],
        sources_disabled: ["osv"],
        sources_failed: ["mitre"],
      },
      "Refetch started. OSV is disabled and was skipped. Sentinel didn't confirm the refetch of MITRE: it may still start.",
    ],
    [
      { sources_already_pending: ["nvd"], sources_failed: ["mitre", "redhat"] },
      "Refetch was already in progress. Sentinel didn't confirm the refetch of MITRE and Red Hat: they may still start.",
    ],
  ])(
    "warn of the sources whose refetch Sentinel did not confirm: %j",
    async (result, text) => {
      stubTicket({ refetch: () => refetchResponse(result) });
      const { screen } = await renderSources();

      await press(refetchAll(screen));

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.warning);
    },
  );

  test.each<
    [
      string,
      () => Response | Promise<Response>,
      string,
      keyof typeof MESSAGE_TONES,
      boolean,
    ]
  >([
    [
      "503 CVE_FETCH_FAILED",
      () => errorResponse(503, "CVE_FETCH_FAILED"),
      "No enabled source can refetch this CVE.",
      "danger",
      true,
    ],
    [
      "503 CELERY_UNAVAILABLE",
      () => errorResponse(503, "CELERY_UNAVAILABLE"),
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      "warning",
      true,
    ],
    [
      "a network failure",
      () => Promise.reject(new TypeError("Failed to fetch")),
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      "warning",
      false,
    ],
    [
      "409 FETCHER_DISABLED",
      () => errorResponse(409, "FETCHER_DISABLED"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
      false,
    ],
    [
      "404 CVE_NOT_FOUND",
      () => errorResponse(404, "CVE_NOT_FOUND"),
      "This no longer exists, or you no longer have access to it.",
      "danger",
      false,
    ],
    [
      "422 CVE_INVALID_SOURCE",
      () => errorResponse(422, "CVE_INVALID_SOURCE"),
      "Sentinel didn't accept this request.",
      "danger",
      false,
    ],
    [
      "a status and a code that the pinned contract does not list",
      () => errorResponse(418, "FICTIONAL_CODE"),
      "Sentinel didn't accept this request.",
      "danger",
      false,
    ],
  ])(
    "show the failure of a refetch, %s, in the message area, and read the sources again",
    async (_, respond, text, tone, reference) => {
      const spy = stubTicket({ refetch: respond });
      const { screen } = await renderSources();
      const sourcesRead = requestsTo(spy, SOURCES);

      await press(refetchOf(screen, "NVD"));

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES[tone]);
      expect(screen.getByText(REFERENCE).query() !== null).toBe(reference);
      await expect
        .poll(() => requestsTo(spy, SOURCES))
        .toBeGreaterThan(sourcesRead);
      // A change is never sent again by itself (docs/behaviors.md, Retries
      // and Unconfirmed Changes).
      expect(requestsTo(spy, REFETCH)).toBe(1);
    },
  );

  test("end the session after a 401 of a refetch, without a failure of the UI", async () => {
    stubTicket({ refetch: () => errorResponse(401, "AUTH_NOT_AUTHENTICATED") });
    const { screen } = await renderSources();

    await press(refetchOf(screen, "NVD"));

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
  });

  test("leave an answer of a refetch that the UI cannot show to the page of a failure of the UI", async () => {
    // The answer of a later release that lacks the lists, which the
    // message cannot name.
    stubTicket({ refetch: () => jsonResponse(202, { data: {} }) });
    const { screen } = await renderSources();

    await press(refetchOf(screen, "NVD"));

    await expect
      .element(
        screen.getByRole("heading", {
          level: 1,
          name: "Something went wrong",
        }),
      )
      .toBeVisible();
  });

  test("name the Ticket with a link in the message of a refetch that ends after the user left its screen", async () => {
    const response = later();
    stubTicket({ refetch: () => response.promise });
    const { router, screen } = await renderSources();
    await press(refetchOf(screen, "NVD"));
    await router.navigate({ to: "/tickets" });
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();

    response.resolve(refetchResponse({ sources_enqueued: ["nvd"] }));

    await expect
      .element(screen.getByText("SNTL-12: Refetch of NVD started."))
      .toBeVisible();
    const link = screen.getByRole("link", { name: "SNTL-12", exact: true });
    await expect.element(link).toHaveAttribute("href", "/tickets/SNTL-12");

    await link.click();

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toBeVisible();
  });

  test("name the Ticket in the message of a failed refetch that ends after the user left its screen", async () => {
    const response = later();
    stubTicket({ refetch: () => response.promise });
    const { router, screen } = await renderSources();
    await press(refetchOf(screen, "NVD"));
    await router.navigate({ to: "/tickets" });
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();

    response.resolve(errorResponse(409, "FETCHER_DISABLED"));

    await expect
      .element(
        screen.getByText(
          "SNTL-12: This can't be done in the current state, which may have changed. Check it and try again.",
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
      .toHaveAttribute("href", "/tickets/SNTL-12");
  });

  test("are read again every 5 seconds while a fetch is pending, not while the tab is hidden, and no longer once none is", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let sources = pendingSources();
    const spy = stubTicket({ sources: () => sourcesResponse(sources) });
    await renderSources();
    expect(requestsTo(spy, SOURCES)).toBe(1);

    // The wait for the screen moves the clock by as long as it takes, so the
    // test moves it on to the first read at intervals, and counts from there.
    vi.advanceTimersToNextTimer();
    await sourcesSettled();
    expect(requestsTo(spy, SOURCES)).toBe(2);

    vi.advanceTimersByTime(4_999);
    expect(requestsTo(spy, SOURCES)).toBe(2);
    vi.advanceTimersByTime(1);
    await sourcesSettled();
    expect(requestsTo(spy, SOURCES)).toBe(3);

    // While the tab is hidden, no read at intervals is sent.
    focusManager.setFocused(false);
    vi.advanceTimersByTime(15_000);
    expect(requestsTo(spy, SOURCES)).toBe(3);
    // The tab returns to the foreground, where the sources are read again.
    focusManager.setFocused(true);
    await expect.poll(() => requestsTo(spy, SOURCES)).toBe(4);
    await sourcesSettled();

    sources = pendingSources().map((source) =>
      source.status === "pending"
        ? { ...source, status: "success", fetched_at: LATER_ATTEMPT }
        : source,
    );
    vi.advanceTimersByTime(5_000);
    await expect.poll(() => requestsTo(spy, SOURCES)).toBe(5);
    await sourcesSettled();

    vi.advanceTimersByTime(30_000);
    expect(requestsTo(spy, SOURCES)).toBe(5);
  });

  test("stop the reads at intervals after one fails, keeping the sources shown with a warning, until a read of them succeeds", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let fails = false;
    const spy = stubTicket({
      sources: () =>
        fails
          ? errorResponse(503, "SERVICE_UNAVAILABLE")
          : sourcesResponse(pendingSources()),
    });
    const { screen } = await renderSources();
    fails = true;

    vi.advanceTimersByTime(5_000);

    const warning = sourcesPart(screen).getByText(
      "This couldn't be updated. Sentinel isn't available right now. Try again later.",
    );
    await expect.element(warning).toBeVisible();
    // The read and its two retries (docs/behaviors.md, Retries and
    // Unconfirmed Changes).
    expect(requestsTo(spy, SOURCES)).toBe(4);
    await expect.element(sourceOf(screen, "NVD")).toBeVisible();
    vi.advanceTimersByTime(30_000);
    expect(requestsTo(spy, SOURCES)).toBe(4);

    fails = false;
    await sourcesPart(screen)
      .getByRole("button", { name: "Try again" })
      .click();
    await expect.element(warning).not.toBeInTheDocument();
    expect(requestsTo(spy, SOURCES)).toBe(5);
    await sourcesSettled();

    vi.advanceTimersByTime(5_000);
    await expect.poll(() => requestsTo(spy, SOURCES)).toBe(6);
  });

  test("announce what a read shows of the fetches that ended, in one announcement in the order of the sources, and read the data of the tab again", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let sources = pendingSources();
    const spy = stubTicket({ sources: () => sourcesResponse(sources) });
    const { screen } = await renderSources();
    await expect
      .element(cvssPart(screen).getByRole("grid", { name: "CVSS assessments" }))
      .toBeVisible();
    const ticketRead = requestsTo(spy, TICKET);
    const duplicatesRead = requestsTo(spy, TICKETS);
    const cvssRead = requestsTo(spy, CVSS);
    sources = [
      sources[0]!,
      { ...sources[1]!, status: "failure", fetched_at: LATER_ATTEMPT },
      { ...sources[2]!, status: "success", fetched_at: LATER_ATTEMPT },
    ];

    vi.advanceTimersByTime(5_000);

    await expect
      .poll(() => statusesOf(screen))
      .toEqual(["MITRE: Failure. NVD: Success."]);
    // The text in its place, without a message.
    expect(sourceLines(screen)[1]).toBe(
      `MITRE Failure Last attempt ${formatDateTime(LATER_ATTEMPT)} Failing since ${formatDateTime(FAILING_SINCE)}`,
    );
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(ticketRead + 1);
    await expect.poll(() => requestsTo(spy, TICKETS)).toBe(duplicatesRead + 1);
    await expect.poll(() => requestsTo(spy, CVSS)).toBe(cvssRead + 1);
    // The sources themselves are not read again, nor at intervals.
    vi.advanceTimersByTime(30_000);
    expect(requestsTo(spy, SOURCES)).toBe(2);
  });

  test("read again the work of a maintainer when a fetch ends", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let sources = [fictionalSource({ status: "pending" })];
    const spy = showing(
      [fictionalPackage()],
      {},
      { user: MAINTAINER, sources: () => sourcesResponse(sources) },
    );
    await renderSources("Pending");
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
    sources = [fictionalSource({ fetched_at: LATER_ATTEMPT })];

    vi.advanceTimersByTime(5_000);

    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(2);
  });

  test("read again the users who acted on the Ticket and its access grants when a fetch ends", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let sources = [fictionalSource({ status: "pending" })];
    const spy = stubTicket({
      ticket: () =>
        ticketResponse(fictionalTicketDetail({ is_confidential: true })),
      sources: () => sourcesResponse(sources),
    });
    await renderSources("Pending");
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(1);
    await expect.poll(() => requestsTo(spy, ACCESS)).toBe(1);
    sources = [fictionalSource({ fetched_at: LATER_ATTEMPT })];

    vi.advanceTimersByTime(5_000);

    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(2);
    await expect.poll(() => requestsTo(spy, ACCESS)).toBe(2);
  });

  test("announce each end in a node of its own, so that the same words are announced again", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const pending = [fictionalSource({ status: "pending" })];
    const ended = [fictionalSource({ fetched_at: LATER_ATTEMPT })];
    let sources = pending;
    stubTicket({ sources: () => sourcesResponse(sources) });
    const { screen } = await renderSources();
    sources = ended;
    vi.advanceTimersByTime(5_000);
    await expect.poll(() => statusesOf(screen)).toEqual(["NVD: Success."]);
    const first = sourcesPart(screen).getByText("NVD: Success.").element();

    // Another fetch, which ends in the same way.
    sources = pending;
    await returnToForeground();
    await expect
      .element(sourceOf(screen, "NVD").getByText("Pending"))
      .toBeVisible();
    await sourcesSettled();
    sources = ended;
    vi.advanceTimersByTime(5_000);

    await expect
      .poll(() => sourcesPart(screen).getByText("NVD: Success.").element())
      .not.toBe(first);
  });

  test("announce a status that the pinned contract does not list as received", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let sources: object[] = [fictionalSource({ status: "pending" })];
    stubTicket({ sources: () => jsonResponse(200, { data: sources }) });
    const { screen } = await renderSources();
    sources = [
      { ...fictionalSource({ fetched_at: LATER_ATTEMPT }), status: "paused" },
    ];

    vi.advanceTimersByTime(5_000);

    await expect.poll(() => statusesOf(screen)).toEqual(["NVD: paused."]);
  });

  test("announce no new result for a fetch that ended without a new attempt", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let sources = pendingSources();
    stubTicket({ sources: () => sourcesResponse(sources) });
    const { screen } = await renderSources();
    // MITRE goes back to the status of its last attempt, as when Sentinel
    // did not run its fetch, and NVD stays without one.
    sources = [
      sources[0]!,
      { ...sources[1]!, status: "failure" },
      { ...sources[2]!, status: "not_attempted" },
    ];

    vi.advanceTimersByTime(5_000);

    await expect
      .poll(() => statusesOf(screen))
      .toEqual(["MITRE: no new result. NVD: no new result."]);
  });

  test("announce nothing of a fetch that no read of the screen showed pending, such as one that the screen showed from an earlier visit", async () => {
    let sources = pendingSources();
    const spy = stubTicket({ sources: () => sourcesResponse(sources) });
    const { router, screen } = await renderSources("Pending");
    await router.navigate({ to: "/tickets" });
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
    sources = pendingSources().map((source) =>
      source.status === "pending"
        ? { ...source, status: "success", fetched_at: LATER_ATTEMPT }
        : source,
    );
    const sourcesRead = requestsTo(spy, SOURCES);

    await router.navigate({
      to: "/tickets/$ticketId",
      params: { ticketId: "SNTL-12" },
    });

    await expect.poll(() => requestsTo(spy, SOURCES)).toBe(sourcesRead + 1);
    await expect
      .element(sourceOf(screen, "NVD").getByText("Success"))
      .toBeVisible();
    // The announcement would follow, set by an effect of that commit.
    await nextFrames();
    expect(statusesOf(screen)).toEqual([]);
  });

  test("move the focus to the screen's heading when a new read removes the Refetch that has it", async () => {
    let sources = [fictionalSource()];
    stubTicket({ sources: () => sourcesResponse(sources) });
    const { screen } = await renderSources();
    refetchOf(screen, "NVD").element().focus();
    await expect.element(refetchOf(screen, "NVD")).toHaveFocus();
    // Meanwhile NVD was disabled.
    sources = [fictionalSource({ enabled: false })];

    await returnToForeground();

    await expect
      .element(sourceOf(screen, "NVD").getByText("Disabled"))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toHaveFocus();
  });
});
