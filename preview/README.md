# Preview harness

A way to look at the theme without opening Obsidian. `app-shim.css` is a
compact stand-in for Obsidian's `app.css`: same DOM structure, same variable
defaults, same layout rules. `theme.css` loads on top of it, so what you see is
the theme doing exactly what it would do in the app.

It is a development tool. Nothing here is loaded by Obsidian, and you can
delete the folder without affecting the theme.

## Pages

| File | What it shows |
| --- | --- |
| `index.html` | Full workspace: ribbon, both sidebars, tabs, a note with properties, tasks, callouts, code, a table |
| `overlays.html` | Command palette, context menu, settings modal, buttons, toggle, notice |
| `rtl.html` | Persian typography and right-to-left layout |
| `plugin-pane.html` | A dense plugin pane header, the case that breaks icon buttons |
| `controls.html` | Every control in the markup Obsidian and its plugins actually emit: icons wrapped one, two and three elements deep; a note's properties as real `<input>`s; a `<select>` that has to keep room for its own chevron |
| `checkboxes.html` | Every task state, in all four markups Obsidian emits for them |
| `callouts.html` | Every callout type Obsidian ships, plus one nested, one in Live Preview and two right-to-left |

Open any of them in a browser. Switch themes from the console:

```js
document.body.className = document.body.className.replace(/theme-\w+/, 'theme-dark')
```

## Setup

```bash
npm install playwright @fontsource/inter @fontsource/vazirmatn
npx playwright install chromium
```

No font files are bundled, so without the two `@fontsource` packages the
harness falls back to whatever your system has and the type will not match the
theme's intended stacks. Copy the faces it looks for into `fonts/`:

```bash
mkdir -p fonts
cp node_modules/@fontsource/inter/files/inter-latin-{400,500,600,700}-normal.woff2 fonts/
cp node_modules/@fontsource/inter/files/inter-latin-400-italic.woff2 fonts/
cp node_modules/@fontsource/vazirmatn/files/vazirmatn-arabic-{400,600}-normal.woff2 fonts/
```

## Tools

All Node, all run from this folder.

```bash
node shot.mjs light shot-light.png                       # screenshot
node shot.mjs dark  shot-dark.png overlays.html          # …a different page
node shot.mjs light float.png index.html "bc-float-panes bc-tabs-pill"
node shot-bottom.mjs dark                                # the foot of the pane, fade off and on
node crop.mjs full-dark.png out.png 400 740 700 160      # a region of a shot, to look at closely
node shot1x.mjs dark out.png callouts.html 1100 2100      # a whole page at 1:1, to look at rather than measure

node check.mjs           # every rule keeps a declaration, every declaration parses
node measure.mjs         # geometry of the controls that are meant to line up
node contrast.mjs        # the ratios the main README publishes
node invariants.mjs      # the assertions that hold on every page, in both modes
node check-settings.mjs  # the Style Settings block, against the plugin's own shapes
node fade-lab.mjs dark   # is the bottom fade a blur, or a cross-fade?
node cframe.mjs          # every callout frame, measured against its own fill
node float-lab.mjs dark  # what TaskPro's floating-board blur costs a frame, three ways
```

`fade-lab.mjs` is the one worth explaining. Contrast alone cannot tell a blur
from a cross-fade, because both lower it, so it reports `hf/sd` — the mean step
between neighbouring pixels over the contrast across the row — against the same
page with the fade off. That ratio is scale free: dim a row and it does not
move, blur a row and it collapses. 1.00 means the edges are as crisp as they
were and the lost contrast was a cross-fade, which is what "I can see the blur
and I can see the text" looks like as a number.

`controls.html` exists because the other pages use `<div>`s where Obsidian
uses `<input>`s and `<button>`s, and a theme can look perfect on the former
while boxing every row of a note's properties on the latter. Anything that
touches inputs or buttons gets checked there first.

`app-shim.css` also carries Obsidian's own treatment of the ribbon collapse
control — hidden at `opacity: 0` until the ribbon is hovered, floated out of
the column, sized by its own padding — because a theme that only renders the
tidy version of that element ships three releases of fixes for a button it
cannot see.

It carries four more rules shaped the way Obsidian's own
higher-specificity rules are shaped — two classes where a theme can only
reach for one. They exist so the harness reproduces the condition that beat
this theme twice rather than the easy version of it: drop the `!important`
from the switch or from icon sizing and those rules take over, visibly, on
the next render.

`app-shim.css` is only worth what its accuracy is worth, and it was wrong about
callouts for a release: it handed `--callout-color` over as an `r, g, b` triple
long after Obsidian had started handing over a colour, so every callout rule in
the theme measured correctly here while being dropped as invalid in the app.
When something works in the harness and not in the vault, suspect the shim
before the theme.

One trap worth knowing before writing another of these: **change the theme
class, then wait.** Reading a computed `color-mix()` in the same tick as the
class change returns the previous theme's answer, and the numbers look
plausible — a first version of `cframe.mjs` reported dark-mode callout frames
at 1.25:1 that are actually 1.84:1, and the fix was a 300ms settle.

`check.mjs` exits non-zero if anything was dropped, so it works as a
pre-commit hook. `measure.mjs` is how the "one centre line" claim in the main
README is verified: ribbon action, both sidebar toggles, both sidebar tab
strips and the new-tab button all have to return a centre-y of 20.

## After editing the theme

Every page loads `../theme.css` directly, so a rebuild is all that is needed:

```bash
node ../build.mjs
```

There used to be a copy of `theme.css` in this folder. Nothing referenced it,
it went stale, and one round of measurements was read off it before that was
noticed — so it is gone, and it should not come back.

## What it is not

The shim covers the parts of Obsidian this theme touches, not all of it. Graph,
canvas, PDF and plugin panes are absent. Treat a clean render here as a good
signal, not as a substitute for loading the theme in a real vault.
