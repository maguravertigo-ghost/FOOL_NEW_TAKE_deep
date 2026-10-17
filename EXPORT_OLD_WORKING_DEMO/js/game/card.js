import { ASSETS, svgInstance } from '../assets.js';
import { CARD_W, CARD_H, BASE_SCALE } from './constants.js';
import { spawnCard } from './card_cache.js';

export class Card {
  constructor(data, { cardStyle, suitStyle } = {}) {
    this.data = { ...data };
    this.uid = Card._nextUid++;

    this.faceUp = false;
    this.visible = true;

    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.scaleX = 1;
    this.baseScale = BASE_SCALE;

    /** @type {import('../core/marker.js').Marker|null} */
    this.marker = null;

    /* ---------- оболочка ---------- */
    this.el = document.createElement('div');
    this.el.className = 'card';
    this.el.dataset.uid = String(this.uid);
    this.el.style.width  = CARD_W + 'px';
    this.el.style.height = CARD_H + 'px';
    this.el.style.zIndex = '1';

    /* ---------- рубашка ---------- */
    this.shirtEl = document.createElement('div');
    this.shirtEl.className = 'card__layer card__shirt';
    this.el.appendChild(this.shirtEl);

    /* ---------- лицо через card_constructor ---------- */
    this.faceEl = document.createElement('div');
    this.faceEl.className = 'card__layer card__face';
    this.faceEl.style.cssText = 'display:flex;align-items:center;justify-content:center;';

    const cs = cardStyle || Card.defaultCardStyle || 'grid';
    const ss = suitStyle  || Card.defaultSuitStyle || 'gradient';

    try {
      const faceNode = spawnCard(this.data.rank, this.data.suit, cs, ss);
      // новый модуль использует --card-w для масштабирования
      faceNode.style.setProperty('--card-w', CARD_W + 'px');
      // обнулим внутренние transform контейнера, если модуль ставит свои
      faceNode.style.position = 'relative';
      faceNode.style.flex = '0 0 auto';
      this.faceEl.appendChild(faceNode);
    } catch (err) {
      console.warn('[card] spawnCard failed:', err);
    }

    this.el.appendChild(this.faceEl);

    /* ---------- overlay (запрет хода) ---------- */
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'card__overlay';
    const ovSvg = svgInstance(ASSETS.overlay);
    if (ovSvg) {
      ovSvg.style.cssText = 'display:block;width:100%;height:100%;';
      this.overlayEl.appendChild(ovSvg);
    } else {
      this.overlayEl.classList.add('card__overlay--fallback');
    }
    this.el.appendChild(this.overlayEl);

    this._fillShirt();
    this.setFaceUp(false);
    this._applyTransform();
  }

  /* ================================================================
   *  Рубашка
   * ================================================================ */

_fillShirt() {
  const url = Card.defaultShirtUrl || ASSETS.shirt;
  const svg = svgInstance(url);
  if (svg) {
    svg.classList.add('card__shirt-svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'width:100%;height:100%;display:block;';
    this.shirtEl.innerHTML = '';
    this.shirtEl.appendChild(svg);
    return;
  }
  const img = document.createElement('img');
  img.src = url;
  img.alt = '';
  img.style.cssText = 'width:100%;height:100%;display:block;object-fit:cover;';
  this.shirtEl.innerHTML = '';
  this.shirtEl.appendChild(img);
}

  /* ================================================================
   *  Состояние
   * ================================================================ */

  setFaceUp(v) {
    this.faceUp = !!v;
    this.shirtEl.style.display = this.faceUp ? 'none' : 'block';
    this.faceEl.style.display  = this.faceUp ? 'block' : 'none';
  }

  flip() { this.setFaceUp(!this.faceUp); }

  setOverlay(on) {
    this.overlayEl.style.display = on ? 'block' : 'none';
  }

  setZIndex(v) {
    this.el.style.zIndex = String(v);
  }

  /* ================================================================
   *  Позиционирование
   * ================================================================ */

  setPosition(x, y) { this.x = x; this.y = y; this._applyTransform(); }
  setAngle(deg)     { this.angle = deg; this._applyTransform(); }
  setScaleX(v)      { this.scaleX = v; this._applyTransform(); }

  _applyTransform() {
    const tx = this.x - CARD_W / 2;
    const ty = this.y - CARD_H / 2;
    const s  = this.baseScale;
    this.el.style.transform =
      `translate3d(${tx}px, ${ty}px, 0) ` +
      `rotate(${this.angle}deg) ` +
      `scale(${this.scaleX * s}, ${s})`;
  }

  /**
   * Установить смещение относительно маркера (в пикселях).
   * Позиция НЕ пересчитывается — вызови relayout(scene) сам.
   */
  setPixelOffset(x, y) {
    this._pixelOffset = { x, y };
  }

  attachTo(marker, scene) {
    this.marker = marker;
    this.relayout(scene);
  }

  relayout(scene) {
    if (!this.marker) return;
    const p = scene.resolve(this.marker);
    const ox = this._pixelOffset ? this._pixelOffset.x : 0;
    const oy = this._pixelOffset ? this._pixelOffset.y : 0;
    this.setPosition(p.x + ox, p.y + oy);
    this.setAngle(this.marker.angle || 0);
  }

  /* ================================================================
   *  Хит-тест
   * ================================================================ */

  getBounds() {
    const s = this.baseScale;
    const w = CARD_W * s;
    const h = CARD_H * s;
    const rad = this.angle * Math.PI / 180;
    const c  = Math.abs(Math.cos(rad));
    const si = Math.abs(Math.sin(rad));
    const halfW = (w * c + h * si) / 2;
    const halfH = (w * si + h * c) / 2;
    return {
      left:   this.x - halfW,
      right:  this.x + halfW,
      top:    this.y - halfH,
      bottom: this.y + halfH,
    };
  }

  hitTest(px, py) {
    const b = this.getBounds();
    return px >= b.left && px <= b.right && py >= b.top && py <= b.bottom;
  }
}

Card._nextUid = 1;
Card.defaultCardStyle = 'grid';
Card.defaultSuitStyle = 'gradient';
Card.defaultShirtUrl = ASSETS.shirt;