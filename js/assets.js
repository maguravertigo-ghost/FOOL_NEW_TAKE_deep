import { getLang } from './i18n/index.js';

const BASE = 'assets';

export const ASSETS = {
  logos: {
    ru: `${BASE}/hud/logo/logo_main_RU.webp`,
    en: `${BASE}/hud/logo/logo_main_EN.webp`,
    tr: `${BASE}/hud/logo/logo_main_TR.webp`,
  },
  btnPodkidnoy: {
    ru: `${BASE}/hud/buttons/straight_bttn_RU.webp`,
    en: `${BASE}/hud/buttons/straight_bttn_EN.webp`,
    tr: `${BASE}/hud/buttons/straight_bttn_TR.webp`,
  },
  btnPerevodnoy: {
    ru: `${BASE}/hud/buttons/transfer_bttn_RU.webp`,
    en: `${BASE}/hud/buttons/transfer_bttn_EN.webp`,
    tr: `${BASE}/hud/buttons/transfer_bttn_TR.webp`,
  },
  table:  `${BASE}/table_texture/default_table.svg`,
  shirt:  `${BASE}/card_shirt/default/card_shirt.webp`,
  body:   `${BASE}/card_body/body/default/card_body.svg`,
  shadow: `${BASE}/card_body/shadow/card_shadow.svg`,
  overlay: `${BASE}/card_overlay/deprecated_to_click.svg`,

  settingsIcon: `${BASE}/hud/settings_icon.svg`,
  fullscreenIcon: `${BASE}/hud/icons/fullscreen.svg`,
  
  shopIcons: {
    shirt:  `${BASE}/hud/icons/shirts.svg`,
    design: `${BASE}/hud/icons/styles.svg`,
    suits:  `${BASE}/hud/icons/suits.svg`,
    table:  `${BASE}/hud/icons/table.svg`,
    decor:  `${BASE}/hud/icons/decor.svg`,
    movie:  `${BASE}/hud/icons/movie.svg`, // <-- ДОБАВИТЬ ЭТО
  },
	pokerChip: `${BASE}/hud/icons/poker_chip.svg`,
	newOneIcon: `${BASE}/hud/icons/new_one.svg`,
	lockIcon:   `${BASE}/hud/icons/lock.svg`,
  
  mainMenuBg: `${BASE}/hud/main_menu_bg.webp`,
  
    // Joker
  jokerWin:     `${BASE}/hud/joker/joker_wins.webp`,
  jokerLose:    `${BASE}/hud/joker/joker_losing.webp`,
  jokerDraw:    `${BASE}/hud/joker/joker_draw.webp`,
  jokerShop:    `${BASE}/hud/joker/joker_trading.webp`,
  jokerLies:    `${BASE}/hud/joker/joker_lies.webp`,
  // Joker — эмоции
	jokerSetOk:   `${BASE}/hud/joker/joker_set_ok.webp`,
	jokerSetNice: `${BASE}/hud/joker/joker_set_nice.webp`,
	jokerSetFive: `${BASE}/hud/joker/joker_set_give_five.webp`,
	jokerSetSad:  `${BASE}/hud/joker/joker_set_sad.webp`,
	foolToken:    `${BASE}/hud/joker/fool_token.webp`,
	jokerSuit:    `${BASE}/hud/joker/joker_suit.webp`,
	pogon:        `${BASE}/hud/joker/pogon.webp`,
	galstuk:      `${BASE}/hud/joker/galstuk.webp`,
	jokerFaceSmiling: `${BASE}/hud/joker/joker_face_smiling.webp`,
  coinFrames: [
    `${BASE}/hud/joker/coin_0.webp`,
    `${BASE}/hud/joker/coin_1.webp`,
    `${BASE}/hud/joker/coin_2.webp`,
    `${BASE}/hud/joker/coin_3.webp`,
    `${BASE}/hud/joker/coin_4.webp`,
    `${BASE}/hud/joker/coin_5.webp`,
    `${BASE}/hud/joker/coin_6.webp`,
    `${BASE}/hud/joker/coin_7.webp`,
  ],
  // Decorations
decorations: [
  `${BASE}/decoration/frame.webp`,
  `${BASE}/decoration/collage.webp`,
  `${BASE}/decoration/parket.webp`,
  `${BASE}/decoration/bricks.webp`,
  `${BASE}/decoration/marble.webp`,
  `${BASE}/decoration/wood.webp`,
  `${BASE}/decoration/nebula.webp`,
],

  // Shop previews — реальные файлы
shirts: [
  `${BASE}/card_shirt/default/card_shirt.webp`,
  `${BASE}/card_shirt/default/gray_shirt.webp`,
  `${BASE}/card_shirt/default/red_shirt.webp`,
  `${BASE}/card_shirt/default/yellow_shirt.webp`,
  
  `${BASE}/card_shirt/default/shirt_N1.webp`,
  `${BASE}/card_shirt/default/shirt_N2.webp`,
  `${BASE}/card_shirt/default/shirt_N3.webp`,
  `${BASE}/card_shirt/default/shirt_N4.webp`,
  
  `${BASE}/card_shirt/default/shirt_K1.webp`,
  `${BASE}/card_shirt/default/shirt_K2.webp`,
  `${BASE}/card_shirt/default/shirt_K3.webp`,
  `${BASE}/card_shirt/default/shirt_K4.webp`,
  
  `${BASE}/card_shirt/default/shirt_M1.webp`,
  `${BASE}/card_shirt/default/shirt_M2.webp`,
  `${BASE}/card_shirt/default/shirt_M3.webp`,
  `${BASE}/card_shirt/default/shirt_M4.webp`,
],
  designs: [
    `${BASE}/card_body/body/default/card_body.svg`,
  ],
  tables: [
    `${BASE}/table_texture/default_table.svg`,
    `${BASE}/table_texture/blue_table.svg`,
    `${BASE}/table_texture/red_table.svg`,
    `${BASE}/table_texture/orange_table.svg`,
    `${BASE}/table_texture/violet_table.svg`,
    `${BASE}/table_texture/gray_table.svg`,
    `${BASE}/table_texture/black_table.svg`,
  ],

  ranks: (() => {
    const rankLang = (getLang() === 'ru') ? 'ru' : 'en';
    const base = `${BASE}/card_body/ranks/default`;
    return {
      '2':  `${base}/base/2.svg`,
      '3':  `${base}/base/3.svg`,
      '4':  `${base}/base/4.svg`,
      '5':  `${base}/base/5.svg`,
      '6':  `${base}/base/6.svg`,
      '7':  `${base}/base/7.svg`,
      '8':  `${base}/base/8.svg`,
      '9':  `${base}/base/9.svg`,
      '10': `${base}/base/10.svg`,
      'J':  `${base}/${rankLang}/J.svg`,
      'Q':  `${base}/${rankLang}/Q.svg`,
      'K':  `${base}/${rankLang}/K.svg`,
      'A':  `${base}/${rankLang}/A.svg`,
    };
  })(),

  ranks_wide: (() => {
    const rankLang = (getLang() === 'ru') ? 'ru' : 'en';
    const base = `${BASE}/card_body/ranks/wide`;
    return {
      '2':  `${base}/base/2.svg`,
      '3':  `${base}/base/3.svg`,
      '4':  `${base}/base/4.svg`,
      '5':  `${base}/base/5.svg`,
      '6':  `${base}/base/6.svg`,
      '7':  `${base}/base/7.svg`,
      '8':  `${base}/base/8.svg`,
      '9':  `${base}/base/9.svg`,
      '10': `${base}/base/10.svg`,
      'J':  `${base}/${rankLang}/J.svg`,
      'Q':  `${base}/${rankLang}/Q.svg`,
      'K':  `${base}/${rankLang}/K.svg`,
      'A':  `${base}/${rankLang}/A.svg`,
    };
  })(),

  suits: {
    diamonds: `${BASE}/card_body/suits/default/diamonds.svg`,
    hearts:   `${BASE}/card_body/suits/default/hearts.svg`,
    clubs:    `${BASE}/card_body/suits/default/clubs.svg`,
    spades:   `${BASE}/card_body/suits/default/spades.svg`,
  }
};

