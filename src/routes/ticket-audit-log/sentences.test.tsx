import { CircleQuestionMark } from "lucide-react";
import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../../styles.css";
import {
  TicketAuditEventType,
  type TicketAuditEventData,
} from "../../api/generated/model";
import { fictionalEvent, jsonResponse } from "../../test-api";
import {
  ALICE,
  at,
  openFilters,
  panelOf,
  prepareEachTest,
  readText,
  renderEvents,
  sentencesOf,
  showing,
  stubLog,
} from "./test-support";

// The sentences of the events of the tab Audit log
// (src/routes/ticket-audit-log/sentences.tsx; docs/screens/ticket.md, Audit
// log), at the browser's default text size, in the light theme. Its dates and
// times are local times of the browser, sent in UTC as the API sends them, so
// that the tests hold in every time zone.

prepareEachTest();

// The package, the track, and the Product that the events name.
const PACKAGE = "fictional-openssl";
const TRACK = "SUSE:FLES-15-SP7:Update";
const PRODUCT = "Fictional Linux Enterprise Server 15 SP7";
const TRACK_DETAIL = { package: PACKAGE, track: TRACK };
const PRODUCT_DETAIL = {
  ...TRACK_DETAIL,
  product_name: PRODUCT,
  product_cpe: "cpe:/o:example:fles:15:sp7",
};
// The package and the track, and the Product of them, in a sentence.
const ON_TRACK = `${PACKAGE} · ${TRACK}`;
const OF_TRACK = `${PRODUCT} of ${ON_TRACK}`;

// The addresses of references, on another site, and as a sentence reads
// them.
const REFERENCE = "https://bugzilla.example.com/show_bug.cgi?id=1201";
const OTHER_REFERENCE = "https://lists.example.org/fictional/2099/11/1";
const READ_REFERENCE = `${REFERENCE} (another site)`;
const READ_OTHER_REFERENCE = `${OTHER_REFERENCE} (another site)`;

// Canonical CVSS assessment values (Sentinel
// docs/features/tickets/ticket-audit-log.md, Event Type Contract, Rules).
const NVD_VECTOR = "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H";
const SUSE_VECTOR = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N";

// Answers List Ticket Events with events whose fields hold values that the
// pinned contract does not list, which a later Sentinel release can return.
function showingUnlisted(...events: Record<string, unknown>[]) {
  return stubLog({
    events: () =>
      jsonResponse(200, {
        data: events,
        meta: { total: events.length, page: 1, per_page: 50 },
      }),
  });
}

// The number of lines on which an element shows, by the tops of the boxes
// of its text.
function linesOf(element: Element): number {
  return new Set(
    [...element.getClientRects()].map((box) => Math.round(box.top)),
  ).size;
}

// The width of the page: that of the window, less the room that a page with
// the message area keeps for its scrollbar also while it does not scroll
// (src/styles.css), which the body leaves out. Chromium gives the root's
// clientWidth as the width of the window while that room is empty.
function layoutWidth(): number {
  return document.body.clientWidth;
}

// The text of a sentence in runs of one font weight, in their order, as
// [weight, text], without what it hides from assistive technologies.
function weightRunsOf(sentence: Element): [string, string][] {
  const runs: [string, string][] = [];
  const walker = document.createTreeWalker(sentence, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent === null || parent.closest('[aria-hidden="true"]') !== null) {
      continue;
    }
    const weight = getComputedStyle(parent).fontWeight;
    const text = node.textContent ?? "";
    const last = runs.at(-1);
    if (last?.[0] === weight) {
      last[1] += text;
    } else {
      runs.push([weight, text]);
    }
  }
  return runs
    .map(([weight, text]): [string, string] => [
      weight,
      text.replace(/\s+/g, " ").trim(),
    ])
    .filter(([, text]) => text !== "");
}

