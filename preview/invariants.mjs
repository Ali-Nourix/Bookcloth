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

/* extra body classes matter: the theme's Style Settings toggles are body
   classes, and one of them (bc-callout-rule) turns a callout into something
   that draws no container — which changed what an embed inside it has to do. */
const [mode = 'light', page = 'index.html', classes = ''] = process.argv.slice(2);

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('file://' + process.cwd() + '/' + page);
await pg.evaluate(([m, c]) => {
  document.body.className =
    document.body.className.replace(/theme-\w+/, 'theme-' + m) + (c ? ' ' + c : '');
}, [mode, classes]);
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

  /* 5. an embed is a block on this page, not a page of its own. The inner
        .markdown-preview-view arrives with --file-margins, which ends in 20vh,
        so an unreset embed opened with a fifth of the window under its last
        line. Measured as slack: the gap between the embed's bottom and the
        bottom of the last thing in it. */
  for (const em of all('.markdown-embed')) {
    const box = rect(em);
    const es = getComputedStyle(em);
    const kids = [...em.querySelectorAll('*')].filter(shown);
    if (!kids.length) continue;
    const lowest = Math.max(...kids.map((k) => rect(k).bottom));
    const slack = R(box.bottom - lowest - parseFloat(es.paddingBottom));
    if (slack > 8) fails.push(`embed has ${slack}px of empty space under its last line`);

    /* and nothing in it may run past its content box. pre and table are
       allowed to scroll inside themselves; everything else has to wrap. */
    const left = box.left + parseFloat(es.paddingLeft);
    const right = box.right - parseFloat(es.paddingRight);
    /* an overlay control is not content: insets on an absolutely positioned
       box resolve against the padding box, so the embed's open-in-full sits a
       padding's width outside the content box on purpose. Its placement is
       checked below instead. Icon geometry is the svg's business, not the
       layout's, so anything inside one is skipped with it. */
    const overlaid = (el) => {
      if (el.ownerSVGElement) return true;
      for (let n = el; n && n !== em; n = n.parentElement) {
        const pos = getComputedStyle(n).position;
        if (pos === 'absolute' || pos === 'fixed') return true;
      }
      return false;
    };
    for (const k of kids) {
      if (k.closest('pre, table, [style*="overflow"]')) continue;
      if (overlaid(k)) continue;
      if (getComputedStyle(k).overflowX !== 'visible') continue;
      const r = rect(k);
      if (r.right > right + 0.5 || r.left < left - 0.5) {
        const tag = `${k.tagName.toLowerCase()}.${(k.getAttribute('class') || '').split(/\s+/)[0]}`;
        fails.push(`embed content overflows: ${tag} by ${R(Math.max(r.right - right, left - r.left))}px`);
        break;
      }
    }

    /* the open-in-full control sits at the inline end, not over the text */
    const link = em.querySelector(':scope > .markdown-embed-link');
    if (link) {
      const lr = rect(link);
      const rtl = getComputedStyle(em).direction === 'rtl';
      const nearEnd = rtl ? Math.abs(lr.left - left) < 24 : Math.abs(lr.right - right) < 24;
      if (!nearEnd && getComputedStyle(link).opacity !== '0') {
        fails.push('embed link is not at the inline end of the embed');
      }
    }
  }
  notes.push(`embeds checked: ${all('.markdown-embed').length}`);

  /* 5b. nothing may be clipped by an ancestor that hides its overflow. This is
         the check the earlier ones missed: an embed can fit its own content box
         perfectly and still be cut, because it is the CONTAINER that clips. In
         a live vault the embed carried a negative inline-start margin and stood
         34px past a callout that Obsidian gives overflow: hidden — so in a
         right-to-left note one character came off the start of every line. */
  const clipper = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const o = getComputedStyle(n);
      if (o.overflowX !== 'visible' || o.overflowY !== 'visible') return n;
    }
    return null;
  };
  for (const em of all('.markdown-embed')) {
    const c = clipper(em);
    if (!c) continue;
    const cr = rect(c);
    const csy = getComputedStyle(c);
    const inner = {
      left: cr.left + parseFloat(csy.paddingLeft) + parseFloat(csy.borderLeftWidth),
      right: cr.right - parseFloat(csy.paddingRight) - parseFloat(csy.borderRightWidth),
    };
    const er = rect(em);
    const past = R(Math.max(er.right - inner.right, inner.left - er.left));
    if (past > 0.5) {
      const who = `${c.tagName.toLowerCase()}.${(c.getAttribute('class') || '').split(/\s+/)[0]}`;
      fails.push(`embed stands ${past}px outside ${who}, which clips (overflow ${csy.overflow})`);
    }
    /* and nothing inside it may be cut by that same ancestor either */
    for (const k of em.querySelectorAll('*')) {
      if (k.ownerSVGElement || !shown(k)) continue;
      const kr = rect(k);
      const cut = R(Math.max(kr.right - inner.right, inner.left - kr.left));
      if (cut > 0.5) {
        const tag = `${k.tagName.toLowerCase()}.${(k.getAttribute('class') || '').split(/\s+/)[0]}`;
        fails.push(`${tag} inside the embed is cut off by ${cut}px`);
        break;
      }
    }
  }

  /* 5c. an embed always has a visible edge — its own, or the fill of the
         callout holding it. Going flush inside a callout is only sound while
         the callout draws a container; under the left-rule variant it draws a
         3px line and nothing else, and an embed that also drew nothing left no
         box anywhere on screen. That shipped, and this is the check for it. */
  const opaque = (v) => v && v !== 'transparent' && !/,\s*0\s*\)$/.test(v);
  for (const em of all('.markdown-embed')) {
    const s2 = getComputedStyle(em);
    let edged = opaque(s2.backgroundColor) || s2.boxShadow !== 'none' ||
      parseFloat(s2.borderTopWidth) + parseFloat(s2.borderLeftWidth) > 0;
    if (!edged) {
      const co = em.closest('.callout');
      if (co) edged = opaque(getComputedStyle(co).backgroundColor);
    }
    /* unless the reader asked for exactly that */
    if (!edged && !document.body.classList.contains('bc-embed-bare')) {
      fails.push('embed has no edge and sits in nothing that has one');
    }
  }

  /* 5d. an embed's padding is the same on the top as on the sides. Measured
         rather than declared: the gap above the first drawn thing had been
         anywhere between 12px and 63px while every side stayed at 16px,
         because Obsidian opens a preview with two zero-height spacers and the
         rule meant for the first heading was landing on one of them. */
  for (const em of all('.markdown-embed')) {
    const er = rect(em);
    const es = getComputedStyle(em);
    const rtl = es.direction === 'rtl';
    const overlaid2 = (el) => {
      if (el.ownerSVGElement) return true;
      for (let n = el; n && n !== em; n = n.parentElement) {
        const pos = getComputedStyle(n).position;
        if (pos === 'absolute' || pos === 'fixed') return true;
      }
      return false;
    };
    const drawn = [...em.querySelectorAll('*')].filter((k) => shown(k) && !overlaid2(k));
    if (!drawn.length) continue;
    const top = Math.min(...drawn.map((k) => rect(k).top));
    const side = rtl
      ? er.right - Math.max(...drawn.map((k) => rect(k).right))
      : Math.min(...drawn.map((k) => rect(k).left)) - er.left;
    const gapTop = R(top - er.top);
    const gapSide = R(side);
    if (Math.abs(gapTop - gapSide) > 1) {
      fails.push(`embed padding is ragged: ${gapTop}px above the first line, ${gapSide}px beside it`);
    }
  }

  /* 6. the in-progress box follows the accent. */
  const half = all('input[type=checkbox]').find(
    (e) => (e.getAttribute('data-task') ?? e.closest('[data-task]')?.getAttribute('data-task')) === '/'
  );
  if (half) {
    const hs = getComputedStyle(half);
    const accent = getComputedStyle(document.body).getPropertyValue('--interactive-accent').trim();
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;color:${accent}`;
    document.body.append(probe);
    const want = getComputedStyle(probe).color;
    probe.remove();
    if (hs.borderTopColor !== want) {
      fails.push(`in-progress box is ${hs.borderTopColor}, accent is ${want}`);
    }
    notes.push(`in-progress box ${hs.borderTopColor} = accent`);
  }

  /* 7. one band height, not two opinions about it. */
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