// ---------- Кэш инлайн-SVG ----------

const SVG_CACHE = new Map();

function collectUrls() {
  return [
    ASSETS.body, ASSETS.shadow, ASSETS.overlay,
    ASSETS.settingsIcon,
    ...Object.values(ASSETS.ranks),
	...Object.values(ASSETS.ranks_wide), // <-- ДОБАВИТЬ
    ...Object.values(ASSETS.suits),
  ];
}

/**
 * Предзагрузка всех SVG: fetch → parse через template.innerHTML → кэш.
 * template.innerHTML (а не DOMParser) — потому что HTML-парсер
 * автоматически кладёт <svg> и его детей в SVG-namespace,
 * даже если в исходнике отсутствует xmlns.
 */
export async function preloadSvgs() {
  const urls = collectUrls();

  const results = await Promise.allSettled(urls.map(async (url) => {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    let txt = await res.text();
    // XML-декларация и DOCTYPE в HTML-парсер не нужны
    txt = txt
      .replace(/<\?xml[^>]*\?>/i, '')
      .replace(/<!DOCTYPE[^>]*>/i, '')
      .trim();

    const tpl = document.createElement('template');
    tpl.innerHTML = txt;
    const svg = tpl.content.firstElementChild;

    if (!svg || svg.tagName.toLowerCase() !== 'svg') {
      throw new Error('not an <svg> root');
    }
    // гарантируем namespace
    if (!svg.getAttribute('xmlns')) {
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    SVG_CACHE.set(url, svg);
  }));

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn('[assets] preload FAILED:', urls[i], '-', r.reason?.message || r.reason);
    }
  });

  return results;
}

