const titleElement = document.getElementById("title");
const languageLabel = document.getElementById("languageLabel");
const languageSelect = document.getElementById("language");
const statusElement = document.getElementById("status");

let language = DPLC_I18N.DEFAULT_LANGUAGE;

initialize();

languageSelect.addEventListener("change", async () => {
  language = DPLC_I18N.normalizeLanguage(languageSelect.value);
  await chrome.storage.sync.set({
    [DPLC_I18N.LANGUAGE_STORAGE_KEY]: language
  });
  render();
  statusElement.textContent = t("saved");
});

async function initialize() {
  language = await DPLC_I18N.getLanguage();
  languageSelect.value = language;
  render();
}

function render() {
  document.documentElement.lang = language;
  titleElement.textContent = t("optionsTitle");
  languageLabel.textContent = t("languageLabel");
  languageSelect.options[0].textContent = t("english");
  languageSelect.options[1].textContent = t("japanese");
}

function t(key) {
  return DPLC_I18N.t(language, key);
}
