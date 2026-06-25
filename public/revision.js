const listEl = document.querySelector('#pending-list');
const statusEl = document.querySelector('#status');
loadPending();
async function loadPending() {
  statusEl.className = 'status review-status';
  statusEl.textContent = 'Buscando gastos pendientes...';
  try {
    const response = await fetch('/api/pendientes');
    const items = await response.json();
    if (!response.ok) throw new Error(items.error || 'No se pudieron cargar los pendientes');
    renderPending(items);
    statusEl.textContent = items.length ? '' : 'No hay gastos pendientes.';
  } catch (error) {
    statusEl.className = 'status review-status error';
    statusEl.textContent = error.message;
  }
}
function renderPending(items) {
  if (!items.length) { listEl.innerHTML = ''; return; }
  listEl.innerHTML = items.map(renderItem).join('');
  listEl.querySelectorAll('[data-approve]').forEach((button) => { button.addEventListener('click', () => approve(button.dataset.approve, button)); });
}
function renderItem(item) {
  return '<article class="pending-item" data-id="' + escapeHtml(item.id) + '">' +
    '<div class="pending-main"><div><span class="pending-label">' + escapeHtml(item.categoria) + '</span><h2>' + escapeHtml(item.concepto) + '</h2></div><strong>$ ' + formatMoney(item.importe) + '</strong></div>' +
    '<dl><div><dt>Destino</dt><dd>Cash-25 Morettis (2)!' + escapeHtml(item.columnaDestino) + escapeHtml(item.filaDestino) + '</dd></div><div><dt>Mes</dt><dd>' + escapeHtml(item.mesDestino) + '</dd></div><div><dt>Confianza</dt><dd>' + escapeHtml(item.confianza) + '</dd></div></dl>' +
    '<p>' + escapeHtml(item.mensaje) + '</p>' +
    '<button type="button" data-approve="' + escapeHtml(item.id) + '">Aprobar y cargar</button>' +
  '</article>';
}
async function approve(id, button) {
  button.disabled = true;
  statusEl.className = 'status review-status';
  statusEl.textContent = 'Cargando gasto en la proyeccion...';
  try {
    const response = await fetch('/api/aprobar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo aprobar');
    statusEl.className = 'status review-status ok';
    statusEl.textContent = 'Cargado en ' + result.destino + '. Nuevo valor: $ ' + formatMoney(result.valorNuevo) + '.';
    await loadPending();
  } catch (error) {
    statusEl.className = 'status review-status error';
    statusEl.textContent = error.message;
    button.disabled = false;
  }
}
function formatMoney(value) { return Number(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 }); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
