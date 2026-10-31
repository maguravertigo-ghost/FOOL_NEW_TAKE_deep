import { ysdk } from './sdk/yandex_sdk.js';
import { audio } from './audio/audio_engine.js';
import { uiScale } from './ui/ui_scale.js';

import { Scene } from './core/scene.js';
import { SceneLayout, PRESETS } from './game/scene_layout.js';
import { MarkerRegistry } from './core/marker.js';
import { MouseCapture } from './core/mouse_capture.js';
import { Interpolator } from './core/interpolator.js';
import { ASSETS, preloadSvgs, svgInstance } from './assets.js';
import { Card } from './game/card.js';
import { Accordion } from './game/accordion.js';
import { GameSession } from './game/game_session.js';
import { DebugOverlay } from './debug/debug_overlay.js';
import { installLayoutTuner } from './dev/layout_tuner.js';
import { HUD } from './ui/hud.js';
import { PauseOverlay } from './ui/pause_overlay.js';
import { ScreenFade } from './ui/screen_fade.js';
import { MainMenu } from './ui/main_menu.js';
import { REAL, DEV_MODE } from './game/constants.js';
import { warmUpDeck } from './game/card_cache.js';
import { GameSettings, saveSettings } from './game/settings.js';
import { Progress, saveProgress, addStylePoints,
           giveFirstRunGift, GIFT_ITEMS } from './game/progress.js';
