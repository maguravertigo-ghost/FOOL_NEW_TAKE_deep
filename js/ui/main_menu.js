import { ysdk } from '../sdk/yandex_sdk.js';
import { audio } from '../audio/audio_engine.js';
import { withLoading } from './loading_overlay.js';
import { ASSETS } from '../assets.js';
import { GameSettings, saveSettings } from '../game/settings.js';
  import {
    Progress, saveProgress, claimQuestReward, resetQuests,
    activeOrder, isTestModeUnlocked,
    PRICES, isPurchased, purchaseItem,
    claimableRanks,
    markStyleItemSeen, isStyleItemSeen, hasUnseenStyleItems,
    getTempMatchesLeft, isTempItem,
  } from '../game/progress.js';
import { showMessage, showConfirm } from './message_overlay.js';
import { spawnCard, clearCache, warmUpDeck } from '../game/card_cache.js';
import { Card } from '../game/card.js';

import { HudLayout } from './hud_layout.js';
import { uiScale } from './ui_scale.js';
import { bus } from '../core/event_bus.js';
import { attachTokenMark } from './fool_token_mark.js';

export class MainMenu {
  constructor({ onStartGame }) {
    this.onStartGame = onStartGame;
    this._selectedStyle = { shirt: 0, design: 0, suits: 0, table: 0, decor: 0 };

    this.el = document.createElement('div');
    this.el.id = 'main-menu';
    this.el.innerHTML = `
      <div class="mm-bg"></div>

	<!-- ЛЕВЫЙ ВЕРХ: статистика -->
	<div class="mm-top-left">
	  <div class="mm-stat-block">
		<div class="mm-stat-row"><span>ИГР СЫГРАНО:</span><b>${Progress.stats.games}</b></div>
		<div class="mm-stat-row"><span>ПОБЕД:</span><b>${Progress.stats.wins}</b></div>
		<div class="mm-stat-row"><span>ПОРАЖЕНИЙ:</span><b>${Progress.stats.losses}</b></div>
		<div class="mm-stat-row"><span>НИЧЬИХ:</span><b>${Progress.stats.draws}</b></div>
	  </div>
	</div>

	<!-- ПРАВЫЙ ВЕРХ: очки стиля + кнопка КАК ИГРАТЬ -->
	<div class="mm-top-right">
	  <div class="mm-style-points">
		<span class="mm-style-points__label">ОЧКИ СТИЛЯ:</span>
		<b class="mm-style-points__value">${Progress.stylePoints}</b>
	  </div>
	  <button class="mm-corner" data-open="help">КАК ИГРАТЬ</button>
	  <button class="mm-corner mm-corner--fs" data-fs-toggle title="На весь экран"></button>
	</div>

	<!-- ЦЕНТР: лого, кнопки, автор -->
	<div class="mm-center">
	  <div class="mm-logo"></div>
	  <div class="mm-buttons">
		<button class="mm-btn mm-btn--mode" data-mode="podkidnoy"></button>
		<button class="mm-btn mm-btn--mode" data-mode="perevodnoy"></button>
	  </div>
	  <div class="mm-author">segurakaa</div>
	</div>

	<!-- ЛЕВЫЙ НИЗ: снизу вверх — НАСТРОЙКИ, ОБ ИГРЕ -->
	<div class="mm-bottom-left">
	  <button class="mm-corner" data-open="settings">НАСТРОЙКИ</button>
	  <button class="mm-corner" data-open="about">ОБ ИГРЕ</button>
	</div>

	<!-- ПРАВЫЙ НИЗ: снизу вверх — МАГАЗИНЧИК, СТИЛЬ, КВЕСТ -->
	<div class="mm-bottom-right">
	  <button class="mm-corner" data-open="shop">МАГАЗИНЧИК</button>
	  <button class="mm-corner" data-open="style">СТИЛЬ</button>
	  <button class="mm-corner mm-corner--quest" data-open="quest">КВЕСТ</button>
	</div>   `
	;
	this.el.style.display = 'none';
	document.getElementById('scene').appendChild(this.el);

    // фон
    this.el.querySelector('.mm-bg').style.backgroundImage = `url("${ASSETS.mainMenuBg}")`;

    // лого
    const img = document.createElement('img');
    img.src = ASSETS.logoMain;
    img.alt = 'Fool';
    img.style.cssText = 'display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;pointer-events:none;';
    this.el.querySelector('.mm-logo').appendChild(img);

    // картинки кнопок режимов
    const modeImgs = { podkidnoy: ASSETS.btnPodkidnoy, perevodnoy: ASSETS.btnPerevodnoy };
    this.el.querySelectorAll('[data-mode]').forEach(btn => {
      const src = modeImgs[btn.dataset.mode];
      if (!src) return;
      const im = document.createElement('img');
      im.src = src;
      im.alt = '';
      im.draggable = false;
      btn.appendChild(im);
    });

    this.el.querySelectorAll('[data-mode]').forEach(btn =>
      btn.addEventListener('click', () => {
        if (this._activeOverlay) return;
		audio.playSfx('switch');
        this.onStartGame?.(btn.dataset.mode);
      })
    );

	this.el.querySelectorAll('[data-open]').forEach(btn =>
	  btn.addEventListener('click', () => {
		if (this._activeOverlay) return;
		audio.playSfx('tap');
		this._openOverlay(btn.dataset.open);
	  })
	);

    const fsBtn = this.el.querySelector('[data-fs-toggle]');
    if (fsBtn) {
      // Иконка (SVG), вписываем 64%×64% — как кнопка паузы в матче
      const fsImg = document.createElement('img');
      fsImg.src = ASSETS.fullscreenIcon;
      fsImg.alt = '';
      fsImg.draggable = false;
      fsImg.style.cssText =
        'display:block;width:64%;height:64%;object-fit:contain;pointer-events:none;';
      fsImg.onerror = () => {
        // Фолбэк — если иконка не загрузилась
        fsImg.remove();
        fsBtn.textContent = '⛶';
        fsBtn.style.fontSize = 'calc(22px * var(--ui))';
      };
      fsBtn.appendChild(fsImg);

      const updateIcon = () => {
        const on = document.fullscreenElement ||
                   ysdk.getFullscreenStatus() === 'on';
        // textContent НЕ трогаем — иконка уже в кнопке
        fsBtn.setAttribute('title', on ? 'Выйти из полноэкранного режима' : 'На весь экран');
        fsBtn.dataset.state = on ? 'on' : 'off';
      };
      updateIcon();

// iOS Safari не поддерживает полноэкранный режим для веб-страниц.
// Прячем кнопку на iOS — она бессмысленна.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

if (isIOS) {
  fsBtn.style.display = 'none';
} else {
  fsBtn.addEventListener('click', async () => {
    audio.playSfx('tap');
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);

    try {
      if (isFs) {
        const exitFn = document.exitFullscreen || document.webkitExitFullscreen;
        if (exitFn) await exitFn.call(document);
      } else {
        const el = document.documentElement;
        const reqFn = el.requestFullscreen || el.webkitRequestFullscreen;
        if (reqFn) {
          await reqFn.call(el);
        } else {
          // Фолбэк через SDK (если нативный API недоступен)
          await ysdk.requestFullscreen();
        }
      }
    } catch (e) {
      console.warn('[fs] toggle error:', e);
      showMessage(
        'Браузер не разрешил переключить полноэкранный режим. ' +
        'Нажмите <b>F11</b> или используйте меню браузера.',
        { title: 'Полный экран' }
      );
    }
    setTimeout(updateIcon, 150);
  });
}

      document.addEventListener('fullscreenchange', updateIcon);
      document.addEventListener('webkitfullscreenchange', updateIcon);
    }

    this._overlays = { about: null, shop: null, settings: null, style: null, quest: null, help: null };
    this._activeOverlay = null;
    this._previewOverlay = null;
    this._shopCategory = null;
	
	const sceneEl = document.getElementById('scene');
	this.hud = new HudLayout(sceneEl);

	// Реагируем на изменение размера #scene, а не окна —
	// так ловим и F11, и смену ориентации, и появление рекламы
	this._ro = new ResizeObserver(() => {
	  if (this.el.style.display !== 'none') this._layoutAll();
	});
	this._ro.observe(sceneEl);
	
    // после создания DOM:
    this._cacheRefs();
    this._layoutAll();
	this._setupKeyboardNav();
  }
