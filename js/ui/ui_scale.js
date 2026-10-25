/**
 * Единая система масштаба интерфейса.
 * Сцена — фиксированная пропорция 1366×768, вписывается в окно.
 * Поля появляются либо по бокам, либо сверху/снизу.
 */
const REF_W = 1366;
const REF_H = 768;
const REF_AR = REF_W / REF_H;

export class UIScale {
  constructor() {
    this.scale = 1;
    this.isMobile = false;
    this.baseCardScale = 0.515;
    this.cardW = Math.round(220 * this.baseCardScale);
    this.cardH = Math.round(340 * this.baseCardScale);

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
  const vw = Math.max(window.innerWidth, 320);
  const vh = Math.max(window.innerHeight, 240);

  // Мобилка — ландшафт с короткой стороной < 500 px.
  //   iPhone 12 landscape:  844 × 390 → min = 390 → mobile
  //   iPhone 12 portrait:   390 × 844 → vw < vh → не mobile (аспект не тот)
  //   Desktop 1366×768:     min = 768 → не mobile
  const shortSide = Math.min(vw, vh);
  const isLandscape = vw > vh;
  // Считаем мобильным любой тач-девайс в ландшафте, либо экран с короткой стороной < 900px
const isTouch = window.matchMedia("(pointer: coarse)").matches;
// Возвращаем нормальный порог для телефонов. 
// Планшеты (isTouch) тоже остаются мобильными.
this.isMobile = isLandscape && (shortSide < 500 || isTouch);

  document.body.classList.toggle('is-mobile', this.isMobile);

  this.baseCardScale = this.isMobile ? 0.72 : 0.515;

  let sceneW, sceneH;
  if (vw / vh > REF_AR) {
    sceneH = vh;
    sceneW = vh * REF_AR;
  } else {
    sceneW = vw;
    sceneH = vw / REF_AR;
  }

  const sceneEl = document.getElementById('scene');
  if (sceneEl) {
    sceneEl.style.width  = sceneW + 'px';
    sceneEl.style.height = sceneH + 'px';
  }

  const s = sceneW / REF_W;
  this.scale = s;
  this.cardW = Math.round(220 * this.baseCardScale * s);
  this.cardH = Math.round(340 * this.baseCardScale * s);

  const root = document.documentElement;
  root.style.setProperty('--ui',      String(s));
  root.style.setProperty('--scene-w', sceneW + 'px');
  root.style.setProperty('--scene-h', sceneH + 'px');
}

  onChange(fn) {
    this._handlers.add(fn);
    fn(this);
    return () => this._handlers.delete(fn);
  }
}

export const uiScale = new UIScale();
