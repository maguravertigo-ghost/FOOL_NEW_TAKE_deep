import { audio } from '../audio/audio_engine.js';

import { Joker } from '../ui/joker.js';
import { Card } from './card.js';
import { Deck } from './deck.js';
import { moveLinear, moveFlip, moveArkFlip } from '../core/interpolator.js';
import { REAL_W, REAL_H, SUIT_VALUE, RANK_VALUE } from './constants.js';
import { SceneLayout } from './scene_layout.js';
import { canBeat, canTranslate, canAddToTable, tableRanks } from './rules.js';
import { Marker } from '../core/marker.js';
import { ASSETS, svgInstance } from '../assets.js';

import { AI } from './ai.js';
import { GameSettings } from './settings.js';
import { Progress, saveProgress, addStylePoints, creditQuest } from './progress.js';
import { recordOutcome } from './progress.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const Z_HAND_BASE  = 100;
const Z_TABLE_BASE = 200;
const LIFT_PX      = 0.22 * REAL_H;

const CPU_TURN_PHRASES = [
  'Мой ход',
  'Моя очередь ходить',
  'Я хожу',
  'Мой черёд',
  'Теперь я хожу',
  'Ну держись!',
];

const cmpCard = (a, b) => {
  const sa = SUIT_VALUE[a.data.suit], sb = SUIT_VALUE[b.data.suit];
  if (sa !== sb) return sa - sb;
  return RANK_VALUE[a.data.rank] - RANK_VALUE[b.data.rank];
};
const cmpData = (a, b) => {
  const sa = SUIT_VALUE[a.suit], sb = SUIT_VALUE[b.suit];
  if (sa !== sb) return sa - sb;
  return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
};

export class GameSession {
  constructor(app, { skipAnimation = false, translateMode } = {}) {
    this.app = app;
    this.scene = app.scene;
    this.markers = app.markers;
    this.interp = app.interp;
    this.gameLayer = app.gameLayer;
    this.cards = app.cards;
    this.hud = app.hud;

	//this.jokerEl = null;

    this.skipAnimation = skipAnimation;
    this.translateMode = (translateMode !== undefined)
      ? translateMode
      : (SceneLayout.config.translateMode !== false);
	this.mode = this.translateMode ? 'perevodnoy' : 'podkidnoy';
	
	    // AI
    this.ai = new AI(this, { level: 2 });

    // колода — по настройкам
	const deckSize = GameSettings.deckSize || 36;
	this.deck = new Deck(String(deckSize)).shuffle();

    // статистика для погон/квестов
    this._playerLastPlays = [];
	
	this.ready = false;

    this.deckTopCard = null;    // верхняя карта — пока не построен стек
    this.stack = [];            // физический стек: [top ... bottom]
    this.trump = null;
    this.trumpCard = null;
    this.trumpTaken = false;
    this.trumpSuitEl = null;

    this.round = {
      n: 1, firstMove: 'player', attack: 'player', move: 'player',
      phase: 'A_START', table: [], anyBeaten: false,
    };

    this.selectedCard = null;
    this.slotUIs = [];
    this.slotUIsReady = false;
    this.actionBtn = null;
    this.aiMessageEl = null;
    this._busy = false;
  }

  /* ================================================================
   *  СТАРТ
   * ================================================================ */

  async start() {
    if (this.skipAnimation) {
      this._skipAll();
    } else {
      await this._createDeckVisual();
      await sleep(350);
      await this._shuffleAnimation();
      await this._initialDeal();
      await this._moveDeckToHolder();
      await this._buildDeckDepth();
      await this._showTrump();
      await this._flipPlayerCards();
    }

    this._setupSlotUIs();
    this._setupActionButton();
    this._setupAIMessage();
    this._updateHUD();
    this._updateButton();
    this._updateAIMessage();

    await sleep(300);
    this._startRound();
	this.ready = true;
// кадр уже выставлен в _startRound()
  }
  
  destroy() {
    // карты
    for (const c of this.cards) {
      if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
    }
    this.cards.length = 0;
    // UI
    for (const s of this.slotUIs) s.el.remove();
    this.slotUIs = [];
    this.slotUIsReady = false;
    if (this.actionBtn && this.actionBtn.parentNode) this.actionBtn.parentNode.removeChild(this.actionBtn);
    if (this.aiMessageEl && this.aiMessageEl.parentNode) this.aiMessageEl.parentNode.removeChild(this.aiMessageEl);
    if (this.trumpSuitEl && this.trumpSuitEl.parentNode) this.trumpSuitEl.parentNode.removeChild(this.trumpSuitEl);
    const go = document.getElementById('game-over');
    if (go) go.remove();
    // таймеры и анимации
    if (this._cpuTimer) { clearTimeout(this._cpuTimer); this._cpuTimer = null; }
    if (this.interp && typeof this.interp.cancelAll === 'function') this.interp.cancelAll();
	
if (this.joker) { this.joker.destroy(); this.joker = null; }
  }

  _totalRemaining() { return this.deck.size() + this.stack.length; }

  /* ================================================================
   *  КОЛОДА: физический стек + draw
   * ================================================================ */

  async _createDeckVisual() {
    const center = this.markers.get('center');
    const data = this.deck.draw();          // ← реальная карта
    const c = this._spawnCard(data, { x: 0, y: 0, z: 50 });
    c.attachTo(center, this.scene);
    this.deckTopCard = c;
  }

  async _buildDeckDepth() {
    const C = SceneLayout.config;
    const cw = REAL_W, ch = REAL_H;
    const deckM = this.markers.get('deck');

    // top card становится верхом стека
    const top = this.deckTopCard;
    top.marker = deckM;
    this.stack = [top];

    // добираем карты из данных, чтобы получить N-глубину
    for (let i = 1; i < C.deckStackSize && this.deck.size() > 0; i++) {
      const data = this.deck.draw();
      const c = new Card(data);
      c.setFaceUp(false);
      c.el.classList.add('card--stack-sub');
      c.marker = deckM;
      this.gameLayer.appendChild(c.el);
      this.cards.push(c);
      this.stack.push(c);
    }

    this._reflowStack();
    this.app.deckStackCards = this.stack;
  }