_cacheRefs() {
  this.refs = {
    center:   this.el.querySelector('.mm-center'),
    logo:     this.el.querySelector('.mm-logo'),
    btn0:     this.el.querySelector('[data-mode="podkidnoy"]'),
    btn1:     this.el.querySelector('[data-mode="perevodnoy"]'),
    author:   this.el.querySelector('.mm-author'),
    stats:    this.el.querySelector('.mm-top-left .mm-stat-block'),
    stylePts: this.el.querySelector('.mm-top-right .mm-style-points'),
    helpBtn:  this.el.querySelector('.mm-top-right [data-open="help"]'),
    sideL:    this.el.querySelectorAll('.mm-bottom-left .mm-corner'),
    sideR:    this.el.querySelectorAll('.mm-bottom-right .mm-corner'),
	questBtn: this.el.querySelector('[data-open="quest"]'),
	fsBtn: this.el.querySelector('[data-fs-toggle]'),
  };
}
_layoutAll() {
  this.hud.update();
  const H = this.hud;

  // --- Лого ---
  const lg = H.rectLogo();
  Object.assign(this.refs.logo.style, {
    position: 'absolute',
    left:   lg.left   + 'px',
    top:    lg.top    + 'px',
    width:  lg.width  + 'px',
    height: lg.height + 'px',
  });

  // --- Кнопки режимов ---
  const b0 = H.rectBtn0();
  const b1 = H.rectBtn1();
  for (const [el, r] of [[this.refs.btn0, b0], [this.refs.btn1, b1]]) {
    Object.assign(el.style, {
      position: 'absolute',
      left:   r.left + 'px',
      top:    r.top  + 'px',
      width:  r.width + 'px',
      height: r.height + 'px',
    });
    const img = el.querySelector('img');
    if (img) {
      img.style.padding   = '0';
      img.style.boxSizing = 'border-box';
      img.style.width     = 'auto';
      img.style.height    = '100%';
      img.style.maxWidth  = '100%';
      img.style.objectFit = 'contain';
      img.style.display   = 'block';
    }
  }

  // --- Автор ---
  const au = H.rectAuthor();
  Object.assign(this.refs.author.style, {
    position: 'absolute',
    left: H.px(683) + 'px',
    top:  au.top + 'px',
    transform: 'translateX(-50%)',
    height: au.height + 'px',
    lineHeight: au.height + 'px',
    fontSize: H.s(14) + 'px',
  });

  // --- Статистика (левый верх) ---
  const st = H.rectStats();
  Object.assign(this.refs.stats.style, {
    position: 'absolute',
    left: st.left + 'px',
    top:  st.top  + 'px',
    width:  st.width + 'px',
    height: st.height + 'px',
    minWidth: '0',
    padding: `${H.s(14)}px ${H.s(18)}px`,
    boxSizing: 'border-box',
    fontSize: H.s(H.isMobile ? 22 : 16) + 'px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  });

  // --- Очки стиля (правый верх) ---
  const sp = H.rectStylePoints();
  Object.assign(this.refs.stylePts.style, {
    position: 'absolute',
    left: sp.left + 'px',
    top:  sp.top  + 'px',
    width:  sp.width + 'px',
    height: sp.height + 'px',
    minWidth: '0',
    padding: `${H.s(14)}px ${H.s(18)}px`,
    boxSizing: 'border-box',
    fontSize: H.s(H.isMobile ? 22 : 16) + 'px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    textAlign: 'right',
  });

  // --- Кнопка КАК ИГРАТЬ ---
  if (this.refs.helpBtn) {
    const hp = H.rectHelpButton();
    Object.assign(this.refs.helpBtn.style, {
      position: 'absolute',
      left:   hp.left + 'px',
      top:    hp.top  + 'px',
      width:  hp.width + 'px',
      height: hp.height + 'px',
      fontSize: H.s(H.isMobile ? 18 : 15) + 'px',
      padding: `${H.s(8)}px ${H.s(14)}px`,
      boxSizing: 'border-box',
      whiteSpace: 'nowrap',
      overflow: 'visible',
      letterSpacing: H.s(1) + 'px',
    });
  }

  // --- Кнопка "На весь экран" — под блоком статистики, слева ---
  if (this.refs.fsBtn) {
    const st = H.rectStats();
    const fsz = H.s(H.isMobile ? 64 : 56);
    const gap = H.s(10);
    Object.assign(this.refs.fsBtn.style, {
      position: 'absolute',
      left:  st.left + 'px',
      top:   (st.top + st.height + gap) + 'px',
      width:  fsz + 'px',
      height: fsz + 'px',
      padding: '0',
      boxSizing: 'border-box',
    });
  }

  // --- Боковые кнопки ---
  const lb = H.rectLeftButtons(this.refs.sideL.length);
  this.refs.sideL.forEach((el, i) => {
    const r = lb[i];
    Object.assign(el.style, {
      position: 'absolute',
      left:   r.left + 'px',
      top:    r.top  + 'px',
      width:  r.width + 'px',
      height: r.height + 'px',
      fontSize: H.s(H.isMobile ? 26 : 17) + 'px',
      padding: `${H.s(10)}px ${H.s(14)}px`,
      boxSizing: 'border-box',
    });
  });

  const rb = H.rectRightButtons(this.refs.sideR.length);
  this.refs.sideR.forEach((el, i) => {
    const r = rb[i];
    Object.assign(el.style, {
      position: 'absolute',
      left:   r.left + 'px',
      top:    r.top  + 'px',
      width:  r.width + 'px',
      height: r.height + 'px',
      fontSize: H.s(H.isMobile ? 26 : 17) + 'px',
      padding: `${H.s(10)}px ${H.s(14)}px`,
      boxSizing: 'border-box',
    });
  });
}

show() {
  this.el.style.display = 'block';
  this._refreshStats();
  this._closeOverlay();
  this._layoutAll();
  bus.resume('ui.main-menu');
}
  hide() {
    this.el.style.display = 'none';
    this._closeOverlay();
    bus.pause('ui.main-menu');
  }

_refreshStats() {
  const set = (label, val) => {
    const rows = this.el.querySelectorAll('.mm-stat-row');
    for (const r of rows) {
      const span = r.querySelector('span');
      if (span && span.textContent.startsWith(label)) {
        const b = r.querySelector('b');
        if (b) b.textContent = val;
      }
    }
  };
  set('ИГР СЫГРАНО', Progress.stats.games);
  set('ПОБЕД',       Progress.stats.wins);
  set('ПОРАЖЕНИЙ',   Progress.stats.losses);
  set('НИЧЬИХ',      Progress.stats.draws);

  const sp = this.el.querySelector('.mm-style-points__value');
  if (sp) sp.textContent = Progress.stylePoints;
    // ---- иконка «есть непроклеймленные награды» на кнопке КВЕСТ ----
    this._updateQuestBadge();
    this._updateFoolTokenMarks();
    this._updateStyleBadge();
  }

  _updateStyleBadge() {
    const btn = this.el.querySelector('[data-open="style"]');
    if (!btn) return;

    const hasNew = hasUnseenStyleItems();
    let badge = btn.querySelector('.new-badge');

    if (!hasNew) {
      if (badge) badge.remove();
      return;
    }
    if (badge) return;

    badge = document.createElement('img');
    badge.className = 'new-badge';
    badge.src = ASSETS.newOneIcon;
    badge.alt = '';
    badge.draggable = false;
    btn.appendChild(badge);
  }

_updateQuestBadge() {
  const btn = this.refs.questBtn;
  if (!btn) return;

  const hasPending = claimableRanks().length > 0;
  let chip = btn.querySelector('.poker-chip');

  if (!hasPending) {
    if (chip) chip.remove();
    return;
  }
  if (chip) return;

  chip = document.createElement('div');
  chip.className = 'poker-chip';
  chip.style.webkitMaskImage = `url("${ASSETS.pokerChip}")`;
  chip.style.maskImage =       `url("${ASSETS.pokerChip}")`;
  btn.appendChild(chip);
}

  _updateFoolTokenMarks() {
    // --- Кнопки режимов ---
    const buttons = this.el.querySelectorAll('[data-mode]');
    const token = Progress.foolToken;

    // снимаем все старые метки
    for (const btn of buttons) {
      btn.querySelectorAll(':scope > .fool-token').forEach(el => el.remove());
    }

    if (token && token.owner === 'player') {
      const btn = this.el.querySelector(`[data-mode="${token.mode}"]`);
      if (btn) {
        const img = document.createElement('img');
        img.className = 'fool-token fool-token--tr';
        img.src = ASSETS.foolToken;
        img.alt = '';
        img.draggable = false;
        const sizePx = this.hud.s(77.6);   // 0.8 × 97 (ref-px высоты кнопки)
        img.style.height = sizePx + 'px';
        img.style.width = 'auto';
        btn.appendChild(img);
      }
    }

    // --- Обновляем метки на джокерах, если они уже построены ---
    const aboutJoker = this.el.querySelector('.mm-about-joker');
    if (aboutJoker) attachTokenMark(aboutJoker, {
      side: 'cpu', corner: 'br',
      heightCss: 'calc(60px * var(--ui))'
    });

    const shopJoker = this.el.querySelector('.shop-joker-wrap');
    if (shopJoker) attachTokenMark(shopJoker, {
      side: 'cpu', corner: 'br',
      heightCss: 'calc(60px * var(--ui))'
    });
  }

  /* ---------------- оверлеи ---------------- */

  _openOverlay(name) {
    // Запомнить позицию в меню и способ открытия (клавиатура/мышь)
    this._navReturnPos = { ...this._navPos };
    this._navReturnWasKeyboard = this._lastInputWasKeyboard === true;

    if (name === 'settings') return this._openSettings();
    if (name === 'style')    return this._openStyle();
    if (name === 'quest')    return this._openQuest();
    if (name === 'help')     return this._openHelp();
    if (name === 'shop')     return this._openShop();
    const ov = this._getSimpleOverlay(name);
    if (!ov) return;
    ov.style.display = 'flex';
    this._activeOverlay = ov;
    requestAnimationFrame(() => this._autoFocusOverlay(ov));
  }
  _closeOverlay() {
    if (this._previewOverlay) { this._previewOverlay.remove(); this._previewOverlay = null; }

    const activeOv = this._activeOverlay;
    if (activeOv) {
      activeOv.style.display = 'none';
      // Снимаем фокус только внутри закрываемого оверлея
      activeOv.querySelectorAll('.kbd-focus').forEach(e => e.classList.remove('kbd-focus'));
      this._activeOverlay = null;
    }
    this._overlayNavEl = null;

    // Восстановление фокуса в меню — «remember cursor»
    const pos = this._navReturnPos;
    const wasKbd = this._navReturnWasKeyboard;
    this._navReturnPos = null;
    this._navReturnWasKeyboard = false;

    if (pos && this._grid) {
      this._navPos = pos;
      this.el.querySelectorAll('.kbd-focus').forEach(e => e.classList.remove('kbd-focus'));
      this._navEl = this._navCellEl?.(this._grid[pos.r]?.[pos.c]) || null;
      if (this._navEl && wasKbd) this._navEl.classList.add('kbd-focus');
    }

    // Сброс внутренних навигаторов оверлеев
    this._settingsNav = null;
    this._questNav = null;
    this._styleNav = null;
    this._shopPendingFocus = null;
  }
  _getSimpleOverlay(name) {
    if (this._overlays[name]) return this._overlays[name];
    let el = null;
    if (name === 'about') el = this._buildAbout();
    if (el) { this.el.appendChild(el); this._overlays[name] = el; }
    return el;
  }

  _setupKeyboardNav() {
    // ---- Сетка 3×4 (сверху вниз, слева направо). null = пустая ячейка ----
    this._grid = [
      ['fs',       null,         'help'],
      [null,       'mode0',      'quest'],
      ['about',    'mode1',      'style'],
      ['settings', null,         'shop'],
    ];
    this._navPos = { r: 0, c: 0 };
    this._navEl = null;
    this._lastInputWasKeyboard = false;
    this._navReturnPos = null;
    this._navReturnWasKeyboard = false;

    this._navCellEl = (id) => {
      if (!id) return null;
      switch (id) {
        case 'fs':       return this.el.querySelector('[data-fs-toggle]');
        case 'help':     return this.el.querySelector('[data-open="help"]');
        case 'quest':    return this.el.querySelector('[data-open="quest"]');
        case 'style':    return this.el.querySelector('[data-open="style"]');
        case 'shop':     return this.el.querySelector('[data-open="shop"]');
        case 'about':    return this.el.querySelector('[data-open="about"]');
        case 'settings': return this.el.querySelector('[data-open="settings"]');
        case 'mode0':    return this.el.querySelector('[data-mode="podkidnoy"]');
        case 'mode1':    return this.el.querySelector('[data-mode="perevodnoy"]');
      }
      return null;
    };
    const cellEl = this._navCellEl;

    const rows = this._grid.length;
    const cols = this._grid[0].length;
    const mod  = (n, m) => ((n % m) + m) % m;
    const isEmpty = (r, c) => !this._grid[r] || !this._grid[r][c];

    // Для ↑/↓: гравитация в направлении dy с wrap (зацикливаем).
    const findInColumnDir = (c, startRow, dy) => {
      let r = mod(startRow, rows);
      for (let i = 0; i < rows; i++) {
        if (!isEmpty(r, c)) return r;
        r = mod(r + dy, rows);
      }
      return -1;
    };

    // Для ←/→: гравитация вниз; если до конца пусто — вверх до ближайшей.
    const findInColumnVert = (c, startRow) => {
      for (let r = startRow; r < rows; r++) {
        if (!isEmpty(r, c)) return r;
      }
      for (let r = startRow - 1; r >= 0; r--) {
        if (!isEmpty(r, c)) return r;
      }
      return -1;
    };

    const focusCurrent = () => {
      this.el.querySelectorAll('.kbd-focus').forEach(e => e.classList.remove('kbd-focus'));
      this._navEl = cellEl(this._grid[this._navPos.r]?.[this._navPos.c]);
      if (this._navEl) this._navEl.classList.add('kbd-focus');
    };

    const moveH = (dx) => {
      const { r, c } = this._navPos;
      let nc = mod(c + dx, cols);
      let nr = findInColumnVert(nc, r);

      // Если столбец полностью пустой — идём дальше в том же направлении
      if (nr < 0) {
        for (let k = 1; k < cols; k++) {
          nc = mod(nc + dx, cols);
          nr = findInColumnVert(nc, r);
          if (nr >= 0) break;
        }
      }
      if (nr < 0) return;
      this._navPos = { r: nr, c: nc };
      focusCurrent();
    };

    const moveV = (dy) => {
      const { r, c } = this._navPos;
      let nr = mod(r + dy, rows);
      // Гравитация в направлении dy (с wrap)
      const fr = findInColumnDir(c, nr, dy);
      if (fr < 0) return;
      this._navPos = { r: fr, c };
      focusCurrent();
    };

    focusCurrent();

    window.addEventListener('keydown', (e) => {
      if (this.el.style.display === 'none') return;

      // === Модалки поверх оверлея (подтверждение покупки/квеста) ===
      if (document.querySelector('.msg-overlay')) {
        this._navigateMsg(e);
        return;
      }

      // === Предпросмотр стиля ===
      // Enter/Space — закрыть. Esc обрабатывается в app.js через _onEscape.
      if (this._previewOverlay) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // пока висит лоадер — игнорируем
          if (document.querySelector('.loading-overlay')) return;
          this._lastInputWasKeyboard = true;
          audio.playSfx('tap_up');
          this._previewOverlay.remove();
          this._previewOverlay = null;
        }
        return;
      }

      // === Оверлей открыт — обрабатываем навигацию в нём ===
      if (this._activeOverlay) {
        // Магазин — категории или витрина
        if (this._activeOverlay.querySelector('.shop-box')) {
          this._navigateShop(e);
          return;
        }
		// Справка — прокрутка контента + кнопки ↑/↓/В МЕНЮ
        if (this._activeOverlay.querySelector('.help-body')) {
          this._navigateHelp(e);
          return;
        }
		// Стиль — табы + плитки + кнопки
        if (this._activeOverlay.querySelector('.mm-tabs')) {
          this._navigateStyle(e);
          return;
        }
        // Настройки — сетка «строки + опции»
        if (this._activeOverlay.querySelector('.mm-rows')) {
          this._navigateSettings(e);
          return;
        }
        // Квест — сетка 2×2 (claim/close сверху, reset снизу)
        if (this._activeOverlay.querySelector('.mm-quest-list')) {
          this._navigateQuest(e);
          return;
        }
        // Простые оверлеи (about, help-header и т.п.)
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this._lastInputWasKeyboard = true;
          if (this._overlayNavEl) {
            audio.playSfx('tap');
            this._overlayNavEl.click();
          }
          return;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          this._lastInputWasKeyboard = true;
        }
        return;
      }

      if (document.getElementById('game-over')) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this._lastInputWasKeyboard = true;
          moveV(-1);
          return;
        case 'ArrowDown':
          e.preventDefault();
          this._lastInputWasKeyboard = true;
          moveV(+1);
          return;
        case 'ArrowLeft':
          e.preventDefault();
          this._lastInputWasKeyboard = true;
          moveH(-1);
          return;
        case 'ArrowRight':
          e.preventDefault();
          this._lastInputWasKeyboard = true;
          moveH(+1);
          return;
        case 'Enter':
        case ' ':
          e.preventDefault();
          this._lastInputWasKeyboard = true;
          if (this._navEl) { audio.playSfx('tap'); this._navEl.click(); }
          return;
      }
    });


    // Клик мышью — сбрасываем клавиатурный фокус
    this.el.addEventListener('pointerdown', (e) => {
      this._lastInputWasKeyboard = false;
      this.el.querySelectorAll('.kbd-focus').forEach(el => el.classList.remove('kbd-focus'));
      this._navEl = null;

      // Если открыт оверлей настроек — синхронизировать _settingsNav
      if (this._activeOverlay && this._activeOverlay.querySelector('.mm-rows')) {
        const opt = e.target.closest('.mm-opt');
        if (opt) {
          const rowEl = opt.closest('.mm-row');
          const rows = [...this._activeOverlay.querySelectorAll('.mm-row')];
          const idx = rows.indexOf(rowEl);
          if (idx >= 0) this._settingsNav = { row: idx };
        } else if (e.target.closest('[data-close]')) {
          this._settingsNav = { row: -1 };
        }
        return;
      }

      // Если открыт оверлей квеста — синхронизировать _questNav
      if (this._activeOverlay && this._activeOverlay.querySelector('.mm-quest-list')) {
        if (e.target.closest('[data-claim]'))      this._questNav = { row: 0, col: 0 };
        else if (e.target.closest('[data-close]')) this._questNav = { row: 0, col: 1 };
        else if (e.target.closest('[data-reset]')) this._questNav = { row: 1, col: 0 };
        return;
      }

      // Синхронизировать _navPos с кнопкой, на которую кликнули мышью
      const target = e.target.closest('[data-open], [data-mode], [data-fs-toggle]');
      if (!target) return;
      let id = null;
      if (target.dataset.open) id = target.dataset.open;
      else if (target.dataset.mode === 'podkidnoy') id = 'mode0';
      else if (target.dataset.mode === 'perevodnoy') id = 'mode1';
      else if (target.hasAttribute('data-fs-toggle')) id = 'fs';
      if (!id) return;
      for (let r = 0; r < this._grid.length; r++) {
        const c = this._grid[r].indexOf(id);
        if (c >= 0) { this._navPos = { r, c }; break; }
      }
    });


  }

  /* ---------------- ABOUT (с joker_lies) ---------------- */

  _buildAbout() {
    const el = document.createElement('div');
    el.className = 'mm-overlay';
    el.innerHTML = `
      <div class="mm-overlay__box mm-overlay__box--about">
        <div class="mm-overlay__body mm-overlay__body--scroll">
          <p><b>Игра в дурака</b> — классика русской карточной игры.</p>
          <p>Автор кода и оформления: <b>Segura Kaa</b></p>
          <p>2024 ©</p>
        </div>
        <div class="mm-about-joker">
          <img src="${ASSETS.jokerLies}" alt="">
        </div>
        <button class="mm-btn mm-btn--small" data-close>В МЕНЮ</button>
      </div>`;
    this._bindClose(el);
	attachTokenMark(el.querySelector('.mm-about-joker'), {
      side: 'cpu', corner: 'br',
      heightCss: 'calc(60px * var(--ui))'
    });
    return el;
  }

  /* ---------------- HELP ---------------- */

  _openHelp() {
    let ov = this._overlays.help;
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'mm-overlay';
      ov.innerHTML = `
        <div class="mm-overlay__box mm-overlay__box--full">
          <div class="mm-overlay__header">
            <div class="mm-overlay__title">СПРАВКА</div>
            <div class="help-nav">
              <button class="mm-btn mm-btn--small help-nav__btn" data-help-up title="Прокрутить вверх">↑</button>
              <button class="mm-btn mm-btn--small help-nav__btn" data-help-down title="Прокрутить вниз">↓</button>
              <button class="mm-btn mm-btn--small" data-close>В МЕНЮ</button>
            </div>
          </div>
          <div class="mm-overlay__body mm-overlay__body--scroll help-body">

            <div class="help-intro">
              <b>Fool</b> — карточная игра в дурака против Джокера.
              Выигрывайте матчи, выполняйте квесты, зарабатывайте очки стиля
              и открывайте новое оформление игры.
            </div>

            <div class="help-section">
              <div class="help-section__title">Цель игры</div>
              <div class="help-section__text">
                Сбросить все карты раньше соперника. Кто остался с картами — тот «дурак».
                Каждому раздаётся по 6 карт. Верхняя карта колоды — козырь.
              </div>
            </div>

            <div class="help-section">
              <div class="help-section__title">Ход игры</div>
              <div class="help-section__text">
                <b>Атака.</b> Первый игрок кладёт карту — атакует.<br>
                <b>Защита.</b> Второй должен побить карту старшей той же масти или любым козырем.<br>
                <b>Подкидывание.</b> После отбоя атакующий может подкинуть карты того же ранга, что уже лежат на столе.<br>
                <b>Взятие.</b> Если отбиться нечем — защитник забирает все карты со стола.<br>
                <b>Козырь.</b> Бьёт любую некозырную. Козырь бьётся только козырем старшего ранга.
              </div>
            </div>

            <div class="help-section">
              <div class="help-section__title">Режимы игры</div>
              <div class="help-section__text">
                <b>Подкидной.</b> Классический режим. Защитник только отбивается или берёт.<br>
                <b>Переводной.</b> До первого отбоя защитник может перевести атаку на атакующего — положить карту того же ранга. Роли меняются.
              </div>
            </div>

            <div class="help-section">
              <div class="help-section__title">Жеребьёвка — монета Джокера</div>
              <div class="help-section__row">
                <div class="help-coins">
                  <div class="help-coin">
                    <img src="${ASSETS.coinFrames[0]}" alt="">
                    <span>Джокер<br>ходит первым</span>
                  </div>
                  <div class="help-coin">
                    <img src="${ASSETS.coinFrames[4]}" alt="">
                    <span>Игрок<br>ходит первым</span>
                  </div>
                </div>
                <div class="help-section__text">
                  В начале самого первого матча (и после каждой ничьей) проводится жеребьёвка.
                  Монета определяет, кто ходит первым и первым получает карты.
                </div>
              </div>
            </div>

            <div class="help-section">
              <div class="help-section__title">Жетон дурака</div>
              <div class="help-section__row">
                <div class="help-section__img">
                  <img src="${ASSETS.foolToken}" alt="">
                </div>
                <div class="help-section__text">
                  Кто проиграл матч — получает <b>жетон дурака</b>.
                  Во всех следующих матчах обладатель жетона получает карты вторым,
                  а соперник — первым. При ничьей жетон сбрасывается,
                  и следующий матч снова начинается с жеребьёвки.
                  <br><br>
                  Жетон виден на кнопке режима в главном меню
                  (если дурак — игрок) или на джокере в окнах
                  (если дурак — ИИ).
                </div>
              </div>
            </div>

            <div class="help-section">
              <div class="help-section__title">Погоны и галстук</div>
              <div class="help-section__row">
                <div class="help-section__img help-section__img--row">
                  <img src="${ASSETS.pogon}" alt="">
                  <img src="${ASSETS.galstuk}" alt="">
                </div>
                <div class="help-section__text">
                  Если вы заканчиваете матч, выкидывая подряд несколько карт одного ранга,
                  вы «вешаете погоны» джокеру:
                  <br><br>
                  • 1 карта → <b>1 погон</b><br>
                  • 2 карты → <b>2 погона</b><br>
                  • 3+ карт → <b>2 погона + галстук</b>
                  <br><br>
                  За погоны начисляется <b>+250 очков стиля</b>.
                  Событие срабатывает, если игрок сам нажимает кнопку
                  <b>ПОГОНЫ!</b> в финальном раунде.
                </div>
              </div>
            </div>

            <div class="help-section">
              <div class="help-section__title">Очки стиля</div>
              <div class="help-section__row">
                <div class="help-section__img">
                  <img src="${ASSETS.jokerSetNice}" alt="">
                </div>
                <div class="help-section__text">
                  Внутренняя валюта игры. Зарабатываются так:
                  <br><br>
                  • <b>100</b> — за победу<br>
                  • <b>+250</b> — за погоны<br>
                  • <b>250 + 50×N</b> — за квест (N — прогресс)
                  <br><br>
                  Тратятся в <b>Магазинчике Джокера</b> на оформление игры.
                </div>
              </div>
            </div>

            <div class="help-section">
              <div class="help-section__title">Квест</div>
              <div class="help-section__row">
                <div class="help-section__img">
                  <img src="${ASSETS.pokerChip}" alt="">
                </div>
                <div class="help-section__text">
                  Квест — серия задач. Каждый квест — выкинуть определённую карту
                  последней или в наборе. Квесты идут по порядку: следующий
                  открывается, когда выполнен предыдущий.
                  <br><br>
                  Значок на кнопке <b>КВЕСТ</b> в меню означает, что есть
                  непроклеймленные награды.
                </div>
              </div>
            </div>

            <div class="help-section">
              <div class="help-section__title">Магазинчик и Стиль</div>
              <div class="help-section__row">
                <div class="help-section__icons">
                  <img src="${ASSETS.shopIcons.shirt}" alt="">
                  <img src="${ASSETS.shopIcons.design}" alt="">
                  <img src="${ASSETS.shopIcons.suits}" alt="">
                  <img src="${ASSETS.shopIcons.table}" alt="">
                  <img src="${ASSETS.shopIcons.decor}" alt="">
                </div>
                <div class="help-section__text">
                  В <b>Магазинчике</b> покупаются рубашки карт, оформление лиц,
                  масти, столы и декорации. Категории подсвечиваются
                  зелёным, если в них есть товар, который вы можете купить.
                  <br><br>
                  Купленные элементы открываются в разделе <b>СТИЛЬ</b> —
                  там их можно применить к текущему матчу.
                </div>
              </div>
            </div>

            <div class="help-section">
              <div class="help-section__title">Значки в меню</div>
              <div class="help-section__row">
                <div class="help-section__img help-section__img--row">
                  <img src="${ASSETS.newOneIcon}" alt="">
                  <img src="${ASSETS.pokerChip}" alt="">
                </div>
                <div class="help-section__text">
                  <b>NEW</b> на плитке в СТИЛЬ — элемент куплен, но ещё
                  не открыт. Кликните по нему — значок исчезнет. Если
                  на кнопке СТИЛЬ в меню горит NEW, значит есть непросмотренные элементы.
                  <br><br>
                  <b>Фишка</b> на кнопке КВЕСТ — есть непроклеймленные награды.
                </div>
              </div>
            </div>

            <div class="help-section">
              <div class="help-section__title">Настройки</div>
              <div class="help-section__text">
                • <b>Звуки и музыка</b> — включение/отключение.<br>
                • <b>Карт в колоде</b> — 36 или 52 карты.<br>
                • <b>Карты в руке</b> — веер или прямая линия.<br>
                • <b>Подсказки хода</b> — красные метки на нелегальных картах.<br>
                • <b>Счётчик колоды</b> — число оставшихся карт на колоде.<br>
                • <b>Уровень AI</b> — новичок / обычный / эксперт.
              </div>
            </div>

			<div class="help-section">
			  <div class="help-section__title">Громкость и пауза</div>
			  <div class="help-section__text">
				Во время матча громкость музыки и звуков регулируется в окне
				<b>ПАУЗА</b> — оно открывается кнопкой с шестерёнкой в левом верхнем
				углу сцены или клавишей <b>Esc</b>. Там же — «Продолжить игру»
				и «Выйти в главное меню».
				<br><br>
				В главном меню звуки и музыку можно полностью отключить
				в <b>НАСТРОЙКАХ</b>.
			  </div>
			</div>

			<div class="help-section">
			  <div class="help-section__title">Управление — мышь и касание</div>
			  <div class="help-section__text">
				<b>Выбор карты.</b> Клик / касание по карте в руке — карта приподнимается
				и подсвечиваются доступные слоты на столе.<br>
				<b>Ход.</b> Клик по подсвеченному слоту — карта летит туда.
				Повторный клик по самой карте — снять выбор.<br>
				<b>Кнопка игрока.</b> Справа внизу — <b>БЕРУ</b>, <b>ПАС</b>,
				<b>ПОГОНЫ!</b>, <b>ВСЁ!</b> или <b>МОЙ ХОД</b>.<br>
				<b>Пауза.</b> Кнопка с шестерёнкой в левом верхнем углу сцены.
			  </div>
			</div>

			<div class="help-section">
			  <div class="help-section__title">Управление — клавиатура</div>
			  <div class="help-section__text">
				<b>В матче:</b><br>
				• <b>←</b> / <b>→</b> — переключить карту в руке.<br>
				• <b>Enter</b> — сыграть выбранную карту или нажать кнопку игрока.<br>
				• <b>Backspace</b> — снять выбор с карты.<br>
				• <b>Esc</b> — пауза / закрыть окно.<br>
				<br>
				<b>В меню и окнах:</b><br>
				• <b>Стрелки</b> — перемещение между кнопками.<br>
				• <b>Enter</b> / <b>Space</b> — нажать выбранную кнопку.<br>
				• <b>Esc</b> — закрыть окно / выйти в меню.
			  </div>
			</div>

			<div class="help-section">
			  <div class="help-section__title">Управление — ТВ-пульт</div>
			  <div class="help-section__text">
				Игра полностью проходится стрелками и кнопкой <b>OK</b> пульта.<br>
				<br>
				• <b>Стрелки</b> — навигация по кнопкам и картам.<br>
				• <b>OK</b> — то же, что Enter.<br>
				• <b>Back</b> — пауза во время игры, закрыть окно в меню.
			  </div>
			</div>

          </div>
        </div>`;
      this._bindClose(ov);

      // Кнопки прокрутки контента
      const helpBody = ov.querySelector('.help-body');
      const upBtn = ov.querySelector('[data-help-up]');
      const downBtn = ov.querySelector('[data-help-down]');
      if (upBtn) {
        upBtn.addEventListener('click', () => {
          audio.playSfx('tap_up');
          if (helpBody) helpBody.scrollBy({ top: -400, behavior: 'smooth' });
        });
      }
      if (downBtn) {
        downBtn.addEventListener('click', () => {
          audio.playSfx('tap_up');
          if (helpBody) helpBody.scrollBy({ top: +400, behavior: 'smooth' });
        });
      }

      this.el.appendChild(ov);
      this._overlays.help = ov;
    }
    ov.style.display = 'flex';
    this._activeOverlay = ov;
    requestAnimationFrame(() => this._autoFocusOverlay(ov, '[data-close]'));
  }

  _navigateHelp(e) {
    const ov = this._activeOverlay;
    if (!ov) return;

    this._lastInputWasKeyboard = true;
    e.preventDefault();

    // ↑/↓ — прокрутка контента (без перемещения фокуса)
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const body = ov.querySelector('.help-body');
      if (body) {
        const dy = e.key === 'ArrowUp' ? -400 : +400;
        body.scrollBy({ top: dy, behavior: 'smooth' });
      }
      return;
    }

    // ←/→ — переключение между кнопками ↑ / ↓ / В МЕНЮ
    const upBtn    = ov.querySelector('[data-help-up]');
    const downBtn  = ov.querySelector('[data-help-down]');
    const closeBtn = ov.querySelector('[data-close]');
    const list = [upBtn, downBtn, closeBtn].filter(Boolean);
    if (!list.length) return;

    let cur = ov.querySelector('.kbd-focus');
    if (!cur || !list.includes(cur)) {
      ov.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
      if (closeBtn) closeBtn.classList.add('kbd-focus');
      cur = closeBtn;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const curIdx = list.indexOf(cur);
      const nextIdx = (curIdx + dir + list.length) % list.length;
      ov.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
      list[nextIdx].classList.add('kbd-focus');
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      audio.playSfx('tap');
      cur.click();
      return;
    }
  }

  _focusStyleDefault() {
    const ov = this._activeOverlay;
    if (!ov) return;
    ov.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
    // Активный таб — точка входа
    const activeTab = ov.querySelector('.mm-tab--active') || ov.querySelector('.mm-tab');
    if (activeTab) activeTab.classList.add('kbd-focus');
  }

  _navigateStyle(e) {
    const ov = this._activeOverlay;
    if (!ov) return;

    this._lastInputWasKeyboard = true;
    e.preventDefault();

    if (!this._styleNav) this._styleNav = { level: 'tabs', tabIdx: 0, tileIdx: 0, footerIdx: 0 };
    const nav = this._styleNav;

    const tabs = [...ov.querySelectorAll('.mm-tab')];
    const tiles = [...ov.querySelectorAll('.mm-tile')];
    const footer = [...ov.querySelectorAll('.mm-overlay__footer .mm-btn')];

    const focusEl = (el) => {
      ov.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
      if (el) {
        el.classList.add('kbd-focus');
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };

    // Enter / Space
    if (e.key === 'Enter' || e.key === ' ') {
      const cur = ov.querySelector('.kbd-focus');
      if (cur) { audio.playSfx('tap'); cur.click(); }
      return;
    }

    // === Уровень ТАБЫ ===
    if (nav.level === 'tabs') {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const cur = ov.querySelector('.kbd-focus');
        const curIdx = Math.max(0, tabs.indexOf(cur));
        const nextIdx = (curIdx + dir + tabs.length) % tabs.length;
        nav.tabIdx = nextIdx;
        focusEl(tabs[nextIdx]);
      } else if (e.key === 'ArrowDown') {
        if (!tiles.length) return;
        nav.level = 'tiles';
        nav.tileIdx = 0;
        focusEl(tiles[0]);
      }
      return;
    }

    // === Уровень ПЛИТКИ ===
    if (nav.level === 'tiles') {
      if (!tiles.length) return;

      // Реальное число столбцов — по первой строке
      const topRow = tiles.filter(t => Math.abs(
        t.getBoundingClientRect().top - tiles[0].getBoundingClientRect().top
      ) < 5);
      const cols = Math.max(1, topRow.length);

      const curRow = Math.floor(nav.tileIdx / cols);
      const curCol = nav.tileIdx % cols;
      const totalRows = Math.ceil(tiles.length / cols);
      const lastRowCols = tiles.length - (totalRows - 1) * cols;

      let nextIdx = nav.tileIdx;

      if (e.key === 'ArrowLeft') {
        const nc = (curCol - 1 + cols) % cols;
        let nr = curRow;
        if (nr === totalRows - 1 && nc >= lastRowCols && nr > 0) nr = nr - 1;
        nextIdx = nr * cols + nc;
      } else if (e.key === 'ArrowRight') {
        const nc = (curCol + 1) % cols;
        let nr = curRow;
        if (nr === totalRows - 1 && nc >= lastRowCols && nr > 0) nr = nr - 1;
        nextIdx = nr * cols + nc;
      } else if (e.key === 'ArrowUp') {
        if (curRow === 0) {
          nav.level = 'tabs';
          const activeTab = ov.querySelector('.mm-tab--active') || tabs[0];
          focusEl(activeTab);
          return;
        }
        nextIdx = (curRow - 1) * cols + curCol;
        if (nextIdx >= tiles.length) nextIdx = tiles.length - 1;
      } else if (e.key === 'ArrowDown') {
        if (curRow === totalRows - 1) {
          if (footer.length) {
            nav.level = 'footer';
            nav.footerIdx = 0;
            focusEl(footer[0]);
          }
          return;
        }
        nextIdx = (curRow + 1) * cols + curCol;
        if (nextIdx >= tiles.length) nextIdx = tiles.length - 1;
      }

      if (nextIdx !== nav.tileIdx && nextIdx >= 0 && nextIdx < tiles.length) {
        nav.tileIdx = nextIdx;
        focusEl(tiles[nextIdx]);
      }
      return;
    }

    // === Уровень FOOTER ===
    if (nav.level === 'footer') {
      if (!footer.length) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        nav.footerIdx = (nav.footerIdx + dir + footer.length) % footer.length;
        focusEl(footer[nav.footerIdx]);
      } else if (e.key === 'ArrowUp') {
        if (!tiles.length) return;
        nav.level = 'tiles';
        nav.tileIdx = tiles.length - 1;
        focusEl(tiles[nav.tileIdx]);
      } else if (e.key === 'ArrowDown') {
        nav.level = 'tabs';
        const activeTab = ov.querySelector('.mm-tab--active') || tabs[0];
        focusEl(activeTab);
      }
      return;
    }
  }

  /* ---------------- SETTINGS ---------------- */

  _openSettings() {
    let ov = this._overlays.settings;
    if (!ov) { ov = this._buildSettings(); this.el.appendChild(ov); this._overlays.settings = ov; }
    this._refreshSettings(ov);
    ov.style.display = 'flex';
    this._activeOverlay = ov;
    this._settingsNav = { row: -1 };
    requestAnimationFrame(() => this._autoFocusOverlay(ov, '[data-close]'));
  }
  _buildSettings() {
    const el = document.createElement('div');
    el.className = 'mm-overlay';
    el.innerHTML = `
      <div class="mm-overlay__box mm-overlay__box--settings">
        <div class="mm-overlay__title">НАСТРОЙКИ</div>
        <div class="mm-rows"></div>
        <button class="mm-btn mm-btn--small" data-close>В МЕНЮ</button>
      </div>`;
    this._bindClose(el);
    const rows = el.querySelector('.mm-rows');
    rows.appendChild(this._makeRow('Звуки эффектов', 'sfxEnabled', [
      { label: 'вкл.', val: true }, { label: 'откл.', val: false }]));
    rows.appendChild(this._makeRow('Музыка в игре', 'musicEnabled', [
      { label: 'вкл.', val: true }, { label: 'откл.', val: false }]));
    rows.appendChild(this._makeRow('Карт в колоде', 'deckSize', [
      { label: '36', val: 36 }, { label: '52', val: 52 }]));
    rows.appendChild(this._makeRow('Карты в руке', 'handLayout', [
      { label: 'веер', val: 'fan' }, { label: 'прямо', val: 'straight' }]));
	rows.appendChild(this._makeRow('Подсказки хода', 'moveHints', [
	  { label: 'вкл.', val: true }, { label: 'откл.', val: false }]));
	rows.appendChild(this._makeRow('Счётчик колоды', 'showDeckCounter', [
	  { label: 'вкл.', val: true }, { label: 'откл.', val: false }]));
	rows.appendChild(this._makeRow('Уровень AI', 'aiLevel', [
	  { label: 'новичок', val: 1 },
	  { label: 'обычный', val: 2 },
	  { label: 'эксперт', val: 3 }]));
    return el;
  }
  
