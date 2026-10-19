/* HUD-разметка.
   Все числа — в референсных пикселях от 1366×768.
   На мобилке (uiScale.isMobile) включаются отдельные размеры
   и раскладка — крупнее кнопки, компактнее лого. */

import { uiScale } from './ui_scale.js';

const REF_W = 1366;
const REF_H = 768;
const LOGO_ASPECT = 792 / 539;
const BTN_ASPECT  = 398 / 97;

export class HudLayout {
  constructor(sceneEl) {
    this.el = sceneEl;
    this.W = 0; this.H = 0;
    this.isMobile = false;
    this.update();
  }

  update() {
    const r = this.el.getBoundingClientRect();
    this.W = r.width;
    this.H = r.height;
    this.isMobile = !!(uiScale && uiScale.isMobile);

    const scaleX = this.W / REF_W;
    const scaleY = this.H / REF_H;
    this.scale = Math.min(scaleX, scaleY);

    const layoutW = REF_W * this.scale;
    const layoutH = REF_H * this.scale;
    this.offsetX = (this.W - layoutW) / 2;
    this.offsetY = (this.H - layoutH) / 2;
  }

  /** Преобразование референсных пикселей в координаты сцены. */
  px(v) { return this.offsetX + v * this.scale; }
  py(v) { return this.offsetY + v * this.scale; }
  s(v)  { return v * this.scale; }

  /* ================= Rects ================= */

  /** Лого — на мобилке выше нижняя граница, чтобы освободить место кнопкам. */
  rectLogo() {
    if (this.isMobile) {
      const top = this.py(22);

      const authorTop = this.py(722);
      const btnH = this.s(95);
      const btnGap = this.s(20);
      const btn1Top = authorTop - btnGap - btnH;
      const btn0Top = btn1Top - btnGap - btnH;
      const bottom = btn0Top - btnGap;

      const segH = bottom - top;
      const cx = this.px(683);
      const maxW = this.px(1050) - this.px(316);

      let w = segH * LOGO_ASPECT;
      let h = segH;
      if (w > maxW) {
        w = maxW;
        h = w / LOGO_ASPECT;
      }

      return {
        left: cx - w / 2,
        top: top + (segH - h) / 2,
        width: w, height: h,
        cx, cy: (top + bottom) / 2,
      };
    }

    const top    = this.py(33);
    const bottom = this.py(424);
    const segH   = bottom - top;
    const cx     = this.px(683);
    const maxW = this.px(1006) - this.px(360);

    let w = segH * LOGO_ASPECT;
    let h = segH;
    if (w > maxW) {
      w = maxW;
      h = w / LOGO_ASPECT;
    }

    return {
      left: cx - w / 2,
      top: top + (segH - h) / 2,
      width: w, height: h,
      cx, cy: (top + bottom) / 2,
    };
  }

  rectBtn0() {
    if (this.isMobile) {
      const h = this.s(95);
      const w = Math.round(h * (398 / 97));
      return { left: this.px(683) - w / 2, top: this.py(492), width: w, height: h };
    }
    const w = this.s(398);
    const h = this.s(97);
    return { left: this.px(683) - w / 2, top: this.py(466), width: w, height: h };
  }

  rectBtn1() {
    if (this.isMobile) {
      const h = this.s(95);
      const w = Math.round(h * (398 / 97));
      return { left: this.px(683) - w / 2, top: this.py(607), width: w, height: h };
    }
    const w = this.s(398);
    const h = this.s(97);
    return { left: this.px(683) - w / 2, top: this.py(580), width: w, height: h };
  }

  rectAuthor() {
    if (this.isMobile) {
      return {
        top:    this.py(722),
        bottom: this.py(746),
        height: this.s(24),
      };
    }
    return {
      top:    this.py(714),
      bottom: this.py(738),
      height: this.s(24),
    };
  }

  _topBlockH() { return this.s(180); }

  rectStats() {
    if (this.isMobile) {
      const left  = this.px(22);
      const right = this.px(300);
      const top   = this.py(22);
      const h     = this._topBlockH() * 0.85;
      return { left, top, width: right - left, height: h };
    }
    const left  = this.px(22);
    const right = this.px(282);
    const top   = this.py(22);
    const h     = this._topBlockH();
    return { left, top, width: right - left, height: h };
  }

  rectStylePoints() {
    if (this.isMobile) {
      const left  = this.px(1084);
      const right = this.px(1344);
      const top   = this.py(22);
      const h     = this._topBlockH() * 0.45;
      return { left, top, width: right - left, height: h };
    }
    const left  = this.px(1084);
    const right = this.px(1344);
    const top   = this.py(22);
    const h     = this._topBlockH() * 0.5;
    return { left, top, width: right - left, height: h };
  }

  /** Кнопка «КАК ИГРАТЬ» — под блоком очков стиля, по правому краю. */
  rectHelpButton() {
    const sp = this.rectStylePoints();
    const gap = this.s(this.isMobile ? 10 : 16);
    const h   = this.s(this.isMobile ? 50 : 64);
    const w   = this.s(200);
    return {
      left:   sp.left + sp.width - w,
      top:    sp.top + sp.height + gap,
      width:  w,
      height: h,
    };
  }

  rectLeftButtons(count = 2) {
    return this._sideButtons(count, true);
  }

  rectRightButtons(count = 3) {
    return this._sideButtons(count, false);
  }

  /** Боковые кнопки — лесенкой снизу вверх. */
  _sideButtons(count, fromLeft) {
    // === Мобилка: крупнее, меньше градация размеров ===
    if (this.isMobile) {
      const w0 = 300;   // ref-px (≈152 px на экране при 844×390)
      const h0 = 110;   // ref-px (≈56 px — удобно для тапа)
      const gap = 22;
      const step = 0.10;

      const out = [];
      let bottomRef = REF_H - 22;

      for (let i = 0; i < count; i++) {
        const k = Math.pow(1 - step, i);
        const wRef = w0 * k;
        const leftRef = fromLeft ? 22 : (REF_W - 22 - wRef);

        out.push({
          left:   this.px(leftRef),
          top:    this.py(bottomRef - h0),
          width:  this.s(wRef),
          height: this.s(h0),
        });
        bottomRef -= (h0 + gap);
      }
      return out;
    }

    // === Десктоп — без изменений ===
    const CENTER_W = 398;
    const CENTER_H = 97;
    const w0 = Math.round(CENTER_W * 0.60);
    const h0 = Math.round(CENTER_H * 0.60);
    const gap  = 18;
    const step = 0.15;

    const out = [];
    let bottomRef = REF_H - 22;

    for (let i = 0; i < count; i++) {
      const k = Math.pow(1 - step, i);
      const wRef = w0 * k;
      const leftRef = fromLeft ? 22 : (REF_W - 22 - wRef);

      out.push({
        left:   this.px(leftRef),
        top:    this.py(bottomRef - h0),
        width:  this.s(wRef),
        height: this.s(h0),
      });
      bottomRef -= (h0 + gap);
    }
    return out;
  }
}