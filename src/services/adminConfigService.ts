import { getKvSetting, setKvSetting } from '../db/dexieStore';

export type AdminSectionKey =
  | 'world-rules'
  | 'monsters'
  | 'items'
  | 'item-options'
  | 'npcs'
  | 'classes-skills';

export interface AdminWorldRules {
  brandName: string;
  version: string;
  cityRadiusMeters: number;
  detailStreamRadiusMeters: number;
  wingRunSpeedMultiplier: number;
  baseRunSpeed: number;
  stripManmadeStructures: boolean;
  safeZoneCombatBlocked: boolean;
  safeZoneMonsterExclusion: boolean;
  maps: Record<
    string,
    {
      name?: string;
      cityRadius: number;
      sizeMeters: number;
      minLevel: number;
      maxLevel: number;
      warpZen: number;
      weather: string;
      ambientBed: string;
      musicTheme: string;
      targetMonsterCount: number;
      spawn?: { x: number; z: number };
    }
  >;
}

export interface AdminConfigBundle {
  'world-rules': AdminWorldRules;
  monsters: Record<string, any>;
  items: Record<string, any>;
  'item-options': Record<string, any>;
  npcs: Record<string, any>;
  'classes-skills': Record<string, any>;
}

const DEFAULT_WORLD_RULES: AdminWorldRules = {
  brandName: "MuGro-up'",
  version: '2.0.0',
  cityRadiusMeters: 500,
  detailStreamRadiusMeters: 100,
  wingRunSpeedMultiplier: 1.0,
  baseRunSpeed: 14.0,
  stripManmadeStructures: true,
  safeZoneCombatBlocked: true,
  safeZoneMonsterExclusion: true,
  maps: {},
};

const DEFAULT_BUNDLE: AdminConfigBundle = {
  'world-rules': DEFAULT_WORLD_RULES,
  monsters: { version: '2.0.0', minDistinctClasses: 40, aggroRadiusMeters: 22, respawnSeconds: 7, glbOverrides: {}, extraCatalog: [] },
  items: { version: '2.0.0', priceMultiplier: 1.0, dropRateMultiplier: 1.0, wingCatalog: [], customShopItems: [] },
  'item-options': { version: '2.0.0', maxEnhanceLevel: 15, enhanceStatPerLevelPct: 8, wingLightEnabled: true, wingAuraParticlesEnabled: true, glowByEnhanceLevel: [] },
  npcs: { version: '2.0.0', interactRadiusMeters: 6.5, npcs: [] },
  'classes-skills': { version: '2.0.0', strictClassIsolation: true, classes: {} },
};

const SECTIONS: AdminSectionKey[] = [
  'world-rules',
  'monsters',
  'items',
  'item-options',
  'npcs',
  'classes-skills',
];

let cachedBundle: AdminConfigBundle = structuredClone(DEFAULT_BUNDLE);
let loadedOnce = false;
const listeners = new Set<(bundle: AdminConfigBundle) => void>();

export function getAdminConfigSync(): AdminConfigBundle {
  return cachedBundle;
}

export function subscribeAdminConfig(cb: (bundle: AdminConfigBundle) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  for (const cb of listeners) {
    try {
      cb(cachedBundle);
    } catch {
      // ignore listener errors
    }
  }
}

export async function loadAdminConfig(): Promise<AdminConfigBundle> {
  if (loadedOnce) return cachedBundle;
  const base = ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL) || '/';
  const nextBundle = structuredClone(DEFAULT_BUNDLE);

  // 1. Try Express API when online / local server running
  let loadedFromApi = false;
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const res = await fetch('/api/admin/config', { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as { config?: Partial<AdminConfigBundle> };
        if (json.config) {
          for (const key of SECTIONS) {
            if (json.config[key]) {
              (nextBundle as Record<string, any>)[key] = json.config[key];
            }
          }
          loadedFromApi = true;
        }
      }
    } catch {
      // Offline or static Pages hosting; fallback to precached /ADMIN/*.json
    }
  }

  // 2. Fallback to static precached ADMIN/*.json
  if (!loadedFromApi) {
    await Promise.all(
      SECTIONS.map(async (key) => {
        try {
          const r = await fetch(`${base}ADMIN/${key}.json`);
          if (r.ok) {
            (nextBundle as Record<string, any>)[key] = await r.json();
          }
        } catch {
          // keep default
        }
      }),
    );
  }

  // 3. Apply Dexie offline admin overrides (survives offline edits & reloads)
  for (const key of SECTIONS) {
    const localOverride = await getKvSetting<Record<string, any> | null>(`admin_override_${key}`, null);
    if (localOverride && typeof localOverride === 'object') {
      (nextBundle as Record<string, any>)[key] = localOverride;
    }
  }

  cachedBundle = nextBundle;
  loadedOnce = true;
  notify();
  return cachedBundle;
}

export async function saveAdminSection(
  section: AdminSectionKey,
  payload: Record<string, any>,
): Promise<{ ok: boolean; savedToServer: boolean; error?: string }> {
  (cachedBundle as Record<string, any>)[section] = payload;
  await setKvSetting(`admin_override_${section}`, payload);
  notify();

  return { ok: true, savedToServer: false };
}

export async function resetAdminSection(section: AdminSectionKey): Promise<AdminConfigBundle> {
  await setKvSetting(`admin_override_${section}`, null);
  loadedOnce = false;
  return loadAdminConfig();
}
