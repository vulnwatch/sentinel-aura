import { focusManager } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import "../../styles.css";
import type { CVEDetail } from "../../api/generated/model";
import { formatDate, formatDateTime } from "../../components/date-time";
import {
  errorResponse,
  fictionalCve,
  fictionalTicketDetail,
  type stubApi,
  ticketResponse,
} from "../../test-api";
import {
  boxOf,
  client,
  CNA_NAME,
  CNAS,
  cnaResponse,
  colorOf,
  FG_MUTED,
  later,
  ORG_ID,
  prepareEachTest,
  region,
  renderTicket,
  requestsOf,
  type Screen,
  showingTicket,
  showingUnlistedTicket,
  stubTicket,
  textsOf,
} from "./test-support";

// The CVE of Overview, the first tab of the Ticket screen, and its CNA
// (src/routes/ticket-overview/cve.tsx; docs/screens/ticket.md), at the
// browser's default text size, in the light theme.

prepareEachTest();

// Renders the screen of a Ticket with the CVE, and the part of the CVE.
async function renderCve(fields: Partial<CVEDetail> = {}) {
  const cve = fictionalCve(fields);
  showingTicket(fictionalTicketDetail({ cve }));
  const { screen } = await renderTicket();
  return { screen, part: region(screen, cve.cve_id) };
}

