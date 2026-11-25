import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMP_SIZE, scatterCamps, SpawnGrid } from '../src/game/encounters.ts';
import { flightHeight } from '../src/game/content/WingRig.ts';
import { waterGeometry } from '../src/game/content/WaterSurface.ts';

test('four maps have spaced repeatable camps of ten, clear of protected areas', () => {
  const maps = ['flaris', 'robledal', 'puerto_bruma', 'crater_ceniza'];
  const centers = [[1336, 1281], [520, 2440], [2300, 2390], [2540, 490]];
  const outside = (x: number, z: number, radius: number) => centers.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > radius);
  const firstSites = new Set();
  for (const map of maps) {
    const create = () => scatterCamps(map, 3072, 4000, (x, z) => outside(x, z, 524));
    const members = create();
    assert.ok(members.length > 2500 && members.length % 10 === 0);
    const anchors = members.filter((_, i) => i % 10 === 0);
    for (const [i,a] of anchors.entries()) for (const b of anchors.slice(i+1))
      assert.ok(Math.hypot(a.x-b.x,a.z-b.z) >= 124);
    assert.equal(new Set(anchors.map(a => (a.x > 1536 ? 1 : 0) + (a.z > 1536 ? 2 : 0))).size,4);
    assert.deepEqual(members, create());
    firstSites.add(members[0].x);
    const grid = new SpawnGrid<(typeof members)[number]>();
    for (const [i, m] of members.entries()) {
      assert.equal(m.camp, Math.floor(i / CAMP_SIZE));
      assert.ok(outside(m.x, m.z, 500));
      assert.ok(m.x >= 40 && m.z >= 40 && m.x <= 3032 && m.z <= 3032);
      grid.add(m.x, m.z, m);
    }
    const { x, z } = members[700];
    const matches = [...grid.near(x, z, 110)];
    assert.ok(matches.length < members.length * 0.03, 'nearby query must stay local');
    assert.deepEqual(
      matches.filter(m => Math.hypot(m.x - x, m.z - z) <= 110).sort((a,b) => a.x - b.x),
      members.filter(m => Math.hypot(m.x - x, m.z - z) <= 110).sort((a,b) => a.x - b.x),
    );
  }
  assert.equal(firstSites.size, 4);
});

test('flight covers 2 meters without a discontinuity at the next wingbeat', () => {
  assert.equal(flightHeight(0), flightHeight(1));
  assert.equal(flightHeight(0.5) - flightHeight(0), 2);
  assert.ok(flightHeight(0.75) < flightHeight(0.5));
});

test('water cells share edges and invalid or duplicate cells emit no extra faces', () => {
  const cell = { x: 16, z: 16, height: 80, size: 32, textureId: 1 };
  const data = waterGeometry([cell, cell, { ...cell, x: 48 }, { ...cell, height: 0 }]);
  assert.equal(data.indices?.length, 12);
  const positions = Array.from(data.positions!);
  assert.deepEqual(positions.slice(9, 12), positions.slice(12, 15));
  assert.deepEqual(positions.slice(6, 9), positions.slice(15, 18));
});