  _reflowStack() {
    const C = SceneLayout.config;
    const cw = REAL_W, ch = REAL_H;
    const deckM = this.markers.get('deck');
    const N = this.stack.length;
    this.stack.forEach((c, i) => {
      c.setPixelOffset(i * C.deckStackDx * cw, i * C.deckStackDy * ch);
      c.setZIndex(50 + (N - 1 - i));
      c.marker = deckM;
      c.relayout(this.scene);
    });
  }

  /** Взять верхнюю карту из стека; пополнить из данных колоды. */
  _drawCard() {
    let card;
    if (this.stack.length > 0) {
      card = this.stack.shift();
      card.marker = null;
	  card.setPixelOffset(0, 0);            // ← сброс, иначе при resize карта съедет
      card.el.classList.remove('card--stack-sub');
      this._reflowStack();

      // replenish
      if (this.deck.size() > 0) {
        const data = this.deck.draw();
        const c = new Card(data);
        c.setFaceUp(false);
        c.el.classList.add('card--stack-sub');
        c.marker = this.markers.get('deck');
        this.gameLayer.appendChild(c.el);
        this.cards.push(c);
        this.stack.push(c);
        this._reflowStack();
      }
      return card;
    }

    if (this.deck.size() > 0) {
      const data = this.deck.draw();
      const c = new Card(data);
      c.setFaceUp(false);
      c.marker = this.markers.get('deck');
      this.gameLayer.appendChild(c.el);
      this.cards.push(c);
      return c;
    }

    // последняя карта — козырь
    if (this.trumpCard && !this.trumpTaken) {
      card = this.trumpCard;
      this.trumpTaken = true;
      card.marker = null;
      this._showTrumpSuitIcon();
      return card;
    }

    return null;
  }

  _showTrumpSuitIcon() {
    if (this.trumpSuitEl) return;
    const trumpM = this.markers.get('trump');
    const el = document.createElement('div');
    el.className = 'trump-suit';
    el.style.width  = REAL_W + 'px';
    el.style.height = REAL_H + 'px';
    const svg = svgInstance(ASSETS.suits[this.trump]);
    if (svg) {
      svg.style.width  = '55%';
      svg.style.height = '55%';
      el.appendChild(svg);
    }
    this.gameLayer.appendChild(el);
    const p = this.scene.resolve(trumpM);
    el.style.left = (p.x - REAL_W / 2) + 'px';
    el.style.top  = (p.y - REAL_H / 2) + 'px';
    el.style.transformOrigin = 'center center';
    el.style.transform = `rotate(${trumpM.angle || 0}deg)`;
    this.trumpSuitEl = el;
  }

  /* ================================================================
   *  ПЕРВИЧНАЯ РАЗДАЧА
   * ================================================================ */

  async _initialDeal() {
    const playerHand = Array.from({ length: 6 }, () => this.deck.draw()).sort(cmpData);
    const cpuHand    = Array.from({ length: 6 }, () => this.deck.draw()).sort(cmpData);
    const pSlots = this.app.accordionPlayer._computeSlots(6);
    const cSlots = this.app.accordionCpu._computeSlots(6);
    const pCards = new Array(6), cCards = new Array(6);

    for (let i = 0; i < 6; i++) {
      pCards[i] = await this._dealOne(playerHand[i], pSlots[i], 'down', Z_HAND_BASE + i);
      await sleep(60);
      const si = 5 - i;
      cCards[si] = await this._dealOne(cpuHand[i], cSlots[si], 'up', Z_HAND_BASE + si);
      await sleep(60);
    }
    this.app.accordionPlayer.setCards(pCards);
    this.app.accordionCpu.setCards(cCards.sort(cmpCard));
  }

  async _dealOne(data, targetMarker, direction, zIndex) {
    const deck = this.deckTopCard;
    const dX = deck.x, dY = deck.y;
    const tX = targetMarker.x * this.scene.width;
    const tY = targetMarker.y * this.scene.height;
    const angToT = Math.atan2(tX - dX, -(tY - dY)) * 180 / Math.PI;
    await this._tweenDeckAngle(angToT, 90);
    const startAngle = deck.angle;
    const endAngle   = targetMarker.angle || 0;
    const delta      = pickDelta(startAngle, endAngle, direction);
    const c = this._spawnCard(data, { x: dX, y: dY, z: zIndex });
	audio.playSfx('cardFly')
    c.setAngle(startAngle);
    c.setFaceUp(false);
    await new Promise(r => {
      this.interp.add({
        elapsed: 0, duration: 340,
        update: k => {
          const e = 1 - (1 - k) * (1 - k);
          c.setPosition(dX + (tX - dX) * e, dY + (tY - dY) * e);
          c.setAngle(startAngle + delta * e);
        },
        onDone: r,
      });
    });
    c.attachTo(targetMarker, this.scene);
	audio.playSfx('card_deal');             // ← приземление в руку
    return c;
  }

  _tweenDeckAngle(target, duration) {
    return new Promise(r => {
      const c = this.deckTopCard;
      const from = c.angle;
      let to = target;
      while (to - from >  180) to -= 360;
      while (to - from < -180) to += 360;
      this.interp.add({
        elapsed: 0, duration,
        update: k => {
          const e = 1 - (1 - k) * (1 - k);
          c.setAngle(from + (to - from) * e);
        },
        onDone: r,
      });
    });
  }

  async _moveDeckToHolder() {
    const deckM = this.markers.get('deck');
    const dstX = deckM.x * this.scene.width;
    const dstY = deckM.y * this.scene.height;
    const c = this.deckTopCard;
    const sX = c.x, sY = c.y, sA = c.angle;
    c.marker = null;
	
    audio.playSfx('card_fly');              // ← старт полёта
	
    await new Promise(r => {
      this.interp.add({
        elapsed: 0, duration: 480,
        update: k => {
          const e = 1 - (1 - k) * (1 - k);
          c.setPosition(sX + (dstX - sX) * e, sY + (dstY - sY) * e);
          c.setAngle(sA * (1 - e));
        },
        onDone: r,
      });
    });
    c.marker = deckM;
    c.setPixelOffset(0, 0);
    c.setAngle(0);
    c.relayout(this.scene);
	
    audio.playSfx('card_hit');              // ← приземление
  }

  /* ================================================================
   *  КОЗЫРЬ
   * ================================================================ */

