import { createServer } from 'node:http';
import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT_DIR = typeof process === 'undefined' ? nodeRepl.cwd : process.cwd();
const PORT = Number((typeof process === 'undefined' ? undefined : process.env.PORT) || 4333);
const PUBLIC_DIR = join(ROOT_DIR, 'public');
const SHEET_NAME = 'Mensajes Gastos';
const MAIN_SHEET_NAME = 'Cash-25 Morettis (2)';
const RECEIPTS_SHEET_NAME = 'Comprobantes';
const RECEIPT_CHUNK_SIZE = 45000;

const MONTHS = [
  { label: 'Enero', month: 'ENE', column: 'I' },
  { label: 'Febrero', month: 'FEB', column: 'J' },
  { label: 'Marzo', month: 'MAR', column: 'K' },
  { label: 'Abril', month: 'ABR', column: 'L' },
  { label: 'Mayo', month: 'MAY', column: 'M' },
  { label: 'Junio', month: 'JUN', column: 'N' },
  { label: 'Julio', month: 'JUL', column: 'O' },
  { label: 'Agosto', month: 'AGO', column: 'P' },
  { label: 'Septiembre', month: 'SEP', column: 'Q' },
  { label: 'Octubre', month: 'OCT', column: 'R' },
  { label: 'Noviembre', month: 'NOV', column: 'S' },
  { label: 'Diciembre', month: 'DIC', column: 'T' },
];

