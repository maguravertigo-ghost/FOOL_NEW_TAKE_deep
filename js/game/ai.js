import { RANK_VALUE } from './constants.js';
import { canBeat, canTranslate, canAddToTable, tableRanks } from './rules.js';

export class AI {
  constructor(session, { level = 2 } = {}) {
    this.s = session;
    this.level = level;
  }

  get hand()     { return this.s.app.accordionCpu.cards; }
  get trump()    { return this.s.trump; }
  get deckLeft() { return this.s._totalRemaining(); }
  get defSize()  { return this.s._defenderHandSize(); }
  get table()    { return this.s.round.table; }
  get playerHandSize() { return this.s.app.accordionPlayer.cards.length; }

  isTrump(c) { return c.data.suit === this.trump; }
  rank(c)    { return RANK_VALUE[c.data.rank]; }

  attackValue(c) { return this.isTrump(c) ? 100 + this.rank(c) : this.rank(c); }

  rankCountMap() {
    const m = {};
    for (const c of this.hand) m[c.data.rank] = (m[c.data.rank] || 0) + 1;
    return m;
  }

  pickCheapestBeater(atk) {
    const cands = this.hand.filter(c => canBeat(c, atk, this.trump));
    if (!cands.length) return null;
    cands.sort((a, b) => this.attackValue(a) - this.attackValue(b));
    return cands[0];
  }

  planDefenseAll(unbeaten) {
    const hand = this.hand.slice();
    const plan = [];
    const sorted = unbeaten.slice().sort((a, b) => this.attackValue(b.atk) - this.attackValue(a.atk));

    for (const pair of sorted) {
      const beaters = hand
        .filter(c => canBeat(c, pair.atk, this.trump))
        .sort((a, b) => this.attackValue(a) - this.attackValue(b));
      if (!beaters.length) return null;
      const pick = beaters[0];
      hand.splice(hand.indexOf(pick), 1);
      plan.push({ atk: pair.atk, def: pick });
    }
    return plan;
  }

  decide() {
    const r = this.s.round;
    switch (r.phase) {
      case 'A_START':  return this._decideAttackFirst();
      case 'A_ADD':    return this._decideAdd();
      case 'A_DUMP':   return this._decideDump();
      case 'D_ACT':    return this._decideDefense();
    }
    return null;
  }

  /* ============ АТАКА (начало раунда) ============ */
  _decideAttackFirst() {
    const hand = this.hand;
    if (!hand.length) return { type: 'pass' };

    const nonT = hand.filter(c => !this.isTrump(c));
    const counts = this.rankCountMap();

    // Level 1 — случайная слабая
    if (this.level === 1) {
      const pool = nonT.length ? nonT : hand;
      const sorted = pool.slice().sort((a, b) => this.rank(a) - this.rank(b));
      return { type: 'attack', card: sorted[0] };
    }

    // === ФИНАЛ: колода пуста ===
    if (this.deckLeft === 0) {
      // Сначала сбрасываем слабые некозыри, потом козыри по возрастанию
      const pool = nonT.length ? nonT : hand;
      const sorted = pool.slice().sort((a, b) => this.rank(a) - this.rank(b));
      return { type: 'attack', card: sorted[0] };
    }

    // === СЕРЕДИНА: атакуем АБСОЛЮТНО младшей картой ===
    // Не важно, пара это или одиночка — важна сама младшая карта.
    const pool = nonT.length ? nonT : hand;
    const lowest = pool.reduce((min, c) =>
      this.rank(c) < this.rank(min) ? c : min, pool[0]);
    return { type: 'attack', card: lowest };
  }

  /* ============ ПОДКИДЫВАНИЕ (A_ADD) ============ */
  _decideAdd() {
    const r = this.s.round;
    if (this.defSize === 0) return { type: 'pass' };
    if (r.table.length >= 6) return { type: 'pass' };

    if (this.s._devForceAIAdd) {
      const tR = tableRanks(r.table);
      const cands = this.hand.filter(c => canAddToTable(c, tR));
      if (!cands.length) return { type: 'pass' };
      cands.sort((a, b) => this.attackValue(a) - this.attackValue(b));
      return { type: 'attack', card: cands[0], dump: false };
    }

    const tR = tableRanks(r.table);
    const cands = this.hand.filter(c => canAddToTable(c, tR));
    if (!cands.length) return { type: 'pass' };

    const nonT = cands.filter(c => !this.isTrump(c));

    if (this.level === 1) {
      if (!nonT.length) return { type: 'pass' };
      if (Math.random() > 0.4) return { type: 'pass' };
      return { type: 'attack', card: nonT[0], dump: false };
    }

    let pool;
    if (this.deckLeft > 0) {
      if (!nonT.length) return { type: 'pass' };
      pool = nonT;
    } else {
      pool = nonT.length ? nonT : cands;
    }

    let chance = this.deckLeft === 0 ? 0.95 : (this.deckLeft < 6 ? 0.8 : (this.level >= 3 ? 0.7 : 0.55));
    
    // Если у врага мало карт — дожимаем
    if (this.playerHandSize <= 2) chance = 0.99;

    if (Math.random() > chance) return { type: 'pass' };

    pool.sort((a, b) => this.attackValue(a) - this.attackValue(b));
    return { type: 'attack', card: pool[0], dump: false };
  }

