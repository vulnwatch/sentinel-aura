# Design System

This document defines the visual language of Sentinel Aura and the interface
patterns that its screens share: the themes and colors, contrast, type,
spacing and sizes, icons, focus and motion, the page layout, the presentation
of values, the reusable patterns, the representation of a user, and the
avatar. It is a foundation document (`docs/conventions.md`, Foundation
Documents): every screen follows it, and a screen that needs a color, a size,
or a pattern that it does not define changes this document first. It owns the
look of the UI and the look and interaction of its reusable patterns, such as
when a filter of a list applies; `docs/behaviors.md` owns the shared
behaviors that `docs/conventions.md` (Foundation Documents) lists for it,
such as when an error appears and what its message says. The areas, screens,
and navigation belong to `docs/screen-map.md`, and the technology stack, React
Aria Components styled with Tailwind CSS, and the Content Security Policy to
`docs/architecture.md` (Components and Styling; Security Headers). Backend
behavior, the API contract, and the obligations that the contract places on
clients belong to Sentinel (`README.md`, Specification Boundary).

Every rule taken from Sentinel is summarized next to the Sentinel section that
states it, and that section remains authoritative (`docs/conventions.md`,
Sentinel Cross-references). Sizes are in CSS pixels at the browser's default
text size of 16 px; the UI states them relative to the text size, so that a
larger text size of the browser enlarges them too. The breakpoint of the
sidebar is the one exception (Spacing and Sizes).

## Contents

