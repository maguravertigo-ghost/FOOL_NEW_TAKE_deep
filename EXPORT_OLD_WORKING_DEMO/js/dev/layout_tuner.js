import { SceneLayout, DEFAULTS } from '../game/scene_layout.js';

const LS_KEY = 'scene_layout_cfg';
const LS_SKIP = 'dev_skip_animation';

const FIELDS = [
  ['frameL', 'Frame L (×W)',  0.005, 0,    0.30],
  ['frameR', 'Frame R (×W)',  0.005, 0,    0.30],
  ['frameT', 'Frame T (×H)',  0.005, 0,    0.30],
  ['frameB', 'Frame B (×H)',  0.005, 0,    0.30],
  ['centerLift', 'Center lift (×H)', 0.005, -0.10, 0.10],

  ['deckStackSize', 'Deck stack size', 1, 0, 12],
  ['deckStackDx', 'Deck dx (×W)', 0.005, -0.20, 0.20],
  ['deckStackDy', 'Deck dy (×H)', 0.005, -0.20, 0.20],

  ['arkOffsetH', 'Ark offset (×H)', 0.1, 0, 8],
  ['discardOffsetH', 'Discard offset (×H)', 0.1, 0, 6],
  ['discardRadius', 'Discard radius', 0.005, 0.02, 0.40],

  ['accInsetH', 'Acc inset (×H)', 0.1, 0, 5],
  ['accPlayerLift', 'Acc Player lift (×H)', 0.05, 0, 3],
  ['accCpuDrop',    'Acc CPU drop (×H)',   0.05, 0, 3],
  ['accFanAngle', 'Acc fan angle°',   0.5, -45, 45],

  ['insOffsetH', 'Ins offset (×H)', 0.05, 0, 4],
  ['insInsetW', 'Ins inset (×W)', 0.05, 0, 4],

  ['tableRowsH',      'Table height (×H)',   0.05, 0.5, 4],
  ['tableMarginXH',   'Table margin (×H)',   0.05, 0, 6],
  ['tableAtkOffsetY', 'Atk Y offset (×H)',   0.05, -2, 2],
  ['tableDefOffsetY', 'Def Y offset (×H)',   0.05, -2, 2],
  ['tableDefOffsetX', 'Def X shift (×W)',    0.05, -2, 2],
  ['tablePairDropH', 'Alt slot drop (×H)', 0.05, -1, 1],
  ['tableAtkAngle',   'Atk angle°',          1, -45, 45],
  ['tableDefAngle',   'Def angle°',          1, -45, 45],
];

function loadCfg() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch { return null; }
}

