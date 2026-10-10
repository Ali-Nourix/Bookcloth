/* node crop.mjs <src.png> <out.png> <x> <y> <w> <h>   (CSS px on a 2x shot) */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [src, out, x, y, w, h] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w + 20, height: +h + 20 }, deviceScaleFactor: 2 });
const data = 'data:image/png;base64,' + readFileSync(src).toString('base64');
await p.setContent(`<body style="margin:0"><img src="${data}" style="position:absolute;left:${-x * 2}px;top:${-y * 2}px;width:auto;image-rendering:pixelated"></body>`);
await p.waitForTimeout(300);
await p.screenshot({ path: out, clip: { x: 0, y: 0, width: +w, height: +h } });
await b.close();
console.log('wrote', out);
