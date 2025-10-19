# API Catcher

API Catcher is a lightweight browser extension that captures HTTP(S) requests made by web pages, lets you organize them into folders, search and filter calls, view details (headers/body/status), and export selected requests to a Postman collection.

## Features

- Capture all outgoing web requests (method, URL, headers, body, status)
- Live updates in the popup when requests are observed
- Search and filter (All / Unique)
- Organize requests into named folders
- Export all/filtered/foldered requests to a Postman collection (.postman_collection.json)
- Simple details view with request headers and body

## Files of interest

- `manifest.json` - extension manifest (MV3)
- `background.js` - service worker capturing web requests
- `popup/index.html`, `popup/popup.js`, `popup/style.css` - extension popup UI and logic
- `icons/` - extension icons
- `LICENSE` - MIT license

## Installation (Load into Chromium-based browsers such as Chrome, Edge, Brave)

1. Open the browser and go to the Extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Enable "Developer mode" (top-right toggle).
3. Click "Load unpacked" (or "Load unpacked extension").
4. In the file chooser select the project folder (the folder that contains `manifest.json`).
5. The extension should appear in the list and an icon will show in the toolbar.

Notes:
- Manifest v3 uses a service worker (`background.js`). The browser may unload the worker when idle; captured requests are kept in memory while the service worker is active.
- You must grant host permissions when installing (the manifest requests `<all_urls>`). This is necessary for the webRequest API to work.

## Installation (Firefox - temporary loading)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** and pick the `manifest.json` file from the project.
3. Note: Firefox MV3 support may differ from Chromium; some APIs/behavior can vary.

## How to use

1. Click the extension icon to open the popup UI.
2. The popup shows captured API calls (new calls arrive automatically while the extension is active).
3. Controls:
   - All / Unique: toggles whether to show every request or unique URLs only.
   - Search box: filter results by URL substring.
   - Clear: clears captured API calls.
   - Delete Folders: removes all saved folders.
   - + Create Folder: create a named folder to organize requests.
   - Move to Folder (per-request button): move a captured request into a folder.
   - Export All / Export Filtered: download a Postman collection containing selected requests.
4. Click a request to open a details view (headers/body/status). Use ← Back to return.

## Export to Postman

- Use the Export buttons to download a `.postman_collection.json` file compatible with Postman v2.1 format.
- Folder exports are available from the folder list in the popup.

## Development & Debugging tips

- Inspect the popup: right-click the extension icon and choose "Inspect popup" (or open the extension in the extensions page and click the inspect link).
- Inspect the background service worker: on the Extensions page, click the "Service worker" / "background page" link for the extension (when available) to see console logs.

Example from console (when the extension is installed):

- Get captured calls: 
  `chrome.runtime.sendMessage({ action: 'getApiCalls' }, console.log)`
- Clear captured calls:
  `chrome.runtime.sendMessage({ action: 'clearApiCalls' }, console.log)`

## Privacy

- The extension requests wide host permissions (`<all_urls>`) to observe web requests. Only request metadata and headers/bodies are stored in memory for the popup UI and exported files.
## Important
- No telemetry or external servers are contacted by this extension.

## License

This project is released under the MIT License. See the `LICENSE` file.

---
