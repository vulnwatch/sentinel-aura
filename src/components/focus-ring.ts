// The focus ring of docs/design-system.md (Focus and Motion): a 2 px line in
// focus, 2 px outside the element and following its radius, shown on
// keyboard focus.
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

// The focus ring inside the element, for an element that fills its place,
// such as a menu item, the main content, or the sidebar opened over the
// content, whose edges would cut the ring outside it.
export const INSIDE_FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-focus";
