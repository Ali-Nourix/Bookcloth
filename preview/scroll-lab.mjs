/* The smooth-scroll plugin, driven for real and held to what it claims.
 *
 * Loads companion/bookcloth-scroll/main.js into the harness with a stub of the
 * obsidian module, then turns a synthetic wheel over the note and samples
 * scrollTop on every frame. Synthetic wheel events never scroll natively in
 * Chromium, so any movement measured here is the plugin's, and a wheel the
 * plugin declines leaves the page exactly where it was.
 *
 *   node scroll-lab.mjs        exits non-zero if anything fails
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const PLUGIN = readFileSync('../companion/bookcloth-scroll/main.js', 'utf8');
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('file://' + process.cwd() + '/index.html');
await pg.evaluate(() => {
  document.body.className = 'theme-light mod-windows is-focused css-settings-manager bc-smooth-scroll';
});
await pg.waitForTimeout(300);

/* Boot the plugin the way Obsidian does: evaluate main.js with a require that
   resolves 'obsidian', take module.exports as the class, construct, onload. */
await pg.evaluate((src) => {
  class Plugin {
    constructor(app, manifest) { this.app = app; this.manifest = manifest; }
    registerDomEvent(el, type, cb, opts) { el.addEventListener(type, cb, opts); }
    registerEvent() {}
    addSettingTab() {}
  }
  const obsidian = { Plugin, PluginSettingTab: class {}, Setting: class {} };
  const module = { exports: {} };
  new Function('module', 'exports', 'require', src)(module, module.exports, (n) => (n === 'obsidian' ? obsidian : null));
  const app = { workspace: { on: () => ({}) } };
  window.__plugin = new module.exports(app, { id: 'bookcloth-scroll' });
  window.__plugin.onload();

  const leaf = document.querySelector('.workspace-split.mod-root .workspace-leaf');
  window.__sc = [...leaf.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 4);
  window.__p = window.__sc.querySelector('p');

  window.__wheel = (el, o = {}) => {
    const ev = new WheelEvent('wheel', {
      deltaY: o.deltaY ?? 100, deltaX: o.deltaX ?? 0, deltaMode: o.deltaMode ?? 0,
      ctrlKey: !!o.ctrl, shiftKey: !!o.shift, bubbles: true, cancelable: true,
    });
    Object.defineProperty(ev, 'wheelDeltaY', { value: o.wheelDeltaY ?? -Math.sign(o.deltaY ?? 100) * 120 });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  window.__sample = (el, ms) => new Promise((res) => {
    const out = [];
    const t0 = performance.now();
    const tick = (t) => {
      out.push({ t: t - t0, y: el.scrollTop });
      if (t - t0 < ms) requestAnimationFrame(tick); else res(out);
    };
    requestAnimationFrame(tick);
  });
  window.__settle = () => new Promise((r) => setTimeout(r, 50));
}, PLUGIN);

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const reset = (y = 200) => pg.evaluate(async (y) => {
  for (const g of [...window.__plugin.active]) window.__plugin.stop(g);
  window.__sc.scrollTop = y;
  await new Promise((r) => setTimeout(r, 60));
  return window.__sc.scrollTop;
}, y);

/* ---- the curve ------------------------------------------------------------ */
{
  const y0 = await reset(200);
  const r = await pg.evaluate(async () => {
    const prevented = window.__wheel(window.__p, { deltaY: 100 });
    const s = await window.__sample(window.__sc, 1400);
    return { prevented, s };
  });
  const ys = r.s.map((p) => p.y);
  const end = y0 + 100;
  const mono = ys.every((y, i) => i === 0 || y >= ys[i - 1] - 0.01);
  const distinct = new Set(ys.map((y) => y.toFixed(1))).size;
  const at = (f) => (r.s.find((p) => p.y - y0 >= f * 100) || { t: NaN }).t;
  const settle = (r.s.find((p) => Math.abs(p.y - end) < 0.5) || { t: NaN }).t;
  check('one notch is taken over', r.prevented);
  check('one notch lands exactly 100px on', Math.abs(ys.at(-1) - end) < 1, `ended at +${(ys.at(-1) - y0).toFixed(1)}`);
  check('it glides rather than jumps', distinct >= 10, `${distinct} distinct positions`);
  check('it never goes backwards', mono);
  check('it never overshoots', Math.max(...ys) <= end + 0.5);
  console.log(`\ncurve at the default glide (140ms): half way ${at(0.5).toFixed(0)}ms, 90% ${at(0.9).toFixed(0)}ms, settled ${settle.toFixed(0)}ms`);
}

/* ---- accumulation and acceleration --------------------------------------- */
const spin = async (gap, n, accel) => {
  const y0 = await reset(200);
  const y = await pg.evaluate(async ({ gap, n, accel }) => {
    document.body.style.setProperty('--bc-scroll-accel', String(accel));
    for (let i = 0; i < n; i++) {
      window.__wheel(window.__p, { deltaY: 100 });
      await new Promise((r) => setTimeout(r, gap));
    }
    await window.__sample(window.__sc, 1800);
    document.body.style.removeProperty('--bc-scroll-accel');
    return window.__sc.scrollTop;
  }, { gap, n, accel });
  return y - y0;
};
{
  const slow = await spin(220, 4, 1);
  check('four slow notches travel four notches', Math.abs(slow - 400) < 1.5, `+${slow.toFixed(1)}`);
  const fast = await spin(25, 4, 1);
  check('four fast notches travel further (1 + 1.25 + 1.5 + 1.75)', Math.abs(fast - 550) < 1.5, `+${fast.toFixed(1)}`);
  const flat = await spin(25, 4, 0);
  check('acceleration 0 turns the amplification off', Math.abs(flat - 400) < 1.5, `+${flat.toFixed(1)}`);
}

/* ---- what it must leave alone -------------------------------------------- */
{
  const leaves = async (name, prep, opts, undo) => {
    const y0 = await reset(200);
    const r = await pg.evaluate(async ({ prep, opts, undo }) => {
      if (prep) new Function(prep)();
      const prevented = window.__wheel(window.__p, opts);
      await new Promise((r) => setTimeout(r, 250));
      const y = window.__sc.scrollTop;
      if (undo) new Function(undo)();
      return { prevented, y };
    }, { prep, opts, undo });
    check(name, !r.prevented && Math.abs(r.y - y0) < 0.5, r.prevented ? 'was taken over' : '');
  };
  await leaves('switched off in Style Settings', "document.body.classList.remove('bc-smooth-scroll')", { deltaY: 100 }, "document.body.classList.add('bc-smooth-scroll')");
  await leaves('motion level None', "document.body.classList.add('bc-motion-none')", { deltaY: 100 }, "document.body.classList.remove('bc-motion-none')");
  await leaves('another theme is active', "const s=document.createElement('style');s.id='nt';s.textContent='body{--bc-version:initial!important}';document.head.append(s)", { deltaY: 100 }, "document.getElementById('nt').remove()");
  await leaves('ctrl + wheel (zoom)', null, { deltaY: 100, ctrl: true });
  await leaves('shift + wheel (sideways)', null, { deltaY: 100, shift: true });
  await leaves('a trackpad', null, { deltaY: 7.5, wheelDeltaY: -9 });
  await leaves('a notch straight after a trackpad event', null, { deltaY: 100 });
  await pg.waitForTimeout(400);
}
{
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  const y0 = await reset(200);
  const r = await pg.evaluate(() => window.__wheel(window.__p, { deltaY: 100 }));
  check('the system asks for reduced motion', !r);
  await pg.emulateMedia({ reducedMotion: 'no-preference' });
}
{
  const r = await pg.evaluate(async () => {
    const sc = window.__sc;
    sc.scrollTop = sc.scrollHeight;
    await new Promise((r) => setTimeout(r, 60));
    const down = window.__wheel(window.__p, { deltaY: 100 });
    sc.scrollTop = 0;
    await new Promise((r) => setTimeout(r, 60));
    const up = window.__wheel(window.__p, { deltaY: -100 });
    return { down, up };
  });
  check('at the bottom, a notch down is handed on', !r.down);
  check('at the top, a notch up is handed on', !r.up);
}
{
  const r = await pg.evaluate(async () => {
    const box = document.createElement('div');
    box.className = 'canvas-wrapper';
    box.style.cssText = 'height:120px;overflow:auto';
    box.innerHTML = '<div style="height:600px">canvas</div>';
    window.__p.after(box);
    const prevented = window.__wheel(box.firstChild, { deltaY: 100 });
    box.remove();
    return prevented;
  });
  check('a canvas keeps its wheel', !r);
}

/* ---- nesting --------------------------------------------------------------- */
{
  await reset(200);
  const r = await pg.evaluate(async () => {
    const box = document.createElement('div');
    box.style.cssText = 'height:120px;overflow:auto';
    box.innerHTML = '<div style="height:400px">inner</div>';
    window.__p.after(box);
    const outer0 = window.__sc.scrollTop;
    window.__wheel(box.firstChild, { deltaY: 100 });
    await window.__sample(window.__sc, 900);
    const inner1 = box.scrollTop, outer1 = window.__sc.scrollTop;
    box.scrollTop = box.scrollHeight;
    await new Promise((r) => setTimeout(r, 60));
    window.__wheel(box.firstChild, { deltaY: 100 });
    await window.__sample(window.__sc, 900);
    const outer2 = window.__sc.scrollTop;
    box.style.overscrollBehavior = 'contain';
    const contained = window.__wheel(box.firstChild, { deltaY: 100 });
    box.remove();
    return { inner1, outer0, outer1, outer2, contained };
  });
  check('an inner box that can scroll takes the wheel', Math.abs(r.inner1 - 100) < 1 && r.outer1 === r.outer0, `inner +${r.inner1}, outer +${r.outer1 - r.outer0}`);
  check('an inner box at its end hands on to the page', r.outer2 - r.outer1 > 99, `outer +${(r.outer2 - r.outer1).toFixed(1)}`);
  check('overscroll-behavior: contain keeps it in the box', !r.contained);
}

/* ---- interruptions ------------------------------------------------------- */
{
  const y0 = await reset(200);
  const r = await pg.evaluate(async () => {
    window.__wheel(window.__p, { deltaY: 100 });
    await new Promise((r) => setTimeout(r, 70));
    window.__sc.scrollTop += 400;
    await window.__sample(window.__sc, 1400);
    return window.__sc.scrollTop;
  });
  check('a jump mid-glide is carried along, not undone', Math.abs(r - (y0 + 500)) < 2, `ended +${(r - y0).toFixed(1)}, want +500`);
}
{
  const y0 = await reset(200);
  const r = await pg.evaluate(async () => {
    for (let i = 0; i < 3; i++) window.__wheel(window.__p, { deltaY: 100 });
    await new Promise((r) => setTimeout(r, 90));
    const before = window.__sc.scrollTop;
    window.__wheel(window.__p, { deltaY: -100 });
    const s = await window.__sample(window.__sc, 1400);
    return { before, turn: s.slice(0, 4).map((p) => p.y), end: window.__sc.scrollTop };
  });
  const turned = r.turn[2] < r.turn[0];
  check('a notch the other way turns it at once', turned && Math.abs(r.end - (r.before - 100)) < 30, `turned ${turned}, ended ${(r.end - r.before).toFixed(0)} from the turn`);
}
{
  await reset(200);
  const r = await pg.evaluate(async () => {
    for (let i = 0; i < 3; i++) window.__wheel(window.__p, { deltaY: 100 });
    await new Promise((r) => setTimeout(r, 80));
    window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const at = window.__sc.scrollTop;
    await new Promise((r) => setTimeout(r, 300));
    return { at, later: window.__sc.scrollTop };
  });
  check('a click stops the glide where it is', Math.abs(r.later - r.at) < 1, `moved ${(r.later - r.at).toFixed(1)} after the click`);
}
{
  const y0 = await reset(200);
  const r = await pg.evaluate(async () => {
    window.__sc.style.scrollBehavior = 'smooth';
    window.__wheel(window.__p, { deltaY: 100 });
    const s = await window.__sample(window.__sc, 1400);
    window.__sc.style.scrollBehavior = '';
    return s;
  });
  const ys = r.map((p) => p.y);
  check('scroll-behavior: smooth on the page does not double the ease', Math.abs(ys.at(-1) - (y0 + 100)) < 1 && ys.every((y, i) => !i || y >= ys[i - 1] - 0.01));
}

/* ---- frame-rate independence --------------------------------------------- */
{
  /* A fake clock stands in for requestAnimationFrame, so the same notch can be
     run at 30, 60 and 144 frames a second and compared at the same moment. */
  const r = await pg.evaluate(async () => {
    /* Acceleration off and the spin forgotten between runs: the three runs
       happen within a few milliseconds of real time, and would otherwise count
       as one fast spin of the wheel. */
    document.body.style.setProperty('--bc-scroll-accel', '0');
    const run = (hz) => {
      const plug = window.__plugin;
      for (const g of [...plug.active]) plug.stop(g);
      plug.spin = 0;
      plug.lastNotch = 0;
      window.__sc.scrollTop = 200;
      const real = { raf: window.requestAnimationFrame, caf: window.cancelAnimationFrame };
      let q = [];
      window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
      window.cancelAnimationFrame = () => { q = []; };
      window.__wheel(window.__p, { deltaY: 100 });
      /* Held against the exact curve, 100 x (1 - e^(-t / 140)), at every frame
         rather than at one moment: at 30Hz there is no frame at 150ms, and
         comparing the nearest frames of three rates compares three moments. */
      const dt = 1000 / hz;
      let t = 0, worst = 0;
      for (let i = 0; i < 400 && q.length; i++) {
        t += dt;
        const cbs = q; q = [];
        cbs.forEach((cb) => cb(t));
        const model = 100 * (1 - Math.exp(-t / 140));
        worst = Math.max(worst, Math.abs(window.__sc.scrollTop - 200 - model));
      }
      window.requestAnimationFrame = real.raf;
      window.cancelAnimationFrame = real.caf;
      return worst;
    };
    /* each rate run twice, measured on the second: the first teaches the
       plugin the frame interval, as the first scroll on a real display would. */
    const out = {};
    for (const hz of [30, 60, 144]) { run(hz); out[hz] = run(hz); }
    document.body.style.removeProperty('--bc-scroll-accel');
    return out;
  });
  /* 1px of the allowance is scrollTop rounding to whole pixels at this
     device pixel ratio; the ease itself is exact. */
  const worst = Math.max(r[30], r[60], r[144]);
  check('the glide follows the same curve at 30, 60 and 144 frames a second', worst < 1.5, `worst distance from the curve: 30Hz ${r[30].toFixed(2)}px, 60Hz ${r[60].toFixed(2)}px, 144Hz ${r[144].toFixed(2)}px`);
}

/* ---- idle ----------------------------------------------------------------- */
{
  await reset(200);
  const r = await pg.evaluate(async () => {
    window.__wheel(window.__p, { deltaY: 100 });
    await new Promise((r) => setTimeout(r, 1600));
    let frames = 0;
    const real = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => { frames++; return real(cb); };
    await new Promise((r) => setTimeout(r, 500));
    window.requestAnimationFrame = real;
    return { frames, active: window.__plugin.active.size };
  });
  check('nothing runs once it has settled', r.frames === 0 && r.active === 0, `${r.frames} frames requested, ${r.active} glides active`);
}

await browser.close();

console.log('');
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? `   (${r.detail})` : ''}`);
const bad = results.filter((r) => !r.ok);
console.log(bad.length ? `\n${bad.length} of ${results.length} failed` : `\nall ${results.length} hold`);
process.exit(bad.length ? 1 : 0);
