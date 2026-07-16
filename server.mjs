import { createServer } from 'node:http';
import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import webPush from 'web-push';

const ROOT_DIR = typeof process === 'undefined' ? nodeRepl.cwd : process.cwd();
const PORT = Number((typeof process === 'undefined' ? undefined : process.env.PORT) || 4333);
const PUBLIC_DIR = join(ROOT_DIR, 'public');
const SHEET_NAME = 'Mensajes Gastos';
const MAIN_SHEET_NAME = 'Cash-25 Morettis (2)';
const RECEIPTS_SHEET_NAME = 'Comprobantes';
const PUSH_SHEET_NAME = 'Push Suscripciones';
const PUSH_SENDS_SHEET_NAME = 'Push Envios';
const RECEIPT_CHUNK_SIZE = 45000;
const BOARD_PRICE_SOURCES = [
  { id: 'bcr', name: 'BCR - Camara Arbitral de Cereales', url: 'https://www.cac.bcr.com.ar/es/precios-de-pizarra' },
  { id: 'matba', name: 'Matba Rofex / FyO', url: 'https://matbarofex.primary.ventures/fyo/futurosagropecuarios' },
  { id: 'acabase', name: 'ACA Base', url: 'https://www.acabase.com.ar/' },
];
const LAST_KNOWN_BOARD_PRICE = {
  dateLabel: '07/07/2026',
  notes: 'Ultima pizarra disponible guardada como respaldo. Se reemplaza automaticamente cuando BCR publica y responde con datos nuevos.',
  products: [
    { product: 'Trigo', ars: '$292.000,00', usd: 'US$ 196,90', source: 'BCR' },
    { product: 'Maiz', ars: '$269.900,00', usd: 'US$ 182,00', source: 'BCR' },
    { product: 'Girasol', ars: 'S/C (E) $667.350,00', usd: 'US$ (E) 450,00', source: 'BCR' },
    { product: 'Soja', ars: '$480.500,00', usd: 'US$ 324,01', source: 'BCR' },
    { product: 'Sorgo', ars: '$274.000,00', usd: 'US$ 184,76', source: 'BCR' },
  ],
};
const APPLE_TOUCH_ICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAAA9zQYyAAAEDUlEQVR4nO3SS3IUMRBFUXbBvtgG+x/DiAEf29iWKjNfHkWcabf06n75+v3bD0jxpfoCcJKgiSJoogiaKIImiqCJImiiCJoogiaKoIkiaKIImiiCJoqgiSJoogiaKIImiqCJImiiCJoogiaKoIkiaKIImiiCJoqgiSJoogiaKIImiqCJImiiCJoogiaKoIkiaKIImiiCJoqgiSJoogiaKIImyqig/3Wq75Ro8s4jgv6fU33HBAk7tw76I6f6zhMl7SxoonZuG/RnTvXdJ0nbOTLormN3k7hxy6BPnep3dJa6cXTQHQfvIHlfQS+UvG980B1Ht+09K4LuOLxd71gTdMfxbXreqqA7fgB7nrUu6I4fwZbnCDrcti1XBt3xQ9hR0HEfw4aCjvsg9hN03EexnaCjPortBB33Yewm6LiPYzNBx30gewk67iPZStCfPtUb2EnQR0/1BnYS9PFTvYONBH38VG9hH0EfP9V72EbQx0/1JnYR9NFTvYldBH382OTvU92KoD957PH7qW5lTdA3Q5i2xUtvOPU7nUQHPT3q23c/+VtdxAc9Neon7nz69zoQ9KH/6LjBW3c+/XsdrAh6WtRP3fXGb1ZbE/SUqJ+8463fFfSDQ986Xd79nrvd/G1BPzj0rVP95vfe6fbvC/rBoW+c6je/9z5P/IegBwf9P//b6S5P/IegHxz61pkQs6ADg04I6qP/LejQoKvCqvjP6p0F/eDQt071f3XbWdAPDX3rVP9Xt50F/eDQt07HmAW9IOjbwd387Wk7C/rBoSed6ndWtyLooKg7vLG6FUGHRN3lfdWtCFrQ7XYW9INDdzyd3lbdiqCHR93tXdWtCHpw1B3fVN2KoIdG3fU91a0IWtDtdxb0g0NXnM5vqW5F0E3ul/KO6lYE3eiOCW+obkXQze45/f7VrQi64V0n3726FUE3vOvku1e3Iuim95167+pWBO3Oo+/8FkE3ufe0+1be+zWCbnD3SXftcveXCLrB3SfdtcvdXyLowjdMuGP3N/xJ0AVvqb5T4s6/CHqxxJ0FvVjizoJeLHFnQS+WuLOgF0vcWdCLJe4s6MUSdxb0Yok7C3qxxJ0FvVjizoJeLHFnQS+WuLOgF0vcWdCLJe4s6MUSdxb0Yok7C3qxxJ0FvVjizoJeLHHnlkF/duzqu0+StrOgl0vbuW3QHx27+s4TJe0saKJ2bh30ewavvmOChJ1HBP3a4NV3SjR551FBw1sETRRBE0XQRBE0UQRNFEETRdBEETRRBE0UQRNF0EQRNFEETRRBE0XQRBE0UQRNFEETRdBEETRRBE0UQRNF0EQRNFEETRRBE0XQRBE0UQRNFEETRdBEETRRBE0UQRNF0EQRNFEETRRBE0XQRBE0UX4CRHb9zg8IOwEAAAAASUVORK5CYII=';
const FAVICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAeklEQVR4nO3VMQ6AIAyFYW7hvbyG9591MmEQ258WkeSRdKKv+UIHynbs58wqAgggwK8B9ekZ7sm7ARThza4F8CJIDgMsBM10AVoDaT8CWHt9uksHvA0lvWkA62WGAMiuhwFaCJIPAzLuw4C7J5Jf5zMSYArgixJAAAEuotyqa3EwLzIAAAAASUVORK5CYII=';

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
const accessUsers = parseAccessUsers(env.APP_ACCESS_USERS || '');
const vapidPublicKey = env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = env.VAPID_PRIVATE_KEY || '';
const vapidSubject = env.VAPID_SUBJECT || 'mailto:notificaciones@morettis.local';

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