_makeRow(labelText, key, options) {
  const row = document.createElement('div');
  row.className = 'mm-row';
  row.dataset.key = key;
  const lab = document.createElement('span');
  lab.className = 'mm-row__label';
  lab.textContent = labelText;
  row.appendChild(lab);
  const opts = document.createElement('div');
  opts.className = 'mm-row__options';
  for (const opt of options) {
    const b = document.createElement('button');
    b.className = 'mm-opt';
    b.dataset.val = String(opt.val);
    b.textContent = opt.label;
    b.addEventListener('click', async () => {
      audio.playSfx('switch');

      // Сначала оптимистично обновляем UI — визуальный отклик мгновенный,
      // даже если дальше будет await (fadeMusic) или перерисовка.
      GameSettings[key] = opt.val;
      this._refreshRow(row, key);
      saveSettings();

      const isMusic = (key === 'musicEnabled');
      const isSfx   = (key === 'sfxEnabled');

      if (isMusic) {
        // блокируем кнопки на время fade
        opts.querySelectorAll('.mm-opt').forEach(x => x.disabled = true);
        if (opt.val === true) await this._fadeMusic(true);
        else                  await this._fadeMusic(false);
        opts.querySelectorAll('.mm-opt').forEach(x => x.disabled = false);
      } else if (isSfx) {
        audio.setSfxEnabled(opt.val === true);
      } else if (key === 'moveHints') {
        // пересчитать оверлеи на руке игрока
        if (window.__app && window.__app.session) {
          window.__app.session._updateHandOverlays();
        }
      } else if (key === 'handLayout') {
        // сразу применяем новый layout — аккордеоны читают GameSettings в реальном времени,
        // поэтому проставляем значение ДО вызова relayout()
        GameSettings.handLayout = opt.val;
        if (window.__app && window.__app.accordionPlayer) {
          window.__app.accordionPlayer.relayout();
        }
        if (window.__app && window.__app.accordionCpu) {
          window.__app.accordionCpu.relayout();
        }
      } else if (key === 'showDeckCounter') {
        GameSettings.showDeckCounter = opt.val;
        if (window.__app && window.__app.session) {
          window.__app.session._updateDeckCounter?.();
        }
      }

      // GameSettings[key] и _refreshRow уже выполнены в начале —
      // здесь просто дублировать не надо.
    });
    opts.appendChild(b);
  }
  row.appendChild(opts);
  return row;
}
  
  
  _refreshSettings(root) {
    root.querySelectorAll('.mm-row').forEach(row => this._refreshRow(row, row.dataset.key));
  }
  _refreshRow(row, key) {
    const cur = String(GameSettings[key]);
    row.querySelectorAll('.mm-opt').forEach(b => {
      b.classList.toggle('mm-opt--active', b.dataset.val === cur);
    });
  }

