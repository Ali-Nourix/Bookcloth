/* Screenshot the harness. Node, so it works wherever Playwright is installed
   without a Python environment as well.

     node shot.mjs <light|dark> <out.png> [page] [extra body classes] [w] [h]
     node shot.mjs dark shot-dark.png overlays.html
     node shot.mjs light float.png index.html "bc-float-panes bc-tabs-pill"
*/
import { chromium } from 'playwright';

const [mode = 'light', out = `shot-${process.argv[2] || 'light'}.png`,
       page = 'index.html', classes = '', w = '1440', h = '900'] = process.argv.slice(2);

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
await pg.goto('file://' + process.cwd() + '/' + page);
await pg.evaluate(([m, c]) => {
  document.body.className =
    document.body.className.replace(/theme-\w+/, 'theme-' + m) + (c ? ' ' + c : '');
}, [mode, classes]);
await pg.waitForTimeout(400);
await pg.screenshot({ path: out });
await browser.close();
console.log('wrote', out);
