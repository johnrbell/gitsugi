(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const GOLD = { base: '#b8943a', shimmer: '#fff1cc' };

  const DEFAULTS = {
    enabled: true,
    shimmerDirection: 'top-left-to-bottom-right',
    shimmerSpeed: 2,
    shimmerPause: 3,
    goldOpacity: 0.55,
    scope: 'all',
  };

  const PULSE_DUR = 0.45;

  const DIR_FN = {
    'left-to-right':             (x)    => x,
    'right-to-left':             (x)    => 1 - x,
    'top-to-bottom':             (_, y) => y,
    'bottom-to-top':             (_, y) => 1 - y,
    'top-left-to-bottom-right':  (x, y) => (x + y) / 2,
    'top-right-to-bottom-left':  (x, y) => (1 - x + y) / 2,
    'bottom-left-to-top-right':  (x, y) => (x + 1 - y) / 2,
    'bottom-right-to-top-left':  (x, y) => (2 - x - y) / 2,
  };

  let settings = { ...DEFAULTS };
  let observer = null;
  let applied  = false;

  /* ---- helpers ---- */

  const clamp = (v) => Math.max(0, Math.min(1, v));

  function lerpGold(t) {
    const r = Math.round(120 + t * (210 - 120));
    const g = Math.round(100 + t * (170 - 100));
    const b = Math.round(60  + t * (40  - 60));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, (s) => {
        settings = { ...DEFAULTS, ...s };
        resolve();
      });
    });
  }

  function isOwnProfile() {
    return !!document.querySelector(
      '.js-profile-editable-area, .js-user-profile-edit-button'
    );
  }

  function shouldApply() {
    if (!settings.enabled) return false;
    if (settings.scope === 'own' && !isOwnProfile()) return false;
    return true;
  }

  /* ---- DOM queries ---- */

  function findGraph() {
    return (
      document.querySelector('.js-yearly-contributions') ||
      document.querySelector('.ContributionCalendar')
    );
  }

  function findCells(graph) {
    if (!graph) return [];
    return Array.from(
      graph.querySelectorAll(
        'td.ContributionCalendar-day[data-level="0"], ' +
        'rect.ContributionCalendar-day[data-level="0"], ' +
        'td[data-level="0"], rect[data-level="0"]'
      )
    );
  }

  /* ---- position → delay ---- */

  function progress(cell, gRect) {
    const r  = cell.getBoundingClientRect();
    const rx = gRect.width  ? (r.left + r.width  / 2 - gRect.left) / gRect.width  : 0;
    const ry = gRect.height ? (r.top  + r.height / 2 - gRect.top)  / gRect.height : 0;
    const fn = DIR_FN[settings.shimmerDirection] || DIR_FN['top-left-to-bottom-right'];
    return fn(clamp(rx), clamp(ry));
  }

  /* ---- dynamic animation styles ---- */

  function injectAnimationCSS() {
    const sweep = settings.shimmerSpeed;
    const pause = settings.shimmerPause;
    const total = sweep + PULSE_DUR + pause;
    const pct   = (t) => (t / total * 100).toFixed(2);

    let el = document.getElementById('gitsugi-dyn-css');
    if (!el) {
      el = document.createElement('style');
      el.id = 'gitsugi-dyn-css';
      document.head.appendChild(el);
    }

    el.textContent = `
      .gitsugi-shimmer {
        animation: gitsugi-wave ${total}s ease-in-out infinite;
        animation-delay: var(--gitsugi-delay, 0s);
      }
      @keyframes gitsugi-wave {
        0%             { opacity: 0; }
        ${pct(0.1)}%   { opacity: var(--gitsugi-shimmer-intensity, 0.7); }
        ${pct(0.3)}%   { opacity: var(--gitsugi-shimmer-intensity, 0.7); }
        ${pct(0.45)}%  { opacity: 0; }
        100%           { opacity: 0; }
      }
      .gitsugi-gold-cell::after {
        animation: gitsugi-wave-td ${total}s ease-in-out infinite;
        animation-delay: var(--gitsugi-delay, 0s);
      }
      @keyframes gitsugi-wave-td {
        0%             { opacity: 0; }
        ${pct(0.1)}%   { opacity: 0.7; }
        ${pct(0.3)}%   { opacity: 0.7; }
        ${pct(0.45)}%  { opacity: 0; }
        100%           { opacity: 0; }
      }
    `;
  }

  /* ---- apply / remove ---- */

  function apply() {
    remove();
    if (!shouldApply()) return;

    const graph = findGraph();
    if (!graph) return;

    const cells = findCells(graph);
    if (!cells.length) return;

    injectAnimationCSS();

    graph.classList.add('gitsugi-active');

    const gRect    = graph.getBoundingClientRect();
    const maxDelay = settings.shimmerSpeed;
    const goldColor = lerpGold(settings.goldOpacity);

    cells.forEach((cell) => {
      const delay = progress(cell, gRect) * maxDelay;
      const isSVG = cell instanceof SVGElement;

      if (isSVG) {
        cell.dataset.gOrig = cell.getAttribute('fill') || '';
        cell.dataset.gOrigStyle = cell.getAttribute('style') || '';
        cell.style.setProperty('fill', goldColor, 'important');
        cell.classList.add('gitsugi-cell');

        const o = document.createElementNS(SVG_NS, 'rect');
        ['x', 'y', 'width', 'height', 'rx', 'ry'].forEach((a) => {
          const v = cell.getAttribute(a);
          if (v != null) o.setAttribute(a, v);
        });
        o.setAttribute('fill', GOLD.shimmer);
        o.classList.add('gitsugi-shimmer');
        o.style.cssText =
          `--gitsugi-delay:${delay}s;` +
          `--gitsugi-shimmer-intensity:0.7;` +
          `pointer-events:none`;
        cell.after(o);
      } else {
        cell.dataset.gOrig = cell.style.backgroundColor;
        cell.style.setProperty('background-color', goldColor, 'important');
        cell.classList.add('gitsugi-gold-cell');
        cell.style.setProperty('--gitsugi-delay', delay + 's');
      }

      patchTooltip(cell);
    });

    applied = true;
  }

  function remove() {
    document.querySelectorAll('.gitsugi-shimmer').forEach((e) => e.remove());

    document.querySelectorAll('.gitsugi-cell').forEach((c) => {
      c.setAttribute('style', c.dataset.gOrigStyle || '');
      c.setAttribute('fill', c.dataset.gOrig || '#ebedf0');
      c.classList.remove('gitsugi-cell');
      restoreTooltip(c);
      delete c.dataset.gOrig;
      delete c.dataset.gOrigStyle;
    });

    document.querySelectorAll('.gitsugi-gold-cell').forEach((c) => {
      c.style.backgroundColor = c.dataset.gOrig || '';
      c.classList.remove('gitsugi-gold-cell');
      c.style.removeProperty('--gitsugi-delay');
      restoreTooltip(c);
      delete c.dataset.gOrig;
    });

    document.querySelectorAll('.gitsugi-active').forEach((e) => {
      e.classList.remove('gitsugi-active');
    });

    applied = false;
  }

  /* ---- tooltips ---- */

  function patchTooltip(cell) {
    const re = /no contributions/i;
    for (const a of ['aria-label', 'data-tooltip-content', 'title']) {
      const v = cell.getAttribute(a);
      if (v && re.test(v)) {
        cell.dataset.gTip  = v;
        cell.dataset.gTipA = a;
        cell.setAttribute(a, v.replace(re, 'Mended with gitsugi'));
        break;
      }
    }
    const sp = cell.querySelector('span');
    if (sp && re.test(sp.textContent)) {
      sp.dataset.gTipT  = sp.textContent;
      sp.textContent = sp.textContent.replace(re, 'Mended with gitsugi');
    }
  }

  function restoreTooltip(cell) {
    if (cell.dataset.gTipA) {
      cell.setAttribute(cell.dataset.gTipA, cell.dataset.gTip);
    }
    delete cell.dataset.gTip;
    delete cell.dataset.gTipA;
    const sp = cell.querySelector('span');
    if (sp?.dataset.gTipT) {
      sp.textContent = sp.dataset.gTipT;
      delete sp.dataset.gTipT;
    }
  }

  /* ---- observers & listeners ---- */

  function watch() {
    observer?.disconnect();
    let timer = null;
    observer = new MutationObserver(() => {
      if (!shouldApply()) return;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        if (findGraph() && !document.querySelector('.gitsugi-cell, .gitsugi-gold-cell')) {
          applied = false;
          apply();
        }
      }, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function listen() {
    chrome.storage.onChanged.addListener((ch) => {
      Object.keys(ch).forEach((k) => (settings[k] = ch[k].newValue));
      apply();
    });

    ['turbo:load', 'turbo:render', 'pjax:end'].forEach((evt) =>
      document.addEventListener(evt, () => {
        applied = false;
        setTimeout(apply, 300);
      })
    );
  }

  /* ---- init ---- */

  function init() {
    loadSettings().then(() => {
      apply();
      watch();
      listen();
    });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