_fadeMusic(on) {
  return new Promise(resolve => {
    if (on) {
      audio.enableMusic();
      setTimeout(resolve, 900);
    } else {
      audio.disableMusic();
      setTimeout(resolve, 900);
    }
  });
}

  /* ================================================================
   *  МАГАЗИНЧИК
   * ================================================================ */

_openShop() {
    let ov = this._overlays.shop;
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'mm-overlay';
      this.el.appendChild(ov);
      this._overlays.shop = ov;
    }

    // На мобилке после поворота / первого рендера --scene-w и --ui могут
    // быть не финальными. Показываем оверлей, даём браузеру кадр,
    // потом принудительно пересчитываем и рендерим контент.
    ov.style.display = 'flex';
    this._activeOverlay = ov;

    requestAnimationFrame(() => {
      this.hud.update();
      this._layoutAll();
      this._renderShop(ov, this._shopCategory);
      this._showShopWelcome();
    });
  }

  _showShopWelcome() {
    if (Progress.shopIntroSeen) return;

    // Снимаем фокус с кнопок магазина — приоритет у welcome-окна
    if (this._activeOverlay) {
      this._activeOverlay.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
    }

    const el = document.createElement('div');
    el.className = 'msg-overlay';
    el.style.display = 'flex';
    el.innerHTML = `
      <div class="msg-overlay__box">
        <div class="msg-overlay__title">Добро пожаловать!</div>
        <div class="msg-overlay__body">
          Добро пожаловать в <b>Магазинчик Джокера</b> — здесь есть много
          интересного, чтобы сделать вашу игру ярче и красивее.
          Придайте своей игре собственный неповторимый стиль!
        </div>
        <label class="msg-overlay__check">
          <input type="checkbox" class="shop-intro-check">
          <span>Больше не показывать при входе</span>
        </label>
        <button class="mm-btn mm-btn--small" data-msg-btn data-close>ОК</button>
      </div>
    `;
    document.getElementById('scene').appendChild(el);

    const checkbox = el.querySelector('.shop-intro-check');
    const close = () => {
      audio.playSfx('tap_up');
      if (checkbox.checked) {
        Progress.shopIntroSeen = true;
        saveProgress();
      }
      el.remove();
      // Вернуть фокус на кнопку магазина
      this._focusShopDefault();
    };
    el.querySelector('[data-close]').addEventListener('click', close);
    el.addEventListener('click', (e) => { if (e.target === el) close(); });

    // Автофокус на OK
    requestAnimationFrame(() => {
      const okBtn = el.querySelector('[data-close]');
      if (okBtn) okBtn.classList.add('kbd-focus');
    });

  }

