import { audio } from '../audio/audio_engine.js';

export class PauseOverlay {
  constructor({ onResume, onExit }) {
    this.onResume = onResume;
    this.onExit = onExit;

    this.el = document.createElement('div');
    this.el.id = 'pause-overlay';
    this.el.innerHTML = `
      <div class="pause-box">
        <div class="pause-title">ПАУЗА</div>
        <div class="pause-volume">
          <div class="pause-volume__label">ГРОМКОСТЬ</div>
          <input type="range" id="pause-volume-slider"
                 min="0" max="100" step="1"
                 value="${Math.round(audio.getVolume() * 100)}">
        </div>
        <button class="pause-btn" data-action="resume">Продолжить игру</button>
        <button class="pause-btn pause-btn--danger" data-action="exit">Выйти в главное меню</button>
      </div>
    `;
    this.el.style.display = 'none';

    this.el.querySelector('[data-action="resume"]').addEventListener('click', () => {
      audio.playSfx('tap_up');
      this.hide();
      if (typeof this.onResume === 'function') this.onResume();
    });
    this.el.querySelector('[data-action="exit"]').addEventListener('click', () => {
      audio.playSfx('tap_up');
      if (typeof this.onExit === 'function') this.onExit();
      else this.hide();
    });

const slider = this.el.querySelector('#pause-volume-slider');

const updateVisual = () => {
  const v = Number(slider.value);
  slider.style.setProperty('--val', v + '%');
};

slider.addEventListener('input', () => {
  const v = Number(slider.value) / 100;
  audio.setVolume(v);
  updateVisual();
});
slider.addEventListener('change', () => {
  import('../game/settings.js').then(m => {
    m.GameSettings.masterVolume = Number(slider.value) / 100;
    m.saveSettings();
  });
});

// инициализируем визуал сразу
updateVisual();
this._updateSliderVisual = updateVisual;

    // Клавиатурная / ТВ навигация по кнопкам паузы
    this._navBtns = [];
    this._navIdx = -1;

    window.addEventListener('keydown', (e) => {
      if (this.el.style.display === 'none') return;
      if (e.repeat) return;
      if (!['ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) return;
      e.preventDefault();

      this._navBtns = [...this.el.querySelectorAll('.pause-btn')];
      if (!this._navBtns.length) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        this._navIdx = (this._navIdx + dir + this._navBtns.length) % this._navBtns.length;
        this._navBtns.forEach((b, i) => b.classList.toggle('kbd-focus', i === this._navIdx));
      } else if (this._navIdx >= 0) {
        audio.playSfx('button_click');
        this._navBtns[this._navIdx].click();
      }
    });

    document.getElementById('scene').appendChild(this.el);
  }

show() {
  const slider = this.el.querySelector('#pause-volume-slider');
  if (slider) {
    slider.value = Math.round(audio.getVolume() * 100);
    if (this._updateSliderVisual) this._updateSliderVisual();
  }
  this.el.style.display = 'flex';

  // Автофокус на первую кнопку — чтобы Enter сразу сработал
  this._navBtns = [...this.el.querySelectorAll('.pause-btn')];
  this._navIdx = 0;
  this._navBtns.forEach((b, i) => b.classList.toggle('kbd-focus', i === 0));
}
  hide() {
    this.el.style.display = 'none';
    this._navIdx = -1;
    this._navBtns.forEach(b => b.classList.remove('kbd-focus'));
  }
  isVisible() { return this.el.style.display !== 'none'; }
}