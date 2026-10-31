import { RU } from './ru.js';
import { EN } from './en.js';
import { TR } from './tr.js';

const LANGS = { ru: RU, en: EN, tr: TR };
const LS_KEY = 'fool_lang';
const DEFAULT_LANG = 'ru';

// Читаем сохранённый язык СРАЗУ при загрузке модуля.
// Это гарантирует, что getLang() вернёт правильный язык ещё до того,
// как MainMenu будет построен в конструкторе App.
let currentLang = (() => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (LANGS[saved]) return saved;
  } catch { /* noop */ }
  return DEFAULT_LANG;
})();

export function setLang(code, { persist = true } = {}) {
  if (!LANGS[code]) code = DEFAULT_LANG;
  currentLang = code;
  if (persist) {
    try { localStorage.setItem(LS_KEY, code); } catch {}
  }
}

export function getLang() { return currentLang; }

export function getAvailableLangs() { return Object.keys(LANGS); }

export function getSavedLang() {
  try {
    const v = localStorage.getItem(LS_KEY);
    return LANGS[v] ? v : null;
  } catch { return null; }
}

export function t(key, params = {}) {
  let str = LANGS[currentLang]?.[key];
  if (str === undefined) str = LANGS.ru?.[key];
  if (str === undefined) return key;
  for (const k in params) {
    str = str.split(`{${k}}`).join(String(params[k]));
  }
  return str;
}