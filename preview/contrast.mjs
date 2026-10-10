/* Measure the contrast ratios the README publishes, against the colours the
   browser actually resolves — including the ones that arrive through
   color-mix(), which no amount of reading the source will tell you.

     node contrast.mjs
*/
import { chromium } from 'playwright';

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('file://' + process.cwd() + '/index.html');

const run = async (mode) => {
  await pg.evaluate((m) => {
    document.body.className = document.body.className.replace(/theme-\w+/, 'theme-' + m);
  }, mode);
  await pg.waitForTimeout(150);
  return pg.evaluate(() => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const resolve = (v) => {
      el.style.color = '';
      el.style.color = v;
      const c = getComputedStyle(el).color;
      const n = c.match(/[\d.]+/g).map(Number).slice(0, 3);
      /* color-mix() computes to color(srgb r g b) with 0-1 floats; rgb() to 0-255. */
      return c.startsWith('color(') ? n.map((x) => x * 255) : n;
    };
    const lum = ([r, g, b]) => {
      const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    const cs = getComputedStyle(document.body);
    const V = (n) => cs.getPropertyValue(n).trim();
    const page = resolve(V('--background-primary'));
    const chrome = resolve(V('--background-secondary'));

    /* `resolve` reads only the three channels, so a token carrying an alpha —
       every border in this theme does — would be measured as if it were opaque
       and report a ratio nothing on screen has. Composite it over what it sits
       on instead. */
    const over = (v, bg) => {
      /* Composited by the canvas rather than by arithmetic on a parsed string:
         a colour here can come back as rgba(), as color(srgb 0-1 floats) or as
         oklab() out of a color-mix, and a parser that knows the first reads the
         second as three numbers under one. */
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.fillStyle = `rgb(${bg.map(Math.round).join(',')})`;
      g.fillRect(0, 0, 1, 1);
      g.fillStyle = v;
      g.fillRect(0, 0, 1, 1);
      return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };

    /* Measured off a real <input>, not off the token: the edge a reader sees is
       whatever survives the cascade, and an unchecked box is nothing but its
       edge. */
    const box = document.querySelector('.markdown-preview-view input[type="checkbox"]:not(:checked)')
             || document.querySelector('input[type="checkbox"]:not(:checked)');
    const boxEdge = box ? over(getComputedStyle(box).borderTopColor, page) : null;

    const pairs = {
      'Body text': [V('--text-normal'), page],
      'Muted text, page': [V('--text-muted'), page],
      'Muted text, sidebar': [V('--text-muted'), chrome],
      'Faint text': [V('--text-faint'), page],
      'Links': [V('--link-color'), page],
      'Inline code': [V('--bc-code-inline-color'), page],
      'Button label on accent': [V('--text-on-accent'), resolve(V('--interactive-accent'))],
      'Error text': [V('--text-error'), page],
      'Warning text': [V('--text-warning'), page],
      'Success text': [V('--text-success'), page],
    };
    if (boxEdge) pairs['Checkbox edge, empty'] = [boxEdge, page];
    for (const hue of ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'])
      pairs[`hue: ${hue}`] = [V(`--color-${hue}`), page];

    const out = {};
    for (const [k, [fg, bg]] of Object.entries(pairs))
      out[k] = ratio(Array.isArray(fg) ? fg : resolve(fg), Array.isArray(bg) ? bg : resolve(bg)).toFixed(2);
    el.remove();
    return out;
  });
};

const light = await run('light');
const dark = await run('dark');
for (const k of Object.keys(light))
  console.log(k.padEnd(24), 'light', String(light[k]).padStart(6), '   dark', String(dark[k]).padStart(6));
await browser.close();
