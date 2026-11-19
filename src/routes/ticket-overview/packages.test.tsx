import { describe, expect, test } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import type {
  PackageDetail,
  ProductDetail,
  TicketDetail,
  TrackDetail,
} from "../../api/generated/model";
import { formatDateTime } from "../../components/date-time";
import {
  errorResponse,
  fictionalPackage,
  fictionalProduct,
  fictionalTicketDetail,
  fictionalTrack,
  jsonResponse,
  requestsTo,
  ticketResponse,
  ticketWorkResponse,
} from "../../test-api";
import { screenshot } from "../../test-screenshot";
import {
  band,
  BORDER,
  boxOf,
  colorOf,
  DAY,
  distance,
  excludedPackage,
  excludedTrack,
  FG,
  FG_MUTED,
  HOUR,
  INFO_ON_SOFT,
  INFO_SOFT,
  later,
  LINK,
  MAINTAINER,
  NEUTRAL_SOFT,
  nextFrames,
  NOT_APPLICABLE,
  packagesPart,
  prepareEachTest,
  productOf,
  renderTree,
  returnToForeground,
  type Screen,
  SET_AT,
  SET_BY_HAND,
  SETTER,
  showHidden,
  showing,
  stubTicket,
  TICKETS,
  trackOf,
  UNOBSERVED,
  WARNING_ICON,
  WARNING_ON_SOFT,
  YOUR_WORK,
} from "./test-support";

// The package tree of Overview, the first tab of the Ticket screen
// (src/routes/ticket-overview/packages.tsx; docs/screens/ticket.md), at the
// browser's default text size, in the light theme.

prepareEachTest();

// Answers Get Ticket with a Ticket whose package tree holds values that the
// pinned contract does not list, which a later Sentinel release can return.
function showingUnlisted(packages: Record<string, unknown>[]) {
  return stubTicket({
    ticket: () =>
      jsonResponse(200, { data: { ...fictionalTicketDetail(), packages } }),
  });
}

// The release of a Product as its details show it, or undefined where they
// show none; the details close again.
async function releaseInDetails(
  screen: Screen,
  name: string,
): Promise<string | undefined> {
  await screen.getByRole("button", { name, exact: true }).click();
  const details = screen.getByRole("dialog", { name });
  await expect.element(details).toHaveFocus();
  const terms = details
    .getByRole("term")
    .elements()
    .map((element) => element.textContent);
  const definitions = details
    .getByRole("definition")
    .elements()
    .map((element) => element.textContent);
  await userEvent.keyboard("{Escape}");
  await expect.element(details).not.toBeInTheDocument();
  const index = terms.indexOf("Release");
  return index === -1 ? undefined : (definitions[index] ?? undefined);
}

// Shows a package tree with one Product with the fields, opens its details,
// and returns them.
async function openProductDetails(
  product: Partial<ProductDetail>,
): Promise<Locator> {
  showing([
    fictionalPackage({
      tracks: [fictionalTrack({ products: [fictionalProduct(product)] })],
    }),
  ]);
  const { screen } = await renderTree();
  await screen
    .getByRole("button", { name: "Fictional Linux Enterprise Server 15 SP7" })
    .click();
  const details = screen.getByRole("dialog", {
    name: "Fictional Linux Enterprise Server 15 SP7",
  });
  await expect.element(details).toHaveFocus();
  return details;
}

// The value of Eligibility in the details of a Product, their first field.
function eligibilityIn(details: Locator): Element {
  return details.getByRole("definition").first().element();
}

// Presses Show hidden where a pointer does: on its rail and its label, which
// cover the input of the switch.
async function pressShowHidden(screen: Screen) {
  const label = showHidden(screen).element().closest("label");
  if (label === null) {
    throw new Error("Show hidden has no label");
  }
  await page.elementLocator(label).click();
}

// A date and time of the API that lies the duration from now.
function fromNow(duration: number): string {
  return new Date(Date.now() + duration).toISOString();
}

// The fields of a track without due dates, whose Ticket has no SLA.
const NO_SLA: Partial<TrackDetail> = {
  triage_due_at: null,
  submission_due_at: null,
  um_due_at: null,
  qa_due_at: null,
  release_due_at: null,
  milestones: { triage: null, submission: null, um: null, qa: null },
  current_phase: null,
};

// A Product that is excluded from its track.
function excludedProduct(fields: Partial<ProductDetail> = {}): ProductDetail {
  return fictionalProduct({
    id: "00000000-0000-0000-0000-0000000000c2",
    product_name: "Fictional Linux Enterprise Desktop 15 SP7",
    product_cpe: "cpe:/o:example:fled:15:sp7",
    deleted_at: "2099-10-10T10:00:00Z",
    actionable: false,
    non_actionable_reason: "product_excluded",
    ...fields,
  });
}

// A Product at the end of its life.
function eolProduct(fields: Partial<ProductDetail> = {}): ProductDetail {
  return fictionalProduct({
    id: "00000000-0000-0000-0000-0000000000c3",
    product_name: "Fictional Linux Enterprise Server 15 SP3",
    product_cpe: "cpe:/o:example:fles:15:sp3",
    lifecycle_phase: "eol",
    actionable: false,
    non_actionable_reason: "eol",
    ...fields,
  });
}