const CONCEPTS = [
  { category: 'Ingresos', concept: 'Sdo Inicio', row: 6, type: 'INGRESOS' },
  { category: 'Ingresos', concept: 'Venta de Soja', row: 7, type: 'INGRESOS' },
  { category: 'Ingresos', concept: 'Venta de Maiz', row: 8, type: 'INGRESOS' },
  { category: 'Ingresos', concept: 'Alquiler Intendente Boasi', row: 9, type: 'INGRESOS' },
  { category: 'Ingresos', concept: 'Devolucion IVA', row: 10, type: 'INGRESOS' },
  { category: 'Ingresos', concept: 'Intereses Fondo Pionero', row: 11, type: 'INGRESOS' },
  { category: 'Sueldos', concept: 'GR', row: 16, type: 'EGRESOS' },
  { category: 'Sueldos', concept: 'Ap. y Contr', row: 17, type: 'EGRESOS' },
  { category: 'Sueldos', concept: 'Guada', row: 18, type: 'EGRESOS' },
  { category: 'Sueldos', concept: 'Santi', row: 19, type: 'EGRESOS' },
  { category: 'Impuestos', concept: 'I. Gcias - Bs Pers. (anticip)', row: 23, type: 'EGRESOS' },
  { category: 'Impuestos', concept: 'I. Gcias - Bs Pers. (DDJJ)', row: 24, type: 'EGRESOS' },
  { category: 'Impuestos', concept: 'IVA', row: 25, type: 'EGRESOS' },
  { category: 'Impuestos', concept: 'Autonomos', row: 26, type: 'EGRESOS' },
  { category: 'Impuestos', concept: 'Monotributo Lidin', row: 27, type: 'EGRESOS' },
  { category: 'Impuestos', concept: 'Monotributo Tucky', row: 28, type: 'EGRESOS' },
  { category: 'Impuestos', concept: 'Monotributo Guada', row: 29, type: 'EGRESOS' },
  { category: 'Impuestos', concept: 'Munic. Inmob.', row: 30, type: 'EGRESOS' },
  { category: 'Impuestos', concept: 'DGR Inmob.', row: 31, type: 'EGRESOS' },
  { category: 'Impuestos', concept: 'DGR Agrop.', row: 32, type: 'EGRESOS' },
  { category: 'Impuestos', concept: 'EMOS', row: 33, type: 'EGRESOS' },
  { category: 'Compra Venta de Granos', concept: 'Fletes', row: 37, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Administracion y contabilidad', concept: 'Sol', row: 40, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Administracion y contabilidad', concept: 'Estudio Cont.', row: 41, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Administracion y contabilidad', concept: 'Estudio Cont. DDJJ', row: 42, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Administracion y contabilidad', concept: 'Luz', row: 43, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Servicios e impuestos de inmuebles', concept: 'Telefonia', row: 44, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Vehiculos y maquinaria', concept: 'Seguro tractor', row: 45, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Bancos y cuentas', concept: 'Caja Seguridad', row: 46, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Bancos y cuentas', concept: 'Cta Cte: Macro', row: 47, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Bancos y cuentas', concept: 'CA Galicia', row: 48, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Bancos y cuentas', concept: 'CA BNA', row: 49, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Bancos y cuentas', concept: 'Imp Deb y Credito', row: 50, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Servicios e impuestos de inmuebles', concept: 'Ecogas - Int. Boasi', row: 51, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Servicios e impuestos de inmuebles', concept: 'EPEC - Int. Boasi', row: 52, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Servicios e impuestos de inmuebles', concept: 'EPEC -Sobremonte', row: 53, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Servicios e impuestos de inmuebles', concept: 'Ecogas-Sobremonte', row: 54, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Servicios e impuestos de inmuebles', concept: 'Alarma Sobremonte', row: 55, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Vehiculos y maquinaria', concept: 'GPS TRACTOR', row: 56, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Mantenimiento y reparaciones', concept: 'Reparaciones', row: 57, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Personales y otros', concept: 'Quini', row: 58, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Mantenimiento y reparaciones', concept: 'Jardinero Sobremonte', row: 59, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Mantenimiento y reparaciones', concept: 'Arreglos Sobremonte', row: 60, type: 'EGRESOS' },
  { category: 'Varios', subcategory: 'Personales y otros', concept: 'Varios La Florida', row: 61, type: 'EGRESOS' },
  { category: 'Socios y Retiros', concept: 'Prestamo Socio', row: 64, type: 'EGRESOS' },
  { category: 'Socios y Retiros', concept: 'Sociedad Debe LM', row: 65, type: 'EGRESOS' },
  { category: 'Socios y Retiros', concept: 'Retiro Socio - LM', row: 66, type: 'EGRESOS' },
  { category: 'Socios y Retiros', concept: 'Retiro Socia- GM', row: 67, type: 'EGRESOS' },
  { category: 'Socios y Retiros', concept: 'Retiro Socio - TM', row: 68, type: 'EGRESOS' },
];

const fileEnv = await readEnv(join(ROOT_DIR, '.env'));
const runtimeEnv = typeof process === 'undefined' ? {} : process.env;
const env = { ...fileEnv, ...runtimeEnv };
const credentialsPath = env.GOOGLE_APPLICATION_CREDENTIALS;
const serviceAccountJson = env.GOOGLE_SERVICE_ACCOUNT_JSON;
const spreadsheetId = env.GOOGLE_SHEET_ID;
const accessCode = env.APP_ACCESS_CODE || '';

if ((!credentialsPath && !serviceAccountJson) || !spreadsheetId) { console.error('Faltan credenciales de Google o GOOGLE_SHEET_ID'); throw new Error('Configuracion incompleta'); }

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://' + req.headers.host);
    if (req.method === 'GET' && url.pathname === '/api/catalogo') return sendJson(res, 200, { months: MONTHS, concepts: CONCEPTS });
    if (req.method === 'GET' && url.pathname === '/api/pendientes') return sendJson(res, 200, await listPendingExpenses());
    if (req.method === 'GET' && url.pathname === '/api/historial') return sendJson(res, 200, await listHistory());
    if (req.method === 'POST' && url.pathname === '/api/aprobar') return sendJson(res, 200, await approveExpense(await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/gastos') return sendJson(res, 201, await createExpense(await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/comprobantes') return sendJson(res, 201, await createReceipt(await readJson(req))); 
    if (req.method === 'GET' && url.pathname === '/api/config') return sendJson(res, 200, { accessCodeRequired: Boolean(accessCode) });
    if (req.method === 'GET') return serveStatic(res, url.pathname);
    sendJson(res, 404, { error: 'No encontrado' });
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'No se pudo guardar el gasto' });
  }
}).listen(PORT, () => console.log('Mini web lista en http://localhost:' + PORT));

