import { REAL } from './constants.js';

export const DEFAULTS = {
  frameL: 0.0055,
  frameT: 0.0075,
  frameR: 0.0055,
  frameB: 0.0095,
  centerLift: 0.01,
  deckStackSize: 6,
  deckStackDx:   0.025,
  deckStackDy:   0.025,
  arkOffsetH: 2.4,
  discardOffsetH: 0.15,
  discardRadius:  0.09,
  accInsetH:     1.4,
  accPlayerLift: 0.5,
  accCpuDrop:    0.5,
  accFanAngle:   8,
  insOffsetH: 1.25,
  insInsetW:  0.85,
  tableRowsH:      0.15,
  tableMarginXH:   2.1,
  tableAtkOffsetY: -0.15,
  tableDefOffsetY:  0.25,
  tableDefOffsetX:  0.15,
  tablePairDropH:   0.3,
  tableAtkAngle:   -8,
  tableDefAngle:    8,
  tableSlots:       6,
  translateMode: true,
};
/* ==================================================================
 *  Пресеты для разных устройств.
 *  desktop — текущая раскладка 1366×768.
 *  mobile  — ландшафт телефона: колода/отбой к краям, аккордеоны
 *            уходят за границы сцены, стол крупнее.
 * ================================================================== */
export const PRESETS = {
  desktop: { ...DEFAULTS },

  mobile: {
    ...DEFAULTS,

    frameL: -0.08,
    frameR: 0.01,
    frameT: 0.01,
    frameB: 0.01,
    centerLift: 0.0,

    deckStackSize: 5,
    deckStackDx: 0.024,
    deckStackDy: 0.024,
    arkOffsetH: 0.9,

    discardOffsetH: 0.08,
    discardRadius: 0.055,

    accInsetH: 0.35,
    accPlayerLift: 0.12,
    accCpuDrop:    0.0,
    accFanAngle: 6,            // было 12 — меньше вертикальный «разлёт»
    accMinDistMul: 1.0,        // базовый отступ 90% ширины карты (как на десктопе)

    insOffsetH: 0.9,
    insInsetW:  0.5,

    // Стол — центрирован и атака/защита разнесены по вертикали
    tableRowsH:      0.30,    // было 0.20 — выше разброс
    tableMarginXH:   1.4,     // было 1.05 — стол уже, слоты ближе к центру
    tableAtkOffsetY: -0.15,   // было -0.13
    tableDefOffsetY:  0.15,   // было 0.22 — защита ниже, чтобы не наезжала на атаку
    tableDefOffsetX:  0.11,
    tablePairDropH:   0.25,
    tableAtkAngle:   -7,
    tableDefAngle:    9,
  },
};

export class SceneLayout {
  static config = { ...DEFAULTS };
  static currentPreset = 'desktop';

  static setPreset(name) {
    if (!PRESETS[name]) return;
    if (this.currentPreset === name) return;
    this.currentPreset = name;
    this.config = { ...PRESETS[name] };
  }

  static resetConfig() { this.config = { ...PRESETS[this.currentPreset] }; }

