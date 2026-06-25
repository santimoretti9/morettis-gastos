import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const env = await readEnv('.env');
const credentialsPath = env.GOOGLE_APPLICATION_CREDENTIALS;
const spreadsheetId = env.GOOGLE_SHEET_ID;

if (!credentialsPath || !spreadsheetId) {
  console.error('Faltan GOOGLE_APPLICATION_CREDENTIALS o GOOGLE_SHEET_ID en .env');
  process.exit(1);
}

const key = JSON.parse(await readFile(credentialsPath, 'utf8'));
const accessToken = await getAccessToken(key);
const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`);
url.searchParams.set('fields', 'properties.title,sheets.properties.title,sheets.properties.sheetId');

const response = await fetch(url, {
  headers: { authorization: `Bearer ${accessToken}` },
});
const data = await response.json();

if (!response.ok) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log(`Planilla conectada: ${data.properties?.title ?? '(sin titulo)'}`);
console.log('Pestanas:');
for (const sheet of data.sheets ?? []) {
  const props = sheet.properties;
  console.log(`- ${props.title} (${props.sheetId})`);
}

async function readEnv(filePath) {
  const content = await readFile(filePath, 'utf8');
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

async function getAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(key.private_key, 'base64url');
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.access_token;
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}