// The sentence of each event type and its variants (docs/screens/ticket.md,
// Audit log), as events of a page, with the sentences that the tab shows,
// each after its actor.
const SENTENCES: [
  TicketAuditEventType,
  Partial<TicketAuditEventData>[],
  string[],
][] = [
  [
    "ticket_created",
    [
      {
        event_type: "ticket_created",
        old_value: null,
        new_value: null,
        actor: null,
        comment: "CVE ingested from NVD",
      },
      {
        event_type: "ticket_created",
        old_value: null,
        new_value: null,
        comment: "Ticket created manually",
      },
    ],
    [
      "System created the Ticket from its CVE, ingested from NVD",
      "Alice Smith created the Ticket",
    ],
  ],
  [
    "status_change",
    [
      {},
      {
        old_value: "New",
        new_value: "Ignored",
        detail: { ignore_reason: "not_shipped" },
      },
      {
        old_value: "Analysis",
        new_value: "Ignored",
        detail: { ignore_reason: "other" },
      },
      {
        actor: null,
        old_value: "New",
        new_value: "Ignored",
        comment: "CVE rejected",
        detail: { ignore_reason: "cve_rejected" },
      },
      {
        actor: null,
        old_value: "New",
        new_value: "Ignored",
        comment: "CNA auto-ignore policy",
        detail: { ignore_reason: "cna_policy" },
      },
      // Recorded before the reason existed, so its comment follows it.
      {
        actor: null,
        old_value: "New",
        new_value: "Ignored",
        comment: "CVE rejected",
      },
      // A reason that the pinned contract does not list.
      {
        old_value: "New",
        new_value: "Ignored",
        detail: { ignore_reason: "fictional_reason" },
      },
    ],
    [
      "Alice Smith changed the status from Analysis to Analyzed",
      "Alice Smith ignored the Ticket as Not shipped, from New",
      "Alice Smith ignored the Ticket as Other, from Analysis",
      "System ignored the Ticket as CVE rejected, from New",
      "System ignored the Ticket as CNA policy, from New",
      "System changed the status from New to Ignored · CVE rejected",
      "Alice Smith ignored the Ticket as fictional_reason, from New",
    ],
  ],
  [
    "assignment",
    [
      { event_type: "assignment", old_value: null, new_value: "bwilson" },
      { event_type: "assignment", old_value: "asmith", new_value: "bwilson" },
      { event_type: "assignment", old_value: "asmith", new_value: null },
      {
        event_type: "assignment",
        actor: null,
        old_value: "eblack",
        new_value: null,
        comment: "Unassigned from eblack: user deactivated",
      },
      {
        event_type: "assignment",
        actor: null,
        old_value: "eblack",
        new_value: null,
        comment: "Unassigned from eblack: role removed by external sync",
      },
    ],
    [
      "Alice Smith assigned the Ticket to @bwilson",
      "Alice Smith reassigned the Ticket from @asmith to @bwilson",
      "Alice Smith unassigned @asmith",
      "System unassigned @eblack: user deactivated",
      "System unassigned @eblack: role removed by external sync",
    ],
  ],
  [
    "duplicate_set",
    [{ event_type: "duplicate_set", old_value: null, new_value: "SNTL-21" }],
    ["Alice Smith marked the Ticket as a duplicate of SNTL-21"],
  ],
  [
    "duplicate_removed",
    [
      {
        event_type: "duplicate_removed",
        old_value: "SNTL-21",
        new_value: null,
      },
    ],
    ["Alice Smith reverted the duplicate of SNTL-21"],
  ],
  [
    "duplicate_target_changed",
    [
      {
        event_type: "duplicate_target_changed",
        actor: null,
        old_value: "SNTL-22",
        new_value: "SNTL-21",
        detail: { triggered_by_ticket: "SNTL-22" },
      },
    ],
    [
      "System changed the original from SNTL-22 to SNTL-21, as SNTL-22 was marked as a duplicate",
    ],
  ],
  [
    "package_added",
    [
      { event_type: "package_added", old_value: null, new_value: PACKAGE },
      {
        event_type: "package_added",
        actor: null,
        old_value: null,
        new_value: PACKAGE,
        comment: "CVE package resolution",
      },
    ],
    [
      `Alice Smith added or completed the package ${PACKAGE}`,
      `System added or completed the package ${PACKAGE} · CVE package resolution`,
    ],
  ],
  [
    "package_maintainer_added",
    [
      {
        event_type: "package_maintainer_added",
        actor: null,
        old_value: null,
        new_value: "ghill",
        detail: { package: PACKAGE },
      },
    ],
    [`System added the maintainer @ghill to ${PACKAGE}`],
  ],
  [
    "package_excluded",
    [{ event_type: "package_excluded", old_value: PACKAGE, new_value: null }],
    [`Alice Smith excluded the package ${PACKAGE}`],
  ],
  [
    "package_restored",
    [{ event_type: "package_restored", old_value: null, new_value: PACKAGE }],
    [`Alice Smith restored the package ${PACKAGE}`],
  ],
  [
    "track_status_changed",
    [
      {
        event_type: "track_status_changed",
        old_value: "ANALYSIS",
        new_value: "AFFECTED",
        detail: TRACK_DETAIL,
      },
      {
        event_type: "track_status_changed",
        old_value: "AFFECTED",
        new_value: "NOT_AFFECTED",
        detail: TRACK_DETAIL,
      },
      {
        event_type: "track_status_changed",
        actor: null,
        old_value: "AFFECTED",
        new_value: "FIXED",
        detail: TRACK_DETAIL,
      },
      {
        event_type: "track_status_changed",
        old_value: "ANALYSIS",
        new_value: "WONT_FIX",
        detail: TRACK_DETAIL,
      },
      // A track status that the pinned contract does not list.
      {
        event_type: "track_status_changed",
        old_value: "ANALYSIS",
        new_value: "FICTIONAL_STATUS",
        detail: TRACK_DETAIL,
      },
    ],
    [
      `Alice Smith set ${ON_TRACK} from Analysis to Affected`,
      `Alice Smith set ${ON_TRACK} from Affected to Not affected`,
      `System set ${ON_TRACK} from Affected to Fixed`,
      `Alice Smith set ${ON_TRACK} from Analysis to Won't fix`,
      `Alice Smith set ${ON_TRACK} from Analysis to FICTIONAL_STATUS`,
    ],
  ],
  [
    "track_excluded",
    [
      {
        event_type: "track_excluded",
        old_value: TRACK,
        new_value: null,
        detail: TRACK_DETAIL,
      },
    ],
    [`Alice Smith excluded the track ${ON_TRACK}`],
  ],
  [
    "track_restored",
    [
      {
        event_type: "track_restored",
        old_value: null,
        new_value: TRACK,
        detail: TRACK_DETAIL,
      },
    ],
    [`Alice Smith restored the track ${ON_TRACK}`],
  ],
  [
    "product_released",
    [
      {
        event_type: "product_released",
        actor: null,
        old_value: null,
        new_value: at(2099, 11, 8, 13, 5),
        detail: { ...PRODUCT_DETAIL, advisory_id: "SUSE-SU-2099:0001-1" },
      },
    ],
    [
      `System recorded the release of ${OF_TRACK} on 8 Nov 2099, 13:05, in SUSE-SU-2099:0001-1`,
    ],
  ],
  [
    "product_eligibility_changed",
    [
      {
        event_type: "product_eligibility_changed",
        actor: null,
        old_value: "false",
        new_value: "true",
        detail: { ...PRODUCT_DETAIL, reason: "cvss" },
      },
      {
        event_type: "product_eligibility_changed",
        actor: null,
        old_value: "true",
        new_value: "false",
        detail: { ...PRODUCT_DETAIL, reason: "threshold" },
      },
      {
        event_type: "product_eligibility_changed",
        actor: null,
        old_value: "true",
        new_value: "false",
        detail: { ...PRODUCT_DETAIL, reason: "reactive_ltss" },
      },
      {
        event_type: "product_eligibility_changed",
        actor: null,
        old_value: "false",
        new_value: "true",
        detail: { ...PRODUCT_DETAIL, reason: "reactivation" },
      },
      {
        event_type: "product_eligibility_changed",
        old_value: "true",
        new_value: "false",
        detail: {
          ...PRODUCT_DETAIL,
          reason: "va_override",
          override_action: "set",
        },
      },
      {
        event_type: "product_eligibility_changed",
        old_value: "false",
        new_value: "true",
        detail: {
          ...PRODUCT_DETAIL,
          reason: "va_override",
          override_action: "changed",
        },
      },
      {
        event_type: "product_eligibility_changed",
        old_value: "false",
        new_value: "true",
        detail: {
          ...PRODUCT_DETAIL,
          reason: "va_override",
          override_action: "cleared",
        },
      },
      // A reason that the pinned contract does not list.
      {
        event_type: "product_eligibility_changed",
        actor: null,
        old_value: "false",
        new_value: "true",
        detail: { ...PRODUCT_DETAIL, reason: "fictional_reason" },
      },
    ],
    [
      `System made ${OF_TRACK} eligible after a change of the CVSS assessments or of the default CVSS version`,
      `System made ${OF_TRACK} not eligible after a change of its CVSS threshold`,
      `System made ${OF_TRACK} not eligible after a change of its lifecycle phase`,
      `System made ${OF_TRACK} eligible as the Ticket left Ignored or Duplicated`,
      `Alice Smith set ${OF_TRACK} as not eligible by hand`,
      `Alice Smith set ${OF_TRACK} as eligible by hand`,
      `Alice Smith returned ${OF_TRACK} to automatic eligibility, eligible`,
      `System made ${OF_TRACK} eligible, fictional_reason`,
    ],
  ],
  [
    "product_excluded",
    [
      {
        event_type: "product_excluded",
        old_value: PRODUCT,
        new_value: null,
        detail: PRODUCT_DETAIL,
      },
    ],
    [`Alice Smith excluded ${PRODUCT} from ${ON_TRACK}`],
  ],
  [
    "product_restored",
    [
      {
        event_type: "product_restored",
        old_value: null,
        new_value: PRODUCT,
        detail: PRODUCT_DETAIL,
      },
    ],
    [`Alice Smith restored ${PRODUCT} on ${ON_TRACK}`],
  ],
  [
    "cve_associated",
    [
      {
        event_type: "cve_associated",
        old_value: null,
        new_value: "CVE-2099-0021",
      },
    ],
    ["Alice Smith associated CVE-2099-0021"],
  ],
  [
    "severity_changed",
    [
      {
        event_type: "severity_changed",
        actor: null,
        old_value: null,
        new_value: "High",
      },
      {
        event_type: "severity_changed",
        actor: null,
        old_value: "High",
        new_value: "Critical",
      },
      { event_type: "severity_changed", old_value: "High", new_value: null },
    ],
    [
      "System set the severity to High",
      "System changed the severity from High to Critical",
      "Alice Smith removed the severity High",
    ],
  ],
  [
    "priority_changed",
    [
      {
        event_type: "priority_changed",
        actor: null,
        old_value: null,
        new_value: "P3",
      },
      {
        event_type: "priority_changed",
        actor: null,
        old_value: "P3",
        new_value: "P2",
      },
      {
        event_type: "priority_changed",
        actor: null,
        old_value: "P3",
        new_value: null,
      },
      {
        event_type: "priority_changed",
        old_value: "P3",
        new_value: "P1",
        detail: { override_action: "set" },
      },
      {
        event_type: "priority_changed",
        old_value: "P1",
        new_value: "P2",
        detail: { override_action: "changed" },
      },
      {
        event_type: "priority_changed",
        old_value: "P1",
        new_value: "P3",
        detail: { override_action: "cleared" },
      },
    ],
    [
      "System set the priority to P3",
      "System changed the priority from P3 to P2",
      "System changed the priority from P3 to Not set",
      "Alice Smith overrode the priority from P3 to P1",
      "Alice Smith changed the priority override from P1 to P2",
      "Alice Smith cleared the priority override, from P1 to P3",
    ],
  ],
  [
    "cvss_assessment_changed",
    [
      {
        event_type: "cvss_assessment_changed",
        actor: null,
        old_value: null,
        new_value: `NVD v3.1 ${NVD_VECTOR} (8.1)`,
      },
      {
        event_type: "cvss_assessment_changed",
        old_value: `SUSE v3.1 ${SUSE_VECTOR} (7.5)`,
        new_value: `SUSE v3.1 ${NVD_VECTOR} (8.1)`,
      },
      {
        event_type: "cvss_assessment_changed",
        old_value: `SUSE v3.1 ${NVD_VECTOR} (8.1)`,
        new_value: null,
      },
      // A value of another form than the canonical one.
      {
        event_type: "cvss_assessment_changed",
        actor: null,
        old_value: null,
        new_value: "NVD fictional assessment",
      },
    ],
    [
      `System added the NVD CVSS v3.1 assessment 8.1, ${NVD_VECTOR}`,
      `Alice Smith changed the SUSE CVSS v3.1 assessment from 7.5, ${SUSE_VECTOR} to 8.1, ${NVD_VECTOR}`,
      `Alice Smith deleted the SUSE CVSS v3.1 assessment 8.1, ${NVD_VECTOR}`,
      "System added a CVSS assessment NVD fictional assessment",
    ],
  ],
  [
    "confidentiality_changed",
    [
      {
        event_type: "confidentiality_changed",
        old_value: "false",
        new_value: "true",
      },
      {
        event_type: "confidentiality_changed",
        old_value: "true",
        new_value: "false",
      },
    ],
    [
      "Alice Smith made the Ticket confidential",
      "Alice Smith made the Ticket non-confidential",
    ],
  ],
  [
    "coordinated_release_changed",
    [
      {
        event_type: "coordinated_release_changed",
        old_value: null,
        new_value: at(2099, 11, 25, 14, 0),
      },
      {
        event_type: "coordinated_release_changed",
        old_value: at(2099, 11, 25, 14, 0),
        new_value: at(2099, 12, 2, 9, 30),
      },
      {
        event_type: "coordinated_release_changed",
        old_value: at(2099, 11, 25, 14, 0),
        new_value: null,
      },
    ],
    [
      "Alice Smith set the Coordinated Release Date to 25 Nov 2099, 14:00",
      "Alice Smith changed the Coordinated Release Date from 25 Nov 2099, 14:00 to 2 Dec 2099, 09:30",
      "Alice Smith removed the Coordinated Release Date 25 Nov 2099, 14:00",
    ],
  ],
  [
    "access_grant_added",
    [
      {
        event_type: "access_grant_added",
        old_value: null,
        new_value: "cwhite",
      },
    ],
    ["Alice Smith granted access to @cwhite"],
  ],
  [
    "access_grant_removed",
    [
      {
        event_type: "access_grant_removed",
        old_value: "cwhite",
        new_value: null,
      },
    ],
    ["Alice Smith revoked the access of @cwhite"],
  ],
  [
    "reference_added",
    [{ event_type: "reference_added", old_value: null, new_value: REFERENCE }],
    [`Alice Smith added the reference ${READ_REFERENCE}`],
  ],
  [
    "reference_deleted",
    [
      {
        event_type: "reference_deleted",
        old_value: REFERENCE,
        new_value: null,
      },
    ],
    [`Alice Smith deleted the reference ${READ_REFERENCE}`],
  ],
  [
    "reference_url_changed",
    [
      {
        event_type: "reference_url_changed",
        old_value: REFERENCE,
        new_value: OTHER_REFERENCE,
      },
    ],
    [
      `Alice Smith changed the address of a reference from ${READ_REFERENCE} to ${READ_OTHER_REFERENCE}`,
    ],
  ],
  [
    "reference_type_changed",
    [
      {
        event_type: "reference_type_changed",
        old_value: "article",
        new_value: "advisory",
        detail: { url: REFERENCE },
      },
      {
        event_type: "reference_type_changed",
        old_value: null,
        new_value: "patch",
        detail: { url: REFERENCE },
      },
      {
        event_type: "reference_type_changed",
        old_value: "issue",
        new_value: null,
        detail: { url: REFERENCE },
      },
      // A reference type that the pinned contract does not list.
      {
        event_type: "reference_type_changed",
        old_value: "article",
        new_value: "fictional_type",
        detail: { url: REFERENCE },
      },
    ],
    [
      `Alice Smith changed the type of ${READ_REFERENCE} from Article to Advisory`,
      `Alice Smith changed the type of ${READ_REFERENCE} from Uncategorized to Patch`,
      `Alice Smith changed the type of ${READ_REFERENCE} from Issue to Uncategorized`,
      `Alice Smith changed the type of ${READ_REFERENCE} from Article to fictional_type`,
    ],
  ],
  [
    "reference_title_changed",
    [
      {
        event_type: "reference_title_changed",
        old_value: "Fictional advisory draft",
        new_value: "Fictional advisory",
        detail: { url: REFERENCE },
      },
      {
        event_type: "reference_title_changed",
        old_value: null,
        new_value: "Fictional advisory",
        detail: { url: REFERENCE },
      },
      {
        event_type: "reference_title_changed",
        old_value: "Fictional advisory",
        new_value: null,
        detail: { url: REFERENCE },
      },
    ],
    [
      `Alice Smith changed the title of ${READ_REFERENCE} from “Fictional advisory draft” to “Fictional advisory”`,
      `Alice Smith set the title of ${READ_REFERENCE} to “Fictional advisory”`,
      `Alice Smith removed the title “Fictional advisory” of ${READ_REFERENCE}`,
    ],
  ],
  [
    "reference_description_changed",
    [
      {
        event_type: "reference_description_changed",
        old_value: "A fictional draft description.",
        new_value: "A fictional description.",
        detail: { url: REFERENCE },
      },
      {
        event_type: "reference_description_changed",
        old_value: null,
        new_value: "A fictional description.",
        detail: { url: REFERENCE },
      },
      {
        event_type: "reference_description_changed",
        old_value: "A fictional description.",
        new_value: null,
        detail: { url: REFERENCE },
      },
    ],
    [
      `Alice Smith changed the description of ${READ_REFERENCE} from “A fictional draft description.” to “A fictional description.”`,
      `Alice Smith set the description of ${READ_REFERENCE} to “A fictional description.”`,
      `Alice Smith removed the description “A fictional description.” of ${READ_REFERENCE}`,
    ],
  ],
];

