import * as THREE from 'three';
import { Levels } from './MapData.js';
import { Map } from './Map.js';
import { Player } from './Player.js';
import { Weapon } from './Weapon.js';
import { AudioSystem } from './AudioSystem.js';
import { Enemy } from './Enemy.js';
import { NetworkSystem } from './NetworkSystem.js';
import { RemotePlayer } from './RemotePlayer.js';
import { ConsoleAIApi } from './ConsoleAIApi.js';

export class GameEngine {
  constructor() {
    this.canvasContainer = document.getElementById('canvas-container');
    this.levelDisplay = document.getElementById('level-display');
    this.levelOverlay = document.getElementById('level-overlay');
    this.levelTitle = document.getElementById('level-title');
    this.levelDesc = document.getElementById('level-desc');

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // Systems
    this.audio = new AudioSystem();
    this.network = new NetworkSystem(this);
    this.map = null;
    this.player = null;
    this.weapon = null;
    this.remotePlayers = {};

    // Entities
    this.enemies = [];
    this.projectiles = [];

    // Game States
    this.currentLevelIndex = 0;
    this.isDead = false;
    this.isVictory = false;
    this.isPaused = false;
    this.isRunning = false;
    this.elapsedTime = 0.0;
  }

  init() {
    this.audio.init();

    // 1. Three.js Scene setup
    this.scene = new THREE.Scene();
    // Add dark, spooky retro haze fog
    this.scene.fog = new THREE.FogExp2(0x020205, 0.08);

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    this.scene.add(this.camera);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x020205);
    
    // Low-res retro screen multiplier
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    
    this.canvasContainer.innerHTML = '';
    this.canvasContainer.appendChild(this.renderer.domElement);

    // 4. Initialize Main Systems
    this.map = new Map(this.scene);
    this.player = new Player(this.camera, this.map, this.audio);
    this.player.engine = this;
    this.weapon = new Weapon(this.camera, this.scene, this.player, this.audio);
    this.aiApi = new ConsoleAIApi(this);

    // 5. Load level one
    this.loadLevel(0);

