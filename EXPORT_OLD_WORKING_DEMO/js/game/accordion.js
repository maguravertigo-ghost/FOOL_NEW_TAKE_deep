import { audio } from '../audio/audio_engine.js';
import { Marker } from '../core/marker.js';
import { SUIT_VALUE, RANK_VALUE, REAL_H } from './constants.js';
import { moveLinear, moveFlip } from '../core/interpolator.js';
import { SceneLayout } from './scene_layout.js';

const Z_BASE        = 100;
const Z_FLIGHT_BASE = 1000;
const FAN_ACCEL     = 1.3;   // «ускорение» веера: >1 — края крутятся/падают сильнее

export function compareCards(a, b) {
  const sa = SUIT_VALUE[a.data.suit];
  const sb = SUIT_VALUE[b.data.suit];
  if (sa !== sb) return sa - sb;
  return RANK_VALUE[a.data.rank] - RANK_VALUE[b.data.rank];
}

export class Accordion {
  constructor({ scene, interp, anchorL, anchorR, insertAnchor, baseMinDist, fanDir = 1 }) {
    this.scene = scene;
    this.interp = interp;
    this.anchorL = anchorL;
    this.anchorR = anchorR;
    this.insertAnchor = insertAnchor;
    this.baseMinDist = baseMinDist;
    this.fanDir = fanDir;              // +1: player (края вниз), −1: CPU (края вверх)

    this.cards = [];
    this.slotByUid = new Map();
    this._flightCounter = 0;
  }

  size() { return this.cards.length; }

  _nextFlightZ() { return Z_FLIGHT_BASE + (++this._flightCounter); }

  _applyZ() { this.cards.forEach((c, i) => c.setZIndex(Z_BASE + i)); }

_computeSlots(n) {
  if (n <= 0) return [];

  const C = SceneLayout.config;
  const W_scene = this.scene.width;
  const H_scene = this.scene.height;

  const a = this.scene.resolve(this.anchorL);
  const b = this.scene.resolve(this.anchorR);
  const W_hand = Math.max(1, b.x - a.x);
  const cx = (a.x + b.x) / 2;
  const yBasePx = this.anchorL.y * H_scene;

  // Одна карта — вертикально, без поворота и сдвига
  if (n === 1) {
    return [new Marker(cx / W_scene, yBasePx / H_scene, 'slot_0', 0)];
  }

  // Ширина руки: базовый шаг × (n−1), но не шире аккордеона
  const baseSpan = this.baseMinDist * (n - 1);
  const span = Math.min(baseSpan, W_hand);

  // Максимальный угол крайней карты, в радианах
  const Phi = (C.accFanAngle || 0) * Math.PI / 180;

  // Веер выключен — плоский ряд
  if (Math.abs(Phi) < 1e-4) {
    const step = span / (n - 1);
    const startX = cx - span / 2;
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(new Marker(
        (startX + step * i) / W_scene,
        yBasePx / H_scene,
        `slot_${i}`,
        0
      ));
    }
    return out;
  }

  // Радиус дуги: 2·R·sin(Φ) = span  →  R = span / (2·sin(Φ))
  const R = span / (2 * Math.sin(Phi));

  const center = (n - 1) / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t   = (i - center) / center;      // [-1, 1]
    const phi = t * Phi;                     // радианы, [-Φ, +Φ]

    const x     = cx + R * Math.sin(phi);
    const yDrop = R * (1 - Math.cos(phi));   // 0 на центре, максимум на краях
    const y     = yBasePx + this.fanDir * yDrop;

    // Поворот карты = её полярный угол (со знаком для CPU)
    const angleDeg = this.fanDir * phi * 180 / Math.PI;

