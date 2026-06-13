# Google Drive Preview Link Copier

A Chrome extension that converts Google Docs / Sheets / Slides links into Google Drive preview URLs and copies them to the clipboard.

## Motivation

Google Drive links for Office files can open the file in Google's web editors, such as Google Docs, Sheets, or Slides. That is convenient, but it can also change the document's appearance, especially fonts and layout.

Opening the file through Google Drive's preview view avoids that automatic conversion path and keeps the file closer to its original rendering. If the Google Drive desktop app is installed, the preview page can also be used as a path to open Office files in the corresponding desktop app.

## Features

This extension lets you copy preview links from these places:

1. The right-click menu in the Google Drive file list
2. The share menu in the top-right corner of Google Docs / Sheets / Slides
3. The extension icon menu or keyboard shortcut from a URL already copied to the clipboard

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

### Convert from the clipboard

Copy a Google Docs / Sheets / Slides or Drive URL to the clipboard, then either:

1. Click the extension icon.
2. Click "Convert clipboard link to preview link".

Or press `Command+Shift+Y`.

This is useful for links copied from the Google Drive desktop app.

If the shortcut does not work, check the shortcut assignment for this extension at `chrome://extensions/shortcuts`.

The shortcut runs in the active tab, so it may not work on Chrome internal pages such as `chrome://extensions`.

### Language

The default UI language is English. You can switch the extension UI between English and Japanese from the extension options page:

1. Open `chrome://extensions`.
2. Open the details page for this extension.
3. Click "Extension options".
4. Select "English" or "Japanese".

The context menu, popup, injected menu item, and status messages follow this setting.

## Supported URLs

- `https://docs.google.com/document/d/{FILE_ID}/...`
- `https://docs.google.com/spreadsheets/d/{FILE_ID}/...`
- `https://docs.google.com/presentation/d/{FILE_ID}/...`
- `https://drive.google.com/open?id={FILE_ID}`
- `https://drive.google.com/file/d/{FILE_ID}/view`

If the original URL contains a `resourcekey`, it is preserved in the converted URL.

## Behavior

- The preview link is copied directly to the clipboard.
- A short non-blocking status message is shown after copy operations.
- Google Drive context menus are closed automatically after "Copy preview link" runs.

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
