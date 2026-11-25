import { readFileSync, writeFileSync } from 'node:fs';
const configured = (process.env.VITE_BACKUP_URL || process.env.VITE_WORLD_SERVER_URL || '').trim();
const url = configured ? new URL(configured) : null;
if (url && (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)) {
  throw Error('VITE_BACKUP_URL debe ser el origen HTTPS del servidor, sin ruta ni credenciales.');
}
if (process.env.REQUIRE_ACCOUNT_SERVICE === 'true') {
  if (!url) throw Error('Configura VITE_BACKUP_URL antes de publicar la web y el APK.');
  const pages = JSON.parse(readFileSync('public/ota-manifest.json','utf8')).pagesUrl;
  for (const origin of [new URL(pages).origin,'https://apk.mugroup.invalid']) {
    const options = {headers:{Origin:origin}, redirect:'error', signal:AbortSignal.timeout(15000)};
    const status = await fetch(new URL('/api/account-service',url),options);
    if (!status.ok || status.headers.get('access-control-allow-origin') !== origin ||
        (await status.json()).service !== 'mugroup-accounts')
      throw Error('Servidor de cuentas o recuperación no disponible desde '+origin);
    for (const path of ['/api/private-backup','/api/account-link/'+'0'.repeat(64)]) {
      const preflight = await fetch(new URL(path,url),{...options,method:'OPTIONS',headers:{
        Origin:origin,'Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'authorization,content-type',
      }});
      const permits = key => (preflight.headers.get(key) || '').toLowerCase().split(',').map(x=>x.trim());
      if (!preflight.ok || preflight.headers.get('access-control-allow-origin') !== origin ||
          !permits('access-control-allow-methods').includes('put') ||
          !['authorization','content-type'].every(h=>permits('access-control-allow-headers').includes(h)))
        throw Error('El servidor no admite sincronización desde '+origin);
    }
  }
}
writeFileSync('dist/server-connection.json', JSON.stringify({ origin: url?.origin ?? '' }) + '\n');
