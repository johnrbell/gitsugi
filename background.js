const DEFAULTS = {
  enabled: true,
  shimmerDirection: 'top-left-to-bottom-right',
  shimmerSpeed: 2,
  shimmerPause: 3,
  goldOpacity: 0.55,
  scope: 'all',
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(null, (existing) => {
    const toSet = {};
    for (const [key, val] of Object.entries(DEFAULTS)) {
      if (existing[key] === undefined) toSet[key] = val;
    }
    if (Object.keys(toSet).length) chrome.storage.sync.set(toSet);
  });
});
