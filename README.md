# Google Drive Preview Link Copier

A Chrome extension that converts Google Docs / Sheets / Slides links into Google Drive preview URLs and copies them to the clipboard.

## Features

This extension lets you copy preview links from three places:

1. The right-click menu in the Google Drive file list
2. The share menu in the top-right corner of Google Docs / Sheets / Slides
3. The extension icon or keyboard shortcut while viewing a Google Docs / Sheets / Slides file

## Installation

1. Open `chrome://extensions` in Chrome.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this extension folder.

## Usage

### Copy from Google Drive

1. Open `https://drive.google.com/`.
2. Right-click the target file.
3. Open the "Share" submenu.
4. Click "Copy preview link".

### Copy from the Docs / Sheets / Slides share menu

1. Open a Google Docs / Sheets / Slides file.
2. Open the share menu in the top-right corner.
3. Click "Copy preview link" below "Copy link".

### Copy from the extension icon or shortcut

Open a Google Docs / Sheets / Slides file, then click the extension icon or press `Command+Shift+Y`.

If the shortcut does not work, check the shortcut assignment for this extension at `chrome://extensions/shortcuts`.

## Supported URLs

- `https://docs.google.com/document/d/{FILE_ID}/...`
- `https://docs.google.com/spreadsheets/d/{FILE_ID}/...`
- `https://docs.google.com/presentation/d/{FILE_ID}/...`
- `https://drive.google.com/open?id={FILE_ID}`
- `https://drive.google.com/file/d/{FILE_ID}/view`

If the original URL contains a `resourcekey`, it is preserved in the converted URL.

## Example

This URL:

```text
https://docs.google.com/presentation/d/FILE_ID/edit?usp=drive_link
```

is copied as:

```text
https://drive.google.com/file/d/FILE_ID/view
```

## Notes

The injected menu items depend on the current Google Drive / Docs / Sheets / Slides web UI. If Google changes the page structure, the menu integration may need to be updated.
