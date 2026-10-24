/* card_constructor.js — Design-px. Карта 219×340.
   1 unit = --card-w / 219, все размеры в calc(N * var(--u)).
   Публичный API: buildCard(rank, suit, styleId, opts).
   Кеш/прогрев — в card_cache.js, чтобы не было циклов. */

import {
  getCardTemplate,
  warmUpDeck,
  clearCache,
  cacheSize,
} from './card_cache.js';

/* ===================== DESIGN CONSTANTS ===================== */
const DESIGN = {
  CARD_W: 219, CARD_H: 340,
  CORNER_X: 6, CORNER_Y: 9,
  RANK_W: 38,  RANK_H: 44,
  SUIT_W: 38,  SUIT_H: 30,
  INNER_W: 89, INNER_H: 203,
};

const COL = { A: 0, B: DESIGN.INNER_W / 2, C: DESIGN.INNER_W };

const ROW = {
  '0':  0,
  '0a': (0 + 51) / 2,               // 25.5 — только для мастей J/Q/K (RT)
  '1':  35,
  '1a': 51,
  '2':  69,
  '3':  DESIGN.INNER_H / 2,
  '4':  DESIGN.INNER_H - 69,
  '4a': DESIGN.INNER_H - 51,
  '5':  DESIGN.INNER_H - 35,
  '5a': (DESIGN.INNER_H - 51 + DESIGN.INNER_H) / 2,  // 177.5 — только для LB
  '6':  DESIGN.INNER_H,
};

const PIP = {
  medium: { w: 39,  h: 41  },
  small:  { w: 25,  h: 26  },
  large:  { w: 137, h: 145 },
};

/* ===================== ЦЕНТРАЛЬНЫЕ СХЕМЫ ===================== */

/* Стиль 'center': одна масть по центру — x2 от PIP.medium */
const CENTER_PIP = { w: 78, h: 82 };

/* Стиль 'rank': ранг — x2 от углового (37×45 → 74×90),
   масть под ним, высота масти = 0.85 от высоты ранга,
   ширина — по пропорции PIP.medium (39/41)                    */
const CENTER_RANK = { w: 74, h: 90 };

const _RANK_SUIT_RATIO = PIP.medium.w / PIP.medium.h;   // ≈0.9512
const CENTER_RANK_SUIT = {
  w: CENTER_RANK.h * 0.85 * _RANK_SUIT_RATIO,           // ≈72.77
  h: CENTER_RANK.h * 0.85,                              // 76.5
};
const CENTER_RANK_GAP = 6;

const FACE = {
  SRC_W: 305, SRC_H: 250,
  TARGET_H: 161,
  get TARGET_W() { return this.TARGET_H * this.SRC_W / this.SRC_H; },
  /* отступ мастей J/Q/K от левого/правого края карты */
  COURT_PIP_OFFSET_X: 9,
  /* вертикальные якоря мастей J/Q/K — по строкам сетки */
  COURT_PIP_ROW_RT: '0a',   // между 0 и 1a
  COURT_PIP_ROW_LB: '5a',   // между 4a и 6
};

/* ===================== LISTS ===================== */
const RANKS  = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS  = ['hearts','diamonds','clubs','spades'];
const STYLES = [
  { id: 'grid',            label: 'Сетка' },
  { id: 'center',          label: 'Центр — масть' },
  { id: 'rank',            label: 'Центр — ранг+масть' },
  { id: 'rank-no-corners', label: 'Центр — ранг+масть (без углов)' },
];

/* стили мастей: в default — .svg, в остальных — .png */
const SUIT_STYLES = [
  { id: 'paper',    ext: 'png' },
  { id: 'barhat',   ext: 'png' },
  { id: 'gradient', ext: 'png' },
  { id: 'ruby',     ext: 'png' },
  { id: 'golden',   ext: 'png' },
  { id: 'default',  ext: 'svg' },
];

const FACE_RANKS = new Set(['J','Q','K']);
const ACE_RANK   = 'A';

/* ===================== ASSETS ===================== */
const ROOT = 'assets/card_body';

const ASSETS = {
  shadow: `${ROOT}/shadow/card_shadow.svg`,
  body:   `${ROOT}/body/default/card_body.svg`,
  rank:   r => `${ROOT}/ranks/pixel/${r}.png`,
  /* стиль масти влияет только на этот путь */
  suit:   (style, s) => {
    const st = SUIT_STYLES.find(x => x.id === style) ?? SUIT_STYLES[0];
    return `${ROOT}/suits/${st.id}/${s}.${st.ext}`;
  },
  face:   (r, s) => `${ROOT}/family/${r}_${s}.png`,
};