  async _showTrump() {
    const card = this._drawCard();
    if (!card) return;

    this.trump = card.data.suit;
    this.trumpCard = card;

    const deckM  = this.markers.get('deck');
    const arkM   = this.markers.get('ark');
    const subM   = this.markers.get('sub_ark');
    const trumpM = this.markers.get('trump');

    // карта уже на месте колоды (или где-то рядом после refill)
    const dX = card.x, dY = card.y;
    card.setZIndex(900);
    card.setFaceUp(false);

	// 1 → 2: ARK + FLIP
	audio.playSfx('card_fly');               // ← вылет из колоды
	await new Promise(r => {
	  const dMarker = new Marker(dX / this.scene.width, dY / this.scene.height, 'tmp', 0);
	  moveArkFlip(this.interp, card, this.scene, dMarker, arkM, { toFaceUp: true, onDone: r });
	});

    card.setZIndex(45);
	audio.playSfx('card_fly');
    await new Promise(r => moveLinear(this.interp, card, this.scene, arkM, subM, {
      fromAngle: 0, toAngle: 0, onDone: r,
    }));

    await new Promise(r => moveLinear(this.interp, card, this.scene, subM, trumpM, {
      fromAngle: 0, toAngle: 90, onDone: r,
    }));

	card.marker = trumpM;
	card.setAngle(90);
	audio.playSfx('card_hit');               // ← приземление под колодой
  }

  async _flipPlayerCards() {
    for (const c of this.app.accordionPlayer.cards) {
      await new Promise(r => moveFlip(this.interp, c, { onDone: r }));
      await sleep(40);
    }
  }

  /* ================================================================
   *  РАУНД
   * ================================================================ */

  _startRound() {
    const r = this.round;
    r.attack = r.firstMove;
    r.move = r.attack;
    r.phase = 'A_START';
    r.table = [];
    r.anyBeaten = false;

    console.log(`[round ${r.n}] start  attack=${r.attack}  firstMove=${r.firstMove}`);
    this._updateHUD();
    this._updateButton();
    this._updateAIMessage();
    this._updateHandOverlays();

    if (r.move === 'cpu') {
	  this._jokerFrame('five');        // джокер ходит
	  this._scheduleCpu();
	}
  }

  async _endRound(action) {
    if (this._busy) return;
    this._busy = true;

    const r = this.round;
    const defender = (r.attack === 'player') ? 'cpu' : 'player';

    this._clearSlotHighlights();
    this._deselect();
    for (const c of this.app.accordionPlayer.cards) c.setOverlay(false);

    const allCards = [];
    for (const pair of r.table) {
      if (pair.atk) allCards.push(pair.atk);
      if (pair.def) allCards.push(pair.def);
    }

    console.log(`[round ${r.n}] end  action=${action}  defender=${defender}`);

    if (action === 'take') {
      await this._animateTake(allCards, defender);
      // Жетон атаки остаётся у того, кто сейчас атакует (мог поменяться
      // из-за переводов внутри раунда)
      r.firstMove = r.attack;
    } else {
		audio.playSfx('cardDiscard')
      await this._animateDiscard(allCards);
      // Защита отбилась — становится первой рукой следующего раунда
      r.firstMove = defender;
    }

    r.table = [];
    r.phase = 'END';
    this._updateHUD();
    this._updateButton();
    this._updateAIMessage();

    await sleep(250);
    await this._refillHands();
    this._updateHUD();
    this._busy = false;

    const winner = this._checkGameEnd();
    if (winner) { this._showGameOver(winner); return; }

    r.n++;
    this._startRound();
  }

  /**
   * Взять карты со стола.
   *  • defender = 'player' — карты остаются открытыми (мы их видим).
   *  • defender = 'cpu'    — карты переворачиваются рубашкой вверх,
   *                           чтобы игрок не видел руки оппонента.
   */
async _animateTake(cards, defender) {
  if (cards.length === 0) return;
  audio.playSfx('card_deal');

  // эмоция джокера: если AI не смог отбиться — sad+give_up,
  // если игрок не смог — AI доволен, ok
	if (defender === 'cpu') this._jokerFrame('give_up');
	else                    this._jokerFrame('ok');

  const acc = defender === 'player' ? this.app.accordionPlayer : this.app.accordionCpu;

    // 1. Для CPU — карты сначала переворачиваем рубашкой вверх (игрок не видит)
    if (defender === 'cpu') {
      for (const c of cards) {
        c.marker = null;
        c.setPixelOffset(0, 0);
        if (c.faceUp) {
          if (this.skipAnimation) c.setFaceUp(false);
          else await new Promise(r => moveFlip(this.interp, c, { toFaceUp: false, onDone: r }));
        }
      }
    } else {
      // Для игрока — оставляем открытыми
      for (const c of cards) {
        c.setPixelOffset(0, 0);
        if (!c.faceUp) c.setFaceUp(true);
      }
    }

    // 2. skip — сразу в руку
    if (this.skipAnimation) {
      for (const c of cards) {
        c.marker = null;
        acc.cards.push(c);
      }
      acc.cards.sort(cmpCard);
      acc.layoutInstant();
      return;
    }

    // 3. Анимация: индивидуально на линию вставки → в руку с раздвиганием
    await acc.takeFromTable(cards, { stagger: 90, settleDelay: 250 });
  }

  /**
   * Отбой: сначала все карты параллельно (со stagger) переворачиваются
   * рубашкой вниз на месте, затем летят в зону отбоя со случайным
   * офсетом и углом.
   */
  async _animateDiscard(cards) {
    if (cards.length === 0) return;
    const discM = this.markers.get('discard');
    const STAGGER = 60;   // мс между стартом переворотов (каскад)

    // 1. Параллельный flip со stagger — карты переворачиваются почти
    //    одновременно, но с ощутимым каскадом
	audio.playSfx('card_discard');
    await Promise.all(cards.map((c, i) => new Promise(resolve => {
      c.marker = null;
      if (this.skipAnimation) { c.setFaceUp(false); resolve(); return; }
      if (!c.faceUp) { resolve(); return; }
      setTimeout(() => {
        moveFlip(this.interp, c, { toFaceUp: false, onDone: resolve });
      }, i * STAGGER);
    })));

    // 2. Полёт в отбой — параллельно, с минимальным stagger
    await Promise.all(cards.map((c, i) => new Promise(resolve => {
      const offX = (Math.random() - 0.5) * REAL_W * 0.9;
      const offY = (Math.random() - 0.5) * REAL_H * 0.9;
      const ang  = (Math.random() - 0.5) * 60;
      const fromM = new Marker(c.x / this.scene.width, c.y / this.scene.height,
                               'from', c.angle);
      const toM = new Marker(
        (discM.x * this.scene.width + offX) / this.scene.width,
        (discM.y * this.scene.height + offY) / this.scene.height,
        `disc_${c.uid}`, ang
      );
      c.marker = null;
      setTimeout(() => {
        if (this.skipAnimation) {
          c.setPosition(toM.x * this.scene.width, toM.y * this.scene.height);
          c.setAngle(ang);
          c.setZIndex(30);
          c.marker = toM;
          resolve();
          return;
        }
        moveLinear(this.interp, c, this.scene, fromM, toM, {
          fromAngle: c.angle, toAngle: ang,
          onDone: () => { c.setZIndex(30); resolve(); },
        });
      }, i * 40);
    })));
  }

