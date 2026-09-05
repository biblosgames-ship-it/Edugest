/**
 * Utilidad de Audio con Web Audio API para el Timbre Escolar y Silbato de Rotación.
 * No depende de archivos mp3 externos, funciona 100% offline y sin latencia.
 */

let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

export type SoundStyle = 'chime' | 'bell' | 'whistle';

/**
 * 1. Campanada Escolar Armónica (Chime Westminster / Bim-Bam)
 */
const playChimeSound = (ctx: AudioContext, masterVolume: number) => {
  const notes = [
    { freq: 659.25, time: 0.0, duration: 0.6 }, // E5
    { freq: 523.25, time: 0.5, duration: 0.6 }, // C5
    { freq: 587.33, time: 1.0, duration: 0.6 }, // D5
    { freq: 392.0, time: 1.5, duration: 1.2 }   // G4
  ];

  notes.forEach(({ freq, time, duration }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

    // Armónico suave para riqueza acústica
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, ctx.currentTime + time);
    const gain2 = ctx.createGain();

    const startTime = ctx.currentTime + time;
    const endTime = startTime + duration;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.4 * masterVolume, startTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    gain2.gain.setValueAtTime(0, startTime);
    gain2.gain.linearRampToValueAtTime(0.15 * masterVolume, startTime + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.0001, endTime);

    osc.connect(gain);
    osc2.connect(gain2);
    gain.connect(ctx.destination);
    gain2.connect(ctx.destination);

    osc.start(startTime);
    osc2.start(startTime);
    osc.stop(endTime + 0.1);
    osc2.stop(endTime + 0.1);
  });
};

/**
 * 2. Timbre Escolar Eléctrico Resonante (Clásico Ring-Ring de escuela)
 */
const playElectricBell = (ctx: AudioContext, masterVolume: number) => {
  const baseFreqs = [850, 920, 1150, 1400];
  const now = ctx.currentTime;
  const totalDuration = 2.2;

  baseFreqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator(); // Modulador de trémolo rápido (timbre)
    const lfoGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    lfo.type = 'square';
    lfo.frequency.setValueAtTime(22, now); // 22 repiques por segundo
    lfoGain.gain.setValueAtTime(0.5, now);

    lfo.connect(lfoGain);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25 * masterVolume, now + 0.05);
    gain.gain.setValueAtTime(0.25 * masterVolume, now + 1.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + totalDuration + 0.1);
    lfo.stop(now + totalDuration + 0.1);
  });
};

/**
 * 3. Silbato / Pito de Rotación (Triple pitido deportivo de cambio de turno)
 */
const playWhistleSound = (ctx: AudioContext, masterVolume: number) => {
  const beeps = [
    { start: 0.0, duration: 0.25, freq: 2400 },
    { start: 0.35, duration: 0.25, freq: 2400 },
    { start: 0.7, duration: 0.65, freq: 2600 }
  ];

  beeps.forEach(({ start, duration, freq }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const noise = ctx.createOscillator(); // Trémolo de silbato
    const noiseGain = ctx.createGain();

    const t = ctx.currentTime + start;
    const endT = t + duration;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq + 100, endT);

    noise.type = 'sine';
    noise.frequency.setValueAtTime(45, t);
    noiseGain.gain.setValueAtTime(15, t);
    noise.connect(osc.frequency);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5 * masterVolume, t + 0.03);
    gain.gain.setValueAtTime(0.5 * masterVolume, endT - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, endT);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    noise.start(t);
    osc.stop(endT + 0.05);
    noise.stop(endT + 0.05);
  });
};

/**
 * Reproducir sonido del timbre escolar
 */
export const playSchoolBellSound = async (style: SoundStyle = 'chime', volume: number = 0.9) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const safeVol = Math.max(0.1, Math.min(1.0, volume));

    switch (style) {
      case 'bell':
        playElectricBell(ctx, safeVol);
        break;
      case 'whistle':
        playWhistleSound(ctx, safeVol);
        break;
      case 'chime':
      default:
        playChimeSound(ctx, safeVol);
        break;
    }
    return true;
  } catch (err) {
    console.warn('Error al reproducir timbre escolar:', err);
    return false;
  }
};
