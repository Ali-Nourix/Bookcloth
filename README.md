# Bookcloth

A quiet, warm theme for Obsidian. Paper-coloured light mode, ink-coloured dark
mode, and a single accent colour that the entire interface derives its tints
from. Minimal in what it draws, not in what it covers.

![Bookcloth in light mode](screenshot.png)

![Bookcloth in dark mode](screenshot-dark.png)

## Install

1. Copy the `Bookcloth` folder into `YourVault/.obsidian/themes/`.
2. Obsidian → Settings → Appearance → Themes → **Bookcloth**.

Only `theme.css` and `manifest.json` are needed at runtime. Everything else is
source, documentation or development tooling.

**Recommended companion:** the community plugin **Style Settings**. Bookcloth
is complete without it; with it you get fifty-five controls covering colour,
type, shape, density, icons, panel layout and plugin support.

## Floating panels

Every region — ribbon, both sidebars, the editor — sits as its own rounded
surface on a backdrop that is deliberately darker than the panels themselves.
The gap only reads as a gap if the thing behind it is darker, so the two are
set together: **Gap between panels** and **Backdrop behind the panels** are
adjacent controls, and moving one usually means moving the other.

The gap is applied to the container, not as margins on the panels, so the space
between two panels is the same as the space at the window edge instead of
double it.

Every scrolling pane reserves room at its foot. The status bar floats over the
bottom of whatever is beneath it, and without that reserve the last item in a
sidebar list sits underneath it and is read as cut off — which it is. Only the
block end is padded; giving plugin panes horizontal padding is how a theme
breaks the ones that lay out their own.

Corners are painted onto the panels rather than clipped with `overflow: hidden`.
Clipping would swallow anything a sidebar plugin renders past its own edge —
date pickers, colour swatches, drag previews.

**Flush panels** in Style Settings returns to Obsidian's edge-to-edge layout.
Mobile is always flush: on a phone the panel is the whole screen and a gap would
only eat into it.

## The accent

Set it in **Settings → Appearance → Accent color**. That is the real control —
Obsidian writes your choice to `--accent-h/s/l` and Bookcloth builds a nine-step
ramp plus six alpha washes from those three numbers. Links, the caret, the
active file row, the selected tab, checkboxes, selection, tag pills, search
matches, the focused graph node and every filled button move together.

Two things happen automatically:

- **Dark mode lifts the hue.** The same choice is rendered eight points lighter
  and slightly desaturated on dark ground, so one pick reads correctly in both
  modes without setting a second colour.
- **Filled controls step down in light mode.** Buttons and toggles use one step
  darker than the base so white label text stays above 4.5:1 whatever hue you
  pick.

Chrome is neutral by default. In Notion and Slite the selected page in the
sidebar is a plain grey slab with ordinary dark text, and colouring it is what
makes a sidebar start looking like a dashboard — so the accent is kept for
links, the caret, checkboxes and focus, where it carries meaning. **Accent
intensity → Vivid** washes the accent back through the chrome, tabs and tags;
**Subtle** drops the selected row to a whisper.

## Settings

| Group | What's in it |
| --- | --- |
| Accent | Accent override, intensity, neutral warmth, accent headings |
| Surfaces | Editor / sidebar / raised / sunken backgrounds, border strength |
| Text colours | Body, muted and faint ink, separately per theme |
| Semantic colours | All eight hues — red through pink — separately per theme |
| Typography | Interface / editor / mono font, serif body, heading scale and weight, line height, code size, link underline, Persian and Arabic support |
| Shape and density | Panel corner radius, interface rounding, icon button size, density, note width, panel gap, backdrop colour, flush panels, visible borders |
| Icons | Icon size, stroke weight |
| Interface | Tab style, hide status bar, hide ribbon, indentation guides |
| Editor | Callout style and colour strength, checkbox style, task fading, active line |
| Plugin support | Opt out of any of the bundled plugin styles |

Every plugin style is **on by default** and the toggles turn them off, so
nothing depends on having Style Settings installed. Turning every control off
still leaves a complete theme.

Semantic colours are authored as RGB triples, so one picker drives both the
solid colour and every wash derived from it — change Blue and the note callout,
the blue tag, the syntax token and the graph node all follow.

## The top band

Obsidian spreads the controls along the top of the window across four separate
containers: the ribbon column, the left sidebar's tab strip, the editor tab bar
and the right sidebar's tab strip. Each brings its own padding, so left alone
the sidebar-toggle button sits a few pixels above the tabs beside it and what
should be one row reads as three.

Bookcloth gives all four the same band padding and the same control height, so
every icon in that row shares one centre line. Measured rather than eyeballed:
ribbon action, both sidebar toggles, both sidebar tab strips, the editor tabs
and the new-tab button all return the same centre.

## Two radii, not one

Panels and interface elements are rounded on separate scales, because they are
different kinds of object. **Panel corner radius** is a card: sidebars, the
editor, modals and the command palette, at 10px by default. **Interface corner
rounding** scales the small stuff — rows, chips, buttons, inputs — which sits
around 4-5px. Notion and Slite both work in that range, and anything larger
turns a 28px sidebar row into a lozenge.

Every icon-only control is a square of a single size, set by **Icon button
size**. This matters more than it sounds: Obsidian's sidebar tabs are wider
than they are tall, so a rounded background on the tab slot itself reads as an
oval. Bookcloth moves the background onto a square inner element and centres
the icon in it, and applies the same square to ribbon actions, view actions and
plugin toolbar buttons — including Obsidian's sidebar-toggle button, which
lives in a different container from the actions below it and otherwise sits off
the column they share.

