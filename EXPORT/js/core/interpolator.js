import { audio } from '../audio/audio_engine.js';

export const MoveType = Object.freeze({
  LINEAR: 'LINEAR',
  ARK:    'ARK',
  FLIP:   'FLIP',
});

/* ============================================================
 * Скорости и границы длительности
 * ============================================================ */

/** Сколько длин диагонали сцены карта проходит за 1 секунду.
 *  Больше → быстрее. 1.6 = вся диагональ за ~0.63s. */
export const SPEED_DIAG_PER_SEC = 1.6;

/** Угловая скорость при вращении карты (градусы в секунду). */
export const ANG_SPEED_DEG_PER_SEC = 540;

/** Границы, чтобы короткие/длинные переходы не выглядели дёргано. */
export const MIN_DURATION_MS = 220;
export const MAX_DURATION_MS = 1400;

/** Длительность анимации переворота (не зависит от дистанции — это
 *  визуальный эффект, а не перелёт). */
export const FLIP_DURATION_MS = 400;

/* --- ARK: медленнее чем LINEAR --- */
/** Множитель скорости ARK относительно базовой (0.5 = вдвое медленнее). */
export const ARK_SPEED_MULT = 0.25;

/** Границы длительности ARK (обычно длиннее LINEAR). */
export const ARK_MIN_DURATION_MS = 500;
export const ARK_MAX_DURATION_MS = 2500;

/* ============================================================
 * Менеджер анимаций
 * ============================================================ */

export class Interpolator {
  constructor() {
    /** @type {Array<{elapsed:number,duration:number,update:(k:number)=>void,onDone?:()=>void}>} */
    this.moves = [];
    this._rafId = null;
    this._lastT = 0;
    this._tick = this._tick.bind(this);
	this._paused = false;
	
  /** Необязательный колбэк: вызывается каждый кадр, пока есть движения.
   *  Удобно для дебаг-оверлея — он не будет крутить rAF сам по себе. */
  this.onTick = null;
  }

  add(move) {
    this.moves.push(move);
    if (this._rafId == null) {
      this._lastT = performance.now();
      this._rafId = requestAnimationFrame(this._tick);
    }
    return move;
  }

  cancelAll() { this.moves.length = 0; }
  
    pause() {
    this._paused = true;
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  resume() {
    if (!this._paused) return;
    this._paused = false;
    if (this.moves.length > 0 && this._rafId == null) {
      this._lastT = performance.now();
      this._rafId = requestAnimationFrame(this._tick);
    }
  }

  _tick(t) {
	if (this._paused) { this._rafId = null; return; }
    const dt = Math.min(64, t - this._lastT); // защита от длинных пауз
    this._lastT = t;

    for (let i = this.moves.length - 1; i >= 0; i--) {
      const m = this.moves[i];
      m.elapsed += dt;
      const k = m.duration > 0 ? Math.min(1, m.elapsed / m.duration) : 1;
      m.update(k);
      if (k >= 1) {
        this.moves.splice(i, 1);
        if (typeof m.onDone === 'function') m.onDone();
      }
    }

    if (this.moves.length) {
      this._rafId = requestAnimationFrame(this._tick);
    } else {
      this._rafId = null;
    }
	
	if (typeof this.onTick === 'function') this.onTick();
  }
}

/* ============================================================
 * Easing
 * ============================================================ */

/** По ТЗ: koeff * koeff — медленный старт, ускорение. */
export const easeInQuad  = (k) => k * k;

/** Быстрый старт, плавное торможение — «скольжение по столу». */
export const easeOutQuad = (k) => 1 - (1 - k) * (1 - k);

/** Симметричная S-кривая, мягкая. */
export const easeInOutQuad = (k) =>
  k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

/** Симметричная S-кривая, выраженнее. Центр — резкий, концы — плавные. */
export const easeInOutCubic = (k) =>
  k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

/* ============================================================
 * Расчёт длительности
 * ============================================================ */

/**
 * duration = max( time_to_move , time_to_rotate ), зажатый в [MIN, MAX].
 *
 * time_to_move   = (dist_px / speed_px_per_sec) × 1000
 * speed_px_per_sec = SPEED_DIAG_PER_SEC × диagonal_сцены
 *
 * time_to_rotate = (|Δangle| / ANG_SPEED_DEG_PER_SEC) × 1000
 */
export function computeDuration(scene, ax, ay, bx, by, aAngle, bAngle) {
  const dist = Math.hypot(bx - ax, by - ay);
  const diag = Math.hypot(scene.width, scene.height) || 1;
  const speed = SPEED_DIAG_PER_SEC * diag;                 // px / sec

  const tMove = (dist / speed) * 1000;                     // ms
  const dAng  = Math.abs(bAngle - aAngle);
  const tRot  = (dAng / ANG_SPEED_DEG_PER_SEC) * 1000;     // ms

  const t = Math.max(tMove, tRot);
  
  return Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, t));
}

