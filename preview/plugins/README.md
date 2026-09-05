# Plugin stylesheets for the preview harness

Drop a plugin's built `styles.css` here as `<id>.css`, then load a preview page
with `?plugin=<id>`:

```text
preview/checkboxes.html?plugin=taskpro
```

The harness inserts it **after** `theme.css`, which is the order Obsidian uses:
the app stylesheet, then the theme, then each plugin's sheet as the plugin
loads. So a plugin rule and a theme rule of equal specificity resolve here the
way they resolve in the app — which is the whole point of checking.

`?plugin=` accepts a comma-separated list if you need more than one.

## Why nothing is committed here

`*.css` in this folder is gitignored. A plugin is a separate project with its
own release cycle; a vendored copy would only go stale, and a theme should not
be pinned to one version of someone else's stylesheet. Copy in whichever build
you want to check against.