    out.push(new Marker(x / W_scene, y / H_scene, `slot_${i}`, angleDeg));
  }
  return out;
}

  layoutInstant() {
    const slots = this._computeSlots(this.cards.length);
    this.slotByUid.clear();
    this.cards.forEach((c, i) => {
      const m = slots[i];
      this.slotByUid.set(c.uid, m);
      c.attachTo(m, this.scene);       // relayout применяет marker.angle
    });
    this._applyZ();
  }

  add(card, entryMarker, opts = {}) {
    const onDone  = typeof opts === 'function' ? opts : opts.onDone;
    const reveal  = (typeof opts === 'object' && opts.reveal !== undefined)
                    ? opts.reveal : true;

    const oldSlotByUid = new Map(this.slotByUid);

    const newCards = [...this.cards, card].sort(compareCards);
    const newSlots = this._computeSlots(newCards.length);
    const newSlotByUid = new Map();
    newCards.forEach((c, i) => newSlotByUid.set(c.uid, newSlots[i]));

    this.cards = newCards;
    this.slotByUid = newSlotByUid;

    newCards.forEach((c, i) => { if (c !== card) c.setZIndex(Z_BASE + i); });
    card.setZIndex(this._nextFlightZ());

    const targetSlot = newSlotByUid.get(card.uid);
    const insertMarker = new Marker(
      targetSlot.x,
      this.insertAnchor.y,
      `insert_${card.uid}`,
      0
    );

    card.marker = entryMarker;
    const p = this.scene.resolve(entryMarker);
    card.setPosition(p.x, p.y);

    // фаза 1: entry → insert (без поворота)
    moveLinear(this.interp, card, this.scene, entryMarker, insertMarker, {
      fromAngle: card.angle,
      toAngle: 0,
      onDone: () => {
        if (reveal) card.setFaceUp(true);

        let pending = 0;
        const tick = () => {
          if (--pending <= 0) {
            this._applyZ();
            if (typeof onDone === 'function') onDone();
          }
        };

        // (a) новая: insert → slot, с доворотом
        pending++;
        moveLinear(this.interp, card, this.scene, insertMarker, targetSlot, {
          fromAngle: 0,
          toAngle: targetSlot.angle,
          onDone: tick,
        });

        // (b) существующие: old → new (позиция + угол)
        for (const c of newCards) {
          if (c === card) continue;
          const from = oldSlotByUid.get(c.uid);
          const to   = newSlotByUid.get(c.uid);
          if (!from || !to) continue;
          pending++;
          moveLinear(this.interp, c, this.scene, from, to, {
            fromAngle: from.angle,
            toAngle: to.angle,
            onDone: tick,
          });
        }
        if (pending === 0) tick();
      }
    });
  }

  remove(card, targetMarker, opts = {}) {
    const onDone = typeof opts === 'function' ? opts : opts.onDone;
    const oldSlotByUid = new Map(this.slotByUid);
    const idx = this.cards.indexOf(card);
    if (idx < 0) return;

    const newCards = this.cards.filter(c => c !== card);
    const newSlots = this._computeSlots(newCards.length);
    const newSlotByUid = new Map();
    newCards.forEach((c, i) => newSlotByUid.set(c.uid, newSlots[i]));

    this.cards = newCards;
    this.slotByUid = newSlotByUid;

    newCards.forEach((c, i) => c.setZIndex(Z_BASE + i));
    card.setZIndex(this._nextFlightZ());

    let pending = 0;
    const tick = () => {
      if (--pending <= 0) {
        this._applyZ();
        if (typeof onDone === 'function') onDone();
      }
    };

    const from = oldSlotByUid.get(card.uid);
    if (from) {
      pending++;
      moveLinear(this.interp, card, this.scene, from, targetMarker, {
        fromAngle: from.angle,
        toAngle: 0,
        onDone: tick,
      });
    }

    for (const c of newCards) {
      const a = oldSlotByUid.get(c.uid);
      const b = newSlotByUid.get(c.uid);
      if (!a || !b) continue;
      pending++;
      moveLinear(this.interp, c, this.scene, a, b, {
        fromAngle: a.angle,
        toAngle: b.angle,
        onDone: tick,
      });
    }
    if (pending === 0) tick();
  }

  /* ================================================================
   * Дораздача: удаление случайных карт + пакетная вставка
   * ================================================================ */

  /**
   * Убирает `count` случайных карт из руки.
   * Оставшиеся анимированно съезжаются к своим новым слотам.
   * Возвращает Promise<Card[]> — удалённые карты (чтобы вызывающий
   * мог почистить DOM и общий список карт).
   */
  async removeRandom(count) {
    const toRemove = [...this.cards]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.max(0, count));

    const oldSlots = new Map(this.slotByUid);
    const newCards = this.cards.filter(c => !toRemove.includes(c));
    const newSlots = this._computeSlots(newCards.length);
    const newSlotByUid = new Map();
    newCards.forEach((c, i) => newSlotByUid.set(c.uid, newSlots[i]));

    this.cards = newCards;
    this.slotByUid = newSlotByUid;
    this._applyZ();

    if (newCards.length === 0) return toRemove;

    await Promise.all(newCards.map(c => new Promise(resolve => {
      const from = oldSlots.get(c.uid);
      const to   = newSlotByUid.get(c.uid);
      if (!from || !to) { resolve(); return; }
      moveLinear(this.interp, c, this.scene, from, to, {
        fromAngle: from.angle,
        toAngle:   to.angle,
        onDone:    resolve,
      });
    })));

    return toRemove;
  }

  /**
   * Пакетная дораздача.
   *
   *   Фаза 1 — карты по очереди (stagger) летят от entryMarker к своим
   *            точкам на линии вставки. Остаются рубашкой.
   *   Пауза settleDelay.
   *   Фаза 2 — режим flipMode:
   *      'immediate'  — карты открывались ещё при подлёте, вставляются
   *                     в руку параллельно (используется для CPU).
   *      'sequential' — карты переворачиваются по одной (каскадом с
   *                     минимальным интервалом), и каждая сразу
   *                     отправляется в руку. Существующие карты в руке
   *                     начинают раздвигаться ровно в тот момент, когда
   *                     первая новая карта стартует с линии вставки.
   *
   *   Перед началом фазы 2 всем картам (в т.ч. новым) присваивается
   *   финальный z-index — «сортировка по глубине» до начала движения.
   */
  async stageAndInsert(cards, entryMarker, opts = {}) {
    const stagger     = opts.stagger     ?? 260;
    const settleDelay = opts.settleDelay ?? 350;
    const reveal      = opts.reveal !== false;
    const flipMode    = opts.flipMode    ?? 'immediate';
    const flipDelay   = opts.flipDelay   ?? 80;

    if (!cards || cards.length === 0) return;

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // ---- расчёт целевых слотов ----
    const oldSlots = new Map(this.slotByUid);
    const newCards = [...this.cards, ...cards].sort(compareCards);
    const newSlots = this._computeSlots(newCards.length);
    const newSlotByUid = new Map();
    newCards.forEach((c, i) => newSlotByUid.set(c.uid, newSlots[i]));

    const insertMarkers = cards.map(c => {
      const target = newSlotByUid.get(c.uid);
      return new Marker(target.x, this.insertAnchor.y, `insert_${c.uid}`, 0);
    });

    // стартовая позиция новых карт — точка входа
    const pEntry = this.scene.resolve(entryMarker);
    // Первая карта — выше всех, каждая следующая ниже. Запас 500 —
    // гарантированно выше колоды (50+) и стола (200+).
    const baseZ = 1500;
    cards.forEach((c, i) => {
      c.marker = entryMarker;
      c.setPosition(pEntry.x, pEntry.y);
      c.setZIndex(baseZ - i);
    });

    // ---------- Фаза 1: по очереди на линию вставки ----------
	await Promise.all(cards.map((c, i) => new Promise(resolve => {
	  setTimeout(() => {
		audio.playSfx('card_fly');
		moveLinear(this.interp, c, this.scene, entryMarker, insertMarkers[i], {
		  fromAngle: c.angle,
		  toAngle:   0,
		  onDone:    () => {
			if (reveal && flipMode === 'immediate') c.setFaceUp(true);
			resolve();
		  },
		});
	  }, stagger * i);
	})));

    // ---------- пауза, все на линии вставки ----------
    await sleep(settleDelay);

    // ---------- Фаза 2 ----------
    this.cards = newCards;
    this.slotByUid = newSlotByUid;
    newCards.forEach((c, i) => c.setZIndex(Z_BASE + i));

    // thunk-и существующих карт: old → new (запустим позже)
    const existingThunks = [];
    for (const c of newCards) {
      if (cards.includes(c)) continue;
      const from = oldSlots.get(c.uid);
      const to   = newSlotByUid.get(c.uid);
      if (!from || !to) continue;
      existingThunks.push(() => new Promise(resolve => {
        moveLinear(this.interp, c, this.scene, from, to, {
          fromAngle: from.angle,
          toAngle:   to.angle,
          onDone:    resolve,
        });
      }));
    }

    if (flipMode === 'sequential' && reveal) {
      // --- A. сначала переворачиваем ВСЕ, каскадом слева направо ---
      const ordered = [...cards].sort((a, b) => {
        const ia = cards.indexOf(a);
        const ib = cards.indexOf(b);
        return insertMarkers[ia].x - insertMarkers[ib].x;
      });

      for (let i = 0; i < ordered.length; i++) {
        const c = ordered[i];
        await new Promise(resolve => {
          moveFlip(this.interp, c, { onDone: resolve });
        });
        if (i < ordered.length - 1) await sleep(flipDelay);
      }

      // --- B. теперь одновременно: раздвигаем руку + все летят в руку ---
      const moves = existingThunks.map(fn => fn());
      for (const c of ordered) {
        const idx    = cards.indexOf(c);
        const target = newSlotByUid.get(c.uid);
        moves.push(new Promise(resolve => {
          moveLinear(this.interp, c, this.scene, insertMarkers[idx], target, {
            fromAngle: 0,
            toAngle:   target.angle,
            onDone:    resolve,
          });
        }));
      }
      await Promise.all(moves);
    } else {
      // immediate (CPU / reveal=false): рука и карты стартуют одновременно
      const moves = existingThunks.map(fn => fn());
      cards.forEach((c, i) => {
        const target = newSlotByUid.get(c.uid);
        moves.push(new Promise(resolve => {
          moveLinear(this.interp, c, this.scene, insertMarkers[i], target, {
            fromAngle: 0,
            toAngle:   target.angle,
            onDone:    resolve,
          });
        }));
      });
      await Promise.all(moves);
    }

    this._applyZ();
  }

  /**
   * Мгновенно зарегистрировать набор карт (уже находящихся в своих слотах).
   * Используется после первичной раздачи: карты летят прямо в слоты,
   * а тут мы просто фиксируем их в аккордеоне без пере-анимации.
   */
  setCards(cards) {
    this.cards = [...cards];
    const slots = this._computeSlots(this.cards.length);
    this.slotByUid.clear();
    this.cards.forEach((c, i) => {
      const m = slots[i];
      this.slotByUid.set(c.uid, m);
      c.marker = m;
      c.relayout(this.scene);       // snap-to-slot
    });
    this._applyZ();
  }

  /**
   * Изъять карту из руки БЕЗ перемещения самой карты.
   * Остальные анимированно съезжаются к новым слотам.
   * Возвращает { oldSlot } — где карта была (для последующих фаз).
   */
  extractCard(card) {
    const idx = this.cards.indexOf(card);
    if (idx < 0) return null;

    const oldSlots = new Map(this.slotByUid);
    const newCards = this.cards.filter(c => c !== card);
    const newSlots = this._computeSlots(newCards.length);
    const newSlotByUid = new Map();
    newCards.forEach((c, i) => newSlotByUid.set(c.uid, newSlots[i]));

    const oldSlot = oldSlots.get(card.uid);

    this.cards = newCards;
    this.slotByUid = newSlotByUid;
    this._applyZ();

    for (const c of newCards) {
      const from = oldSlots.get(c.uid);
      const to   = newSlotByUid.get(c.uid);
      if (!from || !to) continue;
      moveLinear(this.interp, c, this.scene, from, to, {
        fromAngle: from.angle,
        toAngle:   to.angle,
      });
    }

    return { oldSlot };
  }

  /**
   * Взять карты со стола в руку с сохранением их стартовых позиций.
   *  • cards — карты, которые сейчас на сцене (НЕ в аккордеоне);
   *  • каждая стартует со СВОЕЙ позиции, а не из общей точки входа;
   *  • фаза 1: индивидуально летят на линию вставки;
   *  • пауза;
   *  • фаза 2: все одновременно идут в целевые слоты, существующие сдвигаются.
   */
  async takeFromTable(cards, opts = {}) {
    if (!cards || cards.length === 0) return;
    const stagger     = opts.stagger     ?? 90;
    const settleDelay = opts.settleDelay ?? 250;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const oldSlots = new Map(this.slotByUid);
    const newCards = [...this.cards, ...cards].sort(compareCards);
    const newSlots = this._computeSlots(newCards.length);
    const newSlotByUid = new Map();
    newCards.forEach((c, i) => newSlotByUid.set(c.uid, newSlots[i]));

    const startPos = cards.map(c => ({ x: c.x, y: c.y, angle: c.angle }));

    const insertMarkers = cards.map(c => {
      const target = newSlotByUid.get(c.uid);
      return new Marker(target.x, this.insertAnchor.y, `insert_${c.uid}`, 0);
    });

    const baseZ = 1500;
    cards.forEach((c, i) => {
      c.marker = null;
      c.setZIndex(baseZ - i);
    });

    // Фаза 1: каждая — на свою точку линии вставки
    await Promise.all(cards.map((c, i) => new Promise(resolve => {
      const fromM = new Marker(
        startPos[i].x / this.scene.width,
        startPos[i].y / this.scene.height,
        `from_${c.uid}`,
        startPos[i].angle
      );
      setTimeout(() => {
		audio.playSfx('card_fly');
        moveLinear(this.interp, c, this.scene, fromM, insertMarkers[i], {
          fromAngle: startPos[i].angle,
          toAngle: 0,
          onDone: resolve,
        });
      }, i * stagger);
    })));

    await sleep(settleDelay);

    // Фаза 2: все → целевые слоты + существующие сдвигаются
    this.cards = newCards;
    this.slotByUid = newSlotByUid;
    newCards.forEach((c, i) => c.setZIndex(Z_BASE + i));

    const moves = [];

    cards.forEach((c) => {
      const idx = cards.indexOf(c);
      const target = newSlotByUid.get(c.uid);
      moves.push(new Promise(resolve => {
        moveLinear(this.interp, c, this.scene, insertMarkers[idx], target, {
          fromAngle: 0,
          toAngle: target.angle,
          onDone: resolve,
        });
      }));
    });

    for (const c of newCards) {
      if (cards.includes(c)) continue;
      const from = oldSlots.get(c.uid);
      const to   = newSlotByUid.get(c.uid);
      if (!from || !to) continue;
      moves.push(new Promise(resolve => {
        moveLinear(this.interp, c, this.scene, from, to, {
          fromAngle: from.angle,
          toAngle:   to.angle,
          onDone:    resolve,
        });
      }));
    }

    await Promise.all(moves);
    this._applyZ();
  }

  relayout() {
    const slots = this._computeSlots(this.cards.length);
    this.slotByUid.clear();
    this.cards.forEach((c, i) => {
      const m = slots[i];
      this.slotByUid.set(c.uid, m);
      if (!c.marker) return;
      c.marker = m;
      c.relayout(this.scene);            // применяет marker.angle
    });
  }
}