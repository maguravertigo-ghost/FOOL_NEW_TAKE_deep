import { RANKS_36, RANKS_52, SUITS } from './constants.js';

export class Deck {
  /**
   * @param {'36'|'52'} type
   */
  constructor(type = '36') {
    this.type = type;
    this.cards = this._build();
  }

  _build() {
    const ranks = this.type === '52' ? RANKS_52 : RANKS_36;
    const out = [];
    for (const suit of SUITS) {
      for (const rank of ranks) {
        out.push({ rank, suit });
      }
    }
    return out;
  }

  shuffle() {
    const a = this.cards;
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return this;
  }

  draw() {
    return this.cards.pop() || null;
  }

  size() { return this.cards.length; }
}