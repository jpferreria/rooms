import * as THREE from 'three';

export class Weapon {
  constructor(camera, scene, player, audio) {
    this.camera = camera;
    this.scene = scene;
    this.player = player;
    this.audio = audio;

    // Crunch Jaws properties
    this.isFiring = false; // flag representing left-click chomping
    this.chompSpeed = 12.0;

    // Mouth 3D Group
    this.gunGroup = new THREE.Group();
    
    // Jaws parts
    this.upperJawGroup = null;
    this.lowerJawGroup = null;
    
    this.createGunModel();
    this.camera.add(this.gunGroup); // Attach mouth to camera so it stays in FPS view

    this.setupInputs();
  }

  createGunModel() {
    // Crunch-Man Jaws (Neon Yellow hemispheres to form a sphere, retro Pacman style)
    this.upperJawGroup = new THREE.Group();
    this.lowerJawGroup = new THREE.Group();

    // Create upper hemisphere (theta from 0 to Pi/2)
    const upperGeo = new THREE.SphereGeometry(0.18, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    const jawMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });

    const upperMesh = new THREE.Mesh(upperGeo, jawMat);
    this.upperJawGroup.add(upperMesh);

    // Add Pac-Man retro black eyes on the upper hemisphere
    const eyeGeo = new THREE.SphereGeometry(0.024, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.1, 0.09, -0.1);
    this.upperJawGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(-0.1, 0.09, -0.1);
    this.upperJawGroup.add(rightEye);

    // Create lower hemisphere (theta from Pi/2 to Pi)
    const lowerGeo = new THREE.SphereGeometry(0.18, 20, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const lowerMesh = new THREE.Mesh(lowerGeo, jawMat);
    this.lowerJawGroup.add(lowerMesh);

    // Position pivots inside mouth group (origin is at the center of the sphere)
    this.upperJawGroup.position.set(0, 0, -0.22);
    this.lowerJawGroup.position.set(0, 0, -0.22);

    this.gunGroup.add(this.upperJawGroup);
    this.gunGroup.add(this.lowerJawGroup);

    // Position mouth centered at the bottom of the screen
    this.gunGroup.position.set(0, -0.24, -0.35);
  }

  setupInputs() {
    window.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement && e.button === 0) {
        this.startFiring();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.stopFiring();
      }
    });
  }

  startFiring() {
    this.isFiring = true;
    if (this.player) {
      this.player.keys.fire = true;
    }
    // Play manual bite sound
    if (this.audio) {
      this.audio.playChompSound(true);
    }
  }

  stopFiring() {
    this.isFiring = false;
    if (this.player) {
      this.player.keys.fire = false;
    }
  }

  update(delta, time, enemies) {
    // Check if player is moving
    const isMoving = this.player && (this.player.keys.w || this.player.keys.s || this.player.keys.a || this.player.keys.d);
    
    // Choose chomp speed: very fast if left-clicking, normal if walking, stationary if standing still
    let activeChomp = false;
    let speed = this.chompSpeed;

    if (this.isFiring) {
      activeChomp = true;
      speed = 24.0; // Rapid biting on click
    } else if (isMoving) {
      activeChomp = true;
      speed = 12.0; // Standard walking chomps
    }

    if (activeChomp) {
      const maxAngle = 0.45; // opening angle (approx 25 degrees)
      const angle = Math.abs(Math.sin(time * speed)) * maxAngle;
      
      this.upperJawGroup.rotation.x = angle;
      this.lowerJawGroup.rotation.x = -angle;

      // Subtle chomp vibration for camera bobbing
      this.gunGroup.position.y = -0.24 + Math.sin(time * speed * 2) * 0.008;
    } else {
      // Return to closed jaw position
      this.upperJawGroup.rotation.x = THREE.MathUtils.lerp(this.upperJawGroup.rotation.x, 0, 10 * delta);
      this.lowerJawGroup.rotation.x = THREE.MathUtils.lerp(this.lowerJawGroup.rotation.x, 0, 10 * delta);
      this.gunGroup.position.y = THREE.MathUtils.lerp(this.gunGroup.position.y, -0.24, 10 * delta);
    }

    // Dynamic visual head turning lag/response
    if (this.player) {
      const targetYawOffset = this.player.lookDeltaY * -2.5; // Scale factor for visual turn lag
      const clampedYaw = Math.max(-0.4, Math.min(0.4, targetYawOffset));
      this.gunGroup.rotation.y = THREE.MathUtils.lerp(this.gunGroup.rotation.y, clampedYaw, 10 * delta);
    }
  }

  // Stubs for legacy code compatibility
  stopFiringForce() { this.stopFiring(); }
  updateHUD() {}
}
