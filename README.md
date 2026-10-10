# Bookcloth

**A Notion-inspired theme for [Obsidian](https://obsidian.md).**

Bookcloth brings Notion's calm, paper-like interface to Obsidian: a white writing surface, warm neutral chrome, compact controls, clear typography, and panels that feel like one continuous workspace. It is minimal in appearance, not in capability.

![Bookcloth in light mode](screenshot.png)

![Bookcloth in dark mode](screenshot-dark.png)

## Features

- **Light and dark themes** with carefully tuned neutral surfaces.
- **Notion-inspired typography** with a clear distinction between interface and document text.
- **Flush panels** that reduce visual clutter, with optional floating-panel styling.
- **Configurable accent color** that follows Obsidian's Accent color setting.
- **Style Settings support** for adjusting colors, typography, density, panel layout, icons, motion, callouts, embeds, and supported plugin styling.
- **Editor refinements** for headings, links, code, tables, lists, checkboxes, and callouts.
- **RTL-aware styling** for right-to-left writing, including Persian and Arabic text.
- **Responsive layouts** for desktop and mobile use.
- **Reduced-motion options** and adjustable interface details.

Bookcloth works without the Style Settings community plugin. Installing Style Settings unlocks additional customization controls.

## Installation

### From Obsidian

1. Open **Settings → Appearance**.
2. Under **Themes**, select **Manage**.
3. Search for **Bookcloth**.
4. Select **Install**, then **Use**.

### Manual installation

1. Download or clone this repository.
2. Copy the theme folder into your vault's `.obsidian/themes/` directory.
3. In Obsidian, open **Settings → Appearance → Themes**.
4. Select **Bookcloth**.

At runtime, Obsidian needs `theme.css` and `manifest.json`. The remaining files support development, previews, and validation.

## Recommended companion

Install the community plugin **[Style Settings](https://github.com/mgmeyers/obsidian-style-settings)** to customize the theme.

Settings are grouped around accent, surfaces, text, semantic colors, typography, shape and density, floating panels, icons, editor behavior, and plugin support. All controls are optional; Bookcloth remains a complete theme with default settings.

## Design approach

Bookcloth takes inspiration from Notion's restrained interface rather than copying its product behavior. Its main principles are:

- A bright, readable page against quieter application chrome.
- Consistent spacing, compact controls, and restrained corner radii.
- Accent color used primarily for meaningful interaction states.
- Clear hierarchy for headings, links, code, tables, and callouts.
- Minimal borders, with surface contrast doing most of the structural work.
- RTL support that respects writing direction rather than merely aligning text to the right.

The theme includes deliberate contrast and sizing adjustments where a literal visual match would reduce readability or accessibility.

## Compatibility

- **Minimum Obsidian version declared by the theme:** `1.5.0`.
- Intended for Obsidian desktop and mobile; behavior can vary with Obsidian versions and third-party plugins.
- Optional plugin-specific styling may depend on the relevant plugin being installed.
- For the best customization experience, install Style Settings.

If an update causes an issue, temporarily disable Style Settings and other snippets to check for a styling conflict before reporting the problem.

## Development

The repository contains the distributable theme and its source styles, along with preview and validation tools.

When changing the theme:

1. Inspect the relevant source styles before editing generated output.
2. Follow the repository's existing build process to regenerate `theme.css`.
3. Run the available validation and preview checks.
4. Test both light and dark modes, desktop and mobile layouts, RTL content, callouts, embeds, and any affected plugin interfaces.
5. Include screenshots and clear reproduction steps when reporting visual regressions.

Do not edit generated `theme.css` independently if the source/build workflow is available; source and generated output should remain in sync.

## Troubleshooting

**A plugin looks inconsistent with the theme**

Some plugins render their own interface or ship CSS that overrides theme styles. Update the plugin, check its Bookcloth/Style Settings compatibility options, and temporarily disable conflicting CSS snippets.

**The theme looks different after an Obsidian update**

Obsidian's internal interface styles can change between releases. Report the Obsidian version, operating system, affected view, and steps to reproduce the issue.

**A Style Settings section fails to appear**

Update Style Settings and Bookcloth, then restart Obsidian. If the problem persists, include the relevant console error and your Obsidian version in the report.

## Reporting issues

When opening an issue, include:

- Obsidian version and operating system.
- Light or dark mode.
- Desktop or mobile.
- Steps to reproduce the problem.
- Screenshots, if the issue is visual.
- Relevant plugins, snippets, and Style Settings values.

Please separate confirmed bugs from feature requests and visual preferences.

## License

Check the repository's license file and distribution terms before redistributing or modifying Bookcloth. If no license is present, do not assume that the project is open-source licensed; ask the maintainer for clarification.
