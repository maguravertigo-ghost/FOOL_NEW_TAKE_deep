const LS_KEY = 'fool_game_settings';

export const DEFAULT_SETTINGS = {
  sfxEnabled:    true,
  musicEnabled:  true,
  masterVolume:  0.8,      // ← добавь
  deckSize:      36,
  handLayout:    'fan',
  cardStyle:     'grid',
  suitStyle:     'gradient',
  shirtStyle:    0,
  tableStyle:    0,
  decorStyle:    -1,
};

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export const GameSettings = load();

export function saveSettings() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(GameSettings)); } catch {}
}