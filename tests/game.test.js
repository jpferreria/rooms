import test from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';

// 1. Setup mock browser environment
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  AudioContext: class {
    createOscillator() {
      return {
        type: 'sine',
        frequency: { 
          setValueAtTime: () => {}, 
          exponentialRampToValueAtTime: () => {}, 
          linearRampToValueAtTime: () => {}, 
          setTargetAtTime: () => {}, 
          value: 0 
        },
        connect: () => {},
        start: () => {},
        stop: () => {}
      };
    }
    createGain() {
      return {
        gain: { 
          setValueAtTime: () => {}, 
          exponentialRampToValueAtTime: () => {}, 
          setTargetAtTime: () => {}, 
          linearRampToValueAtTime: () => {}, 
          value: 0 
        },
        connect: () => {}
      };
    }
    get destination() {
      return {};
    }
  },
  location: { hostname: 'localhost' }
};

globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: (id) => {
    return {
      style: {},
      innerText: '',
      classList: {
        add: () => {},
        remove: () => {}
      },
      appendChild: () => {},
      remove: () => {}
    };
  },
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        width: 100,
        height: 100,
        getContext: () => ({
          imageSmoothingEnabled: false,
          fillRect: () => {},
          strokeRect: () => {},
          beginPath: () => {},
          arc: () => {},
          lineTo: () => {},
          moveTo: () => {},
          fill: () => {},
          stroke: () => {},
          closePath: () => {},
          createPattern: () => {},
          drawImage: () => {}
        })
      };
    }
    return {
      style: {},
      innerText: '',
      innerHTML: '',
      className: '',
      appendChild: () => {},
      remove: () => {}
    };
  },
  querySelector: () => ({
    innerText: '',
    style: {}
  })
};

// 2. Import game classes
import { Player } from '../src/game/Player.js';
import { Enemy } from '../src/game/Enemy.js';
import { AudioSystem } from '../src/game/AudioSystem.js';
import { Map } from '../src/game/Map.js';

// Setup Mock Level Map (longer path to allow X-axis movement checks)
const mockLevelData = {
  name: "TEST LEVEL",
  description: "TEST",
  grid: [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 3, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1]
  ]
};

