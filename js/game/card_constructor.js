/* card_constructor.js — Design-px. Карта 219×340. */

import { getLang } from '../i18n/index.js';

/* ===================== DESIGN CONSTANTS ===================== */
const DESIGN = {
  CARD_W: 219, CARD_H: 340,
  
  // Углы сдвинуты ближе к центру
  CORNER_X: 16, CORNER_Y: 14, 
  RANK_W: 33.09,  RANK_H: 44.14,
  SUIT_W: 26.11,  SUIT_H: 27.09,
  
  INNER_W: 128.75, INNER_H: 243.75,
};

const MID_X = 109.5; // Центр карты по X
const MID_Y = 169.9; // Центр карты по Y

// Точная сетка пипов (высчитано из SVG × 3.77586)
const G = {
  // Колонки (X центров)
  L: 66.6,   // Левая
  C: 109.5,  // Центральная
  R: 152.4,  // Правая
  // Ряды (Y центров)
  R1: 69.5,   // Верхний
  R2: 136.5,  // Второй
  R3: 203.4,  // Третий
  R4: 270.4,  // Нижний
  // Центральные элементы
  CM: 169.9, // Центр (3, 5, 6, 9)
  CT: 103.0, // Верх (10)
  CB: 236.9, // Низ (10)
  CET: 119.7, // Центр-верх (7, 8)
  CEB: 220.1  // Центр-низ (8)
};

const PIP = {
  medium: { w: 42.96, h: 42.96 },
  small:  { w: 24,  h: 24  },
  large:  { w: 92.25, h: 95.69 }, // Тузы
};

const HUGE_PIP = { w: 140, h: 140 };

// Центры (стили 'center' и 'rank')
const CENTER_PIP = { w: 92.25, h: 92.25 };
const CENTER_RANK = { w: 90, h: 110 };
const CENTER_RANK_GAP = 6;

const _RANK_SUIT_RATIO = PIP.medium.w / PIP.medium.h;
const CENTER_RANK_SUIT = {
  w: CENTER_RANK.h * 0.85 * _RANK_SUIT_RATIO,
  h: CENTER_RANK.h * 0.85,
};

// Портреты J/Q/K (из layer11)
const FACE = {
  SRC_W: 305, SRC_H: 250,
  TARGET_W: 194.93, // Точная ширина из SVG
  TARGET_H: 159.06, // Точная высота из SVG
  X: 12.03,
  Y_TOP: 10.85,
  Y_BOTTOM: 169.91,
};

const RANKS  = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS  = ['hearts','diamonds','clubs','spades'];
const STYLES = [
  { id: 'grid',            label: 'Атласные' },
  { id: 'center',          label: 'Центр — Масть' },
  { id: 'rank-no-corners', label: 'Мобильная (только масть)' },
];

const SUIT_STYLES = [
  { id: 'paper',    ext: 'webp' },
  { id: 'barhat',   ext: 'webp' },
  { id: 'gradient', ext: 'webp' },
  { id: 'ruby',     ext: 'webp' },
  { id: 'golden',   ext: 'webp' },
  { id: 'default',  ext: 'svg'  },
];

const RANK_COLORS = {
  default:  { red: '#d32f2f', black: '#1a1a1aff' },
  barhat:   { red: '#ff0007ff', black: '#34183cff' },
  gradient: { red: '#ae0b1efe', black: '#26122eff' },
  paper:    { red: '#ff0017ff', black: '#442a52ff' },
  ruby:     { red: '#ae0b1efe', black: '#291b29ff' },  // ← было #ff1018ff
  golden:   { red: '#ff0000ff', black: '#241c1cff' },
};


const FACE_RANKS = new Set(['J','Q','K']);
const ACE_RANK   = 'A';

const ROOT = 'assets/card_body';

const getRankLang = (styleId) => {
  const lang = (getLang() === 'ru') ? 'ru' : 'en';
  const folder = styleId.startsWith('wide') ? 'wide' : 'default';
  return `${folder}/${lang}`;
};

