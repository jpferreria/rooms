import { GameEngine } from './game/GameEngine.js';

window.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const victoryBtn = document.getElementById('victory-btn');

  const menuContainer = document.getElementById('menu-container');
  const gameOverContainer = document.getElementById('game-over-container');
  const victoryContainer = document.getElementById('victory-container');
  const hudContainer = document.getElementById('hud-container');

  // Initialize the engine immediately on page load in the background.
  // This performs the heavy WebGL and scene creation BEFORE the user clicks.
  // The browser requires requestPointerLock to be in a direct, lightweight
  // user gesture callback (otherwise it rejects the request as expired).
  const engine = new GameEngine();
  engine.init();
  window.boomGame = engine; // Global hook for AI inspection
  engine.pause(); // Keep paused until pointer lock is engaged

  const initializeGame = () => {
    if (engine.isDead || engine.isVictory) {
      engine.reset();
      engine.pause();
    }

    // Read operator callsign text
    const usernameInput = document.getElementById('username-input');
    const username = usernameInput ? usernameInput.value.trim() : 'EXTERMINATOR';

    // Connect to WebSockets lobby server
    engine.network.connect(username);

    // Resume AudioContext inside user-gesture callback to bypass browser autoplay policies
    if (engine.audio) {
      engine.audio.resume();
    }

    // 1. Hide the menu overlay immediately BEFORE requesting pointer lock.
    menuContainer.classList.add('hidden');
    gameOverContainer.classList.add('hidden');
    victoryContainer.classList.add('hidden');
    hudContainer.classList.remove('hidden');

    // 2. Request Pointer Lock on the canvas (instant callback)
    engine.requestLock();
  };

  startBtn.addEventListener('click', initializeGame);
  restartBtn.addEventListener('click', initializeGame);
  victoryBtn.addEventListener('click', initializeGame);

  // Monitor escape/unlock transitions
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement) {
      // Game paused (pointer lock lost), show menu if not dead or victory
      if (!engine.isDead && !engine.isVictory) {
        menuContainer.classList.remove('hidden');
        hudContainer.classList.add('hidden');
        engine.pause();
      }
    } else {
      // Resumed (pointer lock acquired)
      menuContainer.classList.add('hidden');
      gameOverContainer.classList.add('hidden');
      victoryContainer.classList.add('hidden');
      hudContainer.classList.remove('hidden');
      engine.resume();
    }
  });

  // Handle pointer lock errors (silent denials by browser)
  document.addEventListener('pointerlockerror', (e) => {
    console.error('Pointer Lock failed!', e);
    // Revert UI to menu state
    menuContainer.classList.remove('hidden');
    hudContainer.classList.add('hidden');
    engine.pause();
    alert('Pointer Lock was denied by your browser. Please ensure you clicked inside the window and have given pointer lock permissions.');
  });
});
