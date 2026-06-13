const convertButton = document.getElementById("convertClipboard");
const statusElement = document.getElementById("status");

let language = DPLC_I18N.DEFAULT_LANGUAGE;

initialize();

convertButton.addEventListener("click", async () => {
  setStatus(t("converting"), "");
  convertButton.disabled = true;

  try {
    const text = await navigator.clipboard.readText();
    const result = await chrome.runtime.sendMessage({
      type: "CONVERT_PREVIEW_TEXT",
      text
    });

    if (!result?.ok) {
      setStatus(result?.error || t("convertFailed"), "error");
      return;
    }

    await navigator.clipboard.writeText(result.url);
    setStatus(t("converted"), "success");
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

async function initialize() {
  language = await DPLC_I18N.getLanguage();
  convertButton.textContent = t("clipboardButton");
}

function t(key) {
  return DPLC_I18N.t(language, key);
}
