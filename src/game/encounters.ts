export const CAMP_SIZE = 10;
const CELL = 64;
const MARGIN = 40;
const CAMP_RADIUS = 12;

export interface CampMember {
  camp: number;
  x: number;
  z: number;
  heading: number;
}

export function scatterCamps(seed: string, size: number, count: number, allowed: (x: number, z: number) => boolean): CampMember[] {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };

  const members: CampMember[] = [];
  const pitch = 128; // 100 m clear between the outer members, including jitter.
  const columns = Math.floor((size - 2 * (MARGIN + CAMP_RADIUS)) / pitch);
  const strata = Array.from({ length: columns * columns }, (_, i) => i);
  for (let i = strata.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [strata[i], strata[j]] = [strata[j], strata[i]];
  }
  const edge = MARGIN + CAMP_RADIUS;
  for (let attempt = 0; members.length < count * CAMP_SIZE && attempt < strata.length; attempt++) {
    const cell = strata[attempt % strata.length];
    const x = edge + ((cell % columns) + 0.5) * pitch + random() * 4;
    const z = edge + (Math.floor(cell / columns) + 0.5) * pitch + random() * 4;
    if (!allowed(x, z)) continue;
    const heading = random() * Math.PI * 2;
    const camp = members.length / CAMP_SIZE;
    for (let n = 0; n < CAMP_SIZE; n++) {
      const angle = heading + n * 2.399963;
      const radius = Math.sqrt(n / (CAMP_SIZE - 1)) * CAMP_RADIUS;
      members.push({ camp, x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius, heading: angle });
    }
  }
  return members;
}

export class SpawnGrid<T> {
  private cells = new Map<number, T[]>();
  private key(x: number, z: number): number { return x + z * 1024; }

  add(x: number, z: number, entity: T): void {
    const key = this.key(Math.floor(x / CELL), Math.floor(z / CELL));
    const cell = this.cells.get(key);
    if (cell) cell.push(entity);
    else this.cells.set(key, [entity]);
  }

  *near(x: number, z: number, radius: number): Iterable<T> {
    for (let iz = Math.floor((z - radius) / CELL); iz <= Math.floor((z + radius) / CELL); iz++) {
      for (let ix = Math.floor((x - radius) / CELL); ix <= Math.floor((x + radius) / CELL); ix++) {
        const cell = this.cells.get(this.key(ix, iz));
        if (cell) yield* cell;
      }
    }
  }

  clear(): void { this.cells.clear(); }
}
