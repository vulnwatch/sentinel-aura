// The UI runs in the browser, so its program has no types of Node.js
// (docs/conventions.md, Checks), and the type check rejects the globals of
// Node.js below. Should a dependency bring those types into the program, the
// directives would find no error, and the type check would fail. The module
// declares types only, which are exported so that no other error can satisfy
// a directive; nothing imports it, so it never reaches the build.

// @ts-expect-error -- `process` is a global of Node.js, not of the browser.
export type NodeProcess = typeof process;
// @ts-expect-error -- `Buffer` is a global of Node.js, not of the browser.
export type NodeBuffer = typeof Buffer;
