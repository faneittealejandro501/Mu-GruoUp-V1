import library from '../../public/mugroup/equipo.json';
import { artisanArmor, setArmament } from '../data/artisanEquipment';
import type { ItemSlot } from '../types/game';
import { useState } from 'react';
import { Gem, PawPrint, Sword, Shield, Shirt, HardHat, Hand, Footprints } from 'lucide-react';

export function ItemPortrait({item,sex,large=false}: {item:{name:string;slot:ItemSlot;setName?:string}; sex:'male'|'female';large?:boolean}) {
  const slot=item.slot, set=artisanArmor(item.setName)?.base ?? item.setName;
  const file = setArmament(item.name) || (library.weapons as Record<string,string>)[item.name]
    || (library.wings as Record<string,string>)[item.name]
    || (slot === 'wings' ? 'wing_mugroup_feather.glb' : undefined);
  const armor = ['armor','pants','helm','gloves','boots'].includes(slot) && set
    ? (library.sets as Record<string, Record<string,string>>)[set]?.[sex] : undefined;
  const key=(file || armor)?.split('/').pop()?.replace(/\.glb$/,'');
  const src = key && `./mugroup/ui/items/${key}${armor && !file?'-'+slot:''}.webp`;
  const [missing,setMissing] = useState<string>();
  const size = large ? 'w-20 h-20' : 'w-9 h-9';
  if (src && missing !== src) return <img loading="lazy" alt="" onError={()=>setMissing(src)}
    className={size + " object-contain pointer-events-none drop-shadow-md"} src={src} />;
  const Icon=slot==='pet'?PawPrint:slot==='weapon'?Sword:slot==='shield'?Shield:slot==='helm'?HardHat:
    slot==='armor'||slot==='pants'?Shirt:slot==='gloves'?Hand:slot==='boots'?Footprints:Gem;
  return <Icon className={(large ? 'w-12 h-12' : 'w-6 h-6') + ' text-amber-200'} aria-hidden="true"/>;
}
