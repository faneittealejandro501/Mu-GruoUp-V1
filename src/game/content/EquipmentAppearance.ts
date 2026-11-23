import { artisanArmor, artisanWeapon, AURORA_WING_NAME } from '../../data/artisanEquipment';
import { buildArtisanWeapon } from './ArtisanWeapon';
import {
  AbstractMesh,
  AnimationGroup,
  AssetContainer,
  Color3,
  Color4,
  Material,
  Matrix,
  Mesh,
  Node,
  ParticleSystem,
  PointLight,
  PBRMaterial,
  Quaternion,
  Scene,
  SceneLoader,
  Skeleton,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import type { MuItem } from '../../types/game';
import { getAdminConfigSync } from '../../services/adminConfigService';

export interface EquipmentLibrary {
  weapons: Record<string, string>;
  wings: Record<string, string>;
  sets: Record<string, { male: string; female: string }>;
}

export interface GearSlotState {
  slot: string;
  equipped: boolean;
  file?: string;
  itemName?: string;
  meshes: AbstractMesh[];
  containers: AssetContainer[];
}

export interface FlyffActorLike {
  config: {
    id: string;
    classId: string;
    sex: 'male' | 'female';
  };
  root: TransformNode;
  outfit: {
    root: Node | null;
    meshes: AbstractMesh[];
    skeletons: Skeleton[];
    nodes: Node[];
  };
  body: {
    meshes: AbstractMesh[];
  };
  gear: Record<string, GearSlotState>;
  wingAnimations: AnimationGroup[];
  wingSocket: TransformNode | null;
  wingLight: PointLight | null;
  wingParticles: ParticleSystem | null;
  enhanceParticles: ParticleSystem[];
  wingScaleMultiplier: number;
  resetWingMode(): void;
  playWingAnimation(mode: 'stand' | 'walk'): void;
  detach(slot: string): void;
  equip(slot: string, enabled: boolean): void;
}

const ARMOR_SLOTS = ['torso', 'helmet', 'pants', 'hands', 'feet'] as const;
const MU_TO_FLYFF_SLOT: Record<string, string> = {
  armor: 'torso',
  helm: 'helmet',
  pants: 'pants',
  gloves: 'hands',
  boots: 'feet',
  weapon: 'weapon',
  shield: 'offhand',
  wings: 'wings',
};

const BODY_MESH_MAP: Record<string, string[]> = {
  torso: ['body_torso'],
  pants: ['body_legs'],
  hands: ['body_hands'],
  feet: ['body_feet'],
};

let cachedLibrary: EquipmentLibrary | null = null;

export async function loadEquipmentLibrary(): Promise<EquipmentLibrary> {
  if (cachedLibrary) return cachedLibrary;
  try {
    const res = await fetch('./mugroup/equipo.json');
    if (res.ok) {
      cachedLibrary = (await res.json()) as EquipmentLibrary;
      return cachedLibrary;
    }
  } catch {
    // fallback below
  }
  return { weapons: {}, wings: {}, sets: {} };
}

function resolveMugroupUrl(relPath: string): { rootUrl: string; fileName: string } {
  const full = new URL(relPath, new URL('./mugroup/', document.baseURI)).href;
  const idx = full.lastIndexOf('/');
  return {
    rootUrl: full.slice(0, idx + 1),
    fileName: full.slice(idx + 1),
  };
}

export function detectWingEvoTier(wingItem?: MuItem | null): 1 | 2 | 3 | 4 {
  if (!wingItem) return 1;
  const name = `${wingItem.name || ''} ${wingItem.excellentOpt || ''}`.toLowerCase();
  if (/evo\s*4|eterna|emperor|maldita|curse|monarch|space time|storm|illusion|hurricane|\+13/.test(name)) {
    return 4;
  }
  if (/evo\s*3|profeta|dragon mu|darkness/.test(name)) {
    return 3;
  }
  if (/evo\s*2|lv\.?\s*2|celestiales|espíritu élfico|wings of dragon|wings of soul|wings of spirit|cape of lord|\+9/.test(name)) {
    return 2;
  }
  if (wingItem.enhanceLevel >= 12) return 4;
  if (wingItem.enhanceLevel >= 9) return 3;
  if (wingItem.enhanceLevel >= 6) return 2;
  return 1;
}

/**
 * Progressive wingspan scale matching prompt rules:
 * Evo 1 = 1.0x reference size, Evo 2 = 2.0x Evo 1, Evo 3 = 3.0x Evo 2 (6.0x Evo 1), Evo 4 > Evo 3 (7.5x Evo 1).
 */
export function getWingEvoScaleFactor(tier: 1 | 2 | 3 | 4): number {
  switch (tier) {
    case 1:
      return 1.0;
    case 2:
      return 2.0;
    case 3:
      return 6.0;
    case 4:
      return 7.5;
  }
}

function getEnhanceVisualSpec(enhanceLevel: number): {
  emissive: number;
  specular: number;
  sparkleRate: number;
  color: Color3;
} {
  const adminOpts = getAdminConfigSync()['item-options'];
  const tiers = Array.isArray(adminOpts?.glowByEnhanceLevel) ? adminOpts.glowByEnhanceLevel : [];
  for (const t of tiers) {
    if (enhanceLevel >= (t.minLevel ?? 0) && enhanceLevel <= (t.maxLevel ?? 15)) {
      return {
        emissive: Number(t.emissive ?? 0),
        specular: Number(t.specular ?? 0.2),
        sparkleRate: Number(t.sparkleRate ?? 0),
        color: Color3.FromHexString(t.color || '#fbbf24'),
      };
    }
  }
  if (enhanceLevel >= 12) return { emissive: 0.85, specular: 1.0, sparkleRate: 24, color: Color3.FromHexString('#a855f7') };
  if (enhanceLevel >= 9) return { emissive: 0.56, specular: 0.88, sparkleRate: 14, color: Color3.FromHexString('#fbbf24') };
  if (enhanceLevel >= 6) return { emissive: 0.34, specular: 0.68, sparkleRate: 7, color: Color3.FromHexString('#f59e0b') };
  if (enhanceLevel >= 3) return { emissive: 0.16, specular: 0.42, sparkleRate: 3, color: Color3.FromHexString('#38bdf8') };
  return { emissive: 0.02, specular: 0.15, sparkleRate: 0, color: Color3.FromHexString('#cbd5e1') };
}

function applyEnhanceGlow(mesh: AbstractMesh, enhanceLevel: number, color?: number): void {
  if ((enhanceLevel < 3 && color === undefined) || !mesh.material) return;
  const spec = getEnhanceVisualSpec(enhanceLevel);
  const applyToMat = (mat: Material): Material => {
    const cloned = mat.clone(`${mat.name}_enh_${enhanceLevel}_${Math.random().toString(36).slice(2, 6)}`);
    if (!cloned) return mat;
    if (color !== undefined) {
      const tint = Color3.FromHexString('#' + color.toString(16).padStart(6, '0'));
      if (cloned instanceof PBRMaterial) cloned.albedoColor = Color3.Lerp(Color3.White(), tint, 0.65);
      if (cloned instanceof StandardMaterial) cloned.diffuseColor = Color3.Lerp(Color3.White(), tint, 0.65);
    }
    mesh.onDisposeObservable.addOnce(() => cloned.dispose(false, false));
    if ('emissiveColor' in cloned) {
      (cloned as StandardMaterial).emissiveColor = spec.color.scale(spec.emissive);
    }
    if ('specularColor' in cloned) {
      (cloned as StandardMaterial).specularColor = spec.color.scale(spec.specular);
    }
    return cloned;
  };
  mesh.material = applyToMat(mesh.material);
}

function splitTorsoAndPantsMesh(
  sourceMesh: Mesh,
  scene: Scene,
  waistY = 0.85,
): { torso: Mesh | null; pants: Mesh | null } {
  const pos = sourceMesh.getVerticesData(VertexBuffer.PositionKind);
  const idx = sourceMesh.getIndices();
  if (!pos || !idx || idx.length < 3) {
    return { torso: null, pants: null };
  }

  const normals = sourceMesh.getVerticesData(VertexBuffer.NormalKind);
  const uvs = sourceMesh.getVerticesData(VertexBuffer.UVKind);
  const mIndices = sourceMesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
  const mWeights = sourceMesh.getVerticesData(VertexBuffer.MatricesWeightsKind);

  const buildSubset = (name: string, pickUpper: boolean): Mesh | null => {
    const remap = new Map<number, number>();
    const outPos: number[] = [];
    const outNorm: number[] = [];
    const outUv: number[] = [];
    const outMatIdx: number[] = [];
    const outMatWt: number[] = [];
    const outIdx: number[] = [];

    const addVert = (orig: number): number => {
      const existing = remap.get(orig);
      if (existing !== undefined) return existing;
      const ni = remap.size;
      remap.set(orig, ni);
      outPos.push(pos[orig * 3], pos[orig * 3 + 1], pos[orig * 3 + 2]);
      if (normals) outNorm.push(normals[orig * 3], normals[orig * 3 + 1], normals[orig * 3 + 2]);
      if (uvs) outUv.push(uvs[orig * 2], uvs[orig * 2 + 1]);
      if (mIndices) {
        outMatIdx.push(
          mIndices[orig * 4],
          mIndices[orig * 4 + 1],
          mIndices[orig * 4 + 2],
          mIndices[orig * 4 + 3],
        );
      }
      if (mWeights) {
        outMatWt.push(
          mWeights[orig * 4],
          mWeights[orig * 4 + 1],
          mWeights[orig * 4 + 2],
          mWeights[orig * 4 + 3],
        );
      }
      return ni;
    };

    for (let i = 0; i + 2 < idx.length; i += 3) {
      const a = idx[i];
      const b = idx[i + 1];
      const c = idx[i + 2];
      const cy = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3;
      const matches = pickUpper ? cy >= waistY : cy < waistY;
      if (!matches) continue;
      outIdx.push(addVert(a), addVert(b), addVert(c));
    }

    if (outIdx.length === 0) return null;

    const mesh = new Mesh(name, scene);
    const vdata = new VertexData();
    vdata.positions = new Float32Array(outPos);
    if (normals && outNorm.length === outPos.length) vdata.normals = new Float32Array(outNorm);
    if (uvs && outUv.length > 0) vdata.uvs = new Float32Array(outUv);
    vdata.indices = outIdx;
    vdata.applyToMesh(mesh, false);

    if (mIndices && outMatIdx.length > 0) {
      mesh.setVerticesData(VertexBuffer.MatricesIndicesKind, outMatIdx, false, 4);
    }
    if (mWeights && outMatWt.length > 0) {
      mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, outMatWt, false, 4);
    }
    mesh.material = sourceMesh.material;
    mesh.skeleton = sourceMesh.skeleton;
    mesh.parent = sourceMesh.parent;
    mesh.position.copyFrom(sourceMesh.position);
    if (sourceMesh.rotationQuaternion) {
      mesh.rotationQuaternion = sourceMesh.rotationQuaternion.clone();
    } else {
      mesh.rotation.copyFrom(sourceMesh.rotation);
    }
    mesh.scaling.copyFrom(sourceMesh.scaling);
    mesh.isPickable = false;
    return mesh;
  };

  return {
    torso: buildSubset(`equip_torso_split_${Date.now()}`, true),
    pants: buildSubset(`equip_pants_split_${Date.now()}`, false),
  };
}

