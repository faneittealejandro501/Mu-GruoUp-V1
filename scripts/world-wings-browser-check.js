// Open the DEV Preview with ?headless=1, then run:
// coderabbit-agent-browser eval --stdin < scripts/world-wings-browser-check.js
(async () => {
  const engine = window.__muEngine;
  if (!engine) throw Error('Engine unavailable');
  const assert = (value, message) => { if (!value) throw Error(message); };
  const { getStarterItemsForMuClass } = await import('/src/data/muSkillsAndClasses.ts');
  const { getWingEvoTier } = await import('/src/game/worldPhysicsMath.ts');
  const library = await (await fetch('/mugroup/equipo.json')).json();
  const sampleNames = [...new Map(Object.entries(library.wings).map(([name, file]) => [file, name])).entries()];
  const f = engine.flyff;
  engine.setMode('character_select');
  let staticWings = 0, animatedWings = 0;
  for (const sex of ['male', 'female']) {
    const equipment = getStarterItemsForMuClass('fixture', 'Fixture', 'DL').filter(i => i.slot !== 'wings');
    for (const [file, name] of sampleNames) {
      const wing = { id: 'fixture-wing', name, slot: 'wings', category: 'wings', isEquipped: true, evoTier: getWingEvoTier(name) };
      await engine.syncHeroAppearance('DL', [...equipment, wing], sex);
      const actor = f.actor, mount = actor.wingsNode;
      assert(mount.parent.name.startsWith('Bip02 Spine'), 'Missing back attachment for ' + sex);
      const meshes = actor.outfit.meshes.filter(m => m.name.startsWith('equip_wings_') && m.isEnabled());
      assert(meshes.length && meshes.every(m => m.name.includes(file)), 'Wrong wings equipped: ' + name);
      const rotation = mount.rotation.asArray(), origin = mount.position.asArray();
      const positions = meshes[0].getVerticesData('position').slice();
      for (let frame = 0; frame < 12; frame++) actor.update(1 / 60, { moving: true, hovering: true, externalAirPhase: 'grounded' });
      assert(mount.rotation.asArray().every((v, i) => v === rotation[i]), 'Flap rotated the entire attachment');
      assert(mount.position.asArray().every((v, i) => v === origin[i]), 'Flap moved the attachment');
      assert(actor.clip === 'idle', 'Played the ground run clip while floating');
      const running = actor.scene.animationGroups.filter(g => /^wing/i.test(g.name) && g.isPlaying);
      if (file.startsWith('equipo/')) {
        assert(!running.length, 'Hidden native wing animation is still playing');
        assert(meshes[0].getVerticesData('position').some((v, i) => Math.abs(v - positions[i]) > 0.005), 'Missing separate wing motion');
        staticWings++;
      } else {
        assert(!actor.wingFlex && running.length === 1, 'Expected only the equipped native wing to animate');
        animatedWings++;
      }
    }
    await engine.syncHeroAppearance('DL', equipment, sex);
    assert(!f.actor.wingFlex && !f.actor.wingsNode.isEnabled(), 'Unequipped wings kept animating visibly');
  }
  return { staticWings, animatedWings };
})()
