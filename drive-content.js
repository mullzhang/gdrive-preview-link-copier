const MENU_ITEM_ID = "drive-preview-link-copier-menu-item";
const TOAST_ID = "drive-preview-link-copier-toast";
const FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{20,}$/;

let lastContextTarget = null;
let lastActivationTime = 0;
let toastTimer = null;

document.addEventListener(
  "contextmenu",
  (event) => {
    lastContextTarget = event.target;
    setTimeout(injectIntoVisibleMenus, 0);
  },
  true
);

document.addEventListener(
  "pointerdown",
  (event) => {
    if (
      event.target.closest?.(`#${MENU_ITEM_ID}`) ||
      event.target.closest?.('[role="menu"]')
    ) {
      return;
    }

    lastContextTarget = event.target;
  },
  true
);

document.addEventListener(
  "keydown",
  async (event) => {
    if (!isCopyShortcut(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    await copyPreviewFromPage("keydown");
  },
  true
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "COPY_PREVIEW_FROM_PAGE") {
    return false;
  }

  (async () => {
    const result = await copyPreviewFromPage(`message:${message.source || "unknown"}`);
    sendResponse({
      handled: true,
      ok: result.ok
    });
  })();

  return true;
});

const observer = new MutationObserver(() => {
  injectIntoVisibleMenus();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

function injectIntoVisibleMenus() {
  for (const copyLinkItem of findVisibleCopyLinkItems()) {
    const container = findMenuContainer(copyLinkItem);
    if (!container || container.querySelector(`#${MENU_ITEM_ID}`)) {
      continue;
    }

    copyLinkItem.insertAdjacentElement("afterend", createMenuItem(copyLinkItem));
  }
}

function createMenuItem(copyLinkItem) {
  const referenceItem = copyLinkItem
    ?.closest('[role="menu"]')
    ?.querySelector('[role="menuitem"]');
  const item = copyLinkItem?.cloneNode(true) || document.createElement("div");

  removeIds(item);
  item.id = MENU_ITEM_ID;
  item.setAttribute("role", "menuitem");
  item.tabIndex = 0;
  item.style.cursor = "pointer";
  item.style.userSelect = "none";
  replaceMenuItemText(item, "リンクをコピー", "プレビューリンクをコピー");

  if (!copyLinkItem && referenceItem) {
    item.className = referenceItem.className;
    item.textContent = "プレビューリンクをコピー";
    item.style.boxSizing = "border-box";
    item.style.minHeight = "36px";
    item.style.paddingTop = "9px";
    item.style.paddingBottom = "9px";
    item.style.lineHeight = "18px";
  }

  const activate = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const now = Date.now();
    if (now - lastActivationTime < 700) {
      return;
    }
    lastActivationTime = now;

    const debug = createDebugLog(copyLinkItem);
    const fileInfo = findFileInfo(debug);
    const result = fileInfo
      ? await copyPreviewUrlFromFileInfo(fileInfo, debug)
      : await copyPreviewUrlFromDriveMenu(copyLinkItem, debug);

    if (!result.ok) {
      reportFailure(debug);
      return;
    }

    showToast("プレビューリンクをコピーしました");
  };

  item.addEventListener("pointerdown", activate, true);
  item.addEventListener("mousedown", activate, true);
  item.addEventListener("click", activate, true);
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      activate(event);
    }
  });

  return item;
}

function replaceMenuItemText(root, fromText, toText) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode;

    if (node.nodeValue?.includes(fromText)) {
      node.nodeValue = node.nodeValue.replace(fromText, toText);
      return;
    }
  }

  root.textContent = toText;
}

function removeIds(root) {
  if (root instanceof Element) {
    root.removeAttribute("id");
  }

  for (const element of root.querySelectorAll?.("[id]") || []) {
    element.removeAttribute("id");
  }
}

function findOwnMenuItemByText(root, text) {
  return Array.from(root.querySelectorAll('[role="menuitem"]')).find((item) =>
    item.closest('[role="menu"]') === root &&
    (item.textContent || "").includes(text)
  );
}

function findVisibleCopyLinkItems() {
  const menuItems = Array.from(
    document.querySelectorAll(
      [
        '[role="menuitem"]',
        '[role="button"]',
        '[role="option"]',
        '[aria-label*="リンクをコピー"]'
      ].join(", ")
    )
  );

  const items = menuItems.filter((item) =>
    isVisible(item) &&
    (item.textContent || item.getAttribute("aria-label") || "").includes("リンクをコピー") &&
    !item.closest(`#${MENU_ITEM_ID}`)
  );

  return items.filter((item) => {
    const container = findMenuContainer(item);
    return container && !container.querySelector(`#${MENU_ITEM_ID}`);
  });
}