  async _refillHands() {
    const r = this.round;
    const order = [r.firstMove, (r.firstMove === 'player') ? 'cpu' : 'player'];

    for (const who of order) {
      const acc = who === 'player' ? this.app.accordionPlayer : this.app.accordionCpu;

      const toAdd = [];
      while (acc.cards.length + toAdd.length < 6) {
        const card = this._drawCard();
        if (!card) break;
        card.setFaceUp(false);              // ← всегда рубашкой вниз
        card.marker = null;
        card.setPixelOffset(0, 0);
        if (this.skipAnimation) {
          card.setZIndex(Z_HAND_BASE + acc.cards.length + toAdd.length);
        } else {
          // 1000 — выше колоды и стола; первая выше, следующая ниже
          card.setZIndex(1000 + 500 - toAdd.length);
        }
        toAdd.push(card);
      }
      if (toAdd.length === 0) continue;

      if (this.skipAnimation) {
        // Мгновенно: сразу в руку, лицом к игроку (или рубашкой для CPU)
        for (const c of toAdd) {
          c.setFaceUp(who === 'player');
          acc.cards.push(c);
        }
        acc.cards.sort(cmpCard);
        acc.layoutInstant();
      } else {
        const deckMarker = this.markers.get('deck');
        await acc.stageAndInsert(toAdd, deckMarker, {
          stagger:     160,
          settleDelay: 220,
          reveal:      who === 'player',
          flipMode:    who === 'player' ? 'sequential' : 'immediate',
          flipDelay:   50,
        });
      }
    }
    this.app.deckStackCards = this.stack;
  }

  _checkGameEnd() {
    if (this._totalRemaining() > 0) return null;
    const p = this.app.accordionPlayer.cards.length;
    const c = this.app.accordionCpu.cards.length;
    if (p === 0 && c === 0) return 'draw';
    if (p === 0) return 'player';
    if (c === 0) return 'cpu';
    return null;
  }

  _showGameOver(winner) {
    if (document.getElementById('game-over')) return;

    // ---- считаем награды ----
    let points = 0;
    if (winner === 'player'){ points = 100; audio.playSfx('win')}
    if (winner === 'cpu'){ audio.playSfx('lose')}
    if (winner === 'draw'){ audio.playSfx('draw')}

    let epaulettes = false;
    if (winner === 'player' && this._playerLastPlays.length >= 2) {
      const last2 = this._playerLastPlays.slice(-2);
      if (last2.every(p => p.card.data.rank === '6')) {
        epaulettes = true;
        points += 250;
      }
    }

    let questRank = null;
    if (winner === 'player') {
      const counts = {};
      for (const p of this._playerLastPlays) {
        const rk = p.card.data.rank;
        counts[rk] = (counts[rk] || 0) + 1;
      }
      for (const rk in counts) {
        if (counts[rk] >= 2) {
          creditQuest(rk, counts[rk]);
          questRank = rk;
        }
      }
    }

// эмоция джокера в конце матча// эмоция джокера в конце матча
if (winner === 'player')       this._jokerFrame('sad');   // джокер проиграл
else if (winner === 'cpu')     this._jokerFrame('nice');  // джокер победил
else                           this._jokerFrame('five');  // ничья

    if (points > 0) addStylePoints(points);
    recordOutcome(winner);

    // ---- HTML ----
    const el = document.createElement('div');
    el.id = 'game-over';
    const title = winner === 'player' ? 'Победа!' :
                  winner === 'cpu'    ? 'Поражение' : 'Ничья';
    const sub   = winner === 'player' ? 'CPU — дурак' :
                  winner === 'cpu'    ? 'Ты — дурак' : '';
    const epi   = epaulettes ? `<div class="game-over__epi">🔥 Погоны! +250</div>` : '';
    const quest = questRank ? `<div class="game-over__quest">Квест «${questRank}» выполнен — не забудьте забрать награду</div>` : '';
    const pts   = `<div class="game-over__points">Получено очков стиля: <b>${points}</b></div>`;

	// джокер
	let jokerSrc = null;
	if (winner === 'player')      jokerSrc = ASSETS.jokerWin;
	else if (winner === 'cpu')    jokerSrc = ASSETS.jokerLose;
	else                          jokerSrc = ASSETS.jokerDraw;

	const jokerHTML = jokerSrc
	  ? `<div class="game-over__joker"><img src="${jokerSrc}" alt=""></div>`
	  : '';

    el.innerHTML = `<div class="game-over__box">
      ${jokerHTML}
      <div class="game-over__content">
        <div class="game-over__title">${title}</div>
        <div class="game-over__sub">${sub}</div>
        ${epi}
        ${pts}
        ${quest}
        <button class="pause-btn" data-action="replay">СЫГРАТЬ ЕЩЁ РАЗ</button>
        <button class="pause-btn pause-btn--danger" data-action="menu">ВЫЙТИ В МЕНЮ</button>
      </div>
    </div>`;
    document.body.appendChild(el);

	el.querySelector('[data-action="replay"]').addEventListener('click', () => {
	  audio.playSfx('tap');
	  if (this._goReplay) return;
	  this._goReplay = true;
	  if (this.app && typeof this.app._playAgain === 'function') {
		this.app._playAgain(this.mode);
	  }
	});
	el.querySelector('[data-action="menu"]').addEventListener('click', () => {
	  audio.playSfx('tap_up');
	  if (this._goMenu) return;
	  this._goMenu = true;
	  if (this.app && typeof this.app._exitToMenu === 'function') {
		this.app._exitToMenu();
	  }
	});

    console.log('[game over]', winner, { points, epaulettes, questRank });
  }

