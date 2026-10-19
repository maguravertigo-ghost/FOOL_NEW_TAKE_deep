const LS_KEY = 'fool_progress';

const ORDER_36 = ['6','7','8','9','10','J','Q','K','A'];
const ORDER_52 = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function defaultState() {
  const quests = {};
  for (const r of ORDER_52) quests[r] = { progress: 0, claimed: 0 };
  return {
    stylePoints: 0,
    quests,
    stats: { games: 0, wins: 0, losses: 0, draws: 0 },
    // какие индексы элементов куплены
	purchases: {
	  shirt:  [0],
	  design: [0],
	  suits:  [0],   // default открыт
	  table:  [0],
	  decor:  [],
	},
  };
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const p = JSON.parse(raw);
    const def = defaultState();
    return {
      stylePoints: p.stylePoints ?? 0,
      quests:      Object.assign(def.quests, p.quests || {}),
      stats:       Object.assign(def.stats,  p.stats  || {}),
      purchases:   Object.assign(def.purchases, p.purchases || {}),
    };
  } catch { return defaultState(); }
}

export const Progress = load();

export function saveProgress() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(Progress)); } catch {}
}

export function addStylePoints(n) {
  Progress.stylePoints = (Progress.stylePoints || 0) + n;
  saveProgress();
}

export function recordOutcome(winner) {
  const s = Progress.stats;
  s.games++;
  if (winner === 'player') s.wins++;
  else if (winner === 'cpu') s.losses++;
  else s.draws++;
  saveProgress();
}

/* ================================================================
 *  КВЕСТЫ — строго по порядку
 * ================================================================ */

/** Открыт ли режим «Испытание» — все квесты 36-колоды заклеймлены. */
export function isTestModeUnlocked() {
  return ORDER_36.every(r => Progress.quests[r].claimed >= 2);
}

/** Текущий активный порядок квестов. */
export function activeOrder() {
  return isTestModeUnlocked() ? ORDER_52 : ORDER_36;
}

/** Может ли текущий игровой ранг идти в зачёт квеста? */
function canCredit(rank) {
  const order = activeOrder();
  const idx = order.indexOf(rank);
  if (idx < 0) return false;
  for (let i = 0; i < idx; i++) {
    const q = Progress.quests[order[i]];
    if (!q || q.progress < 2) return false;
  }
  return true;
}

export function creditQuest(rank, count) {
  if (count < 2) return null;
  if (!canCredit(rank)) return null;
  const q = Progress.quests[rank];
  if (!q) return null;
  q.progress = Math.max(q.progress, Math.min(count, 4));
  saveProgress();
  return rank;
}

export function claimableRanks() {
  const order = activeOrder();
  const out = [];
  for (const r of order) {
    const q = Progress.quests[r];
    if (q.progress >= 2 && q.claimed < q.progress) out.push(r);
  }
  return out;
}

export function claimQuestReward() {
  const ranks = claimableRanks();
  let total = 0;
  for (const r of ranks) {
    const q = Progress.quests[r];
    total += 250 + 50 * q.progress;
    q.claimed = q.progress;
  }
  if (total > 0) {
    Progress.stylePoints += total;
    saveProgress();
  }
  return { total, ranks };
}

export function resetQuests() {
  for (const r of ORDER_52) {
    Progress.quests[r] = { progress: 0, claimed: 0 };
  }
  Progress.stylePoints = 0;
  saveProgress();
}

/* ================================================================
 *  ПОКУПКИ
 * ================================================================ */

export const PRICES = {
  shirt:  500,
  design: 350,
  suits:  400,   // ← стили мастей
  table:  250,
  decor:  2000,
};

export function isPurchased(cat, index) {
  return (Progress.purchases[cat] || []).includes(index);
}

export function purchaseItem(cat, index, price) {
  if (isPurchased(cat, index)) return { ok: false, reason: 'already' };
  if (Progress.stylePoints < price) return { ok: false, reason: 'no_money' };
  Progress.stylePoints -= price;
  if (!Progress.purchases[cat]) Progress.purchases[cat] = [];
  Progress.purchases[cat].push(index);
  saveProgress();
  return { ok: true };
}