import { showMessage, showConfirm } from './ui/message_overlay.js';
import { CoinToss } from './ui/coin_toss.js';
import { clearCache } from './game/card_cache.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class App {
  constructor() {
    // ---- глобальный флаг: последний ввод был с клавиатуры? ----
    // Работает для ЛЮБОГО экрана (меню, игра, модалки, оверлеи).
    document.addEventListener('keydown', () => {
      window.__lastInputWasKeyboard = true;
    }, true);
    document.addEventListener('pointerdown', () => {
      window.__lastInputWasKeyboard = false;
      // Глобально снимаем все фокусы при клике или тапе (на мобилке)
      document.querySelectorAll('.kbd-focus').forEach(el => el.classList.remove('kbd-focus'));
    }, true);

    // ---- запрет контекстного меню и выделения ----
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('selectstart', (e) => e.preventDefault());
    document.addEventListener('dragstart',   (e) => e.preventDefault());

    this.sceneEl      = document.getElementById('scene');
    this.gameLayer    = document.getElementById('game-layer');
    this.debugLayer   = document.getElementById('debug-layer');
    this.captureLayer = document.getElementById('mouse-capture-layer');

    this.scene   = new Scene(this.sceneEl);
    this.markers = new MarkerRegistry();
    this.capture = new MouseCapture(this.captureLayer);
    this.interp  = new Interpolator();

    this.interp.onTick = () => {
      if (this.debug && this.debug.enabled) this.debug.requestRender();
    };

    /** @type {Card[]} */
    this.cards = [];
    this.session = null;
    this._sessionReady = false;
    this._paused = false;
    this._transitioning = false;
    this._lastAdAt = 0;

	this.debug = DEV_MODE
	? new DebugOverlay(this.scene, this.markers, () => this.cards, this.debugLayer)
	: null;

    this.capture.onKey((k) => {
      if (!this._sessionReady || !this.session) return;
      if (this._paused) return;
      // Модальные слои поверх сцены перехватывают ввод сами
      if (document.getElementById('game-over')) return;
      if (document.querySelector('.msg-overlay')) return;
      if (k === 'ArrowLeft')  this.session.selectPrevCard?.();
      if (k === 'ArrowRight') this.session.selectNextCard?.();
      if (k === 'ArrowUp')    this.session.slotFocusUp?.();
      if (k === 'ArrowDown')  this.session.slotFocusDown?.();
      if (k === 'Enter')      this.session.handleEnter?.();
      if (k === 'Backspace')  this.session.cancelSelection?.();
    });

    // Escape / BrowserBack / Backspace: закрыть оверлей / пауза. Требование 1.6.3.3
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' && e.key !== 'BrowserBack' && e.key !== 'Backspace') return;
      if (e.repeat) return;
      
      // Backspace в матче при выбранной карте должен снимать выбор, а не ставить на паузу
      if (e.key === 'Backspace' && this.session && this.session.selectedCard) return;
      
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      // 1. Модалки showMessage (без выбора) — закрываем по Esc
      const msgs = document.querySelectorAll('.msg-overlay');
      for (const m of msgs) {
        const actions = m.querySelector('.msg-overlay__actions');
        if (!actions) {
          // showMessage — просто закрыть
          const btn = m.querySelector('[data-close]');
          if (btn) { btn.click(); e.preventDefault(); return; }
        } else {
          // showConfirm — нажать «Отмена»
          const cancelBtn = m.querySelector('[data-cancel]');
          if (cancelBtn) { cancelBtn.click(); e.preventDefault(); return; }
        }
      }

      // 2. Оверлей меню
      if (this.menu && this.menu._activeOverlay) {
        // Дать оверлею шанс «сделать шаг назад» (например, магазин → категории)
        if (typeof this.menu._onEscape === 'function' && this.menu._onEscape()) {
          e.preventDefault();
          return;
        }
        audio.playSfx('tap_up');
        this.menu._closeOverlay();
        e.preventDefault();
        return;
      }

      // 3. Окно результатов — эквивалент кнопки «В меню»
      if (document.getElementById('game-over')) {
        const btnMenu = document.querySelector('#game-over [data-action="menu"]');
        if (btnMenu) btnMenu.click();
        e.preventDefault();
        return;
      }

      // 4. Пауза / продолжить в матче
      if (this.session && this._sessionReady) {
        if (this._paused) this._closePause();
        else this._openPause();
        e.preventDefault();
      }
    });

    // HUD показываем только в дебаге
	if (DEV_MODE) {
	  window.addEventListener('keydown', (e) => {
		if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
		  setTimeout(() => {
			if (this.hud) this.hud.setHidden(!this.debug.enabled);
		  }, 0);
		}
	  });
	}

    this.hud = new HUD();
    this.hud.setHidden(true);

    this.fade = new ScreenFade();
    this.fade.instantBlack();

    this.menu = new MainMenu({
      onStartGame: (mode) => this._startGameFromMenu(mode),
    });

    this.pauseOverlay = new PauseOverlay({
      onResume: () => this._closePause(),
      onExit:   () => this._exitToMenu(),
    });

    // Платформа сообщает: пора на паузу / можно продолжить
    ysdk.on('game_api_pause', () => {
      if (this._paused || !this.session) return;
      if (document.getElementById('game-over')) return;
      this._openPause();
    });
    ysdk.on('game_api_resume', () => {
      if (!this._paused) return;
      this._closePause();
    });

    // --- потеря/возврат фокуса — работает в любом экране ---
    const onHide = () => {
      audio.stopAllSfx();
      audio.pauseMusic();
      try { saveProgress(); } catch { /* noop */ }
      if (document.getElementById('game-over')) return;
      if (this.session && !this._paused) this._openPause();
    };
    const onShow = () => {
      audio._sfxPaused = false;
      audio.resumeMusic();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onHide(); else onShow();
    });
    window.addEventListener('blur',  onHide);
    window.addEventListener('focus', onShow);

    this._applyScenePreset();

    this._setupTable();
    this._setupMarkers();
    this._setupInput();

    // ---- kickoff музыки навешивается ДО _boot ----
    const kickoff = () => {
      audio.ensureStarted();
      document.removeEventListener('pointerdown', kickoff, true);
      document.removeEventListener('keydown', kickoff, true);
      document.removeEventListener('touchstart', kickoff, true);
    };
    document.addEventListener('pointerdown', kickoff, true);
    document.addEventListener('keydown', kickoff, true);
    document.addEventListener('touchstart', kickoff, true);

    // Глобальная навигация в модалках (.msg-overlay), когда меню скрыто.
    // В открытом меню эту роль выполняет MainMenu._navigateMsg.
    window.addEventListener('keydown', (e) => {
      if (this.menu && this.menu.el.style.display !== 'none') return;
      if (document.querySelector('.loading-overlay')) return;
      const el = document.querySelector('.msg-overlay');
      if (!el) return;
      this._navigateMsgGlobal(e, el);
    });

    this._boot();
    this._createDevTools();
  }

  _navigateMsgGlobal(e, el) {
    const focusable = [];
    el.querySelectorAll('input[type="checkbox"]').forEach(cb => focusable.push(cb));
    el.querySelectorAll('button').forEach(b => focusable.push(b));
    if (!focusable.length) return;

    if (!['Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    // Ключ обработан модалкой — не даём другим window-обработчикам
    // (например, _gameOverKeyHandler) среагировать на то же событие.
    e.stopImmediatePropagation();

    let cur = el.querySelector('.kbd-focus');
    if (!cur || !focusable.includes(cur)) {
      focusable[0].classList.add('kbd-focus');
      cur = focusable[0];
    }

    if (e.key === 'Enter' || e.key === ' ') {
      audio.playSfx('tap');
      if (cur.tagName === 'INPUT' && cur.type === 'checkbox') {
        cur.checked = !cur.checked;
      } else {
        cur.click();
      }
      return;
    }

    const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
    const curIdx = focusable.indexOf(cur);
    const nextIdx = (curIdx + dir + focusable.length) % focusable.length;
    focusable.forEach(x => x.classList.remove('kbd-focus'));
    focusable[nextIdx].classList.add('kbd-focus');
  }

  /* ================================================================
   *  Реклама — пауза/резюм
   * ================================================================ */

  pauseForAd() {
    audio.pauseAllSfx();
    audio.pauseMusic();
    if (this.interp) this.interp.pause();
    if (this.session) this.session.onPause?.();
    ysdk.gameplayStop(); // Требование 1.19.3
  }

  resumeFromAd() {
    if (this.interp) this.interp.resume();
    audio.resumeAllSfx();
    audio.resumeMusic();
    if (this.session) this.session.onResume?.();
    ysdk.gameplayStart(); // Требование 1.19.3
  }

async maybeShowAd() {
  const now = Date.now();
  if (now - this._lastAdAt < 180_000) return;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.warn('[app] offline — interstitial skipped');
    this._lastAdAt = now;
    return;
  }

  if (ysdk.isMock) {
    console.log('[app] mock mode — interstitial skipped (short delay)');
    this._lastAdAt = now;
    await new Promise(r => setTimeout(r, 300));
    return;
  }
	this._lastAdAt = now;
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(tid);
        this.resumeFromAd();
        resolve();
      };
      const tid = setTimeout(() => {
        console.warn('[app] interstitial timeout — forcing close');
        finish();
      }, 15000);

      ysdk.showInterstitial({
        onOpen:  () => this.pauseForAd(),
        onClose: () => finish(),
        onError: () => finish(),
      });
    });
  }

  /* ================================================================
   *  Загрузка
   * ================================================================ */

  async _boot() {
    console.log('[boot] preloading svgs...');

    // 1. SDK — до загрузки ресурсов
    await ysdk.init();

    // Автоопределение языка (требование 2.14). Определяем ДО загрузки
    // текстов, чтобы меню сразу открылось на нужном языке.
    const lang = ysdk.getLang();
    const deviceType = ysdk.getDeviceType();
    console.log('[boot] lang =', lang, ' device =', deviceType);
    const { setLang } = await import('./i18n/index.js');
    setLang(lang);

    // 2. Ресурсы игры
    await preloadSvgs();
    this._applySettings();

    Card.defaultCardStyle = GameSettings.cardStyle || 'grid';
    Card.defaultSuitStyle = GameSettings.suitStyle || 'gradient';
    warmUpDeck(Card.defaultCardStyle, Card.defaultSuitStyle);

    console.log('[boot] done');

    this._createAccordions();

    // 3. Загрузка прогресса с сервера Яндекс Игр (если авторизован)
    const remote = await ysdk.loadProgress();
    if (remote && typeof remote.stylePoints === 'number') {
      Object.assign(Progress, remote);
      saveProgress();
    }

    this.menu.show();
    this._positionSettingsButton();
    if (this.settingsBtn) this.settingsBtn.style.display = 'none';

    // 4. Показать меню
    await this.fade.toClear(700);

    // 5. Дать браузеру отрисовать кадр, затем сообщить платформе.
    //    Требование 1.19.2: LoadingAPI.ready() в момент, когда игрок
    //    может приступить к игре.
    // Прогрев рендера — иначе первый матч идёт с лагами
    await this._warmupRender();

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    ysdk.gameReady();
  }
  async _warmupRender() {
    try {
      // 1. Прогрев аудио (инициализация AudioContext)
      const silent = new Audio();
      silent.volume = 0.001;
      silent.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';
      silent.play().catch(() => {});

      // 2. Прогрев карты (создание + анимация в 1 кадр) — прогревает
      //    SVG-рендер, drop-shadow, will-change слой
      const testData = { rank: '6', suit: 'hearts' };
      const tmp = new Card(testData);
      tmp.setFaceUp(true);
      tmp.setPosition(-500, -500);  // за пределами видимой области
      this.gameLayer.appendChild(tmp.el);

      // 3. Один кадр анимации — прогревает интерполятор
      await new Promise(r => {
        this.interp.add({
          elapsed: 0,
          duration: 16,
          update: (k) => tmp.setPosition(-500 + k * 10, -500),
          onDone: r,
        });
      });

      // 4. Чистим
      tmp.destroy();
    } catch (e) {
      console.warn('[warmup] failed:', e);
    }
  }
