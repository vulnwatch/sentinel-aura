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
  - [Sentinel Mark](#sentinel-mark)
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
  - [Track Milestones](#track-milestones)
  - [Confidential Tickets](#confidential-tickets)
  - [Labels](#labels)
  - [Other Values](#other-values)
- [Interface Patterns](#interface-patterns)
  - [Buttons and Links](#buttons-and-links)
  - [Lists](#lists)
  - [Tables](#tables)
  - [Timelines](#timelines)
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
  effective priority of P1, the automatic P1 that an override hides in the
  explanation of a priority (Priority), a deadline that has passed, an error,
  and the button that confirms a destructive action (Buttons and Links).
  Severity shows as a small mark beside its name, not as a red fill, so that
  red keeps that meaning.
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
  avatar's colors are tokens too (Palette). The favicon, which the browser
  shows outside the page, has two colors of its own, outside the tokens
  (Sentinel Mark).

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
| `surface` | `#FFFFFF` | `#151B23` | Cards, the frame of a table and of a box within a part of a detail screen, menus, popovers, dialogs, and fields |
| `surface-2` | `#F6F8FA` | `#1A212A` | The header row of a table |
| `surface-hover` | `#F3F5F8` | `#1E2630` | A row, a menu item, or a quiet control under the pointer |
| `sidebar` | `#FFFFFF` | `#010409` | The sidebar |
| `sidebar-active` | `#EAEEF2` | `#1E2630` | The current entry of the sidebar, and an entry under the pointer |
| `fg` | `#1F2328` | `#E6EDF3` | Text |
| `fg-muted` | `#59636E` | `#9198A1` | Secondary text and icons: terms of a description list, column headers, counts, captions, placeholders, and the icons beside a text |
| `muted-on-fg` | `#9198A1` | `#59636E` | How many more values a "+N" has than its tooltip lists (Tables): `fg-muted` of the other theme, as a tooltip inverts the colors |
| `border` | `#D8DEE4` | `#2F3742` | Lines that separate: between rows, around cards and tables, between the parts of a detail screen, in menus, and at the edge of the sidebar |
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
- the lines that join the phases of a track (Track Milestones), the line and
  the boundaries of the markers of a timeline (Timelines), and the boundary of
  a label (Labels), whose icons and texts carry the meaning;
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
| `muted-on-fg` (tooltip text) | `fg` (tooltip) | 5.42 | 5.17 |
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
| `danger-solid` | `neutral-soft` | 4.76 | 3.04 |
| `link` | `sidebar` | 5.19 | 6.62 |
| `link` | `sidebar-active` | 4.45 | 4.92 |
| `neutral-icon` | `canvas` | 4.27 | 6.49 |
| `neutral-icon` | `surface` | 4.54 | 5.94 |
| `neutral-icon` | `surface-hover` | 4.16 | 5.24 |
| `info-icon` | `canvas` | 4.87 | 6.10 |
| `info-icon` | `surface` | 5.19 | 5.58 |
| `info-icon` | `surface-hover` | 4.75 | 4.92 |
| `info-icon` | `sidebar` | 5.19 | 6.62 |
| `info-icon` | `sidebar-active` | 4.45 | 4.92 |
| `success-icon` | `canvas` | 4.77 | 7.44 |
| `success-icon` | `surface` | 5.07 | 6.81 |
| `success-icon` | `surface-hover` | 4.65 | 6.01 |
| `warning-icon` | `canvas` | 4.57 | 7.49 |
| `warning-icon` | `surface` | 4.86 | 6.85 |
| `warning-icon` | `surface-hover` | 4.45 | 6.05 |
| `danger-icon` | `canvas` | 5.03 | 5.64 |
| `danger-icon` | `surface` | 5.35 | 5.16 |
| `danger-icon` | `surface-hover` | 4.90 | 4.55 |
| `danger-icon` | `danger-soft` | 4.66 | 4.51 |
| `info-icon` | `info-soft` | 4.56 | 4.60 |
| `neutral-icon` | `neutral-soft` | 4.04 | 4.81 |
| `success-icon` | `neutral-soft` | 4.52 | 5.52 |
| `danger-icon` | `neutral-soft` | 4.76 | 4.18 |
| `info-icon` | `neutral-soft` | 4.62 | 4.52 |
| `fg-muted` (knob of a switch that is off) | `neutral-soft` | 5.44 | 4.81 |
| `on-accent` (knob of a switch that is on) | `accent` | 5.19 | 4.63 |

The icon of the current phase of a track stands on the soft background of its
tone, and the icons of a pipeline on `neutral-soft` under the pointer (Track
Milestones); the rail of a switch that is on has the contrast of `accent` on
its background (Forms).
A mark drawn in `surface` inside a filled `{tone}-icon` or `danger-solid`
shape, such as the check of the Resolved status, has the contrast of the same
pair. The icon of a link to another site (Buttons and Links), an icon that
carries a meaning without a text, has the contrast of the text of its link,
and the icon of a priority override (Priority) has that of `fg-muted` text on
its background.
The avatar colors are in Palette.

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
| `text-12` | 12 / 16 px | Labels (Labels), the headings of the sections of a menu, and the number of an entry of the sidebar |
| `text-13` | 13 / 20 px | Column headers, captions, the descriptions and errors of fields, the deadline badge, tooltips, and the "+N" of a cell |
| `text-14` | 14 / 20 px | The cells of a table, and the toolbar, attention counts, and pagination of a list |
| `text-15` | 15 / 24 px | Everything else: running text, the sidebar, buttons, menus, fields, and messages |
| `text-16` | 16 / 24 px | Level-two headings, the title of a dialog, and the product name |
| `text-20` | 20 / 28 px, letter spacing −0.025 em | The level-one heading of a screen |

The names state the sizes, so that a size shows in the code; Tailwind's own
names, such as `text-sm`, do not exist. The uses above and the weights below
are the defaults for a text that no pattern covers; a pattern's own value
wins.

- Weights: 400 for text; 500 for buttons, the labels of fields, and the
  identifiers that link to a record in a table; 600 for headings, the current
  navigation entry, the selected view, the P1 label, the numbers of the
  attention summary, and the number of an entry of the sidebar.
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
- **Radii:** 4, 6, or 8 px, or round, as each pattern states; for the
  avatar, round for a person and 20 % of its size for a bot account and for a
  recorded action without an actor (Avatar; Representation of a User).
- **Shadows:** only floating elements have one: Tailwind's `shadow-lg` under
  menus, popovers, and tooltips, and `shadow-xl` under dialogs and the
  sidebar opened over the content.
- **Breakpoint:** one, at a window width of 1024 CSS pixels, which, unlike
  the other sizes, does not change with the text size. One media query
  decides how the sidebar shows (Sidebar). Whether a detail screen shows its
  side column beside its parts depends on the width of its main content,
  which follows the width of the sidebar and the text size, not on a second
  breakpoint of the window (Detail Screens).

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
- The marks of severity, priority, and Ticket status (Values) and the
  Sentinel mark (Sentinel Mark) are drawn by this document, not taken from
  Lucide.

### Icons by Need

| Need | Lucide icon |
|---|---|
| Product name | The Sentinel mark, which is not a Lucide icon (Sentinel Mark) |
| Tickets, My packages, Users, Fetchers, Administration | `ticket`, `package-check`, `users`, `cloud-download`, `settings` |
| Search | `search` |
| Collapse and expand the sidebar | `panel-left-close`, `panel-left-open` |
| The account button | `chevrons-up-down` |
| Account, API keys, Sign out | `user`, `key-round`, `log-out` |
| Theme System, Light, Dark; the selected item of a menu, a selected checkbox | `monitor`, `sun`, `moon`; `check` |
| Create | `plus` |
| Filters | `list-filter` |
| The sort of a column, ascending and descending | `arrow-up`, `arrow-down` |
| Previous and next page | `chevron-left`, `chevron-right` |
| Open a list of options | `chevron-down` |
| Dismiss or clear | `x` |
| Success, information, warning, and error messages | `circle-check`, `info`, `triangle-alert`, `circle-alert` |
| A deadline that has passed, an overdue milestone | `clock-alert` |
| The other statuses of a milestone: done, pending, not applicable, not observed (Track Milestones); an observation never made (Other Values) | `circle-check`, `circle`, `circle-minus`, `circle-dashed` |
| A confidential Ticket | `lock` |
| A priority override, an eligibility set by hand | `user-pen` |
| The maintainers of a package: one, several, none | `user-round`, `users-round`, `user-round-x` |
| Change a field of a record in place, edit a row of a table | `pencil` |
| Delete a row of a table | `trash` |
| The other actions of a record within a part, such as a package | `ellipsis` |
| Restore an excluded record | `undo-2` |
| Refetch | `refresh-cw` |
| A recorded action without an actor | The Sentinel mark, which is not a Lucide icon (Representation of a User) |
| Loading, busy, an operation in progress (Other Values) | `loader-circle` |
| A Ticket status, a milestone status, or a kind of event that the pinned contract does not list | `circle-question-mark` |
| Copy | `copy` |
| A link to another site | `external-link` |

A need that the table does not list takes the Lucide icon that names it best,
and the change adds its row.

### Sentinel Mark

The Sentinel mark is the icon of the product name, the favicon of every page,
and the picture of a recorded action without an actor (Representation of a
User). It is drawn after Sentinel's logo, a shield whose outline two cuts open
into an S (Sentinel `.github/assets/logo.svg`), in the style of Lucide, so
that it sits with the icons around it.

- It is one line on Lucide's 24-unit grid, with Lucide's stroke of 2 and
  round ends and joins, the path
  `M20 8V4.5C17.5 5 14 4.5 12 2C10 4.5 6.5 5 4 4.5V9.5L19.5 13.5C18 18.5 16.16 20.55 12 22C8.61 20.82 6.77 19.24 5.39 16`.
  From the right side, it runs over the shoulders and the peak of the shield,
  down the left side, across the shield in a diagonal, and around its lower
  half. The right side ends above the diagonal, and the lower half short of
  the left side: these two openings, the only parts that break the symmetry
  of the shield, make the S.
- In the page it follows the rules of the other icons (Icon Set), in the
  color of the text, or at the size and in the color that Representation of a
  User gives it for an action without an actor.
- As the favicon it has a stroke of 2.5, because the browser shows it alone at
  16 px, where a stroke of 2 draws a line thinner than 1.5 px. It is drawn in
  `#213661`, the lighter blue of Sentinel's logo, and, when the browser
  reports a preference for a dark color scheme, in `#E6EDF3`, taken from the
  `fg` of the dark theme. The browser shows the favicon in its own tabs,
  whose colors follow its color scheme rather than the theme of the UI
  (`docs/behaviors.md`, Preferences), and no single color stands out on both
  light and dark tabs. These two colors are the favicon's own, outside the
  tokens (Principles).

## Focus and Motion

- **Focus ring:** a 2 px line in `focus`, 2 px outside the element and
  following its radius, or inside it for an element whose edges would cut
  it: a row or a cell of a table (Tables), a menu item (Menus, Popovers, and
  Tooltips), the main content after the link that skips to it (Main
  Content), and the sidebar opened over the content (Sidebar). It shows on
  keyboard focus, and no element removes it (`docs/behaviors.md`,
  Accessibility).
- **Motion:** only loading indicators and the mark of an operation in
  progress move: the spinner turns and the progress bar runs (Loading), and
  so does the mark of an operation that a screen follows by reading it again,
  such as the pending fetch of a source (Other Values). When the browser
  reports a preference for reduced motion, they stand still. Menus,
  popovers, dialogs, tooltips, and the sidebar appear and change at once.

## Page Layout

### Sidebar

The sidebar holds the navigation of the screens that `docs/screen-map.md`
(Sidebar) gives one. It runs along the left edge of the window, the full
height, on `sidebar`, with a `border` line on its right edge, and
stays in place while the content scrolls. When the window is shorter than
the sidebar, the sidebar scrolls within itself.

**One axis.** The pictures of the sidebar, the Sentinel mark, the icons, and
the avatar, are centered on one vertical axis, 28 px from its left edge, the
middle of the collapsed sidebar, and every part keeps its height and place in
both states. Collapsing or expanding the sidebar only changes its width, hides
or shows the names, and swaps the number of an entry for its dot, so that
nothing that stays moves. The axis decides where each picture sits inside its
part, before the spacing grid (Spacing and Sizes): an 18 px icon sits 11 px
into its entry, and the 20 px mark 10 px into its link.

**Expanded, 216 px wide,** from top to bottom:

- the product name, a link to the landing: the Sentinel mark at 20 px and
  "Sentinel" in `text-16`, weight 600, in a row 56 px high;
- the search field, 36 px high with 8 px margins, on `canvas` with a
  `border-strong` boundary, the `search` icon at its start on the axis, and
  the placeholder "Search";
- the navigation entries, 36 px high with 8 px margins and a 6 px radius:
  the icon at 18 px on the axis and the name in `text-15`, in `fg-muted`, on
  `sidebar-active` under the pointer. The current entry has the
  `sidebar-active` background, its name in `fg` at weight 600, its icon in
  `link`, and a 3 px bar in `link` along its left edge. An entry with a
  number, such as the pending work of My packages (`docs/screen-map.md`,
  Sidebar), ends with it, 8 px after its name: a round box 20 px high and at
  least 20 px wide, with 6 px of side padding, on `info-soft`, holding the
  number in `text-12`, weight 600, `info-on-soft`, with tabular figures and
  the thousands grouped (`docs/behaviors.md`, Style). The number belongs to
  the entry's accessible name, which is the name followed by the number and
  the kind of work, such as "My packages, 2 pending";
- at the bottom, the collapse button: `panel-left-close` at 18 px in a 32 px
  target on the axis, without a visible label, named "Collapse navigation",
  which its tooltip shows; and
- below a `border` line, the account button, 44 px high: the signed-in user's
  avatar at the medium size on the axis, the display name at weight 500, cut
  with an ellipsis when it is longer than its place, followed by its labels,
  as Representation of a User shows them, and `chevrons-up-down` at 16 px in
  `fg-muted`. It opens the account menu.

**Collapsed, 56 px wide,** the same parts at the same places, each row
narrowed to 40 px around the axis, without their names, while the toggle
keeps its 32 px target: the product name as the Sentinel mark, named
"Sentinel"; the search as the `search` button, 36 px high, which opens the
search field in a popover beside the sidebar; each entry as its icon, named
by its entry, the current one with the `sidebar-active` background, its icon
in `link`, and the 3 px bar along its left edge, and an entry with a number
with a dot of 8 px in `info-icon` in place of the number, centered on the
upper right corner of its icon, inside a 2 px ring in the background of the
entry, so that the dot stands apart from the icon's lines, while the
accessible name and the tooltip state the number, such as "My packages, 2
pending"; the expand button, `panel-left-open`, named "Expand navigation";
and the account button as the avatar alone, the compact form of the user.
Each shows its name in a tooltip to its right, on hover and on keyboard
focus; in the expanded sidebar, where the names show, only the collapse
button has a tooltip.

**Over the content:** below the breakpoint, the expand button opens the
expanded sidebar over the content, on `overlay`, with a shadow; its collapse
button is named "Close navigation" there (`docs/screen-map.md`, Sidebar).

### Account Menu

The account menu (`docs/screen-map.md`, Sidebar) opens upward from the
account button, 256 px wide (Menus, Popovers, and Tooltips). It starts with
the signed-in user: the avatar at the medium size, 6 px of space, and two
lines, the display name at weight 600 followed by its labels, and below them
the username, as `@` and the username, such as `@jdoe`, in `text-13`,
`fg-muted`, at weight 400, also when it is the display name
(`docs/behaviors.md`, Representation of a User). The name and the username
wrap where the menu is too narrow, instead of ending with an ellipsis, so
that the menu shows whole the name that the account button cuts. Its items
follow, below a `border` line and separated by `border` lines into three
groups: Account and API keys (`docs/screen-map.md`, Sidebar); the section
Theme (`docs/behaviors.md`, Preferences), with its heading in `text-12`,
weight 500, `fg-muted`, and the items System, Light, and Dark, of which the
selected one ends with `check`; and Sign out, an ordinary item. While Sign
out is in progress, the menu stays open, and the item keeps the focus, shows
`loader-circle` in place of its icon, has the description "Signing out" for
assistive technologies, and cannot start the sign-out again
(`docs/behaviors.md`, Loading); when it fails, the menu closes, and the
message area shows its error (`docs/behaviors.md`, Where Errors Appear), which
also closes the sidebar opened over the content (`docs/screen-map.md`,
Sidebar).

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
  the element with keyboard focus never lies under it, nor under the compact
  heading of a detail screen below it (Detail Screens), and so that the
  target of an anchor of the page shows below both (`docs/behaviors.md`,
  Accessibility). While it holds a message, the area is on `canvas`, with
  8 px of space above and below its messages, and the heading follows 16 px
  below the last message; without one, it takes no room.
- A URL with an anchor shows its target once every part of the screen, or of
  its tab, shows its data or its error, unless the user has scrolled
  meanwhile, so that a part that arrives later does not move the target out
  of view. A screen whose record lacks the target of an anchor shows its
  top.
- The heading row holds the level-one heading of the screen in `text-20`,
  weight 600, then what accompanies it, such as the attention summary, and
  the main action of the screen at its end. It wraps when the width runs
  short.
- Running text, such as a CVE description, is at most 720 px wide. A word or
  an address longer than its place, such as a URL, breaks where it must. A
  text is cut to its place, with an ellipsis, only in a table cell, in a
  user's name (Tables; Representation of a User), and in the description of a
  record on its detail screen, such as that of a CVE, where a screen document
  states it: the description shows its first four lines, the last ending with
  an ellipsis, and below them Show more, a button in `link`, `text-14`, weight
  500, which shows the text whole and becomes Show less. Assistive
  technologies read the description whole, and Show more states whether it is
  expanded. Such a description keeps its line breaks, and a run of spaces
  shows as one; it shows as written, as plain text, Markdown included, since
  the UI interprets no text of the API (`docs/behaviors.md`, Links to Other
  Sites, No address in a text; `docs/conventions.md`, No Raw HTML Injection).
- In every layout, the order of the page, which the keyboard and assistive
  technologies follow, is the order on the screen: no layout moves a part to
  another place with CSS alone (`docs/behaviors.md`, Accessibility; WCAG 2.2,
  1.3.2 Meaningful Sequence; 2.4.3 Focus Order).
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
holds the product name, as in the sidebar but in `text-20` with the Sentinel
mark at 24 px, centered and not a link, and 24 px below it a card (`surface`,
`border`, 8 px radius, 24 px padding) with the level-one heading "Sign in",
the information of an expired session as an `info` message
(`docs/behaviors.md`, Session Expiration Message), and the form (Forms),
16 px apart. Another screen in this column, such as the error of the first
read of the signed-in user (Main Content), shows in the card in the same way.

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
- A value that the pinned contract does not list shows as received, in
  `fg`, 6 px after a hollow dot of 8 px with a 1 px edge in `neutral-icon`
  (`docs/behaviors.md`, Unknown Values).
- The severity of one CVSS assessment, by the scale of its version, is not
  the resolved severity (Sentinel `docs/features/tickets/cvss-scoring.md`,
  Core Distinctions; Version-Specific Assessment Severity), but it has the
  same values, and shows in the same way.

### Priority

The effective priority of a Ticket is `p1` to `p4`, or `null` while it is not
yet prioritizable: its priority override when one is set, and its automatic
priority otherwise (Sentinel `docs/features/tickets/ticket-priority.md`,
Priority Levels; Persistence and Effective Priority). Only P1 is red, so that
the Tickets to remediate at once stand out among many.

- P1 shows as a square mark of 14 px in `danger-solid` with an exclamation
  mark in `on-danger-solid`, followed, 6 px later, by "P1" in `fg` at weight
  600.
- P2, P3, and P4 show as a mark of 14 px of three rising bars, of which the
  first three, two, or one are filled in `fg-muted` and the others in
  `border`, followed, 6 px later, by the level in `fg-muted`.
- An effective priority that is an override, a Ticket whose
  `priority_override` is set, ends with `user-pen` at 14 px in `fg-muted`,
  4 px after the level, so that an override stands out among the automatic
  priorities, and assistive technologies read ", override" after the level,
  as "P1, override".
- `null` is an absent value. A value that the pinned contract does not list
  shows as received, in `fg`, without a mark.

The marks, in a box of 14 by 14 units:

| Mark | Shapes |
|---|---|
| P1 | A square from (0, 0) to (14, 14) with a corner radius of 3; a line from (7, 3.2) to (7, 7.6), 1.8 wide with round ends; a dot of radius 1 at (7, 10.4) |
| Bars | Three bars 3 wide with a corner radius of 0.8, standing on the line y = 13: at x = 1, 4 high; at x = 5.5, 7.5 high; at x = 10, 11 high |

**Explanation.** Where a screen document gives the priority of a Ticket its
explanation, such as the Ticket list in its rows, the priority is a button
that opens the explanation in a popover. The explanation states whether the
effective priority is automatic or an override, what the automatic priority
is based on, and who set an override and when, from the fields of the Ticket
alone: `priority`, `priority_automatic`, `priority_override`,
`priority_override_by`, `priority_override_at`, and
`priority_automatic_basis` (Sentinel `docs/features/tickets/tickets.md`,
PriorityBasis; PriorityEvidence; TicketSummary; Sentinel
`docs/features/tickets/ticket-priority.md`, Persistence and Effective
Priority; Automatic Priority Basis; API Surface). It needs no copy of the
Decision Table or of the threshold of the EPSS percentile, which Sentinel
states for itself. Who set an override and when lets the reader judge
whether it still holds, such as an override set before the evidence that
raised the automatic priority, which an override hides without an audit
event (Sentinel `docs/features/tickets/ticket-priority.md`,
`refresh_priority_auto()`).

- The priority shows as above in a box 24 px high and at least 24 px wide,
  with 4 px of side padding and a 4 px radius, on `neutral-soft` while the
  pointer is over the button and while the popover is open, with the focus
  ring around the box. A click, a tap, Enter, or Space on the button opens the
  popover, so that it works on a touch screen too, and the popover stays until
  the user closes it. The button is the box, except in a table, where it is
  the whole cell of the priority, so that the cell, which takes the focus in
  turn as the arrow keys move in the table, holds no smaller target beside it
  (WCAG 2.2, 2.5.8 Target Size (Minimum)).
- The popover (Menus, Popovers, and Tooltips) is 288 px wide, with 16 px of
  padding, in `text-14`. It opens below the priority, aligned to its start,
  or above it where the window has no room below, and moves toward the start
  where it would pass the end of the window; its content scrolls within it in
  a window shorter than it is. It holds no control: it takes the focus itself
  as it opens, with the focus ring around its content on keyboard focus
  (Focus and Motion), and assistive technologies read it by its title. While
  it is open, the rest of the page is out of reach of the keyboard and of
  assistive technologies. Escape or a click outside closes it, a click
  without acting on what it hits, and either way the focus returns to the
  priority (`docs/behaviors.md`, Accessibility, Dialogs). From top to bottom,
  it holds:
  1. its title, which names it: the effective priority as above, without the
     icon of an override, followed by "· automatic" or "· override", such as
     "P1 · override", in `text-16`, weight 600, which assistive technologies
     read as "P1, override"; or "Not yet prioritizable" for `null`;
  2. a `border` line, 12 px below the title and 12 px above the sections;
  3. the section of the basis, "Based on" for an automatic priority and
     "Automatic priority" for an override, with its heading in `text-12`,
     weight 500, `fg-muted`, and its lines 4 px apart: for an override, the
     automatic priority as above, P1 in red included, so that the P1 that an
     override hides stands out, or "Not yet prioritizable" for `null`; then
     "Severity" in `fg-muted`, followed by the severity of the basis as
     Severity shows it; then "Exploitation" in `fg-muted`, followed by the
     exploitation level: KEV, Active, Likely, or Unknown;
  4. 12 px below, the section "Evidence", in the same style: a line for each
     piece of deciding evidence, in the order of the basis, "Listed in CISA
     KEV on 9 Oct 2026" with the date of the entry (`docs/behaviors.md`,
     Dates and Times, Display), "SSVC exploitation PoC" or "SSVC exploitation
     Active", and "EPSS percentile 0.97", the percentile cut to two decimals,
     so that it never shows more than its value. Without evidence, the line
     "No evidence." in `fg-muted` (Empty States); and
  5. for an override, a `border` line 12 px below the evidence and, 12 px
     below the line, two lines 4 px apart in `text-13` that state who set it
     and when, as Sentinel records them (Sentinel
     `docs/features/tickets/ticket-priority.md`, Persistence and Effective
     Priority): "Override set by" in `fg-muted`, followed by the user in the
     name form, without the username, its name wrapping instead of ending
     with an ellipsis, since nothing else in the explanation shows it whole
     (Representation of a User); and "Override set on" in `fg-muted`,
     followed by the date and time at which they set it (`docs/behaviors.md`,
     Dates and Times, Display). The name and the date are in `fg`, except an
     inactive user's name, and each value starts after its label, aligned
     with it on its first line, and wraps in the room that the label leaves,
     so that the label stays whole. They come last, as details of the
     override rather than of what the priority is based on, right below the
     evidence, such as the date of a CISA KEV entry, with which the reader
     compares them; their labels name the override, since the title is far
     above them. The user is the setter's current profile, so a user
     deactivated since shows as inactive (Sentinel `docs/api-spec.md`, User
     References in Responses). A value that is absent shows as an absent
     value, never as "System": no system task sets an override (Sentinel
     `docs/features/tickets/ticket-priority.md`, Manual Override;
     `docs/behaviors.md`, Absent Values; Representation of a User). An
     automatic priority has neither the line nor the two lines.
- An exploitation level or an SSVC value that the pinned contract does not
  list shows as received, as a level and a severity do (above; Severity), and
  a piece of evidence of a kind that it does not list shows its kind as
  received, without its value, whose meaning depends on the kind
  (`docs/behaviors.md`, Unknown Values).

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
| New | A circle of radius 6.25, drawn as eight dashes of equal length with round ends, centered on the axes and the diagonals, with gaps of 1.9 between their ends |
| Analysis | A circle of radius 6.25, and the right half of a disc of radius 3.5: the path `M8 8V4.5A3.5 3.5 0 0 1 8 11.5Z` |
| Analyzed | A circle of radius 6.25, and three quarters of a disc of radius 3.5, without its upper-left quarter: the path `M8 8V4.5A3.5 3.5 0 1 1 4.5 8Z` |
| Resolved | A disc of radius 7, and a check: the path `M4.9 8.2 7 10.2l4.1-4.3` |
| Ignored | A disc of radius 7, and a slash: the path `M5.2 10.8 10.8 5.2` |
| Duplicated | A disc of radius 7, and an arrow to the right: the path `M4.6 8h6.1M8.4 5.6 10.8 8l-2.4 2.4` |

A status that the pinned contract does not list shows as received, in `fg`,
6 px after `circle-question-mark` at 16 px in `neutral-icon`.

### Deadline Badge

`docs/behaviors.md` (Deadlines) defines the badge, its text, and its color.
It is 24 px high, with a 4 px radius and 8 px of side padding, in `text-13`,
weight 500, with tabular figures: the name of the deadline, a space, and the
days. It is green as the `success` tone, yellow as the `warning` tone, and
red as the `danger` tone, with `clock-alert` at 12 px in the color of its
text, 4 px before the name of the deadline. A current phase that the pinned
contract does not list shows in the same shape in the `neutral` tone,
without an icon. Another due date with an overdue milestone status shows
`clock-alert` at 14 px in `danger-icon` before its state
(`docs/behaviors.md`, Deadlines).

### Track Milestones

The milestones of a track, its four phases in their order, Triage,
Submission, UM, and QA, each with its status (Sentinel
`docs/features/tickets/ticket-deadlines.md`, Actors and Phases; Track
Milestones), show as a pipeline: the icon of the status of each phase at
16 px, centered in a round box of 22 px, the boxes joined by lines of 1 px in
`border-strong`, 6 px long.

| Status | Icon |
|---|---|
| `done` | `circle-check` in `success-icon` |
| `overdue` | `clock-alert` in `danger-icon` |
| `pending` | `circle` in `neutral-icon` |
| `not_applicable` | `circle-minus` in `neutral-icon` |
| `null`, on a track with due dates: a phase that Sentinel does not observe for the track | `circle-dashed` in `neutral-icon` |
| A value that the pinned contract does not list | `circle-question-mark` in `neutral-icon` |

- A track without due dates, whose Ticket has no SLA, such as an Ignored or
  Duplicated Ticket, has every milestone `null` and shows no pipeline (same
  document, Null Due Dates; Track Milestones).
- The box of the current phase of the track, its `current_phase`, is in the
  soft background of its tone: `danger-soft` when the phase is overdue, and
  `info-soft` otherwise, where its `circle` is in `info-icon`.
- The pipeline is one button, at least 24 px high, with 4 px of side padding
  and a 4 px radius, on `neutral-soft` under the pointer and while its
  popover is open, with the focus ring around it. Its icons and lines are
  hidden from assistive technologies, and its accessible name states the
  package, the track, and the state of each phase, as Phases words them, such
  as "Phases of fictional-openssl, SUSE:FLES-15-SP7:Update: Triage done;
  Submission overdue by 2 days, current; UM due in 3 days; QA due in 10
  days".
- A click, a tap, Enter, or Space opens Phases, a popover 320 px wide, with
  16 px of padding, in `text-14`, that opens and closes as the explanation of
  a priority does (Priority, Explanation): it takes the focus itself, Escape
  or a click outside closes it, and the focus returns to the pipeline. Its
  title, "Phases", in `text-16`, weight 600, is followed by a `border` line
  with 12 px of space above and below it, then a line for each phase, 10 px
  apart: the icon of its status, as in the pipeline, then, 8 px later, the
  name of the phase, at weight 600 for the current one, followed by " · " and
  its actor in `fg-muted`: Vulnerability analyst, Maintainer, Maintenance
  update team, or QA (same document, Actors and Phases); below the name, in
  `text-13`, the state of the phase in the words of `docs/behaviors.md`
  (Deadlines), in `danger-on-soft` at weight 500 when it is overdue and in
  `fg-muted` otherwise, followed, for a phase with a due date, by " · due "
  and its date and time (`docs/behaviors.md`, Dates and Times, Display). The
  icon of the status starts the line, so the state takes no icon of its own
  (Deadline Badge). A status that the pinned contract does not list shows as
  received (`docs/behaviors.md`, Unknown Values).
- A screen document states where the pipeline shows, and what more Phases
  holds, such as the requests that a track has in a phase.

### Confidential Tickets

A confidential Ticket shows `lock` at 14 px in `fg-muted`, 4 px after its
identifier, with the accessible name "Confidential". On its own detail
screen, the heading row follows the lock with the label Confidential
(Labels), which assistive technologies read in place of the name of the lock.

### Labels

- A label names a short state or kind beside a value or a name: Inactive and
  Bot after the name of a user (Representation of a User), Confidential after
  the lock of a confidential Ticket in the heading row of its detail screen
  (Confidential Tickets), and, as a screen document states them, such as
  Excluded, EOL, Disabled, Not eligible, or a type of a CNA. It is in
  `text-12`, weight 500, `fg-muted`, with a 1 px `border-strong` boundary, a
  4 px radius, and 4 px of side padding, 6 px after what it follows; a second
  label follows the first, 6 px later. Its text carries its meaning, and
  assistive technologies read it as text.
- A label that tells the signed-in user that a record waits for them, such as
  the label of a track of a package tree that waits for their submission
  (`docs/screen-map.md`, Areas and Screens), is 20 px high, in `text-12`,
  weight 500, `info-on-soft` on `info-soft`, without a boundary, with 6 px of
  side padding and a 4 px radius; its record has a bar of 3 px in `link` along
  its left edge, as the current entry of the sidebar has (Sidebar).

### Other Values

- Every other value of a response enum shows as its name, in `fg`, without a
  mark (`docs/behaviors.md`, Domain Terms).
- A screen document that marks the values of another enum, such as the status
  of a fetcher run, gives each value the tone of its meaning (Tones) and shows
  it as Severity does: a dot of 8 px in its `{tone}-icon` followed by its
  name. A value that the pinned contract does not list shows as Severity
  shows one (`docs/behaviors.md`, Unknown Values). Red, the `danger` tone, is
  kept for failure, lateness, and errors (Principles). A value that names an
  operation in progress, which the screen follows by reading it again, such
  as the `pending` fetch of a source of a CVE, has the `info` tone and shows
  `loader-circle` at 12 px in `info-icon`, turning, in place of its dot
  (Focus and Motion). A value that names an observation never made, such as
  the `not_attempted` status of a source, shows `circle-dashed` at 12 px in
  `neutral-icon` in place of its dot, as a phase that Sentinel does not
  observe does (Track Milestones), so that it is not taken for a value that
  the pinned contract does not list.
- An absent value shows as an en dash, "–", in `fg-muted`, read as "Not
  set", or as the word that names the absence precisely, also in `fg-muted`
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
| Danger | `danger-solid` fill, `on-danger-solid` text, `danger-solid-hover` under the pointer | The button that confirms an action that cannot be undone, that ends another person's access, or that discards input (`docs/behaviors.md`, Confirmation); a confirmed change of a fetcher uses Primary |
| Icon | A quiet button with an icon alone, named by its accessible name and its tooltip | Compact actions, such as dismiss and the sidebar buttons |

- Buttons have a 6 px radius, 12 px of side padding, or 16 px at a height
  of 40 px, their label at weight 500, and their icon at 16 px before the
  label; Next has its chevron after it, and so has a button that opens a
  menu, such as Actions, its `chevron-down`. They are 32 px high in the toolbar
  and pagination of a list and in the heading of a part of a detail screen
  (Detail Screens), 40 px in forms and dialogs, and 36 px elsewhere, such as
  in the heading row of a screen, in an empty state, and as Try again, unless
  a pattern states its own height.
- A disabled button shows at 60 % opacity. A busy button shows
  `loader-circle` in place of its icon, or before its label, keeps its label,
  and cannot be pressed (`docs/behaviors.md`, Loading).
- A link is in `link`, except a link to a user (Representation of a User).
  In running text it is underlined; in a table or a list, where it is an
  identifier, a name, or an address, it is underlined under the pointer and
  on focus.
- A link to another site (`docs/behaviors.md`, Links to Other Sites) ends
  with `external-link`, 4 px after its text, in `link`, at the size of an
  icon beside that text (Icon Set), such as 14 px in a table. The icon is
  hidden from assistive technologies, because the accessible name of the link
  states that it leads to another site, and it stays on the line of the last
  characters of the text when the text wraps. An address longer than its
  place follows Main Content and Tables.

### Lists

A list screen, such as the Ticket list, shows from top to bottom:

1. The heading row (Main Content): the heading; its companions, 16 px after
   it, such as the counts of the attention summary as links 32 px high and
   8 px apart, on `surface` with a `border` line and a 6 px radius, each the
   number followed by its label in `text-14`, with `surface-hover` under the
   pointer; and the main action as a primary button, such as "Create
   Ticket". Counts of one kind can form a group after the others: a vertical
   line of 1 px in `border`, 20 px high, 12 px from what precedes and follows
   it, then the name of the group in `text-14`, `fg-muted`, 8 px before its
   counts, such as "Overdue". Each count of the group shows only what sets it
   apart, such as "1 Triage". The line and the name are hidden from assistive
   technologies, which read the name of the group after the label of each
   count, as "1 Triage overdue". The group wraps to the next line as a whole,
   where its line stands 4 px after the start of the row, as the line of the
   views does (item 2), and its counts wrap after its name when it is wider
   than its line.
2. The toolbar, 16 px below: the views (`docs/screen-map.md`, Ticket List
   Views) as tabs 32 px high with a `border` line and a 6 px radius, each its
   label followed by its count; the selected tab has a `border-strong`
   boundary, the `neutral-soft` background, and its label at weight 600. The
   line of a group of counts (item 1), without a name, can set the views
   before it apart from the views after it, such as New and Unassigned from
   the other views of `docs/screen-map.md` (Ticket List Views). It is hidden
   from assistive technologies, which perceive the groups through the order
   of the tabs. When the toolbar wraps, it stays before the tab after it,
   also when that tab starts a row, where the line stands 4 px after the
   start of the row. A tab opens when the user clicks it or presses Enter or
   Space, not when the arrow keys move the focus to it. At the end of the
   toolbar come the search field, Filters, and, while a filter or a search
   applies, Clear filters. The tabs and the controls are 8 px apart. When the
   width runs short, the toolbar wraps one control at a time, the last first,
   and a row of controls keeps them at its end, so that a control that
   appears, such as Clear filters, moves no other control to another row.
   - The search field, 224 px wide and 32 px high (Forms), has the
     placeholder "Search {records}", such as "Search Tickets", which is also
     its accessible name, and takes at most the longest term that the API
     accepts. Enter applies the term that the user typed, without its
     surrounding whitespace, or removes the search when the field is empty.
     Its clear button, an icon button with `x` named "Clear search", and
     Escape empty the field and remove the search that applies. A typed term
     that is not applied returns to the applied one when the focus leaves the
     field.
   - Filters is a secondary button 32 px high with `list-filter`. While
     filters apply, their number follows its label in `fg-muted`, which
     assistive technologies read as "2 applied". It opens below it, aligned
     to its end, a popover named "Filters", at most 448 px wide (Menus,
     Popovers, and Tooltips), with the filter fields 16 px apart. Its first
     field takes the focus as it opens, and its content scrolls within it in
     a window shorter than it is. Escape or a click outside closes it, and the
     focus returns to Filters (`docs/behaviors.md`, Accessibility, Dialogs).
     While it is open, the rest of the page is out of reach of assistive
     technologies, so it announces in a status region of its own what the
     list shows after a change, as the list does after a change of its state
     (`docs/behaviors.md`, Accessibility, Focus after a navigation), or what
     the place of the data says of the failure of its read.
   - A filter applies as soon as its field changes; a combobox, when the user
     chooses an option; and a field that the user types into, such as a text
     or a date field, when the user presses Enter, which in either field of a
     range, such as two dates, applies both. A typed value that is not applied
     returns to the applied one when the focus leaves its field, or, for a
     range, both of its fields. A filter whose values the contract lists, such
     as a status, is a group of checkboxes (Forms): its name in `text-12`,
     weight 500, `fg-muted`, and 4 px below it its checkboxes in a row that
     wraps, 16 px apart, each its box then, 6 px later, its label in
     `text-14`, the name of the value with its mark (Values).
   - Clear filters, a quiet button 32 px high with `x`, removes the search and
     the filters, and keeps the view and the sorting of the list.
3. The table (Tables), 16 px below.
4. The pagination, 16 px below, at the end of the line, when the list has
   more than one page: the range, such as "1–20 of 25", in `text-14` and
   `fg-muted`, then Previous and Next as secondary buttons 32 px high.
   Previous is disabled on the first page, and Next on the last. On a page
   beyond the last, the empty state takes the place of the rows and of the
   pagination (`docs/behaviors.md`, Empty States).

A change of the search, a filter, or the sorting of a list opens its first
page, as a new entry of the browser history (`docs/screen-map.md`, Browser
History); Previous, Next, and the link to the first page of an empty state
keep the search, the filters, and the sorting.

### Tables

- A table sits in a frame on `surface` with a `border` line and an 8 px
  radius, and scrolls horizontally within it when it is wider than its place
  (`docs/behaviors.md`, Accessibility).
- The header row is 36 px high, on `surface-2`, with the column names in
  `text-13`, weight 500, `fg-muted`. The sorted column shows `arrow-up` or
  `arrow-down` at 14 px after its name.
- The user sorts by a sortable column, which the screen document names, by
  pressing its header, with a click, Enter, or Space. Pressing the header of
  another column sorts by it in its first direction, which the screen
  document states; pressing the header of the column that sorts the rows,
  the screen's default sorting included, reverses the direction. Under the
  pointer, a sortable header is on `surface-hover` with its name in `fg`.
  Assistive technologies read whether and in which direction each sortable
  column sorts the rows.
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
  first, then, 6 px later, "+N", the number of the others, as a button 24 px
  high in `text-13`, weight 500, `neutral-on-soft` on `neutral-soft`, with a
  4 px radius. Its tooltip lists the values, one a line at weight 400, 4 px
  under their count at weight 600, such as "3 packages", so that the count is
  not taken for a value, and its accessible name states the others, such as
  "2 more packages: fictional-curl-mini, fictional-libcurl4". Each names at
  most 10 values, then how many more, such as "and 42 more", so that the
  tooltip of a record with many values fits in the window. The tooltip shows
  how many more as "…and 42 more", in `muted-on-fg` at weight 400 right under
  the values, so that it is not taken for a value either; the ellipsis is
  hidden from assistive technologies.
- A text longer than its column, such as a title, ends with an ellipsis when
  the screen of its record shows it whole, and assistive technologies read it
  whole; in a table whose records have no screen of their own, such as an
  audit log, it wraps, a user's name included, and its row grows.
- A user shows in the full form at the small size (Representation of a
  User).
- The actions on one row, such as Edit and Delete, are icon buttons of 24 px
  at the end of the row, 4 px apart, with their icon at 16 px in `fg-muted`,
  each named by its action and the record of its row, such as "Edit SUSE
  assessment v3.1", which its tooltip shows (Buttons and Links). They show
  only to a user who can take them (`docs/screen-map.md`, Roles), and Delete
  asks for confirmation (`docs/behaviors.md`, Confirmation).
- The loading indicator, an error in place of the data, and an empty state
  show inside the frame, below the header row. A table within a part of a
  detail screen whose rows come with the read of the part, without pages,
  filters, or sorting of their own, follows the part instead (Detail
  Screens): the loading indicator and an error show in place of the part,
  below its heading, and a part without items shows its short line without
  the table (Loading; Errors in Place of Content; `docs/behaviors.md`, Empty
  States).
- Rows have no colored marks other than those of their values.

### Timelines

The audit log of one record shows as a timeline where its screen document
states it, such as that of a Ticket; the other audit logs are tables
(Tables).

- The events show newest first, grouped by the day of their date in the time
  zone of the browser (`docs/behaviors.md`, Dates and Times, Display): each
  day a heading one level below the heading of the timeline's place, in
  `text-13`, weight 600, `fg-muted`, such as "8 Nov 2026", 16 px below the
  events of the day before, and its events a list 4 px below it.
- Each event is a row: its time, such as "14:10", in `text-13`, `fg-muted`,
  with tabular figures, at the end of a column of 48 px; 12 px later its
  marker, a round box of 24 px; 12 px later its sentence, which wraps. A
  vertical line of 2 px in `border` joins the markers of a day, behind them.
- The marker holds the icon of the kind of the event at 14 px, in `fg`, with
  a 1 px `border-strong` boundary on `surface`; the screen document chooses
  the icon of each kind and adds its row to Icons by Need, and a kind that
  the pinned contract does not list takes `circle-question-mark`. The marker
  is hidden from assistive technologies, which read the sentence.
- The sentence, in `text-14`, starts with its actor in the full form at the
  small size, the name at weight 500 (Representation of a User), and says
  what the actor did, such as "Alice Smith set fictional-zlib · fles-16.0 to
  Affected"; the screen document gives the sentence of each kind. A row has
  8 px of space above and below it.
- An event without an actor starts with System and the Sentinel mark
  (Representation of a User, No recorded actor), in `text-13` and `fg-muted`,
  with the boundary of its marker in `border` and its icon in `fg-muted`, and
  its row has 4 px of space above and below it, so that the actions of people
  stand out from their automatic consequences. An event of a kind that the
  pinned contract does not list shows its kind as received
  (`docs/behaviors.md`, Unknown Values).
- Above the timeline, the toolbar of a list without views: the search field,
  Filters, and Clear filters; below it, the pagination of a list (Lists).

### Detail Screens

- The heading row holds the identifier of the record as the level-one heading,
  followed on the same line by its main values, such as the status, severity,
  and priority of a Ticket, and ends with the screen's actions. The main
  values follow the identifier 16 px apart, the rows 8 px apart where the
  heading row wraps. No column header names them there, so each is named for
  assistive technologies by a term that does not show, such as Severity, and a
  value that is absent shows the word that the screen document gives it, such
  as "Severity not set", rather than a dash, or nothing where the screen
  document leaves it out, such as the CVE ID of a Ticket without a CVE
  (`docs/behaviors.md`, Absent Values). Several actions are one menu, Actions,
  a secondary button that opens them as a menu (Buttons and Links; Menus,
  Popovers, and Tooltips), shown to a user who can take at least one of them
  (`docs/screen-map.md`, Roles); an action that changes one field of the
  record's description list is the pencil of that field instead (below).
- A screen document can show the parts of a long record one at a time, as
  tabs at paths under the path of the screen (`docs/screen-map.md`, Areas and
  Screens). The tabs follow the heading row, 12 px below it, in a row with a
  `border` line across the width: each its label in `text-14`, `fg-muted`,
  40 px high with 8 px of side padding, 16 px apart; the selected tab is in
  `fg` at weight 600, over a bar of 2 px in `link` along its bottom edge, on
  the line. Where their place is too narrow, the tabs wrap, and the line runs
  under their last row. They show no count, and they show at once, also a tab
  whose content depends on the record, which then says in its place that the
  record has none (`docs/behaviors.md`, Loading; Empty States). They behave
  like the views of a list (Lists): a tab opens when the user clicks it or
  presses Enter or Space, not when the arrow keys move the focus to it, and
  the focus stays on it. Its content follows 24 px below the line, and a
  tab that the user opens shows the start of its content, below the compact
  heading where the page had scrolled past it.
- The fields of the record show as a description list: each term on the line
  of its value, in `text-13`, `fg-muted`, in a column of 104 px, 12 px before
  the value in `text-14`, `fg`, fields 8 px apart; where the list is narrower
  than 280 px, each term stands above its value. A group of fields under one
  term, such as the deadlines of a Ticket, has its term on a line of its own,
  then its fields 4 px apart, their terms in the style of the values, indented
  by 12 px in the column of the terms, or above their values, indented the
  same, where the list is narrower than 280 px. A popover that shows the
  details of a record uses the same list (Menus, Popovers, and Tooltips).
- A field that a user can change shows that user a pencil at the end of its
  line: an icon button of 24 px with `pencil` at 14 px, named by its action,
  such as "Edit assignee", which its tooltip shows. It opens the control of
  the field in a popover below it, or above it where the window has no room
  below, moved toward the start where it would pass the end of the window,
  such as a search field with the matching users listed below it, in
  the states of a combobox (Forms), whose choice applies at once and closes
  the popover; or a dialog where the change needs more than one choice
  (Dialogs). While the change is in progress, the pencil is busy
  (`docs/behaviors.md`, Loading).
- Each part of the record, such as the references of a Ticket, is a section
  on the background of the page, below a `border` line: its level-two heading
  in `text-16`, weight 600, 24 px below the line, with its actions at the end
  of the heading's line, and its content 16 px below the heading; the line of
  the next part is 32 px below the content, and the first part has no line of
  its own. A box within a part, such as a table or values set side by side,
  keeps its frame on `surface`, with a `border` line and the radius of its
  pattern, 6 or 8 px. A part without items shows its short line in `fg-muted`
  (`docs/behaviors.md`, Empty States).
- A group of items within a part, such as a package of a Ticket with its
  tracks, has no frame: its heading row is a band on `neutral-soft`, at least
  32 px high, with a 6 px radius and 12 px of side padding, which holds its
  level-three heading in `text-15`, weight 600, followed by its values and
  labels, and ends with its actions. Its items follow 12 px below the band,
  indented by the 12 px of its padding, and the band of the next group is
  32 px below them.
- A part that hides records, such as the excluded and EOL records of a
  package tree, shows them on request with a switch (Forms). A hidden record
  that shows, and every record within it, is in `fg-muted`, in its texts, its
  names that open a popover included, and, when it is a group, in the heading
  of its band, so that it reads apart from the records that count. A record
  whose own state hides it carries the label of each such state (Labels),
  such as Excluded or EOL, also when the record that holds it is hidden too;
  a record hidden only because of the record that holds it, or of the
  records that it holds, carries none. Its controls with colors of their own,
  such as a select or its menu of actions, keep them.
- A screen document can give a detail screen, or one of its tabs, a side
  column for the fields of the record and short parts, 288 px wide, 32 px
  after the main column, aligned with its top; another tab takes the whole
  width. The side column follows the main column in the order of the page
  (Main Content). Its sections have their level-two heading in `text-14`,
  weight 600, in a row at least 32 px high with their actions at its end,
  their content 10 px below, and a `border` line 16 px below their content
  and 16 px above the next section; the last section has no line.
- The two columns show while the main content, inside its space of 24 px, is
  at least 960 px wide, so that the main column keeps at least 640 px
  (Spacing and Sizes, Breakpoint). Narrower, the screen is one column, in the
  order that its screen document states, such as the fields of the record
  above the parts and the other sections of the side column below them, in
  that order in the page too (Main Content). In one column, each section of
  the side column keeps its look, at the width of the content, and each part
  keeps its own; a `border` line sets the sections of the side column apart
  from the parts above and below them, 16 px below a section's content and
  32 px below a part's content, and the heading of a part follows it 24 px
  below, as it follows the line of a part.
- When the layout changes while the screen is open, as the window, the text
  size, or the sidebar changes, a section whose place in the order of the
  page differs between the layouts, such as the details of a Ticket, moves
  to its new place. While a dialog of such a section is open, the layout
  waits until it closes, so that its input and a change in progress stay;
  the dialog fits the window meanwhile (Dialogs). A popover of such a section
  closes, as on a click outside it, and a control of the section whose
  change is in progress stays busy in its new place (`docs/behaviors.md`,
  Loading). When the element with the focus is in such a section, the focus
  moves to the screen's heading, which comes into view (`docs/behaviors.md`,
  Accessibility, Focus after an action); elsewhere it stays where it is, and
  the page keeps its scroll position as the browser adjusts it.
- With two columns, while the page scrolls, the side column stays at the top
  of its place, 24 px below the message area and the compact heading, as it
  starts 24 px below the line of the tabs, until the end of the page comes
  into view, and then scrolls with the page to its own end, so that its first
  sections stay beside the parts. When an element of the side column that is
  out of view takes keyboard focus, or is the target of an anchor, the page
  scrolls until it shows, which for the last sections of a side column
  taller than the window can be the end of the page; a pointer that focuses
  the control that it presses leaves the page where it is, so that the press
  ends on the control. With one column, the side column scrolls with the
  page.
- On a screen with a side column, while the main content is wide enough for
  two columns, on each of its tabs, also one that takes the whole width, the
  heading row stays at the top of the window once the page has scrolled it
  there, below the message area, as the compact heading, on `surface` above a
  `border` line across the width, without a shadow (Spacing and Sizes,
  Shadows): 10 px of space, the level-one heading in `text-16` with the main
  values, and the actions as buttons 32 px high, then right below them the
  tabs, 36 px high. Its place in the page keeps the
  height of the heading row and the tabs, so that the content does not move
  when the heading becomes compact or returns. It is the heading row itself,
  not a copy, so the screen keeps one level-one heading, one set of tabs, and
  one menu of actions. Narrower, the heading row scrolls with the page, so
  that a fixed heading takes no room from a narrow window
  (`docs/behaviors.md`, Accessibility, Reflow and text size).

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
- A switch turns a choice of a screen on or off at once, outside a form, such
  as showing the hidden records of a part: a rail 28 by 16 px, round, with a
  1 px `border-strong` boundary on `neutral-soft` and a knob of 12 px in
  `fg-muted` at its start; on, the rail is `accent`, its boundary too, and
  the knob is in `on-accent` at its end. Its label follows 6 px later, in
  `text-13`, `fg-muted`, and the switch with its label is the target, at
  least 24 px high. Disabled, it shows at 60 % opacity. Assistive technologies
  read it as a switch, on or off. A choice that a user returns to with the
  URL, such as showing the hidden records, is in the URL
  (`docs/screen-map.md`, Browser History).

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
- When data stays shown after a new read of it failed, or after a read that
  only adds marks to it failed, a `warning` message above the data says that
  it could not be updated, or what could not be shown or updated, followed
  8 px below by Try again as a secondary button when the failure offers it
  (`docs/behaviors.md`, Where Errors Appear). The button stands outside the
  message, on the background of the screen or of its part, against which its
  boundary keeps its contrast (Contrast Table).

### Loading

- The loading indicator is `loader-circle` at 18 px in `fg-muted`, turning,
  followed by "Loading" in `fg-muted`, centered in the place of the part that
  waits (`docs/behaviors.md`, Loading). As the UI loads, before it shows any
  screen, the indicator is centered in the window, without the sidebar
  (`docs/behaviors.md`, Session State).
- Data that stays shown while other data loads, or while it is read again
  after a read of it failed, is marked by a progress bar, 2 px high in
  `accent`, running along the top edge of its frame or part; the data itself
  does not change its appearance.

### Empty States

- An empty list shows, in place of the rows and inside the table's frame, its
  message (`docs/behaviors.md`, Empty States) in `fg`, centered, with 40 px of
  space above and below, and its action below it as a secondary button, such
  as "Create Ticket" with `plus` or "Clear filters" with `x`.
- A part of a screen without items shows its short line in `fg-muted`.

### Errors in Place of Content

- An error in place of the content of a screen shows below the message area:
  the level-one heading that names the error, its message in `fg-muted`, the
  reference of the error when it has one, and its action, Try again or Reload
  page as a secondary button, or a link to the landing, aligned to the start
  and at most 560 px wide (`docs/behaviors.md`, Default Presentation by
  Status).
- An error in place of a part shows the same inside the part, below its
  heading, without a heading of its own.

### Menus, Popovers, and Tooltips

- A menu or a popover is on `surface`, with a `border` line, an 8 px radius,
  a shadow, and 4 px of padding, or 16 px for a popover that holds fields,
  such as that of Filters (Lists). A menu item is 36 px high with a 6 px radius
  and 10 px of side padding, its icon at 16 px in `fg-muted` before its label
  in `text-15`, and `surface-hover` under the pointer and on focus, with the
  focus ring inside it on keyboard focus (Focus and Motion). The
  heading of a section is in `text-12`, weight 500, `fg-muted`; groups are
  separated by `border` lines; and an item of a single selection ends with
  `check` at 16 px when it is selected.
- A tooltip inverts the colors of text: `surface` on an `fg` background, in
  `text-13`, weight 500, with a 6 px radius and 6 px by 10 px of padding; how
  many more values a "+N" has than its tooltip lists is in `muted-on-fg`
  (Tables). It shows after 300 ms of hover and at once on keyboard focus,
  stays while the pointer is over it, and Escape hides it (WCAG 2.2, 1.4.13
  Content on Hover or Focus). It names an icon alone or a compact avatar that
  does not link to the user (one that does shows the user card instead;
  Representation of a User), or lists the values of a "+N" (Tables); it never
  holds the only means to act.
- A name that opens a popover with the details of its record, and with the
  record's actions for a user who can take them, such as a Product of a
  package tree or the CNA of a CVE, is a button in the style of the text
  around it, with a dotted underline in `border-strong` 3 px below it, in
  `fg` under the pointer; it wraps, and its target is at least 24 px high.
  Its popover is 320 px wide, with 16 px of padding, in `text-14`, below the
  name and aligned to its start, or above it where the window has no room
  below, moved toward the start where it would pass the end of the window,
  and its content scrolls within it in a window shorter than it is:
  its title, the name, in `text-16`, weight 600, wrapping; below it, in
  `text-13`, `fg-muted`, what identifies the record further, such as a CPE; a
  `border` line with 12 px of space above and below it; the details as a
  description list (Detail Screens); and, with actions, another such line and
  the actions as menu items. Details that the popover reads as it first
  opens, such as those of a CNA, load and fail as those of the user card do
  (`docs/behaviors.md`, Representation of a User, User card), with the
  loading indicator (Loading) or the line of the failure in `fg-muted` in
  their place. The popover takes the focus itself as it opens
  (`docs/behaviors.md`, Accessibility, Dialogs); Tab reaches its actions,
  and the rest of the page is out of reach while it is open. Escape or a
  click outside closes it and returns the focus to the name, except while
  one of its actions is in progress, which marks its item busy
  (`docs/behaviors.md`, Loading); the action then closes the popover, with
  the focus on the name, or where Focus after an action leads when the name
  is gone (`docs/behaviors.md`, Accessibility), and its outcome shows as
  that of any other change (`docs/behaviors.md`, Where Errors Appear;
  Outcome of a Change).

## Representation of a User

`docs/behaviors.md` (Representation of a User) defines what shows for a user.
This section defines the dimensions of its three sizes, where each is used,
where the labels show, a group of users, and the user card.

| Size | Avatar | Use |
|---|---|---|
| Small | 24 px | Text, table rows, and the options of a field |
| Medium | 32 px | Other lists of users, such as the access grants of a Ticket, a group of users, the account button, and the account menu |
| Large | 64 px | The heading of a user's screen, and the user card |

- **Full form:** the avatar, 6 px of space, and the display name in the
  surrounding text's style; where the username follows, as `@` and the
  username (`docs/behaviors.md`, Representation of a User), it comes after a
  space, in `fg-muted` at weight 400, or, in the account menu, on a line of
  its own below the name and its labels (Account Menu). The `@` sets it
  apart from the name without relying on color, also for an inactive user,
  whose name is in `fg-muted` too.
- **Inactive and Bot:** the label (Labels) follows the name, or the username
  where it follows the name. An inactive user's name is in `fg-muted`, and
  its avatar is gray (Avatar). Where the place is too narrow, only the name,
  with the username that follows it, ends with an ellipsis, unless a table,
  the account menu, the user card, or the explanation of a priority wraps it
  (Tables; Account Menu; User card; Priority, Explanation); the labels always
  show.
- **Compact form:** the avatar alone in its control, with the tooltip of its
  name, or the user card where it links to the user.
- **Group of users:** the users of a group, such as the participants of a
  Ticket, in the compact form at the medium size, 6 px apart, in rows that
  wrap, every user shown. The group is named by its heading and is one stop
  of the Tab key, within which the arrow keys move from user to user; each
  user takes the focus and shows its tooltip, or the user card where it links
  to the user (`docs/behaviors.md`, Representation of a User).
- **Name form:** the full form without the avatar and the 6 px of space after
  it; it has no size, since the sizes are those of the avatar.
- **Link:** a user that links to their screen (`docs/behaviors.md`,
  Representation of a User) keeps the colors of the full form, unlike the
  other links (Buttons and Links): its name is in the surrounding text's
  color, or in `fg-muted` for an inactive user, and is underlined under the
  pointer and on focus, and always in running text, as every link there is.
  A list or a table shows many users, whose names in `link` would compete
  with the identifiers that lead to the records, and the color of an inactive
  user's name is part of its state. A user who is the record of a row, as in
  the list of Users, is the identifier of the row instead, and follows Tables:
  the name is in `link` at weight 500, also for an inactive user, whose label
  and gray avatar show the state.
- **User card:** a popover (Menus, Popovers, and Tooltips), 288 px wide with
  16 px of padding, below the link and aligned to its start, or above it
  where the window has no room below, and moved toward the start where it
  would pass the end of the window. It holds the avatar at the large size
  and, 12 px after it, the display name in `text-16`, weight 600, the username
  below it as `@` and the username in `text-14`, `fg-muted`, and the labels
  below that, the name and the username wrapping instead of ending with an
  ellipsis, so that the card shows them whole; then a `border` line 12 px
  below, and 12 px below the line the roles, separated by commas, and below
  them the email, in `text-14`, the roles in `fg` and the email in
  `fg-muted`. While the directory entry loads, the loading indicator
  (Loading) takes the place of the roles and the email, and its failure line,
  in `fg-muted`, does when the read fails. The card shows after 300 ms of
  hover or of keyboard focus on the link, so that a pointer or a focus that
  passes over many users opens none, and at once after a long press, which
  moves the focus into it (`docs/behaviors.md`, Representation of a User). It
  stays while the pointer is over the link or the card or the focus is in
  either, hides 300 ms after the pointer and the focus have left both, such as
  on a tap elsewhere, and hides at once on Escape (WCAG 2.2, 1.4.13 Content on
  Hover or Focus).
- **No recorded actor:** a square of the avatar's size, on `neutral-soft`
  with a corner radius of 20 %, holding the Sentinel mark (Sentinel Mark) at
  70 % of that size in `neutral-on-soft`, then, 6 px later, "System" in the
  surrounding text's style. It is square like the avatar of a bot account,
  because neither stands for a person, and differs from it by the Sentinel
  mark in place of the cells (Avatar).

## Avatar

The avatar is a square picture that the UI generates from the user's `id`,
which is stable and never changes (Sentinel `docs/api-spec.md`, User
References in Responses), in the colors that the user's `bot` and `active`
select. The definition is exact, so that any implementation, in any
language, draws the same picture.

The UI shows the picture through a shape, as a mask that hides what lies
outside it: for a person, a circle that touches the sides of the square,
which hides part of the cells in the corners; for a bot account, the square
with its corners rounded at 20 % of its size. The shape belongs to how the UI
shows the picture, not to its definition.

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
   select the color of the Palette by its index. Bit 15 is not used. The
   avatar of an inactive user, whose `active` is `false`, takes the gray of
   the Palette instead, whatever the index.
5. **Drawing:** a square of 6 by 6 units, and for each filled cell a square
   of 1 by 1 unit at `(0.5 + column, 0.5 + row)`; the filled cells form one
   shape, so that no seam shows between neighbors at any size. For a person,
   the square is filled with `#F0F0F0` and the cells with the color; for a
   bot account, whose `bot` is `true`, the colors are inverted: the square
   takes the color and the cells `#F0F0F0`. The picture has no border and is
   the same in both themes; it scales to the size of its use, and until it is
   drawn its place stays empty at that size.

The `id` is the input because it never changes: a username and an email
address can change, and a digest of an email address could identify its user
elsewhere. The digest spreads every bit of the `id` over the pattern, so that
ids that share their leading characters, as time-ordered ids created together
do, still look different. SHA-256 is available in the browser's Web Crypto
API in the secure contexts in which the UI runs and in the standard library
of most languages.

A bot account differs from a person by two cues that do not depend on hue,
its shape and its lightness, in both themes and at every size. The shape
alone would not suffice: `#F0F0F0` differs little from the page and the
surfaces of the light theme, where the outline of a person's avatar shows
only through its cells. The gray of an inactive user shows the state on the
avatar itself, also where no label follows it (`docs/behaviors.md`,
Representation of a User), and a bot account keeps its shape.

### Palette

| Index | Color | Contrast with `#F0F0F0` |
|---|---|---|
| 0 | `#65730F` | 4.59 |
| 1 | `#C2410C` | 4.54 |
| 2 | `#A16207` | 4.32 |
| 3 | `#15803D` | 4.40 |
| 4 | `#0F766E` | 4.80 |
| 5 | `#0369A1` | 5.20 |
| 6 | `#4338CA` | 6.93 |
| 7 | `#A21CAF` | 5.54 |
| Gray, for an inactive user | `#6E6E6E` | 4.47 |

Every color has a contrast of at least 3:1 with `#F0F0F0` (WCAG 2.2, 1.4.11
Non-text Contrast), also in the picture of a bot account, which swaps the
two. The Palette has no red, which is kept for what needs attention at once
(Principles): the square of a bot account in red would look like the P1
mark. The colors and `#F0F0F0` are tokens, `avatar-0` to `avatar-7`,
`avatar-inactive`, and `avatar-bg`, with one value for both themes.

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

The colors of vector 1 for each kind of user, whose cells stay the same:

| User | Square | Cells |
|---|---|---|
| A person | `#F0F0F0` | `#A21CAF`, color 7 |
| A bot account | `#A21CAF` | `#F0F0F0` |
| An inactive person | `#F0F0F0` | `#6E6E6E` |
| An inactive bot account | `#6E6E6E` | `#F0F0F0` |

An implementation is correct when it gives these cells and colors for every
vector, the mirrored grids above, and these colors for each kind of user.

## Open Decisions

No decision is open. A decision that is not taken yet is listed here, with who
takes it, and every design that depends on it waits for it.
