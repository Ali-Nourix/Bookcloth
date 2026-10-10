/* Validate the Style Settings block the way the plugin does, so a malformed
   entry fails here instead of taking the plugin down in someone's vault.
   Run: node tools/check-settings.mjs */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/00-settings.css'), 'utf8');
const m = css.match(/\/\*\s*@settings\s*\n([\s\S]*?)\*\//);
if (!m) {
  console.error('no @settings block');
  process.exit(1);
}

/* The trap that costs the most here: a colon-space inside an unquoted scalar.
   YAML reads `description: it works like this: a nested mapping` as exactly
   that, the parse fails, and Style Settings quietly shows the theme no
   settings at all — which reads to a user as the plugin being broken rather
   than as one line of punctuation. Checked before the parse so the message
   names the line instead of the column. */
const scalarTrap = [];
m[1].split('\n').forEach((line, i) => {
  const f = line.match(/^(\s*)(description|title|label):\s+(.*)$/);
  if (!f) return;
  const v = f[3].trim();
  if (!v || '"\'>|'.includes(v[0])) return;
  if (/:(\s|$)/.test(v)) {
    scalarTrap.push(`line ${i + 1}: ${f[2]} has an unquoted ": " — wrap the value in double quotes`);
  }
});
if (scalarTrap.length) {
  console.error(`${scalarTrap.length} scalar(s) YAML will read as a nested mapping:`);
  for (const t of scalarTrap) console.error('  ✗ ' + t);
  process.exit(1);
}

let doc;
try {
  doc = parse(m[1]);
} catch (e) {
  console.error('YAML does not parse:\n' + e.message);
  process.exit(1);
}

/* Taken from the plugin's own source rather than from memory: SettingType in
   settingsView/SettingComponents/types.ts, and the interfaces in
   SettingHandlers.ts. The first version of this file was written from memory
   and flagged eight entries that were fine — `rgb-values` is a real colour
   format — which is the same mistake as writing the theme from memory. */
const REQUIRED = {
  heading: ['id', 'title', 'level'],
  'info-text': ['id', 'title'],
  'class-toggle': ['id', 'title'],
  'class-select': ['id', 'title', 'options'],
  'variable-text': ['id', 'title', 'default'],
  'variable-number': ['id', 'title', 'default'],
  'variable-number-slider': ['id', 'title', 'default', 'min', 'max', 'step'],
  'variable-select': ['id', 'title', 'default', 'options'],
  'variable-color': ['id', 'title', 'format'],
  'variable-themed-color': ['id', 'title', 'format', 'default-light', 'default-dark'],
  'color-gradient': ['id', 'title', 'from', 'to', 'format', 'step'],
};

const COLOR_FORMATS = new Set(['hsl', 'hsl-values', 'hsl-split', 'hsl-split-decimal',
  'rgb', 'rgb-values', 'rgb-split', 'hex']);

/* A description is not plain text: Style Settings hands it to Obsidian's
   markdown renderer. Wiki syntax in one is asking the app to resolve a link
   from a context that has no file to resolve it against, and an embed is
   asking it to render a note that does not exist. Neither belongs in a label.
   This is checked because one of them shipped: `![[Note#Heading]]` sat in a
   description for several releases as an illustration of what the setting
   affects. */
const WIKI = /!?\[\[|%%|\^[a-z0-9-]{6,}/i;
const fails = [];
const seen = new Map();
const entries = doc.settings || [];

entries.forEach((e, i) => {
  const where = `#${i + 1} ${e && e.id ? e.id : '(no id)'}`;
  if (!e || typeof e !== 'object') return fails.push(`${where}: not a mapping`);
  if (!e.type) return fails.push(`${where}: no type`);
  if (!REQUIRED[e.type]) return fails.push(`${where}: unknown type "${e.type}"`);

  for (const k of REQUIRED[e.type]) {
    if (e[k] === undefined || e[k] === null) fails.push(`${where}: ${e.type} needs "${k}"`);
  }
  for (const k of ['title', 'description']) {
    if (typeof e[k] === 'string' && WIKI.test(e[k])) {
      fails.push(`${where}: ${k} contains wiki syntax — Obsidian renders these as markdown`);
    }
  }
  if (e.id !== undefined) {
    if (seen.has(e.id)) fails.push(`${where}: id repeats #${seen.get(e.id) + 1}`);
    else seen.set(e.id, i);
  }
  /* a colour's format is an enum; a slider's is a free string it appends */
  if (/color/.test(e.type) && !COLOR_FORMATS.has(String(e.format))) {
    fails.push(`${where}: colour format "${e.format}" is not one of ${[...COLOR_FORMATS].join(', ')}`);
  }
  if (e.type === 'variable-number-slider') {
    const { min, max, step, default: d } = e;
    if ([min, max, step, d].some((v) => typeof v !== 'number')) {
      fails.push(`${where}: min/max/step/default must all be numbers`);
    } else {
      if (min >= max) fails.push(`${where}: min ${min} is not below max ${max}`);
      if (d < min || d > max) fails.push(`${where}: default ${d} is outside ${min}..${max}`);
      if (step <= 0) fails.push(`${where}: step ${step} must be positive`);
      /* the slider snaps to steps from min; a default off the grid leaves the
         control unable to show the value it reports */
      const offs = (d - min) / step;
      if (Math.abs(offs - Math.round(offs)) > 1e-6) {
        fails.push(`${where}: default ${d} is not a whole number of ${step} steps from ${min}`);
      }
    }
  }
  if (e.type === 'class-select' || e.type === 'variable-select') {
    const opts = Array.isArray(e.options) ? e.options : [];
    if (!opts.length) fails.push(`${where}: no options`);
    opts.forEach((o, j) => {
      if (typeof o === 'string') return;
      if (!o || o.value === undefined) fails.push(`${where}: option ${j + 1} has no value`);
    });
    if (e.default !== undefined) {
      const values = opts.map((o) => (typeof o === 'string' ? o : o.value));
      if (!values.includes(e.default)) {
        fails.push(`${where}: default "${e.default}" is not one of its options`);
      }
    }
  }
});

/* The heading tree, run exactly as Style Settings runs it.

   The plugin makes the first entry the root of the section and then, for every
   later heading, compares its level with the one it is standing on:

     level <  current   walk up until it is not, then add as a sibling
     level == current   add to the current heading's PARENT
     level >  current   add to the current heading

   The root's parent is the container element, not a heading — it has no
   addSettingChild — so the moment a second heading arrives at the root's own
   level, the plugin throws while rendering and the whole tab dies. That is what
   a block full of level-1 headings does, and it is silent in every other check
   here because the YAML is perfectly valid. So walk it the same way, with the
   root's parent set to a bare object, and report the throw as ours.  */
const headingTree = () => {
  if (!entries.length) return;
  const node = (setting, parent) => ({ setting, parent, children: [] });
  const add = (p, setting) => {
    if (!p || typeof p.children === 'undefined') {
      throw new Error(`heading "${setting.id}" is handed to something that is not a heading`);
    }
    const n = node(setting, p);
    p.children.push(n);
    return n;
  };
  const rootParent = { container: true };          // the plugin's containerEl
  const root = node(entries[0], rootParent);
  let cur = root;
  for (const e of entries.slice(1)) {
    if (!e || e.type !== 'heading') continue;
    const lvl = e.level;
    if (lvl < cur.setting.level) {
      while (lvl < cur.setting.level) {
        cur = cur.parent;
        if (!cur || !cur.setting) throw new Error(`heading "${e.id}" at level ${lvl} walks off the top of the tree`);
      }
      cur = cur.setting.id === root.setting.id ? add(cur, e) : add(cur.parent, e);
    } else if (lvl === cur.setting.level) {
      cur = add(cur.parent, e);
    } else {
      cur = add(cur, e);
    }
  }
};

if (entries.length && entries[0].type !== 'heading') {
  fails.push('the first entry is not a heading — the plugin makes it the root of the section regardless');
}
try {
  headingTree();
} catch (err) {
  fails.push(`heading levels: ${err.message}`);
}

console.log(`${entries.length} settings, ${new Set(entries.map((e) => e && e.type)).size} types`);
if (fails.length) {
  console.log(`\n${fails.length} broken:`);
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('every entry is well formed');