function findMenuContainer(element) {
  return element.closest(
    [
      '[role="menu"]',
      '[role="dialog"]',
      '[role="presentation"]',
      '[role="listbox"]',
      '[aria-modal="true"]'
    ].join(", ")
  );
}

function isCopyShortcut(event) {
  return (
    event.metaKey &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    event.code === "KeyY"
  );
}

async function copyPreviewFromPage(source) {
  const debug = createDebugLog(null);
  debug.steps.push({
    step: "trigger",
    ok: true,
    detail: source
  });

  const fileInfo =
    readFileInfoFromUrl(window.location.href) || findFileInfo(debug);
  const result = fileInfo
    ? await copyPreviewUrlFromFileInfo(fileInfo, debug)
    : await copyPreviewUrlFromCurrentUrl(debug);

  if (!result.ok) {
    reportFailure(debug);
  }

  return result;
}

function findFileInfo(debug) {
  const readers = [
    ["currentUrl", () => readFileInfoFromUrl(window.location.href)],
    ["lastContextTarget", () => readFileInfoFromElement(lastContextTarget)],
    ["selectedRows", readFileInfoFromSelectedRows],
    ["focusedRows", readFileInfoFromFocusedRows]
  ];

  for (const [label, reader] of readers) {
    const info = reader();
    debug.steps.push({
      step: `findFileInfo:${label}`,
      ok: Boolean(info),
      detail: info || describeElement(lastContextTarget)
    });

    if (info) {
      return info;
    }
  }

  return null;
}

async function copyPreviewUrlFromDriveMenu(copyLinkItem, debug) {
  debug.steps.push({
    step: "driveCopy:dispatch",
    ok: Boolean(copyLinkItem),
    detail: describeElement(copyLinkItem)
  });

  if (copyLinkItem) {
    copyLinkItem.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse"
      })
    );
    copyLinkItem.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true
      })
    );
    copyLinkItem.click();
  }

  await sleep(350);

  const readResponse = await chrome.runtime.sendMessage({
    type: "READ_CLIPBOARD"
  });

  debug.steps.push({
    step: "clipboard:readAfterDriveCopy",
    ok: Boolean(readResponse?.ok),
    detail: summarizeClipboardResponse(readResponse)
  });

  if (!readResponse?.ok) {
    return { ok: false };
  }

  const converted = convertGoogleUrlToDrivePreview(readResponse.text);
  debug.steps.push({
    step: "convertCopiedText",
    ok: Boolean(converted),
    detail: converted || readResponse.text
  });

  if (!converted) {
    return { ok: false };
  }

  return writeText(converted, debug, "clipboard:writeConvertedCopiedText");
}

async function copyPreviewUrlFromCurrentUrl(debug) {
  const converted = convertGoogleUrlToDrivePreview(window.location.href);
  debug.steps.push({
    step: "convertCurrentUrl",
    ok: Boolean(converted),
    detail: converted || window.location.href
  });

  if (!converted) {
    return { ok: false };
  }

  return writeText(converted, debug, "clipboard:writeCurrentUrl");
}

function readFileInfoFromSelectedRows() {
  const selected = document.querySelectorAll(
    [
      '[aria-selected="true"]',
      '[data-is-selected="true"]',
      '[data-selected="true"]',
      '.a-d-s[aria-selected="true"]',
      '.a-d-s.KWqufe',
      '.WYuW0e[aria-selected="true"]'
    ].join(", ")
  );

  for (const element of selected) {
    const info = readFileInfoFromElement(element);
    if (info) {
      return info;
    }
  }

  return null;
}

function readFileInfoFromFocusedRows() {
  const focused = document.querySelectorAll(
    [
      '[role="row"][tabindex="0"]',
      '[role="gridcell"][tabindex="0"]',
      '[aria-current="true"]'
    ].join(", ")
  );

  for (const element of focused) {
    const info = readFileInfoFromElement(element);
    if (info) {
      return info;
    }
  }

  return null;
}

function readFileInfoFromElement(element) {
  let current = element instanceof Element ? element : null;

  while (current && current !== document.documentElement) {
    const fromLinks = readFileInfoFromLinks(current);
    if (fromLinks) {
      return fromLinks;
    }

    const fromAttributes = readFileInfoFromAttributes(current);
    if (fromAttributes) {
      return fromAttributes;
    }

    current = current.parentElement;
  }

  return null;
}

