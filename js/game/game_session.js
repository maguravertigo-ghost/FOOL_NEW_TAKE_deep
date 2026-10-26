import { audio } from '../audio/audio_engine.js';

import { Joker } from '../ui/joker.js';
import { Card } from './card.js';
import { clearCache, warmUpDeck } from './card_cache.js';
import { Deck } from './deck.js';
import { moveLinear, moveFlip, moveArkFlip } from '../core/interpolator.js';
import { REAL, SUIT_VALUE, RANK_VALUE } from './constants.js';
import { SceneLayout } from './scene_layout.js';
import { canBeat, canTranslate, canAddToTable, tableRanks } from './rules.js';
import { Marker } from '../core/marker.js';
import { ASSETS, svgInstance } from '../assets.js';

import { AI } from './ai.js';
import { GameSettings, saveSettings } from './settings.js';
import { ysdk } from '../sdk/yandex_sdk.js';
import { uiScale } from '../ui/ui_scale.js';
// в начале файла должен быть расширенный импорт:
  import { Progress, saveProgress, addStylePoints, creditQuest,
           setFoolToken, clearFoolToken, tickTempItems } from './progress.js';
import { recordOutcome } from './progress.js';

import { showMessage } from '../ui/message_overlay.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const Z_HAND_BASE  = 100;
const Z_TABLE_BASE = 200;
const LIFT_PX      = 0.22 * REAL.h;

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
  constructor(app, { skipAnimation = false, translateMode, firstMove } = {}) {
    this.app = app;
    this.scene = app.scene;
    this.markers = app.markers;
    this.interp = app.interp;
    this.gameLayer = app.gameLayer;
    this.cards = app.cards;
    this.hud = app.hud;

	const firstMove0 = (firstMove === 'cpu' || firstMove === 'player') ? firstMove : 'player';
	this._initialFirstMove = firstMove0;

    this.skipAnimation = skipAnimation;
    this.translateMode = (translateMode !== undefined)
      ? translateMode
      : (SceneLayout.config.translateMode !== false);
	this.mode = this.translateMode ? 'perevodnoy' : 'podkidnoy';
	
	    // AI
    this.ai = new AI(this, { level: GameSettings.aiLevel || 2 });

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
      n: 1, firstMove: firstMove0, attack: firstMove0, move: firstMove0,
      phase: 'A_START', table: [], anyBeaten: false,
    };

    this.selectedCard = null;
    this.slotUIs = [];
    this.slotUIsReady = false;
    this.actionBtn = null;
    this.aiMessageEl = null;
    this._busy = false;
	
	this.selectedSlots = null;
	this.blockedCards = new Set();
	this.deckShadow = null;
	
	this._gameOverShown = false;
	this._gameOverPending = false;
	this._victoryPending = false;
	this._victoryResolve = null;
	this._kbdFocusOnButton = false;
	
	this._slotFocusIdx = -1;       // -1 = фокус на карте, иначе индекс в selectedSlots
	
	// На тач-устройстве клавиатурный режим по умолчанию выключен,
	// даже если пользователь ещё ничего не нажимал.
	this._usingKeyboard = !uiScale.isMobile && (window.__lastInputWasKeyboard !== false);
	this._lastCycledCard = null;
	this._kbdReturnCard = null;
	
	this._finishedViaPogony = false;
	this._finishedHandCount = 0;
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
	this._setupDeckCounter();
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
	if (this.deckCounterEl && this.deckCounterEl.parentNode) this.deckCounterEl.parentNode.removeChild(this.deckCounterEl);
	this.deckCounterEl = null;
    const go = document.getElementById('game-over');
    if (go) go.remove();
    // таймеры и анимации
    if (this._cpuTimer) { clearTimeout(this._cpuTimer); this._cpuTimer = null; }
    if (this.interp && typeof this.interp.cancelAll === 'function') this.interp.cancelAll();
	
    if (this.joker) { this.joker.destroy(); this.joker = null; }

    if (this._victoryResolve) { this._victoryResolve(); this._victoryResolve = null; }
    this._victoryPending = false;
	this._gameOverPending = false;
	
	if (this._gameOverKeyHandler) {
      window.removeEventListener('keydown', this._gameOverKeyHandler);
      this._gameOverKeyHandler = null;
    }
    this._gameOverButtons = [];
    this._gameOverNavIdx = -1;
	
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }

		// _suitResizeUnsub больше не используется (см. _showGameOver)

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
    const cw = REAL.w, ch = REAL.h;
    const deckM = this.markers.get('deck');

    // top card становится верхом стека
    const top = this.deckTopCard;
    top.marker = deckM;
    this.stack = [top];
	
	top.el.classList.add('card--stack-sub');

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

    this._ensureDeckShadow();

    this._reflowStack();
    this.app.deckStackCards = this.stack;
  }

  _reflowStack() {
    const C = SceneLayout.config;
    const cw = REAL.w, ch = REAL.h;
    const deckM = this.markers.get('deck');
    const N = this.stack.length;
    this.stack.forEach((c, i) => {
      c.setPixelOffset(i * C.deckStackDx * cw, i * C.deckStackDy * ch);
      c.setZIndex(50 + (N - 1 - i));
      c.marker = deckM;
      c.relayout(this.scene);
    });
	if (this.stack.length > 0) this._ensureDeckShadow();
	this._positionDeckShadow();
	this._updateDeckCounter?.();
  }

_ensureDeckShadow() {
  if (this.deckShadow) return;
  const el = document.createElement('div');
  el.className = 'deck-shadow';
  this.gameLayer.appendChild(el);
  this.deckShadow = el;
  this._positionDeckShadow();
}

  _setupDeckCounter() {
    if (this.deckCounterEl) return;
    const el = document.createElement('div');
    el.className = 'deck-counter';
    this.gameLayer.appendChild(el);
    this.deckCounterEl = el;
    this._updateDeckCounter();
  }

  _updateDeckCounter() {
    if (!this.deckCounterEl) return;

    if (!GameSettings.showDeckCounter) {
      this.deckCounterEl.style.display = 'none';
      return;
    }

    // Все карты, которые ещё не в руках:
    //   колода + стек + козырь (если он ещё не забран)
    const remaining = this._totalRemaining() + (this.trumpTaken ? 0 : 1);

    // Когда остался только козырь (remaining === 1) — скрываем,
    // его и так видно на столе.
    if (remaining <= 1) {
      this.deckCounterEl.style.display = 'none';
      return;
    }

    this.deckCounterEl.style.display = 'flex';
    this.deckCounterEl.textContent = String(remaining);

    const deckM = this.markers.tryGet('deck');
    if (!deckM) return;

    if (uiScale.isMobile) {
      const trumpM = this.markers.tryGet('trump') || deckM;
      const p = this.scene.resolve(trumpM);

      const bottomY = p.y + REAL.w / 2;
      const padX = Math.round(16 * uiScale.scale);
      const padY = Math.round(10 * uiScale.scale);

      this.deckCounterEl.classList.add('deck-counter--mobile');
      this.deckCounterEl.style.left = padX + 'px';
      this.deckCounterEl.style.top  = (bottomY + padY) + 'px';
    } else {
      const p = this.scene.resolve(deckM);
      this.deckCounterEl.classList.remove('deck-counter--mobile');
      this.deckCounterEl.style.left = p.x + 'px';
      this.deckCounterEl.style.top  = p.y + 'px';
    }
  }

