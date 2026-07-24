import * as THREE from 'three';

export class RemotePlayer {
  constructor(id, username, scene, beamPointsCount = 20) {
    this.id = id;
    this.username = username;
    this.scene = scene;
    this.beamPointsCount = beamPointsCount;

    // Movement target registers (for network interpolation lerps)
    this.targetPosition = new THREE.Vector3(0, 1.2, 0);
    this.targetYaw = 0;

    // 3D Visual Mesh Group
    this.group = new THREE.Group();
    this.group.position.copy(this.targetPosition);
    this.scene.add(this.group);

    // Dynamic stream components
    this.beams = null;
    this.beamGeometries = null;
    this.isFiring = false;
    this.targetBeamTarget = new THREE.Vector3(0, 0, 0);

    // Build the Exterminator Suit Model
    this.createSuitModel();
    this.createNameplate();
  }

  createSuitModel() {
    // 1. Torso: Slate-gray containment suit plate
    const torsoGeo = new THREE.BoxGeometry(0.5, 0.8, 0.35);
    const torsoMat = new THREE.MeshBasicMaterial({ color: 0x374151 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.set(0, 0.4, 0);
    this.group.add(torso);

    // 2. Helmet: Glowing neon green glass dome
    const helmetGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const helmetMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.set(0, 0.9, 0);
    this.group.add(helmet);

    // Visor: Cyan face plate
    const visorGeo = new THREE.BoxGeometry(0.18, 0.08, 0.2);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.9, 0.1);
    this.group.add(visor);

    // 3. Proton Pack (Backpack): Dark gray container with cyan reactor ring
    const packGeo = new THREE.BoxGeometry(0.35, 0.55, 0.18);
    const packMat = new THREE.MeshBasicMaterial({ color: 0x1f2937 });
    const pack = new THREE.Mesh(packGeo, packMat);
    pack.position.set(0, 0.4, -0.22);
    this.group.add(pack);

    const packRingGeo = new THREE.TorusGeometry(0.08, 0.02, 6, 12);
    const packRingMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const packRing = new THREE.Mesh(packRingGeo, packRingMat);
    packRing.position.set(0, 0.4, -0.32);
    this.group.add(packRing);

    // 4. Weapon Barrel nozzle: Gun held in front
    const nozzleGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.4, 6);
    nozzleGeo.rotateX(Math.PI / 2);
    const nozzleMat = new THREE.MeshBasicMaterial({ color: 0x4b5563 });
    this.nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    this.nozzle.position.set(0.2, 0.3, 0.3);
    this.group.add(this.nozzle);
  }

  createNameplate() {
    // Generate text nameplate using 2D Canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 128, 32);

    ctx.font = 'bold 16px "Share Tech Mono", monospace';
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'center';
    ctx.fillText(this.username, 64, 22);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(0, 1.25, 0); // Hovering above helmet
    sprite.scale.set(1.5, 0.38, 1);
    this.group.add(sprite);
  }

  updateState(pos, yaw, isFiring, beamTarget) {
    this.targetPosition.fromArray(pos);
    this.targetYaw = yaw;
    
    this.targetBeamTarget.fromArray(beamTarget);

    if (isFiring !== this.isFiring) {
      this.isFiring = isFiring;
      if (isFiring) {
        this.createBeamMesh();
      } else {
        this.destroyBeamMesh();
      }
    }
  }

  createBeamMesh() {
    this.beams = [];
    this.beamGeometries = [];
    
    // Remote client stream configs (slightly thinner/fewer lines than local first-person view to save rendering ticks)
    const streamConfigs = [
      { color: 0xffffff, noise: 0.05, opacity: 0.95 },
      { color: 0x00ffff, noise: 0.20, opacity: 0.70 }
    ];

    streamConfigs.forEach(cfg => {
      const positions = new Float32Array(this.beamPointsCount * 3);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const mat = new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        blending: THREE.AdditiveBlending
      });

      const line = new THREE.Line(geom, mat);
      line.frustumCulled = false; // Disable culling for dynamic coordinate shifts
      this.scene.add(line);
      
      this.beams.push(line);
      this.beamGeometries.push({ geom, noise: cfg.noise });
    });
  }

  destroyBeamMesh() {
    if (this.beams) {
      this.beams.forEach(line => this.scene.remove(line));
      this.beams = null;
      this.beamGeometries = null;
    }
  }

  update(delta, time) {
    // 1. Interpolate remote positions (lerps prevent networking stutter)
    this.group.position.lerp(this.targetPosition, 14 * delta);
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, this.targetYaw, 14 * delta);

    // 2. Render remote twisting electric streams
    if (this.isFiring && this.beamGeometries) {
      // Calculate world coordinates of the remote gun nozzle tip
      const startPoint = new THREE.Vector3();
      this.nozzle.getWorldPosition(startPoint);

      const endPoint = this.targetBeamTarget;
      const diff = endPoint.clone().sub(startPoint);

      this.beamGeometries.forEach(bg => {
        const positions = bg.geom.attributes.position.array;
        const noiseDepth = bg.noise;

        for (let i = 0; i < this.beamPointsCount; i++) {
          const t = i / (this.beamPointsCount - 1);
          const p = startPoint.clone().addScaledVector(diff, t);

          if (i > 0 && i < this.beamPointsCount - 1) {
            const noiseMag = noiseDepth * Math.sin(t * Math.PI);
            p.x += (Math.random() - 0.5) * noiseMag;
            p.y += (Math.random() - 0.5) * noiseMag;
            p.z += (Math.random() - 0.5) * noiseMag;
          }

          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;
        }

        bg.geom.attributes.position.needsUpdate = true;
      });
    }
  }

  destroy() {
    this.destroyBeamMesh();
    this.scene.remove(this.group);
  }
}