/* ===================== PIP LAYOUTS ===================== */
const { A, B, C } = COL;
const { '0': R0, '1': R1, '1a': R1a, '2': R2, '3': R3,
        '4': R4, '4a': R4a, '5': R5, '6': R6 } = ROW;

const PIP_LAYOUTS = {
  '2':  [[B,R0], [B,R6]],
  '3':  [[B,R0], [B,R3], [B,R6]],
  '4':  [[A,R0], [A,R6], [C,R0], [C,R6]],
  '5':  [[A,R0], [A,R6], [B,R3], [C,R0], [C,R6]],
  '6':  [[A,R0], [A,R3], [A,R6], [C,R0], [C,R3], [C,R6]],
  '7':  [[A,R0], [A,R3], [A,R6], [B,R1a], [C,R0], [C,R3], [C,R6]],
  '8':  [[A,R0], [A,R3], [A,R6], [B,R1a], [C,R0], [C,R3], [C,R6], [B,R4a]],
  '9':  [[A,R0], [A,R2], [A,R4], [A,R6], [B,R3], [C,R0], [C,R2], [C,R4], [C,R6]],
  '10': [[A,R0], [A,R2], [A,R4], [A,R6], [B,R1], [C,R0], [C,R2], [C,R4], [C,R6], [B,R5]],
  'A':  [[B,R3]],
};

/* ===================== DOM HELPERS ===================== */
function el(tag, cls, parent) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (parent) parent.appendChild(n);
  return n;
}
function img(src, cls) {
  const i = new Image();
  if (cls) i.className = cls;
  i.src = src; i.alt = ''; i.draggable = false; i.decoding = 'async';
  i.addEventListener('error', () => console.warn('[card] not loaded:', src));
  return i;
}
const u = n => `calc(${n} * var(--u))`;

/* ===================== PRIMITIVES ===================== */
function placePip(grid, cx, cy, size, src, rotate = 0) {
  const node = el('div', 'pip', grid);
  node.style.width  = u(size.w);
  node.style.height = u(size.h);
  node.style.left   = u(cx - size.w / 2);
  node.style.top    = u(cy - size.h / 2);
  if (rotate) node.style.transform = `rotate(${rotate}deg)`;
  node.appendChild(img(src, 'pip__img'));
  return node;
}

/* ранг через mask-image: PNG используется как форма,
   цвет задаётся CSS-переменной --rank-color,
   которая зависит от масти (красная / чёрная).              */
function rankMask(src, cls) {
  const n = document.createElement('div');
  n.className = cls;
  n.style.setProperty('--src', `url("${src}")`);
  return n;
}

function buildCorner(rank, suit, suitStyle) {
  const corner = el('div', 'corner');
  corner.dataset.suit = suit;
  corner.appendChild(rankMask(ASSETS.rank(rank), 'corner__rank-img'));
  corner.appendChild(img(ASSETS.suit(suitStyle, suit), 'corner__suit-img'));
  return corner;
}

/* Портреты J / Q / K — общие для стилей 'grid' и 'center' */
function renderPortraits(grid, rank, suit) {
  const src = ASSETS.face(rank, suit);
  const W = FACE.TARGET_W;
  const H = FACE.TARGET_H;
  const cx = COL.B;
  const cy = ROW['3'];

  const top = el('div', 'face face--top', grid);
  top.style.width  = u(W);
  top.style.height = u(H);
  top.style.left   = u(cx - W / 2);
  top.style.top    = u(cy - H);
  top.appendChild(img(src, 'face__img'));

  const bot = el('div', 'face face--bottom', grid);
  bot.style.width  = u(W);
  bot.style.height = u(H);
  bot.style.left   = u(cx - W / 2);
  bot.style.top    = u(cy);
  bot.appendChild(img(src, 'face__img'));
}

/* ===================== CENTRE (style: grid) ===================== */
function renderGridStyle(grid, rank, suit, suitStyle) {
  const suitSrc = ASSETS.suit(suitStyle, suit);

  /* J / Q / K — только портреты.
     Масти RT/LB рисуются отдельно на слое карты (см. renderCourtPips). */
  if (FACE_RANKS.has(rank)) {
    renderPortraits(grid, rank, suit);
    return;
  }

  /* A */
  if (rank === ACE_RANK) {
    const [x, y] = PIP_LAYOUTS['A'][0];
    placePip(grid, x, y, PIP.large, suitSrc);
    return;
  }

  /* 2..10 */
  const layout = PIP_LAYOUTS[rank];
  if (!layout) throw new Error(`Unknown rank: ${rank}`);
  for (const [x, y] of layout) placePip(grid, x, y, PIP.medium, suitSrc);
}

