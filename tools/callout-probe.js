/* Bookcloth — callout probe.
 *
 * Open the note whose callout looks wrong, make sure the callout is ON SCREEN,
 * then open the developer console (Ctrl+Shift+I) and paste this whole file in.
 * It defines two commands:
 *
 *   bcCallouts()     measure every callout that is currently rendered
 *   await bcSave()   write that measurement into the vault root as a .txt
 *
 * Send the file. Do not read the answer out of console.log — DevTools truncates
 * a long string, and copy() is a command-line API that does nothing when it is
 * called from inside a function.
 *
 * It only reads: getComputedStyle, getBoundingClientRect, and the list of
 * stylesheets the app has loaded. Nothing in the vault or the app is changed.
 */
(() => {
  const FILE = 'bookcloth-callouts.txt';
  const cs = (el, pseudo) => getComputedStyle(el, pseudo);
  const R = (n) => Math.round(n * 10) / 10;

  let out = [];
  const say = (s = '') => out.push(s);
  const rule = (t) => { say(); say(('=== ' + t + ' ').padEnd(70, '=')); };

  /* getAttribute rather than .className: on an SVG element className is an
     SVGAnimatedString and prints as [object SVGAnimatedString]. */
  const classes = (el) => (el.getAttribute('class') || '').trim();
  const name = (el) => {
    const c = classes(el);
    return el.tagName.toLowerCase() + (c ? '.' + c.split(/\s+/).slice(0, 4).join('.') : '');
  };

  const VARS = [
    '--bc-version',
    '--callout-color',
    '--callout-border-width',
    '--callout-border-opacity',
    '--callout-radius',
    '--callout-padding',
    '--bc-wash',
    '--bc-callout-edge',
    '--bc-callout-edge-a',
    '--bc-callout-edge-strength',
    '--bc-callout-edge-boost',
    '--bc-callout-edge-heavy',
    '--bc-callout-bar',
    '--background-primary',
  ];

  /* A 1x1 canvas composites for us. A callout background is a color-mix() and
     comes back as oklab(...); anything that parses three numbers out of that
     string is reading nonsense. */
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const paint = (layers) => {
    g.clearRect(0, 0, 1, 1);
    for (const c of layers) { try { g.fillStyle = c; } catch (e) { return 'unpaintable: ' + c; } g.fillRect(0, 0, 1, 1); }
    const d = g.getImageData(0, 0, 1, 1).data;
    return `rgb(${d[0]},${d[1]},${d[2]})`;
  };

  const groundStack = (el) => {
    const stack = [];
    for (let h = el.parentElement; h; h = h.parentElement) {
      const bg = cs(h).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') stack.unshift(bg);
    }
    return stack;
  };

  /* Every rule in every loaded sheet whose selector mentions a callout, in the
     order the browser holds them, with the file each came from. This is the
     part that settles an argument: a snippet, a plugin or another theme
     loading after Bookcloth can turn any of this off, and no amount of reading
     the theme source will show it.

     The walk checks `rule.cssRules.length`, not `rule.cssRules`. CSS Nesting
     gave every style rule a cssRules list — usually empty, but always truthy —
     so a recursive walk that tests the list for truthiness descends into every
     style rule and never reads the rule itself. That bug once made this kind
     of scan report "no rules found" in a vault with twenty-six stylesheets. */
  const scanSheets = () => {
    const hits = [];
    const walk = (rules, where) => {
      for (const r of rules) {
        const sel = r.selectorText;
        if (sel && r.style && /callout/i.test(sel)) {
          const decls = [];
          for (const prop of r.style) decls.push(`${prop}: ${r.style.getPropertyValue(prop)}${r.style.getPropertyPriority(prop) ? ' !' + r.style.getPropertyPriority(prop) : ''}`);
          hits.push({ where, sel, decls });
        }
        if (r.cssRules && r.cssRules.length) walk(r.cssRules, where);
      }
    };
    for (const sheet of document.styleSheets) {
      const node = sheet.ownerNode;
      let where = node?.id || node?.getAttribute?.('data-name') || sheet.href || node?.tagName || '?';
      if (node?.tagName === 'STYLE' && !node.id) {
        const head = (node.textContent || '').slice(0, 60).replace(/\s+/g, ' ');
        where = `<style> "${head}…"`;
      }
      try { walk(sheet.cssRules, where); } catch (e) { hits.push({ where, sel: '(cross-origin, unreadable)', decls: [] }); }
    }
    return hits;
  };

  window.bcCallouts = () => {
    out = [];
    const bs = cs(document.body);
    const V = (n, el) => (el ? cs(el) : bs).getPropertyValue(n).trim() || '(unset)';

    rule('ENVIRONMENT');
    say(`theme version  ${V('--bc-version')}`);
    say(`cssTheme       ${window.app?.vault?.getConfig?.('cssTheme') || '(unknown)'}`);
    say(`snippets       ${[...(window.app?.customCss?.enabledSnippets || [])].join(', ') || 'none'}`);
    say(`body classes   ${classes(document.body)}`);
    say(`stylesheets    ${document.styleSheets.length}`);
    /* Which of the two renderers is on screen. A callout in Live Preview is
       wrapped in .cm-embed-block.cm-callout; while the cursor is inside it,
       Obsidian throws that away and shows .HyperMD-quote lines instead, and
       then there is no .callout element to measure at all. */
    say(`view           ${document.querySelector('.markdown-source-view.is-live-preview') ? 'Live Preview' : document.querySelector('.markdown-source-view') ? 'Source' : document.querySelector('.markdown-preview-view') ? 'Reading' : '(none found)'}`);
    say(`  .callout ${document.querySelectorAll('.callout').length}   .cm-callout ${document.querySelectorAll('.cm-callout').length}   .HyperMD-quote ${document.querySelectorAll('.HyperMD-quote').length}`);
    say();
    say('body-level values:');
    for (const v of VARS) say(`  ${v.padEnd(28)} ${V(v)}`);

    const callouts = [...document.querySelectorAll('.callout')];
    rule(`CALLOUTS RENDERED: ${callouts.length}`);
    if (!callouts.length) {
      say('None. If the note is open, the cursor may be inside the callout —');
      say('Obsidian unwraps a callout into raw markdown lines while you edit it,');
      say('and there is no .callout element at all in that state. Click outside');
      say('it, or switch to Reading view, and run bcCallouts() again.');
    }

    /* At most two of each kind, and ten in all. A vault note can hold dozens
       and the interesting information is the kinds, not the count. */
    const perKind = new Map();
    const shown = callouts.filter((el) => {
      const k = el.getAttribute('data-callout') || '(none)';
      const n = (perKind.get(k) || 0) + 1;
      perKind.set(k, n);
      return n <= 2;
    }).slice(0, 10);
    if (shown.length < callouts.length) {
      say(`showing ${shown.length} of them: at most two of each kind.`);
      say(`kinds present: ${[...perKind].map(([k, n]) => `${k} x${n}`).join(', ')}`);
    }

    shown.forEach((el, i) => {
      const s = cs(el);
      const r = el.getBoundingClientRect();
      const before = cs(el, '::before');
      const stack = groundStack(el);
      const fill = paint([...stack, s.backgroundColor]);
      const edgeColor = s.outlineStyle !== 'none' ? s.outlineColor : s.borderInlineStartColor;

      say();
      say(`--- [${i}] data-callout="${el.getAttribute('data-callout')}"  ${name(el)}`);
      say(`    box            ${R(r.width)}x${R(r.height)} at ${R(r.x)},${R(r.y)}${r.width < 1 || r.height < 1 ? '   <- NOT LAID OUT' : ''}`);
      say(`    display        ${s.display}   position ${s.position}   overflow ${s.overflowX}/${s.overflowY}`);
      say(`    background     ${s.backgroundColor}`);
      say(`      composited   ${fill}`);
      say(`      over         ${stack.join('  over  ') || '(nothing opaque above it)'}`);
      say(`    outline        ${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}   offset ${s.outlineOffset}`);
      say(`    border         ${s.borderTopWidth}/${s.borderRightWidth}/${s.borderBottomWidth}/${s.borderLeftWidth} ${s.borderTopStyle} ${s.borderTopColor}`);
      say(`    box-shadow     ${s.boxShadow}`);
      say(`    radius         ${s.borderRadius}   padding ${s.padding}   margin ${s.margin}`);
      say(`    blend          ${s.mixBlendMode}   opacity ${s.opacity}   filter ${s.filter}`);
      say(`    edge painted   ${paint([...stack, s.backgroundColor, edgeColor])}   (from ${edgeColor})`);
      say(`    ::before       content ${before.content}   ${before.width}x${before.height}   bg ${before.backgroundColor}   image ${before.backgroundImage === 'none' ? 'none' : 'gradient'}`);
      say(`                   inset ${before.insetBlockStart}/${before.insetInlineStart}  position ${before.position}`);
      for (const v of VARS.slice(1)) {
        const own = cs(el).getPropertyValue(v).trim();
        if (own && own !== V(v)) say(`    ${v.padEnd(28)} ${own}   (body says ${V(v)})`);
        else if (v === '--callout-color') say(`    ${v.padEnd(28)} ${own || '(unset)'}`);
      }
      const chain = [];
      for (let h = el.parentElement; h && chain.length < 8; h = h.parentElement) {
        const hs = cs(h);
        chain.push(`      ${name(h)}   bg ${hs.backgroundColor}   overflow ${hs.overflowX}/${hs.overflowY}   display ${hs.display}`);
      }
      say('    ancestors:');
      say(chain.join('\n'));
    });

    const hits = scanSheets();
    rule(`RULES TARGETING CALLOUTS: ${hits.length} (in cascade order)`);
    say('The last one that matches an element wins at equal specificity, so the');
    say('bottom of this list is where an override lives.');
    let sheet = null;
    for (const h of hits) {
      if (h.where !== sheet) { sheet = h.where; say(); say(`  --- ${sheet}`); }
      say();
      say(`  ${h.sel}`);
      for (const d of h.decls) say(`      ${d}`);
    }

    window.__bc = out.join('\n');
    return `measured ${callouts.length} callouts and ${hits.length} rules — now run:  await bcSave()`;
  };

  window.bcSave = async (file = FILE) => {
    const text = window.__bc;
    if (!text) return 'nothing measured yet — run bcCallouts() first';
    const a = window.app?.vault?.adapter;
    if (a?.write) {
      await a.write(file, text);
      const base = a.getBasePath ? a.getBasePath() : '<vault>';
      return `wrote ${text.split('\n').length} lines to ${base}/${file} — send that file`;
    }
    return 'no vault adapter; the text is in the variable __bc';
  };

  return 'ready — run  bcCallouts()  then  await bcSave()';
})();
