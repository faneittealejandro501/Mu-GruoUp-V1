import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Express } from 'express';

const BACKUP_ROUTE = '/api/private-backup';
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
type Stored = { revision: string; iv: string; data: string };

export function mountPrivateBackup(app: Express, directory?: string, browserOrigins = '') {
  if (!directory) {
    app.all(BACKUP_ROUTE, (_req, res) => { res.status(503).json({ error: 'El servidor no tiene respaldo privado habilitado.' }); });
    return;
  }
  const root = resolve(directory);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const allowedOrigins = new Set(browserOrigins.split(',').map(origin => origin.trim()).filter(Boolean));
  const attempts = new Map<string, { at: number; count: number }>();
  app.all(BACKUP_ROUTE, (req, res) => {
    const origin = req.get('origin');
    if (origin) {
      let sameHost = false;
      try { sameHost = new URL(origin).host === req.get('host'); } catch { /* reject malformed origin */ }
      if (!sameHost && !allowedOrigins.has(origin)) {
        res.status(403).json({ error: 'Origen no autorizado.' });
        return;
      }
      res.set('Access-Control-Allow-Origin', origin);
      res.vary('Origin');
    }
    res.set('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      res.sendStatus(204);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'PUT') {
      res.sendStatus(405); return;
    }
    const now = Date.now(), ip = req.ip || 'unknown';
    if (attempts.size > 1000) {
      for (const [key, value] of attempts) if (now - value.at >= 60000) attempts.delete(key);
    }
    const seen = attempts.get(ip);
    if (seen && now - seen.at < 60000) {
      if (++seen.count > 60) { res.sendStatus(429); return; }
    } else if (attempts.size < 5000 || attempts.has(ip)) attempts.set(ip, { at: now, count: 1 });
    else { res.sendStatus(429); return; }

    const token = /^Bearer ([a-f0-9]{64})$/.exec(req.get('authorization') || '')?.[1];
    if (!token) { res.sendStatus(401); return; }
    const file = join(root, createHash('sha256').update(token).digest('hex') + '.json');
    try {
      let previous: Stored | undefined;
      try { previous = JSON.parse(readFileSync(file, 'utf8')) as Stored; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }

      if (req.method === 'GET') {
        if (previous) res.json(previous);
        else res.sendStatus(404);
        return;
      }
      const { revision, iv, data } = req.body ?? {};
      if (typeof iv !== 'string' || iv.length !== 16 || !BASE64.test(iv) ||
          typeof data !== 'string' || data.length < 24 || data.length > 560000 || !BASE64.test(data)) {
        res.status(400).json({ error: 'Copia cifrada inválida.' }); return;
      }
      if ((previous?.revision ?? null) !== revision) { res.sendStatus(409); return; }
      if (!previous && readdirSync(root).filter(name => /^[a-f0-9]{64}\.json$/.test(name)).length >= 1000) {
        res.sendStatus(507); return;
      }
      const next = { revision: randomUUID(), iv, data };
      const tmp = file + '.' + next.revision + '.tmp';
      try {
        writeFileSync(tmp,JSON.stringify(next), { mode: 0o600, flag: 'wx' });
        renameSync(tmp,file);
      } finally {
        try { unlinkSync(tmp); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      }
      res.json({ revision: next.revision });
    } catch {
      res.status(500).json({ error: 'Falló el almacenamiento del respaldo.' });
    }
  });
}