if ((!credentialsPath && !serviceAccountJson) || !spreadsheetId) { console.error('Faltan credenciales de Google o GOOGLE_SHEET_ID'); throw new Error('Configuracion incompleta'); }

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://' + req.headers.host);
    if (req.method === 'GET' && url.pathname === '/apple-touch-icon.png') return sendBase64File(res, 'image/png', APPLE_TOUCH_ICON_BASE64);
    if (req.method === 'GET' && url.pathname === '/favicon.png') return sendBase64File(res, 'image/png', FAVICON_BASE64);
    if (req.method === 'GET' && url.pathname === '/site.webmanifest') return sendJson(res, 200, siteManifest());
    if (req.method === 'GET' && url.pathname === '/api/catalogo') return sendJson(res, 200, { months: MONTHS, concepts: CONCEPTS });
    if (req.method === 'GET' && url.pathname === '/api/pendientes') return sendJson(res, 200, await listPendingExpenses());
    if (req.method === 'GET' && url.pathname === '/api/historial') return sendJson(res, 200, await listHistory());
    if (req.method === 'GET' && url.pathname === '/api/historial-comprobantes') return sendJson(res, 200, await listReceiptHistory());
    if (req.method === 'GET' && url.pathname === '/api/precio-pizarra') return sendJson(res, 200, await getBoardPriceReport());
    if (req.method === 'GET' && url.pathname === '/api/push-public-key') return sendJson(res, 200, { publicKey: vapidPublicKey, enabled: Boolean(vapidPublicKey && vapidPrivateKey) });
    if (req.method === 'GET' && url.pathname === '/api/comprobantes/archivo') return sendReceiptFile(res, url.searchParams.get('id'));
    if (req.method === 'POST' && url.pathname === '/api/aprobar') return sendJson(res, 200, await approveExpense(await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/gastos') return sendJson(res, 201, await createExpense(await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/comprobantes') return sendJson(res, 201, await createReceipt(await readJson(req))); 
    if (req.method === 'POST' && url.pathname === '/api/push-subscriptions') return sendJson(res, 201, await savePushSubscription(await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/push-test') return sendJson(res, 200, await sendBoardPricePush({ force: true }));
    if (req.method === 'POST' && url.pathname === '/api/push-diario') return sendJson(res, 200, await sendBoardPricePush({ daily: true }));
    if (req.method === 'GET' && url.pathname === '/api/config') return sendJson(res, 200, { accessCodeRequired: Boolean(accessCode || accessUsers.length), userCodesEnabled: Boolean(accessUsers.length) });
    if (req.method === 'GET') return serveStatic(res, url.pathname);
    sendJson(res, 404, { error: 'No encontrado' });
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'No se pudo guardar el gasto' });
  }
}).listen(PORT, () => console.log('Mini web lista en http://localhost:' + PORT));

