export const CARD_W = 220;
export const CARD_H = 340;
export const CARD_RATIO = CARD_H / CARD_W; // ≈ 1.545

/** Базовый масштаб всех карт на сцене */
export const BASE_SCALE = 0.45;

/** Масштаб центральной масти (умножается на её натуральный размер) */
export const CENTER_SUIT_SCALE = 2.65;
/** Масштаб угловых элементов */
export const CORNER_RANK_SCALE = 3.85;   // ← подбираем
export const CORNER_SUIT_SCALE = 3.95;   // ← подбираем

/** Смещения для угловых элементов (от LT карты) — центр соответствующей картинки */
export const CORNER_RANK = { x: 29, y: 38 };
export const CORNER_SUIT = { x: 29, y: 85 };

/** Цвета ранга */
export const RANK_COLOR_RED   = '#d32f2f';
export const RANK_COLOR_BLACK = '#1a1a1a';

/** Реальные размеры карты на сцене (в пикселях базового 1×1 layout). */
export const REAL_W = CARD_W * BASE_SCALE;   // 99
export const REAL_H = CARD_H * BASE_SCALE;   // 153

/** Красные масти */
export const RED_SUITS = new Set(['hearts', 'diamonds']);

export function rankColor(suit) {
  return RED_SUITS.has(suit) ? RANK_COLOR_RED : RANK_COLOR_BLACK;
}

export const RANKS_36 = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANKS_52 = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Порядок мастей для сортировки: ♢ ♡ ♧ ♤ */
export const SUITS = ['diamonds', 'hearts', 'clubs', 'spades'];

export const RANK_VALUE = (() => {
  const map = {};
  RANKS_52.forEach((r, i) => map[r] = i + 2); // 2=2 ... A=14
  return map;
})();

export const SUIT_VALUE = (() => {
  const map = {};
  SUITS.forEach((s, i) => map[s] = i);
  return map;
})();