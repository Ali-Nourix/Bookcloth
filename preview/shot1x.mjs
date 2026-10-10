/* A whole page at 1:1, for looking at rather than measuring.
   node shot1x.mjs [light|dark] out.png [page] [w] [h] */
import { chromium } from 'playwright';
const [mode = 'dark', out = 'out.png', page = 'index.html', w = '1100', h = '1900'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await p.goto('file://' + process.cwd() + '/' + page);
await p.evaluate((m) => {
  document.body.className = document.body.className.replace(/theme-\w+/, 'theme-' + m);
}, mode);
await p.waitForTimeout(400);
await p.screenshot({ path: out });
await b.close();
console.log('wrote', out);
