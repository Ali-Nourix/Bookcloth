/* Bookcloth — embed doctor.
 *
 * Open the note with the misbehaving embed, then paste this whole file into
 * Obsidian's devtools console (Ctrl+Shift+I → Console) and run:
 *
 *     await app.vault.adapter.write('bookcloth-doctor.txt', __bc)
 *
 * It does three things a plain dump does not:
 *   1. accounts for the space on all four sides of the embed, and names what
 *      is producing each one;
 *   2. lists every CSS rule in every loaded stylesheet that targets the embed,
 *      in cascade order, so it is visible which one is winning and from where;
 *   3. TRIES candidate fixes on the live element one at a time, measures, and
 *      puts everything back — so the answer is measured in the real app rather
 *      than guessed at from a screenshot.
 *
 * The experiments set inline styles and remove them again. Nothing is saved,
 * no file is touched, and a reload undoes anything that somehow survives.
 */
(() => {
  const R = (n) => Math.round(n * 10) / 10;
  const cs = (el, p) => getComputedStyle(el, p);
  const out = [];
  const say = (s = '') => out.push(s);
  const name = (el) => {
    const c = (el.getAttribute?.('class') || '').trim();
    return `${el.tagName.toLowerCase()}${c ? '.' + c.split(/\s+/).slice(0, 3).join('.') : ''}`;
  };

  /* ---- pick the embed --------------------------------------------------- */
  const all = [...document.querySelectorAll('.markdown-embed')].filter(
    (e) => e.getBoundingClientRect().height > 0
  );
  const em = all.find((e) => e.closest('.callout')) || all[0];

  const bs = cs(document.body);
  say(`theme version : ${bs.getPropertyValue('--bc-version').trim() || '(none — not 2.6.1 or newer)'}`);
  say(`obsidian      : ${(navigator.userAgent.match(/obsidian\/([\d.]+)/i) || [, '?'])[1]}`);
  say(`visible embeds: ${all.length}`);
  if (!em) {
    say('no embed on screen — open the note that has it, then run this again');
    window.__bc = out.join('\n');
    console.log(window.__bc);
    return 'nothing to measure';
  }
  say(`chosen        : ${name(em)}  ${em.closest('.callout') ? '(inside a callout)' : '(standalone)'}`);
  say('');

  /* ---- where the space actually goes ------------------------------------ */
  const drawn = () => {
    const overlaid = (el) => {
      if (el.ownerSVGElement) return true;
      for (let n = el; n && n !== em; n = n.parentElement) {
        const p = cs(n).position;
        if (p === 'absolute' || p === 'fixed') return true;
      }
      return false;
    };
    return [...em.querySelectorAll('*')].filter((k) => {
      const r = k.getBoundingClientRect();
      return r.width > 0.5 && r.height > 0.5 && !overlaid(k);
    });
  };

  const gaps = () => {
    const r = em.getBoundingClientRect();
    const k = drawn();
    if (!k.length) return null;
    const rects = k.map((x) => x.getBoundingClientRect());
    return {
      top: R(Math.min(...rects.map((q) => q.top)) - r.top),
      bottom: R(r.bottom - Math.max(...rects.map((q) => q.bottom))),
      left: R(Math.min(...rects.map((q) => q.left)) - r.left),
      right: R(r.right - Math.max(...rects.map((q) => q.right))),
    };
  };

  const show = (label) => {
    const g = gaps();
    const s = cs(em);
    say(
      `  ${label.padEnd(30)} top ${String(g.top).padStart(6)}   right ${String(g.right).padStart(6)}` +
        `   bottom ${String(g.bottom).padStart(6)}   left ${String(g.left).padStart(6)}   ` +
        `[display ${s.display}, padding ${s.padding}]`
    );
    return g;
  };

  say('=== space inside the embed, per side ===');
  const before = show('as it is now');
  say('');
  say(`  computed display : ${cs(em).display}`);
  say(`  computed padding : ${cs(em).padding}`);
  say(`  computed margin  : ${cs(em).margin}`);
  say(`  parent           : ${name(em.parentElement)}  display ${cs(em.parentElement).display}`);
  say('');

  /* ---- the first few things in it, so a stray margin is visible ---------- */
  say('=== the first blocks inside, in order ===');
  const chain = [];
  let node = em;
  for (let d = 0; d < 6 && node; d++) {
    chain.push(node);
    node = [...node.children].find(
      (c) => cs(c).position !== 'absolute' && cs(c).display !== 'none'
    );
  }
  chain.forEach((n, i) => {
    const s = cs(n);
    const r = n.getBoundingClientRect();
    say(
      `${'  '.repeat(i)}${name(n)}\n${'  '.repeat(i)}   y ${R(r.y)} h ${R(r.height)}  display ${s.display}` +
        `  m ${s.marginTop}/${s.marginBottom}  p ${s.paddingTop}/${s.paddingBottom}  ov ${s.overflowX}/${s.overflowY}`
    );
  });
  say('');

  /* ---- every rule in every sheet that targets the embed ------------------ */
  say('=== rules targeting the embed, in cascade order ===');
  const WANT = /^(display|padding|margin|overflow|--embed-padding|--bc-embed-padding)/;
  let seen = 0;
  let scanned = 0;
  [...document.styleSheets].forEach((sheet, si) => {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      say(`  [sheet ${si}] unreadable`);
      return;
    }
    const walk = (list) => {
      for (const rule of list) {
        scanned++;
        /* Check the rule BEFORE recursing. Since CSS Nesting shipped, a plain
           CSSStyleRule also has a .cssRules — an empty list, which is truthy —
           so `if (rule.cssRules) continue` skips every style rule in the
           document. That is why the first version of this reported "none" in a
           vault with twenty-six stylesheets loaded, and why a real finding was
           read as an absence of one. */
        const sel = rule.selectorText;
        if (sel && rule.style && /markdown-embed|internal-embed|inline-embed/.test(sel)) {
          const decls = [];
          for (const prop of rule.style) {
            if (WANT.test(prop)) {
              decls.push(`${prop}: ${rule.style.getPropertyValue(prop)}${rule.style.getPropertyPriority(prop) ? ' !important' : ''}`);
            }
          }
          if (decls.length) {
            seen++;
            const who = sheet.ownerNode?.id || (sheet.href || '').split('/').pop() || `inline #${si}`;
            const hits = em.matches(sel.split(',').find((x) => { try { return em.matches(x.trim()); } catch { return false; } }) || '\u0000') ? ' ← matches this embed' : '';
            say(`  [${String(si).padStart(2)} ${who}] ${sel}${hits}`);
            decls.forEach((d) => say(`        ${d}`));
          }
        }
        /* anything that groups other rules: @media, @supports, @layer, and a
           nested rule inside a style rule */
        if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules);
      }
    };
    walk(rules);
  });
  say(`  (${scanned} rules scanned across ${document.styleSheets.length} stylesheets, ${seen} of them relevant)`);
  if (!seen) say('  none — and if that number of rules scanned looks like zero, this tool is broken, not the theme');

  /* the variables the padding is read through, since a hijacked value and a
     losing declaration look identical from a computed style */
  say('');
  say('=== the values behind the padding ===');
  for (const v of ['--bc-embed-padding', '--embed-padding', '--bc-gap-4', '--bc-density']) {
    say(`  ${v.padEnd(20)} body ${cs(document.body).getPropertyValue(v).trim() || '(unset)'}   on the embed ${cs(em).getPropertyValue(v).trim() || '(unset)'}`);
  }
  say(`  background ${cs(em).backgroundColor}   box-shadow ${cs(em).boxShadow.slice(0, 60)}`);
  say('');

  /* ---- try the candidate fixes, measure, put everything back ------------- */
  say('=== candidate fixes, applied live and then undone ===');
  const marks = [];
  const set = (el, prop, val) => {
    marks.push([el, prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
    el.style.setProperty(prop, val, 'important');
  };
  const undo = () => {
    while (marks.length) {
      const [el, prop, val, pri] = marks.pop();
      if (val) el.style.setProperty(prop, val, pri);
      else el.style.removeProperty(prop);
    }
  };

  const trial = (label, apply) => {
    try {
      apply();
      void em.offsetHeight;
      show(label);
    } finally {
      undo();
    }
  };

  const q = (sel) => [...em.querySelectorAll(sel)];
  trial('display:block', () => set(em, 'display', 'block'));
  trial('padding:12px', () => set(em, 'padding', '12px'));
  trial('display:block + padding:12px', () => {
    set(em, 'display', 'block');
    set(em, 'padding', '12px');
  });
  trial('+ hide an empty title', () => {
    set(em, 'display', 'block');
    set(em, 'padding', '12px');
    q('.markdown-embed-title').forEach((t) => {
      if (!t.textContent.trim()) set(t, 'display', 'none');
    });
  });
  trial('+ inner overflow visible', () => {
    set(em, 'display', 'block');
    set(em, 'padding', '12px');
    q('.markdown-embed-title').forEach((t) => {
      if (!t.textContent.trim()) set(t, 'display', 'none');
    });
    q('.markdown-embed-content, .markdown-preview-view').forEach((x) => set(x, 'overflow', 'visible'));
  });
  trial('+ zero every inner top margin', () => {
    set(em, 'display', 'block');
    set(em, 'padding', '12px');
    q('.markdown-embed-title').forEach((t) => {
      if (!t.textContent.trim()) set(t, 'display', 'none');
    });
    q('.markdown-embed-content, .markdown-preview-view').forEach((x) => set(x, 'overflow', 'visible'));
    const sizer = em.querySelector('.markdown-preview-sizer');
    if (sizer) [...sizer.children].forEach((c) => set(c, 'margin-top', '0'));
  });

  say('');
  const after = show('restored — must match "as it is now"');
  const same = ['top', 'right', 'bottom', 'left'].every((k) => Math.abs(after[k] - before[k]) < 0.5);
  say(same ? '  ✓ nothing was left changed' : '  ! the page did not come back to where it started — reload to be safe');

  const text = out.join('\n');
  window.__bc = text;
  console.log(text);
  return "run:  await app.vault.adapter.write('bookcloth-doctor.txt', __bc)";
})();
