import * as THREE from 'three';

export class Enemy {
  constructor(type, spawnPos, scene, map, player, audio, onDeath) {
    this.type = type; // 4: Green, 5: Pink, 6: Blue
    this.spawnPos = spawnPos.clone();
    this.scene = scene;
    this.map = map;
    this.player = player;
    this.audio = audio;
    this.onDeath = onDeath;

    // Movement & Combat Stats
    this.position = spawnPos.clone();
    this.speed = 1.8;
    this.maxHp = 100;
    this.hp = 100;
    this.radius = 0.45;
    
    // Rooms! specific states
    this.isCaptured = false; // flag for legacy code compatibility
    this.isEaten = false;
    this.respawnTimer = 0.0;
    this.shaking = 0; // capture jitter effect

    // Specific behaviors
    this.lurking = false;
    this.lurkTimer = Math.random() * 3;
    this.shootTimer = Math.random() * 2;
    this.screechTimer = Math.random() * 4;

    // Sprite textures
    this.normalTexture = null;
    this.vulnerableTexture = null;
    this.flashingTexture = null;

    this.mesh = null;
    this.createSprite();
  }

  createSprite() {
    // 1. Generate normal texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (this.type === 4) {
      // Phantasm: Green ghost
      this.speed = 2.0;
      this.maxHp = 45;
      this.hp = 45;
      this.radius = 0.4;
      
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(32, 28, 20, 0, Math.PI, true);
      ctx.lineTo(12, 54);
      ctx.lineTo(24, 46);
      ctx.lineTo(32, 58);
      ctx.lineTo(40, 46);
      ctx.lineTo(52, 54);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.arc(32, 28, 16, 0, Math.PI, true);
      ctx.lineTo(16, 44);
      ctx.lineTo(48, 44);
      ctx.closePath();
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(22, 24, 6, 6);
      ctx.fillRect(36, 24, 6, 6);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(24, 26, 2, 2);
      ctx.fillRect(38, 26, 2, 2);

    } else if (this.type === 5) {
      // Poltergeist: Pink ghost
      this.speed = 2.4;
      this.maxHp = 60;
      this.hp = 60;
      this.radius = 0.4;

      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(32, 28, 20, 0, Math.PI, true);
      ctx.lineTo(12, 54);
      ctx.lineTo(24, 46);
      ctx.lineTo(32, 58);
      ctx.lineTo(40, 46);
      ctx.lineTo(52, 54);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(32, 28, 16, 0, Math.PI, true);
      ctx.lineTo(16, 44);
      ctx.lineTo(48, 44);
      ctx.closePath();
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(22, 24, 6, 6);
      ctx.fillRect(36, 24, 6, 6);
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(24, 26, 2, 2);
      ctx.fillRect(38, 26, 2, 2);

    } else if (this.type === 6) {
      // Specter: Blue giant ghost
      this.speed = 1.4;
      this.maxHp = 180;
      this.hp = 180;
      this.radius = 0.85;

      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(32, 28, 20, 0, Math.PI, true);
      ctx.lineTo(12, 54);
      ctx.lineTo(24, 46);
      ctx.lineTo(32, 58);
      ctx.lineTo(40, 46);
      ctx.lineTo(52, 54);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#93c5fd';
      ctx.beginPath();
      ctx.arc(32, 28, 16, 0, Math.PI, true);
      ctx.lineTo(16, 44);
      ctx.lineTo(48, 44);
      ctx.closePath();
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(22, 24, 6, 6);
      ctx.fillRect(36, 24, 6, 6);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(24, 26, 2, 2);
      ctx.fillRect(38, 26, 2, 2);
    }

    this.normalTexture = new THREE.CanvasTexture(canvas);
    this.normalTexture.minFilter = THREE.NearestFilter;
    this.normalTexture.magFilter = THREE.NearestFilter;

    // 2. Generate vulnerable blue texture
    this.vulnerableTexture = this.generateVulnerableTexture();
    // 3. Generate flashing white texture
    this.flashingTexture = this.generateFlashingTexture();

    const spriteMat = new THREE.SpriteMaterial({
      map: this.normalTexture,
      transparent: true,
      color: 0xffffff
    });

