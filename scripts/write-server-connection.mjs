import { writeFileSync } from 'node:fs';
const configured = (process.env.VITE_BACKUP_URL || process.env.VITE_WORLD_SERVER_URL || '').trim();
const url = configured ? new URL(configured) : null;
if (url && (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)) {
  throw Error('VITE_BACKUP_URL debe ser el origen HTTPS del servidor, sin ruta ni credenciales.');
}
if (!url && process.env.GITHUB_EVENT_NAME !== 'pull_request')
  console.warn('::warning::Sin VITE_BACKUP_URL ni VITE_WORLD_SERVER_URL: las cuentas serán locales.');
writeFileSync('dist/server-connection.json', JSON.stringify({ origin: url?.origin ?? '' }) + '\n');