async function createExpense(body) {
  validateAccessCode(body.codigo_acceso);
  const amount = parseAmount(body.importe);
  const month = MONTHS.find((item) => item.column === String(body.mes_columna || '').trim());
  const category = String(body.categoria || '').trim();
  const selectedSubcategory = String(body.subcategoria || '').trim();
  const concept = CONCEPTS.find((item) => item.concept === String(body.concepto || '').trim());

  if (!amount || amount <= 0) throw validationError('Importe invalido');
  if (!month) throw validationError('Mes requerido');
  if (!category) throw validationError('Categoria requerida');
  if (!selectedSubcategory) throw validationError('Subcategoria requerida');
  if (!concept) throw validationError('Concepto requerido');

  const subcategory = concept.subcategory || concept.category;
  if (concept.category !== category || subcategory !== selectedSubcategory) throw validationError('La categoria no coincide con el gasto seleccionado');

  const id = 'MSG-' + Date.now();
  const now = new Date().toISOString();
  const targetRange = "'" + MAIN_SHEET_NAME + "'!" + month.column + concept.row;
  const currentRows = await getValues(targetRange, 'UNFORMATTED_VALUE');
  const previousValue = currentRows?.[0]?.[0] ?? '';
  await updateValues(targetRange, [[amount]]);

  const message = 'Carga web directa | ' + concept.type + ' > ' + concept.category + ' > ' + subcategory + ' > ' + concept.concept + ' | ' + month.label;
  await appendValues("'" + SHEET_NAME + "'!A1:R", [[
    id,
    now,
    'Carga web',
    '',
    message,
    '',
    '',
    '',
    amount,
    concept.concept,
    concept.category + ' / ' + subcategory,
    concept.row,
    month.month,
    month.column,
    'alta',
    'cargado',
    'Carga directa en ' + MAIN_SHEET_NAME + '!' + month.column + concept.row + '. Valor anterior: ' + previousValue,
    now,
  ]]);

  return {
    id,
    estado: 'cargado',
    importe: amount,
    mes: month,
    categoria: concept.category,
    subcategoria: subcategory,
    concepto: concept.concept,
    filaDestino: concept.row,
    destino: MAIN_SHEET_NAME + '!' + month.column + concept.row,
    valorAnterior: previousValue,
    valorNuevo: amount,
  };
}

function validationError(message) { const error = new Error(message); error.statusCode = 400; return error; }
function validateAccessCode(code) { if (accessCode && String(code || '') !== accessCode) throw validationError('Codigo de acceso incorrecto'); }

async function listHistory() {
  const rows = await getValues("'" + SHEET_NAME + "'!A2:R");
  return rows
    .map((row, index) => expenseFromRow(row, index + 2))
    .filter((expense) => expense.id)
    .reverse()
    .slice(0, 50);
}

async function createReceipt(body) {
  validateAccessCode(body.codigo_acceso);
  const person = String(body.persona || '').trim();
  const description = String(body.descripcion || '').trim();
  const fileName = String(body.archivo_nombre || '').trim();
  const fileType = String(body.archivo_tipo || '').trim();
  const fileSize = Number(body.archivo_tamano || 0);
  const fileBase64 = String(body.archivo_base64 || '').trim();
  const amount = parseAmount(body.importe);

  if (!person) throw validationError('Persona requerida');
  if (!fileName || !fileBase64) throw validationError('Falta el archivo del comprobante');
  if (fileSize > 1500000 || fileBase64.length > 2100000) throw validationError('El archivo es muy grande');

  await ensureReceiptsSheet();
  const id = 'COMP-' + Date.now();
  const now = new Date().toISOString();
  const chunks = chunkText(fileBase64, RECEIPT_CHUNK_SIZE);
  await appendValues("'" + RECEIPTS_SHEET_NAME + "'!A1:Z", [[
    id,
    now,
    person,
    amount || '',
    description,
    fileName,
    fileType,
    fileSize || '',
    chunks.length,
    ...chunks,
  ]]);

  return { id, estado: 'guardado', archivo: fileName, partes: chunks.length };
}

async function listPendingExpenses() {
  const rows = await getValues("'" + SHEET_NAME + "'!A2:R");
  return rows
    .map((row, index) => expenseFromRow(row, index + 2))
    .filter((expense) => expense.estado === 'pendiente');
}

async function approveExpense(body) {
  const id = String(body.id || '').trim();
  if (!id) throw validationError('Falta el id del gasto');

  const rows = await getValues("'" + SHEET_NAME + "'!A2:R");
  const foundIndex = rows.findIndex((row) => row[0] === id);
  if (foundIndex === -1) throw validationError('No encontre el gasto pendiente');

  const rowNumber = foundIndex + 2;
  const expense = expenseFromRow(rows[foundIndex], rowNumber);
  if (expense.estado !== 'pendiente') throw validationError('Ese gasto ya no esta pendiente');
  if (!expense.filaDestino || !expense.columnaDestino) throw validationError('El gasto no tiene destino sugerido');

  const targetRange = "'" + MAIN_SHEET_NAME + "'!" + expense.columnaDestino + expense.filaDestino;
  const currentRows = await getValues(targetRange, 'UNFORMATTED_VALUE');
  const currentValue = parseAmount(currentRows?.[0]?.[0] ?? 0);
  const newValue = currentValue + expense.importe;

  await updateValues(targetRange, [[newValue]]);
  await updateValues("'" + SHEET_NAME + "'!P" + rowNumber + ':R' + rowNumber, [['cargado', 'Aprobado y cargado en ' + MAIN_SHEET_NAME + '!' + expense.columnaDestino + expense.filaDestino, new Date().toISOString()]]);

  return {
    id,
    estado: 'cargado',
    destino: MAIN_SHEET_NAME + '!' + expense.columnaDestino + expense.filaDestino,
    valorAnterior: currentValue,
    importeSumado: expense.importe,
    valorNuevo: newValue,
  };
}