const ASSETS = {
  shadow: `${ROOT}/shadow/card_shadow.svg`,
  body:   `${ROOT}/body/default/card_body.svg`,
  rank:   r => {
    const base = `${ROOT}/ranks/default`;
    if (/^\d+$/.test(r)) return `${base}/base/${r}.svg`;
    return `${base}/${(getLang() === 'ru') ? 'ru' : 'en'}/${r}.svg`;
  },
  suit:   (style, s) => {
    const st = SUIT_STYLES.find(x => x.id === style) ?? SUIT_STYLES[0];
    return `${ROOT}/suits/${st.id}/${s}.${st.ext}`;
  },
  face:   (r, s) => `${ROOT}/family/${r}_${s}.webp`,
};

// ТОЧНЫЕ РАСКЛАДКИ ИЗ ТВОЕГО SVG
const PIP_LAYOUTS = {
  '2':  [[G.C, G.R1], [G.C, G.R4]],
  '3':  [[G.C, G.R1], [G.C, G.CM], [G.C, G.R4]],
  '4':  [[G.L, G.R1], [G.L, G.R4], [G.R, G.R1], [G.R, G.R4]],
  '5':  [[G.L, G.R1], [G.L, G.R4], [G.C, G.CM], [G.R, G.R1], [G.R, G.R4]],
  '6':  [[G.L, G.R1], [G.L, G.CM], [G.L, G.R4], [G.R, G.R1], [G.R, G.CM], [G.R, G.R4]],
  '7':  [[G.L, G.R1], [G.L, G.CM], [G.L, G.R4], [G.C, G.CET], [G.R, G.R1], [G.R, G.CM], [G.R, G.R4]],
  '8':  [[G.L, G.R1], [G.L, G.CM], [G.L, G.R4], [G.C, G.CET], [G.R, G.R1], [G.R, G.CM], [G.R, G.R4], [G.C, G.CEB]],
  '9':  [[G.L, G.R1], [G.L, G.R2], [G.L, G.R3], [G.L, G.R4], [G.C, G.CM], [G.R, G.R1], [G.R, G.R2], [G.R, G.R3], [G.R, G.R4]],
  '10': [[G.L, G.R1], [G.L, G.R2], [G.L, G.R3], [G.L, G.R4], [G.C, G.CT], [G.R, G.R1], [G.R, G.R2], [G.R, G.R3], [G.R, G.R4], [G.C, G.CB]],
  'A':  [[G.C, G.CM]],
};

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

function rankMask(src, cls) {
  const n = document.createElement('div');
  n.className = cls;
  n.style.setProperty('--src', `url("${src}")`);
  return n;
}

function buildCorner(rank, suit, suitStyle, styleId) {
  const corner = el('div', 'corner');
  corner.dataset.suit = suit;
  
  // Определяем папку для ранга
  const layout = styleId.startsWith('wide-') ? 'wide' : 'default';
  let langFolder;
  if (/^\d+$/.test(rank)) {
    langFolder = 'base'; // Для цифр 2-10
  } else {
    langFolder = (getLang() === 'ru') ? 'ru' : 'en'; // Для J,Q,K,A (и В,Д,К,Т)
  }
  
  const rankSrc = `${ROOT}/ranks/${layout}/${langFolder}/${rank}.svg`;
  corner.appendChild(rankMask(rankSrc, 'corner__rank-img'));
  corner.appendChild(img(ASSETS.suit(suitStyle, suit), 'corner__suit-img'));
  return corner;
}

function renderSinglePortrait(grid, rank, suit) {
  const src = ASSETS.face(rank, suit);
  const W = FACE.TARGET_W;
  const H = FACE.TARGET_H;

  const node = el('div', 'face face--single', grid);
  node.style.width  = u(W);
  node.style.height = u(H);
  // Центрируем ровно по середине карты
  node.style.left   = u(MID_X - W / 2);
  node.style.top    = u(MID_Y - H / 2);
  node.appendChild(img(src, 'face__img'));
}

function renderPortraits(grid, rank, suit) {
  const src = ASSETS.face(rank, suit);
  
  const top = el('div', 'face face--top', grid);
  top.style.width  = u(FACE.TARGET_W);
  top.style.height = u(FACE.TARGET_H);
  top.style.left   = u(FACE.X);
  top.style.top    = u(FACE.Y_TOP);
  top.appendChild(img(src, 'face__img'));

  const bot = el('div', 'face face--bottom', grid);
  bot.style.width  = u(FACE.TARGET_W);
  bot.style.height = u(FACE.TARGET_H);
  bot.style.left   = u(FACE.X);
  bot.style.top    = u(FACE.Y_BOTTOM);
  bot.appendChild(img(src, 'face__img'));
}

