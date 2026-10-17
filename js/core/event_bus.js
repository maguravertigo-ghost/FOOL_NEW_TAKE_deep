export class EventBus {
  constructor() {
    this._topics = new Map();
    this._paused = new Set();
  }

  on(topic, fn) {
    if (!this._topics.has(topic)) this._topics.set(topic, new Set());
    this._topics.get(topic).add(fn);
    return () => this.off(topic, fn);
  }

  off(topic, fn) {
    const set = this._topics.get(topic);
    if (set) set.delete(fn);
  }

  emit(topic, ...args) {
    if (this._paused.has(topic)) return;
    const set = this._topics.get(topic);
    if (!set) return;
    for (const fn of set) {
      try { fn(...args); } catch (e) { console.warn('[bus]', topic, e); }
    }
  }

  pause(topic)  { this._paused.add(topic); }
  resume(topic) { this._paused.delete(topic); }
}

export const bus = new EventBus();