export class EquipmentAppearance {
  private scene: Scene;
  private reqCounter = 0;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public async apply(actor: FlyffActorLike, equippedItems: MuItem[]): Promise<void> {
    const token = ++this.reqCounter;
    const lib = await loadEquipmentLibrary();
    if (token !== this.reqCounter || this.scene.isDisposed) return;

    const sex = actor.config.sex || 'male';

    const slotItems = new Map<string, MuItem>();
    for (const item of equippedItems) {
      if (!item.isEquipped) continue;
      const flyffSlot = MU_TO_FLYFF_SLOT[item.slot];
      if (flyffSlot) {
        slotItems.set(flyffSlot, item);
      }
    }

    const setFilesToLoad = new Map<string, { file: string; slots: string[]; maxEnhance: number }>();
    for (const slot of ARMOR_SLOTS) {
      const it = slotItems.get(slot);
      if (!it) continue;
      const setEntry = lib.sets?.[artisanArmor(it.setName)?.base ?? it.setName];
      const file = setEntry?.[sex];
      if (!file) continue;
      const existing = setFilesToLoad.get(file);
      if (existing) {
        existing.slots.push(slot);
        existing.maxEnhance = Math.max(existing.maxEnhance, it.enhanceLevel || 0);
      } else {
        setFilesToLoad.set(file, { file, slots: [slot], maxEnhance: it.enhanceLevel || 0 });
      }
    }

    const setContainers = new Map<string, AssetContainer>();
    const weaponItem = slotItems.get('weapon');
    const offhandItem = slotItems.get('offhand');
    const wingItem = slotItems.get('wings');

    const weaponFile = weaponItem ? lib.weapons?.[weaponItem.name] : undefined;
    const artisan = artisanWeapon(weaponItem?.name);
    const offhandFile = offhandItem ? lib.weapons?.[offhandItem.name] : undefined;
    const wingFile = wingItem
      ? lib.wings?.[wingItem.name] ?? getAdminConfigSync().items.wingCatalog?.find((w: { name: string }) => w.name === wingItem.name)?.glb ?? (wingItem.name === AURORA_WING_NAME ? 'equipo/wing_mugroup_feather.glb' : undefined)
      : undefined;

    const loadContainer = async (rel: string): Promise<AssetContainer | null> => {
      try {
        const { rootUrl, fileName } = resolveMugroupUrl(rel);
        return await SceneLoader.LoadAssetContainerAsync(rootUrl, fileName, this.scene);
      } catch {
        return null;
      }
    };

    const setLoadTasks = Array.from(setFilesToLoad.keys()).map(async (file) => {
      const container = await loadContainer(file);
      if (container) setContainers.set(file, container);
    });

    const [weaponContainer, offhandContainer, wingContainer] = await Promise.all([
      weaponFile ? loadContainer(weaponFile) : Promise.resolve(null),
      offhandFile ? loadContainer(offhandFile) : Promise.resolve(null),
      wingFile ? loadContainer(wingFile) : Promise.resolve(null),
      ...setLoadTasks,
    ]);

    if (token !== this.reqCounter || this.scene.isDisposed) {
      for (const c of setContainers.values()) c.dispose();
      weaponContainer?.dispose();
      offhandContainer?.dispose();
      wingContainer?.dispose();
      return;
    }

    this.clearDynamicGear(actor);

    const outfitRoot = actor.outfit.root;
    const outfitSkeleton = actor.outfit.skeletons[0] || null;
    const findNode = (name: string): Node | null =>
      actor.outfit.nodes.find((n) => n.name === name) || null;

    const headNode = findNode('Bip02 Head') || outfitRoot;
    const rightSocket = findNode('socket_rightHand') || findNode('Bip02 R Hand') || outfitRoot;
    const shieldSocket = findNode('socket_shield') || findNode('socket_leftHand') || findNode('Bip02 L ForeArm') || outfitRoot;
    const leftSocket = findNode('socket_leftHand') || shieldSocket;
    const spineNode = findNode('Bip02 Spine2') || findNode('Bip02 Spine1') || findNode('Bip02 Spine') || outfitRoot;

    // Disable native equipment slots first (keep head/hair)
    for (const m of actor.outfit.meshes) {
      if (m.name === '__root__') continue;
      if (m.name.startsWith('equip_head_') || m.name.startsWith('equip_hair_')) {
        m.setEnabled(true);
        continue;
      }
      m.setEnabled(false);
    }

    // Install armor set meshes per requested slot
    for (const [file, info] of setFilesToLoad.entries()) {
      const container = setContainers.get(file);
      if (!container) continue;
      container.addAllToScene();

      const wantTorso = info.slots.includes('torso');
      const wantPants = info.slots.includes('pants');
      const wantHelmet = info.slots.includes('helmet');
      const wantHands = info.slots.includes('hands');
      const wantFeet = info.slots.includes('feet');

      for (const rawMesh of [...container.meshes]) {
        if (rawMesh.name === '__root__') continue;

        if (rawMesh.name.startsWith('equip_torso_')) {
          if ((wantTorso || wantPants) && rawMesh instanceof Mesh) {
            const { torso, pants } = splitTorsoAndPantsMesh(rawMesh, this.scene, 0.85);
            const torsoEnh = slotItems.get('torso')?.enhanceLevel ?? 0;
            const pantsEnh = slotItems.get('pants')?.enhanceLevel ?? 0;
            if (torso && wantTorso) {
              torso.name = `equip_torso_set:${file}`;
              torso.parent = outfitRoot;
              torso.skeleton = outfitSkeleton;
              applyEnhanceGlow(torso, torsoEnh, artisanArmor(slotItems.get('torso')?.setName)?.color);
              torso.metadata = { ...(torso.metadata || {}), equipmentFile: file, dynamicGear: true, gearSlot: 'torso' };
              torso.setEnabled(true);
              actor.outfit.meshes.push(torso);
              actor.gear.torso.meshes.push(torso);
              actor.gear.torso.equipped = true;
              actor.gear.torso.file = file;
            } else {
              torso?.dispose(false, false);
            }
            if (pants && wantPants) {
              pants.name = `equip_pants_set:${file}`;
              pants.parent = outfitRoot;
              pants.skeleton = outfitSkeleton;
              applyEnhanceGlow(pants, pantsEnh, artisanArmor(slotItems.get('pants')?.setName)?.color);
              pants.metadata = { ...(pants.metadata || {}), equipmentFile: file, dynamicGear: true, gearSlot: 'pants' };
              pants.setEnabled(true);
              actor.outfit.meshes.push(pants);
              actor.gear.pants.meshes.push(pants);
              actor.gear.pants.equipped = true;
              actor.gear.pants.file = file;
            } else {
              pants?.dispose(false, false);
            }
          }
          rawMesh.setEnabled(false);
          rawMesh.dispose(false, false);
          continue;
        }

        let targetSlot: string | null = null;
        if (rawMesh.name.startsWith('equip_helmet_') && wantHelmet) targetSlot = 'helmet';
        else if (rawMesh.name.startsWith('equip_hands_') && wantHands) targetSlot = 'hands';
        else if (rawMesh.name.startsWith('equip_feet_') && wantFeet) targetSlot = 'feet';

        if (!targetSlot) {
          rawMesh.setEnabled(false);
          rawMesh.dispose(false, false);
          continue;
        }

        const slotEnh = slotItems.get(targetSlot)?.enhanceLevel ?? 0;
        rawMesh.name = `equip_${targetSlot}_set:${file}`;
        if (targetSlot === 'helmet') {
          rawMesh.parent = headNode;
          rawMesh.position.set(0, 0, 0);
          rawMesh.rotationQuaternion = null;
          rawMesh.rotation.set(0, 0, 0);
          rawMesh.scaling.set(1, 1, 1);
          rawMesh.skeleton = null;
        } else {
          rawMesh.parent = outfitRoot;
          rawMesh.skeleton = outfitSkeleton;
        }
        applyEnhanceGlow(rawMesh, slotEnh, artisanArmor(slotItems.get(targetSlot)?.setName)?.color);
        rawMesh.metadata = { ...(rawMesh.metadata || {}), equipmentFile: file, dynamicGear: true, gearSlot: targetSlot };
        rawMesh.isPickable = false;
        rawMesh.setEnabled(true);
        actor.outfit.meshes.push(rawMesh);
        actor.gear[targetSlot].meshes.push(rawMesh);
        actor.gear[targetSlot].equipped = true;
        actor.gear[targetSlot].file = file;
      }

      for (const slot of info.slots) {
        if (!actor.gear[slot].containers.includes(container)) {
          actor.gear[slot].containers.push(container);
        }
      }
      for (const m of [...container.meshes]) {
        if (m.name === '__root__') m.setEnabled(false);
      }
    }

    if (artisan && rightSocket) {
      const mesh = buildArtisanWeapon(this.scene, artisan);
      mesh.parent = artisan.classType === 'ELF' ? leftSocket : rightSocket;
      mesh.isPickable = false;
      const material = mesh.material;
      mesh.onDisposeObservable.addOnce(() => material?.dispose());
      mesh.metadata = { dynamicGear: true, gearSlot: 'weapon' };
      applyEnhanceGlow(mesh, weaponItem?.enhanceLevel ?? 0);
      actor.outfit.meshes.push(mesh);
      actor.gear.weapon.meshes.push(mesh);
      actor.gear.weapon.equipped = true;
    }

    // Attach weapon cleanly with calibrated grip offset/angle so staves/swords/bows point forward-up and never pierce legs
    if (weaponContainer && weaponFile) {
      const container: AssetContainer = weaponContainer;
      container.addAllToScene();
      const tag = `weapon:${weaponFile}`;
      const enh = weaponItem?.enhanceLevel ?? 0;
      const isBow = /bow/i.test(weaponFile);
      const isStaff = /sta/i.test(weaponFile);
      const isWand = /wan/i.test(weaponFile);
      const targetHand = isBow ? leftSocket : rightSocket;

      actor.root.computeWorldMatrix(true);
      let invHandToActorRot = Quaternion.Identity();
      if (targetHand instanceof TransformNode || targetHand instanceof AbstractMesh) {
        targetHand.computeWorldMatrix(true);
        const relMat = Matrix.Invert(targetHand.getWorldMatrix()).multiply(actor.root.getWorldMatrix());
        const rot = new Quaternion();
        relMat.decompose(undefined, rot, undefined);
        invHandToActorRot = rot;
      }

      const gripNode = new TransformNode(`weapon_grip_${Date.now()}`, this.scene);
      gripNode.parent = targetHand;
      gripNode.position.set(0, 0, 0);
      gripNode.rotationQuaternion = invHandToActorRot;

      const weaponAlign = new TransformNode(`weapon_align_${Date.now()}`, this.scene);
      weaponAlign.parent = gripNode;
      if (isBow) {
        weaponAlign.position.set(-0.04, 0.04, 0.02);
        weaponAlign.rotation.set(0, 0, 0);
      } else if (isStaff) {
        // Point staff tip forward (+Z) and upward (+Y), holding bottom third in palm
        weaponAlign.position.set(0.10, 0.06, 0.36);
        weaponAlign.rotation.set(-0.45, -Math.PI / 2, 0);
      } else if (isWand) {
        weaponAlign.position.set(0.08, 0.04, 0.22);
        weaponAlign.rotation.set(-0.35, -Math.PI / 2, 0);
      } else {
        // Swords/axes angled cleanly forward and upward from right palm
        weaponAlign.position.set(0.08, 0.04, 0.14);
        weaponAlign.rotation.set(-0.35, -Math.PI / 2, 0);
      }

      let primaryMesh: AbstractMesh | null = null;
      for (const m of container.meshes) {
        if (m.name === '__root__') {
          m.setEnabled(false);
          continue;
        }
        m.name = `equip_weapon_${tag}`;
        m.parent = weaponAlign;
        m.position.set(0, 0, 0);
        m.rotationQuaternion = null;
        m.rotation.set(0, 0, 0);
        m.scaling.set(1, 1, 1);
        m.skeleton = null;
        applyEnhanceGlow(m, enh);
        m.isPickable = false;
        m.metadata = { ...(m.metadata || {}), equipmentFile: tag, dynamicGear: true, gearSlot: 'weapon', gripNode };
        m.setEnabled(true);
        actor.outfit.meshes.push(m);
        actor.gear.weapon.meshes.push(m);
        if (!primaryMesh) primaryMesh = m;
      }

      if (primaryMesh && enh >= 6) {
        this.attachItemSparkles(actor, weaponAlign, enh);
      }

      actor.gear.weapon.equipped = true;
      actor.gear.weapon.file = tag;
      actor.gear.weapon.containers.push(container);
    } else if (weaponItem) {
      for (const m of actor.outfit.meshes) {
        if (m.name.startsWith('equip_weapon_')) {
          m.setEnabled(true);
          actor.gear.weapon.meshes.push(m);
        }
      }
      actor.gear.weapon.equipped = true;
    }

    // Attach offhand shield or offhand weapon
    if (offhandContainer && offhandFile) {
      const container: AssetContainer = offhandContainer;
      container.addAllToScene();
      const tag = `offhand:${offhandFile}`;
      const enh = offhandItem?.enhanceLevel ?? 0;
      const isLeftWeapon = /Izq|Espada|Daga/i.test(offhandItem?.name || '');
      const targetSocket = isLeftWeapon ? leftSocket : shieldSocket;
      for (const m of container.meshes) {
        if (m.name === '__root__') {
          m.setEnabled(false);
          continue;
        }
        m.name = `equip_offhand_${tag}`;
        m.parent = targetSocket;
        m.position.set(0, 0, 0);
        m.rotationQuaternion = null;
        m.rotation.set(0, isLeftWeapon ? -0.52 : 0, 0);
        m.scaling.set(1, 1, 1);
        m.skeleton = null;
        applyEnhanceGlow(m, enh);
        m.isPickable = false;
        m.metadata = { ...(m.metadata || {}), equipmentFile: tag, dynamicGear: true, gearSlot: 'offhand' };
        m.setEnabled(true);
        actor.outfit.meshes.push(m);
        actor.gear.offhand.meshes.push(m);
      }
      actor.gear.offhand.equipped = true;
      actor.gear.offhand.file = tag;
      actor.gear.offhand.containers.push(container);
    }

    // Attach wings calibrated flush to upper back with skeleton animations, Evo 1-4 scale, PointLight & aura
    if (wingContainer && wingFile && spineNode) {
      const container: AssetContainer = wingContainer;
      container.addAllToScene();
      const tag = `wings:${wingFile}`;
      const evoTier = detectWingEvoTier(wingItem);
      const evoFactor = getWingEvoScaleFactor(evoTier);
      actor.wingScaleMultiplier = evoFactor;

      // Support large bone counts on OpenMU wings (up to 76 bones) safely across WebGL GPUs
      for (const sk of container.skeletons) {
        if (sk.bones.length > 28) {
          sk.useTextureToStoreBoneMatrices = true;
        }
      }

      // Calibrate spine bone rotation back into actor upright rest pose
      actor.root.computeWorldMatrix(true);
      let invSpineToActorRot = Quaternion.Identity();
      let localBackOffset = new Vector3(0, 0, -0.11);
      if (spineNode instanceof TransformNode || spineNode instanceof AbstractMesh) {
        spineNode.computeWorldMatrix(true);
        const spineWorld = spineNode.getWorldMatrix();
        const actorWorld = actor.root.getWorldMatrix();
        const relMat = actorWorld.multiply(Matrix.Invert(spineWorld));
        localBackOffset = Vector3.TransformNormal(localBackOffset, relMat);
        const rot = new Quaternion();
        relMat.decompose(undefined, rot, undefined);
        invSpineToActorRot = rot;
      }

      const wingSocket = new TransformNode(`wing_socket_${Date.now()}`, this.scene);
      wingSocket.parent = spineNode;
      // Anchor flush behind upper shoulder blades in upright actor coordinates
      wingSocket.position.copyFrom(localBackOffset);
      wingSocket.rotationQuaternion = invSpineToActorRot;
      actor.wingSocket = wingSocket;

      const isMuWing = wingFile.includes('wing_mu');
      const baseName = wingFile.split('/').pop() || wingFile;
      // Calibrated local alignment & measured deformed span per wing family so Evo 1 = ~1.50m wingspan
      let alignRot = new Vector3(0, 0, 0);
      let modelOffset = new Vector3(0, 0.12, -0.06);
      let rawAnimatedSpan = 1.5;

      if (baseName.startsWith('wing_mugroup_feather')) {
        alignRot = new Vector3(0, 0, 0);
        modelOffset = new Vector3(0, 0.12, -0.06);
        rawAnimatedSpan = 1.27;
      } else if (baseName.startsWith('wing_mugroup_angel')) {
        alignRot = new Vector3(0, 0, 0);
        modelOffset = new Vector3(0, 0.08, -0.04);
        rawAnimatedSpan = 3.57;
      } else if (baseName.startsWith('wing_mugroup_prophet')) {
        alignRot = new Vector3(0, 0, 0);
        modelOffset = new Vector3(0, -2.55, -0.72);
        rawAnimatedSpan = 4.27;
      } else if (baseName === 'wing_mu_fairy.glb') {
        alignRot = new Vector3(-Math.PI / 2, 0, 0);
        modelOffset = new Vector3(0, 0.18, -0.10);
        rawAnimatedSpan = 2.07;
      } else if (baseName === 'wing_mu_angel.glb') {
        alignRot = new Vector3(0, 0, 0);
        modelOffset = new Vector3(0, -0.85, -0.18);
        rawAnimatedSpan = 3.30;
      } else if (baseName === 'wing_mu_elf.glb') {
        alignRot = new Vector3(-0.35, 0, 0);
        modelOffset = new Vector3(0, 0.15, -0.05);
        rawAnimatedSpan = 4.62;
      } else if (isMuWing) {
        // OpenMU dragon / soul / dark / storm / eternal / emperor / curse wings extend along -X in glTF
        alignRot = new Vector3(0, Math.PI / 2, 0);
        modelOffset = new Vector3(0, 0.08, -0.06);
        if (baseName === 'wing_mu_dragon.glb') rawAnimatedSpan = 3.61;
        else if (baseName === 'wing_mu_soul.glb') rawAnimatedSpan = 2.55;
        else if (baseName === 'wing_mu_dark.glb') rawAnimatedSpan = 2.24;
        else if (baseName === 'wing_mu_storm.glb') rawAnimatedSpan = 1.50;
        else if (baseName === 'wing_mu_eternal.glb') rawAnimatedSpan = 4.00;
        else if (baseName === 'wing_mu_emperor.glb') rawAnimatedSpan = 2.41;
        else if (baseName === 'wing_mu_curse.glb') rawAnimatedSpan = 3.07;
        else rawAnimatedSpan = 2.60;
      }

      const normalizedBase = Math.min(1.35, Math.max(0.32, 1.50 / rawAnimatedSpan));
      const finalScale = normalizedBase * evoFactor;

      const wingBackAnchor = new TransformNode(`wing_back_anchor_${Date.now()}`, this.scene);
      wingBackAnchor.parent = wingSocket;
      wingBackAnchor.position.set(0, 0, 0);
      wingBackAnchor.scaling.set(finalScale, finalScale, finalScale);

      const wingAlign = new TransformNode(`wing_align_${Date.now()}`, this.scene);
      wingAlign.parent = wingBackAnchor;
      wingAlign.position.copyFrom(modelOffset);
      wingAlign.rotation.copyFrom(alignRot);

      const rootNode =
        container.meshes.find((m) => m.name === '__root__') ||
        container.transformNodes[0] ||
        null;
      if (rootNode) {
        rootNode.parent = wingAlign;
        if ('position' in rootNode && rootNode.position instanceof Vector3) {
          rootNode.position.set(0, 0, 0);
        }
        if ('rotationQuaternion' in rootNode) {
          (rootNode as TransformNode).rotationQuaternion = Quaternion.Identity();
        }
        if ('scaling' in rootNode && rootNode.scaling instanceof Vector3) {
          rootNode.scaling.set(1, 1, 1);
        }
      }

      for (const m of container.meshes) {
        if (m.name === '__root__') continue;
        if (!rootNode) {
          m.parent = wingAlign;
          m.scaling.set(1, 1, 1);
        }
        m.name = `equip_wings_${tag}`;
        m.isPickable = false;
        if (isMuWing && m.material && 'transparencyMode' in m.material) {
          const mat = m.material as StandardMaterial;
          mat.transparencyMode = 2;
          mat.alphaCutOff = 0.4;
          mat.backFaceCulling = false;
        } else if (m.material) {
          m.material.backFaceCulling = false;
        }
        applyEnhanceGlow(m, wingItem?.enhanceLevel ?? evoTier * 3);
        m.metadata = { ...(m.metadata || {}), equipmentFile: tag, dynamicGear: true, gearSlot: 'wings', evoTier };
        m.setEnabled(true);
        actor.outfit.meshes.push(m);
        actor.gear.wings.meshes.push(m);
      }

      actor.wingAnimations = [...container.animationGroups];
      actor.resetWingMode();
      actor.gear.wings.equipped = true;
      actor.gear.wings.file = tag;
      actor.gear.wings.itemName = wingItem?.name;
      actor.gear.wings.containers.push(container);
      actor.playWingAnimation('stand');

      this.attachWingEffects(actor, wingSocket, evoTier);
    }

    // Synchronize underlying body meshes
    for (const [slot, bodyPrefixes] of Object.entries(BODY_MESH_MAP)) {
      const showBody = !actor.gear[slot]?.equipped;
      for (const bm of actor.body.meshes) {
        if (bodyPrefixes.some((p) => bm.name.startsWith(p))) {
          bm.setEnabled(showBody);
        }
      }
    }
  }

