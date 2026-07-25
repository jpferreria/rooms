export class NetworkSystem {
  constructor(engine) {
    this.engine = engine;
    this.socket = null;
    this.playerId = null;
    this.isHost = false;
    this.isConnected = false;
    
    this.statusEl = document.getElementById('connection-status');
    this.sendInterval = null;
  }

  connect(username) {
    // Auto-detect server address based on where the web app is served from!
    // Connects to ws://localhost:8080 or ws://192.168.x.x:8080 dynamically.
    const host = window.location.hostname || 'localhost';
    const port = '8080';
    const url = `ws://${host}:${port}`;

    console.log(`[Zoom Network] Connecting to ${url}...`);
    if (this.statusEl) {
      this.statusEl.innerText = `// ESTABLISHING CONNECTION TO ${url} //`;
    }

    try {
      this.socket = new WebSocket(url);
      this.setupHandlers(username);
    } catch (e) {
      console.error('[Zoom Network] WebSocket initiation failed:', e);
      this.onConnectionFailed();
    }
  }

  setupHandlers(username) {
    this.socket.onopen = () => {
      this.isConnected = true;
      console.log('[Zoom Network] Socket connection open.');
      
      // Join lobby
      this.socket.send(JSON.stringify({
        type: 'join',
        username: username
      }));

      if (this.statusEl) {
        this.statusEl.innerText = `// LOBBY SECURED // CALLSIGN: ${username}`;
        this.statusEl.classList.remove('disconnected');
      }

      // Start coordinate sync loop (30 ticks per second)
      this.startSyncLoop();
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'init':
            this.playerId = data.playerId;
            this.isHost = data.isHost;
            console.log(`[Zoom Network] Initialized. ID: ${this.playerId}, Host: ${this.isHost}`);

            // Initialize level from host if level is already running
            if (data.levelIndex !== this.engine.currentLevelIndex) {
              this.engine.loadLevel(data.levelIndex);
            } else if (this.isHost && this.engine.enemies.length > 0) {
              // Level matches, but we need to upload the initial ghost list since we were offline at spawn
              this.sendLevelInit(this.engine.currentLevelIndex, this.engine.enemies);
            }

            // Sync other connected players
            Object.keys(data.players).forEach(id => {
              if (id !== this.playerId) {
                this.engine.spawnRemotePlayer(id, data.players[id].username);
              }
            });

            // Sync ghost health states
            if (data.ghosts && data.ghosts.length > 0) {
              this.syncSharedGhosts(data.ghosts);
            }

            // Sync sector clear pad
            if (data.sectorCleared) {
              this.engine.map.setTeleporterActive(true);
            }
            break;

          case 'hostChange':
            this.isHost = data.isHost;
            console.log(`[Zoom Network] Host authority shifted to this client!`);
            this.engine.showFloatingText('LOBBY HOST DELEGATED', 'go-orange');
            break;

          case 'playerJoined':
            console.log(`[Zoom Network] Remote player joined: ${data.username}`);
            this.engine.spawnRemotePlayer(data.playerId, data.username);
            this.engine.showFloatingText(`${data.username} JOINED SECTOR`, 'go-cyan');
            break;

          case 'playerLeft':
            console.log(`[Zoom Network] Remote player disconnected: ${data.playerId}`);
            this.engine.removeRemotePlayer(data.playerId);
            break;

          case 'lobbyState':
            // Sync all remote players coordinates
            Object.keys(data.players).forEach(id => {
              if (id !== this.playerId) {
                const rp = data.players[id];
                this.engine.updateRemotePlayer(id, rp.pos, rp.yaw, rp.isFiring, rp.beamTarget);
              }
            });
            break;

          case 'syncLevel':
            // Relayed level change from host
            if (data.levelIndex !== this.engine.currentLevelIndex) {
              this.engine.loadLevel(data.levelIndex);
            }
            this.syncSharedGhosts(data.ghosts);
            break;

          case 'ghostUpdate':
            // Sync ghost coordinates from Host (ignore if host)
            if (!this.isHost) {
              data.ghosts.forEach(ug => {
                const cg = this.engine.enemies.find(g => g.id === ug.id);
                if (cg) {
                  cg.position.fromArray(ug.pos);
                  cg.mesh.position.copy(cg.position);
                }
              });
            }
            break;

          case 'ghostDrained':
            // Shared ghost took damage
            const dg = this.engine.enemies.find(g => g.id === data.ghostId);
            if (dg) {
              dg.hp = data.hp;
              // Visual red flash and shrink scale
              dg.mesh.material.color.setHex(0xff3333);
              const ratio = Math.max(0.3, dg.hp / dg.maxHp);
              const originalScale = dg.type === 6 ? 2.2 : 1.2;
              dg.mesh.scale.set(originalScale * ratio, originalScale * ratio, 1);
            }
            break;

          case 'ghostCaptured':
            // Shared ghost captured
            const cg = this.engine.enemies.find(g => g.id === data.ghostId);
            if (cg) {
              cg.hp = 0;
              cg.isCaptured = true;
              this.engine.scene.remove(cg.mesh);
              this.engine.audio.playPickupSound(false);
              this.engine.onEnemyKilled(cg);
            }
            break;

          case 'sectorCleared':
            // Level cleared notification
            this.engine.map.setTeleporterActive(true);
            this.engine.showFloatingText("TELEPORTER LINK SECURED", "go-green");
            this.engine.audio.playPickupSound(true);
            break;

          case 'cookieEaten':
            const idx = data.cookieIndex;
            if (this.engine.map.cookies[idx]) {
              const cookie = this.engine.map.cookies[idx];
              if (!cookie.eaten) {
                cookie.eaten = true;
                this.engine.scene.remove(cookie.mesh);
                
                // Check level clear
                const remaining = this.engine.map.cookies.filter(c => !c.eaten).length;
                if (remaining === 0) {
                  this.engine.map.setTeleporterActive(true);
                  this.engine.audio.playPickupSound(true);
                  this.engine.showFloatingText("TELEPORTER LINK SECURED", "go-green");
                }
              }
            }
            break;
        }
      } catch (e) {
        console.error('[Zoom Network] Error processing packet:', e);
      }
    };

    this.socket.onerror = (e) => {
      console.error('[Zoom Network] Socket connection error:', e);
      this.onConnectionFailed();
    };

    this.socket.onclose = () => {
      this.isConnected = false;
      this.playerId = null;
      this.isHost = false;
      console.log('[Zoom Network] Socket connection closed.');
      this.onConnectionFailed();
    };
  }

  startSyncLoop() {
    this.stopSyncLoop();
    this.sendInterval = setInterval(() => {
      if (this.isConnected && this.socket.readyState === 1 && this.engine.player) {
        // Broadcast local coordinate state
        const p = this.engine.player;
        const w = this.engine.weapon;

        // Extract beam target point
        let beamTargetPoint = [0, 0, 0];
        if (w.isFiring && w.beamGeometry) {
          // Send last point of beam
          const arr = w.beamGeometries[0].geom.attributes.position.array;
          const len = w.beamPointsCount;
          beamTargetPoint = [
            arr[(len - 1) * 3],
            arr[(len - 1) * 3 + 1],
            arr[(len - 1) * 3 + 2]
          ];
        }

        this.socket.send(JSON.stringify({
          type: 'state',
          pos: p.position.toArray(),
          yaw: p.rotation.y,
          isFiring: w.isFiring,
          beamTarget: beamTargetPoint
        }));

        // Host sends ghost updates
        if (this.isHost && this.engine.enemies.length > 0) {
          const ghostList = this.engine.enemies
            .filter(g => !g.isCaptured)
            .map(g => ({
              id: g.id,
              pos: g.position.toArray()
            }));

          this.socket.send(JSON.stringify({
            type: 'ghostUpdate',
            ghosts: ghostList
          }));
        }
      }
    }, 45); // ~22 updates/second matches network intervals nicely
  }

  stopSyncLoop() {
    if (this.sendInterval) {
      clearInterval(this.sendInterval);
      this.sendInterval = null;
    }
  }

  sendLevelInit(levelIndex, ghosts) {
    if (this.isConnected && this.isHost) {
      const ghostList = ghosts.map(g => ({
        id: g.id,
        type: g.type,
        pos: g.position.toArray(),
        hp: g.maxHp,
        maxHp: g.maxHp,
        isCaptured: false
      }));

      this.socket.send(JSON.stringify({
        type: 'ghostInit',
        levelIndex: levelIndex,
        ghosts: ghostList
      }));
    }
  }

  sendGhostDrain(ghostId, damage) {
    if (this.isConnected) {
      this.socket.send(JSON.stringify({
        type: 'drainGhost',
        ghostId: ghostId,
        damage: damage
      }));
    }
  }

  syncSharedGhosts(serverGhosts) {
    // Map server IDs to local ghosts
    serverGhosts.forEach((sg, idx) => {
      const localGhost = this.engine.enemies[idx];
      if (localGhost) {
        localGhost.id = sg.id;
        localGhost.hp = sg.hp;
        localGhost.maxHp = sg.maxHp;
        localGhost.isCaptured = sg.isCaptured;
        localGhost.position.fromArray(sg.pos);
        localGhost.mesh.position.copy(localGhost.position);

        if (localGhost.isCaptured) {
          this.engine.scene.remove(localGhost.mesh);
        } else {
          // Shrink size based on health
          const ratio = Math.max(0.3, localGhost.hp / localGhost.maxHp);
          const originalScale = localGhost.type === 6 ? 2.2 : 1.2;
          localGhost.mesh.scale.set(originalScale * ratio, originalScale * ratio, 1);
        }
      }
    });
  }

  sendCookieEaten(index) {
    if (this.isConnected) {
      this.socket.send(JSON.stringify({
        type: 'eatCookie',
        cookieIndex: index
      }));
    }
  }

  sendRequestNextLevel() {
    if (this.isConnected) {
      this.socket.send(JSON.stringify({
        type: 'requestNextLevel'
      }));
    }
  }

  onConnectionFailed() {
    this.isConnected = false;
    this.stopSyncLoop();
    if (this.statusEl) {
      this.statusEl.innerText = '// LINK OFFLINE // PLAYING IN LOCAL OFFLINE MODE //';
      this.statusEl.classList.add('disconnected');
    }
  }

  disconnect() {
    this.stopSyncLoop();
    if (this.socket) {
      this.socket.close();
    }
  }
}
