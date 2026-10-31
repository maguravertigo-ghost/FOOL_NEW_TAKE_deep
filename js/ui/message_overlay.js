import { audio } from '../audio/audio_engine.js';
import { t } from '../i18n/index.js';


/* Найти активный контейнер модалок: если есть #scene — кидаем туда,
   иначе — в body (для тестов). */
function getHost() {
  return document.getElementById('scene') || document.body;
}

export function showMessage(text, { title = '', onClose } = {}) {
  const el = document.createElement('div');
  el.className = 'msg-overlay';
  el.style.display = 'flex';           // ← принудительно
  el.innerHTML = `
    <div class="msg-overlay__box">
      ${title ? `<div class="msg-overlay__title">${title}</div>` : ''}
      <div class="msg-overlay__body">${text}</div>
      <button class="mm-btn mm-btn--small" data-msg-btn data-close>${t('dialog.ok')}</button>
    </div>`;
  getHost().appendChild(el);

  // Автофокус на кнопку ОК — только если предыдущее действие с клавиатуры
  const wasKbd = window.__lastInputWasKeyboard === true;
  if (wasKbd) {
    requestAnimationFrame(() => {
      const okBtn = el.querySelector('[data-close]');
      if (okBtn) okBtn.classList.add('kbd-focus');
    });
  }

  const close = () => {
    audio.playSfx('tap_up');
    el.remove();
    if (typeof onClose === 'function') onClose();
  };
  el.querySelector('[data-close]').addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  return el;
}

export function showConfirm(text, { title = '', onConfirm, onCancel } = {}) {
  const el = document.createElement('div');
  el.className = 'msg-overlay';
  el.style.display = 'flex';           // ← принудительно
  el.innerHTML = `
    <div class="msg-overlay__box">
      ${title ? `<div class="msg-overlay__title">${title}</div>` : ''}
      <div class="msg-overlay__body">${text}</div>
		<div class="msg-overlay__actions">
		  <button class="mm-btn mm-btn--small" data-msg-btn data-cancel>${t('dialog.cancel')}</button>
		  <button class="mm-btn mm-btn--small mm-btn--danger" data-ok>${t('dialog.yes')}</button>
		</div>
    </div>`;
  getHost().appendChild(el);

  // Автофокус на кнопку ОК — только если предыдущее действие с клавиатуры
  const wasKbd = window.__lastInputWasKeyboard === true;
  if (wasKbd) {
    requestAnimationFrame(() => {
      const okBtn = el.querySelector('[data-cancel]');
      if (okBtn) okBtn.classList.add('kbd-focus');
    });
  }

  const close = () => el.remove();
  el.querySelector('[data-ok]').addEventListener('click', () => {
    audio.playSfx('tap_up');
    close();
    if (typeof onConfirm === 'function') onConfirm();
  });
  el.querySelector('[data-cancel]').addEventListener('click', () => {
    audio.playSfx('tap_up');
    close();
    if (typeof onCancel === 'function') onCancel();
  });
  return el;
}