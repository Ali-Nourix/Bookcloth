/* Sanity-check the built stylesheet: every rule keeps at least one
   declaration, and every declaration is one the engine actually accepts.

     node check.mjs [path to theme.css]   (defaults to the built ../theme.css)
*/
import { chromium } from 'playwright';
import fs from 'node:fs';

const file = process.argv[2] || '../theme.css';
const css = fs.readFileSync(file, 'utf8');

/* Split declarations out of the source. Quote state is tracked because the
   checkbox tick is an inline SVG data URI, and a semicolon inside it would
   otherwise chop one declaration into two unparseable halves. */
const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
let depth = 0, buf = '', quote = null;
const decls = [];
for (const ch of source) {
  if (quote) { buf += ch; if (ch === quote) quote = null; continue; }
  if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
  if (ch === '{') { depth++; buf = ''; continue; }
  if (ch === '}') { depth--; if (buf.includes(':')) decls.push(buf.trim()); buf = ''; continue; }
  if (ch === ';') { if (depth > 0 && buf.includes(':')) decls.push(buf.trim()); buf = ''; continue; }
  if (depth > 0) buf += ch;
}

const browser = await chromium.launch();
const pg = await browser.newPage();
const report = await pg.evaluate(([css, decls]) => {
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);

  /* In a nesting-capable engine a CSSStyleRule also carries an (empty)
     cssRules list, so style has to be checked before the group recursion. */
  const empties = []; let rules = 0, declarations = 0;
  const walk = (list) => {
    for (let i = 0; i < list.length; i++) {
      const rule = list[i];
      if (rule.style && rule.selectorText !== undefined) {
        rules++; declarations += rule.style.length;
        if (rule.style.length === 0) empties.push(rule.selectorText);
      }
      if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules);
    }
  };
  walk(el.sheet.cssRules);

  const unsupported = decls.filter((d) => {
    const i = d.indexOf(':');
    const prop = d.slice(0, i).trim(), val = d.slice(i + 1).trim();
    if (prop.startsWith('--')) return false;            // custom properties take anything
    if (/^-(webkit|moz|ms)-/.test(prop)) return false;  // vendor prefixes vary by engine
    if (val.includes('var(')) return false;             // not evaluable without context
    if (val.includes('!important')) return false;       // CSS.supports rejects the flag
    try { return !CSS.supports(prop, val); } catch { return true; }
  });

  return { rules, declarations, empties, unsupported };
}, [css, decls]);
await browser.close();

console.log(`${file}: ${report.rules} style rules, ${report.declarations} declarations`);
console.log(`rules that lost every declaration: ${report.empties.length}`);
report.empties.forEach((s) => console.log('  !', s));
console.log(`declarations the engine rejected: ${report.unsupported.length}`);
report.unsupported.forEach((d) => console.log('  !', d.replace(/\s+/g, ' ').slice(0, 120)));
process.exit(report.empties.length || report.unsupported.length ? 1 : 0);
