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
