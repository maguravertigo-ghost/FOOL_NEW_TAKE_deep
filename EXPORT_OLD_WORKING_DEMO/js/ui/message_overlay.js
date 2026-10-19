import { audio } from '../audio/audio_engine.js';
export function showMessage(text, { title = '', onClose } = {}) {
  const el = document.createElement('div');
  el.className = 'msg-overlay';
  el.innerHTML = `
    <div class="msg-overlay__box">
      ${title ? `<div class="msg-overlay__title">${title}</div>` : ''}
      <div class="msg-overlay__body">${text}</div>
      <button class="mm-btn mm-btn--small" data-close>ОК</button>
    </div>`;
  document.body.appendChild(el);
  const close = () => {
    el.remove();
    if (typeof onClose === 'function') onClose();
  };
  el.querySelector('[data-close]').addEventListener('click', () => {
	  audio.playSfx('tap_up');
	  close();
	});
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  return el;
}

export function showConfirm(text, { title = '', onConfirm, onCancel } = {}) {
  const el = document.createElement('div');
  el.className = 'msg-overlay';
  el.innerHTML = `
    <div class="msg-overlay__box">
      ${title ? `<div class="msg-overlay__title">${title}</div>` : ''}
      <div class="msg-overlay__body">${text}</div>
      <div class="msg-overlay__actions">
        <button class="mm-btn mm-btn--small" data-cancel>Отмена</button>
        <button class="mm-btn mm-btn--small mm-btn--danger" data-ok>Да</button>
      </div>
    </div>`;
  document.body.appendChild(el);
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