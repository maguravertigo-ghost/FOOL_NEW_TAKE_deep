import { RANK_VALUE } from './constants.js';
import { canBeat, canTranslate, canAddToTable, tableRanks } from './rules.js';

/**
 * Уровни сложности:
 *   1 — базовый
 *   2 — умный (по умолчанию): бережёт козыри, копит пары, аккуратно защищается
 *   3 — эксперт: активно планирует концовку, играет лестницей козырей
 */
export class AI {
  constructor(session, { level = 2 } = {}) {
    this.s = session;
    this.level = level;
  }

  /* ---------- доступ к состоянию ---------- */

  get hand()     { return this.s.app.accordionCpu.cards; }
  get trump()    { return this.s.trump; }
  get deckLeft() { return this.s._totalRemaining(); }
  get defSize()  { return this.s._defenderHandSize(); }
  get table()    { return this.s.round.table; }
  get playerHandSize() { return this.s.app.accordionPlayer.cards.length; }

  isTrump(c) { return c.data.suit === this.trump; }
  rank(c)    { return RANK_VALUE[c.data.rank]; }

  /* ---------- оценка карт ---------- */

  /** Чем меньше — тем охотнее сбрасываем. Козырь = 100+. */
  attackValue(c) {
    return this.isTrump(c) ? 100 + this.rank(c) : this.rank(c);
  }

  /** Сколько у меня карт этого ранга (для сохранения пар). */
  rankCountMap() {
    const m = {};
    for (const c of this.hand) m[c.data.rank] = (m[c.data.rank] || 0) + 1;
    return m;
  }

  /* ---------- защита ---------- */

  /** Минимальная по цене карта, которая бьёт `atk`. null — если нет. */
  pickCheapestBeater(atk) {
    const cands = this.hand.filter(c => canBeat(c, atk, this.trump));
    if (!cands.length) return null;
    cands.sort((a, b) => this.attackValue(a) - this.attackValue(b));
    return cands[0];
  }

  /**
   * План полной защиты. Возвращает список { atk, def } или null,
   * если хотя бы одну карту побить нечем.
   */
  planDefenseAll(unbeaten) {
    const hand = this.hand.slice();
    const plan = [];

    // Сложные (более дорогие в атаке) карты разбираем первыми,
    // чтобы сохранить дешёвые биттеры на остальное.
    const sorted = unbeaten
      .slice()
      .sort((a, b) => this.attackValue(b.atk) - this.attackValue(a.atk));

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

  /* ---------- DECIDE ---------- */

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
	// Level 1 — «новичок»: без оптимизации, просто первая некозырная
    if (this.level === 1) {
      const nonT = hand.filter(c => !this.isTrump(c));
      const pool = nonT.length ? nonT : hand;
      return { type: 'attack', card: pool[0] };
    }
    const trumps   = hand.filter(c => this.isTrump(c));
    const nonT     = hand.filter(c => !this.isTrump(c));
    const counts   = this.rankCountMap();

    // --- ФИНАЛ: колода пуста, играем лестницу козырей ---
    if (this.deckLeft === 0) {
      // Если у нас большинство козырей — играем младшим козырем
      const sortedTrumps = trumps.slice().sort((a, b) => this.rank(a) - this.rank(b));
      if (sortedTrumps.length >= 2 && nonT.length <= 2) {
        return { type: 'attack', card: sortedTrumps[0] };
      }
    }

    // --- Иначе: приоритет низким некозырям-одиночкам ---
    const pool = nonT.length ? nonT : hand;
    // Сначала — одиночки (не парные), потом парные
    const singles = pool.filter(c => counts[c.data.rank] === 1)
                        .sort((a, b) => this.rank(a) - this.rank(b));
    if (singles.length) return { type: 'attack', card: singles[0] };

    // Только пары — начинаем с младшей пары (создаём «шлейф»)
    const sorted = pool.slice().sort((a, b) => this.rank(a) - this.rank(b));
    return { type: 'attack', card: sorted[0] };
  }

