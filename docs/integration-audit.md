# Final theme consolidation audit

## Scope and recovery point

Audited on 2026-10-10. Original `main`: `bb5e08150f250cade0c96009b1c935a292c5ed05`.
Recovery branch: `recovery/main-before-consolidation-2026-10-10`.
Authoritative integration branch: `integration/final-theme`, created from that
latest `main`. Theme version remains the existing **3.8.1**; no release or tag
was created and licensing was not modified.

The private repository could not be cloned by the local Git client because it
had no credentials. The authenticated GitHub connection supplied the complete
branch lists, all commit-history pages (each contained fewer than 100 commits),
all 10 existing PRs, relevant commit patches, and immutable file snapshots.
Downloaded blobs were checked against GitHub's blob SHA where returned. The
remote heads were checked again before creating integration branches. This was
an authenticated snapshot/history audit, not a successful `git fetch`.

## Branch and PR decisions

| Branch at audit | Head | Decision |
| --- | --- | --- |
| `main` | `bb5e08150f250cade0c96009b1c935a292c5ed05` | Base; preserve Habbiter and the sidebar fix from PR #10. |
| `claude/floating-task-board` | `7f3c04c8db221bfbce4b2c5c004dc2d0d17935e6` | Entire implementation is already in ribbon 3.8.1's history. Preserve once, including TaskPro opt-out, blur slider, phone layout, fixtures, benchmark and screenshots; do not apply PR #7 a second time. PR #6 had previously been merged into loving-ride, not this original main lineage. |
| `claude/loving-ride-odlcco` | `1f0ff4ae36e9f1e0be2de64e6e42e9f24fb27159` | Shared 3.8.0 implementation plus one independent addition: `tools/embed-sections.js`. Preserve it and its history; PR #8's shared work must not overwrite the later ribbon fix. Earlier PRs #1 and #4 are already on main. |
| `claude/plugin-checkbox-compat` | `3e8c22736b3c10048d606dc86ee351290c179058` | Checkbox compatibility (PR #2) already merged. PR #3's extra embed patch is superseded by the 2.6.x and 2.7.0 embed fixes on loving/ribbon. Do not merge the obsolete implementation that strips callout embeds to a frameless box; retain its useful behavior through the newer implementation and fixture. |
| `claude/wonderful-pascal-96z7wn` | `c97404b2e6ff57c3c51755ea8e794f638fbdef5f` | Already merged as PR #5. Retain Habbiter partial, settings, build entry and documentation. Respect its explicit revert of CI/release workflows. |
| `fix/obsidian-1.14-ribbon-3.8` | `6bc68bce6c7182c4c3bc3f5be32c6ddfafa811a8` | Newest implementation spine, corresponding to PR #9; combine with main-only work rather than replace main blindly. |
| `fix/obsidian-1.14-sidebar` | `b0f882e064485ee9a8fe9fa5affea7c72befcbdc` | Already merged as PR #10, but only generated CSS had the fix. Port all relevant split aliases into source, including Habbiter and mobile, before rebuilding. |

No additional source branches or open PRs were found. No source branch was
deleted. The temporary `integration/reconciled-3.8.1` branch starts from the
ribbon head and carries the same conflict-resolved text as the authoritative
integration branch, permitting a normal merge that retains original 3.x
history and binary screenshots without overwriting conflicts. It is not a
second maintained theme version.

The common source baseline is `3c6272d48f6ed37455be34f9a0a3fc312b21c531`
(2.6.6). Comparing main with that baseline identified Habbiter changes,
version changes and the generated-only sidebar aliases. All remaining source
changes come from the newer spine. This evidence, not branch size, determined
which implementation to retain.

## Valuable changes retained

- Resistant embed padding using `--bc-embed-padding`, corrected selector
  specificity, block display, empty-title removal, first drawn block spacing,
  clipping/overflow checks, nested embeds and RTL callout reproduction.
- Persian typesetting settings, reading-view-only pretty wrapping and automatic
  bidi direction; CodeMirror keeps its own wrapping and caret model.
- Expanded tokens and settings, checkbox/plugin compatibility, visible empty
  checkbox edges, callout color contract and callout frames/signatures.
- Glow, motion levels, reduced-motion handling, editor edge fade, floating
  ribbon panels, touch behavior and light/dark adaptations.
- TaskPro floating board composited app blur and independent modal surface.
- Habbiter's checkbox shape and sticky-label surface support.
- Preview fixtures, settings validator, callout/fade/float diagnostics, the
  corrected embed doctor, probe scripts, and the newer embed-sections tool.

The 3.7.0 smooth-scroll experiment was explicitly reverted by
`8214ed61399ff573b69c4e05a815a94ce5776942`; its removed companion and settings
were intentionally not revived. Similarly, reverted CI/release automation was
not resurrected.

## Semantic conflict resolutions

1. Three-way merge `build.mjs` and `src/00-settings.css` against the common
   baseline, keeping both Habbiter and TaskPro plus newer motion/settings.
2. Resolve the overlapping README plugin section by retaining both Habbiter's
   explanation and TaskPro's explanation/screenshots, with one combined list.
3. Port primary/secondary sidebar aliases from main's generated CSS to every
   source selector. Keep ribbon aliases and the newer glow `display: block`
   correction. `src/06-chrome.css`, `src/13-panes.css`, `src/10-mobile.css` and
   the Habbiter partial all recognize old and new classes.
4. Preserve the newer editor/embed and RTL implementations; the older PR #3
   must not remove newer rings, spacing, padding resistance or selector fixes.
5. Adapt Habbiter to the newer typed callout color contract (no obsolete
   `rgb(var(--callout-color))`). Container surface inheritance follows filled
   and transparent callouts/embeds, nesting, dark wash strength, sidebar and
   popover surfaces. Reader opt-outs and circle-checkbox settings still work.
6. Make the resolved callout color inherit so embedded hairlines and signature
   pseudos use the containing callout's color. Nested callouts still resolve
   their own color independently.
7. Rebuild generated CSS from the combined source rather than hand-merging it.
   Manifest, banner and `--bc-version` agree at 3.8.1. The build uses 22 unique
   partials, including both plugin additions.

## Validation performed

Environment: Node 24, sandbox Chromium, repository preview dependencies
installed with `npm install --ignore-scripts --no-package-lock`. Existing
scripts were run with a local launch preload selecting installed Chromium;
none of their assertions was disabled. The new integration script supports
`PW_CHROMIUM` directly. No root `package.json` exists; dependencies live in
`preview/package.json`.

Commands (from repository root or `preview/` as appropriate):

```sh
node build.mjs
sha256sum theme.css                 # before and after a second rebuild
sha256sum -c css-before.sha         # identical generated bytes
cd preview
node check.mjs
node check-settings.mjs
node measure.mjs light
node measure.mjs dark
node contrast.mjs
node cframe.mjs
# Each mode, each of the eight fixtures below:
node invariants.mjs light index.html
node invariants.mjs dark index.html
# Also: overlays.html rtl.html plugin-pane.html controls.html
#       checkboxes.html embeds.html callouts.html
# Each mode, these additional combinations:
node invariants.mjs light index.html "bc-float-panes bc-pane-glow bc-motion-expressive"
node invariants.mjs light embeds.html "bc-callout-rule"
node invariants.mjs light rtl.html "bc-rtl-autodir bc-rtl-justify"
# Repeat those three in dark mode.
PW_CHROMIUM=/path/to/chromium node integration.mjs
node fade-lab.mjs light
node fade-lab.mjs dark
node float-lab.mjs light
node float-lab.mjs dark
```

Results:

- All 28 CSS/settings/measurement/invariant command runs exited 0, including
  22 invariant combinations (8 fixtures × 2 themes, plus 6 settings variants).
- CSS parser: zero empty style rules, zero rejected declarations, registered
  callout color property present. Settings: 104 entries, 8 types, well formed.
- New integration validator: 22 browser scenarios pass, plus deterministic
  build, matching version markers, unique build entries, and no legacy-only
  source selectors. Tests cover both old and renamed shim/DOM classes, single
  and stacked sidebar cards, ribbon glow/hiding, touch/phone rules, TaskPro
  blur and opt-out, reduced motion, Habbiter surfaces/opt-out/checkbox radius,
  and callout color inheritance across embed variants in both themes.
- Both fade diagnostic runs exited 0; these report measurements rather than
  assert a particular perceptual result.
- Both float benchmarks exited 0 (`FLOAT_OK`): theme filter averaged 16.6 ms
  versus 16.7 ms without blur. Backdrop-filter comparisons averaged 47.2 ms
  light and 51.9 ms dark on this sandbox; not an Obsidian performance claim.
- Four harness renders were inspected: light and dark floating workspaces,
  a 390px RTL fixture, and dark LTR/RTL nested embeds.
- Source, generated CSS, tools and documentation were scanned for conflict
  markers; resolution diffs were reviewed. No file deletions are submitted.
  Existing screenshots, demo files and licensing remain untouched.

## Limits and manual application checklist

These are **browser-harness validations, not tests in Obsidian**. No live vault
or installed Obsidian application was available. Existing repository text
about past live measurements is historical evidence, not a new measurement.
Optional Inter/Vazirmatn font files and third-party plugin styles were not
installed in the harness; renders use available fallback fonts.

In a real Obsidian 1.14 vault, verify:

- Primary/secondary ribbon and sidebars, collapsed and stacked panels, RTL
  side switching and actual plugin footers.
- TaskPro open/close, focus, cancellation, menus/notices and real mobile layout.
- Habbiter sticky labels in callouts, nested/transparent embeds and sidebars.
- Lazy heading-section embeds, particularly the reported heading-only case:
  `tools/embed-sections.js` was preserved as a diagnostic, not treated as proof
  that Obsidian's lazy renderer is fixed. Do not remove min-height/overflow
  resets speculatively without a real-vault reproduction.
- Actual CodeMirror caret/wrapping, Persian fonts, scrolling and accessibility
  preferences across light/dark and touch devices.

No release, version tag, force-push, branch deletion or protection bypass is
part of this consolidation. Final delivery is a normal PR merge into `main`;
the final merge SHA and PR links are reported separately after verification.
