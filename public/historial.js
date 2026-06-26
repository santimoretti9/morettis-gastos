const listEl = document.querySelector('#history-list');
const statusEl = document.querySelector('#history-status');

loadHistory();

async function loadHistory() {
  try {
    const response = await fetch('/api/historial');
    const history = await response.json();
    if (!response.ok) throw new Error(history.error || 'No se pudo cargar el historial');
    if (!history.length) {
      statusEl.textContent = 'Todavia no hay cargas registradas.';
      return;
    }
    statusEl.textContent = '';
    listEl.innerHTML = history.map(renderItem).join('');
  } catch (error) {
    statusEl.className = 'status error';
    statusEl.textContent = error.message;
  }
}

function renderItem(item) {
  const date = item.fechaRecibido ? new Date(item.fechaRecibido).toLocaleString('es-AR') : 'Sin fecha';
  return [
    '<article class="history-item">',
    '<div class="history-top"><div><span class="pill">' + escapeHtml(item.estado || 'sin estado') + '</span><h2>' + escapeHtml(item.concepto || 'Movimiento') + '</h2><p>' + escapeHtml(item.categoria || '') + '</p></div><strong>' + formatAmount(item.importe) + '</strong></div>',
    '<dl><div><dt>Fecha</dt><dd>' + escapeHtml(date) + '</dd></div><div><dt>Mes</dt><dd>' + escapeHtml(item.mesDestino || '-') + '</dd></div><div><dt>Destino</dt><dd>' + escapeHtml(item.columnaDestino || '-') + escapeHtml(item.filaDestino || '') + '</dd></div></dl>',
    '<p class="muted">' + escapeHtml(item.observaciones || item.mensaje || '') + '</p>',
    '</article>'
  ].join('');
}

function formatAmount(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