startDailyPushSchedule();

async function getBoardPriceReport() {
  const generatedAt = new Date().toISOString();
  const sources = await Promise.all(BOARD_PRICE_SOURCES.map(loadBoardPriceSource));
  const bcr = sources.find((source) => source.id === 'bcr');
  const bcrProducts = bcr?.products || [];
  const products = bcrProducts.length ? bcrProducts : LAST_KNOWN_BOARD_PRICE.products;
  const dateLabel = bcrProducts.length ? (bcr?.dateLabel || formatReportDate(generatedAt)) : LAST_KNOWN_BOARD_PRICE.dateLabel;
  const availableSources = sources.filter((source) => source.status === 'ok').length;
  const reportSources = bcrProducts.length ? sources : sources.map((source) => source.id === 'bcr' ? { ...source, status: 'partial', notes: LAST_KNOWN_BOARD_PRICE.notes } : source);
  return {
    generatedAt,
    title: 'Precio Pizarra',
    dateLabel,
    products,
    summary: buildBoardPriceSummary(products, reportSources),
    sources: reportSources,
    status: products.length ? 'ok' : 'partial',
    sourceCount: availableSources,
  };
}

async function loadBoardPriceSource(source) {
  try {
    const response = await fetch(source.url, {
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'user-agent': 'Morettis precios pizarra/1.0',
      },
    });
    const html = await response.text();
    if (!response.ok) throw new Error('HTTP ' + response.status);
    if (source.id === 'bcr') return parseBcrBoardPrices(source, html);
    if (source.id === 'matba') return parseMatbaSource(source, html);
    if (source.id === 'acabase') return parseAcabaseSource(source, html);
    return { ...source, status: 'ok', notes: 'Fuente consultada.', products: [] };
  } catch (error) {
    return { ...source, status: 'error', notes: 'No se pudo consultar la fuente: ' + String(error.message || error), products: [] };
  }
}

function parseBcrBoardPrices(source, html) {
  const text = htmlToText(html);
  const dateMatch = text.match(/Precios\s+Pizarra\s+del\s+d[ií]a\s+([0-9/]+)/i);
  const products = ['Trigo', 'Maiz', 'Girasol', 'Soja', 'Sorgo']
    .map((name) => parseBcrProduct(text, name))
    .filter(Boolean);
  const exchangeMatch = text.match(/TC\s+BNA\s+Divisas\s+Comprador\s+([^:]+):\s*\$?\s*([0-9.,]+)/i);
  const timestampMatch = text.match(/Rosario,\s*([^\n]+?hs\.?)/i);
  return {
    ...source,
    status: products.length ? 'ok' : 'partial',
    dateLabel: dateMatch?.[1] || '',
    timestamp: timestampMatch?.[1] || '',
    exchangeRate: exchangeMatch ? { label: exchangeMatch[1].trim(), value: exchangeMatch[2].trim() } : null,
    notes: products.length ? 'Precios corrientes expresados en $/Tn, entrega enseguida y pago contado, zona Rosario.' : 'La fuente respondio, pero no se pudieron leer precios publicados.',
    products,
  };
}

