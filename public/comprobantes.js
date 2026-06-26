const form = document.querySelector('#receipt-form');
const statusEl = document.querySelector('#receipt-status');
const previewEl = document.querySelector('#receipt-preview');
const button = document.querySelector('#receipt-submit-button');
const fileInput = document.querySelector('#archivo');

init();

async function init() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    const field = document.querySelector('#receipt-access-code-field');
    const input = document.querySelector('#codigo_acceso');
    if (config.accessCodeRequired) {
      field.hidden = false;
      input.required = true;
    }
  } catch {
    statusEl.className = 'status error';
    statusEl.textContent = 'No se pudo cargar la configuracion.';
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  previewEl.textContent = file ? file.name + ' - ' + formatBytes(file.size) : 'El archivo queda registrado en la hoja Comprobantes.';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusEl.className = 'status';
  statusEl.textContent = 'Guardando comprobante...';
  button.disabled = true;
  try {
    const file = fileInput.files?.[0];
    if (!file) throw new Error('Falta adjuntar el comprobante');
    if (file.size > 1500000) throw new Error('El archivo es muy grande. Usa una foto mas liviana o un PDF menor a 1,5 MB.');
    const payload = Object.fromEntries(new FormData(form));
    payload.archivo_nombre = file.name;
    payload.archivo_tipo = file.type || 'application/octet-stream';
    payload.archivo_tamano = file.size;
    payload.archivo_base64 = await fileToBase64(file);
    const response = await fetch('/api/comprobantes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar');
    statusEl.className = 'status ok';
    statusEl.textContent = 'Comprobante guardado (' + result.id + ').';
    form.reset();
    previewEl.textContent = 'El archivo queda registrado en la hoja Comprobantes.';
  } catch (error) {
    statusEl.className = 'status error';
    statusEl.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