describe("the CVE", () => {
  test("shows its CVE ID as the heading of the part, with a link to the CVE page of SUSE", async () => {
    const { part } = await renderCve();

    await expect
      .element(part.getByRole("heading", { level: 2, name: "CVE-2099-0012" }))
      .toBeVisible();
    await expect
      .element(part.getByRole("link", { name: "SUSE CVE page (another site)" }))
      .toHaveAttribute(
        "href",
        "https://www.suse.com/security/cve/CVE-2099-0012.html",
      );
  });

  test("encodes its CVE ID in the path of the CVE page of SUSE", async () => {
    const { part } = await renderCve({ cve_id: "CVE-2099-0012/x?y#z" });

    await expect
      .element(part.getByRole("link", { name: "SUSE CVE page (another site)" }))
      .toHaveAttribute(
        "href",
        "https://www.suse.com/security/cve/CVE-2099-0012%2Fx%3Fy%23z.html",
      );
  });

  test("shows its title, its description, its dates with their times, and its weaknesses", async () => {
    const { part } = await renderCve({
      cwes: [
        { cwe_id: "CWE-79", sources: ["nvd"] },
        { cwe_id: "CWE-787", sources: ["nvd"] },
      ],
    });

    await expect
      .element(part.getByText("Fictional flaw CVE-2099-0012"))
      .toBeVisible();
    await expect
      .element(part.getByText("A fictional description of CVE-2099-0012."))
      .toBeVisible();
    const facts = textsOf(part.getByRole("definition"));
    expect(facts.slice(0, 4)).toEqual([
      formatDateTime("2099-10-01T08:00:00Z"),
      formatDateTime("2099-10-08T08:00:00Z"),
      "–Not set",
      "CWE-79, CWE-787",
    ]);
    expect(textsOf(part.getByRole("term")).slice(0, 4)).toEqual([
      "Published",
      "Modified",
      "CNA",
      "CWE",
    ]);
    // Without external identifiers, the CVE has no such field.
    expect(textsOf(part.getByRole("term"))).not.toContain(
      "External identifiers",
    );
  });

  test("cuts a longer description to four lines with Show more", async () => {
    const description = Array.from(
      { length: 40 },
      (_, index) => `Fictional sentence ${index + 1} of a long description.`,
    ).join(" ");
    const { part } = await renderCve({ description });

    const more = part.getByRole("button", { name: "Show more" });
    await expect.element(more).toHaveAttribute("aria-expanded", "false");
    expect(boxOf(part.getByText(description)).height).toBe(4 * 24);
  });

  test("shows absent values, and no description, where Sentinel returns none", async () => {
    const { part } = await renderCve({
      title: null,
      description: null,
      published_date: null,
      modified_date: null,
    });

    await expect.element(part.getByText("No description.")).toBeVisible();
    expect(textsOf(part.getByRole("definition")).slice(0, 3)).toEqual([
      "–Not set",
      "–Not set",
      "–Not set",
    ]);
  });

  test("links its external identifiers to their advisories, and shows one without a web address as text", async () => {
    const { part } = await renderCve({
      external_identifiers: [
        {
          source: "ghsa",
          identifier: "GHSA-2c4f-7h9j-mqrv",
          url: "https://github.com/advisories/GHSA-2c4f-7h9j-mqrv",
        },
        { source: "pysec", identifier: "PYSEC-2099-12", url: "pkg:pypi/x" },
      ],
    });

    await expect
      .element(
        part.getByRole("link", { name: "GHSA-2c4f-7h9j-mqrv (another site)" }),
      )
      .toHaveAttribute(
        "href",
        "https://github.com/advisories/GHSA-2c4f-7h9j-mqrv",
      );
    await expect.element(part.getByText("PYSEC-2099-12")).toBeVisible();
    expect(part.getByRole("link", { name: /PYSEC/ }).elements()).toHaveLength(
      0,
    );
  });

  test("marks a rejected CVE with the date and time of its rejection", async () => {
    const { screen } = await renderCve({
      cve_state: "rejected",
      date_rejected: "2099-10-07T09:00:00Z",
    });
    const part = region(screen, "CVE-2099-0012 Rejected");

    await expect
      .element(
        screen.getByRole("heading", {
          level: 2,
          name: "CVE-2099-0012 Rejected",
        }),
      )
      .toBeVisible();
    const terms = textsOf(part.getByRole("term"));
    const definitions = textsOf(part.getByRole("definition"));
    expect(definitions[terms.indexOf("Rejected")]).toBe(
      formatDateTime("2099-10-07T09:00:00Z"),
    );
  });

  test("shows a state of the CVE that the pinned contract does not list as received", async () => {
    showingUnlistedTicket({
      ...fictionalTicketDetail(),
      cve: { ...fictionalCve(), cve_state: "fictional_state" },
    });
    const { screen } = await renderTicket();

    await expect
      .element(
        screen.getByRole("heading", {
          level: 2,
          name: "CVE-2099-0012 fictional_state",
        }),
      )
      .toBeVisible();
  });

  test("shows its exploitation: not listed in CISA KEV, the SSVC decision points, and no EPSS score", async () => {
    const { part } = await renderCve();

    const terms = textsOf(part.getByRole("term"));
    const definitions = textsOf(part.getByRole("definition"));
    const valueOfTerm = (term: string) => definitions[terms.indexOf(term)];
    expect(valueOfTerm("CISA KEV")).toBe("Not listed");
    expect(valueOfTerm("Exploitation")).toBe("PoC");
    expect(valueOfTerm("Automatable")).toBe("No");
    expect(valueOfTerm("Technical impact")).toBe("Partial");
    expect(valueOfTerm("Version")).toBe("2.0.3");
    expect(valueOfTerm("Assessed")).toBe(
      formatDateTime("2099-10-06T10:15:00Z"),
    );
    expect(valueOfTerm("EPSS")).toBe("–Not set");
  });

  test("shows the date of its CISA KEV entry, its EPSS score cut to five decimals, with at least two, and its percentile cut to two", async () => {
    const { part } = await renderCve({
      kev: { date_added: "2099-10-05", reference_url: null },
      ssvc: null,
      epss: {
        score: 0.000436,
        percentile: 0.30987,
        assessed_at: "2099-10-08",
      },
    });

    const terms = textsOf(part.getByRole("term"));
    const definitions = textsOf(part.getByRole("definition"));
    const valueOfTerm = (term: string) => definitions[terms.indexOf(term)];
    expect(valueOfTerm("Added")).toBe(formatDate("2099-10-05"));
    expect(valueOfTerm("SSVC")).toBe("–Not set");
    expect(valueOfTerm("Score")).toBe("0.00043");
    expect(valueOfTerm("Percentile")).toBe("0.30");
    expect(definitions.at(-1)).toBe(formatDate("2099-10-08"));
  });

  test("shows SSVC values that the pinned contract does not list as received", async () => {
    showingUnlistedTicket({
      ...fictionalTicketDetail(),
      cve: {
        ...fictionalCve(),
        ssvc: {
          exploitation: "fictional_exploitation",
          automatable: "fictional_automatable",
          technical_impact: "fictional_impact",
          version: "3.0.0",
          assessed_at: null,
        },
      },
    });
    const { screen } = await renderTicket();
    const part = region(screen, "CVE-2099-0012");

    await expect
      .element(part.getByText("fictional_exploitation"))
      .toBeVisible();
    await expect.element(part.getByText("fictional_automatable")).toBeVisible();
    await expect.element(part.getByText("fictional_impact")).toBeVisible();
  });

  test("shows its exploitation in three columns, one below the other in a narrow window", async () => {
    const { part } = await renderCve();
    const kev = () => boxOf(part.getByText("CISA KEV", { exact: true }));
    const ssvc = () => boxOf(part.getByText("SSVC", { exact: true }));
    expect(ssvc().top).toBe(kev().top);

    await page.viewport(320, 640);

    await expect.poll(() => ssvc().top).toBeGreaterThan(kev().bottom);
  });

  test("shows No CVE. for a Ticket without a CVE", async () => {
    showingTicket(fictionalTicketDetail({ cve: null }));
    const { screen } = await renderTicket();

    const part = region(screen, "CVE");
    await expect.element(part.getByText("No CVE.")).toBeVisible();
  });
});