  private attachWingEffects(actor: FlyffActorLike, wingSocket: TransformNode, evoTier: 1 | 2 | 3 | 4): void {
    const adminOpts = getAdminConfigSync()['item-options'];
    const tierColors: Record<1 | 2 | 3 | 4, Color3> = {
      1: Color3.FromHexString('#7dd3fc'),
      2: Color3.FromHexString('#34d399'),
      3: Color3.FromHexString('#fbbf24'),
      4: Color3.FromHexString('#c084fc'),
    };
    const col = tierColors[evoTier];

    if (adminOpts?.wingLightEnabled !== false) {
      try {
        const light = new PointLight(`wing_light_${Date.now()}`, new Vector3(0, 0.2, -0.35), this.scene);
        light.parent = wingSocket;
        light.diffuse = col;
        light.specular = col;
        light.intensity = 0.65 + evoTier * 0.45;
        light.range = 4.5 + evoTier * 3.0;
        actor.wingLight = light;
      } catch {
        // ignore in headless
      }
    }

    if (adminOpts?.wingAuraParticlesEnabled !== false) {
      try {
        const ps = new ParticleSystem(`wing_aura_${Date.now()}`, 28 + evoTier * 14, this.scene);
        const tex = new Texture('./mugroup/efectos/texturas/sfx_genlight01-1.png', this.scene, false, true);
        tex.hasAlpha = true;
        ps.particleTexture = tex;
        ps.emitter = wingSocket as unknown as AbstractMesh;
        ps.minEmitBox = new Vector3(-0.35 * evoTier, -0.25, -0.25);
        ps.maxEmitBox = new Vector3(0.35 * evoTier, 0.45 * evoTier, 0.25);
        ps.color1 = new Color4(col.r, col.g, col.b, 0.75);
        ps.color2 = new Color4(1, 0.96, 0.8, 0.5);
        ps.colorDead = new Color4(col.r, col.g, col.b, 0);
        ps.minSize = 0.14;
        ps.maxSize = 0.34 + evoTier * 0.08;
        ps.minLifeTime = 0.45;
        ps.maxLifeTime = 1.1;
        ps.emitRate = 7 + evoTier * 7;
        ps.blendMode = ParticleSystem.BLENDMODE_ADD;
        ps.gravity = new Vector3(0, 0.35, 0);
        ps.start();
        actor.wingParticles = ps;
      } catch {
        // ignore in headless
      }
    }
  }

