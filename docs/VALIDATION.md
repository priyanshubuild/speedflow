# SpeedFlow 3.0 validation

## Live player inspection

On October 3, 2026, the YouTube watch player was opened in the available browser at `https://www.youtube.com/watch?v=jNQXAC9IVRw`. DOM and computed-style inspection showed:

- `.html5-video-player` contains `.ytp-chrome-controls`.
- `.ytp-right-controls` uses nested `.ytp-right-controls-left` and `.ytp-right-controls-right` groups, rather than a flat list of buttons.
- Visible native buttons measured 48px wide and 40px tall on that layout.
- The native control font family was `"YouTube Noto", Roboto, Arial, Helvetica, sans-serif`, with `rgb(238,238,238)` text.
- Native settings labels were 14px. The settings panel had a 12px corner radius and a translucent dark background.

SpeedFlow derives font, text color, and button height from the native button at runtime. Its main controls are inserted directly into the right controls, outside YouTube's Settings menu and collapsible inner groups. SpeedFlow's own panel uses a more opaque dark background to preserve readable contrast.

The live page was inspected; the extension was not installed into that browser. The local fixture is explicitly labeled as a reconstruction and uses no downloaded YouTube player implementation.

## Automated checks

All 32 automated tests passed. The Node test suite uses jsdom and simulated extension APIs. It covers:

- Invalid preferences, speed boundaries, origin checks, and both browser API namespaces.
- Visible placement on the nested control structure, playback changes, and local preference writes.
- Shortcut behavior while typing, using modifier keys, composing input, and moving a slider.
- Panel labels, selected states, slider value text, and Escape/Arrow Down focus behavior.
- Native rate changes, changed media sources, ad transitions, and unrelated video previews.
- Removed widgets/panels, rebuilt control bars, replacement videos, SPA navigation, and duplicate injection.
- Disable/enable behavior, remember/shortcut preferences, storage failures, and rejected media speeds.
- Popup messaging, origin restrictions, reconnect injection, ad feedback, and preference save errors.

These tests simulate rate events and APIs. They do not prove real media playback or the permission/runtime behavior of each browser.

The Firefox package also passed Mozilla's `web-ext lint` with **zero errors, warnings, or notices**. Desktop Firefox has a 140 minimum; the generated Android metadata has a 142 minimum to satisfy the data-collection manifest schema. Android is outside this release's supported UI scope.

All three browser archives were checked for ZIP integrity, valid referenced assets, absence of test/dependency/repository files, and byte-for-byte reproducible output.

## Interactive fixture checks

The production scripts and styles were loaded in a local test page through the available browser. Checks included visible speed buttons, actual `HTMLVideoElement.playbackRate` changes on an unloaded video, a control-bar rebuild, native rate changes, simulated ad start/end, menu focus, and menu containment.

Layouts were inspected at the default 1280px viewport, 640px, and 400px. The 400px case used the compact front-row fallback without covering native buttons. The panel remained within the player and scrolled when its height exceeded the available space. A focus-induced player scrolling issue found during these checks was fixed with scoped clipping while the panel is open.

## Manual checks before a store release

- Install the actual unpacked extension in current Chrome and Firefox, then check Edge and the other intended browsers.
- Test real video playback, buffering, playlists, Back/Forward navigation, theater mode, fullscreen, and miniplayer transitions.
- Check ads, live streams, restricted videos, and permitted embeds on third-party pages.
- Check installation/site-access prompts, already-open-tab reconnect, storage persistence, and synchronization across tabs.
- Test with VoiceOver and NVDA, keyboard-only navigation, zoom, forced colors, and reduced motion.
- Build and test Apple's Safari app wrapper. Source packaging alone is not Safari validation.
- Sign the Firefox package before distributing a permanent installation.

No claim of universal browser compatibility or failure-free operation is made.
