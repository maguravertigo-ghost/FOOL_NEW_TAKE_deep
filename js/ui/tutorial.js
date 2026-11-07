import { audio } from '../audio/audio_engine.js';
import { t } from '../i18n/index.js';

export class Tutorial {
  constructor() {
    this.el = null;
    this.refs = {};
    this.currentSlide = 0;
    this.slides = this._buildSlides();
    this._resolve = null;
    this._keyHandler = null;
    this._focusTarget = 'next'; // По умолчанию фокус на кнопке "Вправо"
  }

  _buildSlides() {
    return [
      { image: 'assets/tutorial/slide1.svg', titleKey: 'tutorial.s1.title', bodyKey: 'tutorial.s1.body' },
      { image: 'assets/tutorial/slide2.svg', titleKey: 'tutorial.s2.title', bodyKey: 'tutorial.s2.body' },
      { image: 'assets/tutorial/slide3.svg', titleKey: 'tutorial.s3.title', bodyKey: 'tutorial.s3.body' },
      { image: 'assets/tutorial/slide4.svg', titleKey: 'tutorial.s4.title', bodyKey: 'tutorial.s4.body' },
      { image: 'assets/tutorial/slide5.svg', titleKey: 'tutorial.s5.title', bodyKey: 'tutorial.s5.body' },
      { image: 'assets/tutorial/slide6.svg', titleKey: 'tutorial.s6.title', bodyKey: 'tutorial.s6.body' },
      { image: 'assets/tutorial/slide7.svg', titleKey: 'tutorial.s7.title', bodyKey: 'tutorial.s7.body' },
      { image: 'assets/tutorial/slide8.svg', titleKey: 'tutorial.s8.title', bodyKey: 'tutorial.s8.body' },
    ];
  }

  open(opts = {}) {
    return new Promise(resolve => {
      this._resolve = resolve;
      this.currentSlide = 0;
      this._mode = opts.mode || 'game';   // <-- ДОБАВИТЬ
      
      this._focusTarget = window.__lastInputWasKeyboard ? 'next' : null;

      this._createDOM();
      this._render();
      this._bindKeys();
    });
  }

