/* Consolidation regression checks. Browser harness, not an Obsidian runtime.
   node integration.mjs
   PW_CHROMIUM=/path/to/chromium node integration.mjs */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const css = readFileSync(join(root, 'theme.css'), 'utf8');
const version = JSON.parse(readFileSync(join(root, 'manifest.json'))).version;
assert(css.startsWith(`/* Bookcloth ${version} `));
assert.equal(css.match(/--bc-version:\s*"([^"]+)"/)[1], version);
const shim = readFileSync(join(here, 'app-shim.css'), 'utf8');
const build = readFileSync(join(root, 'build.mjs'), 'utf8');
const files = [...build.matchAll(/^  "([^"]+\.css)",/gm)].map(m => m[1]);
assert.equal(new Set(files).size, files.length);
assert.equal(css.slice(css.indexOf('*/') + 2).trimStart(),
  files.map(f => readFileSync(join(root, 'src', f), 'utf8').trimEnd()).join('\n\n') + '\n');
for (const f of files) {
  const src = readFileSync(join(root, 'src', f), 'utf8');
  assert(!/^(<<<<<<<|=======|>>>>>>>)/m.test(src), `conflict marker in ${f}`);
  assert(!/\.mod-(left|right)(?:-split)?(?![\w-])/.test(
    src.replace(/:is\(\.mod-(?:left|right)(?:-split)?, \.mod-(?:primary|secondary)(?:-split)?\)/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')), `legacy-only selector in ${f}`);
}
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
let cases = 0;
try {
  for (const mode of ['light', 'dark']) {
    for (const modern of [false, true]) {
      const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await p.goto(pathToFileURL(join(here, 'index.html')).href);
      await p.evaluate(({ mode, modern, shim }) => {
        document.body.classList.replace('theme-light', `theme-${mode}`);
        if (modern) {
          const original = document.querySelector('link[href="app-shim.css"]');
          const style = document.createElement('style');
          style.textContent = shim.replace(/mod-left-split/g,'mod-primary-split').replace(/mod-right-split/g,'mod-secondary-split').replace(/mod-left/g,'mod-primary').replace(/mod-right/g,'mod-secondary');
          original.replaceWith(style);
          for (const [a,b] of [['mod-left','mod-primary'],['mod-right','mod-secondary'],
              ['mod-left-split','mod-primary-split'],['mod-right-split','mod-secondary-split']]) {
            for (const e of document.querySelectorAll('.'+a)) e.classList.replace(a,b);
          }
        }
        document.body.classList.add('bc-float-panes','bc-pane-glow');
      }, { mode, modern, shim });
      await p.waitForTimeout(900);
      const baseline = await p.evaluate(() => {
        const ribbons = [...document.querySelectorAll('.workspace-ribbon')];
        return ribbons.map(e => ({margin:getComputedStyle(e).marginBlockStart,
          radius:getComputedStyle(e).borderRadius, glow:getComputedStyle(e,'::before').display}));
      });
      assert(baseline.length > 0);
      for (const r of baseline) {
        assert.equal(r.margin, '0px'); assert.notEqual(r.radius,'0px'); assert.equal(r.glow,'block');
      }
      const side = await p.evaluate(() => [...document.querySelectorAll('.workspace-split')]
        .filter(e => /mod-(left|right|primary|secondary)-split/.test(e.className))
        .map(e => ({ radius:getComputedStyle(e).borderRadius, overflow:getComputedStyle(e).overflow, stacked:e.matches(':has(.workspace-tabs ~ .workspace-tabs)'), cards:[...e.querySelectorAll('.workspace-tabs')].map(t=>({radius:getComputedStyle(t).borderRadius,overflow:getComputedStyle(t).overflow})) })));
      assert.equal(side.length,2); assert(side.every(s => (s.stacked ? s.cards.every(c => c.radius !== '0px' && c.overflow === 'clip') : s.radius !== '0px' && s.overflow === 'clip')), JSON.stringify(side));
      await p.evaluate(() => {
        document.body.classList.add('bc-hide-ribbon');
        const modal = document.body.appendChild(document.createElement('div'));
        modal.className='modal-container taskpro-board-float';
        modal.innerHTML='<div class="modal-bg"></div><div class="modal taskpro-board-modal"></div>';
        document.body.classList.add('taskpro-board-is-floating');
      });
      await p.waitForTimeout(350);
      assert.equal(await p.locator('.workspace-ribbon').first().evaluate(e => getComputedStyle(e).opacity),'0');
      assert.equal(await p.locator('.app-container').evaluate(e => getComputedStyle(e).filter),'blur(14px)');
      assert.equal(await p.locator('.modal').evaluate(e => getComputedStyle(e).filter),'none');
      await p.evaluate(() => document.body.classList.add('bc-off-taskpro'));
      assert.equal(await p.locator('.app-container').evaluate(e => getComputedStyle(e).filter),'none');
      await p.setViewportSize({ width: 390, height: 844 });
      await p.evaluate(() => { document.body.classList.add('is-mobile','is-phone'); document.body.classList.remove('bc-off-taskpro'); });
      await p.waitForTimeout(350);
      assert.equal(await p.locator('.workspace-ribbon').first().evaluate(e => getComputedStyle(e).opacity),'1');
      assert.equal(await p.locator('.modal').evaluate(e => getComputedStyle(e).borderRadius),'0px');
      await p.emulateMedia({ reducedMotion:'reduce' });
      await p.evaluate(() => document.body.classList.add('bc-motion-expressive'));
      const motion = await p.locator('.modal').evaluate(e => ({duration:getComputedStyle(e).animationDuration,
        scroll:getComputedStyle(e).scrollBehavior}));
      assert(parseFloat(motion.duration) <= 0.00002); assert.equal(motion.scroll,'auto');
      await p.close(); cases++;
    }
    for (const callout of ['', 'bc-callout-rule', 'bc-callout-plain']) {
      for (const embed of ['', 'bc-embed-quiet', 'bc-embed-bare']) {
        const p = await browser.newPage();
        await p.goto(pathToFileURL(join(here,'embeds.html')).href);
        await p.evaluate(({mode,callout,embed}) => {
          document.body.classList.replace('theme-light',`theme-${mode}`);
          document.body.classList.add('bc-check-circle');
          for (const c of [callout,embed].filter(Boolean)) document.body.classList.add(c);
          for (const host of document.querySelectorAll('.callout, .markdown-embed')) {
            const hb = host.appendChild(document.createElement('div'));hb.className='hb-root';hb.textContent='tracker';
          }
        },{mode,callout,embed});
        await p.waitForTimeout(350);
        const result = await p.evaluate(() => {
          const cv=document.createElement('canvas');cv.width=cv.height=1;
          const ctx=cv.getContext('2d',{willReadFrequently:true});
          const paint=layers => {ctx.clearRect(0,0,1,1);for(const col of layers){ctx.fillStyle=col;ctx.fillRect(0,0,1,1);}return [...ctx.getImageData(0,0,1,1).data];};
          return [...document.querySelectorAll('.hb-root')].map(hb => {
            const cs=getComputedStyle(hb); const layers=[];
            for(let n=hb.parentElement;n;n=n.parentElement) layers.unshift(getComputedStyle(n).backgroundColor);
            const token=cs.getPropertyValue('--hb-page');
            const em=hb.closest('.markdown-embed'); const co=hb.closest('.callout');
            return {expected:paint(layers),actual:paint([token]),radius:cs.getPropertyValue('--hb-radius').trim(),
              tint:co && em ? [getComputedStyle(co).getPropertyValue('--bc-callout-c'),getComputedStyle(em).getPropertyValue('--bc-callout-c')] : null};
          });
        });
        assert(result.length > 0);
        for(const r of result){assert.deepEqual(r.actual,r.expected,`${mode}/${callout}/${embed}: Habbiter surface`);
          assert.equal(r.radius,'50%');if(r.tint) assert.equal(r.tint[0],r.tint[1],'embed inherits callout colour');}
        await p.evaluate(() => document.body.classList.add('bc-off-habbiter'));
        assert.equal(await p.locator('.hb-root').first().evaluate(e => getComputedStyle(e).getPropertyValue('--hb-radius').trim()),'');
        await p.close();cases++;
      }
    }
  }
  console.log(`integration checks passed: deterministic build, version, source selectors, ${cases} browser scenarios`);
} finally { await browser.close(); }