  _decideAdd() {
    const r = this.s.round;
    if (this.defSize === 0) return { type: 'pass' };

    const tR = tableRanks(r.table);
    const cands = this.hand.filter(c => canAddToTable(c, tR));
    if (!cands.length) return { type: 'pass' };

    // Козыри в A_ADD не подкидываем (сохраняем на финал),
    // если только это не последний раунд.
    const nonT = cands.filter(c => !this.isTrump(c));
    if (!nonT.length && this.deckLeft > 0) {
      return { type: 'pass' };
    }
    const pool = (nonT.length ? nonT : cands);
	
	// Level 1 — редко подкидывает, козырями не подкидывает вообще
    if (this.level === 1) {
      if (!nonT.length) return { type: 'pass' };
      if (Math.random() > 0.4) return { type: 'pass' };
      return { type: 'attack', card: nonT[0], dump: false };
    }

    // Чем ближе конец — тем активнее атакуем
    const chance = this.deckLeft === 0
      ? 0.95
      : (this.deckLeft < 6 ? 0.8 : (this.level >= 3 ? 0.7 : 0.55));
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

    // Заливаем некозырями (младшими вперёд).
    // Козырями в дампе — только если совсем нечего, либо это добивание финала.
    const nonT = cands.filter(c => !this.isTrump(c));
    const pool = nonT.length ? nonT : cands;
    pool.sort((a, b) => this.attackValue(a) - this.attackValue(b));
    return { type: 'attack', card: pool[0], dump: true };
  }

  _decideDefense() {
    const r = this.s.round;
    const unbeaten = r.table.filter(p => p.atk && !p.def);
    if (!unbeaten.length) return { type: 'take' };
	
	// Level 1 — без перевода, без плана, 25% шанс «взять» даже при возможности отбиться
    if (this.level === 1) {
      if (Math.random() < 0.25) return { type: 'take' };

      const atk = unbeaten[0].atk;
      const cands = this.hand.filter(c => canBeat(c, atk, this.trump));
      if (!cands.length) return { type: 'take' };
      const pairIdx = r.table.findIndex(p => p.atk === atk);
      return { type: 'defense', card: cands[0], pairIdx };
    }
	
    // ---------- Перевод ----------
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
        const oppLow = this.playerHandSize <= 3;    // у оппонента почти нет карт
        const endgame = this.deckLeft === 0;        // колода пуста

        let wantTranslate = false;
        let pool = [];

        if (nonT.length) {
          // Некозырем переводить почти всегда хорошо:
          // сбрасываем мусор, атака переходит к оппоненту.
          // Level 3: 85% (агрессивно, но не всегда)
          // Level 2: 60% (осторожно)
          const p = (this.level >= 3) ? 0.85 : 0.6;
          wantTranslate = Math.random() < p;
          pool = nonT;
        } else if (trumps.length) {
          // Только козыри. Смотрим, есть ли низкие (2–10)
          const lowTrumps = trumps.filter(c => this.rank(c) < 11);

          if (!lowTrumps.length) {
            // Только J/Q/K/A-козыри — не переводим ни на каком уровне
            wantTranslate = false;
          } else if (this.level >= 3) {
            // ЭКСПЕРТ: переводит козырем ТОЛЬКО в безопасной ситуации:
            //   • у самого ≥ 4 козырей (не жалко одного)
            //   • оппонент почти без карт (заставим взять)
            //   • эндшпиль (колода пуста — любая ошибка критична)
            // И только 30% шанс, а не 60%.
            const safe = (trumpsInHand >= 4) || oppLow || endgame;
            wantTranslate = safe && Math.random() < 0.3;
            if (wantTranslate) pool = lowTrumps;
          } else if (this.level === 2) {
            // ОБЫЧНЫЙ: переводит козырем только в эндшпиле, 15% шанс.
            // В середине игры — никогда (сохраняет на финал).
            wantTranslate = endgame && Math.random() < 0.15;
            if (wantTranslate) pool = lowTrumps;
          }
        }

        if (wantTranslate && pool.length) {
          pool.sort((a, b) => this.attackValue(a) - this.attackValue(b));
          return { type: 'translate', card: pool[0] };
        }
        // если не решили переводить — идём к защите/взятию
      }
    }


    // ---------- План полной защиты ----------
    const plan = this.planDefenseAll(unbeaten);
    if (!plan) {
      // Хотя бы одну карту бить нечем — берём всё (не тратим впустую).
      return { type: 'take' };
    }

    // Если план есть, но цена слишком высокая — тоже берём.
    // Эвристика: если суммарный «вес» защиты >= 2 * козырей в руке, и при этом
    // колода ещё не пуста — берём, не разоряемся.
    const cost = plan.reduce((s, p) => s + this.attackValue(p.def), 0);
    const trumpsInHand = this.hand.filter(c => this.isTrump(c)).length;
    const cheapPlan = plan.every(p => !this.isTrump(p.def) || this.rank(p.def) < 11);

    if (!cheapPlan && this.deckLeft > 0 && trumpsInHand <= 1) {
      return { type: 'take' };
    }

    // Играем первую карту плана
    const first = plan[0];
    const pairIdx = r.table.findIndex(p => p.atk === first.atk);
    return { type: 'defense', card: first.def, pairIdx };
  }
}