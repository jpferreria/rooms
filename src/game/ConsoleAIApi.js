export class ConsoleAIApi {
  constructor(engine) {
    this.engine = engine;
    this.setupGlobalBindings();
  }

  setupGlobalBindings() {
    window.boomAI = {
      // 1. Get entire engine telemetry state
      getState: () => {
        const p = this.engine.player;
        const w = this.engine.weapon;
        
        if (!p) return { error: 'Game not initialized yet' };

        return {
          hp: p.hp,
          maxHp: p.maxHp,
          shield: p.shield,
          maxShield: p.maxShield,
          battery: p.battery,
          maxBattery: p.maxBattery,
          position: p.position.toArray(),
          yaw: p.rotation.y,
          pitch: p.rotation.x,
          isFiring: w.isFiring,
          heat: w.heat,
          isOverheated: w.isOverheated,
          levelIndex: this.engine.currentLevelIndex,
          ghosts: this.engine.enemies
            .filter(e => !e.isCaptured)
            .map(e => ({
              id: e.id,
              type: e.type,
              position: e.position.toArray(),
              hp: e.hp,
              maxHp: e.maxHp
            }))
        };
      },

      // 2. Control player movement
      move: (controls) => {
        const p = this.engine.player;
        if (!p) return false;

        // Clear all keys first if controls is a string
        if (typeof controls === 'string') {
          const action = controls.toLowerCase();
          
          p.keys.w = false;
          p.keys.a = false;
          p.keys.s = false;
          p.keys.d = false;

          if (action === 'w' || action === 'forward') p.keys.w = true;
          else if (action === 's' || action === 'backward') p.keys.s = true;
          else if (action === 'a' || action === 'left') p.keys.a = true;
          else if (action === 'd' || action === 'right') p.keys.d = true;
          else if (action === 'stop') {
            // Already cleared
          }
          console.log('[Zoom AI] Movement updated:', controls);
          return true;
        }

        // Object bitmask override e.g. { w: true, a: false }
        if (typeof controls === 'object') {
          if (controls.w !== undefined) p.keys.w = !!controls.w;
          if (controls.a !== undefined) p.keys.a = !!controls.a;
          if (controls.s !== undefined) p.keys.s = !!controls.s;
          if (controls.d !== undefined) p.keys.d = !!controls.d;
          console.log('[Zoom AI] Keys bitmask applied:', controls);
          return true;
        }

        return false;
      },

      // 3. Aim at target coordinates in the room
      lookAt: (x, z) => {
        const p = this.engine.player;
        if (!p) return false;

        const dx = x - p.position.x;
        const dz = z - p.position.z;
        
        // Calculate yaw rotation (Three.js camera coordinates: -Z is straight ahead)
        const angle = Math.atan2(-dx, -dz);
        p.rotation.y = angle;
        p.camera.rotation.y = angle;

        console.log(`[Zoom AI] Rotated facing angle to: ${angle.toFixed(3)} rad targeting (${x}, ${z})`);
        return true;
      },

      // 4. Trigger weapons
      fire: (durationSeconds = 0.5) => {
        const w = this.engine.weapon;
        if (!w || w.isOverheated) return false;

        console.log(`[Zoom AI] Activating stream for ${durationSeconds}s`);
        w.startFiring();

        if (durationSeconds > 0) {
          setTimeout(() => {
            w.stopFiring(true); // Force stop
            console.log('[Zoom AI] Firing burst duration expired');
          }, durationSeconds * 1000);
        }
        return true;
      },

      // 5. Vent core coolant
      vent: () => {
        const w = this.engine.weapon;
        if (!w) return false;

        console.log('[Zoom AI] Triggering core venting sequence');
        w.startVenting();
        return true;
      }
    };
  }
}
