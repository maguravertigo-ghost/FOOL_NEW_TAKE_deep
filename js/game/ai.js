import { RANK_VALUE, SUITS, RANKS_36, RANKS_52 } from './constants.js';
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

  /* ============================================================
   * ЧЕСТНОЕ ВИДЕНИЕ (CARD COUNTING)
   * ============================================================ */

  _getSeenCards() {
    const seen = new Set();
    // 1. Моя рука
    for (const c of this.hand) seen.add(c.data.rank + c.data.suit);
    
    // 2. Текущий стол
    if (this.s.round && this.s.round.table) {
      for (const p of this.s.round.table) {
        if (p.atk) seen.add(p.atk.data.rank + p.atk.data.suit);
        if (p.def) seen.add(p.def.data.rank + p.def.data.suit);
      }
    }
    
    // 3. Отбой (все, что ушло за игру)
    // Ищем массив отбоя в сессии (обычно это this.s.discard или this.s.round.discard)
    const discard = this.s.discard || this.s.round?.discard || [];
    for (const c of discard) {
      seen.add(c.data.rank + c.data.suit);
    }
    
    // 4. Козырь (нижняя карта колоды)
    if (this.s.trumpCard) {
      seen.add(this.s.trumpCard.data.rank + this.s.trumpCard.data.suit);
    }
    
    return seen;
  }

  _getUnseenCards() {
    const seen = this._getSeenCards();
    const deckType = this.s.app.deck?.type || '36';
    const allRanks = deckType === '52' ? RANKS_52 : RANKS_36;
    
    const unseen = [];
    for (const suit of SUITS) {
      for (const rank of allRanks) {
        if (!seen.has(rank + suit)) {
          unseen.push({ rank, suit });
        }
      }
    }
    return unseen;
  }

  // Проверяет, может ли ИГРОК побить эту карту (в эндшпиле)
  _isCardUnbeatable(card) {
    if (this.deckLeft > 0) return false; // В колоде еще есть карты, гарантий нет
    
    const unseen = this._getUnseenCards();
    // Если карт в "невидимых" больше, чем у игрока в руке + в колоде (должно быть 0, т.к. deckLeft === 0)
    // Значит у игрока ровно `playerHandSize` карт.
    
    // Ищем, есть ли у игрока карта, которая побьет нашу
    for (const u of unseen) {
      const uCard = { data: u };
      if (canBeat(uCard, card, this.trump)) {
        return false; // Игрок МОЖЕТ побить
      }
    }
    return true; // Игрок НЕ МОЖЕТ побить
  }

  /* ============================================================
   * ЛОГИКА ПРИНЯТИЯ РЕШЕНИЙ
   * ============================================================ */

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

  _decideAttackFirst() {
    const hand = this.hand;
    if (!hand.length) return { type: 'pass' };

    const nonT = hand.filter(c => !this.isTrump(c));
    const pool = nonT.length ? nonT : hand;

    if (this.level === 1) {
      const sorted = pool.slice().sort((a, b) => this.rank(a) - this.rank(b));
      return { type: 'attack', card: sorted[0] };
    }

    // === ФИНАЛ: колода пуста (ЭНДШПИЛЬ) ===
    if (this.deckLeft === 0) {
      // 1. Ищем карты, которые игрок ТОЧНО не побьет (гарантированный удар)
      const unbeatable = pool.filter(c => this._isCardUnbeatable(c));
      if (unbeatable.length) {
        // Атакуем самой сильной из них (или козырем, если это козырь)
        unbeatable.sort((a, b) => this.attackValue(b) - this.attackValue(a));
        return { type: 'attack', card: unbeatable[0] };
      }
      
      // 2. Если таких нет, играем по классике (слабую)
      const sorted = pool.slice().sort((a, b) => this.rank(a) - this.rank(b));
      return { type: 'attack', card: sorted[0] };
    }

    // === ЭКСПЕРТ: серия (3+ карт одного ранга) ===
    if (this.level >= 3) {
      const rankGroups = {};
      for (const c of pool) {
        rankGroups[c.data.rank] = (rankGroups[c.data.rank] || 0) + 1;
      }
      const groups = Object.entries(rankGroups)
        .filter(([_, n]) => n >= 3)
        .sort(([r1], [r2]) => RANK_VALUE[r1] - RANK_VALUE[r2]);

      if (groups.length) {
        const [rank] = groups[0];
        const groupCards = pool.filter(c => c.data.rank === rank);
        groupCards.sort((a, b) => this.rank(a) - this.rank(b));
        return { type: 'attack', card: groupCards[0] };
      }
    }

    // === СЕРЕДИНА: самая слабая карта ===
    const lowest = pool.reduce((min, c) =>
      this.rank(c) < this.rank(min) ? c : min, pool[0]);
    return { type: 'attack', card: lowest };
  }

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

    let chance = this.deckLeft === 0 ? 0.95 : (this.deckLeft < 6 ? 0.85 : 0.75);

    if (this.level >= 3) {
      const sameRankCount = pool.filter(c => tR.has(c.data.rank)).length;
      if (sameRankCount >= 3) chance = 1.0;
      else if (sameRankCount === 2) chance = 0.95;
    }

    if (this.playerHandSize <= 2) chance = 1.0;

    if (Math.random() > chance) return { type: 'pass' };

    pool.sort((a, b) => this.attackValue(a) - this.attackValue(b));
    return { type: 'attack', card: pool[0], dump: false };
  }

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

  _decideDefense() {
    const r = this.s.round;
    const unbeaten = r.table.filter(p => p.atk && !p.def);
    if (!unbeaten.length) return { type: 'take' };

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

    // ============================================================
    // ЭНДШПИЛЬ (колода пуста): ЗАЩИЩАЕМСЯ ВСЕГДА
    // ============================================================
    if (this.deckLeft === 0) {
      // На эндшпиле ИИ использует видение, чтобы выбрать ЛУЧШУЮ карту для защиты.
      // Если он может побить карту, которая гарантированно оставит его в выигрыше — он это сделает.
      const first = plan[0];
      const pairIdx = r.table.findIndex(p => p.atk === first.atk);
      return { type: 'defense', card: first.def, pairIdx };
    }

    // ============================================================
    // ФАЗА ДОБОРА (колода не пуста)
    // ============================================================
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

    if (trumpCost >= 2) return { type: 'take' };
    if (trumpCost === 1 && trumpsInHand < 3) return { type: 'take' };

    if (highCost >= 2) return { type: 'take' };
    if (highCost === 1 && plan.length >= 2 && totalRank >= 22) return { type: 'take' };

    if (pairBreaking >= 2) return { type: 'take' };
    if (pairBreaking === 1 && this.level >= 3 && Math.random() < 0.3) return { type: 'take' };

    if (plan.length >= 3) return { type: 'take' };

    if (this.level >= 3 && plan.length === 1 && trumpCost === 0 && Math.random() < 0.15) {
      return { type: 'take' };
    }

    const first = plan[0];
    const pairIdx = r.table.findIndex(p => p.atk === first.atk);
    return { type: 'defense', card: first.def, pairIdx };
  }
}