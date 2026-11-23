import type { HeroClass } from '../../types/game';

// One local effect and sound pair per class skill.
export const RECIPES: Record<HeroClass, Array<[effect: string, sound: string]>> = {
  DK: [
    ['sfx_hitsword01', 'hit_sword'],
    ['mercenary_keenwheel', 'spin'],
    ['sfx_sklacrbowaimed01', 'arrow'],
    ['sfx_sklacrbowarrowrain01', 'arrowrain'],
    ['mercenary_protection', 'buff'],
    ['sfx_sklmeroneguillo01', 'slash'],
  ],
  DW: [
    ['sfx_sklpsypsychicbomb01', 'hit_magic'],
    ['sfx_sklpsydemonolgy01', 'dark'],
    ['sfx_sklpsysatanolgy01', 'soul'],
    ['sfx_sklmagmaglgtref01', 'lightning'],
    ['sfx_sklacrdefsupport01', 'potion'],
    ['sfx_sklpsymaximumcrisis01', 'cast_fire'],
  ],
  ELF: [
    ['mercenary_splmash', 'swing'],
    ['sfx_sklmerfury01', 'stomp'],
    ['sfx_sklmagswordwind01', 'wind'],
    ['sfx_sklassheahealing01', 'heal'],
    ['guardian-rain', 'equip_armor'],
    ['sfx_sklmerimpowe01', 'levelup'],
  ],
  DL: [
    ['sfx_hitbow01', 'hit_bow'],
    ['harlequin-rebound', 'attack_male'],
    ['harlequin-fire', 'fire'],
    ['harlequin-shadow', 'hurt_male'],
    ['sfx_sklmerbloody01', 'rage'],
    ['sfx_sklacrbowautoshot01', 'attack_female'],
  ],
  MG: [
    ['sfx_hitwand01', 'hurt_female'],
    ['sfx_sklmagfireboomerang01', 'land'],
    ['magician_firebomb', 'death_male'],
    ['sfx_sklelemullgtstm01', 'death_female'],
    ['sfx_sklelewatcasting01', 'ice'],
    ['sfx_sklelefirfirbrd01', 'firebird'],
  ],
};