  /* ================================================================
   *  ХОДЫ
   * ================================================================ */

  async _playAttackCard(card, byWho, dumpMode = false) {
    const r = this.round;
    const idx = r.table.length;
    if (idx >= 6) return;

    // Нельзя подкидывать, если защитник без карт
    if (this._defenderHandSize() === 0) {
      console.log(`[${byWho}] attack blocked — defender empty`);
      return;
    }

    const slotM = this.markers.get(`table_atk_${idx}`);
    const acc = byWho === 'player' ? this.app.accordionPlayer : this.app.accordionCpu;
    acc.extractCard(card);

	audio.playSfx('card_fly');       // ← добавить

    this._busy = true;
    await this._moveCardTo(card, slotM, { duration: 320 });
	audio.playSfx('card_hit');
    this._busy = false;
	this._jokerFrameName = null;

    card.setZIndex(Z_TABLE_BASE + idx * 2);
    card.setFaceUp(true);
    r.table.push({ atk: card, def: null });

    console.log(`[${byWho}] attack ${card.data.rank}${card.data.suit}  slot=${idx}`);
	
	if (byWho === 'player') this._playerLastPlays.push({ card, type: 'atk' });

    if (idx + 1 >= 6) {
      this._updateHUD();
      this._endRound('discard');
      return;
    }

    if (dumpMode) {
      this._updateHUD();
      this._updateButton();
      this._updateAIMessage();
      if (r.move === 'cpu') this._scheduleCpu();
      return;
    }

	r.phase = 'D_ACT';
	r.move = (byWho === 'player') ? 'cpu' : 'player';
	if (byWho === 'cpu') this._jokerFrame('five');    // джокер атакует
	this._updateHUD();
	this._updateButton();
	this._updateAIMessage();
	this._updateHandOverlays();
	this._clearSlotHighlights();

	if (r.move === 'cpu') this._scheduleCpu();
  }

  async _playDefenseCard(card, pairIdx, byWho) {
    const r = this.round;
    const slotM = this.markers.get(`table_def_${pairIdx}`);
    const acc = byWho === 'player' ? this.app.accordionPlayer : this.app.accordionCpu;
    acc.extractCard(card);
	audio.playSfx('card_fly');       // ← добавить

    this._busy = true;
    await this._moveCardTo(card, slotM, { duration: 320 });
	audio.playSfx('card_hit');
    this._busy = false;

    card.setZIndex(Z_TABLE_BASE + pairIdx * 2 + 1);
    card.setFaceUp(true);
    r.table[pairIdx].def = card;
    r.anyBeaten = true;

    console.log(`[${byWho}] defense ${card.data.rank}${card.data.suit}  slot=${pairIdx}`);
	
	if (byWho === 'player') this._playerLastPlays.push({ card, type: 'def' });

    // Остались ещё неотбитые карты?
    const stillUnbeaten = r.table.some(p => p.atk && !p.def);

	if (stillUnbeaten) {
	  r.phase = 'D_ACT';
	  r.move  = byWho;
	} else {
	  r.phase = 'A_ADD';
	  r.move  = r.attack;
	}

	// эмоции джокера
	if (byWho === 'player') {
	  this._jokerFrame('nice');       // игрок отбился от хода джокера
	} else if (byWho === 'cpu') {
	  this._jokerFrame(r.move === 'player' ? 'five' : 'ok');
	}

	this._updateHUD();
    this._updateButton();
    this._updateAIMessage();
    this._updateHandOverlays();
    this._clearSlotHighlights();

	if (byWho === 'cpu') this._jokerFrame('five');

    if (r.move === 'cpu') this._scheduleCpu();
  }

  async _translateCard(card, byWho) {
    if (!this.translateMode) {
      console.warn(`[${byWho}] translate BLOCKED (podkidnoy mode)`);
      return;
    }
    const r = this.round;
    const idx = r.table.length;
    const slotM = this.markers.get(`table_atk_${idx}`);
    const acc = byWho === 'player' ? this.app.accordionPlayer : this.app.accordionCpu;
    acc.extractCard(card);
	audio.playSfx('card_fly');       // ← добавить

    this._busy = true;
    await this._moveCardTo(card, slotM, { duration: 320 });
	audio.playSfx('card_hit');
    this._busy = false;

    card.setZIndex(Z_TABLE_BASE + idx * 2);
    card.setFaceUp(true);
    r.table.push({ atk: card, def: null });

    console.log(`[${byWho}] translate ${card.data.rank}${card.data.suit}`);
	
	if (byWho === 'player') this._playerLastPlays.push({ card, type: 'trans' });

    const oldAttack = r.attack;
    r.attack = byWho;
    r.move   = oldAttack;
	r.phase  = 'D_ACT';

	if (byWho === 'cpu') this._jokerFrame('ok');   // джокер перевёл игроку

	this._updateHUD();
    this._updateButton();
    this._updateAIMessage();
    this._updateHandOverlays();
    this._clearSlotHighlights();

    if (r.move === 'cpu') this._scheduleCpu();
  }

	_defenderTake(side) {
	  const r = this.round;
	  console.log(`[${side}] take`);
	  if (side === 'cpu') this._jokerFrame('sad');    // ← добавлено
	  r.phase = 'A_DUMP';
	  r.move  = r.attack;
	  this._updateButton();
	  this._updateAIMessage();
	  this._updateHandOverlays();
	  if (r.move === 'cpu') this._scheduleCpu();
	}
  _attackerPass() { this._endRound('discard'); }
  _attackerDone() { this._endRound('take'); }

  onPause() {
    this._paused = true;
    if (this._cpuTimer) {
      clearTimeout(this._cpuTimer);
      this._cpuTimer = null;
    }
  }

  onResume() {
    this._paused = false;
    if (this.round && this.round.move === 'cpu' && !this._busy) {
      this._scheduleCpu();
    }
  }

  /* ================================================================
   *  CPU
   * ================================================================ */

  _scheduleCpu() {
	if (this._paused) return;
    if (this._cpuTimer) clearTimeout(this._cpuTimer);
    this._cpuTimer = setTimeout(() => {
      this._cpuTimer = null;
      this._cpuAct();
    }, 480);
  }

