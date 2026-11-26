// Open the DEV Preview with ?headless=1, then run:
// coderabbit-agent-browser eval --stdin < scripts/world-shores-browser-check.js
(async()=>{
  const engine=window.__muEngine;
  await engine.loadMap('flaris');
  const monsters=engine.monsters;
  const groups=monsters.filter(m=>m.camp!==undefined);
  const anchors=groups.filter((m,i)=>i===0 || groups[i-1].camp!==m.camp);
  const reference=(await import('/src/data/madrigalSpawns.json')).default;
  const exact=anchors.filter(m=>reference.some(s=>s.x===m.homeX && s.z===m.homeZ &&
    s.level===m.scaledLevel && s.name===m.def.name && m.glbFile.endsWith('/'+s.model+'.glb')));
  if (!exact.length || groups.length!==anchors.length*10) throw Error('Faltan campamentos de referencia o grupos incompletos.');
  if (monsters.some(m=>!engine.flyff.world.isHuntingLand(m.homeX,m.homeZ)) || engine.flyff.world.isHuntingLand(50,50))
    throw Error('Hay monstruos en el mar.');
  for (const m of groups) {
    if (!reference.some(s=>s.name===m.def.name && s.level===m.scaledLevel &&
      m.glbFile.endsWith('/'+s.model+'.glb') && ((s.x===m.homeX && s.z===m.homeZ) ||
      (m.homeX>=s.bounds[0] && m.homeX<=s.bounds[2] && m.homeZ>=s.bounds[1] && m.homeZ<=s.bounds[3]))))
      throw Error('Monstruo fuera de su zona de referencia: '+m.def.name);
  }
  return {monsters:monsters.length, camps:anchors.length, referenceCamps:exact.length};
})()