_renderShop(root, category) {
  // каркас строим один раз
  if (!root.querySelector('.shop-box')) {
    root.innerHTML = `
      <div class="shop-box">
        <div class="shop-joker-side">
          <div class="shop-joker-wrap">
            <img src="${ASSETS.jokerShop}" alt="">
            <div class="shop-balance">
              <span>ОЧКОВ СТИЛЯ</span>
              <b>0</b>
            </div>
          </div>
        </div>
        <div class="shop-content">
          <div class="shop-content-inner"></div>
          <div class="shop-footer">
            <button class="mm-btn mm-btn--small" data-back style="display:none;">НАЗАД</button>
            <button class="mm-btn mm-btn--small" data-close>В МЕНЮ</button>
          </div>
        </div>
      </div>`;
    root.querySelector('[data-close]').addEventListener('click', () => { 
		audio.playSfx('tap_up'); 
		this._closeOverlay(); 
	});
    root.querySelector('[data-back]').addEventListener('click', () => {
      audio.playSfx('tap_up');
      this._shopLastCategory = this._shopCategory;
      this._shopCategory = null;
      this._renderShop(root, null);
    });
  }
  
   // жетон на джокере (если у CPU есть)
   attachTokenMark(root.querySelector('.shop-joker-wrap'), {
      side: 'cpu', corner: 'br',
      heightCss: 'calc(60px * var(--ui))'
    });

  // баланс
  root.querySelector('.shop-balance b').textContent = Progress.stylePoints;

  // содержимое — плавно
  const inner = root.querySelector('.shop-content-inner');
  const backBtn = root.querySelector('[data-back]');
  backBtn.style.display = category ? '' : 'none';

  inner.style.opacity = '0';
  requestAnimationFrame(() => {
    inner.innerHTML = '';
    inner.appendChild(
      category ? this._buildShopItems(category) : this._buildShopCategories()
    );
    inner.style.opacity = '1';

    // Приоритет 1: вернуть фокус на плитку после покупки
    if (this._shopPendingFocus) {
      const { cat: fcat, index: fidx } = this._shopPendingFocus;
      this._shopPendingFocus = null;
      if (fcat === category) {
        const tiles = [...inner.querySelectorAll('.shop-item')];
        const target = tiles[fidx];
        if (target) {
          root.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
          target.classList.add('kbd-focus');
          target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          return;
        }
      }
    }

    // Автофокус — если поверх не висит msg-overlay (welcome, confirm)
    if (!document.querySelector('.msg-overlay')) {
      this._focusShopDefault();
    }
  });
}
_buildShopItems(cat) {
  const items = this._shopItemsFor(cat);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:14px;flex:1 1 auto;min-height:0;';

  const title = document.createElement('div');
  title.className = 'shop-title';
  title.textContent = 'ВИТРИНА';
  wrap.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'shop-items';
  wrap.appendChild(grid);

  for (const item of items) {
    const permanent = (Progress.purchases[cat] || []).includes(item.index);
    const tempLeft = permanent ? 0 : getTempMatchesLeft(cat, item.index);
    const affordable = !permanent && item.price <= Progress.stylePoints;

    const tile = document.createElement('div');
    tile.className = 'shop-item' + (permanent ? ' shop-item--bought' : '');
    if (cat === 'decor') tile.classList.add('shop-item--decor');
    if (affordable) tile.classList.add('shop-item--affordable');

    // превью
    const prev = this._makePreview(item, cat);
    if (prev) tile.appendChild(prev);

    if (permanent) {
      const ck = document.createElement('div');
      ck.className = 'mm-tile__check';
      if (tempLeft > 0) ck.classList.add('mm-tile__check--stacked');
      ck.textContent = '✓';
      tile.appendChild(ck);
    } else {
      const lock = document.createElement('img');
      lock.className = 'mm-tile__lock';
      lock.src = ASSETS.lockIcon;
      lock.alt = '';
      lock.draggable = false;
      tile.appendChild(lock);

      const pr = document.createElement('div');
      pr.className = 'shop-item__price';
      pr.textContent = item.price;
      tile.appendChild(pr);
    }

    if (tempLeft > 0) {
      const tb = document.createElement('div');
      tb.className = 'temp-badge';
      tb.textContent = String(tempLeft);
      tile.appendChild(tb);
    }

    tile.addEventListener('click', () => this._confirmBuy(this._overlays.shop, `${cat}:${item.index}`));
    grid.appendChild(tile);
  }
  return wrap;
}
_makePreview(item, cat) {
  // ---- Стили карт (оформление / масти) ----
  if (cat === 'design' || cat === 'suits') {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'width:100%;height:100%;display:flex;align-items:center;' +
      'justify-content:center;box-sizing:border-box;overflow:hidden;';

    const face = document.createElement('div');
    face.className = 'card__face';
    face.style.cssText =
      'position:relative;display:flex;align-items:center;' +
      'justify-content:center;max-width:100%;max-height:100%;flex-shrink:0;';
    // Делаем карту крупной, как в матче
    face.style.setProperty('--card-w', 'calc(150px * var(--ui))');

    try {
      let cardStyle, suitStyle, rank, suit;

      if (cat === 'design') {
        // Оформление: выбранный стиль лица + ТЕКУЩАЯ масть из настроек
        cardStyle = item.cardStyle;
        suitStyle = GameSettings.suitStyle || 'gradient';
        rank = '10';              // 10 — самое «наглядное» для сетки
        suit = 'hearts';
      } else {
        // Масти: тело карты + большая масть по центру.
        // 'grid' + 'A' даёт PIP.large = 137×145 — самый крупный пип.
        cardStyle = 'grid';
        suitStyle = item.suitStyle;
        rank = 'A';
        suit = 'hearts';
      }

      const node = spawnCard(rank, suit, cardStyle, suitStyle);
      face.appendChild(node);
    } catch (e) {
      console.warn('[preview] failed:', cat, item, e);
    }

    wrap.appendChild(face);
    return wrap;
  }

  // ---- Стол / рубашка / декор — просто картинка ----
  if (item.src) {
    const im = document.createElement('img');
    im.src = item.src;
    im.alt = '';
    im.draggable = false;
    return im;
  }
  return null;
}

