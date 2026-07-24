# BOOM! // Spectral Exterminator

A retro-modern 3D First-Person Shooter built with Three.js, Vanilla CSS, and WebSockets. Exterminate spectral entities using a twisting additive electric neutrino stream, collect battery cores, play with friends in multiplayer lobby rooms, and automate training with Gymnasium RL agents or local LLMs (Gemma via Ollama).

---

## 1. System Requirements

### Frontend & Backend Servers
* **Node.js**: Version `18.0.0` or higher.
* **NPM**: Version `9.0.0` or higher.
* **Modern Browser**: Chrome, Safari, Edge, or Firefox supporting WebGL and Pointer Lock API.

### AI Client Suite (Optional)
* **Python**: Version `3.8` to `3.11` (recommended).
* **Python Dependencies**: Listed in `py_ai_client/requirements.txt` (`websockets`, `requests`, `numpy`, `gymnasium`).
* **Local LLM Engine (for Gemma operator)**: Ollama installed with the `gemma2:2b` model.

---

## 2. Step-by-Step Setup Guide

### Step 1: Clone and Set Up Workspace
Navigate to the root directory of the application:
```bash
npm install
```

### Step 2: Set Up Python AI Dependencies (Optional)
If you wish to run the autonomous AI agents, Gymnasium wrappers, or Ollama clients:
```bash
cd py_ai_client
python3 -m pip install -r requirements.txt --break-system-packages
cd ..
```

### Step 3: Run the Game and Servers
Run the unified startup script:
```bash
./start.sh
# OR
npm start
```
This launches:
* **The Game Client** at `http://localhost:3000/`
* **The WebSocket Lobby Server** on port `8080`
* **The Telemetry REST API** on port `8001`

### Step 4: Run the AI Agents
Open another terminal window, navigate to the project directory, and run any of the following bots:

* **To run the autonomous Hunter Bot:**
  ```bash
  python3 py_ai_client/ai_agent.py
  ```
* **To run the Companion Bot (will spawn next to you and follow you around):**
  ```bash
  python3 py_ai_client/companion_agent.py
  ```
* **To run the Gemma/Ollama AI Agent (ensure Ollama is running first):**
  ```bash
  ollama run gemma2:2b
  python3 py_ai_client/ollama_agent.py
  ```

---

## 3. Component Architecture

```mermaid
graph TD
    subgraph Client Browser (Port 3000)
        Main[main.js] --> Engine[GameEngine.js]
        Engine --> Player[Player.js]
        Engine --> Weapon[Weapon.js]
        Engine --> Map[Map.js]
        Engine --> Network[NetworkSystem.js]
        Engine --> ConsoleAI[ConsoleAIApi.js]
        Map --> MapData[MapData.js]
    end

    subgraph Backend Services
        LobbyWS[server.js WebSocket Port 8080] <--> Network
        TelemetryREST[server.js REST Port 8001] <--> ConsoleAI
    end

    subgraph Python AI Suite
        AIAgent[ai_agent.py] <--> LobbyWS
        CompanionAgent[companion_agent.py] <--> LobbyWS
        CompanionAgent <--> TelemetryREST
        OllamaAgent[ollama_agent.py] <--> TelemetryREST
        OllamaAgent --> OllamaLocal[Ollama Service Port 11434]
    end
```

