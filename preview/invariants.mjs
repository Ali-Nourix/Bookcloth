/* Assert the things the theme claims, rather than reporting numbers for
   someone to squint at.
 *
 *   node invariants.mjs [light|dark] [page]
 *
 * Every check here exists because the live probe (tools/probe.js) caught the
 * theme getting it wrong in a real vault. A reporting script cannot fail, and
 * six of these shipped broken while measure.mjs printed them every time.
 */
import { chromium } from 'playwright';

const [mode = 'light', page = 'index.html'] = process.argv.slice(2);

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('file://' + process.cwd() + '/' + page);
await pg.evaluate((m) => {
  document.body.className = document.body.className.replace(/theme-\w+/, 'theme-' + m);
}, mode);
await pg.waitForTimeout(300);

const result = await pg.evaluate(() => {
  const fails = [];
  const notes = [];
  const R = (n) => Math.round(n * 100) / 100;
  const rect = (el) => el.getBoundingClientRect();
  const shown = (el) => {
    const r = rect(el);
    return r.width > 0 && r.height > 0;
  };
  const all = (s) => [...document.querySelectorAll(s)].filter(shown);

  /* 1. one band, one centre line. Four separate containers hold these, which
        is the entire reason they have to be checked rather than assumed. */
  const BAND = [
    '.workspace-ribbon .sidebar-toggle-button',
    /* the ribbon's actions are deliberately not here: they run down the ribbon
       below the band, which is where Obsidian puts them and where the 45px of
       ribbon padding exists to leave them. */
    '.workspace-split.mod-left-split .workspace-tab-header',
    '.workspace-split.mod-root .workspace-tab-header-new-tab',
    '.workspace-split.mod-root .workspace-tab-header-tab-list',
    '.workspace-split.mod-root .sidebar-toggle-button',
  ];
  const centres = [];
  for (const sel of BAND) {
    const el = all(sel)[0];
    if (!el) {
      notes.push(`band: ${sel} not on this page`);
      continue;
    }
    const r = rect(el);
    centres.push([sel, R(r.y + r.height / 2)]);
  }
  if (centres.length > 1) {
    const [, base] = centres[0];
    for (const [sel, c] of centres.slice(1)) {
      if (Math.abs(c - base) > 0.51) {
        fails.push(`band centre: ${sel} at ${c}, expected ${base}`);
      }
    }
    notes.push(`band centre-y ${base} across ${centres.length} controls`);
  }

  /* 2. one rendered size, one stroke. The live dump found 18px icons drawing
        at 1.575, 1.71 and 2px in the same row. */
  const bySize = new Map();
  for (const svg of document.querySelectorAll('svg')) {
    const r = rect(svg);
    if (!r.width) continue;
    const key = `${R(r.width)}x${R(r.height)}`;
    const w = getComputedStyle(svg).strokeWidth;
    const owner = svg.parentElement?.getAttribute('class') || '?';
    const g = bySize.get(key) || new Map();
    g.set(w, (g.get(w) || new Set()).add(owner.split(/\s+/)[0]));
    bySize.set(key, g);
  }
  for (const [size, strokes] of bySize) {
    if (strokes.size > 1) {
      const detail = [...strokes.entries()]
        .map(([w, owners]) => `${w} (${[...owners].join(',')})`)
        .join('  vs  ');
      fails.push(`icon stroke: ${size} icons draw at ${strokes.size} weights — ${detail}`);
    }
  }
  notes.push(`icon groups: ${[...bySize.keys()].join(' ')}`);

  /* 3. a header's actions stay inside the header, and leave the title a width.
        Stacking a theme gap on Obsidian's per-item margin pushed eight actions
        22px past the right edge and squeezed the title to zero. */
  for (const header of all('.view-header')) {
    const actions = header.querySelector('.view-actions');
    if (!actions) continue;
    const hs = getComputedStyle(header);
    const limit = rect(header).right - parseFloat(hs.paddingRight);
    const right = rect(actions).right;
    if (right > limit + 0.5) {
      fails.push(`view actions overflow the header by ${R(right - limit)}px`);
    }
    const title = header.querySelector('.view-header-title');
    if (title && rect(title).width <= 0) fails.push('view header title has zero width');
  }

  /* 4. the checkbox is bigger than the one it replaces, not smaller. 1em on an
        <input> is the user agent's 13.33px, which is how it shipped at 15.3. */
  const box = all('.task-list-item-checkbox')[0];
  if (box) {
    const w = R(rect(box).width);
    if (w < 18) fails.push(`task checkbox is ${w}px, smaller than Obsidian's 18px`);
    notes.push(`task checkbox ${w}px`);
  }

  /* 5. one band height, not two opinions about it. */
  const cs = getComputedStyle(document.body);
  const band = cs.getPropertyValue('--bc-topbar-height').trim();
  const header = cs.getPropertyValue('--header-height').trim();
  const px = (v) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;visibility:hidden;height:${v}`;
    document.body.append(d);
    const h = d.getBoundingClientRect().height;
    d.remove();
    return R(h);
  };
  if (px(band) !== px(header)) {
    fails.push(`band height: --bc-topbar-height ${band} but --header-height ${header}`);
  }
  notes.push(`band height ${px(band)}px, control ${cs.getPropertyValue('--bc-hit').trim()}`);

  return { fails, notes };
});

await browser.close();

for (const n of result.notes) console.log(`  ${n}`);
if (result.fails.length) {
  console.log(`\n${result.fails.length} broken:`);
  for (const f of result.fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('\nall invariants hold');
