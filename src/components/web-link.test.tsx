import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { RouterLinks } from "./router-links";
import { addressText, WebAddress, WebLink } from "./web-link";

// The links to addresses of the API and to addresses that the UI composes
// from its values (docs/behaviors.md, Links to Other Sites;
// docs/conventions.md, Links from the API).

afterEach(async () => {
  vi.restoreAllMocks();
  await page.viewport(414, 896);
});

describe("a web address", () => {
  test.each([
    ["https://github.com/advisories/GHSA-2c4f-7h9j-mqrv"],
    ["http://bugzilla.example.com/show_bug.cgi?id=1000012"],
    ["HTTPS://WWW.SUSE.COM/security/"],
  ])("is an absolute http or https URL: %s", (value) => {
    expect(WebAddress.of(value)?.url.href).toBe(new URL(value).href);
  });

  test.each([
    ["null", null],
    ["omitted", undefined],
    ["empty", ""],
    ["whitespace only", "   "],
    ["relative", "/tickets/SNTL-42"],
    ["a Package URL", "pkg:rpm/suse/fictional-openssl@3.0.8"],
    // A value that the check rejects, never a URL that the code follows.
    // oxlint-disable-next-line no-script-url
    ["a script", "javascript:alert(1)"],
    ["a file", "file:///etc/passwd"],
    ["of a desktop application", "ms-word:ofe|u|https://example.com/a.docx"],
    ["with a user name", "https://jdoe@example.com/"],
    ["with a password", "https://:secret@example.com/"],
  ])("is not a value that is %s", (_, value) => {
    expect(WebAddress.of(value)).toBeUndefined();
  });

  test("is the address as the browser parses it, its host in ASCII", () => {
    expect(WebAddress.of("https://süse.example.com/a b")?.url.href).toBe(
      "https://xn--sse-hoa.example.com/a%20b",
    );
  });
});

describe("the text of an address", () => {
  test("is a web address as the browser parses it, which a link to it leads to", () => {
    expect(addressText("HTTPS://Advisories.Example.com/a b")).toBe(
      "https://advisories.example.com/a%20b",
    );
  });

  test.each([
    ["a Package URL", "pkg:rpm/suse/fictional-openssl@3.0.8"],
    ["with a user name", "https://jdoe@example.com/"],
    ["relative", "/tickets/SNTL-42"],
  ])("is any other value as received: %s", (_, value) => {
    expect(addressText(value)).toBe(value);
  });
});

// Renders the link on a screen of a router, through which the links of the
// UI navigate.
async function renderLink(link: ReactNode) {
  const root = createRootRoute({
    component: () => (
      <RouterLinks>
        <Outlet />
      </RouterLinks>
    ),
  });
  const start = createRoute({
    getParentRoute: () => root,
    path: "/start",
    component: () => <p>{link}</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([start]),
    history: createMemoryHistory({ initialEntries: ["/start"] }),
  });
  const screen = await render(<RouterProvider router={router} />);
  return { router, screen };
}

// Whether the browser would load the link that the user clicks itself,
// because nothing prevented the default action of the click, which the test
// then prevents, so that the page stays. The listener is on the element in
// which React renders, after React's own, so that it runs after React's
// handlers, which stop the click from reaching further.
function browserLoads(container: HTMLElement): () => boolean {
  let loads = false;
  const listener = (event: MouseEvent) => {
    loads = !event.defaultPrevented;
    event.preventDefault();
  };
  container.addEventListener("click", listener);
  return () => {
    container.removeEventListener("click", listener);
    return loads;
  };
}