  /* ============ СБРОС (A_DUMP) ============ */
  _decideDump() {
    const r = this.s.round;
    if (this.defSize === 0) return { type: 'done' };

    const tR = tableRanks(r.table);
    const cands = this.hand.filter(c => canAddToTable(c, tR));
    if (!cands.length) return { type: 'done' };

    const limit = Math.min(6, this.defSize);
    if (r.table.length >= limit) return { type: 'done' };

    if (this.level === 1) {
      const nonT = cands.filter(c => !this.isTrump(c));
      if (!nonT.length) return { type: 'done' };
      nonT.sort((a, b) => this.attackValue(a) - this.attackValue(b));
      return { type: 'attack', card: nonT[0], dump: true };
    }

    const nonT = cands.filter(c => !this.isTrump(c));
    if (this.deckLeft > 0) {
      if (!nonT.length) return { type: 'done' };
      nonT.sort((a, b) => this.attackValue(a) - this.attackValue(b));
      return { type: 'attack', card: nonT[0], dump: true };
    }

    const lowTrumps = cands.filter(c => this.isTrump(c) && this.rank(c) <= 10);
    const pool = nonT.length ? nonT : lowTrumps;
    if (!pool.length) return { type: 'done' };
    pool.sort((a, b) => this.attackValue(a) - this.attackValue(b));
    return { type: 'attack', card: pool[0], dump: true };
  }

  /* ============ ЗАЩИТА (D_ACT) — ГЛАВНЫЕ ИЗМЕНЕНИЯ ============ */
  _decideDefense() {
    const r = this.s.round;
    const unbeaten = r.table.filter(p => p.atk && !p.def);
    if (!unbeaten.length) return { type: 'take' };

    // Level 1 — без изменений
    if (this.level === 1) {
      if (Math.random() < 0.25) return { type: 'take' };
      const atk = unbeaten[0].atk;
      const cands = this.hand.filter(c => canBeat(c, atk, this.trump));
      if (!cands.length) return { type: 'take' };
      const pairIdx = r.table.findIndex(p => p.atk === atk);
      return { type: 'defense', card: cands[0], pairIdx };
    }

    // === ПЕРЕВОД ===
    if (this.s.translateMode && !r.anyBeaten) {
      const firstAtk = unbeaten[0].atk;
      const translators = this.hand.filter(c => canTranslate(c, firstAtk, false, {
        unbeatenCount: unbeaten.length,
        opponentHandSize: this.playerHandSize,
      }));

      if (translators.length) {
        const nonT = translators.filter(c => !this.isTrump(c));
        const trumps = translators.filter(c => this.isTrump(c));
        const trumpsInHand = this.hand.filter(c => this.isTrump(c)).length;

        if (nonT.length && (this.level >= 3 || Math.random() < 0.75)) {
          nonT.sort((a, b) => this.attackValue(a) - this.attackValue(b));
          return { type: 'translate', card: nonT[0] };
        }

        if (trumps.length && trumpsInHand >= 3 && this.level >= 2) {
          const lowTrumps = trumps.filter(c => this.rank(c) < 11);
          if (lowTrumps.length && (this.deckLeft === 0 || this.playerHandSize <= 3)) {
            lowTrumps.sort((a, b) => this.attackValue(a) - this.attackValue(b));
            return { type: 'translate', card: lowTrumps[0] };
          }
        }
      }
    }

    // === ПЛАН ЗАЩИТЫ ===
    const plan = this.planDefenseAll(unbeaten);
    if (!plan) return { type: 'take' };

    // Анализируем стоимость защиты
    const trumpsInHand = this.hand.filter(c => this.isTrump(c)).length;
    const rankCounts = this.rankCountMap();

    let trumpCost = 0;
    let highCost = 0;
    let pairBreaking = 0;
    let totalRank = 0;

    for (const { def } of plan) {
      if (this.isTrump(def)) trumpCost++;
      if (this.rank(def) >= 11) highCost++;
      if (rankCounts[def.data.rank] > 1) pairBreaking++;
      totalRank += this.rank(def);
    }

    // === ФАЗА ДОБОРА (колода не пуста) — берём агрессивно ===
    if (this.deckLeft > 0) {
      // Сохраняем козыри
      if (trumpCost >= 2) return { type: 'take' };
      if (trumpCost === 1 && trumpsInHand < 3) return { type: 'take' };

      // Сохраняем старшие карты
      if (highCost >= 2) return { type: 'take' };
      if (highCost === 1 && plan.length >= 2 && totalRank >= 22) return { type: 'take' };

      // Не ломаем пары ради защиты
      if (pairBreaking >= 2) return { type: 'take' };
      if (pairBreaking === 1 && this.level >= 3 && Math.random() < 0.35) return { type: 'take' };

      // Слишком дорого
      if (plan.length >= 3) return { type: 'take' };

      // Стратегическое refresh (эксперт)
      if (this.level >= 3 && Math.random() < 0.2) return { type: 'take' };
    } else {
      // === ЭНДШПИЛЬ (колода пуста) — защищаемся изо всех сил ===
      // В эндшпиле «взять» = проиграть, поэтому защищаемся, если вообще можем.
      // Единственное исключение — если защита требует последнего козыря,
      // а у нас ещё есть чем атаковать.
      if (trumpCost === 1 && trumpsInHand < 1) return { type: 'take' };
      if (trumpsInHand === 0 && highCost >= 1 && plan.length >= 2) return { type: 'take' };
    }

    // Играем первую карту плана
    const first = plan[0];
    const pairIdx = r.table.findIndex(p => p.atk === first.atk);
    return { type: 'defense', card: first.def, pairIdx };
  }
}