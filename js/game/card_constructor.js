/* card_constructor.js — Design-px. Карта 219×340.
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
  '0a': (0 + 51) / 2,
  '1':  35,
  '1a': 51,
  '2':  69,
  '3':  DESIGN.INNER_H / 2,
  '4':  DESIGN.INNER_H - 69,
  '4a': DESIGN.INNER_H - 51,
  '5':  DESIGN.INNER_H - 35,
  '5a': (DESIGN.INNER_H - 51 + DESIGN.INNER_H) / 2,
  '6':  DESIGN.INNER_H,
};

const PIP = {
  medium: { w: 39,  h: 41  },
  small:  { w: 25,  h: 26  },
  large:  { w: 137, h: 145 },
};

const CENTER_PIP = { w: 78, h: 82 };
const CENTER_RANK = { w: 74, h: 90 };

const _RANK_SUIT_RATIO = PIP.medium.w / PIP.medium.h;
const CENTER_RANK_SUIT = {
  w: CENTER_RANK.h * 0.85 * _RANK_SUIT_RATIO,
  h: CENTER_RANK.h * 0.85,
};
const CENTER_RANK_GAP = 6;

const FACE = {
  SRC_W: 305, SRC_H: 250,
  TARGET_H: 161,
  get TARGET_W() { return this.TARGET_H * this.SRC_W / this.SRC_H; },
  COURT_PIP_OFFSET_X: 9,
  COURT_PIP_ROW_RT: '0a',
  COURT_PIP_ROW_LB: '5a',
};

const RANKS  = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS  = ['hearts','diamonds','clubs','spades'];
const STYLES = [
  { id: 'grid',            label: 'Сетка' },
  { id: 'center',          label: 'Центр — масть' },
  { id: 'rank',            label: 'Центр — ранг+масть' },
  { id: 'rank-no-corners', label: 'Центр — ранг+масть (без углов)' },
];

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

const ROOT = 'assets/card_body';

const ASSETS = {
  shadow: `${ROOT}/shadow/card_shadow.svg`,
  body:   `${ROOT}/body/default/card_body.svg`,
  rank:   r => `${ROOT}/ranks/pixel/${r}.png`,
  suit:   (style, s) => {
    const st = SUIT_STYLES.find(x => x.id === style) ?? SUIT_STYLES[0];
    return `${ROOT}/suits/${st.id}/${s}.${st.ext}`;
  },
  face:   (r, s) => `${ROOT}/family/${r}_${s}.png`,
};

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

function buildCorner(rank, suit, suitStyle) {
  const corner = el('div', 'corner');
  corner.dataset.suit = suit;
  corner.appendChild(rankMask(ASSETS.rank(rank), 'corner__rank-img'));
  corner.appendChild(img(ASSETS.suit(suitStyle, suit), 'corner__suit-img'));
  return corner;
}

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

function renderGridStyle(grid, rank, suit, suitStyle) {
  const suitSrc = ASSETS.suit(suitStyle, suit);
  if (FACE_RANKS.has(rank)) {
    renderPortraits(grid, rank, suit);
    return;
  }
  if (rank === ACE_RANK) {
    const [x, y] = PIP_LAYOUTS['A'][0];
    placePip(grid, x, y, PIP.large, suitSrc);
    return;
  }
  const layout = PIP_LAYOUTS[rank];
  if (!layout) throw new Error(`Unknown rank: ${rank}`);
  for (const [x, y] of layout) placePip(grid, x, y, PIP.medium, suitSrc);
}

function renderCenterStyle(grid, rank, suit, suitStyle) {
  if (FACE_RANKS.has(rank)) {
    renderPortraits(grid, rank, suit);
    return;
  }
  const suitSrc = ASSETS.suit(suitStyle, suit);
  placePip(grid, COL.B, ROW['3'], CENTER_PIP, suitSrc);
}

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

  const rankBox = el('div', 'center-rank__rank', grid);
  rankBox.style.width  = u(rw);
  rankBox.style.height = u(rh);
  rankBox.style.left   = u(cx - rw / 2);
  rankBox.style.top    = u(topY);
  rankBox.appendChild(rankMask(rankSrc, 'center-rank__rank-img'));

  const suitBox = el('div', 'center-rank__suit', grid);
  suitBox.style.width  = u(sw);
  suitBox.style.height = u(sh);
  suitBox.style.left   = u(cx - sw / 2);
  suitBox.style.top    = u(topY + rh + gap);
  suitBox.appendChild(img(suitSrc, 'center-rank__suit-img'));
}

function renderCourtPips(card, suit, suitStyle) {
  const src  = ASSETS.suit(suitStyle, suit);
  const p    = PIP.medium;
  const offX = FACE.COURT_PIP_OFFSET_X;

  const gridTopY = (DESIGN.CARD_H - DESIGN.INNER_H) / 2;
  const yRT      = gridTopY + ROW[FACE.COURT_PIP_ROW_RT];
  const yLB      = gridTopY + ROW[FACE.COURT_PIP_ROW_LB];

  const layer = el('div', 'card__court-pips', card);

  placePip(layer, DESIGN.CARD_W - offX - p.w / 2, yRT, p, src, 0);
  placePip(layer, offX + p.w / 2, yLB, p, src, 180);
}

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

  if (FACE_RANKS.has(rank) && styleId === 'grid') {
    renderCourtPips(card, suit, suitStyle);
  }

  if (styleId !== 'rank-no-corners') {
    const lt = el('div', 'card__corner-layer card__corner-layer--lt', card);
    lt.appendChild(buildCorner(rank, suit, suitStyle));

    const rb = el('div', 'card__corner-layer card__corner-layer--rb', card);
    rb.appendChild(buildCorner(rank, suit, suitStyle));
  }

  return card;
}