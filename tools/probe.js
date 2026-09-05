/* Bookcloth — live geometry probe.
 *
 * Paste the whole file into Obsidian's devtools console (Ctrl+Shift+I → Console)
 * while your real vault is open, then copy the output back.
 *
 *   bcProbe()                   every section
 *   bcProbe('ribbon','editor')  only those sections
 *   bcProbe('tree')             DOM skeleton with real class names
 *   await bcBaseline()          the same run with the theme off, then restored
 *   await bcSave()              write the last output into the vault root
 *
 * Always take the output through bcSave. DevTools truncates a long string in
 * console.log, and copy() is a command-line API that only exists at the top
 * level of what you type — calling it from inside a function does nothing.
 *
 * bcProbe only reads: getBoundingClientRect and getComputedStyle. Nothing is
 * changed. bcBaseline is the one exception — it switches to the default theme,
 * measures, and switches back, so both runs can be compared. If it is
 * interrupted, Settings -> Appearance -> Themes puts Bookcloth back.
 */
(() => {
  const R = (n) => Math.round(n * 10) / 10;
  const cs = (el, pseudo) => getComputedStyle(el, pseudo);
  const px = (v) => (v == null ? '?' : String(v).replace(/px$/, ''));
  const SIDES = ['top', 'right', 'bottom', 'left'];

  let out = [];
  const say = (s = '') => out.push(s);

  const quad = (s, prop, suffix = '') => {
    const v = SIDES.map((k) => px(s[`${prop}-${k}${suffix}`]));
    return v.every((x) => x === v[0]) ? v[0] : v.join('/');
  };

  const box = (el) => {
    const r = el.getBoundingClientRect();
    return `${R(r.x)},${R(r.y)} ${R(r.width)}x${R(r.height)}`;
  };

  /* one line per element: geometry first, then only what differs from the default */
  const line = (el, label, depth = 0, extras = []) => {
    const s = cs(el);
    const bits = [`box ${box(el)}`];

    if (s.position !== 'static') {
      const off = SIDES.map((k) => px(s[k])).join('/');
      bits.push(`pos ${s.position} ${off}`);
    } else bits.push('pos static');

    const m = quad(s, 'margin');
    if (m !== '0') bits.push(`m ${m}`);
    const p = quad(s, 'padding');
    if (p !== '0') bits.push(`p ${p}`);
    const b = quad(s, 'border', '-width');
    if (b !== '0') bits.push(`b ${b}`);
    const rad = ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((k) => px(s[`border-${k}-radius`]));
    if (rad.some((x) => x !== '0')) bits.push(`r ${rad.every((x) => x === rad[0]) ? rad[0] : rad.join('/')}`);

    if (s.display !== 'block') bits.push(`d ${s.display}`);
    if (s.display.includes('flex') || s.display.includes('grid')) {
      if (s.gap !== 'normal' && s.gap !== '0px') bits.push(`gap ${px(s.gap)}`);
      if (s.flexDirection !== 'row') bits.push(s.flexDirection);
      if (s.alignItems !== 'normal') bits.push(`ai ${s.alignItems}`);
      if (s.justifyContent !== 'normal') bits.push(`jc ${s.justifyContent}`);
    }
    if (s.flex !== '0 1 auto') bits.push(`flex ${s.flex}`);
    if (s.overflow !== 'visible') bits.push(`ov ${s.overflow}`);
    if (s.opacity !== '1') bits.push(`op ${s.opacity}`);
    if (s.visibility !== 'visible') bits.push(s.visibility);
    if (s.transform !== 'none') bits.push(`tf ${s.transform}`);
    if (s.zIndex !== 'auto') bits.push(`z ${s.zIndex}`);
    const bg = s.backgroundColor;
    if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') bits.push(`bg ${bg.replace(/\s/g, '')}`);
    if (s.boxShadow !== 'none') bits.push('shadow');

    for (const k of extras) bits.push(`${k} ${String(s[k]).replace(/\s/g, '')}`);

    say(`${'  '.repeat(depth)}${label}`);
    say(`${'  '.repeat(depth)}  ${bits.join('  ')}`);
  };

  /* probe a selector: report how many matched, then detail the first few */
  const probe = (sel, { depth = 0, n = 1, extras = [], label } = {}) => {
    const els = [...document.querySelectorAll(sel)];
    if (!els.length) {
      say(`${'  '.repeat(depth)}${label || sel}   —— no match`);
      return [];
    }
    const shown = els.slice(0, n);
    shown.forEach((el, i) => {
      const tag = `${label || sel}${els.length > 1 ? ` [${i + 1}/${els.length}]` : ''}`;
      line(el, tag, depth, extras);
    });
    return els;
  };

  const head = (title) => {
    say('');
    say(`### ${title}`);
  };

  const TEXT = ['fontSize', 'fontWeight', 'lineHeight', 'color'];
  const ICON = ['width', 'height', 'strokeWidth'];

  /* ---------------------------------------------------------------- sections */
  const S = {};

  S.env = () => {
    head('env');
    const app = window.app;
    const ua = navigator.userAgent;
    const ver = (re) => (ua.match(re) || [, '?'])[1];
    say(`obsidian  ${ver(/obsidian\/([\d.]+)/i)}   electron ${ver(/Electron\/([\d.]+)/)}   chrome ${ver(/Chrome\/([\d.]+)/)}`);
    say(`platform  ${navigator.platform}   dpr ${window.devicePixelRatio}   window ${window.innerWidth}x${window.innerHeight}`);
    say(`html      ${document.documentElement.className || '(none)'}`);
    say(`body      ${document.body.className}`);
    say(`mode      ${document.body.classList.contains('theme-dark') ? 'dark' : 'light'}`);

    /* appearance settings change geometry as much as any rule does */
    const cfg = (k) => {
      try {
        const v = app?.vault?.getConfig?.(k);
        return v === undefined ? null : JSON.stringify(v);
      } catch {
        return null;
      }
    };
    const KEYS = ['cssTheme', 'accentColor', 'baseFontSize', 'interfaceFontFamily', 'textFontFamily',
      'monospaceFontFamily', 'translucency', 'nativeMenus', 'showInlineTitle', 'showViewHeader',
      'showRibbon', 'readableLineLength', 'strictLineBreaks', 'foldHeading', 'legacyEditor'];
    const set = KEYS.map((k) => [k, cfg(k)]).filter(([, v]) => v !== null);
    if (set.length) say(`config    ${set.map(([k, v]) => `${k}=${v}`).join('  ')}`);

    /* every one of these can add rules and rewrite the DOM, so name them */
    const snippets = [...(app?.customCss?.enabledSnippets || [])];
    say(`snippets  ${snippets.length ? snippets.join(', ') : '(none)'}`);
    const plugins = [...(app?.plugins?.enabledPlugins || [])].sort();
    say(`plugins   ${plugins.length}: ${plugins.join(', ')}`);

    /* an inline sheet is a snippet, a plugin, or the theme — say which */
    const sheets = [...document.styleSheets].map((sh) => {
      const n = sh.ownerNode;
      if (!n) return 'detached';
      if (n.id) return `#${n.id}`;
      if (sh.href) return sh.href.replace(/^app:\/\/obsidian\.md\//, 'app:');
      const first = (() => {
        try {
          return sh.cssRules[0]?.cssText?.slice(0, 40).replace(/\s+/g, ' ');
        } catch {
          return null;
        }
      })();
      return `inline[${sh.cssRules?.length ?? '?'}]${first ? ` ${first}…` : ''}`;
    });
    say(`sheets    ${sheets.length}`);
    sheets.forEach((x, i) => say(`  [${String(i).padStart(2)}] ${x}`));
  };

  S.tokens = () => {
    head('tokens (as the app computes them on body)');
    const s = cs(document.body);
    /* --bc-* is the theme's own and already in git; what matters here is what
       the app itself computes, so those are skipped to keep the paste small. */
    const keep = /^--(size|icon|ribbon|header|tab|nav|sidebar|status-bar|frame|titlebar|input|toggle|checkbox|radius|modal|prompt|menu|divider|layer|file|line-height|font-ui|font-text-size|p-spacing|indentation|slider|scrollbar|swatch|blockquote|table|code|callout|embed|zoom|workspace|background-(primary|secondary|modifier-(border|hover))|text-(normal|muted|faint|accent))/;
    const skip = /^--bc-/;
    const names = [...s].filter((n) => n.startsWith('--') && keep.test(n)).sort();
    const seen = new Set();
    for (const n of names) {
      if (seen.has(n)) continue;
      seen.add(n);
      if (skip.test(n)) continue;
      let v = s.getPropertyValue(n).trim().replace(/\s+/g, ' ');
      if (v.length > 96) v = v.slice(0, 93) + '...';
      if (v) say(`${n.padEnd(34)} ${v}`);
    }
    say(`(${seen.size} variables)`);
  };

  S.frame = () => {
    head('frame');
    probe('.titlebar', { extras: [] });
    probe('.titlebar-inner');
    probe('.titlebar-button-container');
    probe('.titlebar-button', { n: 3 });
    probe('.app-container');
    probe('.horizontal-main-container');
    probe('.workspace');
    probe('.status-bar');
    probe('.status-bar-item', { n: 3, extras: TEXT });
  };

  S.ribbon = () => {
    head('ribbon');
    probe('.workspace-ribbon.mod-left');
    probe('.workspace-ribbon.mod-left .sidebar-toggle-button', { depth: 1 });
    probe('.workspace-ribbon.mod-left .workspace-ribbon-collapse-btn', { depth: 1 });
    probe('.workspace-ribbon.mod-left .side-dock-actions', { depth: 1 });
    probe('.workspace-ribbon.mod-left .side-dock-actions > *', { depth: 2, n: 4 });
    probe('.workspace-ribbon.mod-left .side-dock-actions > * > svg', { depth: 3, n: 2, extras: ICON });
    probe('.workspace-ribbon.mod-left .side-dock-settings', { depth: 1 });
    probe('.workspace-ribbon.mod-left .side-dock-settings > *', { depth: 2, n: 2 });
    probe('.workspace-ribbon.mod-right');
  };

  S.leftsplit = () => {
    head('left split');
    probe('.workspace-split.mod-left-split');
    probe('.workspace-split.mod-left-split > .workspace-tabs', { depth: 1, n: 2 });
    probe('.workspace-split.mod-left-split .workspace-tab-header-container', { depth: 2 });
    probe('.workspace-split.mod-left-split .workspace-tab-header', { depth: 3, n: 3 });
    probe('.workspace-split.mod-left-split .workspace-tab-header-inner', { depth: 4 });
    probe('.workspace-split.mod-left-split .workspace-tab-header-inner-icon svg', { depth: 5, extras: ICON });
    probe('.workspace-split.mod-left-split .view-header', { depth: 2, n: 2 });
    probe('.workspace-split.mod-left-split .view-content', { depth: 2, n: 2 });
    probe('.workspace-split.mod-left-split .nav-header', { depth: 3 });
    probe('.workspace-split.mod-left-split .nav-buttons-container', { depth: 4 });
    probe('.workspace-split.mod-left-split .nav-action-button', { depth: 5, n: 3 });
    probe('.workspace-split.mod-left-split .nav-action-button svg', { depth: 6, extras: ICON });
    probe('.workspace-split.mod-left-split .nav-files-container', { depth: 3 });
    probe('.workspace-split.mod-left-split .tree-item-self', { depth: 4, n: 4, extras: TEXT });
    probe('.workspace-split.mod-left-split .tree-item-icon', { depth: 5, n: 2 });
    probe('.workspace-split.mod-left-split .tree-item-icon svg', { depth: 6, n: 2, extras: ICON });
    probe('.workspace-split.mod-left-split .tree-item-inner', { depth: 5, n: 2, extras: TEXT });
    probe('.workspace-split.mod-left-split .workspace-leaf-resize-handle', { depth: 1 });
  };

  S.rightsplit = () => {
    head('right split');
    probe('.workspace-split.mod-right-split');
    const tabs = [...document.querySelectorAll('.workspace-split.mod-right-split > .workspace-tabs')];
    say(`stacked panes: ${tabs.length}`);
    tabs.forEach((el, i) => {
      line(el, `> .workspace-tabs [${i + 1}]`, 1);
      const h = el.querySelector('.workspace-tab-header-container');
      if (h) line(h, '.workspace-tab-header-container', 2);
      const v = el.querySelector('.view-content');
      if (v) line(v, '.view-content', 2);
    });
    probe('.workspace-split.mod-right-split .view-header', { depth: 2, n: 2 });
    probe('.workspace-split.mod-right-split .tree-item-self', { depth: 3, n: 2, extras: TEXT });
    probe('.workspace-split.mod-right-split .outgoing-link-item', { depth: 3, n: 2 });
    probe('.workspace-split.mod-right-split .backlink-pane', { depth: 3 });
  };

  S.root = () => {
    head('root split');
    probe('.workspace-split.mod-root');
    probe('.workspace-split.mod-root > .workspace-tabs', { depth: 1, n: 3 });
    probe('.workspace-split.mod-root .workspace-tab-header-container', { depth: 2, n: 2 });
    probe('.workspace-split.mod-root .workspace-tab-header-container-inner', { depth: 3 });
    probe('.workspace-split.mod-root .workspace-tab-header.is-active', { depth: 3, extras: TEXT });
    probe('.workspace-split.mod-root .workspace-tab-header:not(.is-active)', { depth: 3, extras: TEXT });
    probe('.workspace-split.mod-root .workspace-tab-header-new-tab', { depth: 3 });
    probe('.workspace-split.mod-root .workspace-tab-header-tab-list', { depth: 3 });
    probe('.workspace-split.mod-root .sidebar-toggle-button.mod-right', { depth: 2 });
    probe('.workspace-split.mod-root .workspace-leaf', { depth: 2, n: 1 });
    probe('.workspace-split.mod-root .workspace-leaf-content', { depth: 3 });
    probe('.workspace-split.mod-root .view-header', { depth: 4 });
    probe('.workspace-split.mod-root .view-header-title', { depth: 5, extras: TEXT });
    probe('.workspace-split.mod-root .view-actions', { depth: 5 });
    probe('.workspace-split.mod-root .view-action', { depth: 6, n: 3 });
    probe('.workspace-split.mod-root .view-content', { depth: 4 });
  };

  S.editor = () => {
    head('editor');
    probe('.markdown-source-view');
    probe('.cm-editor', { depth: 1 });
    probe('.cm-scroller', { depth: 2 });
    probe('.cm-sizer', { depth: 3 });
    probe('.cm-contentContainer', { depth: 4 });
    probe('.cm-content', { depth: 5, extras: [...TEXT, 'maxWidth'] });
    probe('.cm-line', { depth: 6, n: 2, extras: TEXT });
    probe('.inline-title', { depth: 3, extras: TEXT });
    probe('.metadata-container', { depth: 3 });
    probe('.metadata-properties-heading', { depth: 4, extras: TEXT });
    probe('.metadata-property', { depth: 4, n: 3 });
    probe('.metadata-property-key', { depth: 5, n: 2 });
    probe('.metadata-property-key-input', { depth: 6, n: 2, extras: TEXT });
    probe('.metadata-property-value', { depth: 5, n: 2 });
    probe('.metadata-property-value input', { depth: 6, n: 2, extras: TEXT });
    probe('.markdown-preview-view', { n: 1 });
    probe('.markdown-preview-sizer', { depth: 1 });
    probe('.markdown-preview-section', { depth: 2, n: 2 });
    probe('.markdown-rendered h1', { depth: 3, extras: TEXT });
    probe('.markdown-rendered h2', { depth: 3, extras: TEXT });
    probe('.markdown-rendered p', { depth: 3, n: 1, extras: TEXT });
    probe('.markdown-rendered blockquote', { depth: 3 });
    probe('.markdown-rendered pre', { depth: 3 });
    probe('.markdown-rendered table', { depth: 3 });
    probe('.markdown-rendered th', { depth: 4, n: 1, extras: TEXT });
    probe('.markdown-rendered td', { depth: 4, n: 1, extras: TEXT });
    probe('.callout', { depth: 3, n: 2 });
    probe('.callout-title', { depth: 4, extras: TEXT });
    probe('.callout-icon svg', { depth: 5, extras: ICON });
  };

  S.embeds = () => {
    head('embeds (open a note that transcludes another, ideally inside a callout)');
    const els = [...document.querySelectorAll('.markdown-embed')];
    say(`.markdown-embed on screen: ${els.length}`);
    if (!els.length) {
      say('  nothing to measure — open a note with ![[Some note#Heading]] in it');
      return;
    }
    els.slice(0, 4).forEach((em, i) => {
      const inCallout = !!em.closest('.callout');
      const cls = em.getAttribute('class') || '';
      line(em, `embed[${i + 1}] ${inCallout ? 'inside a callout' : 'standalone'}  class="${cls}"`, 1);

      /* the classes on one element or on two decides whether a descendant
         selector like `.internal-embed .markdown-embed` matches anything */
      const both = em.classList.contains('internal-embed');
      say(`    internal-embed on the same element: ${both ? 'YES' : 'no (nested markup)'}`);

      for (const sel of ['.markdown-embed-link', '.markdown-embed-title', '.markdown-embed-content',
        '.markdown-preview-view', '.markdown-preview-sizer', '.markdown-preview-section']) {
        const el = em.querySelector(sel);
        if (el) line(el, sel, 2);
        else say(`      ${sel}  —— not present`);
      }

      /* the two numbers that say whether it is a block or a page pretending
         to be one: dead space under the last line, and anything past the edge */
      const es = cs(em);
      const box = em.getBoundingClientRect();
      const kids = [...em.querySelectorAll('*')].filter((k) => k.getBoundingClientRect().height);
      if (kids.length) {
        const lowest = Math.max(...kids.map((k) => k.getBoundingClientRect().bottom));
        say(`      slack under last line: ${R(box.bottom - lowest - parseFloat(es.paddingBottom))}px`);
        const l = box.left + parseFloat(es.paddingLeft);
        const r = box.right - parseFloat(es.paddingRight);
        /* same exclusions as preview/invariants.mjs, so the two agree: an
           absolutely positioned overlay resolves its insets against the
           padding box and sits outside the content box on purpose, and a pre
           or a table is allowed to scroll inside itself. */
        const overlaid = (k) => {
          if (k.ownerSVGElement) return true;
          if (k.closest('pre, table')) return true;
          for (let n = k; n && n !== em; n = n.parentElement) {
            const pos = cs(n).position;
            if (pos === 'absolute' || pos === 'fixed') return true;
          }
          return cs(k).overflowX !== 'visible';
        };
        const over = kids
          .filter((k) => !overlaid(k))
          .map((k) => {
            const kr = k.getBoundingClientRect();
            return Math.max(kr.right - r, l - kr.left);
          })
          .filter((n) => n > 0.5);
        say(`      widest overflow past the content box: ${over.length ? R(Math.max(...over)) + 'px' : 'none'}`);
      }
    });
  };

  S.tasks = () => {
    head('tasks');
    const sel = 'input[type="checkbox"]';
    const boxes = [...document.querySelectorAll(`.markdown-rendered ${sel}, .cm-content ${sel}, .task-list-item-checkbox`)];
    say(`task checkboxes found: ${boxes.length}`);
    boxes.slice(0, 6).forEach((el, i) => {
      const li = el.closest('[data-task], .task-list-item, .HyperMD-task-line');
      const task = el.getAttribute('data-task') ?? li?.getAttribute('data-task') ?? '(none)';
      line(el, `checkbox[${i + 1}] data-task="${task}" checked=${el.checked} classes="${el.className}"`, 1, ['appearance', 'backgroundImage']);
      if (li) say(`    owner  <${li.tagName.toLowerCase()} class="${li.className}" data-task="${li.getAttribute('data-task')}">`);
    });
  };

  S.controls = () => {
    head('controls');
    probe('.checkbox-container', { n: 2 });
    const t = document.querySelector('.checkbox-container');
    if (t) {
      const a = cs(t, '::after');
      say(`  ::after  w ${px(a.width)}  h ${px(a.height)}  top ${px(a.top)}  left ${px(a.left)}  tf ${a.transform}  r ${px(a.borderTopLeftRadius)}  bg ${a.backgroundColor.replace(/\s/g, '')}`);
    }
    probe('input[type="text"]', { n: 2, extras: TEXT });
    probe('input[type="search"]', { n: 1 });
    probe('.search-input-container', { n: 1 });
    probe('select, .dropdown', { n: 2, extras: [...TEXT, 'backgroundImage'] });
    probe('button:not(.clickable-icon)', { n: 3, extras: TEXT });
    probe('.clickable-icon', { n: 4 });
    probe('.clickable-icon svg', { n: 3, extras: ICON });
    probe('.slider', { n: 1 });
    probe('.setting-item', { n: 2 });
    probe('.setting-item-info', { depth: 1, n: 1 });
    probe('.setting-item-name', { depth: 2, n: 1, extras: TEXT });
    probe('.setting-item-description', { depth: 2, n: 1, extras: TEXT });
    probe('.setting-item-control', { depth: 1, n: 1 });
  };

  S.overlays = () => {
    head('overlays (open a menu / modal / quick switcher first)');
    probe('.modal-container');
    probe('.modal-bg', { depth: 1 });
    probe('.modal', { depth: 1 });
    probe('.modal-title', { depth: 2, extras: TEXT });
    probe('.modal-close-button', { depth: 2 });
    probe('.prompt', { depth: 1 });
    probe('.prompt-input', { depth: 2, extras: TEXT });
    probe('.prompt-results', { depth: 2 });
    probe('.suggestion-item', { depth: 3, n: 2, extras: TEXT });
    probe('.menu');
    probe('.menu-item', { depth: 1, n: 3, extras: TEXT });
    probe('.menu-item-icon svg', { depth: 2, extras: ICON });
    probe('.menu-separator', { depth: 1 });
    probe('.notice-container');
    probe('.notice', { depth: 1, extras: TEXT });
    probe('.tooltip', { extras: TEXT });
    probe('.popover.hover-popover');
  };

  S.icons = () => {
    head('icon census — every svg on screen, grouped by rendered size');
    const groups = new Map();
    for (const svg of document.querySelectorAll('svg')) {
      const r = svg.getBoundingClientRect();
      if (!r.width) continue;
      const s = cs(svg);
      const key = `${R(r.width)}x${R(r.height)} stroke ${s.strokeWidth}`;
      /* className on an SVG element is an SVGAnimatedString, so String() on it
         gives "[object SVGAnimatedString]" and the census names nothing. */
      const owner =
        svg.parentElement?.getAttribute('class') ||
        svg.getAttribute('class') ||
        svg.closest('[class]')?.getAttribute('class') ||
        '?';
      const ctx = owner.trim().split(/\s+/).slice(0, 2).join('.');
      const g = groups.get(key) || new Map();
      g.set(ctx, (g.get(ctx) || 0) + 1);
      groups.set(key, g);
    }
    [...groups.entries()]
      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
      .forEach(([size, ctxs]) => {
        const total = [...ctxs.values()].reduce((a, b) => a + b, 0);
        say(`${size.padEnd(24)} ×${String(total).padEnd(4)} ${[...ctxs.entries()].map(([c, n]) => `${c}×${n}`).slice(0, 6).join('  ')}`);
      });
  };

  S.tree = () => {
    head('DOM skeleton (real class names, depth ≤ 7)');
    const sig = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
    const walk = (el, depth) => {
      if (depth > 7) return;
      const kids = [...el.children];
      const counts = new Map();
      for (const k of kids) {
        const s = sig(k);
        counts.set(s, (counts.get(s) || 0) + 1);
      }
      const printed = new Map();
      for (const k of kids) {
        const s = sig(k);
        const seen = (printed.get(s) || 0) + 1;
        printed.set(s, seen);
        if (seen > 2) {
          if (seen === 3) say(`${'  '.repeat(depth)}  … ×${counts.get(s) - 2} more ${s}`);
          continue;
        }
        const r = k.getBoundingClientRect();
        say(`${'  '.repeat(depth)}  ${s}   ${R(r.width)}x${R(r.height)} @ ${R(r.x)},${R(r.y)}`);
        walk(k, depth + 1);
      }
    };
    const root = document.querySelector('.app-container') || document.body;
    say(sig(root));
    walk(root, 0);
  };

  /* ------------------------------------------------------------- delivering
     A 1400-line string does not survive console.log — DevTools truncates it —
     and copy() is a command-line API that only exists at the top level of what
     you type, so calling it from in here is a no-op. Writing a file in the
     vault is the only route that reliably hands over the whole thing. */
  const FILE = 'bookcloth-probe.txt';

  window.bcSave = async (name = FILE) => {
    const text = window.__bc;
    if (!text) return 'nothing measured yet — run bcProbe() first';
    const a = window.app?.vault?.adapter;
    if (a?.write) {
      await a.write(name, text);
      const base = a.getBasePath ? a.getBasePath() : '<vault>';
      return `wrote ${text.split('\n').length} lines to ${base}/${name}`;
    }
    /* no vault (or a mobile adapter that will not take a plain path): fall back
       to a download, which Electron drops in the usual place */
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const el = document.createElement('a');
    el.href = url;
    el.download = name;
    el.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return `downloaded ${name}`;
  };

  const deliver = (text) => {
    const lines = text.split('\n');
    console.log(lines.slice(0, 30).join('\n'));
    console.log(`%c… ${lines.length - 30} more lines held in __bc`, 'color:#9b9a97');
    navigator.clipboard?.writeText(text).then(
      () => console.log('%c✓ copied to clipboard', 'color:#0b8a5c;font-weight:600'),
      () => console.log('%c! clipboard refused — use  await bcSave()', 'color:#996611;font-weight:600')
    );
    console.log('%c→ await bcSave()   writes it into the vault root as a file', 'color:#0b8a5c;font-weight:600');
  };

  /* ---------------------------------------------------------------- runner */
  const ORDER = ['env', 'tokens', 'frame', 'ribbon', 'leftsplit', 'rightsplit', 'root', 'editor', 'embeds', 'tasks', 'controls', 'overlays', 'icons'];

  window.bcProbe = (...only) => {
    out = [];
    const names = only.length ? only : ORDER;
    say(`# bookcloth probe  ${new Date().toISOString()}  sections: ${names.join(', ')}`);
    for (const n of names) {
      const fn = S[n];
      if (!fn) {
        say(`\n### ${n} —— unknown section. available: ${Object.keys(S).join(', ')}`);
        continue;
      }
      try {
        fn();
      } catch (e) {
        say(`\n### ${n} —— threw: ${e.message}`);
      }
    }
    const text = out.join('\n');
    window.__bc = text;
    deliver(text);
    return `${out.length} lines in __bc`;
  };

  /* The preview harness has to reproduce Obsidian, not Bookcloth. So measure
     the same regions once with the theme off: that run is the ground truth the
     shim should encode. The theme is restored before this resolves. */
  window.bcBaseline = async (...only) => {
    const css = window.app?.customCss;
    if (!css) return 'no app.customCss — switch to the default theme by hand, run bcProbe(), then switch back';
    const restore = css.theme;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const parts = [];
    try {
      css.setTheme('');
      await wait(700);
      window.bcProbe(...only);
      parts.push(`===== BASELINE (default theme) =====\n${window.__bc}`);
    } finally {
      css.setTheme(restore);
      await wait(700);
    }
    window.bcProbe(...only);
    parts.push(`\n\n===== THEMED (${restore || 'default'}) =====\n${window.__bc}`);
    const text = parts.join('\n');
    window.__bc = text;
    deliver(text);
    return `theme restored to "${restore}" — ${text.split('\n').length} lines in __bc`;
  };

  console.log(
    `%cbookcloth probe ready%c\n  bcProbe()                   all sections\n  bcProbe('ribbon','editor')  some sections\n  bcProbe('tree')             DOM skeleton\n  await bcBaseline()          same run with the theme off, then restored\n  await bcSave()              write the result into the vault root\n  sections: ${ORDER.join(', ')}, tree`,
    'color:#0b8a5c;font-weight:600',
    'color:inherit'
  );
  return window.bcProbe;
})();
