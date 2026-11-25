import library from '../../public/mugroup/equipo.json';
import { artisanArmor, setArmament } from '../data/artisanEquipment';
import type { ItemSlot } from '../types/game';
import { Gem, PawPrint, Sword, Shield } from 'lucide-react';

export function ItemPortrait({item,sex}: {item:{name:string;slot:ItemSlot;setName?:string}; sex:'male'|'female'}) {
  const slot=item.slot, set=artisanArmor(item.setName)?.base ?? item.setName;
  const file = setArmament(item.name) || (library.weapons as Record<string,string>)[item.name]
    || (library.wings as Record<string,string>)[item.name]
    || (slot === 'wings' ? 'wing_mugroup_feather.glb' : undefined);
  const armor = ['armor','pants','helm','gloves','boots'].includes(slot) && set
    ? (library.sets as Record<string, Record<string,string>>)[set]?.[sex] : undefined;
  const key=(file || armor)?.split('/').pop()?.replace(/\.glb$/,'');
  if (key) return <img loading="lazy" alt="" className="w-9 h-9 object-contain pointer-events-none drop-shadow-md" src={`./mugroup/ui/items/${key}${armor && !file?'-'+slot:''}.webp`} />;
  const Icon=slot==='pet'?PawPrint:slot==='weapon'?Sword:slot==='shield'?Shield:Gem;
  return <Icon className="w-6 h-6 text-amber-200" aria-hidden="true"/>;
}
