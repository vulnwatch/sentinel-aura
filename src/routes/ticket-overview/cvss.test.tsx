import { describe, expect, test } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import type {
  CVECVSSAssessments,
  CVSS30Assessment,
} from "../../api/generated/model";
import {
  cvssResponse,
  errorResponse,
  fictionalAssessment,
  fictionalCvssAssessments,
  fictionalPackage,
  fictionalSuseAssessment,
  jsonResponse,
  requestsTo,
  urlOf,
} from "../../test-api";
import {
  boxOf,
  CNA_V20,
  CVSS,
  cvssPart,
  later,
  layoutWidth,
  NVD_V31_VECTOR,
  NVD_V40,
  packagesPart,
  prepareEachTest,
  renderApp,
  renderTree,
  returnToForeground,
  type Screen,
  showing,
  stubTicket,
} from "./test-support";

// The CVSS assessments of Overview, the first tab of the Ticket screen
// (src/routes/ticket-overview/cvss.tsx; docs/screens/ticket.md), at the
// browser's default text size, in the light theme.

prepareEachTest();

// Answers Get Ticket with SNTL-12 and its CVE-2099-0012, and the read of
// the CVSS assessments with the assessments.
function showingCvss(
  assessments: CVECVSSAssessments | Record<string, unknown>,
) {
  return stubTicket({
    cvss: () => jsonResponse(200, { data: assessments }),
  });
}

// Renders the screen of SNTL-12 and waits until its CVSS assessments show
// the text.
async function renderCvss(text: string) {
  const rendered = await renderApp("/tickets/SNTL-12");
  await expect
    .element(cvssPart(rendered.screen).getByText(text).first())
    .toBeVisible();
  return rendered;
}

// The lines of what the assessments resolve, each its term and its value.
function linesOf(screen: Screen): string[][] {
  const part = cvssPart(screen);
  const values = part.getByRole("definition").elements();
  return part
    .getByRole("term")
    .elements()
    .map((term, index) => [
      term.textContent ?? "",
      values[index]?.textContent ?? "",
    ]);
}

// The rows of the table of the assessments, each the texts of its cells.
function rowsOf(screen: Screen): string[][] {
  const table = cvssPart(screen).getByRole("grid", {
    name: "CVSS assessments",
  });
  return table
    .getByRole("row")
    .elements()
    .slice(1)
    .map((row) => {
      const cells = page.elementLocator(row);
      return [
        ...cells.getByRole("rowheader").elements(),
        ...cells.getByRole("gridcell").elements(),
      ].map((cell) => cell.textContent ?? "");
    });
}

// The text of each line of an element, from the top of each of its
// characters, without the spaces at which the lines break.
function linesOfText(element: Element): string[] {
  const lines = new Map<number, string>();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    for (let index = 0; index < text.length; index += 1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const top = Math.round(range.getBoundingClientRect().top);
      lines.set(top, `${lines.get(top) ?? ""}${text.charAt(index)}`);
    }
  }
  return [...lines.entries()]
    .toSorted(([first], [second]) => first - second)
    .map(([, text]) => text.trim());
}

// The terms of the popover of a vector, each with the definition of the
// same rank, as each term has one: a group's definition holds the terms of
// its metrics, which follow it.
function fieldsOf(popover: Locator): [Element, Element][] {
  const definitions = popover.getByRole("definition").elements();
  return popover
    .getByRole("term")
    .elements()
    .flatMap((term, index): [Element, Element][] => {
      const definition = definitions[index];
      return definition === undefined ? [] : [[term, definition]];
    });
}

// Whether a definition is that of a group, which holds terms of its own.
function isGroup(definition: Element): boolean {
  return (
    page.elementLocator(definition).getByRole("term").elements().length > 0
  );
}

// The metrics of the popover of a vector, in their order: the term of each
// group, and each metric as its term and its value.
function metricsOf(popover: Locator): (string | string[])[] {
  return fieldsOf(popover).map(([term, definition]) =>
    isGroup(definition)
      ? (term.textContent ?? "")
      : [term.textContent ?? "", definition.textContent ?? ""],
  );
}

