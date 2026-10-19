/* HUD-разметка.
   Все числа — в референсных пикселях от 1366×768.
   Масштаб — от короткой стороны сцены, чтобы контент сжимался
   ЦЕЛИКОМ и не «разъезжался» по углам. */

const REF_W = 1366;
const REF_H = 768;
const LOGO_ASPECT = 792 / 539;
const BTN_ASPECT  = 398 / 97;

export class HudLayout {
  constructor(sceneEl) {
    this.el = sceneEl;
    this.W = 0; this.H = 0;
    this.update();
  }

update() {
  const r = this.el.getBoundingClientRect();
  this.W = r.width;
  this.H = r.height;

  const scaleX = this.W / REF_W;
  const scaleY = this.H / REF_H;
  this.scale = Math.min(scaleX, scaleY);

  // offset = куда сдвинуть макет внутри сцены, чтобы он был по центру
  const layoutW = REF_W * this.scale;
  const layoutH = REF_H * this.scale;
  this.offsetX = (this.W - layoutW) / 2;
  this.offsetY = (this.H - layoutH) / 2;
}

  /** Преобразование референсных пикселей в координаты сцены. */
  px(v) { return this.offsetX + v * this.scale; }
  py(v) { return this.offsetY + v * this.scale; }
  s(v)  { return v * this.scale; }   // размер

  /* ================= Rects ================= */

  /** Лого — по ТЗ: сверху 33, снизу 424. */
rectLogo() {
  const top    = this.py(33);
  const bottom = this.py(424);
  const segH   = bottom - top;
  const cx     = this.px(683);

  // не залезаем на боковые блоки:
  // левый контент кончается на px(360), правый начинается с px(1006)
  const maxW = this.px(1006) - this.px(360);

  // естественные размеры по аспекту
  let w = segH * LOGO_ASPECT;
  let h = segH;

  // если логотип шире, чем позволяет контент-полоса — режем по ширине,
  // но сохраняем пропорции
  if (w > maxW) {
    w = maxW;
    h = w / LOGO_ASPECT;
  }

  return {
    left:   cx - w / 2,
    top:    top + (segH - h) / 2,
    width:  w, height: h,
    cx, cy: (top + bottom) / 2,
  };
}

  rectBtn0() {
    const w = this.s(398);
    const h = this.s(97);
    return { left: this.px(683) - w / 2, top: this.py(466), width: w, height: h };
  }

  rectBtn1() {
    const w = this.s(398);
    const h = this.s(97);
    return { left: this.px(683) - w / 2, top: this.py(580), width: w, height: h };
  }

  rectAuthor() {
    return {
      top:    this.py(714),
      bottom: this.py(738),
      height: this.s(24),
    };
  }

  /** Верхний блок — общая высота 180 ref-px. */
  _topBlockH() { return this.s(180); }

rectStats() {
  const left  = this.px(22);
  const right = this.px(282);       // было 360 → 282 (260 ref-px вместо 338)
  const top   = this.py(22);
  const h     = this._topBlockH();
  return { left, top, width: right - left, height: h };
}

rectStylePoints() {
  const left  = this.px(1084);      // было 1006 → 1084
  const right = this.px(1344);
  const top   = this.py(22);
  const h     = this._topBlockH() * 0.5;
  return { left, top, width: right - left, height: h };
}

/** Кнопка «КАК ИГРАТЬ» — под блоком очков стиля, по правому краю. */
rectHelpButton() {
  const sp   = this.rectStylePoints();
  const gap  = this.s(16);
  const h    = this.s(64);
  const w    = this.s(200);
  return {
    left:   sp.left + sp.width - w,   // правый край совпадает с правым краем блока
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
    // Центральная кнопка = 398×97 ref-px.
    // Боковые не должны превышать 0.8 от её размеров.
    const CENTER_W = 398;
    const CENTER_H = 97;
	  const w0 = Math.round(CENTER_W * 0.60);   // было 0.8 → 0.6
	  const h0 = Math.round(CENTER_H * 0.60);   // было 0.8 → 0.6
    const gap  = 18;    // ref-px
    const step = 0.15;  // каждый следующий уже на 15%

    const out = [];
    let bottomRef = REF_H - 22;

    for (let i = 0; i < count; i++) {
      const k = Math.pow(1 - step, i);
      const wRef = w0 * k;
      const leftRef = fromLeft ? 22 : (REF_W - 22 - wRef);

      const left   = this.px(leftRef);
      const top    = this.py(bottomRef - h0);
      const width  = this.s(wRef);
      const height = this.s(h0);

      out.push({ left, top, width, height });

      bottomRef -= (h0 + gap);
    }
    return out;
  }
}