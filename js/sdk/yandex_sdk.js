/**
 * Обёртка над Yandex Games SDK.
 * Работает в двух режимах:
 *   • на платформе Яндекс Игр — все методы реально вызывают SDK
 *   • локально — методы молчат, никаких ошибок
 */

export class YandexSDK {
  constructor() {
    this.sdk = null;
    this.player = null;
    this._ready = false;
    this._callbacks = {
      pause: [],
      resume: [],
    };
  }

  get isReady() { return this._ready; }

  /** Инициализация SDK. Вызывать один раз при старте приложения. */
	async init() {
	  const host = location.hostname;
	  const isLocal =
		host === 'localhost' ||
		host === '127.0.0.1' ||
		host === '' ||
		host.endsWith('.local');

	  const forceLocal = new URLSearchParams(location.search).has('sdk');

	  // на localhost по умолчанию SDK не грузим,
	  // если очень нужно — открывай с ?sdk
	  if (isLocal && !forceLocal) {
		console.log('[sdk] local mode — SDK disabled (add ?sdk to force)');
		return false;
	  }

	  // динамически подгружаем скрипт SDK
	  try {
		await this._loadSdkScript();
	  } catch (e) {
		console.warn('[sdk] failed to load SDK script:', e);
		return false;
	  }

	  if (typeof YaGames === 'undefined') {
		console.log('[sdk] YaGames not available — работаем без SDK');
		return false;
	  }

	  try {
		this.sdk = await YaGames.init();
		this._ready = true;
		console.log('[sdk] init OK');
		// ... всё остальное как было
	  } catch (e) {
		console.error('[sdk] init failed:', e);
		return false;
	  }

	  return true;
	}

	_loadSdkScript() {
	  return new Promise((resolve, reject) => {
		if (window.YaGames) return resolve();
		const s = document.createElement('script');
		s.src = 'https://yandex.ru/games/sdk/v2';
		s.async = true;
		s.onload = () => resolve();
		s.onerror = () => reject(new Error('SDK script failed to load'));
		document.head.appendChild(s);
	  });
	}

  /* ============================================================
   *  LoadingAPI / GameplayAPI
   * ============================================================ */

  /** Сообщить платформе, что игра готова к взаимодействию. */
  gameReady() {
    if (!this._ready) return;
    try {
      this.sdk.features.LoadingAPI.ready();
      console.log('[sdk] LoadingAPI.ready()');
    } catch (e) { /* noop */ }
  }

  /** Игровой процесс начался или возобновился. */
  gameplayStart() {
    if (!this._ready) return;
    try {
      this.sdk.features.GameplayAPI.start();
      console.log('[sdk] GameplayAPI.start()');
    } catch (e) { /* noop */ }
  }

  /** Игровой процесс остановлен (пауза, меню, реклама). */
  gameplayStop() {
    if (!this._ready) return;
    try {
      this.sdk.features.GameplayAPI.stop();
      console.log('[sdk] GameplayAPI.stop()');
    } catch (e) { /* noop */ }
  }

	get isYandex() {
	  return this._ready && location.hostname !== 'localhost'
						  && location.hostname !== '127.0.0.1';
	}


  /* ============================================================
   *  Данные игрока
   * ============================================================ */

  /** Сохранить прогресс на сервер Яндекс Игр. */
  async saveProgress(data) {
    if (!this.player) return false;
    try {
      await this.player.setData(data, true);
      console.log('[sdk] setData OK');
      return true;
    } catch (e) {
      console.warn('[sdk] setData failed:', e);
      return false;
    }
  }

  /** Загрузить прогресс с сервера Яндекс Игр. */
  async loadProgress() {
    if (!this.player) return null;
    try {
      const data = await this.player.getData();
      console.log('[sdk] getData OK', data);
      return data || {};
    } catch (e) {
      console.warn('[sdk] getData failed:', e);
      return null;
    }
  }

  /* ============================================================
   *  Авторизация
   * ============================================================ */

  /** Запросить авторизацию игрока (по кнопке). */
  async authorize() {
    if (!this.sdk) return null;
    try {
      const p = await this.sdk.auth.openAuthDialog();
      console.log('[sdk] auth dialog returned');
      this.player = await this.sdk.getPlayer({ scopes: false });
      return this.player;
    } catch (e) {
      console.warn('[sdk] auth failed:', e);
      return null;
    }
  }

  isAuthorized() {
    return this.player ? this.player.getMode() !== 'lite' : false;
  }

  /* ============================================================
   *  Реклама
   * ============================================================ */

