/* Bookcloth Scroll — the engine behind the theme's "Smooth scrolling" setting.
 *
 * A theme is a stylesheet and cannot run code, and smoothing a mouse wheel
 * means catching each wheel event, cancelling the browser's own scroll, and
 * driving the scroll position frame by frame. So the switch and the tuning
 * live in the theme's Style Settings, beside everything else the theme does,
 * and this plugin reads them off the page:
 *
 *   body.bc-smooth-scroll    on or off
 *   --bc-scroll-glide        ms — the time constant of the glide
 *   --bc-scroll-step         multiplier on the distance of one notch
 *   --bc-scroll-accel        how much a fast spin of the wheel is amplified
 *
 * It only ever takes over a notched mouse wheel. A trackpad or a free-spinning
 * wheel already scrolls smoothly and carries its own momentum, and smoothing a
 * motion that is already smooth is how scroll smoothing usually makes things
 * worse: every flick arrives late and lands soft. Modified wheels (zoom,
 * horizontal) and surfaces that use the wheel for something else — canvas,
 * graph, Excalidraw, maps — are left alone as well.
 */
'use strict';

const { Plugin, PluginSettingTab, Setting } = require('obsidian');

/* Surfaces where the wheel is not a scroll: it pans, zooms or changes a value.
   Anything inside one of these is left entirely to the page. A plugin view can
   opt out the same way with data-bc-scroll="native". */
const NATIVE = [
  '.canvas-wrapper',
  '.graph-view',
  '.excalidraw',
  '.excalidraw-wrapper',
  '.leaflet-container',
  '.tl-container',
  '[data-type="canvas"]',
  '[data-type="graph"]',
  '[data-type="localgraph"]',
  '[data-type="excalidraw"]',
  'input',
  'select',
  'textarea',
  '[data-bc-scroll="native"]',
].join(',');

/* A notch that reports in lines rather than pixels. Chromium always reports
   pixels, so this only matters where something synthesises line deltas. */
const LINE_PX = 40;
/* After a trackpad-like event, everything for this long is left native, so a
   gesture that happens to emit one value divisible by 120 mid-swipe is not
   hijacked for a single frame. */
const PRECISE_LATCH = 320;
/* Notches closer together than this, in the same direction, count as one spin
   and are amplified — a quick flick of the wheel travels further than the
   same notches taken slowly, which is what "the distance eases with the amount
   scrolled" means in practice. */
const SPIN_WINDOW = 90;
const SPIN_MAX = 4;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* A mouse wheel moves in notches of 120 in the legacy wheelDelta units on
   every platform Chromium runs on; trackpads and free-spinning wheels report
   whatever they measured. This is the one reliable way to tell them apart from
   inside a page. */
const isNotch = (e) => {
  if (e.deltaMode !== 0) return true;
  const w = e.wheelDeltaY;
  return typeof w === 'number' && w !== 0 && w % 120 === 0;
};

class Glide {
  constructor(el) {
    this.el = el;
    this.win = el.ownerDocument.defaultView;
    this.current = el.scrollTop;
    this.target = this.current;
    this.applied = this.current;
    this.tau = 140;
    this.last = 0;
    this.frame = 0;
    this.running = false;
  }
}

