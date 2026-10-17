/**
 * Сцена — хранилище текущих размеров вьюпорта и шины resize-событий.
 * Всё, что «привязано к маркеру», подписывается на onResize и пересчитывает координаты.
 */
export class Scene {
  constructor(rootEl) {
    this.root = rootEl;
    this.width = 0;
    this.height = 0;
    this._handlers = new Set();
    this._pending = false;

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._onResize);
    }
    // первичный замер
    this._measure();
  }

  _measure() {
    const r = this.root.getBoundingClientRect();
    this.width  = Math.max(1, r.width);
    this.height = Math.max(1, r.height);
  }

  _onResize() {
    // throttle через rAF
    if (this._pending) return;
    this._pending = true;
    requestAnimationFrame(() => {
      this._pending = false;
      this._measure();
      for (const h of this._handlers) h(this);
    });
  }

  onResize(fn) {
    this._handlers.add(fn);
    // сразу вызовем, чтобы клиент получил актуальные размеры
    fn(this);
    return () => this._handlers.delete(fn);
  }

  /** Преобразование маркера в пиксели сцены */
  resolve(marker) {
    return {
      x: marker.x * this.width,
      y: marker.y * this.height,
    };
  }
}