  private attachItemSparkles(actor: FlyffActorLike, node: TransformNode, enhanceLevel: number): void {
    const spec = getEnhanceVisualSpec(enhanceLevel);
    if (spec.sparkleRate <= 0) return;
    try {
      const ps = new ParticleSystem(`item_shine_${Date.now()}`, 24, this.scene);
      const tex = new Texture('./mugroup/efectos/texturas/sfx_genlight01-1.png', this.scene, false, true);
      tex.hasAlpha = true;
      ps.particleTexture = tex;
      ps.emitter = node as unknown as AbstractMesh;
      ps.minEmitBox = new Vector3(-0.12, -0.1, -0.12);
      ps.maxEmitBox = new Vector3(0.55, 0.25, 0.12);
      ps.color1 = new Color4(spec.color.r, spec.color.g, spec.color.b, 0.9);
      ps.color2 = new Color4(1, 1, 1, 0.6);
      ps.colorDead = new Color4(spec.color.r, spec.color.g, spec.color.b, 0);
      ps.minSize = 0.09;
      ps.maxSize = 0.24;
      ps.minLifeTime = 0.35;
      ps.maxLifeTime = 0.75;
      ps.emitRate = spec.sparkleRate;
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.start();
      actor.enhanceParticles.push(ps);
    } catch {
      // ignore in headless
    }
  }

