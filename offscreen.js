chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "OFFSCREEN_COPY_TEXT" && message?.type !== "READ_TEXT") {
    return false;
  }

  (async () => {
    try {
      if (message.type === "READ_TEXT") {
        const text = await navigator.clipboard.readText();
        sendResponse({ ok: true, text });
      } else {
        await navigator.clipboard.writeText(message.text);
        sendResponse({ ok: true });
      }
    } catch (error) {
      console.error(error);
      sendResponse({
        ok: false,
        error: String(error)
      });
    }
  })();

  return true;
});
