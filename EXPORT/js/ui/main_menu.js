import { audio } from '../audio/audio_engine.js';
import { withLoading } from './loading_overlay.js';
import { ASSETS } from '../assets.js';
import { GameSettings, saveSettings } from '../game/settings.js';
import {
  Progress, saveProgress, claimQuestReward, resetQuests,
  activeOrder, isTestModeUnlocked,
  PRICES, isPurchased, purchaseItem,
  claimableRanks,
} from '../game/progress.js';
import { showMessage, showConfirm } from './message_overlay.js';
import { spawnCard, clearCache, warmUpDeck } from '../game/card_cache.js';
import { Card } from '../game/card.js';

import { HudLayout } from './hud_layout.js';
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
      img.style.padding   = `${H.s(3)}px ${H.s(11)}px`;
      img.style.boxSizing = 'border-box';
      img.style.width     = '100%';
      img.style.height    = '100%';
      img.style.objectFit = 'contain';
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
    fontSize: H.s(16) + 'px',
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
    fontSize: H.s(16) + 'px',
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
      fontSize: H.s(15) + 'px',
      padding: `${H.s(8)}px ${H.s(14)}px`,
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
      fontSize: H.s(17) + 'px',
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
      fontSize: H.s(17) + 'px',
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
    if (name === 'settings') return this._openSettings();
    if (name === 'style')    return this._openStyle();
    if (name === 'quest')    return this._openQuest();
    if (name === 'help')     return this._openHelp();
    if (name === 'shop')     return this._openShop();
    const ov = this._getSimpleOverlay(name);
    if (!ov) return;
    ov.style.display = 'flex';
    this._activeOverlay = ov;
  }
  _closeOverlay() {
    if (this._previewOverlay) { this._previewOverlay.remove(); this._previewOverlay = null; }
    if (this._activeOverlay) {
      this._activeOverlay.style.display = 'none';
      this._activeOverlay = null;
    }
  }
  _getSimpleOverlay(name) {
    if (this._overlays[name]) return this._overlays[name];
    let el = null;
    if (name === 'about') el = this._buildAbout();
    if (el) { this.el.appendChild(el); this._overlays[name] = el; }
    return el;
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
            <button class="mm-btn mm-btn--small" data-close>В МЕНЮ</button>
          </div>
          <div class="mm-overlay__body mm-overlay__body--scroll">
            <p><b>Цель игры.</b> Сбросить все карты раньше соперника. Кто остался с картами — тот «дурак».</p>
            <p><b>Раздача.</b> Каждому по 6 карт. Верхняя карта колоды — козырь.</p>
            <p><b>Ход.</b> Первый игрок кладёт карту — атакует. Второй должен «отбиться» — побить карту старшей того же масти или любым козырем.</p>
            <p><b>Козырь.</b> Козырь бьёт любую некозырную карту. Козырь бьётся только козырем старшего ранга.</p>
            <p><b>Подкидывание.</b> После отбоя атакующий может подкинуть карты того же ранга, что уже лежат на столе.</p>
            <p><b>Переводной режим.</b> До первого отбоя защитник может перевести карту на атакующего — положить карту того же ранга. Роли меняются.</p>
            <p><b>Погоны.</b> Если в финале игрок выкидывает две шестёрки подряд — он «вешает погоны»: +250 очков.</p>
            <p><b>Очки стиля.</b> 100 за победу, 250 за погоны, 250+50×N за квест.</p>
          </div>
        </div>`;
      this._bindClose(ov);
      this.el.appendChild(ov);
      this._overlays.help = ov;
    }
    ov.style.display = 'flex';
    this._activeOverlay = ov;
  }

  /* ---------------- SETTINGS ---------------- */

  _openSettings() {
    let ov = this._overlays.settings;
    if (!ov) { ov = this._buildSettings(); this.el.appendChild(ov); this._overlays.settings = ov; }
    this._refreshSettings(ov);
    ov.style.display = 'flex';
    this._activeOverlay = ov;
  }
  _buildSettings() {
    const el = document.createElement('div');
    el.className = 'mm-overlay';
    el.innerHTML = `
      <div class="mm-overlay__box">
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
      }

      GameSettings[key] = opt.val;   // для handLayout это no-op, для остальных — как было
      saveSettings();
      this._refreshRow(row, key);
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
    this._renderShop(ov, this._shopCategory);
    ov.style.display = 'flex';
    this._activeOverlay = ov;
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
    const bought = isPurchased(cat, item.index);
    const tile = document.createElement('div');
    tile.className = 'shop-item' + (bought ? ' shop-item--bought' : '');
    if (cat === 'decor') tile.classList.add('shop-item--decor');

    // превью
    const prev = this._makePreview(item, cat);
    if (prev) tile.appendChild(prev);

    if (bought) {
      const ck = document.createElement('div');
      ck.className = 'mm-tile__check';
      ck.textContent = '✓';
      tile.appendChild(ck);
    } else {
      const pr = document.createElement('div');
      pr.className = 'shop-item__price';
      pr.textContent = item.price;
      tile.appendChild(pr);
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
      'justify-content:center;padding:6px;box-sizing:border-box;';

    // Обёртка .card__face — активирует все CSS-правила card_constructor
    const face = document.createElement('div');
    face.className = 'card__face';
    face.style.cssText =
      'position:relative;display:flex;align-items:center;' +
      'justify-content:center;';
    face.style.setProperty('--card-w', '110px');   // ← размер превью

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
  if (isPurchased(cat, index)) return;

  showConfirm(
    `Вы желаете приобрести:<br><b>${item.label}</b><br>за <b class="mm-stat-value--accent">${item.price}</b> очков стиля?`,
    {
      title: 'Покупка',
      onConfirm: () => {
        const res = purchaseItem(cat, index, item.price);
        if (!res.ok) {
		  audio.playSfx('tap_up');	
          showMessage(res.reason === 'no_money' ? 'Недостаточно очков стиля.' : 'Уже куплено.');
          return;
        }
		if (res.ok) audio.playSfx('buy');
        // автоматически применяем купленное
        this._applyStyleItem(cat, item);
        this._refreshStats();
        this._renderShop(root, this._shopCategory);
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

    const tile = document.createElement('div');
    tile.className = 'mm-tile' + (i === selected ? ' mm-tile--active' : '');
    tile.classList.toggle('mm-tile--locked', !bought);
    if (cat === 'decor') tile.classList.add('mm-tile--decor');

    const prev = this._makePreview(item, cat);
    if (prev) tile.appendChild(prev);

    if (!bought) {
      const lock = document.createElement('div');
      lock.className = 'mm-tile__lock';
      lock.textContent = '🔒';
      tile.appendChild(lock);
    } else if (i === selected) {
      const ck = document.createElement('div');
      ck.className = 'mm-tile__check';
      ck.textContent = '✓';
      tile.appendChild(ck);
    }

    tile.addEventListener('click', () => {
      if (!isPurchased(cat, i)) {
        showMessage('Этот элемент ещё не куплен. Загляните в магазинчик.', { title: 'Заблокировано' });
        return;
      }
	  audio.playSfx('switch');
      this._selectedStyle[cat] = i;
      this._applyStyleItem(cat, item);
      this._renderStyleTiles(root);
    });

    tiles.appendChild(tile);
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

  // клик по любому месту — закрыть
	this._previewOverlay.addEventListener('click', () => {
	  audio.playSfx('tap_up');
	  this._previewOverlay.remove();
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
      const done = q.progress >= 2;
      const claimed = done && q.claimed >= q.progress;
      const prevOK = (() => {
        const idx = order.indexOf(r);
        if (idx <= 0) return true;
        return order.slice(0, idx).every(p => Progress.quests[p].progress >= 2);
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