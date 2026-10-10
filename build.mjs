#!/usr/bin/env node
/* Concatenates src/ into a single theme.css, because Obsidian loads exactly
   one stylesheet per theme. Order matters: tokens before themes before
   components. Run with `node build.mjs`. */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

const files = [
  "00-settings.css",
  "01-tokens.css",
  "02-light.css",
  "03-dark.css",
  "04-accent.css",
  "05-typography.css",
  "06-chrome.css",
  "07-editor.css",
  "08-components.css",
  "09-views.css",
  "12-icons.css",
  "13-panes.css",
  "14-motion.css",
  "10-mobile.css",
  "11-rtl.css",
  "plugins/dataview.css",
  "plugins/tasks.css",
  "plugins/kanban.css",
  "plugins/calendar.css",
  "plugins/habbiter.css",
  "plugins/misc.css",
  "plugins/taskpro.css",
];

const banner = `/* ${manifest.name} ${manifest.version} — a warm, quiet theme for Obsidian.
   Built from src/. Edit the partials, not this file: run \`node build.mjs\`.
   Pick your accent in Settings → Appearance; everything here derives from it. */\n`;

const body = files
  .map((f) => readFileSync(join(root, "src", f), "utf8").trimEnd())
  .join("\n\n");

writeFileSync(join(root, "theme.css"), `${banner}\n${body}\n`, "utf8");

const bytes = Buffer.byteLength(`${banner}\n${body}\n`);
console.log(`theme.css written — ${files.length} partials, ${(bytes / 1024).toFixed(1)} KB`);