function renderCourtPips(card, suit, suitStyle) {
  const src  = ASSETS.suit(suitStyle, suit);
  const p    = PIP.medium;
  const layer = el('div', 'card__court-pips', card);

  // RT (Правый верхний)
  placePip(layer, 164.00 + p.w / 2, 48.04 + p.h / 2, p, src, 0);
  // LB (Левый нижний)
  placePip(layer, 12.03 + p.w / 2, 248.85 + p.h / 2, p, src, 180);
}

function renderGridStyle(grid, rank, suit, suitStyle) {
  const suitSrc = ASSETS.suit(suitStyle, suit);
  if (FACE_RANKS.has(rank)) {
    renderPortraits(grid, rank, suit);
    return;
  }
  if (rank === ACE_RANK) {
    placePip(grid, MID_X, MID_Y, PIP.large, suitSrc);
    return;
  }
	const layout = PIP_LAYOUTS[rank];
	if (!layout) throw new Error(`Unknown rank: ${rank}`);
	for (const [x, y] of layout) {
	  // Нижние пипы (ниже середины карты) переворачиваем на 180° —
	  // классическая типографика игральных карт.
	  const rot = y > MID_Y ? 180 : 0;
	  placePip(grid, x, y, PIP.medium, suitSrc, rot);
	}
}

// Стиль 2: Центр — Масть (с двумя портретами)
function renderCenterStyle(grid, rank, suit, suitStyle) {
  if (FACE_RANKS.has(rank)) {
    renderPortraits(grid, rank, suit); // Два портрета верх/низ
    return;
  }
  const suitSrc = ASSETS.suit(suitStyle, suit);
  placePip(grid, MID_X, MID_Y, CENTER_PIP, suitSrc);
}

function renderBigSuitStyle(grid, rank, suit, suitStyle) {
  // Для ВСЕХ карт (включая J/Q/K) — только одна огромная масть
  const suitSrc = ASSETS.suit(suitStyle, suit);
  placePip(grid, MID_X, MID_Y, HUGE_PIP, suitSrc);
}

// Стиль 4: Мобильная (только масть, без картинок)
function renderMobileNoFace(grid, rank, suit, suitStyle) {
  const suitSrc = ASSETS.suit(suitStyle, suit);
  placePip(grid, MID_X, MID_Y, HUGE_PIP, suitSrc);
}
/*
function renderRankStyle(grid, rank, suit, suitStyle) {
  const rankSrc = ASSETS.rank(rank);
  const suitSrc = ASSETS.suit(suitStyle, suit);

  const rw = CENTER_RANK.w;
  const rh = CENTER_RANK.h;
  const sw = CENTER_RANK_SUIT.w;
  const sh = CENTER_RANK_SUIT.h;
  const gap = CENTER_RANK_GAP;

  const totalH = rh + gap + sh;
  const topY = MID_Y - totalH / 2;

  const rankBox = el('div', 'center-rank__rank', grid);
  rankBox.style.width  = u(rw);
  rankBox.style.height = u(rh);
  rankBox.style.left   = u(MID_X - rw / 2);
  rankBox.style.top    = u(topY);
  rankBox.appendChild(rankMask(rankSrc, 'center-rank__rank-img'));

  const suitBox = el('div', 'center-rank__suit', grid);
  suitBox.style.width  = u(sw);
  suitBox.style.height = u(sh);
  suitBox.style.left   = u(MID_X - sw / 2);
  suitBox.style.top    = u(topY + rh + gap);
  suitBox.appendChild(img(suitSrc, 'center-rank__suit-img'));
}*/