  _cpuAct() {
    if (this._paused) return;
    const r = this.round;
    if (r.move !== 'cpu' || this._busy) return;

    const action = this.ai.decide();
    if (!action) return;

switch (action.type) {
  case 'attack':
    this._playAttackCard(action.card, 'cpu', !!action.dump);
    return;
  case 'defense':
    this._playDefenseCard(action.card, action.pairIdx, 'cpu');
    return;
  case 'translate':
    this._translateCard(action.card, 'cpu');
    return;
  case 'pass':
    this._attackerPass();
    return;
  case 'take':
    this._defenderTake('cpu');
    return;
  case 'done':
    this._attackerDone();
    return;
}
  }

  /* ================================================================
   *  ВВОД
   * ================================================================ */

  handleClick(x, y) {
    if (!this.ready) return;
	if (this._paused) return;
    if (this._busy) return;
    const r = this.round;
    if (r.move !== 'player' || r.phase === 'END') return;

    const slot = this._hitSlotUI(x, y);
    if (slot && this.selectedCard) { this._confirmSlot(slot); return; }

    const card = this._handCardAt(x, y);
    if (!card) return;
    if (card === this.selectedCard) { this._deselect(); return; }
    if (card.overlayEl.style.display === 'block') return;

    this._deselect();
    this._selectCard(card);
  }

  _handCardAt(x, y) {
    let best = null, bestZ = -Infinity;
    for (const c of this.app.accordionPlayer.cards) {
      if (!c.hitTest(x, y)) continue;
      const z = Number(c.el.style.zIndex) || 0;
      if (z > bestZ) { bestZ = z; best = c; }
    }
    return best;
  }

  _selectCard(card) {
    const r = this.round;
    this.selectedCard = card;
	audio.playSfx('card_selection');
    card.setPixelOffset(0, -LIFT_PX);
    card.relayout(this.scene);
    card.setZIndex(700);
    this._clearSlotHighlights();

    if (r.phase === 'A_START' || r.phase === 'A_ADD' || r.phase === 'A_DUMP') {
      const defSize = this._defenderHandSize();
      if (defSize === 0) {
        // нечего отбивать — слот не подсвечиваем
        return;
      }
      this._showSlotUI('atk', r.table.length);
    } else if (r.phase === 'D_ACT') {
      const idx = r.table.findIndex(p => !p.def);
      if (idx >= 0) {
        const atk = r.table[idx].atk;
        if (canBeat(card, atk, this.trump)) this._showSlotUI('def', idx);
        if (this._canTranslate(card, atk, 'player', r))
          this._showSlotUI('atk', r.table.length);
      }
    }
  }

  _deselect() {
    if (!this.selectedCard) return;
	audio.playSfx('card_selection');
    this.selectedCard.setPixelOffset(0, 0);
    this.selectedCard.relayout(this.scene);
    this.app.accordionPlayer._applyZ();
    this.selectedCard = null;
    this._clearSlotHighlights();
  }

  _confirmSlot(slot) {
    const card = this.selectedCard;
    if (!card) return;

    this.selectedCard = null;
    this._clearSlotHighlights();
    card.setPixelOffset(0, 0);
    card.relayout(this.scene);

    const r = this.round;

    // В фазе D_ACT клик по atk-слоту = перевод, по def-слоту = отбой
    if (r.phase === 'D_ACT') {
      if (slot.kind === 'def') {
        this._playDefenseCard(card, slot.index, 'player');
      } else if (slot.kind === 'atk') {
        this._translateCard(card, 'player');
      }
      return;
    }

    // В фазах атаки — обычный ход, но только если защитнику есть чем отбивать
    if (slot.kind === 'atk') {
      if (this._defenderHandSize() === 0) return;   // защита от race
      this._playAttackCard(card, 'player', r.phase === 'A_DUMP');
    }
  }

  /* ================================================================
   *  UI — слоты, кнопка, сообщения
   * ================================================================ */

  _setupSlotUIs() {
    if (this.slotUIsReady) return;
    for (const kind of ['atk', 'def']) {
      for (let i = 0; i < 6; i++) {
        const marker = this.markers.get(`table_${kind}_${i}`);
        const el = document.createElement('div');
        el.className = 'slot-ui';
        this.gameLayer.appendChild(el);
        const s = {
          kind, index: i, marker, el, active: false,
          relayout: () => {
            const p = this.scene.resolve(marker);
            el.style.left = (p.x - REAL_W / 2) + 'px';
            el.style.top  = (p.y - REAL_H / 2) + 'px';
            el.style.width  = REAL_W + 'px';
            el.style.height = REAL_H + 'px';
            el.style.transformOrigin = 'center center';
            el.style.transform = `rotate(${marker.angle || 0}deg)`;
          },
          show: () => { s.active = true;  el.classList.add('slot-ui--active'); },
          hide: () => { s.active = false; el.classList.remove('slot-ui--active'); },
        };
        s.relayout();
        this.slotUIs.push(s);
      }
    }
    this.slotUIsReady = true;
  }

  _showSlotUI(kind, index) {
    const s = this.slotUIs.find(x => x.kind === kind && x.index === index);
    if (s) s.show();
  }
  _clearSlotHighlights() { for (const s of this.slotUIs) s.hide(); }

  /**
   * Проверить, может ли `card` перевести `atk` из позиции защитника `side`.
   * Учитывает правило: у оппонента после перевода должно хватать карт на отбой.
   */
  _canTranslate(card, atk, side, r) {
    if (!this.translateMode) return false;
    const tableHasDef = r.table.some(p => p.def);
    const unbeatenCount = r.table.filter(p => !p.def).length;
    const oppAcc = (side === 'player') ? this.app.accordionCpu : this.app.accordionPlayer;
    const opponentHandSize = oppAcc.cards.length;
    return canTranslate(card, atk, tableHasDef, { unbeatenCount, opponentHandSize });
  }

  /** Кто сейчас в защите (противоположный атакующему). */
  _defenderSide() {
    return (this.round.attack === 'player') ? 'cpu' : 'player';
  }

  /** Размер руки защитника в текущем раунде. */
  _defenderHandSize() {
    const side = this._defenderSide();
    const acc = side === 'player' ? this.app.accordionPlayer : this.app.accordionCpu;
    return acc.cards.length;
  }