## Icons

Lucide is drawn on a 24-unit grid with a 2px stroke. Scale that artwork down
without adjusting the stroke and it goes spindly; scale it up and it goes
clumsy. Bookcloth pairs a stroke weight with every size rather than setting one
globally, so sidebar chevrons, tab glyphs, ribbon icons and callout markers all
read at the same visual weight even though they are different sizes.

Two sliders scale the whole set: **Icon size** and **Icon stroke weight**.
Pointer targets stay at least 24px square regardless.

The checkbox tick is drawn from Lucide's check at a weight that survives at
16px, positioned to sit optically rather than mathematically centred. Its shape
is set on the element for both options rather than leaving the square as "the
state with no rule", so a box set to square cannot be quietly rounded again by
anything else that touches the radius.

## Working with plugins

Plugins build their pane headers out of real `<button>` elements wrapping an
icon. A theme that gives every button a fill and a border turns each of those
into a box, and in a narrow sidebar header the boxes take every spare pixel
from the label beside them — Notebook Navigator's folder name collapses to one
letter and an ellipsis. Bookcloth excludes icon-only buttons from the boxed
treatment at the source, in the `:not()` chain, rather than trying to un-style
them afterwards, because a later rule would lose the specificity contest.

Pointer target minimums are enforced on touch only. Forcing a minimum square on
desktop is what widened those toolbar buttons in the first place.

The theme deliberately does not set padding on containers that plugins fill —
`.modal`, `.prompt`, `.menu`, `.suggestion-container`, `.setting-item`,
`.view-header`. It restyles their colour, radius and shadow and leaves layout
to Obsidian, because a theme that repads those boxes double-pads some plugin
dialogs and crops others.

For the same reason there is no `overflow: hidden` on the editor pane and no
blanket `[data-type] .view-content` rule. Clipping the pane swallows anything a
plugin renders outside its own bounds, and forcing a background onto every
registered pane breaks canvases, boards and embedded editors that paint their
own surface.

Bundled styles: Dataview, Tasks, Kanban, Calendar and Periodic Notes,
Excalidraw, Iconize, Editing Toolbar, Omnisearch, Highlightr, Style Settings.
Anything not on the list inherits the correct surface, ink and radius from the
variable layer.

## Persian and Arabic

Turn on **Typography → Persian / Arabic typography**. It puts Vazirmatn and
Estedad at the front of the font stacks, raises the leading to 1.85, and removes
the negative letter-spacing that Latin display type wants and Arabic script
does not.

Right-to-left support is not behind that toggle. Blockquotes, embeds, lists and
tables are written with logical properties, so they mirror on their own rather
than needing a second set of rules. Two cases genuinely need overriding and get
it: code runs left-to-right inside a right-to-left note — without that the bidi
algorithm reorders punctuation and a line of JavaScript comes out with its
semicolon at the wrong end — and inline Latin fragments are isolated so they
don't drag surrounding Persian out of order.

## Writing snippets against Bookcloth

The token layer is public:

```css
var(--bc-ac-50) … var(--bc-ac-800)          /* nine-step accent ramp */
var(--bc-ac-a03) … var(--bc-ac-a40)         /* transparent accent washes */

var(--bc-surface-raised)                    /* modals, menus, cards */
var(--bc-surface-sunken)                    /* code blocks, wells */
var(--bc-control-border)                    /* checkbox and quote rules */
var(--bc-select-bg) var(--bc-select-bg-strong) var(--bc-select-fg)
var(--bc-gap-1) … var(--bc-gap-6)           /* density-aware spacing */
```

All of them respond to the user's accent, theme and density settings.

## Building

Written as partials and concatenated, because Obsidian loads one stylesheet per
theme.

```bash
node build.mjs
```

Edit files in `src/`, never `theme.css`. Order is defined in `build.mjs`:
tokens → light → dark → accent → type → chrome → editor → components → views →
icons → panes → mobile → RTL → plugins.

For live work, symlink the folder into a vault and use the Hot Reload plugin:

```bash
ln -s "$(pwd)" /path/to/vault/.obsidian/themes/Bookcloth
```

`preview/` holds a browser harness that reproduces Obsidian's DOM so you can
look at changes — and take screenshots — without launching the app. See
`preview/README.md`.

## Accessibility

Measured against the default palette:

| | Light | Dark |
| --- | --- | --- |
| Body text | 17.5:1 | 12.6:1 |
| Muted text | 5.2:1 | 5.9:1 |
| Links | 4.8:1 | 5.9:1 |
| Button label on accent | 5.0:1 | 6.1:1 |
| Semantic hues (lowest of eight) | 4.6:1 | 5.8:1 |

Faint text — status bar, counts, section labels — sits at 3.3:1 light and 3.5:1
dark and carries non-essential information only. Focus rings are visible on
every interactive element, and `prefers-reduced-motion` is respected.

## Notes and limits

- No fonts are bundled or fetched. Bookcloth references families you may already
  have and falls back to system faces; the font fields in Style Settings take
  any family installed on your machine.
- No network requests, no `@import`. Works offline and on mobile.
- `!important` appears four times, all inside the reduced-motion block, where
  overriding inline animation timings is the point.
- Requires Obsidian 1.5 or later for `color-mix()`, which powers the neutral
  warmth control and the callout washes, and for `:has()`, which keeps icon
  buttons flat. If `:has()` were ever unavailable the rule drops out entirely
  and every button goes flat — degraded, not broken.

## License

MIT.