// Не блокирует boot, грузится в фоне
export function preloadShirts() {
  return Promise.all(ASSETS.shirts.map(url => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      // decode() гарантирует, что браузер уже готов РИСОВАТЬ,
      // а не только «загрузил файл» — без этого первая карта в матче
      // показывает SVG-подложку, а WebP подъезжает на следующем кадре.
      if (img.decode) img.decode().then(resolve).catch(resolve);
      else resolve();
    };
    img.onerror = resolve;
    img.src = url;
  })));
}

export function preloadFaces() {
  const faces = [];
  for (const r of ['J','Q','K']) {
    for (const s of ['clubs','diamonds','hearts','spades']) {
      faces.push(`${BASE}/card_body/family/${r}_${s}.webp`);
    }
  }
  return Promise.all(faces.map(url => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      if (img.decode) img.decode().then(resolve).catch(resolve);
      else resolve();
    };
    img.onerror = resolve;
    img.src = url;
  })));
}

export function preloadSuits() {
  const urls = [];
  for (const st of ['paper', 'barhat', 'gradient', 'ruby', 'golden']) {
    for (const s of ['clubs', 'diamonds', 'hearts', 'spades']) {
      urls.push(`${BASE}/card_body/suits/${st}/${s}.webp`);
    }
  }
  return Promise.all(urls.map(url => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      if (img.decode) img.decode().then(resolve).catch(resolve);
      else resolve();
    };
    img.onerror = resolve;
    img.src = url;
  })));
}

export function preloadDecorations() {
  return Promise.all(ASSETS.decorations.map(url => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      if (img.decode) img.decode().then(resolve).catch(resolve);
      else resolve();
    };
    img.onerror = resolve;
    img.src = url;
  })));
}

export function preloadJokers() {
  const urls = [
    ASSETS.foolToken, ASSETS.jokerFaceSmiling,
    ASSETS.jokerSuit,
    ASSETS.jokerWin, ASSETS.jokerLose, ASSETS.jokerDraw,
    ASSETS.jokerShop,
    ASSETS.jokerLies,
    ASSETS.jokerSetOk, ASSETS.jokerSetNice,
    ASSETS.jokerSetFive, ASSETS.jokerSetSad,
  ];
  return Promise.all(urls.map(url => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      if (img.decode) img.decode().then(resolve).catch(resolve);
      else resolve();
    };
    img.onerror = resolve;
    img.src = url;
  })));
}

