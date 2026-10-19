/**
 * Единая система масштаба интерфейса.
 * База — 1366×768 (разрешение, на котором интерфейс выглядит "эталонно").
 * Все размеры карт и смещения в layout умножаются на UIScale.scale.
 */
const BASE_W = 1366;
const BASE_H = 768;

/** Мягкие границы масштаба, чтобы не ломать вёрстку на крайних разрешениях. */
const SCALE_MIN = 0.55;
const SCALE_MAX = 2.20;

export class UIScale {
  constructor() {
    /** Текущий масштаб (1.0 = базовое 1366×768) */
    this.scale = 1;

    /** Реальные размеры карты в пикселях — читать отсюда */
    this.cardW = 220 * 0.45;    // = 99
    this.cardH = 340 * 0.45;    // = 153

    /** Базовый масштаб карты до применения UIScale */
    this.baseCardScale = 0.45;

    this._handlers = new Set();
    this._pending = false;
    this._onResize = this._onResize.bind(this);

    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._onResize);
      window.visualViewport.addEventListener('scroll', this._onResize);
    }

    this._recalculate();
  }

  _onResize() {
    if (this._pending) return;
    this._pending = true;
    requestAnimationFrame(() => {
      this._pending = false;
      this._recalculate();
      for (const h of this._handlers) h(this);
    });
  }

  _recalculate() {
    // Берём текущий размер окна. На мобильных visualViewport меньше,
    // если открыта клавиатура — но у нас клавиатуры нет, берём max.
    const vw = Math.max(
      window.innerWidth || 0,
      window.visualViewport ? window.visualViewport.width : 0,
      320
    );
    const vh = Math.max(
      window.innerHeight || 0,
      window.visualViewport ? window.visualViewport.height : 0,
      240
    );

    // Считаем масштаб по "виртуальному" квадрату: экран 1366×768 → scale 1.0
    const kx = vw / BASE_W;
    const ky = vh / BASE_H;
    // min — чтобы не растянуть по широкому, но низкому экрану
    let s = Math.min(kx, ky);

    s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, s));
    this.scale = s;

    this.cardW = Math.round(220 * this.baseCardScale * s);
    this.cardH = Math.round(340 * this.baseCardScale * s);
  }

  /** Подписка на изменения (для тех, кому нужно пересчитать вручную). */
  onChange(fn) {
    this._handlers.add(fn);
    fn(this);
    return () => this._handlers.delete(fn);
  }
}

export const uiScale = new UIScale();