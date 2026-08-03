/**
 * Synthesized sound effects for the cave, played through the Web Audio API. No audio assets:
 * every effect is a short oscillator envelope, which keeps the retro character and avoids
 * shipping binary files.
 *
 * This module is driver-side only. Rules and simulation stay silent — `GameEntry` decides when
 * a state change deserves a sound, mirroring how it owns the keyboard but not the moves.
 */

let audioContext: AudioContext | null = null;

/** Lazy so the module can load during SSR and in browsers without Web Audio. Browsers refuse an
 * AudioContext before the first user gesture; our sounds only follow key presses, so by the time
 * this runs the gesture requirement is already met. */
function resolveAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") {
    return null;
  }

  audioContext ??= new window.AudioContext();
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
}

interface ToneOptions {
  frequency: number;
  /** Seconds after now at which the tone starts. */
  delay: number;
  /** Seconds from the tone's start to silence. */
  duration: number;
  type: OscillatorType;
  peakGain: number;
}

function playTone(context: AudioContext, { frequency, delay, duration, type, peakGain }: ToneOptions): void {
  const startTime = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  // Attack-then-decay envelope: without the ramp-in the oscillator starts with an audible click.
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

/** A low, short thud for a boulder hitting the ground. */
export function playBoulderThud(): void {
  const context = resolveAudioContext();
  if (!context) {
    return;
  }

  const startTime = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  // A falling pitch reads as impact; a flat low tone reads as a hum.
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(120, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(45, startTime + 0.15);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.5, startTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + 0.18);
}

/** A bright two-note chime for collecting a gem. */
export function playGemChime(): void {
  const context = resolveAudioContext();
  if (!context) {
    return;
  }

  playTone(context, { frequency: 1046.5, delay: 0, duration: 0.12, type: "square", peakGain: 0.12 });
  playTone(context, { frequency: 1568, delay: 0.07, duration: 0.16, type: "square", peakGain: 0.12 });
}

/** A short ascending fanfare for completing the level. */
export function playLevelWin(): void {
  const context = resolveAudioContext();
  if (!context) {
    return;
  }

  playTone(context, { frequency: 523.25, delay: 0, duration: 0.15, type: "square", peakGain: 0.14 });
  playTone(context, { frequency: 659.25, delay: 0.12, duration: 0.15, type: "square", peakGain: 0.14 });
  playTone(context, { frequency: 784, delay: 0.24, duration: 0.15, type: "square", peakGain: 0.14 });
  playTone(context, { frequency: 1046.5, delay: 0.36, duration: 0.35, type: "square", peakGain: 0.16 });
}