// Renders the screen of a Ticket whose CVE has the CNA of the tests, with
// the name that its summary gives, and Get CNA as the test sets it.
async function renderCna(
  cna: (path: string) => Response | Promise<Response> = () => cnaResponse(),
  name: string | null = CNA_NAME,
) {
  const spy = stubTicket({
    ticket: () =>
      ticketResponse(
        fictionalTicketDetail({
          cve: fictionalCve({ cna: { org_id: ORG_ID, name } }),
        }),
      ),
    cna,
  });
  const { screen } = await renderTicket();
  return { spy, screen, part: region(screen, "CVE-2099-0012") };
}

// The reads of Get CNA that the screen sent.
function cnaReads(spy: ReturnType<typeof stubApi>): string[] {
  return requestsOf(spy).filter((path) => path.startsWith(CNAS));
}

// Opens the popover of the CNA, which takes the focus.
async function openCna(screen: Screen, name = CNA_NAME) {
  await screen.getByRole("button", { name, exact: true }).click();
  const popover = screen.getByRole("dialog", { name });
  await expect.element(popover).toHaveFocus();
  return popover;
}

// The value of a field of the popover of the CNA, by its term.
function cnaValue(popover: Locator, term: string): HTMLElement {
  const terms = popover.getByRole("term").elements();
  const index = terms.findIndex((candidate) => candidate.textContent === term);
  const value = popover.getByRole("definition").elements()[index];
  if (index === -1 || !(value instanceof HTMLElement)) {
    throw new Error(`The popover of the CNA has no field ${term}`);
  }
  return value;
}

