import * as THREE from 'three';

export class Player {
  constructor(camera, map, audio) {
    this.camera = camera;
    this.map = map;
    this.audio = audio;
    this.engine = null; // Set by engine

    // Position & Physics
    this.position = new THREE.Vector3(0, 1.2, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.moveSpeed = 6.0;
    this.radius = 0.5;

    // Camera look properties
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.mouseSensitivity = 0.0022;
    this.lookDeltaY = 0;
    this.lastYaw = 0;

    // Crunch-Man Attributes
    this.hp = 100;
    this.maxHp = 100;
    this.score = 0;
    this.lives = 3;
    this.isPoweredUp = false;
    this.poweredUpTimer = 0.0;
    this.maxPoweredUpTime = 10.0;

    this.bpm = 80;
    this.damageFlashTimer = 0;
    this.healFlashTimer = 0;
    this.lastHitTime = 0;
    this.chompToggle = false;

    // Inputs
    this.keys = { w: false, a: false, s: false, d: false, fire: false };

    // HTML HUD Element references
    this.hpVal = document.getElementById('hp-value');
    this.shieldBar = document.getElementById('shield-bar');
    this.bpmVal = document.getElementById('bpm-value');
    this.tempVal = document.getElementById('temp-value');
    this.batteryVal = document.getElementById('battery-value');
    this.heatFill = document.getElementById('heat-fill');
    this.damageFlash = document.getElementById('damage-flash');
    this.healingFlash = document.getElementById('healing-flash');

    this.setupInputs();
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      const keysToBlock = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'space'];
      if (document.pointerLockElement && e.key && keysToBlock.includes(e.key.toLowerCase())) {
        e.preventDefault();
      }

      // Toggle crosshair visibility with 'T' key
      if (document.pointerLockElement && e.key && e.key.toLowerCase() === 't') {
        const crosshair = document.getElementById('crosshair');
        if (crosshair) {
          crosshair.classList.toggle('hidden');
        }
      }

      this.handleKey(e, true);
    });
    window.addEventListener('keyup', (e) => {
      this.handleKey(e, false);
    });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        this.handleMouse(e.movementX, e.movementY);
      }
    });
  }

  handleKey(e, isDown) {
    const key = e.key ? e.key.toLowerCase() : '';
    const code = e.code || '';

    if (key === 'w' || key === 'arrowup' || code === 'KeyW' || code === 'ArrowUp') {
      this.keys.w = isDown;
    }
    if (key === 's' || key === 'arrowdown' || code === 'KeyS' || code === 'ArrowDown') {
      this.keys.s = isDown;
    }
    if (key === 'a' || key === 'arrowleft' || code === 'KeyA' || code === 'ArrowLeft') {
      this.keys.a = isDown;
    }
    if (key === 'd' || key === 'arrowright' || code === 'KeyD' || code === 'ArrowRight') {
      this.keys.d = isDown;
    }
  }

  handleMouse(mx, my) {
    this.rotation.y -= mx * this.mouseSensitivity;
    this.rotation.x -= my * this.mouseSensitivity;

    const limit = Math.PI / 2 - 0.05;
    this.rotation.x = Math.max(-limit, Math.min(limit, this.rotation.x));
  }

  spawnAt(pos) {
    this.position.copy(pos);
    this.camera.position.copy(this.position);
    this.camera.rotation.set(0, 0, 0);
    this.rotation.set(0, 0, 0);

    this.hp = this.maxHp;
    this.isPoweredUp = false;
    this.poweredUpTimer = 0.0;
    this.lastHitTime = 0;
    this.updateHUD();
  }

  takeDamage(amount) {
    if (this.hp <= 0) return;

    this.lastHitTime = performance.now();
    this.hp = Math.max(0, this.hp - amount);

    this.damageFlashTimer = 0.25;
    if (this.damageFlash) {
      this.damageFlash.style.opacity = '0.7';
    }

    this.updateHUD();
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.healFlashTimer = 0.3;
    if (this.healingFlash) {
      this.healingFlash.style.opacity = '0.5';
    }
    this.updateHUD();
  }

  update(delta, time) {
    // Track yaw rotation speed for weapon lag visuals
    const yawChange = this.rotation.y - this.lastYaw;
    this.lastYaw = this.rotation.y;
    this.lookDeltaY = THREE.MathUtils.lerp(this.lookDeltaY, yawChange, 15 * delta);

    // 1. Powered Up Timer Decay
    if (this.isPoweredUp) {
      this.poweredUpTimer -= delta;
      if (this.poweredUpTimer <= 0) {
        this.isPoweredUp = false;
        this.poweredUpTimer = 0;
        const alertBox = document.getElementById('weapon-alert');
        if (alertBox) alertBox.classList.add('hidden');
      }
    }

    // 2. Check Player Death & Life Loss
    if (this.hp <= 0) {
      this.lives--;
      this.audio.playPlayerDeathSound();

      if (this.lives > 0) {
        // Respawn locally
        this.spawnAt(this.map.playerSpawn);
        if (this.engine) {
          this.engine.showFloatingText(`LIVES REMAINING: ${this.lives}`, "go-red");
          // Reset all ghosts positions
          this.engine.enemies.forEach(ghost => ghost.resetPosition());
        }
      } else {
        if (this.engine) {
          this.engine.triggerGameOver();
        }
      }
      return;
    }

    // Keyboard turning logic
    const turnSpeed = 3.2; // Radians per second
    if (this.keys.d) {
      this.rotation.y -= turnSpeed * delta;
    }
    if (this.keys.a) {
      this.rotation.y += turnSpeed * delta;
    }

    // 3. Movement vector calculation (W/S only, no strafing)
    const moveVector = new THREE.Vector3(0, 0, 0);
    if (this.keys.w) moveVector.z -= 1;
    if (this.keys.s) moveVector.z += 1;

    moveVector.normalize();

    const direction = new THREE.Vector3();
    direction.copy(moveVector).applyEuler(new THREE.Euler(0, this.rotation.y, 0));
    direction.multiplyScalar(this.moveSpeed * delta);

    const nextPos = this.position.clone().add(direction);

    // Sliding collision resolution
    const res = this.map.checkCollisions(nextPos, this.radius);
    if (res.collision) {
      nextPos.add(res.normal);
      const doubleCheck = this.map.checkCollisions(nextPos, this.radius);
      if (!doubleCheck.collision) {
        this.position.copy(nextPos);
      }
    } else {
      if (moveVector.length() > 0) {
        this.position.copy(nextPos);
      }
    }

    // Update camera positions
    this.camera.position.copy(this.position);
    this.camera.rotation.copy(this.rotation);

    // 4. BPM simulation based on ghosts proximity
    const baseBPM = 75;
    let proximityFactor = 0;
    if (this.engine && this.engine.enemies) {
      this.engine.enemies.forEach(ghost => {
        if (ghost.isCaptured) return;
        const d = this.position.distanceTo(ghost.position);
        if (d < 8.0) {
          proximityFactor += (8.0 - d) * 10;
        }
      });
    }
    this.bpm = Math.round(baseBPM + proximityFactor + Math.sin(time * 5) * 2);
    if (this.bpmVal) {
      this.bpmVal.innerText = this.bpm;
      const ekgPath = document.getElementById('ekg-path');
      if (ekgPath) {
        const speed = Math.max(0.4, 3.0 - (this.bpm / 200) * 2.5);
        ekgPath.style.animationDuration = `${speed}s`;
      }
    }

    // 5. Manage overlay screen flashes
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= delta;
      if (this.damageFlash) {
        this.damageFlash.style.opacity = `${(this.damageFlashTimer / 0.25) * 0.7}`;
      }
    }
    if (this.healFlashTimer > 0) {
      this.healFlashTimer -= delta;
      if (this.healingFlash) {
        this.healingFlash.style.opacity = `${(this.healFlashTimer / 0.3) * 0.5}`;
      }
    }

    // 6. Collision check eating standard cookies
    this.map.cookies.forEach(cookie => {
      if (cookie.eaten) return;

      const dist = this.position.distanceTo(cookie.mesh.position);
      if (dist < 1.0) {
        cookie.eaten = true;
        this.map.scene.remove(cookie.mesh);

        // Chomp!
        this.audio.playChompSound(this.chompToggle);
        this.chompToggle = !this.chompToggle;

        this.score += 10;
        this.updateHUD();

        // Check if level clear
        const remaining = this.map.cookies.filter(c => !c.eaten).length;
        if (remaining === 0) {
          this.map.setTeleporterActive(true);
          this.audio.playPickupSound(true);
          if (this.engine) {
            this.engine.showFloatingText("TELEPORTER LINK SECURED", "go-green");
          }
        }
      }
    });

    // 7. Collision check eating power cookies
    this.map.powerCookies.forEach(pc => {
      if (pc.eaten) return;

      const dist = this.position.distanceTo(pc.mesh.position);
      if (dist < 1.0) {
        pc.eaten = true;
        this.map.scene.remove(pc.mesh);
        this.map.scene.remove(pc.light);

        // Power up Crunch-Man!
        this.isPoweredUp = true;
        this.poweredUpTimer = this.maxPoweredUpTime;
        this.audio.playPowerUpSound();

        const alertBox = document.getElementById('weapon-alert');
        if (alertBox) {
          alertBox.innerText = "POWERED UP!";
          alertBox.classList.remove('hidden');
        }

        this.score += 50;
        this.updateHUD();
      }
    });

    // 8. Collision check eating cherries/fruit
    this.map.cherries.forEach(cherry => {
      if (cherry.eaten) return;

      const dist = this.position.distanceTo(cherry.mesh.position);
      if (dist < 1.0) {
        cherry.eaten = true;
        this.map.scene.remove(cherry.mesh);
        this.map.scene.remove(cherry.light);

        // Eat fruit
        this.audio.playPickupSound(false);
        this.score += 100;
        this.heal(30);
      }
    });
  }

  updateHUD() {
    if (this.hpVal) this.hpVal.innerText = this.lives;

    // Display score text dynamically
    const scoreLabel = document.querySelector('#status-panel .bar-label');
    if (scoreLabel) {
      scoreLabel.innerText = `SCORE: ${this.score}`;
    }

    // Cookie eaten progress bar
    const totalCookies = this.map.cookies.length;
    if (totalCookies > 0 && this.shieldBar) {
      const eatenCookies = this.map.cookies.filter(c => c.eaten).length;
      const pct = Math.round((eatenCookies / totalCookies) * 100);
      this.shieldBar.style.width = `${pct}%`;

      if (this.tempVal) {
        this.tempVal.innerText = `${eatenCookies}/${totalCookies}`;
      }
    } else {
      if (this.shieldBar) this.shieldBar.style.width = '0%';
      if (this.tempVal) this.tempVal.innerText = '0/0';
    }

    // Powered Up timer indicators
    if (this.batteryVal) {
      this.batteryVal.innerText = this.isPoweredUp ? `${Math.ceil(this.poweredUpTimer)}s` : '0s';
    }
    if (this.heatFill) {
      const pct = this.isPoweredUp ? (this.poweredUpTimer / this.maxPoweredUpTime) * 100 : 0;
      this.heatFill.style.width = `${pct}%`;
    }
  }
}
