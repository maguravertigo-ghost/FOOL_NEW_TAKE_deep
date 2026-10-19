export class ScreenFade {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'screen-fade';
    document.body.appendChild(this.el);
    this._t = null;
    this.instantBlack();
  }

  instantBlack() {
    this._stop();
    this.el.style.transition = 'none';
    this.el.style.opacity = '1';
    this.el.style.pointerEvents = 'auto';
  }

  instantClear() {
    this._stop();
    this.el.style.transition = 'none';
    this.el.style.opacity = '0';
    this.el.style.pointerEvents = 'none';
  }

  /** Плавно в чёрный (мягкий вход). */
  toBlack(duration = 400) {
    return new Promise(resolve => {
      this._stop();
      this.el.style.pointerEvents = 'auto';
      this.el.style.transition = `opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      void this.el.offsetWidth;   // reflow — чтобы transition гарантированно сработал
      this.el.style.opacity = '1';
      this._t = setTimeout(() => { this._t = null; resolve(); }, duration);
    });
  }

  /** Плавно в прозрачный (мягкий выход — то, что нужно для меню). */
  toClear(duration = 600) {
    return new Promise(resolve => {
      this._stop();
      this.el.style.pointerEvents = 'none';
      this.el.style.transition = `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;
      void this.el.offsetWidth;
      this.el.style.opacity = '0';
      this._t = setTimeout(() => { this._t = null; resolve(); }, duration);
    });
  }

  _stop() {
    if (this._t) { clearTimeout(this._t); this._t = null; }
  }
}