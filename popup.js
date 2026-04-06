const DEFAULTS = {
  enabled: true,
  shimmerDirection: 'top-left-to-bottom-right',
  shimmerSpeed: 2,
  shimmerPause: 3,
  goldOpacity: 0.55,
  scope: 'all',
};

const $ = (id) => document.getElementById(id);

function init() {
  const els = {
    enabled:    $('enabled'),
    scopeAll:   $('scope-all'),
    scopeOwn:   $('scope-own'),
    direction:  $('shimmerDirection'),
    speed:      $('shimmerSpeed'),
    pause:      $('shimmerPause'),
    opacity:    $('goldOpacity'),
    speedVal:   $('speed-value'),
    pauseVal:   $('pause-value'),
    opacityVal: $('opacity-value'),
  };

  chrome.storage.sync.get(DEFAULTS, (s) => {
    els.enabled.checked  = s.enabled;
    els.scopeAll.checked = s.scope === 'all';
    els.scopeOwn.checked = s.scope === 'own';
    els.direction.value  = s.shimmerDirection;
    els.speed.value      = s.shimmerSpeed;
    els.pause.value      = s.shimmerPause;
    els.opacity.value    = s.goldOpacity;
    updateLabels(els, s);
  });

  els.enabled.addEventListener('change',   () => save({ enabled: els.enabled.checked }));
  els.scopeAll.addEventListener('change',  () => save({ scope: 'all' }));
  els.scopeOwn.addEventListener('change',  () => save({ scope: 'own' }));
  els.direction.addEventListener('change', () => save({ shimmerDirection: els.direction.value }));

  els.speed.addEventListener('input', () => {
    const v = parseFloat(els.speed.value);
    els.speedVal.textContent = v + 's';
    save({ shimmerSpeed: v });
  });

  els.pause.addEventListener('input', () => {
    const v = parseFloat(els.pause.value);
    els.pauseVal.textContent = v + 's';
    save({ shimmerPause: v });
  });

  els.opacity.addEventListener('input', () => {
    const v = parseFloat(els.opacity.value);
    els.opacityVal.textContent = Math.round(v * 100) + '%';
    save({ goldOpacity: v });
  });
}

function updateLabels(els, s) {
  els.speedVal.textContent   = s.shimmerSpeed + 's';
  els.pauseVal.textContent   = s.shimmerPause + 's';
  els.opacityVal.textContent = Math.round(s.goldOpacity * 100) + '%';
}

function save(partial) {
  chrome.storage.sync.set(partial);
}

document.addEventListener('DOMContentLoaded', init);
