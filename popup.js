const convertButton = document.getElementById("convertClipboard");
const statusElement = document.getElementById("status");

convertButton.addEventListener("click", async () => {
  setStatus("変換しています...", "");
  convertButton.disabled = true;

  try {
    const text = await navigator.clipboard.readText();
    const result = await chrome.runtime.sendMessage({
      type: "CONVERT_PREVIEW_TEXT",
      text
    });

    if (!result?.ok) {
      setStatus(result?.error || "クリップボードのリンク変換に失敗しました", "error");
      return;
    }

    await navigator.clipboard.writeText(result.url);
    setStatus("プレビューリンクをコピーしました", "success");
  } catch (error) {
    setStatus(String(error), "error");
  } finally {
    convertButton.disabled = false;
  }
});

function setStatus(message, tone) {
  statusElement.textContent = message;
  statusElement.className = tone;
}