function expenseFromRow(row, rowNumber) {
  return {
    rowNumber,
    id: row[0] || '',
    fechaRecibido: row[1] || '',
    persona: row[2] || '',
    mensaje: row[4] || '',
    importe: parseAmount(row[8]),
    concepto: row[9] || '',
    categoria: row[10] || '',
    filaDestino: Number(row[11] || 0),
    mesDestino: row[12] || '',
    columnaDestino: row[13] || '',
    confianza: row[14] || '',
    estado: row[15] || '',
    observaciones: row[16] || '',
    fechaRevision: row[17] || '',
  };
}

async function ensureReceiptsSheet() {
  const header = ['id', 'fecha', 'persona', 'importe', 'descripcion', 'archivo_nombre', 'archivo_tipo', 'archivo_tamano', 'partes', 'archivo_base64_partes'];
  try {
    const rows = await getValues("'" + RECEIPTS_SHEET_NAME + "'!A1:J1");
    if (rows.length) return;
  } catch (error) {
    await batchUpdate({ requests: [{ addSheet: { properties: { title: RECEIPTS_SHEET_NAME } } }] });
  }
  await updateValues("'" + RECEIPTS_SHEET_NAME + "'!A1:J1", [header]);
}

async function batchUpdate(payload) {
  const accessToken = await getAccessToken();
  const url = new URL('https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId + ':batchUpdate');
  const response = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer ' + accessToken, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function appendValues(range, values) {
  const accessToken = await getAccessToken();
  const url = new URL('https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId + '/values/' + encodeURIComponent(range) + ':append');
  url.searchParams.set('valueInputOption', 'USER_ENTERED');
  url.searchParams.set('insertDataOption', 'INSERT_ROWS');
  const response = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer ' + accessToken, 'content-type': 'application/json' }, body: JSON.stringify({ values }) });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function getValues(range, valueRenderOption = 'FORMATTED_VALUE') {
  const accessToken = await getAccessToken();
  const url = new URL('https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId + '/values/' + encodeURIComponent(range));
  url.searchParams.set('valueRenderOption', valueRenderOption);
  const response = await fetch(url, { headers: { authorization: 'Bearer ' + accessToken } });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data.values || [];
}

async function updateValues(range, values) {
  const accessToken = await getAccessToken();
  const url = new URL('https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId + '/values/' + encodeURIComponent(range));
  url.searchParams.set('valueInputOption', 'USER_ENTERED');
  const response = await fetch(url, {
    method: 'PUT',
    headers: { authorization: 'Bearer ' + accessToken, 'content-type': 'application/json' },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function getAccessToken() {
  const key = serviceAccountJson ? JSON.parse(serviceAccountJson) : JSON.parse(await readFile(credentialsPath, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now }));
  const unsigned = header + '.' + claim;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned); signer.end();
  const assertion = unsigned + '.' + signer.sign(key.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
}

async function serveStatic(res, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = normalize(join(PUBLIC_DIR, requestedPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'No permitido' });
  try { const content = await readFile(filePath); res.writeHead(200, { 'content-type': contentType(filePath) }); res.end(content); } catch { sendJson(res, 404, { error: 'No encontrado' }); }
}

function contentType(filePath) { return { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }[extname(filePath)] || 'application/octet-stream'; }
async function readJson(req) { let body = ''; for await (const chunk of req) body += chunk; return JSON.parse(body || '{}'); }
async function readEnv(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    return Object.fromEntries(content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)]; }));
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}
function parseAmount(value) { const raw = String(value || '').trim().replace(/[$\s]/g, ''); const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw; const parsed = Number(normalized); return Number.isFinite(parsed) ? parsed : 0; }
function chunkText(value, size) { const chunks = []; for (let index = 0; index < value.length; index += size) chunks.push(value.slice(index, index + size)); return chunks; }
function sendJson(res, statusCode, payload) { res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); }
function base64url(value) { return Buffer.from(value).toString('base64url'); }