  static apply(reg, scene) {
    const C = this.config;
    const W = scene.width;
    const H = scene.height;
    const cw = REAL.w;
    const ch = REAL.h;

    // ---- рамка LTRB в пикселях ----
    const L = C.frameL * W;
    const R = W - C.frameR * W;
    const T = C.frameT * H;
    const B = H - C.frameB * H;

    // ---- 0. center ----
    const cxPx = W / 2;
    const cyPx = H / 2 - C.centerLift * H;

    // ---- 1. deck ----
    const deckX = L + cw / 2;
    const deckY = cyPx;

    // ---- низ колоды ----
    const stack_dx = C.deckStackDx * cw;
    const stack_dy = C.deckStackDy * ch;
    const deckBotX = deckX + stack_dx * (C.deckStackSize - 1);
    const deckBotY = deckY + stack_dy * (C.deckStackSize - 1);

    // ---- 4. trump ----
    const trumpX = deckBotX + cw / 2;
    const trumpY = deckBotY;

    // ---- 2. ark ----
    const arkX = deckX + C.arkOffsetH * ch;
    const arkY = deckY;

    // ---- 3. sub_ark ----
    const subArkX = arkX;
    const subArkY = trumpY;

    // ---- discard ----
    const discardX = R - C.discardOffsetH * ch;
    const discardY = cyPx;

    // ---- аккордеоны ----
    const accPlayerY = B - C.accPlayerLift * ch;
    const accCpuY    = T + C.accCpuDrop    * ch;
    const accLX      = L + C.accInsetH * ch;
    const accRX      = R - C.accInsetH * ch;

    // ---- линии вставки ----
    const insPlayerY = accPlayerY - C.insOffsetH * ch;
    const insCpuY    = accCpuY    + C.insOffsetH * ch;
    const insLX      = accLX + C.insInsetW * cw;
    const insRX      = accRX - C.insInsetW * cw;

    // ---- стол ----
    const tblW   = (R - L) - C.tableMarginXH * ch * 2;
    const tblH   = C.tableRowsH * ch;
    const tblL   = (W - tblW) / 2;
    const tblCy  = cyPx;

    const tblTopY = tblCy - tblH / 2;
    const tblBotY = tblCy + tblH / 2;

    const tblAtkY = tblTopY + C.tableAtkOffsetY * ch;
    const tblDefY = tblBotY - C.tableDefOffsetY * ch;

    const defShiftX = C.tableDefOffsetX * cw;

    const slotsCount = C.tableSlots;
    const slotStep   = slotsCount > 1 ? tblW / (slotsCount - 1) : 0;
    const slotX = (i) => tblL + slotStep * i;

    // ---- локальный помощник: вход в пикселях, в реестр — в долях ----
    const put = (name, xPx, yPx, angle = 0) =>
      this._put(reg, name, xPx / W, yPx / H, angle);

    // ---- запись в реестр ----
    put('center',  cxPx,     cyPx);
    put('deck',    deckX,    deckY);
    put('ark',     arkX,     arkY);
    put('sub_ark', subArkX,  subArkY);
    put('trump', trumpX, trumpY, 90);   // козырь лежит горизонтально, top-edge → right
    put('discard', discardX, discardY);

    put('acc_player_L', accLX, accPlayerY);
    put('acc_player_R', accRX, accPlayerY);
    put('acc_cpu_L',    accLX, accCpuY);
    put('acc_cpu_R',    accRX, accCpuY);

    put('ins_player_L', insLX, insPlayerY);
    put('ins_player_R', insRX, insPlayerY);
    put('ins_cpu_L',    insLX, insCpuY);
    put('ins_cpu_R',    insRX, insCpuY);

    for (let i = 0; i < slotsCount; i++) {
      const drop = (i % 2 === 1) ? C.tablePairDropH * ch : 0;
      put(`table_atk_${i}`, slotX(i),             tblAtkY + drop, C.tableAtkAngle);
      put(`table_def_${i}`, slotX(i) + defShiftX, tblDefY + drop, C.tableDefAngle);
    }

    // ---- метрики для дебага и тюнера ----
    this.metrics.px = {
      W, H, cw, ch,
      L, T, R, B,
      tblL, tblTopY, tblR: tblL + tblW, tblBotY, tblCy,
      discardX, discardY,
    };
  }

  /** Обновляет маркер по имени: если есть — перезаписывает поля, иначе создаёт.
   *  Возвращает актуальный маркер. Работает и с углом. */
  static _put(reg, name, x, y, angle = 0) {
    const existing = reg.tryGet(name);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.angle = angle;
      return existing;
    }
    return reg.set(name, x, y, angle);
  }

  static metrics = { px: null };
}