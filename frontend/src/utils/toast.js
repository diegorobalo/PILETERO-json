let container = null;

function getContainer() {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div');
    container.style.cssText =
      'position:fixed;bottom:72px;left:0;right:0;display:flex;flex-direction:column-reverse;align-items:center;gap:8px;z-index:9999;pointer-events:none;padding:0 16px;';
    document.body.appendChild(container);
  }
  return container;
}

const BG = {
  success: '#15803d',
  error:   '#b91c1c',
  info:    '#1d4ed8',
  warning: '#b45309',
  offline: '#374151',
};

export function toast(message, type = 'success', duration = 3500) {
  const c = getContainer();
  const el = document.createElement('div');
  el.style.cssText =
    `background:${BG[type] || BG.info};color:#fff;padding:12px 18px;border-radius:12px;` +
    `font-size:14px;font-weight:500;max-width:340px;width:100%;text-align:center;` +
    `opacity:0;transform:translateY(10px);transition:opacity .2s,transform .2s;` +
    `pointer-events:auto;white-space:pre-line;`;
  el.textContent = message;
  c.appendChild(el);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }));

  const dismiss = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 220);
  };
  const timer = setTimeout(dismiss, duration);
  el.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
  return dismiss;
}

export const toastSuccess = (msg) => toast(msg, 'success');
export const toastError   = (msg) => toast(msg, 'error');
export const toastInfo    = (msg) => toast(msg, 'info');
export const toastWarn    = (msg) => toast(msg, 'warning');
export const toastOffline = (msg) => toast(msg, 'offline', 4500);
