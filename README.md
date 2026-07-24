# Rooms! // Crunch-Man Retro FPS

A retro-style browser-based 3D First-Person Shooter meets Pac-Man, built with Three.js, Vanilla CSS, WebSockets, and native Node.js unit tests.

You are **Crunch-Man**, trapped inside glowing neon rooms! Navigate the looping 3D corridors, gobble down floating random-colored cookies, avoid the chasing ghosts, and consume powerful corner cookies to reverse roles and eat the ghosts for massive points.

---

## 1. System Requirements

* **Node.js**: Version `18.0.0` or higher (tested on Node `25.9.0`).
* **NPM**: Version `9.0.0` or higher.
* **Modern Web Browser**: Supporting WebGL, Web Audio, and the Pointer Lock API.

---

## 2. Installation and Quick Start

### Step 1: Clone the Repository and Navigate to the Directory
```bash
git clone https://github.com/jpferreria/rooms.git
cd rooms
```

### Step 2: Install Node Dependencies
```bash
npm install
```

### Step 3: Run the Game Server
Execute the unified startup script:
```bash
./start.sh
```
This script launches:
* **The Client Assets Server** at `http://localhost:3000/`
* **The WebSocket Lobby Server** on port `8080`
* **The REST API Telemetry Interface** on port `8001`

### Step 4: Run the Unit Tests
To run the automated suite testing core collision-eating, flee/chase AI, respawn cooldowns, and lives logic:
```bash
npm test
# OR
node tests/game.test.js
```

---

## 3. How to Play

1. Open your browser and go to: [http://localhost:3000](http://localhost:3000)
2. Enter your callsign, click **Initialize System**, and click inside the viewport to lock your cursor.
3. **Objective**:
   - Eat all standard floating cookies in the maze to activate the exit teleporter.
   - Avoid contact with the ghosts (Green Phantasm, Pink Poltergeist, Blue Specter) in **Normal Mode**. Contact will instantly deplete your health and cost you a life.
   - Eat the blinking **Power Cookies** located at the corners to trigger **Powered-Up Mode**. In this state, the ghosts turn dark blue, run away, and can be consumed for +200 points.
   - Eat **Cherries** for bonus points (+100 pts) and health recovery.
   - Walk into the green teleporter portal once activated to advance to the next sector!

### Controls

| Key / Action | Action in Game |
| :--- | :--- |
| **`W` / `S`** | Move Forward / Backward |
| **`A` / `D`** | Rotate View Left / Right (360 degrees keyboard turning) |
| **`MOUSE`** | Look around (standard first-person camera) |
| **`LEFT CLICK`** | Trigger rapid biting/chomping animation |
| **`T`** | Toggle crosshair target sight on/off |
| **`ESC`** | Pause the game and release mouse cursor |

---

## 4. Game Settings

| Setting | Default Value | Description |
| :--- | :--- | :--- |
| **Starting Lives** | `3` | Number of attempts before triggering Game Over. |
| **Power-Up Duration** | `10.0 seconds` | Time Crunch-Man remains powered up after eating a Power Cookie. |
| **Flee Warning Threshold** | `3.0 seconds` | Frightened ghosts flash white/blue during the last 3 seconds of a power-up. |
| **Ghost Respawn Timer** | `5.0 seconds` | Cooldown time before an eaten ghost respawns at its spawn coordinate. |
| **Player Move Speed** | `6.0 units/sec` | Standard movement velocity. |
| **Keyboard Turn Speed** | `3.2 rad/sec` | Rotation rate when holding the `A` or `D` keys. |
| **Chomp Frequency** | `12.0Hz` (walk) / `24.0Hz` (click) | Animation speed of the yellow hemispheres biting. |
| **Score System** | Cookie: `+10` / Power Cookie: `+50` / Cherry: `+100` / Ghost: `+200` | Points awarded upon consumption. |
| **Cookie Colors** | Random | Pellets spawn in randomized neon colors (yellow, pink, green, cyan, orange, purple, red) in both 3D and on the 2D minimap. |

---

## 5. Component Directory (`src/game/`)

* **[GameEngine.js](file:///Users/jerry/Documents/antigravity/rooms/src/game/GameEngine.js):** Runs the rendering, level loaders, and the pixelated 2D canvas minimap (`updateMazeHUD()`).
* **[Player.js](file:///Users/jerry/Documents/antigravity/rooms/src/game/Player.js):** Tracks score, lives, power-up state timers, and handles collision checks for cookie eating.
* **[Weapon.js](file:///Users/jerry/Documents/antigravity/rooms/src/game/Weapon.js):** Renders the 3D spherical yellow Crunch-Man jaws, chomp rotation matrices, and smooth visual look-rotation offsets.
* **[Enemy.js](file:///Users/jerry/Documents/antigravity/rooms/src/game/Enemy.js):** Renders procedural normal and blue/white frightened sprites, controls normal chase vs vulnerable flee AI, and handles eaten states.
* **[Map.js](file:///Users/jerry/Documents/antigravity/rooms/src/game/Map.js) & [MapData.js](file:///Users/jerry/Documents/antigravity/rooms/src/game/MapData.js):** Defines level grids and handles mesh generation for random colored cookies, power pellets, and cherries.
* **[AudioSystem.js](file:///Users/jerry/Documents/antigravity/rooms/src/game/AudioSystem.js):** Synthesizes retro sound waves including alternating waka chomps, arpeggio chimes, and a speed-modulating siren.
