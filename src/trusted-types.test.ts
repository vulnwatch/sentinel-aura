import { afterEach, expect, test } from "vitest";
import { createDefaultPolicy, emptyHtmlOnly } from "./trusted-types";

// The Trusted Types policy default (docs/architecture.md, Security Headers),
// in a document of its own under the directives of Trusted Types of the
// image's Content Security Policy.

const POLICY = "require-trusted-types-for 'script'; trusted-types default";

let frame: HTMLIFrameElement | undefined;

afterEach(() => {
  frame?.remove();
  frame = undefined;
});

// A window whose document enforces Trusted Types, as the image's policy
// does.
async function enforcingWindow(): Promise<Window> {
  const element = document.createElement("iframe");
  frame = element;
  const loaded = new Promise((resolve) => {
    element.addEventListener("load", resolve, { once: true });
  });
  // The frame's document before Trusted Types apply to it: its content is
  // set as an attribute of this document, which enforces nothing.
  element.srcdoc = `<meta http-equiv="Content-Security-Policy" content="${POLICY}"><div></div>`;
  document.body.append(element);
  await loaded;
  const target = element.contentWindow;
  if (target === null) {
    throw new Error("No window of the frame");
  }
  return target;
}

// What an assignment does in the window: "assigned", or the name of the
// error that blocks it, an error of the frame's realm.
function outcome(assign: () => void): string {
  try {
    assign();
    return "assigned";
  } catch (error) {
    return typeof error === "object" && error !== null && "name" in error
      ? String(error.name)
      : String(error);
  }
}

test("turns the empty string alone into HTML", () => {
  expect(emptyHtmlOnly("")).toBe("");
  expect(emptyHtmlOnly(" ")).toBeNull();
  expect(emptyHtmlOnly("<b>Fictional</b>")).toBeNull();
  expect(emptyHtmlOnly("Fictional text")).toBeNull();
});

test("creates the policy default in the page as the module loads", () => {
  expect(window.trustedTypes?.defaultPolicy).not.toBeNull();
  expect(window.trustedTypes?.defaultPolicy).toBeDefined();
});

test("lets an element be emptied under Trusted Types, and blocks every other HTML, script, and script URL", async () => {
  const target = await enforcingWindow();
  const element = target.document.querySelector("div");
  if (element === null) {
    throw new Error("No element in the frame");
  }
  element.textContent = "Fictional announcement";

  // Without the policy, even the empty string is blocked.
  expect(
    outcome(() => {
      element.innerHTML = "";
    }),
  ).toBe("TypeError");

  createDefaultPolicy(target);

  expect(
    outcome(() => {
      element.innerHTML = "";
    }),
  ).toBe("assigned");
  expect(element.childNodes).toHaveLength(0);
  expect(
    outcome(() => {
      element.innerHTML = "<b>Fictional</b>";
    }),
  ).toBe("TypeError");
  expect(element.childNodes).toHaveLength(0);
  // The text and the address of a script are refused.
  expect(
    outcome(() => {
      target.document.createElement("script").textContent = "void 0";
    }),
  ).toBe("TypeError");
  expect(
    outcome(() => {
      target.document.createElement("script").src = "/fictional.js";
    }),
  ).toBe("TypeError");
});

test("creates the policy once", async () => {
  const target = await enforcingWindow();
  createDefaultPolicy(target);
  const policy = target.trustedTypes?.defaultPolicy;

  createDefaultPolicy(target);

  expect(target.trustedTypes?.defaultPolicy).toBe(policy);
});

test("creates nothing in a browser without Trusted Types", () => {
  const target = { trustedTypes: undefined };

  expect(() => {
    createDefaultPolicy(target);
  }).not.toThrow();
});
