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

console.log(`${entries.length} settings, ${new Set(entries.map((e) => e && e.type)).size} types`);
if (fails.length) {
  console.log(`\n${fails.length} broken:`);
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('every entry is well formed');