  _hitSlotUI(x, y) {
    for (const s of this.slotUIs) {
      if (!s.active) continue;
      const p = this.scene.resolve(s.marker);
      if (Math.abs(x - p.x) <= REAL_W / 2 && Math.abs(y - p.y) <= REAL_H / 2) return s;
    }
    return null;
  }

  _setupActionButton() {
    const btn = document.createElement('button');
    btn.id = 'action-btn';
    btn.disabled = true;
    btn.addEventListener('click', () => this._onActionButtonClick());
    document.body.appendChild(btn);
    this.actionBtn = btn;
    btn.style.display = 'block';
    this._repositionActionButton();
  }

_setupAIMessage() {
  this.joker = new Joker();

  const el = document.createElement('div');
  el.id = 'ai-message';
  document.body.appendChild(el);
  this.aiMessageEl = el;
  this._repositionActionButton();
}

_repositionActionButton() {
  if (!this.actionBtn || !this.aiMessageEl) return;
  const W = this.scene.width, H = this.scene.height;
  const C = SceneLayout.config;
  const R = W - C.frameR * W;
  const discard = this.markers.tryGet('discard');
  if (!discard) return;
  const yPx = discard.y * H;

  const bw = REAL_W * 2.65;             // ширина облачка = кнопки игрока
  // Высота облачка — пропорция облачка картинки (642×264)
  const aiH = Math.round(bw * 264 / 642);
  const btnH = REAL_H;

  const jokerRight = W - R;
  const jokerCx    = W - jokerRight - bw / 2;
  const jokerLeft  = jokerCx - bw / 2;

  // --- Кнопка игрока ---
  const btnTop = yPx + 40;
  this.actionBtn.style.left   = jokerLeft + 'px';
  this.actionBtn.style.top    = btnTop + 'px';
  this.actionBtn.style.width  = bw + 'px';
  this.actionBtn.style.height = btnH + 'px';

  // --- Облачко (оно же aiMessageEl) ---
  const aiTop = yPx - 30 - aiH;
  this.aiMessageEl.style.left   = jokerLeft + 'px';
  this.aiMessageEl.style.width  = bw + 'px';
  this.aiMessageEl.style.height = aiH + 'px';
  this.aiMessageEl.style.top    = aiTop + 'px';
  this.aiMessageEl.style.lineHeight = '1.15';
  this.aiMessageEl.style.padding = '8px 12px';
  this.aiMessageEl.style.fontSize = '16px';
  this.aiMessageEl.style.display = 'flex';
  this.aiMessageEl.style.alignItems = 'center';
  this.aiMessageEl.style.justifyContent = 'center';

  // --- Джокер ---
  if (this.joker) {
    this.joker.setCloudRect({
      left:   jokerLeft,
      top:    aiTop,
      width:  bw,
      height: aiH,
    });
  }
}

  _updateButton() {
    if (!this.actionBtn) return;
    const r = this.round;
    let label = 'Мой ход', enabled = false;

    if (r.move === 'player') {
      if (r.phase === 'A_ADD' || r.phase === 'A_DUMP') { label = 'ПАС'; enabled = true; }
      else if (r.phase === 'D_ACT') { label = 'БЕРУ'; enabled = true; }
      // A_START — «Мой ход», disabled
    } else {
      if (r.phase === 'D_ACT') label = 'БЕРУ';
      else if (r.phase === 'A_ADD' || r.phase === 'A_DUMP') label = 'ПАС';
    }

    this.actionBtn.textContent = label;
    this.actionBtn.disabled = !enabled;
  }

_jokerFrame(name) {
  if (!this.joker) return;
  if (this._jokerFrameName === name) return;
  this._jokerFrameName = name;
  this.joker.setEmotion(name);
}

  _updateAIMessage() {
    if (!this.aiMessageEl) return;
    const r = this.round;
    let text = '...';

    if (r.move === 'cpu') {
      if (r.phase === 'A_START' || r.phase === 'A_ADD' || r.phase === 'A_DUMP') {
        if (!this._cpuTurnPhrase || this._cpuTurnPhraseAt !== r.n + ':' + r.phase) {
          this._cpuTurnPhrase = CPU_TURN_PHRASES[
            Math.floor(Math.random() * CPU_TURN_PHRASES.length)
          ];
          this._cpuTurnPhraseAt = r.n + ':' + r.phase;
        }
        text = this._cpuTurnPhrase;
      } else if (r.phase === 'D_ACT') {
        text = '...';
      }
    } else {
      if (r.phase === 'A_DUMP' && r.attack === 'player') text = 'Забираю, подкидывай';
      else text = '...';
    }

    this.aiMessageEl.textContent = text;
// display уже 'flex' из _repositionActionButton — не перезаписываем
  }

  _onActionButtonClick() {
	  
    if (!this.actionBtn || this.actionBtn.disabled) return;
	
    const r = this.round;
    if (r.move !== 'player') return;
    const label = this.actionBtn.textContent;
	audio.playSfx('button_click');
    if (label === 'БЕРУ') this._defenderTake('player');
    else if (label === 'ПАС') {
      if (r.phase === 'A_DUMP') this._attackerDone();
      else this._attackerPass();
    }
  }

  _updateHUD() {
    if (!this.hud) return;
    const cpuAcc = this.app.accordionCpu;
    const cpuHand = cpuAcc ? cpuAcc.cards.map(c => c.data) : [];
    this.hud.set({
      round: this.round.n,
      firstMove: this.round.firstMove,
      attack: this.round.attack,
      move: this.round.move,
      deckLeft: this._totalRemaining() + (this.trumpTaken ? 0 : 1),
      cpuHand,
    });
    // HUD виден только в дебаге
    if (this.app.debug) this.hud.setHidden(!this.app.debug.enabled);
  }

