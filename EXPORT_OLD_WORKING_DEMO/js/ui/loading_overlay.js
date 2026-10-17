export function showLoadingOverlay(text = '') {
  const el = document.createElement('div');
  el.className = 'loading-overlay';
  el.innerHTML = `
    <div class="loading-spinner"></div>
    ${text ? `<div class="loading-text">${text}</div>` : ''}
  `;
  document.body.appendChild(el);
  return el;
}

export function hideLoadingOverlay(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

/**
 * Показывает лоадер + синхронно выполняет buildFn, но снимает лоадер
 * не раньше, чем через minMs миллисекунд (чтобы не мигало).
 */
export async function withLoading(buildFn, { text = '', minMs = 2000 } = {}) {
  const el = showLoadingOverlay(text);
  // даём браузеру отрисовать лоадер
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    buildFn();
  } catch (e) {
    console.error('[loading] build failed:', e);
  }

  const t0 = performance.now();
  await new Promise(resolve => {
    const tick = () => {
      if (performance.now() - t0 >= minMs) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });

  hideLoadingOverlay(el);
}