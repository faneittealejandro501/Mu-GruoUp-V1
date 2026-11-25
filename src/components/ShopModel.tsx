import { useEffect, useRef, useState } from 'react';
import { ArcRotateCamera, Color4, Engine, HemisphericLight, Scene, SceneLoader, Vector3 } from '@babylonjs/core';
import '@babylonjs/loaders';
import { buildArtisanWeapon } from '../game/content/ArtisanWeapon';
import { applyEnhanceGlow } from '../game/content/EquipmentAppearance';
import { artisanWeapon } from '../data/artisanEquipment';
import type { ShopItemDef } from '../types/game';

export function ShopModel({item,file}:{item:ShopItemDef;file?:string}) {
  const ref=useRef<HTMLCanvasElement>(null), [failed,setFailed]=useState(false);
  useEffect(()=>{
    const canvas=ref.current;
    if (!canvas) return;
    let engine:Engine;
    try { engine=new Engine(canvas,true,{stencil:true}); } catch { setFailed(true); return; }
    const scene=new Scene(engine);
    scene.clearColor=new Color4(.04,.06,.09,1);
    const camera=new ArcRotateCamera('preview',-Math.PI/2,1.25,3,Vector3.Zero(),scene);
    new HemisphericLight('shop-light',new Vector3(.2,1,-.6),scene).intensity=1.4;
    const setup=async()=>{
      if (file) {
        const path='./mugroup/'+file, i=path.lastIndexOf('/')+1;
        const container=await SceneLoader.LoadAssetContainerAsync(path.slice(0,i),path.slice(i),scene);
        if (scene.isDisposed) { container.dispose(); return; }
        container.addAllToScene();
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) container.animationGroups[0]?.start(true);
      } else {
        const spec=artisanWeapon(item.name);
        if (!spec) throw Error('Modelo no disponible');
        buildArtisanWeapon(scene,spec);
      }
      for (const mesh of scene.meshes) if(mesh.getTotalVertices()) applyEnhanceGlow(mesh,item.enhanceLevel);
      const {min,max}=scene.getWorldExtends(mesh=>mesh.getTotalVertices()>0);
      const radius=Math.max(.01,Vector3.Distance(min,max)*1.65);
      camera.setTarget(Vector3.Center(min,max)); camera.radius=radius;
      camera.minZ=radius*.001; camera.maxZ=radius*12; camera.lowerRadiusLimit=radius*.35; camera.upperRadiusLimit=radius*3;
      camera.panningSensibility=0; camera.attachControl(canvas,true);
      engine.runRenderLoop(()=>scene.render());
    };
    void setup().catch(()=>{if(!scene.isDisposed)setFailed(true)});
    return ()=>{scene.dispose();engine.dispose()};
  },[file,item.id,item.name,item.enhanceLevel]);
  return failed ? <p className="text-xs text-slate-300">La vista 3D requiere WebGL. El retrato del objeto sigue disponible.</p> :
    <canvas aria-label={'Vista 3D de '+item.name} ref={ref} className="w-full h-40 touch-none rounded" />;
}
