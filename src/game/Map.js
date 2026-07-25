import * as THREE from 'three';

export class Map {
  constructor(scene) {
    this.scene = scene;
    this.cellSize = 3;
    this.wallHeight = 3.5;
    this.grid = [];
    this.width = 0;
    this.height = 0;
    
    this.walls = [];
    this.cookies = [];
    this.powerCookies = [];
    this.cherries = [];
    this.teleporter = null;
    this.playerSpawn = new THREE.Vector3(0, 0, 0);
    this.enemySpawns = [];

    // Precompiled textures
    this.textures = {};
    this.initTextures();
  }

  initTextures() {
    this.textures.wallA = this.generateProceduralTexture('wallA');
    this.textures.wallB = this.generateProceduralTexture('wallB');
    this.textures.floor = this.generateProceduralTexture('floor');
    this.textures.ceiling = this.generateProceduralTexture('ceiling');
    this.textures.teleporter = this.generateProceduralTexture('teleporter');
  }

  // Generates 128x128 retro pixel art textures dynamically
  generateProceduralTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Enable pixelated scaling
    ctx.imageSmoothingEnabled = false;

    if (type === 'wallA') {
      // Retro Pac-Man Neon Blue Walls
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, 128, 128);

      ctx.strokeStyle = '#3b82f6';
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 12;
      ctx.strokeRect(6, 6, 116, 116);
      