export function preloadCoin() {
  return Promise.all(ASSETS.coinFrames.map(url => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      if (img.decode) img.decode().then(resolve).catch(resolve);
      else resolve();
    };
    img.onerror = resolve;
    img.src = url;
  })));
}

export function preloadFoolToken() {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      if (img.decode) img.decode().then(resolve).catch(resolve);
      else resolve();
    };
    img.onerror = resolve;
    img.src = ASSETS.foolToken;
  });
}

/** Получить клон инлайн-SVG для заданного url (или null, если не загрузилось) */
export function svgInstance(url) {
  const root = SVG_CACHE.get(url);
  return root ? root.cloneNode(true) : null;
}

// ---- Хелпер: прелоад одного URL ----
function preloadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      if (img.decode) img.decode().then(resolve).catch(resolve);
      else resolve();
    };
    img.onerror = resolve;
    img.src = url;
  });
}

function preloadUrls(urls) {
  return Promise.all(urls.filter(Boolean).map(preloadImage));
}

// ---- Фаза 1: только критичное для меню ----
export function preloadMenuAssets() {
  return preloadUrls([
    ASSETS.foolToken,
    ASSETS.jokerFaceSmiling,
  ]);
}

// ---- Фаза 2: всё критичное для матча ----
export function preloadGameAssets({ shirtStyle, suitStyle, decorStyle, hasToken }) {
  const urls = [
    // рубашка — только текущая
    ASSETS.shirts[shirtStyle ?? 0] || ASSETS.shirts[0],

    // лица J/Q/K — все 12 нужны в любом матче
    ...['J','Q','K'].flatMap(r =>
      ['clubs','diamonds','hearts','spades'].map(s =>
        `${BASE}/card_body/family/${r}_${s}.webp`
      )
    ),

    // масти — только текущий стиль
    ...(() => {
      const style = suitStyle || 'gradient';
      const ext = style === 'default' ? 'svg' : 'webp';
      return ['clubs','diamonds','hearts','spades'].map(s =>
        `${BASE}/card_body/suits/${style}/${s}.${ext}`
      );
    })(),

    // текущая декорация
    ASSETS.decorations[decorStyle ?? 0] || ASSETS.decorations[0],

    // джокеры, которые могут появиться в первом матче
    ASSETS.jokerSuit,
  ];

  // Монета — только если у игрока нет жетона (значит будет жеребьёвка)
  if (!hasToken) {
    urls.push(...ASSETS.coinFrames);
  }

  return preloadUrls(urls);
}

// ---- Фаза 3: остальное — всё, что может понадобиться в оверлеях ----
export function preloadDeepAssets({ shirtStyle, suitStyle, decorStyle, hasToken }) {
  const urls = [
    // все рубашки кроме текущей
    ...ASSETS.shirts.filter((_, i) => i !== (shirtStyle ?? 0)),

    // все масти кроме текущего стиля
    ...['paper','barhat','gradient','ruby','golden']
      .filter(st => st !== suitStyle)
      .flatMap(st => ['clubs','diamonds','hearts','spades'].map(s =>
        `${BASE}/card_body/suits/${st}/${s}.webp`
      )),

    // все декорации кроме текущей
    ...ASSETS.decorations.filter((_, i) => i !== (decorStyle ?? 0)),

    // остальные джокеры
    ASSETS.jokerWin, ASSETS.jokerLose, ASSETS.jokerDraw,
    ASSETS.jokerShop, ASSETS.jokerLies,
    ASSETS.jokerSetOk, ASSETS.jokerSetNice,
    ASSETS.jokerSetFive, ASSETS.jokerSetSad,
  ];

  // Монета — если не в фазе 2 (значит жетон есть)
  if (hasToken) {
    urls.push(...ASSETS.coinFrames);
  }

  return preloadUrls(urls);
}