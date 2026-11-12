// The Trusted Types policy `default` (docs/architecture.md, Security
// Headers). The Content Security Policy of the image requires Trusted Types
// for every sink of HTML, script, and script URL, and allows this policy
// alone. React Aria empties the region of its announcements by assigning an
// empty string to innerHTML, which the policy turns into HTML; it refuses
// every other string, and creates no script and no script URL, so those stay
// blocked. main.tsx imports this module before the modules that render.

// The part of the Trusted Types API that the module uses, which the DOM
// types of TypeScript lack.
interface TrustedTypePolicyFactory {
  readonly defaultPolicy: object | null;
  createPolicy(
    name: string,
    rules: { createHTML: (input: string) => string | null },
  ): object;
}

declare global {
  interface Window {
    readonly trustedTypes?: TrustedTypePolicyFactory;
  }
}

// The HTML that the policy creates from a string: the empty string alone,
// which holds no markup, or null, which refuses the string.
export function emptyHtmlOnly(input: string): string | null {
  return input === "" ? "" : null;
}

// Creates the policy in a window, the page's by default, unless its browser
// has no Trusted Types, such as the Firefox Extended Support Release, which
// then requires none, or the policy exists already.
export function createDefaultPolicy(
  target: Pick<Window, "trustedTypes"> = window,
): void {
  const factory = target.trustedTypes;
  if (factory === undefined || factory.defaultPolicy !== null) {
    return;
  }
  factory.createPolicy("default", { createHTML: emptyHtmlOnly });
}

createDefaultPolicy();