- [Principles](#principles)
- [Themes and Colors](#themes-and-colors)
  - [Themes](#themes)
  - [Color Tokens](#color-tokens)
  - [Tones](#tones)
  - [Severity Marks](#severity-marks)
- [Contrast](#contrast)
  - [Requirements](#requirements)
  - [Exempt Elements](#exempt-elements)
  - [Contrast Table](#contrast-table)
- [Type](#type)
  - [Font](#font)
  - [Type Scale](#type-scale)
- [Spacing and Sizes](#spacing-and-sizes)
- [Icons](#icons)
  - [Icon Set](#icon-set)
  - [Icons by Need](#icons-by-need)
- [Focus and Motion](#focus-and-motion)
- [Page Layout](#page-layout)
  - [Sidebar](#sidebar)
  - [Account Menu](#account-menu)
  - [Main Content](#main-content)
  - [Sign In Page](#sign-in-page)
- [Values](#values)
  - [Severity](#severity)
  - [Priority](#priority)
  - [Ticket Status](#ticket-status)
  - [Deadline Badge](#deadline-badge)
  - [Confidential Tickets](#confidential-tickets)
  - [Other Values](#other-values)
- [Interface Patterns](#interface-patterns)
  - [Buttons and Links](#buttons-and-links)
  - [Lists](#lists)
  - [Tables](#tables)
  - [Detail Screens](#detail-screens)
  - [Forms](#forms)
  - [Dialogs](#dialogs)
  - [Messages](#messages)
  - [Loading](#loading)
  - [Empty States](#empty-states)
  - [Errors in Place of Content](#errors-in-place-of-content)
  - [Menus, Popovers, and Tooltips](#menus-popovers-and-tooltips)
- [Representation of a User](#representation-of-a-user)
- [Avatar](#avatar)
  - [Definition, Version 1](#definition-version-1)
  - [Palette](#palette)
  - [Versions](#versions)
  - [Test Vectors](#test-vectors)
- [Open Decisions](#open-decisions)

## Principles

- **One accent.** Blue marks what the user can act on and where the user is:
  primary actions, links, the current navigation entry, and the focus.
- **Red means now.** Red is reserved for what needs attention at once: an
  effective priority of P1, a deadline that has passed, an error, and the
  button that confirms a destructive action (Buttons and Links). Severity
  shows as a small mark beside its name, not as a red fill, so that red keeps
  that meaning.
- **Never color alone.** A text, an icon, or a shape always carries the same
  information as a color (`docs/behaviors.md`, Accessibility).
- **Quiet surfaces.** Lines separate the content, and only what floats above
  the page, such as a menu or a dialog, has a shadow.
- **One density.** Text of 15 px and table rows of 36 px, the same for every
  user: dense enough for the analysts' queues, open enough for occasional
  readers.
- **Tokens only.** A screen uses only the colors, type sizes, sizes, and
  patterns of this document. Its colors and type sizes are the tokens of
  Tailwind CSS, which replace Tailwind's default ones: a token is a utility
  class, such as `bg-surface`, `text-fg-muted`, or `text-14`, and code uses
  no other color or type size (`docs/conventions.md`, Components and
  Styling): a value that this document lacks is added to it first. The
  avatar's colors are tokens too (Palette).

## Themes and Colors

### Themes

- The UI has a light and a dark theme. `docs/behaviors.md` (Preferences)
  defines which one shows.
- Each color token has one value per theme, and the theme applies to the
  whole page. Screens use the tokens and never a value or a style for one
  theme only, so that every screen is correct in both themes as built.
- The theme also sets the page's CSS `color-scheme`, so that the parts that
  the browser draws itself, such as scrollbars and the pickers of fields,
  follow it.
- The avatar has its own colors, the same in both themes (Avatar).

### Color Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#F6F8FA` | `#0D1117` | The page behind the content; the search field of the sidebar |
| `surface` | `#FFFFFF` | `#151B23` | Cards, the frame of a table, menus, popovers, dialogs, and fields |
| `surface-2` | `#F6F8FA` | `#1A212A` | The header row of a table |
| `surface-hover` | `#F3F5F8` | `#1E2630` | A row, a menu item, or a quiet control under the pointer |
| `sidebar` | `#FFFFFF` | `#010409` | The sidebar |
| `sidebar-active` | `#EAEEF2` | `#1E2630` | The current entry of the sidebar, and an entry under the pointer |
| `fg` | `#1F2328` | `#E6EDF3` | Text |
| `fg-muted` | `#59636E` | `#9198A1` | Secondary text and icons: terms of a description list, column headers, counts, captions, placeholders, and the icons beside a text |
| `border` | `#D8DEE4` | `#2F3742` | Lines that separate: between rows, around cards and tables, in menus, and at the edge of the sidebar |
| `border-strong` | `#818B98` | `#6E7681` | Boundaries that identify a control: fields, secondary buttons, checkboxes, and the selected view |
| `accent` | `#0969DA` | `#1F6FEB` | The fill of a primary button and of a selected checkbox or radio button |
| `accent-hover` | `#0757BA` | `#1A5FCC` | A primary button under the pointer |
| `on-accent` | `#FFFFFF` | `#FFFFFF` | Text and marks on `accent` |
| `link` | `#0969DA` | `#4493F8` | Links, and the icon and marker of the current navigation entry |
| `focus` | `#0969DA` | `#4493F8` | The focus ring |
| `danger-solid` | `#CF222E` | `#DA3633` | The fill of a danger button and of the P1 mark |
| `danger-solid-hover` | `#A40E26` | `#B62324` | A danger button under the pointer |
| `on-danger-solid` | `#FFFFFF` | `#FFFFFF` | Text and marks on `danger-solid` |
| `overlay` | `rgb(15 23 42 / 0.45)` | `rgb(1 4 9 / 0.7)` | The layer behind a dialog and behind the sidebar opened over the content |

### Tones

Five tones present a state. Each has a soft background, the color of text and
icons on it, and the color of an icon or mark on `surface` or `canvas`:
`{tone}-soft`, `{tone}-on-soft`, and `{tone}-icon`.

| Tone | Meaning | Soft, light / dark | On soft, light / dark | Icon, light / dark |
|---|---|---|---|---|
| `neutral` | No state, or a state that needs nothing | `#EFF2F5` / `#262C36` | `#3B434B` / `#C9D1D9` | `#6E7781` / `#9198A1` |
| `info` | In progress or active, or information | `#DDF4FF` / `#0D2A52` | `#0A3069` / `#A5D6FF` | `#0969DA` / `#4493F8` |
| `success` | Completed, or time remains | `#DAFBE1` / `#0E3320` | `#0F5323` / `#7EE2A8` | `#1A7F37` / `#3FB950` |
| `warning` | Needs attention soon, or not confirmed | `#FFF8C5` / `#3A2D00` | `#6C4400` / `#F2CC60` | `#9A6700` / `#D29922` |
| `danger` | Failed, overdue, or an error | `#FFEBE9` / `#4A111A` | `#A40E26` / `#FFA198` | `#CF222E` / `#F85149` |

`danger-on-soft` is also the color of the text of a field error and of an
attention count above zero, on `surface` or `canvas`.

### Severity Marks

The mark of a severity (Severity) has one color in both themes, saturated so
that the levels differ at a glance. The marks are decorative, because the name
of the severity always follows them (Exempt Elements).

| Token | Color | Severity |
|---|---|---|
| `mark-critical` | `#E5252A` | Critical |
| `mark-high` | `#F76B15` | High |
| `mark-medium` | `#F5C400` | Medium |
| `mark-low` | `#3B82F6` | Low |
| `mark-none` | `#8B949E` | None |

## Contrast

### Requirements

- Every text has a contrast of at least 4.5:1 against its background, in
  both themes (WCAG 2.2, 1.4.3 Contrast (Minimum)). The design system uses no
  lower minimum for large text.
- Every graphical element needed to understand the content or to identify a
  control and its state has a contrast of at least 3:1 against the colors
  next to it, in both themes (1.4.11 Non-text Contrast): the boundaries of
  fields and secondary buttons, the focus ring, the fill of a primary or
  danger button, the boundary of the selected view, an icon that carries a
  meaning without a text, the P1 mark, a field's error boundary, and the
  progress bar of data that is being updated.
- The icons of a Ticket status and of a message accompany a text that carries
  the same meaning, and meet 3:1 nonetheless.
- The ratios follow WCAG's definition of contrast ratio and relative
  luminance, truncated to two decimals so that a listed ratio never overstates
  the real one.
- A new token, a changed token, or a new pair of tokens that a pattern uses
  for text or for a needed graphical element adds or updates its row in the
  Contrast Table, and meets its minimum in both themes.

### Exempt Elements

These elements are decorative, or repeat what a text next to them states, so
WCAG sets them no minimum:

- the lines of `border`, wherever a pattern draws them, such as between rows,
  around cards, tabs, menus, and dialogs, and at the edge of the sidebar;
- the severity marks, which the name of the severity follows;
- the empty bars of a priority mark, whose label follows them;
- the backgrounds that tell surfaces and states apart: `canvas`, `surface`,
  `surface-2`, `surface-hover`, `sidebar-active`, and the soft backgrounds of
  the tones, whose text carries their meaning;
- the background of the selected view, whose `border-strong` boundary and
  weight carry the selection;
- the background of the avatar against the page, because the avatar
  accompanies the user's name or is named by it (Representation of a User);
- disabled controls (1.4.3 and 1.4.11 exempt inactive components); and
- `overlay`.

### Contrast Table

Text, minimum 4.5:1:

| Foreground | Background | Light | Dark |
|---|---|---|---|
| `fg` | `canvas` | 14.83 | 16.01 |
| `fg` | `surface` | 15.79 | 14.65 |
| `fg` | `surface-2` | 14.83 | 13.72 |
| `fg` | `surface-hover` | 14.46 | 12.92 |
| `fg` | `sidebar` | 15.79 | 17.37 |
| `fg` | `sidebar-active` | 13.54 | 12.92 |
| `fg` | `neutral-soft` | 14.05 | 11.88 |
| `fg-muted` | `canvas` | 5.74 | 6.49 |
| `fg-muted` | `surface` | 6.11 | 5.94 |
| `fg-muted` | `surface-2` | 5.74 | 5.56 |
| `fg-muted` | `surface-hover` | 5.59 | 5.24 |
| `fg-muted` | `sidebar` | 6.11 | 7.05 |
| `fg-muted` | `sidebar-active` | 5.24 | 5.24 |
| `fg-muted` | `neutral-soft` | 5.44 | 4.81 |
| `link` | `canvas` | 4.87 | 6.10 |
| `link` | `surface` | 5.19 | 5.58 |
| `link` | `surface-hover` | 4.75 | 4.92 |
| `on-accent` | `accent` | 5.19 | 4.63 |
| `on-accent` | `accent-hover` | 6.81 | 5.91 |
| `on-danger-solid` | `danger-solid` | 5.35 | 4.60 |
| `on-danger-solid` | `danger-solid-hover` | 7.86 | 6.45 |
| `danger-on-soft` | `surface` | 7.86 | 8.90 |
| `danger-on-soft` | `canvas` | 7.38 | 9.73 |
| `surface` (tooltip text) | `fg` (tooltip) | 15.79 | 14.65 |
| `neutral-on-soft` | `neutral-soft` | 8.94 | 9.09 |
| `info-on-soft` | `info-soft` | 11.25 | 9.29 |
| `success-on-soft` | `success-soft` | 8.26 | 8.81 |
| `warning-on-soft` | `warning-soft` | 7.90 | 8.73 |
| `danger-on-soft` | `danger-soft` | 6.86 | 7.79 |

Graphical elements, minimum 3:1:

| Element | Background | Light | Dark |
|---|---|---|---|
| `border-strong` | `canvas` | 3.24 | 4.11 |
| `border-strong` | `surface` | 3.45 | 3.76 |
| `border-strong` | `surface-hover` | 3.16 | 3.32 |
| `border-strong` | `sidebar` | 3.45 | 4.47 |
| `border-strong` | `neutral-soft` | 3.07 | 3.05 |
| `focus` | `canvas` | 4.87 | 6.10 |
| `focus` | `surface` | 5.19 | 5.58 |
| `focus` | `surface-2` | 4.87 | 5.23 |
| `focus` | `surface-hover` | 4.75 | 4.92 |
| `focus` | `sidebar` | 5.19 | 6.62 |
| `focus` | `sidebar-active` | 4.45 | 4.92 |
| `focus` | `neutral-soft` | 4.62 | 4.52 |
| `focus` | `info-soft` | 4.56 | 4.60 |
| `focus` | `success-soft` | 4.66 | 4.47 |
| `focus` | `warning-soft` | 4.81 | 4.35 |
| `focus` | `danger-soft` | 4.52 | 4.88 |
| `accent` | `canvas` | 4.87 | 4.08 |
| `accent` | `surface` | 5.19 | 3.73 |
| `accent` | `surface-2` | 4.87 | 3.49 |
| `danger-solid` | `canvas` | 5.03 | 4.10 |
| `danger-solid` | `surface` | 5.35 | 3.75 |
| `danger-solid` | `surface-hover` | 4.90 | 3.31 |
| `link` | `sidebar` | 5.19 | 6.62 |
| `link` | `sidebar-active` | 4.45 | 4.92 |
| `neutral-icon` | `canvas` | 4.27 | 6.49 |
| `neutral-icon` | `surface` | 4.54 | 5.94 |
| `neutral-icon` | `surface-hover` | 4.16 | 5.24 |
| `info-icon` | `canvas` | 4.87 | 6.10 |
| `info-icon` | `surface` | 5.19 | 5.58 |
| `info-icon` | `surface-hover` | 4.75 | 4.92 |
| `success-icon` | `canvas` | 4.77 | 7.44 |
| `success-icon` | `surface` | 5.07 | 6.81 |
| `success-icon` | `surface-hover` | 4.65 | 6.01 |
| `warning-icon` | `canvas` | 4.57 | 7.49 |
| `warning-icon` | `surface` | 4.86 | 6.85 |
| `warning-icon` | `surface-hover` | 4.45 | 6.05 |
| `danger-icon` | `canvas` | 5.03 | 5.64 |
| `danger-icon` | `surface` | 5.35 | 5.16 |
| `danger-icon` | `surface-hover` | 4.90 | 4.55 |

A mark drawn in `surface` inside a filled `{tone}-icon` or `danger-solid`
shape, such as the check of the Resolved status, has the contrast of the same
pair. The avatar colors are in Palette.

## Type

### Font

**Choice:** Inter, as a variable font with its optical-size axis, in its
Latin and Latin Extended subsets, from `@fontsource-variable/inter` (SIL Open
Font License 1.1). It ships with the build and the UI's image serves it from
the UI's own origin, as the Content Security Policy allows (`font-src
'self'`; `docs/architecture.md`, Security Headers). While it loads, or where
the browser blocks downloaded fonts, the text shows in the system's sans-serif
font (`ui-sans-serif`, `system-ui`, `sans-serif`).

| Option | Impact |
|---|---|
| The system's fonts | No dependency, but the text, its widths, and its line breaks differ from one desktop to the next, and the reference screenshots, taken in the tooling image, show a font that users do not see |
| **Inter, served by the UI** (chosen) | The same letterforms and metrics for every user and in the reference screenshots. A font designed for screen interfaces, with tabular figures. One dependency without dependencies of its own, published with provenance attestations. The browser downloads the Latin subset, about 70 KB, and the Latin Extended one only for a text that needs it |

Monospace text uses the system's monospace font (`ui-monospace`,
`monospace`), only for a value that users copy character by character, such
as the reference of an error (`docs/behaviors.md`, Default Presentation by
Status).

### Type Scale

| Token | Size / line height | Use |
|---|---|---|
| `text-12` | 12 / 16 px | The labels Inactive and Bot, and the headings of the sections of a menu |
| `text-13` | 13 / 20 px | Column headers, captions, the descriptions and errors of fields, the deadline badge, tooltips, and the "+N" of a cell |
| `text-14` | 14 / 20 px | The cells of a table, and the toolbar, attention counts, and pagination of a list |
| `text-15` | 15 / 24 px | Everything else: running text, the sidebar, buttons, menus, fields, and messages |
| `text-16` | 16 / 24 px | Level-two headings, the title of a dialog, and the product name |
| `text-20` | 20 / 28 px | The level-one heading of a screen, with letter spacing of −0.025 em |

The names state the sizes, so that a size shows in the code; Tailwind's own
names, such as `text-sm`, do not exist. The uses above and the weights below
are the defaults for a text that no pattern covers; a pattern's own value
wins.

- Weights: 400 for text; 500 for buttons, the labels of fields, and the
  identifiers that link to a record in a table; 600 for headings, the current
  navigation entry, the selected view, the P1 label, and the numbers of the
  attention summary.
- Numbers that align in a column or change in place, such as counts, dates in
  a table, deadline badges, and pagination, use tabular figures.
- Text is in sentence case (`docs/behaviors.md`, Style); no text is set in
  capitals for style.

## Spacing and Sizes

- **Spacing** uses a grid of 4 px, with steps of 2 px below 12 px: 4, 6, 8,
  10, 12, 16, 20, 24, 32, and 40 px.
- **Heights:** buttons, single-line fields, menu items, and the rows of a
  table or of the sidebar are 24, 32, 36, 40, 44, or 56 px high, or at least
  that, as each pattern states.
- **Targets:** every target of a pointer is at least 24 by 24 px (WCAG 2.2,
  2.5.8 Target Size (Minimum)).
- **Widths:** a width that this document gives, such as that of a dialog, is
  a maximum: an element takes the width of its place when that is narrower,
  so that every screen works at 320 CSS pixels (Main Content).
- **Radii:** 4, 6, or 8 px, or round, as each pattern states, and 20 % of its
  size for the avatar.
- **Shadows:** only floating elements have one: Tailwind's `shadow-lg` under
  menus, popovers, and tooltips, and `shadow-xl` under dialogs and the
  sidebar opened over the content.
- **Breakpoint:** one, at a window width of 1024 CSS pixels, which, unlike
  the other sizes, does not change with the text size. One media query
  decides how the sidebar shows (Sidebar).

## Icons

### Icon Set

**Choice:** Lucide, through `lucide-react` (ISC License). Its icons are React
SVG elements: no inserted HTML and no data URI, so they work under the
Content Security Policy with Trusted Types (`docs/architecture.md`, Security
Headers; `docs/conventions.md`, No Raw HTML Injection), and only the icons
that the code imports ship.

| Option | Impact |
|---|---|
| A set drawn in this repository | No dependency, but each icon is drawn by an agent, with uneven quality, and each new need waits for a drawing |
| **Lucide** (chosen) | More than 1,500 consistent icons on a 24-unit grid with a stroke of 2, the set that agents know best. No dependencies, releases with provenance attestations, several a month from one publisher |
| Heroicons | About 300 icons, no release since 2024 |
| Phosphor | No release since 2025, and releases without provenance attestations |
| Tabler | Comparable, with a second package |

- Icons keep Lucide's stroke width of 2 on its 24-unit grid and take the
  color of the text, or a `{tone}-icon` token. They are 16 px beside text of
  15 px and in menus and buttons, 14 px beside text of 13 or 14 px, and of
  another size only where a pattern states it, such as in the sidebar.
- An icon beside a text that names the same thing is hidden from assistive
  technologies. An icon alone in a control gives the control no name: the
  control has its own accessible name, which a tooltip shows (Menus,
  Popovers, and Tooltips).
- The marks of severity, priority, and Ticket status are drawn by this
  document, not taken from Lucide (Values).

### Icons by Need

| Need | Lucide icon |
|---|---|
| Product name | `shield-check` |
| Tickets, CVEs, Packages, Products, My packages, Data sources, Administration | `ticket`, `shield-alert`, `package`, `boxes`, `package-check`, `database`, `settings` |
| Search | `search` |
| Collapse and expand the sidebar | `panel-left-close`, `panel-left-open` |
| The account button | `chevrons-up-down` |
| Profile, API keys, Identity audit log, Sign out | `user`, `key-round`, `scroll-text`, `log-out` |
| Theme System, Light, Dark; the selected item of a menu | `monitor`, `sun`, `moon`; `check` |
| Create | `plus` |
| Filters | `list-filter` |
| The sort of a column, ascending and descending | `arrow-up`, `arrow-down` |
| Previous and next page | `chevron-left`, `chevron-right` |
| Open a list of options | `chevron-down` |
| Dismiss or clear | `x` |
| Success, information, warning, and error messages | `circle-check`, `info`, `triangle-alert`, `circle-alert` |
| A deadline that has passed, an overdue milestone | `clock-alert` |
| A confidential Ticket | `lock` |
| A recorded action without an actor | `server-cog` |
| Loading, busy | `loader-circle` |
| A Ticket status that the pinned contract does not list | `circle-question-mark` |
| Copy | `copy` |

A need that the table does not list takes the Lucide icon that names it best,
and the change adds its row.

## Focus and Motion

- **Focus ring:** a 2 px line in `focus`, 2 px outside the element and
  following its radius, or inside it for a row or a cell of a table (Tables),
  shown on keyboard focus. No element removes it (`docs/behaviors.md`,
  Accessibility).
- **Motion:** only loading indicators move: the spinner turns and the progress
  bar runs (Loading). When the browser reports a preference for reduced
  motion, they stand still. Menus, popovers, dialogs, tooltips, and the
  sidebar appear and change at once.

## Page Layout

### Sidebar

The sidebar holds the navigation of the screens that `docs/screen-map.md`
(Sidebar) gives one. It runs along the left edge of the window, the full
height, on `sidebar`, with a `border` line on its right edge, and
stays in place while the content scrolls. When the window is shorter than
the sidebar, the sidebar scrolls within itself.

**Expanded, 216 px wide,** from top to bottom:

- the product name, a link to the landing: `shield-check` at 20 px and
  "Sentinel" in `text-16`, weight 600, in a row 56 px high;
- the search field, 36 px high with 12 px margins, on `canvas` with a
  `border-strong` boundary, the `search` icon at its start, and the
  placeholder "Search";
- the navigation entries, 36 px high with 8 px margins and a 6 px radius:
  the icon at 18 px and the name in `text-15`, in `fg-muted`, on
  `sidebar-active` under the pointer. The current entry has the
  `sidebar-active` background, its name in `fg` at weight 600, its icon in
  `link`, and a 3 px bar in `link` along its left edge;
- at the bottom, the collapse button: `panel-left-close` at 18 px in a 32 px
  target, aligned right, without a visible label, named "Collapse
  navigation", which its tooltip shows; and
- below a `border` line, the account button, 44 px high: the signed-in user's
  avatar at the medium size, the display name at weight 500, cut with an
  ellipsis when it is longer than its place, and `chevrons-up-down` at 16 px
  in `fg-muted`. It opens the account menu.

**Collapsed, 56 px wide,** the same parts, centered, as icon buttons of 40 px:
the product name as `shield-check` at 22 px, named "Sentinel"; the search as
the `search` button, which opens the search field in a popover beside the
sidebar; each entry as its icon at 18 px, named by its entry, the current one
with the `sidebar-active` background, its icon in `link`, and the 3 px bar in
`link` along the left edge of the sidebar; the expand button,
`panel-left-open` at 18 px in a 32 px target, named "Expand navigation"; and
the account button as the avatar alone, the compact form of the user. Each
shows its name in a tooltip to its right, on hover and on keyboard focus.

**Over the content:** below the breakpoint, the expand button opens the
expanded sidebar over the content, on `overlay`, with a shadow; its collapse
button is named "Close navigation" there (`docs/screen-map.md`, Sidebar).

### Account Menu

The account menu (`docs/screen-map.md`, Sidebar) opens upward from the
account button, 256 px wide (Menus, Popovers, and Tooltips). It starts with
the signed-in user: the avatar at the medium size, the display name at
weight 600, and, when it differs from the display name, the username in
`fg-muted`. Its items follow, separated by `border` lines into three groups:
Profile, API keys, and Identity audit log; the section Theme
(`docs/behaviors.md`, Preferences), with its heading in `text-12`, weight
500, `fg-muted`, and the items System, Light, and Dark, of which the
selected one ends with `check`; and Sign out, an ordinary item.

### Main Content

- The main content fills the width beside the sidebar, on `canvas`, with
  24 px of space at its top and sides. It has no maximum width: lists use the
  whole width, and forms and long texts set their own (Forms).
- The message area is at the top of the main content, above the heading:
  messages stack in it, 8 px apart, across the width of the content
  (`docs/behaviors.md`, Outcome of a Change), as Messages describes them.
  The newest message comes first. While the area holds a message, it stays at
  the top of the window when the content scrolls, so that a message that
  appears is always in view. It takes at most a third of the window's height,
  beyond which its messages scroll within it, and the content scrolls so that
  the element with the focus never lies under it (`docs/behaviors.md`,
  Accessibility).
- The heading row holds the level-one heading of the screen in `text-20`,
  weight 600, then what accompanies it, such as the attention summary, and
  the main action of the screen at its end. It wraps when the width runs
  short.
- Running text, such as a CVE description, is at most 720 px wide. A word or
  an address longer than its place, such as a URL, breaks where it must.
  Only a table cell and a user's name cut a text to its place, with an
  ellipsis (Tables; Representation of a User).
- At a width of 320 CSS pixels, which is a window of 1280 px at a zoom of
  400 %, the collapsed sidebar and the content fit side by side: rows of
  controls wrap, and tables scroll within their frame (`docs/behaviors.md`,
  Accessibility).
- A screen other than Sign in that has no sidebar, such as the error of the
  first read of the signed-in user (`docs/screen-map.md`, Sidebar), shows in
  the column of the Sign In Page.
- The link that skips to the main content (`docs/behaviors.md`,
  Accessibility), "Skip to main content", shows only while it has the focus,
  at the top left of the window over the sidebar, as a primary button.

### Sign In Page

Sign in has no sidebar. A column at most 400 px wide, centered on `canvas`,
holds the product name, as in the sidebar but in `text-20`, and below it a
card (`surface`, `border`, 8 px radius, 24 px padding) with the level-one
heading "Sign in", the information of an expired session as an `info` message
(`docs/behaviors.md`, Session Expiration Message), and the form (Forms).

## Values

### Severity

The resolved severity of a Ticket or a CVE is `critical`, `high`, `medium`,
`low`, `none`, or `null` when no assessment resolves it (Sentinel
`docs/features/tickets/tickets.md`, Severity Resolution; Sentinel
`docs/features/tickets/cvss-scoring.md`, Unified CVE Severity).

- A known severity shows as a dot of 8 px in its mark (Severity Marks)
  followed, 6 px later, by its name in `fg`: Critical, High, Medium, Low, or
  None.
- `null` is an absent value (`docs/behaviors.md`, Absent Values).
- A value that the pinned contract does not list shows as received, after a
  hollow dot of 8 px with a 1 px edge in `neutral-icon`
  (`docs/behaviors.md`, Unknown Values).

### Priority

The effective priority of a Ticket is `p1` to `p4`, or `null` while it is not
yet prioritizable (Sentinel `docs/features/tickets/ticket-priority.md`,
Priority Levels; Persistence and Effective Priority). Only P1 is red, so that
the Tickets to remediate at once stand out among many.

- P1 shows as a square mark of 14 px in `danger-solid` with an exclamation
  mark in `on-danger-solid`, followed by "P1" in `fg` at weight 600.
- P2, P3, and P4 show as three rising bars, of which the first three, two, or
  one are filled in `fg-muted` and the others in `border`, followed by the
  level in `fg-muted`.
- `null` is an absent value. A value that the pinned contract does not list
  shows as received, without a mark.

The marks, in a box of 14 by 14 units:

| Mark | Shapes |
|---|---|
| P1 | A square from (0, 0) to (14, 14) with a corner radius of 3; a line from (7, 3.2) to (7, 7.6), 1.8 wide with round ends; a dot of radius 1 at (7, 10.4) |
| Bars | Three bars 3 wide with a corner radius of 0.8, standing on the line y = 13: at x = 1, 4 high; at x = 5.5, 7.5 high; at x = 10, 11 high |

### Ticket Status

A Ticket status shows as a mark of 16 px followed, 6 px later, by its name in
`fg` (`docs/behaviors.md`, Domain Terms). The mark shows how far the Ticket
has come, and its color tells the active statuses from the inactive ones
(Sentinel `docs/features/tickets/tickets.md`, Statuses; Status Categories):
`info-icon` for New, Analysis, and Analyzed, which are active; among the
inactive ones, `success-icon` for Resolved and `neutral-icon` for Ignored and
Duplicated.

The marks, in a box of 16 by 16 units centered on (8, 8), in the color of the
status; lines are 1.75 wide with round ends and joins, and the lines inside
a disc are in `surface`:

| Status | Shapes |
|---|---|
| New | A circle of radius 6.25, drawn as a dashed line of 2.6 with gaps of 1.9 |
| Analysis | A circle of radius 6.25, and the right half of a disc of radius 3.5: the path `M8 8V4.5A3.5 3.5 0 0 1 8 11.5Z` |
| Analyzed | A circle of radius 6.25, and three quarters of a disc of radius 3.5, without its upper-left quarter: the path `M8 8V4.5A3.5 3.5 0 1 1 4.5 8Z` |
| Resolved | A disc of radius 7, and a check: the path `M4.9 8.2 7 10.2l4.1-4.3` |
| Ignored | A disc of radius 7, and a slash: the path `M5.2 10.8 10.8 5.2` |
| Duplicated | A disc of radius 7, and an arrow to the right: the path `M4.6 8h6.1M8.4 5.6 10.8 8l-2.4 2.4` |

A status that the pinned contract does not list shows as received, after
`circle-question-mark` at 16 px in `neutral-icon`.

### Deadline Badge

`docs/behaviors.md` (Deadlines) defines the badge, its text, and its color.
It is 24 px high, with a 4 px radius and 8 px of side padding, in `text-13`,
weight 500, with tabular figures: green as the `success` tone, yellow as the
`warning` tone, and red as the `danger` tone, with `clock-alert` at 12 px
before the number. Another due date with an overdue milestone status shows
`clock-alert` at 14 px in `danger-icon` before that status.

### Confidential Tickets

A confidential Ticket shows `lock` at 14 px in `fg-muted` after its
identifier, with the accessible name "Confidential". A detail screen also
writes "Confidential" next to it.

### Other Values

- Every other value of a response enum shows as its name, in `fg`, without a
  mark (`docs/behaviors.md`, Domain Terms).
- A screen document that marks the values of another enum, such as the status
  of a fetcher run, gives each value the tone of its meaning (Tones) and shows
  it as Severity does: a dot of 8 px in its `{tone}-icon` followed by its
  name. A value that the pinned contract does not list shows as Severity
  shows one (`docs/behaviors.md`, Unknown Values). Red, the `danger` tone, is
  kept for failure, lateness, and errors (Principles).
- An absent value shows as an en dash, "–", in `fg-muted`, read as "Not set"
  (`docs/behaviors.md`, Absent Values).
- The count of a view follows its label in `fg-muted`. A number of the
  attention summary is at weight 600, in `danger-on-soft` when it is above
  zero and in `fg` at zero, followed by its label in `fg-muted`. While a
  count loads, its label shows alone, and a count that is not available
  (`docs/behaviors.md`, Where Errors Appear) shows an en dash in `fg-muted`
  in place of its number.

## Interface Patterns

### Buttons and Links

| Variant | Appearance | Use |
|---|---|---|
| Primary | `accent` fill, `on-accent` text, `accent-hover` under the pointer | The main action of a screen, a form, or a dialog; one per screen part |
| Secondary | `surface` fill, `border-strong` boundary, `fg` text, `surface-hover` under the pointer | Other actions, and Cancel in a dialog |
| Quiet | No fill or boundary, `fg` text, `surface-hover` under the pointer | Cancel in a form |
| Danger | `danger-solid` fill, `on-danger-solid` text, `danger-solid-hover` under the pointer | The button that confirms an action that cannot be undone, that ends another person's access, or that discards input (`docs/behaviors.md`, Confirmation); a confirmed change of a setting or of a fetcher uses Primary |
| Icon | A quiet button with an icon alone, named by its accessible name and its tooltip | Compact actions, such as dismiss and the sidebar buttons |

- Buttons have a 6 px radius, 12 px of side padding, or 16 px at a height
  of 40 px, their label at weight 500, and their icon at 16 px before the
  label; Next has its chevron after it. They are 32 px high in the toolbar
  and pagination of a list and in the heading of a card, 40 px in forms and
  dialogs, and 36 px elsewhere, such as in the heading row of a screen, in an
  empty state, and as Try again, unless a pattern states its own height.
- A disabled button shows at 60 % opacity. A busy button shows
  `loader-circle` in place of its icon, or before its label, keeps its label,
  and cannot be pressed (`docs/behaviors.md`, Loading).
- A link is in `link`. In running text it is underlined; in a table or a list,
  where it is an identifier or a name, it is underlined under the pointer and
  on focus.

### Lists

A list screen, such as the Ticket list, shows from top to bottom:

1. The heading row (Main Content): the heading; its companions, such as the
   counts of the attention summary as links 32 px high, on `surface` with a
   `border` line and a 6 px radius, each the number followed by its label; and
   the main action as a primary button, such as "Create Ticket".
2. The toolbar, 16 px below: the views (`docs/screen-map.md`, Ticket List
   Views) as tabs 32 px high with a `border` line and a 6 px radius, each its
   label followed by its count; the selected tab has a `border-strong`
   boundary, the `neutral-soft` background, and its label at weight 600. A
   tab opens when the user clicks it or presses Enter or Space, not when the
   arrow keys move the focus to it. At the end of the toolbar come the search
   field, 224 px wide and 32 px high, with the placeholder "Search
   {records}", such as "Search Tickets", which applies its term when the user
   presses Enter and removes it with its clear button; Filters, a secondary
   button with `list-filter`, which opens a popover with the filter fields
   and shows the number of the filters that apply after its label. A filter
   applies as soon as its field changes; a combobox, when the user chooses an
   option; and a field that the user types into, such as a text or a date
   field, when the user presses Enter, which in either field of a range, such
   as two dates, applies both. A typed value that is not applied returns to
   the applied one when its field loses the focus. While a filter or a search
   applies, Clear filters, a quiet button with `x`, follows Filters. The
   toolbar wraps when the width runs short.
3. The table (Tables), 16 px below.
4. The pagination, 16 px below, at the end of the line, when the list has
   more than one page: the range, such as "1–20 of 25", in `text-14` and
   `fg-muted`, then Previous and Next as secondary buttons 32 px high.
   Previous is disabled on the first page, and Next on the last. On a page
   beyond the last, the empty state takes the place of the rows and of the
   pagination (`docs/behaviors.md`, Empty States).

### Tables

- A table sits in a frame on `surface` with a `border` line and an 8 px
  radius, and scrolls horizontally within it when it is wider than its place
  (`docs/behaviors.md`, Accessibility).
- The header row is 36 px high, on `surface-2`, with the column names in
  `text-13`, weight 500, `fg-muted`. The sorted column shows `arrow-up` or
  `arrow-down` at 14 px after its name.
- Each row is at least 36 px high, in `text-14`, with a `border` line below
  it and `surface-hover` under the pointer, which helps to follow the row.
  Cells have 10 px of side padding, the first and the last 16 px at the outer
  side, and hold one line, centered vertically, unless their text wraps
  (below).
- The first column holds the identifier of the record, as a link at weight
  500 when the record has a screen of its own; it is the only link to the
  record, and the row as a whole is not one.
- The focus ring of a row or a cell is drawn inside it, so that the frame
  does not cut it.
- A cell with several values, such as the packages of a Ticket, shows the
  first, then "+N", the number of the others, as a button 24 px high in
  `text-13`, weight 500, `neutral-on-soft` on `neutral-soft`, with a 4 px
  radius. Its tooltip lists every value under the count, such as "3
  packages", and its accessible name states the others, such as "2 more
  packages: fictional-curl-mini, fictional-libcurl4".
- A text longer than its column, such as a title, ends with an ellipsis when
  the screen of its record shows it whole, and assistive technologies read it
  whole; in a table whose records have no screen of their own, such as an
  audit log, it wraps, a user's name included, and its row grows.
- A user shows in the full form at the small size (Representation of a
  User).
- The loading indicator, an error in place of the data, and an empty state
  show inside the frame, below the header row.
- Rows have no colored marks other than those of their values.

### Detail Screens

- The heading row holds the identifier of the record as the level-one
  heading, followed on the same line by its main values, such as the status,
  severity, and priority of a Ticket, and ends with the screen's actions.
- The fields of the record show as a description list: the terms in
  `fg-muted`, the values in `fg`, in two columns 24 px apart, with rows 6 px
  apart.
- Each part of the record, such as the references of a Ticket, is a card on
  `surface` with a `border` line, an 8 px radius, and 24 px of padding, with a
  level-two heading in `text-16`, weight 600, and its actions at the end of
  the heading's line. A part without items shows its short line in `fg-muted`
  (`docs/behaviors.md`, Empty States).
- A screen document can show the parts of a long record one at a time, as
  tabs that look and behave like the views of a list.

### Forms

- A form is one column, at most 448 px wide, with its fields 12 px apart.
- Each field has its label above it, in `text-15`, weight 500; a field that
  may stay empty adds " (optional)" to its label in `fg-muted`, at weight 400.
  The control is 40 px high, on `surface`, with a `border-strong` boundary, a
  6 px radius, and 16 px of side padding; its description follows it in
  `text-13` and `fg-muted`.
- A field with an error has a 2 px boundary in `danger-icon`, and its message
  follows the field, after `circle-alert` at 14 px, in `text-13`, weight 500,
  `danger-on-soft` (`docs/behaviors.md`, Where Errors Appear).
- An error of the whole form shows at its top as a `danger` message, or as a
  `warning` one for a change that Sentinel did not confirm, without a dismiss
  button (Messages).
- The buttons close the form, aligned to its end: Cancel as a quiet button,
  then the action that submits it, primary or danger.
- Other controls follow the field: a multi-line field is at least 88 px
  high, three lines of text; a select is a field-like button that ends with
  `chevron-down` and opens its options as a menu; a combobox is a field that
  opens its options below it, showing users in the full form at the small
  size, and while they load, when none matches, or when their read fails,
  shows in their place the loading indicator, a line such as "No users
  match.", or the message of the failure; a checkbox or a radio button is
  16 px, with a `border-strong` boundary, a 4 px radius or round, and when
  selected an `accent` fill with its mark in `on-accent`; a date field shows
  its parts as `docs/behaviors.md` (Input) orders them; and a search field
  starts with `search` at 16 px and, with a value, ends with a clear button.

### Dialogs

- A dialog is centered over `overlay`, on `surface` with a `border` line, an
  8 px radius, `shadow-xl`, and 20 px of padding: at most 400 px wide for a
  confirmation and 560 px for a dialog with a form. A dialog taller than the
  window scrolls its content and keeps its buttons in view.
- Its title is in `text-16`, weight 600, its text in `fg-muted`, and its
  buttons, 40 px high, close it aligned to its end: Cancel, or Keep editing,
  as a secondary button, then the action, primary or danger as Buttons and
  Links states (`docs/behaviors.md`, Confirmation).
- A centered dialog has no close icon: Cancel, Close, and Escape close it.

### Messages

- A message is a box in the soft background of its tone, with its text and
  icon in the tone's `on-soft` color, a 6 px radius, 8 px of vertical and
  12 px of side padding, and `text-15`. It starts with the icon of its tone
  at 18 px; a link in it is in the color of its text, underlined, at weight
  500; the reference of an error follows on its own line as "Reference:" and
  the identifier in monospace; and in the message area it ends with a dismiss
  button, `x` at 16 px in a 24 px target, named "Dismiss".
- The tone follows the message: `success` for a change that succeeded,
  `info` for an operation that started and for information, `warning` for a
  change that Sentinel did not confirm (`docs/behaviors.md`, Retries and
  Unconfirmed Changes), and `danger` for an error.
- When data stays shown after a new read of it failed, a `warning` message
  above the data says that it could not be updated (`docs/behaviors.md`, Where
  Errors Appear).

### Loading

- The loading indicator is `loader-circle` at 18 px in `fg-muted`, turning,
  followed by "Loading" in `fg-muted`, centered in the place of the part that
  waits (`docs/behaviors.md`, Loading). As the UI loads, before it shows any
  screen, the indicator is centered in the window, without the sidebar
  (`docs/behaviors.md`, Session State).
- Data that stays shown while other data loads is marked by a progress bar,
  2 px high in `accent`, running along the top edge of its frame or part; the
  data itself does not change its appearance.

### Empty States

- An empty list shows, in place of the rows and inside the table's frame, its
  message (`docs/behaviors.md`, Empty States) in `fg`, centered, with 40 px of
  space above and below, and its action below it as a secondary button, such
  as "Create Ticket" with `plus` or "Clear filters" with `x`.
- A part of a screen without items shows its short line in `fg-muted`.

### Errors in Place of Content

- An error in place of the content of a screen shows below the message area:
  the level-one heading that names the error, its message in `fg-muted`, the
  reference of the error when it has one, and its action, Try again as a
  secondary button or a link to the landing, aligned to the start and at most
  560 px wide (`docs/behaviors.md`, Default Presentation by Status).
- An error in place of a part shows the same inside the part, below its
  heading, without a heading of its own.

### Menus, Popovers, and Tooltips

- A menu or a popover is on `surface`, with a `border` line, an 8 px radius,
  a shadow, and 4 px of padding. A menu item is 36 px high with a 6 px radius
  and 10 px of side padding, its icon at 16 px in `fg-muted` before its label
  in `text-15`, and `surface-hover` under the pointer and on focus. The
  heading of a section is in `text-12`, weight 500, `fg-muted`; groups are
  separated by `border` lines; and an item of a single selection ends with
  `check` at 16 px when it is selected.
- A tooltip inverts the colors of text: `surface` on an `fg` background, in
  `text-13`, weight 500, with a 6 px radius and 6 px by 10 px of padding. It
  shows after 300 ms of hover and at once on keyboard focus, stays while the
  pointer is over it, and Escape hides it (WCAG 2.2, 1.4.13 Content on Hover
  or Focus). It names an icon alone or a compact avatar, or lists the values
  of a "+N"; it never holds the only means to act.

## Representation of a User

`docs/behaviors.md` (Representation of a User) defines what shows for a user;
its sizes and labels look as follows.

| Size | Avatar | Use |
|---|---|---|
| Small | 24 px | Text, table rows, and the options of a field |
| Medium | 32 px | Other lists of users, such as the access grants of a Ticket, the account button, and the account menu |
| Large | 64 px | The heading of a user's screen |

- **Full form:** the avatar, 6 px of space, and the display name in the
  surrounding text's style; where the username follows, it is in `fg-muted`.
- **Inactive and Bot:** the label follows the name, 6 px later, in `text-12`,
  weight 500, `fg-muted`, with a 1 px `border-strong` boundary, a 4 px radius,
  and 4 px of side padding. An inactive user's name is in `fg-muted`. Where
  the place is too narrow, only the name ends with an ellipsis, unless a
  table wraps it (Tables); the labels always show.
- **Compact form:** the avatar alone in its control, with the tooltip of its
  name.
- **No recorded actor:** "System" after a square of the avatar's size, on
  `neutral-soft` with a corner radius of 20 %, holding `server-cog` at 70 % of
  that size in `neutral-on-soft`.

## Avatar

The avatar is a picture that the UI generates from the user's `id`, which is
stable and never changes (Sentinel `docs/api-spec.md`, User References in
Responses). The definition is exact, so that any implementation, in any
language, draws the same picture.

### Definition, Version 1

1. **Seed:** the `id`, in its hyphenated form of 36 characters, converted to
   lower case, encoded in UTF-8.
2. **Digest:** the SHA-256 digest of the seed, 32 bytes. Its bits are
   numbered from 0, the most significant bit of byte 0 first: bit `k` is bit
   `7 - (k mod 8)`, counting from the least significant, of byte
   `floor(k / 8)`.
3. **Pattern:** a grid of 5 columns and 5 rows, columns 0 to 4 from left to
   right and rows 0 to 4 from top to bottom. For columns `c` from 0 to 2 and
   rows `r` from 0 to 4, bit `5c + r` fills the cell of column `c` and row
   `r` when it is 1. Column 3 repeats column 1 and column 4 repeats column 0,
   so the pattern mirrors around its center column. When bits 0 to 14 are all
   0, which about one id in 32,768 gives, column 2 is filled instead.
4. **Color:** bits 16, 17, and 18, read as an unsigned number with bit 16 the
   most significant, that is the three most significant bits of byte 2,
   select the color of the Palette by its index. Bit 15 is not used.
5. **Drawing:** a square of 6 by 6 units filled with `#F0F0F0`, with corners
   rounded at a radius of 1.2 units, and for each filled cell a square of 1 by
   1 unit, in the color, at `(0.5 + column, 0.5 + row)`; the filled cells form
   one shape, so that no seam shows between neighbors at any size. The
   picture has no border and is the same in both themes; it scales to the
   size of its use, and until it is drawn its place stays empty at that size.

The `id` is the input because it never changes: a username and an email
address can change, and a digest of an email address could identify its user
elsewhere. The digest spreads every bit of the `id` over the pattern, so that
ids that share their leading characters, as time-ordered ids created together
do, still look different. SHA-256 is available in the browser's Web Crypto
API in the secure contexts in which the UI runs and in the standard library
of most languages.

### Palette

| Index | Color | Contrast with `#F0F0F0` |
|---|---|---|
| 0 | `#B91C1C` | 5.67 |
| 1 | `#C2410C` | 4.54 |
| 2 | `#A16207` | 4.32 |
| 3 | `#15803D` | 4.40 |
| 4 | `#0F766E` | 4.80 |
| 5 | `#0369A1` | 5.20 |
| 6 | `#4338CA` | 6.93 |
| 7 | `#A21CAF` | 5.54 |

Every color has a contrast of at least 3:1 with the background of the avatar
(WCAG 2.2, 1.4.11 Non-text Contrast). The colors and the background are
tokens, `avatar-0` to `avatar-7` and `avatar-bg`, with one value for both
themes.

### Versions

This is version 1. A change of any step of the definition or of the Palette
changes the avatar of every user, so it is made only as a new version, which
this document numbers and gives new test vectors.

### Test Vectors

The ids are fictional. Vectors 1 to 4 share their first 48 bits, which a
time-ordered id fills with the millisecond of its creation, and differ only
in their last character; vector 5 differs from vector 1 only in its twelfth
hexadecimal digit, one millisecond later; vector 6 is vector 1 in upper case
and gives the same avatar; and vector 7 has bits 0 to 14 all 0 and shows the
filled center column. The cells list the 15 cells of step 3, cell `5c + r`
in position `5c + r`, 1 for a filled cell; the grids show filled cells as
`#`, row 0 first.

| Vector | Id | First 3 bytes of the digest | Cells | Color |
|---|---|---|---|---|
| 1 | `019a2b3c-4d5e-7f00-8000-000000000001` | `70b0e4` | `011100001011000` | 7 |
| 2 | `019a2b3c-4d5e-7f00-8000-000000000002` | `a05ad9` | `101000000101101` | 6 |
| 3 | `019a2b3c-4d5e-7f00-8000-000000000003` | `013db2` | `000000010011110` | 5 |
| 4 | `019a2b3c-4d5e-7f00-8000-000000000004` | `d0fb93` | `110100001111101` | 4 |
| 5 | `019a2b3c-4d5f-7f00-8000-000000000001` | `2f717f` | `001011110111000` | 3 |
| 6 | `019A2B3C-4D5E-7F00-8000-000000000001` | `70b0e4` | `011100001011000` | 7 |
| 7 | `019a2b3c-4d5e-7f00-8000-0000000080d5` | `00008f` | `000000000011111` | 4 |

```text
1 and 6   2         3         4         5         7
..#..     #...#     ..#..     #.#.#     .###.     ..#..
#.#.#     ..#..     ..#..     #.#.#     .###.     ..#..
#...#     #.#.#     .###.     ..#..     ##.##     ..#..
##.##     .....     ..#..     ##.##     .....     ..#..
.....     .###.     .....     .###.     ##.##     ..#..
```

An implementation is correct when it gives these cells and colors for every
vector, and the mirrored grids above.

## Open Decisions

No decision is open. A decision that is not taken yet is listed here, with who
takes it, and every design that depends on it waits for it.