/* ===================== STYLE: center =====================
   Углы как обычно, в центре одна масть (x2 от PIP.medium).
   Для J/Q/K — портреты, как в стиле 'grid'.
   ========================================================= */
function renderCenterStyle(grid, rank, suit, suitStyle) {
  if (FACE_RANKS.has(rank)) {
    renderPortraits(grid, rank, suit);
    return;
  }
  const suitSrc = ASSETS.suit(suitStyle, suit);
  placePip(grid, COL.B, ROW['3'], CENTER_PIP, suitSrc);
}

/* ===================== STYLE: rank =====================
   Углы + в центре группа «ранг над мастью», выровнена по центру.
   Ранг — x2 от углового, масть — 0.85 от высоты ранга.
   ========================================================= */
function renderRankStyle(grid, rank, suit, suitStyle) {
  const rankSrc = ASSETS.rank(rank);
  const suitSrc = ASSETS.suit(suitStyle, suit);

  const rw = CENTER_RANK.w;
  const rh = CENTER_RANK.h;
  const sw = CENTER_RANK_SUIT.w;
  const sh = CENTER_RANK_SUIT.h;
  const gap = CENTER_RANK_GAP;

  const totalH = rh + gap + sh;
  const cx = COL.B;
  const topY = ROW['3'] - totalH / 2;

  /* ранг — маска, цвет по масти (как в углах) */
  const rankBox = el('div', 'center-rank__rank', grid);
  rankBox.style.width  = u(rw);
  rankBox.style.height = u(rh);
  rankBox.style.left   = u(cx - rw / 2);
  rankBox.style.top    = u(topY);
  rankBox.appendChild(rankMask(rankSrc, 'center-rank__rank-img'));

  /* масть — сразу под рангом */
  const suitBox = el('div', 'center-rank__suit', grid);
  suitBox.style.width  = u(sw);
  suitBox.style.height = u(sh);
  suitBox.style.left   = u(cx - sw / 2);
  suitBox.style.top    = u(topY + rh + gap);
  suitBox.appendChild(img(suitSrc, 'center-rank__suit-img'));
}

/* ===================== COURT PIPS (J/Q/K) =====================
   Две масти по антидиагонали карты:
     • RT — правый-верхний угол карты, отступ (6, 9), поворот 0°
     • LB — левый-нижний угол карты,  отступ (6, 9), поворот 180°
   Размер — PIP.medium (как у числовых карт).
   Позиции считаются в design-px от краёв карты 219×340.
   ============================================================= */
function renderCourtPips(card, suit, suitStyle) {
  const src  = ASSETS.suit(suitStyle, suit);
  const p    = PIP.medium;
  const offX = FACE.COURT_PIP_OFFSET_X;              // 9

  /* Y берём из строк сетки и переводим в систему карты */
  const gridTopY = (DESIGN.CARD_H - DESIGN.INNER_H) / 2;   // 68.5
  const yRT      = gridTopY + ROW[FACE.COURT_PIP_ROW_RT];  // 68.5 + 25.5  = 94
  const yLB      = gridTopY + ROW[FACE.COURT_PIP_ROW_LB];  // 68.5 + 177.5 = 246

  const layer = el('div', 'card__court-pips', card);

  /* RT — у правого края карты, центр по Y на строке '0a', поворот 0° */
  placePip(
    layer,
    DESIGN.CARD_W - offX - p.w / 2,
    yRT,
    p, src, 0
  );

  /* LB — у левого края карты, центр по Y на строке '5a', поворот 180° */
  placePip(
    layer,
    offX + p.w / 2,
    yLB,
    p, src, 180
  );
}

/* ===================== GRID OVERLAY ===================== */
function buildGridOverlay(grid) {
  const ov = el('div', 'grid-overlay', grid);
  el('div', 'grid-overlay__frame', ov);

  const cv = el('div', 'grid-overlay__cx', ov); cv.style.left = u(COL.B);
  const ch = el('div', 'grid-overlay__cy', ov); ch.style.top  = u(ROW['3']);

  for (const x of [COL.A, COL.B, COL.C]) {
    const line = el('div', 'grid-overlay__v', ov);
    line.style.left = u(x);
  }
  for (const key of ['0','1','1a','2','3','4','4a','5','6']) {
    const line = el('div', 'grid-overlay__h', ov);
    line.style.top = u(ROW[key]);
  }
}

