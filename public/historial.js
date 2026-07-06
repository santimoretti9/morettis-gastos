const listEl = document.querySelector('#history-list');
const statusEl = document.querySelector('#history-status');
const historySummaryEl = document.querySelector('#history-summary');
const historySearchEl = document.querySelector('#history-search');
const historyPersonEl = document.querySelector('#history-person');
const historyMonthEl = document.querySelector('#history-month');
const historyOrderEl = document.querySelector('#history-order');
const receiptsListEl = document.querySelector('#receipts-list');
const receiptsStatusEl = document.querySelector('#receipts-status');
const tabButtons = Array.from(document.querySelectorAll('.history-tab'));
const sections = {
  gastos: document.querySelector('#gastos-panel'),
  comprobantes: document.querySelector('#comprobantes-panel'),
};
let historyItems = [];

tabButtons.forEach((button) => {
  button.addEventListener('click', () => activateTab(button.dataset.tab));
});
[historySearchEl, historyPersonEl, historyMonthEl, historyOrderEl].forEach((control) => control.addEventListener('input', renderHistory));

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
    historyItems = history;
    fillHistoryFilters(history);
    renderHistory();
  } catch (error) {
    statusEl.className = 'status error';
    statusEl.textContent = error.message;
  }
}

function fillHistoryFilters(history) {
  const people = [...new Set(history.map((item) => item.persona).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const months = [...new Set(history.map((item) => item.mesDestino).filter(Boolean))];
  historyPersonEl.innerHTML = '<option value="">Todas</option>' + people.map((person) => option(person, person)).join('');
  historyMonthEl.innerHTML = '<option value="">Todos</option>' + months.map((month) => option(month, month)).join('');
}

function renderHistory() {
  const query = normalizeText(historySearchEl.value);
  const person = historyPersonEl.value;
  const month = historyMonthEl.value;
  const order = historyOrderEl.value;
  let items = historyItems.filter((item) => {
    const searchable = normalizeText([item.concepto, item.categoria, item.persona, item.mesDestino, item.observaciones, item.mensaje].join(' '));
    return (!person || item.persona === person) && (!month || item.mesDestino === month) && (!query || searchable.includes(query));
  });
  items = sortItems(items, order);
  updateHistorySummary(items);
  if (!historyItems.length) {
    statusEl.textContent = 'Todavia no hay gastos registrados.';
    listEl.innerHTML = '';
    return;
  }
  if (!items.length) {
    statusEl.textContent = 'No hay gastos con ese filtro.';
    listEl.innerHTML = '';
    return;
  }
  statusEl.textContent = '';
  statusEl.className = 'status';
  listEl.innerHTML = items.map(renderExpenseItem).join('');
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

function sortItems(items, order) {
  return [...items].sort((a, b) => {
    if (order === 'oldest') return dateValue(a.fechaRecibido) - dateValue(b.fechaRecibido);
    if (order === 'amount_desc') return Number(b.importe || 0) - Number(a.importe || 0);
    if (order === 'amount_asc') return Number(a.importe || 0) - Number(b.importe || 0);
    return dateValue(b.fechaRecibido) - dateValue(a.fechaRecibido);
  });
}

function updateHistorySummary(items) {
  const total = items.reduce((sum, item) => sum + Number(item.importe || 0), 0);
  historySummaryEl.innerHTML = '<strong>' + items.length + '</strong><span> cargas</span><strong>' + formatAmount(total) + '</strong><span> total filtrado</span>';
}

function renderExpenseItem(item) {
  const date = item.fechaRecibido ? new Date(item.fechaRecibido).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha';
  const day = item.fechaRecibido ? new Date(item.fechaRecibido).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '--';
  return [
    '<article class="history-item">',
    '<div class="history-top"><div><span class="pill">' + escapeHtml(day) + '</span><h2>' + escapeHtml(item.concepto || 'Movimiento') + '</h2><p>' + escapeHtml(item.categoria || '') + '</p></div><strong>' + formatAmount(item.importe) + '</strong></div>',
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

function option(value, label) {
  return '<option value="' + escapeAttribute(value) + '">' + escapeHtml(label) + '</option>';
}

function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function dateValue(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
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
