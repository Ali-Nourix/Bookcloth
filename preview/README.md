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

Four scripts, all of them Node and all of them run from this folder.

```bash
node shot.mjs light shot-light.png                       # screenshot
node shot.mjs dark  shot-dark.png overlays.html          # …a different page
node shot.mjs light float.png index.html "bc-float-panes bc-tabs-pill"

node check.mjs        # every rule keeps a declaration, every declaration parses
node measure.mjs      # geometry of the controls that are meant to line up
node contrast.mjs     # the ratios the main README publishes
```

`check.mjs` exits non-zero if anything was dropped, so it works as a
pre-commit hook. `measure.mjs` is how the "one centre line" claim in the main
README is verified: ribbon action, both sidebar toggles, both sidebar tab
strips and the new-tab button all have to return a centre-y of 20.

## After editing the theme

`theme.css` in this folder is a copy. Rebuild and refresh it:

```bash
node ../build.mjs && cp ../theme.css .
```

## What it is not

The shim covers the parts of Obsidian this theme touches, not all of it. Graph,
canvas, PDF and plugin panes are absent. Treat a clean render here as a good
signal, not as a substitute for loading the theme in a real vault.