/* ============================================================
 * Движения
 * ============================================================ */

/**
 * LINEAR: карта едет от маркера A к маркеру B.
 * Если opts.duration не задан — считается от расстояния и поворота.
 * По завершении карта привязывается к маркеру B.
 */
export function moveLinear(interp, card, scene, fromMarker, toMarker, opts = {}) {
  const a = scene.resolve(fromMarker);
  const b = scene.resolve(toMarker);

  const aAngle = opts.fromAngle ?? card.angle;
  const bAngle = opts.toAngle   ?? card.angle;

  const duration =
    opts.duration ??
    computeDuration(scene, a.x, a.y, b.x, b.y, aAngle, bAngle);

  const easing = opts.easing ?? easeOutQuad;

  // на время движения отвязываем от маркера
  card.marker = null;

  if (typeof opts.onStart === 'function') {
    opts.onStart({ duration, distance: Math.hypot(b.x - a.x, b.y - a.y) });
  }

  // на время движения отвязываем от маркера
  card.marker = null;

  const t0 = performance.now();

  if (typeof opts.onStart === 'function') {
    opts.onStart({ duration, distance: Math.hypot(b.x - a.x, b.y - a.y) });
  }

  return interp.add({
    elapsed: 0,
    duration,
    update: (k) => {
      const e = easing(k);
      card.setPosition(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e);
      card.setAngle(aAngle + (bAngle - aAngle) * e);
    },
    onDone: () => {
      card.marker = toMarker;
      card.setPosition(b.x, b.y);
      card.setAngle(bAngle);

      const actualMs = performance.now() - t0;
      if (typeof opts.onDone === 'function') {
        opts.onDone({
          plannedMs: duration,
          actualMs,
          distance: Math.hypot(b.x - a.x, b.y - a.y),
          from: fromMarker.name,
          to:   toMarker.name,
        });
      }
    }
  });
}
/**
 * FLIP: переворачивает карту — рубашка ↔ лицо.
 *
 * Тайминг: scaleX идёт 1 → 0 → 1, easing задаёт распределение скорости:
 *  • easeInOutCubic (по умолчанию) — медленные концы, быстрый центр;
 *  • easeInOutQuad               — то же, но мягче;
 *  • easeInQuad                  — только ускорение (без замедления в конце);
 *  • easeOutQuad                 — только замедление (без разгона в начале).
 *
 * На «ребре» (e ≥ 0.5) подменяем видимую сторону карты.
 * Позиция и маркер не трогаются — можно комбинировать с LINEAR.
 */
export function moveFlip(interp, card, opts = {}) {
  // защита от повторного клика по уже переворачивающейся карте
  if (card._flipping) return null;

  const toFaceUp = opts.toFaceUp ?? !card.faceUp;
  if (card.faceUp === toFaceUp) return null;      // уже в целевом состоянии

  const duration = opts.duration ?? FLIP_DURATION_MS;
  const easing   = opts.easing   ?? easeInOutCubic;

  card._flipping = true;
  const t0 = performance.now();
  let swapped = false;

  if (typeof opts.onStart === 'function') {
    opts.onStart({ duration, toFaceUp });
  }

  return interp.add({
    elapsed: 0,
    duration,
    update: (k) => {
      const e = easing(k);
      const s = Math.abs(1 - 2 * e);   // 1 → 0 → 1
      card.setScaleX(s);

      // подмена стороны на «ребре»
      if (!swapped && e >= 0.5) {
		  audio.playSfx('card_flip');
        card.setFaceUp(toFaceUp);
        swapped = true;
      }
    },
    onDone: () => {
      // гарантия конечного состояния (на случай погрешностей кэша)
      card.setScaleX(1);
      card.setFaceUp(toFaceUp);
      card._flipping = false;

      const actualMs = performance.now() - t0;
      if (typeof opts.onDone === 'function') {
        opts.onDone({ plannedMs: duration, actualMs, toFaceUp });
      }
    }
  });
}
/**
 * ARK + FLIP: движение по полуокружности над прямой A → B
 * с одновременным переворотом карты.
 *
 *  • вершина дуги и «ребро» карты совпадают (оба на e = 0.5);
 *  • easing по умолчанию — easeInOutCubic (S-кривая, медленные концы,
 *    быстрый центр) — именно это даёт «медленно взяли → щёлк → уложили»;
 *  • scaleX = |1 − 2e|, подмена лица/рубашки ровно на e = 0.5;
 *  • угол карты НЕ меняется (по ТЗ);
 *  • длительность от длины дуги (πR) / ARK_SPEED.
 */
