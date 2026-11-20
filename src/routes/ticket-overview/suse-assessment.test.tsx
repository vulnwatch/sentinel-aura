import { describe, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import type {
  CVECVSSAssessments,
  CVSS20Assessment,
  CVSS30Assessment,
  CVSS40Assessment,
  CVSSAssessmentItem,
  CurrentUserResponse,
} from "../../api/generated/model";
import { LOADING_DELAY_MS } from "../../components/loading";
import { SCORE_DELAY_MS } from "./suse-assessment";
import {
  cvssResponse,
  errorResponse,
  grantsResponse,
  validationError,
  fictionalAssessment,
  fictionalCvssAssessments,
  fictionalPackage,
  fictionalSuseAssessment,
  fictionalTicketDetail,
  jsonResponse,
  OTHER_USER,
  requestsTo,
  stubApi,
  ticketResponse,
  urlOf,
} from "../../test-api";
import {
  ACCESS,
  ACTORS,
  backgroundBehind,
  BASE_SCORE,
  baseScoreOf,
  baseScoreResponse,
  boxOf,
  client,
  CNA_V20,
  CNA_V31,
  colorOf,
  confidentialTicket,
  CVSS,
  cvssPart,
  deleteSuse,
  EVENTS,
  excludedPackage,
  expectFocusOnError,
  expectFocusSettledOn,
  expectSuccessMessage,
  FG,
  FG_MUTED,
  frames,
  later,
  leaveForTickets,
  leftInvalidated,
  MAINTAINER,
  MESSAGE_CONFLICT,
  MESSAGE_GONE,
  MESSAGE_INVALID,
  MESSAGE_NOT_ACCEPTED,
  MESSAGE_TONES,
  MESSAGE_UNAVAILABLE,
  MESSAGE_UNCONFIRMED,
  nextFrames,
  NVD_V31_VECTOR,
  NVD_V40,
  prepareEachTest,
  press,
  readEnded,
  readsOf,
  REFERENCE,
  renderApp,
  renderTree,
  requestsWith,
  returnToForeground,
  type Screen,
  screenHeading,
  type Stub,
  stubTicket,
  SUSE_ASSESSMENT,
  suseResponse,
  TICKET,
  TICKETS,
  YOUR_WORK,
} from "./test-support";

// The SUSE assessment of the CVSS assessments of Overview, the first tab of
// the Ticket screen (src/routes/ticket-overview/suse-assessment.tsx;
// docs/screens/ticket.md), at the browser's default text size, in the light
// theme.

prepareEachTest();

// An analyst who manages the CVSS assessments, who adds, edits, and deletes
// the SUSE assessment of the CVE of a Ticket.
const ASSESSOR: CurrentUserResponse = {
  data: {
    ...OTHER_USER.data,
    capabilities: ["triage_ticket", "manage_cvss"],
  },
};

// What the field of the vector says of itself, which assistive technologies
// read with it before its error.
const VECTOR_DESCRIPTION =
  "The metrics write it, and a vector entered here chooses them.";

// What the tab of a version of which SUSE has an assessment says in Add.
const TAKEN_V31 =
  "SUSE already has a CVSS v3.1 assessment: Edit in its row of the table changes it.";

// What the tooltip of the default CVSS version says.
const DEFAULT_VERSION_TEXT =
  "The default CVSS version: its SUSE assessment also sets the eligibility score of the Products.";

// The SUSE CVSS v3.1 assessment of fictionalSuseAssessment, Medium 5.5, and
// NVD's of fictionalAssessment, High 8.1.
const SUSE_V31 = fictionalSuseAssessment();
const NVD_V31 = fictionalAssessment();

// The SUSE CVSS v4.0 assessment, Medium 6.9.
const SUSE_V40: CVSS40Assessment = {
  ...NVD_V40,
  id: "00000000-0000-0000-0000-0000000000d6",
  provider_name: "SUSE",
  score: 6.9,
  severity: "medium",
  vector_string:
    "CVSS:4.0/AV:L/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N",
  metrics: {
    attack_vector: "local",
    attack_complexity: "low",
    attack_requirements: "none",
    privileges_required: "low",
    user_interaction: "none",
    vulnerable_system_confidentiality: "high",
    vulnerable_system_integrity: "none",
    vulnerable_system_availability: "none",
    subsequent_system_confidentiality: "none",
    subsequent_system_integrity: "none",
    subsequent_system_availability: "none",
  },
  created_at: "2099-10-09T15:00:00Z",
  updated_at: "2099-10-09T15:00:00Z",
};

// SUSE assessments of the versions that the screen shows read-only, v3.0
// and v2.0.
const SUSE_V30: CVSS30Assessment = {
  ...fictionalSuseAssessment(),
  id: "00000000-0000-0000-0000-0000000000d7",
  cvss_version: "3.0",
  vector_string: "CVSS:3.0/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
};
const SUSE_V20: CVSS20Assessment = {
  ...CNA_V20,
  id: "00000000-0000-0000-0000-0000000000d8",
  provider_name: "SUSE",
};

// The vectors that the user enters, of v3.1, High 7.5, and of v4.0.
const VECTOR_V31 = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H";
const VECTOR_V40 =
  "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N";

// The SUSE CVSS v3.1 assessment that Set or Update SUSE CVSS Assessment
// returns for VECTOR_V31.
const SAVED_V31 = fictionalAssessment({
  ...CNA_V31,
  id: SUSE_V31.id,
  provider_name: "SUSE",
  created_at: "2099-10-12T08:00:00Z",
  updated_at: "2099-10-12T08:00:00Z",
});

// The SUSE CVSS v4.0 assessment that Set or Update SUSE CVSS Assessment
// returns for VECTOR_V40, High 8.7.
const SAVED_V40: CVSS40Assessment = {
  ...SUSE_V40,
  score: 8.7,
  severity: "high",
  vector_string: VECTOR_V40,
  metrics: {
    ...NVD_V40.metrics,
    vulnerable_system_confidentiality: "none",
    vulnerable_system_integrity: "none",
  },
  created_at: "2099-10-12T08:00:00Z",
  updated_at: "2099-10-12T08:00:00Z",
};

// The metrics of each version, as their controls are named, in their order.
const METRICS_V31 = [
  "Attack vector",
  "Attack complexity",
  "Privileges required",
  "User interaction",
  "Scope",
  "Confidentiality",
  "Integrity",
  "Availability",
] as const;
const METRICS_V40 = [
  "Attack vector",
  "Attack complexity",
  "Attack requirements",
  "Privileges required",
  "User interaction",
  "Confidentiality Vulnerable system",
  "Integrity Vulnerable system",
  "Availability Vulnerable system",
  "Confidentiality Subsequent system",
  "Integrity Subsequent system",
  "Availability Subsequent system",
] as const;

// The consequence of Delete, with what it adds for the assessment of the
// default CVSS version, and for the last SUSE assessment of an Analyzed or
// Resolved Ticket, then its last sentence.
const DELETE_CONSEQUENCE =
  "Sentinel calculates the severity of the CVE again from the other assessments, and the eligibility of the Products, which can change the priority and the deadlines of the Ticket.";
function fallbackSentence(version: string): string {
  return ` Without a SUSE CVSS v${version} assessment, the eligibility score of the Products is the fallback 10.0.`;
}
const RETURNS_TO_ANALYSIS =
  " As the last SUSE assessment of the CVE, it also returns the Ticket to Analysis.";
const CANNOT_BE_UNDONE = " This can't be undone.";

// The CVSS assessments of CVE-2099-0012, in the order of the API, by version,
// then by provider, with the default CVSS version.
function assessmentsWith(
  assessments: CVSSAssessmentItem[],
  defaultVersion: CVECVSSAssessments["default_cvss_version"] = "3.1",
): CVECVSSAssessments {
  return fictionalCvssAssessments({
    assessments,
    default_cvss_version: defaultVersion,
  });
}

// Answers as stubTicket does, for an analyst who manages the CVSS
// assessments unless the test says otherwise, and answers the read of the
// CVSS assessments with what read returns at the time.
function stubSuse(read: () => object, fields: Partial<Stub> = {}) {
  return stubTicket({
    user: ASSESSOR,
    cvss: () => jsonResponse(200, { data: read() }),
    ...fields,
  });
}

// Get Ticket's response with SNTL-12 in the status.
function ticketIn(status: string) {
  return () =>
    jsonResponse(200, { data: { ...fictionalTicketDetail(), status } });
}

// Renders the screen of SNTL-12 and waits until it shows the table of the
// CVSS assessments.
async function renderSuse(path = "/tickets/SNTL-12") {
  const rendered = await renderApp(path);
  await expect
    .element(
      cvssPart(rendered.screen).getByRole("grid", {
        name: "CVSS assessments",
      }),
    )
    .toBeVisible();
  return rendered;
}

function addSuse(screen: Screen) {
  return cvssPart(screen).getByRole("button", {
    name: "Add SUSE assessment",
    exact: true,
  });
}

function editSuse(screen: Screen, version = "3.1") {
  return cvssPart(screen).getByRole("button", {
    name: `Edit SUSE assessment v${version}`,
    exact: true,
  });
}

// The buttons of the table that change the SUSE assessment.
function rowActions(screen: Screen): (string | null)[] {
  return cvssPart(screen)
    .getByRole("grid", { name: "CVSS assessments" })
    .getByRole("button", { name: /^(Edit|Delete) SUSE assessment/ })
    .elements()
    .map((button) => button.getAttribute("aria-label"));
}

// The row of an assessment, which its provider and its version name.
function assessmentRow(screen: Screen, provider: string, version: string) {
  return cvssPart(screen).getByRole("row", {
    name: `${provider} v${version}`,
    exact: true,
  });
}

function suseDialog(screen: Screen, name = "Add SUSE assessment") {
  return screen.getByRole("dialog", { name, exact: true });
}

// The tab of the version that is the default one, named by its label and the
// name of its mark.
function markedTab(dialog: Locator, version: string) {
  return dialog.getByRole("tab", {
    name: `CVSS v${version}, the default version`,
    exact: true,
  });
}

// The tab of a version, whether it is the default one or not.
function versionTab(dialog: Locator, version: string) {
  return dialog.getByRole("tab", {
    name: new RegExp(
      `^CVSS v${version.replace(".", "\\.")}(, the default version)?$`,
    ),
  });
}

function vectorOf(dialog: Locator) {
  return dialog.getByRole("textbox", { name: "Vector", exact: true });
}

// The select of Start from, named by the option that it shows and its label,
// "Start from (optional)" in Add and "Start from" in Edit.
function startFromOf(dialog: Locator) {
  return dialog.getByRole("button", { name: /Start from( \(optional\))?$/ });
}

function submitOf(dialog: Locator, label = "Add SUSE assessment") {
  return dialog.getByRole("button", { name: label, exact: true });
}

function metricOf(dialog: Locator, name: string) {
  return dialog.getByRole("radiogroup", { name, exact: true });
}

function segmentOf(dialog: Locator, metric: string, value: string) {
  return metricOf(dialog, metric).getByRole("radio", {
    name: value,
    exact: true,
  });
}

// The value chosen of each metric, or null for a metric without a choice.
function choicesOf(dialog: Locator, metrics: readonly string[]) {
  return metrics.map(
    (name) =>
      metricOf(dialog, name).getByRole("radio", { checked: true }).query()
        ?.textContent ?? null,
  );
}

// Opens Add SUSE assessment and waits until it shows the tab that it opens
// on.
async function openSuseAdd(screen: Screen) {
  await addSuse(screen).click();
  const dialog = suseDialog(screen);
  await expect
    .element(dialog.getByRole("tab", { selected: true }))
    .toBeVisible();
  return dialog;
}

// Opens Edit of the SUSE assessment of the version and waits until its first
// field, Start from, has the focus.
async function openSuseEdit(screen: Screen, version = "3.1") {
  await editSuse(screen, version).click();
  const dialog = suseDialog(screen, `Edit SUSE assessment v${version}`);
  await expect.element(startFromOf(dialog)).toHaveFocus();
  return dialog;
}

// Enters VECTOR_V31 in the tab of v3.1 of Add, on which it opens, and
// VECTOR_V40 in that of v4.0, then returns to the tab of v3.1.
async function enterInBothTabs(dialog: Locator) {
  await vectorOf(dialog).fill(VECTOR_V31);
  await versionTab(dialog, "4.0").click();
  await expect.element(vectorOf(dialog)).toHaveValue("");
  await vectorOf(dialog).fill(VECTOR_V40);
  await versionTab(dialog, "3.1").click();
  await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
}

// The marks of the severities in the light theme (docs/design-system.md,
// Severity Marks).
const MARK_HIGH = "rgb(247, 107, 21)";
const MARK_MEDIUM = "rgb(245, 196, 0)";

// The color of the mark of the severity that an element shows, a dot that is
// hidden from assistive technologies, or undefined without one.
function markOf(element: Element): string | undefined {
  const dot = element.querySelector('svg[aria-hidden="true"] circle');
  return dot === null ? undefined : getComputedStyle(dot).fill;
}

// The element of a dialog that scrolls its content, the nearest one around
// the element that scrolls.
function contentScrollerOf(element: Element): Element {
  for (
    let current = element.parentElement;
    current !== null;
    current = current.parentElement
  ) {
    if (getComputedStyle(current).overflowY === "auto") {
      return current;
    }
  }
  throw new Error("No element around it scrolls");
}

// Opens the options of Start from, and returns them.
async function openStartFrom(dialog: Locator) {
  await startFromOf(dialog).click();
  const options = page.getByRole("listbox", {
    name: /^Start from( \(optional\))?$/,
  });
  await expect.element(options).toBeVisible();
  return options;
}

function deleteConfirmation(screen: Screen, version = "3.1") {
  return screen.getByRole("dialog", {
    name: `Delete SUSE assessment v${version}?`,
    exact: true,
  });
}

// Opens the confirmation of Delete of the SUSE assessment of the version and
// confirms it.
async function confirmDelete(screen: Screen, version = "3.1") {
  await deleteSuse(screen, version).click();
  const confirmation = deleteConfirmation(screen, version);
  await expect
    .element(confirmation.getByRole("button", { name: "Cancel" }))
    .toHaveFocus();
  await confirmation
    .getByRole("button", { name: "Delete SUSE assessment", exact: true })
    .click();
  return confirmation;
}

// What the status regions of the CVSS assessments say, other than nothing.
function cvssAnnouncements(screen: Screen): string[] {
  return cvssPart(screen)
    .getByRole("status")
    .elements()
    .map((region) => region.textContent ?? "")
    .filter((text) => text !== "");
}

// The outcome of a change once the read of the assessments after it has
// ended: announced in the part when that read arrives, and, when it fails, a
// success message of the message area, which the part does not announce
// (docs/behaviors.md, Outcome of a Change).
async function expectOutcome(screen: Screen, place: string, text: string) {
  if (place === "in the part") {
    await expect.poll(() => cvssAnnouncements(screen)).toContain(text);
    return;
  }
  await expectSuccessMessage(screen, text);
  expect(cvssAnnouncements(screen)).not.toContain(text);
}

// The requests of the CVSS assessments and of the changes of the SUSE
// assessment, in their order, each as its method and its path.
function assessmentRequests(spy: ReturnType<typeof stubApi>): string[] {
  return spy.mock.calls
    .map(([input, init]) => ({
      method: init?.method ?? "GET",
      path: urlOf(input).pathname,
    }))
    .filter(({ path }) => path.startsWith(CVSS))
    .map(({ method, path }) => `${method} ${path}`);
}

// Gives a control of a row the focus as a press of the pointer does, so that
// React Aria's table records the cell that holds it.
async function focusInRow(screen: Screen, control: Locator) {
  await screenHeading(screen).click();
  control.element().focus();
  await expect.element(control).toHaveFocus();
}

// Opens Edit of the SUSE assessment of v3.1 and saves VECTOR_V31.
async function editToV31(screen: Screen) {
  const dialog = await openSuseEdit(screen);
  await vectorOf(dialog).fill(VECTOR_V31);
  await submitOf(dialog, "Save").click();
}

// Deletes an assessment among others, and waits until the read after it
// has taken its row away from the table and its outcome is announced.
async function deleteSuseAmong(before: CVSSAssessmentItem[], version: string) {
  let assessments = assessmentsWith(before);
  stubSuse(() => assessments, {
    deleteSuse: () => {
      assessments = assessmentsWith(
        before.filter(
          (item) =>
            item.provider_name !== "SUSE" || item.cvss_version !== version,
        ),
      );
      return new Response(null, { status: 204 });
    },
  });
  const { screen } = await renderSuse();

  await confirmDelete(screen, version);

  await expect
    .element(assessmentRow(screen, "SUSE", version))
    .not.toBeInTheDocument();
  await expect
    .poll(() => cvssAnnouncements(screen))
    .toEqual([`SUSE assessment v${version} deleted.`]);
  return { screen };
}

// The place of the Base score in the dialog, a status region named after
// it, since Add has another one.
function scorePlaceOf(dialog: Locator) {
  return dialog.getByRole("status", { name: "Base score", exact: true });
}

// What an element says to assistive technologies: its text without what it
// hides from them.
function spokenOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const texts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.parentElement?.closest('[aria-hidden="true"]') === null) {
      texts.push(node.textContent ?? "");
    }
  }
  return texts.join("");
}

// What the place of the score shows that assistive technologies do not
// read, each text with its color.
function seenOf(place: Locator): [string, string][] {
  const walker = document.createTreeWalker(
    place.element(),
    NodeFilter.SHOW_TEXT,
  );
  const texts: [string, string][] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent !== null && parent.closest('[aria-hidden="true"]') !== null) {
      texts.push([node.textContent ?? "", colorOf(parent)]);
    }
  }
  return texts;
}

// What the place of the score of the dialog says to assistive technologies.
function scoreSaid(dialog: Locator): string {
  return spokenOf(scorePlaceOf(dialog).element());
}

// Records what the place of the score says to assistive technologies after
// each change of the dialog, until stop, so that a test sees an outcome
// that shows for one render alone.
function recordScore(dialog: Locator) {
  const said: string[] = [];
  const observer = new MutationObserver(() => {
    const place = scorePlaceOf(dialog).query();
    said.push(place === null ? "" : spokenOf(place));
  });
  observer.observe(dialog.element(), {
    subtree: true,
    childList: true,
    characterData: true,
  });
  return {
    said,
    stop: () => {
      observer.disconnect();
    },
  };
}

// Calculate CVSS Base Score's response for every vector: High 6.1.
function highScore(query: URLSearchParams): Response {
  return baseScoreResponse(query.get("vector_string") ?? "", 6.1, "high");
}

// Its response as Sentinel rejects a vector with a Temporal metric, 422
// CVSS_INVALID_VECTOR, and High 6.1 for every other vector.
function rejectingTemporal(query: URLSearchParams): Response {
  const vector = query.get("vector_string") ?? "";
  return vector.includes("/E:")
    ? errorResponse(422, "CVSS_INVALID_VECTOR")
    : baseScoreResponse(vector, 6.1, "high");
}

// The vectors of the reads of the Base score, in their order.
function scoreReads(spy: ReturnType<typeof stubApi>): (string | null)[] {
  return spy.mock.calls
    .map(([input]) => urlOf(input))
    .filter((url) => url.pathname === BASE_SCORE)
    .map((url) => url.searchParams.get("vector_string"));
}

