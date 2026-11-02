// Runs in the document of every unit and component test file before its
// tests (vite.config.ts, setupFiles). Vitest runs each test file in an iframe
// of a browser page that runs several files one after another. In
// Playwright's Firefox, after an earlier file of the same page moved the
// focus by script, a single focus() of an element in that iframe can leave
// the focus where it was, so a test of the focus fails although the UI asked
// for it (microsoft/playwright#43506). Focusing the iframe's window first
// gives the document of the tests the focus that the UI's document has in
// the tab that the user works in. It focuses no element, so a test still
// fails when the UI does not move the focus.
window.focus();
