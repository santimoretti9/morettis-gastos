const listEl = document.querySelector('#history-list');
const statusEl = document.querySelector('#history-status');
const receiptsListEl = document.querySelector('#receipts-list');
const receiptsStatusEl = document.querySelector('#receipts-status');
const tabButtons = Array.from(document.querySelectorAll('.history-tab'));
const sections = {
  gastos: document.querySelector('#gastos-panel'),
  comprobantes: document.querySelector('#comprobantes-panel'),
};

tabButtons.forEach((button) => {
  button.addEventListener('click', () => activateTab(button.dataset.tab));
});

loadHistory();
loadReceipts();

function activateTab(tab) {
  tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  Object.entries(sections).forEach(([key, section]) => section.classList.toggle('active', key === tab));
}

async function loadHistory() {
  try {
    const response = await fetch('/api/historial');
    const history = await response.json();
    if (!response.ok) throw new Error(history.error || 'No se pudo cargar el historial');
    if (!history.length) {
      statusEl.textContent = 'Todavia no hay gastos registrados.';
      return;
    }
    statusEl.textContent = '';
    listEl.innerHTML = history.map(renderExpenseItem).join('');
  } catch (error) {
    statusEl.className = 'status error';
    statusEl.textContent = error.message;
  }
}

async function loadReceipts() {
  try {
    const response = await fetch('/api/historial-comprobantes');
    const receipts = await response.json();
    if (!response.ok) throw new Error(receipts.error || 'No se pudo cargar el historial de comprobantes');
    if (!receipts.length) {
      receiptsStatusEl.textContent = 'Todavia no hay comprobantes cargados.';
      return;
    }
    receiptsStatusEl.textContent = '';
    receiptsListEl.innerHTML = receipts.map(renderReceiptItem).join('');
  } catch (error) {
    receiptsStatusEl.className = 'status error';
    receiptsStatusEl.textContent = error.message;
  }
}

function renderExpenseItem(item) {
  const date = item.fechaRecibido ? new Date(item.fechaRecibido).toLocaleString('es-AR') : 'Sin fecha';
  return [
    '<article class="history-item">',
    '<div class="history-top"><div><span class="pill">' + escapeHtml(item.estado || 'sin estado') + '</span><h2>' + escapeHtml(item.concepto || 'Movimiento') + '</h2><p>' + escapeHtml(item.categoria || '') + '</p></div><strong>' + formatAmount(item.importe) + '</strong></div>',
    '<dl><div><dt>Persona</dt><dd>' + escapeHtml(item.persona || '-') + '</dd></div><div><dt>Fecha</dt><dd>' + escapeHtml(date) + '</dd></div><div><dt>Mes</dt><dd>' + escapeHtml(item.mesDestino || '-') + '</dd></div><div><dt>Destino</dt><dd>' + escapeHtml(item.columnaDestino || '-') + escapeHtml(item.filaDestino || '') + '</dd></div></dl>',
    '<p class="muted">' + escapeHtml(item.observaciones || item.mensaje || '') + '</p>',
    '</article>'
  ].join('');
}

function renderReceiptItem(item) {
  const date = item.fecha ? new Date(item.fecha).toLocaleString('es-AR') : 'Sin fecha';
  const isImage = String(item.archivoTipo || '').startsWith('image/');
  const preview = isImage && item.archivoUrl ? '<a class="receipt-preview-link" href="' + escapeAttribute(item.archivoUrl) + '" target="_blank" rel="noopener"><img src="' + escapeAttribute(item.archivoUrl) + '" alt="Comprobante ' + escapeAttribute(item.archivoNombre || '') + '"></a>' : '';
  return [
    '<article class="history-item receipt-item">',
    '<div class="history-top"><div><span class="pill">comprobante</span><h2>' + escapeHtml(item.descripcion || item.archivoNombre || 'Comprobante') + '</h2><p>' + escapeHtml(item.archivoNombre || '') + '</p></div><strong>' + (item.importe ? formatAmount(item.importe) : '-') + '</strong></div>',
    preview,
    '<dl><div><dt>Persona</dt><dd>' + escapeHtml(item.persona || '-') + '</dd></div><div><dt>Fecha</dt><dd>' + escapeHtml(date) + '</dd></div><div><dt>Tamano</dt><dd>' + escapeHtml(formatBytes(item.archivoTamano || 0)) + '</dd></div></dl>',
    item.archivoUrl ? '<a class="file-button" href="' + escapeAttribute(item.archivoUrl) + '" target="_blank" rel="noopener">Ver comprobante</a>' : '',
    '</article>'
  ].join('');
}

function formatAmount(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatBytes(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