  public clearDynamicGear(actor: FlyffActorLike): void {
    try {
      actor.wingLight?.dispose();
    } catch {
      // ignore
    }
    actor.wingLight = null;

    try {
      actor.wingParticles?.stop();
      actor.wingParticles?.dispose();
    } catch {
      // ignore
    }
    actor.wingParticles = null;

    for (const ps of actor.enhanceParticles) {
      try {
        ps.stop();
        ps.dispose();
      } catch {
        // ignore
      }
    }
    actor.enhanceParticles = [];
    actor.wingAnimations = [];
    actor.resetWingMode();

    try {
      actor.wingSocket?.dispose();
    } catch {
      // ignore
    }
    actor.wingSocket = null;

    const keptMeshes: AbstractMesh[] = [];
    for (const m of actor.outfit.meshes) {
      if (m.metadata?.dynamicGear) {
        const gripNode = m.metadata?.gripNode as TransformNode | undefined;
        try {
          m.setEnabled(false);
          m.dispose(false, false);
          gripNode?.dispose();
        } catch {
          // ignore
        }
      } else {
        keptMeshes.push(m);
      }
    }
    actor.outfit.meshes = keptMeshes;

    const disposedContainers = new Set<AssetContainer>();
    for (const slot of Object.keys(actor.gear)) {
      const state = actor.gear[slot];
      for (const c of state.containers) {
        if (!disposedContainers.has(c)) {
          disposedContainers.add(c);
          try {
            c.dispose();
          } catch {
            // ignore
          }
        }
      }
      state.equipped = false;
      state.file = undefined;
      state.itemName = undefined;
      state.meshes = [];
      state.containers = [];
    }
  }
}