/* ===================== PUBLIC ===================== */
export function buildCard(rank, suit, styleId = 'grid',
                          { showGrid = false, suitStyle = 'gradient' } = {}) {
  const card = el('div', 'card');
  if (showGrid) card.classList.add('card--show-grid');
  card.dataset.rank  = rank;
  card.dataset.suit  = suit;
  card.dataset.style = styleId;

  card.appendChild(img(ASSETS.shadow, 'card__shadow'));
  card.appendChild(img(ASSETS.body,   'card__body'));

  const grid = el('div', 'card__grid', card);

  switch (styleId) {
    case 'grid':
      renderGridStyle(grid, rank, suit, suitStyle);
      break;
    case 'center':
      renderCenterStyle(grid, rank, suit, suitStyle);
      break;
    case 'rank':
    case 'rank-no-corners':
      renderRankStyle(grid, rank, suit, suitStyle);
      break;
    default:
      throw new Error(`Unknown style: ${styleId}`);
  }

  buildGridOverlay(grid);

  /* масти J/Q/K на слое карты — только в стиле 'grid' */
  if (FACE_RANKS.has(rank) && styleId === 'grid') {
    renderCourtPips(card, suit, suitStyle);
  }

  /* углы — во всех стилях, кроме 'rank-no-corners' */
  if (styleId !== 'rank-no-corners') {
    const lt = el('div', 'card__corner-layer card__corner-layer--lt', card);
    lt.appendChild(buildCorner(rank, suit, suitStyle));

    const rb = el('div', 'card__corner-layer card__corner-layer--rb', card);
    rb.appendChild(buildCorner(rank, suit, suitStyle));
  }

  return card;
}

/* ===================== UI ===================== */
function fillSelect(select, items, { value, label } = {}) {
  select.innerHTML = '';
  for (const it of items) {
    const opt = document.createElement('option');
    opt.value = value ? value(it) : it;
    opt.textContent = label ? label(it) : it;
    select.appendChild(opt);
  }
}

/* базовый размер карты в design-px */
const CARD_BASE_W = 219;

let __inited = false;

function init() {
  if (__inited) return;
  __inited = true;

  const $ = id => document.getElementById(id);
  const host         = $('cardHost');
  const selScale     = $('selScale');
  const selRank      = $('selRank');
  const selSuit      = $('selSuit');
  const selStyle     = $('selStyle');
  const selSuitStyle = $('selSuitStyle');
  const chkGrid      = $('chkGrid');

  const missing = Object.entries({
    cardHost: host, selScale, selRank, selSuit,
    selStyle, selSuitStyle, chkGrid,
  }).filter(([, v]) => !v).map(([k]) => k);

  if (missing.length) {
    console.error('[card] не найдены элементы:', missing);
    return;
  }

  fillSelect(selRank, RANKS);
  fillSelect(selSuit, SUITS);
  fillSelect(selStyle, STYLES, { value: s => s.id, label: s => s.label });

  selScale.value     = '100';
  selRank.value      = 'A';
  selSuit.value      = 'hearts';
  selStyle.value     = 'grid';
  selSuitStyle.value = 'gradient';

  /* ---- масштаб: пишем --card-w на :root ---- */
  function applyScale() {
    const pct = Number(selScale.value) || 100;
    const w   = CARD_BASE_W * pct / 100;
    document.documentElement.style.setProperty('--card-w', w + 'px');
  }

  let currentCard = null;

  function render() {
    /* шаблон берём из кеша; в DOM вставляем клон —
       это позволяет не пересобирать карту с нуля при каждом переключении */
    const tpl = getCardTemplate(
      selRank.value,
      selSuit.value,
      selStyle.value,
      selSuitStyle.value,
    );
    currentCard = tpl.cloneNode(true);
    currentCard.classList.toggle('card--show-grid', chkGrid.checked);
    host.replaceChildren(currentCard);
  }

  /* сетка — без пересборки карты */
  chkGrid.addEventListener('change', () => {
    currentCard?.classList.toggle('card--show-grid', chkGrid.checked);
  });

  /* масштаб — без пересборки карты */
  selScale.addEventListener('change', applyScale);

  selRank .addEventListener('change', render);
  selSuit .addEventListener('change', render);

  /* смена стиля карты или стиля мастей → кеш теряет актуальность.
     Чистим и прогреваем заново, чтобы в дальнейшем всё летало. */
  function onStyleChange() {
    clearCache();
    warmUpDeck(selStyle.value, selSuitStyle.value);
    render();
    console.log('[card] cache rebuilt, size =', cacheSize());
  }
  selStyle    .addEventListener('change', onStyleChange);
  selSuitStyle.addEventListener('change', onStyleChange);

  applyScale();

  /* при первом старте прогреваем всю колоду — пользователь
     не увидит «первого моргания» при смене карт */
  warmUpDeck(selStyle.value, selSuitStyle.value);
  console.log('[card] warm-up done, cache size =', cacheSize());

  render();
}