describe("the part", () => {
  test("follows the CVE in the main column, with a level-two heading, and is the target of its anchor", async () => {
    await page.viewport(1280, 300);
    showing([fictionalPackage()]);

    const { screen } = await renderTree("/tickets/SNTL-12#packages");

    const part = packagesPart(screen);
    await expect
      .element(part.getByRole("heading", { level: 2, name: "Packages" }))
      .toBeVisible();
    expect(
      screen
        .getByRole("region", { name: "CVE-2099-0012" })
        .element()
        .compareDocumentPosition(part.element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    await expect
      .element(part.getByRole("heading", { level: 2 }))
      .toBeInViewport();
  });

  test("says No packages. for a Ticket without packages, without the switch", async () => {
    showing([]);

    const { screen } = await renderTree();

    await expect
      .element(packagesPart(screen).getByText("No packages.", { exact: true }))
      .toBeVisible();
    expect(colorOf(screen.getByText("No packages.").element())).toBe(FG_MUTED);
    expect(showHidden(screen).elements()).toHaveLength(0);
  });

  test("shows each package as a group under a band, 32 px apart, its tracks 12 px below the band and indented by 12 px, in the order of the API", async () => {
    showing([
      fictionalPackage(),
      fictionalPackage({
        id: "00000000-0000-0000-0000-0000000000a2",
        package_name: "fictional-zlib",
        tracks: [
          fictionalTrack({
            id: "00000000-0000-0000-0000-0000000000b2",
            workflow_type: "git",
            reference: "fles-16.0",
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const headings = packagesPart(screen).getByRole("heading", { level: 3 });
    expect(headings.elements().map((element) => element.textContent)).toEqual([
      "fictional-openssl",
      "fictional-zlib",
    ]);
    const first = band(screen, "fictional-openssl");
    const style = getComputedStyle(first);
    expect(style.backgroundColor).toBe(NEUTRAL_SOFT);
    expect(style.borderRadius).toBe("6px");
    expect(style.paddingLeft).toBe("12px");
    expect(style.borderTopWidth).toBe("0px");
    expect(boxOf(first).height).toBeGreaterThanOrEqual(32);
    const title = getComputedStyle(
      screen.getByRole("heading", { name: "fictional-openssl" }).element(),
    );
    expect(title.fontSize).toBe("15px");
    expect(title.fontWeight).toBe("600");
    const track = trackOf(screen, "SUSE:FLES-15-SP7:Update").first();
    expect(boxOf(track).top - boxOf(first).bottom).toBe(12);
    expect(boxOf(track).left - boxOf(first).left).toBe(12);
    const second = band(screen, "fictional-zlib");
    const firstGroup = first.parentElement;
    expect(firstGroup).not.toBeNull();
    expect(boxOf(second).top - boxOf(firstGroup!).bottom).toBe(32);
  });

  test("lists the tracks and the Products as nested lists", async () => {
    showing([fictionalPackage()]);

    const { screen } = await renderTree();

    const product = screen.getByRole("button", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });
    // The Product, in the list of its track, in the list of the package, in
    // the list of the packages.
    let lists = 0;
    for (
      let element = product.element().parentElement;
      element !== null;
      element = element.parentElement
    ) {
      if (element.tagName === "UL") {
        lists += 1;
      }
    }
    expect(lists).toBe(3);
  });

  test("reflows at 320 CSS pixels without scrolling in two directions, its names wrapping", async () => {
    await page.viewport(320, 640);
    // Names without a place where a line breaks by itself, such as a space or
    // a hyphen.
    const long = `fictional${"package".repeat(8)}`;
    showing([
      fictionalPackage({
        package_name: long,
        tracks: [
          fictionalTrack({
            reference: "SUSE:FLES-15-SP7:Update:Fictional:Very:Long:Reference",
            status: "fixed",
            products: [
              fictionalProduct({
                product_name: `Fictional Linux Enterprise ${"Server".repeat(8)} 15 SP7`,
              }),
            ],
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    expect(document.documentElement.scrollWidth).toBe(
      document.documentElement.clientWidth,
    );
    await expect
      .element(screen.getByRole("heading", { level: 3, name: long }))
      .toBeVisible();
    // The line of the track wraps: its pipeline below the reference, and its
    // affectedness, in its place of 104 px, below the pipeline, each at the
    // end of its line; the text of the affectedness follows its dot of 8 px
    // 6 px later.
    const track = trackOf(
      screen,
      "SUSE:FLES-15-SP7:Update:Fictional:Very:Long:Reference",
    );
    const end = boxOf(track).right;
    const pipeline = boxOf(track.getByRole("button", { name: /^Phases of/ }));
    const reference = boxOf(
      track.getByText("SUSE:FLES-15-SP7:Update:Fictional:Very:Long:Reference"),
    );
    const affectedness = boxOf(track.getByText("Fixed", { exact: true }));
    expect(pipeline.top).toBeGreaterThanOrEqual(reference.bottom);
    expect(pipeline.right).toBeCloseTo(end, 0);
    expect(affectedness.top).toBeGreaterThanOrEqual(pipeline.bottom);
    expect(affectedness.left).toBeCloseTo(end - 104 + 8 + 6, 0);
    // The release of its Product, which keeps the Ticket from Resolved, at
    // the end of the line below its name.
    const product = track.getByRole("listitem");
    const release = boxOf(product.getByText("Not released", { exact: true }));
    expect(release.top).toBeGreaterThanOrEqual(
      boxOf(product.getByRole("button")).bottom,
    );
    expect(release.right).toBeCloseTo(boxOf(product).right, 0);
  });
});

describe("a package", () => {
  test("shows its maintainers in its band, and opens them in the order of the API", async () => {
    showing([
      fictionalPackage({
        maintainers: [
          {
            id: "00000000-0000-0000-0000-000000000004",
            username: "dbrown",
            full_name: "Dave Brown",
            active: true,
            bot: false,
            avatar_url: null,
          },
          {
            id: "00000000-0000-0000-0000-000000000005",
            username: "ghill",
            full_name: "Grace Hill",
            active: false,
            bot: false,
            avatar_url: null,
          },
        ],
      }),
    ]);
    const { screen } = await renderTree();
    const button = screen.getByRole("button", {
      name: "2 maintainers of fictional-openssl",
    });
    expect(band(screen, "fictional-openssl").contains(button.element())).toBe(
      true,
    );

    await button.click();

    const popover = screen.getByRole("dialog", {
      name: "Maintainers of fictional-openssl",
    });
    await expect.element(popover).toHaveFocus();
    expect(
      popover
        .getByRole("listitem")
        .elements()
        .map((element) => element.textContent),
    ).toEqual(["Dave Brown @dbrown", "Grace Hill @ghillInactive"]);
  });
});

describe("a track", () => {
  test("shows its reference and its affectedness on its first line, without its workflow", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack(),
          fictionalTrack({
            id: "00000000-0000-0000-0000-0000000000b2",
            workflow_type: "git",
            reference: "fles-16.0",
            status: "not_affected",
            delivery_relevant: false,
            ...NOT_APPLICABLE,
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const ibs = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    await expect
      .element(ibs.getByText("Affected", { exact: true }))
      .toBeVisible();
    const git = trackOf(screen, "fles-16.0");
    await expect
      .element(git.getByText("Not affected", { exact: true }))
      .toBeVisible();
    for (const track of [ibs, git]) {
      expect(track.getByText(/^(?:IBS|Git)$/i).elements()).toHaveLength(0);
    }
    // The affectedness on the line of the reference, toward its end.
    const affected = boxOf(ibs.getByText("Affected", { exact: true }));
    expect(affected.top).toBeLessThan(
      boxOf(ibs.getByText("SUSE:FLES-15-SP7:Update")).bottom,
    );
    expect(affected.left).toBeGreaterThan(
      boxOf(packagesPart(screen)).right - 104,
    );
    const reference = getComputedStyle(
      screen.getByText("SUSE:FLES-15-SP7:Update", { exact: true }).element(),
    );
    expect(reference.fontWeight).toBe("500");
  });

  test("keeps its pipeline and its affectedness at the end of their line where its reference takes a line of its own", async () => {
    const long = `SUSE:FLES-15-SP7:Update:${"Fictional".repeat(12)}`;
    showing([
      fictionalPackage({ tracks: [fictionalTrack({ reference: long })] }),
    ]);

    const { screen } = await renderTree();

    const track = trackOf(screen, long);
    const pipeline = boxOf(track.getByRole("button", { name: /^Phases of/ }));
    expect(pipeline.top).toBeGreaterThanOrEqual(
      boxOf(track.getByText(long)).bottom,
    );
    const affectedness = boxOf(track.getByText("Affected", { exact: true }));
    expect(affectedness.top).toBeLessThan(pipeline.bottom);
    expect(affectedness.left).toBeCloseTo(boxOf(track).right - 104 + 8 + 6, 0);
  });

  test("lines up the pipelines and the affectedness of its tracks, 12 px apart", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({ status: "analysis" }),
          fictionalTrack({
            id: "00000000-0000-0000-0000-0000000000b2",
            reference: "SUSE:FLES-15-SP6:Update",
            status: "fixed",
            delivery_relevant: false,
          }),
          fictionalTrack({
            id: "00000000-0000-0000-0000-0000000000b3",
            workflow_type: "git",
            reference: "fles-16.0",
            status: "not_affected",
            delivery_relevant: false,
            ...NOT_APPLICABLE,
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    await expect
      .element(
        trackOf(screen, "SUSE:FLES-15-SP7:Update").getByRole("button", {
          name: /^Phases of/,
        }),
      )
      .toBeVisible();
    const tracks = (
      [
        ["SUSE:FLES-15-SP7:Update", "Analysis"],
        ["SUSE:FLES-15-SP6:Update", "Fixed"],
        ["fles-16.0", "Not affected"],
      ] as const
    ).map(([reference, affectedness]) => {
      const track = trackOf(screen, reference);
      return {
        item: boxOf(track),
        reference: boxOf(track.getByText(reference, { exact: true })),
        affectedness: boxOf(track.getByText(affectedness, { exact: true })),
        pipeline: track.getByRole("button", { name: /^Phases of/ }).query(),
      };
    });
    const pipelines = tracks
      .slice(0, 2)
      .map(({ pipeline }) => boxOf(pipeline!));
    // Each pipeline on the line of its reference, at the same place.
    for (const [index, pipeline] of pipelines.entries()) {
      expect(pipeline.top).toBeLessThan(tracks[index]!.reference.bottom);
    }
    expect(pipelines[0]!.right).toBeCloseTo(pipelines[1]!.right, 0);
    // The affectedness on the line of its reference, at the same place on
    // every track, Not affected, the widest, included; its text follows its
    // dot of 8 px 6 px later, 12 px after the pipeline.
    for (const { affectedness, reference } of tracks) {
      expect(affectedness.top).toBeLessThan(reference.bottom);
      expect(affectedness.left).toBeCloseTo(tracks[0]!.affectedness.left, 0);
    }
    expect(tracks[0]!.affectedness.left - pipelines[0]!.right).toBeCloseTo(
      12 + 8 + 6,
      0,
    );
    // The tracks 12 px apart.
    expect(tracks[1]!.item.top - tracks[0]!.item.bottom).toBeCloseTo(12, 0);
    expect(tracks[2]!.item.top - tracks[1]!.item.bottom).toBeCloseTo(12, 0);
  });

  test.each<[TrackDetail["status"], string]>([
    ["analysis", "Analysis"],
    ["affected", "Affected"],
    ["not_affected", "Not affected"],
    ["fixed", "Fixed"],
    ["wont_fix", "Won't fix"],
  ])("names the affectedness %s %s", async (status, name) => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            status,
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    await expect
      .element(
        trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText(name, {
          exact: true,
        }),
      )
      .toBeVisible();
  });

  test("shows values that the pinned contract does not list as received", async () => {
    showingUnlisted([
      {
        ...fictionalPackage(),
        tracks: [
          {
            ...fictionalTrack(),
            status: "partially_affected",
            delivery_status: "on_hold",
            milestones: {
              triage: "done",
              submission: "waived",
              um: "pending",
              qa: "pending",
            },
          },
        ],
      },
    ]);

    const { screen } = await renderTree();

    const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    await expect
      .element(track.getByText("partially_affected", { exact: true }))
      .toBeVisible();
    // An affectedness that it does not list has no work, so the delivery,
    // which is not Pending, shows as a signal, without the pipeline.
    await expect
      .element(track.getByText("on_hold", { exact: true }))
      .toBeVisible();
    expect(
      track.getByRole("button", { name: /^Phases of/ }).elements(),
    ).toHaveLength(0);
  });

  test.each<[TrackDetail["status"]]>([["analysis"], ["affected"], ["fixed"]])(
    "shows its pipeline on its line, and its delivery in Phases, while it has work, in %s",
    async (status) => {
      showing([
        fictionalPackage({
          tracks: [
            fictionalTrack({
              status,
              submission_due_at: fromNow(3 * DAY + HOUR),
            }),
          ],
        }),
      ]);

      const { screen } = await renderTree();

      const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
      const pipeline = track.getByRole("button", {
        name: /^Phases of fictional-openssl, SUSE:FLES-15-SP7:Update: .*; delivery pending$/,
      });
      await expect.element(pipeline).toBeVisible();
      // On the line of the reference.
      expect(boxOf(pipeline).top).toBeLessThan(
        boxOf(track.getByText("SUSE:FLES-15-SP7:Update")).bottom,
      );
      expect(track.getByText("Delivery").elements()).toHaveLength(0);

      await pipeline.click();

      const phases = screen.getByRole("dialog", { name: "Phases" });
      await expect.element(phases).toHaveFocus();
      const delivery = phases.getByText("Delivery", { exact: true });
      expect(colorOf(delivery.element())).toBe(FG_MUTED);
      expect(phases.element().textContent).toMatch(/DeliveryPending$/);
    },
  );

  test("shows no deadline badge, its pipeline showing its deadline", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            submission_due_at: fromNow(-3 * DAY + HOUR),
            milestones: {
              triage: "done",
              submission: "overdue",
              um: "pending",
              qa: "pending",
            },
          }),
          // A Git track, whose current phase is null with due dates: a badge
          // would name its release.
          fictionalTrack({
            id: "00000000-0000-0000-0000-0000000000b2",
            workflow_type: "git",
            reference: "fles-16.0",
            release_due_at: fromNow(9 * DAY + HOUR),
            qa_due_at: fromNow(9 * DAY + HOUR),
            ...UNOBSERVED,
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const ibs = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    await expect
      .element(
        ibs.getByRole("button", {
          name: /: Triage done; Submission overdue by 3 days, current;/,
        }),
      )
      .toBeVisible();
    const git = trackOf(screen, "fles-16.0");
    await expect
      .element(git.getByRole("button", { name: /^Phases of/ }))
      .toBeVisible();
    for (const track of [ibs, git]) {
      // Neither the text of a badge nor its words.
      expect(
        track
          .getByText(/^(?:Triage|Submission|UM|QA|Release) -?\d+d$/)
          .elements(),
      ).toHaveLength(0);
      expect(
        track.getByText(/(?:due in|overdue by) \d+ days?$/).elements(),
      ).toHaveLength(0);
    }
  });

  test.each<
    [string, Partial<TrackDetail>, Partial<TicketDetail>, string | undefined]
  >([
    ["whose submission Sentinel observes: Pending", {}, {}, "Pending"],
    [
      "of Git, whose submission Sentinel does not observe: no Delivery Pending",
      { workflow_type: "git", reference: "fles-16.0", ...UNOBSERVED },
      {},
      undefined,
    ],
    [
      "of a Ticket without a CVE, whose submission Sentinel does not observe: no Delivery Pending",
      UNOBSERVED,
      { cve: null },
      undefined,
    ],
    [
      "of Git, once Sentinel observes its submission: Pending",
      { workflow_type: "git", reference: "fles-16.0" },
      {},
      "Pending",
    ],
    [
      "whose submission Sentinel does not observe, when it is not Pending: In progress",
      {
        workflow_type: "git",
        reference: "fles-16.0",
        delivery_status: "in_progress",
        ...UNOBSERVED,
      },
      {},
      "In progress",
    ],
  ])(
    "shows the delivery of a track with work %s",
    async (_, fields, ticket, status) => {
      showing([fictionalPackage({ tracks: [fictionalTrack(fields)] })], ticket);

      const { screen } = await renderTree();

      const track = trackOf(
        screen,
        fields.reference ?? "SUSE:FLES-15-SP7:Update",
      );
      // The track has work and due dates, so its pipeline shows, and Phases
      // holds its delivery.
      const pipeline = track.getByRole("button", { name: /^Phases of/ });
      await expect.element(pipeline).toBeVisible();
      expect(track.getByText("Delivery").elements()).toHaveLength(0);

      await pipeline.click();

      const phases = screen.getByRole("dialog", { name: "Phases" });
      await expect.element(phases).toHaveFocus();
      if (status === undefined) {
        expect(pipeline.element().getAttribute("aria-label")).not.toMatch(
          /delivery/i,
        );
        expect(phases.getByText("Delivery").elements()).toHaveLength(0);
      } else {
        expect(pipeline.element().getAttribute("aria-label")).toMatch(
          new RegExp(`; delivery ${status.toLowerCase()}$`),
        );
        expect(phases.element().textContent).toMatch(
          new RegExp(`Delivery${status}$`),
        );
      }
    },
  );

  test("decides Delivery Pending by the submission and the release by the QA, a milestone that the pinned contract does not list counting as observed", async () => {
    showingUnlisted([
      {
        ...fictionalPackage(),
        tracks: [
          {
            ...fictionalTrack(),
            milestones: {
              triage: "done",
              submission: "waived",
              um: null,
              qa: null,
            },
            current_phase: null,
          },
          {
            ...fictionalTrack({
              id: "00000000-0000-0000-0000-0000000000b2",
              reference: "SUSE:FLES-15-SP6:Update",
              products: [
                fictionalProduct({
                  id: "00000000-0000-0000-0000-0000000000c9",
                  product_name: "Fictional Linux Enterprise Server 15 SP6",
                  product_cpe: "cpe:/o:example:fles:15:sp6",
                }),
              ],
            }),
            milestones: {
              triage: "done",
              submission: null,
              um: null,
              qa: "waived",
            },
            current_phase: null,
          },
        ],
      },
    ]);

    const { screen } = await renderTree();

    const submitted = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    await expect
      .element(
        submitted.getByRole("button", {
          name: /^Phases of .*; delivery pending$/,
        }),
      )
      .toBeVisible();
    expect(
      await releaseInDetails(
        screen,
        "Fictional Linux Enterprise Server 15 SP7",
      ),
    ).toBe("Not observed");
    const tested = trackOf(screen, "SUSE:FLES-15-SP6:Update");
    expect(
      tested
        .getByRole("button", { name: /^Phases of/ })
        .element()
        .getAttribute("aria-label"),
    ).not.toMatch(/delivery/);
    expect(
      await releaseInDetails(
        screen,
        "Fictional Linux Enterprise Server 15 SP6",
      ),
    ).toBe("Not released");
  });

  test.each<[string, TrackDetail["status"]]>([
    ["Not affected", "not_affected"],
    ["Won't fix", "wont_fix"],
  ])(
    "shows no pipeline and no Delivery Pending while it is %s, without work",
    async (_, status) => {
      showing([
        fictionalPackage({
          tracks: [
            fictionalTrack({
              status,
              delivery_relevant: false,
              ...NOT_APPLICABLE,
            }),
          ],
        }),
      ]);

      const { screen } = await renderTree();

      const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
      expect(track.getByText("Delivery").elements()).toHaveLength(0);
      expect(
        track.getByRole("button", { name: /^Phases of/ }).elements(),
      ).toHaveLength(0);
    },
  );

  test("shows no pipeline and no Delivery Pending while it is Affected without a Product that is eligible", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            products: [fictionalProduct({ eligible: false })],
            milestones: {
              triage: "done",
              submission: "not_applicable",
              um: "not_applicable",
              qa: "not_applicable",
            },
            current_phase: "done",
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    expect(track.getByText("Delivery").elements()).toHaveLength(0);
    expect(
      track.getByRole("button", { name: /^Phases of/ }).elements(),
    ).toHaveLength(0);
  });

  test("shows a delivery other than Pending as a signal on a track without work", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            status: "not_affected",
            delivery_status: "in_progress",
            delivery_relevant: true,
            ...NOT_APPLICABLE,
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    const status = track.getByText("In progress", { exact: true });
    await expect.element(status).toBeVisible();
    expect(
      track.getByRole("button", { name: /^Phases of/ }).elements(),
    ).toHaveLength(0);
    // On the line of the reference, in place of the pipeline, before the
    // affectedness: "Delivery" in fg-muted, then its status in fg, 6 px later,
    // without a mark between them.
    const label = track.getByText("Delivery", { exact: true });
    expect(colorOf(label.element())).toBe(FG_MUTED);
    expect(colorOf(status.element())).toBe(FG);
    expect(boxOf(status).left - boxOf(label).right).toBeCloseTo(6, 0);
    expect(boxOf(label).top).toBeLessThan(
      boxOf(track.getByText("SUSE:FLES-15-SP7:Update")).bottom,
    );
    expect(boxOf(status).right).toBeLessThan(
      boxOf(track.getByText("Not affected", { exact: true })).left,
    );
  });

  test("shows no delivery where it is not relevant", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            status: "fixed",
            delivery_relevant: false,
            products: [
              fictionalProduct({ released_at: "2099-10-20T09:00:00Z" }),
            ],
            milestones: {
              triage: "done",
              submission: "done",
              um: "done",
              qa: "done",
            },
            current_phase: "done",
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    // Neither on its line nor in the name of its pipeline, nor in Phases.
    const pipeline = track.getByRole("button", { name: /^Phases of/ });
    await expect.element(pipeline).toBeVisible();
    expect(track.getByText("Delivery").elements()).toHaveLength(0);
    expect(pipeline.element().getAttribute("aria-label")).not.toMatch(
      /delivery/,
    );

    await pipeline.click();

    const phases = screen.getByRole("dialog", { name: "Phases" });
    await expect.element(phases).toHaveFocus();
    expect(phases.getByText("Delivery").elements()).toHaveLength(0);
  });

  test("shows only what happened on a track without due dates, whose Ticket has no SLA: no pipeline, no Delivery Pending, and no release that is due", async () => {
    // A Ticket whose severity is None has no SLA (Sentinel
    // docs/features/tickets/ticket-deadlines.md, Null Due Dates), so the
    // milestones of its tracks do not show which phases Sentinel observes.
    showing(
      [
        fictionalPackage({
          tracks: [
            fictionalTrack(NO_SLA),
            fictionalTrack({
              ...NO_SLA,
              id: "00000000-0000-0000-0000-0000000000b2",
              reference: "SUSE:FLES-15-SP6:Update",
              delivery_status: "in_progress",
              products: [
                fictionalProduct({
                  id: "00000000-0000-0000-0000-0000000000c9",
                  product_name: "Fictional Linux Enterprise Server 15 SP6",
                  product_cpe: "cpe:/o:example:fles:15:sp6",
                  released_at: "2099-10-20T09:00:00Z",
                }),
              ],
            }),
          ],
        }),
      ],
      {
        severity: "none",
        triage_due_at: null,
        submission_due_at: null,
        um_due_at: null,
        qa_due_at: null,
        release_due_at: null,
        current_phase: null,
        current_phase_milestone: null,
      },
    );

    const { screen } = await renderTree();

    const pending = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    await expect
      .element(pending.getByText("Affected", { exact: true }))
      .toBeVisible();
    expect(pending.getByText("Delivery").elements()).toHaveLength(0);
    expect(
      pending.getByRole("button", { name: /^Phases of/ }).elements(),
    ).toHaveLength(0);
    expect(pending.getByText(/release/i).elements()).toHaveLength(0);
    const delivered = trackOf(screen, "SUSE:FLES-15-SP6:Update");
    await expect
      .element(delivered.getByText("In progress", { exact: true }))
      .toBeVisible();
    expect(
      await releaseInDetails(
        screen,
        "Fictional Linux Enterprise Server 15 SP7",
      ),
    ).toBeUndefined();
    expect(
      await releaseInDetails(
        screen,
        "Fictional Linux Enterprise Server 15 SP6",
      ),
    ).toBe(`Released ${formatDateTime("2099-10-20T09:00:00Z")}`);
  });

  test.each<[TicketDetail["status"]]>([["ignored"], ["duplicated"]])(
    "shows no work on a track of a Ticket that is %s: no Delivery Pending and no release that is due, only a release that happened",
    async (status) => {
      showing(
        [
          fictionalPackage({
            tracks: [
              fictionalTrack({
                ...NO_SLA,
                products: [
                  fictionalProduct(),
                  fictionalProduct({
                    id: "00000000-0000-0000-0000-0000000000c9",
                    product_name: "Fictional Linux Enterprise Server 16.0",
                    product_cpe: "cpe:/o:example:fles:16.0",
                    released_at: "2099-10-20T09:00:00Z",
                  }),
                ],
              }),
            ],
          }),
        ],
        {
          status,
          // An Ignored Ticket always carries its reason (Sentinel
          // docs/features/tickets/tickets.md, Ignore Reason).
          ignore_reason: status === "ignored" ? "other" : null,
          triage_due_at: null,
          submission_due_at: null,
          um_due_at: null,
          qa_due_at: null,
          release_due_at: null,
          current_phase: null,
          current_phase_milestone: null,
        },
      );

      const { screen } = await renderTree();

      const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
      await expect
        .element(track.getByText("Affected", { exact: true }))
        .toBeVisible();
      expect(track.getByText("Delivery").elements()).toHaveLength(0);
      expect(
        await releaseInDetails(
          screen,
          "Fictional Linux Enterprise Server 15 SP7",
        ),
      ).toBeUndefined();
      expect(
        await releaseInDetails(
          screen,
          "Fictional Linux Enterprise Server 16.0",
        ),
      ).toBe(`Released ${formatDateTime("2099-10-20T09:00:00Z")}`);
    },
  );
});

describe("a Product", () => {
  test("shows its name as a button that opens its details, without its release on its line", async () => {
    showing([fictionalPackage()]);

    const { screen } = await renderTree();

    const name = screen.getByRole("button", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });
    await expect.element(name).toBeVisible();
    expect(colorOf(name.element())).toBe(FG);
    expect(boxOf(name).height).toBeGreaterThanOrEqual(24);
    expect(
      productOf(screen, "Fictional Linux Enterprise Server 15 SP7")
        .getByText(/release/i)
        .elements(),
    ).toHaveLength(0);
    expect(
      await releaseInDetails(
        screen,
        "Fictional Linux Enterprise Server 15 SP7",
      ),
    ).toBe("Not released");
  });

  test("shows at the end of its line the release that keeps a Ticket with a CVE from Resolved", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            status: "fixed",
            delivery_status: "released",
            milestones: {
              triage: "done",
              submission: "done",
              um: "done",
              qa: "pending",
            },
            current_phase: "qa",
            products: [
              fictionalProduct(),
              fictionalProduct({
                id: "00000000-0000-0000-0000-0000000000c9",
                product_name: "Fictional Linux Enterprise Server LTSS 15 SP7",
                product_cpe: "cpe:/o:example:fles-ltss:15:sp7",
                released_at: "2099-10-20T09:00:00Z",
              }),
            ],
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const product = productOf(
      screen,
      "Fictional Linux Enterprise Server 15 SP7",
    );
    const release = product.getByText("Not released", { exact: true });
    await expect.element(release).toBeVisible();
    const style = getComputedStyle(release.element());
    expect(style.color).toBe(WARNING_ON_SOFT);
    expect(style.fontSize).toBe("13px");
    expect(style.fontWeight).toBe("500");
    expect(boxOf(release).right).toBeCloseTo(boxOf(product).right, 0);
    // triangle-alert at 14 px in warning-icon starts it, 4 px before its
    // words: the pixel of the first 14 px closest to warning-icon is it,
    // apart from the smoothing of its edges.
    const words = release.element().lastChild;
    const range = document.createRange();
    range.selectNodeContents(words!);
    expect(
      range.getBoundingClientRect().left - boxOf(release).left,
    ).toBeCloseTo(14 + 4, 0);
    const picture = await screenshot(release);
    const pixels = Array.from({ length: 14 * picture.height }, (_, index) =>
      picture.at(index % 14, Math.floor(index / 14)),
    );
    expect(
      Math.min(...pixels.map((pixel) => distance(pixel, WARNING_ICON))),
    ).toBeLessThan(24);
    // The released Product shows nothing on its line.
    expect(
      productOf(screen, "Fictional Linux Enterprise Server LTSS 15 SP7")
        .getByText(/release/i)
        .elements(),
    ).toHaveLength(0);
  });

  test.each<
    [
      string,
      Partial<TrackDetail>,
      Partial<TicketDetail>,
      string | undefined,
      string,
    ]
  >([
    [
      "a Fixed track whose QA Sentinel observes, on its line too",
      { status: "fixed" },
      {},
      "Not released",
      "Not released",
    ],
    [
      "a Fixed Git track, whose QA Sentinel does not observe, on its line too",
      {
        status: "fixed",
        workflow_type: "git",
        reference: "fles-16.0",
        ...UNOBSERVED,
      },
      {},
      "Release not observed",
      "Not observed",
    ],
    [
      "a Fixed track of a Ticket without a CVE, which it does not keep from Resolved, in its details only",
      { status: "fixed", ...UNOBSERVED },
      { cve: null },
      undefined,
      "Not observed",
    ],
    [
      "an Affected track whose QA Sentinel observes, in its details only",
      {},
      {},
      undefined,
      "Not released",
    ],
    [
      "an Affected Git track, once Sentinel observes its QA, in its details only",
      { workflow_type: "git", reference: "fles-16.0" },
      {},
      undefined,
      "Not released",
    ],
    [
      "a track in Analysis whose QA Sentinel does not observe, in its details only",
      { status: "analysis", ...UNOBSERVED },
      {},
      undefined,
      "Not observed",
    ],
  ])(
    "shows that it is not released, below %s",
    async (_, track, ticket, line, details) => {
      showing([fictionalPackage({ tracks: [fictionalTrack(track)] })], ticket);
      const { screen } = await renderTree();
      const product = productOf(
        screen,
        "Fictional Linux Enterprise Server 15 SP7",
      );
      await expect.element(product).toBeVisible();
      if (line === undefined) {
        expect(product.getByText(/release/i).elements()).toHaveLength(0);
      } else {
        await expect
          .element(product.getByText(line, { exact: true }))
          .toBeVisible();
        expect(product.getByText(/release/i).elements()).toHaveLength(1);
      }

      expect(
        await releaseInDetails(
          screen,
          "Fictional Linux Enterprise Server 15 SP7",
        ),
      ).toBe(details);
    },
  );

  test.each<[string, Partial<TrackDetail>, Partial<ProductDetail>]>([
    ["that is not eligible", {}, { eligible: false }],
    ["of a track without due dates, whose Ticket has no SLA", NO_SLA, {}],
  ])(
    "shows no release on the line of a Product of a Fixed track %s",
    async (_, track, product) => {
      showing([
        fictionalPackage({
          tracks: [
            fictionalTrack({
              ...track,
              status: "fixed",
              products: [
                fictionalProduct(product),
                fictionalProduct({
                  id: "00000000-0000-0000-0000-0000000000c9",
                  product_name: "Fictional Linux Enterprise Server 15 SP6",
                  product_cpe: "cpe:/o:example:fles:15:sp6",
                  released_at: "2099-10-20T09:00:00Z",
                }),
              ],
            }),
          ],
        }),
      ]);

      const { screen } = await renderTree();

      await expect
        .element(
          screen.getByRole("button", {
            name: "Fictional Linux Enterprise Server 15 SP7",
          }),
        )
        .toBeVisible();
      expect(
        packagesPart(screen)
          .getByText(/release/i)
          .elements(),
      ).toHaveLength(0);
    },
  );

  test("shows when it was released in its details, also on a track that expects no fix", async () => {
    const releasedAt = "2099-10-20T09:00:00Z";
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            status: "not_affected",
            products: [fictionalProduct({ released_at: releasedAt })],
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    expect(
      await releaseInDetails(
        screen,
        "Fictional Linux Enterprise Server 15 SP7",
      ),
    ).toBe(`Released ${formatDateTime(releasedAt)}`);
    expect(
      productOf(screen, "Fictional Linux Enterprise Server 15 SP7")
        .getByText(/released/i)
        .elements(),
    ).toHaveLength(0);
  });

  test.each<[string, Partial<TrackDetail>, Partial<ProductDetail>]>([
    ["on a track that expects no fix", { status: "wont_fix" }, {}],
    ["when it is not eligible", {}, { eligible: false }],
  ])("shows no release %s", async (_, track, product) => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            ...track,
            products: [fictionalProduct(product)],
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();
    expect(
      productOf(screen, "Fictional Linux Enterprise Server 15 SP7")
        .getByText(/released/i)
        .elements(),
    ).toHaveLength(0);

    await screen
      .getByRole("button", { name: "Fictional Linux Enterprise Server 15 SP7" })
      .click();

    // Nor do its details.
    const details = screen.getByRole("dialog", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });
    await expect.element(details).toBeVisible();
    expect(
      details
        .getByRole("term")
        .elements()
        .map((element) => element.textContent),
    ).toEqual(["Eligibility", "Lifecycle"]);
  });

  test("marks a Product that is not eligible, in gray, and one whose eligibility is set by hand", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            products: [fictionalProduct(SET_BY_HAND)],
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree();

    const product = productOf(
      screen,
      "Fictional Linux Enterprise Server 15 SP7",
    );
    await expect
      .element(product.getByText("Not eligible", { exact: true }))
      .toBeVisible();
    expect(product.element().textContent).toContain(
      "Fictional Linux Enterprise Server 15 SP7, eligibility set by hand",
    );
    expect(
      colorOf(
        screen
          .getByRole("button", {
            name: "Fictional Linux Enterprise Server 15 SP7",
          })
          .element(),
      ),
    ).toBe(FG_MUTED);
  });

  test("opens its details, which take the focus, without actions", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            products: [fictionalProduct(SET_BY_HAND)],
          }),
        ],
      }),
    ]);
    const { screen } = await renderTree();
    const name = screen.getByRole("button", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });

    await name.click();

    const details = screen.getByRole("dialog", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });
    await expect.element(details).toHaveFocus();
    await expect
      .element(details.getByText("cpe:/o:example:fles:15:sp7"))
      .toBeVisible();
    expect(
      details
        .getByRole("term")
        .elements()
        .map((element) => element.textContent),
    ).toEqual(["Eligibility", "Lifecycle"]);
    expect(
      details
        .getByRole("definition")
        .elements()
        .map((element) => element.textContent),
    ).toEqual([
      `Not eligible, set by handSet by Alice Smith on ${formatDateTime(SET_AT)}`,
      "General support",
    ]);
    expect(details.getByRole("button").elements()).toHaveLength(0);
  });

  test('ends an eligibility set by hand with user-pen at 14 px in fg-muted, 4 px after it, read as ", set by hand"', async () => {
    const details = await openProductDetails(SET_BY_HAND);

    const eligibility = eligibilityIn(details);
    // The icon, hidden from assistive technologies, follows the words of the
    // eligibility.
    const icons = eligibility.querySelectorAll("svg");
    expect(icons).toHaveLength(1);
    const icon = icons[0]!;
    const words = document.createRange();
    words.selectNodeContents(icon.previousSibling!);
    const box = icon.getBoundingClientRect();
    expect([box.width, box.height]).toEqual([14, 14]);
    expect(box.left - words.getBoundingClientRect().right).toBeCloseTo(4, 0);
    expect(colorOf(icon)).toBe(FG_MUTED);
    expect(details.getByRole("img").query()).toBeNull();
    expect(eligibility.textContent).toMatch(/^Not eligible, set by handSet by/);
  });

  test("shows below an eligibility set by hand who set it, in the name form, and when, as a date and time on one line, in text-13, fg-muted", async () => {
    const details = await openProductDetails(SET_BY_HAND);

    const eligibility = eligibilityIn(details);
    const line = details.getByText(/^Set by /);
    const time = line.getByText(formatDateTime(SET_AT), { exact: true });
    await expect.element(time).toHaveAttribute("datetime", SET_AT);
    expect(line.element().textContent).toBe(
      `Set by Alice Smith on ${formatDateTime(SET_AT)}`,
    );
    const style = getComputedStyle(line.element());
    expect([style.fontSize, style.color]).toEqual(["13px", FG_MUTED]);
    // The name form, without the avatar, in the color of the line, on its
    // baseline.
    const name = line.getByText("Alice Smith", { exact: true }).element();
    expect(line.element().querySelectorAll("svg")).toHaveLength(0);
    expect(colorOf(name)).toBe(FG_MUTED);
    const setBy = document.createRange();
    setBy.selectNodeContents(line.element().firstChild!);
    const nameText = document.createRange();
    nameText.selectNodeContents(name);
    expect(nameText.getBoundingClientRect().bottom).toBeCloseTo(
      setBy.getBoundingClientRect().bottom,
      0,
    );
    // Below the words of the eligibility, 2 px after their line, at the
    // start of the value.
    const value = eligibility.firstElementChild!.getBoundingClientRect();
    expect(boxOf(line).top - value.bottom).toBeCloseTo(2, 0);
    expect(boxOf(line).left).toBe(eligibility.getBoundingClientRect().left);
    // The line wraps, but never within the date and time.
    expect(boxOf(line).height).toBeGreaterThan(20);
    expect(time.element().getClientRects()).toHaveLength(1);
  });

  test.each([
    [
      "an inactive user with the label Inactive",
      { ...SETTER, active: false },
      "Alice SmithInactive",
    ],
    [
      "a bot account with the label Bot",
      { ...SETTER, bot: true },
      "Alice SmithBot",
    ],
    [
      "a user without a full name by the username",
      { ...SETTER, full_name: null },
      "asmith",
    ],
  ])(
    "shows who set an eligibility by hand when it is %s",
    async (_, user, text) => {
      const details = await openProductDetails({
        ...SET_BY_HAND,
        eligibility_override_by: user,
      });

      expect(details.getByText(/^Set by /).element().textContent).toBe(
        `Set by ${text} on ${formatDateTime(SET_AT)}`,
      );
    },
  );

  // Each value apart, so that each shows in its own place.
  test.each<[string, Partial<ProductDetail>, string]>([
    [
      "a setter",
      { eligibility_override_by: null },
      `Set by –Not set on ${formatDateTime(SET_AT)}`,
    ],
    [
      "a time",
      { eligibility_override_at: null },
      "Set by Alice Smith on –Not set",
    ],
  ])(
    "shows %s that is absent under an eligibility set by hand as an absent value, not as System",
    async (_, changes, text) => {
      const details = await openProductDetails({ ...SET_BY_HAND, ...changes });

      expect(eligibilityIn(details).textContent).toBe(
        `Not eligible, set by hand${text}`,
      );
    },
  );

  test("wraps a long name of who set an eligibility by hand within the details, which show it whole", async () => {
    const details = await openProductDetails({
      ...SET_BY_HAND,
      eligibility_override_by: {
        ...SETTER,
        full_name: "Alexandra Fictional Konstantinopoulou-Example",
        active: false,
      },
    });

    const name = details
      .getByText("Alexandra Fictional Konstantinopoulou-Example", {
        exact: true,
      })
      .element();
    expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth);
    expect(name.getBoundingClientRect().height).toBeGreaterThan(20);
    // Within the details, apart from a fraction of a pixel of rounding.
    const bounds = details.element().getBoundingClientRect();
    const label = details.getByText("Inactive", { exact: true }).element();
    expect(name.getBoundingClientRect().right - bounds.right).toBeLessThan(0.5);
    expect(label.getBoundingClientRect().right - bounds.right).toBeLessThan(
      0.5,
    );
  });

  test.each<[string, boolean]>([
    ["Eligible", true],
    ["Not eligible", false],
  ])(
    "shows an automatic eligibility, %s, without user-pen and without who set it",
    async (words, eligible) => {
      const details = await openProductDetails({ eligible });

      const eligibility = eligibilityIn(details);
      expect(eligibility.textContent).toBe(words);
      expect(eligibility.querySelectorAll("svg")).toHaveLength(0);
    },
  );

  test.each<[string, Partial<TrackDetail>, Partial<ProductDetail>, string[]]>([
    [
      "an automatic eligibility, no lifecycle data, and a Git release that Sentinel does not observe",
      { workflow_type: "git", reference: "fles-16.0", ...UNOBSERVED },
      { lifecycle_phase: null },
      ["Eligible", "Not available", "Not observed"],
    ],
    [
      "a release",
      {},
      { released_at: "2099-10-20T09:00:00Z", lifecycle_phase: "pre_release" },
      [
        "Eligible",
        "Pre-release",
        `Released ${formatDateTime("2099-10-20T09:00:00Z")}`,
      ],
    ],
  ])("shows in its details %s", async (_, track, product, values) => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack({
            ...track,
            products: [fictionalProduct(product)],
          }),
        ],
      }),
    ]);
    const { screen } = await renderTree();

    await screen
      .getByRole("button", {
        name: "Fictional Linux Enterprise Server 15 SP7",
      })
      .click();

    const details = screen.getByRole("dialog", {
      name: "Fictional Linux Enterprise Server 15 SP7",
    });
    await expect.element(details).toBeVisible();
    expect(
      details
        .getByRole("definition")
        .elements()
        .map((element) => element.textContent),
    ).toEqual(values);
  });

  test.each([
    ["product_excluded", "No, it is excluded from this track"],
    ["track_excluded", "No, its track is excluded"],
    ["package_excluded", "No, its package is excluded"],
    ["eol", "No, it has reached its end of life"],
    ["withdrawn", "No, withdrawn"],
  ])("says in its details why it takes no part: %s", async (reason, words) => {
    showingUnlisted([
      {
        ...fictionalPackage(),
        tracks: [
          {
            ...fictionalTrack(),
            products: [
              fictionalProduct(),
              {
                ...excludedProduct(),
                lifecycle_phase: "sunset",
                non_actionable_reason: reason,
              },
            ],
          },
        ],
      },
    ]);
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    await screen
      .getByRole("button", {
        name: "Fictional Linux Enterprise Desktop 15 SP7",
      })
      .click();

    const details = screen.getByRole("dialog", {
      name: "Fictional Linux Enterprise Desktop 15 SP7",
    });
    await expect.element(details).toBeVisible();
    expect(
      details
        .getByRole("definition")
        .elements()
        .map((element) => element.textContent),
    ).toEqual(["Eligible", "sunset", words]);
  });
});

