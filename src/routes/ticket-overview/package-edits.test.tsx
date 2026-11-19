import { describe, expect, test } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import type {
  CurrentUserResponse,
  PackageDetail,
  ProductDetail,
  TicketDetail,
  TicketStatusValue,
  TrackDetail,
} from "../../api/generated/model";
import {
  errorResponse,
  FICTIONAL_USER,
  fictionalPackage,
  fictionalProduct,
  fictionalTicketDetail,
  fictionalTrack,
  jsonResponse,
  OTHER_USER,
  requestsTo,
  stubApi,
  ticketResponse,
  urlOf,
} from "../../test-api";
import { pointerAwayFrom } from "../../test-pointer";
import {
  ACTORS,
  announcements,
  backgroundBehind,
  band,
  boxOf,
  client,
  colorOf,
  EVENTS,
  excludedTrack,
  expectFocusOnError,
  expectFocusSettledOn,
  FG,
  FG_MUTED,
  interactOutside,
  later,
  leaveForTickets,
  leftInvalidated,
  MAINTAINER,
  MESSAGE_TONES,
  nextFrames,
  NOT_APPLICABLE,
  packageMarkerResponse,
  packagesPart,
  prepareEachTest,
  productEligibilityResponse,
  productMarkerResponse,
  productOf,
  readEnded,
  readsOf,
  renderTree,
  returnToForeground,
  type Screen,
  screenHeading,
  SET_BY_HAND,
  showHidden,
  type Stub,
  stubTicket,
  TICKET,
  TICKETS,
  trackMarkerResponse,
  trackOf,
  trackStatusResponse,
  YOUR_WORK,
} from "./test-support";

// The edits of the package tree of Overview, the first tab of the Ticket
// screen (src/routes/ticket-overview/package-edits.tsx;
// docs/screens/ticket.md), and the actions of a Product, at the browser's
// default text size, in the light theme.

prepareEachTest();

// An analyst who holds manage_packages and maintains no package.
const PACKAGE_MANAGER: CurrentUserResponse = {
  data: {
    ...OTHER_USER.data,
    capabilities: ["manage_packages", "triage_ticket"],
  },
};

// An administrator, who holds admin_ticket_ops alone of the capabilities of
// the package tree.
const TICKET_ADMIN: CurrentUserResponse = {
  data: {
    ...FICTIONAL_USER.data,
    roles: ["admin"],
    capabilities: ["admin_ticket_ops"],
  },
};

const OPENSSL_ID = "00000000-0000-0000-0000-0000000000a1";
const ZLIB_ID = "00000000-0000-0000-0000-0000000000a2";
const SP7_ID = "00000000-0000-0000-0000-0000000000b1";
const FLES_ID = "00000000-0000-0000-0000-0000000000b2";
const ZLIB_TRACK_ID = "00000000-0000-0000-0000-0000000000b3";
const OPENSSL_SP7 = "fictional-openssl, SUSE:FLES-15-SP7:Update";
const OPENSSL_FLES = "fictional-openssl, fles-16.0";

// A track of fictional-openssl after its SP7 track, fles-16.0, in Analysis.
function flesTrack(fields: Partial<TrackDetail> = {}): TrackDetail {
  return fictionalTrack({
    id: FLES_ID,
    workflow_type: "git",
    reference: "fles-16.0",
    status: "analysis",
    products: [
      fictionalProduct({
        id: "00000000-0000-0000-0000-0000000000c2",
        product_cpe: "cpe:/o:example:fles:16.0",
        product_name: "Fictional Linux Enterprise Server 16.0",
      }),
    ],
    ...fields,
  });
}

// fictional-zlib, after fictional-openssl, without a maintainer.
function zlibPackage(fields: Partial<PackageDetail> = {}): PackageDetail {
  return fictionalPackage({
    id: ZLIB_ID,
    package_name: "fictional-zlib",
    maintainers: [],
    tracks: [
      fictionalTrack({
        id: ZLIB_TRACK_ID,
        reference: "SUSE:FLES-15-SP6:Update",
        products: [
          fictionalProduct({ id: "00000000-0000-0000-0000-0000000000c3" }),
        ],
      }),
    ],
    ...fields,
  });
}

// The tree of the tests: fictional-openssl with its SP7 and fles-16.0
// tracks, then fictional-zlib.
function editableTree(
  openssl: Partial<PackageDetail> = {},
  zlib: Partial<PackageDetail> = {},
): PackageDetail[] {
  return [
    fictionalPackage({ tracks: [fictionalTrack(), flesTrack()], ...openssl }),
    zlibPackage(zlib),
  ];
}

// The tree after an exclusion of the SP7 track of fictional-openssl.
function treeWithoutSp7(): PackageDetail[] {
  return editableTree({
    tracks: [
      excludedTrack({ id: SP7_ID, reference: "SUSE:FLES-15-SP7:Update" }),
      flesTrack(),
    ],
  });
}

// The tree with fictional-xz after its packages, an excluded package, so that
// "Show hidden" stays on while a test changes the records before it.
function withHiddenPackage(tree: PackageDetail[]): PackageDetail[] {
  return [
    ...tree,
    fictionalPackage({
      id: "00000000-0000-0000-0000-0000000000a9",
      package_name: "fictional-xz",
      deleted_at: "2099-10-09T10:00:00Z",
      actionable: false,
      non_actionable_reason: "package_excluded",
      maintainers: [],
      tracks: [
        fictionalTrack({
          id: "00000000-0000-0000-0000-0000000000b9",
          reference: "SUSE:FLES-15-SP5:Update",
          status: "analysis",
          actionable: false,
          non_actionable_reason: "package_excluded",
          products: [
            fictionalProduct({
              id: "00000000-0000-0000-0000-0000000000c9",
              product_cpe: "cpe:/o:example:fles:15:sp5",
              product_name: "Fictional Linux Enterprise Server 15 SP5",
              actionable: false,
              non_actionable_reason: "package_excluded",
            }),
          ],
          ...NOT_APPLICABLE,
        }),
      ],
    }),
  ];
}

// Answers Get Ticket with the package tree that the function returns at each
// read, for a user who holds manage_packages unless the test says otherwise.
function showingEditable(
  tree: () => PackageDetail[] = () => editableTree(),
  stub: Partial<Stub> = {},
  ticket: Partial<TicketDetail> = {},
) {
  return stubTicket({
    user: PACKAGE_MANAGER,
    ticket: () =>
      ticketResponse(fictionalTicketDetail({ packages: tree(), ...ticket })),
    ...stub,
  });
}

// The menu of the actions of a record, by the record that its name states.
function actionsOf(screen: Screen, record: string) {
  return packagesPart(screen).getByRole("button", {
    name: `Actions of ${record}`,
    exact: true,
  });
}

// The select of the affectedness of a track, by the track that its name
// states, whatever its value.
function affectednessOf(screen: Screen, track: string) {
  return packagesPart(screen).getByRole("button", {
    name: new RegExp(
      `^Affectedness of ${track.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: `,
    ),
  });
}

function menuOf(screen: Screen, name: string) {
  return screen.getByRole("menu", { name, exact: true });
}

// The requests of the edits of the package tree: their method and their path
// under the packages of the Ticket, with their body.
function packageChanges(
  spy: ReturnType<typeof stubApi>,
): [string, string, unknown][] {
  return spy.mock.calls
    .filter(
      ([input, init]) =>
        urlOf(input).pathname.startsWith(`${TICKET}/packages/`) &&
        init?.method !== undefined &&
        init.method !== "GET",
    )
    .map(([input, init]) => [
      init?.method ?? "GET",
      urlOf(input).pathname.slice(`${TICKET}/packages/`.length),
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    ]);
}

// Opens the menu of the actions of a record, and chooses the item.
async function chooseAction(screen: Screen, record: string, item: string) {
  await actionsOf(screen, record).click();
  await screen.getByRole("menuitem", { name: item, exact: true }).click();
}

// Opens the select of the affectedness of a track, and chooses the value.
async function chooseAffectedness(
  screen: Screen,
  track: string,
  value: string,
) {
  await affectednessOf(screen, track).click();
  await screen.getByRole("menuitemradio", { name: value, exact: true }).click();
}

// The names of the items of a menu, in their order, which a poll reads
// once the menu has opened.
function itemsOf(
  menu: Pick<Locator, "getByRole">,
  role: "menuitem" | "menuitemradio",
): (string | null)[] {
  return menu
    .getByRole(role)
    .elements()
    .map((item) => item.textContent);
}