function parseBcrProduct(text, productName) {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const normalizedProduct = normalizeMarketText(productName);
  const index = lines.findIndex((line) => normalizeMarketText(line) === normalizedProduct);
  if (index === -1) return null;
  const ars = cleanPriceValue(lines[index + 1] || '');
  let usd = cleanPriceValue(lines[index + 2] || '');
  const nextLine = cleanPriceValue(lines[index + 3] || '');
  if (/^US\$/i.test(usd) && nextLine && /^[0-9.,]+$/.test(nextLine)) usd = usd + ' ' + nextLine;
  return {
    product: productName === 'Maiz' ? 'Maiz' : productName,
    ars,
    usd,
    source: 'BCR',
  };
}

function normalizeMarketText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function parseMatbaSource(source, html) {
  const text = htmlToText(html);
  const needsJs = /enable JavaScript/i.test(text);
  return {
    ...source,
    status: needsJs ? 'partial' : 'ok',
    notes: needsJs ? 'La fuente carga sus cotizaciones con JavaScript. Queda citada para control manual desde el link.' : 'Fuente consultada; la version publica no expone una tabla simple para leer automaticamente.',
    products: [],
  };
}

function parseAcabaseSource(source, html) {
  const text = htmlToText(html);
  const hasMarkets = /Moneda Pizarra y Precios|FISICO DE GRANO|FÍSICO DE GRANO/i.test(text);
  return {
    ...source,
    status: hasMarkets ? 'partial' : 'ok',
    notes: hasMarkets ? 'La portada publica muestra secciones de pizarra y fisico, pero no expone valores completos sin interaccion o sesion.' : 'Fuente consultada; no se encontraron precios completos en la portada publica.',
    products: [],
  };
}

function buildBoardPriceSummary(products, sources) {
  if (!products.length) return 'No se pudieron leer precios automaticos completos. Revisar los links de fuentes.';
  const names = products.map((item) => item.product).join(', ');
  const partialSources = sources.filter((source) => source.status !== 'ok').map((source) => source.name);
  return 'Lectura automatica disponible para ' + names + '. ' + (partialSources.length ? 'Fuentes para control manual: ' + partialSources.join(', ') + '.' : 'Todas las fuentes respondieron correctamente.');
}

async function savePushSubscription(body) {
  if (!vapidPublicKey || !vapidPrivateKey) throw validationError('Faltan claves push en el servidor');
  if (!body?.subscription?.endpoint) throw validationError('Falta la suscripcion del navegador');
  await ensurePushSheet();
  const rows = await getValues("'" + PUSH_SHEET_NAME + "'!A2:E");
  const endpoint = String(body.subscription.endpoint);
  const exists = rows.some((row) => row[1] === endpoint);
  if (!exists) {
    await appendValues("'" + PUSH_SHEET_NAME + "'!A1:E", [[
      new Date().toISOString(),
      endpoint,
      JSON.stringify(body.subscription),
      String(body.userAgent || ''),
      'activa',
    ]]);
  }
  return { ok: true, alreadyRegistered: exists };
}

