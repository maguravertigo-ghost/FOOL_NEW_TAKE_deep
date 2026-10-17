import { RU } from './ru.js';

const LANGS = { ru: RU };
let currentLang = 'ru';

export function setLang(code) {
  if (LANGS[code]) currentLang = code;
}

export function getLang() { return currentLang; }

export function t(key, params = {}) {
  const dict = LANGS[currentLang];
  if (!dict) return key;
  let str = dict[key];
  if (str === undefined) return key;
  for (const k in params) {
    str = str.split(`{${k}}`).join(String(params[k]));
  }
  return str;
}