      ctx.strokeStyle = '#1d4ed8';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 4;
      ctx.strokeRect(16, 16, 96, 96);

    } else if (type === 'wallB') {
      // Retro Neon Pink/Purple Hazard Walls
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, 128, 128);

      ctx.strokeStyle = '#f43f5e';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 12;
      ctx.strokeRect(6, 6, 116, 116);

      ctx.strokeStyle = '#be123c';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 4;
      ctx.strokeRect(16, 16, 96, 96);

    } else if (type === 'floor') {
      // Dark navy grid floor
      ctx.fillStyle = '#080c1d';
      ctx.fillRect(0, 0, 128, 128);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 128; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 128);
        ctx.moveTo(0, i); ctx.lineTo(128, i);
        ctx.stroke();
      }

    } else if (type === 'ceiling') {
      // Tech ventilation grid
      ctx.fillStyle = '#020205';
      ctx.fillRect(0, 0, 128, 128);

      ctx.fillStyle = '#0f172a';
      for (let y = 16; y < 120; y += 32) {
        ctx.fillRect(16, y, 96, 8);
      }
    } else if (type === 'teleporter') {
      // Portal base plate (spiraling green runes)
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 128, 128);

      ctx.strokeStyle = '#00ff66';
      ctx.shadowColor = '#00ff66';
      ctx.shadowBlur = 15;
      ctx.lineWidth = 4;
      
      // Circles
      ctx.beginPath();
      ctx.arc(64, 64, 48, 0, Math.PI * 2);
      ctx.arc(64, 64, 24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  loadLevel(levelData) {
    this.clear();

    this.grid = levelData.grid;
    this.height = this.grid.length;
    this.width = this.grid[0].length;

    // Materials
    const matWallA = new THREE.MeshBasicMaterial({
      map: this.textures.wallA
    });
    const matWallB = new THREE.MeshBasicMaterial({
      map: this.textures.wallB
    });
    const matFloor = new THREE.MeshBasicMaterial({
      map: this.textures.floor
    });
    const matCeiling = new THREE.MeshBasicMaterial({
      map: this.textures.ceiling
    });

    // We repeat floor/ceiling textures across cells
    matFloor.map.repeat.set(this.width, this.height);
    matCeiling.map.repeat.set(this.width, this.height);

    // 1. Create large Floor and Ceiling meshes
    const floorGeo = new THREE.PlaneGeometry(this.width * this.cellSize, this.height * this.cellSize);
    const floor = new THREE.Mesh(floorGeo, matFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(
      (this.width * this.cellSize) / 2 - this.cellSize / 2,
      0,
      (this.height * this.cellSize) / 2 - this.cellSize / 2
    );
    this.scene.add(floor);
    this.walls.push(floor);

    const ceilGeo = new THREE.PlaneGeometry(this.width * this.cellSize, this.height * this.cellSize);
    const ceiling = new THREE.Mesh(ceilGeo, matCeiling);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(
      (this.width * this.cellSize) / 2 - this.cellSize / 2,
      this.wallHeight,
      (this.height * this.cellSize) / 2 - this.cellSize / 2
    );
    this.scene.add(ceiling);
    this.walls.push(ceiling);

    // 2. Build wall blocks and identify spawns
    const boxGeo = new THREE.BoxGeometry(this.cellSize, this.wallHeight, this.cellSize);

    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        const val = this.grid[r][c];
        const x = c * this.cellSize;
        const z = r * this.cellSize;

        if (val === 1 || val === 2) {
          // Wall A or Wall B
          const wallMesh = new THREE.Mesh(boxGeo, val === 1 ? matWallA : matWallB);
          wallMesh.position.set(x, this.wallHeight / 2, z);
          this.scene.add(wallMesh);
          this.walls.push(wallMesh);
        } else if (val === 3) {
          // Player Spawn coordinate
          this.playerSpawn.set(x, 1.2, z);
        } else if (val === 4 || val === 5 || val === 6) {
          // Enemy Spawn coordinates (type, x, z)
          this.enemySpawns.push({ type: val, position: new THREE.Vector3(x, 1.2, z) });
        } else if (val === 7) {
          // Power Cookie
          this.spawnPowerCookie(x, z, c, r);
        } else if (val === 8) {
          // Cherry Fruit Bonus
          this.spawnCherry(x, z, c, r);
        } else if (val === 9) {
          // Exit Teleporter
          this.createTeleporter(x, z);
        }

        // Spawn standard cookies on empty floors (0), player spawns (3), and ghost spawns (4,5,6)
        if (val === 0 || val === 3 || val === 4 || val === 5 || val === 6) {
          this.spawnCookie(x, z, c, r);
        }
      }
    }

    // Add ambient lighting to the level
    const ambLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambLight);
    this.walls.push(ambLight);

    // Add glowing neon point lights inside the maze
    this.spawnPointLights();
  }

  spawnPointLights() {
    // Add blue and pink glowing lights periodically
    for (let r = 1; r < this.height - 1; r += 4) {
      for (let c = 1; c < this.width - 1; c += 4) {
        if (this.grid[r][c] === 0 || this.grid[r][c] === 3) {
          const color = (r + c) % 2 === 0 ? 0x0088ff : 0xff00ff;
          const pLight = new THREE.PointLight(color, 2.0, 7);
          pLight.position.set(c * this.cellSize, this.wallHeight - 0.5, r * this.cellSize);
          this.scene.add(pLight);
          this.walls.push(pLight);
        }
      }
    }
  }

  spawnCookie(x, z, gridX, gridZ) {
    // Standard floating random-colored cookie
    const colors = [
      0xfacc15, // Yellow
      0xec4899, // Pink
      0x10b981, // Green
      0x06b6d4, // Cyan
      0xf97316, // Orange
      0x8b5cf6, // Purple
      0xef4444  // Red
    ];
    const pickedColor = colors[Math.floor(Math.random() * colors.length)];

    const geo = new THREE.SphereGeometry(0.12, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: pickedColor });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.7, z);
    this.scene.add(mesh);

    this.cookies.push({
      mesh,
      gridX,
      gridZ,
      eaten: false,
      color: pickedColor
    });
  }

  spawnPowerCookie(x, z, gridX, gridZ) {
    // Larger pulsing power cookie
    const geo = new THREE.SphereGeometry(0.24, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.7, z);
    this.scene.add(mesh);

    // Add glowing green light
    const light = new THREE.PointLight(0x00ff66, 2.0, 3.5);
    light.position.copy(mesh.position);
    this.scene.add(light);

    this.powerCookies.push({
      mesh,
      light,
      gridX,
      gridZ,
      eaten: false
    });
  }

  spawnCherry(x, z, gridX, gridZ) {
    const group = new THREE.Group();

    // Cherry A
    const cherryGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const cherryMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const cherry1 = new THREE.Mesh(cherryGeo, cherryMat);
    cherry1.position.set(-0.1, 0, 0);
    group.add(cherry1);

    // Cherry B
    const cherry2 = new THREE.Mesh(cherryGeo, cherryMat);
    cherry2.position.set(0.1, -0.05, 0.05);
    group.add(cherry2);

    // Stem (green)
    const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 4);
    const stemMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.rotation.z = -0.3;
    stem.position.set(0, 0.15, 0);
    group.add(stem);

    group.position.set(x, 0.7, z);
    this.scene.add(group);

    // Red glowing light
    const light = new THREE.PointLight(0xef4444, 2.0, 4);
    light.position.copy(group.position);
    this.scene.add(light);

    this.cherries.push({
      mesh: group,
      light,
      gridX,
      gridZ,
      eaten: false
    });
  }

  createTeleporter(x, z) {
    // Teleporter pad on floor
    const teleGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.1, 16);
    const matTele = new THREE.MeshBasicMaterial({
      map: this.textures.teleporter
    });
    
    const pad = new THREE.Mesh(teleGeo, matTele);
    pad.position.set(x, 0.05, z);
    this.scene.add(pad);
    this.walls.push(pad);

    // A ring of green light
    const light = new THREE.PointLight(0x00ff66, 0.5, 4);
    light.position.set(x, 1, z);
    this.scene.add(light);
    this.walls.push(light);

    // Green beacon effect
    const beamGeo = new THREE.CylinderGeometry(0.9, 0.9, 3, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    });
    const beacon = new THREE.Mesh(beamGeo, beamMat);
    beacon.position.set(x, 1.5, z);
    this.scene.add(beacon);
    this.walls.push(beacon);

    this.teleporter = {
      pos: new THREE.Vector2(x, z),
      active: false,
      light,
      beacon
    };
  }

  setTeleporterActive(active) {
    if (!this.teleporter) return;
    this.teleporter.active = active;
    
    if (active) {
      this.teleporter.light.color.setHex(0x00ff66);
      this.teleporter.light.intensity = 4.0;
      this.teleporter.beacon.material.opacity = 0.35;
    } else {
      this.teleporter.light.color.setHex(0xff3333); // Red deactivated
      this.teleporter.light.intensity = 1.0;
      this.teleporter.beacon.material.opacity = 0.05;
    }
  }

  checkCollisions(pos, radius = 0.45) {
    // Check grid bounds
    const gridX = Math.round(pos.x / this.cellSize);
    const gridZ = Math.round(pos.z / this.cellSize);

    const collisionResponse = {
      collision: false,
      normal: new THREE.Vector3(0, 0, 0)
    };

    // Check 3x3 surrounding cells
    for (let r = gridZ - 1; r <= gridZ + 1; r++) {
      for (let c = gridX - 1; c <= gridX + 1; c++) {
        if (r < 0 || r >= this.height || c < 0 || c >= this.width) continue;
        
        const val = this.grid[r][c];
        if (val === 1 || val === 2) {
          // Compute bounding box for wall cell
          const wallX = c * this.cellSize;
          const wallZ = r * this.cellSize;
          const half = this.cellSize / 2;

          // Closest point on AABB to player
          const closestX = Math.max(wallX - half, Math.min(pos.x, wallX + half));
          const closestZ = Math.max(wallZ - half, Math.min(pos.z, wallZ + half));

          // Distance vector
          const dx = pos.x - closestX;
          const dz = pos.z - closestZ;
          const distSq = dx * dx + dz * dz;

          if (distSq < radius * radius) {
            collisionResponse.collision = true;
            
            // Push out vector
            const dist = Math.sqrt(distSq);
            if (dist > 0) {
              const overlap = radius - dist;
              collisionResponse.normal.set(dx / dist, 0, dz / dist).multiplyScalar(overlap);
            } else {
              // Edge case: exactly centered in wall, push in arbitrary direction
              collisionResponse.normal.set(1, 0, 0).multiplyScalar(radius);
            }
            return collisionResponse; // Return first collision found
          }
        }
      }
    }
    return collisionResponse;
  }

  update(time, delta) {
    // Rotate standard cookies
    this.cookies.forEach(cookie => {
      if (cookie.eaten) return;
      cookie.mesh.rotation.y += 2.0 * delta;
      cookie.mesh.position.y = 0.7 + Math.sin(time * 3 + cookie.gridX) * 0.08;
    });

    // Pulsate power cookies
    this.powerCookies.forEach(pc => {
      if (pc.eaten) return;
      pc.mesh.rotation.y += 1.5 * delta;
      const scale = 1.0 + Math.sin(time * 6) * 0.15;
      pc.mesh.scale.set(scale, scale, scale);
      pc.light.intensity = 2.0 + Math.sin(time * 6) * 1.0;
    });

    // Spin cherries
    this.cherries.forEach(cherry => {
      if (cherry.eaten) return;
      cherry.mesh.rotation.y += 1.5 * delta;
      cherry.mesh.position.y = 0.7 + Math.sin(time * 4) * 0.1;
      cherry.light.position.y = cherry.mesh.position.y;
    });

    // Spin teleporter beacon
    if (this.teleporter && this.teleporter.active) {
      this.teleporter.beacon.rotation.y += 0.5 * delta;
    }
  }

  clear() {
    // Remove all loaded assets
    this.walls.forEach(m => this.scene.remove(m));
    this.walls = [];

    this.cookies.forEach(c => this.scene.remove(c.mesh));
    this.cookies = [];

    this.powerCookies.forEach(pc => {
      this.scene.remove(pc.mesh);
      this.scene.remove(pc.light);
    });
    this.powerCookies = [];

    this.cherries.forEach(cherry => {
      this.scene.remove(cherry.mesh);
      this.scene.remove(cherry.light);
    });
    this.cherries = [];

    if (this.teleporter) {
      this.scene.remove(this.teleporter.beacon);
      this.teleporter = null;
    }

    this.enemySpawns = [];
  }
}