function buildGridOverlay(grid) {
  const ov = el('div', 'grid-overlay', grid);
  el('div', 'grid-overlay__frame', ov);

  const cv = el('div', 'grid-overlay__cx', ov); cv.style.left = u(MID_X);
  const ch = el('div', 'grid-overlay__cy', ov); ch.style.top  = u(MID_Y);

  for (const x of [G.L, G.C, G.R]) {
    const line = el('div', 'grid-overlay__v', ov);
    line.style.left = u(x);
  }
  for (const y of [G.R1, G.R2, G.R3, G.R4]) {
    const line = el('div', 'grid-overlay__h', ov);
    line.style.top = u(y);
  }
}

export function buildCard(rank, suit, styleId = 'grid',
                          { showGrid = false, suitStyle = 'gradient' } = {}) {
  const card = el('div', 'card');
  if (showGrid) card.classList.add('card--show-grid');
  card.dataset.rank  = rank;
  card.dataset.suit  = suit;
  card.dataset.style = styleId;

  const col = RANK_COLORS[suitStyle] || RANK_COLORS.default;
  const isRed = (suit === 'hearts' || suit === 'diamonds');
  card.style.setProperty('--rank-color', isRed ? col.red : col.black);

  card.appendChild(img(ASSETS.shadow, 'card__shadow'));
  card.appendChild(img(ASSETS.body,   'card__body'));

  const grid = el('div', 'card__grid', card);

  const isWide = styleId.startsWith('wide-');
  const baseStyle = isWide ? styleId.replace('wide-', '') : styleId;

  // Настраиваем размеры углов в зависимости от шрифта (узкий/широкий)
  if (isWide) {
    // ---- Wide (стили 4, 5, 6) ----
    card.style.setProperty('--cx', '12');
    card.style.setProperty('--cy', '12.8');
    card.style.setProperty('--rw', '38');
    card.style.setProperty('--rh', '44.14');
    card.style.setProperty('--sx', '15');
    card.style.setProperty('--sy', '55');
    card.style.setProperty('--sw', '26.11');
    card.style.setProperty('--sh', '27.09');
    
    // Стиль 6: wide + mobile — увеличенные углы
    if (baseStyle === 'rank-no-corners') {
      card.style.setProperty('--rw', '40');
      card.style.setProperty('--rh', '48');
      // sx = cx + (rw - sw)/2 = 12 + (40 - 30)/2 = 17
      card.style.setProperty('--sx', '15');
      card.style.setProperty('--sy', '61');        // 10.8 + 48 + ~2
      card.style.setProperty('--sw', '30');        // было 27
      card.style.setProperty('--sh', '31');        // было 28
    }
  } else {
    // ---- Узкий (стили 1, 2, 3) ----
    card.style.setProperty('--cx', '12');
    card.style.setProperty('--cy', '12.8');
    card.style.setProperty('--rw', '33.09');
    card.style.setProperty('--rh', '44.14');
    card.style.setProperty('--sx', '13.49');   // было 15.49
    card.style.setProperty('--sy', '57');
    card.style.setProperty('--sw', '26.11');
    card.style.setProperty('--sh', '27.09');
    
    // Стиль 3: узкий + mobile — увеличенные углы
    if (baseStyle === 'rank-no-corners') {
      card.style.setProperty('--sx', '14.55');   // было 13.55 — сдвиг на 2 вправо
      card.style.setProperty('--sw', '30');
      card.style.setProperty('--sh', '31');
    }
  }

  switch (baseStyle) {
    case 'grid':            renderGridStyle(grid, rank, suit, suitStyle); break;
    case 'center':          renderCenterStyle(grid, rank, suit, suitStyle); break;
    case 'rank-no-corners': renderBigSuitStyle(grid, rank, suit, suitStyle); break;
    default: throw new Error(`Unknown style: ${styleId}`);
  }

  buildGridOverlay(grid);

  if (FACE_RANKS.has(rank) && baseStyle === 'grid') {
    renderCourtPips(card, suit, suitStyle);
  }

  const rankFolder = isWide ? 'wide' : 'default';
  const lt = el('div', 'card__corner-layer card__corner-layer--lt', card);
  lt.appendChild(buildCorner(rank, suit, suitStyle, styleId)); // <-- styleId вместо rankFolder
  
  const rb = el('div', 'card__corner-layer card__corner-layer--rb', card);
  rb.appendChild(buildCorner(rank, suit, suitStyle, styleId)); // <-- styleId вместо rankFolder

  return card;
}