export function moveArkFlip(interp, card, scene, fromMarker, toMarker, opts = {}) {
  const a = scene.resolve(fromMarker);
  const b = scene.resolve(toMarker);

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);

  // Граничный случай: A ≈ B — просто фиксируемся в B (с переворотом, если надо)
  if (dist < 0.5) {
    const toFaceUp0 = opts.toFaceUp ?? !card.faceUp;
    card.marker = toMarker;
    card.setPosition(b.x, b.y);
    if (card.faceUp !== toFaceUp0) card.setFaceUp(toFaceUp0);
    if (typeof opts.onDone === 'function') {
      opts.onDone({ plannedMs: 0, actualMs: 0, distance: 0, arcLen: 0, radius: 0,
                    from: fromMarker.name, to: toMarker.name, toFaceUp: toFaceUp0 });
    }
    return null;
  }

  // --- геометрия ---
  const ux = dx / dist, uy = dy / dist;       // A→B
  const px = uy,        py = -ux;             // перпендикуляр (вверх при движении вправо)
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const R  = dist / 2;

  // --- длительность: от дуги, медленнее LINEAR ---
  const arcLen  = Math.PI * R;
  const diag    = Math.hypot(scene.width, scene.height) || 1;
  const speed   = SPEED_DIAG_PER_SEC * ARK_SPEED_MULT * diag; // px / sec
  const planned = Math.max(
    ARK_MIN_DURATION_MS,
    Math.min(ARK_MAX_DURATION_MS, (arcLen / speed) * 1000)
  );
  const duration = opts.duration ?? planned;

  // --- easing: обязательно один и тот же для дуги и для flip ---
  const easing = opts.easing ?? easeInOutCubic;

  // --- куда переворачиваем ---
  const toFaceUp = opts.toFaceUp ?? !card.faceUp;
  const doFlip   = card.faceUp !== toFaceUp;

  card.marker = null;
  const t0 = performance.now();
  const angle0 = card.angle;
  let swapped = false;

  if (typeof opts.onStart === 'function') {
    opts.onStart({ duration, distance: dist, arcLen, radius: R, toFaceUp, doFlip });
  }

  return interp.add({
    elapsed: 0,
    duration,
    update: (k) => {
      const e = easing(k);

      // --- позиция по дуге ---
      const theta = e * Math.PI;
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const x = mx + R * (px * s - ux * c);
      const y = my + R * (py * s - uy * c);

      card.setPosition(x, y);
      card.setAngle(angle0);   // угол не трогаем

      // --- flip ---
      if (doFlip) {
        const sx = Math.abs(1 - 2 * e);   // 1 → 0 (на e=0.5) → 1
        card.setScaleX(sx);
        if (!swapped && e >= 0.5) {
          card.setFaceUp(toFaceUp);
          swapped = true;
        }
      }
    },
    onDone: () => {
      card.marker = toMarker;
      card.setPosition(b.x, b.y);
      card.setAngle(angle0);

      if (doFlip) {
        card.setScaleX(1);
        card.setFaceUp(toFaceUp);
      }

      const actualMs = performance.now() - t0;
      if (typeof opts.onDone === 'function') {
        opts.onDone({
          plannedMs: duration,
          actualMs,
          distance: dist,
          arcLen,
          radius: R,
          toFaceUp,
          doFlip,
          from: fromMarker.name,
          to:   toMarker.name,
        });
      }
    }
  });
}