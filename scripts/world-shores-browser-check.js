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
  for (const [i,a] of anchors.entries()) for (const b of anchors.slice(i+1))
    if (Math.hypot(a.homeX-b.homeX,a.homeZ-b.homeZ)<124) throw Error('Campamentos demasiado próximos.');
  return {monsters:monsters.length, camps:anchors.length, referenceCamps:exact.length};
})()