_buildShopCategories() {
  const CATS = [
    { id: 'shirt',  label: 'РУБАШКИ',    icon: ASSETS.shopIcons.shirt },
    { id: 'design', label: 'ОФОРМЛЕНИЕ', icon: ASSETS.shopIcons.design },
    { id: 'suits',  label: 'МАСТИ',      icon: ASSETS.shopIcons.suits },
    { id: 'table',  label: 'СТОЛ',       icon: ASSETS.shopIcons.table },
    { id: 'decor',  label: 'ДЕКОРАЦИИ',  icon: ASSETS.shopIcons.decor },
  ];

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:16px;flex:1 1 auto;';

  const title = document.createElement('div');
  title.className = 'shop-title';
  title.textContent = 'ВЫБЕРИ КАТЕГОРИЮ';
  wrap.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'shop-cats';
  wrap.appendChild(grid);

  for (const cat of CATS) {
    const btn = document.createElement('button');
    btn.className = 'shop-cat';
    btn.dataset.cat = cat.id;
    btn.textContent = cat.label;

    // Подсветка: если в категории есть хотя бы один товар, который игрок может купить
    const catItems = this._shopItemsFor(cat.id);
    const canAffordAny = catItems.some(it =>
      !(Progress.purchases[cat.id] || []).includes(it.index)
      && it.price <= Progress.stylePoints
    );
    if (canAffordAny) btn.classList.add('shop-cat--affordable');

    const icon = document.createElement('img');
    icon.className = 'shop-cat__icon';
    icon.src = cat.icon;
    icon.alt = '';
    icon.draggable = false;
    btn.appendChild(icon);

    btn.addEventListener('click', () => {
      audio.playSfx('switch');
      this._shopCategory = btn.dataset.cat;
      this._renderShop(this._overlays.shop, this._shopCategory);
    });

    grid.appendChild(btn);
  }

  return wrap;
}

  _shopCategoriesHTML() {
    return `
      <div class="shop-title">ВЫБЕРИ КАТЕГОРИЮ</div>
      <div class="shop-cats">
        <button class="shop-cat" data-cat="shirt">РУБАШКИ</button>
        <button class="shop-cat" data-cat="design">ОФОРМЛЕНИЕ</button>
        <button class="shop-cat" data-cat="decor">ДЕКОРАЦИИ</button>
        <button class="shop-cat" data-cat="table">СТОЛ</button>
		<button class="shop-cat" data-cat="suits">МАСТИ</button>
      </div>
    `;
  }

_shopItemsFor(cat) {
  if (cat === 'table') {
    return ASSETS.tables.map((src, i) => ({
      src, price: PRICES.table, index: i, label: 'Стол ' + (i + 1),
    }));
  }
  if (cat === 'decor') {
    return ASSETS.decorations.map((src, i) => ({
      src, price: PRICES.decor, index: i, label: 'Декор ' + (i + 1),
    }));
  }
  if (cat === 'shirt') {
    return ASSETS.shirts.map((src, i) => ({
      src, price: PRICES.shirt, index: i, label: 'Рубашка ' + (i + 1),
    }));
  }
  if (cat === 'design') {
    return [
      { cardStyle: 'grid',            label: 'Сетка' },
      { cardStyle: 'center',          label: 'Центр' },
      { cardStyle: 'rank',            label: 'Ранг+масть' },
      { cardStyle: 'rank-no-corners', label: 'Только центр' },
    ].map((it, i) => ({ ...it, index: i, price: PRICES.design }));
  }
  if (cat === 'suits') {
    return ['default','paper','barhat','gradient','ruby','golden']
      .map((s, i) => ({ suitStyle: s, label: s, index: i, price: PRICES.suits }));
  }
  return [];
}

  _shopCategoryHTML(cat) {
    const items = this._shopItemsFor(cat);
const tilesHTML = items.map(item => {
  const bought = isPurchased(cat, item.index);
  let preview;
  if (cat === 'design' || cat === 'suits') {
    const card = spawnCard(
      'K', 'hearts',
      item.cardStyle || GameSettings.cardStyle,
      item.suitStyle || GameSettings.suitStyle
    );
    card.style.setProperty('--card-w', '110px');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
    wrap.appendChild(card);
    preview = wrap.outerHTML;
  } else {
    preview = `<img src="${item.src}" alt="">`;
  }

  return `
    <div class="shop-item ${bought ? 'shop-item--bought' : ''}" data-buy="${cat}:${item.index}">
      ${preview}
      ${bought
        ? `<div class="mm-tile__check">✓</div>`
        : `<div class="shop-item__price">${item.price}</div>`}
    </div>`;
}).join('');

    return `
      <div class="shop-title">ВИТРИНА</div>
      <div class="shop-items">${tilesHTML}</div>
    `;
  }

