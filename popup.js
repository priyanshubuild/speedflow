(async function () {
  'use strict';
  const extension = globalThis.browser || globalThis.chrome;
  const C = globalThis.SpeedFlowCore;
  const $ = id => document.getElementById(id);
  let tab = null, speed = 1, available = false, busy = false, ad = false;
  let prefs = { ...C.DEFAULTS };
  function render() {
    $('speed').textContent = C.format(speed);
    $('slower').disabled = !available || busy || ad || !prefs.sfEnabled || speed <= C.MIN;
    $('faster').disabled = !available || busy || ad || !prefs.sfEnabled || speed >= C.MAX;
    $('reset').disabled = !available || busy || ad || !prefs.sfEnabled;
    $('enabled').checked = prefs.sfEnabled;
    $('remember').checked = prefs.sfRemember;
    $('shortcuts').checked = prefs.sfShortcuts;
  }
  async function connect(allowInjection = false) {
    busy = true;
    render();
    try {
      [tab] = await extension.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !C.youtubeURL(tab.url)) {
        available = false;
        $('status').textContent = 'Open a YouTube video to change playback speed. Your preferences work on every supported tab.';
        $('retry').hidden = true;
        return;
      }
      let state;
      try { state = await extension.tabs.sendMessage(tab.id, { type: 'sf:state' }, { frameId: 0 }); }
      catch (error) {
        if (!allowInjection) throw error;
        await extension.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
        await extension.scripting.executeScript({ target: { tabId: tab.id }, files: ['core.js', 'content.js'] });
        state = await extension.tabs.sendMessage(tab.id, { type: 'sf:state' }, { frameId: 0 });
      }
      for (let attempt = 0; state?.loading && attempt < 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 80));
        state = await extension.tabs.sendMessage(tab.id, { type: 'sf:state' }, { frameId: 0 });
      }
      if (!state?.ok) throw new Error(state?.error || 'Could not reach the video.');
      available = state.mounted;
      ad = state.ad;
      speed = state.speed;
      $('status').textContent = !prefs.sfEnabled ? 'SpeedFlow is paused. Enable it to restore your player controls.' :
        ad ? 'An ad is playing. Your selected speed resumes afterward.' :
          available ? 'Connected. You can also use − and + directly on the player.' : 'Play a regular YouTube video to see the controls.';
      $('retry').hidden = true;
    } catch {
      available = false;
      $('status').textContent = 'Refresh your YouTube tab, or reconnect below. Check that this extension has YouTube site access.';
      $('retry').hidden = false;
    } finally { busy = false; render(); }
  }
  async function setSpeed(value) {
    if (!available || busy) return;
    busy = true;
    render();
    try {
      const response = await extension.tabs.sendMessage(tab.id, { type: 'sf:set-speed', speed: value }, { frameId: 0 });
      if (!response?.ok) throw new Error(response?.error || 'Could not change speed.');
      speed = response.speed;
      $('status').textContent = `Playback speed ${C.format(speed)}.`;
    } catch (error) { $('status').textContent = error.message || 'Reconnect to your video and try again.'; }
    finally { busy = false; render(); }
  }
  $('slower').addEventListener('click', () => setSpeed(C.clamp(speed - C.STEP)));
  $('faster').addEventListener('click', () => setSpeed(C.clamp(speed + C.STEP)));
  $('reset').addEventListener('click', () => setSpeed(1));
  $('retry').addEventListener('click', () => connect(true));
  for (const [id, key] of [['enabled', 'sfEnabled'], ['remember', 'sfRemember'], ['shortcuts', 'sfShortcuts']]) {
    $(id).addEventListener('change', async () => {
      const value = $(id).checked;
      $(id).disabled = true;
      try {
        await extension.storage.local.set({ [key]: value });
        prefs[key] = value;
        await connect();
      } catch { $('status').textContent = 'Could not save that preference. Please try again.'; render(); }
      finally { $(id).disabled = false; }
    });
  }
  extension.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const key of Object.keys(C.DEFAULTS)) if (key in changes) prefs[key] = changes[key].newValue;
    prefs = C.preferences(prefs);
    if (prefs.sfRemember && changes.sfSpeed) speed = prefs.sfSpeed;
    render();
  });
  try {
    prefs = C.preferences(await extension.storage.local.get(Object.keys(C.DEFAULTS)));
    speed = prefs.sfRemember ? prefs.sfSpeed : 1;
  } catch { /* Use defaults; save failures are surfaced when a preference is changed. */ }
  await connect(true);
})();