    // Event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Begin looping
    this.isRunning = true;
    this.clock.getDelta(); // Reset clock
    this.animate();
  }

  requestLock() {
    this.renderer.domElement.requestPointerLock();
  }

  loadLevel(index) {
    if (index >= Levels.length) {
      this.triggerVictory();
      return;
    }

    this.currentLevelIndex = index;
    const levelData = Levels[index];

    // Clear old level components
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.projectiles = [];

    // Compile 3D grid map
    this.map.loadLevel(levelData);

    // Position player
    this.player.spawnAt(this.map.playerSpawn);

    // Spawn enemies
    this.map.enemySpawns.forEach((spawn, idx) => {
      const enemy = new Enemy(
        spawn.type,
        spawn.position,
        this.scene,
        this.map,
        this.player,
        this.audio,
        this.onEnemyKilled.bind(this)
      );
      enemy.id = `g_${idx}`;
      enemy.engine = this;
      this.enemies.push(enemy);
    });

    // Notify WebSocket server of new level state if we are the Host
    if (this.network.isConnected && this.network.isHost) {
      this.network.sendLevelInit(index, this.enemies);
    }

    // Reset components
    this.weapon.stopFiring();
    this.map.setTeleporterActive(false);

    // HUD level title updates
    if (this.levelDisplay) {
      this.levelDisplay.innerText = `SECTOR 0${index + 1}`;
    }

    // Trigger Notification overlay banner
    if (this.levelOverlay && this.levelTitle && this.levelDesc) {
      this.levelTitle.innerText = levelData.name;
      this.levelDesc.innerText = levelData.description;
      this.levelOverlay.classList.remove('hidden');
      
      // Auto hide after 4 seconds
      setTimeout(() => {
        this.levelOverlay.classList.add('hidden');
      }, 4000);
    }

    // Play teleporter effect sound
    this.audio.playTeleportSound();
  }

  onEnemyKilled(enemy) {
    // Left for backward compatibility; points and capture displays handled locally
  }

  showFloatingText(msg, styleClass) {
    const notify = document.createElement('div');
    notify.className = `notification ${styleClass}`;
    notify.innerHTML = `<div class="notification-content"><p>${msg}</p></div>`;
    document.body.appendChild(notify);
    setTimeout(() => notify.remove(), 3000);
  }

  levelUp() {
    this.loadLevel(this.currentLevelIndex + 1);
  }

  triggerGameOver() {
    this.isDead = true;
    this.network.disconnect();
    document.exitPointerLock();
    this.weapon.stopFiring();

    const hud = document.getElementById('hud-container');
    const gameOverScreen = document.getElementById('game-over-container');
    
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
  }

  triggerVictory() {
    this.isVictory = true;
    this.network.disconnect();
    document.exitPointerLock();
    this.weapon.stopFiring();

    const hud = document.getElementById('hud-container');
    const victoryScreen = document.getElementById('victory-container');
    
    hud.classList.add('hidden');
    victoryScreen.classList.remove('hidden');
  }

  reset() {
    this.isDead = false;
    this.isVictory = false;
    this.isPaused = false;
    this.elapsedTime = 0.0;
    this.player.score = 0;
    this.player.lives = 3;
    this.network.disconnect();
    
    // Clear remote players from visual scene
    if (this.remotePlayers) {
      Object.keys(this.remotePlayers).forEach(id => {
        this.remotePlayers[id].destroy();
      });
      this.remotePlayers = {};
    }
    
    this.loadLevel(0);
  }

  pause() {
    this.isPaused = true;
    this.weapon.stopFiring();
  }

  resume() {
    this.isPaused = false;
    this.clock.getDelta(); // reset clock delta to avoid jumps
    this.audio.resume();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    if (!this.isRunning) return;
    requestAnimationFrame(this.animate.bind(this));

    const delta = Math.min(0.08, this.clock.getDelta());
    this.elapsedTime = (this.elapsedTime || 0) + delta;
    const time = this.elapsedTime;

    if (this.isPaused || this.isDead || this.isVictory) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // 1. Update Player Movement & Collision
    this.player.update(delta, time);

    // 2. Update Map Elements (pickups, teleporters)
    this.map.update(time, delta);

    // Speed up and pitch shift siren drone based on cookie eating progress!
    const activeCookies = this.map.cookies.filter(c => !c.eaten).length;
    const totalCookies = this.map.cookies.length;
    this.audio.updateSirenSpeed(activeCookies, totalCookies);

    // Check exit teleporter collision
    if (this.map.teleporter && this.map.teleporter.active) {
      const dist = this.player.position.distanceTo(new THREE.Vector3(this.map.teleporter.pos.x, this.player.position.y, this.map.teleporter.pos.y));
      if (dist < 1.0) {
        if (this.network.isConnected) {
          if (this.network.isHost) {
            this.levelUp(); // Host advances and broadcasts level init
          }
        } else {
          this.levelUp(); // Offline single-player progression
        }
        return;
      }
    }

    // 3. Update Weapon (Chomper Jaws animation)
    this.weapon.update(delta, time, this.enemies);

    // 4. Update Ghost Enemies AI
    this.enemies.forEach(enemy => {
      enemy.update(delta, time, this.projectiles);
    });

    // 4.5. Update Remote Players (position interpolation)
    if (this.remotePlayers) {
      Object.keys(this.remotePlayers).forEach(id => {
        this.remotePlayers[id].update(delta, time);
      });
    }

    // 5. Update Ectoplasm Projectiles
    this.updateProjectiles(delta);

    // 6. Draw 2D Maze Minimap
    this.updateMazeHUD();

    // 7. Render 3D viewport scene
    this.renderer.render(this.scene, this.camera);
  }

  updateProjectiles(delta) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += delta;

      // Translate projectile forwards
      p.mesh.position.addScaledVector(p.dir, p.speed * delta);

      // Check range bounds expiry
      if (p.age > 4.0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check wall intersection collisions
      const wallCheck = this.map.checkCollisions(p.mesh.position, 0.2);
      if (wallCheck.collision) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check player hits
      const distToPlayer = p.mesh.position.distanceTo(this.player.position);
      if (distToPlayer < 0.2 + this.player.radius) {
        // Hit player (damage dealt: 15 HP)
        this.player.takeDamage(15);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
    }
  }

  updateMazeHUD() {
    const canvas = document.getElementById('maze-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear background
    ctx.fillStyle = '#02020a';
    ctx.fillRect(0, 0, w, h);

    if (!this.map || !this.map.grid || this.map.grid.length === 0) return;

    const gridWidth = this.map.width;
    const gridHeight = this.map.height;

    // Scale mapping to canvas size
    const cellSizePixel = Math.min(w / gridWidth, h / gridHeight);
    const offsetX = (w - gridWidth * cellSizePixel) / 2;
    const offsetY = (h - gridHeight * cellSizePixel) / 2;

    // 1. Draw Grid Walls
    ctx.fillStyle = '#1d4ed8'; // solid retro blue walls
    for (let r = 0; r < gridHeight; r++) {
      for (let c = 0; c < gridWidth; c++) {
        const val = this.map.grid[r][c];
        if (val === 1) {
          ctx.fillStyle = '#1d4ed8'; // wall A - blue
          ctx.fillRect(
            offsetX + c * cellSizePixel + 1,
            offsetY + r * cellSizePixel + 1,
            cellSizePixel - 2,
            cellSizePixel - 2
          );
        } else if (val === 2) {
          ctx.fillStyle = '#db2777'; // wall B - pink
          ctx.fillRect(
            offsetX + c * cellSizePixel + 1,
            offsetY + r * cellSizePixel + 1,
            cellSizePixel - 2,
            cellSizePixel - 2
          );
        }
      }
    }

    // 2. Draw Standard Cookies (using their individual random color)
    this.map.cookies.forEach(cookie => {
      if (cookie.eaten) return;
      
      const px = offsetX + cookie.gridX * cellSizePixel + cellSizePixel / 2;
      const py = offsetY + cookie.gridZ * cellSizePixel + cellSizePixel / 2;
      
      ctx.fillStyle = '#' + cookie.color.toString(16).padStart(6, '0');
      ctx.beginPath();
      ctx.arc(px, py, 2.0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. Draw Power Cookies (flashing orange)
    this.map.powerCookies.forEach(pc => {
      if (pc.eaten) return;
      
      const px = offsetX + pc.gridX * cellSizePixel + cellSizePixel / 2;
      const py = offsetY + pc.gridZ * cellSizePixel + cellSizePixel / 2;

      // Pulse circle radius
      const pulse = 3.0 + Math.abs(Math.sin(this.elapsedTime * 8)) * 1.5;
      
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(px, py, pulse, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Draw Cherries/Fruit
    this.map.cherries.forEach(cherry => {
      if (cherry.eaten) return;

      const px = offsetX + cherry.gridX * cellSizePixel + cellSizePixel / 2;
      const py = offsetY + cherry.gridZ * cellSizePixel + cellSizePixel / 2;

      ctx.fillStyle = '#ef4444'; // cherry red double circle
      ctx.beginPath();
      ctx.arc(px - 2, py + 1, 2.0, 0, Math.PI * 2);
      ctx.arc(px + 2, py - 1, 2.0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 5. Draw Exit Teleporter (green if active, red otherwise)
    if (this.map.teleporter) {
      const gridX = Math.round(this.map.teleporter.pos.x / this.map.cellSize);
      const gridZ = Math.round(this.map.teleporter.pos.y / this.map.cellSize);

      if (this.map.teleporter.active) {
        ctx.fillStyle = Math.floor(this.elapsedTime * 4) % 2 === 0 ? '#00ff66' : '#047857';
      } else {
        ctx.fillStyle = '#7f1d1d';
      }
      ctx.fillRect(
        offsetX + gridX * cellSizePixel + 2,
        offsetY + gridZ * cellSizePixel + 2,
        cellSizePixel - 4,
        cellSizePixel - 4
      );
    }

    // 6. Draw Player (white triangle pointed in direction of rotation.y)
    if (this.player) {
      const playerGridX = this.player.position.x / this.map.cellSize;
      const playerGridZ = this.player.position.z / this.map.cellSize;

      const px = offsetX + playerGridX * cellSizePixel;
      const py = offsetY + playerGridZ * cellSizePixel;

      const angle = this.player.rotation.y;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-angle + Math.PI); // Orient triangle to point forward

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(-4.5, 4.5);
      ctx.lineTo(4.5, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 7. Draw Ghosts
    this.enemies.forEach(ghost => {
      if (ghost.isEaten) return;

      const ghostGridX = ghost.position.x / this.map.cellSize;
      const ghostGridZ = ghost.position.z / this.map.cellSize;

      const px = offsetX + ghostGridX * cellSizePixel;
      const py = offsetY + ghostGridZ * cellSizePixel;

      if (this.player.isPoweredUp) {
        if (this.player.poweredUpTimer < 3.0) {
          // Flash blue/white warning
          ctx.fillStyle = Math.floor(this.elapsedTime * 4) % 2 === 0 ? '#ffffff' : '#0055ff';
        } else {
          ctx.fillStyle = '#0055ff';
        }
      } else {
        // Normal type colors
        if (ghost.type === 4) ctx.fillStyle = '#22c55e'; // green
        else if (ghost.type === 5) ctx.fillStyle = '#ec4899'; // pink
        else if (ghost.type === 6) ctx.fillStyle = '#3b82f6'; // blue
      }

      ctx.beginPath();
      ctx.arc(px, py, 4.0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  spawnRemotePlayer(id, username) {
    if (!this.remotePlayers) this.remotePlayers = {};
    if (!this.remotePlayers[id]) {
      this.remotePlayers[id] = new RemotePlayer(id, username, this.scene);
    }
  }

  removeRemotePlayer(id) {
    if (this.remotePlayers && this.remotePlayers[id]) {
      this.remotePlayers[id].destroy();
      delete this.remotePlayers[id];
    }
  }

  updateRemotePlayer(id, pos, yaw, isFiring, beamTarget) {
    if (this.remotePlayers && this.remotePlayers[id]) {
      this.remotePlayers[id].updateState(pos, yaw, isFiring, beamTarget);
    }
  }
}