_createDevTools() {
  if (!DEV_MODE) return;

  const wrap = document.createElement('div');
  wrap.id = 'dev-tools';
  wrap.style.cssText = `
    position: fixed;
    right: 12px;
    top: 12px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  `;

  const mkBtn = (label, bg, border, onClick) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `
      padding: 8px 14px;
      background: ${bg};
      color: #fff;
      border: 1px solid ${border};
      border-radius: 8px;
      cursor: pointer;
      font: 700 13px system-ui, sans-serif;
      letter-spacing: 1px;
      opacity: 0.92;
    `;
    b.addEventListener('click', onClick);
    return b;
  };

  // +2000 очков стиля
  wrap.appendChild(mkBtn('+2000', '#c62828', '#e57373', () => {
    addStylePoints(2000);
    showMessage('+2000 очков стиля (debug)', { title: 'Debug' });
  }));

  // Полный сброс прогресса
  wrap.appendChild(mkBtn('СБРОС', '#8e0000', '#b71c1c', () => {
    showConfirm(
      'Полный сброс: статистика, очки, квесты, покупки, жетон дурака.<br>Продолжить?',
      {
        title: 'DEV: Сброс прогресса',
        onConfirm: async () => {
          const m = await import('./game/progress.js');
          m.resetAll();
          if (this.menu) this.menu._refreshStats();
          showMessage('Прогресс сброшен', { title: 'Debug' });
        },
      }
    );
  }));

  // Тест погон
  let pogonTest = 0;
  wrap.appendChild(mkBtn('ПОГОНЫ+', '#7c3aed', '#a78bfa', () => {
    if (!this.session || !this.session.ready) {
      showMessage('Начните матч, чтобы тестировать погоны', { title: 'DEV' });
      return;
    }
    pogonTest = (pogonTest % 3) + 1;

    const existing = document.getElementById('game-over');
    if (existing) existing.remove();
    this.session._gameOverShown = false;

    this.session._showGameOver('player', { epaulettesOverride: pogonTest });
  }));
  // Тест ничьей
  wrap.appendChild(mkBtn('НИЧЬЯ', '#0d47a1', '#42a5f5', () => {
    if (!this.session || !this.session.ready) {
      showMessage('Начните матч, чтобы тестировать ничью', { title: 'DEV' });
      return;
    }
    const existing = document.getElementById('game-over');
    if (existing) existing.remove();
    this.session._gameOverShown = false;
    this.session._showGameOver('draw');
  }));
  
  wrap.appendChild(mkBtn('MATCH 6-ATK', '#1565c0', '#42a5f5', () => {
  if (!this.session || !this.session.ready) {
    showMessage('Начните матч для теста сценария', { title: 'DEV' });
    return;
  }
  window.__devScenario = {
    player: [
      { rank: '7', suit: 'diamonds' },
      { rank: '8', suit: 'hearts' },
      { rank: '8', suit: 'clubs' },
      { rank: '8', suit: 'spades' },
      { rank: '9', suit: 'hearts' },
      { rank: '9', suit: 'clubs' },
    ],
    cpu: [
      { rank: '6', suit: 'hearts' },
      { rank: '6', suit: 'clubs' },
      { rank: '6', suit: 'diamonds' },
      { rank: '6', suit: 'spades' },
      { rank: '7', suit: 'hearts' },
      { rank: '7', suit: 'clubs' },
    ],
    trump: 'spades',
    firstMove: 'cpu',
    forceAIAdd: true,
  };
  this._playAgain(this._lastMode || 'podkidnoy');
}));
  
  document.body.appendChild(wrap);
  this.devToolsEl = wrap;
  
  // в конце _createDevTools(), после this.devToolsEl = wrap;
	document.addEventListener('keydown', (e) => {
	  // Гравис (ё/`/~/Ё) — переключить видимость dev-панели.
	  // Не реагируем, если фокус в input/textarea.
	  const tag = (e.target && e.target.tagName || '').toLowerCase();
	  if (tag === 'input' || tag === 'textarea') return;

	  if (e.code === 'Backquote' || e.key === '`' || e.key === 'ё' || e.key === 'Ё') {
		if (!this.devToolsEl) return;
		const hidden = this.devToolsEl.style.display === 'none';
		this.devToolsEl.style.display = hidden ? '' : 'none';
		e.preventDefault();
	  }
	});
}

  /* ================================================================
   *  Переходы
   * ================================================================ */