// в самом низу файла
if (document.getElementById('cardHost')) {
  init();
}/* card_constructor.js — Design-px. Карта 219×340.
   1 unit = --card-w / 219, все размеры в calc(N * var(--u)).
   Публичный API: buildCard(rank, suit, styleId, opts).
   Кеш/прогрев — в card_cache.js, чтобы не было циклов. */


/* ===================== DESIGN CONSTANTS ===================== */
const DESIGN = {
  CARD_W: 219, CARD_H: 340,
  CORNER_X: 6, CORNER_Y: 9,
  RANK_W: 38,  RANK_H: 44,
  SUIT_W: 38,  SUIT_H: 30,
  INNER_W: 89, INNER_H: 203,
};

const COL = { A: 0, B: DESIGN.INNER_W / 2, C: DESIGN.INNER_W };

const ROW = {
  '0':  0,
  '0a': (0 + 51) / 2,               // 25.5 — только для мастей J/Q/K (RT)
  '1':  35,
  '1a': 51,
  '2':  69,
  '3':  DESIGN.INNER_H / 2,
  '4':  DESIGN.INNER_H - 69,
  '4a': DESIGN.INNER_H - 51,
  '5':  DESIGN.INNER_H - 35,
  '5a': (DESIGN.INNER_H - 51 + DESIGN.INNER_H) / 2,  // 177.5 — только для LB
  '6':  DESIGN.INNER_H,
};

const PIP = {
  medium: { w: 39,  h: 41  },
  small:  { w: 25,  h: 26  },
  large:  { w: 137, h: 145 },
};

/* ===================== ЦЕНТРАЛЬНЫЕ СХЕМЫ ===================== */

/* Стиль 'center': одна масть по центру — x2 от PIP.medium */
const CENTER_PIP = { w: 78, h: 82 };

/* Стиль 'rank': ранг — x2 от углового (37×45 → 74×90),
   масть под ним, высота масти = 0.85 от высоты ранга,
   ширина — по пропорции PIP.medium (39/41)                    */
const CENTER_RANK = { w: 74, h: 90 };

const _RANK_SUIT_RATIO = PIP.medium.w / PIP.medium.h;   // ≈0.9512
const CENTER_RANK_SUIT = {
  w: CENTER_RANK.h * 0.85 * _RANK_SUIT_RATIO,           // ≈72.77
  h: CENTER_RANK.h * 0.85,                              // 76.5
};
const CENTER_RANK_GAP = 6;

const FACE = {
  SRC_W: 305, SRC_H: 250,
  TARGET_H: 161,
  get TARGET_W() { return this.TARGET_H * this.SRC_W / this.SRC_H; },
  /* отступ мастей J/Q/K от левого/правого края карты */
  COURT_PIP_OFFSET_X: 9,
  /* вертикальные якоря мастей J/Q/K — по строкам сетки */
  COURT_PIP_ROW_RT: '0a',   // между 0 и 1a
  COURT_PIP_ROW_LB: '5a',   // между 4a и 6
};

/* ===================== LISTS ===================== */
const RANKS  = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS  = ['hearts','diamonds','clubs','spades'];
const STYLES = [
  { id: 'grid',            label: 'Сетка' },
  { id: 'center',          label: 'Центр — масть' },
  { id: 'rank',            label: 'Центр — ранг+масть' },
  { id: 'rank-no-corners', label: 'Центр — ранг+масть (без углов)' },
];

/* стили мастей: в default — .svg, в остальных — .png */
const SUIT_STYLES = [
  { id: 'paper',    ext: 'png' },
  { id: 'barhat',   ext: 'png' },
  { id: 'gradient', ext: 'png' },
  { id: 'ruby',     ext: 'png' },
  { id: 'golden',   ext: 'png' },
  { id: 'default',  ext: 'svg' },
];

const FACE_RANKS = new Set(['J','Q','K']);
const ACE_RANK   = 'A';

/* ===================== ASSETS ===================== */
const ROOT = 'assets/card_body';

const ASSETS = {
  shadow: `${ROOT}/shadow/card_shadow.svg`,
  body:   `${ROOT}/body/default/card_body.svg`,
  rank:   r => `${ROOT}/ranks/pixel/${r}.png`,
  /* стиль масти влияет только на этот путь */
  suit:   (style, s) => {
    const st = SUIT_STYLES.find(x => x.id === style) ?? SUIT_STYLES[0];
    return `${ROOT}/suits/${st.id}/${s}.${st.ext}`;
  },
  face:   (r, s) => `${ROOT}/family/${r}_${s}.png`,
};

