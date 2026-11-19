import {
  CircleQuestionMark,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  type LucideIcon,
} from "lucide-react";
import { describe, expect, test } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../../styles.css";
import type {
  IBSRequestStateValue,
  SubmissionRequestItem,
  TicketDetail,
  TrackDetail,
} from "../../api/generated/model";
import {
  errorResponse,
  fictionalPackage,
  fictionalReleaseRequest,
  fictionalSubmissionRequest,
  fictionalTrack,
  jsonResponse,
  releaseRequestsResponse,
  requestsTo,
  stubApi,
  submissionRequestsResponse,
  urlOf,
} from "../../test-api";
import { screenshot } from "../../test-screenshot";
import {
  boxOf,
  colorOf,
  DANGER_ICON,
  distance,
  FG_MUTED,
  INFO_ICON,
  later,
  NEUTRAL_ICON,
  NOT_APPLICABLE,
  prepareEachTest,
  readEnded,
  RELEASE_REQUESTS,
  renderTree,
  returnToForeground,
  type Screen,
  showing,
  SUBMISSION_REQUESTS,
  SUCCESS_ICON,
  TICKET,
  trackOf,
  UNOBSERVED,
} from "./test-support";

// The IBS requests of a track in the package tree of Overview, the first tab
// of the Ticket screen (src/routes/ticket-overview/ibs-requests.tsx;
// docs/screens/ticket.md), at the browser's default text size, in the light
// theme.

prepareEachTest();

// The queries of the reads of the path that the screen sent, in their order.
function queriesTo(
  spy: ReturnType<typeof stubApi>,
  path: string,
): Record<string, string>[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname === path)
    .map((url) => Object.fromEntries(url.searchParams));
}

// The query of each read of the requests of the track of fictionalTrack:
// its package and its reference, the most recently created first, as many as
// "+N" names.
const TRACK_QUERY = {
  package_name: "fictional-openssl",
  codestream_name: "SUSE:FLES-15-SP7:Update",
  sort_by: "upstream_created_at",
  sort_order: "desc",
  per_page: "11",
};

// Opens Phases of a track, by its reference, which takes the focus.
async function openPhases(
  screen: Screen,
  reference = "SUSE:FLES-15-SP7:Update",
): Promise<Locator> {
  await trackOf(screen, reference)
    .getByRole("button", { name: /^Phases of/ })
    .click();
  const phases = screen.getByRole("dialog", { name: "Phases" });
  await expect.element(phases).toHaveFocus();
  return phases;
}

