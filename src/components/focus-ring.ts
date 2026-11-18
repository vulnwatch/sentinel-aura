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

// The focus ring inside an item of a collection, such as an option, which
// shows also where the focus stays in a field and moves through the items
// virtually, as in a combobox, so that the item that Enter chooses shows: it
// follows the keyboard focus that React Aria marks on the item.
export const ITEM_FOCUS_RING =
  "outline-none data-focus-visible:outline-2 data-focus-visible:outline-solid data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus";