function saveCfg(cfg) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch {}
}
function loadSkip() {
  try {
    const v = localStorage.getItem(LS_SKIP);
    return v === null ? true : v === '1';   // по умолчанию — пропускать
  } catch { return true; }
}
function saveSkip(v) {
  try { localStorage.setItem(LS_SKIP, v ? '1' : '0'); } catch {}
}
export function installLayoutTuner({ onChange }) {
  const saved = loadCfg();
  if (saved) Object.assign(SceneLayout.config, saved);

  let dirty = false;

  const root = document.createElement('div');
  root.id = 'layout-tuner';
  root.style.cssText = `
    position: fixed; top: 12px; right: 12px; z-index: 200;
    width: 260px; max-height: 90vh; overflow-y: auto;
    padding: 10px 12px;
    background: rgba(20,20,20,0.92);
    color: #eee; font: 12px/1.35 ui-monospace, Menlo, Consolas, monospace;
    border: 1px solid #444; border-radius: 6px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.55);
  `;

  const title = document.createElement('div');
  title.textContent = 'LAYOUT';
  title.style.cssText = 'font-weight:700; letter-spacing:1px; margin-bottom:8px; color:#9f9;';
  root.appendChild(title);
  
    const translateRow = document.createElement('label');
  translateRow.style.cssText =
    'display:flex; align-items:center; gap:8px; margin:4px 0 6px;' +
    'cursor:pointer; user-select:none; padding:4px 6px;' +
    'background:#1a1a2a; border:1px solid #2e2e4a; border-radius:4px;';

  const translateCb = document.createElement('input');
  translateCb.type = 'checkbox';
  translateCb.checked = SceneLayout.config.translateMode !== false;
  translateCb.addEventListener('change', () => {
    SceneLayout.config.translateMode = translateCb.checked;
    saveCfg(SceneLayout.config);
    onChange();
  });

  const translateLab = document.createElement('span');
  translateLab.textContent = 'Translate mode';
  translateLab.style.cssText = 'color:#99f;';

  translateRow.appendChild(translateCb);
  translateRow.appendChild(translateLab);
  root.appendChild(translateRow);
  
    let skipAnimation = loadSkip();

  const skipRow = document.createElement('label');
  skipRow.style.cssText =
    'display:flex; align-items:center; gap:8px; margin:4px 0 10px;' +
    'cursor:pointer; user-select:none; padding:4px 6px;' +
    'background:#1a2a1a; border:1px solid #2e4a2e; border-radius:4px;';

  const skipCb = document.createElement('input');
  skipCb.type = 'checkbox';
  skipCb.checked = skipAnimation;
  skipCb.addEventListener('change', () => {
    skipAnimation = skipCb.checked;
    saveSkip(skipAnimation);
  });

  const skipLab = document.createElement('span');
  skipLab.textContent = 'Skip animation (dev)';
  skipLab.style.cssText = 'color:#9f9;';

  skipRow.appendChild(skipCb);
  skipRow.appendChild(skipLab);
  root.appendChild(skipRow);

  const inputs = new Map();

  for (const [key, label, step, min, max] of FIELDS) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:6px; margin:2px 0;';

    const lab = document.createElement('label');
    lab.textContent = label;
    lab.style.cssText = 'flex:1 1 auto; opacity:.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';

    const input = document.createElement('input');
    input.type = 'number';
    input.step = String(step);
    input.min  = String(min);
    input.max  = String(max);
    input.value = String(SceneLayout.config[key]);
    input.style.cssText = 'width:74px; background:#111; color:#eee; border:1px solid #333; border-radius:4px; padding:2px 4px; font:inherit;';

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      if (!Number.isFinite(v)) return;
      SceneLayout.config[key] = v;
      dirty = true;
      updateApplyBtn();
    });

    // Enter — «применить»
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyNow();
    });

    row.appendChild(lab);
    row.appendChild(input);
    root.appendChild(row);
    inputs.set(key, { input, wrap: row });
  }

  // ---- кнопки ----
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; gap:6px; margin-top:10px;';

  const mkBtn = (text, onClick) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = `
      flex:1; padding:5px 8px; cursor:pointer;
      background:#2b2b2b; color:#eee; border:1px solid #444; border-radius:4px;
      font:inherit;
    `;
    b.onmouseenter = () => b.style.filter = 'brightness(1.2)';
    b.onmouseleave = () => b.style.filter = '';
    b.addEventListener('click', onClick);
    return b;
  };

  const applyBtn = mkBtn('Apply', () => applyNow());

  const resetBtn = mkBtn('Reset', () => {
    SceneLayout.resetConfig();
    saveCfg(SceneLayout.config);
    inputs.forEach(({ input }, key) => { input.value = String(SceneLayout.config[key]); });
	translateCb.checked = SceneLayout.config.translateMode !== false;
    dirty = false;
    updateApplyBtn();
    onChange();
  });

  const copyBtn = mkBtn('Copy', () => {
    const txt = JSON.stringify(SceneLayout.config, null, 2);
    navigator.clipboard?.writeText(txt);
    console.log('SceneLayout.config =\n' + txt);
  });

  btnRow.appendChild(applyBtn);
  btnRow.appendChild(resetBtn);
  btnRow.appendChild(copyBtn);
  root.appendChild(btnRow);

  const btnRow2 = document.createElement('div');
  btnRow2.style.cssText = 'display:flex; gap:6px; margin-top:6px;';

  btnRow2.appendChild(mkBtn('Hide (H)', () => { root.style.display = 'none'; }));
  root.appendChild(btnRow2);

  document.body.appendChild(root);

  function applyNow() {
    saveCfg(SceneLayout.config);
    dirty = false;
    updateApplyBtn();
    onChange();
  }

  function updateApplyBtn() {
    if (dirty) {
      applyBtn.textContent = 'Apply •';
      applyBtn.style.background = '#2e7d32';
      applyBtn.style.borderColor = '#4caf50';
    } else {
      applyBtn.textContent = 'Apply';
      applyBtn.style.background = '#2b2b2b';
      applyBtn.style.borderColor = '#444';
    }
  }
  updateApplyBtn();

  // горячая клавиша: H — скрыть/показать панель
  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
      root.style.display = (root.style.display === 'none') ? '' : 'none';
    }
  });

  return {
    el: root,
    apply() {
      inputs.forEach(({ input }, key) => { input.value = String(SceneLayout.config[key]); });
    },
    applyNow,
    get skipAnimation() { return skipAnimation; },
  };
}