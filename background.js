const MENU_ID_LINK = "copy-preview-link-from-link";
const OFFSCREEN_URL = "offscreen.html";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID_LINK,
    title: "プレビューリンクをコピー",
    contexts: ["link"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID_LINK) {
    return;
  }

  await convertAndCopy(info.linkUrl);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "convert_clipboard_to_preview") {
    return;
  }

  const result = await convertClipboardFromActiveTab();
  await showActionBadge(result);
  await notifyActiveTab(result);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "READ_CLIPBOARD") {
    (async () => {
      try {
        await ensureOffscreenDocument();
        const response = await chrome.runtime.sendMessage({
          type: "READ_TEXT"
        });

        sendResponse(response);
      } catch (error) {
        sendResponse({
          ok: false,
          error: String(error)
        });
      }
    })();

    return true;
  }

  if (message?.type === "COPY_TEXT") {
    (async () => {
      try {
        await copyText(message.text);
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({
          ok: false,
          error: String(error)
        });
      }
    })();

    return true;
  }

  if (message?.type === "CONVERT_PREVIEW_TEXT") {
    (async () => {
      try {
        sendResponse(convertText(message.text));
      } catch (error) {
        sendResponse({
          ok: false,
          error: String(error)
        });
      }
    })();

    return true;
  }

  if (message?.type !== "COPY_PREVIEW_LINK") {
    return false;
  }

  (async () => {
    try {
      const converted = message.fileId
        ? buildDrivePreviewUrl(message.fileId, message.resourceKey)
        : convertGoogleUrlToDrivePreview(message.sourceUrl);

      if (!converted) {
        sendResponse({
          ok: false,
          error: "Unsupported URL or missing file ID"
        });
        return;
      }

      await copyText(converted);
      sendResponse({
        ok: true,
        url: converted
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: String(error)
      });
    }
  })();

  return true;
});

async function convertAndCopy(sourceUrl) {
  const converted = convertGoogleUrlToDrivePreview(sourceUrl);

  if (!converted) {
    console.warn("Unsupported URL:", sourceUrl);
    return;
  }

  await copyText(converted);
}

function convertText(text) {
  const converted = convertGoogleUrlToDrivePreview(text);

  if (!converted) {
    return {
      ok: false,
      error: "有効なGoogle Docs/Sheets/SlidesまたはDriveのリンクが見つかりませんでした"
    };
  }

  return {
    ok: true,
    url: converted
  };
}

async function convertClipboardFromActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  const tab = tabs[0];

  if (!tab?.id) {
    return {
      ok: false,
      error: "アクティブなタブが見つかりませんでした"
    };
  }

  try {
    const [readInjection] = await chrome.scripting.executeScript({
      target: {
        tabId: tab.id
      },
      func: () => navigator.clipboard.readText()
    });

    const result = convertText(readInjection.result);

    if (!result.ok) {
      return result;
    }

    await chrome.scripting.executeScript({
      target: {
        tabId: tab.id
      },
      func: (text) => navigator.clipboard.writeText(text),
      args: [result.url]
    });

    return result;
  } catch (error) {
    return {
      ok: false,
      error: `クリップボードの変換に失敗しました: ${error.message || error}`
    };
  }
}

function convertGoogleUrlToDrivePreview(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  const sourceUrl = extractSupportedGoogleUrl(rawUrl);

  if (!sourceUrl) {
    return null;
  }

  let url;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }

  if (url.hostname === "docs.google.com") {
    const match = url.pathname.match(
      /^\/(document|spreadsheets|presentation)\/d\/([^/]+)/
    );

    if (!match) {
      return null;
    }

    return buildDrivePreviewUrl(match[2], url.searchParams.get("resourcekey"));
  }

  if (url.hostname === "drive.google.com" && url.pathname === "/open") {
    const fileId = url.searchParams.get("id");

    if (!fileId) {
      return null;
    }

    return buildDrivePreviewUrl(fileId, url.searchParams.get("resourcekey"));
  }

  if (url.hostname === "drive.google.com") {
    const fileMatch = url.pathname.match(/^\/file\/d\/([^/]+)\/view/);

    if (fileMatch) {
      return buildDrivePreviewUrl(fileMatch[1], url.searchParams.get("resourcekey"));
    }
  }

  return null;
}

function extractSupportedGoogleUrl(text) {
  return text
    .trim()
    .match(/https:\/\/(?:docs|drive)\.google\.com\/[^\s"'<>]+/)?.[0] || null;
}

function buildDrivePreviewUrl(fileId, resourceKey) {
  const out = new URL(`https://drive.google.com/file/d/${fileId}/view`);

  if (resourceKey) {
    out.searchParams.set("resourcekey", resourceKey);
  }

  return out.toString();
}

async function copyText(text) {
  await ensureOffscreenDocument();

  const response = await chrome.runtime.sendMessage({
    type: "OFFSCREEN_COPY_TEXT",
    text
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Failed to copy text");
  }
}

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)]
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["CLIPBOARD"],
    justification: "Copy converted Google Drive preview links to clipboard"
  });
}

async function notifyActiveTab(result) {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  const tab = tabs[0];

  if (!tab?.id || !tab.url) {
    return;
  }

  const url = new URL(tab.url);
  if (url.hostname !== "drive.google.com" && url.hostname !== "docs.google.com") {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_TOAST",
      message: result.ok
        ? "クリップボードのリンクをプレビューリンクに変換しました"
        : result.error,
      tone: result.ok ? "success" : "error"
    });
  } catch (error) {
    console.warn("Page notification unavailable:", error);
  }
}

async function showActionBadge(result) {
  await chrome.action.setBadgeBackgroundColor({
    color: result.ok ? "#137333" : "#b3261e"
  });
  await chrome.action.setBadgeText({
    text: result.ok ? "OK" : "ERR"
  });

  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
  }, 2400);
}
