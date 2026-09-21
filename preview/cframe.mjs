/* Every callout frame, measured against its own fill.

   The fill already separates a callout from the page; the frame is what says
   *which* callout it is, so it has to be findable against the fill it sits on.
   Composited on a canvas because a callout background is a color-mix and comes
   back as oklab(), which a regex over three numbers reads as nonsense.

     node cframe.mjs
*/
import { chromium } from 'playwright';

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1100, height: 1900 } });
await pg.goto('file://' + process.cwd() + '/callouts.html');

const measure = () => pg.evaluate(() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const paint = (layers) => {
    g.clearRect(0, 0, 1, 1);
    for (const c of layers) { g.fillStyle = c; g.fillRect(0, 0, 1, 1); }
    return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const lum = ([r, gr, bl]) => {
    const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(gr) + 0.0722 * f(bl);
  };
  const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };

  const out = [];
  for (const el of document.querySelectorAll('.callout[data-callout]')) {
    const t = el.getAttribute('data-callout');
    if (out.some((r) => r.t === t)) continue;
    const cs = getComputedStyle(el);
    const stack = [];
    for (let h = el.parentElement; h; h = h.parentElement) {
      const bg = getComputedStyle(h).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)') stack.unshift(bg);
    }
    const framed = cs.outlineStyle !== 'none';
    const fill = paint([...stack, cs.backgroundColor]);
    const edge = paint([...stack, cs.backgroundColor,
      framed ? cs.outlineColor : cs.borderInlineStartColor]);
    const bar = el.querySelector(':scope > *') && getComputedStyle(el, '::before').content !== 'none';
    out.push({
      t,
      style: framed ? cs.outlineStyle : 'rule',
      w: framed ? cs.outlineWidth : cs.borderInlineStartWidth,
      bar: bar ? (getComputedStyle(el, '::before').backgroundImage !== 'none' ? 'striped'
                 : getComputedStyle(el, '::before').height === '3px' ? 'top' : 'side') : '-',
      r: +ratio(edge, fill).toFixed(2),
    });
  }
  return out;
});

for (const mode of ['light', 'dark']) {
  await pg.evaluate((m) => {
    document.body.className = document.body.className.replace(/theme-\w+/, 'theme-' + m);
  }, mode);
  await pg.waitForTimeout(300);
  const rows = await measure();
  console.log(`\n${mode}`);
  console.log('  type        frame            bar       edge vs fill');
  for (const r of rows) {
    console.log(`  ${r.t.padEnd(11)} ${r.style.padEnd(7)} ${r.w.padStart(4)}   ${r.bar.padEnd(8)}  ${String(r.r).padStart(6)}${r.r < 1.7 ? '  <- faint' : ''}`);
  }
}
await browser.close();
