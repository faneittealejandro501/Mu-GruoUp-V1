import { generateRecoveryCode, syncEncryptedBackup } from './privateBackup';
import { db, getKvSetting, initDexie, normalizeCharacterRecord, setKvSetting } from '../db/dexieStore';
import { getConfiguredCloudApiUrl } from './githubOtaService';
import type {
  AsyncDuelChallenge,
  MuAccount,
  MuCharacter,
  SyncStatusInfo,
} from '../types/game';

type StatusListener = (status: SyncStatusInfo) => void;
type DataAppliedListener = () => void;

class CloudSyncManager {
  private statusListeners = new Set<StatusListener>();
  private dataAppliedListeners = new Set<DataAppliedListener>();
  private activeAccountId: string | null = null;
  private pollTimer: number | null = null;
  private syncing = false;
  private apiProbeState: 'unknown' | 'available' | 'unavailable' = 'unknown';

  private status: SyncStatusInfo = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isOfflineMode: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    syncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    lastMessage: null,
    cloudUrl: getConfiguredCloudApiUrl(),
    error: null,
  };

  private onOnline = () => {
    this.updateStatus({ isOnline: true, isOfflineMode: false });
    void this.syncNow();
  };

  private onOffline = () => {
    this.updateStatus({
      isOnline: false,
      isOfflineMode: true,
      lastMessage: 'Sin conexión · Guardado local en IndexedDB',
    });
  };

  public getStatus(): SyncStatusInfo {
    return { ...this.status, cloudUrl: getConfiguredCloudApiUrl() };
  }

  public setActiveAccountId(accountId: string | null): void {
    this.activeAccountId = accountId;
    if (accountId && navigator.onLine) void this.syncNow();
  }

  public resetApiProbe(): void {
    this.apiProbeState = 'unknown';
    this.updateStatus({ cloudUrl: getConfiguredCloudApiUrl() });
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public onCloudDataApplied(listener: DataAppliedListener): () => void {
    this.dataAppliedListeners.add(listener);
    return () => {
      this.dataAppliedListeners.delete(listener);
    };
  }

  public start(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    void this.refreshPendingCount();
    if (navigator.onLine) {
      void this.syncNow();
    }
    if (this.pollTimer === null) {
      this.pollTimer = window.setInterval(() => {
        void this.refreshPendingCount();
        if (navigator.onLine) {
          void this.syncNow();
        }
      }, 25000);
    }
  }

  public stop(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
    }
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private updateStatus(patch: Partial<SyncStatusInfo>): void {
    this.status = {
      ...this.status,
      ...patch,
      cloudUrl: getConfiguredCloudApiUrl(),
    };
    const snapshot = this.getStatus();
    for (const cb of this.statusListeners) {
      cb(snapshot);
    }
  }

  private async refreshPendingCount(): Promise<number> {
    try {
      await initDexie();
      const [accounts, characters] = await Promise.all([
        db.accounts.toArray(),
        db.characters.toArray(),
      ]);
      const pending =
        accounts.filter((a) => !a.isSynced).length +
        characters.filter((c) => !c.isSynced).length;
      this.updateStatus({ pendingCount: pending });
      return pending;
    } catch {
      return 0;
    }
  }

  private async resolveApiBase(): Promise<string | null> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return null;
    }
    const configured = getConfiguredCloudApiUrl();
    if (configured) {
      return configured;
    }
    if (this.apiProbeState === 'available') return '';
    if (this.apiProbeState === 'unavailable') return null;

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 2500);
    try {
      const res = await fetch('/api/ota/manifest', { signal: ctrl.signal });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        this.apiProbeState = 'available';
        return '';
      }
    } catch {
      // static host / offline
    } finally {
      window.clearTimeout(timer);
    }
    this.apiProbeState = 'unavailable';
    return null;
  }

  private async backupEndpoint(): Promise<URL> {
    const base = await this.resolveApiBase();
    if (base === null) throw new Error('Configura un servidor de copia privada con conexión.');
    return new URL(base + '/api/private-backup', window.location.origin);
  }

  private async snapshot(id: string): Promise<{ account: MuAccount; characters: MuCharacter[] }> {
    await initDexie();
    return db.transaction('r', db.accounts, db.characters, db.items, async () => {
      const account = await db.accounts.get(id);
      if (!account) throw new Error('Inicia sesión para crear una copia de tu cuenta.');
      const records = await db.characters.where('accountId').equals(id).toArray();
      const characters = await Promise.all(records.map(async (record) => {
        const items = await db.items.where('charId').equals(record.id).toArray();
        return { ...record, equipment: items.filter(i => i.isEquipped), inventory: items.filter(i => !i.isEquipped) };
      }));
      return { account, characters };
    });
  }

  private async applyBackup(
    copy: { account: MuAccount; characters: MuCharacter[] }, endpoint: URL, code: string,
  ): Promise<void> {
    let applied = false;
    await db.transaction('rw', db.accounts, db.characters, db.items, db.kvMeta, async () => {
      const account = await db.accounts.get(copy.account.id);
      const byName = await db.accounts.where('username').equals(copy.account.username).first();
      if (byName && byName.id !== copy.account.id) throw new Error('Ya existe otra cuenta local con ese nombre.');
      if (!account || account.updatedAt <= copy.account.updatedAt) {
        await db.accounts.put({ ...copy.account, isSynced: true });
        applied ||= !account || account.updatedAt < copy.account.updatedAt;
      }
      for (const ch of copy.characters) {
        const old = await db.characters.get(ch.id);
        if (old && (old.accountId !== copy.account.id || old.updatedAt > ch.updatedAt)) continue;
        if (!old || old.updatedAt < ch.updatedAt) {
          await db.characters.put(normalizeCharacterRecord({ ...ch, isSynced: true }));
          await db.items.where('charId').equals(ch.id).delete();
          const gear = [...(ch.equipment || []), ...(ch.inventory || [])];
          await db.items.bulkPut(gear.map(item => ({ ...item, charId: ch.id })));
          applied = true;
        } else {
          await db.characters.update(ch.id, { isSynced: true });
        }
      }
      await setKvSetting('privateBackup:' + copy.account.id, { endpoint: endpoint.href, code });
    });
    if (applied) for (const listener of this.dataAppliedListeners) listener();
  }

  public async createPrivateBackup(): Promise<string> {
    const id = this.activeAccountId;
    if (!id) throw new Error('Inicia sesión para crear tu copia privada.');
    if (this.syncing) throw new Error('Espera a que termine la sincronización.');
    this.syncing = true;
    try {
      const endpoint = await this.backupEndpoint();
      const key = 'privateBackup:' + id;
      const saved = await getKvSetting<{ endpoint: string; code: string } | null>(key, null);
      const code = saved?.endpoint === endpoint.href ? saved.code : generateRecoveryCode();
      const remote = await syncEncryptedBackup(endpoint, code, await this.snapshot(id));
      await this.applyBackup(remote, endpoint, code);
      await this.refreshPendingCount();
      this.updateStatus({ lastSyncedAt: new Date().toISOString(), error: null });
      return code;
    } finally {
      this.syncing = false;
    }
  }

  public async restorePrivateBackup(rawCode: string): Promise<number> {
    if (this.syncing) throw new Error('Espera a que termine la sincronización.');
    this.syncing = true;
    try {
      const endpoint = await this.backupEndpoint();
      const code = rawCode.trim().toLowerCase();
      const copy = await syncEncryptedBackup(endpoint, code);
      await this.applyBackup(copy, endpoint, code);
      return copy.characters.length;
    } finally {
      this.syncing = false;
    }
  }

  public async syncNow(): Promise<{ ok: boolean; message: string }> {
    if (this.syncing) return { ok: true, message: 'Sincronización en curso…' };
    const id = this.activeAccountId;
    if (!navigator.onLine || !id) return { ok: false, message: 'Progreso disponible en este dispositivo.' };
    this.syncing = true;
    try {
      const saved = await getKvSetting<{ endpoint: string; code: string } | null>('privateBackup:' + id, null);
      if (!saved) return { ok: false, message: 'Activa la copia privada para sincronizar el progreso.' };
      const endpoint = await this.backupEndpoint();
      if (endpoint.href !== saved.endpoint) {
        return { ok: false, message: 'Activa la copia privada para el servidor seleccionado.' };
      }
      if (this.activeAccountId !== id) return { ok: false, message: 'La cuenta activa cambió.' };
      this.updateStatus({ syncing: true, error: null });
      const copy = await syncEncryptedBackup(endpoint, saved.code, await this.snapshot(id));
      await this.applyBackup(copy, endpoint, saved.code);
      await this.refreshPendingCount();
      const message = `Copia privada al día (${copy.characters.length} héroes)`;
      this.updateStatus({ lastSyncedAt: new Date().toISOString(), lastMessage: message, isOfflineMode: false });
      return { ok: true, message };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de sincronización';
      this.updateStatus({ error: message, lastMessage: 'Progreso guardado en este dispositivo.' });
      return { ok: false, message };
    } finally {
      this.syncing = false;
      this.updateStatus({ syncing: false });
    }
  }

  public async fetchDuelChallenges(): Promise<AsyncDuelChallenge[]> {
    const base = await this.resolveApiBase();
    if (base === null) return [];
    try {
      const res = await fetch(`${base}/api/duels/challenges`);
      if (!res.ok) return [];
      const data = (await res.json()) as { challenges?: AsyncDuelChallenge[] };
      return Array.isArray(data.challenges) ? data.challenges : [];
    } catch {
      return [];
    }
  }

  public async publishDuelChallenge(challenge: AsyncDuelChallenge): Promise<boolean> {
    const base = await this.resolveApiBase();
    if (base === null) return false;
    try {
      const res = await fetch(`${base}/api/duels/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(challenge),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

}

export const cloudSyncManager = new CloudSyncManager();
