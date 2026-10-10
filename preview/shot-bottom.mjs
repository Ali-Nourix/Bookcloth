/* The bottom of the root pane, fade off then on, with text on the floor and
   again over empty space.   node shot-bottom.mjs [light|dark] */
import { chromium } from 'playwright';
const mode = process.argv[2] || 'dark';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto('file://' + process.cwd() + '/index.html');
const base = `theme-${mode} mod-macos is-focused`;
const place = g => p.evaluate(gap => {
  const leaf = document.querySelector('.workspace-split.mod-root .workspace-leaf');
  const sc = [...leaf.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 4);
  const sizer = leaf.querySelector('.markdown-preview-sizer');
  sc.scrollTop = sc.scrollHeight;
  const short = leaf.getBoundingClientRect().bottom - sizer.getBoundingClientRect().bottom;
  if (gap < 900 && short > 0) sc.scrollTop = Math.max(0, sc.scrollTop - short + 4 - gap);
  const r = leaf.getBoundingClientRect();
  return { x: r.x, y: r.bottom - 170, width: r.width, height: 172 };
}, g);
for (const [gap, tag] of [[0, 'text'], [999, 'empty']]) {
  const box = await place(gap);
  for (const [cls, name] of [[base, 'off'], [`${base} bc-edge-fade`, 'on']]) {
    await p.evaluate(c => { document.body.className = c; }, cls);
    await p.waitForTimeout(450);
    await p.screenshot({ path: `fade-${mode}-${tag}-${name}.png`, clip: box });
  }
}
await b.close();
console.log('wrote fade-' + mode + '-{text,empty}-{off,on}.png');
