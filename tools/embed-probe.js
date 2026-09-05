/* Bookcloth — embed probe. Paste into Obsidian's devtools console (Ctrl+Shift+I)
   with the note that has the misbehaving embed OPEN and VISIBLE, then:
     await app.vault.adapter.write('bookcloth-embed.txt', __bc)
   and send that file. It reads only; nothing is changed. */
(() => {
  const R = (n) => Math.round(n * 10) / 10;
  const cs = (el) => getComputedStyle(el);
  const out = [];
  const say = (s = '') => out.push(s);
  const name = (el) =>
    `${el.tagName.toLowerCase()}${(el.getAttribute('class') || '').trim() ? '.' + (el.getAttribute('class') || '').trim().split(/\s+/).slice(0, 3).join('.') : ''}`;
  const facts = (el) => {
    const s = cs(el);
    const r = el.getBoundingClientRect();
    const bits = [
      `box ${R(r.x)},${R(r.y)} ${R(r.width)}x${R(r.height)}`,
      /* display first: an inline box lays out horizontal padding and only
         paints the vertical, so a padding that looks right in the stylesheet
         does nothing on the top. Leaving this out of the dump is what turned
         one measurement into three rounds. */
      `display ${s.display}`,
      `dir ${s.direction}`,
      `ta ${s.textAlign}`,
      `ov ${s.overflowX}/${s.overflowY}`,
      `maxw ${s.maxWidth}`,
      `m ${s.marginTop}/${s.marginRight}/${s.marginBottom}/${s.marginLeft}`,
      `p ${s.paddingTop}/${s.paddingRight}/${s.paddingBottom}/${s.paddingLeft}`,
      `pos ${s.position}`,
    ];
    if (el.scrollWidth - el.clientWidth > 1) bits.push(`SCROLLS scrollW ${el.scrollWidth} clientW ${el.clientWidth} scrollLeft ${R(el.scrollLeft)}`);
    if (s.transform !== 'none') bits.push(`tf ${s.transform}`);
    return bits.join('  ');
  };

  const bs = cs(document.body);
  say(`theme version: ${bs.getPropertyValue('--bc-version').trim() || '(no --bc-version — this is NOT Bookcloth 2.6.1 or newer)'}`);
  say(`cssTheme: ${app?.vault?.getConfig?.('cssTheme')}   snippets: ${[...(app?.customCss?.enabledSnippets || [])].join(', ') || 'none'}`);
  say(`--embed-padding ${bs.getPropertyValue('--embed-padding').trim()}   --file-margins ${bs.getPropertyValue('--file-margins').trim()}   --file-line-width ${bs.getPropertyValue('--file-line-width').trim()}`);

  const embeds = [...document.querySelectorAll('.markdown-embed')].filter(
    (e) => e.getBoundingClientRect().height
  );
  say(`\nvisible .markdown-embed: ${embeds.length}`);

  embeds.slice(0, 2).forEach((em, i) => {
    say(`\n================ embed ${i + 1} — ${em.closest('.callout') ? 'inside a callout' : 'standalone'}`);
    say(`class="${em.getAttribute('class')}"`);
    say(`internal-embed on the same element: ${em.classList.contains('internal-embed') ? 'YES' : 'no'}`);

    say('\n-- outward, until the pane (which of these is doing the clipping):');
    let n = em.parentElement;
    for (let d = 0; n && d < 9; d++) {
      say(`  ${name(n)}\n     ${facts(n)}`);
      if (n.classList.contains('markdown-preview-view') || n.classList.contains('cm-scroller')) break;
      n = n.parentElement;
    }

    say('\n-- inward from the embed:');
    const walk = (el, depth) => {
      say(`${'  '.repeat(depth)}${name(el)}\n${'  '.repeat(depth)}   ${facts(el)}`);
      if (depth >= 4) return;
      [...el.children].slice(0, 5).forEach((c) => walk(c, depth + 1));
    };
    walk(em, 0);

    const r = em.getBoundingClientRect();
    const es = cs(em);
    const L = r.left + parseFloat(es.paddingLeft);
    const Rt = r.right - parseFloat(es.paddingRight);
    const over = [...em.querySelectorAll('*')]
      .filter((k) => !k.ownerSVGElement && k.getBoundingClientRect().height)
      .map((k) => {
        const kr = k.getBoundingClientRect();
        return { k, kr, over: Math.max(kr.right - Rt, L - kr.left) };
      })
      .filter((x) => x.over > 0.5)
      .sort((a, b) => b.over - a.over)
      .slice(0, 8);
    say(`\n-- past the content box [${R(L)}..${R(Rt)}]:`);
    say(
      over.length
        ? over.map((x) => `  ${name(x.k)}  over ${R(x.over)}px  [${R(x.kr.left)}..${R(x.kr.right)}]  pos ${cs(x.k).position}`).join('\n')
        : '  nothing'
    );

    const kids = [...em.querySelectorAll('*')].filter((k) => k.getBoundingClientRect().height);
    if (kids.length) {
      const lowest = Math.max(...kids.map((k) => k.getBoundingClientRect().bottom));
      say(`-- slack under the last line: ${R(r.bottom - lowest - parseFloat(es.paddingBottom))}px`);
    }
  });

  const text = out.join('\n');
  window.__bc = text;
  console.log(text.split('\n').slice(0, 25).join('\n'));
  console.log(`%c… ${out.length} lines in __bc`, 'color:#9b9a97');
  return "run:  await app.vault.adapter.write('bookcloth-embed.txt', __bc)";
})();
