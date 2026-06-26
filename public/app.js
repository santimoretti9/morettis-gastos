const form = document.querySelector('#expense-form');
const statusEl = document.querySelector('#status');
const previewEl = document.querySelector('#preview');
const button = document.querySelector('#submit-button');
const monthSelect = document.querySelector('#mes_columna');
const categorySelect = document.querySelector('#categoria');
const subcategorySelect = document.querySelector('#subcategoria');
const conceptSelect = document.querySelector('#concepto');
let catalog = { months: [], concepts: [] };
init();
async function init() {
  try {
    await loadConfig();
    const response = await fetch('/api/catalogo');
    catalog = await response.json();
    fillMonths(); fillCategories(); fillSubcategories(); fillConcepts(); updatePreview();
  } catch (error) {
    statusEl.className = 'status error';
    statusEl.textContent = 'No se pudo cargar el catalogo de gastos.';
  }
}
async function loadConfig() {
  const response = await fetch('/api/config');
  const config = await response.json();
  const field = document.querySelector('#access-code-field');
  const input = document.querySelector('#codigo_acceso');
  if (config.accessCodeRequired) {
    field.hidden = false;
    input.required = true;
  }
}
function option(value, label) { return '<option value="' + escapeHtml(value) + '">' + escapeHtml(label) + '</option>'; }
function fillMonths() { monthSelect.innerHTML = option('', 'Seleccionar mes') + catalog.months.map((month) => option(month.column, month.label)).join(''); }
function fillCategories() { const categories = [...new Set(catalog.concepts.map((item) => item.category))]; categorySelect.innerHTML = option('', 'Seleccionar categoria') + categories.map((category) => option(category, category)).join(''); }
function fillSubcategories() { const category = categorySelect.value; const subcategories = [...new Set(catalog.concepts.filter((item) => item.category === category).map((item) => item.subcategory || item.category))]; subcategorySelect.innerHTML = option('', 'Seleccionar subcategoria') + subcategories.map((subcategory) => option(subcategory, subcategory)).join(''); }
function fillConcepts() { const category = categorySelect.value; const subcategory = subcategorySelect.value; const concepts = catalog.concepts.filter((item) => item.category === category && (item.subcategory || item.category) === subcategory); conceptSelect.innerHTML = option('', 'Seleccionar gasto') + concepts.map((item) => option(item.concept, item.concept)).join(''); updatePreview(); }
function updatePreview() {
  const month = catalog.months.find((item) => item.column === monthSelect.value);
  const concept = catalog.concepts.find((item) => item.concept === conceptSelect.value);
  if (!month || !concept) { previewEl.textContent = 'Selecciona los datos para ver el destino antes de enviar.'; return; }
  const subcategory = concept.subcategory || concept.category;
  previewEl.textContent = 'Destino sugerido: ' + concept.category + ' > ' + subcategory + ' > ' + concept.concept + ', fila ' + concept.row + ', ' + month.label + '.';
}
categorySelect.addEventListener('change', () => { fillSubcategories(); fillConcepts(); });
subcategorySelect.addEventListener('change', fillConcepts);
monthSelect.addEventListener('change', updatePreview);
conceptSelect.addEventListener('change', updatePreview);
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusEl.className = 'status'; statusEl.textContent = 'Guardando gasto...'; button.disabled = true;
  const data = Object.fromEntries(new FormData(form));
  try {
    const response = await fetch('/api/gastos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar');
    statusEl.className = 'status ok';
    statusEl.textContent = 'Gasto cargado directo en ' + result.destino + ' (' + result.id + ').';
    form.reset(); fillSubcategories(); fillConcepts(); document.querySelector('#importe').focus();
  } catch (error) { statusEl.className = 'status error'; statusEl.textContent = error.message; }
  finally { button.disabled = false; }
});
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