    this.mesh = new THREE.Sprite(spriteMat);
    const heightScale = this.type === 6 ? 2.2 : 1.2;
    this.mesh.scale.set(heightScale, heightScale, 1);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  generateVulnerableTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Frightened body: Dark blue glow
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.arc(32, 28, 20, 0, Math.PI, true);
    ctx.lineTo(12, 54);
    ctx.lineTo(24, 46);
    ctx.lineTo(32, 58);
    ctx.lineTo(40, 46);
    ctx.lineTo(52, 54);
    ctx.closePath();
    ctx.fill();

    // Center body
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.arc(32, 28, 16, 0, Math.PI, true);
    ctx.lineTo(16, 44);
    ctx.lineTo(48, 44);
    ctx.closePath();
    ctx.fill();

    // Frightened orange/red small eyes
    ctx.fillStyle = '#f97316';
    ctx.fillRect(22, 24, 6, 6);
    ctx.fillRect(36, 24, 6, 6);
    
    // Squiggly mouth
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 40);
    ctx.lineTo(26, 36);
    ctx.lineTo(32, 40);
    ctx.lineTo(38, 36);
    ctx.lineTo(44, 40);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    return texture;
  }

  generateFlashingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Flashing body: White/light grey
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(32, 28, 20, 0, Math.PI, true);
    ctx.lineTo(12, 54);
    ctx.lineTo(24, 46);
    ctx.lineTo(32, 58);
    ctx.lineTo(40, 46);
    ctx.lineTo(52, 54);
    ctx.closePath();
    ctx.fill();

    // Center body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(32, 28, 16, 0, Math.PI, true);
    ctx.lineTo(16, 44);
    ctx.lineTo(48, 44);
    ctx.closePath();
    ctx.fill();

    // Red small eyes
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(22, 24, 6, 6);
    ctx.fillRect(36, 24, 6, 6);
    
    // Squiggly mouth
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 40);
    ctx.lineTo(26, 36);
    ctx.lineTo(32, 40);
    ctx.lineTo(38, 36);
    ctx.lineTo(44, 40);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    return texture;
  }

  drainEctoplasm(amount) {
    // Legacy support: if weapon hit checks drain, bypass or damage in normal mode
    if (this.hp <= 0 || this.isEaten) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.eatGhost();
    }
  }

  eatGhost() {
    this.isEaten = true;
    this.mesh.visible = false;
    this.respawnTimer = 5.0; // Respawn back at original spawn after 5s

    this.audio.playGhostEatenSound();
    
    if (this.player) {
      this.player.score += 200;
      this.player.updateHUD();
    }

    if (this.engine) {
      this.engine.showFloatingText("GHOST CONSUMED // +200 PTS", "go-cyan");
    }
  }

  resetPosition() {
    this.position.copy(this.spawnPos);
    this.mesh.position.copy(this.spawnPos);
    this.isEaten = false;
    this.mesh.visible = true;
    this.hp = this.maxHp;
    this.shaking = 0;
  }

  update(delta, time, projectiles) {
    // 1. If currently eaten, handle respawn countdown
    if (this.isEaten) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) {
        this.resetPosition();
      }
      return;
    }

    // 2. Texture Swapping based on Player power up state
    if (this.player.isPoweredUp) {
      // Alternate texture flash when powerup timer is less than 3s
      if (this.player.poweredUpTimer < 3.0) {
        const isWhiteFlash = Math.floor(time * 4) % 2 === 0;
        this.mesh.material.map = isWhiteFlash ? this.flashingTexture : this.vulnerableTexture;
      } else {
        this.mesh.material.map = this.vulnerableTexture;
      }
    } else {
      this.mesh.material.map = this.normalTexture;
      // Lerp back color if hit flashed red
      this.mesh.material.color.lerp(new THREE.Color(0xffffff), 5 * delta);
    }
    this.mesh.material.needsUpdate = true;

    // 3. Screech alarm sounds dynamically based on distance to player
    this.screechTimer -= delta;
    const distanceToPlayer = this.position.distanceTo(this.player.position);
    
    if (this.screechTimer <= 0) {
      this.screechTimer = 3 + Math.random() * 4;
      const relDist = Math.min(1.0, distanceToPlayer / 16.0);
      this.audio.playGhostScreech(relDist);
    }

    // 4. Bob up/down to simulate floating
    const bob = Math.sin(time * 3 + this.position.x * 2) * 0.15;
    this.mesh.position.y = 1.0 + bob;

    // 5. Movement AI
    const toPlayer = this.player.position.clone().sub(this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    // Shaking lock check
    if (this.shaking > 0) {
      this.shaking -= delta;
      this.mesh.position.x = this.position.x + (Math.random() - 0.5) * 0.15;
      this.mesh.position.z = this.position.z + (Math.random() - 0.5) * 0.15;
      return;
    }

    // Vulnerable vs normal movement
    if (this.player.isPoweredUp) {
      // Run away from Player!
      const fleeSpeed = this.speed * 0.5; // slow down
      const awayDir = this.position.clone().sub(this.player.position).normalize();
      awayDir.y = 0;

      const nextPos = this.position.clone().addScaledVector(awayDir, fleeSpeed * delta);
      const res = this.map.checkCollisions(nextPos, this.radius);
      if (!res.collision) {
        this.position.copy(nextPos);
      } else {
        // Slide response if blocked
        nextPos.add(res.normal);
        const doubleCheck = this.map.checkCollisions(nextPos, this.radius);
        if (!doubleCheck.collision) {
          this.position.copy(nextPos);
        }
      }
    } else {
      // Normal chase behaviors
      if (this.type === 4) {
        // Phantasm: green charger
        this.lurkTimer -= delta;
        if (this.lurkTimer <= 0) {
          this.lurking = !this.lurking;
          this.lurkTimer = 2 + Math.random() * 4;
        }

        if (this.lurking) {
          this.mesh.material.opacity = 0.25;
          toPlayer.normalize().multiplyScalar(this.speed * 0.4 * delta);
          this.position.add(toPlayer);
        } else {
          this.mesh.material.opacity = 0.9;
          toPlayer.normalize().multiplyScalar(this.speed * delta);
          const nextPos = this.position.clone().add(toPlayer);
          const res = this.map.checkCollisions(nextPos, this.radius);
          if (!res.collision) {
            this.position.copy(nextPos);
          }
        }
      } else if (this.type === 5) {
        // Poltergeist: pink shooter/strafer
        this.mesh.material.opacity = 0.85;
        let moveDir = toPlayer.clone();
        if (dist < 4.5) {
          moveDir.negate().normalize().multiplyScalar(this.speed * delta);
        } else if (dist > 8.0) {
          moveDir.normalize().multiplyScalar(this.speed * delta);
        } else {
          moveDir.set(-toPlayer.z, 0, toPlayer.x).normalize().multiplyScalar(this.speed * 0.5 * delta);
        }

        const nextPos = this.position.clone().add(moveDir);
        const res = this.map.checkCollisions(nextPos, this.radius);
        if (!res.collision) {
          this.position.copy(nextPos);
        }

        // Keep shooting projectiles in normal mode
        this.shootTimer -= delta;
        if (this.shootTimer <= 0 && dist < 12.0) {
          this.shootTimer = 1.8 + Math.random() * 1.5;
          this.spawnProjectile(projectiles);
        }
      } else if (this.type === 6) {
        // Specter: giant blue rusher
        this.mesh.material.opacity = 0.9;
        toPlayer.normalize().multiplyScalar(this.speed * delta);
        const nextPos = this.position.clone().add(toPlayer);
        const res = this.map.checkCollisions(nextPos, this.radius);
        if (!res.collision) {
          this.position.copy(nextPos);
        }

        if (dist < 1.8) {
          this.player.takeDamage(15 * delta); // aura radiation damage
        }
      }
    }

    // Sync mesh coordinates
    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;

    // Contact checks
    if (dist < this.radius + this.player.radius) {
      if (this.player.isPoweredUp) {
        // Consume ghost!
        this.eatGhost();
      } else {
        // Normal contact: Instant death (takes 100 damage)
        this.player.takeDamage(100);
      }
    }
  }

  spawnProjectile(projectiles) {
    if (this.player.isPoweredUp) return; // Don't fire projectiles while fleeing!

    const geo = new THREE.SphereGeometry(0.15, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    const pMesh = new THREE.Mesh(geo, mat);
    
    pMesh.position.copy(this.position);
    pMesh.position.y = 1.0;
    this.scene.add(pMesh);

    const light = new THREE.PointLight(0xff00ff, 1.2, 2.0);
    pMesh.add(light);

    const targetPos = this.player.position.clone();
    targetPos.y = 1.2;
    const dir = targetPos.sub(pMesh.position).normalize();

    projectiles.push({
      mesh: pMesh,
      dir: dir,
      speed: 7.0,
      age: 0,
      damage: 15
    });
  }

  destroy() {
    this.scene.remove(this.mesh);
  }
}
