const reportEl = document.querySelector('#market-report');
const statusEl = document.querySelector('#market-status');
const refreshButton = document.querySelector('#refresh-button');
const notifyButton = document.querySelector('#notify-button');
const LAST_REPORT_KEY = 'morettis:last-board-price-report';

refreshButton.addEventListener('click', () => loadReport({ manual: true }));
notifyButton.addEventListener('click', enableNotifications);

updateNotificationButton();
loadReport();
setInterval(() => loadReport({ silent: true }), 15 * 60 * 1000);

async function loadReport(options = {}) {
  try {
    if (!options.silent) {
      statusEl.className = 'status';
      statusEl.textContent = options.manual ? 'Actualizando reporte...' : 'Cargando reporte...';
    }
    const response = await fetch('/api/precio-pizarra?v=' + Date.now());
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'No se pudo cargar el reporte');
    renderReport(report);
    notifyIfNewReport(report, options);
    statusEl.className = 'status ok';
    statusEl.textContent = 'Reporte actualizado.';
  } catch (error) {
    statusEl.className = 'status error';
    statusEl.textContent = error.message;
  }
}

function renderReport(report) {
  const generated = report.generatedAt ? new Date(report.generatedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  const productCards = report.products.length ? report.products.map(renderProduct).join('') : '<div class="empty-state">No hay precios automaticos disponibles en este momento.</div>';
  reportEl.innerHTML = [
    '<div class="market-summary">',
    '<div><span>Fecha pizarra</span><strong>' + escapeHtml(report.dateLabel || '-') + '</strong></div>',
    '<div><span>Actualizado</span><strong>' + escapeHtml(generated) + '</strong></div>',
    '<p>' + escapeHtml(report.summary || '') + '</p>',
    '</div>',
    '<div class="market-grid">' + productCards + '</div>',
    '<section class="source-list"><h2>Fuentes</h2>' + report.sources.map(renderSource).join('') + '</section>'
  ].join('');
}

function renderProduct(item) {
  return [
    '<article class="market-card">',
    '<span class="pill">' + escapeHtml(item.source || 'Fuente') + '</span>',
    '<h2>' + escapeHtml(item.product || 'Grano') + '</h2>',
    '<dl>',
    '<div><dt>Pesos/Tn</dt><dd>' + escapeHtml(item.ars || '-') + '</dd></div>',
    '<div><dt>Dolar/Tn</dt><dd>' + escapeHtml(item.usd || '-') + '</dd></div>',
    '</dl>',
    '</article>'
  ].join('');
}

function renderSource(source) {
  const status = source.status === 'ok' ? 'ok' : source.status === 'error' ? 'error' : 'partial';
  return [
    '<article class="source-item ' + status + '">',
    '<div><strong>' + escapeHtml(source.name) + '</strong><p>' + escapeHtml(source.notes || '') + '</p></div>',
    '<a class="text-link" href="' + escapeAttribute(source.url) + '" target="_blank" rel="noopener">Abrir</a>',
    '</article>'
  ].join('');
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    statusEl.className = 'status error';
    statusEl.textContent = 'Este navegador no permite notificaciones.';
    return;
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    statusEl.className = 'status error';
    statusEl.textContent = 'Este navegador no permite push automatico. En iPhone, instala la web en inicio y abrila desde el icono.';
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    updateNotificationButton();
    statusEl.className = 'status error';
    statusEl.textContent = 'No se activaron las notificaciones.';
    return;
  }
  try {
    statusEl.className = 'status';
    statusEl.textContent = 'Registrando este celular...';
    const keyResponse = await fetch('/api/push-public-key');
    const keyData = await keyResponse.json();
    if (!keyData.enabled || !keyData.publicKey) throw new Error('Las notificaciones push no estan configuradas en el servidor.');
    const registration = await navigator.serviceWorker.register('/sw.js');
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
    const response = await fetch('/api/push-subscriptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription, userAgent: navigator.userAgent }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar este celular');
    updateNotificationButton();
    statusEl.className = 'status ok';
    statusEl.textContent = 'Listo: este celular queda suscripto para recibir Precio Pizarra a las 9 AM.';
  } catch (error) {
    statusEl.className = 'status error';
    statusEl.textContent = error.message;
  }
}

function updateNotificationButton() {
  if (!('Notification' in window)) {
    notifyButton.disabled = true;
    notifyButton.textContent = 'Sin notificaciones';
    return;
  }
  notifyButton.textContent = Notification.permission === 'granted' ? 'Notificaciones activas' : 'Activar notificaciones';
}

function notifyIfNewReport(report, options) {
  const reportKey = String(report.dateLabel || report.generatedAt || '').trim();
  if (!reportKey) return;
  const previous = localStorage.getItem(LAST_REPORT_KEY);
  localStorage.setItem(LAST_REPORT_KEY, reportKey);
  if (!previous || previous === reportKey || options.manual) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Nuevo Precio Pizarra', { body: 'Ya esta disponible el reporte ' + reportKey + '.', tag: 'morettis-precio-pizarra' });
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}