function readFileInfoFromLinks(root) {
  const links = root.matches?.("a[href]")
    ? [root]
    : Array.from(root.querySelectorAll?.("a[href]") || []);

  for (const link of links) {
    const info = readFileInfoFromUrl(link.href);
    if (info) {
      return info;
    }
  }

  return null;
}

function readFileInfoFromAttributes(element) {
  for (const attribute of element.getAttributeNames()) {
    const value = element.getAttribute(attribute);
    const info = readFileInfoFromUrl(value);

    if (info) {
      return info;
    }
  }

  const dataKeys = ["id", "docid", "docId", "targetId", "itemId"];

  for (const key of dataKeys) {
    const value = element.dataset?.[key];
    const fileId = extractFileId(value);

    if (fileId) {
      return {
        fileId,
        resourceKey: null
      };
    }
  }

  return null;
}

function readFileInfoFromUrl(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const pathMatch = url.pathname.match(
    /\/(?:file|document|spreadsheets|presentation)\/d\/([^/]+)/
  );
  const fileId = pathMatch?.[1] || url.searchParams.get("id");

  if (!fileId || !FILE_ID_PATTERN.test(fileId)) {
    return null;
  }

  return {
    fileId,
    resourceKey: url.searchParams.get("resourcekey")
  };
}

async function copyPreviewUrlFromFileInfo(fileInfo, debug) {
  debug.steps.push({
    step: "buildPreviewUrlFromFileInfo",
    ok: true,
    detail: fileInfo
  });

  return writeText(
    buildDrivePreviewUrl(fileInfo.fileId, fileInfo.resourceKey),
    debug,
    "clipboard:writeFromFileInfo"
  );
}

async function writeText(text, debug, step) {
  try {
    await navigator.clipboard.writeText(text);
    debug.steps.push({
      step: `${step}:contentScript`,
      ok: true,
      detail: text
    });

    return {
      ok: true
    };
  } catch (error) {
    debug.steps.push({
      step: `${step}:contentScript`,
      ok: false,
      detail: String(error)
    });
  }

  const response = await chrome.runtime.sendMessage({
    type: "COPY_TEXT",
    text
  });

  debug.steps.push({
    step: `${step}:background`,
    ok: Boolean(response?.ok),
    detail: response?.ok ? text : response?.error || response
  });

  return {
    ok: Boolean(response?.ok)
  };
}

function convertGoogleUrlToDrivePreview(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  let url;
  try {
    url = new URL(rawUrl.trim());
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
      return rawUrl.trim();
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

function extractFileId(value) {
  if (!value) {
    return null;
  }

  const fromUrl = readFileInfoFromUrl(value);
  if (fromUrl) {
    return fromUrl.fileId;
  }

  const tokens = value.match(/[a-zA-Z0-9_-]{20,}/g) || [];
  return tokens.find((token) => FILE_ID_PATTERN.test(token)) || null;
}

function createDebugLog(copyLinkItem) {
  return {
    url: window.location.href,
    lastContextTarget: describeElement(lastContextTarget),
    copyLinkItem: describeElement(copyLinkItem),
    selectedCount: document.querySelectorAll('[aria-selected="true"]').length,
    menuCount: document.querySelectorAll('[role="menu"]').length,
    steps: []
  };
}

function reportFailure(debug) {
  console.group("Drive Preview Link Copier failure");
  console.log(debug);
  console.groupEnd();

  showToast("プレビューリンクのコピーに失敗しました", "error");
}

function showToast(message, tone = "success") {
  let toast = document.getElementById(TOAST_ID);

  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.documentElement.appendChild(toast);
  }

  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "2147483647",
    maxWidth: "320px",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: "8px",
    color: "#fff",
    background: tone === "error" ? "#b3261e" : "#1f1f1f",
    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.24)",
    font: "13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
    pointerEvents: "none"
  });

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.remove();
    toastTimer = null;
  }, 2400);
}

function summarizeClipboardResponse(response) {
  if (!response?.ok) {
    return response?.error || response;
  }

  const text = response.text || "";
  return {
    length: text.length,
    head: text.slice(0, 160)
  };
}

function describeElement(element) {
  if (!(element instanceof Element)) {
    return null;
  }

  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    className: String(element.className || "").slice(0, 160),
    role: element.getAttribute("role"),
    ariaSelected: element.getAttribute("aria-selected"),
    text: (element.textContent || "").trim().slice(0, 160),
    attrs: Array.from(element.getAttributeNames())
      .slice(0, 20)
      .map((name) => [name, (element.getAttribute(name) || "").slice(0, 120)])
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none"
  );
}