  /** Полноэкранная реклама (интерстишл). */
  async showInterstitial({ onOpen, onClose, onError } = {}) {
    if (!this.sdk) {
      // локально — просто вызываем onClose
      if (onClose) onClose(true);
      return;
    }
    this.sdk.adv.showFullscreenAdv({
      callbacks: {
        onOpen:  () => { console.log('[sdk] ad open');  onOpen?.(); },
        onClose: (wasShown) => { console.log('[sdk] ad close', wasShown); onClose?.(wasShown); },
        onError: (err) => { console.warn('[sdk] ad error', err); onError?.(err); },
      },
    });
  }

  /** Реклама за вознаграждение (RV). */
  async showRewarded({ onReward, onClose, onError } = {}) {
    if (!this.sdk) {
      if (onReward) onReward();   // локально — сразу даём награду
      return;
    }
    this.sdk.adv.showRewardedVideo({
      callbacks: {
        onOpen:   () => console.log('[sdk] rv open'),
        onRewarded: () => { console.log('[sdk] rv rewarded'); onReward?.(); },
        onClose:  () => { console.log('[sdk] rv close'); onClose?.(); },
        onError:  (err) => { console.warn('[sdk] rv error', err); onError?.(err); },
      },
    });
  }

  /* ============================================================
   *  События pause/resume
   * ============================================================ */

  onPause(fn)  { this._callbacks.pause.push(fn); }
  onResume(fn) { this._callbacks.resume.push(fn); }

  _emit(evt) {
    for (const fn of this._callbacks[evt]) {
      try { fn(); } catch (e) { console.warn('[sdk] callback error:', e); }
    }
  }

  /* ============================================================
   *  Язык и устройство
   * ============================================================ */

  /** ISO 639-1 из SDK, например 'ru', 'en', 'tr'. Фолбэк — 'ru'. */
  getLang() {
    try {
      const lang = this.sdk?.environment?.i18n?.lang;
      if (typeof lang === 'string' && lang.length >= 2) {
        return lang.slice(0, 2).toLowerCase();
      }
    } catch { /* noop */ }
    return this._fallbackLang || 'ru';
  }

  /** Тип устройства: 'desktop' | 'mobile' | 'tablet' | 'tv'. */
  getDeviceType() {
    try {
      const t = this.sdk?.deviceInfo?.type;
      if (typeof t === 'string') return t;
    } catch { /* noop */ }
    return this._deviceType || 'desktop';
  }

  isTV()     { return this.getDeviceType() === 'tv'; }
  isMobile() { return this.getDeviceType() === 'mobile'; }
  isDesktop(){ return this.getDeviceType() === 'desktop'; }

  /* ============================================================
   *  Fullscreen
   * ============================================================ */

  async requestFullscreen() {
    try {
      const el = document.documentElement;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (fn && !document.fullscreenElement) {
        await fn.call(el);
        return true;
      }
    } catch (e) {
      console.warn('[fs] native requestFullscreen failed:', e);
      // Показать подсказку пользователю
      if (e && e.name === 'NotAllowedError') {
        // Это как раз «нажмите F11» случай
        return 'denied';
      }
    }

    try {
      if (this.sdk?.screen?.fullscreen?.request) {
        await this.sdk.screen.fullscreen.request();
        return true;
      }
    } catch (e) {
      console.warn('[fs] SDK requestFullscreen failed:', e);
    }
    return false;
  }

  async exitFullscreen() {
    // 1. Нативный выход
    try {
      if (document.fullscreenElement) {
        const fn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
        if (fn) {
          await fn.call(document);
          console.log('[fs] native exitFullscreen OK');
          return true;
        }
      }
    } catch (e) {
      console.warn('[fs] native exitFullscreen failed:', e);
    }

    // 2. SDK
    try {
      if (this.sdk?.screen?.fullscreen?.exit) {
        await this.sdk.screen.fullscreen.exit();
        console.log('[fs] SDK exitFullscreen OK');
        return true;
      }
    } catch (e) {
      console.warn('[fs] SDK exitFullscreen failed:', e);
    }
    return false;
  }

  getFullscreenStatus() {
    // Нативный статус приоритетнее — работает везде
    if (document.fullscreenElement) return 'on';
    try {
      return this.sdk?.screen?.fullscreen?.status || 'off';
    } catch { return 'off'; }
  }

  /* ============================================================
   *  Устройство и язык
   * ============================================================ */

  getDeviceType() { return this._deviceType || 'desktop'; }
  isTV()          { return this.getDeviceType() === 'tv'; }
  isMobile()      { return this.getDeviceType() === 'mobile'; }
  getLanguage()   { return this._lang || 'ru'; }
}

export const ysdk = new YandexSDK();