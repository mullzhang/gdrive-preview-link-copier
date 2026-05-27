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

chrome.action.onClicked.addListener(async (tab) => {
  const handledByPage = await copyFromPage(tab, "action");
  if (handledByPage) {
    return;
  }

  await convertAndCopy(tab?.url);
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

async function copyFromPage(tab, source) {
  if (!tab?.id || !tab.url) {
    return false;
  }

  const url = new URL(tab.url);
  if (url.hostname !== "drive.google.com" && url.hostname !== "docs.google.com") {
    return false;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "COPY_PREVIEW_FROM_PAGE",
      source
    });

    return Boolean(response?.handled);
  } catch (error) {
    console.warn("Page copy handler unavailable:", error);
    return false;
  }
}

function convertGoogleUrlToDrivePreview(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  let url;
  try {
    url = new URL(rawUrl);
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
      return rawUrl;
    }
  }

  return null;
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