async _startGameFromMenu(mode) {
  if (this._transitioning) return;
  this._transitioning = true;
  this._sessionReady = false;
  this._lastMode = mode;

  try {
    await this.fade.toBlack(380);

    // ---- First-run gift: пока экран чёрный, применяем стили ----
    let giftJustGiven = false;
    if (!Progress.giftGiven) {
      giftJustGiven = giveFirstRunGift();
      if (giftJustGiven) this._applyGiftStyles();
    }

    this.menu.hide();
    this._cleanupGame();
    this.hud.setHidden(!this.debug?.enabled);
    if (this.settingsBtn) this.settingsBtn.style.display = 'none';

    await this.fade.toClear(650);

    // ---- Окно "ВАМ ПОДАРОК!" (только при первом матче) ----
    if (giftJustGiven) {
      await this._showGiftDialog();
    }

    // ---- Жеребьёвка / показ жетона ----
    this.coinToss = new CoinToss(this);
    let firstMove;
    if (Progress.foolToken === null) {
      firstMove = await this.coinToss.run();
    } else {
      await this.coinToss.announceToken(Progress.foolToken);
      firstMove = Progress.foolToken.owner === 'player' ? 'cpu' : 'player';
    }

    if (this.settingsBtn) this.settingsBtn.style.display = '';

    // ---- Матч ----
    this.session = new GameSession(this, {
      skipAnimation: this.tuner.skipAnimation,
      translateMode: mode === 'perevodnoy',
      firstMove,
    });

    this.session.start().catch(err => console.error('[session] failed:', err));
    ysdk.gameplayStart();
    this._sessionReady = true;
  } catch (err) {
    console.error('[app] start game failed:', err);
    await this.fade.toClear(400);
  } finally {
    this._transitioning = false;
  }
}

  /**
   * Кто делает первый ход в предстоящем матче.
   *   • Жетона нет → 'player' (временно; Этап 5 заменит на CoinToss)
   *   • Жетон у игрока → первым ходит CPU (non-fool)
   *   • Жетон у CPU    → первым ходит игрок
   */
  _resolveFirstMove() {
    const token = Progress.foolToken;
    if (!token) return 'player';   // TODO Этап 5: заменить на CoinToss
    return token.owner === 'player' ? 'cpu' : 'player';
  }

  async _playAgain(mode) {
    const m = mode || this._lastMode || 'perevodnoy';
    const go = document.getElementById('game-over');
    if (go) go.remove();

    if (this._paused) {
      this._paused = false;
      this.pauseOverlay.hide();
    }

    // 1. Чёрный экран → реклама → тик подарка (сообщение) на чёрном
    await this.fade.toBlack(320);
    await this.maybeShowAd();
    if (this.session && this.session._decayTempItems) {
      await this.session._decayTempItems();
    }

    // 2. _startGameFromMenu дополнительно сделает toBlack (no-op, уже чёрный)
    //    и затем fade.toClear — покажет новый матч с актуальным стилем
    return this._startGameFromMenu(m);
  }

  _startGame(mode) {
	const firstMove = this._resolveFirstMove();
    this.session = new GameSession(this, {
      skipAnimation: this.tuner.skipAnimation,
      translateMode: mode === 'perevodnoy',
	  firstMove,
    });
    this.session.start().then(() => {
      this._sessionReady = true;
    });
  }

  async _exitToMenu() {
    if (this._transitioning) return;
    this._transitioning = true;
    this._sessionReady = false;

    this.pauseOverlay.hide();
    this._paused = false;
    audio.resumeAllSfx();
    audio.resumeMusic();
    ysdk.gameplayStop();

    // Были ли в окне результатов? → нужен тик подарка
    const hadGameOver = !!document.getElementById('game-over');
    const goEl = document.getElementById('game-over');
    if (goEl) goEl.remove();

    try {
      // 1. Чёрный экран → реклама → тик подарка на чёрном
      await this.fade.toBlack(420);
      await this.maybeShowAd();
      if (hadGameOver && this.session && this.session._decayTempItems) {
        await this.session._decayTempItems();
      }

      // 2. Убираем сцену, показываем меню
      this._cleanupGame();
      this.hud.setHidden(true);
      if (this.settingsBtn) this.settingsBtn.style.display = 'none';

      this.menu.show();
      await sleep(50);
      await this.fade.toClear(650);
    } catch (err) {
      console.error('[app] exit to menu failed:', err);
      await this.fade.toClear(400);
    } finally {
      this._transitioning = false;
    }
  }

  _cleanupGame() {
    this.interp.resume();
    this.interp.cancelAll();
    this._paused = false;

    // На случай, если пауза была открыта (потеря фокуса, реклама, exit)
    // и её ещё не успели закрыть — скрываем принудительно.
    if (this.pauseOverlay && this.pauseOverlay.hide) this.pauseOverlay.hide();
	
	if (this.coinToss) {
      this.coinToss.destroy();
      this.coinToss = null;
    }
	

    if (this.session) {
      this.session.destroy();
      this.session = null;
    }

    this.cards.length = 0;
    this.gameLayer.innerHTML = '';
    this.deckStackCards = null;
    this._sessionReady = false;
    this._resetAccordions();

    const go = document.getElementById('game-over');
    if (go) go.remove();
  }

  _resetAccordions() {
    const reset = (acc) => {
      if (!acc) return;
      acc.cards = [];
      acc.slotByUid.clear();
      acc._flightCounter = 0;
    };
    reset(this.accordionPlayer);
    reset(this.accordionCpu);
  }

  /* ================================================================
   *  Пауза
   * ================================================================ */

  _openPause() {
    if (this._paused || !this.session) return;
    this._paused = true;
    this.interp.pause();
    audio.stopAllSfx();
    audio.pauseMusic();
    if (this.session) this.session.onPause?.();
    this.pauseOverlay.show();
    ysdk.gameplayStop?.();
  }

  _closePause() {
    if (!this._paused) return;
    this._paused = false;
    this.interp.resume();
    audio.resumeMusic();
    if (this.session) this.session.onResume?.();
    this.pauseOverlay.hide();
    ysdk.gameplayStart?.();
  }

  /* ================================================================
   *  Базовая настройка сцены
   * ================================================================ */

  _setupTable() {
    const bg = document.getElementById('table-bg');
    if (bg && !bg.style.backgroundImage) {
      bg.style.backgroundImage = `url("${ASSETS.table}")`;
    }
  }

  _applyGiftStyles() {
    const g = GIFT_ITEMS;

    // shirt
    GameSettings.shirtStyle = g.shirt.index;
    Card.defaultShirtUrl = ASSETS.shirts[g.shirt.index];

    // table
    GameSettings.tableStyle = g.table.index;
    const bg = document.getElementById('table-bg');
    if (bg) bg.style.backgroundImage = `url("${ASSETS.tables[g.table.index]}")`;

    // decor
    GameSettings.decorStyle = g.decor.index;
    const decor = document.getElementById('decor-layer');
    if (decor) decor.style.backgroundImage = `url("${ASSETS.decorations[g.decor.index]}")`;

    // design — из индекса в строковый id
    const designIds = ['grid', 'center', 'rank', 'rank-no-corners'];
    GameSettings.cardStyle = designIds[g.design.index] || 'grid';
    Card.defaultCardStyle = GameSettings.cardStyle;

    // suits
    const suitIds = ['default', 'paper', 'barhat', 'gradient', 'ruby', 'golden'];
    GameSettings.suitStyle = suitIds[g.suits.index] || 'gradient';
    Card.defaultSuitStyle = GameSettings.suitStyle;

    saveSettings();

    // пересобрать кеш карт под новые стили
    clearCache();
    warmUpDeck(GameSettings.cardStyle, GameSettings.suitStyle);
  }

  _applySettings() {
    audio.setVolume(GameSettings.masterVolume ?? 0.8);
    audio.setSfxEnabled(GameSettings.sfxEnabled !== false);
    if (GameSettings.musicEnabled === false) audio.disableMusic();
    else audio.enableMusic();

    Card.defaultCardStyle = GameSettings.cardStyle || 'grid';
    Card.defaultSuitStyle = GameSettings.suitStyle || 'gradient';
    Card.defaultShirtUrl  = ASSETS.shirts[GameSettings.shirtStyle ?? 0] || ASSETS.shirt;

    const bg = document.getElementById('table-bg');
    if (bg) {
      const url = ASSETS.tables[GameSettings.tableStyle ?? 0] || ASSETS.tables[0];
      bg.style.backgroundImage = url ? `url("${url}")` : '';
    }

    const decor = document.getElementById('decor-layer');
    if (decor) {
      const idx = GameSettings.decorStyle;
      if (idx >= 0 && ASSETS.decorations[idx]) {
        decor.style.backgroundImage = `url("${ASSETS.decorations[idx]}")`;
      } else {
        decor.style.backgroundImage = '';
      }
    }

    warmUpDeck(Card.defaultCardStyle, Card.defaultSuitStyle);
  }

  _applyScenePreset() {
    SceneLayout.setPreset(uiScale.isMobile ? 'mobile' : 'desktop');
  }

  _setupMarkers() {
    if (DEV_MODE) {
      this.tuner = installLayoutTuner({ onChange: () => this._relayoutAll() });
    } else {
      this.tuner = { skipAnimation: false };
    }

    this._relayoutAll();
    this.scene.onResize(() => this._relayoutAll());
    uiScale.onChange(() => {
      this._applyScenePreset();
      this._relayoutAll();
    });
  }

  _setupInput() {
    this.capture.onPress((x, y) => {
      if (!this._sessionReady || !this.session) return;
      if (this._paused) return;
      if (document.getElementById('game-over')) return;
      if (document.querySelector('.msg-overlay')) return;
      this.session.handleClick(x, y);
    });
    this.capture.onMove(() => {});
    this.capture.onRelease(() => {});
  }

  _relayoutAll() {
    SceneLayout.apply(this.markers, this.scene);
    const C = SceneLayout.config;

    for (const c of this.cards) if (c.marker) c.relayout(this.scene);

    if (this.deckStackCards) {
      const cw = REAL.w, ch = REAL.h;
      this.deckStackCards.forEach((c, i) => {
        c.setPixelOffset(i * C.deckStackDx * cw, i * C.deckStackDy * ch);
        c.relayout(this.scene);
      });
      if (this.session && this.session._positionDeckShadow) {
        this.session._positionDeckShadow();
      }
    }

    if (this.accordionPlayer) this.accordionPlayer.relayout();
    if (this.accordionCpu)    this.accordionCpu.relayout();

    if (this.session) {
      if (this.session.slotUIs) for (const s of this.session.slotUIs) s.relayout();
      this.session._repositionActionButton();
	  this.session._updateDeckCounter?.();
      if (this.session.trumpSuitEl) {
        const trumpM = this.markers.get('trump');
        const p = this.scene.resolve(trumpM);
        this.session.trumpSuitEl.style.left = (p.x - REAL.w / 2) + 'px';
        this.session.trumpSuitEl.style.top  = (p.y - REAL.h / 2) + 'px';
        this.session.trumpSuitEl.style.transform = `rotate(${trumpM.angle || 0}deg)`;
      }
    }

    this._positionSettingsButton();
    if (this.debug) this.debug.requestRender();
  }

  /* ================================================================
   *  Кнопка настроек
   * ================================================================ */

  _positionSettingsButton() {
    if (!this.settingsBtn) return;
    const r = this.sceneEl.getBoundingClientRect();
    const W = r.width, H = r.height;
    const isMobile = uiScale.isMobile;

    let L, T, size;

    if (isMobile) {
      // На мобилке колода уходит за край (frameL < 0) — поэтому
      // для кнопки паузы используем фиксированный отступ от края.
      const pad = Math.round(10 * uiScale.scale);
      L = pad;
      T = pad;
      // Размер примерно вдвое меньше десктопного
      size = Math.max(36, Math.min(48, Math.min(W, H) * 0.09));
    } else {
      const C = SceneLayout.config;
      L = C.frameL * W;
      T = C.frameT * H;
      size = Math.max(60, Math.min(76, Math.min(W, H) * 0.055));
    }

    this.settingsBtn.style.left   = (r.left + L) + 'px';
    this.settingsBtn.style.top    = (r.top  + T) + 'px';
    this.settingsBtn.style.width  = size + 'px';
    this.settingsBtn.style.height = size + 'px';
  }

  _createSettingsButton() {
    const btn = document.createElement('button');
    btn.id = 'settings-btn';
    btn.setAttribute('aria-label', 'Пауза');

    const im = document.createElement('img');
    im.src = ASSETS.settingsIcon;
    im.alt = '';
    im.draggable = false;
    im.style.cssText = 'display:block;width:64%;height:64%;object-fit:contain;pointer-events:none;';
    im.onerror = () => {
      im.remove();
      btn.textContent = '⚙';
    };
    btn.appendChild(im);

    btn.addEventListener('click', () => {
      audio.playSfx('tap');
      this._openPause();
    });
    document.body.appendChild(btn);
    this.settingsBtn = btn;
    this._positionSettingsButton();
  }

  _showGiftDialog() {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'msg-overlay';
      el.style.display = 'flex';
      el.innerHTML = `
        <div class="msg-overlay__box msg-overlay__box--gift">
          <div class="msg-overlay__title">ВАМ ПОДАРОК!</div>
          <div class="gift-joker">
            <img src="${ASSETS.jokerFaceSmiling}" alt="">
          </div>
          <div class="msg-overlay__body">
            Джокер дарит Вам <b>подарочный стиль оформления игровой комнаты</b>
            на <b>3 матча</b>.
            <div class="gift-hint">Подробнее: ГЛАВНОЕ МЕНЮ → СТИЛЬ</div>
          </div>
          <button class="mm-btn mm-btn--small" data-msg-btn data-close>ОК</button>
        </div>
      `;
      document.getElementById('scene').appendChild(el);

      // Автофокус на OK — если предыдущее действие было с клавиатуры/ТВ
      const wasKbd = this.menu && this.menu._lastInputWasKeyboard === true;
      if (wasKbd) {
        requestAnimationFrame(() => {
          const okBtn = el.querySelector('[data-close]');
          if (okBtn) okBtn.classList.add('kbd-focus');
        });
      }

      el.querySelector('[data-close]').addEventListener('click', () => {
        audio.playSfx('tap_up');
        el.remove();
        resolve();
      });
    });
  }

  /* ================================================================
   *  Аккордеоны
   * ================================================================ */

  _createAccordions() {
    this.accordionPlayer = new Accordion({
      scene: this.scene, interp: this.interp,
      anchorL: this.markers.get('acc_player_L'),
      anchorR: this.markers.get('acc_player_R'),
      insertAnchor: this.markers.get('ins_player_L'),
      baseMinDist: REAL.w * 0.9,
      fanDir: +1,
    });
    this.accordionCpu = new Accordion({
      scene: this.scene, interp: this.interp,
      anchorL: this.markers.get('acc_cpu_L'),
      anchorR: this.markers.get('acc_cpu_R'),
      insertAnchor: this.markers.get('ins_cpu_L'),
      baseMinDist: REAL.w * 0.9, fanDir: -1,
      sortCards: false,
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app._createSettingsButton();
  window.__app = app;
  window.SceneLayout = SceneLayout;   // для отладки
});