/* Bookcloth — does an embed render all of its sections?
 *
 * Open the note with the embed that shows only its heading, keep the embed on
 * screen, open the console (Ctrl+Shift+I), paste this whole file, then:
 *
 *   await bcSections()     measure, try two candidate fixes live, put it back
 *   await bcSave()         write the result into the vault root, and send it
 *
 * Nothing is kept: each experiment edits the theme's rules in memory, waits,
 * counts, and restores them before the next one.
 *
 * The suspicion. Obsidian renders a preview lazily — only the sections that
 * fall inside the view's visible height — and it holds the rest of the height
 * open with an inline min-height on .markdown-preview-sizer. The theme resets
 * that min-height to 0 inside embeds and turns the inner view's overflow off.
 * If the renderer measures "visible height" from that view, the view is only
 * as tall as what has rendered so far, so it never renders past the first
 * section: a heading and nothing under it.
 */
(() => {
  const FILE = 'bookcloth-sections.txt';
  const out = [];
  const say = (s = '') => out.push(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const theme = [...document.styleSheets].find((s) => {
    try { return /Bookcloth/.test(s.ownerNode?.textContent?.slice(0, 200) || ''); } catch { return false; }
  });

  /* Every style rule in the theme whose selector matches `sel` and which sets
     `prop`, so an experiment can take that one declaration out and put it back. */
  const rulesSetting = (selRe, prop) => {
    const hits = [];
    const walk = (list) => {
      for (const r of list) {
        if (r.selectorText && r.style && selRe.test(r.selectorText) && r.style.getPropertyValue(prop)) {
          hits.push({ r, prop, v: r.style.getPropertyValue(prop), p: r.style.getPropertyPriority(prop) });
        }
        if (r.cssRules && r.cssRules.length) walk(r.cssRules);
      }
    };
    if (theme) walk(theme.cssRules);
    return hits;
  };
  const drop = (hits) => hits.forEach((h) => h.r.style.removeProperty(h.prop));
  const restore = (hits) => hits.forEach((h) => h.r.style.setProperty(h.prop, h.v, h.p));

  const measure = () => [...document.querySelectorAll('.markdown-embed')].map((em) => {
    const view = em.querySelector('.markdown-preview-view');
    const sizer = em.querySelector('.markdown-preview-sizer');
    const blocks = sizer ? [...sizer.children].filter((c) => !/pusher|mod-header|mod-footer/.test(c.className)) : [];
    const cs = view ? getComputedStyle(view) : null;
    return {
      src: em.getAttribute('src') || '(no src)',
      blocks: blocks.length,
      text: (sizer?.innerText || '').trim().slice(0, 60).replace(/\s+/g, ' '),
      sizerInline: sizer?.style.minHeight || '(none)',
      sizerComputed: sizer ? getComputedStyle(sizer).minHeight : '-',
      view: view ? `${view.clientHeight}/${view.scrollHeight} overflow ${cs.overflowY}` : '(no inner view)',
    };
  });

  const nudge = async () => {
    /* what makes Obsidian re-evaluate what is visible: a resize, and a scroll
       on each inner view and on the page. */
    window.dispatchEvent(new Event('resize'));
    document.querySelectorAll('.markdown-embed .markdown-preview-view, .markdown-preview-view, .cm-scroller')
      .forEach((v) => v.dispatchEvent(new Event('scroll')));
    await wait(600);
  };

  const report = (label, rows) => {
    say(`--- ${label}`);
    rows.forEach((m, i) => say(`  [${i}] blocks ${m.blocks}   sizer inline min-height ${m.sizerInline} (computed ${m.sizerComputed})   view ${m.view}\n       ${m.src}\n       "${m.text}"`));
  };

  window.bcSections = async () => {
    out.length = 0;
    const bs = getComputedStyle(document.body);
    say(`theme ${bs.getPropertyValue('--bc-version').trim() || '(not Bookcloth)'}   stylesheet found: ${!!theme}`);
    say(`embeds on screen: ${document.querySelectorAll('.markdown-embed').length}`);
    say();

    const before = measure();
    report('as it is', before);

    const minH = rulesSetting(/markdown-embed[^,]*markdown-preview-(sizer|view|section)/, 'min-height');
    drop(minH); await nudge();
    const a = measure();
    report(`A: theme min-height reset removed (${minH.length} declarations)`, a);
    restore(minH); await nudge();

    const ov = rulesSetting(/markdown-embed[^,]*(markdown-preview-view|markdown-embed-content)/, 'overflow')
      .concat(rulesSetting(/^\.markdown-embed-content$/, 'overflow'));
    drop(ov); await nudge();
    const b = measure();
    report(`B: theme overflow override removed (${ov.length} declarations)`, b);
    restore(ov); await nudge();

    drop(minH); drop(ov); await nudge();
    const c = measure();
    report('C: both removed', c);
    restore(minH); restore(ov); await nudge();

    say();
    const gain = (rows) => rows.map((m, i) => m.blocks - (before[i]?.blocks ?? 0));
    say(`blocks gained   A ${gain(a).join(',')}   B ${gain(b).join(',')}   C ${gain(c).join(',')}`);
    window.__bc = out.join('\n');
    return `done — ${document.querySelectorAll('.markdown-embed').length} embeds tried. Now: await bcSave()`;
  };

  window.bcSave = async (file = FILE) => {
    if (!window.__bc) return 'run  await bcSections()  first';
    await window.app.vault.adapter.write(file, window.__bc);
    return `wrote ${file} to the vault root — send it`;
  };

  return 'ready — run  await bcSections()  then  await bcSave()';
})();
