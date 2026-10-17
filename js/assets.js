const BASE = 'assets';

export const ASSETS = {
  table:  `${BASE}/table_texture/default_table.svg`,
  shirt:  `${BASE}/card_shirt/default/card_shirt.svg`,
  body:   `${BASE}/card_body/body/default/card_body.svg`,
  shadow: `${BASE}/card_body/shadow/card_shadow.svg`,
  overlay: `${BASE}/card_overlay/deprecated_to_click.svg`,

  settingsIcon: `${BASE}/hud/settings_icon.svg`,
  
  shopIcons: {
    shirt:  `${BASE}/hud/icons/shirts.svg`,
    design: `${BASE}/hud/icons/styles.svg`,
    suits:  `${BASE}/hud/icons/suits.svg`,
    table:  `${BASE}/hud/icons/table.svg`,
    decor:  `${BASE}/hud/icons/decor.svg`,
  },
	pokerChip: `${BASE}/hud/icons/poker_chip.svg`,
  
  logoMain: `${BASE}/hud/logo_main.png`,
  
  mainMenuBg: `${BASE}/hud/main_menu_bg.png`,
  
	btnPodkidnoy:  `${BASE}/hud/buttons/straight_bttn.png`,
	btnPerevodnoy: `${BASE}/hud/buttons/transfer_bttn.png`,
  
    // Joker
  jokerWin:     `${BASE}/hud/joker/joker_wins.png`,
  jokerLose:    `${BASE}/hud/joker/joker_losing.png`,
  jokerDraw:    `${BASE}/hud/joker/joker_draw.png`,
  jokerShop:    `${BASE}/hud/joker/joker_trading.png`,
  jokerLies:    `${BASE}/hud/joker/joker_lies.png`,
  // Joker — эмоции
	jokerSetOk:   `${BASE}/hud/joker/joker_set_ok.png`,
	jokerSetNice: `${BASE}/hud/joker/joker_set_nice.png`,
	jokerSetFive: `${BASE}/hud/joker/joker_set_give_five.png`,
	jokerSetSad:  `${BASE}/hud/joker/joker_set_sad.png`,
	foolToken:    `${BASE}/hud/joker/fool_token.png`,
	jokerSuit:    `${BASE}/hud/joker/joker_suit.png`,
	pogon:        `${BASE}/hud/joker/pogon.png`,
	galstuk:      `${BASE}/hud/joker/galstuk.png`,
   coinFrames: [
    `${BASE}/hud/joker/coin_0.png`,
    `${BASE}/hud/joker/coin_1.png`,
    `${BASE}/hud/joker/coin_2.png`,
    `${BASE}/hud/joker/coin_3.png`,
    `${BASE}/hud/joker/coin_4.png`,
    `${BASE}/hud/joker/coin_5.png`,
    `${BASE}/hud/joker/coin_6.png`,
    `${BASE}/hud/joker/coin_7.png`,
  ],
  // Decorations
  decorations: [
    `${BASE}/decoration/frame.png`,
    `${BASE}/decoration/collage.png`,
    `${BASE}/decoration/parket.png`,
    `${BASE}/decoration/bricks.png`,
    `${BASE}/decoration/marble.png`,
    `${BASE}/decoration/wood.png`,
    `${BASE}/decoration/nebula.png`,
  ],

  // Shop previews — реальные файлы
shirts: [
  `${BASE}/card_shirt/default/card_shirt.svg`,
  `${BASE}/card_shirt/default/gray_shirt.svg`,
  `${BASE}/card_shirt/default/red_shirt.svg`,
  `${BASE}/card_shirt/default/yellow_shirt.svg`,
  
  `${BASE}/card_shirt/default/shirt_N1.svg`,
  `${BASE}/card_shirt/default/shirt_N2.svg`,
  `${BASE}/card_shirt/default/shirt_N3.svg`,
  `${BASE}/card_shirt/default/shirt_N4.svg`,
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

  ranks: {
    '2':  `${BASE}/card_body/ranks/default/2.svg`,
    '3':  `${BASE}/card_body/ranks/default/3.svg`,
    '4':  `${BASE}/card_body/ranks/default/4.svg`,
    '5':  `${BASE}/card_body/ranks/default/5.svg`,
    '6':  `${BASE}/card_body/ranks/default/6.svg`,
    '7':  `${BASE}/card_body/ranks/default/7.svg`,
    '8':  `${BASE}/card_body/ranks/default/8.svg`,
    '9':  `${BASE}/card_body/ranks/default/9.svg`,
    '10': `${BASE}/card_body/ranks/default/10.svg`,
    'J':  `${BASE}/card_body/ranks/default/J.svg`,
    'Q':  `${BASE}/card_body/ranks/default/Q.svg`,
    'K':  `${BASE}/card_body/ranks/default/K.svg`,
    'A':  `${BASE}/card_body/ranks/default/A.svg`,
  },

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
    ...ASSETS.shirts,
    ASSETS.body, ASSETS.shadow, ASSETS.overlay,
    ASSETS.settingsIcon,
    ...Object.values(ASSETS.ranks),
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

/** Получить клон инлайн-SVG для заданного url (или null, если не загрузилось) */
export function svgInstance(url) {
  const root = SVG_CACHE.get(url);
  return root ? root.cloneNode(true) : null;
}