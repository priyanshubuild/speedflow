# SpeedFlow 3.1 validation

## Player inspection and interface

The live YouTube watch player was inspected on October 3, 2026 at `https://www.youtube.com/watch?v=jNQXAC9IVRw`. It had nested right-control groups, 48px × 40px native buttons, the `"YouTube Noto", Roboto, Arial, Helvetica, sans-serif` font family, and `rgb(238,238,238)` text.

Version 3.1 restores the original basic inline interface: reset to 1× on the left, minus, a plain speed readout, and plus. Reset hides at normal speed. There is no toolbar action, popup, expandable panel, slider, or preset list. The controls copy the native player font, color, button height, and time display's text size and weight at runtime. A compact front row is used only when native controls fill a narrow player.

The live page was inspected; the extension was not installed into that browser. The screenshot is from a labeled local fixture running the production scripts, with a simulated extension API and an unloaded video.

## Automated checks

All **24 tests** pass, along with JavaScript syntax checks. The suite uses jsdom and simulated browser APIs to cover:

- Corrupt saved values, range boundaries, speed formatting, and Chrome/Firefox API namespaces.
- Inline control order, a noninteractive readout, accessible reset focus recovery, and inherited text size/weight.
- Local speed writes, cross-tab updates, and legacy popup preferences no longer disabling controls.
- Shortcuts while typing, using modifiers, composing text, or using sliders; native player hotkey propagation.
- Native rate changes, changed sources, replacement videos, and unrelated previews.
- Ads already playing at mount, ad transitions, rebuilt control bars, removed widgets/status, and navigation.
- Duplicate injection, storage failures, rejected playback speeds, and rollback of rejected cross-tab changes.

These tests simulate events and APIs. They do not prove real media playback or permission enforcement in each browser.

The Firefox package passes Mozilla's `web-ext lint` with zero errors, warnings, or notices. All three browser archives pass ZIP integrity and manifest asset checks. Generated unpacked packages remove retired popup files; archives contain no test files, dependencies, or repository metadata.

## Interactive fixture checks — October 4, 2026

The production scripts were checked in the available browser. Verified reset/minus/speed/plus order, plain readout, matching 12px/400 native time typography, playback-rate changes, reset hiding and focus transfer, rebuilt controls, native speed changes, ad pause/resume, and a 480px player fallback. The player keeps its internal scroll position at zero when buttons receive focus. The updated screenshot is `docs/front-controls.jpg`.

## Manual checks before a store release

- Install the actual extension in Chrome and Firefox; check other intended desktop browsers.
- Test real playback, buffering, playlists, Back/Forward navigation, theater, fullscreen, and miniplayer transitions.
- Check real ads, live streams, restricted videos, and permitted embeds.
- Verify browser site-access prompts, storage persistence, and changes across tabs.
- Test keyboard navigation, VoiceOver/NVDA, zoom, and forced colors.
- Build and test Apple's Safari app wrapper; source packaging alone is not Safari validation.
- Sign the Firefox package for permanent installation.

No universal compatibility or failure-free claim is made.
