/* Report the geometry of the controls that are supposed to line up. The
   theme's claim is that every icon in the top band shares one centre line;
   this is how that is checked rather than eyeballed.

     node measure.mjs [light|dark] [page] [extra selectors…]
*/
import { chromium } from 'playwright';

const [mode = 'light', page = 'index.html'] = process.argv.slice(2);
const extra = process.argv.slice(4);

const DEFAULTS = [
  '.workspace-ribbon .side-dock-ribbon-action',
  '.workspace-split.mod-left-split .workspace-tab-header-container',
  '.workspace-split.mod-left-split .workspace-tab-header-inner',
  '.workspace-split.mod-root .workspace-tab-header-container',
  '.workspace-split.mod-root .workspace-tab-header',
  '.workspace-split.mod-root .workspace-tab-header-new-tab',
  '.sidebar-toggle-button .clickable-icon',
  '.tree-item-self.nav-file-title',
  '.view-header',
  '.markdown-preview-sizer',
  '.callout',
  '.status-bar',
];

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('file://' + process.cwd() + '/' + page);
await pg.evaluate((m) => {
  document.body.className = document.body.className.replace(/theme-\w+/, 'theme-' + m);
}, mode);
await pg.waitForTimeout(300);

const out = await pg.evaluate((sels) => sels.map((s) => {
  const els = [...document.querySelectorAll(s)];
  if (!els.length) return `${s} — not found`;
  return els.slice(0, 3).map((e) => {
    const r = e.getBoundingClientRect();
    return `${s}\n    x ${r.x.toFixed(1)}  y ${r.y.toFixed(1)}  w ${r.width.toFixed(1)}` +
           `  h ${r.height.toFixed(1)}  centre-y ${(r.y + r.height / 2).toFixed(1)}`;
  }).join('\n');
}).join('\n'), extra.length ? extra : DEFAULTS);

console.log(out);
await browser.close();