// Waits until no read is in progress and the screen shows the outcome of
// each, before a test fakes the clock, on which TanStack Query gives the
// screen the outcome of a read (readEnded).
async function readsEnded() {
  await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("the SUSE assessment", () => {
  describe("its actions", () => {
    test("offer Edit and Delete at the end of the rows of the SUSE assessments of v3.1 and v4.0 alone, named after their version, and no Add SUSE assessment while SUSE has both", async () => {
      stubSuse(() =>
        assessmentsWith([
          NVD_V40,
          SUSE_V40,
          NVD_V31,
          SUSE_V31,
          SUSE_V30,
          SUSE_V20,
        ]),
      );
      const { screen } = await renderSuse();

      expect(rowActions(screen)).toEqual([
        "Edit SUSE assessment v4.0",
        "Delete SUSE assessment v4.0",
        "Edit SUSE assessment v3.1",
        "Delete SUSE assessment v3.1",
      ]);
      for (const [provider, version] of [
        ["NVD", "4.0"],
        ["NVD", "3.1"],
        ["SUSE", "3.0"],
        ["SUSE", "2.0"],
      ] as const) {
        expect(
          assessmentRow(screen, provider, version)
            .getByRole("button", { name: /SUSE assessment/ })
            .elements(),
        ).toEqual([]);
      }
      expect(addSuse(screen).query()).toBeNull();
    });

    test("offer neither Edit nor Delete on a SUSE assessment of a version that the pinned contract does not list", async () => {
      stubSuse(() => ({
        ...assessmentsWith([]),
        assessments: [
          {
            ...SUSE_V40,
            id: "00000000-0000-0000-0000-0000000000d9",
            cvss_version: "5.0",
            vector_string: "CVSS:5.0/AV:L",
          },
          NVD_V31,
          SUSE_V31,
        ],
      }));
      const { screen } = await renderSuse();

      await expect
        .element(
          cvssPart(screen).getByRole("row", { name: "SUSE 5.0", exact: true }),
        )
        .toBeVisible();
      expect(rowActions(screen)).toEqual([
        "Edit SUSE assessment v3.1",
        "Delete SUSE assessment v3.1",
      ]);
      expect(
        cvssPart(screen)
          .getByRole("row", { name: "SUSE 5.0", exact: true })
          .getByRole("button", { name: /SUSE assessment/ })
          .elements(),
      ).toEqual([]);
      // SUSE has no assessment of v4.0 that the screen changes.
      await expect.element(addSuse(screen)).toBeVisible();
    });

    test.each([
      ["no SUSE assessment", [NVD_V40, NVD_V31]],
      ["a SUSE assessment of v3.1 alone", [NVD_V31, SUSE_V31]],
      ["a SUSE assessment of v4.0 alone", [SUSE_V40, NVD_V31]],
      [
        "SUSE assessments of the versions that it shows read-only",
        [NVD_V31, SUSE_V30, SUSE_V20],
      ],
    ])(
      "offer Add SUSE assessment at the end of the line of the heading with %s",
      async (_, assessments) => {
        stubSuse(() => assessmentsWith(assessments));
        const { screen } = await renderSuse();

        await expect.element(addSuse(screen)).toBeVisible();
        const heading = cvssPart(screen)
          .getByRole("heading", { level: 2, name: "CVSS assessments" })
          .element()
          .getBoundingClientRect();
        const add = addSuse(screen).element().getBoundingClientRect();
        expect(add.left).toBeGreaterThan(heading.right);
        expect(add.top).toBeLessThan(heading.bottom);
      },
    );

    test.each(["new", "analysis", "analyzed", "resolved"])(
      "are offered on a Ticket in %s",
      async (status) => {
        stubSuse(() => fictionalCvssAssessments(), {
          ticket: ticketIn(status),
        });
        const { screen } = await renderSuse();

        await expect.element(addSuse(screen)).toBeVisible();
        expect(rowActions(screen)).toEqual([
          "Edit SUSE assessment v3.1",
          "Delete SUSE assessment v3.1",
        ]);
      },
    );

    test.each<[string, CurrentUserResponse, () => Response]>([
      [
        "to a user who does not manage the CVSS assessments",
        OTHER_USER,
        ticketIn("analyzed"),
      ],
      ["on an Ignored Ticket", ASSESSOR, ticketIn("ignored")],
      [
        "on a Duplicated Ticket",
        ASSESSOR,
        () =>
          ticketResponse(
            fictionalTicketDetail({
              status: "duplicated",
              duplicate_of_ticket_id: "SNTL-1",
            }),
          ),
      ],
      [
        "on a Ticket in a status that the pinned contract does not list",
        ASSESSOR,
        ticketIn("fictional_status"),
      ],
    ])(
      "are not offered %s, nor the column of the actions",
      async (_, user, ticket) => {
        stubSuse(() => assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]), {
          user,
          ticket,
        });
        const { screen } = await renderSuse();

        expect(
          cvssPart(screen)
            .getByRole("columnheader")
            .elements()
            .map((header) => header.textContent),
        ).toEqual(["Provider", "Version", "Base score", "Vector"]);
        expect(rowActions(screen)).toEqual([]);
        expect(addSuse(screen).query()).toBeNull();
      },
    );

    test.each([
      ["Edit", editSuse],
      ["Delete", deleteSuse],
    ] as const)(
      "show %s alone in the tooltip of the action",
      async (action, buttonOf) => {
        stubSuse(() => fictionalCvssAssessments());
        const { screen } = await renderSuse();
        // React Aria shows a tooltip on hover only once the user works with
        // a pointer, as a click shows.
        await screenHeading(screen).click();

        await userEvent.hover(buttonOf(screen));

        const tooltip = page.getByRole("tooltip");
        await expect.element(tooltip).toBeVisible();
        expect(tooltip.element().textContent).toBe(action);
      },
    );

    // React Aria's table makes a cell a tab stop once a control in it has
    // had the focus, and so a target of its own, which needs 24 px beside
    // the buttons of the actions (WCAG 2.5.8, Target Size (Minimum)).
    test.each([1280, 320])(
      "leave the cells of the vector and of the actions 24 px of their own beside their buttons, at %i CSS pixels",
      async (width) => {
        await page.viewport(width, 800);
        stubSuse(() => assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]));
        const { screen } = await renderSuse();
        const row = assessmentRow(screen, "SUSE", "3.1");
        const cellOf = (button: string) =>
          row.getByRole("gridcell").filter({
            has: page.getByRole("button", { name: button, exact: true }),
          });
        const vector = row.getByRole("button", {
          name: SUSE_V31.vector_string,
          exact: true,
        });
        await expect.element(vector).toBeVisible();

        expect(
          boxOf(cellOf(SUSE_V31.vector_string)).right - boxOf(vector).right,
        ).toBeGreaterThanOrEqual(24);
        expect(
          boxOf(editSuse(screen)).left -
            boxOf(cellOf("Edit SUSE assessment v3.1")).left,
        ).toBeGreaterThanOrEqual(24);
      },
    );

    test("offer Add SUSE assessment only once the read of the assessments has arrived", async () => {
      const response = later();
      stubSuse(() => fictionalCvssAssessments(), {
        cvss: () => response.promise,
      });
      const { screen } = await renderTree();
      await expect
        .element(cvssPart(screen).getByRole("progressbar", { name: "Loading" }))
        .toBeVisible();
      expect(addSuse(screen).query()).toBeNull();

      response.resolve(cvssResponse());

      await expect.element(addSuse(screen)).toBeVisible();
    });

    test("offer no Add SUSE assessment after the read of the assessments failed", async () => {
      stubSuse(() => fictionalCvssAssessments(), {
        cvss: () => errorResponse(404, "CVE_NOT_FOUND"),
      });
      const { screen } = await renderTree();

      await expect
        .element(cvssPart(screen).getByText(MESSAGE_GONE))
        .toBeVisible();
      expect(addSuse(screen).query()).toBeNull();
    });

    test("offer Add SUSE assessment no more once a new read of the assessments fails with a 404, whose error the part shows", async () => {
      let fails = false;
      stubSuse(() => fictionalCvssAssessments(), {
        cvss: () =>
          fails ? errorResponse(404, "CVE_NOT_FOUND") : cvssResponse(),
      });
      const { screen } = await renderSuse();
      await expect.element(addSuse(screen)).toBeVisible();
      // Meanwhile Sentinel no longer finds the CVE.
      fails = true;

      await returnToForeground();

      await expect
        .element(cvssPart(screen).getByText(MESSAGE_GONE))
        .toBeVisible();
      expect(addSuse(screen).query()).toBeNull();
    });
  });

  describe("Add SUSE assessment", () => {
    test("opens a dialog 880 px wide, with the tabs of the versions, the default one marked and described, then Cancel and Add SUSE assessment", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();

      const dialog = await openSuseAdd(screen);

      expect(dialog.element().getBoundingClientRect().width).toBe(880);
      await expect
        .element(dialog.getByRole("tablist", { name: "CVSS version" }))
        .toBeVisible();
      const marked = markedTab(dialog, "3.1");
      await expect
        .element(marked)
        .toHaveAccessibleDescription(DEFAULT_VERSION_TEXT);
      const other = dialog.getByRole("tab", {
        name: "CVSS v4.0",
        exact: true,
      });
      await expect.element(other).not.toHaveAccessibleDescription();
      expect(dialog.getByRole("tab").elements()).toEqual([
        marked.element(),
        other.element(),
      ]);
      expect(
        dialog
          .getByRole("button")
          .elements()
          .slice(-2)
          .map((button) => button.textContent),
      ).toEqual(["Cancel", "Add SUSE assessment"]);
    });

    test.each<
      [
        string,
        CVSSAssessmentItem[],
        CVECVSSAssessments["default_cvss_version"],
        string,
      ]
    >([
      [
        "the default version v3.1, which SUSE lacks",
        [NVD_V40, NVD_V31],
        "3.1",
        "3.1",
      ],
      [
        "the default version v4.0, which SUSE lacks",
        [NVD_V40, NVD_V31],
        "4.0",
        "4.0",
      ],
      [
        "v4.0 when SUSE has the default version v3.1",
        [NVD_V31, SUSE_V31],
        "3.1",
        "4.0",
      ],
      [
        "v3.1 when SUSE has the default version v4.0",
        [SUSE_V40, NVD_V31],
        "4.0",
        "3.1",
      ],
    ])("opens on %s", async (_, assessments, defaultVersion, opened) => {
      stubSuse(() => assessmentsWith(assessments, defaultVersion));
      const { screen } = await renderSuse();

      await addSuse(screen).click();

      const dialog = suseDialog(screen);
      await expect
        .element(versionTab(dialog, opened))
        .toHaveAttribute("aria-selected", "true");
      await expect.element(markedTab(dialog, defaultVersion)).toBeVisible();
      await expect.element(vectorOf(dialog)).toHaveValue("");
    });

    test.each<
      [
        string,
        CVSSAssessmentItem[],
        (screen: Screen) => Promise<void>,
        (screen: Screen) => Locator,
      ]
    >([
      [
        "Start from in Add, opened with the pointer",
        [NVD_V40, NVD_V31],
        async (screen) => {
          await addSuse(screen).click();
        },
        (screen) => startFromOf(suseDialog(screen)),
      ],
      [
        "Start from in Add, opened from the keyboard",
        [NVD_V40, NVD_V31],
        async (screen) => {
          await press(addSuse(screen));
        },
        (screen) => startFromOf(suseDialog(screen)),
      ],
      [
        "the first segment in Add without Start from",
        [NVD_V31, SUSE_V31],
        async (screen) => {
          await addSuse(screen).click();
        },
        (screen) => segmentOf(suseDialog(screen), "Attack vector", "Physical"),
      ],
      [
        "Start from in Edit",
        [NVD_V31, SUSE_V31],
        async (screen) => {
          await editSuse(screen).click();
        },
        (screen) =>
          startFromOf(suseDialog(screen, "Edit SUSE assessment v3.1")),
      ],
    ])(
      "gives the focus to the first field of its form as it opens: %s",
      async (_, assessments, open, field) => {
        stubSuse(() => assessmentsWith(assessments));
        const { screen } = await renderSuse();

        await open(screen);

        await expectFocusSettledOn(field(screen));
      },
    );

    test("leaves the focus on a tab that the user opens, with the pointer or the keyboard, rather than moving it into its form", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect.element(startFromOf(dialog)).toHaveFocus();

      await versionTab(dialog, "4.0").click();

      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");
      await expect
        .element(metricOf(dialog, "Attack requirements"))
        .toBeVisible();
      await expectFocusSettledOn(versionTab(dialog, "4.0"));

      await userEvent.keyboard("{ArrowLeft}");
      await expect.element(versionTab(dialog, "3.1")).toHaveFocus();
      await userEvent.keyboard("{Enter}");

      await expect
        .element(versionTab(dialog, "3.1"))
        .toHaveAttribute("aria-selected", "true");
      await expect.element(metricOf(dialog, "Scope")).toBeVisible();
      await expectFocusSettledOn(versionTab(dialog, "3.1"));
    });

    test("leaves the focus on the tab of a version that SUSE has as the user opens it from its form, without moving it through the line that says so", async () => {
      stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect
        .element(segmentOf(dialog, "Attack vector", "Physical"))
        .toHaveFocus();
      // What takes the focus, which assistive technologies announce.
      const focused: Element[] = [];
      dialog.element().addEventListener("focusin", (event) => {
        if (event.target instanceof Element) {
          focused.push(event.target);
        }
      });

      await versionTab(dialog, "3.1").click();

      const line = dialog.getByText(TAKEN_V31, { exact: true });
      await expect.element(line).toBeVisible();
      await expectFocusSettledOn(versionTab(dialog, "3.1"));
      expect(focused).toEqual([versionTab(dialog, "3.1").element()]);
    });

    test("marks no tab when the default version is one that the pinned contract does not list", async () => {
      stubSuse(() => ({
        ...assessmentsWith([NVD_V31]),
        default_cvss_version: "5.0",
      }));
      const { screen } = await renderSuse();

      const dialog = await openSuseAdd(screen);

      for (const name of ["CVSS v3.1", "CVSS v4.0"]) {
        const tab = dialog.getByRole("tab", { name, exact: true });
        await expect.element(tab).toBeVisible();
        await expect.element(tab).not.toHaveAccessibleDescription();
      }
      await expect
        .element(dialog.getByRole("tab", { name: "CVSS v3.1", exact: true }))
        .toHaveAttribute("aria-selected", "true");
    });

    test("says in the tab of a version that SUSE has that Edit in its row changes it, with Add SUSE assessment disabled", async () => {
      stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");

      await versionTab(dialog, "3.1").click();

      await expect
        .element(dialog.getByText(TAKEN_V31, { exact: true }))
        .toBeVisible();
      expect(vectorOf(dialog).query()).toBeNull();
      await expect.element(submitOf(dialog)).toBeDisabled();

      await versionTab(dialog, "4.0").click();

      await expect.element(vectorOf(dialog)).toBeVisible();
      await expect.element(submitOf(dialog)).toBeEnabled();
    });

    test("keeps the input of each tab while the user moves between them", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await vectorOf(dialog).fill(VECTOR_V31);
      await versionTab(dialog, "4.0").click();
      await expect.element(vectorOf(dialog)).toHaveValue("");
      await segmentOf(dialog, "Attack requirements", "Present").click();
      await expect.element(vectorOf(dialog)).toHaveValue("CVSS:4.0/AT:P");

      await versionTab(dialog, "3.1").click();
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
      await expect
        .element(segmentOf(dialog, "Availability", "High"))
        .toBeChecked();

      await versionTab(dialog, "4.0").click();
      await expect.element(vectorOf(dialog)).toHaveValue("CVSS:4.0/AT:P");
      await expect
        .element(segmentOf(dialog, "Attack requirements", "Present"))
        .toBeChecked();
    });

    test("reads the assessments again, then adds the vector without its surrounding whitespace with Set or Update SUSE CVSS Assessment, closes, returns the focus to Add SUSE assessment, and announces it once the assessments are read again", async () => {
      let assessments = assessmentsWith([NVD_V40, NVD_V31]);
      const bodies: unknown[] = [];
      const spy = stubSuse(() => assessments, {
        upsertSuse: (body) => {
          bodies.push(body);
          assessments = assessmentsWith([NVD_V40, NVD_V31, SAVED_V31]);
          return suseResponse(SAVED_V31, 201);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      const before = assessmentRequests(spy).length;

      await vectorOf(dialog).fill(`  ${VECTOR_V31}  `);
      await submitOf(dialog).click();

      await expect.element(dialog).not.toBeInTheDocument();
      expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
      await expect
        .poll(() => cvssAnnouncements(screen))
        .toEqual(["SUSE assessment v3.1 added."]);
      expect(assessmentRequests(spy).slice(before)).toEqual([
        `GET ${CVSS}`,
        `POST ${SUSE_ASSESSMENT}`,
        `GET ${CVSS}`,
      ]);
      await expect.element(assessmentRow(screen, "SUSE", "3.1")).toBeVisible();
      await expectFocusSettledOn(addSuse(screen));
    });

    test("stays open after Add on the tab of the other version, which holds input and which SUSE lacks by the read before Add, says above the tabs what it added in a status region, drops the input of the version added, whose tab says that SUSE has it once the read after the change arrives, keeps the focus on Add SUSE assessment, and sends nothing more", async () => {
      let added = false;
      // The read of the assessments after the change, which waits until the
      // test answers it.
      const after = later();
      const bodies: unknown[] = [];
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        cvss: () =>
          added
            ? after.promise
            : cvssResponse(assessmentsWith([NVD_V40, NVD_V31])),
        upsertSuse: (body) => {
          bodies.push(body);
          added = true;
          return suseResponse(SAVED_V31, 201);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await enterInBothTabs(dialog);
      const regions = dialog.getByRole("status").elements();
      const before = assessmentRequests(spy).length;

      await press(submitOf(dialog));

      const text = "SUSE assessment v3.1 added.";
      const message = dialog.getByText(text, { exact: true });
      await expect.element(message).toBeVisible();
      // A status region that was there before it announces it.
      const region = dialog.getByRole("status").filter({ hasText: text });
      expect(regions).toContain(region.element());
      expect(region.element().textContent).toBe(text);
      expect(backgroundBehind(message.element())).toBe(MESSAGE_TONES.success);
      expect(boxOf(message).bottom).toBeLessThanOrEqual(
        boxOf(dialog.getByRole("tablist", { name: "CVSS version" })).top,
      );
      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V40);
      await expectFocusSettledOn(submitOf(dialog));
      expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
      await expect
        .poll(() => assessmentRequests(spy).slice(before))
        .toEqual([`GET ${CVSS}`, `POST ${SUSE_ASSESSMENT}`, `GET ${CVSS}`]);

      await versionTab(dialog, "3.1").click();

      // Before the read after the change arrives, the tab shows its form,
      // empty.
      await expect.element(vectorOf(dialog)).toHaveValue("");
      expect(dialog.getByRole("radio", { checked: true }).elements()).toEqual(
        [],
      );
      after.resolve(
        cvssResponse(assessmentsWith([NVD_V40, NVD_V31, SAVED_V31])),
      );

      await expect
        .element(dialog.getByText(TAKEN_V31, { exact: true }))
        .toBeVisible();
      await readEnded(CVSS);
      await nextFrames();
      await expect.element(dialog).toBeVisible();
      expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
      expect(assessmentRequests(spy).slice(before)).toEqual([
        `GET ${CVSS}`,
        `POST ${SUSE_ASSESSMENT}`,
        `GET ${CVSS}`,
      ]);
      // The dialog says what it added: the part announces nothing.
      expect(cvssAnnouncements(screen)).toEqual([]);
    });

    test("stays open on the tab of the other version after Add submitted with Enter in Vector, whose form leaves with its tab, and keeps the focus on Add SUSE assessment", async () => {
      const bodies: unknown[] = [];
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        upsertSuse: (body) => {
          bodies.push(body);
          return suseResponse(SAVED_V31, 201);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await enterInBothTabs(dialog);
      vectorOf(dialog).element().focus();
      await expect.element(vectorOf(dialog)).toHaveFocus();

      await userEvent.keyboard("{Enter}");

      await expect
        .element(
          dialog.getByText("SUSE assessment v3.1 added.", { exact: true }),
        )
        .toBeVisible();
      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V40);
      await expectFocusSettledOn(submitOf(dialog));
      expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
    });

    test("adds the version of the other tab on Add again, then closes, moves the focus to the Delete of the new row once the read after it no longer shows Add SUSE assessment, and announces what it added", async () => {
      let assessments = assessmentsWith([NVD_V40, NVD_V31]);
      const bodies: unknown[] = [];
      stubSuse(() => assessments, {
        upsertSuse: (body) => {
          bodies.push(body);
          if (bodies.length === 1) {
            assessments = assessmentsWith([NVD_V40, NVD_V31, SAVED_V31]);
            return suseResponse(SAVED_V31, 201);
          }
          assessments = assessmentsWith([
            NVD_V40,
            SAVED_V40,
            NVD_V31,
            SAVED_V31,
          ]);
          return suseResponse(SAVED_V40, 201);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await enterInBothTabs(dialog);
      await submitOf(dialog).click();
      await expect
        .element(
          dialog.getByText("SUSE assessment v3.1 added.", { exact: true }),
        )
        .toBeVisible();
      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");

      await submitOf(dialog).click();

      await expect.element(dialog).not.toBeInTheDocument();
      expect(bodies).toEqual([
        { vector_string: VECTOR_V31 },
        { vector_string: VECTOR_V40 },
      ]);
      await expect
        .poll(() => cvssAnnouncements(screen))
        .toEqual(["SUSE assessment v4.0 added."]);
      await expect.element(addSuse(screen)).not.toBeInTheDocument();
      await expect.element(assessmentRow(screen, "SUSE", "4.0")).toBeVisible();
      await expect.element(assessmentRow(screen, "SUSE", "3.1")).toBeVisible();
      await expectFocusSettledOn(deleteSuse(screen, "4.0"));
    });

    test("asks Discard changes? on Cancel after an Add after which it stays open only for the input of the other tab, and closes without asking once that input is gone", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        upsertSuse: () => suseResponse(SAVED_V31, 201),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await enterInBothTabs(dialog);
      await press(submitOf(dialog));
      await expect
        .element(
          dialog.getByText("SUSE assessment v3.1 added.", { exact: true }),
        )
        .toBeVisible();
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V40);

      await dialog.getByRole("button", { name: "Cancel" }).click();

      const discard = screen.getByRole("dialog", { name: "Discard changes?" });
      await expect
        .element(
          discard.getByText(
            "The SUSE assessment that you entered isn't added.",
          ),
        )
        .toBeVisible();
      await discard.getByRole("button", { name: "Keep editing" }).click();
      await expect.element(discard).not.toBeInTheDocument();
      await vectorOf(dialog).fill("");

      await dialog.getByRole("button", { name: "Cancel" }).click();

      await expect.element(dialog).not.toBeInTheDocument();
      expect(discard.query()).toBeNull();
    });

    test.each<
      [
        string,
        CVSSAssessmentItem[],
        (dialog: Locator) => Promise<void>,
        (screen: Screen) => Locator,
      ]
    >([
      [
        "the other tab holds no input",
        [],
        async (dialog) => {
          await enterInBothTabs(dialog);
          await versionTab(dialog, "4.0").click();
          await vectorOf(dialog).fill("");
          await versionTab(dialog, "3.1").click();
          await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
        },
        (screen) => addSuse(screen),
      ],
      [
        "the read before Add shows that SUSE has the version of the other tab by then",
        [SUSE_V40],
        enterInBothTabs,
        (screen) => deleteSuse(screen, "3.1"),
      ],
    ])(
      "closes after Add when %s, and announces what it added, with the focus as after every Add",
      async (_, meanwhile, enter, focused) => {
        let assessments = assessmentsWith([NVD_V40, NVD_V31]);
        const bodies: unknown[] = [];
        stubSuse(() => assessments, {
          upsertSuse: (body) => {
            bodies.push(body);
            assessments = assessmentsWith([
              NVD_V40,
              ...meanwhile,
              NVD_V31,
              SAVED_V31,
            ]);
            return suseResponse(SAVED_V31, 201);
          },
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await enter(dialog);
        // What another analyst added meanwhile.
        assessments = assessmentsWith([NVD_V40, ...meanwhile, NVD_V31]);

        await submitOf(dialog).click();

        await expect.element(dialog).not.toBeInTheDocument();
        expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
        await expect
          .poll(() => cvssAnnouncements(screen))
          .toEqual(["SUSE assessment v3.1 added."]);
        await expectFocusSettledOn(focused(screen));
      },
    );

    test("says in place of the form that SUSE has the version, with Add SUSE assessment disabled and the focus on that line, without adding it, when the read before the change shows that SUSE has it by then", async () => {
      let assessments = assessmentsWith([NVD_V40, NVD_V31]);
      const spy = stubSuse(() => assessments);
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      // Meanwhile another analyst added it.
      assessments = assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]);
      const reads = readsOf(spy, CVSS);

      await press(submitOf(dialog));

      const line = dialog.getByText(TAKEN_V31, { exact: true });
      await expect.element(line).toBeVisible();
      await expectFocusSettledOn(line);
      expect(vectorOf(dialog).query()).toBeNull();
      await expect.element(submitOf(dialog)).toBeDisabled();
      expect(
        dialog
          .getByText(
            "SUSE already has a CVSS v3.1 assessment: edit it in its row.",
          )
          .query(),
      ).toBeNull();
      expect(readsOf(spy, CVSS)).toBe(reads + 1);
      expect(requestsWith(spy, "POST")).toHaveLength(0);
    });

    test("turns the tab of a version into the line that says that SUSE has it once a read while it is open shows that SUSE has it, and keeps the form of the other tab", async () => {
      let assessments = assessmentsWith([NVD_V40, NVD_V31]);
      stubSuse(() => assessments);
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect.element(vectorOf(dialog)).toBeVisible();
      // Meanwhile another analyst added it.
      assessments = assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]);

      await returnToForeground();

      await expect
        .element(dialog.getByText(TAKEN_V31, { exact: true }))
        .toBeVisible();
      expect(vectorOf(dialog).query()).toBeNull();
      await expect.element(submitOf(dialog)).toBeDisabled();

      await versionTab(dialog, "4.0").click();

      await expect.element(vectorOf(dialog)).toBeVisible();
      await expect.element(submitOf(dialog)).toBeEnabled();
    });

    test.each([
      ["", false],
      [", also after the user has opened the other tab and come back", true],
    ])(
      "keeps the focus in the dialog, on the line that says that SUSE has the version, when a read while it is open replaces the form that holds it with that line%s",
      async (_, switched) => {
        let assessments = assessmentsWith([NVD_V40, NVD_V31]);
        stubSuse(() => assessments);
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        if (switched) {
          await versionTab(dialog, "4.0").click();
          await expect
            .element(metricOf(dialog, "Attack requirements"))
            .toBeVisible();
          await versionTab(dialog, "3.1").click();
          await expect.element(metricOf(dialog, "Scope")).toBeVisible();
        }
        await vectorOf(dialog).fill(VECTOR_V31);
        await expect.element(vectorOf(dialog)).toHaveFocus();
        assessments = assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]);

        await returnToForeground();

        const line = dialog.getByText(TAKEN_V31, { exact: true });
        await expect.element(line).toBeVisible();
        await expectFocusSettledOn(line);
      },
    );

    test("marks the default version as the read of the assessments shows it while it is open", async () => {
      let assessments = assessmentsWith([NVD_V40, NVD_V31], "3.1");
      stubSuse(() => assessments);
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect.element(markedTab(dialog, "3.1")).toBeVisible();
      // Meanwhile an administrator changed the default CVSS version.
      assessments = assessmentsWith([NVD_V40, NVD_V31], "4.0");

      await returnToForeground();

      await expect.element(markedTab(dialog, "4.0")).toBeVisible();
      await expect
        .element(markedTab(dialog, "4.0"))
        .toHaveAccessibleDescription(DEFAULT_VERSION_TEXT);
      const other = dialog.getByRole("tab", { name: "CVSS v3.1", exact: true });
      await expect.element(other).not.toHaveAccessibleDescription();
      // The version of the form stays the one that the user sees.
      await expect.element(other).toHaveAttribute("aria-selected", "true");
    });

    test("stays open with its form and its input once a new read of the assessments fails with a 404", async () => {
      let fails = false;
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        cvss: () =>
          fails
            ? errorResponse(404, "CVE_NOT_FOUND")
            : cvssResponse(assessmentsWith([NVD_V40, NVD_V31])),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      // Meanwhile Sentinel no longer finds the CVE.
      fails = true;

      await returnToForeground();

      // The part shows the error behind the dialog.
      await expect.element(screen.getByText(MESSAGE_GONE)).toBeVisible();
      await nextFrames();
      await expect.element(dialog).toBeVisible();
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
      await expect
        .element(segmentOf(dialog, "Availability", "High"))
        .toBeChecked();
      await expect.element(submitOf(dialog)).toBeEnabled();
    });

    test("shows the failure of the read before the change at the top of the form, which takes the focus and keeps the input, without adding it", async () => {
      let fails = false;
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        cvss: () =>
          fails
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : cvssResponse(assessmentsWith([NVD_V40, NVD_V31])),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      fails = true;

      await submitOf(dialog).click();

      const error = dialog.getByText(MESSAGE_UNAVAILABLE);
      await expect.element(error).toBeVisible();
      expect(backgroundBehind(error.element())).toBe(MESSAGE_TONES.danger);
      await expect.element(dialog.getByText(REFERENCE)).toBeVisible();
      await expectFocusOnError(error);
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
      await expect.element(vectorOf(dialog)).not.toBeInvalid();
      expect(requestsWith(spy, "POST")).toHaveLength(0);
    });

    test("is busy from the read before the change until Sentinel answers the change, sends one change, and cannot be closed meanwhile", async () => {
      const reread = later();
      const response = later();
      let submitted = false;
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        cvss: () =>
          submitted
            ? reread.promise
            : cvssResponse(assessmentsWith([NVD_V40, NVD_V31])),
        upsertSuse: () => response.promise,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      submitted = true;

      await userEvent.keyboard("{Enter}");

      const button = submitOf(dialog);
      await expect.element(button).toHaveAttribute("aria-disabled", "true");
      await expect
        .element(dialog.getByRole("button", { name: "Cancel" }))
        .toBeDisabled();
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => readsOf(spy, CVSS)).toBe(2);
      expect(requestsWith(spy, "POST")).toHaveLength(0);
      reread.resolve(cvssResponse(assessmentsWith([NVD_V40, NVD_V31])));
      await expect.poll(() => requestsWith(spy, "POST")).toHaveLength(1);
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard("{Escape}");
      await expect.element(button).toHaveAttribute("aria-disabled", "true");
      await expect.element(dialog).toBeVisible();
      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();

      response.resolve(suseResponse(SAVED_V31, 201));

      await expect.element(dialog).not.toBeInTheDocument();
      expect(requestsWith(spy, "POST")).toHaveLength(1);
    });

    test.each([
      ["with the pointer", false],
      ["from the keyboard", true],
    ])(
      "moves the focus from Add SUSE assessment to the Delete of the new row once the read after Add of the last version that SUSE lacked, pressed %s, shows the row and no longer Add SUSE assessment",
      async (_, keyboard) => {
        let assessments = assessmentsWith([SUSE_V40, NVD_V31]);
        stubSuse(() => assessments, {
          upsertSuse: () => {
            assessments = assessmentsWith([SUSE_V40, NVD_V31, SAVED_V31]);
            return suseResponse(SAVED_V31, 201);
          },
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await vectorOf(dialog).fill(VECTOR_V31);

        // The table takes a focus that enters it from the keyboard to the row
        // that it holds as focused, its first row at first.
        if (keyboard) {
          await press(submitOf(dialog));
        } else {
          await submitOf(dialog).click();
        }

        await expect.element(dialog).not.toBeInTheDocument();
        await expect.element(addSuse(screen)).not.toBeInTheDocument();
        await expect
          .element(assessmentRow(screen, "SUSE", "3.1"))
          .toBeVisible();
        await expectFocusSettledOn(deleteSuse(screen, "3.1"));
      },
    );

    test("moves the focus no more once the read after Add fails, and to the screen's heading when a later read removes Add SUSE assessment", async () => {
      let phase: "before" | "failing" | "added" = "before";
      stubSuse(() => assessmentsWith([SUSE_V40, NVD_V31]), {
        cvss: () => {
          if (phase === "failing") {
            return errorResponse(503, "DATABASE_UNAVAILABLE");
          }
          return cvssResponse(
            phase === "added"
              ? assessmentsWith([SUSE_V40, NVD_V31, SAVED_V31])
              : assessmentsWith([SUSE_V40, NVD_V31]),
          );
        },
        upsertSuse: () => {
          phase = "failing";
          return suseResponse(SAVED_V31, 201);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);

      await submitOf(dialog).click();

      await expect.element(dialog).not.toBeInTheDocument();
      await expect
        .element(cvssPart(screen).getByText(/^This couldn't be updated\./))
        .toBeVisible();
      await expectFocusSettledOn(addSuse(screen));
      // Meanwhile Sentinel shows the assessment that it added.
      phase = "added";

      await returnToForeground();

      await expect.element(addSuse(screen)).not.toBeInTheDocument();
      await expect.element(assessmentRow(screen, "SUSE", "3.1")).toBeVisible();
      await expectFocusSettledOn(screenHeading(screen));
    });

    test("hides the tooltip of the default version with Escape and stays open", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect.element(startFromOf(dialog)).toHaveFocus();

      // Back to the tab of the default version, from the keyboard.
      await userEvent.keyboard("{Shift>}{Tab}{/Shift}");

      await expect.element(markedTab(dialog, "3.1")).toHaveFocus();
      const tooltip = page.getByRole("tooltip");
      await expect.element(tooltip).toBeVisible();
      expect(tooltip.element().textContent).toBe(DEFAULT_VERSION_TEXT);
      await userEvent.keyboard("{Escape}");
      await expect.element(tooltip).not.toBeInTheDocument();
      await frames();
      await expect.element(dialog).toBeVisible();
      await expect.element(markedTab(dialog, "3.1")).toHaveFocus();

      // Without the tooltip, Escape closes the dialog.
      await userEvent.keyboard("{Escape}");

      await expect.element(dialog).not.toBeInTheDocument();
    });
  });

  describe("Start from", () => {
    test("is optional and empty as Add SUSE assessment opens, and offers the assessments of the other providers of the version alone, each by its provider, its score, and its severity with its mark", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, CNA_V31, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      const field = dialog.getByRole("button", {
        name: "Start from (optional)",
        exact: true,
      });
      await expect.element(field).toBeVisible();
      expect(field.element().textContent).toBe("");
      const optional = dialog.getByText("(optional)", { exact: true });
      expect(getComputedStyle(optional.element()).color).toBe(FG_MUTED);
      expect(getComputedStyle(optional.element()).fontWeight).toBe("400");

      const options = await openStartFrom(dialog);

      expect(
        options
          .getByRole("option")
          .elements()
          .map((option) => option.textContent),
      ).toEqual(["Fictional CNA, 7.5 High", "NVD, 8.1 High"]);
      for (const option of options.getByRole("option").elements()) {
        expect(option.getAttribute("aria-selected")).not.toBe("true");
        // The mark of the severity, which assistive technologies do not read.
        expect(markOf(option)).toBe(MARK_HIGH);
      }
      // Assistive technologies, and the keyboard, find each by its text.
      await expect
        .element(
          options.getByRole("option", { name: "NVD, 8.1 High", exact: true }),
        )
        .toBeVisible();
    });

    test("fills the vector of the assessment chosen, which chooses its metrics", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, CNA_V31, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      const options = await openStartFrom(dialog);

      await options
        .getByRole("option", { name: "NVD, 8.1 High", exact: true })
        .click();

      await expect.element(vectorOf(dialog)).toHaveValue(NVD_V31_VECTOR);
      // The field shows the option as the option shows it.
      const field = dialog.getByRole("button", {
        name: "NVD, 8.1 High Start from (optional)",
        exact: true,
      });
      await expect.element(field).toBeVisible();
      expect(field.element().textContent).toBe("NVD, 8.1 High");
      expect(markOf(field.element())).toBe(MARK_HIGH);
      expect(choicesOf(dialog, METRICS_V31)).toEqual([
        "Network",
        "High",
        "None",
        "None",
        "Unchanged",
        "High",
        "High",
        "High",
      ]);
    });

    test("is not offered without an assessment of another provider of the version", async () => {
      stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();

      const dialog = await openSuseAdd(screen);

      await expect.element(vectorOf(dialog)).toBeVisible();
      expect(startFromOf(dialog).query()).toBeNull();
    });

    test("starts in Edit, labelled Start from (optional), at the assessment as saved, and offers it before the assessments of the other providers", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      const field = dialog.getByRole("button", {
        name: "SUSE, as saved, 5.5 Medium Start from (optional)",
        exact: true,
      });
      await expect.element(field).toBeVisible();
      expect(field.element().textContent).toBe("SUSE, as saved, 5.5 Medium");
      expect(markOf(field.element())).toBe(MARK_MEDIUM);
      const optional = dialog.getByText("(optional)", { exact: true });
      await expect.element(optional).toBeVisible();
      expect(getComputedStyle(optional.element()).color).toBe(FG_MUTED);
      expect(getComputedStyle(optional.element()).fontWeight).toBe("400");
      await expect
        .element(vectorOf(dialog))
        .toHaveValue(SUSE_V31.vector_string);

      const options = await openStartFrom(dialog);
      expect(
        options
          .getByRole("option")
          .elements()
          .map((option) => option.textContent),
      ).toEqual(["SUSE, as saved, 5.5 Medium", "NVD, 8.1 High"]);
      expect(
        options
          .getByRole("option")
          .elements()
          .map((option) => markOf(option)),
      ).toEqual([MARK_MEDIUM, MARK_HIGH]);
      await options
        .getByRole("option", { name: "NVD, 8.1 High", exact: true })
        .click();
      await expect.element(vectorOf(dialog)).toHaveValue(NVD_V31_VECTOR);

      await (
        await openStartFrom(dialog)
      )
        .getByRole("option", {
          name: "SUSE, as saved, 5.5 Medium",
          exact: true,
        })
        .click();

      await expect
        .element(vectorOf(dialog))
        .toHaveValue(SUSE_V31.vector_string);
    });

    test.each<
      [
        string,
        CVSSAssessmentItem[],
        (screen: Screen) => Promise<Locator>,
        string,
        string,
        [string, string],
      ]
    >([
      [
        "the assessment as saved, as Edit opens",
        [NVD_V40, NVD_V31, SUSE_V31],
        (screen) => openSuseEdit(screen),
        "SUSE, as saved, 5.5 Medium",
        SUSE_V31.vector_string,
        ["High", "None"],
      ],
      [
        "the assessment of NVD, once chosen in Add",
        [NVD_V40, NVD_V31],
        async (screen) => {
          const dialog = await openSuseAdd(screen);
          await (
            await openStartFrom(dialog)
          )
            .getByRole("option", { name: "NVD, 8.1 High", exact: true })
            .click();
          return dialog;
        },
        "NVD, 8.1 High",
        NVD_V31_VECTOR,
        ["Low", "High"],
      ],
    ])(
      "shows %s while the form holds its vector, nothing once a metric changes it, and the assessment again when the user chooses it, when the metrics return to its vector, and when the user enters it with surrounding whitespace",
      async (_, assessments, open, option, vector, [changed, original]) => {
        stubSuse(() => assessmentsWith(assessments));
        const { screen } = await renderSuse();
        const dialog = await open(screen);
        const shown = dialog.getByRole("button", {
          name: `${option} Start from (optional)`,
          exact: true,
        });
        const empty = dialog.getByRole("button", {
          name: "Start from (optional)",
          exact: true,
        });
        await expect.element(shown).toBeVisible();
        await expect.element(vectorOf(dialog)).toHaveValue(vector);

        await segmentOf(dialog, "Integrity", changed).click();

        await expect.element(empty).toBeVisible();
        expect(empty.element().textContent).toBe("");
        expect(markOf(empty.element())).toBeUndefined();

        await (
          await openStartFrom(dialog)
        )
          .getByRole("option", { name: option, exact: true })
          .click();

        await expect.element(vectorOf(dialog)).toHaveValue(vector);
        await expect.element(shown).toBeVisible();
        expect(shown.element().textContent).toBe(option);
        await segmentOf(dialog, "Integrity", changed).click();
        await expect.element(empty).toBeVisible();

        await segmentOf(dialog, "Integrity", original).click();

        await expect.element(vectorOf(dialog)).toHaveValue(vector);
        await expect.element(shown).toBeVisible();
        // CNA_V31's vector, which no assessment that it offers has.
        await vectorOf(dialog).fill(VECTOR_V31);
        await expect.element(empty).toBeVisible();

        await vectorOf(dialog).fill(`  ${vector} `);

        await expect.element(shown).toBeVisible();
        expect(shown.element().textContent).toBe(option);
      },
    );

    test("shows the first of two assessments with the vector that the form holds, also once the user chooses the second", async () => {
      // An assessment of another provider with CNA_V31's vector, after it.
      const same = fictionalAssessment({
        ...CNA_V31,
        id: "00000000-0000-0000-0000-0000000000e4",
        provider_name: "Fictional Security Team",
      });
      stubSuse(() => assessmentsWith([NVD_V40, CNA_V31, same, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      const first = dialog.getByRole("button", {
        name: "Fictional CNA, 7.5 High Start from (optional)",
        exact: true,
      });

      await vectorOf(dialog).fill(VECTOR_V31);

      await expect.element(first).toBeVisible();
      expect(first.element().textContent).toBe("Fictional CNA, 7.5 High");
      const options = await openStartFrom(dialog);
      expect(
        options
          .getByRole("option")
          .elements()
          .map((option) => option.textContent),
      ).toEqual([
        "Fictional CNA, 7.5 High",
        "Fictional Security Team, 7.5 High",
        "NVD, 8.1 High",
      ]);

      await options
        .getByRole("option", {
          name: "Fictional Security Team, 7.5 High",
          exact: true,
        })
        .click();

      await expect.element(options).not.toBeInTheDocument();
      await nextFrames();
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
      expect(first.element().textContent).toBe("Fictional CNA, 7.5 High");
    });
  });

  describe("the metrics", () => {
    test.each<
      [
        string,
        CVECVSSAssessments["default_cvss_version"],
        string[],
        [string, string[]][],
      ]
    >([
      [
        "v3.1",
        "3.1",
        ["Exploitability", "Scope", "Impact"],
        [
          ["Attack vector", ["Physical", "Local", "Adjacent", "Network"]],
          ["Attack complexity", ["High", "Low"]],
          ["Privileges required", ["High", "Low", "None"]],
          ["User interaction", ["Required", "None"]],
          ["Scope", ["Unchanged", "Changed"]],
          ["Confidentiality", ["None", "Low", "High"]],
          ["Integrity", ["None", "Low", "High"]],
          ["Availability", ["None", "Low", "High"]],
        ],
      ],
      [
        "v4.0",
        "4.0",
        ["Exploitability", "Vulnerable system", "Subsequent system"],
        [
          ["Attack vector", ["Physical", "Local", "Adjacent", "Network"]],
          ["Attack complexity", ["High", "Low"]],
          ["Attack requirements", ["Present", "None"]],
          ["Privileges required", ["High", "Low", "None"]],
          ["User interaction", ["Active", "Passive", "None"]],
          ["Confidentiality Vulnerable system", ["None", "Low", "High"]],
          ["Integrity Vulnerable system", ["None", "Low", "High"]],
          ["Availability Vulnerable system", ["None", "Low", "High"]],
          ["Confidentiality Subsequent system", ["None", "Low", "High"]],
          ["Integrity Subsequent system", ["None", "Low", "High"]],
          ["Availability Subsequent system", ["None", "Low", "High"]],
        ],
      ],
    ])(
      "of %s show in the groups of the version, each metric a segmented control of its values, none chosen as Add opens, a name that repeats named with its group",
      async (_, version, groups, metrics) => {
        stubSuse(() => assessmentsWith([NVD_V40, NVD_V31], version));
        const { screen } = await renderSuse();

        const dialog = await openSuseAdd(screen);

        expect(
          dialog
            .getByRole("heading", { level: 3 })
            .elements()
            .map((heading) => heading.textContent),
        ).toEqual(groups);
        expect(dialog.getByRole("radiogroup").elements()).toEqual(
          metrics.map(([name]) => metricOf(dialog, name).element()),
        );
        for (const [name, values] of metrics) {
          expect(
            metricOf(dialog, name)
              .getByRole("radio")
              .elements()
              .map((radio) => radio.textContent),
          ).toEqual(values);
        }
        expect(dialog.getByRole("radio", { checked: true }).elements()).toEqual(
          [],
        );
      },
    );

    // The form of v3.1 with Start from, and that of v4.0 without it, as no
    // other provider has an assessment of v4.0.
    test.each<
      [number, CVECVSSAssessments["default_cvss_version"], string, string]
    >([
      [1280, "3.1", "with Start from", "Scope"],
      [320, "3.1", "with Start from", "Scope"],
      [1280, "4.0", "without Start from", "Vulnerable system"],
      [320, "4.0", "without Start from", "Vulnerable system"],
    ])(
      "stand at %i CSS pixels, for v%s %s, in two columns where the dialog is wide enough and otherwise in one, the name of each metric before its values or, in a narrow form, above them, without scrolling sideways",
      async (width, version, _, second) => {
        await page.viewport(width, 800);
        stubSuse(() => assessmentsWith([NVD_V31], version));
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        const exploitability = dialog.getByRole("heading", {
          level: 3,
          name: "Exploitability",
          exact: true,
        });
        const next = dialog.getByRole("heading", {
          level: 3,
          name: second,
          exact: true,
        });
        await expect.element(next).toBeVisible();
        // The metrics of Exploitability, the last of which is User
        // interaction.
        const firstColumn =
          version === "3.1" ? METRICS_V31.slice(0, 4) : METRICS_V40.slice(0, 5);
        const last = boxOf(metricOf(dialog, "User interaction"));
        const name = boxOf(dialog.getByText("Attack vector", { exact: true }));
        const control = boxOf(metricOf(dialog, "Attack vector"));

        if (width === 1280) {
          // The second group stands beside Exploitability, 40 px after the
          // widest control of the first column at least.
          expect(
            Math.abs(boxOf(next).top - boxOf(exploitability).top),
          ).toBeLessThan(1);
          const widest = Math.max(
            ...firstColumn.map(
              (metric) => boxOf(metricOf(dialog, metric)).right,
            ),
          );
          expect(boxOf(next).left - widest).toBeGreaterThanOrEqual(40);
          // The name stands at the start of the line of its values.
          expect(name.right).toBeLessThanOrEqual(control.left);
          expect(name.top).toBeLessThan(control.bottom);
          expect(name.bottom).toBeGreaterThan(control.top);
        } else {
          expect(boxOf(next).top).toBeGreaterThanOrEqual(last.bottom);
          expect(name.bottom).toBeLessThanOrEqual(control.top);
          expect(boxOf(dialog).right).toBeLessThanOrEqual(width);
        }
        const content = contentScrollerOf(
          metricOf(dialog, "Attack vector").element(),
        );
        expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
        expect(document.documentElement.scrollWidth).toBe(width);
      },
    );

    test("write the vector of the metrics chosen, in the order of FIRST, as the user chooses them", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await segmentOf(dialog, "Availability", "High").click();
      await expect.element(vectorOf(dialog)).toHaveValue("CVSS:3.1/A:H");
      await segmentOf(dialog, "Attack vector", "Network").click();
      await expect.element(vectorOf(dialog)).toHaveValue("CVSS:3.1/AV:N/A:H");
      await segmentOf(dialog, "Scope", "Changed").click();
      await expect
        .element(vectorOf(dialog))
        .toHaveValue("CVSS:3.1/AV:N/S:C/A:H");

      await segmentOf(dialog, "Attack vector", "Local").click();

      await expect
        .element(vectorOf(dialog))
        .toHaveValue("CVSS:3.1/AV:L/S:C/A:H");
      expect(choicesOf(dialog, METRICS_V31)).toEqual([
        "Local",
        null,
        null,
        null,
        "Changed",
        null,
        null,
        "High",
      ]);
    });

    test("write the metric of the group chosen in v4.0, whose names repeat", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31], "4.0"));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await segmentOf(
        dialog,
        "Confidentiality Subsequent system",
        "High",
      ).click();
      await expect.element(vectorOf(dialog)).toHaveValue("CVSS:4.0/SC:H");
      await segmentOf(
        dialog,
        "Confidentiality Vulnerable system",
        "Low",
      ).click();

      await expect.element(vectorOf(dialog)).toHaveValue("CVSS:4.0/VC:L/SC:H");
    });

    test("are chosen by a vector that the user enters, and by nothing of another version", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await vectorOf(dialog).fill(
        "CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:C/C:L/I:N/A:H",
      );

      await expect
        .poll(() => choicesOf(dialog, METRICS_V31))
        .toEqual([
          "Local",
          "High",
          "High",
          "Required",
          "Changed",
          "Low",
          "None",
          "High",
        ]);

      await vectorOf(dialog).fill("CVSS:3.1/AV:P/AC:L");
      await expect
        .poll(() => choicesOf(dialog, METRICS_V31))
        .toEqual(["Physical", "Low", null, null, null, null, null, null]);
      // A choice then adds to what the vector chose.
      await segmentOf(dialog, "Integrity", "Low").click();
      await expect
        .element(vectorOf(dialog))
        .toHaveValue("CVSS:3.1/AV:P/AC:L/I:L");

      await vectorOf(dialog).fill(VECTOR_V40);
      await expect
        .poll(() => dialog.getByRole("radio", { checked: true }).elements())
        .toEqual([]);
    });

    test("show below a metric whose choice differs from another provider's assessment of the version that provider's value, which describes its control, and nothing below one that matches", async () => {
      stubSuse(() => assessmentsWith([NVD_V40, CNA_V31, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect.element(metricOf(dialog, "Attack vector")).toBeVisible();
      expect(dialog.getByText(/^(NVD|Fictional CNA): /).elements()).toEqual([]);

      await vectorOf(dialog).fill(
        "CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      );

      // Both assessments of v3.1, and not NVD's of v4.0, whose vector also
      // says AV:N.
      await expect
        .element(metricOf(dialog, "Attack vector"))
        .toHaveAccessibleDescription("Fictional CNA: Network · NVD: Network");
      await expect
        .element(metricOf(dialog, "Attack complexity"))
        .toHaveAccessibleDescription("NVD: High");
      await expect
        .element(metricOf(dialog, "Confidentiality"))
        .toHaveAccessibleDescription("Fictional CNA: None");
      for (const name of [
        "Privileges required",
        "User interaction",
        "Scope",
        "Availability",
      ]) {
        await expect
          .element(metricOf(dialog, name))
          .not.toHaveAccessibleDescription();
      }
      const note = dialog.getByText("NVD: High", { exact: true });
      expect(boxOf(note).top).toBeGreaterThanOrEqual(
        boxOf(metricOf(dialog, "Attack complexity")).bottom,
      );
    });

    test("show another provider's value below the values of its metric, where they start, in a form narrower than 320 px, without scrolling sideways", async () => {
      await page.viewport(320, 800);
      stubSuse(() => assessmentsWith([NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await vectorOf(dialog).fill(
        "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      );

      const control = metricOf(dialog, "Attack complexity");
      await expect.element(control).toHaveAccessibleDescription("NVD: High");
      const note = boxOf(dialog.getByText("NVD: High", { exact: true }));
      expect(note.top).toBeGreaterThanOrEqual(boxOf(control).bottom);
      expect(note.left).toBe(boxOf(control).left);
      const content = contentScrollerOf(control.element());
      expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
    });

    test("wrap the values of other providers below a metric within the column of the controls, which they do not widen, without scrolling sideways", async () => {
      stubSuse(() =>
        assessmentsWith([
          fictionalAssessment({
            id: "00000000-0000-0000-0000-0000000000e1",
            provider_name:
              "Fictional Coordinated Vulnerability Disclosure Program",
          }),
          fictionalAssessment({
            id: "00000000-0000-0000-0000-0000000000e2",
            provider_name: "Fictional Open Source Security Response Foundation",
            metrics: { ...NVD_V31.metrics, attack_vector: "adjacent" },
          }),
          fictionalAssessment({
            id: "00000000-0000-0000-0000-0000000000e3",
            provider_name:
              "Fictional Regional Computer Emergency Response Team",
            metrics: { ...NVD_V31.metrics, attack_vector: "local" },
          }),
        ]),
      );
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      // Physical, which none of them chooses, and their other metrics.
      await vectorOf(dialog).fill(
        "CVSS:3.1/AV:P/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
      );

      const control = metricOf(dialog, "Attack vector");
      await expect
        .element(control)
        .toHaveAccessibleDescription(
          /^Fictional Coordinated Vulnerability Disclosure Program: .+ · Fictional Open Source Security Response Foundation: .+ · Fictional Regional Computer Emergency Response Team: /,
        );
      const note = dialog.getByText(
        /^Fictional Coordinated Vulnerability Disclosure Program: /,
      );
      expect(boxOf(note).height).toBeGreaterThan(
        Number.parseFloat(getComputedStyle(note.element()).lineHeight),
      );
      // The controls of the column of Attack vector, the widest of which
      // ends where the column ends.
      const controls = METRICS_V31.slice(0, 4).map((name) =>
        boxOf(metricOf(dialog, name)),
      );
      expect(boxOf(note).left).toBe(boxOf(control).left);
      expect(boxOf(note).right).toBeLessThanOrEqual(
        Math.max(...controls.map((box) => box.right)),
      );
      const content = contentScrollerOf(control.element());
      expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
    });

    test("show no note for a value of another provider that the pinned contract does not list", async () => {
      stubSuse(() => ({
        ...assessmentsWith([]),
        assessments: [
          {
            ...NVD_V31,
            metrics: { ...NVD_V31.metrics, attack_vector: "fictional_vector" },
          },
        ],
      }));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await vectorOf(dialog).fill(
        "CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      );

      await expect
        .element(metricOf(dialog, "Attack complexity"))
        .toHaveAccessibleDescription("NVD: High");
      await expect
        .element(metricOf(dialog, "Attack vector"))
        .not.toHaveAccessibleDescription();
      expect(dialog.getByText(/^NVD: /).elements()).toHaveLength(1);
    });
  });

  describe("the checks of the vector", () => {
    test.each<[string, CVSSAssessmentItem[], string, string]>([
      [
        "an empty vector",
        [NVD_V40, NVD_V31],
        "",
        "Choose the metrics, or enter the vector.",
      ],
      [
        "a vector of whitespace alone",
        [NVD_V40, NVD_V31],
        "   ",
        "Choose the metrics, or enter the vector.",
      ],
      [
        "a vector longer than 200 characters, counted by code point",
        [NVD_V40, NVD_V31],
        `CVSS:3.1/${"😀".repeat(192)}`,
        "Enter at most 200 characters.",
      ],
      [
        "a vector of v4.0, which SUSE lacks too",
        [NVD_V40, NVD_V31],
        VECTOR_V40,
        "Enter a CVSS v3.1 vector, which starts with CVSS:3.1/.",
      ],
      [
        "a vector without a version",
        [NVD_V40, NVD_V31],
        "AV:N/AC:L/Au:N/C:P/I:P/A:P",
        "Enter a CVSS v3.1 vector, which starts with CVSS:3.1/.",
      ],
      [
        "a vector of v4.0, which SUSE has",
        [SUSE_V40, NVD_V31],
        VECTOR_V40,
        "SUSE already has a CVSS v4.0 assessment: edit it in its row.",
      ],
    ])(
      "state the error of %s in Add at the vector, which takes the focus, without a request",
      async (_, assessments, vector, message) => {
        const spy = stubSuse(() => assessmentsWith(assessments));
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await expect
          .element(versionTab(dialog, "3.1"))
          .toHaveAttribute("aria-selected", "true");
        if (vector !== "") {
          await vectorOf(dialog).fill(vector);
        }
        const reads = readsOf(spy, CVSS);

        await press(submitOf(dialog));

        const field = vectorOf(dialog);
        await expect
          .element(field)
          .toHaveAccessibleDescription(`${VECTOR_DESCRIPTION} ${message}`);
        await expect.element(field).toBeInvalid();
        await expect.element(field).toHaveFocus();
        expect(readsOf(spy, CVSS)).toBe(reads);
        expect(requestsWith(spy, "POST")).toHaveLength(0);
      },
    );

    test.each([
      ["an empty vector", "", "Choose the metrics, or enter the vector."],
      [
        "a vector of v4.0, also when SUSE has an assessment of v4.0",
        VECTOR_V40,
        "Enter a CVSS v3.1 vector, which starts with CVSS:3.1/.",
      ],
    ])(
      "state the error of %s in Edit at the vector, without a request",
      async (_, vector, message) => {
        const spy = stubSuse(() => assessmentsWith([SUSE_V40, SUSE_V31]));
        const { screen } = await renderSuse();
        const dialog = await openSuseEdit(screen);
        await vectorOf(dialog).fill(vector);

        await press(submitOf(dialog, "Save"));

        const field = vectorOf(dialog);
        await expect
          .element(field)
          .toHaveAccessibleDescription(`${VECTOR_DESCRIPTION} ${message}`);
        await expect.element(field).toHaveFocus();
        expect(requestsWith(spy, "POST")).toHaveLength(0);
      },
    );

    test("accept a vector of 200 characters, counted by code point as Sentinel counts them", async () => {
      // 200 code points, of which the emoji take two code units each.
      const vector = `CVSS:3.1/${"😀".repeat(191)}`;
      const bodies: unknown[] = [];
      stubSuse(() => fictionalCvssAssessments(), {
        upsertSuse: (body) => {
          bodies.push(body);
          return errorResponse(422, "CVSS_INVALID_VECTOR");
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(vector);

      await press(submitOf(dialog, "Save"));

      await expect
        .element(vectorOf(dialog))
        .toHaveAccessibleDescription(
          `${VECTOR_DESCRIPTION} Sentinel doesn't accept this vector. Enter a complete CVSS v3.1 Base vector.`,
        );
      expect(bodies).toEqual([{ vector_string: vector }]);
    });

    test.each<[string, (dialog: Locator) => Promise<void>]>([
      [
        "the user types",
        async (dialog) => {
          await vectorOf(dialog).fill("C");
        },
      ],
      [
        "the user chooses a metric",
        async (dialog) => {
          await segmentOf(dialog, "Scope", "Unchanged").click();
        },
      ],
      [
        "the user moves to another tab",
        async (dialog) => {
          await versionTab(dialog, "4.0").click();
          await versionTab(dialog, "3.1").click();
        },
      ],
    ])("clear the error once %s", async (_, change) => {
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await press(submitOf(dialog));
      await expect.element(vectorOf(dialog)).toBeInvalid();

      await change(dialog);

      await expect.element(vectorOf(dialog)).not.toBeInvalid();
      await expect
        .element(vectorOf(dialog))
        .toHaveAccessibleDescription(VECTOR_DESCRIPTION);
    });
  });

  describe("its Base score", () => {
    // What the place of the score says of an empty vector.
    const NO_VECTOR = "No score. Choose the metrics, or enter the vector.";
    // A vector of v3.1 with a Temporal metric, which Sentinel does not
    // accept, and the error of the field for it.
    const TEMPORAL_V31 = `${VECTOR_V31}/E:P`;
    const NOT_ACCEPTED_V31 =
      "Sentinel doesn't accept this vector. Enter a complete CVSS v3.1 Base vector.";
    const MESSAGE_NETWORK =
      "Sentinel can't be reached. Check your connection and try again.";
    // The mark of None in the light theme (docs/design-system.md, Severity
    // Marks).
    const MARK_NONE = "rgb(139, 148, 158)";
    // What the place of the score says of a vector that Sentinel rejects.
    const REJECTED = "No score. Sentinel doesn't accept this vector.";
    // VECTOR_V31 with Availability Low.
    const LOW_V31 = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L";
    // How the form of v3.1 in Add returns to its vector once its outcome has
    // shown: from the tab of v4.0, or from LOW_V31, once its score shows.
    const RETURNS: [
      string,
      (dialog: Locator, vector: string) => Promise<void>,
    ][] = [
      [
        "from the other tab",
        async (dialog) => {
          await versionTab(dialog, "4.0").click();
          await expect
            .element(metricOf(dialog, "Attack requirements"))
            .toBeVisible();
          await versionTab(dialog, "3.1").click();
        },
      ],
      [
        "from another vector",
        async (dialog, vector) => {
          await vectorOf(dialog).fill(LOW_V31);
          await expect
            .poll(() => scoreSaid(dialog))
            .toBe("Base score 6.1, High");
          await vectorOf(dialog).fill(vector);
        },
      ],
    ];

    test("is read for the saved vector as Edit opens, without a pause, and shows the score and the severity with its mark, hidden from assistive technologies, which read them as one sentence", async () => {
      const response = later();
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        baseScore: () => response.promise,
      });
      const { screen } = await renderSuse();
      await focusInRow(screen, editSuse(screen));
      await readsEnded();
      // The clock of the pause, which stays where it is until the read is
      // sent.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

      await userEvent.keyboard("{Enter}");

      await expect
        .poll(() => scoreReads(spy), { interval: 0 })
        .toEqual([SUSE_V31.vector_string]);
      vi.useRealTimers();
      response.resolve(baseScoreResponse(SUSE_V31.vector_string, 6.1, "high"));
      const dialog = suseDialog(screen, "Edit SUSE assessment v3.1");
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      const place = scorePlaceOf(dialog);
      expect(seenOf(place)).toEqual([
        ["6.1", FG],
        ["High", FG],
      ]);
      expect(markOf(place.element())).toBe(MARK_HIGH);
      await expect
        .element(place.getByText("6.1", { exact: true }))
        .toBeVisible();
      await expect
        .element(place.getByText("High", { exact: true }))
        .toBeVisible();
    });

    test("is read for the vector without its surrounding whitespace", async () => {
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        baseScore: highScore,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);

      await vectorOf(dialog).fill(`  ${VECTOR_V31} `);

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(scoreReads(spy)).toEqual([VECTOR_V31]);
    });

    test("is read once the vector has paused for 250 ms, for the last vector alone, rather than at each change", async () => {
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        baseScore: highScore,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      vectorOf(dialog).element().focus();
      await readsEnded();
      // The clock of the pause, which the test moves itself: the keyboard
      // types and presses without moving it.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

      // A vector that chooses every metric, typed key by key, then two
      // choices of a metric, each change shortly before the pause after the
      // one before ends.
      await userEvent.keyboard("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L");
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await press(segmentOf(dialog, "Availability", "None"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await press(segmentOf(dialog, "Availability", "High"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await nextFrames();
      expect(scoreReads(spy)).toEqual([]);
      vi.advanceTimersByTime(1);
      vi.useRealTimers();

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(scoreReads(spy)).toEqual([VECTOR_V31]);
    });

    test.each<[string, CVSSAssessmentItem[], string, string]>([
      ["an empty vector", [NVD_V40, NVD_V31], "", NO_VECTOR],
      [
        "a vector that does not choose every metric",
        [NVD_V40, NVD_V31],
        "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N",
        "No score. Choose every metric.",
      ],
      [
        "a vector of the other version",
        [NVD_V40, NVD_V31],
        VECTOR_V40,
        "No score. Enter a CVSS v3.1 vector, which starts with CVSS:3.1/.",
      ],
      [
        "a vector longer than 200 characters that chooses every metric",
        [NVD_V40, NVD_V31],
        `${VECTOR_V31}/${"😀".repeat(156)}`,
        "No score. Enter at most 200 characters.",
      ],
      [
        "a vector of a version of which SUSE has an assessment",
        [SUSE_V40, NVD_V31],
        VECTOR_V40,
        "No score. SUSE already has a CVSS v4.0 assessment: edit it in its row.",
      ],
    ])(
      "is not read for %s in Add, whose place shows 0.0 and None in fg-muted, which assistive technologies read as the reason",
      async (_, assessments, vector, reason) => {
        const spy = stubSuse(() => assessmentsWith(assessments));
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await expect
          .element(versionTab(dialog, "3.1"))
          .toHaveAttribute("aria-selected", "true");

        if (vector !== "") {
          await vectorOf(dialog).fill(vector);
        }

        await expect.poll(() => scoreSaid(dialog)).toBe(reason);
        const place = scorePlaceOf(dialog);
        expect(seenOf(place)).toEqual([
          ["0.0", FG_MUTED],
          ["None", FG_MUTED],
        ]);
        expect(markOf(place.element())).toBe(MARK_NONE);
        await nextFrames();
        expect(scoreReads(spy)).toEqual([]);
      },
    );

    test("does not show in the tab of a version of which SUSE has an assessment", async () => {
      stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect.poll(() => scoreSaid(dialog)).toBe(NO_VECTOR);

      await versionTab(dialog, "3.1").click();

      await expect
        .element(dialog.getByText(TAKEN_V31, { exact: true }))
        .toBeVisible();
      expect(scorePlaceOf(dialog).query()).toBeNull();
    });

    test("shows nothing of a read that a newer vector overtakes, whose response arrives while the score of the newer vector is read, and keeps the outcome before them, marked as being updated, until the newer score arrives", async () => {
      // The saved vector with Integrity Low, whose read the newer vector,
      // with Integrity High, overtakes; each read waits until the test
      // answers it.
      const overtaken = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N";
      const newer = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N";
      const overtakenResponse = later();
      const newerResponse = later();
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        baseScore: (query) => {
          const vector = query.get("vector_string");
          if (vector === overtaken) {
            return overtakenResponse.promise;
          }
          return vector === newer ? newerResponse.promise : highScore(query);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await segmentOf(dialog, "Integrity", "Low").click();
      await expect
        .poll(() => scoreReads(spy))
        .toEqual([SUSE_V31.vector_string, overtaken]);
      await segmentOf(dialog, "Integrity", "High").click();
      await expect
        .poll(() => scoreReads(spy))
        .toEqual([SUSE_V31.vector_string, overtaken, newer]);
      const updating = dialog.getByRole("progressbar", { name: "Updating" });
      await expect.element(updating).toBeVisible();
      const record = recordScore(dialog);

      overtakenResponse.resolve(baseScoreResponse(overtaken, 9.8, "critical"));

      // No read of it is in progress any more, while the newer one is.
      await expect
        .poll(
          () =>
            client.isFetching({
              queryKey: [BASE_SCORE, { vector_string: overtaken }],
            }),
          { interval: 0 },
        )
        .toBe(0);
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      await nextFrames();
      record.stop();
      expect(
        record.said.filter((said) => said !== "Base score 6.1, High"),
      ).toEqual([]);
      expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(seenOf(scorePlaceOf(dialog))).toEqual([
        ["6.1", FG],
        ["High", FG],
      ]);
      expect(dialog.getByText(/9\.8|Critical/).elements()).toEqual([]);
      await expect.element(updating).toBeVisible();
      newerResponse.resolve(baseScoreResponse(newer, 7.1, "high"));

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 7.1, High");
      await expect.element(updating).not.toBeInTheDocument();
      expect(scoreReads(spy)).toEqual([
        SUSE_V31.vector_string,
        overtaken,
        newer,
      ]);
    });

    test("shows nothing of a read that a newer vector overtakes, whose response arrives while the newer vector has not paused, and keeps the outcome before them until the newer score arrives", async () => {
      // The saved vector with Integrity Low, whose read the vector with
      // Integrity High overtakes before it is answered; each read waits until
      // the test answers it.
      const overtaken = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N";
      const newer = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N";
      const overtakenResponse = later();
      const newerResponse = later();
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        baseScore: (query) => {
          const vector = query.get("vector_string");
          if (vector === overtaken) {
            return overtakenResponse.promise;
          }
          return vector === newer ? newerResponse.promise : highScore(query);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await readsEnded();
      // The clock of the pause, and of the task in which TanStack Query gives
      // the screen the outcome of a read, which the test moves itself.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      await press(segmentOf(dialog, "Integrity", "Low"));
      vi.advanceTimersByTime(SCORE_DELAY_MS);
      await expect
        .poll(() => scoreReads(spy), { interval: 0 })
        .toEqual([SUSE_V31.vector_string, overtaken]);
      const record = recordScore(dialog);
      await press(segmentOf(dialog, "Integrity", "High"));

      overtakenResponse.resolve(baseScoreResponse(overtaken, 9.8, "critical"));

      // Its read ends, and the clock, which stops short of the end of the
      // pause of the newer vector, moves past the task in which the screen
      // has its outcome.
      await expect
        .poll(
          () =>
            client.isFetching({
              queryKey: [BASE_SCORE, { vector_string: overtaken }],
            }),
          { interval: 0 },
        )
        .toBe(0);
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await nextFrames();
      expect(
        record.said.filter((said) => said !== "Base score 6.1, High"),
      ).toEqual([]);
      expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(seenOf(scorePlaceOf(dialog))).toEqual([
        ["6.1", FG],
        ["High", FG],
      ]);
      expect(dialog.getByText(/9\.8|Critical/).elements()).toEqual([]);
      expect(scoreReads(spy)).toEqual([SUSE_V31.vector_string, overtaken]);
      vi.advanceTimersByTime(1);
      await expect
        .poll(() => scoreReads(spy), { interval: 0 })
        .toEqual([SUSE_V31.vector_string, overtaken, newer]);
      vi.useRealTimers();
      newerResponse.resolve(baseScoreResponse(newer, 7.1, "high"));

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 7.1, High");
      record.stop();
      expect(new Set(record.said)).toEqual(
        new Set(["Base score 6.1, High", "Base score 7.1, High"]),
      );
    });

    test("keeps the outcome of the vector before while the score of a new vector is read, marked as being updated, until the new score arrives", async () => {
      const response = later();
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        baseScore: (query) =>
          query.get("vector_string") === VECTOR_V31
            ? response.promise
            : highScore(query),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");

      await vectorOf(dialog).fill(VECTOR_V31);

      await expect
        .poll(() => scoreReads(spy))
        .toEqual([SUSE_V31.vector_string, VECTOR_V31]);
      const updating = dialog.getByRole("progressbar", { name: "Updating" });
      await expect.element(updating).toBeVisible();
      expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(seenOf(scorePlaceOf(dialog))).toEqual([
        ["6.1", FG],
        ["High", FG],
      ]);
      response.resolve(baseScoreResponse(VECTOR_V31, 7.5, "high"));

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 7.5, High");
      await expect.element(updating).not.toBeInTheDocument();
    });

    test("marks the outcome of the vector before as being updated only once the read of the new vector has taken 300 ms, never while the vector has not paused", async () => {
      const response = later();
      // The saved vector with Integrity High.
      const changed = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N";
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        baseScore: (query) =>
          query.get("vector_string") === changed
            ? response.promise
            : highScore(query),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await readsEnded();
      // The clock of the pause and of the delay of the mark, which the test
      // moves itself.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const updating = dialog.getByRole("progressbar", { name: "Updating" });

      // Three choices of a metric, each shortly before the pause after the
      // one before ends, which keep the vector from pausing for longer than
      // the delay of the mark.
      await press(segmentOf(dialog, "Integrity", "Low"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await press(segmentOf(dialog, "Integrity", "None"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await press(segmentOf(dialog, "Integrity", "High"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      expect(3 * (SCORE_DELAY_MS - 1)).toBeGreaterThan(LOADING_DELAY_MS);
      await nextFrames();
      expect(updating.query()).toBeNull();
      expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(scoreReads(spy)).toEqual([SUSE_V31.vector_string]);

      vi.advanceTimersByTime(1);

      await expect
        .poll(() => scoreReads(spy), { interval: 0 })
        .toEqual([SUSE_V31.vector_string, changed]);
      vi.advanceTimersByTime(LOADING_DELAY_MS - 1);
      await nextFrames();
      expect(updating.query()).toBeNull();
      expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
      vi.advanceTimersByTime(1);
      await expect.poll(() => updating.query(), { interval: 0 }).not.toBeNull();
      expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
      vi.useRealTimers();
      response.resolve(baseScoreResponse(changed, 7.1, "high"));

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 7.1, High");
      await expect.element(updating).not.toBeInTheDocument();
    });

    test("shows the loading indicator in its place, beside Start from, until the first outcome of the vector is known", async () => {
      const response = later();
      stubSuse(() => fictionalCvssAssessments(), {
        baseScore: () => response.promise,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      const loading = dialog.getByRole("progressbar", { name: "Loading" });

      await expect.element(loading).toBeVisible();
      expect(scoreSaid(dialog)).toBe("");
      expect(boxOf(loading).left).toBeGreaterThan(
        boxOf(startFromOf(dialog)).right,
      );
      expect(boxOf(loading).bottom).toBeLessThanOrEqual(
        boxOf(metricOf(dialog, "Attack vector")).top,
      );
      expect(
        dialog.getByRole("progressbar", { name: "Updating" }).query(),
      ).toBeNull();
      response.resolve(baseScoreResponse(SUSE_V31.vector_string, 6.1, "high"));

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await expect.element(loading).not.toBeInTheDocument();
    });

    test.each<[string, (dialog: Locator) => Locator]>([
      ["on the field", (dialog) => vectorOf(dialog)],
      ["on a metric", (dialog) => segmentOf(dialog, "Availability", "Low")],
    ])(
      "shows 422 CVSS_INVALID_VECTOR of the read at the vector at once and no score in its place, leaving the focus %s",
      async (_, focused) => {
        stubSuse(() => fictionalCvssAssessments(), {
          baseScore: rejectingTemporal,
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseEdit(screen);
        await vectorOf(dialog).fill(TEMPORAL_V31);
        focused(dialog).element().focus();

        await expect
          .element(vectorOf(dialog))
          .toHaveAccessibleDescription(
            `${VECTOR_DESCRIPTION} ${NOT_ACCEPTED_V31}`,
          );
        await expect.element(vectorOf(dialog)).toBeInvalid();
        await expect
          .poll(() => scoreSaid(dialog))
          .toBe("No score. Sentinel doesn't accept this vector.");
        expect(seenOf(scorePlaceOf(dialog))).toEqual([
          ["0.0", FG_MUTED],
          ["None", FG_MUTED],
        ]);
        await expectFocusSettledOn(focused(dialog));
      },
    );

    test("takes the error of 422 CVSS_INVALID_VECTOR of the read away from the vector as soon as the input changes, before the vector pauses", async () => {
      stubSuse(() => fictionalCvssAssessments(), {
        baseScore: rejectingTemporal,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(TEMPORAL_V31);
      await expect.element(vectorOf(dialog)).toBeInvalid();
      await readsEnded();
      // The clock of the pause, which does not move: the pause after the
      // change does not end.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

      await press(segmentOf(dialog, "Availability", "Low"));

      await expect
        .poll(() => vectorOf(dialog).element(), { interval: 0 })
        .not.toBeInvalid();
      await expect
        .poll(() => vectorOf(dialog).element(), { interval: 0 })
        .toHaveAccessibleDescription(VECTOR_DESCRIPTION);
      await expect
        .poll(() => vectorOf(dialog).element(), { interval: 0 })
        .toHaveValue("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L");
      vi.useRealTimers();
    });

    test("leaves Save sending a vector that the read rejects with 422 CVSS_INVALID_VECTOR", async () => {
      const bodies: unknown[] = [];
      stubSuse(() => fictionalCvssAssessments(), {
        baseScore: rejectingTemporal,
        upsertSuse: (body) => {
          bodies.push(body);
          return errorResponse(422, "CVSS_INVALID_VECTOR");
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(TEMPORAL_V31);
      await expect.element(vectorOf(dialog)).toBeInvalid();

      await submitOf(dialog, "Save").click();

      await expect
        .poll(() => bodies)
        .toEqual([{ vector_string: TEMPORAL_V31 }]);
      await expect.element(vectorOf(dialog)).toHaveFocus();
    });

    test.each<
      [string, () => Response | Promise<Response>, string, boolean, number]
    >([
      [
        "a 503, read three times",
        () => errorResponse(503, "SERVICE_UNAVAILABLE"),
        MESSAGE_UNAVAILABLE,
        true,
        3,
      ],
      [
        "a network failure, read three times",
        () => Promise.reject(new TypeError("Failed to fetch")),
        MESSAGE_NETWORK,
        true,
        3,
      ],
      [
        "a VALIDATION_ERROR of the vector, read once",
        () => validationError([["query", "vector_string"]]),
        MESSAGE_NOT_ACCEPTED,
        false,
        1,
      ],
      [
        "a 422 with a code that the pinned contract does not list, read once",
        () => errorResponse(422, "FICTIONAL_CODE"),
        MESSAGE_NOT_ACCEPTED,
        false,
        1,
      ],
      [
        "a status and a code that the pinned contract does not list, read once",
        () => errorResponse(418, "FICTIONAL_CODE"),
        MESSAGE_NOT_ACCEPTED,
        false,
        1,
      ],
    ])(
      "shows the failure of %s in its place, with Try again where it offers it, without an error at the vector, and Add SUSE assessment still adds it",
      async (_, response, message, retry, reads) => {
        const bodies: unknown[] = [];
        const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          baseScore: response,
          upsertSuse: (body) => {
            bodies.push(body);
            return suseResponse(SAVED_V31, 201);
          },
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);

        await vectorOf(dialog).fill(VECTOR_V31);

        const place = scorePlaceOf(dialog);
        await expect.element(place.getByText(message)).toBeVisible();
        expect(scoreReads(spy)).toEqual(
          Array.from({ length: reads }, () => VECTOR_V31),
        );
        const tryAgain = place.getByRole("button", { name: "Try again" });
        if (retry) {
          await expect.element(tryAgain).toBeVisible();
        } else {
          expect(tryAgain.query()).toBeNull();
        }
        await expect.element(vectorOf(dialog)).not.toBeInvalid();
        await expect
          .element(vectorOf(dialog))
          .toHaveAccessibleDescription(VECTOR_DESCRIPTION);

        await submitOf(dialog).click();

        await expect.element(dialog).not.toBeInTheDocument();
        expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
      },
    );

    test("is read again on Try again after a failure, and then shows", async () => {
      let fails = true;
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        baseScore: (query) =>
          fails ? errorResponse(503, "SERVICE_UNAVAILABLE") : highScore(query),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      const place = scorePlaceOf(dialog);
      await expect.element(place.getByText(MESSAGE_UNAVAILABLE)).toBeVisible();
      fails = false;

      await place.getByRole("button", { name: "Try again" }).click();

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      expect(scoreReads(spy)).toEqual([
        VECTOR_V31,
        VECTOR_V31,
        VECTOR_V31,
        VECTOR_V31,
      ]);
    });

    test.each(RETURNS)(
      "shows the rejection of a vector by 422 CVSS_INVALID_VECTOR again, at the vector and in its place, as the form returns to it %s, without waiting for a read or reading it again",
      async (_, back) => {
        const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          baseScore: rejectingTemporal,
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await vectorOf(dialog).fill(TEMPORAL_V31);
        await expect.element(vectorOf(dialog)).toBeInvalid();
        await expect.poll(() => scoreSaid(dialog)).toBe(REJECTED);
        const readsOfVector = () =>
          scoreReads(spy).filter((vector) => vector === TEMPORAL_V31);
        expect(readsOfVector()).toHaveLength(1);
        const record = recordScore(dialog);

        await back(dialog, TEMPORAL_V31);

        await expect
          .element(vectorOf(dialog))
          .toHaveAccessibleDescription(
            `${VECTOR_DESCRIPTION} ${NOT_ACCEPTED_V31}`,
          );
        await expect.element(vectorOf(dialog)).toBeInvalid();
        await expect.poll(() => scoreSaid(dialog)).toBe(REJECTED);
        await nextFrames();
        record.stop();
        // The place never waited for a read meanwhile.
        expect(record.said).not.toContain("");
        expect(readsOfVector()).toHaveLength(1);
      },
    );

    test.each(RETURNS)(
      "reads again a vector whose read failed with a 503 as the form returns to it %s",
      async (_, back) => {
        const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          baseScore: (query) =>
            query.get("vector_string") === VECTOR_V31
              ? errorResponse(503, "SERVICE_UNAVAILABLE")
              : highScore(query),
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await vectorOf(dialog).fill(VECTOR_V31);
        const place = scorePlaceOf(dialog);
        await expect
          .element(place.getByText(MESSAGE_UNAVAILABLE))
          .toBeVisible();
        const readsOfVector = () =>
          scoreReads(spy).filter((vector) => vector === VECTOR_V31);
        expect(readsOfVector()).toHaveLength(3);

        await back(dialog, VECTOR_V31);

        await expect.poll(readsOfVector).toHaveLength(6);
        await expect
          .element(place.getByText(MESSAGE_UNAVAILABLE))
          .toBeVisible();
      },
    );

    test.each<
      [
        string,
        (dialog: Locator) => Promise<void>,
        (dialog: Locator) => Promise<void>,
      ]
    >([
      [
        "from the other tab",
        async (dialog) => {
          await versionTab(dialog, "4.0").click();
          await expect
            .element(metricOf(dialog, "Attack requirements"))
            .toBeVisible();
        },
        async (dialog) => {
          await versionTab(dialog, "3.1").click();
        },
      ],
      [
        "from another vector",
        async (dialog) => {
          await vectorOf(dialog).fill(LOW_V31);
          await expect
            .poll(() => scoreSaid(dialog))
            .toBe("Base score 6.1, High");
        },
        async (dialog) => {
          await vectorOf(dialog).fill(VECTOR_V31);
        },
      ],
    ])(
      "shows the failure of a 422 with a code that the pinned contract does not list again in its place as the form returns to its vector %s, without waiting for a read or reading it again",
      async (_, leave, back) => {
        const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          baseScore: (query) =>
            query.get("vector_string") === VECTOR_V31
              ? errorResponse(422, "FICTIONAL_CODE")
              : highScore(query),
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await vectorOf(dialog).fill(VECTOR_V31);
        const place = scorePlaceOf(dialog);
        await expect
          .element(place.getByText(MESSAGE_NOT_ACCEPTED))
          .toBeVisible();
        const readsOfVector = () =>
          scoreReads(spy).filter((vector) => vector === VECTOR_V31);
        expect(readsOfVector()).toHaveLength(1);
        await leave(dialog);
        const record = recordScore(dialog);

        await back(dialog);

        await expect
          .element(place.getByText(MESSAGE_NOT_ACCEPTED))
          .toBeVisible();
        await nextFrames();
        record.stop();
        // The place never waited for a read meanwhile.
        expect(record.said).not.toContain("");
        expect(readsOfVector()).toHaveLength(1);
        expect(
          place.getByRole("button", { name: "Try again" }).query(),
        ).toBeNull();
        await expect.element(vectorOf(dialog)).not.toBeInvalid();
      },
    );

    test.each<[string, () => Response | Promise<Response>, string]>([
      [
        "a 503",
        () => errorResponse(503, "SERVICE_UNAVAILABLE"),
        MESSAGE_UNAVAILABLE,
      ],
      [
        "a network failure",
        () => Promise.reject(new TypeError("Failed to fetch")),
        MESSAGE_NETWORK,
      ],
    ])(
      "offers Try again after %s of the read only while the form holds its vector: neither while the next vector pauses nor while its score is read, when its place shows the loading indicator",
      async (_, failure, message) => {
        const response = later();
        const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          baseScore: (query) =>
            query.get("vector_string") === VECTOR_V31
              ? failure()
              : response.promise,
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await vectorOf(dialog).fill(VECTOR_V31);
        const place = scorePlaceOf(dialog);
        const tryAgain = place.getByRole("button", { name: "Try again" });
        await expect.element(tryAgain).toBeVisible();
        await expect.element(place.getByText(message)).toBeVisible();
        await readsEnded();
        // The clock of the pause and of the delay of the loading indicator,
        // which the test moves itself.
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

        await press(segmentOf(dialog, "Availability", "Low"));

        await expect
          .poll(() => vectorOf(dialog).element(), { interval: 0 })
          .toHaveValue(LOW_V31);
        vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
        await nextFrames();
        expect(tryAgain.query()).toBeNull();
        expect(place.getByText(message).query()).toBeNull();
        vi.advanceTimersByTime(1);
        await expect
          .poll(() => scoreReads(spy), { interval: 0 })
          .toEqual([VECTOR_V31, VECTOR_V31, VECTOR_V31, LOW_V31]);
        vi.advanceTimersByTime(LOADING_DELAY_MS);
        await expect
          .poll(
            () => dialog.getByRole("progressbar", { name: "Loading" }).query(),
            { interval: 0 },
          )
          .not.toBeNull();
        expect(tryAgain.query()).toBeNull();
        expect(place.getByText(message).query()).toBeNull();
        vi.useRealTimers();
        response.resolve(baseScoreResponse(LOW_V31, 6.1, "high"));

        await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      },
    );

    test("shows the loading indicator after a failure of the read only once the read of the next vector has taken 300 ms, never while that vector has not paused", async () => {
      const response = later();
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        baseScore: (query) =>
          query.get("vector_string") === VECTOR_V31
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : response.promise,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      await expect
        .element(scorePlaceOf(dialog).getByText(MESSAGE_UNAVAILABLE))
        .toBeVisible();
      await readsEnded();
      // The clock of the pause and of the delay of the indicator, which the
      // test moves itself.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const loading = dialog.getByRole("progressbar", { name: "Loading" });

      // Three choices of a metric, each shortly before the pause after the
      // one before ends, which keep the vector from pausing for longer than
      // the delay of the indicator, and end on LOW_V31.
      await press(segmentOf(dialog, "Availability", "Low"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await press(segmentOf(dialog, "Availability", "None"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      await press(segmentOf(dialog, "Availability", "Low"));
      vi.advanceTimersByTime(SCORE_DELAY_MS - 1);
      expect(3 * (SCORE_DELAY_MS - 1)).toBeGreaterThan(LOADING_DELAY_MS);
      await nextFrames();
      expect(loading.query()).toBeNull();
      expect(scoreSaid(dialog)).toBe("");
      expect(scoreReads(spy)).toEqual([VECTOR_V31, VECTOR_V31, VECTOR_V31]);

      vi.advanceTimersByTime(1);

      await expect
        .poll(() => scoreReads(spy), { interval: 0 })
        .toEqual([VECTOR_V31, VECTOR_V31, VECTOR_V31, LOW_V31]);
      vi.advanceTimersByTime(LOADING_DELAY_MS - 1);
      await nextFrames();
      expect(loading.query()).toBeNull();
      vi.advanceTimersByTime(1);
      await expect.poll(() => loading.query(), { interval: 0 }).not.toBeNull();
      vi.useRealTimers();
      response.resolve(baseScoreResponse(LOW_V31, 6.1, "high"));

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await expect.element(loading).not.toBeInTheDocument();
    });

    test("shows in each tab of Add the outcome of its own vector at once, never that of the other tab, and the score of a tab again without reading it again", async () => {
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31], "4.0"), {
        baseScore: highScore,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");
      await vectorOf(dialog).fill(VECTOR_V40);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await readsEnded();
      const record = recordScore(dialog);
      // The clock of the pause, which does not move: what a tab shows before
      // the pause ends is what it shows at once.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

      await press(versionTab(dialog, "3.1"));

      await expect
        .poll(() => scoreSaid(dialog), { interval: 0 })
        .toBe(NO_VECTOR);
      await nextFrames();
      expect(new Set(record.said.splice(0))).toEqual(new Set([NO_VECTOR]));

      await press(versionTab(dialog, "4.0"));

      await expect
        .poll(() => scoreSaid(dialog), { interval: 0 })
        .toBe("Base score 6.1, High");
      await nextFrames();
      expect(new Set(record.said)).toEqual(new Set(["Base score 6.1, High"]));
      record.stop();
      vi.useRealTimers();
      expect(scoreReads(spy)).toEqual([VECTOR_V40]);
    });

    test("shows in a tab of Add whose vector is being read the loading indicator, and nothing of the outcome of the other tab", async () => {
      // The reads of VECTOR_V31 wait until the test lets them through, each
      // with its own response.
      const gate = later();
      const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        baseScore: (query) =>
          query.get("vector_string") === VECTOR_V31
            ? gate.promise.then(() =>
                baseScoreResponse(VECTOR_V31, 9.8, "critical"),
              )
            : highScore(query),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      await expect.poll(() => scoreReads(spy)).toEqual([VECTOR_V31]);
      await versionTab(dialog, "4.0").click();
      await expect.element(vectorOf(dialog)).toHaveValue("");
      await vectorOf(dialog).fill(VECTOR_V40);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      const record = recordScore(dialog);

      await versionTab(dialog, "3.1").click();

      await expect
        .element(dialog.getByRole("progressbar", { name: "Loading" }))
        .toBeVisible();
      record.stop();
      expect(record.said.filter((said) => said !== "")).toEqual([]);
      expect(scoreSaid(dialog)).toBe("");
      gate.resolve(new Response());

      await expect
        .poll(() => scoreSaid(dialog))
        .toBe("Base score 9.8, Critical");
    });

    test("is read once for a vector: neither when the vector returns to it nor when the tab returns to the foreground", async () => {
      // The saved vector with Integrity High.
      const changed = "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N";
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        baseScore: (query) =>
          query.get("vector_string") === changed
            ? baseScoreResponse(changed, 7.1, "high")
            : highScore(query),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await segmentOf(dialog, "Integrity", "High").click();
      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 7.1, High");

      await segmentOf(dialog, "Integrity", "None").click();

      await expect.poll(() => scoreSaid(dialog)).toBe("Base score 6.1, High");
      await nextFrames();
      expect(scoreReads(spy)).toEqual([SUSE_V31.vector_string, changed]);
      const reads = readsOf(spy, CVSS);

      await returnToForeground();

      // The assessments, which the tab reads again, tell that the return has
      // been handled.
      await expect.poll(() => readsOf(spy, CVSS)).toBe(reads + 1);
      await nextFrames();
      expect(scoreReads(spy)).toEqual([SUSE_V31.vector_string, changed]);
    });

    test.each<[string, (dialog: Locator) => Promise<Locator>]>([
      [
        "on the field, as the user enters the vector",
        async (dialog) => {
          await vectorOf(dialog).fill(VECTOR_V31);
          return vectorOf(dialog);
        },
      ],
      [
        "on a metric, as the user chooses it",
        async (dialog) => {
          await vectorOf(dialog).fill(
            "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N",
          );
          const segment = segmentOf(dialog, "Availability", "High");
          await press(segment);
          return segment;
        },
      ],
    ])(
      "announces the score in its status region, leaving the focus %s",
      async (_, change) => {
        stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          baseScore: highScore,
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await expect.poll(() => scoreSaid(dialog)).toBe(NO_VECTOR);

        const focused = await change(dialog);

        await expect
          .element(scorePlaceOf(dialog).getByText("Base score 6.1, High"))
          .toBeInTheDocument();
        expect(scoreSaid(dialog)).toBe("Base score 6.1, High");
        await expectFocusSettledOn(focused);
      },
    );

    test("shows a severity that the pinned contract does not list as received, which assistive technologies read as received", async () => {
      stubSuse(() => fictionalCvssAssessments(), {
        baseScore: (query) =>
          jsonResponse(200, {
            data: {
              ...baseScoreOf(query.get("vector_string") ?? "", 6.1),
              severity: "fictional_level",
            },
          }),
      });
      const { screen } = await renderSuse();

      const dialog = await openSuseEdit(screen);

      await expect
        .poll(() => scoreSaid(dialog))
        .toBe("Base score 6.1, fictional_level");
      const place = scorePlaceOf(dialog);
      expect(seenOf(place)).toEqual([
        ["6.1", FG],
        ["fictional_level", FG],
      ]);
      // The hollow dot of a value that the pinned contract does not list.
      expect(markOf(place.element())).toBe("none");
    });
  });

  describe("Edit", () => {
    test("opens a dialog 880 px wide without tabs, named after the version, with the saved vector and its metrics, then Cancel and Save", async () => {
      stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();

      const dialog = await openSuseEdit(screen);

      expect(dialog.element().getBoundingClientRect().width).toBe(880);
      expect(dialog.getByRole("tablist").query()).toBeNull();
      await expect
        .element(vectorOf(dialog))
        .toHaveValue(SUSE_V31.vector_string);
      expect(choicesOf(dialog, METRICS_V31)).toEqual([
        "Local",
        "Low",
        "Low",
        "None",
        "Unchanged",
        "High",
        "None",
        "None",
      ]);
      expect(
        dialog
          .getByRole("button")
          .elements()
          .slice(-2)
          .map((button) => button.textContent),
      ).toEqual(["Cancel", "Save"]);
    });

    test("opens on the version of its row, v4.0", async () => {
      stubSuse(() => assessmentsWith([SUSE_V40, NVD_V31, SUSE_V31]));
      const { screen } = await renderSuse();

      const dialog = await openSuseEdit(screen, "4.0");

      await expect
        .element(vectorOf(dialog))
        .toHaveValue(SUSE_V40.vector_string);
      expect(choicesOf(dialog, METRICS_V40)).toEqual([
        "Local",
        "Low",
        "None",
        "Low",
        "None",
        "High",
        "None",
        "None",
        "None",
        "None",
        "None",
      ]);
    });

    test.each([
      ["as saved", SUSE_V31.vector_string],
      ["with surrounding whitespace", `  ${SUSE_V31.vector_string} `],
    ])(
      "closes on Save without a request with the vector %s, and returns the focus to Edit",
      async (_, vector) => {
        const spy = stubSuse(() => fictionalCvssAssessments());
        const { screen } = await renderSuse();
        const dialog = await openSuseEdit(screen);
        await vectorOf(dialog).fill(vector);

        await submitOf(dialog, "Save").click();

        await expect.element(dialog).not.toBeInTheDocument();
        expect(requestsWith(spy, "POST")).toHaveLength(0);
        await expect.element(editSuse(screen)).toHaveFocus();
      },
    );

    test("saves a changed vector with Set or Update SUSE CVSS Assessment without reading first, then announces it once the assessments are read again, and returns the focus to Edit", async () => {
      let assessments = fictionalCvssAssessments();
      const bodies: unknown[] = [];
      const spy = stubSuse(() => assessments, {
        upsertSuse: (body) => {
          bodies.push(body);
          assessments = assessmentsWith([NVD_V31, SAVED_V31]);
          return suseResponse(SAVED_V31);
        },
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      const before = assessmentRequests(spy).length;

      await vectorOf(dialog).fill(` ${VECTOR_V31}`);
      await submitOf(dialog, "Save").click();

      await expect.element(dialog).not.toBeInTheDocument();
      expect(bodies).toEqual([{ vector_string: VECTOR_V31 }]);
      await expect
        .poll(() => cvssAnnouncements(screen))
        .toEqual(["SUSE assessment v3.1 changed."]);
      expect(assessmentRequests(spy).slice(before)).toEqual([
        `POST ${SUSE_ASSESSMENT}`,
        `GET ${CVSS}`,
      ]);
      await expect
        .element(
          assessmentRow(screen, "SUSE", "3.1").getByText(VECTOR_V31, {
            exact: true,
          }),
        )
        .toBeVisible();
      await expectFocusSettledOn(editSuse(screen));
    });

    test("is busy while the change is in progress, and cannot be closed", async () => {
      const response = later();
      const spy = stubSuse(() => fictionalCvssAssessments(), {
        upsertSuse: () => response.promise,
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(VECTOR_V31);

      await submitOf(dialog, "Save").click();

      await expect
        .element(submitOf(dialog, "Save"))
        .toHaveAttribute("aria-disabled", "true");
      await expect
        .element(dialog.getByRole("button", { name: "Cancel" }))
        .toBeDisabled();
      await userEvent.keyboard("{Escape}");
      await expect.element(dialog).toBeVisible();
      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();
      expect(requestsWith(spy, "POST")).toHaveLength(1);

      response.resolve(suseResponse(SAVED_V31));

      await expect.element(dialog).not.toBeInTheDocument();
    });
  });

  describe("the failure of a change", () => {
    test.each([
      [
        "422 CVSS_INVALID_VECTOR",
        () => errorResponse(422, "CVSS_INVALID_VECTOR"),
        "Sentinel doesn't accept this vector. Enter a complete CVSS v3.1 Base vector.",
      ],
      [
        "a field error of the vector",
        () => validationError([["body", "vector_string"]]),
        MESSAGE_INVALID,
      ],
    ])(
      "shows %s at the vector, which takes the focus, and keeps the input",
      async (_, response, message) => {
        stubSuse(() => fictionalCvssAssessments(), { upsertSuse: response });
        const { screen } = await renderSuse();
        const dialog = await openSuseEdit(screen);
        await vectorOf(dialog).fill(VECTOR_V31);

        await submitOf(dialog, "Save").click();

        const field = vectorOf(dialog);
        await expect
          .element(field)
          .toHaveAccessibleDescription(`${VECTOR_DESCRIPTION} ${message}`);
        await expect.element(field).toBeInvalid();
        await expect.element(field).toHaveFocus();
        await expect.element(field).toHaveValue(VECTOR_V31);
        expect(dialog.getByRole("alert").query()).toBeNull();
      },
    );

    test("names the version of the tab in the error of 422 CVSS_INVALID_VECTOR in Add", async () => {
      stubSuse(() => fictionalCvssAssessments(), {
        upsertSuse: () => errorResponse(422, "CVSS_INVALID_VECTOR"),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await expect
        .element(versionTab(dialog, "4.0"))
        .toHaveAttribute("aria-selected", "true");
      await vectorOf(dialog).fill(VECTOR_V40);

      await submitOf(dialog).click();

      await expect
        .element(vectorOf(dialog))
        .toHaveAccessibleDescription(
          `${VECTOR_DESCRIPTION} Sentinel doesn't accept this vector. Enter a complete CVSS v4.0 Base vector.`,
        );
      await expect.element(vectorOf(dialog)).toHaveFocus();
    });

    test.each([
      [
        "409 TICKET_NOT_MUTABLE, as an error",
        () => errorResponse(409, "TICKET_NOT_MUTABLE"),
        MESSAGE_CONFLICT,
        MESSAGE_TONES.danger,
      ],
      [
        "404 CVE_NOT_FOUND, as an error",
        () => errorResponse(404, "CVE_NOT_FOUND"),
        MESSAGE_GONE,
        MESSAGE_TONES.danger,
      ],
      [
        "a VALIDATION_ERROR of another member, as an error",
        () => validationError([["body", "fictional_member"]]),
        MESSAGE_NOT_ACCEPTED,
        MESSAGE_TONES.danger,
      ],
      [
        "a 422 with a code that the pinned contract does not list, as an error",
        () => errorResponse(422, "FICTIONAL_CODE"),
        MESSAGE_NOT_ACCEPTED,
        MESSAGE_TONES.danger,
      ],
      [
        "a status and a code that the pinned contract does not list, as an error",
        () => errorResponse(418, "FICTIONAL_CODE"),
        MESSAGE_NOT_ACCEPTED,
        MESSAGE_TONES.danger,
      ],
      [
        "a 500 that Sentinel did not confirm, as a warning",
        () => errorResponse(500, "INTERNAL_ERROR"),
        MESSAGE_UNCONFIRMED,
        MESSAGE_TONES.warning,
      ],
      [
        "a network failure, as a warning",
        () => Promise.reject(new TypeError("Failed to fetch")),
        MESSAGE_UNCONFIRMED,
        MESSAGE_TONES.warning,
      ],
    ])(
      "shows %s at the top of the form, which takes the focus and keeps the input",
      async (_, response, message, tone) => {
        stubSuse(() => fictionalCvssAssessments(), { upsertSuse: response });
        const { screen } = await renderSuse();
        const dialog = await openSuseEdit(screen);
        await vectorOf(dialog).fill(VECTOR_V31);

        await submitOf(dialog, "Save").click();

        const error = dialog.getByText(message);
        await expect.element(error).toBeVisible();
        expect(backgroundBehind(error.element())).toBe(tone);
        await expectFocusOnError(error);
        expect(boxOf(error).bottom).toBeLessThan(
          boxOf(metricOf(dialog, "Attack vector")).top,
        );
        await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
        await expect.element(vectorOf(dialog)).not.toBeInvalid();
      },
    );

    test("shows the reference of a change that Sentinel did not confirm", async () => {
      stubSuse(() => fictionalCvssAssessments(), {
        upsertSuse: () => errorResponse(503, "SERVICE_UNAVAILABLE"),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(VECTOR_V31);

      await submitOf(dialog, "Save").click();

      await expect.element(dialog.getByText(MESSAGE_UNCONFIRMED)).toBeVisible();
      await expect.element(dialog.getByText(REFERENCE)).toBeVisible();
    });

    test("shows the error of the vector and of the form for a VALIDATION_ERROR with an error of another member, the form taking the focus", async () => {
      stubSuse(() => fictionalCvssAssessments(), {
        upsertSuse: () =>
          validationError([
            ["body", "vector_string"],
            ["body", "fictional_member"],
          ]),
      });
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(VECTOR_V31);

      await submitOf(dialog, "Save").click();

      const error = dialog.getByText(MESSAGE_NOT_ACCEPTED);
      await expect.element(error).toBeVisible();
      await expect
        .element(vectorOf(dialog))
        .toHaveAccessibleDescription(
          `${VECTOR_DESCRIPTION} ${MESSAGE_INVALID}`,
        );
      await expectFocusOnError(error);
    });
  });

  describe("the reads after a change", () => {
    // A maintainer of fictional-openssl who manages the CVSS assessments.
    const MAINTAINING_ASSESSOR: CurrentUserResponse = {
      data: { ...MAINTAINER.data, capabilities: ["manage_cvss"] },
    };

    test.each<[string, (screen: Screen) => Promise<unknown>, Partial<Stub>]>([
      [
        "Edit that Sentinel confirms",
        editToV31,
        { upsertSuse: () => suseResponse(SAVED_V31) },
      ],
      [
        "Edit that Sentinel refuses",
        editToV31,
        { upsertSuse: () => errorResponse(409, "TICKET_NOT_MUTABLE") },
      ],
      ["Delete that Sentinel confirms", confirmDelete, {}],
      [
        "Delete that Sentinel did not confirm",
        confirmDelete,
        { deleteSuse: () => errorResponse(503, "SERVICE_UNAVAILABLE") },
      ],
    ])(
      "read again after %s the Ticket, the assessments, the users who acted on it, its access grants, the work of a maintainer, its duplicates, its audit log, and the Ticket list",
      async (_, change, fields) => {
        const spy = stubSuse(() => fictionalCvssAssessments(), {
          user: MAINTAINING_ASSESSOR,
          ticket: () => confidentialTicket({ packages: [fictionalPackage()] }),
          grants: () => grantsResponse(),
          ...fields,
        });
        // The user saw the Ticket list, and Audit log, before Overview.
        const { router, screen } = await renderApp("/tickets");
        await expect
          .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
          .toBeVisible();
        await router.navigate({
          to: "/tickets/$ticketId/audit-log",
          params: { ticketId: "SNTL-12" },
        });
        await expect
          .element(screen.getByRole("tabpanel", { name: "Audit log" }))
          .toBeVisible();
        await screen.getByRole("tab", { name: "Overview" }).click();
        await expect
          .element(
            cvssPart(screen).getByRole("grid", { name: "CVSS assessments" }),
          )
          .toBeVisible();
        await expect.poll(() => requestsTo(spy, YOUR_WORK)).toBe(1);
        await expect.poll(() => readsOf(spy, ACCESS)).toBe(1);
        await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
        const reads = {
          ticket: requestsTo(spy, TICKET),
          cvss: readsOf(spy, CVSS),
          actors: requestsTo(spy, ACTORS),
          grants: readsOf(spy, ACCESS),
          work: requestsTo(spy, YOUR_WORK),
          duplicates: readsOf(spy, TICKETS),
        };
        expect(leftInvalidated(EVENTS)).toBe(false);
        expect(leftInvalidated(TICKETS)).toBe(false);

        await change(screen);

        await expect.poll(() => requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
        await expect.poll(() => readsOf(spy, CVSS)).toBe(reads.cvss + 1);
        await expect.poll(() => requestsTo(spy, ACTORS)).toBe(reads.actors + 1);
        await expect.poll(() => readsOf(spy, ACCESS)).toBe(reads.grants + 1);
        await expect
          .poll(() => requestsTo(spy, YOUR_WORK))
          .toBe(reads.work + 1);
        await expect
          .poll(() => readsOf(spy, TICKETS))
          .toBe(reads.duplicates + 1);
        // Once every read has ended, each was sent once: the duplicates too,
        // which both the reads of the tab and those of the Ticket list hold.
        await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
        expect(readsOf(spy, TICKETS)).toBe(reads.duplicates + 1);
        expect(requestsTo(spy, TICKET)).toBe(reads.ticket + 1);
        expect(readsOf(spy, CVSS)).toBe(reads.cvss + 1);
        expect(leftInvalidated(EVENTS)).toBe(true);
        expect(leftInvalidated(TICKETS)).toBe(true);
      },
    );
  });

  describe("the outcome of a change", () => {
    test.each([
      [
        "in the part",
        "arrives",
        () => cvssResponse(assessmentsWith([NVD_V40, NVD_V31, SAVED_V31])),
      ],
      [
        "in the message area",
        "fails",
        () => errorResponse(403, "AUTH_INSUFFICIENT_PERMISSION"),
      ],
    ])(
      "comes %s once the next read of the assessments after Add %s, not before",
      async (place, _, response) => {
        const reread = later();
        let added = false;
        stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
          cvss: () =>
            added
              ? reread.promise
              : cvssResponse(assessmentsWith([NVD_V40, NVD_V31])),
          upsertSuse: () => {
            added = true;
            return suseResponse(SAVED_V31, 201);
          },
        });
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await vectorOf(dialog).fill(VECTOR_V31);

        await submitOf(dialog).click();

        await expect.element(dialog).not.toBeInTheDocument();
        await frames();
        expect(cvssAnnouncements(screen)).toEqual([]);
        expect(screen.getByText(/added\.$/).elements()).toHaveLength(0);
        reread.resolve(response());

        await expectOutcome(screen, place, "SUSE assessment v3.1 added.");
        expect(screen.getByText(/added\.$/).elements()).toHaveLength(1);
      },
    );

    test.each([
      [
        "in the part",
        "arrives",
        () => cvssResponse(assessmentsWith([NVD_V31, SAVED_V31])),
      ],
      [
        "in the message area",
        "fails",
        () => errorResponse(404, "CVE_NOT_FOUND"),
      ],
    ])(
      "comes %s once the next read of the assessments after Edit %s, not before",
      async (place, _, response) => {
        const reread = later();
        let saved = false;
        stubSuse(() => fictionalCvssAssessments(), {
          cvss: () => (saved ? reread.promise : cvssResponse()),
          upsertSuse: () => {
            saved = true;
            return suseResponse(SAVED_V31);
          },
        });
        const { screen } = await renderSuse();

        await editToV31(screen);

        await expect
          .element(suseDialog(screen, "Edit SUSE assessment v3.1"))
          .not.toBeInTheDocument();
        await frames();
        expect(cvssAnnouncements(screen)).toEqual([]);
        expect(screen.getByText(/changed\.$/).elements()).toHaveLength(0);
        reread.resolve(response());

        await expectOutcome(screen, place, "SUSE assessment v3.1 changed.");
      },
    );

    test.each([
      [
        "in the part",
        "arrives",
        () => cvssResponse(assessmentsWith([NVD_V31])),
      ],
      [
        "in the message area",
        "fails",
        () => errorResponse(503, "DATABASE_UNAVAILABLE"),
      ],
    ])(
      "comes %s once the next read of the assessments after Delete %s, not before",
      async (place, _, response) => {
        const reread = later();
        let removed = false;
        stubSuse(() => fictionalCvssAssessments(), {
          cvss: () => (removed ? reread.promise : cvssResponse()),
          deleteSuse: () => {
            removed = true;
            return new Response(null, { status: 204 });
          },
        });
        const { screen } = await renderSuse();

        const confirmation = await confirmDelete(screen);

        await expect.element(confirmation).not.toBeInTheDocument();
        await frames();
        expect(cvssAnnouncements(screen)).toEqual([]);
        expect(screen.getByText(/deleted\.$/).elements()).toHaveLength(0);
        reread.resolve(response());

        await expectOutcome(screen, place, "SUSE assessment v3.1 deleted.");
      },
    );
  });

  describe("a change that ends after the user left the screen", () => {
    test.each<
      [
        string,
        (screen: Screen) => Promise<void>,
        "upsertSuse" | "deleteSuse",
        () => Response | Promise<Response>,
        string,
        string,
      ]
    >([
      [
        "Add",
        async (screen) => {
          const dialog = await openSuseAdd(screen);
          await vectorOf(dialog).fill(VECTOR_V40);
          await submitOf(dialog).click();
        },
        "upsertSuse",
        () => suseResponse(SUSE_V40, 201),
        "SNTL-12: SUSE assessment v4.0 added.",
        MESSAGE_TONES.success,
      ],
      [
        "Edit",
        async (screen) => {
          const dialog = await openSuseEdit(screen);
          await vectorOf(dialog).fill(VECTOR_V31);
          await submitOf(dialog, "Save").click();
        },
        "upsertSuse",
        () => suseResponse(SAVED_V31),
        "SNTL-12: SUSE assessment v3.1 changed.",
        MESSAGE_TONES.success,
      ],
      [
        "Delete",
        async (screen) => {
          await confirmDelete(screen);
        },
        "deleteSuse",
        () => new Response(null, { status: 204 }),
        "SNTL-12: SUSE assessment v3.1 deleted.",
        MESSAGE_TONES.success,
      ],
      [
        "Add that Sentinel refuses",
        async (screen) => {
          const dialog = await openSuseAdd(screen);
          await vectorOf(dialog).fill(VECTOR_V40);
          await submitOf(dialog).click();
        },
        "upsertSuse",
        () => errorResponse(409, "TICKET_NOT_MUTABLE"),
        `SNTL-12: ${MESSAGE_CONFLICT}`,
        MESSAGE_TONES.danger,
      ],
      [
        "Delete that Sentinel did not confirm",
        async (screen) => {
          await confirmDelete(screen);
        },
        "deleteSuse",
        () => errorResponse(503, "SERVICE_UNAVAILABLE"),
        `SNTL-12: ${MESSAGE_UNCONFIRMED}`,
        MESSAGE_TONES.warning,
      ],
    ])(
      "shows the outcome of %s in the message area, naming the Ticket with a link to it",
      async (_, start, operation, outcome, text, tone) => {
        const response = later();
        const pending = () => response.promise;
        const spy = stubSuse(
          () => assessmentsWith([NVD_V40, NVD_V31, SUSE_V31]),
          operation === "upsertSuse"
            ? { upsertSuse: pending }
            : { deleteSuse: pending },
        );
        const { router, screen } = await renderSuse();
        await start(screen);
        await expect
          .poll(() =>
            spy.mock.calls.filter(([input]) =>
              urlOf(input).pathname.startsWith(SUSE_ASSESSMENT),
            ),
          )
          .toHaveLength(1);
        await leaveForTickets(router, screen);

        response.resolve(await outcome());

        const message = screen.getByText(text);
        await expect.element(message).toBeVisible();
        expect(backgroundBehind(message.element())).toBe(tone);
        const link = screen.getByRole("link", { name: "SNTL-12", exact: true });
        await expect.element(link).toHaveAttribute("href", "/tickets/SNTL-12");

        await link.click();

        await expect.element(screenHeading(screen)).toBeVisible();
      },
    );
  });

  describe("Discard changes", () => {
    test.each<[string, (dialog: Locator) => Promise<void>]>([
      [
        "a vector",
        async (dialog) => {
          await vectorOf(dialog).fill(VECTOR_V31);
        },
      ],
      [
        "a metric",
        async (dialog) => {
          await segmentOf(dialog, "Scope", "Changed").click();
        },
      ],
      [
        "an assessment to start from",
        async (dialog) => {
          await (
            await openStartFrom(dialog)
          )
            .getByRole("option", { name: "NVD, 8.1 High", exact: true })
            .click();
        },
      ],
      [
        "a vector in the other tab",
        async (dialog) => {
          await vectorOf(dialog).fill(VECTOR_V31);
          await versionTab(dialog, "4.0").click();
          await expect.element(vectorOf(dialog)).toHaveValue("");
        },
      ],
    ])(
      "is asked before Cancel or Escape discard %s in Add, keeps it on Keep editing, and closes on Discard",
      async (_, enter) => {
        const spy = stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]));
        const { screen } = await renderSuse();
        const dialog = await openSuseAdd(screen);
        await enter(dialog);
        const vector = vectorOf(dialog).element();
        const entered = vector instanceof HTMLInputElement ? vector.value : "";

        await dialog.getByRole("button", { name: "Cancel" }).click();

        const discard = screen.getByRole("dialog", {
          name: "Discard changes?",
        });
        await expect
          .element(discard.getByRole("button", { name: "Keep editing" }))
          .toHaveFocus();
        await expect
          .element(
            discard.getByText(
              "The SUSE assessment that you entered isn't added.",
            ),
          )
          .toBeVisible();
        await discard.getByRole("button", { name: "Keep editing" }).click();
        await expect.element(discard).not.toBeInTheDocument();
        await expect.element(vectorOf(dialog)).toHaveValue(entered);

        vectorOf(dialog).element().focus();
        await userEvent.keyboard("{Escape}");
        await expect.element(discard).toBeVisible();
        await discard
          .getByRole("button", { name: "Discard", exact: true })
          .click();

        await expect.element(dialog).not.toBeInTheDocument();
        await expect.element(addSuse(screen)).toHaveFocus();
        expect(requestsWith(spy, "POST")).toHaveLength(0);
        // The dialog opens again empty.
        const again = await openSuseAdd(screen);
        await expect.element(vectorOf(again)).toHaveValue("");
        await versionTab(again, "4.0").click();
        await expect.element(vectorOf(again)).toHaveValue("");
      },
    );

    test("is asked before Cancel or Escape discard a changed vector in Edit, keeps it on Keep editing, and closes on Discard", async () => {
      const spy = stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(VECTOR_V31);

      await dialog.getByRole("button", { name: "Cancel" }).click();

      const discard = screen.getByRole("dialog", { name: "Discard changes?" });
      await expect
        .element(discard.getByRole("button", { name: "Keep editing" }))
        .toHaveFocus();
      await expect
        .element(
          discard.getByText(
            "Your changes to this SUSE assessment aren't saved.",
          ),
        )
        .toBeVisible();
      await discard.getByRole("button", { name: "Keep editing" }).click();
      await expect.element(discard).not.toBeInTheDocument();
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);

      vectorOf(dialog).element().focus();
      await userEvent.keyboard("{Escape}");
      await expect.element(discard).toBeVisible();
      await discard
        .getByRole("button", { name: "Discard", exact: true })
        .click();

      await expect.element(dialog).not.toBeInTheDocument();
      await expect.element(editSuse(screen)).toHaveFocus();
      expect(requestsWith(spy, "POST")).toHaveLength(0);
    });

    test.each([
      ["Add without input", true],
      ["Edit without a change", false],
    ])(
      "is not asked on Cancel or Escape in %s, which closes at once and returns the focus to the button that opened it",
      async (_, add) => {
        stubSuse(() => fictionalCvssAssessments());
        const { screen } = await renderSuse();
        for (const way of ["Cancel", "Escape"]) {
          const dialog = await (add
            ? openSuseAdd(screen)
            : openSuseEdit(screen));

          if (way === "Escape") {
            await userEvent.keyboard("{Escape}");
          } else {
            await dialog.getByRole("button", { name: "Cancel" }).click();
          }

          await expect.element(dialog).not.toBeInTheDocument();
          expect(
            screen.getByRole("dialog", { name: "Discard changes?" }).query(),
          ).toBeNull();
          await expect
            .element(add ? addSuse(screen) : editSuse(screen))
            .toHaveFocus();
        }
      },
    );

    test("is asked before a navigation of the UI in Edit, also one that stays on the screen, keeps the dialog, the vector, and the URL on Keep editing, and closes the dialog on Discard", async () => {
      const spy = stubSuse(() => fictionalCvssAssessments());
      const { router, screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(VECTOR_V31);

      router.history.push("/tickets/SNTL-12#packages");

      const discard = screen.getByRole("dialog", { name: "Discard changes?" });
      await expect
        .element(
          discard.getByText(
            "Your changes to this SUSE assessment aren't saved.",
          ),
        )
        .toBeVisible();
      await discard.getByRole("button", { name: "Keep editing" }).click();
      await expect.element(discard).not.toBeInTheDocument();
      await nextFrames();
      expect(router.state.location.href).toBe("/tickets/SNTL-12");
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);

      router.history.push("/tickets/SNTL-12#packages");
      await discard
        .getByRole("button", { name: "Discard", exact: true })
        .click();

      await expect.element(dialog).not.toBeInTheDocument();
      await expect
        .poll(() => router.state.location.href)
        .toBe("/tickets/SNTL-12#packages");
      expect(requestsWith(spy, "POST")).toHaveLength(0);
    });

    test("is not asked when the screen removes hidden=shown from its URL, after a read that shows no hidden record, and the dialog keeps its input and the focus", async () => {
      let hidden = true;
      stubSuse(() => fictionalCvssAssessments(), {
        ticket: () =>
          ticketResponse(
            fictionalTicketDetail({
              packages: hidden ? [excludedPackage()] : [fictionalPackage()],
            }),
          ),
      });
      const { router, screen } = await renderSuse(
        "/tickets/SNTL-12?hidden=shown",
      );
      const dialog = await openSuseEdit(screen);
      await vectorOf(dialog).fill(VECTOR_V31);
      hidden = false;

      await returnToForeground();

      await expect
        .poll(() => router.state.location.href)
        .toBe("/tickets/SNTL-12");
      await nextFrames();
      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();
      await expect.element(vectorOf(dialog)).toHaveValue(VECTOR_V31);
      await expect.element(vectorOf(dialog)).toHaveFocus();
    });

    // Add with input in the tab that it sends alone is "shows the outcome of
    // Add in the message area" of a change that ends after the user left.
    test("is not asked before a navigation while Add is in progress and another tab holds input, and its outcome shows in the message area", async () => {
      const response = later();
      stubSuse(() => assessmentsWith([NVD_V40, NVD_V31]), {
        upsertSuse: () => response.promise,
      });
      const { router, screen } = await renderSuse();
      const dialog = await openSuseAdd(screen);
      await enterInBothTabs(dialog);
      await submitOf(dialog).click();
      await expect
        .element(submitOf(dialog))
        .toHaveAttribute("aria-disabled", "true");

      await leaveForTickets(router, screen);

      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();
      response.resolve(suseResponse(SAVED_V31, 201));
      await expect
        .element(screen.getByText("SNTL-12: SUSE assessment v3.1 added."))
        .toBeVisible();
    });

    test("is not asked in Edit once the vector is the saved one again", async () => {
      stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();
      const dialog = await openSuseEdit(screen);
      await segmentOf(dialog, "Integrity", "High").click();
      await segmentOf(dialog, "Integrity", "None").click();
      await expect
        .element(vectorOf(dialog))
        .toHaveValue(SUSE_V31.vector_string);

      await dialog.getByRole("button", { name: "Cancel" }).click();

      await expect.element(dialog).not.toBeInTheDocument();
      expect(
        screen.getByRole("dialog", { name: "Discard changes?" }).query(),
      ).toBeNull();
    });
  });

  describe("Delete", () => {
    test("asks for confirmation, naming the assessment, with the consequence, Cancel, which takes the focus, and Delete SUSE assessment as a danger button", async () => {
      stubSuse(() => assessmentsWith([NVD_V31, SUSE_V31]), {
        ticket: ticketIn("analysis"),
      });
      const { screen } = await renderSuse();

      await deleteSuse(screen).click();

      const confirmation = deleteConfirmation(screen);
      await expect
        .element(confirmation.getByRole("button", { name: "Cancel" }))
        .toHaveFocus();
      // The assessment of the default CVSS version, v3.1.
      await expect
        .element(
          confirmation.getByText(
            `${DELETE_CONSEQUENCE}${fallbackSentence("3.1")}${CANNOT_BE_UNDONE}`,
            { exact: true },
          ),
        )
        .toBeVisible();
      const action = confirmation.getByRole("button", {
        name: "Delete SUSE assessment",
        exact: true,
      });
      expect(getComputedStyle(action.element()).backgroundColor).toBe(
        "rgb(207, 34, 46)",
      );
      expect(confirmation.element().getBoundingClientRect().width).toBe(400);
    });

    test.each<
      [
        string,
        string,
        CVSSAssessmentItem[],
        CVECVSSAssessments["default_cvss_version"],
        string,
        boolean,
        boolean,
      ]
    >([
      [
        "the last SUSE assessment, of the default version, of an Analyzed Ticket",
        "analyzed",
        [NVD_V31, SUSE_V31],
        "3.1",
        "3.1",
        true,
        true,
      ],
      [
        "the last SUSE assessment, of the default version, of a Resolved Ticket",
        "resolved",
        [NVD_V31, SUSE_V31],
        "3.1",
        "3.1",
        true,
        true,
      ],
      [
        "the last SUSE assessment of a Ticket in Analysis",
        "analysis",
        [NVD_V31, SUSE_V31],
        "3.1",
        "3.1",
        true,
        false,
      ],
      [
        "the last SUSE assessment of a New Ticket",
        "new",
        [NVD_V31, SUSE_V31],
        "3.1",
        "3.1",
        true,
        false,
      ],
      [
        "one of two SUSE assessments, of the default version, of an Analyzed Ticket",
        "analyzed",
        [SUSE_V40, NVD_V31, SUSE_V31],
        "3.1",
        "3.1",
        true,
        false,
      ],
      [
        "a SUSE assessment beside one of v2.0 of an Analyzed Ticket",
        "analyzed",
        [NVD_V31, SUSE_V31, SUSE_V20],
        "3.1",
        "3.1",
        true,
        false,
      ],
      [
        "the SUSE assessment of v4.0 while the default version is v3.1",
        "analysis",
        [SUSE_V40, NVD_V31, SUSE_V31],
        "3.1",
        "4.0",
        false,
        false,
      ],
      [
        "the SUSE assessment of v4.0, the default version",
        "analysis",
        [SUSE_V40, NVD_V31, SUSE_V31],
        "4.0",
        "4.0",
        true,
        false,
      ],
      [
        "the last SUSE assessment, of v4.0, of an Analyzed Ticket whose default version is v3.1",
        "analyzed",
        [SUSE_V40, NVD_V31],
        "3.1",
        "4.0",
        false,
        true,
      ],
      [
        "the SUSE assessment of v3.1 while the default version is v4.0",
        "analysis",
        [SUSE_V40, NVD_V31, SUSE_V31],
        "4.0",
        "3.1",
        false,
        false,
      ],
    ])(
      "says for %s whether the eligibility score falls back and whether it returns the Ticket to Analysis",
      async (
        _,
        status,
        assessments,
        defaultVersion,
        version,
        fallback,
        returns,
      ) => {
        stubSuse(() => assessmentsWith(assessments, defaultVersion), {
          ticket: ticketIn(status),
        });
        const { screen } = await renderSuse();

        await deleteSuse(screen, version).click();

        await expect
          .element(
            deleteConfirmation(screen, version).getByText(
              `${DELETE_CONSEQUENCE}${fallback ? fallbackSentence(version) : ""}${returns ? RETURNS_TO_ANALYSIS : ""}${CANNOT_BE_UNDONE}`,
              { exact: true },
            ),
          )
          .toBeVisible();
      },
    );

    test("says nothing of the eligibility score falling back when the default version is one that the pinned contract does not list", async () => {
      stubSuse(
        () => ({
          ...assessmentsWith([NVD_V31, SUSE_V31]),
          default_cvss_version: "5.0",
        }),
        { ticket: ticketIn("analysis") },
      );
      const { screen } = await renderSuse();

      await deleteSuse(screen).click();

      await expect
        .element(
          deleteConfirmation(screen).getByText(
            `${DELETE_CONSEQUENCE}${CANNOT_BE_UNDONE}`,
            { exact: true },
          ),
        )
        .toBeVisible();
    });

    test("states the consequence as the read of the assessments shows them while it is open", async () => {
      let assessments = assessmentsWith([SUSE_V40, NVD_V31, SUSE_V31]);
      stubSuse(() => assessments, { ticket: ticketIn("analyzed") });
      const { screen } = await renderSuse();
      await deleteSuse(screen).click();
      const confirmation = deleteConfirmation(screen);
      const without = `${DELETE_CONSEQUENCE}${fallbackSentence("3.1")}${CANNOT_BE_UNDONE}`;
      await expect
        .element(confirmation.getByText(without, { exact: true }))
        .toBeVisible();
      // Meanwhile another analyst deleted the SUSE assessment of v4.0, and an
      // administrator made v4.0 the default version.
      assessments = assessmentsWith([NVD_V31, SUSE_V31], "4.0");

      await returnToForeground();

      await expect
        .element(
          confirmation.getByText(
            `${DELETE_CONSEQUENCE}${RETURNS_TO_ANALYSIS}${CANNOT_BE_UNDONE}`,
            { exact: true },
          ),
        )
        .toBeVisible();
      await expect.element(confirmation).toBeVisible();
    });

    test("states whether it returns the Ticket to Analysis as the read of the Ticket shows its status while it is open", async () => {
      let status = "analysis";
      stubSuse(() => assessmentsWith([NVD_V31, SUSE_V31]), {
        ticket: () => ticketIn(status)(),
      });
      const { screen } = await renderSuse();
      await deleteSuse(screen).click();
      const confirmation = deleteConfirmation(screen);
      await expect
        .element(
          confirmation.getByText(
            `${DELETE_CONSEQUENCE}${fallbackSentence("3.1")}${CANNOT_BE_UNDONE}`,
            { exact: true },
          ),
        )
        .toBeVisible();
      // Meanwhile another analyst completed the analysis.
      status = "analyzed";

      await returnToForeground();

      await expect
        .element(
          confirmation.getByText(
            `${DELETE_CONSEQUENCE}${fallbackSentence("3.1")}${RETURNS_TO_ANALYSIS}${CANNOT_BE_UNDONE}`,
            { exact: true },
          ),
        )
        .toBeVisible();
      await expect.element(confirmation).toBeVisible();
    });

    test("deletes the assessment of its version with Delete SUSE CVSS Assessment, then removes its row once the assessments are read again", async () => {
      let assessments = assessmentsWith([SUSE_V40, NVD_V31, SUSE_V31]);
      const removed: string[] = [];
      stubSuse(() => assessments, {
        deleteSuse: (path) => {
          removed.push(path);
          assessments = assessmentsWith([SUSE_V40, NVD_V31]);
          return new Response(null, { status: 204 });
        },
      });
      const { screen } = await renderSuse();

      const confirmation = await confirmDelete(screen);

      await expect.element(confirmation).not.toBeInTheDocument();
      await expect
        .element(assessmentRow(screen, "SUSE", "3.1"))
        .not.toBeInTheDocument();
      expect(removed).toEqual([`${SUSE_ASSESSMENT}/3.1`]);
      await expect
        .poll(() => cvssAnnouncements(screen))
        .toEqual(["SUSE assessment v3.1 deleted."]);
    });

    test("keeps the assessment after Cancel, without a request", async () => {
      const spy = stubSuse(() => fictionalCvssAssessments());
      const { screen } = await renderSuse();

      await deleteSuse(screen).click();
      await deleteConfirmation(screen)
        .getByRole("button", { name: "Cancel" })
        .click();

      await expect.element(deleteConfirmation(screen)).not.toBeInTheDocument();
      await expect.element(deleteSuse(screen)).toHaveFocus();
      expect(requestsWith(spy, "DELETE")).toHaveLength(0);
    });

    test("keeps the confirmation open while Delete is in progress", async () => {
      const response = later();
      stubSuse(() => fictionalCvssAssessments(), {
        deleteSuse: () => response.promise,
      });
      const { screen } = await renderSuse();

      const confirmation = await confirmDelete(screen);

      await expect
        .element(
          confirmation.getByRole("button", {
            name: "Delete SUSE assessment",
            exact: true,
          }),
        )
        .toHaveAttribute("aria-disabled", "true");
      await userEvent.keyboard("{Escape}");
      await expect.element(confirmation).toBeVisible();
      response.resolve(new Response(null, { status: 204 }));
      await expect.element(confirmation).not.toBeInTheDocument();
    });

    test.each([
      [
        "an assessment that no longer exists, as an error",
        () => errorResponse(404, "CVSS_ASSESSMENT_NOT_FOUND"),
        MESSAGE_GONE,
        MESSAGE_TONES.danger,
      ],
      [
        "a Ticket that does not accept the change, as an error",
        () => errorResponse(409, "TICKET_NOT_MUTABLE"),
        MESSAGE_CONFLICT,
        MESSAGE_TONES.danger,
      ],
      [
        "a change that Sentinel did not confirm, as a warning",
        () => errorResponse(503, "SERVICE_UNAVAILABLE"),
        MESSAGE_UNCONFIRMED,
        MESSAGE_TONES.warning,
      ],
      [
        "a status and a code that the pinned contract does not list, as an error",
        () => errorResponse(418, "FICTIONAL_CODE"),
        MESSAGE_NOT_ACCEPTED,
        MESSAGE_TONES.danger,
      ],
    ])(
      "shows the failure of %s at the top of the confirmation, which stays open and takes the focus",
      async (_, response, message, tone) => {
        stubSuse(() => fictionalCvssAssessments(), { deleteSuse: response });
        const { screen } = await renderSuse();

        const confirmation = await confirmDelete(screen);

        const error = confirmation.getByText(message);
        await expect.element(error).toBeVisible();
        expect(backgroundBehind(error.element())).toBe(tone);
        await expectFocusOnError(error);
        await expect.element(confirmation).toBeVisible();
      },
    );

    describe("the focus after Delete", () => {
      test("moves to the Delete of the row that takes its place", async () => {
        const { screen } = await deleteSuseAmong([SUSE_V40, SUSE_V31], "4.0");

        await expectFocusSettledOn(deleteSuse(screen, "3.1"));
      });

      test("moves to the row that takes its place when it has no Delete", async () => {
        const { screen } = await deleteSuseAmong(
          [NVD_V40, SUSE_V40, NVD_V31],
          "4.0",
        );

        await expectFocusSettledOn(assessmentRow(screen, "NVD", "3.1"));
      });

      test("moves to Add SUSE assessment when no row follows, also when Add SUSE assessment shows only after the read", async () => {
        const { screen } = await deleteSuseAmong(
          [NVD_V40, SUSE_V40, NVD_V31, SUSE_V31],
          "3.1",
        );

        await expectFocusSettledOn(addSuse(screen));
      });

      test("moves no more once the read after Delete fails, and moves to the screen's heading when a later read removes the row of the focus", async () => {
        let phase: "before" | "failing" | "gone" = "before";
        stubSuse(() => fictionalCvssAssessments(), {
          cvss: () => {
            if (phase === "failing") {
              return errorResponse(503, "DATABASE_UNAVAILABLE");
            }
            return cvssResponse(
              phase === "gone"
                ? assessmentsWith([NVD_V31])
                : fictionalCvssAssessments(),
            );
          },
          deleteSuse: () => {
            phase = "failing";
            return new Response(null, { status: 204 });
          },
        });
        const { screen } = await renderSuse();

        await confirmDelete(screen);

        await expect
          .element(cvssPart(screen).getByText(/^This couldn't be updated\./))
          .toBeVisible();
        const row = assessmentRow(screen, "SUSE", "3.1");
        await expect
          .poll(() => row.element().contains(document.activeElement))
          .toBe(true);
        await frames();
        expect(row.element().contains(document.activeElement)).toBe(true);
        // Meanwhile another analyst deleted it, or Sentinel had.
        phase = "gone";

        await returnToForeground();

        await expect.element(row).not.toBeInTheDocument();
        await expectFocusSettledOn(screenHeading(screen));
      });
    });
  });

  describe("the focus after a read", () => {
    test("moves to the screen's heading when a read removes the row whose Edit has the focus", async () => {
      let assessments = fictionalCvssAssessments();
      stubSuse(() => assessments);
      const { screen } = await renderSuse();
      await focusInRow(screen, editSuse(screen));
      // Meanwhile another analyst deleted it.
      assessments = assessmentsWith([NVD_V31]);

      await returnToForeground();

      await expect
        .element(assessmentRow(screen, "SUSE", "3.1"))
        .not.toBeInTheDocument();
      await expectFocusSettledOn(screenHeading(screen));
    });

    test("moves to the screen's heading when a read removes Add SUSE assessment while it has the focus", async () => {
      let assessments = fictionalCvssAssessments();
      stubSuse(() => assessments);
      const { screen } = await renderSuse();
      addSuse(screen).element().focus();
      await expect.element(addSuse(screen)).toHaveFocus();
      // Meanwhile another analyst added the assessment of v4.0.
      assessments = assessmentsWith([SUSE_V40, NVD_V31, SUSE_V31]);

      await returnToForeground();

      await expect.element(addSuse(screen)).not.toBeInTheDocument();
      await expectFocusSettledOn(screenHeading(screen));
    });
  });
});
