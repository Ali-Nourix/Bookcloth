/* What the TaskPro floating board's blur costs, three ways.
 *
 *   node float-lab.mjs [light|dark]
 *
 * Loads the full workspace harness (index.html), opens a stand-in for the
 * plugin's floating board over it — the same two hooks the plugin adds,
 * `body.taskpro-board-is-floating` and `.modal-container.taskpro-board-float`
 * — and then repaints one row of the board every frame, which is what a
 * pointer moving down the board does. It reports frame times for:
 *
 *   theme     the rule in src/plugins/taskpro.css (filter on .app-container)
 *   none      the same page with the blur switched off (bc-off-taskpro)
 *   backdrop  backdrop-filter on the modal background instead
 *
 * The first two should be the same. If `theme` drifts towards `backdrop`,
 * something has made the blurred layer repaint with the board.
 */
import { chromium } from 'playwright';

const [mode = 'dark'] = process.argv.slice(2);
// PW_CHROMIUM points at a browser already on the machine when Playwright's own
// download does not match the installed version.
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const results = {};

for (const variant of ['theme', 'none', 'backdrop']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file://' + process.cwd() + '/index.html');
  const timing = await page.evaluate(
    async ([variant, mode]) => {
      document.body.className = document.body.className.replace(/theme-\w+/, 'theme-' + mode);
      if (variant === 'none') document.body.classList.add('bc-off-taskpro');
      if (variant === 'backdrop') {
        document.body.classList.add('bc-off-taskpro');
        const style = document.head.appendChild(document.createElement('style'));
        style.textContent = '.modal-container.taskpro-board-float .modal-bg { backdrop-filter: blur(14px); }';
      }

      // A board-shaped modal: forty rows, as tall as the window allows.
      const container = document.body.appendChild(document.createElement('div'));
      container.className = 'modal-container taskpro-board-float mod-dim';
      container.innerHTML =
        '<div class="modal-bg"></div><div class="modal taskpro-board-modal" style="width:calc(100vw - 80px);height:calc(100vh - 80px);max-width:none;max-height:none;overflow:auto"><div class="modal-content"></div></div>';
      const content = container.querySelector('.modal-content');
      for (let i = 0; i < 40; i++) {
        const row = content.appendChild(document.createElement('div'));
        row.style.cssText = 'display:flex;gap:12px;padding:8px 12px;border-bottom:1px solid var(--background-modifier-border)';
        row.textContent = `Task ${i} with a title long enough to fill most of the row`;
      }
      document.body.classList.add('taskpro-board-is-floating');
      await new Promise((r) => setTimeout(r, 300));

      const rows = [...content.children];
      const times = [];
      let last = performance.now();
      for (let i = 0; i < 150; i++) {
        rows.forEach((row, j) => (row.style.background = j === i % rows.length ? 'var(--background-modifier-hover)' : ''));
        await new Promise(requestAnimationFrame);
        const now = performance.now();
        times.push(now - last);
        last = now;
      }
      times.shift();
      times.sort((a, b) => a - b);
      return {
        avg: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1),
        p90: +times[Math.floor(times.length * 0.9)].toFixed(1),
        filter: getComputedStyle(document.querySelector('body > .app-container')).filter,
      };
    },
    [variant, mode]
  );
  results[variant] = timing;
  await page.close();
}

await browser.close();
for (const [variant, r] of Object.entries(results)) {
  console.log(`${variant.padEnd(9)} avg ${String(r.avg).padStart(5)} ms   p90 ${String(r.p90).padStart(5)} ms   app filter: ${r.filter}`);
}
const drift = results.theme.avg - results.none.avg;
console.log(drift < 2 ? 'FLOAT_OK — the theme blur costs nothing per frame' : `FLOAT_SLOW — the theme blur adds ${drift.toFixed(1)} ms a frame`);
process.exit(drift < 2 ? 0 : 1);