describe("the edits of the package tree", () => {
  test("offer the menu of the actions of each package and track, an icon button of 24 px named by its record, whose tooltip says Actions, and the affectedness of each track as a select, to a user who holds manage_packages", async () => {
    showingEditable();
    const { screen } = await renderTree();

    const openssl = actionsOf(screen, "fictional-openssl");
    await expect.element(openssl).toBeVisible();
    expect(boxOf(openssl).width).toBe(24);
    expect(boxOf(openssl).height).toBe(24);
    expect(band(screen, "fictional-openssl").contains(openssl.element())).toBe(
      true,
    );
    // The menu of a track ends where the menu of its package ends: the
    // tracks keep the padding of the band on both sides.
    expect(boxOf(actionsOf(screen, OPENSSL_SP7)).right).toBe(
      boxOf(openssl).right,
    );
    await expect.element(actionsOf(screen, OPENSSL_FLES)).toBeVisible();
    await expect.element(actionsOf(screen, "fictional-zlib")).toBeVisible();
    const select = affectednessOf(screen, OPENSSL_SP7);
    await expect
      .element(select)
      .toHaveAccessibleName(`Affectedness of ${OPENSSL_SP7}: Affected`);
    await expect.element(select).toHaveTextContent("Affected");
    // The pointer away from the select, where an earlier test can leave it.
    await pointerAwayFrom(select);
    // A quiet select, without a boundary or a fill, in fg.
    const style = getComputedStyle(select.element());
    expect(style.borderTopWidth).toBe("0px");
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(style.color).toBe(FG);
    expect(boxOf(select).height).toBe(28);

    // React Aria shows a tooltip on hover only once the user works with a
    // pointer, as a click shows.
    await screenHeading(screen).click();
    await userEvent.hover(openssl);

    await expect
      .element(screen.getByRole("tooltip"))
      .toHaveTextContent("Actions");
  });

  test("open the actions of a record as a menu named by its record, with Exclude, and with Restore for a record that its own marker excludes", async () => {
    showingEditable(() =>
      editableTree(
        {},
        {
          deleted_at: "2099-10-09T10:00:00Z",
          actionable: false,
          non_actionable_reason: "package_excluded",
        },
      ),
    );
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    await actionsOf(screen, OPENSSL_SP7).click();

    const menu = menuOf(screen, `Actions of ${OPENSSL_SP7}`);
    await expect.element(menu).toBeVisible();
    await expect.poll(() => itemsOf(menu, "menuitem")).toEqual(["Exclude"]);

    await userEvent.keyboard("{Escape}");
    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(actionsOf(screen, OPENSSL_SP7)).toHaveFocus();

    await actionsOf(screen, "fictional-zlib").click();

    const zlib = menuOf(screen, "Actions of fictional-zlib");
    await expect.poll(() => itemsOf(zlib, "menuitem")).toEqual(["Restore"]);
    // A track below an excluded package keeps Exclude, which Sentinel
    // accepts there (Soft-Delete Track).
    await userEvent.keyboard("{Escape}");
    await actionsOf(screen, "fictional-zlib, SUSE:FLES-15-SP6:Update").click();
    await expect
      .element(screen.getByRole("menuitem", { name: "Exclude", exact: true }))
      .toBeVisible();
  });

  test("offer, with manage_packages on a Ticket with a CVE, every affectedness but Fixed, the current one chosen, in the order of the contract", async () => {
    showingEditable();
    const { screen } = await renderTree();

    await affectednessOf(screen, OPENSSL_SP7).click();

    const menu = menuOf(screen, `Affectedness of ${OPENSSL_SP7}: Affected`);
    await expect.element(menu).toBeVisible();
    await expect
      .poll(() => itemsOf(menu, "menuitemradio"))
      .toEqual(["Analysis", "Affected", "Not affected", "Won't fix"]);
    await expect
      .element(
        menu.getByRole("menuitemradio", { name: "Affected", exact: true }),
      )
      .toBeChecked();
    await expect
      .element(menu.getByRole("menuitemradio", { name: "Analysis" }))
      .not.toBeChecked();
  });

  test("offer Fixed with manage_packages on a Ticket without a CVE", async () => {
    showingEditable(undefined, {}, { cve: null });
    const { screen } = await renderTree();

    await affectednessOf(screen, OPENSSL_SP7).click();

    await expect
      .poll(() => itemsOf(screen, "menuitemradio"))
      .toEqual(["Analysis", "Affected", "Not affected", "Fixed", "Won't fix"]);
  });

  test("offer a user who holds admin_ticket_ops alone the select with Fixed, and no menu of actions", async () => {
    showingEditable(undefined, { user: TICKET_ADMIN });
    const { screen } = await renderTree();

    await affectednessOf(screen, OPENSSL_SP7).click();

    await expect
      .poll(() => itemsOf(screen, "menuitemradio"))
      .toEqual(["Affected", "Fixed"]);
    expect(
      packagesPart(screen)
        .getByRole("button", { name: /^Actions of/ })
        .elements(),
    ).toHaveLength(0);
  });

  test("show the affectedness as text, without a select, of a Fixed track to a user who holds admin_ticket_ops alone, who could set no other value", async () => {
    showingEditable(
      () => editableTree({ tracks: [fictionalTrack({ status: "fixed" })] }),
      { user: TICKET_ADMIN },
    );
    const { screen } = await renderTree();

    await expect
      .element(trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText("Fixed"))
      .toBeVisible();
    await expect
      .element(affectednessOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
  });

  test("offer none of these controls to a user without manage_packages and admin_ticket_ops", async () => {
    showingEditable(undefined, { user: OTHER_USER });
    const { screen } = await renderTree();

    await expect
      .element(trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText("Affected"))
      .toBeVisible();
    expect(
      packagesPart(screen)
        .getByRole("button", { name: /^(Actions|Affectedness) of/ })
        .elements(),
    ).toHaveLength(0);
  });

  test.each(["ignored", "duplicated", "fictional_status"])(
    "offer none of these controls on a Ticket in %s",
    async (status) => {
      stubTicket({
        user: PACKAGE_MANAGER,
        ticket: () =>
          jsonResponse(200, {
            data: {
              ...fictionalTicketDetail({ packages: editableTree() }),
              status,
            },
          }),
      });
      const { screen } = await renderTree();

      await expect
        .element(
          trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText("Affected"),
        )
        .toBeVisible();
      expect(
        packagesPart(screen)
          .getByRole("button", { name: /^(Actions|Affectedness) of/ })
          .elements(),
      ).toHaveLength(0);
    },
  );

  test("show an affectedness that the pinned contract does not list as received, without a select", async () => {
    stubTicket({
      user: PACKAGE_MANAGER,
      ticket: () =>
        jsonResponse(200, {
          data: {
            ...fictionalTicketDetail(),
            packages: [
              {
                ...fictionalPackage(),
                tracks: [
                  { ...fictionalTrack(), status: "fictional_affectedness" },
                ],
              },
            ],
          },
        }),
    });
    const { screen } = await renderTree();

    await expect
      .element(packagesPart(screen).getByText("fictional_affectedness"))
      .toBeVisible();
    await expect
      .element(affectednessOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expect.element(actionsOf(screen, OPENSSL_SP7)).toBeVisible();
  });

  test("exclude a track at once, with its item busy and the menu open until Sentinel answers, then close the menu, return the focus to its button, and announce the outcome once the read of the Ticket after it arrives, while Show hidden is on", async () => {
    const response = later();
    let tree = editableTree();
    const spy = showingEditable(() => withHiddenPackage(tree), {
      packageChange: () => response.promise,
    });
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");
    const reads = requestsTo(spy, TICKET);

    await chooseAction(screen, OPENSSL_SP7, "Exclude");

    const menu = menuOf(screen, `Actions of ${OPENSSL_SP7}`);
    const item = menu.getByRole("menuitem", { name: "Exclude", exact: true });
    await expect.element(item).toHaveAccessibleDescription("Excluding.");
    expect(packageChanges(spy)).toEqual([
      ["POST", `${OPENSSL_ID}/tracks/${SP7_ID}/exclude`, undefined],
    ]);
    await userEvent.keyboard("{Escape}");
    interactOutside();
    await nextFrames();
    await expect.element(menu).toBeVisible();
    await item.click();
    expect(packageChanges(spy)).toHaveLength(1);

    tree = treeWithoutSp7();
    response.resolve(trackMarkerResponse(false));

    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(actionsOf(screen, OPENSSL_SP7)).toHaveFocus();
    await expect
      .poll(() => announcements(screen))
      .toContain("Track fictional-openssl · SUSE:FLES-15-SP7:Update excluded.");
    expect(requestsTo(spy, TICKET)).toBeGreaterThan(reads);
    // The track stays, in gray, with its label.
    await expect
      .element(
        trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText("Excluded", {
          exact: true,
        }),
      )
      .toBeVisible();
    expect(
      screen
        .getByText(
          "Track fictional-openssl · SUSE:FLES-15-SP7:Update excluded.",
        )
        .elements()
        .filter((element) => element.closest("output") === null),
    ).toHaveLength(0);
  });

  test("read again after an edit the Ticket, the work of a maintainer on it, the users who acted on it, its audit log, and the reads of the Ticket list, but not its duplicates", async () => {
    const spy = showingEditable(undefined, {
      user: { data: { ...MAINTAINER.data, capabilities: ["manage_packages"] } },
    });
    const { screen } = await renderTree();
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    const reads = {
      ticket: requestsTo(spy, TICKET),
      actors: requestsTo(spy, ACTORS),
      work: requestsTo(spy, YOUR_WORK),
      duplicates: readsOf(spy, TICKETS),
    };
    // The user saw the Ticket list and Audit log before, which wait in the
    // cache.
    client.setQueryData([EVENTS], {});
    client.setQueryData([TICKETS, { page: 1 }], {});

    await chooseAffectedness(screen, OPENSSL_SP7, "Not affected");

    await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
    await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
    await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(reads.work + 1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    expect(readsOf(spy, TICKETS)).toBe(reads.duplicates);
    expect(leftInvalidated(EVENTS)).toBe(true);
    expect(leftInvalidated(TICKETS)).toBe(true);
  });

  test("show in the message area the outcome of an exclusion that hides its record while Show hidden is off, and move the focus to the menu of the next track of its package", async () => {
    let tree = editableTree();
    showingEditable(() => tree, {
      packageChange: () => {
        tree = treeWithoutSp7();
        return trackMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseAction(screen, OPENSSL_SP7, "Exclude");

    const message = screen.getByText(
      "Track fictional-openssl · SUSE:FLES-15-SP7:Update excluded.",
      { exact: true },
    );
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
    await expect
      .element(actionsOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, OPENSSL_FLES));
  });

  test("leave the focus where the user moved it before the read after an exclusion that hides its record arrives", async () => {
    let tree = editableTree();
    const read = later();
    let excluded = false;
    showingEditable(undefined, {
      ticket: () =>
        excluded
          ? read.promise
          : ticketResponse(fictionalTicketDetail({ packages: tree })),
      packageChange: () => {
        excluded = true;
        return trackMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();
    await chooseAction(screen, OPENSSL_SP7, "Exclude");
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    await expect.element(actionsOf(screen, OPENSSL_SP7)).toHaveFocus();

    // Meanwhile the user moves the focus to the menu of fictional-zlib.
    actionsOf(screen, "fictional-zlib").element().focus();
    tree = treeWithoutSp7();
    read.resolve(ticketResponse(fictionalTicketDetail({ packages: tree })));

    await expect
      .element(actionsOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, "fictional-zlib"));
  });

  test.each<[string, string, () => Response]>([
    ["a package", "fictional-openssl", () => packageMarkerResponse(false)],
    ["a track", OPENSSL_SP7, () => trackMarkerResponse(false)],
  ])(
    "leave the focus on the screen's heading after an exclusion of %s whose read after it still shows the record, as after another user restored it meanwhile",
    async (_name, record, response) => {
      const read = later();
      let excluded = false;
      showingEditable(undefined, {
        ticket: () =>
          excluded
            ? read.promise
            : ticketResponse(
                fictionalTicketDetail({ packages: editableTree() }),
              ),
        packageChange: () => {
          excluded = true;
          return response();
        },
      });
      const { screen } = await renderTree();
      await chooseAction(screen, record, "Exclude");
      await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
      await expect.element(actionsOf(screen, record)).toHaveFocus();

      // The screen's heading, from which the focus moves after an exclusion
      // that hides its record.
      screenHeading(screen).element().focus();
      read.resolve(
        ticketResponse(fictionalTicketDetail({ packages: editableTree() })),
      );

      await readEnded(TICKET);
      await expect.element(actionsOf(screen, record)).toBeVisible();
      await expectFocusSettledOn(screenHeading(screen));
    },
  );

  test("move the focus after an exclusion of the last track of a package that shows to the menu of its package", async () => {
    let tree = editableTree();
    showingEditable(() => tree, {
      packageChange: () => {
        tree = editableTree({
          tracks: [
            fictionalTrack(),
            excludedTrack({ id: FLES_ID, reference: "fles-16.0" }),
          ],
        });
        return trackMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseAction(screen, OPENSSL_FLES, "Exclude");

    await expect
      .element(actionsOf(screen, OPENSSL_FLES))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, "fictional-openssl"));
  });

  test("move the focus after an exclusion that hides a package to the menu of the next package that shows, and otherwise to Show hidden", async () => {
    let tree = editableTree();
    const hidden = {
      deleted_at: "2099-10-09T10:00:00Z",
      actionable: false,
      non_actionable_reason: "package_excluded",
    } as const;
    showingEditable(() => tree, {
      packageChange: (_method, path) => {
        tree = path.startsWith(OPENSSL_ID)
          ? editableTree(hidden)
          : editableTree(hidden, hidden);
        return packageMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseAction(screen, "fictional-openssl", "Exclude");

    await expect
      .element(actionsOf(screen, "fictional-openssl"))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, "fictional-zlib"));

    await chooseAction(screen, "fictional-zlib", "Exclude");

    await expect
      .element(packagesPart(screen).getByText("All packages are hidden."))
      .toBeVisible();
    await expectFocusSettledOn(showHidden(screen));
  });

  test("leave the focus where it is when the read of the Ticket after an exclusion fails, and let no later read move it as after the exclusion", async () => {
    let fail = false;
    let tree = editableTree();
    showingEditable(undefined, {
      ticket: () =>
        fail
          ? errorResponse(503, "FICTIONAL_UNAVAILABLE")
          : ticketResponse(fictionalTicketDetail({ packages: tree })),
      packageChange: () => {
        fail = true;
        tree = treeWithoutSp7();
        return trackMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseAction(screen, OPENSSL_SP7, "Exclude");

    await expect
      .element(screen.getByText("This couldn't be updated.", { exact: false }))
      .toBeVisible();
    await expectFocusSettledOn(actionsOf(screen, OPENSSL_SP7));

    // A later read shows the track hidden: the focus leaves its menu for the
    // screen's heading, as when any read removes it.
    fail = false;
    await returnToForeground();

    await expect
      .element(actionsOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test.each([
    ["the last hidden record", false],
    ["a hidden record while another stays hidden", true],
  ])(
    "turn Show hidden off only once no hidden record is left, in place of the URL, the focus staying on the menu of the record: after the restore of %s",
    async (_name, another) => {
      const excluded = {
        deleted_at: "2099-10-09T10:00:00Z",
        actionable: false,
        non_actionable_reason: "package_excluded",
      } as const;
      const withAnother = (tree: PackageDetail[]) =>
        another ? withHiddenPackage(tree) : tree;
      let tree = withAnother(editableTree({}, excluded));
      showingEditable(() => tree, {
        packageChange: () => {
          tree = withAnother(editableTree());
          return packageMarkerResponse(true);
        },
      });
      const { router, screen } = await renderTree(
        "/tickets/SNTL-12?hidden=shown#packages",
      );
      const entries = router.history.length;

      await chooseAction(screen, "fictional-zlib", "Restore");

      await expect
        .poll(() => announcements(screen))
        .toContain("Package fictional-zlib restored.");
      await expect
        .element(showHidden(screen))
        .toHaveAccessibleName(`Show hidden ${another ? 1 : 0}`);
      // The effects of the read, which remove hidden=shown when no hidden
      // record is left, have run.
      await nextFrames();
      if (another) {
        await expect.element(showHidden(screen)).toBeChecked();
        await expect.element(showHidden(screen)).toBeEnabled();
        expect(router.state.location.href).toBe(
          "/tickets/SNTL-12?hidden=shown#packages",
        );
      } else {
        await expect.element(showHidden(screen)).not.toBeChecked();
        await expect.element(showHidden(screen)).toBeDisabled();
        await expect
          .poll(() => router.state.location.href)
          .toBe("/tickets/SNTL-12#packages");
      }
      expect(router.history.length).toBe(entries);
      await expectFocusSettledOn(actionsOf(screen, "fictional-zlib"));
    },
  );

  test("restore a package that its own marker excludes, and announce it", async () => {
    let tree = editableTree({
      deleted_at: "2099-10-09T10:00:00Z",
      actionable: false,
      non_actionable_reason: "package_excluded",
    });
    const spy = showingEditable(() => tree, {
      packageChange: () => {
        tree = editableTree();
        return packageMarkerResponse(true);
      },
    });
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    await chooseAction(screen, "fictional-openssl", "Restore");

    expect(packageChanges(spy)).toEqual([
      ["POST", `${OPENSSL_ID}/restore`, undefined],
    ]);
    await expect
      .poll(() => announcements(screen))
      .toContain("Package fictional-openssl restored.");
    await expect.element(actionsOf(screen, "fictional-openssl")).toHaveFocus();
  });

  test("change the affectedness of a track at once, with its choice busy and the menu open until Sentinel answers, then announce the value that Sentinel returns", async () => {
    const response = later();
    const spy = showingEditable(undefined, {
      packageChange: () => response.promise,
    });
    const { screen } = await renderTree();

    await chooseAffectedness(screen, OPENSSL_SP7, "Not affected");

    const menu = menuOf(screen, `Affectedness of ${OPENSSL_SP7}: Affected`);
    await expect
      .element(menu.getByRole("menuitemradio", { name: "Not affected" }))
      .toHaveAccessibleDescription("Changing the affectedness.");
    expect(packageChanges(spy)).toEqual([
      ["PATCH", `${OPENSSL_ID}/tracks/${SP7_ID}`, { status: "not_affected" }],
    ]);
    await userEvent.keyboard("{Escape}");
    await nextFrames();
    await expect.element(menu).toBeVisible();
    await menu.getByRole("menuitemradio", { name: "Won't fix" }).click();
    expect(packageChanges(spy)).toHaveLength(1);

    response.resolve(trackStatusResponse("not_affected"));

    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(affectednessOf(screen, OPENSSL_SP7)).toHaveFocus();
    await expect
      .poll(() => announcements(screen))
      .toContain(
        "Affectedness of fictional-openssl · SUSE:FLES-15-SP7:Update changed to Not affected.",
      );
  });

  test("announce the outcome of each of two edits whose reads overlap, together, in their order", async () => {
    const reads: ReturnType<typeof later>[] = [];
    let first = true;
    showingEditable(undefined, {
      ticket: () => {
        if (first) {
          first = false;
          return ticketResponse(
            fictionalTicketDetail({ packages: editableTree() }),
          );
        }
        const read = later();
        reads.push(read);
        return read.promise;
      },
    });
    const { screen } = await renderTree();

    await chooseAffectedness(screen, OPENSSL_SP7, "Not affected");
    await expect.poll(() => reads.length).toBe(1);
    await chooseAffectedness(screen, OPENSSL_FLES, "Affected");
    await expect.poll(() => reads.length).toBe(2);
    for (const read of reads) {
      read.resolve(
        ticketResponse(fictionalTicketDetail({ packages: editableTree() })),
      );
    }

    await expect
      .poll(() => announcements(screen))
      .toContain(
        "Affectedness of fictional-openssl · SUSE:FLES-15-SP7:Update changed to Not affected. Affectedness of fictional-openssl · fles-16.0 changed to Affected.",
      );
  });

  test("send nothing when the user chooses the affectedness that the track has, and close the menu", async () => {
    const spy = showingEditable();
    const { screen } = await renderTree();

    await chooseAffectedness(screen, OPENSSL_SP7, "Affected");

    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    expect(packageChanges(spy)).toEqual([]);
  });

  test.each<[string, () => Response, string, keyof typeof MESSAGE_TONES]>([
    [
      "409 TICKET_NOT_MUTABLE",
      () => errorResponse(409, "TICKET_NOT_MUTABLE"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
    [
      "a 503",
      () => errorResponse(503, "FICTIONAL_UNAVAILABLE"),
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      "warning",
    ],
    [
      "409 PACKAGE_ALREADY_EXCLUDED, which the change of the affectedness does not handle",
      () => errorResponse(409, "PACKAGE_ALREADY_EXCLUDED"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
  ])(
    "show a failure of the change of the affectedness in the message area: %s",
    async (_name, failure, text, tone) => {
      showingEditable(undefined, { packageChange: failure });
      const { screen } = await renderTree();

      await chooseAffectedness(screen, OPENSSL_SP7, "Not affected");

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES[tone]);
      await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
      await expect.element(affectednessOf(screen, OPENSSL_SP7)).toHaveFocus();
    },
  );

  test.each<
    [string, string, string, () => Response, string, keyof typeof MESSAGE_TONES]
  >([
    [
      "409 PACKAGE_ALREADY_EXCLUDED of Exclude",
      "fictional-openssl",
      "Exclude",
      () => errorResponse(409, "PACKAGE_ALREADY_EXCLUDED"),
      "Package fictional-openssl is already excluded.",
      "info",
    ],
    [
      "422 PACKAGE_NOT_EXCLUDED of Restore",
      "fictional-zlib",
      "Restore",
      () => errorResponse(422, "PACKAGE_NOT_EXCLUDED"),
      "Package fictional-zlib is no longer excluded.",
      "info",
    ],
    [
      "409 PACKAGE_ALREADY_EXCLUDED of Restore, which Restore does not handle",
      "fictional-zlib",
      "Restore",
      () => errorResponse(409, "PACKAGE_ALREADY_EXCLUDED"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
    [
      "422 PACKAGE_NOT_EXCLUDED of Exclude, which Exclude does not handle",
      "fictional-openssl",
      "Exclude",
      () => errorResponse(422, "PACKAGE_NOT_EXCLUDED"),
      "Sentinel didn't accept this request.",
      "danger",
    ],
    [
      "a code that the pinned contract does not list",
      "fictional-openssl",
      "Exclude",
      () => errorResponse(409, "FICTIONAL_CONFLICT"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
    [
      "a 404",
      "fictional-openssl",
      "Exclude",
      () => errorResponse(404, "RESOURCE_NOT_FOUND"),
      "This no longer exists, or you no longer have access to it.",
      "danger",
    ],
    [
      "a network failure",
      "fictional-openssl",
      "Exclude",
      () => {
        throw new TypeError("Failed to fetch");
      },
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      "warning",
    ],
  ])(
    "show a failure of an exclusion or a restore in the message area: %s",
    async (_name, record, action, failure, text, tone) => {
      showingEditable(
        () =>
          editableTree(
            {},
            {
              deleted_at: "2099-10-09T10:00:00Z",
              actionable: false,
              non_actionable_reason: "package_excluded",
            },
          ),
        { packageChange: failure },
      );
      const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

      await chooseAction(screen, record, action);

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES[tone]);
      await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
      await expect.element(actionsOf(screen, record)).toHaveFocus();
    },
  );

  test("ask for confirmation before excluding a package with maintainers of a confidential Ticket, which ends their access, and send nothing on Cancel", async () => {
    const spy = showingEditable(undefined, {}, { is_confidential: true });
    const { screen } = await renderTree();

    await chooseAction(screen, "fictional-openssl", "Exclude…");

    const confirmation = screen.getByRole("dialog", {
      name: "Exclude fictional-openssl?",
    });
    await expect.element(confirmation).toBeVisible();
    await expect
      .element(
        confirmation.getByText(
          "The maintainers of fictional-openssl no longer see this confidential Ticket, unless their roles, an access grant, or another package that they maintain let them. Restore gives them this access back.",
          { exact: true },
        ),
      )
      .toBeVisible();
    await expect
      .element(confirmation.getByRole("button", { name: "Cancel" }))
      .toHaveFocus();

    await confirmation.getByRole("button", { name: "Cancel" }).click();

    await expect.element(confirmation).not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, "fictional-openssl"));
    expect(packageChanges(spy)).toEqual([]);
    // A package without maintainers, and every track, exclude at once.
    await actionsOf(screen, "fictional-zlib").click();
    await expect
      .element(screen.getByRole("menuitem", { name: "Exclude", exact: true }))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    await actionsOf(screen, OPENSSL_SP7).click();
    await expect
      .element(screen.getByRole("menuitem", { name: "Exclude", exact: true }))
      .toBeVisible();
  });

  test("exclude a package of a confidential Ticket once confirmed, with the confirmation busy until Sentinel answers, and show a failure at its top, which stays open", async () => {
    const response = later();
    let pending = false;
    const spy = showingEditable(
      undefined,
      {
        packageChange: () =>
          pending
            ? response.promise
            : errorResponse(503, "FICTIONAL_UNAVAILABLE"),
      },
      { is_confidential: true },
    );
    const { screen } = await renderTree();
    await chooseAction(screen, "fictional-openssl", "Exclude…");
    const confirmation = screen.getByRole("dialog", {
      name: "Exclude fictional-openssl?",
    });

    await confirmation.getByRole("button", { name: "Exclude package" }).click();

    const error = confirmation.getByText(
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
    );
    await expect.element(error).toBeVisible();
    await expectFocusOnError(error);

    pending = true;
    await confirmation.getByRole("button", { name: "Exclude package" }).click();

    await expect
      .element(confirmation.getByRole("button", { name: "Cancel" }))
      .toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await nextFrames();
    await expect.element(confirmation).toBeVisible();
    response.resolve(packageMarkerResponse(false));
    await expect.element(confirmation).not.toBeInTheDocument();
    expect(packageChanges(spy)).toEqual([
      ["POST", `${OPENSSL_ID}/exclude`, undefined],
      ["POST", `${OPENSSL_ID}/exclude`, undefined],
    ]);
    await expect
      .element(
        screen.getByText("Package fictional-openssl excluded.", {
          exact: true,
        }),
      )
      .toBeVisible();
  });

  test("keep the menu of the actions and the select as they were while their menu is open, after a read of the signed-in user takes manage_packages away", async () => {
    let user = PACKAGE_MANAGER;
    showingEditable(undefined, { user: () => user });
    const { screen } = await renderTree();
    await actionsOf(screen, OPENSSL_SP7).click();
    const menu = menuOf(screen, `Actions of ${OPENSSL_SP7}`);
    await expect.element(menu).toBeVisible();
    user = OTHER_USER;

    await returnToForeground();

    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    await expect
      .element(affectednessOf(screen, OPENSSL_FLES))
      .not.toBeInTheDocument();
    await expect
      .element(menu.getByRole("menuitem", { name: "Exclude" }))
      .toBeVisible();

    await userEvent.keyboard("{Escape}");

    // The menu closes with its button, which the screen no longer offers:
    // the focus moves to the screen's heading.
    await expect
      .element(actionsOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test.each(["the menu of the actions", "the select of the affectedness"])(
    "move the focus to the screen's heading when Sentinel refuses the change of %s that the screen no longer offers, after a read of the signed-in user took manage_packages away",
    async (control) => {
      let user = PACKAGE_MANAGER;
      showingEditable(undefined, {
        user: () => user,
        packageChange: () => errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION"),
      });
      const { screen } = await renderTree();
      const actions = control === "the menu of the actions";
      await (
        actions
          ? actionsOf(screen, OPENSSL_SP7)
          : affectednessOf(screen, OPENSSL_SP7)
      ).click();
      await expect.element(screen.getByRole("menu")).toBeVisible();
      user = OTHER_USER;
      await returnToForeground();
      await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);

      await (
        actions
          ? screen.getByRole("menuitem", { name: "Exclude", exact: true })
          : screen.getByRole("menuitemradio", { name: "Not affected" })
      ).click();

      await expect
        .element(screen.getByText("You don't have permission to do this."))
        .toBeVisible();
      await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
      await expectFocusSettledOn(screenHeading(screen));
    },
  );

  test("keep the values that the select of the affectedness offered as it opened, after a read of the signed-in user takes manage_packages away", async () => {
    let user = PACKAGE_MANAGER;
    showingEditable(undefined, { user: () => user });
    const { screen } = await renderTree();
    await affectednessOf(screen, OPENSSL_SP7).click();
    const menu = menuOf(screen, `Affectedness of ${OPENSSL_SP7}: Affected`);
    await expect.element(menu).toBeVisible();
    user = OTHER_USER;

    await returnToForeground();

    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    await expect
      .element(affectednessOf(screen, OPENSSL_FLES))
      .not.toBeInTheDocument();
    await expect
      .poll(() => itemsOf(menu, "menuitemradio"))
      .toEqual(["Analysis", "Affected", "Not affected", "Won't fix"]);

    await userEvent.keyboard("{Escape}");

    // The menu closes with its select, which the screen no longer offers:
    // the focus moves to the screen's heading.
    await expect
      .element(affectednessOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("show the outcome of an edit that ends after the user left the screen in the message area, naming the Ticket", async () => {
    const response = later();
    showingEditable(undefined, { packageChange: () => response.promise });
    const { router, screen } = await renderTree();
    await chooseAction(screen, OPENSSL_SP7, "Exclude");

    await leaveForTickets(router, screen);
    response.resolve(trackMarkerResponse(false));

    await expect
      .element(
        screen.getByText(
          "SNTL-12: Track fictional-openssl · SUSE:FLES-15-SP7:Update excluded.",
          { exact: true },
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "SNTL-12", exact: true }))
      .toHaveAttribute("href", "/tickets/SNTL-12");
  });

  test("keep the select of a hidden track in its own colors", async () => {
    showingEditable(() => treeWithoutSp7());
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    const select = affectednessOf(screen, OPENSSL_SP7);
    await expect.element(select).toBeVisible();
    expect(
      colorOf(
        trackOf(screen, "SUSE:FLES-15-SP7:Update")
          .getByText("SUSE:FLES-15-SP7:Update")
          .element(),
      ),
    ).toBe(FG_MUTED);
    expect(colorOf(select.element())).toBe(FG);
    // The menu of its actions keeps its color too.
    expect(colorOf(actionsOf(screen, OPENSSL_SP7).element())).toBe(FG);
  });

  test("move the focus to the screen's heading when the select leaves the page after a change that leaves the user no other value, as Fixed for a user who holds admin_ticket_ops alone", async () => {
    let tree = editableTree();
    showingEditable(() => tree, {
      user: TICKET_ADMIN,
      packageChange: () => {
        tree = editableTree({
          tracks: [fictionalTrack({ status: "fixed" }), flesTrack()],
        });
        return trackStatusResponse("fixed");
      },
    });
    const { screen } = await renderTree();

    await chooseAffectedness(screen, OPENSSL_SP7, "Fixed");

    await expect
      .element(affectednessOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expect
      .element(trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText("Fixed"))
      .toBeVisible();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("move the focus to the screen's heading when a read removes the menu of the actions of a record that holds it", async () => {
    let status: TicketStatusValue = "analyzed";
    stubTicket({
      user: PACKAGE_MANAGER,
      ticket: () =>
        ticketResponse(
          fictionalTicketDetail({ packages: editableTree(), status }),
        ),
    });
    const { screen } = await renderTree();
    actionsOf(screen, OPENSSL_SP7).element().focus();
    await expect.element(actionsOf(screen, OPENSSL_SP7)).toHaveFocus();
    // Meanwhile another analyst ignored the Ticket.
    status = "ignored";

    await returnToForeground();

    await expect
      .element(actionsOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("move the focus after an exclusion of a track that hides its package to the menu of the next package that shows", async () => {
    const hiddenPackage = {
      actionable: false,
      non_actionable_reason: "no_actionable_tracks",
    } as const;
    let tree = editableTree({ tracks: [fictionalTrack()] });
    showingEditable(() => tree, {
      packageChange: () => {
        tree = editableTree({
          ...hiddenPackage,
          tracks: [
            excludedTrack({ id: SP7_ID, reference: "SUSE:FLES-15-SP7:Update" }),
          ],
        });
        return trackMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseAction(screen, OPENSSL_SP7, "Exclude");

    await expect
      .element(actionsOf(screen, "fictional-openssl"))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, "fictional-zlib"));
  });

  test("move the focus after a confirmed exclusion that hides a package to the menu of the next package that shows", async () => {
    let tree = editableTree();
    showingEditable(
      () => tree,
      {
        packageChange: () => {
          tree = editableTree({
            deleted_at: "2099-10-09T10:00:00Z",
            actionable: false,
            non_actionable_reason: "package_excluded",
          });
          return packageMarkerResponse(false);
        },
      },
      { is_confidential: true },
    );
    const { screen } = await renderTree();
    await chooseAction(screen, "fictional-openssl", "Exclude…");

    await screen
      .getByRole("dialog", { name: "Exclude fictional-openssl?" })
      .getByRole("button", { name: "Exclude package" })
      .click();

    await expect
      .element(actionsOf(screen, "fictional-openssl"))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, "fictional-zlib"));
  });

  test("close the confirmation and say in the message area that the package is already excluded after 409 PACKAGE_ALREADY_EXCLUDED", async () => {
    showingEditable(
      undefined,
      { packageChange: () => errorResponse(409, "PACKAGE_ALREADY_EXCLUDED") },
      { is_confidential: true },
    );
    const { screen } = await renderTree();
    await chooseAction(screen, "fictional-openssl", "Exclude…");
    const confirmation = screen.getByRole("dialog", {
      name: "Exclude fictional-openssl?",
    });

    await confirmation.getByRole("button", { name: "Exclude package" }).click();

    await expect.element(confirmation).not.toBeInTheDocument();
    const message = screen.getByText(
      "Package fictional-openssl is already excluded.",
      { exact: true },
    );
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.info);
  });

  test.each(["ignored", "duplicated", "fictional_status"])(
    "offer a user who holds admin_ticket_ops alone no select on a Ticket in %s",
    async (status) => {
      stubTicket({
        user: TICKET_ADMIN,
        ticket: () =>
          jsonResponse(200, {
            data: {
              ...fictionalTicketDetail({ packages: editableTree() }),
              status,
            },
          }),
      });
      const { screen } = await renderTree();

      await expect
        .element(
          trackOf(screen, "SUSE:FLES-15-SP7:Update").getByText("Affected"),
        )
        .toBeVisible();
      await expect
        .element(affectednessOf(screen, OPENSSL_SP7))
        .not.toBeInTheDocument();
    },
  );

  test("announce an affectedness that Sentinel returns and that the pinned contract does not list as received", async () => {
    showingEditable(undefined, {
      packageChange: () => trackStatusResponse("fictional_affectedness"),
    });
    const { screen } = await renderTree();

    await chooseAffectedness(screen, OPENSSL_SP7, "Not affected");

    await expect
      .poll(() => announcements(screen))
      .toContain(
        "Affectedness of fictional-openssl · SUSE:FLES-15-SP7:Update changed to fictional_affectedness.",
      );
  });

  test("line up the selects of the affectedness and the pipelines of the tracks for a user who sets the affectedness, whatever the width of each value", async () => {
    showingEditable(() =>
      editableTree({
        tracks: [fictionalTrack({ status: "fixed" }), flesTrack()],
      }),
    );
    const { screen } = await renderTree();

    const fixed = affectednessOf(screen, OPENSSL_SP7);
    const analysis = affectednessOf(screen, OPENSSL_FLES);
    await expect.element(fixed).toBeVisible();
    expect(boxOf(fixed).width).toBeLessThan(boxOf(analysis).width);
    expect(boxOf(fixed).left).toBe(boxOf(analysis).left);
    const pipelines = packagesPart(screen)
      .getByRole("button", { name: /^Phases of fictional-openssl/ })
      .elements();
    expect(pipelines).toHaveLength(2);
    expect(boxOf(pipelines[0]!).right).toBe(boxOf(pipelines[1]!).right);
    // The place of the select is at least as wide as the select of Not
    // affected: 136 px.
    expect(
      boxOf(actionsOf(screen, OPENSSL_SP7)).left - boxOf(fixed).left,
    ).toBeGreaterThanOrEqual(136);
  });

  test("show in the message area the outcome of an exclusion whose read after it replaces the screen, as the 404 of a Ticket that the exclusion hid from the user", async () => {
    let hidden = false;
    showingEditable(undefined, {
      ticket: () =>
        hidden
          ? errorResponse(404, "TICKET_NOT_FOUND")
          : ticketResponse(
              fictionalTicketDetail({
                packages: editableTree(),
                is_confidential: true,
              }),
            ),
      packageChange: () => {
        hidden = true;
        return packageMarkerResponse(false);
      },
    });
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");
    await chooseAction(screen, "fictional-openssl", "Exclude…");

    await screen
      .getByRole("dialog", { name: "Exclude fictional-openssl?" })
      .getByRole("button", { name: "Exclude package" })
      .click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    await expect
      .element(
        screen.getByText("Package fictional-openssl excluded.", {
          exact: true,
        }),
      )
      .toBeVisible();
  });
});

const SP7_PRODUCT = "Fictional Linux Enterprise Server 15 SP7";
const SP7_PRODUCT_ID = "00000000-0000-0000-0000-0000000000c1";
const DESKTOP_PRODUCT = "Fictional Linux Enterprise Desktop 15 SP7";
const DESKTOP_PRODUCT_ID = "00000000-0000-0000-0000-0000000000c6";
const SP7_SUBJECT = `Product ${SP7_PRODUCT} of fictional-openssl · SUSE:FLES-15-SP7:Update`;
const SP7_PRODUCT_PATH = `${OPENSSL_ID}/tracks/${SP7_ID}/products/${SP7_PRODUCT_ID}`;

// A second Product of the SP7 track of fictional-openssl, after its Server
// 15 SP7.
function desktopProduct(fields: Partial<ProductDetail> = {}): ProductDetail {
  return fictionalProduct({
    id: DESKTOP_PRODUCT_ID,
    product_cpe: "cpe:/o:example:fled:15:sp7",
    product_name: DESKTOP_PRODUCT,
    ...fields,
  });
}

// The tree of the tests of the actions of a Product: fictional-openssl,
// whose SP7 track holds the Products, Server 15 SP7 with the fields and
// then those that follow it, and its fles-16.0 track, then fictional-zlib,
// whose Product is Server 15 SP6, so that the name of each Product is its
// own.
function productTree(
  product: Partial<ProductDetail> = {},
  following: ProductDetail[] = [],
  track: Partial<TrackDetail> = {},
): PackageDetail[] {
  return editableTree(
    {
      tracks: [
        fictionalTrack({
          products: [fictionalProduct(product), ...following],
          ...track,
        }),
        flesTrack(),
      ],
    },
    {
      tracks: [
        fictionalTrack({
          id: ZLIB_TRACK_ID,
          reference: "SUSE:FLES-15-SP6:Update",
          products: [
            fictionalProduct({
              id: "00000000-0000-0000-0000-0000000000c3",
              product_cpe: "cpe:/o:example:fles:15:sp6",
              product_name: "Fictional Linux Enterprise Server 15 SP6",
            }),
          ],
        }),
      ],
    },
  );
}

// The tree after an exclusion of Server 15 SP7, the only Product of its
// track, which hides the track.
function treeWithoutSp7Product(): PackageDetail[] {
  return productTree(
    {
      deleted_at: "2099-10-10T10:00:00Z",
      actionable: false,
      non_actionable_reason: "product_excluded",
    },
    [],
    { actionable: false, non_actionable_reason: "no_actionable_products" },
  );
}

function productName(screen: Screen, name: string) {
  return packagesPart(screen).getByRole("button", { name, exact: true });
}

function productPopover(screen: Screen, name: string) {
  return screen.getByRole("dialog", { name, exact: true });
}

// Opens the details of a Product, and returns its popover once it holds the
// focus.
async function openProduct(screen: Screen, name: string) {
  await productName(screen, name).click();
  const popover = productPopover(screen, name);
  await expect.element(popover).toHaveFocus();
  return popover;
}

// Opens the details of a Product, and chooses the action.
async function chooseProductAction(
  screen: Screen,
  name: string,
  action: string,
) {
  const popover = await openProduct(screen, name);
  await popover.getByRole("menuitem", { name: action, exact: true }).click();
  return popover;
}

describe("the actions of a Product", () => {
  test("follow its details in its popover, for a user who holds manage_packages: Mark as not eligible and Exclude from this track for an eligible Product whose eligibility is automatic", async () => {
    showingEditable(() => productTree());
    const { screen } = await renderTree();

    const popover = await openProduct(screen, SP7_PRODUCT);

    const menu = popover.getByRole("menu", { name: "Actions", exact: true });
    await expect.element(menu).toBeVisible();
    await expect
      .poll(() => itemsOf(menu, "menuitem"))
      .toEqual(["Mark as not eligible", "Exclude from this track"]);
  });

  test("offer Mark as eligible, Return to automatic eligibility, and Restore for a Product set by hand to not eligible that its own marker excludes", async () => {
    showingEditable(() =>
      productTree({
        ...SET_BY_HAND,
        deleted_at: "2099-10-10T10:00:00Z",
        actionable: false,
        non_actionable_reason: "product_excluded",
      }),
    );
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    const popover = await openProduct(screen, SP7_PRODUCT);

    await expect
      .poll(() => itemsOf(popover, "menuitem"))
      .toEqual([
        "Mark as eligible",
        "Return to automatic eligibility",
        "Restore",
      ]);
  });

  test("offer Exclude from this track on a Product that its track hides, which Sentinel accepts there", async () => {
    showingEditable(() => treeWithoutSp7());
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    const popover = await openProduct(
      screen,
      "Fictional Linux Enterprise Server 15 SP6",
    );

    await expect
      .poll(() => itemsOf(popover, "menuitem"))
      .toEqual(["Mark as not eligible", "Exclude from this track"]);
  });

  test.each<[string, Partial<Stub>, Partial<TicketDetail>]>([
    ["to a user without manage_packages", { user: OTHER_USER }, {}],
    ["to a user who holds admin_ticket_ops alone", { user: TICKET_ADMIN }, {}],
  ])("offer no action %s", async (_name, stub) => {
    showingEditable(() => productTree(), stub);
    const { screen } = await renderTree();

    const popover = await openProduct(screen, SP7_PRODUCT);

    await expect
      .element(popover.getByRole("definition").first())
      .toHaveTextContent("Eligible");
    expect(popover.getByRole("menu").query()).toBeNull();
    expect(popover.getByRole("separator").elements()).toHaveLength(1);
  });

  test.each(["ignored", "duplicated", "fictional_status"])(
    "offer no action on a Ticket in %s",
    async (status) => {
      stubTicket({
        user: PACKAGE_MANAGER,
        ticket: () =>
          jsonResponse(200, {
            data: {
              ...fictionalTicketDetail({ packages: productTree() }),
              status,
            },
          }),
      });
      const { screen } = await renderTree();

      const popover = await openProduct(screen, SP7_PRODUCT);

      expect(popover.getByRole("menu").query()).toBeNull();
    },
  );

  test.each<[string, Partial<ProductDetail>, string, boolean | null, string]>([
    [
      "Mark as not eligible",
      {},
      "Mark as not eligible",
      false,
      `${SP7_SUBJECT} marked as not eligible.`,
    ],
    [
      "Mark as eligible",
      { eligible: false },
      "Mark as eligible",
      true,
      `${SP7_SUBJECT} marked as eligible.`,
    ],
    [
      "Return to automatic eligibility",
      SET_BY_HAND,
      "Return to automatic eligibility",
      null,
      `${SP7_SUBJECT} returned to automatic eligibility, eligible.`,
    ],
  ])(
    "send %s as the eligibility, and announce what Sentinel returns once the read of the Ticket after it arrives",
    async (_name, product, action, eligible, text) => {
      const spy = showingEditable(() => productTree(product));
      const { screen } = await renderTree();
      const reads = requestsTo(spy, TICKET);

      await chooseProductAction(screen, SP7_PRODUCT, action);

      await expect
        .element(productPopover(screen, SP7_PRODUCT))
        .not.toBeInTheDocument();
      expect(packageChanges(spy)).toEqual([
        ["PATCH", SP7_PRODUCT_PATH, { eligible }],
      ]);
      await expect.poll(() => announcements(screen)).toContain(text);
      expect(requestsTo(spy, TICKET)).toBeGreaterThan(reads);
      await expectFocusSettledOn(productName(screen, SP7_PRODUCT));
      // The Product shows where the user acted: the outcome is only
      // announced.
      expect(
        screen
          .getByText(text)
          .elements()
          .filter((element) => element.closest("output") === null),
      ).toHaveLength(0);
    },
  );

  test("keep the popover open, its item busy and the others inert, until Sentinel answers, and then close it with the focus on the name", async () => {
    const response = later();
    let tree = productTree();
    const spy = showingEditable(() => tree, {
      packageChange: () => response.promise,
    });
    const { screen } = await renderTree();

    const popover = await chooseProductAction(
      screen,
      SP7_PRODUCT,
      "Mark as not eligible",
    );

    const item = popover.getByRole("menuitem", {
      name: "Mark as not eligible",
      exact: true,
    });
    await expect
      .element(item)
      .toHaveAccessibleDescription("Marking as not eligible.");
    await userEvent.keyboard("{Escape}");
    interactOutside();
    await nextFrames();
    await expect.element(popover).toBeVisible();
    await popover
      .getByRole("menuitem", { name: "Exclude from this track" })
      .click();
    await item.click();
    expect(packageChanges(spy)).toHaveLength(1);

    // Meanwhile a read shows the Product not eligible, as another user set
    // it: the busy item stays as it started.
    tree = productTree(SET_BY_HAND);
    await returnToForeground();
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    await expect
      .element(productOf(screen, SP7_PRODUCT).getByText("Not eligible"))
      .toBeVisible();
    expect(
      popover
        .getByRole("menuitem", { name: "Mark as eligible", exact: true })
        .query(),
    ).toBeNull();
    await expect
      .element(item)
      .toHaveAccessibleDescription("Marking as not eligible.");

    response.resolve(productEligibilityResponse(false));

    await expect.element(popover).not.toBeInTheDocument();
    await expectFocusSettledOn(productName(screen, SP7_PRODUCT));
  });

  test.each<[string, Partial<ProductDetail>, string]>([
    ["Mark as eligible", { eligible: false }, "Marking as eligible."],
    ["Mark as not eligible", {}, "Marking as not eligible."],
    [
      "Return to automatic eligibility",
      SET_BY_HAND,
      "Returning to automatic eligibility.",
    ],
    ["Exclude from this track", {}, "Excluding."],
    [
      "Restore",
      {
        deleted_at: "2099-10-10T10:00:00Z",
        actionable: false,
        non_actionable_reason: "product_excluded",
      },
      "Restoring.",
    ],
  ])(
    "describe %s while it is in progress, on its item alone",
    async (action, product, description) => {
      const response = later();
      showingEditable(() => productTree(product), {
        packageChange: () => response.promise,
      });
      const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

      const popover = await chooseProductAction(screen, SP7_PRODUCT, action);

      await expect
        .element(popover.getByRole("menuitem", { name: action, exact: true }))
        .toHaveAccessibleDescription(description);
      expect(
        popover
          .getByRole("menuitem")
          .elements()
          .filter((item) => item.textContent?.endsWith(".")),
      ).toHaveLength(1);
      response.resolve(
        action === "Exclude from this track" || action === "Restore"
          ? productMarkerResponse(action === "Restore")
          : productEligibilityResponse(action === "Mark as eligible"),
      );
      await expect.element(popover).not.toBeInTheDocument();
    },
  );

  test("follow the Product as a read shows it while the popover is open, the focus staying on the item whose action changes", async () => {
    let tree = productTree();
    showingEditable(() => withHiddenPackage(tree));
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");
    const popover = await openProduct(screen, SP7_PRODUCT);
    await userEvent.keyboard("{Tab}{ArrowDown}");
    const exclude = popover.getByRole("menuitem", {
      name: "Exclude from this track",
    });
    await expect.element(exclude).toHaveFocus();
    // Meanwhile another user excludes the Product.
    tree = productTree({
      deleted_at: "2099-10-10T10:00:00Z",
      actionable: false,
      non_actionable_reason: "product_excluded",
    });

    await returnToForeground();

    const restore = popover.getByRole("menuitem", {
      name: "Restore",
      exact: true,
    });
    await expect.element(restore).toHaveFocus();
    await expect
      .poll(() => itemsOf(popover, "menuitem"))
      .toEqual(["Mark as not eligible", "Restore"]);

    await userEvent.keyboard("{ArrowUp}");
    await expect
      .element(popover.getByRole("menuitem", { name: "Mark as not eligible" }))
      .toHaveFocus();
    // Meanwhile another user sets the Product as not eligible.
    tree = productTree({
      ...SET_BY_HAND,
      deleted_at: "2099-10-10T10:00:00Z",
      actionable: false,
      non_actionable_reason: "product_excluded",
    });

    await returnToForeground();

    await expect
      .element(
        popover.getByRole("menuitem", {
          name: "Mark as eligible",
          exact: true,
        }),
      )
      .toHaveFocus();
    await expect
      .poll(() => itemsOf(popover, "menuitem"))
      .toEqual([
        "Mark as eligible",
        "Return to automatic eligibility",
        "Restore",
      ]);
  });

  test("leave the focus on the menu, the one stop of Tab of its items, when a read removes the item that holds it", async () => {
    let tree = productTree(SET_BY_HAND);
    showingEditable(() => tree);
    const { screen } = await renderTree();
    const popover = await openProduct(screen, SP7_PRODUCT);
    await userEvent.keyboard("{Tab}{ArrowDown}");
    await expect
      .element(
        popover.getByRole("menuitem", {
          name: "Return to automatic eligibility",
        }),
      )
      .toHaveFocus();
    // Meanwhile another user returns the Product to automatic eligibility.
    tree = productTree();

    await returnToForeground();

    await expect
      .poll(() => itemsOf(popover, "menuitem"))
      .toEqual(["Mark as not eligible", "Exclude from this track"]);
    const menu = popover.getByRole("menu", { name: "Actions", exact: true });
    await expectFocusSettledOn(menu);
    await expect.element(popover).toBeVisible();
    // The focus ring shows inside the menu.
    const ring = getComputedStyle(menu.element());
    expect([ring.outlineStyle, ring.outlineWidth]).toEqual(["solid", "2px"]);

    await userEvent.keyboard("{ArrowDown}");

    await expect
      .poll(
        () =>
          menu.element().contains(document.activeElement) &&
          document.activeElement?.getAttribute("role") === "menuitem",
      )
      .toBe(true);
  });

  test("keep the actions that the popover offered as it opened, after a read of the signed-in user takes manage_packages away", async () => {
    let user = PACKAGE_MANAGER;
    showingEditable(() => productTree(), { user: () => user });
    const { screen } = await renderTree();
    const popover = await openProduct(screen, SP7_PRODUCT);
    user = OTHER_USER;

    await returnToForeground();

    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    await expect
      .element(actionsOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expect
      .poll(() => itemsOf(popover, "menuitem"))
      .toEqual(["Mark as not eligible", "Exclude from this track"]);

    await userEvent.keyboard("{Escape}");
    await productName(screen, SP7_PRODUCT).click();

    await expect.element(productPopover(screen, SP7_PRODUCT)).toHaveFocus();
    expect(productPopover(screen, SP7_PRODUCT).getByRole("menu").query()).toBe(
      null,
    );
  });

  test("show in the message area the outcome of an exclusion that hides the Product while Show hidden is off, and move the focus to the name of the next Product of its track", async () => {
    let tree = productTree({}, [desktopProduct()]);
    const spy = showingEditable(() => tree, {
      packageChange: () => {
        tree = productTree(
          {
            deleted_at: "2099-10-10T10:00:00Z",
            actionable: false,
            non_actionable_reason: "product_excluded",
          },
          [desktopProduct()],
        );
        return productMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseProductAction(screen, SP7_PRODUCT, "Exclude from this track");

    expect(packageChanges(spy)).toEqual([
      ["POST", `${SP7_PRODUCT_PATH}/exclude`, undefined],
    ]);
    const message = screen.getByText(`${SP7_SUBJECT} excluded.`, {
      exact: true,
    });
    await expect.element(message).toBeVisible();
    expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
    await expect
      .element(productName(screen, SP7_PRODUCT))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(productName(screen, DESKTOP_PRODUCT));
  });

  test("move the focus after an exclusion of the last Product of a track that still shows to the menu of the actions of its track", async () => {
    let tree = productTree({}, [desktopProduct()]);
    showingEditable(() => tree, {
      packageChange: () => {
        tree = productTree({}, [
          desktopProduct({
            deleted_at: "2099-10-10T10:00:00Z",
            actionable: false,
            non_actionable_reason: "product_excluded",
          }),
        ]);
        return productMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseProductAction(
      screen,
      DESKTOP_PRODUCT,
      "Exclude from this track",
    );

    await expect
      .element(productName(screen, DESKTOP_PRODUCT))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, OPENSSL_SP7));
  });

  test("move the focus after an exclusion that hides the track of the Product as after the exclusion of the track: to the menu of the next track of its package", async () => {
    let tree = productTree();
    showingEditable(() => tree, {
      packageChange: () => {
        tree = treeWithoutSp7Product();
        return productMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseProductAction(screen, SP7_PRODUCT, "Exclude from this track");

    await expect
      .element(actionsOf(screen, OPENSSL_SP7))
      .not.toBeInTheDocument();
    await expectFocusSettledOn(actionsOf(screen, OPENSSL_FLES));
  });

  test("move the focus to Show hidden after an exclusion that hides the only package of the Product, as after the exclusion of the package", async () => {
    const hiddenProduct = {
      deleted_at: "2099-10-10T10:00:00Z",
      actionable: false,
      non_actionable_reason: "product_excluded",
    } as const;
    const hiddenTrack = {
      actionable: false,
      non_actionable_reason: "no_actionable_products",
    } as const;
    const onlyPackage = (product: Partial<ProductDetail>, hidden: boolean) => [
      fictionalPackage({
        ...(hidden
          ? { actionable: false, non_actionable_reason: "no_actionable_tracks" }
          : {}),
        tracks: [
          fictionalTrack({
            products: [fictionalProduct(product)],
            ...(hidden ? hiddenTrack : {}),
          }),
        ],
      }),
    ];
    let tree = onlyPackage({}, false);
    showingEditable(() => tree, {
      packageChange: () => {
        tree = onlyPackage(hiddenProduct, true);
        return productMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();

    await chooseProductAction(screen, SP7_PRODUCT, "Exclude from this track");

    await expect
      .element(packagesPart(screen).getByText("All packages are hidden."))
      .toBeVisible();
    await expectFocusSettledOn(showHidden(screen));
  });

  test("leave the focus on the screen's heading after an exclusion of the Product whose read after it still shows the Product, as after another user restored it meanwhile", async () => {
    const read = later();
    let excluded = false;
    showingEditable(undefined, {
      ticket: () =>
        excluded
          ? read.promise
          : ticketResponse(
              fictionalTicketDetail({
                packages: productTree({}, [desktopProduct()]),
              }),
            ),
      packageChange: () => {
        excluded = true;
        return productMarkerResponse(false);
      },
    });
    const { screen } = await renderTree();
    await chooseProductAction(screen, SP7_PRODUCT, "Exclude from this track");
    await expect
      .element(productPopover(screen, SP7_PRODUCT))
      .not.toBeInTheDocument();
    await expect.element(productName(screen, SP7_PRODUCT)).toHaveFocus();

    // The screen's heading, from which the focus moves after an exclusion
    // that hides its record.
    screenHeading(screen).element().focus();
    read.resolve(
      ticketResponse(
        fictionalTicketDetail({
          packages: productTree({}, [desktopProduct()]),
        }),
      ),
    );

    await readEnded(TICKET);
    await expect.element(productName(screen, SP7_PRODUCT)).toBeVisible();
    await expectFocusSettledOn(screenHeading(screen));
  });

  test("keep the Product after an exclusion while Show hidden is on, in gray with its label, with the focus on its name, and announce the outcome", async () => {
    let tree = productTree({}, [desktopProduct()]);
    showingEditable(() => withHiddenPackage(tree), {
      packageChange: () => {
        tree = productTree(
          {
            deleted_at: "2099-10-10T10:00:00Z",
            actionable: false,
            non_actionable_reason: "product_excluded",
          },
          [desktopProduct()],
        );
        return productMarkerResponse(false);
      },
    });
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    await chooseProductAction(screen, SP7_PRODUCT, "Exclude from this track");

    await expect
      .poll(() => announcements(screen))
      .toContain(`${SP7_SUBJECT} excluded.`);
    await expect
      .element(
        productOf(screen, SP7_PRODUCT).getByText("Excluded", { exact: true }),
      )
      .toBeVisible();
    expect(colorOf(productName(screen, SP7_PRODUCT).element())).toBe(FG_MUTED);
    await expectFocusSettledOn(productName(screen, SP7_PRODUCT));
  });

  test("restore a Product that its own marker excludes, and announce it", async () => {
    let tree = productTree({
      deleted_at: "2099-10-10T10:00:00Z",
      actionable: false,
      non_actionable_reason: "product_excluded",
    });
    const spy = showingEditable(() => tree, {
      packageChange: () => {
        tree = productTree();
        return productMarkerResponse(true);
      },
    });
    const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

    await chooseProductAction(screen, SP7_PRODUCT, "Restore");

    expect(packageChanges(spy)).toEqual([
      ["POST", `${SP7_PRODUCT_PATH}/restore`, undefined],
    ]);
    await expect
      .poll(() => announcements(screen))
      .toContain(`${SP7_SUBJECT} restored.`);
    await expectFocusSettledOn(productName(screen, SP7_PRODUCT));
  });

  test.each<
    [
      string,
      Partial<ProductDetail>,
      string,
      () => Response,
      string,
      keyof typeof MESSAGE_TONES,
    ]
  >([
    [
      "409 TICKET_NOT_MUTABLE of Mark as not eligible",
      {},
      "Mark as not eligible",
      () => errorResponse(409, "TICKET_NOT_MUTABLE"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
    [
      "a 503 of Return to automatic eligibility",
      SET_BY_HAND,
      "Return to automatic eligibility",
      () => errorResponse(503, "FICTIONAL_UNAVAILABLE"),
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      "warning",
    ],
    [
      "409 PACKAGE_ALREADY_EXCLUDED of Mark as not eligible, which it does not handle",
      {},
      "Mark as not eligible",
      () => errorResponse(409, "PACKAGE_ALREADY_EXCLUDED"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
    [
      "409 PACKAGE_ALREADY_EXCLUDED of Exclude from this track",
      {},
      "Exclude from this track",
      () => errorResponse(409, "PACKAGE_ALREADY_EXCLUDED"),
      `${SP7_SUBJECT} is already excluded.`,
      "info",
    ],
    [
      "422 PACKAGE_NOT_EXCLUDED of Restore",
      {
        deleted_at: "2099-10-10T10:00:00Z",
        actionable: false,
        non_actionable_reason: "product_excluded",
      },
      "Restore",
      () => errorResponse(422, "PACKAGE_NOT_EXCLUDED"),
      `${SP7_SUBJECT} is no longer excluded.`,
      "info",
    ],
    [
      "a code that the pinned contract does not list",
      {},
      "Exclude from this track",
      () => errorResponse(409, "FICTIONAL_CONFLICT"),
      "This can't be done in the current state, which may have changed. Check it and try again.",
      "danger",
    ],
    [
      "a network failure",
      {},
      "Exclude from this track",
      () => {
        throw new TypeError("Failed to fetch");
      },
      "Sentinel didn't confirm this change. It may have taken effect: check before trying again.",
      "warning",
    ],
  ])(
    "show a failure of an action of a Product in the message area, and close its popover with the focus on the name: %s",
    async (_name, product, action, failure, text, tone) => {
      showingEditable(() => productTree(product), { packageChange: failure });
      const { screen } = await renderTree("/tickets/SNTL-12?hidden=shown");

      const popover = await chooseProductAction(screen, SP7_PRODUCT, action);

      const message = screen.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES[tone]);
      await expect.element(popover).not.toBeInTheDocument();
      await expectFocusSettledOn(productName(screen, SP7_PRODUCT));
    },
  );

  test("show the outcome of an action that ends after the user left the screen in the message area, naming the Ticket", async () => {
    const response = later();
    showingEditable(() => productTree(), {
      packageChange: () => response.promise,
    });
    const { router, screen } = await renderTree();
    await chooseProductAction(screen, SP7_PRODUCT, "Mark as not eligible");

    await leaveForTickets(router, screen);
    response.resolve(productEligibilityResponse(false));

    await expect
      .element(
        screen.getByText(`SNTL-12: ${SP7_SUBJECT} marked as not eligible.`, {
          exact: true,
        }),
      )
      .toBeVisible();
  });
});