describe("the sentences", () => {
  test("cover every event type of the pinned contract", () => {
    expect(SENTENCES.map(([type]) => type).toSorted()).toEqual(
      Object.values(TicketAuditEventType).toSorted(),
    );
  });

  test.each(SENTENCES)(
    "say what the actor of %s did",
    async (_, events, sentences) => {
      showing(...events);

      const { screen } = await renderEvents();

      expect(sentencesOf(screen)).toEqual(sentences);
    },
  );

  test.each([
    [
      "a track status change without its track",
      {
        event_type: "track_status_changed",
        old_value: "ANALYSIS",
        new_value: "AFFECTED",
      },
      "Alice Smith set a track from Analysis to Affected",
    ],
    [
      "an exclusion of a Product without its subject, by its name",
      { event_type: "product_excluded", old_value: PRODUCT, new_value: null },
      `Alice Smith excluded ${PRODUCT} from a track`,
    ],
    [
      "a change of eligibility without its subject and reason",
      {
        event_type: "product_eligibility_changed",
        actor: null,
        old_value: "false",
        new_value: "true",
      },
      "System made a Product of a track eligible",
    ],
    [
      "a release without its advisory",
      {
        event_type: "product_released",
        actor: null,
        old_value: null,
        new_value: at(2099, 11, 8, 13, 5),
        detail: PRODUCT_DETAIL,
      },
      `System recorded the release of ${OF_TRACK} on 8 Nov 2099, 13:05`,
    ],
    [
      "a change of the original without the Ticket that triggered it",
      {
        event_type: "duplicate_target_changed",
        actor: null,
        old_value: "SNTL-22",
        new_value: "SNTL-21",
      },
      "System changed the original from SNTL-22 to SNTL-21",
    ],
    [
      "a maintainer added without the package",
      {
        event_type: "package_maintainer_added",
        actor: null,
        old_value: null,
        new_value: "ghill",
      },
      "System added the maintainer @ghill",
    ],
    [
      "a change of the confidentiality with a value of another form",
      {
        event_type: "confidentiality_changed",
        old_value: "false",
        new_value: "fictional",
      },
      "Alice Smith changed the confidentiality from false to fictional",
    ],
    [
      "a change of the type without its reference",
      {
        event_type: "reference_type_changed",
        old_value: "article",
        new_value: "advisory",
      },
      "Alice Smith changed the type of a reference from Article to Advisory",
    ],
    [
      "a change of the title without its reference",
      {
        event_type: "reference_title_changed",
        old_value: null,
        new_value: "Fictional advisory",
      },
      "Alice Smith set the title of a reference to “Fictional advisory”",
    ],
    [
      "a comment that the sentence does not say",
      {
        event_type: "ticket_created",
        old_value: null,
        new_value: null,
        comment: "Fictional import",
      },
      "Alice Smith created the Ticket · Fictional import",
    ],
  ] as const)("say what the fields of %s hold", async (_, fields, sentence) => {
    showing(fields);

    const { screen } = await renderEvents();

    expect(sentencesOf(screen)).toEqual([sentence]);
  });

  // The override actions of the pinned contract are set, changed, and
  // cleared (Sentinel docs/features/tickets/ticket-audit-log.md, detail
  // JSONB Schema Contract).
  test.each([
    [
      "a change of the priority, as the change of an automatic priority",
      {
        event_type: "priority_changed",
        old_value: "P3",
        new_value: "P1",
        detail: { override_action: "fictional_action" },
      },
      "Alice Smith changed the priority from P3 to P1",
    ],
    [
      "a change of eligibility by hand, as an override that is set",
      {
        event_type: "product_eligibility_changed",
        old_value: "true",
        new_value: "false",
        detail: {
          ...PRODUCT_DETAIL,
          reason: "va_override",
          override_action: "fictional_action",
        },
      },
      `Alice Smith set ${OF_TRACK} as not eligible by hand`,
    ],
  ] as const)(
    "say what the actor of %s did with an override action that the pinned contract does not list",
    async (_, fields, sentence) => {
      showing(fields);

      const { screen } = await renderEvents();

      expect(sentencesOf(screen)).toEqual([sentence]);
      expect(panelOf(screen).element().textContent).not.toContain(
        "fictional_action",
      );
    },
  );

  test("show an event type that the pinned contract does not list by its actor and its type as received, with its time and none of its values", async () => {
    const created = at(2099, 11, 8, 14, 10);
    showingUnlisted({
      ...fictionalEvent({ created_at: created }),
      event_type: "fictional_event",
      old_value: "fictional-old-value",
      new_value: "fictional-new-value",
      detail: { fictional_key: "fictional-detail" },
    });

    const { screen } = await renderEvents();

    expect(sentencesOf(screen)).toEqual(["Alice Smith fictional_event"]);
    const item = panelOf(screen).getByRole("listitem");
    expect(readText(item.element())).toBe("14:10 Alice Smith fictional_event");
    expect(panelOf(screen).element().textContent).not.toMatch(/fictional-/);
  });

  test("mark each event with the icon of its kind, as the kinds of the filters show it, and an event type that the pinned contract does not list with circle-question-mark", async () => {
    showingUnlisted(
      ...[
        "ticket_created",
        "assignment",
        "package_added",
        "severity_changed",
        "priority_changed",
        "access_grant_added",
        "reference_added",
        "fictional_event",
      ].map((type, index) => ({
        ...fictionalEvent({
          id: `00000000-0000-7000-8000-00000000000${String(index + 1)}`,
          old_value: null,
          new_value: null,
        }),
        event_type: type,
      })),
    );
    const { screen } = await renderEvents();
    // The marker, hidden from assistive technologies, comes first in its
    // row, before the avatar of the actor.
    const markers = panelOf(screen)
      .getByRole("listitem")
      .elements()
      .map((item) => item.querySelector("svg"));
    const unknown = await render(<CircleQuestionMark />);
    const questionMark = unknown.container.querySelector("svg")?.innerHTML;

    const dialog = await openFilters(screen);

    const kinds = dialog.getByRole("group", { name: "Kind" });
    const icons = [
      "Status",
      "Assignment",
      "Packages",
      "CVE and CVSS",
      "Priority",
      "Confidentiality",
      "References",
    ].map(
      (kind) =>
        kinds.getByText(kind, { exact: true }).element().querySelector("svg")
          ?.innerHTML,
    );
    expect(new Set(icons).size).toBe(7);
    expect(markers.map((marker) => marker?.innerHTML)).toEqual([
      ...icons,
      questionMark,
    ]);
    expect(
      markers.every(
        (marker) => marker?.closest('[aria-hidden="true"]') !== null,
      ),
    ).toBe(true);
  });

  test("link each Ticket identifier to its screen, and show a value of another form as text", async () => {
    showing(
      {
        event_type: "duplicate_target_changed",
        actor: null,
        old_value: "SNTL-22",
        new_value: "SNTL-21",
        detail: { triggered_by_ticket: "SNTL-22" },
      },
      { event_type: "duplicate_set", old_value: null, new_value: "SNTL-0021" },
    );

    const { screen } = await renderEvents();

    const links = panelOf(screen).getByRole("link");
    expect(
      links
        .elements()
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["SNTL-22", "/tickets/SNTL-22"],
      ["SNTL-21", "/tickets/SNTL-21"],
      ["SNTL-22", "/tickets/SNTL-22"],
    ]);
    expect(sentencesOf(screen)[1]).toBe(
      "Alice Smith marked the Ticket as a duplicate of SNTL-0021",
    );
  });

  test("link the address of a reference to the address as the browser parses it, and show a value that is not a web address as text", async () => {
    showing(
      {
        event_type: "reference_added",
        old_value: null,
        new_value: "HTTPS://Bugzilla.Example.COM/show_bug.cgi?id=1201",
      },
      {
        event_type: "reference_added",
        old_value: null,
        new_value: "pkg:rpm/suse/fictional-openssl",
      },
    );

    const { screen } = await renderEvents();

    const link = panelOf(screen).getByRole("link", {
      name: READ_REFERENCE,
      exact: true,
    });
    await expect.element(link).toHaveAttribute("href", REFERENCE);
    expect(panelOf(screen).getByRole("link").elements()).toHaveLength(1);
    expect(sentencesOf(screen)).toEqual([
      `Alice Smith added the reference ${READ_REFERENCE}`,
      "Alice Smith added the reference pkg:rpm/suse/fictional-openssl",
    ]);
  });

  test("show at weight 500 only the actor, the objects of a sentence, and the usernames that an event records, and its values at weight 400", async () => {
    showing(
      { event_type: "assignment", old_value: null, new_value: "bwilson" },
      {
        event_type: "track_status_changed",
        old_value: "ANALYSIS",
        new_value: "AFFECTED",
        detail: TRACK_DETAIL,
      },
    );

    const { screen } = await renderEvents();

    const [assignment, track] = panelOf(screen)
      .getByRole("paragraph")
      .elements();
    if (assignment === undefined || track === undefined) {
      throw new Error("The tab shows no two events");
    }
    expect(weightRunsOf(assignment)).toEqual([
      ["500", "Alice Smith"],
      ["400", "assigned the Ticket to"],
      ["500", "@bwilson"],
    ]);
    expect(weightRunsOf(track)).toEqual([
      ["500", "Alice Smith"],
      ["400", "set"],
      ["500", ON_TRACK],
      ["400", "from Analysis to Affected"],
    ]);
    // A username alone, without an avatar or labels.
    expect(
      page
        .elementLocator(assignment)
        .getByText("@bwilson", { exact: true })
        .element()
        .querySelector("svg"),
    ).toBeNull();
  });

  test.each([
    ["a person", ALICE, "14px"],
    ["the system", null, "13px"],
  ])(
    "show the vector of an assessment that %s changed in monospace, at the size of its sentence",
    async (_, actor, size) => {
      showing({
        event_type: "cvss_assessment_changed",
        actor,
        old_value: null,
        new_value: `NVD v3.1 ${NVD_VECTOR} (8.1)`,
      });

      const { screen } = await renderEvents();

      const sentence = panelOf(screen).getByRole("paragraph").element();
      const vector = getComputedStyle(
        panelOf(screen).getByText(NVD_VECTOR, { exact: true }).element(),
      );
      expect(vector.fontFamily).toContain("monospace");
      expect([getComputedStyle(sentence).fontSize, vector.fontSize]).toEqual([
        size,
        size,
      ]);
    },
  );

  test("break a vector only after a slash at 320 CSS pixels, never within a metric", async () => {
    await page.viewport(320, 640);
    const vector =
      "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N";
    showing({
      event_type: "cvss_assessment_changed",
      old_value: null,
      new_value: `SUSE v4.0 ${vector} (9.3)`,
    });

    const { screen } = await renderEvents();

    const shown = panelOf(screen).getByText(vector, { exact: true }).element();
    // The vector takes several lines of its sentence.
    expect(linesOf(shown)).toBeGreaterThan(1);
    // Each metric, with the slash after it, on one line.
    const metrics = [...shown.children];
    expect(metrics.map((metric) => metric.textContent)).toEqual(
      vector
        .split("/")
        .map((metric, index, all) =>
          index < all.length - 1 ? `${metric}/` : metric,
        ),
    );
    for (const metric of metrics) {
      expect(linesOf(metric)).toBe(1);
    }
    expect(document.documentElement.scrollWidth).toBe(layoutWidth());
  });

  test("keep none of the line breaks of a text", async () => {
    showing({
      event_type: "reference_title_changed",
      old_value: null,
      new_value: "Fictional\nadvisory",
      detail: { url: REFERENCE },
    });

    const { screen } = await renderEvents();

    const sentence = panelOf(screen).getByRole("paragraph").element();
    if (!(sentence instanceof HTMLElement)) {
      throw new Error("The sentence is not an HTML element");
    }
    // The text as the page renders it.
    expect(sentence.innerText).toContain("“Fictional advisory”");
  });

  test("wrap an address at any character at 320 CSS pixels, without scrolling in two directions", async () => {
    await page.viewport(320, 640);
    showing({
      event_type: "reference_added",
      old_value: null,
      new_value: `https://bugzilla.example.com/${"fictional_path_".repeat(8)}`,
    });

    await renderEvents();

    expect(document.documentElement.scrollWidth).toBe(layoutWidth());
  });
});