async function sendBoardPricePush(options = {}) {
  if (!vapidPublicKey || !vapidPrivateKey) return { ok: false, sent: 0, error: 'Push no configurado' };
  const dailyDateKey = getArgentinaDateKey();
  if (options.daily) {
    const now = getArgentinaDateTimeParts();
    if (now.hour < 9) return { ok: true, sent: 0, skipped: true, reason: 'before_9am', dateKey: dailyDateKey };
    if (await hasBoardPricePushBeenSent(dailyDateKey)) return { ok: true, sent: 0, skipped: true, reason: 'already_sent_today', dateKey: dailyDateKey };
  }
  if (!options.force && !options.daily && !shouldSendDailyPushNow()) return { ok: true, sent: 0, skipped: true };
  const subscriptions = await listPushSubscriptions();
  if (!subscriptions.length) return { ok: true, sent: 0, message: 'No hay celulares suscriptos' };
  const report = await getBoardPriceReport();
  const body = buildBoardPricePushBody(report);
  const payload = JSON.stringify({
    title: 'Precio Pizarra Morettis',
    body,
    url: '/pizarra.html',
    tag: 'morettis-precio-pizarra-' + getArgentinaDateKey(),
  });
  let sent = 0;
  let failed = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification(subscription, payload);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error('No se pudo enviar push', error?.statusCode || '', error?.message || error);
    }
  }));
  if (sent) {
    lastDailyPushDate = dailyDateKey;
    if (options.daily || !options.force) await recordBoardPricePushSend(dailyDateKey, sent, failed, report.dateLabel);
  }
  return { ok: true, sent, failed, dateLabel: report.dateLabel, dateKey: dailyDateKey };
}

async function listPushSubscriptions() {
  try {
    const rows = await getValues("'" + PUSH_SHEET_NAME + "'!A2:E");
    return rows
      .filter((row) => row[4] !== 'inactiva')
      .map((row) => {
        try { return JSON.parse(row[2] || '{}'); } catch { return null; }
      })
      .filter((subscription) => subscription?.endpoint);
  } catch {
    return [];
  }
}

async function hasBoardPricePushBeenSent(dateKey) {
  if (lastDailyPushDate === dateKey) return true;
  try {
    await ensurePushSendsSheet();
    const rows = await getValues("'" + PUSH_SENDS_SHEET_NAME + "'!A2:E");
    const alreadySent = rows.some((row) => row[0] === dateKey && row[4] === 'enviado');
    if (alreadySent) lastDailyPushDate = dateKey;
    return alreadySent;
  } catch (error) {
    console.error('No se pudo revisar el historial de push diario', error?.message || error);
    return false;
  }
}

async function recordBoardPricePushSend(dateKey, sent, failed, dateLabel) {
  await ensurePushSendsSheet();
  await appendValues("'" + PUSH_SENDS_SHEET_NAME + "'!A1:F", [[
    dateKey,
    new Date().toISOString(),
    sent,
    failed,
    'enviado',
    dateLabel || '',
  ]]);
}

function buildBoardPricePushBody(report) {
  const products = report.products || [];
  const soja = products.find((item) => normalizeMarketText(item.product) === 'soja');
  const maiz = products.find((item) => normalizeMarketText(item.product) === 'maiz');
  const trigo = products.find((item) => normalizeMarketText(item.product) === 'trigo');
  const parts = [soja, maiz, trigo].filter(Boolean).map((item) => item.product + ': ' + (item.ars || '-'));
  return 'Pizarra ' + (report.dateLabel || '') + (parts.length ? ' | ' + parts.join(' | ') : '');
}

let lastDailyPushDate = '';

function startDailyPushSchedule() {
  setInterval(() => {
    if (shouldSendDailyPushNow()) sendBoardPricePush({ daily: true }).catch((error) => console.error('Error en push diario', error));
  }, 60 * 1000);
}

function shouldSendDailyPushNow() {
  const now = getArgentinaDateTimeParts();
  const today = getArgentinaDateKey(now);
  return now.hour === 9 && now.minute === 0 && lastDailyPushDate !== today;
}

function getArgentinaDateTimeParts() {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: byType.year,
    month: byType.month,
    day: byType.day,
    hour: Number(byType.hour),
    minute: Number(byType.minute),
  };
}

function getArgentinaDateKey(parts = getArgentinaDateTimeParts()) {
  return parts.year + '-' + parts.month + '-' + parts.day;
}

function cleanPriceValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(h[1-6]|p|div|li|tr|td|th|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function formatReportDate(value) {
  return new Date(value).toLocaleDateString('es-AR', { dateStyle: 'full' });
}

async function createExpense(body) {
  const accessUser = validateAccessCode(body.codigo_acceso);
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
  const shouldUseWebAccumulation = concept.concept === 'Ap. y Contr';
  const previousWebTotal = shouldUseWebAccumulation ? await getWebTotalForConceptMonth(concept.concept, month.column) : 0;
  const newValue = shouldUseWebAccumulation ? previousWebTotal + amount : amount;
  await updateValues(targetRange, [[newValue]]);

  const receiptDescription = String(body.descripcion_comprobante || '').trim() || concept.concept + ' - ' + month.label;
  const receiptResult = await saveReceiptFromBody(body, accessUser, amount, receiptDescription, false);

  const message = 'Carga web directa | ' + concept.type + ' > ' + concept.category + ' > ' + subcategory + ' > ' + concept.concept + ' | ' + month.label;
  await appendValues("'" + SHEET_NAME + "'!A1:R", [[
    id,
    now,
    accessUser,
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
    'Carga directa en ' + MAIN_SHEET_NAME + '!' + month.column + concept.row + '. Valor anterior: ' + previousValue + '. ' + (shouldUseWebAccumulation ? (previousWebTotal ? 'Se sumo a cargas web anteriores: ' + previousWebTotal + '.' : 'Primera carga web del mes: se reemplazo la proyeccion.') : 'Se reemplazo por el importe cargado.'),
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
    valorNuevo: newValue,
    acumuladoWebAnterior: previousWebTotal,
    modoCarga: shouldUseWebAccumulation ? (previousWebTotal ? 'suma_web' : 'primer_real_web') : 'reemplazo',
    comprobante: receiptResult,
  };
}

function validationError(message) { const error = new Error(message); error.statusCode = 400; return error; }
function validateAccessCode(code) {
  const normalizedCode = String(code || '').trim();
  if (accessUsers.length) {
    const user = accessUsers.find((item) => item.code === normalizedCode);
    if (!user) throw validationError('Codigo de acceso incorrecto');
    return user.name;
  }
  if (accessCode && normalizedCode !== accessCode) throw validationError('Codigo de acceso incorrecto');
  return 'Carga web';
}

async function listHistory() {
  const rows = await getValues("'" + SHEET_NAME + "'!A2:R");
  return rows
    .map((row, index) => expenseFromRow(row, index + 2))
    .filter((expense) => expense.id)
    .reverse()
    .slice(0, 50);
}

async function getWebTotalForConceptMonth(conceptName, monthColumn) {
  const rows = await getValues("'" + SHEET_NAME + "'!A2:R", 'UNFORMATTED_VALUE');
  return rows
    .map((row, index) => expenseFromRow(row, index + 2))
    .filter((expense) => expense.estado === 'cargado' && expense.concepto === conceptName && expense.columnaDestino === monthColumn)
    .reduce((total, expense) => total + expense.importe, 0);
}

async function createReceipt(body) {
  const accessUser = validateAccessCode(body.codigo_acceso);
  return saveReceiptFromBody(body, accessUser, parseAmount(body.importe), String(body.descripcion || '').trim(), true);
}

async function saveReceiptFromBody(body, accessUser, amount, description, required) {
  const person = String(body.persona || accessUser).trim();
  const fileName = String(body.archivo_nombre || '').trim();
  const fileType = String(body.archivo_tipo || '').trim() || 'application/octet-stream';
  const fileSize = Number(body.archivo_tamano || 0);
  const fileBase64 = String(body.archivo_base64 || '').trim();

  if (!fileName && !fileBase64 && !required) return null;
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

async function listReceiptHistory() {
  try {
    const rows = await getValues("'" + RECEIPTS_SHEET_NAME + "'!A2:I");
    return rows
      .map(receiptFromRow)
      .filter((receipt) => receipt.id)
      .reverse()
      .slice(0, 50);
  } catch (error) {
    if (String(error.message || '').includes('Unable to parse range')) return [];
    throw error;
  }
}

async function sendReceiptFile(res, id) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) throw validationError('Falta el comprobante');

  const rows = await getValues("'" + RECEIPTS_SHEET_NAME + "'!A2:Z");
  const row = rows.find((item) => item[0] === normalizedId);
  if (!row) throw validationError('No encontre ese comprobante');

  const fileName = String(row[5] || 'comprobante');
  const fileType = String(row[6] || 'application/octet-stream');
  const fileBase64 = row.slice(9).join('');
  const fileBuffer = Buffer.from(fileBase64, 'base64');

  res.writeHead(200, {
    'content-type': fileType,
    'content-length': fileBuffer.length,
    'content-disposition': 'inline; filename="' + encodeHeaderFileName(fileName) + '"',
    'cache-control': 'private, max-age=3600',
  });
  res.end(fileBuffer);
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

function receiptFromRow(row) {
  return {
    id: row[0] || '',
    fecha: row[1] || '',
    persona: row[2] || '',
    importe: parseAmount(row[3]),
    descripcion: row[4] || '',
    archivoNombre: row[5] || '',
    archivoTipo: row[6] || '',
    archivoTamano: Number(row[7] || 0),
    partes: Number(row[8] || 0),
    archivoUrl: row[0] ? '/api/comprobantes/archivo?id=' + encodeURIComponent(row[0]) : '',
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

async function ensurePushSheet() {
  const header = ['fecha', 'endpoint', 'subscription_json', 'user_agent', 'estado'];
  try {
    const rows = await getValues("'" + PUSH_SHEET_NAME + "'!A1:E1");
    if (rows.length) return;
  } catch (error) {
    await batchUpdate({ requests: [{ addSheet: { properties: { title: PUSH_SHEET_NAME } } }] });
  }
  await updateValues("'" + PUSH_SHEET_NAME + "'!A1:E1", [header]);
}

async function ensurePushSendsSheet() {
  const header = ['fecha_argentina', 'fecha_envio', 'enviados', 'fallidos', 'estado', 'pizarra'];
  try {
    const rows = await getValues("'" + PUSH_SENDS_SHEET_NAME + "'!A1:F1");
    if (rows.length) return;
  } catch (error) {
    await batchUpdate({ requests: [{ addSheet: { properties: { title: PUSH_SENDS_SHEET_NAME } } }] });
  }
  await updateValues("'" + PUSH_SENDS_SHEET_NAME + "'!A1:F1", [header]);
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

function contentType(filePath) { return { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json; charset=utf-8' }[extname(filePath)] || 'application/octet-stream'; }
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
function parseAccessUsers(value) {
  return String(value || '')
    .split(/[;\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.includes('|') ? '|' : ':';
      const index = part.indexOf(separator);
      if (index === -1) return null;
      const name = part.slice(0, index).trim();
      const code = part.slice(index + 1).trim();
      return name && code ? { name, code } : null;
    })
    .filter(Boolean);
}
function chunkText(value, size) { const chunks = []; for (let index = 0; index < value.length; index += size) chunks.push(value.slice(index, index + size)); return chunks; }
function encodeHeaderFileName(value) { return String(value).replace(/[\"\\\r\n]/g, '_'); }
function sendBase64File(res, contentTypeValue, base64Value) { const fileBuffer = Buffer.from(base64Value, 'base64'); res.writeHead(200, { 'content-type': contentTypeValue, 'content-length': fileBuffer.length, 'cache-control': 'public, max-age=86400' }); res.end(fileBuffer); }
function siteManifest() { return { name: 'Morettis Gastos', short_name: 'Morettis', start_url: '/', display: 'standalone', background_color: '#eef3f1', theme_color: '#176b52', icons: [{ src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }, { src: '/favicon.png', sizes: '32x32', type: 'image/png' }] }; }
function sendJson(res, statusCode, payload) { res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); }
function base64url(value) { return Buffer.from(value).toString('base64url'); }
