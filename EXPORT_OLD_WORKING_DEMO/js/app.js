import { audio } from './audio/audio_engine.js';

import { Scene } from './core/scene.js';
import { SceneLayout } from './game/scene_layout.js';
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
import { REAL_W, REAL_H } from './game/constants.js';
import { warmUpDeck } from './game/card_cache.js';
import { GameSettings } from './game/settings.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class App {
  constructor() {
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

    this.debug = new DebugOverlay(
      this.scene, this.markers, () => this.cards, this.debugLayer
    );
	
    // HUD показываем только в дебаге
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
        setTimeout(() => {
          if (this.hud) this.hud.setHidden(!this.debug.enabled);
        }, 0);
      }
    });

    this.hud = new HUD();
    this.hud.setHidden(true);

    this.fade = new ScreenFade();   // ← сразу чёрный
    this.fade.instantBlack();

    this.menu = new MainMenu({
      onStartGame: (mode) => this._startGameFromMenu(mode),
    });

    this.pauseOverlay = new PauseOverlay({
      onResume: () => this._closePause(),
      onExit:   () => this._exitToMenu(),
    });

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

    this._boot();
  }   // ← ЭТА ФИГУРНАЯ СКОБКА ЗАКРЫВАЕТ КОНСТРУКТОР — её не хватало

  /* ================================================================
   *  Загрузка
   * ================================================================ */

  async _boot() {
    console.log('[boot] preloading svgs...');
    await preloadSvgs();
	
	this._applySettings();   // ← новое
	
	  // применяем настройки стиля карт
  Card.defaultCardStyle = GameSettings.cardStyle || 'grid';
  Card.defaultSuitStyle = GameSettings.suitStyle || 'gradient';

  // прогреваем кеш карт под текущий стиль
  warmUpDeck(Card.defaultCardStyle, Card.defaultSuitStyle);
	
    console.log('[boot] done');

    this._createAccordions();

    // сразу — в меню, с плавным раскрытием из чёрного
    this.menu.show();
    this._positionSettingsButton();   // нужно один раз — вычислим размеры
    this.settingsBtn.style.display = 'none';   // в меню не нужна
    await this.fade.toClear(700);
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
      // 1. Поднимаем чёрный занавес (меню ещё видно, но уже перекрыто)
      await this.fade.toBlack(380);

      // 2. Под занавесом всё меняем
      this.menu.hide();
      this._cleanupGame();
      this.hud.setHidden(false);
      if (this.settingsBtn) this.settingsBtn.style.display = '';

      this.session = new GameSession(this, {
        skipAnimation: this.tuner.skipAnimation,
        translateMode: mode === 'perevodnoy',
      });

      // НЕ ждём завершения сессии: анимация идёт уже после открытия
      // занавеса (или мгновенно, если skip ON)
      this.session.start().catch(err => console.error('[session] failed:', err));
      this._sessionReady = true;

      // 3. Один кадр — чтобы браузер применил DOM-изменения под чёрным
      await sleep(50);

      // 4. Опускаем занавес
      await this.fade.toClear(650);
    } catch (err) {
      console.error('[app] start game failed:', err);
      await this.fade.toClear(400);
    } finally {
      this._transitioning = false;
    }
  }

  async _playAgain(mode) {
    const m = mode || this._lastMode || 'perevodnoy';
    // уберём оверлей game-over сразу, чтобы он не мелькал под занавесом
    const go = document.getElementById('game-over');
    if (go) go.remove();
    return this._startGameFromMenu(m);
  }

  _startGame(mode) {
    this.session = new GameSession(this, {
      skipAnimation: this.tuner.skipAnimation,
      translateMode: mode === 'perevodnoy',
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
	audio.resumeAllSfx();                // ← добавить, чтобы не остались висеть

    try {
      // 1. Поднимаем занавес (игра ещё видна, перекрыта)
      await this.fade.toBlack(420);

      // 2. Под занавесом
      this._cleanupGame();
      this.hud.setHidden(true);
      if (this.settingsBtn) this.settingsBtn.style.display = 'none';

      this.menu.show();

      await sleep(50);

      // 3. Опускаем занавес
      await this.fade.toClear(650);
    } catch (err) {
      console.error('[app] exit to menu failed:', err);
      await this.fade.toClear(400);
    } finally {
      this._transitioning = false;
    }
  }

  _cleanupGame() {
    // Размораживаем интерполятор (иначе следующий запуск ничего не анимирует)
    this.interp.resume();
    this.interp.cancelAll();

    this._paused = false;

    if (this.session) {
	  if (this.session.jokerEl) {
        // позиция обновится через _repositionActionButton
      }
      this.session.destroy();
      this.session = null;
    }

    this.cards.length = 0;
    this.gameLayer.innerHTML = '';
	this.deckStackCards = null;
    this._sessionReady = false;
    this._resetAccordions();

    // снять возможные оверлеи от старой игры
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
  audio.pauseAllSfx();                 // ← добавить
  if (this.session) this.session.onPause?.();
  this.pauseOverlay.show();
}
_closePause() {
  if (!this._paused) return;
  this._paused = false;
  this.interp.resume();
  audio.resumeAllSfx();                // ← добавить
  if (this.session) this.session.onResume?.();
  this.pauseOverlay.hide();
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

/** Применяет GameSettings ко всем визуальным элементам сцены. */
_applySettings() {
	audio.setVolume(GameSettings.masterVolume ?? 0.8);
	audio.setSfxEnabled(GameSettings.sfxEnabled !== false);
	if (GameSettings.musicEnabled === false) audio.disableMusic();
	else audio.enableMusic();
	
  // карты
  Card.defaultCardStyle = GameSettings.cardStyle || 'grid';
  Card.defaultSuitStyle = GameSettings.suitStyle || 'gradient';
  Card.defaultShirtUrl  = ASSETS.shirts[GameSettings.shirtStyle ?? 0] || ASSETS.shirt;

  // стол
  const bg = document.getElementById('table-bg');
  if (bg) {
    const url = ASSETS.tables[GameSettings.tableStyle ?? 0] || ASSETS.tables[0];
    bg.style.backgroundImage = url ? `url("${url}")` : '';
  }

  // декорации
  const decor = document.getElementById('decor-layer');
  if (decor) {
    const idx = GameSettings.decorStyle;
    if (idx >= 0 && ASSETS.decorations[idx]) {
      decor.style.backgroundImage = `url("${ASSETS.decorations[idx]}")`;
    } else {
      decor.style.backgroundImage = '';
    }
  }

  // прогрев кеша под новый стиль
  warmUpDeck(Card.defaultCardStyle, Card.defaultSuitStyle);
}

  _setupMarkers() {
    this.tuner = installLayoutTuner({ onChange: () => this._relayoutAll() });
    this._relayoutAll();
    this.scene.onResize(() => this._relayoutAll());
  }

  _setupInput() {
    this.capture.onPress((x, y) => {
      if (!this._sessionReady || !this.session) return;
      if (this._paused) return;
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
      const cw = REAL_W, ch = REAL_H;
      this.deckStackCards.forEach((c, i) => {
        c.setPixelOffset(i * C.deckStackDx * cw, i * C.deckStackDy * ch);
        c.relayout(this.scene);
      });
    }

    if (this.accordionPlayer) this.accordionPlayer.relayout();
    if (this.accordionCpu)    this.accordionCpu.relayout();

    if (this.session) {
      if (this.session.slotUIs) for (const s of this.session.slotUIs) s.relayout();
      this.session._repositionActionButton();
      if (this.session.trumpSuitEl) {
        const trumpM = this.markers.get('trump');
        const p = this.scene.resolve(trumpM);
        this.session.trumpSuitEl.style.left = (p.x - REAL_W / 2) + 'px';
        this.session.trumpSuitEl.style.top  = (p.y - REAL_H / 2) + 'px';
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
  const W = this.scene.width, H = this.scene.height;
  const C = SceneLayout.config;
  const L = C.frameL * W;
  const T = C.frameT * H;
  // небольшой адаптивный размер: 40–56px
  const size = Math.max(60, Math.min(76, Math.min(W, H) * 0.055));
  this.settingsBtn.style.left   = L + 'px';
  this.settingsBtn.style.top    = T + 'px';
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
    // если картинки вообще нет — показываем символ
    im.remove();
    btn.textContent = '⚙';
  };
  btn.appendChild(im);

  btn.addEventListener('click', () => {
    audio.playSfx('tap');                 // ← добавить
    this._openPause();
  });
  document.body.appendChild(btn);
  this.settingsBtn = btn;
  this._positionSettingsButton();
}

  /* ================================================================
   *  Аккордеоны — создаём один раз
   * ================================================================ */

  _createAccordions() {
    this.accordionPlayer = new Accordion({
      scene: this.scene, interp: this.interp,
      anchorL: this.markers.get('acc_player_L'),
      anchorR: this.markers.get('acc_player_R'),
      insertAnchor: this.markers.get('ins_player_L'),
      baseMinDist: 88, fanDir: +1,
    });
    this.accordionCpu = new Accordion({
      scene: this.scene, interp: this.interp,
      anchorL: this.markers.get('acc_cpu_L'),
      anchorR: this.markers.get('acc_cpu_R'),
      insertAnchor: this.markers.get('ins_cpu_L'),
      baseMinDist: 88, fanDir: -1,
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  // кнопка настроек нужна только в игре — создаём её после первой инициализации
  app._createSettingsButton();
});