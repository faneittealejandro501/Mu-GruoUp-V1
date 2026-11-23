import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from '@babylonjs/core';

/**
 * Babylon.js runtime for playing Flyff SFX JSON definitions and
 * audio mappings stored in public/mugroup/efectos-audio.json.
 */
export class FlyffEffectRuntime {
  constructor(scene) {
    this.scene = scene;
    this.manifest = null;
    this.effectCache = new Map();
    this.textureCache = new Map();
    this.activeInstances = [];
    this.activeAudioCount = 0;
  }

  async ensureManifest() {
    if (this.manifest) return this.manifest;
    try {
      const res = await fetch('./mugroup/efectos-audio.json');
      if (res.ok) {
        this.manifest = await res.json();
      }
    } catch {
      this.manifest = { sounds: {}, effects: [] };
    }
    return this.manifest;
  }

  async loadEffectDef(effectName) {
    if (!effectName) return null;
    const clean = effectName.replace(/^efectos\//, '').replace(/\.json$/, '');
    if (this.effectCache.has(clean)) return this.effectCache.get(clean);
    try {
      const url = `./mugroup/efectos/${clean}.json`;
      const res = await fetch(url);
      if (!res.ok) {
        this.effectCache.set(clean, null);
        return null;
      }
      const def = await res.json();
      this.effectCache.set(clean, def);
      return def;
    } catch {
      this.effectCache.set(clean, null);
      return null;
    }
  }

  getTexture(relPath) {
    if (!relPath) return null;
    const clean = relPath.startsWith('efectos/')
      ? `./mugroup/${relPath}`
      : `./mugroup/efectos/texturas/${relPath.replace(/^texturas\//, '')}`;
    if (this.textureCache.has(clean)) return this.textureCache.get(clean);
    try {
      const tex = new Texture(clean, this.scene, false, true);
      tex.hasAlpha = true;
      this.textureCache.set(clean, tex);
      return tex;
    } catch {
      return null;
    }
  }

  playSoundUrl(url, volume = 0.65, muted = false) {
    if (muted || !url || typeof window === 'undefined' || typeof Audio === 'undefined') return;
    if (this.activeAudioCount >= 8) return;
    try {
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, volume));
      this.activeAudioCount += 1;
      const done = () => {
        this.activeAudioCount = Math.max(0, this.activeAudioCount - 1);
      };
      audio.addEventListener('ended', done, { once: true });
      audio.addEventListener('error', done, { once: true });
      void audio.play().catch(done);
    } catch {
      // ignore autoplay blocks
    }
  }

  async playSound(soundKey, volume = 0.65, muted = false) {
    if (muted || !soundKey || typeof window === 'undefined' || typeof Audio === 'undefined') return;
    const manifest = await this.ensureManifest();
    const rel = manifest?.sounds?.[soundKey];
    if (!rel) return;
    const url = rel.startsWith('../')
      ? `./${rel.replace(/^\.\.\//, '')}`
      : `./mugroup/${rel}`;
    this.playSoundUrl(url, volume, muted);
  }

  unlockAudio() {
    void this.ensureManifest();
  }

  async play(effectName, position, scale = 1.0, opts = {}) {
    await this.playEffect(effectName, position, opts?.colorHex || '#fbbf24', scale);
  }

  async playEffect(effectName, position, colorHex = '#fbbf24', baseScale = 1.0) {
    if (!this.scene || this.scene.isDisposed) return;
    const def = await this.loadEffectDef(effectName);
    if (this.scene.isDisposed) return;
    const root = new TransformNode(`sfx_${effectName}_${Date.now()}`, this.scene);
    root.position = position.clone ? position.clone() : new Vector3(position.x, position.y, position.z);
    if (baseScale !== 1.0) root.scaling.setAll(baseScale);

    const col = Color3.FromHexString(colorHex && colorHex.startsWith('#') ? colorHex : '#fbbf24');
    const createdMeshes = [];
    const createdMats = [];

    const parts = Array.isArray(def?.parts) ? def.parts.slice(0, 5) : [];
    if (parts.length > 0) {
      parts.forEach((part, idx) => {
        const plane = MeshBuilder.CreatePlane(`sfx_p_${idx}`, { size: 1.9 + idx * 0.45 }, this.scene);
        plane.parent = root;
        plane.position.y = 0.75 + idx * 0.28;
        plane.billboardMode = 7;
        plane.isPickable = false;

        const mat = new StandardMaterial(`sfx_mat_${Date.now()}_${idx}`, this.scene);
        mat.emissiveColor = col;
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        mat.alpha = 0.92;

        const texPath = part.textures?.[0];
        const tex = texPath ? this.getTexture(texPath) : null;
        if (tex) {
          mat.diffuseTexture = tex;
          mat.opacityTexture = tex;
          mat.useAlphaFromDiffuseTexture = true;
        }
        plane.material = mat;
        createdMeshes.push(plane);
        createdMats.push(mat);
      });
    }

    // Always add a crisp ground shockwave ring for immediate combat readability
    const ring = MeshBuilder.CreateTorus(
      `sfx_ring_${Date.now()}`,
      { diameter: 2.3 * baseScale, thickness: 0.14, tessellation: 20 },
      this.scene,
    );
    ring.parent = root;
    ring.position.y = 0.25;
    ring.isPickable = false;
    const ringMat = new StandardMaterial(`sfx_rmat_${Date.now()}`, this.scene);
    ringMat.emissiveColor = col;
    ringMat.disableLighting = true;
    ringMat.alpha = 0.85;
    ring.material = ringMat;
    createdMeshes.push(ring);
    createdMats.push(ringMat);

    this.activeInstances.push({
      root,
      meshes: createdMeshes,
      mats: createdMats,
      age: 0,
      duration: 0.7,
    });
  }

  update(dt) {
    for (let i = this.activeInstances.length - 1; i >= 0; i--) {
      const inst = this.activeInstances[i];
      inst.age += dt;
      const t = Math.min(1, inst.age / inst.duration);
      const scale = 0.88 + t * 1.15;
      inst.root.scaling.setAll(scale);
      inst.root.rotation.y += dt * 4.8;
      for (const m of inst.mats) {
        m.alpha = Math.max(0, 0.92 * (1 - t));
      }
      if (t >= 1) {
        for (const mesh of inst.meshes) mesh.dispose(false, false);
        for (const mat of inst.mats) mat.dispose(false, false);
        inst.root.dispose();
        this.activeInstances.splice(i, 1);
      }
    }
  }

  dispose() {
    for (const inst of this.activeInstances) {
      for (const mesh of inst.meshes) mesh.dispose(false, false);
      for (const mat of inst.mats) mat.dispose(false, false);
      inst.root.dispose();
    }
    this.activeInstances = [];
    for (const tex of this.textureCache.values()) {
      try {
        tex.dispose();
      } catch {
        // ignore
      }
    }
    this.textureCache.clear();
  }
}
