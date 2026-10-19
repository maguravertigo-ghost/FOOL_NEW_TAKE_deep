/**
 * Слой перехвата событий мыши/тача.
 * Универсальные события (единые для мыши и одного пальца):
 *   is_pressed  — pointerdown
 *   is_moving   — pointermove (только если уже pressed)
 *   is_released — pointerup / pointercancel
 */
export class MouseCapture {
  constructor(element) {
    this.el = element;
    this.handlers = {
      press:   new Set(),
      release: new Set(),
      move:    new Set(),
    };
    this.isPressed = false;
    this.lastX = 0;
    this.lastY = 0;

    this._onDown  = this._onDown.bind(this);
    this._onUp    = this._onUp.bind(this);
    this._onMove  = this._onMove.bind(this);
    this._onLeave = this._onLeave.bind(this);

    this.el.addEventListener('pointerdown', this._onDown);
    this.el.addEventListener('pointerup', this._onUp);
    this.el.addEventListener('pointermove', this._onMove);
    this.el.addEventListener('pointercancel', this._onUp);
    this.el.addEventListener('pointerleave', this._onLeave);
    this.el.addEventListener('contextmenu', e => e.preventDefault());
  }

  _xy(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _onDown(e) {
    // игнорируем дополнительные пальцы (нам нужен только один)
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    const { x, y } = this._xy(e);
    this.isPressed = true;
    this.lastX = x; this.lastY = y;
    for (const h of this.handlers.press) h(x, y, e);
  }

  _onUp(e) {
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    const { x, y } = this._xy(e);
    this.isPressed = false;
    for (const h of this.handlers.release) h(x, y, e);
  }

  _onMove(e) {
    if (!this.isPressed) return;
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    const { x, y } = this._xy(e);
    this.lastX = x; this.lastY = y;
    for (const h of this.handlers.move) h(x, y, e);
  }

  _onLeave(e) {
    if (!this.isPressed) return;
    this.isPressed = false;
    for (const h of this.handlers.release) h(this.lastX, this.lastY, e);
  }

  onPress(fn)   { this.handlers.press.add(fn);   return () => this.handlers.press.delete(fn); }
  onRelease(fn) { this.handlers.release.add(fn); return () => this.handlers.release.delete(fn); }
  onMove(fn)    { this.handlers.move.add(fn);    return () => this.handlers.move.delete(fn); }
}