_confirmBuy(root, key) {
  const [cat, idxStr] = key.split(':');
  const index = Number(idxStr);
  const items = this._shopItemsFor(cat);
  const item = items[index];
  if (!item) return;

  // Блокируем только перманентную покупку. Временный подарок можно купить.
  if ((Progress.purchases[cat] || []).includes(index)) return;

  // Запоминаем плитку, чтобы восстановить фокус после закрытия диалога
  this._shopPendingFocus = { cat, index };

  showConfirm(
    `Вы желаете приобрести:<br><b>${item.label}</b><br>за <b class="mm-stat-value--accent">${item.price}</b> очков стиля?`,
    {
      title: 'Покупка',
      onConfirm: () => {
        const res = purchaseItem(cat, index, item.price);
        if (!res.ok) {
          audio.playSfx('tap_up');
          showMessage(res.reason === 'no_money' ? 'Недостаточно очков стиля.' : 'Уже куплено.');
          this._shopPendingFocus = null;
          return;
        }
        audio.playSfx('buy');
        this._applyStyleItem(cat, item);
        this._refreshStats();
        // _shopPendingFocus уже установлен — _renderShop вернёт фокус на плитку
        this._renderShop(root, this._shopCategory);
      },
      onCancel: () => {
        // Вернуть фокус на ту же плитку (без пересоздания контента)
        const pf = this._shopPendingFocus;
        this._shopPendingFocus = null;
        if (!pf) return;
        if (pf.cat !== this._shopCategory) return;
        const tiles = [...root.querySelectorAll('.shop-item')];
        const target = tiles[pf.index];
        if (target) {
          root.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
          target.classList.add('kbd-focus');
          target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      },
    }
  );
}

  /* ================================================================
   *  СТИЛЬ (коллекция)
   * ================================================================ */

_openStyle() {
  let ov = this._overlays.style;
  if (!ov) {
    ov = this._buildStyle();
    this.el.appendChild(ov);
    this._overlays.style = ov;
    this._styleCategory = 'table';
  }

  // подтянуть выбранное из сохранённых настроек
  const designIds = ['grid', 'center', 'rank', 'rank-no-corners'];
  const suitIds   = ['default', 'paper', 'barhat', 'gradient', 'ruby', 'golden'];

  this._selectedStyle.table  = GameSettings.tableStyle ?? 0;
  this._selectedStyle.shirt  = GameSettings.shirtStyle ?? 0;
  this._selectedStyle.decor  = Math.max(0, GameSettings.decorStyle ?? 0);
  this._selectedStyle.design = Math.max(0, designIds.indexOf(GameSettings.cardStyle));
  this._selectedStyle.suits  = Math.max(0, suitIds.indexOf(GameSettings.suitStyle));

  this._renderStyleTiles(ov);
  ov.style.display = 'flex';
  this._activeOverlay = ov;
  this._styleNav = { level: 'tabs', tabIdx: 0, tileIdx: 0, footerIdx: 0 };
  requestAnimationFrame(() => this._focusStyleDefault());
}
  _buildStyle() {
    const el = document.createElement('div');
    el.className = 'mm-overlay';
    el.innerHTML = `
      <div class="mm-overlay__box mm-overlay__box--full">
        <div class="mm-overlay__title">КОЛЛЕКЦИЯ СТИЛЕЙ</div>
		<div class="mm-tabs">
		  <button class="mm-tab" data-cat="shirt">РУБАШКА</button>
		  <button class="mm-tab" data-cat="design">ОФОРМЛЕНИЕ</button>
		  <button class="mm-tab" data-cat="suits">МАСТИ</button>
		  <button class="mm-tab" data-cat="table">СТОЛ</button>
		  <button class="mm-tab" data-cat="decor">ДЕКОРАЦИИ</button>
		</div>
        <div class="mm-tiles"></div>
        <div class="mm-overlay__footer">
          <button class="mm-btn" data-preview>ПРОСМОТРЕТЬ СТИЛЬ</button>
          <button class="mm-btn mm-btn--small" data-close>В МЕНЮ</button>
        </div>
      </div>`;
    this._bindClose(el);
    el.querySelector('[data-preview]').addEventListener('click', () => {
	  audio.playSfx('tap_up');
	  this._openPreview();
	});
    el.querySelectorAll('.mm-tab').forEach(tab =>
      tab.addEventListener('click', () => {
		audio.playSfx('switch');
        this._styleCategory = tab.dataset.cat;
        this._renderStyleTiles(el);
      })
    );
    return el;
  }
_renderStyleTiles(root) {
  const cat = this._styleCategory || 'table';
  root.querySelectorAll('.mm-tab').forEach(t =>
    t.classList.toggle('mm-tab--active', t.dataset.cat === cat)
  );

  const tiles = root.querySelector('.mm-tiles');
  tiles.innerHTML = '';

  const items = this._styleItemsFor(cat);
  const selected = this._selectedStyle[cat] ?? 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const bought = isPurchased(cat, i);

    // NEW — купленный, но не просмотренный (кроме дефолтных index 0)
    const isNew = bought && i > 0 && !isStyleItemSeen(cat, i);

    const tile = document.createElement('div');
    tile.className = 'mm-tile' + (i === selected ? ' mm-tile--active' : '');
    tile.classList.toggle('mm-tile--locked', !bought);
    if (cat === 'decor') tile.classList.add('mm-tile--decor');

    const prev = this._makePreview(item, cat);
    if (prev) tile.appendChild(prev);

    const permanent = (Progress.purchases[cat] || []).includes(i);
    const tempLeft = permanent ? 0 : getTempMatchesLeft(cat, i);

    if (!bought) {
      const lock = document.createElement('img');
      lock.className = 'mm-tile__lock';
      lock.src = ASSETS.lockIcon;
      lock.alt = '';
      lock.draggable = false;
      tile.appendChild(lock);
    } else if (isNew) {
      const nb = document.createElement('img');
      nb.className = 'new-indicator';
      nb.src = ASSETS.newOneIcon;
      nb.alt = '';
      nb.draggable = false;
      tile.appendChild(nb);
    } else if (i === selected) {
      const ck = document.createElement('div');
      ck.className = 'mm-tile__check';
      // Если в этом же углу будет счётчик подарка — сдвигаем галочку вниз
      if (tempLeft > 0) ck.classList.add('mm-tile__check--stacked');
      ck.textContent = '✓';
      tile.appendChild(ck);
    }

    if (tempLeft > 0) {
      const tb = document.createElement('div');
      tb.className = 'temp-badge';
      tb.textContent = String(tempLeft);
      tile.appendChild(tb);
    }

    tile.addEventListener('click', () => {
      if (!isPurchased(cat, i)) {
        showMessage(
          'Выигрывайте очки стиля в матчах и выполняйте квесты — тогда сможете приобрести этот элемент в магазинчике Джокера.',
          { title: 'Заблокировано' }
        );
        return;
      }
      audio.playSfx('switch');

      // помечаем как просмотренный (только купленный)
      markStyleItemSeen(cat, i);

      this._selectedStyle[cat] = i;
      this._applyStyleItem(cat, item);
      this._renderStyleTiles(root);
      this._updateStyleBadge();
    });

    tiles.appendChild(tile);
  }

  // Сохраняем фокус на плитке, если был на плитке (при клике/Enter/применении)
  if (this._styleNav && this._styleNav.level === 'tiles') {
    const ov = this._activeOverlay;
    if (ov) {
      const target = tiles.children[Math.min(this._styleNav.tileIdx, tiles.children.length - 1)];
      if (target) {
        ov.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
        target.classList.add('kbd-focus');
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }
}

_applyStyleItem(cat, item) {
  if (item.cardStyle) {
    GameSettings.cardStyle = item.cardStyle;
    Card.defaultCardStyle = item.cardStyle;
  }
  if (item.suitStyle) {
    GameSettings.suitStyle = item.suitStyle;
    Card.defaultSuitStyle = item.suitStyle;
  }
  if (cat === 'shirt') {
    GameSettings.shirtStyle = item.index;
    Card.defaultShirtUrl = ASSETS.shirts[item.index];
  }
  if (cat === 'table') {
    GameSettings.tableStyle = item.index;
    const bg = document.getElementById('table-bg');
    if (bg) bg.style.backgroundImage = `url("${ASSETS.tables[item.index]}")`;
  }
  if (cat === 'decor') {
    GameSettings.decorStyle = item.index;
    const d = document.getElementById('decor-layer');
    if (d) d.style.backgroundImage = `url("${ASSETS.decorations[item.index]}")`;
  }
  saveSettings();

  if (item.cardStyle || item.suitStyle) {
    clearCache();
    warmUpDeck(GameSettings.cardStyle, GameSettings.suitStyle);
  }
}

_styleItemsFor(cat) {
  if (cat === 'table') {
    return ASSETS.tables.map((src, i) => ({ src, label: 'Стол ' + (i + 1), index: i }));
  }
  if (cat === 'decor') {
    return ASSETS.decorations.map((src, i) => ({ src, label: 'Декор ' + (i + 1), index: i }));
  }
  if (cat === 'shirt') {
    return ASSETS.shirts.map((src, i) => ({ src, label: 'Рубашка ' + (i + 1), index: i }));
  }
  if (cat === 'design') {
    return [
      { cardStyle: 'grid',            label: 'Сетка' },
      { cardStyle: 'center',          label: 'Центр' },
      { cardStyle: 'rank',            label: 'Ранг+масть' },
      { cardStyle: 'rank-no-corners', label: 'Только центр' },
    ].map((it, i) => ({ ...it, index: i }));
  }
  if (cat === 'suits') {
    return ['default','paper','barhat','gradient','ruby','golden']
      .map((s, i) => ({ suitStyle: s, label: s, index: i }));
  }
  return [];
}
async _openPreview() {
  if (this._previewOverlay) return;

  this._previewOverlay = document.createElement('div');
  this._previewOverlay.id = 'style-preview';
  document.body.appendChild(this._previewOverlay);

  await withLoading(() => {
    this._buildPreviewField(this._previewOverlay);
  }, { text: 'Собираем макет…', minMs: 2000 });

  // защита от закрытия оверлея во время загрузки (Esc, клик по фону и т.п.)
  if (!this._previewOverlay) return;

	this._previewOverlay.addEventListener('click', () => {
	  audio.playSfx('tap_up');
	  if (this._previewOverlay) this._previewOverlay.remove();
	  this._previewOverlay = null;
	}, { once: true });
}

_buildPreviewField(container) {
  const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const SUITS = ['hearts','diamonds','clubs','spades'];
  const randCard = () => ({
    rank: RANKS[Math.floor(Math.random() * RANKS.length)],
    suit: SUITS[Math.floor(Math.random() * SUITS.length)],
  });

  const field = document.createElement('div');
  field.className = 'sp-field-v2';
  container.appendChild(field);

  // размер поля — пропорционален вьюпорту
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fieldW = Math.min(vw * 0.92, 1200, vh * 1.55);
  const fieldH = Math.round(fieldW * 0.62);
  const cardW  = Math.round(fieldW * 0.085);

  field.style.cssText = `
    position: relative;
    width: ${fieldW}px;
    height: ${fieldH}px;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    border: 2px solid rgba(255,255,255,0.2);
  `;

  // ---- фон стола ----
  const tIdx = GameSettings.tableStyle ?? 0;
  if (ASSETS.tables[tIdx]) {
    field.style.backgroundImage = `url("${ASSETS.tables[tIdx]}")`;
    field.style.backgroundSize = 'cover';
    field.style.backgroundPosition = 'center';
  }

  // ---- слой декораций ----
  const dIdx = GameSettings.decorStyle;
  if (dIdx >= 0 && ASSETS.decorations[dIdx]) {
    const decor = document.createElement('div');
    decor.style.cssText = `
      position:absolute; inset:0;
      background-image: url("${ASSETS.decorations[dIdx]}");
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      pointer-events:none;
    `;
    field.appendChild(decor);
  }

  // ---- хелперы ----
  const addFace = (data, xPct, yPct, angle, z) => {
    const wrap = document.createElement('div');
    wrap.className = 'card__face';
    wrap.style.cssText = `
      position:absolute;
      left:${xPct}%; top:${yPct}%;
      transform: translate(-50%,-50%) rotate(${angle}deg);
      z-index:${z};
      pointer-events:none;
    `;
    wrap.style.setProperty('--card-w', cardW + 'px');
    try {
      const c = spawnCard(data.rank, data.suit, GameSettings.cardStyle, GameSettings.suitStyle);
      wrap.appendChild(c);
    } catch (e) { /* noop */ }
    field.appendChild(wrap);
  };

  const addShirt = (xPct, yPct, angle, z) => {
    const wrap = document.createElement('div');
    const h = Math.round(cardW * 340 / 219);
    wrap.style.cssText = `
      position:absolute;
      left:${xPct}%; top:${yPct}%;
      transform: translate(-50%,-50%) rotate(${angle}deg);
      z-index:${z};
      width:${cardW}px; height:${h}px;
      pointer-events:none;
      filter: drop-shadow(2px 3px 4px rgba(0,0,0,0.45));
    `;
    const im = document.createElement('img');
    im.src = ASSETS.shirts[GameSettings.shirtStyle ?? 0] || ASSETS.shirt;
    im.alt = '';
    im.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;';
    wrap.appendChild(im);
    field.appendChild(wrap);
  };

  // ---- CPU hand (6, рубашки) ----
  for (let i = 0; i < 6; i++) {
    addShirt(35 + i * 6, 14, 0, 5);
  }

  // ---- Player hand (6, лицом) ----
  for (let i = 0; i < 6; i++) {
    addFace(randCard(), 35 + i * 6, 86, 0, 5);
  }

  // ---- Deck (верх колоды) + trump под ним ----
  addShirt(10, 48, 0, 8);
  addFace(randCard(), 17, 52, 90, 6);

  // ---- Table: 3 атаки + 2 защиты ----
  const atkCards = [randCard(), randCard(), randCard()];
  const atkY = 44, defY = 50;
  addFace(atkCards[0], 42, atkY, -8, 10);
  addFace(atkCards[1], 50, atkY, -8, 11);
  addFace(atkCards[2], 58, atkY, -8, 12);
  addFace(randCard(), 43, defY, 17, 13);
  addFace(randCard(), 51, defY, 17, 14);

  // ---- Discard zone (4 карты, рубашками вниз, случайно) ----
  const discPos = [
    { x: 80, y: 30, a: -22 },
    { x: 88, y: 36, a: 12 },
    { x: 84, y: 52, a: -8 },
    { x: 91, y: 58, a: 28 },
  ];
  for (const p of discPos) addShirt(p.x, p.y, p.a, 3);

  // ---- подсказка ----
  const hint = document.createElement('div');
  hint.className = 'sp-hint';
  hint.textContent = 'нажать, чтобы вернуться';
  field.appendChild(hint);
}

  /* ================================================================
   *  КВЕСТ
   * ================================================================ */

  _openQuest() {
    let ov = this._overlays.quest;
    if (!ov) {
      ov = this._buildQuest();
      this.el.appendChild(ov);
      this._overlays.quest = ov;
    }
    this._refreshQuest(ov);
    ov.style.display = 'flex';
    this._activeOverlay = ov;
    this._questNav = { row: 0, col: 0 };
    requestAnimationFrame(() => this._autoFocusOverlay(ov, '[data-claim]'));
  }
  _buildQuest() {
    const el = document.createElement('div');
    el.className = 'mm-overlay';
	el.innerHTML = `
	  <div class="mm-overlay__box mm-overlay__box--quest">
		<div class="mm-overlay__title">КВЕСТ</div>
		<div class="mm-quest-list"></div>
		<div class="mm-overlay__footer">
		  <button class="mm-btn" data-claim>ПОЛУЧИТЬ НАГРАДУ</button>
		  <button class="mm-btn mm-btn--small" data-close>В МЕНЮ</button>
		</div>
		<div class="mm-quest-footer-bottom">
		  <button class="mm-btn mm-btn--small mm-btn--danger" data-reset>ОСТАНОВИТЬ КВЕСТ</button>
		</div>
	  </div>`;
    this._bindClose(el);

	el.querySelector('[data-claim]').addEventListener('click', () => {
	  // смотрим состояние ДО клейма — чтобы понять причину «нечего забирать»
	  const ranks      = claimableRanks();
	  const anyProgress = activeOrder().some(r => Progress.quests[r].progress >= 2);
	  const allClaimed  = activeOrder().every(r => {
		const q = Progress.quests[r];
		return q.progress >= 2 && q.claimed >= q.progress;
	  });

	  const res = claimQuestReward();
	  this._refreshQuest(el);
	  this._refreshStats();
	  this._updateQuestBadge();

	  if (res.total > 0) {
		audio.playSfx('cash');
		showMessage(
		  `Получено <b class="mm-stat-value--accent">${res.total}</b> очков стиля.`,
		  { title: 'Награда' }
		);
		return;
	  }

	  audio.playSfx('tap_up');
	  if (!anyProgress) {
		showMessage(
		  'Для получения наград выполните хотя бы один квест.',
		  { title: 'Награда' }
		);
	  } else if (allClaimed) {
		showMessage(
		  'Все доступные награды уже получены.',
		  { title: 'Награда' }
		);
	  } else {
		showMessage(
		  'Пока нечего забирать.',
		  { title: 'Награда' }
		);
	  }
	});
    el.querySelector('[data-reset]').addEventListener('click', () => {
      audio.playSfx('tap_up');
	  showConfirm('Завершить квест? Прогресс и очки будут потеряны.',
        { title: 'Завершить квест?',
          onConfirm: () => {
            resetQuests();
            this._refreshQuest(el);
            this._refreshStats();
			this._updateQuestBadge();
          } });
    });
    return el;
  }

  /** Поставить клавиатурный фокус на первый интерактивный элемент оверлея. */
  _autoFocusOverlay(root, selector = '[data-close], button') {
    if (!root) return;
    this.el.querySelectorAll('.kbd-focus').forEach(e => e.classList.remove('kbd-focus'));
    const el = root.querySelector(selector);
    if (el) {
      el.classList.add('kbd-focus');
      this._overlayNavEl = el;
    }
  }

  /** Снять фокус с оверлея. */
  _clearOverlayFocus() {
    this.el.querySelectorAll('.kbd-focus').forEach(e => e.classList.remove('kbd-focus'));
    this._overlayNavEl = null;
  }

  /** Обработать Escape. Возвращает true, если событие «поглощено» (не закрывать оверлей). */
  _onEscape() {
    // 1. Предпросмотр стиля — закрыть его, оставить окно Стиля
    if (this._previewOverlay) {
      // Пока лоадер — игнорируем Esc (иначе останется висящий лоадер)
      if (document.querySelector('.loading-overlay')) return true;
      audio.playSfx('tap_up');
      this._previewOverlay.remove();
      this._previewOverlay = null;
      return true;
    }

    if (!this._activeOverlay) return false;

    // 2. Магазин: если мы в категории — «Назад» вместо закрытия
    if (this._activeOverlay.querySelector('.shop-box') && this._shopCategory) {
      audio.playSfx('tap_up');
      const root = this._overlays.shop;
      this._shopLastCategory = this._shopCategory;
      this._shopCategory = null;
      this._renderShop(root, null);
      return true;
    }

    return false;
  }

  _navigateShop(e) {
    const ov = this._activeOverlay;
    if (!ov) return;

    this._lastInputWasKeyboard = true;
    e.preventDefault();

    // Категории (список + В МЕНЮ)
    if (ov.querySelector('.shop-cats')) {
      this._navigateShopCategories(e, ov);
      return;
    }
    // Витрина (сетка плиток + НАЗАД/В МЕНЮ) — следующая итерация
    if (ov.querySelector('.shop-items')) {
      this._navigateShopItems(e, ov);
      return;
    }
  }

  _focusShopDefault() {
    const ov = this._activeOverlay;
    if (!ov) return;
    ov.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));

    let target = null;

    if (this._shopCategory) {
      // Мы в категории — фокус на «НАЗАД»
      target = ov.querySelector('[data-back]');
    } else if (this._shopLastCategory) {
      // Вернулись из категории — фокус на ту же категорию
      target = ov.querySelector(`.shop-cat[data-cat="${this._shopLastCategory}"]`);
      this._shopLastCategory = null;
    }

    if (!target) {
      // По умолчанию — «В МЕНЮ»
      target = ov.querySelector('.shop-footer [data-close]');
    }
    if (target) target.classList.add('kbd-focus');
  }

  _navigateShopCategories(e, ov) {
    const catBtns = [...ov.querySelectorAll('.shop-cat')];
    const menuBtn = ov.querySelector('.shop-footer [data-close]');
    if (!catBtns.length || !menuBtn) return;

    // По ТЗ: по умолчанию — В МЕНЮ
    const list = [...catBtns, menuBtn];

    let cur = ov.querySelector('.kbd-focus');
    if (!cur || !list.includes(cur)) {
      ov.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
      menuBtn.classList.add('kbd-focus');
      cur = menuBtn;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      audio.playSfx('tap');
      cur.click();
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const curIdx = list.indexOf(cur);
      const nextIdx = (curIdx + dir + list.length) % list.length;
      list.forEach(x => x.classList.remove('kbd-focus'));
      list[nextIdx].classList.add('kbd-focus');
      return;
    }

    // ←/→ в категориях не двигают (одна колонка)
  }

  _navigateShopItems(e, ov) {
    // Плитки витрины + кнопки НАЗАД/В МЕНЮ.
    // Реализуем линейный обход (визуальная сетка — с гравитацией в следующих итерациях).
    const tiles = [...ov.querySelectorAll('.shop-item')];
    const backBtn = ov.querySelector('.shop-footer [data-back]');
    const menuBtn = ov.querySelector('.shop-footer [data-close]');

    const btns = [backBtn, menuBtn].filter(Boolean);
    const list = [...tiles, ...btns];

    if (!list.length) return;

    let cur = ov.querySelector('.kbd-focus');
    if (!cur || !list.includes(cur)) {
      // При входе — фокус на НАЗАД (по ТЗ), если есть; иначе на первую плитку
      ov.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
      const first = backBtn || tiles[0];
      if (first) first.classList.add('kbd-focus');
      cur = first;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      audio.playSfx('tap');
      cur.click();
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' ||
        e.key === 'ArrowUp'   || e.key === 'ArrowLeft') {
      const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
      const curIdx = list.indexOf(cur);
      const nextIdx = (curIdx + dir + list.length) % list.length;
      list.forEach(x => x.classList.remove('kbd-focus'));
      list[nextIdx].classList.add('kbd-focus');
      // Прокрутить плитку в зону видимости
      list[nextIdx].scrollIntoView({ block: 'nearest' });
      return;
    }
  }

  _navigateQuest(e) {
    const ov = this._activeOverlay;
    if (!ov) return;

    const claim = ov.querySelector('[data-claim]');
    const close = ov.querySelector('[data-close]');
    const reset = ov.querySelector('[data-reset]');
    if (!claim || !close || !reset) return;

    // Ряды: [claim, close] / [reset]
    const rows = [
      [claim, close],
      [reset],
    ];

    this._lastInputWasKeyboard = true;
    e.preventDefault();

    if (!this._questNav) this._questNav = { row: 0, col: 0 };
    let { row, col } = this._questNav;
    if (row < 0 || row >= rows.length) row = 0;
    if (col < 0 || col >= rows[row].length) col = 0;

    const focusEl = (el) => {
      ov.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
      if (el) {
        el.classList.add('kbd-focus');
        this._overlayNavEl = el;
      }
    };

    // Enter / Space
    if (e.key === 'Enter' || e.key === ' ') {
      const cur = ov.querySelector('.kbd-focus');
      if (cur) { audio.playSfx('tap'); cur.click(); }
      return;
    }

    // ← / →
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const curRow = rows[row];
      if (!curRow || curRow.length <= 1) return;
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const nextCol = (col + dir + curRow.length) % curRow.length;
      this._questNav = { row, col: nextCol };
      focusEl(curRow[nextCol]);
      return;
    }

    // ↑ / ↓
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const nextRow = (row + dir + rows.length) % rows.length;
      const targetRow = rows[nextRow];
      const nextCol = Math.min(col, targetRow.length - 1);
      this._questNav = { row: nextRow, col: nextCol };
      focusEl(targetRow[nextCol]);
      return;
    }
  }

  _navigateMsg(e) {
    const el = document.querySelector('.msg-overlay');
    if (!el) return;

    // Собираем все focusable элементы: чекбоксы + кнопки
    const focusable = [];
    el.querySelectorAll('input[type="checkbox"]').forEach(cb => focusable.push(cb));
    el.querySelectorAll('button').forEach(b => focusable.push(b));
    if (!focusable.length) return;

    this._lastInputWasKeyboard = true;
    e.preventDefault();
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

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
      const curIdx = focusable.indexOf(cur);
      const nextIdx = (curIdx + dir + focusable.length) % focusable.length;
      focusable.forEach(x => x.classList.remove('kbd-focus'));
      focusable[nextIdx].classList.add('kbd-focus');
      return;
    }
  }

  _navigateSettings(e) {
    const ov = this._activeOverlay;
    if (!ov) return;

    const rows = [...ov.querySelectorAll('.mm-row')];
    const menuBtn = ov.querySelector('[data-close]');
    if (!menuBtn) return;

    this._lastInputWasKeyboard = true;
    e.preventDefault();

    // Индексы: -1 = кнопка «В МЕНЮ», 0..rows.length-1 = строки
    if (!this._settingsNav) this._settingsNav = { row: -1 };
    const curRow = this._settingsNav.row;

    const focusEl = (el) => {
      ov.querySelectorAll('.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
      if (el) {
        el.classList.add('kbd-focus');
        this._overlayNavEl = el;
      }
    };

    const activeBtnInRow = (rowEl) => {
      if (!rowEl) return null;
      const opts = [...rowEl.querySelectorAll('.mm-opt')];
      return opts.find(b => b.classList.contains('mm-opt--active')) || opts[0] || null;
    };

    // Enter / Space — клик по текущему фокусу
    if (e.key === 'Enter' || e.key === ' ') {
      const cur = ov.querySelector('.kbd-focus');
      if (cur) { audio.playSfx('tap'); cur.click(); }
      return;
    }

    // ↑ / ↓ — строки и «В МЕНЮ»
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      let nextRow = curRow + dir;

      // Полный wrap по кольцу: [0..N-1] + «В МЕНЮ» (-1).
      // ↓: -1 → 0 → 1 → ... → N-1 → -1
      // ↑: -1 → N-1 → N-2 → ... → 0 → -1
      if (curRow === -1 && dir === -1) nextRow = rows.length - 1;
      if (nextRow >= rows.length) nextRow = -1;

      this._settingsNav.row = nextRow;

      if (nextRow === -1) {
        focusEl(menuBtn);
      } else {
        focusEl(activeBtnInRow(rows[nextRow]));
      }
      return;
    }

    // ← / → — опции в текущей строке (с wrap)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (curRow === -1) return;
      const rowEl = rows[curRow];
      if (!rowEl) return;
      const opts = [...rowEl.querySelectorAll('.mm-opt')];
      if (!opts.length) return;

      const cur = ov.querySelector('.kbd-focus');
      const curIdx = opts.indexOf(cur);
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const nextIdx = curIdx < 0 ? 0 : (curIdx + dir + opts.length) % opts.length;
      focusEl(opts[nextIdx]);
      return;
    }
  }

  _bindClose(root) {
	  const btn = root.querySelector('[data-close]');
	  if (!btn) return;
	  btn.addEventListener('click', () => {
		audio.playSfx('tap_up');
		this._closeOverlay();
	  });
	}
  _refreshQuest(root) {
    const list = root.querySelector('.mm-quest-list');
    list.innerHTML = '';

    const order = activeOrder();
    const isTest = isTestModeUnlocked();

    // заголовок режима
    const header = document.createElement('div');
    header.className = 'mm-quest-header';
    header.textContent = isTest ? 'РЕЖИМ: ИСПЫТАНИЕ (52)' : 'РЕЖИМ: КЛАССИКА (36)';
    list.appendChild(header);

    for (const r of order) {
      const q = Progress.quests[r];
      const done = q.progress >= 1;
      const claimed = done && q.claimed >= q.progress;
      const prevOK = (() => {
        const idx = order.indexOf(r);
        if (idx <= 0) return true;
        return order.slice(0, idx).every(p => Progress.quests[p].progress >= 1);
      })();

      const row = document.createElement('div');
      row.className = 'mm-quest-row' +
        (done ? ' mm-quest-row--done' : '') +
        (claimed ? ' mm-quest-row--claimed' : '') +
        (!prevOK ? ' mm-quest-row--locked' : '');

      const check = document.createElement('span');
      check.className = 'mm-quest-check';
      check.textContent = claimed ? '✓' : done ? '✓' : (!prevOK ? '🔒' : '·');

      const label = document.createElement('span');
      label.className = 'mm-quest-label';
      label.textContent = r;

      const status = document.createElement('span');
      status.className = 'mm-quest-status';
      if (claimed) { status.textContent = 'получено'; status.classList.add('mm-quest-status--claimed'); }
      else if (done) {
        const pts = 250 + 50 * q.progress;
        status.innerHTML = `<span class="mm-quest-reward">+${pts}</span>`;
      } else if (!prevOK) { status.textContent = 'заблокировано'; }
      else { status.textContent = '—'; }

      row.appendChild(check);
      row.appendChild(label);
      row.appendChild(status);
      list.appendChild(row);
    }

    // подсказка про тест-режим
    if (!isTest) {
      const hint = document.createElement('div');
      hint.className = 'mm-quest-hint';
      hint.textContent = 'Завершите все квесты классики, чтобы открыть Испытание.';
      list.appendChild(hint);
    }
  }
}