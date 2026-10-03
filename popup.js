'use strict';

/*
  SpeedFlow — popup.js
  Zero visible UI. Ensures the content script is live on the active
  YouTube tab, then immediately self-closes.
*/
(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Ping the content script. If it responds, it's already running.
    // If the message channel throws, inject the script as a fallback.
    const alive = await chrome.tabs.sendMessage(tab.id, { type: 'sf_ping' })
      .catch(() => null);

    if (!alive) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        files: ['content.js'],
        world: 'MAIN',
      }).catch(() => null);
    }
  } catch (_) {}

  window.close();
})();
