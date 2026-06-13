(function () {
  const DEFAULT_LANGUAGE = "en";
  const LANGUAGE_STORAGE_KEY = "language";
  const MESSAGES = {
    en: {
      actionTitle: "Copy preview link",
      clipboardButton: "Convert clipboard link to preview link",
      converting: "Converting...",
      converted: "Preview link copied.",
      clipboardConverted: "Clipboard link converted to a preview link.",
      convertFailed: "Failed to convert the clipboard link.",
      copyFailed: "Failed to copy the preview link.",
      noSupportedLink: "No supported Google Docs, Sheets, Slides, or Drive link was found.",
      noActiveTab: "No active tab was found.",
      optionsTitle: "Drive Preview Link Copier Settings",
      languageLabel: "Language",
      english: "English",
      japanese: "Japanese",
      saved: "Saved."
    },
    ja: {
      actionTitle: "プレビューリンクをコピー",
      clipboardButton: "クリップボードのリンクをプレビューリンクに変換",
      converting: "変換しています...",
      converted: "プレビューリンクをコピーしました",
      clipboardConverted: "クリップボードのリンクをプレビューリンクに変換しました",
      convertFailed: "クリップボードのリンク変換に失敗しました",
      copyFailed: "プレビューリンクのコピーに失敗しました",
      noSupportedLink: "有効なGoogle Docs/Sheets/SlidesまたはDriveのリンクが見つかりませんでした",
      noActiveTab: "アクティブなタブが見つかりませんでした",
      optionsTitle: "Drive Preview Link Copier 設定",
      languageLabel: "言語",
      english: "英語",
      japanese: "日本語",
      saved: "保存しました"
    }
  };

  function normalizeLanguage(language) {
    return Object.hasOwn(MESSAGES, language) ? language : DEFAULT_LANGUAGE;
  }

  async function getLanguage() {
    const result = await chrome.storage.sync.get({
      [LANGUAGE_STORAGE_KEY]: DEFAULT_LANGUAGE
    });

    return normalizeLanguage(result[LANGUAGE_STORAGE_KEY]);
  }

  function t(language, key) {
    return MESSAGES[normalizeLanguage(language)][key];
  }

  globalThis.DPLC_I18N = {
    DEFAULT_LANGUAGE,
    LANGUAGE_STORAGE_KEY,
    MESSAGES,
    getLanguage,
    normalizeLanguage,
    t
  };
})();