  close() {
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
      this.refs = {};
    }
    if (this._resolve) {
      this._resolve();
      this._resolve = null;
    }
  }

  _createDOM() {
    this.el = document.createElement('div');
    this.el.className = 'tutorial-overlay';

    // <-- ДОБАВИТЬ
    const ctaText = (this._mode === 'review')
      ? t('tutorial.close')
      : t('tutorial.start');

    this.el.innerHTML = `
      <div class="tutorial__box">
        <button class="tutorial__skip mm-btn mm-btn--small" data-action="skip">${t('tutorial.skip')}</button>
        <div class="tutorial__slide">
          <div class="tutorial__img-wrap">
            <img class="tutorial__img" alt="" draggable="false">
          </div>
          <div class="tutorial__counter"></div>
          <div class="tutorial__title"></div>
          <div class="tutorial__body"></div>
        </div>
        <div class="tutorial__cta-wrap">
          <button class="tutorial__cta mm-btn mm-btn--primary" data-action="close">${ctaText}</button>
        </div>
        <div class="tutorial__nav">
          <button class="tutorial__arrow mm-btn mm-btn--small" data-action="prev">←</button>
          <div class="tutorial__dots"></div>
          <button class="tutorial__arrow mm-btn mm-btn--small" data-action="next">→</button>
        </div>
      </div>
    `;

    this.refs.img     = this.el.querySelector('.tutorial__img');
    this.refs.counter = this.el.querySelector('.tutorial__counter');
    this.refs.title   = this.el.querySelector('.tutorial__title');
    this.refs.body    = this.el.querySelector('.tutorial__body');
    this.refs.prev    = this.el.querySelector('[data-action="prev"]');
    this.refs.next    = this.el.querySelector('[data-action="next"]');
    this.refs.cta     = this.el.querySelector('.tutorial__cta');
    this.refs.skip    = this.el.querySelector('.tutorial__skip');
    this.refs.dots    = this.el.querySelector('.tutorial__dots');

    this.refs.dots.innerHTML = this.slides
      .map(() => `<span class="tutorial__dot"></span>`)
      .join('');

    // При клике мышью — обновляем фокус на нажатую кнопку
    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        this._focusTarget = btn.dataset.action;
        this._onAction(btn.dataset.action);
      }
    });

    document.getElementById('scene').appendChild(this.el);
  }

  _onAction(action) {
    if (action === 'skip' || action === 'close') {
      audio.playSfx('tap_up');
      this.close();
      return;
    }
    
    if (action === 'prev') {
      if (this.currentSlide > 0) {
        audio.playSfx('tap');
        this.currentSlide--;
        this._focusTarget = (this.currentSlide === 0) ? 'next' : 'prev';
        this._render();
      }
    }
    
    if (action === 'next') {
      if (this.currentSlide < this.slides.length - 1) {
        audio.playSfx('tap');
        this.currentSlide++;
        this._focusTarget = (this.currentSlide === this.slides.length - 1) ? 'cta' : 'next';
        this._render();
      }
    }
  }

  _render() {
    const s = this.slides[this.currentSlide];
    const total = this.slides.length;
    const isFirst = this.currentSlide === 0;
    const isLast  = this.currentSlide === total - 1;

    // Обновляем контент
    this.refs.img.src = s.image;
    this.refs.counter.textContent = `${this.currentSlide + 1} / ${total}`;
    this.refs.title.textContent = t(s.titleKey);
    this.refs.body.textContent  = t(s.bodyKey);

    // Точки
    this.refs.dots.querySelectorAll('.tutorial__dot').forEach((dot, i) => {
      dot.classList.toggle('tutorial__dot--active', i === this.currentSlide);
    });

    // Видимость кнопок
    this.refs.prev.style.visibility = isFirst ? 'hidden' : 'visible';
    this.refs.next.style.visibility = isLast  ? 'hidden' : 'visible';
    this.refs.cta.style.visibility  = isLast  ? 'visible' : 'hidden';
    this.refs.skip.style.visibility = isLast  ? 'hidden' : 'visible';

    // Применяем фокус (курсор)
    this._applyFocus();
  }

  _applyFocus() {
    if (!this.el) return;
    
    // Снимаем старый фокус
    this.el.querySelectorAll('.kbd-focus').forEach(el => el.classList.remove('kbd-focus'));
    
    let targetEl = null;
    if (this._focusTarget === 'skip' && this.refs.skip.style.visibility !== 'hidden') targetEl = this.refs.skip;
    if (this._focusTarget === 'prev' && this.refs.prev.style.visibility !== 'hidden') targetEl = this.refs.prev;
    if (this._focusTarget === 'next' && this.refs.next.style.visibility !== 'hidden') targetEl = this.refs.next;
    if (this._focusTarget === 'cta'  && this.refs.cta.style.visibility !== 'hidden')  targetEl = this.refs.cta;

    if (targetEl) targetEl.classList.add('kbd-focus');
  }

  _bindKeys() {
    this._keyHandler = (e) => {
      if (!this.el) return;
      const total = this.slides.length;
      const isLast = this.currentSlide === total - 1;
      const isFirst = this.currentSlide === 0;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (this._focusTarget !== 'skip' && !isLast) {
          audio.playSfx('tap');
          this._focusTarget = 'skip';
          this._applyFocus();
        } else {
          audio.playSfx('tap_up');
          this.close();
        }
        return;
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
        e.preventDefault();
        window.__lastInputWasKeyboard = true;
      }

      if (e.key === 'ArrowUp') {
        if (!isLast && this._focusTarget !== 'skip') {
          this._focusTarget = 'skip';
          this._applyFocus();
          audio.playSfx('tap');
        }
      } 
      else if (e.key === 'ArrowDown') {
        const bottomTarget = isLast ? 'cta' : 'next';
        if (this._focusTarget !== bottomTarget) {
          this._focusTarget = bottomTarget;
          this._applyFocus();
          audio.playSfx('tap');
        }
      } 
      else if (e.key === 'ArrowLeft') {
        if (!isFirst) {
          this.currentSlide--;
          this._focusTarget = (this.currentSlide === 0) ? 'next' : 'prev';
          this._render();
          audio.playSfx('tap');
        }
      } 
      else if (e.key === 'ArrowRight') {
        if (!isLast) {
          this.currentSlide++;
          this._focusTarget = (this.currentSlide === total - 1) ? 'cta' : 'next';
          this._render();
          audio.playSfx('tap');
        }
      } 
      else if (e.key === 'Enter') {
        // Нажимаем на кнопку, на которой сейчас фокус
        if (this._focusTarget === 'skip') this.refs.skip.click();
        else if (this._focusTarget === 'prev') this.refs.prev.click();
        else if (this._focusTarget === 'next') this.refs.next.click();
        else if (this._focusTarget === 'cta')  this.refs.cta.click();
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  }
}