module.exports = class BookclothScroll extends Plugin {
  onload() {
    this.glides = new WeakMap();
    this.active = new Set();
    this.preciseUntil = 0;
    this.lastNotch = 0;
    this.lastDir = 0;
    this.spin = 0;
    this.lastDevice = 'none yet';
    /* The display's frame interval, learned from the glides themselves. The
       first frame of a glide has no previous frame to measure against, and
       assuming 60Hz there makes every glide start a frame's worth early on a
       30Hz machine and late on a 144Hz one. */
    this.frameMs = 1000 / 60;

    this.watch(window);
    this.registerEvent(
      this.app.workspace.on('window-open', (_, win) => this.watch(win))
    );
    this.addSettingTab(new ScrollTab(this.app, this));
  }

  onunload() {
    for (const g of [...this.active]) this.stop(g);
  }

  watch(win) {
    /* Not passive: preventDefault is the whole mechanism. Bubble phase rather
       than capture, so anything nearer the target that has already claimed the
       wheel — the canvas, a tab strip turning vertical wheel into horizontal —
       has had its turn and set defaultPrevented first. */
    this.registerDomEvent(win, 'wheel', (e) => this.onWheel(e), { passive: false });
    /* A click, a key or a touch takes the scroll back. A glide lasts under a
       second, and a user grabbing the scrollbar or pressing Page Down in the
       middle of one means the next move is theirs. */
    const hand = () => this.stopIn(win);
    this.registerDomEvent(win, 'mousedown', hand, { capture: true, passive: true });
    this.registerDomEvent(win, 'keydown', hand, { capture: true, passive: true });
    this.registerDomEvent(win, 'touchstart', hand, { capture: true, passive: true });
  }

  /* Read from the main window's body every time, rather than cached: it costs
     four property reads per notch, and it means a slider moved in Style
     Settings takes effect on the very next turn of the wheel. */
  config() {
    const body = document.body;
    const cs = getComputedStyle(body);
    const num = (name, fallback, lo, hi) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
    };
    const version = cs.getPropertyValue('--bc-version').trim().replace(/"/g, '');
    /* Without Style Settings there is no way to switch it on, so the theme's
       default — on — stands. With it, the class decides. */
    const managed = body.classList.contains('css-settings-manager');
    const wanted = body.classList.contains('bc-smooth-scroll') || !managed;
    const still =
      body.classList.contains('bc-motion-none') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return {
      version,
      wanted,
      still,
      on: Boolean(version) && wanted && !still,
      glide: num('--bc-scroll-glide', 140, 20, 1000),
      step: num('--bc-scroll-step', 1, 0.1, 5),
      accel: num('--bc-scroll-accel', 1, 0, 4),
    };
  }

  onWheel(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (!e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const target = e.target;
    if (!target || !target.ownerDocument) return;
    const win = target.ownerDocument.defaultView;
    const now = win.performance.now();

    const cfg = this.config();
    if (!cfg.on) return;

    if (!isNotch(e)) {
      this.preciseUntil = now + PRECISE_LATCH;
      this.lastDevice = 'a trackpad or free-spinning wheel — left to the system';
      this.stopIn(win);
      return;
    }
    if (now < this.preciseUntil) return;

    const dir = Math.sign(e.deltaY);
    const el = this.scrollerFor(target, dir);
    if (!el) return;
    e.preventDefault();
    this.lastDevice = 'a notched mouse wheel — smoothed';

    let px = e.deltaY;
    if (e.deltaMode === 1) px *= LINE_PX;
    else if (e.deltaMode === 2) px *= el.clientHeight * 0.875;
    px *= cfg.step;

    if (dir === this.lastDir && now - this.lastNotch < SPIN_WINDOW) {
      this.spin = Math.min(this.spin + 1, SPIN_MAX);
    } else {
      this.spin = 0;
    }
    this.lastDir = dir;
    this.lastNotch = now;
    px *= 1 + cfg.accel * this.spin * 0.25;

    let g = this.glides.get(el);
    if (!g) {
      g = new Glide(el);
      this.glides.set(el, g);
    }
    if (!g.running) {
      g.current = g.target = g.applied = el.scrollTop;
    } else if (Math.sign(g.target - g.current) === -dir) {
      /* A reversal drops whatever was left of the glide. Adding to the old
         target instead would make the first notch back spend itself cancelling
         the remainder, and the page would seem to ignore it. */
      g.target = g.current;
    }
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    g.target = clamp(g.target + px, 0, max);
    g.tau = cfg.glide;
    this.run(g);
  }

  /* The nearest ancestor that scrolls vertically and still has room to move
     this way — the same element the browser's own scroll chaining would pick,
     judged against where a glide in flight is heading rather than where it is
     now, so a fast spin does not stall at the end of an inner box. */
  scrollerFor(target, dir) {
    const start = target.nodeType === 1 ? target : target.parentElement;
    if (!start || start.closest(NATIVE)) return null;
    const doc = start.ownerDocument;
    const win = doc.defaultView;
    for (let n = start; n && n !== doc.body && n !== doc.documentElement; n = n.parentElement) {
      if (n.scrollHeight <= n.clientHeight + 1) continue;
      const s = win.getComputedStyle(n);
      if (!/(auto|scroll|overlay)/.test(s.overflowY)) continue;
      const g = this.glides.get(n);
      const pos = g && g.running ? g.target : n.scrollTop;
      const max = n.scrollHeight - n.clientHeight;
      const room = dir > 0 ? pos < max - 0.5 : pos > 0.5;
      if (room) {
        /* Snapping containers are driven by their snap points; stepping one a
           pixel at a time would fight them. */
        if (s.scrollSnapType && s.scrollSnapType !== 'none') return null;
        return n;
      }
      /* At its end, and told not to hand the scroll on. */
      if (/(contain|none)/.test(s.overscrollBehaviorY)) return null;
    }
    return null;
  }

  run(g) {
    if (g.running) return;
    g.running = true;
    g.last = 0;
    this.active.add(g);
    g.frame = g.win.requestAnimationFrame((t) => this.step(g, t));
  }

  step(g, t) {
    const el = g.el;
    if (!el.isConnected) return this.stop(g);

    /* Someone else moved it since the last frame: CodeMirror correcting a
       line height it had estimated, the reading view filling in a section, a
       jump to a heading. Carry the glide along by the same amount rather than
       dragging the page back to where it was. */
    const drift = el.scrollTop - g.applied;
    if (Math.abs(drift) > 1) {
      g.current += drift;
      g.target += drift;
    }
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    g.target = clamp(g.target, 0, max);

    /* Exponential approach with the step derived from real elapsed time, so
       the glide is the same length at 60Hz, 144Hz, or on a frame that ran
       late. The per-frame fraction at 60Hz for the default 140ms is 0.11. */
    let dt;
    if (g.last) {
      dt = clamp(t - g.last, 1, 64);
      this.frameMs += (dt - this.frameMs) * 0.1;
    } else {
      dt = this.frameMs;
    }
    g.last = t;
    const k = 1 - Math.exp(-dt / g.tau);
    g.current += (g.target - g.current) * k;
    if (Math.abs(g.target - g.current) < 0.5) g.current = g.target;

    /* instant, so a scroll-behavior: smooth that anything else has set on the
       element cannot turn every frame of this into an animation of its own. */
    el.scrollTo({ top: g.current, behavior: 'instant' });
    g.applied = el.scrollTop;

    if (g.current === g.target) return this.stop(g);
    g.frame = g.win.requestAnimationFrame((tt) => this.step(g, tt));
  }

  stop(g) {
    if (g.frame) g.win.cancelAnimationFrame(g.frame);
    g.frame = 0;
    g.running = false;
    this.active.delete(g);
  }

  stopIn(win) {
    for (const g of [...this.active]) if (g.win === win) this.stop(g);
  }
};

class ScrollTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const cfg = this.plugin.config();

    containerEl.createEl('p', {
      text:
        'This plugin has no settings of its own. It is switched on and tuned from ' +
        'Style Settings → Bookcloth → Interface → Scrolling, beside the rest of the theme.',
    });

    new Setting(containerEl)
      .setName('Bookcloth')
      .setDesc(cfg.version ? `Active, version ${cfg.version}.` : 'Not active. Without the theme this plugin does nothing.');

    new Setting(containerEl)
      .setName('Smooth scrolling')
      .setDesc(
        cfg.on
          ? `On — glide ${cfg.glide}ms, distance ×${cfg.step}, acceleration ${cfg.accel}.`
          : cfg.still
            ? 'Off, because motion is turned off — by the theme\'s motion level, or by the system\'s reduce-motion setting.'
            : 'Off. Switch it on in Style Settings.'
      );

    new Setting(containerEl)
      .setName('Last wheel seen')
      .setDesc(this.plugin.lastDevice);
  }
}