describe("a link to another site", () => {
  test("leads to the address as parsed, ends with its icon, and is named as leading to another site", async () => {
    const { screen } = await renderLink(
      <WebLink address="https://GitHub.com/advisories/GHSA-2c4f-7h9j-mqrv">
        GHSA-2c4f-7h9j-mqrv
      </WebLink>,
    );

    const link = screen.getByRole("link", {
      name: "GHSA-2c4f-7h9j-mqrv (another site)",
    });
    await expect
      .element(link)
      .toHaveAttribute(
        "href",
        "https://github.com/advisories/GHSA-2c4f-7h9j-mqrv",
      );
    const icon = link.element().querySelector("svg");
    expect(icon?.closest("[aria-hidden]")).not.toBeNull();
    expect(icon?.getBoundingClientRect().width).toBe(14);
    // link of the light theme.
    expect(getComputedStyle(link.element()).color).toBe("rgb(9, 105, 218)");
  });

  test("is loaded by the browser, not by the router", async () => {
    const { router, screen } = await renderLink(
      <WebLink address="https://www.suse.com/security/cve/CVE-2099-0012.html">
        SUSE CVE page
      </WebLink>,
    );
    const loaded = browserLoads(screen.container);

    await screen
      .getByRole("link", { name: "SUSE CVE page (another site)" })
      .click();

    expect(loaded()).toBe(true);
    expect(router.state.location.pathname).toBe("/start");
  });

  test("keeps its icon on the line of the last characters of its text when the text wraps", async () => {
    await page.viewport(320, 640);
    // As narrow as its longest word, the last one, so that the icon has no
    // room after that word unless it stays with it.
    const { screen } = await renderLink(
      <span className="block w-min text-14">
        <WebLink address="https://bugzilla.example.com/">
          Fictional bug report of a misconfiguration
        </WebLink>
      </span>,
    );

    const link = screen.getByRole("link", {
      name: "Fictional bug report of a misconfiguration (another site)",
    });
    await expect.element(link).toBeVisible();
    const rects = [...link.element().getClientRects()];
    const icon = link.element().querySelector("svg")?.getBoundingClientRect();
    const lastLine = rects.at(-1);
    const lineStart = rects[0]?.left ?? 0;
    expect(rects.length).toBeGreaterThan(1);
    // The icon is on the last line, with the last word, which precedes it
    // there: at the start of a line of its own, only its 4 px margin would.
    expect(icon?.top).toBeGreaterThanOrEqual(lastLine?.top ?? 0);
    expect(icon?.bottom).toBeLessThanOrEqual((lastLine?.bottom ?? 0) + 1);
    expect((icon?.left ?? 0) - lineStart).toBeGreaterThan(5);
  });
});

describe("the underline of a link", () => {
  test("shows under the pointer and on keyboard focus in a table or a list, and always in running text", async () => {
    const { screen } = await renderLink(
      <>
        <WebLink address="https://github.com/advisories/GHSA-2c4f-7h9j-mqrv">
          GHSA-2c4f-7h9j-mqrv
        </WebLink>{" "}
        <WebLink
          address="https://www.suse.com/security/cve/CVE-2099-0012.html"
          placement="text"
        >
          SUSE CVE page
        </WebLink>
      </>,
    );
    const listed = screen.getByRole("link", {
      name: "GHSA-2c4f-7h9j-mqrv (another site)",
    });
    const inText = screen.getByRole("link", {
      name: "SUSE CVE page (another site)",
    });
    const decoration = () =>
      getComputedStyle(listed.element()).textDecorationLine;

    await expect.element(listed).toBeVisible();
    expect(getComputedStyle(inText.element()).textDecorationLine).toBe(
      "underline",
    );
    await userEvent.unhover(listed);
    await expect.poll(decoration).toBe("none");
    await listed.hover();
    await expect.poll(decoration).toBe("underline");
    await userEvent.unhover(listed);
    await expect.poll(decoration).toBe("none");
    await userEvent.keyboard("{Tab}");
    await expect.element(listed).toHaveFocus();
    await expect.poll(decoration).toBe("underline");
  });
});

describe("a link on the UI's own origin", () => {
  test("has no mark, and the browser loads it as a new page, not the router", async () => {
    const load = vi
      .spyOn(WebAddress.prototype, "load")
      .mockImplementation(() => undefined);
    const address = `${window.location.origin}/tickets/SNTL-42`;
    const { router, screen } = await renderLink(
      <WebLink address={address}>SNTL-42</WebLink>,
    );

    const link = screen.getByRole("link", { name: "SNTL-42", exact: true });
    await expect.element(link).toHaveAttribute("href", address);
    expect(link.element().querySelector("svg")).toBeNull();
    await link.click();

    expect(load).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe("/start");
  });

  test("opens with the keyboard as a link", async () => {
    const load = vi
      .spyOn(WebAddress.prototype, "load")
      .mockImplementation(() => undefined);
    await renderLink(
      <WebLink address={`${window.location.origin}/tickets/SNTL-42`}>
        SNTL-42
      </WebLink>,
    );

    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{Enter}");

    expect(load).toHaveBeenCalledOnce();
  });
});

describe("a value that is not a web address", () => {
  test.each([
    ["a Package URL", "pkg:rpm/suse/fictional-openssl@3.0.8"],
    // A value that the check rejects, never a URL that the code follows.
    // oxlint-disable-next-line no-script-url
    ["a script", "javascript:alert(1)"],
    ["absent", null],
  ])(
    "shows the text of the link as received, without a link: %s",
    async (_, address) => {
      const { screen } = await renderLink(
        <WebLink address={address}>GHSA-2c4f-7h9j-mqrv</WebLink>,
      );

      await expect
        .element(screen.getByText("GHSA-2c4f-7h9j-mqrv"))
        .toBeVisible();
      expect(screen.getByRole("link").elements()).toHaveLength(0);
    },
  );
});
