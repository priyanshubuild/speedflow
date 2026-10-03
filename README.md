# SpeedFlow

SpeedFlow is a Chrome extension that adds playback speed controls directly to the YouTube video player. Slow down a tutorial, speed up a lecture, or return to normal speed without opening YouTube's settings menu.

## Features

- Adjust playback speed from **0.25× to 10×** in **0.25× steps**.
- Use the **−** and **+** buttons inside the YouTube player.
- Reset to normal playback with the **1×** button or a keyboard shortcut.
- Remember your selected speed using YouTube's local browser storage.
- Hear a soft tick when you change speed.

You need desktop Google Chrome and a video on [YouTube](https://www.youtube.com/). No build tools, terminal commands, or paid account are required to install this source code.

## Install in Chrome — step by step

### 1. Download the code as a ZIP

1. Open the [SpeedFlow GitHub repository](https://github.com/priyanshubuild/speedflow).
2. Select the **main** branch if another branch is selected.
3. Click the green **Code** button above the file list.
4. Click **Download ZIP**.
5. Wait for `speedflow-main.zip` to finish downloading. It will normally appear in your **Downloads** folder.

You can also use the [direct ZIP download](https://github.com/priyanshubuild/speedflow/archive/refs/heads/main.zip).

### 2. Extract (unpack) the ZIP file

Chrome needs the extracted folder, so unpack the ZIP before loading the extension.

- **Windows:** Right-click `speedflow-main.zip`, choose **Extract All…**, choose a destination, and click **Extract**.
- **macOS:** Double-click `speedflow-main.zip` in Finder. A folder named `speedflow-main` should appear beside it.
- **Linux:** Open the ZIP with your archive manager and choose **Extract** or **Extract Here**.

Move the extracted folder to a permanent location, such as `Documents/SpeedFlow`, before installing it. Chrome uses the files in that folder, so keep it there while the extension is installed.

Open the extracted folder and check that it contains these files directly:

```text
speedflow-main/
├── manifest.json
├── content.js
├── popup.html
├── popup.js
├── popup.css
├── fonts/
└── README.md
```

If extraction created an outer folder containing another `speedflow-main` folder, use the inner folder that contains `manifest.json`.

### 3. Open Chrome's Extensions page

1. Open **Google Chrome**.
2. Open a new tab.
3. Type `chrome://extensions` into the address bar and press **Enter**.

### 4. Turn on Developer mode

On the Extensions page, turn on the **Developer mode** switch, usually in the upper-right corner. This reveals the buttons for loading extensions from your computer.

### 5. Load the unpacked extension

1. Click **Load unpacked**.
2. In the folder picker, navigate to the extracted `speedflow-main` folder (or the permanent location you chose).
3. Select the **folder containing `manifest.json`**, then confirm with **Select Folder**, **Select**, or **Open**, depending on your operating system.
4. Check that a **SpeedFlow** card appears on the Extensions page and its switch is turned on.

Choose the extracted folder itself, rather than the ZIP file or an individual file inside the folder. You do not need to open or edit `manifest.json`.

### 6. Pin SpeedFlow (optional)

1. Click Chrome's **Extensions** button (the puzzle-piece icon beside the address bar).
2. Find **SpeedFlow**.
3. Click its **pin** icon to show SpeedFlow in the toolbar.

Pinning gives you quick access to the toolbar button. The playback controls appear inside YouTube automatically.

### 7. Open YouTube and check the controls

1. Open [YouTube](https://www.youtube.com/) and play a regular video.
2. If the YouTube tab was already open when you installed SpeedFlow, **refresh that tab**.
3. Move your mouse over the video to reveal the player controls.
4. Look near the lower-right controls, beside the captions and settings buttons, for **−**, a speed readout such as **1.0×**, and **+**.
5. Click **+** once. The readout should change to **1.25×** and playback should speed up.

These installation steps follow [Chrome's official guide to loading unpacked extensions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## How to use SpeedFlow

### Player controls

| Control | What it does |
| --- | --- |
| **−** | Decreases speed by 0.25×, down to 0.25×. |
| **Speed readout** | Shows the selected speed, such as 1.0× or 1.75×. |
| **+** | Increases speed by 0.25×, up to 10×. |
| **1×** | Restores normal speed. This button appears when the speed is different from 1×. |

For example, click **+** four times from 1.0× to reach 2.0×. Click **1×** to return to normal playback.

SpeedFlow remembers the last selected speed in YouTube's local storage in that Chrome profile. Clearing YouTube site data clears the saved preference. The controls follow YouTube's player control bar, so move your mouse over the video if they are hidden.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `]` | Increase speed by 0.25×. |
| `[` | Decrease speed by 0.25×. |
| `\` (backslash) | Reset to 1×. |

Keep the YouTube page focused when using these shortcuts. They are ignored while you type in a search box, comment field, or other editable area. The shortcuts refer to the characters shown; their key positions depend on your keyboard layout.

### Toolbar button

Clicking the SpeedFlow toolbar icon attempts to activate the script on the current tab, then closes its tiny popup immediately. A large popup or separate settings window is not expected. Use the toolbar button while a YouTube tab is active; the main interface lives in the video player.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| **“Manifest file is missing or unreadable”** when loading | Extract the ZIP fully. Choose the folder that directly contains `manifest.json`, rather than its parent or the ZIP. |
| **Load unpacked** is missing | Turn on **Developer mode** at `chrome://extensions`. A managed work or school browser may restrict this feature. |
| SpeedFlow is installed but the controls are missing | Make sure SpeedFlow is enabled, open a regular video on `www.youtube.com`, refresh the tab, and move your mouse over the player. |
| The toolbar popup disappears immediately | This is expected. Look for the controls inside the YouTube player. |
| Keyboard shortcuts do nothing | Click a non-editable area of the YouTube page and try again. Leave search and comment fields first. |
| Changes are not taking effect | Click **Reload** on SpeedFlow's extension card, then refresh the YouTube tab. |
| Chrome cannot find the extension files | Restore the extracted folder to its original location, or remove SpeedFlow and load it again from its new location. |
| Speed changes conflict with another extension | Temporarily disable other YouTube speed controllers, reload SpeedFlow, and refresh YouTube. |

SpeedFlow targets `www.youtube.com`. Mobile Chrome, embedded videos on other websites, and the different YouTube Shorts interface are outside this installation guide. YouTube layout changes can also affect where the widget appears.

If the problem persists, open `chrome://extensions`, look for an **Errors** button on the SpeedFlow card, and report the message through [GitHub Issues](https://github.com/priyanshubuild/speedflow/issues). Include your Chrome version and the steps that reproduce the problem.

## Update SpeedFlow

An unpacked installation does not automatically download updates from GitHub.

1. Download and extract the newest ZIP from this repository.
2. Replace the extension files inside the **same permanent folder** you originally loaded in Chrome.
3. Open `chrome://extensions`.
4. Click **Reload** (the circular-arrow button) on the SpeedFlow card.
5. Refresh any open YouTube tabs.

If you prefer to use a different folder, remove the old installation and repeat **Load unpacked** using the new folder.

## Disable or remove SpeedFlow

1. Open `chrome://extensions`.
2. Find the **SpeedFlow** card.
3. Turn off its switch to disable it, or click **Remove** and confirm to uninstall it.
4. Refresh open YouTube tabs to clear the already-injected controls.

After removal, you can delete the extracted folder. The saved speed is stored in YouTube's site data and can remain after uninstalling; clearing YouTube site data also clears other YouTube preferences and may sign you out.

## Permissions and storage

- **YouTube site access:** The manifest limits site access to `www.youtube.com`, where the player controls run.
- **`tabs`:** The toolbar popup queries the active tab to find its target.
- **`scripting`:** The toolbar popup can inject `content.js` as a fallback on YouTube.
- **Local preference:** The selected speed is stored under `sf_speed` in YouTube's local storage.

The extension source includes no analytics or external network requests. YouTube page scripts can access the same site storage; this preference is not private extension storage.

## Project files

| File | Purpose |
| --- | --- |
| `manifest.json` | Chrome extension name, version, permissions, and script configuration. |
| `content.js` | YouTube player widget, playback speed handling, shortcuts, and saved preference. |
| `popup.html` / `popup.js` | Minimal toolbar popup and fallback script activation. |
| `popup.css` | Placeholder stylesheet; player styles are injected by `content.js`. |
| `fonts/` | Placeholder folder; the widget uses browser and YouTube fonts. |

There is no build step. Load the repository folder directly with **Load unpacked** after downloading or cloning it.