describe("the CNA of the CVE", () => {
  test("shows the CNA by its name, after the dates and before the weaknesses, without reading its details", async () => {
    const { spy, part } = await renderCna();

    const terms = textsOf(part.getByRole("term"));
    expect(terms.slice(0, 4)).toEqual(["Published", "Modified", "CNA", "CWE"]);
    await expect
      .element(part.getByRole("button", { name: CNA_NAME, exact: true }))
      .toBeVisible();
    expect(cnaReads(spy)).toEqual([]);
  });

  test("opens its details from Get CNA: the short name below the title, the types as a list of labels, the auto-ignore policy, and the scope last, as text", async () => {
    const { spy, screen } = await renderCna(() =>
      cnaResponse({ types: ["Open Source", "Fictional type"] }),
    );

    const popover = await openCna(screen);

    await expect
      .element(popover.getByText("fictional-plugins", { exact: true }))
      .toBeVisible();
    expect(cnaReads(spy)).toEqual([`${CNAS}${ORG_ID}`]);
    expect(textsOf(popover.getByRole("term"))).toEqual([
      "Types",
      "Auto-ignore",
      "Scope",
    ]);
    // Each type a label of its own, as received, also one that the examples
    // of the contract do not name.
    expect(
      textsOf(
        page.elementLocator(cnaValue(popover, "Types")).getByRole("listitem"),
      ),
    ).toEqual(["Open Source", "Fictional type"]);
    expect(cnaValue(popover, "Auto-ignore").textContent).toBe(
      "Yes, new Tickets are ignored automatically",
    );
    // The scope keeps its line feed, and its address stays text.
    const scope = cnaValue(popover, "Scope");
    expect(scope.innerText).toContain(
      "Plugins of the fictional plugin directory.\nPlugin list: https://plugins.example.com",
    );
    expect(popover.getByRole("link").elements()).toHaveLength(0);
    // Below its term, across the width of the list.
    const scopeTerm = popover.getByRole("term").last().element();
    expect(boxOf(page.elementLocator(scope)).top).toBeGreaterThanOrEqual(
      boxOf(page.elementLocator(scopeTerm)).bottom,
    );
    expect(boxOf(page.elementLocator(scope)).left).toBe(
      boxOf(page.elementLocator(scopeTerm)).left,
    );

    await userEvent.keyboard("{Escape}");

    await expect
      .element(screen.getByRole("button", { name: CNA_NAME, exact: true }))
      .toHaveFocus();
  });

  test("says No for a CNA whose new Tickets are not ignored, and shows absent values without a short name for a CNA that the CNA list has not described yet", async () => {
    const { screen } = await renderCna(
      () =>
        cnaResponse({
          name: "fictional-plugins",
          organization_name: null,
          types: [],
          scope: null,
          auto_ignore: false,
        }),
      "fictional-plugins",
    );

    const popover = await openCna(screen, "fictional-plugins");

    await expect
      .element(popover.getByRole("term").first())
      .toHaveTextContent("Types");
    expect(cnaValue(popover, "Types").textContent).toBe("–Not set");
    expect(cnaValue(popover, "Auto-ignore").textContent).toBe("No");
    expect(cnaValue(popover, "Scope").textContent).toBe("–Not set");
    // The short name is the title, which shows it once.
    expect(
      popover.getByText("fictional-plugins", { exact: true }).elements(),
    ).toHaveLength(1);
  });

  test("cuts a long scope to its first four lines with Show more", async () => {
    const scope = Array.from(
      { length: 20 },
      (_, index) => `Fictional product line ${index + 1} of the foundation.`,
    ).join(" ");
    const { screen } = await renderCna(() => cnaResponse({ scope }));

    const popover = await openCna(screen);

    const more = popover.getByRole("button", { name: "Show more" });
    await expect.element(more).toHaveAttribute("aria-expanded", "false");
    expect(boxOf(popover.getByText(scope)).height).toBe(4 * 20);

    await more.click();

    await expect
      .element(popover.getByRole("button", { name: "Show less" }))
      .toHaveAttribute("aria-expanded", "true");
    expect(boxOf(popover.getByText(scope)).height).toBeGreaterThan(4 * 20);
  });

  test("shows the loading indicator in place of the details until Get CNA arrives, with the short name", async () => {
    const response = later();
    const { screen } = await renderCna(() => response.promise);

    const popover = await openCna(screen);

    await expect.element(popover.getByRole("progressbar")).toBeVisible();
    expect(popover.getByRole("term").elements()).toHaveLength(0);
    expect(popover.getByText("fictional-plugins").elements()).toHaveLength(0);

    response.resolve(cnaResponse());

    await expect
      .element(popover.getByText("fictional-plugins", { exact: true }))
      .toBeVisible();
    expect(popover.getByRole("progressbar").elements()).toHaveLength(0);
    expect(textsOf(popover.getByRole("term"))).toHaveLength(3);
  });

  test("says that other details aren't available when Get CNA fails, and announces it", async () => {
    const { spy, screen } = await renderCna(() =>
      errorResponse(500, "INTERNAL_ERROR"),
    );

    const popover = await openCna(screen);

    await expect
      .element(popover.getByRole("status"))
      .toHaveTextContent("Other details aren't available.");
    expect(
      colorOf(popover.getByText("Other details aren't available.").element()),
    ).toBe(FG_MUTED);
    expect(popover.getByRole("term").elements()).toHaveLength(0);
    // Sent again twice after a 5xx, as every read (docs/behaviors.md,
    // Retries and Unconfirmed Changes).
    expect(cnaReads(spy)).toHaveLength(3);
  });

  test("reads the details again each time the popover opens, without showing those of the earlier opening meanwhile", async () => {
    const second = later();
    let reads = 0;
    const { spy, screen } = await renderCna(() => {
      reads += 1;
      return reads === 1
        ? cnaResponse({ scope: "Fictional scope as first read." })
        : second.promise;
    });
    let popover = await openCna(screen);
    await expect
      .element(popover.getByText("Fictional scope as first read."))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(popover).not.toBeInTheDocument();

    popover = await openCna(screen);

    await expect.element(popover.getByRole("progressbar")).toBeVisible();
    expect(
      popover.getByText("Fictional scope as first read.").elements(),
    ).toHaveLength(0);
    expect(cnaReads(spy)).toHaveLength(2);

    second.resolve(cnaResponse({ scope: "Fictional scope as read again." }));

    await expect
      .element(popover.getByText("Fictional scope as read again."))
      .toBeVisible();
  });

  test("does not read the details again while the popover is open, also when the tab returns to the foreground", async () => {
    const { spy, screen } = await renderCna();
    const popover = await openCna(screen);
    await expect
      .element(popover.getByText("fictional-plugins", { exact: true }))
      .toBeVisible();

    // Once no read is in progress, which the return would join rather than
    // read again.
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    focusManager.setFocused(false);
    focusManager.setFocused(true);

    // The Ticket is read again, which shows that the return took effect.
    await expect
      .poll(
        () =>
          requestsOf(spy).filter((path) => path === "/api/v1/tickets/SNTL-12")
            .length,
      )
      .toBe(2);
    expect(cnaReads(spy)).toHaveLength(1);
  });

  test("reads the details again after a failure when the popover opens again", async () => {
    let fail = true;
    const { screen } = await renderCna(() =>
      fail ? errorResponse(404, "CNA_NOT_FOUND") : cnaResponse(),
    );
    let popover = await openCna(screen);
    await expect
      .element(popover.getByRole("status"))
      .toHaveTextContent("Other details aren't available.");
    await userEvent.keyboard("{Escape}");
    await expect.element(popover).not.toBeInTheDocument();

    fail = false;
    popover = await openCna(screen);

    await expect
      .element(popover.getByText("fictional-plugins", { exact: true }))
      .toBeVisible();
    expect(popover.getByRole("status").element().textContent).toBe("");
  });

  test("shows Unnamed CNA without a popover for a CNA without a name", async () => {
    const { spy, part } = await renderCna(() => cnaResponse(), null);

    const terms = textsOf(part.getByRole("term"));
    const definitions = textsOf(part.getByRole("definition"));
    expect(definitions[terms.indexOf("CNA")]).toBe("Unnamed CNA");
    expect(part.getByRole("button", { name: /CNA/ }).elements()).toHaveLength(
      0,
    );
    expect(cnaReads(spy)).toEqual([]);
  });

  test("shows no identifier of a CNA", async () => {
    const { screen } = await renderCna();

    await openCna(screen);
    await expect
      .element(page.getByText("fictional-plugins", { exact: true }))
      .toBeVisible();

    expect(document.body.textContent).not.toContain(ORG_ID);
    expect(
      Array.from(document.querySelectorAll("[href]")).map((element) =>
        element.getAttribute("href"),
      ),
    ).not.toContainEqual(expect.stringContaining(ORG_ID));
  });
});