/* ===================== PIP LAYOUTS ===================== */
const { A, B, C } = COL;
const { '0': R0, '1': R1, '1a': R1a, '2': R2, '3': R3,
        '4': R4, '4a': R4a, '5': R5, '6': R6 } = ROW;

const PIP_LAYOUTS = {
  '2':  [[B,R0], [B,R6]],
  '3':  [[B,R0], [B,R3], [B,R6]],
  '4':  [[A,R0], [A,R6], [C,R0], [C,R6]],
  '5':  [[A,R0], [A,R6], [B,R3], [C,R0], [C,R6]],
  '6':  [[A,R0], [A,R3], [A,R6], [C,R0], [C,R3], [C,R6]],
  '7':  [[A,R0], [A,R3], [A,R6], [B,R1a], [C,R0], [C,R3], [C,R6]],
  '8':  [[A,R0], [A,R3], [A,R6], [B,R1a], [C,R0], [C,R3], [C,R6], [B,R4a]],
  '9':  [[A,R0], [A,R2], [A,R4], [A,R6], [B,R3], [C,R0], [C,R2], [C,R4], [C,R6]],
  '10': [[A,R0], [A,R2], [A,R4], [A,R6], [B,R1], [C,R0], [C,R2], [C,R4], [C,R6], [B,R5]],
  'A':  [[B,R3]],
};

/* ===================== DOM HELPERS ===================== */
function el(tag, cls, parent) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (parent) parent.appendChild(n);
  return n;
}
function img(src, cls) {
  const i = new Image();
  if (cls) i.className = cls;
  i.src = src; i.alt = ''; i.draggable = false; i.decoding = 'async';
  i.addEventListener('error', () => console.warn('[card] not loaded:', src));
  return i;
}
const u = n => `calc(${n} * var(--u))`;

/* ===================== PRIMITIVES ===================== */
function placePip(grid, cx, cy, size, src, rotate = 0) {
  const node = el('div', 'pip', grid);
  node.style.width  = u(size.w);
  node.style.height = u(size.h);
  node.style.left   = u(cx - size.w / 2);
  node.style.top    = u(cy - size.h / 2);
  if (rotate) node.style.transform = `rotate(${rotate}deg)`;
  node.appendChild(img(src, 'pip__img'));
  return node;
}

/* ранг через mask-image: PNG используется как форма,
   цвет задаётся CSS-переменной --rank-color,
   которая зависит от масти (красная / чёрная).              */
function rankMask(src, cls) {
  const n = document.createElement('div');
  n.className = cls;
  n.style.setProperty('--src', `url("${src}")`);
  return n;
}

function buildCorner(rank, suit, suitStyle) {
  const corner = el('div', 'corner');
  corner.dataset.suit = suit;
  corner.appendChild(rankMask(ASSETS.rank(rank), 'corner__rank-img'));
  corner.appendChild(img(ASSETS.suit(suitStyle, suit), 'corner__suit-img'));
  return corner;
}

/* Портреты J / Q / K — общие для стилей 'grid' и 'center' */
function renderPortraits(grid, rank, suit) {
  const src = ASSETS.face(rank, suit);
  const W = FACE.TARGET_W;
  const H = FACE.TARGET_H;
  const cx = COL.B;
  const cy = ROW['3'];

  const top = el('div', 'face face--top', grid);
  top.style.width  = u(W);
  top.style.height = u(H);
  top.style.left   = u(cx - W / 2);
  top.style.top    = u(cy - H);
  top.appendChild(img(src, 'face__img'));

  const bot = el('div', 'face face--bottom', grid);
  bot.style.width  = u(W);
  bot.style.height = u(H);
  bot.style.left   = u(cx - W / 2);
  bot.style.top    = u(cy);
  bot.appendChild(img(src, 'face__img'));
}

/* ===================== CENTRE (style: grid) ===================== */
function renderGridStyle(grid, rank, suit, suitStyle) {
  const suitSrc = ASSETS.suit(suitStyle, suit);

  /* J / Q / K — только портреты.
     Масти RT/LB рисуются отдельно на слое карты (см. renderCourtPips). */
  if (FACE_RANKS.has(rank)) {
    renderPortraits(grid, rank, suit);
    return;
  }

  /* A */
  if (rank === ACE_RANK) {
    const [x, y] = PIP_LAYOUTS['A'][0];
    placePip(grid, x, y, PIP.large, suitSrc);
    return;
  }

  /* 2..10 */
  const layout = PIP_LAYOUTS[rank];
  if (!layout) throw new Error(`Unknown rank: ${rank}`);
  for (const [x, y] of layout) placePip(grid, x, y, PIP.medium, suitSrc);
}