// A package with a track that shows, holding a Product that shows, an
// excluded Product, and a Product at the end of its life; an excluded track;
// and an excluded package.
function withHiddenRecords(): PackageDetail[] {
  return [
    fictionalPackage({
      tracks: [
        fictionalTrack({
          products: [fictionalProduct(), excludedProduct(), eolProduct()],
        }),
        excludedTrack(),
      ],
    }),
    excludedPackage(),
  ];
}

describe("the hidden records", () => {
  test("hides the excluded and EOL records until Show hidden shows them", async () => {
    showing(withHiddenRecords());

    const { screen } = await renderTree();

    const toggle = showHidden(screen);
    await expect.element(toggle).not.toBeChecked();
    await expect.element(toggle).toHaveAccessibleName("Show hidden 4");
    expect(
      packagesPart(screen)
        .getByRole("heading", { level: 3 })
        .elements()
        .map((element) => element.textContent),
    ).toEqual(["fictional-openssl"]);
    expect(screen.getByText("SUSE:FLES-15-SP6:Update").elements()).toHaveLength(
      0,
    );
    expect(
      screen
        .getByRole("button", {
          name: "Fictional Linux Enterprise Desktop 15 SP7",
        })
        .elements(),
    ).toHaveLength(0);
    expect(
      screen
        .getByRole("button", {
          name: "Fictional Linux Enterprise Server 15 SP3",
        })
        .elements(),
    ).toHaveLength(0);
  });

  test("puts the switch at the end of the line of the heading", async () => {
    showing(withHiddenRecords());

    const { screen } = await renderTree();

    const heading = packagesPart(screen).getByRole("heading", { level: 2 });
    const toggle = showHidden(screen).element().closest("label");
    expect(toggle).not.toBeNull();
    expect(boxOf(toggle!).right).toBeCloseTo(
      boxOf(packagesPart(screen)).right,
      0,
    );
    expect(boxOf(toggle!).top).toBeLessThan(boxOf(heading).bottom);
  });

  test("shows them in gray, with the label of their own state, and keeps the state in the URL", async () => {
    showing(withHiddenRecords());
    const { router, screen } = await renderTree("/tickets/SNTL-12#packages");

    await pressShowHidden(screen);

    await expect.element(showHidden(screen)).toBeChecked();
    expect(router.state.location.href).toBe(
      "/tickets/SNTL-12?hidden=shown#packages",
    );
    expect(router.history.length).toBe(2);
    await expect.element(showHidden(screen)).toHaveFocus();
    // The excluded package, in gray, with its label in its band.
    const libpng = band(screen, "fictional-libpng");
    expect(colorOf(libpng)).toBe(FG_MUTED);
    expect(libpng.textContent).toContain("Excluded");
    // The excluded track, with its label, and its Product, without one.
    const track = trackOf(screen, "SUSE:FLES-15-SP6:Update");
    await expect
      .element(track.getByText("Excluded", { exact: true }))
      .toBeVisible();
    expect(colorOf(track.element())).toBe(FG_MUTED);
    const throughTrack = productOf(
      screen,
      "Fictional Linux Enterprise Server 15 SP6",
    );
    expect(throughTrack.getByText("Excluded").elements()).toHaveLength(0);
    expect(
      colorOf(
        screen
          .getByRole("button", {
            name: "Fictional Linux Enterprise Server 15 SP6",
          })
          .element(),
      ),
    ).toBe(FG_MUTED);
    // The excluded Product and the Product at the end of its life, each with
    // its label.
    await expect
      .element(
        productOf(
          screen,
          "Fictional Linux Enterprise Desktop 15 SP7",
        ).getByText("Excluded", { exact: true }),
      )
      .toBeVisible();
    await expect
      .element(
        productOf(screen, "Fictional Linux Enterprise Server 15 SP3").getByText(
          "EOL",
          { exact: true },
        ),
      )
      .toBeVisible();
    // The records that count keep their colors, unlike the Product of the
    // same name in the excluded package.
    expect(colorOf(band(screen, "fictional-openssl"))).toBe(FG);
    const products = screen
      .getByRole("button", { name: "Fictional Linux Enterprise Server 15 SP7" })
      .elements();
    expect(products.map(colorOf)).toEqual([FG, FG_MUTED]);

    await pressShowHidden(screen);

    expect(router.state.location.href).toBe("/tickets/SNTL-12#packages");
    await expect.element(showHidden(screen)).not.toBeChecked();
  });

  test("keeps the scroll position when Show hidden changes, also with an anchor in the URL", async () => {
    await page.viewport(1280, 400);
    // More packages after them, so that the page goes on below the package
    // tree, which the anchor can then scroll to the top of the window.
    showing([
      ...withHiddenRecords(),
      ...["fictional-curl", "fictional-zlib", "fictional-libxml2"].map(
        (name, index) =>
          fictionalPackage({
            id: `00000000-0000-0000-0000-0000000000b${index}`,
            package_name: name,
          }),
      ),
    ]);
    const { router, screen } = await renderTree("/tickets/SNTL-12#packages");
    // Once the reads of the tab have settled, the page has shown the target
    // of the anchor; it then lies elsewhere.
    await expect
      .element(screen.getByText("None", { exact: true }))
      .toBeVisible();
    await expect.poll(() => window.scrollY).toBeGreaterThan(100);
    // 60 px above, where the switch still shows, so that the click needs no
    // scroll of its own.
    const elsewhere = window.scrollY - 60;
    window.scrollTo(0, elsewhere);
    await expect.poll(() => window.scrollY).toBe(elsewhere);

    await pressShowHidden(screen);

    await expect.element(showHidden(screen)).toBeChecked();
    expect(router.state.location.hash).toBe("packages");
    expect(window.scrollY).toBe(elsewhere);
  });

  test("keeps the scroll position, the anchor, and the focus when a read shows no hidden record while Show hidden is on, which turns it off", async () => {
    await page.viewport(1280, 400);
    let restored = false;
    // More packages after them, so that the page goes on below the package
    // tree, which the anchor can then scroll to the top of the window.
    stubTicket({
      ticket: () =>
        ticketResponse(
          fictionalTicketDetail({
            packages: [
              fictionalPackage({
                tracks: [
                  fictionalTrack({
                    products: [
                      fictionalProduct(),
                      restored
                        ? excludedProduct({
                            deleted_at: null,
                            actionable: true,
                            non_actionable_reason: null,
                          })
                        : excludedProduct(),
                    ],
                  }),
                ],
              }),
              ...["fictional-curl", "fictional-zlib", "fictional-libxml2"].map(
                (name, index) =>
                  fictionalPackage({
                    id: `00000000-0000-0000-0000-0000000000b${index}`,
                    package_name: name,
                  }),
              ),
            ],
          }),
        ),
    });
    const { router, screen } = await renderTree(
      "/tickets/SNTL-12?hidden=shown#packages",
    );
    await expect
      .element(screen.getByText("None", { exact: true }))
      .toBeVisible();
    await expect.poll(() => window.scrollY).toBeGreaterThan(100);
    const elsewhere = window.scrollY - 60;
    window.scrollTo(0, elsewhere);
    await expect.poll(() => window.scrollY).toBe(elsewhere);
    const name = screen.getByRole("button", {
      name: "Fictional Linux Enterprise Desktop 15 SP7",
    });
    name.element().focus();
    restored = true;

    await returnToForeground();

    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets/SNTL-12#packages");
    await expect.element(showHidden(screen)).not.toBeChecked();
    await nextFrames();
    expect(window.scrollY).toBe(elsewhere);
    await expect.element(name).toHaveFocus();
  });

  test.each([
    [
      "the name of a hidden Product",
      "Fictional Linux Enterprise Desktop 15 SP7",
    ],
    [
      "the maintainers of a hidden package",
      "No maintainer of fictional-libpng",
    ],
  ])(
    "moves the focus to the screen's heading when %s leaves the page, as Back hides the records",
    async (_, name) => {
      showing(withHiddenRecords());
      const { router, screen } = await renderTree();
      await pressShowHidden(screen);
      const control = screen.getByRole("button", { name, exact: true });
      control.element().focus();
      await expect.element(control).toHaveFocus();

      router.history.back();

      await expect.element(showHidden(screen)).not.toBeChecked();
      await expect
        .element(screen.getByRole("heading", { level: 1 }))
        .toHaveFocus();
    },
  );

  test("shows the label of a record that its own state hides also under a hidden parent", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack(),
          excludedTrack({
            products: [eolProduct({ non_actionable_reason: "track_excluded" })],
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    await expect
      .element(
        productOf(screen, "Fictional Linux Enterprise Server 15 SP3").getByText(
          "EOL",
          { exact: true },
        ),
      )
      .toBeVisible();
  });

  test("shows a track without a Product that takes part in gray, without a label", async () => {
    showing([
      fictionalPackage({
        tracks: [
          fictionalTrack(),
          fictionalTrack({
            id: "00000000-0000-0000-0000-0000000000b4",
            reference: "SUSE:FLES-15-SP3:Update",
            status: "analysis",
            actionable: false,
            non_actionable_reason: "no_actionable_products",
            products: [eolProduct()],
            ...NOT_APPLICABLE,
          }),
        ],
      }),
    ]);

    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    const track = trackOf(screen, "SUSE:FLES-15-SP3:Update");
    await expect.element(track).toBeVisible();
    expect(colorOf(track.element())).toBe(FG_MUTED);
    expect(track.getByText("Excluded").elements()).toHaveLength(0);
    await expect
      .element(showHidden(screen))
      .toHaveAccessibleName("Show hidden 1");
  });

  test("turns the switch off and disables it without hidden records, removing hidden=shown from the URL, in place of the URL, with the anchor", async () => {
    showing([fictionalPackage()]);

    const { router, screen } = await renderTree(
      "/tickets/SNTL-12?hidden=shown#packages",
    );

    await expect.element(showHidden(screen)).toBeDisabled();
    await expect.element(showHidden(screen)).not.toBeChecked();
    await expect
      .element(showHidden(screen))
      .toHaveAccessibleName("Show hidden 0");
    await expect
      .poll(() => router.state.location.href)
      .toBe("/tickets/SNTL-12#packages");
    expect(router.history.length).toBe(1);
  });

  test("says that every package is hidden while the switch is off", async () => {
    showing([excludedPackage()]);

    const { screen } = await renderTree();

    await expect
      .element(screen.getByText("All packages are hidden.", { exact: true }))
      .toBeVisible();
    expect(
      colorOf(screen.getByText("All packages are hidden.").element()),
    ).toBe(FG_MUTED);
  });

  test("removes a value of hidden that it does not accept from the URL, in place of the URL, and keeps the anchor", async () => {
    showing(withHiddenRecords());

    const { router, screen } = await renderTree(
      "/tickets/SNTL-12?hidden=yes&view=new#packages",
    );

    expect(router.state.location.href).toBe("/tickets/SNTL-12#packages");
    expect(router.history.length).toBe(1);
    await expect.element(showHidden(screen)).not.toBeChecked();
  });
});

describe("the tracks that wait for the signed-in user", () => {
  test("show Needs your action with a bar for a maintainer, on the pending tracks that the read of their work returns", async () => {
    const spy = showing(
      [
        fictionalPackage({
          tracks: [
            fictionalTrack(),
            fictionalTrack({
              id: "00000000-0000-0000-0000-0000000000b2",
              reference: "SUSE:FLES-15-SP6:Update",
            }),
          ],
        }),
      ],
      {},
      {
        user: MAINTAINER,
        yourWork: () =>
          ticketWorkResponse([
            {
              packageName: "fictional-openssl",
              reference: "SUSE:FLES-15-SP7:Update",
            },
          ]),
      },
    );

    const { screen } = await renderTree();

    const label = packagesPart(screen).getByText("Needs your action", {
      exact: true,
    });
    await expect.element(label).toBeVisible();
    const waiting = trackOf(screen, "SUSE:FLES-15-SP7:Update");
    expect(waiting.element().contains(label.element())).toBe(true);
    const style = getComputedStyle(label.element());
    expect(style.backgroundColor).toBe(INFO_SOFT);
    expect(style.color).toBe(INFO_ON_SOFT);
    expect(style.fontSize).toBe("12px");
    expect(boxOf(label).height).toBe(20);
    const bar = getComputedStyle(waiting.element());
    expect(bar.borderLeftWidth).toBe("3px");
    expect(bar.borderLeftColor).toBe(LINK);
    const other = trackOf(screen, "SUSE:FLES-15-SP6:Update");
    expect(other.getByText("Needs your action").elements()).toHaveLength(0);
    expect(getComputedStyle(other.element()).borderLeftWidth).toBe("1px");
    expect(getComputedStyle(other.element()).borderLeftColor).toBe(BORDER);
    expect(requestsTo(spy, YOUR_WORK)).toBe(1);
  });

  test("match the pending tracks by package as well as by reference", async () => {
    showing(
      [
        fictionalPackage(),
        fictionalPackage({
          id: "00000000-0000-0000-0000-0000000000a2",
          package_name: "fictional-zlib",
          tracks: [
            fictionalTrack({ id: "00000000-0000-0000-0000-0000000000b2" }),
          ],
        }),
      ],
      {},
      {
        user: MAINTAINER,
        yourWork: () =>
          ticketWorkResponse([
            {
              packageName: "fictional-zlib",
              reference: "SUSE:FLES-15-SP7:Update",
            },
          ]),
      },
    );

    const { screen } = await renderTree();

    const label = packagesPart(screen).getByText("Needs your action");
    await expect.element(label).toBeVisible();
    expect(label.elements()).toHaveLength(1);
    expect(
      packagesPart(screen)
        .getByRole("listitem")
        .filter({
          has: page.getByRole("heading", { name: "fictional-zlib" }),
        })
        .element()
        .contains(label.element()),
    ).toBe(true);
  });

  test("are read again when the tab returns to the foreground", async () => {
    let fails = true;
    showing(
      [fictionalPackage()],
      {},
      {
        user: MAINTAINER,
        yourWork: () =>
          fails
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : ticketWorkResponse([
                {
                  packageName: "fictional-openssl",
                  reference: "SUSE:FLES-15-SP7:Update",
                },
              ]),
      },
    );
    const { screen } = await renderTree();
    await expect.element(screen.getByText(/couldn't be shown/)).toBeVisible();
    fails = false;

    await returnToForeground();

    await expect.element(screen.getByText("Needs your action")).toBeVisible();
    expect(screen.getByText(/couldn't be shown/).elements()).toHaveLength(0);
  });

  test("stay marked, saying that they couldn't be updated, when a later read of them fails, and marked as being updated while Try again reads them", async () => {
    let fails = false;
    const retried = later();
    let retrying = false;
    showing(
      [fictionalPackage()],
      {},
      {
        user: MAINTAINER,
        yourWork: () => {
          if (retrying) {
            return retried.promise;
          }
          return fails
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : ticketWorkResponse([
                {
                  packageName: "fictional-openssl",
                  reference: "SUSE:FLES-15-SP7:Update",
                },
              ]);
        },
      },
    );
    const { screen } = await renderTree();
    await expect.element(screen.getByText("Needs your action")).toBeVisible();
    fails = true;

    await returnToForeground();

    await expect
      .element(
        screen.getByText(
          "The tracks that wait for you couldn't be updated. Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    await expect.element(screen.getByText("Needs your action")).toBeVisible();
    retrying = true;

    await screen.getByRole("button", { name: "Try again" }).click();

    await expect
      .element(
        packagesPart(screen).getByRole("progressbar", { name: "Updating" }),
      )
      .toBeInTheDocument();
    await expect.element(screen.getByText("Needs your action")).toBeVisible();
    retried.resolve(ticketWorkResponse());
    await expect
      .poll(() => screen.getByText("Needs your action").elements().length)
      .toBe(0);
    expect(
      packagesPart(screen).getByRole("progressbar").elements(),
    ).toHaveLength(0);
  });

  test("mark nothing once the user no longer maintains a package that is not excluded, and are no longer read", async () => {
    let excluded = false;
    const spy = stubTicket({
      user: MAINTAINER,
      ticket: () =>
        ticketResponse(
          fictionalTicketDetail({
            packages: [
              excluded
                ? fictionalPackage({
                    deleted_at: "2099-10-10T10:00:00Z",
                    actionable: false,
                    non_actionable_reason: "package_excluded",
                    tracks: [
                      fictionalTrack({
                        actionable: false,
                        non_actionable_reason: "package_excluded",
                        ...NOT_APPLICABLE,
                      }),
                    ],
                  })
                : fictionalPackage(),
              excludedPackage(),
            ],
          }),
        ),
      yourWork: () =>
        ticketWorkResponse([
          {
            packageName: "fictional-openssl",
            reference: "SUSE:FLES-15-SP7:Update",
          },
        ]),
    });
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");
    await expect.element(screen.getByText("Needs your action")).toBeVisible();
    excluded = true;
    const before = requestsTo(spy, `${TICKETS}/SNTL-12`);

    await returnToForeground();

    await expect
      .poll(() => requestsTo(spy, `${TICKETS}/SNTL-12`))
      .toBe(before + 1);
    await expect
      .poll(() => band(screen, "fictional-openssl").textContent)
      .toContain("Excluded");
    expect(screen.getByText("Needs your action").elements()).toHaveLength(0);
    // The next return of the tab reads the Ticket, not the work any more.
    const work = requestsTo(spy, YOUR_WORK);
    const tickets = requestsTo(spy, `${TICKETS}/SNTL-12`);

    await returnToForeground();

    await expect
      .poll(() => requestsTo(spy, `${TICKETS}/SNTL-12`))
      .toBe(tickets + 1);
    expect(requestsTo(spy, YOUR_WORK)).toBe(work);
  });

  test("are not read for a user whom no package lists as a maintainer", async () => {
    const spy = showing([fictionalPackage()]);

    const { screen } = await renderTree();

    await expect
      .element(screen.getByText("SUSE:FLES-15-SP7:Update"))
      .toBeVisible();
    expect(requestsTo(spy, YOUR_WORK)).toBe(0);
  });

  test("are not read for a user who maintains only an excluded package", async () => {
    const spy = showing(
      [
        fictionalPackage({ maintainers: [] }),
        {
          ...excludedPackage(),
          maintainers: [
            {
              id: MAINTAINER.data.id,
              username: "dbrown",
              full_name: "Dave Brown",
              active: true,
              bot: false,
              avatar_url: null,
            },
          ],
        },
      ],
      {},
      { user: MAINTAINER },
    );

    const { screen } = await renderTree();

    await expect
      .element(screen.getByText("SUSE:FLES-15-SP7:Update"))
      .toBeVisible();
    expect(requestsTo(spy, YOUR_WORK)).toBe(0);
  });

  test("show no mark until the read arrives", async () => {
    const response = later();
    showing(
      [fictionalPackage()],
      {},
      {
        user: MAINTAINER,
        yourWork: () => response.promise,
      },
    );

    const { screen } = await renderTree();

    expect(screen.getByText("Needs your action").elements()).toHaveLength(0);
    response.resolve(
      ticketWorkResponse([
        {
          packageName: "fictional-openssl",
          reference: "SUSE:FLES-15-SP7:Update",
        },
      ]),
    );
    await expect.element(screen.getByText("Needs your action")).toBeVisible();
  });

  test("say above the tree that they couldn't be shown when the read fails, with Try again where the failure offers it", async () => {
    let fails = true;
    showing(
      [fictionalPackage()],
      {},
      {
        user: MAINTAINER,
        yourWork: () =>
          fails
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : ticketWorkResponse([
                {
                  packageName: "fictional-openssl",
                  reference: "SUSE:FLES-15-SP7:Update",
                },
              ]),
      },
    );

    const { screen } = await renderTree();

    const warning = screen.getByText(
      "The tracks that wait for you couldn't be shown. Sentinel isn't available right now. Try again later.",
    );
    await expect.element(warning).toBeVisible();
    expect(boxOf(warning).bottom).toBeLessThan(
      boxOf(band(screen, "fictional-openssl")).top,
    );
    // In a status region of the part that is there before it, so that
    // assistive technologies announce it.
    expect(
      packagesPart(screen)
        .getByRole("status")
        .element()
        .contains(warning.element()),
    ).toBe(true);
    // The tree stays usable.
    await expect
      .element(
        screen.getByRole("button", {
          name: "Fictional Linux Enterprise Server 15 SP7",
        }),
      )
      .toBeEnabled();

    fails = false;
    await screen.getByRole("button", { name: "Try again" }).click();

    await expect.element(screen.getByText("Needs your action")).toBeVisible();
    expect(screen.getByText(/couldn't be shown/).elements()).toHaveLength(0);
  });
});
