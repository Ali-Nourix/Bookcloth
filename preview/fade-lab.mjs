/* The bottom fade, measured two ways.

   UNDER TEXT — the note is scrolled so its last lines sit on the pane floor.
   For each band of height above that floor:

     sharpness = (hf/sd) with the fade on, over (hf/sd) with it off,

   where sd is the contrast across the row and hf the mean step between
   neighbouring pixels. The ratio is scale free: dim a row and it does not move,
   blur a row and it collapses. So 1.00 means the edges are exactly as crisp as
   they were and any loss of contrast was a cross-fade — the reported bug, two
   images of the same text through each other. Lower is a real blur.

   UNDER NOTHING — the note is scrolled to its end, where the last 150px of the
   pane are empty. A blur of a flat colour is that colour, so any change in mean
   luminance here is the fade making itself visible over nothing, which is the
   band that was reported in light mode.

     node fade-lab.mjs [light|dark]
*/
import { chromium } from 'playwright';

const mode = process.argv[2] || 'dark';
const CAND = [
  { name: 'shipped',            css: '' },
  { name: 'overhang 28 (was)',  css: 'body{--bc-edge-fade-overshoot:28px}' },
  { name: 'blur 34',            css: 'body{--bc-edge-fade-blur:34px}' },
  { name: 'one layer, masked',  css: 'body.bc-edge-fade .workspace-split.mod-root .workspace-leaf::before,body.bc-edge-fade .workspace-split.mod-root .workspace-leaf::after,body.bc-edge-fade .workspace-split.mod-root .workspace-leaf-content::before{display:none}body.bc-edge-fade .workspace-split.mod-root .workspace-leaf-content::after{height:var(--bc-edge-fade-height);mask-image:linear-gradient(to top,#000,transparent);-webkit-mask-image:linear-gradient(to top,#000,transparent)}' },
];

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await pg.goto('file://' + process.cwd() + '/index.html');
const base = `theme-${mode} mod-macos is-focused`;

// `gap` is how much empty pane to leave under the last line: 0 presses the text
// against the floor, 999 scrolls to the end of the note and leaves the trailing
// space the sizer always has.
const place = gap => pg.evaluate(g => {
  const leaf = document.querySelector('.workspace-split.mod-root .workspace-leaf');
  const sc = [...leaf.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 4);
  const sizer = leaf.querySelector('.markdown-preview-sizer');
  sc.scrollTop = sc.scrollHeight;
  const short = leaf.getBoundingClientRect().bottom - sizer.getBoundingClientRect().bottom;
  if (g < 900 && short > 0) sc.scrollTop = Math.max(0, sc.scrollTop - short + 4 - g);
  const r = leaf.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}, gap);

const setCss = c => pg.evaluate(t => {
  let s = document.getElementById('fade-lab-style');
  if (!s) { s = document.createElement('style'); s.id = 'fade-lab-style'; document.head.append(s); }
  s.textContent = t;
}, c);

async function shoot(box, cls, css) {
  await pg.evaluate(c => { document.body.className = c; }, cls);
  await setCss(css);
  await pg.waitForTimeout(420);
  return 'data:image/png;base64,' + (await pg.screenshot({ clip: box })).toString('base64');
}

const rowsOf = (a, b) => pg.evaluate(async ([a, b]) => {
  const read = src => new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      res(x.getImageData(0, 0, c.width, c.height));
    }; img.src = src;
  });
  const A = await read(a), B = await read(b);
  const W = A.width, H = A.height, x0 = (W * 0.12) | 0, x1 = (W * 0.88) | 0;
  const stats = (d, y) => {
    let n = 0, s = 0, s2 = 0, hf = 0, p = null;
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      const l = 0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2];
      s += l; s2 += l * l; n++; if (p !== null) hf += Math.abs(l - p); p = l;
    }
    const m = s / n; return { m, sd: Math.sqrt(Math.max(0, s2 / n - m * m)), hf: hf / (n - 1) };
  };
  const out = [];
  for (let up = 2; up <= 320; up += 2) {
    const y = H - up; if (y < 0) break;
    const o = stats(A, y), f = stats(B, y);
    out.push({ up: up / 2, sd: o.sd, shift: f.m - o.m,
               sharp: o.sd >= 1.5 ? (f.hf / f.sd) / (o.hf / o.sd) : null });
  }
  return out;
}, [a, b]);

const BANDS = [[0, 16], [16, 32], [32, 50], [50, 75], [75, 110]];

const textBox = await place(0);
const textOff = await shoot(textBox, base, '');
const emptyBox = await place(999);
const emptyOff = await shoot(emptyBox, base, '');

console.log(`${mode}   sharpness by px above the pane floor — 1.00 = untouched edges, lower = actually blurred\n`);
console.log('  ' + 'candidate'.padEnd(26) + BANDS.map(b => `${b[0]}-${b[1]}`.padStart(8)).join('') + '     haze');
for (const c of CAND) {
  await place(0);
  const rows = await rowsOf(textOff, await shoot(textBox, `${base} bc-edge-fade`, c.css));
  const cells = BANDS.map(([lo, hi]) => {
    const r = rows.filter(v => v.sharp !== null && v.up >= lo && v.up < hi);
    return (r.length ? (r.reduce((s, v) => s + v.sharp, 0) / r.length).toFixed(2) : '-').padStart(8);
  });
  await place(999);
  const flat = await rowsOf(emptyOff, await shoot(emptyBox, `${base} bc-edge-fade`, c.css));
  const haze = flat.filter(v => v.up <= 120 && v.sd < 1.5)
                   .reduce((m, v) => Math.abs(v.shift) > Math.abs(m) ? v.shift : m, 0);
  console.log('  ' + c.name.padEnd(26) + cells.join('') + `   ${haze.toFixed(1).padStart(5)}`);
}
await browser.close();
