// Cross-file integration checks; no GPU or external services required.
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { RECIPES } from '../src/game/content/recipes.ts';
import { BESTIARY } from '../src/data/bestiary.ts';
import { MU_SKILLS } from '../src/data/muSkillsAndClasses.ts';

const publicRoot = new URL('../public/', import.meta.url);
const root = new URL('../public/mugroup/', import.meta.url);
const readJSON = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const required = new Set();

function resolveRel(rel) {
  return rel;
}

async function asset(path) {
  const rel = resolveRel(path);
  const url = new URL(rel, root);
  assert(url.href.startsWith(publicRoot.href), `Asset outside public: ${path}`);
  const info = await stat(fileURLToPath(url));
  assert(info.isFile() && info.size > 0, `Empty asset: ${path}`);
  assert(info.size < 25 * 1024 * 1024, `Asset exceeds offline cache limit: ${path}`);
  required.add(rel);
}

async function glb(path) {
  await asset(path);
  const bytes = await readFile(new URL(resolveRel(path), root));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, path);
  assert.equal(bytes.readUInt32LE(4), 2, path);
  assert.equal(bytes.readUInt32LE(8), bytes.length, path);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
}

const characters = await readJSON('personajes.json');
assert.equal(characters.length, 10);
assert.equal(new Set(characters.map((c) => c.id)).size, 10);
for (const cls of Object.keys(RECIPES)) {
  for (const sex of ['male', 'female']) {
    const c = characters.find((ch) => ch.classId === cls && ch.sex === sex);
    assert(c, `Missing ${cls}/${sex}`);
    const outfit = await glb(c.model);
    const body = await glb(c.body);
    assert.equal(outfit.skins[0].joints.length, 30, c.id);
    assert.equal(body.skins[0].joints.length, 30, c.id);
    assert(outfit.animations.length >= 13, `${c.id} animations >= 13`);
    for (const clip of ['idle', 'run', 'attack', 'hit', 'death', 'jump_land', 'cast_release']) {
      assert(outfit.animations.some((a) => a.name === clip), `${c.id}/${clip}`);
    }
    assert(outfit.nodes.some((n) => n.name === 'socket_rightHand'), `Weapon socket: ${c.id}`);
    await asset(c.model.replace('.glb', '.animaciones.json'));
  }
}

const equipment = await readJSON('equipo.json');
await asset('equipo.json');
for (const file of new Set(Object.values(equipment.weapons))) await glb(file);
for (const file of new Set(Object.values(equipment.wings))) await glb(file);
for (const family of Object.values(equipment.sets)) {
  for (const sex of ['male', 'female']) {
    const outfit = await glb(family[sex]);
    assert.equal(outfit.skins[0].joints.length, 30);
  }
}

const media = await readJSON('efectos-audio.json');
for (const path of Object.values(media.sounds)) await asset(path);

const uniqueEffects = new Set();
const uniqueSounds = new Set();
let skills = 0;
for (const [cls, recipes] of Object.entries(RECIPES)) {
  assert.equal(recipes.length, MU_SKILLS[cls].length);
  for (let i = 0; i < recipes.length; i++) {
    const [effect, sound] = recipes[i];
    assert.equal(MU_SKILLS[cls][i].flyffEffect, effect, `Mismatch effect for ${cls}[${i}]`);
    assert.equal(MU_SKILLS[cls][i].flyffSound, sound, `Mismatch sound for ${cls}[${i}]`);
    assert(!uniqueEffects.has(effect), `Duplicate skill effect: ${effect}`);
    assert(!uniqueSounds.has(sound), `Duplicate skill sound: ${sound}`);
    uniqueEffects.add(effect);
    uniqueSounds.add(sound);

    const path = `efectos/${effect}.json`;
    const def = await readJSON(path);
    await asset(path);
    assert.equal(def.missing?.length ?? 0, 0, `Incomplete selected effect: ${effect}`);
    assert(media.sounds[sound], `Missing sound: ${sound}`);
    for (const part of def.parts) {
      for (const texture of part.textures ?? []) await asset(texture);
      if (part.mesh) await asset(part.mesh);
    }
    skills++;
  }
}
assert.equal(skills, 30, 'Expected 30 distinct class skills');

// Verify water & weather & sparkle textures + NPC GLBs + >= 40 Monster GLBs
for (const tex of [
  'efectos/texturas/water.png',
  'efectos/texturas/obj_mamaprtree.png',
  'efectos/texturas/sfx_genlight01-1.png',
]) {
  await asset(tex);
}

const npcFiles = (await readdir(fileURLToPath(new URL('npcs/', root)))).filter((f) => f.endsWith('.glb'));
assert(npcFiles.length >= 6, `Expected >= 6 NPC GLBs, got ${npcFiles.length}`);
for (const f of npcFiles) await glb(`npcs/${f}`);

const monsterFiles = (await readdir(fileURLToPath(new URL('monstruos/', root)))).filter((f) => f.endsWith('.glb'));
assert(new Set(BESTIARY.map(species => species.id)).size >= 40, 'Expected at least 40 original species');
assert(monsterFiles.length >= 20, 'Missing integrated monster GLBs');
for (const f of monsterFiles) await glb(`monstruos/${f}`);

const world = await readJSON('mundo/mundo.json');
assert.equal(world.sizeMeters, 3072);
assert.equal(world.tiles.length, 36);
const height = await readFile(new URL('mundo/heightmap.f32', root));
assert.equal(height.length, world.heightResolution ** 2 * 4);
for (let i = 0; i < height.length; i += 4) assert(Number.isFinite(height.readFloatLE(i)));
await asset('mundo/heightmap.f32');
for (const tile of world.tiles) {
  await glb(tile.terrain);
  await asset(tile.height);
  await asset(tile.surface);
  for (const object of tile.objects) assert(world.models[object.model], `Unknown model: ${object.model}`);
}
for (const model of Object.values(world.models)) {
  await glb(model.file);
  if (model.collision) {
    await asset(model.collision);
    assert(model.collisionBounds?.min.every(Number.isFinite));
    assert(model.collisionBounds?.max.every(Number.isFinite));
  }
}

console.log(
  JSON.stringify(
    {
      characters: 10,
      skills,
      npcs: npcFiles.length,
      monsters: monsterFiles.length,
      sounds: Object.keys(media.sounds).length,
      sectors: world.tiles.length,
      objects: world.tiles.reduce((n, t) => n + t.objects.length, 0),
      models: Object.keys(world.models).length,
      equipmentModels: new Set([
        ...Object.values(equipment.weapons),
        ...Object.values(equipment.wings),
        ...Object.values(equipment.sets).flatMap(Object.values),
      ]).size,
      referencedFiles: required.size,
    },
    null,
    2,
  ),
);