_positionDeckShadow() {
  if (!this.deckShadow) return;
  const C = SceneLayout.config;
  const cw = REAL.w, ch = REAL.h;
  const deckM = this.markers.get('deck');
  if (!deckM) return;
  const p = this.scene.resolve(deckM);

  const N = Math.max(1, this.stack.length);
  const w = cw + (N - 1) * C.deckStackDx * cw;
  const h = ch + (N - 1) * C.deckStackDy * ch;

  this.deckShadow.style.left   = (p.x - cw / 2) + 'px';
  this.deckShadow.style.top    = (p.y - ch / 2) + 'px';
  this.deckShadow.style.width  = w + 'px';
  this.deckShadow.style.height = h + 'px';
}

_removeDeckShadow() {
  if (!this.deckShadow) return;
  this.deckShadow.remove();
  this.deckShadow = null;
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

    if (this.stack.length === 0) this._removeDeckShadow();

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
      this._updateDeckCounter?.();
      return card;
    }

    return null;
  }

  _showTrumpSuitIcon() {
    if (this.trumpSuitEl) return;
    const trumpM = this.markers.get('trump');
    const el = document.createElement('div');
    el.className = 'trump-suit';
    el.style.width  = REAL.w + 'px';
    el.style.height = REAL.h + 'px';
    const svg = svgInstance(ASSETS.suits[this.trump]);
    if (svg) {
      svg.style.width  = '55%';
      svg.style.height = '55%';
      el.appendChild(svg);
    }
    this.gameLayer.appendChild(el);
    const p = this.scene.resolve(trumpM);
    el.style.left = (p.x - REAL.w / 2) + 'px';
    el.style.top  = (p.y - REAL.h / 2) + 'px';
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

    const firstIsPlayer = (this._initialFirstMove === 'player');

    for (let i = 0; i < 6; i++) {
      const si = 5 - i;

      if (firstIsPlayer) {
        pCards[i] = await this._dealOne(playerHand[i], pSlots[i], 'down', Z_HAND_BASE + i);
        await sleep(60);
        cCards[si] = await this._dealOne(cpuHand[i], cSlots[si], 'up', Z_HAND_BASE + si);
      } else {
        cCards[si] = await this._dealOne(cpuHand[i], cSlots[si], 'up', Z_HAND_BASE + si);
        await sleep(60);
        pCards[i] = await this._dealOne(playerHand[i], pSlots[i], 'down', Z_HAND_BASE + i);
      }
      await sleep(60);
    }

    this.app.accordionPlayer.setCards(pCards);
    this.app.accordionCpu.setCards(cCards);
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
	audio.playSfx('card_fly')
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
	audio.playSfx('card_hit');
	this._updateDeckCounter?.();
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
	this._playerLastPlays = [];   // цепочка ходов считается только внутри раунда
	this._clearKbdFocus?.();

	this._finishedViaPogony = false;
	this._finishedHandCount = 0;

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
    if (this._finishingGame) return;
    this._busy = true;

    // ---- проверка завершения ----
    const finished = this._checkImmediateEnd();
    if (finished) {
      await this._finishGame(finished);
      return;
    }

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
		audio.playSfx('card_discard')
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
    if (winner) {
	  this._gameOverPending = true;
      if (winner === 'player') {
        await this._waitFinishProgress();
      }
      this._showGameOver(winner);
      return;
    }

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
      const offX = (Math.random() - 0.5) * REAL.w * 0.9;
      const offY = (Math.random() - 0.5) * REAL.h * 0.9;
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
    // Добор по правилам начинается с АТАКУЮЩЕГО в прошедшем раунде,
    // затем — защитник. Не с firstMove (кто ходит следующим).
    // r.attack ещё не перезаписан (это произойдёт в _startRound),
    // поэтому здесь r.attack = атакующий прошедшего раунда.
    const order = [r.attack, (r.attack === 'player') ? 'cpu' : 'player'];

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

  /**
   * Немедленная проверка завершения. Возвращает 'player' | 'cpu' | 'draw' | null.
   * Срабатывает только при пустой колоде.
   */
  _checkImmediateEnd() {
    if (this._totalRemaining() !== 0) return null;
    const p = this.app.accordionPlayer.cards.length;
    const c = this.app.accordionCpu.cards.length;
    if (p === 0 && c === 0) return 'draw';
    if (p === 0) return 'player';
    if (c === 0) return 'cpu';
    return null;
  }

  _decayTempItems() {
    const expired = tickTempItems();
    if (!expired.length) return;

    let changed = false;

    for (const e of expired) {
      if (e.cat === 'shirt' && GameSettings.shirtStyle === e.index) {
        GameSettings.shirtStyle = 0;
        Card.defaultShirtUrl = ASSETS.shirts[0];
        changed = true;
      }
      if (e.cat === 'table' && GameSettings.tableStyle === e.index) {
        GameSettings.tableStyle = 0;
        const bg = document.getElementById('table-bg');
        if (bg) bg.style.backgroundImage = `url("${ASSETS.tables[0]}")`;
        changed = true;
      }
      if (e.cat === 'decor' && GameSettings.decorStyle === e.index) {
        GameSettings.decorStyle = -1;
        const decor = document.getElementById('decor-layer');
        if (decor) decor.style.backgroundImage = '';
        changed = true;
      }
      if (e.cat === 'design') {
        const designIds = ['grid', 'center', 'rank', 'rank-no-corners'];
        const cur = designIds.indexOf(GameSettings.cardStyle);
        if (cur === e.index) {
          GameSettings.cardStyle = 'grid';
          Card.defaultCardStyle = 'grid';
          changed = true;
        }
      }
      if (e.cat === 'suits') {
        const suitIds = ['default', 'paper', 'barhat', 'gradient', 'ruby', 'golden'];
        const cur = suitIds.indexOf(GameSettings.suitStyle);
        if (cur === e.index) {
          GameSettings.suitStyle = 'gradient';
          Card.defaultSuitStyle = 'gradient';
          changed = true;
        }
      }
    }

    if (changed) {
      saveSettings();
      clearCache();
      warmUpDeck(GameSettings.cardStyle, GameSettings.suitStyle);
    }
  }

  /**
   * Остановка матча. Карты остаются на столе, на кнопке игрока —
   * финальная метка + круговой прогресс. По клику или по таймауту —
   * окно результатов.
   */
  async _finishGame(winner, finishLabel = null) {
    if (this._finishingGame) return;
    this._finishingGame = true;
    this._gameOverPending = true;

    if (this._cpuTimer) {
      clearTimeout(this._cpuTimer);
      this._cpuTimer = null;
    }

    const btn = this.actionBtn;
    if (btn) {
      let label;
      if (winner === 'player')      label = finishLabel || 'ПОБЕДА';
      else if (winner === 'cpu')    label = finishLabel || 'ПРОИГРАЛ';
      else                          label = 'НИЧЬЯ';

    btn.textContent = label;
    btn.disabled = false;
    btn.dataset.state = 'active';
  }

  this._updateHUD();

  // Автофокус на финальную кнопку — игроку с клавиатурой/ТВ
  // не нужно нажимать стрелку, чтобы увидеть жёлтую обводку.
    if (!uiScale.isMobile) {
      this._focusActionButton(); // ← Оборачиваем в if
    }

  // Прогресс-кольцо — только на победе игрока.
    // Поражение и ничья: игрок сам жмёт кнопку, чтобы увидеть результаты.
    if (winner === 'player') {
      await this._waitFinishProgress();
    } else {
      await this._waitPlayerClick();
    }

    // --- First-run gift: декремент счётчиков ---
    try {
      this._decayTempItems();
    } catch (e) {
      console.error('[decayTempItems] failed:', e);
    }

    this._showGameOver(winner);
  }

  /** Ждём клика игрока по кнопке — без прогресса и таймера. */
  _waitPlayerClick() {
    return new Promise(resolve => {
      const btn = this.actionBtn;
      if (!btn) return resolve();

      this._victoryPending = true;
      this._victoryResolve = () => {
        this._victoryPending = false;
        this._victoryResolve = null;
        resolve();
      };
    });
  }

  /** Кольцо-прогресс на кнопке игрока. 5 сек или клик. */
  _waitFinishProgress() {
    return new Promise(resolve => {
      const btn = this.actionBtn;
      if (!btn) return resolve();

      this._victoryPending = true;

      const NS = 'http://www.w3.org/2000/svg';
      const R  = 46;
      const C  = 2 * Math.PI * R;

      const ring = document.createElementNS(NS, 'svg');
      ring.setAttribute('class', 'btn-ring');
      ring.setAttribute('viewBox', '0 0 100 100');

      const track = document.createElementNS(NS, 'circle');
      track.setAttribute('class', 'btn-ring__track');
      track.setAttribute('cx', '50');
      track.setAttribute('cy', '50');
      track.setAttribute('r', String(R));

      const fill = document.createElementNS(NS, 'circle');
      fill.setAttribute('class', 'btn-ring__fill');
      fill.setAttribute('cx', '50');
      fill.setAttribute('cy', '50');
      fill.setAttribute('r', String(R));
      fill.setAttribute('transform', 'rotate(-90 50 50)');
      fill.style.strokeDasharray  = String(C);
      fill.style.strokeDashoffset = String(C);

      ring.appendChild(track);
      ring.appendChild(fill);
      btn.appendChild(ring);

      let raf = null;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        ring.remove();
        this._victoryPending = false;
        this._victoryResolve = null;
        resolve();
      };
      this._victoryResolve = finish;

      const dur = 5000;
      const t0  = performance.now();
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / dur);
        fill.style.strokeDashoffset = String(C * (1 - p));
        if (p >= 1) { finish(); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
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

_showGameOver(winner, opts = {}) {
  if (document.getElementById('game-over')) return;
  if (this._gameOverShown) return;
  this._gameOverShown = true;

  // Снять визуальный фокус с кнопки игрока — он просвечивает под окном
  if (this.actionBtn) this.actionBtn.classList.remove('kbd-focus');
  this._kbdFocusOnButton = false;

  try { ysdk.gameplayStop(); } catch { /* noop */ }

  let points = 0;
  if (winner === 'player') { points = 100; audio.playSfx('win'); }
  if (winner === 'cpu')    { audio.playSfx('lose'); }
  if (winner === 'draw')   { audio.playSfx('draw'); }

	  // Погоны — только явное действие через кнопку ПОГОНЫ! (или dev-override).
	  let epaulettes = 0;
	  if (opts.epaulettesOverride !== undefined) {
		epaulettes = opts.epaulettesOverride;
	  } else if (winner === 'player' && this._finishedViaPogony) {
		const n = this._finishedHandCount || 0;
		if (n === 1) epaulettes = 1;
		else if (n === 2) epaulettes = 2;
		else if (n >= 3) epaulettes = 3;
	  }
	  if (epaulettes > 0) points += 250;

    let questRank = null;
    if (winner === 'player') {
      const counts = {};
      for (const p of this._playerLastPlays) {
        const rk = p.card.data.rank;
        counts[rk] = (counts[rk] || 0) + 1;
      }
      for (const rk in counts) {
        // creditQuest вернет ранг только если прогресс реально засчитан
        const credited = creditQuest(rk, counts[rk]);
        if (credited) {
          questRank = credited;
        }
      }
    }

// эмоция джокера в конце матча// эмоция джокера в конце матча
if (winner === 'player')       this._jokerFrame('sad');   // джокер проиграл
else if (winner === 'cpu')     this._jokerFrame('nice');  // джокер победил
else                           this._jokerFrame('five');  // ничья

    if (points > 0) addStylePoints(points);
    recordOutcome(winner);
 
    // ---- Обновление жетона дурака ----
    const prevOwner = Progress.foolToken ? Progress.foolToken.owner : null;
    if (winner === 'player')      setFoolToken('cpu',    this.mode);
    else if (winner === 'cpu')    setFoolToken('player', this.mode);
    else if (winner === 'draw')   clearFoolToken();
    const newOwner = Progress.foolToken ? Progress.foolToken.owner : null;
	const showFirstWinCongrats = (winner === 'player' && !Progress.firstWinShown);

    // ---- HTML ----
    const el = document.createElement('div');
    el.id = 'game-over';
    const title = winner === 'player' ? 'Победа!' :
                  winner === 'cpu'    ? 'Поражение' : 'Ничья';
    const sub   = winner === 'player' ? 'CPU — дурак' :
                  winner === 'cpu'    ? 'Ты — дурак' : '';
    const epiText =
      epaulettes === 1 ? '🎖️ Погон! +250' :
      epaulettes === 2 ? '🎖️🎖️ Погоны! +250' :
      epaulettes === 3 ? '🎖️🎖️ 👔 Погоны и галстук! +250' :
      '';
    const epi = epiText ? `<div class="game-over__epi">${epiText}</div>` : '';
    const quest = questRank ? `<div class="game-over__quest">Квест «${questRank}»: прогресс обновлён</div>` : '';
    const pts   = `<div class="game-over__points">Получено очков стиля: <b>${points}</b></div>`;

    const adBtn = `<button class="pause-btn pause-btn--ad" data-action="ad">📺 +500 очков за рекламу</button>`;

  let jokerHTML = '';

  if (winner === 'player' && epaulettes > 0) {
    const pogonEls = [];
    const st = (left, top, w, h) =>
      `position:absolute;left:${left};top:${top};width:${w};height:${h};` +
      `pointer-events:none;user-select:none;object-fit:contain;` +
      `animation:pogon-glow 1.8s ease-in-out infinite;`;

    if (epaulettes >= 1) pogonEls.push(
      `<img src="${ASSETS.pogon}" alt="" draggable="false" style="${st('19.78%','49.28%','14.67%','9.25%')}">`
    );
    if (epaulettes >= 2) pogonEls.push(
      `<img src="${ASSETS.pogon}" alt="" draggable="false" style="${st('65.71%','49.28%','14.67%','9.25%')}">`
    );
    if (epaulettes >= 3) pogonEls.push(
      `<img src="${ASSETS.galstuk}" alt="" draggable="false" style="${st('47.05%','59.33%','7.02%','20.10%')}">`
    );

	jokerHTML = `
	  <div class="game-over__joker game-over__joker--suit">
		<div class="joker-suit-wrap">
		  <div class="joker-suit-img"
			   style="background-image:url('${ASSETS.jokerSuit}');"></div>
		  ${pogonEls.join('')}
		</div>
	  </div>`;
  } else {
    let jokerSrc = null;
    if (winner === 'player')      jokerSrc = ASSETS.jokerWin;
    else if (winner === 'cpu')    jokerSrc = ASSETS.jokerLose;
    else                          jokerSrc = ASSETS.jokerDraw;

    const cpuHasToken = Progress.foolToken && Progress.foolToken.owner === 'cpu';
    const tokenHTML = cpuHasToken
      ? `<img class="fool-token fool-token--br" src="${ASSETS.foolToken}" alt="" draggable="false" style="height: calc(60px * var(--ui)); width: auto;">`
      : '';

    jokerHTML = jokerSrc
      ? `<div class="game-over__joker"><img src="${jokerSrc}" alt="">${tokenHTML}</div>`
      : '';
  }

  el.innerHTML = `<div class="game-over__box">
    ${jokerHTML}
    <div class="game-over__content">
      <div class="game-over__title">${title}</div>
      <div class="game-over__sub">${sub}</div>
        ${epi}
        ${pts}
        ${quest}
        ${adBtn}
        <button class="pause-btn" data-action="replay">СЫГРАТЬ ЕЩЁ РАЗ</button>
        <button class="pause-btn pause-btn--danger" data-action="menu">ВЫЙТИ В МЕНЮ</button>
    </div>
  </div>`;

  el.style.display = 'flex';
  document.getElementById('scene').appendChild(el);

  // ---- Клавиатурная / ТВ навигация в окне результатов ----
  // Порядок: реклама → ещё раз → в меню.
  this._gameOverButtons = [
    el.querySelector('[data-action="ad"]'),
    el.querySelector('[data-action="replay"]'),
    el.querySelector('[data-action="menu"]'),
  ].filter(Boolean);
  this._gameOverNavIdx = -1;

  const goHighlight = (idx) => {
    this._gameOverButtons.forEach((b, i) =>
      b.classList.toggle('kbd-focus', i === idx)
    );
  };

  this._gameOverKeyHandler = (e) => {
    if (e.repeat) return;
    if (!document.getElementById('game-over')) {
      window.removeEventListener('keydown', this._gameOverKeyHandler);
      this._gameOverKeyHandler = null;
      return;
    }
    // Пока открыта модалка — ключи обрабатывает она
    if (document.querySelector('.msg-overlay')) return;

    if (!['ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();

    const n = this._gameOverButtons.length;
    if (!n) return;

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      let idx = this._gameOverNavIdx;
      if (idx < 0) idx = dir > 0 ? 0 : n - 1;
      else         idx = (idx + dir + n) % n;
      // пропускаем disabled
      for (let i = 0; i < n; i++) {
        if (this._gameOverButtons[idx] && !this._gameOverButtons[idx].disabled) break;
        idx = (idx + dir + n) % n;
      }
      this._gameOverNavIdx = idx;
      goHighlight(idx);
    } else if (this._gameOverNavIdx >= 0) {
      const btn = this._gameOverButtons[this._gameOverNavIdx];
      if (btn && !btn.disabled) {
        audio.playSfx('button_click');
        btn.click();
      }
    }
  };
  window.addEventListener('keydown', this._gameOverKeyHandler);

  // Автофокус на первую кнопку (реклама / ещё раз / в меню)
  if (!uiScale.isMobile) { // ← ДОБАВИТЬ ЭТУ ПРОВЕРКУ
	  setTimeout(() => {
		if (!document.getElementById('game-over')) return;
		this._gameOverNavIdx = 0;
		goHighlight(0);
	  }, 100);
	}

  // Размеры окна результатов и джокера задаются полностью в CSS
  // (.game-over__box: 2/3 W × 60% H; .game-over__joker--suit: aspect-ratio 1/1).
  // JS-синхронизация больше не нужна.


	el.querySelector('[data-action="replay"]').addEventListener('click', async () => {
	  audio.playSfx('tap');
	  if (this._goReplay) return;
	  this._goReplay = true;

	  if (showFirstWinCongrats) {
	    Progress.firstWinShown = true;
	    saveProgress();
	    await this._showFirstWinCongratsDialog();
	  }

	  if (this.app && typeof this.app._playAgain === 'function') {
		this.app._playAgain(this.mode);
	  }
	});
	el.querySelector('[data-action="menu"]').addEventListener('click', async () => {
	  audio.playSfx('tap_up');
	  if (this._goMenu) return;
	  this._goMenu = true;

	  if (showFirstWinCongrats) {
	    Progress.firstWinShown = true;
	    saveProgress();
	    await this._showFirstWinCongratsDialog();
	  }

	  if (this.app && typeof this.app._exitToMenu === 'function') {
		this.app._exitToMenu();
	  }
	});

	el.querySelector('[data-action="ad"]').addEventListener('click', async () => {
	  audio.playSfx('tap');
	  const btn = el.querySelector('[data-action="ad"]');
	  if (btn.disabled) return;
	  btn.disabled = true;
	  btn.textContent = '⏳ Загружаем рекламу…';

	  const { ysdk } = await import('../sdk/yandex_sdk.js');
	  ysdk.showRewarded({
		onReward: () => {
		  addStylePoints(500);
		  btn.textContent = '✓ +500 получено';
		  btn.classList.add('pause-btn--ad-done');

		  // Перевести фокус на «СЫГРАТЬ ЕЩЁ РАЗ» (ad теперь disabled)
		  const replayBtn = el.querySelector('[data-action="replay"]');
		  const replayIdx = this._gameOverButtons.indexOf(replayBtn);
		  if (replayIdx >= 0) {
			this._gameOverButtons.forEach((b, i) =>
			  b.classList.toggle('kbd-focus', i === replayIdx)
			);
			this._gameOverNavIdx = replayIdx;
		  }

		  showMessage('+500 очков стиля!', { title: 'Награда' });
		},
	    onClose: () => {
	      // Если награда не пришла (пользователь закрыл до просмотра)
	      if (btn.textContent.includes('Загружаем')) {
	        btn.disabled = false;
	        btn.textContent = '📺 +500 очков за рекламу';
	      }
	    },
	    onError: () => {
	      btn.disabled = false;
	      btn.textContent = '📺 +500 очков за рекламу';
	      showMessage('Реклама недоступна. Попробуйте позже.', { title: 'Реклама' });
	    },
	  });
	});

    console.log('[game over]', winner, { points, epaulettes, questRank });
    
    // ---- Анимация перемещения жетона (параллельно, не ждём) ----
    this._animateTokenTransfer(prevOwner, newOwner);
  }

  /**
   * Визуальное перемещение жетона дурака после матча.
   * Идёт ПОД оверлеем GameOver, ПОМОЩЬ поверх карт и джокера.
   *
   *   prevOwner === newOwner          → ничего
   *   prevOwner = null, newOwner≠null → fade-in в углу нового владельца
   *   prevOwner≠null, newOwner = null → fade-out из угла владельца
   *   оба != null и различаются       → полёт из угла в угол с вращением
   */
  async _animateTokenTransfer(prevOwner, newOwner) {
    if (prevOwner === newOwner) return;
	
  // Убираем старый жетон из угла (после CoinToss)
  if (this.app.coinToss) {
    this.app.coinToss.destroy();
    this.app.coinToss = null;
  }

    const W = this.scene.width;
    const H = this.scene.height;
    const C = SceneLayout.config;
    const frameT = C.frameT * H;
    const frameR = W - C.frameR * W;
    const frameB = H - C.frameB * H;

    const size = Math.round(H * 0.15);

    const cornerPos = (side) => {
      if (side === 'cpu') return { x: frameR - size / 2, y: frameT + size / 2 };
      return                    { x: frameR - size / 2, y: frameB - size / 2 };
    };

    // --- элементы на сцене ---
    const img = document.createElement('img');
    img.className = 'fool-token-scene';
    img.src = ASSETS.foolToken;
    img.alt = '';
    img.draggable = false;
    img.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: auto;
      pointer-events: none;
      user-select: none;
      -webkit-user-drag: none;
      z-index: 2000;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
      transition: opacity 300ms ease;
    `;
    // Начальное положение
    const startSide = prevOwner || newOwner;
    const startP = cornerPos(startSide);
    img.style.left = (startP.x - size / 2) + 'px';
    img.style.top  = (startP.y - size / 2) + 'px';
    img.style.opacity = prevOwner ? '1' : '0';

    this.gameLayer.appendChild(img);

    // --- СЛУЧАЙ A: появление ---
    if (!prevOwner && newOwner) {
      const p = cornerPos(newOwner);
      img.style.left = (p.x - size / 2) + 'px';
      img.style.top  = (p.y - size / 2) + 'px';
      await new Promise(r => {
        requestAnimationFrame(() => {
          img.style.opacity = '1';
          setTimeout(r, 320);
        });
      });
      return;
    }

    // --- СЛУЧАЙ B: исчезновение ---
    if (prevOwner && !newOwner) {
      img.style.opacity = '0';
      await new Promise(r => setTimeout(r, 320));
      img.remove();
      return;
    }

    // --- СЛУЧАЙ C: перемещение ---
    const from = cornerPos(prevOwner);
    const to   = cornerPos(newOwner);

    const dur = 900;
    const t0  = performance.now();

    return new Promise(resolve => {
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / dur);

        // easing: easeInOutCubic
        const e = p < 0.5
          ? 4 * p * p * p
          : 1 - Math.pow(-2 * p + 2, 3) / 2;

        // Позиция
        const x = from.x + (to.x - from.x) * e;
        const y = from.y + (to.y - from.y) * e;

        // Кривая: изгиб к центру сцены по вертикали
        const bend = Math.sin(Math.PI * e) * (H * 0.10);
        const cy   = H / 2;
        const yDir = (y > cy) ? -1 : 1;   // изгиб к центру
        const yy = y + yDir * bend;

        img.style.left = (x - size / 2) + 'px';
        img.style.top  = (yy - size / 2) + 'px';

        // Вращение: 3 оборота (горизонтальный flip)
        const spin = Math.abs(Math.cos(3 * Math.PI * e));
        img.style.transform = `scaleX(${spin})`;

        if (p >= 1) {
          img.style.transform = 'scaleX(1)';
          return resolve();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  
  _showFirstWinCongratsDialog() {
    return new Promise(resolve => {
      showMessage(
        'Вы получили свои <b>первые очки стиля</b>!<br><br>' +
        'Теперь вы можете посетить <b>Магазинчик Джокера</b> — там ещё много ' +
        'интересного: новые рубашки, столы, декорации и оформление карт. ' +
        'Придайте своей игре собственный неповторимый стиль!',
        { title: 'Поздравляем!', onClose: resolve }
      );
    });
  }

  /**
   * Финальная кнопка игрока после победы.
   * Показывает кольцо-прогресс на 5 секунд. Игрок может нажать раньше —
   * тогда прогресс завершается принудительно.
   */


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
	//this._jokerFrameName = null;

    card.setZIndex(Z_TABLE_BASE + idx * 2);
    card.setFaceUp(true);
    r.table.push({ atk: card, def: null });

    console.log(`[${byWho}] attack ${card.data.rank}${card.data.suit}  slot=${idx}`);
	
	if (byWho === 'player') this._playerLastPlays.push({ card, type: 'atk' });

    // Проверка завершения здесь НЕ выполняется: защитник ещё должен
    // отбиться или взять. Конец определяется в _playDefenseCard
    // (когда все карты отбиты) или в _endRound (после отбоя/взятия).

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

    // ---- проверка завершения: только когда защитник отбил ВСЁ ----
    if (!stillUnbeaten) {
      const finished = this._checkImmediateEnd();
      if (finished) {
        await this._finishGame(finished);
        return;
      }
    }
	
	// Если защитник отбился и у него 0 карт — атакующий больше
// подкинуть не сможет. Автоматически завершаем раунд отбоем.
if (!stillUnbeaten && this._defenderHandSize() === 0) {
  this._updateHUD();
  this._updateButton();
  this._updateAIMessage();
  this._endRound('discard');
  return;
}

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
	  if (side === 'cpu') this._jokerFrame('sad');

	  r.phase = 'A_DUMP';
	  r.move  = r.attack;

	  // Если у атакующего не осталось карт — подкидывать нечего,
	  // ждать нажатия ПАС не нужно. Сразу завершаем раунд.
	  const attackerAcc = (r.attack === 'player')
	    ? this.app.accordionPlayer
	    : this.app.accordionCpu;
	  if (attackerAcc.cards.length === 0) {
	    this._endRound('take');
	    return;
	  }

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
  if (!this.ready) return;
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
	if (this._gameOverPending) return;
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
	
	if (this._gameOverPending) return;
	
    if (this._busy) return;

    // Игрок переключился на мышь — снимаем клавиатурный фокус
    this._usingKeyboard = false;
    if (this._kbdFocusOnButton) this._clearKbdFocus();
	
    const r = this.round;
    if (r.move !== 'player' || r.phase === 'END') return;

    const slot = this._hitSlotUI(x, y);
    if (slot && this.selectedCard) { this._confirmSlot(slot); return; }

    const card = this._handCardAt(x, y);
    if (!card) return;
    if (card === this.selectedCard) { this._deselect(); return; }
    if (this.blockedCards.has(card)) return;

    this._deselect();
    this._selectCard(card);
  }

  _handCardAt(x, y) {
    let best = null, bestZ = -Infinity;
    for (const c of this.app.accordionPlayer.cards) {
        if (!c.hitTestLocal(x, y)) continue;
	    const rad = -c.angle * Math.PI / 180;
		const dx = x - c.x, dy = y - c.y;
		const lx =  dx * Math.cos(rad) - dy * Math.sin(rad);
		const ly =  dx * Math.sin(rad) + dy * Math.cos(rad);
		if (Math.abs(lx) > REAL.w / 2 || Math.abs(ly) > REAL.h / 2) continue;
      const z = Number(c.el.style.zIndex) || 0;
      if (z > bestZ) { bestZ = z; best = c; }
    }
    return best;
  }

  /* ================================================================
   *  КЛАВИАТУРНАЯ НАВИГАЦИЯ (стрелки + Enter + Backspace)
   * ================================================================ */

  selectNextCard() {
    this._usingKeyboard = true;
    if (this._slotFocusIdx >= 0) this._cycleSlotFocus(+1);
    else this._cycleHandCard(+1);
  }
  selectPrevCard() {
    this._usingKeyboard = true;
    if (this._slotFocusIdx >= 0) this._cycleSlotFocus(-1);
    else this._cycleHandCard(-1);
  }

  slotFocusUp() {
    this._usingKeyboard = true;
    // Если фокус на кнопке — вернуться на карту
    if (this._kbdFocusOnButton) {
      this._returnFromButtonToCard();
      return;
    }
    if (!this.selectedCard || !this.selectedSlots || !this.selectedSlots.length) return;
    // Переход на слоты (или следующий слот)
    if (this._slotFocusIdx < 0) {
      this._slotFocusIdx = 0;
    } else {
      this._slotFocusIdx = (this._slotFocusIdx + 1) % this.selectedSlots.length;
    }
    this._updateSlotFocusUI();
  }

  slotFocusDown() {
    this._usingKeyboard = true;

    // 1. С кнопки — вернуться на карту
    if (this._kbdFocusOnButton) {
      this._returnFromButtonToCard();
      return;
    }

    // 2. Со слота — вернуться на карту в руке
    if (this._slotFocusIdx >= 0) {
      this._slotFocusIdx = -1;
      this._updateSlotFocusUI();
      return;
    }

    // 3. В руке на карте — shortcut на кнопку игрока
    if (this._canFocusActionButton()) {
      this._deselect();
      this._focusActionButton();
    }
  }

  _cycleSlotFocus(dir) {
    if (this._gameOverPending) return;
    if (!this.selectedCard || !this.selectedSlots || !this.selectedSlots.length) return;
    const n = this.selectedSlots.length;

    // Из карты — переход на первый слот (или последний, если ←)
    if (this._slotFocusIdx < 0) {
      this._slotFocusIdx = dir > 0 ? 0 : n - 1;
    } else {
      this._slotFocusIdx = (this._slotFocusIdx + dir + n) % n;
    }
    this._updateSlotFocusUI();
  }

  _updateSlotFocusUI() {
    for (const s of this.slotUIs) {
      s.el.classList.remove('slot-ui--focus');
    }
    if (this._slotFocusIdx >= 0 && this.selectedSlots && this.selectedCard) {
      const slot = this.selectedSlots[this._slotFocusIdx];
      if (slot) {
        const ui = this.slotUIs.find(x => x.kind === slot.kind && x.index === slot.index);
        if (ui) ui.el.classList.add('slot-ui--focus');
      }
    }
  }

  _cycleHandCard(dir) {
    if (this._gameOverPending) return;
    if (this.round.move !== 'player' || this.round.phase === 'END') return;
    // Фокус на слоте — стрелки ←/→ работают по слотам, не по картам
    if (this._slotFocusIdx >= 0) return;
    const cards = this.app.accordionPlayer.cards;

    // Фокус на кнопке — стрелка ведёт обратно к картам,
    // пропуская заблокированные.
    if (this._kbdFocusOnButton) {
      this._clearKbdFocus();
      if (!cards.length) return;
      let idx = dir > 0 ? 0 : cards.length - 1;
      while (idx >= 0 && idx < cards.length && this.blockedCards.has(cards[idx])) {
        idx += dir;
      }
      if (idx < 0 || idx >= cards.length) {
        // Все карты заблокированы — фокус остаётся на кнопке
        this._focusActionButton();
        return;
      }
      this._selectCard(cards[idx], { kbd: true });
      return;
    }

    if (!cards.length) {
      // В руке пусто — стрелка переводит фокус на кнопку
      if (this._canFocusActionButton()) this._focusActionButton();
      return;
    }

    const currentIdx = cards.indexOf(this.selectedCard);
    if (currentIdx < 0) {
      // Первое нажатие в этом ходу — выбираем ближайшую НЕзаблокированную карту
      let idx = dir > 0 ? 0 : cards.length - 1;
      while (idx >= 0 && idx < cards.length && this.blockedCards.has(cards[idx])) {
        idx += dir;
      }
      if (idx < 0 || idx >= cards.length) {
        // Все карты заблокированы — сразу на кнопку (если активна)
        if (this._canFocusActionButton()) this._focusActionButton();
        return;
      }
      this._selectCard(cards[idx], { kbd: true });
      return;
    }

    // Ищем следующую НЕзаблокированную карту в направлении
    let i = currentIdx + dir;
    while (i >= 0 && i < cards.length && this.blockedCards.has(cards[i])) {
      i += dir;
    }

    // Вышли за границу
    if (i < 0 || i >= cards.length) {
      // 1. Если кнопка игрока активна — переход на неё
      if (this._canFocusActionButton()) {
        this._deselect();
        this._focusActionButton();
        return;
      }
      // 2. Иначе wrap по кругу внутри руки
      //    (ищем первую легальную карту с противоположного края)
      let j = dir > 0 ? 0 : cards.length - 1;
      while (j >= 0 && j < cards.length && this.blockedCards.has(cards[j])) {
        j += dir;
      }
      if (j < 0 || j >= cards.length) return;  // все заблокированы
      this._deselect();
      this._selectCard(cards[j], { kbd: true });
      return;
    }

    this._deselect();
    this._selectCard(cards[i], { kbd: true });
  }

  _clearKbdFocus() {
    for (const c of this.app.accordionPlayer.cards) {
      c.el.classList.remove('kbd-focus');
    }
    if (this.actionBtn) this.actionBtn.classList.remove('kbd-focus');
    this._kbdFocusOnButton = false;
  }

  _canFocusActionButton() {
    if (!this.actionBtn) return false;
    if (this.actionBtn.disabled) return false;
    // В финальном состоянии (после _finishGame) кнопка тоже должна быть
    // достижима — игрок жмёт её, чтобы увидеть окно результатов.
    return true;
  }

  _focusActionButton() {
    if (!this._canFocusActionButton()) return;
    // запомнить карту, чтобы вернуться по ↑/↓ с кнопки
    this._kbdReturnCard = this.selectedCard || this._lastCycledCard || null;
    this._clearKbdFocus();
    this.actionBtn.classList.add('kbd-focus');
    this._kbdFocusOnButton = true;
  }

  _returnFromButtonToCard() {
    if (!this._kbdFocusOnButton) return;
    this._clearKbdFocus();

    const cards = this.app.accordionPlayer.cards;
    if (!cards.length) return;

    // Куда вернуться: на карту, где был фокус до кнопки.
    // Если она стала заблокирована / ушла — на первую доступную.
    let target = this._kbdReturnCard;
    if (!target || !cards.includes(target) || this.blockedCards.has(target)) {
      target = null;
      for (const c of cards) {
        if (!this.blockedCards.has(c)) { target = c; break; }
      }
      if (!target) target = cards[0];
    }

    this._selectCard(target, { kbd: true, silent: true });
    this._kbdReturnCard = null;
  }

  handleEnter() {
    if (this._victoryPending) {
      this._onActionButtonClick();
      return;
    }
    if (this._gameOverPending) return;
    if (this._kbdFocusOnButton) {
      if (this._canFocusActionButton()) this._onActionButtonClick();
      return;
    }
    // Если фокус на слоте — играем в этот слот
    if (this._slotFocusIdx >= 0 && this.selectedSlots && this.selectedSlots[this._slotFocusIdx]) {
      this._confirmSlot(this.selectedSlots[this._slotFocusIdx]);
      return;
    }
    if (this.selectedCard) this.confirmSelection();
  }

  confirmSelection() {
    if (!this.selectedCard) return;
    const slots = this.selectedSlots || [];
    if (!slots.length) return;
    this._confirmSlot(slots[0]);
  }

  cancelSelection() {
    if (this.selectedCard) this._deselect();
  }

_selectCard(card, opts = {}) {
  const r = this.round;
  if (!opts.kbd) this._clearKbdFocus();
  this.selectedCard = card;
  this._lastCycledCard = card;
  if (!opts.silent) audio.playSfx('card_selection');
  card.setPixelOffset(0, -LIFT_PX);
  card.relayout(this.scene);
  card.setZIndex(700);
  this._clearSlotHighlights();

  if (opts.kbd) {
    this._clearKbdFocus();
    card.el.classList.add('kbd-focus');
  }

  const slots = this._getCardLegalSlots(card);
  this.selectedSlots = slots;
  
  this._slotFocusIdx = -1;
  
  for (const s of slots) {
    this._showSlotUI(s.kind, s.index);
  }
}

_getCardLegalSlots(card) {
  const r = this.round;
  const out = [];
  if (r.move !== 'player' || r.phase === 'END') return out;

  // ---- фаза атаки ----
  if (r.phase === 'A_START' || r.phase === 'A_ADD' || r.phase === 'A_DUMP') {
    const defSize = this._defenderHandSize();
    if (defSize === 0) return out;

    if (r.phase === 'A_START') {
      out.push({ kind: 'atk', index: r.table.length });
      return out;
    }

    const tR = tableRanks(r.table);
    if (!canAddToTable(card, tR)) return out;

    if (r.phase === 'A_ADD') {
      out.push({ kind: 'atk', index: r.table.length });
      return out;
    }

    // A_DUMP
    if (r.table.length < Math.min(6, defSize)) {
      out.push({ kind: 'atk', index: r.table.length });
    }
    return out;
  }

  // ---- фаза защиты ----
  if (r.phase === 'D_ACT') {
    // можем бить любую неотбитую пару
    r.table.forEach((pair, idx) => {
      if (pair.atk && !pair.def && canBeat(card, pair.atk, this.trump)) {
        out.push({ kind: 'def', index: idx });
      }
    });

    // можем перевести, если никто ещё не бил
    const hasDef = r.table.some(p => p.def);
    if (!r.anyBeaten && !hasDef) {
      const firstAtk = r.table.find(p => p.atk && !p.def)?.atk;
      if (firstAtk && this._canTranslate(card, firstAtk, 'player', r)) {
        out.push({ kind: 'atk', index: r.table.length });
      }
    }
  }
  return out;
}

_deselect() {
  if (!this.selectedCard) return;
  audio.playSfx('card_selection');
  this.selectedCard.setPixelOffset(0, 0);
  this.selectedCard.relayout(this.scene);
  this.selectedCard.el.classList.remove('kbd-focus');
  this.app.accordionPlayer._applyZ();
  this.selectedCard = null;
  this.selectedSlots = null;
  
  this._slotFocusIdx = -1;
  
  this._clearSlotHighlights();
}

_confirmSlot(slot) {
  const card = this.selectedCard;
  if (!card) return;

  // слот должен быть в списке доступных
  const allowed = (this.selectedSlots || []).some(
    s => s.kind === slot.kind && s.index === slot.index
  );
  if (!allowed) return;

  this.selectedCard = null;
  this.selectedSlots = null;
  this._clearSlotHighlights();
  card.el.classList.remove('kbd-focus');
  this._kbdFocusOnButton = false;
  card.setPixelOffset(0, 0);
  card.relayout(this.scene);

  const r = this.round;
  if (slot.kind === 'def') {
    this._playDefenseCard(card, slot.index, 'player');
    return;
  }
  if (slot.kind === 'atk') {
    if (r.phase === 'D_ACT') {
      this._translateCard(card, 'player');
    } else {
      this._playAttackCard(card, 'player', r.phase === 'A_DUMP');
    }
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
            el.style.left = (p.x - REAL.w / 2) + 'px';
            el.style.top  = (p.y - REAL.h / 2) + 'px';
            el.style.width  = REAL.w + 'px';
            el.style.height = REAL.h + 'px';
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
  _clearSlotHighlights() {
    for (const s of this.slotUIs) {
      s.hide();
      s.el.classList.remove('slot-ui--focus');
    }
    this._slotFocusIdx = -1;
  }

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

  /**
   * Проверить доступность финишного хода (ПОГОНЫ / ВСЁ) для стороны `side`.
   * Возвращает 'pogony' | 'vsyo' | null.
   */
  _checkFinishMoves(side) {
    if (this._totalRemaining() > 0) return null;

    const r = this.round;
    if (r.phase !== 'A_START') return null;
    if (r.table.length !== 0) return null;
    if (r.attack !== side) return null;

    const acc = side === 'player' ? this.app.accordionPlayer : this.app.accordionCpu;
    const opp = side === 'player' ? this.app.accordionCpu : this.app.accordionPlayer;

    const hand = acc.cards;
    if (hand.length === 0 || hand.length > 6) return null;

    // 1. ПОГОНЫ — все карты одного ранга
    const ranks = new Set(hand.map(c => c.data.rank));
    if (ranks.size === 1) return 'pogony';

    // 2. ВСЁ — оппонент не может побить ни одну из наших карт
    const oppHand = opp.cards;
    const allUnbeatable = hand.every(c =>
      !oppHand.some(a => canBeat(a, c, this.trump))
    );
    if (allUnbeatable) return 'vsyo';

    return null;
  }
  
  async _playFinishMove(side, kind) {
    const r = this.round;
    const acc = side === 'player' ? this.app.accordionPlayer : this.app.accordionCpu;
    const cards = [...acc.cards];
    if (!cards.length) return;

    // Запоминаем: это финиш через кнопку ПОГОНЫ! (иначе — просто финиш обычным ходом)
    this._finishedViaPogony = (kind === 'pogony');
    this._finishedHandCount = cards.length;

    this._busy = true;

    const promises = [];
    for (const card of cards) {
      const idx = r.table.length;
      if (idx >= 6) break;

      const slotM = this.markers.get(`table_atk_${idx}`);
      acc.extractCard(card);
      audio.playSfx('card_fly');

      promises.push(this._moveCardTo(card, slotM, { duration: 320 }));

      card.setZIndex(Z_TABLE_BASE + idx * 2);
      card.setFaceUp(true);
      r.table.push({ atk: card, def: null });
    }

    await Promise.all(promises);

    if (side === 'player') {
      for (const c of cards) {
        this._playerLastPlays.push({ card: c, type: 'atk' });
      }
    }

    this._busy = false;

    // финальная метка
    const finishLabel = kind === 'pogony' ? 'ПОГОНЫ!' :
                        kind === 'vsyo'   ? 'ВСЁ!'    : null;

    // Остановка — карты остаются на столе. Победитель — тот, кто выкинул.
    const winner = side;
    await this._finishGame(winner, finishLabel);
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
      if (Math.abs(x - p.x) <= REAL.w / 2 && Math.abs(y - p.y) <= REAL.h / 2) return s;
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
  const r = this.app.sceneEl.getBoundingClientRect();
  const W = r.width, H = r.height;
  const C = SceneLayout.config;
  const R = W - C.frameR * W;
  const isMobile = uiScale.isMobile;

  const discard = this.markers.tryGet('discard');
  if (!discard) return;
  const yPx = discard.y * H;

  // На мобилке кнопка и Джокер компактнее — иначе перекрывают стол и отбой
  const bw = REAL.w * (isMobile ? 1.8 : 2.65);
  const aiH = Math.round(bw * 264 / 642);
  const btnH = REAL.h;

  const jokerRight = W - R;
  const jokerCx    = W - jokerRight - bw / 2;
  const jokerLeft  = jokerCx - bw / 2;

  const btnTop = yPx + (isMobile ? 20 : 40);
  this.actionBtn.style.left   = (r.left + jokerLeft) + 'px';
  this.actionBtn.style.top    = (r.top  + btnTop)    + 'px';
  this.actionBtn.style.width  = bw + 'px';
  this.actionBtn.style.height = btnH + 'px';

  const aiInset = 4;
  const aiTop = yPx - 30 - aiH + aiInset;
  this.aiMessageEl.style.left   = (r.left + jokerLeft) + 'px';
  this.aiMessageEl.style.top    = (r.top  + aiTop)    + 'px';
  this.aiMessageEl.style.width  = bw + 'px';
  this.aiMessageEl.style.height = (aiH - aiInset * 2) + 'px';
  this.aiMessageEl.style.lineHeight = '1.15';
  this.aiMessageEl.style.padding = '8px 12px';
  this.aiMessageEl.style.fontSize = (isMobile ? 12 : 16) + 'px';
  this.aiMessageEl.style.display = 'flex';
  this.aiMessageEl.style.alignItems = 'center';
  this.aiMessageEl.style.justifyContent = 'center';

  if (this.joker) {
    this.joker.setCloudRect({
      left:   r.left + jokerLeft,
      top:    r.top  + aiTop,
      width:  bw,
      height: aiH - aiInset * 2,
    });
  }
}

  _updateButton() {
    if (!this.actionBtn) return;
    if (this._victoryPending) return;

    const r = this.round;
    let label, enabled = false;

    if (r.move === 'player' && r.phase === 'A_START') {
      const finish = this._checkFinishMoves('player');
      if (finish === 'pogony') {
        label = 'ПОГОНЫ!'; enabled = true;
      } else if (finish === 'vsyo') {
        label = 'ВСЁ!'; enabled = true;
      } else {
        label = 'МОЙ ХОД'; enabled = false;
      }
    } else if (r.move === 'player') {
      if (r.phase === 'A_ADD' || r.phase === 'A_DUMP') {
        label = 'ПАС'; enabled = true;
      } else if (r.phase === 'D_ACT') {
        label = 'БЕРУ'; enabled = true;
      } else {
        label = 'МОЙ ХОД'; enabled = false;
      }
    } else {
      label = '...'; enabled = false;
    }

    this.actionBtn.textContent = label;
    this.actionBtn.disabled = !enabled;
	
	if (this._kbdFocusOnButton && this.actionBtn.disabled) {
      this._clearKbdFocus();
    }
	
    if (label === 'МОЙ ХОД') {
      this.actionBtn.dataset.state = 'info';
    } else if (enabled) {
      this.actionBtn.dataset.state = 'active';
    } else {
      this.actionBtn.dataset.state = 'wait';
    }
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

    if (this._victoryPending) {
      audio.playSfx('button_click');
      this._victoryResolve?.();
      return;
    }
    if (this._gameOverPending) return;

    const r = this.round;
    if (r.move !== 'player') return;

    const label = this.actionBtn.textContent;
    audio.playSfx('button_click');

    if (label === 'ПОГОНЫ!' || label === 'ВСЁ!') {
      const kind = label === 'ПОГОНЫ!' ? 'pogony' : 'vsyo';
      this._playFinishMove('player', kind);
      return;
    }

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
  const hintsOn = GameSettings.moveHints !== false;

  this.blockedCards.clear();

  if (r.move !== 'player' || r.phase === 'END') {
    for (const c of acc.cards) {
      this.blockedCards.add(c);
      c.setOverlay(hintsOn);
    }
    return;
  }

  for (const c of acc.cards) {
    const legal = this._getCardLegalSlots(c).length > 0;
    if (!legal) this.blockedCards.add(c);
    c.setOverlay(hintsOn && !legal);
  }

  // Если текущая выбранная карта теперь заблокирована — снимаем фокус
  if (this.selectedCard && this.blockedCards.has(this.selectedCard)) {
    this._deselect();
    this._clearKbdFocus();
  }

  // Автофокус в режиме клавиатуры:
  // сначала на первую доступную карту, иначе — на кнопку
  this._maybeAutoFocusFirstCard();
  this._maybeAutoFocusOnButton();
}

_maybeAutoFocusFirstCard() {
	if (uiScale.isMobile) return; // ← ДОБАВИТЬ: на мобилках не подсвечиваем карты сами
  if (!this._usingKeyboard) return;
  if (this._kbdFocusOnButton) return;
  if (this.selectedCard) return;
  if (this._slotFocusIdx >= 0) return;

  const r = this.round;
  if (r.move !== 'player') return;
  if (r.phase === 'END') return;

  const cards = this.app.accordionPlayer.cards;
  if (!cards.length) return;

  // Первая доступная для хода карта — слева-направо
  // (cards упорядочены по слотам: чем меньше index, тем левее)
  for (const c of cards) {
    if (!this.blockedCards.has(c)) {
      this._selectCard(c, { kbd: true, silent: true });
      return;
    }
  }
  // Все карты заблокированы → сработает _maybeAutoFocusOnButton
}

_maybeAutoFocusOnButton() {
	if (uiScale.isMobile) return; // ← ДОБАВИТЬ
  if (!this._usingKeyboard) return;
  if (this._kbdFocusOnButton) return;
  if (this.selectedCard) return;

  const r = this.round;
  if (r.move !== 'player') return;
  if (r.phase === 'END') return;

  if (!this.actionBtn || this.actionBtn.disabled) return;

  const cards = this.app.accordionPlayer.cards;
  if (cards.length === 0) {
    // В руке пусто — сразу фокус на кнопку (БЕРУ / ПАС / ПОГОНЫ)
    this._focusActionButton();
    return;
  }
  if (!cards.every(c => this.blockedCards.has(c))) return;

  this._focusActionButton();
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
    const cw = REAL.w, ch = REAL.h;
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
	this._updateDeckCounter?.();
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
    const ampX = () => this.scene.width  * 0.10;
	const ampY = () => this.scene.height * 0.05;
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
          // свежие координаты центра колоды на каждом кадре — корректно при resize
          const p = this.scene.resolve(center);
          const pf = Math.min(1, k / phaseRamp);
          const theta = phase * pf + k * Math.PI * 2 * passes;
          const col = k <= collapseStart ? 1 : 1 - (k - collapseStart) / (1 - collapseStart);
          const s = Math.sin(theta), co = Math.cos(theta);
          c.setPosition(p.x + s * ampX() * col, p.y + s * co * ampY() * col);
          c.setAngle(0);
          c.setZIndex(Math.round(deckZ + 1 + (s * co * col) * 40));
        },
        onDone: () => {
          c.el.remove();
          const idx = this.cards.indexOf(c);
          if (idx >= 0) this.cards.splice(idx, 1);
          resolve();
        }
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