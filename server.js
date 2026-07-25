import { WebSocketServer } from 'ws';
import http from 'http';
import { Levels } from './src/game/MapData.js';

const wss = new WebSocketServer({ port: 8080 });
console.log('[Zoom Server] WebSocket Server running on port 8080');

const apiPort = process.env.API_PORT || 8001;
const apiServer = http.createServer((req, res) => {
  // Allow cross-origin telemetry requests for AI clients
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      players: players,
      ghosts: ghosts,
      hostId: hostId,
      levelIndex: currentLevelIndex,
      sectorCleared: sectorCleared
    }));
  } else if (url.pathname === '/api/map') {
    const lvl = Levels[currentLevelIndex];
    if (lvl) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: lvl.name,
        description: lvl.description,
        grid: lvl.grid,
        cellSize: 3
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Level index not active' }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
});

apiServer.listen(apiPort, () => {
  console.log(`[Zoom Server] HTTP REST API running on port ${apiPort}`);
});

const clients = new Map(); // id -> socket connection
const players = {};       // id -> { username, pos, yaw, isFiring, beamTarget }
let hostId = null;

// Share ghost states centrally
// id -> { type, pos: [x,y,z], hp, maxHp, isCaptured }
let ghosts = [];
let sectorCleared = false;
let currentLevelIndex = 0;

function selectNewHost() {
  const ids = Array.from(clients.keys());
  if (ids.length > 0) {
    hostId = ids[0]; // Set oldest player as Host
    console.log(`[Zoom Server] Player ${hostId} designated as Host`);
    
    // Notify the new host
    const socket = clients.get(hostId);
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify({ type: 'hostChange', isHost: true }));
    }
  } else {
    hostId = null;
    ghosts = []; // No players left, clear ghosts
    sectorCleared = false;
    currentLevelIndex = 0;
    console.log('[Zoom Server] Lobby empty. Resetted ghost caches.');
  }
}

wss.on('connection', (ws) => {
  const playerId = 'p_' + Math.random().toString(36).substring(2, 9);
  clients.set(playerId, ws);
  console.log(`[Zoom Server] Client connected. Assigned ID: ${playerId}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'join':
          players[playerId] = {
            username: data.username || 'Recruit_' + playerId.substring(2, 5),
            pos: [0, 1.2, 0],
            yaw: 0,
            isFiring: false,
            beamTarget: [0, 0, 0]
          };

          // If first player, designate as host
          if (!hostId) {
            hostId = playerId;
          }

          console.log(`[Zoom Server] Player joined: ${players[playerId].username} (${playerId})`);

          // Send welcome package
          ws.send(JSON.stringify({
            type: 'init',
            playerId: playerId,
            isHost: (playerId === hostId),
            players: players,
            ghosts: ghosts,
            levelIndex: currentLevelIndex,
            sectorCleared: sectorCleared
          }));

          // Broadcast to all other players
          broadcast({
            type: 'playerJoined',
            playerId: playerId,
            username: players[playerId].username
          }, playerId);
          break;

        case 'state':
          // Throttled coordination update
          if (players[playerId]) {
            players[playerId].pos = data.pos;
            players[playerId].yaw = data.yaw;
            players[playerId].isFiring = data.isFiring;
            players[playerId].beamTarget = data.beamTarget;
          }
          break;

        case 'ghostInit':
          // Host uploads initial ghost positions for the level
          if (playerId === hostId) {
            ghosts = data.ghosts;
            sectorCleared = false;
            currentLevelIndex = data.levelIndex;
            console.log(`[Zoom Server] Level ${currentLevelIndex} initialized with ${ghosts.length} ghosts`);
            
            // Sync level to all other clients
            broadcast({
              type: 'syncLevel',
              levelIndex: currentLevelIndex,
              ghosts: ghosts
            }, playerId);
          }
          break;

        case 'ghostUpdate':
          // Host updates active ghost coordinates
          if (playerId === hostId) {
            // Merge coordinates but keep server health states
            data.ghosts.forEach(ug => {
              const cg = ghosts.find(g => g.id === ug.id);
              if (cg) {
                cg.pos = ug.pos;
              }
            });

            // Broadcast to other clients
            broadcast({
              type: 'ghostUpdate',
              ghosts: ghosts
            }, playerId);
          }
          break;

        case 'drainGhost':
          // Any player damages a ghost
          const targetGhost = ghosts.find(g => g.id === data.ghostId);
          if (targetGhost && !targetGhost.isCaptured) {
            targetGhost.hp = Math.max(0, targetGhost.hp - data.damage);

            // Broadcast ghost health update
            broadcast({
              type: 'ghostDrained',
              ghostId: data.ghostId,
              hp: targetGhost.hp
            });

            // Check if captured
            if (targetGhost.hp <= 0) {
              targetGhost.isCaptured = true;
              console.log(`[Zoom Server] Ghost ${data.ghostId} was captured!`);
              
              broadcast({
                type: 'ghostCaptured',
                ghostId: data.ghostId
              });

              // Check if all ghosts captured in level
              const activeCount = ghosts.filter(g => !g.isCaptured).length;
              if (activeCount === 0) {
                sectorCleared = true;
                console.log(`[Zoom Server] Sector cleared! Opening teleporters.`);
                broadcast({
                  type: 'sectorCleared'
                });
              }
            }
          }
          break;

        case 'eatCookie':
          // Relay eaten cookie index to all other lobby clients
          broadcast({
            type: 'cookieEaten',
            cookieIndex: data.cookieIndex
          }, playerId);
          break;

        case 'requestNextLevel':
          // Loop through the 3 sectors
          currentLevelIndex = (currentLevelIndex + 1) % 3;
          ghosts = [];
          sectorCleared = false;
          console.log(`[Zoom Server] Sector advanced to Sector ${currentLevelIndex + 1} by player ${playerId}`);
          
          // Broadcast syncLevel to all players to transition them together
          broadcast({
            type: 'syncLevel',
            levelIndex: currentLevelIndex,
            ghosts: []
          });
          break;
      }
    } catch (e) {
      console.error('[Zoom Server] Error processing message:', e);
    }
  });

  ws.on('close', () => {
    console.log(`[Zoom Server] Client disconnected: ${playerId}`);
    clients.delete(playerId);
    
    if (players[playerId]) {
      delete players[playerId];
      broadcast({ type: 'playerLeft', playerId: playerId });
    }

    if (playerId === hostId) {
      selectNewHost();
    }
  });
});

// Broadcast coordinate states 30 times/sec (reduces network jitter)
setInterval(() => {
  if (clients.size > 0) {
    broadcast({
      type: 'lobbyState',
      players: players
    });
  }
}, 33);

function broadcast(data, excludeId = null) {
  const msg = JSON.stringify(data);
  clients.forEach((socket, id) => {
    if (id !== excludeId && socket.readyState === 1) {
      socket.send(msg);
    }
  });
}
