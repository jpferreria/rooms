export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.ambientDrone = null;
    this.isMuted = false;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.createAmbientDrone();
    } catch (e) {
      console.warn("Web Audio API not supported or blocked by browser policies.", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        console.log('[Zoom Audio] AudioContext resumed successfully. State:', this.ctx.state);
      }).catch(e => {
        console.error('[Zoom Audio] Failed to resume AudioContext:', e);
      });
    }
  }

  createAmbientDrone() {
    if (!this.ctx) return;

    // Siren Oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime); // Base A3

    // LFO to modulate siren pitch (wobble)
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(2.0, this.ctx.currentTime); // 2.0Hz base speed
    lfoGain.gain.setValueAtTime(60, this.ctx.currentTime); // Modulation range +/- 60Hz

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime); // Clear background drone volume

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    lfo.start();

    this.ambientDrone = { osc, lfo, gain };
  }

  updateSirenSpeed(remaining, total) {
    if (!this.ambientDrone || !this.ctx) return;
    this.resume();

    const eaten = total - remaining;
    const ratio = total > 0 ? eaten / total : 0; // 0.0 to 1.0

    // Speed up LFO rate and raise pitch as cookies are eaten
    const speed = 2.0 + ratio * 5.5; // 2.0Hz -> 7.5Hz
    const baseFreq = 220 + ratio * 110; // 220Hz -> 330Hz

    this.ambientDrone.lfo.frequency.setTargetAtTime(speed, this.ctx.currentTime, 0.1);
    this.ambientDrone.osc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.1);
  }

  playChompSound(alternate) {
    if (!this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    
    // Alternating sweeps create the "waka waka" chomp rhythm
    const startFreq = alternate ? 280 : 520;
    const endFreq = alternate ? 520 : 280;

    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime); // Louder chomp
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playPowerUpSound() {
    if (!this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    
    // Ascending major arpeggio notes scheduled sequentially
    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(330, t); // E4
    osc.frequency.setValueAtTime(440, t + 0.08); // A4
    osc.frequency.setValueAtTime(554, t + 0.16); // C#5
    osc.frequency.setValueAtTime(660, t + 0.24); // E5
    osc.frequency.setValueAtTime(880, t + 0.32); // A5

    gain.gain.setValueAtTime(0.22, t); // Clear chimes volume
    gain.gain.setValueAtTime(0.22, t + 0.32);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(t + 0.45);
  }

  playGhostEatenSound() {
    if (!this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    
    // Fast high pitch ascending sweep
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1600, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playPlayerDeathSound() {
    if (!this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    
    // Slow downward winding pitch sweep
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(60, this.ctx.currentTime + 0.65);

    gain.gain.setValueAtTime(0.28, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.65);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.65);
  }

  playGhostScreech(relativeDistance = 1.0) {
    if (!this.ctx) return;
    this.resume();

    const volume = Math.max(0, 0.15 * (1.0 - relativeDistance));
    if (volume <= 0.01) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  playPickupSound(isShield = false) {
    if (!this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = isShield ? 330 : 440;
    const endFreq = isShield ? 660 : 880;

    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.setValueAtTime(endFreq, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playTeleportSound() {
    if (!this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1500, this.ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  playPlayerHit() {
    this.playPlayerDeathSound();
  }

  // Stubs for legacy code compatibility
  setBeamActive(active, pitchFactor = 1.0) {}
  playOverheatWarning() {}
  playVentingSound() {}
}