// The line of a phase in Phases, by the name of the phase.
function phaseIn(phases: Locator, name: string): Locator {
  return phases
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// The fields of a track without work whose delivery, In progress, shows on
// its line, in place of a pipeline.
const DELIVERED: Partial<TrackDetail> = {
  status: "not_affected",
  delivery_status: "in_progress",
  delivery_relevant: true,
  ...NOT_APPLICABLE,
};

const DELIVERY =
  "Delivery of fictional-openssl, SUSE:FLES-15-SP7:Update: In progress";

// A popover that shows the requests of a track, with the place of its
// latest submission request and that of its latest release request.
interface RequestPlaces {
  popover: Locator;
  submission: Locator;
  qa: Locator;
}

// Opens Phases of the track of fictionalTrack: the requests at the ends of
// the lines of Submission and QA.
async function inPhases(screen: Screen): Promise<RequestPlaces> {
  const phases = await openPhases(screen);
  return {
    popover: phases,
    submission: phaseIn(phases, "Submission"),
    qa: phaseIn(phases, "QA"),
  };
}

// Opens the delivery on the line of the track of fictionalTrack without a
// pipeline: the requests in Submission and QA of its popover.
async function inDelivery(screen: Screen): Promise<RequestPlaces> {
  await screen.getByRole("button", { name: DELIVERY, exact: true }).click();
  const popover = screen.getByRole("dialog", { name: "Delivery" });
  await expect.element(popover).toHaveFocus();
  return {
    popover,
    submission: popover.getByRole("definition").first(),
    qa: popover.getByRole("definition").last(),
  };
}

// The popovers that show the requests of a track, with the fields of a track
// that shows each.
const REQUEST_POPOVERS: [
  string,
  Partial<TrackDetail>,
  (screen: Screen) => Promise<RequestPlaces>,
][] = [
  ["Phases", {}, inPhases],
  ["the popover of a delivery", DELIVERED, inDelivery],
];

// What the place of the latest submission request and that of the latest
// release request say when the read of their requests fails.
const UNAVAILABLE = {
  submission: "The submission requests aren't available.",
  qa: "The release requests aren't available.",
};

// Fails unless an element shows its text whole within its box, unlike a text
// for assistive technologies alone, whose box of 1 px clips it.
function expectShownWhole(element: Element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const text = range.getBoundingClientRect();
  const box = boxOf(element);
  expect(text.width).toBeGreaterThan(0);
  expect(text.left).toBeGreaterThanOrEqual(box.left - 0.5);
  expect(text.right).toBeLessThanOrEqual(box.right + 0.5);
  expect(text.top).toBeGreaterThanOrEqual(box.top - 0.5);
  expect(text.bottom).toBeLessThanOrEqual(box.bottom + 0.5);
}

// The distance to the color of the pixel closest to it in the mark of the
// state of a request, which is hidden from assistive technologies: the 14 px
// that end 4 px before the link of the request, across the middle of its
// height, as a screenshot of the place of the request shows them.
async function markDistance(
  place: Locator,
  link: Locator,
  color: string,
): Promise<number> {
  const origin = boxOf(place);
  const box = boxOf(link);
  const picture = await screenshot(place);
  const left = box.left - origin.left - 4 - 14;
  const top = (box.top + box.bottom) / 2 - origin.top - 7;
  const pixels = Array.from({ length: 14 * 14 }, (_, index) =>
    picture.at(left + (index % 14), top + Math.floor(index / 14)),
  );
  return Math.min(...pixels.map((pixel) => distance(pixel, color)));
}

// The drawing of an icon, which tells one icon from another.
async function drawingOf(Icon: LucideIcon): Promise<string> {
  const reference = await render(<Icon />);
  const drawing = reference.container.querySelector("svg")!.innerHTML;
  await reference.unmount();
  return drawing;
}

// The drawing of the mark of the state of a request, which is hidden from
// assistive technologies: the icon in the middle of the 14 px that end 4 px
// before the link of the request.
function markDrawing(link: Locator): string | undefined {
  const box = boxOf(link);
  return document
    .elementFromPoint(box.left - 4 - 7, (box.top + box.bottom) / 2)
    ?.closest("svg")?.innerHTML;
}

// A state of a request that the pinned contract does not list, which a later
// Sentinel release could return.
const UNLISTED_STATE = "fictional_state";

// List Submission Requests's response with the request SR 900001 in a state,
// with the fields that a test sets: as the pinned contract types it for a
// state that the contract lists, and untyped for UNLISTED_STATE.
function submissionRequestIn(
  state: IBSRequestStateValue | typeof UNLISTED_STATE,
  fields: Partial<SubmissionRequestItem> = {},
): Response {
  if (state === UNLISTED_STATE) {
    return jsonResponse(200, {
      data: [{ ...fictionalSubmissionRequest(fields), state }],
      meta: { total: 1, page: 1, per_page: 11 },
    });
  }
  return submissionRequestsResponse([
    fictionalSubmissionRequest({ state, ...fields }),
  ]);
}

// The submission requests SR 900020 to SR 900010 of a track, the latest
// first, in review, and the others declined.
function manyRequests(): SubmissionRequestItem[] {
  return Array.from({ length: 11 }, (_, index) =>
    fictionalSubmissionRequest({
      request_number: 900020 - index,
      state: index === 0 ? "review" : "declined",
    }),
  );
}

describe("the IBS requests of a track", () => {
  test("are not read before Phases opens, and are then read once each, for the package and the reference of the track whose Phases opens, the latest first, as many as +N names", async () => {
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
        submissionRequests: () =>
          submissionRequestsResponse([fictionalSubmissionRequest()]),
        releaseRequests: () =>
          releaseRequestsResponse([fictionalReleaseRequest()]),
      },
    );
    const { screen } = await renderTree();
    await expect
      .element(
        trackOf(screen, "SUSE:FLES-15-SP6:Update").getByRole("button", {
          name: /^Phases of/,
        }),
      )
      .toBeVisible();
    expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([]);
    expect(queriesTo(spy, RELEASE_REQUESTS)).toEqual([]);

    const phases = await openPhases(screen, "SUSE:FLES-15-SP6:Update");

    await expect
      .element(phases.getByRole("link", { name: /^SR 900001\b/ }))
      .toBeVisible();
    await expect
      .element(phases.getByRole("link", { name: /^RR 900003\b/ }))
      .toBeVisible();
    const query = {
      ...TRACK_QUERY,
      codestream_name: "SUSE:FLES-15-SP6:Update",
    };
    expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([query]);
    expect(queriesTo(spy, RELEASE_REQUESTS)).toEqual([query]);
  });

  test("show the latest submission request at the end of the line of Submission and the latest release request at the end of the line of QA, as links to IBS 24 px high in text-13, lined up, and none under Triage and UM", async () => {
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse([fictionalSubmissionRequest()]),
        releaseRequests: () =>
          releaseRequestsResponse([fictionalReleaseRequest()]),
      },
    );
    const { screen } = await renderTree();

    const phases = await openPhases(screen);

    const submission = phaseIn(phases, "Submission");
    const sr = submission.getByRole("link", { name: /^SR 900001\b/ });
    await expect
      .element(sr)
      .toHaveAttribute("href", "https://build.suse.de/request/show/900001");
    const qa = phaseIn(phases, "QA");
    const rr = qa.getByRole("link", { name: /^RR 900003\b/ });
    await expect
      .element(rr)
      .toHaveAttribute("href", "https://build.suse.de/request/show/900003");
    expect(phases.getByRole("link").elements()).toHaveLength(2);
    for (const name of ["Triage", "UM"]) {
      expect(phaseIn(phases, name).getByRole("link").elements()).toHaveLength(
        0,
      );
    }
    for (const [link, name] of [
      [sr, "Submission"],
      [rr, "QA"],
    ] as const) {
      const box = boxOf(link);
      const nameBox = boxOf(phases.getByText(name, { exact: true }));
      // On the line of the name of the phase, after it.
      expect(box.top).toBeLessThan(nameBox.bottom);
      expect(box.bottom).toBeGreaterThan(nameBox.top);
      expect(box.left).toBeGreaterThan(nameBox.right + 12);
      expect(box.height).toBeGreaterThanOrEqual(24);
      expect(getComputedStyle(link.element()).fontSize).toBe("13px");
    }
    expect(boxOf(sr).left).toBeCloseTo(boxOf(rr).left, 0);
    // The release request is new: in progress.
    expect(await markDistance(qa, rr, INFO_ICON)).toBeLessThan(24);
  });

  test("show nothing at a phase without requests", async () => {
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse([fictionalSubmissionRequest()]),
      },
    );
    const { screen } = await renderTree();

    const phases = await openPhases(screen);

    await expect
      .element(phases.getByRole("link", { name: /^SR 900001\b/ }))
      .toBeVisible();
    // The release requests, of which none shows, arrive by a read of their
    // own.
    await readEnded(RELEASE_REQUESTS);
    const qa = phaseIn(phases, "QA");
    expect(qa.getByRole("link").elements()).toHaveLength(0);
    expect(qa.getByRole("button").elements()).toHaveLength(0);
    expect(qa.element().textContent).toMatch(/^QA · QA(?:Due|Overdue) /);
    expect(qa.element().textContent).not.toMatch(/RR|None|available/);
  });

  test.each<
    [
      IBSRequestStateValue | typeof UNLISTED_STATE,
      string,
      string,
      string,
      LucideIcon,
      Partial<SubmissionRequestItem>,
    ]
  >([
    ["new", "New", "in progress", INFO_ICON, GitPullRequest, {}],
    ["review", "Review", "in progress", INFO_ICON, GitPullRequest, {}],
    ["accepted", "Accepted", "accepted", SUCCESS_ICON, GitMerge, {}],
    ["declined", "Declined", "failed", DANGER_ICON, GitPullRequestClosed, {}],
    ["revoked", "Revoked", "failed", DANGER_ICON, GitPullRequestClosed, {}],
    [
      "superseded",
      "Superseded by 900014",
      "failed",
      DANGER_ICON,
      GitPullRequestClosed,
      { superseded_by_request_number: 900014 },
    ],
    ["deleted", "Deleted", "failed", DANGER_ICON, GitPullRequestClosed, {}],
    [
      UNLISTED_STATE,
      UNLISTED_STATE,
      "unknown",
      NEUTRAL_ICON,
      CircleQuestionMark,
      {},
    ],
  ])(
    "show a request %s as %s in the tooltip of its link and after its number for assistive technologies, with the mark of a request %s",
    async (state, words, _, color, icon, fields) => {
      const drawing = await drawingOf(icon);
      showing(
        [fictionalPackage()],
        {},
        { submissionRequests: () => submissionRequestIn(state, fields) },
      );
      const { screen } = await renderTree();
      const phases = await openPhases(screen);
      const submission = phaseIn(phases, "Submission");
      const link = submission.getByRole("link", { name: /^SR 900001\b/ });
      await expect.element(link).toBeVisible();

      expect(await markDistance(submission, link, color)).toBeLessThan(24);
      expect(markDrawing(link)).toBe(drawing);

      // Keyboard focus shows the tooltip at once.
      await userEvent.keyboard("{Tab}");

      await expect.element(link).toHaveFocus();
      const tooltip = screen.getByRole("tooltip");
      await expect.element(tooltip).toBeVisible();
      expect(tooltip.element().textContent).toBe(words);
      await expect
        .element(link)
        .toHaveAccessibleName(`SR 900001, ${words} (another site)`);
    },
  );

  test("show the state of a request in the tooltip of its link under the pointer", async () => {
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse([fictionalSubmissionRequest()]),
      },
    );
    const { screen } = await renderTree();
    const phases = await openPhases(screen);
    const link = phases.getByRole("link", { name: /^SR 900001\b/ });
    await expect.element(link).toBeVisible();

    await link.hover();

    const tooltip = screen.getByRole("tooltip");
    await expect.element(tooltip).toBeVisible();
    expect(tooltip.element().textContent).toBe("Review");
  });

  test("follow the latest request as +N, 6 px after its link, named after the other requests with their state, whose tooltip lists every request with its state below their number", async () => {
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse([
            fictionalSubmissionRequest(),
            fictionalSubmissionRequest({
              request_number: 900000,
              state: "declined",
            }),
          ]),
        releaseRequests: () =>
          releaseRequestsResponse([
            fictionalReleaseRequest({ request_number: 900005 }),
            fictionalReleaseRequest({
              state: "superseded",
              superseded_by_request_number: 900005,
            }),
          ]),
      },
    );
    const { screen } = await renderTree();
    const phases = await openPhases(screen);

    const sr = phases.getByRole("link", { name: /^SR 900001\b/ });
    const more = phaseIn(phases, "Submission").getByRole("button", {
      name: "1 more submission request: SR 900000, Declined",
      exact: true,
    });
    await expect.element(more).toHaveTextContent("+1");
    expect(boxOf(more).left - boxOf(sr).right).toBeCloseTo(6, 0);
    await expect
      .element(
        phaseIn(phases, "QA").getByRole("button", {
          name: "1 more release request: RR 900003, Superseded by 900005",
          exact: true,
        }),
      )
      .toHaveTextContent("+1");

    await more.hover();

    const tooltip = screen.getByRole("tooltip");
    await expect.element(tooltip).toBeVisible();
    await expect
      .element(tooltip.getByText("2 submission requests", { exact: true }))
      .toBeVisible();
    expect(
      tooltip
        .getByRole("listitem")
        .elements()
        .map((line) => line.textContent),
    ).toEqual(["SR 900001 · Review", "SR 900000 · Declined"]);
    expect(tooltip.getByText(/more$/).elements()).toHaveLength(0);
  });

  test.each<[string, number, string, string]>([
    [
      "names ten other requests and how many more, and lists ten requests and how many more",
      15,
      "14 more submission requests",
      "5",
    ],
    [
      "names ten other requests whole, and lists ten requests and one more",
      11,
      "10 more submission requests",
      "1",
    ],
  ])("+N %s", async (_, total, count, more) => {
    const requests = manyRequests();
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse(requests, { total }),
      },
    );
    const { screen } = await renderTree();
    const phases = await openPhases(screen);
    const others = requests
      .slice(1)
      .map((request) => `SR ${request.request_number}, Declined`);
    const unnamed = total - 11;
    const button = phases.getByRole("button", {
      name: `${count}: ${[...others, ...(unnamed > 0 ? [`and ${unnamed} more`] : [])].join("; ")}`,
      exact: true,
    });
    await expect.element(button).toHaveTextContent(`+${total - 1}`);

    await button.hover();

    const tooltip = screen.getByRole("tooltip");
    await expect.element(tooltip).toBeVisible();
    await expect
      .element(
        tooltip.getByText(`${total} submission requests`, { exact: true }),
      )
      .toBeVisible();
    expect(
      tooltip
        .getByRole("listitem")
        .elements()
        .map((line) => line.textContent),
    ).toEqual(
      requests
        .slice(0, 10)
        .map(
          (request) =>
            `SR ${request.request_number} · ${request.state === "review" ? "Review" : "Declined"}`,
        ),
    );
    await expect
      .element(tooltip.getByText(`…and ${more} more`, { exact: true }))
      .toBeVisible();
  });

  test.each(REQUEST_POPOVERS)(
    "show the loading indicator in place of a request in %s until its read arrives, and the other request and the phases at once",
    async (_, fields, open) => {
      const submission = later();
      showing(
        [fictionalPackage({ tracks: [fictionalTrack(fields)] })],
        {},
        {
          submissionRequests: () => submission.promise,
          releaseRequests: () =>
            releaseRequestsResponse([fictionalReleaseRequest()]),
        },
      );
      const { screen } = await renderTree();

      const places = await open(screen);

      await expect
        .element(
          places.submission.getByRole("progressbar", { name: "Loading" }),
        )
        .toBeVisible();
      await expect
        .element(places.qa.getByRole("link", { name: /^RR 900003\b/ }))
        .toBeVisible();
      await expect
        .element(places.popover.getByText("Submission", { exact: true }))
        .toBeVisible();
      expect(places.submission.getByRole("link").elements()).toHaveLength(0);

      submission.resolve(
        submissionRequestsResponse([fictionalSubmissionRequest()]),
      );

      await expect
        .element(places.submission.getByRole("link", { name: /^SR 900001\b/ }))
        .toBeVisible();
      expect(places.popover.getByRole("progressbar").elements()).toHaveLength(
        0,
      );
    },
  );

  test.each<
    [
      string,
      (typeof REQUEST_POPOVERS)[number],
      "submission" | "qa",
      number,
      string,
    ]
  >([
    ["Phases", REQUEST_POPOVERS[0]!, "submission", 500, "INTERNAL_ERROR"],
    ["Phases", REQUEST_POPOVERS[0]!, "qa", 404, "TICKET_NOT_FOUND"],
    [
      "the popover of a delivery",
      REQUEST_POPOVERS[1]!,
      "submission",
      409,
      "FICTIONAL_CONFLICT",
    ],
    [
      "the popover of a delivery",
      REQUEST_POPOVERS[1]!,
      "qa",
      400,
      "FICTIONAL_CODE",
    ],
  ])(
    "say in place of a request in %s whose read fails, in fg-muted, that the requests of its kind aren't available, which a status region announces, and keep the other request and the phases shown",
    async (_, [, fields, open], kind, status, code) => {
      const failure = later();
      const fails = () =>
        failure.promise.then(() => errorResponse(status, code));
      showing(
        [fictionalPackage({ tracks: [fictionalTrack(fields)] })],
        {},
        {
          submissionRequests:
            kind === "submission"
              ? fails
              : () =>
                  submissionRequestsResponse([fictionalSubmissionRequest()]),
          releaseRequests:
            kind === "qa"
              ? fails
              : () => releaseRequestsResponse([fictionalReleaseRequest()]),
        },
      );
      const { screen } = await renderTree();
      const places = await open(screen);
      const failed = places[kind];
      const other = places[kind === "submission" ? "qa" : "submission"];
      // The status region is there before the failure, which it announces.
      const announced = failed.getByRole("status");
      await expect.element(announced).toBeInTheDocument();
      expect(announced.element().textContent).toBe("");

      failure.resolve(new Response());

      // The line that shows is the one that the region announces, and
      // nothing else says it.
      const shown = announced.getByText(UNAVAILABLE[kind], { exact: true });
      await expect.element(shown).toBeVisible();
      expectShownWhole(shown.element());
      expect(shown.element().closest("[aria-hidden]")).toBeNull();
      expect(announced.element().textContent).toBe(UNAVAILABLE[kind]);
      expect(colorOf(shown.element())).toBe(FG_MUTED);
      expect(failed.element().textContent).not.toMatch(/Not available/);
      if (open === inPhases && kind === "submission") {
        // Too wide for the line of "Submission · Maintainer", it stands
        // below the name of the phase, above its state.
        const box = boxOf(shown);
        expect(box.top).toBeGreaterThanOrEqual(
          boxOf(failed.getByText("Submission", { exact: true })).bottom,
        );
        expect(box.bottom).toBeLessThanOrEqual(
          boxOf(failed.getByText(/^(?:Due|Overdue) /)).top,
        );
      }
      expect(failed.getByRole("link").elements()).toHaveLength(0);
      await expect
        .element(other.getByRole("link", { name: /^(?:SR|RR) 9000/ }))
        .toBeVisible();
      expect(other.getByRole("status").element().textContent).toBe("");
      await expect
        .element(places.popover.getByText("Submission", { exact: true }))
        .toBeVisible();
    },
  );

  test.each(REQUEST_POPOVERS)(
    "are read again when %s opens again, after a failure too",
    async (_, fields, open) => {
      let fail = true;
      const spy = showing(
        [fictionalPackage({ tracks: [fictionalTrack(fields)] })],
        {},
        {
          submissionRequests: () =>
            fail
              ? errorResponse(404, "TICKET_NOT_FOUND")
              : submissionRequestsResponse([fictionalSubmissionRequest()]),
        },
      );
      const { screen } = await renderTree();
      let places = await open(screen);
      const shown = places.submission
        .getByRole("status")
        .getByText(UNAVAILABLE.submission, { exact: true });
      await expect.element(shown).toBeVisible();
      expectShownWhole(shown.element());
      expect(colorOf(shown.element())).toBe(FG_MUTED);
      await userEvent.keyboard("{Escape}");
      await expect.element(places.popover).not.toBeInTheDocument();

      fail = false;
      places = await open(screen);

      await expect
        .element(places.submission.getByRole("link", { name: /^SR 900001\b/ }))
        .toBeVisible();
      expect(places.submission.getByRole("status").element().textContent).toBe(
        "",
      );
      expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([
        TRACK_QUERY,
        TRACK_QUERY,
      ]);
      expect(queriesTo(spy, RELEASE_REQUESTS)).toEqual([
        TRACK_QUERY,
        TRACK_QUERY,
      ]);
    },
  );

  test("are read again each time Phases opens, without showing those of the earlier opening meanwhile", async () => {
    const second = later();
    let reads = 0;
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () => {
          reads += 1;
          return reads === 1
            ? submissionRequestsResponse([fictionalSubmissionRequest()])
            : second.promise;
        },
      },
    );
    const { screen } = await renderTree();
    let phases = await openPhases(screen);
    await expect
      .element(phases.getByRole("link", { name: /^SR 900001\b/ }))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(phases).not.toBeInTheDocument();

    phases = await openPhases(screen);

    await expect
      .element(phases.getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();
    expect(phases.getByRole("link").elements()).toHaveLength(0);
    expect(reads).toBe(2);

    second.resolve(
      submissionRequestsResponse([
        fictionalSubmissionRequest({ request_number: 900002 }),
      ]),
    );

    await expect
      .element(phases.getByRole("link", { name: /^SR 900002\b/ }))
      .toBeVisible();
  });

  test("are not read again while Phases is open, also when the tab returns to the foreground", async () => {
    const spy = showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse([fictionalSubmissionRequest()]),
      },
    );
    const { screen } = await renderTree();
    const phases = await openPhases(screen);
    await expect
      .element(phases.getByRole("link", { name: /^SR 900001\b/ }))
      .toBeVisible();

    await returnToForeground();

    // The Ticket is read again, which shows that the return took effect.
    await expect.poll(() => requestsTo(spy, TICKET)).toBe(2);
    expect(queriesTo(spy, SUBMISSION_REQUESTS)).toHaveLength(1);
    expect(queriesTo(spy, RELEASE_REQUESTS)).toHaveLength(1);
    await expect.element(phases).toHaveFocus();
  });

  test.each<[string, Partial<TrackDetail>, Partial<TicketDetail>]>([
    ["a Git track", { workflow_type: "git", reference: "fles-16.0" }, {}],
    ["an IBS track of a Ticket without a CVE", UNOBSERVED, { cve: null }],
  ])(
    "are neither read nor shown in Phases of %s",
    async (_, fields, ticket) => {
      const spy = showing(
        [fictionalPackage({ tracks: [fictionalTrack(fields)] })],
        ticket,
        {
          submissionRequests: () =>
            submissionRequestsResponse([fictionalSubmissionRequest()]),
          releaseRequests: () =>
            releaseRequestsResponse([fictionalReleaseRequest()]),
        },
      );
      const { screen } = await renderTree();

      const phases = await openPhases(
        screen,
        fields.reference ?? "SUSE:FLES-15-SP7:Update",
      );

      expect(phases.getByRole("listitem").elements()).toHaveLength(4);
      // Neither a request nor the place of one.
      expect(phases.getByRole("link").elements()).toHaveLength(0);
      expect(phases.getByRole("status").elements()).toHaveLength(0);
      expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([]);
      expect(queriesTo(spy, RELEASE_REQUESTS)).toEqual([]);
    },
  );

  test("leave the name of the pipeline as it is, without them", async () => {
    showing(
      [fictionalPackage()],
      {},
      {
        submissionRequests: () =>
          submissionRequestsResponse([
            fictionalSubmissionRequest(),
            fictionalSubmissionRequest({
              request_number: 900000,
              state: "declined",
            }),
          ]),
        releaseRequests: () =>
          releaseRequestsResponse([fictionalReleaseRequest()]),
      },
    );
    const { screen } = await renderTree();
    const pipeline = trackOf(screen, "SUSE:FLES-15-SP7:Update").getByRole(
      "button",
      { name: /^Phases of/ },
    );
    await expect.element(pipeline).toBeVisible();
    const name = pipeline.element().getAttribute("aria-label");
    expect(name).toMatch(
      /^Phases of fictional-openssl, SUSE:FLES-15-SP7:Update: Triage done; Submission [^;]+, current; UM [^;]+; QA [^;]+; delivery pending$/,
    );

    const phases = await openPhases(screen);
    await expect
      .element(phases.getByRole("link", { name: /^RR 900003\b/ }))
      .toBeVisible();
    await expect
      .element(phases.getByRole("link", { name: /^SR 900001\b/ }))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");

    await expect.element(pipeline).toHaveFocus();
    expect(pipeline.element().getAttribute("aria-label")).toBe(name);
  });

  test.each<[string, TrackDetail["status"]]>([
    ["Not affected", "not_affected"],
    ["Won't fix", "wont_fix"],
  ])(
    "open from the delivery on the line of an IBS track without a pipeline, %s, in a popover titled Delivery with Submission and QA, and None without a request",
    async (affectedness, status) => {
      const spy = showing(
        [
          fictionalPackage({
            tracks: [fictionalTrack({ ...DELIVERED, status })],
          }),
        ],
        {},
        {
          submissionRequests: () =>
            submissionRequestsResponse([fictionalSubmissionRequest()]),
        },
      );
      const { screen } = await renderTree();
      const track = trackOf(screen, "SUSE:FLES-15-SP7:Update");
      const delivery = track.getByRole("button", {
        name: DELIVERY,
        exact: true,
      });
      await expect.element(delivery).toHaveTextContent("In progress");
      await expect
        .element(track.getByText(affectedness, { exact: true }))
        .toBeVisible();
      expect(
        track.getByRole("button", { name: /^Phases of/ }).elements(),
      ).toHaveLength(0);
      expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([]);

      const { popover, submission, qa } = await inDelivery(screen);

      await expect
        .element(submission.getByRole("link", { name: /^SR 900001\b/ }))
        .toHaveAttribute("href", "https://build.suse.de/request/show/900001");
      expect(
        popover
          .getByRole("term")
          .elements()
          .map((element) => element.textContent),
      ).toEqual(["Submission", "QA"]);
      // The release requests arrive by a read of their own.
      await expect.poll(() => qa.element().textContent).toBe("None");
      expect(colorOf(qa.getByText("None", { exact: true }).element())).toBe(
        FG_MUTED,
      );
      expect(popover.getByText("In progress").elements()).toHaveLength(0);
      expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([TRACK_QUERY]);
      expect(queriesTo(spy, RELEASE_REQUESTS)).toEqual([TRACK_QUERY]);

      await userEvent.keyboard("{Escape}");

      await expect.element(delivery).toHaveFocus();
    },
  );

  test("say None in Submission of the popover of a delivery without a submission request", async () => {
    showing(
      [fictionalPackage({ tracks: [fictionalTrack(DELIVERED)] })],
      {},
      {
        releaseRequests: () =>
          releaseRequestsResponse([fictionalReleaseRequest()]),
      },
    );
    const { screen } = await renderTree();

    const { submission, qa } = await inDelivery(screen);

    await expect
      .element(qa.getByRole("link", { name: /^RR 900003\b/ }))
      .toBeVisible();
    // The submission requests arrive by a read of their own.
    await expect.poll(() => submission.element().textContent).toBe("None");
  });

  test.each<[string, Partial<TrackDetail>, Partial<TicketDetail>]>([
    ["a Git track", { workflow_type: "git", reference: "fles-16.0" }, {}],
    ["an IBS track of a Ticket without a CVE", {}, { cve: null }],
  ])(
    "are not read for the delivery on the line of %s without a pipeline, whose status is text",
    async (_, fields, ticket) => {
      const spy = showing(
        [
          fictionalPackage({
            tracks: [fictionalTrack({ ...DELIVERED, ...fields })],
          }),
        ],
        ticket,
      );
      const { screen } = await renderTree();

      const track = trackOf(
        screen,
        fields.reference ?? "SUSE:FLES-15-SP7:Update",
      );
      await expect
        .element(track.getByText("In progress", { exact: true }))
        .toBeVisible();
      expect(
        track.getByRole("button", { name: /Delivery|In progress/ }).elements(),
      ).toHaveLength(0);
      expect(queriesTo(spy, SUBMISSION_REQUESTS)).toEqual([]);
      expect(queriesTo(spy, RELEASE_REQUESTS)).toEqual([]);
    },
  );
});
