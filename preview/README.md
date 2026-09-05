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

Open any of them in a browser. Switch themes from the console:

```js
document.body.className = document.body.className.replace(/theme-\w+/, 'theme-dark')
```

## Screenshots

With Playwright installed:

```bash
pip install playwright && playwright install chromium
python3 shot.py light shot-light.png
python3 shot.py dark  shot-dark.png overlays.html
```

`shot.py` takes a theme name, an output path and an optional page.

## After editing the theme

`theme.css` in this folder is a copy. Rebuild and refresh it:

```bash
node ../build.mjs && cp ../theme.css .
```

## Fonts

No font files are bundled, so the harness falls back to whatever your system
has. For rendering that matches the theme's intended stacks:

```bash
npm install @fontsource/inter @fontsource/vazirmatn
mkdir -p fonts
cp node_modules/@fontsource/inter/files/inter-latin-{400,500,600,700}-normal.woff2 fonts/
cp node_modules/@fontsource/inter/files/inter-latin-400-italic.woff2 fonts/
cp node_modules/@fontsource/vazirmatn/files/vazirmatn-arabic-{400,600}-normal.woff2 fonts/
```

## What it is not

The shim covers the parts of Obsidian this theme touches, not all of it. Graph,
canvas, PDF and plugin panes are absent. Treat a clean render here as a good
signal, not as a substitute for loading the theme in a real vault.
