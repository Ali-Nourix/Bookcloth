# Contributing to Bookcloth

Thank you for helping improve Bookcloth.

## Before opening an issue

- Check existing issues for duplicates.
- Use the latest available version of Bookcloth and Obsidian when possible.
- Temporarily disable conflicting CSS snippets and plugin styles when investigating a visual issue.
- Include your Obsidian version, operating system, light/dark mode, and steps to reproduce.

## Reporting bugs

Use the bug report template and include screenshots for visual regressions. Describe the expected behavior and what happened instead.

## Proposing changes

Keep changes focused and consistent with Bookcloth's design principles: restrained visual styling, readable typography, predictable spacing, accessible contrast, RTL awareness, and compatibility with Obsidian's native interface.

For CSS changes:

1. Inspect the source files and existing tokens before adding new rules.
2. Prefer existing variables and shared patterns over duplicated declarations.
3. Avoid broad selectors that can unintentionally break plugins or nested views.
4. Check both light and dark modes, desktop and mobile, and RTL content when relevant.
5. Regenerate `theme.css` using the repository's established build process rather than editing generated output independently.
6. Run the available validation and preview checks.

## Pull requests

- Explain the user-facing problem and the proposed solution.
- List affected areas and compatibility implications.
- Include before/after screenshots for visual changes.
- Report the checks you ran and any checks you could not run.

Please do not bundle unrelated refactors with visual fixes.
