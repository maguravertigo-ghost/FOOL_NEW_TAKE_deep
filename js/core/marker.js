/**
 * Маркер — точка на сцене в относительных координатах (0..1).
 * x: 0 — левый край, 1 — правый.
 * y: 0 — верх, 1 — низ.
 */
export class Marker {
  constructor(x, y, name = '', angle = 0) {
    this.x = x;
    this.y = y;
    this.name = name;
    this.angle = angle;
  }
  clone() { return new Marker(this.x, this.y, this.name, this.angle); }
}

export class MarkerRegistry {
  constructor() { this._map = new Map(); }

  set(name, x, y, angle = 0) {
    const m = new Marker(x, y, name, angle);
    this._map.set(name, m);
    return m;
  }
  setMarker(name, marker) { this._map.set(name, marker); return marker; }
  get(name) {
    const m = this._map.get(name);
    if (!m) throw new Error(`Marker not found: ${name}`);
    return m;
  }
  tryGet(name) { return this._map.get(name); }
  has(name)    { return this._map.has(name); }
  all()        { return [...this._map.values()]; }
}