// The terms and the values of the metrics of the popover of a vector, each
// group's term left out.
function metricFieldsOf(popover: Locator): [Element, Element][] {
  return fieldsOf(popover).filter(([, definition]) => !isGroup(definition));
}

describe("the CVSS assessments", () => {
  test("follow the CVE and precede the package tree, under a level-two heading", async () => {
    stubTicket();
    const { screen } = await renderCvss("SUSE");

    await expect
      .element(
        cvssPart(screen).getByRole("heading", {
          level: 2,
          name: "CVSS assessments",
        }),
      )
      .toBeVisible();
    expect(boxOf(cvssPart(screen)).top).toBeGreaterThan(
      boxOf(screen.getByRole("region", { name: "CVE-2099-0012", exact: true }))
        .bottom,
    );
    expect(boxOf(cvssPart(screen)).bottom).toBeLessThan(
      boxOf(packagesPart(screen)).top,
    );
  });

  test("say in one line that the SUSE assessment of the default version sets the severity and the eligibility score", async () => {
    stubTicket();
    const { screen } = await renderCvss("SUSE");

    expect(linesOf(screen)).toEqual([
      [
        "Severity",
        "Medium (5.5) from SUSE CVSS v3.1, which also sets the eligibility score of the Products",
      ],
    ]);
  });

  test("show the severity and the fallback eligibility score apart without a SUSE assessment of the default version", async () => {
    showingCvss(
      fictionalCvssAssessments({
        assessments: [NVD_V40],
        severity: {
          score: 9.3,
          version: "4.0",
          provider: "NVD",
          label: "critical",
        },
        eligibility: { score: 10, source: "fallback" },
      }),
    );
    const { screen } = await renderCvss("NVD");

    expect(linesOf(screen)).toEqual([
      ["Severity", "Critical (9.3) from NVD CVSS v4.0"],
      [
        "Eligibility score",
        "10.0, the fallback without a SUSE CVSS v3.1 assessment",
      ],
    ]);
    // The eligibility score starts a line below the severity.
    const [severity, eligibility] = cvssPart(screen)
      .getByRole("term")
      .elements();
    expect(boxOf(eligibility!).top).toBeGreaterThanOrEqual(
      boxOf(severity!).bottom,
    );
  });

  test("name the default version that the eligibility score lacks when a SUSE assessment of another version sets the severity", async () => {
    showingCvss(
      fictionalCvssAssessments({
        default_cvss_version: "4.0",
        eligibility: { score: 10, source: "fallback" },
      }),
    );
    const { screen } = await renderCvss("SUSE");

    expect(linesOf(screen)).toEqual([
      ["Severity", "Medium (5.5) from SUSE CVSS v3.1"],
      [
        "Eligibility score",
        "10.0, the fallback without a SUSE CVSS v4.0 assessment",
      ],
    ]);
  });

  test("show a source of the eligibility score and versions that the pinned contract does not list as received", async () => {
    showingCvss({
      ...fictionalCvssAssessments(),
      default_cvss_version: "5.0",
      severity: { score: 8.1, version: "5.0", provider: "NVD", label: "high" },
      eligibility: { score: 7, source: "fictional_source" },
    });
    const { screen } = await renderCvss("SUSE");

    expect(linesOf(screen)).toEqual([
      ["Severity", "High (8.1) from NVD CVSS 5.0"],
      ["Eligibility score", "7.0, fictional_source"],
    ]);
  });

  test("list the assessments in the order of the API, by provider and version, with the Base score and the severity of each by its version, and its vector", async () => {
    // An order that neither the version nor the provider gives, and the
    // widest score, so that the severities align after scores of two widths.
    showingCvss(
      fictionalCvssAssessments({
        assessments: [
          fictionalSuseAssessment(),
          { ...CNA_V20, score: 10 },
          NVD_V40,
        ],
      }),
    );
    const { screen } = await renderCvss("Fictional CNA");
    const table = cvssPart(screen).getByRole("grid", {
      name: "CVSS assessments",
    });

    expect(
      table
        .getByRole("columnheader")
        .elements()
        .map((header) => header.textContent),
    ).toEqual(["Provider", "Version", "Base score", "Vector"]);
    expect(rowsOf(screen)).toEqual([
      [
        "SUSE",
        "v3.1",
        "5.5 Medium",
        "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
      ],
      ["Fictional CNA", "v2.0", "10.0 High", "AV:N/AC:L/Au:N/C:P/I:P/A:P"],
      [
        "NVD",
        "v4.0",
        "9.3 Critical",
        "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
      ],
    ]);
    // The scores align in their column, in tabular figures
    // (docs/design-system.md, Type Scale), and end at the same place, so
    // that the severities after them align too.
    const scores = ["5.5", "10.0", "9.3"].map((score) =>
      table.getByText(score, { exact: true }),
    );
    for (const score of scores) {
      expect(getComputedStyle(score.element()).fontVariantNumeric).toBe(
        "tabular-nums",
      );
    }
    expect(new Set(scores.map((score) => boxOf(score).right)).size).toBe(1);
    expect(
      new Set(
        ["Medium", "High", "Critical"].map(
          (name) => boxOf(table.getByText(name, { exact: true })).left,
        ),
      ).size,
    ).toBe(1);
    // Assistive technologies name each row by its provider and its version.
    expect(
      table
        .getByRole("rowheader")
        .elements()
        .map((cell) => cell.textContent),
    ).toEqual(["SUSE", "v3.1", "Fictional CNA", "v2.0", "NVD", "v4.0"]);
  });

  test("show a version and a severity of an assessment that the pinned contract does not list as received, without the severity of an unlisted version", async () => {
    showingCvss({
      ...fictionalCvssAssessments(),
      assessments: [
        {
          ...fictionalAssessment(),
          cvss_version: "5.0",
          severity: "high",
          score: 6.2,
          vector_string: "CVSS:5.0/AV:N",
        },
        {
          ...fictionalSuseAssessment(),
          severity: "fictional_severity",
        },
      ],
    });
    const { screen } = await renderCvss("CVSS:5.0/AV:N");

    // The scale of the severity depends on the version, so the severity of
    // an unlisted version is left out (docs/behaviors.md, Unknown Values).
    expect(rowsOf(screen)).toEqual([
      ["NVD", "5.0", "6.2", "CVSS:5.0/AV:N"],
      [
        "SUSE",
        "v3.1",
        "5.5 fictional_severity",
        "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
      ],
    ]);
    // The metrics of an unlisted version depend on it, so its vector shows
    // as text, without the popover of its metrics, which a listed version
    // opens.
    expect(
      cvssPart(screen).getByRole("button", { name: "CVSS:5.0/AV:N" }).query(),
    ).toBeNull();
    await expect
      .element(
        cvssPart(screen).getByRole("button", {
          name: "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
        }),
      )
      .toBeVisible();
  });

  test("show the vector in monospace, wrapping only after a slash where its column is narrower than it", async () => {
    await page.viewport(320, 800);
    showingCvss(fictionalCvssAssessments({ assessments: [NVD_V40] }));
    const { screen } = await renderCvss(NVD_V40.vector_string);
    const vector = cvssPart(screen)
      .getByText(NVD_V40.vector_string, { exact: true })
      .element();

    expect(getComputedStyle(vector).fontFamily).toContain("monospace");
    // The lines break between the metrics, and the text stays the vector,
    // which the user copies.
    const texts = linesOfText(vector);
    expect(texts.length).toBeGreaterThan(1);
    expect(texts.join("")).toBe(NVD_V40.vector_string);
    expect(texts.slice(0, -1).every((text) => text.endsWith("/"))).toBe(true);
    // The page does not scroll horizontally (docs/behaviors.md,
    // Accessibility, Reflow and text size).
    expect(document.documentElement.scrollWidth).toBe(layoutWidth());
  });

  test("wrap a provider longer than its column", async () => {
    await page.viewport(320, 800);
    const provider = "Fictional Coordinated Disclosure Team";
    showingCvss(
      fictionalCvssAssessments({
        assessments: [{ ...NVD_V40, provider_name: provider }],
      }),
    );
    const { screen } = await renderCvss(provider);

    expect(
      linesOfText(
        cvssPart(screen).getByText(provider, { exact: true }).element(),
      ),
    ).toEqual(["Fictional", "Coordinated", "Disclosure", "Team"]);
  });

  test("open the metrics of a v3.1 vector in a popover, which takes the focus, with the vector and a link to the calculator of FIRST", async () => {
    stubTicket();
    const { screen } = await renderCvss("SUSE");
    const vector = cvssPart(screen).getByRole("button", {
      name: NVD_V31_VECTOR,
      exact: true,
    });

    await vector.click();

    const metrics = screen.getByRole("dialog", { name: "NVD CVSS v3.1" });
    await expect.element(metrics).toHaveFocus();
    expect(metricsOf(metrics)).toEqual([
      "Exploitability",
      ["Attack vector", "Network"],
      ["Attack complexity", "High"],
      ["Privileges required", "None"],
      ["User interaction", "None"],
      ["Scope", "Unchanged"],
      "Impact",
      ["Confidentiality", "High"],
      ["Integrity", "High"],
      ["Availability", "High"],
    ]);
    // The vector, which the user can select and copy, in monospace.
    const shown = metrics.getByText(NVD_V31_VECTOR, { exact: true }).element();
    expect(getComputedStyle(shown).fontFamily).toContain("monospace");
    expect(getComputedStyle(shown).userSelect).not.toBe("none");
    // The calculator of FIRST reads the vector from the fragment as it is.
    expect(
      metrics
        .getByRole("link", {
          name: "Open in the FIRST calculator (another site)",
        })
        .element()
        .getAttribute("href"),
    ).toBe(`https://www.first.org/cvss/calculator/3.1#${NVD_V31_VECTOR}`);

    await userEvent.keyboard("{Escape}");

    await expect.element(metrics).not.toBeInTheDocument();
    await expect.element(vector).toHaveFocus();
  });

  test("open the metrics of a v4.0 vector in its groups, their terms in a column as wide as the longest one", async () => {
    showingCvss(fictionalCvssAssessments({ assessments: [NVD_V40] }));
    const { screen } = await renderCvss("NVD");

    await cvssPart(screen)
      .getByRole("button", { name: NVD_V40.vector_string, exact: true })
      .click();

    const metrics = screen.getByRole("dialog", { name: "NVD CVSS v4.0" });
    await expect.element(metrics).toBeVisible();
    expect(metricsOf(metrics)).toEqual([
      "Exploitability",
      ["Attack vector", "Network"],
      ["Attack complexity", "Low"],
      ["Attack requirements", "None"],
      ["Privileges required", "None"],
      ["User interaction", "None"],
      "Vulnerable system",
      ["Confidentiality", "High"],
      ["Integrity", "High"],
      ["Availability", "High"],
      "Subsequent system",
      ["Confidentiality", "None"],
      ["Integrity", "None"],
      ["Availability", "None"],
    ]);
    // No term wraps, and the values of every group start at the same place.
    const fields = metricFieldsOf(metrics);
    for (const [term] of fields) {
      expect(linesOfText(term)).toHaveLength(1);
    }
    expect(new Set(fields.map(([, value]) => boxOf(value).left)).size).toBe(1);
    // The vector wraps only after a slash, as in the table.
    const texts = linesOfText(
      metrics.getByText(NVD_V40.vector_string, { exact: true }).element(),
    );
    expect(texts.length).toBeGreaterThan(1);
    expect(texts.slice(0, -1).every((text) => text.endsWith("/"))).toBe(true);
    expect(
      metrics
        .getByRole("link", {
          name: "Open in the FIRST calculator (another site)",
        })
        .element()
        .getAttribute("href"),
    ).toBe(
      `https://www.first.org/cvss/calculator/4.0#${NVD_V40.vector_string}`,
    );
  });

  test("open the metrics of a v2.0 vector without a link, for which FIRST has no calculator, and show a value that the pinned contract does not list as received", async () => {
    showingCvss({
      ...fictionalCvssAssessments(),
      assessments: [
        {
          ...CNA_V20,
          metrics: { ...CNA_V20.metrics, access_vector: "fictional_vector" },
        },
      ],
    });
    const { screen } = await renderCvss("Fictional CNA");

    await cvssPart(screen)
      .getByRole("button", { name: CNA_V20.vector_string, exact: true })
      .click();

    const metrics = screen.getByRole("dialog", {
      name: "Fictional CNA CVSS v2.0",
    });
    await expect.element(metrics).toBeVisible();
    expect(metricsOf(metrics)).toEqual([
      "Exploitability",
      ["Access vector", "fictional_vector"],
      ["Access complexity", "Low"],
      ["Authentication", "None"],
      "Impact",
      ["Confidentiality", "Partial"],
      ["Integrity", "Partial"],
      ["Availability", "Partial"],
    ]);
    expect(metrics.getByRole("link").query()).toBeNull();
  });

  test("open the metrics of a v3.0 vector in the groups of v3.1, with a link to the calculator of FIRST for v3.0", async () => {
    const vector = "CVSS:3.0/AV:A/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N";
    showingCvss(
      fictionalCvssAssessments({
        assessments: [
          {
            ...fictionalAssessment(),
            provider_name: "Fictional CNA",
            cvss_version: "3.0",
            score: 5.4,
            severity: "medium",
            vector_string: vector,
            metrics: {
              attack_vector: "adjacent",
              attack_complexity: "low",
              privileges_required: "low",
              user_interaction: "required",
              scope: "changed",
              confidentiality_impact: "low",
              integrity_impact: "low",
              availability_impact: "none",
            },
          } satisfies CVSS30Assessment,
        ],
      }),
    );
    const { screen } = await renderCvss("Fictional CNA");

    await cvssPart(screen)
      .getByRole("button", { name: vector, exact: true })
      .click();

    const metrics = screen.getByRole("dialog", {
      name: "Fictional CNA CVSS v3.0",
    });
    await expect.element(metrics).toBeVisible();
    expect(metricsOf(metrics)).toEqual([
      "Exploitability",
      ["Attack vector", "Adjacent"],
      ["Attack complexity", "Low"],
      ["Privileges required", "Low"],
      ["User interaction", "Required"],
      ["Scope", "Changed"],
      "Impact",
      ["Confidentiality", "Low"],
      ["Integrity", "Low"],
      ["Availability", "None"],
    ]);
    expect(
      metrics
        .getByRole("link", {
          name: "Open in the FIRST calculator (another site)",
        })
        .element()
        .getAttribute("href"),
    ).toBe(`https://www.first.org/cvss/calculator/3.0#${vector}`);
  });

  test("show a metric value of several words in sentence case", async () => {
    showingCvss(
      fictionalCvssAssessments({
        assessments: [
          {
            ...CNA_V20,
            vector_string: "AV:A/AC:L/Au:N/C:P/I:P/A:P",
            metrics: { ...CNA_V20.metrics, access_vector: "adjacent_network" },
          },
        ],
      }),
    );
    const { screen } = await renderCvss("Fictional CNA");

    await cvssPart(screen)
      .getByRole("button", { name: "AV:A/AC:L/Au:N/C:P/I:P/A:P", exact: true })
      .click();

    const metrics = screen.getByRole("dialog", {
      name: "Fictional CNA CVSS v2.0",
    });
    await expect.element(metrics).toBeVisible();
    expect(metricsOf(metrics)[1]).toEqual([
      "Access vector",
      "Adjacent network",
    ]);
  });

  test("move the focus to the screen's heading when a new read leaves no table where it was", async () => {
    let assessments = fictionalCvssAssessments();
    stubTicket({ cvss: () => cvssResponse(assessments) });
    const { screen } = await renderCvss("SUSE");
    const table = cvssPart(screen).getByRole("grid", {
      name: "CVSS assessments",
    });
    await table.getByRole("rowheader", { name: "NVD" }).click();
    expect(table.element().contains(document.activeElement)).toBe(true);
    // Meanwhile the assessments of the CVE are gone.
    assessments = fictionalCvssAssessments({
      assessments: [],
      severity: null,
      eligibility: { score: 10, source: "fallback" },
    });

    await returnToForeground();

    await expect
      .element(cvssPart(screen).getByText("No CVSS assessments."))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-12", exact: true }),
      )
      .toHaveFocus();
  });

  test("say No CVSS assessments. without any", async () => {
    showingCvss(
      fictionalCvssAssessments({
        assessments: [],
        severity: null,
        eligibility: { score: 10, source: "fallback" },
      }),
    );
    const { screen } = await renderCvss("No CVSS assessments.");

    expect(cvssPart(screen).getByRole("grid").query()).toBeNull();
    expect(linesOf(screen)).toEqual([]);
  });

  test("are neither read nor shown for a Ticket without a CVE", async () => {
    const spy = showing([fictionalPackage()], { cve: null });
    const { screen } = await renderTree();

    await expect
      .element(screen.getByRole("region", { name: "CVE", exact: true }))
      .toBeVisible();
    expect(cvssPart(screen).query()).toBeNull();
    // No read of the CVSS assessments of any CVE.
    expect(
      spy.mock.calls
        .map(([input]) => urlOf(input).pathname)
        .filter((path) => /^\/api\/v1\/cves\/.*\/cvss$/.test(path)),
    ).toEqual([]);
  });

  test("show the loading indicator in their place until their read arrives", async () => {
    const response = later();
    stubTicket({ cvss: () => response.promise });
    const { screen } = await renderTree();

    await expect
      .element(cvssPart(screen).getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();

    response.resolve(cvssResponse());

    await expect
      .element(cvssPart(screen).getByRole("grid", { name: "CVSS assessments" }))
      .toBeVisible();
  });

  test("show the failure of their read in their place, with Try again where it offers it, and leave the rest of the screen usable", async () => {
    let fails = true;
    const spy = stubTicket({
      cvss: () =>
        fails ? errorResponse(503, "SERVICE_UNAVAILABLE") : cvssResponse(),
    });
    const { screen } = await renderTree();

    await expect
      .element(
        cvssPart(screen).getByText(
          "Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    // Sent again twice before the error shows (docs/behaviors.md, Retries
    // and Unconfirmed Changes).
    expect(requestsTo(spy, CVSS)).toBe(3);
    await expect
      .element(packagesPart(screen).getByText("No packages."))
      .toBeVisible();

    fails = false;
    await cvssPart(screen).getByRole("button", { name: "Try again" }).click();

    await expect
      .element(cvssPart(screen).getByRole("grid", { name: "CVSS assessments" }))
      .toBeVisible();
  });

  test("say that the CVE no longer exists after a 404, without Try again", async () => {
    stubTicket({ cvss: () => errorResponse(404, "CVE_NOT_FOUND") });
    const { screen } = await renderTree();

    await expect
      .element(
        cvssPart(screen).getByText(
          "This no longer exists, or you no longer have access to it.",
        ),
      )
      .toBeVisible();
    expect(
      cvssPart(screen).getByRole("button", { name: "Try again" }).query(),
    ).toBeNull();
  });

  test("are read again when the tab returns to the foreground, and stay shown with a warning when that read fails", async () => {
    let fails = false;
    const spy = stubTicket({
      cvss: () =>
        fails ? errorResponse(503, "SERVICE_UNAVAILABLE") : cvssResponse(),
    });
    const { screen } = await renderCvss("SUSE");
    fails = true;

    await returnToForeground();

    await expect
      .element(
        cvssPart(screen).getByText(
          "This couldn't be updated. Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    expect(requestsTo(spy, CVSS)).toBe(4);
    expect(rowsOf(screen)).toHaveLength(2);
  });
});
