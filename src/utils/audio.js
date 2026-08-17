// Web Audio API Sound Synthesizer for Chess Sound Effects

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const playSound = (type) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (type) {
      case 'move': {
        // Soft wood thud / click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }

      case 'capture': {
        // Metallic friction click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }

      case 'check': {
        // High double alert chime
        const playChime = (time, pitch) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(pitch, time);
          osc.frequency.exponentialRampToValueAtTime(pitch * 1.2, time + 0.15);

          gain.gain.setValueAtTime(0.15, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

          osc.start(time);
          osc.stop(time + 0.15);
        };

        playChime(now, 523.25); // C5
        playChime(now + 0.08, 659.25); // E5
        break;
      }

      case 'gameover': {
        // Falling defeat or rising victory tones
        const notes = [261.63, 220.00, 196.00, 164.81]; // C4 -> A3 -> G3 -> E3
        notes.forEach((pitch, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(pitch, now + i * 0.12);
          gain.gain.setValueAtTime(0.2, now + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.15);

          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.15);
        });
        break;
      }

      case 'gamestart': {
        // High double drum/tone beat
        const playTone = (time, freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, time);
          gain.gain.setValueAtTime(0.25, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

          osc.start(time);
          osc.stop(time + 0.2);
        };
        playTone(now, 261.63); // C4
        playTone(now + 0.12, 329.63); // E4
        playTone(now + 0.24, 392.00); // G4
        playTone(now + 0.36, 523.25); // C5
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.warn('AudioContext failed to initialize or play sound:', error);
  }
};
