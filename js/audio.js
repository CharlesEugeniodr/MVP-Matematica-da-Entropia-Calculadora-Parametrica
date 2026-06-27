/**
 * audio.js — Motor de Sonorização Dinâmica (Web Audio API)
 *
 * Gera um drone (zumbido) matemático proporcional ao nível de Entropia.
 * Permite disparar bipes de alerta quando catástrofes ocorrem.
 */

'use strict';

const AudioEngine = (() => {
  let audioCtx = null;
  let masterGain = null;
  let droneOsc = null;
  let isEnabled = false;

  function init() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.15; // Low volume background
      masterGain.connect(audioCtx.destination);

      droneOsc = audioCtx.createOscillator();
      droneOsc.type = 'triangle'; // Smooth but slightly buzzy
      droneOsc.frequency.value = 50; // Deep bass
      droneOsc.connect(masterGain);
      droneOsc.start();
      
      isEnabled = true;
    } catch (err) {
      console.warn("Web Audio API not supported.", err);
    }
  }

  function toggle() {
    if (!audioCtx) {
      init();
      if (!audioCtx) return false; // init failed
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
      isEnabled = true;
    } else if (audioCtx.state === 'running') {
      audioCtx.suspend();
      isEnabled = false;
    }
    return isEnabled;
  }

  function updateTension(lambda, lambda_crit) {
    if (!isEnabled || !droneOsc) return;

    // Normal safe zone lambda is around 0.4.
    // Critical is around 1.0.
    const ratio = Math.min(Math.max(lambda / lambda_crit, 0), 1.5);
    
    // Frequency shifts up as tension rises (50Hz to 150Hz)
    const targetFreq = 50 + (ratio * 100);
    droneOsc.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.5);

    // If critical, change waveform to sawtooth (harsher sound)
    if (ratio > 1.0) {
      droneOsc.type = 'sawtooth';
    } else {
      droneOsc.type = 'triangle';
    }
  }

  function playShockAlert(type) {
    if (!isEnabled || !audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(masterGain);

    if (type === 'pandemic') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
    } else if (type === 'war') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 1.0);
    } else if (type === 'tech') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.3);
    }

    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.0);

    osc.start();
    osc.stop(audioCtx.currentTime + 1.0);
  }

  return {
    toggle,
    updateTension,
    playShockAlert
  };

})();