### Frontend Modules (`src/game/`)
* **[GameEngine.js](file:///Users/jerry/Documents/antigravity/beautiful-bell/src/game/GameEngine.js):** The central conductor. Orchestrates the Three.js rendering pipeline, lighting, collision checks, particle physics, levels sync, and UI hooks.
* **[Player.js](file:///Users/jerry/Documents/antigravity/beautiful-bell/src/game/Player.js):** Manages local player states (HP, Shield, coordinates, mouse orientation, and collisions against walls).
* **[Weapon.js](file:///Users/jerry/Documents/antigravity/beautiful-bell/src/game/Weapon.js):** Simulates weapon physics. Manages battery charges, heat core values, venting states, particle beam meshes, and Macbook trackpad click minimum fire thresholds.
* **[Enemy.js](file:///Users/jerry/Documents/antigravity/beautiful-bell/src/game/Enemy.js):** Implements ghost states, animations, pathfinding target selections, and ectoplasmic projectiles.
* **[Map.js](file:///Users/jerry/Documents/antigravity/beautiful-bell/src/game/Map.js) & [MapData.js](file:///Users/jerry/Documents/antigravity/beautiful-bell/src/game/MapData.js):** Defines the structural layouts, point lights, teleporter portals, and power pellet spawn coordinate configurations.
* **[RemotePlayer.js](file:///Users/jerry/Documents/antigravity/beautiful-bell/src/game/RemotePlayer.js):** Visualizes remote players inside your screen using 3D glass-helmet meshes with lerp interpolation.
* **[NetworkSystem.js](file:///Users/jerry/Documents/antigravity/beautiful-bell/src/game/NetworkSystem.js):** Connects the client to the WebSocket lobby, broadcasting states and downloading player/ghost coordinates.
* **[ConsoleAIApi.js](file:///Users/jerry/Documents/antigravity/beautiful-bell/src/game/ConsoleAIApi.js):** Binds high-level telemetry/control functions directly to `window.boomAI`.

### Backend Modules (`server.js`)
* **[server.js](file:///Users/jerry/Documents/antigravity/beautiful-bell/server.js):** Co-hosts the WebSocket signaling lobby and the HTTP REST telemetry endpoints. Allocates client IDs, shifts host authority during disconnects, and manages shared ghost health states.

---

## 4. Script Utility Directory

| Script Name | Purpose | Execution Command |
| :--- | :--- | :--- |
| **`start.sh`** | Parallel startup script for Vite (3000) and Lobby servers (8080/8001). | `./start.sh` or `npm start` |
| **`stop.sh`** | Port scan killer to shut down dev instances and release ports. | `./stop.sh` or `npm run stop` |
| **`ai_agent.py`** | Standalone Python client that navigates autonomously to capture ghosts. | `python3 py_ai_client/ai_agent.py` |
| **`companion_agent.py`** | Guardian bot that tracks your position and defends you from nearby ghosts. | `python3 py_ai_client/companion_agent.py` |
| **`ollama_agent.py`** | local LLM controller using natural-language prompt reasoning via Ollama. | `python3 py_ai_client/ollama_agent.py` |
| **`zoom_env.py`** | Custom Gymnasium RL wrapper for training agents. | (Imported in python scripts) |
| **`train_rl.py`** | Gymnasium agent rollout simulation and DQN training wrapper. | `python3 py_ai_client/train_rl.py` |

---

## 5. Troubleshooting Guide

### Issue: "Address already in use" (EADDRINUSE)
If you get port collision errors on startup, it means some background node or vite instances were left running:
* **Solution:** Run `./stop.sh` or `npm run stop` to sweep and clear ports `3000`, `8080`, and `8001`.

### Issue: "AI bots are standing still at spawn"
If AI bots connect but stay stuck in place:
* **Solution:** Make sure you have refreshed your browser tab and clicked **INITIALIZE SYSTEM** first. The human host player must connect first to upload the active level's ghost coords to the server.

### Issue: "Mac trackpad clicks don't register visible beams"
Trackpads trigger rapid mouse events, causing normal weapon triggers to instantly cut off.
* **Solution:** The codebase implements a 250ms minimum firing duration lock. Ensure you have not modified `Weapon.js` minimum tick registers.

### Issue: "Web Audio is blocked or there is no sound"
Modern browsers block audio contexts until a direct user gesture occurs.
* **Solution:** Sound will engage as soon as you click **INITIALIZE SYSTEM** and click inside the screen to lock your mouse pointer.