/* ===================== STYLE: center =====================
   Углы как обычно, в центре одна масть (x2 от PIP.medium).
   Для J/Q/K — портреты, как в стиле 'grid'.
   ========================================================= */
function renderCenterStyle(grid, rank, suit, suitStyle) {
  if (FACE_RANKS.has(rank)) {
    renderPortraits(grid, rank, suit);
    return;
  }
  const suitSrc = ASSETS.suit(suitStyle, suit);
  placePip(grid, COL.B, ROW['3'], CENTER_PIP, suitSrc);
}

/* ===================== STYLE: rank =====================
   Углы + в центре группа «ранг над мастью», выровнена по центру.
   Ранг — x2 от углового, масть — 0.85 от высоты ранга.
   ========================================================= */
function renderRankStyle(grid, rank, suit, suitStyle) {
  const rankSrc = ASSETS.rank(rank);
  const suitSrc = ASSETS.suit(suitStyle, suit);

  const rw = CENTER_RANK.w;
  const rh = CENTER_RANK.h;
  const sw = CENTER_RANK_SUIT.w;
  const sh = CENTER_RANK_SUIT.h;
  const gap = CENTER_RANK_GAP;

  const totalH = rh + gap + sh;
  const cx = COL.B;
  const topY = ROW['3'] - totalH / 2;

  /* ранг — маска, цвет по масти (как в углах) */
  const rankBox = el('div', 'center-rank__rank', grid);
  rankBox.style.width  = u(rw);
  rankBox.style.height = u(rh);
  rankBox.style.left   = u(cx - rw / 2);
  rankBox.style.top    = u(topY);
  rankBox.appendChild(rankMask(rankSrc, 'center-rank__rank-img'));

  /* масть — сразу под рангом */
  const suitBox = el('div', 'center-rank__suit', grid);
  suitBox.style.width  = u(sw);
  suitBox.style.height = u(sh);
  suitBox.style.left   = u(cx - sw / 2);
  suitBox.style.top    = u(topY + rh + gap);
  suitBox.appendChild(img(suitSrc, 'center-rank__suit-img'));
}

/* ===================== COURT PIPS (J/Q/K) =====================
   Две масти по антидиагонали карты:
     • RT — правый-верхний угол карты, отступ (6, 9), поворот 0°
     • LB — левый-нижний угол карты,  отступ (6, 9), поворот 180°
   Размер — PIP.medium (как у числовых карт).
   Позиции считаются в design-px от краёв карты 219×340.
   ============================================================= */
function renderCourtPips(card, suit, suitStyle) {
  const src  = ASSETS.suit(suitStyle, suit);
  const p    = PIP.medium;
  const offX = FACE.COURT_PIP_OFFSET_X;              // 9

  /* Y берём из строк сетки и переводим в систему карты */
  const gridTopY = (DESIGN.CARD_H - DESIGN.INNER_H) / 2;   // 68.5
  const yRT      = gridTopY + ROW[FACE.COURT_PIP_ROW_RT];  // 68.5 + 25.5  = 94
  const yLB      = gridTopY + ROW[FACE.COURT_PIP_ROW_LB];  // 68.5 + 177.5 = 246

  const layer = el('div', 'card__court-pips', card);

  /* RT — у правого края карты, центр по Y на строке '0a', поворот 0° */
  placePip(
    layer,
    DESIGN.CARD_W - offX - p.w / 2,
    yRT,
    p, src, 0
  );

  /* LB — у левого края карты, центр по Y на строке '5a', поворот 180° */
  placePip(
    layer,
    offX + p.w / 2,
    yLB,
    p, src, 180
  );
}

/* ===================== GRID OVERLAY ===================== */
function buildGridOverlay(grid) {
  const ov = el('div', 'grid-overlay', grid);
  el('div', 'grid-overlay__frame', ov);

  const cv = el('div', 'grid-overlay__cx', ov); cv.style.left = u(COL.B);
  const ch = el('div', 'grid-overlay__cy', ov); ch.style.top  = u(ROW['3']);

  for (const x of [COL.A, COL.B, COL.C]) {
    const line = el('div', 'grid-overlay__v', ov);
    line.style.left = u(x);
  }
  for (const key of ['0','1','1a','2','3','4','4a','5','6']) {
    const line = el('div', 'grid-overlay__h', ov);
    line.style.top = u(ROW[key]);
  }
}

