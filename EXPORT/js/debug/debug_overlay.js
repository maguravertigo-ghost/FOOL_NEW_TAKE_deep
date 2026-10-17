import { SceneLayout } from '../game/scene_layout.js';

export class DebugOverlay {
  constructor(scene, markers, cardsProvider, layerEl) {
    this.scene = scene;
    this.markers = markers;
    this.cardsProvider = cardsProvider;
    this.layer = layerEl;

    this.enabled = false;
    this._pending = false;
    this._rafId = null;

    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
        this.toggle();
      }
    });

    scene.onResize(() => this.requestRender());

    this.requestRender();
  }

  toggle() {
    this.enabled = !this.enabled;
    this.layer.style.display = this.enabled ? 'block' : 'none';
    if (this.enabled) this.requestRender();
    else this.layer.innerHTML = '';
  }

  /**
   * Запланировать один рендер в следующем кадре.
   * Многократные вызовы до кадра схлопываются в один.
   */
  requestRender() {
    if (!this.enabled) return;
    if (this._pending) return;
    this._pending = true;
    this._rafId = requestAnimationFrame(() => {
      this._pending = false;
      this._rafId = null;
      this.render();
    });
  }

  render() {
    if (!this.enabled) return;

    const frag = document.createDocumentFragment();
    this._drawZones(frag);

    for (const m of this.markers.all()) {
      const p = this.scene.resolve(m);
      const dot = document.createElement('div');
      dot.className = 'dbg-marker';
      dot.style.left = p.x + 'px';
      dot.style.top  = p.y + 'px';
      const label = document.createElement('div');
      label.className = 'dbg-marker__label';
      label.textContent = `${m.name} (${m.x.toFixed(3)},${m.y.toFixed(3)})`;
      dot.appendChild(label);
      frag.appendChild(dot);
    }

    for (const c of this.cardsProvider()) {
      const p = document.createElement('div');
      p.className = 'dbg-pivot';
      p.style.left = c.x + 'px';
      p.style.top  = c.y + 'px';
      frag.appendChild(p);
    }

    this.layer.innerHTML = '';
    this.layer.appendChild(frag);
  }

  _drawZones(frag) {
    const px = SceneLayout.metrics.px;
    if (!px) return;

    this._zone(frag, px.L, px.T, px.R, px.B, '#0af');
    this._zone(frag, px.tblL, px.tblTopY, px.tblR, px.tblBotY, '#f80');

    const C = SceneLayout.config;
    const W = this.scene.width, H = this.scene.height;
    const rad = C.discardRadius * Math.min(W, H);
    const circle = document.createElement('div');
    circle.style.cssText =
      `position:absolute;` +
      `left:${px.discardX - rad}px;top:${px.discardY - rad}px;` +
      `width:${rad * 2}px;height:${rad * 2}px;` +
      `border-radius:50%;border:1px dashed #f66;pointer-events:none;`;
    frag.appendChild(circle);

    const centerM = this.markers.tryGet('center');
    if (centerM) {
      const p = this.scene.resolve(centerM);
      const line = document.createElement('div');
      line.style.cssText =
        `position:absolute;left:${p.x}px;top:0;width:1px;height:${H}px;` +
        `background:rgba(120,180,255,0.35);pointer-events:none;`;
      frag.appendChild(line);
    }
  }

  _zone(frag, left, top, right, bottom, color) {
    const el = document.createElement('div');
    el.style.cssText =
      `position:absolute;left:${left}px;top:${top}px;` +
      `width:${right - left}px;height:${bottom - top}px;` +
      `border:1px dashed ${color};box-sizing:border-box;pointer-events:none;`;
    frag.appendChild(el);
  }
}