test("Rooms! Game Logic Unit Tests", async (t) => {

  await t.test("Player eats standard cookies on collision", () => {
    const scene = new THREE.Scene();
    const map = new Map(scene);
    map.loadLevel(mockLevelData);

    const audio = new AudioSystem();
    audio.init();

    const player = new Player(new THREE.Camera(), map, audio);
    player.spawnAt(new THREE.Vector3(3, 1.2, 3)); // Player pos
    
    // Check that we have cookies spawned
    assert.ok(map.cookies.length > 0);
    
    // Manually place a cookie right on top of the player
    const cookie = map.cookies[0];
    cookie.eaten = false;
    cookie.mesh.position.set(3, 0.7, 3);

    // Call update to trigger collision
    player.update(0.1, 0);

    assert.strictEqual(cookie.eaten, true, "Cookie should be eaten");
    assert.ok(player.score >= 10, "Score should increase");
  });

  await t.test("Player eats power cookies and triggers powered-up mode", () => {
    const scene = new THREE.Scene();
    const map = new Map(scene);
    map.loadLevel(mockLevelData);
    
    const audio = new AudioSystem();
    audio.init();

    const player = new Player(new THREE.Camera(), map, audio);
    player.spawnAt(new THREE.Vector3(3, 1.2, 3));

    // Spawn a power cookie at player coordinates
    map.spawnPowerCookie(3, 3, 1, 1);
    assert.strictEqual(map.powerCookies.length, 1);
    
    const pc = map.powerCookies[0];
    assert.strictEqual(pc.eaten, false);

    // Mark standard cookies as eaten so they don't interfere with the score
    map.cookies.forEach(c => c.eaten = true);

    // Reset score to isolate power cookie increment
    player.score = 0;

    player.update(0.1, 0);

    assert.strictEqual(pc.eaten, true, "Power cookie should be consumed");
    assert.strictEqual(player.isPoweredUp, true, "Player should be powered up");
    assert.strictEqual(player.poweredUpTimer, 10.0, "Timer should be set to 10 seconds");
    assert.strictEqual(player.score, 50, "Score should increase by exactly 50");
  });

  await t.test("Ghosts flee from player when player is powered-up", () => {
    const scene = new THREE.Scene();
    const map = new Map(scene);
    map.loadLevel(mockLevelData);
    
    const audio = new AudioSystem();
    audio.init();

    const player = new Player(new THREE.Camera(), map, audio);
    player.spawnAt(new THREE.Vector3(3, 1.2, 3)); // Player at X=3

    // Ghost at X=12 (Col 4)
    const ghost = new Enemy(
      4, // Green Ghost
      new THREE.Vector3(12, 1.2, 3),
      scene,
      map,
      player,
      audio,
      () => {}
    );

    // Test 1: Normal mode (chasing player)
    player.isPoweredUp = false;
    ghost.update(0.1, 0, []);
    
    // Ghost should move towards player (X should decrease towards 3)
    assert.ok(ghost.position.x < 12.0, "Ghost should move closer to the player in normal mode");

    // Test 2: Powered-up mode (fleeing player)
    player.isPoweredUp = true;
    ghost.position.set(12, 1.2, 3); // Reset position
    ghost.update(0.1, 0, []);

    // Ghost should move away from player (X should increase towards >12.0)
    assert.ok(ghost.position.x > 12.0, "Ghost should move away from player when vulnerable");
  });

  await t.test("Vulnerable ghosts get eaten on contact", () => {
    const scene = new THREE.Scene();
    const map = new Map(scene);
    map.loadLevel(mockLevelData);
    
    const audio = new AudioSystem();
    audio.init();

    const player = new Player(new THREE.Camera(), map, audio);
    player.spawnAt(new THREE.Vector3(3, 1.2, 3));
    player.isPoweredUp = true;
    player.score = 0;

    // Place ghost directly on player coordinates
    const ghost = new Enemy(
      4,
      new THREE.Vector3(3, 1.2, 3),
      scene,
      map,
      player,
      audio,
      () => {}
    );
    ghost.player = player;

    ghost.update(0.1, 0, []);

    assert.strictEqual(ghost.isEaten, true, "Ghost should enter eaten state");
    assert.strictEqual(ghost.mesh.visible, false, "Ghost mesh should be hidden");
    assert.strictEqual(player.score, 200, "Score should increase by 200");
    assert.strictEqual(ghost.respawnTimer, 5.0, "Ghost should have a 5 second respawn timer");
  });

  await t.test("Normal ghosts kill player on contact, decrementing lives", () => {
    const scene = new THREE.Scene();
    const map = new Map(scene);
    map.loadLevel(mockLevelData);
    
    const audio = new AudioSystem();
    audio.init();

    const player = new Player(new THREE.Camera(), map, audio);
    player.spawnAt(new THREE.Vector3(3, 1.2, 3));
    player.isPoweredUp = false;
    player.lives = 3;
    player.hp = 100;

    // Place normal ghost directly on player coordinates
    const ghost = new Enemy(
      4,
      new THREE.Vector3(3, 1.2, 3),
      scene,
      map,
      player,
      audio,
      () => {}
    );

    ghost.update(0.1, 0, []);

    assert.strictEqual(player.hp, 0, "Player should take 100 damage (hp=0)");

    // Player update will handle life decrement & respawning
    player.update(0.1, 0);

    assert.strictEqual(player.lives, 2, "Player should lose 1 life");
    assert.strictEqual(player.hp, 100, "Player should respawn with full health");
    assert.strictEqual(ghost.position.x, ghost.spawnPos.x, "Ghost should be sent back to spawn position");
  });
});