/* ===================== PUBLIC ===================== */
export function buildCard(rank, suit, styleId = 'grid',
                          { showGrid = false, suitStyle = 'gradient' } = {}) {
  const card = el('div', 'card');
  if (showGrid) card.classList.add('card--show-grid');
  card.dataset.rank  = rank;
  card.dataset.suit  = suit;
  card.dataset.style = styleId;

  card.appendChild(img(ASSETS.shadow, 'card__shadow'));
  card.appendChild(img(ASSETS.body,   'card__body'));

  const grid = el('div', 'card__grid', card);

  switch (styleId) {
    case 'grid':
      renderGridStyle(grid, rank, suit, suitStyle);
      break;
    case 'center':
      renderCenterStyle(grid, rank, suit, suitStyle);
      break;
    case 'rank':
    case 'rank-no-corners':
      renderRankStyle(grid, rank, suit, suitStyle);
      break;
    default:
      throw new Error(`Unknown style: ${styleId}`);
  }

  buildGridOverlay(grid);

  /* масти J/Q/K на слое карты — только в стиле 'grid' */
  if (FACE_RANKS.has(rank) && styleId === 'grid') {
    renderCourtPips(card, suit, suitStyle);
  }

  /* углы — во всех стилях, кроме 'rank-no-corners' */
  if (styleId !== 'rank-no-corners') {
    const lt = el('div', 'card__corner-layer card__corner-layer--lt', card);
    lt.appendChild(buildCorner(rank, suit, suitStyle));

    const rb = el('div', 'card__corner-layer card__corner-layer--rb', card);
    rb.appendChild(buildCorner(rank, suit, suitStyle));
  }

  return card;
}

/* ===================== UI ===================== */
function fillSelect(select, items, { value, label } = {}) {
  select.innerHTML = '';
  for (const it of items) {
    const opt = document.createElement('option');
    opt.value = value ? value(it) : it;
    opt.textContent = label ? label(it) : it;
    select.appendChild(opt);
  }
}

/* базовый размер карты в design-px */
const CARD_BASE_W = 219;

let __inited = false;

function init() {
  if (__inited) return;
  __inited = true;

  const $ = id => document.getElementById(id);
  const host         = $('cardHost');
  const selScale     = $('selScale');
  const selRank      = $('selRank');
  const selSuit      = $('selSuit');
  const selStyle     = $('selStyle');
  const selSuitStyle = $('selSuitStyle');
  const chkGrid      = $('chkGrid');

  const missing = Object.entries({
    cardHost: host, selScale, selRank, selSuit,
    selStyle, selSuitStyle, chkGrid,
  }).filter(([, v]) => !v).map(([k]) => k);

  if (missing.length) {
    console.error('[card] не найдены элементы:', missing);
    return;
  }

  fillSelect(selRank, RANKS);
  fillSelect(selSuit, SUITS);
  fillSelect(selStyle, STYLES, { value: s => s.id, label: s => s.label });

  selScale.value     = '100';
  selRank.value      = 'A';
  selSuit.value      = 'hearts';
  selStyle.value     = 'grid';
  selSuitStyle.value = 'gradient';

  /* ---- масштаб: пишем --card-w на :root ---- */
  function applyScale() {
    const pct = Number(selScale.value) || 100;
    const w   = CARD_BASE_W * pct / 100;
    document.documentElement.style.setProperty('--card-w', w + 'px');
  }

  let currentCard = null;

  function render() {
    /* шаблон берём из кеша; в DOM вставляем клон —
       это позволяет не пересобирать карту с нуля при каждом переключении */
    const tpl = getCardTemplate(
      selRank.value,
      selSuit.value,
      selStyle.value,
      selSuitStyle.value,
    );
    currentCard = tpl.cloneNode(true);
    currentCard.classList.toggle('card--show-grid', chkGrid.checked);
    host.replaceChildren(currentCard);
  }

  /* сетка — без пересборки карты */
  chkGrid.addEventListener('change', () => {
    currentCard?.classList.toggle('card--show-grid', chkGrid.checked);
  });

  /* масштаб — без пересборки карты */
  selScale.addEventListener('change', applyScale);

  selRank .addEventListener('change', render);
  selSuit .addEventListener('change', render);

  /* смена стиля карты или стиля мастей → кеш теряет актуальность.
     Чистим и прогреваем заново, чтобы в дальнейшем всё летало. */
  function onStyleChange() {
    clearCache();
    warmUpDeck(selStyle.value, selSuitStyle.value);
    render();
    console.log('[card] cache rebuilt, size =', cacheSize());
  }
  selStyle    .addEventListener('change', onStyleChange);
  selSuitStyle.addEventListener('change', onStyleChange);

  applyScale();

  /* при первом старте прогреваем всю колоду — пользователь
     не увидит «первого моргания» при смене карт */
  warmUpDeck(selStyle.value, selSuitStyle.value);
  console.log('[card] warm-up done, cache size =', cacheSize());

  render();
}

// в самом низу файла
if (document.getElementById('cardHost')) {
  init();
}