  _updateHandOverlays() {
    const r = this.round;
    const acc = this.app.accordionPlayer;
    if (r.move !== 'player' || r.phase === 'END') {
      for (const c of acc.cards) c.setOverlay(true);
      return;
    }
    if (r.phase === 'A_START' || r.phase === 'A_ADD' || r.phase === 'A_DUMP') {
      const defSize = this._defenderHandSize();
      const tR = tableRanks(r.table);
      const isFirst = (r.phase === 'A_START');
      for (const c of acc.cards) {
        let legal;
        if (r.phase === 'A_DUMP') {
          legal = canAddToTable(c, tR) && r.table.length < Math.min(6, defSize);
        } else {
          // A_START / A_ADD — у защитника должна быть хотя бы одна карта
          legal = (isFirst || canAddToTable(c, tR)) && defSize > 0;
        }
        c.setOverlay(!legal);
      }
    } else if (r.phase === 'D_ACT') {
      const idx = r.table.findIndex(p => !p.def);
      const atk = idx >= 0 ? r.table[idx].atk : null;
      for (const c of acc.cards) {
        const beat  = atk && canBeat(c, atk, this.trump);
        const trans = atk && this._canTranslate(c, atk, 'player', r);
        c.setOverlay(!(beat || trans));
      }
    }
  }

  /* ================================================================
   *  Анимация одиночной карты
   * ================================================================ */

  _moveCardTo(card, marker, { duration = 320 } = {}) {
    const tX = marker.x * this.scene.width;
    const tY = marker.y * this.scene.height;
    const tA = marker.angle || 0;
    const fromX = card.x, fromY = card.y, fromA = card.angle;

    card.setPixelOffset(0, 0);
    card.marker = null;

    if (this.skipAnimation) {
      card.setPosition(tX, tY);
      card.setAngle(tA);
      card.marker = marker;
      return Promise.resolve();
    }

    return new Promise(r => {
      this.interp.add({
        elapsed: 0, duration,
        update: k => {
          const e = 1 - (1 - k) * (1 - k);
          card.setPosition(fromX + (tX - fromX) * e, fromY + (tY - fromY) * e);
          card.setAngle(fromA + (tA - fromA) * e);
        },
        onDone: () => {
          card.marker = marker;
          card.setPosition(tX, tY);
          card.setAngle(tA);
          r();
        },
      });
    });
  }

  /* ================================================================
   *  Мгновенная отрисовка (skip mode)
   * ================================================================ */

  _skipAll() {
    const playerHand = Array.from({ length: 6 }, () => this.deck.draw()).sort(cmpData);
    const cpuHand    = Array.from({ length: 6 }, () => this.deck.draw()).sort(cmpData);

    const pCards = playerHand.map((d, i) => {
      const c = this._spawnCard(d, { x: 0, y: 0, z: Z_HAND_BASE + i });
      c.setFaceUp(true); return c;
    });
    const cCards = cpuHand.map((d, i) => {
      const c = this._spawnCard(d, { x: 0, y: 0, z: Z_HAND_BASE + i });
      c.setFaceUp(false); return c;
    });
    this.app.accordionPlayer.setCards(pCards);
    this.app.accordionCpu.setCards(cCards);

    // стек колоды
    const C = SceneLayout.config;
    const cw = REAL_W, ch = REAL_H;
    const deckM = this.markers.get('deck');

    const topData = this.deck.draw();
    const top = this._spawnCard(topData, { x: 0, y: 0, z: 50 + C.deckStackSize - 1 });
    top.marker = deckM;
    this.stack = [top];

    for (let i = 1; i < C.deckStackSize && this.deck.size() > 0; i++) {
      const data = this.deck.draw();
      const c = this._spawnCard(data, { x: 0, y: 0 });
      c.el.classList.add('card--stack-sub');
      c.marker = deckM;
      this.stack.push(c);
    }
    this._reflowStack();
    this.app.deckStackCards = this.stack;

    // козырь
    const trumpData = this.deck.draw();
    this.trump = trumpData.suit;
    const trumpM = this.markers.get('trump');
    const trump = this._spawnCard(trumpData, { x: 0, y: 0, z: 45 });
    trump.setFaceUp(true);
    trump.marker = trumpM;
    trump.relayout(this.scene);
    this.trumpCard = trump;

    if (this.app.debug) this.app.debug.requestRender();
  }

  _spawnCard(data, { x = 0, y = 0, z } = {}) {
    const c = new Card(data);
    c.setFaceUp(false);
    c.setPosition(x, y);
    if (z !== undefined) c.setZIndex(z);
    this.gameLayer.appendChild(c.el);
    this.cards.push(c);
    return c;
  }

  /* ================================================================
   *  SHUFFLE ANIMATION (без изменений)
   * ================================================================ */

  async _shuffleAnimation() {
	audio.playSfx('card_shuffle');
	  
    const center = this.markers.get('center');
    const cx = center.x * this.scene.width;
    const cy = center.y * this.scene.height;
    const cardCount = 3, passes = 3, duration = 2200, spawnInterval = 420;
    const ampX = this.scene.width * 0.10, ampY = this.scene.height * 0.05;
    const deckZ = 50, collapseStart = 0.7, phaseRamp = 0.15;
    const DUMMY = { rank: 'A', suit: 'spades' };

    const promises = [];
    for (let i = 0; i < cardCount; i++) {
      promises.push(new Promise(resolve => {
        setTimeout(() => {
          const c = this._spawnCard(DUMMY, { x: cx, y: cy, z: deckZ + 1 });
		  audio.playSfx('card_fly');
          c.setAngle(0);
          const phase = (i * Math.PI * 2) / cardCount;
          this.interp.add({
            elapsed: 0, duration,
            update: k => {
              const pf = Math.min(1, k / phaseRamp);
              const theta = phase * pf + k * Math.PI * 2 * passes;
              const col = k <= collapseStart ? 1 : 1 - (k - collapseStart) / (1 - collapseStart);
              const s = Math.sin(theta), co = Math.cos(theta);
              c.setPosition(cx + s * ampX * col, cy + s * co * ampY * col);
              c.setAngle(0);
              c.setZIndex(Math.round(deckZ + 1 + (s * co * col) * 40));
            },
            onDone: () => {
              c.el.remove();
              const idx = this.cards.indexOf(c);
              if (idx >= 0) this.cards.splice(idx, 1);
              resolve();
            },
          });
        }, i * spawnInterval);
      }));
    }
    await Promise.all(promises);
  }
}

function pickDelta(startAngle, endAngle, direction) {
  const sign = direction === 'down' ? 1 : -1;
  let d = endAngle - startAngle;
  d = ((d + 180) % 360 + 360) % 360 - 180;
  if (sign > 0 && d < 0) d += 360;
  if (sign < 0 && d > 0) d -= 360;
  if (Math.abs(d) < 90) d += sign * 360;
  return d;
}